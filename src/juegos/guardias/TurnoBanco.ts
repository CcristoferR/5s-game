import { horaDe } from "./LibroNovedades";
import type { BriefingTurno } from "./PanelesSupermercado";

// ===========================================================================
// El turno del banco: horario, ritmo y lo que dice la jefatura
// ===========================================================================
//
// Los datos, aparte del puesto, como hace TurnoSupermercado: cambiar una hora
// o un texto no obliga a tocar la escena. Todas las horas que se muestran
// —reloj, tarjeta— salen de las constantes de abajo.

/** Las 09:00 en minutos desde medianoche: abre la sucursal. */
export const INICIO_TURNO = 9 * 60;

/** Las 14:00: cierra la atención de público. Es lo que dice el horario. */
export const FIN_ATENCION = 14 * 60;

/**
 * Minutos de reloj por segundo real.
 *
 * ─── POR QUÉ ASÍ DE LENTO ─────────────────────────────────────────────────
 *
 * Porque aquí no hay que ir a ningún sitio y lo que se juega es estar. El
 * reloj tiene que moverse —que se vea que el turno corre, minuto a minuto—
 * pero sin que la mañana se escurra: a 0,4 un minuto de reloj son dos
 * segundos y medio, lo que tarda un cliente en cruzar de la puerta a la fila.
 */
export const MINUTOS_POR_SEGUNDO = 0.4;

/**
 * Hasta dónde llega la calma: el minuto en que termina la mañana normal y
 * empieza el asalto (ver AsaltoBanco).
 *
 * Cuarenta y cinco minutos de reloj son unos dos minutos reales, que es lo
 * que pide el nivel: tiempo para situarse, mirar la sala y acostumbrarse a
 * ella, de modo que lo que venga después llegue sin aviso.
 */
export const FIN_DE_LA_CALMA = 45;

/**
 * Minutos de reloj por segundo real durante el asalto: uno por minuto. Lo que
 * dura un asalto es lo que dura de verdad, y el reloj no puede decir que pasó
 * media hora mientras alguien apuntaba a la sala.
 */
export const RITMO_ASALTO = 1 / 60;

/**
 * Lo que tarda Carabineros en llegar, desde que el asalto termina: la
 * pantalla va a negro y vuelve con ellos dentro, veinte minutos más tarde en
 * el reloj. Es lo que dice el rótulo del fundido (ver PuestoBanco).
 */
export const MINUTOS_HASTA_CARABINEROS = 20;

/**
 * Último minuto del turno que existe por ahora: las 10:30. Da para el asalto
 * (9:45), la llegada de Carabineros veinte minutos después y la declaración.
 */
export const MINUTO_FINAL = 90;

/**
 * ─── PRUEBA RÁPIDA — PONER EN false AL TERMINAR DE PROBAR ───────────────
 *
 * Mientras se construye el asalto, esperar los dos minutos de mañana
 * tranquila en cada prueba es perder el tiempo. Con esto en true, al cerrar
 * la tarjeta del inicio la mañana se corre de golpe hasta PRUEBA_RAPIDA_DESDE
 * —la gente y la pantalla también, no solo el reloj— y desde ahí se juega:
 * lo último de la mañana normal y, medio minuto después, el asalto.
 *
 * En false, el turno es el de verdad: dos minutos de mañana y el asalto sin
 * aviso.
 */
export const PRUEBA_RAPIDA = true;

/**
 * Hasta dónde corre la mañana la prueba rápida: las 9:34, veintisiete
 * segundos antes del asalto. Con eso se ve a un cliente salir hacia la puerta,
 * a otro irse de la caja 2, el tin-tón de las 9:37 con la señora de rojo
 * levantándose para ir a la caja, y la sala ya quieta cuando entran.
 */
export const PRUEBA_RAPIDA_DESDE = 34;

/** Minuto del turno a hora de reloj. */
export function horaDelTurno(minuto: number): string {
  return horaDe(INICIO_TURNO + Math.floor(minuto));
}

/** El rótulo chico bajo la hora. */
export const ETIQUETA_TURNO = `Turno ${horaDe(INICIO_TURNO)} a ${horaDe(FIN_ATENCION)} horas`;

/**
 * La tarjeta del inicio.
 *
 * El formato del súper: la instrucción tal cual se da en el puesto, y los
 * campos que la desglosan. Aquí lo que cambia es el tipo de puesto: FIJO. En
 * el supermercado se recorría la sala; en el banco el guardia está en el
 * acceso y desde ahí vigila. Eso es lo primero que tiene que quedar claro.
 *
 * No anticipa nada de lo que va a pasar. Dice lo que se hace en ese puesto
 * cualquier mañana: mirar quién entra, quién espera y quién atiende.
 */
export const BRIEFING_TURNO: BriefingTurno = {
  rotulo: `${horaDe(INICIO_TURNO)} · APERTURA DE LA SUCURSAL`,
  titulo:
    "Turno de mañana. Sucursal bancaria. Puesto fijo en el acceso principal durante la atención de público.",
  campos: [
    ["HORARIO", `${horaDe(INICIO_TURNO)} a ${horaDe(FIN_ATENCION)} horas`],
    ["PUESTO", "Acceso principal, junto a la puerta"],
    ["SOLICITA", "Jefatura de la sucursal"],
    ["CONSIGNA", "Vigilar el ingreso y la sala sin abandonar el puesto"],
    // Corto: la fila tiene un renglón de alto (ver el briefing del súper).
    ["CONTROLES", "arrastrar: mirar alrededor · ESC: pausa"],
  ],
  // ─── LA NOTA ES LAS INSTRUCCIONES DEL JUEGO ─────────────────────────────
  //
  // Lo que no se puede adivinar: que aquí no se camina, y que el trabajo de
  // este puesto es estar y mirar. Nada más: el nivel enseña lo demás.
  nota:
    "En este puesto no hay rondas: te quedas junto a la puerta y desde ahí se ve toda la sala. " +
    "Mira a quien entra, a quien espera y a quien atiende en las cajas. Si ocurre algo, el turno " +
    "se detiene para que decidas qué hacer.",
  boton: "Comenzar el turno",
};
