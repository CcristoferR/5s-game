import {
  Scene,
  Mesh,
  TransformNode,
  Vector3,
  Color3,
  Quaternion,
  type AbstractMesh,
  type Observer,
} from "@babylonjs/core";
import { crearAuto } from "./ModelosExterior";
import { porMaterial } from "./ExteriorSupermercado";
import { crearFigura, type Figura, type PaletaFigura } from "./Figura";
import { crearSombraDeAuto } from "./PatrullaBanco";

// ===========================================================================
// La calle, viva
// ===========================================================================
//
// La calle del banco estaba quieta: dos autos estacionados y nadie. Una
// mañana de centro no es así, y el silencio de después del asalto se nota
// más si antes hubo vida. Pasan autos por la calle de delante, y algunos
// doblan a la calle del costado, que es la que se ve por las ventanas de la
// izquierda; y hay gente caminando por las veredas de las dos.
//
// Pocos, y buenos: los mismos autos del exterior —la carrocería por
// secciones, los vidrios, las llantas— y las mismas figuras de la sala, con
// su andar. Una calle llena se leería como un desfile.
//
// ─── LOS AUTOS ANDAN COMO AUTOS ──────────────────────────────────────────
//
// Cada uno sigue una ruta con su velocidad por tramo, y la velocidad cambia
// con aceleración de auto, no de golpe:
//   · el que dobla frena antes de la esquina, gira despacio, sube el rebaje
//     de la vereda —cabecea al subir y al bajar—, y acelera por el costado;
//   · antes de cruzar la vereda de delante, si pasa alguien, espera;
//   · el que viene detrás de uno que frena, frena también y guarda distancia.
//
// ─── SIN AZAR ────────────────────────────────────────────────────────────
//
// Como todo el nivel: cada auto sale cuando le toca, con esperas fijas, y
// cada peatón da su vuelta. Dos partidas ven la misma calle.
//
// ─── CUANDO EMPIEZA EL ASALTO, LA GENTE SE VA ────────────────────────────
//
// Después se pregunta cuántos eran y por dónde se fueron, y eso se ve por la
// puerta y por las ventanas del costado. Alguien caminando por el costado, o
// un auto subiendo por ahí, justo cuando ellos corren por ese lado, sería un
// tercero que no existe o un auto en el que "se fueron". Así que desde que
// llegan (ver despejar) cada peatón termina su tramo y, al llegar a una
// esquina que desde el puesto no se ve, se va; y ningún auto más dobla al
// costado. Tardan menos de lo que tardan ellos en salir. La gente vuelve con
// Carabineros; el costado queda cortado: ahí se estaciona la segunda patrulla.
//
// ─── LA LUZ ──────────────────────────────────────────────────────────────
//
// Son de fuera: las alumbran el sol y el cielo, no el hall (el exterior las
// cuenta entre sus mallas). Como se mueven, no entran en lo que se dibuja
// una sola vez —el mapa de sombras, el reflejo de la cuadra— ni se congelan:
// los autos llevan su sombra de contacto debajo, y las personas la suya al
// pie, como las de dentro.

type Punto = { x: number; z: number };

/** Por dónde va un auto. */
type Ruta = "recta" | "dobla";

/** Un auto que pasa: por dónde, a qué paso y cuánto espera entre pasada y pasada. */
interface DefinicionAuto {
  nombre: string;
  color: Color3;
  patente: string;
  hatch: boolean;
  ruta: Ruta;
  /** A qué va por la calle de delante, en m/s. */
  velocidad: number;
  /** Segundos hasta la primera pasada. */
  primera: number;
  /** Las esperas entre pasadas, en orden y dando la vuelta. */
  esperas: number[];
}

