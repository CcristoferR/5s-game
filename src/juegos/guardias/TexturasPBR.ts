import { Scene, RawTexture, Texture, Mesh, VertexBuffer } from "@babylonjs/core";

// ===========================================================================
// Texturas PBR del puesto, calculadas texel a texel
// ===========================================================================
//
// Lo que había en TexturasPuesto era un dibujo de color y un relieve sacado de
// su brillo. Sirve de lejos, pero bajo un flexo a medio metro se nota lo que
// le falta: la rugosidad era un solo número para toda la tabla, así que la veta
// se veía pintada encima de un plástico que brillaba igual en todas partes.
//
// ─── QUÉ CAMBIA ───────────────────────────────────────────────────────────
//
// Cada material sale con sus mapas completos, y todos del MISMO cálculo:
//
//   · COLOR: el tono de la madera, tabla por tabla.
//   · NORMALES: calculadas desde una altura en METROS, no desde el brillo del
//     dibujo. La veta tardía queda una décima de milímetro por encima de la
//     temprana, el poro se hunde, la junta entre tablas es un surco. Por eso
//     la luz rasante las separa como en una mesa de verdad.
//   · OCLUSIÓN, RUGOSIDAD Y METAL empaquetados en un solo mapa, como los pide
//     Babylon: el poro es mate, la veta tardía algo más cerrada.
//   · BARNIZ: una segunda capa con su intensidad, su rugosidad y su propio
//     relieve. Es la que devuelve el reflejo nítido del flexo y de las
//     luminarias, y la que se gasta donde se apoyan los antebrazos.
//
// ─── POR QUÉ BUFFERS Y NO UN LIENZO ───────────────────────────────────────
//
// Un lienzo 2D guarda el color premultiplicado y redondea en cada operación.
// Para una foto da igual; para un mapa de normales, donde 128 significa
// "plano", dos niveles de error son un relieve fantasma. Aquí se escriben los
// bytes exactos y se suben con RawTexture.
//
// Y de paso el cálculo no toca el navegador: se puede ejecutar y comprobar
// fuera del juego.

/** Un mapa RGBA de 8 bits, fila 0 = v 0. */
export interface Mapa {
  ancho: number;
  alto: number;
  datos: Uint8Array;
}

// ---------------------------------------------------------------------------
// Azar reproducible y ruido
// ---------------------------------------------------------------------------

/**
 * Generador con semilla. El mesón tiene que salir igual cada vez que se entra
 * al turno: una mesa que cambia de veta entre partidas no es una mesa.
 */
export function crearAzar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix: number, iy: number, semilla: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(semilla, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor suavizado, de 0 a 1. */
export function ruido(x: number, y: number, semilla: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, semilla);
  const b = hash(ix + 1, iy, semilla);
  const c = hash(ix, iy + 1, semilla);
  const d = hash(ix + 1, iy + 1, semilla);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Suma de octavas de ruido, de 0 a 1. */
export function fbm(x: number, y: number, semilla: number, octavas = 4): number {
  let suma = 0;
  let amplitud = 0.5;
  let norma = 0;
  let px = x;
  let py = y;
  for (let o = 0; o < octavas; o++) {
    suma += ruido(px, py, semilla + o * 131) * amplitud;
    norma += amplitud;
    amplitud *= 0.5;
    px *= 2.03;
    py *= 2.03;
  }
  return suma / norma;
}

const limitar = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);

