import { Scene, Vector3 } from "@babylonjs/core";
import { reproducir } from "../core/Sonido";
import { chispasDeAcierto, humoDeError, lluviaDeEstrellas, puntoFrenteALaCamara } from "../entities/Particulas";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, StackPanel, Button } from "@babylonjs/gui";
import { TEXTO, PALETA, desvanecer } from "./EstiloUI";

// Capa de interfaz ÚNICA compartida por todo lo que pasa en el nivel:
// marcador, feedback, resultado final — y también las etiquetas de zona
// e instrucciones de cada nivel usan ESTA MISMA capa (hud.gui), en vez
// de crear cada una la suya. Eso es lo que corrige el bug de las
// etiquetas atravesando el panel de resultado.
// Medidas del panel de resultados. Están acá y no sueltas en el constructor
// porque el alto del panel se calcula a partir de ellas cada vez que se
// muestra: el texto de cierre cambia de largo según el nivel.
const ANCHO_PANEL_FINAL = 460;
const ALTO_CABECERA_FINAL = 70;
/** Distancia del borde superior del panel al inicio del texto. */
const DESDE_ARRIBA_STATS = 96;
/** Botón (46) + separación por arriba (26) + margen inferior (22). */
const ESPACIO_BOTONES_FINAL = 94;
/** Alto mínimo, para que un resultado sin frase de cierre no quede apretado. */
const ALTO_MINIMO_FINAL = 340;
/** Aire extra bajo el texto: la medida que informa la interfaz queda justa. */
const COLCHON_FINAL = 18;

export class HUD {
  readonly gui: AdvancedDynamicTexture;

  private textoPuntaje: TextBlock;
  private textoTiempo: TextBlock;
  private cartelFeedback: Rectangle;
  private franjaFeedback: Rectangle;
  private rotuloFeedback: TextBlock;
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

    this.textoPuntaje = new TextBlock("puntaje", "Puntaje  0");
    this.textoPuntaje.color = "white";
    this.textoPuntaje.fontSize = TEXTO.destacado;
    this.textoPuntaje.height = "38px";
    this.textoPuntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelMarcador.addControl(this.textoPuntaje);

    this.textoTiempo = new TextBlock("tiempo", "Tiempo  0s");
    this.textoTiempo.color = "rgba(255,255,255,0.85)";
    this.textoTiempo.fontSize = TEXTO.cuerpo;
    this.textoTiempo.height = "30px";
    this.textoTiempo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panelMarcador.addControl(this.textoTiempo);

    // --- Cartel de feedback ---
    // CARTEL DE RETROALIMENTACIÓN
    //
    // Antes era un rectángulo que se teñía entero de verde o rojo con un tilde
    // o una cruz adelante del texto. Se leía como un aviso de sistema, no como
    // parte del juego: el color plano competía con el texto y los símbolos
    // repetían lo que el color ya decía.
    //
    // Ahora la tarjeta es siempre del mismo gris —el mismo de las demás
    // pantallas— y el resultado lo comunican dos cosas: una franja de color al
    // costado y un rótulo corto arriba. El color aparece en dosis chicas, el
    // texto queda sobre un fondo neutro y todo el juego habla el mismo idioma
    // visual.
    this.cartelFeedback = new Rectangle("cartelFeedback");
    this.cartelFeedback.width = "520px";
    this.cartelFeedback.height = "88px";
    this.cartelFeedback.cornerRadius = 12;
    this.cartelFeedback.thickness = 1;
    this.cartelFeedback.color = PALETA.borde;
    this.cartelFeedback.background = PALETA.tarjeta;
    this.cartelFeedback.top = "-40px";
    this.cartelFeedback.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.cartelFeedback.isVisible = false;
    this.cartelFeedback.zIndex = 40; // siempre por encima de etiquetas/instrucciones del nivel
    this.gui.addControl(this.cartelFeedback);

    this.franjaFeedback = new Rectangle("franjaFeedback");
    this.franjaFeedback.width = "4px";
    this.franjaFeedback.height = "88px";
    this.franjaFeedback.thickness = 0;
    this.franjaFeedback.background = PALETA.acierto;
    this.franjaFeedback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.franjaFeedback.isHitTestVisible = false;
    this.cartelFeedback.addControl(this.franjaFeedback);

    const columnaFeedback = new StackPanel("columnaFeedback");
    columnaFeedback.isVertical = true;
    columnaFeedback.width = "446px";
    columnaFeedback.left = "26px";
    columnaFeedback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.cartelFeedback.addControl(columnaFeedback);

    // Rótulo corto en mayúscula chica: dice el resultado en una palabra, para
    // quien mira de reojo, sin obligar a leer la explicación completa.
    this.rotuloFeedback = new TextBlock("rotuloFeedback", "");
    this.rotuloFeedback.color = PALETA.acierto;
    this.rotuloFeedback.fontSize = TEXTO.rotulo;
    this.rotuloFeedback.fontWeight = "600";
    this.rotuloFeedback.height = "18px";
    this.rotuloFeedback.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.rotuloFeedback.isHitTestVisible = false;
    columnaFeedback.addControl(this.rotuloFeedback);

