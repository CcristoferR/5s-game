// Datos del Nivel 1 (Seiri / Clasificar).
// ---------------------------------------------------------------------------
// Nivel 1 — Seiri (Seleccionar)
// ---------------------------------------------------------------------------
//
// REESTRUCTURADO SEGÚN EL CURSO. Tres cambios de fondo respecto de la versión
// anterior, cada uno con su fundamento en el material:
//
// 1. EL DESORDEN NO ESPERA ORDENADO SOBRE UNA MESA.
//    Antes los diez objetos estaban alineados sobre el banco de trabajo, a la
//    vista y al alcance. El curso dice lo contrario: el video 1.1 habla de
//    "artículos inútiles o en desuso que están guardados en nuestros cajones o
//    gavetas y a los cuales ya nos hemos acostumbrado", y el 3.1 muestra el
//    caso del cajón lleno de cosas guardadas "por si acaso". El desorden se
//    oculta y estorba: bloquea puertas, ocupa pasillos, llena repisas. Ahora
//    los objetos están repartidos por el taller y hay que buscarlos.
//
// 2. NO EXISTE LA CATEGORÍA "DUDOSO".
//    Era una invención que retrasa la decisión, y Seiri trata justamente de
//    decidir. Lo que el curso plantea para lo que no se resuelve en el momento
//    es la TARJETA ROJA, que no es una tercera pila: es un objeto marcado, con
//    responsable y plazo, que se lleva al área de descarte.
//
// 3. LO PESADO NO SE MUEVE.
//    Video 3.1: si un objeto innecesario es muy pesado, se le pone la tarjeta
//    y se deja en su sitio, con un plazo para gestionar el traslado. Por eso
//    algunos objetos no se pueden arrastrar y solo aceptan tarjeta.
//
// Y el metraje: el área de descarte "nos ayudará a medir en metros cuadrados
// el área de innecesarios que hemos liberado" (3.1). De ahí que cada objeto
// declare cuánto espacio libera.

export type DestinoSeiri = "necesario" | "descartar" | "tarjetaRoja";

export interface ObjetoNivel1 {
  id: string;
  nombreVisible: string;
  posicionInicial: [number, number, number];
  /** Giro inicial. Lo tirado al voleo no está alineado con nada. */
  rotacionY?: number;
  /**
   * Escala propia, si necesita destacar sobre las demás.
   *
   * La usa la caja que bloquea el portón: tiene que leerse como un bulto que
   * impide el paso, no como un objeto más tirado en el suelo.
   */
  escala?: number;
  destino: DestinoSeiri;
  explicacion: string;
  /**
   * No se puede arrastrar: solo admite tarjeta roja en su sitio.
   *
   * Video 3.1: "si un objeto innecesario es muy pesado, se le pone la tarjeta
   * y se deja en su lugar, dando un plazo no mayor a un mes para gestionar su
   * traslado".
   */
  pesado?: boolean;
  /** Metros cuadrados de piso que libera al retirarse. */
  metros: number;
  /** Dónde estorbaba. Se muestra al examinarlo. */
  donde: string;
}

export const objetosNivel1: ObjetoNivel1[] = [
  // --- Estorbando el paso al portón ---
  {
    id: "caja_sin_etiqueta",
    nombreVisible: "Caja sin etiqueta",
    // Delante del portón, apoyada sobre el pallet obsoleto. Es lo primero que
    // se ve al entrar y lo que hace evidente que el paso está bloqueado.
    // En el vano del portón. Es lo primero que se ve al mirar la salida y lo
    // que hace evidente que el paso está tomado.
    // Metida en el vano del portón, contra el marco. Bajada de escala 3,4 a
    // 2,4: a 3,4 no cabía en el cuadro del área de descarte al clasificarla, y
    // una vez etiquetada se encimaba con lo demás.
    posicionInicial: [-0.5, 0, 5.75],
    rotacionY: 0.22,
    escala: 2.4,
    destino: "tarjetaRoja",
    metros: 0.55,
    donde: "Bloqueando el acceso al portón",
    explicacion:
      "Nadie sabe qué contiene ni de quién es. No se puede decidir sin abrirla, así que lleva tarjeta roja con responsable y plazo — pero no se queda ocupando el paso mientras tanto.",
  },
  {
    id: "chatarra_metal",
    nombreVisible: "Pieza de metal sin identificar",
    posicionInicial: [-1.95, 0, 3.95],
    rotacionY: 1.1,
    destino: "descartar",
    metros: 0.14,
    donde: "Tirada en el pasillo de circulación",
    explicacion:
      "No corresponde a ningún equipo del área y está en zona de paso. Chatarra sin función identificada: se descarta.",
  },

  // --- Acumulado sobre los pallets del fondo ---
  {
    id: "diario_viejo",
    nombreVisible: "Diario de hace 6 meses",
    posicionInicial: [1.15, 0, 4.4],
    rotacionY: -0.25,
    destino: "descartar",
    metros: 0.1,
    donde: "Tirado en el suelo, cerca del portón",
    explicacion: "Información desactualizada — ya no aporta valor vigente.",
  },
  {
    id: "guantes_ocasionales",
    nombreVisible: "Guantes de trabajo (uso ocasional)",
    posicionInicial: [-3.95, 0, 0.5],
    rotacionY: -0.4,
    destino: "tarjetaRoja",
    metros: 0.08,
    donde: "Olvidados en un rincón 'por si acaso'",
    explicacion:
      "Están en buen estado pero se usan pocas veces al mes. Es el caso del cajón del curso: se guarda por si acaso. Lleva tarjeta roja para que un responsable decida en plazo si sigue haciendo falta aquí.",
  },

  // --- Olvidado sobre los tambores ---
  {
    id: "taza_cafe",
    nombreVisible: "Taza con café viejo",
    // Al suelo: el tambor que la sostenía se quitó al reordenar la
    // ambientación, y encima quedaba dentro del volumen de clic de la pila
    // registrable, que se llevaba el clic antes que ella.
    posicionInicial: [1.35, 0, -0.75],
    destino: "descartar",
    metros: 0.05,
    donde: "Olvidada en el suelo del taller",
    explicacion:
      "Residuo que no debe permanecer en el área. El curso lo dice sin rodeos: la basura es basura, no hace falta evaluarla ni etiquetarla.",
  },

  // --- En la estantería, mezclado bueno con malo ---
  {
    id: "engrapadora",
    nombreVisible: "Engrapadora",
    posicionInicial: [3.75, 0, 0.45],
    destino: "necesario",
    metros: 0,
    donde: "Tirada en medio del taller",
    explicacion: "Herramienta de uso diario en el puesto de trabajo.",
  },
  {
    id: "manual_procedimientos",
    nombreVisible: "Manual de procedimientos del área",
    posicionInicial: [-2.45, 0, -0.45],
    rotacionY: 0.1,
    destino: "necesario",
    metros: 0,
    donde: "En el suelo, junto al puesto",
    explicacion: "Documento de referencia activa: se consulta para tareas del puesto.",
  },
  {
    id: "casco_agrietado",
    nombreVisible: "Casco de seguridad agrietado",
    posicionInicial: [2.05, 0, -0.6],
    rotacionY: 0.8,
    destino: "descartar",
    metros: 0.12,
    donde: "Tirado en el suelo del taller",
    explicacion:
      "Tiene una grieta visible en el domo — compromete la protección y no cumple norma de seguridad. Un equipo dañado no se guarda 'por si acaso': se descarta.",
  },

  // --- Caído donde nadie mira ---
  {
    id: "cinta_metrica",
    nombreVisible: "Cinta métrica",
    posicionInicial: [-4.9, 0, 0.15],
    rotacionY: 1.4,
    destino: "necesario",
    metros: 0,
    donde: "Caída junto a la pared, donde nadie mira",
    explicacion:
      "Herramienta de medición de uso frecuente. Está en mal sitio, pero es necesaria: va a la zona de necesarios, no a la basura.",
  },
  {
    id: "carpeta_activa",
    nombreVisible: "Carpeta 'Proyecto Activo'",
    posicionInicial: [0.45, 0, 0.85],
    rotacionY: -0.6,
    destino: "necesario",
    metros: 0,
    donde: "En el suelo, en plena zona de paso",
    explicacion: "Documentación en uso, se consulta con frecuencia.",
  },
];

