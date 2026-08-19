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

  // Fila de botones — el detalle que lo hace leerse como teléfono real.
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
  matTaza.roughness = 0.15; // cerámica brillante

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

    // Punta cónica al final del lápiz — el detalle que lo distingue de un simple cilindro.
    const punta = MeshBuilder.CreateCylinder(`punta_${id}_${i}`, { diameterTop: 0, diameterBottom: 0.015, height: 0.03 }, scene);
    punta.position.set(offset, 0.15 + 0.11, offset * 0.6);
    punta.rotation.z = offset * 3;
    punta.parent = fusion;
    punta.material = matPunta;
  });

  return fusion;
}