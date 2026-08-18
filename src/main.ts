import { Engine } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { cargarNivel1 } from "./levels/Level1_Seiri";
import { cargarNivel2 } from "./levels/Level2_Seiton";
import { cargarNivel3 } from "./levels/Level3_Seiso";
import { cargarNivel4 } from "./levels/Level4_Seiketsu";
import { cargarNivel5 } from "./levels/Level5_Shitsuke";
import { HUD } from "./ui/HUD";
import { mostrarMenuPrincipal } from "./ui/MainMenu";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

let sceneManager = new SceneManager(engine);
const gameManager = GameManager.getInstance();

// Progreso de desbloqueo de esta sesión — se reinicia si recargas la
// página. Guardarlo de forma permanente es tarea del login/backend, que
// todavía no existe.
const nivelesDesbloqueados = new Set<number>([1]);

const infoNiveles = [
  { numero: 1, nombre: "Seiri - Clasificar" },
  { numero: 2, nombre: "Seiton - Ordenar" },
  { numero: 3, nombre: "Seiso - Limpiar" },
  { numero: 4, nombre: "Seiketsu - Estandarizar" },
  { numero: 5, nombre: "Shitsuke - Disciplina" },
];

function mostrarMenu(): void {
  const niveles = infoNiveles.map((n) => ({ ...n, desbloqueado: nivelesDesbloqueados.has(n.numero) }));
  mostrarMenuPrincipal(sceneManager.scene, niveles, (numeroNivel) => cargarNivel(numeroNivel));
}

function volverAlMenu(): void {
  sceneManager.scene.dispose();
  sceneManager = new SceneManager(engine);
  mostrarMenu();
}

function cargarNivel(numeroNivel: number): void {
  gameManager.reiniciarNivel();
  gameManager.onPuntajeCambiado.clear();

  const hud = new HUD(sceneManager.scene);
  gameManager.onPuntajeCambiado.add((puntaje) => hud.actualizarPuntaje(puntaje));

  const onCompletado = () => nivelesDesbloqueados.add(numeroNivel + 1);

  if (numeroNivel === 1) {
    const { objetos } = cargarNivel1(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
  } else if (numeroNivel === 2) {
    const { objetos } = cargarNivel2(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
  } else if (numeroNivel === 3) {
    cargarNivel3(sceneManager.scene, hud, volverAlMenu, onCompletado);
  } else if (numeroNivel === 4) {
    const { items } = cargarNivel4(sceneManager.scene, hud, volverAlMenu, onCompletado);
    items.forEach((item) => sceneManager.shadowGenerator.addShadowCaster(item.mesh));
  } else if (numeroNivel === 5) {
    cargarNivel5(sceneManager.scene, hud, volverAlMenu, onCompletado);
  }
}

mostrarMenu();

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());