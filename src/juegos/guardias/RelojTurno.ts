import { Scene, Observer } from "@babylonjs/core";

// ===========================================================================
// El reloj del turno
// ===========================================================================
//
// Las ocho horas de servicio, corriendo solas.
//
// ─── POR QUÉ EL TURNO TIENE QUE CORRER ────────────────────────────────────
//
// Antes el tiempo avanzaba únicamente al apretar un botón. El jugador decidía
// cuándo pasaba cada cosa, así que nunca podía perderse nada, nunca llegaba
// tarde a nada y nunca tenía dos cosas encima a la vez. Eso convierte el turno
// en una lista de tareas.
//
// Un turno de guardia es lo contrario: el tiempo pasa lo mires o no. La
// novedad ocurre mientras estabas mirando el monitor, el supervisor llega a
// las 03:20 tengas el libro al día o no, y las 08:00 llegan igual. Toda la
// tensión del nivel —y la mitad de las faltas que el manual describe— sale de
// ahí.
//
// ─── POR QUÉ SE PAUSA, Y CUÁNDO ───────────────────────────────────────────
//
// El reloj se detiene mientras hay un panel de decisión delante: eligiendo
// cómo redactar una novedad, leyendo los reparos del supervisor, cuadrando el
// cargo fijo. Son momentos en los que el jugador está leyendo, y dejar correr
// el reloj ahí no añadiría tensión, añadiría prisa por leer — que es lo
// contrario de lo que el nivel quiere enseñar.
//
// Y hay una razón técnica igual de importante: con el reloj parado durante los
// paneles, es IMPOSIBLE que un suceso o la fiscalización salten encima de otra
// pantalla. Toda una familia de errores desaparece por construcción en vez de
// tener que ir tapándolos uno a uno.
//
// ─── POR QUÉ SE PUEDE ADELANTAR ───────────────────────────────────────────
//
// Porque un turno de noche es, sobre todo, esperar. Entre la última novedad y
// la fiscalización hay casi dos horas de nada, y entre la fiscalización y la
// entrega, más de cuatro. Reproducirlas en tiempo real sería fiel y sería
// insufrible.
//
// El adelanto lo pide el jugador, no se lo impone el juego. Y se corta solo en
// cuanto pasa algo: si adelantando aparece una novedad, el reloj vuelve a su
// velocidad normal en ese mismo instante. Así nadie se salta un suceso por
// tener el dedo apoyado.

/**
 * Minutos del turno que pasan por cada segundo real, a velocidad normal.
 *
 * ─── POR QUÉ TAN LENTO ────────────────────────────────────────────────────
 *
 * Estuvo en 4, y a esa velocidad el principio del turno era ingobernable.
 * Las novedades del condominio caen en los minutos 30, 45, 60 y 90 —una hora
 * larga de servicio, que es un ritmo razonable para un puesto de noche—, pero
 * a cuatro minutos por segundo eso son menos de cuatro segundos reales entre
 * una y otra. El jugador veía las luces encendidas en la cámara del pasillo y
 * antes de poder abrir el libro ya tenía la camioneta en el estacionamiento y
 * el ingreso en la reja encima.
 *
 * Y no se arreglaba solo con que el reloj se pare en los paneles, que ya se
 * paraba: el problema no era escribir una novedad, era que al volver al libro
 * la siguiente ya estaba entrando.
 *
 * A minuto y medio por segundo esos mismos huecos pasan a ser diez y veinte
 * segundos: da tiempo a leer el aviso, mirar la cámara que lo delata y
 * redactarlo sin que se amontone lo siguiente. El turno sigue corriendo solo
 * —que es lo que hace que esto sea un turno y no una lista de tareas—, pero a
 * un ritmo que se puede atender.
 */
const MINUTOS_POR_SEGUNDO = 1.1;

/**
 * Cuánto multiplica el adelanto.
 *
 * Sube junto con la bajada de arriba, y por la misma razón: lo que se ganó en
 * los tramos con novedades no se puede perder en los muertos. Entre la última
 * novedad y la fiscalización hay casi dos horas de servicio en las que no
 * pasa nada, y adelantando se despachan en unos seis segundos.
 */
