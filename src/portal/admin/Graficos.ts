// ===========================================================================
// Gráficos del panel
// ===========================================================================
//
// Hechos a mano, sin librería: son cuatro formas simples y una librería de
// gráficos pesaría más que el panel entero.
//
//  - Barra de estados: una sola barra partida en completaron / en curso / sin
//    empezar. Es una parte de un todo, y una torta se lee peor que una barra.
//  - Barras horizontales: avance por fase (una serie) y avance por área o por
//    curso (100 % apiladas, con los mismos tres estados).
//  - Curva acumulada: inscritos y completados a lo largo del tiempo.
//
// ─── COLORES ──────────────────────────────────────────────────────────────
//
// Una sola rampa del verde de la marca para los tres estados, del apagado al
// encendido, validada para daltonismo en los dos temas (ver portal.css,
// --grafico-*). El texto nunca toma el color de la serie: los números van en
// los grises del portal y el color queda en la marca que está al lado.
//
// ─── AYUDAS ───────────────────────────────────────────────────────────────
//
// Cada barra muestra su detalle al pasar el mouse o al llegar con el teclado.
// El texto de la ayuda viaja en un atributo como JSON y se escribe con
// textContent, nunca como HTML: los nombres de áreas los escriben las
// personas al registrarse.

import { ESTADOS, type EstadoAvance, type FilaGrupo, type SerieAcumulada } from "./Indicadores";
import { escapar, fechaDiaMes, numero, porcentaje } from "./Formato";
import { icono } from "../Iconos";

/** Atributo con el contenido de una ayuda: título y líneas. */
function ayuda(titulo: string, lineas: string[]): string {
  return `data-tip="${escapar(JSON.stringify([titulo, ...lineas]))}"`;
}

// ---------------------------------------------------------------------------
// Leyenda
// ---------------------------------------------------------------------------

export function leyendaEstados(conteo?: Record<EstadoAvance, number>, total?: number): string {
  return `
    <ul class="leyenda">
      ${ESTADOS.map(
        (e) => `
        <li class="leyenda__item">
          <span class="muestra muestra--${e.id}" aria-hidden="true"></span>
          <span class="leyenda__rotulo">${e.rotulo}</span>
          ${
            conteo
              ? `<strong class="leyenda__valor">${numero(conteo[e.id])}</strong>
                 <span class="leyenda__parte">${porcentaje(conteo[e.id], total ?? 0)} %</span>`
              : ""
          }
        </li>`
      ).join("")}
    </ul>`;
}

// ---------------------------------------------------------------------------
// Barra de estados
// ---------------------------------------------------------------------------

/**
 * Una barra partida en los tres estados, con la leyenda y sus cifras debajo.
 *
 * @param enlaces Cada fila de la leyenda abre la lista de personas en ese
 *                estado. En el resumen sí: una cifra que no se puede abrir
 *                obliga a buscar a mano a quién cuenta.
 */
export function barraEstados(conteo: Record<EstadoAvance, number>, enlaces = false): string {
  const total = conteo.completado + conteo.en_curso + conteo.sin_empezar;
  const tramos = ESTADOS.filter((e) => conteo[e.id] > 0)
    .map(
      (e) => `
      <span class="estados__tramo tramo--${e.id}" style="flex-grow:${conteo[e.id]}"
            tabindex="0" role="img"
            aria-label="${e.rotulo}: ${conteo[e.id]} de ${total}"
            ${ayuda(e.rotulo, [`${numero(conteo[e.id])} de ${numero(total)} personas`, `${porcentaje(conteo[e.id], total)} %`])}></span>`
    )
    .join("");

  return `
    <div class="estados">
      <div class="estados__barra">${tramos || `<span class="estados__vacia"></span>`}</div>
      <ul class="leyenda">
        ${ESTADOS.map((e) => {
          const contenido = `
            <span class="muestra muestra--${e.id}" aria-hidden="true"></span>
            <span class="leyenda__rotulo">${e.rotulo}</span>
            <strong class="leyenda__valor">${numero(conteo[e.id])}</strong>
            <span class="leyenda__parte">${porcentaje(conteo[e.id], total)} %</span>`;
          return enlaces
            ? `<li><button class="leyenda__item leyenda__item--enlace" type="button" data-accion="ir" data-vista="personas" data-filtro="${e.id}"
                       aria-label="${e.rotulo}: ${conteo[e.id]}. Ver la lista">${contenido}${icono("derecha", "icono leyenda__ir")}</button></li>`
            : `<li class="leyenda__item">${contenido}</li>`;
        }).join("")}
      </ul>
    </div>`;
}

