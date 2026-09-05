import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Mesh,
  Vector3,
  ActionManager,
  ExecuteCodeAction,
  Observable,
} from "@babylonjs/core";
import { texturaGrano } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";
import { AdvancedDynamicTexture, StackPanel } from "@babylonjs/gui";
import {
  PALETA,
  TEXTO,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearBotonPrincipal,
  crearBotonSecundario,
} from "../ui/EstiloUI";

// ---------------------------------------------------------------------------
// Hallazgos de auditoría
// ---------------------------------------------------------------------------
//
// Reemplazan a las esferas flotantes.
//
// Video 4.3 (2:25): "Genba, Genbutsu, Genjitsu: debemos estar en el tiempo
// real en el lugar de trabajo observando... con lo cual podremos detectar
// algún problema y solucionarlo a tiempo".
//
// Una esfera flotante sobre un pedestal no es observar el lugar real: es leer
// un rótulo que ya te dice dónde mirar. Acá el desvío está EN el objeto —una
// etiqueta despegada, una herramienta en la silueta equivocada, basura nueva—
// y hay que recorrer el área para verlo.
//
// ─── LO QUE NO SE HACE, Y POR QUÉ ─────────────────────────────────────────
//
// Nada indica de antemano cuáles objetos tienen problema. Todos los que se
// pueden auditar responden igual al pasar el cursor; la diferencia está en lo
// que se ve, no en un resaltado distinto. Si el juego marcara los defectuosos,
// auditar se reduciría a hacer clic donde brilla.
//
// Por el mismo motivo, marcar un objeto CONFORME como si tuviera un desvío
// resta: un auditor que reporta faltas inexistentes hace tanto daño como el
// que no ve las reales.

export interface Hallazgo {
  id: string;
  /** Nombre corto de lo que se inspecciona. Sale en la etiqueta del cursor. */
  zona: string;
  /** Punto de la planilla al que pertenece. */
  puntoPlanilla: string;
  /** ¿Es realmente un desvío? Los conformes están para poder equivocarse. */
  esDesvio: boolean;
  titulo: string;
  /** Lo que se ve al inspeccionar. NO dice si esta bien o mal. */
  observacion: string;
  detalle: string;
  mesh: Mesh;
  auditado: boolean;
  /** Lo que dictaminó el jugador. Null mientras no lo haya inspeccionado. */
  reportado?: boolean;
}

export interface RegistroHallazgos {
  hallazgos: Hallazgo[];
  /** Se dispara al hacer clic sobre cualquier objeto auditable. */
  onAuditar: Observable<Hallazgo>;
}

/**
 * Vuelve auditable una malla que ya existe en la escena.
 *
 * Se monta encima un volumen de clic transparente en vez de hacer pinchable la
 * pieza original: muchas son utilería fusionada o compuesta, y así se controla
 * el tamaño del blanco sin tocar el modelo.
 *
 * OJO con visibility: la malla va con visibility = 0 y NO con isVisible =
 * false. Babylon descarta lo invisible antes de comprobar si es pinchable, así
 * que con isVisible = false el clic no llegaría nunca.
 */
export function hacerAuditable(
  scene: Scene,
  registro: RegistroHallazgos,
  datos: Omit<Hallazgo, "mesh" | "auditado">,
  centro: Vector3,
  tamano: { ancho: number; alto: number; fondo: number }
): Hallazgo {
  const zona = MeshBuilder.CreateBox(
    `auditable_${datos.id}`,
    { width: tamano.ancho, height: tamano.alto, depth: tamano.fondo },
    scene
  );
  zona.position.copyFrom(centro);
  zona.visibility = 0;
  zona.isPickable = true;

  const hallazgo: Hallazgo = { ...datos, mesh: zona, auditado: false };
  registro.hallazgos.push(hallazgo);

  zona.actionManager = new ActionManager(scene);
  zona.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      // Solo avisa que se abrió la inspección. Quien dictamina es el jugador
      // en el panel, no este clic.
      if (hallazgo.auditado) return;
      registro.onAuditar.notifyObservers(hallazgo);
    })
  );

  return hallazgo;
}

export function crearRegistroHallazgos(): RegistroHallazgos {
  return { hallazgos: [], onAuditar: new Observable<Hallazgo>() };
}

// ---------------------------------------------------------------------------
// Piezas físicas de los desvíos
// ---------------------------------------------------------------------------

/**
 * Etiqueta de estantería despegada, colgando de una esquina.
 *
 * Es el desvío más sutil de los tres y a propósito: en Seiketsu la etiqueta se
 * puso derecha, y que ahora cuelgue es exactamente la clase de deterioro que
 * la disciplina tiene que detectar antes de que el estándar se pierda.
 */
