import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, ScrollViewer, Control } from "@babylonjs/gui";
import {
  PALETA,
  TEXTO,
  MARGEN,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearDivisor,
  crearBotonPrincipal,
  desvanecer,
} from "./EstiloUI";
import { podioDelCurso, miPosicion, formatearDuracion, type FilaRanking, type MiPosicion } from "../portal/Ranking";
import { CURSO_ID } from "../portal/Datos";

const ANCHO_TARJETA = 720;
const ALTO_TARJETA = 560;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;

// Oro, plata y bronce para los tres primeros; el resto, gris neutro.
const COLORES_PODIO: Record<number, string> = {
  1: "#e0b83c",
  2: "#c8ccd6",
  3: "#c98a4b",
};

/**
 * Ranking del curso.
 *
 * Muestra el podio de la empresa de quien mira y, aparte, su propia posición.
 *
 * POR QUÉ SOLO EL PODIO Y NO LA LISTA COMPLETA
 *
 * En una capacitación laboral, publicar la tabla entera expone a quienes
 * quedaron últimos frente a sus compañeros. Es la forma más rápida de que la
 * gente deje de querer hacer el curso — el ranking pasa de motivar a ser un
 * riesgo. Cada uno ve el podio y dónde está parado; la tabla completa la ve la
 * administración, que la necesita para gestionar.
 *
 * El recorte por empresa y el límite de filas se aplican en la base de datos,
 * no acá: si dependieran de esta pantalla, bastaría con abrir la consola del
 * navegador para saltárselos.
 */