const AUTOS: DefinicionAuto[] = [
  { nombre: "autoPasa_0", color: new Color3(0.8, 0.81, 0.82), patente: "KX·TR·52", hatch: true, ruta: "recta", velocidad: 8.2, primera: 3, esperas: [11, 7, 15] },
  { nombre: "autoPasa_1", color: new Color3(0.33, 0.04, 0.05), patente: "HJ·PL·19", hatch: false, ruta: "recta", velocidad: 7.4, primera: 10, esperas: [13, 9, 6] },
  { nombre: "autoPasa_2", color: new Color3(0.12, 0.13, 0.14), patente: "GW·ZS·70", hatch: false, ruta: "recta", velocidad: 8.8, primera: 17, esperas: [8, 14, 10] },
  // Los que doblan al costado: un azul petróleo y un champaña, colores de
  // auto de ciudad que no se repiten con los de delante.
  { nombre: "autoDobla_0", color: new Color3(0.05, 0.14, 0.18), patente: "LP·RD·47", hatch: true, ruta: "dobla", velocidad: 7.8, primera: 6, esperas: [15, 21, 12] },
  { nombre: "autoDobla_1", color: new Color3(0.5, 0.45, 0.36), patente: "FB·KS·83", hatch: false, ruta: "dobla", velocidad: 7.6, primera: 14, esperas: [18, 11, 23] },
];
/** Desde dónde hasta dónde pasan por delante: más allá de lo que se ve por ningún lado. */
const X_ENTRA = 58;
const X_SALE = -58;

/** El auto: dónde van los ejes respecto de su centro, y su largo con margen. Ver crearAuto. */
const EJE_DEL = 1.32;
const EJE_TRAS = 1.28;
const DISTANCIA_ENTRE_EJES = EJE_DEL + EJE_TRAS;
const LARGO_AUTO = 4.3;
/** Aceleración y frenada de un auto de ciudad, en m/s². */
const ACELERA = 2.2;
const FRENA = 3.6;
/** A qué dobla, a qué sube el rebaje y a qué sigue por el costado. */
const V_GIRO = 3.6;
const V_REBAJE = 3.0;
const V_COSTADO = 6.2;

const piel = {
  clara: new Color3(0.56, 0.41, 0.33),
  media: new Color3(0.47, 0.32, 0.24),
  morena: new Color3(0.38, 0.25, 0.18),
};

/**
 * Quien pasa por la calle. Ropa que no se confunde con la de nadie de dentro
 * —ni, sobre todo, con la de los del asalto—.
 */
interface DefinicionPeaton {
  nombre: string;
  altura: number;
  paleta: PaletaFigura;
  velocidad: number;
  /**
   * La vuelta que da, punto a punto y volviendo al primero. Todos los puntos
   * quedan fuera de lo que se ve desde el puesto: es donde se puede ir sin
   * que nadie lo vea desaparecer (ver despejar).
   */
  ronda: Punto[];
  /** Dónde empieza, en fracción del primer tramo, para que no arranquen todos juntos. */
  desde: number;
}

/**
 * Los puntos de la vereda de delante, de derecha a izquierda: hasta dónde
 * llegan y dónde se cortan sus tramos. La puerta es de madera, así que la
 * vereda solo se ve con ella abierta, y entonces, desde el puesto, en
 * sesgo: de unos trece metros a la izquierda a dos y medio. Los cortes
 * quedan fuera de eso, con margen, y ningún tramo pasa de veintiún metros:
 * menos de veinte segundos al paso de la gente.
 */
const VEREDA_X = [34, 19, 4, -17, -34];
/** Un largo de vereda por un carril, hacia la izquierda (−X) o hacia la derecha. */
const porLaVereda = (z: number, haciaLaIzquierda: boolean): Punto[] =>
  (haciaLaIzquierda ? VEREDA_X : [...VEREDA_X].reverse()).map((x) => ({ x, z }));
/** La misma ronda, empezada en otro punto. */
const desdeElPunto = <T>(ronda: T[], i: number): T[] => [...ronda.slice(i), ...ronda.slice(0, i)];
/** Subir y bajar por una vereda del costado: por un carril de ida y otro de vuelta. */
const porElCostado = (xIda: number, xVuelta: number, z0: number, z1: number): Punto[] => [
  { x: xIda, z: z0 },
  { x: xIda, z: z1 },
  { x: xVuelta, z: z1 },
  { x: xVuelta, z: z0 },
];