function suave(a: number, b: number, x: number): number {
  const t = limitar((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

const byte = (v: number): number => Math.round(limitar(v) * 255);

/**
 * Campo de baja frecuencia muestreado cada `paso` texeles.
 *
 * La deformación de la veta, las manchas de tono y la ondulación del barniz
 * cambian a lo largo de centímetros: calcularlas en cada texel es gastar el
 * tiempo de carga en decimales que no se ven. Se calculan en una rejilla y se
 * interpolan.
 */
function campoGrueso(
  ancho: number,
  alto: number,
  paso: number,
  f: (x: number, y: number) => number
): (x: number, y: number) => number {
  const gw = Math.ceil(ancho / paso) + 2;
  const gh = Math.ceil(alto / paso) + 2;
  const valores = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) valores[gy * gw + gx] = f(gx * paso, gy * paso);
  }
  return (x, y) => {
    const fx = x / paso;
    const fy = y / paso;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * gw + x0;
    const a = valores[i] + (valores[i + 1] - valores[i]) * tx;
    const b = valores[i + gw] + (valores[i + gw + 1] - valores[i + gw]) * tx;
    return a + (b - a) * ty;
  };
}

/**
 * Normales desde una altura en metros.
 *
 * La pendiente se calcula con el tamaño REAL del texel en cada eje: el mesón
 * tiene más texeles por metro a lo ancho que a lo largo, y derivar en texeles
 * inclinaría la veta más en un sentido que en el otro.
 *
 * Convención de Babylon: R = componente hacia +U, G = hacia +V.
 */
function normalesDesdeAltura(
  altura: Float32Array,
  ancho: number,
  alto: number,
  metrosPorTexelU: number,
  metrosPorTexelV: number,
  exageracion: number
): Uint8Array {
  const salida = new Uint8Array(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    const ya = y > 0 ? y - 1 : y;
    const yb = y < alto - 1 ? y + 1 : y;
    for (let x = 0; x < ancho; x++) {
      const xa = x > 0 ? x - 1 : x;
      const xb = x < ancho - 1 ? x + 1 : x;
      const dhdu =
        (altura[y * ancho + xb] - altura[y * ancho + xa]) / ((xb - xa) * metrosPorTexelU);
      const dhdv =
        (altura[yb * ancho + x] - altura[ya * ancho + x]) / ((yb - ya) * metrosPorTexelV);
      const nx = -dhdu * exageracion;
      const ny = -dhdv * exageracion;
      const largo = Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * ancho + x) * 4;
      salida[i] = byte(nx / largo * 0.5 + 0.5);
      salida[i + 1] = byte(ny / largo * 0.5 + 0.5);
      salida[i + 2] = byte(1 / largo * 0.5 + 0.5);
      salida[i + 3] = 255;
    }
  }
  return salida;
}

