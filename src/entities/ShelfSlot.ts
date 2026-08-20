import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface ShelfSlotResult {
  mesh: Mesh;
  id: string;
}

// Repisa tipo "shadow board" real: el tablero trae un contorno punteado
// impreso en la madera — el mismo recurso visual que usan las fábricas
// para marcar "aquí va algo" a simple vista. Antes era solo color liso.
export function crearShelfSlot(scene: Scene, gui: AdvancedDynamicTexture, id: string, x: number, descripcion: string): ShelfSlotResult {
  const matPoste = new PBRMaterial(`matPosteRepisa_${id}`, scene);
  matPoste.albedoColor = new Color3(0.45, 0.32, 0.2);
  matPoste.roughness = 0.6;

  const soporte = MeshBuilder.CreateBox(`soporteRepisa_${id}`, { width: 0.15, height: 0.75, depth: 0.15 }, scene);
  soporte.position.set(x, 0.375, 1.8);
  soporte.material = matPoste;
  soporte.receiveShadows = true;

  const texturaTabla = new DynamicTexture(`texturaRepisa_${id}`, { width: 256, height: 256 }, scene, true);
  const ctx = texturaTabla.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#734f30";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, 164, 164);
  ctx.setLineDash([]);
  texturaTabla.update();

  const matTabla = new PBRMaterial(`matTablaRepisa_${id}`, scene);
  matTabla.albedoTexture = texturaTabla;
  matTabla.roughness = 0.6;

  const tabla = MeshBuilder.CreateBox(`tablaRepisa_${id}`, { width: 1.1, height: 0.05, depth: 1.1 }, scene);
  tabla.position.set(x, 0.775, 1.8);
  tabla.material = matTabla;
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