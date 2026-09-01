import { Scene, Mesh, Color3, PointerEventTypes, AbstractMesh } from "@babylonjs/core";

/**
 * Señal de que un objeto se puede agarrar.
 *
 * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
 *
 * Sin esto, la única forma de saber qué es interactivo es intentar arrastrarlo.
 * En el Nivel 3, donde hay que encontrar manchas entre el mobiliario del
 * garaje, eso significa probar objeto por objeto hasta dar con los que
 * responden — esfuerzo mental que no enseña nada sobre 5S.
 *
 * ─── POR QUÉ NO CARGA LA PANTALLA ─────────────────────────────────────────
 *
 * Una preocupación razonable es que sumar señales visuales agobie. Acá no
 * ocurre, y la diferencia está en qué tipo de elemento se agrega:
 *
 *   - No aparece nada permanente. Solo se realza UN objeto a la vez, el que
 *     está bajo el cursor, y se apaga al moverlo.
 *   - No hay nada que leer ni que interpretar. No ocupa espacio de pantalla
 *     ni compite con los textos de los paneles.
 *   - Aparece exactamente donde el jugador ya está mirando.
 *
 * De hecho REDUCE la carga: reemplaza el ensayo y error por una respuesta
 * inmediata.
 *
 * ─── POR QUÉ UN CONTORNO Y NO UN BRILLO ───────────────────────────────────
 *
 * Un halo o un pulso serían justamente lo que hay que evitar: llaman la
 * atención sobre sí mismos y compiten con el objeto. El contorno del motor se
 * dibuja por fuera de la silueta, no altera el material ni el color del objeto,
 * y a este grosor se percibe sin que uno pueda señalar qué cambió.
 *
 * El cursor también cambia a mano, que es la convención que todo el mundo
 * conoce y no ocupa un solo píxel de la escena.
 */

/** Grosor del contorno, en unidades de escena. Deliberadamente mínimo. */
const GROSOR = 0.008;

/** Un blanco cálido y apagado: se lee sobre el garaje sin parecer un efecto. */
const COLOR = new Color3(0.95, 0.93, 0.82);

export interface ControlRealce {
  /** Deja de realzar un objeto: se llama al fijarlo tras clasificarlo. */
  quitar: (mesh: Mesh) => void;
  /** Suelta los observadores. La escena al destruirse ya los libera. */
  detener: () => void;
}

/**
 * Realza los objetos indicados cuando el cursor pasa sobre ellos.
 *
 * Recibe la lista de mallas agarrables en vez de detectarlo sola: si realzara
 * todo lo que se puede seleccionar, marcaría también el piso, el banco y las
 * paredes del garaje, y entonces sí sería ruido.
 */
export function habilitarRealceAlPasar(scene: Scene, mallas: Mesh[]): ControlRealce {
  const realzables = new Set<Mesh>(mallas);
  let actual: Mesh | null = null;

  function encender(mesh: Mesh): void {
    mesh.renderOutline = true;
    mesh.outlineWidth = GROSOR;
    mesh.outlineColor = COLOR;
    // El cursor de mano es la mitad del mensaje, y es la convención que
    // cualquiera reconoce sin explicación.
    scene.getEngine().getRenderingCanvas()!.style.cursor = "grab";
  }

  function apagar(mesh: Mesh): void {
    mesh.renderOutline = false;
    const lienzo = scene.getEngine().getRenderingCanvas();
    if (lienzo) lienzo.style.cursor = "default";
  }

  /**
   * Sube por la jerarquía hasta encontrar una malla de la lista.
   *
   * Los objetos se fusionan en una sola malla, pero algunos conservan piezas
   * hijas. Sin esto, pasar el cursor sobre el asa de la taza no realzaría nada,
   * porque la pieza tocada no está en la lista aunque su raíz sí.
   */
  function raizRealzable(tocada: AbstractMesh | null | undefined): Mesh | null {
    let nodo: AbstractMesh | null = tocada ?? null;
    while (nodo) {
      if (nodo instanceof Mesh && realzables.has(nodo)) return nodo;
      nodo = nodo.parent as AbstractMesh | null;
    }
    return null;
  }

  const observador = scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERMOVE) return;

    const candidata = raizRealzable(info.pickInfo?.pickedMesh);

    if (candidata === actual) return;

    if (actual) apagar(actual);
    actual = candidata;
    if (actual) encender(actual);
  });

  return {
    quitar: (mesh) => {
      realzables.delete(mesh);
      // Si el objeto que se acaba de fijar era el realzado, hay que apagarlo:
      // de lo contrario queda con el contorno encendido para siempre, marcando
      // como agarrable algo que ya no lo es.
      if (actual === mesh) {
        apagar(mesh);
        actual = null;
      } else {
        mesh.renderOutline = false;
      }
    },

    detener: () => {
      scene.onPointerObservable.remove(observador);
      if (actual) apagar(actual);
      actual = null;
    },
  };
}