/**
 * Objetos pesados: no se arrastran, solo aceptan tarjeta roja en su sitio.
 *
 * Se declaran aparte porque no comparten mecánica con los demás y porque su
 * forma sale de la utilería del taller que ya existe — un pallet cargado y una
 * pila de tambores— en vez de modelarse otra vez.
 */
export interface PesadoNivel1 {
  id: string;
  nombreVisible: string;
  posicion: [number, number];
  forma: "pallet" | "tambores" | "pila";
  metros: number;
  donde: string;
  explicacion: string;
}

export const pesadosNivel1: PesadoNivel1[] = [
  {
    id: "pallet_obsoleto",
    nombreVisible: "Pallet con material obsoleto",
    posicion: [-2.6, 5.45],
    forma: "pallet",
    metros: 1.44,
    donde: "Atravesado en el pasillo del fondo",
    explicacion:
      "Material de una línea que ya no se produce. Es demasiado pesado para retirarlo ahora, así que se etiqueta en su sitio con un plazo no mayor a un mes para gestionar el traslado.",
  },
  {
    id: "tambores_vacios",
    nombreVisible: "Tambores vacíos (6 unidades)",
    posicion: [2.9, 5.15],
    forma: "tambores",
    metros: 0.9,
    donde: "Apilados delante del portón lateral",
    explicacion:
      "Están vacíos desde hace meses y nadie los reclama. Se marcan con una sola tarjeta para el conjunto: son el mismo material, con el mismo destino y el mismo responsable. Retirarlos requiere transporte, no se resuelve moviéndolos a mano.",
  },
  {
    id: "cajas_apiladas",
    nombreVisible: "Pila de cajas sin identificar",
    posicion: [5.25, 4.4],
    forma: "pila",
    metros: 0.81,
    donde: "Amontonadas contra la pared derecha",
    explicacion:
      "Ninguna tiene rótulo y llevan meses ahí. Una tarjeta para toda la pila: no tiene sentido etiquetar caja por caja cuando comparten origen, destino y responsable — eso solo multiplica el papeleo sin acelerar la decisión.",
  },
];

// Datos del Nivel 2 (Seiton / Ordenar).
// ---------------------------------------------------------------------------
// Nivel 2 — Seiton (Ordenar)
// ---------------------------------------------------------------------------
//
// REESTRUCTURADO SEGÚN EL CURSO.
//
// Lo anterior eran cuatro casillas con carteles de frecuencia —"uso muy
// frecuente", "consulta ocasional"— y el jugador soltaba cada objeto en la
// categoría que le correspondía. Eso es CLASIFICAR, y clasificar ya se hizo en
// el Nivel 1. Seiton es otra cosa: es diseñar el sitio físico.
//
// Video 3.2 (1:52): "un lugar para cada cosa... una etiqueta para cada cosa y
// cada cosa con su etiqueta". Y en 1:38: "es en esta S donde se debe lograr
// que el Gemba o área de trabajo hable por sí solo".
//
// De ahí los tres destinos, que ahora son LUGARES y no conceptos:
//
//   TABLERO DE SOMBRAS   Lo de uso diario, encajado en su silueta pintada. La
//                        silueta ES el lugar: no hay que recordar dónde va
//                        nada, se ve.
//   REPISA MEDIA         Lo de uso ocasional. A la altura de la mano pero sin
//                        ocupar el sitio de lo que se usa a diario.
//   REPISA INFERIOR      Lo pesado, obligatoriamente. Video 3.3 (1:13): "en
//                        estanterías los objetos de gran peso suelen ser
//                        colocados en la parte inferior".
//
// Y la etiqueta aparece sola al acertar: es la segunda mitad de la regla, y
// verla escribirse enseña que sin rótulo el orden no se sostiene.

