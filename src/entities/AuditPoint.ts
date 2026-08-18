import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import type { TipoEvidencia } from "../data/levelConfig";

export interface AuditPointResult {
  mesh: Mesh;
  estaMarcado: () => boolean;
  onCambio: Observable<boolean>;
}

export function crearPuntoControl(
  scene: Scene,
  gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string,
  tipoEvidencia: TipoEvidencia
): AuditPointResult {
  crearEvidencia(scene, id, x, z, tipoEvidencia);

  const mesh = MeshBuilder.CreateSphere(`punto_${id}`, { diameter: 0.28 }, scene);
  mesh.position.set(x, 1.3, z);

  const colorNeutro = new Color3(0.55, 0.55, 0.6);
  const colorMarcado = new Color3(0.85, 0.45, 0.1); // naranja — mucho más notorio que solo agrandar

  const mat = new StandardMaterial(`matPunto_${id}`, scene);
  mat.diffuseColor = colorNeutro;
  mat.emissiveColor = colorNeutro.scale(0.15);
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
    mat.diffuseColor = marcado ? colorMarcado : colorNeutro;
    mat.emissiveColor = (marcado ? colorMarcado : colorNeutro).scale(marcado ? 0.35 : 0.15);
    onCambio.notifyObservers(marcado);
  });

  return { mesh, estaMarcado: () => marcado, onCambio };
}

function crearEvidencia(scene: Scene, id: string, x: number, z: number, tipo: TipoEvidencia): void {
  const y = 0.92;

  if (tipo === "tarjetaVencida") {
    const tarjeta = MeshBuilder.CreatePlane(`tarjeta_${id}`, { width: 0.3, height: 0.4 }, scene);
    tarjeta.position.set(x, y + 0.2, z);
    const mat = new StandardMaterial(`matTarjeta_${id}`, scene);
    mat.diffuseColor = new Color3(0.8, 0.1, 0.1);
    mat.backFaceCulling = false;
    tarjeta.material = mat;

    const fecha = new TextBlock(`fechaTarjeta_${id}`, "Vence: 15/06");
    fecha.color = "white";
    fecha.fontSize = 11;
    fecha.width = "100px";
    fecha.height = "20px";
    AdvancedDynamicTexture.CreateFullscreenUI(`fechaUI_${id}`, true, scene).addControl(fecha);
    fecha.linkWithMesh(tarjeta);
    fecha.linkOffsetY = 25;
  } else if (tipo === "manchaVisible") {
    const mancha = MeshBuilder.CreateCylinder(`manchaAudit_${id}`, { diameter: 0.35, height: 0.02 }, scene);
    mancha.position.set(x, y, z);
    const mat = new StandardMaterial(`matManchaAudit_${id}`, scene);
    mat.diffuseColor = new Color3(0.15, 0.12, 0.08);
    mancha.material = mat;
  } else if (tipo === "objetoFueraDeLugar") {
    const casilla = MeshBuilder.CreateBox(`casillaAudit_${id}`, { width: 0.4, height: 0.02, depth: 0.4 }, scene);
    casilla.position.set(x - 0.35, y, z);
    const matCasilla = new StandardMaterial(`matCasillaAudit_${id}`, scene);
    matCasilla.diffuseColor = new Color3(0.5, 0.55, 0.6);
    matCasilla.alpha = 0.4;
    casilla.material = matCasilla;

    const cajaFueraDeLugar = MeshBuilder.CreateBox(`objetoFuera_${id}`, { size: 0.2 }, scene);
    cajaFueraDeLugar.position.set(x + 0.35, y + 0.1, z);
    const matCaja = new StandardMaterial(`matObjetoFuera_${id}`, scene);
    matCaja.diffuseColor = new Color3(0.6, 0.6, 0.65);
    cajaFueraDeLugar.material = matCaja;
  } else if (tipo === "sinProblema") {
    const objetoOk = MeshBuilder.CreateBox(`objetoOk_${id}`, { width: 0.25, height: 0.15, depth: 0.15 }, scene);
    objetoOk.position.set(x, y + 0.08, z);
    const mat = new StandardMaterial(`matObjetoOk_${id}`, scene);
    mat.diffuseColor = new Color3(0.4, 0.45, 0.5);
    objetoOk.material = mat;
  }
}