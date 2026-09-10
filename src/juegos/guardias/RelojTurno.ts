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
const MINUTOS_POR_SEGUNDO = 1.5;

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

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!corriendo || terminado) return;

    // Se acota el paso: si la pestaña estuvo en segundo plano, el navegador
    // devuelve un delta enorme y el turno saltaría media hora de golpe.
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    minutoExacto += dt * MINUTOS_POR_SEGUNDO * (adelantando ? FACTOR_ADELANTO : 1);

    if (minutoExacto >= opciones.minutoFinal) {
      minutoExacto = opciones.minutoFinal;
      terminado = true;
    }

    avisarHasta(Math.floor(minutoExacto));
  });

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
      // Soltar el adelanto al pausar evita la sorpresa de volver de un panel
      // con el turno disparado.
      if (!activo) adelantando = false;
    },
    adelantar(activo) {
      adelantando = activo;
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