import { supabase, correoDeIdentificador } from "./supabase";

/**
 * Capa de datos de la plataforma.
 *
 * Todo lo que se lee o escribe pasa por acá. Las pantallas y el juego llaman a
 * estas funciones y no saben de dónde salen los datos — antes era el
 * almacenamiento del navegador, ahora es Supabase, y ninguna pantalla cambió
 * de estructura.
 *
 * QUÉ CAMBIA RESPECTO DE LA VERSIÓN ANTERIOR
 *
 * Antes cada equipo tenía su propia realidad: quien se registraba en un
 * computador no existía en otro, el administrador no veía a nadie y el
 * progreso pertenecía al navegador, no a la persona. Ahora hay una sola base
 * compartida.
 *
 * Y la seguridad dejó de ser decorativa. Las reglas de quién ve qué las aplica
 * PostgreSQL del lado del servidor (ver supabase/esquema.sql). Editar algo en
 * el navegador ya no sirve de nada: la petición llega al servidor y el
 * servidor decide.
 *
 * CONVENCIÓN DE NOMBRES
 *
 * La base usa guion bajo (nombre_completo) porque es lo normal en PostgreSQL;
 * el código usa camelCase. La traducción ocurre en las funciones `desde*` de
 * cada sección, y en ningún otro lugar.
 */

export const CURSO_ID = "curso-5s-operaciones";

/** Mínimo que exige Supabase Auth. */
export const LARGO_MINIMO_CLAVE = 6;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type RolUsuario = "trabajador" | "administrador";

export interface Perfil {
  id: string;
  nombreCompleto: string;
  identificador: string;
  empresa: string;
  area: string;
  rol: RolUsuario;
  creadoEn: string;
}

export interface Curso {
  id: string;
  nombre: string;
  descripcion: string;
  totalFases: number;
  duracionMinutos: number;
  activo: boolean;
  creadoEn: string;
}

export interface Codigo {
  codigo: string;
  cursoId: string;
  usosMaximos: number;
  usosActuales: number;
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
  activa: boolean;
  inscritoEn: string;
  bajaEn?: string;
}

export interface Progreso {
  perfilId: string;
  cursoId: string;
  fasesCompletadas: number[];
  puntaje: number;
  actualizadoEn: string;
  completadoEn?: string;
}

export type MotivoRechazo = "inexistente" | "dado_de_baja" | "vencido" | "sin_cupos" | "otro";

export interface DatosRegistro {
  nombreCompleto: string;
  identificador: string;
  empresa: string;
  area: string;
  clave: string;
}

export type ResultadoRegistro =
  | { ok: true; perfil: Perfil }
  | { ok: false; motivo: MotivoRechazo | "identificador_repetido" | "clave_corta" };

export type ResultadoIngreso =
  | { ok: true; perfil: Perfil }
  | { ok: false; motivo: "credenciales" | "sin_perfil" | "otro" };

export type EstadoCurso = "sin_inscribir" | "sin_empezar" | "en_curso" | "completado";

export interface TarjetaCurso {
  curso: Curso;
  estado: EstadoCurso;
  fasesHechas: number;
  puntaje: number;
  porcentaje: number;
}

// ---------------------------------------------------------------------------
// Traducción entre la base y el código
// ---------------------------------------------------------------------------

type FilaPerfil = {
  id: string;
  nombre_completo: string;
  identificador: string;
  empresa: string;
  area: string;
  rol: RolUsuario;
  creado_en: string;
};

function desdePerfil(f: FilaPerfil): Perfil {
  return {
    id: f.id,
    nombreCompleto: f.nombre_completo,
    identificador: f.identificador,
    empresa: f.empresa ?? "",
    area: f.area ?? "",
    rol: f.rol,
    creadoEn: f.creado_en,
  };
}

type FilaCurso = {
  id: string;
  nombre: string;
  descripcion: string;
  total_fases: number;
  duracion_minutos: number;
  activo: boolean;
  creado_en: string;
};