const FACTOR_ADELANTO = 12;

export interface RelojTurno {
  /**
   * Detiene el turno unos segundos y lo reanuda solo.
   *
   * Es para el instante en que ocurre una novedad. Sin esa pausa, el jugador
   * ve encenderse un cuadrante del monitor y el reloj sigue corriendo mientras
   * todavía está girándose a mirar: la novedad entra en la bandeja antes de
   * que le haya dado tiempo a registrar que ocurrió.
   *
   * No es tiempo regalado. Es lo que tarda cualquiera en levantar la vista.
   */
  respirar(segundos: number): void;
  /** Minuto del turno, redondeado hacia abajo. 0 es 00:00. */
  minuto(): number;
  /** Deja correr el reloj, o lo detiene. */
  correr(activo: boolean): void;
  /** Enciende o apaga el adelanto. */
  adelantar(activo: boolean): void;
  estaAdelantando(): boolean;
  /** Salta directamente a un minuto. Nunca hacia atrás. */
  saltarA(minuto: number): void;
  dispose(): void;
}

export interface OpcionesReloj {
  /** Último minuto del turno. Al llegar, el reloj se detiene solo. */
  minutoFinal: number;
  /**
   * Minutos de turno por segundo real. Si falta, los del condominio.
   *
   * ─── POR QUÉ CADA ESCENARIO LLEVA LA SUYA ─────────────────────────────
   *
   * Porque el ritmo que le va a uno no le va al otro. El condominio es un
   * puesto sentado: el trabajo es leer, decidir y escribir, y entre novedad y
   * novedad no hay que ir a ninguna parte. El supermercado es lo contrario
   * —hay que CAMINAR hasta donde pasan las cosas—, y a la velocidad del
   * condominio el jugador no llega: mientras cruza la sala detrás de un
   * cliente se le abre la situación de la caja, y mientras atiende esa se le
   * vence la ronda.
   *
   * Un minuto de turno tiene que durar lo que cuesta cruzar la sala, y la sala
   * del supermercado mide veinte metros.
   */
  minutosPorSegundo?: number;
  /**
   * Lo más que puede avanzar el reloj en un cuadro, en segundos. Por defecto
   * una décima.
   *
   * ─── POR QUÉ SE PUEDE CAMBIAR ───────────────────────────────────────────
   *
   * Porque tiene que ir a la par con lo que se mueve en la escena. Las figuras
   * topan su paso en cinco centésimas: si el equipo va lento —menos de veinte
   * cuadros por segundo— ellas se frenan y el reloj con un tope de una décima
   * no, y el turno corre al doble que la gente. En el supermercado eso rompía
   * las situaciones: la pareja de la distracción tardaba en cruzar la sala el
   * doble de minutos de turno, y su ventana se cerraba antes de que él
   * terminara el gesto. Con el mismo tope, si el equipo va lento, va lento
   * todo junto.
   */
  pasoMaximo?: number;
  /**
   * Minutos en los que el turno TIENE que frenar.
   *
   * ─── POR QUÉ EL RELOJ LOS CONOCE ────────────────────────────────────────
   *
   * Hasta ahora el adelanto se cortaba desde fuera: el reloj avanzaba a ciegas
   * y la pantalla, al enterarse de que había ocurrido una novedad, le pedía
   * que parara. Funciona mientras el aviso llegue a tiempo — y basta un cuadro
   * largo, un repintado o cualquier camino que no llame a esa cancelación para
   * que el turno se coma dos o tres novedades de una sentada. El jugador se
   * encuentra entonces con tres cámaras encendidas y tres constancias por
   * escribir sin haber podido atender ninguna.
   *
   * Dándole los hitos al reloj, eso deja de poder pasar. El reloj se frena
   * SOLO en el minuto exacto, sin depender de que nadie se lo recuerde. Cada
   * pulsación de adelantar lleva de una novedad a la siguiente y ni un minuto
   * más allá.
   */
  hitos?: number[];
  /**
   * Se llama cada vez que el reloj cambia de minuto.
   *
   * Puede saltarse varios de golpe si el cuadro fue largo o si se está
   * adelantando, así que llega SIEMPRE minuto a minuto: quien escucha no tiene
   * que preocuparse de haberse perdido uno por el camino.
   */
  alAvanzar: (minuto: number) => void;
}

