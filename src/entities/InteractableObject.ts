import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import { hacerArrastrable, type ResultadoSoltar } from "../core/InputController";

export interface DatosObjetoBase {
  id: string;
  posicionInicial: [number, number, number];
}

export interface ObjetoInteractableResult<T extends DatosObjetoBase> {
  mesh: Mesh;
  datos: T;
  onSoltar: Observable<ResultadoSoltar>;
  onAgarrar: Observable<Mesh>;
}

export function crearObjetoInteractable<T extends DatosObjetoBase>(
  scene: Scene,
  datos: T,
  crearMalla?: (scene: Scene, datos: T) => Mesh
): ObjetoInteractableResult<T> {
  let mesh: Mesh;

  if (crearMalla) {
    mesh = crearMalla(scene, datos);
  } else {
    mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
    const mat = new StandardMaterial(`mat_${datos.id}`, scene);
    mat.diffuseColor = new Color3(0.6, 0.6, 0.65);
    mesh.material = mat;
  }

  mesh.position.set(...datos.posicionInicial);
  mesh.metadata = datos;

  const { onSoltar, onAgarrar } = hacerArrastrable(mesh, datos.posicionInicial[1]);

  return { mesh, datos, onSoltar, onAgarrar };
}