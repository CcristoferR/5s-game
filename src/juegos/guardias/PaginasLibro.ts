import { Scene, DynamicTexture, Texture, PBRMaterial, Color3 } from "@babylonjs/core";
import type { EstadoLibro } from "./LibroNovedades";
import { crearAzar } from "./TexturasPBR";

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
// ─── LA CONSTANCIA SE ESCRIBE, NO APARECE ─────────────────────────────────
//
// Elegir la redacción y ver la plana ya llena era un corte: el renglón pasaba
// de no existir a existir entero entre dos cuadros. En vídeo se lee como un
// menú que se cierra, no como alguien escribiendo.
//
// Ahora lo nuevo se TRAZA. Primero la hora en su columna, después la
// actividad, después la observación renglón a renglón y al final la raya de
// cierre con su número, en el orden en que se escribe a mano. La tinta avanza
// con un borde blando del ancho de una letra —la punta del bolígrafo—, entre
// columna y columna hay la pausa de levantar la mano, y lo recién escrito sale
// un poco más oscuro y se asienta en medio segundo, como la tinta fresca.
//
// Una novedad corriente tarda segundo y medio. La apertura, que es un párrafo
// entero, se permite algo más; nada pasa de dos segundos y medio, porque el
// turno sigue corriendo y quien juega ya sabe lo que eligió.
//
// Anular también se ve: la raya cruza el renglón de izquierda a derecha y el
// texto se apaga mientras pasa.
//
// ─── SOLO CON LA CÁMARA ENCIMA ────────────────────────────────────────────
//
// Nadie escribe un libro desde la silla. Si lo nuevo llega con un panel
// delante o con la cámara sentada, las hojas ESPERAN y siguen mostrando lo de
// antes; se escribe cuando el guardia se inclina sobre ellas. Y aun inclinada,
// la primera letra espera a que la cámara termine de asentarse: trazar a mitad
// del movimiento es escribir sin mirar.
//
// ─── PLIEGOS, NO UNA TIRA QUE SUBE ────────────────────────────────────────
//
// Un turno completo no cabe en dos carillas. Antes se mostraban los últimos
// renglones y todo el texto se corría hacia arriba con cada constancia nueva,
// que no es lo que hace un libro. Ahora se llenan las dos carillas del pliego
// y la constancia que no cabe empieza en el siguiente, con su folio.

/** Medidas de la carilla, en unidades de dibujo. */
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
const POR_PLIEGO = RENGLONES * 2;

/** Cajas de escritura de las columnas de texto. */
const X_ACTIVIDAD = MARGEN + COL_HORA + 5;
const ANCHO_ACTIVIDAD = COL_ACTIVIDAD - COL_HORA - 9;
const X_TEXTO = MARGEN + COL_ACTIVIDAD + 6;
const ANCHO_TEXTO = ANCHO - MARGEN - X_TEXTO - 5;

/** Franja donde se enmascara el renglón que se está trazando. */
const ALTO_TIRA = 26;
const BASE_TIRA = 17;

/** Unidades de carilla por segundo de trazo: la velocidad de la mano. */
const VELOCIDAD = 950;
/** Pausa entre dos trazos del mismo renglón: levantar la punta. */
const LEVANTAR = 0.05;
/** Pausa al bajar al renglón siguiente. */
const LEVANTAR_RENGLON = 0.09;
/** Pausa al empezar un pliego nuevo. */
const PASAR_HOJA = 0.3;
/** De que la cámara está encima a la primera letra. */
const ACERCARSE = 0.22;
/** Límites de lo que dura escribir una constancia. */
const DURACION_MINIMA = 0.9;
const DURACION_MAXIMA = 2.4;
/** Lo que se sostiene la plana terminada antes de avisar. */
const RETENER = 0.3;
/** Lo que tarda en asentarse la tinta fresca. */
const HUMEDA = 0.45;
/** Ancho del borde blando de la tinta que avanza: más o menos una letra. */
const PLUMA = 7;

