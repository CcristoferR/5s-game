import {
  Scene,
  ImportMeshAsync,
  TransformNode,
  Vector3,
  AbstractMesh,
  Mesh,
  ShadowGenerator,
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

  // Centrado en X/Z y piso al ras de y = 0.
  raiz.position.x -= (minimo.x + maximo.x) / 2;
  raiz.position.z -= (minimo.z + maximo.z) / 2;
  raiz.position.y -= minimo.y;
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