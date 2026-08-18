import { Scene, MeshBuilder, StandardMaterial, Color3, TransformNode } from "@babylonjs/core";

// Máquina con fuga visible — le da fundamento visual a la respuesta
// correcta del nivel ("fuga de aceite en la máquina cercana"). Sin esto,
// elegir esa opción era arbitrario: no había ninguna máquina en la
// escena que la sustentara.
export function crearMaquinaConFuga(scene: Scene, x: number, z: number): TransformNode {
  const root = new TransformNode("maquinaRoot", scene);
  root.position.set(x, 0, z);

  const matCuerpo = new StandardMaterial("matMaquinaCuerpo", scene);
  matCuerpo.diffuseColor = new Color3(0.28, 0.3, 0.32);

  const cuerpo = MeshBuilder.CreateBox("maquinaCuerpo", { width: 0.9, height: 1.3, depth: 0.7 }, scene);
  cuerpo.position.y = 0.65;
  cuerpo.parent = root;
  cuerpo.material = matCuerpo;

  const matTuberia = new StandardMaterial("matTuberia", scene);
  matTuberia.diffuseColor = new Color3(0.4, 0.42, 0.44);

  const tuberia = MeshBuilder.CreateCylinder("tuberia", { diameter: 0.12, height: 0.6 }, scene);
  tuberia.rotation.z = Math.PI / 2;
  tuberia.position.set(-0.5, 0.4, 0);
  tuberia.parent = root;
  tuberia.material = matTuberia;

  const matFuga = new StandardMaterial("matFugaJunta", scene);
  matFuga.diffuseColor = new Color3(0.1, 0.08, 0.05);

  const junta = MeshBuilder.CreateSphere("juntaFuga", { diameter: 0.14 }, scene);
  junta.position.set(-0.8, 0.4, 0);
  junta.parent = root;
  junta.material = matFuga;

  // Goteo: conecta visualmente la máquina con las manchas de abajo.
  const goteo = MeshBuilder.CreateCylinder("goteoFuga", { diameterTop: 0.02, diameterBottom: 0.06, height: 0.35 }, scene);
  goteo.position.set(-0.8, 0.22, 0);
  goteo.parent = root;
  const matGoteo = new StandardMaterial("matGoteo", scene);
  matGoteo.diffuseColor = new Color3(0.12, 0.1, 0.06);
  matGoteo.alpha = 0.85;
  goteo.material = matGoteo;

  return root;
}