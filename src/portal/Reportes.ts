import ExcelJS from "exceljs";
import {
  listarPerfiles,
  listarInscripciones,
  listarProgreso,
  listarCursos,
  listarCodigos,
  listarCertificados,
  type Perfil,
  type Curso,
} from "./Datos";
import { rankingCompleto } from "./Ranking";
import { describirCurso } from "./CatalogoCursos";
import {
  armarMatriculas,
  coberturaPorArea,
  coincideEmpresa,
  empresasDe,
  estadoCodigo,
  matriculasEnAlcance,
  rankingEnAlcance,
  type Matricula,
} from "./admin/Indicadores";
import { duracion } from "./admin/Formato";

/**
 * Reportes descargables en Excel.
 *
 * RRHH necesita el dato fuera de la pantalla: para archivarlo, adjuntarlo a
 * una auditoría o cruzarlo con su propia planilla de personal. Antes esto se
 * exportaba en CSV, que Excel abre pero deja como una tabla cruda: sin
 * cabecera destacada, sin anchos, sin formato de fecha. Un reporte que llega a
 * una gerencia no puede verse así.
 *
 * Ahora se genera un .xlsx real, con cabecera de color, columnas
 * dimensionadas, filtros, panel congelado y formato numérico. El archivo se
 * abre listo para imprimir o adjuntar.
 */

// Paleta del documento: el verde del curso, con grises para el resto.
const VERDE = "FF1F5C3A";
const VERDE_SUAVE = "FFEDF4EF";
const GRIS_LINEA = "FFD8DCD9";
const TEXTO_TENUE = "FF6B7770";
const AMBAR = "FFB98A2E";
const ROJO = "FFB3453A";

const FORMATO_FECHA = "dd-mm-yyyy";

type Alineacion = "left" | "center" | "right";

interface Columna {
  titulo: string;
  ancho: number;
  alineacion?: Alineacion;
  /** Formato de Excel: "0", "0%", "dd-mm-yyyy". */
  formato?: string;
}

// ---------------------------------------------------------------------------
// Andamiaje común
// ---------------------------------------------------------------------------

function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = "ClassPlay";
  libro.created = new Date();
  return libro;
}

/**
 * Arma una hoja con encabezado, cabecera de tabla y filas.
 *
 * Todo el formato vive acá y no repartido por cada reporte: así los cuatro
 * archivos salen idénticos entre sí, que es lo que hace que se lean como parte
 * del mismo sistema y no como cuatro exportaciones sueltas.
 */
function armarHoja(
  libro: ExcelJS.Workbook,
  nombreHoja: string,
  titulo: string,
  subtitulo: string,
  columnas: Columna[],
  filas: unknown[][]
): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombreHoja, {
    // Congelar hasta la fila 5 deja la cabecera visible al desplazarse. Sin
    // esto, en una tabla de cien nombres uno pierde de vista qué es cada
    // columna a los diez renglones.
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  hoja.columns = columnas.map((c) => ({ width: c.ancho }));
  const ultima = columnas.length;

  // --- Encabezado del documento ---
  hoja.mergeCells(1, 1, 1, ultima);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = titulo;
  celdaTitulo.font = { name: "Calibri", size: 16, bold: true, color: { argb: VERDE } };
  celdaTitulo.alignment = { vertical: "middle" };
  hoja.getRow(1).height = 26;

  hoja.mergeCells(2, 1, 2, ultima);
  const celdaSub = hoja.getCell(2, 1);
  celdaSub.value = subtitulo;
  celdaSub.font = { name: "Calibri", size: 10, color: { argb: TEXTO_TENUE } };

  hoja.mergeCells(3, 1, 3, ultima);
  const celdaFecha = hoja.getCell(3, 1);
  celdaFecha.value = `Generado el ${new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}  ·  ${filas.length} ${filas.length === 1 ? "registro" : "registros"}`;
  celdaFecha.font = { name: "Calibri", size: 9, italic: true, color: { argb: TEXTO_TENUE } };

  hoja.getRow(4).height = 6; // respiro entre el encabezado y la tabla

  // --- Cabecera de la tabla ---
  const filaCabecera = hoja.getRow(5);
  columnas.forEach((col, i) => {
    const celda = filaCabecera.getCell(i + 1);
    celda.value = col.titulo;
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    celda.alignment = { vertical: "middle", horizontal: col.alineacion ?? "left" };
  });
  filaCabecera.height = 22;

  // --- Filas ---
  filas.forEach((datos, indice) => {
    const fila = hoja.getRow(6 + indice);

    datos.forEach((valor, i) => {
      const col = columnas[i];
      const celda = fila.getCell(i + 1);
      celda.value = valor as ExcelJS.CellValue;
      celda.font = { name: "Calibri", size: 11 };
      celda.alignment = { vertical: "middle", horizontal: col.alineacion ?? "left" };
      if (col.formato) celda.numFmt = col.formato;
      celda.border = { bottom: { style: "hair", color: { argb: GRIS_LINEA } } };

      // Filas alternas en verde muy claro. En una tabla ancha es lo que evita
      // que la vista se salte de renglón al leer de izquierda a derecha.
      if (indice % 2 === 1) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_SUAVE } };
      }
    });

    fila.height = 18;
  });

  // Filtros sobre la cabecera: quien recibe el archivo puede acotar por área o
  // por estado sin tener que pedir otro reporte.
  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + filas.length, column: ultima },
    };
  }

  return hoja;
}

