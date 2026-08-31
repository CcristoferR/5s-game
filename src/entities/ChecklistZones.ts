import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado, normalMetalCepillado } from "./TexturasSuperficie";

export function crearTableroChecklist(scene: Scene, x: number): Mesh {
  const poste = MeshBuilder.CreateCylinder(`posteTablero_${x}`, { diameter: 0.08, height: 1.1 }, scene);
  poste.position.set(x, 0.55, 1.8);
  const matPoste = new PBRMaterial(`matPosteTablero_${x}`, scene);
  matPoste.albedoColor = new Color3(0.3, 0.26, 0.22);
  matPoste.roughness = 0.6;
  matPoste.microSurfaceTexture = texturaGrano(scene, 0.07);
  poste.material = matPoste;
  poste.receiveShadows = true;

  const tablero = MeshBuilder.CreateBox(`tablero_${x}`, { width: 0.9, height: 1.1, depth: 0.04 }, scene);
  tablero.position.set(x, 1.15, 1.8);
  const matTablero = new PBRMaterial(`matTablero_${x}`, scene);
  matTablero.albedoColor = new Color3(0.82, 0.79, 0.7);
  matTablero.roughness = 0.7;
  matTablero.microSurfaceTexture = texturaGrano(scene, 0.07);
  tablero.material = matTablero;
  tablero.receiveShadows = true;

  const matClip = new PBRMaterial(`matClip_${x}`, scene);
  matClip.albedoColor = new Color3(0.6, 0.6, 0.63);
  matClip.roughness = 0.25;
  matClip.metallic = 0.85;
  matClip.albedoTexture = texturaMetalCepillado(scene);
  matClip.bumpTexture = normalMetalCepillado(scene);
  matClip.invertNormalMapY = true;
  matClip.microSurfaceTexture = texturaGrano(scene, 0.14); // metal brillante — el clip real de una carpeta de procedimientos

  const clip = MeshBuilder.CreateBox(`clipTablero_${x}`, { width: 0.25, height: 0.06, depth: 0.08 }, scene);
  clip.position.set(x, 1.68, 1.79);
  clip.material = matClip;

  return tablero;
}

export function crearPapeleraDescartar(scene: Scene, x: number): Mesh {
  const matPapelera = new PBRMaterial(`matPapelera_${x}`, scene);
  matPapelera.albedoColor = new Color3(0.35, 0.37, 0.4);
  matPapelera.roughness = 0.45;
  matPapelera.microSurfaceTexture = texturaGrano(scene, 0.07);
  matPapelera.metallic = 0.3;

  const papelera = MeshBuilder.CreateCylinder(`papelera_${x}`, { diameterTop: 0.55, diameterBottom: 0.4, height: 0.7 }, scene);
  papelera.position.set(x, 0.35, 1.8);
  papelera.material = matPapelera;
  papelera.receiveShadows = true;

  // Borde superior con brillo metálico — el detalle que la hace ver como
  // papelera real, no un simple tubo liso.
  const matBorde = new PBRMaterial(`matBordePapelera_${x}`, scene);
  matBorde.albedoColor = new Color3(0.25, 0.27, 0.3);
  matBorde.roughness = 0.4;
  matBorde.microSurfaceTexture = texturaGrano(scene, 0.07);
  matBorde.metallic = 0.4;

  const borde = MeshBuilder.CreateTorus(`bordePapelera_${x}`, { diameter: 0.55, thickness: 0.03 }, scene);
  borde.position.set(x, 0.7, 1.8);
  borde.material = matBorde;

  return papelera;
}