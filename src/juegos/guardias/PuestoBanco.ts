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
  type AbstractMesh,
  type Observer,
} from "@babylonjs/core";
import { cargarBanco, medirPiso, ALTURA_OJO, type BancoCargado } from "./EscenaBanco";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { iluminarBanco, ampliarLucesBanco, fotografiarHall } from "./LuzBanco";
import { construirExteriorBanco } from "./ExteriorBanco";
import { separarSueloSala, pulirSuelo, sombrasAlPie } from "./LuzSalaSupermercado";
import { crearHudRecorrido } from "./HudRecorrido";
import { crearRelojTurno } from "./RelojTurno";
import { crearPanelesTurno } from "./PanelesSupermercado";
import { crearGenteBanco } from "./GenteBanco";
import { crearAsaltoBanco, type AsaltoBanco, type MomentoAsalto } from "./AsaltoBanco";
import {
  MOMENTOS,
  SEGUNDOS_EN_EL_SUELO,
  type DecisionBanco,
  type EfectoTrampa,
  type OpcionMomento,
} from "./MomentosBanco";
import { crearObservacionBanco, type ObservacionBanco } from "./ObservacionBanco";
import { crearSubtitulos } from "./SubtitulosTurno";
import {
  precargarAmbienteSala,
  iniciarAmbienteSala,
  agacharAmbienteSala,
  detenerAmbienteSala,
  reproducir,
} from "../../core/Sonido";
import {
  BRIEFING_TURNO,
  ETIQUETA_TURNO,
  FIN_DE_LA_CALMA,
  MINUTO_FINAL,
  MINUTOS_POR_SEGUNDO,
  PRUEBA_RAPIDA,
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
 * Lo que da el cuello sin moverse del sitio: se ve el piso a los pies y las
 * luminarias del techo, pero no se da la vuelta por arriba. Sin tope, una
 * FreeCamera deja seguir girando hasta mirar al revés.
 */
const VISTA_ARRIBA = -0.75;
const VISTA_ABAJO = 0.7;

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
    }
    if (caida > 0 || sueloQuiere === 1 || levantandose) {
      const e = caida * caida * (3 - 2 * caida);
      // La respiración de quien está tirado en el suelo con un arma cerca:
      // apenas, pero la vista no se queda muerta. Corre con el turno, así que
      // en la pausa se para.
      const respiro = Math.sin(tiempoPuesto * 1.9) * e;
      camara.position.set(
        enSuSitio.x + Math.sin(yawSuelo) * AVANCE_EN_EL_SUELO * e,
        enSuSitio.y - (ALTURA_OJO - ALTO_EN_EL_SUELO) * e + respiro * 0.005,
        enSuSitio.z + Math.cos(yawSuelo) * AVANCE_EN_EL_SUELO * e
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
    camara.position.copyFrom(enSuSitio);
    camara.rotation.x = Math.min(VISTA_ABAJO, Math.max(VISTA_ARRIBA, camara.rotation.x));
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
    pulirSuelo(scene, suelo, piso, (m) => !deFuera.has(m) && !m.name.endsWith("_sombraAlPie"));
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

  // El entorno de los reflejos, con el hall ya completo. Sin la gente, que se
  // mueve: en un reflejo fijo se quedaría congelada en su primer cuadro.
  fotografiarHall(
    scene,
    new Vector3(0.7, piso + 1.8, 0.6),
    scene.meshes.filter((m) => m !== suelo && !m.name.startsWith("banco_"))
  );

  // Una sombra al pie de cada persona, cuando las haya. Ver sombrasAlPie.
  sombrasAlPie(scene, scene.transformNodes.filter((n) => n.name.startsWith("figura_")));

  // Todo compilado para la cantidad de luces que hay. Lo último, cuando ya
  // existen todos los materiales.
  ampliarLucesBanco(scene);

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
  tuberia.imageProcessing.exposure = 1.1;
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
  // El asalto: los dos sujetos, lo que dicen y lo que hace la sala. Se monta
  // ya, con todo lo demás, y empieza a las 9:45. Ver AsaltoBanco.
  const subtitulos = crearSubtitulos();
  const asalto = crearAsaltoBanco(scene, {
    piso,
    gente,
    // Los ojos del guardia de pie, aunque esté en el suelo: el del arma apunta
    // a donde estaba, no a un palmo del piso.
    guardia: () => enSuSitio,
    subtitulos,
    alMomento: (m) => atenderMomento(m),
  });
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

  /**
   * Devuelve la vista al ratón, si se puede: con el turno corriendo y el
   * guardia de pie. En el suelo no se mira alrededor.
   */
  const devolverMando = (): void => {
    if (cerrado || !enMarcha || enPanel || sueloQuiere === 1 || caida > 0) return;
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
    pitchDePie = Math.min(VISTA_ABAJO, Math.max(VISTA_ARRIBA, camara.rotation.x));
    yawSuelo = camara.rotation.y;
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
  const atenderMomento = (m: MomentoAsalto): void => {
    if (cerrado) return;
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
    asalto.congelar(true);
    subtitulos.mostrar(false);
    agacharAmbienteSala(true);
    camara.detachControl();
    hud.ocultar();
    reproducir("pregunta");

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
        asalto.congelar(false);
        subtitulos.mostrar(true);
        hud.mostrar();
        reproducir("cerrar");
        reloj.correr(true);
        enMarcha = true;
        devolverMando();

        const hecha = elegida;
        if (!hecha) return;
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
    );
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
      // El hall empieza a sonar con el turno, entrando en dos segundos.
      iniciarAmbienteSala("banco");
      gente.comenzar();
      reloj.correr(true);
      // Ver PRUEBA_RAPIDA: directo a las 9:44, a un minuto del asalto.
      if (PRUEBA_RAPIDA) reloj.saltarA(FIN_DE_LA_CALMA - 1);
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
    if (plantado) scene.onBeforeRenderObservable.remove(plantado);
    detenerAmbienteSala();
    observacion.dispose();
    asalto.dispose();
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
    if (enPausa || enPanel || cerrado || !comenzado || !enMarcha) return;
    enPausa = true;
    enMarcha = false;
    reloj.correr(false);
    gente.congelar(true);
    asalto.congelar(true);
    subtitulos.mostrar(false);
    // La sala no se calla en la pausa, pero se aparta.
    agacharAmbienteSala(true);
    camara.detachControl();
    hud.ocultar();
    paneles.mostrarPausa(
      () => seguirTrasPausa(),
      () => salir("menu")
    );
  };
  const seguirTrasPausa = (): void => {
    if (!enPausa) return;
    enPausa = false;
    agacharAmbienteSala(false);
    if (cerrado) return;
    gente.congelar(false);
    asalto.congelar(false);
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
    // cierra eligiendo, como las situaciones del supermercado.
    if (enPanel) return;
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