async function descargarLibro(libro: ExcelJS.Workbook, nombreArchivo: string): Promise<void> {
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();

  // Liberar el objeto: sin esto el archivo queda en memoria hasta recargar.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selloFecha(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Devuelve un Date, o cadena vacía.
 *
 * Se entrega como fecha real y no como texto para que Excel la reconozca: así
 * se puede ordenar cronológicamente y filtrar por rango. Una fecha escrita
 * como texto se ordena alfabéticamente, y ahí el 10 de enero queda antes que
 * el 2 de febrero.
 */
function comoFecha(iso?: string | null): Date | string {
  return iso ? new Date(iso) : "";
}

// ---------------------------------------------------------------------------
// Alcance
// ---------------------------------------------------------------------------

/**
 * Qué parte de los datos va en el archivo: el curso y la empresa que estaban
 * elegidos en el panel al apretar "Descargar". Sin nada, va todo.
 */
export interface AlcanceReporte {
  cursoId?: string | null;
  /** Clave normalizada de la empresa (ver claveEmpresa en Indicadores). */
  empresa?: string | null;
}

async function datosBase(): Promise<{
  perfiles: Perfil[];
  cursos: Curso[];
  matriculas: Matricula[];
}> {
  const [perfiles, inscripciones, progresos, cursos, certificados] = await Promise.all([
    listarPerfiles(),
    listarInscripciones(),
    listarProgreso(),
    listarCursos(),
    listarCertificados(),
  ]);
  return {
    perfiles,
    cursos,
    matriculas: armarMatriculas({ perfiles, cursos, inscripciones, progresos, certificados }),
  };
}

/** "Operación 5S · Bitplay", para el subtítulo de la hoja. */
function describirAlcance(cursos: Curso[], perfiles: Perfil[], alcance: AlcanceReporte): string {
  const curso = alcance.cursoId ? cursos.find((c) => c.id === alcance.cursoId) : null;
  const empresa = alcance.empresa
    ? empresasDe(perfiles).find((e) => e.clave === alcance.empresa)?.nombre ?? "Empresa"
    : null;
  return [curso ? describirCurso(curso).corto : "Todos los cursos", empresa ?? "Todas las empresas"].join(" · ");
}

/** Sufijo del nombre de archivo: "operacion-5s-bitplay". */
function sufijo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/todos los cursos|todas las empresas/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nombreArchivo(base: string, alcance: string): string {
  const s = sufijo(alcance);
  return `${base}${s ? `-${s}` : ""}-${selloFecha()}.xlsx`;
}

const ROTULO_ESTADO: Record<Matricula["estado"], string> = {
  completado: "Completado",
  en_curso: "En curso",
  sin_empezar: "Sin empezar",
};

// ---------------------------------------------------------------------------
// Personas y avance
// ---------------------------------------------------------------------------

export async function exportarPersonas(alcance: AlcanceReporte = {}): Promise<number> {
  const { perfiles, cursos, matriculas } = await datosBase();
  const cursoId = alcance.cursoId ?? null;
  const empresa = alcance.empresa ?? null;

  const trabajadores = perfiles.filter((p) => p.rol === "trabajador" && coincideEmpresa(p, empresa));

  const filas = trabajadores.flatMap((persona) => {
    const suyas = matriculas.filter((m) => m.perfil.id === persona.id && (!cursoId || m.curso.id === cursoId));

    // Alguien registrado sin inscripción también aparece cuando se piden todos
    // los cursos: que exista una cuenta sin curso es información útil, no un
    // dato a esconder. Con un curso elegido, solo van sus inscritos.
    if (suyas.length === 0) return cursoId ? [] : [filaPersona(persona, null)];
    return suyas.map((m) => filaPersona(persona, m));
  });

  if (filas.length === 0) return 0;

  const columnas: Columna[] = [
    { titulo: "Nombre", ancho: 26 },
    { titulo: "RUT / ficha", ancho: 15 },
    { titulo: "Empresa", ancho: 18 },
    { titulo: "Área", ancho: 16 },
    { titulo: "Curso", ancho: 22 },
    { titulo: "Inscripción", ancho: 12, alineacion: "center" },
    { titulo: "Código usado", ancho: 17 },
    { titulo: "Fecha inscripción", ancho: 16, alineacion: "center", formato: FORMATO_FECHA },
    { titulo: "Fases", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Total", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Avance", ancho: 10, alineacion: "center", formato: "0%" },
    { titulo: "Puntaje", ancho: 10, alineacion: "right", formato: "#,##0" },
    { titulo: "Estado", ancho: 14, alineacion: "center" },
    { titulo: "Finalización", ancho: 14, alineacion: "center", formato: FORMATO_FECHA },
    { titulo: "Certificado", ancho: 16 },
  ];

  const descripcion = describirAlcance(cursos, perfiles, alcance);
  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Personas",
    "Avance de la capacitación",
    `${descripcion}. Detalle por persona e inscripción, incluidas las que aún no comienzan.`,
    columnas,
    filas
  );

  // El estado se colorea: en una tabla larga, "Sin empezar" en rojo salta a la
  // vista, y son exactamente las personas a las que hay que ir a buscar.
  const COL_ESTADO = 13;
  filas.forEach((_, i) => {
    const celda = hoja.getRow(6 + i).getCell(COL_ESTADO);
    const estado = textoDeCelda(celda.value);
    const color =
      estado === "Completado"
        ? VERDE
        : estado === "En curso"
          ? AMBAR
          : estado === "Sin empezar"
            ? ROJO
            : TEXTO_TENUE;
    celda.font = {
      name: "Calibri",
      size: 11,
      bold: estado !== "Sin inscribir",
      color: { argb: color },
    };
  });

  await descargarLibro(libro, nombreArchivo("personas", descripcion));
  return filas.length;
}