/** Desenfoque de caja separable, para sacar la oclusión de la altura. */
function desenfocar(valores: Float32Array, ancho: number, alto: number, radio: number): Float32Array {
  const tmp = new Float32Array(valores.length);
  const salida = new Float32Array(valores.length);
  const n = radio * 2 + 1;
  for (let y = 0; y < alto; y++) {
    let suma = 0;
    for (let k = -radio; k <= radio; k++) suma += valores[y * ancho + limitar(k, 0, ancho - 1)];
    for (let x = 0; x < ancho; x++) {
      tmp[y * ancho + x] = suma / n;
      suma += valores[y * ancho + Math.min(ancho - 1, x + radio + 1)];
      suma -= valores[y * ancho + Math.max(0, x - radio)];
    }
  }
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    for (let k = -radio; k <= radio; k++) suma += tmp[limitar(k, 0, alto - 1) * ancho + x];
    for (let y = 0; y < alto; y++) {
      salida[y * ancho + x] = suma / n;
      suma += tmp[Math.min(alto - 1, y + radio + 1) * ancho + x];
      suma -= tmp[Math.max(0, y - radio) * ancho + x];
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Madera barnizada del mesón
// ---------------------------------------------------------------------------

export interface OpcionesMadera {
  /** Texeles a lo ancho de las tablas (U, el fondo del mesón). */
  ancho: number;
  /** Texeles a lo largo de la veta (V, el largo del mesón). */
  alto: number;
  /** Metros que cubre U. */
  fondoM: number;
  /** Metros que cubre V. */
  largoM: number;
  /** Tablas encoladas a lo ancho. */
  tablas: number;
  semilla: number;
  /** Zona gastada por los antebrazos, en UV de 0 a 1. */
  desgaste?: { u: number; v: number; radioU: number; radioV: number };
  /** Cerco de una taza, en metros desde el origen UV. */
  taza?: { um: number; vm: number; radioM: number };
}

export interface MapasMadera {
  albedo: Mapa;
  normal: Mapa;
  /** R oclusión · G rugosidad · B metal. */
  orm: Mapa;
  /** R intensidad del barniz · G rugosidad del barniz. A media resolución. */
  barniz: Mapa;
  /** Relieve de la superficie del barniz: ondulación, poro abierto y rayas. */
  normalBarniz: Mapa;
}

/**
 * Tablero de madera maciza barnizada.
 *
 * ─── LA VETA ──────────────────────────────────────────────────────────────
 *
 * Una tabla aserrada corta los anillos del tronco en diagonal, y lo que queda
 * en la cara son elipses muy estiradas a lo largo: las "catedrales". Aquí cada
 * tabla tiene su centro de anillos, su estiramiento y su separación, y la
 * distancia a ese centro —deformada con ruido— dice en qué anillo cae cada
 * texel. Dentro del anillo, la madera temprana es clara y blanda; la tardía,
 * oscura, densa y un pelo más alta, porque al lijar se hunde menos.
 *
 * ─── POR QUÉ CUATRO TABLAS ────────────────────────────────────────────────
 *
 * Un tablero de 86 cm de fondo no sale de una pieza. Las tablas encoladas se
 * reconocen por el salto de tono de una a otra más que por la junta, y ese
 * salto es lo que quita la sensación de textura repetida.
 */
export function generarMadera(o: OpcionesMadera): MapasMadera {
  const { ancho, alto, fondoM, largoM } = o;
  const n = ancho * alto;
  const mU = fondoM / ancho;
  const mV = largoM / alto;

  const tablas = Array.from({ length: o.tablas }, (_, i) => {
    const azar = crearAzar(o.semilla * 977 + i * 7919);
    return {
      tono: 0.86 + azar() * 0.22,
      calidez: (azar() - 0.5) * 0.09,
      // Casi siempre fuera de la tabla: la mayoría de las tablas muestran veta
      // recta con alguna catedral asomando, no una diana en el medio.
      centroU: -1.2 + azar() * 3.4,
      centroV: azar() * largoM,
      estiramiento: 22 + azar() * 26,
      anillosPorM: 38 + azar() * 40,
      semilla: Math.floor(azar() * 1e6),
    };
  });

  const s = o.semilla;
  const deformacion = campoGrueso(ancho, alto, 4, (x, y) =>
    (fbm(x * mU * 16, y * mV * 1.1, s + 11) - 0.5) * 0.022 +
    (fbm(x * mU * 55, y * mV * 5, s + 23, 3) - 0.5) * 0.003
  );
  // El árbol no creció recto: las catedrales se tuercen también a lo largo.
  const desvioLargo = campoGrueso(ancho, alto, 8, (x, y) => (fbm(x * mU * 9, y * mV * 0.6, s + 57, 3) - 0.5) * 0.3);
  const mancha = campoGrueso(ancho, alto, 8, (x, y) => fbm(x * mU * 7, y * mV * 0.9, s + 3, 3));
  const ondulacion = campoGrueso(ancho, alto, 8, (x, y) => fbm(x * mU * 3.2, y * mV * 1.1, s + 41, 3));

  // --- Rayas del barniz ------------------------------------------------------
  //
  // Casi todas a lo largo: son las de arrastrar el libro, la radio y los codos
  // en el mismo sentido durante años. Se concentran donde se trabaja.
  const rayas = new Float32Array(n);
  const azarRayas = crearAzar(s + 404);
  for (let k = 0; k < 220; k++) {
    let u0 = azarRayas();
    let v0 = azarRayas();
    if (o.desgaste && azarRayas() < 0.6) {
      u0 = o.desgaste.u + (azarRayas() - 0.5) * o.desgaste.radioU * 2.4;
      v0 = o.desgaste.v + (azarRayas() - 0.5) * o.desgaste.radioV * 2.4;
    }
    const angulo = azarRayas() < 0.75 ? (azarRayas() - 0.5) * 0.45 : azarRayas() * Math.PI;
    const largo = 0.012 + Math.pow(azarRayas(), 2) * 0.13;
    const fuerza = 0.25 + azarRayas() * 0.75;
    const pasos = Math.ceil((largo / Math.min(mU, mV)) * 1.6);
    for (let p = 0; p <= pasos; p++) {
      const f = p / pasos;
      const um = u0 * fondoM + Math.sin(angulo) * largo * (f - 0.5);
      const vm = v0 * largoM + Math.cos(angulo) * largo * (f - 0.5);
      const px = um / mU - 0.5;
      const py = vm / mV - 0.5;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      if (ix < 0 || iy < 0 || ix >= ancho - 1 || iy >= alto - 1) continue;
      const perfil = Math.sqrt(Math.sin(f * Math.PI)) * fuerza;
      const tx = px - ix;
      const ty = py - iy;
      const pesos = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
      const indices = [iy * ancho + ix, iy * ancho + ix + 1, (iy + 1) * ancho + ix, (iy + 1) * ancho + ix + 1];
      for (let q = 0; q < 4; q++) rayas[indices[q]] = Math.max(rayas[indices[q]], perfil * pesos[q]);
    }
  }

  const albedo = new Uint8Array(n * 4);
  const alturaBase = new Float32Array(n);
  const alturaBarniz = new Float32Array(n);
  const rugosidad = new Float32Array(n);
  const barnizIntensidad = new Float32Array(n);
  const barnizRugosidad = new Float32Array(n);

  // Temprana y tardía, en sRGB: un nogal claro, con fondo suficiente para que
  // el flexo tenga algo que devolver. La tabla vieja era casi negra y la luz
  // se perdía en ella.
  const TEMPRANA = [0.55, 0.38, 0.245];
  const TARDIA = [0.38, 0.245, 0.15];

  for (let y = 0; y < alto; y++) {
    const vm = (y + 0.5) * mV;
    const v = (y + 0.5) / alto;
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const um = (x + 0.5) * mU;
      const u = (x + 0.5) / ancho;

      const posicion = u * o.tablas;
      const b = Math.min(o.tablas - 1, Math.floor(posicion));
      const fu = posicion - b;
      const t = tablas[b];

      const du = (fu - t.centroU) * (fondoM / o.tablas) + deformacion(x, y);
      const dv = (vm - t.centroV + desvioLargo(x, y)) / t.estiramiento;
      const anillo = Math.sqrt(du * du + dv * dv) * t.anillosPorM;
      // Los años no crecen igual: cada anillo tiene su grosor. Sin esto las
      // líneas salen equidistantes, que es lo que delata una madera impresa.
      const irregular = (ruido(anillo * 0.45, b * 7.3, t.semilla) - 0.5) * 0.9;
      const fase = anillo + irregular - Math.floor(anillo + irregular);
      const tardia = suave(0.58, 0.86, fase) * (1 - suave(0.9, 0.99, fase));

      const fibra = ruido(um * 380, vm * 11, t.semilla);
      const poro = suave(0.74, 0.9, ruido(um * 520, vm * 7.5, t.semilla + 5)) * (1 - tardia * 0.85);
      const texelesAJunta = Math.min(fu, 1 - fu) * (ancho / o.tablas);
      const junta = 1 - suave(0.4, 2.2, texelesAJunta);
      const m = mancha(x, y);

      let zona = 0;
      if (o.desgaste) {
        const a = (u - o.desgaste.u) / o.desgaste.radioU;
        const c = (v - o.desgaste.v) / o.desgaste.radioV;
        zona = Math.exp(-(a * a + c * c) * 1.6) * 0.85;
      }
      const bordeFrontal = (1 - suave(0, 0.06, u)) * 0.55;

      let cerco = 0;
      if (o.taza) {
        const dx = um - o.taza.um;
        const dy = vm - o.taza.vm;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d - o.taza.radioM) < 0.008) {
          const irregular = 0.55 + 0.45 * ruido(Math.atan2(dy, dx) * 5 + 20, 3, s + 7);
          // Borde nítido por fuera, que es donde el café se secó y se acumuló.
          const r = (d - o.taza.radioM) / 0.0025;
          cerco = Math.exp(-r * r * (r > 0 ? 3 : 1)) * irregular;
        }
      }
      const raya = rayas[i];

      // --- Color ---------------------------------------------------------------
      let r = TEMPRANA[0] + (TARDIA[0] - TEMPRANA[0]) * tardia * 0.9;
      let g = TEMPRANA[1] + (TARDIA[1] - TEMPRANA[1]) * tardia * 0.9;
      let bl = TEMPRANA[2] + (TARDIA[2] - TEMPRANA[2]) * tardia * 0.9;
      const tono = t.tono * (0.92 + 0.16 * m) * (1 - 0.06 * (fibra - 0.5)) * (1 - 0.36 * poro) * (1 - 0.45 * junta);
      r *= tono * (1 + t.calidez);
      g *= tono;
      bl *= tono * (1 - t.calidez);
      // Lo gastado pierde el barniz ambarino: más claro y más apagado.
      const gasto = zona * 0.4 + bordeFrontal * 0.3;
      const gris = r * 0.3 + g * 0.59 + bl * 0.11;
      r += (gris * 1.22 - r) * gasto;
      g += (gris * 1.16 - g) * gasto;
      bl += (gris * 1.08 - bl) * gasto;
      r *= 1 - 0.2 * cerco;
      g *= 1 - 0.26 * cerco;
      bl *= 1 - 0.32 * cerco;
      albedo[i * 4] = byte(r);
      albedo[i * 4 + 1] = byte(g);
      albedo[i * 4 + 2] = byte(bl);
      albedo[i * 4 + 3] = 255;

      // --- Relieve, en metros ---------------------------------------------------
      alturaBase[i] =
        tardia * 0.00011 + (fibra - 0.5) * 0.000015 - poro * 0.00025 - junta * 0.0004 + (m - 0.5) * 0.00003;
      alturaBarniz[i] =
        (ondulacion(x, y) - 0.5) * 0.00022 +
        tardia * 0.000015 -
        poro * 0.00005 -
        junta * 0.00028 -
        raya * 0.00007 +
        cerco * 0.00002;

      rugosidad[i] = limitar(0.6 - 0.1 * tardia + 0.28 * poro + 0.05 * (fibra - 0.5) + 0.1 * zona, 0.25, 0.95);
      barnizIntensidad[i] = limitar(1 - 0.42 * zona - 0.35 * bordeFrontal - 0.15 * raya, 0.2, 1);
      barnizRugosidad[i] = limitar(
        0.05 + 0.2 * zona + 0.18 * bordeFrontal + 0.5 * raya + 0.04 * poro + 0.3 * cerco,
        0.03,
        0.9
      );
    }
  }

  // Oclusión: lo que queda por debajo de su entorno recibe menos luz rebotada.
  const promedio = desenfocar(alturaBase, ancho, alto, 3);
  const orm = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const hundido = limitar((promedio[i] - alturaBase[i]) / 0.0003);
    orm[i * 4] = byte(1 - hundido * 0.55);
    orm[i * 4 + 1] = byte(rugosidad[i]);
    orm[i * 4 + 2] = 0;
    orm[i * 4 + 3] = 255;
  }

  const ab = ancho >> 1;
  const hb = alto >> 1;
  const barniz = new Uint8Array(ab * hb * 4);
  for (let y = 0; y < hb; y++) {
    for (let x = 0; x < ab; x++) {
      const a = (y * 2) * ancho + x * 2;
      const idx = [a, a + 1, a + ancho, a + ancho + 1];
      const j = (y * ab + x) * 4;
      barniz[j] = byte(idx.reduce((sum, k) => sum + barnizIntensidad[k], 0) / 4);
      barniz[j + 1] = byte(idx.reduce((sum, k) => sum + barnizRugosidad[k], 0) / 4);
      barniz[j + 2] = 0;
      barniz[j + 3] = 255;
    }
  }

  return {
    albedo: { ancho, alto, datos: albedo },
    normal: { ancho, alto, datos: normalesDesdeAltura(alturaBase, ancho, alto, mU, mV, 1.5) },
    orm: { ancho, alto, datos: orm },
    barniz: { ancho: ab, alto: hb, datos: barniz },
    normalBarniz: { ancho, alto, datos: normalesDesdeAltura(alturaBarniz, ancho, alto, mU, mV, 1.4) },
  };
}

