// ===========================================================================
// Cómo se nombra cada curso dentro del portal
// ===========================================================================
//
// La tabla `cursos` dice cuántas fases tiene un curso; no dice cómo se llaman.
// El panel y Mi cuenta necesitan ese nombre para hablar como el curso habla:
// "Seiso" y no "fase 3", "escenario" y no "fase" en guardias, "nota" y no
// "puntaje" cuando el escenario se califica de 0 a 100.
//
// ─── UN CURSO NUEVO NO NECESITA ESTAR ACÁ ─────────────────────────────────
//
// Si mañana se publica un tercer curso y nadie lo agrega a esta lista, el
// portal no se rompe ni lo esconde: lo muestra con su nombre de la base y sus
// fases numeradas ("Fase 1", "Fase 2"…). Agregarlo solo afina las palabras.
// Por eso ninguna pantalla pregunta "¿es el 5S?": preguntan acá.

import { CURSO_5S, CURSO_GUARDIAS } from "./CursosJugables";
// Capturas reales de cada juego, las mismas de la landing (inicio/img).
import portada5S from "./portadas/5s-taller.webp";
import portadaGuardias from "./portadas/guardias-condominio.webp";

export interface FaseDescrita {
  /** Lo que se lee en un gráfico o en una lista: "Seiso", "Banco". */
  nombre: string;
  /** El complemento, para una ayuda o una ficha: "Limpiar". */
  detalle: string;
}

export interface DescripcionCurso {
  /** Nombre corto, para selectores y gráficos: "Operación 5S". */
  corto: string;
  /** Cómo se llama cada parte del curso: singular, plural y "aprobadas" con su género. */
  unidad: { una: string; varias: string; aprobadas: string };
  /** Cómo se llama el número que saca cada parte, y su promedio ("Nota media"). */
  medida: { una: string; varias: string; media: string };
  /** Prefijo de los códigos de inscripción: "5S-PLANTA-2345". */
  prefijoCodigo: string;
  fases: FaseDescrita[];
  /**
   * La pantalla que se ve al entrar al curso mientras carga: una captura del
   * juego y lo que se está preparando. Sin esto, la portada sale sin imagen.
   */
  portada?: { imagen: string; preparando: string };
}

const CONOCIDOS: Record<string, DescripcionCurso> = {
  [CURSO_5S]: {
    corto: "Operación 5S",
    unidad: { una: "fase", varias: "fases", aprobadas: "fases aprobadas" },
    medida: { una: "puntaje", varias: "puntajes", media: "Puntaje medio" },
    prefijoCodigo: "5S",
    portada: { imagen: portada5S, preparando: "Preparando el taller" },
    fases: [
      { nombre: "Seiri", detalle: "Clasificar" },
      { nombre: "Seiton", detalle: "Ordenar" },
      { nombre: "Seiso", detalle: "Limpiar" },
      { nombre: "Seiketsu", detalle: "Estandarizar" },
      { nombre: "Shitsuke", detalle: "Disciplina" },
    ],
  },
  [CURSO_GUARDIAS]: {
    corto: "Guardias",
    unidad: { una: "escenario", varias: "escenarios", aprobadas: "escenarios aprobados" },
    medida: { una: "nota", varias: "notas", media: "Nota media" },
    prefijoCodigo: "GS",
    portada: { imagen: portadaGuardias, preparando: "Preparando el turno" },
    fases: [
      { nombre: "Condominio", detalle: "Libro de novedades" },
      { nombre: "Supermercado", detalle: "Rondas de verificación" },
      { nombre: "Banco", detalle: "Puesto de acceso" },
    ],
  },
};

/**
 * La descripción de un curso, con relleno para lo que no se conoce.
 *
 * Recibe el total de fases de la base y no el de esta lista: si el curso
 * crece, la base manda y las fases que falten aparecen numeradas.
 */
export function describirCurso(curso: { id: string; nombre: string; totalFases: number }): DescripcionCurso {
  const conocido = CONOCIDOS[curso.id];
  const total = Math.max(0, curso.totalFases);

  const fases = Array.from({ length: total }, (_, i) => {
    const propia = conocido?.fases[i];
    return propia ?? { nombre: `Fase ${i + 1}`, detalle: "" };
  });

  if (conocido) return { ...conocido, fases };

  return {
    corto: curso.nombre,
    unidad: { una: "fase", varias: "fases", aprobadas: "fases aprobadas" },
    medida: { una: "puntaje", varias: "puntajes", media: "Puntaje medio" },
    prefijoCodigo: "CP",
    fases,
  };
}

/** "3 fases", "1 escenario". */
export function contarUnidades(descripcion: DescripcionCurso, cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? descripcion.unidad.una : descripcion.unidad.varias}`;
}

/**
 * Prefijo de los códigos de inscripción de un curso: 5S, GS, o CP (ClassPlay)
 * para cualquier curso que no esté en la lista.
 */
export function prefijoDeCurso(cursoId: string): string {
  return CONOCIDOS[cursoId]?.prefijoCodigo ?? "CP";
}
