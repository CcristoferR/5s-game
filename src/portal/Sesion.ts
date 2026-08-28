import { supabase } from "./supabase";
import { perfilDe, type Perfil, type RolUsuario } from "./Datos";

/**
 * Sesión de quien está usando la plataforma.
 *
 * La sesión de verdad la administra Supabase: guarda un token firmado, lo
 * renueva solo y lo invalida al cerrar. Este módulo solo la consulta.
 *
 * La diferencia con la versión anterior es de fondo. Antes la sesión era un
 * objeto en el navegador con el rol adentro, así que bastaba con editarlo para
 * entrar al panel de administración. Ahora el rol se lee de la base en cada
 * arranque, y aunque alguien manipule lo que tiene a mano, el servidor
 * responde según lo que dice la tabla — no según lo que diga el navegador.
 */

export interface Sesion {
  perfil: Perfil;
}

/**
 * Devuelve la sesión abierta, o null.
 *
 * Es asíncrona porque hay que preguntarle al servidor. Antes era instantánea
 * porque leía del navegador, y esa inmediatez era justamente el problema: lo
 * que el navegador guarda, el navegador lo puede alterar.
 */
export async function leerSesion(): Promise<Sesion | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  const perfil = await perfilDe(data.session.user.id);
  if (!perfil) return null;

  return { perfil };
}

/**
 * Rol confirmado contra la base.
 *
 * Se vuelve a consultar en vez de confiar en lo que traiga la sesión, y ante
 * cualquier duda se degrada a trabajador: el permiso menor, nunca el mayor.
 */
export async function rolVerificado(sesion: Sesion): Promise<RolUsuario> {
  const actual = await perfilDe(sesion.perfil.id);
  return actual?.rol ?? "trabajador";
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}