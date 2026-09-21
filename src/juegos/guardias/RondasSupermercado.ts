import type { IdZona } from "./ZonasSupermercado";

// ===========================================================================
// La ronda obligatoria
// ===========================================================================
//
// Jefatura pide una ronda de verificación cada 20 minutos: pasar por las cuatro
// zonas del local —entrada, góndolas, cajas y bodega— antes de que se cumpla
// el plazo. Este archivo lleva la cuenta y nada más. No dibuja ni sabe de
// cámaras: recibe la zona a la que se entra y el minuto del turno, y avisa.
//
// ─── POR QUÉ TRAMOS FIJOS Y NO "20 MINUTOS DESDE LA ÚLTIMA" ───────────────
//
// Porque así se da la instrucción en un puesto: la ronda de las 16:20, la de
// las 16:40. Con un plazo que se reiniciara al completar cada ronda, quien la
// cierra rápido adelantaría la siguiente y quien se retrasa arrastraría el
// retraso toda la tarde; el recuento final dejaría de corresponder a las
// horas del turno.
//
// ─── POR QUÉ CUENTA LA ZONA EN LA QUE SE ESTÁ AL ABRIRSE LA RONDA ─────────
//
// Si a las 16:20 el guardia está de pie en la bodega, la ronda de las 16:20 ya
// pasó por la bodega: está ahí. Exigirle salir y volver a entrar para que
// cuente sería pedirle un gesto que no significa nada.

/**
 * Cada cuánto pide jefatura la ronda, en minutos de turno.
 *
 * ─── POR QUÉ MEDIA HORA Y NO VEINTE MINUTOS ───────────────────────────────
 *
 * Porque con veinte no cabía la ronda. A la velocidad del recorrido, veinte
 * minutos de turno son veinticinco segundos reales, y pisar las cuatro zonas
 * son cerca de cuarenta metros de caminata: daba justo para la ronda y para
 * nada más. El jugador que se paraba a atender una situación perdía la ronda
 * sin remedio, y las dos cosas que el nivel pide —recorrer y atender— se
 * estorbaban en vez de sumarse.
 *
 * Con treinta caben las dos: la ronda se hace en poco más de media ventana y
 * queda sitio para pararse a mirar. Son cuatro rondas en el turno en vez de
 * seis, y cuatro rondas bien hechas enseñan más que seis a la carrera.
 */
export const MINUTOS_POR_RONDA = 30;

/** Las zonas que tiene que cubrir cada ronda, en el orden en que se listan. */
export const ZONAS_DE_RONDA: readonly IdZona[] = ["entrada", "gondolas", "cajas", "bodega"];

export interface RondaEnCurso {
  /** De 1 a total. */
  numero: number;
  total: number;
  /** Minutos del turno en que abre y en que vence. */
  desde: number;
  hasta: number;
  visitadas: ReadonlySet<IdZona>;
  completa: boolean;
}

export interface RondaCerrada {
  numero: number;
  desde: number;
  hasta: number;
  completa: boolean;
  /** Las zonas que quedaron sin pasar, en el orden de ZONAS_DE_RONDA. */
  faltaron: IdZona[];
}

export interface OpcionesRondas {
  /** Minutos que dura el turno. Salen tantas rondas como quepan enteras. */
  duracion: number;
  /** La zona en la que está el jugador ahora mismo, si ya se sabe. */
  zonaActual: () => IdZona | null;
  /** La ronda en curso cambió: abrió, sumó una zona o se completó. */
  alCambiar: (ronda: RondaEnCurso) => void;
  /** Venció una ronda. Llega también la última, al terminar el turno. */
  alCerrar: (ronda: RondaCerrada) => void;
}

export interface Rondas {
  alEntrarZona(zona: IdZona): void;
  /** Minuto del turno, desde 0. Llega uno a uno, como los da el reloj. */
  alPasarMinuto(minuto: number): void;
  cerradas(): readonly RondaCerrada[];
}

/**
 * Lleva las rondas de un turno.
 *
 * La primera abre en el acto: el turno empieza con una ronda pedida, no con
 * veinte minutos de gracia.
 */
export function crearRondas(opciones: OpcionesRondas): Rondas {
  const total = Math.floor(opciones.duracion / MINUTOS_POR_RONDA);
  const cerradas: RondaCerrada[] = [];
  let enCurso: RondaEnCurso | null = null;

  const completa = (visitadas: ReadonlySet<IdZona>): boolean =>
    ZONAS_DE_RONDA.every((zona) => visitadas.has(zona));

  function abrir(numero: number): void {
    const visitadas = new Set<IdZona>();
    const aqui = opciones.zonaActual();
    if (aqui) visitadas.add(aqui);

    const ronda: RondaEnCurso = {
      numero,
      total,
      desde: (numero - 1) * MINUTOS_POR_RONDA,
      hasta: numero * MINUTOS_POR_RONDA,
      visitadas,
      completa: completa(visitadas),
    };
    enCurso = ronda;
    opciones.alCambiar(ronda);
  }

  if (total > 0) abrir(1);

  return {
    alEntrarZona(zona) {
      // Una ronda completa no suma más: la siguiente empieza a su hora, no
      // antes.
      if (!enCurso || enCurso.completa || enCurso.visitadas.has(zona)) return;
      const visitadas = new Set(enCurso.visitadas).add(zona);
      const ronda: RondaEnCurso = { ...enCurso, visitadas, completa: completa(visitadas) };
      enCurso = ronda;
      opciones.alCambiar(ronda);
    },

    alPasarMinuto(minuto) {
      while (enCurso && minuto >= enCurso.hasta) {
        const vencida: RondaEnCurso = enCurso;
        const cerrada: RondaCerrada = {
          numero: vencida.numero,
          desde: vencida.desde,
          hasta: vencida.hasta,
          completa: vencida.completa,
          faltaron: ZONAS_DE_RONDA.filter((zona) => !vencida.visitadas.has(zona)),
        };
        cerradas.push(cerrada);
        enCurso = null;
        opciones.alCerrar(cerrada);
        if (vencida.numero < total) abrir(vencida.numero + 1);
      }
    },

    cerradas: () => cerradas,
  };
}
