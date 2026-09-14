import {
  Scene,
  Mesh,
  MeshBuilder,
  ShaderMaterial,
  Effect,
  Color3,
  Vector2,
  Vector3,
  SpotLight,
  HemisphericLight,
  PBRMaterial,
  DynamicTexture,
  Texture,
  Constants,
} from "@babylonjs/core";
import { crearAzar, fbm } from "./TexturasPBR";

// ===========================================================================
// El paso de la noche por el ventanal
// ===========================================================================
//
// El turno va de 00:00 a 08:00, y hasta ahora por el ventanal se veía la misma
// fotografía las ocho horas. Eso es lo primero que delata un escenario: el
// reloj del libro dice las 07:40 y la calle sigue siendo medianoche.
//
// Aquí la noche PASA:
//
//   · 00:00 — negro cerrado. Solo el resplandor sodio de la ciudad bajo las
//     nubes y las ventanas de quien sigue despierto.
//   · De madrugada las ventanas se van apagando, primero unas, después otras.
//     La tele del tercer piso sigue parpadeando azul hasta pasada la una.
//   · 06:00 — azul oscuro. Se encienden las cocinas: luz fría de LED, la de
//     quien se levanta a trabajar.
//   · 07:40 — la fotocelda apaga la farola, con su parpadeo.
//   · 08:00 — un naranja tenue bajo las nubes, detrás de los techos, y la
//     fachada de enfrente ya se lee.
//
// Y la sala lo nota: el vidrio, que de noche es casi un espejo, se vuelve
// transparente cuando fuera hay más luz que dentro; entra una luz difusa que
// toca el piso junto al ventanal; el relleno de la sala se entibia.
//
// ─── CÓMO ESTÁ HECHO ──────────────────────────────────────────────────────
//
// Nada de esto repinta texturas mientras se juega. La calle se pinta UNA vez,
// separada en capas —la fachada, y las luces por grupos en los canales de dos
// texturas— y dos shaders propios las combinan en cada cuadro con la hora
// como uniforme. Pasar de medianoche a amanecer cuesta lo mismo que dibujar un
// cuadro: cambiar una docena de números.
//
// La hora que manda es la del turno, pero la que se ve la sigue con un
// retardo corto: con el turno adelantado el reloj salta trece minutos por
// segundo, y sin suavizar el cielo cambiaría a tirones.
//
// ─── DÓNDE SE MIRA ────────────────────────────────────────────────────────
//
// Desde la silla, del plano de la calle solo se ve la franja u 0,23–0,77 ·
// v 0,29–0,78 (medida desde arriba). La composición se hizo para esa franja:
// la versión anterior tapaba el cielo entero con la fachada, y un amanecer
// que no se ve no es un amanecer. Ahora los techos van escalonados entre el
// 37 y el 50 % de la altura, con una casa baja en medio que deja ver el cerro.

type RGB = [number, number, number];

const limitar = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);