// ---------------------------------------------------------------------------
// Cuero granulado de las tapas del libro
// ---------------------------------------------------------------------------

export interface OpcionesCuero {
  ancho: number;
  alto: number;
  fondoM: number;
  largoM: number;
  semilla: number;
}

export interface MapasCuero {
  albedo: Mapa;
  normal: Mapa;
  orm: Mapa;
}

/**
 * Cuerina granulada, la de los libros de actas.
 *
 * El grano son celdas: cada una es una cúpula de un par de milímetros y entre
 * ellas corre un surco. Se calcula con la distancia al punto más cercano y al
 * segundo más cercano — donde las dos se igualan está la frontera entre
 * granos. Las cúpulas salen pulidas por el roce de la mano, los surcos mates y
 * oscuros, y los cantos del libro gastados hasta clarear.
 */
export function generarCuero(o: OpcionesCuero): MapasCuero {
  const { ancho, alto, fondoM, largoM } = o;
  const n = ancho * alto;
  const mU = fondoM / ancho;
  const mV = largoM / alto;
  const CELDA = 0.0017;
  const s = o.semilla;

  const albedo = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  const altura = new Float32Array(n);

  for (let y = 0; y < alto; y++) {
    const vm = (y + 0.5) * mV;
    for (let x = 0; x < ancho; x++) {
      const um = (x + 0.5) * mU;
      const cx = Math.floor(um / CELDA);
      const cy = Math.floor(vm / CELDA);
      let d1 = 1e9;
      let d2 = 1e9;
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const px = (cx + k + 0.15 + hash(cx + k, cy + j, s) * 0.7) * CELDA;
          const py = (cy + j + 0.15 + hash(cx + k, cy + j, s + 1) * 0.7) * CELDA;
          const d = (um - px) * (um - px) + (vm - py) * (vm - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const frontera = Math.sqrt(d2) - Math.sqrt(d1);
      const grano = suave(0, 0.42 * CELDA, frontera);
      const macro = fbm(um * 40, vm * 40, s + 7, 3);
      const aBorde = Math.min(um, fondoM - um, vm, largoM - vm);
      const gastado = (1 - suave(0, 0.008, aBorde)) * (0.45 + 0.4 * fbm(um * 180, vm * 180, s + 9, 2));

      const i = y * ancho + x;
      altura[i] = Math.sqrt(grano) * 0.0001 * (1 - gastado * 0.6) + (macro - 0.5) * 0.00012;

      const luz = (1 - 0.45 * (1 - grano)) * (1 + 0.08 * grano) * (0.94 + 0.12 * macro);
      const r = 0.16 * luz + (0.4 - 0.16 * luz) * gastado * 0.8;
      const g = 0.072 * luz + (0.25 - 0.072 * luz) * gastado * 0.8;
      const b = 0.066 * luz + (0.19 - 0.066 * luz) * gastado * 0.8;
      albedo[i * 4] = byte(r);
      albedo[i * 4 + 1] = byte(g);
      albedo[i * 4 + 2] = byte(b);
      albedo[i * 4 + 3] = 255;

      orm[i * 4] = byte(0.72 + 0.28 * grano);
      orm[i * 4 + 1] = byte(limitar(0.36 + 0.34 * (1 - grano) + 0.18 * gastado - 0.05 * (macro - 0.5), 0.2, 0.95));
      orm[i * 4 + 2] = 0;
      orm[i * 4 + 3] = 255;
    }
  }

  return {
    albedo: { ancho, alto, datos: albedo },
    normal: { ancho, alto, datos: normalesDesdeAltura(altura, ancho, alto, mU, mV, 2) },
    orm: { ancho, alto, datos: orm },
  };
}

// ---------------------------------------------------------------------------
// Canto de las hojas
// ---------------------------------------------------------------------------

/**
 * El borde del taco de hojas: cientos de láminas de papel apiladas.
 *
 * U corre a lo largo del canto y V atraviesa el grosor. Cada hoja es una franja
 * con su tono y una ranura oscura con la siguiente; el canto se ensucia algo
 * donde se pasan las páginas.
 */
export function generarCantoHojas(ancho: number, alto: number, semilla: number): { albedo: Mapa; normal: Mapa } {
  const n = ancho * alto;
  const albedo = new Uint8Array(n * 4);
  const altura = new Float32Array(n);
  const HOJA = 2.3;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const u = x / ancho;
      const ondula = Math.sin(u * 40 + semilla) * 0.5 + (ruido(u * 90, y * 0.3, semilla) - 0.5) * 1.2;
      const posicion = (y + ondula) / HOJA;
      const hoja = Math.floor(posicion);
      const dentro = posicion - hoja;
      const ranura = 1 - suave(0, 0.28, Math.min(dentro, 1 - dentro));
      const tono = 0.93 + hash(hoja, 0, semilla) * 0.07;
      const suciedad = suave(0.45, 0.85, fbm(u * 6, y / alto * 2, semilla + 3, 3)) * 0.12;

      const i = y * ancho + x;
      const luz = tono * (1 - 0.35 * ranura) * (1 - suciedad);
      albedo[i * 4] = byte(0.9 * luz);
      albedo[i * 4 + 1] = byte(0.87 * luz);
      albedo[i * 4 + 2] = byte(0.78 * luz);
      albedo[i * 4 + 3] = 255;
      altura[i] = -ranura * 0.00004;
    }
  }

  return {
    albedo: { ancho, alto, datos: albedo },
    normal: { ancho, alto, datos: normalesDesdeAltura(altura, ancho, alto, 0.375 / ancho, 0.008 / alto, 1) },
  };
}

