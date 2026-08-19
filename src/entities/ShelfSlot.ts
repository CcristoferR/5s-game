import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface ShelfSlotResult {
  mesh: Mesh;
  id: string;
}

export function crearShelfSlot(scene: Scene, gui: AdvancedDynamicTexture, id: string, x: number, descripcion: string): ShelfSlotResult {
  const matMadera = new PBRMaterial(`matRepisa_${id}`, scene);
  matMadera.albedoColor = new Color3(0.45, 0.32, 0.2);
  matMadera.roughness = 0.6; // madera barnizada: mate con leve brillo

  const soporte = MeshBuilder.CreateBox(`soporteRepisa_${id}`, { width: 0.15, height: 0.75, depth: 0.15 }, scene);
  soporte.position.set(x, 0.375, 1.8);
  soporte.material = matMadera;
  soporte.receiveShadows = true;

  const tabla = MeshBuilder.CreateBox(`tablaRepisa_${id}`, { width: 1.1, height: 0.05, depth: 1.1 }, scene);
  tabla.position.set(x, 0.775, 1.8);
  tabla.material = matMadera;
  tabla.receiveShadows = true;

  const etiqueta = new TextBlock(`etiqueta_${id}`, descripcion);
  etiqueta.color = "white";
  etiqueta.fontSize = 13;
  etiqueta.textWrapping = true;
  etiqueta.width = "140px";
  etiqueta.height = "50px";
  etiqueta.outlineWidth = 3;
  etiqueta.outlineColor = "rgba(0,0,0,0.6)";
  gui.addControl(etiqueta);
  etiqueta.linkWithMesh(tabla);
  etiqueta.linkOffsetY = -70;

  return { mesh: tabla, id };
}