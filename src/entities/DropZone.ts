import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";
import type { ZonaClasificacion } from "../data/levelConfig";

export interface DropZoneResult {
  mesh: Mesh;
  tipo: ZonaClasificacion;
}

// Zona marcada en el suelo donde el jugador suelta un objeto. Un simple
// plano de color — nada elaborado, la claridad es más importante que el
// detalle visual acá, para que el jugador identifique cada zona al toque.
export function crearDropZone(scene: Scene, tipo: ZonaClasificacion, x: number, color: Color3): DropZoneResult {
  const mesh = MeshBuilder.CreateBox(`zona_${tipo}`, { width: 1.6, height: 0.05, depth: 1.6 }, scene);
  mesh.position = new Vector3(x, 0.025, 1.8);

  const mat = new StandardMaterial(`matZona_${tipo}`, scene);
  mat.diffuseColor = color;
  mat.alpha = 0.55; // semi-transparente, se ve el suelo debajo
  mesh.material = mat;

  return { mesh, tipo };
}