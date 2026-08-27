import "./portal.css";
import {
  catalogoDe,
  inscribirPerfilExistente,
  explicarRechazo,
  type Perfil,
  type TarjetaCurso,
} from "./Datos";
import { cerrarSesion } from "./Sesion";

/**
 * Catálogo de cursos.
 *
 * Es la pantalla que el trabajador ve al entrar. Muestra los cursos que la
 * plataforma tiene disponibles y, en cada uno, en qué está esa persona.
 *
 * Dos decisiones que vale la pena explicar:
 *
 *  1. EL CÓDIGO SE CANJEA ACÁ, NO EN EL LOGIN. Antes el código daba acceso a
 *     la plataforma entera; ahora inscribe a UN curso. Es lo que corresponde
 *     cuando hay varios: si mañana hay un curso de seguridad, tendrá su propio
 *     código y su propia inscripción, sin tocar la cuenta de la persona.
 *
 *  2. LA TARJETA MUESTRA ESTADO, NO SOLO EL NOMBRE. Sin saber si lo empezó, en
 *     qué fase va o si ya lo terminó, esto sería un menú y nada más. El estado
 *     lo calcula Datos.ts, así que si cambia la regla de "curso completo"
 *     cambia en un solo lugar.
 */
export function mostrarCatalogo(
  perfil: Perfil,
  onEntrarCurso: (cursoId: string) => void,
  onSalir: () => void
): void {
  const raiz = document.createElement("div");
  raiz.className = "portal portal--pagina";
  document.body.appendChild(raiz);

  void pintar();

  async function pintar(): Promise<void> {
    const tarjetas = await catalogoDe(perfil.id);
    raiz.innerHTML = plantilla(perfil, tarjetas);
    conectar(tarjetas);
  }

  function conectar(tarjetas: TarjetaCurso[]): void {
    raiz.querySelector<HTMLButtonElement>("#salirCatalogo")?.addEventListener("click", () => {
      cerrarSesion();
      raiz.remove();
      onSalir();
    });

    // Entrar al curso. El id viaja en el botón porque mañana habrá varios y
    // cada uno tiene que saber cuál abre.
    raiz.querySelectorAll<HTMLButtonElement>("[data-entrar]").forEach((boton) => {
      boton.addEventListener("click", () => {
        raiz.remove();
        onEntrarCurso(boton.dataset.entrar!);
      });
    });

    // Canje del código, desplegado dentro de la propia tarjeta.
    raiz.querySelectorAll<HTMLButtonElement>("[data-abrir-canje]").forEach((boton) => {
      boton.addEventListener("click", () => {
        const zona = raiz.querySelector<HTMLDivElement>(`#canje-${boton.dataset.abrirCanje}`);
        if (!zona) return;
        zona.hidden = false;
        boton.hidden = true;
        zona.querySelector<HTMLInputElement>("input")?.focus();
      });
    });

    raiz.querySelectorAll<HTMLFormElement>("[data-form-canje]").forEach((form) => {
      form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const cursoId = form.dataset.formCanje!;
        const campo = form.querySelector<HTMLInputElement>("input")!;
        const aviso = form.querySelector<HTMLParagraphElement>(".portal__aviso")!;

        const codigo = campo.value.trim();
        if (!codigo) {
          mostrar(aviso, "Escribe el código que te entregaron.", "error");
          return;
        }

        const resultado = await inscribirPerfilExistente(perfil, codigo);
        if (!resultado.ok) {
          mostrar(aviso, explicarRechazo(resultado.motivo!), "error");
          return;
        }

        // Se vuelve a pintar entero en vez de retocar la tarjeta: el estado lo
        // calcula Datos.ts y así no hay dos versiones de la misma regla.
        const tarjeta = tarjetas.find((t) => t.curso.id === cursoId);
        void tarjeta;
        await pintar();
      });
    });
  }
}

function mostrar(banda: HTMLElement, texto: string, tipo: "ok" | "error"): void {
  banda.textContent = texto;
  banda.className = `portal__aviso portal__aviso--${tipo}`;
  banda.hidden = false;
}

// ---------------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------------

