import { Scene, MeshBuilder, ArcRotateCamera, Color3 } from "@babylonjs/core";
import { Rectangle, TextBlock, Control } from "@babylonjs/gui";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { crearDropZone } from "../entities/DropZone";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearFormaNivel1 } from "../entities/Level1Shapes";
import { PALETA, TEXTO, RADIO, crearVelo, crearTarjeta, crearRotulo, crearParrafo, crearBotonPrincipal } from "../ui/EstiloUI";
import { HUD } from "../ui/HUD";

/**
 * Tutorial — cómo se juega.
 *
 * No enseña la metodología 5S: eso lo hace el briefing de cada nivel. Acá se
 * enseñan los CUATRO controles que se usan en los cinco niveles, y nada más:
 * girar la cámara, acercar, identificar un objeto y arrastrarlo a una zona.
 *
 * Está armado como una lista de pasos que se completan de a uno. Cada paso
 * define qué se le pide al jugador y cómo se detecta que lo logró; el motor
 * de abajo no sabe nada del contenido. Agregar un paso nuevo es agregar una
 * entrada más a la lista.
 *
 * Decisiones que valen la pena explicar:
 *
 *  - No hay puntaje ni cronómetro. Un tutorial que puntúa mete presión justo
 *    donde el jugador todavía no entiende los controles.
 *  - No se puede fallar. Cada paso espera hasta que salga; no hay forma de
 *    quedarse trabado ni de terminar "mal".
 *  - Hay UN solo objeto y UNA sola zona. En el Nivel 1 hay diez objetos y tres
 *    zonas, y esa es justamente la parte que abruma si nadie te mostró antes
 *    cómo se agarra una cosa.
 */

const POSICION_OBJETO: [number, number, number] = [0, 0.945, -0.5];
const X_ZONA = 0;

interface PasoTutorial {
  rotulo: string;
  titulo: string;
  detalle: string;
  /** Registra cómo se detecta que el paso se cumplió. Devuelve la baja. */
  vigilar: (completar: () => void) => () => void;
}

