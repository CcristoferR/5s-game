import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3 } from "@babylonjs/core";
import {
  AdvancedDynamicTexture, TextBlock, Control, Rectangle, Button, ScrollViewer, StackPanel,
} from "@babylonjs/gui";
import { itemsNivel4, senalesNivel4, zonasSenalNivel4, type ZonaChecklist } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearFormaNivel4, crearFormaSenal } from "../entities/Level4Shapes";
import { crearTableroChecklist, crearPapeleraDescartar } from "../entities/ChecklistZones";
import { crearZonaSenal } from "../entities/SignageZone";
import { crearNPCWorker } from "../entities/NPCWorker";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { GameManager, type ItemChecklistConstruido, type SenalizacionConstruida } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const posicionesZonas: Record<ZonaChecklist, number> = {
  checklist: -3.6,
  descartar: 3.6,
};

// Posiciones "click" para cada checklist correcto: se acomodan en una
// fila ordenada junto al tablero (máximo 2 correctos según los datos).
const POSICIONES_SNAP_CHECKLIST: Vector3[] = [
  new Vector3(-3.6, 1.55, 1.79),
  new Vector3(-3.6, 1.4, 1.79),
];

// Posiciones "click" para cada descarte correcto: se acomodan dentro de
// la papelera (máximo 3 correctos según los datos).
const POSICIONES_SNAP_DESCARTAR: Vector3[] = [
  new Vector3(3.5, 0.55, 1.75),
  new Vector3(3.65, 0.45, 1.85),
  new Vector3(3.55, 0.35, 1.8),
];

const Z_ZONA_SENAL = 4.2;

interface FilaInformeEstandar {
  tipo: "checklist" | "senal";
  texto: string;
  correcto: boolean;
  explicacion: string;
}

