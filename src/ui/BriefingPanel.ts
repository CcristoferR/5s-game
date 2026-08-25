import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, Button, Control } from "@babylonjs/gui";
import type { BriefingNivel, MicroLeccionNivel } from "../data/levelConfig";
import { TEXTO } from "./EstiloUI";

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

const ANCHO_TARJETA = 660;
const ALTO_TARJETA = 512;
const MARGEN = 46;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;
const ALTO_ENCABEZADO = 122;
const ALTO_PIE = 78;

const C = {
  // Velo sobre la escena: la deja ver, apagada. La tarjeta va opaca encima, así
  // que el texto nunca se mezcla con el garaje aunque el fondo sea traslúcido.
  velo: "rgba(9, 11, 13, 0.76)",

  tarjeta: "#14171b",
  borde: "rgba(255,255,255,0.10)",
  linea: "rgba(255,255,255,0.07)",

  titulo: "#f5f7f6",
  cuerpo: "rgba(224,230,228,0.76)",
  rotulo: "rgba(255,255,255,0.38)",
  paso: "rgba(255,255,255,0.30)",
};

interface PasoApertura {
  rotulo: string;
  titulo?: string;
  cuerpo: string;
  rotuloDestacado?: string;
  cuerpoDestacado?: string;
}

/**
 * Secuencia de apertura de un nivel: la situación y la decisión a resolver, y
 * después el concepto de 5S que el nivel pone en juego. Al terminar llama a
 * onComenzar.
 *
 * Dos decisiones técnicas que conviene no revertir sin entenderlas:
 *
 * 1. CAPA PROPIA, SIN POST-PROCESO. La capa del HUD recibe el bloom y el tone
 *    mapping de la escena. Aplicados sobre una tarjeta oscura, le suben los
 *    negros: los colores salen grises y lavados y el panel parece transparente
 *    aunque sea opaco. Con capa propia y applyPostProcess desactivado, los
 *    colores salen exactamente como se definen. El menú principal hace lo mismo.
 *
 * 2. SIN idealWidth NI idealHeight EN ESTA CAPA. Los párrafos usan resizeToFit
 *    para que su altura la defina el texto y ninguna línea quede cortada. Pero
 *    resizeToFit activa internamente ignoreAdaptiveScaling: el ancho del texto
 *    deja de escalarse con el ideal mientras la tarjeta que lo contiene sí se
 *    escala. Los dos anchos dejan de coincidir, el texto se desborda de la
 *    tarjeta y se recorta por los costados. Sin escalado adaptativo ambos
 *    trabajan en píxeles reales y siempre coinciden.
 *
 * El nivel NO debe arrancar su cronómetro hasta que se llame a onComenzar: el
 * velo bloquea los clics mientras la secuencia está abierta.
 */
