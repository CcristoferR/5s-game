// ===========================================================================
// Mi progreso
// ===========================================================================
//
// Lo que cada persona ve de sí misma en Mi cuenta: en qué va de cada curso,
// la nota o el puntaje de su mejor intento en cada fase, el tiempo que le
// tomó, su lugar en el ranking de su empresa y sus certificados, que puede
// volver a descargar cuando quiera.
//
// ─── TODO SALE DEL SERVIDOR ───────────────────────────────────────────────
//
// Nada de esto se lee del historial guardado en el navegador: en un
// computador compartido de planta ese historial es del equipo, no de la
// persona. Las tablas solo devuelven las filas propias (las políticas de la
// base hacen el recorte), así que esta pantalla no puede mostrar nada ajeno.
//
// El servidor guarda el MEJOR intento de cada fase, no cada partida. Por eso
// el tiempo que se muestra es el de esos intentos, y así se dice.

import {
  emitirCertificado,
  listarCertificados,
  listarCursos,
  listarInscripciones,
  listarProgreso,
  type Perfil,
} from "./Datos";
import { misResultados, miPosicion, type MiPosicion, type ResultadoFase } from "./Ranking";
import { describirCurso } from "./CatalogoCursos";
import { CURSO_5S, CURSO_GUARDIAS } from "./CursosJugables";
import {
  CERTIFICADO_5S,
  CERTIFICADO_GUARDIAS,
  descargarCertificado,
  generarCertificado,
  type DisenoCertificado,
} from "../core/Certificate";
import { icono } from "./Iconos";
import { armarMatriculas, type Matricula } from "./admin/Indicadores";
import { duracion, escapar, fechaCorta, numero } from "./admin/Formato";
import { manejar } from "./Manejador";

/** El papel de cada curso. Un curso sin diseño propio muestra su código, sin descarga. */
const DISENOS: Record<string, DisenoCertificado> = {
  [CURSO_5S]: CERTIFICADO_5S,
  [CURSO_GUARDIAS]: CERTIFICADO_GUARDIAS,
};

export function seccionMiProgreso(): string {
  return `
    <section class="portal__seccion" aria-labelledby="tMiProgreso">
      <h2 class="portal__tituloSeccion" id="tMiProgreso">Mi progreso</h2>
      <div class="progresos" id="miProgreso" aria-busy="true">
        <div class="progreso progreso--hueso">
          <span class="progreso__hueso progreso__hueso--titulo"></span>
          <span class="progreso__hueso"></span>
          <span class="progreso__hueso"></span>
        </div>
      </div>
    </section>`;
}

/**
 * Carga y dibuja el progreso dentro de la zona de seccionMiProgreso().
 *
 * @param avisar La banda de avisos de la pantalla, para errores al emitir.
 */
export function montarMiProgreso(
  raiz: HTMLElement,
  perfil: Perfil,
  avisar: (texto: string, tipo: "ok" | "error") => void
): void {
  const zona = raiz.querySelector<HTMLElement>("#miProgreso");
  if (!zona) return;

  zona.addEventListener(
    "click",
    manejar("mi progreso", async (evento: MouseEvent) => {
      const boton = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-descargar]");
      if (!boton || boton.disabled) return;

      const cursoId = boton.dataset.descargar!;
      const diseno = DISENOS[cursoId];
      if (!diseno) return;

      const contenido = boton.innerHTML;
      boton.disabled = true;
      boton.textContent = "Preparando…";

      try {
        // Reentrante: si ya estaba emitido devuelve el mismo código, así el
        // papel que ya circula sigue siendo válido.
        const resultado = await emitirCertificado(cursoId);
        if (!resultado.ok) {
          avisar(
            resultado.motivo === "curso_incompleto"
              ? "Todavía te faltan fases para obtener el certificado."
              : "No se pudo preparar el certificado. Revisa tu conexión e intenta de nuevo.",
            "error"
          );
          return;
        }

        descargarCertificado(generarCertificado(resultado.certificado, undefined, diseno), resultado.certificado.codigo, diseno);
        avisar(`Certificado ${resultado.certificado.codigo} descargado.`, "ok");

        // Si se acaba de emitir, el código todavía no estaba en pantalla.
        if (boton.dataset.emitido !== "1") await cargar();
      } finally {
        if (boton.isConnected) {
          boton.disabled = false;
          boton.innerHTML = contenido;
        }
      }
    })
  );

  void cargar();

  async function cargar(): Promise<void> {
    try {
      const [inscripciones, cursos, progresos, resultados, certificados] = await Promise.all([
        listarInscripciones(),
        listarCursos(),
        listarProgreso(),
        misResultados(),
        listarCertificados(),
      ]);

      // Las políticas ya recortan a lo propio; el filtro es por si algún día
      // esta pantalla la abre alguien con más permisos.
      const matriculas = armarMatriculas({
        perfiles: [perfil],
        cursos,
        inscripciones: inscripciones.filter((i) => i.perfilId === perfil.id),
        progresos: progresos.filter((p) => p.perfilId === perfil.id),
        certificados: certificados.filter((c) => c.perfilId === perfil.id),
      })
        // Una inscripción dada de baja se muestra solo si dejó un certificado:
        // ese papel sigue siendo de la persona.
        .filter((m) => m.inscripcion.activa || m.certificado)
        .sort((a, b) => Number(b.inscripcion.activa) - Number(a.inscripcion.activa));

      const posiciones = new Map(
        await Promise.all(
          matriculas
            .filter((m) => m.fasesHechas.length > 0)
            .map(async (m) => [m.curso.id, await miPosicion(m.curso.id)] as const)
        )
      );

      zona!.innerHTML =
        matriculas.length === 0
          ? `<p class="progresos__vacio">${icono("info")}<span>Todavía no estás inscrito en ningún curso. Canjea en <strong>Tus cursos</strong> el código que te entregó tu supervisor.</span></p>`
          : matriculas
              .map((m) => tarjeta(m, resultados.filter((r) => r.cursoId === m.curso.id), posiciones.get(m.curso.id) ?? null, perfil))
              .join("");
    } catch (error) {
      console.error("[mi progreso]", error);
      zona!.innerHTML = `<p class="progresos__vacio">${icono("alerta")}<span>No se pudo cargar tu progreso. Revisa tu conexión y vuelve a abrir Mi cuenta.</span></p>`;
    } finally {
      zona!.removeAttribute("aria-busy");
    }
  }
}

