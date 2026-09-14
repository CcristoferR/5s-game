/**
 * Las comunicaciones por radio del turno.
 *
 * ─── POR QUÉ ESTO ES PARTE DEL CURSO Y NO UN ADORNO ───────────────────────
 *
 * El manual dedica una sección entera a comunicación y enlace: alfabeto
 * radiofónico, Código Q y la Clave 10. Y el cuestionario de examen pregunta por
 * ello —quién autoriza el uso de las radiocomunicaciones, cómo se clasifican
 * las radios, para qué sirve la antena de un transceptor—. Hasta ahora nada de
 * eso se enseñaba: la radio estaba modelada sobre el mesón y la tarjeta de
 * claves plastificada al lado, y ninguna de las dos servía para nada.
 *
 * ─── QUÉ SE APRENDE AQUÍ, QUE NO SE APRENDE EN EL LIBRO ───────────────────
 *
 * El libro enseña a escribir hechos. La radio enseña otra cosa: que cada código
 * significa UNA cosa concreta y que usar el que suena parecido no vale. Las
 * dos confusiones que se cometen de verdad en un puesto son éstas:
 *
 *   · Responder 10-4 cuando preguntan por la calidad de la señal. 10-4 es
 *     "mensaje recibido"; la calidad se contesta con 10-2.
 *   · Seguir hablando cuando alguien anuncia tráfico de emergencia, en vez de
 *     despejar el canal.
 *
 * Por eso los distractores no son códigos al azar: son los que de verdad se
 * confunden, y la explicación de cada uno dice por qué.
 *
 * ─── CÓMO ENCAJA CON EL TURNO ─────────────────────────────────────────────
 *
 * Las llamadas se reparten a lo largo del servicio, y dos caen a propósito
 * entre las 03:20 y las 08:00 — el tramo que antes estaba vacío y se pasaba
 * entero pulsando "adelantar".
 *
 * Y una de ellas TRAE TRABAJO: central pide una ronda, y esa ronda hay que
 * hacerla y anotarla en el libro. Con eso la radio deja de ser un minijuego
 * aparte y pasa a ser una tercera vía por la que entra lo que hay que
 * registrar, junto al monitor y a lo que se ve por el ventanal.
 */

/** Una respuesta posible a una llamada. */
export interface RespuestaRadio {
  /** El código, tal cual aparece en la tarjeta del mesón. */
  codigo: string;
  /** Qué significa, para quien no se sepa la tarjeta de memoria. */
  significado: string;
  /** Si es la que corresponde. */
  correcta: boolean;
  /** Por qué sí o por qué no. Se lee después de elegir. */
  explicacion: string;
}

export interface LlamadaRadio {
  id: string;
  /** Minuto del turno en que entra. */
  minuto: number;
  /** Quién llama. En la radio de un puesto siempre se identifica quien abre. */
  quien: string;
  /** Lo que se oye. */
  mensaje: string;
  opciones: RespuestaRadio[];
  /**
   * Id del suceso que esta llamada anuncia, si trae trabajo.
   *
   * El suceso existe en SUCESOS_CONDOMINIO con su propia hora, unos minutos
   * más tarde: la llamada avisa y la novedad llega después, como en la vida.
   */
  anuncia?: string;
}

