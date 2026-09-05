import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, PointLight, ActionManager, ExecuteCodeAction, Mesh } from "@babylonjs/core";
import { TextBlock, Control, AdvancedDynamicTexture } from "@babylonjs/gui";
import { incidentesNivel3, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearMancha } from "../entities/Stain";
import { crearBidonApartable } from "../entities/BidonApartable";
import { chispasDeAcierto, goteoDeFuga } from "../entities/Particulas";
import { reproducir } from "../core/Sonido";
import { crearMaquinaConFuga } from "../entities/OilMachine";
import { crearImpresoraConToner } from "../entities/PrinterMachine";
import { mostrarPanelOpciones } from "../ui/ChoicePanel";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearGoteoDeFuga } from "../entities/WorkshopProps";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";
import { luegoDe } from "../core/Animacion";
import { TEXTO, PALETA } from "../ui/EstiloUI";

// ===========================================================================
// NIVEL 3 — SEISO (Limpiar)
// ===========================================================================
//
// ─── EL FALLO DE FONDO QUE TENÍA ──────────────────────────────────────────
//
// Se ganaba haciendo clic en cinco manchas del piso. Eso es un juego de
// limpieza, no la 3S. Video 3.4 (0:41): "en esta S no se trata solo de limpiar
// sino, y más importante, la labor de limpieza la realizaremos con el objetivo
// final de poder realizar una INSPECCIÓN a nuestros equipos y áreas". Y en
// 1:40: hay que "eliminar la suciedad y LAS FUENTES DE SUCIEDAD... analizar la
// causa... y tomar acción".
//
// Trapear lo que está a la vista no es ninguna de las dos cosas.
//
// ─── LO QUE AHORA EXIGE EL NIVEL ──────────────────────────────────────────
//
// 1. ELIMINAR LA FUENTE ANTES QUE LA SUCIEDAD. Las manchas de aceite no se
//    dejan limpiar mientras la junta siga goteando: se puede frotar, salta la
//    salpicadura, y el aceite vuelve. La lección no se cuenta en un cartel, se
//    comprueba con el trapo en la mano.
//
// 2. INSPECCIONAR PARA ENCONTRARLA. La junta está AL DORSO del equipo. Desde
//    donde arranca la cámara no se ve: lo que se ve es el piloto de falla
//    latiendo y un cartel que manda mirar detrás. Hay que rodear la máquina.
//
// 3. MIRAR DEBAJO DE LO QUE HAY APOYADO. Un sexto charco no se ve desde ningún
//    ángulo porque está bajo el bidón de aceite. Solo aparece si se aparta el
//    bidón. Es el hallazgo que da sentido a la frase "limpiar para
//    inspeccionar", y por eso tiene su propia pregunta — de otro tipo que las
//    otras dos: acá la causa física es obvia, lo que hay que explicar es por
//    qué estuvo meses sin que nadie lo viera.

