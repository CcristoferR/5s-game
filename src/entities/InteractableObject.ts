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

// Representa visualmente cualquier objeto arrastrable. Por defecto crea
// una caja genérica (compatible con Nivel 2 y 4, que no necesitan formas
// especiales); si se pasa "crearMalla", se usa esa forma personalizada
// en su lugar — así el Nivel 1 puede tener objetos reconocibles sin
// tocar el resto de niveles.
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

  const { onSoltar } = hacerArrastrable(mesh, datos.posicionInicial[1]);

  return { mesh, datos, onSoltar };
}