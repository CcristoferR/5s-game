import { FRASES } from "./AsaltoBanco";
import type { DatoAsalto, MotivoNoVisto, ResumenObservacion } from "./ObservacionBanco";

// ===========================================================================
// La declaración: lo que pregunta Carabineros y lo que se puede contestar
// ===========================================================================
//
// Los datos aparte de la escena, como MomentosBanco: cambiar una pregunta o
// una respuesta no obliga a tocar el puesto ni el panel.
//
// ─── TRES MANERAS DE CONTESTAR ────────────────────────────────────────────
//
// Cada pregunta trae tres respuestas, y solo una sirve:
//
//   · describe: lo que se vio, dicho como se ve —"contextura gruesa, chaqueta
//     oscura, gorro de lana negro, aproximadamente 1,75"—. Hechos que se
//     pueden comprobar.
//   · opina: una apreciación —"de aspecto delincuencial"—. No describe a
//     nadie, y un fiscal la descarta.
//   · inventa: un dato que no se tiene —"una pistola nueve milímetros"—. Se
//     vio un arma, pero no cuál. Suena preciso, y por eso es la peor: se toma
//     como cierto.
//
// Es lo mismo que el libro del condominio, aplicado al retrato hablado.
//
// ─── Y LO QUE NO SE VIO ───────────────────────────────────────────────────
//
// Cada pregunta depende de ciertos datos del asalto (ver ObservacionBanco).
// Si no se vio ninguno, la respuesta que describe no está: el panel dice
// "No puede responder: no observó ese detalle", con el motivo —en el suelo o
// mirando a otra parte—, y la que sirve pasa a ser la honesta: decir que no
// se vio. Si se vio una parte, se describe esa parte y se dice qué faltó.
// Así el primer tiempo del nivel se paga en el segundo.

/** Cómo se contestó. Las dos primeras sirven; las otras dos no. */
export type TipoRespuesta = "describe" | "noVio" | "opina" | "inventa";

export type IdPregunta = "cuantos" | "primero" | "arma" | "segundo" | "huida" | "dichos";

/** Un trozo de la descripción: lo que hay que haber visto y cómo se dice. */
interface Parte {
  dato: DatoAsalto;
  /** Cómo entra en la frase, en minúscula: "contextura gruesa, aproximadamente 1,75". */
  dice: string;
  /** Cómo se nombra si faltó: "la contextura". */
  falta: string;
}

interface PreguntaDeclaracion {
  id: IdPregunta;
  /** Para el documento: "CUÁNTOS ERAN". */
  tema: string;
  /** Lo que pregunta el sargento, tal cual. */
  pregunta: string;
  /** Lo que hace falta haber visto. Vacío: se contesta con lo que se oyó. */
  partes: readonly Parte[];
  /** La respuesta que describe, con todo visto. Con partes, se arma de ellas. */
  describe?: string;
  noVio: string;
  opina: string;
  inventa: string;
  porQue: {
    describe: string;
    /** Si se vio solo una parte: por qué eso también es lo correcto. */
    parcial?: string;
    noVio: string;
    opina: string;
    inventa: string;
  };
  /**
   * Dónde va cada respuesta, de la A a la C. "buena" es la que describe, o la
   * honesta si no se vio. Fijo y distinto en cada pregunta: la buena no puede
   * caer siempre en el mismo sitio.
   */
  orden: readonly ["buena" | "opina" | "inventa", "buena" | "opina" | "inventa", "buena" | "opina" | "inventa"];
}

/** Por qué no se vio, dicho al jugador. */
const MOTIVO: Record<MotivoNoVisto, string> = {
  suelo: "estabas en el suelo",
  otraParte: "mirabas hacia otra parte",
};

const PARCIAL =
  "Es lo que viste, y dices qué no alcanzaste a ver. Eso es exactamente lo que se espera de un testigo: " +
  "lo que sabe, y hasta dónde lo sabe.";

