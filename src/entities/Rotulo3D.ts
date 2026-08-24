import { Scene, MeshBuilder, DynamicTexture, StandardMaterial, Texture, Color3, Mesh, Vector3 } from "@babylonjs/core";

/**
 * Cartel con texto pintado DENTRO de la escena 3D.
 *
 * Reemplaza a los TextBlock de la interfaz anclados con linkWithMesh. Ese
 * enfoque tenía tres problemas que se veían apenas la cámara dejaba de estar
 * fija:
 *
 *   - el texto se dibujaba siempre del mismo tamaño en píxeles, así que al
 *     alejarse las etiquetas se amontonaban unas sobre otras en el centro de
 *     la pantalla y no se entendía a qué objeto pertenecía cada una;
 *   - se recortaban contra el ancho fijo del control;
 *   - se veían a través de las paredes, porque la interfaz se dibuja encima
 *     de todo.
 *
 * Al pintar el texto sobre una malla, el rótulo se comporta como cualquier
 * objeto del garaje: se achica con la distancia, lo tapa lo que esté delante
 * y nunca se superpone con otro.
 */
export interface OpcionesRotulo {
  /** Ancho del cartel en metros. */
  ancho?: number;
  /** Alto del cartel en metros. */
  alto?: number;
  colorTexto?: string;
  /** Fondo del cartel. Usar "transparent" para texto suelto. */
  colorFondo?: string;
  colorBorde?: string;
  /** Si es true, el cartel gira sobre su eje vertical para mirar a la cámara. */
  mirarCamara?: boolean;
  /** Malla de la que cuelga el cartel. La posición pasa a ser relativa a ella. */
  padre?: Mesh;
  /** Máximo de renglones. Con más de uno, el texto se reparte por palabras. */
  lineasMax?: number;
}

// Píxeles de textura por metro de cartel. A 256 la textura tenía menos
// píxeles de los que el cartel ocupa en pantalla cuando la cámara se acerca
// a su límite (4,5 m), y el texto se veía estirado y pixelado. A 512 sobra
// resolución en todo el rango de zoom.
const RESOLUCION = 512;

export function crearRotulo3D(
  scene: Scene,
  nombre: string,
  texto: string,
  posicion: Vector3,
  opciones: OpcionesRotulo = {}
): Mesh {
  const ancho = opciones.ancho ?? 1.1;
  const alto = opciones.alto ?? 0.3;
  const colorTexto = opciones.colorTexto ?? "#ffffff";
  const colorFondo = opciones.colorFondo ?? "#1d2227";
  const colorBorde = opciones.colorBorde ?? "rgba(255,255,255,0.35)";

  const anchoPx = Math.round(ancho * RESOLUCION);
  const altoPx = Math.round(alto * RESOLUCION);

  const textura = new DynamicTexture(
    `texturaRotulo_${nombre}`,
    { width: anchoPx, height: altoPx },
    scene,
    true
  );
  textura.hasAlpha = true;
  // Filtrado trilineal + anisotrópico: sin esto el texto se deshace en cuanto
  // el cartel se ve en ángulo, que es lo normal al orbitar por el garaje.
  textura.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  textura.anisotropicFilteringLevel = 8;

  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, anchoPx, altoPx);

  const margen = Math.round(altoPx * 0.08);

  if (colorFondo !== "transparent") {
    trazarRectRedondo(ctx, margen, margen, anchoPx - margen * 2, altoPx - margen * 2, altoPx * 0.22);
    ctx.fillStyle = colorFondo;
    ctx.fill();
    if (colorBorde !== "transparent") {
      ctx.lineWidth = Math.max(2, altoPx * 0.045);
      ctx.strokeStyle = colorBorde;
      ctx.stroke();
    }
  }

  // El texto se ajusta al espacio disponible en vez de recortarse: se arranca
  // de un cuerpo generoso y se baja hasta que entra, repartiéndolo en
  // renglones si hace falta. Así "DESCARTAR" y una descripción de cuarenta
  // caracteres quedan las dos completas y legibles.
  const lineasMax = Math.max(1, opciones.lineasMax ?? 1);
  const anchoUtil = anchoPx - margen * 4;
  const altoUtil = altoPx - margen * 3;

  let cuerpo = Math.round((altoPx * 0.62) / lineasMax);
  let renglones: string[] = [texto];

  while (cuerpo > 8) {
    ctx.font = `600 ${cuerpo}px system-ui, "Segoe UI", sans-serif`;
    renglones = repartirEnRenglones(ctx, texto, anchoUtil, lineasMax);
    const entraAncho = renglones.every((linea) => ctx.measureText(linea).width <= anchoUtil);
    const entraAlto = renglones.length * cuerpo * 1.2 <= altoUtil;
    if (entraAncho && entraAlto) break;
    cuerpo -= 1;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Contorno oscuro: mantiene el texto legible aunque el cartel quede contra
  // una pared clara o a contraluz de las ventanas del garaje.
  ctx.lineWidth = Math.max(3, cuerpo * 0.16);
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineJoin = "round";

  const separacion = cuerpo * 1.2;
  const yInicial = altoPx / 2 - ((renglones.length - 1) * separacion) / 2;

  renglones.forEach((linea, i) => {
    const y = yInicial + i * separacion;
    ctx.strokeText(linea, anchoPx / 2, y);
    ctx.fillStyle = colorTexto;
    ctx.fillText(linea, anchoPx / 2, y);
  });

  textura.update();

  const material = new StandardMaterial(`matRotulo_${nombre}`, scene);
  material.diffuseTexture = textura;
  material.opacityTexture = textura;
  material.emissiveColor = new Color3(1, 1, 1);
  material.diffuseColor = new Color3(0, 0, 0);
  material.specularColor = new Color3(0, 0, 0);
  // Sin esto el cartel se oscurece con la iluminación del garaje y el texto
  // deja de leerse desde los ángulos en sombra.
  material.disableLighting = true;
  material.backFaceCulling = false;

  const cartel = MeshBuilder.CreatePlane(`rotulo_${nombre}`, { width: ancho, height: alto }, scene);
  cartel.material = material;
  cartel.position = posicion.clone();
  cartel.isPickable = false;

  if (opciones.padre) {
    cartel.parent = opciones.padre;
  }

  if (opciones.mirarCamara) {
    // Solo sobre el eje vertical: el cartel sigue al jugador al orbitar pero
    // no se inclina, así se mantiene derecho como un letrero de verdad.
    cartel.billboardMode = Mesh.BILLBOARDMODE_Y;
  }

  return cartel;
}

/** Reparte el texto en renglones por palabras, sin cortar ninguna al medio. */
function repartirEnRenglones(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoUtil: number,
  lineasMax: number
): string[] {
  if (lineasMax <= 1) return [texto];

  const palabras = texto.split(/\s+/);
  const renglones: string[] = [];
  let actual = "";

  palabras.forEach((palabra) => {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(tentativa).width <= anchoUtil || !actual) {
      actual = tentativa;
    } else {
      renglones.push(actual);
      actual = palabra;
    }
  });
  if (actual) renglones.push(actual);

  // Si no alcanzan los renglones permitidos, se devuelve tal cual: el bucle
  // que llama va a bajar el cuerpo hasta que quepa.
  return renglones;
}

function trazarRectRedondo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}