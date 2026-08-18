import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";

// Tablero de checklist: poste + tablero + clip, como una carpeta de
// procedimientos real — reemplaza la zona plana de color que se veía
// idéntica a las del Nivel 1.
export function crearTableroChecklist(scene: Scene, x: number): Mesh {
  const poste = MeshBuilder.CreateCylinder(`posteTablero_${x}`, { diameter: 0.08, height: 1.1 }, scene);
  poste.position.set(x, 0.55, 1.8);
  const matPoste = new StandardMaterial(`matPosteTablero_${x}`, scene);
  matPoste.diffuseColor = new Color3(0.35, 0.3, 0.25);
  poste.material = matPoste;

  const tablero = MeshBuilder.CreateBox(`tablero_${x}`, { width: 0.9, height: 1.1, depth: 0.04 }, scene);
  tablero.position.set(x, 1.15, 1.8);
  const matTablero = new StandardMaterial(`matTablero_${x}`, scene);
  matTablero.diffuseColor = new Color3(0.85, 0.82, 0.75);
  tablero.material = matTablero;

  const clip = MeshBuilder.CreateBox(`clipTablero_${x}`, { width: 0.25, height: 0.06, depth: 0.08 }, scene);
  clip.position.set(x, 1.68, 1.79);
  const matClip = new StandardMaterial(`matClip_${x}`, scene);
  matClip.diffuseColor = new Color3(0.5, 0.5, 0.52);
  clip.material = matClip;

  return tablero;
}

// Papelera: cilindro abierto — visualmente opuesto al tablero, sin
// ambigüedad de qué hacer con cada instrucción.
export function crearPapeleraDescartar(scene: Scene, x: number): Mesh {
  const papelera = MeshBuilder.CreateCylinder(`papelera_${x}`, { diameterTop: 0.55, diameterBottom: 0.4, height: 0.7 }, scene);
  papelera.position.set(x, 0.35, 1.8);
  const mat = new StandardMaterial(`matPapelera_${x}`, scene);
  mat.diffuseColor = new Color3(0.4, 0.42, 0.45);
  papelera.material = mat;
  return papelera;
}