export interface OpcionesCalle {
  /** Alto de la vereda. */
  yVereda: number;
  /** El eje del carril de la calle de delante: de un sentido, hacia −X. */
  zCarril: number;
  /**
   * Los cuatro carriles de la vereda de delante, del banco a la calle. Cada
   * peatón va por uno y vuelve por otro, y nunca dos de frente por el mismo:
   * medido para que al cruzarse no se rocen, y lejos de los troncos de los
   * árboles, que están junto a la solera.
   */
  carriles: [number, number, number, number];
  /** La calle del costado izquierdo, la que se ve por las ventanas. */
  costado: {
    /** El eje de su carril: de un sentido, hacia +Z, alejándose de la calle de delante. */
    xCarril: number;
    /** Hasta dónde suben los autos antes de irse: más allá de lo que se ve. */
    zFin: number;
    /** Los dos carriles —ida y vuelta— de cada vereda: la del banco y la del vecino. */
    veredaBanco: [number, number];
    veredaVecino: [number, number];
    /** Las puntas de las veredas donde la gente da la vuelta: no se ven desde el puesto. */
    zBanco: [number, number];
    zVecino: [number, number];
  };
  /**
   * El rectángulo donde la calle del costado cruza la vereda de delante: los
   * autos que doblan esperan fuera si hay alguien en él o a punto de entrar.
   */
  cruce: { x0: number; x1: number; z0: number; z1: number };
  /** El alto del suelo bajo una rueda: la calzada, los rebajes y la vereda que cruzan. */
  suelo(x: number, z: number): number;
}

export interface CalleBanco {
  /** Todo lo que se mueve, para que el exterior lo alumbre sin congelarlo. */
  mallas: AbstractMesh[];
  /** La calle también se detiene con la pausa y los paneles. */
  congelar(quieta: boolean): void;
  /**
   * Con true, cada peatón termina su tramo y se va al llegar a la esquina, y
   * ningún auto más dobla al costado; con false, la gente vuelve a salir
   * desde donde se fue. El costado sigue cortado.
   */
  despejar(vacia: boolean): void;
  /**
   * Lo que la gente mira al pasar —las patrullas con las balizas—: al
   * acercarse a uno vuelven la cabeza hacia él, y la dejan cuando lo dejan
   * atrás.
   */
  mirarAlPasar(puntos: Vector3[]): void;
  dispose(): void;
}

/** Desde cuántos metros se mira lo que hay que mirar al pasar. */
const MIRAR_DESDE = 9;
/**
 * Hasta qué ángulo con el camino: delante y al lado, sí; cuando ya quedó
 * detrás, se sigue caminando mirando al frente.
 */
const MIRAR_HASTA = 1.75;

/** Cada cuánto se muestrea una ruta, en metros. */
const PASO_RUTA = 0.25;

/** Una ruta muestreada: dónde está cada tramo de un cuarto de metro y a cuánto se puede ir ahí. */
interface Trazado {
  x: Float32Array;
  z: Float32Array;
  v: Float32Array;
  largo: number;
  /** Hasta dónde puede avanzar sin cruzar la vereda de delante; Infinity si no la cruza. */
  sCeder: number;
}

/**
 * Muestrea una ruta hecha de puntos con su velocidad —cada punto dice a
 * cuánto se puede ir desde ahí— y la deja con velocidades que un auto puede
 * seguir: frena antes de llegar a lo lento y acelera al salir.
 */
function trazar(puntos: { x: number; z: number; v: number }[]): Omit<Trazado, "sCeder"> {
  const xs: number[] = [];
  const zs: number[] = [];
  const vs: number[] = [];
  let resto = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    const largo = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = resto; d < largo; d += PASO_RUTA) {
      const t = d / largo;
      xs.push(a.x + (b.x - a.x) * t);
      zs.push(a.z + (b.z - a.z) * t);
      vs.push(a.v);
    }
    resto = (((resto - largo) % PASO_RUTA) + PASO_RUTA) % PASO_RUTA;
  }
  const fin = puntos[puntos.length - 1];
  xs.push(fin.x);
  zs.push(fin.z);
  vs.push(fin.v);
  const v = Float32Array.from(vs);
  // Hacia atrás, la frenada; hacia delante, la aceleración.
  for (let i = v.length - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * FRENA * PASO_RUTA));
  for (let i = 1; i < v.length; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * ACELERA * PASO_RUTA));
  return { x: Float32Array.from(xs), z: Float32Array.from(zs), v, largo: (xs.length - 1) * PASO_RUTA };
}

