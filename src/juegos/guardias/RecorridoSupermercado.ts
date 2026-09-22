import {
  Scene,
  FreeCamera,
  Vector3,
  Color4,
  Ray,
  DefaultRenderingPipeline,
  type AbstractMesh,
} from "@babylonjs/core";
import {
  cargarSupermercado,
  iluminarSupermercado,
  ampliarLucesSupermercado,
  medirPisoSala,
  type SupermercadoCargado,
} from "./EscenaSupermercado";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { construirBodega } from "./BodegaSupermercado";
import { construirOficina } from "./OficinaSupermercado";
import { crearClientes } from "./ClientesSupermercado";
import { crearDetectorZonas, comprobarPlano, PUERTA_X, ZONAS, type IdZona } from "./ZonasSupermercado";
import { crearHudRecorrido, type VistaRonda } from "./HudRecorrido";
import { crearRelojTurno } from "./RelojTurno";
import { crearRondas, MINUTOS_POR_RONDA, ZONAS_DE_RONDA, type RondaEnCurso } from "./RondasSupermercado";
import { crearPanelesTurno } from "./PanelesSupermercado";
import { crearSituaciones, type Situacion } from "./SituacionesSupermercado";
import type { OpcionSituacion } from "./PanelesSupermercado";
import { crearActores } from "./ActoresSupermercado";
import { colgarLetrerosPasillos } from "./PasillosSupermercado";
import { construirExterior } from "./ExteriorSupermercado";
import { extraerProductos } from "./ProductosSupermercado";
import { construirFachada } from "./FachadaSupermercado";
import {
  DURACION_TURNO,
  ETIQUETA_TURNO,
  BRIEFING_TURNO,
  NOTA_RECUENTO,
  NOTA_RECUENTO_SITUACIONES,
  horaDelTurno,
} from "./TurnoSupermercado";
import type { FilaSituacion, ErrorEnInforme } from "./PanelesSupermercado";
import { calificarTurno, DESCUENTOS, type ErrorTurno } from "./CalificacionSupermercado";
import { registrarTurno, NOTA_APROBACION } from "./HistorialTurnos";
import { reproducir } from "../../core/Sonido";

// ===========================================================================
// Escenario 2 — Supermercado
// ===========================================================================
//
// El nivel se monta por pasos sobre el escenario recorrible:
//
//   · Cuatro zonas con nombre (ZonasSupermercado, con la bodega que el modelo
//     no traía) y un turno que corre desde las 16:00 (RelojTurno, el mismo
//     del condominio).
//   · Una tarjeta al empezar con la instrucción de jefatura, una ronda de
//     verificación cada 20 minutos por las cuatro zonas (RondasSupermercado)
//     y el recuento de rondas al cierre del turno (PanelesSupermercado).
//   · Ocho clientes con ropa, estatura y recorrido fijos, que caminan por su
//     zona y se paran delante de las góndolas (ClientesSupermercado).
//   · Ocho situaciones repartidas por el turno y por las zonas, cinco reales
//     y tres inocentes, cada una con alguien o algo haciéndola de verdad en la
//     sala (ActoresSupermercado y ActoresSala). Central avisa por radio de
//     DÓNDE pasa algo, nunca de qué; saltan cuando el jugador se para a
//     MIRARLAS —una barra le dice que está observando—, paran el reloj y piden
//     decidir entre observar, avisar o intervenir (SituacionesSupermercado,
//     con su panel en PanelesSupermercado). La del hurto tiene dos partes
//     encadenadas: si se responde OBSERVAR, el cliente cruza la línea de cajas
//     sin pagar y hay que decidir otra vez — y ahí intervenir, que antes era
//     el error, pasa a ser lo correcto. Las que no se ven pasan igual, y
//     Central cuenta después lo que pasó.
//
// ─── POR QUÉ ESTO EXISTE ANTES QUE LA MECÁNICA ────────────────────────────
//
// Porque el escenario llegó de Bitplay y hay que comprobarlo antes de montarle
// nada encima: que las texturas carguen, que la escala sea la que dice, que se
// pueda caminar dentro y que la iluminación funcione. Si algo de eso falla y ya
// hubiera lógica de nivel por medio, no habría forma de saber qué está roto.
//
// Es el mismo orden que se siguió con el garaje del 5S: primero entrar y mirar,
// después jugar.
//
// ─── Y POR QUÉ SE CAMINA EN VEZ DE ORBITAR ────────────────────────────────
//
// El escenario 1 tiene la cámara fija en la silla del conserje porque el
// trabajo ocurre en el mesón. Aquí es al revés: lo que hay que evaluar es si
// los pasillos, las góndolas y las alturas funcionan para un guardia que
// recorre la sala. Eso solo se sabe caminándola.

export interface RecorridoSupermercado {
  supermercado: SupermercadoCargado;
  /**
   * Abre el turno: la tarjeta con la instrucción de jefatura y, al cerrarla,
   * el reloj, las zonas y las rondas.
   *
   * Aparte de la creación a propósito. Hay que llamarla cuando la pantalla de
   * carga ya se fue; hacerlo antes es entrar con el turno empezado.
   */
  comenzar: () => void;
  dispose: () => void;
}