// ---------------------------------------------------------------------------
// Asfalto mojado
// ---------------------------------------------------------------------------

/** Ruido de valor que se repite cada `periodo` unidades: no deja costura al embaldosar. */
function ruidoPeriodico(x: number, y: number, periodo: number, semilla: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const m = (v: number): number => ((v % periodo) + periodo) % periodo;
  const a = hash(m(ix), m(iy), semilla);
  const b = hash(m(ix + 1), m(iy), semilla);
  const c = hash(m(ix), m(iy + 1), semilla);
  const d = hash(m(ix + 1), m(iy + 1), semilla);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * Asfalto después de la lluvia, embaldosable.
 *
 * Lo que hace que un suelo se lea MOJADO no es el color: es que la rugosidad
 * no sea pareja. El árido que asoma queda mate, y en los charcos el agua
 * rellena el poro y el suelo se vuelve un espejo. Con eso, la luz de un farol
 * se estira sobre la calzada en manchas brillantes sueltas en lugar de un
 * reflejo uniforme.
 */
export function generarAsfaltoMojado(lado: number, semilla: number): { albedo: Mapa; normal: Mapa; orm: Mapa } {
  const n = lado * lado;
  const albedo = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  const altura = new Float32Array(n);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const u = x / lado;
      const v = y / lado;
      let charcoRuido = 0;
      let amplitud = 0.5;
      let norma = 0;
      for (let o = 0, f = 3; o < 4; o++, f *= 2) {
        charcoRuido += ruidoPeriodico(u * f, v * f, f, semilla + o * 17) * amplitud;
        norma += amplitud;
        amplitud *= 0.5;
      }
      charcoRuido /= norma;
      const charco = suave(0.56, 0.66, charcoRuido);
      const arido = hash(x, y, semilla + 91);
      const grano = ruidoPeriodico(u * 96, v * 96, 96, semilla + 5);

      const i = y * lado + x;
      const tono = (0.085 + (arido - 0.5) * 0.035 + (grano - 0.5) * 0.025) * (1 - 0.3 * charco);
      albedo[i * 4] = byte(tono);
      albedo[i * 4 + 1] = byte(tono * 1.02);
      albedo[i * 4 + 2] = byte(tono * 1.06);
      albedo[i * 4 + 3] = 255;

      altura[i] = (1 - charco) * ((arido - 0.5) * 0.0012 + (grano - 0.5) * 0.0008);
      orm[i * 4] = byte(1 - (1 - charco) * (0.5 - arido) * 0.25);
      // Charco a 0,2 y no a espejo perfecto: con la luz de un farol rasante, un
      // espejo devuelve un punto; algo de rugosidad estira el brillo en la
      // estela vertical que tiene una calle mojada de noche.
      orm[i * 4 + 1] = byte(0.2 + (1 - charco) * (0.42 + arido * 0.12));
      orm[i * 4 + 2] = 0;
      orm[i * 4 + 3] = 255;
    }
  }

  const texel = 1 / lado;
  return {
    albedo: { ancho: lado, alto: lado, datos: albedo },
    normal: { ancho: lado, alto: lado, datos: normalesDesdeAltura(altura, lado, lado, texel, texel, 1) },
    orm: { ancho: lado, alto: lado, datos: orm },
  };
}

