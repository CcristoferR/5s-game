import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";

// Ambientación reutilizable de "oficina": paredes, ventana con luz de
// afuera, y una lámpara de techo. No busca fotorrealismo — solo dar
// sensación de estar en un lugar real en vez de flotar en el vacío.
export function crearAmbienteOficina(scene: Scene): void {
  const matPared = new StandardMaterial("matPared", scene);
  matPared.diffuseColor = new Color3(0.88, 0.86, 0.8);
  matPared.backFaceCulling = false;

  const paredFondo = MeshBuilder.CreatePlane("paredFondo", { width: 16, height: 7 }, scene);
  paredFondo.position.set(0, 3.2, 6);
  paredFondo.material = matPared;
  paredFondo.receiveShadows = true;

  const paredIzq = MeshBuilder.CreatePlane("paredIzq", { width: 14, height: 7 }, scene);
  paredIzq.position.set(-6, 3.2, 1);
  paredIzq.rotation.y = Math.PI / 2;
  paredIzq.material = matPared;
  paredIzq.receiveShadows = true;

  const paredDer = MeshBuilder.CreatePlane("paredDer", { width: 14, height: 7 }, scene);
  paredDer.position.set(6, 3.2, 1);
  paredDer.rotation.y = -Math.PI / 2;
  paredDer.material = matPared;
  paredDer.receiveShadows = true;

  const matVentana = new StandardMaterial("matVentana", scene);
  matVentana.diffuseColor = new Color3(0.6, 0.75, 0.85);
  matVentana.emissiveColor = new Color3(0.45, 0.6, 0.75);
  matVentana.backFaceCulling = false;

  const ventana = MeshBuilder.CreatePlane("ventana", { width: 2.2, height: 1.6 }, scene);
  ventana.position.set(-5.9, 3.4, 0.5);
  ventana.rotation.y = Math.PI / 2;
  ventana.material = matVentana;

  const matMarco = new StandardMaterial("matMarcoVentana", scene);
  matMarco.diffuseColor = new Color3(0.4, 0.35, 0.3);
  const marco = MeshBuilder.CreateBox("marcoVentana", { width: 0.06, height: 1.7, depth: 2.4 }, scene);
  marco.position.set(-5.95, 3.4, 0.5);
  marco.material = matMarco;

  const matLampara = new StandardMaterial("matLampara", scene);
  matLampara.diffuseColor = new Color3(0.9, 0.9, 0.85);
  matLampara.emissiveColor = new Color3(0.55, 0.53, 0.46);

  const lampara = MeshBuilder.CreateBox("lampara", { width: 1.4, height: 0.08, depth: 0.5 }, scene);
  lampara.position.set(0, 6.5, 1);
  lampara.material = matLampara;
}