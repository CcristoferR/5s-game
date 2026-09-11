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
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

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

export interface SupermercadoCargado {
  /** Nodo padre de todo: moverlo mueve el escenario entero. */
  raiz: TransformNode;
  mallas: AbstractMesh[];
  /** Medidas reales en metros, con la escala aplicada. */
  ancho: number;
  alto: number;
  fondo: number;
  dispose: () => void;
}

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
  scene.render();

  const { minimo, maximo } = medirConjunto(mallas);
  const alturaPiso = detectarSuperficieDelPiso(mallas, minimo, maximo);

  raiz.position.x -= (minimo.x + maximo.x) / 2;
  raiz.position.z -= (minimo.z + maximo.z) / 2;
  raiz.position.y -= alturaPiso;
  raiz.computeWorldMatrix(true);

  mallas.forEach((malla) => {
    // El escenario no se arrastra ni se toca: sacarlo del picking evita que un
    // clic sobre una góndola le robe el evento a lo que sí es interactivo.
    malla.isPickable = false;
    malla.receiveShadows = true;
    malla.checkCollisions = true;

    if (opciones.shadowGenerator && malla instanceof Mesh) {
      opciones.shadowGenerator.addShadowCaster(malla, false);
    }
  });

  const ancho = maximo.x - minimo.x;
  const alto = maximo.y - minimo.y;
  const fondo = maximo.z - minimo.z;

  if (opciones.diagnostico) {
    console.log(
      `[supermercado] ${mallas.length} mallas · ${ancho.toFixed(2)} × ${alto.toFixed(
        2
      )} × ${fondo.toFixed(2)} m`
    );
    console.log("[supermercado] mallas:", mallas.map((m) => m.name).join(", "));
  }

  return {
    raiz,
    mallas,
    ancho,
    alto,
    fondo,
    dispose: () => {
      mallas.forEach((m) => m.dispose());
      raiz.dispose();
    },
  };
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
  const areaPlanta = (maximo.x - minimo.x) * (maximo.z - minimo.z);
  const alturaTotal = maximo.y - minimo.y;
  const techoDeBusqueda = minimo.y + alturaTotal * 0.12;

  let mejorArea = 0;
  let alturaSuperior: number | null = null;

  mallas.forEach((malla) => {
    const caja = malla.getBoundingInfo().boundingBox;
    if (caja.minimumWorld.y > techoDeBusqueda) return;
    const area =
      (caja.maximumWorld.x - caja.minimumWorld.x) *
      (caja.maximumWorld.z - caja.minimumWorld.z);
    if (area < areaPlanta * 0.35) return;
    if (area > mejorArea) {
      mejorArea = area;
      alturaSuperior = caja.maximumWorld.y;
    }
  });

  return alturaSuperior ?? minimo.y;
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