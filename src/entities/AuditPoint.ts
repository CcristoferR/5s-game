import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import type { TipoEvidencia } from "../data/levelConfig";

export interface AuditPointResult {
  mesh: Mesh;
  estaMarcado: () => boolean;
  onCambio: Observable<boolean>;
  meshesSombra: Mesh[];
}

const ALTURA_PEDESTAL = 0.5;

export function crearPuntoControl(
  scene: Scene,
  gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string,
  tipoEvidencia: TipoEvidencia
): AuditPointResult {
  const pedestal = crearPedestal(scene, id, x, z);
  const evidencia = crearEvidencia(scene, gui, id, x, z, tipoEvidencia);

  const mesh = MeshBuilder.CreateSphere(`punto_${id}`, { diameter: 0.28 }, scene);
  mesh.position.set(x, ALTURA_PEDESTAL + 0.8, z);

  const colorNeutro = new Color3(0.55, 0.55, 0.6);
  const colorMarcado = new Color3(0.85, 0.45, 0.1);

  const mat = new PBRMaterial(`matPunto_${id}`, scene);
  mat.albedoColor = colorNeutro;
  mat.emissiveColor = colorNeutro.scale(0.15);
  mat.roughness = 0.25;
  mat.metallic = 0.4;
  mesh.material = mat;

  const etiqueta = new TextBlock(`etiquetaPunto_${id}`, descripcion);
  etiqueta.color = "white";
  etiqueta.fontSize = 12;
  etiqueta.textWrapping = true;
  etiqueta.width = "140px";
  etiqueta.height = "40px";
  etiqueta.outlineWidth = 4;
  etiqueta.outlineColor = "rgba(0,0,0,0.85)";
  gui.addControl(etiqueta);
  etiqueta.linkWithMesh(mesh);
  etiqueta.linkOffsetY = -55;

  let marcado = false;
  const onCambio = new Observable<boolean>();

  scene.onPointerObservable.add((info) => {
    if (info.type !== 1) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    marcado = !marcado;
    mesh.scaling.setAll(marcado ? 1.5 : 1);
    mat.albedoColor = marcado ? colorMarcado : colorNeutro;
    mat.emissiveColor = (marcado ? colorMarcado : colorNeutro).scale(marcado ? 0.4 : 0.15);
    onCambio.notifyObservers(marcado);
  });

  return { mesh, estaMarcado: () => marcado, onCambio, meshesSombra: [pedestal, ...evidencia, mesh] };
}

function crearPedestal(scene: Scene, id: string, x: number, z: number): Mesh {
  const mat = new PBRMaterial(`matPedestal_${id}`, scene);
  mat.albedoColor = new Color3(0.5, 0.48, 0.44);
  mat.roughness = 0.6;
  mat.metallic = 0.1;

  const pedestal = MeshBuilder.CreateCylinder(`pedestal_${id}`, { diameterTop: 0.5, diameterBottom: 0.42, height: ALTURA_PEDESTAL }, scene);
  pedestal.position.set(x, ALTURA_PEDESTAL / 2, z);
  pedestal.material = mat;
  pedestal.receiveShadows = true;

  return pedestal;
}

function crearEvidencia(scene: Scene, gui: AdvancedDynamicTexture, id: string, x: number, z: number, tipo: TipoEvidencia): Mesh[] {
  const y = ALTURA_PEDESTAL + 0.01;
  const creados: Mesh[] = [];

  if (tipo === "tarjetaVencida") {
    const tarjeta = MeshBuilder.CreatePlane(`tarjeta_${id}`, { width: 0.3, height: 0.4 }, scene);
    tarjeta.position.set(x, y + 0.2, z);
    tarjeta.rotation.y = Math.PI / 4;
    const mat = new PBRMaterial(`matTarjeta_${id}`, scene);
    mat.albedoColor = new Color3(0.8, 0.1, 0.1);
    mat.roughness = 0.3;
    mat.backFaceCulling = false;
    tarjeta.material = mat;
    creados.push(tarjeta);

    const fecha = new TextBlock(`fechaTarjeta_${id}`, "Vence: 15/06");
    fecha.color = "white";
    fecha.fontSize = 11;
    fecha.width = "100px";
    fecha.height = "20px";
    gui.addControl(fecha);
    fecha.linkWithMesh(tarjeta);
    fecha.linkOffsetY = 20;
  } else if (tipo === "manchaVisible") {
    const mancha = MeshBuilder.CreateDisc(`manchaAudit_${id}`, { radius: 0.18, tessellation: 14 }, scene);
    mancha.rotation.x = Math.PI / 2;
    mancha.position.set(x, y, z);
    const mat = new PBRMaterial(`matManchaAudit_${id}`, scene);
    mat.albedoColor = new Color3(0.12, 0.1, 0.07);
    mat.roughness = 0.15;
    mancha.material = mat;
    creados.push(mancha);
  } else if (tipo === "objetoFueraDeLugar") {
    const matCasilla = new PBRMaterial(`matCasillaAudit_${id}`, scene);
    matCasilla.albedoColor = new Color3(0.5, 0.55, 0.6);
    matCasilla.alpha = 0.45;
    matCasilla.roughness = 0.5;

    const casilla = MeshBuilder.CreateBox(`casillaAudit_${id}`, { width: 0.35, height: 0.02, depth: 0.35 }, scene);
    casilla.position.set(x - 0.13, y, z);
    casilla.material = matCasilla;
    creados.push(casilla);

    const matCaja = new PBRMaterial(`matObjetoFuera_${id}`, scene);
    matCaja.albedoColor = new Color3(0.6, 0.6, 0.65);
    matCaja.roughness = 0.7;

    const cajaFueraDeLugar = MeshBuilder.CreateBox(`objetoFuera_${id}`, { size: 0.16 }, scene);
    cajaFueraDeLugar.position.set(x + 0.13, y + 0.08, z);
    cajaFueraDeLugar.material = matCaja;
    creados.push(cajaFueraDeLugar);
  } else if (tipo === "sinProblema") {
    const matOk = new PBRMaterial(`matObjetoOk_${id}`, scene);
    matOk.albedoColor = new Color3(0.4, 0.45, 0.5);
    matOk.roughness = 0.6;

    const objetoOk = MeshBuilder.CreateBox(`objetoOk_${id}`, { width: 0.22, height: 0.13, depth: 0.13 }, scene);
    objetoOk.position.set(x, y + 0.065, z);
    objetoOk.material = matOk;
    creados.push(objetoOk);
  }

  return creados;
}