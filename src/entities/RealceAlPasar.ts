import { Scene, Mesh } from "@babylonjs/core";

// ---------------------------------------------------------------------------
// Realce al pasar el cursor — DESACTIVADO
// ---------------------------------------------------------------------------
//
// El modulo esta apagado por decision de diseno: se probo el contorno sobre
// los objetos agarrables y se prefirio la escena sin el.
//
// Se conserva el archivo, con la misma interfaz, en vez de borrarlo. Los
// Niveles 1, 2 y 4 llaman a realce.quitar(...) al fijar cada objeto: sin este
// modulo habria que editar esos cinco niveles para sacar las llamadas, y el
// unico efecto seria el mismo que se logra aca sin tocar nada mas.
//
// Para volver a encenderlo, recuperar la version anterior del archivo desde el
// historial de git. Los niveles no necesitan ningun cambio.

export interface ControlRealce {
  /** Sin efecto. Se conserva para no romper a quien la llama. */
  quitar: (mesh: Mesh) => void;
  /** Sin efecto. */
  detener: () => void;
}

/**
 * No hace nada.
 *
 * Devuelve un control valido para que los niveles sigan funcionando sin
 * cambios.
 */
export function habilitarRealceAlPasar(_scene: Scene, _mallas: Mesh[]): ControlRealce {
  return {
    quitar: () => {},
    detener: () => {},
  };
}