function suave(a: number, b: number, x: number): number {
  const t = limitar((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

const desdeHex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

/** sRGB a lineal. Los colores se piensan en sRGB; la luz se mezcla en lineal. */
const lineal = (c: RGB): RGB => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];

// ---------------------------------------------------------------------------
// Las claves de la noche
// ---------------------------------------------------------------------------

interface ClaveCielo {
  minuto: number;
  cenit: string;
  horizonte: string;
  /** Lo que brilla bajo el horizonte: la ciudad de noche, el sol al amanecer. */
  resplandor: string;
  fuerzaResplandor: number;
  /** La cara de abajo de las nubes. */
  nubes: string;
  /** Cuánta luz recibe la fachada de enfrente, como multiplicador por canal. */
  fachada: RGB;
  /** La luz que entra por el ventanal. */
  entrante: string;
  fuerzaEntrante: number;
}

export const CLAVES_CIELO: ClaveCielo[] = [
  {
    minuto: 0,
    cenit: "#010103",
    horizonte: "#05060a",
    resplandor: "#1c0e06",
    fuerzaResplandor: 0.35,
    nubes: "#060608",
    fachada: [1, 1, 1],
    entrante: "#000000",
    fuerzaEntrante: 0,
  },
  {
    // La noche cerrada dura hasta las cinco. El amanecer no empieza a las
    // doce y cuarto: si el cielo aclarara parejo durante ocho horas, a las
    // tres ya se vería gris.
    minuto: 300,
    cenit: "#010204",
    horizonte: "#06080d",
    resplandor: "#170d07",
    fuerzaResplandor: 0.3,
    nubes: "#07080b",
    fachada: [1, 1, 1],
    entrante: "#000000",
    fuerzaEntrante: 0,
  },
  {
    minuto: 360,
    cenit: "#04091a",
    horizonte: "#0f1d3d",
    resplandor: "#1f3060",
    fuerzaResplandor: 0.55,
    // Las nubes, un punto por DEBAJO del cielo: al amanecer se leen como
    // masas oscuras contra la claridad, no como más cielo.
    nubes: "#0b1224",
    fachada: [1.5, 1.7, 2.4],
    entrante: "#3a55a0",
    fuerzaEntrante: 0.35,
  },
  {
    minuto: 420,
    cenit: "#0b1a3a",
    horizonte: "#36466e",
    resplandor: "#b0707a",
    fuerzaResplandor: 0.75,
    nubes: "#2a2c40",
    fachada: [2.6, 2.6, 3.2],
    entrante: "#7f8ab8",
    fuerzaEntrante: 0.6,
  },
  {
    // Naranja tenue y solo abajo. Es septiembre en Puerto Montt y está
    // nublado: el sol no se ve, se ve la parte de abajo de las nubes
    // encendiéndose por detrás de los techos.
    minuto: 480,
    cenit: "#243b66",
    horizonte: "#c98a5e",
    resplandor: "#e8a070",
    fuerzaResplandor: 0.8,
    nubes: "#5d4e5a",
    fachada: [4.2, 3.6, 3.2],
    entrante: "#ffc38a",
    fuerzaEntrante: 1,
  },
];

/** Todo lo que cambia con la hora, ya en valores lineales. */
export interface EstadoAtmosfera {
  cenit: RGB;
  horizonte: RGB;
  resplandor: RGB;
  fuerzaResplandor: number;
  nubes: RGB;
  fachada: RGB;
  entrante: RGB;
  fuerzaEntrante: number;
  /** Ventanas que se apagan a la 01:10. */
  ventanasA: number;
  /** Ventanas que se apagan a las 02:40. */
  ventanasB: number;
  /** El televisor del tercer piso, hasta la 01:40. */
  tele: number;
  /** Cocinas que se encienden a las 05:55. */
  cocinasTempranas: number;
  /** Cocinas que se encienden a las 06:40. */
  cocinasTardias: number;
  /** La farola, que se apaga a las 07:38. */
  farola: number;
  /** De 0 a 1 entre las 05:30 y las 08:00. */
  claridad: number;
}

/** El estado de la calle a una hora del turno. Función pura. */
export function estadoEn(minuto: number): EstadoAtmosfera {
  const m = limitar(minuto, 0, 480);
  let i = 0;
  while (i < CLAVES_CIELO.length - 2 && m > CLAVES_CIELO[i + 1].minuto) i++;
  const a = CLAVES_CIELO[i];
  const b = CLAVES_CIELO[i + 1];
  const t = suave(0, 1, (m - a.minuto) / (b.minuto - a.minuto));

  const mezclar = (x: RGB, y: RGB): RGB => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  const color = (x: string, y: string): RGB => mezclar(lineal(desdeHex(x)), lineal(desdeHex(y)));

  return {
    cenit: color(a.cenit, b.cenit),
    horizonte: color(a.horizonte, b.horizonte),
    resplandor: color(a.resplandor, b.resplandor),
    fuerzaResplandor: a.fuerzaResplandor + (b.fuerzaResplandor - a.fuerzaResplandor) * t,
    nubes: color(a.nubes, b.nubes),
    fachada: mezclar(a.fachada, b.fachada),
    entrante: color(a.entrante, b.entrante),
    fuerzaEntrante: a.fuerzaEntrante + (b.fuerzaEntrante - a.fuerzaEntrante) * t,
    ventanasA: 1 - suave(68, 72, m),
    ventanasB: 1 - suave(158, 162, m),
    tele: 1 - suave(98, 101, m),
    cocinasTempranas: suave(354, 357, m),
    cocinasTardias: suave(399, 402, m),
    farola: 1 - suave(457, 460, m),
    claridad: suave(330, 480, m),
  };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const GLSL_RUIDO = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

Effect.ShadersStore["exteriorTurnoVertexShader"] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// El cielo: degradado, resplandor bajo el horizonte y una capa de nubes bajas
// que se desplaza despacio. Sale en lineal; el tono lo pone el post-proceso.
Effect.ShadersStore["cieloTurnoFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform vec3 cenit;
uniform vec3 horizonte;
uniform vec3 resplandor;
uniform vec3 colorNubes;
uniform float fuerzaResplandor;
uniform float tiempo;
uniform float lineaHorizonte;
uniform vec2 centroResplandor;
${GLSL_RUIDO}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int o = 0; o < 5; o++) {
    s += ruido(p) * a;
    p = p * 2.02 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
void main(void) {
  float altura = clamp((vUV.y - lineaHorizonte) / (1.0 - lineaHorizonte), 0.0, 1.0);
  // Exponente bajo: por el ventanal solo se ve la franja cercana a los techos,
  // y con uno lineal esa franja entera salía color horizonte.
  vec3 cielo = mix(horizonte, cenit, pow(altura, 0.35));

  vec2 d = (vUV - centroResplandor) * vec2(0.9, 2.4);
  float halo = exp(-dot(d, d) * 5.0);
  cielo += resplandor * fuerzaResplandor * halo;

  // Estratos de lluvia: estirados en horizontal y a la deriva.
  vec2 q = vec2(vUV.x * 2.6 + tiempo * 0.002, vUV.y * 6.5);
  float n = fbm(q + vec2(fbm(q * 0.7 + tiempo * 0.0015), 0.0) * 0.8);
  float nube = smoothstep(0.38, 0.72, n);
  float luzNube = 0.55 + 0.9 * (0.35 + 0.65 * halo * fuerzaResplandor);
  cielo = mix(cielo, colorNubes * luzNube, nube * 0.8);

  // Tramado fijo: en un degradado casi negro, sin él se ven los escalones.
  cielo += (hash21(gl_FragCoord.xy) - 0.5) * 0.0045;
  gl_FragColor = vec4(max(cielo, vec3(0.0)), 1.0);
}
`;

// La calle de enfrente: la fachada iluminada por el cielo, las luces por
// grupos y la calzada mojada devolviendo el color del cielo.
Effect.ShadersStore["fachadaTurnoFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D baseSampler;
uniform sampler2D emisivasSampler;
uniform sampler2D mascarasSampler;
uniform vec3 ambiente;
uniform vec3 cenit;
uniform vec3 horizonte;
uniform float nivelA;
uniform float nivelB;
uniform float nivelC1;
uniform float nivelC2;
uniform float nivelTV;
uniform float nivelFarola;
uniform float tiempo;
uniform float lineaCalle;
${GLSL_RUIDO}
void main(void) {
  vec4 base = texture2D(baseSampler, vUV);
  if (base.a < 0.5) discard;
  vec3 color = pow(base.rgb, vec3(2.2)) * ambiente;

  vec3 e = texture2D(emisivasSampler, vUV).rgb;
  vec3 m = texture2D(mascarasSampler, vUV).rgb;
  e *= e;
  m *= m;
  float tele = 0.7 + 0.3 * sin(tiempo * 9.0 + sin(tiempo * 2.7) * 4.0) * sin(tiempo * 3.1);
  color += vec3(1.6, 0.99, 0.45) * e.r * nivelA;
  color += vec3(1.4, 1.09, 0.7) * e.g * nivelB;
  color += vec3(1.12, 1.28, 1.5) * e.b * nivelC1;
  color += vec3(1.12, 1.28, 1.5) * m.b * nivelC2;
  color += vec3(0.52, 0.72, 1.3) * m.g * nivelTV * tele;
  color += vec3(1.2, 0.79, 0.38) * m.r * nivelFarola;

  if (vUV.y < lineaCalle) {
    float profundidad = (lineaCalle - vUV.y) / lineaCalle;
    float charco = smoothstep(0.5, 0.78, ruido(vec2(vUV.x * 22.0, vUV.y * 90.0)));
    vec3 reflejo = mix(horizonte, cenit, clamp(profundidad * 1.5, 0.0, 1.0));
    color += reflejo * (0.12 + 0.45 * charco) * (1.0 - profundidad * 0.55);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

// El halo de la farola en el aire húmedo. Aditivo y siempre de cara.
Effect.ShadersStore["haloFarolaFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform vec3 color;
uniform float nivel;
void main(void) {
  float r = length(vUV - 0.5) * 2.0;
  float nucleo = exp(-r * r * 18.0);
  float bruma = exp(-r * 3.2) * (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(color * nivel * (nucleo * 1.4 + bruma * 0.35), 1.0);
}
`;

// ---------------------------------------------------------------------------
// La calle, pintada en capas
// ---------------------------------------------------------------------------

const W = 2048;
const H = 1138;
const Y_VEREDA = 0.625 * H;
const Y_BORDILLO = 0.655 * H;
const ALTO_PISO = 0.034 * H;

type Grupo = "apagada" | "A" | "B" | "C1" | "C2" | "TV";

interface Ventana {
  x: number;
  y: number;
  w: number;
  h: number;
  grupo: Grupo;
  cortina: number;
}

interface Edificio {
  x0: number;
  x1: number;
  techo: number;
  color: string;
  columnas: number;
  locales: boolean;
  azotea: "estanque" | "antenas" | "sala" | null;
  balcones: boolean;
}

const EDIFICIOS: Edificio[] = [
  { x0: 0, x1: 0.2, techo: 0.3, color: "#191c25", columnas: 5, locales: false, azotea: "antenas", balcones: true },
  { x0: 0.2, x1: 0.425, techo: 0.4, color: "#1c2029", columnas: 7, locales: true, azotea: "estanque", balcones: false },
  { x0: 0.425, x1: 0.53, techo: 0.5, color: "#171a21", columnas: 3, locales: false, azotea: null, balcones: false },
  { x0: 0.53, x1: 0.745, techo: 0.375, color: "#1a1d27", columnas: 7, locales: true, azotea: "sala", balcones: true },
  { x0: 0.745, x1: 1, techo: 0.44, color: "#1d2029", columnas: 7, locales: true, azotea: "estanque", balcones: false },
];

/** Dónde va cada grupo: textura (0 emisivas, 1 máscaras) y canal. */
const CANAL: Record<Exclude<Grupo, "apagada">, [number, number]> = {
  A: [0, 0],
  B: [0, 1],
  C1: [0, 2],
  TV: [1, 1],
  C2: [1, 2],
};

function crearVentanas(): Ventana[] {
  const azar = crearAzar(2026);
  const ventanas: Ventana[] = [];
  EDIFICIOS.forEach((e, indiceEdificio) => {
    const x0 = e.x0 * W;
    const anchoCol = ((e.x1 - e.x0) * W) / e.columnas;
    const base = e.locales ? Y_VEREDA - 0.05 * H : Y_VEREDA - 0.012 * H;
    let piso = 0;
    for (let y = e.techo * H + 0.018 * H; y + ALTO_PISO * 0.62 < base; y += ALTO_PISO, piso++) {
      for (let c = 0; c < e.columnas; c++) {
        const w = anchoCol * 0.52;
        const r = azar();
        let grupo: Grupo = r < 0.08 ? "A" : r < 0.14 ? "B" : r < 0.22 ? "C1" : r < 0.3 ? "C2" : "apagada";
        // La tele: una sola, en el edificio que queda de frente, tercer piso.
        if (indiceEdificio === 3 && piso === 3 && c === 2) grupo = "TV";
        ventanas.push({ x: x0 + (c + 0.5) * anchoCol - w / 2, y, w, h: ALTO_PISO * 0.55, grupo, cortina: azar() });
      }
    }
  });
  return ventanas;
}

function pintarBase(ctx: CanvasRenderingContext2D, ventanas: Ventana[]): void {
  ctx.clearRect(0, 0, W, H);
  const azar = crearAzar(77);

  // Cerros detrás de la ciudad. Solo asoman sobre la casa baja, y al amanecer
  // son lo primero que se recorta contra el cielo.
  (
    [
      [0.455, "#0d1017", 0.035, 3],
      [0.49, "#0a0c12", 0.025, 7],
    ] as const
  ).forEach(([yBase, color, amplitud, semilla]) => {
    ctx.beginPath();
    ctx.moveTo(0, Y_VEREDA);
    for (let x = 0; x <= W; x += 16) {
      ctx.lineTo(x, (yBase + (fbm((x / W) * 3, semilla, semilla, 3) - 0.5) * amplitud * 2) * H);
    }
    ctx.lineTo(W, Y_VEREDA);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });

  EDIFICIOS.forEach((e) => {
    const x0 = e.x0 * W;
    const ancho = (e.x1 - e.x0) * W;
    const techo = e.techo * H;
    const anchoCol = ancho / e.columnas;

    ctx.fillStyle = e.color;
    ctx.fillRect(x0, techo, ancho, Y_VEREDA - techo);

    // Losas y juntas de paneles: sin ellas un edificio es un rectángulo.
    for (let y = techo + ALTO_PISO; y < Y_VEREDA; y += ALTO_PISO) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(x0, y - 1, ancho, 2);
      if (e.balcones) {
        ctx.fillStyle = "rgba(140,150,170,0.13)";
        ctx.fillRect(x0 + 4, y - ALTO_PISO * 0.22, ancho - 8, 3);
      }
    }
    for (let c = 1; c < e.columnas; c++) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x0 + c * anchoCol, techo, 1, Y_VEREDA - techo);
    }
    ctx.fillStyle = "rgba(120,130,150,0.18)";
    ctx.fillRect(x0, techo, ancho, 5);

    if (e.azotea === "estanque") {
      const cx = x0 + ancho * 0.62;
      ctx.fillStyle = "#15181f";
      ctx.fillRect(cx - 40, techo - 46, 80, 34);
      ctx.fillRect(cx - 34, techo - 12, 6, 12);
      ctx.fillRect(cx + 28, techo - 12, 6, 12);
    } else if (e.azotea === "antenas") {
      ctx.fillStyle = "#14161c";
      [0.3, 0.55, 0.7].forEach((f, k) => ctx.fillRect(x0 + ancho * f, techo - 30 - k * 12, 3, 30 + k * 12));
      ctx.fillRect(x0 + ancho * 0.55 - 14, techo - 40, 31, 3);
    } else if (e.azotea === "sala") {
      ctx.fillStyle = "#171a22";
      ctx.fillRect(x0 + ancho * 0.18, techo - 32, ancho * 0.24, 32);
    }

    if (e.locales) {
      ctx.fillStyle = "#262a32";
      ctx.fillRect(x0, Y_VEREDA - 0.058 * H, ancho, 0.011 * H);
      for (let c = 0; c < e.columnas; c++) {
        const x = x0 + c * anchoCol + anchoCol * 0.07;
        ctx.fillStyle = "#20232a";
        ctx.fillRect(x, Y_VEREDA - 0.045 * H, anchoCol * 0.86, 0.045 * H);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (let y = Y_VEREDA - 0.045 * H; y < Y_VEREDA; y += 4) ctx.fillRect(x, y, anchoCol * 0.86, 1);
      }
    }
  });

  // Vidrio apagado: devuelve algo de cielo arriba, que es lo que al amanecer
  // hace que las ventanas oscuras se sigan leyendo como ventanas.
  ventanas.forEach((v) => {
    const vidrio = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    vidrio.addColorStop(0, "#131823");
    vidrio.addColorStop(1, "#090b10");
    ctx.fillStyle = vidrio;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = "rgba(70,78,92,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(v.x + 0.5, v.y + 0.5, v.w - 1, v.h - 1);
    if (v.grupo === "apagada" && v.cortina > 0.6) {
      ctx.fillStyle = "rgba(40,44,52,0.55)";
      for (let y = v.y + 3; y < v.y + v.h; y += 3) ctx.fillRect(v.x + 1, y, v.w - 2, 1);
    }
  });

  ctx.fillStyle = "#15171d";
  ctx.fillRect(0, Y_VEREDA, W, Y_BORDILLO - Y_VEREDA);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let x = 0; x < W; x += 60) ctx.fillRect(x, Y_VEREDA, 1, Y_BORDILLO - Y_VEREDA);
  ctx.fillStyle = "#2a2e36";
  ctx.fillRect(0, Y_BORDILLO - 3, W, 6);
  ctx.fillStyle = "rgba(150,160,180,0.2)";
  ctx.fillRect(0, Y_BORDILLO - 3, W, 1);

  const calzada = ctx.createLinearGradient(0, Y_BORDILLO, 0, H);
  calzada.addColorStop(0, "#0d0f14");
  calzada.addColorStop(1, "#07080b");
  ctx.fillStyle = calzada;
  ctx.fillRect(0, Y_BORDILLO + 3, W, H - Y_BORDILLO - 3);
  for (let k = 0; k < 5000; k++) {
    ctx.fillStyle = azar() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(azar() * W, Y_BORDILLO + 3 + azar() * (H - Y_BORDILLO), 1 + azar(), 1);
  }
  ctx.fillStyle = "#2c2e33";
  for (let x = 20; x < W; x += 160) ctx.fillRect(x, 0.735 * H, 70, 5);
}

