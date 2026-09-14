import {
  Scene,
  ShaderMaterial,
  Effect,
  RenderTargetTexture,
  DynamicTexture,
  Texture,
  Constants,
  Color4,
  Matrix,
  Vector2,
  Vector4,
  type AbstractMesh,
  type Light,
} from "@babylonjs/core";
import type { EscenaCamara } from "./SucesosCondominio";
import { construirSetsCircuito, CAPA_CCTV, ANCHO_CUADRO, ALTO_CUADRO, type Rectangulo } from "./CircuitoCerrado";

// ===========================================================================
// Monitor de cámaras — las cuatro grabaciones del puesto
// ===========================================================================
//
// Cada cuadrante muestra SU sitio del condominio —la reja, el
// estacionamiento, el pasillo, la bodega— y cuando ocurre un suceso, ese
// sitio es donde se ve ocurrir.
//
// ─── DE DIBUJO A GRABACIÓN ────────────────────────────────────────────────
//
// Antes los sitios se pintaban en un lienzo 2D. Ahora son escenas 3D (ver
// CircuitoCerrado) filmadas por cámaras virtuales, y lo que llega a la
// pantalla pasa por lo mismo que pasa una imagen de CCTV de verdad:
//
//   ÓPTICA      gran angular con distorsión de barril y aberración cromática
//               en los bordes; los faros encandilan y se abren en halo.
//   SENSOR      infrarrojo en la cámara del acceso (monocromo verdoso), color
//               lavado en las demás, grano que sube en las sombras.
//   SEÑAL       realce de bordes del procesado analógico, negro levantado,
//               líneas de barrido, la barra de zumbido que sube despacio y,
//               de vez en cuando, una franja que pierde la sincronía.
//   GRABADOR    cinco imágenes por segundo por canal, repartidas en turno
//               entre las cuatro cámaras, y los rótulos estampados encima.
//
// Ese último punto es costo y aspecto a la vez. Filmar las cuatro cámaras en
// cada fotograma sería pagar cuatro escenas extra sesenta veces por segundo;
// filmando UNA cada cincuenta milisegundos, cada canal entrega sus cinco
// cuadros y el tirón resultante es exactamente la firma de un multiplexor.
//
// ─── EL MONITOR NO RECIBE LUZ ─────────────────────────────────────────────
//
// La pantalla tiene una luz azul propia a catorce centímetros por delante,
// que tiñe el mesón. Con un material iluminado se reflejaba en su propio
// cristal y tapaba la imagen con una mancha blanca. Este material no mira
// ninguna luz: emite lo que filma, como un monitor de verdad.
//
// ─── EL MONITOR COMPLEMENTA, NO REEMPLAZA ─────────────────────────────────
//
// Todo lo que se ve acá está también escrito en el `aviso` del suceso. Si
// mirar el monitor fuera obligatorio, perderse una camioneta por estar
// escribiendo sería una falta que el jugador no tuvo cómo evitar, y el libro
// dejaría de bastarse solo — que es justamente lo que el manual pide que sepa
// hacer un guardia.
//
// ─── CUÁNDO SE ENCIENDE Y CUÁNDO SE APAGA ─────────────────────────────────
//
// No hay temporizador. La toma se enciende cuando el suceso ocurre y se apaga
// cuando la novedad queda escrita en el libro. El monitor muestra lo que está
// PENDIENTE: la pantalla es un recordatorio de lo que falta anotar.

/** Rótulo de cada cuadrante, en el orden en que se dibujan. */
const ROTULOS = ["CAM 01  ACCESO", "CAM 02  ESTACIONAMIENTO", "CAM 03  PASILLO", "CAM 04  BODEGA"];

/**
 * Qué cámaras están en infrarrojo.
 *
 * Una cámara exterior de noche conmuta a infrarrojo: imagen monocroma, zona
 * clara donde alcanzan sus emisores y caída rápida a negro. Solo la del
 * acceso: las otras tres dan a sitios con luz propia y siguen en color, que
 * es lo normal en una instalación real y deja la CAM 02 en color, donde las
 * intermitentes ámbar hacen de aviso.
 */
const EN_INFRARROJO = [1, 0, 0, 0];

