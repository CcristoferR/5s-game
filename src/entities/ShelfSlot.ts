import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Vector3 } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { crearRotulo3D } from "./Rotulo3D";
import { ALTURA_SUPERFICIE_BANCO } from "./Workbench";

export interface ShelfSlotResult {
  mesh: Mesh;
  id: string;
}

const Z_ESTACION = 1.8;
const ANCHO_TABLA = 1.15;

// Silueta punteada impresa sobre la madera: el recurso visual con el que una
// planta marca "aca va algo" sin necesidad de un cartel. Se genera por codigo
// para no depender de un archivo de imagen.
function crearTexturaSilueta(scene: Scene, id: string, sufijo: string, colorFondo: string): DynamicTexture {
  const textura = new DynamicTexture(`texturaSilueta_${id}_${sufijo}`, { width: 256, height: 256 }, scene, true);
  const ctx = textura.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = colorFondo;
  ctx.fillRect(0, 0, 256, 256);

  // Veta de madera muy tenue: sin esto la tabla se lee como carton liso.
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 2;
  for (let y = 8; y < 256; y += 17) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(70, y - 4, 170, y + 4, 256, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.setLineDash([12, 9]);
  ctx.lineWidth = 5;
  ctx.strokeRect(44, 44, 168, 168);
  ctx.setLineDash([]);
  textura.update();

  return textura;
}

/**
 * Estacion del shadow board donde el jugador deja cada objeto.
 *
 * Es una estanteria de taller completa — bastidor metalico, tabla con la
 * silueta punteada y panel vertical al fondo con la misma marca — en lugar de
 * la tabla suelta sobre dos postes que habia antes. La cara superior de la
 * tabla queda exactamente a la altura del banco de trabajo, asi los objetos
 * arrastrados apoyan sobre ella en vez de flotar o hundirse.
 */
export function crearShelfSlot(scene: Scene, _gui: AdvancedDynamicTexture, id: string, x: number, descripcion: string): ShelfSlotResult {
  const matMetal = new PBRMaterial(`matMetalRepisa_${id}`, scene);
  matMetal.albedoColor = new Color3(0.33, 0.35, 0.38);
  matMetal.roughness = 0.4;
  matMetal.metallic = 0.72;
  matMetal.albedoTexture = texturaMetalCepillado(scene);
  matMetal.microSurfaceTexture = texturaGrano(scene, 0.14);

  // Patas: dos montantes a los costados, como una estanteria de taller.
  const alturaMontante = ALTURA_SUPERFICIE_BANCO - 0.05;
  [-1, 1].forEach((lado, i) => {
    const montante = MeshBuilder.CreateBox(`montanteRepisa_${id}_${i}`, { width: 0.07, height: alturaMontante, depth: 0.07 }, scene);
    montante.position.set(x + lado * (ANCHO_TABLA / 2 - 0.09), alturaMontante / 2, Z_ESTACION);
    montante.material = matMetal;
    montante.receiveShadows = true;
  });

  // Travesanio bajo, que ademas evita que las patas se lean como dos palos sueltos.
  const travesanio = MeshBuilder.CreateBox(`travesanioRepisa_${id}`, { width: ANCHO_TABLA - 0.18, height: 0.05, depth: 0.05 }, scene);
  travesanio.position.set(x, 0.22, Z_ESTACION);
  travesanio.material = matMetal;
  travesanio.receiveShadows = true;

  // Tabla: la superficie util. Su cara de arriba coincide con la del banco.
  const matTabla = new PBRMaterial(`matTablaRepisa_${id}`, scene);
  matTabla.albedoTexture = crearTexturaSilueta(scene, id, "tabla", "#7a5434");
  matTabla.roughness = 0.62;
  matTabla.microSurfaceTexture = texturaGrano(scene, 0.07);
  matTabla.metallic = 0;

  const tabla = MeshBuilder.CreateBox(`tablaRepisa_${id}`, { width: ANCHO_TABLA, height: 0.05, depth: 1.1 }, scene);
  tabla.position.set(x, ALTURA_SUPERFICIE_BANCO - 0.025, Z_ESTACION);
  tabla.material = matTabla;
  tabla.receiveShadows = true;

  // Panel vertical al fondo: es lo que convierte la repisa en un shadow board
  // de verdad y le da presencia dentro de un galpon grande.
  const matPanel = new PBRMaterial(`matPanelRepisa_${id}`, scene);
  matPanel.albedoTexture = crearTexturaSilueta(scene, id, "panel", "#6d4b2f");
  matPanel.roughness = 0.68;
  matPanel.microSurfaceTexture = texturaGrano(scene, 0.07);
  matPanel.metallic = 0;
  matPanel.backFaceCulling = false;

  const panel = MeshBuilder.CreateBox(`panelRepisa_${id}`, { width: ANCHO_TABLA, height: 0.95, depth: 0.05 }, scene);
  panel.position.set(x, ALTURA_SUPERFICIE_BANCO + 0.475, Z_ESTACION + 0.55);
  panel.material = matPanel;
  panel.receiveShadows = true;

  // Marco del panel: le da espesor y lo despega visualmente del fondo.
  const marcoSuperior = MeshBuilder.CreateBox(`marcoRepisa_${id}`, { width: ANCHO_TABLA + 0.06, height: 0.06, depth: 0.09 }, scene);
  marcoSuperior.position.set(x, ALTURA_SUPERFICIE_BANCO + 0.98, Z_ESTACION + 0.55);
  marcoSuperior.material = matMetal;
  marcoSuperior.receiveShadows = true;

  // Rótulo pintado sobre una placa colgada del marco. Antes era texto 2D
  // anclado al marco: al girar la cámara las cinco descripciones se juntaban
  // en el centro de la pantalla y se recortaban entre sí.
  crearRotulo3D(
    scene,
    `repisa_${id}`,
    descripcion,
    new Vector3(x, ALTURA_SUPERFICIE_BANCO + 1.16, Z_ESTACION + 0.5),
    {
      // Más ancho que la tabla a propósito: las estaciones están separadas
      // 2,2 m, así que hay lugar de sobra, y con un cartel angosto la frase
      // necesitaba tres renglones diminutos.
      ancho: 1.9,
      alto: 0.34,
      lineasMax: 3, // las descripciones del nivel 2 son frases, no palabras
      colorFondo: "#20262c",
      colorBorde: "rgba(255,255,255,0.28)",
    }
  );

  return { mesh: tabla, id };
}