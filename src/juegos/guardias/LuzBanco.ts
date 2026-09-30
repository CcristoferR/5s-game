import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  Matrix,
  SpotLight,
  HemisphericLight,
  ReflectionProbe,
  DynamicTexture,
  Texture,
  type AbstractMesh,
} from "@babylonjs/core";

// ===========================================================================
// La luz del hall del banco
// ===========================================================================
//
// El recorrido alumbraba con un relleno a tope y cuatro bombillas puntuales:
// todo igual de claro, sin que se supiera de dónde venía la luz, y un techo a
// cinco metros sin una sola luminaria a la vista.
//
// Aquí la luz tiene origen, como en el supermercado:
//
//   · Paneles LED cuadrados empotrados en el cielo raso, en retícula sobre el
//     hall y en una fila sobre el mesón. Es lo que lleva una sucursal: luz
//     pareja y blanca, sin nada colgando que cruce la vista.
//   · Seis focos bajo los paneles, hacia abajo, que dan el degradado: más luz
//     en el pasillo y en el mesón, menos contra los muros y en los rincones.
//   · Un relleno bajo, que es la luz que rebota del piso claro y los muros.
//
// El piso y el reflejo se montan aparte (ver PuestoBanco), con las mismas
// piezas del supermercado.

/** Lado de cada panel y lo que mide su marco. */
const PANEL = 1.2;
const MARCO = 0.05;

/**
 * Dónde van los paneles: una retícula de tres por tres sobre el hall y una
 * fila sobre el mesón, uno encima de cada caja (ver CAJAS en GenteBanco).
 */
const PANELES: readonly [number, number][] = [
  ...[-2.6, 0.7, 4.0].flatMap((x) => [-2.3, 0.4, 3.1].map((z) => [x, z] as [number, number])),
  ...[-3.15, -1.15, 1.09, 3.07].map((x) => [x, 5.1] as [number, number]),
];

/**
 * Los focos: bajo los paneles de los lados y del centro, en dos filas. Los del
 * fondo caen justo delante del mesón, que es donde se atiende y donde más
 * tiene que verse.
 */
const FOCOS: readonly [number, number][] = [
  [-2.6, -1.4],
  [0.7, -1.4],
  [4.0, -1.4],
  [-2.6, 3.1],
  [0.7, 3.1],
  [4.0, 3.1],
];

export interface LuzBanco {
  relleno: HemisphericLight;
  focos: SpotLight[];
  /** Los paneles: marcos y difusores, dos mallas. */
  paneles: Mesh[];
}

/**
 * @param cielo  Altura del cielo raso, medida.
 */
export function iluminarBanco(scene: Scene, cielo: number): LuzBanco {
  const relleno = new HemisphericLight("luzRellenoBanco", new Vector3(0, 1, 0), scene);
  // Bajo a propósito: con el relleno de antes, a uno, el hall entero quedaba
  // en el mismo gris claro y los focos no tenían dónde notarse.
  relleno.intensity = 0.5;
  relleno.diffuse = new Color3(1, 0.985, 0.96);
  // Lo que sube del piso de mármol claro: es lo que le llega al cielo raso.
  relleno.groundColor = new Color3(0.6, 0.59, 0.57);

  // --- Los paneles -----------------------------------------------------------
  //
  // Marco blanco al ras del cielo y el difusor opal un centímetro hundido: el
  // borde claro alrededor de la luz es lo que los hace leer como paneles y no
  // como cuadrados pegados.
  const pintura = new PBRMaterial("matMarcoPanelBanco", scene);
  pintura.albedoColor = new Color3(0.9, 0.9, 0.89);
  pintura.metallic = 0;
  pintura.roughness = 0.45;
  const opal = new StandardMaterial("matDifusorPanelBanco", scene);
  opal.disableLighting = true;
  // Por encima del blanco, para que el resplandor del post-proceso tome el
  // difusor y nada más.
  opal.emissiveColor = new Color3(1, 0.985, 0.95).scale(2.4);
  opal.diffuseColor = new Color3(0, 0, 0);
  opal.specularColor = new Color3(0, 0, 0);

  const marcos: Mesh[] = [];
  const difusores: Mesh[] = [];
  PANELES.forEach(([x, z], i) => {
    const marco = MeshBuilder.CreateBox(`marcoPanelBanco_${i}`, { width: PANEL, height: 0.04, depth: PANEL }, scene);
    marco.position.set(x, cielo - 0.02, z);
    marcos.push(marco);
    const difusor = MeshBuilder.CreateBox(
      `difusorPanelBanco_${i}`,
      { width: PANEL - MARCO * 2, height: 0.01, depth: PANEL - MARCO * 2 },
      scene
    );
    difusor.position.set(x, cielo - 0.042, z);
    difusores.push(difusor);
  });
  const fundir = (nombre: string, piezas: Mesh[], material: PBRMaterial | StandardMaterial): Mesh => {
    const m = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
    m.name = nombre;
    m.material = material;
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  };
  const paneles = [fundir("marcosPanelesBanco", marcos, pintura), fundir("difusoresPanelesBanco", difusores, opal)];

  // --- Los focos -------------------------------------------------------------
  //
  // Conos anchos y con el interior amplio, como los de la sala del súper: un
  // foco PBR se apaga en degradado desde su eje, y sin cono interior a media
  // distancia ya no da casi nada. Solapados, el piso queda parejo bajo la
  // retícula y cae hacia los muros.
  const focos = FOCOS.map(([x, z], i) => {
    const foco = new SpotLight(`focoBanco_${i}`, new Vector3(x, cielo - 0.12, z), new Vector3(0, -1, 0), 2.5, 1, scene);
    foco.innerAngle = 1.9;
    // Blanco neutro, el de un LED de 4000 K.
    foco.diffuse = new Color3(1, 0.97, 0.93);
    foco.specular = new Color3(0.9, 0.88, 0.85);
    foco.intensity = 18;
    foco.range = 16;
    return foco;
  });

  return { relleno, focos, paneles };
}