/** Altura de los ojos de una persona de pie. */
const ALTURA_OJO = 1.65;

/** El color del escenario, el mismo de su pantalla de carga en JuegoGuardias. */
const ACENTO = "#79a8bd";

/**
 * Lo que se queda a la vista el aviso de una ronda que venció a medias.
 *
 * Tres segundos: lo bastante para leer qué faltó, poco para que la ronda
 * siguiente —que ya está corriendo— se quede sin lista demasiado rato.
 */
const AVISO_RONDA_MS = 3200;

/**
 * @param usuario  Quien juega. Es con quien se guarda el turno en el historial,
 *                 igual que el condominio. Sin nombre, "invitado".
 */
export async function crearRecorridoSupermercado(
  scene: Scene,
  onSalir: () => void,
  usuario = "invitado"
): Promise<RecorridoSupermercado> {
  // Lo primero: vaciar lo que dejó el condominio. Ver LimpiezaEscena.
  limpiarEscena(scene);

  scene.clearColor = new Color4(0.09, 0.1, 0.13, 1);

  // La cámara se crea ANTES de cargar el modelo, y no después.
  //
  // limpiarEscena deja scene.activeCamera en null, y el bucle de render de
  // main.ts sigue corriendo mientras se descarga el .glb. Sin cámara, cada uno
  // de esos cuadros lanzaba "No camera defined": la escena quedaba en negro y
  // no se recuperaba aunque el modelo terminara de cargar.
  //
  // Creándola primero, el bucle siempre tiene a qué apuntar. Durante la carga
  // dibuja una escena vacía, que es exactamente lo que la pantalla de carga
  // está tapando.
  const camara = new FreeCamera(
    "camaraRecorrido",
    new Vector3(0, ALTURA_OJO, 0),
    scene
  );
  camara.minZ = 0.1;
  camara.speed = 0.14;
  camara.angularSensibility = 3200;
  camara.inertia = 0.82;

  // WASD además de las flechas: es lo que espera cualquiera que haya caminado
  // por un escenario en 3D.
  camara.keysUp.push(87);
  camara.keysDown.push(83);
  camara.keysLeft.push(65);
  camara.keysRight.push(68);

  // El jugador camina, no vuela: la cámara tiene volumen y choca con las
  // góndolas y los muros en vez de atravesarlos.
  scene.collisionsEnabled = true;
  camara.checkCollisions = true;
  camara.applyGravity = false;
  camara.ellipsoid = new Vector3(0.35, ALTURA_OJO / 2, 0.35);
  camara.ellipsoidOffset = new Vector3(0, ALTURA_OJO / 2, 0);

  usarCamara(scene, camara);

  // ESCALA 2,5. El modelo llega a menos de la mitad de tamaño.
  //
  // Medido sobre el propio OBJ: las góndolas salen de 0,72 m y una de verdad
  // mide 1,80. El mostrador de caja, 0,37 en vez de 1,10. El edificio entero,
  // 2,58 en vez de los seis y pico de una nave con parapeto y letrero.
  //
  // Tres piezas independientes dan factores de 2,4, 2,5 y 3,0: coinciden, así
  // que el modelo está a escala uniforme y solo hay que multiplicarlo. Si los
  // factores hubieran salido dispares, el problema sería otro y esto lo
  // habría tapado.
  //
  // De ahí venía lo de "aparezco volando": la cámara estaba a su altura
  // correcta de 1,65: eran las estanterías las que llegaban a la rodilla. No
  // había nada que corregir en la cámara.
  //
  // Se aplica al cargar y no moviendo la cámara porque de aquí salen también
  // el interior donde se puede caminar, la altura de las luces y las cajas de
  // colisión. Tocando solo la cámara, todo eso seguiría en miniatura.
  const supermercado = await cargarSupermercado(scene, {
    escala: 2.5,
    diagnostico: true,
  });

  // Ya con las medidas del modelo, se planta al jugador dentro de la sala.
  //
  // Se usa el INTERIOR y no el conjunto: el modelo trae un piso de 13,4 m y un
  // edificio de 8,3 × 6,1 dentro de él, así que la mitad de esa superficie es
  // explanada exterior. Colocando desde las medidas del conjunto se aparecía
  // fuera, detrás del muro trasero.
  //
  // Y se le planta recién pasada la puerta de vidrio, no en el centro de la
  // fachada: el turno empieza entrando al local, y el primer cartel que ve es
  // el de la entrada.
  const { interior } = supermercado;
  camara.position.set(PUERTA_X, ALTURA_OJO, interior.maxZ - 0.8);
  camara.setTarget(
    new Vector3((interior.minX + interior.maxX) / 2, ALTURA_OJO - 0.15, interior.minZ)
  );

  // ─── NO SE VUELA ──────────────────────────────────────────────────────
  //
  // Una FreeCamera avanza HACIA DONDE MIRA. Con la vista algo levantada y la
  // tecla de avanzar pulsada, eso es despegar — y no hacía falta ni querer:
  // bastaba caminar mirando un estante alto para ir subiendo sin darse
  // cuenta.
  //
  // Se fija la altura en cada cuadro en vez de activar la gravedad. La
  // gravedad resuelve la caída, pero deja el problema al revés: se sigue
  // pudiendo subir mirando arriba, y luego se cae. Aquí el suelo es uno y
  // plano, así que clavar la altura es más simple y no falla nunca.
  //
  // Mirar arriba y abajo sigue funcionando igual: lo que se anula es el
  // desplazamiento vertical, no la vista.
  //
  // El observador se guarda para quitarlo al salir. Antes no se quitaba: la
  // escena es la misma para todo el curso, así que cada entrada al
  // supermercado dejaba uno más escribiendo sobre una cámara ya destruida.
  const alturaCaminando = camara.position.y;
  const alturaFija = scene.onBeforeRenderObservable.add(() => {
    camara.position.y = alturaCaminando;
  });

  // La bodega no viene en el modelo: se construye. Ver BodegaSupermercado.
  // Antes de las luces, para que sus materiales entren en la ampliación del
  // tope de luces que se hace más abajo.
  const piso = medirPisoSala(scene, supermercado);
  const bodega = construirBodega(scene, camara, piso);
  // La oficina: una puerta con su letrero detrás de la línea de cajas. No la
  // trae el modelo y hasta ahora no existía, aunque cuatro textos del turno
  // hablaran de ella. Ver OficinaSupermercado.
  // Cuatro textos del turno la nombran y hasta ahora el jugador leía "la
  // oficina" sin haber visto nunca una puerta que lo dijera. Y es donde acaba
  // el retenido de la línea de cajas.
  const oficina = construirOficina(scene, piso);
  // El número de cada pasillo, colgado sobre su boca. Central y los paneles
  // hablan del "cuarto pasillo", y sin esto no había forma de saber cuál era.
  colgarLetrerosPasillos(scene, piso, piso + Math.min(supermercado.alto, 5));

  // Los clientes, por lo mismo: su ropa también tiene que entrar en esa
  // ampliación. Ver ClientesSupermercado.
  // Un producto de cada clase, copiado de la góndola: lo que la gente saca del
  // estante es lo mismo que hay en él. Ver ProductosSupermercado.
  const productos = extraerProductos(scene, supermercado.mallas);
  const clientes = crearClientes(scene, camara, piso, productos);

  // Los pasillos se reparten a lo largo del fondo de la sala. Se calculan desde
  // las medidas reales y no a ojo: si Bitplay manda una versión más grande, los
  // focos siguen cayendo donde tienen que caer.
  const pasillos = [-0.28, 0, 0.28].map((f) => supermercado.fondo * f);
  iluminarSupermercado(scene, supermercado.alto, pasillos);
  ampliarLucesSupermercado(scene);

  // ─── LO DE FUERA ──────────────────────────────────────────────────────
  //
  // El estacionamiento, la calle y el barrio de enfrente, con su propio sol.
  // Y al revés: las luces de la sala dejan de alumbrar lo de fuera, que tiene
  // las suyas. Ver ExteriorSupermercado. El edificio del local da sombra
  // fuera: a esta hora tapa el sol de parte del estacionamiento.
  const exterior = construirExterior(
    scene,
    supermercado.mallas.filter((m) => m.name.startsWith("Edificio") || m.name === "Letrero colgante")
  );
  scene.lights
    .filter((luz) => !exterior.luces.includes(luz))
    .forEach((luz) => luz.excludedMeshes.push(...exterior.mallas));

  camara.attachControl(true);

  // --- Post-proceso ---------------------------------------------------------
  //
  // Discreto a propósito. En una sala de ventas no hay nada que florezca ni
  // viñeta que valga: el sitio está para que el producto se vea plano y parejo.
  // Lo único que aporta aquí es el suavizado de bordes, porque las góndolas son
  // todo líneas rectas y sin él se ven en escalera.
  const tuberia = new DefaultRenderingPipeline(
    "postProcesoSupermercado",
    true,
    scene,
    [camara]
  );
  tuberia.samples = 4;
  tuberia.bloomEnabled = false;
  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.contrast = 1.04;
  tuberia.imageProcessing.exposure = 1;
  tuberia.imageProcessing.toneMappingEnabled = true;

  // --- Salir ----------------------------------------------------------------
  const alPulsar = (e: KeyboardEvent): void => {
    if (e.key === "Escape") salir();
  };
  window.addEventListener("keydown", alPulsar);

  let cerrado = false;
  const ayuda = document.createElement("div");
  ayuda.textContent =
    "WASD o flechas para caminar · arrastrar para mirar · ESPACIO para adelantar · ESC para volver";
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
  });
  document.body.appendChild(ayuda);
  // ─── LA BARRA DE CONTROLES SE VA SOLA ──────────────────────────────────
  //
  // Los controles están en la tarjeta del inicio. La barra se queda solo
  // hasta que el jugador echa a andar —ya sabe moverse— o cinco segundos como
  // mucho, y se apaga: fija abajo le quitaba sitio a lo que sí hay que ver
  // mientras se juega —el nombre de la zona, la barra de lo que estás
  // observando—, y se juntaba con todo lo que aparece al empezar el turno.
  // Estuvo en doce segundos y seguía ahí cuando la primera clienta ya te
  // estaba haciendo señas.
  const CONTROLES_A_LA_VISTA_MS = 5000;
  ayuda.style.transition = "opacity 600ms ease";
  let temporizadorAyuda: ReturnType<typeof setTimeout> | undefined;
  const TECLAS_DE_CAMINAR = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const apagarAyuda = (): void => {
    clearTimeout(temporizadorAyuda);
    ayuda.style.opacity = "0";
    window.removeEventListener("keydown", alEcharAAndar);
  };
  const alEcharAAndar = (e: KeyboardEvent): void => {
    if (enMarcha && TECLAS_DE_CAMINAR.includes(e.code)) apagarAyuda();
  };

  // ─── EL TURNO: ZONAS, RONDAS Y RECUENTO ───────────────────────────────
  //
  // Se monta aquí pero NO arranca: comenzar() abre la tarjeta del turno, y el
  // reloj corre cuando se cierra. Montar el escenario y esperar a que compile
  // puede llevar diez segundos, y con el reloj corriendo por detrás el
  // jugador entraría con la primera ronda ya a medias.
  const hud = crearHudRecorrido({
    hora: horaDelTurno(0),
    turno: ETIQUETA_TURNO,
    acento: ACENTO,
  });
  const paneles = crearPanelesTurno(scene);
  const actores = crearActores(scene, camara, clientes, bodega, oficina, piso, productos);
  // La fachada va después de todos los que caminan: la puerta automática se
  // abre para cualquiera de ellos, y al montarla tiene que poder contarlos.
  const fachada = construirFachada(scene, camara, piso);
  exterior.alReflejar((reflejo) => fachada.reflejar(reflejo));

  // ─── ¿LO TIENE DELANTE? ───────────────────────────────────────────────
  //
  // Tres preguntas, de la más barata a la más cara, y en ese orden a propósito:
  // la mayoría de los cuadros se resuelven en la primera.
  //
  //   1. ¿Está cerca? Nueve metros: el largo de un pasillo entero, y lo que se
  //      ve de la línea de cajas desde la entrada. Más allá, una figura son
  //      cuatro píxeles y decir que "la estás mirando" sería falso.
  //   2. ¿Está donde miras? Seis décimas de radián desde el centro de la
  //      pantalla. La cámara abre algo más, pero lo que queda pegado al borde
  //      del encuadre no se está mirando: se tiene delante sin verlo.
  //   3. ¿Hay algo en medio? Un rayo hasta él. Sin esto, una góndola no tapa
  //      nada y el hurto del cuarto pasillo saltaría desde el primero.
  //
  // El rayo ignora los cilindros de los clientes. Son invisibles y están para
  // que no te los atravieses, no para hacer sombra: con ellos contando, un
  // cliente que se cruza por delante cancelaría la situación entera.
  const ALCANCE_VISTA = 9;
  const ANGULO_VISTA = Math.cos(0.6);
  // Tampoco cuentan los choques que solo están para detener el paso —la
  // barrera de la puerta, las antenas antihurto—: no tapan la vista.
  const solido = (malla: AbstractMesh): boolean =>
    malla.checkCollisions && !malla.name.endsWith("_bulto") && !malla.metadata?.soloPaso;

  const aLaVista = (situacion: Situacion): boolean => {
    const punto = actores.de(situacion.id)?.punto();
    if (!punto) return false;

    const ojo = camara.globalPosition;
    const hacia = punto.subtract(ojo);
    const distancia = hacia.length();
    if (distancia < 0.01 || distancia > ALCANCE_VISTA) return false;

    hacia.scaleInPlace(1 / distancia);
    if (Vector3.Dot(camara.getDirection(Vector3.Forward()), hacia) < ANGULO_VISTA) return false;

    // Se queda un pelo corto a propósito: llegando justo, el rayo toca al
    // propio actor —el mostrador de la cajera, la hoja de la puerta— y diría
    // que está tapado por sí mismo.
    const golpe = scene.pickWithRay(new Ray(ojo, hacia, distancia - 0.12), solido);
    return !golpe?.hit;
  };

  /** A qué hora se vio cada situación, para el recuento. */
  const horaVista = new Map<string, number>();
  /** Lo que Central cuenta después se queda a la vista este rato. */
  const RADIO_DESPUES_MS = 9000;

  const situaciones = crearSituaciones({
    alAbrir: (s) => actores.de(s.id)?.empezar(),
    // Sin opción: la ventana venció y nadie la vio. El actor remata como si
    // no hubiera nadie mirando —el de la parka, por ejemplo, se va sin
    // pagar—, y Central cuenta lo que pasó. Es la mitad de "la que no llega a
    // tiempo": sin enterarse después, perdérsela no enseñaba nada, porque el
    // jugador no sabía siquiera que había existido.
    alCerrar: (s) => {
      actores.de(s.id)?.terminar(null);
      if (s.siSePierde && !turnoTerminado && !cerrado) {
        hud.avisarRadio(s.siSePierde, RADIO_DESPUES_MS);
        reproducir("error");
      }
    },
    aLaVista,
    enSuMomento: (s) => actores.de(s.id)?.enSuMomento() ?? true,
    terminada: (s) => actores.de(s.id)?.terminada?.() ?? false,
  });

  // El mismo reloj del condominio, a su misma velocidad. Cuenta minutos de
  // turno desde cero; la hora de pared se pone al mostrarla.
  const reloj = crearRelojTurno(scene, {
    minutoFinal: DURACION_TURNO,
    // ─── MÁS DESPACIO QUE EL CONDOMINIO ─────────────────────────────────
    //
    // 0,7 en vez de 1,1. Las dos horas pasan de 109 segundos reales a 171, y
    // cada minuto de turno dura casi segundo y medio. Estuvo en 0,8 con cinco
    // situaciones; con ocho, y con el aviso de Central mandándote a cada una,
    // hacía falta un poco más de aire entre ir a una y llegar a la siguiente.
    //
    // Estuvo a la velocidad del condominio y no se podía jugar: veías al
    // cliente de la parka, lo seguías hasta la caja, y para cuando cerrabas
    // su tarjeta ya se te había abierto la situación de la cajera encima y la
    // ronda se te había vencido. Todo llegaba a la vez porque no daba tiempo
    // a ir a ningún sitio, y este escenario va de ir a los sitios.
    //
    // No más despacio: con ESPACIO se adelanta, y un turno que se arrastra es
    // tan malo como uno que atropella.
    minutosPorSegundo: 0.7,
    // Al paso de las figuras: si el equipo va lento, el turno y la gente se
    // frenan juntos. Ver pasoMaximo en RelojTurno.
    pasoMaximo: 0.05,
    // ─── LOS HITOS: APERTURAS DE RONDA Y SITUACIONES ────────────────────
    //
    // Cada apertura de ronda frena el adelanto, como las novedades frenan el
    // del condominio: se adelanta hasta la ronda siguiente y ni un minuto más,
    // así que nadie se salta una ronda por tener el dedo en la tecla.
    //
    // Y los minutos de las situaciones, por una razón más fuerte. Adelantando
    // se pasan doce minutos de turno en un segundo, que es justo la ventana
    // entera de una situación: sin este freno, tener la tecla apretada sería
    // saltarse el nivel sin enterarse de que existe. Frenando aquí, el turno
    // vuelve a su velocidad en el minuto en que algo empieza a pasar — no te
    // dice qué ni dónde, pero te devuelve el mando para que puedas llegar.
    //
    // Van ordenados y sin repetidos porque RelojTurno busca el próximo hito
    // recorriendo la lista en orden y devolviendo el primero que queda por
    // delante: desordenada, se saltaría los que quedasen detrás de uno mayor.
    hitos: [
      ...Array.from(
        { length: Math.floor(DURACION_TURNO / MINUTOS_POR_RONDA) },
        (_, i) => (i + 1) * MINUTOS_POR_RONDA
      ),
      ...situaciones.minutos(),
    ]
      .filter((minuto, i, todos) => todos.indexOf(minuto) === i)
      .sort((a, b) => a - b),
    alAvanzar: (minuto) => {
      hud.ponerHora(horaDelTurno(minuto));
      hud.ponerAdelanto(reloj.estaAdelantando());
      rondas.alPasarMinuto(minuto);
      if (minuto >= DURACION_TURNO) {
        terminarTurno();
        return;
      }
    },
  });

  const zonas = crearDetectorZonas((zona) => {
    hud.anunciarZona(zona.nombre, zona.bajada);
    rondas.alEntrarZona(zona.id);
  });

  const nombreDe = (id: IdZona): string => ZONAS.find((z) => z.id === id)?.nombre ?? id;
  const casillas = (hecha: (id: IdZona) => boolean): VistaRonda["zonas"] =>
    ZONAS_DE_RONDA.map((id) => ({ nombre: nombreDe(id), hecha: hecha(id) }));
  const tituloDeRonda = (ronda: RondaEnCurso): string => {
    if (!ronda.completa) {
      return `Ronda ${ronda.numero} de ${ronda.total} · hasta las ${horaDelTurno(ronda.hasta)}`;
    }
    return ronda.numero === ronda.total
      ? `Ronda ${ronda.numero} completa · la última del turno`
      : `Ronda ${ronda.numero} completa · la siguiente a las ${horaDelTurno(ronda.hasta)}`;
  };

  // Todo lo que usa la primera ronda tiene que existir ya: crearRondas la abre
  // en el acto y pinta su lista.
  const rondas = crearRondas({
    duracion: DURACION_TURNO,
    zonaActual: () => zonas.actual()?.id ?? null,
    alCambiar: (ronda) => {
      hud.ponerRonda({
        titulo: tituloDeRonda(ronda),
        estado: ronda.completa ? "completa" : "curso",
        zonas: casillas((id) => ronda.visitadas.has(id)),
      });
      // Una ronda llega completa una sola vez: después ya no admite zonas.
      if (ronda.completa) reproducir("acierto");
    },
    alCerrar: (ronda) => {
      // La última vence con el turno, y de esa da cuenta el recuento.
      if (ronda.completa || ronda.hasta >= DURACION_TURNO) return;
      const faltan = ronda.faltaron.map((id) => nombreDe(id).toLowerCase());
      const cuales =
        faltan.length === 1
          ? `faltó ${faltan[0]}`
          : `faltaron ${faltan.slice(0, -1).join(", ")} y ${faltan[faltan.length - 1]}`;
      hud.avisarRonda(
        {
          titulo: `Ronda ${ronda.numero} incompleta · ${cuales}`,
          estado: "incompleta",
          zonas: casillas((id) => !ronda.faltaron.includes(id)),
        },
        AVISO_RONDA_MS
      );
    },
  });

  let enMarcha = false;
  /** Un respiro antes del primer cartel: que primero se vea la sala. */
  let esperaPrimerCartel = 0.8;
  const seguirZonas = scene.onBeforeRenderObservable.add(() => {
    if (!enMarcha) return;
    // El mismo tope que el reloj y las figuras: lo que se mira se cuenta al
    // mismo paso que se mueve lo mirado.
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    if (esperaPrimerCartel > 0) {
      esperaPrimerCartel -= dt;
      return;
    }
    zonas.actualizar(camara.position.x, camara.position.z, dt);

    // ─── LAS SITUACIONES SE MIRAN, NO SE PISAN ────────────────────────
    //
    // Va aquí, cuadro a cuadro, y no en el cambio de minuto del reloj, porque
    // lo que dispara una situación no es una hora: es que el jugador se pare
    // a mirar lo que está pasando. Eso se mide en segundos reales y hay que
    // preguntarlo cada cuadro.
    //
    // avanzar() hace además lo otro: abre la ventana en su minuto —y con ella
    // arranca el actor, esté el jugador donde esté— y la cierra al vencer.
    const salta = situaciones.avanzar(reloj.minuto(), dt);

    // ─── LO QUE VE EL JUGADOR DE TODO ESTO ────────────────────────────
    //
    // Arriba a la izquierda, los avisos de Central de lo que está pasando y
    // todavía no ha visto: dónde, nunca qué. Suena la radio una vez por aviso.
    // Abajo, la barra de lo que está observando, mientras lo tenga delante.
    const nuevas = hud.ponerPistas(
      situaciones.abiertas().map((s) => ({ clave: s.id, de: s.pista.de, texto: s.pista.texto }))
    );
    if (nuevas.length > 0) reproducir("panel");
    const foco = situaciones.foco();
    hud.ponerMirada(foco ? { fraccion: foco.fraccion, esperando: foco.esperando } : null);

    if (salta) atenderSituacion(salta);
  });

  let comenzado = false;
  /** Cuándo se abrió el servicio. Ver comenzar(). */
  let iniciadoEn = new Date();
  const comenzar = (): void => {
    if (cerrado || comenzado) return;
    comenzado = true;
    // Los clientes echan a andar en cuanto se levanta la pantalla de carga, no
    // al cerrar la tarjeta: al empezar el turno el local ya está en marcha.
    clientes.andar();
    // Ya con cuadros dibujados, que es cuando las cajas envolventes del
    // modelo están donde se ven.
    comprobarPlano(supermercado.mallas);

    // Con la tarjeta delante no se camina. Y sin la cámara escuchando el
    // puntero, el clic llega entero al botón: con ella enganchada, Babylon
    // puede quedarse el POINTERUP y el botón no responde (ver main.ts).
    camara.detachControl();
    paneles.mostrarBriefing(BRIEFING_TURNO, () => {
      if (cerrado) return;
      // El turno empieza al cerrar la tarjeta, no al cargar: es lo que va al
      // historial como inicio del servicio.
      iniciadoEn = new Date();
      camara.attachControl(true);
      hud.mostrar();
      reloj.correr(true);
      enMarcha = true;
      temporizadorAyuda = setTimeout(apagarAyuda, CONTROLES_A_LA_VISTA_MS);
      window.addEventListener("keydown", alEcharAAndar);
    });
  };

  // ─── ADELANTAR ────────────────────────────────────────────────────────
  //
  // ESPACIO adelanta el turno, igual que el botón del libro del condominio:
  // lo pide el jugador y se corta solo al abrir la ronda siguiente (ver los
  // hitos del reloj). Con la ronda hecha no hace falta esperar de brazos
  // cruzados a que abra la próxima.
  const alTeclaTurno = (e: KeyboardEvent): void => {
    // Sin repeticiones: con la tecla apretada, el navegador repite el evento
    // y el adelanto se encendería y apagaría solo.
    if (e.code !== "Space" || e.repeat || !enMarcha) return;
    e.preventDefault();
    reloj.adelantar(!reloj.estaAdelantando());
    hud.ponerAdelanto(reloj.estaAdelantando());
  };
  window.addEventListener("keydown", alTeclaTurno);

  let turnoTerminado = false;

  // ─── UNA SITUACIÓN ────────────────────────────────────────────────────
  //
  // ─── QUÉ QUIERE DECIR "SE CONGELA EL MOMENTO" ─────────────────────────
  //
  // Lo mismo que en el condominio: el reloj se para mientras hay un panel de
  // decisión delante (ver RelojTurno). No es un efecto, es la regla del juego
  // — leer no puede costar minutos de turno, porque entonces lo que se
  // entrena es leer rápido.
  //
  // Y tiene una consecuencia que vale más que el efecto: con el turno parado
  // es IMPOSIBLE que una segunda situación, o el fin del turno, salten encima
  // de esta. Los minutos que quedaran a medias se reanudan donde estaban
  // cuando se cierra la tarjeta, sin perder ninguno.
  //
  // Los clientes siguen caminando por detrás del velo, como los vecinos del
  // hall detrás de los paneles del nivel 1. El velo los deja en penumbra y la
  // sala no se detiene por ti: eso es de la escena, no del panel.
  let situacionEnPantalla = false;

  const atenderSituacion = (situacion: Situacion): void => {
    // El reloj está parado y el detector de zonas solo corre con el turno en
    // marcha, así que esto no debería poder llegar dos veces. Se comprueba
    // igual: es una guarda de una línea contra una tarjeta que se pise a sí
    // misma, que es de las averías que no se ven hasta que alguien graba.
    if (situacionEnPantalla || turnoTerminado || cerrado) return;
    situacionEnPantalla = true;
    horaVista.set(situacion.id, reloj.minuto());
    hud.ponerMirada(null);
    /** Lo que responda, para poder pasárselo al actor al cerrar. */
    let elegida: OpcionSituacion | null = null;

    // El mismo orden que usa la tarjeta del briefing: primero se quita el
    // mando, después se muestra. Al revés, el primer clic sobre una opción
    // puede írsele a la cámara.
    enMarcha = false;
    reloj.correr(false);
    // correr(false) suelta el adelanto por dentro, pero quien lo pinta es el
    // minuto siguiente — y el minuto siguiente no llega, porque el reloj acaba
    // de pararse. Sin esta línea el HUD se queda diciendo "Adelantando »"
    // sobre un turno detenido, y al cerrar la tarjeta sigue diciéndolo hasta
    // que pasa un minuto entero.
    hud.ponerAdelanto(false);
    // Y la sala con él. El reloj parado sin la sala parada era una mentira:
    // el jugador leía "pasa la línea de cajas sin pagar", elegía ir a por él y
    // al cerrar la tarjeta ya había salido por la puerta, porque los diez
    // segundos de lectura los había seguido caminando detrás del velo.
    clientes.congelar(true);
    actores.congelar(true);
    camara.detachControl();
    // El HUD es DOM y va por encima del lienzo: con la tarjeta abierta se
    // solaparían el reloj de arriba y el borde superior de la tarjeta.
    hud.ocultar();

    paneles.mostrarSituacion(
      {
        // La hora de AHORA, no la del minuto en que la situación abrió su
        // ventana. Una la ves cuando pasas por ahí, que puede ser diez minutos
        // después de que empezara; y la encadenada del hurto no tiene minuto
        // propio siquiera —ocurre cuando contestas la del pasillo—. El rótulo
        // de un parte dice cuándo lo estás viendo.
        rotulo: `${horaDelTurno(reloj.minuto())} · ${situacion.actividad}`,
        aviso: situacion.aviso,
        opciones: situacion.opciones,
      },
      (opcion) => {
        situaciones.resolver(situacion, opcion, reloj.minuto());
        elegida = opcion;
        reproducir(opcion.correcta ? "acierto" : "error");
      },
      () => {
        situacionEnPantalla = false;
        clientes.congelar(false);
        actores.congelar(false);
        // Ahora sí se le dice al actor que pare, y no al saltar el panel: así
        // el momento se queda congelado mientras se lee, y la sala vuelve a
        // moverse cuando vuelve el turno. Ver el comentario de avanzar().
        //
        // Y se le dice CON QUÉ se respondió, que es lo que le permite rematar
        // distinto: al de la parka verde se lo llevan adentro si lo abordaste,
        // y sale por la puerta si lo dejaste ir.
        actores.de(situacion.id)?.terminar(elegida);
        // Salir con ESC o que el turno se acabara mientras leías: no se
        // devuelve el mando de una escena que ya se está desmontando.
        if (cerrado || turnoTerminado) return;
        camara.attachControl(true);
        hud.mostrar();
        // Lo que cambió en la sala por lo que elegiste, contado por Central:
        // si fuiste a la oficina, el de la parka se te fue.
        if (elegida?.despues) {
          hud.avisarRadio(elegida.despues, RADIO_DESPUES_MS);
          reproducir("error");
        }
        reloj.correr(true);
        enMarcha = true;
      }
    );
  };

  /**
   * Las situaciones del turno para el recuento, en orden de hora.
   *
   * Solo las que llegaron a ocurrir: la segunda parte del hurto no sale si no
   * se respondió observar, porque no es que no la vieras, es que no pasó.
   */
  const filasSituaciones = (): FilaSituacion[] => {
    const respuestas = situaciones.atendidas();
    return situaciones
      .ocurridas()
      .map((s) => {
        const r = respuestas.find((x) => x.situacion.id === s.id);
        const minuto = horaVista.get(s.id) ?? s.minuto;
        const fila: FilaSituacion = {
          hora: horaDelTurno(minuto),
          actividad: s.actividad,
          resultado: !r ? "perdida" : r.opcion.correcta ? "correcta" : "incorrecta",
          inocente: !!s.inocente,
        };
        return { minuto, fila };
      })
      .sort((a, b) => a.minuto - b.minuto)
      .map((x) => x.fila);
  };

  /** Fin del turno: nada se mueve y sale el recuento. */
  const terminarTurno = (): void => {
    if (turnoTerminado || cerrado) return;
    turnoTerminado = true;
    enMarcha = false;
    reloj.correr(false);
    camara.detachControl();
    hud.ocultar();

    // ─── LA NOTA, Y AL HISTORIAL ANTES DE DIBUJAR NADA ───────────────────
    //
    // Igual que el condominio: el turno queda registrado antes de pintar el
    // informe. Si la pantalla fallara, el desempeño ya está guardado; lo que
    // no puede perderse es el intento, no el cartel que lo muestra. Y con el
    // registro, el menú ya puede dar el supermercado por aprobado.
    const calificacion = calificarTurno(situaciones.ocurridas(), situaciones.atendidas(), rondas.cerradas());
    const { guardado } = registrarTurno({
      usuario,
      curso: "guardias",
      escenario: 2,
      iniciadoEn,
      nota: calificacion.nota,
      faltas: calificacion.faltas,
      decisiones: calificacion.decisiones,
    });
    const enInforme = (e: ErrorTurno): ErrorEnInforme => ({
      hora: horaDelTurno(e.minuto),
      actividad: e.actividad,
      enBreve: e.enBreve,
    });

    paneles.mostrarRecuento(
      {
        rotulo: `${horaDelTurno(DURACION_TURNO)} · FIN DEL TURNO`,
        rondas: rondas.cerradas(),
        horas: [horaDelTurno(0), horaDelTurno(DURACION_TURNO / 2), horaDelTurno(DURACION_TURNO)],
        nota: NOTA_RECUENTO,
        situaciones: filasSituaciones(),
        notaSituaciones: NOTA_RECUENTO_SITUACIONES,
        informe: {
          nota: calificacion.nota,
          aprobado: calificacion.aprobado,
          minimo: NOTA_APROBACION,
          guardado,
          frase: calificacion.frase,
          dejastePasar: calificacion.dejastePasar.map(enInforme),
          sinMotivo: calificacion.sinMotivo.map(enInforme),
          descuentos: {
            dejarPasar: DESCUENTOS.dejarPasar,
            sinMotivo: DESCUENTOS.sinMotivo,
            ronda: DESCUENTOS.rondaIncompleta,
          },
          rondas: calificacion.rondas,
        },
      },
      () => salir()
    );
  };

  /**
   * Sale del recorrido y devuelve el menú.
   *
   * ─── POR QUÉ DESMONTA TODO ANTES DE AVISAR ────────────────────────────
   *
   * Porque antes no lo hacía: soltaba el ratón de la cámara y llamaba al menú
   * dejando la escena tal cual. El resultado era que el menú se dibujaba
   * encima del supermercado, sobre su fondo azul, con el cartel de ayuda
   * todavía pegado abajo — y los quince megas del modelo seguían en memoria.
   *
   * El orden importa: primero se suelta el mando, después se desmonta la
   * escena, después se devuelve el color de fondo del portal, y solo entonces
   * se avisa. Avisar antes deja al menú montándose sobre una escena que se
   * está destruyendo debajo.
   */
  const salir = (): void => {
    if (cerrado) return;
    cerrado = true;
    window.removeEventListener("keydown", alPulsar);
    window.removeEventListener("keydown", alTeclaTurno);
    camara.detachControl();

    apagarAyuda();
    ayuda.remove();
    scene.onBeforeRenderObservable.remove(alturaFija);
    scene.onBeforeRenderObservable.remove(seguirZonas);
    reloj.dispose();
    hud.dispose();
    paneles.dispose();
    clientes.dispose();
    actores.dispose();
    fachada.dispose();
    bodega.dispose();
    tuberia.dispose();
    // limpiarEscena deja además una cámara neutra y el fondo del portal, así
    // que el menú aparece sobre algo dibujable y con su color de siempre.
    limpiarEscena(scene);

    onSalir();
  };


  return {
    supermercado,
    comenzar,
    // salir() ya desmonta la escena entera, así que esto es solo el atajo por
    // si alguien cierra el recorrido desde fuera sin pasar por ESC.
    dispose: salir,
  };
}