export function mostrarAperturaNivel(
  scene: Scene,
  numeroNivel: number,
  briefing: BriefingNivel,
  microLeccion: MicroLeccionNivel | null,
  onComenzar: () => void
): void {
  const pasos: PasoApertura[] = [
    {
      rotulo: "LA SITUACIÓN",
      cuerpo: briefing.contexto,
      rotuloDestacado: "TU DECISIÓN",
      cuerpoDestacado: briefing.pregunta,
    },
  ];

  if (microLeccion) {
    pasos.push({
      rotulo: "EL CONCEPTO",
      titulo: microLeccion.titulo,
      cuerpo: microLeccion.texto,
    });
  }

  const gui = AdvancedDynamicTexture.CreateFullscreenUI("aperturaUI", true, scene);
  if (gui.layer) {
    gui.layer.applyPostProcess = false;
  }

  const velo = new Rectangle("veloApertura");
  velo.width = "100%";
  velo.height = "100%";
  velo.thickness = 0;
  velo.background = C.velo;
  velo.isPointerBlocker = true;
  gui.addControl(velo);

  const tarjeta = new Rectangle("tarjetaApertura");
  tarjeta.width = ANCHO_TARJETA + "px";
  tarjeta.height = ALTO_TARJETA + "px";
  tarjeta.cornerRadius = 14;
  tarjeta.thickness = 1;
  tarjeta.color = C.borde;
  tarjeta.background = C.tarjeta;
  velo.addControl(tarjeta);

  // Filete superior a todo el ancho con el color de la fase: la única
  // superficie de color de la tarjeta. Da identidad sin teñir el contenido.
  const filete = new Rectangle("fileteFase");
  filete.width = ANCHO_TARJETA + "px";
  filete.height = "3px";
  filete.thickness = 0;
  filete.background = briefing.color;
  filete.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  filete.isHitTestVisible = false;
  tarjeta.addControl(filete);

  tarjeta.addControl(
    etiqueta("antetituloApertura", `NIVEL ${numeroNivel}   ·   ${briefing.fase.toUpperCase()}`, C.rotulo, 11, "600", 44)
  );

  const titulo = new TextBlock("tituloApertura", briefing.traduccion);
  titulo.color = C.titulo;
  titulo.fontSize = TEXTO.titulo;
  titulo.fontWeight = "600";
  titulo.width = ANCHO_CONTENIDO + "px";
  titulo.height = "40px";
  titulo.left = MARGEN + "px";
  titulo.top = "66px";
  titulo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  titulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  titulo.isHitTestVisible = false;
  tarjeta.addControl(titulo);

  tarjeta.addControl(divisor("divisorEncabezado", ALTO_ENCABEZADO, Control.VERTICAL_ALIGNMENT_TOP));

  const cuerpo = new Rectangle("cuerpoApertura");
  cuerpo.width = ANCHO_CONTENIDO + "px";
  cuerpo.height = ALTO_TARJETA - ALTO_ENCABEZADO - ALTO_PIE + "px";
  cuerpo.thickness = 0;
  cuerpo.background = "transparent";
  cuerpo.left = MARGEN + "px";
  cuerpo.top = ALTO_ENCABEZADO + "px";
  cuerpo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  cuerpo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(cuerpo);

  tarjeta.addControl(divisor("divisorPie", ALTO_PIE, Control.VERTICAL_ALIGNMENT_BOTTOM));

  const indicadorPaso = new TextBlock("indicadorPasoApertura", "");
  indicadorPaso.color = C.paso;
  indicadorPaso.fontSize = TEXTO.rotulo;
  indicadorPaso.fontWeight = "600";
  indicadorPaso.width = "120px";
  indicadorPaso.height = "16px";
  indicadorPaso.left = MARGEN + "px";
  indicadorPaso.top = "-31px";
  indicadorPaso.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  indicadorPaso.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  indicadorPaso.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  indicadorPaso.isHitTestVisible = false;
  indicadorPaso.isVisible = pasos.length > 1;
  tarjeta.addControl(indicadorPaso);

  const boton = Button.CreateSimpleButton("btnAvanzarApertura", "");
  boton.width = "152px";
  boton.height = "42px";
  boton.fontSize = TEXTO.menor;
  boton.fontWeight = "600";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = "#eef0ef";
  boton.color = "#12151a";
  boton.left = -MARGEN + "px";
  boton.top = "-18px";
  boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.hoverCursor = "pointer";
  boton.pointerEnterAnimation = () => {};
  boton.pointerOutAnimation = () => {};
  boton.pointerDownAnimation = () => {};
  boton.pointerUpAnimation = () => {};
  if (boton.textBlock) {
    boton.textBlock.color = "#12151a";
    boton.textBlock.isHitTestVisible = false;
  }
  boton.onPointerEnterObservable.add(() => {
    boton.background = "#ffffff";
  });
  boton.onPointerOutObservable.add(() => {
    boton.background = "#eef0ef";
  });
  tarjeta.addControl(boton);

  let indiceActual = 0;
  let enTransicion = false;

  function dibujarPaso(indice: number): void {
    cuerpo.clearControls();

    const paso = pasos[indice];
    const columna = new StackPanel(`columnaPaso_${indice}`);
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    cuerpo.addControl(columna);

    columna.addControl(espaciador(`aireSup_${indice}`, 26));
    columna.addControl(rotulo(`rotulo_${indice}`, paso.rotulo));

    if (paso.titulo) {
      columna.addControl(espaciador(`aireTitulo_${indice}`, 12));
      columna.addControl(parrafo(`titulo_${indice}`, paso.titulo, C.titulo, TEXTO.destacado, "600"));
    }

    columna.addControl(espaciador(`aireCuerpo_${indice}`, 12));
    columna.addControl(parrafo(`cuerpo_${indice}`, paso.cuerpo, C.cuerpo, TEXTO.cuerpo));

    if (paso.cuerpoDestacado) {
      columna.addControl(espaciador(`aireDest_${indice}`, 30));
      columna.addControl(rotulo(`rotuloDest_${indice}`, paso.rotuloDestacado ?? ""));
      columna.addControl(espaciador(`aireDest2_${indice}`, 10));
      columna.addControl(parrafo(`dest_${indice}`, paso.cuerpoDestacado, C.titulo, TEXTO.destacado, "500"));
    }

    indicadorPaso.text = `${indice + 1} / ${pasos.length}`;
    if (boton.textBlock) {
      boton.textBlock.text = indice === pasos.length - 1 ? "Comenzar" : "Continuar";
    }
  }

  boton.onPointerUpObservable.add(() => {
    if (enTransicion) return;

    if (indiceActual < pasos.length - 1) {
      // Solo se funde el contenido: el velo, el encabezado y el pie quedan
      // quietos. Se lee como una misma ficha que avanza, no como dos ventanas.
      enTransicion = true;
      desvanecer(cuerpo, 1, 0, 110, () => {
        indiceActual++;
        dibujarPaso(indiceActual);
        desvanecer(cuerpo, 0, 1, 150, () => {
          enTransicion = false;
        });
      });
      return;
    }

    enTransicion = true;
    velo.isPointerBlocker = false;
    velo.isVisible = false;
    // El dispose va diferido: liberar controles mientras Babylon reparte el
    // evento de clic corta el resto del manejador, y con él el arranque del nivel.
    setTimeout(() => {
      try {
        gui.dispose();
      } catch {
        /* la escena ya se recreó y se llevó la capa */
      }
    }, 0);

    onComenzar();
  });

  dibujarPaso(0);
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function etiqueta(
  nombre: string,
  texto: string,
  color: string,
  tamano: number,
  peso: string,
  desdeArriba: number
): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = tamano;
  bloque.fontWeight = peso;
  bloque.width = ANCHO_CONTENIDO + "px";
  bloque.height = "16px";
  bloque.left = MARGEN + "px";
  bloque.top = desdeArriba + "px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  bloque.isHitTestVisible = false;
  return bloque;
}

