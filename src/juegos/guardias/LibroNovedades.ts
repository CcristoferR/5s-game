// ===========================================================================
// Libro de novedades — reglas y estado
// ===========================================================================
//
// Este archivo es SOLO las reglas. No dibuja nada.
//
// ─── POR QUÉ SEPARADO DE LA PANTALLA ──────────────────────────────────────
//
// Porque el libro es el marcador del nivel, no un formulario. El manual (p. 3)
// lo dice sin rodeos: "este es el instrumento en el cual se debe medir las
// acciones y desempeño de nuestro personal". Todo lo que el jugador hace
// durante el turno —traducir una clave, detectar algo en las cámaras— termina
// aquí, y lo que se califica es lo que quedó escrito.
//
// Teniendo las reglas aparte se pueden comprobar sin abrir el juego, y la
// pantalla puede rehacerse entera sin tocar una sola de ellas.
//
// ─── LAS CUATRO REGLAS, Y DE DÓNDE SALEN ──────────────────────────────────
//
// Todas están en la página 3 del manual, en un solo párrafo:
//
//   "no le está permitido extraer hojas, efectuar enmendaduras utilizando
//    correctores, rayar escrituras, en caso de equivocaciones solo se debe
//    poner entre paréntesis lo que se desea dejar nulo (……), las constancias
//    o párrafos se deben separar por números correlativos"
//
// De ahí salen: no se borra, se anula entre paréntesis, los párrafos van
// numerados y correlativos. La cuarta viene del párrafo anterior:
//
//   "no pudiendo señalar hechos y/o situaciones que carezcan de realidad, ni
//    menos imponer situaciones que sean según su apreciación personal"
//
// Esa es la mejor de las cuatro: separa el hecho de la opinión. Y es la única
// que NINGÚN control automático puede detectar — un sistema no sabe si
// "sujeto sospechoso" es una observación o un juicio. Por eso no salta ningún
// aviso al escribirla: sale a las 03:20, cuando el supervisor revisa.

/** Cómo está redactada una observación. Decide si el punto se sostiene. */
export type Redaccion =
  /** Lo que se vio, medible y comprobable. Es lo que pide el manual. */
  | "factual"
  /** Un juicio del guardia disfrazado de observación. */
  | "opinion"
  /** Afirma algo que no consta. El manual lo llama "carecer de realidad". */
  | "inventada";

export interface OpcionRedaccion {
  texto: string;
  clase: Redaccion;
  /** Por qué está bien o mal. Lo usa el supervisor a las 03:20. */
  explicacion: string;
}

/** Un suceso del turno, con las tres formas de anotarlo. */
export interface SucesoTurno {
  id: string;
  /** Hora a la que ocurre, en minutos desde el inicio del turno. */
  minuto: number;
  actividad: string;
  /** Lo que el jugador ve u oye. */
  aviso: string;
  opciones: OpcionRedaccion[];
}

/** Una línea escrita en el libro. */
export interface EntradaLibro {
  /** Correlativo. El manual exige que los párrafos vayan numerados. */
  numero: number;
  hora: string;
  actividad: string;
  observaciones: string;
  /**
   * Anulada entre paréntesis.
   *
   * Sigue ocupando su renglón y sigue viéndose: eso es lo que distingue anular
   * de borrar. En un libro de verdad la línea errada queda a la vista, y ese
   * rastro es la garantía de que nadie reescribió la historia después.
   */
  anulada: boolean;
  /** Cómo estaba redactada. Null en las líneas de apertura y entrega. */
  clase: Redaccion | null;
}

export type TipoFalta =
  | "intento_de_borrado"
  | "fuera_de_orden"
  | "opinion_registrada"
  | "hecho_inventado"
  | "inventario_incompleto"
  | "parrafo_mal_citado";

export interface Falta {
  tipo: TipoFalta;
  /** Qué se hizo mal, en una línea. */
  descripcion: string;
  /** La regla del manual que lo prohíbe. */
  fundamento: string;
}

const FUNDAMENTOS: Record<TipoFalta, string> = {
  intento_de_borrado:
    "No está permitido extraer hojas, usar corrector ni rayar escrituras. Los errores se anulan entre paréntesis.",
  fuera_de_orden: "El libro se lleva en orden cronológico.",
  opinion_registrada:
    "No se pueden imponer situaciones según la apreciación personal: se registra lo que se observa, no lo que se supone.",
  hecho_inventado: "No se pueden señalar hechos o situaciones que carezcan de realidad.",
  inventario_incompleto:
    "La entrega del servicio se hace conforme al cargo fijo: hay que declararlo completo.",
  parrafo_mal_citado:
    "La entrega cita el párrafo donde constan las novedades del servicio; si la numeración no es correlativa, la cita no sirve.",
};

