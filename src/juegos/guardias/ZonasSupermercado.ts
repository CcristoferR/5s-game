import type { AbstractMesh } from "@babylonjs/core";
import { PLANTA_BODEGA } from "./BodegaSupermercado";
import { ZONA_REFRIGERADOS } from "./RefrigeradosSupermercado";

// ===========================================================================
// Las cuatro zonas del supermercado
// ===========================================================================
//
// Entrada, góndolas, cajas y bodega. Al cruzar de una a otra, el nombre sale
// abajo, como cuando en un juego se entra a un área.
//
// ─── POR QUÉ POR COORDENADAS ──────────────────────────────────────────────
//
// Porque en el modelo las zonas no existen. El supermercado de Bitplay es una
// sola sala abierta y el conversor fusiona la geometría por material: la caja
// es una malla, pero "la entrada" no está en ningún sitio del archivo. Lo que
// sí se puede medir son las piezas que la delimitan —la puerta, la fila
// delantera de góndolas, la caja— y de ahí salen los bordes.
//
// ─── DE DÓNDE SALE CADA NÚMERO ────────────────────────────────────────────
//
// Medido sobre el OBJ, ya en coordenadas del juego: escala 2,5, centrado en el
// edificio y con la X espejada que deja el cargador de glTF de Babylon. Los
// paquetes del 11/09 y del 15/09 tienen el trazado idéntico, grupo por grupo.
//
//   · Muros, cara interior:        X ±9,96 · Z ±7,11. La fachada es +Z.
//   · Puerta de vidrio:            X 2,13 a 3,93, en la fachada.
//   · Fila delantera de góndolas:  Z 1,30 a 2,55. La del lado de la caja
//                                  termina en X 6,22.
//   · Góndolas del fondo:          seis, desde el muro (Z −7,11) hasta −1,31.
//   · Caja:                        X 8,12 a 9,34 · Z 2,59 a 5,56.
//
// Si Bitplay mueve algo, son estos los números a revisar. comprobarPlano avisa
// en consola cuando la caja o las estanterías ya no están donde dice la tabla.

/** Centro de la puerta de vidrio, en X. El turno empieza entrando por ella. */
export const PUERTA_X = 3.03;

// ─── POR DÓNDE SE VA LA GENTE ────────────────────────────────────────────
//
// Quien se va del local no desaparece en el umbral: sale por la puerta, que se
// le abre, camina por la vereda del local y se pierde al doblar la esquina del
// edificio. Desde dentro no hay forma de ver esa esquina —las vidrieras miran
// al frente y el muro tapa los costados—, así que es ahí donde se le quita de
// la escena. Y la gente que llega, llega por el mismo camino.

/** Justo fuera de la puerta, en la vereda del local. */
export const FUERA_PUERTA = { x: PUERTA_X, z: 8.3 };
/** Pasada la esquina izquierda del edificio, sobre la vereda del local. */
export const ESQUINA_IZQUIERDA = { x: -11.9, z: 8.55 };
/** Pasada la esquina derecha. */
export const ESQUINA_DERECHA = { x: 12.1, z: 8.55 };

/**
 * Borde entre la entrada y las góndolas: quince centímetros por delante de la
 * fila delantera. Justo en su cara, el cartel saldría con el hombro ya rozando
 * la estantería.
 */
const FRENTE_GONDOLAS_Z = 2.7;

/** Borde lateral de la zona de cajas: pasado el extremo de la fila delantera. */
const COSTADO_CAJAS_X = 6.3;

/**
 * Hasta dónde llega la zona de cajas hacia el fondo: la espalda de la fila
 * delantera. Quien sube por el pasillo del muro llega a la caja por ahí.
 */
const FONDO_CAJAS_Z = 1.3;

/**
 * Más allá de cualquier muro.
 *
 * Los rectángulos de los bordes se pasan de largo a propósito. Cerrarlos justo
 * en la cara del muro deja una rendija donde no hay zona, y pegado a la pared
 * —que es por donde camina cualquiera que rodea una góndola— el jugador
 * quedaría en ninguna parte.
 */
const FUERA = 12;

export type IdZona = "entrada" | "gondolas" | "cajas" | "bodega";

