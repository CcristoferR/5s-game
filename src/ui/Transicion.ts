// ---------------------------------------------------------------------------
// Fundido entre pantallas
// ---------------------------------------------------------------------------
//
// Del menú al nivel se saltaba de golpe: un cuadro con el menú, el siguiente
// con el garaje ya armado. Un oscurecido breve y parcial suaviza ese corte.
//
// La clave es que NO tapa del todo. Un fundido a negro completo se percibe
// como un cambio de color metido en el medio; este solo baja un poco la luz
// durante ciento treinta milisegundos y vuelve. Se nota que hubo un cambio,
// no se nota qué lo produjo.
//
// ─── POR QUÉ ES UNA CAPA DEL NAVEGADOR Y NO DE LA ESCENA ──────────────────
//
// Es la decisión que hace que esto funcione. Al volver al menú el juego
// destruye la escena y arma otra; una capa hecha con la interfaz de Babylon
// vive DENTRO de la escena, así que se destruiría justo en el medio del
// fundido y el corte quedaría a la vista — que es exactamente lo que se
// quiere tapar.
//
// Un div sobre el lienzo es ajeno a todo eso. Sobrevive a la destrucción de la
// escena, no depende de que haya un cuadro dibujándose, y el navegador anima
// su opacidad por su cuenta aunque el hilo principal esté ocupado armando el
// nivel. Es más simple y además es lo único que aguanta el caso.
//
// ─── POR QUÉ NO ESTORBA ───────────────────────────────────────────────────
//
//   - Solo intercepta clics mientras está opaca. El resto del tiempo es
//     transparente a los eventos, así que no se interpone jamás.
//   - Si la acción falla, la capa se levanta igual: nunca deja la pantalla
//     tapada por un error.
//   - Si el sistema pide menos animación, no hay fundido: el cambio ocurre
//     igual, sin espera.

/** Duración de cada mitad del fundido. */
const MILISEGUNDOS = 130;

/**
 * Cuánto llega a oscurecer, de 0 a 1.
 *
 * No llega a 1 a propósito. Tapar del todo se percibe como un corte a negro
 * —un cambio de color, no una transición— y era justamente lo que sobraba.
 * A 0,55 el cambio se suaviza sin que la pantalla llegue a cambiar de tono:
 * se nota que algo pasó, no se nota qué.
 *
 * Poniendo 0 acá el fundido queda desactivado por completo, sin tocar nada
 * más del juego.
 */
const OPACIDAD_MAXIMA = 0.55;

let capa: HTMLDivElement | null = null;
let enCurso = false;

/** ¿El sistema pide reducir las animaciones? */
function prefiereSinMovimiento(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function obtenerCapa(): HTMLDivElement {
  if (capa && capa.isConnected) return capa;

  capa = document.createElement("div");
  capa.id = "fundidoPantalla";

  Object.assign(capa.style, {
    position: "fixed",
    inset: "0",
    // El mismo tono del fondo del menú: así el fundido parece llevar a la
    // pantalla siguiente en vez de pasar por un negro que no es de nadie.
    background: "#06080a",
    opacity: "0",
    // Transparente a los clics mientras no tapa nada.
    pointerEvents: "none",
    // Por encima del lienzo, por debajo de cualquier diálogo del navegador.
    zIndex: "40",
    transition: `opacity ${MILISEGUNDOS}ms ease`,
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.appendChild(capa);
  return capa;
}

/** Espera a que termine la animación de opacidad, o el tiempo previsto. */
function esperarFundido(elemento: HTMLElement): Promise<void> {
  return new Promise((listo) => {
    let terminado = false;

    const cerrar = (): void => {
      if (terminado) return;
      terminado = true;
      elemento.removeEventListener("transitionend", cerrar);
      listo();
    };

    elemento.addEventListener("transitionend", cerrar);

    // Respaldo por tiempo: si la pestaña está en segundo plano el navegador no
    // dispara transitionend, y sin esto la promesa no se resolvería nunca y el
    // juego quedaría trabado detrás de una capa opaca.
    setTimeout(cerrar, MILISEGUNDOS + 80);
  });
}

/** Deja pasar dos cuadros, para que la pantalla nueva alcance a dibujarse. */
function esperarDosCuadros(): Promise<void> {
  return new Promise((listo) =>
    requestAnimationFrame(() => requestAnimationFrame(() => listo()))
  );
}

/**
 * Oscurece la pantalla, ejecuta el cambio y vuelve a aclarar.
 *
 * `accion` es lo que arma la pantalla siguiente. Corre con la capa ya opaca,
 * así que puede destruir la escena y construir otra sin que se vea nada.
 */
export async function fundirEntrePantallas(accion: () => void | Promise<void>): Promise<void> {
  // Dos cambios encimados dejarían la capa a medio camino: el segundo la
  // aclararía mientras el primero todavía la está oscureciendo.
  if (enCurso) return;

  if (OPACIDAD_MAXIMA <= 0 || prefiereSinMovimiento()) {
    await accion();
    return;
  }

  enCurso = true;
  const fundido = obtenerCapa();

  try {
    // Mientras tapa, también bloquea: un clic sobre una escena a medio armar
    // llega a controles que ya no existen o que todavía no están listos.
    fundido.style.pointerEvents = "auto";
    fundido.style.opacity = `${OPACIDAD_MAXIMA}`;
    await esperarFundido(fundido);

    await accion();

    // La pantalla nueva se dibuja con la capa todavía opaca. Sin esta espera
    // se vería el primer cuadro a medio armar justo cuando empieza a aclarar.
    await esperarDosCuadros();
  } finally {
    // En finally a propósito: si la acción falla, la capa se levanta igual.
    // Una pantalla tapada para siempre es peor que cualquier error.
    fundido.style.opacity = "0";
    fundido.style.pointerEvents = "none";
    enCurso = false;
  }
}