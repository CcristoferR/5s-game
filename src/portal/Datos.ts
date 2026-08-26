/**
 * Datos del portal.
 *
 * ÚNICO archivo que sabe dónde viven los datos. Hoy guarda todo en el
 * navegador; el día que exista el servidor se reemplaza el cuerpo de estas
 * funciones por llamadas a la API y ni las pantallas ni el juego cambian.
 *
 * Por eso todas las funciones son asíncronas aunque hoy respondan al instante:
 * si fueran síncronas, al conectar el servidor habría que reescribir cada
 * pantalla para manejar la espera. Así ya están escritas para eso.
 *
 * Las validaciones (código vencido, sin cupos, dado de baja) viven acá y no en
 * las pantallas. Cuando el servidor exista tendrá que repetirlas —un cliente
 * nunca es de fiar—, pero mantenerlas juntas evita que una pantalla nueva se
 * olvide de alguna.
 */

const CLAVE_PERFILES = "5s-portal.perfiles.v1";
const CLAVE_CODIGOS = "5s-portal.codigos.v1";
const CLAVE_INSCRIPCIONES = "5s-portal.inscripciones.v1";

export const CURSO_ID = "curso-5s-operaciones";

export type RolUsuario = "trabajador" | "administrador";

export interface Perfil {
  id: string;
  nombreCompleto: string;
  /** RUT, legajo o número de ficha. Es con lo que la persona vuelve a entrar. */
  identificador: string;
  empresa: string;
  area: string;
  rol: RolUsuario;
  creadoEn: string;
}

export interface Codigo {
  codigo: string;
  cursoId: string;
  usosMaximos: number;
  usosActuales: number;
  /** Fecha ISO, o null si no vence. */
  venceEn: string | null;
  activo: boolean;
  nota: string;
  creadoEn: string;
}

export interface Inscripcion {
  id: string;
  perfilId: string;
  cursoId: string;
  codigoUsado: string;
  inscritoEn: string;
}

/** Motivos por los que un código puede rechazarse. */
export type MotivoRechazo = "inexistente" | "dado_de_baja" | "vencido" | "sin_cupos" | "otro_curso";

export interface ResultadoCanje {
  ok: boolean;
  motivo?: MotivoRechazo;
}

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = window.localStorage.getItem(clave);
    if (!crudo) return porDefecto;
    return JSON.parse(crudo) as T;
  } catch {
    // Dato corrupto o almacenamiento bloqueado: se arranca de cero en vez de
    // reventar el portal y dejar al trabajador sin poder entrar.
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Navegación privada o cuota llena. No se corta el flujo: la sesión sigue
    // viva en memoria hasta que se recargue la página.
  }
}

