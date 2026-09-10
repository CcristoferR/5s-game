import { Scene, DynamicTexture, Texture, PBRMaterial, Color3 } from "@babylonjs/core";
import type { EstadoLibro, EntradaLibro } from "./LibroNovedades";

// ===========================================================================
// Las hojas del libro de novedades
// ===========================================================================
//
// Hasta ahora el libro de la escena era atrezo: dos páginas con el rayado
// impreso, siempre iguales, y lo escrito vivía en un panel de interfaz que se
// abría encima y tapaba la mesa entera.
//
// Esto lo da vuelta. El rayado sigue siendo el del manual —HORA, ACTIVIDAD,
// OBSERVACIONES— pero encima se escriben las constancias de verdad, con su
// correlativo y sus rayas de cierre. El panel deja de ser el libro y pasa a
// ser solo lo que hace falta para decidir; el libro es el libro, sobre el
// mesón, y para leerlo hay que acercarse a él.
//
// ─── POR QUÉ SE DIBUJA EL FINAL Y NO EL PRINCIPIO ─────────────────────────
//
// Un turno completo no cabe en dos carillas: entre la apertura, cuatro o cinco
// novedades, la fiscalización y la entrega salen más renglones de los que hay.
// En vez de encoger la letra hasta que no se lea, se muestran los ÚLTIMOS
// renglones — que es lo que se ve en un libro real mientras se escribe en él:
// la plana por la que se va, no la primera.

/** Medidas de la carilla. Son las del rayado que ya tenía la página. */
const ANCHO = 380;
const ALTO = 490;
/** Densidad de dibujo. La letra de un libro se mira de cerca. */
const DENSIDAD = 3;

/** Donde caen las tres columnas del manual. */
const MARGEN = 10;
const COL_HORA = 62;
const COL_ACTIVIDAD = 172;

/** Primer renglón, bajo la cabecera de columnas. */
const Y_PRIMERO = 44;
const ALTO_RENGLON = 21;
const RENGLONES = Math.floor((ALTO - MARGEN - Y_PRIMERO) / ALTO_RENGLON);

/** Un renglón ya resuelto: qué va en cada columna y con qué aspecto. */
interface Renglon {
  hora: string;
  actividad: string;
  texto: string;
  anulada: boolean;
  /** Raya de cierre de párrafo (===== n =====), que no lleva columnas. */
  cierre: boolean;
}

export interface PaginasLibro {
  /** Material de una carilla. -1 izquierda, 1 derecha. */
  material(lado: number): PBRMaterial;
  /** Vuelve a escribir las dos carillas con el estado actual. */
  pintar(estado: EstadoLibro): void;
}

export function crearPaginasLibro(scene: Scene): PaginasLibro {
  const hojas = [-1, 1].map((lado) => {
    const textura = new DynamicTexture(
      `texPaginaLibro_${lado}`,
      { width: ANCHO * DENSIDAD, height: ALTO * DENSIDAD },
      scene,
      true
    );
    textura.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    textura.anisotropicFilteringLevel = 16;

    const material = new PBRMaterial(`matPaginaLibro_${lado}`, scene);
    material.albedoTexture = textura;
    material.roughness = 0.92;
    material.metallic = 0;
    // El papel no devuelve la luz del flexo como una chapa: sin bajar el
    // reflejo, la hoja iluminada de canto se ve como plástico.
    material.reflectivityColor = new Color3(0.04, 0.04, 0.04);
    material.backFaceCulling = false;

    return { lado, textura, material };
  });

  function pintarCarilla(
    textura: DynamicTexture,
    renglones: Renglon[],
    numeroDeCarilla: number
  ): void {
    const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
    ctx.save();
    ctx.scale(DENSIDAD, DENSIDAD);

    dibujarPapel(ctx);
    dibujarRayado(ctx);

    ctx.textBaseline = "alphabetic";
    renglones.forEach((renglon, i) => {
      const y = Y_PRIMERO + i * ALTO_RENGLON + ALTO_RENGLON - 6;

      if (renglon.cierre) {
        // La raya de cierre cruza la caja de observaciones y nada más: en el
        // manual separa párrafos, no es una constancia con hora.
        ctx.fillStyle = "rgba(43, 52, 64, 0.6)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          renglon.texto,
          MARGEN + COL_ACTIVIDAD + (ANCHO - 2 * MARGEN - COL_ACTIVIDAD) / 2,
          y
        );
        return;
      }

      // Tinta azul de bolígrafo, no negro. Y más pálida en lo anulado, que es
      // lo que hace que se distinga de un vistazo sin tener que leerlo.
      ctx.fillStyle = renglon.anulada ? "rgba(46, 58, 96, 0.42)" : "#26325c";
      ctx.font = "12px 'Segoe UI', system-ui, sans-serif";

      if (renglon.hora) {
        ctx.textAlign = "center";
        ctx.fillText(renglon.hora, MARGEN + COL_HORA / 2, y);
      }
      if (renglon.actividad) {
        ctx.textAlign = "center";
        ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(
          renglon.actividad,
          MARGEN + COL_HORA + (COL_ACTIVIDAD - COL_HORA) / 2,
          y
        );
        ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
      }
      ctx.textAlign = "left";
      ctx.fillText(renglon.texto, MARGEN + COL_ACTIVIDAD + 6, y);

      // La anulada va tachada: el manual pide que lo errado siga a la vista.
      if (renglon.anulada && renglon.texto) {
        const ancho = ctx.measureText(renglon.texto).width;
        ctx.strokeStyle = "rgba(46, 58, 96, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGEN + COL_ACTIVIDAD + 6, y - 4);
        ctx.lineTo(MARGEN + COL_ACTIVIDAD + 6 + ancho, y - 4);
        ctx.stroke();
      }
    });

    // Folio, abajo al centro. Un libro foliado es un libro que no perdió hojas.
    ctx.fillStyle = "rgba(63, 74, 88, 0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(numeroDeCarilla), ANCHO / 2, ALTO - 2);

    ctx.restore();
    textura.update();
  }

  function pintar(estado: EstadoLibro): void {
    const todos = renglonesDe(estado);
    const capacidad = RENGLONES * 2;

    // Se muestra el final. Ver la nota de arriba.
    const visibles = todos.slice(Math.max(0, todos.length - capacidad));
    const carilla = Math.floor(Math.max(0, todos.length - capacidad) / capacidad) * 2;

    pintarCarilla(hojas[0].textura, visibles.slice(0, RENGLONES), carilla + 1);
    pintarCarilla(hojas[1].textura, visibles.slice(RENGLONES), carilla + 2);
  }

  // Se pinta ya, vacío: si no, el libro arranca con la textura en negro hasta
  // que se escriba la primera constancia.
  pintar({ entradas: [], faltas: [], cerrado: false, proximoParrafo: 1 } as unknown as EstadoLibro);

  return {
    material(lado) {
      return (hojas.find((h) => h.lado === lado) ?? hojas[0]).material;
    },
    pintar,
  };
}