/**
 * Exposición de cada canal, lo que en la cámara hace el control automático
 * de ganancia. Cada sitio tiene su luz, y sin esto el pasillo apagado sería
 * negro y el iluminador del acceso quemaría la reja.
 */
const EXPOSICION = [1.4, 1.2, 1.2, 1.35];

/** La fecha que estampa el grabador. La misma que la apertura del libro. */
const FECHA_TURNO = "14-09-2026";

/** Milisegundos entre dos cuadros del mismo canal: cinco por segundo. */
const MS_POR_CUADRO = 200;

/** Cada cuántos segundos rota el cuadrante que tiene más de una toma. */
const CICLO_MULTIPLEXOR = 4.5;

/** Cuánto tarda cada escena en llegar a su pose final, en segundos reales. */
const DURACION: Record<EscenaCamara, number> = {
  "vehiculo-en-reja": 7,
  "vehiculo-saliendo": 8.5,
  "vehiculo-detenido": 1,
  "pasillo-abierto": 2.6,
  "bodega-abierta": 3.2,
};

/** Distorsión de barril de la óptica. La misma cifra en el sombreador y en los recuadros. */
const DISTORSION = 0.12;

// Los rótulos se dibujan en un lienzo con la proporción de la pantalla.
const ANCHO_BASE = 640;
const ALTO_BASE = 375;
/**
 * Densidad del lienzo de rótulos. El monitor es el único sitio donde el
 * jugador se ACERCA a mirar —la rueda baja el campo de visión hasta un
 * tercio— y a doble densidad, con ese acercamiento, se veían los píxeles.
 */
const FACTOR = 3;
const CW = ANCHO_BASE / 2;
const CH = ALTO_BASE / 2;
/** Bisel entre cuadrantes, en coordenadas de dibujo. El sombreador usa el mismo. */
const MARGEN = 2;
const QW = CW - 2 * MARGEN;
const QH = CH - 2 * MARGEN;

interface TomaActiva {
  indice: number;
  escena: EscenaCamara;
  /** Segundo real en que se encendió. Manda la animación de entrada. */
  desde: number;
  /** Minuto del turno en que ocurrió. Rotula la toma cuando hay más de una. */
  minuto: number;
  /** Marca propia de la toma, como la del detector de movimiento. */
  rotulo?: string;
}

