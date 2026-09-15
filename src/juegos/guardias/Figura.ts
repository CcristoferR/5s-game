import { Scene, TransformNode, Vector3, Color3, Mesh, Observer } from "@babylonjs/core";
import { vestir, MEDIDAS, type Esqueleto } from "./VestuarioFigura";
import type { Peinado, Rasgos } from "./ModeladoFigura";

// ===========================================================================
// Figura humana
// ===========================================================================
//
// Una persona que camina: el supervisor de las 03:20 y los vecinos que cruzan
// el hall de noche.
//
// ─── DE MAQUETA A PERSONA ─────────────────────────────────────────────────
//
// Antes eran cajas: torso, brazos y piernas rectangulares y una cabeza lisa.
// Era lo único del hall que seguía viéndose como maqueta, y el supervisor lo
// enseñaba a dos metros de la cámara en el momento de más atención del turno.
// Además la camisa y la visera estaban en la espalda, así que de frente la
// figura no tenía nada.
//
// Ahora el cuerpo es esculpido (ver VestuarioFigura y ModeladoFigura): tronco
// con cintura y hombros, miembros que se afinan, manos, zapatos con talón y
// puntera, cara con sus volúmenes y ropa que dice quién es cada uno.
//
// ─── LO QUE HACE CREÍBLE LA CAMINATA ──────────────────────────────────────
//
//   1. PROPORCIÓN. Los ojos caen a 1,66 m, el hombro a 1,41, la cadera a 0,93.
//   2. LA CAMINATA. Las piernas alternan, los brazos van al revés, la rodilla
//      se dobla solo al pasar, el talón despega antes de levantar el pie y la
//      cadera sube y baja lo que le toca.
//   3. QUE NO PATINE. La fase del paso avanza según la DISTANCIA recorrida, y
//      el cuerpo se apoya siempre sobre el punto más bajo de los dos zapatos.
//   4. QUE MIRE. Plantado delante de alguien, inclina la cabeza hacia sus ojos
//      en vez de mirar al horizonte por encima de él.

/** Alto de referencia de la figura, en metros. */
const ALTURA = 1.75;

/** Metros que se avanzan por zancada completa (dos pasos). */
const ZANCADA = 1.5;

/** De la cadera a la suela, con la pierna recta. */
const LARGO_PIERNA = MEDIDAS.muslo + MEDIDAS.canilla + MEDIDAS.tobillo;

/**
 * Cuánto abre la pierna, en radianes.
 *
 * Sale de la condición de que el pie apoyado no se mueva mientras el cuerpo
 * pasa por encima: el pie se separa de la cadera como `L·sen(A·sen(fase))` y la
 * fase avanza 2π por ZANCADA, así que en el centro del apoyo `A = ZANCADA/(2π·L)`.
 */
const APERTURA_PIERNA = ZANCADA / (2 * Math.PI * LARGO_PIERNA);

export type Prenda = "uniforme" | "parka" | "abrigo" | "chaqueta";
export type Accesorio = "tablilla" | "mochila" | "bolso" | "paraguas";

export interface PaletaFigura {
  /** Chaqueta, abrigo o parka. */
  uniforme: Color3;
  /** Pantalón. */
  pantalon: Color3;
  /** Manos y cara. */
  piel: Color3;
  /** Camisa del uniforme, cremallera, gorro de lana. */
  detalle: Color3;
  /** Gorra de plato. Solo la lleva quien está de servicio. */
  gorra?: boolean;
  pelo?: Color3;
  peinado?: Peinado;
  prenda?: Prenda;
  accesorio?: Accesorio;
  gorroLana?: boolean;
  zapato?: Color3;
  suela?: Color3;
  rasgos?: Rasgos;
}

export interface OpcionesFigura {
  paleta: PaletaFigura;
  /**
   * Altura en metros. Por defecto 1,75. Tres personas idénticas cruzando el
   * mismo hall se leen como copias del mismo muñeco.
   */
  altura?: number;
}

/**
 * El supervisor: uniforme oscuro, gorra de plato, placa, radio y la tablilla
 * de la fiscalización. A diez metros y en penumbra la gorra es lo que lo
 * distingue de un residente que vuelve a casa.
 */
