import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
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
  conAlfa,
  altoDeTexto,
  desvanecer,
  afinarGui,
} from "../../ui/EstiloUI";
import type { RondaCerrada } from "./RondasSupermercado";

// ===========================================================================
// Las tarjetas del turno del supermercado: el briefing y el recuento
// ===========================================================================
//
// La que abre el turno y la que lo cierra, con el formato de las tarjetas del
// libro del condominio: la misma tarjeta, el mismo filete de color, los mismos
// rótulos y el mismo botón. Son dos escenarios del mismo curso, y hay que
// reconocer al primer vistazo que esto es un turno como aquel.
//
// ─── POR QUÉ LA GUI DE BABYLON Y NO HTML, COMO LOS RÓTULOS ────────────────
//
// Los rótulos del recorrido se leen de reojo y no se tocan. Estas tarjetas se
// leen con calma y se cierran con un botón, igual que las del condominio, que
// están hechas con las piezas de EstiloUI. Con las mismas piezas no pueden
// separarse con el tiempo.

const ANCHO_TARJETA = 820;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;
/** Alto de una fila de campos: rótulo a la izquierda, dato a la derecha. */
const ALTO_CAMPO = 30;
/** Lo que ocupan el aire de arriba y la botonera de abajo. */
const MARCO_VERTICAL = 28 + 110;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export interface BriefingTurno {
  rotulo: string;
  titulo: string;
  campos: [string, string][];
  nota: string;
  boton: string;
}

export interface RecuentoTurno {
  rotulo: string;
  rondas: readonly RondaCerrada[];
  /** Para rotular la franja: inicio, mitad y fin del turno. */
  horas: [string, string, string];
  nota: string;
  /** Lo que pasó en la sala, en orden de hora. Va en una segunda tarjeta. */
  situaciones: readonly FilaSituacion[];
  /** El pie de esa segunda tarjeta. */
  notaSituaciones: string;
}

/** Una situación del turno, ya cerrada, tal como sale en el recuento. */
export interface FilaSituacion {
  hora: string;
  actividad: string;
  resultado: "correcta" | "incorrecta" | "perdida";
  /** Si no había nada que corregir. Perdérsela no cuenta en contra. */
  inocente: boolean;
}

/** Las tres cosas que puede hacer un guardia delante de algo que ocurre. */
export type ClaseRespuesta = "observar" | "avisar" | "intervenir";

export interface OpcionSituacion {
  clase: ClaseRespuesta;
  /**
   * Lo que haces, empezando por el verbo.
   *
   * Empieza por el verbo a propósito y no lleva etiqueta aparte: así la
   * opción dice de qué clase es mientras se lee, sin una pastilla al lado que
   * permita elegir por la palabra sin leer la frase.
   */
  texto: string;
  correcta: boolean;
  /** Por qué era o por qué no era. Sale después de elegir. */
  explicacion: string;
  /**
   * Lo que cuenta Central por radio al cerrar la explicación, si lo que
   * elegiste tiene una consecuencia que se ve en la sala.
   */
  despues?: string;
}

export interface SituacionEnPanel {
  /** "16:25 · CLIENTE EN PASILLO". */
  rotulo: string;
  /** Qué estás viendo. */
  aviso: string;
  opciones: readonly OpcionSituacion[];
}

export interface PanelesTurno {
  mostrarBriefing(briefing: BriefingTurno, alComenzar: () => void): void;
  /**
   * El panel de una situación: qué ves arriba, las tres respuestas debajo y,
   * al elegir, por qué era o no era.
   *
   * @param alElegir  En el instante del clic, para el sonido y el registro.
   * @param alCerrar  Cuando cierra la explicación. Es cuando se reanuda el turno.
   */
  mostrarSituacion(
    situacion: SituacionEnPanel,
    alElegir: (opcion: OpcionSituacion) => void,
    alCerrar: () => void
  ): void;
  mostrarRecuento(recuento: RecuentoTurno, alTerminar: () => void): void;
  dispose(): void;
}