/**
 * Sube el tope de luces por material.
 *
 * Babylon compila cada material para cuatro luces por defecto y las que
 * sobran no se calculan, en silencio. Dentro son ocho —el relleno, los seis
 * focos y la luz de la puerta— y nueve con la luz de las ventanas: con
 * cuatro, cada cosa del hall se alumbraría con los primeros que le tocaran y
 * la luz saldría a parches.
 *
 * @param luces  Cuántas: ocho, o nueve si cabe la de las ventanas (ver
 *               cabeLuzDeDia).
 */
export function ampliarLucesBanco(scene: Scene, luces = 8): void {
  scene.materials.forEach((mat) => {
    if (mat instanceof PBRMaterial) mat.maxSimultaneousLights = luces;
  });
}

// ===========================================================================
// La luz del día por las ventanas
// ===========================================================================
//
// El hall se alumbraba solo con sus luminarias, y así parecía un estudio
// cerrado aunque por las ventanas se viera la calle a pleno sol. Por las de
// la pared izquierda entra la mañana: al otro lado de la calle del costado
// está el vecino con la fachada al sol, y encima el cielo. Esa luz deja en el
// piso, junto al muro, la forma de cada ventanal —blanda, porque viene de
// todo el cielo y de toda la fachada y no de un punto— y alumbra de costado
// las sillas y a quien pasa por el pasillo de ese lado. Más fría que la de
// los paneles, que es la de un LED de 4000 K: es lo que dice que eso es el
// día.
//
// El sol no entra: está detrás del banco y a la derecha (ver ExteriorBanco),
// y en las ventanas de la derecha, que son las que miran hacia él, el grueso
// del muro corta sus rayos, que llegan casi rasantes.
//
// ─── UNA SOLA LUZ ────────────────────────────────────────────────────────
//
// Es un foco fuera del muro, alto y lejos, con la silueta de los ventanales
// proyectada como una diapositiva: lo que pasa por los huecos alumbra, lo
// demás no. Uno solo para todas las ventanas, porque cada luz más cuesta en
// cada material del hall, y el hall ya usa ocho. Sin brillo propio: la luz
// del día sobre el piso pulido la pone su reflejo (ver pulirSuelo), y un
// brillo del foco saldría como una mancha redonda sin forma de ventana.
//
// ─── LOS HUECOS ──────────────────────────────────────────────────────────
//
// Medidos con rayos sobre el modelo a escala 3, desde el piso: dos
// ventanales bajos, de 0,3 a 2,5 m, cada uno partido por un parante, y
// encima de cada uno una ventana alta, de 3,5 a 4,7. La cara de dentro del
// muro está en X −4,217. Las ventanas altas dejan pasar menos: por ellas
// solo se ve cielo.

/** Un hueco de la pared izquierda: a lo largo del muro (Z) y de alto sobre el piso. */
interface Hueco {
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  /** Cuánto deja pasar, de 0 a 1. */
  paso: number;
}

