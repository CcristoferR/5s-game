// ---------------------------------------------------------------------------
// Formato de textos, números y fechas del panel
// ---------------------------------------------------------------------------
//
// Todo lo que el panel escribe pasa por acá, para que una fecha o una cifra se
// vea igual en el resumen, en la tabla y en la ficha de una persona.

const DIA = 86_400_000;

/**
 * Escapa el texto que viene de la base antes de incrustarlo en el HTML.
 *
 * Los nombres, empresas y áreas los escribe cada persona al registrarse. Sin
 * esto, alguien que ponga etiquetas HTML en su nombre las ejecuta en el
 * navegador del administrador, que es justamente quien más permisos tiene.
 */
export function escapar(texto: string | null | undefined): string {
  return (texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto comparable: sin tildes, sin mayúsculas y sin espacios de sobra. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const NUMERO = new Intl.NumberFormat("es-CL");

export function numero(valor: number): string {
  return NUMERO.format(Math.round(valor));
}

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** "1 persona", "12 personas". */
export function plural(cantidad: number, una: string, varias: string): string {
  return `${numero(cantidad)} ${cantidad === 1 ? una : varias}`;
}

/**
 * Fecha de un valor que puede ser solo día ("2026-10-15") o fecha y hora.
 *
 * El día solo se interpreta en hora local. `new Date("2026-10-15")` lo toma
 * como medianoche UTC, que en Chile es la noche ANTERIOR: el código que vence
 * el 15 aparecía venciendo el 14.
 */
export function aFecha(valor: string): Date {
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloDia) return new Date(Number(soloDia[1]), Number(soloDia[2]) - 1, Number(soloDia[3]));
  return new Date(valor);
}

export function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return "—";
  const f = aFecha(valor);
  if (Number.isNaN(f.getTime())) return "—";
  return f.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export function fechaDiaMes(f: Date): string {
  return f.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const f = aFecha(valor);
  if (Number.isNaN(f.getTime())) return "—";
  return f.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Comienzo del día local de una fecha. */
export function inicioDelDia(f: Date): Date {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate());
}

/** Días enteros entre dos fechas, contados por calendario local. */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime()) / DIA);
}

/**
 * "hoy", "ayer", "hace 3 días", "hace 2 meses".
 *
 * Para la columna de actividad: lo que importa es cuánto hace, no la fecha.
 * La fecha exacta va en el title de la celda.
 */
export function haceCuanto(valor: string | null | undefined, ahora = new Date()): string {
  if (!valor) return "Sin actividad";
  const f = aFecha(valor);
  if (Number.isNaN(f.getTime())) return "Sin actividad";
  const dias = diasEntre(f, ahora);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 14) return `Hace ${dias} días`;
  if (dias < 60) return `Hace ${Math.round(dias / 7)} semanas`;
  if (dias < 365) return `Hace ${Math.round(dias / 30)} meses`;
  return `Hace ${Math.round(dias / 365)} ${Math.round(dias / 365) === 1 ? "año" : "años"}`;
}

/** "4 min 12 s", "1 h 05 min". Para tiempos de juego. */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const minutos = Math.floor(s / 60);
  if (minutos < 60) {
    const resto = s % 60;
    return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas} h ${String(resto).padStart(2, "0")} min`;
}

/** Iniciales para el círculo de una persona: "Cristofer Alvarado" da "CA". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
