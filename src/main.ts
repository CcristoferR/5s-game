import { Engine, Mesh } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { setupXR } from "./core/XRManager";
import { cargarNivel1 } from "./levels/Level1_Seiri";
import { cargarNivel2 } from "./levels/Level2_Seiton";
import { cargarNivel3 } from "./levels/Level3_Seiso";
import { cargarNivel4 } from "./levels/Level4_Seiketsu";
import { cargarNivel5 } from "./levels/Level5_Shitsuke";
import { HUD } from "./ui/HUD";
import { mostrarMenuPrincipal } from "./ui/MainMenu";
import { mostrarCertificado } from "./ui/CertificateScreen";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

let sceneManager = new SceneManager(engine);
const gameManager = GameManager.getInstance();

const infoNiveles = [
  { numero: 1, nombre: "Seiri - Clasificar" },
  { numero: 2, nombre: "Seiton - Ordenar" },
  { numero: 3, nombre: "Seiso - Limpiar" },
  { numero: 4, nombre: "Seiketsu - Estandarizar" },
  { numero: 5, nombre: "Shitsuke - Disciplina" },
];

// Nombre del piso de cada nivel — se usa para saber sobre qué malla se
// puede teletransportar el jugador una vez dentro del visor.
const sueloPorNivel: Record<number, string> = {
  1: "suelo",
  2: "sueloN2",
  3: "sueloN3",
  4: "sueloN4",
  5: "sueloN5",
};

function mostrarMenu(): void {
  const niveles = infoNiveles.map((n) => ({
    ...n,
    desbloqueado: gameManager.estaDesbloqueado(n.numero),
    completado: gameManager.estaCompletado(n.numero),
  }));
  mostrarMenuPrincipal(
    sceneManager.scene,
    niveles,
    gameManager.getPorcentajeMadurez(),
    (numeroNivel) => cargarNivel(numeroNivel),
    () => mostrarCertificado(sceneManager.scene, () => mostrarMenu())
  );
  setupXR(sceneManager.scene, []); // sin piso propio, pero el botón de VR queda disponible
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

  const onCompletado = () => gameManager.completarNivel(numeroNivel);

  if (numeroNivel === 1) {
    const { objetos } = cargarNivel1(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
  } else if (numeroNivel === 2) {
    const { objetos, slots } = cargarNivel2(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
    slots.forEach((s) => sceneManager.shadowGenerator.addShadowCaster(s.mesh));
  } else if (numeroNivel === 3) {
    const { maquina } = cargarNivel3(sceneManager.scene, hud, volverAlMenu, onCompletado);
    maquina.getChildMeshes().forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m));
  } else if (numeroNivel === 4) {
    const { items, zonas } = cargarNivel4(sceneManager.scene, hud, volverAlMenu, onCompletado);
    items.forEach((item) => sceneManager.shadowGenerator.addShadowCaster(item.mesh));
    zonas.forEach((z) => sceneManager.shadowGenerator.addShadowCaster(z));
   } else if (numeroNivel === 5) {
    const { puntos } = cargarNivel5(sceneManager.scene, hud, volverAlMenu, onCompletado);
    puntos.forEach((p) => p.meshesSombra.forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m)));
  }
  const nombreSuelo = sueloPorNivel[numeroNivel];
  const suelo = sceneManager.scene.getMeshByName(nombreSuelo) as Mesh | null;
  setupXR(sceneManager.scene, suelo ? [suelo] : []);
}

mostrarMenu();

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());