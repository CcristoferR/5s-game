import { AdvancedDynamicTexture, StackPanel, Control, Rectangle, Button } from "@babylonjs/gui";
import {
  PALETA,
  TEXTO,
  MARGEN,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearDivisor,
  crearBotonOpcion,
  rotularOpcion,
  marcarOpcion,
  desvanecer,
} from "./EstiloUI";

export interface OpcionCausa {
  id: string;
  texto: string;
}

const ANCHO_TARJETA = 660;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;

/**
 * Panel de pregunta con opciones.
 *
 * Es la pantalla de referencia del juego: cuando un nivel le pide al jugador
 * que tome una decisión entre alternativas, se ve así. Nació en el modo
 * detective del Nivel 3 y ahora comparte lenguaje visual con la tarjeta de
 * apertura y con los informes, para que todo el juego se lea como una sola
 * pieza y no como pantallas sueltas.
 *
 * Va sobre un velo que bloquea los clics: mientras hay una pregunta abierta, el
 * jugador no puede seguir limpiando ni arrastrando por debajo.
 */
export function mostrarPanelOpciones(
  gui: AdvancedDynamicTexture,
  pregunta: string,
  opciones: OpcionCausa[],
  onElegir: (idOpcion: string) => void,
  rotulo = "LA PREGUNTA"
): { confirmar: (idOpcion: string) => void; ocultar: () => void } {
  const velo = crearVelo(gui, "veloOpciones");

  // El alto lo define el contenido: encabezado, pregunta y una fila por opción.
  // Fijarlo a mano obligaba a encoger el texto cuando la pregunta era larga.
  // Se estima alto por opción: los botones ahora crecen con su texto, así que
  // una pregunta con opciones largas necesita más tarjeta. 82 cubre dos
  // renglones cómodos; con uno solo sobra un poco de aire, que no molesta.
  const altoEstimado = 150 + 82 * opciones.length + 74;
  const tarjeta = crearTarjeta(velo, "tarjetaOpciones", ANCHO_TARJETA, altoEstimado);
  crearFilete(tarjeta, "fileteOpciones", ANCHO_TARJETA, PALETA.aviso);

  const columna = new StackPanel("columnaOpciones");
  columna.isVertical = true;
  columna.width = ANCHO_CONTENIDO + "px";
  columna.left = MARGEN + "px";
  columna.top = "34px";
  columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(columna);

  columna.addControl(crearRotulo("rotuloOpciones", rotulo));
  columna.addControl(crearEspacio("aireRotuloOpciones", 12));
  columna.addControl(
    crearParrafo("preguntaCausa", pregunta, ANCHO_CONTENIDO, TEXTO.titulo, PALETA.titulo, "600")
  );
  columna.addControl(crearEspacio("aireDivisorOpciones", 22));
  columna.addControl(crearDivisor("divisorOpciones", ANCHO_CONTENIDO));
  columna.addControl(crearEspacio("airePostDivisor", 18));

  const botonesPorOpcion = new Map<string, Button>();

  opciones.forEach((opcion, i) => {
    const boton = crearBotonOpcion(`btnOpcion_${opcion.id}`, opcion.texto, ANCHO_CONTENIDO);
    botonesPorOpcion.set(opcion.id, boton);
    boton.onPointerUpObservable.add(() => onElegir(opcion.id));
    columna.addControl(boton);

    // La letra se pone DESPUÉS de agregar el botón: antes de estar en el árbol
    // sus controles hijos todavía no se pueden buscar por nombre.
    rotularOpcion(boton, String.fromCharCode(65 + i));

    if (i < opciones.length - 1) {
      columna.addControl(crearEspacio(`aireOpcion_${i}`, 10));
    }
  });

  desvanecer(velo, 0, 1, 160);

  return {
    /**
     * Marca en verde la opción elegida y deja verla un instante.
     *
     * Es la confirmación de que la respuesta fue correcta. Antes esto se
     * resolvía con un cartel de texto, pero obligaba a elegir entre dos
     * males: o el panel de resultados esperaba a que se apagara —varios
     * segundos de espera muerta— o salía antes y se lo llevaba por delante.
     *
     * Marcar el propio botón resuelve las dos cosas: la confirmación aparece
     * donde el jugador está mirando, en el instante en que hace clic, y no
     * ocupa espacio que después haya que despejar.
     */
    confirmar: (idOpcion: string) => {
      const elegido = botonesPorOpcion.get(idOpcion);
      if (!elegido) return;

      marcarOpcion(elegido, true);

      // Las demás se apagan para que la vista quede en la elegida.
      botonesPorOpcion.forEach((boton, id) => {
        if (id !== idOpcion) boton.alpha = 0.35;
      });
    },

    ocultar: () => {
      velo.isPointerBlocker = false;
      desvanecer(velo, velo.alpha, 0, 140, () => {
        velo.isVisible = false;
        // El dispose va diferido: liberar controles mientras Babylon reparte el
        // evento de clic corta el resto del manejador.
        setTimeout(() => {
          try {
            (velo as Rectangle).dispose();
          } catch {
            /* la escena ya se recreó y se llevó el control */
          }
        }, 0);
      });
    },
  };
}