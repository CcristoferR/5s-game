import type { IdZona } from "./ZonasSupermercado";
import type { OpcionSituacion, ClaseRespuesta } from "./PanelesSupermercado";

// ===========================================================================
// Las situaciones del turno: lo que pasa en la sala mientras haces la ronda
// ===========================================================================
//
// Ocho momentos repartidos por el turno y por las cuatro zonas —más uno
// encadenado—. Cada uno ocurre a su minuto, en su sitio, y solo se ve si estás
// ahí cuando ocurre.
//
// ─── CINCO REALES Y TRES INOCENTES ───────────────────────────────────────
//
// Las inocentes son las que rompen el instinto de atrapar al malo. Sin ellas,
// el jugador aprende que todo lo que le señalan es un delito y acierta
// interviniendo siempre. Con ellas tiene que mirar de verdad: la señora que
// hace señas al principio y la que hace señas a las 17:08 hacen el mismo
// gesto, y lo que cambia es lo que pasa DETRÁS de la segunda.
//
// Por eso están emparejadas a propósito con una real cada una:
//
//   · Te hacen señas para preguntarte algo  ↔  te hacen señas para
//     distraerte mientras otro se llena la chaqueta.
//   · Deja el canasto para hablar por teléfono  ↔  deja una mochila y se va
//     del local.
//   · Lee un producto y lo DEVUELVE al estante  ↔  lo toma y se lo guarda.
//
// ─── POR QUÉ CENTRAL TE DICE DÓNDE, PERO NO QUÉ ─────────────────────────
//
// Estuvo sin aviso ninguno —"en un puesto nadie te avisa"—, y era falso dos
// veces. Falso en el oficio: un guardia de sala tiene detrás a un operador de
// cámaras que le pide por radio que revise tal pasillo. Y falso en el juego:
// alguien que no lo ha jugado nunca no sabe que tiene que mirar a las personas,
// ni hacia dónde, y se pasa el turno caminando entre situaciones sin verlas.
//
// Central dice DÓNDE, nunca QUÉ. Y lo dice igual para las inocentes: el
// operador también ve cosas raras que no son nada, y te manda a mirarlas. Así
// el aviso lleva al jugador al sitio sin darle la respuesta.
//
// La consecuencia sigue siendo dura: si no llegas mientras está pasando, pasa
// igual. Y ahora te enteras después, por la misma radio.
//
// ─── POR QUÉ UNA VENTANA Y NO EL MINUTO EXACTO ───────────────────────────
//
// Porque el minuto exacto no se puede jugar. El reloj corre a 0,7 minutos de
// turno por segundo real, así que un minuto dura segundo y medio: exigir
// estar en la zona en ESE instante no premia recorrer el local, premia el
// azar de dónde te pilló.
//
// Con ventana, la situación está OCURRIENDO durante un rato —el cliente sigue
// en el pasillo, la salida sigue bloqueada— y la ves si entras a la zona
// mientras dura. Eso sí es "llegar a tiempo", y es lo que pasa de verdad: los
// hechos duran, no son fotogramas.
//
// ─── POR QUÉ ESTOS MINUTOS ───────────────────────────────────────────────
//
// 6, 25, 42, 58, 68, 84, 94 y 106, y ninguno cae en una apertura de ronda (0,
// 30, 60, 90).
// Si cayeran juntos, el jugador recibiría en el mismo instante el repintado de
// la lista de la ronda nueva y un panel encima, y no sabría cuál de los dos
// estaba atendiendo. Separados, cada cosa se lee sola.
//
// La primera va a los seis minutos y en la entrada, a pocos metros de donde
// empieza el jugador, y es inocente: es la que enseña cómo funciona todo —el
// aviso, quedarse mirando, el panel— antes de que haya nada que perder.
//
// Y entre una y otra hay veinte segundos reales largos. Estuvieron más juntas y
// quedaban demasiado para lo que cada una pide: el hurto no se
// resuelve mirando un panel, se resuelve siguiendo a alguien hasta la caja y
// llevándolo después a la oficina — un minuto entero de juego— y a mitad de
// ese minuto se abría la de la cajera, en la misma zona, encima. Dos cosas a
// la vez en el mismo sitio no son dos situaciones: son una sola confusa.
//
// ─── POR QUÉ TRES RESPUESTAS Y NO CUATRO ─────────────────────────────────
//
// Porque son las tres que tiene un guardia de verdad: mirar, informar o
// actuar. El libro del condominio enseña a REDACTAR lo que ya ocurrió; esto
// enseña lo anterior, que es decidir qué haces mientras está ocurriendo.
//
// Y la correcta no es siempre la misma. Si "avisar" fuera siempre la buena,
// el ejercicio se resolvería sin leer: bastaría aprenderse la palabra. De las
// nueve, tres se resuelven mirando, tres informando y tres actuando, porque el
// criterio no es una regla fija sino qué está en juego en cada caso.
//
// ─── Y LA MISMA PALABRA PUEDE SER LAS DOS COSAS ──────────────────────────
//
// En el pasillo, INTERVENIR es el error. Quince minutos después, pasada la
// línea de cajas, INTERVENIR es lo correcto — y es el mismo verbo. Esa pareja
// es el centro del nivel: lo que decide no es qué haces, es cuándo. No se
// puede enseñar con una situación suelta, hace falta dejar equivocarse
// primero y que la segunda llegue después.
//
// La regla de "una opción por clase" se rompe en la segunda, y se explica ahí.
// Con el tipo delante y la puerta a diez metros, informar ya no es una opción
// por sí sola: lo que se decide es cómo se actúa.
//
// ─── CUIDADO AL ENCADENAR ────────────────────────────────────────────────
//
// `requiere` empareja por CLASE, así que una situación a la que apunte otra no
// puede repetir clase entre sus opciones. La del pasillo tiene las tres
// distintas y por eso sirve de disparador; la de la caja repite y por eso no
// podría ser el requisito de una tercera sin cambiar esto.

