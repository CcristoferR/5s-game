import { Scene, MeshBuilder, PBRMaterial, Color3 } from "@babylonjs/core";
import { Button, TextBlock, Control } from "@babylonjs/gui";
import { puntosControlNivel5 } from "../data/levelConfig";
import { crearPuntoControl } from "../entities/AuditPoint";
import { mostrarInformeAuditoria } from "../ui/AuditReport";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const tiempoLimiteSegundos = 40;

export function cargarNivel5(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN5", { width: 12, height: 12 }, scene);
  const matSuelo = new PBRMaterial("matSueloN5", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN5", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorioN5", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const instruccion = new TextBlock(
    "instruccionNivel5",
    "🔍 Revisa cada estación de control. Haz click en la esfera si detectas un problema (click de nuevo para desmarcar)."
  );
  instruccion.color = "white";
  instruccion.fontSize = 15;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  instruccion.width = "520px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const contador = new TextBlock("contadorNivel5", "Marcados: 0/5");
  contador.color = "white";
  contador.fontSize = 15;
  contador.outlineWidth = 3;
  contador.outlineColor = "rgba(0,0,0,0.6)";
  contador.top = "110px";
  contador.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(contador);

  const puntos = puntosControlNivel5.map((datos) =>
    crearPuntoControl(scene, gui, datos.id, datos.posicion[0], datos.posicion[1], datos.descripcionControl, datos.tipoEvidencia)
  );

  let marcados = 0;
  puntos.forEach((punto) => {
    punto.onCambio.add((estaMarcado) => {
      marcados += estaMarcado ? 1 : -1;
      contador.text = `Marcados: ${marcados}/${puntos.length}`;
    });
  });

  const botonFinalizar = Button.CreateSimpleButton("btnFinalizarAuditoria", "Finalizar auditoría");
  botonFinalizar.width = "220px";
  botonFinalizar.height = "48px";
  botonFinalizar.color = "white";
  botonFinalizar.cornerRadius = 8;
  botonFinalizar.thickness = 0;
  botonFinalizar.background = "#3a4550";
  botonFinalizar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
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
    instruccion.isVisible = false;
    contador.isVisible = false;

    let puntosBase = 0;
    const filas = puntosControlNivel5.map((datos, i) => {
      const marcadoPorJugador = puntos[i].estaMarcado();
      const correcto = marcadoPorJugador === datos.tieneDesviacion;
      puntosBase += correcto ? 5 : 1;
      return { datos, marcadoPorJugador };
    });

    gameManager.sumarPuntos(puntosBase);
    const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);

    mostrarInformeAuditoria(gui, filas, () => {
      onCompletado();
      hud.mostrarResultadoFinal("Nivel 5 (Auditoría)", puntosBase, 0, segundosTotales, onVolverMenu);
    });
  }

  return { puntos };
}