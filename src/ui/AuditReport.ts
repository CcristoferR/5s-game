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
  scroll.barColor = "rgba(255,255,255,0.28)";
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
    const acerto = fila.marcadoPorJugador === fila.datos.tieneDesviacion;
    const color = acerto ? PALETA.acierto : PALETA.error;

    // ALTO DE LA FILA
    //
    // Se calcula a partir del texto en vez de dejárselo a adaptHeightToChildren.
    // Esa opción entra en dependencia circular acá: la fila le pregunta su alto
    // a los hijos, y la franja de color se lo pregunta a la fila — el resultado
    // es alto cero y el informe aparece completamente vacío.
    const anchoTextoFila = ANCHO_CONTENIDO - 60;
    const alto = altoDeFila(fila.datos.explicacion, anchoTextoFila);

    const marco = new Rectangle(`filaInforme_${fila.datos.id}`);
    marco.width = ANCHO_CONTENIDO + "px";
    marco.height = alto + "px";
    marco.thickness = 0;
    marco.cornerRadius = 10;
    marco.background = PALETA.tarjetaSuave;
    marco.paddingBottom = "10px";
    lista.addControl(marco);

    // Franja de color al costado en lugar de teñir el fondo entero: se ve el
    // resultado de un vistazo sin que el color compita con el texto.
    const franja = new Rectangle(`franjaInforme_${fila.datos.id}`);
    franja.width = "4px";
    franja.height = alto - 10 + "px";
    franja.thickness = 0;
    franja.background = color;
    franja.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    franja.isHitTestVisible = false;
    marco.addControl(franja);

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
        anchoTextoFila,
        TEXTO.cuerpo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio(`aireMedioFila_${fila.datos.id}`, 6));
    columna.addControl(
      crearParrafo(
        `estadoFila_${fila.datos.id}`,
        acerto
          ? `Lo detectaste bien · calificación real ${fila.datos.calificacion}/5`
          : `Se te pasó · calificación real ${fila.datos.calificacion}/5`,
        anchoTextoFila,
        TEXTO.menor,
        color,
        "600"
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

/**
 * Alto que necesita una fila del informe, en píxeles.
 *
 * Estima cuántos renglones ocupa la explicación y suma el título, el estado y
 * los márgenes. Es una estimación deliberadamente generosa: que sobren unos
 * píxeles no se nota, pero que falten uno corta la última línea.
 */
function altoDeFila(explicacion: string, anchoDisponible: number): number {
  // A 16 px, cada carácter ocupa alrededor de 8 px de ancho promedio.
  const caracteresPorRenglon = Math.max(20, Math.floor(anchoDisponible / 8));
  const renglones = Math.max(1, Math.ceil(explicacion.length / caracteresPorRenglon));

  const ALTO_TITULO = 26;
  const ALTO_ESTADO = 22;
  const ALTO_RENGLON = 22;
  const MARGENES = 46;

  return ALTO_TITULO + ALTO_ESTADO + renglones * ALTO_RENGLON + MARGENES;
}