// ---------------------------------------------------------------------------
// Barras horizontales
// ---------------------------------------------------------------------------

export interface FilaBarra {
  rotulo: string;
  /** Número o código corto que va antes del rótulo ("1", "2"…). */
  numero?: string;
  /** Proporción de la barra, de 0 a 1. */
  proporcion: number;
  valor: string;
  parte?: string;
  ayuda: [string, ...string[]];
}

/** Barras de una sola serie, con el valor al final de cada una. */
export function barrasSimples(filas: FilaBarra[]): string {
  return `
    <ul class="barras">
      ${filas
        .map(
          (f, i) => `
        <li class="barras__fila" style="--i:${i}">
          <span class="barras__rotulo">
            ${f.numero ? `<span class="barras__numero">${escapar(f.numero)}</span>` : ""}
            <span class="barras__texto">${escapar(f.rotulo)}</span>
          </span>
          <span class="barras__carril">
            <span class="barras__barra${f.proporcion <= 0 ? " barras__barra--cero" : ""}"
                  style="--v:${Math.max(0, Math.min(1, f.proporcion)).toFixed(4)}"
                  tabindex="0" role="img" aria-label="${escapar(f.ayuda.join(". "))}"
                  ${ayuda(f.ayuda[0], f.ayuda.slice(1))}></span>
          </span>
          <span class="barras__valor"><strong>${escapar(f.valor)}</strong>${f.parte ? ` <span>${escapar(f.parte)}</span>` : ""}</span>
        </li>`
        )
        .join("")}
    </ul>`;
}

/**
 * Una barra al 100 % por grupo (área o curso), partida en los tres estados.
 *
 * Al 100 % y no en número de personas: lo que se compara es si cada área está
 * al día, y un área de tres personas tiene que poder verse tan completa como
 * una de cuarenta. El tamaño del grupo va escrito al final.
 */
export function barrasApiladas(grupos: FilaGrupo[]): string {
  return `
    <ul class="barras barras--apiladas">
      ${grupos
        .map((g, i) => {
          const tramos = ESTADOS.filter((e) => g[e.id] > 0)
            .map(
              (e) => `
              <span class="barras__tramo tramo--${e.id}" style="flex-grow:${g[e.id]}"
                    tabindex="0" role="img"
                    aria-label="${escapar(`${g.nombre}, ${e.rotulo}: ${g[e.id]} de ${g.total}`)}"
                    ${ayuda(g.nombre, [`${e.rotulo}: ${numero(g[e.id])} de ${numero(g.total)}`, `${porcentaje(g[e.id], g.total)} %`])}></span>`
            )
            .join("");
          return `
          <li class="barras__fila" style="--i:${i}">
            <span class="barras__rotulo"><span class="barras__texto" title="${escapar(g.nombre)}">${escapar(g.nombre)}</span></span>
            <span class="barras__carril barras__carril--apilado">${tramos}</span>
            <span class="barras__valor"><strong>${porcentaje(g.completado, g.total)} %</strong> <span>de ${numero(g.total)}</span></span>
          </li>`;
        })
        .join("")}
    </ul>`;
}

// ---------------------------------------------------------------------------
// Curva acumulada
// ---------------------------------------------------------------------------

