import type { OpcionSituacion } from "./PanelesSupermercado";
import { FRASES, type MomentoAsalto } from "./AsaltoBanco";

// ===========================================================================
// Los cuatro momentos del asalto: qué ves y qué puedes hacer
// ===========================================================================
//
// Los datos, aparte de la escena, como SituacionesSupermercado: cambiar un
// texto no obliga a tocar el puesto.
//
// ─── LA CORRECTA CASI SIEMPRE ES NO HACER NADA ──────────────────────────
//
// Es a propósito, y es lo que enseña el nivel: el guardia no es policía. No
// resiste, no persigue, no saca nada con un arma delante. Lo que sí hace, y
// mejor que nadie en la sala, es mirar: es el testigo, y lo que vea es lo
// único verdaderamente útil que aporta a un asalto.
//
// Las trampas son todas las maneras de querer actuar. Suenan razonables —
// avisar, pedir ayuda, no perderlos de vista—, y por eso son trampas.
//
// ─── LAS TRES OPCIONES, DEL MISMO LARGO ─────────────────────────────────
//
// Como en el supermercado: todas del mismo lado de los sesenta caracteres,
// para que los tres botones midan igual y ninguno se lea como el importante
// antes de leerlo. Y la correcta no siempre en el mismo sitio.

/**
 * Lo que pasa en la escena si eliges una trampa, al cerrar la explicación:
 *
 *   · alSueloUnRato: el del arma se vuelve hacia ti y te manda al suelo unos
 *     segundos. Te pierdes lo que pase mientras tanto.
 *   · alSueloHastaQueSeVayan: lo mismo, pero no te levantas hasta que se van.
 */
export type EfectoTrampa = "alSueloUnRato" | "alSueloHastaQueSeVayan";

/**
 * De qué lado falla quien elige una opción incorrecta. Son los dos montones
 * de la nota final:
 *
 *   · arriesgar: quiso actuar donde no correspondía —la radio, la alarma con
 *     él delante, perseguirlos—. Se puso en peligro, y a la sala.
 *   · descuidar: lo contrario, ya pasado el asalto: no avisó, o dejó que se
 *     tocara el lugar del hecho.
 */
export type FaltaBanco = "arriesgar" | "descuidar";

export interface OpcionMomento extends OpcionSituacion {
  falta?: FaltaBanco;
  efecto?: EfectoTrampa;
  /** Lo que te grita el del arma cuando ve lo que intentas. */
  reaccion?: string;
  /**
   * El texto y la explicación si el momento te pilla en el suelo, cuando los
   * de pie no tienen sentido: "fijarse hacia dónde se van" no se puede con la
   * cara contra las baldosas. Lo demás —si es correcta, la falta— no cambia.
   */
  enElSuelo?: { texto: string; explicacion: string };
}

export interface MomentoBanco {
  /** El rótulo del panel, tras la hora: "ENTRAN DOS SUJETOS". */
  actividad: string;
  /** Lo que estás viendo, contado en presente. */
  aviso: string;
  /**
   * Lo mismo, si el momento te pilla en el suelo por una trampa anterior:
   * desde ahí no se ve, se oye. Sin esto, el panel te contaría cosas que no
   * estás viendo.
   */
  avisoEnElSuelo?: string;
  opciones: readonly OpcionMomento[];
}

/** Lo que se eligió en un momento, con la hora: va a la nota y al libro. */
export interface DecisionBanco {
  momento: MomentoAsalto;
  /** Minuto del turno en que se decidió. */
  minuto: number;
  opcion: OpcionMomento;
}

/**
 * Segundos que te quedas en el suelo con alSueloUnRato. Solo lo usa el primer
 * momento, y está medido contra el guion: te pierdes la entrada del de la
 * caja, y ya estás de pie cuando el del arma echa a andar hacia ti. Más, y te
 * estarías levantando con él delante gritándote que te quedes quieto.
 */
export const SEGUNDOS_EN_EL_SUELO = 8;

