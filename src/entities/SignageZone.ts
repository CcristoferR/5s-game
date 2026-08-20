import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface ZonaSenalResult {
  mesh: Mesh;
  id: string;
}

// Zona de piso NEUTRA (solo un anillo punteado, sin color) donde debe ir
// una ficha de señalización — el jugador decide el color según la
// descripción, no según una pista de color ya puesta ahí.
export function crearZonaSenal(scene: Scene, gui: AdvancedDynamicTexture, id: string, x: number, z: number, descripcion: string): ZonaSenalResult {
  const textura = new DynamicTexture(`texturaZonaSenal_${id}`, { width: 256, height: 256 }, scene, true);
  const ctx = textura.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 100, 0, Math.PI * 2);
  ctx.stroke();
  textura.update();
  textura.hasAlpha = true;

  const mat = new PBRMaterial(`matZonaSenal_${id}`, scene);
  mat.albedoColor = new Color3(0.5, 0.5, 0.52);
  mat.albedoTexture = textura;
  mat.useAlphaFromAlbedoTexture = true;
  mat.roughness = 0.7;

  const mesh = MeshBuilder.CreateGround(`zonaSenal_${id}`, { width: 0.55, height: 0.55 }, scene);
  mesh.position.set(x, 0.011, z);
  mesh.material = mat;
  mesh.receiveShadows = true;

  const etiqueta = new TextBlock(`etiquetaZonaSenal_${id}`, descripcion);
  etiqueta.color = "white";
  etiqueta.fontSize = 12;
  etiqueta.textWrapping = true;
  etiqueta.width = "150px";
  etiqueta.height = "45px";
  etiqueta.outlineWidth = 3;
  etiqueta.outlineColor = "rgba(0,0,0,0.75)";
  gui.addControl(etiqueta);
  etiqueta.linkWithMesh(mesh);
  etiqueta.linkOffsetY = -35;

  return { mesh, id };
}