import { Scene, MeshBuilder, PBRMaterial, Color3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Control } from "@babylonjs/gui";
import { manchasNivel3, preguntaCausaNivel3, opcionesCausaNivel3 } from "../data/levelConfig";
import { crearMancha } from "../entities/Stain";
import { crearMaquinaConFuga } from "../entities/OilMachine";
import { mostrarPanelOpciones } from "../ui/ChoicePanel";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel3(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("labelsNivel3", true, scene);

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN3", { width: 10, height: 10 }, scene);
  const matSuelo = new PBRMaterial("matSueloN3", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN3", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorioN3", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const maquina = crearMaquinaConFuga(scene, 2.0, -0.3);

  const instruccion = new TextBlock("instruccionNivel3", "🧽 Haz click varias veces sobre cada mancha para limpiarla");
  instruccion.color = "white";
  instruccion.fontSize = 16;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const progreso = new TextBlock("progresoNivel3", `Manchas limpias: 0/${manchasNivel3.length}`);
  progreso.color = "white";
  progreso.fontSize = 15;
  progreso.outlineWidth = 3;
  progreso.outlineColor = "rgba(0,0,0,0.6)";
  progreso.top = "100px";
  progreso.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(progreso);

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
      progreso.text = `Manchas limpias: ${manchasLimpias}/${manchasNivel3.length}`;

      if (manchasLimpias === manchasNivel3.length) {
        instruccion.isVisible = false;
        progreso.isVisible = false;

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

  return { maquina };
}