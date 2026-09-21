import {
  Scene,
  ImportMeshAsync,
  TransformNode,
  Vector3,
  AbstractMesh,
  Mesh,
  ShadowGenerator,
  HemisphericLight,
  PointLight,
  Color3,
  Color4,
  FreeCamera,
  DefaultRenderingPipeline,
  Ray,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { afinarMateriales } from "./MaterialesModelo";

/** Altura de los ojos de una persona de pie. */
const ALTURA_OJO = 1.65;

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
  // POR 2, Y NO POR 0,01.
  //
  // El GLB ya viene en metros: convertir_banco.py pasa los centímetros de Maya
  // a metros en Blender antes de exportar. Aquí se llegó a multiplicar otra
  // vez por 0,01, y el banco quedaba de unos cinco centímetros en el origen: el
  // nivel se veía como un fondo azul vacío, porque la cámara, a 1,65 m, no
  // tenía nada delante.
  //
  // El ×2 es porque el modelo de Maya está hecho a media escala: el mesón mide
  // 66 cm, la puerta 90 y el cielo queda a 1,75 m del piso. A ese tamaño una
  // persona no cabe por la puerta. Doblado: mesón de 1,3 m, puerta de 1,8 y
  // cielo a unos 3,5 m.
  const escala = opciones.escala ?? 2;

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
function medirPiso(
  scene: Scene,
  mallas: AbstractMesh[],
  x: number,
  z: number
): number {
  const rayo = new Ray(new Vector3(x, ALTURA_OJO + 0.5, z), Vector3.Down(), 10);
  const impacto = scene.pickWithRay(rayo, (malla) => mallas.includes(malla));
  return impacto?.hit && impacto.pickedPoint ? impacto.pickedPoint.y : 0;
}

function iluminarBanco(
  scene: Scene,
  interior: InteriorBanco,
  pisoY: number
): void {
  const relleno =
    (scene.getLightByName(
      "luzRellenoBanco"
    ) as HemisphericLight | null) ??
    new HemisphericLight(
      "luzRellenoBanco",
      new Vector3(0, 1, 0),
      scene
    );

  relleno.intensity = 1.0;
  relleno.diffuse = new Color3(
    1,
    0.98,
    0.94
  );

  relleno.groundColor = new Color3(
    0.42,
    0.44,
    0.48
  );

  // Colgados bajo el cielo y repartidos por la sala real. Antes iban fijos en
  // ±1,7 m y a la altura total del modelo, que incluye el techo exterior: los
  // focos quedaban por encima del cielo y lejos de todo.
  const alturaLuz = pisoY + 3.0;
  const xs = [0.25, 0.75].map(
    (f) => interior.minX + (interior.maxX - interior.minX) * f
  );
  const zs = [0.25, 0.75].map(
    (f) => interior.minZ + (interior.maxZ - interior.minZ) * f
  );
  const focos = zs.flatMap((z) =>
    xs.map((x) => new Vector3(x, alturaLuz, z))
  );

  focos.forEach((posicion, i) => {
    const existente =
      scene.getLightByName(
        `luzBanco_${i}`
      ) as PointLight | null;

    const luz =
      existente ??
      new PointLight(
        `luzBanco_${i}`,
        posicion,
        scene
      );

    luz.position.copyFrom(posicion);

    luz.diffuse = new Color3(
      1,
      0.97,
      0.92
    );

    luz.specular = new Color3(
      0.85,
      0.88,
      0.92
    );

    luz.intensity = 0.55;
    luz.range = 9;
  });
}

export async function crearRecorridoBanco(
  scene: Scene,
  onSalir: () => void
): Promise<BancoCargado> {
  // Lo primero, y antes de nada: vaciar lo que dejó el escenario anterior.
  // Sin esto, el banco se monta encima del hall del condominio y del
  // supermercado — con sus mallas, sus luces y su post-proceso.
  limpiarEscena(scene);

  scene.clearColor = new Color4(
    0.08,
    0.09,
    0.12,
    1
  );

  // Una cámara provisional ANTES de cargar el modelo.
  //
  // limpiarEscena deja scene.activeCamera en null, y el bucle de render de
  // main.ts sigue corriendo mientras se descarga el .glb. Sin cámara, cada uno
  // de esos cuadros lanzaba "No camera defined" y la escena se quedaba en
  // negro aunque el modelo terminara de llegar.
  //
  // Con ella el bucle siempre tiene a qué apuntar: durante la carga dibuja una
  // escena vacía, que es justo lo que la pantalla de carga está tapando. Más
  // abajo se la recoloca con las medidas reales del banco.
  const camara = new FreeCamera(
    "camaraRecorridoBanco",
    new Vector3(0, ALTURA_OJO, 0),
    scene
  );
  usarCamara(scene, camara);

  const banco = await cargarBanco(scene, {
    diagnostico: true,
  });

  camara.minZ = 0.1;
  camara.speed = 0.12;
  camara.angularSensibility = 3200;
  camara.inertia = 0.82;

  camara.keysUp.push(87); // W
  camara.keysDown.push(83); // S
  camara.keysLeft.push(65); // A
  camara.keysRight.push(68); // D

  scene.collisionsEnabled = true;
  camara.checkCollisions = true;

  // La elipse va de los pies a los ojos. Babylon la centra en
  // posición − ellipsoid.y + ellipsoidOffset, así que con el offset en cero su
  // borde de abajo queda en los pies. Antes el offset valía lo mismo que el
  // radio: la elipse quedaba centrada en los ojos y chocaba con el cielo.
  camara.ellipsoid = new Vector3(0.3, ALTURA_OJO / 2, 0.3);
  camara.ellipsoidOffset = Vector3.Zero();

  // El jugador entra DENTRO de la sala, justo pasada la puerta y mirando al
  // mesón del fondo, por el pasillo que dejan libre las filas de sillas.
  //
  // Se usa el interior del edificio y no las medidas del conjunto: el modelo
  // trae una losa más grande que la sala, así que colocar desde el conjunto
  // dejaba al jugador sobre el piso pero fuera de los muros.
  const { interior } = banco;
  const centroX = (interior.minX + interior.maxX) / 2;
  const entradaZ = interior.minZ + 0.8;
  const pisoY = medirPiso(scene, banco.mallas, centroX, entradaZ);

  // Dos centímetros de holgura para no arrancar con la elipse metida en la losa.
  camara.position.set(centroX, pisoY + ALTURA_OJO + 0.02, entradaZ);
  camara.setTarget(new Vector3(centroX, pisoY + 1.5, interior.maxZ));

  // La gravedad se enciende recién ahora, con el piso ya debajo: durante la
  // descarga no había nada y la cámara habría caído sin fin.
  //
  // Es lo que impide volar: la cámara avanza hacia donde se mira, inclinación
  // incluida, y sin gravedad mirar arriba y pulsar W la despegaba del suelo.
  scene.gravity = new Vector3(0, -9.81 / 60, 0);
  camara.applyGravity = true;

  iluminarBanco(scene, interior, pisoY);

  camara.attachControl(true);

  const tuberia =
    new DefaultRenderingPipeline(
      "postProcesoBanco",
      true,
      scene,
      [camara]
    );

  tuberia.samples = 4;
  tuberia.bloomEnabled = false;
  tuberia.imageProcessingEnabled = true;

  tuberia.imageProcessing.contrast =
    1.04;

  tuberia.imageProcessing.exposure =
    1;

  tuberia.imageProcessing.toneMappingEnabled =
    true;

  const ayuda =
    document.createElement("div");

  ayuda.textContent =
    "WASD o flechas para caminar · " +
    "arrastrar para mirar · " +
    "ESC para volver";

  Object.assign(
    ayuda.style,
    {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform:
        "translateX(-50%)",
      padding: "10px 18px",
      borderRadius: "8px",
      background:
        "rgba(10, 12, 16, 0.78)",
      color: "#e8ecf4",
      font:
        "500 13px/1 system-ui, sans-serif",
      letterSpacing: "0.3px",
      pointerEvents: "none",
      zIndex: "40",
    }
  );

  document.body.appendChild(
    ayuda
  );

  let cerrado = false;

  /**
   * Desmonta el recorrido.
   *
   * Antes destruía la cámara a mano y no ponía ninguna en su lugar, así que la
   * escena se quedaba sin cámara activa y dejaba de dibujarse: al pulsar ESC
   * aparecía un color liso en vez del menú. Ahora lo hace limpiarEscena, que
   * además deja una cámara neutra y devuelve el fondo del portal.
   */
  const limpiarEscenario = (): void => {
    camara.detachControl();
    window.removeEventListener("keydown", alPulsar);
    ayuda.remove();
    tuberia.dispose();
    limpiarEscena(scene);
  };

  const salir = (): void => {
    if (cerrado) {
      return;
    }

    cerrado = true;

    limpiarEscenario();
    onSalir();
  };

  const alPulsar =
    (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        salir();
      }
    };

  window.addEventListener(
    "keydown",
    alPulsar
  );

  return {
    ...banco,

    dispose: () => {
      if (cerrado) {
        return;
      }

      cerrado = true;
      limpiarEscenario();
    },
  };
}