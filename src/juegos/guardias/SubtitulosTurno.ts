import "./subtitulos.css";

// ===========================================================================
// Subtítulos
// ===========================================================================
//
// Lo que se dice en la sala, escrito abajo mientras dura. Sin nombre de quién
// lo dice: eso lo cuenta la escena —quién abre la boca, quién grita con el
// brazo estirado— y es parte de lo que hay que mirar.
//
// El tiempo lo lleva quien lo usa, cuadro a cuadro (ver avanzar): así la
// pausa detiene también la frase a la mitad, igual que detiene a la gente.

export interface Subtitulos {
  /** Escribe la frase y la deja esos segundos. Si había otra, la reemplaza. */
  decir(texto: string, segundos: number): void;
  /** Cuenta el tiempo. Se llama cada cuadro con el paso del turno. */
  avanzar(dt: number): void;
  /** Los esconde del todo —la pausa— o los devuelve como estaban. */
  mostrar(si: boolean): void;
  dispose(): void;
}

export function crearSubtitulos(): Subtitulos {
  const caja = document.createElement("div");
  caja.className = "subtitulosTurno";
  caja.setAttribute("aria-live", "polite");
  document.body.appendChild(caja);
  let queda = 0;

  return {
    decir(texto, segundos) {
      caja.textContent = `«${texto}»`;
      caja.classList.add("subtitulosTurno--visible");
      queda = segundos;
    },
    avanzar(dt) {
      if (queda <= 0) return;
      queda -= dt;
      if (queda <= 0) caja.classList.remove("subtitulosTurno--visible");
    },
    mostrar(si) {
      caja.classList.toggle("subtitulosTurno--oculto", !si);
    },
    dispose() {
      caja.remove();
    },
  };
}
