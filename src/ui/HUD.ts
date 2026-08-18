import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control } from "@babylonjs/gui";

// Capa de interfaz 2D sobre la escena 3D, hecha con Babylon.GUI (no HTML)
// para que también se vea dentro del visor en modo VR más adelante.
export class HUD {
  private textoPuntaje: TextBlock;
  private cartelFeedback: Rectangle;
  private textoFeedback: TextBlock;

  constructor(scene: Scene) {
    const gui = AdvancedDynamicTexture.CreateFullscreenUI("hudPrincipal", true, scene);

    this.textoPuntaje = new TextBlock("puntaje", "Puntaje: 0");
    this.textoPuntaje.color = "white";
    this.textoPuntaje.fontSize = 22;
    this.textoPuntaje.top = "16px";
    this.textoPuntaje.left = "16px";
    this.textoPuntaje.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoPuntaje.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    gui.addControl(this.textoPuntaje);

    // Cartel de feedback: oculto por defecto, aparece un momento tras cada decisión.
    this.cartelFeedback = new Rectangle("cartelFeedback");
    this.cartelFeedback.width = "420px";
    this.cartelFeedback.height = "90px";
    this.cartelFeedback.cornerRadius = 10;
    this.cartelFeedback.thickness = 0;
    this.cartelFeedback.background = "rgba(20, 20, 25, 0.85)";
    this.cartelFeedback.top = "-40px";
    this.cartelFeedback.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.cartelFeedback.isVisible = false;
    gui.addControl(this.cartelFeedback);

    this.textoFeedback = new TextBlock("textoFeedback", "");
    this.textoFeedback.color = "white";
    this.textoFeedback.fontSize = 16;
    this.textoFeedback.textWrapping = true;
    this.cartelFeedback.addControl(this.textoFeedback);
  }

  actualizarPuntaje(puntaje: number): void {
    this.textoPuntaje.text = `Puntaje: ${puntaje}`;
  }

  mostrarFeedback(correcto: boolean, mensaje: string): void {
    this.cartelFeedback.background = correcto ? "rgba(30, 110, 50, 0.9)" : "rgba(120, 30, 30, 0.9)";
    this.textoFeedback.text = correcto ? `✅ ${mensaje}` : `❌ ${mensaje}`;
    this.cartelFeedback.isVisible = true;

    setTimeout(() => {
      this.cartelFeedback.isVisible = false;
    }, 2200);
  }
}