import { horaDe } from "./LibroNovedades";
import { MINUTOS_POR_RONDA } from "./RondasSupermercado";
import type { BriefingTurno } from "./PanelesSupermercado";

// ===========================================================================
// El turno del supermercado: horario y lo que dice jefatura
// ===========================================================================
//
// Los datos del turno, aparte de la lógica y de la pantalla, como hace
// SucesosCondominio con el libro: cambiar una hora o un texto no obliga a
// tocar el recorrido. Todas las horas que se muestran —reloj, tarjeta,
// recuento y pantalla de carga— salen de las dos constantes de abajo.

/** Las 16:00 en minutos desde medianoche: el turno de tarde del local. */
export const INICIO_TURNO = 16 * 60;

/**
 * Dos horas: seis rondas.
 *
 * Estuvo en ocho horas, como el condominio, y eran veinticuatro rondas
 * seguidas —siete minutos reales caminando sin parar— antes de que el nivel
 * tenga una sola situación que atender. Mientras se construye, un turno corto
 * se juega entero en cada prueba. Cuando lleguen los sucesos, el turno crece
 * desde aquí y todo lo demás se ajusta solo.
 */
export const DURACION_TURNO = 2 * 60;

/**
 * Cuántos minutos de reloj vale cada minuto del turno.
 *
 * ─── POR QUÉ DOS ─────────────────────────────────────────────────────────
 *
 * Para que el turno vaya de las 16:00 a las 20:00 —de la tarde a la noche,
 * con el atardecer por las vidrieras— sin cambiar nada de cómo se juega.
 * Todo lo que se mide por dentro —las ventanas de las situaciones, lo que
 * tarda cada ronda, lo que camina la gente— sigue en los mismos minutos de
 * turno y dura los mismos segundos reales. Lo único que cambia es la hora
 * que marca el reloj: cada minuto de turno son dos de reloj.
 *
 * Por eso todo lo que se enseña en pantalla pasa por horaDelTurno o por
 * MINUTOS_RONDA_EN_RELOJ, y nada escribe un minuto de turno a pelo.
 */
export const ESCALA_HORARIA = 2;

/** Cada cuánto se abre una ronda, en minutos de reloj: lo que lee el jugador. */
export const MINUTOS_RONDA_EN_RELOJ = MINUTOS_POR_RONDA * ESCALA_HORARIA;

/**
 * Minuto del turno a hora de reloj.
 *
 * Igual que horaDe, salvo a medianoche: un turno que termina entonces termina
 * "a las 24:00", que es como se escribe un horario de turno, y no "a las
 * 00:00".
 */
export function horaDelTurno(minuto: number): string {
  const total = INICIO_TURNO + Math.round(minuto * ESCALA_HORARIA);
  return total === 24 * 60 ? "24:00" : horaDe(total);
}

/** La hora del día en horas con decimales (16,5 son las 16:30). Para la luz de fuera. */
export function horaDelDia(minuto: number): number {
  return (INICIO_TURNO + minuto * ESCALA_HORARIA) / 60;
}

/** El rótulo chico bajo la hora. */
export const ETIQUETA_TURNO = `Turno ${horaDelTurno(0)} a ${horaDelTurno(DURACION_TURNO)} horas`;

/**
 * La tarjeta del inicio.
 *
 * El titular es la instrucción tal cual se da en el puesto —turno, lugar y
 * quién la pide—, y los campos la desglosan como la cabecera del condominio.
 * Así se sabe a qué se vino y quién lo mandó antes de dar el primer paso.
 */
export const BRIEFING_TURNO: BriefingTurno = {
  rotulo: `${horaDelTurno(0)} · INICIO DEL TURNO`,
  titulo:
    `Turno de tarde. Sala de ventas. Jefatura solicita rondas de verificación cada ${MINUTOS_RONDA_EN_RELOJ} minutos.`,
  campos: [
    ["HORARIO", `${horaDelTurno(0)} a ${horaDelTurno(DURACION_TURNO)} horas`],
    ["SOLICITA", "Jefatura"],
    ["FRECUENCIA", `Una ronda cada ${MINUTOS_RONDA_EN_RELOJ} minutos`],
    ["ZONAS", "Entrada, góndolas, cajas y bodega"],
    // Corto a propósito: la fila tiene un renglón de alto, y más largo se
    // partía en dos y el segundo se montaba sobre la nota. ESPACIO va en la nota.
    ["CONTROLES", "WASD o flechas: caminar · arrastrar: mirar · ESC: salir"],
  ],
  // ─── LA NOTA ES LAS INSTRUCCIONES DEL JUEGO ─────────────────────────────
  //
  // Para quien no lo ha jugado nunca, esto es todo lo que va a leer antes de
  // empezar, así que dice las tres cosas que no se pueden adivinar: que la
  // ronda es la lista de arriba, que Central te dice dónde mirar, y que lo
  // que hay que hacer es QUEDARSE MIRANDO a la persona. Y avisa de lo que
  // cambia todo: que no todo lo que te mandan a mirar es un delito.
  nota:
    `Ronda: pasa por las cuatro zonas antes de que se cumplan sus ${MINUTOS_RONDA_EN_RELOJ} minutos; la lista va arriba. ` +
    "Cuando Central te avise por radio (arriba a la izquierda), ve a ese sitio y quédate mirando a la " +
    "persona: la barra de abajo se llena y el momento se congela para que decidas. No todo lo que te " +
    "mandan a mirar es un delito. Si no llegas a tiempo, pasa igual y te enteras después. " +
    "ESPACIO adelanta el turno hasta el siguiente aviso.",
  boton: "Comenzar el turno",
};

/** El pie del recuento: qué significa cada color de la franja. */
export const NOTA_RECUENTO =
  `En verde, las rondas en que pasaste por las cuatro zonas dentro de sus ${MINUTOS_RONDA_EN_RELOJ} minutos; ` +
  "en rojo, las que quedaron a medias.";

/** El pie de la tarjeta de las situaciones. */
export const NOTA_RECUENTO_SITUACIONES =
  "Tres de ellas eran gente haciendo cosas normales: perdértelas no cuenta en contra, porque no " +
  "pasó nada. Las demás pasan igual aunque no estés, y por eso Central te las cuenta después.";