const PREGUNTAS: readonly PreguntaDeclaracion[] = [
  // ─── 1 · CUÁNTOS ERAN ───────────────────────────────────────────────────
  {
    id: "cuantos",
    tema: "Cuántos eran",
    pregunta: "¿Cuántos eran?",
    partes: [{ dato: "cuantos", dice: "Eran dos hombres: uno con un arma y el otro con un bolso.", falta: "" }],
    noVio: "No sé bien cuántos eran: no alcancé a verlos a los dos.",
    opina: "Eran dos, pero seguro que había otro afuera esperándolos en un auto.",
    inventa: "Eran tres: dos entraron y un tercero se quedó vigilando la puerta.",
    porQue: {
      describe:
        "Es un hecho y lo viste. Cuántos eran es lo primero que necesita Carabineros para saber a quién buscar.",
      noVio:
        "Correcto. No los viste a los dos, y decirlo así es lo que sirve: «no lo sé» es una respuesta válida " +
        "en una declaración; un número supuesto, no.",
      opina:
        "«Seguro que había otro afuera» es una suposición: no lo viste. Una sospecha se puede mencionar como " +
        "lo que es —una duda—, nunca como un hecho.",
      inventa:
        "No había un tercero en la puerta. Un dato falso desvía la búsqueda y, cuando se descubre, le quita " +
        "valor a todo lo demás que declaraste.",
    },
    orden: ["opina", "buena", "inventa"],
  },

  // ─── 2 · EL PRIMERO ─────────────────────────────────────────────────────
  //
  // Es la pregunta del ejemplo del nivel, respuesta por respuesta.
  {
    id: "primero",
    tema: "El sujeto del arma",
    pregunta: "Descríbame al primero, al que tenía el arma.",
    partes: [
      { dato: "s1Cuerpo", dice: "contextura gruesa, aproximadamente 1,75", falta: "la contextura" },
      { dato: "s1Ropa", dice: "chaqueta oscura y jeans", falta: "la ropa" },
      { dato: "s1Cara", dice: "gorro de lana negro, piel morena, sin barba", falta: "la cara" },
    ],
    noVio: "No lo alcancé a ver bien, así que no puedo describirlo.",
    opina: "De aspecto delincuencial, se notaba que era de los que andan robando.",
    inventa: "Tenía un tatuaje en el cuello y una cicatriz en la mejilla izquierda.",
    porQue: {
      describe:
        "Contextura, estatura aproximada, ropa y lo que llevaba en la cabeza: hechos que se pueden comprobar, " +
        "dichos como se ven. Con esto se arma un retrato hablado.",
      parcial: PARCIAL,
      noVio:
        "Correcto. Si no lo viste bien, cualquier descripción sería inventada. Decirlo es honesto y le ahorra " +
        "a Carabineros buscar a alguien que no existe.",
      opina:
        "«Aspecto delincuencial» no describe a nadie: es un juicio, y además un prejuicio. No sirve para " +
        "identificarlo y un fiscal lo descarta de inmediato.",
      inventa:
        "No tenía tatuajes ni cicatrices a la vista. Un rasgo inventado es lo peor que puede tener un retrato " +
        "hablado: puede terminar con otra persona detenida.",
    },
    orden: ["buena", "opina", "inventa"],
  },

  // ─── 3 · EL ARMA ────────────────────────────────────────────────────────
  {
    id: "arma",
    tema: "El arma",
    pregunta: "¿Qué arma tenía?",
    partes: [{ dato: "s1Arma", dice: "Una pistola negra, en la mano derecha. De qué tipo era, no lo sé.", falta: "" }],
    noVio: "No alcancé a ver bien el arma; no podría decir cómo era.",
    opina: "Un arma de verdad: por cómo la tomaba, se notaba que sabía usarla.",
    inventa: "Llevaba una pistola nueve milímetros, con el cargador puesto.",
    porQue: {
      describe:
        "Lo que viste: una pistola, negra, en la derecha. Y dices lo que no sabes —el tipo—, que vale tanto " +
        "como lo que sabes.",
      noVio:
        "Correcto. No la viste bien, y no hay que rellenar el hueco: lo que necesita Carabineros de ti es lo " +
        "que tú viste, no lo que cualquiera supondría.",
      opina:
        "Que «sabía usarla» es una impresión tuya, no algo que se vea. En una declaración se cuenta lo que " +
        "pasó, no lo que se cree de quien lo hizo.",
      inventa:
        "Viste un arma, pero no sabes cuál era. «Nueve milímetros» suena preciso y por eso es peor: " +
        "Carabineros lo va a tomar como cierto.",
    },
    orden: ["inventa", "opina", "buena"],
  },

  // ─── 4 · EL SEGUNDO ─────────────────────────────────────────────────────
  {
    id: "segundo",
    tema: "El sujeto del bolso",
    pregunta: "¿Y el segundo? El que fue a la caja.",
    partes: [
      { dato: "s2Cuerpo", dice: "delgado, cerca de 1,68, zapatillas blancas", falta: "la contextura" },
      { dato: "s2Ropa", dice: "polerón gris con la capucha puesta y jeans", falta: "la ropa" },
      { dato: "s2Bolso", dice: "un bolso negro de lona", falta: "el bolso" },
    ],
    noVio: "No lo alcancé a ver bien; no podría describirlo sin inventar.",
    opina: "Se veía joven y nervioso; seguro que era primera vez que robaba.",
    inventa: "Era rubio, de ojos claros, y llevaba una mochila roja además del bolso.",
    porQue: {
      describe:
        "Contextura, estatura, ropa, zapatillas y el bolso: todo a la vista y comprobable. Y por separado del " +
        "primero, que es lo que permite distinguirlos.",
      parcial: PARCIAL,
      noVio:
        "Correcto. Si no lo viste bien, lo que corresponde es decirlo. Un testigo que admite lo que no sabe " +
        "es más creíble en todo lo demás.",
      opina:
        "Joven, nervioso, primerizo: impresiones. No se ven, se suponen. No ayudan a encontrarlo y le restan " +
        "seriedad a tu declaración.",
      inventa:
        "Llevaba la capucha puesta: el pelo no se le veía. Y no tenía mochila. Inventar un rasgo desvía la " +
        "búsqueda hacia gente que no tuvo nada que ver.",
    },
    orden: ["opina", "inventa", "buena"],
  },

  // ─── 5 · HACIA DÓNDE ────────────────────────────────────────────────────
  {
    id: "huida",
    tema: "Hacia dónde se fueron",
    pregunta: "¿Hacia dónde se fueron?",
    partes: [
      {
        dato: "huida",
        dice: "Salieron corriendo por la puerta, doblaron a la izquierda y siguieron por el costado del banco.",
        falta: "",
      },
    ],
    noVio: "No lo vi. Los escuché salir corriendo por la puerta, pero no sé hacia dónde.",
    opina: "Seguro los esperaba un auto a la vuelta; se notaba que lo tenían planeado.",
    inventa: "Se subieron a un auto blanco que los esperaba frente a la puerta.",
    porQue: {
      describe:
        "Por dónde salieron y hacia qué lado doblaron: con eso Carabineros sabe dónde empezar a buscar y qué " +
        "cámaras revisar.",
      noVio:
        "Correcto. No los viste irse y lo dices, y aportas lo que sí sabes: que salieron corriendo por la " +
        "puerta. Lo que se oyó también es parte de una declaración.",
      opina:
        "Un auto esperando «a la vuelta» es lo que te imaginas, no lo que viste. Dicho como hecho, manda a " +
        "buscar un auto que quizás no existe.",
      inventa:
        "No se subieron a ningún auto: se fueron a pie por el costado. Un auto inventado, con color y todo, " +
        "es una pista falsa perfecta.",
    },
    orden: ["buena", "inventa", "opina"],
  },

  // ─── 6 · LO QUE DIJERON ─────────────────────────────────────────────────
  //
  // Sin partes: lo que se dijo se oye aunque no se mire, y esta se puede
  // contestar hasta desde el suelo. Las frases son las de AsaltoBanco.
  {
    id: "dichos",
    tema: "Lo que dijeron",
    pregunta: "¿Qué dijeron? ¿Algo que le llamara la atención?",
    partes: [],
    describe: `Que era un asalto y todos al suelo; al cajero, la plata en el bolso; al irse, «${FRASES.salida}».`,
    noVio: "",
    opina: "Hablaban como gente de población; por el acento eran de por aquí cerca.",
    inventa: "Uno le dijo al otro por su nombre: «¡Vamos, Kevin!». Eso lo oí claro.",
    porQue: {
      describe:
        "Las palabras que se dijeron, tal cual. Lo que dicen los asaltantes sirve —las órdenes, cómo se " +
        "hablan—, y se oye aunque no se esté mirando: esta la puede contestar hasta quien estaba en el suelo.",
      noVio: "",
      opina:
        "Adivinar de dónde son por cómo hablan es un prejuicio, no un dato. No ayuda a encontrarlos y puede " +
        "apuntar a gente inocente.",
      inventa:
        "Nadie dijo un nombre. Un nombre inventado es de las pistas falsas más dañinas: Carabineros va a " +
        "buscar a alguien que se llame así.",
    },
    orden: ["inventa", "buena", "opina"],
  },
];

