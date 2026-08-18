import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";
import { itemsNivel4, type ZonaChecklist } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearDropZone } from "../entities/DropZone";
import { crearNPCWorker } from "../entities/NPCWorker";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const posicionesZonas: Record<ZonaChecklist, number> = {
  checklist: -2,
  descartar: 2,
};

export function cargarNivel4(scene: Scene, hud: HUD) {
  const gameManager = GameManager.getInstance();

  const suelo = MeshBuilder.CreateGround("sueloN4", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSueloN4", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN4", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorioN4", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;

  const items = itemsNivel4.map((datos) => crearObjetoInteractable(scene, datos));

  const zonaChecklist = crearDropZone(scene, "checklist", posicionesZonas.checklist, new Color3(0.2, 0.7, 0.3));
  const zonaDescartar = crearDropZone(scene, "descartar", posicionesZonas.descartar, new Color3(0.75, 0.2, 0.2));

  const npc = crearNPCWorker(scene);

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let itemsResueltos = 0;

  items.forEach((item) => {
    item.onSoltar.add((mesh) => {
      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaChecklist, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === item.datos.zonaCorrecta;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        hud.mostrarFeedback(true, item.datos.explicacion);
        mesh.isPickable = false;
        itemsResueltos++;

        if (itemsResueltos === items.length) {
          corriendoTiempo = false;
          // "Prueba" del estándar: el NPC camina hasta el checklist ya
          // armado — como el checklist quedó bien clasificado, la prueba
          // siempre resulta exitosa; el desafío real ya ocurrió al elegir.
          npc.caminarHacia(new Vector3(posicionesZonas.checklist, 0.6, 1.8), 2, () => {
            const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
            const bonusTiempo = Math.max(0, 60 - segundosTotales);
            gameManager.sumarPuntos(bonusTiempo);
            hud.mostrarResultadoFinal(itemsResueltos * 10, bonusTiempo, segundosTotales);
          });
        }
      } else {
        hud.mostrarFeedback(false, item.datos.explicacion);
      }
    });
  });

  return { items, zonas: [zonaChecklist, zonaDescartar] };
}