    const aireFeedback = new Rectangle("aireFeedback");
    aireFeedback.width = "1px";
    aireFeedback.height = "6px";
    aireFeedback.thickness = 0;
    aireFeedback.background = "transparent";
    aireFeedback.isHitTestVisible = false;
    columnaFeedback.addControl(aireFeedback);

    this.textoFeedback = new TextBlock("textoFeedback", "");
    this.textoFeedback.color = PALETA.cuerpo;
    this.textoFeedback.fontSize = TEXTO.cuerpo;
    this.textoFeedback.textWrapping = true;
    this.textoFeedback.resizeToFit = true;
    this.textoFeedback.width = "446px";
    this.textoFeedback.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoFeedback.isHitTestVisible = false;
    columnaFeedback.addControl(this.textoFeedback);

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
    this.pantallaFinal.width = `${ANCHO_PANEL_FINAL}px`;
    this.pantallaFinal.height = `${ALTO_MINIMO_FINAL}px`;
    this.pantallaFinal.cornerRadius = 18;
    this.pantallaFinal.thickness = 1;
    this.pantallaFinal.color = "rgba(255,255,255,0.2)";
    this.pantallaFinal.background = "rgba(16, 20, 18, 0.98)";
    this.pantallaFinal.isVisible = false;
    this.pantallaFinal.zIndex = 51;
    this.gui.addControl(this.pantallaFinal);

    this.cabeceraFinal = new Rectangle("cabeceraFinal");
    this.cabeceraFinal.width = `${ANCHO_PANEL_FINAL}px`;
    this.cabeceraFinal.height = `${ALTO_CABECERA_FINAL}px`;
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

    // Ajuste de línea y ancho fijo.
    //
    // Sin esto la frase de cierre —que puede tener bastante texto— salía en un
    // solo renglón, más ancho que el panel, y el panel la recortaba por los
    // dos costados. Se veía media frase con los bordes cortados.
    this.textoStatsFinal.textWrapping = true;
    this.textoStatsFinal.width = `${ANCHO_PANEL_FINAL - 64}px`;
    // resizeToFit con textWrapping ajusta solo el alto: el ancho ya está
    // fijado arriba. Es lo que permite saber cuánto ocupa el texto de verdad
    // para dimensionar el panel.
    // Sin lineSpacing a propósito: resizeToFit NO lo suma al alto que
    // informa. Con separación de 4 px y nueve renglones, el panel quedaba
    // 36 px corto y cortaba justo la última línea. Es preferible el
    // interlineado por defecto y una medida que cierre.
    this.textoStatsFinal.resizeToFit = true;

