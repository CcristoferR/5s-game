import { Scene, DynamicTexture, Texture } from "@babylonjs/core";

// ===========================================================================
// Texturas procedurales del puesto
// ===========================================================================
//
// Todas se dibujan con código, sin archivos de imagen. Es lo mismo que hace el
// 5S, pero aquí llevan una pieza que allá no hacía falta: MAPA DE RELIEVE.
//
// ─── QUÉ CAMBIA UN MAPA DE RELIEVE ────────────────────────────────────────
//
// Una textura de color sola pinta la madera, pero la superficie sigue siendo
// matemáticamente lisa: la luz la recorre sin encontrar nada. El resultado es
// una foto de madera pegada sobre un plástico, y se nota especialmente de
// cerca y con luz rasante — que es exactamente esta escena, con un flexo a
// veinte centímetros del mesón.
//
// El mapa de relieve le dice al motor cómo se inclina la superficie en cada
// punto. La veta de la madera entonces atrapa la luz del flexo por un lado y
// se ensombrece por el otro, el papel del libro deja ver su fibra, y el caucho
// de la radio se ve rugoso. Nada de eso existe en la geometría: son dos
// texturas y un número.
//
// ─── POR QUÉ SE GENERA EL RELIEVE DEL PROPIO DIBUJO ───────────────────────
//
// Cada función dibuja el color y deriva el relieve de la MISMA imagen,
// convirtiendo claro/oscuro en alto/bajo. Así los dos mapas no se pueden
// desalinear: si mañana se cambia el dibujo de la veta, el relieve la sigue
// solo. Dibujar dos texturas a mano y mantenerlas emparejadas es un trabajo
// que siempre acaba desincronizado.

/** Cuánto se nota el relieve. Más alto exagera; 1 es el natural del dibujo. */
const FUERZA_RELIEVE = 1;

/**
 * Convierte un dibujo en su mapa de relieve.
 *
 * El truco es el que usa cualquier programa de texturas: la pendiente de la
 * superficie en un punto es la diferencia de brillo con sus vecinos. Se recorre
 * la imagen comparando cada píxel con el de su derecha y el de abajo, y esas
 * dos diferencias son las componentes X e Y de la normal.
 *
 * Sale una imagen azulada porque una superficie plana apunta hacia afuera:
 * normal (0, 0, 1), que codificada en color es (128, 128, 255).
 */
function relieveDesde(scene: Scene, nombre: string, origen: DynamicTexture, fuerza = FUERZA_RELIEVE): Texture {
  const lienzo = origen.getContext().canvas;
  const w = lienzo.width;
  const h = lienzo.height;

  const fuente = origen.getContext().getImageData(0, 0, w, h);
  const destino = new DynamicTexture(nombre, { width: w, height: h }, scene, false);

  // El contexto que devuelve Babylon es una interfaz reducida, sin
  // createImageData ni ellipse. El lienzo de debajo sí es el del navegador y
  // lo tiene todo, así que para estas dos cosas se usa directamente.
  const ctx = destino.getContext() as unknown as CanvasRenderingContext2D;
  const salida = ctx.createImageData(w, h);

  const brillo = (x: number, y: number): number => {
    const px = ((y + h) % h) * w * 4 + ((x + w) % w) * 4;
    // Media ponderada: el ojo percibe el verde mucho más que el azul, y una
    // media plana daría un relieve raro en superficies de color saturado.
    return (
      fuente.data[px] * 0.299 + fuente.data[px + 1] * 0.587 + fuente.data[px + 2] * 0.114
    );
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (brillo(x + 1, y) - brillo(x - 1, y)) / 255;
      const dy = (brillo(x, y + 1) - brillo(x, y - 1)) / 255;

      const i = (y * w + x) * 4;
      salida.data[i] = Math.max(0, Math.min(255, 128 - dx * 127 * fuerza));
      salida.data[i + 1] = Math.max(0, Math.min(255, 128 - dy * 127 * fuerza));
      salida.data[i + 2] = 255;
      salida.data[i + 3] = 255;
    }
  }

  ctx.putImageData(salida, 0, 0);
  destino.update();
  return destino;
}

