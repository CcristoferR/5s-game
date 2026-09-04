import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, Control } from "@babylonjs/gui";
import { PALETA, TEXTO, altoDeTexto } from "./EstiloUI";

// ---------------------------------------------------------------------------
// Tablet de auditoría
// ---------------------------------------------------------------------------
//
// Reemplaza al contador "Marcados: 3/5" que había en el centro de la pantalla.
//
// Video 4.3 (2:25): "Genba, Genbutsu, Genjitsu... debemos estar en el tiempo
// real en el lugar de trabajo observando... con lo cual podremos detectar
// algún problema". Un auditor recorre el área con su planilla en la mano y va
// marcando lo que encuentra. Esa planilla es esto.
//
// ─── POR QUÉ UN CHECKLIST Y NO UN CONTADOR ────────────────────────────────
//
// Un número no dice QUÉ falta por revisar. La planilla lista los puntos desde
// el principio, así que el jugador sabe qué está auditando antes de empezar y
// puede recorrer el área buscando cada cosa — que es exactamente lo que hace
// un auditor real. El contador convertía el nivel en "encuentra cinco cosas";
// la planilla lo convierte en "verifica estos puntos".
//
// Los renglones NO revelan dónde está el problema ni si existe: dicen qué se
// audita ("Vigencia de tarjetas rojas"), no qué se va a encontrar.

const ANCHO = 330;

export type EstadoPunto = "pendiente" | "conforme" | "hallazgo";

interface Renglon {
  id: string;
  texto: string;
  marca: TextBlock;
  rotulo: TextBlock;
  fondo: Rectangle;
}

export interface TabletResult {
  /** Marca un punto como revisado, con su resultado. */
  resolver: (id: string, estado: EstadoPunto, detalle?: string) => void;
  /** Cuántos puntos quedan sin revisar. */
  pendientes: () => number;
  ocultar: () => void;
}

export function crearTabletAuditoria(
  _scene: Scene,
  gui: AdvancedDynamicTexture,
  puntos: Array<{ id: string; texto: string }>
): TabletResult {
  const marco = new Rectangle("tabletAuditoria");
  marco.width = ANCHO + "px";
  marco.adaptHeightToChildren = true;
  marco.cornerRadius = 14;
  marco.thickness = 1;
  marco.color = PALETA.borde;
  marco.background = "rgba(16, 19, 23, 0.92)";
  marco.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  marco.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  marco.left = "-18px";
  marco.top = "18px";
  marco.isPointerBlocker = false;
  gui.addControl(marco);

  const columna = new StackPanel("columnaTablet");
  columna.isVertical = true;
  columna.width = ANCHO - 28 + "px";
  columna.paddingTop = "16px";
  columna.paddingBottom = "16px";
  marco.addControl(columna);

  const encabezado = new TextBlock("tituloTablet", "PLANILLA DE AUDITORÍA");
  encabezado.color = PALETA.rotulo;
  encabezado.fontSize = TEXTO.rotulo;
  encabezado.fontWeight = "700";
  encabezado.height = "20px";
  encabezado.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  encabezado.paddingLeft = "6px";
  columna.addControl(encabezado);

    // La bajada dice cómo se opera, no qué buscar. Cada renglón indica DÓNDE
  // mirar; encontrar el desvío —si lo hay— es el trabajo.
  const bajada = new TextBlock(
    "bajadaTablet",
    "Ve a cada punto, haz clic para inspeccionarlo y dictamina."
  );
  bajada.color = PALETA.cuerpo;
  bajada.fontSize = TEXTO.rotulo;
  bajada.textWrapping = true;
  bajada.height = "46px";
  bajada.paddingTop = "6px";
  bajada.paddingLeft = "6px";
  bajada.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  columna.addControl(bajada);

  const renglones: Renglon[] = puntos.map((p) => {
    const alto = altoDeTexto(p.texto, ANCHO - 76, TEXTO.rotulo) + 22;

    const fondo = new Rectangle(`renglonTablet_${p.id}`);
    fondo.width = ANCHO - 28 + "px";
    fondo.height = alto + "px";
    fondo.thickness = 0;
    fondo.cornerRadius = 8;
    fondo.background = "transparent";
    fondo.paddingTop = "6px";
    columna.addControl(fondo);

    // Casilla de la izquierda. Vacía mientras el punto no se revisa: una
    // planilla a medio llenar se lee de un vistazo, y eso es la mitad de para
    // qué sirve llevarla.
    const marca = new TextBlock(`marcaTablet_${p.id}`, "○");
    marca.color = PALETA.tenue;
    marca.fontSize = TEXTO.menor;
    marca.fontWeight = "700";
    marca.width = "26px";
    marca.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marca.left = "6px";
    marca.isHitTestVisible = false;
    fondo.addControl(marca);

    const rotulo = new TextBlock(`textoTablet_${p.id}`, p.texto);
    rotulo.color = PALETA.cuerpo;
    rotulo.fontSize = TEXTO.rotulo;
    rotulo.textWrapping = true;
    rotulo.width = ANCHO - 76 + "px";
    rotulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    rotulo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    rotulo.left = "36px";
    rotulo.isHitTestVisible = false;
    fondo.addControl(rotulo);

    return { id: p.id, texto: p.texto, marca, rotulo, fondo };
  });

  const resolver = (id: string, estado: EstadoPunto, detalle?: string): void => {
    const renglon = renglones.find((r) => r.id === id);
    if (!renglon) return;

    const conforme = estado === "conforme";

    // LA PLANILLA HABLA DEL ÁREA, NO DEL AUDITOR.
    //
    // Antes marcaba ✕ en rojo al registrar una no conformidad, y eso se leía
    // como "te equivocaste" — justo lo contrario, porque detectar el desvío es
    // el acierto. El rojo está reservado a los errores del jugador en el
    // cartel de abajo; acá el hallazgo va en ámbar, que es el color de "algo
    // que atender", y el texto lo dice con todas las letras.
    // LA PLANILLA NO PUNTÚA: solo registra lo que el auditor declaró.
    //
    // Antes pintaba de verde lo conforme y de ámbar el hallazgo, y eso chocaba
    // de frente con el sonido: declarabas "cumple" sobre un desvío real, la
    // planilla se ponía verde y a la vez sonaba error. Dos señales opuestas al
    // mismo tiempo, imposibles de interpretar.
    //
    // Si acertaste o no lo dice el cartel de abajo en el momento, y el informe
    // al final. La planilla es el acta de tu recorrido, en gris.
    renglon.marca.text = "●";
    renglon.marca.color = PALETA.cuerpo;
    renglon.rotulo.color = PALETA.titulo;
    renglon.fondo.background = "rgba(255,255,255,0.05)";

    const veredicto = conforme ? "Declaraste: cumple" : "Declaraste: no conformidad";
    detalle = detalle ? `${veredicto} · ${detalle}` : veredicto;

    if (detalle) {
      // El hallazgo se anota bajo su punto, como en una planilla de verdad:
      // no basta con marcar la cruz, hay que decir qué se encontró.
      renglon.rotulo.text = `${renglon.texto}\n${detalle}`;
      renglon.fondo.height = altoDeTexto(renglon.rotulo.text, ANCHO - 76, TEXTO.rotulo) + 22 + "px";
    }

    renglon.marca.metadata = estado;
  };

  return {
    resolver,
    pendientes: () => renglones.filter((r) => r.marca.metadata === undefined).length,
    ocultar: () => {
      marco.isVisible = false;
    },
  };
}