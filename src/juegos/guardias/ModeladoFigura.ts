import { Scene, Mesh, VertexData, Texture, Vector3 } from "@babylonjs/core";
import { subirMapa, type Mapa } from "./TexturasPBR";

// ===========================================================================
// Piezas esculpidas para las figuras
// ===========================================================================
//
// Las personas del hall se armaban con cajas y esferas escaladas: se leían
// como maniquíes de madera, y el supervisor llega a dos metros de la cámara en
// el momento de más atención del turno. Acá está lo que las hace cuerpo:
//
//   LOFT       una superficie que pasa por una serie de anillos. Cada anillo
//              tiene su ancho, su fondo delante y detrás y su grado de
//              cuadratura, así que un tronco puede tener cintura, pecho que
//              adelanta, espalda plana y hombros que caen. Mangas, perneras,
//              zapatos y gorras salen de lo mismo.
//   CABEZA     una esfera deformada a mano: mandíbula que se estrecha, nuca,
//              frente, cuencas, pómulos, nariz y mentón. Sin detalle fino —a
//              dos metros no se vería— pero con los volúmenes que el ojo
//              busca para reconocer una cara.
//   PELO       la misma cabeza un poco más grande, hundida bajo la línea del
//              pelo. El borde se funde con la piel en vez de ser un casquete.
//   TELA       un relieve de sarga, repetible, para que la luz del hall se
//              quiebre sobre la ropa en vez de resbalar como sobre plástico.

export interface Anillo {
  /** Altura a lo largo del eje, en metros. Creciente de un anillo al siguiente. */
  y: number;
  /** Semiancho en X. */
  x: number;
  /** Semifondo hacia delante (+Z). */
  delante: number;
  /** Semifondo hacia atrás (−Z). Si falta, igual que delante. */
  atras?: number;
  /** Desplazamiento del centro del anillo. */
  cx?: number;
  cz?: number;
  /** Exponente de superelipse: 2 es una elipse; más alto, más cuadrado. */
  forma?: number;
}

export interface OpcionesLoft {
  lados?: number;
  tapaAbajo?: boolean;
  tapaArriba?: boolean;
  /** Repeticiones de la textura por metro de largo. */
  vPorMetro?: number;
  /** Repeticiones de la textura alrededor. */
  uVueltas?: number;
}

