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
  /**
   * Altura mínima de las letras, EN METROS.
   *
   * Es el parámetro que decide si un cartel se puede leer o no desde la
   * cámara del juego, y por eso manda sobre el alto del cartel: si el texto no
   * entra, crece el cartel en vez de achicarse la letra.
   *
   * El valor por defecto sale de medir el rótulo de las zonas del Nivel 1, que
   * es el que sí se lee sin acercarse. Los carteles que se veían borrosos
   * tenían letras de 0,08 a 0,10 m — menos de la mitad.
   */
  alturaTextoMin?: number;
}

// Píxeles de textura por metro de cartel. A 256 la textura tenía menos
// píxeles de los que el cartel ocupa en pantalla cuando la cámara se acerca
// a su límite (4,5 m), y el texto se veía estirado y pixelado. A 512 sobra
// resolución en todo el rango de zoom.
const RESOLUCION = 640;

export function crearRotulo3D(
  scene: Scene,
  nombre: string,
  texto: string,
  posicion: Vector3,
  opciones: OpcionesRotulo = {}
): Mesh {
  const ancho = opciones.ancho ?? 1.1;
  const altoMinimo = opciones.alto ?? 0.3;
  const alturaTexto = opciones.alturaTextoMin ?? 0.19;
  const colorTexto = opciones.colorTexto ?? "#ffffff";
  const colorFondo = opciones.colorFondo ?? "#1d2227";
  const colorBorde = opciones.colorBorde ?? "rgba(255,255,255,0.35)";
  const lineasMax = Math.max(1, opciones.lineasMax ?? 1);

  const anchoPx = Math.round(ancho * RESOLUCION);

  // PRIMERO se decide el tamaño de la letra y cuántos renglones ocupa; recién
  // DESPUÉS se calcula el alto del cartel. Al revés — que era como estaba —
  // el alto fijo obligaba a encoger la letra hasta que entrara, y con tres
  // renglones en 34 cm terminaba midiendo 9 cm: ilegible salvo pegándose.
  const regla = document.createElement("canvas").getContext("2d")!;
  const margen = Math.round(alturaTexto * RESOLUCION * 0.3);
  const anchoUtil = anchoPx - margen * 3;

  let cuerpo = Math.round(alturaTexto * RESOLUCION);
  let renglones: string[] = [texto];

  // Solo se achica la letra si ni siquiera repartiendo en los renglones
  // permitidos entra a lo ancho. Es el último recurso, no el primero.
  while (cuerpo > 10) {
    regla.font = `600 ${cuerpo}px system-ui, "Segoe UI", sans-serif`;
    renglones = repartirEnRenglones(regla, texto, anchoUtil, lineasMax);
    const entra = renglones.length <= lineasMax && renglones.every((linea) => regla.measureText(linea).width <= anchoUtil);
    if (entra) break;
    cuerpo -= 2;
  }

  const separacion = cuerpo * 1.24;
  const altoPx = Math.max(
    Math.round(altoMinimo * RESOLUCION),
    Math.round(renglones.length * separacion + margen * 2.2)
  );
  const alto = altoPx / RESOLUCION;

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
  textura.anisotropicFilteringLevel = 16;

  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, anchoPx, altoPx);

  if (colorFondo !== "transparent") {
    trazarRectRedondo(ctx, margen * 0.5, margen * 0.5, anchoPx - margen, altoPx - margen, altoPx * 0.18);
    ctx.fillStyle = colorFondo;
    ctx.fill();
    if (colorBorde !== "transparent") {
      ctx.lineWidth = Math.max(2, cuerpo * 0.09);
      ctx.strokeStyle = colorBorde;
      ctx.stroke();
    }
  }

  ctx.font = `600 ${cuerpo}px system-ui, "Segoe UI", sans-serif`;
  // Contorno oscuro: mantiene el texto legible aunque el cartel quede contra
  // una pared clara o a contraluz de las ventanas del garaje.
  ctx.lineWidth = Math.max(3, cuerpo * 0.16);
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineJoin = "round";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

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