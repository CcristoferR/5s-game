import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Button, Rectangle, ScrollViewer, Control } from "@babylonjs/gui";
import type { PuntoControlNivel5 } from "../data/levelConfig";

export interface FilaInforme {
  datos: PuntoControlNivel5;
  marcadoPorJugador: boolean;
}

// Informe detallado post-auditoría: punto por punto, si el jugador
// acertó y por qué. Sin esto, el jugador solo veía un número final sin
// entender qué evaluó bien o mal — es la corrección que le da sentido
// pedagógico real al nivel.
export function mostrarInformeAuditoria(scene: Scene, filas: FilaInforme[], onContinuar: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("informeAuditoria", true, scene);

  const fondo = new Rectangle("fondoInforme");
  fondo.width = "600px";
  fondo.height = "520px";
  fondo.cornerRadius = 14;
  fondo.thickness = 0;
  fondo.background = "rgba(15, 18, 22, 0.97)";
  gui.addControl(fondo);

  const titulo = new TextBlock("tituloInforme", "📋 Informe de Auditoría");
  titulo.color = "white";
  titulo.fontSize = 24;
  titulo.height = "40px";
  titulo.top = "18px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(titulo);

  const scroll = new ScrollViewer("scrollInforme");
  scroll.width = "560px";
  scroll.height = "360px";
  scroll.barColor = "rgba(255,255,255,0.4)";
  scroll.top = "65px";
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(scroll);

  const listaFilas = new StackPanel("listaFilasInforme");
  listaFilas.isVertical = true;
  listaFilas.width = "540px";
  scroll.addControl(listaFilas);

  filas.forEach((fila) => {
    const acerto = fila.marcadoPorJugador === fila.datos.tieneDesviacion;

    const fondoFila = new Rectangle(`filaInforme_${fila.datos.id}`);
    fondoFila.width = "530px";
    fondoFila.height = "72px";
    fondoFila.thickness = 0;
    fondoFila.cornerRadius = 8;
    fondoFila.background = acerto ? "rgba(30, 100, 50, 0.5)" : "rgba(110, 30, 30, 0.5)";
    fondoFila.paddingBottom = "8px";
    listaFilas.addControl(fondoFila);

    const textoFila = new TextBlock(
      `textoFila_${fila.datos.id}`,
      `${acerto ? "✅" : "❌"} ${fila.datos.descripcionControl}\n${fila.datos.explicacion}`
    );
    textoFila.color = "white";
    textoFila.fontSize = 13;
    textoFila.textWrapping = true;
    textoFila.paddingLeft = "10px";
    textoFila.paddingRight = "10px";
    fondoFila.addControl(textoFila);
  });

  const botonContinuar = Button.CreateSimpleButton("btnContinuarInforme", "Ver resultado final");
  botonContinuar.width = "220px";
  botonContinuar.height = "46px";
  botonContinuar.color = "white";
  botonContinuar.cornerRadius = 8;
  botonContinuar.thickness = 0;
  botonContinuar.background = "#2e7d46";
  botonContinuar.top = "-16px";
  botonContinuar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  botonContinuar.onPointerUpObservable.add(() => {
    fondo.isVisible = false;
    onContinuar();
  });
  fondo.addControl(botonContinuar);
}