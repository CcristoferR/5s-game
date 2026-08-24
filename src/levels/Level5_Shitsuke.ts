import { Scene, MeshBuilder } from "@babylonjs/core";
import { Button, TextBlock, Control } from "@babylonjs/gui";
import { generarPuntosControlNivel5 } from "../core/AuditGenerator";
import { crearPuntoControl } from "../entities/AuditPoint";
import { mostrarInformeAuditoria } from "../ui/AuditReport";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { GameManager } from "../core/GameManager";
import { guardarResultadoNivel5 } from "../core/RankingStorage";
import { briefingsNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { HUD } from "../ui/HUD";

// ~9 segundos por punto de control, con un piso de 35s. La cantidad de
// puntos varía según cuántos ítems dejó el jugador en el checklist del
// Nivel 4 (más la señalización), así que el tiempo se adapta en vez de
// quedar fijo en 40s como antes.
const SEGUNDOS_POR_PUNTO = 9;
const TIEMPO_MINIMO_SEGUNDOS = 35;

// Umbral de aprobación de la auditoría: hay que detectar correctamente al
// menos el 70% de los puntos de control para aprobar — igual que en una
// auditoría real, no basta con "haber jugado el nivel". Este umbral es
// lo que decide si se llama a onCompletado() (y por lo tanto si se
// desbloquea el certificado).
const UMBRAL_APROBACION = 0.7;

export function cargarNivel5(
  scene: Scene,
  hud: HUD,
  onVolverMenu: () => void,
  onCompletado: () => void,
  onReintentar: () => void
) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // Mismo escenario que los cuatro niveles anteriores: el garaje de Bitplay.
  // En este nivel importa especialmente, porque la auditoría consiste en
  // recorrer el espacio que el jugador transformó — tiene que ser el mismo.
  void cargarGaraje(scene).catch((error) => console.error("[nivel5] garaje:", error));

  // Tres focos repartidos a lo largo del recorrido de auditoría: los puntos
  // de control se distribuyen por todo el garaje y ninguno puede quedar en
  // penumbra, o el jugador pierde tiempo buscando en vez de inspeccionando.
  iluminarInteriorGaraje(scene, [
    { z: -1.2, intensidad: 0.9 },
    { z: 0.8, intensidad: 0.85 },
    { z: 2.6, intensidad: 0.8 },
  ]);

  // Suelo invisible al ras del piso del garaje. Conserva el nombre "sueloN5"
  // porque main.ts lo busca así para indicarle a WebXR dónde se puede
  // teletransportar el jugador.
  const suelo = MeshBuilder.CreateGround("sueloN5", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // El mismo banco de trabajo de los otros niveles, en vez de una caja suelta:
  // el jugador está auditando el puesto que ordenó antes, así que tiene que
  // reconocerlo.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN5", ancho: 3, fondo: 1.4, z: -0.5 });

  // Los puntos de control se generan a partir del estándar que el
  // jugador construyó en el Nivel 4 (checklist + señalización), con
  // desviaciones sorteadas de nuevo en cada intento — así cumple lo que
  // pide la guía: "desviaciones introducidas aleatoriamente" sobre "el
  // checklist que él mismo ayudó a construir en el Nivel 4".
  const datosControl = generarPuntosControlNivel5(gameManager.getEstandarNivel4());
  const tiempoLimiteSegundos = Math.max(TIEMPO_MINIMO_SEGUNDOS, datosControl.length * SEGUNDOS_POR_PUNTO);

  const instruccion = new TextBlock(
    "instruccionNivel5",
    `🔍 Estás auditando el estándar que TÚ definiste en el Nivel 4. Click en la esfera si detectas un problema (click de nuevo para desmarcar). Necesitas ${Math.round(
      UMBRAL_APROBACION * 100
    )}% de aciertos para aprobar la auditoría.`
  );
  instruccion.color = "white";
  instruccion.fontSize = 14;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  instruccion.width = "560px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const contador = new TextBlock("contadorNivel5", `Marcados: 0/${datosControl.length}`);
  contador.color = "white";
  contador.fontSize = 15;
  contador.outlineWidth = 3;
  contador.outlineColor = "rgba(0,0,0,0.6)";
  contador.top = "150px";
  contador.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(contador);

  const puntos = datosControl.map((datos) =>
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

  // APERTURA DEL NIVEL
  //
  // Acá el arranque diferido no es un detalle: este nivel es contra reloj, y si
  // la cuenta regresiva corriera mientras el jugador lee el contexto, empezaría
  // la auditoría con tiempo ya perdido.
  let inicioNivel = performance.now();
  let corriendoTiempo = false;
  let finalizado = false;

  // El reloj muestra el tiempo completo mientras el jugador lee la apertura.
  hud.actualizarTiempoRestante(tiempoLimiteSegundos);

  // Sin micro-lección: a esta altura el jugador ya recorrió las cuatro fases,
  // y lo que le toca es aplicar el estándar que él mismo construyó.
  mostrarAperturaNivel(gui, 5, briefingsNiveles[5], null, () => {
    inicioNivel = performance.now();
    corriendoTiempo = true;
  });

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

    let aciertos = 0;
    let sumaCalificaciones = 0;
    const filas = datosControl.map((datos, i) => {
      const marcadoPorJugador = puntos[i].estaMarcado();
      const correcto = marcadoPorJugador === datos.tieneDesviacion;
      if (correcto) aciertos++;
      sumaCalificaciones += datos.calificacion;
      return { datos, marcadoPorJugador };
    });

    const tasaAcierto = aciertos / datosControl.length;
    const promedioCalificacion = sumaCalificaciones / datosControl.length;
    const aprobado = tasaAcierto >= UMBRAL_APROBACION;

    // El puntaje del minijuego premia la detección correcta del jugador
    // — no depende de si el área "salió buena o mala" (eso es al azar),
    // sino de qué tan buen auditor fue.
    const puntosBase = aciertos * 10;
    gameManager.sumarPuntos(puntosBase);
    gameManager.registrarResultadoAuditoriaN5({ promedioCalificacion, tasaAcierto, aprobado });

    // El Nivel 5 (y por lo tanto el 100% de madurez y el certificado)
    // solo se marca como completado si el jugador APRUEBA la auditoría.
    // Antes esto se llamaba siempre, sin importar el resultado — por eso
    // el certificado salía pasara lo que pasara.
    if (aprobado) {
      onCompletado();
    }

    const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);

    // Se guarda CUALQUIER intento (apruebes o no) — así el ranking
    // también sirve para ver tu propia mejora entre reintentos.
    guardarResultadoNivel5({ tasaAcierto, promedioCalificacion, segundos: segundosTotales });

    mostrarInformeAuditoria(gui, filas, () => {
      hud.mostrarResultadoAuditoria(aprobado, puntosBase, tasaAcierto, promedioCalificacion, segundosTotales, onVolverMenu, onReintentar);
    });
  }

  return { puntos };
}