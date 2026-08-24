import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, PointLight } from "@babylonjs/core";
import { TextBlock, Control, AdvancedDynamicTexture } from "@babylonjs/gui";
import { incidentesNivel3, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearMancha } from "../entities/Stain";
import { crearMaquinaConFuga } from "../entities/OilMachine";
import { crearImpresoraConToner } from "../entities/PrinterMachine";
import { mostrarPanelOpciones } from "../ui/ChoicePanel";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

export function cargarNivel3(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // ESCENARIO: el mismo garaje de los niveles 1 y 2. Carga asíncrona: los
  // elementos del nivel se crean igual y el garaje aparece un instante después.
  //
  // A propósito NO se le pasa el shadowGenerator: el garaje tiene techo, y si
  // el techo proyectara la sombra de la luz direccional dejaría todo el
  // interior a oscuras. La luz de adentro la resuelve iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel3] garaje:", error));
  // Tres focos, uno por cada zona que el jugador tiene que inspeccionar: el
  // banco, el equipo con la fuga y la impresora del fondo. Sin el tercero, las
  // manchas de tóner quedaban en penumbra y costaba encontrarlas.
  iluminarInteriorGaraje(scene, [
    { z: -0.5, intensidad: 0.85 },
    { z: 0.4, intensidad: 0.8 },
    { z: 1.9, intensidad: 0.8 },
  ]);

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "sueloN3" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("sueloN3", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // Banco angosto a propósito: acá el protagonista es el equipo con la fuga,
  // no el banco, y hay que dejarle lugar libre al costado.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN3", ancho: 3, fondo: 1.4, z: -0.5 });

  // La máquina se corrió de x=2.0 a x=2.5: con el banco compartido (3 m de
  // ancho) su carcasa quedaba encajada dentro del tablero.
  const maquina = crearMaquinaConFuga(scene, 2.5, -0.3);

  const impresora = crearImpresoraConToner(scene, -3.2, 1.7);
  // La impresora es un equipo de escritorio y estaba apoyada directamente
  // sobre el piso del galpón. Se la sube a una mesa auxiliar, que además deja
  // libre el piso de abajo — que es justo donde se acumula el tóner.
  const ALTURA_MESA_IMPRESORA = 0.62;
  impresora.position.y = ALTURA_MESA_IMPRESORA;
  crearMesaAuxiliar(scene, -3.2, 1.7, ALTURA_MESA_IMPRESORA);

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
    inicioNivel = performance.now();
    corriendoTiempo = true;
  }

  mostrarAperturaNivel(
    scene,
    3,
    briefingsNiveles[3],
    microLeccionesNiveles[3],
    arrancarNivel
  );

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

// Mesa auxiliar donde se apoya la impresora.
//
// Cuatro patas metálicas y una tapa: lo justo para que el equipo tenga dónde
// estar sin robarle protagonismo a las manchas, que son lo que el jugador
// tiene que mirar.
function crearMesaAuxiliar(scene: Scene, x: number, z: number, alturaTapa: number): void {
  const ANCHO = 0.85;
  const FONDO = 0.75;

  const matTapa = new PBRMaterial("matTapaMesaAux", scene);
  matTapa.albedoColor = new Color3(0.38, 0.26, 0.17);
  matTapa.roughness = 0.62;

  const tapa = MeshBuilder.CreateBox("tapaMesaAux", { width: ANCHO, height: 0.06, depth: FONDO }, scene);
  tapa.position.set(x, alturaTapa - 0.03, z);
  tapa.material = matTapa;
  tapa.receiveShadows = true;

  const matPata = new PBRMaterial("matPataMesaAux", scene);
  matPata.albedoColor = new Color3(0.32, 0.34, 0.37);
  matPata.roughness = 0.4;
  matPata.metallic = 0.72;

  const alturaPata = alturaTapa - 0.06;
  const patas: [number, number][] = [
    [-ANCHO / 2 + 0.08, -FONDO / 2 + 0.08],
    [ANCHO / 2 - 0.08, -FONDO / 2 + 0.08],
    [-ANCHO / 2 + 0.08, FONDO / 2 - 0.08],
    [ANCHO / 2 - 0.08, FONDO / 2 - 0.08],
  ];

  patas.forEach(([px, pz], i) => {
    const pata = MeshBuilder.CreateBox(`pataMesaAux_${i}`, { width: 0.06, height: alturaPata, depth: 0.06 }, scene);
    pata.position.set(x + px, alturaPata / 2, z + pz);
    pata.material = matPata;
    pata.receiveShadows = true;
  });
}

// Lámpara de trabajo (tipo pinza) sujeta cerca de la máquina — ilumina
// de forma cálida y localizada la zona del primer incidente.
function crearLamparaDeTrabajo(scene: Scene): void {
  const matMetal = new PBRMaterial("matLamparaTrabajo", scene);
  matMetal.albedoColor = new Color3(0.2, 0.2, 0.22);
  matMetal.roughness = 0.4;
  matMetal.metallic = 0.6;

  const brazo = MeshBuilder.CreateCylinder("brazoLamparaTrabajo", { diameter: 0.03, height: 0.7 }, scene);
  brazo.position.set(2.95, 1.6, -0.5);
  brazo.rotation.z = 0.4;
  brazo.material = matMetal;

  const matPantalla = new PBRMaterial("matPantallaLamparaTrabajo", scene);
  matPantalla.albedoColor = new Color3(0.9, 0.85, 0.6);
  matPantalla.emissiveColor = new Color3(0.6, 0.5, 0.25);
  matPantalla.roughness = 0.5;

  const pantalla = MeshBuilder.CreateCylinder("pantallaLamparaTrabajo", { diameterTop: 0.05, diameterBottom: 0.2, height: 0.16 }, scene);
  pantalla.position.set(2.7, 1.3, -0.4);
  pantalla.rotation.z = -0.6;
  pantalla.material = matPantalla;

  const luz = new PointLight("luzLamparaTrabajo", new Vector3(2.55, 1.25, -0.35), scene);
  luz.diffuse = new Color3(1, 0.85, 0.55);
  luz.intensity = 0.4;
  luz.range = 4;
}