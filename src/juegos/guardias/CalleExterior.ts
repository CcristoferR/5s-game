import {
  Scene,
  Mesh,
  MeshBuilder,
  ShaderMaterial,
  Effect,
  Color3,
  Color4,
  Vector3,
  Vector4,
  SpotLight,
  HemisphericLight,
  PBRMaterial,
  DynamicTexture,
  Texture,
  Constants,
  ParticleSystem,
  AbstractMesh,
} from "@babylonjs/core";
import type { EstadoAtmosfera } from "./AtmosferaTurno";
import { crearAzar, generarAsfaltoMojado, subirMapa } from "./TexturasPBR";
import { crearVehiculo, crearArbol, crearFarol, prismaDePerfil } from "./ModelosCalle";

// ===========================================================================
// La calle de enfrente, con profundidad
// ===========================================================================
//
// Hasta ahora lo que se veía por el ventanal era un plano pintado a ocho
// metros: la fachada, la calle y el cielo en la misma lámina. Quieto pasaba;
// en cuanto la cámara se mueve —al inclinarse sobre el libro, al entrar el
// supervisor— todo se desplaza a la vez, como un cuadro colgado detrás del
// vidrio. Es el paralaje lo que dice "esto está lejos", y una lámina no lo
// tiene.
//
// Ahora hay capas a distancias reales, y cada una se desplaza a su velocidad:
//
//   · 9–18 m    la calzada mojada, su bordillo y un auto estacionado enfrente.
//   · 19–52 m   una plaza de estacionamiento con árboles, autos y faroles.
//   · 56–85 m   la hilera de casas de tinuela y un bloque de departamentos.
//   · 130–210 m bloques de la ciudad, velados por la distancia.
//   · 500–800 m dos capas de cerros.
//   · infinito  el cielo, con las nubes en perspectiva.
//
// ─── POR QUÉ LA PLAZA ─────────────────────────────────────────────────────
//
// Por la geometría del hueco. Desde la silla el ventanal deja ver apenas once
// grados por encima del horizonte: con las casas a veinte metros, sus
// fachadas llenaban el vidrio entero y el cielo del amanecer no se veía. A
// cincuenta y seis metros una casa de dos pisos queda por debajo de esa línea
// y deja una franja de cielo con los bloques y los cerros recortados.
//
// ─── Y POR QUÉ ESTA VEZ NO QUEDA OSCURO ───────────────────────────────────
//
// Porque nada depende de que una luz de la sala alcance cincuenta metros. Las
// fachadas llevan su propio shader: la luz del cielo según la hora, el lavado
// cálido de los faroles de la plaza en la planta baja, las ventanas por
// grupos y el aire que tiñe lo lejano. Lo que sí es PBR —suelo, autos,
// árboles— tiene luces propias acotadas a la calle: un cielo hemisférico y
// los faroles.

const Z_BORDILLO = 8.6;
const Z_VEREDA_ENFRENTE = 17.6;
const Z_PLAZA = 19.6;
const Z_SETOS = 52;
const Z_CASAS = 56;
const Y_CALZADA = -0.14;

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
`;

Effect.ShadersStore["calleMundoVertexShader"] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec2 vUV;
varying vec3 vPosW;
void main(void) {
  vec4 p = world * vec4(position, 1.0);
  vPosW = p.xyz;
  vUV = uv;
  gl_Position = viewProjection * p;
}
`;

// El cielo, por dirección de mirada: el horizonte está donde tiene que estar
// se mire desde donde se mire, y las nubes se proyectan sobre un techo de
// nubes en vez de pegarse a una lámina.
Effect.ShadersStore["calleCieloFragmentShader"] = `
precision highp float;
varying vec3 vPosW;
uniform vec3 camara;
uniform vec3 cenit;
uniform vec3 horizonte;
uniform vec3 resplandor;
uniform vec3 colorNubes;
uniform vec3 direccionResplandor;
uniform float fuerzaResplandor;
uniform float tiempo;
${GLSL_RUIDO}
void main(void) {
  vec3 dir = normalize(vPosW - camara);
  float alt = clamp(dir.y, 0.0, 1.0);
  vec3 cielo = mix(horizonte, cenit, pow(clamp(alt / 0.42, 0.0, 1.0), 0.5));

  vec3 plano = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001));
  float haciaLuz = max(dot(plano, direccionResplandor), 0.0);
  float halo = pow(haciaLuz, 3.0) * exp(-alt * 7.0);
  cielo += resplandor * fuerzaResplandor * halo;

  if (dir.y > 0.004) {
    vec2 p = dir.xz / dir.y * 0.35 + vec2(tiempo * 0.004, tiempo * 0.0015);
    float n = fbm(p * 0.6 + vec2(fbm(p * 0.25), 0.0) * 0.9);
    float nube = smoothstep(0.36, 0.74, n) * smoothstep(0.004, 0.06, dir.y);
    float luz = 0.55 + 0.9 * (0.35 + 0.65 * halo * fuerzaResplandor);
    cielo = mix(cielo, colorNubes * luz, nube * 0.85);
  }

  cielo += (hash21(gl_FragCoord.xy) - 0.5) * 0.0045;
  gl_FragColor = vec4(max(cielo, vec3(0.0)), 1.0);
}
`;