export function cargarNivel4(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN4", { width: 12, height: 12 }, scene);
  const matSuelo = new PBRMaterial("matSueloN4", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN4", { width: 4.6, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorioN4", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  // --- Fase 1: tarjetas del checklist ---
  const items = itemsNivel4.map((datos, i) =>
    crearObjetoInteractable(scene, datos, (s, d) => crearFormaNivel4(s, d, i + 1))
  );

  const tableroChecklist = crearTableroChecklist(scene, posicionesZonas.checklist);
  const papeleraDescartar = crearPapeleraDescartar(scene, posicionesZonas.descartar);

  const etiquetaChecklist = new TextBlock("etiquetaZonaChecklist", "✅ CHECKLIST\n(instrucciones claras)");
  etiquetaChecklist.color = "white";
  etiquetaChecklist.fontSize = 16;
  etiquetaChecklist.outlineWidth = 4;
  etiquetaChecklist.outlineColor = "rgba(0,0,0,0.85)";
  etiquetaChecklist.width = "160px";
  etiquetaChecklist.height = "50px";
  gui.addControl(etiquetaChecklist);
  etiquetaChecklist.linkWithMesh(tableroChecklist);
  etiquetaChecklist.linkOffsetY = -90;

  const etiquetaDescartar = new TextBlock("etiquetaZonaDescartar", "🗑️ DESCARTAR\n(ambiguas o irrelevantes)");
  etiquetaDescartar.color = "white";
  etiquetaDescartar.fontSize = 16;
  etiquetaDescartar.outlineWidth = 4;
  etiquetaDescartar.outlineColor = "rgba(0,0,0,0.85)";
  etiquetaDescartar.width = "170px";
  etiquetaDescartar.height = "50px";
  gui.addControl(etiquetaDescartar);
  etiquetaDescartar.linkWithMesh(papeleraDescartar);
  etiquetaDescartar.linkOffsetY = -70;

  // --- Fase 2: señalética con códigos de color — ahora bien separada
  // en su propia zona del cuarto (z=3.0 spawn / z=4.2 zonas), lejos del
  // checklist, para que no se vean encimadas. ---
  const senales = senalesNivel4.map((datos) => crearObjetoInteractable(scene, datos, crearFormaSenal));
  zonasSenalNivel4.forEach((z) => crearZonaSenal(scene, gui, z.id, z.posicionX, Z_ZONA_SENAL, z.descripcion));

  // Etiqueta con el nombre del color sobre cada ficha — así se distingue
  // sin dudas del checklist numerado, aunque estén en el mismo cuadro.
  senales.forEach((senal) => {
    const etiquetaFicha = new TextBlock(`etiquetaFicha_${senal.datos.id}`, senal.datos.nombreVisible);
    etiquetaFicha.color = "white";
    etiquetaFicha.fontSize = 13;
    etiquetaFicha.outlineWidth = 3;
    etiquetaFicha.outlineColor = "rgba(0,0,0,0.75)";
    etiquetaFicha.width = "90px";
    etiquetaFicha.height = "24px";
    gui.addControl(etiquetaFicha);
    etiquetaFicha.linkWithMesh(senal.mesh);
    etiquetaFicha.linkOffsetY = -25;
  });

  mostrarMicroLeccionEstandar(gui);

  const instruccion = new TextBlock(
    "instruccionNivel4",
    "📋🎨 Coloca las 5 tarjetas (checklist/descartar) al frente, y las 3 señales de color en el fondo. El resultado se revela al probar el estándar."
  );
  instruccion.color = "white";
  instruccion.fontSize = 14;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  instruccion.width = "540px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const progreso = new TextBlock("progresoNivel4", `Colocado: 0/${items.length + senales.length}`);
  progreso.color = "white";
  progreso.fontSize = 15;
  progreso.outlineWidth = 3;
  progreso.outlineColor = "rgba(0,0,0,0.6)";
  progreso.top = "110px";
  progreso.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(progreso);

  const panelLectura = new Rectangle("panelLectura");
  panelLectura.width = "480px";
  panelLectura.height = "110px";
  panelLectura.cornerRadius = 12;
  panelLectura.thickness = 0;
  panelLectura.background = "rgba(20, 20, 25, 0.9)";
  panelLectura.top = "150px";
  panelLectura.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panelLectura.isVisible = false;
  gui.addControl(panelLectura);

  const textoLectura = new TextBlock("textoLectura", "");
  textoLectura.color = "white";
  textoLectura.fontSize = 20;
  textoLectura.textWrapping = true;
  textoLectura.paddingLeft = "16px";
  textoLectura.paddingRight = "16px";
  panelLectura.addControl(textoLectura);

  const botonProbar = Button.CreateSimpleButton("btnProbarEstandar", "🧪 Probar estándar");
  botonProbar.width = "240px";
  botonProbar.height = "50px";
  botonProbar.color = "white";
  botonProbar.cornerRadius = 10;
  botonProbar.thickness = 0;
  botonProbar.background = "#3a5a7a";
  botonProbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  botonProbar.top = "-24px";
  botonProbar.isVisible = false;
  gui.addControl(botonProbar);

  const npc = crearNPCWorker(scene);

  const etiquetaNpc = new TextBlock("etiquetaNpc", "");
  etiquetaNpc.color = "white";
  etiquetaNpc.fontSize = 15;
  etiquetaNpc.outlineWidth = 3;
  etiquetaNpc.outlineColor = "rgba(0,0,0,0.7)";
  etiquetaNpc.width = "220px";
  etiquetaNpc.height = "26px";
  etiquetaNpc.isVisible = false;
  gui.addControl(etiquetaNpc);
  etiquetaNpc.linkWithMesh(npc.mesh);
  etiquetaNpc.linkOffsetY = -55;

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  const colocacionItems = new Map<string, ZonaChecklist>();
  const colocacionSenales = new Map<string, string>();
  let contadorChecklist = 0;
  let contadorDescartar = 0;

  function verificarListoParaProbar(): void {
    const total = items.length + senales.length;
    const colocados = colocacionItems.size + colocacionSenales.size;
    progreso.text = `Colocado: ${colocados}/${total}`;

    if (colocados === total) {
      botonProbar.isVisible = true;
      instruccion.text = "✅ Todo colocado. Presiona 'Probar estándar' cuando estés listo — ahí se revela el resultado.";
    }
  }

  items.forEach((item) => {
    item.onAgarrar.add(() => {
      textoLectura.text = item.datos.textoVisible;
      panelLectura.isVisible = true;
    });

    item.onSoltar.add(({ mesh, movioSuficiente }) => {
      panelLectura.isVisible = false;
      if (!movioSuficiente || colocacionItems.has(item.datos.id)) return;

      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaChecklist, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      colocacionItems.set(item.datos.id, zonaMasCercana);
      mesh.isPickable = false;

      // "Click" real: la tarjeta salta a un lugar ordenado junto a su
      // zona, en vez de quedarse donde se soltó al azar.
      if (zonaMasCercana === "checklist") {
        const pos = POSICIONES_SNAP_CHECKLIST[contadorChecklist] ?? POSICIONES_SNAP_CHECKLIST[POSICIONES_SNAP_CHECKLIST.length - 1];
        mesh.position.copyFrom(pos);
        contadorChecklist++;
      } else {
        const pos = POSICIONES_SNAP_DESCARTAR[contadorDescartar] ?? POSICIONES_SNAP_DESCARTAR[POSICIONES_SNAP_DESCARTAR.length - 1];
        mesh.position.copyFrom(pos);
        contadorDescartar++;
      }

      hud.mostrarFeedback(true, "📌 Instrucción ubicada — se evaluará al probar el estándar.");
      verificarListoParaProbar();
    });
  });

  senales.forEach((senal) => {
    senal.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente || colocacionSenales.has(senal.datos.id)) return;

      const zonaMasCercana = zonasSenalNivel4.reduce((mejor, actual) =>
        Math.abs(mesh.position.x - actual.posicionX) < Math.abs(mesh.position.x - mejor.posicionX) ? actual : mejor
      );

      colocacionSenales.set(senal.datos.id, zonaMasCercana.id);
      mesh.isPickable = false;

      // "Click" real: la ficha encaja exactamente en el centro del
      // círculo punteado, como una pieza de shadow board de verdad.
      mesh.position.set(zonaMasCercana.posicionX, 0.025, Z_ZONA_SENAL);

      hud.mostrarFeedback(true, "🎨 Señal ubicada — se evaluará al probar el estándar.");
      verificarListoParaProbar();
    });
  });

  botonProbar.onPointerUpObservable.add(() => {
    botonProbar.isVisible = false;
    instruccion.isVisible = false;
    progreso.isVisible = false;
    ejecutarPrueba();
  });

  function ejecutarPrueba(): void {
    const filasChecklist: FilaInformeEstandar[] = itemsNivel4.map((datos) => {
      const zonaElegida = colocacionItems.get(datos.id)!;
      return {
        tipo: "checklist",
        texto: datos.textoVisible,
        correcto: zonaElegida === datos.zonaCorrecta,
        explicacion: datos.explicacion,
      };
    });

    const filasSenales: FilaInformeEstandar[] = zonasSenalNivel4.map((zona) => {
      const senalColocadaId = [...colocacionSenales.entries()].find(([, zonaId]) => zonaId === zona.id)?.[0];
      const senalColocada = senalesNivel4.find((s) => s.id === senalColocadaId);
      const correcto = senalColocadaId === zona.colorCorrectoId;
      const colorEsperado = senalesNivel4.find((s) => s.id === zona.colorCorrectoId)?.nombreVisible ?? "";
      return {
        tipo: "senal",
        texto: zona.descripcion,
        correcto,
        explicacion: correcto
          ? `Correcto — ${senalColocada?.nombreVisible ?? "la señal"} es el color adecuado para esta zona.`
          : `Incorrecto — esta zona requería el color ${colorEsperado}.`,
      };
    });

    // Se guarda el estándar que el jugador construyó (aciertos Y errores
    // incluidos) para que el Nivel 5 audite exactamente esto — sin esto,
    // el Nivel 5 no tiene forma de saber "el checklist que él mismo
    // ayudó a construir en el Nivel 4".
    const checklistConstruido: ItemChecklistConstruido[] = itemsNivel4
      .filter((datos) => colocacionItems.get(datos.id) === "checklist")
      .map((datos) => ({
        id: datos.id,
        texto: datos.textoVisible,
        esValido: datos.zonaCorrecta === "checklist",
      }));

    const senalizacionConstruida: SenalizacionConstruida[] = zonasSenalNivel4.map((zona) => {
      const senalId = [...colocacionSenales.entries()].find(([, zonaId]) => zonaId === zona.id)?.[0] ?? "";
      return {
        zonaId: zona.id,
        zonaDescripcion: zona.descripcion,
        colorElegidoId: senalId,
        esCorrecta: senalId === zona.colorCorrectoId,
      };
    });

    gameManager.guardarEstandarNivel4({ checklist: checklistConstruido, senalizacion: senalizacionConstruida });

    const todasLasFilas = [...filasChecklist, ...filasSenales];
    const totalCorrectos = todasLasFilas.filter((f) => f.correcto).length;
    const tasaExito = totalCorrectos / todasLasFilas.length;
    const npcExito = tasaExito >= 0.75;

    corriendoTiempo = false;

    npc.caminarHacia(new Vector3(posicionesZonas.checklist, 0.6, 1.8), 2, () => {
      npc.reaccionar(npcExito);
      etiquetaNpc.isVisible = true;
      etiquetaNpc.text = npcExito ? "✅ ¡Estándar claro, lo apliqué sin problemas!" : "❌ El estándar es ambiguo, no supe qué hacer";
      etiquetaNpc.color = npcExito ? "#8be29a" : "#ff9a9a";

      setTimeout(() => {
        etiquetaNpc.isVisible = false;

        mostrarInformeEstandar(gui, todasLasFilas, totalCorrectos, () => {
          const puntosChecklist = filasChecklist.filter((f) => f.correcto).length * 10;
          const puntosSenales = filasSenales.filter((f) => f.correcto).length * 15;
          const bonusNpc = npcExito ? 20 : 0;
          const puntosBase = puntosChecklist + puntosSenales + bonusNpc;
          gameManager.sumarPuntos(puntosBase);

          const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
          const bonusTiempo = Math.max(0, 110 - segundosTotales);
          gameManager.sumarPuntos(bonusTiempo);
          onCompletado();

          hud.mostrarResultadoFinal("Nivel 4", puntosBase, bonusTiempo, segundosTotales, onVolverMenu);
        });
      }, 2200);
    });
  }

  return { items, zonas: [tableroChecklist, papeleraDescartar], senales };
}

