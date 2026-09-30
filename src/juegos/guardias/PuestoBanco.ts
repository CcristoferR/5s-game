import {
  Scene,
  FreeCamera,
  Vector3,
  Color3,
  Color4,
  Mesh,
  Ray,
  PBRMaterial,
  VertexBuffer,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  PointLight,
  type AbstractMesh,
  type Observer,
} from "@babylonjs/core";
import { cargarBanco, medirPiso, ALTURA_OJO, type BancoCargado } from "./EscenaBanco";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { iluminarBanco, ampliarLucesBanco, fotografiarHall, luzDeDiaPorLasVentanas, cabeLuzDeDia } from "./LuzBanco";
import { montarCamarasBanco } from "./CamarasBanco";
import { construirExteriorBanco } from "./ExteriorBanco";
import { separarSueloSala, pulirSuelo, sombrasAlPie } from "./LuzSalaSupermercado";
import { crearHudRecorrido } from "./HudRecorrido";
import { crearRelojTurno } from "./RelojTurno";
import { crearPanelesTurno } from "./PanelesSupermercado";
import { crearGenteBanco, PUERTA_X } from "./GenteBanco";
import { CENTRO_PUERTA } from "./PuertaBanco";
import { crearAsaltoBanco, type AsaltoBanco, type DesenlaceTestigo, type MomentoAsalto } from "./AsaltoBanco";
import {
  MOMENTOS,
  SEGUNDOS_EN_EL_SUELO,
  type DecisionBanco,
  type EfectoTrampa,
  type OpcionMomento,
} from "./MomentosBanco";
import { crearObservacionBanco, type ObservacionBanco } from "./ObservacionBanco";
import { crearSubtitulos } from "./SubtitulosTurno";
import { crearCarabinerosBanco } from "./CarabinerosBanco";
import { crearManosGuardia, NOMBRE_CUERPO_GUARDIA } from "./ManosGuardia";
import { crearPanelDeclaracion } from "./PanelDeclaracion";
import { prepararPregunta, TOTAL_PREGUNTAS, type RespuestaDeclaracion } from "./DeclaracionBanco";
import {
  precargarAmbienteSala,
  iniciarAmbienteSala,
  agacharAmbienteSala,
  devolverAmbienteSala,
  detenerAmbienteSala,
  congelarSonidosSala,
  detenerSonidosSala,
  establecerSilencio,
  estaSilenciado,
  reproducir,
} from "../../core/Sonido";
import {
  BRIEFING_TURNO,
  ETIQUETA_TURNO,
  FIN_DE_LA_CALMA,
  MINUTO_FINAL,
  MINUTOS_HASTA_CARABINEROS,
  MINUTOS_POR_SEGUNDO,
  PRUEBA_RAPIDA,
  PRUEBA_RAPIDA_DESDE,
  RITMO_ASALTO,
  horaDelTurno,
} from "./TurnoBanco";

// ===========================================================================
// El puesto del guardia en el banco
// ===========================================================================
//
// El escenario 3 era un recorrido libre: se entraba al banco y se caminaba por
// él para conocerlo. Ahora es un turno, y el guardia de una sucursal no
// recorre nada: está en el acceso, de pie, y desde ahí vigila la puerta y el
// hall entero.
//
// Así que aquí no se camina. La cámara está plantada en el puesto, a la altura
// de los ojos, y lo único que se hace es mirar: arrastrando se gira la cabeza
// —a la puerta, a la fila, a las cajas— como la giraría cualquiera sin
// moverse de su sitio. Es la diferencia con el supermercado, y es a propósito:
// en este nivel lo que se juega es QUÉ se mira.

export interface PuestoBanco {
  banco: BancoCargado;
  /**
   * Abre el turno: la tarjeta de la jefatura y, al cerrarla, el reloj.
   *
   * Aparte de la creación, como en el supermercado: se llama cuando la
   * pantalla de carga ya se fue, o se entraría con el turno empezado.
   */
  comenzar: () => void;
  /** El asalto, para lo que viene después (los paneles, la declaración). */
  asalto: AsaltoBanco;
  /** Lo que el guardia alcanzó a ver del asalto. Para la declaración. */
  observacion: ObservacionBanco;
  /** Lo que eligió en cada momento del asalto, en orden. Para la nota. */
  decisiones: () => readonly DecisionBanco[];
  /** Lo que declaró ante Carabineros, pregunta a pregunta. Para el libro y la nota. */
  declaracion: () => readonly RespuestaDeclaracion[];
  dispose: () => void;
}

/** Por qué se deja el puesto. "repetir" pide montarlo otra vez sin pasar por el menú. */
export type MotivoSalida = "menu" | "repetir";

/** El color del escenario, el mismo de su pantalla de carga en JuegoGuardias. */
const ACENTO = "#8ba6c9";

/**
 * Dónde está el puesto, en planta.
 *
 * Por dentro, a la derecha de la puerta según se entra y a setenta
 * centímetros del muro: la puerta queda a un paso a la izquierda y delante se
 * abre el hall entero, con la fila en el centro, las sillas de espera a los
 * dos lados y las cuatro cajas al fondo. Es el sitio desde donde un guardia
 * de acceso ve a la vez quién entra y qué pasa dentro.
 *
 * Medido sobre la planta del modelo a escala 3: la puerta tiene su eje en
 * X 0,6 y el muro de la fachada su cara interior en Z −3,95; la primera fila
 * de sillas empieza en Z −1,9, así que aquí hay más de un metro de paso libre
 * por delante.
 */
const PUESTO = { x: 2.35, z: -3.25 };
/** Hacia dónde mira al empezar: el mesón, entre la segunda y la tercera caja. */
const MIRA_AL_EMPEZAR = { x: 0.2, alto: 1.25, z: 4.6 };

/**
 * Cuánto se puede subir y bajar la vista, en radianes.
 *
 * Arriba, lo que da el cuello: las luminarias del techo. Abajo, casi a plomo,
 * que es lo que hace falta para verse el propio cuerpo (ver ManosGuardia): la
 * vista de la pantalla es mucho más estrecha que la de los ojos, que al
 * mirarse los zapatos ven también el pecho y el cinturón sin bajar la cabeza
 * del todo. Pero nunca más allá de la vertical: sin tope, una FreeCamera deja
 * seguir girando hasta mirar al revés.
 */
const VISTA_ARRIBA = -0.75;
const VISTA_ABAJO = 1.55;

/**
 * ─── LA CABEZA SE INCLINA ───────────────────────────────────────────────
 *
 * Mirar hacia abajo no es girar los ojos en su sitio: se dobla el cuello, y
 * los ojos bajan y se adelantan. Sin eso, mirándose a sí mismo, el pecho
 * tapaba todo lo de más abajo —el cinturón, las piernas, los zapatos—, porque
 * los ojos quedaban justo encima de él, y el cuerpo se veía como desde una
 * cámara clavada sobre un maniquí.
 *
 * El cuello se dobla sobre la base de la nuca, veinte centímetros por debajo
 * de los ojos y diez por detrás, y hace algo más de un tercio del giro; el
 * resto lo hacen la cabeza y los ojos. Mirando del todo hacia abajo, los ojos
 * se adelantan nueve centímetros y bajan ocho: lo justo para que se vean a
 * la vez la placa del pecho y el cinturón. Más, y el pecho quedaba detrás de
 * los ojos, fuera de la vista; menos, y tapaba el cinturón. Mirando al frente
 * o hacia arriba, nada.
 *
 * @returns Cuánto se adelantan y cuánto bajan los ojos, en metros.
 */
function inclinarCabeza(cabeceo: number): { adelante: number; abajo: number } {
  const cuello = Math.max(0, cabeceo) * 0.36;
  const c = Math.cos(cuello);
  const s = Math.sin(cuello);
  return { adelante: 0.1 * c + 0.2 * s - 0.1, abajo: 0.2 - (0.2 * c - 0.1 * s) };
}