export function cargarTutorial(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gui = hud.gui;

  // El marcador del HUD queda en cero durante todo el tutorial y el cronómetro
  // nunca arranca: acá no se puntúa ni se corre contra el reloj.

  void cargarGaraje(scene).catch((error) => console.error("[tutorial] garaje:", error));
  iluminarInteriorGaraje(scene, [
    { z: -0.5, intensidad: 0.95 },
    { z: 2.2, intensidad: 0.7, tinte: new Color3(0.95, 0.96, 1) },
  ]);

  // Suelo invisible al ras del piso del garaje, con el nombre que main.ts
  // busca para indicarle a WebXR dónde se puede teletransportar el jugador.
  const suelo = MeshBuilder.CreateGround("sueloTutorial", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  crearBancoDeTrabajo(scene);

  // Un solo objeto, y a propósito uno inconfundible: la taza con café viejo.
  // Se reconoce sin explicación y nadie duda de que va a la basura, así que el
  // jugador puede concentrarse en el gesto de arrastrar en vez de en decidir.
  const objeto = crearObjetoInteractable(
    scene,
    { id: "taza_cafe", posicionInicial: POSICION_OBJETO },
    crearFormaNivel1 as never
  );

  habilitarEtiquetasAlPasar(scene, gui, [{ mesh: objeto.mesh, texto: "Taza con café viejo" }]);

  const zona = crearDropZone(scene, "descartar", X_ZONA, new Color3(0.2, 0.7, 0.3), gui, "SUÉLTALO AQUÍ");

  const camara = scene.activeCamera as ArcRotateCamera;
  const alphaInicial = camara?.alpha ?? 0;
  const radioInicial = camara?.radius ?? 9;

  const pasos: PasoTutorial[] = [
    {
      rotulo: "PASO 1 DE 4",
      titulo: "Mira alrededor",
      detalle:
        "Mantén apretado el botón izquierdo del mouse sobre el piso y mueve. La cámara gira alrededor del puesto de trabajo.",
      vigilar: (completar) => {
        const obs = scene.onBeforeRenderObservable.add(() => {
          if (camara && Math.abs(camara.alpha - alphaInicial) > 0.45) completar();
        });
        return () => scene.onBeforeRenderObservable.remove(obs);
      },
    },
    {
      rotulo: "PASO 2 DE 4",
      titulo: "Acércate y aléjate",
      detalle: "Gira la rueda del mouse. Sirve para ver un objeto de cerca antes de decidir qué hacer con él.",
      vigilar: (completar) => {
        const obs = scene.onBeforeRenderObservable.add(() => {
          if (camara && Math.abs(camara.radius - radioInicial) > 1.4) completar();
        });
        return () => scene.onBeforeRenderObservable.remove(obs);
      },
    },
    {
      rotulo: "PASO 3 DE 4",
      titulo: "Identifica el objeto",
      detalle:
        "Pasa el cursor por encima de la taza que está sobre el banco. Aparece su nombre: así sabes qué es cada cosa antes de clasificarla.",
      vigilar: (completar) => {
        const obs = scene.onPointerObservable.add((info) => {
          const tocado = info.pickInfo?.pickedMesh;
          if (tocado && (tocado === objeto.mesh || tocado.isDescendantOf(objeto.mesh))) completar();
        });
        return () => scene.onPointerObservable.remove(obs);
      },
    },
    {
      rotulo: "PASO 4 DE 4",
      titulo: "Arrástralo a la zona",
      detalle:
        "Mantén apretado el botón izquierdo sobre la taza y llévala hasta el recuadro verde del piso. Suéltala ahí. Así se clasifica en todos los niveles.",
      vigilar: (completar) => {
        const obs = objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
          if (!movioSuficiente) return;
          if (Math.abs(mesh.position.x - X_ZONA) < 1.3) completar();
        });
        return () => objeto.onSoltar.remove(obs);
      },
    },
  ];

  const tarjeta = crearTarjetaPaso(gui);
  let indice = 0;
  let bajaActual: (() => void) | null = null;
  let terminado = false;

  function iniciarPaso(): void {
    if (indice >= pasos.length) {
      cerrar();
      return;
    }
    const paso = pasos[indice];
    tarjeta.rotulo.text = paso.rotulo;
    tarjeta.titulo.text = paso.titulo;
    tarjeta.detalle.text = paso.detalle;
    tarjeta.marca.isVisible = false;
    tarjeta.avance.width = Math.round((indice / pasos.length) * 100) + "%";

    let yaHecho = false;
    bajaActual = paso.vigilar(() => {
      // Un paso puede dispararse muchas veces seguidas — el observador de
      // render corre en cada fotograma. Solo la primera cuenta.
      if (yaHecho || terminado) return;
      yaHecho = true;
      completarPaso();
    });
  }

  function completarPaso(): void {
    if (bajaActual) {
      bajaActual();
      bajaActual = null;
    }
    tarjeta.marca.isVisible = true;
    tarjeta.avance.width = Math.round(((indice + 1) / pasos.length) * 100) + "%";
    indice++;
    // Medio segundo para que se vea la palomita antes de pasar al siguiente:
    // sin esa pausa el jugador no registra que hizo bien lo que le pidieron.
    setTimeout(() => {
      if (!terminado) iniciarPaso();
    }, 700);
  }

  function cerrar(): void {
    terminado = true;
    tarjeta.contenedor.isVisible = false;
    onCompletado();
    mostrarCierre(gui, onVolverMenu);
  }

  iniciarPaso();

  return { objetos: [objeto], zonas: [zona.mesh] };
}

// ---------------------------------------------------------------------------
// Tarjeta de instrucción
// ---------------------------------------------------------------------------