function filaPersona(persona: Perfil, m: Matricula | null): unknown[] {
  const total = m?.curso.totalFases ?? 0;
  // La fase 0 es el tutorial: enseña los controles, no es contenido del curso,
  // así que no cuenta para el avance. Contarla inflaría el porcentaje.
  const hechas = m ? Math.min(m.fasesHechas.length, total) : 0;

  return [
    persona.nombreCompleto,
    persona.identificador,
    persona.empresa,
    persona.area,
    m?.curso.nombre ?? "",
    m ? (m.inscripcion.activa ? "Activa" : "De baja") : "",
    m?.inscripcion.codigoUsado ?? "",
    comoFecha(m?.inscripcion.inscritoEn),
    hechas,
    total,
    // Se guarda como fracción porque la celda tiene formato de porcentaje:
    // Excel multiplica por cien al mostrarla. Poner 100 daría 10.000%.
    total > 0 ? (m?.estado === "completado" ? 1 : hechas / total) : 0,
    m?.puntaje ?? 0,
    m ? ROTULO_ESTADO[m.estado] : "Sin inscribir",
    comoFecha(m?.completadoEn),
    m?.certificado?.codigo ?? "",
  ];
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Ranking de un curso, o una hoja por curso si no se eligió ninguno.
 *
 * Antes salía de la tabla de progreso y solo del 5S. Ahora sale de la misma
 * función del servidor que ordena el ranking en pantalla (puntaje y, a igual
 * puntaje, menor tiempo), así que el archivo y el panel nunca discrepan.
 */
export async function exportarRanking(alcance: AlcanceReporte = {}): Promise<number> {
  const [cursosTodos, perfiles] = await Promise.all([listarCursos(), listarPerfiles()]);
  const cursos = cursosTodos.filter((c) => !alcance.cursoId || c.id === alcance.cursoId);
  const descripcion = describirAlcance(cursosTodos, perfiles, alcance);

  const columnas: Columna[] = [
    { titulo: "Posición", ancho: 10, alineacion: "center", formato: "0" },
    { titulo: "Nombre", ancho: 28 },
    { titulo: "Empresa", ancho: 18 },
    { titulo: "Área", ancho: 18 },
    { titulo: "Fases", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Total", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Puntaje", ancho: 11, alineacion: "right", formato: "#,##0" },
    { titulo: "Tiempo", ancho: 14, alineacion: "right" },
    { titulo: "Última actividad", ancho: 16, alineacion: "center", formato: FORMATO_FECHA },
  ];

  const libro = nuevoLibro();
  let total = 0;

  for (const curso of cursos) {
    const filas = rankingEnAlcance(await rankingCompleto(curso.id), alcance.empresa ?? null).map((f) => [
      f.posicion,
      f.nombreCompleto,
      f.empresa ?? "",
      f.area ?? "",
      f.fasesAprobadas,
      curso.totalFases,
      f.puntajeTotal,
      duracion(f.segundosTotal),
      comoFecha(f.ultimaActividad),
    ]);

    // Con todos los cursos, un curso sin nadie en el ranking no aporta una
    // hoja vacía: se omite.
    if (filas.length === 0 && cursos.length > 1) continue;

    const corto = describirCurso(curso).corto;
    const hoja = armarHoja(
      libro,
      nombreDeHoja(corto),
      `Ranking · ${curso.nombre}`,
      `${describirAlcance(cursosTodos, perfiles, { ...alcance, cursoId: curso.id })}. Puntaje total del mejor intento de cada fase; a igual puntaje, gana el menor tiempo.`,
      columnas,
      filas
    );

    // Los tres primeros en negrita y color: es un ranking, y el podio tiene que
    // distinguirse sin leer la columna de posición.
    filas.slice(0, 3).forEach((_, i) => {
      const fila = hoja.getRow(6 + i);
      for (let c = 1; c <= columnas.length; c++) {
        fila.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: VERDE } };
      }
    });

    total += filas.length;
  }

  if (total === 0) return 0;
  await descargarLibro(libro, nombreArchivo("ranking", descripcion));
  return total;
}

