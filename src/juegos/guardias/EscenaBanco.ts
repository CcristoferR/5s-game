import {
  Scene,
  ImportMeshAsync,
  TransformNode,
  Vector3,
  AbstractMesh,
  Mesh,
  ShadowGenerator,
  Ray,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { afinarMateriales } from "./MaterialesModelo";

// ===========================================================================
// El modelo del banco
// ===========================================================================
//
// Solo carga el edificio y lo deja medido: centrado, apoyado en el suelo y con
// su interior conocido. Lo que pasa dentro —el puesto del guardia, la luz, la
// gente— está en PuestoBanco.

/** Altura de los ojos de una persona de pie. */
export const ALTURA_OJO = 1.65;

export interface OpcionesBanco {
  ruta?: string;
  escala?: number;
  shadowGenerator?: ShadowGenerator | null;
  diagnostico?: boolean;
}

/** Los bordes interiores de la sala, ya centrados y en metros. */
export interface InteriorBanco {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  alto: number;
}

export interface BancoCargado {
  raiz: TransformNode;
  mallas: AbstractMesh[];
  ancho: number;
  alto: number;
  fondo: number;
  /**
   * Dónde se puede estar de pie.
   *
   * Igual que en el supermercado, el modelo trae un piso que desborda los
   * muros: 11,1 m de losa para un edificio de 8,1. Colocar a alguien usando
   * las medidas del conjunto lo deja sobre el piso pero fuera de la sala.
   */
  interior: InteriorBanco;
  dispose: () => void;
}

export async function cargarBanco(
  scene: Scene,
  opciones: OpcionesBanco = {}
): Promise<BancoCargado> {
  const ruta = opciones.ruta ?? "/models/banco.glb";
  // POR 3, Y NO POR 0,01 NI POR 2.
  //
  // El GLB ya viene en metros: convertir_banco.py pasa los centímetros de Maya
  // a metros en Blender antes de exportar. Aquí se llegó a multiplicar otra
  // vez por 0,01, y el banco quedaba de unos cinco centímetros en el origen: el
  // nivel se veía como un fondo azul vacío, porque la cámara, a 1,65 m, no
  // tenía nada delante.
  //
  // El modelo de Maya está hecho a escala reducida, y estuvo doblado. Doblado
  // se recorría bien con la cámara sola, pero en cuanto hubo gente dentro
  // —figuras de 1,75— se vio que no alcanzaba, medido con rayos contra el
  // modelo:
  //
  //   · la puerta dejaba 1,33 m libres sobre el piso de la sala: una persona
  //     le pasaba por encima con los hombros;
  //   · el mesón llegaba a 0,49 m, a medio muslo, y el asiento de las sillas de
  //     espera a 0,28, a la altura del tobillo de alguien de pie.
  //
  // Por tres: puerta de 2,0 m de alto y 1,2 de ancho, asiento a 0,42, mesón a
  // 0,74 —la altura de un escritorio de atención— y el cielo a 5,25 m, que es
  // un hall de banco con columnas en la fachada. Las piezas coinciden entre sí
  // a este factor, así que el modelo solo estaba chico, no deformado.
  const escala = opciones.escala ?? 3;

  const resultado = await ImportMeshAsync(ruta, scene);

  const mallas = resultado.meshes.filter(
    (m) => m.getTotalVertices() > 0
  );

  if (mallas.length === 0) {
    throw new Error(
      `El archivo ${ruta} se cargó pero no contiene geometría.`
    );
  }

  const raiz = new TransformNode("banco", scene);

  resultado.meshes.forEach((malla) => {
    if (!malla.parent) {
      malla.parent = raiz;
    }
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

  let { minimo, maximo } = medirConjunto(mallas);

  // Centrar el modelo horizontalmente.
  raiz.position.x -= (minimo.x + maximo.x) / 2;
  raiz.position.z -= (minimo.z + maximo.z) / 2;

  // Apoyarlo en el piso.
  raiz.position.y -= minimo.y;

  raiz.computeWorldMatrix(true);

  ({ minimo, maximo } = medirConjunto(mallas));

  const ancho = maximo.x - minimo.x;
  const alto = maximo.y - minimo.y;
  const fondo = maximo.z - minimo.z;

  // El edificio, para saber dónde están los muros. Se busca por geometría: es
  // la malla que sube casi toda la altura del modelo y, entre esas, la de
  // mayor huella en planta. Así no depende de nombres como "set11", que no
  // dicen nada y cambian en cada reexportación.
  const alturaTotal = alto;
  let mejorArea = 0;
  let edificio: { min: Vector3; max: Vector3 } | null = null;
  mallas.forEach((malla) => {
    const caja = malla.getBoundingInfo().boundingBox;
    if (caja.maximumWorld.y - caja.minimumWorld.y < alturaTotal * 0.7) return;
    const area =
      (caja.maximumWorld.x - caja.minimumWorld.x) *
      (caja.maximumWorld.z - caja.minimumWorld.z);
    if (area > mejorArea) {
      mejorArea = area;
      edificio = { min: caja.minimumWorld.clone(), max: caja.maximumWorld.clone() };
    }
  });

  const MARGEN = 0.6;
  const cajaEdificio = (edificio ?? { min: minimo, max: maximo }) as {
    min: Vector3;
    max: Vector3;
  };
  const interior: InteriorBanco = {
    minX: cajaEdificio.min.x + MARGEN,
    maxX: cajaEdificio.max.x - MARGEN,
    minZ: cajaEdificio.min.z + MARGEN,
    maxZ: cajaEdificio.max.z - MARGEN,
    alto: cajaEdificio.max.y - minimo.y,
  };

  mallas.forEach((malla) => {
    malla.isPickable = false;
    malla.receiveShadows = true;
    malla.checkCollisions = true;

    if (opciones.shadowGenerator && malla instanceof Mesh) {
      opciones.shadowGenerator.addShadowCaster(malla, false);
    }
  });

  // Mismo afinado que el supermercado: filtrado alto en todas las texturas,
  // que es lo que hace legibles las letras vistas en ángulo.
  //
  // El rótulo, en cambio, queda pendiente de identificar. Este modelo llegó
  // con los nombres que pone Maya por defecto —initialShadingGroup, set3,
  // set9, set11, aiStandardSurface2SG— y desde aquí no hay forma de saber
  // cuál de ellos es el letrero. En el paquete original sí existe: hay una
  // carpeta Texturas/Letrero con sus cinco mapas.
  //
  // Con diagnostico activo, la consola imprime cada material con el tamaño y
  // la altura de su malla: el rótulo es el que está alto y es ancho y plano.
  // Una vez sabido, basta con ponerlo en la lista de abajo.
  afinarMateriales(scene, mallas, {
    // Las letras del rótulo, ya identificadas.
    //
    // Salieron de los nombres de grupo del OBJ: estos materiales van sobre
    // geometría llamada typeMesh, que es la herramienta Type de Maya, o sea
    // texto en 3D. Por eso ningún nombre decía "letrero": el exportador los
    // dejó con el nombre del nodo de sombreado, no con el de la pieza.
    //
    // "type" cubre typeOpenPBRSurfaceSG y pasted__typeOpenPBRSurfaceSG de una
    // vez, que son las dos tandas de letras.
    letreros: ["type"],
    brilloLetrero: 1.15,
    diagnostico: opciones.diagnostico,
  });

  if (opciones.diagnostico) {
    console.log(
      `[Banco] ${mallas.length} mallas · ` +
        `${ancho.toFixed(2)} × ` +
        `${alto.toFixed(2)} × ` +
        `${fondo.toFixed(2)} m`
    );
    console.log(
      `[Banco] interior: X ${interior.minX.toFixed(2)} a ${interior.maxX.toFixed(2)} · ` +
        `Z ${interior.minZ.toFixed(2)} a ${interior.maxZ.toFixed(2)} · ` +
        `${interior.alto.toFixed(2)} m de alto`
    );
  }

  return {
    raiz,
    mallas,
    ancho,
    alto,
    fondo,
    interior,
    dispose: () => {
      mallas.forEach((malla) => malla.dispose());
      raiz.dispose();
    },
  };
}

function medirConjunto(
  mallas: AbstractMesh[]
): { minimo: Vector3; maximo: Vector3 } {
  const minimo = new Vector3(
    Infinity,
    Infinity,
    Infinity
  );

  const maximo = new Vector3(
    -Infinity,
    -Infinity,
    -Infinity
  );

  mallas.forEach((malla) => {
    malla.computeWorldMatrix(true);

    const caja =
      malla.getBoundingInfo().boundingBox;

    minimo.minimizeInPlace(caja.minimumWorld);
    maximo.maximizeInPlace(caja.maximumWorld);
  });

  return {
    minimo,
    maximo,
  };
}

/**
 * Altura del suelo en (x, z), medida con un rayo hacia abajo.
 *
 * El piso de la sala va sobre una losa y no en y = 0, así que no se supone.
 * El rayo sale por debajo del cielo —lanzado desde arriba chocaría primero con
 * el techo— y solo prueba las mallas del banco. Con predicado propio Babylon
 * ignora isPickable, que en el escenario está en false.
 */
export function medirPiso(
  scene: Scene,
  mallas: AbstractMesh[],
  x: number,
  z: number
): number {
  const rayo = new Ray(new Vector3(x, ALTURA_OJO + 0.5, z), Vector3.Down(), 10);
  const impacto = scene.pickWithRay(rayo, (malla) => mallas.includes(malla));
  return impacto?.hit && impacto.pickedPoint ? impacto.pickedPoint.y : 0;
}