export function mostrarRankingCurso(scene: Scene, onCerrar: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("rankingUI", true, scene);
  if (gui.layer) {
    // Fuera del post-proceso de la escena, igual que las demás pantallas: el
    // bloom y el tone mapping levantan los negros y lavan los colores.
    gui.layer.applyPostProcess = false;
  }

  const velo = crearVelo(gui, "veloRanking");
  const tarjeta = crearTarjeta(velo, "tarjetaRanking", ANCHO_TARJETA, ALTO_TARJETA);
  crearFilete(tarjeta, "fileteRanking", ANCHO_TARJETA, PALETA.dato);

  const encabezado = new StackPanel("encabezadoRanking");
  encabezado.isVertical = true;
  encabezado.width = ANCHO_CONTENIDO + "px";
  encabezado.left = MARGEN + "px";
  encabezado.top = "32px";
  encabezado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  encabezado.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(encabezado);

  encabezado.addControl(crearRotulo("rotuloRanking", "RANKING DEL CURSO"));
  encabezado.addControl(crearEspacio("aireRotuloRanking", 10));

  const titulo = crearParrafo("tituloRanking", "Cargando…", ANCHO_CONTENIDO, TEXTO.titulo, PALETA.titulo, "600");
  encabezado.addControl(titulo);
  encabezado.addControl(crearEspacio("aireDivisorRanking", 18));
  encabezado.addControl(crearDivisor("divisorRanking", ANCHO_CONTENIDO));

  const scroll = new ScrollViewer("scrollRanking");
  scroll.width = ANCHO_CONTENIDO + 12 + "px";
  scroll.height = ALTO_TARJETA - 246 + "px";
  scroll.thickness = 0;
  scroll.barColor = "rgba(255,255,255,0.28)";
  scroll.barBackground = "rgba(255,255,255,0.05)";
  scroll.left = MARGEN + "px";
  scroll.top = "156px";
  scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(scroll);

  const lista = new StackPanel("listaRanking");
  lista.isVertical = true;
  lista.width = ANCHO_CONTENIDO + "px";
  scroll.addControl(lista);

  const pie = crearDivisor("divisorPieRanking", ANCHO_CONTENIDO);
  pie.left = MARGEN + "px";
  pie.top = "-84px";
  pie.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  pie.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  tarjeta.addControl(pie);

  const resumen = crearParrafo("resumenRanking", "", 430, TEXTO.menor, PALETA.cuerpo);
  resumen.left = MARGEN + "px";
  resumen.top = "-38px";
  resumen.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  resumen.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  tarjeta.addControl(resumen);

  const boton = crearBotonPrincipal("btnCerrarRanking", "Cerrar", 150);
  boton.left = -MARGEN + "px";
  boton.top = "-20px";
  boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    velo.isPointerBlocker = false;
    velo.isVisible = false;
    // Diferido: liberar controles mientras Babylon reparte el evento de clic
    // corta el resto del manejador.
    setTimeout(() => {
      try {
        gui.dispose();
      } catch {
        /* la escena ya se recreó y se llevó la capa */
      }
    }, 0);
    onCerrar();
  });
  tarjeta.addControl(boton);

  desvanecer(velo, 0, 1, 160);

  void cargar();

  async function cargar(): Promise<void> {
    // Las dos consultas van en paralelo: son independientes y así la pantalla
    // no espera una detrás de la otra.
    const [podio, posicion] = await Promise.all([podioDelCurso(CURSO_ID, 10), miPosicion(CURSO_ID)]);

    // La escena pudo destruirse mientras llegaban los datos: si el jugador
    // cerró la pantalla o volvió al menú, escribir acá reventaría contra
    // controles que ya no existen.
    if (scene.isDisposed || !velo.isVisible) return;

    pintar(podio, posicion);
  }

  function pintar(podio: FilaRanking[], posicion: MiPosicion | null): void {
    lista.clearControls();

    if (podio.length === 0) {
      titulo.text = "Todavía no hay resultados";
      lista.addControl(crearEspacio("aireVacioRanking", 26));
      lista.addControl(
        crearParrafo(
          "vacioRanking",
          "Nadie de tu empresa completó fases de este curso por ahora. En cuanto alguien apruebe la primera, aparecerá acá.",
          ANCHO_CONTENIDO,
          TEXTO.cuerpo
        )
      );
      resumen.text = "";
      return;
    }

    titulo.text = podio.length === 1 ? "1 participante" : `Los ${podio.length} mejores de tu empresa`;

    podio.forEach((fila) => {
      lista.addControl(filaDelPodio(fila));
      lista.addControl(crearEspacio(`aireFila_${fila.perfilId}`, 8));
    });

    if (posicion) {
      // Si la persona ya está en el podio no hace falta repetírselo; en ese
      // caso el resumen habla de su puntaje, no de su puesto.
      const enPodio = podio.some((f) => f.soyYo);
      resumen.text = enPodio
        ? `Tu puntaje: ${posicion.puntajeTotal} · ${formatearDuracion(posicion.segundosTotal)}`
        : `Tu posición: ${posicion.posicion}º de ${posicion.participantes} · ${posicion.puntajeTotal} puntos`;
    } else {
      resumen.text = "Completa una fase para entrar al ranking.";
    }
  }

  function filaDelPodio(fila: FilaRanking): Rectangle {
    const color = COLORES_PODIO[fila.posicion] ?? "rgba(255,255,255,0.18)";

    const marco = new Rectangle(`filaRanking_${fila.perfilId}`);
    marco.width = ANCHO_CONTENIDO + "px";
    marco.height = "62px";
    marco.thickness = fila.soyYo ? 1 : 0;
    // La fila propia se distingue con borde y fondo más claro: en una lista de
    // nombres ajenos, encontrarse rápido es lo primero que busca el jugador.
    marco.color = fila.soyYo ? PALETA.dato : "transparent";
    marco.cornerRadius = 10;
    marco.background = fila.soyYo ? "rgba(126,163,186,0.14)" : PALETA.tarjetaSuave;

    const franja = new Rectangle(`franjaRanking_${fila.perfilId}`);
    franja.width = "4px";
    franja.height = "62px";
    franja.thickness = 0;
    franja.background = color;
    franja.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    franja.isHitTestVisible = false;
    marco.addControl(franja);

    const puesto = new TextBlock(`puestoRanking_${fila.perfilId}`, `${fila.posicion}`);
    puesto.color = COLORES_PODIO[fila.posicion] ?? PALETA.rotulo;
    puesto.fontSize = TEXTO.destacado;
    puesto.fontWeight = "600";
    puesto.width = "48px";
    puesto.left = "22px";
    puesto.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    puesto.isHitTestVisible = false;
    marco.addControl(puesto);

    const nombre = new TextBlock(`nombreRanking_${fila.perfilId}`, fila.nombreCompleto);
    nombre.color = PALETA.titulo;
    nombre.fontSize = TEXTO.cuerpo;
    nombre.fontWeight = fila.soyYo ? "600" : "400";
    nombre.width = "300px";
    nombre.left = "78px";
    nombre.top = "-9px";
    nombre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nombre.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nombre.isHitTestVisible = false;
    marco.addControl(nombre);

    const detalle = new TextBlock(
      `detalleRanking_${fila.perfilId}`,
      `${fila.area || "—"} · ${fila.fasesAprobadas} de 5 fases · ${formatearDuracion(fila.segundosTotal)}`
    );
    detalle.color = PALETA.rotulo;
    detalle.fontSize = TEXTO.rotulo;
    detalle.width = "300px";
    detalle.left = "78px";
    detalle.top = "13px";
    detalle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    detalle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    detalle.isHitTestVisible = false;
    marco.addControl(detalle);

    const puntaje = new TextBlock(`puntajeRanking_${fila.perfilId}`, `${fila.puntajeTotal}`);
    puntaje.color = PALETA.titulo;
    puntaje.fontSize = TEXTO.destacado;
    puntaje.fontWeight = "600";
    puntaje.width = "120px";
    puntaje.left = "-24px";
    puntaje.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    puntaje.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    puntaje.isHitTestVisible = false;
    marco.addControl(puntaje);

    return marco;
  }
}