/** Excel no acepta : \ / ? * [ ] en el nombre de una hoja, ni más de 31 letras. */
function nombreDeHoja(texto: string): string {
  return texto.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Hoja";
}

// ---------------------------------------------------------------------------
// Códigos emitidos
// ---------------------------------------------------------------------------

export async function exportarCodigos(alcance: AlcanceReporte = {}): Promise<number> {
  const [todos, cursos, perfiles] = await Promise.all([listarCodigos(), listarCursos(), listarPerfiles()]);
  const codigos = todos.filter((c) => !alcance.cursoId || c.cursoId === alcance.cursoId);
  if (codigos.length === 0) return 0;

  const ROTULO: Record<ReturnType<typeof estadoCodigo>, string> = {
    disponible: "Disponible",
    sin_cupos: "Sin cupos",
    vencido: "Vencido",
    baja: "Dado de baja",
  };

  const filas = codigos.map((c) => [
    c.codigo,
    cursos.find((x) => x.id === c.cursoId)?.nombre ?? c.cursoId,
    c.usosActuales,
    c.usosMaximos,
    Math.max(0, c.usosMaximos - c.usosActuales),
    c.venceEn ? comoFecha(c.venceEn) : "Sin vencimiento",
    ROTULO[estadoCodigo(c)],
    c.nota,
    comoFecha(c.creadoEn),
  ]);

  const columnas: Columna[] = [
    { titulo: "Código", ancho: 20 },
    { titulo: "Curso", ancho: 22 },
    { titulo: "Usos", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Cupos", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Disponibles", ancho: 12, alineacion: "center", formato: "0" },
    { titulo: "Vigencia", ancho: 16, alineacion: "center", formato: FORMATO_FECHA },
    { titulo: "Estado", ancho: 14, alineacion: "center" },
    { titulo: "Nota interna", ancho: 30 },
    { titulo: "Emitido", ancho: 14, alineacion: "center", formato: FORMATO_FECHA },
  ];

  // Los códigos no son de una empresa: el alcance solo dice el curso.
  const descripcion = describirAlcance(cursos, perfiles, { cursoId: alcance.cursoId }).split(" · ")[0];
  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Códigos de acceso",
    "Códigos emitidos",
    `${descripcion}. Consumo de cupos y vigencia de cada código de inscripción.`,
    columnas,
    filas
  );

  // El código en monoespaciada: se dicta por teléfono o por radio, y con una
  // letra de ancho fijo es más difícil confundir caracteres parecidos.
  const COL_CODIGO = 1;
  const COL_ESTADO = 7;
  filas.forEach((_, i) => {
    const fila = hoja.getRow(6 + i);
    fila.getCell(COL_CODIGO).font = { name: "Consolas", size: 11, bold: true };

    const celdaEstado = fila.getCell(COL_ESTADO);
    const estado = textoDeCelda(celdaEstado.value);
    const color = estado === "Disponible" ? VERDE : estado === "Sin cupos" ? AMBAR : ROJO;
    celdaEstado.font = { name: "Calibri", size: 11, bold: true, color: { argb: color } };
  });

  await descargarLibro(libro, nombreArchivo("codigos", descripcion));
  return filas.length;
}