export const LLAMADAS_RADIO: LlamadaRadio[] = [
  // ─── 00:12 · Prueba de enlace ───────────────────────────────────────────
  //
  // La primera del turno, y la que enseña la confusión más común de todas.
  // Preguntan POR LA SEÑAL, no por un mensaje: se contesta 10-2, no 10-4.
  {
    id: "radio-prueba-enlace",
    minuto: 12,
    quien: "CENTRAL",
    mensaje:
      "Central a Conserjería Las Araucarias. Prueba de comunicaciones de inicio de " +
      "turno. ¿Cómo me copia?",
    opciones: [
      {
        codigo: "10-2",
        significado: "Recepción bien",
        correcta: true,
        explicacion:
          "Preguntan por la calidad de la señal, y eso se contesta con 10-2 o con 10-1 si se recibe mal. Es el código que informa de CÓMO se está oyendo.",
      },
      {
        codigo: "10-4",
        significado: "Acuso recibo",
        correcta: false,
        explicacion:
          "Es la confusión más repetida en un puesto. 10-4 confirma que un mensaje llegó y se entendió, pero aquí no han mandado ningún mensaje: están midiendo el enlace. Responder 10-4 a una prueba de señal deja a central sin saber si se le oye.",
      },
      {
        codigo: "10-9",
        significado: "Repita el mensaje",
        correcta: false,
        explicacion:
          "10-9 se pide cuando no se entendió lo que dijeron. Pedirlo en una prueba de enlace informa justo de lo contrario de lo que se quiere decir: que la comunicación falla.",
      },
    ],
  },

  // ─── 02:45 · La ronda que pide central ──────────────────────────────────
  //
  // Ésta es la que ata la radio con el libro: no se resuelve respondiendo, se
  // resuelve haciendo la ronda y anotándola.
  //
  // Estaba a las 02:35, con la bodega a las 02:38 y la ronda a las 02:40:
  // tres cosas en cinco minutos de turno, unos cuatro segundos reales. Ahora
  // la bodega va antes (02:20) y la ronda llega diez minutos después de
  // pedirla (02:55), que es lo que tarda en hacerse.
  {
    id: "radio-solicita-ronda",
    minuto: 165,
    quien: "CENTRAL",
    mensaje:
      "Central a Conserjería. Se solicita ronda de verificación por el sector de " +
      "estacionamiento de visitas. Informe novedades al término.",
    anuncia: "ronda-solicitada",
    opciones: [
      {
        codigo: "10-4",
        significado: "Acuso recibo",
        correcta: true,
        explicacion:
          "Central mandó una instrucción concreta. 10-4 confirma que llegó y que se va a cumplir, que es exactamente lo que hace falta aquí.",
      },
      {
        codigo: "10-2",
        significado: "Recepción bien",
        correcta: false,
        explicacion:
          "10-2 solo dice que se oye con claridad. No confirma que se haya entendido la instrucción ni que se vaya a cumplir: central se queda sin saber si la ronda se va a hacer.",
      },
      {
        codigo: "10-6",
        significado: "Ocupado, haga una pausa",
        correcta: false,
        explicacion:
          "10-6 se usa cuando no se puede atender en ese momento. El puesto está libre y la instrucción se puede cumplir, así que decir que se está ocupado retrasa una verificación sin motivo.",
      },
    ],
  },

  // ─── 03:15 · El supervisor avisa antes de llegar ────────────────────────
  //
  // Cinco minutos antes de la fiscalización de las 03:20. Quien esté al día
  // con el libro no se inmuta; quien lleve tres novedades sin anotar, sí.
  {
    id: "radio-supervisor-transito",
    minuto: 195,
    quien: "SUPERVISOR",
    mensaje:
      "Supervisor de turno a Conserjería Las Araucarias. Me encuentro en tránsito a " +
      "su instalación para fiscalización de servicio. Arribo estimado cinco minutos.",
    opciones: [
      {
        codigo: "10-4",
        significado: "Acuso recibo",
        correcta: true,
        explicacion:
          "Le han informado de algo que va a ocurrir. Se acusa recibo y se queda a la espera: no hay nada más que contestar.",
      },
      {
        codigo: "10-20",
        significado: "Mi localización es / ¿cuál es la suya?",
        correcta: false,
        explicacion:
          "10-20 pregunta una posición, y el supervisor ya la ha dado: viene hacia acá. Devolverle la pregunta ocupa la frecuencia sin aportar nada.",
      },
      {
        codigo: "10-7",
        significado: "Fuera de servicio, dejando el aire",
        correcta: false,
        explicacion:
          "10-7 anuncia que el puesto deja la escucha. Decirlo justo cuando el supervisor viene a fiscalizar es lo contrario de lo que corresponde, y además es falso: el servicio sigue.",
      },
    ],
  },

  // ─── 05:10 · Central pregunta la posición ───────────────────────────────
  {
    id: "radio-posicion",
    minuto: 310,
    quien: "CENTRAL",
    mensaje:
      "Central a Conserjería. Confirme su 10-20 y situación del servicio.",
    opciones: [
      {
        codigo: "10-20",
        significado: "Mi localización es…",
        correcta: true,
        explicacion:
          "Preguntan por la posición con su código, y se responde con el mismo: 10-20, seguido de la instalación. En una frecuencia compartida por varios puestos, decir dónde se está es lo que permite saber a quién se está oyendo.",
      },
      {
        codigo: "10-13",
        significado: "Condiciones de tiempo y vía",
        correcta: false,
        explicacion:
          "10-13 informa del estado del tiempo o de la calzada. No es lo que han preguntado, y responder otra cosa obliga a central a repetir.",
      },
      {
        codigo: "10-4",
        significado: "Acuso recibo",
        correcta: false,
        explicacion:
          "Confirmar que se oyó la pregunta no es contestarla. Central sigue sin saber la posición ni la situación del servicio.",
      },
    ],
  },

  // ─── 06:20 · Tráfico de emergencia en la frecuencia ─────────────────────
  //
  // La última, y la que más importa: en una frecuencia compartida, lo que se
  // hace ante una emergencia ajena es callarse.
  {
    id: "radio-emergencia",
    minuto: 380,
    quien: "CENTRAL",
    mensaje:
      "Atención todas las unidades: tráfico de emergencia en frecuencia. Central " +
      "coordinando con Carabineros por procedimiento en instalación Sur. Despejen el canal.",
    opciones: [
      {
        codigo: "10-3",
        significado: "Pare de transmitir",
        correcta: true,
        explicacion:
          "Con tráfico de emergencia en curso, lo que corresponde es dejar la frecuencia libre y quedarse a la escucha. Cualquier transmisión que no sea urgente estorba a quien está coordinando con la fuerza pública.",
      },
      {
        codigo: "10-4",
        significado: "Acuso recibo",
        correcta: false,
        explicacion:
          "Parece correcto y no lo es: acusar recibo es transmitir. Si los diez puestos de la frecuencia confirman, el canal queda ocupado justo cuando había que despejarlo.",
      },
      {
        codigo: "10-33",
        significado: "Tráfico de emergencia en esta estación",
        correcta: false,
        explicacion:
          "10-33 lo declara quien TIENE la emergencia. Este puesto no la tiene: la ha declarado central para otra instalación. Repetirlo hace creer que hay una segunda emergencia.",
      },
    ],
  },
];