/**
 * Cuántos minutos de turno se queda cada situación disponible.
 *
 * ─── DE DÓNDE SALE EL QUINCE ─────────────────────────────────────────────
 *
 * De las dos medidas que lo acotan por abajo y por arriba.
 *
 * Por abajo, la sala. A 1,1 minutos de turno por segundo real, quince minutos
 * son trece segundos y medio, y caminando a 1,74 m/s —medido sobre la cámara
 * del recorrido— eso son casi veinticuatro metros. La diagonal del local son
 * veinte. Es decir: desde cualquier punto de la sala se llega a cualquier
 * zona dentro de la ventana. Con doce no se llegaba, y una situación a la que
 * es imposible llegar no es difícil, es decorativa.
 *
 * Por arriba, la ronda. Cada ronda dura treinta minutos y obliga a pisar las
 * cuatro zonas. Si la ventana durase la ronda entera, cualquier vuelta medio
 * hecha las cazaría todas y no habría nada que perderse. En dieciocho de cada
 * treinta, la ronda hecha con cabeza llega y la hecha a la carrera se deja
 * alguna, que es exactamente la diferencia que el nivel quiere enseñar.
 *
 * La última cierra su ventana con el turno. No es descuido: que la última se
 * juegue contra el cierre es lo que hace que las dos horas terminen en algo y
 * no se apaguen solas.
 */
export const VENTANA_SITUACION = 18;

export interface Situacion {
  id: string;
  /** Minuto del turno en que empieza a ocurrir. */
  minuto: number;
  /** Cuánto dura disponible. Por defecto, VENTANA_SITUACION. */
  ventana?: number;
  /**
   * Lo que tiene que haberse respondido antes para que esto llegue a pasar.
   *
   * ─── PARA QUÉ ──────────────────────────────────────────────────────────
   *
   * Para que lo que el jugador decide cambie lo que ve después, y no solo lo
   * que lee. El panel del pasillo dice que el hurto se consuma al pasar la
   * última caja; con esto, el que decide observar LO VE pasar la última caja,
   * y el que decide acercarse no, porque el producto volvió al estante.
   *
   * Una situación con requisito no abre su ventana hasta que el requisito se
   * cumple, y si nunca se cumple no ocurre. Eso es distinto de perdérsela: no
   * es que no llegaras, es que no llegó a pasar.
   */
  requiere?: { situacion: string; clase: ClaseRespuesta };
  /** Dónde ocurre. Es lo que agrupa el recuento. */
  zona: IdZona;
  /**
   * Lo que le llega al jugador cuando empieza: por dónde tiene que ir.
   *
   * De Central por radio casi siempre. De la propia sala cuando es la sala la
   * que te llama —alguien que te hace señas no pasa por la radio—.
   */
  pista: { de: "central" | "sala"; texto: string };
  /**
   * Si no hay nada que corregir. Solo cambia el recuento, que las cuenta
   * aparte: perderse una de estas no cuesta nada, porque no pasó nada.
   */
  inocente?: boolean;
  /**
   * Lo que cuenta Central si la ventana vence sin que la vieras. Las inocentes
   * no lo llevan: si no pasó nada, no hay nada de lo que enterarse.
   */
  siSePierde?: string;
  /** La etiqueta del rótulo, como las actividades del libro del condominio. */
  actividad: string;
  /** Qué estás viendo. En presente: está pasando delante de ti. */
  aviso: string;
  /** Observar, avisar e intervenir, en el orden en que se ofrecen. */
  opciones: readonly OpcionSituacion[];
}

/**
 * ─── LAS TRES OPCIONES DE CADA UNA MIDEN LO MISMO ─────────────────────────
 *
 * Dentro de una situación, los tres textos caben en el mismo número de
 * renglones: los tres de uno, o los tres de dos. No es maquetación, es que el
 * botón crece con su texto (ver crearBotonOpcion) y una opción más alta que
 * las otras dos se lee como la importante antes de haberla leído.
 *
 * El corte está en 60 caracteres, que es lo que entra en un renglón de un
 * botón de 740 px de ancho. Al reescribir cualquiera de estas frases hay que
 * quedarse del mismo lado de esa raya que sus dos hermanas.
 */
