import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, ScrollViewer, Button, Control } from "@babylonjs/gui";
import { obtenerRankingNivel5, borrarRankingNivel5 } from "../core/RankingStorage";

// Colores de podio para los primeros 3 puestos — el resto usa un gris
// neutro. Es puramente decorativo, no afecta el orden ni los datos.
const COLORES_PODIO: Record<number, string> = {
  0: "#e0b83c", // oro
  1: "#c8ccd6", // plata
  2: "#c98a4b", // bronce
};

function formatearFecha(fechaIso: string): string {
  try {
    return new Date(fechaIso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function mostrarRankingNivel5(scene: Scene, onCerrar: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("rankingUI", true, scene);

  const fondo = new Rectangle("fondoRanking");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(10, 12, 14, 0.92)";
  gui.addControl(fondo);

  const panel = new Rectangle("panelRanking");
  panel.width = "620px";
  panel.height = "600px";
  panel.cornerRadius = 18;
  panel.thickness = 1;
  panel.color = "rgba(255,255,255,0.2)";
  panel.background = "rgba(16, 18, 22, 0.98)";
  fondo.addControl(panel);

  const entradas = obtenerRankingNivel5();

  const cabecera = new Rectangle("cabeceraRanking");
  cabecera.width = "620px";
  cabecera.height = "78px";
  cabecera.thickness = 0;
  cabecera.cornerRadius = 18;
  cabecera.background = "#5a4a8a";
  cabecera.top = "0px";
  cabecera.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.addControl(cabecera);

  const titulo = new TextBlock("tituloRanking", "📊 Ranking — Nivel 5 (Auditoría)");
  titulo.color = "white";
  titulo.fontSize = 21;
  titulo.top = "-9px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(titulo);

  const subtitulo = new TextBlock(
    "subtituloRanking",
    entradas.length > 0
      ? `Tus ${entradas.length} mejores intento${entradas.length === 1 ? "" : "s"} en este dispositivo`
      : "Se guarda automáticamente en este dispositivo"
  );
  subtitulo.color = "rgba(255,255,255,0.85)";
  subtitulo.fontSize = 13;
  subtitulo.top = "20px";
  subtitulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(subtitulo);

  if (entradas.length === 0) {
    const vacio = new TextBlock(
      "vacioRanking",
      "Todavía no completaste una auditoría del Nivel 5.\n\n¡Jugalo y tu resultado va a aparecer acá!"
    );
    vacio.color = "rgba(255,255,255,0.75)";
    vacio.fontSize = 16;
    vacio.textWrapping = true;
    vacio.width = "440px";
    vacio.top = "20px";
    panel.addControl(vacio);
  } else {
    const fechaMasReciente = entradas.reduce((max, e) => (e.fecha > max ? e.fecha : max), entradas[0].fecha);

    const scroll = new ScrollViewer("scrollRanking");
    scroll.width = "580px";
    scroll.height = "420px";
    scroll.barColor = "rgba(255,255,255,0.4)";
    scroll.top = "92px";
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.addControl(scroll);

    const lista = new StackPanel("listaRanking");
    lista.isVertical = true;
    lista.width = "560px";
    scroll.addControl(lista);

    entradas.forEach((entrada, i) => {
      const fila = new Rectangle(`filaRanking_${i}`);
      fila.width = "550px";
      fila.height = "66px";
      fila.thickness = 0;
      fila.cornerRadius = 10;
      fila.background = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      fila.paddingBottom = "6px";
      lista.addControl(fila);

      const franja = new Rectangle(`franjaRanking_${i}`);
      franja.width = "6px";
      franja.height = "66px";
      franja.thickness = 0;
      franja.cornerRadius = 3;
      franja.background = COLORES_PODIO[i] ?? "rgba(255,255,255,0.15)";
      franja.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fila.addControl(franja);

      const posicion = new TextBlock(`posicionRanking_${i}`, `#${i + 1}`);
      posicion.color = COLORES_PODIO[i] ?? "rgba(255,255,255,0.7)";
      posicion.fontSize = 20;
      posicion.width = "60px";
      posicion.left = "20px";
      posicion.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fila.addControl(posicion);

      const tasaPct = Math.round(entrada.tasaAcierto * 100);
      const esReciente = entrada.fecha === fechaMasReciente;
      const detalle = new TextBlock(
        `detalleRanking_${i}`,
        `${tasaPct}% aciertos  ·  ${entrada.segundos}s  ·  calificación real ${entrada.promedioCalificacion.toFixed(1)}/5${
          esReciente ? "  🆕" : ""
        }`
      );
      detalle.color = "white";
      detalle.fontSize = 14;
      detalle.left = "92px";
      detalle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      detalle.top = "-9px";
      fila.addControl(detalle);

      const fecha = new TextBlock(`fechaRanking_${i}`, formatearFecha(entrada.fecha));
      fecha.color = "rgba(255,255,255,0.5)";
      fecha.fontSize = 12;
      fecha.left = "92px";
      fecha.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fecha.top = "15px";
      fila.addControl(fecha);
    });
  }

  const hayEntradas = entradas.length > 0;

  const botonBorrar = Button.CreateSimpleButton("btnBorrarRanking", "🗑️ Borrar historial");
  botonBorrar.width = "190px";
  botonBorrar.height = "42px";
  botonBorrar.color = "white";
  botonBorrar.fontSize = 13;
  botonBorrar.cornerRadius = 8;
  botonBorrar.thickness = 0;
  botonBorrar.background = "rgba(255,255,255,0.12)";
  botonBorrar.top = "-20px";
  botonBorrar.left = "-140px";
  botonBorrar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  botonBorrar.isVisible = hayEntradas;
  panel.addControl(botonBorrar);

  // Confirmación de un click extra antes de borrar — evita perder el
  // historial por un click accidental, sin meter un diálogo aparte.
  let confirmandoBorrado = false;
  botonBorrar.onPointerUpObservable.add(() => {
    if (!confirmandoBorrado) {
      confirmandoBorrado = true;
      botonBorrar.background = "#8a3a2e";
      if (botonBorrar.textBlock) botonBorrar.textBlock.text = "¿Seguro? Click de nuevo";
      return;
    }
    borrarRankingNivel5();
    fondo.isVisible = false;
    // Se libera esta capa antes de volver a abrir el ranking; si no,
    // cada borrado dejaba una capa muerta encima de la anterior.
    setTimeout(() => gui.dispose(), 0);
    mostrarRankingNivel5(scene, onCerrar);
  });

  const botonCerrar = Button.CreateSimpleButton("btnCerrarRanking", "Cerrar");
  botonCerrar.width = "160px";
  botonCerrar.height = "42px";
  botonCerrar.color = "white";
  botonCerrar.cornerRadius = 8;
  botonCerrar.thickness = 0;
  botonCerrar.background = "#3a5a7a";
  botonCerrar.top = "-20px";
  botonCerrar.left = hayEntradas ? "80px" : "0px";
  botonCerrar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  botonCerrar.onPointerUpObservable.add(() => {
    fondo.isVisible = false;
    setTimeout(() => gui.dispose(), 0);
    onCerrar();
  });
  panel.addControl(botonCerrar);
}