import { Observable } from "@babylonjs/core";

// Single source of truth del progreso del jugador: puntaje y nivel actual.
export class GameManager {
  private static instance: GameManager;

  puntaje = 0;
  nivelActual = 1;
  onPuntajeCambiado = new Observable<number>();

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
}