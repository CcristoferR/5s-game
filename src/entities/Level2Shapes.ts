import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import type { ObjetoNivel2 } from "../data/levelConfig";

export function crearFormaNivel2(scene: Scene, datos: ObjetoNivel2): Mesh {
  switch (datos.id) {
    case "telefono":
      return crearTelefono(scene, datos.id);
    case "engrapadora2":
      return crearEngrapadora(scene, datos.id);
    case "carpeta_activa2":
      return crearCarpeta(scene, datos.id);
    case "taza_lapices":
      return crearTazaLapices(scene, datos.id);
    case "llavero":
      return crearLlavero(scene, datos.id);
    case "tijeras":
      return crearTijeras(scene, datos.id);
    case "manual_referencia":
      return crearManualReferencia(scene, datos.id);
    default: {
      const mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
      const mat = new PBRMaterial(`mat_${datos.id}`, scene);
      mat.albedoColor = new Color3(0.6, 0.6, 0.65);
      mat.roughness = 0.7;
      mesh.material = mat;
      return mesh;
    }
  }
}

function crearTelefono(scene: Scene, id: string): Mesh {
  const matCuerpo = new PBRMaterial(`matCuerpo_${id}`, scene);
  matCuerpo.albedoColor = new Color3(0.1, 0.1, 0.12);
  matCuerpo.roughness = 0.3;
  matCuerpo.metallic = 0.2;

  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.28, height: 0.06, depth: 0.24 }, scene);
  const auricular = MeshBuilder.CreateCylinder(`auricular_${id}`, { diameter: 0.06, height: 0.2 }, scene);
  auricular.rotation.z = Math.PI / 2;
  auricular.position.set(0, 0.06, -0.04);

  const fusion = Mesh.MergeMeshes([base, auricular], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matCuerpo;

  const matBoton = new PBRMaterial(`matBoton_${id}`, scene);
  matBoton.albedoColor = new Color3(0.6, 0.6, 0.62);
  matBoton.roughness = 0.4;

  [-0.06, 0, 0.06].forEach((offset, i) => {
    const boton = MeshBuilder.CreateBox(`botonTel_${id}_${i}`, { width: 0.04, height: 0.01, depth: 0.04 }, scene);
    boton.position.set(offset, 0.035, 0.06);
    boton.parent = fusion;
    boton.material = matBoton;
  });

  return fusion;
}

function crearEngrapadora(scene: Scene, id: string): Mesh {
  const matCuerpo = new PBRMaterial(`matCuerpo_${id}`, scene);
  matCuerpo.albedoColor = new Color3(0.12, 0.12, 0.15);
  matCuerpo.roughness = 0.35;
  matCuerpo.metallic = 0.4;

  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.4, height: 0.08, depth: 0.12 }, scene);
  const tapa = MeshBuilder.CreateBox(`tapa_${id}`, { width: 0.38, height: 0.06, depth: 0.1 }, scene);
  tapa.position.set(0, 0.09, -0.01);
  tapa.rotation.x = -0.15;

  const fusion = Mesh.MergeMeshes([base, tapa], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matCuerpo;

  const matPlaca = new PBRMaterial(`matPlaca_${id}`, scene);
  matPlaca.albedoColor = new Color3(0.75, 0.75, 0.78);
  matPlaca.roughness = 0.2;
  matPlaca.metallic = 0.85;

  const placa = MeshBuilder.CreateBox(`placa_${id}`, { width: 0.06, height: 0.09, depth: 0.13 }, scene);
  placa.position.set(0.19, 0.02, 0);
  placa.parent = fusion;
  placa.material = matPlaca;

  return fusion;
}

