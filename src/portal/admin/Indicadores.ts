// ===========================================================================
// Indicadores del panel
// ===========================================================================
//
// Funciones puras: reciben las filas que ya trajo el panel y devuelven cifras.
// No consultan la red ni tocan el DOM, así que se pueden probar con datos
// inventados y el panel no hace una consulta nueva cada vez que cambia el
// curso o la empresa elegidos.
//
// ─── QUIÉN CUENTA EN UN INDICADOR ─────────────────────────────────────────
//
// Trabajadores con la inscripción activa y la cuenta sin suspender. Es el
// mismo criterio del ranking (vista ranking_base): un administrador que probó
// el curso o alguien suspendido no tienen que mover el porcentaje de una
// empresa. En la lista de Personas sí aparecen todos.

import type { CertificadoEmitido, Codigo, Curso, Inscripcion, Perfil, Progreso } from "../Datos";
import type { FilaRankingAdmin, ResultadoFase } from "../Ranking";
import { describirCurso } from "../CatalogoCursos";
import { aFecha, diasEntre, inicioDelDia, normalizar, plural } from "./Formato";

export type EstadoAvance = "sin_empezar" | "en_curso" | "completado";

/** Orden y nombre de los estados: de más avanzado a menos, como se leen. */
export const ESTADOS: ReadonlyArray<{ id: EstadoAvance; rotulo: string }> = [
  { id: "completado", rotulo: "Completaron" },
  { id: "en_curso", rotulo: "En curso" },
  { id: "sin_empezar", rotulo: "Sin empezar" },
];

/** Sin avance en este plazo, alguien "en curso" pasa a estar detenido. */
export const DIAS_DETENIDO = 14;
/** Inscrito hace más que esto y sin empezar: hay que ir a buscarlo. */
export const DIAS_SIN_EMPEZAR = 7;

export type Vista = "resumen" | "personas" | "codigos" | "cursos" | "reportes" | "seguridad";

export type FiltroPersonas =
  | "todas"
  | "sin_empezar"
  | "en_curso"
  | "completado"
  | "detenidas"
  | "sin_curso"
  | "suspendidas";

/** Una persona en un curso: su inscripción con todo lo que se sabe de ella. */
export interface Matricula {
  perfil: Perfil;
  curso: Curso;
  inscripcion: Inscripcion;
  /** Fases de contenido aprobadas (la 0 es el tutorial y no cuenta). */
  fasesHechas: number[];
  estado: EstadoAvance;
  porcentaje: number;
  puntaje: number;
  ultimaActividad: string | null;
  completadoEn: string | null;
  certificado: CertificadoEmitido | null;
}

export interface Fuentes {
  perfiles: Perfil[];
  cursos: Curso[];
  inscripciones: Inscripcion[];
  progresos: Progreso[];
  certificados: CertificadoEmitido[];
}

export interface Alcance {
  cursoId: string | null;
  /** Clave normalizada de la empresa (ver claveEmpresa), o null para todas. */
  empresa: string | null;
}

const clave = (perfilId: string, cursoId: string): string => `${perfilId}|${cursoId}`;

/**
 * Cruza inscripciones, progreso y certificados en una fila por persona y curso.
 *
 * La regla de "completado" es la misma de Datos.catalogoDe y de los reportes:
 * tener la marca del servidor o todas las fases del curso aprobadas.
 */
