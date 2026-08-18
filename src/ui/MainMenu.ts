import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Button, Rectangle } from "@babylonjs/gui";

export interface NivelMenuInfo {
  numero: number;
  nombre: string;
  desbloqueado: boolean;
}

// Menú principal: título + lista de niveles. Solo el Nivel 1 está activo
// hoy — los demás se muestran bloqueados, listos para habilitarse cuando
// existan de verdad (Level2_Seiton.ts, etc.), sin rehacer este menú.
export function mostrarMenuPrincipal(
  scene: Scene,
  niveles: NivelMenuInfo[],
  onSeleccionarNivel: (numero: number) => void
): { ocultar: () => void } {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("menuPrincipal", true, scene);

  const fondo = new Rectangle("fondoMenu");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(15, 18, 22, 0.92)";
  gui.addControl(fondo);

  const panel = new StackPanel("panelMenu");
  panel.isVertical = true;
  panel.width = "340px";
  fondo.addControl(panel);

  const titulo = new TextBlock("tituloMenu", "Gamificación 5S");
  titulo.color = "white";
  titulo.fontSize = 32;
  titulo.height = "70px";
  panel.addControl(titulo);

  niveles.forEach((nivel) => {
    const etiqueta = nivel.desbloqueado ? `▶ ${nivel.nombre}` : `🔒 ${nivel.nombre}`;
    const boton = Button.CreateSimpleButton(`btnNivel${nivel.numero}`, etiqueta);
    boton.width = "300px";
    boton.height = "48px";
    boton.color = "white";
    boton.cornerRadius = 8;
    boton.thickness = 0;
    boton.background = nivel.desbloqueado ? "#2e7d46" : "#3a3d42";
    boton.paddingTop = "8px";
    boton.isEnabled = nivel.desbloqueado;
    boton.alpha = nivel.desbloqueado ? 1 : 0.55;

    if (nivel.desbloqueado) {
      boton.onPointerUpObservable.add(() => {
        fondo.isVisible = false;
        onSeleccionarNivel(nivel.numero);
      });
    }

    panel.addControl(boton);
  });

  return { ocultar: () => (fondo.isVisible = false) };
}