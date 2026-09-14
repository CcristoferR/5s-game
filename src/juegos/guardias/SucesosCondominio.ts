import type { SucesoTurno, DatosServicio } from "./LibroNovedades";

// ===========================================================================
// El turno — Condominio, 00:00 a 08:00
// ===========================================================================
//
// Contenido puro: la cabecera, las novedades del turno y lo que deja escrito
// el fiscalizador. Ninguna regla vive acá; están todas en LibroNovedades.ts.
//
// ─── POR QUÉ ESTOS SUCESOS Y NO OTROS ─────────────────────────────────────
//
// Los tres primeros son los del ejemplo del manual (p. 4), en su orden y con
// sus etiquetas: RONDA a las 00:30, INGRESO a la 01:00, SALIDA a la 01:30. No
// están inventados para el juego — el turno de ejemplo del manual ES el nivel,
// y copiarlo es lo que hace que lo que el jugador practica se parezca a lo que
// va a tener delante en el puesto. Los de después salen de la lista de
// novedades que el manual manda registrar: vehículos, candados, rondas.
//
// INGRESO y SALIDA son el mismo hombre y el mismo vehículo, media hora
// después. Esa pareja importa: el manual las anota como dos constancias
// separadas, y quien anota una y se olvida de la otra deja el libro diciendo
// que alguien entró al condominio y nunca salió.
//
// ─── CUATRO FORMAS DE ANOTAR CADA UNA ─────────────────────────────────────
//
// La correcta, y tres maneras de fallar que se leen casi igual: la que opina,
// la que inventa y la que se queda corta. La incompleta es la más traicionera,
// porque todo lo que dice es verdad; lo que falla es el dato que calla, y el
// campo `omite` dice exactamente cuál para que el supervisor pueda nombrarlo.

export const APERTURA: DatosServicio = {
  instalacion: "Condominio Las Araucarias",
  ciudad: "Puerto Montt",
  fecha: "14 de septiembre de 2026",
  turno: "00:00 a 08:00 horas",
  supervisor: "Héctor Sandoval Muñoz",
  guardiaSaliente: "Rubén Cárcamo Aguilar",
  guardiaEntrante: "Marcelo Oyarzún Vidal",
};

/** Lo que el fiscalizador deja anotado a las 03:20. Sale del manual (p. 4). */
export const INSTRUCCIONES_FISCALIZACION = [
  "Seguridad personal",
  "Control de ingreso y salida de bienes amparados",
];

