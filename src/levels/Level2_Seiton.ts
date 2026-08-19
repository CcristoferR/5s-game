import { Scene, MeshBuilder, PBRMaterial, Color3 } from "@babylonjs/core";
import { objetosNivel2, slotsNivel2 } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearShelfSlot } from "../entities/ShelfSlot";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { crearFormaNivel2 } from "../entities/Level2Shapes";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel2(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN2", { width: 10, height: 10 }, scene);
  const matSuelo = new PBRMaterial("matSueloN2", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN2", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorioN2", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const objetos = objetosNivel2.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel2));
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
    objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente) return;

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
          onCompletado();
          hud.mostrarResultadoFinal("Nivel 2", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);
      }
    });
  });

  return { objetos, slots };
}