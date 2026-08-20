import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import type { ObjetoNivel1 } from "../data/levelConfig";

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
    case "casco_agrietado":
      return crearCasco(scene, datos.id);
    case "cinta_metrica":
      return crearCintaMetrica(scene, datos.id);
    case "guantes_ocasionales":
      return crearGuantes(scene, datos.id);
    case "chatarra_metal":
      return crearChatarra(scene, datos.id);
    case "manual_procedimientos":
      return crearManual(scene, datos.id);
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

function crearTaza(scene: Scene, id: string): Mesh {
  const matTaza = new PBRMaterial(`matCuerpo_${id}`, scene);
  matTaza.albedoColor = new Color3(0.92, 0.92, 0.9);
  matTaza.roughness = 0.15;
  matTaza.metallic = 0;

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
  const matCafe = new PBRMaterial(`matCafe_${id}`, scene);
  matCafe.albedoColor = new Color3(0.12, 0.07, 0.04);
  matCafe.roughness = 0.1;
  cafe.material = matCafe;

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

function crearDiario(scene: Scene, id: string): Mesh {
  const matPagina = new PBRMaterial(`matPagina_${id}`, scene);
  matPagina.albedoColor = new Color3(0.85, 0.83, 0.75);
  matPagina.roughness = 0.9;

  const hojas: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.26, height: 0.01, depth: 0.34 }, scene);
    hoja.position.y = i * 0.011;
    hoja.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.05;
    hojas.push(hoja);
  }

  const fusion = Mesh.MergeMeshes(hojas, true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matPagina;

  const matPortada = new PBRMaterial(`matPortada_${id}`, scene);
  matPortada.albedoColor = new Color3(0.78, 0.76, 0.68);
  matPortada.roughness = 0.85;

  const portada = MeshBuilder.CreateBox(`portada_${id}`, { width: 0.27, height: 0.008, depth: 0.35 }, scene);
  portada.position.y = 4 * 0.011 + 0.005;
  portada.parent = fusion;
  portada.material = matPortada;

  const matTitular = new PBRMaterial(`matTitular_${id}`, scene);
  matTitular.albedoColor = new Color3(0.15, 0.15, 0.15);
  matTitular.roughness = 0.9;

  const titular = MeshBuilder.CreateBox(`titular_${id}`, { width: 0.2, height: 0.003, depth: 0.04 }, scene);
  titular.position.set(0, 4 * 0.011 + 0.01, 0.11);
  titular.parent = fusion;
  titular.material = matTitular;

  return fusion;
}

function crearCajaSellada(scene: Scene, id: string): Mesh {
  const matCaja = new PBRMaterial(`mat_${id}`, scene);
  matCaja.albedoColor = new Color3(0.55, 0.4, 0.28);
  matCaja.roughness = 0.8;

  const caja = MeshBuilder.CreateBox(id, { size: 0.32 }, scene);
  caja.material = matCaja;

  const matCinta = new PBRMaterial(`matCinta_${id}`, scene);
  matCinta.albedoColor = new Color3(0.72, 0.62, 0.42);
  matCinta.roughness = 0.35;

  const cintaVertical = MeshBuilder.CreateBox(`cintaV_${id}`, { width: 0.06, height: 0.33, depth: 0.33 }, scene);
  cintaVertical.parent = caja;
  cintaVertical.material = matCinta;

  const cintaHorizontal = MeshBuilder.CreateBox(`cintaH_${id}`, { width: 0.33, height: 0.33, depth: 0.06 }, scene);
  cintaHorizontal.parent = caja;
  cintaHorizontal.material = matCinta;

  return caja;
}

