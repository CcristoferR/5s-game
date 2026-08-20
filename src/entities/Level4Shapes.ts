import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh } from "@babylonjs/core";
import type { ItemChecklistNivel4, SenalNivel4 } from "../data/levelConfig";

export function crearFormaNivel4(scene: Scene, datos: ItemChecklistNivel4, numero: number): Mesh {
  const textura = new DynamicTexture(`textura_${datos.id}`, { width: 256, height: 256 }, scene, true);
  textura.hasAlpha = false;

  const ctx = textura.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#eeeadd";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#c9c2ac";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 244);

  ctx.fillStyle = "#2a2a28";
  ctx.font = "bold 120px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(numero), 128, 135);

  textura.update();

  const mat = new PBRMaterial(`mat_${datos.id}`, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.9;

  const tarjeta = MeshBuilder.CreateBox(datos.id, { width: 0.5, height: 0.02, depth: 0.35 }, scene);
  tarjeta.material = mat;

  return tarjeta;
}

// Ficha de señalización: color de seguridad con una franja tipo cinta
// diagonal — el detalle que la distingue de un simple cuadro de color plano.
export function crearFormaSenal(scene: Scene, datos: SenalNivel4): Mesh {
  const mat = new PBRMaterial(`matSenal_${datos.id}`, scene);
  mat.albedoColor = new Color3(...datos.colorHex);
  mat.roughness = 0.5;
  mat.metallic = 0.05;

  const mesh = MeshBuilder.CreateBox(datos.id, { width: 0.42, height: 0.02, depth: 0.42 }, scene);
  mesh.material = mat;

  const matBorde = new PBRMaterial(`matBordeSenal_${datos.id}`, scene);
  matBorde.albedoColor = new Color3(0.1, 0.1, 0.1);
  matBorde.roughness = 0.6;

  const borde = MeshBuilder.CreateBox(`bordeSenal_${datos.id}`, { width: 0.42, height: 0.022, depth: 0.05 }, scene);
  borde.position.z = 0.185;
  borde.parent = mesh;
  borde.material = matBorde;

  return mesh;
}