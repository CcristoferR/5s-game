import { Observable } from "@babylonjs/core";

// Single source of truth del progreso del jugador: puntaje, nivel actual,
// y ahora también qué niveles están desbloqueados/completados. Cuando
// exista login/backend, esto es lo único que hay que conectar para
// guardar el progreso real — el resto del juego no cambia.
export class GameManager {
  private static instance: GameManager;

  puntaje = 0;
  nivelActual = 1;
  onPuntajeCambiado = new Observable<number>();

  private nivelesDesbloqueados = new Set<number>([1]);
  private nivelesCompletados = new Set<number>();
  private readonly totalNiveles = 5;

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
  // según cuántos de los 5 niveles ya completó.
  getPorcentajeMadurez(): number {
    return Math.round((this.nivelesCompletados.size / this.totalNiveles) * 100);
  }
}