function horaDeMinuto(minuto: number): string {
  const h = Math.floor(minuto / 60) % 24;
  const m = Math.floor(minuto) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// El sombreador de la pantalla
// ---------------------------------------------------------------------------

const VERTICE = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  gl_Position = viewProjection * world * vec4(position, 1.0);
}
`;

// La tubería de la sala aplica el mapeo de tonos DESPUÉS, así que la salida
// va en lineal: la curva de la cámara se hace acá, se lleva a pantalla y se
// devuelve a lineal para que el post-proceso la trate como cualquier emisor.
const FRAGMENTO = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec2 vUV;

uniform sampler2D cam0;
uniform sampler2D cam1;
uniform sampler2D cam2;
uniform sampler2D cam3;
uniform sampler2D superposicion;

uniform float tiempo;
uniform vec4 exposicion;
uniform vec4 infrarrojo;
uniform vec4 cuadros;
uniform vec2 margen;
uniform float distorsion;
uniform float brillo;

vec4 pesos;

float azar(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Las cuatro cámaras se leen siempre y se elige con pesos: leer dentro de un
// if rompería las derivadas con que la tarjeta elige el nivel de detalle.
vec3 leer(vec2 st, float sesgo) {
  st = clamp(st, vec2(0.001), vec2(0.999));
  vec3 c = texture2D(cam0, st, sesgo).rgb * pesos.x
    + texture2D(cam1, st, sesgo).rgb * pesos.y
    + texture2D(cam2, st, sesgo).rgb * pesos.z
    + texture2D(cam3, st, sesgo).rgb * pesos.w;
  // Un NaN o un infinito de la escena filmada no puede llegar a la sala: el
  // bloom de la tubería lo esparciría por toda la imagen. Las comparaciones
  // con NaN dan falso, así que esto lo deja en cero.
  return vec3(c.r >= 0.0 ? min(c.r, 64.0) : 0.0, c.g >= 0.0 ? min(c.g, 64.0) : 0.0, c.b >= 0.0 ? min(c.b, 64.0) : 0.0);
}

// Barril: el centro se amplía y los bordes se comprimen. Las esquinas quedan
// donde estaban, así no aparece negro en el cuadro.
vec2 lente(vec2 c, float k) {
  vec2 d = c * (1.0 + k * dot(c, c)) / (1.0 + 2.0 * k);
  return vec2(d.x * 0.5 + 0.5, 0.5 - d.y * 0.5);
}

vec3 aLineal(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(2.2)) * brillo;
}

void main(void) {
  vec2 p = vec2(vUV.x, 1.0 - vUV.y);
  vec2 celda = floor(clamp(p, 0.0, 0.9999) * 2.0);
  float indice = celda.x + celda.y * 2.0;
  pesos = vec4(equal(vec4(indice), vec4(0.0, 1.0, 2.0, 3.0)));
  vec4 sup = texture2D(superposicion, vUV);

  vec2 local = (p - celda * 0.5 - margen) / (0.5 - 2.0 * margen);
  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) {
    gl_FragColor = vec4(aLineal(mix(vec3(0.008, 0.01, 0.013), sup.rgb, sup.a)), 1.0);
    return;
  }

  float cuadro = dot(cuadros, pesos);
  float esIR = dot(infrarrojo, pesos);

  // Pérdida de sincronía: de vez en cuando, una franja corrida un instante.
  float reloj = tiempo * 0.9 + indice * 3.7;
  float tramo = floor(reloj);
  float golpe = step(0.88, azar(vec2(tramo, indice + 11.0))) * step(fract(reloj), 0.16);
  float centro = azar(vec2(tramo, indice + 23.0));
  float franja = golpe * (1.0 - smoothstep(0.0, 0.03, abs(local.y - centro)));
  local.x += franja * (azar(vec2(floor(local.y * 140.0), tramo)) - 0.5) * 0.025;

  vec2 c = local * 2.0 - 1.0;
  vec2 stG = lente(c, distorsion);
  vec2 stR = lente(c, distorsion + 0.006);
  vec2 stB = lente(c, distorsion - 0.006);

  vec3 base = vec3(leer(stR, 0.0).r, leer(stG, 0.0).g, leer(stB, 0.0).b);
  // Realce de bordes del procesado analógico: el halo claro junto a lo oscuro.
  vec3 blando = leer(stG, 1.5);
  vec3 col = max(base + (base - blando) * 0.5, 0.0);

  // Destello del lente: lo que pasa de cierto brillo se abre en halo.
  vec3 halo = leer(stG, 3.0) * 0.6 + leer(stG, 5.0) * 0.4;
  col += max(halo - 0.45, 0.0) * 1.1;

  // Curva del sensor: ganancia del canal y hombro suave, sin corte duro.
  col *= dot(exposicion, pesos);
  col = 1.0 - exp(-col * 1.35);
  col = pow(col, vec3(1.0 / 2.2));
  // Curva en S del procesado: la gamma sola levanta tanto las sombras que la
  // noche se lee como un día nublado. Esto las devuelve a su sitio.
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.45);

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 ir = vec3(dot(col, vec3(0.36, 0.5, 0.14))) * vec3(0.92, 1.0, 0.95);
  vec3 color = mix(vec3(luma), col, 0.82) * vec3(0.98, 1.0, 1.03);
  col = mix(color, ir, esIR);
  // Negro levantado: una señal de vídeo nunca llega a negro puro.
  col = col * 0.92 + 0.028;

  // Cuántas líneas de vídeo caen en un píxel de la pantalla del juego.
  float lineas = local.y * 225.0;
  float paso = fwidth(lineas);

  // Grano del sensor, congelado con el cuadro: es parte de lo grabado. Desde
  // la silla caen varios granos por píxel y, sin atenuarlo, el promedio
  // hierve en puntos blancos sueltos; de cerca vuelve entero.
  vec2 grano = floor(local * vec2(384.0, 225.0));
  float n1 = azar(grano + vec2(cuadro * 1.37, cuadro * 0.71)) - 0.5;
  float n2 = azar(floor(grano * 0.25) + vec2(cuadro * 2.13, 7.0)) - 0.5;
  float cercania = mix(1.0, 0.3, smoothstep(0.45, 1.8, paso));
  col += vec3(n1 * 0.055 + n2 * 0.025) * (1.25 - luma) * cercania;

  // Líneas de barrido. Se apagan solas cuando la pantalla se ve tan pequeña
  // que caerían varias en un píxel: ahí solo harían muaré.
  col *= 1.0 - 0.09 * (1.0 - smoothstep(0.3, 0.65, paso)) * (0.5 + 0.5 * cos(lineas * 6.28318));
  // Barra de zumbido, subiendo despacio.
  col *= 1.0 + 0.03 * sin((local.y + tiempo * 0.11 + indice * 0.25) * 6.28318);

  // Viñeta de la óptica.
  float r2 = dot(c, c) * 0.5;
  col *= 1.0 - 0.42 * r2 * r2;

  col = mix(col, sup.rgb, sup.a);
  gl_FragColor = vec4(aLineal(col), 1.0);
}
`;