// ---------------------------------------------------------------------------
// El haz del flexo
// ---------------------------------------------------------------------------

/**
 * Lo que proyecta la pantalla de un flexo sobre la mesa.
 *
 * Un foco a secas da un círculo con el borde matemático. Una lámpara real no:
 * el reflector reparte la luz en anillos tenues, el centro es algo más cálido
 * y el borde se deshace en vez de cortarse. Babylon lo aplica como textura de
 * proyección del foco.
 */
export function generarHazFlexo(lado: number): Mapa {
  const datos = new Uint8Array(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = (x + 0.5) / lado - 0.5;
      const dy = (y + 0.5) / lado - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const intensidad = (1 - suave(0.55, 0.98, r)) * (0.91 + 0.09 * Math.cos(r * 34)) * (0.86 + 0.14 * (1 - r));
      const i = (y * lado + x) * 4;
      datos[i] = byte(intensidad);
      datos[i + 1] = byte(intensidad * (0.97 - 0.05 * r));
      datos[i + 2] = byte(intensidad * (0.92 - 0.12 * r));
      datos[i + 3] = 255;
    }
  }
  return { ancho: lado, alto: lado, datos };
}

/**
 * El brillo del interior de la pantalla: más fuerte al fondo, donde está la
 * bombilla, y apagándose hacia la boca. V 0 es la boca y V 1 el fondo.
 */
