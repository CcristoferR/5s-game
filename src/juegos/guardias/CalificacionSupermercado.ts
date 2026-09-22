import type { Situacion, RespuestaSituacion } from "./SituacionesSupermercado";
import type { RondaCerrada } from "./RondasSupermercado";
import type { TipoError } from "./PanelesSupermercado";
import { NOTA_APROBACION, type FaltaParaRegistrar, type DecisionRegistrada } from "./HistorialTurnos";

// ===========================================================================
// La nota del turno del supermercado
// ===========================================================================
//
// Se parte de cien y se resta por lo que salió mal. Nada suma: acertar es lo
// que se espera de un guardia, y la nota mide cuánto se apartó de eso.
//
// ─── LOS DOS MONTONES ────────────────────────────────────────────────────
//
// Cada error cae en uno de dos lados, y el informe los enseña en dos columnas
// porque son dos problemas distintos que se corrigen distinto:
//
//   · DEJASTE PASAR: hiciste de menos. Había algo que atender —un hurto, una
//     salida tapada, una clienta que preguntaba— y no lo atendiste. Aquí caen
//     también las situaciones reales que ocurrieron sin que las vieras.
//   · ABORDASTE SIN MOTIVO: hiciste de más. Abordaste, señalaste o tocaste lo
//     que no correspondía: un cliente que hablaba por teléfono, uno al que le
//     pediste explicaciones antes de pasar cajas, una mochila que abriste.
//
// De qué lado cae cada opción lo dice la tabla de SituacionesSupermercado
// (campo `error`), no esto: es contenido, y se revisa junto al texto.
//
// ─── POR QUÉ ABORDAR SIN MOTIVO PESA MÁS ─────────────────────────────────
//
// Porque es lo que pasa en la vida real. Un hurto que se escapa es una
// pérdida para el local. Abordar a un inocente es otra cosa: es tratar de
// ladrón a alguien que no hizo nada, delante de todos, y eso termina en un
// reclamo, en una denuncia contra el guardia o en un cliente que no vuelve.
// El guardia que interviene siempre acierta con los ladrones y se equivoca
// con todos los demás, y lo que el nivel quiere enseñar es justo lo contrario
// del instinto de atrapar al malo: mirar antes de actuar.
//
// Las inocentes que no llegaste a ver no cuentan: no pasó nada, así que no
// hay nada que perderse.

/** Lo que resta cada cosa. */
export const DESCUENTOS = {
  /** Una situación real que no atendiste como correspondía, o que no viste. */
  dejarPasar: 10,
  /** Abordar, señalar o tocar sin motivo. Pesa más: ver arriba. */
  sinMotivo: 15,
  /**
   * Una ronda que no pasó por las cuatro zonas.
   *
   * Poco, y a propósito: el nivel se llama "rondas de verificación" y no
   * contarlas dejaría la ronda sin consecuencia, pero lo que el turno enseña
   * de verdad son las decisiones. Cuatro rondas perdidas pesan lo mismo que
   * dos hurtos dejados pasar.
   */
  rondaIncompleta: 5,
} as const;

/** Un error del turno, tal como sale en su columna del informe. */
export interface ErrorTurno {
  /** Minuto del turno en que se vio, o en que empezó si no se vio. */
  minuto: number;
  actividad: string;
  /** Lo que hiciste mal, en una línea. */
  enBreve: string;
  /** Por qué, entero: la explicación de la opción, o qué pasó si no la viste. */
  porque: string;
}

export interface CalificacionTurno {
  nota: number;
  aprobado: boolean;
  /** Situaciones reales bien resueltas, de las que llegaron a ocurrir. */
  reales: { bien: number; total: number };
  dejastePasar: ErrorTurno[];
  sinMotivo: ErrorTurno[];
  rondas: { completas: number; total: number };
  /** Lo que resume el turno en una frase. */
  frase: string;
  /** Para el historial: una falta por error, y una por ronda incompleta. */
  faltas: FaltaParaRegistrar[];
  /** Para el historial: todas las decisiones, bien y mal. */
  decisiones: DecisionRegistrada[];
}

/**
 * Pone la nota del turno.
 *
 * @param ocurridas   Las situaciones que llegaron a pasar. Una encadenada sin
 *                    su requisito no está: no es que no la vieras, es que no
 *                    ocurrió, y no puede contar en contra.
 * @param respuestas  Lo que el jugador eligió en cada una que vio.
 * @param rondas      Las rondas del turno, ya cerradas.
 */