export type DestinoSeiton = "tablero" | "media" | "inferior";

export interface ObjetoNivel2 {
  id: string;
  nombreVisible: string;
  posicionInicial: [number, number, number];
  rotacionY?: number;
  destino: DestinoSeiton;
  /** Silueta del tablero que le corresponde. Solo para destino "tablero". */
  silueta?: "llave" | "destornillador" | "martillo" | "alicate";
  /** Motivo de su sitio, en el idioma del curso. */
  criterio: string;
  explicacion: string;
}

// Las posiciones iniciales reparten los ocho objetos POR DELANTE de los
// muebles: el puesto de trabajo va a z=3.0 y la estanteria a z=3.2. Ninguno
// arranca dentro de un destino ni encima de un mueble — el nivel empieza con
// todo por el suelo, que es el estado del que parte Seiton.
export const objetosNivel2: ObjetoNivel2[] = [
  // --- Uso diario: tablero de siluetas, sobre el banco de trabajo ---
  {
    id: "llave_fija",
    nombreVisible: "Llave fija",
    posicionInicial: [-3.2, 0, 1.5],
    rotacionY: 0.5,
    destino: "tablero",
    silueta: "llave",
    criterio: "Frecuencia · uso diario",
    explicacion:
      "Se usa todos los días, así que va en el tablero, a la vista y al alcance. Su silueta marca el sitio: si falta, se nota sin abrir ningún inventario.",
  },
  {
    id: "destornillador",
    nombreVisible: "Destornillador",
    posicionInicial: [2.5, 0, 1.8],
    rotacionY: -0.3,
    destino: "tablero",
    silueta: "destornillador",
    criterio: "Frecuencia · uso diario",
    explicacion:
      "Herramienta de uso diario. En el tablero cada una tiene su hueco dibujado — eso es 'un lugar para cada cosa'.",
  },
  {
    id: "martillo",
    nombreVisible: "Martillo",
    posicionInicial: [0.5, 0, -1.2],
    rotacionY: 1.2,
    destino: "tablero",
    silueta: "martillo",
    criterio: "Frecuencia · uso diario",
    explicacion:
      "Uso diario y hay que tomarlo rápido. Colgado en su silueta se agarra de un movimiento, sin buscar en un cajón.",
  },
  {
    id: "alicate",
    nombreVisible: "Alicate",
    posicionInicial: [-1.7, 0, 0.3],
    rotacionY: -0.8,
    destino: "tablero",
    silueta: "alicate",
    criterio: "Frecuencia · uso diario",
    explicacion:
      "Al tablero, junto a las demás herramientas de mano. Todas juntas y todas a la vista: el área habla por sí sola.",
  },

  // --- Uso ocasional: repisa media ---
  {
    id: "manual_referencia",
    nombreVisible: "Manual de referencia",
    posicionInicial: [-3.5, 0, -0.7],
    rotacionY: 0.2,
    destino: "media",
    criterio: "Frecuencia · consulta ocasional",
    explicacion:
      "Se consulta algunas veces por semana. A la altura de la mano, pero sin quitarle el sitio a lo que se usa todos los días.",
  },
  {
    id: "carpeta_activa2",
    nombreVisible: "Carpeta de mantenimiento",
    posicionInicial: [1.5, 0, 0.7],
    rotacionY: -0.5,
    destino: "media",
    criterio: "Frecuencia · consulta ocasional",
    explicacion:
      "Uso ocasional: repisa media. El criterio no es si sirve o no —eso se resolvió en Seiri— sino cada cuánto se toma.",
  },

  // --- Pesado: repisa inferior, obligatoriamente ---
  {
    id: "caja_herramientas",
    nombreVisible: "Caja de herramientas",
    posicionInicial: [-0.6, 0, 2.0],
    rotacionY: 0.4,
    destino: "inferior",
    criterio: "Peso · va abajo",
    explicacion:
      "Pesa demasiado para levantarla a la altura del pecho. Va en la repisa inferior: se toma sin forzar la espalda y, si se cae, no cae desde arriba.",
  },
  {
    id: "bidon_aceite",
    nombreVisible: "Bidón de aceite",
    posicionInicial: [3.4, 0, -0.6],
    destino: "inferior",
    criterio: "Peso · va abajo",
    explicacion:
      "Lleno pesa más de veinte kilos. El peso manda sobre la frecuencia: aunque se usara a diario, arriba sería un riesgo cada vez que hay que bajarlo.",
  },
];

// Datos del Nivel 3 (Seiso / Limpiar) — dos incidentes independientes.
export interface ManchaIncidente {
  id: string;
  posicion: [number, number];
  tipoVisual: "aceite" | "polvo";
}

/** Dónde se esconde una mancha que no está a la vista. */
export interface SuciedadOculta {
  /** Punto donde se apoya el bulto que la tapa. */
  posicionBulto: [number, number];
  /** Aviso al destaparla. */
  hallazgo: string;
}

export interface OpcionCausaNivel3 {
  id: string;
  texto: string;
  esCorrecta: boolean;
  explicacion: string;
}