export function generarDegradadoReflector(alto: number): Mapa {
  const datos = new Uint8Array(4 * alto * 4);
  for (let y = 0; y < alto; y++) {
    const v = (y + 0.5) / alto;
    const valor = byte(0.18 + 0.82 * Math.pow(v, 1.7));
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      datos[i] = valor;
      datos[i + 1] = valor;
      datos[i + 2] = valor;
      datos[i + 3] = 255;
    }
  }
  return { ancho: 4, alto, datos };
}

// ---------------------------------------------------------------------------
// Subida a la tarjeta y proyección de UV
// ---------------------------------------------------------------------------

/**
 * Sube un mapa como textura.
 *
 * @param esColor  true solo para el albedo: los mapas de datos (normales,
 *                 rugosidad, barniz) se leen tal cual, sin corregir gamma.
 */
export function subirMapa(
  scene: Scene,
  nombre: string,
  mapa: Mapa,
  esColor: boolean,
  envoltura = Texture.MIRROR_ADDRESSMODE
): Texture {
  const textura = RawTexture.CreateRGBATexture(
    mapa.datos,
    mapa.ancho,
    mapa.alto,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE
  );
  textura.name = nombre;
  textura.gammaSpace = esColor;
  textura.anisotropicFilteringLevel = 16;
  textura.wrapU = envoltura;
  textura.wrapV = envoltura;
  return textura;
}

