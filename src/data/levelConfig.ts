// Datos del Nivel 1 (Seiri / Clasificar).
export type ZonaClasificacion = "necesario" | "dudoso" | "descartar";

export interface ObjetoNivel1 {
  id: string;
  nombreVisible: string;
  posicionInicial: [number, number, number];
  zonaCorrecta: ZonaClasificacion;
  explicacion: string;
}

export const objetosNivel1: ObjetoNivel1[] = [
  {
    id: "engrapadora",
    nombreVisible: "Engrapadora",
    posicionInicial: [-1.2, 0.9, 0],
    zonaCorrecta: "necesario",
    explicacion: "Herramienta de uso diario en el puesto de trabajo.",
  },
  {
    id: "taza_cafe",
    nombreVisible: "Taza con café viejo",
    posicionInicial: [-0.4, 0.9, 0.3],
    zonaCorrecta: "descartar",
    explicacion: "Residuo que no debe permanecer en el área de trabajo.",
  },
  {
    id: "carpeta_activa",
    nombreVisible: "Carpeta 'Proyecto Activo'",
    posicionInicial: [0.4, 0.9, -0.2],
    zonaCorrecta: "necesario",
    explicacion: "Documentación en uso, se consulta con frecuencia.",
  },
  {
    id: "diario_viejo",
    nombreVisible: "Diario de hace 6 meses",
    posicionInicial: [1.2, 0.9, 0.1],
    zonaCorrecta: "descartar",
    explicacion: "Información desactualizada — ya no aporta valor vigente.",
  },
  {
    id: "caja_sin_etiqueta",
    nombreVisible: "Caja sin etiqueta",
    posicionInicial: [0, 0.9, -0.4],
    zonaCorrecta: "dudoso",
    explicacion: "No se sabe su contenido — requiere una tarjeta roja (red tag) para revisión antes de decidir si se mantiene o se descarta.",
  },
];

// Datos del Nivel 2 (Seiton / Ordenar).
export interface SlotNivel2 {
  id: string;
  posicionX: number;
  descripcion: string;
}

export interface ObjetoNivel2 {
  id: string;
  nombreVisible: string;
  posicionInicial: [number, number, number];
  slotCorrectoId: string;
  explicacion: string;
}

export const slotsNivel2: SlotNivel2[] = [
  { id: "slot_telefono", posicionX: -3, descripcion: "Uso muy frecuente — al alcance inmediato" },
  { id: "slot_engrapadora", posicionX: -1, descripcion: "Uso diario — cerca del área de trabajo" },
  { id: "slot_carpetas", posicionX: 1, descripcion: "Consulta ocasional — puede estar más lejos" },
  { id: "slot_lapices", posicionX: 3, descripcion: "Alcance rápido — borde del escritorio" },
];

export const objetosNivel2: ObjetoNivel2[] = [
  {
    id: "telefono",
    nombreVisible: "Teléfono de oficina",
    posicionInicial: [-1.2, 0.9, 0],
    slotCorrectoId: "slot_telefono",
    explicacion: "Se usa constantemente durante el día — debe quedar al alcance inmediato.",
  },
  {
    id: "engrapadora2",
    nombreVisible: "Engrapadora",
    posicionInicial: [-0.4, 0.9, 0.3],
    slotCorrectoId: "slot_engrapadora",
    explicacion: "Uso diario pero no constante — cerca del área de trabajo es suficiente.",
  },
  {
    id: "carpeta_activa2",
    nombreVisible: "Carpeta 'Proyecto Activo'",
    posicionInicial: [0.4, 0.9, -0.2],
    slotCorrectoId: "slot_carpetas",
    explicacion: "Se consulta pocas veces al día — puede estar un poco más lejos.",
  },
  {
    id: "taza_lapices",
    nombreVisible: "Taza de lápices",
    posicionInicial: [1.2, 0.9, 0.1],
    slotCorrectoId: "slot_lapices",
    explicacion: "Se necesita tomar rápido y seguido — mejor en el borde, a mano.",
  },
];

// Datos del Nivel 3 (Seiso / Limpiar).
export interface ManchaNivel3 {
  id: string;
  posicion: [number, number];
}

export interface OpcionCausaNivel3 {
  id: string;
  texto: string;
  esCorrecta: boolean;
  explicacion: string;
}

export const manchasNivel3: ManchaNivel3[] = [
  { id: "m1", posicion: [-0.8, -0.3] },
  { id: "m2", posicion: [0.2, 0.1] },
  { id: "m3", posicion: [1.0, -0.1] },
];

export const preguntaCausaNivel3 = "¿Cuál es el origen más probable de estas manchas de aceite?";