function mostrarMicroLeccionEstandar(gui: AdvancedDynamicTexture): void {
  const panel = new Rectangle("microLeccionEstandar");
  panel.width = "480px";
  panel.height = "240px";
  panel.cornerRadius = 14;
  panel.thickness = 1;
  panel.color = "rgba(255,255,255,0.2)";
  panel.background = "rgba(18, 20, 24, 0.95)";
  panel.zIndex = 25;
  gui.addControl(panel);

  const titulo = new TextBlock("tituloMicroLeccionN4", "🎯 Estandarizar = hacerlo replicable");
  titulo.color = "white";
  titulo.fontSize = 18;
  titulo.top = "-85px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(titulo);

  const texto = new TextBlock(
    "textoMicroLeccionN4",
    "Un buen estándar (checklist + señalética de color) debe ser tan claro que cualquiera pueda seguirlo sin ayuda. En este nivel, un NPC pondrá a prueba tu estándar — si es ambiguo, fallará."
  );
  texto.color = "rgba(255,255,255,0.9)";
  texto.fontSize = 14;
  texto.textWrapping = true;
  texto.width = "430px";
  texto.top = "5px";
  texto.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(texto);

  const boton = Button.CreateSimpleButton("btnCerrarMicroLeccionN4", "Entendido");
  boton.width = "160px";
  boton.height = "42px";
  boton.color = "white";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = "#2e7d46";
  boton.top = "-16px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    panel.isVisible = false;
  });
  panel.addControl(boton);
}

