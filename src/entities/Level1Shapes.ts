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

  // Placa metálica al frente: el detalle que la hace leerse como
  // engrapadora real, no una caja negra genérica.
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
  matTaza.roughness = 0.15; // cerámica: brillo suave
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
  matCafe.roughness = 0.1; // líquido: superficie mojada, casi espejo
  cafe.material = matCafe;

  return fusion;
}

function crearCarpeta(scene: Scene, id: string): Mesh {
  const mat = new PBRMaterial(`mat_${id}`, scene);
  mat.albedoColor = new Color3(0.75, 0.55, 0.2);
  mat.roughness = 0.85; // cartón manila: mate

  const cuerpo = MeshBuilder.CreateBox(`cuerpo_${id}`, { width: 0.32, height: 0.03, depth: 0.42 }, scene);
  cuerpo.rotation.x = -0.08;
  const pestana = MeshBuilder.CreateBox(`pestana_${id}`, { width: 0.1, height: 0.03, depth: 0.06 }, scene);
  pestana.position.set(0.08, 0.01, 0.19);

  const fusion = Mesh.MergeMeshes([cuerpo, pestana], true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;

  // Etiqueta blanca en la pestaña — se lee "carpeta con archivo".
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
  matPagina.roughness = 0.9; // papel: mate

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

  // Portada más oscura arriba con una franja tipo "titular" — así se
  // reconoce de inmediato como diario, no como una pila de papel genérica.
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