export function crearRelojTurno(scene: Scene, opciones: OpcionesReloj): RelojTurno {
  let minutoExacto = 0;
  /** Último minuto ya avisado. Arranca en -1 para que el 0 también se avise. */
  let ultimoAvisado = -1;
  let corriendo = false;
  let adelantando = false;
  let terminado = false;
  /** Segundos que quedan de pausa por una novedad recién ocurrida. */
  let respiro = 0;

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!corriendo || terminado) return;

    // Se acota el paso: si la pestaña estuvo en segundo plano, el navegador
    // devuelve un delta enorme y el turno saltaría media hora de golpe.
    const dt = Math.min(opciones.pasoMaximo ?? 0.1, scene.getEngine().getDeltaTime() / 1000);

    // La pausa por novedad se consume primero. El turno no avanza mientras
    // dura, y se descuenta con el mismo reloj real que todo lo demás.
    if (respiro > 0) {
      respiro -= dt;
      return;
    }

    const velocidad = opciones.minutosPorSegundo ?? MINUTOS_POR_SEGUNDO;
    minutoExacto += dt * velocidad * (adelantando ? FACTOR_ADELANTO : 1);

    // Frenada en el próximo hito. Se comprueba SIEMPRE, no solo adelantando:
    // aunque a velocidad normal un cuadro nunca salta un minuto entero, hacer
    // depender la garantía de eso sería volver a lo de antes.
    const hito = proximoHito();
    if (hito !== null && minutoExacto >= hito) {
      minutoExacto = hito;
      adelantando = false;
    }

    if (minutoExacto >= opciones.minutoFinal) {
      minutoExacto = opciones.minutoFinal;
      terminado = true;
    }

    avisarHasta(Math.floor(minutoExacto));
  });

  /** El primer hito que aún no se ha alcanzado. Null si no queda ninguno. */
  function proximoHito(): number | null {
    const lista = opciones.hitos;
    if (!lista) return null;
    for (const m of lista) {
      if (m > ultimoAvisado) return m;
    }
    return null;
  }

  function avisarHasta(hasta: number): void {
    while (ultimoAvisado < hasta) {
      ultimoAvisado += 1;
      opciones.alAvanzar(ultimoAvisado);
      // Quien escucha puede haber parado el reloj —porque abrió un panel— o
      // haber cortado el adelanto. Se respeta en el acto y el resto de los
      // minutos quedan para el próximo cuadro, en vez de vaciarlos encima de
      // una pantalla que ya no los espera.
      if (!corriendo) return;
    }
  }

  return {
    minuto: () => ultimoAvisado < 0 ? 0 : ultimoAvisado,
    correr(activo) {
      corriendo = activo;
      // Volver de un panel no arrastra la pausa que hubiera quedado pendiente:
      // el jugador ya tuvo su tiempo delante de la pantalla.
      if (!activo) respiro = 0;
      // Soltar el adelanto al pausar evita la sorpresa de volver de un panel
      // con el turno disparado.
      if (!activo) adelantando = false;
    },
    adelantar(activo) {
      adelantando = activo;
    },
    respirar(segundos) {
      // Se queda con la más larga en vez de sumarlas: dos novedades en el
      // mismo minuto dan una pausa, no dos seguidas.
      respiro = Math.max(respiro, segundos);
      adelantando = false;
    },
    estaAdelantando: () => adelantando,
    saltarA(minuto) {
      if (minuto <= minutoExacto) return;
      minutoExacto = Math.min(minuto, opciones.minutoFinal);
      adelantando = false;
      avisarHasta(Math.floor(minutoExacto));
    },
    dispose() {
      corriendo = false;
      if (observador) scene.onBeforeRenderObservable.remove(observador);
    },
  };
}