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
 * Hasta dónde llega la calma: el minuto en que termina la mañana normal.
 *
 * Cuarenta y cinco minutos de reloj son unos dos minutos reales, que es lo
 * que pide el nivel: tiempo para situarse, mirar la sala y acostumbrarse a
 * ella, de modo que lo que venga después llegue sin aviso. De momento el
 * reloj se detiene aquí; lo que pasa en este minuto es la etapa siguiente.
 */
export const FIN_DE_LA_CALMA = 45;

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
