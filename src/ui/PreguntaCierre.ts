import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { preguntasCierre } from "../data/levelConfig";
import { mostrarPanelOpciones } from "./ChoicePanel";
import { GameManager } from "../core/GameManager";
import { reproducir } from "../core/Sonido";
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
  onResuelto: (explicacion: string) => void
): void {
  const pregunta = preguntasCierre[numeroNivel];

  if (!pregunta) {
    onResuelto("");
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
        // Se marca la opción en verde y se deja ver un momento antes de
        // cerrar. Sin esta pausa el panel desaparecía en el mismo instante del
        // clic y no quedaba ninguna señal de haber acertado: el salto al
        // resultado se sentía brusco, como si el juego se hubiera adelantado.
        panel.confirmar(opcion.id);
        reproducir("acierto");
        gameManager.sumarPuntos(PUNTOS_ACIERTO);

        window.setTimeout(() => panel.ocultar(), 750);

        // La explicación NO se muestra como cartel: se entrega a quien llamó,
        // para que la incluya en el panel de resultados.
        //
        // Como cartel flotante obligaba a esperar a que se apagara antes de
        // que apareciera el panel —varios segundos mirando la pantalla sin
        // poder hacer nada— y si el panel salía antes, se la llevaba por
        // delante. Dentro del panel se lee con calma y sin esperar.
        onResuelto(opcion.explicacion);
        return;
      }

      // El error sí va como cartel: el jugador sigue en la pregunta y
      // necesita leer por qué ese atajo no funciona antes de reintentar.
      hud.mostrarFeedback(false, opcion.explicacion);
    },
    pregunta.rotulo
  );
}