import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface DropZoneResult<T extends string> {
  mesh: Mesh;
  tipo: T;
}

export function crearDropZone<T extends string>(
  scene: Scene,
  tipo: T,
  x: number,
  color: Color3,
  gui?: AdvancedDynamicTexture,
  etiqueta?: string
): DropZoneResult<T> {
  const mesh = MeshBuilder.CreateBox(`zona_${tipo}`, { width: 1.6, height: 0.05, depth: 1.6 }, scene);
  mesh.position = new Vector3(x, 0.025, 1.8);

  const mat = new StandardMaterial(`matZona_${tipo}`, scene);
  mat.diffuseColor = color;
  mat.alpha = 0.55;
  mesh.material = mat;

  if (gui && etiqueta) {
    const texto = new TextBlock(`etiquetaZona_${tipo}`, etiqueta);
    texto.color = "white";
    texto.fontSize = 15;
    texto.outlineWidth = 4;
    texto.outlineColor = "rgba(0,0,0,0.6)";
    texto.width = "140px";
    texto.height = "24px";
    gui.addControl(texto);
    texto.linkWithMesh(mesh);
    texto.linkOffsetY = -30;
  }

  return { mesh, tipo };
}