/** Suaviza la costura: los vértices duplicados del cierre comparten normal. */
function unirCostura(normales: number[], filas: number, porFila: number): void {
  for (let i = 0; i < filas; i++) {
    const a = i * porFila;
    const b = a + porFila - 1;
    for (let k = 0; k < 3; k++) {
      const media = (normales[a * 3 + k] + normales[b * 3 + k]) / 2;
      normales[a * 3 + k] = media;
      normales[b * 3 + k] = media;
    }
    const largo = Math.hypot(normales[a * 3], normales[a * 3 + 1], normales[a * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) {
      normales[a * 3 + k] /= largo;
      normales[b * 3 + k] /= largo;
    }
  }
}

function construir(
  scene: Scene,
  nombre: string,
  posiciones: number[],
  indices: number[],
  uvs: number[],
  costura?: { filas: number; porFila: number },
  colores?: number[]
): Mesh {
  const normales: number[] = [];
  VertexData.ComputeNormals(posiciones, indices, normales);
  if (costura) unirCostura(normales, costura.filas, costura.porFila);
  const datos = new VertexData();
  datos.positions = posiciones;
  datos.indices = indices;
  datos.normals = normales;
  datos.uvs = uvs;
  if (colores) datos.colors = colores;
  const malla = new Mesh(nombre, scene);
  datos.applyToMesh(malla);
  return malla;
}

/**
 * Superficie que pasa por los anillos, en orden de abajo arriba.
 *
 * Los triángulos van en el sentido de Babylon —antihorario visto desde fuera—,
 * así que las normales salen hacia fuera y la cara trasera se descarta.
 */
export function loft(scene: Scene, nombre: string, anillos: Anillo[], o: OpcionesLoft = {}): Mesh {
  const lados = o.lados ?? 20;
  const porFila = lados + 1;
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let recorrido = 0;
  anillos.forEach((a, i) => {
    if (i > 0) {
      const b = anillos[i - 1];
      recorrido += Math.hypot(a.y - b.y, a.x - b.x);
    }
    const exponente = 2 / (a.forma ?? 2);
    for (let j = 0; j <= lados; j++) {
      const t = (j / lados) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const fondo = s >= 0 ? a.delante : a.atras ?? a.delante;
      posiciones.push(
        (a.cx ?? 0) + a.x * Math.sign(c) * Math.pow(Math.abs(c), exponente),
        a.y,
        (a.cz ?? 0) + fondo * Math.sign(s) * Math.pow(Math.abs(s), exponente)
      );
      uvs.push((j / lados) * (o.uVueltas ?? 1), recorrido * (o.vPorMetro ?? 1));
    }
  });

  for (let i = 0; i < anillos.length - 1; i++) {
    for (let j = 0; j < lados; j++) {
      const a = i * porFila + j;
      const b = a + 1;
      const c = a + porFila;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const tapar = (fila: number, arriba: boolean): void => {
    const anillo = anillos[fila];
    const centro = posiciones.length / 3;
    posiciones.push(anillo.cx ?? 0, anillo.y, anillo.cz ?? 0);
    uvs.push(0.5, recorrido * (o.vPorMetro ?? 1));
    for (let j = 0; j < lados; j++) {
      const p = fila * porFila + j;
      if (arriba) indices.push(centro, p, p + 1);
      else indices.push(centro, p + 1, p);
    }
  };
  if (o.tapaAbajo) tapar(0, false);
  if (o.tapaArriba) tapar(anillos.length - 1, true);

  return construir(scene, nombre, posiciones, indices, uvs, { filas: anillos.length, porFila });
}

export interface OpcionesCapsula {
  /** Hinchazón del perfil (el gemelo, el bíceps), en metros. */
  bulto?: number;
  /** Dónde cae el bulto: 0 abajo, 1 arriba. */
  dondeBulto?: number;
  /** Fondo respecto al ancho. Menos de 1 aplana (una mano, un antebrazo). */
  fondo?: number;
  /** Adelanta el centro hacia +Z en la punta de abajo (la puntera de un zapato). */
  lados?: number;
  vPorMetro?: number;
}

/**
 * Un tramo de miembro que cuelga del origen hacia −Y, con los dos extremos
 * redondeados. Los extremos sobresalen de la articulación, y es eso lo que
 * tapa el hueco al doblar un codo o una rodilla.
 */
export function capsula(scene: Scene, nombre: string, largo: number, radioArriba: number, radioAbajo: number, o: OpcionesCapsula = {}): Mesh {
  const fondo = o.fondo ?? 1;
  const radio = (t: number): number => {
    const base = radioAbajo + (radioArriba - radioAbajo) * t;
    const bulto = o.bulto ? o.bulto * Math.exp(-((t - (o.dondeBulto ?? 0.6)) ** 2) / 0.06) : 0;
    return base + bulto;
  };
  const anillos: Anillo[] = [];
  const casquete = [0.4, 0.8, 1.15, Math.PI / 2];
  casquete.forEach((ang) => {
    const r = radioAbajo * Math.sin(ang);
    anillos.push({ y: -largo - radioAbajo * Math.cos(ang) * 0.8, x: r, delante: r * fondo });
  });
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    const r = radio(t);
    anillos.push({ y: -largo + t * largo, x: r, delante: r * fondo });
  }
  [...casquete].reverse().forEach((ang) => {
    const r = radioArriba * Math.sin(ang);
    anillos.push({ y: radioArriba * Math.cos(ang) * 0.8, x: r, delante: r * fondo });
  });
  return loft(scene, nombre, anillos, { lados: o.lados ?? 16, tapaAbajo: true, tapaArriba: true, vPorMetro: o.vPorMetro ?? 8 });
}

// ---------------------------------------------------------------------------
// Cabeza y pelo
// ---------------------------------------------------------------------------

const campana = (u: number, v: number, su: number, sv: number): number => Math.exp(-(u * u) / (2 * su * su) - (v * v) / (2 * sv * sv));
const suave = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export interface Rasgos {
  /** Escala de la nariz: 1 corriente. */
  nariz?: number;
  /** Cuánto se estrecha la mandíbula: 1 corriente, menos es más cuadrada. */
  mandibula?: number;
  /** Ancho de la cara respecto al corriente. */
  ancho?: number;
}

/**
 * Punto de la cabeza en la dirección (dx, dy, dz), con los rasgos puestos.
 * La cara mira a +Z. Origen en el centro del cráneo.
 */
function puntoCabeza(dx: number, dy: number, dz: number, r: Rasgos): [number, number, number] {
  let x = 0.077 * (r.ancho ?? 1) * dx;
  const y = 0.106 * dy;
  let z = 0.095 * dz;

  // La nuca sobresale y la parte baja de atrás se recoge hacia el cuello.
  if (dz < 0) z *= 1 + 0.07 * Math.max(0, dy + 0.25);
  const bajo = suave((-y - 0.012) / 0.1);
  x *= 1 - 0.16 * bajo * (r.mandibula ?? 1);
  z *= dz < 0 ? 1 - 0.38 * bajo : 1 - 0.07 * bajo;
  // Frente algo plana: una cabeza esférica se ve a balón.
  if (dz > 0 && y > 0.02) z *= 1 - 0.05 * suave((y - 0.02) / 0.06);

  const frente = Math.max(0, dz);
  const ax = Math.abs(x);
  z +=
    frente *
    (0.019 * (r.nariz ?? 1) * campana(x, y + 0.03, 0.0085, 0.014) +
      0.006 * campana(x, y + 0.004, 0.006, 0.02) +
      0.005 * campana(ax - 0.03, y - 0.031, 0.02, 0.007) -
      0.009 * campana(ax - 0.031, y - 0.011, 0.012, 0.009) +
      0.004 * campana(ax - 0.047, y + 0.014, 0.014, 0.012) +
      0.006 * campana(x, y + 0.088, 0.02, 0.012) +
      0.003 * campana(x, y + 0.058, 0.016, 0.006) -
      0.002 * campana(x, y + 0.063, 0.018, 0.0025));
  return [x, y, z];
}

function esfera(
  scene: Scene,
  nombre: string,
  latitudes: number,
  longitudes: number,
  punto: (dx: number, dy: number, dz: number) => [number, number, number],
  tono?: (x: number, y: number, dz: number) => [number, number, number]
): Mesh {
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const colores: number[] | undefined = tono ? [] : undefined;
  const porFila = longitudes + 1;
  for (let i = 0; i <= latitudes; i++) {
    const fi = (i / latitudes) * Math.PI;
    for (let j = 0; j <= longitudes; j++) {
      const te = (j / longitudes) * Math.PI * 2;
      const dz = Math.sin(fi) * Math.cos(te);
      const [x, y, z] = punto(Math.sin(fi) * Math.sin(te), Math.cos(fi), dz);
      posiciones.push(x, y, z);
      uvs.push(j / longitudes, 1 - i / latitudes);
      if (colores && tono) colores.push(...tono(x, y, dz), 1);
    }
  }
  for (let i = 0; i < latitudes; i++) {
    for (let j = 0; j < longitudes; j++) {
      const a = i * porFila + j;
      const b = a + 1;
      const c = a + porFila;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  return construir(scene, nombre, posiciones, indices, uvs, { filas: latitudes + 1, porFila }, colores);
}

export interface CabezaEsculpida {
  malla: Mesh;
  /** Centro de cada cuenca, ya sobre la superficie: donde van los ojos. */
  ojos: [Vector3, Vector3];
}

export function cabezaEsculpida(scene: Scene, nombre: string, rasgos: Rasgos = {}): CabezaEsculpida {
  // La luz de la cara pintada en los vértices: cuencas y bajo la nariz en
  // sombra, labios algo más rojos y un punto de color en los pómulos. Con la
  // luz de un hall de noche, que viene de arriba y es plana, sin esto la cara
  // tenía volumen pero se leía como madera tallada.
  const tonoCara = (x: number, y: number, dz: number): [number, number, number] => {
    const f = Math.max(0, dz);
    const ax = Math.abs(x);
    const cuenca = campana(ax - 0.031, y - 0.012, 0.017, 0.013);
    const bajoNariz = campana(x, y + 0.045, 0.012, 0.005);
    const labios = campana(x, y + 0.062, 0.017, 0.0055);
    const mejilla = campana(ax - 0.046, y + 0.022, 0.02, 0.018);
    const bajoMenton = suave((-y - 0.075) / 0.03) * (1 - 0.5 * f);
    const luz = (1 - f * (0.34 * cuenca + 0.14 * bajoNariz)) * (1 - 0.18 * bajoMenton);
    return [
      luz * (1 - f * 0.1 * labios) + f * 0.05 * mejilla,
      luz * (1 - f * 0.34 * labios) - f * 0.03 * mejilla,
      luz * (1 - f * 0.3 * labios) - f * 0.03 * mejilla,
    ];
  };
  const malla = esfera(scene, nombre, 48, 72, (dx, dy, dz) => puntoCabeza(dx, dy, dz, rasgos), tonoCara);
  // La cuenca se busca en la malla ya deformada: así el ojo cae en su sitio
  // aunque cambien los rasgos, en vez de flotar delante o hundirse.
  const ojos = [-1, 1].map((lado) => puntoDeLaCara(lado * 0.031 * (rasgos.ancho ?? 1), 0.011, rasgos)) as [Vector3, Vector3];
  return { malla, ojos };
}

/**
 * Dónde cae un punto de la cara, ya esculpida.
 *
 * Se busca el punto de la superficie más cercano a esa altura y ese lado, en
 * vez de calcularlo a ojo: así los ojos, las cejas y la boca quedan APOYADOS
 * en la cara aunque los rasgos cambien —una nariz más grande o una mandíbula
 * más ancha mueven la superficie—, y no flotando delante ni hundidos dentro.
 *
 * @param objetivoX  Separación del eje, con signo: negativo a la izquierda.
 * @param objetivoY  Altura respecto al centro del cráneo.
 */
export function puntoDeLaCara(objetivoX: number, objetivoY: number, rasgos: Rasgos = {}): Vector3 {
  let mejor = new Vector3(objetivoX, objetivoY, 0.08);
  let distancia = Infinity;
  for (let i = 0; i <= 48; i++) {
    const fi = (i / 48) * Math.PI;
    for (let j = 0; j <= 72; j++) {
      const te = (j / 72) * Math.PI * 2;
      const dz = Math.sin(fi) * Math.cos(te);
      if (dz <= 0) continue;
      const [x, y, z] = puntoCabeza(Math.sin(fi) * Math.sin(te), Math.cos(fi), dz, rasgos);
      const d = Math.hypot(x - objetivoX, y - objetivoY);
      if (d < distancia) {
        distancia = d;
        mejor = new Vector3(x, y, z);
      }
    }
  }
  return mejor;
}

export type Peinado = "corto" | "largo" | "rapado";

/**
 * El pelo: la cabeza un poco más grande, hundida bajo la línea del pelo.
 *
 * La línea sube en la frente, baja detrás de las orejas y más aún en la nuca.
 * Por debajo de ella la capa se mete dentro del cráneo, así que el borde se
 * funde con la piel en lugar de terminar en un escalón de casquete.
 */
export function peloEsculpido(scene: Scene, nombre: string, peinado: Peinado, rasgos: Rasgos = {}): Mesh {
  const grosor = peinado === "rapado" ? 0.003 : peinado === "largo" ? 0.011 : 0.008;
  const nuca = peinado === "largo" ? -0.125 : -0.07;
  return esfera(scene, nombre, 36, 56, (dx, dy, dz) => {
    const [x, y, z] = puntoCabeza(dx, dy, dz, { ...rasgos, nariz: 0 });
    const delante = Math.max(0, dz);
    const detras = Math.max(0, -dz);
    const linea = 0.05 * delante + nuca * detras + 0.02 * (1 - delante - detras);
    const dentro = suave((y - linea) / 0.014);
    const capa = -0.016 + (grosor + 0.009 * Math.max(0, dy) + 0.016) * dentro;
    const largo = Math.hypot(x, y, z) || 1;
    return [x + (x / largo) * capa, y + (y / largo) * capa, z + (z / largo) * capa];
  });
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

const telas = new WeakMap<Scene, Texture>();

/** Ruido de valor periódico: se repite cada `periodo` celdas sin costura. */
function ruidoPeriodico(x: number, y: number, periodo: number): number {
  const hash = (ix: number, iy: number): number => {
    const a = ((ix % periodo) + periodo) % periodo;
    const b = ((iy % periodo) + periodo) % periodo;
    let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * Relieve de sarga para la ropa, compartido por todas las figuras.
 *
 * Diagonales finas de tejido y un ruido suave encima, que es el que rompe la
 * repetición. Muy bajo de intensidad: tiene que notarse en cómo cae la luz,
 * no como un dibujo sobre la tela.
 */
export function texturaTela(scene: Scene): Texture {
  // Viva, no solo guardada. La escena es la misma para todo el curso y
  // limpiarEscena se lleva esta textura junto con las mallas del escenario que
  // se va: devolver la de antes sería vestir a las figuras del siguiente con
  // una textura ya destruida.
  const existente = telas.get(scene);
  if (existente?.getInternalTexture()) return existente;
  const lado = 256;
  const alturas = new Float32Array(lado * lado);
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      const u = px / lado;
      const v = py / lado;
      const sarga = Math.sin((u * 48 + v * 48) * Math.PI * 2) * 0.5 + 0.5;
      const trama = Math.sin(v * 96 * Math.PI * 2) * 0.5 + 0.5;
      alturas[py * lado + px] = sarga * 0.55 + trama * 0.2 + ruidoPeriodico(u * 24, v * 24, 24) * 0.25;
    }
  }
  const datos = new Uint8Array(lado * lado * 4);
  const fuerza = 2.2;
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      const h = (x: number, y: number): number => alturas[((y + lado) % lado) * lado + ((x + lado) % lado)];
      const nx = (h(px - 1, py) - h(px + 1, py)) * fuerza;
      const ny = (h(px, py - 1) - h(px, py + 1)) * fuerza;
      const largo = Math.hypot(nx, ny, 1);
      const k = (py * lado + px) * 4;
      datos[k] = Math.round(((nx / largo) * 0.5 + 0.5) * 255);
      datos[k + 1] = Math.round(((ny / largo) * 0.5 + 0.5) * 255);
      datos[k + 2] = Math.round(((1 / largo) * 0.5 + 0.5) * 255);
      datos[k + 3] = 255;
    }
  }
  const mapa: Mapa = { ancho: lado, alto: lado, datos };
  const textura = subirMapa(scene, "texTelaFiguras", mapa, false, Texture.WRAP_ADDRESSMODE);
  telas.set(scene, textura);
  return textura;
}
