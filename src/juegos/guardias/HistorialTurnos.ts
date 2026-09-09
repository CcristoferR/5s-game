import type { Falta } from "./LibroNovedades";

// ===========================================================================
// Historial de turnos
// ===========================================================================
//
// Qué turnos jugó cada persona, qué nota sacó y en qué se equivocó.
//
// ─── POR QUÉ ESTO NO PODÍA SEGUIR EN MEMORIA ──────────────────────────────
//
// Hasta ahora el resultado del turno vivía en una variable: se calculaba la
// nota, se mostraba en el informe final y se perdía al recargar la página.
//
// Eso deja el curso a medio camino de lo que dice el propio manual. El libro
// de novedades es "el instrumento en el cual se debe medir las acciones y
// desempeño de nuestro personal" — un curso que enseña a llevarlo y después
// no guarda cómo lo llevó cada alumno no puede decirle a nadie qué le falta.
// Sin registro no hay reforzamiento posible: ni el relator sabe a quién
// insistirle, ni el alumno sabe si mejoró desde la vez anterior.
//
// ─── EL MODELO ────────────────────────────────────────────────────────────
//
//   TURNO (1) ────< (N) FALTA
//
// Un turno es un intento completo: quién lo jugó, de qué curso y escenario,
// cuándo empezó y terminó, qué nota sacó y si aprobó. De él cuelgan las faltas
// que cometió, cada una con su tipo, su descripción y la regla del manual que
// la prohíbe.
//
// Se guardan las faltas y no solo la nota porque la nota no enseña nada. Dos
// alumnos con 70 pueden tener problemas opuestos: uno que redacta opiniones y
// otro que se olvida de anotar. Al reforzamiento le sirve el detalle.
//
// ─── POR QUÉ EL ALMACENAMIENTO ESTÁ AISLADO ───────────────────────────────
//
// Todo lo que toca el navegador está en leer() y escribir(), abajo. El resto
// del archivo trabaja con objetos y no sabe dónde acaban. El día que la
// plataforma tenga backend, se reemplazan esas dos funciones por llamadas al
// servidor y nada más del juego cambia.

/** Nota mínima para dar el escenario por aprobado. */
export const NOTA_APROBACION = 60;

export interface FaltaRegistrada {
  tipo: string;
  descripcion: string;
  fundamento: string;
  /** Párrafo del libro que la originó, si nació de una constancia concreta. */
  parrafo?: number;
  /** La constancia que la causó quedó anulada. */
  subsanada: boolean;
}

export interface TurnoRegistrado {
  id: string;
  usuario: string;
  curso: string;
  escenario: number;
  /** ISO 8601. Cuándo abrió el servicio. */
  iniciadoEn: string;
  /** ISO 8601. Cuándo lo entregó. */
  terminadoEn: string;
  /** Cuánto duró el intento, en segundos. */
  duracionSegundos: number;
  nota: number;
  aprobado: boolean;
  faltas: FaltaRegistrada[];
}

const CLAVE = "guardias.historialTurnos.v1";
/**
 * Tope de turnos guardados.
 *
 * El navegador da unos pocos megas y este historial comparte ese espacio con
 * todo lo demás. Doscientos intentos son muchos más de los que va a jugar una
 * persona en un curso, y cuando se pasa se tiran los más viejos: para el
 * reforzamiento importan los últimos, no el primero de hace meses.
 */
const TOPE = 200;

// --- La única parte que sabe dónde se guarda -------------------------------

function leer(): TurnoRegistrado[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    // Si alguien tocó el almacenamiento a mano, o quedó una versión anterior
    // con otra forma, se prefiere empezar de cero antes que romper el juego
    // por un dato mal formado.
    return Array.isArray(datos) ? (datos as TurnoRegistrado[]) : [];
  } catch {
    return [];
  }
}

function escribir(turnos: TurnoRegistrado[]): boolean {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(turnos.slice(-TOPE)));
    return true;
  } catch {
    // Almacenamiento lleno, modo privado del navegador o permisos denegados.
    // No se interrumpe la partida por esto: el jugador ya vio su nota en el
    // informe final, que es lo que le importa en ese momento.
    return false;
  }
}

// --- Lo que usa el resto del juego -----------------------------------------

export interface DatosTurno {
  usuario: string;
  curso: string;
  escenario: number;
  iniciadoEn: Date;
  nota: number;
  faltas: Falta[];
}

/**
 * Guarda un turno terminado.
 *
 * Devuelve el registro tal como quedó, aunque no se haya podido escribir: el
 * informe final lo necesita para mostrar la nota y el resumen, y eso tiene que
 * funcionar igual con el almacenamiento caído.
 */
export function registrarTurno(datos: DatosTurno): {
  turno: TurnoRegistrado;
  guardado: boolean;
} {
  const fin = new Date();
  const turno: TurnoRegistrado = {
    id: `t_${fin.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    usuario: datos.usuario,
    curso: datos.curso,
    escenario: datos.escenario,
    iniciadoEn: datos.iniciadoEn.toISOString(),
    terminadoEn: fin.toISOString(),
    duracionSegundos: Math.round((fin.getTime() - datos.iniciadoEn.getTime()) / 1000),
    nota: datos.nota,
    aprobado: datos.nota >= NOTA_APROBACION,
    faltas: datos.faltas.map((f) => ({
      tipo: f.tipo,
      descripcion: f.descripcion,
      fundamento: f.fundamento,
      parrafo: f.parrafo,
      subsanada: f.subsanada === true,
    })),
  };

  const guardado = escribir([...leer(), turno]);
  return { turno, guardado };
}

/** Todos los intentos de esa persona, del más reciente al más antiguo. */
export function historialDe(usuario: string, escenario?: number): TurnoRegistrado[] {
  return leer()
    .filter((t) => t.usuario === usuario && (escenario === undefined || t.escenario === escenario))
    .reverse();
}

/** La mejor nota conseguida. Null si nunca lo jugó. */
export function mejorNota(usuario: string, escenario: number): number | null {
  const notas = historialDe(usuario, escenario).map((t) => t.nota);
  return notas.length === 0 ? null : Math.max(...notas);
}

/**
 * ¿Tiene el escenario aprobado?
 *
 * Basta con haberlo aprobado UNA vez: un turno posterior peor no le quita a
 * nadie lo que ya demostró. Es como funciona cualquier certificación —el
 * examen se aprueba, no se mantiene— y además evita el efecto perverso de que
 * alguien no quiera volver a practicar por miedo a bajarse la nota.
 */
export function estaAprobado(usuario: string, escenario: number): boolean {
  const mejor = mejorNota(usuario, escenario);
  return mejor !== null && mejor >= NOTA_APROBACION;
}

/**
 * Las faltas que esa persona más repite, de más a menos.
 *
 * Es la vista que le sirve al relator: no "sacó 62", sino "lleva cuatro turnos
 * metiendo apreciaciones personales". Ahí es donde el historial deja de ser un
 * registro y pasa a ser reforzamiento.
 */
export function faltasFrecuentes(
  usuario: string,
  escenario?: number
): { tipo: string; veces: number }[] {
  const cuenta = new Map<string, number>();
  for (const turno of historialDe(usuario, escenario)) {
    for (const falta of turno.faltas) {
      cuenta.set(falta.tipo, (cuenta.get(falta.tipo) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .map(([tipo, veces]) => ({ tipo, veces }))
    .sort((a, b) => b.veces - a.veces);
}

/** Borra el historial de una persona. Para pruebas y para el panel de admin. */
export function borrarHistorial(usuario: string): boolean {
  return escribir(leer().filter((t) => t.usuario !== usuario));
}