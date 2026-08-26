import type { Perfil } from "./Datos";
import { listarPerfiles, type RolUsuario } from "./Datos";

/**
 * Sesión abierta.
 *
 * Sobrevive a recargar la página a propósito: alguien que hace el curso en el
 * computador de planta y recarga sin querer no tiene que volver a canjear su
 * código —y menos gastar otro cupo del lote.
 */

const CLAVE_SESION = "5s-portal.sesion.v2";

export interface Sesion {
  perfil: Perfil;
  abiertaEn: string;
}

export function leerSesion(): Sesion | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;

    const dato = JSON.parse(crudo);
    // Si el dato quedó de una versión anterior o alguien lo editó a mano, se
    // descarta en vez de arrastrar un objeto incompleto hasta el juego.
    if (!dato?.perfil?.id || !dato?.perfil?.rol) return null;

    return dato as Sesion;
  } catch {
    return null;
  }
}

/**
 * Devuelve el rol REAL de quien tiene la sesión abierta.
 *
 * La sesión guardada no es fuente de verdad: vive en el navegador y cualquiera
 * puede abrir las herramientas de desarrollo y cambiar "trabajador" por
 * "administrador". Por eso el rol se vuelve a leer del registro de perfiles
 * antes de decidir qué pantalla abrir, y ante cualquier duda se degrada a
 * trabajador — el permiso menor, nunca el mayor.
 *
 * Esto sigue sin ser una barrera real: el registro de perfiles también está en
 * el navegador y también se puede editar. Lo que hace es dejar la comprobación
 * en el lugar correcto, para que al llegar el servidor solo cambie de dónde
 * viene el dato.
 */
export async function rolVerificado(sesion: Sesion): Promise<RolUsuario> {
  try {
    const perfiles = await listarPerfiles();
    const real = perfiles.find((p) => p.id === sesion.perfil.id);
    if (!real) return "trabajador";
    return real.rol;
  } catch {
    return "trabajador";
  }
}

export function abrirSesion(perfil: Perfil): Sesion {
  const sesion: Sesion = { perfil, abiertaEn: new Date().toISOString() };
  try {
    window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Navegación privada: la sesión vale igual hasta que se recargue.
  }
  return sesion;
}

export function cerrarSesion(): void {
  try {
    window.localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Si no se puede escribir, la sesión muere sola al recargar.
  }
}