export const SITUACIONES: readonly Situacion[] = [
  // --- Entrada · la primera, y es inocente ------------------------------------
  //
  // Es el tutorial sin cartel de tutorial. A pocos metros de donde empieza el
  // jugador, una señora le hace señas: aprende que hay que mirar a la gente,
  // que quedarse mirando congela el momento, y que la respuesta correcta no es
  // siempre la sospecha. Todo antes de que haya nada que perder.
  //
  // Y es la mitad de una pareja. A las 17:08 otra mujer le va a hacer las
  // mismas señas desde el mismo sitio, y la diferencia estará detrás de ella.
  {
    id: "clienta-pregunta",
    minuto: 6,
    zona: "entrada",
    inocente: true,
    pista: { de: "sala", texto: "Una clienta te hace señas desde el frente de la sala." },
    actividad: "UNA CLIENTA TE LLAMA",
    aviso:
      "Una señora de pelo cano te hace señas con la mano desde el frente de la sala. Te mira a " +
      "ti: quiere preguntarte algo.",
    opciones: [
      {
        clase: "observar",
        texto: "Hacerle un gesto de que espere y seguir con tu ronda.",
        correcta: false,
        explicacion:
          "Atender a quien pregunta también es el puesto. Un guardia de sala es la persona a la " +
          "que se le pregunta dónde está algo, y dejarla con la mano en alto no protege nada: la " +
          "ronda aguanta el minuto que dura una respuesta. Lo que no aguanta es que la gente " +
          "aprenda que al guardia no se le habla.",
      },
      {
        clase: "intervenir",
        texto: "Acercarte a atenderla sin dejar de mirar la sala.",
        correcta: true,
        explicacion:
          "Es una clienta que quiere preguntar algo, y atenderla es parte del trabajo. La única " +
          "precaución es la de siempre: mientras le respondes, ponte de forma que sigas viendo la " +
          "sala. No todo lo que pasa en un turno es un incidente, y tratar cada cosa como si lo " +
          "fuera es otra forma de no ver.",
      },
      {
        clase: "avisar",
        texto: "Avisar a Central de que una clienta insiste en llamarte.",
        correcta: false,
        explicacion:
          "No hay nada que avisar. La radio está para las novedades, y una clienta que quiere " +
          "preguntar algo no lo es: si cada cosa normal sube por radio, cuando suba una de verdad " +
          "nadie la va a distinguir.",
      },
    ],
  },

  // --- Góndolas -------------------------------------------------------------
  //
  // La correcta es OBSERVAR, y es la más difícil de aceptar: el impulso de
  // cualquiera es ir y preguntar. Por eso va primera.
  {
    id: "producto-bajo-la-chaqueta",
    minuto: 25,
    zona: "gondolas",
    pista: { de: "central", texto: "Revisa el cuarto pasillo." },
    siSePierde:
      "El cliente de la parka verde va saliendo sin pagar. En cámara se le ve guardarse un " +
      "producto en el cuarto pasillo, y nadie lo estaba mirando.",
    actividad: "CLIENTE EN PASILLO",
    aviso:
      "En el cuarto pasillo, el cliente de la parka verde toma un producto del estante, mira " +
      "hacia los dos extremos y se lo guarda bajo la parka. Sigue ahí, con el canasto vacío " +
      "colgando del brazo.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Acercarte y pedirle que te muestre lo que acaba de guardarse bajo la parka.",
        correcta: false,
        explicacion:
          "Pedirle que te muestre algo puedes pedírselo, y él puede negarse: exigirlo o meterle " +
          "mano a la ropa ya es un registro, y eso es de las policías, no tuyo. Pero sobre todo " +
          "llegas antes de tiempo: mientras no pase la última caja, no hay hurto, hay " +
          "un producto en un bolsillo. Si se lo pides ahí, lo devuelve al estante y sigue su " +
          "compra como si nada, y el que queda dando explicaciones eres tú. Además se acabó: ya " +
          "sabe que lo miras, y no vas a verle hacer nada más en toda la tarde.",
      },
      {
        clase: "observar",
        texto: "Mantenerlo a la vista sin acercarte, siguiendo la ronda con naturalidad.",
        correcta: true,
        explicacion:
          "El hurto se consuma al pasar el último punto de pago, y lo que lo sostiene es haber " +
          "visto la secuencia entera sin perderlo de vista: cómo lo toma, cómo lo esconde y cómo " +
          "sale sin pagarlo. Si cortas la cadena en cualquier punto, no queda nada que afirmar. " +
          "Seguir la ronda con naturalidad es lo que te deja mirar sin anunciar que estás mirando.",
      },
      {
        clase: "avisar",
        texto: "Ir hasta la oficina a dar aviso a jefatura de lo que acabas de ver.",
        correcta: false,
        // Y es lo que pasa: mientras vas y vuelves, se va.
        despues: "El de la parka verde acaba de salir por la puerta sin pagar. Nadie lo estaba mirando.",
        explicacion:
          "Avisar no está mal; abandonar el pasillo para hacerlo, sí. En el tiempo que tardas en " +
          "ir y volver puede haber dejado el producto, cambiado de pasillo o salido del local, y " +
          "entonces tu aviso es una sospecha sin nada detrás. Primero no lo pierdes de vista; el " +
          "aviso se da sin soltar la observación.",
      },
    ],
  },

  // --- La segunda mitad del hurto -------------------------------------------
  //
  // ─── POR QUÉ ESTA SITUACIÓN EXISTE ────────────────────────────────────────
  //
  // Porque sin ella la anterior era una promesa incumplida. El panel del
  // pasillo dice "no lo pierdas de vista hasta que pase la última caja", el
  // jugador elige observar… y el cliente se queda dando vueltas por su pasillo
  // el resto del turno. La lección se enseñaba y el juego no la reconocía, que
  // es peor que no enseñarla: se le pide al alumno algo que no sirve para nada.
  //
  // ─── POR QUÉ NO PAGA ──────────────────────────────────────────────────────
  //
  // Porque si pagara, observar habría premiado una sospecha infundada y la
  // lección se daría vuelta. Con una sola vuelta de esto, el hurto tiene que
  // consumarse: observaste, tienes la secuencia entera, y AHORA sí hay algo
  // que hacer. La duda —"¿y si era inocente?"— da para otra situación distinta,
  // no para el remate de esta.
  //
  // ─── DE DÓNDE SALE EL PROCEDIMIENTO ───────────────────────────────────────
  //
  // Del artículo 129 del Código Procesal Penal —la detención por particulares
  // en delito flagrante— y de lo que la Ley de Seguridad Privada deja y no deja
  // hacer a un guardia. En resumen, y es lo que hay que aprender aquí:
  //
  //   · SE PUEDE retener a quien se sorprende en flagrancia.
  //   · SE PUEDE recuperar el producto: es la evidencia del hecho.
  //   · HAY QUE llamar de inmediato a Carabineros y ponerlo a su disposición.
  //     Esto no es opcional y es lo que cierra el procedimiento.
  //   · NO SE PUEDE registrar a la persona ni sus cosas por la fuerza, ni
  //     interrogarla, ni agredirla. La fuerza es la mínima para que no se vaya.
  //   · Y el procedimiento tiene que VERSE. Resolverlo a puerta cerrada se
  //     desaconseja: es lo que después no se puede defender.
  //
  // La versión anterior de esta situación tenía la respuesta correcta mal: daba
  // por buena "invitarlo a la oficina y avisar a jefatura desde ahí", que se
  // salta lo obligatorio (Carabineros) y premia justo lo que se desaconseja
  // (resolverlo donde no se ve). Y daba por malo recuperar el producto, que sí
  // se puede.
  //
  // ─── LA MISMA PALABRA, EL MOMENTO CONTRARIO ───────────────────────────────
  //
  // En el pasillo, INTERVENIR era el error. Aquí es lo correcto, y es el mismo
  // verbo. Eso es lo que hay que aprender: lo que decide no es qué haces, es
  // cuándo. Media hora antes, abordarlo era pedirle cuentas a alguien que
  // todavía no había hecho nada; pasada la línea de cajas es otra cosa.
  //
  // No tiene minuto propio: ocurre cuando el jugador contesta la del pasillo.
  // El 26 es solo el primer minuto en que PUEDE ocurrir, y la ventana cubre
  // hasta el final del turno porque lo que la cierra es él saliendo por la
  // puerta, no el reloj.
  {
    id: "sale-sin-pagar",
    minuto: 26,
    ventana: 90,
    requiere: { situacion: "producto-bajo-la-chaqueta", clase: "observar" },
    zona: "cajas",
    pista: { de: "central", texto: "El de la parka verde va hacia las cajas." },
    siSePierde: "El de la parka verde salió por la puerta sin pagar. Nadie lo paró en la línea de cajas.",
    actividad: "PASA LA LÍNEA DE CAJAS",
    aviso:
      "El de la parka verde pasa la línea de cajas sin detenerse, con el canasto vacío " +
      "colgando del brazo, y va derecho hacia la puerta. Lleva el producto encima.",
    opciones: [
      {
        clase: "observar",
        texto: "Dejarlo salir y anotar en el informe lo que viste en el pasillo.",
        correcta: false,
        explicacion:
          "Observar era lo correcto mientras el hecho no estaba completo. Ya lo está: lo viste " +
          "tomarlo, esconderlo y pasar el último punto de pago sin detenerse. Dejarlo salir ahora " +
          "es tirar a la basura los veinte minutos que llevas sin perderlo de vista, y el informe " +
          "queda diciendo que viste un hurto y no hiciste nada.",
      },
      {
        clase: "intervenir",
        texto: "Retenerlo ahí mismo, recuperar el producto y llamar a Carabineros.",
        correcta: true,
        explicacion:
          "Este es el momento, y es el mismo gesto que hace media hora estaba de más: lo que " +
          "cambió no es lo que haces, es cuándo. Hay flagrancia, y eso te da dos cosas: retenerlo " +
          "—la detención por particulares del artículo 129 del Código Procesal Penal— y recuperar " +
          "el producto, que es la evidencia del hecho. Pero lo que cierra el procedimiento es lo " +
          "tercero y es obligatorio: llamar de inmediato a Carabineros y ponerlo a su disposición. " +
          "Esperarlos en la oficina está bien; lo que no puede pasar es que el procedimiento deje " +
          "de verse. No se le registra la ropa ni el bolso, no se le interroga, no se le encierra, " +
          "y la fuerza que se usa es la mínima para que no se marche.",
      },
      // ─── LA TRAMPA ────────────────────────────────────────────────────
      //
      // Esta opción sustituyó a un "ir a la oficina a llamar antes de hacer
      // nada", que era un error demasiado fácil de descartar. Esta no: es la
      // salida que se le ocurre sola a cualquiera que juegue, y es además la
      // que más se practica en el oficio. Por eso está aquí.
      //
      // Rompe la regla de una opción por clase —hay dos de intervenir— y se
      // rompe a propósito: en este momento el guardia tiene al tipo delante y
      // la puerta a diez metros, así que "informar" ya no es una opción por sí
      // sola. Lo que se decide es CÓMO se actúa, y por eso dos de las tres son
      // formas de actuar.
      {
        clase: "intervenir",
        texto: "Llevarlo a la oficina, recuperar el producto y dejarlo marchar.",
        correcta: false,
        explicacion:
          "Recuperar el producto no es el error: estás en flagrancia y es la evidencia, puedes " +
          "hacerlo. El error es lo que falta detrás, y dónde lo haces. Soltarlo sin avisar a nadie " +
          "deja el hecho sin existir para nadie —ni denuncia, ni registro, ni consecuencia— y " +
          "convierte un delito en un trueque. Y resolverlo a puerta cerrada en una oficina es lo " +
          "que se desaconseja justamente por esto: un procedimiento que no se ve desde fuera es el " +
          "que después no puedes defender, y te deja a ti expuesto a que la acusación sea por " +
          "privación ilegítima de libertad.",
      },
    ],
  },

  // --- Góndolas · inocente -----------------------------------------------------
  //
  // La pareja de la mochila del final. Aquí hay un canasto en el suelo y nadie
  // al lado… pero su dueño está a dos metros, hablando por teléfono. Lo que
  // convierte un objeto en abandonado no es que esté en el suelo: es que quien
  // lo dejó se vaya.
  {
    id: "canasto-y-telefono",
    minuto: 42,
    zona: "gondolas",
    inocente: true,
    pista: { de: "central", texto: "Revisa el primer pasillo." },
    actividad: "CANASTO EN EL PASILLO",
    aviso:
      "En el primer pasillo, el cliente de la camisa celeste deja su canasto en el suelo, se " +
      "aparta un par de metros por el pasillo y contesta el teléfono.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Acercarte y pedirle que no deje el canasto en el pasillo.",
        correcta: false,
        explicacion:
          "No está haciendo nada que haya que corregir. Es su canasto, con sus compras, a dos " +
          "metros de él. Interrumpir a alguien en mitad de una llamada por eso no protege nada, y " +
          "le enseña al cliente que el guardia está para vigilarlo a él.",
      },
      {
        clase: "observar",
        texto: "Seguir con la ronda sin intervenir.",
        correcta: true,
        explicacion:
          "Un canasto a dos metros de su dueño, con el dueño a la vista, no es un bulto " +
          "abandonado: es alguien que contesta una llamada. Lo que convierte un objeto en " +
          "abandonado es que quien lo dejó se vaya. Mirar, ver que no pasa nada y seguir también " +
          "es una decisión, y aquí es la correcta.",
      },
      {
        clase: "avisar",
        texto: "Avisar a Central de un canasto abandonado en el pasillo.",
        correcta: false,
        explicacion:
          "Avisar de un canasto abandonado con su dueño al lado, hablando por teléfono, es dar " +
          "una novedad que no es. Cada aviso falso le quita peso al siguiente, y Central tiene " +
          "que poder fiarse de los tuyos.",
      },
    ],
  },

  // --- Cajas ----------------------------------------------------------------
  //
  // Hacia dentro de la empresa. Aquí lo tentador es callarse: es una compañera
  // de trabajo y nadie quiere ser el que la denuncia.
  {
    id: "anulaciones-en-caja",
    minuto: 58,
    zona: "cajas",
    pista: { de: "central", texto: "Revisa la caja." },
    siSePierde:
      "El cuadre de la caja no calza. En cámara, la cajera anula ventas ya cobradas y se guarda " +
      "el dinero.",
    actividad: "MOVIMIENTO EN CAJA",
    aviso:
      "La cajera cobra a un cliente, le entrega su boleta y, apenas se aleja, anula la venta y " +
      "se guarda un billete en el bolsillo del delantal. Es la tercera anulación que le ves en " +
      "diez minutos.",
    opciones: [
      {
        clase: "avisar",
        texto: "Dar aviso a jefatura de inmediato, con la hora y el número de la caja.",
        correcta: true,
        explicacion:
          "Es un hecho contra la empresa y tu papel es informarlo por conducto, no resolverlo. " +
          "La hora y la caja son lo que permite ir después al detalle de anulaciones y ver si " +
          "cuadra: sin esos dos datos, tu aviso es una impresión; con ellos, es el punto por " +
          "donde se empieza a revisar.",
      },
      {
        clase: "observar",
        texto: "Anotarlo mentalmente y terminar la ronda sin decir nada por ahora.",
        correcta: false,
        explicacion:
          "Mirar sin informar no es prudencia, es omisión. Lo que viste ya es una novedad, y una " +
          "novedad que no se transmite es, para el servicio, una novedad que no ocurrió. Además " +
          "el dinero sigue saliendo mientras tú decides cuándo hablar.",
      },
      {
        clase: "intervenir",
        texto: "Acercarte a la caja y pedirle explicaciones delante del cliente siguiente.",
        correcta: false,
        explicacion:
          "Encararla convierte un procedimiento interno en un conflicto personal delante de los " +
          "clientes, y la avisa: lo que quede por anular se anula antes de que nadie revise nada. " +
          "Tampoco es tuya la decisión de acusar a un trabajador; es de quien tiene la relación " +
          "laboral con ella.",
      },
    ],
  },

  // --- Entrada · la maniobra de distracción ------------------------------------
  //
  // La pareja de la primera. El mismo gesto desde el mismo sitio —una mujer
  // que te llama con la mano— y la diferencia está detrás: un hombre que se
  // llena la chaqueta mientras te mira. El aviso de Central lleva a la
  // entrada; lo que hay que ver está a tres metros de lo que te llama.
  //
  // La correcta es AVISAR, y el contraste con el pasillo de la parka es el
  // que enseña por qué: allí era uno y bastaba con no perderlo de vista. Aquí
  // son dos, y uno está precisamente para ponerse entre tú y el otro.
  {
    id: "maniobra-de-distraccion",
    // ─── ANTES Y MÁS LARGA QUE LAS DEMÁS ──────────────────────────────────
    //
    // Porque esta empieza con dos personas entrando por la puerta, y cruzar
    // hasta la góndola se come diez minutos de turno antes de que él haga
    // nada. Con la ventana de siempre, a las 17:12 y de dieciocho minutos, se
    // cerraba con la mano de él todavía camino de la chaqueta: el jugador lo
    // veía todo menos el final, y el panel no llegaba a salir nunca.
    minuto: 68,
    ventana: 24,
    zona: "entrada",
    pista: { de: "central", texto: "Revisa el frente de la sala, junto a la entrada." },
    siSePierde:
      "Faltan productos del frente de la sala. En cámara, un hombre se los guardaba mientras " +
      "una mujer le hacía señas al guardia.",
    actividad: "TE HACEN SEÑAS",
    aviso:
      "Una mujer te llama con la mano, insistente, desde el frente de la sala. Detrás de ella, " +
      "junto a la góndola, un hombre mira hacia ti y se guarda un producto en la chaqueta.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Ir hacia ella a atenderla, como a cualquiera que te llama.",
        correcta: false,
        explicacion:
          "Es lo que los dos esperan que hagas. Una maniobra de distracción funciona así: uno te " +
          "ocupa y el otro trabaja, y el que te ocupa hace algo tan normal —llamarte, " +
          "preguntarte— que no atenderlo parece mala educación. Atender a quien llama está bien; " +
          "hacerlo dándole la espalda a lo que acabas de ver detrás, no.",
      },
      {
        clase: "avisar",
        texto: "Avisar a Central por radio sin quitarle la vista al hombre.",
        correcta: true,
        explicacion:
          "Es una maniobra de distracción: uno te ocupa y el otro se lleva el producto. Tú solo " +
          "no puedes mirar a los dos, y por eso aquí se avisa: con Central enterada, las cámaras " +
          "lo siguen aunque ella se te ponga delante, y queda registrado con la hora. Abordarlo a " +
          "él todavía no corresponde —no ha pasado cajas—, pero ya no está solo en tu cabeza.",
      },
      {
        clase: "observar",
        texto: "Dejarla esperando y quedarte tú solo mirando al hombre.",
        correcta: false,
        explicacion:
          "Mirarlo es la mitad correcta, y en el pasillo de la parka bastaba. Aquí no: son dos, y " +
          "uno de ellos está para ponerse entre tú y el otro. En cuanto ella se te acerque o él " +
          "cambie de pasillo, lo pierdes, y lo que viste se queda solo contigo. Contra dos, se " +
          "avisa.",
      },
    ],
  },

  // --- Bodega ---------------------------------------------------------------
  //
  // El contraejemplo. Sin esta, el nivel enseñaría "nunca actúes", que es
  // falso y peligroso: hay un caso en que esperar es lo único que no se puede.
  {
    id: "salida-de-emergencia-bloqueada",
    minuto: 84,
    zona: "bodega",
    pista: { de: "central", texto: "Revisa la bodega, al fondo." },
    siSePierde: "La salida de emergencia de la bodega sigue tapada por un pallet. Nadie la despejó.",
    actividad: "SALIDA DE EMERGENCIA",
    aviso:
      "La salida de emergencia de la bodega está tapada por un pallet de bebidas arrimado " +
      "contra la hoja. Por encima de la carga solo asoma el letrero verde.",
    opciones: [
      {
        clase: "avisar",
        texto: "Dar aviso a jefatura y continuar la ronda por donde ibas.",
        correcta: false,
        explicacion:
          "El aviso es correcto y el momento no: la salida sigue bloqueada mientras el aviso " +
          "sube, se atiende y baja. Si en esos minutos hay un amago de incendio, esa es la puerta " +
          "por la que no sale nadie. Avisar es lo que se hace después de quitar el peligro, no " +
          "en lugar de quitarlo.",
      },
      {
        clase: "observar",
        texto: "Tomar nota para incluirlo en el informe al cierre del turno.",
        correcta: false,
        explicacion:
          "Un informe al cierre del turno llega horas tarde para una vía de evacuación. Lo que " +
          "está en juego aquí no es un dato que registrar, es la salida de la gente que está " +
          "dentro ahora. Se anota, sí, pero después de despejarla.",
      },
      {
        clase: "intervenir",
        texto: "Despejarla ya con la transpaleta y dejarlo anotado.",
        correcta: true,
        explicacion:
          "Es el caso en que no se espera. Una vía de evacuación obstruida es un riesgo " +
          "inmediato para la vida, está dentro de lo tuyo despejarla y no hay ninguna autorización " +
          "que pedir para hacerlo. Un pallet cargado no se mueve a pulso: se mueve con la " +
          "transpaleta, que para eso está en la bodega. Y se anota igual: que lo hayas resuelto no borra que alguien " +
          "dejó carga contra una vía de evacuación, y eso hay que corregirlo donde se decidió.",
      },
    ],
  },

  // --- Góndolas · inocente -----------------------------------------------------
  //
  // La pareja del hurto. El mismo principio de gesto —alarga la mano, coge,
  // se lo acerca— con el final cambiado: lo devuelve a la balda. Si el jugador
  // aprendió a mirar dónde acaba la mano, esta se resuelve sola. Si aprendió
  // "el que coge algo y mira mucho, roba", aquí se equivoca.
  {
    id: "mira-mucho-un-producto",
    minuto: 94,
    zona: "gondolas",
    inocente: true,
    pista: { de: "central", texto: "Revisa el tercer pasillo." },
    actividad: "CLIENTA EN PASILLO",
    aviso:
      "En el tercer pasillo, la señora del abrigo camel lleva un buen rato con un producto en " +
      "la mano. Lo lee de cerca, lo devuelve al estante y toma otro.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Preguntarle si piensa llevar lo que tiene en la mano.",
        correcta: false,
        explicacion:
          "Leer una etiqueta no es sospechoso, es comprar: se mira el precio, los ingredientes, " +
          "la fecha. Ir a preguntarle si lo va a llevar es tratarla como sospechosa por algo que " +
          "hace todo el mundo, y el cliente que se siente vigilado por comparar precios no vuelve.",
      },
      {
        clase: "avisar",
        texto: "Avisar a Central de una clienta que manipula productos.",
        correcta: false,
        explicacion:
          "No hay novedad que dar. Lo que hizo con el producto es justo lo contrario de lo que " +
          "hizo el de la parka: lo devolvió al estante. Un aviso por esto solo le enseña a " +
          "Central a no tomarte en serio.",
      },
      {
        clase: "observar",
        texto: "Dejarla tranquila y seguir con la ronda.",
        correcta: true,
        explicacion:
          "Mírale las manos al final, no al principio. Tomó un producto, lo leyó y lo devolvió " +
          "al estante: la mano vuelve vacía. El de la parka hizo el mismo gesto con otro final. " +
          "Que alguien se tome su tiempo con un producto no dice nada; dónde acaba el producto, " +
          "lo dice todo.",
      },
    ],
  },

  // --- Entrada --------------------------------------------------------------
  //
  // La última. Aquí las tres respuestas suenan razonables, y la diferencia
  // está en qué haces con las manos.
  {
    id: "mochila-en-el-acceso",
    minuto: 106,
    zona: "entrada",
    pista: { de: "central", texto: "Revisa la entrada, junto a la puerta." },
    siSePierde: "Hay una mochila sola junto a la puerta desde hace rato, y nadie dio aviso.",
    actividad: "BULTO EN EL ACCESO",
    aviso:
      "Un hombre deja una mochila apoyada contra el muro, al costado de la puerta, se queda " +
      "mirando el local unos segundos y se aleja sin ella.",
    opciones: [
      {
        clase: "intervenir",
        texto: "Abrir la mochila para ver de quién es y poder devolvérsela a su dueño.",
        correcta: false,
        explicacion:
          "Un bulto abandonado no se abre ni se mueve. No sabes qué hay dentro, y el gesto de " +
          "abrirlo es exactamente el que no se debe hacer si lo que hay dentro es lo que nadie " +
          "quiere que haya. Aunque resultara ser ropa de gimnasio, tampoco tienes por qué andar " +
          "revisando las cosas de nadie.",
      },
      {
        clase: "avisar",
        texto: "Avisar a jefatura sin tocarla y mantener a la gente apartada de esa puerta.",
        correcta: true,
        explicacion:
          "Las dos mitades importan. Avisar, porque la decisión sobre un bulto abandonado no es " +
          "tuya. Y apartar a la gente, porque es lo único que puedes hacer tú mientras tanto y " +
          "es lo que protege: si resulta no ser nada, no perdiste nada; si resulta ser algo, " +
          "esos metros son la diferencia.",
      },
      {
        clase: "observar",
        texto: "Quedarte vigilándola por si el dueño vuelve a buscarla en un rato.",
        correcta: false,
        explicacion:
          "Aquí observar se queda corto, y además te pone a ti al lado del bulto, que es el peor " +
          "sitio de todo el local. Mirar sirve cuando el riesgo es que se te escape un detalle; " +
          "no sirve cuando el riesgo es el objeto mismo.",
      },
    ],
  },
];

