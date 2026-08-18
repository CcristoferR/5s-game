import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Button, Rectangle } from "@babylonjs/gui";
export interface OpcionCausa {
  id: string;
  texto: string;
}

// Panel de opciones tipo "elige una respuesta" — para decisiones que no
// tienen sentido como arrastrar (como identificar una causa entre varias).
// Reutilizable por cualquier nivel futuro que necesite esta mecánica.
export function mostrarPanelOpciones(
  scene: Scene,
  pregunta: string,
  opciones: OpcionCausa[],
  onElegir: (idOpcion: string) => void
): { ocultar: () => void } {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("panelOpciones", true, scene);

  const fondo = new Rectangle("fondoOpciones");
  fondo.width = "460px";
  fondo.height = "320px";
  fondo.cornerRadius = 14;
  fondo.thickness = 0;
  fondo.background = "rgba(18, 20, 24, 0.95)";
  gui.addControl(fondo);

  const panel = new StackPanel("panelInternoOpciones");
  panel.isVertical = true;
  panel.width = "400px";
  fondo.addControl(panel);

  const titulo = new TextBlock("preguntaCausa", pregunta);
  titulo.color = "white";
  titulo.fontSize = 18;
  titulo.textWrapping = true;
  titulo.height = "70px";
  panel.addControl(titulo);

  opciones.forEach((opcion) => {
    const boton = Button.CreateSimpleButton(`btnOpcion_${opcion.id}`, opcion.texto);
    boton.width = "380px";
    boton.height = "44px";
    boton.color = "white";
    boton.cornerRadius = 8;
    boton.thickness = 0;
    boton.background = "#3a4550";
    boton.paddingTop = "6px";
    boton.fontSize = 14;

    boton.onPointerUpObservable.add(() => {
      onElegir(opcion.id);
    });

    panel.addControl(boton);
  });

  return { ocultar: () => (fondo.isVisible = false) };
}