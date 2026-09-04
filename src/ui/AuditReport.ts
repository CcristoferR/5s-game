import { AdvancedDynamicTexture, Rectangle, StackPanel, ScrollViewer, Control } from "@babylonjs/gui";
import type { PuntoControlNivel5 } from "../data/levelConfig";
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
  crearBotonPrincipal,
  altoDeTexto,
  desvanecer,
} from "./EstiloUI";

export interface FilaInforme {
  datos: PuntoControlNivel5;
  marcadoPorJugador: boolean;
}

const ANCHO_TARJETA = 720;
const ALTO_TARJETA = 560;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;

/**
 * Informe punto por punto de la auditoría del Nivel 5.
 *
 * Comparte lenguaje visual con la tarjeta de apertura y con el panel de
 * preguntas: mismo velo, misma tarjeta, mismos rótulos y la misma escala de
 * texto. Antes tenía su propia paleta y letras de 12 px, y se leía como una
 * pantalla ajena al resto del juego.
 */
export function mostrarInformeAuditoria(
  gui: AdvancedDynamicTexture,
  filas: FilaInforme[],
  onCerrar: () => void
): void {
  const aciertos = filas.filter((fila) => fila.marcadoPorJugador === fila.datos.tieneDesviacion).length;

  const velo = crearVelo(gui, "veloInforme");
  const tarjeta = crearTarjeta(velo, "tarjetaInforme", ANCHO_TARJETA, ALTO_TARJETA);
  crearFilete(tarjeta, "fileteInforme", ANCHO_TARJETA, PALETA.dato);

  // --- Encabezado ---
  const encabezado = new StackPanel("encabezadoInforme");
  encabezado.isVertical = true;
  encabezado.width = ANCHO_CONTENIDO + "px";
  encabezado.left = MARGEN + "px";
  encabezado.top = "32px";
  encabezado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  encabezado.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(encabezado);

  encabezado.addControl(crearRotulo("rotuloInforme", "INFORME DE AUDITORÍA"));
  encabezado.addControl(crearEspacio("aireRotuloInforme", 10));
  encabezado.addControl(
    crearParrafo(
      "tituloInforme",
      `Detectaste ${aciertos} de ${filas.length} puntos de control`,
      ANCHO_CONTENIDO,
      TEXTO.titulo,
      PALETA.titulo,
      "600"
    )
  );
  encabezado.addControl(crearEspacio("aireDivisorInforme", 18));
  encabezado.addControl(crearDivisor("divisorInforme", ANCHO_CONTENIDO));

  // --- Lista ---
  const scroll = new ScrollViewer("scrollInforme");
  scroll.width = ANCHO_CONTENIDO + 12 + "px";
  scroll.height = ALTO_TARJETA - 236 + "px";
  scroll.thickness = 0;
  scroll.barColor = PALETA.tenue;
  scroll.barBackground = PALETA.tarjetaSuave;
  scroll.thickness = 0;
  scroll.barBackground = "rgba(255,255,255,0.05)";
  scroll.left = MARGEN + "px";
  scroll.top = "152px";
  scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(scroll);

  const lista = new StackPanel("listaInforme");
  lista.isVertical = true;
  lista.width = ANCHO_CONTENIDO + "px";
  scroll.addControl(lista);

  filas.forEach((fila) => {
    // DOS SEÑALES, NO UNA.
    //
    // Antes la fila tenía un solo color y significaba "acertaste o no". El
    // problema es que decía "Lo detectaste bien" en verde justo al lado de
    // "calificación real 1/5", y eso se lee como una contradicción: verde con
    // un uno. Son dos cosas distintas y hay que verlas por separado —cómo te
    // fue a TI, y en qué estado está EL PUNTO— porque un punto en mal estado
    // detectado a tiempo es un acierto, no un problema.
    //
    // Tu resultado va en la franja lateral y el tinte del fondo. El estado del
    // punto va en una insignia a la derecha, con su propio color.
    const acerto = fila.marcadoPorJugador === fila.datos.tieneDesviacion;
    const color = acerto ? PALETA.acierto : PALETA.error;
    const hayDesviacion = fila.datos.tieneDesviacion;

    const anchoTextoFila = ANCHO_CONTENIDO - 60;
    // El ancho del texto descuenta la insignia: sin esto el título pasaba por
    // debajo de ella y quedaba tapado en las descripciones largas.
    const anchoTitulo = anchoTextoFila;

    const alto =
      altoDeTexto(fila.datos.descripcionControl, anchoTitulo, TEXTO.cuerpo) +
      altoDeTexto(fila.datos.explicacion, anchoTextoFila, TEXTO.menor) +
      26 +
      46;

    const marco = new Rectangle(`filaInforme_${fila.datos.id}`);
    marco.width = ANCHO_CONTENIDO + "px";
    marco.height = alto + "px";
    marco.thickness = 0;
    marco.cornerRadius = 10;
    // Tinte según TU resultado. Muy suave: la lista se recorre leyendo, el
    // color solo tiene que agrupar de un vistazo cuáles fallaste.
    marco.background = acerto ? "rgba(127,180,149,0.09)" : "rgba(201,141,128,0.11)";
    marco.paddingBottom = "10px";
    lista.addControl(marco);

    const franja = new Rectangle(`franjaInforme_${fila.datos.id}`);
    franja.width = "4px";
    franja.height = alto - 10 + "px";
    franja.thickness = 0;
    franja.background = color;
    franja.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    franja.isHitTestVisible = false;
    marco.addControl(franja);

    // SIN INSIGNIA DE ESTADO.
    //
    // Decía "DESVIACIÓN" o "CUMPLE" al lado de un renglón que ya dice
    // "Detectaste la desviación" o "Bien: no había nada que reportar". Son el
    // mismo dato contado dos veces y con palabras distintas, y eso siembra la
    // duda de si se contradicen: un ámbar que dice DESVIACIÓN junto a un tilde
    // verde parece un error aunque signifiquen lo mismo.
    //
    // El renglón del veredicto ya dice las dos cosas que hacen falta: qué
    // había y si el auditor lo vio.

    const columna = new StackPanel(`columnaInforme_${fila.datos.id}`);
    columna.isVertical = true;
    columna.width = anchoTextoFila + "px";
    columna.left = "22px";
    columna.top = "14px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    marco.addControl(columna);

    columna.addControl(
      crearParrafo(
        `tituloFila_${fila.datos.id}`,
        fila.datos.descripcionControl,
        anchoTitulo,
        TEXTO.cuerpo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio(`aireMedioFila_${fila.datos.id}`, 6));

    // Tu resultado, con símbolo delante. El símbolo se reconoce sin leer y sin
    // depender del color: quien no distinga verde de rojo cuenta igual.
    columna.addControl(
      crearParrafo(
        `estadoFila_${fila.datos.id}`,
        // CUATRO casos, no dos.
        //
        // "Lo detectaste" y "Se te pasó" venían de cuando lo único evaluable
        // era encontrar desvíos. Ahora el jugador también dictamina sobre
        // puntos que CUMPLEN, y ahí esos dos textos mienten: declarar
        // correctamente que algo está bien no es "detectar" nada, y reportar
        // una falta inexistente no es que "se te pasara" — es lo contrario.
        hayDesviacion
          ? acerto
            ? "\u2713  Detectaste la desviación"
            : "\u2715  Se te pasó esta desviación"
          : acerto
            ? "\u2713  Bien: no había nada que reportar"
            : "\u2715  Reportaste una falta que no existía",
        anchoTextoFila,
        TEXTO.menor,
        color,
        "700"
      )
    );
    columna.addControl(crearEspacio(`aireExplFila_${fila.datos.id}`, 6));
    columna.addControl(
      crearParrafo(`explicacionFila_${fila.datos.id}`, fila.datos.explicacion, anchoTextoFila, TEXTO.menor)
    );
  });

  // --- Pie ---
  tarjeta.addControl(pieDivisor());

  const boton = crearBotonPrincipal("btnCerrarInforme", "Ver resultado", 190);
  boton.left = -MARGEN + "px";
  boton.top = "-20px";
  boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    velo.isPointerBlocker = false;
    velo.isVisible = false;
    setTimeout(() => {
      try {
        velo.dispose();
      } catch {
        /* la escena ya se recreó y se llevó el control */
      }
    }, 0);
    onCerrar();
  });
  tarjeta.addControl(boton);

  desvanecer(velo, 0, 1, 160);

  function pieDivisor(): Rectangle {
    const linea = crearDivisor("divisorPieInforme", ANCHO_CONTENIDO);
    linea.left = MARGEN + "px";
    linea.top = "-84px";
    linea.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    linea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    return linea;
  }
}