export interface RespuestaSituacion {
  situacion: Situacion;
  opcion: OpcionSituacion;
}

/**
 * Segundos que hay que tenerlo a la vista para que salte el panel.
 *
 * ─── POR QUÉ NO SALTA AL PRIMER VISTAZO ───────────────────────────────────
 *
 * Porque saltando en el cuadro en que el actor entra en pantalla, el jugador
 * no llega a ver nada: el panel se le pone delante para contarle algo que
 * ocurrió durante un dieciseisavo de segundo detrás del velo. La escena
 * quedaría exactamente igual de muda que cuando esto era solo texto.
 *
 * Un segundo y dos décimas es lo que dura el tramo del gesto en que la mano
 * va del estante al cuerpo, así que quien mira ve el movimiento entero antes
 * de que se le pregunte qué hace con él. Y sigue sin poder atravesarse la sala sin
 * enterarse: hay que parar y mirar, que es el gesto que se está enseñando.
 */
const DETENCION = 1.2;

/**
 * Lo deprisa que se olvida lo mirado al apartar la vista, respecto a lo que
 * tarda en acumularse.
 *
 * A la mitad: apartar la vista un momento —un cliente que se cruza, un
 * cabeceo de la cámara, el canto de una góndola que corta el rayo un cuadro—
 * no puede costar empezar de cero. Pero mirar de reojo dos veces tampoco vale
 * por mirar una vez de verdad.
 */
