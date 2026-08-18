import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { objetosNivel1, type ZonaClasificacion } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearDropZone } from "../entities/DropZone";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

// Posiciones X de cada zona — deben calzar con las que usa crearDropZone
// en este mismo archivo, es la referencia contra la que se evalúa el soltar.
const posicionesZonas: Record<ZonaClasificacion, number> = {
  necesario: -2,
  dudoso: 0,
  descartar: 2,
};

export function cargarNivel1(scene: Scene, hud: HUD) {
  const gameManager = GameManager.getInstance();

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

  const objetos = objetosNivel1.map((datos) => crearObjetoInteractable(scene, datos));

  const zonaNecesario = crearDropZone(scene, "necesario", posicionesZonas.necesario, new Color3(0.2, 0.7, 0.3));
  const zonaDudoso = crearDropZone(scene, "dudoso", posicionesZonas.dudoso, new Color3(0.85, 0.7, 0.15));
  const zonaDescartar = crearDropZone(scene, "descartar", posicionesZonas.descartar, new Color3(0.75, 0.2, 0.2));

  let objetosResueltos = 0;

  objetos.forEach((objeto) => {
    objeto.onSoltar.add((mesh) => {
      // Encuentra la zona más cercana en X — no necesita tocarla exacto.
      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaClasificacion, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === objeto.datos.zonaCorrecta;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        hud.mostrarFeedback(true, objeto.datos.explicacion);
        mesh.isPickable = false; // decisión tomada — ya no se puede volver a mover
        objetosResueltos++;

        if (objetosResueltos === objetos.length) {
          hud.mostrarFeedback(true, `¡Nivel completado! Puntaje final: ${gameManager.puntaje}`);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);
      }
    });
  });

  return { objetos, zonas: [zonaNecesario, zonaDudoso, zonaDescartar] };
}