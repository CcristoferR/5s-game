/**
 * Credenciales.
 *
 * Toda la verificación de identidad pasa por acá. El resto del portal nunca
 * ve una contraseña: pide `verificarCredenciales` y recibe sí o no.
 *
 * ─── ADVERTENCIA IMPORTANTE ───────────────────────────────────────────────
 *
 * Esto NO es seguridad real, y no puede serlo mientras el portal viva solo en
 * el navegador. Todo lo que se ejecuta en el equipo del usuario, el usuario lo
 * controla: puede abrir las herramientas del navegador, editar el
 * almacenamiento y darse el rol que quiera. Ninguna comprobación escrita acá
 * lo impide.
 *
 * Lo que sí hace este archivo es dejar la LÓGICA correcta, para que al mover
 * el portal a un servidor sea un reemplazo y no un rediseño:
 *
 *   - la contraseña nunca se guarda en claro;
 *   - el identificador (RUT) es nombre de usuario, no llave;
 *   - los intentos fallidos se cuentan y bloquean temporalmente;
 *   - el rol no se decide en el formulario de registro.
 *
 * Cuando exista el servidor, se reemplaza el cuerpo de estas funciones por
 * llamadas a la API y el hash pasa a hacerse allá con bcrypt o argon2, que es
 * lo que corresponde. Acá se usa SHA-256 con sal porque es lo que el navegador
 * ofrece nativamente; es suficiente para que una contraseña no quede legible
 * en el almacenamiento, y claramente insuficiente contra un atacante real.
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

const CLAVE_CREDENCIALES = "5s-portal.credenciales.v1";
const CLAVE_INTENTOS = "5s-portal.intentos.v1";

/** Mínimo de caracteres. Ver nota sobre por qué no se exige nada más. */
export const LARGO_MINIMO_CLAVE = 8;

/**
 * Bloqueo por intentos fallidos.
 *
 * Estos dos valores están flojos a propósito mientras se desarrolla: diez
 * minutos de espera por equivocarse tecleando frena la prueba del portal por
 * completo. Para producción, 5 intentos y 10 minutos es lo razonable.
 */
const MAX_INTENTOS = 10;
const BLOQUEO_MINUTOS = 1;

interface Credencial {
  perfilId: string;
  sal: string;
  hash: string;
  /** Fuerza a cambiarla en el próximo ingreso. Lo usa el restablecimiento. */
  debeCambiar: boolean;
  actualizadaEn: string;
}

interface RegistroIntentos {
  fallidos: number;
  bloqueadoHasta: string | null;
}

export type ResultadoVerificacion =
  | { ok: true; debeCambiar: boolean }
  | { ok: false; motivo: "credenciales" | "bloqueado" | "sin_clave"; minutosRestantes?: number };

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Si el almacenamiento está bloqueado, el portal sigue funcionando en
    // esta pestaña; simplemente no persiste.
  }
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * Sal única por credencial.
 *
 * Sin sal, dos personas con la misma contraseña producen el mismo hash, y ver
 * el almacenamiento bastaría para saber quiénes comparten clave.
 */