interface Rectangulo {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Zona {
  id: IdZona;
  /** Lo que se lee grande. */
  nombre: string;
  /** La línea chica de debajo. */
  bajada: string;
  /** Sin solaparse con los de otra zona: cada punto del local es de una sola. */
  rectangulos: Rectangulo[];
}

export const ZONAS: readonly Zona[] = [
  {
    id: "entrada",
    nombre: "Entrada",
    bajada: "Acceso de clientes",
    rectangulos: [{ minX: -FUERA, maxX: COSTADO_CAJAS_X, minZ: FRENTE_GONDOLAS_Z, maxZ: FUERA }],
  },
  {
    id: "cajas",
    nombre: "Cajas",
    bajada: "Pago y salida",
    rectangulos: [{ minX: COSTADO_CAJAS_X, maxX: FUERA, minZ: FONDO_CAJAS_Z, maxZ: FUERA }],
  },
  {
    id: "gondolas",
    nombre: "Góndolas",
    bajada: "Sala de ventas",
    rectangulos: [
      // El bloque de pasillos, de la fila delantera al muro del fondo.
      { minX: -FUERA, maxX: COSTADO_CAJAS_X, minZ: -FUERA, maxZ: FRENTE_GONDOLAS_Z },
      // La franja de la última góndola, la que tiene la bodega a la espalda.
      { minX: COSTADO_CAJAS_X, maxX: PLANTA_BODEGA.minX, minZ: -FUERA, maxZ: FONDO_CAJAS_Z },
      // El pasillo del muro, entre la caja y la cortina de la bodega.
      { minX: PLANTA_BODEGA.minX, maxX: FUERA, minZ: PLANTA_BODEGA.maxZ, maxZ: FONDO_CAJAS_Z },
    ],
  },
  {
    id: "bodega",
    nombre: "Bodega",
    bajada: "Solo personal autorizado",
    rectangulos: [{ minX: PLANTA_BODEGA.minX, maxX: FUERA, minZ: -FUERA, maxZ: PLANTA_BODEGA.maxZ }],
  },
];

/**
 * Los muebles de la sala, en planta.
 *
 * ─── PARA QUÉ ─────────────────────────────────────────────────────────────
 *
 * Para que las figuras no los atraviesen. Una figura se mueve interpolando su
 * posición y no consulta la colisión de la escena, así que hasta ahora
 * atravesaba góndolas y mostradores sin enterarse. No se notaba porque las
 * rutas de los ocho clientes están medidas para no rozar nada.
 *
 * Deja de no notarse en cuanto una figura va DETRÁS DEL JUGADOR —el retenido
 * de la línea de cajas— porque entonces su destino lo decide el jugador, y el
 * jugador puede ponerse al otro lado de un mostrador.
 *
 * ─── DE DÓNDE SALEN LOS NÚMEROS ───────────────────────────────────────────
 *
 * De la misma tabla que la planta de ClientesSupermercado, medida sobre las
 * mallas cargadas. Si Bitplay mueve el local hay que revisar las dos.
 */
const MUEBLES: readonly Rectangulo[] = [
  // Las seis góndolas del fondo, de 1,25 m de ancho.
  ...[-8.96, -5.89, -2.82, 0.25, 3.32, 6.39].map((borde) => ({
    minX: borde,
    maxX: borde + 1.25,
    minZ: -7.11,
    maxZ: -1.31,
  })),
  // La fila delantera, en sus dos tramos.
  { minX: -8.17, maxX: -2.37, minZ: 1.3, maxZ: 2.55 },
  { minX: 0.42, maxX: 6.22, minZ: 1.3, maxZ: 2.55 },
  // El mostrador de caja.
  { minX: 8.12, maxX: 9.34, minZ: 2.59, maxZ: 5.56 },
  // Los armarios de frío del rincón izquierdo. La huella viene de su propio
  // módulo: si se mueven, se mueve también lo que las figuras esquivan.
  ZONA_REFRIGERADOS,
];

/**
 * Cuánto se inflan los muebles al preguntar si se puede pisar.
 *
 * Veinticinco centímetros, que es medio cuerpo. Se comprueba el punto en el
 * que la figura pone los pies, no su volumen entero, así que sin este margen
 * se le metería el hombro dentro del mueble antes de frenar.
 *
 * Y cabe de sobra: los ocho recorridos dejan medio metro largo hasta cada
 * estante, así que ninguno se queda atascado por esto.
 */
const MARGEN_MUEBLE = 0.25;

/** Si una figura puede plantar los pies ahí sin meterse en un mueble. */
export function sueloLibre(x: number, z: number): boolean {
  return !MUEBLES.some(
    (r) =>
      x > r.minX - MARGEN_MUEBLE &&
      x < r.maxX + MARGEN_MUEBLE &&
      z > r.minZ - MARGEN_MUEBLE &&
      z < r.maxZ + MARGEN_MUEBLE
  );
}

/**
 * Cuánto hay que pasarse del borde de una zona para darla por dejada.
 *
 * ─── POR QUÉ NO BASTA CON EL BORDE ────────────────────────────────────────
 *
 * Porque por los bordes se camina. Quien va por el pasillo transversal
 * mirando las góndolas pisa la raya de la caja una y otra vez sin querer, y
 * con un borde exacto cada pisada sería un cartel. Con este margen, volver a
 * la zona de la que se viene exige desandar setenta centímetros de verdad —lo
 * que se pasó y lo que se vuelve—, y eso ya es cambiar de sitio.
 */
const MARGEN_SALIDA = 0.35;

/**
 * Segundos que hay que seguir en una zona nueva antes de anunciarla.
 *
 * Es para las esquinas: cortar en diagonal por la punta de la zona de cajas
 * para ir de la entrada al pasillo no es "entrar a cajas", y sin esta espera
 * el cartel saldría medio segundo para nada.
 */
const ESPERA_ANUNCIO = 0.25;

export interface DetectorZonas {
  /** Cada cuadro, con la posición del jugador y el tiempo transcurrido. */
  actualizar(x: number, z: number, dt: number): void;
  /** La última zona anunciada. Null hasta el primer anuncio. */
  actual(): Zona | null;
}

/**
 * Sigue al jugador y avisa cada vez que entra en otra zona.
 *
 * La primera se avisa en cuanto se sabe dónde está, sin esperar: no se viene
 * de ningún borde, y es el cartel que dice dónde empieza el turno.
 */
export function crearDetectorZonas(alEntrar: (zona: Zona) => void): DetectorZonas {
  let actual: Zona | null = null;
  let candidata: Zona | null = null;
  let tiempoEnCandidata = 0;

  return {
    actualizar(x, z, dt) {
      if (actual && contiene(actual, x, z, MARGEN_SALIDA)) {
        candidata = null;
        return;
      }

      const nueva = ZONAS.find((zona) => contiene(zona, x, z, 0)) ?? null;
      if (!nueva || nueva === actual) {
        candidata = null;
        return;
      }

      if (nueva !== candidata) {
        candidata = nueva;
        tiempoEnCandidata = 0;
      }
      tiempoEnCandidata += dt;

      if (actual === null || tiempoEnCandidata >= ESPERA_ANUNCIO) {
        actual = nueva;
        candidata = null;
        alEntrar(nueva);
      }
    },

    actual: () => actual,
  };
}

function contiene(zona: Zona, x: number, z: number, margen: number): boolean {
  return zona.rectangulos.some(
    (r) =>
      x >= r.minX - margen && x < r.maxX + margen && z >= r.minZ - margen && z < r.maxZ + margen
  );
}

/**
 * Dónde midió la tabla las piezas de referencia, por nombre de material.
 *
 * Por material y no por malla porque ese nombre lo pone nuestro conversor, no
 * Maya: sobrevive a cualquier reexportado que no cambie la tabla de
 * convertir_supermercado.py.
 */
const REFERENCIAS: Record<string, Rectangulo> = {
  "Caja registradora": { minX: 8.12, maxX: 9.34, minZ: 2.59, maxZ: 5.56 },
  Estanterías: { minX: -8.96, maxX: 7.64, minZ: -7.11, maxZ: 2.55 },
};

/**
 * Avisa en consola si el modelo ya no está donde lo midió esta tabla.
 *
 * Las zonas son números fijos, así que un reexportado que corra la caja medio
 * metro no rompe nada a la vista: el cartel de "Cajas" empieza a salir donde
 * ya no hay caja, y ya. Este aviso es la única pista que quedaría del porqué.
 *
 * Hay que llamarla con el escenario ya dibujado. Recién cargado, las cajas
 * envolventes todavía están en la posición de antes de centrarlo.
 */
export function comprobarPlano(mallas: AbstractMesh[]): void {
  const TOLERANCIA = 0.25;

  Object.entries(REFERENCIAS).forEach(([material, esperada]) => {
    const malla = mallas.find((m) => m.material?.name === material);
    if (!malla) return;

    const { minimumWorld: min, maximumWorld: max } = malla.getBoundingInfo().boundingBox;
    const desvio = Math.max(
      Math.abs(min.x - esperada.minX),
      Math.abs(max.x - esperada.maxX),
      Math.abs(min.z - esperada.minZ),
      Math.abs(max.z - esperada.maxZ)
    );

    if (desvio > TOLERANCIA) {
      console.warn(
        `[zonas] "${material}" está ${desvio.toFixed(2)} m fuera de donde la espera ` +
          `la tabla de zonas. Si Bitplay movió el local, hay que volver a medir ` +
          `ZonasSupermercado.ts.`
      );
    }
  });
}
