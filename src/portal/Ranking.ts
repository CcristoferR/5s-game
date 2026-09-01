import { supabase } from "./supabase";

/**
 * Ranking del curso.
 *
 * Todo lo que sale de acá viene de funciones de PostgreSQL, no de consultas
 * sueltas a las tablas. Es a propósito: la tabla de resultados tiene RLS que
 * solo deja ver las filas propias, así que el navegador NO puede armar un
 * ranking por su cuenta ni bajarse los puntajes de la empresa. Las funciones
 * deciden qué se muestra y a quién, y esa decisión corre en el servidor —
 * donde nadie la puede saltar editando el navegador.
 *
 * Ver supabase/ranking.sql para el esquema y las políticas.
 */

export interface FilaRanking {
  posicion: number;
  perfilId: string;
  nombreCompleto: string;
  area: string | null;
  puntajeTotal: number;
  segundosTotal: number;
  fasesAprobadas: number;
  soyYo: boolean;
}

export interface MiPosicion {
  posicion: number;
  participantes: number;
  puntajeTotal: number;
  segundosTotal: number;
}

export interface FilaRankingAdmin extends Omit<FilaRanking, "soyYo"> {
  empresa: string | null;
  ultimaActividad: string;
}

function avisarError(donde: string, error: unknown): void {
  console.error(`[ranking] ${donde}:`, error);
}

/**
 * Guarda el resultado de una fase.
 *
 * Se llama al aprobar CADA nivel, no al terminar el curso: si alguien deja el
 * curso a la mitad, lo que hizo tiene que quedar registrado igual.
 *
 * El servidor conserva el mejor intento, así que repetir un nivel para
 * practicar nunca empeora la posición de nadie.
 */
export async function guardarResultadoDeFase(
  cursoId: string,
  fase: number,
  puntaje: number,
  segundos: number
): Promise<boolean> {
  const { error } = await supabase.rpc("guardar_resultado_fase", {
    p_curso_id: cursoId,
    p_fase: fase,
    p_puntaje: Math.max(0, Math.round(puntaje)),
    p_segundos: Math.max(0, Math.round(segundos)),
  });

  if (error) {
    avisarError("guardarResultadoDeFase", error);
    return false;
  }

  return true;
}

/** Los primeros del ranking de la empresa de quien consulta. */
export async function podioDelCurso(cursoId: string, limite = 10): Promise<FilaRanking[]> {
  const { data, error } = await supabase.rpc("ranking_curso", {
    p_curso_id: cursoId,
    p_limite: limite,
  });

  if (error) {
    avisarError("podioDelCurso", error);
    return [];
  }

  return (data ?? []).map(
    (f: {
      posicion: number;
      perfil_id: string;
      nombre_completo: string;
      area: string | null;
      puntaje_total: number;
      segundos_total: number;
      fases_aprobadas: number;
      soy_yo: boolean;
    }) => ({
      posicion: f.posicion,
      perfilId: f.perfil_id,
      nombreCompleto: f.nombre_completo,
      area: f.area,
      puntajeTotal: f.puntaje_total,
      segundosTotal: f.segundos_total,
      fasesAprobadas: f.fases_aprobadas,
      soyYo: f.soy_yo,
    })
  );
}

/**
 * Posición propia dentro del ranking.
 *
 * Se pide aparte del podio porque casi nadie está en el podio: sin este dato,
 * la mayoría vería una lista de desconocidos y ninguna información sobre sí
 * misma. Devuelve null si la persona todavía no aprobó ninguna fase.
 */
export async function miPosicion(cursoId: string): Promise<MiPosicion | null> {
  const { data, error } = await supabase.rpc("mi_posicion_en_ranking", {
    p_curso_id: cursoId,
  });

  if (error) {
    avisarError("miPosicion", error);
    return null;
  }

  const fila = (data ?? [])[0];
  if (!fila) return null;

  return {
    posicion: fila.posicion,
    participantes: fila.participantes,
    puntajeTotal: fila.puntaje_total,
    segundosTotal: fila.segundos_total,
  };
}

/**
 * Ranking completo, sin recorte por empresa ni límite de filas.
 *
 * Solo funciona si quien llama es administrador: la comprobación vive dentro
 * de la función de base de datos, no acá. Esconder el botón en la interfaz no
 * protege nada — cualquiera puede llamar a la función desde la consola.
 */
export async function rankingCompleto(
  cursoId: string,
  empresa?: string
): Promise<FilaRankingAdmin[]> {
  const { data, error } = await supabase.rpc("ranking_completo", {
    p_curso_id: cursoId,
    p_empresa: empresa ?? null,
  });

  if (error) {
    avisarError("rankingCompleto", error);
    return [];
  }

  return (data ?? []).map(
    (f: {
      posicion: number;
      perfil_id: string;
      nombre_completo: string;
      empresa: string | null;
      area: string | null;
      puntaje_total: number;
      segundos_total: number;
      fases_aprobadas: number;
      ultima_actividad: string;
    }) => ({
      posicion: f.posicion,
      perfilId: f.perfil_id,
      nombreCompleto: f.nombre_completo,
      empresa: f.empresa,
      area: f.area,
      puntajeTotal: f.puntaje_total,
      segundosTotal: f.segundos_total,
      fasesAprobadas: f.fases_aprobadas,
      ultimaActividad: f.ultima_actividad,
    })
  );
}

/** Formatea segundos como "4 min 12 s", que se lee mejor que "252 s". */
export function formatearDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}