const MURO_IZQUIERDO_X = -4.217;
const HUECOS_IZQUIERDA: readonly Hueco[] = [
  { z0: -2.95, z1: -2.45, y0: 0.3, y1: 2.5, paso: 1 },
  { z0: -2.25, z1: -1.75, y0: 0.3, y1: 2.5, paso: 1 },
  { z0: 0.25, z1: 0.85, y0: 0.3, y1: 2.5, paso: 1 },
  { z0: 1.05, z1: 1.65, y0: 0.3, y1: 2.5, paso: 1 },
  { z0: -3.15, z1: -1.55, y0: 3.5, y1: 4.7, paso: 0.45 },
  { z0: 0.05, z1: 1.85, y0: 3.5, y1: 4.7, paso: 0.45 },
];

/**
 * De dónde viene la luz, vista desde los ventanales: cuarenta y ocho grados
 * sobre el horizonte, de frente al muro. Es la mezcla de la fachada del
 * vecino, casi horizontal, y el cielo, alto. Más bajo, cada paño dejaba una
 * franja de casi cuatro metros hasta el medio del hall, como un rayo de sol;
 * así queda un rectángulo junto al muro que llega a las primeras sillas.
 */
const ELEVACION_DIA = 0.84;
/** A qué distancia del muro se pone el foco. Lejos, para que la luz llegue casi paralela. */
const DISTANCIA_DIA = 9;
/** El color del día que entra: blanco algo azulado, más frío que el de los paneles. */
const COLOR_DIA = new Color3(0.84, 0.91, 1);
/**
 * Lo que alumbra, en candelas, como los focos (ver iluminarBanco).
 *
 * Mucho más que ellos porque está cuatro veces más lejos —la luz cae con el
 * cuadrado de la distancia—, y porque un foco PBR se apaga en campana desde
 * su eje: en los huecos de los lados llega poco más de la mitad.
 */
const INTENSIDAD_DIA = 2400;
/**
 * Lo que se abre el foco más allá de los huecos, en radianes. Con el cono
 * justo, la campana del foco dejaba los ventanales de los lados a oscuras;
 * más abierto, la luz llega pareja a todos. La diapositiva sigue diciendo
 * por dónde entra.
 */
const HOLGURA_DIA = 0.5;
/** El lado de la diapositiva y lo que se difuminan los bordes, en píxeles de ella. */
const LADO_DIAPOSITIVA = 1024;
const DIFUMINADO_DIA = 9;

/**
 * Si el equipo puede con una novena luz por material.
 *
 * Cada luz ocupa un bloque de uniformes en el sombreador, además de los dos
 * fijos del material y de la escena. Medido en los sombreadores del hall: con
 * nueve luces, el más cargado usa once bloques en la etapa de fragmentos y
 * tres en la de vértices. WebGL 2 garantiza doce por etapa, así que cabe en
 * cualquier equipo; pero si uno informara menos, el material no compilaría y
 * se vería negro, y por eso antes de montarla se pregunta.
 */
export function cabeLuzDeDia(scene: Scene): boolean {
  const motor = scene.getEngine() as unknown as { webGLVersion?: number; _gl?: WebGL2RenderingContext };
  const gl = motor._gl;
  if (!gl) return false;
  if ((motor.webGLVersion ?? 1) < 2) return true;
  return gl.getParameter(gl.MAX_VERTEX_UNIFORM_BLOCKS) >= 12 && gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_BLOCKS) >= 12;
}

/**
 * Monta la luz del día de la pared izquierda. Ver LA LUZ DEL DÍA POR LAS
 * VENTANAS.
 *
 * @param piso  Alto del piso del hall, medido.
 */