const OLVIDO = 0.5;

export interface OpcionesSituaciones {
  /**
   * Se abre la ventana de una situación: hay que poner al actor a hacerla.
   *
   * Llega SIEMPRE, esté el jugador donde esté. Lo que pasa en la sala no
   * espera a que haya alguien mirando — esa es la idea entera del nivel.
   */
  alAbrir: (situacion: Situacion) => void;
  /** Se cerró la ventana, con o sin haberla visto. */
  alCerrar: (situacion: Situacion) => void;
  /** Si el jugador tiene delante al actor de esa situación, ahora mismo. */
  aLaVista: (situacion: Situacion) => boolean;
  /**
   * Si lo que hay que haber visto YA HA PASADO delante del jugador.
   *
   * ─── POR QUÉ ES UNA PREGUNTA APARTE ─────────────────────────────────────
   *
   * Porque mirar y ver no son lo mismo. `aLaVista` cuenta el rato que el
   * jugador lleva con el actor delante, y ese rato hay que contarlo desde el
   * principio: es lo que premia quedarse a mirar. Pero el panel no puede
   * abrirse en cualquier punto de ese rato — se abría a mitad del gesto, con
   * el brazo todavía estirado hacia la balda, y preguntaba por algo que aún no
   * había ocurrido.
   *
   * Con las dos preguntas separadas, la cuenta corre mientras miras y el panel
   * espera al momento en que la mano llega a su sitio. El jugador ve el gesto
   * entero y se le pregunta justo después.
   */
  enSuMomento: (situacion: Situacion) => boolean;
  /**
   * Si lo que había que ver ya se acabó antes de que venza la ventana: el de
   * la parka salió por la puerta, la pareja de la distracción se fue. Cierra
   * la ventana en el acto, como perdida, en vez de dejarla abierta sobre una
   * sala en la que ya no queda nada que mirar.
   */
  terminada?: (situacion: Situacion) => boolean;
}