export const SUCESOS_CONDOMINIO: SucesoTurno[] = [
  {
    id: "ronda-inicial",
    minuto: 30,
    actividad: "RONDA",
    aviso:
      "Ronda por el interior de la instalación. En el segundo piso de la torre A hay una ventana " +
      "del pasillo abierta y las luces de ese pasillo encendidas. Cierras la ventana y apagas las " +
      "luces.",
    opciones: [
      {
        texto:
          "Se efectúa ronda al interior de la instalación. Se encuentra ventana del pasillo del " +
          "segundo piso de la torre A abierta y luces de ese pasillo encendidas. Se cierra la " +
          "ventana y se apagan las luces.",
        clase: "factual",
        explicacion:
          "Todo lo que dice ocurrió: el hallazgo y lo que se hizo con él. El manual pide detallar la ronda en forma pormenorizada, y nombra ventanas abiertas y luces encendidas entre las novedades que se registran.",
      },
      {
        texto:
          "Se efectúa ronda al interior de la instalación. Se detectan novedades en la torre A, " +
          "las que son solucionadas en el lugar.",
        clase: "incompleta",
        omite: "cuáles fueron las novedades, en qué piso ocurrieron ni qué se hizo con ellas",
        explicacion:
          "No miente, pero no informa: dice que hubo novedades y no dice cuáles. Quien lea el libro no puede saber si fue una ventana abierta, una puerta forzada o una fuga de agua, ni en qué piso, ni cómo quedó. El manual pide detallar la ronda en forma pormenorizada justamente por eso.",
      },
      {
        texto: "Se efectúa ronda al interior de la instalación, sin novedad.",
        clase: "inventada",
        explicacion:
          "Había dos novedades y el libro quedó diciendo que no hubo ninguna. \"Sin novedad\" solo se escribe cuando de verdad no hay: ponerlo habiendo hallazgos es hacer constar algo que carece de realidad.",
      },
      {
        texto:
          "Se efectúa ronda al interior de la instalación. Se encuentra ventana del pasillo del " +
          "segundo piso de la torre A abierta y luces encendidas, situación que compromete la " +
          "seguridad del sector. Se cierra la ventana y se apagan las luces.",
        clase: "opinion",
        explicacion:
          "La ventana, las luces y lo que se hizo son hechos. Que la situación \"comprometa la seguridad del sector\" es la evaluación del guardia: quien lea el libro necesita saber qué se encontró, no qué tan grave le pareció.",
      },
    ],
  },
  // Piloto: primer suceso generado por cámara, mismo formato que los de
  // arriba. Si funciona, esto es lo que se replica para sumar más.
  {
    id: "ingreso-vehiculo",
    minuto: 60,
    actividad: "INGRESO",
    aviso:
      "En la reja principal se presenta don Óscar Bahamonde en una camioneta patente KJVR-42, " +
      "acompañado por dos personas. Dice que va al departamento 302. Se llama al 302 por citófono " +
      "y confirman la visita.",
    opciones: [
      {
        texto:
          "Ingresa don Óscar Bahamonde en vehículo patente KJVR-42, acompañado por dos personas. " +
          "Se confirma por citófono con el departamento 302, que autoriza el ingreso.",
        clase: "factual",
        explicacion:
          "Nombre, patente, acompañantes y quién autorizó. Es el formato del ejemplo del manual, y es lo que permite reconstruir después quién entró y con permiso de quién.",
      },
      {
        texto: "Ingresa don Óscar Bahamonde en vehículo, con visita al departamento 302.",
        clase: "incompleta",
        omite: "la patente, los dos acompañantes ni quién autorizó el ingreso",
        explicacion:
          "Falta justo lo que sirve después: la patente para identificar el vehículo, los acompañantes para saber cuántas personas entraron y la confirmación del 302 para saber con permiso de quién. Sin esos datos, la salida de las 01:30 no se puede cuadrar con este ingreso.",
      },
      {
        texto:
          "Ingresa don Óscar Bahamonde en vehículo patente KJVR-42, acompañado por dos personas " +
          "cuyo ingreso a esta hora no se justifica. Se autoriza el ingreso al departamento 302.",
        clase: "opinion",
        explicacion:
          "Que la visita se justifique o no a esa hora es criterio del guardia, y el 302 ya la autorizó. El libro registra que se autorizó y quién lo hizo, no si al guardia le pareció bien.",
      },
      {
        texto:
          "Ingresa don Óscar Bahamonde en vehículo patente KJVR-42, acompañado por dos personas, " +
          "residente del departamento 302 del condominio.",
        clase: "inventada",
        explicacion:
          "Es una visita autorizada por el 302, no un residente. Convertir al visitante en residente cambia quién puede entrar sin permiso, y eso no consta en ninguna parte.",
      },
    ],
  },
  {
    id: "salida-vehiculo",
    minuto: 90,
    actividad: "SALIDA",
    aviso:
      "Sale la misma camioneta patente KJVR-42, conducida por don Óscar Bahamonde, con las mismas " +
      "dos personas.",
    opciones: [
      {
        texto:
          "Sale don Óscar Bahamonde en vehículo patente KJVR-42, acompañado por las mismas dos " +
          "personas que registraron ingreso a las 01:00 horas.",
        clase: "factual",
        explicacion:
          "Cierra la pareja. El manual anota ingreso y salida como dos constancias, y es esa segunda la que deja claro que nadie se quedó dentro.",
      },
      {
        texto: "Sale el vehículo de la visita del departamento 302.",
        clase: "incompleta",
        omite: "quién conducía, la patente ni con cuántas personas salió",
        explicacion:
          "No dice quién sale ni con quién. El ingreso de las 01:00 registró a tres personas y una patente; esta constancia no permite comprobar que salieron las mismas tres, que es para lo que existe.",
      },
      {
        texto:
          "Sale don Óscar Bahamonde en vehículo patente KJVR-42, acompañado por las mismas dos " +
          "personas. Permanencia de treinta minutos, tiempo razonable para la visita declarada.",
        clase: "opinion",
        explicacion:
          "Los treinta minutos salen del libro y son un hecho. Que sean un tiempo \"razonable\" es la evaluación del guardia: se anota cuánto duró, no si le pareció apropiado.",
      },
      {
        texto:
          "Sale don Óscar Bahamonde en vehículo patente KJVR-42, solo, tras dejar a sus dos " +
          "acompañantes en el departamento 302.",
        clase: "inventada",
        explicacion:
          "Salieron los tres. Escribir que dos se quedaron adentro deja constancia de dos personas dentro del condominio que en realidad ya no están.",
      },
    ],
  },
  // ─── 02:02 · La camioneta del estacionamiento ───────────────────────────
  //
  // LA HORA SALE DEL REGISTRO DE LA CÁMARA, Y EL AVISO LO DICE.
  //
  // Antes el aviso decía "desde hace más de diez minutos" y la redacción
  // correcta decía "desde aproximadamente las 00:35". Esa hora era un resto de
  // cuando el suceso caía a las 00:45: nadie la actualizó al moverlo. El
  // resultado era que la opción CORRECTA afirmaba un dato que el jugador no
  // tenía por dónde saber — exactamente la falta que el nivel castiga.
  //
  // Ahora el dato existe y tiene fuente: el detector de movimiento de la CAM 02
  // marcó la llegada a las 01:50, el monitor lo estampa en el cuadrante y el
  // aviso lo cuenta. La constancia correcta dice la hora Y de dónde sale.
  //
  // Va a las 02:02 y no a las 00:45: ahí caía quince minutos después de la
  // ronda y quince antes del ingreso, tres novedades en media hora de servicio.
  // Aquí además se lee mejor: primero entra una visita por la reja y sale, y
  // DESPUÉS aparece una camioneta sin patente parada en visitas.
  {
    id: "camara-estacionamiento",
    minuto: 122,
    actividad: "CAMARA",
    aviso:
      "En el monitor, la cámara 2 (Estacionamiento) muestra una camioneta gris, sin patente visible, " +
      "detenida en el sector de visitas con el motor encendido. El registro de movimiento de la " +
      "cámara marca su llegada a las 01:50 horas. Desde entonces no se ha visto a nadie bajar ni " +
      "acercarse al vehículo.",
    opciones: [
      {
        texto:
          "Se observa por cámara 2 (Estacionamiento) una camioneta gris, sin patente visible, detenida " +
          "en el sector de visitas con el motor encendido desde las 01:50 horas, según el registro de " +
          "la cámara. No se observan personas fuera del vehículo.",
        clase: "factual",
        explicacion:
          "Lo que muestra la cámara y lo que marca su registro: el vehículo, dónde está, desde qué hora y que no hay nadie fuera. La hora no se calcula a ojo: sale del registro de movimiento, y la constancia dice de dónde sale. Que no se distinga la patente también se anota tal cual — es lo que se observa, no lo que se omite.",
      },
      {
        texto: "Se observa por cámara 2 una camioneta detenida en el sector de visitas.",
        clase: "incompleta",
        omite:
          "el color, que no tiene patente visible, que mantiene el motor encendido ni desde qué hora está detenida",
        explicacion:
          "Con esa línea nadie podría reconocer el vehículo ni saber cuánto lleva ahí. El manual pide describir los vehículos con su patente, color, modelo y cualquier característica que facilite su ubicación, y lo que hace llamativa a esta camioneta —sin patente, con el motor encendido desde las 01:50— es justo lo que quedó fuera.",
      },
      {
        texto:
          "Se observa por cámara 2 una camioneta gris estacionada de forma sospechosa en el sector de " +
          "visitas, con el motor encendido, situación que hace prever un posible ilícito.",
        clase: "opinion",
        explicacion:
          "Que la situación sea \"sospechosa\" o \"haga prever un ilícito\" es la lectura del guardia. La cámara muestra un vehículo detenido con el motor encendido; eso es el hecho, no la conclusión.",
      },
      {
        texto:
          "Se observa por cámara 2 una camioneta gris con dos sujetos en su interior, preparando un " +
          "robo en el sector de visitas.",
        clase: "inventada",
        explicacion:
          "La cámara no muestra a nadie dentro ni fuera del vehículo, y menos qué se proponían hacer. Afirmar sujetos y un robo que no se ve es señalar un hecho que carece de realidad.",
      },
    ],
  },
  // ─── 02:20 · La bodega ──────────────────────────────────────────────────
  //
  // Este suceso enseña un patrón distinto a los de arriba, y por eso está: en
  // aquellos la cámara muestra algo OCURRIENDO —una camioneta que llega, una
  // que se va—, y aquí muestra un ESTADO. Nadie vio abrir el candado. Se
  // encuentra abierto.
  //
  // Esa diferencia es la que hace caer en las trampas: escribir que hubo un
  // ingreso no autorizado es inventarse el hecho que falta, y escribir que la
  // situación es irregular o preocupante es la apreciación personal que el
  // manual prohíbe expresamente. Lo correcto es lo aburrido: el candado está
  // abierto, la puerta entornada, se revisó, no se advierten faltantes.
  //
  // Estaba a las 02:38, pegada a la llamada de las 02:35 y a la ronda de las
  // 02:40. Adelantada a las 02:20 queda a dieciocho minutos de la camioneta y
  // a veinticinco de la llamada: se atiende sola, sin nada encima.
  {
    id: "bodega-candado",
    minuto: 140,
    actividad: "RONDA",
    aviso:
      "En el monitor, la cámara 4 (Bodega) muestra la puerta entornada y el candado colgando " +
      "abierto de la argolla. Al concurrir al lugar se revisa el interior: los estantes están " +
      "completos y no se advierten faltantes ni desorden. No hay nadie dentro.",
    opciones: [
      {
        texto:
          "Se observa por cámara 4 la puerta de bodega entornada, con el candado abierto en su " +
          "argolla. Se concurre al lugar, se revisa el interior sin advertir faltantes ni personas " +
          "en su interior, y se procede a cerrar la puerta y el candado. Se informa a la " +
          "administración para su conocimiento.",
        clase: "factual",
        explicacion:
          "Lo que se encontró, lo que se hizo y a quién se informó. El manual pide verificar candados, puertas y ventanas en las rondas, y esta constancia deja escrito que se verificó y cómo quedó.",
      },
      {
        texto: "Se observa por cámara 4 la puerta de bodega abierta. Se procede a cerrarla.",
        clase: "incompleta",
        omite:
          "que el candado estaba abierto, que se revisó el interior, que no hay faltantes ni personas, ni que se informó a la administración",
        explicacion:
          "Se cerró la puerta, pero la constancia no deja saber si alguien entró a revisar, si falta algo o a quién se avisó. Si mañana la administración echa en falta algo de esa bodega, este párrafo no sirve para decir cómo estaba a las 02:20.",
      },
      {
        texto:
          "Se observa por cámara 4 la puerta de bodega abierta con el candado suelto, situación " +
          "irregular y preocupante que denota descuido del personal de aseo del turno anterior. Se " +
          "procede a cerrar.",
        clase: "opinion",
        explicacion:
          "La puerta y el candado son hechos. Que la situación sea \"irregular y preocupante\" y que el descuido sea del aseo es lo que le pareció al guardia: no vio a nadie dejarla abierta. Quien lea el libro necesita saber qué se encontró, no a quién culpa el que escribe.",
      },
      {
        texto:
          "Se constata ingreso no autorizado a bodega mediante violación del candado, sin " +
          "sustracción de especies. Se cierra el recinto.",
        clase: "inventada",
        explicacion:
          "Nadie vio entrar a nadie ni forzar nada: el candado estaba abierto, no roto. Escribir un ingreso no autorizado y una violación convierte una puerta mal cerrada en un delito, y esa constancia puede terminar en una denuncia por un hecho que no ocurrió.",
      },
    ],
  },
  // ─── 02:55 · La ronda que pidió central ─────────────────────────────────
  //
  // Ésta no la descubre el guardia: se la MANDAN por radio diez minutos antes
  // (ver LLAMADAS_RADIO, "radio-solicita-ronda"). Y por eso enseña algo que
  // ninguna de las otras enseña: lo que se anota no es solo lo que uno ve, sino
  // también lo que le ordenaron hacer y el resultado de haberlo hecho.
  //
  // El manual lo pide expresamente en RONDAS: verificar y registrar en el Libro
  // de Novedades todo lo observado, y reportar al Supervisor las veces que sea
  // necesario. Una ronda solicitada que no queda escrita es, a efectos del
  // libro, una ronda que no se hizo.
  //
  // Diez minutos y no cinco: es lo que tarda recorrer tres bahías y un pasillo,
  // y a la velocidad del turno son nueve segundos para leer la llamada y
  // contestarla antes de que la ronda aparezca.
  {
    id: "ronda-solicitada",
    minuto: 175,
    actividad: "RONDA",
    aviso:
      "Se efectúa la ronda solicitada por central al sector de estacionamiento de visitas. " +
      "Se recorren las tres bahías y el pasillo de acceso: los vehículos estacionados " +
      "corresponden a los registrados en el turno, el cierre perimetral está indemne y no " +
      "se observan personas ni bienes abandonados.",
    opciones: [
      {
        texto:
          "Se efectúa ronda al sector de estacionamiento de visitas, solicitada por central " +
          "a las 02:45 horas. Se verifican las tres bahías y el pasillo de acceso, sin " +
          "observar personas ajenas, bienes abandonados ni daños en el cierre perimetral. " +
          "Se informa el resultado a central.",
        clase: "factual",
        explicacion:
          "Dice quién la pidió, a qué hora, qué se recorrió, qué se verificó y que se informó el resultado. Una ronda solicitada se anota con su origen y con lo que se encontró: así el libro sirve para responder después por qué se hizo y qué salió.",
      },
      {
        texto:
          "Se realiza ronda al estacionamiento conforme a lo solicitado por central, sin " +
          "novedad en el sector.",
        clase: "incompleta",
        omite: "qué se recorrió, qué se verificó ni que se informó el resultado a central",
        explicacion:
          "No es falso, pero no informa. \"Sin novedad\" resume lo que el guardia concluyó, no lo que verificó: quien lea el libro no sabe si se revisó el cierre perimetral, si se contaron los vehículos o si solo se asomó. Y central pidió que se le informara el resultado, cosa que tampoco consta.",
      },
      {
        texto:
          "Se efectúa ronda al estacionamiento de visitas solicitada por central a las 02:45 " +
          "horas. El sector se encuentra tranquilo y seguro, sin motivo de preocupación. Se " +
          "informa a central.",
        clase: "opinion",
        explicacion:
          "\"Tranquilo y seguro\" y \"sin motivo de preocupación\" son conclusiones del guardia, no verificaciones. La constancia debe decir qué se revisó y qué se encontró —las tres bahías, el pasillo, el cierre perimetral— y dejar que quien la lea saque sus propias conclusiones.",
      },
      {
        texto:
          "Se efectúa ronda al estacionamiento detectando un vehículo no registrado, el que " +
          "se retira del lugar al advertir la presencia del guardia.",
        clase: "inventada",
        explicacion:
          "Todos los vehículos correspondían a los registrados y no se observó a nadie. Inventar un vehículo no registrado y una huida convierte una ronda de rutina en un incidente que nunca ocurrió, y obliga a central a actuar sobre un hecho falso.",
      },
    ],
  },
];

