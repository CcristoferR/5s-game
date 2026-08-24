import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, Image, Button } from "@babylonjs/gui";
import { generarCertificado, descargarCertificado, compartirCertificado } from "../core/Certificate";

export function mostrarCertificado(scene: Scene, onCerrar: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("certificadoUI", true, scene);
  const dataUrl = generarCertificado();

  const fondo = new Rectangle("fondoCertificado");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(10, 12, 14, 0.95)";
  gui.addControl(fondo);

  const imagen = new Image("imagenCertificado", dataUrl);
  imagen.width = "560px";
  imagen.height = "392px";
  imagen.top = "-60px";
  fondo.addControl(imagen);

  const botonDescargar = Button.CreateSimpleButton("btnDescargarCert", "⬇ Descargar certificado");
  botonDescargar.width = "240px";
  botonDescargar.height = "44px";
  botonDescargar.color = "white";
  botonDescargar.cornerRadius = 8;
  botonDescargar.thickness = 0;
  botonDescargar.background = "#2e7d46";
  botonDescargar.top = "170px";
  botonDescargar.left = "-130px";
  botonDescargar.onPointerUpObservable.add(() => descargarCertificado(dataUrl));
  fondo.addControl(botonDescargar);

  const botonCompartir = Button.CreateSimpleButton("btnCompartirCert", "↗ Compartir");
  botonCompartir.width = "180px";
  botonCompartir.height = "44px";
  botonCompartir.color = "white";
  botonCompartir.cornerRadius = 8;
  botonCompartir.thickness = 0;
  botonCompartir.background = "#3a5a7a";
  botonCompartir.top = "170px";
  botonCompartir.left = "130px";
  botonCompartir.onPointerUpObservable.add(() => compartirCertificado(dataUrl));
  fondo.addControl(botonCompartir);

  const botonCerrar = Button.CreateSimpleButton("btnCerrarCert", "Cerrar");
  botonCerrar.width = "120px";
  botonCerrar.height = "36px";
  botonCerrar.color = "white";
  botonCerrar.cornerRadius = 8;
  botonCerrar.thickness = 0;
  botonCerrar.background = "rgba(255,255,255,0.15)";
  botonCerrar.top = "230px";
  botonCerrar.onPointerUpObservable.add(() => {
    fondo.isVisible = false;
    // Liberar la capa GUI, no solo ocultarla. Una capa oculta sigue
    // registrada en la escena y sigue interceptando los clics del menú
    // que se muestra después. Se libera en el siguiente tick para no
    // destruirla dentro de su propio evento de puntero.
    setTimeout(() => gui.dispose(), 0);
    onCerrar();
  });
  fondo.addControl(botonCerrar);
}