/**
 * Dónde queda, tras la óptica, un punto del cuadro filmado.
 *
 * El sombreador lleva cada píxel de la pantalla al punto filmado; los
 * recuadros de detección necesitan lo contrario, así que se invierte por
 * iteración. Converge en pocas vueltas porque la distorsión es suave.
 */
function trasLaOptica(x: number, y: number): [number, number] {
  const sx = x * 2 - 1;
  const sy = y * 2 - 1;
  let cx = sx;
  let cy = sy;
  for (let n = 0; n < 8; n++) {
    const f = (1 + DISTORSION * (cx * cx + cy * cy)) / (1 + 2 * DISTORSION);
    cx = sx / f;
    cy = sy / f;
  }
  return [(cx + 1) / 2, (cy + 1) / 2];
}

// ---------------------------------------------------------------------------
// El monitor
// ---------------------------------------------------------------------------

export interface MonitorCamaras {
  material: ShaderMaterial;
  /**
   * La malla donde se muestra. Mientras la cámara del puesto no la tenga a la
   * vista, las cámaras del circuito no filman: no hay nadie mirando.
   */
  vincularPantalla(pantalla: AbstractMesh): void;
  /**
   * Enciende la toma de un suceso. Se queda en pantalla hasta `apagar`.
   *
   * Se identifica por el id del suceso y no por el cuadrante porque el ingreso
   * y la salida comparten la CAM 01: si la salida llegara con el ingreso aún
   * sin anotar, apagar "la cámara 1" apagaría la toma equivocada.
   */
  encender(id: string, indice: number, escena: EscenaCamara, minuto: number, rotulo?: string): void;
  /** Apaga la toma de ese suceso. Se llama cuando la novedad queda escrita. */
  apagar(id: string): void;
  /**
   * Pone las cámaras en hora con el turno. Un CCTV tiene un solo reloj, y
   * estando en el puesto con el libro cerrado esa marca es el único sitio
   * donde el jugador puede ver qué hora es.
   */
  ajustarHora(minuto: number): void;
}

