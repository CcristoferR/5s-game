import { Scene, type ICanvasRenderingContext, type Nullable } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock, type Measure } from "@babylonjs/gui";
import {
  PALETA,
  TEXTO,
  MARGEN,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearDivisor,
  crearBotonTurno,
  crearBotonOpcion,
  rotularOpcion,
  neutralizarAnimaciones,
  conAlfa,
  altoDeTexto,
  desvanecer,
  afinarGui,
} from "../../ui/EstiloUI";
import { reproducir } from "../../core/Sonido";
import type { OpcionDeclaracion, PreguntaEnPanel, RespuestaDeclaracion, TipoRespuesta } from "./DeclaracionBanco";

// ===========================================================================
// El panel de la declaración
// ===========================================================================
//
// Las mismas piezas que los paneles del turno (EstiloUI), puestas de otra
// manera, porque aquí hay alguien delante.
//
// ─── LA TARJETA A UN LADO ─────────────────────────────────────────────────
//
// Los momentos del asalto van en el centro, sobre la escena apagada: algo
// interrumpe y hay que decidir. La declaración es una conversación: el
// sargento está a un metro, preguntando y anotando en su libreta. Así que la
// tarjeta va a la derecha y la escena apenas se oscurece, y el que pregunta
// queda a la vista en el hueco de la izquierda (ver hueco y el encuadre en
// PuestoBanco). En una pantalla estrecha, donde no queda hueco, la tarjeta
// vuelve al centro.
//
// ─── EL DOCUMENTO ─────────────────────────────────────────────────────────
//
// Al final, lo declarado en papel: claro, con letra de imprenta y cada
// respuesta marcada —hecho, no lo vio, opinión, inventado—. Es lo único
// claro de todo el turno, y a propósito: es lo que queda del asalto, lo que
// se va a leer en la fiscalía. Se firma de verdad: la firma se traza.

const ANCHO = 600;
const ANCHO_CONTENIDO = ANCHO - MARGEN * 2;
/** Lo que se separa la tarjeta del borde derecho. */
const MARGEN_DERECHO = 56;
/** Por debajo de este ancho no queda hueco para el que pregunta: la tarjeta va al centro. */
const HUECO_MINIMO = 320;

/**
 * El verde de Carabineros, aclarado para que se lea sobre la tarjeta oscura.
 * Oliva y no el verde de "correcto" (PALETA.acierto): la institución no puede
 * leerse como una respuesta buena.
 */
const ACENTO = "#aabb74";

/** El papel de la declaración: sus propios colores, fijos, no los del tema. */
const PAPEL = {
  fondo: "#f2efe6",
  tinta: "#1c2127",
  suave: "rgba(28,33,39,0.6)",
  linea: "rgba(28,33,39,0.16)",
  bien: "#2f7d55",
  mal: "#a8412f",
  institucion: "#2d4a30",
  boton: "#24402b",
  botonEncima: "#2f5438",
};
const SERIF = "Georgia, 'Times New Roman', serif";

/** Cómo se rotula cada manera de contestar. */
const ROTULO_RESPUESTA: Record<TipoRespuesta, { chip: string; papel: string; bien: boolean }> = {
  describe: { chip: "DESCRIBE LO QUE VIO", papel: "HECHO", bien: true },
  noVio: { chip: "DICE QUE NO LO VIO", papel: "NO LO VIO", bien: true },
  opina: { chip: "OPINA", papel: "OPINIÓN", bien: false },
  inventa: { chip: "INVENTA", papel: "INVENTADO", bien: false },
};

export interface DocumentoDeclaracion {
  /** "27-09-2026". */
  fecha: string;
  /** "10:08". */
  hora: string;
  respuestas: readonly RespuestaDeclaracion[];
}

/** Lo que cuenta la tarjeta del cierre. */
export interface CierreBanco {
  decisionesBien: number;
  decisionesTotal: number;
  declaracionBien: number;
  declaracionTotal: number;
  opiniones: number;
  inventadas: number;
  /** Preguntas que no pudo describir por no haberlo visto. */
  sinVer: number;
}