export interface IncidenteNivel3 {
  id: string;
  nombreVisible: string;
  manchas: ManchaIncidente[];
  pregunta: string;
  opciones: OpcionCausaNivel3[];
  /**
   * Estas manchas las alimenta una fuente activa.
   *
   * Mientras no se elimine la fuente, no se dejan limpiar: se puede frotar
   * todo lo que se quiera y vuelven. Video 3.4 (1:40): hay que "eliminar la
   * suciedad y las fuentes de suciedad".
   */
  requiereFuenteSellada?: boolean;
  /** Si está, el incidente arranca tapado y hay que descubrirlo. */
  oculta?: SuciedadOculta;
}

export const incidentesNivel3: IncidenteNivel3[] = [
  {
    id: "incidente_aceite",
    nombreVisible: "Manchas junto a la máquina",
    manchas: [
      { id: "m1", posicion: [1.7, -0.3], tipoVisual: "aceite" },
      { id: "m2", posicion: [2.8, 0.45], tipoVisual: "aceite" },
      { id: "m3", posicion: [3.3, -0.7], tipoVisual: "aceite" },
    ],
    requiereFuenteSellada: true,
    pregunta: "¿Cuál es el origen más probable de estas manchas de aceite?",
    opciones: [
      { id: "fuga_maquina", texto: "Fuga de aceite en la máquina cercana", esCorrecta: true, explicacion: "Correcto — las manchas concentradas cerca del mismo punto suelen indicar una fuga activa, no derrames aislados." },
      { id: "filtro_sucio", texto: "Filtro de aire sucio", esCorrecta: false, explicacion: "Un filtro sucio afecta el rendimiento del equipo, pero no genera manchas de aceite en el suelo." },
      { id: "mal_habito", texto: "Mal hábito del turno anterior", esCorrecta: false, explicacion: "Posible, pero manchas repetidas en el mismo lugar apuntan primero a una causa mecánica, no humana." },
    ],
  },
  {
    id: "incidente_polvo",
    nombreVisible: "Polvo negro junto a la impresora",
    manchas: [
      { id: "m4", posicion: [-3.7, 1.1], tipoVisual: "polvo" },
      { id: "m5", posicion: [-2.7, 2.2], tipoVisual: "polvo" },
    ],
    pregunta: "¿Cuál es el origen más probable de este polvo negro junto a la impresora?",
    opciones: [
      { id: "cartucho_danado", texto: "Cartucho de tóner dañado", esCorrecta: true, explicacion: "Correcto — un cartucho agrietado libera tóner en polvo, que se acumula cerca del equipo." },
      { id: "ventilacion", texto: "Falta de mantenimiento del ventilador", esCorrecta: false, explicacion: "Un ventilador sucio afecta la temperatura del equipo, pero no genera polvo negro visible en el suelo." },
      { id: "humedad", texto: "Humedad ambiental", esCorrecta: false, explicacion: "La humedad no produce residuo negro en polvo — ese patrón es típico de tóner, no de humedad." },
    ],
  },
  {
    // ---------------------------------------------------------------------
    // EL INCIDENTE OCULTO
    // ---------------------------------------------------------------------
    //
    // No se ve desde ningún ángulo: está debajo del bidón. Es el que convierte
    // el nivel en una inspección — Video 3.4 (0:41), la limpieza se hace "con
    // el objetivo final de poder realizar una inspección a nuestros equipos y
    // áreas".
    //
    // SU PREGUNTA ES DE OTRA NATURALEZA, a propósito. Las dos anteriores
    // preguntan por la causa física y se responden mirando el equipo. Esta ya
    // no: la causa física es evidente en cuanto se aparta el bidón. Lo que hay
    // que explicar es por qué estuvo meses ahí sin que nadie lo viera, que es
    // una falla del método de limpieza y no del equipo. Repetir el mismo
    // formato una tercera vez convertiría el nivel en un cuestionario; cambiar
    // el tipo de pregunta lo cierra abriendo la puerta a Seiketsu.
    id: "incidente_oculto",
    nombreVisible: "Charco bajo el bidón de aceite",
    oculta: {
      posicionBulto: [-2.0, -0.9],
      hallazgo:
        "Un charco seco debajo del bidón. Llevaba meses ahí y nadie lo vio, porque nadie movió el bidón.",
    },
    manchas: [{ id: "m6", posicion: [-2.0, -0.9], tipoVisual: "aceite" }],
    pregunta: "El charco estuvo meses tapado. ¿Qué hay que corregir para que no vuelva a pasar?",
    opciones: [
      {
        id: "rutina_inspeccion",
        texto: "La rutina de limpieza: debe incluir mover lo apoyado e inspeccionar debajo",
        esCorrecta: true,
        explicacion:
          "Correcto — en Seiso se limpia PARA inspeccionar. Una rutina que solo pasa por lo que está a la vista deja fuera justo lo que lleva más tiempo sin revisarse.",
      },
      {
        id: "limpiar_mas",
        texto: "Aumentar la frecuencia de limpieza del piso",
        esCorrecta: false,
        explicacion:
          "Limpiar más seguido lo mismo no descubre nada nuevo: el charco seguiría bajo el bidón la próxima vez y la siguiente.",
      },
      {
        id: "mover_bidon",
        texto: "Sacar el bidón del área de trabajo",
        esCorrecta: false,
        explicacion:
          "Eso resuelve este bidón y ninguno más. El problema no es el objeto, es que la inspección no llega a lo que está debajo de las cosas.",
      },
    ],
  },
];

