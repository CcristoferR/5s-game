import {
  Scene,
  ImportMeshAsync,
  TransformNode,
  Vector3,
  AbstractMesh,
  Mesh,
  ShadowGenerator,
  PointLight,
  HemisphericLight,
  Color3,
  PBRMaterial,
  Ray,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { afinarMateriales } from "./MaterialesModelo";

// ===========================================================================
// El supermercado
// ===========================================================================
//
// Carga el escenario que entregó Bitplay para el segundo escenario del curso de
// guardias y lo deja plantado en el origen, con el piso en y = 0.
//
// ─── POR QUÉ SE CARGA UN GLB Y NO EL OBJ QUE LLEGÓ ────────────────────────
//
// Porque el paquete original no se puede usar tal cual. Su .mtl declara quince
// materiales sin una sola línea de textura —todos en negro— así que el modelo
// se dibuja plano y gris por mucho que las texturas estén en la carpeta de al
// lado. Además viene en centímetros y repartido en 5.046 grupos, que son 5.046
// llamadas de dibujo.
//
// El GLB resuelve las tres cosas de una vez, fuera del navegador: las texturas
// quedan enlazadas, la escala en metros y la geometría fusionada en quince
// mallas, una por material. El conversor que lo genera está versionado junto al
// modelo; si Bitplay reexporta el escenario, se vuelve a pasar y ya.
//
// ─── Y POR QUÉ ESTE ARCHIVO SE PARECE TANTO A Garaje.ts ───────────────────
//
// A propósito. El garaje del 5S y este comparten problema —un escenario ajeno
// que hay que medir, centrar y apoyar en el suelo— y conviene que compartan
// también la forma de resolverlo. Lo que cambia de verdad está en la
// iluminación: un galpón se ilumina distinto que una sala de ventas.

export interface OpcionesSupermercado {
  /** Ruta del .glb dentro de /public. Vite lo sirve desde la raíz. */
  ruta?: string;
  /** Multiplicador extra, por si el escenario entra grande o chico. */
  escala?: number;
  /** Si se pasa, todas las mallas reciben sombra. */
  shadowGenerator?: ShadowGenerator | null;
  /** Imprime en consola las medidas y los nombres de las mallas. */
  diagnostico?: boolean;
}

/** Los cuatro bordes interiores de la sala, ya centrados y en metros. */
export interface InteriorSala {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Alto libre bajo el techo. */
  alto: number;
}

export interface SupermercadoCargado {
  /** Nodo padre de todo: moverlo mueve el escenario entero. */
  raiz: TransformNode;
  mallas: AbstractMesh[];
  /** Medidas reales en metros, con la escala aplicada. */
  ancho: number;
  alto: number;
  fondo: number;
  /**
   * Dónde se puede estar de pie.
   *
   * ─── POR QUÉ NO BASTA CON LAS MEDIDAS DEL CONJUNTO ──────────────────────
   *
   * Porque el modelo trae un piso de 13,37 × 13,37 m y un edificio de solo
   * 8,3 × 6,1 dentro de él, y encima descentrado: el edificio va de −5,04 a
   * 3,29 en X. Quien use las medidas del conjunto para colocar una cámara o un
   * personaje lo deja sobre el piso, sí, pero fuera de los muros — que es
   * exactamente lo que pasaba al entrar al escenario.
   */
  interior: InteriorSala;
  dispose: () => void;
}

/**
 * Las mallas de producto de las góndolas: se dibujan igual, pero no chocan.
 *
 * ─── POR QUÉ NO CHOCAN ─────────────────────────────────────────────────────
 *
 * Porque eran lo más caro de todo el nivel y no hacían nada. Cada una es un
 * solo bloque con todos los productos de su clase repartidos por el local —la
 * de botellas tiene sesenta mil vértices—, así que su caja envolvente abarca
 * la sala entera y el choque de la cámara las tenía que recorrer triángulo a
 * triángulo en cada paso. Medido: caminar por un pasillo costaba 25,8 ms por
 * cuadro solo en eso; sin ellas, 0,21.
 *
 * Y no hacían nada porque las góndolas ya lo hacen. Medido también: los
 * productos quedan ocho centímetros o más por dentro del estante por cada
 * lado y por debajo de su tope (1,798 contra 1,80), así que la cámara choca
 * con el estante antes de poder rozar un producto. Y para la vista pasa lo
 * mismo: de 208 rayos de un pasillo al de al lado, el estante solo tapa 202,
 * y estante más productos, los mismos 202.
 *
 * Son los nombres con que vienen en el .glb.
 */
const PRODUCTOS = new Set(["Botellas", "Leches", "Latas 01", "Latas 02", "Latas 03", "Cereales", "Pastas"]);

export async function cargarSupermercado(
  scene: Scene,
  opciones: OpcionesSupermercado = {}
): Promise<SupermercadoCargado> {
  const ruta = opciones.ruta ?? "/models/supermercado.glb";
  const escala = opciones.escala ?? 1;

  const resultado = await ImportMeshAsync(ruta, scene);
  const mallas = resultado.meshes.filter((m) => m.getTotalVertices() > 0);

  if (mallas.length === 0) {
    throw new Error(`El archivo ${ruta} se cargó pero no trajo geometría.`);
  }

  const raiz = new TransformNode("supermercado", scene);
  resultado.meshes.forEach((malla) => {
    if (!malla.parent) malla.parent = raiz;
  });

  raiz.scaling.setAll(escala);
  raiz.computeWorldMatrix(true);
  // Antes aquí había un scene.render() para forzar el cálculo de las matrices
  // de mundo. Era innecesario y además rompía el nivel: los escenarios vacían
  // la escena al entrar —y eso deja scene.activeCamera en null— así que este
  // render se ejecutaba SIN CÁMARA y Babylon lanzaba "No camera defined".
  // De ahí la pantalla en negro al abrir el supermercado o el banco.
  //
  // No hace falta: medirConjunto ya llama a computeWorldMatrix(true) sobre cada
  // malla, que es lo único que se necesitaba de aquel render.

  const { minimo, maximo } = medirConjunto(mallas);
  const alturaPiso = detectarSuperficieDelPiso(mallas, minimo, maximo);
  const edificio = detectarEdificio(mallas, minimo, maximo);

  // Se centra sobre EL EDIFICIO, no sobre el conjunto. El piso desborda los
  // muros y además no lo hace por igual en los cuatro lados, así que centrar
  // sobre el conjunto deja la sala corrida respecto del origen.
  const centro = edificio ?? { minimumWorld: minimo, maximumWorld: maximo };
  raiz.position.x -= (centro.minimumWorld.x + centro.maximumWorld.x) / 2;
  raiz.position.z -= (centro.minimumWorld.z + centro.maximumWorld.z) / 2;
  raiz.position.y -= alturaPiso;
  raiz.computeWorldMatrix(true);

  mallas.forEach((malla) => {
    // El escenario no se arrastra ni se toca: sacarlo del picking evita que un
    // clic sobre una góndola le robe el evento a lo que sí es interactivo.
    malla.isPickable = false;
    malla.receiveShadows = true;
    malla.checkCollisions = !PRODUCTOS.has(malla.name);

    if (opciones.shadowGenerator && malla instanceof Mesh) {
      opciones.shadowGenerator.addShadowCaster(malla, false);
    }
  });

  // Medio metro de retranqueo desde los muros: el espesor de la tabiquería más
  // el espacio que necesita cualquiera para no rozarla.
  const MARGEN = 0.5;
  const anchoEdificio = edificio
    ? edificio.maximumWorld.x - edificio.minimumWorld.x
    : maximo.x - minimo.x;
  const fondoEdificio = edificio
    ? edificio.maximumWorld.z - edificio.minimumWorld.z
    : maximo.z - minimo.z;
  const interior: InteriorSala = {
    minX: -anchoEdificio / 2 + MARGEN,
    maxX: anchoEdificio / 2 - MARGEN,
    minZ: -fondoEdificio / 2 + MARGEN,
    maxZ: fondoEdificio / 2 - MARGEN,
    alto: edificio ? edificio.maximumWorld.y - alturaPiso : maximo.y - minimo.y,
  };

  const ancho = maximo.x - minimo.x;
  const alto = maximo.y - minimo.y;
  const fondo = maximo.z - minimo.z;

  // El rótulo del supermercado se enciende, y todas las texturas suben de
  // filtrado. Ver MaterialesModelo: es lo que hace que las letras se lean.
  //
  // "Letrero colgante" es el nombre que trae el material dentro del .glb, así
  // que si Bitplay reexporta el escenario conservándolo, esto sigue valiendo.
  //
  // Y las tres latas pierden el metal con el que vienen: sin entorno que
  // reflejar se veían negras. Mismo sitio y mismo motivo, sin tocar el .glb.
  afinarMateriales(scene, mallas, { letreros: ["letrero"], brilloLetrero: 1.15, sinMetal: ["lata"] });

  // ─── EL MODELO NO SE MUEVE MÁS ─────────────────────────────────────────
  //
  // Ya está escalado, centrado y apoyado en el piso. A partir de aquí nadie lo
  // mueve, así que se le congela la matriz de mundo: Babylon deja de
  // recalcularla —y con ella la caja envolvente— en cada cuadro para cuarenta
  // mallas que están quietas. No cambia nada de lo que se ve: la matriz
  // congelada es exactamente la que tienen ahora.
  mallas.forEach((malla) => malla.freezeWorldMatrix());

  if (opciones.diagnostico) {
    console.log(
      `[supermercado] piso detectado en y=${alturaPiso.toFixed(2)} · ` +
        `${mallas.length} mallas · ${ancho.toFixed(2)} × ${alto.toFixed(
        2
      )} × ${fondo.toFixed(2)} m`
    );
    console.log(
      `[supermercado] interior: X ${interior.minX.toFixed(2)} a ${interior.maxX.toFixed(
        2
      )} · Z ${interior.minZ.toFixed(2)} a ${interior.maxZ.toFixed(2)}`
    );
    console.log("[supermercado] mallas:", mallas.map((m) => m.name).join(", "));
  }

  return {
    raiz,
    mallas,
    ancho,
    alto,
    fondo,
    interior,
    dispose: () => {
      mallas.forEach((m) => m.dispose());
      raiz.dispose();
    },
  };
}

/** La losa medida en el OBJ, por si el rayo no encuentra el piso. */
const PISO_MEDIDO = 0.16;

/**
 * Altura del suelo que se pisa, medida con un rayo.
 *
 * ─── POR QUÉ NO ES CERO ───────────────────────────────────────────────────
 *
 * El modelo queda apoyado en y = 0 por la base de los muebles (ver
 * detectarSuperficieDelPiso), pero la losa del edificio asoma dieciséis
 * centímetros por encima de esa cota. Lo que se levanta o camina sobre el
 * suelo —los tabiques de la bodega, los clientes— se coloca desde aquí: desde
 * cero quedaría con los pies hundidos en la losa.
 *
 * Primero se ponen al día las matrices de mundo del modelo. Recién cargado y
 * centrado, sus mallas siguen con la posición de antes de moverlo, y el rayo
 * las buscaría donde ya no están. Con predicado propio Babylon ignora
 * isPickable, que en el escenario está apagado.
 */
export function medirPisoSala(scene: Scene, modelo: Pick<SupermercadoCargado, "raiz" | "mallas">): number {
  modelo.raiz.getChildMeshes(false).forEach((malla) => malla.computeWorldMatrix(true));

  // En el cruce del pasillo transversal, donde no hay mueble que el rayo pueda
  // tocar antes que el piso.
  const rayo = new Ray(new Vector3(0, 1.5, 0), Vector3.Down(), 3);
  const impacto = scene.pickWithRay(rayo, (malla) => modelo.mallas.includes(malla));

  if (impacto?.hit && impacto.pickedPoint) return impacto.pickedPoint.y;
  console.warn(`[supermercado] el rayo no encontró el piso; se usa la losa medida (${PISO_MEDIDO} m).`);
  return PISO_MEDIDO;
}

/**
 * Devuelve la altura de la cara superior del piso.
 *
 * Misma heurística que en el garaje, y por la misma razón: los nombres que
 * exporta Maya no dicen nada y cambian en cada reexportación, así que se busca
 * por geometría. La losa es la malla que cubre buena parte de la planta Y que
 * arranca cerca del punto más bajo del modelo — con esa segunda condición no se
 * confunde con el techo, que tiene una huella parecida pero está arriba.
 */
function detectarSuperficieDelPiso(
  mallas: AbstractMesh[],
  minimo: Vector3,
  maximo: Vector3
): number {
  // EL SUELO ES DONDE SE APOYAN LOS MUEBLES.
  //
  // ─── POR QUÉ NO SE BUSCA LA LOSA ──────────────────────────────────────────
  //
  // Los dos intentos anteriores partían de encontrar la malla del piso: primero
  // la más grande que estuviera abajo, después la más grande y delgada. Las dos
  // fallan con este modelo por la misma razón, y es que el conversor FUSIONA LA
  // GEOMETRÍA POR MATERIAL. El piso no es una malla: está repartido entre la
  // del edificio —que además incluye muros y techo, y por eso mide varios
  // metros de alto— y la del material Base. No hay una losa que encontrar.
  //
  // ─── LO QUE SÍ SE PUEDE MEDIR ─────────────────────────────────────────────
  //
  // Una estantería, una caja registradora y una máquina expendedora tienen algo
  // en común que ninguna fusión de materiales altera: SU BASE TOCA EL SUELO.
  // Así que la altura del piso es la que más se repite entre los puntos más
  // bajos de los muebles.
  //
  // Es más robusto que buscar la losa porque no depende de cómo esté partida la
  // geometría, ni de que el modelo traiga piso, ni de cómo se llame nada. Si
  // Bitplay reexporta el escenario con otra organización de materiales, esto
  // sigue funcionando.
  const alturaTotal = maximo.y - minimo.y;
  const techoDeBusqueda = minimo.y + alturaTotal * 0.5;

  // Se agrupan las bases en escalones de cinco centímetros: los muebles no se
  // apoyan todos en la misma cota exacta, pero sí en la misma franja.
  const ESCALON = 0.05;
  const cuenta = new Map<number, number>();

  mallas.forEach((malla) => {
    const caja = malla.getBoundingInfo().boundingBox;
    const alto = caja.maximumWorld.y - caja.minimumWorld.y;

    // Fuera lo que es demasiado alto para ser un mueble: eso es el edificio.
    if (alto > alturaTotal * 0.55) return;
    // Y fuera lo que está colgado: rótulos e instalaciones de techo.
    if (caja.minimumWorld.y > techoDeBusqueda) return;

    const escalon = Math.round(caja.minimumWorld.y / ESCALON);
    cuenta.set(escalon, (cuenta.get(escalon) ?? 0) + 1);
  });

  let mejorEscalon: number | null = null;
  let masVotos = 0;
  cuenta.forEach((votos, escalon) => {
    // A igualdad de votos gana el más bajo: si hay muebles sobre una tarima, el
    // suelo es el de abajo.
    if (votos > masVotos || (votos === masVotos && mejorEscalon !== null && escalon < mejorEscalon)) {
      masVotos = votos;
      mejorEscalon = escalon;
    }
  });

  return mejorEscalon === null ? minimo.y : mejorEscalon * ESCALON;
}

/**
 * Encuentra la malla del edificio: muros, techo y estructura.
 *
 * Se busca por geometría y no por nombre. Es la que sube prácticamente toda la
 * altura del modelo —los muros llegan al techo, las góndolas no pasan del
 * metro— y, entre las que cumplen eso, la de mayor huella en planta. Así sigue
 * funcionando si Bitplay reexporta el escenario con otros nombres de malla.
 */
function detectarEdificio(
  mallas: AbstractMesh[],
  minimo: Vector3,
  maximo: Vector3
): { minimumWorld: Vector3; maximumWorld: Vector3 } | null {
  const alturaTotal = maximo.y - minimo.y;
  let mejorArea = 0;
  let elegida: { minimumWorld: Vector3; maximumWorld: Vector3 } | null = null;

  mallas.forEach((malla) => {
    const caja = malla.getBoundingInfo().boundingBox;
    if (caja.maximumWorld.y - caja.minimumWorld.y < alturaTotal * 0.7) return;
    const area =
      (caja.maximumWorld.x - caja.minimumWorld.x) *
      (caja.maximumWorld.z - caja.minimumWorld.z);
    if (area > mejorArea) {
      mejorArea = area;
      elegida = { minimumWorld: caja.minimumWorld, maximumWorld: caja.maximumWorld };
    }
  });

  return elegida;
}

/** Caja que envuelve a todas las mallas juntas, en coordenadas de mundo. */
function medirConjunto(mallas: AbstractMesh[]): { minimo: Vector3; maximo: Vector3 } {
  const minimo = new Vector3(Infinity, Infinity, Infinity);
  const maximo = new Vector3(-Infinity, -Infinity, -Infinity);

  mallas.forEach((malla) => {
    malla.computeWorldMatrix(true);
    malla.refreshBoundingInfo({ applySkeleton: false });
    const caja = malla.getBoundingInfo().boundingBox;
    minimo.minimizeInPlace(caja.minimumWorld);
    maximo.maximizeInPlace(caja.maximumWorld);
  });

  return { minimo, maximo };
}

/**
 * Ilumina la sala de ventas.
 *
 * ─── POR QUÉ NO SIRVE LA RECETA DEL GARAJE ────────────────────────────────
 *
 * Un galpón se ilumina con unos pocos focos colgados y sombras marcadas; ahí
 * el contraste es parte del sitio. Una sala de ventas es lo contrario: está
 * pensada para que el producto se vea, con luz pareja de techo y casi sin
 * sombra dura. Un supermercado con la iluminación de un taller se lee como un
 * depósito, no como una tienda.
 *
 * Por eso aquí la mayor parte viene del relleno ambiental y los focos solo
 * marcan los pasillos.
 *
 * @param alturaTecho  Altura real de la sala, para colgar los focos debajo.
 */
export function iluminarSupermercado(
  scene: Scene,
  alturaTecho: number,
  pasillos: number[] = [-3.5, 0, 3.5]
): void {
  const relleno =
    (scene.getLightByName("luzRellenoSupermercado") as HemisphericLight | null) ??
    new HemisphericLight("luzRellenoSupermercado", new Vector3(0, 1, 0), scene);
  // Alto a propósito: en una tienda la luz rebota en el piso brillante y en los
  // envases, y casi no quedan zonas oscuras.
  relleno.intensity = 1.05;
  relleno.diffuse = new Color3(1, 0.99, 0.96);
  relleno.groundColor = new Color3(0.55, 0.56, 0.6);

  pasillos.forEach((z, i) => {
    const luz = new PointLight(
      `luzPasilloSupermercado_${i}`,
      new Vector3(0, alturaTecho - 0.35, z),
      scene
    );
    // Blanco frío, que es el de los tubos de una sala de ventas. Con luz cálida
    // el producto se ve apetecible pero el sitio deja de parecer un comercio.
    luz.diffuse = new Color3(0.96, 0.98, 1);
    luz.specular = new Color3(0.9, 0.93, 1);
    luz.intensity = 0.55;
    luz.range = 12;
  });
}

/**
 * Sube el tope de luces por material.
 *
 * Babylon compila cada material para un número fijo de luces —cuatro por
 * defecto— y las que sobran no se calculan, en silencio. Entre el relleno y los
 * focos de pasillo ya se pasa de ese tope.
 */
export function ampliarLucesSupermercado(scene: Scene): void {
  scene.materials.forEach((mat) => {
    if (mat instanceof PBRMaterial) mat.maxSimultaneousLights = 8;
  });
} 