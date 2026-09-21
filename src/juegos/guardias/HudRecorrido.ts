import "./hudRecorrido.css";

// ===========================================================================
// Rótulos del recorrido: la hora del turno, la ronda y el nombre de la zona
// ===========================================================================
//
// Arriba, el reloj del turno y, debajo, la lista de la ronda en curso. Arriba
// a la izquierda, la radio: lo que Central te pide que revises y lo que te
// cuenta después. Abajo, al cruzar a otra zona, su nombre, y encima de él lo
// que estás observando.
//
// ─── POR QUÉ HTML Y NO LA GUI DE BABYLON ──────────────────────────────────
//
// El libro del condominio va en la GUI de Babylon porque sus paneles se
// manejan: botones, listas con scroll, velos que bloquean el puntero. Esto no
// se toca. Son rótulos que se leen de reojo mientras se camina, y lo que
// piden es letra espaciada, fundidos que no dependan del ritmo del render y
// nitidez con cualquier escala de Windows. El navegador lo da hecho; en la GUI
// habría que imitarlo. Las tarjetas del turno, que sí se leen con calma y se
// cierran con un botón, van en la GUI: ver PanelesSupermercado.
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

/** Lo que muestra la lista de la ronda. */
export interface VistaRonda {
  titulo: string;
  estado: "curso" | "completa" | "incompleta";
  zonas: { nombre: string; hecha: boolean }[];
}

/** Algo que está ocurriendo y de lo que te han avisado. */
export interface PistaHud {
  /** Para saber si es la misma de antes o una nueva. */
  clave: string;
  /** Si llega por radio o te la da la propia sala (alguien que te llama). */
  de: "central" | "sala";
  texto: string;
}

/** Lo que estás mirando y cuánto te falta. */
export interface MiradaHud {
  /** De 0 a 1. */
  fraccion: number;
  /** Ya miraste bastante; lo que importa todavía no ha pasado. */
  esperando: boolean;
}

export interface HudRecorrido {
  /** Hace aparecer los rótulos. Hasta entonces existen, pero no se ven. */
  mostrar(): void;
  /** Los retira, para cuando se acaba el turno. */
  ocultar(): void;
  ponerHora(texto: string): void;
  /** Marca en el reloj que el turno va adelantado, o lo devuelve a su rótulo. */
  ponerAdelanto(activo: boolean): void;
  /** Saca abajo el nombre de una zona, y lo retira solo. */
  anunciarZona(nombre: string, bajada: string): void;
  /** Pinta la ronda en curso. Si hay un aviso a la vista, espera a que acabe. */
  ponerRonda(vista: VistaRonda): void;
  /**
   * Deja una ronda a la vista unos segundos aunque ya haya empezado otra.
   *
   * Es para la que vence a medias: la siguiente abre en el mismo minuto, y
   * pintándola encima nadie llegaría a ver qué faltó.
   */
  avisarRonda(vista: VistaRonda, duracionMs: number): void;
  /**
   * Los avisos vigentes: una línea por situación abierta que todavía no has
   * visto. Se llama cada cuadro; solo toca el DOM cuando cambian.
   *
   * Devuelve las claves que acaban de aparecer, para que quien llama pueda
   * hacer sonar la radio una vez por aviso y no una por cuadro.
   */
  ponerPistas(pistas: PistaHud[]): string[];
  /** Un mensaje de radio que se queda unos segundos y se va solo. */
  avisarRadio(texto: string, duracionMs: number): void;
  /** El medidor de lo que estás observando. Null lo esconde. */
  ponerMirada(mirada: MiradaHud | null): void;
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
  const turno = elemento("span", "hudRecorrido__turno", opciones.turno);
  reloj.append(hora, turno);
  let adelantando = false;

  const ronda = elemento("div", "hudRecorrido__ronda");
  const tituloRonda = elemento("p", "hudRecorrido__rondaTitulo");
  const listaRonda = elemento("ul", "hudRecorrido__rondaLista");
  ronda.append(tituloRonda, listaRonda);

  const zona = elemento("div", "hudRecorrido__zona");
  const titulo = elemento("p", "hudRecorrido__nombre");
  const nombre = elemento("span", "hudRecorrido__nombreTexto");
  titulo.append(nombre);
  const bajada = elemento("p", "hudRecorrido__bajada");
  zona.append(titulo, bajada);

  // La radio, arriba a la izquierda: lejos del reloj y de la ronda, que se
  // leen juntos, y donde se lee un mensaje sin taparle a nadie la sala.
  const radio = elemento("div", "hudRecorrido__radio");
  const vigentes = elemento("div", "hudRecorrido__radioVigentes");
  const pasados = elemento("div", "hudRecorrido__radioPasados");
  radio.append(vigentes, pasados);
  let clavesVigentes: string[] = [];

  // Lo que estás observando: una barra que se llena mientras lo tienes
  // delante. Es lo que le dice a quien no lo ha jugado nunca que mirar a la
  // gente es la mecánica — y que hay que quedarse mirando.
  const mirada = elemento("div", "hudRecorrido__mirada");
  const miradaTexto = elemento("span", "hudRecorrido__miradaTexto", "Observando");
  const miradaBarra = elemento("span", "hudRecorrido__miradaBarra");
  const miradaRelleno = elemento("span", "hudRecorrido__miradaRelleno");
  miradaBarra.append(miradaRelleno);
  mirada.append(miradaTexto, miradaBarra);
  let miradaEstado: "oculta" | "llenando" | "esperando" = "oculta";

  raiz.append(reloj, ronda, zona, radio, mirada);
  document.body.appendChild(raiz);