/** El equipo va a la derecha del banco; su dorso mira al fondo del galpón. */
const MAQUINA_X = 2.5;
const MAQUINA_Z = -0.3;

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
  // Los tres focos de siempre: banco, equipo e impresora.
  //
  // No se agrega un cuarto para el dorso de la máquina porque no serviría:
  // iluminarInteriorGaraje cuelga todos sus focos en x = 0, y el equipo está
  // en x = 2.5. La luz del dorso se pone aparte, más abajo, justo donde va a
  // hacer falta mirar.
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

  const equipo = crearMaquinaConFuga(scene, MAQUINA_X, MAQUINA_Z);

  const impresora = crearImpresoraConToner(scene, -3.2, 1.7);
  // La impresora es un equipo de escritorio y estaba apoyada directamente
  // sobre el piso del galpón. Se la sube a una mesa auxiliar, que además deja
  // libre el piso de abajo — que es justo donde se acumula el tóner.
  const ALTURA_MESA_IMPRESORA = 0.62;
  impresora.position.y = ALTURA_MESA_IMPRESORA;
  crearMesaAuxiliar(scene, -3.2, 1.7, ALTURA_MESA_IMPRESORA);

  crearLamparaDeTrabajo(scene);

  // Luz de inspección sobre el dorso del equipo.
  //
  // La junta está donde el jugador no mira, y ese es el ejercicio — pero un
  // punto de inspección en penumbra no es un desafío, es un problema de vista.
  // Fría y de alcance corto: alumbra el rincón sin aclarar la escena entera ni
  // pisar la luz cálida del taller.
  const luzDorso = new PointLight("luzDorsoMaquina", new Vector3(MAQUINA_X + 0.3, 1.5, MAQUINA_Z + 1.4), scene);
  luzDorso.diffuse = new Color3(0.86, 0.92, 1);
  luzDorso.intensity = 0.5;
  luzDorso.range = 3.2;

  // AMBIENTACIÓN
  //
  // Un galpón de 12 x 19 m con tres muebles se siente abandonado, no en uso.
  // La utilería llena el espacio y, sobre todo, hace verosímil la escena: los
  // tambores explican de dónde sale el aceite, y el carro de limpieza hace que
  // frotar el piso se lea como una tarea del puesto y no como un minijuego
  // pegado encima.
  //
  // Todo va contra las paredes o fuera de la zona de juego. La zona ocupada es
  // x entre -4 y 3.6, z entre -1.3 y 2.5 — ahí están el banco, el equipo, la
  // impresora, el bidón y las seis manchas. Nada de esto es interactivo: un
  // objeto decorativo que tape o imite una mancha juega en contra del
  // ejercicio.
  ambientarNivel(scene, 3);

  // El goteo cae exactamente donde la junta del dorso pierde aceite. No es
  // adorno: es la confirmación de que se llegó al punto correcto, y solo se ve
  // desde atrás del equipo.
  crearGoteoDeFuga(scene, equipo.puntoFuga);

  const instruccion = new TextBlock(
    "instruccionNivel3",
    "Modo inspección: primero elimina la FUENTE, después la suciedad. Y mira debajo de lo que está apoyado."
  );
  instruccion.color = "white";
  instruccion.fontSize = TEXTO.cuerpo;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  // Sin esto el bloque ocupa el alto completo de la pantalla y el texto
  // queda centrado verticalmente, ignorando su propio 'top'.
  instruccion.resizeToFit = true;
  instruccion.width = "560px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  // Las manchas ocultas no entran en la cuenta visible.
  //
  // Anunciar "0/6" delataría que falta una antes de haberla buscado, y todo el
  // ejercicio consiste en descubrir que hay algo que no se está contando. El
  // total sube solo cuando el jugador la destapa.
  const incidentesVisibles = incidentesNivel3.filter((i) => !i.oculta);
  let totalManchas = incidentesVisibles.reduce((sum, inc) => sum + inc.manchas.length, 0);
  hud.definirTotalTarea(totalManchas + 1); // +1: la fuga también es una tarea

  // LOS DOS INDICADORES VIVEN EN EL PANEL, NO EN MEDIO DE LA PANTALLA.
  //
  // "Manchas limpias" y "Fuente de suciedad" estaban escritos sobre el galpón,
  // cruzando la máquina y el suelo que hay que inspeccionar. Son datos del
  // tablero: van con el puntaje y el tiempo, en el panel de la izquierda. El
  // centro queda libre para mirar la escena, que es de lo que trata este nivel.
  hud.definirEstado("Fuente activa · sin sellar", PALETA.error);

  const refrescarPanel = (): void => {
    hud.definirMetrica(`Manchas limpias ${manchasLimpiasTotal} de ${totalManchas}`);
  };


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
  let avisoFugaMostrado = false;
  let ocultaRevelada = false;

  const refrescarProgreso = (): void => {
    refrescarPanel();
    // La fuga cuenta como una tarea más en la barra del HUD: es la mitad del
    // trabajo de esta S, no un requisito escondido.
    hud.actualizarProgreso(manchasLimpiasTotal + (equipo.estaSellada() ? 1 : 0));
  };

  // =========================================================================
  // LA FUENTE: sellar la junta del dorso
  // =========================================================================

  // Rótulo pegado a la junta, en el dorso. Solo se lee al rodear el equipo, y
  // ahí es imprescindible: una esfera oscura sobre una tubería no le dice a
  // nadie que se pueda pinchar.
  // SIN CARTEL. LA FUGA SE VE GOTEAR.
  //
  // Acá colgaba un rótulo que decía "JUNTA CON FUGA — clic para sellar", y eso
  // resolvía el ejercicio por el jugador: Seiso pide INSPECCIONAR para dar con
  // el origen, y un letrero que lo nombra convierte la inspección en leer.
  //
  // Unas gotas cayendo dicen lo mismo sin decir nada de más: hay que verlas,
  // acercarse y entender de dónde sale el aceite. Es lo que el video 3.4 pide
  // del área — que hable sola.
  const detenerGoteo = goteoDeFuga(scene, equipo.puntoFuga.clone());


  equipo.junta.actionManager = new ActionManager(scene);
  equipo.junta.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      if (equipo.estaSellada()) return;

      equipo.sellar();

      // El goteo para acá. Es la confirmación real de que la fuente quedó
      // eliminada: si siguiera cayendo aceite después de sellar, ningún texto
      // convencería de lo contrario.
      detenerGoteo();

      reproducir("acierto");
      chispasDeAcierto(scene, equipo.puntoFuga.clone(), 0.9);
      gameManager.sumarPuntos(25);

      hud.definirEstado("Fuente sellada", PALETA.acierto);

      hud.mostrarFeedback(
        true,
        "Junta sellada. Ahora sí tiene sentido limpiar: el aceite que quites no va a volver."
      );
      refrescarProgreso();
    })
  );

  // =========================================================================
  // EL BULTO QUE TAPA
  // =========================================================================

  const incidenteOculto = incidentesNivel3.find((i) => i.oculta);
  const revelarOculta: Array<() => void> = [];

  if (incidenteOculto?.oculta) {
    const [bx, bz] = incidenteOculto.oculta.posicionBulto;
    const hallazgo = incidenteOculto.oculta.hallazgo;

    const bidon = crearBidonApartable(scene, "bidonOculta", bx, bz, {
      xMin: -4.2,
      xMax: 4.2,
      zMin: -1.6,
      zMax: 2.6,
    });

    bidon.onApartado.add(() => {
      if (ocultaRevelada) return;
      ocultaRevelada = true;
      bidon.fijar();

      // Recién acá sube el total: hasta que no se destapa, esa mancha no
      // existe para el jugador.
      totalManchas += incidenteOculto.manchas.length;
      hud.definirTotalTarea(totalManchas + 1);

      revelarOculta.forEach((abrir) => abrir());
      reproducir("acierto");
      gameManager.sumarPuntos(30);
      hud.mostrarFeedback(true, hallazgo, new Vector3(bx, 0.2, bz));
      refrescarProgreso();
    });
  }

  // =========================================================================
  // MANCHAS
  // =========================================================================

  incidentesNivel3.forEach((incidente) => {
    let manchasLimpiasEsteIncidente = 0;

    incidente.manchas.forEach((datosMancha) => {
      const { onLimpia, onBloqueada, revelar } = crearMancha(
        scene,
        datosMancha.id,
        datosMancha.posicion[0],
        datosMancha.posicion[1],
        datosMancha.tipoVisual,
        undefined,
        {
          // Las manchas alimentadas por la fuga no se dejan terminar hasta
          // que la junta esté sellada.
          puedeLimpiarse: incidente.requiereFuenteSellada ? () => equipo.estaSellada() : undefined,
          ocultaAlInicio: incidente.oculta !== undefined,
        }
      );

      if (incidente.oculta) revelarOculta.push(revelar);

      onBloqueada.add(() => {
        reproducir("error");
        // Una sola vez. Repetir el mismo cartel en cada clic tapa la escena
        // justo cuando el jugador necesita mirarla para encontrar la fuga.
        if (avisoFugaMostrado) return;
        avisoFugaMostrado = true;
        intentosFallidos++;
        hud.mostrarFeedback(
          false,
          "El aceite vuelve. Mientras la junta siga goteando, trapear es trabajo perdido: primero hay que eliminar la fuente. Rodea la máquina y busca de dónde sale.",
          new Vector3(datosMancha.posicion[0], 0.15, datosMancha.posicion[1])
        );
      });

      onLimpia.add(() => {
        // Sonido al terminar de limpiar cada mancha.
        //
        // Este nivel era el único de los cinco que se jugaba en silencio: se
        // frotaba, la mancha desaparecía y no pasaba nada. El acuse sonoro es
        // lo que cierra la acción — sobre todo acá, donde limpiar toma varios
        // clics y el jugador necesita saber cuándo terminó una y empieza otra.
        reproducir("acierto");
        // Chispas en la mancha que se acaba de limpiar. Acá no se usa
        // mostrarFeedback porque limpiar no abre el cartel de texto: sería
        // un cartel cada cinco clics y taparía la escena todo el rato.
        chispasDeAcierto(scene, new Vector3(datosMancha.posicion[0], 0.15, datosMancha.posicion[1]), 0.7);
        gameManager.sumarPuntos(5);
        manchasLimpiasTotal++;
        manchasLimpiasEsteIncidente++;
        refrescarProgreso();

        if (manchasLimpiasEsteIncidente === incidente.manchas.length) {
          abrirPreguntaDeIncidente(gui, incidente, () => {
            incidentesResueltos++;
            revisarCierre();
          });
        }
      });
    });
  });

  /**
   * ¿Se puede dar el nivel por terminado?
   *
   * Tres condiciones, y las tres son la 3S: la fuente eliminada, la suciedad
   * quitada —incluida la que no se veía— y la causa de cada incidente
   * identificada. Faltando cualquiera, se dice cuál falta en vez de dejar al
   * jugador dando vueltas.
   */
  function revisarCierre(): void {
    if (incidentesResueltos < incidentesNivel3.length) {
      // Pista de la oculta: solo cuando ya no queda nada visible por hacer.
      if (!ocultaRevelada && incidentesResueltos === incidentesNivel3.length - 1 && equipo.estaSellada()) {
        hud.mostrarFeedback(
          false,
          "El área se ve limpia, pero el informe no cierra. Lo que no se mira tampoco se limpia: prueba a correr lo que está apoyado en el piso."
        );
      }
      return;
    }

    finalizarNivel();
  }

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

    const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
    // Recalibrado otra vez: ahora son 6 manchas, 3 investigaciones, una fuga
    // que hay que encontrar rodeando el equipo y un bulto que apartar. El
    // recorrido de inspección es lo que más tiempo agrega, y penalizarlo sería
    // premiar justo lo contrario de lo que enseña la S.
    const bonusTiempo = Math.max(0, 190 - segundosTotales);
    gameManager.sumarPuntos(bonusTiempo);
    onCompletado();

    const puntosBase = manchasLimpiasTotal * 5 + incidentesResueltos * 20 + 25 + 30;

    hud.mostrarFeedback(
      true,
      `Área inspeccionada: fuente eliminada, suciedad oculta encontrada y causas identificadas. ` +
        `Intentos fallidos: ${intentosFallidos} — mientras menos, mejor tu trabajo de detective.`
    );

    luegoDe(scene, 1000, () => {
      hud.mostrarResultadoFinal("Nivel 3", puntosBase, bonusTiempo, segundosTotales, onVolverMenu);
    });
  }

  return { maquina: equipo.root, impresora };
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

  const brazo: Mesh = MeshBuilder.CreateCylinder("brazoLamparaTrabajo", { diameter: 0.03, height: 0.7 }, scene);
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