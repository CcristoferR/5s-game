// ===========================================================================
// Vistas del panel de administración
// ===========================================================================
//
// Cada función recibe los datos ya cargados y el estado de la pantalla, y
// devuelve HTML. No consultan la red ni enganchan eventos: PantallaAdmin.ts
// escucha todo por delegación (data-accion), así que una vista se puede
// volver a dibujar entera sin reconectar nada.
//
// Todo texto que venga de la base pasa por escapar(): nombres, empresas,
// áreas y notas los escribe gente, no el sistema.

import {
  describirAccion,
  LARGO_MINIMO_CLAVE,
  type CertificadoEmitido,
  type Codigo,
  type Curso,
  type EntradaBitacora,
  type Inscripcion,
  type Perfil,
  type Progreso,
} from "../Datos";
import type { FilaRankingAdmin, ResultadoFase } from "../Ranking";
import { describirCurso, type DescripcionCurso } from "../CatalogoCursos";
import { icono, type NombreIcono } from "../Iconos";
import {
  alertas,
  avancePorFase,
  cifras,
  coberturaPorArea,
  coincideEmpresa,
  comparacionCursos,
  contarEstados,
  cuposLibres,
  diasParaVencer,
  estaDetenida,
  estadoCodigo,
  matriculasEnAlcance,
  rankingEnAlcance,
  serieAcumulada,
  type Alerta,
  type EstadoCodigo,
  type FiltroPersonas,
  type Matricula,
  type OpcionEmpresa,
  type Vista,
} from "./Indicadores";
import {
  barraEstados,
  barrasApiladas,
  barrasSimples,
  curvaAcumulada,
  leyendaEstados,
  tablaGemela,
} from "./Graficos";
import {
  aFecha,
  diasEntre,
  duracion,
  escapar,
  fechaCorta,
  fechaHora,
  haceCuanto,
  iniciales,
  normalizar,
  numero,
  plural,
  porcentaje,
} from "./Formato";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type OrdenPersonas = "nombre" | "avance" | "actividad" | "recientes";
export type FiltroCodigos = "todos" | EstadoCodigo;

export interface DatosPanel {
  perfiles: Perfil[];
  cursos: Curso[];
  inscripciones: Inscripcion[];
  progresos: Progreso[];
  codigos: Codigo[];
  certificados: CertificadoEmitido[];
  /** Null cuando la función panel_resultados no está en la base todavía. */
  resultados: ResultadoFase[] | null;
  rankings: Map<string, FilaRankingAdmin[]>;
  bitacora: EntradaBitacora[];
  perfilPropio: Perfil | null;
  matriculas: Matricula[];
  empresas: OpcionEmpresa[];
  cargadoEn: Date;
}

export interface EstadoPanel {
  vista: Vista;
  cursoId: string | null;
  empresa: string | null;
  personas: { busqueda: string; filtro: FiltroPersonas; orden: OrdenPersonas; pagina: number };
  codigos: { filtro: FiltroCodigos; recienCreado: string | null };
  ranking: { pagina: number };
  nuevoAdminAbierto: boolean;
  /** Bloques que se están mostrando como tabla en vez de gráfico. */
  tablas: Set<string>;
}

export const POR_PAGINA = 25;

export const VISTAS: ReadonlyArray<{ id: Vista; rotulo: string; icono: NombreIcono }> = [
  { id: "resumen", rotulo: "Resumen", icono: "resumen" },
  { id: "personas", rotulo: "Personas", icono: "personas" },
  { id: "codigos", rotulo: "Códigos", icono: "codigos" },
  { id: "cursos", rotulo: "Cursos", icono: "cursos" },
  { id: "reportes", rotulo: "Reportes", icono: "reportes" },
  { id: "seguridad", rotulo: "Seguridad", icono: "seguridad" },
];

/** Qué selectores de alcance tienen sentido en cada vista. */
export const SELECTORES: Record<Vista, { curso: boolean; empresa: boolean }> = {
  resumen: { curso: true, empresa: true },
  personas: { curso: true, empresa: true },
  codigos: { curso: true, empresa: false },
  cursos: { curso: false, empresa: true },
  reportes: { curso: true, empresa: true },
  seguridad: { curso: false, empresa: false },
};

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

export function cursoElegido(d: DatosPanel, e: EstadoPanel): Curso | null {
  return e.cursoId ? d.cursos.find((c) => c.id === e.cursoId) ?? null : null;
}

function nombreEmpresa(d: DatosPanel, clave: string | null): string {
  if (clave === null) return "Todas las empresas";
  return d.empresas.find((x) => x.clave === clave)?.nombre ?? "Empresa";
}

/** "Operación 5S · Bitplay": de qué datos se está hablando. */
export function nombreAlcance(d: DatosPanel, e: EstadoPanel): string {
  const sel = SELECTORES[e.vista];
  const partes: string[] = [];
  if (sel.curso) {
    const curso = cursoElegido(d, e);
    partes.push(curso ? describirCurso(curso).corto : "Todos los cursos");
  }
  if (sel.empresa) partes.push(nombreEmpresa(d, e.empresa));
  return partes.join(" · ");
}

type Tono = "ok" | "aviso" | "error" | "dato" | "tenue" | "marca";

function chip(texto: string, tono: Tono, nombreIcono?: NombreIcono): string {
  return `<span class="chip chip--${tono}">${nombreIcono ? icono(nombreIcono) : ""}${escapar(texto)}</span>`;
}

function vacio(texto: string, nombreIcono: NombreIcono = "info", accion = ""): string {
  return `<div class="vacio">${icono(nombreIcono)}<p>${texto}</p>${accion}</div>`;
}

function avatar(nombre: string, grande = false): string {
  return `<span class="avatar${grande ? " avatar--grande" : ""}" aria-hidden="true">${escapar(iniciales(nombre))}</span>`;
}

function botonTabla(id: string, e: EstadoPanel): string {
  const comoTabla = e.tablas.has(id);
  return `<button class="boton-mini" type="button" data-accion="alternar-tabla" data-bloque="${id}" aria-pressed="${comoTabla}">
      ${icono(comoTabla ? "grafico" : "tabla")}<span>${comoTabla ? "Ver gráfico" : "Ver tabla"}</span>
    </button>`;
}

