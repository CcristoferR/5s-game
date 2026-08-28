import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase.
 *
 * Las credenciales vienen de variables de entorno y no van escritas en el
 * código: así el repositorio no las lleva dentro y se puede apuntar a un
 * proyecto distinto (pruebas, producción) sin tocar nada.
 *
 * La clave "anon" es pública a propósito — viaja al navegador y cualquiera
 * puede leerla. Lo que protege los datos NO es esa clave, sino las políticas
 * de acceso definidas en supabase/esquema.sql, que PostgreSQL aplica del lado
 * del servidor. Es la diferencia de fondo con la versión anterior: antes las
 * reglas vivían en el navegador y se podían saltar editando el almacenamiento.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!URL || !CLAVE) {
  // Un mensaje claro acá evita perder media hora: sin las variables, el
  // cliente falla más adelante con errores de red que no dicen nada.
  throw new Error(
    "Faltan las credenciales de Supabase.\n\n" +
      "Creá un archivo .env en la raíz del proyecto con:\n" +
      "  VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co\n" +
      "  VITE_SUPABASE_ANON_KEY=tu-clave-anon\n\n" +
      "Las dos están en supabase.com → tu proyecto → Settings → API.\n" +
      "Después reiniciá npm run dev: Vite solo lee el .env al arrancar."
  );
}

export const supabase = createClient(URL, CLAVE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * El identificador del trabajador es su RUT, pero Supabase Auth trabaja con
 * correos. Se arma uno interno a partir del RUT.
 *
 * En planta mucha gente no tiene correo corporativo, y pedirle uno para
 * capacitarse deja fuera justamente a quien más lo necesita. El correo
 * sintético resuelve eso sin cambiar nada de lo que el trabajador ve: él
 * escribe su RUT y su contraseña, igual que antes.
 *
 * Si el identificador YA es un correo (el caso del administrador), se usa
 * tal cual.
 */
export function correoDeIdentificador(identificador: string): string {
  const limpio = identificador.trim().toLowerCase();
  if (limpio.includes("@")) return limpio;
  // Solo letras, números y guion: un RUT con puntos rompe la dirección.
  const seguro = limpio.replace(/[^a-z0-9-]/g, "");
  return `${seguro}@trabajador.local`;
}