export function crearEtiquetaDespegada(scene: Scene, x: number, y: number, z: number, giroY: number): Mesh {
  const mat = materialPintado(scene, "matEtiquetaDespegada", 512, 160, (ctx, w, h) => {
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(0, 0, w, h);

    // Borde amarillento y esquina sucia: lleva tiempo despegada.
    ctx.fillStyle = "rgba(150,130,90,0.25)";
    ctx.fillRect(0, 0, w, 12);
    ctx.fillRect(0, h - 12, w, 12);

    ctx.fillStyle = "#2b3339";
    ctx.font = "bold 62px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("REPUESTOS", w / 2, h / 2);
  });

  const etiqueta = MeshBuilder.CreateBox("etiquetaDespegada", { width: 0.6, height: 0.19, depth: 0.008 }, scene);
  etiqueta.position.set(x, y, z);
  // Colgando de una esquina: girada sobre su eje frontal, no plana.
  // Más caída que antes (-0,62 → -0,85): a poca inclinación se confundía con
  // una etiqueta recta vista en perspectiva, y el desvío tiene que notarse al
  // recorrer, no solo al pararse enfrente.
  etiqueta.rotation.set(0, giroY, -0.85);
  etiqueta.material = mat;

  return etiqueta;
}

/** Bolsa de residuos aparecida después de la limpieza. */
export function crearBasuraNueva(scene: Scene, x: number, z: number): Mesh {
  // BOLSA, NO ESFERA.
  //
  // La versión anterior era una esfera negra achatada y a distancia se leía
  // como una bola de demolición o un objeto de relleno olvidado — cualquier
  // cosa menos basura. Una esfera es justo la forma que menos se parece a una
  // bolsa: lo que identifica a una bolsa llena es que se estrecha arriba, que
  // el nudo va torcido y que lo de dentro la deforma. No que sea redonda.
  const mat = new PBRMaterial("matBasuraNueva", scene);
  mat.albedoColor = new Color3(0.09, 0.1, 0.11);
  mat.roughness = 0.44;
  mat.metallic = 0.02;
  mat.microSurfaceTexture = texturaGrano(scene, 0.14);

  const cuerpo = MeshBuilder.CreateCylinder(
    "basuraNueva",
    { diameterTop: 0.26, diameterBottom: 0.56, height: 0.5, tessellation: 12 },
    scene
  );
  cuerpo.position.set(x, 0.25, z);
  cuerpo.material = mat;

  // Bultos irregulares: lo que hay dentro deforma el plástico. Sin ellos el
  // cilindro se lee como un cubo, no como una bolsa.
  const bultos: Array<[number, number, number, number]> = [
    [0.17, 0.22, 0.05, 0.22],
    [-0.14, 0.32, -0.1, 0.18],
    [0.04, 0.15, -0.18, 0.2],
  ];
  bultos.forEach(([dx, dy, dz, tam], i) => {
    const bulto = MeshBuilder.CreateSphere(`basuraBulto_${i}`, { diameter: tam, segments: 8 }, scene);
    bulto.position.set(x + dx, dy, z + dz);
    bulto.scaling.set(1, 0.8, 1.1);
    bulto.material = mat;
    bulto.isPickable = false;
  });

  // Cuello y orejas del nudo, torcidos.
  const cuello = MeshBuilder.CreateCylinder(
    "basuraCuello",
    { diameterTop: 0.1, diameterBottom: 0.2, height: 0.16, tessellation: 10 },
    scene
  );
  cuello.position.set(x + 0.02, 0.56, z);
  cuello.rotation.z = 0.22;
  cuello.material = mat;
  cuello.isPickable = false;

  [-1, 1].forEach((lado) => {
    const oreja = MeshBuilder.CreateBox(
      `basuraOreja_${lado}`,
      { width: 0.13, height: 0.03, depth: 0.08 },
      scene
    );
    oreja.position.set(x + 0.02 + lado * 0.07, 0.63, z);
    oreja.rotation.z = 0.22 + lado * 0.5;
    oreja.material = mat;
    oreja.isPickable = false;
  });

  // Restos alrededor: una bolsa sola se lee como algo dejado ahí; con
  // desperdicio desparramado se lee como suciedad acumulada.
  const matResto = new PBRMaterial("matRestoBasura", scene);
  matResto.albedoColor = new Color3(0.62, 0.58, 0.5);
  matResto.roughness = 0.9;

  const restos: Array<[number, number, number]> = [
    [0.45, 0.2, 0.7],
    [-0.38, 0.32, 1.9],
    [0.18, -0.44, 0.4],
  ];
  restos.forEach(([dx, dz, giro], i) => {
    const resto = MeshBuilder.CreateBox(`restoBasura_${i}`, { width: 0.14, height: 0.02, depth: 0.1 }, scene);
    resto.position.set(x + dx, 0.012, z + dz);
    resto.rotation.y = giro;
    resto.material = matResto;
    resto.isPickable = false;
  });

  return cuerpo;
}