export interface PanelDeclaracion {
  /**
   * Dónde debe quedar el que pregunta, en fracción del ancho de la pantalla:
   * el centro del hueco que deja la tarjeta. 0,5 si la tarjeta va al centro.
   */
  hueco(): number;
  /**
   * Una pregunta: quién pregunta, qué, lo que no se vio y las tres respuestas.
   * Al elegir, la misma tarjeta explica la respuesta.
   *
   * @param alElegir  En el instante del clic: el sonido y el registro.
   * @param alSeguir  Al cerrar la explicación.
   */
  mostrarPregunta(p: PreguntaEnPanel, alElegir: (o: OpcionDeclaracion) => void, alSeguir: () => void): void;
  /** Lo declarado, en papel, para firmar. */
  mostrarDocumento(doc: DocumentoDeclaracion, alFirmar: () => void): void;
  /** El final del turno, por ahora: cómo fue y las dos salidas. */
  mostrarCierre(cierre: CierreBanco, alRepetir: () => void, alSalir: () => void): void;
  dispose(): void;
}

/**
 * Una firma que se traza.
 *
 * Un control propio que dibuja en el lienzo de la interfaz: una rúbrica de
 * trazo seguido, hecha de curvas, que aparece de izquierda a derecha según
 * `progreso`. Con una fuente cursiva habría dependido de qué letras tiene
 * instaladas cada equipo, y no se habría podido trazar.
 */
class Firma extends Control {
  /** De 0 a 1: cuánto de la rúbrica está escrito. */
  progreso = 0;
  private readonly tinta: string;

  constructor(nombre: string, tinta: string) {
    super(nombre);
    this.tinta = tinta;
    this.isHitTestVisible = false;
  }

  protected override _getTypeName(): string {
    return "Firma";
  }

  override _draw(context: ICanvasRenderingContext, _invalidado?: Nullable<Measure>): void {
    if (this.progreso <= 0) return;
    const m = this._currentMeasure;
    context.save();
    this._applyStates(context);
    const x = (f: number): number => m.left + m.width * f;
    const y = (f: number): number => m.top + m.height * f;
    // La rúbrica, en tramos de curva: una inicial alta, un par de bucles y
    // la línea que la cierra por debajo. Cada tramo entra según el progreso.
    const tramos: [number, number, number, number, number, number][] = [
      [0.1, 0.1, 0.02, 0.85, 0.16, 0.8],
      [0.26, 0.76, 0.22, 0.2, 0.3, 0.3],
      [0.36, 0.38, 0.33, 0.78, 0.42, 0.7],
      [0.5, 0.6, 0.47, 0.3, 0.55, 0.42],
      [0.62, 0.55, 0.58, 0.82, 0.66, 0.68],
      [0.72, 0.56, 0.75, 0.4, 0.8, 0.52],
      [0.86, 0.66, 0.6, 0.95, 0.12, 0.88],
    ];
    const hechos = this.progreso * tramos.length;
    const c = context as unknown as CanvasRenderingContext2D;
    c.strokeStyle = this.tinta;
    c.lineWidth = 2.2;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x(0.08), y(0.55));
    let desde = { x: 0.08, y: 0.55 };
    for (let i = 0; i < tramos.length && i < hechos; i++) {
      const [c1x, c1y, c2x, c2y, fx, fy] = tramos[i];
      const parte = Math.min(1, hechos - i);
      if (parte >= 1) {
        c.bezierCurveTo(x(c1x), y(c1y), x(c2x), y(c2y), x(fx), y(fy));
      } else {
        // El tramo a medias: De Casteljau hasta `parte`.
        const lerp = (a: number, b: number): number => a + (b - a) * parte;
        const ax = lerp(desde.x, c1x), ay = lerp(desde.y, c1y);
        const bx = lerp(c1x, c2x), by = lerp(c1y, c2y);
        const cx = lerp(c2x, fx), cy = lerp(c2y, fy);
        const dx = lerp(ax, bx), dy = lerp(ay, by);
        const ex = lerp(bx, cx), ey = lerp(by, cy);
        const px = lerp(dx, ex), py = lerp(dy, ey);
        c.bezierCurveTo(x(ax), y(ay), x(dx), y(dy), x(px), y(py));
      }
      desde = { x: fx, y: fy };
    }
    c.stroke();
    context.restore();
  }
}