/** Minuto del turno en el que llega el fiscalizador (03:20). */
export const MINUTO_FISCALIZACION = 200;

/**
 * Minuto en que llega el relevo: las 08:00.
 *
 * Es el final del turno y no se negocia. Lo que no quedó anotado a esa hora ya
 * no se anota, igual que en el puesto.
 */
export const MINUTO_ENTREGA = 480;

// ---------------------------------------------------------------------------
// Qué se ve de cada suceso en el monitor
// ---------------------------------------------------------------------------
//
// El monitor del puesto tiene cuatro cámaras y los sucesos caen en ellas sin
// forzar nada: la ronda transcurre en un pasillo, el ingreso y la salida en la
// reja, la camioneta en el estacionamiento, el candado en la bodega.
//
// Esto es un MAPA, no una regla: si un suceso no aparece acá simplemente no
// se ve por cámara, y se sigue jugando igual desde el libro. Por eso vive
// junto al contenido y no dentro de SucesoTurno, que es lo que califica.

/** Qué dibuja el monitor. Lo interpreta MonitorCamaras. */
export type EscenaCamara =
  | "vehiculo-en-reja"
  | "vehiculo-saliendo"
  | "vehiculo-detenido"
  | "pasillo-abierto"
  | "bodega-abierta";

export interface TomaDeCamara {
  /** Cuadrante del monitor: 0 acceso, 1 estacionamiento, 2 pasillo, 3 bodega. */
  indice: number;
  escena: EscenaCamara;
  /**
   * Marca que estampa el grabador sobre la toma.
   *
   * Solo cuando el aviso se apoya en ella: si el texto dice "el registro marca
   * las 01:50", esa hora tiene que estar en la pantalla para poder comprobarla.
   */
  rotulo?: string;
}

// El ingreso y la salida comparten la CAM 01 a propósito: son la misma reja
// y la misma camioneta, media hora después. Ver esa repetición en el mismo
// cuadrante es parte de lo que hay que notar para redactarlo bien.
export const CAMARAS_POR_SUCESO: Record<string, TomaDeCamara> = {
  "ronda-inicial": { indice: 2, escena: "pasillo-abierto" },
  "camara-estacionamiento": { indice: 1, escena: "vehiculo-detenido", rotulo: "MOVIMIENTO 01:50" },
  "ingreso-vehiculo": { indice: 0, escena: "vehiculo-en-reja" },
  "salida-vehiculo": { indice: 0, escena: "vehiculo-saliendo" },
  // Y con esto la CAM 04 deja de ser la cámara donde nunca pasa nada, que es
  // lo que enseñaba a no mirarla.
  "bodega-candado": { indice: 3, escena: "bodega-abierta" },
};