/**
 * El cargo fijo que se recibe y se entrega.
 *
 * Sale tal cual del ejemplo del manual (p. 5). No es adorno: cerrar el turno
 * sin cuadrarlo es una falta, igual que en el puesto real, donde lo que falte
 * lo paga quien entrega.
 */
export const CARGO_FIJO = [
  "01 celular de servicio con su cargador",
  "03 radios portátiles con cargadores",
  "01 linterna con su cargador",
  "45 llaves de vehículos",
];

export interface EstadoLibro {
  entradas: EntradaLibro[];
  faltas: Falta[];
  /** Siguiente número de párrafo. Empieza en 1. */
  proximoParrafo: number;
  abierto: boolean;
  cerrado: boolean;
}

export function libroVacio(): EstadoLibro {
  return { entradas: [], faltas: [], proximoParrafo: 1, abierto: false, cerrado: false };
}

/** Minuto del turno a hora de reloj. El turno del manual va de 00:00 a 08:00. */
export function horaDe(minuto: number): string {
  const h = Math.floor(minuto / 60) % 24;
  const m = minuto % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Abre el servicio.
 *
 * El manual empieza el turno con instalación, ciudad, fecha, horario, el
 * supervisor y las firmas del guardia saliente y el entrante. Va como primera
 * entrada y con su número de párrafo, igual que todo lo demás.
 */
export function abrirServicio(
  estado: EstadoLibro,
  datos: { instalacion: string; ciudad: string; fecha: string; turno: string }
): EstadoLibro {
  if (estado.abierto) return estado;

  const observaciones =
    `INSTALACIÓN: ${datos.instalacion}. ${datos.ciudad}, ${datos.fecha}. ` +
    `TURNO: ${datos.turno}. Se inicia el servicio sin novedad.`;

  return {
    ...estado,
    abierto: true,
    proximoParrafo: estado.proximoParrafo + 1,
    entradas: [
      ...estado.entradas,
      {
        numero: estado.proximoParrafo,
        hora: horaDe(0),
        actividad: "INICIO DEL SERVICIO",
        observaciones,
        anulada: false,
        clase: null,
      },
    ],
  };
}

/**
 * Registra un suceso.
 *
 * ─── QUÉ SE COMPRUEBA Y QUÉ NO ────────────────────────────────────────────
 *
 * Se comprueba el ORDEN: una entrada anterior a la última rompe la cronología
 * y eso sí es verificable. Es la única falta que salta en el momento.
 *
 * NO se comprueba la redacción. Elegir una opinión o inventarse un hecho pasa
 * sin que nada avise, y la falta queda anotada en silencio. Es deliberado y es
 * la lección: ningún sistema sabe si "sujeto sospechoso" es lo que se vio o lo
 * que se supuso. Sale a las 03:20, cuando alguien lee el libro.
 */
export function registrar(
  estado: EstadoLibro,
  suceso: SucesoTurno,
  opcionElegida: OpcionRedaccion
): EstadoLibro {
  const faltas = [...estado.faltas];

  const ultima = estado.entradas[estado.entradas.length - 1];
  if (ultima && horaDe(suceso.minuto) < ultima.hora) {
    faltas.push({
      tipo: "fuera_de_orden",
      descripcion: `Se anotó ${horaDe(suceso.minuto)} después de ${ultima.hora}.`,
      fundamento: FUNDAMENTOS.fuera_de_orden,
    });
  }

  if (opcionElegida.clase === "opinion") {
    faltas.push({
      tipo: "opinion_registrada",
      descripcion: `«${opcionElegida.texto}» es una apreciación, no una observación.`,
      fundamento: FUNDAMENTOS.opinion_registrada,
    });
  }

  if (opcionElegida.clase === "inventada") {
    faltas.push({
      tipo: "hecho_inventado",
      descripcion: `«${opcionElegida.texto}» afirma algo que no consta.`,
      fundamento: FUNDAMENTOS.hecho_inventado,
    });
  }

  return {
    ...estado,
    faltas,
    proximoParrafo: estado.proximoParrafo + 1,
    entradas: [
      ...estado.entradas,
      {
        numero: estado.proximoParrafo,
        hora: horaDe(suceso.minuto),
        actividad: suceso.actividad,
        observaciones: opcionElegida.texto,
        anulada: false,
        clase: opcionElegida.clase,
      },
    ],
  };
}

/**
 * Anula una entrada. Es la ÚNICA forma de deshacer.
 *
 * La línea no desaparece: se marca y se muestra entre paréntesis, tachada pero
 * legible. Eso es lo que pide el manual y lo que hace que el libro sirva como
 * prueba — si las líneas erradas se pudieran quitar, cualquiera podría
 * reescribir el turno a posteriori y el documento no valdría nada.
 */
export function anular(estado: EstadoLibro, numero: number): EstadoLibro {
  return {
    ...estado,
    entradas: estado.entradas.map((e) => (e.numero === numero ? { ...e, anulada: true } : e)),
  };
}

/**
 * Intento de borrar. No borra: anota la falta y devuelve el libro intacto.
 *
 * Es el momento más importante del nivel y por eso está aquí y no en la
 * pantalla. Que la tecla de borrar no haga nada es lo que enseña la regla: en
 * un libro foliado no se puede deshacer, solo anular a la vista de todos.
 */
export function intentarBorrar(estado: EstadoLibro): EstadoLibro {
  return {
    ...estado,
    faltas: [
      ...estado.faltas,
      {
        tipo: "intento_de_borrado",
        descripcion: "Se intentó borrar una constancia ya escrita.",
        fundamento: FUNDAMENTOS.intento_de_borrado,
      },
    ],
  };
}

/**
 * Cierra el servicio con la entrega del cargo fijo.
 *
 * @param inventario     Lo que el jugador declara entregar.
 * @param parrafoCitado  Número de párrafo donde constan las novedades. El
 *                       manual lo pide literalmente: "Novedades indicadas en
 *                       el párrafo ____ del presente servicio".
 */
export function entregarServicio(
  estado: EstadoLibro,
  inventario: string[],
  parrafoCitado: number
): EstadoLibro {
  const faltas = [...estado.faltas];

  const faltantes = CARGO_FIJO.filter((item) => !inventario.includes(item));
  if (faltantes.length > 0) {
    faltas.push({
      tipo: "inventario_incompleto",
      descripcion: `Quedó sin declarar: ${faltantes.join("; ")}.`,
      fundamento: FUNDAMENTOS.inventario_incompleto,
    });
  }

  // La cita tiene que apuntar a un párrafo que exista y que no esté anulado.
  const citado = estado.entradas.find((e) => e.numero === parrafoCitado);
  if (!citado || citado.anulada) {
    faltas.push({
      tipo: "parrafo_mal_citado",
      descripcion: citado
        ? `El párrafo ${parrafoCitado} está anulado y no puede citarse.`
        : `No existe el párrafo ${parrafoCitado}.`,
      fundamento: FUNDAMENTOS.parrafo_mal_citado,
    });
  }

  const observaciones =
    `Procedo a hacer entrega del servicio conforme al cargo fijo: ${inventario.join("; ")}. ` +
    `Novedades indicadas en el párrafo ${parrafoCitado} del presente servicio.`;

  return {
    ...estado,
    faltas,
    cerrado: true,
    proximoParrafo: estado.proximoParrafo + 1,
    entradas: [
      ...estado.entradas,
      {
        numero: estado.proximoParrafo,
        hora: horaDe(480),
        actividad: "ENTREGA",
        observaciones,
        anulada: false,
        clase: null,
      },
    ],
  };
}

/**
 * Lo que el supervisor encuentra al revisar, a las 03:20.
 *
 * El manual pone esta visita en su propio ejemplo de turno: "03:20
 * FISCALIZACION - De la instalación 01 GG.SS, en sus puestos de trabajo".
 * Es el equivalente al operario que entra a probar el estándar en el Nivel 4:
 * alguien de fuera comprueba si lo que dejaste escrito se sostiene.
 *
 * Solo devuelve lo que ya está escrito hasta ese momento, no lo que vendrá
 * después: un supervisor no puede reparar en algo que aún no ha ocurrido.
 */
export function revisionDelSupervisor(estado: EstadoLibro): Falta[] {
  return estado.faltas.filter((f) => f.tipo !== "inventario_incompleto" && f.tipo !== "parrafo_mal_citado");
}

/**
 * Nota del turno, de 0 a 100.
 *
 * Parte de cien y descuenta por falta. Las de redacción pesan más que las de
 * forma: anotar una opinión como si fuera un hecho compromete el valor del
 * libro como prueba, mientras que una línea fuera de orden se ve fea pero se
 * entiende igual.
 */
export function calificar(estado: EstadoLibro): { nota: number; faltas: Falta[] } {
  const PESO: Record<TipoFalta, number> = {
    hecho_inventado: 30,
    opinion_registrada: 20,
    intento_de_borrado: 12,
    inventario_incompleto: 12,
    parrafo_mal_citado: 10,
    fuera_de_orden: 8,
  };

  const descuento = estado.faltas.reduce((suma, f) => suma + PESO[f.tipo], 0);
  return { nota: Math.max(0, 100 - descuento), faltas: estado.faltas };
}