function desdeCurso(f: FilaCurso): Curso {
  return {
    id: f.id,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
    totalFases: f.total_fases,
    duracionMinutos: f.duracion_minutos,
    activo: f.activo,
    creadoEn: f.creado_en,
  };
}

type FilaCodigo = {
  codigo: string;
  curso_id: string;
  usos_maximos: number;
  usos_actuales: number;
  vence_en: string | null;
  activo: boolean;
  nota: string;
  creado_en: string;
};

function desdeCodigo(f: FilaCodigo): Codigo {
  return {
    codigo: f.codigo,
    cursoId: f.curso_id,
    usosMaximos: f.usos_maximos,
    usosActuales: f.usos_actuales,
    venceEn: f.vence_en,
    activo: f.activo,
    nota: f.nota ?? "",
    creadoEn: f.creado_en,
  };
}

type FilaInscripcion = {
  id: string;
  perfil_id: string;
  curso_id: string;
  codigo_usado: string;
  activa: boolean;
  inscrito_en: string;
  baja_en: string | null;
};

function desdeInscripcion(f: FilaInscripcion): Inscripcion {
  return {
    id: f.id,
    perfilId: f.perfil_id,
    cursoId: f.curso_id,
    codigoUsado: f.codigo_usado ?? "",
    activa: f.activa,
    inscritoEn: f.inscrito_en,
    bajaEn: f.baja_en ?? undefined,
  };
}

type FilaProgreso = {
  perfil_id: string;
  curso_id: string;
  fases_completadas: number[];
  puntaje: number;
  actualizado_en: string;
  completado_en: string | null;
};

function desdeProgreso(f: FilaProgreso): Progreso {
  return {
    perfilId: f.perfil_id,
    cursoId: f.curso_id,
    fasesCompletadas: f.fases_completadas ?? [],
    puntaje: f.puntaje ?? 0,
    actualizadoEn: f.actualizado_en,
    completadoEn: f.completado_en ?? undefined,
  };
}

/**
 * Una consulta que falla no debe tumbar la pantalla.
 *
 * Los errores más comunes acá son de red o de permisos, y en los dos casos lo
 * correcto es mostrar la pantalla vacía y dejar constancia en la consola, no
 * dejar al usuario mirando un espacio en blanco sin explicación.
 */
function avisarError(donde: string, error: unknown): void {
  console.error(`[datos] ${donde}:`, error);
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

export function normalizarIdentificador(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Crea la cuenta y su perfil.
 *
 * Supabase Auth guarda la contraseña (cifrada, del lado del servidor) y esta
 * capa guarda los datos visibles. El rol NO se envía como dato de confianza:
 * la política de la base solo acepta insertar perfiles con rol 'trabajador',
 * así que ni manipulando la petición se puede nacer administrador.
 */
export async function registrarCuenta(datos: DatosRegistro): Promise<ResultadoRegistro> {
  const identificador = normalizarIdentificador(datos.identificador);

  if (datos.clave.length < LARGO_MINIMO_CLAVE) {
    return { ok: false, motivo: "clave_corta" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: correoDeIdentificador(identificador),
    password: datos.clave,
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { ok: false, motivo: "identificador_repetido" };
    }
    avisarError("registrarCuenta/auth", error);
    return { ok: false, motivo: "otro" };
  }

  const usuario = data.user;
  if (!usuario) {
    avisarError("registrarCuenta", "signUp no devolvió usuario");
    return { ok: false, motivo: "otro" };
  }

  const { data: fila, error: errorPerfil } = await supabase
    .from("perfiles")
    .insert({
      id: usuario.id,
      nombre_completo: datos.nombreCompleto.trim(),
      identificador,
      empresa: datos.empresa.trim(),
      area: datos.area.trim(),
      rol: "trabajador",
    })
    .select()
    .single();

  if (errorPerfil || !fila) {
    if (errorPerfil && /duplicate|unique/i.test(errorPerfil.message)) {
      return { ok: false, motivo: "identificador_repetido" };
    }
    avisarError("registrarCuenta/perfil", errorPerfil);
    return { ok: false, motivo: "otro" };
  }

  return { ok: true, perfil: desdePerfil(fila as FilaPerfil) };
}

/**
 * Verifica identidad y devuelve el perfil.
 *
 * El motivo de rechazo no distingue entre "ese RUT no existe" y "la contraseña
 * está mal": decirlo confirmaría qué identificadores están registrados. El
 * bloqueo por intentos repetidos lo aplica Supabase del lado del servidor, así
 * que ya no depende de nada que el navegador pueda borrar.
 */
export async function ingresar(identificador: string, clave: string): Promise<ResultadoIngreso> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correoDeIdentificador(normalizarIdentificador(identificador)),
    password: clave,
  });

  if (error || !data.user) {
    return { ok: false, motivo: "credenciales" };
  }

  const perfil = await perfilDe(data.user.id);
  if (!perfil) {
    // La cuenta existe pero le falta el perfil. Pasa si el registro se cortó a
    // la mitad; se cierra la sesión para no dejar a alguien a medio entrar.
    await supabase.auth.signOut();
    return { ok: false, motivo: "sin_perfil" };
  }

  return { ok: true, perfil };
}

