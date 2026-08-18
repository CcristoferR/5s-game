import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import type { ObjetoNivel1 } from "../data/levelConfig";
import { hacerArrastrable } from "../core/InputController";

export interface ObjetoInteractableResult {
  mesh: Mesh;
  datos: ObjetoNivel1;
  onSoltar: Observable<Mesh>;
}

// Representa visualmente un objeto del nivel y lo hace arrastrable. Hoy
// son cajas simples — cuando lleguen modelos reales, se reemplaza solo
// esta función, sin tocar la lógica de arrastre ni evaluación.
export function crearObjetoInteractable(scene: Scene, datos: ObjetoNivel1): ObjetoInteractableResult {
  const mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
  mesh.position.set(...datos.posicionInicial);

  const mat = new StandardMaterial(`mat_${datos.id}`, scene);
  mat.diffuseColor = new Color3(0.6, 0.6, 0.65); // gris neutro — no delata si es correcto o no
  mesh.material = mat;

  mesh.metadata = datos;

  const { onSoltar } = hacerArrastrable(mesh, datos.posicionInicial[1]);

  return { mesh, datos, onSoltar };
}