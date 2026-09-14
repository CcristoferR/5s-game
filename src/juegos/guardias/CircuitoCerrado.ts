import {
  Scene,
  Mesh,
  MeshBuilder,
  TransformNode,
  PBRMaterial,
  Color3,
  Color4,
  Vector3,
  FreeCamera,
  SpotLight,
  PointLight,
  HemisphericLight,
  Light,
  AbstractMesh,
  DynamicTexture,
  Texture,
  ParticleSystem,
} from "@babylonjs/core";
import type { EscenaCamara } from "./SucesosCondominio";
import { crearVehiculo, crearArbol, type Vehiculo } from "./ModelosCalle";
import { crearAzar } from "./TexturasPBR";

// ===========================================================================
// Los cuatro sitios que filman las cámaras del monitor
// ===========================================================================
//
// Antes cada cuadrante del monitor era un dibujo en un lienzo: la reja en
// líneas, la camioneta en rectángulos. Se leía como un esquema, no como una
// grabación. Una cámara de seguridad no dibuja: FILMA, con su óptica gran
// angular, su iluminador infrarrojo, la lluvia pasando delante del lente y la
// luz de sodio del estacionamiento tiñéndolo todo.
//
// Así que ahora cada cámara filma un sitio 3D de verdad. La camioneta llega
// con los faros encendidos encandilando la cámara a través de los barrotes,
// la van del estacionamiento echa humo por el escape con las intermitentes
// rebotando en el asfalto mojado, y la puerta de la bodega deja entrar la luz
// del pasillo por la rendija.
//
// ─── DÓNDE ESTÁN ──────────────────────────────────────────────────────────
//
// A dos kilómetros de la sala, cada uno en su parcela, y en una CAPA propia:
// la cámara del puesto no los dibuja nunca aunque mirara hacia allá, y las
// cámaras del circuito no dibujan la sala. Sus luces solo alcanzan a sus
// propias mallas, y las de la sala no los alcanzan a ellos (ver
// MonitorCamaras). Todas las mallas llevan nombre "cctv…" para que la sonda de
// reflejos y las sombras del flexo las dejen fuera.

/** Capa de las mallas y cámaras del circuito cerrado. La del puesto no la incluye. */
export const CAPA_CCTV = 0x10000000;

/**
 * Resolución a la que filma cada cámara.
 *
 * La proporción es la del cuadrante del monitor (0,3375 × 0,1975 m), no 16:9:
 * así la imagen llega sin estirarse. Y la cifra es la de un grabador D1
 * ampliado, que es lo que da de sí una cámara de condominio: con más, la
 * imagen se vería de una nitidez que ninguna instalación de este tipo tiene.
 */
export const ANCHO_CUADRO = 768;
export const ALTO_CUADRO = 450;

export interface Rectangulo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SetCamara {
  indice: number;
  camara: FreeCamera;
  mallas: AbstractMesh[];
  /** Deja el sitio como corresponde a la escena activa, o en calma si es null. */
  poner(escena: EscenaCamara | null, avance: number, segundos: number): void;
  /** Recuadro de lo que dispara la detección, en fracciones del cuadro (origen arriba a la izquierda). */
  deteccion(escena: EscenaCamara | null): Rectangulo | null;
  /**
   * Luz de día que llega al sitio: 0 de noche, 1 al terminar el turno. Las
   * cámaras filman el mismo amanecer que se ve por el ventanal.
   */
  amanecer(dia: number): void;
}

const CIELO_NOCHE = new Color3(0.016, 0.012, 0.0085);
const CIELO_AZUL = new Color3(0.05, 0.075, 0.16);
const CIELO_AMANECER = new Color3(0.62, 0.48, 0.36);

/** Color del cielo filmado: pardo de noche, azul al alba, anaranjado al final. */
function colorCielo(dia: number, resultado: Color3): void {
  if (dia < 0.4) Color3.LerpToRef(CIELO_NOCHE, CIELO_AZUL, dia / 0.4, resultado);
  else Color3.LerpToRef(CIELO_AZUL, CIELO_AMANECER, (dia - 0.4) / 0.6, resultado);
}

const suave = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Frenada: llega con velocidad y se detiene sin tirón. */
const frenada = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) * (1 - x);
};

// ---------------------------------------------------------------------------
// Ayudantes de construcción
// ---------------------------------------------------------------------------

interface Obra {
  scene: Scene;
  indice: number;
  origen: Vector3;
  raiz: TransformNode;
  mallas: AbstractMesh[];
  luces: Light[];
  mat(nombre: string, color: [number, number, number], rugosidad: number, metal?: number): PBRMaterial;
  caja(nombre: string, w: number, h: number, d: number, x: number, y: number, z: number, m: PBRMaterial): Mesh;
  poner<T extends AbstractMesh>(m: T): T;
  luz<T extends Light>(l: T): T;
  mundo(x: number, y: number, z: number): Vector3;
}

function obra(scene: Scene, indice: number): Obra {
  const origen = new Vector3(2000 + indice * 220, 0, 2000);
  const raiz = new TransformNode(`cctvSet_${indice}`, scene);
  raiz.position.copyFrom(origen);
  const mallas: AbstractMesh[] = [];
  const luces: Light[] = [];
  const o: Obra = {
    scene,
    indice,
    origen,
    raiz,
    mallas,
    luces,
    mat(nombre, color, rugosidad, metal = 0) {
      const m = new PBRMaterial(`cctv${indice}_${nombre}`, scene);
      m.albedoColor = new Color3(color[0], color[1], color[2]);
      m.roughness = rugosidad;
      m.metallic = metal;
      // La sonda de reflejos fotografía la sala de conserjería: acá no pinta nada.
      m.environmentIntensity = 0.04;
      m.maxSimultaneousLights = 6;
      return m;
    },
    caja(nombre, w, h, d, x, y, z, m) {
      const c = MeshBuilder.CreateBox(`cctv${indice}_${nombre}`, { width: w, height: h, depth: d }, scene);
      c.position.set(x, y, z);
      c.material = m;
      return o.poner(c);
    },
    poner(m) {
      if (!m.parent) m.parent = raiz;
      m.isPickable = false;
      mallas.push(m);
      return m;
    },
    luz(l) {
      luces.push(l);
      return l;
    },
    mundo(x, y, z) {
      return origen.add(new Vector3(x, y, z));
    },
  };
  return o;
}

function lienzo(
  scene: Scene,
  nombre: string,
  w: number,
  h: number,
  dibujar: (ctx: CanvasRenderingContext2D) => void
): DynamicTexture {
  const tex = new DynamicTexture(nombre, { width: w, height: h }, scene, true);
  tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  tex.anisotropicFilteringLevel = 8;
  dibujar(tex.getContext() as unknown as CanvasRenderingContext2D);
  tex.update();
  return tex;
}

/** Une piezas sueltas en una sola malla: una reja son cien barrotes y un solo dibujo. */
function fusionar(o: Obra, nombre: string, piezas: Mesh[], material: PBRMaterial): Mesh {
  const malla =
    Mesh.MergeMeshes(piezas, true, true) ??
    MeshBuilder.CreateBox(`cctv${o.indice}_${nombre}`, { size: 0.001 }, o.scene);
  malla.name = `cctv${o.indice}_${nombre}`;
  malla.material = material;
  return o.poner(malla);
}