// ─── Lo que ve el panel ────────────────────────────────────────────────────

export interface OpcionDeclaracion {
  tipo: TipoRespuesta;
  /** Lo que dice el guardia, tal como queda escrito. */
  texto: string;
  correcta: boolean;
  explicacion: string;
}

/** Algo que se preguntó y no se vio, con su motivo. */
export interface FaltaDeclaracion {
  /** "la cara". Vacío si la pregunta entera era ese dato. */
  que: string;
  motivo: MotivoNoVisto;
  /** "estabas en el suelo". */
  porQue: string;
}

export interface PreguntaEnPanel {
  id: IdPregunta;
  /** De 1 en adelante. */
  numero: number;
  total: number;
  tema: string;
  pregunta: string;
  /** No se vio nada de lo que pregunta: no se puede describir. */
  bloqueada: boolean;
  /** Lo que no se vio, con su motivo. Vacío si se vio todo. */
  faltan: FaltaDeclaracion[];
  opciones: OpcionDeclaracion[];
}

/** Lo que se contestó, para el documento y para la nota. */
export interface RespuestaDeclaracion {
  id: IdPregunta;
  tema: string;
  pregunta: string;
  tipo: TipoRespuesta;
  texto: string;
  correcta: boolean;
  /** Si no se pudo describir por no haberlo visto. */
  bloqueada: boolean;
  faltan: FaltaDeclaracion[];
}