/** La exposición de la imagen, la de siempre: el golpe de luz de la puerta la sube un momento. */
const EXPOSICION = 1.1;
/** Lo que alumbra la luz de la puerta en el primer instante del golpe. */
const INTENSIDAD_DESTELLO = 10;
/** Lo que alumbra dentro cada golpe de baliza que entra por la ventana del costado. */
const BALIZA_DENTRO = 4.2;

/**
 * Lo que dice el sargento al llegar de la clienta que se quiso ir (ver el
 * quinto momento del asalto), según lo que hizo el guardia. Cada frase con su
 * tiempo de lectura, al paso de las demás: unas diecisiete letras por segundo.
 */
const SOBRE_EL_TESTIGO: Record<DesenlaceTestigo, { frase: string; dura: number }> = {
  espera: { frase: "Bien que la gente esperó. Mi cabo les va a tomar los datos a todos.", dura: 4.2 },
  seVa: {
    frase: "Me dicen que una clienta se fue antes de que llegáramos. Sin sus datos, la vamos a tener que ubicar por las cámaras.",
    dura: 6.4,
  },
  encerrada: {
    frase: "A nadie se le puede dejar encerrado: esa puerta queda abierta. Mi cabo le va a tomar los datos a la clienta.",
    dura: 6,
  },
};

/**
 * Lo que dice el sargento de las cámaras al cerrar, mirando la del acceso (ver
 * CamarasBanco): las grabaciones son prueba, y el guardia es quien avisa que
 * se guarden.
 */
const SOBRE_LAS_CAMARAS = "Vamos a necesitar las grabaciones de las cámaras. Avise a su jefatura que nadie las borre.";

/**
 * @param onSalir  Al dejar el puesto. "menu" vuelve al menú; "repetir" pide
 *                 montarlo otra vez.
 * @param usuario  Quien juega. Es con quien se guardará el turno.
 */