function pieza(o: Obra, nombre: string, w: number, h: number, d: number, x: number, y: number, z: number): Mesh {
  const b = MeshBuilder.CreateBox(`cctv${o.indice}_${nombre}`, { width: w, height: h, depth: d }, o.scene);
  b.position.set(x, y, z);
  return b;
}

/** Un material pintado a mano, para rótulos y marcas. */
function rotulo(o: Obra, nombre: string, w: number, h: number, dibujar: (ctx: CanvasRenderingContext2D) => void): PBRMaterial {
  const m = new PBRMaterial(`cctv${o.indice}_${nombre}`, o.scene);
  m.albedoTexture = lienzo(o.scene, `cctv${o.indice}_tex_${nombre}`, w, h, dibujar);
  m.roughness = 0.6;
  m.metallic = 0;
  m.environmentIntensity = 0.04;
  m.maxSimultaneousLights = 6;
  return m;
}

/**
 * Lluvia en un volumen.
 *
 * Las partículas no reciben luz, así que el brillo se decide acá: tenue en el
 * volumen general y fuerte en el que pasa pegado al lente, que en una cámara
 * con iluminador es donde las gotas se encienden.
 */
function lluvia(o: Obra, nombre: string, min: Vector3, max: Vector3, capacidad: number, alfa: number): ParticleSystem {
  const gota = lienzo(o.scene, `cctv${o.indice}_gota_${nombre}`, 8, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(2, 0, 4, 64);
  });
  gota.hasAlpha = true;
  const ps = new ParticleSystem(`cctv${o.indice}_${nombre}`, capacidad, o.scene);
  ps.layerMask = CAPA_CCTV;
  ps.particleTexture = gota;
  ps.emitter = o.mundo((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  ps.minEmitBox = min.subtract(max).scale(0.5);
  ps.maxEmitBox = max.subtract(min).scale(0.5);
  ps.direction1 = new Vector3(-0.6, -10, 0.3);
  ps.direction2 = new Vector3(-0.2, -12, 0.6);
  const vida = (max.y - min.y) / 11;
  ps.minLifeTime = vida * 0.8;
  ps.maxLifeTime = vida * 1.1;
  ps.minSize = 0.012;
  ps.maxSize = 0.02;
  ps.minScaleY = 12;
  ps.maxScaleY = 18;
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  ps.color1 = new Color4(0.8, 0.85, 0.9, alfa);
  ps.color2 = new Color4(0.9, 0.9, 0.95, alfa * 0.7);
  ps.colorDead = new Color4(0.8, 0.8, 0.9, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.emitRate = capacidad / vida;
  ps.preWarmCycles = 60;
  ps.start();
  return ps;
}

/**
 * Proyecta la caja de un grupo de mallas al cuadro de una cámara.
 *
 * A mano y no con la matriz de proyección de la cámara: esa usa la proporción
 * del lienzo del juego, y la cámara del circuito filma con la del cuadrante.
 */
function recuadro(camara: FreeCamera, mallas: AbstractMesh[]): Rectangulo | null {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  mallas.forEach((m) => {
    if (!m.isEnabled()) return;
    m.computeWorldMatrix(true);
    const b = m.getBoundingInfo().boundingBox;
    min.minimizeInPlace(b.minimumWorld);
    max.maximizeInPlace(b.maximumWorld);
  });
  if (!isFinite(min.x)) return null;

  const vista = camara.getViewMatrix(true);
  const tangente = Math.tan(camara.fov / 2);
  const aspecto = ANCHO_CUADRO / ALTO_CUADRO;
  const r: Rectangulo = { x0: 1, y0: 1, x1: 0, y1: 0 };
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
    const v = Vector3.TransformCoordinates(p, vista);
    if (v.z < camara.minZ) continue;
    const x = 0.5 + v.x / (v.z * tangente * aspecto) / 2;
    const y = 0.5 - v.y / (v.z * tangente) / 2;
    r.x0 = Math.min(r.x0, x);
    r.y0 = Math.min(r.y0, y);
    r.x1 = Math.max(r.x1, x);
    r.y1 = Math.max(r.y1, y);
  }
  const recorte: Rectangulo = {
    x0: Math.max(0.015, r.x0),
    y0: Math.max(0.015, r.y0),
    x1: Math.min(0.985, r.x1),
    y1: Math.min(0.985, r.y1),
  };
  if (recorte.x1 - recorte.x0 < 0.01 || recorte.y1 - recorte.y0 < 0.01) return null;
  return recorte;
}

function cerrar(
  o: Obra,
  camara: FreeCamera,
  poner: SetCamara["poner"],
  deteccion: SetCamara["deteccion"],
  amanecer: SetCamara["amanecer"] = () => {}
): SetCamara {
  camara.layerMask = CAPA_CCTV;
  camara.minZ = 0.05;
  // Lejos: una cámara que mira en diagonal alcanza el plano del cielo a
  // cientos de metros, y con el plano lejano en 150 m esa esquina salía negra.
  camara.maxZ = 1500;
  o.mallas.forEach((m) => (m.layerMask = CAPA_CCTV));
  // Una luz que ya trae su lista la conserva: es que alumbra algo concreto.
  o.luces.forEach((l) => {
    if (l.includedOnlyMeshes.length === 0) l.includedOnlyMeshes = o.mallas.slice();
  });
  return { indice: o.indice, camara, mallas: o.mallas, poner, deteccion, amanecer };
}

/**
 * El cielo de la ciudad de noche.
 *
 * Nunca es negro: las luminarias lo encienden desde abajo con un resplandor
 * pardo, y es contra ese resplandor que se recortan techos y árboles. Sin él
 * la mitad de arriba del cuadro era un vacío y los árboles no existían.
 */
function cieloUrbano(o: Obra, z: number, ancho: number, alto: number): PBRMaterial {
  const m = new PBRMaterial(`cctv${o.indice}_cielo`, o.scene);
  m.unlit = true;
  m.albedoColor = new Color3(0, 0, 0);
  // La textura solo da la forma —más claro junto al horizonte— y el color lo
  // pone la hora (ver colorCielo). De noche queda tenue: tiene que recortar
  // siluetas, no leerse como una pared iluminada.
  m.emissiveTexture = lienzo(o.scene, `cctv${o.indice}_texCielo`, 4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#5a5a5a");
    g.addColorStop(0.6, "#7a7a7a");
    g.addColorStop(0.9, "#c8c8c8");
    g.addColorStop(1, "#ffffff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
  m.emissiveColor = CIELO_NOCHE.clone();
  const plano = o.poner(MeshBuilder.CreatePlane(`cctv${o.indice}_cielo`, { width: ancho, height: alto }, o.scene));
  plano.position.set(0, alto / 2 - 2, z);
  plano.material = m;
  return m;
}

/** La luz difusa del cielo en un sitio exterior. Apagada de noche. */
function luzDeDia(o: Obra): HemisphericLight {
  const luz = o.luz(new HemisphericLight(`cctv${o.indice}_dia`, new Vector3(0.2, 1, -0.3), o.scene));
  luz.diffuse = new Color3(0.8, 0.82, 0.9);
  luz.groundColor = new Color3(0.1, 0.09, 0.08);
  luz.specular = new Color3(0, 0, 0);
  luz.intensity = 0;
  return luz;
}

function sumarVehiculo(o: Obra, v: Vehiculo): void {
  v.raiz.parent = o.raiz;
  v.mallas.forEach((m) => o.poner(m));
}

function aparcar(v: Vehiculo, x: number, z: number, rumbo: number): void {
  v.raiz.position.set(x, 0, z);
  v.raiz.rotation.y = rumbo;
}

// ---------------------------------------------------------------------------
// Trayectos
// ---------------------------------------------------------------------------
//
// Un vehículo no se desliza en línea recta hasta la reja: viene por su pista,
// dobla y se acerca de frente. Cada trayecto es una sucesión de rectas y
// arcos medidos en metros, así la distancia recorrida es la misma que gira
// las ruedas y la velocidad no pega saltos al pasar de un tramo al otro.
//
// El rumbo sigue el convenio del modelo: el frente mira a +X local, y girado
// θ sobre Y apunta a (cos θ, −sen θ) en el plano X–Z.

interface Pose {
  x: number;
  z: number;
  rumbo: number;
}

interface Tramo {
  largo: number;
  en(d: number): Pose;
}

function recta(x0: number, z0: number, x1: number, z1: number): Tramo {
  const largo = Math.hypot(x1 - x0, z1 - z0);
  const rumbo = Math.atan2(-(z1 - z0), x1 - x0);
  return {
    largo,
    en: (d) => ({ x: x0 + ((x1 - x0) * d) / largo, z: z0 + ((z1 - z0) * d) / largo, rumbo }),
  };
}

/** Arco de circunferencia recorrido con el ángulo creciente. */
function arco(cx: number, cz: number, radio: number, a0: number, a1: number): Tramo {
  return {
    largo: (a1 - a0) * radio,
    en: (d) => {
      const a = a0 + d / radio;
      return { x: cx + radio * Math.cos(a), z: cz + radio * Math.sin(a), rumbo: Math.atan2(-Math.cos(a), -Math.sin(a)) };
    },
  };
}

interface Recorrido {
  total: number;
  en(d: number): Pose;
}

function recorrido(tramos: Tramo[]): Recorrido {
  const total = tramos.reduce((s, t) => s + t.largo, 0);
  return {
    total,
    en(d) {
      let resto = Math.max(0, Math.min(total, d));
      for (const t of tramos) {
        if (resto <= t.largo) return t.en(resto);
        resto -= t.largo;
      }
      const ultimo = tramos[tramos.length - 1];
      return ultimo.en(ultimo.largo);
    },
  };
}

function conducir(v: Vehiculo, r: Recorrido, fraccion: number): void {
  const d = r.total * Math.max(0, Math.min(1, fraccion));
  const p = r.en(d);
  v.raiz.position.set(p.x, -0.03, p.z);
  v.raiz.rotation.y = p.rumbo;
  v.ruedas.forEach((rueda) => (rueda.rotation.z = -d / v.radioRueda));
}

// ---------------------------------------------------------------------------
// CAM 01 — Acceso
// ---------------------------------------------------------------------------

function setAcceso(scene: Scene): SetCamara {
  const o = obra(scene, 0);

  const hormigon = o.mat("hormigon", [0.3, 0.3, 0.29], 0.85);
  const vereda = o.mat("vereda", [0.27, 0.27, 0.26], 0.72);
  const asfalto = o.mat("asfalto", [0.055, 0.058, 0.062], 0.24);
  const ladrillo = o.mat("ladrillo", [0.24, 0.13, 0.085], 0.9);
  const fierro = o.mat("fierro", [0.05, 0.05, 0.055], 0.45, 0.8);
  const pilar = o.mat("pilar", [0.36, 0.35, 0.33], 0.85);
  const estuco = o.mat("estuco", [0.44, 0.41, 0.36], 0.9);
  const cubierta = o.mat("cubierta", [0.12, 0.12, 0.13], 0.55, 0.4);

  // Suelo: el patio del condominio, la vereda, la calle y la vereda de enfrente.
  o.caja("patio", 20, 0.1, 12, 0, -0.05, -6, hormigon);
  o.caja("vereda", 70, 0.12, 2.4, 0, -0.04, 1.2, vereda);
  o.caja("calle", 70, 0.1, 10, 0, -0.1, 7.4, asfalto);
  o.caja("veredaEnfrente", 70, 0.12, 2.4, 0, -0.04, 13.6, vereda);
  o.caja("soleraA", 70, 0.15, 0.14, 0, 0.0, 2.43, pilar);
  o.caja("soleraB", 70, 0.15, 0.14, 0, 0.0, 12.37, pilar);
  // Terreno bajo toda la parcela: de noche no se nota, pero con luz de día
  // entre las casas y el cielo quedaba un vacío negro.
  o.caja("terreno", 1400, 0.05, 120, 0, -0.14, 40, o.mat("terreno", [0.08, 0.09, 0.07], 0.95));

  // Cierre del condominio: muro bajo con reja, pilares y portón corredizo.
  const barras: Mesh[] = [];
  [-1, 1].forEach((lado) => {
    o.caja(`muro_${lado}`, 7, 0.6, 0.25, lado * 5.8, 0.3, 0, ladrillo);
    o.caja(`pilar_${lado}`, 0.42, 2.5, 0.42, lado * 2.3, 1.25, 0, pilar);
    o.caja(`pilarFin_${lado}`, 0.42, 2.3, 0.42, lado * 9.3, 1.15, 0, pilar);
    for (let k = 0; 2.62 + k * 0.13 < 9.05; k++) {
      barras.push(pieza(o, `barrote_${lado}_${k}`, 0.022, 1.55, 0.022, lado * (2.62 + k * 0.13), 1.37, 0));
    }
    barras.push(pieza(o, `travesanoA_${lado}`, 6.6, 0.045, 0.045, lado * 5.8, 0.72, 0));
    barras.push(pieza(o, `travesanoB_${lado}`, 6.6, 0.045, 0.045, lado * 5.8, 2.02, 0));
  });
  fusionar(o, "reja", barras, fierro);

  const hojas: Mesh[] = [];
  for (let k = 0; k < 39; k++) hojas.push(pieza(o, `portonBarra_${k}`, 0.028, 1.9, 0.028, -2.0 + k * 0.105, 1.05, 0));
  [0.14, 1.02, 1.98].forEach((y, k) => hojas.push(pieza(o, `portonMarco_${k}`, 4.12, 0.06, 0.05, 0, y, 0)));
  const porton = fusionar(o, "porton", hojas, fierro);
  porton.position.z = -0.17;
  o.caja("riel", 8.8, 0.03, 0.07, 2.2, 0.015, -0.17, fierro);

  // Farol sobre el pilar izquierdo: fanal de vidrio con su tapa.
  const farolMat = o.mat("farol", [0.9, 0.85, 0.7], 0.3);
  farolMat.emissiveColor = new Color3(1.2, 1.0, 0.68);
  o.caja("farol", 0.14, 0.2, 0.14, -2.3, 2.62, 0, farolMat);
  o.caja("farolTapa", 0.2, 0.04, 0.2, -2.3, 2.74, 0, fierro);
  o.caja("farolBase", 0.18, 0.04, 0.18, -2.3, 2.52, 0, fierro);
  const farol = o.luz(new PointLight("cctv0_luzFarol", o.mundo(-2.3, 2.6, 0.35), scene));
  farol.diffuse = new Color3(1, 0.88, 0.66);
  farol.intensity = 3.2;

  // Enfrente: vereda, cierres y casas, con alguna ventana todavía encendida.
  o.caja("cierreEnfrente", 70, 1.5, 0.2, 0, 0.75, 15.1, ladrillo);
  const ventanaLuz = o.mat("ventanaLuz", [0.3, 0.25, 0.2], 0.3);
  // Tenue: en infrarrojo una ventana encendida satura a blanco y, con la
  // fachada en sombra, se leía como un cuadro flotando en la noche.
  ventanaLuz.emissiveColor = new Color3(0.55, 0.4, 0.22);
  const ventanaOscura = o.mat("ventanaOscura", [0.02, 0.022, 0.026], 0.08, 0.2);
  [-23.5, -13, -3.5, 7, 17, 27.5].forEach((x, k) => {
    o.caja(`casa_${k}`, 8.6, 4.8, 6, x, 2.4, 19.4, estuco);
    o.caja(`alero_${k}`, 9.3, 0.2, 7, x, 4.9, 19.3, cubierta);
    [-2.3, 2.3].forEach((dx, j) => {
      // Por delante de la fachada (que está en z 16,4), no metida en ella.
      o.caja(`ventana_${k}_${j}`, 1.4, 1.15, 0.02, x + dx, 2.7, 16.37, (k + j) % 3 === 1 ? ventanaLuz : ventanaOscura);
    });
  });
  // Ancho y alto de sobra: la esquina del cuadro lo corta lejos y arriba.
  const cielo = cieloUrbano(o, 70, 1400, 200);
  o.caja("posteEnfrente", 0.14, 6.2, 0.14, 4.6, 3.1, 13.9, fierro);
  o.caja("brazoEnfrente", 1.5, 0.08, 0.1, 3.9, 6.15, 13.9, fierro);
  const lamparaEnfrente = o.mat("lamparaEnfrente", [1, 0.85, 0.6], 0.4);
  lamparaEnfrente.emissiveColor = new Color3(3.2, 2.4, 1.3);
  o.caja("lamparaEnfrente", 0.55, 0.1, 0.24, 3.3, 6.08, 13.9, lamparaEnfrente);
  const poste = o.luz(new SpotLight("cctv0_poste", o.mundo(3.3, 6.0, 13.9), new Vector3(0, -1, 0), 2.1, 1.4, scene));
  poste.diffuse = new Color3(1, 0.8, 0.52);
  poste.intensity = 110;

  // El iluminador infrarrojo de la propia cámara: la zona clara en el centro
  // de la imagen y la caída a negro hacia los bordes.
  const camara = new FreeCamera("cctv0_camara", o.mundo(-3.4, 3.2, -5.6), scene);
  camara.setTarget(o.mundo(0.6, 0.8, 3.2));
  camara.fov = 1.12;
  const ir = o.luz(
    new SpotLight("cctv0_ir", camara.position.clone(), camara.getTarget().subtract(camara.position).normalize(), 1.15, 1.6, scene)
  );
  ir.intensity = 160;

  const auto = crearVehiculo(scene, "cctv0_camioneta", {
    color: new Color3(0.4, 0.41, 0.43),
    patente: "KJVR-42",
    entorno: 0.04,
  });
  sumarVehiculo(o, auto);
  const faros = auto.posicionFaros.map((p, k) => {
    const f = o.luz(new SpotLight(`cctv0_faro_${k}`, p.add(new Vector3(0.1, 0, 0)), new Vector3(1, -0.08, 0), 0.9, 2, scene));
    f.parent = auto.raiz;
    f.diffuse = new Color3(1, 0.97, 0.9);
    f.intensity = 0;
    return f;
  });

  lluvia(o, "lluvia", new Vector3(-9, 0, -4), new Vector3(10, 5.5, 17), 1100, 0.18);
  // Pegada al lente: las gotas que cruzan el haz del iluminador.
  lluvia(o, "lluviaLente", new Vector3(-3.9, 1.2, -4.7), new Vector3(-0.9, 3.4, -1.9), 240, 0.42);

  // La visita llega por su pista, dobla y queda de frente a la reja. La salida
  // hace el camino al revés desde el patio y se detiene en la calle antes de
  // incorporarse, dentro del cuadro: quien mire tarde tiene que encontrar el
  // vehículo, no un rastro rojo.
  const llegada = recorrido([recta(24, 8.1, 5.4, 8.1), arco(5.4, 3.6, 4.5, Math.PI / 2, Math.PI)]);
  // La curva de salida es cerrada a propósito: termina con el vehículo en la
  // pista, a la izquierda del portón pero dentro del cuadro.
  const partida = recorrido([recta(0.9, -4.8, 0.9, 3.4), arco(-2.6, 3.4, 3.5, 0, Math.PI / 2)]);

  const luzDia = luzDeDia(o);
  const farolBase = farolMat.emissiveColor.clone();
  const lamparaBase = lamparaEnfrente.emissiveColor.clone();
  const ventanaBase = ventanaLuz.emissiveColor.clone();

  const set = cerrar(
    o,
    camara,
    (escena, avance) => {
      const hayAuto = escena === "vehiculo-en-reja" || escena === "vehiculo-saliendo";
      auto.raiz.setEnabled(hayAuto);
      faros.forEach((f) => (f.intensity = hayAuto ? 70 : 0));
      auto.faros.emissiveColor.set(hayAuto ? 7 : 0, hayAuto ? 6.8 : 0, hayAuto ? 6.1 : 0);
      let abierto = 0;
      if (escena === "vehiculo-en-reja") {
        conducir(auto, llegada, frenada(avance));
        auto.traseras.emissiveColor.set(avance > 0.82 ? 3 : 0.7, 0.04, 0.02);
      } else if (escena === "vehiculo-saliendo") {
        conducir(auto, partida, suave(avance));
        auto.traseras.emissiveColor.set(avance > 0.86 ? 3.2 : 0.8, 0.04, 0.02);
        abierto = 1 - suave((avance - 0.7) / 0.25);
      }
      porton.position.x = 4.25 * abierto;
    },
    (escena) => (escena === "vehiculo-en-reja" || escena === "vehiculo-saliendo" ? recuadro(camara, auto.mallas) : null),
    (dia) => {
      luzDia.intensity = 1.3 * dia;
      colorCielo(dia, cielo.emissiveColor);
      // Fotocélula: con luz de sobra las luminarias se apagan.
      const encendidas = dia < 0.7 ? 1 : 0;
      farol.intensity = 3.2 * encendidas;
      poste.intensity = 110 * encendidas;
      farolBase.scaleToRef(encendidas, farolMat.emissiveColor);
      lamparaBase.scaleToRef(encendidas, lamparaEnfrente.emissiveColor);
      ventanaBase.scaleToRef(1 - dia, ventanaLuz.emissiveColor);
      // Con día la cámara retira el filtro IR y su iluminador se apaga.
      ir.intensity = dia < 0.55 ? 160 : 0;
    }
  );
  // Los faros alumbran lo que tienen delante, no la carrocería de la que salen.
  faros.forEach((f) => (f.includedOnlyMeshes = set.mallas.filter((m) => !auto.mallas.includes(m as Mesh))));
  return set;
}

// ---------------------------------------------------------------------------
// CAM 02 — Estacionamiento
// ---------------------------------------------------------------------------

function setEstacionamiento(scene: Scene): SetCamara {
  const o = obra(scene, 1);
  const asfalto = o.mat("asfalto", [0.058, 0.06, 0.064], 0.22);
  const pintura = o.mat("pintura", [0.62, 0.6, 0.5], 0.6);
  const hormigon = o.mat("hormigon", [0.32, 0.32, 0.3], 0.85);
  const seto = o.mat("seto", [0.05, 0.09, 0.04], 0.9);
  const poste = o.mat("poste", [0.12, 0.12, 0.13], 0.5, 0.7);
  const muro = o.mat("muro", [0.42, 0.4, 0.37], 0.9);

  o.caja("suelo", 46, 0.1, 34, 0, -0.05, 7, asfalto);

  // Dos filas de estacionamientos con el pasillo de circulación entre medio.
  for (let k = 0; k <= 8; k++) {
    const x = -9 + k * 2.7;
    o.caja(`lineaA_${k}`, 0.1, 0.012, 5, x, 0.006, 1.5, pintura);
    o.caja(`lineaB_${k}`, 0.1, 0.012, 5, x, 0.006, 12.5, pintura);
    if (k < 8) {
      o.caja(`topeA_${k}`, 1.5, 0.12, 0.2, x + 1.35, 0.06, -0.6, hormigon);
      o.caja(`topeB_${k}`, 1.5, 0.12, 0.2, x + 1.35, 0.06, 14.6, hormigon);
    }
  }
  o.caja("fondoA", 21.7, 0.012, 0.1, 1.8, 0.006, -1, pintura);
  o.caja("fondoB", 21.7, 0.012, 0.1, 1.8, 0.006, 15, pintura);

  // "VISITAS" pintado en el piso, delante de los estacionamientos de visita.
  const marca = rotulo(o, "marcaVisitas", 512, 128, (ctx) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "#d9d2b0";
    ctx.font = "bold 92px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VISITAS", 256, 68);
  });
  (marca.albedoTexture as DynamicTexture).hasAlpha = true;
  marca.useAlphaFromAlbedoTexture = true;
  marca.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
  const letrero = o.poner(MeshBuilder.CreatePlane("cctv1_letreroPiso", { width: 4.2, height: 1.05 }, scene));
  letrero.position.set(-3.6, 0.014, 8.9);
  letrero.rotation.x = Math.PI / 2;
  letrero.material = marca;

  o.caja("bordillo", 46, 0.18, 0.3, 0, 0.09, 15.6, hormigon);
  o.caja("seto", 46, 1.3, 1.1, 0, 0.65, 16.4, seto);
  // Terreno más allá del asfalto y del seto, hasta el cielo (ver setAcceso).
  o.caja("terreno", 1400, 0.05, 100, 0, -0.08, 30, o.mat("terreno", [0.07, 0.085, 0.06], 0.95));

  // El edificio a la izquierda, con su puerta de servicio y el cartel.
  o.caja("muro", 0.3, 6, 34, -12, 3, 7, muro);
  o.caja("zocalo", 0.04, 0.5, 34, -11.84, 0.25, 7, hormigon);
  const puerta = o.mat("puertaEdificio", [0.14, 0.15, 0.17], 0.4, 0.5);
  o.caja("puertaEdificio", 0.06, 2.15, 1.05, -11.82, 1.08, 6.4, puerta);
  const cartel = rotulo(o, "cartelVisitas", 512, 128, (ctx) => {
    ctx.fillStyle = "#1f4a7a";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = "bold 70px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VISITAS  ↑", 256, 68);
  });
  const placa = o.poner(MeshBuilder.CreatePlane("cctv1_cartel", { width: 2.4, height: 0.6 }, scene));
  placa.position.set(-11.83, 2.9, 10.5);
  placa.rotation.y = -Math.PI / 2;
  placa.material = cartel;

  // Aplique LED sobre la puerta: luz fría, que contrasta con el sodio.
  const aplique = o.mat("aplique", [0.9, 0.95, 1], 0.4);
  aplique.emissiveColor = new Color3(2.4, 2.6, 2.9);
  o.caja("aplique", 0.12, 0.08, 0.36, -11.8, 2.5, 6.4, aplique);
  const led = o.luz(new SpotLight("cctv1_led", o.mundo(-11.6, 2.45, 6.4), new Vector3(0.6, -1, 0), 1.9, 1.5, scene));
  led.diffuse = new Color3(0.82, 0.9, 1);
  led.intensity = 26;

  const sodios: SpotLight[] = [];
  const lamparas: PBRMaterial[] = [];
  // Luminarias de sodio: el naranja que tiñe todo el cuadro. Van al fondo,
  // junto al seto, con el brazo hacia los estacionamientos: plantadas en el
  // pasillo, un poste partía la imagen por la mitad.
  [
    [-6, 15],
    [6.5, 15],
  ].forEach(([x, z], k) => {
    o.caja(`poste_${k}`, 0.14, 6.2, 0.14, x, 3.1, z, poste);
    o.caja(`brazo_${k}`, 0.08, 0.08, 1.1, x, 6.15, z - 0.55, poste);
    const lampara = o.mat(`lampara_${k}`, [1, 0.8, 0.5], 0.4);
    lampara.emissiveColor = new Color3(4, 2.5, 1.0);
    o.caja(`lampara_${k}`, 0.26, 0.1, 0.55, x, 6.08, z - 1.1, lampara);
    const luz = o.luz(new SpotLight(`cctv1_sodio_${k}`, o.mundo(x, 6, z - 1.1), new Vector3(0, -1, -0.45).normalize(), 2.2, 1.2, scene));
    luz.diffuse = new Color3(1, 0.6, 0.26);
    luz.specular = new Color3(1, 0.68, 0.34);
    luz.intensity = 150;
    sodios.push(luz);
    lamparas.push(lampara);
  });

  // Árboles tras el seto, que recortan el fondo.
  const follaje = o.mat("follaje", [0.06, 0.1, 0.05], 0.85);
  const corteza = o.mat("corteza", [0.09, 0.075, 0.06], 0.9);
  [
    [-6, 19.5, 6.5],
    [3.5, 20.5, 7.4],
    [12, 19, 6.2],
  ].forEach(([x, z, alto], k) => {
    const nodo = new TransformNode(`cctv1_arbol_${k}`, scene);
    nodo.parent = o.raiz;
    nodo.position.set(x, 0, z);
    crearArbol(scene, `cctv1_arbol_${k}`, alto, 31 + k * 7, follaje, corteza).forEach((m) => {
      if (!m.parent) m.parent = nodo;
      o.poner(m);
    });
  });

  // Los autos de los residentes, en su sitio.
  const estacionados = [
    { x: -4.95, z: 1.5, rumbo: Math.PI / 2, color: new Color3(0.03, 0.06, 0.14), patente: "PTSW-87" },
    { x: 3.15, z: 1.5, rumbo: Math.PI / 2, color: new Color3(0.55, 0.05, 0.04), patente: "HRLC-35" },
    { x: 5.85, z: 12.5, rumbo: -Math.PI / 2, color: new Color3(0.7, 0.7, 0.68), patente: "BXLR-11" },
  ];
  estacionados.forEach((e, k) => {
    const v = crearVehiculo(scene, `cctv1_estacionado_${k}`, { color: e.color, patente: e.patente, entorno: 0.04 });
    sumarVehiculo(o, v);
    aparcar(v, e.x, e.z, e.rumbo);
  });

  // La van de la novedad: sin patente, en la fila de visitas, de cola a la cámara.
  const van = crearVehiculo(scene, "cctv1_van", { color: new Color3(0.28, 0.3, 0.33), patente: null, entorno: 0.04 });
  sumarVehiculo(o, van);
  aparcar(van, -2.25, 12.5, -Math.PI / 2);

  const humo = new ParticleSystem("cctv1_humo", 140, scene);
  humo.layerMask = CAPA_CCTV;
  const texHumo = lienzo(scene, "cctv1_texHumo", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  texHumo.hasAlpha = true;
  humo.particleTexture = texHumo;
  // La van mira a +Z, así que el escape queda hacia la cámara.
  humo.emitter = o.mundo(-1.8, 0.3, 10.05);
  humo.minEmitBox = new Vector3(-0.04, 0, -0.04);
  humo.maxEmitBox = new Vector3(0.04, 0, 0.04);
  humo.direction1 = new Vector3(-0.2, 0.2, -0.8);
  humo.direction2 = new Vector3(0.2, 0.5, -0.4);
  humo.minEmitPower = 0.3;
  humo.maxEmitPower = 0.6;
  humo.minLifeTime = 1.6;
  humo.maxLifeTime = 2.8;
  humo.minSize = 0.25;
  humo.maxSize = 0.7;
  humo.minAngularSpeed = -0.6;
  humo.maxAngularSpeed = 0.6;
  humo.color1 = new Color4(0.85, 0.8, 0.75, 0.18);
  humo.color2 = new Color4(0.75, 0.7, 0.66, 0.12);
  humo.colorDead = new Color4(0.6, 0.6, 0.62, 0);
  humo.emitRate = 28;
  humo.blendMode = ParticleSystem.BLENDMODE_STANDARD;

  // Muy ancho: esta cámara mira en diagonal y el borde derecho del cuadro
  // corta el plano del cielo cientos de metros a un lado.
  const cielo = cieloUrbano(o, 60, 3000, 200);
  lluvia(o, "lluvia", new Vector3(-11, 0, 0), new Vector3(13, 7, 17), 1000, 0.13);
  lluvia(o, "lluviaLente", new Vector3(-9.5, 3.4, 1.5), new Vector3(-7.1, 5.8, 3.9), 160, 0.3);

  const camara = new FreeCamera("cctv1_camara", o.mundo(-9.5, 5.2, 1.2), scene);
  camara.setTarget(o.mundo(-0.5, 0.4, 12.8));
  camara.fov = 1.0;

  const luzDia = luzDeDia(o);
  const lamparasBase = lamparas.map((m) => m.emissiveColor.clone());
  const apliqueBase = aplique.emissiveColor.clone();

  return cerrar(
    o,
    camara,
    (escena, _avance, segundos) => {
      const activa = escena === "vehiculo-detenido";
      van.raiz.setEnabled(activa);
      if (activa && !humo.isStarted()) humo.start();
      if (!activa && humo.isStarted()) humo.stop();
      const destello = activa && Math.floor(segundos * 2.8) % 2 === 0 ? 5 : 0;
      van.intermitentes.emissiveColor.set(destello, destello * 0.55, destello * 0.06);
      van.traseras.emissiveColor.set(activa ? 0.6 : 0, 0.02, 0.02);
    },
    (escena) => (escena === "vehiculo-detenido" ? recuadro(camara, van.mallas) : null),
    (dia) => {
      luzDia.intensity = 1.3 * dia;
      colorCielo(dia, cielo.emissiveColor);
      const encendidas = dia < 0.7 ? 1 : 0;
      sodios.forEach((l) => (l.intensity = 150 * encendidas));
      lamparas.forEach((m, k) => lamparasBase[k].scaleToRef(encendidas, m.emissiveColor));
      led.intensity = 26 * encendidas;
      apliqueBase.scaleToRef(encendidas, aplique.emissiveColor);
    }
  );
}

// ---------------------------------------------------------------------------
// CAM 03 — Pasillo
// ---------------------------------------------------------------------------

function setPasillo(scene: Scene): SetCamara {
  const o = obra(scene, 2);
  const LARGO = 14;
  const ANCHO = 2.4;
  const ALTO = 2.6;

  const piso = new PBRMaterial("cctv2_piso", scene);
  const baldosa = lienzo(scene, "cctv2_texBaldosa", 256, 256, (ctx) => {
    ctx.fillStyle = "#b9b3a6";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#aaa395";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.strokeStyle = "#6f6a60";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();
  });
  baldosa.uScale = ANCHO / 0.8;
  baldosa.vScale = LARGO / 0.8;
  piso.albedoTexture = baldosa;
  // Explícito: con solo la rugosidad puesta, PBR toma el metal en 1 y la
  // baldosa sale negra como un espejo.
  piso.metallic = 0;
  piso.roughness = 0.24;
  piso.environmentIntensity = 0.04;
  piso.maxSimultaneousLights = 6;
  const yeso = o.mat("yeso", [0.62, 0.6, 0.56], 0.9);
  const zocalo = o.mat("zocalo", [0.12, 0.1, 0.09], 0.5);
  const madera = o.mat("puerta", [0.2, 0.12, 0.07], 0.5);
  const marco = o.mat("marco", [0.5, 0.48, 0.44], 0.7);
  const metal = o.mat("manilla", [0.7, 0.7, 0.68], 0.3, 0.9);
  const felpudo = o.mat("felpudo", [0.12, 0.09, 0.06], 0.95);

  const suelo = o.poner(MeshBuilder.CreateGround("cctv2_suelo", { width: ANCHO, height: LARGO }, scene));
  suelo.position.set(0, 0, LARGO / 2);
  suelo.material = piso;
  o.caja("techo", ANCHO, 0.05, LARGO, 0, ALTO, LARGO / 2, yeso);
  [-1, 1].forEach((lado) => {
    o.caja(`muro_${lado}`, 0.1, ALTO, LARGO, lado * (ANCHO / 2 + 0.05), ALTO / 2, LARGO / 2, yeso);
    o.caja(`zocalo_${lado}`, 0.02, 0.1, LARGO, lado * (ANCHO / 2 - 0.01), 0.05, LARGO / 2, zocalo);
  });
  o.caja("fondo", ANCHO, ALTO, 0.1, 0, ALTO / 2, LARGO + 0.05, yeso);

  // Puertas de los departamentos, con número, manilla y felpudo.
  const puertas: [number, number, string][] = [
    [-1, 3, "201"],
    [1, 5.5, "202"],
    [-1, 8.5, "203"],
    [1, 11, "204"],
  ];
  puertas.forEach(([lado, z, numero], k) => {
    o.caja(`marco_${k}`, 0.04, 2.2, 1.05, lado * (ANCHO / 2 - 0.02), 1.1, z, marco);
    o.caja(`puerta_${k}`, 0.04, 2.05, 0.88, lado * (ANCHO / 2 - 0.04), 1.03, z, madera);
    o.caja(`manilla_${k}`, 0.05, 0.03, 0.12, lado * (ANCHO / 2 - 0.08), 1.0, z + 0.32, metal);
    o.caja(`felpudo_${k}`, 0.45, 0.015, 0.75, lado * (ANCHO / 2 - 0.3), 0.008, z, felpudo);
    const placaMat = rotulo(o, `placa_${k}`, 128, 64, (ctx) => {
      ctx.fillStyle = "#c9b27a";
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = "#231d10";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(numero, 64, 34);
    });
    placaMat.metallic = 0.5;
    placaMat.roughness = 0.35;
    const p = o.poner(MeshBuilder.CreatePlane(`cctv2_numero_${k}`, { width: 0.18, height: 0.09 }, scene));
    p.position.set(lado * (ANCHO / 2 - 0.065), 1.62, z);
    // El plano mira a −Z; girado un cuarto de vuelta queda de cara al pasillo.
    p.rotation.y = lado > 0 ? Math.PI / 2 : -Math.PI / 2;
    p.material = placaMat;
  });

  // Plafones. Encendidos es el suceso; apagados queda la luz de emergencia.
  const plafones: PBRMaterial[] = [];
  const lucesTecho: PointLight[] = [];
  [2.5, 7, 11.5].forEach((z, k) => {
    const m = o.mat(`plafon_${k}`, [0.9, 0.9, 0.88], 0.5);
    plafones.push(m);
    o.caja(`plafon_${k}`, 0.5, 0.05, 0.5, 0, ALTO - 0.03, z, m);
    const luz = o.luz(new PointLight(`cctv2_luz_${k}`, o.mundo(0, ALTO - 0.25, z), scene));
    luz.diffuse = new Color3(1, 0.95, 0.85);
    lucesTecho.push(luz);
  });
  const salida = new PBRMaterial("cctv2_salida", scene);
  salida.albedoColor = new Color3(0, 0, 0);
  salida.emissiveTexture = lienzo(scene, "cctv2_texSalida", 256, 96, (ctx) => {
    ctx.fillStyle = "#0b7a3b";
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SALIDA", 128, 52);
  });
  salida.emissiveColor = new Color3(1.4, 1.4, 1.4);
  const cartel = o.poner(MeshBuilder.CreatePlane("cctv2_cartelSalida", { width: 0.45, height: 0.17 }, scene));
  cartel.position.set(0, ALTO - 0.2, LARGO - 0.01);
  cartel.material = salida;
  const piloto = o.luz(new PointLight("cctv2_piloto", o.mundo(0, ALTO - 0.4, LARGO - 0.5), scene));
  piloto.diffuse = new Color3(0.4, 1, 0.6);
  piloto.intensity = 0.6;

  // La ventana del fondo, con su hoja batiente hacia dentro.
  const vidrio = o.mat("vidrio", [0.02, 0.03, 0.05], 0.05, 0.3);
  vidrio.alpha = 0.55;
  o.caja("marcoVentana", 1.3, 0.06, 0.12, 0, 1.95, LARGO - 0.02, marco);
  o.caja("marcoVentanaBajo", 1.3, 0.06, 0.12, 0, 0.95, LARGO - 0.02, marco);
  const noche = o.mat("noche", [0.01, 0.015, 0.03], 1);
  noche.emissiveColor = new Color3(0.03, 0.04, 0.08);
  o.caja("exterior", 1.2, 0.95, 0.02, 0, 1.45, LARGO + 0.12, noche);
  const bisagra = new TransformNode("cctv2_bisagra", scene);
  bisagra.parent = o.raiz;
  bisagra.position.set(-0.6, 1.45, LARGO - 0.06);
  const hoja = o.caja("hoja", 1.2, 0.95, 0.03, 0.6, 0, 0, vidrio);
  hoja.parent = bisagra;
  // El bastidor de la hoja, claro: es lo que dibuja la silueta de la ventana
  // abierta. El vidrio solo, oscuro contra la noche, no se distinguía.
  [
    [0.6, 0.455, 1.2, 0.04],
    [0.6, -0.455, 1.2, 0.04],
    [0.02, 0, 0.04, 0.95],
    [1.18, 0, 0.04, 0.95],
  ].forEach(([x, y, w, h], k) => {
    const liston = o.caja(`hojaMarco_${k}`, w, h, 0.045, x, y, 0, marco);
    liston.parent = bisagra;
  });
  lluvia(o, "lluvia", new Vector3(-1, 0.9, LARGO + 0.2), new Vector3(1, 2.2, LARGO + 0.6), 60, 0.25);

  const camara = new FreeCamera("cctv2_camara", o.mundo(0.85, ALTO - 0.12, 0.25), scene);
  camara.setTarget(o.mundo(-0.15, 1.05, LARGO));
  camara.fov = 0.98;

  return cerrar(
    o,
    camara,
    (escena, avance) => {
      const activa = escena === "pasillo-abierto";
      lucesTecho.forEach((l) => (l.intensity = activa ? 4.5 : 0.12));
      plafones.forEach((m) => m.emissiveColor.set(activa ? 2.4 : 0.04, activa ? 2.3 : 0.04, activa ? 2.1 : 0.04));
      bisagra.rotation.y = activa ? 1.05 * suave(avance) : 0;
    },
    (escena) => (escena === "pasillo-abierto" ? recuadro(camara, [hoja]) : null),
    // La ventana del fondo es lo único del pasillo que sabe qué hora es.
    (dia) => Color3.LerpToRef(new Color3(0.03, 0.04, 0.08), new Color3(0.45, 0.5, 0.6), dia, noche.emissiveColor)
  );
}

// ---------------------------------------------------------------------------
// CAM 04 — Bodega
// ---------------------------------------------------------------------------

function setBodega(scene: Scene): SetCamara {
  const o = obra(scene, 3);
  const azar = crearAzar(404);
  const suelo = o.mat("suelo", [0.28, 0.28, 0.27], 0.8);
  const bloque = rotulo(o, "bloque", 256, 256, (ctx) => {
    ctx.fillStyle = "#7a776f";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#5c5a54";
    ctx.lineWidth = 3;
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      for (let x = (y / 64) % 2 ? 64 : 0; x <= 256; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }
  });
  bloque.roughness = 0.9;
  (bloque.albedoTexture as DynamicTexture).uScale = 4;
  (bloque.albedoTexture as DynamicTexture).vScale = 2;
  const metal = o.mat("estante", [0.25, 0.27, 0.3], 0.5, 0.7);
  const carton = o.mat("carton", [0.36, 0.26, 0.15], 0.9);
  const cartonOscuro = o.mat("cartonOscuro", [0.26, 0.19, 0.11], 0.9);
  const puertaMat = o.mat("puerta", [0.3, 0.32, 0.34], 0.45, 0.6);
  const bronce = o.mat("candado", [0.7, 0.55, 0.25], 0.3, 0.9);
  const pasillo = o.mat("pasilloFuera", [0.55, 0.52, 0.47], 0.85);

  o.caja("suelo", 5, 0.1, 4.4, 0, -0.05, 0, suelo);
  o.caja("techo", 5, 0.1, 4.4, 0, 2.75, 0, suelo);
  o.caja("muroFondo", 5, 2.7, 0.2, 0, 1.35, 2.2, bloque);
  // El muro de la cámara: sin él, el borde izquierdo del cuadro veía el vacío.
  o.caja("muroFrente", 5, 2.7, 0.2, 0, 1.35, -2.3, bloque);
  o.caja("muroDer", 0.2, 2.7, 4.4, 2.5, 1.35, 0, bloque);
  // El muro izquierdo lleva el vano de la puerta: z −1,45 a −0,35, alto 2,15.
  o.caja("muroIzqA", 0.2, 2.7, 0.75, -2.5, 1.35, -1.825, bloque);
  o.caja("muroIzqB", 0.2, 2.7, 2.55, -2.5, 1.35, 0.925, bloque);
  o.caja("dintel", 0.2, 0.55, 1.1, -2.5, 2.425, -0.9, bloque);
  o.caja("jambaA", 0.24, 2.15, 0.05, -2.42, 1.075, -1.45, metal);
  o.caja("jambaB", 0.24, 2.15, 0.05, -2.42, 1.075, -0.35, metal);

  // Del otro lado, el pasillo de servicio con su luz encendida toda la noche.
  const pisoFuera = o.caja("pisoFuera", 1.6, 0.1, 3, -3.4, -0.05, -0.9, pasillo);
  const muroFuera = o.caja("muroFuera", 0.1, 2.7, 3, -4.2, 1.35, -0.9, pasillo);
  const luzFuera = o.luz(new PointLight("cctv3_luzFuera", o.mundo(-3.7, 2.4, -0.9), scene));
  luzFuera.diffuse = new Color3(1, 0.9, 0.74);
  luzFuera.intensity = 2.6;
  luzFuera.includedOnlyMeshes = [pisoFuera, muroFuera];

  // Dos estanterías metálicas contra el fondo, llenas.
  [-1.2, 1.0].forEach((ex, k) => {
    [-0.85, 0.85].forEach((dx, j) => o.caja(`paral_${k}_${j}`, 0.05, 2.2, 0.05, ex + dx, 1.1, 1.8, metal));
    [0.15, 0.75, 1.35, 1.95].forEach((y, n) => {
      o.caja(`bandeja_${k}_${n}`, 1.8, 0.03, 0.55, ex, y, 1.8, metal);
      let x = ex - 0.8;
      let c = 0;
      while (x < ex + 0.7) {
        const w = 0.22 + azar() * 0.25;
        const h = 0.18 + azar() * 0.3;
        o.caja(`caja_${k}_${n}_${c++}`, w, h, 0.4, x + w / 2, y + 0.015 + h / 2, 1.8, azar() > 0.5 ? carton : cartonOscuro);
        x += w + 0.04;
      }
    });
  });
  // Cajas y tarros en el suelo, junto al muro derecho.
  [
    [1.9, -0.9, 0.5, 0.45],
    [1.85, -0.35, 0.42, 0.35],
    [1.95, -0.62, 0.36, 0.3],
  ].forEach(([x, z, w, h], k) => o.caja(`cajaSuelo_${k}`, w, h, w * 0.9, x, (k === 2 ? 0.45 : 0) + h / 2, z, k % 2 ? cartonOscuro : carton));
  const tarro = o.mat("tarro", [0.55, 0.56, 0.58], 0.35, 0.85);
  [
    [1.2, -1.8],
    [1.45, -1.75],
  ].forEach(([x, z], k) => {
    const t = o.poner(MeshBuilder.CreateCylinder(`cctv3_tarro_${k}`, { diameter: 0.22, height: 0.26, tessellation: 18 }, scene));
    t.position.set(x, 0.13, z);
    t.material = tarro;
  });

  const extintor = o.poner(MeshBuilder.CreateCylinder("cctv3_extintor", { diameter: 0.17, height: 0.55, tessellation: 16 }, scene));
  extintor.position.set(2.3, 1.1, 0.6);
  extintor.material = o.mat("extintor", [0.55, 0.03, 0.02], 0.35);

  const tubo = o.mat("tubo", [0.9, 0.9, 0.9], 0.5);
  tubo.emissiveColor = new Color3(1.4, 1.45, 1.5);
  o.caja("tubo", 1.2, 0.05, 0.08, 0, 2.66, 0.6, tubo);
  const luz = o.luz(new PointLight("cctv3_luz", o.mundo(0, 2.5, 0.6), scene));
  luz.diffuse = new Color3(0.9, 0.95, 1);
  luz.intensity = 1.6;

  // La puerta, que abre hacia dentro, con el candado colgando del pestillo.
  const bisagra = new TransformNode("cctv3_bisagra", scene);
  bisagra.parent = o.raiz;
  bisagra.position.set(-2.37, 1.07, -1.45);
  const hoja = o.caja("hoja", 0.05, 2.1, 1.1, 0, 0, 0.55, puertaMat);
  hoja.parent = bisagra;
  const candado = o.caja("candado", 0.05, 0.11, 0.09, 0.06, -0.02, 0.98, bronce);
  candado.parent = bisagra;
  const argolla = o.poner(MeshBuilder.CreateTorus("cctv3_arco", { diameter: 0.07, thickness: 0.012, tessellation: 16 }, scene));
  argolla.parent = candado;
  argolla.position.set(0, 0.07, 0);
  argolla.rotation.z = Math.PI / 2;
  argolla.material = bronce;
  // La luz del pasillo entrando por la rendija y abriéndose en el suelo.
  const derrame = o.luz(new SpotLight("cctv3_derrame", o.mundo(-2.9, 2.0, -0.95), new Vector3(1, -0.62, 0.12), 0.75, 3, scene));
  derrame.diffuse = new Color3(1, 0.9, 0.74);

  const camara = new FreeCamera("cctv3_camara", o.mundo(2.2, 2.5, -1.95), scene);
  camara.setTarget(o.mundo(-1.1, 0.9, 1.3));
  camara.fov = 1.08;

  return cerrar(
    o,
    camara,
    (escena, avance) => {
      const activa = escena === "bodega-abierta";
      const abierta = activa ? suave(avance) : 0;
      // Positivo: la hoja gira hacia +X, o sea hacia dentro de la bodega. Casi
      // un radián: la cámara ve el vano de frente, y con menos la hoja solo se
      // acortaba un poco sin descubrir el pasillo encendido de detrás.
      bisagra.rotation.y = 0.95 * abierta;
      derrame.intensity = 16 * abierta;
      // El candado cuelga abierto: girado y con el arco fuera del pestillo.
      candado.rotation.x = activa ? 0.45 : 0;
      argolla.position.y = activa ? 0.1 : 0.07;
    },
    (escena) => (escena === "bodega-abierta" ? recuadro(camara, [hoja]) : null)
  );
}

/** Construye los cuatro sitios, en el orden de los cuadrantes del monitor. */
export function construirSetsCircuito(scene: Scene): SetCamara[] {
  return [setAcceso(scene), setEstacionamiento(scene), setPasillo(scene), setBodega(scene)];
}
