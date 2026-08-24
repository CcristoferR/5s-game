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
  { id: "engrapadora", nombreVisible: "Engrapadora", posicionInicial: [-1.7, 0.945, -0.82], zonaCorrecta: "necesario", explicacion: "Herramienta de uso diario en el puesto de trabajo." },
  { id: "taza_cafe", nombreVisible: "Taza con café viejo", posicionInicial: [-0.85, 0.945, -0.82], zonaCorrecta: "descartar", explicacion: "Residuo que no debe permanecer en el área de trabajo." },
  { id: "carpeta_activa", nombreVisible: "Carpeta 'Proyecto Activo'", posicionInicial: [0, 0.945, -0.82], zonaCorrecta: "necesario", explicacion: "Documentación en uso, se consulta con frecuencia." },
  { id: "diario_viejo", nombreVisible: "Diario de hace 6 meses", posicionInicial: [0.85, 0.945, -0.82], zonaCorrecta: "descartar", explicacion: "Información desactualizada — ya no aporta valor vigente." },
  { id: "caja_sin_etiqueta", nombreVisible: "Caja sin etiqueta", posicionInicial: [1.7, 0.945, -0.82], zonaCorrecta: "dudoso", explicacion: "No se sabe su contenido — requiere una tarjeta roja (red tag) para revisión antes de decidir si se mantiene o se descarta." },
  { id: "casco_agrietado", nombreVisible: "Casco de seguridad agrietado", posicionInicial: [-1.7, 0.945, -0.18], zonaCorrecta: "descartar", explicacion: "Tiene una grieta visible en el domo — compromete la protección, no cumple norma de seguridad." },
  { id: "cinta_metrica", nombreVisible: "Cinta métrica", posicionInicial: [-0.85, 0.945, -0.18], zonaCorrecta: "necesario", explicacion: "Herramienta de medición de uso frecuente en tareas de mantenimiento." },
  { id: "guantes_ocasionales", nombreVisible: "Guantes de trabajo (uso ocasional)", posicionInicial: [0, 0.945, -0.18], zonaCorrecta: "dudoso", explicacion: "Están en buen estado pero se usan pocas veces al mes — requieren tarjeta roja para confirmar si siguen siendo necesarios en este puesto." },
  { id: "chatarra_metal", nombreVisible: "Pieza de metal sin identificar", posicionInicial: [0.85, 0.945, -0.18], zonaCorrecta: "descartar", explicacion: "No corresponde a ningún equipo del área — chatarra sin función identificada." },
  { id: "manual_procedimientos", nombreVisible: "Manual de procedimientos del área", posicionInicial: [1.7, 0.945, -0.18], zonaCorrecta: "necesario", explicacion: "Documento de referencia activa, se consulta para tareas del puesto." },
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
  { id: "slot_telefono", posicionX: -3.3, descripcion: "Uso muy frecuente — al alcance inmediato" },
  { id: "slot_engrapadora", posicionX: -1.1, descripcion: "Uso diario — cerca del área de trabajo" },
  { id: "slot_carpetas", posicionX: 1.1, descripcion: "Consulta ocasional — puede estar más lejos" },
  { id: "slot_lapices", posicionX: 3.3, descripcion: "Alcance rápido — borde del escritorio" },
];

export const objetosNivel2: ObjetoNivel2[] = [
  { id: "telefono", nombreVisible: "Teléfono de oficina", posicionInicial: [-2.15, 0.945, -0.8], slotCorrectoId: "slot_telefono", explicacion: "Se usa constantemente durante el día — debe quedar al alcance inmediato." },
  { id: "engrapadora2", nombreVisible: "Engrapadora", posicionInicial: [-0.72, 0.945, -0.8], slotCorrectoId: "slot_engrapadora", explicacion: "Uso diario pero no constante — cerca del área de trabajo es suficiente." },
  { id: "carpeta_activa2", nombreVisible: "Carpeta 'Proyecto Activo'", posicionInicial: [0.72, 0.945, -0.8], slotCorrectoId: "slot_carpetas", explicacion: "Se consulta pocas veces al día — puede estar un poco más lejos." },
  { id: "taza_lapices", nombreVisible: "Taza de lápices", posicionInicial: [2.15, 0.945, -0.8], slotCorrectoId: "slot_lapices", explicacion: "Se necesita tomar rápido y seguido — mejor en el borde, a mano." },
  { id: "llavero", nombreVisible: "Llavero con llaves de oficina", posicionInicial: [-1.45, 0.945, -0.2], slotCorrectoId: "slot_telefono", explicacion: "Se necesita cada vez que se entra o sale — debe quedar al alcance inmediato, igual que el teléfono." },
  { id: "tijeras", nombreVisible: "Tijeras de oficina", posicionInicial: [0, 0.945, -0.2], slotCorrectoId: "slot_engrapadora", explicacion: "Uso diario, similar a la engrapadora — cerca del área de trabajo es suficiente." },
  { id: "manual_referencia", nombreVisible: "Manual de referencia rápida", posicionInicial: [1.45, 0.945, -0.2], slotCorrectoId: "slot_carpetas", explicacion: "Se consulta pocas veces al día — puede estar un poco más lejos, igual que las carpetas." },
];

