import { Scene, MeshBuilder, PBRMaterial, Color3, TransformNode } from "@babylonjs/core";

export function crearMaquinaConFuga(scene: Scene, x: number, z: number): TransformNode {
  const root = new TransformNode("maquinaRoot", scene);
  root.position.set(x, 0, z);

  const matCuerpo = new PBRMaterial("matMaquinaCuerpo", scene);
  matCuerpo.albedoColor = new Color3(0.25, 0.27, 0.29);
  matCuerpo.roughness = 0.4;
  matCuerpo.metallic = 0.75; // metal industrial: brillo real, no plástico

  const cuerpo = MeshBuilder.CreateBox("maquinaCuerpo", { width: 0.9, height: 1.3, depth: 0.7 }, scene);
  cuerpo.position.y = 0.65;
  cuerpo.parent = root;
  cuerpo.material = matCuerpo;
  cuerpo.receiveShadows = true;

  // Rejilla de ventilación: varias tiras horizontales — el detalle que
  // hace que se lea como maquinaria industrial real, no una caja lisa.
  const matRejilla = new PBRMaterial("matRejillaMaquina", scene);
  matRejilla.albedoColor = new Color3(0.12, 0.12, 0.13);
  matRejilla.roughness = 0.5;
  matRejilla.metallic = 0.6;

  for (let i = 0; i < 4; i++) {
    const listón = MeshBuilder.CreateBox(`rejilla_${i}`, { width: 0.5, height: 0.03, depth: 0.02 }, scene);
    listón.position.set(0.15, 0.95 + i * 0.06, 0.36);
    listón.parent = root;
    listón.material = matRejilla;
  }

  const matTuberia = new PBRMaterial("matTuberia", scene);
  matTuberia.albedoColor = new Color3(0.42, 0.44, 0.46);
  matTuberia.roughness = 0.3;
  matTuberia.metallic = 0.8;

  const tuberia = MeshBuilder.CreateCylinder("tuberia", { diameter: 0.12, height: 0.6 }, scene);
  tuberia.rotation.z = Math.PI / 2;
  tuberia.position.set(-0.5, 0.4, 0);
  tuberia.parent = root;
  tuberia.material = matTuberia;

  const matFuga = new PBRMaterial("matFugaJunta", scene);
  matFuga.albedoColor = new Color3(0.08, 0.06, 0.04);
  matFuga.roughness = 0.15; // aceite: húmedo, brilloso

  const junta = MeshBuilder.CreateSphere("juntaFuga", { diameter: 0.14 }, scene);
  junta.position.set(-0.8, 0.4, 0);
  junta.parent = root;
  junta.material = matFuga;

  const matGoteo = new PBRMaterial("matGoteo", scene);
  matGoteo.albedoColor = new Color3(0.1, 0.08, 0.05);
  matGoteo.roughness = 0.1;
  matGoteo.alpha = 0.9;

  const goteo = MeshBuilder.CreateCylinder("goteoFuga", { diameterTop: 0.02, diameterBottom: 0.06, height: 0.35 }, scene);
  goteo.position.set(-0.8, 0.22, 0);
  goteo.parent = root;
  goteo.material = matGoteo;

  return root;
}