export async function crearPuestoBanco(
  scene: Scene,
  onSalir: (motivo?: MotivoSalida) => void,
  usuario = "invitado"
): Promise<PuestoBanco> {
  void usuario;
  // Lo primero: vaciar lo que dejó el escenario anterior. Ver LimpiezaEscena.
  limpiarEscena(scene);
  scene.clearColor = new Color4(0.7, 0.78, 0.88, 1);

  // La cámara, ANTES de cargar el modelo: el bucle de render sigue corriendo
  // mientras se descarga, y sin cámara cada cuadro lanzaría "No camera
  // defined" (ver el mismo comentario en el supermercado).
  const camara = new FreeCamera("camaraPuestoBanco", new Vector3(0, ALTURA_OJO, 0), scene);
  camara.minZ = 0.05;
  camara.maxZ = 2400;
  camara.angularSensibility = 3200;
  camara.inertia = 0.8;
  // Solo mirar. Sin el teclado enganchado, las flechas y WASD no mueven al
  // guardia de su puesto: el ratón es lo único que queda, y gira la cabeza.
  camara.inputs.removeByType("FreeCameraKeyboardMoveInput");
  usarCamara(scene, camara);

  const banco = await cargarBanco(scene);

  // --- El puesto ------------------------------------------------------------
  const piso = medirPiso(scene, banco.mallas, PUESTO.x, PUESTO.z);
  const cielo = medirCielo(scene, banco.mallas, PUESTO.x, PUESTO.z, piso);
  camara.position.set(PUESTO.x, piso + ALTURA_OJO, PUESTO.z);
  camara.setTarget(new Vector3(MIRA_AL_EMPEZAR.x, piso + MIRA_AL_EMPEZAR.alto, MIRA_AL_EMPEZAR.z));
  const enSuSitio = camara.position.clone();

  // ─── EN EL SUELO ───────────────────────────────────────────────────────
  //
  // Lo que le pasa al guardia que se hace el héroe (ver MomentosBanco): el
  // del arma se vuelve hacia él, le grita y lo manda al suelo. La vista baja
  // a ras del piso, la cabeza ladeada, y no se puede levantar: de la sala se
  // ven patas de sillas y zapatos, nunca una cara —y lo que no se vio no se
  // podrá declarar—. Se oye, eso sí.
  //
  // Más bajo que los asientos de las sillas de espera, que hay una junto al
  // puesto: a la altura de uno, la cámara quedaba encima y se veía el asiento
  // de cerca como una mancha oscura. Y sin clavar la vista en las baldosas:
  // un piso pulido mirado desde un palmo es un gris liso con los reflejos de
  // los paneles del techo; mirando a lo largo del piso se lee dónde se está.
  //
  // De 0 de pie a 1 en el suelo. Baja rápido, como quien se tira porque se
  // lo ordenan con un arma, y se levanta más despacio.
  let caida = 0;
  let sueloQuiere = 0;
  /** Segundos que le quedan en el suelo. Infinito: hasta que se vayan. */
  let sueloRestan = 0;
  /** Hacia dónde miraba al caer: al levantarse vuelve a mirar ahí. */
  let pitchDePie = 0;
  let yawSuelo = 0;
  let levantandose = false;
  const ALTO_EN_EL_SUELO = 0.36;
  const PITCH_EN_EL_SUELO = 0.5;
  /** Lo que se echa hacia delante al bajar: poco, que la silla está al lado. */
  const AVANCE_EN_EL_SUELO = 0.12;
  const LADEO_EN_EL_SUELO = 0.12;
  /**
   * Adónde se lleva la vista cuando la lleva el puesto y no el ratón: un punto
   * y en qué sitio de la pantalla tiene que quedar, en fracciones del ancho y
   * del alto. Se recalcula cada cuadro, así que sigue bien aunque la ventana
   * cambie de tamaño. De golpe: en el primer cuadro, con la pantalla en negro.
   */
  let encuadre: { punto: () => Vector3; x: () => number; y: number; deGolpe: boolean } | null = null;
  /** Esperas cortas del puesto, en tiempo del turno: se detienen con la pausa. */
  const esperas: { t: number; hacer: () => void }[] = [];
  let tiempoPuesto = 0;
  const luego = (segundos: number, hacer: () => void): void => {
    esperas.push({ t: tiempoPuesto + segundos, hacer });
  };

  // Plantado: la posición no se mueve, y la vista, dentro de lo que da el
  // cuello. Cada cuadro, porque la inercia del ratón sigue girando un poco
  // después de soltar y podría pasarse del tope.
  const plantado: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    if (enMarcha) {
      tiempoPuesto += dt;
      for (let k = 0; k < esperas.length; k++) {
        if (esperas[k].t > tiempoPuesto) continue;
        const [e] = esperas.splice(k, 1);
        k -= 1;
        e.hacer();
      }
      if (sueloQuiere === 1 && Number.isFinite(sueloRestan)) {
        sueloRestan -= dt;
        if (sueloRestan <= 0) levantarse();
      }
      const paso = dt / (sueloQuiere === 1 ? 0.5 : 0.9);
      caida = sueloQuiere === 1 ? Math.min(1, caida + paso) : Math.max(0, caida - paso);
      // Se fueron, la sala se recompuso y no queda nada que contestar: llega
      // Carabineros. Ver LA DECLARACIÓN.
      if (
        etapa === "turno" &&
        asalto.fase() === "fin" &&
        !enPanel &&
        !despuesPendiente &&
        sueloQuiere === 0 &&
        caida <= 0 &&
        !levantandose
      ) {
        llegaCarabineros();
      }
      // El golpe de luz de la puerta se apaga en algo más de un segundo —lo
      // fuerte, en el primer medio—, en tiempo del turno: si un panel lo pilla
      // a medias, sigue donde iba.
      if (destello > 0) {
        destello = Math.max(0, destello - dt / 1.2);
        const d = destello * destello;
        luzPuerta.intensity = INTENSIDAD_DESTELLO * d;
        tuberia.imageProcessing.exposure = EXPOSICION + 0.14 * d;
      }
    }
    // Lo que entra de las balizas por la ventana del fondo, al compás de la
    // barra de la patrulla del costado.
    if (balizasDentro) {
      const { rojo, azul } = exterior.patrulla.destelloApoyo();
      if (rojo || azul) {
        const tinte = rojo ? TIÑE_ROJO : TIÑE_AZUL;
        luzPuerta.diffuse.copyFrom(tinte);
        luzPuerta.specular.copyFrom(tinte);
        luzPuerta.intensity = rojo ? BALIZA_DENTRO : BALIZA_DENTRO * 1.25;
      } else {
        luzPuerta.intensity = 0;
      }
    }
    // Las manos del guardia (ver ManosGuardia): a la vista desde que entran y
    // se obedece, más arriba cuando el del arma lo pide a un metro, en el piso
    // si lo tiran al suelo, y abajo cuando se van. Fuera del turno —la
    // declaración—, abajo.
    const fase = asalto.fase();
    manos.poner(
      etapa !== "turno"
        ? "abajo"
        : sueloQuiere === 1 || caida > 0.35
          ? "suelo"
          : !manosALaVista || fase === "despues" || fase === "fin"
            ? "abajo"
            : tiempoPuesto < manosEnAltoHasta
              ? "alto"
              : "vista"
    );
    // Con Carabineros delante la vista no es del ratón: se lleva sola a quien
    // habla, sin saltos.
    if (encuadre && caida <= 0 && sueloQuiere === 0) {
      const d = encuadre.punto().subtract(enSuSitio);
      const tanV = Math.tan(camara.fov / 2);
      const tanH = tanV * scene.getEngine().getAspectRatio(camara);
      // Girar a la derecha corre lo mirado hacia la izquierda de la pantalla;
      // bajar la vista lo sube.
      const yaw = Math.atan2(d.x, d.z) + Math.atan((0.5 - encuadre.x()) * 2 * tanH);
      const pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)) + Math.atan((0.5 - encuadre.y) * 2 * tanV);
      const k = encuadre.deGolpe ? 1 : Math.min(1, dt * 3.2);
      encuadre.deGolpe = false;
      let giro = yaw - camara.rotation.y;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      camara.rotation.y += giro * k;
      camara.rotation.x += (pitch - camara.rotation.x) * k;
    }
    if (caida > 0 || sueloQuiere === 1 || levantandose) {
      const e = caida * caida * (3 - 2 * caida);
      // La respiración de quien está tirado en el suelo con un arma cerca:
      // apenas, pero la vista no se queda muerta. Corre con el turno, así que
      // en la pausa se para.
      const respiro = Math.sin(tiempoPuesto * 1.9) * e;
      // Desde donde estaban los ojos de pie, con la cabeza inclinada si se
      // miraba hacia abajo (ver LA CABEZA SE INCLINA): sin salto al empezar.
      const cabeza = inclinarCabeza(pitchDePie);
      const dePie = 1 - e;
      const avance = AVANCE_EN_EL_SUELO * e + cabeza.adelante * dePie;
      camara.position.set(
        enSuSitio.x + Math.sin(yawSuelo) * avance,
        enSuSitio.y - (ALTURA_OJO - ALTO_EN_EL_SUELO) * e - cabeza.abajo * dePie + respiro * 0.005,
        enSuSitio.z + Math.cos(yawSuelo) * avance
      );
      camara.rotation.y = yawSuelo;
      camara.rotation.x = pitchDePie + (PITCH_EN_EL_SUELO - pitchDePie) * e - respiro * 0.006;
      camara.rotation.z = LADEO_EN_EL_SUELO * e;
      tuberia.imageProcessing.vignetteWeight = 2.4 * e;
      // Con el turno corriendo: si se levantó justo antes de una pausa, lo que
      // espera a que esté de pie —"ya se fueron"— sale al volver de ella.
      if (levantandose && sueloQuiere === 0 && caida <= 0 && enMarcha) {
        levantandose = false;
        camara.rotation.z = 0;
        tuberia.imageProcessing.vignetteWeight = 0;
        alLevantarse();
      }
      return;
    }
    // De pie: en su sitio, con el cabeceo dentro de lo que da el cuello, y
    // derecho. Sin ladeo ni viñeta, pase lo que haya pasado antes: la cabeza
    // ladeada es solo del suelo, y un cuadro perdido al levantarse no puede
    // dejar la sala torcida el resto del turno. Mirando hacia abajo, con la
    // cabeza inclinada (ver LA CABEZA SE INCLINA).
    camara.rotation.x = Math.min(VISTA_ABAJO, Math.max(VISTA_ARRIBA, camara.rotation.x));
    const cabeza = inclinarCabeza(camara.rotation.x);
    camara.position.set(
      enSuSitio.x + Math.sin(camara.rotation.y) * cabeza.adelante,
      enSuSitio.y - cabeza.abajo,
      enSuSitio.z + Math.cos(camara.rotation.y) * cabeza.adelante
    );
    camara.rotation.z = 0;
    // ─── Y EL "ARRIBA", VERTICAL ──────────────────────────────────────────
    //
    // Con poner el ladeo en cero no basta. Babylon rehace el vector "arriba"
    // de la cámara solo cuando cambia el ladeo, y lo rehace con el cabeceo de
    // ese instante: al levantarse del suelo mirando algo hacia abajo, quedaba
    // inclinado hacia donde se miraba, y al girar la vista después la sala
    // entera se veía ladeada —medido, casi veinte grados a un cuarto de
    // vuelta—. De pie, el arriba es siempre el de la calle.
    camara.upVector.set(0, 1, 0);
    tuberia.imageProcessing.vignetteWeight = 0;
  });

  // --- Lo de fuera -----------------------------------------------------------
  //
  // La explanada del modelo pasa a ser de fuera —la alumbra el sol—, y el
  // edificio da su sombra sobre ella y sobre la vereda.
  const explanada = banco.mallas.filter((m) => m.material?.name === "initialShadingGroup");
  const edificio = banco.mallas.filter((m) => !explanada.includes(m));
  const exterior = construirExteriorBanco(scene, edificio, explanada);
  const deFuera = new Set<AbstractMesh>(exterior.mallas);

  // --- La luz del hall ---------------------------------------------------------
  iluminarBanco(scene, cielo);
  // ─── EL GOLPE DE LUZ DE LA PUERTA ──────────────────────────────────────
  //
  // Cuando la revientan, entra la mañana de golpe: una luz cálida que se
  // apaga en algo más de un segundo, y la imagen un punto más clara. Sutil a
  // propósito: se nota el brillo, no un foco.
  //
  // La luz está FUERA del vano, a media altura, que es de donde viene la
  // mañana: brillan los marcos, el piso de la entrada y la espalda del que
  // entra, y no la cara de dentro de la fachada, junto al puesto. Dentro
  // del vano, esa pared se lavaba entera de blanco.
  //
  // Montada ya y apagada, para que los materiales se compilen contándola
  // (ver ampliarLucesBanco): encenderla después costaría un tirón. Y antes de
  // la exclusión de abajo, que la deja sin alumbrar lo de fuera.
  const luzPuerta = new PointLight("luzPuertaBanco", new Vector3(PUERTA_X, piso + 1.4, CENTRO_PUERTA.z - 0.35), scene);
  luzPuerta.diffuse = new Color3(1, 0.93, 0.8);
  luzPuerta.specular = new Color3(0.6, 0.56, 0.48);
  luzPuerta.intensity = 0;
  let destello = 0;
  // ─── LAS BALIZAS SE CUELAN DENTRO ──────────────────────────────────────
  //
  // Con Carabineros ya fuera, la patrulla del costado destella justo detrás
  // de la ventana baja del fondo de la pared izquierda, la que en la
  // declaración queda detrás del sargento. Su luz entra por ella y tiñe, a
  // golpes de rojo y de azul, el piso pulido bajo la ventana —que además la
  // refleja—, las sillas de al lado y a quien está cerca.
  //
  // Es la misma luz del golpe de la puerta, que para entonces ya no hace
  // nada: se lleva adentro, un metro y medio desde la ventana y algo hacia
  // delante, que es donde cae la luz que entra en diagonal desde la calle.
  // Así el muro que rodea la ventana la recibe de refilón y no como una
  // lámpara pegada. Una luz propia para esto sería una más en cada material
  // del hall, que ya lleva nueve con la del día (ver LuzBanco), y cada una
  // encarece todo el hall para algo que solo se ve en la declaración.
  const VENTANA_DEL_FONDO = new Vector3(-2.7, piso + 1.2, 0.5);
  const TIÑE_ROJO = new Color3(1, 0.1, 0.06);
  const TIÑE_AZUL = new Color3(0.12, 0.3, 1);
  let balizasDentro = false;
  // La mañana que entra por las ventanas de la izquierda: la forma de los
  // ventanales en el piso y la luz de costado en las sillas de ese lado (ver
  // LuzBanco). Es la novena luz de cada material, así que solo si el equipo
  // puede con ella; si no, el hall se queda con las suyas, como estaba.
  const conLuzDeDia = cabeLuzDeDia(scene);
  if (conLuzDeDia) luzDeDiaPorLasVentanas(scene, piso);
  // Lo de dentro no alumbra lo de fuera: la calle tiene su sol.
  scene.lights
    .filter((l) => !exterior.luces.includes(l))
    .forEach((l) => l.excludedMeshes.push(...exterior.mallas));

  // Las ventanas: el vidrio del modelo llegaba casi opaco, gris, y por las
  // ventanas no se veía la calle que ahora hay detrás.
  afinarVidrio(banco.mallas);

  // El piso, aparte del resto del edificio y pulido: mármol claro con el
  // reflejo de lo que tiene encima, que es lo que hace que un hall de banco se
  // lea como tal. Las mismas piezas del supermercado.
  const estructura = banco.mallas.find((m) => m.material?.name === "set11");
  const suelo = estructura instanceof Mesh ? separarSueloSala(estructura, piso) : null;
  if (suelo) {
    suelo.name = "sueloBanco";
    // Sin el cuerpo del guardia: se dibuja sin cabeza —los ojos están dentro—
    // y su reflejo, justo bajo los pies, saldría descabezado.
    pulirSuelo(
      scene,
      suelo,
      piso,
      (m) => !deFuera.has(m) && !m.name.endsWith("_sombraAlPie") && !m.name.startsWith(NOMBRE_CUERPO_GUARDIA)
    );
  }
  // Y el cielo raso, en blanco: llegaba con el mismo mármol gris oscuro que el
  // resto de la estructura, y un techo oscuro a cinco metros, con los paneles
  // encendidos encima, hacía del hall una cueva.
  if (estructura instanceof Mesh) pintarCieloRaso(scene, estructura, cielo);

  // El ambiente del hall se va bajando y decodificando mientras se monta el
  // resto, para que suene a tiempo al cerrar la tarjeta.
  precargarAmbienteSala("banco");

  // La gente: cajeros, clientes, la puerta y la pantalla de turnos. Antes que
  // las sombras al pie y que la ampliación de luces, que tienen que contarla.
  const puerta = banco.mallas.find((m) => m.material?.name === "set13");
  const gente = crearGenteBanco(scene, piso, puerta instanceof Mesh ? puerta : null);

  // Los que vienen de fuera —los dos del asalto y, después, Carabineros—, con
  // la gente y fuera de escena hasta que les toca: así la sombra al pie y la
  // ampliación de luces los cuentan igual que a los demás. Montados después,
  // como estaban, sus materiales se quedaban con las cuatro luces de fábrica
  // y sin sombra en el piso.
  //
  // El asalto: los dos sujetos, lo que dicen y lo que hace la sala. Empieza a
  // las 9:45. Ver AsaltoBanco.
  const subtitulos = crearSubtitulos();
  const asalto = crearAsaltoBanco(scene, {
    piso,
    gente,
    // Los ojos del guardia de pie, aunque esté en el suelo: el del arma apunta
    // a donde estaba, no a un palmo del piso.
    guardia: () => enSuSitio,
    subtitulos,
    alMomento: (m) => atenderMomento(m),
    alReventarPuerta: () => {
      destello = 1;
    },
  });
  // Carabineros, que llegan cuando todo terminó. Ver LA DECLARACIÓN.
  const carabineros = crearCarabinerosBanco(scene, { piso, guardia: enSuSitio, gente, subtitulos });

  // Las cámaras de seguridad del hall, con su luz roja (ver CamarasBanco).
  // Antes de la foto de los reflejos y de la ampliación de luces, que tienen
  // que contarlas.
  const camaras = montarCamarasBanco(scene, piso, cielo);

  // El entorno de los reflejos, con el hall ya completo. Sin la gente, que se
  // mueve: en un reflejo fijo se quedaría congelada en su primer cuadro.
  fotografiarHall(
    scene,
    new Vector3(0.7, piso + 1.8, 0.6),
    scene.meshes.filter((m) => m !== suelo && !m.name.startsWith("banco_"))
  );

  // El cuerpo del guardia, de pie en su puesto (ver ManosGuardia): después de
  // la foto de los reflejos, que no lo tiene que ver; antes de las sombras al
  // pie, que le ponen la suya, y de la ampliación de luces, que tiene que
  // contar sus materiales.
  const manos = crearManosGuardia(scene, camara, piso, { ojos: enSuSitio, caida: () => caida });

  // Una sombra al pie de cada persona, cuando las haya. Ver sombrasAlPie.
  sombrasAlPie(scene, scene.transformNodes.filter((n) => n.name.startsWith("figura_")));

  // Todo compilado para la cantidad de luces que hay —con la del día, una
  // más—. Lo último, cuando ya existen todos los materiales.
  ampliarLucesBanco(scene, conLuzDeDia ? 9 : 8);

  // --- Post-proceso -------------------------------------------------------------
  //
  // El del supermercado: suavizado de bordes, un resplandor que solo toma lo
  // que pasa de blanco —los paneles y su reflejo en el piso— y el mapeo ACES,
  // que deja sitio por arriba para que la calle a pleno sol se vea más clara
  // que el hall sin quemarse.
  const tuberia = new DefaultRenderingPipeline("postProcesoBanco", true, scene, [camara]);
  tuberia.samples = 4;
  tuberia.bloomEnabled = true;
  tuberia.bloomThreshold = 1.0;
  tuberia.bloomWeight = 0.3;
  tuberia.bloomKernel = 48;
  tuberia.bloomScale = 0.5;
  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.contrast = 1.06;
  tuberia.imageProcessing.exposure = EXPOSICION;
  tuberia.imageProcessing.toneMappingEnabled = true;
  tuberia.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  // La viñeta, encendida desde ya y a cero: es la que oscurece los bordes
  // cuando el guardia está en el suelo. Encenderla recién entonces obligaría a
  // recompilar el post-proceso en mitad del asalto, y se notaría un tirón.
  tuberia.imageProcessing.vignetteEnabled = true;
  tuberia.imageProcessing.vignetteWeight = 0;
  tuberia.imageProcessing.vignetteColor = new Color4(0, 0, 0, 1);

  // --- La barra de controles ------------------------------------------------
  //
  // Los controles están en la tarjeta del inicio. La barra se queda hasta que
  // el jugador mira alrededor por primera vez —ya sabe cómo— o cinco segundos.
  const ayuda = document.createElement("div");
  ayuda.textContent = "Arrastrar para mirar alrededor · ESC para la pausa";
  Object.assign(ayuda.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    borderRadius: "8px",
    background: "rgba(10, 12, 16, 0.78)",
    color: "#e8ecf4",
    font: "500 13px/1 system-ui, sans-serif",
    letterSpacing: "0.3px",
    pointerEvents: "none",
    zIndex: "40",
    opacity: "0",
    transition: "opacity 600ms ease",
  });
  document.body.appendChild(ayuda);
  const CONTROLES_A_LA_VISTA_MS = 5000;
  let temporizadorAyuda: ReturnType<typeof setTimeout> | undefined;
  const apagarAyuda = (): void => {
    clearTimeout(temporizadorAyuda);
    ayuda.style.opacity = "0";
    window.removeEventListener("pointerdown", alMirar);
  };
  const alMirar = (): void => {
    if (enMarcha) apagarAyuda();
  };

  // --- El turno -------------------------------------------------------------
  //
  // Se monta aquí pero no arranca: comenzar() abre la tarjeta y el reloj corre
  // cuando se cierra.
  const hud = crearHudRecorrido({ hora: horaDelTurno(0), turno: ETIQUETA_TURNO, acento: ACENTO });
  const paneles = crearPanelesTurno(scene);
  const panelDeclaracion = crearPanelDeclaracion(scene);
  const reloj = crearRelojTurno(scene, {
    minutoFinal: MINUTO_FINAL,
    minutosPorSegundo: MINUTOS_POR_SEGUNDO,
    // Al paso de las figuras: si el equipo va lento, el turno y la gente se
    // frenan juntos (ver pasoMaximo en RelojTurno).
    pasoMaximo: 0.05,
    // Las 9:45 se clavan en su minuto, pase lo que pase con el cuadro.
    hitos: [FIN_DE_LA_CALMA],
    alAvanzar: (minuto) => {
      hud.ponerHora(horaDelTurno(minuto));
      if (minuto === FIN_DE_LA_CALMA) {
        // Desde aquí el reloj va a tiempo real: ver RITMO_ASALTO.
        reloj.ritmo(RITMO_ASALTO);
        asalto.comenzar();
        // Y la calle se vacía: cada uno termina su tramo y se va antes de que
        // ellos salgan corriendo por el costado (ver CalleBanco).
        exterior.calle.despejar(true);
      }
    },
  });

  let cerrado = false;
  let comenzado = false;
  /** Si el turno está corriendo: ni la tarjeta del inicio ni la pausa delante. */
  let enMarcha = false;
  /** Si hay un momento del asalto en pantalla, esperando respuesta. */
  let enPanel = false;
  /** Si el momento de "ya se fueron" espera a que el guardia se levante. */
  let despuesPendiente = false;
  const decisiones: DecisionBanco[] = [];
  /** Si ya se obedeció a la orden de las manos: desde que entran hasta que se van. */
  let manosALaVista = false;
  /** Hasta cuándo, en tiempo del turno, se tienen más arriba: lo que pide el del arma a un metro. */
  let manosEnAltoHasta = -1;
  /**
   * En qué parte está: el turno —la mañana y el asalto—, la llegada de
   * Carabineros, la declaración o el cierre. Pasado el turno no hay pausa ni
   * vista libre: la escena la lleva el puesto.
   */
  let etapa: "turno" | "llegada" | "declaracion" | "cierre" = "turno";
  const respuestas: RespuestaDeclaracion[] = [];

  /**
   * Devuelve la vista al ratón, si se puede: con el turno corriendo y el
   * guardia de pie. En el suelo no se mira alrededor.
   */
  const devolverMando = (): void => {
    if (cerrado || !enMarcha || enPanel || etapa !== "turno" || sueloQuiere === 1 || caida > 0) return;
    camara.attachControl(true);
  };

  /** Al suelo, con la vista clavada en las baldosas. Ver "EN EL SUELO". */
  const tirarAlSuelo = (efecto: EfectoTrampa): void => {
    const restan = efecto === "alSueloUnRato" ? SEGUNDOS_EN_EL_SUELO : Infinity;
    if (sueloQuiere === 1) {
      // Ya estaba: se queda al menos lo que pida el nuevo.
      sueloRestan = Math.max(sueloRestan, restan);
      return;
    }
    sueloQuiere = 1;
    sueloRestan = restan;
    levantandose = false;
    // Hacia dónde mira de pie, para volver ahí al levantarse. Si lo tiran
    // otra vez a medio levantarse, la vista de ese momento es la del suelo a
    // medias: se conserva la de antes, la de verdad de pie.
    if (caida <= 0) {
      pitchDePie = Math.min(VISTA_ABAJO, Math.max(VISTA_ARRIBA, camara.rotation.x));
      yawSuelo = camara.rotation.y;
    }
    camara.detachControl();
    camara.cameraRotation.set(0, 0);
    hud.anunciarZona("En el suelo", "Te obligaron a tirarte al suelo: desde aquí no ves lo que pasa");
  };

  const levantarse = (): void => {
    if (sueloQuiere === 0) return;
    sueloQuiere = 0;
    sueloRestan = 0;
    levantandose = true;
  };

  /** Ya de pie del todo. */
  const alLevantarse = (): void => {
    devolverMando();
    if (despuesPendiente) {
      despuesPendiente = false;
      abrirMomento("despues");
    }
  };

  // Lo que alcanza a ver, en silencio. Ver ObservacionBanco.
  const observacion = crearObservacionBanco(scene, {
    camara,
    ojosDePie: enSuSitio.clone(),
    asalto,
    enElSuelo: () => sueloQuiere === 1 || caida > 0.3,
    corriendo: () => enMarcha,
    // Tapa lo sólido del edificio y la hoja de la puerta cuando está cerrada.
    // Los vidrios no: se ve a través.
    tapa: (m) => {
      if (!m.isEnabled() || !m.isVisible) return false;
      if (m.name === "hojaPuertaBanco") return true;
      if (!m.checkCollisions) return false;
      return !(m.material && m.material.alpha < 0.99);
    },
  });

  // ─── LOS MOMENTOS DEL ASALTO ───────────────────────────────────────────
  //
  // Como una situación del supermercado: el asalto se congela entero —la
  // gente, los dos sujetos, el reloj, lo que se está diciendo— y sale el
  // panel con las tres opciones. Al cerrar la explicación todo sigue donde
  // estaba, y si se eligió una trampa, se paga en la escena.
  //
  // Salen siempre, se esté mirando o no: el grito, la puerta, a alguien
  // apuntándote a un metro, los oye cualquiera.
  //
  // Con un panel delante el asalto está congelado y no avisa de nada; pero si
  // un momento llegara igual, no se pierde: sale al cerrarse el que hay.
  // Perderlo dejaría al asalto esperando una respuesta que nunca llega.
  let momentoPendiente: MomentoAsalto | null = null;
  const atenderMomento = (m: MomentoAsalto): void => {
    if (cerrado) return;
    if (enPanel) {
      momentoPendiente = m;
      return;
    }
    // "Ya se fueron" con el guardia en el suelo: primero se levanta —para eso
    // lo tenían ahí—, y la pregunta sale cuando ya está de pie.
    if (m === "despues" && (sueloQuiere === 1 || caida > 0)) {
      despuesPendiente = true;
      levantarse();
      return;
    }
    abrirMomento(m);
  };

  const abrirMomento = (m: MomentoAsalto): void => {
    if (enPanel || cerrado) return;
    enPanel = true;
    const datos = MOMENTOS[m];
    const enElSuelo = sueloQuiere === 1 || caida > 0;
    let elegida: OpcionMomento | null = null;

    // El mismo orden que el supermercado: primero se quita el mando, después
    // se muestra. Al revés, el primer clic sobre una opción puede írsele a la
    // cámara.
    enMarcha = false;
    reloj.correr(false);
    gente.congelar(true);
    exterior.calle.congelar(true);
    asalto.congelar(true);
    subtitulos.mostrar(false);
    agacharAmbienteSala(true);
    congelarSonidosSala(true);
    camara.detachControl();
    hud.ocultar();
    reproducir("pregunta");
    // "¡Las manos donde las vea!": se suben, y así quedan un rato después de
    // contestar, mientras lo tiene delante.
    if (m === "seAcerca") manosEnAltoHasta = tiempoPuesto + 6;

    paneles.mostrarSituacion(
      {
        rotulo: `${horaDelTurno(reloj.minuto())} · ${datos.actividad}`,
        aviso: enElSuelo && datos.avisoEnElSuelo ? datos.avisoEnElSuelo : datos.aviso,
        // En el suelo, cada opción con su versión de ahí abajo, si la tiene. Lo
        // que se anota es lo que se leyó.
        opciones: enElSuelo
          ? datos.opciones.map((op) => (op.enElSuelo ? { ...op, ...op.enElSuelo } : op))
          : datos.opciones,
      },
      (opcion) => {
        elegida = opcion as OpcionMomento;
        decisiones.push({ momento: m, minuto: reloj.minuto(), opcion: elegida });
        reproducir(opcion.correcta ? "acierto" : "error");
      },
      () => {
        enPanel = false;
        agacharAmbienteSala(false);
        if (cerrado) return;
        gente.congelar(false);
        exterior.calle.congelar(false);
        asalto.congelar(false);
        congelarSonidosSala(false);
        subtitulos.mostrar(true);
        hud.mostrar();
        reproducir("cerrar");
        reloj.correr(true);
        enMarcha = true;
        devolverMando();

        // Desde la entrada, las manos a la vista. También si se eligió mal: el
        // suelo las pone en el piso, y al levantarse ya se sabe qué se pide.
        if (m === "entran") manosALaVista = true;

        const hecha = elegida;
        // La clienta que se quería ir hace lo que se eligió: vuelve a su
        // asiento, sigue hasta la vereda o se encuentra la puerta con llave.
        if (m === "seQuiereIr") asalto.resolverTestigo(hecha?.testigo ?? "espera");
        if (hecha) {
          // La trampa, en la escena: el del arma lo ve, se vuelve, le grita y
          // lo manda al suelo. Un instante después del grito, que es lo que
          // tarda cualquiera en obedecer con un arma delante.
          if (hecha.efecto) {
            const yaEnElSuelo = sueloQuiere === 1;
            asalto.encararGuardia(yaEnElSuelo ? "¡Quieto ahí en el suelo!" : hecha.reaccion ?? "¡Al suelo!", 3);
            const efecto = hecha.efecto;
            luego(0.7, () => tirarAlSuelo(efecto));
          }
          // Lo que cuenta Central por radio, si lo que se hizo tiene respuesta.
          if (hecha.despues) {
            hud.avisarRadio(hecha.despues, 9000);
            reproducir("radio");
          }
        }
        // Y el que llegó mientras este estaba en pantalla, si llegó alguno.
        const pendiente = momentoPendiente;
        momentoPendiente = null;
        if (pendiente) atenderMomento(pendiente);
      }
    );
  };

  // ─── LA DECLARACIÓN ────────────────────────────────────────────────────
  //
  // Terminado el asalto —se fueron, se contestó el último momento y la sala se
  // recompuso—, la pantalla va a negro y vuelve veinte minutos después, con
  // Carabineros dentro: el sargento delante del guardia y un cabo resguardando
  // las cajas (ver CarabinerosBanco). El sargento se presenta y le toma
  // declaración: seis preguntas, cada una con su tarjeta a la derecha y él a
  // la izquierda, anotando lo que se le contesta. Al final, lo declarado en
  // papel, la firma, y el cierre del turno.
  //
  // Lo que se puede contestar sale de lo que se vio (ver DeclaracionBanco): el
  // primer tiempo se paga aquí.
  //
  // Desde la llegada no hay pausa ni vista libre. Son escenas y tarjetas que
  // se cierran eligiendo, como los momentos del asalto.

  /** El negro de la llegada, con lo que pasó mientras tanto. Un div, como la barra de controles. */
  const fundido = document.createElement("div");
  Object.assign(fundido.style, {
    position: "fixed",
    inset: "0",
    background: "#050607",
    opacity: "0",
    transition: "opacity 1200ms ease",
    pointerEvents: "none",
    zIndex: "60",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  });
  const cuandoFundido = document.createElement("div");
  cuandoFundido.textContent = "Veinte minutos después";
  Object.assign(cuandoFundido.style, {
    color: "#e9edf2",
    font: "300 30px/1.2 system-ui, 'Segoe UI', sans-serif",
    letterSpacing: "0.4px",
  });
  const queFundido = document.createElement("div");
  queFundido.textContent = "LLEGA CARABINEROS";
  Object.assign(queFundido.style, {
    color: "rgba(233, 237, 242, 0.5)",
    font: "600 12px/1 system-ui, 'Segoe UI', sans-serif",
    letterSpacing: "2.4px",
  });
  fundido.append(cuandoFundido, queFundido);
  document.body.appendChild(fundido);

  /**
   * Lleva la vista a un punto y lo deja en ese sitio de la pantalla, en
   * fracciones del ancho y del alto: 0,5 y 0,5 es el centro.
   */
  /** El punto puede moverse —alguien que camina—: se sigue cuadro a cuadro. */
  const encuadrar = (
    punto: Vector3 | (() => Vector3),
    x: number | (() => number),
    y: number,
    deGolpe = false
  ): void => {
    const fijo = punto instanceof Vector3 ? punto.clone() : null;
    encuadre = {
      punto: fijo ? () => fijo : (punto as () => Vector3),
      x: typeof x === "number" ? () => x : x,
      y,
      deGolpe,
    };
  };

  /**
   * La puerta, a la altura de la cabeza de quien entra. En el tercio
   * izquierdo de la pantalla: al centro, la mitad de la imagen era el muro
   * pegado al puesto.
   */
  const puertaAbierta = new Vector3(PUERTA_X, piso + 1.45, CENTRO_PUERTA.z);

  const llegaCarabineros = (): void => {
    if (etapa !== "turno" || cerrado) return;
    etapa = "llegada";
    camara.detachControl();
    camara.cameraRotation.set(0, 0);
    apagarAyuda();
    fundido.style.opacity = "1";
    // Ya en negro: pasaron veinte minutos. La sala vuelve a hablar, bajo, y
    // cada uno está donde lo dejó lo que pasó (ver LA SALA DESPUÉS en
    // GenteBanco). Fuera, la patrulla con las balizas; dentro, el cabo junto
    // a las cajas, y el sargento en la explanada, a punto de entrar. La vista,
    // a la puerta.
    luego(1.5, () => {
      reloj.saltarA(reloj.minuto() + MINUTOS_HASTA_CARABINEROS);
      devolverAmbienteSala(3);
      // Con la clienta que se quiso ir donde la dejó lo que se eligió.
      gente.recomponer(enSuSitio, asalto.desenlaceTestigo());
      exterior.patrulla.aparecer();
      // Y la de la ventana del costado tiñe lo de dentro (ver LAS BALIZAS SE
      // CUELAN DENTRO).
      destello = 0;
      luzPuerta.position.copyFrom(VENTANA_DEL_FONDO);
      balizasDentro = true;
      // Y en la calle vuelve a pasar gente, que mira las patrullas y sigue.
      exterior.calle.despejar(false);
      carabineros.preparar();
      encuadrar(puertaAbierta, 0.36, 0.45, true);
    });
    luego(3.3, () => {
      fundido.style.opacity = "0";
    });
    // Aclarando, entra: la puerta se le abre y, por ella, se ve la patrulla
    // con las balizas. La vista lo sigue hasta que se planta delante.
    luego(4.2, () => {
      // La vista espera en la puerta hasta que él asoma en el vano, y desde
      // ahí lo sigue. Siguiéndolo desde el principio, se le buscaba a través
      // de la pared, con él todavía fuera.
      const fuera = (): boolean => carabineros.cara().z < CENTRO_PUERTA.z + 0.15;
      encuadrar(
        () => (fuera() ? puertaAbierta : carabineros.cara()),
        () => (fuera() ? 0.36 : 0.5),
        0.42
      );
      carabineros.entrar(() => {
        // Se presenta. Cómo se enteraron depende de si el guardia avisó.
        const aviso = decisiones.find((d) => d.momento === "despues");
        const saludo = aviso?.opcion.correcta
          ? "Buenos días. Sargento Rojas, Tercera Comisaría. Recibimos su aviso por la central."
          : "Buenos días. Sargento Rojas, Tercera Comisaría. Nos llamó el cajero de la caja 2.";
        const dichos: { frase: string; dura: number; mira?: boolean }[] = [{ frase: saludo, dura: 4.6 }];
        // Y lo que hay que decir de la clienta que se quiso ir, según lo que
        // hizo el guardia (ver el quinto momento): la mira mientras lo dice,
        // si está.
        const testigo = asalto.desenlaceTestigo();
        if (testigo) dichos.push({ ...SOBRE_EL_TESTIGO[testigo], mira: testigo !== "seVa" });
        dichos.push({ frase: "Necesito tomarle declaración. Cuénteme lo que vio.", dura: 3.4 });
        let cuando = 0.6;
        dichos.forEach(({ frase, dura, mira }) => {
          luego(cuando, () => {
            carabineros.decir(frase, dura);
            const ella = asalto.testigo();
            if (mira && ella) carabineros.mirarUnRato(ella.puntoDeLaCabeza(0.06, 0, 0), Math.min(2.6, dura - 1));
          });
          cuando += dura + 0.2;
        });
        luego(cuando + 0.1, empezarDeclaracion);
      });
    });
  };

  const empezarDeclaracion = (): void => {
    if (cerrado) return;
    etapa = "declaracion";
    hud.ocultar();
    // Lo que se vio queda como estaba al irse ellos: la observación ya no
    // cuenta nada después.
    const visto = observacion.resumen();
    let k = 0;
    const siguiente = (): void => {
      if (cerrado) return;
      if (k >= TOTAL_PREGUNTAS) {
        mostrarDocumento();
        return;
      }
      const p = prepararPregunta(k, visto);
      encuadrar(() => carabineros.cara(), () => panelDeclaracion.hueco(), 0.4);
      carabineros.preguntar(Math.min(3.4, 1 + p.pregunta.length * 0.05));
      if (k === 0) reproducir("pregunta");
      panelDeclaracion.mostrarPregunta(
        p,
        (o) => {
          respuestas.push({
            id: p.id,
            tema: p.tema,
            pregunta: p.pregunta,
            tipo: o.tipo,
            texto: o.texto,
            correcta: o.correcta,
            bloqueada: p.bloqueada,
            faltan: p.faltan,
          });
          reproducir(o.correcta ? "acierto" : "error");
          carabineros.anotar(2.8);
        },
        () => {
          k += 1;
          siguiente();
        }
      );
    };
    siguiente();
  };

  const mostrarDocumento = (): void => {
    const hoy = new Date();
    const fecha = [hoy.getDate(), hoy.getMonth() + 1]
      .map((n) => String(n).padStart(2, "0"))
      .concat(String(hoy.getFullYear()))
      .join("-");
    panelDeclaracion.mostrarDocumento({ fecha, hora: horaDelTurno(reloj.minuto()), respuestas }, () => {
      if (cerrado) return;
      etapa = "cierre";
      encuadrar(() => carabineros.cara(), 0.5, 0.42);
      carabineros.guardarLibreta();
      // Medio segundo, a que se vaya el papel: el subtítulo va por encima de
      // todo, y encima del documento se leían los dos a la vez. Primero las
      // grabaciones, con la vista en la cámara del acceso; después se despide.
      luego(0.5, () => {
        carabineros.decir(SOBRE_LAS_CAMARAS, 5.2);
        carabineros.mirarUnRato(camaras.acceso, 2.4);
      });
      luego(5.9, () =>
        carabineros.decir("Gracias. Con esto es suficiente. Si recuerda algo más, llame a la comisaría.", 4.4)
      );
      luego(10.9, mostrarCierre);
    });
  };

  const mostrarCierre = (): void => {
    if (cerrado) return;
    panelDeclaracion.mostrarCierre(
      {
        decisionesBien: decisiones.filter((d) => d.opcion.correcta).length,
        decisionesTotal: decisiones.length,
        declaracionBien: respuestas.filter((r) => r.correcta).length,
        declaracionTotal: respuestas.length,
        opiniones: respuestas.filter((r) => r.tipo === "opina").length,
        inventadas: respuestas.filter((r) => r.tipo === "inventa").length,
        sinVer: respuestas.reduce((s, r) => s + r.faltan.length, 0),
      },
      () => salir("repetir"),
      () => salir("menu")
    );
  };

  /**
   * Solo para PRUEBA_RAPIDA: corre la mañana DE VERDAD hasta ese minuto —la
   * gente con su guion, la pantalla, el reloj—, a pasos de cuadro y sin
   * dibujarla.
   *
   * Saltar solo el reloj, como se hacía, dejaba a la gente en las 9:00: el
   * asalto caía antes del primer llamado de la pantalla, y de la tarjeta se
   * pasaba al asalto sin nada en medio. Así se llega a la misma sala que en
   * el turno entero, y lo que queda de mañana —el cliente que se va, el
   * tin-tón, la señora que pasa a la caja— se ve y se oye antes de que entren.
   *
   * En silencio mientras corre: los llamados adelantados no suenan todos de
   * golpe. Cuesta unos 0,35 ms por paso; hasta las 9:34, unos seis décimos.
   */
  const adelantarTurno = (minuto: number): void => {
    const PASO = 0.05;
    const motor = scene.getEngine();
    const deVerdad = motor.getDeltaTime;
    const yaMudo = estaSilenciado();
    establecerSilencio(true);
    motor.getDeltaTime = () => PASO * 1000;
    try {
      const pasos = Math.ceil(minuto / MINUTOS_POR_SEGUNDO / PASO) + 2;
      for (let k = 0; k < pasos && reloj.minuto() < minuto; k++) {
        scene.onBeforeRenderObservable.notifyObservers(scene);
      }
    } finally {
      motor.getDeltaTime = deVerdad;
      establecerSilencio(yaMudo);
    }
  };

  const comenzar = (): void => {
    if (cerrado || comenzado) return;
    comenzado = true;
    // Con la tarjeta delante no se mira alrededor. Y sin la cámara escuchando
    // el puntero, el clic llega entero al botón (ver main.ts).
    camara.detachControl();
    paneles.mostrarBriefing(BRIEFING_TURNO, () => {
      if (cerrado) return;
      camara.attachControl(true);
      hud.mostrar();
      gente.comenzar();
      reloj.correr(true);
      // Ver PRUEBA_RAPIDA: la mañana corrida hasta poco antes del asalto.
      // Antes que el ambiente: el silencio del adelanto lo cortaría.
      if (PRUEBA_RAPIDA) adelantarTurno(PRUEBA_RAPIDA_DESDE);
      // El hall empieza a sonar con el turno, entrando en dos segundos.
      iniciarAmbienteSala("banco");
      enMarcha = true;
      ayuda.style.opacity = "1";
      temporizadorAyuda = setTimeout(apagarAyuda, CONTROLES_A_LA_VISTA_MS);
      window.addEventListener("pointerdown", alMirar);
    });
  };

  // --- Salir -----------------------------------------------------------------
  //
  // En el orden del supermercado: se suelta el mando, se desmonta la escena y
  // solo entonces se avisa. Avisar antes deja al menú montándose sobre una
  // escena que se está destruyendo debajo.
  const salir = (motivo: MotivoSalida = "menu"): void => {
    if (cerrado) return;
    cerrado = true;
    enMarcha = false;
    window.removeEventListener("keydown", alPulsar);
    camara.detachControl();
    apagarAyuda();
    ayuda.remove();
    fundido.remove();
    if (plantado) scene.onBeforeRenderObservable.remove(plantado);
    detenerAmbienteSala();
    detenerSonidosSala();
    exterior.patrulla.dispose();
    exterior.calle.dispose();
    camaras.dispose();
    manos.dispose();
    observacion.dispose();
    asalto.dispose();
    carabineros.dispose();
    panelDeclaracion.dispose();
    subtitulos.dispose();
    gente.dispose();
    reloj.dispose();
    hud.dispose();
    paneles.dispose();
    tuberia.dispose();
    limpiarEscena(scene);
    onSalir(motivo);
  };

  // --- La pausa ---------------------------------------------------------------
  //
  // ESC detiene el turno —reloj parado y la vista suelta— y desde ahí se sigue
  // o se sale. Antes de empezar, con la tarjeta de jefatura puesta, no hay
  // turno que perder y ESC sale directo, como en el supermercado.
  //
  // Va al final por lo mismo que allá: la tecla puede llegar antes de que el
  // puesto termine de montarse.
  let enPausa = false;
  const abrirPausa = (): void => {
    if (enPausa || enPanel || etapa !== "turno" || cerrado || !comenzado || !enMarcha) return;
    enPausa = true;
    enMarcha = false;
    reloj.correr(false);
    gente.congelar(true);
    exterior.calle.congelar(true);
    asalto.congelar(true);
    subtitulos.mostrar(false);
    // La sala no se calla en la pausa, pero se aparta. Lo que estaba sonando
    // en ella —un golpe, una exclamación— se para donde iba.
    agacharAmbienteSala(true);
    congelarSonidosSala(true);
    camara.detachControl();
    hud.ocultar();
    paneles.mostrarPausa(
      () => seguirTrasPausa(),
      () => salir("menu"),
      // La del supermercado habla de llegar a las 20:00: aquí el turno cuenta
      // cuando se firma la declaración.
      "Si sales ahora, el turno no queda registrado. Para que cuente hay que llegar hasta la declaración " +
        "ante Carabineros y firmarla."
    );
  };
  const seguirTrasPausa = (): void => {
    if (!enPausa) return;
    enPausa = false;
    agacharAmbienteSala(false);
    if (cerrado) return;
    gente.congelar(false);
    exterior.calle.congelar(false);
    asalto.congelar(false);
    congelarSonidosSala(false);
    subtitulos.mostrar(true);
    hud.mostrar();
    reloj.correr(true);
    enMarcha = true;
    // En el suelo, la vista sigue clavada: la pausa no levanta a nadie.
    devolverMando();
  };
  const alPulsar = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    if (!comenzado) {
      salir("menu");
      return;
    }
    // Con un momento del asalto en pantalla, ESC no hace nada: esa tarjeta se
    // cierra eligiendo, como las situaciones del supermercado. Y desde que
    // llega Carabineros, tampoco: todo lo que queda se cierra eligiendo.
    if (enPanel || etapa !== "turno") return;
    if (enPausa) {
      if (paneles.cerrarPausa()) seguirTrasPausa();
      return;
    }
    abrirPausa();
  };
  window.addEventListener("keydown", alPulsar);

  return {
    banco,
    comenzar,
    asalto,
    observacion,
    decisiones: () => decisiones,
    declaracion: () => respuestas,
    dispose: () => salir("menu"),
  };
}

