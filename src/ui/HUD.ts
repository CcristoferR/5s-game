import { Scene, Vector3 } from "@babylonjs/core";
import { reproducir } from "../core/Sonido";
import { briefingsNiveles } from "../data/levelConfig";
import { chispasDeAcierto, humoDeError, lluviaDeEstrellas, puntoFrenteALaCamara } from "../entities/Particulas";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, StackPanel, Button } from "@babylonjs/gui";
import { TEXTO, PALETA, desvanecer, afinarGui } from "./EstiloUI";

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
  private textoFase: TextBlock;
  private textoObjetivo: TextBlock;
  private textoProgreso: TextBlock;
  private textoMetrica: TextBlock;
  private franjaFase: Rectangle;
  private filaProgreso: Rectangle;
  private barraProgreso: Rectangle;

  /** Total de la tarea. Cero mientras el nivel no informe uno. */
  private totalTarea = 0;
  /** Segundos de referencia para el color del tiempo. */
  private tiempoReferencia = 0;
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
    // Resolución de la capa según la pantalla: sin esto el texto sale blando

    // en monitores con escala de Windows. Ver afinarGui en EstiloUI.

    afinarGui(this.gui);

    // --- Marcador: ahora con tarjeta real detrás, no texto flotando solo ---
    // ===================================================================
    // PANEL DE FASE
    // ===================================================================
    //
    // Antes eran dos líneas de texto —"Puntaje 0" y "Restante 34s"— en una
    // caja gris. Cumplía, pero no decía nada de lo único que importa mientras
    // se juega: QUÉ hay que hacer y CUÁNTO falta. Esa información existía en
    // el juego pero vivía en el panel de apertura, que se cierra antes de
    // empezar, así que a mitad de nivel no había dónde consultarla.
    //
    // El panel se arma de arriba abajo por orden de urgencia:
    //   1. Qué fase es      — insignia con número y término japonés
    //   2. Qué hay que hacer — el objetivo, en una línea
    //   3. Cuánto llevo      — barra de progreso con la cuenta
    //   4. Cuánto queda      — barra de tiempo
    //   5. Cuánto sumo       — el puntaje, que es consecuencia y no meta
    //
    // Nada de esto cambia una sola mecánica: son datos que el juego ya tenía.
    const marcador = new Rectangle("marcador");
    marcador.width = "268px";
    marcador.adaptHeightToChildren = true;
    marcador.cornerRadius = 14;
    marcador.thickness = 1;
    marcador.color = PALETA.borde;
    marcador.background = "rgba(16, 19, 23, 0.88)";
    marcador.top = "16px";
    marcador.left = "16px";
    marcador.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marcador.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    marcador.isPointerBlocker = false;
    this.gui.addControl(marcador);

    const panelMarcador = new StackPanel("panelMarcador");
    panelMarcador.isVertical = true;
    panelMarcador.width = "236px";
    panelMarcador.paddingTop = "16px";
    panelMarcador.paddingBottom = "16px";
    marcador.addControl(panelMarcador);

    // --- 1. Insignia de fase ---
    const cabecera = new Rectangle("cabeceraFase");
    cabecera.width = "236px";
    cabecera.height = "34px";
    cabecera.thickness = 0;
    cabecera.background = "transparent";
    panelMarcador.addControl(cabecera);

    // Franja de color de la fase. Es el único elemento que cambia de color
    // entre niveles, y por eso identifica la fase de un vistazo aunque no se
    // lea el texto.
    this.franjaFase = new Rectangle("franjaFase");
    this.franjaFase.width = "4px";
    this.franjaFase.height = "26px";
    this.franjaFase.thickness = 0;
    this.franjaFase.background = PALETA.acierto;
    this.franjaFase.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.franjaFase.isHitTestVisible = false;
    cabecera.addControl(this.franjaFase);

    this.textoFase = new TextBlock("textoFase", "");
    this.textoFase.color = PALETA.titulo;
    this.textoFase.fontSize = TEXTO.menor;
    this.textoFase.fontWeight = "700";
    this.textoFase.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoFase.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoFase.left = "16px";
    this.textoFase.isHitTestVisible = false;
    cabecera.addControl(this.textoFase);

    // --- 2. Objetivo ---
    this.textoObjetivo = new TextBlock("textoObjetivo", "");
    this.textoObjetivo.color = PALETA.cuerpo;
    this.textoObjetivo.fontSize = TEXTO.rotulo;
    this.textoObjetivo.textWrapping = true;
    this.textoObjetivo.resizeToFit = true;
    this.textoObjetivo.width = "220px";
    this.textoObjetivo.paddingLeft = "16px";
    this.textoObjetivo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoObjetivo.isHitTestVisible = false;
    panelMarcador.addControl(this.textoObjetivo);

    // --- 3. Progreso de la tarea ---
    //
    // La fila es un rectángulo de alto FIJO, no un StackPanel con márgenes.
    //
    // La versión anterior apilaba el rótulo y el carril dentro de un
    // StackPanel usando paddingTop para separarlos, y ahí está el problema:
    // el StackPanel mide a sus hijos por su alto y no cuenta ese relleno, así
    // que los carriles quedaban desplazados fuera de su fila. Eso era la banda
    // gris suelta que aparecía debajo de "Tiempo" sin pertenecer a nada.
    //
    // Con alto fijo y posiciones absolutas dentro, cada pieza queda donde se
    // la pone y no depende de cómo mida el contenedor.
    this.filaProgreso = new Rectangle("filaProgreso");
    this.filaProgreso.width = "236px";
    this.filaProgreso.height = "44px";
    this.filaProgreso.thickness = 0;
    this.filaProgreso.background = "transparent";
    this.filaProgreso.isVisible = false;
    this.filaProgreso.isHitTestVisible = false;
    panelMarcador.addControl(this.filaProgreso);

    this.textoProgreso = new TextBlock("textoProgreso", "");
    this.textoProgreso.color = PALETA.rotulo;
    this.textoProgreso.fontSize = TEXTO.rotulo;
    this.textoProgreso.fontWeight = "600";
    this.textoProgreso.height = "18px";
    this.textoProgreso.left = "16px";
    this.textoProgreso.top = "2px";
    this.textoProgreso.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoProgreso.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.textoProgreso.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoProgreso.isHitTestVisible = false;
    this.filaProgreso.addControl(this.textoProgreso);

    const carrilProgreso = new Rectangle("carrilProgreso");
    carrilProgreso.width = "204px";
    carrilProgreso.height = "8px";
    carrilProgreso.cornerRadius = 4;
    carrilProgreso.thickness = 0;
    carrilProgreso.background = "rgba(255,255,255,0.10)";
    carrilProgreso.left = "16px";
    carrilProgreso.top = "-4px";
    carrilProgreso.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    carrilProgreso.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    carrilProgreso.isHitTestVisible = false;
    this.filaProgreso.addControl(carrilProgreso);

    this.barraProgreso = new Rectangle("barraProgreso");
    this.barraProgreso.width = "0px";
    this.barraProgreso.height = "8px";
    this.barraProgreso.cornerRadius = 4;
    this.barraProgreso.thickness = 0;
    this.barraProgreso.background = PALETA.acierto;
    this.barraProgreso.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.barraProgreso.isHitTestVisible = false;
    carrilProgreso.addControl(this.barraProgreso);

    // --- Indicador del nivel ---
    //
    // Oculto salvo que el nivel informe uno. La mayoría no tiene KPI propio y
    // una línea vacía dejaría un hueco sin explicación en el panel.
    this.textoMetrica = new TextBlock("metricaNivel", "");
    this.textoMetrica.color = PALETA.dato;
    this.textoMetrica.fontSize = TEXTO.rotulo;
    this.textoMetrica.fontWeight = "600";
    this.textoMetrica.height = "24px";
    this.textoMetrica.paddingLeft = "16px";
    this.textoMetrica.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoMetrica.isVisible = false;
    this.textoMetrica.isHitTestVisible = false;
    panelMarcador.addControl(this.textoMetrica);

    // --- 4. Tiempo ---
    //
    // SIN BARRA, en ningún nivel.
    //
    // En los niveles 1 a 4 el reloj cuenta hacia arriba y no tiene límite, así
    // que no hay contra qué llenar nada. En el 5 sí hay cuenta atrás, pero una
    // sola barra que a veces significa algo y a veces no enseña a ignorarla.
    //
    // La urgencia la comunica el propio número cambiando de color, que ocupa
    // cero espacio extra y se ve igual de reojo.
    this.textoTiempo = new TextBlock("tiempo", "Tiempo  0s");
    this.textoTiempo.color = PALETA.rotulo;
    this.textoTiempo.fontSize = TEXTO.menor;
    this.textoTiempo.fontWeight = "600";
    this.textoTiempo.height = "24px";
    this.textoTiempo.paddingLeft = "16px";
    this.textoTiempo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoTiempo.isHitTestVisible = false;
    panelMarcador.addControl(this.textoTiempo);

    // --- 5. Puntaje ---
    //
    // Abajo y no arriba: el puntaje es consecuencia de hacer bien la tarea, no
    // el objetivo. Arriba del todo empujaba a jugar mirando el número.
    // Sin línea divisoria entre el tiempo y el puntaje.
    //
    // Estaban separados por una línea con aire arriba y abajo, y no separaba
    // nada: son dos datos del mismo bloque, no dos secciones. Quitarla acorta
    // el panel y deja el conjunto más limpio, que es lo que se busca en algo
    // que está en pantalla todo el rato.

    this.textoPuntaje = new TextBlock("puntaje", "0 pts");
    this.textoPuntaje.color = PALETA.titulo;
    this.textoPuntaje.fontSize = TEXTO.destacado;
    this.textoPuntaje.fontWeight = "700";
    this.textoPuntaje.height = "36px";
    this.textoPuntaje.paddingLeft = "16px";
    this.textoPuntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textoPuntaje.isHitTestVisible = false;
    panelMarcador.addControl(this.textoPuntaje);

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

  /**
   * Fija la fase que se está jugando.
   *
   * Los textos salen de briefingsNiveles: el mismo término japonés, la misma
   * traducción y el mismo color que muestra el panel de apertura y la pantalla
   * de carga. Nada duplicado — si algún día se corrige un texto, cambia en los
   * tres sitios a la vez.
   *
   * Hace falta porque el panel de apertura se cierra antes de empezar: a mitad
   * de nivel no había forma de recordar en qué S se estaba.
   */
  definirFase(numeroNivel: number): void {
    const briefing = briefingsNiveles[numeroNivel];

    if (!briefing) {
      this.textoFase.text = "TUTORIAL";
      this.textoObjetivo.text = "Aprende a mirar, tomar y soltar.";
      return;
    }

    this.textoFase.text = `${String(numeroNivel).padStart(2, "0")}  ${briefing.fase.toUpperCase()}`;
    this.textoObjetivo.text = briefing.traduccion;
    this.franjaFase.background = briefing.color;
    this.barraProgreso.background = briefing.color;
  }

  /**
   * Sustituye el objetivo por uno propio del nivel.
   *
   * La traducción de la S sirve de objetivo por defecto —"Clasificar",
   * "Ordenar"— pero un nivel puede querer decir algo más concreto.
   */
  definirObjetivo(texto: string): void {
    this.textoObjetivo.text = texto;
  }

  /**
   * Enciende la barra de progreso de la tarea.
   *
   * Mientras un nivel no llame a esto, la fila queda oculta: una barra que
   * nunca avanza confunde más que la ausencia de barra.
   */
  definirTotalTarea(total: number): void {
    this.totalTarea = Math.max(0, total);
    this.filaProgreso.isVisible = this.totalTarea > 0;
    this.actualizarProgreso(0);
  }

  actualizarProgreso(hechos: number): void {
    if (this.totalTarea <= 0) return;

    const hechosAcotados = Math.min(hechos, this.totalTarea);
    this.textoProgreso.text = `${hechosAcotados} de ${this.totalTarea}`;
    this.barraProgreso.width = Math.round((hechosAcotados / this.totalTarea) * 204) + "px";
  }

  /**
   * Indicador propio del nivel, bajo el progreso.
   *
   * Existe para el contador de metros cuadrados del Nivel 1, que estaba
   * escrito en el centro de la pantalla: cruzaba las cajas y la estantería,
   * rompía la inmersión y encima habría salido en la Fotografía Cero. Un KPI
   * es un dato del tablero, no un letrero colgado en medio del taller.
   */
  definirMetrica(texto: string): void {
    this.textoMetrica.text = texto;
    this.textoMetrica.isVisible = texto.length > 0;
  }

  actualizarPuntaje(puntaje: number): void {
    this.textoPuntaje.text = `${puntaje} pts`;
  }

  /**
   * Tiempo transcurrido.
   *
   * Sin límite que mostrar, la barra se llena sobre una referencia de dos
   * minutos: no es una cuenta atrás, es una noción de cuánto se lleva. Se
   * queda llena al pasarse, sin desbordar.
   */
  /**
   * Tiempo transcurrido, SIN barra.
   *
   * La primera versión dibujaba una barra contra una referencia inventada de
   * dos minutos. No medía nada: en estos niveles el reloj no tiene límite, así
   * que la barra no podía llenarse ni vaciarse por ningún motivo real. Una
   * barra que no representa nada ocupa sitio y le quita crédito a las que sí
   * significan algo.
   */
  actualizarTiempo(segundos: number): void {
    this.textoTiempo.text = `Tiempo  ${segundos}s`;
  }

  /**
   * Tiempo restante, para los niveles con reloj en contra.
   *
   * La barra se vacía y cambia de color en dos umbrales. El color hace el
   * trabajo que el número no puede: a mitad de una tarea nadie está leyendo
   * cifras, pero un borde que se pone ámbar se ve por el rabillo del ojo.
   */
  /**
   * Tiempo restante, para los niveles con reloj en contra.
   *
   * El aviso lo da el NÚMERO cambiando de color: ámbar bajo el 40 % y rojo
   * bajo el 15 %. Se ve de reojo igual que una barra, no ocupa una fila extra
   * y no deja nada gris en pantalla cuando no hay nada que avisar.
   */
  actualizarTiempoRestante(segundos: number): void {
    this.textoTiempo.text = `Restante  ${segundos}s`;

    // La primera lectura fija la referencia: así funciona con el límite que
    // tenga cada nivel, sin informárselo aparte.
    if (this.tiempoReferencia <= 0) this.tiempoReferencia = Math.max(1, segundos);

    const proporcion = Math.max(0, Math.min(1, segundos / this.tiempoReferencia));
    this.textoTiempo.color =
      proporcion <= 0.15 ? PALETA.error : proporcion <= 0.4 ? PALETA.aviso : PALETA.rotulo;
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
    cierre?: string,
    /**
     * Paso opcional ANTES de volver al menú.
     *
     * Lo usa el Nivel 4 para abrir el panel de mejora: el jugador primero ve
     * su resultado y, al continuar, ve el área entera transformada. Si se
     * mostraran a la vez competirían entre sí y no se leería ninguno de los
     * dos; encadenados, cada uno tiene su momento.
     */
    antesDeVolver?: () => void | Promise<void>
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

      if (!antesDeVolver) {
        onVolverMenu();
        return;
      }

      // La escena NO se destruye hasta que el paso intermedio termine: el
      // panel de mejora necesita fotografiar el galpón, y no se puede
      // fotografiar algo que ya se liberó.
      void Promise.resolve(antesDeVolver()).finally(() => onVolverMenu());
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