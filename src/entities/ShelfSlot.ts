import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface ShelfSlotResult {
  mesh: Mesh;
  id: string;
}

// Silueta de un lugar designado en el estante (shadow board). Color
// neutro a propósito: no revela qué objeto va ahí — el jugador razona
// según la etiqueta de contexto que flota sobre la casilla.
export function crearShelfSlot(scene: Scene, gui: AdvancedDynamicTexture, id: string, x: number, descripcion: string): ShelfSlotResult {
  const mesh = MeshBuilder.CreateBox(`slot_${id}`, { width: 1.3, height: 0.04, depth: 1.3 }, scene);
  mesh.position.set(x, 0.02, 1.8);

  const mat = new StandardMaterial(`matSlot_${id}`, scene);
  mat.diffuseColor = new Color3(0.5, 0.55, 0.6);
  mat.alpha = 0.35;
  mesh.material = mat;

  const etiqueta = new TextBlock(`etiqueta_${id}`, descripcion);
  etiqueta.color = "white";
  etiqueta.fontSize = 13;
  etiqueta.textWrapping = true;
  etiqueta.width = "140px";
  etiqueta.height = "50px";
  etiqueta.outlineWidth = 3;
  etiqueta.outlineColor = "rgba(0,0,0,0.6)"; // legible sobre cualquier fondo
  gui.addControl(etiqueta);
  etiqueta.linkWithMesh(mesh);
  etiqueta.linkOffsetY = -60; // flota justo encima de la casilla en el suelo

  return { mesh, id };
}