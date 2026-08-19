import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, StackPanel, Button } from "@babylonjs/gui";

// Capa de interfaz ÚNICA compartida por todo lo que pasa en el nivel:
// marcador, feedback, resultado final — y también las etiquetas de zona
// e instrucciones de cada nivel usan ESTA MISMA capa (hud.gui), en vez
// de crear cada una la suya. Eso es lo que corrige el bug de las
// etiquetas atravesando el panel de resultado.
export class HUD {
  readonly gui: AdvancedDynamicTexture;

  private textoPuntaje: TextBlock;
  private textoTiempo: TextBlock;
  private cartelFeedback: Rectangle;
  private textoFeedback: TextBlock;
  private fondoOverlay: Rectangle;
  private pantallaFinal: Rectangle;
  private textoTituloFinal: TextBlock;
  private textoStatsFinal: TextBlock;
  private botonVolverMenu: Button;

  constructor(scene: Scene) {
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI("hudPrincipal", true, scene);

    // --- Marcador: ahora con tarjeta real detrás, no texto flotando solo ---
    const marcador = new Rectangle("marcador");
    marcador.width = "220px";
    marcador.height = "84px";
    marcador.cornerRadius = 12;
    marcador.thickness = 1;
    marcador.color = "rgba(255,255,255,0.15)";
    marcador.background = "rgba(18, 20, 24, 0.82)";
    marcador.top = "16px";
    marcador.left = "16px";
    marcador.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marcador.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.gui.addControl(marcador);

    const franjaAcento = new Rectangle("franjaAcentoMarcador");
    franjaAcento.width = "5px";
    franjaAcento.height = "84px";
    franjaAcento.thickness = 0;
    franjaAcento.background = "#2e7d46";
    franjaAcento.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marcador.addControl(franjaAcento);

    const panelMarcador = new StackPanel("panelMarcador");
    panelMarcador.isVertical = true;
    panelMarcador.width = "195px";
    panelMarcador.left = "12px";
    panelMarcador.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marcador.addControl(panelMarcador);

    this.textoPuntaje = new TextBlock("puntaje", "🏆  Puntaje: 0");
    this.textoPuntaje.color = "white";
    this.textoPuntaje.fontSize = 19;
    this.textoPuntaje.height = "38px";
    this.textoPuntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelMarcador.addControl(this.textoPuntaje);

    this.textoTiempo = new TextBlock("tiempo", "⏱  Tiempo: 0s");
    this.textoTiempo.color = "rgba(255,255,255,0.85)";
    this.textoTiempo.fontSize = 16;
    this.textoTiempo.height = "30px";
    this.textoTiempo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelMarcador.addControl(this.textoTiempo);

    // --- Cartel de feedback ---
    this.cartelFeedback = new Rectangle("cartelFeedback");
    this.cartelFeedback.width = "440px";
    this.cartelFeedback.height = "80px";
    this.cartelFeedback.cornerRadius = 12;
    this.cartelFeedback.thickness = 1;
    this.cartelFeedback.color = "rgba(255,255,255,0.15)";
    this.cartelFeedback.background = "rgba(20, 20, 25, 0.92)";
    this.cartelFeedback.top = "-40px";
    this.cartelFeedback.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.cartelFeedback.isVisible = false;
    this.cartelFeedback.zIndex = 40; // siempre por encima de etiquetas/instrucciones del nivel
    this.gui.addControl(this.cartelFeedback);

    this.textoFeedback = new TextBlock("textoFeedback", "");
    this.textoFeedback.color = "white";
    this.textoFeedback.fontSize = 15;
    this.textoFeedback.textWrapping = true;
    this.textoFeedback.paddingLeft = "18px";
    this.textoFeedback.paddingRight = "18px";
    this.cartelFeedback.addControl(this.textoFeedback);

    // --- Fondo oscuro detrás del resultado final: cubre TODO lo demás
    // del nivel mientras se lee, en vez de dejar cosas asomando detrás ---
    this.fondoOverlay = new Rectangle("fondoOverlayResultado");
    this.fondoOverlay.width = "100%";
    this.fondoOverlay.height = "100%";
    this.fondoOverlay.thickness = 0;
    this.fondoOverlay.background = "rgba(8, 9, 11, 0.72)";
    this.fondoOverlay.isVisible = false;
    this.fondoOverlay.zIndex = 50;
    this.gui.addControl(this.fondoOverlay);

    this.pantallaFinal = new Rectangle("pantallaFinal");
    this.pantallaFinal.width = "460px";
    this.pantallaFinal.height = "340px";
    this.pantallaFinal.cornerRadius = 18;
    this.pantallaFinal.thickness = 1;
    this.pantallaFinal.color = "rgba(255,255,255,0.2)";
    this.pantallaFinal.background = "rgba(16, 20, 18, 0.98)";
    this.pantallaFinal.isVisible = false;
    this.pantallaFinal.zIndex = 51;
    this.gui.addControl(this.pantallaFinal);

    const cabecera = new Rectangle("cabeceraFinal");
    cabecera.width = "460px";
    cabecera.height = "70px";
    cabecera.thickness = 0;
    cabecera.cornerRadius = 18;
    cabecera.background = "#2e7d46";
    cabecera.top = "0px";
    cabecera.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.pantallaFinal.addControl(cabecera);

    this.textoTituloFinal = new TextBlock("tituloFinal", "");
    this.textoTituloFinal.color = "white";
    this.textoTituloFinal.fontSize = 22;
    this.textoTituloFinal.top = "0px";
    this.textoTituloFinal.height = "70px";
    this.textoTituloFinal.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.pantallaFinal.addControl(this.textoTituloFinal);

    this.textoStatsFinal = new TextBlock("statsFinal", "");
    this.textoStatsFinal.color = "rgba(255,255,255,0.92)";
    this.textoStatsFinal.fontSize = 18;
    this.textoStatsFinal.top = "20px";
    this.textoStatsFinal.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.pantallaFinal.addControl(this.textoStatsFinal);

    this.botonVolverMenu = Button.CreateSimpleButton("btnVolverMenu", "Volver al menú");
    this.botonVolverMenu.width = "210px";
    this.botonVolverMenu.height = "46px";
    this.botonVolverMenu.color = "white";
    this.botonVolverMenu.cornerRadius = 10;
    this.botonVolverMenu.thickness = 0;
    this.botonVolverMenu.background = "#3a5a7a";
    this.botonVolverMenu.top = "-20px";
    this.botonVolverMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.pantallaFinal.addControl(this.botonVolverMenu);
  }

