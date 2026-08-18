import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, StackPanel, Button } from "@babylonjs/gui";

export class HUD {
  private textoPuntaje: TextBlock;
  private textoTiempo: TextBlock;
  private cartelFeedback: Rectangle;
  private textoFeedback: TextBlock;
  private pantallaFinal: Rectangle;
  private textoPantallaFinal: TextBlock;
  private botonVolverMenu: Button;

  constructor(scene: Scene) {
    const gui = AdvancedDynamicTexture.CreateFullscreenUI("hudPrincipal", true, scene);

    const panelSuperior = new StackPanel("panelSuperior");
    panelSuperior.isVertical = true;
    panelSuperior.top = "16px";
    panelSuperior.left = "16px";
    panelSuperior.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelSuperior.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panelSuperior.width = "220px";
    gui.addControl(panelSuperior);

    this.textoPuntaje = new TextBlock("puntaje", "Puntaje: 0");
    this.textoPuntaje.color = "white";
    this.textoPuntaje.fontSize = 22;
    this.textoPuntaje.height = "30px";
    this.textoPuntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelSuperior.addControl(this.textoPuntaje);

    this.textoTiempo = new TextBlock("tiempo", "Tiempo: 0s");
    this.textoTiempo.color = "white";
    this.textoTiempo.fontSize = 18;
    this.textoTiempo.height = "26px";
    this.textoTiempo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelSuperior.addControl(this.textoTiempo);

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

    this.pantallaFinal = new Rectangle("pantallaFinal");
    this.pantallaFinal.width = "480px";
    this.pantallaFinal.height = "300px";
    this.pantallaFinal.cornerRadius = 16;
    this.pantallaFinal.thickness = 0;
    this.pantallaFinal.background = "rgba(15, 20, 18, 0.95)";
    this.pantallaFinal.isVisible = false;
    gui.addControl(this.pantallaFinal);

    this.textoPantallaFinal = new TextBlock("textoPantallaFinal", "");
    this.textoPantallaFinal.color = "white";
    this.textoPantallaFinal.fontSize = 20;
    this.textoPantallaFinal.textWrapping = true;
    this.textoPantallaFinal.top = "-40px";
    this.pantallaFinal.addControl(this.textoPantallaFinal);

    // Botón para volver al mapa de niveles — se crea una sola vez, oculto
    // hasta que se muestra el resultado final del nivel.
    this.botonVolverMenu = Button.CreateSimpleButton("btnVolverMenu", "Volver al menú");
    this.botonVolverMenu.width = "200px";
    this.botonVolverMenu.height = "42px";
    this.botonVolverMenu.color = "white";
    this.botonVolverMenu.cornerRadius = 8;
    this.botonVolverMenu.thickness = 0;
    this.botonVolverMenu.background = "#2e7d46";
    this.botonVolverMenu.top = "100px";
    this.pantallaFinal.addControl(this.botonVolverMenu);
  }

  actualizarPuntaje(puntaje: number): void {
    this.textoPuntaje.text = `Puntaje: ${puntaje}`;
  }

  actualizarTiempo(segundos: number): void {
    this.textoTiempo.text = `Tiempo: ${segundos}s`;
  }

  actualizarTiempoRestante(segundos: number): void {
    this.textoTiempo.text = `Tiempo restante: ${segundos}s`;
  }

  mostrarFeedback(correcto: boolean, mensaje: string): void {
    this.cartelFeedback.background = correcto ? "rgba(30, 110, 50, 0.9)" : "rgba(120, 30, 30, 0.9)";
    this.textoFeedback.text = correcto ? `✅ ${mensaje}` : `❌ ${mensaje}`;
    this.cartelFeedback.isVisible = true;

    setTimeout(() => {
      this.cartelFeedback.isVisible = false;
    }, 2200);
  }

  mostrarResultadoFinal(nombreNivel: string, puntosBase: number, bonusTiempo: number, segundosTotales: number, onVolverMenu: () => void): void {
    const total = puntosBase + bonusTiempo;
    this.textoPantallaFinal.text =
      `🎉 ${nombreNivel} completado\n\n` +
      `Puntos por desempeño: ${puntosBase}\n` +
      `Bonus por tiempo (${segundosTotales}s): +${bonusTiempo}\n\n` +
      `Total: ${total}`;
    this.pantallaFinal.isVisible = true;

    this.botonVolverMenu.onPointerUpObservable.clear();
    this.botonVolverMenu.onPointerUpObservable.add(onVolverMenu);
  }
}