export const UNIFORME_SUPERVISOR: PaletaFigura = {
  uniforme: new Color3(0.07, 0.085, 0.13),
  pantalon: new Color3(0.05, 0.058, 0.085),
  piel: new Color3(0.33, 0.21, 0.15),
  // Celeste de camisa de uniforme, no blanco: blanco bajo la luz del hall
  // se leía como un alzacuello.
  detalle: new Color3(0.26, 0.33, 0.44),
  gorra: true,
  pelo: new Color3(0.06, 0.05, 0.045),
  peinado: "rapado",
  prenda: "uniforme",
  accesorio: "tablilla",
  rasgos: { nariz: 1.05, mandibula: 0.8, ancho: 1.03 },
};

/**
 * Ropa de calle, para los residentes.
 *
 * Lo que las separa entre sí no es tanto el color como la silueta: una parka
 * con capucha y mochila, un abrigo largo con bolso, una chaqueta con gorro de
 * lana y una gabardina con paraguas se distinguen a diez metros; cuatro
 * chaquetas de colores no.
 */
export const ROPA_RESIDENTE: PaletaFigura[] = [
  {
    uniforme: new Color3(0.26, 0.28, 0.33),
    pantalon: new Color3(0.07, 0.1, 0.19),
    piel: new Color3(0.36, 0.24, 0.17),
    detalle: new Color3(0.08, 0.08, 0.09),
    pelo: new Color3(0.1, 0.07, 0.05),
    prenda: "parka",
    accesorio: "mochila",
    zapato: new Color3(0.36, 0.37, 0.4),
    suela: new Color3(0.78, 0.77, 0.74),
    rasgos: { nariz: 0.95, mandibula: 1 },
  },
  {
    uniforme: new Color3(0.38, 0.12, 0.13),
    pantalon: new Color3(0.08, 0.08, 0.09),
    piel: new Color3(0.45, 0.3, 0.23),
    detalle: new Color3(0.6, 0.55, 0.45),
    pelo: new Color3(0.14, 0.08, 0.045),
    peinado: "largo",
    prenda: "abrigo",
    accesorio: "bolso",
    rasgos: { nariz: 0.8, mandibula: 1.2, ancho: 0.95 },
  },
  {
    uniforme: new Color3(0.13, 0.22, 0.19),
    pantalon: new Color3(0.19, 0.19, 0.21),
    piel: new Color3(0.26, 0.16, 0.11),
    detalle: new Color3(0.42, 0.14, 0.1),
    pelo: new Color3(0.04, 0.035, 0.03),
    prenda: "chaqueta",
    gorroLana: true,
    rasgos: { nariz: 1.1, mandibula: 0.9 },
  },
  {
    uniforme: new Color3(0.52, 0.46, 0.36),
    pantalon: new Color3(0.12, 0.13, 0.2),
    piel: new Color3(0.42, 0.28, 0.21),
    detalle: new Color3(0.3, 0.26, 0.2),
    pelo: new Color3(0.55, 0.53, 0.5),
    prenda: "abrigo",
    accesorio: "paraguas",
    zapato: new Color3(0.12, 0.07, 0.04),
    rasgos: { nariz: 1, mandibula: 1.05 },
  },
];

export interface Figura {
  raiz: TransformNode;
  /** Coloca la figura de golpe, sin caminar. */
  situar(punto: Vector3, mirandoHacia?: Vector3): void;
  /** Camina por los puntos, en orden, y avisa al llegar al último. */
  caminar(ruta: Vector3[], velocidad: number, alLlegar?: () => void): void;
  /** Gira suavemente hasta quedar de cara a ese punto, y lo mira a su altura. */
  mirarHacia(punto: Vector3): void;
  visible(v: boolean): void;
  dispose(): void;
}