function crearCasco(scene: Scene, id: string): Mesh {
  const matCasco = new PBRMaterial(`mat_${id}`, scene);
  matCasco.albedoColor = new Color3(0.95, 0.75, 0.05);
  matCasco.roughness = 0.3;
  matCasco.metallic = 0.05;

  const domo = MeshBuilder.CreateSphere(`domo_${id}`, { diameter: 0.34, segments: 12 }, scene);
  domo.scaling.y = 0.62;

  const borde = MeshBuilder.CreateTorus(`borde_${id}`, { diameter: 0.32, thickness: 0.03, tessellation: 20 }, scene);
  borde.scaling.y = 0.4;
  borde.position.y = -0.09;

  const fusion = Mesh.MergeMeshes([domo, borde], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matCasco;

  // Grieta visible: la razón real por la que este casco se descarta.
  const matGrieta = new PBRMaterial(`matGrieta_${id}`, scene);
  matGrieta.albedoColor = new Color3(0.08, 0.08, 0.08);
  matGrieta.roughness = 0.9;

  const grieta = MeshBuilder.CreateBox(`grieta_${id}`, { width: 0.2, height: 0.01, depth: 0.02 }, scene);
  grieta.position.set(0.02, 0.08, 0.1);
  grieta.rotation.z = 0.7;
  grieta.parent = fusion;
  grieta.material = matGrieta;

  return fusion;
}

function crearCintaMetrica(scene: Scene, id: string): Mesh {
  const matCuerpo = new PBRMaterial(`mat_${id}`, scene);
  matCuerpo.albedoColor = new Color3(0.95, 0.75, 0.1);
  matCuerpo.roughness = 0.35;
  matCuerpo.metallic = 0.1;

  const cuerpo = MeshBuilder.CreateCylinder(`cuerpo_${id}`, { diameter: 0.16, height: 0.05 }, scene);
  const fusion = Mesh.MergeMeshes([cuerpo], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matCuerpo;

  const matGancho = new PBRMaterial(`matGancho_${id}`, scene);
  matGancho.albedoColor = new Color3(0.6, 0.6, 0.62);
  matGancho.roughness = 0.25;
  matGancho.metallic = 0.85;

  const gancho = MeshBuilder.CreateBox(`gancho_${id}`, { width: 0.03, height: 0.02, depth: 0.06 }, scene);
  gancho.position.set(0.08, 0.02, 0);
  gancho.parent = fusion;
  gancho.material = matGancho;

  return fusion;
}

function crearGuantes(scene: Scene, id: string): Mesh {
  const mat = new PBRMaterial(`mat_${id}`, scene);
  mat.albedoColor = new Color3(0.68, 0.55, 0.38);
  mat.roughness = 0.85;

  const guante1 = MeshBuilder.CreateCapsule(`guante1_${id}`, { height: 0.22, radius: 0.035 }, scene);
  guante1.rotation.z = Math.PI / 2;
  guante1.position.set(0, 0, -0.045);

  const guante2 = MeshBuilder.CreateCapsule(`guante2_${id}`, { height: 0.22, radius: 0.035 }, scene);
  guante2.rotation.z = Math.PI / 2 + 0.15;
  guante2.position.set(0.01, 0, 0.045);

  const fusion = Mesh.MergeMeshes([guante1, guante2], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function crearChatarra(scene: Scene, id: string): Mesh {
  const mat = new PBRMaterial(`mat_${id}`, scene);
  mat.albedoColor = new Color3(0.35, 0.22, 0.13);
  mat.roughness = 0.65;
  mat.metallic = 0.5;

  const trozo1 = MeshBuilder.CreateBox(`trozo1_${id}`, { width: 0.2, height: 0.06, depth: 0.1 }, scene);
  trozo1.rotation.y = 0.4;

  const trozo2 = MeshBuilder.CreateBox(`trozo2_${id}`, { width: 0.12, height: 0.05, depth: 0.14 }, scene);
  trozo2.rotation.y = -0.5;
  trozo2.position.set(0.06, 0.03, 0.03);

  const fusion = Mesh.MergeMeshes([trozo1, trozo2], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function crearManual(scene: Scene, id: string): Mesh {
  const matPagina = new PBRMaterial(`matPagina_${id}`, scene);
  matPagina.albedoColor = new Color3(0.88, 0.87, 0.82);
  matPagina.roughness = 0.9;

  const hojas: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.24, height: 0.008, depth: 0.32 }, scene);
    hoja.position.y = i * 0.009;
    hojas.push(hoja);
  }

  const fusion = Mesh.MergeMeshes(hojas, true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = matPagina;

  const matPortada = new PBRMaterial(`matPortada_${id}`, scene);
  matPortada.albedoColor = new Color3(0.15, 0.3, 0.5);
  matPortada.roughness = 0.5;

  const portada = MeshBuilder.CreateBox(`portada_${id}`, { width: 0.25, height: 0.008, depth: 0.33 }, scene);
  portada.position.y = 5 * 0.009 + 0.006;
  portada.parent = fusion;
  portada.material = matPortada;

  // Espiral de encuadernación en el borde — lo distingue del "Diario viejo".
  const matEspiral = new PBRMaterial(`matEspiral_${id}`, scene);
  matEspiral.albedoColor = new Color3(0.55, 0.55, 0.58);
  matEspiral.roughness = 0.3;
  matEspiral.metallic = 0.7;

  const espiral = MeshBuilder.CreateCylinder(`espiral_${id}`, { diameter: 0.02, height: 0.24 }, scene);
  espiral.rotation.x = Math.PI / 2;
  espiral.position.set(-0.13, 0.02, 0);
  espiral.parent = fusion;
  espiral.material = matEspiral;

  return fusion;
}