// Las fachadas: la luz que les llega según la hora, el farol en la planta
// baja, las ventanas encendidas por grupos y el aire de la distancia.
Effect.ShadersStore["calleFachadaFragmentShader"] = `
precision highp float;
varying vec2 vUV;
varying vec3 vPosW;
uniform sampler2D baseSampler;
uniform sampler2D lucesSampler;
uniform sampler2D mascarasSampler;
uniform vec3 camara;
uniform vec3 ambiente;
uniform vec3 horizonte;
uniform vec3 cenit;
uniform vec3 resplandor;
uniform float fuerzaResplandor;
uniform float nivelA;
uniform float nivelB;
uniform float nivelC1;
uniform float nivelC2;
uniform float nivelTV;
uniform float nivelCalle;
uniform float tiempo;
void main(void) {
  vec3 albedo = pow(texture2D(baseSampler, vUV).rgb, vec3(2.2));
  vec3 color = albedo * ambiente;
  float bajo = exp(-max(vPosW.y, 0.0) * 0.3);
  color += albedo * vec3(1.0, 0.62, 0.3) * nivelCalle * bajo * 2.2;

  vec3 e = texture2D(lucesSampler, vUV).rgb;
  vec3 m = texture2D(mascarasSampler, vUV).rgb;
  e *= e;
  m *= m;
  float tele = 0.7 + 0.3 * sin(tiempo * 9.0 + sin(tiempo * 2.7) * 4.0) * sin(tiempo * 3.1);
  vec3 luces = vec3(1.6, 0.99, 0.45) * e.r * nivelA
             + vec3(1.4, 1.09, 0.7) * e.g * nivelB
             + vec3(1.12, 1.28, 1.5) * e.b * nivelC1
             + vec3(1.12, 1.28, 1.5) * m.b * nivelC2
             + vec3(0.52, 0.72, 1.3) * m.g * nivelTV * tele
             + vec3(0.45, 1.25, 0.85) * m.r * max(nivelCalle, 0.25);

  // La bruma toma el color medio del cielo, no el del horizonte: al amanecer
  // el horizonte es naranja y velaba toda la ciudad de salmón. El aire húmedo
  // de la mañana es gris azulado, con apenas un toque del resplandor.
  float d = length(vPosW - camara);
  float niebla = 1.0 - exp(-d * 0.0045);
  vec3 aire = mix(horizonte, cenit, 0.55) * 0.9 + resplandor * fuerzaResplandor * 0.05;
  color = mix(color, aire, niebla);
  color += luces * (1.0 - niebla * 0.55);
  gl_FragColor = vec4(color, 1.0);
}
`;

// Un cordón de cerros: silueta por ruido, color de roca oscura con el aire de
// la distancia encima. Lo que queda por encima de la silueta se descarta.
Effect.ShadersStore["calleCerrosFragmentShader"] = `
precision highp float;
varying vec2 vUV;
varying vec3 vPosW;
uniform vec3 camara;
uniform vec3 ambiente;
uniform vec3 horizonte;
uniform vec3 cenit;
uniform vec3 resplandor;
uniform float fuerzaResplandor;
uniform float semilla;
uniform float perfil;
${GLSL_RUIDO}
void main(void) {
  float x = vUV.x * 7.0 + semilla;
  float cima = perfil + 0.28 * fbm(vec2(x, semilla)) + 0.08 * ruido(vec2(x * 6.0, semilla * 3.0));
  if (vUV.y > cima) discard;
  vec3 roca = vec3(0.004, 0.005, 0.006) * ambiente * (0.8 + 0.4 * fbm(vUV * vec2(40.0, 12.0)));
  float d = length(vPosW - camara);
  float niebla = 1.0 - exp(-d * 0.0021);
  vec3 aire = mix(horizonte, cenit, 0.4) * 0.95 + resplandor * fuerzaResplandor * 0.08;
  gl_FragColor = vec4(mix(roca, aire, niebla), 1.0);
}
`;

// Halo de una luminaria en el aire húmedo. Aditivo y siempre de cara.
Effect.ShadersStore["calleHaloVertexShader"] = `
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
Effect.ShadersStore["calleHaloFragmentShader"] = `
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
// Las fachadas y su atlas
// ---------------------------------------------------------------------------

type Grupo = "apagada" | "A" | "B" | "C1" | "C2" | "TV";
type Tipo = "casa" | "bloque" | "lejano";

interface Fachada {
  nombre: string;
  tipo: Tipo;
  /** Centro en X y cara frontal en Z, en metros. */
  x: number;
  z: number;
  ancho: number;
  alto: number;
  fondo: number;
  pisos: number;
  columnas: number;
  color: string;
  dosAguas: boolean;
  local: string | null;
  /** Región del atlas en píxeles del lienzo base. */
  region: { x: number; y: number; w: number; h: number };
}

const ATLAS = 2048;
const PALETA_CASAS = ["#2b2420", "#212a31", "#2c2a22", "#2a2229", "#222a24", "#302a26"];
const PALETA_BLOQUES = ["#1c1f26", "#20232b", "#1a1d23"];
const LOCALES = ["ALMACÉN", "FARMACIA", "BOTILLERÍA", "PANADERÍA"];