export const opcionesCausaNivel3: OpcionCausaNivel3[] = [
  {
    id: "fuga_maquina",
    texto: "Fuga de aceite en la máquina cercana",
    esCorrecta: true,
    explicacion: "Correcto — las manchas concentradas cerca del mismo punto suelen indicar una fuga activa, no derrames aislados.",
  },
  {
    id: "filtro_sucio",
    texto: "Filtro de aire sucio",
    esCorrecta: false,
    explicacion: "Un filtro sucio afecta el rendimiento del equipo, pero no genera manchas de aceite en el suelo.",
  },
  {
    id: "mal_habito",
    texto: "Mal hábito del turno anterior",
    esCorrecta: false,
    explicacion: "Posible, pero manchas repetidas en el mismo lugar apuntan primero a una causa mecánica, no humana.",
  },
];

// Datos del Nivel 4 (Seiketsu / Estandarizar).
export type ZonaChecklist = "checklist" | "descartar";

export interface ItemChecklistNivel4 {
  id: string;
  textoVisible: string;
  posicionInicial: [number, number, number];
  zonaCorrecta: ZonaChecklist;
  explicacion: string;
}

export const itemsNivel4: ItemChecklistNivel4[] = [
  {
    id: "limpiar_vago",
    textoVisible: "Limpiar el escritorio cada cierto tiempo",
    posicionInicial: [-1.8, 0.9, 0.2],
    zonaCorrecta: "descartar",
    explicacion: "Demasiado vago — 'cada cierto tiempo' no es medible, cada persona lo interpretaría distinto.",
  },
  {
    id: "limpiar_claro",
    textoVisible: "Limpiar con paño húmedo al finalizar el turno",
    posicionInicial: [-0.9, 0.9, -0.2],
    zonaCorrecta: "checklist",
    explicacion: "Claro y medible — cualquiera puede seguir esta instrucción sin ambigüedad.",
  },
  {
    id: "archivar_vago",
    textoVisible: "Guardar los documentos en algún lugar ordenado",
    posicionInicial: [0, 0.9, 0.3],
    zonaCorrecta: "descartar",
    explicacion: "No dice dónde ni cómo — deja la decisión al criterio de cada persona, eso no es un estándar.",
  },
  {
    id: "archivar_claro",
    textoVisible: "Archivar en carpeta por proyecto, ordenado por fecha",
    posicionInicial: [0.9, 0.9, -0.1],
    zonaCorrecta: "checklist",
    explicacion: "Instrucción específica y replicable por cualquier persona nueva en el puesto.",
  },
  {
    id: "correo_personal",
    textoVisible: "Revisar el correo personal",
    posicionInicial: [1.8, 0.9, 0.2],
    zonaCorrecta: "descartar",
    explicacion: "No corresponde a un procedimiento de estandarización del puesto de trabajo.",
  },
];

// Datos del Nivel 5 (Shitsuke / Disciplina) — modo auditoría.
export type TipoEvidencia = "tarjetaVencida" | "manchaVisible" | "objetoFueraDeLugar" | "sinProblema";

export interface PuntoControlNivel5 {
  id: string;
  posicion: [number, number];
  descripcionControl: string;
  tieneDesviacion: boolean;
  tipoEvidencia: TipoEvidencia;
  explicacion: string;
}

export const puntosControlNivel5: PuntoControlNivel5[] = [
  {
    id: "p1",
    posicion: [-4, 0.4],
    descripcionControl: "Ubicación del teléfono según estándar",
    tieneDesviacion: false,
    tipoEvidencia: "sinProblema",
    explicacion: "El teléfono está en su lugar asignado — sin desviación.",
  },
  {
    id: "p2",
    posicion: [-2, -0.3],
    descripcionControl: "Vigencia de la tarjeta roja del área",
    tieneDesviacion: true,
    tipoEvidencia: "tarjetaVencida",
    explicacion: "La tarjeta roja está vencida hace 2 semanas — debía renovarse.",
  },
  {
    id: "p3",
    posicion: [0, 0.5],
    descripcionControl: "Estado de limpieza del área de trabajo",
    tieneDesviacion: true,
    tipoEvidencia: "manchaVisible",
    explicacion: "Apareció una mancha nueva desde la última auditoría.",
  },
  {
    id: "p4",
    posicion: [2, -0.2],
    descripcionControl: "Ubicación de la carpeta de proyecto",
    tieneDesviacion: false,
    tipoEvidencia: "sinProblema",
    explicacion: "La carpeta está archivada correctamente según el estándar.",
  },
  {
    id: "p5",
    posicion: [4, 0.3],
    descripcionControl: "Organización general del estante",
    tieneDesviacion: true,
    tipoEvidencia: "objetoFueraDeLugar",
    explicacion: "Un objeto quedó fuera de su casilla asignada.",
  },
];