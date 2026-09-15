import "./hudRecorrido.css";

// ===========================================================================
// Rótulos del recorrido: la hora del turno y el nombre de la zona
// ===========================================================================
//
// Arriba, el reloj del turno. Abajo, al cruzar a otra zona, su nombre.
//
// ─── POR QUÉ HTML Y NO LA GUI DE BABYLON ──────────────────────────────────
//
// El libro del condominio va en la GUI de Babylon porque sus paneles se
// manejan: botones, listas con scroll, velos que bloquean el puntero. Esto no
// se toca. Son dos rótulos que se leen de reojo mientras se camina, y lo que
// piden es letra espaciada, fundidos que no dependan del ritmo del render y
// nitidez con cualquier escala de Windows. El navegador lo da hecho; en la GUI
// habría que imitarlo.
//
// Nada de esto recibe el puntero, así que no le roba a la cámara ni un
// arrastre. Y queda por debajo de la pantalla de carga, que lo tapa mientras
// se monta el escenario.

export interface OpcionesHud {
  /** La hora que marca el reloj antes de arrancar. */
  hora: string;
  /** El rótulo chico bajo la hora. */
  turno: string;
  /** Color del escenario: el mismo de su pantalla de carga. */
  acento: string;
}

export interface HudRecorrido {
  /** Hace aparecer los rótulos. Hasta entonces existen, pero no se ven. */
  mostrar(): void;
  ponerHora(texto: string): void;
  /** Saca abajo el nombre de una zona, y lo retira solo. */
  anunciarZona(nombre: string, bajada: string): void;
  dispose(): void;
}

/**
 * Lo que el nombre de la zona se queda a la vista.
 *
 * Lo justo para leerlo sin dejar de caminar. Si se quedara, pasaría a ser
 * parte del paisaje, y lo que tiene que notarse es que APARECE al cruzar.
 */
const ZONA_A_LA_VISTA_MS = 2600;

/** Lo que tarda en irse un nombre cuando llega otro encima. */
const RELEVO_MS = 180;

export function crearHudRecorrido(opciones: OpcionesHud): HudRecorrido {
  const raiz = elemento("div", "hudRecorrido");
  raiz.style.setProperty("--acento", opciones.acento);

  const reloj = elemento("div", "hudRecorrido__reloj");
  const hora = elemento("span", "hudRecorrido__hora", opciones.hora);
  reloj.append(hora, elemento("span", "hudRecorrido__turno", opciones.turno));

  const zona = elemento("div", "hudRecorrido__zona");
  const titulo = elemento("p", "hudRecorrido__nombre");
  const nombre = elemento("span", "hudRecorrido__nombreTexto");
  titulo.append(nombre);
  const bajada = elemento("p", "hudRecorrido__bajada");
  zona.append(titulo, bajada);

  raiz.append(reloj, zona);
  document.body.appendChild(raiz);

  let temporizador: ReturnType<typeof setTimeout> | undefined;

  function aparecer(textoNombre: string, textoBajada: string): void {
    nombre.textContent = textoNombre;
    bajada.textContent = textoBajada;
    zona.classList.remove("hudRecorrido__zona--relevo");
    zona.classList.add("hudRecorrido__zona--visible");
    temporizador = setTimeout(() => {
      zona.classList.remove("hudRecorrido__zona--visible");
    }, ZONA_A_LA_VISTA_MS);
  }

  return {
    mostrar() {
      raiz.classList.add("hudRecorrido--visible");
    },

    ponerHora(texto) {
      hora.textContent = texto;
    },

    anunciarZona(textoNombre, textoBajada) {
      clearTimeout(temporizador);

      // Si el anterior todavía se ve —entero o yéndose— se retira deprisa y
      // entra el nuevo. Cambiarle las letras a un rótulo que está a la vista
      // se lee como un parpadeo, no como haber llegado a otro sitio.
      if (Number(window.getComputedStyle(zona).opacity) > 0.02) {
        zona.classList.add("hudRecorrido__zona--relevo");
        zona.classList.remove("hudRecorrido__zona--visible");
        temporizador = setTimeout(() => aparecer(textoNombre, textoBajada), RELEVO_MS);
        return;
      }

      aparecer(textoNombre, textoBajada);
    },

    dispose() {
      clearTimeout(temporizador);
      raiz.remove();
    },
  };
}

function elemento<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase: string,
  texto = ""
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  nodo.className = clase;
  nodo.textContent = texto;
  return nodo;
}
