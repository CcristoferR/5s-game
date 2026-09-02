import { AdvancedDynamicTexture, Rectangle, TextBlock, Button, Control, Container } from "@babylonjs/gui";
import { reproducir } from "../core/Sonido";

// ---------------------------------------------------------------------------
// Sistema visual del juego
// ---------------------------------------------------------------------------
//
// Un solo lugar donde viven los colores, los tamaños de letra y las piezas de
// interfaz que usan todos los niveles.
//
// POR QUÉ EXISTE. Antes cada panel se construía por su cuenta: había diez
// tamaños de letra distintos (12, 13, 14, 15, 16, 18, 19, 20, 22 y 24 px),
// cuatro fondos oscuros diferentes y botones de tres estilos. El resultado es
// que cada pantalla del juego parecía hecha por una persona distinta, aunque el
// contenido estuviera bien. Con esto, cambiar un color acá lo cambia en todo el
// juego, y una pantalla nueva nace alineada sin que haya que acordarse de nada.
//
// La referencia es la tarjeta de apertura de nivel, que es la pantalla que ya
// quedó bien: misma paleta, mismos rótulos en mayúscula chica, mismos radios.

export const PALETA = {
  /** Velo sobre la escena. Deja ver el garaje, apagado. */
  velo: "rgba(9, 11, 13, 0.76)",

  tarjeta: "#14171b",
  tarjetaSuave: "rgba(255,255,255,0.045)",
  borde: "rgba(255,255,255,0.10)",
  linea: "rgba(255,255,255,0.07)",

  titulo: "#f5f7f6",
  cuerpo: "rgba(224,230,228,0.78)",
  rotulo: "rgba(255,255,255,0.38)",
  tenue: "rgba(255,255,255,0.30)",

  acierto: "#7fb495",
  error: "#c98d80",
  aviso: "#bda079",
  dato: "#7ea3ba",

  accionFondo: "#eef0ef",
  accionFondoHover: "#ffffff",
  accionTexto: "#12151a",
};

/**
 * Colores de la interfaz en tema claro.
 *
 * Alcance: las pantallas que TAPAN la escena por completo —menú, ranking,
 * certificado—. Los paneles que se abren durante un nivel siguen sobre el
 * garaje, así que ahí el velo oscuro sigue siendo el correcto: aclararlo
 * dejaría el texto ilegible sobre la geometría del galpón.
 *
 * No es el tema oscuro invertido. Los colores de estado se oscurecen: los
 * mismos verdes y rojos suaves que se leen bien sobre negro quedan lavados
 * sobre blanco y dejan de distinguirse entre sí.
 */
const PALETA_CLARA: typeof PALETA = {
  velo: "rgba(238, 241, 244, 0.82)",

  tarjeta: "#ffffff",
  tarjetaSuave: "rgba(18,26,33,0.04)",
  borde: "rgba(18,26,33,0.14)",
  linea: "rgba(18,26,33,0.09)",

  titulo: "#14191e",
  cuerpo: "rgba(30,38,45,0.82)",
  rotulo: "rgba(30,38,45,0.5)",
  tenue: "rgba(30,38,45,0.38)",

  acierto: "#2f7d55",
  error: "#a8412f",
  aviso: "#8a6415",
  dato: "#2c5f7d",

  accionFondo: "#1c242b",
  accionFondoHover: "#2a343d",
  accionTexto: "#f4f7f8",
};

const PALETA_OSCURA: typeof PALETA = { ...PALETA };

/**
 * Cambia la paleta de la interfaz del juego.
 *
 * Sobrescribe las propiedades del objeto en lugar de reemplazarlo: los ocho
 * archivos que lo usan lo importan por referencia, y cambiar la referencia acá
 * los dejaría leyendo el objeto viejo para siempre.
 *
 * Los colores se leen al construir cada pantalla, así que basta con llamar a
 * esto antes de abrirla. Las que ya estén en pantalla no cambian solas — y no
 * hace falta que lo hagan: el tema se cambia desde Mi cuenta, con el juego
 * cerrado.
 */
export function aplicarTemaUI(tema: "oscuro" | "claro"): void {
  Object.assign(PALETA, tema === "claro" ? PALETA_CLARA : PALETA_OSCURA);
}



