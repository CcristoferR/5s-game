import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from "@babylonjs/core";
import type { ObjetoNivel2 } from "../data/levelConfig";

// Formas específicas por objeto, mismo patrón que Level1Shapes.ts —
// cada una fusiona 2-3 piezas simples en una sola malla, compatible con
// la lógica de arrastre existente sin tocarla.
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
    default:
      return MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
  }
}

function crearTelefono(scene: Scene, id: string): Mesh {
  const mat = new StandardMaterial(`mat_${id}`, scene);
  mat.diffuseColor = new Color3(0.12, 0.12, 0.14);

  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.28, height: 0.06, depth: 0.24 }, scene);
  const auricular = MeshBuilder.CreateCylinder(`auricular_${id}`, { diameter: 0.06, height: 0.2 }, scene);
  auricular.rotation.z = Math.PI / 2;
  auricular.position.set(0, 0.06, -0.04);

  const fusion = Mesh.MergeMeshes([base, auricular], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
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

function crearTazaLapices(scene: Scene, id: string): Mesh {
  const matTaza = new StandardMaterial(`mat_${id}`, scene);
  matTaza.diffuseColor = new Color3(0.3, 0.5, 0.65);

  const cuerpo = MeshBuilder.CreateCylinder(`cuerpo_${id}`, { diameterTop: 0.16, diameterBottom: 0.13, height: 0.18 }, scene);
  const fusion = Mesh.MergeMeshes([cuerpo], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matTaza;

  const matLapiz = new StandardMaterial(`matLapiz_${id}`, scene);
  matLapiz.diffuseColor = new Color3(0.9, 0.7, 0.2);

  [-0.03, 0, 0.03].forEach((offset, i) => {
    const lapiz = MeshBuilder.CreateCylinder(`lapiz_${id}_${i}`, { diameter: 0.015, height: 0.22 }, scene);
    lapiz.position.set(offset, 0.16, offset * 0.6);
    lapiz.rotation.z = offset * 3;
    lapiz.parent = fusion;
    lapiz.material = matLapiz;
  });

  return fusion;
}