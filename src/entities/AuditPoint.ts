import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface AuditPointResult {
  mesh: Mesh;
  estaMarcado: () => boolean;
}

// Punto de control clickeable: se marca/desmarca con un click. El feedback
// visual (agrandarse) es neutro a propósito — no dice si marcarlo está bien
// o mal, igual que en una auditoría real donde tú decides sin ayuda.
export function crearPuntoControl(
  scene: Scene,
  gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string
): AuditPointResult {
  const mesh = MeshBuilder.CreateSphere(`punto_${id}`, { diameter: 0.25 }, scene);
  mesh.position.set(x, 1.0, z);

  const mat = new StandardMaterial(`matPunto_${id}`, scene);
  mat.diffuseColor = new Color3(0.55, 0.55, 0.6);
  mesh.material = mat;

  const etiqueta = new TextBlock(`etiquetaPunto_${id}`, descripcion);
  etiqueta.color = "white";
  etiqueta.fontSize = 12;
  etiqueta.textWrapping = true;
  etiqueta.width = "130px";
  etiqueta.height = "40px";
  etiqueta.outlineWidth = 3;
  etiqueta.outlineColor = "rgba(0,0,0,0.6)";
  gui.addControl(etiqueta);
  etiqueta.linkWithMesh(mesh);
  etiqueta.linkOffsetY = -45;

  let marcado = false;

  scene.onPointerObservable.add((info) => {
    if (info.type !== 1 /* POINTERDOWN */) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    marcado = !marcado;
    mesh.scaling.setAll(marcado ? 1.4 : 1);
  });

  return { mesh, estaMarcado: () => marcado };
}