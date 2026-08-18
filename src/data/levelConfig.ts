// Datos del Nivel 1 (Seiri / Clasificar). Cambiar objetos, posiciones o
// reglas correctas se hace solo acá — la lógica del nivel (Level1_Seiri.ts)
// no necesita tocarse.
export type ZonaClasificacion = "necesario" | "dudoso" | "descartar";

export interface ObjetoNivel1 {
  id: string;
  nombreVisible: string;
  posicionInicial: [number, number, number];
  zonaCorrecta: ZonaClasificacion;
  explicacion: string; // se muestra si el jugador se equivoca
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