export interface Superficie {
  color: DynamicTexture;
  relieve: Texture;
}

// ---------------------------------------------------------------------------
// Madera del mesón
// ---------------------------------------------------------------------------

/**
 * Veta de madera con poro, nudos y desgaste.
 *
 * La veta se hace con ruido de una sola dimensión estirado a lo largo: cada
 * línea de la imagen desplaza su curva un poco respecto a la anterior, y eso
 * produce las bandas irregulares y paralelas de una tabla cortada al hilo.
 * Ruido en dos dimensiones daría manchas, que es como se ve el mármol, no la
 * madera.
 */
export function superficieMadera(scene: Scene, nombre: string): Superficie {
  const W = 1024;
  const H = 1024;

  const color = new DynamicTexture(nombre, { width: W, height: H }, scene, true);
  const ctx = color.getContext() as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = "#4a3323";
  ctx.fillRect(0, 0, W, H);

  // Bandas de veta.
  for (let banda = 0; banda < 46; banda++) {
    const base = (banda / 46) * H + (Math.random() - 0.5) * 12;
    const grosor = 5 + Math.random() * 22;
    const tono = 0.5 + Math.random() * 0.5;

    ctx.beginPath();
    ctx.moveTo(0, base);
    // Cada banda ondula suavemente a lo largo de la tabla.
    for (let x = 0; x <= W; x += 26) {
      const onda =
        Math.sin(x * 0.006 + banda) * 5 +
        Math.sin(x * 0.017 + banda * 2.3) * 2.6 +
        (Math.random() - 0.5) * 1.6;
      ctx.lineTo(x, base + onda);
    }
    ctx.strokeStyle = `rgba(${28 + tono * 40}, ${18 + tono * 26}, ${10 + tono * 16}, ${0.16 + tono * 0.3})`;
    ctx.lineWidth = grosor;
    ctx.stroke();
  }

  // Poro: los puntos finos que tiene toda madera de cerca. Es lo que más se
  // nota bajo el flexo, porque cada uno atrapa una chispa de luz.
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(20, 12, 6, ${0.05 + Math.random() * 0.16})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2.4, 1);
  }

  // Dos nudos. Sin ellos la tabla se ve generada; con demasiados, de dibujos
  // animados.
  [[0.24, 0.31], [0.72, 0.68]].forEach(([fx, fy]) => {
    const cx = fx * W;
    const cy = fy * H;
    for (let r = 46; r > 0; r -= 2.6) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.44, 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(26, 16, 8, ${0.1 + (1 - r / 46) * 0.3})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  });

  // Roces del uso, siempre en la misma dirección: alguien apoyando y
  // arrastrando cosas sobre el mesón durante años.
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const largo = 12 + Math.random() * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + largo, y + (Math.random() - 0.5) * 4);
    ctx.strokeStyle = `rgba(210, 190, 160, ${0.02 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  color.update();
  return { color, relieve: relieveDesde(scene, `${nombre}_relieve`, color, 1.5) };
}

// ---------------------------------------------------------------------------
// Caucho de la radio
// ---------------------------------------------------------------------------

/**
 * Plástico con textura de agarre, como el de una radio de servicio.
 *
 * Un cuadriculado de puntos en relieve más el brillo desgastado de las zonas
 * que la mano toca todos los días. Ese desgaste es lo que separa un equipo en
 * uso de uno recién comprado, y aquí importa: el manual habla de radios que se
 * entregan de turno en turno.
 */
export function superficieCaucho(scene: Scene, nombre: string): Superficie {
  const W = 512;
  const H = 512;

  const color = new DynamicTexture(nombre, { width: W, height: H }, scene, true);
  const ctx = color.getContext();

  ctx.fillStyle = "#16181c";
  ctx.fillRect(0, 0, W, H);

  // Retícula de agarre.
  for (let y = 4; y < H; y += 9) {
    for (let x = 4 + ((y / 9) % 2) * 4; x < W; x += 9) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "#22262c";
      ctx.fill();
      // Realce arriba y sombra abajo: da volumen al punto incluso antes de
      // que el mapa de relieve haga su parte.
      ctx.beginPath();
      ctx.arc(x - 0.5, y - 0.7, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120,128,140,0.14)";
      ctx.fill();
    }
  }

  // Desgaste: los cantos y la zona de agarre, pulidos por el uso.
  const desgaste = ctx.createLinearGradient(0, 0, W, H);
  desgaste.addColorStop(0, "rgba(150, 156, 168, 0.1)");
  desgaste.addColorStop(0.5, "rgba(150, 156, 168, 0)");
  desgaste.addColorStop(1, "rgba(150, 156, 168, 0.07)");
  ctx.fillStyle = desgaste;
  ctx.fillRect(0, 0, W, H);

  // Cuatro rayones. Pocos y finos: un equipo cuidado, no destrozado.
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, Math.random() * H);
    ctx.lineTo(Math.random() * W, Math.random() * H);
    ctx.strokeStyle = "rgba(190, 196, 208, 0.07)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  color.update();
  return { color, relieve: relieveDesde(scene, `${nombre}_relieve`, color, 2.2) };
}

// ---------------------------------------------------------------------------
// Papel
// ---------------------------------------------------------------------------

/**
 * Fibra de papel, para darle relieve a las páginas del libro.
 *
 * Solo devuelve el relieve: el color de la página lo dibuja el propio libro con
 * su rayado y sus encabezados. Lo que hace falta es que ese papel no sea un
 * plano perfecto — la fibra es lo que hace que la luz del flexo se reparta de
 * forma irregular sobre la hoja en vez de dar un brillo plano de plástico.
 */
export function relievePapel(scene: Scene, nombre: string): Texture {
  const W = 512;
  const H = 512;

  const base = new DynamicTexture(`${nombre}_base`, { width: W, height: H }, scene, false);
  const ctx = base.getContext();

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, W, H);

  // Fibra: trazos cortos en todas direcciones, muy tenues.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const ang = Math.random() * Math.PI;
    const largo = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * largo, y + Math.sin(ang) * largo);
    ctx.strokeStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  base.update();
  return relieveDesde(scene, nombre, base, 0.55);
}

// ---------------------------------------------------------------------------
// Hormigón pulido del hall
// ---------------------------------------------------------------------------

/**
 * Piso de hormigón pulido, con sus vetas y sus juntas.
 *
 * Es la superficie que más metros ocupa de la escena y la que devuelve los
 * reflejos de la farola y del monitor. Un piso liso de un solo color deja esos
 * reflejos como manchas perfectas, que es lo que delata una imagen generada;
 * con la irregularidad del hormigón, el reflejo se rompe y se ve real.
 */
export function superficieHormigon(scene: Scene, nombre: string): Superficie {
  const W = 1024;
  const H = 1024;

  const color = new DynamicTexture(nombre, { width: W, height: H }, scene, true);
  const ctx = color.getContext();

  ctx.fillStyle = "#3a3d44";
  ctx.fillRect(0, 0, W, H);

  // Nubes de tono: el hormigón nunca cura parejo.
  for (let i = 0; i < 190; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 40 + Math.random() * 190;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const claro = Math.random() > 0.5;
    g.addColorStop(0, claro ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Árido: los granos de piedra que asoman en un pulido.
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.55
      ? `rgba(190, 194, 202, ${0.04 + Math.random() * 0.08})`
      : `rgba(24, 26, 30, ${0.05 + Math.random() * 0.1})`;
    ctx.fill();
  }

  // Juntas de dilatación.
  ctx.strokeStyle = "rgba(14, 15, 18, 0.55)";
  ctx.lineWidth = 3;
  [0.5].forEach((f) => {
    ctx.beginPath();
    ctx.moveTo(f * W, 0);
    ctx.lineTo(f * W, H);
    ctx.moveTo(0, f * H);
    ctx.lineTo(W, f * H);
    ctx.stroke();
  });

  color.update();
  return { color, relieve: relieveDesde(scene, `${nombre}_relieve`, color, 0.8) };
}