/**
 * UV planares en metros para una caja: V a lo largo de X, U a lo ancho de Z.
 *
 * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
 *
 * Babylon le da a cada cara de una caja la textura entera, y en la cara de
 * arriba la pone con V a lo largo de X y U a lo ancho de Z. En el canto de
 * seis centímetros esa misma textura se aplasta hasta ser rayas, y en el
 * frente la veta sale vertical.
 *
 * Proyectando en metros, cada cara toma la franja que le toca con la misma
 * densidad. Los cantos "doblan" la arista: siguen la coordenada hacia fuera
 * del borde, y con la envoltura en espejo la veta continúa sin corte.
 */
export function proyectarUVCaja(
  malla: Mesh,
  texturaM: { u: number; v: number },
  origen: { u: number; v: number } = { u: 0, v: 0 }
): void {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  const nor = malla.getVerticesData(VertexBuffer.NormalKind);
  if (!pos || !nor) return;
  const { minimum: min, maximum: max } = malla.getBoundingInfo().boundingBox;

  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const nx = nor[i * 3];
    const nz = nor[i * 3 + 2];

    let u = (z - min.z) / texturaM.u;
    let v = (x - min.x) / texturaM.v;
    if (Math.abs(nz) > 0.5) {
      const bajada = (max.y - y) / texturaM.u;
      u = nz < 0 ? -bajada : (max.z - min.z) / texturaM.u + bajada;
    } else if (Math.abs(nx) > 0.5) {
      const bajada = (max.y - y) / texturaM.v;
      v = nx < 0 ? -bajada : (max.x - min.x) / texturaM.v + bajada;
    }
    uv[i * 2] = origen.u + u;
    uv[i * 2 + 1] = origen.v + v;
  }
  malla.setVerticesData(VertexBuffer.UVKind, uv);
}

/**
 * UV del canto redondeado del mesón: un cilindro de eje Y que después se gira
 * un cuarto de vuelta en Z para quedar a lo largo de X.
 *
 * Con ese giro la X local pasa a ser la vertical del mundo y la Y local el
 * largo, invertido. U sigue el arco desde arriba hacia el frente, empezando
 * justo donde termina la tapa, y V el largo en el mismo sentido que la tapa.
 */
export function proyectarUVCanto(malla: Mesh, largoM: number, texturaM: { u: number; v: number }): void {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  if (!pos) return;
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const radio = Math.sqrt(x * x + z * z);
    const arco = Math.atan2(-z, x) * radio;
    uv[i * 2] = -arco / texturaM.u;
    uv[i * 2 + 1] = (largoM / 2 - y) / texturaM.v;
  }
  malla.setVerticesData(VertexBuffer.UVKind, uv);
}