// ===========================================================================
// Datos del Nivel 4 (Seiketsu / Estandarizar)
// ===========================================================================
//
// Video 4.2 (1:32): "en el caso de la utilizacion del control visual
// emplearemos letreros, carteles, Andon, senalizacion de caminos, senales y
// Kanban". El nivel monta tres estaciones, y cada una demuestra un GRADO DE
// CONTROL distinto sobre el mismo error. Ese orden es la leccion:
//
//   A. POKA-YOKE — el error es IMPOSIBLE.
//      Video 4.2 (2:38): "a prueba de tontos... permite evitar errores debido
//      a la facilidad grafica y de espacio. Un ejemplo es el de rompecabezas
//      donde una pieza solo encaja en un sitio especifico". El conector no
//      entra en el puerto equivocado. No hay aviso porque no hace falta.
//
//   B. ANDON — el error es POSIBLE pero se avisa al instante.
//      La zona parpadea en rojo y suena la chicharra. Peor que A: el error
//      ocurre, y solo se corrige porque alguien lo ve.
//
//   C. CONVENCION DE COLOR — el error es POSIBLE y NADIE lo avisa.
//      Video 4.2 (5:29): "estos interruptores estan senalizados segun
//      colores... los focos pertenecientes a dichos interruptores estan
//      senalizados con el mismo color". Nada impide pintar un interruptor del
//      color equivocado: la instalacion sigue funcionando y el fallo solo
//      aparece cuando alguien audita. Es el control mas debil de los tres, y
//      por eso es el unico que viaja al Nivel 5 como senalizacion auditable.

// --- Estacion A: Poka-Yoke ---------------------------------------------------

export type FormaConector = "triangulo" | "cuadrado" | "circulo";

export interface PuertoNivel4 {
  id: string;
  forma: FormaConector;
  etiqueta: string;
  /** Desplazamiento lateral dentro del armario, en metros. */
  desplazamiento: number;
}

export interface ConectorNivel4 {
  id: string;
  nombreVisible: string;
  forma: FormaConector;
  /** Posicion de partida, sobre el banco. */
  posicionInicial: [number, number, number];
  explicacion: string;
}

export const puertosNivel4: PuertoNivel4[] = [
  { id: "puerto_potencia", forma: "cuadrado", etiqueta: "POTENCIA", desplazamiento: -0.42 },
  { id: "puerto_senal", forma: "triangulo", etiqueta: "SE\u00d1AL", desplazamiento: 0 },
  { id: "puerto_tierra", forma: "circulo", etiqueta: "TIERRA", desplazamiento: 0.42 },
];

export const conectoresNivel4: ConectorNivel4[] = [
  {
    id: "cable_potencia",
    nombreVisible: "Cable de potencia",
    forma: "cuadrado",
    posicionInicial: [-1.4, 0, 0.6],
    explicacion:
      "Entra solo en POTENCIA porque su forma no encaja en ningun otro puerto. No hizo falta ningun cartel ni ninguna alarma: el error era imposible.",
  },
  {
    id: "cable_senal",
    nombreVisible: "Cable de se\u00f1al",
    forma: "triangulo",
    posicionInicial: [-0.2, 0, 1.0],
    explicacion:
      "Poka-yoke por geometria: la pieza solo encaja en un sitio. Es el control mas fuerte que existe, porque no depende de que nadie preste atencion.",
  },
  {
    id: "cable_tierra",
    nombreVisible: "Cable de tierra",
    forma: "circulo",
    posicionInicial: [0.9, 0, 0.5],
    explicacion:
      "Con el equipo conectado a tierra en su propio puerto, nadie puede invertirlo por descuido en el turno de noche. El estandar se sostiene solo.",
  },
];

// --- Estacion B: Andon -------------------------------------------------------

export interface ZonaPisoNivel4 {
  id: string;
  etiqueta: string;
  centro: [number, number];
  ancho: number;
  fondo: number;
}

export interface MarcaNivel4 {
  id: string;
  nombreVisible: string;
  /** Lo que queda pintado en el piso al colocarla. */
  textoPintado: string;
  zonaCorrecta: string;
  /**
   * Un estandar sin medida no es un estandar.
   *
   * La marca generica cae DENTRO de la zona correcta, asi que el Andon no la
   * rechaza: una luz detecta un sitio equivocado, no un texto vago. Es el
   * unico error de este nivel que sobrevive a los tres controles y llega vivo
   * a la auditoria del Nivel 5.
   */
  esEspecifica: boolean;
  explicacion: string;
}

export const zonasPisoNivel4: ZonaPisoNivel4[] = [
  { id: "zona_pasillo", etiqueta: "PASILLO", centro: [0, 2.1], ancho: 5.0, fondo: 1.05 },
  { id: "zona_extintor", etiqueta: "EXTINTOR", centro: [-3.9, 0.6], ancho: 0.95, fondo: 0.95 },
  { id: "zona_pallets", etiqueta: "PALLETS", centro: [3.6, 0.6], ancho: 1.5, fondo: 1.5 },
];

export const marcasNivel4: MarcaNivel4[] = [
  {
    id: "marca_pasillo",
    nombreVisible: "Plantilla: pasillo con medida",
    textoPintado: "PASILLO \u00b7 DESPEJADO 1,20 m",
    zonaCorrecta: "zona_pasillo",
    esEspecifica: true,
    explicacion:
      "Con la medida escrita en el piso, cualquiera sabe si el pasillo cumple sin preguntarle a nadie. Eso es un estandar.",
  },
  {
    id: "marca_generica",
    nombreVisible: "Plantilla: zona ordenada",
    textoPintado: "ZONA ORDENADA",
    zonaCorrecta: "zona_pasillo",
    esEspecifica: false,
    explicacion:
      "El sitio es el correcto, por eso el Andon no dijo nada: una luz detecta una posicion equivocada, no un texto vago. Pero \u00abordenada\u00bb no se puede medir, asi que este punto nunca se va a poder dar por cumplido en una auditoria.",
  },
  {
    id: "marca_extintor",
    nombreVisible: "Plantilla: extintor",
    textoPintado: "EXTINTOR \u00b7 NO OBSTRUIR",
    zonaCorrecta: "zona_extintor",
    esEspecifica: true,
    explicacion:
      "El area del extintor demarcada en el piso es senalizacion de caminos pura: se ve ocupada de lejos, sin tener que llegar hasta ahi.",
  },
  {
    id: "marca_pallets",
    nombreVisible: "Plantilla: pallets",
    textoPintado: "ZONA DE PALLETS",
    zonaCorrecta: "zona_pallets",
    esEspecifica: true,
    explicacion:
      "Delimitar donde van los pallets evita que el material invada el paso. El limite pintado hace de recordatorio permanente.",
  },
];

