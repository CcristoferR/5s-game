import { Scene, MeshBuilder, StandardMaterial, PBRMaterial, Color3 } from "@babylonjs/core";

export function crearAmbienteOficina(scene: Scene): void {
  const matPared = new StandardMaterial("matPared", scene);
  matPared.diffuseColor = new Color3(0.85, 0.83, 0.76);
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

  // Rodapiés: definen dónde termina la pared y empieza el piso — antes
  // se veían fundidos sin transición, esto le da estructura real al cuarto.
  const matRodapie = new StandardMaterial("matRodapie", scene);
  matRodapie.diffuseColor = new Color3(0.35, 0.32, 0.28);

  const rodapieFondo = MeshBuilder.CreateBox("rodapieFondo", { width: 16, height: 0.15, depth: 0.03 }, scene);
  rodapieFondo.position.set(0, 0.08, 5.98);
  rodapieFondo.material = matRodapie;

  const rodapieIzq = MeshBuilder.CreateBox("rodapieIzq", { width: 0.03, height: 0.15, depth: 14 }, scene);
  rodapieIzq.position.set(-5.98, 0.08, 1);
  rodapieIzq.material = matRodapie;

  const rodapieDer = MeshBuilder.CreateBox("rodapieDer", { width: 0.03, height: 0.15, depth: 14 }, scene);
  rodapieDer.position.set(5.98, 0.08, 1);
  rodapieDer.material = matRodapie;

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

  // Alfombra bajo el escritorio: rompe la extensión plana de piso y da
  // calidez, mínima pero notoria.
  const matAlfombra = new PBRMaterial("matAlfombra", scene);
  matAlfombra.albedoColor = new Color3(0.35, 0.42, 0.4);
  matAlfombra.roughness = 0.95;

  const alfombra = MeshBuilder.CreateGround("alfombra", { width: 4, height: 3 }, scene);
  alfombra.position.set(0, 0.005, 0.2);
  alfombra.material = matAlfombra;
  alfombra.receiveShadows = true;

  // Cuadro simple en la pared de fondo — decoración mínima, sin imagen real.
  const matCuadroMarco = new StandardMaterial("matCuadroMarco", scene);
  matCuadroMarco.diffuseColor = new Color3(0.3, 0.25, 0.2);
  const cuadroMarco = MeshBuilder.CreatePlane("cuadroMarco", { width: 1.1, height: 0.8 }, scene);
  cuadroMarco.position.set(3.2, 3.6, 5.95);
  cuadroMarco.material = matCuadroMarco;

  const matCuadroInterior = new PBRMaterial("matCuadroInterior", scene);
  matCuadroInterior.albedoColor = new Color3(0.55, 0.6, 0.5);
  matCuadroInterior.roughness = 0.6;
  const cuadroInterior = MeshBuilder.CreatePlane("cuadroInterior", { width: 0.95, height: 0.65 }, scene);
  cuadroInterior.position.set(3.2, 3.6, 5.93);
  cuadroInterior.material = matCuadroInterior;

  // Planta en la esquina: el toque de vida orgánica de la habitación.
  const matMaceta = new PBRMaterial("matMaceta", scene);
  matMaceta.albedoColor = new Color3(0.5, 0.32, 0.24);
  matMaceta.roughness = 0.7;
  const maceta = MeshBuilder.CreateCylinder("maceta", { diameterTop: 0.5, diameterBottom: 0.35, height: 0.5 }, scene);
  maceta.position.set(-4.8, 0.25, 4.8);
  maceta.material = matMaceta;
  maceta.receiveShadows = true;

  const matHojas = new PBRMaterial("matHojasPlanta", scene);
  matHojas.albedoColor = new Color3(0.22, 0.42, 0.2);
  matHojas.roughness = 0.85;

  [0, 0.3, -0.3, 0.15, -0.15].forEach((offset, i) => {
    const hoja = MeshBuilder.CreateSphere(`hojaPlanta_${i}`, { diameterX: 0.15, diameterY: 0.5, diameterZ: 0.15 }, scene);
    hoja.position.set(-4.8 + offset, 0.85 + i * 0.05, 4.8 + offset * 0.6);
    hoja.rotation.z = offset * 0.8;
    hoja.material = matHojas;
  });
}