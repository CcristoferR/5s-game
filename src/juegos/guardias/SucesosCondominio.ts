import type { SucesoTurno, DatosServicio } from "./LibroNovedades";

// ===========================================================================
// El turno — Condominio, 00:00 a 08:00
// ===========================================================================
//
// Contenido puro: la cabecera, los tres sucesos y lo que deja escrito el
// fiscalizador. Ninguna regla vive acá; están todas en LibroNovedades.ts.
//
// ─── POR QUÉ ESTOS TRES Y NO OTROS ────────────────────────────────────────
//
// Son los del ejemplo del manual (p. 4), en su orden y con sus etiquetas:
// RONDA a las 00:30, INGRESO a la 01:00, SALIDA a la 01:30. No están
// inventados para el juego — el turno de ejemplo del manual ES el nivel, y
// copiarlo es lo que hace que lo que el jugador practica se parezca a lo que
// va a tener delante en el puesto.
//
// INGRESO y SALIDA son el mismo hombre y el mismo vehículo, media hora
// después. Esa pareja importa: el manual las anota como dos constancias
// separadas, y quien anota una y se olvida de la otra deja el libro diciendo
// que alguien entró al condominio y nunca salió.

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
  {
    id: "camara-estacionamiento",
    // Se movió de las 00:45 a las 02:02, Y SE CAMBIÓ DE SITIO EN LA LISTA.
    //
    // Las dos cosas van juntas. Al moverle la hora sin moverla de posición, la
    // lista quedó desordenada —30, 122, 60, 90, 158— y el turno se atascaba en
    // ella: a las 01:00 miraba la siguiente de la lista, veía que era la de
    // las 02:02, decidía que todavía no tocaba, y el ingreso y la salida no
    // ocurrían. Aparecían las tres de golpe a las 02:02.
    //
    // La lista va en orden cronológico. El código ya no depende de eso —ver
    // alPasarMinuto— pero quien la lea tiene que poder seguir el turno de
    // arriba abajo.
    //
    // A las 00:45 caía quince minutos después de la ronda y quince antes del
    // ingreso: tres novedades en media hora de servicio. Comprimido, eso son
    // diez segundos entre una y otra —ni para leer el aviso, menos para elegir
    // cómo redactarlo— y el jugador se encontraba tres cámaras encendidas a la
    // vez sin haber podido atender ninguna.
    //
    // Aquí, además, se lee mejor: primero entra una visita por la reja y sale,
    // y DESPUÉS aparece una camioneta sin patente parada en visitas. En ese
    // orden la segunda hace pensar en la primera.
    minuto: 122,
    actividad: "CAMARA",
    aviso:
      "En el monitor, la cámara 2 (Estacionamiento) muestra una camioneta gris, sin patente visible, " +
      "detenida en el sector de visitas con el motor encendido desde hace más de diez minutos. No se " +
      "ve a nadie fuera del vehículo.",
    opciones: [
      {
        texto:
          "Se observa por cámara 2 (Estacionamiento) una camioneta gris, sin patente visible, detenida " +
          "en el sector de visitas con el motor encendido desde aproximadamente las 00:35 horas. No se " +
          "observan personas fuera del vehículo.",
        clase: "factual",
        explicacion:
          "Lo que muestra la cámara: el vehículo, dónde está, desde cuándo y que no hay nadie fuera. Que no se distinga la patente también se anota tal cual — es lo que se observa, no lo que se omite.",
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
  // ─── 02:10 · La bodega ──────────────────────────────────────────────────
  //
  // Este suceso enseña un patrón distinto a los cuatro de arriba, y por eso
  // está: en aquellos la cámara muestra algo OCURRIENDO —una camioneta que
  // llega, una que se va—, y aquí muestra un ESTADO. Nadie vio abrir el
  // candado. Se encuentra abierto.
  //
  // Esa diferencia es la que hace caer en las dos trampas: escribir que hubo
  // un ingreso no autorizado es inventarse el hecho que falta, y escribir que
  // la situación es irregular o preocupante es la apreciación personal que el
  // manual prohíbe expresamente. Lo correcto es lo aburrido: el candado está
  // abierto, la puerta entornada, se revisó, no se advierten faltantes.
  //
  // Va en el minuto 130 a propósito. Los otros cuatro se agolpan entre el 30 y
  // el 90, y de ahí hasta la fiscalización de las 03:20 no pasaba nada: esto
  // no aprieta el arranque y le da contenido a la mitad muerta del turno.
  {
    id: "bodega-candado",
    // Corrida a las 02:38 para no pisarse con la de las 02:02.
    minuto: 158,
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
  // ─── 02:40 · La ronda que pidió central ─────────────────────────────────
  //
  // Ésta no la descubre el guardia: se la MANDAN por radio cinco minutos antes
  // (ver LLAMADAS_RADIO, "radio-solicita-ronda"). Y por eso enseña algo que
  // ninguna de las otras enseña: lo que se anota no es solo lo que uno ve, sino
  // también lo que le ordenaron hacer y el resultado de haberlo hecho.
  //
  // El manual lo pide expresamente en RONDAS: verificar y registrar en el Libro
  // de Novedades todo lo observado, y reportar al Supervisor las veces que sea
  // necesario. Una ronda solicitada que no queda escrita es, a efectos del
  // libro, una ronda que no se hizo.
  //
  // La trampa aquí es distinta a las demás: lo fácil es escribir que se cumplió
  // la instrucción sin decir qué se encontró. "Se realiza ronda conforme a lo
  // solicitado" no informa de nada — y era justamente para informar para lo que
  // central la pidió.
  {
    id: "ronda-solicitada",
    minuto: 160,
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
          "a las 02:35 horas. Se verifican las tres bahías y el pasillo de acceso, sin " +
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
        clase: "opinion",
        explicacion:
          "No es falso, pero no informa. \"Sin novedad\" resume lo que el guardia concluyó, no lo que verificó: quien lea el libro no sabe si se revisó el cierre perimetral, si se contaron los vehículos o si solo se asomó. El manual pide detallar lo observado en forma pormenorizada, y precisamente por eso.",
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
// El monitor del puesto tiene cuatro cámaras, y resultó que los sucesos del
// turno caen en tres de ellas sin forzar nada: la ronda transcurre en un
// pasillo, el ingreso y la salida ocurren en la reja, la camioneta está en el
// estacionamiento. La bodega no ve ninguno, y así se queda — cuatro cámaras
// donde siempre pasa algo serían cuatro cámaras que nadie mira.
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
}

// El ingreso y la salida comparten la CAM 01 a propósito: son la misma reja
// y la misma camioneta, media hora después. Ver esa repetición en el mismo
// cuadrante es parte de lo que hay que notar para redactarlo bien.
export const CAMARAS_POR_SUCESO: Record<string, TomaDeCamara> = {
  "ronda-inicial": { indice: 2, escena: "pasillo-abierto" },
  "camara-estacionamiento": { indice: 1, escena: "vehiculo-detenido" },
  "ingreso-vehiculo": { indice: 0, escena: "vehiculo-en-reja" },
  "salida-vehiculo": { indice: 0, escena: "vehiculo-saliendo" },
  // Y con esto la CAM 04 deja de ser la cámara donde nunca pasa nada, que es
  // lo que enseñaba a no mirarla.
  "bodega-candado": { indice: 3, escena: "bodega-abierta" },
};