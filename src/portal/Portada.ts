// ===========================================================================
// Portada de un curso
// ===========================================================================
//
// Entre el catálogo y el menú del juego hay una espera real: leer el avance de
// la persona, y en guardias además descargar el juego. Antes ese rato era el
// lienzo vacío. Ahora la tarjeta que se tocó crece hasta llenar la pantalla
// con una captura del curso, su nombre y lo que se está preparando, y cuando
// el menú ya está dibujado detrás, la portada se desvanece.
//
// ─── POR QUÉ ES DEL NAVEGADOR Y NO DE LA ESCENA ───────────────────────────
//
// La misma razón que la pantalla de carga de los niveles: es una capa ajena
// a Babylon, así que sobrevive a lo que pase con la escena y el navegador la
// sigue animando aunque el hilo esté ocupado armando el menú.
//
// ─── EL CRECIMIENTO ───────────────────────────────────────────────────────
//
// La capa nace ya a pantalla completa, recortada (clip-path) al rectángulo de
// la tarjeta, y el recorte se abre hasta los bordes. No cambia de tamaño ni de
// posición, así que no obliga a recalcular la página en cada cuadro.
//
// Mientras crece, lo que rodea a la tarjeta tiene que seguir siendo el
// catálogo: por eso abrirPortada() devuelve una promesa que se cumple cuando
// la portada ya tapa todo, y recién ahí se retira el catálogo. Con la misma
// promesa (portadaCubierta) main.ts deja para después el armado del menú, que
// ocupa el hilo principal: el recorte se anima en ese hilo y se trabaría.

import "./portal.css";
import type { Curso, EstadoCurso } from "./Datos";
import { describirCurso } from "./CatalogoCursos";
import { marcaClassplay } from "./Marca";

/** Lo mínimo que se ve, para que el crecimiento termine y se alcance a leer. */
const MINIMO_MS = 1100;
/** Lo que dura el crecimiento: el mismo tiempo de la transición en portal.css. */
const CRECER_MS = 620;
/** Lo que dura el desvanecido de salida. */
const SALIDA_MS = 420;

export interface DatosPortada {
  curso: Curso;
  estado: EstadoCurso;
  fasesHechas: number;
  /** Rectángulo de la tarjeta tocada, para crecer desde ahí. */
  desde?: DOMRect;
}

let actual: { capa: HTMLElement; abiertaEn: number; cubierta: Promise<void> } | null = null;

function sinMovimiento(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function esperar(ms: number): Promise<void> {
  return new Promise((listo) => setTimeout(listo, ms));
}

/** Dos cuadros dibujados: el menú del juego alcanza a pintarse detrás. */
function dosCuadros(): Promise<void> {
  return new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())));
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Lo que dice la línea bajo el nombre, según en qué va la persona. */
function lineaDeAvance(datos: DatosPortada): string {
  const desc = describirCurso(datos.curso);
  const total = datos.curso.totalFases;
  if (datos.estado === "completado") return "Curso completado · tu certificado está listo";
  if (datos.estado === "en_curso") {
    const hechas = Math.min(datos.fasesHechas, total);
    return `${hechas} de ${total} ${desc.unidad.varias} · sigues donde quedaste`;
  }
  return `${total} ${total === 1 ? desc.unidad.una : desc.unidad.varias} · ${datos.curso.duracionMinutos} min aprox.`;
}

/**
 * Pone la portada del curso. Se llama justo antes de dejar el catálogo; la
 * retira cerrarPortada() cuando el juego ya tiene su menú en pantalla.
 *
 * La promesa se cumple cuando la portada ya tapa toda la pantalla.
 */
export function abrirPortada(datos: DatosPortada): Promise<void> {
  // Si quedó una de antes (un doble clic, un error a medio camino), se va.
  actual?.capa.remove();

  const desc = describirCurso(datos.curso);
  const capa = document.createElement("div");
  capa.className = "portada";
  capa.setAttribute("role", "status");
  capa.setAttribute("aria-live", "polite");
  capa.innerHTML = `
    <div class="portada__imagen"${desc.portada ? ` style="background-image: url('${desc.portada.imagen}')"` : ""}></div>
    <div class="portada__velo"></div>
    <div class="portada__marca">${marcaClassplay()}</div>
    <div class="portada__texto">
      <h1 class="portada__curso">${escapar(desc.corto)}</h1>
      <p class="portada__dato">${escapar(lineaDeAvance(datos))}</p>
      <p class="portada__carga">
        <span class="portada__linea" aria-hidden="true"><span></span></span>
        ${escapar(desc.portada?.preparando ?? "Preparando el curso")}
      </p>
    </div>`;
  document.body.appendChild(capa);

  const cubierta = crecer(capa, datos.desde);
  actual = { capa, abiertaEn: performance.now(), cubierta };
  return cubierta;
}

/** Se cumple cuando la portada abierta ya tapa todo, o de inmediato si no hay una. */
export function portadaCubierta(): Promise<void> {
  return actual?.cubierta ?? Promise.resolve();
}

function crecer(capa: HTMLElement, r: DOMRect | undefined): Promise<void> {
  if (!r || sinMovimiento()) {
    capa.classList.add("portada--abierta");
    return Promise.resolve();
  }

  // Nace recortada al tamaño de la tarjeta, con sus mismas esquinas...
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  capa.style.clipPath = `inset(${r.top}px ${ancho - r.right}px ${alto - r.bottom}px ${r.left}px round 12px)`;
  // ...y en el cuadro siguiente se abre: el navegador interpola entre los dos.
  void capa.offsetWidth;
  requestAnimationFrame(() => {
    capa.classList.add("portada--abierta");
    capa.style.clipPath = "inset(0px 0px 0px 0px round 0px)";
  });

  return new Promise((listo) => {
    const terminar = (): void => {
      clearTimeout(reserva);
      capa.removeEventListener("transitionend", alTerminar);
      listo();
    };
    const alTerminar = (evento: TransitionEvent): void => {
      if (evento.target === capa && evento.propertyName === "clip-path") terminar();
    };
    capa.addEventListener("transitionend", alTerminar);
    // Si la transición no llega a correr (la pestaña quedó en segundo plano,
    // por ejemplo), se sigue igual: nadie queda esperando un evento que no viene.
    const reserva = setTimeout(terminar, CRECER_MS + 250);
  });
}

/**
 * Retira la portada, si hay una. Espera el mínimo en pantalla y dos cuadros,
 * para que lo de atrás ya esté dibujado al aclarar.
 */
export async function cerrarPortada(): Promise<void> {
  if (!actual) return;
  const { capa, abiertaEn } = actual;
  actual = null;

  const restante = MINIMO_MS - (performance.now() - abiertaEn);
  if (restante > 0) await esperar(restante);
  await dosCuadros();

  capa.classList.add("portada--saliendo");
  await esperar(sinMovimiento() ? 0 : SALIDA_MS);
  capa.remove();
}
