import ExcelJS from "exceljs";
import {
  listarPerfiles,
  listarInscripciones,
  listarProgreso,
  listarCursos,
  listarCodigos,
  rankingDe,
  type Perfil,
  type Inscripcion,
  type Progreso,
  type Curso,
} from "./Datos";

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
  libro.creator = "Plataforma de capacitación";
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
// Personas y avance
// ---------------------------------------------------------------------------

export async function exportarPersonas(): Promise<number> {
  const [perfiles, inscripciones, progresos, cursos] = await Promise.all([
    listarPerfiles(),
    listarInscripciones(),
    listarProgreso(),
    listarCursos(),
  ]);

  const trabajadores = perfiles.filter((p) => p.rol === "trabajador");

  const filas = trabajadores.flatMap((persona) => {
    const suyas = inscripciones.filter((i) => i.perfilId === persona.id);

    // Alguien registrado sin inscripción también aparece: que exista una
    // cuenta sin curso asignado es información útil, no un dato a esconder.
    if (suyas.length === 0) return [filaPersona(persona, null, null, null)];

    return suyas.map((inscripcion) => {
      const curso = cursos.find((c) => c.id === inscripcion.cursoId) ?? null;
      const avance =
        progresos.find((p) => p.perfilId === persona.id && p.cursoId === inscripcion.cursoId) ??
        null;
      return filaPersona(persona, inscripcion, curso, avance);
    });
  });

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
  ];

  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Personas",
    "Avance de la capacitación",
    "Detalle por persona e inscripción. Incluye a quienes aún no han comenzado.",
    columnas,
    filas
  );

  // El estado se colorea: en una tabla larga, "Sin empezar" en rojo salta a la
  // vista, y son exactamente las personas a las que hay que ir a buscar.
  const COL_ESTADO = 13;
  filas.forEach((_, i) => {
    const celda = hoja.getRow(6 + i).getCell(COL_ESTADO);
    const estado = String(celda.value ?? "");
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

  await descargarLibro(libro, `personas-${selloFecha()}.xlsx`);
  return filas.length;
}

function filaPersona(
  persona: Perfil,
  inscripcion: Inscripcion | null,
  curso: Curso | null,
  avance: Progreso | null
): unknown[] {
  const total = curso?.totalFases ?? 0;

  // La fase 0 es el tutorial: enseña los controles, no es contenido del curso,
  // así que no cuenta para el avance. Contarla inflaría el porcentaje.
  const hechas = (avance?.fasesCompletadas ?? []).filter((f) => f >= 1).length;

  let estado = "Sin inscribir";
  if (inscripcion) {
    if (avance?.completadoEn || (total > 0 && hechas >= total)) estado = "Completado";
    else if (hechas > 0) estado = "En curso";
    else estado = "Sin empezar";
  }

  return [
    persona.nombreCompleto,
    persona.identificador,
    persona.empresa,
    persona.area,
    curso?.nombre ?? "",
    inscripcion ? (inscripcion.activa ? "Activa" : "De baja") : "",
    inscripcion?.codigoUsado ?? "",
    comoFecha(inscripcion?.inscritoEn),
    hechas,
    total,
    // Se guarda como fracción porque la celda tiene formato de porcentaje:
    // Excel multiplica por cien al mostrarla. Poner 100 daría 10.000%.
    total > 0 ? hechas / total : 0,
    avance?.puntaje ?? 0,
    estado,
    comoFecha(avance?.completadoEn),
  ];
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export async function exportarRanking(): Promise<number> {
  // Sin tope: la pantalla muestra los primeros, pero un reporte para archivo
  // tiene que traer a todos.
  const entradas = await rankingDe(undefined, 1000);

  const filas = entradas.map((e, i) => [
    i + 1,
    e.nombre,
    e.area,
    e.puntaje,
    comoFecha(e.completadoEn),
  ]);

  const columnas: Columna[] = [
    { titulo: "Posición", ancho: 10, alineacion: "center", formato: "0" },
    { titulo: "Nombre", ancho: 30 },
    { titulo: "Área", ancho: 20 },
    { titulo: "Puntaje", ancho: 12, alineacion: "right", formato: "#,##0" },
    { titulo: "Finalización", ancho: 15, alineacion: "center", formato: FORMATO_FECHA },
  ];

  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Ranking",
    "Ranking del curso",
    "Participantes ordenados por puntaje obtenido.",
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

  await descargarLibro(libro, `ranking-${selloFecha()}.xlsx`);
  return filas.length;
}

// ---------------------------------------------------------------------------
// Códigos emitidos
// ---------------------------------------------------------------------------

export async function exportarCodigos(): Promise<number> {
  const [codigos, cursos] = await Promise.all([listarCodigos(), listarCursos()]);
  const hoy = Date.now();

  const filas = codigos.map((c) => {
    const vencido = Boolean(c.venceEn && new Date(c.venceEn).getTime() < hoy);
    const agotado = c.usosActuales >= c.usosMaximos;

    let estado = "Disponible";
    if (!c.activo) estado = "Dado de baja";
    else if (vencido) estado = "Vencido";
    else if (agotado) estado = "Sin cupos";

    return [
      c.codigo,
      cursos.find((x) => x.id === c.cursoId)?.nombre ?? c.cursoId,
      c.usosActuales,
      c.usosMaximos,
      Math.max(0, c.usosMaximos - c.usosActuales),
      c.venceEn ? comoFecha(c.venceEn) : "Sin vencimiento",
      estado,
      c.nota,
      comoFecha(c.creadoEn),
    ];
  });

  const columnas: Columna[] = [
    { titulo: "Código", ancho: 20 },
    { titulo: "Curso", ancho: 22 },
    { titulo: "Usos", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Cupos", ancho: 8, alineacion: "center", formato: "0" },
    { titulo: "Disponibles", ancho: 12, alineacion: "center", formato: "0" },
    { titulo: "Vigencia", ancho: 16, alineacion: "center" },
    { titulo: "Estado", ancho: 14, alineacion: "center" },
    { titulo: "Nota interna", ancho: 30 },
    { titulo: "Emitido", ancho: 14, alineacion: "center", formato: FORMATO_FECHA },
  ];

  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Códigos de acceso",
    "Códigos emitidos",
    "Consumo de cupos y vigencia de cada código de inscripción.",
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
    const estado = String(celdaEstado.value ?? "");
    const color = estado === "Disponible" ? VERDE : estado === "Sin cupos" ? AMBAR : ROJO;
    celdaEstado.font = { name: "Calibri", size: 11, bold: true, color: { argb: color } };
  });

  await descargarLibro(libro, `codigos-${selloFecha()}.xlsx`);
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
 */
export async function resumenPorArea(): Promise<ResumenArea[]> {
  const [perfiles, inscripciones, progresos, cursos] = await Promise.all([
    listarPerfiles(),
    listarInscripciones(),
    listarProgreso(),
    listarCursos(),
  ]);

  const porArea = new Map<string, ResumenArea>();

  perfiles
    .filter((p) => p.rol === "trabajador")
    .forEach((persona) => {
      const inscripcion = inscripciones.find((i) => i.perfilId === persona.id && i.activa);
      if (!inscripcion) return;

      const area = persona.area?.trim() || "Sin área";
      const curso = cursos.find((c) => c.id === inscripcion.cursoId);
      const avance = progresos.find(
        (p) => p.perfilId === persona.id && p.cursoId === inscripcion.cursoId
      );

      const total = curso?.totalFases ?? 5;
      const hechas = (avance?.fasesCompletadas ?? []).filter((f) => f >= 1).length;

      const actual = porArea.get(area) ?? {
        area,
        inscritos: 0,
        completados: 0,
        enCurso: 0,
        sinEmpezar: 0,
        cobertura: 0,
      };

      actual.inscritos += 1;
      if (avance?.completadoEn || hechas >= total) actual.completados += 1;
      else if (hechas > 0) actual.enCurso += 1;
      else actual.sinEmpezar += 1;

      porArea.set(area, actual);
    });

  return [...porArea.values()]
    .map((r) => ({
      ...r,
      cobertura: r.inscritos > 0 ? Math.round((r.completados / r.inscritos) * 100) : 0,
    }))
    .sort((a, b) => b.inscritos - a.inscritos);
}

export async function exportarResumenAreas(): Promise<number> {
  const resumen = await resumenPorArea();

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
    { titulo: "Inscritos", ancho: 12, alineacion: "center", formato: "0" },
    { titulo: "Completados", ancho: 13, alineacion: "center", formato: "0" },
    { titulo: "En curso", ancho: 11, alineacion: "center", formato: "0" },
    { titulo: "Sin empezar", ancho: 13, alineacion: "center", formato: "0" },
    { titulo: "Cobertura", ancho: 13, alineacion: "center", formato: "0%" },
  ];

  const libro = nuevoLibro();
  const hoja = armarHoja(
    libro,
    "Cobertura por área",
    "Cobertura de la capacitación",
    "Porcentaje de personas que completaron el curso en cada área.",
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
  if (resumen.length > 0) {
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
      celda.value = valor as ExcelJS.CellValue;
      celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: VERDE } };
      celda.alignment = { vertical: "middle", horizontal: columnas[c].alineacion ?? "left" };
      if (columnas[c].formato) celda.numFmt = columnas[c].formato;
      celda.border = { top: { style: "medium", color: { argb: VERDE } } };
    });
    fila.height = 20;
  }

  await descargarLibro(libro, `cobertura-areas-${selloFecha()}.xlsx`);
  return filas.length;
}