export function crearPanelesTurno(scene: Scene): PanelesTurno {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("panelesTurnoSupermercado", true, scene);
  // Fuera del post-proceso, por lo mismo que el libro: la interfaz no es parte
  // de la escena y no tiene por qué verse a través de la cámara.
  if (gui.layer) gui.layer.applyPostProcess = false;
  afinarGui(gui);

  let capa: Rectangle | null = null;

  /**
   * Retira la tarjeta con un fundido.
   *
   * Nunca se destruye en el mismo clic que la cierra: deshacer la capa que
   * está repartiendo ese clic deja el puntero tomado (ver main.ts).
   */
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

  function armarCapa(nombre: string, alto: number, colorFilete: string): { tarjeta: Rectangle; columna: StackPanel } {
    retirarCapa();

    const velo = crearVelo(gui, `velo${nombre}`);
    const tarjeta = crearTarjeta(velo, `tarjeta${nombre}`, ANCHO_TARJETA, alto);
    tarjeta.cornerRadius = 18;
    tarjeta.shadowColor = "rgba(0,0,0,0.45)";
    tarjeta.shadowBlur = 28;
    tarjeta.shadowOffsetY = 10;
    const filete = crearFilete(tarjeta, `filete${nombre}`, ANCHO_TARJETA - 72, colorFilete);
    filete.cornerRadius = 2;

    const columna = new StackPanel(`columna${nombre}`);
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.left = MARGEN + "px";
    columna.top = "28px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);

    capa = velo;
    desvanecer(velo, 0, 1, 160);
    return { tarjeta, columna };
  }

  /**
   * Encoge la tarjeta hasta lo que de verdad ocupó su texto.
   *
   * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
   *
   * Porque el alto se calcula ANTES de dibujar, con altoDeTexto, y altoDeTexto
   * estima los renglones por el número de caracteres con un ancho de letra
   * deliberadamente ancho: prefiere sobrar a cortar, y hace bien, porque un
   * párrafo cortado por abajo se pierde entero.
   *
   * En una tarjeta con muchos campos de alto fijo —el briefing, el recuento—
   * eso se diluye. En esta, donde casi todo el alto es un solo párrafo, dos
   * renglones de más son una banda vacía de cien píxeles entre la explicación
   * y el botón, y la tarjeta parece rota.
   *
   * ─── POR QUÉ SOLO ENCOGE ──────────────────────────────────────────────────
   *
   * Porque encoger a la medida de lo ya dibujado no puede cortar nada: el alto
   * al que se ajusta ES el que la columna ocupó. Si la cuenta previa se hubiera
   * quedado corta, esto no la agranda — y no debe, porque entonces el texto ya
   * estaría recortado y estirar la tarjeta después se vería como un salto.
   */
  function ajustarAlContenido(tarjeta: Rectangle, columna: StackPanel, pie: number): void {
    scene.onAfterRenderObservable.addOnce(() => {
      // La escena pudo cerrarse en ese cuadro: salir del nivel con una tarjeta
      // abierta deja este aviso apuntando a controles ya destruidos.
      if (!tarjeta.parent || tarjeta.heightInPixels <= 0) return;
      const necesario = columna.topInPixels + columna.heightInPixels + pie;
      if (necesario > 0 && necesario < tarjeta.heightInPixels) {
        tarjeta.height = Math.round(necesario) + "px";
      }
    });
  }

  function botonAbajo(tarjeta: Rectangle, nombre: string, texto: string, alPulsar: () => void): void {
    const boton = crearBotonTurno(nombre, texto, 220, "principal");
    boton.left = -MARGEN + "px";
    boton.top = "-24px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(boton);

    // Una sola vez: un doble clic arrancaría el turno dos veces.
    let pulsado = false;
    boton.onPointerUpObservable.add(() => {
      if (pulsado) return;
      pulsado = true;
      retirarCapa();
      alPulsar();
    });
  }

  /**
   * Por qué era o por qué no era, después de haber elegido.
   *
   * ─── POR QUÉ EN OTRA TARJETA Y NO DEBAJO DE LA OPCIÓN ────────────────────
   *
   * Porque desplegar la explicación bajo el botón elegido deja las otras dos
   * a la vista, y con ellas a la vista lo que se lee es una comparación: "ah,
   * entonces la buena era la B". Lo que tiene que quedar es qué criterio se
   * aplicó, no cuál de las tres casillas era.
   *
   * En tarjeta aparte, además, el rótulo puede decirlo en una palabra y con
   * color —CORRECTO o NO CORRESPONDE—, que es lo mismo que hace el libro del
   * condominio con las respuestas de radio. Son el mismo ejercicio.
   */
  function mostrarRespuesta(opcion: OpcionSituacion, alCerrar: () => void): void {
    const color = opcion.correcta ? PALETA.acierto : PALETA.error;
    const alto =
      MARCO_VERTICAL +
      28 +
      altoDeTexto(opcion.texto, ANCHO_CONTENIDO, TEXTO.destacado) +
      35 +
      altoDeTexto(opcion.explicacion, ANCHO_CONTENIDO, TEXTO.cuerpo);
    const { tarjeta, columna } = armarCapa("Respuesta", alto, color);

    columna.addControl(
      crearRotulo("rotuloRespuesta", opcion.correcta ? "CORRECTO" : "NO CORRESPONDE", color)
    );
    columna.addControl(crearEspacio("aireRotuloRespuesta", 10));
    // Lo que hiciste, repetido. Al cerrar la tarjeta anterior el botón elegido
    // desaparece, y sin esto la explicación quedaría hablando de algo que ya
    // no está en pantalla.
    columna.addControl(
      crearParrafo(
        "elegidaRespuesta",
        opcion.texto,
        ANCHO_CONTENIDO,
        TEXTO.destacado,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorRespuesta", 18));
    columna.addControl(crearDivisor("divisorRespuesta", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorRespuesta", 16));
    columna.addControl(
      crearParrafo("cuerpoRespuesta", opcion.explicacion, ANCHO_CONTENIDO, TEXTO.cuerpo)
    );

    botonAbajo(tarjeta, "btnCerrarRespuesta", "Entendido", alCerrar);
    // 94: lo que el botón necesita por debajo del texto — 24 de separación,
    // los 46 de alto que le da crearBotonTurno y los 24 hasta el borde, que es
    // donde botonAbajo lo ancla.
    ajustarAlContenido(tarjeta, columna, 94);
  }

  /**
   * La segunda tarjeta del recuento: cada situación del turno y cómo acabó.
   *
   * ─── POR QUÉ UNA TARJETA APARTE ─────────────────────────────────────────
   *
   * Porque son dos cosas que se leen distinto. Las rondas son una franja que
   * se entiende de un vistazo; las situaciones son una lista que hay que leer
   * renglón a renglón para ver dónde se acertó y dónde no. Juntas no caben en
   * una pantalla sin apretar la letra, y apretada no se lee ninguna.
   */
  function mostrarSituacionesTurno(recuento: RecuentoTurno, alTerminar: () => void): void {
    const filas = recuento.situaciones;
    const cuentan = filas.filter((f) => !(f.inocente && f.resultado === "perdida"));
    const bien = cuentan.filter((f) => f.resultado === "correcta").length;
    const perdidas = filas.filter((f) => f.resultado === "perdida" && !f.inocente).length;
    const cifra = `${bien} de ${cuentan.length} situaciones bien resueltas`;
    const detalle =
      perdidas === 0
        ? "No se te pasó ninguna de las que importaban."
        : perdidas === 1
          ? "Una pasó sin que la vieras."
          : `${perdidas} pasaron sin que las vieras.`;

    const ALTO_FILA = 30;
    const alto =
      MARCO_VERTICAL +
      28 +
      altoDeTexto(cifra, ANCHO_CONTENIDO, TEXTO.mayor) +
      4 +
      altoDeTexto(detalle, ANCHO_CONTENIDO, TEXTO.menor) +
      37 +
      filas.length * ALTO_FILA +
      18 +
      altoDeTexto(recuento.notaSituaciones, ANCHO_CONTENIDO, TEXTO.menor);
    const { tarjeta, columna } = armarCapa("RecuentoSituaciones", alto, PALETA.dato);

    columna.addControl(crearRotulo("rotuloRecuentoSituaciones", "SITUACIONES DEL TURNO"));
    columna.addControl(crearEspacio("aireRotuloRecuentoSituaciones", 10));
    columna.addControl(
      crearParrafo("cifraRecuentoSituaciones", cifra, ANCHO_CONTENIDO, TEXTO.mayor, PALETA.titulo, "600")
    );
    columna.addControl(crearEspacio("aireCifraRecuentoSituaciones", 4));
    columna.addControl(
      crearParrafo(
        "detalleRecuentoSituaciones",
        detalle,
        ANCHO_CONTENIDO,
        TEXTO.menor,
        perdidas === 0 ? PALETA.acierto : PALETA.tenue
      )
    );
    columna.addControl(crearEspacio("aireDivisorRecuentoSituaciones", 18));
    columna.addControl(crearDivisor("divisorRecuentoSituaciones", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorRecuentoSituaciones", 18));

    filas.forEach((f, i) => {
      const [texto, color] =
        f.resultado === "correcta"
          ? ["Bien resuelta", PALETA.acierto]
          : f.resultado === "incorrecta"
            ? ["No correspondía", PALETA.error]
            : f.inocente
              ? ["No la viste · no era nada", PALETA.tenue]
              : ["No la viste · pasó igual", PALETA.error];
      const fila = new Rectangle(`filaSituacion_${i}`);
      fila.width = ANCHO_CONTENIDO + "px";
      fila.height = ALTO_FILA + "px";
      fila.thickness = 0;
      fila.isHitTestVisible = false;

      const hora = new TextBlock(`horaSituacion_${i}`, f.hora);
      hora.color = PALETA.tenue;
      hora.fontSize = TEXTO.menor;
      hora.fontWeight = "600";
      hora.fontFamily = MONO;
      hora.width = "70px";
      hora.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      hora.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      hora.isHitTestVisible = false;
      fila.addControl(hora);

      const que = crearParrafo(`queSituacion_${i}`, f.actividad, 400, TEXTO.menor, PALETA.cuerpo, "600");
      que.left = "80px";
      que.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fila.addControl(que);

      const como = new TextBlock(`resultadoSituacion_${i}`, texto);
      como.color = color;
      como.fontSize = TEXTO.menor;
      como.fontWeight = "600";
      como.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      como.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      como.isHitTestVisible = false;
      fila.addControl(como);

      columna.addControl(fila);
    });

    columna.addControl(crearEspacio("aireNotaRecuentoSituaciones", 18));
    columna.addControl(
      crearParrafo("notaRecuentoSituaciones", recuento.notaSituaciones, ANCHO_CONTENIDO, TEXTO.menor, PALETA.tenue)
    );

    botonAbajo(tarjeta, "btnTerminarTurno", "Terminar el turno", alTerminar);
    // Las filas y la nota se estiman por lo alto; se encoge a lo que ocuparon.
    ajustarAlContenido(tarjeta, columna, 94);
  }

  /** Una fila de la cabecera, igual que las de la apertura del libro. */
  function campo(nombre: string, rotulo: string, valor: string): Rectangle {
    const fila = new Rectangle(`fila${nombre}`);
    fila.width = ANCHO_CONTENIDO + "px";
    fila.height = ALTO_CAMPO + "px";
    fila.thickness = 0;
    fila.isHitTestVisible = false;

    const etiqueta = crearParrafo(`etiqueta${nombre}`, rotulo, 200, TEXTO.rotulo, PALETA.rotulo, "600");
    etiqueta.top = "3px";
    etiqueta.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fila.addControl(etiqueta);

    const dato = crearParrafo(`valor${nombre}`, valor, ANCHO_CONTENIDO - 220, TEXTO.menor, PALETA.cuerpo);
    dato.left = "220px";
    dato.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fila.addControl(dato);
    return fila;
  }

  return {
    mostrarBriefing(briefing, alComenzar) {
      const alto =
        MARCO_VERTICAL +
        28 +
        altoDeTexto(briefing.titulo, ANCHO_CONTENIDO, TEXTO.titulo) +
        35 +
        briefing.campos.length * ALTO_CAMPO +
        16 +
        altoDeTexto(briefing.nota, ANCHO_CONTENIDO, TEXTO.menor);
      const { tarjeta, columna } = armarCapa("Briefing", alto, PALETA.dato);

      columna.addControl(crearRotulo("rotuloBriefing", briefing.rotulo));
      columna.addControl(crearEspacio("aireRotuloBriefing", 10));
      columna.addControl(
        crearParrafo("tituloBriefing", briefing.titulo, ANCHO_CONTENIDO, TEXTO.titulo, PALETA.titulo, "600")
      );
      columna.addControl(crearEspacio("aireDivisorBriefing", 18));
      columna.addControl(crearDivisor("divisorBriefing", ANCHO_CONTENIDO));
      columna.addControl(crearEspacio("airePostDivisorBriefing", 16));
      briefing.campos.forEach(([rotulo, valor], i) => columna.addControl(campo(`Briefing_${i}`, rotulo, valor)));
      columna.addControl(crearEspacio("aireNotaBriefing", 16));
      columna.addControl(crearParrafo("notaBriefing", briefing.nota, ANCHO_CONTENIDO, TEXTO.menor, PALETA.tenue));

      botonAbajo(tarjeta, "btnComenzarTurno", briefing.boton, alComenzar);
    },

    mostrarSituacion(situacion, alElegir, alCerrar) {
      // La cuenta del alto es la MISMA que crearBotonOpcion hace por dentro
      // (sangría 62 + 20 de aire, mínimo 60, más 30 de relleno). Si las dos se
      // separan, o la tarjeta corta la última opción —y entonces hay una
      // respuesta que no se puede elegir— o queda un hueco muerto abajo.
      const ANCHO_ETIQUETA = ANCHO_CONTENIDO - 82;
      const altoAviso = altoDeTexto(situacion.aviso, ANCHO_CONTENIDO, TEXTO.destacado);
      const altoOpciones = situacion.opciones.reduce(
        (suma, o) => suma + Math.max(60, altoDeTexto(o.texto, ANCHO_ETIQUETA, TEXTO.destacado) + 30),
        0
      );
      const separaciones = (situacion.opciones.length - 1) * 10;
      // Aire de arriba, rótulo, aire, aviso, aire, divisor y aire: lo que va
      // antes de la primera opción.
      const altoCabecera = 28 + 18 + 10 + altoAviso + 18 + 1 + 16;
      const PIE = 27;

      // Sin botonera abajo: de esta tarjeta se sale eligiendo. Lo que estás
      // viendo ya está ocurriendo y no hay un "cerrar" que sea neutral —
      // quedarse mirando también es una de las tres respuestas, y está en la
      // lista.
      const { tarjeta, columna } = armarCapa(
        "Situacion",
        altoCabecera + altoOpciones + separaciones + PIE,
        // Ámbar y no azul: el briefing y el recuento informan, esto interrumpe.
        // Con el mismo filete que las otras dos, un panel que exige decidir se
        // leería igual que uno que solo hay que cerrar.
        PALETA.aviso
      );

      columna.addControl(crearRotulo("rotuloSituacion", situacion.rotulo, PALETA.aviso));
      columna.addControl(crearEspacio("aireRotuloSituacion", 10));
      columna.addControl(
        crearParrafo(
          "avisoSituacion",
          situacion.aviso,
          ANCHO_CONTENIDO,
          TEXTO.destacado,
          PALETA.titulo,
          "600"
        )
      );
      columna.addControl(crearEspacio("aireDivisorSituacion", 18));
      columna.addControl(crearDivisor("divisorSituacion", ANCHO_CONTENIDO));
      columna.addControl(crearEspacio("airePostDivisorSituacion", 16));

      let yaElegida = false;
      situacion.opciones.forEach((opcion, i) => {
        const boton = crearBotonOpcion(`btnSituacion_${i}`, opcion.texto, ANCHO_CONTENIDO);
        boton.onPointerUpObservable.add(() => {
          // Una sola vez: dos clics seguidos sobre opciones distintas dejarían
          // la explicación de una sobre la respuesta de la otra.
          if (yaElegida) return;
          yaElegida = true;
          alElegir(opcion);
          mostrarRespuesta(opcion, alCerrar);
        });
        columna.addControl(boton);
        // La letra va DESPUÉS de agregar el botón: antes de estar en el árbol
        // sus controles hijos todavía no se pueden buscar por nombre.
        rotularOpcion(boton, String.fromCharCode(65 + i));
        if (i < situacion.opciones.length - 1) {
          columna.addControl(crearEspacio(`aireOpcionSituacion_${i}`, 10));
        }
      });

      // Por lo mismo que la tarjeta de la respuesta: el aviso puede ocupar un
      // renglón menos de los que la cuenta previa reservó. Aquí el pie es solo
      // el aire de debajo de la última opción, que no lleva botón.
      ajustarAlContenido(tarjeta, columna, PIE);
    },

    mostrarRecuento(recuento, alTerminar) {
      const total = recuento.rondas.length;
      const completas = recuento.rondas.filter((ronda) => ronda.completa).length;
      const incompletas = total - completas;

      const cifra = `${completas} de ${total} rondas completas`;
      const detalle =
        incompletas === 0
          ? "Ninguna ronda quedó a medias."
          : incompletas === 1
            ? "1 ronda incompleta."
            : `${incompletas} rondas incompletas.`;

      const ALTO_FRANJA = 28;
      const alto =
        MARCO_VERTICAL +
        28 +
        altoDeTexto(cifra, ANCHO_CONTENIDO, TEXTO.mayor) +
        4 +
        altoDeTexto(detalle, ANCHO_CONTENIDO, TEXTO.menor) +
        37 +
        30 +
        ALTO_FRANJA +
        26 +
        18 +
        altoDeTexto(recuento.nota, ANCHO_CONTENIDO, TEXTO.menor);
      // Sin nota todavía: el filete no aprueba ni reprueba, informa.
      const { tarjeta, columna } = armarCapa("Recuento", alto, PALETA.dato);

      columna.addControl(crearRotulo("rotuloRecuento", recuento.rotulo));
      columna.addControl(crearEspacio("aireRotuloRecuento", 10));
      columna.addControl(crearParrafo("cifraRecuento", cifra, ANCHO_CONTENIDO, TEXTO.mayor, PALETA.titulo, "600"));
      columna.addControl(crearEspacio("aireCifraRecuento", 4));
      columna.addControl(
        crearParrafo(
          "detalleRecuento",
          detalle,
          ANCHO_CONTENIDO,
          TEXTO.menor,
          incompletas === 0 ? PALETA.acierto : PALETA.tenue
        )
      );
      columna.addControl(crearEspacio("aireDivisorRecuento", 18));
      columna.addControl(crearDivisor("divisorRecuento", ANCHO_CONTENIDO));
      columna.addControl(crearEspacio("airePostDivisorRecuento", 18));
      columna.addControl(crearRotulo("rotuloFranjaRecuento", "RONDA A RONDA"));
      columna.addControl(crearEspacio("aireFranjaRecuento", 12));

      // La franja: una marca por ronda, en orden de hora. Se ve de un vistazo
      // cuándo se cumplió y cuándo no, sin convertirlo en nota.
      const franja = new StackPanel("franjaRecuento");
      franja.isVertical = false;
      franja.width = ANCHO_CONTENIDO + "px";
      franja.height = ALTO_FRANJA + "px";
      franja.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      const HUECO = 4;
      const anchoMarca = total > 0 ? Math.floor((ANCHO_CONTENIDO - HUECO * (total - 1)) / total) : 0;
      recuento.rondas.forEach((ronda, i) => {
        const ultima = i === total - 1;
        const marca = new Rectangle(`marcaRonda_${ronda.numero}`);
        // El hueco va como relleno de la propia marca: el fondo no lo pinta.
        marca.width = anchoMarca + (ultima ? 0 : HUECO) + "px";
        marca.paddingRight = ultima ? "0px" : HUECO + "px";
        marca.height = ALTO_FRANJA + "px";
        marca.thickness = 0;
        marca.cornerRadius = 5;
        marca.background = conAlfa(ronda.completa ? PALETA.acierto : PALETA.error, 0.85);
        marca.isHitTestVisible = false;
        franja.addControl(marca);
      });
      columna.addControl(franja);
      columna.addControl(crearEspacio("aireHorasRecuento", 6));

      const horas = new Rectangle("horasRecuento");
      horas.width = ANCHO_CONTENIDO + "px";
      horas.height = "20px";
      horas.thickness = 0;
      horas.isHitTestVisible = false;
      const alineaciones = [
        Control.HORIZONTAL_ALIGNMENT_LEFT,
        Control.HORIZONTAL_ALIGNMENT_CENTER,
        Control.HORIZONTAL_ALIGNMENT_RIGHT,
      ];
      recuento.horas.forEach((hora, i) => {
        const texto = new TextBlock(`horaRecuento_${i}`, hora);
        texto.color = PALETA.tenue;
        texto.fontSize = TEXTO.rotulo;
        texto.fontWeight = "600";
        texto.fontFamily = MONO;
        texto.textHorizontalAlignment = alineaciones[i];
        texto.isHitTestVisible = false;
        horas.addControl(texto);
      });
      columna.addControl(horas);
      columna.addControl(crearEspacio("aireNotaRecuento", 18));
      columna.addControl(crearParrafo("notaRecuento", recuento.nota, ANCHO_CONTENIDO, TEXTO.menor, PALETA.tenue));

      if (recuento.situaciones.length === 0) {
        botonAbajo(tarjeta, "btnTerminarTurno", "Terminar el turno", alTerminar);
        return;
      }
      botonAbajo(tarjeta, "btnVerSituaciones", "Ver las situaciones", () =>
        // Un tick después: la capa que se retira todavía está repartiendo
        // este clic (ver retirarCapa).
        setTimeout(() => mostrarSituacionesTurno(recuento, alTerminar), 0)
      );
    },

    dispose() {
      // Un tick después y no en el acto: "Terminar el turno" sale al menú
      // desde su propio clic, y deshacer la capa que reparte ese clic deja el
      // puntero tomado y el menú sin responder (ver main.ts).
      setTimeout(() => gui.dispose(), 0);
    },
  };
}