  actualizarPuntaje(puntaje: number): void {
    this.textoPuntaje.text = `🏆  Puntaje: ${puntaje}`;
  }

  actualizarTiempo(segundos: number): void {
    this.textoTiempo.text = `⏱  Tiempo: ${segundos}s`;
  }

  actualizarTiempoRestante(segundos: number): void {
    this.textoTiempo.text = `⏱  Restante: ${segundos}s`;
  }

  mostrarFeedback(correcto: boolean, mensaje: string): void {
    this.cartelFeedback.background = correcto ? "rgba(30, 110, 50, 0.95)" : "rgba(120, 30, 30, 0.95)";
    this.textoFeedback.text = correcto ? `✅  ${mensaje}` : `❌  ${mensaje}`;
    this.cartelFeedback.isVisible = true;

    setTimeout(() => {
      this.cartelFeedback.isVisible = false;
    }, 2200);
  }

  mostrarResultadoFinal(nombreNivel: string, puntosBase: number, bonusTiempo: number, segundosTotales: number, onVolverMenu: () => void): void {
    const total = puntosBase + bonusTiempo;
    this.textoTituloFinal.text = `🎉  ${nombreNivel} completado`;
    this.textoStatsFinal.text =
      `Puntos por desempeño:  ${puntosBase}\n` +
      `Bonus por tiempo (${segundosTotales}s):  +${bonusTiempo}\n\n` +
      `Total:  ${total}`;

    this.fondoOverlay.isVisible = true;
    this.pantallaFinal.isVisible = true;

    this.botonVolverMenu.onPointerUpObservable.clear();
    this.botonVolverMenu.onPointerUpObservable.add(() => {
      this.fondoOverlay.isVisible = false;
      this.pantallaFinal.isVisible = false;
      onVolverMenu();
    });
  }
}