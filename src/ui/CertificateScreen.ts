import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, Image, TextBlock } from "@babylonjs/gui";
import { generarCertificado, descargarCertificado, compartirCertificado } from "../core/Certificate";
import { emitirCertificado, explicarRechazo } from "../portal/Datos";
import { PALETA, TEXTO, crearBotonPrincipal, crearBotonOpcion } from "./EstiloUI";

/**
 * Pantalla del certificado.
 *
 * El certificado ya no se dibuja al vuelo con datos genéricos: primero se pide
 * al servidor, que comprueba que la persona realmente terminó el curso, toma
 * su nombre y su empresa del perfil guardado, y devuelve un código de
 * verificación registrado en la base.
 *
 * Por eso la pantalla ahora tiene tres estados — cargando, emitido y error —
 * en vez de aparecer al instante. La espera es de una consulta, pero conviene
 * mostrarla: una pantalla en blanco de medio segundo se lee como que algo
 * falló.
 */
export function mostrarCertificado(
  scene: Scene,
  onCerrar: () => void,
  datosAuditoria?: { promedioCalificacion: number; tasaAcierto: number }
): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("certificadoUI", true, scene);
  if (gui.layer) gui.layer.applyPostProcess = false;
  gui.idealWidth = 1600;
  gui.idealHeight = 900;
  gui.useSmallestIdeal = true;

  const fondo = new Rectangle("fondoCertificado");
  fondo.width = "100%";
  fondo.height = "100%";
  fondo.thickness = 0;
  fondo.background = "rgba(10, 12, 14, 0.96)";
  gui.addControl(fondo);

  const aviso = new TextBlock("avisoCertificado", "Emitiendo tu certificado…");
  aviso.color = PALETA.cuerpo;
  aviso.fontSize = TEXTO.cuerpo;
  aviso.textWrapping = true;
  aviso.width = "520px";
  aviso.height = "80px";
  aviso.isHitTestVisible = false;
  fondo.addControl(aviso);

  function cerrar(): void {
    fondo.isVisible = false;
    // Se libera la capa, no solo se oculta: una capa oculta sigue registrada
    // en la escena y sigue interceptando los clics del menú que viene después.
    // En el siguiente tick, para no destruirla dentro de su propio evento.
    setTimeout(() => gui.dispose(), 0);
    onCerrar();
  }

  const botonCerrar = crearBotonOpcion("btnCerrarCert", "Volver al menú", 180);
  botonCerrar.top = "300px";
  botonCerrar.onPointerUpObservable.add(cerrar);
  fondo.addControl(botonCerrar);

  void emitir();

  async function emitir(): Promise<void> {
    const resultado = await emitirCertificado();

    if (!resultado.ok) {
      // El caso esperable es "curso_incompleto", que en teoría no debería
      // ocurrir porque al certificado solo se llega tras aprobar el nivel 5.
      // Si pasa, el mensaje dice qué falta en vez de dejar la pantalla muda.
      aviso.text =
        resultado.motivo === "curso_incompleto"
          ? "Todavía no completaste las cinco fases del curso."
          : explicarRechazo("otro");
      aviso.color = PALETA.error;
      return;
    }

    aviso.isVisible = false;
    dibujar(resultado.certificado);
  }

  function dibujar(certificado: Parameters<typeof generarCertificado>[0]): void {
    const dataUrl = generarCertificado(certificado, datosAuditoria);

    const imagen = new Image("imagenCertificado", dataUrl);
    // Proporción 1200x850 del lienzo: si se estira, el texto sale deformado.
    imagen.width = "620px";
    imagen.height = "439px";
    imagen.top = "-70px";
    fondo.addControl(imagen);

    // El código repetido bajo la imagen se puede leer sin abrir el archivo, y
    // es lo que la persona necesita si le piden verificar su certificado.
    const codigo = new TextBlock("codigoCertificado", `Código de verificación:  ${certificado.codigo}`);
    codigo.color = PALETA.rotulo;
    codigo.fontSize = TEXTO.menor;
    codigo.height = "26px";
    codigo.top = "168px";
    codigo.isHitTestVisible = false;
    fondo.addControl(codigo);

    const botonDescargar = crearBotonPrincipal("btnDescargarCert", "Descargar certificado", 240);
    botonDescargar.top = "222px";
    botonDescargar.left = "-130px";
    botonDescargar.onPointerUpObservable.add(() =>
      descargarCertificado(dataUrl, certificado.codigo)
    );
    fondo.addControl(botonDescargar);

    const botonCompartir = crearBotonOpcion("btnCompartirCert", "Compartir", 180);
    botonCompartir.top = "222px";
    botonCompartir.left = "130px";
    botonCompartir.onPointerUpObservable.add(() =>
      void compartirCertificado(dataUrl, certificado.codigo)
    );
    fondo.addControl(botonCompartir);
  }

}