export const MOMENTOS: Record<MomentoAsalto, MomentoBanco> = {
  // ─── 1 · ENTRAN ─────────────────────────────────────────────────────────
  //
  // Nada más entrar: la puerta abierta de golpe, el grito, la gente
  // empezando a agacharse. Lo primero que se tiene ganas de hacer es avisar.
  entran: {
    actividad: "ENTRAN DOS SUJETOS",
    aviso:
      "La puerta se abre de golpe. Entra un hombre con un arma en la mano gritando que es un asalto y " +
      "que todos se tiren al suelo. Detrás de él entra otro con un bolso.",
    opciones: [
      {
        clase: "avisar",
        texto: "Llevar la mano a la radio del cinturón para avisar a Central de lo que ocurre.",
        correcta: false,
        explicacion:
          "Cualquier mano que baja al cinturón, con un arma apuntando a la sala, se lee como que vas a " +
          "sacar algo. Lo primero es que nadie salga herido, y tú tampoco: el aviso se da cuando ya no " +
          "haya un arma delante.",
        falta: "arriesgar",
        efecto: "alSueloUnRato",
        reaccion: "¡Tú, guardia! ¡Suelta eso y al suelo!",
        enBreve: "Llevó la mano a la radio con el arma apuntando a la sala.",
      },
      {
        clase: "observar",
        texto: "Mantener la calma, dejar las manos a la vista y obedecer lo que ordenan.",
        correcta: true,
        explicacion:
          "Es lo que corresponde. El guardia no está para enfrentar a un asaltante armado: está para que " +
          "nadie salga herido y para ser un buen testigo. Con las manos a la vista y sin movimientos " +
          "bruscos no das motivos, y puedes seguir mirando.",
      },
      {
        clase: "intervenir",
        texto: "Encarar al sujeto armado y ordenarle con voz firme que baje el arma ya.",
        correcta: false,
        explicacion:
          "Sin arma frente a alguien armado no hay forma de imponerse, y encararlo pone en riesgo tu vida " +
          "y la de todos los que están en el suelo. No corresponde resistir: corresponde obedecer y " +
          "observar.",
        falta: "arriesgar",
        efecto: "alSueloUnRato",
        reaccion: "¡Cállate! ¡Al suelo, al suelo te dije!",
        enBreve: "Encaró al sujeto armado.",
      },
    ],
  },

  // ─── 2 · SE TE ACERCA ───────────────────────────────────────────────────
  //
  // El momento más peligroso y, a la vez, el más valioso para un testigo: lo
  // tienes a un metro.
  seAcerca: {
    actividad: "TE APUNTA A TI",
    aviso:
      "El hombre armado se te planta a un metro, apuntándote al pecho. Te grita que te quedes quieto " +
      "y con las manos donde las pueda ver.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Aprovechar que está tan cerca para intentar quitarle el arma de un manotazo.",
        correcta: false,
        explicacion:
          "A un metro de un arma, un forcejeo termina mal casi siempre, y no solo para ti: un disparo en " +
          "una sala llena de gente. No corresponde. Lo que sí puedes hacer a esa distancia es mirarlo bien.",
        falta: "arriesgar",
        efecto: "alSueloHastaQueSeVayan",
        reaccion: "¡Ni lo intentes! ¡Al suelo y no te muevas!",
        enBreve: "Intentó quitarle el arma.",
      },
      {
        clase: "avisar",
        texto: "Buscar a tientas el botón de la alarma silenciosa y apretarlo sin que se note.",
        correcta: false,
        explicacion:
          "Con él delante, cualquier mano que se mueve la ve. La alarma se activa cuando se puede hacer " +
          "sin ser visto, y si no, después. Activarla ahora es arriesgarte a que reaccione contra ti o " +
          "contra la sala.",
        falta: "arriesgar",
        efecto: "alSueloHastaQueSeVayan",
        reaccion: "¡¿Qué haces con esa mano?! ¡Al suelo, ahora!",
        enBreve: "Buscó la alarma con el sujeto armado delante.",
      },
      {
        clase: "observar",
        texto: "Quedarse quieto, sin desafiarlo con la mirada, y fijarse bien en cómo es.",
        correcta: true,
        explicacion:
          "Es lo que corresponde, y es tu mejor momento como testigo: lo tienes a un metro. La cara, el " +
          "gorro, la ropa, la contextura, la estatura, el arma. Sin mirarlo desafiante —eso lo provoca—, " +
          "pero sin perder un detalle.",
      },
    ],
  },

  // ─── 3 · SALEN ──────────────────────────────────────────────────────────
  //
  // Ya tienen lo que vinieron a buscar. Parece que el peligro pasó, y ahí
  // aparecen las ganas de ir detrás.
  salen: {
    actividad: "SE VAN CON EL DINERO",
    aviso:
      "El del bolso sale corriendo por la puerta con el dinero. El del arma retrocede detrás de él, " +
      "apuntando todavía a la sala.",
    // Solo se llega aquí en el suelo si la trampa fue la del segundo momento,
    // que no te deja levantarte hasta que se van. Lo que suena es lo que dicen
    // y hacen de verdad en ese instante: la frase es la misma de AsaltoBanco,
    // así que si cambia allá, cambia aquí.
    avisoEnElSuelo:
      `Desde el suelo, sin poder levantar la vista, oyes gritar «${FRASES.salida}», pasos que ` +
      "corren y la puerta que se abre de golpe. Se están yendo con el dinero.",
    opciones: [
      {
        clase: "observar",
        texto: "Dejarlos ir y fijarse bien hacia dónde se van cuando salgan por la puerta.",
        correcta: true,
        explicacion:
          "Es lo que corresponde. Perseguirlos no te toca, y la dirección en que se van es de lo más útil " +
          "que puedes aportar: con eso sale Carabineros a buscarlos.",
        enElSuelo: {
          texto: "Quedarse en el suelo, dejarlos ir y retener todo lo que se alcance a oír.",
          explicacion:
            "Es lo que corresponde. Te ordenaron no moverte y el del arma sigue en la puerta: levantarte " +
            "ahora es darle un motivo. Hacia dónde se van no lo verás, pero lo que oíste —las voces, lo " +
            "que gritaron, los pasos— también sirve en la declaración.",
        },
      },
      {
        clase: "intervenir",
        texto: "Salir detrás de ellos para no perderlos de vista y ver dónde se meten.",
        correcta: false,
        explicacion:
          "Perseguir a asaltantes armados no es tarea del guardia: te expones tú, expones a la gente de la " +
          "calle y dejas la sucursal sola. Lo que sirve es fijarse hacia dónde van, desde dentro.",
        falta: "arriesgar",
        efecto: "alSueloHastaQueSeVayan",
        reaccion: "¡Quédate ahí! ¡Al suelo o te arrepientes!",
        enBreve: "Quiso perseguirlos.",
      },
      {
        clase: "avisar",
        texto: "Correr a la vereda apenas salgan y pedir ayuda a gritos a la gente de la calle.",
        correcta: false,
        explicacion:
          "Mientras el del arma sigue en la puerta, salir tras ellos es ponerte en su camino. Pedir ayuda " +
          "está bien, pero después y a salvo: por radio o por teléfono. Gritando en la vereda no aportas " +
          "nada que no puedas dar desde dentro.",
        falta: "arriesgar",
        efecto: "alSueloHastaQueSeVayan",
        reaccion: "¡Tú no sales! ¡Al suelo!",
        enBreve: "Quiso salir a la vereda tras ellos.",
      },
    ],
  },

  // ─── 4 · YA SE FUERON ───────────────────────────────────────────────────
  //
  // Ahora sí se actúa: avisar y cuidar el lugar. Las trampas cambian de lado:
  // ya no es hacerse el héroe, es no hacer lo que toca.
  despues: {
    actividad: "YA SE FUERON",
    aviso:
      "Los dos salieron del banco y ya no se les ve. La gente sigue en el suelo, el cajero de la caja 2 " +
      "tiene las manos en alto y el dinero ya no está.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Ordenar el mesón de la caja 2 para que la atención vuelva cuanto antes.",
        correcta: false,
        explicacion:
          "El mesón es el sitio del suceso: ahí hay huellas y rastros que Carabineros y la fiscalía van a " +
          "necesitar, y ordenarlo los borra. Primero se avisa y se resguarda; la atención vuelve cuando lo " +
          "autoricen.",
        falta: "descuidar",
        enBreve: "Ordenó el mesón y borró rastros del sitio del suceso.",
      },
      {
        clase: "avisar",
        texto: "Avisar a Carabineros y a Central, y cuidar que nadie toque nada en la caja.",
        correcta: true,
        explicacion:
          "Es lo que corresponde, y ahora sí es el momento: avisar de inmediato a Carabineros (133) y a tu " +
          "central, y resguardar el lugar hasta que lleguen, sin que nadie toque el mesón ni se vaya sin " +
          "dejar sus datos.",
        despues: "Central: recibido. Carabineros va en camino. Mantén el lugar resguardado.",
      },
      {
        clase: "intervenir",
        texto: "Salir a la calle a ver si todavía se les alcanza a ver hacia dónde van.",
        correcta: false,
        explicacion:
          "Aunque ya no se les vea, pueden estar cerca y armados. Y mientras sales, la sucursal queda sin " +
          "nadie que avise ni que resguarde. Lo que viste desde dentro es lo que sirve.",
        falta: "arriesgar",
        enBreve: "Salió a la calle detrás de ellos.",
      },
    ],
  },
};
