import { Engine } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { cargarNivel1 } from "./levels/Level1_Seiri";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const sceneManager = new SceneManager(engine);
const gameManager = GameManager.getInstance();

const { objetos, zonas } = cargarNivel1(sceneManager.scene);
objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());