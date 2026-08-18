import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { objetosNivel2, slotsNivel2 } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearShelfSlot } from "../entities/ShelfSlot";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel2(scene: Scene, hud: HUD) {
  const gameManager = GameManager.getInstance();
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("labelsNivel2", true, scene);

  const suelo = MeshBuilder.CreateGround("sueloN2", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSueloN2", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN2", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorioN2", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;

  const objetos = objetosNivel2.map((datos) => crearObjetoInteractable(scene, datos));
  const slots = slotsNivel2.map((s) => crearShelfSlot(scene, gui, s.id, s.posicionX, s.descripcion));

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let objetosResueltos = 0;

  objetos.forEach((objeto) => {
    objeto.onSoltar.add((mesh) => {
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
          const bonusTiempo = Math.max(0, 60 - segundosTotales);
          gameManager.sumarPuntos(bonusTiempo);
          hud.mostrarResultadoFinal(objetosResueltos * 10, bonusTiempo, segundosTotales);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);
      }
    });
  });

  return { objetos, slots };
}