function nuevaSal(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function calcularHash(clave: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(sal + "::" + clave);
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparación en tiempo constante.
 *
 * Comparar con === corta en la primera diferencia, y el tiempo que tarda
 * filtra información sobre cuánto acertó el atacante. Acá el detalle es casi
 * anecdótico, pero es la forma correcta y no cuesta nada.
 */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

// ---------------------------------------------------------------------------
// Reglas de la contraseña
// ---------------------------------------------------------------------------

/**
 * Solo se exige largo.
 *
 * Obligar a mayúscula, número y símbolo produce contraseñas peores: la gente
 * termina usando "Planta2024!" o anotándola en un papel pegado al monitor. El
 * largo es lo único que aporta resistencia real, y es lo que recomiendan las
 * guías actuales.
 */
export function revisarClave(clave: string): { ok: boolean; motivo?: string } {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return { ok: false, motivo: `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` };
  }
  if (/^\s+$/.test(clave)) {
    return { ok: false, motivo: "La contraseña no puede ser solo espacios." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Intentos fallidos
// ---------------------------------------------------------------------------

function estadoIntentos(identificador: string): RegistroIntentos {
  const todos = leer<Record<string, RegistroIntentos>>(CLAVE_INTENTOS, {});
  return todos[identificador] ?? { fallidos: 0, bloqueadoHasta: null };
}

function guardarIntentos(identificador: string, registro: RegistroIntentos): void {
  const todos = leer<Record<string, RegistroIntentos>>(CLAVE_INTENTOS, {});
  todos[identificador] = registro;
  escribir(CLAVE_INTENTOS, todos);
}

function limpiarIntentos(identificador: string): void {
  const todos = leer<Record<string, RegistroIntentos>>(CLAVE_INTENTOS, {});
  delete todos[identificador];
  escribir(CLAVE_INTENTOS, todos);
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

/** Crea o reemplaza la contraseña de un perfil. */
export async function definirClave(perfilId: string, clave: string, debeCambiar = false): Promise<void> {
  const sal = nuevaSal();
  const hash = await calcularHash(clave, sal);

  const credenciales = leer<Credencial[]>(CLAVE_CREDENCIALES, []);
  const sinLaVieja = credenciales.filter((c) => c.perfilId !== perfilId);

  escribir(CLAVE_CREDENCIALES, [
    ...sinLaVieja,
    { perfilId, sal, hash, debeCambiar, actualizadaEn: new Date().toISOString() },
  ]);
}

export function tieneClave(perfilId: string): boolean {
  return leer<Credencial[]>(CLAVE_CREDENCIALES, []).some((c) => c.perfilId === perfilId);
}

/**
 * Verifica una contraseña.
 *
 * El motivo de rechazo nunca distingue entre "ese usuario no existe" y "la
 * contraseña está mal". Decirlo confirmaría qué identificadores son válidos,
 * que es justo lo que un atacante quiere averiguar primero.
 */
export async function verificarCredenciales(
  identificador: string,
  perfilId: string | null,
  clave: string
): Promise<ResultadoVerificacion> {
  const intentos = estadoIntentos(identificador);

  if (intentos.bloqueadoHasta) {
    const restante = new Date(intentos.bloqueadoHasta).getTime() - Date.now();
    if (restante > 0) {
      return { ok: false, motivo: "bloqueado", minutosRestantes: Math.ceil(restante / 60000) };
    }
    limpiarIntentos(identificador);
  }

  const credencial = perfilId
    ? leer<Credencial[]>(CLAVE_CREDENCIALES, []).find((c) => c.perfilId === perfilId)
    : undefined;

  // Se calcula el hash aunque no exista la credencial: si se devolviera antes,
  // la respuesta llegaría más rápido para un usuario inexistente y eso sola
  // ya delata cuáles existen.
  const salUsada = credencial?.sal ?? "sal-inexistente";
  const hashCalculado = await calcularHash(clave, salUsada);

  if (credencial && igualesEnTiempoConstante(hashCalculado, credencial.hash)) {
    limpiarIntentos(identificador);
    return { ok: true, debeCambiar: credencial.debeCambiar };
  }

  const fallidos = intentos.fallidos + 1;
  const bloquear = fallidos >= MAX_INTENTOS;
  guardarIntentos(identificador, {
    fallidos: bloquear ? 0 : fallidos,
    bloqueadoHasta: bloquear ? new Date(Date.now() + BLOQUEO_MINUTOS * 60000).toISOString() : null,
  });

  if (bloquear) {
    return { ok: false, motivo: "bloqueado", minutosRestantes: BLOQUEO_MINUTOS };
  }
  return { ok: false, motivo: "credenciales" };
}

/**
 * Restablece la contraseña de alguien y obliga a cambiarla al entrar.
 *
 * En planta no todos tienen correo, así que no hay enlaces de recuperación:
 * el trabajador le pide al administrador que se la restablezca, y este le
 * entrega una clave temporal. Por eso queda marcada para cambio obligatorio.
 */
export async function restablecerClave(perfilId: string, claveTemporal: string): Promise<void> {
  await definirClave(perfilId, claveTemporal, true);
}

/**
 * Levanta el bloqueo de alguien.
 *
 * Sin esto, un trabajador que se equivoca al teclear queda fuera y no hay
 * forma de ayudarlo salvo esperar. El administrador debe poder destrabarlo.
 */
export function desbloquearIngreso(identificador: string): void {
  limpiarIntentos(identificador);
}

/** Borra la credencial de un perfil eliminado. */
export function borrarCredencial(perfilId: string): void {
  const credenciales = leer<Credencial[]>(CLAVE_CREDENCIALES, []);
  escribir(CLAVE_CREDENCIALES, credenciales.filter((c) => c.perfilId !== perfilId));
}

/** Genera una clave temporal legible, para dictarla por teléfono o radio. */
export function generarClaveTemporal(): string {
  // Sin caracteres ambiguos: nada de O/0, I/l/1. Alguien la va a leer en voz
  // alta en una planta ruidosa.
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);

  let salida = "";
  for (let i = 0; i < 5; i++) salida += letras[bytes[i] % letras.length];
  salida += "-";
  for (let i = 5; i < 9; i++) salida += numeros[bytes[i] % numeros.length];
  return salida;
}