/** Máximo "redondo" del eje y su paso: 37 da 40 en pasos de 10. */
function escala(maximo: number): { tope: number; paso: number } {
  if (maximo <= 4) return { tope: Math.max(4, maximo), paso: 1 };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}

export function curvaAcumulada(serie: SerieAcumulada): string {
  const n = serie.puntos.length;
  const maximo = Math.max(...serie.puntos.map((p) => p.inscritos), 1);
  const { tope, paso } = escala(maximo);

  const x = (i: number): number => (n === 1 ? 1000 : (i / (n - 1)) * 1000);
  const y = (v: number): number => 1000 - (v / tope) * 1000;
  const trazo = (valores: number[]): string =>
    valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const inscritos = serie.puntos.map((p) => p.inscritos);
  const completados = serie.puntos.map((p) => p.completados);
  const area = `${trazo(completados)}L${x(n - 1).toFixed(1)},1000L0,1000Z`;

  const marcas: string[] = [];
  for (let v = paso; v <= tope; v += paso) marcas.push(String(v));
  const rejilla = marcas
    .map((v) => `<line x1="0" x2="1000" y1="${y(Number(v)).toFixed(1)}" y2="${y(Number(v)).toFixed(1)}"/>`)
    .join("");
  const etiquetasY = ["0", ...marcas]
    .map((v) => `<span style="bottom:${((Number(v) / tope) * 100).toFixed(2)}%">${numero(Number(v))}</span>`)
    .join("");

  // Cinco fechas como mucho en el eje: con más se pisan en un panel angosto.
  const posiciones = n <= 5 ? serie.puntos.map((_, i) => i) : [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(p * (n - 1)));
  const etiquetasX = [...new Set(posiciones)]
    .map((i) => {
      const lado = i === 0 ? "inicio" : i === n - 1 ? "fin" : "medio";
      const texto = i === n - 1 ? "Hoy" : fechaDiaMes(serie.puntos[i].fecha);
      return `<span class="curva__fecha curva__fecha--${lado}" style="left:${((x(i) / 1000) * 100).toFixed(2)}%">${texto}</span>`;
    })
    .join("");

  const ultimo = serie.puntos[n - 1];
  const datos = escapar(
    JSON.stringify({
      f: serie.puntos.map((p) => p.fecha.toISOString()),
      i: inscritos,
      c: completados,
      t: tope,
      s: serie.paso,
    })
  );

  return `
    <div class="curva" data-curva="${datos}">
      <ul class="leyenda leyenda--curva">
        <li class="leyenda__item">
          <span class="muestra muestra--linea muestra--inscritos" aria-hidden="true"></span>
          <span class="leyenda__rotulo">Inscritos</span>
          <strong class="leyenda__valor">${numero(ultimo.inscritos)}</strong>
        </li>
        <li class="leyenda__item">
          <span class="muestra muestra--linea muestra--completados" aria-hidden="true"></span>
          <span class="leyenda__rotulo">Completaron</span>
          <strong class="leyenda__valor">${numero(ultimo.completados)}</strong>
          <span class="leyenda__parte">${porcentaje(ultimo.completados, ultimo.inscritos)} %</span>
        </li>
      </ul>
      <div class="curva__cuerpo">
        <div class="curva__eje-y" aria-hidden="true">${etiquetasY}</div>
        <div class="curva__zona" tabindex="0" role="img"
             aria-label="Inscritos y completados acumulados. Hoy: ${ultimo.inscritos} inscritos y ${ultimo.completados} completaron. Usa las flechas izquierda y derecha para recorrer las fechas.">
          <svg class="curva__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <g class="curva__rejilla">${rejilla}</g>
            <path class="curva__area" d="${area}"/>
            <path class="curva__linea curva__linea--inscritos" d="${trazo(inscritos)}"/>
            <path class="curva__linea curva__linea--completados" d="${trazo(completados)}"/>
          </svg>
          <span class="curva__punto curva__punto--inscritos" style="left:100%;bottom:${((ultimo.inscritos / tope) * 100).toFixed(2)}%"></span>
          <span class="curva__punto curva__punto--completados" style="left:100%;bottom:${((ultimo.completados / tope) * 100).toFixed(2)}%"></span>
          <span class="curva__lectura" hidden></span>
          <span class="curva__marca curva__marca--inscritos" hidden></span>
          <span class="curva__marca curva__marca--completados" hidden></span>
        </div>
        <div class="curva__eje-x" aria-hidden="true">${etiquetasX}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tabla gemela
// ---------------------------------------------------------------------------

/**
 * La misma información del gráfico, como tabla.
 *
 * Para quien usa lector de pantalla, para quien necesita el número exacto y
 * para copiarlo a otra parte. Va oculta y se alterna con el botón del bloque.
 */
export function tablaGemela(id: string, cabeceras: string[], filas: string[][]): string {
  return `
    <div class="gemela" id="${id}" hidden>
      <table class="tabla tabla--compacta">
        <thead><tr>${cabeceras.map((c, i) => `<th${i > 0 ? ' class="tabla__num"' : ""}>${escapar(c)}</th>`).join("")}</tr></thead>
        <tbody>
          ${filas
            .map((f) => `<tr>${f.map((c, i) => `<td${i > 0 ? ' class="tabla__num"' : ""}>${escapar(c)}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Interacción
// ---------------------------------------------------------------------------

/**
 * Ayudas emergentes y lectura de la curva, para todo lo que haya bajo `raiz`.
 *
 * Se engancha una sola vez, por delegación: el panel vuelve a dibujar sus
 * vistas a cada rato y así no hay que volver a conectar nada.
 */
export function conectarGraficos(raiz: HTMLElement): void {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  raiz.appendChild(tip);

  function escribir(lineas: string[]): void {
    tip.replaceChildren();
    lineas.forEach((texto, i) => {
      const linea = document.createElement(i === 0 ? "strong" : "span");
      linea.textContent = texto;
      tip.appendChild(linea);
    });
  }

  /** Ubica la ayuda sobre un punto de la pantalla, sin salirse de ella. */
  function ubicar(x: number, yArriba: number, yAbajo: number): void {
    tip.hidden = false;
    const ancho = tip.offsetWidth;
    const alto = tip.offsetHeight;
    const izquierda = Math.min(Math.max(8, x - ancho / 2), window.innerWidth - ancho - 8);
    const arriba = yArriba - alto - 10 >= 8 ? yArriba - alto - 10 : yAbajo + 10;
    tip.style.transform = `translate(${Math.round(izquierda)}px, ${Math.round(arriba)}px)`;
  }

  function mostrarDe(el: HTMLElement): void {
    try {
      const lineas = JSON.parse(el.dataset.tip ?? "[]") as string[];
      if (lineas.length === 0) return;
      escribir(lineas);
      const r = el.getBoundingClientRect();
      ubicar(r.left + r.width / 2, r.top, r.bottom);
    } catch {
      tip.hidden = true;
    }
  }

  const ocultar = (): void => {
    tip.hidden = true;
  };

  raiz.addEventListener("pointerover", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (el) mostrarDe(el);
  });
  raiz.addEventListener("pointerout", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (el && !el.contains(e.relatedTarget as Node | null)) ocultar();
  });
  raiz.addEventListener("focusin", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (el) mostrarDe(el);
  });
  raiz.addEventListener("focusout", (e) => {
    if ((e.target as HTMLElement).closest("[data-tip], .curva__zona")) ocultar();
  });
  // Al desplazar, la ayuda quedaría flotando sobre otra cosa.
  raiz.addEventListener("scroll", ocultar, true);

  // --- Curva ---

  type DatosCurva = { f: string[]; i: number[]; c: number[]; t: number; s: "dia" | "semana" };
  const indices = new WeakMap<HTMLElement, number>();

  function datosDe(zona: HTMLElement): DatosCurva | null {
    try {
      return JSON.parse(zona.closest<HTMLElement>(".curva")?.dataset.curva ?? "null") as DatosCurva | null;
    } catch {
      return null;
    }
  }

  function leer(zona: HTMLElement, indice: number): void {
    const d = datosDe(zona);
    if (!d || d.f.length === 0) return;
    const n = d.f.length;
    const i = Math.max(0, Math.min(n - 1, indice));
    indices.set(zona, i);

    const izquierda = n === 1 ? 100 : (i / (n - 1)) * 100;
    const linea = zona.querySelector<HTMLElement>(".curva__lectura")!;
    const mi = zona.querySelector<HTMLElement>(".curva__marca--inscritos")!;
    const mc = zona.querySelector<HTMLElement>(".curva__marca--completados")!;
    linea.hidden = mi.hidden = mc.hidden = false;
    linea.style.left = `${izquierda}%`;
    mi.style.left = mc.style.left = `${izquierda}%`;
    mi.style.bottom = `${(d.i[i] / d.t) * 100}%`;
    mc.style.bottom = `${(d.c[i] / d.t) * 100}%`;

    const fecha = new Date(d.f[i]);
    const titulo =
      i === n - 1
        ? "Hoy"
        : d.s === "semana"
          ? `Semana al ${fecha.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}`
          : fecha.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    escribir([
      titulo,
      `Inscritos: ${numero(d.i[i])}`,
      `Completaron: ${numero(d.c[i])} (${porcentaje(d.c[i], d.i[i])} %)`,
    ]);
    const r = zona.getBoundingClientRect();
    ubicar(r.left + (izquierda / 100) * r.width, r.top, r.bottom);
  }

  function soltar(zona: HTMLElement): void {
    zona.querySelectorAll<HTMLElement>(".curva__lectura, .curva__marca").forEach((el) => (el.hidden = true));
    ocultar();
  }

  raiz.addEventListener("pointermove", (e) => {
    const zona = (e.target as HTMLElement).closest<HTMLElement>(".curva__zona");
    if (!zona) return;
    const d = datosDe(zona);
    if (!d) return;
    const r = zona.getBoundingClientRect();
    const t = (e.clientX - r.left) / Math.max(1, r.width);
    leer(zona, Math.round(t * (d.f.length - 1)));
  });

  // pointerleave no burbujea: se escucha en captura y solo cuenta cuando el
  // que se abandona es la zona entera, no una de sus piezas internas.
  raiz.addEventListener(
    "pointerleave",
    (e) => {
      const el = e.target as HTMLElement;
      if (el.classList?.contains("curva__zona")) soltar(el);
    },
    true
  );

  raiz.addEventListener("focusin", (e) => {
    const zona = (e.target as HTMLElement).closest<HTMLElement>(".curva__zona");
    if (!zona) return;
    const d = datosDe(zona);
    if (d) leer(zona, indices.get(zona) ?? d.f.length - 1);
  });

  raiz.addEventListener("focusout", (e) => {
    const zona = (e.target as HTMLElement).closest<HTMLElement>(".curva__zona");
    if (zona) soltar(zona);
  });

  raiz.addEventListener("keydown", (e) => {
    const zona = (e.target as HTMLElement).closest<HTMLElement>(".curva__zona");
    if (!zona) return;
    const d = datosDe(zona);
    if (!d) return;
    const actual = indices.get(zona) ?? d.f.length - 1;
    const salto = e.shiftKey ? 7 : 1;
    let destino: number | null = null;
    if (e.key === "ArrowLeft") destino = actual - salto;
    else if (e.key === "ArrowRight") destino = actual + salto;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = d.f.length - 1;
    if (destino === null) return;
    e.preventDefault();
    leer(zona, destino);
  });
}
