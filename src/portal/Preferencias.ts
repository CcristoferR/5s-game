// ---------------------------------------------------------------------------
// Preferencias de presentación
// ---------------------------------------------------------------------------
//
// Tres ajustes: tema, tamaño de texto y sonido.
//
// ─── SE GUARDAN EN EL EQUIPO, NO EN LA CUENTA ─────────────────────────────
//
// Es una decisión, no una limitación. Estos ajustes describen el PUESTO, no a
// la persona: una pantalla de planta que se ve de lejos necesita texto grande
// para todos los que la usen, y un terminal en un taller ruidoso conviene que
// esté en silencio venga quien venga. Guardarlos por cuenta obligaría a cada
// persona a reconfigurar el mismo equipo, que es al revés de lo que hace falta.
//
// Además no requieren red: se aplican antes de que haya sesión, así que la
// pantalla de acceso ya sale con el tema y el tamaño correctos en vez de
// parpadear al primer inicio de sesión.
//
// ─── ALCANCE ──────────────────────────────────────────────────────────────
//
// El tema cubre el portal: acceso, catálogo, panel de administración,
// verificación y esta misma pantalla. NO cubre el juego 5S — el garaje tiene
// su propia iluminación y no se puede "poner en claro" sin rehacerlo. El
// sonido sí afecta al juego, que es donde suena.

const CLAVE = "5s-preferencias";

export type Tema = "oscuro" | "claro";
export type EscalaTexto = "normal" | "grande" | "mayor";

export interface Preferencias {
  tema: Tema;
  escala: EscalaTexto;
  silencio: boolean;
}

const POR_DEFECTO: Preferencias = {
  tema: "oscuro",
  escala: "normal",
  silencio: false,
};

let actuales: Preferencias = { ...POR_DEFECTO };

/** Multiplicadores de la escala de texto del portal. */
const FACTOR: Record<EscalaTexto, string> = {
  normal: "1",
  grande: "1.12",
  mayor: "1.25",
};

/**
 * Lee lo guardado, tolerando cualquier cosa que haya en el almacenamiento.
 *
 * Un valor corrupto o de una versión anterior no debe dejar el portal sin
 * estilos: cada campo se valida por separado y el que no sirva vuelve a su
 * valor por defecto.
 */
function leerGuardadas(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return { ...POR_DEFECTO };

    const datos = JSON.parse(crudo) as Partial<Preferencias>;

    return {
      tema: datos.tema === "claro" ? "claro" : "oscuro",
      escala:
        datos.escala === "grande" || datos.escala === "mayor" ? datos.escala : "normal",
      silencio: datos.silencio === true,
    };
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas del equipo) o JSON
    // roto. Se sigue con los valores por defecto en vez de fallar.
    return { ...POR_DEFECTO };
  }
}

function guardar(): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actuales));
  } catch {
    // Si no se puede guardar, los ajustes valen para esta sesión y nada más.
    // Es preferible a impedir el cambio.
  }
}

/**
 * Vuelca las preferencias sobre el documento.
 *
 * Todo pasa por atributos y una variable en la raíz: el CSS hace el resto. No
 * hay estilos calculados en JavaScript ni elementos que reconstruir, así que
 * cambiar de tema no toca ni redibuja ninguna pantalla que esté abierta.
 */
function aplicar(): void {
  const raiz = document.documentElement;
  raiz.dataset.tema = actuales.tema;
  raiz.style.setProperty("--portal-escala", FACTOR[actuales.escala]);
}

/**
 * Carga y aplica las preferencias. Llamar una vez al arrancar, lo antes
 * posible: si se llama tarde, se ve un instante con el tema anterior.
 */
export function iniciarPreferencias(): Preferencias {
  actuales = leerGuardadas();
  aplicar();
  return { ...actuales };
}

export function leerPreferencias(): Preferencias {
  return { ...actuales };
}

/** Cambia uno o varios ajustes, los aplica y los guarda. */
export function cambiarPreferencias(cambios: Partial<Preferencias>): Preferencias {
  actuales = { ...actuales, ...cambios };
  aplicar();
  guardar();
  return { ...actuales };
}