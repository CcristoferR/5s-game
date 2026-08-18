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