export function luzDeDiaPorLasVentanas(scene: Scene, piso: number): SpotLight {
  const huecos = HUECOS_IZQUIERDA;
  const zMin = Math.min(...huecos.map((h) => h.z0));
  const zMax = Math.max(...huecos.map((h) => h.z1));
  const zCentro = (zMin + zMax) / 2;
  const origen = new Vector3(
    MURO_IZQUIERDO_X - DISTANCIA_DIA * Math.cos(ELEVACION_DIA),
    piso + 1.4 + DISTANCIA_DIA * Math.sin(ELEVACION_DIA),
    zCentro
  );
  // Apunta al centro de la mancha de los ventanales bajos en el piso.
  const destino = new Vector3(MURO_IZQUIERDO_X + 1.6, piso, zCentro);
  const direccion = destino.subtract(origen).normalize();

  // El ángulo, el justo para que entren todos los huecos, y un poco más.
  const esquinas = (h: Hueco): Vector3[] => [
    new Vector3(MURO_IZQUIERDO_X, piso + h.y0, h.z0),
    new Vector3(MURO_IZQUIERDO_X, piso + h.y0, h.z1),
    new Vector3(MURO_IZQUIERDO_X, piso + h.y1, h.z1),
    new Vector3(MURO_IZQUIERDO_X, piso + h.y1, h.z0),
  ];
  let abre = 0;
  huecos.forEach((h) =>
    esquinas(h).forEach((p) => {
      const a = Math.acos(Math.min(1, Vector3.Dot(p.subtract(origen).normalize(), direccion)));
      abre = Math.max(abre, a);
    })
  );
  const angulo = 2 * abre + HOLGURA_DIA;

  const luz = new SpotLight("luzDiaVentanasBanco", origen, direccion, angulo, 1, scene);
  luz.innerAngle = angulo;
  luz.diffuse = COLOR_DIA;
  luz.specular = new Color3(0, 0, 0);
  luz.intensity = INTENSIDAD_DIA;
  luz.range = 40;

  // ─── LA DIAPOSITIVA ────────────────────────────────────────────────────
  //
  // Cada hueco, visto desde el foco, con la misma proyección que usa Babylon
  // para ponerla sobre la escena (ver SpotLight._computeProjectionTexture…):
  // mirando por la dirección del foco, con la vertical arriba y el ángulo del
  // foco de campo. Blanco lo que pasa, negro lo demás, y los bordes
  // difuminados.
  const vista = Matrix.LookAtLH(origen, origen.add(direccion), Vector3.Up());
  const s = 1 / Math.tan(angulo / 2);
  const N = LADO_DIAPOSITIVA;
  const enDiapositiva = (p: Vector3): [number, number] => {
    const v = Vector3.TransformCoordinates(p, vista);
    const u = 0.5 + (0.5 * s * v.x) / v.z;
    const w = 0.5 + (0.5 * s * v.y) / v.z;
    // La textura va de abajo arriba y el lienzo de arriba abajo.
    return [u * N, (1 - w) * N];
  };
  const siluetas = document.createElement("canvas");
  siluetas.width = N;
  siluetas.height = N;
  const cs = siluetas.getContext("2d");
  const tex = new DynamicTexture("texDiaVentanasBanco", { width: N, height: N }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, N, N);
  if (cs) {
    cs.fillStyle = "#000";
    cs.fillRect(0, 0, N, N);
    huecos.forEach((h) => {
      const g = Math.round(255 * h.paso);
      cs.fillStyle = `rgb(${g},${g},${g})`;
      cs.beginPath();
      esquinas(h).forEach((p, k) => {
        const [x, y] = enDiapositiva(p);
        if (k === 0) cs.moveTo(x, y);
        else cs.lineTo(x, y);
      });
      cs.closePath();
      cs.fill();
    });
    ctx.filter = `blur(${DIFUMINADO_DIA}px)`;
    ctx.drawImage(siluetas, 0, 0);
    ctx.filter = "none";
  }
  tex.update(true);
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  luz.projectionTexture = tex;
  return luz;
}

/**
 * El entorno de los reflejos: el hall fotografiado una vez desde el centro.
 *
 * Sin él, lo que brilla —el mesón negro, los monitores, los postes de la fila—
 * refleja la nada y sale negro, con ese aspecto de plástico barato que tienen
 * los materiales brillantes cuando nadie les dice qué hay alrededor.
 *
 * Una sola vez: la sala está quieta, y refrescarla cada cuadro serían seis
 * dibujados más por fotograma para obtener la misma imagen.
 */
export function fotografiarHall(scene: Scene, centro: Vector3, entran: AbstractMesh[]): void {
  const sonda = new ReflectionProbe("sondaBanco", 256, scene);
  sonda.position = centro;
  entran.forEach((m) => sonda.renderList!.push(m));
  sonda.refreshRate = 0;
  // Un cuadro después, por lo mismo que la sonda del condominio: enchufada
  // antes, cada material que la sonda dibuja intentaría leerla mientras se
  // escribe, y WebGL aborta ese dibujo.
  scene.onAfterRenderObservable.addOnce(() => {
    scene.environmentTexture = sonda.cubeTexture;
    scene.environmentIntensity = 0.7;
  });
}