/** Línea divisoria de 1 px, alineada al mismo margen que el resto. */
function divisor(nombre: string, desplazamiento: number, anclaje: number): Rectangle {
  const linea = new Rectangle(nombre);
  linea.width = ANCHO_CONTENIDO + "px";
  linea.height = "1px";
  linea.thickness = 0;
  linea.background = C.linea;
  linea.left = MARGEN + "px";
  linea.top = (anclaje === Control.VERTICAL_ALIGNMENT_BOTTOM ? -desplazamiento : desplazamiento) + "px";
  linea.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  linea.verticalAlignment = anclaje;
  linea.isHitTestVisible = false;
  return linea;
}

/**
 * Fundido de opacidad sobre un control.
 *
 * Va con requestAnimationFrame y no con el observable de la escena a propósito:
 * así no depende de que el nivel esté renderizando ni deja observadores
 * colgando si la escena se destruye a mitad de la animación.
 */
function desvanecer(control: Control, desde: number, hasta: number, duracionMs: number, alTerminar?: () => void): void {
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

function rotulo(nombre: string, texto: string): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = C.rotulo;
  bloque.fontSize = TEXTO.rotulo;
  bloque.fontWeight = "600";
  bloque.height = "16px";
  bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bloque.isHitTestVisible = false;
  return bloque;
}

function parrafo(nombre: string, texto: string, color: string, tamano: number, peso = "400"): TextBlock {
  const bloque = new TextBlock(nombre, texto);
  bloque.color = color;
  bloque.fontSize = tamano;
  bloque.fontWeight = peso;
  bloque.textWrapping = true;
  bloque.width = ANCHO_CONTENIDO + "px";
  // La altura la define el propio texto: es lo único que garantiza que no quede
  // una línea recortada al editar los textos. Funciona porque esta capa no usa
  // escalado adaptativo (ver la nota grande arriba).
  bloque.resizeToFit = true;
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