/**
 * Altura del cielo raso sobre el puesto, medida con un rayo hacia arriba.
 *
 * Como el piso: se mide y no se supone, porque de ella cuelgan los paneles y
 * los focos, y con la escala del modelo cambian las dos.
 */
function medirCielo(scene: Scene, mallas: AbstractMesh[], x: number, z: number, piso: number): number {
  const rayo = new Ray(new Vector3(x, piso + 1.2, z), Vector3.Up(), 30);
  const impacto = scene.pickWithRay(rayo, (m) => mallas.includes(m));
  return impacto?.hit && impacto.pickedPoint ? impacto.pickedPoint.y : piso + 5.25;
}

/**
 * Aparta el cielo raso de la estructura y lo pinta de blanco mate.
 *
 * Por triángulos, como el suelo (ver separarSueloSala): los horizontales a la
 * altura medida del cielo. Mate a propósito: un cielo raso es yeso pintado, y
 * con brillo devolvería los paneles como manchas.
 */
function pintarCieloRaso(scene: Scene, malla: Mesh, cielo: number): Mesh | null {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  const indices = malla.getIndices();
  if (!pos || !indices) return null;
  const mundo = malla.computeWorldMatrix(true);
  const v = [new Vector3(), new Vector3(), new Vector3()];
  const normal = new Vector3();
  const resto: number[] = [];
  const techo: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], mundo, v[k]);
    }
    Vector3.CrossToRef(v[1].subtract(v[0]), v[2].subtract(v[0]), normal);
    normal.normalize();
    const y = (v[0].y + v[1].y + v[2].y) / 3;
    const esTecho = Math.abs(normal.y) > 0.9 && Math.abs(y - cielo) < 0.03;
    (esTecho ? techo : resto).push(indices[t], indices[t + 1], indices[t + 2]);
  }
  if (!techo.length) return null;
  const copia = malla.clone("cieloRasoBanco", malla.parent)!;
  copia.makeGeometryUnique();
  copia.setIndices(techo);
  malla.setIndices(resto);
  const yeso = new PBRMaterial("matCieloRasoBanco", scene);
  yeso.albedoColor = new Color3(0.86, 0.86, 0.84);
  yeso.metallic = 0;
  yeso.roughness = 0.92;
  copia.material = yeso;
  copia.freezeWorldMatrix();
  return copia;
}

/**
 * El vidrio de las ventanas, que llegaba de Maya como una lámina gris casi
 * opaca: se deja transparente y con su reflejo, como un vidrio de verdad.
 */
function afinarVidrio(mallas: AbstractMesh[]): void {
  const vistos = new Set<PBRMaterial>();
  mallas.forEach((m) => {
    const mat = m.material;
    if (!(mat instanceof PBRMaterial) || vistos.has(mat)) return;
    if (mat.name !== "aiStandardSurface2SG") return;
    vistos.add(mat);
    mat.albedoTexture = null;
    mat.albedoColor = new Color3(0.9, 0.95, 0.97);
    mat.alpha = 0.12;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    mat.metallic = 0;
    mat.roughness = 0.04;
    // El reflejo no se apaga con la transparencia: un vidrio casi invisible
    // sigue devolviendo el brillo de la sala en los bordes, que es lo que dice
    // que ahí hay un vidrio.
    mat.useRadianceOverAlpha = true;
    mat.useSpecularOverAlpha = true;
  });
}