/** Azul de bolígrafo, y el mismo azul recién puesto. */
const TINTA: [number, number, number] = [30, 43, 100];
const TINTA_FRESCA: [number, number, number] = [12, 20, 72];

type Parte = "hora" | "actividad" | "texto" | "cierre" | "tachado";

/** Un renglón ya resuelto: qué va en cada columna. */
interface Renglon {
  /** Número de la constancia a la que pertenece. */
  entrada: number;
  /** Qué renglón de esa constancia es, desde 0. */
  parte: number;
  hora: string;
  actividad: string;
  texto: string;
  anulada: boolean;
  /** Raya de cierre de párrafo (===== n =====), que no lleva columnas. */
  cierre: boolean;
}

/** Un gesto de la mano: un trozo de texto, una raya de cierre o un tachado. */
interface Trazo {
  fila: number;
  parte: Parte;
  inicio: number;
  fin: number;
  /** Desde cuándo se muestra su pliego. Antes que `inicio` si hay que pasar la hoja. */
  muestraDesde: number;
}

interface Escritura {
  antes: Renglon[];
  destino: Renglon[];
  trazos: Trazo[];
  porFila: Map<number, Trazo[]>;
  nuevas: Set<number>;
  duracion: number;
  /** Segundos transcurridos desde que la cámara quedó encima. */
  t: number;
  empezada: boolean;
  /** Pliego que muestran ahora las texturas. */
  pliego: number;
  avisos: (() => void)[];
}

/** Cómo va un renglón en un instante: cuánto de cada parte está escrito. */
interface Vista {
  progreso(parte: Parte): number;
  humedad(parte: Parte): number;
  tachado: number;
}

export interface OpcionesPaginas {
  /** Si la cámara ya está sobre el libro. Mientras diga que no, la escritura espera. */
  listoParaTrazar?: () => boolean;
  /** Avisa cuando la punta toca o deja el papel, para el sonido. */
  alTrazar?: (trazando: boolean) => void;
}

export interface PaginasLibro {
  /** Material de una carilla. -1 izquierda, 1 derecha. */
  material(lado: number): PBRMaterial;
  /**
   * Pone las hojas al día con el estado del libro.
   *
   * Con `aLaVista`, lo nuevo se traza y `alTerminar` llega cuando cae la
   * última letra (o enseguida, si no había nada que escribir). Sin ella, las
   * hojas siguen como estaban hasta la próxima vez que se vean.
   */
  escribir(estado: EstadoLibro, aLaVista: boolean, alTerminar?: () => void): void;
}

const MANUSCRITAS = ["Segoe Print", "Bradley Hand", "Noteworthy", "Comic Neue"];

/**
 * La letra de las constancias.
 *
 * Manuscrita si el sistema tiene alguna: el formulario es impreso, pero lo
 * que se anota en él lo escribe una persona, y una letra de imprenta
 * apareciendo trazo a trazo parece una máquina de escribir. Se comprueba
 * midiendo: si la fuente no está, el navegador cae a la de reserva y el ancho
 * cambia según cuál sea esa reserva.
 */
function elegirLetra(ctx: CanvasRenderingContext2D): { familia: string; manuscrita: boolean } {
  const prueba = "Constancia 02:35 Mmwq";
  ctx.font = "40px monospace";
  const referencia = ctx.measureText(prueba).width;
  for (const nombre of MANUSCRITAS) {
    ctx.font = `40px '${nombre}', monospace`;
    const conMono = ctx.measureText(prueba).width;
    ctx.font = `40px '${nombre}', serif`;
    const conSerif = ctx.measureText(prueba).width;
    if (Math.abs(conMono - conSerif) < 0.5 && Math.abs(conMono - referencia) > 0.5) {
      return { familia: `'${nombre}', cursive`, manuscrita: true };
    }
  }
  return { familia: "'Segoe UI', system-ui, sans-serif", manuscrita: false };
}