function mostrarInformeEstandar(
  gui: AdvancedDynamicTexture,
  filas: FilaInformeEstandar[],
  totalCorrectos: number,
  onContinuar: () => void
): void {
  const fondo = new Rectangle("fondoInformeEstandar");
  fondo.width = "600px";
  fondo.height = "540px";
  fondo.cornerRadius = 14;
  fondo.thickness = 1;
  fondo.color = "rgba(255,255,255,0.15)";
  fondo.background = "rgba(15, 18, 22, 0.98)";
  fondo.zIndex = 45;
  gui.addControl(fondo);

  const tasaPct = Math.round((totalCorrectos / filas.length) * 100);
  const titulo = new TextBlock("tituloInformeEstandar", `📋 Tasa de éxito del NPC: ${tasaPct}% (${totalCorrectos}/${filas.length})`);
  titulo.color = "white";
  titulo.fontSize = 19;
  titulo.textWrapping = true;
  titulo.height = "55px";
  titulo.top = "16px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(titulo);

  const scroll = new ScrollViewer("scrollInformeEstandar");
  scroll.width = "560px";
  scroll.height = "350px";
  scroll.barColor = "rgba(255,255,255,0.4)";
  scroll.top = "78px";
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(scroll);

  const lista = new StackPanel("listaInformeEstandar");
  lista.isVertical = true;
  lista.width = "540px";
  scroll.addControl(lista);

  filas.forEach((fila, i) => {
    const fondoFila = new Rectangle(`filaInformeEstandar_${i}`);
    fondoFila.width = "530px";
    fondoFila.height = "72px";
    fondoFila.thickness = 0;
    fondoFila.cornerRadius = 8;
    fondoFila.background = fila.correcto ? "rgba(30, 100, 50, 0.5)" : "rgba(110, 30, 30, 0.5)";
    fondoFila.paddingBottom = "8px";
    lista.addControl(fondoFila);

    const icono = fila.tipo === "checklist" ? "📋" : "🎨";
    const textoFila = new TextBlock(
      `textoInformeEstandar_${i}`,
      `${fila.correcto ? "✅" : "❌"} ${icono} ${fila.texto}\n${fila.explicacion}`
    );
    textoFila.color = "white";
    textoFila.fontSize = 13;
    textoFila.textWrapping = true;
    textoFila.paddingLeft = "10px";
    textoFila.paddingRight = "10px";
    fondoFila.addControl(textoFila);
  });

  const boton = Button.CreateSimpleButton("btnContinuarInformeEstandar", "Ver puntaje final");
  boton.width = "220px";
  boton.height = "46px";
  boton.color = "white";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = "#2e7d46";
  boton.top = "-16px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    fondo.isVisible = false;
    onContinuar();
  });
  fondo.addControl(boton);
}