// Guarda el ranking del Nivel 5 en el navegador del jugador (localStorage).
// Es un ranking "local": compara tus propios mejores intentos en ESTE
// dispositivo, no entre distintos jugadores — eso necesitaría un backend
// (Firebase/Supabase, como quedamos). Se armó como una capa separada a
// propósito: el día que quieran el ranking real, solo hay que cambiar
// las 3 funciones de acá (guardar/leer/borrar) por llamadas al backend
// — la pantalla (RankingScreen.ts) y el resto del juego no cambian.

export interface EntradaRankingNivel5 {
  tasaAcierto: number; // 0-1
  promedioCalificacion: number; // 1-5
  segundos: number;
  fecha: string; // ISO 8601
}

const CLAVE_STORAGE = "5s-game:ranking-nivel5";
const MAXIMO_ENTRADAS = 10;

function ordenar(entradas: EntradaRankingNivel5[]): EntradaRankingNivel5[] {
  return [...entradas].sort((a, b) => {
    if (b.tasaAcierto !== a.tasaAcierto) return b.tasaAcierto - a.tasaAcierto;
    return a.segundos - b.segundos;
  });
}

// Valida que lo que salió de localStorage tenga la forma esperada antes
// de confiar en él — si alguien tocó el localStorage a mano, o quedó un
// dato de una versión vieja del juego, esto evita que el ranking rompa
// la pantalla en vez de simplemente ignorar el dato malo.
function esEntradaValida(valor: unknown): valor is EntradaRankingNivel5 {
  if (!valor || typeof valor !== "object") return false;
  const e = valor as Record<string, unknown>;
  return (
    typeof e.tasaAcierto === "number" &&
    Number.isFinite(e.tasaAcierto) &&
    typeof e.promedioCalificacion === "number" &&
    Number.isFinite(e.promedioCalificacion) &&
    typeof e.segundos === "number" &&
    Number.isFinite(e.segundos) &&
    typeof e.fecha === "string"
  );
}

export function obtenerRankingNivel5(): EntradaRankingNivel5[] {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return [];
    const parseado = JSON.parse(crudo);
    if (!Array.isArray(parseado)) return [];
    return ordenar(parseado.filter(esEntradaValida));
  } catch {
    // localStorage puede no estar disponible (navegación privada,
    // permisos del navegador, etc.) o el dato guardado puede estar
    // corrupto — en cualquier caso, el ranking se muestra vacío en vez
    // de romper el juego.
    return [];
  }
}

export function guardarResultadoNivel5(resultado: {
  tasaAcierto: number;
  promedioCalificacion: number;
  segundos: number;
}): void {
  try {
    const nuevaEntrada: EntradaRankingNivel5 = {
      tasaAcierto: Math.min(1, Math.max(0, resultado.tasaAcierto)),
      promedioCalificacion: Math.min(5, Math.max(1, resultado.promedioCalificacion)),
      segundos: Math.max(0, Math.round(resultado.segundos)),
      fecha: new Date().toISOString(),
    };

    const actuales = obtenerRankingNivel5();
    const actualizado = ordenar([...actuales, nuevaEntrada]).slice(0, MAXIMO_ENTRADAS);
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(actualizado));
  } catch {
    // Si falla el guardado (storage lleno o deshabilitado), el juego
    // sigue funcionando igual — el ranking es un plus, no algo crítico
    // para poder jugar.
  }
}

export function borrarRankingNivel5(): void {
  try {
    localStorage.removeItem(CLAVE_STORAGE);
  } catch {
    // No hay nada razonable que hacer si ni siquiera se puede borrar.
  }
}