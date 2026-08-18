import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";
import { puntosControlNivel5 } from "../data/levelConfig";
import { crearPuntoControl } from "../entities/AuditPoint";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const tiempoLimiteSegundos = 30;

export function cargarNivel5(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("labelsNivel5", true, scene);

  const suelo = MeshBuilder.CreateGround("sueloN5", { width: 10, height: 10 }, scene);
  const matSuelo = new StandardMaterial("matSueloN5", scene);
  matSuelo.diffuseColor = new Color3(0.75, 0.72, 0.68);
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN5", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new StandardMaterial("matEscritorioN5", scene);
  matEscritorio.diffuseColor = new Color3(0.45, 0.32, 0.22);
  escritorio.material = matEscritorio;

  const puntos = puntosControlNivel5.map((datos) =>
    crearPuntoControl(scene, gui, datos.id, datos.posicion[0], datos.posicion[1], datos.descripcionControl)
  );

  const botonFinalizar = Button.CreateSimpleButton("btnFinalizarAuditoria", "Finalizar auditoría");
  botonFinalizar.width = "220px";
  botonFinalizar.height = "48px";
  botonFinalizar.color = "white";
  botonFinalizar.cornerRadius = 8;
  botonFinalizar.thickness = 0;
  botonFinalizar.background = "#3a4550";
  botonFinalizar.top = "-24px";
  gui.addControl(botonFinalizar);

  const inicioNivel = performance.now();
  let corriendoTiempo = true;
  let finalizado = false;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const transcurrido = Math.floor((performance.now() - inicioNivel) / 1000);
    const restante = Math.max(0, tiempoLimiteSegundos - transcurrido);
    hud.actualizarTiempoRestante(restante);

    if (restante <= 0 && !finalizado) {
      finalizarAuditoria();
    }
  });

  botonFinalizar.onPointerUpObservable.add(() => {
    if (!finalizado) finalizarAuditoria();
  });

  function finalizarAuditoria(): void {
    finalizado = true;
    corriendoTiempo = false;
    botonFinalizar.isVisible = false;

    let puntosBase = 0;
    puntos.forEach((punto, i) => {
      const correcto = punto.estaMarcado() === puntosControlNivel5[i].tieneDesviacion;
      puntosBase += correcto ? 5 : 1;
    });

    gameManager.sumarPuntos(puntosBase);

    const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
    onCompletado();
    hud.mostrarResultadoFinal("Nivel 5 (Auditoría)", puntosBase, 0, segundosTotales, onVolverMenu);
  }

  return { puntos };
}