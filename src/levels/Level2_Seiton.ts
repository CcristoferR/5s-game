import { Scene, MeshBuilder } from "@babylonjs/core";
import { objetosNivel2, slotsNivel2, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearShelfSlot } from "../entities/ShelfSlot";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearFormaNivel2 } from "../entities/Level2Shapes";
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

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "sueloN2" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("sueloN2", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // Banco de trabajo compartido con el Nivel 1. Un poco más ancho acá porque
  // arranca con 7 objetos repartidos en dos filas.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN2", ancho: 4.8, fondo: 1.5, z: -0.5 });

  const objetos = objetosNivel2.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel2));
  const slots = slotsNivel2.map((s) => crearShelfSlot(scene, gui, s.id, s.posicionX, s.descripcion));

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
  let distanciaTotalRecorrida = 0;

  objetos.forEach((objeto) => {
    objeto.onSoltar.add(({ mesh, movioSuficiente, distancia }) => {
      if (!movioSuficiente) return;

      distanciaTotalRecorrida += distancia;

      const slotMasCercano = slotsNivel2.reduce((mejor, actual) =>
        Math.abs(mesh.position.x - actual.posicionX) < Math.abs(mesh.position.x - mejor.posicionX) ? actual : mejor
      );

      const esCorrecto = slotMasCercano.id === objeto.datos.slotCorrectoId;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        hud.mostrarFeedback(true, objeto.datos.explicacion);
        mesh.isPickable = false;
        objetosResueltos++;

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

          setTimeout(() => {
            hud.mostrarResultadoFinal("Nivel 2", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
          }, 1600);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);

        // Fricción visual: el objeto "rebota" al no encajar — refuerza
        // sin palabras que ese no es su lugar, tal como pide la guía
        // ("ubicar mal genera fricción visual").
        mesh.scaling.setAll(0.85);
        setTimeout(() => mesh.scaling.setAll(1.1), 90);
        setTimeout(() => mesh.scaling.setAll(1), 180);
      }
    });
  });

  return { objetos, slots };
}

// Micro-lección: explica qué es un "shadow board" antes de jugar — el
// mismo tratamiento que le dimos a la tarjeta roja en el Nivel 1.