function tarjeta(m: Matricula, resultados: ResultadoFase[], posicion: MiPosicion | null, perfil: Perfil): string {
  const desc = describirCurso(m.curso);
  const total = m.curso.totalFases;
  const hechas = Math.min(m.fasesHechas.length, total);
  const porFase = new Map(resultados.filter((r) => r.fase >= 1).map((r) => [r.fase, r]));
  const medida = (n: number): string => (desc.medida.una === "nota" ? `Nota ${numero(n)}` : `${numero(n)} pts`);

  const pastilla = !m.inscripcion.activa
    ? `<span class="pastilla pastilla--gris">De baja</span>`
    : m.estado === "completado"
      ? `<span class="pastilla pastilla--verde">Completado</span>`
      : m.estado === "en_curso"
        ? `<span class="pastilla pastilla--verde">En curso</span>`
        : `<span class="pastilla pastilla--gris">Sin empezar</span>`;

  const fases = desc.fases
    .map((f, i) => {
      const fase = i + 1;
      const hecha = m.fasesHechas.includes(fase) || m.estado === "completado";
      const r = porFase.get(fase);
      return `
        <li class="progreso__fase${hecha ? " progreso__fase--hecha" : ""}">
          <span class="progreso__marca" aria-hidden="true">${hecha ? icono("ok") : String(fase)}</span>
          <span class="progreso__nombre">${escapar(f.nombre)}${f.detalle ? `<small>${escapar(f.detalle)}</small>` : ""}</span>
          ${
            hecha && r
              ? `<span class="progreso__dato"><strong>${medida(r.puntaje)}</strong><small>${r.segundos > 0 ? duracion(r.segundos) : "—"}</small></span>
                 <span class="progreso__fecha">${fechaCorta(r.actualizadoEn)}</span>`
              : `<span class="progreso__estado">${hecha ? "Aprobada" : "Pendiente"}</span>`
          }
        </li>`;
    })
    .join("");

  const conDatos = [...porFase.values()];
  const segundos = conDatos.reduce((s, r) => s + r.segundos, 0);
  const puntaje = conDatos.reduce((s, r) => s + r.puntaje, 0) || m.puntaje;

  const resumen =
    hechas > 0
      ? `
      <dl class="progreso__resumen">
        <div><dt>Puntaje total</dt><dd>${numero(puntaje)}</dd></div>
        <div><dt>Tiempo de tus mejores intentos</dt><dd>${segundos > 0 ? duracion(segundos) : "—"}</dd></div>
        <div><dt>Tu lugar</dt><dd>${
          posicion
            ? `${posicion.posicion}.º <small>de ${numero(posicion.participantes)}${perfil.empresa ? ` en ${escapar(perfil.empresa)}` : ""}</small>`
            : "—"
        }</dd></div>
      </dl>`
      : "";

  const diseno = DISENOS[m.curso.id];
  let certificado = "";
  if (m.certificado) {
    certificado = `
      <div class="progreso__certificado">
        ${icono("certificado")}
        <span class="progreso__certTexto">
          <strong>Certificado <code>${escapar(m.certificado.codigo)}</code></strong>
          <small>Emitido el ${fechaCorta(m.certificado.emitidoEn)} · verificable con su código</small>
        </span>
        ${
          diseno
            ? `<button class="boton boton--borde" type="button" data-descargar="${escapar(m.curso.id)}" data-emitido="1">${icono("descarga")}Descargar</button>`
            : ""
        }
      </div>`;
  } else if (m.estado === "completado" && diseno) {
    certificado = `
      <div class="progreso__certificado">
        ${icono("certificado")}
        <span class="progreso__certTexto">
          <strong>Tu certificado está listo</strong>
          <small>Se emite con un código que cualquiera puede verificar.</small>
        </span>
        <button class="boton boton--principal" type="button" data-descargar="${escapar(m.curso.id)}">${icono("descarga")}Obtener certificado</button>
      </div>`;
  }

  const porcentaje = m.estado === "completado" ? 100 : Math.round((hechas / Math.max(1, total)) * 100);

  return `
    <article class="progreso${m.inscripcion.activa ? "" : " progreso--baja"}">
      <header class="progreso__cabeza">
        <div>
          <h3 class="progreso__titulo">${escapar(m.curso.nombre)}</h3>
          <p class="progreso__sub">${hechas} de ${total} ${total === 1 ? desc.unidad.una : desc.unidad.varias}${
            m.inscripcion.inscritoEn ? ` · inscrito el ${fechaCorta(m.inscripcion.inscritoEn)}` : ""
          }</p>
        </div>
        ${pastilla}
      </header>
      <div class="avance__carril" role="img" aria-label="${porcentaje} % del curso"><span style="width:${porcentaje}%"></span></div>
      <ol class="progreso__fases">${fases}</ol>
      ${resumen}
      ${certificado}
    </article>`;
}
