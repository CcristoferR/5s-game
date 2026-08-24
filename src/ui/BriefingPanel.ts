import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, Button, Control } from "@babylonjs/gui";
import type { BriefingNivel } from "../data/levelConfig";

const ANCHO_TARJETA = 660;
const ANCHO_CONTENIDO = 580;

/**
 * Pantalla de apertura de un nivel: plantea la situación y la decisión que el
 * jugador tiene que resolver, antes de dejarlo interactuar.
 *
 * Bloquea la escena mientras está abierta (el fondo intercepta los clics), así
 * que el nivel NO debe arrancar su cronómetro hasta que se llame a onComenzar.
 * Eso importa sobre todo en el Nivel 5, que es contra reloj: si el tiempo
 * corriera mientras el jugador lee, empezaría perdiendo.
 *
 * Todos los bloques de texto usan resizeToFit y se apilan en un StackPanel:
 * la altura la define el contenido, no un número fijo. Es a propósito — con
 * alturas fijas, cualquier texto un poco más largo que el previsto aparece
 * cortado, y estos textos van a seguir editándose.
 */
export function mostrarBriefingNivel(
  gui: AdvancedDynamicTexture,
  numeroNivel: number,
  datos: BriefingNivel,
  onComenzar: () => void
): void {
  const fondo = new Rectangle("fondoBriefing");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(6, 8, 10, 0.88)";
  fondo.isPointerBlocker = true;
  fondo.zIndex = 60;
  gui.addControl(fondo);

  const tarjeta = new Rectangle("tarjetaBriefing");
  tarjeta.width = ANCHO_TARJETA + "px";
  tarjeta.height = "500px";
  tarjeta.cornerRadius = 16;
  tarjeta.thickness = 1;
  tarjeta.color = "rgba(255,255,255,0.16)";
  tarjeta.background = "#14181c";
  fondo.addControl(tarjeta);

  // --- Cabecera: identifica la fase con su color ---
  const cabecera = new Rectangle("cabeceraBriefing");
  cabecera.width = ANCHO_TARJETA + "px";
  cabecera.height = "92px";
  cabecera.thickness = 0;
  cabecera.cornerRadius = 16;
  cabecera.background = datos.color;
  cabecera.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(cabecera);

  const antetitulo = new TextBlock("antetituloBriefing", `NIVEL ${numeroNivel}  ·  ${datos.fase.toUpperCase()}`);
  antetitulo.color = "rgba(0,0,0,0.6)";
  antetitulo.fontSize = 13;
  antetitulo.fontWeight = "600";
  antetitulo.height = "18px";
  antetitulo.top = "22px";
  antetitulo.isHitTestVisible = false;
  antetitulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(antetitulo);

  const titulo = new TextBlock("tituloBriefing", datos.traduccion);
  titulo.color = "#0d1013";
  titulo.fontSize = 32;
  titulo.fontWeight = "700";
  titulo.height = "40px";
  titulo.top = "44px";
  titulo.isHitTestVisible = false;
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(titulo);

  // --- Cuerpo ---
  const columna = new StackPanel("columnaBriefing");
  columna.isVertical = true;
  columna.width = ANCHO_CONTENIDO + "px";
  columna.top = "116px";
  columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(columna);

  columna.addControl(rotulo("rotuloContexto", "LA SITUACIÓN", "rgba(255,255,255,0.45)"));
  columna.addControl(parrafo("textoContexto", datos.contexto, "rgba(255,255,255,0.9)", 16));
  columna.addControl(espaciador("espacioBriefing", 22));
  columna.addControl(rotulo("rotuloPregunta", "TU DECISIÓN", datos.color));

  // La pregunta va más grande y con el color de la fase: es lo que el jugador
  // tiene que tener en la cabeza mientras juega, no un texto más.
  columna.addControl(parrafo("textoPregunta", datos.pregunta, "#ffffff", 20));

  const boton = Button.CreateSimpleButton("btnComenzarBriefing", "Comenzar");
  boton.width = "220px";
  boton.height = "48px";
  boton.color = "#0d1013";
  boton.fontSize = 16;
  boton.fontWeight = "600";
  boton.cornerRadius = 10;
  boton.thickness = 0;
  boton.background = datos.color;
  boton.top = "-26px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  tarjeta.addControl(boton);

  boton.onPointerUpObservable.add(() => {
    // Se oculta primero y se libera después: el dispose de un control mientras
    // Babylon está repartiendo el evento de clic puede cortar el resto del
    // manejador, y con él la llamada que arranca el nivel.
    fondo.isVisible = false;
    fondo.isPointerBlocker = false;
    setTimeout(() => {
      try {
        fondo.dispose();
      } catch {
        /* la escena ya se recreó y se llevó el control */
      }
    }, 0);
    onComenzar();
  });
}

function rotulo(nombre: string, texto: string, color: string): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = 12;
  bloque.fontWeight = "600";
  bloque.height = "22px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.isHitTestVisible = false;
  return bloque;
}

function parrafo(nombre: string, texto: string, color: string, tamano: number): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = tamano;
  bloque.textWrapping = true;
  // Con resizeToFit el alto lo calcula el propio texto: es la única forma de
  // garantizar que no quede ninguna línea recortada al editar los textos.
  bloque.resizeToFit = true;
  bloque.width = ANCHO_CONTENIDO + "px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.isHitTestVisible = false;
  return bloque;
}

function espaciador(nombre: string, alto: number): Rectangle {
  const hueco = new Rectangle(nombre);
  hueco.width = "1px";
  hueco.height = alto + "px";
  hueco.thickness = 0;
  hueco.background = "transparent";
  hueco.isHitTestVisible = false;
  return hueco;
}