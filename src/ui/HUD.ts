import { Scene, Vector3 } from "@babylonjs/core";
import { reproducir } from "../core/Sonido";
import { chispasDeAcierto, humoDeError, lluviaDeEstrellas, puntoFrenteALaCamara } from "../entities/Particulas";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, StackPanel, Button } from "@babylonjs/gui";
import { TEXTO, PALETA } from "./EstiloUI";

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
  private cabeceraFinal: Rectangle;
  private textoTituloFinal: TextBlock;
  private textoStatsFinal: TextBlock;
  private botonVolverMenu: Button;
  private botonReintentar: Button;

  private readonly scene: Scene;
  /** Temporizador que apaga el cartel de feedback. null si no hay ninguno. */
  private temporizadorFeedback: number | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
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
    this.textoPuntaje.fontSize = TEXTO.destacado;
    this.textoPuntaje.height = "38px";
    this.textoPuntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelMarcador.addControl(this.textoPuntaje);

    this.textoTiempo = new TextBlock("tiempo", "⏱  Tiempo: 0s");
    this.textoTiempo.color = "rgba(255,255,255,0.85)";
    this.textoTiempo.fontSize = TEXTO.cuerpo;
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
    this.textoFeedback.fontSize = TEXTO.cuerpo;
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

    this.cabeceraFinal = new Rectangle("cabeceraFinal");
    this.cabeceraFinal.width = "460px";
    this.cabeceraFinal.height = "70px";
    this.cabeceraFinal.thickness = 0;
    this.cabeceraFinal.cornerRadius = 18;
    this.cabeceraFinal.background = "#2e7d46";
    this.cabeceraFinal.top = "0px";
    this.cabeceraFinal.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.pantallaFinal.addControl(this.cabeceraFinal);

    this.textoTituloFinal = new TextBlock("tituloFinal", "");
    this.textoTituloFinal.color = "white";
    this.textoTituloFinal.fontSize = TEXTO.titulo;
    this.textoTituloFinal.top = "0px";
    this.textoTituloFinal.height = "70px";
    this.textoTituloFinal.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.pantallaFinal.addControl(this.textoTituloFinal);

    this.textoStatsFinal = new TextBlock("statsFinal", "");
    this.textoStatsFinal.color = PALETA.cuerpo;
    this.textoStatsFinal.fontSize = TEXTO.cuerpo;
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

    // Solo se muestra cuando el jugador reprueba la auditoría del
    // Nivel 5 (ver mostrarResultadoAuditoria) — en el resto de los
    // niveles queda oculto y mostrarResultadoFinal no lo toca.
    this.botonReintentar = Button.CreateSimpleButton("btnReintentarAuditoria", "🔁 Reintentar auditoría");
    this.botonReintentar.width = "210px";
    this.botonReintentar.height = "46px";
    this.botonReintentar.color = "white";
    this.botonReintentar.cornerRadius = 10;
    this.botonReintentar.thickness = 0;
    this.botonReintentar.background = "#a1552e";
    this.botonReintentar.top = "-20px";
    this.botonReintentar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.botonReintentar.isVisible = false;
    this.pantallaFinal.addControl(this.botonReintentar);
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

  /**
   * Informa un acierto o un error.
   *
   * @param punto Lugar de la escena donde ocurrió. Si se omite, las partículas
   *   salen delante de la cámara — sirve para lo que no pasa en un lugar
   *   concreto, como acertar la pregunta de un panel.
   *
   * Un solo enganche cubre los cinco niveles: todos informan aciertos y errores
   * por acá. Por eso el sonido y las partículas viven en este método y no
   * repartidos por los niveles, donde tarde o temprano alguno quedaría sin su
   * efecto.
   */
  mostrarFeedback(correcto: boolean, mensaje: string, punto?: Vector3): void {
    reproducir(correcto ? "acierto" : "error");

    // Las partículas llegan antes que el texto: el jugador se entera de que
    // estuvo bien sin haber terminado de leer.
    const lugar = punto ?? puntoFrenteALaCamara(this.scene);
    if (correcto) {
      chispasDeAcierto(this.scene, lugar);
    } else {
      humoDeError(this.scene, lugar);
    }

    this.cartelFeedback.background = correcto ? "rgba(30, 110, 50, 0.95)" : "rgba(120, 30, 30, 0.95)";
    this.textoFeedback.text = correcto ? `✅  ${mensaje}` : `❌  ${mensaje}`;
    this.cartelFeedback.isVisible = true;

    // Se cancela el temporizador anterior antes de armar el nuevo.
    //
    // Sin esto los temporizadores se acumulan: si el jugador coloca un objeto
    // dos segundos después del anterior, el temporizador viejo apaga el
    // cartel recién puesto a los 200 ms. El mensaje aparecía y desaparecía sin
    // dar tiempo a leerlo, y encima de forma errática — dependía de cuánto
    // hubiera tardado entre una acción y la otra.
    if (this.temporizadorFeedback !== null) {
      clearTimeout(this.temporizadorFeedback);
    }

    // La duración se ajusta al largo del texto en vez de ser fija. Las
    // explicaciones de los niveles van de 40 a 140 caracteres: con un tiempo
    // único, o las cortas se quedaban de más o las largas no alcanzaban a
    // leerse. El piso de 3,5 s cubre incluso los mensajes de una línea.
    const duracion = Math.min(9000, Math.max(3500, 1200 + mensaje.length * 55));

    this.temporizadorFeedback = window.setTimeout(() => {
      this.cartelFeedback.isVisible = false;
      this.temporizadorFeedback = null;
    }, duracion);
  }

  /**
   * Apaga el cartel de inmediato.
   *
   * Los niveles la llaman cuando el jugador agarra otro objeto: en ese momento
   * ya pasó a lo siguiente y el mensaje anterior sobra. Deja la pantalla limpia
   * para el resultado de ESA acción.
   */
  ocultarFeedback(): void {
    if (this.temporizadorFeedback !== null) {
      clearTimeout(this.temporizadorFeedback);
      this.temporizadorFeedback = null;
    }
    this.cartelFeedback.isVisible = false;
  }

  mostrarResultadoFinal(nombreNivel: string, puntosBase: number, bonusTiempo: number, segundosTotales: number, onVolverMenu: () => void): void {
    // Lluvia de estrellas sobre la escena, más larga que un acierto suelto:
    // terminar una fase tiene que sentirse distinto de clasificar un objeto.
    // Cae detrás del panel de resultados, así el fondo se mantiene vivo
    // mientras el jugador lee su puntaje.
    lluviaDeEstrellas(this.scene, puntoFrenteALaCamara(this.scene, 5));

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

  // Pantalla de resultado propia del Nivel 5: a diferencia de
  // mostrarResultadoFinal (que siempre "celebra"), acá el resultado
  // depende de si el jugador aprobó la auditoría o no. Si reprobó, se
  // muestra un botón para reintentar en vez de dar el nivel por
  // completado — así el certificado deja de aparecer "haga lo que haga".
  mostrarResultadoAuditoria(
    aprobado: boolean,
    puntosBase: number,
    tasaAcierto: number,
    promedioCalificacion: number,
    segundosTotales: number,
    onVolverMenu: () => void,
    onReintentar: () => void
  ): void {
    const tasaPct = Math.round(tasaAcierto * 100);

    this.cabeceraFinal.background = aprobado ? "#2e7d46" : "#8a3a2e";
    this.textoTituloFinal.text = aprobado ? "🎉  Auditoría aprobada" : "⚠️  Auditoría no aprobada";
    this.textoStatsFinal.text =
      `Aciertos de auditoría: ${tasaPct}%\n` +
      `Calificación real del área: ${promedioCalificacion.toFixed(1)}/5\n` +
      `Puntos ganados: ${puntosBase}  (${segundosTotales}s)\n\n` +
      (aprobado
        ? "Nivel 5 completado — certificado disponible en el menú."
        : "No alcanzaste el mínimo de aciertos para aprobar. Puedes reintentar la auditoría.");

    this.fondoOverlay.isVisible = true;
    this.pantallaFinal.isVisible = true;

    this.botonReintentar.isVisible = !aprobado;
    this.botonVolverMenu.left = aprobado ? "0px" : "-115px";
    this.botonReintentar.left = "115px";

    this.botonVolverMenu.onPointerUpObservable.clear();
    this.botonVolverMenu.onPointerUpObservable.add(() => {
      this.fondoOverlay.isVisible = false;
      this.pantallaFinal.isVisible = false;
      onVolverMenu();
    });

    this.botonReintentar.onPointerUpObservable.clear();
    this.botonReintentar.onPointerUpObservable.add(() => {
      this.fondoOverlay.isVisible = false;
      this.pantallaFinal.isVisible = false;
      onReintentar();
    });
  }
}