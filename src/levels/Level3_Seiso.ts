import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { manchasNivel3, preguntaCausaNivel3, opcionesCausaNivel3 } from "../data/levelConfig";
import { crearMancha } from "../entities/Stain";
import { mostrarPanelOpciones } from "../ui/ChoicePanel";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel3(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();

  const suelo = MeshBuilder.CreateGround("sueloN3", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSueloN3", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN3", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorioN3", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let manchasLimpias = 0;

  manchasNivel3.forEach((datos) => {
    const { onLimpia } = crearMancha(scene, datos.id, datos.posicion[0], datos.posicion[1]);

    onLimpia.add(() => {
      gameManager.sumarPuntos(5);
      manchasLimpias++;

      if (manchasLimpias === manchasNivel3.length) {
        const panelOpciones = mostrarPanelOpciones(scene, preguntaCausaNivel3, opcionesCausaNivel3, (idElegido) => {
          const opcion = opcionesCausaNivel3.find((o) => o.id === idElegido)!;

          if (opcion.esCorrecta) {
            panelOpciones.ocultar();
            gameManager.sumarPuntos(20);
            hud.mostrarFeedback(true, opcion.explicacion);
            corriendoTiempo = false;
            const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
            const bonusTiempo = Math.max(0, 60 - segundosTotales);
            gameManager.sumarPuntos(bonusTiempo);
            onCompletado();
            hud.mostrarResultadoFinal("Nivel 3", manchasLimpias * 5 + 20, bonusTiempo, segundosTotales, onVolverMenu);
          } else {
            hud.mostrarFeedback(false, opcion.explicacion);
          }
        });
      }
    });
  });

  return {};
}