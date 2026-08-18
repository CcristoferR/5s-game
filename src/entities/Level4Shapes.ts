import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";
import type { ItemChecklistNivel4 } from "../data/levelConfig";

// Forma de "tarjeta de instrucción" (papel delgado) en vez de caja
// genérica — encaja con que cada objeto es un texto de procedimiento,
// no un objeto físico como en el Nivel 1.
export function crearFormaNivel4(scene: Scene, datos: ItemChecklistNivel4): Mesh {
  const tarjeta = MeshBuilder.CreateBox(datos.id, { width: 0.55, height: 0.02, depth: 0.32 }, scene);
  const mat = new StandardMaterial(`mat_${datos.id}`, scene);
  mat.diffuseColor = new Color3(0.92, 0.9, 0.82); // color papel, neutro — no delata si es correcto
  tarjeta.material = mat;
  return tarjeta;
}