function plantilla(perfil: Perfil, tarjetas: TarjetaCurso[]): string {
  const disponibles = tarjetas.length;
  const enCurso = tarjetas.filter((t) => t.estado === "en_curso").length;
  const listos = tarjetas.filter((t) => t.estado === "completado").length;

  return `
    <header class="barra">
      <div class="barra__marca">
        <span class="barra__sello">5S</span>
        <span class="barra__nombre">Plataforma de capacitación</span>
      </div>

      <div class="barra__cuenta">
        <span class="barra__inicial">${escapar(iniciales(perfil.nombreCompleto))}</span>
        <span class="barra__datos">
          <strong>${escapar(perfil.nombreCompleto)}</strong>
          <small>${escapar(ubicacion(perfil))}</small>
        </span>
        <button class="boton boton--borde" id="salirCatalogo" type="button">Cerrar sesión</button>
      </div>
    </header>

    <main class="lamina">
      <div class="lamina__encabezado">
        <div>
          <h1 class="lamina__titulo">Tus cursos</h1>
          <p class="lamina__bajada">
            ${disponibles === 1 ? "1 curso disponible" : `${disponibles} cursos disponibles`}
          </p>
        </div>

        ${
          enCurso + listos > 0
            ? `<div class="lamina__resumen">
                 ${enCurso > 0 ? `<span><strong>${enCurso}</strong> en curso</span>` : ""}
                 ${listos > 0 ? `<span><strong>${listos}</strong> completado${listos === 1 ? "" : "s"}</span>` : ""}
               </div>`
            : ""
        }
      </div>

      ${
        disponibles === 0
          ? `<p class="lamina__vacio">Todavía no hay cursos publicados. Consulta con tu supervisor.</p>`
          : `<div class="rejilla">${tarjetas.map(tarjetaCurso).join("")}</div>`
      }
    </main>
  `;
}

/** Iniciales para el círculo de la barra: "Cristofer Alvarado" da "CA". */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Empresa y área, si están cargadas. Da contexto en un equipo compartido. */
function ubicacion(perfil: Perfil): string {
  const partes = [perfil.area, perfil.empresa].filter((x) => x && x.trim());
  return partes.length ? partes.join(" · ") : "Trabajador";
}

function tarjetaCurso(t: TarjetaCurso): string {
  const { curso, estado, fasesHechas, porcentaje } = t;

  // El filete superior toma el color del estado: se distingue de un vistazo
  // en qué está cada curso sin tener que leer la insignia.
  const colorFilete: Record<typeof estado, string> = {
    sin_inscribir: "curso__filete--bloqueado",
    sin_empezar: "curso__filete--nuevo",
    en_curso: "curso__filete--activo",
    completado: "curso__filete--listo",
  };

  const insignias: Record<typeof estado, string> = {
    sin_inscribir: `<span class="pastilla pastilla--gris">Requiere código</span>`,
    sin_empezar: `<span class="pastilla pastilla--gris">Sin empezar</span>`,
    en_curso: `<span class="pastilla pastilla--verde">En curso</span>`,
    completado: `<span class="pastilla pastilla--verde">Completado</span>`,
  };

  const acciones: Record<typeof estado, string> = {
    sin_inscribir: `<button class="boton boton--borde" type="button" data-abrir-canje="${curso.id}">Ingresar código</button>`,
    sin_empezar: `<button class="boton boton--principal" type="button" data-entrar="${curso.id}">Comenzar</button>`,
    en_curso: `<button class="boton boton--principal" type="button" data-entrar="${curso.id}">Continuar</button>`,
    completado: `<button class="boton boton--borde" type="button" data-entrar="${curso.id}">Ver certificado</button>`,
  };

  // La barra solo aparece cuando hay algo que mostrar. Al 0% es ruido visual
  // y encima transmite la idea equivocada de que ya se empezó.
  const avance =
    estado === "en_curso" || estado === "completado"
      ? `<div class="avance">
           <div class="avance__cifras">
             <span>${fasesHechas} de ${curso.totalFases} fases</span>
             <span>${porcentaje}%</span>
           </div>
           <div class="avance__carril"><span style="width:${porcentaje}%"></span></div>
         </div>`
      : "";

  return `
    <article class="curso">
      <div class="curso__filete ${colorFilete[estado]}"></div>

      <div class="curso__cuerpo">
        <div class="curso__titulo">
          <h2>${escapar(curso.nombre)}</h2>
          ${insignias[estado]}
        </div>

        <p class="curso__desc">${escapar(curso.descripcion)}</p>

        <div class="curso__datos">
          <span>${curso.totalFases} fases</span>
          <span class="curso__punto"></span>
          <span>${curso.duracionMinutos} min aprox.</span>
        </div>

        ${avance}

        <div class="curso__pie">${acciones[estado]}</div>

        <div class="canje" id="canje-${curso.id}" hidden>
          <form data-form-canje="${curso.id}">
            <label class="canje__rotulo" for="cod-${curso.id}">
              Escribe el código que te entregó tu supervisor
            </label>
            <div class="canje__fila">
              <input class="canje__campo" id="cod-${curso.id}"
                     placeholder="5S-XXXXX-XXXX" autocomplete="off" spellcheck="false" />
              <button class="boton boton--principal" type="submit">Canjear</button>
            </div>
            <p class="portal__aviso" hidden></p>
          </form>
        </div>
      </div>
    </article>
  `;
}

/** Evita que un nombre con < o & rompa el marcado. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}