/**
 * Escala tipográfica.
 *
 * Seis tamaños y ninguno más. Todos subieron respecto de lo que había: el
 * cuerpo de texto pasó de 14-15 px a 18, que es el mínimo cómodo para leer una
 * consigna a la distancia normal de una pantalla, sobre todo en una
 * capacitación que se proyecta o se ve en un monitor compartido.
 */
export const TEXTO = {
  /** Rótulos en mayúscula chica: "LA SITUACIÓN", "PASO 1 DE 2". */
  rotulo: 13,
  /** Datos secundarios: fechas, contadores, notas al pie. */
  menor: 16,
  /** Cuerpo de texto por defecto. */
  cuerpo: 18,
  /** Texto destacado: preguntas, opciones, respuestas. */
  destacado: 21,
  /** Título de panel. */
  titulo: 27,
  /** Título grande: resultados, certificados. */
  mayor: 34,
};

export const RADIO = 12;
export const MARGEN = 40;

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/**
 * Capa que oscurece la escena y bloquea los clics.
 *
 * Todo panel que exija una decisión del jugador va sobre un velo: si la escena
 * de atrás sigue viva y clicable, el jugador puede seguir jugando por debajo de
 * la pregunta y el juego pierde el hilo.
 */
export function crearVelo(gui: AdvancedDynamicTexture, nombre = "velo"): Rectangle {
  const velo = new Rectangle(nombre);
  velo.width = "100%";
  velo.height = "100%";
  velo.thickness = 0;
  velo.background = PALETA.velo;
  velo.isPointerBlocker = true;
  velo.zIndex = 40;
  gui.addControl(velo);
  return velo;
}

/** Tarjeta oscura, la superficie sobre la que se apoya todo el contenido. */
export function crearTarjeta(padre: Container, nombre: string, ancho: number, alto: number): Rectangle {
  const tarjeta = new Rectangle(nombre);
  tarjeta.width = ancho + "px";
  tarjeta.height = alto + "px";
  tarjeta.cornerRadius = RADIO;
  tarjeta.thickness = 1;
  tarjeta.color = PALETA.borde;
  tarjeta.background = PALETA.tarjeta;
  padre.addControl(tarjeta);
  return tarjeta;
}

/** Filete de color sobre el borde superior de una tarjeta. */
export function crearFilete(tarjeta: Rectangle, nombre: string, ancho: number, color: string): Rectangle {
  const filete = new Rectangle(nombre);
  filete.width = ancho + "px";
  filete.height = "3px";
  filete.thickness = 0;
  filete.background = color;
  filete.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  filete.isHitTestVisible = false;
  tarjeta.addControl(filete);
  return filete;
}

/** Rótulo en mayúscula chica. Nombra la sección, no la explica. */
export function crearRotulo(nombre: string, texto: string, color = PALETA.rotulo): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = TEXTO.rotulo;
  bloque.fontWeight = "600";
  bloque.height = "18px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.isHitTestVisible = false;
  return bloque;
}

/**
 * Párrafo de texto.
 *
 * Siempre con resizeToFit: el alto lo define el texto, no un número fijo. Es lo
 * único que garantiza que no quede una línea recortada cuando alguien edite un
 * texto y lo haga más largo — que fue exactamente el problema que tuvieron los
 * carteles y el globo del operario del Nivel 4.
 */
export function crearParrafo(
  nombre: string,
  texto: string,
  ancho: number,
  tamano: number = TEXTO.cuerpo,
  color: string = PALETA.cuerpo,
  peso = "400"
): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = tamano;
  bloque.fontWeight = peso;
  bloque.textWrapping = true;
  bloque.resizeToFit = true;
  bloque.width = ancho + "px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.isHitTestVisible = false;
  return bloque;
}

/** Separación vertical dentro de una columna. */
export function crearEspacio(nombre: string, alto: number): Rectangle {
  const hueco = new Rectangle(nombre);
  hueco.width = "1px";
  hueco.height = alto + "px";
  hueco.thickness = 0;
  hueco.background = "transparent";
  hueco.isHitTestVisible = false;
  return hueco;
}

/** Línea divisoria de 1 px. */
export function crearDivisor(nombre: string, ancho: number): Rectangle {
  const linea = new Rectangle(nombre);
  linea.width = ancho + "px";
  linea.height = "1px";
  linea.thickness = 0;
  linea.background = PALETA.linea;
  linea.isHitTestVisible = false;
  return linea;
}

