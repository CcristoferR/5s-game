import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";

export interface DropZoneResult<T extends string> {
  mesh: Mesh;
  tipo: T;
}

// Zona marcada en el suelo donde el jugador suelta un objeto. Genérica en
// T para que cada nivel defina sus propias categorías (Necesario/Dudoso/
// Descartar en Nivel 1, Checklist/Descartar en Nivel 4) sin duplicar código.
export function crearDropZone<T extends string>(scene: Scene, tipo: T, x: number, color: Color3): DropZoneResult<T> {
  const mesh = MeshBuilder.CreateBox(`zona_${tipo}`, { width: 1.6, height: 0.05, depth: 1.6 }, scene);
  mesh.position = new Vector3(x, 0.025, 1.8);

  const mat = new StandardMaterial(`matZona_${tipo}`, scene);
  mat.diffuseColor = color;
  mat.alpha = 0.55;
  mesh.material = mat;

  return { mesh, tipo };
}