/** Pinta las luces que viven en una de las dos texturas de luz. */
function pintarLuces(ctx: CanvasRenderingContext2D, ventanas: Ventana[], textura: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Aditivo: cada grupo escribe en SU canal sin tocar los otros dos.
  ctx.globalCompositeOperation = "lighter";

  const tono = (canal: number, valor: number): string => {
    const v = Math.round(limitar(valor / 255) * 255);
    return canal === 0 ? `rgb(${v},0,0)` : canal === 1 ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
  };

  ventanas.forEach((v) => {
    if (v.grupo === "apagada") return;
    const [tex, canal] = CANAL[v.grupo];
    if (tex !== textura) return;

    const interior = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    interior.addColorStop(0, tono(canal, 255));
    interior.addColorStop(1, tono(canal, 170));
    ctx.fillStyle = interior;
    if (v.cortina > 0.45) {
      // Cortina corrida hasta la mitad: la luz se ve tamizada en ese lado.
      const cortina = v.w * (0.25 + 0.2 * v.cortina);
      ctx.fillRect(v.x + cortina, v.y + 1, v.w - cortina - 1, v.h - 2);
      ctx.fillStyle = tono(canal, 95);
      ctx.fillRect(v.x + 1, v.y + 1, cortina, v.h - 2);
    } else {
      ctx.fillRect(v.x + 1, v.y + 1, v.w - 2, v.h - 2);
    }

    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, v.w * 1.9);
    halo.addColorStop(0, tono(canal, 46));
    halo.addColorStop(1, tono(canal, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, v.w * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Su reflejo en la calzada mojada, más abajo cuanto más alta la ventana.
    const yReflejo = Y_BORDILLO + 6 + (Y_BORDILLO - (v.y + v.h)) * 0.22;
    if (yReflejo < H) {
      const largo = H * 0.09;
      const reflejo = ctx.createLinearGradient(0, yReflejo, 0, yReflejo + largo);
      reflejo.addColorStop(0, tono(canal, 40));
      reflejo.addColorStop(1, tono(canal, 0));
      ctx.fillStyle = reflejo;
      ctx.beginPath();
      ctx.moveTo(cx - v.w * 0.45, yReflejo);
      ctx.lineTo(cx + v.w * 0.45, yReflejo);
      ctx.lineTo(cx + v.w * 0.2, yReflejo + largo);
      ctx.lineTo(cx - v.w * 0.2, yReflejo + largo);
      ctx.closePath();
      ctx.fill();
    }
  });

  if (textura === 1) {
    // La farola, en el rojo de las máscaras: su charco en la vereda de
    // enfrente, lo poco que alcanza de la fachada y el reflejo en la calzada.
    const fx = 0.665 * W;
    ctx.save();
    ctx.translate(fx, Y_VEREDA + 0.012 * H);
    ctx.scale(1, 0.35);
    const charco = ctx.createRadialGradient(0, 0, 4, 0, 0, 0.16 * W);
    charco.addColorStop(0, tono(0, 120));
    charco.addColorStop(1, tono(0, 0));
    ctx.fillStyle = charco;
    ctx.beginPath();
    ctx.arc(0, 0, 0.16 * W, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const fachada = ctx.createRadialGradient(fx, Y_VEREDA - 0.06 * H, 4, fx, Y_VEREDA - 0.06 * H, 0.12 * W);
    fachada.addColorStop(0, tono(0, 40));
    fachada.addColorStop(1, tono(0, 0));
    ctx.fillStyle = fachada;
    ctx.beginPath();
    ctx.arc(fx, Y_VEREDA - 0.06 * H, 0.12 * W, 0, Math.PI * 2);
    ctx.fill();

    const reflejo = ctx.createLinearGradient(0, Y_BORDILLO, 0, Y_BORDILLO + 0.14 * H);
    reflejo.addColorStop(0, tono(0, 90));
    reflejo.addColorStop(1, tono(0, 0));
    ctx.fillStyle = reflejo;
    ctx.beginPath();
    ctx.moveTo(fx - 70, Y_BORDILLO);
    ctx.lineTo(fx + 70, Y_BORDILLO);
    ctx.lineTo(fx + 25, Y_BORDILLO + 0.14 * H);
    ctx.lineTo(fx - 25, Y_BORDILLO + 0.14 * H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

function lienzo(scene: Scene, nombre: string, escala: number): { textura: DynamicTexture; ctx: CanvasRenderingContext2D } {
  const textura = new DynamicTexture(
    nombre,
    { width: Math.round(W * escala), height: Math.round(H * escala) },
    scene,
    true
  );
  textura.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  textura.anisotropicFilteringLevel = 16;
  textura.wrapU = Texture.CLAMP_ADDRESSMODE;
  textura.wrapV = Texture.CLAMP_ADDRESSMODE;
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  ctx.save();
  ctx.scale(escala, escala);
  return { textura, ctx };
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

/** Lo que la atmósfera necesita de la sala, construido antes. */
export interface PiezasExterior {
  /** El plano lejano de la calle. La atmósfera le pone su material. */
  calle: Mesh;
  /** El vidrio del ventanal: reflejo, transparencia y lluvia. */
  cristal: PBRMaterial;
  farola: SpotLight;
  bulboFarola: PBRMaterial;
  /** Posición del bulbo, para colgar su halo. */
  posicionBulbo: Vector3;
  relleno: HemisphericLight | null;
}

export interface AtmosferaTurno {
  /** La hora del turno. Lo que se ve la sigue suavemente. */
  enMinuto(minuto: number): void;
  /** Salta a una hora sin suavizar. */
  fijarMinuto(minuto: number): void;
}

export function crearAtmosferaTurno(scene: Scene, piezas: PiezasExterior): AtmosferaTurno {
  const ventanas = crearVentanas();

  const base = lienzo(scene, "texCalleBase", 1);
  pintarBase(base.ctx, ventanas);
  base.ctx.restore();
  base.textura.hasAlpha = true;
  base.textura.update();

  const emisivas = lienzo(scene, "texCalleLuces", 0.5);
  pintarLuces(emisivas.ctx, ventanas, 0);
  emisivas.ctx.restore();
  emisivas.textura.update();

  const mascaras = lienzo(scene, "texCalleMascaras", 0.5);
  pintarLuces(mascaras.ctx, ventanas, 1);
  mascaras.ctx.restore();
  mascaras.textura.update();

  // --- Cielo -----------------------------------------------------------------
  // Detrás de la calle y del mismo tamaño: se ve solo por donde la fachada es
  // transparente, así que las coordenadas de los dos planos coinciden.
  const cielo = MeshBuilder.CreatePlane("calleExteriorCielo", { width: 9, height: 5 }, scene);
  cielo.position.set(piezas.calle.position.x, piezas.calle.position.y, piezas.calle.position.z + 0.05);
  cielo.isPickable = false;
  const matCielo = new ShaderMaterial(
    "matCieloTurno",
    scene,
    { vertex: "exteriorTurno", fragment: "cieloTurno" },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "worldViewProjection",
        "cenit",
        "horizonte",
        "resplandor",
        "colorNubes",
        "fuerzaResplandor",
        "tiempo",
        "lineaHorizonte",
        "centroResplandor",
      ],
    }
  );
  matCielo.setFloat("lineaHorizonte", 0.5);
  matCielo.setVector2("centroResplandor", new Vector2(0.6, 0.5));
  cielo.material = matCielo;

  // --- Fachada ---------------------------------------------------------------
  const matFachada = new ShaderMaterial(
    "matFachadaTurno",
    scene,
    { vertex: "exteriorTurno", fragment: "fachadaTurno" },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "worldViewProjection",
        "ambiente",
        "cenit",
        "horizonte",
        "nivelA",
        "nivelB",
        "nivelC1",
        "nivelC2",
        "nivelTV",
        "nivelFarola",
        "tiempo",
        "lineaCalle",
      ],
      samplers: ["baseSampler", "emisivasSampler", "mascarasSampler"],
    }
  );
  matFachada.setTexture("baseSampler", base.textura);
  matFachada.setTexture("emisivasSampler", emisivas.textura);
  matFachada.setTexture("mascarasSampler", mascaras.textura);
  matFachada.setFloat("lineaCalle", 1 - Y_BORDILLO / H);
  piezas.calle.material = matFachada;
  piezas.calle.isPickable = false;

  // --- Halo de la farola -----------------------------------------------------
  const halo = MeshBuilder.CreatePlane("calleExteriorHaloFarola", { size: 1.1 }, scene);
  halo.position.copyFrom(piezas.posicionBulbo);
  halo.position.y -= 0.05;
  halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
  halo.isPickable = false;
  const matHalo = new ShaderMaterial(
    "matHaloFarola",
    scene,
    { vertex: "exteriorTurno", fragment: "haloFarola" },
    { attributes: ["position", "uv"], uniforms: ["worldViewProjection", "color", "nivel"], needAlphaBlending: true }
  );
  matHalo.alphaMode = Constants.ALPHA_ADD;
  matHalo.disableDepthWrite = true;
  matHalo.backFaceCulling = false;
  matHalo.setColor3("color", new Color3(1, 0.72, 0.4));
  halo.material = matHalo;

  // --- La luz que entra por el ventanal ----------------------------------------
  //
  // Difusa y ancha, sin sombra ni recorte de ventana: un cielo nublado no dibuja
  // la ventana en el suelo, lo aclara. Solo alcanza al hall, no a lo del mesón,
  // que queda a cuatro metros y bajo el flexo.
  const entrante = new SpotLight(
    "luzAmanecerVentanal",
    new Vector3(0, 2.1, 5.4),
    new Vector3(0, -0.45, -1).normalize(),
    1.3,
    1.5,
    scene
  );
  entrante.range = 9;
  entrante.intensity = 0;
  entrante.specular = new Color3(0.3, 0.3, 0.3);
  entrante.includedOnlyMeshes = scene.meshes.filter((m) =>
    /^(pisoHall|alfeizarVentanal|MuroAntepechoHall|MuroDintelHall|marcoVentanal|junquilloVentanal|TechoHall|MuroLateralHall|ZocaloHall|JambaPuertaHall|JambaAscensorHall|MuroFondoHall)/.test(
      m.name
    )
  );

  const rellenoBase = piezas.relleno ? piezas.relleno.diffuse.clone() : null;
  const intensidadRellenoBase = piezas.relleno?.intensity ?? 0;

  // --- Cada cuadro -------------------------------------------------------------
  const c = {
    cenit: new Color3(),
    horizonte: new Color3(),
    resplandor: new Color3(),
    nubes: new Color3(),
    ambiente: new Color3(),
  };
  const aColor = (destino: Color3, v: RGB): Color3 => destino.set(v[0], v[1], v[2]);

  let minutoObjetivo = 0;
  let minutoVisible = 0;
  let tiempo = 0;

  function aplicar(e: EstadoAtmosfera): void {
    matCielo.setColor3("cenit", aColor(c.cenit, e.cenit));
    matCielo.setColor3("horizonte", aColor(c.horizonte, e.horizonte));
    matCielo.setColor3("resplandor", aColor(c.resplandor, e.resplandor));
    matCielo.setColor3("colorNubes", aColor(c.nubes, e.nubes));
    matCielo.setFloat("fuerzaResplandor", e.fuerzaResplandor);
    matCielo.setFloat("tiempo", tiempo);

    // La fotocelda no apaga de golpe: el tubo titila un par de segundos.
    let farola = e.farola;
    if (farola > 0.02 && farola < 0.98) {
      const tic = Math.sin(Math.floor(tiempo * 14) * 12.9898) * 43758.5453;
      farola *= tic - Math.floor(tic) > 0.4 ? 1 : 0.2;
    }

    matFachada.setColor3("ambiente", aColor(c.ambiente, e.fachada));
    matFachada.setColor3("cenit", c.cenit);
    matFachada.setColor3("horizonte", c.horizonte);
    matFachada.setFloat("nivelA", e.ventanasA);
    matFachada.setFloat("nivelB", e.ventanasB);
    matFachada.setFloat("nivelC1", e.cocinasTempranas);
    matFachada.setFloat("nivelC2", e.cocinasTardias);
    matFachada.setFloat("nivelTV", e.tele);
    matFachada.setFloat("nivelFarola", farola);
    matFachada.setFloat("tiempo", tiempo);

    matHalo.setFloat("nivel", farola);
    piezas.farola.intensity = 26 * farola;
    piezas.bulboFarola.emissiveColor.set(farola, 0.86 * farola, 0.6 * farola);

    // De noche el vidrio devuelve la sala; al clarear fuera, deja ver.
    piezas.cristal.environmentIntensity = 1.6 - 0.8 * e.claridad;
    piezas.cristal.alpha = 0.42 - 0.12 * e.claridad;
    piezas.cristal.emissiveColor.set(
      0.34 * (0.55 + 0.45 * farola) + 0.28 * e.claridad,
      0.39 * (0.6 + 0.4 * farola) + 0.3 * e.claridad,
      0.48 * (0.7 + 0.3 * farola) + 0.33 * e.claridad
    );

    const tope = Math.max(e.entrante[0], e.entrante[1], e.entrante[2], 1e-4);
    entrante.diffuse.set(e.entrante[0] / tope, e.entrante[1] / tope, e.entrante[2] / tope);
    entrante.intensity = 7 * e.fuerzaEntrante;

    if (piezas.relleno && rellenoBase) {
      const k = e.claridad * 0.35;
      piezas.relleno.diffuse.set(
        rellenoBase.r + (entrante.diffuse.r * 0.7 - rellenoBase.r) * k,
        rellenoBase.g + (entrante.diffuse.g * 0.7 - rellenoBase.g) * k,
        rellenoBase.b + (entrante.diffuse.b * 0.7 - rellenoBase.b) * k
      );
      piezas.relleno.intensity = intensidadRellenoBase + 0.07 * e.claridad;
    }
  }

  aplicar(estadoEn(0));

  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    tiempo += dt;
    minutoVisible += (minutoObjetivo - minutoVisible) * (1 - Math.exp(-dt / 0.45));
    if (Math.abs(minutoObjetivo - minutoVisible) < 0.001) minutoVisible = minutoObjetivo;
    aplicar(estadoEn(minutoVisible));
  });
  // La escena se vacía al salir del turno; el observador no tiene que seguir
  // escribiendo en materiales que ya no existen.
  piezas.calle.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observador));

  return {
    enMinuto(minuto) {
      minutoObjetivo = limitar(minuto, 0, 480);
    },
    fijarMinuto(minuto) {
      minutoObjetivo = limitar(minuto, 0, 480);
      minutoVisible = minutoObjetivo;
      aplicar(estadoEn(minutoVisible));
    },
  };
}
