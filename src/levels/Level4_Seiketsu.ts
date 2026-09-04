import { Scene, MeshBuilder, Vector3, Mesh, AbstractMesh } from "@babylonjs/core";
import {
  AdvancedDynamicTexture, TextBlock, Control, Rectangle, Button, ScrollViewer, StackPanel,
} from "@babylonjs/gui";
import {
  conectoresNivel4,
  puertosNivel4,
  marcasNivel4,
  zonasPisoNivel4,
  circuitosNivel4,
  coloresNivel4,
  briefingsNiveles,
  microLeccionesNiveles,
  type MarcaNivel4,
  type ColorNivel4,
} from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { crearConector, crearMarcaPiso, crearFichaColor } from "../entities/Level4Shapes";
import {
  crearArmarioConectores,
  crearZonasPiso,
  crearPanelInterruptores,
} from "../entities/ControlVisual";
import { crearNPCWorker } from "../entities/NPCWorker";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { GameManager, type ItemChecklistConstruido, type SenalizacionConstruida } from "../core/GameManager";
import { HUD } from "../ui/HUD";
import { moverMalla, luegoDe } from "../core/Animacion";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { reproducir } from "../core/Sonido";
import { TEXTO, PALETA, altoDeTexto } from "../ui/EstiloUI";
import type { PuntoEnganche } from "../core/InputController";

// ===========================================================================
// NIVEL 4 — SEIKETSU (Estandarizar)
// ===========================================================================
//
// ─── EL FALLO DE FONDO QUE TENÍA ──────────────────────────────────────────
//
// Se jugaba emparejando tarjetas de texto sobre una mesa: leer cinco frases y
// decidir cuáles eran instrucciones claras. Eso no es estandarizar, es un test
// de comprensión lectora con forma de juego. Y sobre todo, no deja nada en el
// taller: al terminar, el área estaba exactamente igual que al empezar.
//
// Estandarizar es lo contrario. Video 4.2 (1:32): "en el caso de la
// utilización del control visual emplearemos letreros, carteles, Andon,
// señalización de caminos, señales y Kanban". Son cosas que se INSTALAN en el
// entorno para que el orden se sostenga sin que nadie tenga que acordarse.
//
// ─── LO QUE HAY AHORA: TRES ESTACIONES, TRES GRADOS DE CONTROL ────────────
//
// El nivel no monta tres tareas distintas: monta el MISMO error tres veces,
// protegido cada vez por un control más débil. Ese orden es la lección, y es
// lo que el informe final pone en evidencia.
//
//   A. POKA-YOKE — el error es IMPOSIBLE.
//      Video 4.2 (2:38): "a prueba de tontos... un ejemplo es el de
//      rompecabezas donde una pieza solo encaja en un sitio específico". El
//      conector triangular no entra en el puerto cuadrado: el imán ni siquiera
//      engancha. No hay alarma porque no hace falta.
//
//   B. ANDON — el error es POSIBLE pero se avisa en el acto.
//      La plantilla equivocada sí se puede llevar a la zona equivocada. El
//      contorno parpadea en rojo, suena la chicharra y la pieza vuelve. Peor
//      que A: el error ocurre, y solo se corrige porque hay alguien mirando.
//
//   C. CONVENCIÓN DE COLOR — el error es POSIBLE y NADIE lo avisa.
//      Video 4.2 (5:29): "estos interruptores están señalizados según
//      colores... los focos pertenecientes a dichos interruptores están
//      señalizados con el mismo color". Se puede pegar la ficha azul en el
//      interruptor del banco y no pasa absolutamente nada: la instalación
//      sigue funcionando. Solo aparece cuando alguien audita — o sea, en el
//      Nivel 5.
//
// ─── EL ERROR QUE SOBREVIVE A LOS TRES ────────────────────────────────────
//
// Hay cuatro plantillas para tres zonas. Dos sirven para el pasillo: una dice
// "PASILLO · DESPEJADO 1,20 m" y la otra "ZONA ORDENADA". Las dos caen en el
// sitio correcto, así que el Andon no dice nada — una luz detecta una posición
// equivocada, no un texto vago. Es el único fallo del nivel que ningún control
// automático atrapa, y viaja al Nivel 5 como un punto de control que nunca se
// va a poder dar por cumplido.

/** Sitio de cada estación. Todo mira a -Z, que es de donde mira la cámara. */
const ARMARIO = { x: -3.2, z: 3.4 };
const PANEL_INTERRUPTORES = { x: 1.9, y: 1.35, z: 3.4 };

/** Recinto de arrastre. El imán se encarga de llegar a los sitios altos. */
const LIMITES = { xMin: -4.6, xMax: 4.6, zMin: -1.7, zMax: 2.9 };

/** Dónde arranca cada plantilla y cada ficha, repartidas por delante del banco. */
// Dos hileras ordenadas por delante, fuera del banco y de las tres zonas.
//
// Antes estaban desparramadas y dos fichas caian encima del banco. Puestas en
// fila se lee de un vistazo que hay CUATRO plantillas y CUATRO fichas para tres
// sitios cada una — o sea que sobra material y elegir es parte del trabajo.
const PARTIDA_MARCAS: Array<[number, number]> = [
  [-2.4, -1.5],
  [-0.9, -1.5],
  [0.6, -1.5],
  [2.1, -1.5],
];

const PARTIDA_FICHAS: Array<[number, number]> = [
  [-2.4, -0.7],
  [-0.9, -0.7],
  [0.6, -0.7],
  [2.1, -0.7],
];