export function crearFigura(scene: Scene, nombre: string, opciones: OpcionesFigura): Figura {
  const escala = (opciones.altura ?? ALTURA) / ALTURA;
  const nodo = (sufijo: string, padre: TransformNode, x: number, y: number, z = 0): TransformNode => {
    const n = new TransformNode(`${nombre}_${sufijo}`, scene);
    n.parent = padre;
    n.position.set(x, y, z);
    return n;
  };

  // --- Esqueleto ------------------------------------------------------------
  //
  // Nodos en las articulaciones: la cadera arrastra el cuerpo entero, cada
  // miembro tiene su articulación de arriba y la de abajo, y el pie su tobillo.
  const raiz = new TransformNode(`figura_${nombre}`, scene);
  const cuerpo = nodo("cuerpo", raiz, 0, MEDIDAS.cadera);
  const cabeza = nodo("cabeza", cuerpo, 0, MEDIDAS.cuello);
  const esq: Esqueleto = { cuerpo, cabeza, hombros: [], codos: [], caderas: [], rodillas: [], tobillos: [] };
  [-1, 1].forEach((lado) => {
    const hombro = nodo(`artHombro_${lado}`, cuerpo, lado * MEDIDAS.hombroX, MEDIDAS.hombroY);
    esq.hombros.push(hombro);
    esq.codos.push(nodo(`artCodo_${lado}`, hombro, 0, -MEDIDAS.brazo));
    const cadera = nodo(`artCadera_${lado}`, cuerpo, lado * MEDIDAS.caderaX, 0);
    esq.caderas.push(cadera);
    const rodilla = nodo(`artRodilla_${lado}`, cadera, 0, -MEDIDAS.muslo);
    esq.rodillas.push(rodilla);
    esq.tobillos.push(nodo(`artTobillo_${lado}`, rodilla, 0, -MEDIDAS.canilla));
  });

  const piezas: Mesh[] = vestir(scene, nombre, esq, opciones.paleta);

  // --- Movimiento -----------------------------------------------------------

  let ruta: Vector3[] = [];
  let indiceRuta = 0;
  let velocidad = 0;
  let alLlegar: (() => void) | undefined;

  /** Metros recorridos en total. Es lo que manda la fase del paso. */
  let recorrido = 0;
  let rumbo = 0;
  let rumboDeseado = 0;
  /** Cuánto está caminando ahora, de 0 a 1. Suaviza arrancar y parar. */
  let marcha = 0;
  let reloj = Math.random() * 10;
  /** A qué altura mira cuando está plantado, si se le dio un punto con altura. */
  let mirada: Vector3 | null = null;
  let cabeceo = 0;

  function girarHacia(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    rumboDeseado = Math.atan2(dx, dz);
  }

  /** Diferencia de ángulos por el camino corto. Sin esto gira al revés. */
  function acortar(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!raiz.isEnabled()) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    reloj += dt;

    // --- Avance por la ruta -------------------------------------------------
    let avanzando = false;
    if (indiceRuta < ruta.length) {
      const destino = ruta[indiceRuta];
      const dx = destino.x - raiz.position.x;
      const dz = destino.z - raiz.position.z;
      const falta = Math.hypot(dx, dz);

      if (falta < 0.04) {
        indiceRuta += 1;
        if (indiceRuta >= ruta.length) {
          const aviso = alLlegar;
          alLlegar = undefined;
          ruta = [];
          if (aviso) aviso();
        }
      } else {
        girarHacia(dx, dz);
        // No avanza de frente hasta estar más o menos encarado: caminar de
        // lado en las esquinas es el gesto que delata al robot.
        const desvio = Math.abs(acortar(rumboDeseado - rumbo));
        const freno = desvio > 1.2 ? 0.15 : 1;
        const paso = Math.min(falta, velocidad * freno * dt);
        raiz.position.x += (dx / falta) * paso;
        raiz.position.z += (dz / falta) * paso;
        recorrido += paso;
        avanzando = paso > 0.0005;
      }
    }

    const resto = acortar(rumboDeseado - rumbo);
    rumbo += resto * Math.min(1, dt * 7);
    raiz.rotation.y = rumbo;

    // --- Ciclo de caminata --------------------------------------------------
    marcha += ((avanzando ? 1 : 0) - marcha) * Math.min(1, dt * 6);
    const fase = (recorrido / ZANCADA) * Math.PI * 2;
    const amplitud = marcha;

    // Inclinación hacia delante al caminar, balanceo de hombros y un vaivén
    // de peso muy leve estando quieto: nadie está perfectamente clavado.
    cuerpo.rotation.x = 0.05 * amplitud;
    cuerpo.rotation.y = Math.sin(fase) * 0.07 * amplitud;
    cuerpo.rotation.z = Math.sin(fase) * 0.025 * amplitud + Math.sin(reloj * 0.6) * 0.008 * (1 - amplitud);

    esq.caderas.forEach((cadera, i) => {
      const f = fase + (i === 0 ? 0 : Math.PI);
      // Positivo lleva la pierna hacia atrás (la figura avanza hacia su +Z).
      cadera.rotation.x = Math.sin(f) * APERTURA_PIERNA * amplitud;
      // La rodilla solo se dobla en el tramo en que la pierna pasa hacia
      // delante, con el talón hacia atrás (giro positivo).
      const doblez = Math.max(0, -Math.sin(f - 0.6)) * 1.0 * amplitud;
      esq.rodillas[i].rotation.x = doblez;
      // El pie va plano respecto al suelo; al doblar la rodilla el talón
      // despega antes que la puntera, y al adelantarse entra con la puntera
      // un poco arriba, apoyando primero el talón.
      const plano = -(cuerpo.rotation.x + cadera.rotation.x + doblez);
      const talonArriba = doblez * 0.45;
      const punteraArriba = -Math.pow(Math.max(0, -Math.sin(f)), 2) * 0.18 * amplitud;
      esq.tobillos[i].rotation.x = plano + talonArriba + punteraArriba;
    });

    esq.hombros.forEach((hombro, i) => {
      const lado = i === 0 ? -1 : 1;
      const f = fase + (i === 0 ? Math.PI : 0);
      // Los brazos van al revés que las piernas y algo separados del cuerpo,
      // para que las manos no atraviesen el abrigo.
      hombro.rotation.x = Math.sin(f) * 0.32 * amplitud + Math.sin(reloj * 0.8 + i) * 0.015 * (1 - amplitud);
      hombro.rotation.z = lado * (0.07 + 0.02 * amplitud);
      // El codo nunca se estira del todo, ni parado.
      esq.codos[i].rotation.x = -(0.16 + Math.max(0, Math.sin(f)) * 0.3) * amplitud - 0.12;
    });

    // --- Altura de la cadera --------------------------------------------
    //
    // La que TIENE que tener para que el punto más bajo de los zapatos apoye
    // justo en el suelo. Con el piso pulido del hall, un pie hundido se ve dos
    // veces: dentro de la baldosa y en el reflejo.
    const caida = (i: number): number => {
      const m = esq.caderas[i].rotation.x + cuerpo.rotation.x;
      const p = m + esq.rodillas[i].rotation.x;
      const q = p + esq.tobillos[i].rotation.x;
      const yTobillo = -MEDIDAS.muslo * Math.cos(m) - MEDIDAS.canilla * Math.cos(p);
      const suela = (z: number): number => yTobillo - MEDIDAS.tobillo * Math.cos(q) - z * Math.sin(q);
      return -Math.min(suela(MEDIDAS.punta), suela(MEDIDAS.talon));
    };
    const respirar = Math.sin(reloj * 1.1) * 0.005 * (1 - amplitud);
    cuerpo.position.y = Math.max(caida(0), caida(1)) + respirar;

    // --- Cabeza ---------------------------------------------------------
    //
    // Caminando compensa el balanceo del tronco: la mirada de quien camina va
    // bastante más quieta que el cuerpo. Plantado delante de alguien, baja o
    // sube la cabeza hacia sus ojos.
    let objetivo = 0;
    if (mirada) {
      const ojos = (cuerpo.position.y + MEDIDAS.cuello + 0.14) * escala;
      const distancia = Math.hypot(mirada.x - raiz.position.x, mirada.z - raiz.position.z);
      objetivo = Math.max(-0.25, Math.min(0.32, Math.atan2(ojos - mirada.y, Math.max(0.3, distancia))));
    }
    cabeceo += (objetivo * (1 - amplitud) - cabeceo) * Math.min(1, dt * 3);
    cabeza.rotation.y = -cuerpo.rotation.y * 0.75;
    cabeza.rotation.x = -cuerpo.rotation.x * 0.6 + cabeceo + Math.sin(reloj * 0.9) * 0.008;
    cabeza.rotation.z = -cuerpo.rotation.z * 0.8;
  });

  raiz.scaling.setAll(escala);
  raiz.setEnabled(false);

  return {
    raiz,
    situar(punto, mirandoHacia) {
      raiz.position.copyFrom(punto);
      ruta = [];
      indiceRuta = 0;
      alLlegar = undefined;
      marcha = 0;
      mirada = null;
      if (mirandoHacia) {
        rumbo = Math.atan2(mirandoHacia.x - punto.x, mirandoHacia.z - punto.z);
        rumboDeseado = rumbo;
        raiz.rotation.y = rumbo;
      }
    },
    caminar(nuevaRuta, vel, aviso) {
      ruta = nuevaRuta.slice();
      indiceRuta = 0;
      velocidad = vel;
      alLlegar = aviso;
      mirada = null;
    },
    mirarHacia(punto) {
      girarHacia(punto.x - raiz.position.x, punto.z - raiz.position.z);
      // Un punto a ras de suelo es una dirección; uno con altura, unos ojos.
      mirada = punto.y > 0.2 ? punto.clone() : null;
    },
    visible(v) {
      raiz.setEnabled(v);
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      piezas.forEach((m) => m.dispose());
      raiz.dispose();
    },
  };
}