function crearCarpeta(scene: Scene, id: string): Mesh {
  const mat = new PBRMaterial(`mat_${id}`, scene);
  mat.albedoColor = new Color3(0.75, 0.55, 0.2);
  mat.roughness = 0.85;

  const cuerpo = MeshBuilder.CreateBox(`cuerpo_${id}`, { width: 0.32, height: 0.03, depth: 0.42 }, scene);
  cuerpo.rotation.x = -0.08;
  const pestana = MeshBuilder.CreateBox(`pestana_${id}`, { width: 0.1, height: 0.03, depth: 0.06 }, scene);
  pestana.position.set(0.08, 0.01, 0.19);

  const fusion = Mesh.MergeMeshes([cuerpo, pestana], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;

  const matEtiqueta = new PBRMaterial(`matEtiqueta_${id}`, scene);
  matEtiqueta.albedoColor = new Color3(0.95, 0.95, 0.92);
  matEtiqueta.roughness = 0.9;

  const etiqueta = MeshBuilder.CreateBox(`etiquetaCarpeta_${id}`, { width: 0.07, height: 0.005, depth: 0.04 }, scene);
  etiqueta.position.set(0.08, 0.03, 0.19);
  etiqueta.parent = fusion;
  etiqueta.material = matEtiqueta;

  return fusion;
}

function crearTazaLapices(scene: Scene, id: string): Mesh {
  const matTaza = new PBRMaterial(`mat_${id}`, scene);
  matTaza.albedoColor = new Color3(0.25, 0.45, 0.6);
  matTaza.roughness = 0.15;

  const cuerpo = MeshBuilder.CreateCylinder(`cuerpo_${id}`, { diameterTop: 0.16, diameterBottom: 0.13, height: 0.18 }, scene);
  const fusion = Mesh.MergeMeshes([cuerpo], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matTaza;

  const matMadera = new PBRMaterial(`matLapiz_${id}`, scene);
  matMadera.albedoColor = new Color3(0.85, 0.65, 0.3);
  matMadera.roughness = 0.7;

  const matPunta = new PBRMaterial(`matPunta_${id}`, scene);
  matPunta.albedoColor = new Color3(0.15, 0.12, 0.1);
  matPunta.roughness = 0.5;

  [-0.03, 0, 0.03].forEach((offset, i) => {
    const lapiz = MeshBuilder.CreateCylinder(`lapiz_${id}_${i}`, { diameter: 0.015, height: 0.19 }, scene);
    lapiz.position.set(offset, 0.15, offset * 0.6);
    lapiz.rotation.z = offset * 3;
    lapiz.parent = fusion;
    lapiz.material = matMadera;

    const punta = MeshBuilder.CreateCylinder(`punta_${id}_${i}`, { diameterTop: 0, diameterBottom: 0.015, height: 0.03 }, scene);
    punta.position.set(offset, 0.15 + 0.11, offset * 0.6);
    punta.rotation.z = offset * 3;
    punta.parent = fusion;
    punta.material = matPunta;
  });

  return fusion;
}

function crearLlavero(scene: Scene, id: string): Mesh {
  // Llavero apoyado en la mesa: aro tumbado y tres llaves abiertas en abanico
  // a su lado. Antes el aro era un toro de 1,2 cm de grosor y las llaves
  // colgaban 9 cm por debajo — o sea dentro del tablero, invisibles. Quedaba
  // un aro finito casi imposible de agarrar con el puntero.
  //
  // Ahora todo se fusiona en UNA sola malla: al arrastrar hay que poder tomar
  // el objeto por cualquier parte, y las piezas sueltas como hijas no las
  // detecta el arrastre, solo la malla raíz.
  const matAnillo = new PBRMaterial(`matAnillo_${id}`, scene);
  matAnillo.albedoColor = new Color3(0.62, 0.63, 0.66);
  matAnillo.roughness = 0.22;
  matAnillo.metallic = 0.85;

  const matLlave = new PBRMaterial(`matLlave_${id}`, scene);
  matLlave.albedoColor = new Color3(0.72, 0.68, 0.46);
  matLlave.roughness = 0.3;
  matLlave.metallic = 0.75;

  const partes: Mesh[] = [];

  // Aro más grueso y algo más grande: es la parte que el jugador ve primero.
  const GROSOR = 0.02;
  const anillo = MeshBuilder.CreateTorus(
    `anillo_${id}`,
    { diameter: 0.14, thickness: GROSOR, tessellation: 24 },
    scene
  );
  anillo.position.y = GROSOR / 2;
  anillo.material = matAnillo;
  partes.push(anillo);

  // Tres llaves tumbadas sobre la mesa, abiertas en abanico desde el aro.
  const ALTO_LLAVE = 0.006;
  [-0.34, 0, 0.34].forEach((giro, i) => {
    const paleton = MeshBuilder.CreateBox(
      `llave_${id}_${i}`,
      { width: 0.024, height: ALTO_LLAVE, depth: 0.15 },
      scene
    );
    paleton.position.set(Math.sin(giro) * 0.1, ALTO_LLAVE / 2, 0.075 + Math.cos(giro) * 0.06);
    paleton.rotation.y = giro;
    paleton.material = matLlave;
    partes.push(paleton);

    // Cabeza redonda de cada llave, para que no se lean como tres palitos.
    const cabeza = MeshBuilder.CreateCylinder(
      `cabezaLlave_${id}_${i}`,
      { diameter: 0.034, height: ALTO_LLAVE, tessellation: 16 },
      scene
    );
    cabeza.position.set(Math.sin(giro) * 0.052, ALTO_LLAVE / 2, 0.022 + Math.cos(giro) * 0.028);
    cabeza.material = matLlave;
    partes.push(cabeza);
  });

  const fusion = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  fusion.name = id;
  return fusion;
}

function crearTijeras(scene: Scene, id: string): Mesh {
  const matHoja = new PBRMaterial(`matHoja_${id}`, scene);
  matHoja.albedoColor = new Color3(0.65, 0.66, 0.68);
  matHoja.roughness = 0.25;
  matHoja.metallic = 0.85;

  const hoja1 = MeshBuilder.CreateBox(`hoja1_${id}`, { width: 0.02, height: 0.005, depth: 0.22 }, scene);
  hoja1.rotation.y = 0.25;
  hoja1.position.set(0, 0, 0.09);

  const hoja2 = MeshBuilder.CreateBox(`hoja2_${id}`, { width: 0.02, height: 0.005, depth: 0.22 }, scene);
  hoja2.rotation.y = -0.25;
  hoja2.position.set(0, 0, 0.09);

  const fusion = Mesh.MergeMeshes([hoja1, hoja2], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matHoja;

  const matTornillo = new PBRMaterial(`matTornillo_${id}`, scene);
  matTornillo.albedoColor = new Color3(0.4, 0.4, 0.42);
  matTornillo.roughness = 0.3;
  matTornillo.metallic = 0.7;

  const tornillo = MeshBuilder.CreateCylinder(`tornillo_${id}`, { diameter: 0.02, height: 0.01 }, scene);
  tornillo.rotation.x = Math.PI / 2;
  tornillo.parent = fusion;
  tornillo.material = matTornillo;

  const matMango = new PBRMaterial(`matMango_${id}`, scene);
  matMango.albedoColor = new Color3(0.85, 0.15, 0.1);
  matMango.roughness = 0.6;

  const mango1 = MeshBuilder.CreateTorus(`mango1_${id}`, { diameter: 0.06, thickness: 0.012 }, scene);
  mango1.rotation.x = 0.25;
  mango1.position.set(-0.02, 0, -0.09);
  mango1.parent = fusion;
  mango1.material = matMango;

  const mango2 = MeshBuilder.CreateTorus(`mango2_${id}`, { diameter: 0.06, thickness: 0.012 }, scene);
  mango2.rotation.x = -0.25;
  mango2.position.set(0.02, 0, -0.09);
  mango2.parent = fusion;
  mango2.material = matMango;

  return fusion;
}

function crearManualReferencia(scene: Scene, id: string): Mesh {
  const matPagina = new PBRMaterial(`matPagina_${id}`, scene);
  matPagina.albedoColor = new Color3(0.86, 0.85, 0.8);
  matPagina.roughness = 0.9;

  const hojas: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.22, height: 0.01, depth: 0.28 }, scene);
    hoja.position.y = i * 0.012;
    hojas.push(hoja);
  }

  const fusion = Mesh.MergeMeshes(hojas, true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matPagina;

  const matPortada = new PBRMaterial(`matPortada_${id}`, scene);
  matPortada.albedoColor = new Color3(0.2, 0.5, 0.35);
  matPortada.roughness = 0.55;

  const portada = MeshBuilder.CreateBox(`portada_${id}`, { width: 0.23, height: 0.008, depth: 0.29 }, scene);
  portada.position.y = 3 * 0.012 + 0.005;
  portada.parent = fusion;
  portada.material = matPortada;

  return fusion;
}