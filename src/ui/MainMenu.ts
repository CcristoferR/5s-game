import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Button, Rectangle, Control } from "@babylonjs/gui";

export interface NivelMenuInfo {
  numero: number;
  nombre: string;
  desbloqueado: boolean;
  completado: boolean;
}

export function mostrarMenuPrincipal(
  scene: Scene,
  niveles: NivelMenuInfo[],
  porcentajeMadurez: number,
  onSeleccionarNivel: (numero: number) => void,
  onVerCertificado: () => void
): { ocultar: () => void } {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("menuPrincipal", true, scene);

  const fondo = new Rectangle("fondoMenu");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(15, 18, 22, 0.92)";
  gui.addControl(fondo);

  const panel = new StackPanel("panelMenu");
  panel.isVertical = true;
  panel.width = "340px";
  fondo.addControl(panel);

  const titulo = new TextBlock("tituloMenu", "Gamificación 5S");
  titulo.color = "white";
  titulo.fontSize = 32;
  titulo.height = "60px";
  panel.addControl(titulo);

  const etiquetaMadurez = new TextBlock("etiquetaMadurez", `Madurez 5S: ${porcentajeMadurez}%`);
  etiquetaMadurez.color = "white";
  etiquetaMadurez.fontSize = 15;
  etiquetaMadurez.height = "24px";
  panel.addControl(etiquetaMadurez);

  const fondoBarra = new Rectangle("fondoBarraMadurez");
  fondoBarra.width = "300px";
  fondoBarra.height = "16px";
  fondoBarra.cornerRadius = 8;
  fondoBarra.thickness = 1;
  fondoBarra.color = "rgba(255,255,255,0.3)";
  fondoBarra.background = "rgba(255,255,255,0.08)";
  panel.addControl(fondoBarra);

  const relleno = new Rectangle("rellenoBarraMadurez");
  relleno.width = `${Math.max(2, porcentajeMadurez)}%`;
  relleno.height = "16px";
  relleno.cornerRadius = 8;
  relleno.thickness = 0;
  relleno.background = "#2e7d46";
  relleno.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fondoBarra.addControl(relleno);

  const espaciador = new TextBlock("espaciadorMenu", "");
  espaciador.height = "16px";
  panel.addControl(espaciador);

  niveles.forEach((nivel) => {
    let etiqueta: string;
    let colorFondo: string;

    if (nivel.completado) {
      etiqueta = `✅ ${nivel.nombre}`;
      colorFondo = "#2e7d46";
    } else if (nivel.desbloqueado) {
      etiqueta = `▶ ${nivel.nombre}`;
      colorFondo = "#3a5a4a";
    } else {
      etiqueta = `🔒 ${nivel.nombre}`;
      colorFondo = "#3a3d42";
    }

    const boton = Button.CreateSimpleButton(`btnNivel${nivel.numero}`, etiqueta);
    boton.width = "300px";
    boton.height = "48px";
    boton.color = "white";
    boton.cornerRadius = 8;
    boton.thickness = 0;
    boton.background = colorFondo;
    boton.paddingTop = "8px";
    boton.isEnabled = nivel.desbloqueado;
    boton.alpha = nivel.desbloqueado ? 1 : 0.55;

    if (nivel.desbloqueado) {
      boton.onPointerUpObservable.add(() => {
        fondo.isVisible = false;
        onSeleccionarNivel(nivel.numero);
      });
    }

    panel.addControl(boton);
  });

  // Solo aparece al llegar al 100% de madurez — el "premio" final del programa.
  if (porcentajeMadurez === 100) {
    const espaciadorCert = new TextBlock("espaciadorCert", "");
    espaciadorCert.height = "12px";
    panel.addControl(espaciadorCert);

    const botonCertificado = Button.CreateSimpleButton("btnVerCertificado", "🏆 Ver certificado");
    botonCertificado.width = "300px";
    botonCertificado.height = "48px";
    botonCertificado.color = "#1a1a1a";
    botonCertificado.cornerRadius = 8;
    botonCertificado.thickness = 0;
    botonCertificado.background = "#e0b83c";
    botonCertificado.paddingTop = "8px";
    botonCertificado.onPointerUpObservable.add(() => {
      fondo.isVisible = false;
      onVerCertificado();
    });
    panel.addControl(botonCertificado);
  }

  return { ocultar: () => (fondo.isVisible = false) };
}