export function crearMonitorCamaras(scene: Scene): MonitorCamaras {
  const activas = new Map<string, TomaActiva>();
  /** Segundos reales desde que arrancó. Manda parpadeos, ruido y entradas. */
  let segundos = 0;
  /** Hora del turno que marcan las cámaras, en minutos. */
  let minutoBase = 0;
  let pantalla: AbstractMesh | null = null;

  const sets = construirSetsCircuito(scene);
  sets.forEach((s) => s.poner(null, 0, 0));

  // Las luces de la sala no alcanzan a los sitios del circuito, ni las que ya
  // existen ni las que se monten después. Sin esto cada malla de allá gastaría
  // sus huecos de luz en luminarias que están a dos kilómetros.
  const aislar = (luz: Light): void => {
    if (!luz.name.startsWith("cctv")) luz.excludeWithLayerMask |= CAPA_CCTV;
  };
  scene.lights.forEach(aislar);
  const observadorLuces = scene.onNewLightAddedObservable.add(aislar);

  const motor = scene.getEngine();
  const caps = motor.getCaps();
  // En coma flotante los faros y las luminarias pasan de 1 y el halo del
  // lente sale de ahí. Sin soporte se filma en 8 bits y el halo es más tímido.
  const flotante = caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering;
  const muestras = Math.max(1, Math.min(4, caps.maxMSAASamples || 1));

  const filmaciones = sets.map((set) => {
    const rtt = new RenderTargetTexture(`cctvCuadro_${set.indice}`, { width: ANCHO_CUADRO, height: ALTO_CUADRO }, scene, {
      generateMipMaps: true,
      type: flotante ? Constants.TEXTURETYPE_HALF_FLOAT : Constants.TEXTURETYPE_UNSIGNED_BYTE,
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
      samples: muestras,
    });
    rtt.activeCamera = set.camara;
    rtt.renderList = set.mallas;
    // FUERA DEL PREPASS. La oclusión ambiental de la sala activa el prepass de
    // la escena, y por omisión toda textura de render se suma a él: las cuatro
    // filmaciones escribían en los búferes de profundidad y normales que usa
    // la oclusión, y la sala entera salía negra. Estas imágenes no llevan
    // oclusión ni la necesitan.
    rtt.noPrePassRenderer = true;
    rtt.clearColor = new Color4(0, 0, 0, 1);
    rtt.wrapU = Texture.CLAMP_ADDRESSMODE;
    rtt.wrapV = Texture.CLAMP_ADDRESSMODE;
    // Se filma a pedido (ver `filmar`), nunca por su cuenta.
    rtt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    // La proyección con la proporción del cuadro, no la del lienzo del juego:
    // la cámara la calcularía con la ventana del navegador y la imagen
    // llegaría estirada al cuadrante.
    const proyeccion = Matrix.PerspectiveFovLH(
      set.camara.fov,
      ANCHO_CUADRO / ALTO_CUADRO,
      set.camara.minZ,
      set.camara.maxZ,
      motor.isNDCHalfZRange
    );
    rtt.onBeforeRenderObservable.add(() => scene.setTransformMatrix(set.camara.getViewMatrix(), proyeccion));
    scene.customRenderTargets.push(rtt);
    return rtt;
  });

  const superposicion = new DynamicTexture(
    "tex_rotulosCCTV",
    { width: ANCHO_BASE * FACTOR, height: ALTO_BASE * FACTOR },
    scene,
    true
  );
  superposicion.hasAlpha = true;
  superposicion.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  superposicion.anisotropicFilteringLevel = 16;
  superposicion.wrapU = Texture.CLAMP_ADDRESSMODE;
  superposicion.wrapV = Texture.CLAMP_ADDRESSMODE;

  Effect.ShadersStore["pantallaCctvVertexShader"] = VERTICE;
  Effect.ShadersStore["pantallaCctvFragmentShader"] = FRAGMENTO;
  const material = new ShaderMaterial(
    "matPantallaCCTV",
    scene,
    { vertex: "pantallaCctv", fragment: "pantallaCctv" },
    {
      attributes: ["position", "uv"],
      uniforms: ["world", "viewProjection", "tiempo", "exposicion", "infrarrojo", "cuadros", "margen", "distorsion", "brillo"],
      samplers: ["cam0", "cam1", "cam2", "cam3", "superposicion"],
    }
  );
  filmaciones.forEach((rtt, i) => material.setTexture(`cam${i}`, rtt));
  material.setTexture("superposicion", superposicion);
  material.setVector4("exposicion", new Vector4(EXPOSICION[0], EXPOSICION[1], EXPOSICION[2], EXPOSICION[3]));
  /** Qué canales están ahora en infrarrojo. Cambia con la hora (ver aplicarHora). */
  const infrarrojo = new Vector4(EN_INFRARROJO[0], EN_INFRARROJO[1], EN_INFRARROJO[2], EN_INFRARROJO[3]);
  material.setVector4("infrarrojo", infrarrojo);
  material.setVector2("margen", new Vector2(MARGEN / ANCHO_BASE, MARGEN / ALTO_BASE));
  material.setFloat("distorsion", DISTORSION);
  material.setFloat("brillo", 1);
  material.setFloat("tiempo", 0);

  /** Recuadro de detección de cada canal, del último cuadro filmado. */
  const detecciones: (Rectangulo | null)[] = sets.map(() => null);
  const numeroCuadro = new Vector4(0, 0, 0, 0);
  material.setVector4("cuadros", numeroCuadro);

  /**
   * Qué toma muestra un cuadrante.
   *
   * DOS TOMAS EN LA MISMA CÁMARA SE TURNAN, no se pisan. El ingreso y la
   * salida ocurren los dos en la reja; si ganara la última, el ingreso
   * desaparecería de la pantalla aunque siguiera pendiente. El cuadrante las
   * rota, que es lo que hace un multiplexor cuando tiene más señales que
   * ventanas, ordenadas por hora para que el turno se vea como pasó.
   */
  function enCuadrante(i: number): { toma: TomaActiva | undefined; cual: number; cuantas: number } {
    const en = [...activas.values()].filter((t) => t.indice === i).sort((a, b) => a.minuto - b.minuto);
    const cual = en.length > 1 ? Math.floor(segundos / CICLO_MULTIPLEXOR) % en.length : 0;
    return { toma: en[cual], cual, cuantas: en.length };
  }

  /** Pone el sitio en su estado y pide un cuadro nuevo de esa cámara. */
  function filmar(i: number): void {
    const { toma } = enCuadrante(i);
    const escena = toma?.escena ?? null;
    const avance = toma ? Math.min(1, (segundos - toma.desde) / DURACION[toma.escena]) : 0;
    sets[i].poner(escena, avance, segundos);
    detecciones[i] = toma ? sets[i].deteccion(escena) : null;
    filmaciones[i].resetRefreshCounter();
    const n = (numeroCuadro.asArray()[i] + 1) % 997;
    if (i === 0) numeroCuadro.x = n;
    else if (i === 1) numeroCuadro.y = n;
    else if (i === 2) numeroCuadro.z = n;
    else numeroCuadro.w = n;
  }

  /** La marca de hora, como la escribe un grabador: hh:mm:ss. */
  function marcaDeHora(): string {
    // Hora y minuto los manda el reloj del TURNO; los segundos corren en tiempo
    // real. El turno va comprimido: sacando los segundos de su reloj, el
    // contador se quedaría clavado en 00 y la marca parecería rota.
    const total = Math.max(0, minutoBase);
    const h = Math.floor(total / 60) % 24;
    const m = Math.floor(total) % 60;
    const s = Math.floor(segundos) % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  /** Texto con contorno, como lo estampa el grabador: se lee sobre cualquier fondo. */
  function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color: string): void {
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  }

  function dibujarSenal(ctx: CanvasRenderingContext2D, indice: number): void {
    const { toma, cual, cuantas } = enCuadrante(indice);
    const activa = toma !== undefined;
    const color = activa ? "#ffc94d" : "#e4ece6";
    ctx.lineJoin = "round";
    // Nada de un canal se dibuja sobre el vecino.
    ctx.beginPath();
    ctx.rect(0, 0, QW, QH);
    ctx.clip();

    // Recuadro del detector de movimiento, deformado con la misma óptica que
    // la imagen para que abrace lo que marca y no quede corrido en los bordes.
    const r = detecciones[indice];
    if (activa && r) {
      const puntos = [
        trasLaOptica(r.x0, r.y0),
        trasLaOptica(r.x1, r.y0),
        trasLaOptica(r.x0, r.y1),
        trasLaOptica(r.x1, r.y1),
        trasLaOptica((r.x0 + r.x1) / 2, r.y0),
        trasLaOptica((r.x0 + r.x1) / 2, r.y1),
        trasLaOptica(r.x0, (r.y0 + r.y1) / 2),
        trasLaOptica(r.x1, (r.y0 + r.y1) / 2),
      ];
      // La inversa de la óptica empuja hacia fuera: cerca del borde el recuadro
      // se saldría del cuadro, así que se acota a él.
      const x0 = Math.max(3, Math.min(...puntos.map((q) => q[0])) * QW);
      const x1 = Math.min(QW - 3, Math.max(...puntos.map((q) => q[0])) * QW);
      const y0 = Math.max(3, Math.min(...puntos.map((q) => q[1])) * QH);
      const y1 = Math.min(QH - 3, Math.max(...puntos.map((q) => q[1])) * QH);
      const brazo = Math.min(12, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
      ctx.fillStyle = "rgba(255,201,77,0.07)";
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3.2;
      const esquinas = (): void => {
        ctx.beginPath();
        ctx.moveTo(x0, y0 + brazo);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x0 + brazo, y0);
        ctx.moveTo(x1 - brazo, y0);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x1, y0 + brazo);
        ctx.moveTo(x1, y1 - brazo);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 - brazo, y1);
        ctx.moveTo(x0 + brazo, y1);
        ctx.lineTo(x0, y1);
        ctx.lineTo(x0, y1 - brazo);
        ctx.stroke();
      };
      esquinas();
      ctx.strokeStyle = "#ffc94d";
      ctx.lineWidth = 1.6;
      esquinas();
      ctx.strokeStyle = "rgba(255,201,77,0.35)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "left";
      const etiquetaY = y0 > 60 ? y0 - 4 : y1 + 10;
      texto(ctx, "MOVIMIENTO", x0 + 1, etiquetaY, "#ffc94d");
    }

    // Bandas tenues bajo los textos: sin ellas el rótulo se pierde justo
    // cuando el iluminador deja una zona clara detrás.
    const banda = ctx.createLinearGradient(0, 0, 0, 34);
    banda.addColorStop(0, "rgba(0,0,0,0.45)");
    banda.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = banda;
    ctx.fillRect(0, 0, QW, 34);
    const bandaBaja = ctx.createLinearGradient(0, QH - 38, 0, QH);
    bandaBaja.addColorStop(0, "rgba(0,0,0,0)");
    bandaBaja.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = bandaBaja;
    ctx.fillRect(0, QH - 38, QW, 38);

    ctx.textAlign = "left";
    ctx.font = "bold 14px monospace";
    texto(ctx, ROTULOS[indice], 10, 20, color);

    // Modo del sensor, como lo indican los grabadores.
    const anchoRotulo = ctx.measureText(ROTULOS[indice]).width;
    if (infrarrojo.asArray()[indice]) {
      ctx.font = "bold 9px monospace";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(18 + anchoRotulo, 10, 18, 12);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(18 + anchoRotulo, 10, 18, 12);
      texto(ctx, "IR", 21 + anchoRotulo, 19.5, color);
    }

    // La marca del detector, si la toma trae una. Es el dato que permite
    // anotar "desde las 01:50" sin calcularlo a ojo: lo estampa la cámara.
    if (toma?.rotulo) {
      ctx.font = "bold 11px monospace";
      texto(ctx, toma.rotulo, 10, 37, color);
    }

    // Fecha y hora abajo a la derecha. Sin fecha una imagen de seguridad no
    // sirve como prueba.
    ctx.textAlign = "right";
    ctx.font = "bold 10px monospace";
    texto(ctx, FECHA_TURNO, QW - 10, QH - 24, activa ? "rgba(255,201,77,0.85)" : "rgba(228,236,230,0.8)");
    ctx.font = "bold 14px monospace";
    texto(ctx, marcaDeHora(), QW - 10, QH - 9, color);

    // Con más de una toma pendiente se dice cuál se ve y cuántas hay: si no,
    // el cuadrante cambiaría solo y parecería un fallo en vez de un reparto.
    if (toma && cuantas > 1) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      texto(ctx, `${horaDeMinuto(toma.minuto)}  ${cual + 1}/${cuantas}`, 10, QH - 9, color);
    }

    // Testigo de grabación: parpadea solo donde hay algo ocurriendo, así el
    // cuadrante que importa se distingue de un vistazo.
    if (activa && Math.floor(segundos * 1.6) % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(QW - 16, 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff4a4a";
      ctx.beginPath();
      ctx.arc(QW - 16, 15, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.font = "bold 12px monospace";
      texto(ctx, "REC", QW - 26, 19.5, color);
    }

    // Borde del cuadrante: ámbar donde hay algo pendiente.
    ctx.strokeStyle = activa ? "rgba(214,150,52,0.95)" : "rgba(34,42,50,0.9)";
    ctx.lineWidth = activa ? 3 : 2;
    ctx.strokeRect(0, 0, QW, QH);
  }

  let firmaPrevia = "";
  let ultimaRevision = -1;

  /** Repinta los rótulos solo si cambió algo de lo que muestran. */
  function rotular(forzar = false): void {
    const partes = [marcaDeHora(), String(Math.floor(segundos * 1.6) % 2), infrarrojo.asArray().join("")];
    for (let i = 0; i < sets.length; i++) {
      const { toma, cual, cuantas } = enCuadrante(i);
      const r = detecciones[i];
      partes.push(
        `${toma ? `${toma.escena}@${toma.minuto}:${toma.rotulo ?? ""}` : "-"}:${cual}/${cuantas}:${
          r ? [r.x0, r.y0, r.x1, r.y1].map((v) => v.toFixed(3)).join(",") : ""
        }`
      );
    }
    const firma = partes.join("|");
    if (!forzar && firma === firmaPrevia) return;
    firmaPrevia = firma;

    const ctx = superposicion.getContext() as unknown as CanvasRenderingContext2D;
    ctx.save();
    ctx.clearRect(0, 0, ANCHO_BASE * FACTOR, ALTO_BASE * FACTOR);
    ctx.scale(FACTOR, FACTOR);
    for (let i = 0; i < sets.length; i++) {
      ctx.save();
      ctx.translate((i % 2) * CW + MARGEN, Math.floor(i / 2) * CH + MARGEN);
      dibujarSenal(ctx, i);
      ctx.restore();
    }
    ctx.restore();
    superposicion.update();
  }

  let diaAplicado = -1;
  /**
   * Pone el circuito en hora: el reloj que estampan y la luz que filman.
   *
   * La luz de día sigue la misma curva que el ventanal —noche cerrada hasta
   * las 05:30, alba y amanecer hasta el final del turno— para que el monitor
   * no muestre noche mientras por la ventana ya aclaró.
   */
  function aplicarHora(minuto: number): void {
    minutoBase = minuto;
    const x = Math.max(0, Math.min(1, (minuto - 330) / 140));
    const dia = x * x * (3 - 2 * x);
    if (Math.abs(dia - diaAplicado) < 0.005) return;
    diaAplicado = dia;
    sets.forEach((s) => s.amanecer(dia));
    // El filtro de corte IR: con luz de sobra la cámara vuelve a color.
    const ir = EN_INFRARROJO.map((v) => (v && dia < 0.55 ? 1 : 0));
    infrarrojo.set(ir[0], ir[1], ir[2], ir[3]);
    material.setVector4("infrarrojo", infrarrojo);
    // El control de ganancia de las cámaras exteriores baja con el día: sin
    // él, a las ocho la vereda y el cielo salían quemados a blanco.
    const ganancia = 1 - 0.5 * dia;
    material.setVector4(
      "exposicion",
      new Vector4(EXPOSICION[0] * ganancia, EXPOSICION[1] * ganancia, EXPOSICION[2], EXPOSICION[3])
    );
  }
  aplicarHora(0);

  rotular(true);

  let turno = 0;
  let msAcumulados = 0;
  const PASO = MS_POR_CUADRO / sets.length;

  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(250, motor.getDeltaTime());
    segundos += dt / 1000;
    msAcumulados += dt;
    if (msAcumulados >= PASO) {
      msAcumulados %= PASO;
      const camara = scene.activeCamera;
      if (!pantalla || !camara || camara.isInFrustum(pantalla)) {
        filmar(turno);
        turno = (turno + 1) % sets.length;
      }
    }
    if (segundos - ultimaRevision >= 0.05) {
      ultimaRevision = segundos;
      rotular();
    }
    material.setFloat("tiempo", segundos);
    material.setVector4("cuadros", numeroCuadro);
  });

  scene.onDisposeObservable.addOnce(() => {
    scene.onBeforeRenderObservable.remove(observador);
    scene.onNewLightAddedObservable.remove(observadorLuces);
  });

  return {
    material,
    vincularPantalla(malla) {
      pantalla = malla;
    },
    ajustarHora(minuto) {
      aplicarHora(minuto);
    },
    encender(id, indice, escena, minuto, rotulo) {
      aplicarHora(minuto);
      activas.set(id, { indice, escena, desde: segundos, minuto, rotulo });
      // Sin esto el cuadrante tarda hasta un quinto de segundo en encenderse.
      filmar(indice);
      rotular(true);
    },
    apagar(id) {
      const toma = activas.get(id);
      if (!toma) return;
      activas.delete(id);
      filmar(toma.indice);
      rotular(true);
    },
  };
}