/** Qué control protegía cada punto del estándar. Es la columna que enseña. */
type TipoControl = "poka-yoke" | "andon" | "convencion";

interface FilaInformeEstandar {
  control: TipoControl;
  texto: string;
  correcto: boolean;
  explicacion: string;
}

const ROTULO_CONTROL: Record<TipoControl, string> = {
  "poka-yoke": "Poka-Yoke · el error era imposible",
  andon: "Andon · el error se avisó al instante",
  convencion: "Convención de color · nada avisó",
};

/** Qué sitio está apuntando el cursor ahora mismo. */
type SitioApuntado =
  | { tipo: "puerto"; indice: number; encaja: boolean }
  | { tipo: "zona"; indice: number }
  | { tipo: "interruptor"; indice: number };

export function cargarNivel4(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // Mismo escenario que los niveles 1 a 3: el garaje entregado por Bitplay.
  // No se le pasa el shadowGenerator porque tiene techo y su sombra dejaría
  // todo el interior a oscuras; la luz de adentro la pone iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel4] garaje:", error));

  // Dos focos: uno sobre el banco donde arrancan las piezas y otro sobre la
  // fila de estaciones del fondo. Los focos de color de los circuitos los pone
  // crearPanelInterruptores, y son deliberadamente tenues para no competir.
  iluminarInteriorGaraje(scene, [
    { z: -0.6, intensidad: 0.85 },
    { z: 2.6, intensidad: 0.8 },
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

  // Banco de trabajo compartido con los niveles 1, 2, 3 y 5. Es el mismo
  // puesto a lo largo de las cinco fases: acá hace de mesa de trabajo desde la
  // que se reparten las piezas, y de zona del primer circuito de luz.
  // SIN BANCO DE TRABAJO EN ESTE NIVEL.
  //
  // Estaba de adorno y estorbaba. En el centro cortaba el camino entre las
  // piezas y las estaciones, y corriendolo al rincon seguia tapando la esquina
  // izquierda sin cumplir ninguna funcion: aqui no se apoya nada encima ni se
  // trabaja sobre el.
  //
  // Lo unico que lo sostenia era ser la zona del primer circuito de luz, y eso
  // se resolvio mejor sin el: los tres circuitos son ahora las tres areas
  // demarcadas del piso —pasillo, pallets y extintor—, que es la serie que el
  // jugador acaba de pintar con las plantillas. Cada foco cuelga sobre su area.
  //
  // El piso queda despejado de pared a pared, que es lo que este nivel
  // necesita: once piezas viajando desde el frente hasta el fondo.

  // === LAS TRES ESTACIONES ===============================================

  const armario = crearArmarioConectores(scene, ARMARIO.x, ARMARIO.z, 0, puertosNivel4);
  const pisos = crearZonasPiso(scene, zonasPisoNivel4);
  const panel = crearPanelInterruptores(
    scene,
    PANEL_INTERRUPTORES.x,
    PANEL_INTERRUPTORES.y,
    PANEL_INTERRUPTORES.z,
    0,
    circuitosNivel4,
    coloresNivel4
  );

  // === EL IMÁN ===========================================================
  //
  // Un rayo por cuadro cuyo predicado SOLO admite receptores: nada de la
  // escena puede interponerse, ni el garaje ni el propio mueble ni la pieza
  // que se lleva en la mano. Es el mismo mecanismo del Nivel 2.
  //
  // La diferencia está en quién engancha a quién, y ahí es donde vive la
  // lección del nivel: el puerto solo engancha su forma, la zona engancha
  // cualquier plantilla, y el interruptor engancha cualquier color.

  const receptores = new Map<AbstractMesh, SitioApuntado>();
  armario.puertos.forEach((puerto, indice) =>
    receptores.set(puerto.receptor, { tipo: "puerto", indice, encaja: false })
  );
  pisos.zonas.forEach((zona, indice) => receptores.set(zona.receptor, { tipo: "zona", indice }));
  panel.interruptores.forEach((interruptor, indice) =>
    receptores.set(interruptor.receptor, { tipo: "interruptor", indice })
  );

  let apuntado: SitioApuntado | null = null;

  const aviso = new TextBlock("avisoSitioNivel4", "");
  aviso.fontSize = TEXTO.destacado;
  aviso.fontWeight = "700";
  aviso.outlineWidth = 5;
  aviso.outlineColor = "rgba(0,0,0,0.85)";
  aviso.top = "-150px";
  aviso.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  aviso.isVisible = false;
  gui.addControl(aviso);

  const apagarAviso = (): void => {
    apuntado = null;
    aviso.isVisible = false;
    armario.resaltar(null);
    pisos.resaltar(null);
    panel.resaltar(null);
  };

  const mostrarAviso = (texto: string, color: string): void => {
    aviso.text = texto;
    aviso.color = color;
    aviso.isVisible = true;
  };

  /** El sitio bajo el cursor, sin filtrar por tipo de pieza. */
  const sitioBajoCursor = (): SitioApuntado | null => {
    const golpe = scene.pick(scene.pointerX, scene.pointerY, (m) => receptores.has(m));
    if (!golpe?.hit || !golpe.pickedMesh) return null;
    return receptores.get(golpe.pickedMesh) ?? null;
  };

  const enElPiso = (libre: Vector3, alzada: number): PuntoEnganche => ({
    punto: new Vector3(libre.x, alzada, libre.z),
    enElAire: false,
  });

  // === PIEZAS: CONECTORES (poka-yoke) ====================================

  const alzadas = new Map<Mesh, number>();
  const FACTOR_AGARRE = 1.15;
  const alzadaDe = (mesh: Mesh): number => (alzadas.get(mesh) ?? 0) * FACTOR_AGARRE;

  const conectores = conectoresNivel4.map((datos) => {
    const casilla: { mesh: Mesh | null } = { mesh: null };

    const objeto = crearObjetoInteractable(
      scene,
      datos,
      (s, d) => crearConector(s, d),
      LIMITES,
      (libre): PuntoEnganche | null => {
        const mesh = casilla.mesh;
        if (!mesh) return null;

        const sitio = sitioBajoCursor();

        // Solo los puertos existen para un conector. Apuntar a una zona de
        // piso o a un interruptor es como no apuntar a nada.
        if (!sitio || sitio.tipo !== "puerto") {
          if (apuntado) apagarAviso();
          // De vuelta de frente: la espiga tiene que verse para poder elegir.
          mesh.rotation.y = 0;
          return enElPiso(libre, alzadaDe(mesh));
        }

        const puerto = armario.puertos[sitio.indice];

        // ─── POKA-YOKE ────────────────────────────────────────────────────
        //
        // Aquí no hay validación al soltar: hay una forma que no entra. El
        // imán no engancha, el conector se queda en la mano y el aviso explica
        // por qué. Es la diferencia con el Andon de la estación siguiente —
        // allá el error ocurre y se señala; acá no llega a ocurrir.
        if (puerto.forma !== datos.forma || puerto.ocupado) {
          apuntado = { tipo: "puerto", indice: sitio.indice, encaja: false };
          armario.resaltar(null);
          pisos.resaltar(null);
          panel.resaltar(null);
          mostrarAviso(
            puerto.ocupado
              ? "Ese puerto ya está ocupado"
              : "No entra: la espiga no tiene la forma de ese puerto",
            "#e8c07a"
          );
          mesh.rotation.y = 0;
          return enElPiso(libre, alzadaDe(mesh));
        }

        apuntado = { tipo: "puerto", indice: sitio.indice, encaja: true };
        armario.resaltar(puerto.id);
        pisos.resaltar(null);
        panel.resaltar(null);
        mostrarAviso("Encaja aquí — suelta para conectar", "#a9e0bd");

        // Se da vuelta MIENTRAS se lo sostiene, no al soltarlo.
        //
        // El conector está modelado con la espiga hacia -Z, o sea hacia la
        // cámara: es a propósito, porque la FORMA de la espiga es la única
        // pista que tiene el jugador para saber en qué puerto va, y de espaldas
        // no se vería. Pero la cara frontal del armario también mira a -Z, así
        // que enchufarlo sin girarlo metía el rollo de cable dentro del tablero
        // y dejaba la punta metálica asomando hacia afuera.
        //
        // Girarlo acá y no en el traslado hace que el gesto se lea: la pieza
        // se da vuelta en el aire, delante del puerto, como cuando uno acomoda
        // un enchufe antes de meterlo.
        mesh.rotation.y = Math.PI;
        return { punto: puerto.sostenido, enElAire: true };
      }
    );

    casilla.mesh = objeto.mesh;
    objeto.mesh.position.set(datos.posicionInicial[0], 0, datos.posicionInicial[2]);
    apoyarSobre(objeto.mesh, 0);
    alzadas.set(objeto.mesh, objeto.mesh.position.y);
    return objeto;
  });

  // === PIEZAS: PLANTILLAS DE PINTURA (Andon) =============================

  type DatosMarca = MarcaNivel4 & { posicionInicial: [number, number, number] };

  const marcas = marcasNivel4.map((datos, i) => {
    const [px, pz] = PARTIDA_MARCAS[i] ?? [0, -1.2];
    const conPosicion: DatosMarca = { ...datos, posicionInicial: [px, 0, pz] };
    const casilla: { mesh: Mesh | null } = { mesh: null };

    const objeto = crearObjetoInteractable(
      scene,
      conPosicion,
      (s, d) => crearMarcaPiso(s, d),
      LIMITES,
      (libre): PuntoEnganche | null => {
        const mesh = casilla.mesh;
        if (!mesh) return null;

        const sitio = sitioBajoCursor();

        if (!sitio || sitio.tipo !== "zona") {
          if (apuntado) apagarAviso();
          return enElPiso(libre, alzadaDe(mesh));
        }

        const zona = pisos.zonas[sitio.indice];

        if (zona.pintada) {
          if (apuntado) apagarAviso();
          return enElPiso(libre, alzadaDe(mesh));
        }

        // ─── ANDON ────────────────────────────────────────────────────────
        //
        // La zona engancha CUALQUIER plantilla, también la que no le
        // corresponde. Es a propósito: el error tiene que poder cometerse para
        // que el Andon tenga algo que señalar. El aviso en pantalla dice a qué
        // zona se va a soltar, no si está bien — eso lo dirá la luz roja.
        apuntado = { tipo: "zona", indice: sitio.indice };
        armario.resaltar(null);
        pisos.resaltar(zona.id);
        panel.resaltar(null);
        mostrarAviso(
          `Marcar aquí: ${zonasPisoNivel4[sitio.indice].etiqueta}`,
          "#a9e0bd"
        );
        return { punto: zona.sostenido, enElAire: true };
      }
    );

    casilla.mesh = objeto.mesh;
    objeto.mesh.position.set(px, 0, pz);
    apoyarSobre(objeto.mesh, 0);
    alzadas.set(objeto.mesh, objeto.mesh.position.y);
    return objeto;
  });

  // === PIEZAS: FICHAS DE COLOR (convención) ==============================

  type DatosFicha = ColorNivel4 & { posicionInicial: [number, number, number] };

  const fichas = coloresNivel4.map((datos, i) => {
    const [px, pz] = PARTIDA_FICHAS[i] ?? [0, -1.3];
    const conPosicion: DatosFicha = { ...datos, posicionInicial: [px, 0, pz] };
    const casilla: { mesh: Mesh | null } = { mesh: null };

    const objeto = crearObjetoInteractable(
      scene,
      conPosicion,
      (s, d) => crearFichaColor(s, d),
      LIMITES,
      (libre): PuntoEnganche | null => {
        const mesh = casilla.mesh;
        if (!mesh) return null;

        const sitio = sitioBajoCursor();

        if (!sitio || sitio.tipo !== "interruptor") {
          if (apuntado) apagarAviso();
          return enElPiso(libre, alzadaDe(mesh));
        }

        const interruptor = panel.interruptores[sitio.indice];

        if (interruptor.ocupado) {
          if (apuntado) apagarAviso();
          return enElPiso(libre, alzadaDe(mesh));
        }

        // ─── CONVENCIÓN ───────────────────────────────────────────────────
        //
        // Cualquier ficha engancha en cualquier interruptor, y el aviso dice
        // el circuito pero NO si el color es el que va. No es un descuido: es
        // el punto de la estación. El único modo de acertar es haber ido a
        // mirar de qué color es el foco de ese circuito.
        apuntado = { tipo: "interruptor", indice: sitio.indice };
        armario.resaltar(null);
        pisos.resaltar(null);
        panel.resaltar(interruptor.id);
        // Dice el circuito Y el criterio. Es el unico momento en que hace
        // falta: cuando ya se tiene la ficha en la mano sobre el interruptor.
        mostrarAviso(
          `${circuitosNivel4[sitio.indice].descripcion} — pega el color del foco que enciende`,
          "#a9e0bd"
        );
        return { punto: interruptor.sostenido, enElAire: true };
      }
    );

    casilla.mesh = objeto.mesh;
    objeto.mesh.position.set(px, 0, pz);
    apoyarSobre(objeto.mesh, 0);
    alzadas.set(objeto.mesh, objeto.mesh.position.y);
    return objeto;
  });

  const arrastrables = [...conectores, ...marcas, ...fichas];
  const realce = habilitarRealceAlPasar(scene, arrastrables.map((o) => o.mesh));

  habilitarEtiquetasAlPasar(
    scene,
    gui,
    [
      ...conectores.map((o) => ({ mesh: o.mesh, texto: o.datos.nombreVisible })),
      ...marcas.map((o) => ({ mesh: o.mesh, texto: o.datos.nombreVisible })),
      ...fichas.map((o) => ({ mesh: o.mesh, texto: `Etiqueta ${o.datos.nombreVisible}` })),
    ]
  );

  // === PANTALLA ==========================================================

  // ─── GUÍA DE ESTACIONES ─────────────────────────────────────────────────
  //
  // Reemplaza al párrafo que había antes.
  //
  // Eran cinco renglones de prosa encima de la escena, y para saber qué hacer
  // había que leerlos enteros y acordarse. Este nivel tiene once piezas de tres
  // clases distintas y tres destinos distintos: es exactamente el caso en el
  // que un texto corrido no sirve, porque el jugador necesita consultar "y esto
  // dónde va" veinte veces, no leerlo una.
  //
  // Y hay algo más: este es el nivel de la GESTIÓN VISUAL. Explicar la gestión
  // visual con un muro de texto es predicar lo contrario de lo que se enseña.
  // Tres renglones, uno por estación, cada uno con QUÉ se mueve, ADÓNDE va y
  // cuántos llevas — y el renglón se pone verde y se tacha al terminarlo.
  // ─── EL PASO QUE FALTABA ────────────────────────────────────────────────
  //
  // La placa dice BANCO, pero saber DE QUE COLOR etiquetarla exige averiguar
  // cual de los tres focos del techo es el del banco — y estaban los tres
  // encendidos, a tres metros de altura. No habia forma de atarlos: solo
  // quedaba adivinar.
  //
  // Ahora se prueba la llave y se ve cual queda encendido. Es lo que hace
  // cualquiera frente a un tablero sin rotular, y es el argumento entero de la
  // 4S — Video 4.2 (5:29) manda señalizar interruptor y foco con el mismo color
  // PARA NO TENER QUE HACER ESTO NUNCA MAS. El jugador pasa por la molestia una
  // vez y despues instala el control que la elimina.
  //
  // El cartel se retira solo a los quince segundos: es una consigna de
  // arranque, no algo que tenga que estar ahi toda la partida.
  const pistaInterruptores = new TextBlock(
    "pistaInterruptoresNivel4",
    "¿No sabes qué foco es de cada interruptor? Haz clic en la llave: se apagan los demás."
  );
  pistaInterruptores.color = "#e8c07a";
  pistaInterruptores.fontSize = TEXTO.menor;
  pistaInterruptores.outlineWidth = 4;
  pistaInterruptores.outlineColor = "rgba(0,0,0,0.8)";
  pistaInterruptores.textWrapping = true;
  pistaInterruptores.resizeToFit = true;
  pistaInterruptores.width = "560px";
  pistaInterruptores.top = "-96px";
  pistaInterruptores.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  gui.addControl(pistaInterruptores);
  luegoDe(scene, 15000, () => {
    pistaInterruptores.isVisible = false;
  });

  const guia = crearGuiaEstaciones(gui, [
    { clave: "cables", pieza: "Cables", destino: "tablero" },
    { clave: "plantillas", pieza: "Plantillas", destino: "zonas del piso" },
    { clave: "etiquetas", pieza: "Etiquetas", destino: "interruptores" },
  ]);

  const TOTAL_TAREAS = puertosNivel4.length + zonasPisoNivel4.length + circuitosNivel4.length;
  hud.definirObjetivo("Deja el estándar instalado en el taller, no escrito en un papel.");
  hud.definirTotalTarea(TOTAL_TAREAS);

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
  etiquetaNpc.width = "260px";
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

  mostrarAperturaNivel(scene, 4, briefingsNiveles[4], microLeccionesNiveles[4], arrancarNivel);

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    hud.actualizarTiempo(Math.floor((performance.now() - inicioNivel) / 1000));
  });

  // === REGISTRO DE LO INSTALADO ==========================================

  /** zonaId -> id de la plantilla que quedó pintada ahí. */
  const marcaPorZona = new Map<string, string>();
  /** circuitoId -> id del color pegado en su interruptor. */
  const colorPorCircuito = new Map<string, string>();
  let conectadas = 0;

  function instalados(): number {
    return conectadas + marcaPorZona.size + colorPorCircuito.size;
  }

  function refrescarProgreso(): void {
    const hechos = instalados();
    hud.actualizarProgreso(hechos);

    guia.actualizar("cables", conectadas, puertosNivel4.length);
    guia.actualizar("plantillas", marcaPorZona.size, zonasPisoNivel4.length);
    guia.actualizar("etiquetas", colorPorCircuito.size, circuitosNivel4.length);

    if (hechos < TOTAL_TAREAS) return;

    botonProbar.isVisible = true;
    guia.cerrar(
      "Listo. Lo que quedó en el piso es el material que descartaste: no va a ningún sitio. " +
        "Pulsa 'Probar estándar' y entra un operario del turno siguiente."
    );
  }

  // --- Conectores ---------------------------------------------------------

  conectores.forEach((objeto, i) => {
    objeto.onAgarrar.add(() => hud.ocultarFeedback());

    objeto.onSoltar.add(({ mesh }) => {
      const sitio = apuntado;
      apagarAviso();

      // Solo se enchufa si el imán estaba enganchado, y el imán solo engancha
      // la forma correcta: no hay rama de error posible.
      if (!sitio || sitio.tipo !== "puerto" || !sitio.encaja) {
        apoyarSobre(mesh, 0);
        return;
      }

      const puerto = armario.puertos[sitio.indice];
      puerto.ocupado = true;
      conectadas++;

      objeto.fijar();
      realce.quitar(mesh);
      moverMalla(scene, mesh, puerto.anclaje, 220);

      gameManager.sumarPuntos(10);
      reproducir("acierto");
      hud.mostrarFeedback(true, conectoresNivel4[i].explicacion, mesh.position.clone());
      refrescarProgreso();
    });
  });

  // --- Plantillas ---------------------------------------------------------

  marcas.forEach((objeto) => {
    objeto.onAgarrar.add(() => hud.ocultarFeedback());

    objeto.onSoltar.add(({ mesh }) => {
      const sitio = apuntado;
      const datos = objeto.datos;
      apagarAviso();

      if (!sitio || sitio.tipo !== "zona") {
        apoyarSobre(mesh, 0);
        return;
      }

      const zona = pisos.zonas[sitio.indice];

      if (datos.zonaCorrecta !== zona.id) {
        // ANDON. La chicharra son tres golpes del efecto de error, uno por
        // destello: no hay un archivo de zumbador y encadenar el que ya existe
        // suena a alarma sin sumar ningún asset.
        pisos.avisarError(zona.id, () => reproducir("error"));
        hud.mostrarFeedback(
          false,
          `Esa plantilla no es de esta zona — el Andon lo señaló en el acto. El error llegó a ocurrir: por eso hizo falta una luz. ${datos.nombreVisible} va en otro sitio.`,
          mesh.position.clone()
        );
        moverMalla(scene, mesh, new Vector3(datos.posicionInicial[0], mesh.position.y, datos.posicionInicial[2]), 300);
        luegoDe(scene, 320, () => apoyarSobre(mesh, 0));
        return;
      }

      marcaPorZona.set(zona.id, datos.id);
      objeto.fijar();
      realce.quitar(mesh);

      moverMalla(scene, mesh, zona.anclaje, 260);
      luegoDe(scene, 300, () => {
        // La plantilla se retira y queda la pintura: es una plantilla, no un
        // cartel que se deja apoyado. No se destruye la malla —el generador de
        // sombras la tiene en su lista desde que se armó el nivel— sino que se
        // oculta, que consigue lo mismo sin tocar esa lista.
        mesh.isVisible = false;
        pisos.pintar(zona.id, datos.textoPintado);
      });

      gameManager.sumarPuntos(15);
      reproducir("acierto");
      hud.mostrarFeedback(true, datos.explicacion, mesh.position.clone());
      refrescarProgreso();
    });
  });

  // --- Fichas de color ----------------------------------------------------

  fichas.forEach((objeto) => {
    objeto.onAgarrar.add(() => hud.ocultarFeedback());

    objeto.onSoltar.add(({ mesh }) => {
      const sitio = apuntado;
      const datos = objeto.datos;
      apagarAviso();

      if (!sitio || sitio.tipo !== "interruptor") {
        apoyarSobre(mesh, 0);
        return;
      }

      const interruptor = panel.interruptores[sitio.indice];
      interruptor.ocupado = true;
      colorPorCircuito.set(interruptor.id, datos.id);

      objeto.fijar();
      realce.quitar(mesh);

      moverMalla(scene, mesh, interruptor.anclaje, 220);
      luegoDe(scene, 260, () => {
        mesh.isVisible = false;
        panel.rotular(interruptor.id, datos);
      });

      // NI ACIERTO NI ERROR. Suena el "panel", que es un acuse neutro, y el
      // texto no dice si está bien. Es lo que separa esta estación de las
      // otras dos: acá el sistema no sabe si lo hiciste bien, y por eso
      // tampoco puede avisarte.
      gameManager.sumarPuntos(10);
      reproducir("panel");
      hud.mostrarFeedback(
        true,
        "Interruptor señalizado. Nada comprueba que el color sea el del foco de ese circuito: eso solo se ve auditando.",
        mesh.position.clone()
      );
      refrescarProgreso();
    });
  });

  // === PRUEBA DEL ESTÁNDAR ===============================================

  botonProbar.onPointerUpObservable.add(() => {
    botonProbar.isVisible = false;
    guia.ocultar();
    ejecutarPrueba();
  });

  function ejecutarPrueba(): void {
    const filas: FilaInformeEstandar[] = [];

    // A — Poka-Yoke. Siempre correcto, y ese es el dato: cuando el control es
    // por geometría no hay resultado que evaluar.
    filas.push({
      control: "poka-yoke",
      texto: "Los tres equipos conectados en su puerto codificado por forma",
      correcto: true,
      explicacion:
        "No hubo forma de equivocarse: cada espiga solo entraba en su puerto. Es el control más fuerte porque no depende de que nadie mire.",
    });

    // B — Andon. Lo que quedó pintado, con la salvedad del texto vago.
    zonasPisoNivel4.forEach((zona) => {
      const marcaId = marcaPorZona.get(zona.id);
      const datos = marcasNivel4.find((m) => m.id === marcaId);
      if (!datos) return;

      filas.push({
        control: "andon",
        texto: datos.textoPintado,
        correcto: datos.esEspecifica,
        explicacion: datos.explicacion,
      });
    });

    // C — Convención de color. Acá sí hay aciertos y errores, y nada los avisó
    // en su momento.
    circuitosNivel4.forEach((circuito) => {
      const elegidoId = colorPorCircuito.get(circuito.id) ?? "";
      const elegido = coloresNivel4.find((c) => c.id === elegidoId);
      const esperado = coloresNivel4.find((c) => c.id === circuito.colorCorrectoId);
      const correcto = elegidoId === circuito.colorCorrectoId;

      filas.push({
        control: "convencion",
        texto: `${circuito.descripcion} → etiqueta ${elegido?.nombreVisible ?? "sin asignar"}`,
        correcto,
        explicacion: correcto
          ? `El interruptor lleva el mismo color que su foco. Cualquiera puede cortar el circuito correcto sin probar los tres.`
          : `El foco de este circuito es ${esperado?.nombreVisible ?? "de otro color"}. Nada lo impidió y nada lo avisó: la instalación funciona igual, y el fallo solo sale en una auditoría.`,
      });
    });

    // Se guarda el estándar que el jugador construyó (aciertos Y errores
    // incluidos) para que el Nivel 5 audite exactamente esto — sin esto,
    // el Nivel 5 no tiene forma de saber "el checklist que él mismo
    // ayudó a construir en el Nivel 4".
    //
    // El checklist son ahora los controles que quedaron INSTALADOS, no
    // tarjetas que el jugador clasificó. Cada punto pintado en el piso se
    // vuelve un punto de control auditable, con el texto que él mismo eligió
    // dejar escrito — que es literalmente "el checklist que ayudó a construir".
    const checklist: ItemChecklistConstruido[] = [
      {
        id: "chk_conexiones",
        texto: "Cada equipo conectado en su puerto codificado por forma",
        esValido: true,
      },
      ...zonasPisoNivel4.flatMap((zona) => {
        const datos = marcasNivel4.find((m) => m.id === marcaPorZona.get(zona.id));
        if (!datos) return [];
        return [
          {
            id: `chk_${zona.id}`,
            texto: datos.textoPintado,
            // Un texto sin medida no se puede dar por cumplido. Es el único
            // fallo que ningún control del nivel atrapó, y llega vivo al 5.
            esValido: datos.esEspecifica,
          },
        ];
      }),
    ];

    const senalizacion: SenalizacionConstruida[] = circuitosNivel4.map((circuito) => {
      const elegidoId = colorPorCircuito.get(circuito.id) ?? "";
      return {
        zonaId: circuito.id,
        zonaDescripcion: circuito.descripcion,
        colorElegidoId: elegidoId,
        esCorrecta: elegidoId === circuito.colorCorrectoId,
      };
    });

    gameManager.guardarEstandarNivel4({ checklist, senalizacion });

    const totalCorrectos = filas.filter((f) => f.correcto).length;
    const tasaExito = totalCorrectos / filas.length;
    const npcExito = tasaExito >= 0.75;

    corriendoTiempo = false;

    // El operario entra por el pasillo y se planta donde está el panel de
    // interruptores: es el sitio que decide si el estándar se entiende sin
    // preguntarle a nadie.
    npc.caminarHacia(new Vector3(PANEL_INTERRUPTORES.x, 0.6, 1.9), 2.4, () => {
      npc.reaccionar(npcExito);
      etiquetaNpc.isVisible = true;
      etiquetaNpc.text = npcExito
        ? "El área se explica sola: no tuve que preguntar nada."
        : "Tuve que probar interruptores a ciegas y adivinar dónde pisar.";
      etiquetaNpc.color = npcExito ? "#8be29a" : "#ff9a9a";

      luegoDe(scene, 1400, () => {
        etiquetaNpc.isVisible = false;

        mostrarInformeEstandar(gui, filas, totalCorrectos, () => {
          const puntosBase = filas.filter((f) => f.correcto).length * 12 + (npcExito ? 20 : 0);
          gameManager.sumarPuntos(puntosBase);

          const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
          // Subido de 110 a 170 s: ahora hay que recorrer el taller para leer
          // el color de tres focos repartidos por el galpón. Penalizar ese
          // recorrido sería castigar justo la inspección que la S pide.
          const bonusTiempo = Math.max(0, 170 - segundosTotales);
          gameManager.sumarPuntos(bonusTiempo);
          onCompletado();

          // Pregunta de cierre: el nivel acaba de mostrar tres controles de
          // distinta fuerza sobre el mismo error, así que acá se pide
          // reconocer cuál sostiene el estándar sin depender de nadie.
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

  // main.ts reparte sombras con esta forma exacta. Las zonas de piso no
  // proyectan sombra —son pintura sobre el suelo— así que van vacías.
  return {
    items: [...conectores, ...marcas],
    zonas: [] as Mesh[],
    senales: fichas,
    npc,
  };
}

// ---------------------------------------------------------------------------
// Guía de estaciones
// ---------------------------------------------------------------------------
//
// Tres renglones fijos en pantalla: qué se mueve, adónde va, y cuántos llevas.
//
// Sustituye al párrafo de cinco líneas que había antes. La diferencia no es de
// estilo: un texto corrido se lee UNA vez y después hay que acordarse, y este
// nivel obliga a preguntarse "y esto dónde va" once veces seguidas, con tres
// clases de pieza y tres destinos. Lo que hace falta es algo que se CONSULTE de
// un vistazo, no que se lea.
//
// Y viene al caso: este es el nivel de la gestión visual. Explicarla con un
// muro de texto sería predicar lo contrario de lo que enseña.

interface RenglonGuia {
  clave: string;
  /** Qué se mueve. Una palabra. */
  pieza: string;
  /** Adónde va. Dos o tres palabras. */
  destino: string;
}

interface GuiaResult {
  actualizar: (clave: string, hechos: number, total: number) => void;
  /** Cambia la guía por un mensaje final. */
  cerrar: (mensaje: string) => void;
  ocultar: () => void;
}

function crearGuiaEstaciones(gui: AdvancedDynamicTexture, renglones: RenglonGuia[]): GuiaResult {
  const marco = new Rectangle("guiaEstacionesNivel4");
  // Angosta y en la esquina.
  //
  // La primera version ocupaba 600 px en el centro superior y tapaba
  // exactamente lo que hay que mirar: el tablero de conexiones y el panel de
  // interruptores. Una guia que hay que apartar para trabajar no es una guia.
  // Tres renglones cortos, sin la explicacion del criterio — esa aparece en el
  // aviso cuando el cursor apunta al destino, que es cuando hace falta.
  marco.width = "268px";
  marco.adaptHeightToChildren = true;
  marco.cornerRadius = 10;
  marco.thickness = 1;
  marco.color = PALETA.borde;
  marco.background = "rgba(16, 19, 23, 0.82)";
  marco.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  marco.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  marco.left = "-16px";
  marco.top = "16px";
  // Deja pasar el puntero: el jugador arrastra por debajo todo el rato.
  marco.isPointerBlocker = false;
  gui.addControl(marco);

  const columna = new StackPanel("columnaGuiaNivel4");
  columna.isVertical = true;
  columna.width = "244px";
  columna.paddingTop = "10px";
  columna.paddingBottom = "10px";
  marco.addControl(columna);

  const textos = new Map<string, TextBlock>();

  renglones.forEach((renglon, i) => {
    const fila = new Rectangle(`filaGuia_${i}`);
    fila.width = "232px";
    fila.height = "26px";
    fila.thickness = 0;
    fila.background = "transparent";
    fila.isHitTestVisible = false;
    columna.addControl(fila);

    const texto = new TextBlock(`textoGuia_${renglon.clave}`, "");
    texto.color = PALETA.titulo;
    texto.fontSize = TEXTO.rotulo;
    texto.width = "224px";
    texto.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    texto.left = "8px";
    texto.isHitTestVisible = false;
    fila.addControl(texto);

    textos.set(renglon.clave, texto);
  });

  const pintar = (renglon: RenglonGuia, hechos: number, total: number): void => {
    const texto = textos.get(renglon.clave);
    if (!texto) return;

    const completo = hechos >= total;
    texto.text = `${completo ? "\u2713" : "\u2022"}  ${renglon.pieza} \u2192 ${renglon.destino}   ${hechos}/${total}`;
    // Verde al terminar: el renglon deja de pedir atencion sin desaparecer, que
    // es lo que permite mirar la guia y ver de un golpe que falta.
    texto.color = completo ? PALETA.acierto : PALETA.titulo;
  };

  renglones.forEach((renglon) => pintar(renglon, 0, 3));

  return {
    actualizar: (clave, hechos, total) => {
      const renglon = renglones.find((r) => r.clave === clave);
      if (renglon) pintar(renglon, hechos, total);
    },
    cerrar: (mensaje) => {
      textos.forEach((texto) => {
        texto.isVisible = false;
      });
      const cierre = new TextBlock("cierreGuiaNivel4", mensaje);
      cierre.color = PALETA.acierto;
      cierre.fontSize = TEXTO.rotulo;
      cierre.textWrapping = true;
      cierre.resizeToFit = true;
      cierre.width = "228px";
      cierre.paddingTop = "4px";
      cierre.paddingBottom = "4px";
      cierre.isHitTestVisible = false;
      columna.addControl(cierre);
    },
    ocultar: () => {
      marco.isVisible = false;
    },
  };
}

/** Apoya una malla sobre una superficie, sea cual sea su escala. */
function apoyarSobre(malla: Mesh, alturaSuperficie: number): void {
  malla.computeWorldMatrix(true);
  const base = malla.getBoundingInfo().boundingBox.minimumWorld.y;
  malla.position.y += alturaSuperficie - base;
}

function mostrarInformeEstandar(
  gui: AdvancedDynamicTexture,
  filas: FilaInformeEstandar[],
  totalCorrectos: number,
  onContinuar: () => void
): void {
  const fondo = new Rectangle("fondoInformeEstandar");
  fondo.width = "620px";
  fondo.height = "580px";
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
  const rotuloInforme = new TextBlock("rotuloInformeEstandar", "ESTÁNDAR QUE QUEDÓ INSTALADO");
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
    `${totalCorrectos} de ${filas.length} puntos del estándar se sostienen solos`
  );
  detalle.color = PALETA.cuerpo;
  detalle.fontSize = TEXTO.menor;
  detalle.height = "22px";
  detalle.top = "88px";
  detalle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(detalle);

  const scroll = new ScrollViewer("scrollInformeEstandar");
  scroll.width = "580px";
  scroll.height = "352px";
  scroll.barColor = PALETA.tenue;
  scroll.barBackground = PALETA.tarjetaSuave;
  scroll.thickness = 0;
  scroll.top = "124px";
  scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  fondo.addControl(scroll);

  const lista = new StackPanel("listaInformeEstandar");
  lista.isVertical = true;
  lista.width = "560px";
  scroll.addControl(lista);

  const ANCHO_TEXTO = 500;

  filas.forEach((fila, i) => {
    const color = fila.correcto ? PALETA.acierto : PALETA.error;

    const fondoFila = new Rectangle(`filaInformeEstandar_${i}`);
    fondoFila.width = "548px";
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
    columna.width = `${ANCHO_TEXTO}px`;
    columna.paddingTop = "14px";
    columna.paddingBottom = "14px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.left = "22px";
    columna.isHitTestVisible = false;
    fondoFila.addControl(columna);

    // Encabezado: simbolo y QUÉ CONTROL protegía este punto. Esa segunda parte
    // es la que convierte la lista en la lección del nivel — de un vistazo se
    // ve que todo lo que falló venía del control más débil.
    const encabezadoTexto = `${fila.correcto ? "\u2713" : "\u2715"}  ${ROTULO_CONTROL[fila.control]}`;

    const encabezado = new TextBlock(`encabezadoInformeEstandar_${i}`, encabezadoTexto);
    encabezado.color = color;
    encabezado.fontSize = TEXTO.rotulo;
    encabezado.fontWeight = "700";
    encabezado.textWrapping = true;
    encabezado.resizeToFit = true;
    encabezado.width = `${ANCHO_TEXTO}px`;
    encabezado.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    encabezado.isHitTestVisible = false;
    columna.addControl(encabezado);

    const separacionA = new Rectangle(`aireInformeA_${i}`);
    separacionA.width = "1px";
    separacionA.height = "7px";
    separacionA.thickness = 0;
    separacionA.background = "transparent";
    columna.addControl(separacionA);

    // El punto del estándar, que es el dato principal: mas grande y en blanco.
    const texto = new TextBlock(`textoInformeEstandar_${i}`, fila.texto);
    texto.color = PALETA.titulo;
    texto.fontSize = TEXTO.menor;
    texto.fontWeight = "600";
    texto.textWrapping = true;
    texto.resizeToFit = true;
    texto.width = `${ANCHO_TEXTO}px`;
    texto.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    texto.isHitTestVisible = false;
    columna.addControl(texto);

    const separacionB = new Rectangle(`aireInformeB_${i}`);
    separacionB.width = "1px";
    separacionB.height = "5px";
    separacionB.thickness = 0;
    separacionB.background = "transparent";
    columna.addControl(separacionB);

    // El porque, en gris: acompana pero no compite con el punto.
    const explicacion = new TextBlock(`explicacionInformeEstandar_${i}`, fila.explicacion);
    explicacion.color = PALETA.cuerpo;
    explicacion.fontSize = TEXTO.rotulo;
    explicacion.textWrapping = true;
    explicacion.resizeToFit = true;
    explicacion.width = `${ANCHO_TEXTO}px`;
    explicacion.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    explicacion.isHitTestVisible = false;
    columna.addControl(explicacion);

    // Alto de la fila SEGUN su contenido.
    //
    // Alto estimado, NO medido. heightInPixels devuelve cero en este momento:
    // la interfaz mide los bloques al dibujar, no al crearlos, así que
    // preguntarle acá dejaría todas las filas aplastadas. altoDeTexto hace la
    // cuenta redondeando hacia arriba, que es el lado seguro — sobra aire en
    // vez de faltar renglón.
    fondoFila.height =
      altoDeTexto(encabezadoTexto, ANCHO_TEXTO, TEXTO.rotulo) +
      altoDeTexto(fila.texto, ANCHO_TEXTO, TEXTO.menor) +
      altoDeTexto(fila.explicacion, ANCHO_TEXTO, TEXTO.rotulo) +
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