export function calificarTurno(
  ocurridas: readonly Situacion[],
  respuestas: readonly RespuestaSituacion[],
  rondas: readonly RondaCerrada[]
): CalificacionTurno {
  const lados: Record<TipoError, ErrorTurno[]> = { dejarPasar: [], sinMotivo: [] };
  const decisiones: DecisionRegistrada[] = [];
  let realesBien = 0;
  let realesTotal = 0;

  for (const situacion of ocurridas) {
    const respuesta = respuestas.find((r) => r.situacion.id === situacion.id);
    if (!situacion.inocente) realesTotal++;

    if (!respuesta) {
      // No la vio. Si era inocente no pasó nada; si era real, pasó igual.
      if (!situacion.inocente) {
        lados.dejarPasar.push({
          minuto: situacion.minuto,
          actividad: situacion.actividad,
          enBreve: "No la viste: pasó igual.",
          porque: situacion.siSePierde ?? "Ocurrió mientras no estabas mirando.",
        });
      }
      continue;
    }

    const { opcion, correspondia, minuto } = respuesta;
    decisiones.push({
      situacion: situacion.id,
      actividad: situacion.actividad,
      minuto,
      eligio: opcion.texto,
      correspondia: correspondia.texto,
      correcta: opcion.correcta,
      error: opcion.correcta ? undefined : opcion.error,
    });

    if (opcion.correcta) {
      if (!situacion.inocente) realesBien++;
      continue;
    }
    // Una incorrecta sin lado asignado es un olvido de la tabla, no una
    // tercera categoría: se cuenta como dejar pasar, que es lo que menos
    // castiga, antes que inventarle un peso.
    lados[opcion.error ?? "dejarPasar"].push({
      minuto,
      actividad: situacion.actividad,
      enBreve: opcion.enBreve ?? opcion.texto,
      porque: opcion.explicacion,
    });
  }

  const incompletas = rondas.filter((r) => !r.completa);
  const descuento =
    lados.dejarPasar.length * DESCUENTOS.dejarPasar +
    lados.sinMotivo.length * DESCUENTOS.sinMotivo +
    incompletas.length * DESCUENTOS.rondaIncompleta;
  const nota = Math.max(0, 100 - descuento);

  const porMinuto = (a: ErrorTurno, b: ErrorTurno): number => a.minuto - b.minuto;
  lados.dejarPasar.sort(porMinuto);
  lados.sinMotivo.sort(porMinuto);

  const faltas: FaltaParaRegistrar[] = [
    ...lados.dejarPasar.map((e) => ({
      tipo: "dejo_pasar",
      descripcion: `${e.actividad} — ${e.enBreve}`,
      fundamento: e.porque,
    })),
    ...lados.sinMotivo.map((e) => ({
      tipo: "abordo_sin_motivo",
      descripcion: `${e.actividad} — ${e.enBreve}`,
      fundamento: e.porque,
    })),
    ...incompletas.map((r) => ({
      tipo: "ronda_incompleta",
      descripcion: `Ronda ${r.numero} incompleta`,
      fundamento: "Una ronda cuenta si pasa por las cuatro zonas antes de que se cumplan sus minutos.",
    })),
  ];

  return {
    nota,
    aprobado: nota >= NOTA_APROBACION,
    reales: { bien: realesBien, total: realesTotal },
    dejastePasar: lados.dejarPasar,
    sinMotivo: lados.sinMotivo,
    rondas: { completas: rondas.length - incompletas.length, total: rondas.length },
    frase: resumir(realesBien, realesTotal, lados.sinMotivo.length),
    faltas,
    decisiones,
  };
}

/**
 * La frase del informe: cuántas reales resolviste y, si abordaste sin motivo,
 * cuántas veces. Las dos mitades a la vez, porque una sin la otra engaña: tres
 * de tres con dos inocentes abordados no es un buen turno.
 */
function resumir(bien: number, total: number, sinMotivo: number): string {
  const primera = `Detectaste ${bien} de ${total} situaciones reales.`;
  if (sinMotivo === 0) {
    return bien === total
      ? `${primera} Y no abordaste a nadie sin motivo.`
      : `${primera} No abordaste a nadie sin motivo, pero se te pasaron ${total - bien}.`;
  }
  const veces = sinMotivo === 1 ? "una vez" : `${sinMotivo} veces`;
  return `${primera} Pero abordaste sin motivo ${veces}.`;
}