/** Un desvío fijo por renglón, entre -0,5 y 0,5: la mano no escribe dos veces igual. */
function vaiven(entrada: number, parte: number, sal = 0): number {
  const x = Math.sin(entrada * 12.9898 + parte * 78.233 + sal * 37.719) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

function tinta(alfa: number, humedad: number): string {
  const h = Math.max(0, Math.min(1, humedad));
  const c = TINTA.map((v, i) => Math.round(v + (TINTA_FRESCA[i] - v) * h));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.min(1, alfa + 0.06 * h)})`;
}

const recortar = (x: number): number => Math.max(0, Math.min(1, x));

function clave(r: Renglon): string {
  return `${r.entrada}.${r.parte}|${r.hora}|${r.actividad}|${r.texto}|${r.cierre ? 1 : 0}`;
}

function iguales(a: Renglon[], b: Renglon[]): boolean {
  return a.length === b.length && a.every((r, i) => clave(r) === clave(b[i]) && r.anulada === b[i].anulada);
}

const pliegoDe = (renglones: number): number => (renglones <= 0 ? 0 : Math.floor((renglones - 1) / POR_PLIEGO));

export function crearPaginasLibro(scene: Scene, opciones: OpcionesPaginas = {}): PaginasLibro {
  const medidor = document.createElement("canvas").getContext("2d")!;
  const letra = elegirLetra(medidor);
  // La manuscrita es más ancha y más alta que la de imprenta al mismo cuerpo.
  const cuerpos: Record<Exclude<Parte, "tachado">, number> = letra.manuscrita
    ? { hora: 10.5, actividad: 8.2, texto: 10.2, cierre: 9.5 }
    : { hora: 12, actividad: 10, texto: 12, cierre: 11 };
  const fuente = (parte: Parte): string => `${cuerpos[parte === "tachado" ? "texto" : parte]}px ${letra.familia}`;

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

    // El papel y el rayado se pintan UNA vez. Mientras se escribe la carilla
    // se redibuja cada cuadro, y con las manchas echadas al azar en cada
    // repintado el papel hervía debajo de la letra.
    const fondo = document.createElement("canvas");
    fondo.width = ANCHO * DENSIDAD;
    fondo.height = ALTO * DENSIDAD;
    const ctxFondo = fondo.getContext("2d")!;
    ctxFondo.scale(DENSIDAD, DENSIDAD);
    dibujarPapel(ctxFondo, crearAzar(lado < 0 ? 37 : 91), lado);
    dibujarRayado(ctxFondo);

    return { lado, textura, material, fondo };
  });

  // Donde se enmascara el trozo que se está escribiendo.
  const tira = document.createElement("canvas");
  tira.width = ANCHO * DENSIDAD;
  tira.height = ALTO_TIRA * DENSIDAD;
  const ctxTira = tira.getContext("2d")!;

  let mostrados: Renglon[] = [];
  let escritura: Escritura | null = null;
  let trazandoAntes = false;

  /** Qué texto, dónde y con qué letra lleva una parte de un renglón. */
  function pieza(r: Renglon, parte: Parte): { texto: string; x: number; ancho: number; letra: string } {
    const letraParte = fuente(parte);
    medidor.font = letraParte;
    const texto = parte === "hora" ? r.hora : parte === "actividad" ? r.actividad : r.texto;
    const ancho = medidor.measureText(texto).width;
    let x: number;
    if (parte === "hora") x = MARGEN + COL_HORA / 2 - ancho / 2;
    else if (parte === "actividad") x = X_ACTIVIDAD + vaiven(r.entrada, r.parte, 1) * 1.2;
    else if (parte === "cierre") x = X_TEXTO + (ANCHO_TEXTO - ancho) / 2;
    else x = X_TEXTO + vaiven(r.entrada, r.parte, 2) * 1.6;
    return { texto, x, ancho, letra: letraParte };
  }

  /**
   * Parte un texto en renglones que caben en la columna, sin cortar palabras.
   *
   * Midiendo con la letra real y no contando caracteres: la manuscrita no es de
   * ancho constante, y contar dejaba renglones que se salían de la hoja.
   */
  function partir(texto: string, anchoMaximo: number, letraTexto: string): string[] {
    medidor.font = letraTexto;
    const palabras = (texto ?? "").split(/\s+/).filter(Boolean);
    const lineas: string[] = [];
    let actual = "";
    palabras.forEach((palabra) => {
      const tentativa = actual ? `${actual} ${palabra}` : palabra;
      if (!actual || medidor.measureText(tentativa).width <= anchoMaximo) {
        actual = tentativa;
        return;
      }
      lineas.push(actual);
      actual = palabra;
    });
    if (actual) lineas.push(actual);
    return lineas;
  }

  /**
   * De constancias a renglones.
   *
   * Cada entrada ocupa los renglones que necesite su redacción —o su
   * actividad, si es la que no cabe— y detrás va su raya de cierre numerada.
   * La hora solo se escribe en el primer renglón, como en el libro del manual.
   */
  function renglonesDe(estado: EstadoLibro): Renglon[] {
    const salida: Renglon[] = [];
    (estado.entradas ?? []).forEach((entrada) => {
      const texto = partir(entrada.observaciones, ANCHO_TEXTO, fuente("texto"));
      const actividad = partir(entrada.actividad, ANCHO_ACTIVIDAD, fuente("actividad"));
      const cuantos = Math.max(1, texto.length, actividad.length);
      for (let i = 0; i < cuantos; i++) {
        salida.push({
          entrada: entrada.numero,
          parte: i,
          hora: i === 0 ? entrada.hora : "",
          actividad: actividad[i] ?? "",
          texto: texto[i] ?? "",
          anulada: entrada.anulada,
          cierre: false,
        });
      }
      salida.push({
        entrada: entrada.numero,
        parte: cuantos,
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
   * El orden y los tiempos de la mano para pasar de `antes` a `destino`.
   *
   * Devuelve null si el cambio no es algo que se escriba —un renglón que
   * cambió de contenido, uno que dejó de estar anulado—: eso no tiene gesto
   * posible en un libro, y se pone al día sin trazar.
   */
  function planificar(antes: Renglon[], destino: Renglon[]): Escritura | null {
    if (antes.length > destino.length) return null;
    const nuevas = new Set<number>();
    const tachar: number[] = [];
    for (let i = 0; i < destino.length; i++) {
      const a = antes[i];
      const d = destino[i];
      if (!a) {
        nuevas.add(i);
        continue;
      }
      if (clave(a) !== clave(d)) return null;
      if (a.anulada !== d.anulada) {
        if (a.anulada) return null;
        if (d.texto && !d.cierre) tachar.push(i);
      }
    }
    if (nuevas.size === 0 && tachar.length === 0) return null;

    // Primero lo que se anula, después lo que se escribe. Dentro de cada
    // constancia, como se escribe a mano: la hora, la actividad entera, la
    // observación renglón a renglón y la raya de cierre.
    const pasos: { fila: number; parte: Parte }[] = tachar.map((fila) => ({ fila, parte: "tachado" as Parte }));
    const porEntrada = new Map<number, number[]>();
    [...nuevas]
      .sort((a, b) => a - b)
      .forEach((fila) => {
        const lista = porEntrada.get(destino[fila].entrada) ?? [];
        lista.push(fila);
        porEntrada.set(destino[fila].entrada, lista);
      });
    porEntrada.forEach((filas) => {
      const cuerpo = filas.filter((f) => !destino[f].cierre);
      cuerpo.forEach((f) => destino[f].hora && pasos.push({ fila: f, parte: "hora" }));
      cuerpo.forEach((f) => destino[f].actividad && pasos.push({ fila: f, parte: "actividad" }));
      cuerpo.forEach((f) => destino[f].texto && pasos.push({ fila: f, parte: "texto" }));
      filas.filter((f) => destino[f].cierre).forEach((f) => pasos.push({ fila: f, parte: "cierre" }));
    });

    let t = 0;
    let pliego = pliegoDe(antes.length);
    let filaPrevia = -1;
    const trazos: Trazo[] = pasos.map((paso, n) => {
      if (n > 0) t += paso.fila === filaPrevia ? LEVANTAR : LEVANTAR_RENGLON;
      const pliegoPaso = Math.floor(paso.fila / POR_PLIEGO);
      let muestraDesde = t;
      if (pliegoPaso !== pliego) {
        t += PASAR_HOJA;
        muestraDesde = t - PASAR_HOJA * 0.75;
        pliego = pliegoPaso;
      }
      const ancho = pieza(destino[paso.fila], paso.parte).ancho;
      const inicio = t;
      t += Math.max(0.06, ancho / VELOCIDAD);
      filaPrevia = paso.fila;
      return { fila: paso.fila, parte: paso.parte, inicio, fin: t, muestraDesde };
    });

    // La duración se ajusta al conjunto, no trazo a trazo: así las pausas y
    // los trazos conservan su proporción y la mano no cambia de ritmo.
    let escala = 1;
    if (t > DURACION_MAXIMA) escala = DURACION_MAXIMA / t;
    else if (nuevas.size > 0 && t < DURACION_MINIMA) escala = DURACION_MINIMA / t;
    const porFila = new Map<number, Trazo[]>();
    trazos.forEach((tr) => {
      tr.inicio *= escala;
      tr.fin *= escala;
      tr.muestraDesde *= escala;
      const lista = porFila.get(tr.fila) ?? [];
      lista.push(tr);
      porFila.set(tr.fila, lista);
    });

    return {
      antes,
      destino,
      trazos,
      porFila,
      nuevas,
      duracion: t * escala,
      t: 0,
      empezada: false,
      pliego: pliegoDe(antes.length),
      avisos: [],
    };
  }

  function vistaEn(esc: Escritura, fila: number, t: number): Vista {
    const trazos = esc.porFila.get(fila) ?? [];
    const nueva = esc.nuevas.has(fila);
    const de = (parte: Parte): Trazo | undefined => trazos.find((tr) => tr.parte === parte);
    const avance = (tr: Trazo): number => recortar((t - tr.inicio) / (tr.fin - tr.inicio));
    const tachado = de("tachado");
    return {
      progreso: (parte) => {
        const tr = de(parte);
        return tr ? avance(tr) : nueva ? 0 : 1;
      },
      humedad: (parte) => {
        const tr = de(parte);
        if (!tr || t < tr.inicio) return 0;
        return t < tr.fin ? 1 : Math.max(0, 1 - (t - tr.fin) / HUMEDA);
      },
      tachado: tachado ? avance(tachado) : esc.destino[fila].anulada ? 1 : 0,
    };
  }

  function vistaCompleta(r: Renglon): Vista {
    return { progreso: () => 1, humedad: () => 0, tachado: r.anulada ? 1 : 0 };
  }

  /** Un trozo de texto escrito hasta `progreso`, con la punta blanda. */
  function trazarParcial(
    ctx: CanvasRenderingContext2D,
    g: { texto: string; x: number; ancho: number; letra: string },
    y: number,
    color: string,
    progreso: number
  ): void {
    ctxTira.setTransform(DENSIDAD, 0, 0, DENSIDAD, 0, 0);
    ctxTira.globalCompositeOperation = "source-over";
    ctxTira.clearRect(0, 0, ANCHO, ALTO_TIRA);
    ctxTira.font = g.letra;
    ctxTira.fillStyle = color;
    ctxTira.textAlign = "left";
    ctxTira.textBaseline = "alphabetic";
    ctxTira.fillText(g.texto, g.x, BASE_TIRA);

    // Lo escrito, opaco; la punta, un degradado del ancho de una letra; lo que
    // falta, transparente. En 0 no asoma nada y en 1 está todo.
    const frente = g.x + progreso * (g.ancho + PLUMA);
    const mascara = ctxTira.createLinearGradient(frente - PLUMA, 0, frente, 0);
    mascara.addColorStop(0, "rgba(0, 0, 0, 1)");
    mascara.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctxTira.globalCompositeOperation = "destination-in";
    ctxTira.fillStyle = mascara;
    ctxTira.fillRect(0, 0, ANCHO, ALTO_TIRA);
    ctxTira.globalCompositeOperation = "source-over";

    ctx.drawImage(tira, 0, y - BASE_TIRA, ANCHO, ALTO_TIRA);
  }

  function escribirParte(ctx: CanvasRenderingContext2D, r: Renglon, parte: Parte, y: number, alfa: number, vista: Vista): void {
    const progreso = vista.progreso(parte);
    if (progreso <= 0) return;
    const g = pieza(r, parte);
    if (!g.texto) return;
    const color = tinta(alfa, vista.humedad(parte));
    if (progreso < 1) {
      trazarParcial(ctx, g, y, color, progreso);
      return;
    }
    ctx.font = g.letra;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(g.texto, g.x, y);
  }

  function dibujarRenglon(ctx: CanvasRenderingContext2D, r: Renglon, k: number, vista: Vista): void {
    const y = Y_PRIMERO + k * ALTO_RENGLON + ALTO_RENGLON - 6 + vaiven(r.entrada, r.parte) * 1.1;

    if (r.cierre) {
      // La raya de cierre cruza la caja de observaciones y nada más: en el
      // manual separa párrafos, no es una constancia con hora.
      escribirParte(ctx, r, "cierre", y, 0.62, vista);
      return;
    }

    // Lo anulado se apaga a medida que la raya pasa por encima: el manual
    // pide que siga a la vista, y así se distingue de un vistazo.
    const alfa = 0.92 - 0.47 * vista.tachado;
    escribirParte(ctx, r, "hora", y, alfa, vista);
    escribirParte(ctx, r, "actividad", y, alfa, vista);
    escribirParte(ctx, r, "texto", y, alfa, vista);

    if (vista.tachado > 0 && r.texto) {
      const g = pieza(r, "tachado");
      const j = vaiven(r.entrada, r.parte, 3);
      const x0 = g.x - 2;
      const x1 = g.x + g.ancho + 2;
      const y0 = y - 3.4 + j * 0.8;
      const y1 = y - 4.2 - j * 0.8;
      ctx.strokeStyle = tinta(0.78, vista.humedad("tachado"));
      ctx.lineWidth = 1.05;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (x1 - x0) * vista.tachado, y0 + (y1 - y0) * vista.tachado);
      ctx.stroke();
    }
  }

  /** Redibuja una carilla del pliego: 0 la izquierda, 1 la derecha. */
  function pintarCarilla(indice: 0 | 1, pliego: number, esc: Escritura | null, t: number): void {
    const hoja = hojas[indice];
    const ctx = hoja.textura.getContext() as unknown as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(hoja.fondo, 0, 0);
    ctx.setTransform(DENSIDAD, 0, 0, DENSIDAD, 0, 0);
    ctx.textBaseline = "alphabetic";

    const filas = esc ? esc.destino : mostrados;
    const desde = pliego * POR_PLIEGO + indice * RENGLONES;
    for (let k = 0; k < RENGLONES; k++) {
      const r = filas[desde + k];
      if (!r) break;
      dibujarRenglon(ctx, r, k, esc ? vistaEn(esc, desde + k, t) : vistaCompleta(r));
    }

    // Folio, abajo al centro. Un libro foliado es un libro que no perdió hojas.
    ctx.fillStyle = "rgba(63, 74, 88, 0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(pliego * 2 + indice + 1), ANCHO / 2, ALTO - 2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    hoja.textura.update();
  }

  function pintarTodo(): void {
    const pliego = pliegoDe(mostrados.length);
    pintarCarilla(0, pliego, null, 0);
    pintarCarilla(1, pliego, null, 0);
  }

  function avisarTrazo(trazando: boolean): void {
    if (trazando === trazandoAntes) return;
    trazandoAntes = trazando;
    opciones.alTrazar?.(trazando);
  }

  function terminar(): void {
    const esc = escritura;
    if (!esc) return;
    escritura = null;
    mostrados = esc.destino;
    pintarTodo();
    avisarTrazo(false);
    esc.avisos.forEach((aviso) => aviso());
  }

  /** El pliego que se ve en el instante `t`: el del último trazo que ya asomó. */
  function pliegoEn(esc: Escritura, t: number): number {
    let pliego = esc.pliego;
    let fila = -1;
    for (const tr of esc.trazos) {
      if (tr.muestraDesde > t) break;
      fila = tr.fila;
    }
    if (fila >= 0) pliego = Math.floor(fila / POR_PLIEGO);
    return pliego;
  }

  const observador = scene.onBeforeRenderObservable.add(() => {
    const esc = escritura;
    if (!esc) return;
    if (!esc.empezada) {
      if (opciones.listoParaTrazar && !opciones.listoParaTrazar()) return;
      esc.empezada = true;
    }
    esc.t += Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    const t = esc.t - ACERCARSE;

    // Solo se sube a la tarjeta la carilla donde hay tinta moviéndose —o
    // secándose—, y las dos cuando se pasa la hoja. Una novedad se escribe
    // entera en una carilla casi siempre, y así se paga la mitad.
    const pliego = pliegoEn(esc, t);
    let izquierda = pliego !== esc.pliego;
    let derecha = izquierda;
    for (const tr of esc.trazos) {
      if (tr.muestraDesde > t) break;
      if (t > tr.fin + HUMEDA || Math.floor(tr.fila / POR_PLIEGO) !== pliego) continue;
      if (tr.fila % POR_PLIEGO < RENGLONES) izquierda = true;
      else derecha = true;
    }
    esc.pliego = pliego;
    if (izquierda) pintarCarilla(0, pliego, esc, t);
    if (derecha) pintarCarilla(1, pliego, esc, t);

    avisarTrazo(esc.trazos.some((tr) => t >= tr.inicio && t < tr.fin));
    if (t >= esc.duracion + RETENER) terminar();
  });
  scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observador));

  // Se pinta ya, vacío: si no, el libro arranca con la textura en negro hasta
  // que se escriba la primera constancia.
  pintarTodo();

  return {
    material(lado) {
      return (hojas.find((h) => h.lado === lado) ?? hojas[0]).material;
    },
    escribir(estado, aLaVista, alTerminar) {
      const destino = renglonesDe(estado);

      if (escritura) {
        // Lo mismo que ya se está escribiendo: se espera a la misma última letra.
        if (aLaVista && iguales(destino, escritura.destino)) {
          if (alTerminar) escritura.avisos.push(alTerminar);
          return;
        }
        // Otra cosa, o el libro dejó de estar a la vista: lo que se estaba
        // escribiendo se da por escrito ya, sin cortar la constancia a medias.
        terminar();
      }

      if (!aLaVista || iguales(destino, mostrados)) {
        alTerminar?.();
        return;
      }

      const plan = planificar(mostrados, destino);
      if (!plan) {
        mostrados = destino;
        pintarTodo();
        alTerminar?.();
        return;
      }
      if (alTerminar) plan.avisos.push(alTerminar);
      escritura = plan;
    },
  };
}

/** Papel envejecido con sus manchas, y la sombra del lomo. */
function dibujarPapel(ctx: CanvasRenderingContext2D, azar: () => number, lado: number): void {
  ctx.fillStyle = "#e6e0cf";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.fillStyle = "rgba(120, 96, 60, 0.05)";
  for (let i = 0; i < 60; i++) {
    ctx.fillRect(azar() * ANCHO, azar() * ALTO, 2 + azar() * 5, 1 + azar() * 2);
  }

  // Hacia el lomo la hoja se curva y recibe menos luz.
  const ancho = 26;
  const desde = lado < 0 ? ANCHO : 0;
  const hasta = lado < 0 ? ANCHO - ancho : ancho;
  const sombra = ctx.createLinearGradient(desde, 0, hasta, 0);
  sombra.addColorStop(0, "rgba(70, 55, 35, 0.16)");
  sombra.addColorStop(1, "rgba(70, 55, 35, 0)");
  ctx.fillStyle = sombra;
  ctx.fillRect(Math.min(desde, hasta), 0, ancho, ALTO);
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
  ctx.fillText("OBSERVACIONES", MARGEN + COL_ACTIVIDAD + (ANCHO - 2 * MARGEN - COL_ACTIVIDAD) / 2, 32);

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
