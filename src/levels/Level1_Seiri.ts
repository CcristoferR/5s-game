import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { objetosNivel1, type ZonaClasificacion } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearDropZone } from "../entities/DropZone";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { crearFormaNivel1 } from "../entities/Level1Shapes";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const posicionesZonas: Record<ZonaClasificacion, number> = {
  necesario: -2,
  dudoso: 0,
  descartar: 2,
};

const etiquetasZonas: Record<ZonaClasificacion, string> = {
  necesario: "NECESARIO",
  dudoso: "DUDOSO",
  descartar: "DESCARTAR",
};

export function cargarNivel1(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("labelsNivel1", true, scene);

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("suelo", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSuelo", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorio", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorio", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const objetos = objetosNivel1.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel1));

  const zonaNecesario = crearDropZone(scene, "necesario", posicionesZonas.necesario, new Color3(0.2, 0.7, 0.3), gui, etiquetasZonas.necesario);
  const zonaDudoso = crearDropZone(scene, "dudoso", posicionesZonas.dudoso, new Color3(0.85, 0.7, 0.15), gui, etiquetasZonas.dudoso);
  const zonaDescartar = crearDropZone(scene, "descartar", posicionesZonas.descartar, new Color3(0.75, 0.2, 0.2), gui, etiquetasZonas.descartar);

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
      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaClasificacion, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === objeto.datos.zonaCorrecta;

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
          hud.mostrarResultadoFinal("Nivel 1", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);
      }
    });
  });

  return { objetos, zonas: [zonaNecesario, zonaDudoso, zonaDescartar] };
}