export async function perfilDe(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("perfiles").select("*").eq("id", id).maybeSingle();
  if (error) {
    avisarError("perfilDe", error);
    return null;
  }
  return data ? desdePerfil(data as FilaPerfil) : null;
}

export async function buscarPerfilPorIdentificador(identificador: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("identificador", normalizarIdentificador(identificador))
    .maybeSingle();
  if (error) {
    avisarError("buscarPerfilPorIdentificador", error);
    return null;
  }
  return data ? desdePerfil(data as FilaPerfil) : null;
}

/** Solo devuelve algo para un administrador: la política filtra el resto. */
export async function listarPerfiles(): Promise<Perfil[]> {
  const { data, error } = await supabase.from("perfiles").select("*").order("creado_en");
  if (error) {
    avisarError("listarPerfiles", error);
    return [];
  }
  return (data as FilaPerfil[]).map(desdePerfil);
}

export async function eliminarPersona(perfilId: string): Promise<void> {
  // Borrar el perfil arrastra inscripciones y progreso por las claves foráneas
  // en cascada. La cuenta de autenticación queda: eliminarla exige permisos de
  // servidor que el navegador no tiene, y por seguridad así debe ser.
  const { error } = await supabase.from("perfiles").delete().eq("id", perfilId);
  if (error) avisarError("eliminarPersona", error);
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

export async function listarCursos(): Promise<Curso[]> {
  const { data, error } = await supabase.from("cursos").select("*").order("creado_en");
  if (error) {
    avisarError("listarCursos", error);
    return [];
  }
  return (data as FilaCurso[]).map(desdeCurso);
}

export async function listarCursosActivos(): Promise<Curso[]> {
  return (await listarCursos()).filter((c) => c.activo);
}

export async function buscarCurso(cursoId: string): Promise<Curso | null> {
  const { data, error } = await supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle();
  if (error) {
    avisarError("buscarCurso", error);
    return null;
  }
  return data ? desdeCurso(data as FilaCurso) : null;
}

export async function crearCurso(datos: {
  nombre: string;
  descripcion: string;
  totalFases: number;
  duracionMinutos: number;
}): Promise<Curso | null> {
  const base = datos.nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("cursos")
    .insert({
      id: `curso-${base || Date.now()}`,
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion.trim(),
      total_fases: Math.max(1, Math.round(datos.totalFases)),
      duracion_minutos: Math.max(1, Math.round(datos.duracionMinutos)),
    })
    .select()
    .single();

  if (error || !data) {
    avisarError("crearCurso", error);
    return null;
  }
  return desdeCurso(data as FilaCurso);
}

export async function cambiarEstadoCurso(cursoId: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("cursos").update({ activo }).eq("id", cursoId);
  if (error) avisarError("cambiarEstadoCurso", error);
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

export async function listarCodigos(): Promise<Codigo[]> {
  const { data, error } = await supabase
    .from("codigos")
    .select("*")
    .order("creado_en", { ascending: false });
  if (error) {
    avisarError("listarCodigos", error);
    return [];
  }
  return (data as FilaCodigo[]).map(desdeCodigo);
}

export async function crearCodigo(datos: {
  cursoId?: string;
  /** Etiqueta que se incrusta en el código para reconocerlo de un vistazo. */
  lote?: string;
  usosMaximos: number;
  venceEn?: string | null;
  nota: string;
}): Promise<Codigo | null> {
  const { data, error } = await supabase
    .from("codigos")
    .insert({
      codigo: generarCodigo(datos.lote),
      curso_id: datos.cursoId ?? CURSO_ID,
      usos_maximos: Math.max(1, Math.round(datos.usosMaximos)),
      vence_en: datos.venceEn || null,
      nota: datos.nota.trim(),
    })
    .select()
    .single();

  if (error || !data) {
    avisarError("crearCodigo", error);
    return null;
  }
  return desdeCodigo(data as FilaCodigo);
}

export async function cambiarEstadoCodigo(codigo: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("codigos").update({ activo }).eq("codigo", codigo);
  if (error) avisarError("cambiarEstadoCodigo", error);
}

/**
 * Genera un código legible.
 *
 * Formato: PREFIJO-LOTE-9999. El lote lo elige el administrador y sirve para
 * reconocer de un vistazo a qué grupo pertenece un código sin abrir la tabla
 * — "PLANTA" o "TURNO-A" dicen más que cuatro letras al azar. Si no se indica,
 * se usan letras aleatorias.
 *
 * Sin caracteres que se confundan al dictarlo: nada de O/0 ni I/l/1, porque
 * alguien va a leerlo en voz alta en una planta ruidosa.
 */
function generarCodigo(lote?: string): string {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const etiqueta = (lote ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 10);

  let bloque = etiqueta;
  if (!bloque) {
    for (let i = 0; i < 4; i++) bloque += letras[bytes[i] % letras.length];
  }

  let cifras = "";
  for (let i = 4; i < 8; i++) cifras += numeros[bytes[i] % numeros.length];
  return `5S-${bloque}-${cifras}`;
}

// ---------------------------------------------------------------------------
// Inscripciones
// ---------------------------------------------------------------------------

export async function listarInscripciones(): Promise<Inscripcion[]> {
  const { data, error } = await supabase.from("inscripciones").select("*").order("inscrito_en");
  if (error) {
    avisarError("listarInscripciones", error);
    return [];
  }
  return (data as FilaInscripcion[]).map(desdeInscripcion);
}

export async function tieneInscripcion(perfilId: string, cursoId = CURSO_ID): Promise<boolean> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("perfil_id", perfilId)
    .eq("curso_id", cursoId)
    .eq("activa", true)
    .maybeSingle();
  if (error) {
    avisarError("tieneInscripcion", error);
    return false;
  }
  return Boolean(data);
}

/**
 * Canjea un código.
 *
 * La validación entera ocurre en el servidor, en una sola operación (ver la
 * función canjear_codigo en supabase/esquema.sql). Se hace así por tres
 * motivos: el trabajador no necesita permiso para leer la tabla de códigos,
 * validar y consumir el cupo pasa de forma atómica —dos personas que canjean
 * el último cupo a la vez no entran las dos—, y las reglas viven en un solo
 * lugar.
 */
export async function canjearCodigo(
  codigo: string
): Promise<{ ok: boolean; motivo?: MotivoRechazo; cursoId?: string }> {
  const { data, error } = await supabase.rpc("canjear_codigo", { codigo_ingresado: codigo });

  if (error) {
    avisarError("canjearCodigo", error);
    return { ok: false, motivo: "otro" };
  }

  const r = data as { ok: boolean; motivo?: MotivoRechazo; curso_id?: string };
  return r.ok ? { ok: true, cursoId: r.curso_id } : { ok: false, motivo: r.motivo ?? "otro" };
}

export async function darDeBajaInscripcion(inscripcionId: string): Promise<void> {
  const { error } = await supabase
    .from("inscripciones")
    .update({ activa: false, baja_en: new Date().toISOString() })
    .eq("id", inscripcionId);
  if (error) avisarError("darDeBajaInscripcion", error);
}

export async function reactivarInscripcion(inscripcionId: string): Promise<void> {
  const { error } = await supabase
    .from("inscripciones")
    .update({ activa: true, baja_en: null })
    .eq("id", inscripcionId);
  if (error) avisarError("reactivarInscripcion", error);
}

/** Inscribe a alguien sin código. Es la vía del administrador. */
export async function inscribirDirecto(perfilId: string, cursoId = CURSO_ID): Promise<boolean> {
  const { error } = await supabase.from("inscripciones").upsert(
    { perfil_id: perfilId, curso_id: cursoId, codigo_usado: "", activa: true, baja_en: null },
    { onConflict: "perfil_id,curso_id" }
  );
  if (error) {
    avisarError("inscribirDirecto", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

export async function listarProgreso(): Promise<Progreso[]> {
  const { data, error } = await supabase.from("progreso").select("*");
  if (error) {
    avisarError("listarProgreso", error);
    return [];
  }
  return (data as FilaProgreso[]).map(desdeProgreso);
}

export async function progresoDe(perfilId: string, cursoId: string): Promise<Progreso | null> {
  const { data, error } = await supabase
    .from("progreso")
    .select("*")
    .eq("perfil_id", perfilId)
    .eq("curso_id", cursoId)
    .maybeSingle();
  if (error) {
    avisarError("progresoDe", error);
    return null;
  }
  return data ? desdeProgreso(data as FilaProgreso) : null;
}

/**
 * Registra que alguien aprobó una fase.
 *
 * Reentrante: rejugar una fase ya aprobada no la duplica ni baja el puntaje.
 * Se conserva el mejor puntaje alcanzado, no el último — de otro modo un
 * intento flojo borraría un buen resultado anterior.
 */
export async function registrarFaseCompletada(
  perfilId: string,
  cursoId: string,
  fase: number,
  puntaje: number
): Promise<void> {
  const previo = await progresoDe(perfilId, cursoId);
  const curso = await buscarCurso(cursoId);
  const total = curso?.totalFases ?? 5;

  const fases = new Set(previo?.fasesCompletadas ?? []);
  fases.add(fase);
  const lista = [...fases].sort((a, b) => a - b);

  // El tutorial es la fase 0: enseña los controles, no es contenido del curso,
  // así que no cuenta para completarlo.
  const reales = lista.filter((f) => f >= 1);

  const { error } = await supabase.from("progreso").upsert(
    {
      perfil_id: perfilId,
      curso_id: cursoId,
      fases_completadas: lista,
      puntaje: Math.max(previo?.puntaje ?? 0, puntaje),
      actualizado_en: new Date().toISOString(),
      completado_en:
        previo?.completadoEn ?? (reales.length >= total ? new Date().toISOString() : null),
    },
    { onConflict: "perfil_id,curso_id" }
  );

  if (error) avisarError("registrarFaseCompletada", error);
}

export async function reiniciarProgreso(perfilId: string, cursoId: string): Promise<void> {
  const { error } = await supabase
    .from("progreso")
    .delete()
    .eq("perfil_id", perfilId)
    .eq("curso_id", cursoId);
  if (error) avisarError("reiniciarProgreso", error);
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/**
 * Los cursos publicados con el estado de UNA persona frente a cada uno.
 *
 * Es lo que necesita la tarjeta del catálogo para decidir qué mostrar y qué
 * dice su botón. Se calcula acá y no en la pantalla: si cambia la regla de
 * cuándo un curso está completo, cambia en un solo lugar.
 */
export async function catalogoDe(perfilId: string): Promise<TarjetaCurso[]> {
  const [cursos, inscripciones, progresos] = await Promise.all([
    listarCursosActivos(),
    listarInscripciones(),
    listarProgreso(),
  ]);

  return cursos.map((curso) => {
    const inscrito = inscripciones.some(
      (i) => i.perfilId === perfilId && i.cursoId === curso.id && i.activa
    );
    const progreso = progresos.find((p) => p.perfilId === perfilId && p.cursoId === curso.id);

    const fasesHechas = (progreso?.fasesCompletadas ?? []).filter((f) => f >= 1).length;
    const porcentaje = Math.round((fasesHechas / curso.totalFases) * 100);

    let estado: EstadoCurso;
    if (!inscrito) estado = "sin_inscribir";
    else if (progreso?.completadoEn || fasesHechas >= curso.totalFases) estado = "completado";
    else if (fasesHechas > 0) estado = "en_curso";
    else estado = "sin_empezar";

    return { curso, estado, fasesHechas, puntaje: progreso?.puntaje ?? 0, porcentaje };
  });
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

/**
 * Traduce un rechazo a algo que el trabajador entienda y pueda accionar.
 *
 * "El cupo ya se completó, pide uno nuevo a tu supervisor" le dice qué hacer;
 * el nombre técnico del error no le dice nada.
 */
export function explicarRechazo(
  motivo: MotivoRechazo | "identificador_repetido" | "clave_corta" | "credenciales" | "sin_perfil"
): string {
  switch (motivo) {
    case "inexistente":
      return "Ese código no existe. Revisa que esté bien escrito.";
    case "dado_de_baja":
      return "Ese código fue anulado. Pide uno nuevo a tu supervisor.";
    case "vencido":
      return "Ese código venció. Pide uno nuevo a tu supervisor.";
    case "sin_cupos":
      return "El cupo de ese código ya se completó. Pide uno nuevo a tu supervisor.";
    case "identificador_repetido":
      return "Ese RUT ya está registrado. Usa la pestaña Ingresar.";
    case "clave_corta":
      return `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
    case "credenciales":
      return "El RUT o la contraseña no coinciden.";
    case "sin_perfil":
      return "Tu cuenta está incompleta. Pide a tu supervisor que la revise.";
    default:
      return "No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.";
  }
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface EntradaRanking {
  nombre: string;
  area: string;
  puntaje: number;
  completadoEn: string | null;
}

/**
 * Ranking real del curso, comparando personas de toda la organización.
 *
 * Hasta ahora el ranking salía del navegador de cada equipo, así que cada
 * computador tenía su propia tabla y no comparaba a nadie con nadie. Esto lee
 * el progreso guardado en el servidor y lo cruza con los perfiles.
 *
 * PENDIENTE: la pantalla del ranking (src/ui/RankingScreen.ts) todavía se
 * alimenta de RankingStorage, que sigue leyendo del navegador. Conectarla acá
 * es el siguiente paso; la consulta ya está resuelta.
 */
export async function rankingDe(cursoId = CURSO_ID, tope = 20): Promise<EntradaRanking[]> {
  const { data, error } = await supabase
    .from("progreso")
    .select("puntaje, completado_en, perfiles(nombre_completo, area)")
    .eq("curso_id", cursoId)
    .order("puntaje", { ascending: false })
    .limit(tope);

  if (error) {
    avisarError("rankingDe", error);
    return [];
  }

  type FilaRanking = {
    puntaje: number;
    completado_en: string | null;
    perfiles: { nombre_completo: string; area: string } | null;
  };

  return (data as unknown as FilaRanking[])
    .filter((f) => f.perfiles)
    .map((f) => ({
      nombre: f.perfiles!.nombre_completo,
      area: f.perfiles!.area ?? "",
      puntaje: f.puntaje,
      completadoEn: f.completado_en,
    }));
}