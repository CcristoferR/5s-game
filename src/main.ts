import { Engine } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { cargarNivel1 } from "./levels/Level1_Seiri";
import { cargarNivel2 } from "./levels/Level2_Seiton";
import { cargarNivel3 } from "./levels/Level3_Seiso";
import { cargarNivel4 } from "./levels/Level4_Seiketsu";
import { HUD } from "./ui/HUD";
import { mostrarMenuPrincipal } from "./ui/MainMenu";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const sceneManager = new SceneManager(engine);
const gameManager = GameManager.getInstance();

mostrarMenuPrincipal(
  sceneManager.scene,
  [
    { numero: 1, nombre: "Seiri - Clasificar", desbloqueado: true },
    { numero: 2, nombre: "Seiton - Ordenar", desbloqueado: true },
    { numero: 3, nombre: "Seiso - Limpiar", desbloqueado: true },
    { numero: 4, nombre: "Seiketsu - Estandarizar", desbloqueado: true },
    { numero: 5, nombre: "Shitsuke - Disciplina", desbloqueado: false },
  ],
  (numeroNivel) => {
    gameManager.reiniciarNivel();

    const hud = new HUD(sceneManager.scene);
    gameManager.onPuntajeCambiado.add((puntaje) => hud.actualizarPuntaje(puntaje));

    if (numeroNivel === 1) {
      const { objetos } = cargarNivel1(sceneManager.scene, hud);
      objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
    } else if (numeroNivel === 2) {
      const { objetos } = cargarNivel2(sceneManager.scene, hud);
      objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
    } else if (numeroNivel === 3) {
      cargarNivel3(sceneManager.scene, hud);
    } else if (numeroNivel === 4) {
      const { items } = cargarNivel4(sceneManager.scene, hud);
      items.forEach((item) => sceneManager.shadowGenerator.addShadowCaster(item.mesh));
    }
  }
);

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());