// ---------------------------------------------------------------------------
// Resumen por área
// ---------------------------------------------------------------------------

export interface ResumenArea {
  area: string;
  inscritos: number;
  completados: number;
  enCurso: number;
  sinEmpezar: number;
  cobertura: number;
}

/**
 * Cuántos completaron el curso en cada área.
 *
 * Es lo primero que mira una jefatura: no le interesa persona por persona, le
 * interesa si su área está al día. Y hace visible que un turno completo quedó
 * sin capacitar, algo que en una lista de cien nombres pasa desapercibido.
 *
 * Cuenta igual que los indicadores del panel: inscripciones activas de
 * trabajadores sin suspender. Con todos los cursos, una persona inscrita en
 * dos cuenta en los dos.
 */
export async function resumenPorArea(alcance: AlcanceReporte = {}): Promise<ResumenArea[]> {
  const { matriculas } = await datosBase();
  return resumenDeMatriculas(matriculas, alcance);
}

function resumenDeMatriculas(matriculas: Matricula[], alcance: AlcanceReporte): ResumenArea[] {
  const enAlcance = matriculasEnAlcance(matriculas, {
    cursoId: alcance.cursoId ?? null,
    empresa: alcance.empresa ?? null,
  });
  return coberturaPorArea(enAlcance, Infinity).map((g) => ({
    area: g.nombre,
    inscritos: g.total,
    completados: g.completado,
    enCurso: g.en_curso,
    sinEmpezar: g.sin_empezar,
    cobertura: g.total > 0 ? Math.round((g.completado / g.total) * 100) : 0,
  }));
}