    // Anclado bajo la cabecera en vez de centrado en el panel: centrado, al
    // crecer el texto se metía debajo del botón. Desde arriba la posición es
    // predecible y el alto del panel se calcula con una suma.
    this.textoStatsFinal.top = `${DESDE_ARRIBA_STATS}px`;
    this.textoStatsFinal.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
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
    this.botonReintentar = Button.CreateSimpleButton("btnReintentarAuditoria", "Reintentar auditoría");
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
    this.textoPuntaje.text = `Puntaje  ${puntaje}`;
  }

  actualizarTiempo(segundos: number): void {
    this.textoTiempo.text = `Tiempo  ${segundos}s`;
  }

  actualizarTiempoRestante(segundos: number): void {
    this.textoTiempo.text = `Restante  ${segundos}s`;
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

    const color = correcto ? PALETA.acierto : PALETA.error;
    this.franjaFeedback.background = color;
    this.rotuloFeedback.color = color;
    this.rotuloFeedback.text = correcto ? "CORRECTO" : "REVISA ESTO";
    this.textoFeedback.text = mensaje;

    // El alto se calcula a partir del texto en vez de quedar fijo. Las
    // explicaciones de los niveles van de 40 a 140 caracteres: con una altura
    // única, o las cortas dejaban un hueco vacío o las largas se cortaban.
    const ANCHO_UTIL = 446;
    const renglones = Math.max(1, Math.ceil(mensaje.length / Math.floor(ANCHO_UTIL / 9)));
    const alto = 44 + renglones * 24;
    this.cartelFeedback.height = alto + "px";
    this.franjaFeedback.height = alto + "px";

    this.cartelFeedback.isVisible = true;
    // Aparición corta: sin ella el cartel salta de golpe y se lee como un
    // error del programa más que como una respuesta del juego.
    desvanecer(this.cartelFeedback, 0, 1, 140);

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

    // Duración según el largo del texto, acotada por arriba y por abajo.
    //
    // El cálculo anterior daba casi nueve segundos para las explicaciones
    // largas: el cartel quedaba en pantalla mucho después de que el jugador
    // hubiera seguido jugando, y terminaba estorbando en vez de informar.
    //
    // Estos números salen de una velocidad de lectura de unos 26 caracteres
    // por segundo —cómoda para una frase suelta que se mira de reojo— más un
    // instante para notar que apareció. El techo de 6 s es el límite práctico:
    // más que eso, quien quiso leer ya leyó, y a quien no le interesó solo le
    // tapa la escena.
    const duracion = Math.min(6000, Math.max(2800, 900 + mensaje.length * 38));

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

  /**
   * @param cierre Explicación de la pregunta de cierre, si el nivel tiene una.
   *   Va DENTRO del panel y no como cartel flotante: el cartel obligaba a
   *   esperar a que se apagara antes de que apareciera el panel —eran varios
   *   segundos mirando la pantalla sin poder hacer nada—, y si el panel salía
   *   antes, se lo llevaba por delante. Puesta acá, el resultado aparece
   *   enseguida y la explicación se puede leer con calma.
   */
  /**
   * Ajusta el alto del panel a lo que ocupa el texto.
   *
   * El alto real de un bloque con ajuste de línea solo se conoce DESPUÉS de
   * que la interfaz lo mide, y eso ocurre al dibujar. Por eso el cálculo va en
   * el cuadro siguiente y no acá mismo: si se leyera ahora, se leería la
   * medida del texto anterior.
   *
   * Sin esto el panel tenía alto fijo y la frase de cierre —que cambia de
   * largo en cada nivel— se metía debajo del botón o se cortaba abajo.
   */
  private ajustarAltoPanelFinal(pasadasRestantes = 3): void {
    this.scene.onAfterRenderObservable.addOnce(() => {
      if (!this.pantallaFinal.isVisible) return;

      const altoTexto = this.textoStatsFinal.heightInPixels;
      if (!altoTexto) return;

      const necesario =
        DESDE_ARRIBA_STATS + altoTexto + ESPACIO_BOTONES_FINAL + COLCHON_FINAL;
      // Tope por si algún día una frase de cierre se va de largo: más alto que
      // esto no entra en pantallas bajas, y es preferible un panel apretado a
      // uno que se sale del borde.
      const alto = Math.min(620, Math.max(ALTO_MINIMO_FINAL, Math.ceil(necesario)));

      const actual = this.pantallaFinal.heightInPixels;
      this.pantallaFinal.height = `${alto}px`;

      // Red de seguridad: si con el panel más grande el texto resulta medir
      // más que antes, se vuelve a calcular. Con la medida ya correcta esto
      // no llega a dispararse, pero evita que una frase inesperadamente larga
      // vuelva a quedar cortada.
      if (pasadasRestantes > 0 && alto > actual + 1) {
        this.ajustarAltoPanelFinal(pasadasRestantes - 1);
      }
    });
  }

  mostrarResultadoFinal(
    nombreNivel: string,
    puntosBase: number,
    bonusTiempo: number,
    segundosTotales: number,
    onVolverMenu: () => void,
    cierre?: string
  ): void {
    // El cartel del último acierto no debe sobrevivir al cierre del nivel: su
    // temporizador seguía corriendo por debajo y quedaba flotando sobre el
    // panel de resultados, e incluso sobre el menú, ya fuera del nivel al que
    // pertenecía.
    this.ocultarFeedback();

    // Lluvia de estrellas sobre la escena, más larga que un acierto suelto:
    // terminar una fase tiene que sentirse distinto de clasificar un objeto.
    // Cae detrás del panel de resultados, así el fondo se mantiene vivo
    // mientras el jugador lee su puntaje.
    lluviaDeEstrellas(this.scene, puntoFrenteALaCamara(this.scene, 5));

    const total = puntosBase + bonusTiempo;
    this.textoTituloFinal.text = `${nombreNivel} completado`;
    this.textoStatsFinal.text =
      `Puntos por desempeño:  ${puntosBase}\n` +
      `Bonus por tiempo (${segundosTotales}s):  +${bonusTiempo}\n\n` +
      `Total:  ${total}` +
      (cierre ? `\n\n${cierre}` : "");

    this.fondoOverlay.isVisible = true;
    this.pantallaFinal.isVisible = true;
    this.ajustarAltoPanelFinal();

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
    onReintentar: () => void,
    /** Explicación de la pregunta de cierre. Mismo criterio que en
     *  mostrarResultadoFinal: adentro del panel, no como cartel flotante. */
    cierre?: string
  ): void {
    // Mismo motivo que en mostrarResultadoFinal.
    this.ocultarFeedback();

    const tasaPct = Math.round(tasaAcierto * 100);

    this.cabeceraFinal.background = aprobado ? "#2e7d46" : "#8a3a2e";
    this.textoTituloFinal.text = aprobado ? "Auditoría aprobada" : "Auditoría no aprobada";
    this.textoStatsFinal.text =
      `Aciertos de auditoría: ${tasaPct}%\n` +
      `Calificación real del área: ${promedioCalificacion.toFixed(1)}/5\n` +
      `Puntos ganados: ${puntosBase}  (${segundosTotales}s)\n\n` +
      (aprobado
        ? "Nivel 5 completado — certificado disponible en el menú."
        : "No alcanzaste el mínimo de aciertos para aprobar. Puedes reintentar la auditoría.") +
      (cierre ? `\n\n${cierre}` : "");

    this.fondoOverlay.isVisible = true;
    this.pantallaFinal.isVisible = true;
    this.ajustarAltoPanelFinal();

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