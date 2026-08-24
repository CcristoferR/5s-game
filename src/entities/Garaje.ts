import {
  Scene,
  ImportMeshAsync,
  TransformNode,
  Vector3,
  AbstractMesh,
  Mesh,
  ShadowGenerator,
  PointLight,
  Color3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export interface OpcionesGaraje {
  /** Ruta del .glb dentro de /public. Vite lo sirve desde la raíz. */
  ruta?: string;
  /** Multiplicador extra si el garaje entra muy grande o muy chico. */
  escala?: number;
  /** Si se pasa, todas las mallas del garaje reciben sombra de los objetos. */
  shadowGenerator?: ShadowGenerator | null;
  /** Activa colisiones contra paredes y pilares (para cuando la cámara camine). */
  colisiones?: boolean;
  /** Imprime en consola las dimensiones y los nombres de las mallas. */
  diagnostico?: boolean;
}

export interface GarajeCargado {
  /** Nodo padre de todo el garaje: moverlo/rotarlo mueve la escena entera. */
  raiz: TransformNode;
  mallas: AbstractMesh[];
  /** Medidas reales en metros, ya con la escala aplicada. */
  ancho: number;
  alto: number;
  fondo: number;
  dispose: () => void;
}

/**
 * Carga el garaje y lo deja plantado en el origen: centrado en X/Z y con el
 * piso exactamente en y = 0, que es donde el resto del juego apoya sus cosas.
 *
 * No depende de los nombres que haya puesto el modelador: mide el conjunto y
 * lo reubica solo. Si mañana Bitplay manda una versión con estantes y vigas,
 * sigue funcionando sin tocar este archivo.
 */
export async function cargarGaraje(scene: Scene, opciones: OpcionesGaraje = {}): Promise<GarajeCargado> {
  const ruta = opciones.ruta ?? "/models/garaje.glb";
  const escala = opciones.escala ?? 1;

  const resultado = await ImportMeshAsync(ruta, scene);
  const mallas = resultado.meshes.filter((m) => m.getTotalVertices() > 0);

  if (mallas.length === 0) {
    throw new Error(`El archivo ${ruta} se cargó pero no trajo geometría.`);
  }

  const raiz = new TransformNode("garaje", scene);

  // Se cuelgan del nodo raíz solo las mallas de primer nivel; las hijas ya
  // vienen colgadas de esas y se moverían dos veces.
  resultado.meshes.forEach((malla) => {
    if (!malla.parent) {
      malla.parent = raiz;
    }
  });

  raiz.scaling.setAll(escala);
  raiz.computeWorldMatrix(true);
  scene.render();

  const { minimo, maximo } = medirConjunto(mallas);

  // Altura a la que hay que bajar el garaje para que se pueda caminar sobre el
  // piso. OJO: no es minimo.y. La losa de concreto tiene espesor propio (en el
  // modelo de Bitplay son 23 cm), asi que alinear el FONDO de la losa con y = 0
  // deja la superficie pisable a 0.23 m de altura. Todo el resto del juego
  // asume que el suelo es y = 0, y con ese desfase las zonas de colores del
  // Nivel 1 (que solo levantan 5 cm) quedaban literalmente enterradas dentro
  // del concreto: se veian las etiquetas flotando y ningun rectangulo.
  const alturaPiso = detectarSuperficieDelPiso(mallas, minimo, maximo);

  // Centrado en X/Z y superficie pisable exactamente en y = 0.
  raiz.position.x -= (minimo.x + maximo.x) / 2;
  raiz.position.z -= (minimo.z + maximo.z) / 2;
  raiz.position.y -= alturaPiso;
  raiz.computeWorldMatrix(true);

  const ancho = maximo.x - minimo.x;
  const alto = maximo.y - minimo.y;
  const fondo = maximo.z - minimo.z;

  mallas.forEach((malla) => {
    // El garaje es escenario, no algo que el jugador arrastre: sacarlo del
    // picking evita que un clic sobre una pared robe el evento a un objeto.
    malla.isPickable = false;
    malla.receiveShadows = true;

    if (opciones.colisiones) {
      malla.checkCollisions = true;
    }

    if (opciones.shadowGenerator && malla instanceof Mesh) {
      opciones.shadowGenerator.addShadowCaster(malla, false);
    }
  });

  if (opciones.diagnostico) {
    console.log(
      `[garaje] ${mallas.length} mallas · ${ancho.toFixed(2)} m ancho × ${alto.toFixed(
        2
      )} m alto × ${fondo.toFixed(2)} m fondo`
    );
    console.log("[garaje] mallas:", mallas.map((m) => m.name).join(", "));
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
 * Busca la losa: la malla que cubre buena parte de la planta del edificio y
 * que ademas arranca cerca del punto mas bajo del modelo (asi no confunde el
 * techo ni el entrepiso, que tienen una huella parecida pero estan arriba).
 * Se queda con su cara de arriba.
 *
 * Es una heuristica por geometria a proposito: los nombres de malla que exporta
 * Maya son "Mesh.012", "Mesh.093"... no dicen nada, y cambian en cada
 * reexportacion. Midiendo, esto sigue funcionando si maniana llega otra version
 * del garaje.
 */
function detectarSuperficieDelPiso(mallas: AbstractMesh[], minimo: Vector3, maximo: Vector3): number {
  const areaPlanta = (maximo.x - minimo.x) * (maximo.z - minimo.z);
  const alturaTotal = maximo.y - minimo.y;
  const techoDeBusqueda = minimo.y + alturaTotal * 0.12;

  let mejorArea = 0;
  let alturaSuperior: number | null = null;

  mallas.forEach((malla) => {
    const caja = malla.getBoundingInfo().boundingBox;
    const min = caja.minimumWorld;
    const max = caja.maximumWorld;

    // Tiene que empezar abajo del todo: descarta techo y entrepisos.
    if (min.y > techoDeBusqueda) return;

    const area = (max.x - min.x) * (max.z - min.z);
    // Y tiene que ser una superficie amplia, no un pilar ni una rampa suelta.
    if (area < areaPlanta * 0.35) return;

    if (area > mejorArea) {
      mejorArea = area;
      alturaSuperior = max.y;
    }
  });

  // Sin losa reconocible se vuelve al comportamiento anterior, que al menos
  // deja el modelo apoyado en vez de hundido.
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

/** Un foco de techo del garaje, centrado en X y ubicado sobre una zona de juego. */
export interface FocoGaraje {
  /** Profundidad (Z) sobre la que cuelga el foco. */
  z: number;
  intensidad?: number;
  /** Temperatura de color. Por defecto una luz calida de taller. */
  tinte?: Color3;
}

/**
 * Ilumina el interior del garaje.
 *
 * Hace falta porque el garaje TIENE TECHO: la luz direccional de la escena
 * queda afuera y el interior, por si solo, es una cueva. Se sube el relleno
 * ambiental y se cuelgan focos sobre las zonas donde el jugador trabaja.
 *
 * Vive aca y no dentro de cada nivel para que todos los niveles compartan la
 * misma receta de iluminacion y el escenario se vea igual en los cinco.
 */
export function iluminarInteriorGaraje(scene: Scene, focos: FocoGaraje[]): void {
  const relleno = scene.getLightByName("luzRelleno");
  if (relleno) {
    relleno.intensity = 0.75;
  }

  focos.forEach((foco, i) => {
    const luz = new PointLight(`luzGaraje_${i}`, new Vector3(0, 4.2, foco.z), scene);
    luz.diffuse = foco.tinte ?? new Color3(1, 0.96, 0.88);
    luz.intensity = foco.intensidad ?? 0.85;
    luz.range = 14;
  });
}