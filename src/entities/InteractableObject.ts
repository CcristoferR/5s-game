import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import { hacerArrastrable } from "../core/InputController";

export interface DatosObjetoBase {
  id: string;
  posicionInicial: [number, number, number];
}

export interface ObjetoInteractableResult<T extends DatosObjetoBase> {
  mesh: Mesh;
  datos: T;
  onSoltar: Observable<Mesh>;
}

// Representa visualmente cualquier objeto arrastrable del juego (Nivel 1,
// Nivel 2, y los que vengan) y lo hace arrastrable. Hoy son cajas simples
// — cuando lleguen modelos reales, se reemplaza solo esta función.
export function crearObjetoInteractable<T extends DatosObjetoBase>(scene: Scene, datos: T): ObjetoInteractableResult<T> {
  const mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
  mesh.position.set(...datos.posicionInicial);

  const mat = new StandardMaterial(`mat_${datos.id}`, scene);
  mat.diffuseColor = new Color3(0.6, 0.6, 0.65);
  mesh.material = mat;

  mesh.metadata = datos;

  const { onSoltar } = hacerArrastrable(mesh, datos.posicionInicial[1]);

  return { mesh, datos, onSoltar };
}