import "./cargaNivel.css";
import { briefingsNiveles } from "../data/levelConfig";

// ---------------------------------------------------------------------------
// Pantalla de carga del nivel
// ---------------------------------------------------------------------------
//
// Armar el garaje —geometría, texturas, sombras, post-proceso— bloquea el hilo
// principal varios cientos de milisegundos. Antes eso era una pausa muerta con
// la pantalla a medio oscurecer.
//
// ─── QUÉ MUESTRA Y POR QUÉ ────────────────────────────────────────────────
//
// El término japonés de la fase, su traducción y el contexto del caso, sacados
// de briefingsNiveles: los mismos textos que el jugador va a ver en el panel
// de sesión, así que no hay contenido duplicado que mantener en dos sitios.
//
// La espera existe igual; la diferencia es si se aprovecha. Leer de qué trata
// la fase antes de entrar prepara para lo que hay que hacer, y de paso hace
// que el nivel empiece con contexto en vez de con un garaje y ninguna pista.
//
// ─── POR QUÉ ES DEL NAVEGADOR Y NO DE LA ESCENA ───────────────────────────
//
// La misma razón que el fundido: entre pantalla y pantalla el juego destruye
// la escena, así que una capa hecha con la interfaz de Babylon moriría en el
// medio. Además el navegador la sigue pintando aunque el hilo principal esté
// ocupado construyendo el nivel — que es exactamente cuando tiene que verse.
//
// ─── LA LÓGICA QUE IMPORTA ────────────────────────────────────────────────
//
// No hay barra de progreso, y es deliberado. No existe forma honesta de saber
// qué porcentaje del nivel lleva armado: sería una animación inventada
// corriendo mientras el hilo está bloqueado, o sea una mentira que además se
// congelaría a mitad de camino. En su lugar la pantalla se va cuando el nivel
// está de verdad listo Y dibujado.
//
// El tiempo mínimo tampoco es decorativo: sin él, en un equipo rápido la
// pantalla aparecería y desaparecería en un parpadeo —peor que no ponerla— y
// nadie alcanzaría a leer nada.

/** Lo que tarda en aparecer y en irse. */
const FUNDIDO_MS = 180;

/**
 * Tiempo mínimo en pantalla.
 *
 * Suficiente para leer el nombre de la fase y su traducción, que es lo mínimo
 * que justifica mostrarla. El contexto queda para quien lea rápido; no se
 * retiene al jugador esperando a que termine.
 */
const MINIMO_MS = 900;

let capa: HTMLDivElement | null = null;

function obtenerCapa(): HTMLDivElement {
  if (capa && capa.isConnected) return capa;

  capa = document.createElement("div");
  capa.className = "cargaNivel";
  document.body.appendChild(capa);
  return capa;
}

function esperar(ms: number): Promise<void> {
  return new Promise((listo) => setTimeout(listo, ms));
}

/** Deja pasar dos cuadros dibujados de verdad. */
function esperarDosCuadros(): Promise<void> {
  return new Promise((listo) =>
    requestAnimationFrame(() => requestAnimationFrame(() => listo()))
  );
}

function contenido(numeroNivel: number): string {
  const briefing = briefingsNiveles[numeroNivel];

  // El tutorial no tiene briefing: no es una S, es la explicación de los
  // controles. Se le arma su propio encabezado en vez de dejarlo en blanco.
  if (!briefing) {
    return `
      <div class="cargaNivel__caja">
        <p class="cargaNivel__rotulo">Preparando</p>
        <h1 class="cargaNivel__fase">Tutorial</h1>
        <p class="cargaNivel__traduccion">Cómo se juega</p>
        <p class="cargaNivel__contexto">
          Vas a aprender a mirar, tomar objetos y soltarlos donde corresponde.
          Son los mismos controles en las cinco fases.
        </p>
      </div>`;
  }

  const numero = String(numeroNivel).padStart(2, "0");

  return `
    <div class="cargaNivel__caja" style="--fase-color: ${briefing.color}">
      <p class="cargaNivel__rotulo">Fase ${numero}</p>
      <h1 class="cargaNivel__fase">${escapar(briefing.fase)}</h1>
      <p class="cargaNivel__traduccion">${escapar(briefing.traduccion)}</p>
      <p class="cargaNivel__contexto">${escapar(briefing.contexto)}</p>
      <div class="cargaNivel__pulso" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>`;
}

/**
 * Muestra la carga, ejecuta el armado del nivel y se retira.
 *
 * `construir` corre con la pantalla ya opaca, así que puede destruir la escena
 * y montar el garaje entero sin que se vea nada a medias.
 */
export async function cargarConPantalla(
  numeroNivel: number,
  construir: () => void | Promise<void>
): Promise<void> {
  const pantalla = obtenerCapa();

  pantalla.innerHTML = contenido(numeroNivel);
  pantalla.classList.remove("cargaNivel--saliendo");
  // Bloquea el puntero mientras tapa: un clic sobre un nivel a medio armar
  // llega a controles que todavía no existen.
  pantalla.classList.add("cargaNivel--visible");

  const desde = performance.now();

  try {
    // Dos cuadros antes de empezar: le dan al navegador la oportunidad de
    // pintar la pantalla ANTES de que el hilo se bloquee construyendo. Sin
    // esta pausa, el trabajo pesado empieza en el mismo cuadro y la pantalla
    // de carga no llega a verse nunca.
    await esperarDosCuadros();

    await construir();

    // Un par de cuadros más para que el nivel ya armado alcance a dibujarse
    // detrás. Si se quitara la capa antes, se vería el primer cuadro a medio
    // componer justo al aclarar.
    await esperarDosCuadros();
  } finally {
    // En finally: si el armado falla, la pantalla se retira igual. Quedarse
    // tapado para siempre es peor que cualquier error.
    const restante = MINIMO_MS - (performance.now() - desde);
    if (restante > 0) await esperar(restante);

    pantalla.classList.add("cargaNivel--saliendo");
    await esperar(FUNDIDO_MS);
    pantalla.classList.remove("cargaNivel--visible", "cargaNivel--saliendo");
    pantalla.innerHTML = "";
  }
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}