/** Lo que el jugador está mirando ahora mismo, y cuánto le falta. */
export interface Foco {
  situacion: Situacion;
  /** De 0 a 1: cuánto lleva mirado de lo que hace falta. */
  fraccion: number;
  /** Ya miró bastante, pero lo que importa todavía no ha pasado. */
  esperando: boolean;
}

export interface Situaciones {
  /** Los minutos en que empieza algo. Van a los hitos del reloj. */
  minutos(): number[];
  /**
   * Un cuadro de turno. Devuelve la situación que toca mostrar, o null.
   *
   * Hace tres cosas: abre y cierra ventanas según el minuto, lleva la cuenta
   * de cuánto se ha estado mirando lo que está abierto, y avisa cuando esa
   * cuenta llega a DETENCION. Quien la recibe se compromete a mostrarla: sale
   * una sola vez.
   */
  avanzar(minuto: number, dt: number): Situacion | null;
  /** Lo que el jugador respondió. */
  resolver(situacion: Situacion, opcion: OpcionSituacion): void;
  atendidas(): readonly RespuestaSituacion[];
  /** Las que pasaron sin que las viera. Se lee al cerrar el turno. */
  perdidas(): Situacion[];
  /** Las que están ocurriendo ahora y todavía no ha visto. Llevan pista. */
  abiertas(): Situacion[];
  /** Lo que está mirando en este cuadro, si mira algo que cuenta. */
  foco(): Foco | null;
  /** Las que llegaron a ocurrir. Una encadenada sin su requisito, no. */
  ocurridas(): Situacion[];
}