export function crearCalleBanco(scene: Scene, o: OpcionesCalle): CalleBanco {
  const mallas: AbstractMesh[] = [];
  const limpiar: (() => void)[] = [];

  // --- Las rutas -------------------------------------------------------------------
  //
  // Por delante, de punta a punta. La que dobla: por delante hasta la
  // esquina, un cuarto de vuelta a la derecha de cuatro metros de radio —el
  // de un auto chico doblando despacio— hasta el carril del costado, y por
  // él hasta el fondo.
  const recta = (v: number): Trazado => ({
    ...trazar([
      { x: X_ENTRA, z: o.zCarril, v },
      { x: X_SALE, z: o.zCarril, v },
    ]),
    sCeder: Infinity,
  });
  const dobla = (v: number): Trazado => {
    const R = 4;
    const cx = o.costado.xCarril + R;
    const cz = o.zCarril + R;
    const arco: { x: number; z: number; v: number }[] = [];
    // Cada punto dice a cuánto se va DESDE él: el giro, a paso de giro; del
    // final del giro hasta pasado el segundo rebaje, más despacio aún; y de
    // ahí, por el costado.
    for (let k = 0; k <= 12; k++) {
      const a = -Math.PI / 2 - (k / 12) * (Math.PI / 2);
      arco.push({ x: cx + R * Math.cos(a), z: cz + R * Math.sin(a), v: k < 12 ? V_GIRO : V_REBAJE });
    }
    const t = trazar([
      { x: X_ENTRA, z: o.zCarril, v },
      { x: cx + 14, z: o.zCarril, v },
      ...arco,
      { x: o.costado.xCarril, z: o.cruce.z1 + 1.5, v: V_COSTADO },
      { x: o.costado.xCarril, z: o.costado.zFin, v: V_COSTADO },
    ]);
    // Dónde tiene que quedarse si hay que ceder: con el frente a medio metro
    // de la solera de la calle de delante.
    let sCeder = Infinity;
    for (let i = 0; i < t.x.length; i++) {
      if (t.z[i] >= o.cruce.z0 - 0.5) {
        sCeder = i * PASO_RUTA - LARGO_AUTO / 2;
        break;
      }
    }
    return { ...t, sCeder };
  };

  // --- Los autos ---------------------------------------------------------------
  //
  // Montados en el origen —crearAuto los da con el frente a +X y el suelo en
  // 0—, fundidos por material y colgados de un nodo que es el que se mueve y
  // se orienta: rumbo y cabeceo, que en los rebajes se nota.
  const autos = AUTOS.map((d) => {
    const piezas = crearAuto(scene, d.nombre, { color: d.color, patente: d.patente, hatch: d.hatch });
    const raiz = new TransformNode(d.nombre, scene);
    raiz.rotationQuaternion = new Quaternion();
    const fundidas = porMaterial(piezas);
    const sombra = crearSombraDeAuto(scene, d.nombre);
    limpiar.push(sombra.dispose);
    const suyas: Mesh[] = [...fundidas, sombra.malla];
    suyas.forEach((m) => {
      m.parent = raiz;
      m.isPickable = false;
      if (m !== sombra.malla) m.receiveShadows = true;
      mallas.push(m);
    });
    const ruta = d.ruta === "recta" ? recta(d.velocidad) : dobla(d.velocidad);
    return {
      d,
      ruta,
      raiz,
      suyas,
      andando: false,
      espera: d.primera,
      vez: 0,
      /** Cuánto lleva de ruta, en metros, y a qué va. */
      s: 0,
      v: 0,
      /** Dónde está y hacia dónde mira, en el plano: para los que vienen detrás. */
      x: 0,
      z: 0,
      dx: 0,
      dz: 0,
    };
  });
  type Auto = (typeof autos)[number];
  const mostrar = (a: Auto, si: boolean): void => a.suyas.forEach((m) => m.setEnabled(si));
  autos.forEach((a) => mostrar(a, false));

  const eje = new Vector3();
  const arriba = new Vector3();
  const lado = new Vector3();
  const ARRIBA = Vector3.Up();
  /** Coloca el auto en su punto de la ruta: sobre sus cuatro ruedas, con el cabeceo de lo que pisa. */
  const colocar = (a: Auto): void => {
    const r = a.ruta;
    const f = Math.min(r.x.length - 1.001, a.s / PASO_RUTA);
    const i = Math.floor(f);
    const t = f - i;
    const x = r.x[i] + (r.x[i + 1] - r.x[i]) * t;
    const z = r.z[i] + (r.z[i + 1] - r.z[i]) * t;
    // El rumbo, de un par de muestras más allá y más acá: en la curva, la
    // tangente; en la recta, la recta.
    const i0 = Math.max(0, i - 2);
    const i1 = Math.min(r.x.length - 1, i + 3);
    let dx = r.x[i1] - r.x[i0];
    let dz = r.z[i1] - r.z[i0];
    const n = Math.hypot(dx, dz) || 1;
    dx /= n;
    dz /= n;
    const yDel = o.suelo(x + dx * EJE_DEL, z + dz * EJE_DEL);
    const yTras = o.suelo(x - dx * EJE_TRAS, z - dz * EJE_TRAS);
    const y = yTras + ((yDel - yTras) * EJE_TRAS) / DISTANCIA_ENTRE_EJES;
    eje.set(dx, (yDel - yTras) / DISTANCIA_ENTRE_EJES, dz).normalize();
    Vector3.CrossToRef(eje, ARRIBA, lado);
    lado.normalize();
    Vector3.CrossToRef(lado, eje, arriba);
    Quaternion.RotationQuaternionFromAxisToRef(eje, arriba, lado, a.raiz.rotationQuaternion!);
    a.raiz.position.set(x, y + 0.004, z);
    a.x = x;
    a.z = z;
    a.dx = dx;
    a.dz = dz;
  };

  // --- La gente de la calle -------------------------------------------------------
  const [c0, c1, c2, c3] = o.carriles;
  const k = o.costado;
  const PEATONES: DefinicionPeaton[] = [
    {
      nombre: "calle_abrigoMostaza",
      altura: 1.64,
      paleta: {
        uniforme: new Color3(0.5, 0.35, 0.12),
        pantalon: new Color3(0.06, 0.06, 0.07),
        piel: piel.media,
        detalle: new Color3(0.84, 0.83, 0.8),
        pelo: new Color3(0.16, 0.1, 0.06),
        peinado: "largo",
        prenda: "abrigo",
        accesorio: "bolso",
      },
      // Los dos de la vereda de delante, al mismo paso: los que van hacia el
      // mismo lado no se alcanzan nunca.
      velocidad: 1.2,
      // Por un carril hacia la izquierda y de vuelta por otro.
      ronda: [...porLaVereda(c1, true), ...porLaVereda(c3, false)],
      desde: 0.4,
    },
    {
      nombre: "calle_camisaCeleste",
      altura: 1.79,
      paleta: {
        uniforme: new Color3(0.55, 0.66, 0.8),
        pantalon: new Color3(0.2, 0.21, 0.24),
        piel: piel.clara,
        detalle: new Color3(0.9, 0.9, 0.9),
        pelo: new Color3(0.05, 0.04, 0.035),
        peinado: "corto",
        prenda: "camisa",
      },
      velocidad: 1.2,
      // Al revés: hacia la derecha y de vuelta. La ronda, empezada un punto
      // más allá: arranca a media vereda, frente a la puerta.
      ronda: desdeElPunto([...porLaVereda(c2, false), ...porLaVereda(c0, true)], 1),
      desde: 0.5,
    },
    // --- Por el costado: lo que se ve por las ventanas de la izquierda. ---
    {
      nombre: "calle_parkaRoja",
      altura: 1.7,
      paleta: {
        uniforme: new Color3(0.48, 0.06, 0.05),
        pantalon: new Color3(0.12, 0.16, 0.26),
        piel: piel.morena,
        detalle: new Color3(0.1, 0.1, 0.1),
        pelo: new Color3(0.05, 0.04, 0.035),
        peinado: "corto",
        prenda: "parka",
        accesorio: "mochila",
      },
      // Los dos de la vereda del banco, al mismo paso y a media vuelta el uno
      // del otro.
      velocidad: 1.2,
      ronda: porElCostado(k.veredaBanco[0], k.veredaBanco[1], k.zBanco[0], k.zBanco[1]),
      desde: 0.45,
    },
    {
      nombre: "calle_poleronVerde",
      altura: 1.76,
      paleta: {
        uniforme: new Color3(0.2, 0.3, 0.2),
        pantalon: new Color3(0.26, 0.27, 0.29),
        piel: piel.clara,
        detalle: new Color3(0.85, 0.85, 0.83),
        pelo: new Color3(0.2, 0.13, 0.07),
        peinado: "corto",
        prenda: "poleron",
        zapato: new Color3(0.8, 0.8, 0.78),
        suela: new Color3(0.92, 0.92, 0.9),
      },
      velocidad: 1.2,
      ronda: desdeElPunto(porElCostado(k.veredaBanco[0], k.veredaBanco[1], k.zBanco[0], k.zBanco[1]), 2),
      desde: 0.35,
    },
    // Una pareja mayor por la vereda del vecino, más despacio y lado a lado:
    // van por los dos carriles a la vez y dan la vuelta cruzándose, donde no
    // se ve.
    {
      nombre: "calle_abrigoGrisAzul",
      altura: 1.6,
      paleta: {
        uniforme: new Color3(0.28, 0.32, 0.38),
        pantalon: new Color3(0.1, 0.1, 0.12),
        piel: piel.clara,
        detalle: new Color3(0.8, 0.74, 0.66),
        pelo: new Color3(0.62, 0.6, 0.58),
        peinado: "corto",
        prenda: "abrigo",
        accesorio: "bolso",
        rasgos: { nariz: 0.9, mandibula: 1.15, ancho: 0.96 },
      },
      velocidad: 1.0,
      ronda: porElCostado(k.veredaVecino[0], k.veredaVecino[1], k.zVecino[0], k.zVecino[1]),
      desde: 0.3,
    },
    {
      nombre: "calle_chaquetaCafe",
      altura: 1.72,
      paleta: {
        uniforme: new Color3(0.3, 0.2, 0.12),
        pantalon: new Color3(0.32, 0.3, 0.26),
        piel: piel.media,
        detalle: new Color3(0.78, 0.76, 0.7),
        pelo: new Color3(0.7, 0.69, 0.66),
        peinado: "rapado",
        prenda: "chaqueta",
        zapato: new Color3(0.14, 0.09, 0.05),
        rasgos: { nariz: 1.1, mandibula: 0.9 },
      },
      velocidad: 1.0,
      ronda: porElCostado(k.veredaVecino[1], k.veredaVecino[0], k.zVecino[0], k.zVecino[1]),
      desde: 0.3,
    },
  ];
  const en = (p: Punto): Vector3 => new Vector3(p.x, o.yVereda, p.z);
  let vacia = false;
  /** Desde que llegan los del asalto no dobla nadie más al costado; después queda la segunda patrulla. */
  let costadoCortado = false;
  const peatones = PEATONES.map((d, i) => {
    const f: Figura = crearFigura(scene, d.nombre, { paleta: d.paleta, altura: d.altura, fase: 1.3 + i * 2.2 });
    f.raiz.getChildMeshes(false).forEach((m) => {
      m.isPickable = false;
      m.receiveShadows = true;
      mallas.push(m);
    });
    const p = {
      f,
      d,
      /** El punto de la ronda al que va. */
      hacia: 1,
      /** Si se fue y espera para volver. */
      ido: false,
      /** Hacia qué tiene la cabeza vuelta al pasar, si hacia algo. */
      mirando: null as Vector3 | null,
    };
    // Empieza a medio primer tramo, mirando hacia donde va.
    const [a, b] = d.ronda;
    const inicio = { x: a.x + (b.x - a.x) * d.desde, z: a.z + (b.z - a.z) * d.desde };
    f.situar(en(inicio), en(b));
    f.visible(true);
    return p;
  });
  type Peaton = (typeof peatones)[number];
  /**
   * El tramo siguiente, de punto en punto. Al llegar a uno, si la calle se
   * está vaciando, se va de ahí: todos los puntos quedan fuera de la vista.
   */
  const andar = (p: Peaton): void => {
    p.f.caminar([en(p.d.ronda[p.hacia])], p.d.velocidad, () => {
      p.hacia = (p.hacia + 1) % p.d.ronda.length;
      if (vacia) {
        p.ido = true;
        p.f.visible(false);
        return;
      }
      andar(p);
    });
  };
  peatones.forEach(andar);

  /** Si hay alguien en el cruce de la vereda de delante, o a pocos pasos de entrar. */
  const alguienCruza = (): boolean => {
    const c = o.cruce;
    return peatones.some((p) => {
      if (p.ido) return false;
      const q = p.f.raiz.position;
      return q.x > c.x0 - 3.5 && q.x < c.x1 + 3.5 && q.z > c.z0 - 0.2 && q.z < c.z1 + 0.2;
    });
  };

  // --- Cada cuadro -------------------------------------------------------------------
  let quieta = false;
  let aMirar: Vector3[] = [];
  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (quieta) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

    // Lo que se mira al pasar: lo más cerca que haya, a menos de nueve metros
    // y sin haberlo dejado atrás. Cuenta el camino que lleva —hacia su
    // próximo punto—, no hacia dónde tiene la cabeza.
    for (const p of peatones) {
      let mira: Vector3 | null = null;
      if (!p.ido) {
        const pos = p.f.raiz.position;
        const meta = p.d.ronda[p.hacia];
        const rumbo = Math.atan2(meta.x - pos.x, meta.z - pos.z);
        let mejor = MIRAR_DESDE;
        for (const q of aMirar) {
          const dx = q.x - pos.x;
          const dz = q.z - pos.z;
          const dist = Math.hypot(dx, dz);
          const a = Math.atan2(dx, dz) - rumbo;
          if (dist < mejor && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < MIRAR_HASTA) {
            mejor = dist;
            mira = q;
          }
        }
      }
      if (mira !== p.mirando) {
        p.mirando = mira;
        p.f.mirarA(mira);
      }
    }

    const cruzan = alguienCruza();
    for (const a of autos) {
      if (!a.andando) {
        a.espera -= dt;
        if (a.espera > 0) continue;
        // El costado, cortado: el que doblaría espera su turno sin salir.
        if (a.d.ruta === "dobla" && costadoCortado) continue;
        a.andando = true;
        a.s = 0;
        a.v = a.ruta.v[0];
        mostrar(a, true);
        colocar(a);
      }
      // A cuánto quiere ir: lo que dice la ruta en este punto...
      const r = a.ruta;
      let quiere = r.v[Math.min(r.v.length - 1, Math.floor(a.s / PASO_RUTA))];
      // ...lo que deja el de delante, si lo hay en su camino...
      for (const b of autos) {
        if (b === a || !b.andando) continue;
        const rx = b.x - a.x;
        const rz = b.z - a.z;
        const delante = rx * a.dx + rz * a.dz;
        if (delante <= 0 || delante > 25) continue;
        const alLado = Math.abs(rx * a.dz - rz * a.dx);
        if (alLado > 1.6) continue;
        const hueco = delante - LARGO_AUTO - 2.5;
        quiere = Math.min(quiere, Math.max(0, b.v + hueco * 0.8));
      }
      // ...y la vereda: si alguien cruza, se queda antes de subir el rebaje.
      if (cruzan && a.s < r.sCeder) {
        quiere = Math.min(quiere, Math.sqrt(2 * FRENA * Math.max(0, r.sCeder - a.s - 0.3)));
      }
      a.v = quiere > a.v ? Math.min(quiere, a.v + ACELERA * dt) : Math.max(quiere, a.v - FRENA * 1.6 * dt);
      a.s += a.v * dt;
      if (a.s >= r.largo) {
        a.andando = false;
        mostrar(a, false);
        a.espera = a.d.esperas[a.vez % a.d.esperas.length];
        a.vez += 1;
        continue;
      }
      colocar(a);
    }
  });

  return {
    mallas,
    congelar(q) {
      quieta = q;
      peatones.forEach((p) => p.f.congelar(q));
    },
    despejar(v) {
      vacia = v;
      if (v) {
        costadoCortado = true;
        return;
      }
      peatones.forEach((p) => {
        if (!p.ido) return;
        p.ido = false;
        p.f.visible(true);
        andar(p);
      });
    },
    mirarAlPasar(puntos) {
      aMirar = puntos.map((p) => p.clone());
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      peatones.forEach((p) => p.f.dispose());
      limpiar.forEach((hacer) => hacer());
    },
  };
}