// --- Estacion C: convencion de color -----------------------------------------

export interface ColorNivel4 {
  id: string;
  nombreVisible: string;
  hex: string;
}

export interface CircuitoNivel4 {
  id: string;
  /** Lo que dice la placa del interruptor. */
  descripcion: string;
  colorCorrectoId: string;
  /** Donde cuelga el foco de este circuito. */
  lampara: [number, number];
  /** Desplazamiento lateral dentro del panel. */
  desplazamiento: number;
}

export const coloresNivel4: ColorNivel4[] = [
  { id: "color_rojo", nombreVisible: "Rojo", hex: "#c0392b" },
  { id: "color_azul", nombreVisible: "Azul", hex: "#2c6fb5" },
  { id: "color_verde", nombreVisible: "Verde", hex: "#2e8b52" },
  { id: "color_amarillo", nombreVisible: "Amarillo", hex: "#d4a017" },
];

export const circuitosNivel4: CircuitoNivel4[] = [
  {
    id: "circuito_banco",
    descripcion: "Circuito del banco de trabajo",
    colorCorrectoId: "color_rojo",
    lampara: [0, -0.5],
    desplazamiento: -0.44,
  },
  {
    id: "circuito_pallets",
    descripcion: "Circuito de la zona de pallets",
    colorCorrectoId: "color_azul",
    lampara: [3.6, 0.6],
    desplazamiento: 0,
  },
  {
    id: "circuito_extintor",
    descripcion: "Circuito del extintor",
    colorCorrectoId: "color_verde",
    lampara: [-3.9, 0.6],
    desplazamiento: 0.44,
  },
];

export type TipoEvidencia = "tarjetaVencida" | "manchaVisible" | "objetoFueraDeLugar" | "sinProblema";

export interface PuntoControlNivel5 {
  id: string;
  posicion: [number, number];
  descripcionControl: string;
  /**
   * Rótulo corto de la estación, para el cartel que se ve en el galpón.
   *
   * La descripción larga sigue existiendo y es la que aparece en el informe
   * final, donde hay sitio para leerla. En la escena no: cinco frases de tres
   * renglones flotando a la vez tapan justo lo que hay que mirar y compiten
   * entre ellas. En el galpón basta con saber QUÉ se audita en cada estación;
   * el juicio se hace mirando la evidencia, no leyendo.
   */
  tituloControl: string;
  tieneDesviacion: boolean;
  tipoEvidencia: TipoEvidencia;
  /**
   * Qué objeto se ve en el pedestal.
   *
   * Sin esto, todos los puntos "sinProblema" dibujaban la misma caja gris,
   * dijera lo que dijera su descripción: uno hablaba del teléfono, otro de la
   * carpeta, y en pantalla eran idénticos. Para auditar hay que poder mirar el
   * punto y reconocer QUÉ se está evaluando, no leer un rótulo para saberlo.
   */
  objeto?: "telefono" | "carpeta" | "engrapadora";
  // Calificación real del punto de control en escala 1-5, como en un
  // checklist de auditoría de industria: 1-2 = incumple, 4-5 = cumple.
  // Es independiente de si el jugador acierta o no al marcarlo.
  calificacion: number;
  explicacion: string;
}

export const puntosControlRespaldoNivel5: PuntoControlNivel5[] = [
  { id: "resp_p1", tituloControl: "Teléfono", posicion: [-4, 0.4], descripcionControl: "Ubicación del teléfono según estándar", tieneDesviacion: false, tipoEvidencia: "sinProblema", objeto: "telefono", calificacion: 5, explicacion: "El teléfono está en su lugar asignado — sin desviación." },
  { id: "resp_p2", tituloControl: "Tarjeta roja", posicion: [-2, -0.3], descripcionControl: "Vigencia de la tarjeta roja del área", tieneDesviacion: true, tipoEvidencia: "tarjetaVencida", calificacion: 1, explicacion: "La tarjeta roja está vencida hace 2 semanas — debía renovarse." },
  { id: "resp_p3", tituloControl: "Puesto", posicion: [0, 0.5], descripcionControl: "Estado de limpieza del área de trabajo", tieneDesviacion: true, tipoEvidencia: "manchaVisible", calificacion: 2, explicacion: "Apareció una mancha nueva desde la última auditoría." },
  { id: "resp_p4", tituloControl: "Carpeta", posicion: [2, -0.2], descripcionControl: "Ubicación de la carpeta de proyecto", tieneDesviacion: false, tipoEvidencia: "sinProblema", objeto: "carpeta", calificacion: 4, explicacion: "La carpeta está archivada correctamente según el estándar." },
  { id: "resp_p5", tituloControl: "Estante", posicion: [4, 0.3], descripcionControl: "Organización general del estante", tieneDesviacion: true, tipoEvidencia: "objetoFueraDeLugar", objeto: "engrapadora", calificacion: 2, explicacion: "Un objeto quedó fuera de su casilla asignada." },
];

