import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { objetosNivel1 } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearDropZone } from "../entities/DropZone";

// Arma la escena del Nivel 1: escritorio, objetos y las 3 zonas de
// clasificación. Lee los datos desde levelConfig.ts — no tiene ningún
// objeto "hardcodeado" acá.
export function cargarNivel1(scene: Scene) {
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

  const zonaNecesario = crearDropZone(scene, "necesario", -2, new Color3(0.2, 0.7, 0.3));
  const zonaDudoso = crearDropZone(scene, "dudoso", 0, new Color3(0.85, 0.7, 0.15));
  const zonaDescartar = crearDropZone(scene, "descartar", 2, new Color3(0.75, 0.2, 0.2));

  return { objetos, zonas: [zonaNecesario, zonaDudoso, zonaDescartar] };
}