function crearFachadas(): Fachada[] {
  const azar = crearAzar(311);
  const fachadas: Fachada[] = [];

  let x = -44;
  let i = 0;
  while (x < 50) {
    const ancho = 7 + azar() * 4.5;
    const dosPisos = azar() > 0.3;
    const alto = dosPisos ? 5.9 + azar() * 1.1 : 3.6 + azar() * 0.6;
    fachadas.push({
      nombre: `casa_${i}`,
      tipo: "casa",
      x: x + ancho / 2,
      z: Z_CASAS + azar() * 1.5,
      ancho,
      alto,
      fondo: 9,
      pisos: dosPisos ? 2 : 1,
      columnas: Math.max(2, Math.floor(ancho / 2.4)),
      color: PALETA_CASAS[Math.floor(azar() * PALETA_CASAS.length)],
      dosAguas: azar() > 0.25,
      local: !dosPisos || azar() > 0.7 ? LOCALES[i % LOCALES.length] : null,
      region: { x: 0, y: 0, w: 0, h: 0 },
    });
    x += ancho + (azar() < 0.35 ? 1.4 : 0.15);
    i++;
  }

  fachadas.push({
    nombre: "bloque",
    tipo: "bloque",
    x: 8,
    z: 74,
    ancho: 30,
    alto: 13,
    fondo: 14,
    pisos: 4,
    columnas: 10,
    color: PALETA_BLOQUES[0],
    dosAguas: false,
    local: null,
    region: { x: 0, y: 0, w: 0, h: 0 },
  });

  [
    [-96, 150, 32, 30],
    [-52, 188, 26, 38],
    [-16, 140, 22, 24],
    [34, 172, 36, 34],
    [78, 150, 28, 27],
    [122, 205, 40, 42],
    [4, 210, 30, 44],
  ].forEach(([cx, cz, ancho, alto], k) => {
    fachadas.push({
      nombre: `lejano_${k}`,
      tipo: "lejano",
      x: cx,
      z: cz,
      ancho,
      alto,
      fondo: 20,
      pisos: Math.floor(alto / 3),
      columnas: Math.floor(ancho / 3.2),
      color: PALETA_BLOQUES[k % PALETA_BLOQUES.length],
      dosAguas: false,
      local: null,
      region: { x: 0, y: 0, w: 0, h: 0 },
    });
  });

  // Estantería de filas: cada fachada recibe su rectángulo en el atlas, con
  // la densidad que pide su distancia. Las cercanas a 32 px por metro; las
  // lejanas a 10, que es de sobra para lo que ocupan en pantalla.
  let cx = 0;
  let cy = 0;
  let fila = 0;
  fachadas.forEach((f) => {
    const px = f.tipo === "lejano" ? 10 : 32;
    const w = Math.ceil(f.ancho * px);
    const h = Math.ceil(f.alto * px);
    if (cx + w > ATLAS) {
      cx = 0;
      cy += fila + 2;
      fila = 0;
    }
    f.region = { x: cx, y: cy, w, h };
    cx += w + 2;
    fila = Math.max(fila, h);
  });
  return fachadas;
}

/** Regiones fijas: un muro lateral genérico y un color oscuro de relleno. */
const REGION_LATERAL = { x: ATLAS - 130, y: ATLAS - 260, w: 128, h: 258 };
const REGION_OSCURA = { x: ATLAS - 150, y: ATLAS - 20, w: 16, h: 16 };

const CANAL: Record<Exclude<Grupo, "apagada">, [number, number]> = {
  A: [0, 0],
  B: [0, 1],
  C1: [0, 2],
  TV: [1, 1],
  C2: [1, 2],
};

interface Lienzos {
  base: CanvasRenderingContext2D;
  luces: CanvasRenderingContext2D;
  mascaras: CanvasRenderingContext2D;
}

function tono(canal: number, valor: number): string {
  const v = Math.round(Math.max(0, Math.min(255, valor)));
  return canal === 0 ? `rgb(${v},0,0)` : canal === 1 ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
}