export async function exportarResumenAreas(alcance: AlcanceReporte = {}): Promise<number> {
  const { perfiles, cursos, matriculas } = await datosBase();
  const resumen = resumenDeMatriculas(matriculas, alcance);
  if (resumen.length === 0) return 0;

  const filas = resumen.map((r) => [
    r.area,
    r.inscritos,
    r.completados,
    r.enCurso,
    r.sinEmpezar,
    r.cobertura / 100,
  ]);

  const columnas: Columna[] = [
    { titulo: "Área", ancho: 26 },
    { titulo: alcance.cursoId ? "Inscritos" : "Inscripciones", ancho: 13, alineacion: "center", formato: "0" },
    { titulo: "Completados", ancho: 13, alineacion: "center", formato: "0" },
    { titulo: "En curso", ancho: 11, alineacion: "center", formato: "0" },
    { titulo: "Sin empezar", ancho: 13, alineacion: "center", formato: "0" },
    { titulo: "Cobertura", ancho: 13, alineacion: "center", formato: "0%" },
  ];

  const descripcion = describirAlcance(cursos, perfiles, alcance);
  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Cobertura por área",
    "Cobertura de la capacitación",
    `${descripcion}. Porcentaje de personas que completaron el curso en cada área.`,
    columnas,
    filas
  );

  // La cobertura se colorea con el mismo criterio que la pantalla: bajo 50%
  // deja de ser un rezago normal y pasa a ser algo que alguien debe revisar.
  const COL_COBERTURA = 6;
  resumen.forEach((r, i) => {
    const celda = hoja.getRow(6 + i).getCell(COL_COBERTURA);
    const color = r.cobertura >= 80 ? VERDE : r.cobertura >= 50 ? AMBAR : ROJO;
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: color } };
  });

  // Fila de totales: la organización completa, que es el número que termina en
  // el informe a gerencia.
  const fila = hoja.getRow(6 + resumen.length);
  const totales = resumen.reduce(
    (acumulado, r) => ({
      inscritos: acumulado.inscritos + r.inscritos,
      completados: acumulado.completados + r.completados,
      enCurso: acumulado.enCurso + r.enCurso,
      sinEmpezar: acumulado.sinEmpezar + r.sinEmpezar,
    }),
    { inscritos: 0, completados: 0, enCurso: 0, sinEmpezar: 0 }
  );

  const valores = [
    "TOTAL",
    totales.inscritos,
    totales.completados,
    totales.enCurso,
    totales.sinEmpezar,
    totales.inscritos > 0 ? totales.completados / totales.inscritos : 0,
  ];

  valores.forEach((valor, c) => {
    const celda = fila.getCell(c + 1);
    celda.value = valor;
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: VERDE } };
    celda.alignment = { vertical: "middle", horizontal: columnas[c].alineacion ?? "left" };
    if (columnas[c].formato) celda.numFmt = columnas[c].formato;
    celda.border = { top: { style: "medium", color: { argb: VERDE } } };
  });
  fila.height = 20;

  await descargarLibro(libro, nombreArchivo("cobertura-areas", descripcion));
  return filas.length;
}

/**
 * Texto de una celda de la planilla.
 *
 * ExcelJS guarda en `value` cosas que no son texto: numeros, fechas, formulas
 * y texto con formato, y estas dos ultimas son objetos. Pasarlas por String()
 * escribe "[object Object]" en el reporte que se descarga el administrador —un
 * fallo que no rompe nada, no da error y solo se descubre abriendo el archivo.
 *
 * Aqui solo se leen celdas de estado, que siempre traen texto plano; el resto
 * de los casos existen por si alguien cambia la columna mas adelante.
 */
function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor instanceof Date) return valor.toISOString();

  // Formula: interesa el resultado, no la formula.
  if (typeof valor === "object" && "result" in valor) {
    return textoDeCelda((valor).result);
  }

  // Texto con formato: se concatenan sus tramos.
  if (typeof valor === "object" && "richText" in valor) {
    const tramos = (valor as { richText: { text: string }[] }).richText;
    return tramos.map((t) => t.text).join("");
  }

  return "";
}