function idNuevo(prefijo: string): string {
  return `${prefijo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Semilla
// ---------------------------------------------------------------------------

/**
 * Datos de arranque.
 *
 * Los tres códigos cubren a propósito los tres casos que el portal tiene que
 * saber manejar —disponible, agotado y vencido—, para que las pantallas se
 * puedan probar de verdad y no solo con el camino feliz.
 */
function sembrarSiHaceFalta(): void {
  if (leer<Codigo[]>(CLAVE_CODIGOS, []).length > 0) return;

  const ahora = new Date();
  const haceUnMes = new Date(ahora.getTime() - 30 * 24 * 3600 * 1000).toISOString();

  escribir(CLAVE_CODIGOS, [
    {
      codigo: "5S-PLANTA-A7K2",
      cursoId: CURSO_ID,
      usosMaximos: 30,
      usosActuales: 4,
      venceEn: null,
      activo: true,
      nota: "Turno mañana — planta principal",
      creadoEn: ahora.toISOString(),
    },
    {
      codigo: "5S-BODEGA-M3X9",
      cursoId: CURSO_ID,
      usosMaximos: 5,
      usosActuales: 5,
      venceEn: null,
      activo: true,
      nota: "Bodega — lote agotado",
      creadoEn: ahora.toISOString(),
    },
    {
      codigo: "5S-PILOTO-Q1W8",
      cursoId: CURSO_ID,
      usosMaximos: 20,
      usosActuales: 3,
      venceEn: haceUnMes,
      activo: true,
      nota: "Plan piloto — vencido",
      creadoEn: haceUnMes,
    },
  ] satisfies Codigo[]);

  // Administrador inicial. Sin él no habría forma de entrar a la vista de
  // administración en una instalación nueva.
  escribir(CLAVE_PERFILES, [
    {
      id: idNuevo("perfil"),
      nombreCompleto: "Administrador del curso",
      identificador: "admin",
      empresa: "BITPLAY",
      area: "Capacitación",
      rol: "administrador",
      creadoEn: ahora.toISOString(),
    },
  ] satisfies Perfil[]);
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listarPerfiles(): Promise<Perfil[]> {
  sembrarSiHaceFalta();
  return leer<Perfil[]>(CLAVE_PERFILES, []);
}

export async function listarCodigos(): Promise<Codigo[]> {
  sembrarSiHaceFalta();
  return leer<Codigo[]>(CLAVE_CODIGOS, []);
}

export async function listarInscripciones(): Promise<Inscripcion[]> {
  return leer<Inscripcion[]>(CLAVE_INSCRIPCIONES, []);
}

/** Normaliza el identificador para que "12.345.678-9" y "123456789" sean el mismo. */
export function normalizarIdentificador(valor: string): string {
  return valor.trim().toLowerCase().replace(/[.\s-]/g, "");
}

export async function buscarPerfilPorIdentificador(identificador: string): Promise<Perfil | null> {
  const buscado = normalizarIdentificador(identificador);
  const perfiles = await listarPerfiles();
  return perfiles.find((p) => normalizarIdentificador(p.identificador) === buscado) ?? null;
}

export async function tieneInscripcion(perfilId: string): Promise<boolean> {
  const inscripciones = await listarInscripciones();
  return inscripciones.some((i) => i.perfilId === perfilId && i.cursoId === CURSO_ID);
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

/**
 * Revisa un código sin consumirlo.
 *
 * Está separado del canje para poder avisarle a la persona qué pasa con su
 * código —vencido, sin cupos— sin gastar un cupo en el intento.
 */
export async function revisarCodigo(codigoIngresado: string): Promise<ResultadoCanje> {
  const buscado = codigoIngresado.trim().toUpperCase();
  const codigos = await listarCodigos();
  const codigo = codigos.find((c) => c.codigo.toUpperCase() === buscado);

  if (!codigo) return { ok: false, motivo: "inexistente" };
  if (codigo.cursoId !== CURSO_ID) return { ok: false, motivo: "otro_curso" };
  if (!codigo.activo) return { ok: false, motivo: "dado_de_baja" };
  if (codigo.venceEn && new Date(codigo.venceEn).getTime() < Date.now()) {
    return { ok: false, motivo: "vencido" };
  }
  if (codigo.usosActuales >= codigo.usosMaximos) return { ok: false, motivo: "sin_cupos" };

  return { ok: true };
}

function consumirCupo(codigoIngresado: string): void {
  const buscado = codigoIngresado.trim().toUpperCase();
  const codigos = leer<Codigo[]>(CLAVE_CODIGOS, []);
  const actualizados = codigos.map((c) =>
    c.codigo.toUpperCase() === buscado ? { ...c, usosActuales: c.usosActuales + 1 } : c
  );
  escribir(CLAVE_CODIGOS, actualizados);
}

/** Genera un código legible: sin caracteres que se confundan al copiarlos. */
function generarTexto(prefijo: string): string {
  const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
  let sufijo = "";
  for (let i = 0; i < 4; i++) {
    sufijo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  const base = prefijo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "LOTE";
  return `5S-${base.slice(0, 8)}-${sufijo}`;
}

export async function crearCodigo(datos: {
  prefijo: string;
  usosMaximos: number;
  nota: string;
  diasVigencia: number | null;
}): Promise<Codigo> {
  const codigos = leer<Codigo[]>(CLAVE_CODIGOS, []);

  let texto = generarTexto(datos.prefijo);
  // Reintento por si el azar repite uno ya emitido.
  while (codigos.some((c) => c.codigo === texto)) {
    texto = generarTexto(datos.prefijo);
  }

  const nuevo: Codigo = {
    codigo: texto,
    cursoId: CURSO_ID,
    usosMaximos: Math.max(1, Math.floor(datos.usosMaximos)),
    usosActuales: 0,
    venceEn:
      datos.diasVigencia && datos.diasVigencia > 0
        ? new Date(Date.now() + datos.diasVigencia * 24 * 3600 * 1000).toISOString()
        : null,
    activo: true,
    nota: datos.nota.trim(),
    creadoEn: new Date().toISOString(),
  };

  escribir(CLAVE_CODIGOS, [nuevo, ...codigos]);
  return nuevo;
}

export async function cambiarEstadoCodigo(codigo: string, activo: boolean): Promise<void> {
  const codigos = leer<Codigo[]>(CLAVE_CODIGOS, []);
  escribir(
    CLAVE_CODIGOS,
    codigos.map((c) => (c.codigo === codigo ? { ...c, activo } : c))
  );
}

// ---------------------------------------------------------------------------
// Alta de personas
// ---------------------------------------------------------------------------

export interface DatosRegistro {
  nombreCompleto: string;
  identificador: string;
  empresa: string;
  area: string;
  codigo: string;
}

export type ResultadoRegistro =
  | { ok: true; perfil: Perfil; inscripcion: Inscripcion }
  | { ok: false; motivo: MotivoRechazo | "identificador_repetido" };

/**
 * Registra a una persona y la inscribe canjeando su código.
 *
 * El cupo se consume acá y solo si todo lo demás salió bien: si se consumiera
 * antes de validar, un intento fallido gastaría un lugar del lote y el
 * supervisor terminaría con códigos agotados sin gente inscrita.
 */
export async function registrarConCodigo(datos: DatosRegistro): Promise<ResultadoRegistro> {
  const revision = await revisarCodigo(datos.codigo);
  if (!revision.ok) return { ok: false, motivo: revision.motivo ?? "otro_curso" };

  const yaExiste = await buscarPerfilPorIdentificador(datos.identificador);
  if (yaExiste) return { ok: false, motivo: "identificador_repetido" };

  const perfil: Perfil = {
    id: idNuevo("perfil"),
    nombreCompleto: datos.nombreCompleto.trim(),
    identificador: datos.identificador.trim(),
    empresa: datos.empresa.trim(),
    area: datos.area.trim(),
    rol: "trabajador",
    creadoEn: new Date().toISOString(),
  };

  const inscripcion: Inscripcion = {
    id: idNuevo("insc"),
    perfilId: perfil.id,
    cursoId: CURSO_ID,
    codigoUsado: datos.codigo.trim().toUpperCase(),
    inscritoEn: new Date().toISOString(),
  };

  const perfiles = leer<Perfil[]>(CLAVE_PERFILES, []);
  escribir(CLAVE_PERFILES, [...perfiles, perfil]);

  const inscripciones = leer<Inscripcion[]>(CLAVE_INSCRIPCIONES, []);
  escribir(CLAVE_INSCRIPCIONES, [...inscripciones, inscripcion]);

  consumirCupo(datos.codigo);

  return { ok: true, perfil, inscripcion };
}

/** Inscribe a alguien que ya estaba registrado pero perdió su inscripción. */
export async function inscribirPerfilExistente(
  perfil: Perfil,
  codigo: string
): Promise<{ ok: boolean; motivo?: MotivoRechazo }> {
  const revision = await revisarCodigo(codigo);
  if (!revision.ok) return { ok: false, motivo: revision.motivo };

  const inscripcion: Inscripcion = {
    id: idNuevo("insc"),
    perfilId: perfil.id,
    cursoId: CURSO_ID,
    codigoUsado: codigo.trim().toUpperCase(),
    inscritoEn: new Date().toISOString(),
  };

  const inscripciones = leer<Inscripcion[]>(CLAVE_INSCRIPCIONES, []);
  escribir(CLAVE_INSCRIPCIONES, [...inscripciones, inscripcion]);
  consumirCupo(codigo);

  return { ok: true };
}

/** Texto para mostrarle a la persona según por qué se rechazó su código. */
export function explicarRechazo(motivo: MotivoRechazo | "identificador_repetido"): string {
  switch (motivo) {
    case "inexistente":
      return "Ese código no existe. Revisa que esté bien escrito o pídeselo de nuevo a tu supervisor.";
    case "dado_de_baja":
      return "Ese código fue dado de baja. Tu supervisor tiene que entregarte uno nuevo.";
    case "vencido":
      return "Ese código ya venció. Pídele a tu supervisor un código vigente.";
    case "sin_cupos":
      return "Ese código ya alcanzó su cupo máximo de personas. Necesitas uno nuevo.";
    case "otro_curso":
      return "Ese código corresponde a otro curso.";
    case "identificador_repetido":
      return "Ya hay alguien registrado con ese RUT o número de ficha. Usa la pestaña Ingresar.";
  }
}