import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Observable, Vector3 } from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { crearRotulo3D } from "./Rotulo3D";
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
  _gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string,
  tipoEvidencia: TipoEvidencia
): AuditPointResult {
  const pedestal = crearPedestal(scene, id, x, z);
  const evidencia = crearEvidencia(scene, id, x, z, tipoEvidencia);

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

  // Rótulo sobre un cartel propio, encima del punto de control. Antes era
  // texto 2D anclado: con varios puntos repartidos por el garaje, las
  // descripciones se apilaban en el centro de la pantalla y no se sabía
  // cuál pertenecía a cuál.
  crearRotulo3D(scene, `punto_${id}`, descripcion, new Vector3(x, ALTURA_PEDESTAL + 1.28, z), {
    ancho: 1.25,
    alto: 0.34,
    lineasMax: 3,
    colorFondo: "#1d2227",
    colorBorde: "rgba(255,255,255,0.3)",
    mirarCamara: true,
  });

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

function crearEvidencia(scene: Scene, id: string, x: number, z: number, tipo: TipoEvidencia): Mesh[] {
  const y = ALTURA_PEDESTAL + 0.01;
  const creados: Mesh[] = [];

  // Evidencias agrandadas y con más brillo respecto a la versión
  // original: a la distancia de cámara fija de este nivel, el tamaño de
  // antes era casi ilegible. Esto no cambia la mecánica — solo la hace
  // visible sin tener que adivinar.
  if (tipo === "tarjetaVencida") {
    const tarjeta = MeshBuilder.CreatePlane(`tarjeta_${id}`, { width: 0.55, height: 0.65 }, scene);
    tarjeta.position.set(x, y + 0.35, z);
    tarjeta.rotation.y = Math.PI / 4;
    const mat = new PBRMaterial(`matTarjeta_${id}`, scene);
    mat.albedoColor = new Color3(0.85, 0.1, 0.1);
    mat.emissiveColor = new Color3(0.5, 0.03, 0.03);
    mat.roughness = 0.3;
    mat.backFaceCulling = false;
    tarjeta.material = mat;
    creados.push(tarjeta);

    // La fecha vencida es la pista de la desviación: va pintada sobre la
    // propia tarjeta roja, como estaría en una tarjeta de verdad.
    crearRotulo3D(scene, `fechaTarjeta_${id}`, "VENCE 15/06", new Vector3(0, -0.16, -0.012), {
      ancho: 0.34,
      alto: 0.11,
      colorFondo: "#5c0f0f",
      colorBorde: "rgba(255,200,200,0.55)",
      padre: tarjeta,
    });
  } else if (tipo === "manchaVisible") {
    const mat = new PBRMaterial(`matManchaAudit_${id}`, scene);
    mat.albedoColor = new Color3(0.08, 0.06, 0.04);
    mat.roughness = 0.1;

    const mancha = MeshBuilder.CreateDisc(`manchaAudit_${id}`, { radius: 0.34, tessellation: 20 }, scene);
    mancha.rotation.x = Math.PI / 2;
    mancha.position.set(x, y, z);
    mancha.material = mat;
    creados.push(mancha);

    // Segunda salpicadura, más chica, para que se lea como un derrame
    // real y no como un punto perfecto y simétrico.
    const salpicadura = MeshBuilder.CreateDisc(`salpicaduraAudit_${id}`, { radius: 0.14, tessellation: 12 }, scene);
    salpicadura.rotation.x = Math.PI / 2;
    salpicadura.position.set(x + 0.24, y + 0.001, z + 0.2);
    salpicadura.material = mat;
    creados.push(salpicadura);
  } else if (tipo === "objetoFueraDeLugar") {
    const matCasilla = new PBRMaterial(`matCasillaAudit_${id}`, scene);
    matCasilla.albedoColor = new Color3(0.5, 0.55, 0.6);
    matCasilla.alpha = 0.5;
    matCasilla.roughness = 0.5;

    const casilla = MeshBuilder.CreateBox(`casillaAudit_${id}`, { width: 0.55, height: 0.02, depth: 0.55 }, scene);
    casilla.position.set(x - 0.24, y, z);
    casilla.material = matCasilla;
    creados.push(casilla);

    const matCaja = new PBRMaterial(`matObjetoFuera_${id}`, scene);
    matCaja.albedoColor = new Color3(0.65, 0.6, 0.3);
    matCaja.emissiveColor = new Color3(0.15, 0.13, 0.02);
    matCaja.roughness = 0.6;

    const cajaFueraDeLugar = MeshBuilder.CreateBox(`objetoFuera_${id}`, { size: 0.28 }, scene);
    cajaFueraDeLugar.position.set(x + 0.24, y + 0.14, z);
    cajaFueraDeLugar.material = matCaja;
    creados.push(cajaFueraDeLugar);
  } else if (tipo === "sinProblema") {
    const matOk = new PBRMaterial(`matObjetoOk_${id}`, scene);
    matOk.albedoColor = new Color3(0.42, 0.47, 0.52);
    matOk.roughness = 0.6;

    const objetoOk = MeshBuilder.CreateBox(`objetoOk_${id}`, { width: 0.3, height: 0.16, depth: 0.16 }, scene);
    objetoOk.position.set(x, y + 0.08, z);
    objetoOk.material = matOk;
    creados.push(objetoOk);
  }

  return creados;
}