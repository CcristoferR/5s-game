import { Scene, MeshBuilder, Vector3 } from "@babylonjs/core";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { objetosNivel2, slotsNivel2, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearShelfSlot } from "../entities/ShelfSlot";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearFormaNivel2 } from "../entities/Level2Shapes";
import { moverMalla, luegoDe } from "../core/Animacion";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel2(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // ESCENARIO: el mismo garaje del Nivel 1, para que el jugador sienta que
  // sigue trabajando en el espacio que empezó a ordenar y no en otro lugar.
  // La carga es asíncrona: los objetos del nivel se crean igual y el garaje
  // aparece un instante después.
  //
  // A propósito NO se le pasa el shadowGenerator: el garaje tiene techo, y si
  // el techo proyectara la sombra de la luz direccional dejaría todo el
  // interior a oscuras. La luz de adentro la resuelve iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel2] garaje:", error));
  iluminarInteriorGaraje(scene, [{ z: -0.5, intensidad: 0.9 }, { z: 1.8, intensidad: 0.75 }]);

  // Utileria de fondo. Ver AmbienteNivel.ts: la cantidad y el tipo cambian
  // por nivel para acompanar lo que ensena cada S.
  ambientarNivel(scene, 2);

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "sueloN2" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("sueloN2", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // Banco de trabajo compartido con el Nivel 1. Un poco más ancho acá porque
  // arranca con 7 objetos repartidos en dos filas.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN2", ancho: 4.8, fondo: 1.5, z: -0.5 });

  // Geometría de las estaciones, tomada de ShelfSlot: la tabla está centrada en
  // z = 1.8 y el panel vertical se levanta detrás, en z = 2.35.
  const Z_ESTACION = 1.8;
  const ALTURA_REPISA = 0.945;

  // Recinto de arrastre.
  //
  // El tope en z frena las herramientas justo delante del panel de las
  // estaciones. Sin esto el arrastre es un plano infinito y la herramienta
  // atraviesa el panel de lado a lado, como si el mueble no existiera. Los
  // topes en x evitan que un objeto termine dentro de una pared del garaje,
  // desde donde ya no se puede recuperar.
  const limitesArrastre = { xMin: -4.3, xMax: 4.3, zMin: -1.7, zMax: Z_ESTACION + 0.42 };

  const objetos = objetosNivel2.map((datos) =>
    crearObjetoInteractable(scene, datos, crearFormaNivel2, limitesArrastre)
  );

  // Realce al pasar el cursor, solo sobre los objetos agarrables. Acá pesa
  // más que en el Nivel 1: el jugador no decide QUÉ es cada objeto sino
  // DÓNDE va, así que distinguir de un vistazo lo que se puede mover de lo
  // que es mobiliario le ahorra probar pieza por pieza.
  const realce = habilitarRealceAlPasar(scene, objetos.map((o) => o.mesh));
  const slots = slotsNivel2.map((s) => crearShelfSlot(scene, gui, s.id, s.posicionX, s.descripcion));

  // Nombre y resalte al pasar el cursor, igual que en el Nivel 1. Acá importa
  // incluso más: el jugador no decide QUÉ es cada objeto sino DÓNDE va, y para
  // eso necesita identificarlo sin dudar.
  habilitarEtiquetasAlPasar(
    scene,
    gui,
    objetos.map((objeto) => ({ mesh: objeto.mesh, texto: objeto.datos.nombreVisible }))
  );

  // APERTURA DEL NIVEL
  //
  // Primero se plantea la situación y la decisión a resolver, después el
  // concepto de la fase, y recién al cerrar todo eso empieza a correr el
  // nivel. Por eso el cronómetro arranca en false y se reinicia dentro de
  // arrancarNivel: si contara desde la carga, el tiempo de lectura entraría
  // en el puntaje y leer el contexto saldría caro.
  let inicioNivel = performance.now();
  let corriendoTiempo = false;

  function arrancarNivel(): void {
    // El cronómetro del ranking arranca junto con el del nivel: leer la
    // apertura no cuenta como tiempo de juego.
    GameManager.getInstance().iniciarCronometroNivel();
    inicioNivel = performance.now();
    corriendoTiempo = true;
  }

  mostrarAperturaNivel(
    scene,
    2,
    briefingsNiveles[2],
    microLeccionesNiveles[2],
    arrancarNivel
  );

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let objetosResueltos = 0;

  // Progreso en el panel: la cuenta ya existía para calcular el puntaje, solo
  // no se estaba mostrando mientras se jugaba.
  hud.definirTotalTarea(objetos.length);
  let distanciaTotalRecorrida = 0;

  // Cuántas herramientas ya se guardaron en cada estación.
  //
  // Hay más objetos que estaciones (siete en cuatro), así que a varias les
  // toca más de uno. Sin llevar la cuenta, el segundo se encajaría exactamente
  // encima del primero y parecería que desapareció.
  const guardadosPorSlot = new Map<string, number>();

  /** Punto exacto de la repisa donde se acomoda la herramienta. */
  const lugarEnEstacion = (posicionX: number, yaGuardados: number): Vector3 =>
    new Vector3(posicionX, ALTURA_REPISA, Z_ESTACION + (yaGuardados === 0 ? -0.2 : 0.22));

  objetos.forEach((objeto) => {
    // Al agarrar otro objeto el jugador ya pasó a lo siguiente: se apaga el
    // mensaje anterior para dejar la pantalla limpia y que el resultado de
    // ESTA acción se lea sin competencia.
    objeto.onAgarrar.add(() => hud.ocultarFeedback());

    objeto.onSoltar.add(({ mesh, movioSuficiente, distancia }) => {
      if (!movioSuficiente) return;

      distanciaTotalRecorrida += distancia;

      const slotMasCercano = slotsNivel2.reduce((mejor, actual) =>
        Math.abs(mesh.position.x - actual.posicionX) < Math.abs(mesh.position.x - mejor.posicionX) ? actual : mejor
      );

      const esCorrecto = slotMasCercano.id === objeto.datos.slotCorrectoId;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        // Las partículas brotan del objeto recién soltado, no del centro de la
        // pantalla: así premian ESA decisión y no el hecho de haber hecho algo.
        hud.mostrarFeedback(true, objeto.datos.explicacion, mesh.position.clone());
        // fijar() en vez de isPickable: desmonta el arrastre y apaga tambien las
        // piezas hijas. Con isPickable solo en la raiz, hacer clic en una pieza
        // hija volvia a habilitar el arrastre de un objeto ya resuelto.
        objeto.fijar();
        // Deja de realzarse: ya no se puede agarrar, y seguir marcándolo
        // como agarrable sería mentir.
        realce.quitar(objeto.mesh);

        // Encaje animado en la silueta, igual que en el Nivel 1: la herramienta
        // se acomoda sola en su lugar en vez de quedar donde cayó. Es el gesto
        // que enseña el nivel — un lugar para cada cosa, y cada cosa en su lugar.
        const yaGuardados = guardadosPorSlot.get(slotMasCercano.id) ?? 0;
        guardadosPorSlot.set(slotMasCercano.id, yaGuardados + 1);
        moverMalla(scene, mesh, lugarEnEstacion(slotMasCercano.posicionX, yaGuardados), 300);

        objetosResueltos++;
        hud.actualizarProgreso(objetosResueltos);

        if (objetosResueltos === objetos.length) {
          corriendoTiempo = false;
          const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
          // Recalibrado: con 7 objetos (antes 4), completar rápido toma más tiempo real.
          const bonusTiempo = Math.max(0, 100 - segundosTotales);
          gameManager.sumarPuntos(bonusTiempo);
          onCompletado();

          // Nod a "eficiencia de ubicación" que pide la guía: la distancia
          // total de ajuste es una medida lúdica de qué tan directo fuiste
          // al mover cada objeto a su lugar.
          hud.mostrarFeedback(
            true,
            `¡Estante organizado! Distancia total de ajuste: ${distanciaTotalRecorrida.toFixed(1)}m — mientras menor, más eficiente tu búsqueda.`
          );

          luegoDe(scene, 1000, () => {
            // Pregunta de cierre: plantea un caso nuevo y pide aplicar el
            // criterio que el nivel acaba de hacer practicar. El resultado se
            // muestra recién después de responderla.
            preguntarCierreDeNivel(gui, hud, 2, (cierre) => {
              // El panel sale enseguida. La explicación de la pregunta viaja adentro
              // de él, así que ya no hay que esperar a que se apague ningún cartel:
              // esta pausa es solo para que el cierre no se sienta abrupto.
              luegoDe(scene, 700, () => {
                hud.mostrarResultadoFinal("Nivel 2", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu, cierre);
              });
            });
          });
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion, mesh.position.clone());

        // Fricción visual: el objeto "rebota" al no encajar — refuerza
        // sin palabras que ese no es su lugar, tal como pide la guía
        // ("ubicar mal genera fricción visual").
        mesh.scaling.setAll(0.85);
        setTimeout(() => mesh.scaling.setAll(1.1), 90);
        luegoDe(scene, 180, () => {
          mesh.scaling.setAll(1);
          // Después del rebote vuelve a su sitio en el banco. Antes se quedaba
          // apoyado sobre la estación equivocada, y a los pocos errores las
          // repisas mostraban herramientas que en realidad no estaban guardadas.
          moverMalla(scene, mesh, new Vector3(...objeto.datos.posicionInicial), 300);
        });
      }
    });
  });

  return { objetos, slots };
}

// Micro-lección: explica qué es un "shadow board" antes de jugar — el
// mismo tratamiento que le dimos a la tarjeta roja en el Nivel 1.