/**
 * Lleva las situaciones de un turno.
 *
 * No sabe de relojes, de cámaras, de mallas ni de paneles. Recibe el minuto,
 * la zona y una pregunta contestada desde fuera —"¿lo tiene a la vista?"— y
 * dice qué toca. Igual que RondasSupermercado, y por lo mismo: así el
 * contenido de la tabla, la geometría de la sala y la lógica del turno se
 * pueden tocar por separado.
 */
export function crearSituaciones(
  opciones: OpcionesSituaciones,
  lista: readonly Situacion[] = SITUACIONES
): Situaciones {
  const estado = new Map(
    lista.map((s) => [s.id, { abierta: false, vista: false, mirada: 0, ocurrio: false, mirando: false }])
  );
  let foco: Foco | null = null;
  const respuestas: RespuestaSituacion[] = [];

  /** Si ya se respondió lo que pide un requisito. Sin requisito, siempre. */
  const cumple = (requisito: Situacion["requiere"]): boolean =>
    !requisito ||
    respuestas.some(
      (r) => r.situacion.id === requisito.situacion && r.opcion.clase === requisito.clase
    );

  return {
    // Las encadenadas no van a los hitos del reloj: su minuto no es cuando
    // ocurren —ocurren cuando se cumple el requisito— y frenar el adelanto ahí
    // sería frenarlo por algo que quizá no llegue a pasar nunca.
    minutos: () => lista.filter((s) => !s.requiere).map((s) => s.minuto),

    avanzar(minuto, dt) {
      let saltando: Situacion | null = null;
      foco = null;

      for (const situacion of lista) {
        const e = estado.get(situacion.id);
        if (!e) continue;

        const dentro =
          minuto >= situacion.minuto &&
          minuto < situacion.minuto + (situacion.ventana ?? VENTANA_SITUACION) &&
          cumple(situacion.requiere) &&
          !(e.abierta && opciones.terminada?.(situacion));

        if (dentro && !e.abierta && !e.vista && !e.ocurrio) {
          e.abierta = true;
          e.ocurrio = true;
          opciones.alAbrir(situacion);
        } else if (!dentro && e.abierta) {
          e.abierta = false;
          e.mirada = 0;
          opciones.alCerrar(situacion);
        }

        if (!e.abierta || e.vista || saltando) continue;

        // ─── LA ZONA YA NO SE COMPRUEBA APARTE ───────────────────────────
        //
        // Estuvo exigiendo estar en la zona ADEMÁS de verlo, y sobraba: si
        // tienes algo a nueve metros, dentro del encuadre y sin nada en medio,
        // estás ahí. Las zonas del local las separan góndolas y tabiques, que
        // es justo lo que el rayo ya tiene en cuenta.
        //
        // Y de sobrar pasaba a estorbar. La línea de cajas se ve entera desde
        // la entrada: el jugador miraba a la cajera guardarse el billete, lo
        // veía con sus ojos, y el panel no salía porque le faltaban dos metros
        // para pisar la zona "cajas". Eso no se entiende desde dentro del
        // juego, y no hay forma de que se entienda.
        //
        // `zona` sigue en la tabla: dice dónde ocurre cada cosa y es lo que
        // permitirá contarlas por zona en el recuento.
        e.mirando = opciones.aLaVista(situacion);
        e.mirada = e.mirando ? e.mirada + dt : Math.max(0, e.mirada - dt * OLVIDO);
        if (e.mirando && (!foco || e.mirada / DETENCION > foco.fraccion)) {
          foco = {
            situacion,
            fraccion: Math.min(1, e.mirada / DETENCION),
            esperando: e.mirada >= DETENCION,
          };
        }

        // Mirado lo suficiente, pero el panel espera a que se vea el remate.
        // Sin esto salta a media acción: el jugador lleva su segundo y pico
        // delante del cliente y todavía no le ha visto meterse nada.
        if (e.mirada >= DETENCION && opciones.enSuMomento(situacion)) {
          e.vista = true;
          e.abierta = false;
          // Sin alCerrar: al actor NO se le manda parar aquí.
          //
          // Este es el instante en que el momento se congela, y congelado
          // tiene que quedar. Si se le dijera que pare justo ahora, detrás del
          // velo —con el reloj detenido y el jugador leyendo— el cliente
          // bajaría el brazo y se volvería a su ruta. Al cerrar la tarjeta, lo
          // que se encontraría el jugador es a alguien paseando tranquilamente
          // por el pasillo, y la escena desmentiría al panel que acaba de leer.
          //
          // Quien lo para es el recorrido, cuando se cierra la tarjeta.
          saltando = situacion;
        }
      }

      return saltando;
    },

    resolver(situacion, opcion) {
      // Una sola respuesta por situación: el panel no se puede reabrir, pero
      // un doble clic sobre dos opciones distintas sí llegaría dos veces.
      if (respuestas.some((r) => r.situacion.id === situacion.id)) return;
      respuestas.push({ situacion, opcion });
    },

    atendidas: () => respuestas,

    perdidas: () => lista.filter((s) => estado.get(s.id)?.ocurrio && !estado.get(s.id)?.vista),

    abiertas: () => lista.filter((s) => estado.get(s.id)?.abierta),

    foco: () => foco,

    ocurridas: () => lista.filter((s) => estado.get(s.id)?.ocurrio),
  };
}
