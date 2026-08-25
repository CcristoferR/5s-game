import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { preguntasCierre } from "../data/levelConfig";
import { mostrarPanelOpciones } from "./ChoicePanel";
import { GameManager } from "../core/GameManager";
import type { HUD } from "./HUD";

/** Puntos que suma responder bien. Igual que las preguntas del modo detective. */
const PUNTOS_ACIERTO = 20;

/**
 * Plantea la pregunta de cierre del nivel y llama a onResuelto cuando se acierta.
 *
 * Mismo mecanismo que el modo detective del Nivel 3: el panel queda abierto
 * hasta que el jugador da con la respuesta correcta, y cada intento fallido
 * devuelve la explicación de por qué ese atajo no funciona.
 *
 * Que no se pueda avanzar con una respuesta incorrecta es deliberado: el
 * propósito del cierre no es medir, es que el criterio quede claro antes de
 * pasar a la fase siguiente, que se apoya en él. La penalización por errar ya
 * la lleva el reloj.
 *
 * Si un nivel no tiene pregunta cargada, se sigue de largo sin romper nada.
 */
export function preguntarCierreDeNivel(
  gui: AdvancedDynamicTexture,
  hud: HUD,
  numeroNivel: number,
  onResuelto: () => void
): void {
  const pregunta = preguntasCierre[numeroNivel];

  if (!pregunta) {
    onResuelto();
    return;
  }

  const gameManager = GameManager.getInstance();

  const panel = mostrarPanelOpciones(
    gui,
    pregunta.pregunta,
    pregunta.opciones.map((opcion) => ({ id: opcion.id, texto: opcion.texto })),
    (idElegido) => {
      const opcion = pregunta.opciones.find((o) => o.id === idElegido)!;

      if (opcion.esCorrecta) {
        panel.ocultar();
        gameManager.sumarPuntos(PUNTOS_ACIERTO);
        hud.mostrarFeedback(true, opcion.explicacion);
        onResuelto();
        return;
      }

      hud.mostrarFeedback(false, opcion.explicacion);
    },
    pregunta.rotulo
  );
}