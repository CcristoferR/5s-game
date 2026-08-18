// Single source of truth del progreso del jugador: puntaje y nivel actual.
// Patrón singleton — una sola instancia accesible desde cualquier archivo
// con GameManager.getInstance(), sin tener que pasarla como parámetro por
// todos lados. Cuando exista login/backend, esto es lo único que hay que
// conectar para guardar el progreso de verdad — el resto del juego no cambia.
export class GameManager {
  private static instance: GameManager;

  puntaje = 0;
  nivelActual = 1;

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  sumarPuntos(cantidad: number): void {
    this.puntaje += cantidad;
  }

  reiniciarNivel(): void {
    this.puntaje = 0;
  }
}