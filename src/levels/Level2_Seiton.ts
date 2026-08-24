import { Scene, MeshBuilder } from "@babylonjs/core";
import { Rectangle, TextBlock, Button, Control } from "@babylonjs/gui";
import { objetosNivel2, slotsNivel2 } from "../data/levelConfig";
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

  mostrarMicroLeccionShadowBoard(gui);

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

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
function mostrarMicroLeccionShadowBoard(gui: import("@babylonjs/gui").AdvancedDynamicTexture): void {
  const panel = new Rectangle("microLeccionShadowBoard");
  panel.width = "460px";
  panel.height = "220px";
  panel.cornerRadius = 14;
  panel.thickness = 1;
  panel.color = "rgba(255,255,255,0.2)";
  panel.background = "rgba(18, 20, 24, 0.95)";
  panel.zIndex = 25;
  gui.addControl(panel);

  const titulo = new TextBlock("tituloMicroLeccionN2", "🖼️ ¿Qué es un shadow board?");
  titulo.color = "white";
  titulo.fontSize = 19;
  titulo.top = "-70px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(titulo);

  const texto = new TextBlock(
    "textoMicroLeccionN2",
    "Es un tablero con el contorno de cada herramienta pintado — así cualquiera nota de inmediato si algo falta o está fuera de su lugar, sin tener que leer nada."
  );
  texto.color = "rgba(255,255,255,0.9)";
  texto.fontSize = 14;
  texto.textWrapping = true;
  texto.width = "400px";
  texto.top = "0px";
  texto.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(texto);

  const boton = Button.CreateSimpleButton("btnCerrarMicroLeccionN2", "Entendido");
  boton.width = "160px";
  boton.height = "42px";
  boton.color = "white";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = "#2e7d46";
  boton.top = "-16px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    panel.isVisible = false;
  });
  panel.addControl(boton);
}