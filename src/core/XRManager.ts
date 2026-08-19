import { Scene, Mesh } from "@babylonjs/core";

// Configura el modo WebXR con fallback automático: el botón "Entrar en
// VR" solo aparece si Babylon detecta un visor conectado — si no hay
// visor, el juego sigue funcionando normal en pantalla, sin cambios.
// Se llama una vez por cada escena nueva (el juego recrea la escena en
// cada cambio de nivel o vuelta al menú), pasándole el piso sobre el
// que el jugador puede teletransportarse dentro del visor.
export async function setupXR(scene: Scene, floorMeshes: Mesh[]): Promise<void> {
  try {
    await scene.createDefaultXRExperienceAsync({
      floorMeshes,
    });
  } catch {
    // Si el navegador no soporta WebXR en absoluto, la promesa puede
    // rechazarse — no es un error del juego, solo indica que no hay
    // ningún camino a VR disponible en este dispositivo/navegador.
  }
}