// ---------------------------------------------------------------------------
// Dictamen del auditor
// ---------------------------------------------------------------------------
//
// El juego NO decide por el jugador.
//
// La version anterior evaluaba sola al hacer clic: tocabas algo conforme y
// sonaba error, tocabas un desvio y sonaba acierto. Eso no es auditar, es
// buscar el objeto correcto. Y desde fuera se lee como una trampa — nadie
// entiende por que le marcan mal algo que solo quiso mirar.
//
// Auditar es EMITIR UN JUICIO. Se inspecciona, se ve lo que hay, y se declara
// conforme o se registra una no conformidad. El acierto se mide sobre esa
// decision, no sobre donde se hizo clic.
export function pedirDictamen(
  gui: AdvancedDynamicTexture,
  hallazgo: Hallazgo,
  onDecidir: (registraNoConformidad: boolean | null) => void
): void {
  const ANCHO = 460;

  const velo = crearVelo(gui, `veloDictamen_${hallazgo.id}`);
  const tarjeta = crearTarjeta(velo, `panelDictamen_${hallazgo.id}`, ANCHO + 72, 500);

  const columna = new StackPanel(`columnaDictamen_${hallazgo.id}`);
  columna.isVertical = true;
  columna.width = ANCHO + "px";
  tarjeta.addControl(columna);

  crearFilete(tarjeta, `fileteDictamen_${hallazgo.id}`, ANCHO + 72, PALETA.dato);

  columna.addControl(crearEspacio(`aireD1_${hallazgo.id}`, 18));
  columna.addControl(crearRotulo(`rotDictamen_${hallazgo.id}`, "PUNTO INSPECCIONADO", PALETA.rotulo));
  columna.addControl(crearEspacio(`aireD2_${hallazgo.id}`, 8));
  columna.addControl(
    crearParrafo(`zonaDictamen_${hallazgo.id}`, hallazgo.zona, ANCHO, TEXTO.titulo, PALETA.titulo, "700")
  );
  columna.addControl(crearEspacio(`aireD3_${hallazgo.id}`, 14));

  // LO QUE SE VE, sin decir si esta bien o mal. El juicio es del jugador: si
  // el texto ya dijera "esto es un desvio", no habria nada que auditar.
  columna.addControl(
    crearParrafo(`obsDictamen_${hallazgo.id}`, hallazgo.observacion, ANCHO, TEXTO.menor, PALETA.cuerpo)
  );
  columna.addControl(crearEspacio(`aireD4_${hallazgo.id}`, 14));

  // Aviso de que no hay vuelta atrás.
  //
  // La decisión queda registrada y no se puede cambiar — igual que una firma
  // en una planilla real. Sin decirlo, el jugador prueba una opción para "ver
  // qué pasa" y se encuentra con que ya no puede corregir. Para eso está el
  // botón de seguir mirando: se puede salir sin dictaminar y volver después.
  columna.addControl(
    crearParrafo(
      `avisoDictamen_${hallazgo.id}`,
      "Lo que decidas queda asentado en la planilla y no se puede modificar. Si no lo tienes claro, sigue mirando y vuelve.",
      ANCHO,
      TEXTO.rotulo,
      PALETA.rotulo
    )
  );
  columna.addControl(crearEspacio(`aireD4b_${hallazgo.id}`, 18));

  const cerrar = (decision: boolean | null): void => {
    velo.isVisible = false;
    setTimeout(() => {
      velo.dispose();
      onDecidir(decision);
    }, 0);
  };

  const noConforme = crearBotonPrincipal(`btnNoConforme_${hallazgo.id}`, "Registrar no conformidad", ANCHO);
  noConforme.onPointerUpObservable.add(() => cerrar(true));
  columna.addControl(noConforme);

  columna.addControl(crearEspacio(`aireD5_${hallazgo.id}`, 10));

  const conforme = crearBotonSecundario(`btnConforme_${hallazgo.id}`, "Cumple el estandar", ANCHO);
  conforme.onPointerUpObservable.add(() => cerrar(false));
  columna.addControl(conforme);

  columna.addControl(crearEspacio(`aireD6_${hallazgo.id}`, 10));

  const salir = crearBotonSecundario(`btnSeguirMirando_${hallazgo.id}`, "Seguir mirando", ANCHO);
  salir.onPointerUpObservable.add(() => cerrar(null));
  columna.addControl(salir);
}