export function armarMatriculas(f: Fuentes): Matricula[] {
  const perfiles = new Map(f.perfiles.map((p) => [p.id, p]));
  const cursos = new Map(f.cursos.map((c) => [c.id, c]));
  const progresos = new Map(f.progresos.map((p) => [clave(p.perfilId, p.cursoId), p]));
  const certificados = new Map(f.certificados.map((c) => [clave(c.perfilId, c.cursoId), c]));

  const salida: Matricula[] = [];
  for (const inscripcion of f.inscripciones) {
    const perfil = perfiles.get(inscripcion.perfilId);
    const curso = cursos.get(inscripcion.cursoId);
    if (!perfil || !curso) continue;

    const progreso = progresos.get(clave(perfil.id, curso.id)) ?? null;
    const hechas = [...new Set((progreso?.fasesCompletadas ?? []).filter((n) => n >= 1))].sort(
      (a, b) => a - b
    );
    const total = Math.max(1, curso.totalFases);
    const completo = Boolean(progreso?.completadoEn) || hechas.length >= total;

    salida.push({
      perfil,
      curso,
      inscripcion,
      fasesHechas: hechas,
      estado: completo ? "completado" : hechas.length > 0 ? "en_curso" : "sin_empezar",
      porcentaje: completo ? 100 : Math.round((Math.min(hechas.length, total) / total) * 100),
      puntaje: progreso?.puntaje ?? 0,
      ultimaActividad: progreso?.actualizadoEn ?? null,
      completadoEn: completo ? progreso?.completadoEn ?? progreso?.actualizadoEn ?? null : null,
      certificado: certificados.get(clave(perfil.id, curso.id)) ?? null,
    });
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Empresas y áreas
// ---------------------------------------------------------------------------

/**
 * La empresa la escribe cada persona al registrarse, así que "Bitplay",
 * "bitplay" y "Bitplay " son la misma. Se agrupan por esta clave y se muestran
 * con la forma más usada.
 */
export function claveEmpresa(empresa: string): string {
  return normalizar(empresa);
}

export interface OpcionEmpresa {
  clave: string;
  nombre: string;
  personas: number;
}

/** Empresas de los trabajadores, de la que tiene más gente a la que menos. */
export function empresasDe(perfiles: Perfil[]): OpcionEmpresa[] {
  return agrupar(
    perfiles.filter((p) => p.rol === "trabajador"),
    (p) => p.empresa,
    "Sin empresa"
  ).map(({ clave: c, nombre, cantidad }) => ({ clave: c, nombre, personas: cantidad }));
}

function agrupar<T>(
  items: T[],
  texto: (item: T) => string,
  vacio: string
): Array<{ clave: string; nombre: string; cantidad: number; items: T[] }> {
  const grupos = new Map<string, { formas: Map<string, number>; items: T[] }>();
  for (const item of items) {
    const original = texto(item).trim().replace(/\s+/g, " ");
    const c = normalizar(original);
    const grupo = grupos.get(c) ?? { formas: new Map<string, number>(), items: [] as T[] };
    grupo.formas.set(original, (grupo.formas.get(original) ?? 0) + 1);
    grupo.items.push(item);
    grupos.set(c, grupo);
  }

  return [...grupos.entries()]
    .map(([c, g]) => {
      const masUsada = [...g.formas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return { clave: c, nombre: masUsada || vacio, cantidad: g.items.length, items: g.items };
    })
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"));
}

// ---------------------------------------------------------------------------
// Alcance
// ---------------------------------------------------------------------------

export function coincideEmpresa(perfil: Perfil, empresa: string | null): boolean {
  return empresa === null || claveEmpresa(perfil.empresa) === empresa;
}

/** Las matrículas que cuentan para un indicador con el curso y la empresa elegidos. */
export function matriculasEnAlcance(todas: Matricula[], alcance: Alcance): Matricula[] {
  return todas.filter(
    (m) =>
      m.inscripcion.activa &&
      m.perfil.rol === "trabajador" &&
      !m.perfil.suspendido &&
      (alcance.cursoId === null || m.curso.id === alcance.cursoId) &&
      coincideEmpresa(m.perfil, alcance.empresa)
  );
}

function dentroDe(valor: string | null, dias: number, ahora: Date): boolean {
  if (!valor) return false;
  const f = aFecha(valor);
  return !Number.isNaN(f.getTime()) && ahora.getTime() - f.getTime() <= dias * 86_400_000;
}

export function estaDetenida(m: Matricula, ahora = new Date()): boolean {
  return (
    m.estado === "en_curso" &&
    !dentroDe(m.ultimaActividad ?? m.inscripcion.inscritoEn, DIAS_DETENIDO, ahora)
  );
}

// ---------------------------------------------------------------------------
// Cifras de cabecera
// ---------------------------------------------------------------------------

export interface Cifras {
  inscritos: number;
  nuevosSemana: number;
  completados: number;
  enCurso: number;
  sinEmpezar: number;
  activosSemana: number;
  certificados: number;
  /** Medida media por fase aprobada (puntaje o nota). Null sin datos por fase. */
  medidaMedia: number | null;
  /** Cuántas fases aprobadas entran en esa media. */
  fasesMedidas: number;
}

export function cifras(
  enAlcance: Matricula[],
  resultados: ResultadoFase[] | null,
  ahora = new Date()
): Cifras {
  const conteo = contarEstados(enAlcance);

  let medidaMedia: number | null = null;
  let fasesMedidas = 0;
  if (resultados) {
    const claves = new Set(enAlcance.map((m) => clave(m.perfil.id, m.curso.id)));
    const propios = resultados.filter((r) => r.fase >= 1 && claves.has(clave(r.perfilId, r.cursoId)));
    fasesMedidas = propios.length;
    if (propios.length > 0) {
      medidaMedia = propios.reduce((s, r) => s + r.puntaje, 0) / propios.length;
    }
  }

  return {
    inscritos: enAlcance.length,
    nuevosSemana: enAlcance.filter((m) => dentroDe(m.inscripcion.inscritoEn, 7, ahora)).length,
    completados: conteo.completado,
    enCurso: conteo.en_curso,
    sinEmpezar: conteo.sin_empezar,
    activosSemana: enAlcance.filter((m) => dentroDe(m.ultimaActividad, 7, ahora)).length,
    certificados: enAlcance.filter((m) => m.certificado).length,
    medidaMedia,
    fasesMedidas,
  };
}

export function contarEstados(matriculas: Matricula[]): Record<EstadoAvance, number> {
  const conteo: Record<EstadoAvance, number> = { completado: 0, en_curso: 0, sin_empezar: 0 };
  for (const m of matriculas) conteo[m.estado]++;
  return conteo;
}

// ---------------------------------------------------------------------------
// Avance por fase
// ---------------------------------------------------------------------------

export interface FilaFase {
  fase: number;
  nombre: string;
  detalle: string;
  aprobaron: number;
  porcentaje: number;
  /** Puntaje o nota media del mejor intento. Null si no hay datos por fase. */
  medida: number | null;
  segundos: number | null;
}

/**
 * Cuántos aprobaron cada fase de un curso.
 *
 * "Aprobaron" sale del progreso (el mismo dato que decide el estado de cada
 * persona); los resultados por fase solo aportan el puntaje y el tiempo.
 */
export function avancePorFase(
  enAlcance: Matricula[],
  curso: Curso,
  resultados: ResultadoFase[] | null
): FilaFase[] {
  const descripcion = describirCurso(curso);
  const deEsteCurso = enAlcance.filter((m) => m.curso.id === curso.id);
  const personas = new Set(deEsteCurso.map((m) => m.perfil.id));
  const total = deEsteCurso.length;

  return descripcion.fases.map((f, i) => {
    const fase = i + 1;
    const aprobaron = deEsteCurso.filter((m) => m.fasesHechas.includes(fase)).length;

    let medida: number | null = null;
    let segundos: number | null = null;
    if (resultados) {
      const filas = resultados.filter(
        (r) => r.cursoId === curso.id && r.fase === fase && personas.has(r.perfilId)
      );
      if (filas.length > 0) {
        medida = filas.reduce((s, r) => s + r.puntaje, 0) / filas.length;
        const conTiempo = filas.filter((r) => r.segundos > 0);
        segundos =
          conTiempo.length > 0 ? conTiempo.reduce((s, r) => s + r.segundos, 0) / conTiempo.length : null;
      }
    }

    return {
      fase,
      nombre: f.nombre,
      detalle: f.detalle,
      aprobaron,
      porcentaje: total > 0 ? Math.round((aprobaron / total) * 100) : 0,
      medida,
      segundos,
    };
  });
}

// ---------------------------------------------------------------------------
// Curva acumulada
// ---------------------------------------------------------------------------

export interface PuntoAcumulado {
  fecha: Date;
  inscritos: number;
  completados: number;
}

export interface SerieAcumulada {
  puntos: PuntoAcumulado[];
  paso: "dia" | "semana";
}

/**
 * Inscritos y completados acumulados, día por día desde la primera inscripción.
 *
 * Es la curva más honesta que permiten los datos: la fecha de inscripción y la
 * de término se guardan una vez y no cambian. Un "intentos por día" no se
 * puede dibujar, porque el servidor guarda el mejor intento de cada fase y no
 * cada partida.
 *
 * Con más de cuatro meses de historia los puntos pasan a ser semanales: una
 * línea de quinientos días no dice más que una de setenta semanas.
 */
export function serieAcumulada(enAlcance: Matricula[], ahora = new Date()): SerieAcumulada | null {
  if (enAlcance.length === 0) return null;

  const inscripciones = enAlcance
    .map((m) => aFecha(m.inscripcion.inscritoEn).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (inscripciones.length === 0) return null;

  const terminos = enAlcance
    .map((m) => (m.completadoEn ? aFecha(m.completadoEn).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const hoy = inicioDelDia(ahora);
  let inicio = inicioDelDia(new Date(inscripciones[0]));
  // Una semana como mínimo: con un solo día la curva sería un punto.
  if (diasEntre(inicio, hoy) < 6) inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6);

  const dias = diasEntre(inicio, hoy);
  const paso: SerieAcumulada["paso"] = dias > 120 ? "semana" : "dia";
  const salto = paso === "semana" ? 7 : 1;

  // De la más antigua a hoy. Con paso semanal se cuenta hacia atrás desde hoy
  // para que el último punto sea siempre hoy, y después se ordena.
  const fechas: Date[] = [];
  for (let d = 0; d <= dias; d += salto) {
    fechas.push(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d));
  }
  fechas.reverse();

  let i = 0;
  let j = 0;
  const puntos = fechas.map((fecha) => {
    const finDelDia = fecha.getTime() + 86_400_000;
    while (i < inscripciones.length && inscripciones[i] < finDelDia) i++;
    while (j < terminos.length && terminos[j] < finDelDia) j++;
    return { fecha, inscritos: i, completados: j };
  });

  return { puntos, paso };
}

// ---------------------------------------------------------------------------
// Grupos: áreas y cursos
// ---------------------------------------------------------------------------

export interface FilaGrupo {
  clave: string;
  nombre: string;
  total: number;
  completado: number;
  en_curso: number;
  sin_empezar: number;
}

/**
 * Avance por área, de la que tiene más gente a la que menos.
 *
 * Con muchas áreas solo se dibujan las primeras y el resto se junta en "Otras
 * áreas": treinta barras de una persona cada una no dejan ver nada.
 */
export function coberturaPorArea(enAlcance: Matricula[], tope = 8): FilaGrupo[] {
  const grupos = agrupar(enAlcance, (m) => m.perfil.area, "Sin área").map((g) => ({
    clave: g.clave,
    nombre: g.nombre,
    total: g.cantidad,
    ...contarEstados(g.items),
  }));

  if (grupos.length <= tope) return grupos;

  const visibles = grupos.slice(0, tope - 1);
  const resto = grupos.slice(tope - 1);
  const otras: FilaGrupo = {
    clave: "__otras",
    nombre: `Otras ${resto.length} áreas`,
    total: 0,
    completado: 0,
    en_curso: 0,
    sin_empezar: 0,
  };
  for (const g of resto) {
    otras.total += g.total;
    otras.completado += g.completado;
    otras.en_curso += g.en_curso;
    otras.sin_empezar += g.sin_empezar;
  }
  return [...visibles, otras];
}

/** Lo mismo que por área, pero por curso: para la vista "Todos los cursos". */
export function comparacionCursos(enAlcance: Matricula[], cursos: Curso[]): FilaGrupo[] {
  return cursos
    .map((curso) => {
      const delCurso = enAlcance.filter((m) => m.curso.id === curso.id);
      return {
        clave: curso.id,
        nombre: describirCurso(curso).corto,
        total: delCurso.length,
        ...contarEstados(delCurso),
      };
    })
    .filter((g) => g.total > 0 || cursos.length <= 4);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * El ranking del curso recortado a una empresa.
 *
 * Al filtrar, la posición se vuelve a numerar: "3.º" tiene que querer decir
 * tercero de esa empresa, que es lo que se le muestra al cliente.
 */
export function rankingEnAlcance(filas: FilaRankingAdmin[], empresa: string | null): FilaRankingAdmin[] {
  if (empresa === null) return filas;
  return filas
    .filter((f) => claveEmpresa(f.empresa ?? "") === empresa)
    .map((f, i) => ({ ...f, posicion: i + 1 }));
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

export type EstadoCodigo = "disponible" | "sin_cupos" | "vencido" | "baja";

/**
 * Estado de un código, con el mismo criterio que canjear_codigo en la base:
 * vence al terminar el día de su fecha, no al empezar.
 */
export function estadoCodigo(c: Codigo, ahora = new Date()): EstadoCodigo {
  if (!c.activo) return "baja";
  if (c.venceEn && aFecha(c.venceEn).getTime() < inicioDelDia(ahora).getTime()) return "vencido";
  if (c.usosActuales >= c.usosMaximos) return "sin_cupos";
  return "disponible";
}

export function cuposLibres(c: Codigo): number {
  return Math.max(0, c.usosMaximos - c.usosActuales);
}

/** Días que le quedan a un código vigente; null si no vence. */
export function diasParaVencer(c: Codigo, ahora = new Date()): number | null {
  if (!c.venceEn) return null;
  return diasEntre(ahora, aFecha(c.venceEn));
}

// ---------------------------------------------------------------------------
// Lo que requiere atención
// ---------------------------------------------------------------------------

export interface Alerta {
  tono: "riesgo" | "aviso" | "dato";
  titulo: string;
  detalle: string;
  ir?: { vista: Vista; filtro?: FiltroPersonas };
}

/**
 * Lo que alguien tiene que hacer hoy, en frases y no en tablas.
 *
 * Cada alerta lleva a la lista filtrada que la explica: un número que no se
 * puede abrir obliga a buscar a mano a las personas que cuenta.
 */
export function alertas(
  enAlcance: Matricula[],
  codigos: Codigo[],
  fases: FilaFase[] | null,
  ahora = new Date()
): Alerta[] {
  const salida: Alerta[] = [];

  const sinEmpezar = enAlcance.filter(
    (m) => m.estado === "sin_empezar" && !dentroDe(m.inscripcion.inscritoEn, DIAS_SIN_EMPEZAR, ahora)
  );
  if (sinEmpezar.length > 0) {
    salida.push({
      tono: "aviso",
      titulo: plural(sinEmpezar.length, "persona no empieza", "personas no empiezan"),
      detalle: `Se inscribieron hace más de ${DIAS_SIN_EMPEZAR} días y no aprobaron ninguna fase.`,
      ir: { vista: "personas", filtro: "sin_empezar" },
    });
  }

  const detenidas = enAlcance.filter((m) => estaDetenida(m, ahora));
  if (detenidas.length > 0) {
    salida.push({
      tono: "aviso",
      titulo: plural(detenidas.length, "persona sin avanzar", "personas sin avanzar"),
      detalle: `Empezaron, pero llevan más de ${DIAS_DETENIDO} días sin aprobar otra fase.`,
      ir: { vista: "personas", filtro: "detenidas" },
    });
  }

  const vigentes = codigos.filter((c) => estadoCodigo(c, ahora) === "disponible");
  const porAgotarse = vigentes.filter(
    (c) => cuposLibres(c) <= Math.max(2, Math.ceil(c.usosMaximos * 0.1))
  );
  if (porAgotarse.length === 1) {
    const c = porAgotarse[0];
    salida.push({
      tono: "riesgo",
      titulo: `Al código ${c.codigo} ${cuposLibres(c) === 1 ? "le queda 1 cupo" : `le quedan ${cuposLibres(c)} cupos`}`,
      detalle: "Emite otro antes de repartirlo a más gente.",
      ir: { vista: "codigos" },
    });
  } else if (porAgotarse.length > 1) {
    salida.push({
      tono: "riesgo",
      titulo: `${porAgotarse.length} códigos están por agotarse`,
      detalle: porAgotarse.map((c) => c.codigo).slice(0, 3).join(", ") + (porAgotarse.length > 3 ? "…" : ""),
      ir: { vista: "codigos" },
    });
  }

  const porVencer = vigentes.filter((c) => {
    const d = diasParaVencer(c, ahora);
    return d !== null && d <= 7;
  });
  if (porVencer.length > 0) {
    const c = porVencer[0];
    const d = diasParaVencer(c, ahora) ?? 0;
    salida.push({
      tono: "aviso",
      titulo:
        porVencer.length === 1
          ? `El código ${c.codigo} vence ${d <= 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`}`
          : `${porVencer.length} códigos vencen esta semana`,
      detalle: "Quien no lo haya canjeado va a necesitar uno nuevo.",
      ir: { vista: "codigos" },
    });
  }

  // La fase donde más gente se queda: la mayor caída respecto de la anterior.
  if (fases && fases.length > 1 && enAlcance.length >= 5) {
    let peor: { desde: FilaFase; hasta: FilaFase; caida: number } | null = null;
    for (let i = 1; i < fases.length; i++) {
      const caida = fases[i - 1].aprobaron - fases[i].aprobaron;
      if (caida > 0 && (!peor || caida > peor.caida)) peor = { desde: fases[i - 1], hasta: fases[i], caida };
    }
    if (peor && peor.caida >= 2) {
      salida.push({
        tono: "dato",
        titulo: `La mayor caída está en ${peor.hasta.nombre}`,
        detalle: `${plural(peor.desde.aprobaron, "persona aprobó", "personas aprobaron")} ${peor.desde.nombre}, pero solo ${peor.hasta.aprobaron} ${peor.hasta.nombre}.`,
      });
    }
  }

  return salida;
}
