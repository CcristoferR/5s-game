// ===========================================================================
// Registro de cursos jugables
// ===========================================================================
//
// La tabla `cursos` de la base dice qué cursos EXISTEN. Este archivo dice cuál
// es el juego de cada uno.
//
// ─── POR QUÉ HACE FALTA ────────────────────────────────────────────────────
//
// El catálogo ya entrega el id del curso al entrar —`onEntrarCurso(cursoId)`—
// y hasta ahora main.ts lo descartaba con un comentario que decía que todos
// los cursos abren el 5S porque era el único que había. Con dos cursos eso deja
// de ser cierto: quien canjee el de guardias entraría a un galpón a clasificar
// tornillos.
//
// ─── POR QUÉ UN REGISTRO Y NO UN CAMPO EN LA BASE ─────────────────────────
//
// Porque el juego es código, no un dato. Si el curso trajera el nombre de su
// módulo en una columna, cualquier fila mal escrita apuntaría a un módulo
// inexistente y el error saldría recién al hacer clic en Comenzar, en
// producción. Acá el compilador comprueba que cada curso tenga su juego y que
// cada juego exista, antes de publicar nada.
//
// Un curso sembrado en la base y ausente de este registro es un curso sin
// juego: `juegoDe` devuelve null y el portal avisa en vez de romperse. Es el
// estado normal mientras se está construyendo.

import type { GameManager } from "../core/GameManager";

/**
 * Lo que main.ts necesita de un juego para arrancarlo.
 *
 * Deliberadamente mínimo. Cada curso tiene sus mecánicas, sus escenas y su
 * estado; lo único que comparten es que se les puede pedir que se abran y que
 * declaren cuántas fases tienen.
 */
export interface JuegoDeCurso {
  /** Fases del juego. Debe cuadrar con `total_fases` de la fila del curso. */
  totalFases: number;

  /**
   * Abre el juego. Recibe el progreso ya restaurado en el GameManager.
   *
   * Se carga con import() dinámico, así que el navegador solo descarga el juego
   * del curso que la persona abrió. Hoy todo va en un único paquete y vite ya
   * avisa de su tamaño; con dos juegos completos dentro sería el doble.
   */
  abrir: () => Promise<void>;
}

export type CargadorDeJuego = (gameManager: GameManager) => JuegoDeCurso;

/** Curso de 5S. El id tiene que coincidir con la fila de la base. */
export const CURSO_5S = "curso-5s-operaciones";

/** Curso de guardias de seguridad (manual de apoyo OS10). */
export const CURSO_GUARDIAS = "curso-guardias-os10";

let abrir5S: (() => void) | null = null;

/** main.ts publica aquí su función de arranque del 5S. */
export function registrarJuego5S(abrir: () => void): void {
  abrir5S = abrir;
}

let abrirGuardias: (() => Promise<void>) | null = null;

/** main.ts publica aquí su función de arranque del curso de guardias. */
export function registrarJuegoGuardias(abrir: () => Promise<void>): void {
  abrirGuardias = abrir;
}

const REGISTRO: Record<string, CargadorDeJuego> = {
  [CURSO_5S]: () => ({
    totalFases: 5,
    // El 5S todavia vive dentro de main.ts, que es de donde nacio el proyecto.
    // Se registra a si mismo al arrancar con registrarJuego5S(): mudarlo ahora
    // a src/juegos/ seria un cambio grande y sin ganancia inmediata, y este
    // registro funciona igual con el juego donde este. Cuando se mude, cambia
    // solo esta linea.
    abrir: async () => {
      if (!abrir5S) throw new Error("El juego de 5S no se registró al arrancar");
      abrir5S();
    },
  }),

  [CURSO_GUARDIAS]: () => ({
    totalFases: 1,
    // Igual que el 5S: necesita la escena que monta main.ts, asi que main.ts
    // publica aqui su arrancador. El import dinamico se hace ahi, para que el
    // navegador no descargue este juego si la persona abrio el otro.
    abrir: async () => {
      if (!abrirGuardias) throw new Error("El curso de guardias no se registró al arrancar");
      await abrirGuardias();
    },
  }),
};

/** El juego de un curso, o null si ese curso todavía no tiene uno. */
export function juegoDe(cursoId: string, gameManager: GameManager): JuegoDeCurso | null {
  const cargador = REGISTRO[cursoId];
  return cargador ? cargador(gameManager) : null;
}

/** Si el curso se puede jugar. El catálogo lo usa para no ofrecer un botón muerto. */
export function tieneJuego(cursoId: string): boolean {
  return cursoId in REGISTRO;
}