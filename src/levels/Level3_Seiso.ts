import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, PointLight } from "@babylonjs/core";
import { Rectangle, TextBlock, Button, Control, AdvancedDynamicTexture } from "@babylonjs/gui";
import { incidentesNivel3 } from "../data/levelConfig";
import { crearMancha } from "../entities/Stain";
import { crearMaquinaConFuga } from "../entities/OilMachine";
import { crearImpresoraConToner } from "../entities/PrinterMachine";
import { mostrarPanelOpciones } from "../ui/ChoicePanel";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel3(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("sueloN3", { width: 10, height: 10 }, scene);
  const matSuelo = new PBRMaterial("matSueloN3", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  const escritorio = MeshBuilder.CreateBox("escritorioN3", { width: 3, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorioN3", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  const maquina = crearMaquinaConFuga(scene, 2.0, -0.3);
  const impresora = crearImpresoraConToner(scene, -3.2, 1.7);

  crearLamparaDeTrabajo(scene);

  const instruccion = new TextBlock(
    "instruccionNivel3",
    "🔍 Modo detective: limpia cada mancha, luego identifica la causa de cada incidente"
  );
  instruccion.color = "white";
  instruccion.fontSize = 15;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  instruccion.width = "480px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  const totalManchas = incidentesNivel3.reduce((sum, inc) => sum + inc.manchas.length, 0);
  const progreso = new TextBlock("progresoNivel3", `Manchas limpias: 0/${totalManchas}`);
  progreso.color = "white";
  progreso.fontSize = 15;
  progreso.outlineWidth = 3;
  progreso.outlineColor = "rgba(0,0,0,0.6)";
  progreso.top = "100px";
  progreso.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(progreso);

  mostrarMicroLeccionDetective(gui);

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let manchasLimpiasTotal = 0;
  let incidentesResueltos = 0;
  let intentosFallidos = 0;

  incidentesNivel3.forEach((incidente) => {
    let manchasLimpiasEsteIncidente = 0;

    incidente.manchas.forEach((datosMancha) => {
      const { onLimpia } = crearMancha(scene, datosMancha.id, datosMancha.posicion[0], datosMancha.posicion[1], datosMancha.tipoVisual);

      onLimpia.add(() => {
        gameManager.sumarPuntos(5);
        manchasLimpiasTotal++;
        manchasLimpiasEsteIncidente++;
        progreso.text = `Manchas limpias: ${manchasLimpiasTotal}/${totalManchas}`;

        if (manchasLimpiasEsteIncidente === incidente.manchas.length) {
          abrirPreguntaDeIncidente(gui, incidente, () => {
            incidentesResueltos++;
            if (incidentesResueltos === incidentesNivel3.length) {
              finalizarNivel();
            }
          });
        }
      });
    });
  });

  function abrirPreguntaDeIncidente(
    gui: AdvancedDynamicTexture,
    incidente: (typeof incidentesNivel3)[number],
    onResuelto: () => void
  ): void {
    const panelOpciones = mostrarPanelOpciones(gui, incidente.pregunta, incidente.opciones, (idElegido) => {
      const opcion = incidente.opciones.find((o) => o.id === idElegido)!;

      if (opcion.esCorrecta) {
        panelOpciones.ocultar();
        gameManager.sumarPuntos(20);
        hud.mostrarFeedback(true, opcion.explicacion);
        onResuelto();
      } else {
        intentosFallidos++;
        hud.mostrarFeedback(false, opcion.explicacion);
      }
    });
  }

  function finalizarNivel(): void {
    corriendoTiempo = false;
    instruccion.isVisible = false;
    progreso.isVisible = false;

    const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
    // Recalibrado: 5 manchas + 2 investigaciones (antes 3 manchas + 1), toma más tiempo real.
    const bonusTiempo = Math.max(0, 130 - segundosTotales);
    gameManager.sumarPuntos(bonusTiempo);
    onCompletado();

    const puntosBase = manchasLimpiasTotal * 5 + incidentesResueltos * 20;

    hud.mostrarFeedback(
      true,
      `¡Investigación completada! Intentos fallidos en las preguntas de causa: ${intentosFallidos} — mientras menos, mejor tu trabajo de detective.`
    );

    setTimeout(() => {
      hud.mostrarResultadoFinal("Nivel 3", puntosBase, bonusTiempo, segundosTotales, onVolverMenu);
    }, 1800);
  }

  return { maquina, impresora };
}

// Lámpara de trabajo (tipo pinza) sujeta cerca de la máquina — ilumina
// de forma cálida y localizada la zona del primer incidente.
function crearLamparaDeTrabajo(scene: Scene): void {
  const matMetal = new PBRMaterial("matLamparaTrabajo", scene);
  matMetal.albedoColor = new Color3(0.2, 0.2, 0.22);
  matMetal.roughness = 0.4;
  matMetal.metallic = 0.6;

  const brazo = MeshBuilder.CreateCylinder("brazoLamparaTrabajo", { diameter: 0.03, height: 0.7 }, scene);
  brazo.position.set(2.4, 1.6, -0.5);
  brazo.rotation.z = 0.4;
  brazo.material = matMetal;

  const matPantalla = new PBRMaterial("matPantallaLamparaTrabajo", scene);
  matPantalla.albedoColor = new Color3(0.9, 0.85, 0.6);
  matPantalla.emissiveColor = new Color3(0.6, 0.5, 0.25);
  matPantalla.roughness = 0.5;

  const pantalla = MeshBuilder.CreateCylinder("pantallaLamparaTrabajo", { diameterTop: 0.05, diameterBottom: 0.2, height: 0.16 }, scene);
  pantalla.position.set(2.15, 1.3, -0.4);
  pantalla.rotation.z = -0.6;
  pantalla.material = matPantalla;

  const luz = new PointLight("luzLamparaTrabajo", new Vector3(2.0, 1.25, -0.35), scene);
  luz.diffuse = new Color3(1, 0.85, 0.55);
  luz.intensity = 0.4;
  luz.range = 4;
}

function mostrarMicroLeccionDetective(gui: AdvancedDynamicTexture): void {
  const panel = new Rectangle("microLeccionDetective");
  panel.width = "480px";
  panel.height = "240px";
  panel.cornerRadius = 14;
  panel.thickness = 1;
  panel.color = "rgba(255,255,255,0.2)";
  panel.background = "rgba(18, 20, 24, 0.95)";
  panel.zIndex = 25;
  gui.addControl(panel);

  const titulo = new TextBlock("tituloMicroLeccionN3", "🔍 Limpieza como inspección");
  titulo.color = "white";
  titulo.fontSize = 19;
  titulo.top = "-80px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(titulo);

  const texto = new TextBlock(
    "textoMicroLeccionN3",
    "En 5S, limpiar no es solo dejar todo brillante — es una forma de inspección. Cada mancha es una pista. Este nivel usa el método de los '5 porqués': preguntarte repetidamente 'por qué' hasta llegar a la causa real, no solo al síntoma."
  );
  texto.color = "rgba(255,255,255,0.9)";
  texto.fontSize = 14;
  texto.textWrapping = true;
  texto.width = "420px";
  texto.top = "10px";
  texto.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(texto);

  const boton = Button.CreateSimpleButton("btnCerrarMicroLeccionN3", "Entendido");
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