/** Papel envejecido con sus manchas. El blanco puro se ve como plástico. */
function dibujarPapel(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#e6e0cf";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.fillStyle = "rgba(120, 96, 60, 0.05)";
  for (let i = 0; i < 60; i++) {
    ctx.fillRect(Math.random() * ANCHO, Math.random() * ALTO, 2 + Math.random() * 5, 1 + Math.random() * 2);
  }
}

/** El rayado del manual: cabecera de tres columnas y renglones. */
function dibujarRayado(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#3f4a58";
  ctx.lineWidth = 2;
  ctx.strokeRect(MARGEN, MARGEN, ANCHO - 2 * MARGEN, 34);

  ctx.fillStyle = "#2b3440";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HORA", MARGEN + COL_HORA / 2, 32);
  ctx.fillText("ACTIVIDAD", MARGEN + COL_HORA + (COL_ACTIVIDAD - COL_HORA) / 2, 32);
  ctx.fillText(
    "OBSERVACIONES",
    MARGEN + COL_ACTIVIDAD + (ANCHO - 2 * MARGEN - COL_ACTIVIDAD) / 2,
    32
  );

  ctx.strokeStyle = "rgba(63, 74, 88, 0.45)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= RENGLONES; i++) {
    const y = Y_PRIMERO + i * ALTO_RENGLON;
    ctx.beginPath();
    ctx.moveTo(MARGEN, y);
    ctx.lineTo(ANCHO - MARGEN, y);
    ctx.stroke();
  }
  [MARGEN + COL_HORA, MARGEN + COL_ACTIVIDAD].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, MARGEN);
    ctx.lineTo(x, ALTO - MARGEN);
    ctx.stroke();
  });
}

/**
 * De constancias a renglones.
 *
 * Cada entrada ocupa los renglones que necesite su redacción, y detrás va su
 * raya de cierre numerada. La hora y la actividad solo se escriben en el
 * primer renglón de la entrada, como en el libro del manual: lo que sigue es
 * continuación de la misma observación, no otra novedad.
 */
function renglonesDe(estado: EstadoLibro): Renglon[] {
  const salida: Renglon[] = [];

  (estado.entradas ?? []).forEach((entrada: EntradaLibro) => {
    const lineas = partirEnLineas(entrada.observaciones, 52);
    lineas.forEach((linea, i) => {
      salida.push({
        hora: i === 0 ? entrada.hora : "",
        actividad: i === 0 ? entrada.actividad : "",
        texto: linea,
        anulada: entrada.anulada,
        cierre: false,
      });
    });
    salida.push({
      hora: "",
      actividad: "",
      texto: `=====  ${entrada.numero}  =====`,
      anulada: false,
      cierre: true,
    });
  });

  return salida;
}

/**
 * Parte un texto en líneas de como mucho `ancho` caracteres, sin cortar
 * palabras.
 *
 * Se cuenta por caracteres y no midiendo con el contexto porque la letra es de
 * ancho casi constante a este tamaño y así el reparto se puede calcular sin
 * tener el lienzo delante — que es lo que permite saber cuántos renglones
 * ocupa el turno entero antes de empezar a dibujar.
 */
function partirEnLineas(texto: string, ancho: number): string[] {
  const palabras = (texto ?? "").split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [""];

  const lineas: string[] = [];
  let actual = "";

  palabras.forEach((palabra) => {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (tentativa.length <= ancho) {
      actual = tentativa;
      return;
    }
    if (actual) lineas.push(actual);
    actual = palabra;
  });
  if (actual) lineas.push(actual);

  return lineas;
}