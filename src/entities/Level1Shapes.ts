import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";
import type { ObjetoNivel1 } from "../data/levelConfig";

// Formas específicas para cada objeto del Nivel 1 — reemplazan la caja
// genérica para que cada uno se reconozca a simple vista. Cada función
// arma 2-3 piezas simples y las fusiona en una sola malla, para no
// romper la lógica de arrastre (que espera una única Mesh por objeto).
export function crearFormaNivel1(scene: Scene, datos: ObjetoNivel1): Mesh {
  switch (datos.id) {
    case "engrapadora":
      return crearEngrapadora(scene, datos.id);
    case "taza_cafe":
      return crearTaza(scene, datos.id);
    case "carpeta_activa":
      return crearCarpeta(scene, datos.id);
    case "diario_viejo":
      return crearDiario(scene, datos.id);
    case "caja_sin_etiqueta":
      return crearCajaSellada(scene, datos.id);
    default:
      return MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
  }
}

function crearEngrapadora(scene: Scene, id: string): Mesh {
  const mat = new StandardMaterial(`mat_${id}`, scene);
  mat.diffuseColor = new Color3(0.15, 0.15, 0.18);

  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.4, height: 0.08, depth: 0.12 }, scene);
  const tapa = MeshBuilder.CreateBox(`tapa_${id}`, { width: 0.38, height: 0.06, depth: 0.1 }, scene);
  tapa.position.set(0, 0.09, -0.01);
  tapa.rotation.x = -0.15;

  const fusion = Mesh.MergeMeshes([base, tapa], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function crearTaza(scene: Scene, id: string): Mesh {
  const matTaza = new StandardMaterial(`matCuerpo_${id}`, scene);
  matTaza.diffuseColor = new Color3(0.85, 0.85, 0.82);

  const cuerpo = MeshBuilder.CreateCylinder(`cuerpo_${id}`, { diameterTop: 0.22, diameterBottom: 0.18, height: 0.22 }, scene);
  const asa = MeshBuilder.CreateTorus(`asa_${id}`, { diameter: 0.14, thickness: 0.03 }, scene);
  asa.position.set(0.15, 0, 0);
  asa.rotation.x = Math.PI / 2;

  const fusion = Mesh.MergeMeshes([cuerpo, asa], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matTaza;

  const cafe = MeshBuilder.CreateCylinder(`cafe_${id}`, { diameter: 0.19, height: 0.02 }, scene);
  cafe.position.set(0, 0.11, 0);
  cafe.parent = fusion;
  const matCafe = new StandardMaterial(`matCafe_${id}`, scene);
  matCafe.diffuseColor = new Color3(0.15, 0.09, 0.05);
  cafe.material = matCafe;

  return fusion;
}

function crearCarpeta(scene: Scene, id: string): Mesh {
  const mat = new StandardMaterial(`mat_${id}`, scene);
  mat.diffuseColor = new Color3(0.75, 0.55, 0.2);

  const cuerpo = MeshBuilder.CreateBox(`cuerpo_${id}`, { width: 0.32, height: 0.03, depth: 0.42 }, scene);
  cuerpo.rotation.x = -0.08;

  const pestana = MeshBuilder.CreateBox(`pestana_${id}`, { width: 0.1, height: 0.03, depth: 0.06 }, scene);
  pestana.position.set(0.08, 0.01, 0.19);

  const fusion = Mesh.MergeMeshes([cuerpo, pestana], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function crearDiario(scene: Scene, id: string): Mesh {
  const mat = new StandardMaterial(`mat_${id}`, scene);
  mat.diffuseColor = new Color3(0.82, 0.8, 0.72);

  const hojas: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.26, height: 0.01, depth: 0.34 }, scene);
    hoja.position.y = i * 0.011;
    hoja.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.05; // levemente desordenadas, se ve "viejo"
    hojas.push(hoja);
  }

  const fusion = Mesh.MergeMeshes(hojas, true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function crearCajaSellada(scene: Scene, id: string): Mesh {
  const matCaja = new StandardMaterial(`mat_${id}`, scene);
  matCaja.diffuseColor = new Color3(0.55, 0.4, 0.28); // color cartón — se lee "caja de bodega", sin delatar contenido

  const caja = MeshBuilder.CreateBox(`cuerpo_${id}`, { size: 0.32 }, scene);
  const cinta = MeshBuilder.CreateBox(`cinta_${id}`, { width: 0.06, height: 0.33, depth: 0.33 }, scene);

  const fusion = Mesh.MergeMeshes([caja, cinta], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matCaja;
  return fusion;
}