import { Scene, Mesh, WebXRDefaultExperience } from "@babylonjs/core";

/**
 * Modo WebXR, con la experiencia anterior siempre liberada.
 *
 * La versión anterior tenía una fuga que se acumulaba nivel a nivel. Esta
 * función se llama al entrar a cada nivel, es asíncrona, y nadie esperaba su
 * resultado ni guardaba lo que devolvía. Como el juego destruye la escena en
 * cada cambio, pasaban dos cosas:
 *
 *  - La experiencia XR del nivel anterior nunca se liberaba. Cada una registra
 *    su propio manejo de punteros sobre el lienzo, así que después de dos
 *    niveles había dos compitiendo por el mismo clic, después de tres había
 *    tres, y así.
 *
 *  - Al volver al menú no se llama a setupXR (con razón: en el menú no hay
 *    piso que recorrer), de modo que la del último nivel quedaba viva sobre
 *    una escena ya destruida.
 *
 * Ahí estaba el menú que se ve perfecto, responde al pasar el mouse y no
 * reacciona a ningún clic — y por eso empeoraba mientras más niveles se
 * jugaban en la misma sesión.
 */

let experienciaActual: WebXRDefaultExperience | null = null;

/**
 * Arma el modo XR para la escena dada.
 *
 * El botón "Entrar en VR" solo aparece si Babylon detecta un visor: sin visor
 * el juego sigue igual en pantalla. Lo que sí ocurre siempre, haya visor o no,
 * es que se crea la experiencia y se engancha al reparto de punteros — por eso
 * hay que liberarla aunque nadie use VR.
 */
export async function setupXR(scene: Scene, floorMeshes: Mesh[]): Promise<void> {
  // Antes de armar una nueva se suelta la que hubiera: nunca deben convivir.
  cerrarXR();

  try {
    const experiencia = await scene.createDefaultXRExperienceAsync({ floorMeshes });

    // Entre que se pidio y llego, la escena pudo haberse destruido: el jugador
    // alcanza a salir de un nivel antes de que esto termine de armarse. En ese
    // caso se descarta de inmediato, porque quedaria colgada de una escena que
    // ya no existe.
    if (scene.isDisposed) {
      experiencia.dispose();
      return;
    }

    experienciaActual = experiencia;
  } catch {
    // Si el navegador no soporta WebXR en absoluto, la promesa puede
    // rechazarse — no es un error del juego, solo indica que no hay
    // ningun camino a VR disponible en este dispositivo/navegador.
  }
}

/**
 * Libera la experiencia XR vigente.
 *
 * Hay que llamarla antes de destruir la escena, no despues: una vez destruida
 * la escena, la experiencia ya no encuentra a que soltarse y deja enganchado
 * su manejo de punteros.
 */
export function cerrarXR(): void {
  if (!experienciaActual) return;

  try {
    experienciaActual.dispose();
  } catch {
    // Si la escena se adelanto y ya se la llevo, no hay nada que liberar.
  }

  experienciaActual = null;
}