// ---------------------------------------------------------------------------
// Apertura de cada nivel: contexto y pregunta
// ---------------------------------------------------------------------------
//
// Antes de la parte interactiva, cada nivel plantea la SITUACION en la que esta
// el jugador y la DECISION que tiene que tomar. La idea es que no llegue a
// arrastrar objetos sin saber por que lo hace: el objetivo pedagogico del
// proyecto es que practique la toma de decision dentro de cada fase, no que
// memorice los nombres de las 5S.
//
// Los cinco contextos estan encadenados a proposito: son el mismo puesto de
// trabajo a lo largo del tiempo, y cada uno arranca donde termino el anterior.
// Leidos seguidos cuentan la historia completa de la transformacion.
export interface BriefingNivel {
  /** Termino japones de la fase. */
  fase: string;
  /** Traduccion al castellano. */
  traduccion: string;
  /** La situacion: donde esta parado el jugador y como llego hasta ahi. */
  contexto: string;
  /** La decision concreta que tiene que resolver jugando. */
  pregunta: string;
  /**
   * Color de acento de la fase, en hexadecimal CSS.
   *
   * Deliberadamente desaturados: el color solo sirve para identificar en que
   * fase esta el jugador, y se usa en dosis chicas (un punto, un rotulo, el
   * boton). Con tonos saturados la tarjeta competia con su propio texto.
   */
  color: string;
}

export const briefingsNiveles: Record<number, BriefingNivel> = {
  1: {
    fase: "Seiri",
    traduccion: "Clasificar",
    contexto:
      "Es tu primer turno a cargo del taller. Quien estuvo antes dejó el banco cubierto de cosas: herramientas, elementos de protección, papeles, chatarra. Nadie te supo decir qué se sigue usando y qué lleva meses sin tocarse.",
    pregunta: "¿Qué se queda, qué queda en observación con tarjeta roja y qué se va del puesto?",
    color: "#7fb495",
  },
  2: {
    fase: "Seiton",
    traduccion: "Ordenar",
    contexto:
      "Sobre el banco quedó solo lo necesario, pero sigue siendo un montón sin lugar asignado. Cada búsqueda cuesta minutos y, si al final del turno falta una herramienta, nadie se da cuenta hasta el día siguiente.",
    pregunta: "¿Dónde va cada cosa para que cualquiera la encuentre — y note su ausencia — sin preguntarle a nadie?",
    color: "#7ea3ba",
  },
  3: {
    fase: "Seiso",
    traduccion: "Limpiar",
    contexto:
      "Con el puesto despejado y cada cosa en su lugar quedan a la vista manchas que antes tapaba el desorden: aceite en el piso junto al equipo y un polvo negro debajo de la impresora.",
    pregunta: "¿Alcanza con limpiarlas, o hay algo que las sigue produciendo?",
    color: "#bda079",
  },
  4: {
    fase: "Seiketsu",
    traduccion: "Estandarizar",
    contexto:
      "El puesto quedó ordenado, limpio y con la fuga reparada. El problema es que todo eso vive en tu cabeza: mañana entra un operario nuevo a tu turno y tú no vas a estar para explicarle.",
    pregunta: "¿Qué instrucciones y qué señales dejas para que cualquiera lo mantenga igual sin ti?",
    color: "#9a91b8",
  },
  5: {
    fase: "Shitsuke",
    traduccion: "Disciplina",
    contexto:
      "Pasaron varias semanas desde que dejaste el estándar por escrito. Hoy llega una auditoría sorpresa y te toca recorrer el puesto aplicando el mismo checklist que tú construiste, contra reloj.",
    pregunta: "¿El estándar se sostuvo en el tiempo, o hay desviaciones que nadie corrigió?",
    color: "#b98d7e",
  },
};

// Segundo paso de la apertura: el concepto de 5S que el nivel pone en juego.
//
// Va DESPUES del contexto y la pregunta, a proposito. Primero el jugador se
// ubica en la situacion y entiende que tiene que decidir; recien ahi se le da
// la herramienta conceptual con la que va a decidir. Al reves seria teoria
// suelta, sin un problema al que aplicarla.
//
// El Nivel 5 no lleva: a esa altura el jugador ya recorrio las cuatro fases y
// lo que le toca es aplicar el estandar que el mismo construyo, no aprender un
// concepto nuevo.
export interface MicroLeccionNivel {
  titulo: string;
  texto: string;
}

export const microLeccionesNiveles: Record<number, MicroLeccionNivel> = {
  1: {
    titulo: "¿Qué es una tarjeta roja?",
    texto:
      "Es la etiqueta que se pone a lo innecesario que no se puede resolver en el momento. Siempre lleva dos datos: un responsable que le haga seguimiento y un plazo para tomar acción. Sin ellos la etiqueta se queda puesta para siempre, y eso es el mismo desorden con otro nombre. Si el objeto es muy pesado, se etiqueta en su sitio con un plazo no mayor a un mes.",
  },
  2: {
    titulo: "¿Qué es un shadow board?",
    texto:
      "Es un tablero con el contorno de cada herramienta pintado — así cualquiera nota de inmediato si algo falta o está fuera de su lugar, sin tener que leer nada.",
  },
  3: {
    titulo: "Limpieza como inspección",
    texto:
      "En 5S, limpiar no es solo dejar todo brillante: es una forma de inspección. Cada mancha es una pista. Este nivel usa el método de los '5 porqués' — preguntarse repetidamente 'por qué' hasta llegar a la causa real, no al síntoma.",
  },
  4: {
    titulo: "Estandarizar es hacerlo replicable",
    texto:
      "Un buen estándar — checklist más señalética de color — tiene que ser tan claro que cualquiera pueda seguirlo sin ayuda. Acá un operario va a poner el tuyo a prueba: si es ambiguo, fallará.",
  },
};

