import { MOMENTOS, type DecisionBanco, type FaltaBanco } from "./MomentosBanco";
import type { RespuestaDeclaracion } from "./DeclaracionBanco";
import { NOTA_APROBACION, type FaltaParaRegistrar, type DecisionRegistrada } from "./HistorialTurnos";

// ===========================================================================
// La nota del turno del banco
// ===========================================================================
//
// Como en el resto del curso: se parte de cien y se resta por lo que salió
// mal. Acertar es lo que se espera de un guardia; la nota mide cuánto se
// apartó de eso.
//
// ─── QUÉ PESA MÁS ─────────────────────────────────────────────────────────
//
// Lo que el nivel enseña, en su orden: primero no exponerse, después mirar, y
// al final declarar solo lo que se vio.
//
//   · ARRIESGAR pesa más que nada. Echar mano a la radio con el arma
//     apuntando, encarar al sujeto, perseguirlos: en un asalto, hacerse el
//     héroe pone en peligro al guardia y a toda la sala. Dos veces, y el turno
//     no se aprueba.
//   · INVENTAR un dato en la declaración es lo segundo. Un hecho que no se vio,
//     dicho como visto, puede mandar la investigación hacia otro lado. Es la
//     misma falta que en el libro del condominio, donde también es la mayor.
//   · DESCUIDAR, ya pasado el asalto —no avisar, tocar el lugar, dejar irse a
//     una testigo sin sus datos—, y OPINAR en la declaración pesan menos: son
//     errores de procedimiento, no de peligro ni de verdad.
//   · Lo que NO SE ALCANZÓ A VER resta poco, y con tope: mirar es parte del
//     trabajo, pero perderse un detalle no es un error del mismo orden que
//     inventarlo. El tope evita que alguien que pasó el asalto en el suelo
//     pierda dos veces por la misma causa.

/** Lo que resta cada cosa. */
export const DESCUENTOS_BANCO = {
  /** Una decisión que lo expuso a él o a la sala. */
  arriesgar: 25,
  /** Un dato inventado en la declaración. */
  inventa: 20,
  /** Un descuido de procedimiento ya pasado el asalto. */
  descuidar: 12,
  /** Una opinión en la declaración. */
  opina: 10,
  /** Cada detalle por el que preguntaron y no se alcanzó a ver… */
  noObservado: 3,
  /** …hasta este tope. */
  topeNoObservado: 15,
} as const;

export interface CalificacionBanco {
  nota: number;
  aprobado: boolean;
  /** Para el historial: una por error, y una por cada detalle no visto. */
  faltas: FaltaParaRegistrar[];
  /** Para el historial: las decisiones del asalto, bien y mal. */
  decisiones: DecisionRegistrada[];
}

const FUNDAMENTO_OPINA =
  "En una declaración se cuenta lo que se vio, no lo que se cree o se supone de alguien.";
const FUNDAMENTO_INVENTA =
  "Un dato que no se vio, dicho como visto, puede desviar la investigación.";

/**
 * Pone la nota del turno.
 *
 * @param decisiones  Lo que se eligió en cada momento del asalto. Un momento
 *                    que no llegó a ocurrir no está, y no cuenta.
 * @param respuestas  La declaración, pregunta por pregunta.
 */
export function calificarTurnoBanco(
  decisiones: readonly DecisionBanco[],
  respuestas: readonly RespuestaDeclaracion[]
): CalificacionBanco {
  const faltas: FaltaParaRegistrar[] = [];
  const registro: DecisionRegistrada[] = [];
  const errores: Record<FaltaBanco, number> = { arriesgar: 0, descuidar: 0 };

  for (const d of decisiones) {
    const momento = MOMENTOS[d.momento];
    const buena = momento.opciones.find((o) => o.correcta);
    // Si el momento lo pilló en el suelo, se leyó la versión de ahí abajo: lo
    // que correspondía se anota también en esa versión.
    const enElSuelo = momento.opciones.some((o) => o.enElSuelo?.texto === d.opcion.texto);
    const correspondia = (enElSuelo && buena?.enElSuelo?.texto) || buena?.texto || "";

    // Una incorrecta sin lado asignado es un olvido de la tabla, no una
    // tercera categoría: se cuenta como descuido, lo que menos castiga de las
    // dos, antes que inventarle un peso.
    const lado: FaltaBanco | undefined = d.opcion.correcta ? undefined : (d.opcion.falta ?? "descuidar");

    registro.push({
      situacion: d.momento,
      actividad: momento.actividad,
      minuto: d.minuto,
      eligio: d.opcion.texto,
      correspondia,
      correcta: d.opcion.correcta,
      error: lado,
    });

    if (!lado) continue;
    errores[lado] += 1;
    faltas.push({
      tipo: lado === "arriesgar" ? "se_arriesgo" : "descuido",
      descripcion: `${momento.actividad} — ${d.opcion.enBreve ?? d.opcion.texto}`,
      fundamento: d.opcion.explicacion,
    });
  }

  let opiniones = 0;
  let inventadas = 0;
  let noVistos = 0;
  for (const r of respuestas) {
    if (r.tipo === "opina") {
      opiniones += 1;
      faltas.push({ tipo: "opinion_en_declaracion", descripcion: `${r.tema}: «${r.texto}»`, fundamento: FUNDAMENTO_OPINA });
    } else if (r.tipo === "inventa") {
      inventadas += 1;
      faltas.push({ tipo: "dato_inventado", descripcion: `${r.tema}: «${r.texto}»`, fundamento: FUNDAMENTO_INVENTA });
    }
    for (const f of r.faltan) {
      noVistos += 1;
      faltas.push({
        tipo: "detalle_no_observado",
        descripcion: f.que ? `${r.tema}: ${f.que}` : r.tema,
        fundamento: `No se pudo declarar: ${f.porQue}.`,
      });
    }
  }

  const descuento =
    errores.arriesgar * DESCUENTOS_BANCO.arriesgar +
    errores.descuidar * DESCUENTOS_BANCO.descuidar +
    inventadas * DESCUENTOS_BANCO.inventa +
    opiniones * DESCUENTOS_BANCO.opina +
    Math.min(DESCUENTOS_BANCO.topeNoObservado, noVistos * DESCUENTOS_BANCO.noObservado);
  const nota = Math.max(0, 100 - descuento);

  return { nota, aprobado: nota >= NOTA_APROBACION, faltas, decisiones: registro };
}