// Va abajo a la izquierda y no bloquea el puntero: el jugador tiene que poder
// arrastrar por toda la pantalla mientras la lee.
function crearTarjetaPaso(gui: Parameters<typeof crearVelo>[0]): {
  contenedor: Rectangle;
  rotulo: TextBlock;
  titulo: TextBlock;
  detalle: TextBlock;
  marca: TextBlock;
  avance: Rectangle;
} {
  const contenedor = new Rectangle("tarjetaTutorial");
  contenedor.width = "420px";
  contenedor.height = "186px";
  contenedor.cornerRadius = RADIO;
  contenedor.thickness = 1;
  contenedor.color = PALETA.borde;
  contenedor.background = PALETA.tarjeta;
  contenedor.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  contenedor.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  contenedor.left = "28px";
  contenedor.top = "-28px";
  contenedor.isPointerBlocker = false;
  gui.addControl(contenedor);

  const rotulo = new TextBlock("rotuloTutorial", "");
  rotulo.color = PALETA.acierto;
  rotulo.fontSize = TEXTO.rotulo;
  rotulo.fontWeight = "600";
  rotulo.height = "18px";
  rotulo.left = "22px";
  rotulo.top = "20px";
  rotulo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  rotulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  rotulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  rotulo.isHitTestVisible = false;
  contenedor.addControl(rotulo);

  const marca = new TextBlock("marcaTutorial", "✓");
  marca.color = PALETA.acierto;
  marca.fontSize = 26;
  marca.fontWeight = "700";
  marca.width = "30px";
  marca.height = "30px";
  marca.left = "-20px";
  marca.top = "16px";
  marca.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  marca.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  marca.isVisible = false;
  marca.isHitTestVisible = false;
  contenedor.addControl(marca);

  const titulo = new TextBlock("tituloTutorial", "");
  titulo.color = PALETA.titulo;
  titulo.fontSize = 21;
  titulo.fontWeight = "600";
  titulo.height = "26px";
  titulo.left = "22px";
  titulo.top = "44px";
  titulo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  titulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  titulo.isHitTestVisible = false;
  contenedor.addControl(titulo);

  const detalle = new TextBlock("detalleTutorial", "");
  detalle.color = PALETA.cuerpo;
  detalle.fontSize = TEXTO.cuerpo;
  detalle.textWrapping = true;
  detalle.width = "376px";
  detalle.height = "74px";
  detalle.left = "22px";
  detalle.top = "78px";
  detalle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  detalle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  detalle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  detalle.isHitTestVisible = false;
  contenedor.addControl(detalle);

  // Barra de avance: hace visible cuánto falta, que es lo que evita que el
  // jugador sienta que el tutorial no se termina nunca.
  const carril = new Rectangle("carrilTutorial");
  carril.width = "376px";
  carril.height = "5px";
  carril.cornerRadius = 3;
  carril.thickness = 0;
  carril.background = PALETA.linea;
  carril.left = "22px";
  carril.top = "-18px";
  carril.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  carril.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  carril.isHitTestVisible = false;
  contenedor.addControl(carril);

  const avance = new Rectangle("avanceTutorial");
  avance.width = "0%";
  avance.height = "5px";
  avance.cornerRadius = 3;
  avance.thickness = 0;
  avance.background = PALETA.acierto;
  avance.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  avance.isHitTestVisible = false;
  carril.addControl(avance);

  return { contenedor, rotulo, titulo, detalle, marca, avance };
}

// ---------------------------------------------------------------------------
// Cierre
// ---------------------------------------------------------------------------

function mostrarCierre(gui: Parameters<typeof crearVelo>[0], onVolverMenu: () => void): void {
  const velo = crearVelo(gui, "veloTutorialFin");
  const tarjeta = crearTarjeta(velo, "tarjetaTutorialFin", 520, 300);

  const rotulo = crearRotulo("rotuloFin", "TUTORIAL COMPLETADO");
  rotulo.top = "34px";
  rotulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(rotulo);

  const titulo = new TextBlock("tituloFin", "Ya sabes lo necesario");
  titulo.color = PALETA.titulo;
  titulo.fontSize = 26;
  titulo.fontWeight = "600";
  titulo.height = "34px";
  titulo.top = "64px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(titulo);

  const texto = crearParrafo(
    "textoFin",
    "Girar, acercar, identificar y arrastrar: son los mismos cuatro controles en las cinco fases. Lo que cambia en cada una es qué se te pide decidir.",
    430
  );
  texto.top = "112px";
  texto.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  tarjeta.addControl(texto);

  const boton = crearBotonPrincipal("botonFinTutorial", "Ir al menú", 210);
  boton.top = "-30px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    velo.isVisible = false;
    onVolverMenu();
  });
  tarjeta.addControl(boton);
}