/**
 * Botón de acción principal: relleno claro, texto oscuro.
 *
 * Va uno solo por pantalla. Es lo que el jugador tiene que apretar para seguir,
 * y por eso es la única superficie clara de toda la interfaz.
 */
export function crearBotonPrincipal(nombre: string, texto: string, ancho = 160): Button {
  const boton = Button.CreateSimpleButton(nombre, texto);
  boton.width = ancho + "px";
  boton.height = "44px";
  boton.fontSize = TEXTO.menor;
  boton.fontWeight = "600";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = PALETA.accionFondo;
  boton.color = PALETA.accionTexto;
  boton.hoverCursor = "pointer";
  neutralizarAnimaciones(boton);

  if (boton.textBlock) {
    boton.textBlock.color = PALETA.accionTexto;
    boton.textBlock.isHitTestVisible = false;
  }
  boton.onPointerEnterObservable.add(() => (boton.background = PALETA.accionFondoHover));
  boton.onPointerOutObservable.add(() => (boton.background = PALETA.accionFondo));

  // El clic suena desde acá: cualquier botón construido con el sistema de
  // diseño queda cubierto, sin tener que tocar pantalla por pantalla.
  boton.onPointerUpObservable.add(() => reproducir("boton"));

  return boton;
}

/**
 * Botón de opción: una alternativa entre varias.
 *
 * A diferencia del principal va sin relleno, porque cuando hay tres opciones
 * ninguna debe verse como "la correcta" antes de que el jugador decida.
 */
export function crearBotonOpcion(nombre: string, texto: string, ancho: number): Button {
  const boton = Button.CreateSimpleButton(nombre, texto);
  boton.width = ancho + "px";
  boton.height = "56px";
  boton.fontSize = TEXTO.destacado;
  boton.cornerRadius = 10;
  boton.thickness = 1;
  boton.color = PALETA.borde;
  boton.background = PALETA.tarjetaSuave;
  boton.hoverCursor = "pointer";
  neutralizarAnimaciones(boton);

  if (boton.textBlock) {
    boton.textBlock.color = PALETA.titulo;
    boton.textBlock.textWrapping = true;
    boton.textBlock.paddingLeft = "18px";
    boton.textBlock.paddingRight = "18px";
    boton.textBlock.isHitTestVisible = false;
  }

  boton.onPointerEnterObservable.add(() => {
    boton.background = "rgba(255,255,255,0.10)";
    boton.color = "rgba(255,255,255,0.28)";
  });
  boton.onPointerOutObservable.add(() => {
    boton.background = PALETA.tarjetaSuave;
    boton.color = PALETA.borde;
  });

  // El clic suena desde acá: cualquier botón construido con el sistema de
  // diseño queda cubierto, sin tener que tocar pantalla por pantalla.
  boton.onPointerUpObservable.add(() => reproducir("boton"));

  return boton;
}

/**
 * Anula las animaciones de fábrica de Button.
 *
 * Por defecto baja la opacidad al pasar el mouse y encoge el control al hacer
 * clic. Ambas pelean con los fundidos propios de los paneles y con los estados
 * de hover definidos acá.
 */
export function neutralizarAnimaciones(boton: Button): void {
  boton.pointerEnterAnimation = () => {};
  boton.pointerOutAnimation = () => {};
  boton.pointerDownAnimation = () => {};
  boton.pointerUpAnimation = () => {};
}

/**
 * Fundido de opacidad sobre un control.
 *
 * Con requestAnimationFrame y no con el observable de la escena: así no depende
 * de que el nivel esté renderizando ni deja observadores colgando si la escena
 * se destruye a mitad de la animación.
 */
export function desvanecer(
  control: Control,
  desde: number,
  hasta: number,
  duracionMs: number,
  alTerminar?: () => void
): void {
  control.alpha = desde;
  const inicio = performance.now();

  const paso = (): void => {
    const avance = Math.min(1, (performance.now() - inicio) / duracionMs);
    const suave = avance < 0.5 ? 2 * avance * avance : 1 - Math.pow(-2 * avance + 2, 2) / 2;
    control.alpha = desde + (hasta - desde) * suave;

    if (avance < 1) {
      requestAnimationFrame(paso);
    } else {
      // Se fuerza el valor final: si el navegador saltea el último cuadro, el
      // control quedaría a media opacidad para siempre.
      control.alpha = hasta;
      if (alTerminar) alTerminar();
    }
  };

  requestAnimationFrame(paso);
}