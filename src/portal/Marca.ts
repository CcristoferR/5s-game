// ---------------------------------------------------------------------------
// Marca ClassPlay
// ---------------------------------------------------------------------------
//
// La misma de la landing (classplay.cl): la "C" con el triángulo de
// reproducción (inicio/img/favicon.svg) y el nombre en minúsculas con el punto
// en verde. Va en una sola función para que el portal no termine con tres
// versiones del logo que se separan con el tiempo.
//
// El símbolo se dibuja en línea y no como <img>: así toma los colores del tema
// (el cuadro se aclara un poco sobre fondo oscuro para no perderse en él) y no
// cuesta una descarga.

/** Solo el símbolo: el cuadro con la C. */
export function simboloClassplay(clase = "marca__simbolo"): string {
  return `<svg class="${clase}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect class="marca__cuadro" width="64" height="64" rx="14"/><path d="M40 17H26a15 15 0 0 0 0 30h14" fill="none" stroke="#B8ED72" stroke-width="6"/><path d="m31 24 12 8-12 8z" fill="#B8ED72"/></svg>`;
}

/**
 * Símbolo y nombre juntos.
 *
 * @param etiqueta Texto opcional al costado, separado por una línea: el nombre
 *                 de la sección ("Verificación de certificados").
 */
export function marcaClassplay(opciones: { grande?: boolean; etiqueta?: string } = {}): string {
  const etiqueta = opciones.etiqueta
    ? `<span class="marca__etiqueta">${opciones.etiqueta}</span>`
    : "";
  return `<span class="marca${opciones.grande ? " marca--grande" : ""}">${simboloClassplay()}<span class="marca__nombre">classplay<span class="marca__punto">.</span></span>${etiqueta}</span>`;
}
