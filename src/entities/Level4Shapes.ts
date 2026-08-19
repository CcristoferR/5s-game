import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Mesh } from "@babylonjs/core";
import type { ItemChecklistNivel4 } from "../data/levelConfig";

// Tarjeta física con solo un número grande — el texto completo de la
// instrucción se lee en un panel grande en pantalla al tomar la tarjeta
// (ver Level4_Seiketsu.ts). Imprimir un párrafo entero sobre un objeto
// tan chico nunca se lee bien a esta distancia de cámara, sin importar
// el tamaño de fuente — un número sí se lee siempre.
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