function pintarAtlas(l: Lienzos, fachadas: Fachada[]): void {
  const azar = crearAzar(2026);
  l.base.fillStyle = "#0b0c10";
  l.base.fillRect(0, 0, ATLAS, ATLAS);
  l.luces.fillStyle = "#000";
  l.luces.fillRect(0, 0, ATLAS, ATLAS);
  l.mascaras.fillStyle = "#000";
  l.mascaras.fillRect(0, 0, ATLAS, ATLAS);
  l.luces.globalCompositeOperation = "lighter";
  l.mascaras.globalCompositeOperation = "lighter";

  let teleAsignada = false;

  fachadas.forEach((f) => {
    const { x: rx, y: ry, w: rw, h: rh } = f.region;
    const px = rw / f.ancho;
    const b = l.base;

    b.fillStyle = f.color;
    b.fillRect(rx, ry, rw, rh);

    if (f.tipo === "casa") {
      // Tinuela: el revestimiento de tablas horizontales de las casas del sur.
      for (let y = ry; y < ry + rh; y += Math.max(3, 0.18 * px)) {
        b.fillStyle = "rgba(255,255,255,0.035)";
        b.fillRect(rx, y, rw, 1);
        b.fillStyle = "rgba(0,0,0,0.18)";
        b.fillRect(rx, y + 1, rw, 1);
      }
      b.fillStyle = "rgba(255,255,255,0.06)";
      b.fillRect(rx, ry, rw, Math.max(2, 0.15 * px));
    } else {
      // Paneles de hormigón y losas marcadas.
      for (let k = 1; k < f.pisos; k++) {
        b.fillStyle = "rgba(255,255,255,0.03)";
        b.fillRect(rx, ry + (rh * k) / f.pisos, rw, Math.max(1, 0.12 * px));
      }
      for (let y = ry; y < ry + rh; y += 3) {
        b.fillStyle = azar() > 0.5 ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0.03)";
        b.fillRect(rx, y, rw, 2);
      }
    }

    // --- Planta baja de las casas: puerta o local ---------------------------
    const altoPiso = f.alto / f.pisos;
    if (f.tipo === "casa") {
      const suelo = ry + rh;
      if (f.local) {
        const anchoLocal = Math.min(rw * 0.7, 5.5 * px);
        const lx = rx + (rw - anchoLocal) / 2;
        b.fillStyle = "#15171c";
        b.fillRect(lx, suelo - 2.4 * px, anchoLocal, 2.4 * px);
        b.fillStyle = "rgba(0,0,0,0.35)";
        for (let y = suelo - 2.4 * px; y < suelo; y += 4) b.fillRect(lx, y, anchoLocal, 1);
        // Letrero: tabla oscura en la base y el texto encendido en la máscara.
        b.fillStyle = "#1d2026";
        b.fillRect(lx, suelo - 3.1 * px, anchoLocal, 0.6 * px);
        [l.mascaras].forEach((ctx) => {
          ctx.fillStyle = tono(0, 255);
          ctx.font = `bold ${Math.round(0.42 * px)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(f.local!, lx + anchoLocal / 2, suelo - 2.8 * px);
        });
      } else {
        const puertaX = rx + rw * (0.2 + azar() * 0.6) - 0.5 * px;
        b.fillStyle = "#17110d";
        b.fillRect(puertaX, suelo - 2.1 * px, 1.0 * px, 2.1 * px);
        b.strokeStyle = "rgba(200,190,170,0.18)";
        b.lineWidth = 1;
        b.strokeRect(puertaX + 0.5, suelo - 2.1 * px + 0.5, 1.0 * px - 1, 2.1 * px - 1);
      }
    }

    // --- Ventanas ----------------------------------------------------------------
    const lejana = f.tipo === "lejano";
    const anchoV = (lejana ? 1.5 : f.tipo === "bloque" ? 1.5 : 1.15) * px;
    const altoV = (lejana ? 1.7 : 1.3) * px;
    const pisoInicial = f.tipo === "casa" ? (f.local || f.pisos === 1 ? (f.pisos === 1 ? 0 : 1) : 0) : 0;

    for (let p = pisoInicial; p < f.pisos; p++) {
      // Casas de un piso con local: la ventana va sobre el local, no hay.
      if (f.tipo === "casa" && f.pisos === 1 && f.local) break;
      const centroY = ry + rh - (p + 0.58) * altoPiso * px;
      for (let c = 0; c < f.columnas; c++) {
        const cxv = rx + ((c + 0.5) / f.columnas) * rw;
        if (f.tipo === "casa" && p === 0 && !f.local && Math.abs(cxv - (rx + rw / 2)) < 0.4 * px && azar() > 0.5) continue;
        const vx = cxv - anchoV / 2;
        const vy = centroY - altoV / 2;

        const vidrio = b.createLinearGradient(0, vy, 0, vy + altoV);
        vidrio.addColorStop(0, "#161b26");
        vidrio.addColorStop(1, "#0a0c11");
        b.fillStyle = vidrio;
        b.fillRect(vx, vy, anchoV, altoV);
        if (!lejana) {
          b.strokeStyle = "rgba(190,196,206,0.22)";
          b.lineWidth = Math.max(1, 0.07 * px);
          b.strokeRect(vx, vy, anchoV, altoV);
          b.fillStyle = "rgba(210,210,210,0.12)";
          b.fillRect(vx - 0.08 * px, vy + altoV, anchoV + 0.16 * px, Math.max(1, 0.08 * px));
        }

        const r = azar();
        let grupo: Grupo = lejana
          ? r < 0.13
            ? "A"
            : r < 0.22
              ? "B"
              : r < 0.3
                ? "C1"
                : r < 0.38
                  ? "C2"
                  : "apagada"
          : r < 0.09
            ? "A"
            : r < 0.15
              ? "B"
              : r < 0.24
                ? "C1"
                : r < 0.32
                  ? "C2"
                  : "apagada";
        if (!teleAsignada && f.tipo === "bloque" && p === 2 && c === 3) {
          grupo = "TV";
          teleAsignada = true;
        }
        if (grupo === "apagada") {
          if (!lejana && azar() > 0.55) {
            b.fillStyle = "rgba(46,50,58,0.6)";
            for (let y = vy + 2; y < vy + altoV; y += 3) b.fillRect(vx + 1, y, anchoV - 2, 1);
          }
          continue;
        }

        const [textura, canal] = CANAL[grupo];
        const ctx = textura === 0 ? l.luces : l.mascaras;
        const interior = ctx.createLinearGradient(0, vy, 0, vy + altoV);
        interior.addColorStop(0, tono(canal, 255));
        interior.addColorStop(1, tono(canal, 165));
        ctx.fillStyle = interior;
        const cortina = !lejana && azar() > 0.5 ? anchoV * (0.25 + azar() * 0.2) : 0;
        ctx.fillRect(vx + cortina, vy + 1, anchoV - cortina, altoV - 2);
        if (cortina > 0) {
          ctx.fillStyle = tono(canal, 90);
          ctx.fillRect(vx, vy + 1, cortina, altoV - 2);
        }
        if (!lejana) {
          const halo = ctx.createRadialGradient(cxv, centroY, 1, cxv, centroY, anchoV * 1.4);
          halo.addColorStop(0, tono(canal, 36));
          halo.addColorStop(1, tono(canal, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(cxv, centroY, anchoV * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });

  // Muro lateral: medianera con un par de ventanas pequeñas.
  const { x: lx, y: ly, w: lw, h: lh } = REGION_LATERAL;
  l.base.fillStyle = "#15171c";
  l.base.fillRect(lx, ly, lw, lh);
  [0.3, 0.7].forEach((fy) => {
    l.base.fillStyle = "#0b0d12";
    l.base.fillRect(lx + lw * 0.4, ly + lh * fy, lw * 0.2, lh * 0.08);
  });
  l.base.fillStyle = "#0b0c10";
  l.base.fillRect(REGION_OSCURA.x, REGION_OSCURA.y, REGION_OSCURA.w, REGION_OSCURA.h);

  l.luces.globalCompositeOperation = "source-over";
  l.mascaras.globalCompositeOperation = "source-over";
}

function uvDe(r: { x: number; y: number; w: number; h: number }): Vector4 {
  // Medio texel hacia dentro, para que el filtrado no traiga el vecino.
  return new Vector4(
    (r.x + 1) / ATLAS,
    1 - (r.y + r.h - 1) / ATLAS,
    (r.x + r.w - 1) / ATLAS,
    1 - (r.y + 1) / ATLAS
  );
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

export interface OpcionesCalle {
  farola: SpotLight;
  bulboFarola: PBRMaterial;
  posicionBulbo: Vector3;
}

export interface CalleExterior {
  /** Todo lo que está fuera. Las luces de la sala no deben tocarlo. */
  mallas: AbstractMesh[];
  /**
   * Pone la calle a una hora.
   * @param farola  Nivel de las luminarias públicas, con el parpadeo ya aplicado.
   */
  aplicar(e: EstadoAtmosfera, farola: number, tiempo: number): void;
}

export function construirCalleExterior(scene: Scene, o: OpcionesCalle): CalleExterior {
  const mallas: AbstractMesh[] = [];
  const pbr: AbstractMesh[] = [];
  const agregar = <T extends AbstractMesh>(m: T, esPbr = true): T => {
    m.isPickable = false;
    mallas.push(m);
    if (esPbr) pbr.push(m);
    return m;
  };

  // --- Atlas de fachadas ---------------------------------------------------------
  const fachadas = crearFachadas();
  const lienzo = (nombre: string, escala: number): { tex: DynamicTexture; ctx: CanvasRenderingContext2D } => {
    const tex = new DynamicTexture(nombre, { width: ATLAS * escala, height: ATLAS * escala }, scene, true);
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 16;
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.save();
    ctx.scale(escala, escala);
    return { tex, ctx };
  };
  const base = lienzo("texCalleAtlasBase", 1);
  const luces = lienzo("texCalleAtlasLuces", 0.5);
  const mascaras = lienzo("texCalleAtlasMascaras", 0.5);
  pintarAtlas({ base: base.ctx, luces: luces.ctx, mascaras: mascaras.ctx }, fachadas);
  [base, luces, mascaras].forEach(({ tex, ctx }) => {
    ctx.restore();
    tex.update();
  });

  const matFachada = new ShaderMaterial(
    "matCalleFachada",
    scene,
    { vertex: "calleMundo", fragment: "calleFachada" },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "world",
        "viewProjection",
        "camara",
        "ambiente",
        "horizonte",
        "cenit",
        "resplandor",
        "fuerzaResplandor",
        "nivelA",
        "nivelB",
        "nivelC1",
        "nivelC2",
        "nivelTV",
        "nivelCalle",
        "tiempo",
      ],
      samplers: ["baseSampler", "lucesSampler", "mascarasSampler"],
    }
  );
  matFachada.setTexture("baseSampler", base.tex);
  matFachada.setTexture("lucesSampler", luces.tex);
  matFachada.setTexture("mascarasSampler", mascaras.tex);

  const zinc = new PBRMaterial("matCalleZinc", scene);
  zinc.albedoColor = new Color3(0.07, 0.075, 0.08);
  zinc.metallic = 0.6;
  zinc.roughness = 0.42;
  zinc.environmentIntensity = 0.1;

  const oscura = uvDe(REGION_OSCURA);
  const lateral = uvDe(REGION_LATERAL);
  fachadas.forEach((f) => {
    // Orden de caras de Babylon: 0 +Z, 1 −Z (la que mira al ventanal), 2 +X,
    // 3 −X, 4 arriba, 5 abajo. Comprobado sobre la malla, no supuesto.
    const caja = agregar(
      MeshBuilder.CreateBox(
        `calleExterior_${f.nombre}`,
        {
          width: f.ancho,
          height: f.alto,
          depth: f.fondo,
          faceUV: [oscura, uvDe(f.region), lateral, lateral, oscura, oscura],
        },
        scene
      ),
      false
    );
    caja.position.set(f.x, f.alto / 2, f.z + f.fondo / 2);
    caja.material = matFachada;

    if (f.dosAguas) {
      const altoTecho = 1.4 + (f.ancho % 1) * 0.8;
      const techo = agregar(
        prismaDePerfil(
          scene,
          `calleExterior_${f.nombre}_techo`,
          [
            [-(f.fondo + 0.6) / 2, 0],
            [(f.fondo + 0.6) / 2, 0],
            [0, altoTecho],
          ],
          f.ancho + 0.5
        )
      );
      techo.rotation.y = Math.PI / 2;
      techo.position.set(f.x, f.alto, f.z + f.fondo / 2);
      techo.material = zinc;
    }
  });

  // --- Cerros ----------------------------------------------------------------------
  const cerros = [
    { z: 520, alto: 150, semilla: 3.1, perfil: 0.28 },
    { z: 820, alto: 260, semilla: 8.7, perfil: 0.3 },
  ].map((c, k) => {
    const mat = new ShaderMaterial(
      `matCalleCerros_${k}`,
      scene,
      { vertex: "calleMundo", fragment: "calleCerros" },
      {
        attributes: ["position", "uv"],
        uniforms: ["world", "viewProjection", "camara", "ambiente", "horizonte", "cenit", "resplandor", "fuerzaResplandor", "semilla", "perfil"],
        needAlphaTesting: true,
      }
    );
    mat.setFloat("semilla", c.semilla);
    mat.setFloat("perfil", c.perfil);
    const plano = agregar(
      MeshBuilder.CreatePlane(`calleExterior_cerros_${k}`, { width: 2400, height: c.alto }, scene),
      false
    );
    plano.position.set(100, c.alto / 2 - 20, c.z);
    plano.material = mat;
    return mat;
  });

  // --- Cielo -------------------------------------------------------------------------
  const cielo = agregar(
    MeshBuilder.CreateSphere("calleExteriorCielo", { diameter: 3000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene),
    false
  );
  cielo.infiniteDistance = true;
  const matCielo = new ShaderMaterial(
    "matCalleCielo",
    scene,
    { vertex: "calleMundo", fragment: "calleCielo" },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "world",
        "viewProjection",
        "camara",
        "cenit",
        "horizonte",
        "resplandor",
        "colorNubes",
        "direccionResplandor",
        "fuerzaResplandor",
        "tiempo",
      ],
    }
  );
  matCielo.setVector3("direccionResplandor", new Vector3(0.35, 0, 1).normalize());
  cielo.material = matCielo;

  // --- Suelos ---------------------------------------------------------------------------
  const mapas = generarAsfaltoMojado(512, 77);
  const asfalto = (nombre: string, repeticionU: number, repeticionV: number): PBRMaterial => {
    const mat = new PBRMaterial(nombre, scene);
    const tex = [
      subirMapa(scene, `${nombre}_color`, mapas.albedo, true, Texture.WRAP_ADDRESSMODE),
      subirMapa(scene, `${nombre}_normal`, mapas.normal, false, Texture.WRAP_ADDRESSMODE),
      subirMapa(scene, `${nombre}_orm`, mapas.orm, false, Texture.WRAP_ADDRESSMODE),
    ];
    tex.forEach((t) => {
      t.uScale = repeticionU;
      t.vScale = repeticionV;
    });
    mat.albedoTexture = tex[0];
    mat.bumpTexture = tex[1];
    mat.metallicTexture = tex[2];
    mat.useAmbientOcclusionFromMetallicTextureRed = true;
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useMetallnessFromMetallicTextureBlue = true;
    mat.metallic = 1;
    mat.roughness = 1;
    mat.environmentIntensity = 0.12;
    return mat;
  };

  const calzada = agregar(MeshBuilder.CreateGround("calleExteriorCalzada", { width: 160, height: Z_VEREDA_ENFRENTE - Z_BORDILLO }, scene));
  calzada.position.set(0, Y_CALZADA, (Z_BORDILLO + Z_VEREDA_ENFRENTE) / 2);
  calzada.material = asfalto("matCalleCalzada", 40, 2.25);

  const plaza = agregar(MeshBuilder.CreateGround("calleExteriorPlaza", { width: 160, height: Z_SETOS - Z_PLAZA }, scene));
  plaza.position.set(0, 0.005, (Z_PLAZA + Z_SETOS) / 2);
  plaza.material = asfalto("matCallePlaza", 40, 8);

  const hormigon = new PBRMaterial("matCalleHormigon", scene);
  hormigon.albedoColor = new Color3(0.1, 0.1, 0.105);
  hormigon.roughness = 0.5;
  hormigon.metallic = 0;
  hormigon.environmentIntensity = 0.1;

  const veredaEnfrente = agregar(MeshBuilder.CreateGround("calleExteriorVeredaEnfrente", { width: 160, height: Z_PLAZA - Z_VEREDA_ENFRENTE }, scene));
  veredaEnfrente.position.set(0, 0, (Z_VEREDA_ENFRENTE + Z_PLAZA) / 2);
  veredaEnfrente.material = hormigon;

  const veredaCasas = agregar(MeshBuilder.CreateGround("calleExteriorVeredaCasas", { width: 200, height: 40 }, scene));
  veredaCasas.position.set(0, -0.01, Z_SETOS + 20);
  veredaCasas.material = hormigon;

  // Bordillos: el escalón de catorce centímetros entre vereda y calzada. Es
  // una línea clara que corre hacia el fondo y marca la perspectiva.
  [Z_BORDILLO, Z_VEREDA_ENFRENTE].forEach((z, k) => {
    const bordillo = agregar(MeshBuilder.CreateBox(`calleExteriorBordillo_${k}`, { width: 160, height: 0.16, depth: 0.16 }, scene));
    bordillo.position.set(0, Y_CALZADA + 0.08, z + (k === 0 ? 0.08 : -0.08));
    const mat = new PBRMaterial(`matCalleBordillo_${k}`, scene);
    mat.albedoColor = new Color3(0.3, 0.3, 0.29);
    mat.roughness = 0.6;
    mat.environmentIntensity = 0.1;
    bordillo.material = mat;
  });

  // Líneas de estacionamiento, en dos filas de la plaza.
  const pintura = new PBRMaterial("matCallePintura", scene);
  pintura.albedoColor = new Color3(0.55, 0.55, 0.52);
  pintura.roughness = 0.55;
  pintura.environmentIntensity = 0.1;
  const lineas: Mesh[] = [];
  [24, 38].forEach((zFila) => {
    for (let lx = -40; lx <= 40; lx += 2.6) {
      const linea = MeshBuilder.CreateGround(`calleLinea_${zFila}_${lx}`, { width: 0.12, height: 5 }, scene);
      linea.position.set(lx, 0.012, zFila);
      lineas.push(linea);
    }
  });
  const lineasFusion = Mesh.MergeMeshes(lineas, true, true);
  if (lineasFusion) {
    lineasFusion.name = "calleExteriorLineas";
    lineasFusion.material = pintura;
    agregar(lineasFusion);
  }

  // Setos al fondo de la plaza.
  // Follaje con reflectancia de hoja de verdad, no negro: a 0,035 los árboles
  // eran manchas sin volumen incluso con la claridad del amanecer encima.
  const follaje = new PBRMaterial("matCalleFollaje", scene);
  follaje.albedoColor = new Color3(0.085, 0.13, 0.07);
  follaje.roughness = 0.8;
  follaje.environmentIntensity = 0.05;
  const corteza = new PBRMaterial("matCalleCorteza", scene);
  corteza.albedoColor = new Color3(0.09, 0.075, 0.06);
  corteza.roughness = 0.9;
  [-30, -8, 16, 38].forEach((sx, k) => {
    const seto = agregar(MeshBuilder.CreateBox(`calleExteriorSeto_${k}`, { width: 16, height: 1.1, depth: 1.1 }, scene));
    seto.position.set(sx, 0.55, Z_SETOS + 0.5);
    seto.material = follaje;
  });

  // --- Árboles, autos y faroles ---------------------------------------------------------
  // Fuera del eje del ventanal. Delante del hueco, a veinte metros, una copa
  // tapaba media calle: se ven de lado, donde hacen de primer plano sin
  // esconder lo que hay detrás.
  [
    [-9.5, 19.4, 5.8, 11],
    [-16, 33, 6.8, 23],
    [16.5, 30, 6.2, 37],
    [8.5, 47, 7.2, 41],
    [-26, 45, 6.6, 59],
  ].forEach(([ax, az, alto, semilla], k) => {
    crearArbol(scene, `calleExteriorArbol_${k}`, alto, semilla, follaje, corteza).forEach((m) => {
      m.position.x += ax;
      m.position.z += az;
      agregar(m);
    });
  });

  const patentes = ["HZTR-19", "FCWD-73", "JPLX-50", "GGKS-28"];
  [
    { x: 3.2, z: 16.5, giro: 0, color: new Color3(0.12, 0.02, 0.025) },
    { x: -6.5, z: 24, giro: Math.PI / 2, color: new Color3(0.45, 0.46, 0.48) },
    { x: 9.1, z: 24, giro: -Math.PI / 2, color: new Color3(0.02, 0.05, 0.12) },
    { x: -1.3, z: 38, giro: Math.PI / 2, color: new Color3(0.06, 0.06, 0.065) },
  ].forEach((a, k) => {
    const auto = crearVehiculo(scene, `calleExteriorAuto_${k}`, { color: a.color, patente: patentes[k], entorno: 0.12 });
    auto.raiz.position.set(a.x, k === 0 ? Y_CALZADA : 0, a.z);
    auto.raiz.rotation.y = a.giro;
    auto.mallas.forEach((m) => agregar(m));
  });

  const poste = new PBRMaterial("matCallePoste", scene);
  poste.albedoColor = new Color3(0.06, 0.065, 0.07);
  poste.metallic = 0.6;
  poste.roughness = 0.5;
  poste.environmentIntensity = 0.1;
  const luminaria = new PBRMaterial("matCalleLuminaria", scene);
  luminaria.albedoColor = new Color3(0, 0, 0);
  luminaria.emissiveColor = new Color3(1, 0.8, 0.5);
  luminaria.roughness = 1;

  const matHalo = (nombre: string): ShaderMaterial => {
    const m = new ShaderMaterial(
      nombre,
      scene,
      { vertex: "calleHalo", fragment: "calleHalo" },
      { attributes: ["position", "uv"], uniforms: ["worldViewProjection", "color", "nivel"], needAlphaBlending: true }
    );
    m.alphaMode = Constants.ALPHA_ADD;
    m.disableDepthWrite = true;
    m.backFaceCulling = false;
    m.setColor3("color", new Color3(1, 0.72, 0.4));
    return m;
  };
  const halos: ShaderMaterial[] = [];
  const halo = (nombre: string, donde: Vector3, tamano: number): void => {
    const plano = agregar(MeshBuilder.CreatePlane(nombre, { size: tamano }, scene), false);
    plano.position.copyFrom(donde);
    plano.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const mat = matHalo(`mat_${nombre}`);
    plano.material = mat;
    halos.push(mat);
  };

  const focosPlaza: SpotLight[] = [];
  [
    { x: -7, z: 19.3, giro: -Math.PI / 2 },
    { x: 11, z: 36, giro: Math.PI / 2 },
  ].forEach((p, k) => {
    const farol = crearFarol(scene, `calleExteriorFarol_${k}`, 6.5, poste, luminaria);
    farol.raiz.position.set(p.x, 0, p.z);
    farol.raiz.rotation.y = p.giro;
    farol.mallas.forEach((m) => agregar(m));
    const bulbo = farol.bulbo();
    halo(`calleExteriorHalo_${k}`, bulbo, 2.4);

    const foco = new SpotLight(`luzCalleFarol_${k}`, bulbo, new Vector3(0, -1, 0), 1.9, 1.4, scene);
    foco.diffuse = new Color3(1, 0.72, 0.42);
    foco.specular = new Color3(1, 0.78, 0.5);
    foco.range = 30;
    focosPlaza.push(foco);
  });
  // El halo del farol de este lado, el que está junto al ventanal.
  halo("calleExteriorHaloFarola", o.posicionBulbo.add(new Vector3(0, -0.05, 0)), 1.1);

  // --- Lluvia ----------------------------------------------------------------------------
  //
  // Una llovizna tenue en toda la calle y más densa bajo cada luminaria, que es
  // donde se ve la lluvia de noche. Las gotas cercanas, bajo el farol de este
  // lado, cruzan por delante del ventanal: son el plano más próximo de todos.
  const gota = new DynamicTexture("texCalleGota", { width: 8, height: 64 }, scene, false);
  {
    const ctx = gota.getContext() as unknown as CanvasRenderingContext2D;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(2, 0, 4, 64);
    gota.hasAlpha = true;
    gota.update();
  }
  const lluvias: ParticleSystem[] = [];
  const lluvia = (nombre: string, min: Vector3, max: Vector3, capacidad: number, alfa: number): void => {
    const ps = new ParticleSystem(nombre, capacidad, scene);
    ps.particleTexture = gota;
    ps.emitter = min.add(max).scale(0.5);
    ps.minEmitBox = min.subtract(max).scale(0.5);
    ps.maxEmitBox = max.subtract(min).scale(0.5);
    ps.direction1 = new Vector3(-0.8, -11, 0.2);
    ps.direction2 = new Vector3(-0.4, -13, 0.5);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1;
    const vida = (max.y - min.y) / 12;
    ps.minLifeTime = vida * 0.8;
    ps.maxLifeTime = vida * 1.1;
    ps.minSize = 0.014;
    ps.maxSize = 0.022;
    ps.minScaleY = 14;
    ps.maxScaleY = 20;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.color1 = new Color4(0.75, 0.8, 0.9, alfa);
    ps.color2 = new Color4(0.85, 0.85, 0.9, alfa * 0.7);
    ps.colorDead = new Color4(0.8, 0.8, 0.9, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.emitRate = capacidad / vida;
    ps.preWarmCycles = 80;
    ps.preWarmStepOffset = 4;
    ps.start();
    lluvias.push(ps);
  };
  lluvia("calleExteriorLluviaGeneral", new Vector3(-30, 0, 9), new Vector3(30, 16, 60), 1800, 0.03);
  lluvia("calleExteriorLluviaFarola", new Vector3(-0.2, 0, 5), new Vector3(2.6, 3.6, 7.8), 380, 0.2);
  focosPlaza.forEach((f, k) =>
    lluvia(`calleExteriorLluviaFarol_${k}`, f.position.add(new Vector3(-2.2, -6.5, -2.2)), f.position.add(new Vector3(2.2, 0, 2.2)), 500, 0.14)
  );

  // --- Luces de la calle ------------------------------------------------------------------
  //
  // El cielo como luz hemisférica: casi nada de noche, una claridad fría al
  // amanecer. Solo alcanza a la calle.
  const luzCielo = new HemisphericLight("luzCalleCielo", new Vector3(0, 1, 0), scene);
  luzCielo.specular = new Color3(0, 0, 0);
  luzCielo.includedOnlyMeshes = pbr.slice();
  focosPlaza.forEach((f) => (f.includedOnlyMeshes = pbr.slice()));
  // El farol de este lado alumbra también lo nuevo que tiene debajo.
  o.farola.includedOnlyMeshes.push(...pbr.filter((m) => m.name.startsWith("calleExteriorCalzada") || m.name.startsWith("calleExteriorAuto_0") || m.name.startsWith("calleExteriorBordillo")));

  // Y ninguna luz de la sala toca la calle: a cincuenta metros no aporta nada
  // y sí gasta un hueco del tope de luces de cada material.
  const propias = new Set<string>(["luzCalleCielo", "luzFarola", ...focosPlaza.map((f) => f.name)]);
  scene.lights.forEach((luz) => {
    if (propias.has(luz.name)) return;
    luz.excludedMeshes.push(...mallas);
  });

  // --- Cada cuadro ---------------------------------------------------------------------------
  const c = {
    camara: new Vector3(),
    cenit: new Color3(),
    horizonte: new Color3(),
    resplandor: new Color3(),
    nubes: new Color3(),
    ambiente: new Color3(),
  };
  const aColor = (d: Color3, v: [number, number, number]): Color3 => d.set(v[0], v[1], v[2]);

  return {
    mallas,
    aplicar(e, farola, tiempo) {
      const cam = scene.activeCamera;
      if (cam) c.camara.copyFrom(cam.globalPosition);
      aColor(c.cenit, e.cenit);
      aColor(c.horizonte, e.horizonte);
      aColor(c.resplandor, e.resplandor);
      aColor(c.nubes, e.nubes);
      aColor(c.ambiente, e.fachada);

      matCielo.setVector3("camara", c.camara);
      matCielo.setColor3("cenit", c.cenit);
      matCielo.setColor3("horizonte", c.horizonte);
      matCielo.setColor3("resplandor", c.resplandor);
      matCielo.setColor3("colorNubes", c.nubes);
      matCielo.setFloat("fuerzaResplandor", e.fuerzaResplandor);
      matCielo.setFloat("tiempo", tiempo);

      matFachada.setVector3("camara", c.camara);
      matFachada.setColor3("ambiente", c.ambiente);
      matFachada.setColor3("horizonte", c.horizonte);
      matFachada.setColor3("cenit", c.cenit);
      matFachada.setColor3("resplandor", c.resplandor);
      matFachada.setFloat("fuerzaResplandor", e.fuerzaResplandor);
      matFachada.setFloat("nivelA", e.ventanasA);
      matFachada.setFloat("nivelB", e.ventanasB);
      matFachada.setFloat("nivelC1", e.cocinasTempranas);
      matFachada.setFloat("nivelC2", e.cocinasTardias);
      matFachada.setFloat("nivelTV", e.tele);
      matFachada.setFloat("nivelCalle", farola);
      matFachada.setFloat("tiempo", tiempo);

      cerros.forEach((m) => {
        m.setVector3("camara", c.camara);
        m.setColor3("ambiente", c.ambiente);
        m.setColor3("horizonte", c.horizonte);
        m.setColor3("cenit", c.cenit);
        m.setColor3("resplandor", c.resplandor);
        m.setFloat("fuerzaResplandor", e.fuerzaResplandor);
      });

      halos.forEach((m) => m.setFloat("nivel", farola));
      luminaria.emissiveColor.set(farola, 0.8 * farola, 0.5 * farola);
      focosPlaza.forEach((f) => (f.intensity = 95 * farola));

      // De noche, el poco cielo que hay es el resplandor sodio de la ciudad.
      const k = e.claridad;
      luzCielo.intensity = 0.05 + 0.9 * k;
      luzCielo.diffuse.set(0.9 - 0.3 * k, 0.7, 0.5 + 0.45 * k);
      luzCielo.groundColor.set(0.02, 0.02, 0.025);
    },
  };
}