export function crearPanelDeclaracion(scene: Scene): PanelDeclaracion {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("panelDeclaracionBanco", true, scene);
  if (gui.layer) gui.layer.applyPostProcess = false;
  afinarGui(gui);

  let capa: Rectangle | null = null;
  let cerrado = false;

  /** Igual que en los paneles del turno: nunca se destruye en el clic que la cierra. */
  function retirarCapa(): void {
    const velo = capa;
    capa = null;
    if (!velo) return;
    velo.isPointerBlocker = false;
    desvanecer(velo, velo.alpha, 0, 140, () => {
      velo.isVisible = false;
      setTimeout(() => {
        try {
          velo.dispose();
        } catch {
          /* ya se había ido */
        }
      }, 0);
    });
  }

  /** Si cabe la tarjeta a la derecha con el hueco para el que pregunta. */
  const cabeAlLado = (): boolean => gui.getSize().width >= ANCHO + MARGEN_DERECHO * 2 + HUECO_MINIMO;

  function nuevoVelo(nombre: string, oscuridad: number): Rectangle {
    retirarCapa();
    const velo = crearVelo(gui, `velo${nombre}`);
    velo.background = `rgba(9, 11, 13, ${oscuridad})`;
    capa = velo;
    desvanecer(velo, 0, 1, 180);
    return velo;
  }

  function nuevaTarjeta(
    velo: Rectangle,
    nombre: string,
    ancho: number,
    alto: number,
    filete: string,
    alLado: boolean
  ): { tarjeta: Rectangle; columna: StackPanel } {
    const tarjeta = crearTarjeta(velo, `tarjeta${nombre}`, ancho, alto);
    tarjeta.cornerRadius = 18;
    tarjeta.shadowColor = "rgba(0,0,0,0.5)";
    tarjeta.shadowBlur = 30;
    tarjeta.shadowOffsetY = 10;
    if (alLado) {
      tarjeta.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      tarjeta.left = -MARGEN_DERECHO + "px";
    }
    crearFilete(tarjeta, `filete${nombre}`, ancho - 72, filete).cornerRadius = 2;
    const columna = new StackPanel(`columna${nombre}`);
    columna.isVertical = true;
    columna.width = ancho - MARGEN * 2 + "px";
    columna.left = MARGEN + "px";
    columna.top = "28px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);
    return { tarjeta, columna };
  }

  /**
   * Tras dibujarse: encoge la tarjeta a lo que ocupó el texto —la cuenta
   * previa sobra a propósito, ver ajustarAlContenido en los paneles del
   * turno— y, si aun así no cabe en la pantalla, la escala entera para que
   * quepa. Una opción cortada por abajo es una respuesta que no se puede
   * elegir.
   */
  function ajustar(tarjeta: Rectangle, columna: StackPanel, pie: number, velo: Rectangle): void {
    scene.onAfterRenderObservable.addOnce(() => {
      if (!tarjeta.parent || tarjeta.heightInPixels <= 0) return;
      const necesario = columna.topInPixels + columna.heightInPixels + pie;
      if (necesario > 0 && necesario < tarjeta.heightInPixels) tarjeta.height = Math.round(necesario) + "px";
      const alto = Math.min(tarjeta.heightInPixels, necesario > 0 ? necesario : tarjeta.heightInPixels);
      const cabe = velo.heightInPixels - 40;
      if (alto > cabe && cabe > 200) {
        const s = cabe / alto;
        tarjeta.scaleX = s;
        tarjeta.scaleY = s;
      }
    });
  }

  /** La cabecera de la tarjeta de la pregunta: quién, en qué pregunta va y la barra. */
  function cabecera(columna: StackPanel, p: PreguntaEnPanel, respondida: boolean): void {
    const fila = new Rectangle("filaCabeceraDeclaracion");
    fila.width = ANCHO_CONTENIDO + "px";
    fila.height = "18px";
    fila.thickness = 0;
    fila.isHitTestVisible = false;
    fila.addControl(crearRotulo("institucionDeclaracion", "CARABINEROS DE CHILE · DECLARACIÓN", ACENTO));
    const cuenta = crearRotulo("cuentaDeclaracion", `PREGUNTA ${p.numero} DE ${p.total}`, PALETA.tenue);
    cuenta.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    fila.addControl(cuenta);
    columna.addControl(fila);
    columna.addControl(crearEspacio("aireBarraDeclaracion", 10));

    // Una raya por pregunta: las contestadas en el color de la institución,
    // la de ahora más clara, las que faltan apenas marcadas.
    const barra = new Rectangle("barraDeclaracion");
    barra.width = ANCHO_CONTENIDO + "px";
    barra.height = "3px";
    barra.thickness = 0;
    barra.isHitTestVisible = false;
    const HUECO = 6;
    const tramo = (ANCHO_CONTENIDO - HUECO * (p.total - 1)) / p.total;
    for (let i = 0; i < p.total; i++) {
      const r = new Rectangle(`barraDeclaracion_${i}`);
      r.width = tramo + "px";
      r.height = "3px";
      r.thickness = 0;
      r.cornerRadius = 2;
      r.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      r.left = i * (tramo + HUECO) + "px";
      const hecha = i < p.numero - 1 || (respondida && i === p.numero - 1);
      r.background = hecha ? ACENTO : i === p.numero - 1 ? PALETA.tenue : PALETA.linea;
      barra.addControl(r);
    }
    columna.addControl(barra);
  }

  /** "Estabas en el suelo mientras se podía ver." / "La cara: mirabas hacia otra parte." */
  function razones(p: PreguntaEnPanel): string {
    const conMayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    const motivos = new Set(p.faltan.map((f) => f.motivo));
    if (p.bloqueada && motivos.size === 1) return `${conMayuscula(p.faltan[0].porQue)} mientras se podía ver.`;
    return p.faltan.map((f) => (f.que ? `${conMayuscula(f.que)}: ${f.porQue}.` : `${conMayuscula(f.porQue)}.`)).join("\n");
  }

  function mostrarRespuesta(p: PreguntaEnPanel, o: OpcionDeclaracion, alSeguir: () => void): void {
    const rotulo = ROTULO_RESPUESTA[o.tipo];
    const color = rotulo.bien ? PALETA.acierto : PALETA.error;
    const cita = `«${o.texto}»`;
    const alto =
      28 + 18 + 10 + 3 + 22 + 28 + 16 + 18 + 8 +
      altoDeTexto(cita, ANCHO_CONTENIDO, TEXTO.destacado) + 18 + 1 + 16 +
      altoDeTexto(o.explicacion, ANCHO_CONTENIDO, TEXTO.cuerpo) + 94;
    const alLado = cabeAlLado();
    const velo = nuevoVelo("RespuestaDeclaracion", 0.3);
    const { tarjeta, columna } = nuevaTarjeta(velo, "RespuestaDeclaracion", ANCHO, alto, color, alLado);

    cabecera(columna, p, true);
    columna.addControl(crearEspacio("aireChipDeclaracion", 22));

    // La pastilla: qué clase de respuesta fue, con su símbolo, que se lee sin
    // depender del color.
    const textoChip = `${rotulo.bien ? "✓" : "✕"}   ${rotulo.chip}`;
    const chip = new Rectangle("chipDeclaracion");
    chip.width = Math.round(textoChip.length * 8.4 + 34) + "px";
    chip.height = "28px";
    chip.cornerRadius = 14;
    chip.thickness = 1;
    chip.color = conAlfa(color, 0.55);
    chip.background = conAlfa(color, 0.14);
    chip.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    chip.isHitTestVisible = false;
    const letras = new TextBlock("textoChipDeclaracion", textoChip);
    letras.color = color;
    letras.fontSize = TEXTO.rotulo;
    letras.fontWeight = "700";
    chip.addControl(letras);
    columna.addControl(chip);

    columna.addControl(crearEspacio("aireCitaDeclaracion", 16));
    columna.addControl(crearRotulo("rotuloCitaDeclaracion", "ASÍ QUEDA EN LA DECLARACIÓN"));
    columna.addControl(crearEspacio("aireCitaDeclaracion2", 8));
    const dicho = crearParrafo("citaDeclaracion", cita, ANCHO_CONTENIDO, TEXTO.destacado, PALETA.titulo, "500");
    dicho.fontStyle = "italic";
    columna.addControl(dicho);
    columna.addControl(crearEspacio("aireDivisorRespuestaDeclaracion", 18));
    columna.addControl(crearDivisor("divisorRespuestaDeclaracion", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorRespuestaDeclaracion", 16));
    columna.addControl(crearParrafo("explicacionDeclaracion", o.explicacion, ANCHO_CONTENIDO, TEXTO.cuerpo));

    const ultima = p.numero >= p.total;
    const boton = crearBotonTurno(
      "btnSiguienteDeclaracion",
      ultima ? "Ver la declaración" : "Siguiente pregunta",
      220,
      "principal",
      () => ACENTO
    );
    boton.left = -MARGEN + "px";
    boton.top = "-24px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(boton);
    let pulsado = false;
    boton.onPointerUpObservable.add(() => {
      if (pulsado) return;
      pulsado = true;
      retirarCapa();
      alSeguir();
    });
    ajustar(tarjeta, columna, 94, velo);
  }

  /** Un botón oscuro para el papel claro: el de los paneles no se leería encima. */
  function botonDePapel(nombre: string, texto: string, ancho: number): Button {
    const boton = Button.CreateSimpleButton(nombre, texto);
    boton.width = ancho + "px";
    boton.height = "46px";
    boton.cornerRadius = 10;
    boton.thickness = 0;
    boton.background = PAPEL.boton;
    boton.fontSize = TEXTO.menor;
    boton.fontWeight = "600";
    boton.color = "#f4f6f2";
    boton.hoverCursor = "pointer";
    neutralizarAnimaciones(boton);
    if (boton.textBlock) {
      boton.textBlock.color = "#f4f6f2";
      boton.textBlock.isHitTestVisible = false;
    }
    boton.onPointerEnterObservable.add(() => (boton.background = PAPEL.botonEncima));
    boton.onPointerOutObservable.add(() => (boton.background = PAPEL.boton));
    boton.onPointerUpObservable.add(() => reproducir("boton"));
    return boton;
  }

  return {
    hueco() {
      const W = gui.getSize().width;
      if (!cabeAlLado() || W <= 0) return 0.5;
      return (W - ANCHO - MARGEN_DERECHO) / 2 / W;
    },

    mostrarPregunta(p, alElegir, alSeguir) {
      if (cerrado) return;
      const ANCHO_ETIQUETA = ANCHO_CONTENIDO - 82;
      const pregunta = `«${p.pregunta}»`;
      const tituloNota = p.bloqueada ? "No puede responder: no observó ese detalle." : "No observó todos los detalles.";
      const textoNota = p.faltan.length ? razones(p) : "";
      const ANCHO_NOTA = ANCHO_CONTENIDO - 36;
      const altoNota = p.faltan.length
        ? 16 + altoDeTexto(tituloNota, ANCHO_NOTA, TEXTO.menor) + 6 + altoDeTexto(textoNota, ANCHO_NOTA, TEXTO.menor) + 16
        : 0;
      const altoOpciones = p.opciones.reduce(
        (suma, o) => suma + Math.max(60, altoDeTexto(o.texto, ANCHO_ETIQUETA, TEXTO.destacado) + 30),
        0
      );
      const PIE = 27;
      const alto =
        28 + 18 + 10 + 3 + 20 + 18 + 8 + altoDeTexto(pregunta, ANCHO_CONTENIDO, TEXTO.titulo) + 18 +
        (altoNota ? altoNota + 16 : 0) + 1 + 16 + altoOpciones + (p.opciones.length - 1) * 10 + PIE;
      const alLado = cabeAlLado();
      const velo = nuevoVelo("PreguntaDeclaracion", alLado ? 0.3 : 0.7);
      const { tarjeta, columna } = nuevaTarjeta(velo, "PreguntaDeclaracion", ANCHO, alto, ACENTO, alLado);

      cabecera(columna, p, false);
      columna.addControl(crearEspacio("aireQuienDeclaracion", 20));
      columna.addControl(crearRotulo("quienDeclaracion", "SARGENTO ROJAS · 3.ª COMISARÍA", PALETA.tenue));
      columna.addControl(crearEspacio("airePreguntaDeclaracion", 8));
      columna.addControl(
        crearParrafo("preguntaDeclaracion", pregunta, ANCHO_CONTENIDO, TEXTO.titulo, PALETA.titulo, "600")
      );
      columna.addControl(crearEspacio("aireNotaDeclaracion", 18));

      // Lo que no se vio: antes de las respuestas, para que se lea antes de
      // elegir. Del color del error pero apagado: no es una falta del jugador
      // en esta pregunta, es la cuenta del primer tiempo.
      if (p.faltan.length) {
        const nota = new Rectangle("notaDeclaracion");
        nota.width = ANCHO_CONTENIDO + "px";
        nota.height = altoNota + "px";
        nota.cornerRadius = 10;
        nota.thickness = 1;
        nota.color = conAlfa(PALETA.error, 0.4);
        nota.background = conAlfa(PALETA.error, 0.09);
        nota.isHitTestVisible = false;
        const raya = new Rectangle("rayaNotaDeclaracion");
        raya.width = "3px";
        raya.height = altoNota - 20 + "px";
        raya.thickness = 0;
        raya.background = conAlfa(PALETA.error, 0.8);
        raya.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        raya.left = "10px";
        nota.addControl(raya);
        const dentro = new StackPanel("columnaNotaDeclaracion");
        dentro.isVertical = true;
        dentro.width = ANCHO_NOTA + "px";
        dentro.left = "24px";
        dentro.top = "16px";
        dentro.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dentro.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        nota.addControl(dentro);
        dentro.addControl(crearParrafo("tituloNotaDeclaracion", tituloNota, ANCHO_NOTA, TEXTO.menor, PALETA.error, "600"));
        dentro.addControl(crearEspacio("aireTextoNotaDeclaracion", 6));
        dentro.addControl(crearParrafo("textoNotaDeclaracion", textoNota, ANCHO_NOTA, TEXTO.menor, PALETA.cuerpo));
        columna.addControl(nota);
        columna.addControl(crearEspacio("airePostNotaDeclaracion", 16));
      }

      columna.addControl(crearDivisor("divisorDeclaracion", ANCHO_CONTENIDO));
      columna.addControl(crearEspacio("airePostDivisorDeclaracion", 16));

      let yaElegida = false;
      p.opciones.forEach((o, i) => {
        const boton = crearBotonOpcion(`btnDeclaracion_${i}`, o.texto, ANCHO_CONTENIDO);
        boton.onPointerUpObservable.add(() => {
          if (yaElegida) return;
          yaElegida = true;
          alElegir(o);
          mostrarRespuesta(p, o, alSeguir);
        });
        columna.addControl(boton);
        rotularOpcion(boton, String.fromCharCode(65 + i));
        if (i < p.opciones.length - 1) columna.addControl(crearEspacio(`aireOpcionDeclaracion_${i}`, 10));
      });
      ajustar(tarjeta, columna, PIE, velo);
    },

    mostrarDocumento(doc, alFirmar) {
      if (cerrado) return;
      const ANCHO_PAPEL = 760;
      const DENTRO = ANCHO_PAPEL - 80;
      const velo = nuevoVelo("DocumentoDeclaracion", 0.72);
      reproducir("panel");

      const papel = new Rectangle("papelDeclaracion");
      papel.width = ANCHO_PAPEL + "px";
      papel.cornerRadius = 6;
      papel.thickness = 0;
      papel.background = PAPEL.fondo;
      papel.shadowColor = "rgba(0,0,0,0.55)";
      papel.shadowBlur = 34;
      papel.shadowOffsetY = 12;
      velo.addControl(papel);

      const columna = new StackPanel("columnaPapelDeclaracion");
      columna.isVertical = true;
      columna.width = DENTRO + "px";
      columna.top = "34px";
      columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      papel.addControl(columna);

      const texto = (nombre: string, t: string, tamano: number, color: string, peso = "400", ancho = DENTRO, fuente?: string): TextBlock => {
        const b = crearParrafo(nombre, t, ancho, tamano, color, peso);
        if (fuente) b.fontFamily = fuente;
        return b;
      };
      const fila = (nombre: string, alto: number): Rectangle => {
        const r = new Rectangle(nombre);
        r.width = DENTRO + "px";
        r.height = alto + "px";
        r.thickness = 0;
        r.isHitTestVisible = false;
        return r;
      };

      // Membrete.
      const membrete = fila("membreteDeclaracion", 18);
      membrete.addControl(crearRotulo("institucionPapel", "CARABINEROS DE CHILE", PAPEL.institucion));
      const unidad = crearRotulo("unidadPapel", "3.ª COMISARÍA", PAPEL.suave);
      unidad.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      membrete.addControl(unidad);
      columna.addControl(membrete);
      columna.addControl(crearEspacio("aireTituloPapel", 10));
      columna.addControl(texto("tituloPapel", "Declaración de testigo", 30, PAPEL.tinta, "600", DENTRO, SERIF));
      columna.addControl(crearEspacio("aireDatosPapel", 8));
      columna.addControl(texto("hechoPapel", "Robo con intimidación · Sucursal bancaria, hall de atención", 15, PAPEL.suave));
      columna.addControl(
        texto(
          "datosPapel",
          `Fecha: ${doc.fecha}   ·   Hora: ${doc.hora}   ·   Declarante: guardia de seguridad del acceso`,
          15,
          PAPEL.suave
        )
      );
      columna.addControl(crearEspacio("aireRayaPapel", 14));
      const raya = crearDivisor("rayaPapel", DENTRO);
      raya.background = PAPEL.linea;
      columna.addControl(raya);
      columna.addControl(crearEspacio("aireRespuestasPapel", 14));

      // Lo declarado, pregunta a pregunta, con su marca.
      doc.respuestas.forEach((r, i) => {
        const rotulo = ROTULO_RESPUESTA[r.tipo];
        const cab = fila(`cabPapel_${i}`, 17);
        cab.addControl(crearRotulo(`temaPapel_${i}`, `${i + 1}.  ${r.tema.toUpperCase()}`, PAPEL.suave));
        const marca = crearRotulo(
          `marcaPapel_${i}`,
          `${rotulo.bien ? "✓" : "✕"}  ${rotulo.papel}`,
          rotulo.bien ? PAPEL.bien : PAPEL.mal
        );
        marca.fontWeight = "700";
        marca.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        cab.addControl(marca);
        columna.addControl(cab);
        columna.addControl(crearEspacio(`aireDichoPapel_${i}`, 3));
        const dicho = texto(`dichoPapel_${i}`, `«${r.texto}»`, 16, PAPEL.tinta, "400", DENTRO, SERIF);
        columna.addControl(dicho);
        columna.addControl(crearEspacio(`airePostDichoPapel_${i}`, 12));
      });

      const raya2 = crearDivisor("raya2Papel", DENTRO);
      raya2.background = PAPEL.linea;
      columna.addControl(raya2);
      columna.addControl(crearEspacio("aireFirmaPapel", 12));

      // Al pie: la firma, a la izquierda, y el botón que la pone.
      const pie = fila("piePapel", 74);
      const zona = new Rectangle("zonaFirmaPapel");
      zona.width = "300px";
      zona.height = "74px";
      zona.thickness = 0;
      zona.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      zona.isHitTestVisible = false;
      const firma = new Firma("firmaPapel", PAPEL.tinta);
      firma.width = "240px";
      firma.height = "44px";
      firma.top = "-12px";
      firma.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      firma.left = "8px";
      zona.addControl(firma);
      const linea = new Rectangle("lineaFirmaPapel");
      linea.width = "280px";
      linea.height = "1px";
      linea.thickness = 0;
      linea.background = "rgba(28,33,39,0.45)";
      linea.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      linea.top = "14px";
      zona.addControl(linea);
      const leyenda = crearRotulo("leyendaFirmaPapel", "FIRMA DEL DECLARANTE", PAPEL.suave);
      leyenda.top = "28px";
      leyenda.width = "280px";
      leyenda.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      zona.addControl(leyenda);
      pie.addControl(zona);

      const boton = botonDePapel("btnFirmarDeclaracion", "Firmar la declaración", 230);
      boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      boton.top = "4px";
      pie.addControl(boton);
      columna.addControl(pie);

      // El alto del papel, por la misma cuenta que el resto: se estima y se
      // ajusta tras dibujar.
      const altoPapel =
        34 + 18 + 10 + 44 + 8 + 22 + 22 + 14 + 1 + 14 +
        doc.respuestas.reduce((s, r) => s + 17 + 3 + altoDeTexto(`«${r.texto}»`, DENTRO, 16) + 12, 0) +
        1 + 12 + 74 + 30;
      papel.height = altoPapel + "px";
      scene.onAfterRenderObservable.addOnce(() => {
        if (!papel.parent || papel.heightInPixels <= 0) return;
        const necesario = columna.topInPixels + columna.heightInPixels + 30;
        if (necesario > 0 && necesario < papel.heightInPixels) papel.height = Math.round(necesario) + "px";
        const alto = Math.min(papel.heightInPixels, necesario);
        const cabe = velo.heightInPixels - 32;
        const cabeAncho = velo.widthInPixels - 32;
        const s = Math.min(1, cabe / alto, cabeAncho / ANCHO_PAPEL);
        if (s < 1 && s > 0.3) {
          papel.scaleX = s;
          papel.scaleY = s;
        }
      });

      let firmando = false;
      boton.onPointerUpObservable.add(() => {
        if (firmando) return;
        firmando = true;
        boton.isEnabled = false;
        boton.background = PAPEL.linea;
        if (boton.textBlock) boton.textBlock.text = "Firmada";
        reproducir("marca");
        // La rúbrica, en nueve décimas; y un respiro con ella a la vista.
        const inicio = performance.now();
        const trazar = (): void => {
          if (cerrado) return;
          firma.progreso = Math.min(1, (performance.now() - inicio) / 900);
          firma.markAsDirty();
          if (firma.progreso < 1) requestAnimationFrame(trazar);
          else
            setTimeout(() => {
              if (cerrado) return;
              retirarCapa();
              alFirmar();
            }, 700);
        };
        requestAnimationFrame(trazar);
      });
    },

    mostrarCierre(c, alRepetir, alSalir) {
      if (cerrado) return;
      const ANCHO_CIERRE = 660;
      const DENTRO = ANCHO_CIERRE - MARGEN * 2;
      const titulo = "La declaración quedó firmada";
      // Solo lo que pasó: "0 datos inventados" se lee como un reproche. Y si
      // no hubo nada que contar, se dice.
      const partes = [
        c.opiniones > 0 ? (c.opiniones === 1 ? "1 opinión" : `${c.opiniones} opiniones`) : "",
        c.inventadas > 0 ? (c.inventadas === 1 ? "1 dato inventado" : `${c.inventadas} datos inventados`) : "",
        c.sinVer > 0 ? (c.sinVer === 1 ? "1 detalle que no alcanzaste a ver" : `${c.sinVer} detalles que no alcanzaste a ver`) : "",
      ].filter(Boolean);
      const detalle = partes.length ? partes.join("  ·  ") : "Solo hechos, y nada que no alcanzaras a ver.";
      const cierre =
        "Carabineros se queda con lo que viste. Nada puede reemplazar lo que no alcanzaste a ver: por eso, en " +
        "un asalto, lo primero es no exponerse, y lo segundo, mirar.";
      const alto =
        28 + 18 + 10 + altoDeTexto(titulo, DENTRO, TEXTO.titulo) + 20 + 1 + 18 + 34 + 10 + 34 + 4 +
        altoDeTexto(detalle, DENTRO, TEXTO.menor) + 20 + altoDeTexto(cierre, DENTRO, TEXTO.menor) + 110;
      const velo = nuevoVelo("CierreBanco", 0.76);
      const { tarjeta, columna } = nuevaTarjeta(velo, "CierreBanco", ANCHO_CIERRE, alto, ACENTO, false);

      columna.addControl(crearRotulo("rotuloCierreBanco", "FIN DEL TURNO", ACENTO));
      columna.addControl(crearEspacio("aireTituloCierreBanco", 10));
      columna.addControl(crearParrafo("tituloCierreBanco", titulo, DENTRO, TEXTO.titulo, PALETA.titulo, "600"));
      columna.addControl(crearEspacio("aireDivisorCierreBanco", 20));
      columna.addControl(crearDivisor("divisorCierreBanco", DENTRO));
      columna.addControl(crearEspacio("airePostDivisorCierreBanco", 18));

      const cifra = (nombre: string, que: string, cuanto: string): Rectangle => {
        const f = new Rectangle(nombre);
        f.width = DENTRO + "px";
        f.height = "34px";
        f.thickness = 0;
        f.isHitTestVisible = false;
        const a = crearParrafo(`${nombre}_que`, que, DENTRO, TEXTO.cuerpo, PALETA.cuerpo);
        a.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        f.addControl(a);
        const b = crearParrafo(`${nombre}_cuanto`, cuanto, DENTRO, TEXTO.destacado, PALETA.titulo, "600");
        b.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        b.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        f.addControl(b);
        return f;
      };
      columna.addControl(
        cifra("cifraAsaltoCierre", "Durante el asalto", `${c.decisionesBien} de ${c.decisionesTotal} decisiones correctas`)
      );
      columna.addControl(crearEspacio("aireCifrasCierre", 10));
      columna.addControl(
        cifra(
          "cifraDeclaracionCierre",
          "En la declaración",
          `${c.declaracionBien} de ${c.declaracionTotal} respuestas objetivas`
        )
      );
      columna.addControl(crearEspacio("aireDetalleCierre", 4));
      const det = crearParrafo("detalleCierreBanco", detalle, DENTRO, TEXTO.menor, PALETA.tenue);
      det.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      columna.addControl(det);
      columna.addControl(crearEspacio("aireNotaCierre", 20));
      columna.addControl(crearParrafo("notaCierreBanco", cierre, DENTRO, TEXTO.menor, PALETA.cuerpo));

      const boton = (nombre: string, texto: string, variante: "principal" | "secundario", segundo: boolean, alPulsar: () => void): void => {
        const b = crearBotonTurno(nombre, texto, 220, variante, () => ACENTO);
        b.left = -(MARGEN + (segundo ? 232 : 0)) + "px";
        b.top = "-24px";
        b.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        b.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        tarjeta.addControl(b);
        let pulsado = false;
        b.onPointerUpObservable.add(() => {
          if (pulsado) return;
          pulsado = true;
          retirarCapa();
          alPulsar();
        });
      };
      boton("btnMenuBanco", "Volver al menú", "principal", false, alSalir);
      boton("btnRepetirBanco", "Repetir el turno", "secundario", true, alRepetir);
      ajustar(tarjeta, columna, 94, velo);
    },

    dispose() {
      cerrado = true;
      gui.dispose();
    },
  };
}
