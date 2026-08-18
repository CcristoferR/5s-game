import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Control } from "@babylonjs/gui";
import { itemsNivel4, type ZonaChecklist } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearFormaNivel4 } from "../entities/Level4Shapes";
import { crearTableroChecklist, crearPapeleraDescartar } from "../entities/ChecklistZones";
import { crearNPCWorker } from "../entities/NPCWorker";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const posicionesZonas: Record<ZonaChecklist, number> = {
  checklist: -3.6,
  descartar: 3.6,
};

export function cargarNivel4(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("labelsNivel4", true, scene);

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN4", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSueloN4", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN4", { width: 4.6, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorioN4", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const items = itemsNivel4.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel4));

  // Etiqueta de cada instrucción, con altura alternada (par/impar) para
  // que dos etiquetas vecinas nunca queden a la misma altura en pantalla
  // — así aunque los ítems se vean algo cerca, el texto nunca se pisa.
  items.forEach((item, i) => {
    const etiqueta = new TextBlock(`etiquetaItem_${item.datos.id}`, item.datos.textoVisible);
    etiqueta.color = "white";
    etiqueta.fontSize = 12;
    etiqueta.textWrapping = true;
    etiqueta.width = "150px";
    etiqueta.height = "55px";
    etiqueta.outlineWidth = 4;
    etiqueta.outlineColor = "rgba(0,0,0,0.85)";
    gui.addControl(etiqueta);
    etiqueta.linkWithMesh(item.mesh);
    etiqueta.linkOffsetY = i % 2 === 0 ? -45 : -85;
  });

  const tableroChecklist = crearTableroChecklist(scene, posicionesZonas.checklist);
  const papeleraDescartar = crearPapeleraDescartar(scene, posicionesZonas.descartar);

  // Rótulo grande sobre cada zona — antes no decían qué eran, y era
  // exactamente lo que hacía imposible saber dónde soltar cada tarjeta.
  const etiquetaChecklist = new TextBlock("etiquetaZonaChecklist", "✅ CHECKLIST\n(instrucciones claras)");
  etiquetaChecklist.color = "white";
  etiquetaChecklist.fontSize = 16;
  etiquetaChecklist.outlineWidth = 4;
  etiquetaChecklist.outlineColor = "rgba(0,0,0,0.85)";
  etiquetaChecklist.width = "160px";
  etiquetaChecklist.height = "50px";
  gui.addControl(etiquetaChecklist);
  etiquetaChecklist.linkWithMesh(tableroChecklist);
  etiquetaChecklist.linkOffsetY = -90;

  const etiquetaDescartar = new TextBlock("etiquetaZonaDescartar", "🗑️ DESCARTAR\n(ambiguas o irrelevantes)");
  etiquetaDescartar.color = "white";
  etiquetaDescartar.fontSize = 16;
  etiquetaDescartar.outlineWidth = 4;
  etiquetaDescartar.outlineColor = "rgba(0,0,0,0.85)";
  etiquetaDescartar.width = "170px";
  etiquetaDescartar.height = "50px";
  gui.addControl(etiquetaDescartar);
  etiquetaDescartar.linkWithMesh(papeleraDescartar);
  etiquetaDescartar.linkOffsetY = -70;

  const instruccion = new TextBlock("instruccionNivel4", "📋 Arrastra cada tarjeta al CHECKLIST (izquierda) o a DESCARTAR (derecha)");
  instruccion.color = "white";
  instruccion.fontSize = 15;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const npc = crearNPCWorker(scene);

  const etiquetaNpc = new TextBlock("etiquetaNpc", "🧪 Probando el estándar...");
  etiquetaNpc.color = "white";
  etiquetaNpc.fontSize = 14;
  etiquetaNpc.outlineWidth = 3;
  etiquetaNpc.outlineColor = "rgba(0,0,0,0.6)";
  etiquetaNpc.width = "180px";
  etiquetaNpc.height = "24px";
  etiquetaNpc.isVisible = false;
  gui.addControl(etiquetaNpc);
  etiquetaNpc.linkWithMesh(npc.mesh);
  etiquetaNpc.linkOffsetY = -50;

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
          instruccion.isVisible = false;
          etiquetaNpc.isVisible = true;
          npc.caminarHacia(new Vector3(posicionesZonas.checklist, 0.6, 1.8), 2, () => {
            etiquetaNpc.isVisible = false;
            const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
            const bonusTiempo = Math.max(0, 60 - segundosTotales);
            gameManager.sumarPuntos(bonusTiempo);
            onCompletado();
            hud.mostrarResultadoFinal("Nivel 4", itemsResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
          });
        }
      } else {
        hud.mostrarFeedback(false, item.datos.explicacion);
      }
    });
  });

  return { items, zonas: [tableroChecklist, papeleraDescartar] };
}