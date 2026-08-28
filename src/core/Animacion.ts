import { Scene, Mesh, Vector3 } from "@babylonjs/core";

/**
 * Lleva una malla desde donde está hasta un destino, con un movimiento corto.
 *
 * Existe porque los objetos del juego se arrastran a una altura fija (la del
 * banco de trabajo) y al soltarlos hay que bajarlos a donde realmente van. Sin
 * esto quedaban flotando a la altura del tablero por encima de las zonas del
 * piso: se veían suspendidos en el aire y proyectaban su sombra lejos de su
 * base, que es lo que hacía ver la escena como rota.
 *
 * Se apoya en el observable de la escena y no en requestAnimationFrame porque
 * acá sí conviene: si la escena se destruye a mitad del movimiento (el jugador
 * volvió al menú), el observador se va con ella y no queda nada corriendo
 * contra una malla que ya no existe.
 */
export function moverMalla(
  scene: Scene,
  malla: Mesh,
  destino: Vector3,
  duracionMs: number,
  alTerminar?: () => void
): void {
  const origen = malla.position.clone();
  const inicio = performance.now();

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (malla.isDisposed()) {
      scene.onBeforeRenderObservable.remove(observador);
      return;
    }

    const avance = Math.min(1, (performance.now() - inicio) / duracionMs);

    // Horizontal: desacelera al llegar. Vertical: acelera al caer, como si
    // pesara. Separar los dos ejes es lo que hace que el movimiento se lea como
    // "lo apoyaron" y no como una interpolación recta.
    const suaveXZ = 1 - Math.pow(1 - avance, 3);
    const caida = avance * avance;

    malla.position.x = origen.x + (destino.x - origen.x) * suaveXZ;
    malla.position.z = origen.z + (destino.z - origen.z) * suaveXZ;
    malla.position.y = origen.y + (destino.y - origen.y) * caida;

    if (avance >= 1) {
      malla.position.copyFrom(destino);
      scene.onBeforeRenderObservable.remove(observador);
      if (alTerminar) alTerminar();
    }
  });
}
/**
 * Ejecuta algo después de una pausa, salvo que la escena ya no exista.
 *
 * Las secuencias de fin de nivel encadenan esperas de varios segundos y al
 * terminar tocan la interfaz. Si en ese lapso el jugador vuelve al menú, la
 * escena se destruye y el temporizador sigue vivo: dispara contra controles y
 * mallas que ya no están.
 *
 * No es un fallo que se vea siempre —hay que salir justo en esa ventana— pero
 * cuando ocurre deja el juego en un estado incoherente y sin ningún mensaje
 * que explique por qué.
 */
export function luegoDe(scene: Scene, milisegundos: number, accion: () => void): void {
  window.setTimeout(() => {
    if (scene.isDisposed) return;
    accion();
  }, milisegundos);
}