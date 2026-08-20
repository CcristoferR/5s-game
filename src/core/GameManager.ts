import { Observable } from "@babylonjs/core";

// Lo que el jugador construyó en el Nivel 4 (Seiketsu): los ítems que dejó
// en la zona "checklist" (sin importar si eran correctos o no) y el color
// que asignó a cada zona de señalización. El Nivel 5 usa esto como el
// estándar a auditar — así se cumple lo que pide la guía: "aplica el
// checklist que él mismo ayudó a construir en el Nivel 4".
export interface ItemChecklistConstruido {
  id: string;
  texto: string;
  // true si el ítem realmente correspondía al checklist según la guía
  // (zonaCorrecta === "checklist" en levelConfig). Si el jugador se
  // equivocó en el Nivel 4 y dejó ahí un ítem ambiguo, viaja como false —
  // el Nivel 5 lo usa para explicar por qué ese punto nunca puede "cumplir".
  esValido: boolean;
}

export interface SenalizacionConstruida {
  zonaId: string;
  zonaDescripcion: string;
  colorElegidoId: string;
  esCorrecta: boolean;
}

export interface EstandarNivel4 {
  checklist: ItemChecklistConstruido[];
  senalizacion: SenalizacionConstruida[];
}

export interface ResultadoAuditoriaNivel5 {
  promedioCalificacion: number; // 1-5, promedio real de los puntos de control auditados
  tasaAcierto: number; // 0-1, qué tan bien detectó el jugador cada punto
  aprobado: boolean;
}

// Single source of truth del progreso del jugador: puntaje, nivel actual,
// niveles desbloqueados/completados — y ahora también el estándar que el
// jugador construyó en el Nivel 4 y el resultado de la auditoría del
// Nivel 5, que es lo que conecta ambos niveles y controla si corresponde
// entregar el certificado. Cuando exista login/backend, esto es lo único
// que hay que conectar para guardar el progreso real — el resto del juego
// no cambia.
export class GameManager {
  private static instance: GameManager;

  puntaje = 0;
  nivelActual = 1;
  onPuntajeCambiado = new Observable<number>();

  private nivelesDesbloqueados = new Set<number>([1]);
  private nivelesCompletados = new Set<number>();
  private readonly totalNiveles = 5;

  private estandarNivel4: EstandarNivel4 = { checklist: [], senalizacion: [] };
  private resultadoAuditoriaNivel5: ResultadoAuditoriaNivel5 | null = null;

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  sumarPuntos(cantidad: number): void {
    this.puntaje += cantidad;
    this.onPuntajeCambiado.notifyObservers(this.puntaje);
  }

  reiniciarNivel(): void {
    this.puntaje = 0;
    this.onPuntajeCambiado.notifyObservers(this.puntaje);
  }

  completarNivel(numero: number): void {
    this.nivelesCompletados.add(numero);
    this.nivelesDesbloqueados.add(numero + 1);
  }

  estaDesbloqueado(numero: number): boolean {
    return this.nivelesDesbloqueados.has(numero);
  }

  estaCompletado(numero: number): boolean {
    return this.nivelesCompletados.has(numero);
  }

  // Meta-progresión: qué porcentaje de la "madurez 5S" lleva el jugador,
  // según cuántos de los 5 niveles ya completó. Ojo: el Nivel 5 solo se
  // marca como completado si el jugador APRUEBA la auditoría (ver
  // registrarResultadoAuditoriaN5 y Level5_Shitsuke.ts) — por lo tanto el
  // 100% (y el certificado, que depende de llegar al 100%) ya no se
  // obtiene solo por "jugar" el nivel, sino por auditar bien.
  getPorcentajeMadurez(): number {
    return Math.round((this.nivelesCompletados.size / this.totalNiveles) * 100);
  }

  guardarEstandarNivel4(estandar: EstandarNivel4): void {
    this.estandarNivel4 = estandar;
  }

  getEstandarNivel4(): EstandarNivel4 {
    return this.estandarNivel4;
  }

  registrarResultadoAuditoriaN5(resultado: ResultadoAuditoriaNivel5): void {
    this.resultadoAuditoriaNivel5 = resultado;
  }

  getResultadoAuditoriaN5(): ResultadoAuditoriaNivel5 | null {
    return this.resultadoAuditoriaNivel5;
  }
}