  let temporizadorZona: ReturnType<typeof setTimeout> | undefined;
  let temporizadorAviso: ReturnType<typeof setTimeout> | undefined;
  let enAviso = false;
  let pendiente: VistaRonda | null = null;
  /** Las zonas que ya estaban marcadas, para saber cuál acaba de marcarse. */
  let marcadas = new Set<string>();

  function aparecer(textoNombre: string, textoBajada: string): void {
    nombre.textContent = textoNombre;
    bajada.textContent = textoBajada;
    zona.classList.remove("hudRecorrido__zona--relevo");
    zona.classList.add("hudRecorrido__zona--visible");
    temporizadorZona = setTimeout(() => {
      zona.classList.remove("hudRecorrido__zona--visible");
    }, ZONA_A_LA_VISTA_MS);
  }

  function pintarRonda(vista: VistaRonda): void {
    ronda.className = `hudRecorrido__ronda hudRecorrido__ronda--${vista.estado}`;
    tituloRonda.textContent = vista.titulo;
    listaRonda.replaceChildren(
      ...vista.zonas.map((z) => {
        const clases = ["hudRecorrido__rondaZona"];
        if (z.hecha) clases.push("hudRecorrido__rondaZona--hecha");
        // Solo late la que se marca AHORA: si latieran todas en cada repintado,
        // el ojo no sabría cuál es la nueva.
        if (z.hecha && !marcadas.has(z.nombre)) clases.push("hudRecorrido__rondaZona--recien");
        const item = elemento("li", clases.join(" "));
        item.append(elemento("span", "hudRecorrido__casilla"), document.createTextNode(z.nombre));
        return item;
      })
    );
    marcadas = new Set(vista.zonas.filter((z) => z.hecha).map((z) => z.nombre));
  }

  return {
    mostrar() {
      raiz.classList.add("hudRecorrido--visible");
    },

    ocultar() {
      raiz.classList.remove("hudRecorrido--visible");
    },

    ponerHora(texto) {
      hora.textContent = texto;
    },

    ponerAdelanto(activo) {
      // Llega en cada minuto del turno: solo se toca el DOM cuando cambia.
      if (activo === adelantando) return;
      adelantando = activo;
      reloj.classList.toggle("hudRecorrido__reloj--adelantando", activo);
      turno.textContent = activo ? "Adelantando »" : opciones.turno;
    },

    anunciarZona(textoNombre, textoBajada) {
      clearTimeout(temporizadorZona);

      // Si el anterior todavía se ve —entero o yéndose— se retira deprisa y
      // entra el nuevo. Cambiarle las letras a un rótulo que está a la vista
      // se lee como un parpadeo, no como haber llegado a otro sitio.
      if (Number(window.getComputedStyle(zona).opacity) > 0.02) {
        zona.classList.add("hudRecorrido__zona--relevo");
        zona.classList.remove("hudRecorrido__zona--visible");
        temporizadorZona = setTimeout(() => aparecer(textoNombre, textoBajada), RELEVO_MS);
        return;
      }

      aparecer(textoNombre, textoBajada);
    },

    ponerRonda(vista) {
      if (enAviso) {
        pendiente = vista;
        return;
      }
      pintarRonda(vista);
    },

    avisarRonda(vista, duracionMs) {
      clearTimeout(temporizadorAviso);
      enAviso = true;
      pintarRonda(vista);
      temporizadorAviso = setTimeout(() => {
        enAviso = false;
        if (pendiente) {
          pintarRonda(pendiente);
          pendiente = null;
        }
      }, duracionMs);
    },

    ponerPistas(pistas) {
      const claves = pistas.map((p) => p.clave);
      if (claves.join("|") === clavesVigentes.join("|")) return [];
      const nuevas = claves.filter((c) => !clavesVigentes.includes(c));
      clavesVigentes = claves;
      vigentes.replaceChildren(
        ...pistas.map((p) => {
          const clases = ["hudRecorrido__mensaje", "hudRecorrido__mensaje--vigente"];
          if (nuevas.includes(p.clave)) clases.push("hudRecorrido__mensaje--nuevo");
          const caja = elemento("div", clases.join(" "));
          const quien = elemento("span", "hudRecorrido__mensajeQuien", p.de === "central" ? "Radio · Central" : "En la sala");
          caja.append(quien, elemento("span", "hudRecorrido__mensajeTexto", p.texto));
          return caja;
        })
      );
      return nuevas;
    },

    avisarRadio(texto, duracionMs) {
      const caja = elemento("div", "hudRecorrido__mensaje hudRecorrido__mensaje--pasado hudRecorrido__mensaje--nuevo");
      caja.append(
        elemento("span", "hudRecorrido__mensajeQuien", "Radio · Central"),
        elemento("span", "hudRecorrido__mensajeTexto", texto)
      );
      pasados.prepend(caja);
      // Se va solo: primero se apaga y después se quita, para que el que
      // tenga debajo suba sin salto.
      setTimeout(() => caja.classList.add("hudRecorrido__mensaje--saliendo"), duracionMs);
      setTimeout(() => caja.remove(), duracionMs + 600);
    },

    ponerMirada(estado) {
      const nuevo = !estado ? "oculta" : estado.esperando ? "esperando" : "llenando";
      if (estado) miradaRelleno.style.transform = `scaleX(${estado.fraccion.toFixed(3)})`;
      if (nuevo === miradaEstado) return;
      miradaEstado = nuevo;
      mirada.classList.toggle("hudRecorrido__mirada--visible", nuevo !== "oculta");
      mirada.classList.toggle("hudRecorrido__mirada--esperando", nuevo === "esperando");
      // Llena, pero lo que importa todavía no ha pasado: que siga mirando.
      miradaTexto.textContent = nuevo === "esperando" ? "Sigue mirando…" : "Observando";
    },

    dispose() {
      clearTimeout(temporizadorZona);
      clearTimeout(temporizadorAviso);
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