// ---------------------------------------------------------------------------
// Pregunta de cierre de cada nivel
// ---------------------------------------------------------------------------
//
// Al terminar la parte interactiva, cada nivel plantea un caso y pide decidir.
// Es el mismo mecanismo que ya usaba el modo detective del Nivel 3, extendido a
// todos los modos.
//
// NO son preguntas de memoria. Ninguna se responde recordando qué significa
// Seiri o Seiton: todas presentan una situación nueva del taller y piden
// aplicar el criterio que el nivel acaba de hacer practicar. Esa diferencia es
// el objetivo pedagógico del proyecto — que el jugador practique la toma de
// decisión dentro de cada fase, no que memorice los nombres de las cinco.
//
// Las opciones incorrectas son a propósito razonables: son los atajos que
// cualquiera tomaría en una planta real. Una alternativa absurda no enseña
// nada, porque se descarta sin pensar.

export interface OpcionCierre {
  id: string;
  texto: string;
  esCorrecta: boolean;
  explicacion: string;
}

export interface PreguntaCierre {
  /** Rótulo en mayúscula chica sobre la pregunta. */
  rotulo: string;
  pregunta: string;
  opciones: OpcionCierre[];
}

export const preguntasCierre: Record<number, PreguntaCierre> = {
  1: {
    rotulo: "ANTES DE CERRAR EL TURNO",
    pregunta: "Aparece una herramienta que nadie recuerda haber usado este año. ¿Qué corresponde hacer?",
    opciones: [
      {
        id: "n1_tirar",
        texto: "Descartarla: si no se usó en un año, no hace falta",
        esCorrecta: false,
        explicacion:
          "Descartar sin verificar es el error más caro de Seiri. Puede ser un repuesto crítico de una máquina que se usa una vez al año, y reponerlo cuesta mucho más que guardarlo.",
      },
      {
        id: "n1_dejar",
        texto: "Dejarla donde está hasta que alguien la reclame",
        esCorrecta: false,
        explicacion:
          "No decidir también es una decisión, y es la que genera el desorden original: así fue como el puesto llegó a estar como lo encontraste.",
      },
      {
        id: "n1_tarjeta",
        texto: "Ponerle tarjeta roja y fijar un plazo para decidir",
        esCorrecta: true,
        explicacion:
          "Exacto. La tarjeta roja no descarta: deja constancia de la duda y le pone fecha. Si el plazo vence sin que nadie la use, ahí sí se descarta con fundamento.",
      },
    ],
  },
  2: {
    rotulo: "ORGANIZANDO EL TABLERO",
    pregunta:
      "Dos herramientas se usan a diario, pero una pesa 12 kg. ¿Cómo conviene ubicarlas en el tablero?",
    opciones: [
      {
        id: "n2_igual",
        texto: "Las dos juntas al mismo estante, porque se usan igual de seguido",
        esCorrecta: false,
        explicacion:
          "La frecuencia manda en la distancia, no en la altura. Agrupar por frecuencia y olvidar el peso obliga a levantar 12 kg desde una posición incómoda varias veces por día.",
      },
      {
        id: "n2_ergonomia",
        texto: "La pesada a la altura de la cintura y la liviana a la altura de los ojos",
        esCorrecta: true,
        explicacion:
          "Correcto. Seiton combina frecuencia con ergonomía: lo pesado va donde se levanta sin forzar la espalda, y lo liviano puede ir más arriba, donde además se ve mejor.",
      },
      {
        id: "n2_arriba",
        texto: "La pesada en el estante más alto, para dejar libre el espacio de abajo",
        esCorrecta: false,
        explicacion:
          "Es lo contrario de lo que corresponde: bajar 12 kg desde encima de la cabeza es una de las maniobras que más lesiones causa en planta.",
      },
    ],
  },
  4: {
    rotulo: "REDACTANDO EL ESTÁNDAR",
    pregunta: "¿Cuál de estas instrucciones funciona como estándar?",
    opciones: [
      {
        id: "n4_vaga",
        texto: "Mantener el puesto ordenado al terminar",
        esCorrecta: false,
        explicacion:
          "Suena bien pero no dice nada verificable: cada persona entiende otra cosa por ordenado. Es la instrucción ambigua con la que el operario falló recién.",
      },
      {
        id: "n4_precisa",
        texto: "Devolver cada herramienta a su silueta antes de cerrar el turno",
        esCorrecta: true,
        explicacion:
          "Exacto. Dice qué hacer, con qué referencia y cuándo. Cualquiera puede cumplirla sin preguntar, y cualquiera puede verificar si se cumplió.",
      },
      {
        id: "n4_dependiente",
        texto: "Ordenar el puesto cuando el supervisor lo indique",
        esCorrecta: false,
        explicacion:
          "Un estándar que depende de que alguien avise no es un estándar: es una orden. Si el supervisor no está, el puesto queda sin criterio.",
      },
    ],
  },
  5: {
    rotulo: "DESPUÉS DE LA AUDITORÍA",
    pregunta:
      "El mismo punto de control aparece con desviación en tres auditorías seguidas. ¿Qué corresponde hacer?",
    opciones: [
      {
        id: "n5_corregir",
        texto: "Corregir la desviación y seguir, como las veces anteriores",
        esCorrecta: false,
        explicacion:
          "Corregir el síntoma tres veces y esperar un resultado distinto la cuarta es exactamente lo que Shitsuke busca evitar.",
      },
      {
        id: "n5_recordar",
        texto: "Recordarle al equipo que tiene que cumplir el estándar",
        esCorrecta: false,
        explicacion:
          "Cuando algo falla siempre en el mismo punto, el problema rara vez es la voluntad de la gente. Insistir sin cambiar nada desgasta al equipo y no corrige la causa.",
      },
      {
        id: "n5_revisar",
        texto: "Revisar si el estándar es realista en ese punto y ajustarlo",
        esCorrecta: true,
        explicacion:
          "Correcto. Una desviación que se repite es señal de que el estándar no es aplicable ahí: falta tiempo, espacio o herramienta. La disciplina se sostiene ajustando el estándar, no exigiendo más.",
      },
    ],
  },
};