/** Un bloque con título, gráfico y su tabla gemela, alternables. */
function bloqueGrafico(opciones: {
  id: string;
  titulo: string;
  ayuda?: string;
  grafico: string;
  tabla: string;
  pie?: string;
  e: EstadoPanel;
}): string {
  const comoTabla = opciones.e.tablas.has(opciones.id);
  return `
    <section class="bloque" aria-labelledby="t-${opciones.id}">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-${opciones.id}">${opciones.titulo}</h2>
          ${opciones.ayuda ? `<p class="bloque__ayuda">${opciones.ayuda}</p>` : ""}
        </div>
        ${botonTabla(opciones.id, opciones.e)}
      </header>
      <div class="bloque__grafico"${comoTabla ? " hidden" : ""}>${opciones.grafico}</div>
      ${comoTabla ? opciones.tabla.replace(" hidden>", ">") : opciones.tabla}
      ${opciones.pie ? `<p class="bloque__pie">${opciones.pie}</p>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// Riel y cabecera
// ---------------------------------------------------------------------------

export function navegacion(d: DatosPanel | null, e: EstadoPanel): string {
  const cuentas: Partial<Record<Vista, number>> = d
    ? {
        personas: d.perfiles.filter((p) => p.rol === "trabajador").length,
        codigos: d.codigos.filter((c) => estadoCodigo(c) === "disponible").length,
      }
    : {};

  return VISTAS.map((v) => {
    const actual = v.id === e.vista;
    const cuenta = cuentas[v.id];
    return `
      <button class="riel__item" type="button" data-accion="ir" data-vista="${v.id}"${actual ? ' aria-current="page"' : ""}>
        ${icono(v.icono)}
        <span class="riel__texto">${v.rotulo}</span>
        ${cuenta !== undefined ? `<span class="riel__cuenta">${numero(cuenta)}</span>` : ""}
      </button>`;
  }).join("");
}

const TITULOS: Record<Vista, string> = {
  resumen: "Resumen",
  personas: "Personas",
  codigos: "Códigos de inscripción",
  cursos: "Cursos",
  reportes: "Reportes",
  seguridad: "Seguridad",
};

export function titulos(d: DatosPanel | null, e: EstadoPanel): string {
  const hora = d
    ? `Datos de las ${d.cargadoEn.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`
    : "Cargando datos…";
  const alcance = d ? nombreAlcance(d, e) : "";
  return `
    <h1 class="lienzo__titulo">${TITULOS[e.vista]}</h1>
    <p class="lienzo__bajada">${alcance ? `<span>${escapar(alcance)}</span><span class="separador" aria-hidden="true"></span>` : ""}<span>${hora}</span></p>`;
}

export function selectores(d: DatosPanel | null, e: EstadoPanel): string {
  const sel = SELECTORES[e.vista];
  if (!d || (!sel.curso && !sel.empresa)) return "";

  const cursos = sel.curso
    ? `
      <label class="selector">
        <span class="selector__rotulo">Curso</span>
        <select id="selCurso" class="selector__control">
          <option value="">Todos los cursos</option>
          ${d.cursos
            .map(
              (c) =>
                `<option value="${escapar(c.id)}"${c.id === e.cursoId ? " selected" : ""}>${escapar(describirCurso(c).corto)}${c.activo ? "" : " (retirado)"}</option>`
            )
            .join("")}
        </select>
        ${icono("abajo", "icono selector__flecha")}
      </label>`
    : "";

  const empresas = sel.empresa
    ? `
      <label class="selector">
        <span class="selector__rotulo">Empresa</span>
        <select id="selEmpresa" class="selector__control">
          <option value="">Todas las empresas</option>
          ${d.empresas
            .map(
              (x) =>
                `<option value="${escapar(x.clave)}"${x.clave === e.empresa ? " selected" : ""}>${escapar(x.nombre)} (${x.personas})</option>`
            )
            .join("")}
        </select>
        ${icono("abajo", "icono selector__flecha")}
      </label>`
    : "";

  return cursos + empresas;
}

// ---------------------------------------------------------------------------
// Esqueleto
// ---------------------------------------------------------------------------

export function esqueleto(): string {
  const cifra = `<div class="cifra cifra--hueso"><span class="hueso hueso--linea"></span><span class="hueso hueso--numero"></span><span class="hueso hueso--linea"></span></div>`;
  return `
    <div class="vista" aria-busy="true">
      <section class="cifras">${cifra.repeat(4)}</section>
      <section class="plancha plancha--dos">
        <div class="bloque"><span class="hueso hueso--titulo"></span><span class="hueso hueso--grafico"></span></div>
        <div class="bloque"><span class="hueso hueso--titulo"></span><span class="hueso hueso--grafico"></span></div>
      </section>
    </div>`;
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export function vistaResumen(d: DatosPanel, e: EstadoPanel): string {
  const curso = cursoElegido(d, e);
  const desc = curso ? describirCurso(curso) : null;
  const enAlcance = matriculasEnAlcance(d.matriculas, e);
  const c = cifras(enAlcance, d.resultados);

  const tarjetaCifra = (opciones: {
    rotulo: string;
    valor: string;
    nota: string;
    ir: string;
    etiqueta: string;
  }): string => `
    <button class="cifra" type="button" ${opciones.ir} aria-label="${escapar(opciones.etiqueta)}">
      <span class="cifra__rotulo">${opciones.rotulo}${icono("flecha", "icono cifra__ir")}</span>
      <strong class="cifra__valor">${opciones.valor}</strong>
      <span class="cifra__nota">${opciones.nota}</span>
    </button>`;

  const cuarta =
    desc && c.medidaMedia !== null
      ? tarjetaCifra({
          rotulo: desc.medida.media,
          valor: numero(c.medidaMedia),
          nota: `Mejor intento de cada ${desc.unidad.una}`,
          ir: 'data-accion="ir" data-vista="reportes"',
          etiqueta: `${desc.medida.media}: ${numero(c.medidaMedia)}. Ver el ranking`,
        })
      : tarjetaCifra({
          rotulo: "Certificados",
          valor: numero(c.certificados),
          nota: c.completados > 0 ? `De ${plural(c.completados, "persona que completó", "personas que completaron")}` : "Se emiten al completar el curso",
          ir: 'data-accion="ir" data-vista="reportes"',
          etiqueta: `Certificados emitidos: ${c.certificados}. Ver reportes`,
        });

  const cifrasHtml = `
    <section class="cifras" aria-label="Cifras principales">
      ${tarjetaCifra({
        rotulo: "Inscritos",
        valor: numero(c.inscritos),
        nota: c.nuevosSemana > 0 ? `+${numero(c.nuevosSemana)} en los últimos 7 días` : "Sin inscripciones nuevas esta semana",
        ir: 'data-accion="ir" data-vista="personas" data-filtro="todas"',
        etiqueta: `Inscritos: ${c.inscritos}. Ver personas`,
      })}
      ${tarjetaCifra({
        rotulo: "Completaron",
        valor: `${porcentaje(c.completados, c.inscritos)}<small>%</small>`,
        nota: `${numero(c.completados)} de ${plural(c.inscritos, "persona", "personas")}`,
        ir: 'data-accion="ir" data-vista="personas" data-filtro="completado"',
        etiqueta: `Completaron: ${porcentaje(c.completados, c.inscritos)} por ciento. Ver quiénes`,
      })}
      ${tarjetaCifra({
        rotulo: "Activos esta semana",
        valor: numero(c.activosSemana),
        nota: `Aprobaron algo en los últimos 7 días`,
        ir: 'data-accion="ir" data-vista="personas" data-filtro="todas" data-orden="actividad"',
        etiqueta: `Activos esta semana: ${c.activosSemana}. Ver personas por actividad`,
      })}
      ${cuarta}
    </section>`;

  if (c.inscritos === 0) {
    const donde = curso ? `en ${escapar(describirCurso(curso).corto)}` : "en ningún curso";
    const quien = e.empresa ? ` de ${escapar(nombreEmpresa(d, e.empresa))}` : "";
    return `
      <div class="vista">
        ${cifrasHtml}
        ${vacio(
          `Todavía no hay personas${quien} inscritas ${donde}. Emite un código y repártelo: cada persona lo canjea en su catálogo.`,
          "personas",
          `<button class="boton-primario" type="button" data-accion="ir" data-vista="codigos">${icono("codigos")}Emitir un código</button>`
        )}
      </div>`;
  }

  // --- Curva y estados ---
  const serie = serieAcumulada(enAlcance);
  const conteo = contarEstados(enAlcance);

  const curva = serie
    ? bloqueGrafico({
        id: "curva",
        titulo: "Inscritos y completados",
        ayuda: serie.paso === "semana" ? "Acumulado, semana a semana" : "Acumulado desde la primera inscripción",
        grafico: curvaAcumulada(serie),
        tabla: tablaGemela(
          "tabla-curva",
          ["Fecha", "Inscritos", "Completaron"],
          muestrasDeSerie(serie.puntos).map((p) => [
            fechaCorta(p.fecha.toISOString()),
            numero(p.inscritos),
            numero(p.completados),
          ])
        ),
        e,
      })
    : "";

  const estados = `
    <section class="bloque" aria-labelledby="t-estados">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-estados">Estado de los inscritos</h2>
          <p class="bloque__ayuda">${plural(c.inscritos, "persona con inscripción activa", "personas con inscripción activa")}</p>
        </div>
      </header>
      ${barraEstados(conteo, true)}
      <p class="bloque__pie">${icono("certificado")}<span>${plural(c.certificados, "certificado emitido", "certificados emitidos")}</span></p>
    </section>`;

  // --- Avance por fase o por curso ---
  // Se calcula una vez: lo usan el gráfico y la lista de lo que requiere atención.
  const fases = curso ? avancePorFase(enAlcance, curso, d.resultados) : null;
  let avance = "";
  if (curso && desc && fases) {
    const conMedida = fases.some((f) => f.medida !== null);
    avance = bloqueGrafico({
      id: "fases",
      titulo: `Avance por ${desc.unidad.una}`,
      ayuda: `Cuántos aprobaron cada ${desc.unidad.una}, de ${plural(c.inscritos, "inscrito", "inscritos")}`,
      grafico: barrasSimples(
        fases.map((f) => ({
          numero: String(f.fase),
          rotulo: f.nombre,
          proporcion: c.inscritos > 0 ? f.aprobaron / c.inscritos : 0,
          valor: numero(f.aprobaron),
          parte: `${f.porcentaje} %`,
          ayuda: [
            f.detalle ? `${f.nombre} · ${f.detalle}` : f.nombre,
            `Aprobaron ${numero(f.aprobaron)} de ${numero(c.inscritos)} (${f.porcentaje} %)`,
            ...(f.medida !== null ? [`${desc.medida.media}: ${numero(f.medida)}`] : []),
            ...(f.segundos !== null ? [`Tiempo medio: ${duracion(f.segundos)}`] : []),
          ],
        }))
      ),
      tabla: tablaGemela(
        "tabla-fases",
        [desc.unidad.una[0].toUpperCase() + desc.unidad.una.slice(1), "Aprobaron", "%", ...(conMedida ? [desc.medida.media, "Tiempo medio"] : [])],
        fases.map((f) => [
          `${f.fase}. ${f.nombre}`,
          numero(f.aprobaron),
          `${f.porcentaje} %`,
          ...(conMedida ? [f.medida !== null ? numero(f.medida) : "—", f.segundos !== null ? duracion(f.segundos) : "—"] : []),
        ])
      ),
      pie:
        d.resultados === null
          ? `${icono("info")}<span>Para ver ${desc.medida.media.toLowerCase()} y tiempo por ${desc.unidad.una}, falta correr <code>supabase/2026-10-02-panel.sql</code> en Supabase.</span>`
          : undefined,
      e,
    });
  } else {
    const grupos = comparacionCursos(enAlcance, d.cursos);
    avance = bloqueGrafico({
      id: "cursos",
      titulo: "Avance por curso",
      ayuda: "Proporción de cada estado dentro de cada curso",
      grafico: leyendaEstados() + barrasApiladas(grupos),
      tabla: tablaGemela(
        "tabla-cursos",
        ["Curso", "Inscritos", "Completaron", "En curso", "Sin empezar"],
        grupos.map((g) => [g.nombre, numero(g.total), numero(g.completado), numero(g.en_curso), numero(g.sin_empezar)])
      ),
      e,
    });
  }

  const areas = coberturaPorArea(enAlcance);
  const porArea = bloqueGrafico({
    id: "areas",
    titulo: "Avance por área",
    ayuda: areas.length > 1 ? "De la que tiene más inscritos a la que menos" : "Todas las personas están en una sola área",
    grafico: leyendaEstados() + barrasApiladas(areas),
    tabla: tablaGemela(
      "tabla-areas",
      ["Área", "Inscritos", "Completaron", "En curso", "Sin empezar"],
      coberturaPorArea(enAlcance, Infinity).map((g) => [
        g.nombre,
        numero(g.total),
        numero(g.completado),
        numero(g.en_curso),
        numero(g.sin_empezar),
      ])
    ),
    e,
  });

  // --- Atención y ranking ---
  const codigos = d.codigos.filter((x) => !curso || x.cursoId === curso.id);
  const lista = alertas(enAlcance, codigos, fases);

  const atencion = `
    <section class="bloque" aria-labelledby="t-atencion">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-atencion">Requiere atención</h2>
          <p class="bloque__ayuda">Lo que conviene resolver esta semana</p>
        </div>
      </header>
      ${
        lista.length === 0
          ? `<div class="vacio vacio--ok">${icono("ok")}<p>Nada pendiente: nadie está detenido y los códigos tienen cupos.</p></div>`
          : `<ul class="alertas">${lista.map(alertaHtml).join("")}</ul>`
      }
    </section>`;

  const ranking = curso && desc ? podio(d, e, curso, desc) : elegirCursoParaRanking(d);

  return `
    <div class="vista">
      ${cifrasHtml}
      <div class="plancha plancha--ancha">${curva}${estados}</div>
      <div class="plancha plancha--dos">${avance}${porArea}</div>
      <div class="plancha plancha--dos">${atencion}${ranking}</div>
    </div>`;
}

/** Filas para la tabla de la curva: todas si son pocas, una por semana si no. */
function muestrasDeSerie<T>(puntos: T[]): T[] {
  if (puntos.length <= 31) return [...puntos].reverse();
  const salida: T[] = [];
  for (let i = puntos.length - 1; i >= 0; i -= 7) salida.push(puntos[i]);
  return salida;
}

function alertaHtml(a: Alerta): string {
  const iconos: Record<Alerta["tono"], NombreIcono> = { riesgo: "alerta", aviso: "reloj", dato: "info" };
  const ir = a.ir
    ? `<button class="enlace" type="button" data-accion="ir" data-vista="${a.ir.vista}"${a.ir.filtro ? ` data-filtro="${a.ir.filtro}"` : ""}>
         ${a.ir.vista === "personas" ? "Ver personas" : "Ver códigos"}${icono("flecha")}
       </button>`
    : "";
  return `
    <li class="alerta alerta--${a.tono}">
      <span class="alerta__icono">${icono(iconos[a.tono])}</span>
      <div class="alerta__texto">
        <strong>${escapar(a.titulo)}</strong>
        <p>${escapar(a.detalle)}</p>
        ${ir}
      </div>
    </li>`;
}

function podio(d: DatosPanel, e: EstadoPanel, curso: Curso, desc: DescripcionCurso): string {
  const filas = rankingEnAlcance(d.rankings.get(curso.id) ?? [], e.empresa).slice(0, 5);
  return `
    <section class="bloque" aria-labelledby="t-podio">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-podio">Mejores puntajes</h2>
          <p class="bloque__ayuda">Suma del mejor intento de cada ${desc.unidad.una}</p>
        </div>
      </header>
      ${
        filas.length === 0
          ? vacio(`Todavía nadie aprueba ${desc.unidad.varias === "fases" ? "una fase" : "un escenario"} de este curso.`, "certificado")
          : `<ol class="podio">
              ${filas
                .map(
                  (f) => `
                <li class="podio__fila">
                  <span class="podio__pos">${f.posicion}</span>
                  <span class="podio__nombre">
                    <strong>${escapar(f.nombreCompleto)}</strong>
                    <small>${escapar([f.area, f.empresa].filter(Boolean).join(" · ") || "—")}</small>
                  </span>
                  <span class="podio__puntos">
                    <strong>${numero(f.puntajeTotal)}</strong>
                    <small>${f.fasesAprobadas} de ${curso.totalFases}</small>
                  </span>
                </li>`
                )
                .join("")}
            </ol>
            <button class="enlace" type="button" data-accion="ir" data-vista="reportes">Ver el ranking completo${icono("flecha")}</button>`
      }
    </section>`;
}

function elegirCursoParaRanking(d: DatosPanel): string {
  return `
    <section class="bloque" aria-labelledby="t-podio">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-podio">Mejores puntajes</h2>
          <p class="bloque__ayuda">Cada curso tiene su propio ranking</p>
        </div>
      </header>
      <div class="elegir-curso">
        ${d.cursos
          .map(
            (c) => `
          <button class="elegir-curso__boton" type="button" data-accion="elegir-curso" data-curso="${escapar(c.id)}">
            <span>${escapar(describirCurso(c).corto)}</span>${icono("derecha")}
          </button>`
          )
          .join("")}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export interface FilaPersona {
  perfil: Perfil;
  /** Inscripciones de la persona dentro del curso elegido (activas o no). */
  matriculas: Matricula[];
  activas: Matricula[];
  ultimaActividad: string | null;
  reciente: string;
}

export function filasPersonas(d: DatosPanel, e: EstadoPanel): FilaPersona[] {
  const porPerfil = new Map<string, Matricula[]>();
  for (const m of d.matriculas) {
    const lista = porPerfil.get(m.perfil.id) ?? [];
    lista.push(m);
    porPerfil.set(m.perfil.id, lista);
  }

  return d.perfiles
    .filter((p) => coincideEmpresa(p, e.empresa))
    .map((perfil) => {
      const matriculas = (porPerfil.get(perfil.id) ?? []).filter((m) => !e.cursoId || m.curso.id === e.cursoId);
      const activas = matriculas.filter((m) => m.inscripcion.activa);
      const actividades = matriculas.map((m) => m.ultimaActividad).filter((x): x is string => Boolean(x));
      const fechas = [perfil.creadoEn, ...matriculas.map((m) => m.inscripcion.inscritoEn)].filter(Boolean);
      return {
        perfil,
        matriculas,
        activas,
        ultimaActividad: actividades.sort().at(-1) ?? null,
        reciente: fechas.sort().at(-1) ?? perfil.creadoEn,
      };
    })
    .filter((f) => !e.cursoId || f.matriculas.length > 0);
}

const FILTROS_PERSONAS: ReadonlyArray<{ id: FiltroPersonas; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "sin_empezar", rotulo: "Sin empezar" },
  { id: "en_curso", rotulo: "En curso" },
  { id: "completado", rotulo: "Completaron" },
  { id: "detenidas", rotulo: "Sin avanzar" },
  { id: "sin_curso", rotulo: "Sin curso" },
  { id: "suspendidas", rotulo: "Suspendidas" },
];

export function cumpleFiltro(f: FilaPersona, filtro: FiltroPersonas, ahora = new Date()): boolean {
  switch (filtro) {
    case "todas":
      return true;
    case "sin_empezar":
    case "en_curso":
    case "completado":
      return f.activas.some((m) => m.estado === filtro);
    case "detenidas":
      return f.activas.some((m) => estaDetenida(m, ahora));
    case "sin_curso":
      return f.perfil.rol === "trabajador" && f.activas.length === 0;
    case "suspendidas":
      return f.perfil.suspendido;
  }
}

/** Lo que queda después del filtro, la búsqueda y el orden. */
export function personasVisibles(d: DatosPanel, e: EstadoPanel): FilaPersona[] {
  const aguja = normalizar(e.personas.busqueda);
  const filas = filasPersonas(d, e).filter(
    (f) =>
      cumpleFiltro(f, e.personas.filtro) &&
      (!aguja ||
        normalizar([f.perfil.nombreCompleto, f.perfil.identificador, f.perfil.empresa, f.perfil.area].join(" ")).includes(aguja))
  );

  const avance = (f: FilaPersona): number => Math.max(-1, ...f.activas.map((m) => m.porcentaje));
  const porNombre = (a: FilaPersona, b: FilaPersona): number =>
    a.perfil.nombreCompleto.localeCompare(b.perfil.nombreCompleto, "es", { sensitivity: "base" });

  switch (e.personas.orden) {
    case "avance":
      return filas.sort((a, b) => avance(b) - avance(a) || porNombre(a, b));
    case "actividad":
      return filas.sort(
        (a, b) => (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? "") || porNombre(a, b)
      );
    case "recientes":
      return filas.sort((a, b) => b.reciente.localeCompare(a.reciente) || porNombre(a, b));
    default:
      return filas.sort(porNombre);
  }
}

export function vistaPersonas(d: DatosPanel, e: EstadoPanel): string {
  const todas = filasPersonas(d, e);
  const chips = FILTROS_PERSONAS.map((f) => ({ ...f, cuenta: todas.filter((x) => cumpleFiltro(x, f.id)).length }))
    // "Sin curso" no tiene sentido con un curso elegido: ahí todos lo tienen.
    .filter((f) => !(f.id === "sin_curso" && e.cursoId))
    .filter((f) => f.id === "todas" || f.cuenta > 0 || f.id === e.personas.filtro);

  const ordenes: Array<[OrdenPersonas, string]> = [
    ["nombre", "Nombre (A–Z)"],
    ["avance", "Más avance"],
    ["actividad", "Actividad reciente"],
    ["recientes", "Inscripción reciente"],
  ];

  return `
    <div class="vista">
      <div class="herramientas">
        <label class="buscador">
          ${icono("buscar")}
          <span class="oculto">Buscar personas</span>
          <input id="buscadorPersonas" type="search" autocomplete="off" spellcheck="false"
                 placeholder="Buscar por nombre, RUT, empresa o área" value="${escapar(e.personas.busqueda)}" />
        </label>
        <label class="selector selector--compacto">
          <span class="selector__rotulo">Orden</span>
          <select id="ordenPersonas" class="selector__control">
            ${ordenes.map(([id, rotulo]) => `<option value="${id}"${id === e.personas.orden ? " selected" : ""}>${rotulo}</option>`).join("")}
          </select>
          ${icono("abajo", "icono selector__flecha")}
        </label>
      </div>

      <div class="filtros" role="group" aria-label="Filtrar personas">
        ${chips
          .map(
            (f) => `
          <button class="filtro" type="button" data-accion="filtro-personas" data-filtro="${f.id}" aria-pressed="${f.id === e.personas.filtro}">
            ${f.rotulo}<span class="filtro__cuenta">${numero(f.cuenta)}</span>
          </button>`
          )
          .join("")}
      </div>

      <div id="resultadoPersonas">${resultadoPersonas(d, e)}</div>
    </div>`;
}

/** La tabla y su paginación. Se redibuja sola al escribir en el buscador. */
export function resultadoPersonas(d: DatosPanel, e: EstadoPanel): string {
  const filas = personasVisibles(d, e);
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, e.personas.pagina), paginas);
  const desde = (pagina - 1) * POR_PAGINA;
  const visibles = filas.slice(desde, desde + POR_PAGINA);

  if (filas.length === 0) {
    const hayBusqueda = e.personas.busqueda.trim() !== "" || e.personas.filtro !== "todas";
    return `<div class="plancha">${vacio(
      hayBusqueda
        ? "Nadie coincide con esa búsqueda o ese filtro."
        : "Todavía no hay personas registradas con este alcance.",
      hayBusqueda ? "buscar" : "personas",
      hayBusqueda ? `<button class="boton-secundario" type="button" data-accion="limpiar-busqueda">Quitar filtros</button>` : ""
    )}</div>`;
  }

  const conCurso = Boolean(e.cursoId);
  return `
    <div class="plancha plancha--tabla">
      <div class="tabla-envoltura">
        <table class="tabla tabla--personas">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Empresa · área</th>
              <th scope="col">Avance</th>
              <th scope="col">Actividad</th>
              <th scope="col"><span class="oculto">Abrir ficha</span></th>
            </tr>
          </thead>
          <tbody>
            ${visibles.map((f) => filaPersona(f, conCurso)).join("")}
          </tbody>
        </table>
      </div>
      <footer class="paginacion">
        <span>${filas.length > POR_PAGINA ? `${numero(desde + 1)}–${numero(desde + visibles.length)} de ` : ""}${plural(filas.length, "persona", "personas")}</span>
        ${
          paginas > 1
            ? `<div class="paginacion__botones">
                 <button class="boton-mini" type="button" data-accion="pagina" data-destino="${pagina - 1}"${pagina === 1 ? " disabled" : ""}>${icono("izquierda")}<span>Anterior</span></button>
                 <span class="paginacion__actual">${pagina} / ${paginas}</span>
                 <button class="boton-mini" type="button" data-accion="pagina" data-destino="${pagina + 1}"${pagina === paginas ? " disabled" : ""}><span>Siguiente</span>${icono("derecha")}</button>
               </div>`
            : ""
        }
      </footer>
    </div>`;
}

function filaPersona(f: FilaPersona, conCurso: boolean): string {
  const p = f.perfil;
  const etiquetas = [
    p.rol === "administrador" ? chip("Admin", "dato", "admin") : "",
    p.suspendido ? chip("Suspendida", "error", "pausa") : "",
  ].join("");

  const avance =
    f.matriculas.length === 0
      ? p.rol === "administrador"
        ? `<span class="tenue">—</span>`
        : chip("Sin curso", "tenue")
      : f.matriculas
          .slice()
          .sort((a, b) => Number(b.inscripcion.activa) - Number(a.inscripcion.activa))
          .map((m) => celdaAvance(m, !conCurso))
          .join("");

  const primera = f.matriculas
    .map((m) => m.inscripcion.inscritoEn)
    .sort()
    .at(-1);

  return `
    <tr class="fila-persona${p.suspendido ? " fila--apagada" : ""}" data-perfil="${escapar(p.id)}">
      <td>
        <div class="persona">
          ${avatar(p.nombreCompleto)}
          <span class="persona__datos">
            <button class="persona__nombre" type="button" data-accion="abrir-ficha" data-perfil="${escapar(p.id)}">${escapar(p.nombreCompleto)}</button>
            <span class="persona__sub">${escapar(p.identificador)}</span>
          </span>
          ${etiquetas ? `<span class="persona__etiquetas">${etiquetas}</span>` : ""}
        </div>
      </td>
      <td>
        <span class="celda-doble">
          <span>${escapar(p.empresa) || "—"}</span>
          <small>${escapar(p.area) || "Sin área"}</small>
        </span>
      </td>
      <td><div class="marchas">${avance}</div></td>
      <td>
        <span class="celda-doble">
          <span title="${escapar(fechaHora(f.ultimaActividad))}">${haceCuanto(f.ultimaActividad)}</span>
          <small>${primera ? `Inscrito ${fechaCorta(primera)}` : `Registro ${fechaCorta(p.creadoEn)}`}</small>
        </span>
      </td>
      <td class="tabla__accion" aria-hidden="true">${icono("derecha")}</td>
    </tr>`;
}

/** Fases de un curso como casillas: se lee el avance de un vistazo. */
function pips(m: Matricula): string {
  const total = Math.max(1, m.curso.totalFases);
  const hechas = new Set(m.fasesHechas);
  const clase = m.estado === "completado" ? "pip--completo" : "pip--hecho";
  if (total > 12) {
    return `<span class="pips__barra"><span style="width:${m.porcentaje}%"></span></span>`;
  }
  return Array.from({ length: total }, (_, i) =>
    `<i class="pip${hechas.has(i + 1) || m.estado === "completado" ? ` ${clase}` : ""}"></i>`
  ).join("");
}

function celdaAvance(m: Matricula, conNombre: boolean, ahora = new Date()): string {
  const desc = describirCurso(m.curso);
  const hechas = Math.min(m.fasesHechas.length, m.curso.totalFases);
  let estado = "";
  if (!m.inscripcion.activa) estado = chip("De baja", "tenue", "baja");
  else if (m.estado === "completado") estado = chip("Completó", "ok", "ok");
  else if (m.estado === "sin_empezar") estado = chip("Sin empezar", "tenue");
  else if (estaDetenida(m, ahora)) {
    const desde = m.ultimaActividad ?? m.inscripcion.inscritoEn;
    estado = chip(`${diasEntre(aFecha(desde), ahora)} días sin avanzar`, "aviso", "reloj");
  }

  return `
    <span class="marcha${m.inscripcion.activa ? "" : " marcha--baja"}">
      ${conNombre ? `<span class="marcha__curso">${escapar(desc.corto)}</span>` : ""}
      <span class="pips" role="img" aria-label="${hechas} de ${m.curso.totalFases} ${escapar(desc.unidad.varias)}">${pips(m)}</span>
      <span class="marcha__cifra">${hechas}/${m.curso.totalFases}</span>
      ${estado}
    </span>`;
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

const ESTADOS_CODIGO: Record<EstadoCodigo, { rotulo: string; plural: string; tono: Tono; icono: NombreIcono }> = {
  disponible: { rotulo: "Disponible", plural: "Disponibles", tono: "ok", icono: "ok" },
  sin_cupos: { rotulo: "Sin cupos", plural: "Sin cupos", tono: "aviso", icono: "alerta" },
  vencido: { rotulo: "Vencido", plural: "Vencidos", tono: "error", icono: "reloj" },
  baja: { rotulo: "Dado de baja", plural: "De baja", tono: "tenue", icono: "baja" },
};

export function vistaCodigos(d: DatosPanel, e: EstadoPanel): string {
  const curso = cursoElegido(d, e);
  const activos = d.cursos.filter((c) => c.activo);
  const codigos = d.codigos.filter((c) => !curso || c.cursoId === curso.id);
  const ahora = new Date();
  const estados = new Map(codigos.map((c) => [c.codigo, estadoCodigo(c, ahora)]));

  const cuentas = (Object.keys(ESTADOS_CODIGO) as EstadoCodigo[]).map((id) => ({
    id,
    cuenta: codigos.filter((c) => estados.get(c.codigo) === id).length,
  }));
  const libres = codigos
    .filter((c) => estados.get(c.codigo) === "disponible")
    .reduce((s, c) => s + cuposLibres(c), 0);

  const visibles = codigos.filter((c) => e.codigos.filtro === "todos" || estados.get(c.codigo) === e.codigos.filtro);
  const cursoPorDefecto = curso && curso.activo ? curso.id : activos[0]?.id;

  const recien = e.codigos.recienCreado
    ? `
      <div class="creado" role="status">
        ${icono("ok")}
        <span class="creado__texto">Código listo para repartir</span>
        <code class="creado__codigo">${escapar(e.codigos.recienCreado)}</code>
        <button class="boton-secundario" type="button" data-accion="copiar" data-texto="${escapar(e.codigos.recienCreado)}">${icono("copiar")}Copiar</button>
        <button class="icono-boton" type="button" data-accion="descartar-creado" aria-label="Cerrar aviso">${icono("cerrar")}</button>
      </div>`
    : "";

  const formulario =
    activos.length === 0
      ? vacio("No hay cursos publicados. Publica uno en Cursos para poder emitir códigos.", "cursos")
      : `
      <form class="emitir" id="formCodigo" novalidate>
        <div class="campo">
          <label class="campo__rotulo" for="nuevoCurso">Curso</label>
          <span class="campo__select">
            <select class="campo__control" id="nuevoCurso">
              ${activos
                .map((c) => `<option value="${escapar(c.id)}"${c.id === cursoPorDefecto ? " selected" : ""}>${escapar(describirCurso(c).corto)}</option>`)
                .join("")}
            </select>
            ${icono("abajo", "icono selector__flecha")}
          </span>
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="nuevoLote">Lote</label>
          <input class="campo__control" id="nuevoLote" maxlength="10" placeholder="PLANTA" autocomplete="off" />
        </div>
        <div class="campo campo--corto">
          <label class="campo__rotulo" for="nuevoCupos">Cupos</label>
          <input class="campo__control" id="nuevoCupos" type="number" min="1" max="5000" value="20" inputmode="numeric" />
        </div>
        <div class="campo campo--corto">
          <label class="campo__rotulo" for="nuevoDias">Vigencia (días)</label>
          <input class="campo__control" id="nuevoDias" type="number" min="1" max="3650" placeholder="Sin vencer" inputmode="numeric" />
        </div>
        <div class="campo campo--ancho">
          <label class="campo__rotulo" for="nuevaNota">Nota interna</label>
          <input class="campo__control" id="nuevaNota" maxlength="120" placeholder="Turno mañana, planta principal" autocomplete="off" />
        </div>
        <button class="boton-primario emitir__boton" type="submit">${icono("mas")}Generar código</button>
      </form>`;

  const tabla =
    visibles.length === 0
      ? vacio(
          codigos.length === 0
            ? "Todavía no hay códigos emitidos para este curso."
            : "Ningún código está en ese estado.",
          "codigos"
        )
      : `
      <div class="tabla-envoltura">
        <table class="tabla tabla--codigos">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Curso</th>
              <th scope="col">Uso</th>
              <th scope="col">Vigencia</th>
              <th scope="col">Estado</th>
              <th scope="col">Nota</th>
              <th scope="col"><span class="oculto">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            ${visibles.map((c) => filaCodigo(c, d.cursos, estados.get(c.codigo)!, c.codigo === e.codigos.recienCreado, ahora)).join("")}
          </tbody>
        </table>
      </div>`;

  return `
    <div class="vista">
      ${recien}
      <section class="plancha plancha--emitir" aria-labelledby="t-emitir">
        <header class="bloque__cabeza">
          <div>
            <h2 class="bloque__titulo" id="t-emitir">Emitir un código</h2>
            <p class="bloque__ayuda">Cada código inscribe a un curso. Se reparte impreso o por mensaje y se canjea en el catálogo.</p>
          </div>
        </header>
        ${formulario}
      </section>

      <div class="filtros" role="group" aria-label="Filtrar códigos">
        <button class="filtro" type="button" data-accion="filtro-codigos" data-filtro="todos" aria-pressed="${e.codigos.filtro === "todos"}">
          Todos<span class="filtro__cuenta">${numero(codigos.length)}</span>
        </button>
        ${cuentas
          .filter((x) => x.cuenta > 0 || x.id === e.codigos.filtro)
          .map(
            (x) => `
          <button class="filtro" type="button" data-accion="filtro-codigos" data-filtro="${x.id}" aria-pressed="${e.codigos.filtro === x.id}">
            ${ESTADOS_CODIGO[x.id].plural}<span class="filtro__cuenta">${numero(x.cuenta)}</span>
          </button>`
          )
          .join("")}
        <span class="filtros__nota">${plural(libres, "cupo libre", "cupos libres")} en códigos disponibles</span>
      </div>

      <section class="plancha plancha--tabla" aria-label="Códigos emitidos">${tabla}</section>
    </div>`;
}

function vigencia(c: Codigo, estado: EstadoCodigo, ahora: Date): string {
  if (!c.venceEn) return `<span class="tenue">Sin vencimiento</span>`;
  if (estado === "vencido") return `Venció el ${fechaCorta(c.venceEn)}`;
  const dias = diasParaVencer(c, ahora) ?? 0;
  if (dias <= 0) return `<strong class="texto-aviso">Vence hoy</strong>`;
  if (dias === 1) return `<strong class="texto-aviso">Vence mañana</strong>`;
  if (dias <= 7) return `<strong class="texto-aviso">Vence en ${dias} días</strong>`;
  return `Hasta el ${fechaCorta(c.venceEn)}`;
}

function filaCodigo(c: Codigo, cursos: Curso[], estado: EstadoCodigo, nuevo: boolean, ahora: Date): string {
  const curso = cursos.find((x) => x.id === c.cursoId);
  const info = ESTADOS_CODIGO[estado];
  const uso = c.usosMaximos > 0 ? Math.min(1, c.usosActuales / c.usosMaximos) : 0;
  const accion = c.activo
    ? `<button class="accion" type="button" data-accion="codigo-baja" data-codigo="${escapar(c.codigo)}" data-confirmar="¿Dar de baja?">Dar de baja</button>`
    : `<button class="accion" type="button" data-accion="codigo-activar" data-codigo="${escapar(c.codigo)}">Reactivar</button>`;

  return `
    <tr class="${estado === "baja" ? "fila--apagada" : ""}${nuevo ? " fila--nueva" : ""}">
      <td>
        <span class="codigo">
          <code>${escapar(c.codigo)}</code>
          <button class="icono-boton icono-boton--mini" type="button" data-accion="copiar" data-texto="${escapar(c.codigo)}"
                  aria-label="Copiar ${escapar(c.codigo)}" title="Copiar">${icono("copiar")}</button>
        </span>
      </td>
      <td>${escapar(curso ? describirCurso(curso).corto : c.cursoId)}</td>
      <td>
        <span class="uso${uso >= 1 ? " uso--lleno" : ""}">
          <span class="uso__carril"><span class="uso__barra" style="--v:${uso.toFixed(3)}"></span></span>
          <span class="uso__texto">${numero(c.usosActuales)} / ${numero(c.usosMaximos)}</span>
        </span>
      </td>
      <td>${vigencia(c, estado, ahora)}</td>
      <td>${chip(info.rotulo, info.tono, info.icono)}</td>
      <td class="tabla__nota">${escapar(c.nota) || `<span class="tenue">—</span>`}</td>
      <td class="tabla__accion">${accion}</td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

export function vistaCursos(d: DatosPanel, e: EstadoPanel): string {
  if (d.cursos.length === 0) {
    return `<div class="vista">${vacio("Todavía no hay cursos en la base.", "cursos")}</div>`;
  }

  const tarjetas = d.cursos.map((curso) => {
    const desc = describirCurso(curso);
    const enAlcance = matriculasEnAlcance(d.matriculas, { cursoId: curso.id, empresa: e.empresa });
    const conteo = contarEstados(enAlcance);
    const total = enAlcance.length;
    const certificados = enAlcance.filter((m) => m.certificado).length;

    const accion = curso.activo
      ? `<button class="accion" type="button" data-accion="curso-retirar" data-curso="${escapar(curso.id)}" data-confirmar="¿Retirar del catálogo?">Retirar del catálogo</button>`
      : `<button class="accion accion--positiva" type="button" data-accion="curso-publicar" data-curso="${escapar(curso.id)}">Publicar</button>`;

    return `
      <article class="curso-panel${curso.activo ? "" : " curso-panel--retirado"}" aria-labelledby="c-${escapar(curso.id)}">
        <header class="curso-panel__cabeza">
          <h2 class="curso-panel__titulo" id="c-${escapar(curso.id)}">${escapar(curso.nombre)}</h2>
          ${curso.activo ? chip("Publicado", "ok", "ok") : chip("Retirado", "tenue", "baja")}
        </header>
        ${curso.descripcion ? `<p class="curso-panel__desc">${escapar(curso.descripcion)}</p>` : ""}
        <dl class="curso-panel__datos">
          <div><dt>${desc.unidad.varias[0].toUpperCase() + desc.unidad.varias.slice(1)}</dt><dd>${curso.totalFases}</dd></div>
          <div><dt>Duración</dt><dd>${curso.duracionMinutos} min</dd></div>
          <div><dt>Inscritos</dt><dd>${numero(total)}</dd></div>
          <div><dt>Completaron</dt><dd>${porcentaje(conteo.completado, total)} %</dd></div>
        </dl>
        ${total > 0 ? barraEstados(conteo) : `<p class="tenue curso-panel__sin">Nadie inscrito${e.empresa ? " en esta empresa" : ""} todavía.</p>`}
        <ol class="curso-panel__fases">
          ${desc.fases.map((f, i) => `<li><span>${i + 1}</span>${escapar(f.nombre)}</li>`).join("")}
        </ol>
        <footer class="curso-panel__pie">
          <span class="tenue">${plural(certificados, "certificado", "certificados")}</span>
          <div class="curso-panel__acciones">
            <button class="boton-secundario" type="button" data-accion="elegir-curso" data-curso="${escapar(curso.id)}">${icono("resumen")}Ver indicadores</button>
            ${accion}
          </div>
        </footer>
      </article>`;
  });

  return `
    <div class="vista">
      <div class="cursos-panel">${tarjetas.join("")}</div>
      <p class="nota">${icono("info")}Retirar un curso lo saca del catálogo de los trabajadores, pero conserva las inscripciones, el avance y los certificados de quienes ya lo hicieron.</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

export function vistaReportes(d: DatosPanel, e: EstadoPanel): string {
  const curso = cursoElegido(d, e);
  const alcance = escapar(nombreAlcance(d, e));
  const alcanceCodigos = escapar(curso ? describirCurso(curso).corto : "Todos los cursos");

  const descargas: Array<{ id: string; icono: NombreIcono; nombre: string; desc: string; alcance: string }> = [
    { id: "personas", icono: "personas", nombre: "Personas y avance", desc: "Una fila por inscripción, con fases, puntaje, estado y fecha de término.", alcance },
    {
      id: "ranking",
      icono: "certificado",
      nombre: "Ranking",
      desc: curso ? "Participantes ordenados por puntaje, con su tiempo y su última actividad." : "Una hoja por curso, con los participantes ordenados por puntaje.",
      alcance,
    },
    { id: "areas", icono: "resumen", nombre: "Avance por área", desc: "Inscritos, completados y cobertura de cada área, con la fila de totales.", alcance },
    { id: "codigos", icono: "codigos", nombre: "Códigos emitidos", desc: "Consumo de cupos, vigencia y estado de cada código.", alcance: alcanceCodigos },
  ];

  const lista = `
    <section class="plancha" aria-labelledby="t-descargas">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-descargas">Descargas en Excel</h2>
          <p class="bloque__ayuda">Con el mismo curso y la misma empresa elegidos arriba. Listas para archivar o enviar.</p>
        </div>
      </header>
      <ul class="descargas">
        ${descargas
          .map(
            (x) => `
          <li class="descarga">
            <span class="descarga__icono">${icono(x.icono)}</span>
            <span class="descarga__texto"><strong>${x.nombre}</strong><span>${x.desc}</span></span>
            <span class="descarga__alcance">${x.alcance}</span>
            <button class="boton-secundario" type="button" data-accion="reporte" data-reporte="${x.id}">${icono("descarga")}<span>Descargar</span></button>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;

  const ranking = curso ? tablaRanking(d, e, curso) : `
    <section class="plancha" aria-labelledby="t-ranking">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-ranking">Ranking</h2>
          <p class="bloque__ayuda">El puntaje de un curso no se compara con el de otro: elige uno.</p>
        </div>
      </header>
      <div class="elegir-curso elegir-curso--fila">
        ${d.cursos
          .map(
            (c) => `<button class="elegir-curso__boton" type="button" data-accion="elegir-curso" data-curso="${escapar(c.id)}" data-quedarse="1"><span>${escapar(describirCurso(c).corto)}</span>${icono("derecha")}</button>`
          )
          .join("")}
      </div>
    </section>`;

  const verificar = `
    <section class="plancha plancha--fila" aria-labelledby="t-verificar">
      <span class="descarga__icono">${icono("ok")}</span>
      <div class="plancha__texto">
        <h2 class="bloque__titulo" id="t-verificar">Verificar un certificado</h2>
        <p class="bloque__ayuda">Comprueba con el código impreso al pie si un certificado fue emitido por ClassPlay.</p>
      </div>
      <button class="boton-secundario" type="button" data-accion="verificador">Abrir verificador${icono("flecha")}</button>
    </section>`;

  return `<div class="vista">${lista}${ranking}${verificar}</div>`;
}

function tablaRanking(d: DatosPanel, e: EstadoPanel, curso: Curso): string {
  const desc = describirCurso(curso);
  const filas = rankingEnAlcance(d.rankings.get(curso.id) ?? [], e.empresa);
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, e.ranking.pagina), paginas);
  const desde = (pagina - 1) * POR_PAGINA;
  const visibles = filas.slice(desde, desde + POR_PAGINA);

  return `
    <section class="plancha plancha--tabla" aria-labelledby="t-ranking">
      <header class="bloque__cabeza bloque__cabeza--tabla">
        <div>
          <h2 class="bloque__titulo" id="t-ranking">Ranking de ${escapar(desc.corto)}</h2>
          <p class="bloque__ayuda">Puntaje total del mejor intento de cada ${desc.unidad.una}. A igual puntaje, gana el menor tiempo.</p>
        </div>
      </header>
      ${
        filas.length === 0
          ? vacio(`Todavía nadie aprueba ${desc.unidad.varias === "fases" ? "una fase" : "un escenario"} de este curso con este alcance.`, "certificado")
          : `
        <div class="tabla-envoltura">
          <table class="tabla tabla--ranking">
            <thead>
              <tr>
                <th scope="col" class="tabla__num">#</th>
                <th scope="col">Persona</th>
                <th scope="col">Empresa · área</th>
                <th scope="col" class="tabla__num">${desc.unidad.varias[0].toUpperCase() + desc.unidad.varias.slice(1)}</th>
                <th scope="col" class="tabla__num">Puntaje</th>
                <th scope="col" class="tabla__num">Tiempo</th>
                <th scope="col">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              ${visibles
                .map(
                  (f) => `
                <tr class="${f.posicion <= 3 ? "fila--podio" : ""}">
                  <td class="tabla__num"><span class="posicion">${f.posicion}</span></td>
                  <td><button class="persona__nombre" type="button" data-accion="abrir-ficha" data-perfil="${escapar(f.perfilId)}">${escapar(f.nombreCompleto)}</button></td>
                  <td><span class="celda-doble"><span>${escapar(f.empresa ?? "") || "—"}</span><small>${escapar(f.area ?? "") || "Sin área"}</small></span></td>
                  <td class="tabla__num">${f.fasesAprobadas} de ${curso.totalFases}</td>
                  <td class="tabla__num"><strong>${numero(f.puntajeTotal)}</strong></td>
                  <td class="tabla__num">${duracion(f.segundosTotal)}</td>
                  <td title="${escapar(fechaHora(f.ultimaActividad))}">${haceCuanto(f.ultimaActividad)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <footer class="paginacion">
          <span>${filas.length > POR_PAGINA ? `${desde + 1}–${desde + visibles.length} de ` : ""}${plural(filas.length, "participante", "participantes")}</span>
          ${
            paginas > 1
              ? `<div class="paginacion__botones">
                   <button class="boton-mini" type="button" data-accion="pagina-ranking" data-destino="${pagina - 1}"${pagina === 1 ? " disabled" : ""}>${icono("izquierda")}<span>Anterior</span></button>
                   <span class="paginacion__actual">${pagina} / ${paginas}</span>
                   <button class="boton-mini" type="button" data-accion="pagina-ranking" data-destino="${pagina + 1}"${pagina === paginas ? " disabled" : ""}><span>Siguiente</span>${icono("derecha")}</button>
                 </div>`
              : ""
          }
        </footer>`
      }
    </section>`;
}

// ---------------------------------------------------------------------------
// Seguridad
// ---------------------------------------------------------------------------

export function vistaSeguridad(d: DatosPanel, e: EstadoPanel): string {
  const admins = d.perfiles
    .filter((p) => p.rol === "administrador")
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
  const propio = d.perfilPropio?.id ?? null;

  const lista = `
    <section class="plancha" aria-labelledby="t-admins">
      <header class="bloque__cabeza">
        <div>
          <h2 class="bloque__titulo" id="t-admins">Administradores</h2>
          <p class="bloque__ayuda">Quienes entran a este panel. Para dar el rol a alguien registrado, ábrelo en Personas.</p>
        </div>
        <button class="boton-secundario" type="button" data-accion="nuevo-admin" aria-expanded="${e.nuevoAdminAbierto}" aria-controls="formAdmin">
          ${icono(e.nuevoAdminAbierto ? "cerrar" : "mas")}${e.nuevoAdminAbierto ? "Cancelar" : "Agregar administrador"}
        </button>
      </header>

      <form class="nuevo-admin" id="formAdmin" novalidate${e.nuevoAdminAbierto ? "" : " hidden"}>
        <div class="campo">
          <label class="campo__rotulo" for="adminNombre">Nombre completo</label>
          <input class="campo__control" id="adminNombre" required autocomplete="off" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="adminIdentificador">RUT o correo</label>
          <input class="campo__control" id="adminIdentificador" required autocomplete="off" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="adminEmpresa">Empresa</label>
          <input class="campo__control" id="adminEmpresa" value="Bitplay" autocomplete="off" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="adminArea">Área</label>
          <input class="campo__control" id="adminArea" placeholder="Capacitación" autocomplete="off" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="adminClave">Contraseña</label>
          <input class="campo__control" id="adminClave" type="password" required minlength="${LARGO_MINIMO_CLAVE}"
                 placeholder="Mínimo ${LARGO_MINIMO_CLAVE} caracteres" autocomplete="new-password" />
        </div>
        <button class="boton-primario" type="submit">${icono("admin")}Crear administrador</button>
      </form>

      <ul class="admins">
        ${admins
          .map(
            (p) => `
          <li class="admins__fila">
            ${avatar(p.nombreCompleto)}
            <span class="admins__datos">
              <strong>${escapar(p.nombreCompleto)}</strong>
              <small>${escapar(p.identificador)} · desde ${fechaCorta(p.creadoEn)}</small>
            </span>
            ${
              p.id === propio
                ? chip("Tu cuenta", "marca")
                : `<button class="accion" type="button" data-accion="degradar" data-perfil="${escapar(p.id)}" data-confirmar="¿Quitar el rol?">Quitar admin</button>`
            }
          </li>`
          )
          .join("")}
      </ul>
    </section>`;

  return `<div class="vista">${lista}${bitacora(d.bitacora)}</div>`;
}

/**
 * Bitácora en línea de tiempo, no en tabla.
 *
 * Cada entrada es una frase —quién, qué y sobre quién— con la hora al margen,
 * agrupadas por día: cien líneas repitiendo la fecha completa son exactamente
 * el muro de datos que hay que evitar.
 */
function bitacora(entradas: EntradaBitacora[]): string {
  const encabezado = `
    <header class="bloque__cabeza">
      <div>
        <h2 class="bloque__titulo" id="t-bitacora">Bitácora</h2>
        <p class="bloque__ayuda">Toda acción administrativa queda registrada. Las entradas no se pueden editar ni borrar, tampoco desde la base.</p>
      </div>
    </header>`;

  if (entradas.length === 0) {
    return `<section class="plancha" aria-labelledby="t-bitacora">${encabezado}${vacio("Todavía no se registró ninguna acción.", "seguridad")}</section>`;
  }

  const porDia = new Map<string, EntradaBitacora[]>();
  for (const entrada of entradas) {
    const dia = new Date(entrada.ocurridoEn).toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const lista = porDia.get(dia) ?? [];
    lista.push(entrada);
    porDia.set(dia, lista);
  }

  const dias = [...porDia.entries()]
    .map(
      ([dia, lista]) => `
      <div class="bitacora__dia">
        <h3 class="bitacora__fecha">${escapar(dia)}</h3>
        <ul class="bitacora__lista">
          ${lista
            .map((x) => {
              const { titulo, tono } = describirAccion(x.accion);
              const hora = new Date(x.ocurridoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
              const extra =
                typeof x.detalle.identificador === "string"
                  ? `<span class="bitacora__extra">${escapar(x.detalle.identificador)}</span>`
                  : "";
              return `
              <li class="bitacora__entrada bitacora__entrada--${tono}">
                <span class="bitacora__hora">${hora}</span>
                <span class="bitacora__punto" aria-hidden="true"></span>
                <span class="bitacora__texto">
                  <strong>${escapar(x.actorNombre)}</strong> · ${escapar(titulo)}${x.objetivoNombre ? ` <span class="bitacora__objetivo">${escapar(x.objetivoNombre)}</span>` : ""}
                  ${extra}
                </span>
              </li>`;
            })
            .join("")}
        </ul>
      </div>`
    )
    .join("");

  return `
    <section class="plancha" aria-labelledby="t-bitacora">
      ${encabezado}
      <p class="bloque__pie bloque__pie--arriba">${plural(entradas.length, "entrada más reciente", "entradas más recientes")}</p>
      ${dias}
    </section>`;
}

