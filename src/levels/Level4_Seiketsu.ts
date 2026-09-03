import { Scene, MeshBuilder, Vector3 } from "@babylonjs/core";
import {
  AdvancedDynamicTexture, TextBlock, Control, Rectangle, Button, ScrollViewer, StackPanel,
} from "@babylonjs/gui";
import { itemsNivel4, senalesNivel4, zonasSenalNivel4, type ZonaChecklist, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { crearFormaNivel4, crearFormaSenal } from "../entities/Level4Shapes";
import { crearTableroChecklist, crearPapeleraDescartar } from "../entities/ChecklistZones";
import { crearZonaSenal } from "../entities/SignageZone";
import { crearNPCWorker } from "../entities/NPCWorker";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearRotulo3D } from "../entities/Rotulo3D";
import { GameManager, type ItemChecklistConstruido, type SenalizacionConstruida } from "../core/GameManager";
import { HUD } from "../ui/HUD";
import { moverMalla, luegoDe } from "../core/Animacion";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { TEXTO, PALETA, altoDeTexto } from "../ui/EstiloUI";

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

  // Mismo escenario que los niveles 1 a 3: el garaje entregado por Bitplay.
  // No se le pasa el shadowGenerator porque tiene techo y su sombra dejaría
  // todo el interior a oscuras; la luz de adentro la pone iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel4] garaje:", error));

  // Dos focos: uno sobre el banco donde están las fichas y las señales, y otro
  // sobre el tablero del checklist y la papelera del fondo.
  iluminarInteriorGaraje(scene, [
    { z: -0.6, intensidad: 0.9 },
    { z: 1.6, intensidad: 0.8 },
  ]);

  // Utileria de fondo. Ver AmbienteNivel.ts: la cantidad y el tipo cambian
  // por nivel para acompanar lo que ensena cada S.
  ambientarNivel(scene, 4);

  // Suelo invisible al ras del piso del garaje. Se conserva el nombre
  // "sueloN4" porque main.ts lo busca así para decirle a WebXR sobre qué
  // superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("sueloN4", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // Banco de trabajo compartido con los niveles 1, 2 y 3.
  //
  // Antes este nivel armaba su propia mesa: una única caja a 0,85 m, sin patas
  // ni estructura. Sobre el piso de concreto del garaje se veía flotando en el
  // aire, y encima rompía la continuidad con el resto del juego — es el mismo
  // puesto de trabajo a lo largo de las cinco fases, así que tiene que ser el
  // mismo mueble.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN4", ancho: 4.6, fondo: 1.4, z: -0.5 });

  // --- Fase 1: tarjetas del checklist ---
  const items = itemsNivel4.map((datos, i) =>
    crearObjetoInteractable(scene, datos, (s, d) => crearFormaNivel4(s, d, i + 1))
  );

  const tableroChecklist = crearTableroChecklist(scene, posicionesZonas.checklist);
  const papeleraDescartar = crearPapeleraDescartar(scene, posicionesZonas.descartar);

  // Rótulos pintados sobre carteles dentro de la escena. Antes eran texto 2D
  // anclado a las mallas: al orbitar la cámara se juntaban en el centro de la
  // pantalla y se leían a través de las paredes del garaje.
  crearRotulo3D(
    scene,
    "zonaChecklist",
    "CHECKLIST — instrucciones claras",
    new Vector3(posicionesZonas.checklist, 1.92, 1.8),
    { ancho: 2.0, alto: 0.36, lineasMax: 2, colorFondo: "#1c3a29", colorBorde: "rgba(120,220,160,0.5)" }
  );

  crearRotulo3D(
    scene,
    "zonaDescartar",
    "DESCARTAR — ambiguas o irrelevantes",
    new Vector3(posicionesZonas.descartar, 1.12, 1.8),
    { ancho: 2.0, alto: 0.36, lineasMax: 2, colorFondo: "#3a1f1c", colorBorde: "rgba(230,140,120,0.5)" }
  );

  // --- Fase 2: señalética con códigos de color — ahora bien separada
  // en su propia zona del cuarto (z=3.0 spawn / z=4.2 zonas), lejos del
  // checklist, para que no se vean encimadas. ---
  const senales = senalesNivel4.map((datos) => crearObjetoInteractable(scene, datos, crearFormaSenal));

  // Realce al pasar el cursor, igual que en los Niveles 1 y 2. Las tarjetas y
  // las senales se apoyan sobre mobiliario que tambien responde al puntero:
  // sin el contorno hay que probar cual de todo lo que se ve se puede tomar.
  const realce = habilitarRealceAlPasar(scene, [
    ...items.map((o) => o.mesh),
    ...senales.map((o) => o.mesh),
  ]);
  zonasSenalNivel4.forEach((z) => crearZonaSenal(scene, gui, z.id, z.posicionX, Z_ZONA_SENAL, z.descripcion));

  // Nombre del color sobre cada ficha, como cartelito colgado de la propia
  // ficha: acompaña al objeto aunque el jugador lo arrastre.
  senales.forEach((senal) => {
    const rotulo = crearRotulo3D(
      scene,
      `ficha_${senal.datos.id}`,
      senal.datos.nombreVisible,
      new Vector3(0, 0.26, 0),
      // El cartelito de la ficha era de 0,6 x 0,16 m: la letra quedaba en 10 cm
      // y había que pegarse a la pantalla para leer de qué color era cada una.
      { ancho: 1.05, alto: 0.24, colorFondo: "#1d2227", colorBorde: "rgba(255,255,255,0.3)", mirarCamara: true }
    );
    rotulo.parent = senal.mesh;
  });

  const instruccion = new TextBlock(
    "instruccionNivel4",
    "Coloca las 5 tarjetas (checklist/descartar) al frente, y las 3 señales de color en el fondo. El resultado se revela al probar el estándar."
  );
  instruccion.color = "white";
  instruccion.fontSize = TEXTO.cuerpo;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  // Sin esto el bloque ocupa el alto completo de la pantalla y el texto
  // queda centrado verticalmente, ignorando su propio 'top'.
  instruccion.resizeToFit = true;
  instruccion.width = "540px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const progreso = new TextBlock("progresoNivel4", `Colocado: 0/${items.length + senales.length}`);
  progreso.color = "white";
  progreso.fontSize = TEXTO.cuerpo;
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
  textoLectura.fontSize = TEXTO.destacado;
  textoLectura.textWrapping = true;
  textoLectura.paddingLeft = "16px";
  textoLectura.paddingRight = "16px";
  panelLectura.addControl(textoLectura);

  const botonProbar = Button.CreateSimpleButton("btnProbarEstandar", "Probar estándar");
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
  etiquetaNpc.fontSize = TEXTO.cuerpo;
  etiquetaNpc.outlineWidth = 3;
  etiquetaNpc.outlineColor = "rgba(0,0,0,0.7)";
  etiquetaNpc.width = "220px";
  etiquetaNpc.height = "26px";
  etiquetaNpc.isVisible = false;
  gui.addControl(etiquetaNpc);
  // Se cuelga del anclaje sobre el casco, no de la raíz: la figura apoya en
  // el piso, así que atarla a la raíz dejaría el globo sobre las piernas.
  etiquetaNpc.linkWithMesh(npc.anclaEtiqueta);
  etiquetaNpc.linkOffsetY = -30;

  // APERTURA DEL NIVEL
  //
  // Primero se plantea la situación y la decisión a resolver, después el
  // concepto de la fase, y recién al cerrar todo eso empieza a correr el
  // nivel. Por eso el cronómetro arranca en false y se reinicia dentro de
  // arrancarNivel: si contara desde la carga, el tiempo de lectura entraría
  // en el puntaje y leer el contexto saldría caro.
  let inicioNivel = performance.now();
  let corriendoTiempo = false;

  function arrancarNivel(): void {
    // El cronómetro del ranking arranca junto con el del nivel: leer la
    // apertura no cuenta como tiempo de juego.
    GameManager.getInstance().iniciarCronometroNivel();
    inicioNivel = performance.now();
    corriendoTiempo = true;
  }

  mostrarAperturaNivel(
    scene,
    4,
    briefingsNiveles[4],
    microLeccionesNiveles[4],
    arrancarNivel
  );

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
      instruccion.text = "Todo colocado. Presiona 'Probar estándar' cuando estés listo — ahí se revela el resultado.";
    }
  }

  items.forEach((item) => {
    item.onAgarrar.add(() => {
      hud.ocultarFeedback();
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
      // fijar() en vez de isPickable: desmonta el arrastre y apaga tambien las
      // piezas hijas. Con isPickable solo en la raiz, hacer clic en una pieza
      // hija volvia a habilitar el arrastre de un objeto ya colocado.
      item.fijar();
      // Ya clasificada: deja de ofrecerse como agarrable.
      realce.quitar(item.mesh);

      // "Click" real: la tarjeta salta a un lugar ordenado junto a su
      // zona, en vez de quedarse donde se soltó al azar.
      // El acomodo va animado, igual que en los niveles 1 y 2. Antes saltaba de
      // golpe con copyFrom: el objeto desaparecía de la mano y reaparecía en su
      // sitio, sin que se viera el recorrido. Con la animación se entiende que
      // el juego lo acomodó, que es la lectura correcta.
      if (zonaMasCercana === "checklist") {
        const pos = POSICIONES_SNAP_CHECKLIST[contadorChecklist] ?? POSICIONES_SNAP_CHECKLIST[POSICIONES_SNAP_CHECKLIST.length - 1];
        moverMalla(scene, mesh, pos.clone(), 260);
        contadorChecklist++;
      } else {
        const pos = POSICIONES_SNAP_DESCARTAR[contadorDescartar] ?? POSICIONES_SNAP_DESCARTAR[POSICIONES_SNAP_DESCARTAR.length - 1];
        moverMalla(scene, mesh, pos.clone(), 260);
        contadorDescartar++;
      }

      hud.mostrarFeedback(true, "Instrucción ubicada — se evaluará al probar el estándar.", mesh.position.clone());
      verificarListoParaProbar();
    });
  });

  senales.forEach((senal) => {
    senal.onAgarrar.add(() => hud.ocultarFeedback());

    senal.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente || colocacionSenales.has(senal.datos.id)) return;

      const zonaMasCercana = zonasSenalNivel4.reduce((mejor, actual) =>
        Math.abs(mesh.position.x - actual.posicionX) < Math.abs(mesh.position.x - mejor.posicionX) ? actual : mejor
      );

      colocacionSenales.set(senal.datos.id, zonaMasCercana.id);
      // fijar() en vez de isPickable: desmonta el arrastre y apaga tambien las
      // piezas hijas. Con isPickable solo en la raiz, hacer clic en una pieza
      // hija volvia a habilitar el arrastre de un objeto ya colocado.
      senal.fijar();
      realce.quitar(senal.mesh);

      // "Click" real: la ficha encaja exactamente en el centro del
      // círculo punteado, como una pieza de shadow board de verdad.
      moverMalla(scene, mesh, new Vector3(zonaMasCercana.posicionX, 0.025, Z_ZONA_SENAL), 260);

      hud.mostrarFeedback(true, "Señal ubicada — se evaluará al probar el estándar.", mesh.position.clone());
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
      etiquetaNpc.text = npcExito ? "Estándar claro: pude seguirlo sin preguntar nada." : "Estándar ambiguo: no supe qué hacer en varios pasos.";
      etiquetaNpc.color = npcExito ? "#8be29a" : "#ff9a9a";

      luegoDe(scene, 1000, () => {
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

          // Pregunta de cierre: el nivel acaba de mostrar cómo falla un estándar
          // ambiguo con el operario, así que acá se pide reconocer cuál sirve.
          preguntarCierreDeNivel(gui, hud, 4, (cierre) => {
            // El panel sale enseguida. La explicación de la pregunta viaja adentro
            // de él, así que ya no hay que esperar a que se apague ningún cartel:
            // esta pausa es solo para que el cierre no se sienta abrupto.
            luegoDe(scene, 700, () => {
              hud.mostrarResultadoFinal("Nivel 4", puntosBase, bonusTiempo, segundosTotales, onVolverMenu, cierre);
            });
          });
        });
      });
    });
  }

  return { items, zonas: [tableroChecklist, papeleraDescartar], senales, npc };
}
function mostrarInformeEstandar(
  gui: AdvancedDynamicTexture,
  filas: FilaInformeEstandar[],
  totalCorrectos: number,
  onContinuar: () => void
): void {
  const fondo = new Rectangle("fondoInformeEstandar");
  fondo.width = "600px";
  fondo.height = "560px";
  fondo.cornerRadius = 14;
  fondo.thickness = 1;
  fondo.color = PALETA.borde;
  fondo.background = PALETA.tarjeta;
  fondo.zIndex = 45;
  gui.addControl(fondo);

  const tasaPct = Math.round((totalCorrectos / filas.length) * 100);
  // Encabezado en dos alturas: el rótulo dice QUÉ se está midiendo y la cifra
  // es el dato. Antes iba todo en una sola frase larga, así que el porcentaje
  // —lo único que se busca al abrir esto— quedaba enterrado en el medio.
  const rotuloInforme = new TextBlock("rotuloInformeEstandar", "TASA DE ÉXITO DEL OPERARIO");
  rotuloInforme.color = PALETA.rotulo;
  rotuloInforme.fontSize = TEXTO.rotulo;
  rotuloInforme.fontWeight = "700";
  rotuloInforme.height = "18px";
  rotuloInforme.top = "22px";
  rotuloInforme.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(rotuloInforme);

  const titulo = new TextBlock("tituloInformeEstandar", `${tasaPct}%`);
  titulo.color = tasaPct >= 70 ? PALETA.acierto : PALETA.aviso;
  titulo.fontSize = TEXTO.mayor;
  titulo.fontWeight = "700";
  titulo.height = "42px";
  titulo.top = "44px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(titulo);

  const detalle = new TextBlock(
    "detalleInformeEstandar",
    `${totalCorrectos} de ${filas.length} elementos bien ubicados`
  );
  detalle.color = PALETA.cuerpo;
  detalle.fontSize = TEXTO.menor;
  detalle.height = "22px";
  detalle.top = "88px";
  detalle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(detalle);

  const scroll = new ScrollViewer("scrollInformeEstandar");
  scroll.width = "560px";
  scroll.height = "336px";
  scroll.barColor = PALETA.tenue;
  scroll.barBackground = PALETA.tarjetaSuave;
  scroll.thickness = 0;
  scroll.top = "124px";
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(scroll);

  const lista = new StackPanel("listaInformeEstandar");
  lista.isVertical = true;
  lista.width = "540px";
  scroll.addControl(lista);

  filas.forEach((fila, i) => {
    const color = fila.correcto ? PALETA.acierto : PALETA.error;

    const fondoFila = new Rectangle(`filaInformeEstandar_${i}`);
    fondoFila.width = "530px";
    fondoFila.thickness = 0;
    fondoFila.cornerRadius = 10;
    // Fondo TEÑIDO segun el resultado, no neutro.
    //
    // Antes las dos clases de fila compartian el mismo gris y se distinguian
    // por una franja de 4 px: en una lista de ocho renglones eso no se ve, y
    // era imposible saber de un vistazo cuantas estaban bien. Un tinte muy
    // suave separa los dos grupos sin taparle el sitio al texto.
    fondoFila.background = fila.correcto ? "rgba(127,180,149,0.10)" : "rgba(201,141,128,0.10)";
    fondoFila.paddingBottom = "10px";
    lista.addControl(fondoFila);

    const franjaFila = new Rectangle(`franjaInformeEstandar_${i}`);
    franjaFila.width = "4px";
    franjaFila.height = "100%";
    franjaFila.thickness = 0;
    franjaFila.background = color;
    franjaFila.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    franjaFila.isHitTestVisible = false;
    fondoFila.addControl(franjaFila);

    // Columna interna: cada dato en su bloque, alineados a la izquierda.
    //
    // Antes los tres datos iban en un solo TextBlock separados por saltos de
    // linea, y como los TextBlock se centran por defecto, las tres lineas
    // quedaban centradas y de largos distintos. Una lista se recorre bajando
    // por un borde comun; centrada obliga a leerla entera.
    const columna = new StackPanel(`columnaInformeEstandar_${i}`);
    columna.isVertical = true;
    columna.width = "486px";
    columna.paddingTop = "14px";
    columna.paddingBottom = "14px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.left = "22px";
    columna.isHitTestVisible = false;
    fondoFila.addControl(columna);

    // Encabezado: simbolo, tipo y veredicto. El simbolo primero porque es lo
    // unico que hay que leer para contar aciertos, y no depende del color —
    // quien no distinga verde de rojo lo sigue viendo.
    const tipo = fila.tipo === "checklist" ? "Instrucción" : "Señal";
    const veredicto = fila.correcto ? "Bien ubicada" : "Mal ubicada";

    const encabezado = new TextBlock(
      `encabezadoInformeEstandar_${i}`,
      `${fila.correcto ? "\u2713" : "\u2715"}  ${tipo} · ${veredicto}`
    );
    encabezado.color = color;
    encabezado.fontSize = TEXTO.rotulo;
    encabezado.fontWeight = "700";
    encabezado.textWrapping = true;
    encabezado.resizeToFit = true;
    encabezado.width = "486px";
    encabezado.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    encabezado.isHitTestVisible = false;
    columna.addControl(encabezado);

    const separacionA = new Rectangle(`aireInformeA_${i}`);
    separacionA.width = "1px";
    separacionA.height = "7px";
    separacionA.thickness = 0;
    separacionA.background = "transparent";
    columna.addControl(separacionA);

    // El item, que es el dato principal: mas grande y en blanco.
    const texto = new TextBlock(`textoInformeEstandar_${i}`, fila.texto);
    texto.color = PALETA.titulo;
    texto.fontSize = TEXTO.menor;
    texto.fontWeight = "600";
    texto.textWrapping = true;
    texto.resizeToFit = true;
    texto.width = "486px";
    texto.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    texto.isHitTestVisible = false;
    columna.addControl(texto);

    const separacionB = new Rectangle(`aireInformeB_${i}`);
    separacionB.width = "1px";
    separacionB.height = "5px";
    separacionB.thickness = 0;
    separacionB.background = "transparent";
    columna.addControl(separacionB);

    // El porque, en gris: acompana pero no compite con el item.
    const explicacion = new TextBlock(`explicacionInformeEstandar_${i}`, fila.explicacion);
    explicacion.color = PALETA.cuerpo;
    explicacion.fontSize = TEXTO.rotulo;
    explicacion.textWrapping = true;
    explicacion.resizeToFit = true;
    explicacion.width = "486px";
    explicacion.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    explicacion.isHitTestVisible = false;
    columna.addControl(explicacion);

    // Alto de la fila SEGUN su contenido.
    //
    // Estaba fijo en 72 px con tres bloques de texto que se ajustan: cualquier
    // explicacion de dos renglones desbordaba y se recortaba por arriba, que
    // es por lo que se veian encabezados cortados a la mitad.
    // Alto estimado, NO medido.
    //
    // heightInPixels devuelve cero en este momento: la interfaz mide los
    // bloques al dibujar, no al crearlos, así que preguntarle acá dejaría
    // todas las filas aplastadas. altoDeTexto hace la cuenta redondeando
    // hacia arriba, que es el lado seguro — sobra aire en vez de faltar
    // renglón.
    fondoFila.height =
      altoDeTexto(`${fila.correcto ? "\u2713" : "\u2715"}  ${tipo} · ${veredicto}`, 486, TEXTO.rotulo) +
      altoDeTexto(fila.texto, 486, TEXTO.menor) +
      altoDeTexto(fila.explicacion, 486, TEXTO.rotulo) +
      12 +
      38 +
      "px";
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