export const TOTAL_PREGUNTAS = PREGUNTAS.length;

/** "la cara", "la cara ni la ropa", "la cara, la ropa ni el bolso". */
function unirConNi(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  return `${cosas.slice(0, -1).join(", ")} ni ${cosas[cosas.length - 1]}`;
}

const conMayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * La pregunta tal como sale en el panel, según lo que se vio.
 *
 * @param i  Posición, desde 0.
 */
export function prepararPregunta(i: number, visto: ResumenObservacion): PreguntaEnPanel {
  const p = PREGUNTAS[i];
  const vistos = new Set(visto.vistos);
  const motivoDe = (d: DatoAsalto): MotivoNoVisto =>
    visto.noVistos.find((n) => n.dato === d)?.motivo ?? "otraParte";

  const vistas = p.partes.filter((parte) => vistos.has(parte.dato));
  const faltan: FaltaDeclaracion[] = p.partes
    .filter((parte) => !vistos.has(parte.dato))
    .map((parte) => {
      const motivo = motivoDe(parte.dato);
      return { que: parte.falta, motivo, porQue: MOTIVO[motivo] };
    });
  const bloqueada = p.partes.length > 0 && vistas.length === 0;

  // La que sirve: la descripción —entera o de lo que se vio— o, si no se vio
  // nada, decir que no se vio.
  let buena: OpcionDeclaracion;
  if (bloqueada) {
    buena = { tipo: "noVio", texto: p.noVio, correcta: true, explicacion: p.porQue.noVio };
  } else if (p.partes.length === 0) {
    buena = { tipo: "describe", texto: p.describe ?? "", correcta: true, explicacion: p.porQue.describe };
  } else if (p.partes.length === 1) {
    buena = { tipo: "describe", texto: vistas[0].dice, correcta: true, explicacion: p.porQue.describe };
  } else {
    const dicho = conMayuscula(vistas.map((v) => v.dice).join(", ")) + ".";
    const noVisto = faltan.map((f) => f.que).filter(Boolean);
    buena = {
      tipo: "describe",
      texto: noVisto.length ? `${dicho} No alcancé a ver bien ${unirConNi(noVisto)}.` : dicho,
      correcta: true,
      explicacion: noVisto.length ? p.porQue.parcial ?? p.porQue.describe : p.porQue.describe,
    };
  }
  const deTipo = {
    buena,
    opina: { tipo: "opina", texto: p.opina, correcta: false, explicacion: p.porQue.opina } as OpcionDeclaracion,
    inventa: { tipo: "inventa", texto: p.inventa, correcta: false, explicacion: p.porQue.inventa } as OpcionDeclaracion,
  };

  return {
    id: p.id,
    numero: i + 1,
    total: PREGUNTAS.length,
    tema: p.tema,
    pregunta: p.pregunta,
    bloqueada,
    faltan,
    opciones: p.orden.map((q) => deTipo[q]),
  };
}
