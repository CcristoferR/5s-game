import type { Perfil } from "./Datos";

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