// Datos del Nivel 3 (Seiso / Limpiar) — dos incidentes independientes.
export interface ManchaIncidente {
  id: string;
  posicion: [number, number];
  tipoVisual: "aceite" | "polvo";
}

export interface OpcionCausaNivel3 {
  id: string;
  texto: string;
  esCorrecta: boolean;
  explicacion: string;
}

export interface IncidenteNivel3 {
  id: string;
  nombreVisible: string;
  manchas: ManchaIncidente[];
  pregunta: string;
  opciones: OpcionCausaNivel3[];
}

export const incidentesNivel3: IncidenteNivel3[] = [
  {
    id: "incidente_aceite",
    nombreVisible: "Manchas junto a la máquina",
    manchas: [
      { id: "m1", posicion: [1.95, -1.0], tipoVisual: "aceite" },
      { id: "m2", posicion: [2.8, 0.45], tipoVisual: "aceite" },
      { id: "m3", posicion: [3.3, -0.7], tipoVisual: "aceite" },
    ],
    pregunta: "¿Cuál es el origen más probable de estas manchas de aceite?",
    opciones: [
      { id: "fuga_maquina", texto: "Fuga de aceite en la máquina cercana", esCorrecta: true, explicacion: "Correcto — las manchas concentradas cerca del mismo punto suelen indicar una fuga activa, no derrames aislados." },
      { id: "filtro_sucio", texto: "Filtro de aire sucio", esCorrecta: false, explicacion: "Un filtro sucio afecta el rendimiento del equipo, pero no genera manchas de aceite en el suelo." },
      { id: "mal_habito", texto: "Mal hábito del turno anterior", esCorrecta: false, explicacion: "Posible, pero manchas repetidas en el mismo lugar apuntan primero a una causa mecánica, no humana." },
    ],
  },
  {
    id: "incidente_polvo",
    nombreVisible: "Polvo negro junto a la impresora",
    manchas: [
      { id: "m4", posicion: [-3.7, 1.1], tipoVisual: "polvo" },
      { id: "m5", posicion: [-2.7, 2.2], tipoVisual: "polvo" },
    ],
    pregunta: "¿Cuál es el origen más probable de este polvo negro junto a la impresora?",
    opciones: [
      { id: "cartucho_danado", texto: "Cartucho de tóner dañado", esCorrecta: true, explicacion: "Correcto — un cartucho agrietado libera tóner en polvo, que se acumula cerca del equipo." },
      { id: "ventilacion", texto: "Falta de mantenimiento del ventilador", esCorrecta: false, explicacion: "Un ventilador sucio afecta la temperatura del equipo, pero no genera polvo negro visible en el suelo." },
      { id: "humedad", texto: "Humedad ambiental", esCorrecta: false, explicacion: "La humedad no produce residuo negro en polvo — ese patrón es típico de tóner, no de humedad." },
    ],
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
  { id: "limpiar_vago", textoVisible: "Limpiar el escritorio cada cierto tiempo", posicionInicial: [-1.6, 0.9, 0.2], zonaCorrecta: "descartar", explicacion: "Demasiado vago — 'cada cierto tiempo' no es medible, cada persona lo interpretaría distinto." },
  { id: "limpiar_claro", textoVisible: "Limpiar con paño húmedo al finalizar el turno", posicionInicial: [-0.8, 0.9, -0.2], zonaCorrecta: "checklist", explicacion: "Claro y medible — cualquiera puede seguir esta instrucción sin ambigüedad." },
  { id: "archivar_vago", textoVisible: "Guardar los documentos en algún lugar ordenado", posicionInicial: [0, 0.9, 0.3], zonaCorrecta: "descartar", explicacion: "No dice dónde ni cómo — deja la decisión al criterio de cada persona, eso no es un estándar." },
  { id: "archivar_claro", textoVisible: "Archivar en carpeta por proyecto, ordenado por fecha", posicionInicial: [0.8, 0.9, -0.1], zonaCorrecta: "checklist", explicacion: "Instrucción específica y replicable por cualquier persona nueva en el puesto." },
  { id: "correo_personal", textoVisible: "Revisar el correo personal", posicionInicial: [1.6, 0.9, 0.2], zonaCorrecta: "descartar", explicacion: "No corresponde a un procedimiento de estandarización del puesto de trabajo." },
];

// Señalética / códigos de color del Nivel 4 — nueva mecánica que pide la
// guía ("coloca señalética, códigos de color"), separada del checklist.
export interface SenalNivel4 {
  id: string;
  nombreVisible: string;
  colorHex: [number, number, number];
  posicionInicial: [number, number, number];
}

export interface ZonaSenalNivel4 {
  id: string;
  posicionX: number;
  descripcion: string;
  colorCorrectoId: string;
}

export const senalesNivel4: SenalNivel4[] = [
  { id: "senal_verde", nombreVisible: "Verde", colorHex: [0.15, 0.55, 0.2], posicionInicial: [2, 0.02, 3.0] },
  { id: "senal_amarillo", nombreVisible: "Amarillo", colorHex: [0.85, 0.7, 0.05], posicionInicial: [-2, 0.02, 3.0] },
  { id: "senal_rojo", nombreVisible: "Rojo", colorHex: [0.75, 0.1, 0.1], posicionInicial: [0, 0.02, 3.0] },
];

export const zonasSenalNivel4: ZonaSenalNivel4[] = [
  { id: "zona_transito", posicionX: -2, descripcion: "Zona de tránsito peatonal — paso seguro", colorCorrectoId: "senal_verde" },
  { id: "zona_riesgo_electrico", posicionX: 0, descripcion: "Zona de riesgo eléctrico — precaución", colorCorrectoId: "senal_amarillo" },
  { id: "zona_acceso_restringido", posicionX: 2, descripcion: "Zona de acceso restringido — prohibido el paso", colorCorrectoId: "senal_rojo" },
];

// Datos del Nivel 5 (Shitsuke / Disciplina) — modo auditoría.
//
// A diferencia de los otros niveles, los puntos de control YA NO son una
// lista fija: se generan en tiempo real a partir del estándar que el
// propio jugador construyó en el Nivel 4 (ver core/AuditGenerator.ts y
// core/GameManager.ts), y las desviaciones se sortean en cada intento.
// Acá solo queda el tipo de dato y un set de respaldo, por si el jugador
// llegara a este nivel sin datos guardados del Nivel 4 en esta sesión
// (no debería pasar en el flujo normal, pero evita que el nivel se rompa).
export type TipoEvidencia = "tarjetaVencida" | "manchaVisible" | "objetoFueraDeLugar" | "sinProblema";

export interface PuntoControlNivel5 {
  id: string;
  posicion: [number, number];
  descripcionControl: string;
  tieneDesviacion: boolean;
  tipoEvidencia: TipoEvidencia;
  // Calificación real del punto de control en escala 1-5, como en un
  // checklist de auditoría de industria: 1-2 = incumple, 4-5 = cumple.
  // Es independiente de si el jugador acierta o no al marcarlo.
  calificacion: number;
  explicacion: string;
}

export const puntosControlRespaldoNivel5: PuntoControlNivel5[] = [
  { id: "resp_p1", posicion: [-4, 0.4], descripcionControl: "Ubicación del teléfono según estándar", tieneDesviacion: false, tipoEvidencia: "sinProblema", calificacion: 5, explicacion: "El teléfono está en su lugar asignado — sin desviación." },
  { id: "resp_p2", posicion: [-2, -0.3], descripcionControl: "Vigencia de la tarjeta roja del área", tieneDesviacion: true, tipoEvidencia: "tarjetaVencida", calificacion: 1, explicacion: "La tarjeta roja está vencida hace 2 semanas — debía renovarse." },
  { id: "resp_p3", posicion: [0, 0.5], descripcionControl: "Estado de limpieza del área de trabajo", tieneDesviacion: true, tipoEvidencia: "manchaVisible", calificacion: 2, explicacion: "Apareció una mancha nueva desde la última auditoría." },
  { id: "resp_p4", posicion: [2, -0.2], descripcionControl: "Ubicación de la carpeta de proyecto", tieneDesviacion: false, tipoEvidencia: "sinProblema", calificacion: 4, explicacion: "La carpeta está archivada correctamente según el estándar." },
  { id: "resp_p5", posicion: [4, 0.3], descripcionControl: "Organización general del estante", tieneDesviacion: true, tipoEvidencia: "objetoFueraDeLugar", calificacion: 2, explicacion: "Un objeto quedó fuera de su casilla asignada." },
];