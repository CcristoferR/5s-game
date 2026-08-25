import { AdvancedDynamicTexture, StackPanel, Control, Rectangle } from "@babylonjs/gui";
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
): { ocultar: () => void } {
  const velo = crearVelo(gui, "veloOpciones");

  // El alto lo define el contenido: encabezado, pregunta y una fila por opción.
  // Fijarlo a mano obligaba a encoger el texto cuando la pregunta era larga.
  const altoEstimado = 150 + 62 * opciones.length + 74;
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

  opciones.forEach((opcion, i) => {
    const boton = crearBotonOpcion(`btnOpcion_${opcion.id}`, opcion.texto, ANCHO_CONTENIDO);
    boton.onPointerUpObservable.add(() => onElegir(opcion.id));
    columna.addControl(boton);

    if (i < opciones.length - 1) {
      columna.addControl(crearEspacio(`aireOpcion_${i}`, 10));
    }
  });

  desvanecer(velo, 0, 1, 160);

  return {
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