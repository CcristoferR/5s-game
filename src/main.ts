import { Engine, Mesh } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { setupXR } from "./core/XRManager";
import { iniciarAudio, iniciarAmbiente, detenerAmbiente, reproducir } from "./core/Sonido";
import { mostrarAcceso } from "./portal/PantallaAcceso";
import { mostrarAdministracion } from "./portal/PantallaAdmin";
import { mostrarCatalogo } from "./portal/PantallaCatalogo";
import { registrarFaseCompletada, progresoDe, CURSO_ID } from "./portal/Datos";
import { guardarResultadoDeFase } from "./portal/Ranking";
import { leerSesion, cerrarSesion, rolVerificado } from "./portal/Sesion";
import type { Perfil } from "./portal/Datos";
import { cargarTutorial } from "./levels/Level0_Tutorial";
import { cargarNivel1 } from "./levels/Level1_Seiri";
import { cargarNivel2 } from "./levels/Level2_Seiton";
import { cargarNivel3 } from "./levels/Level3_Seiso";
import { cargarNivel4 } from "./levels/Level4_Seiketsu";
import { cargarNivel5 } from "./levels/Level5_Shitsuke";
import { HUD } from "./ui/HUD";
import { mostrarMenuPrincipal } from "./ui/MainMenu";
import { mostrarCertificado } from "./ui/CertificateScreen";
import { mostrarRankingCurso } from "./ui/RankingScreen";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, undefined, true);

// El buffer de render va 1:1 con el tamanio del canvas.
//
// Aca hubo un setHardwareScalingLevel(1 / devicePixelRatio) para ganar
// nitidez. El costo fue que el buffer pasaba a medir el doble que el canvas,
// y con eso la conversion de coordenadas del puntero hacia la GUI dejaba de
// coincidir: el menu se dibujaba en un lado y respondia en otro — el mouse
// sobre una fila y el clic entrando a la fila de abajo. Ademas explicaba por
// que al abrir las devtools o el modo celular (que cambian el
// devicePixelRatio) el comportamiento cambiaba.
//
// La nitidez de la interfaz se resuelve por el lado de la GUI (idealWidth /
// idealHeight en MainMenu), que no toca la geometria del puntero.
engine.setHardwareScalingLevel(1);

let sceneManager = new SceneManager(engine);

// Quién está jugando. El progreso se guarda a su nombre, no al del equipo.
let perfilActivo: Perfil | null = null;
const gameManager = GameManager.getInstance();

const infoNiveles = [
  { numero: 0, nombre: "Tutorial - Cómo se juega" },
  { numero: 1, nombre: "Seiri - Clasificar" },
  { numero: 2, nombre: "Seiton - Ordenar" },
  { numero: 3, nombre: "Seiso - Limpiar" },
  { numero: 4, nombre: "Seiketsu - Estandarizar" },
  { numero: 5, nombre: "Shitsuke - Disciplina" },
];

const sueloPorNivel: Record<number, string> = {
  0: "sueloTutorial",
  1: "suelo",
  2: "sueloN2",
  3: "sueloN3",
  4: "sueloN4",
  5: "sueloN5",
};

function mostrarMenu(): void {
  const niveles = infoNiveles.map((n) => ({
    ...n,
    desbloqueado: gameManager.estaDesbloqueado(n.numero),
    completado: gameManager.estaCompletado(n.numero),
  }));
  mostrarMenuPrincipal(
    sceneManager.scene,
    niveles,
    gameManager.getPorcentajeMadurez(),
    (numeroNivel) => cargarNivel(numeroNivel),
    () => {
      // Los datos de la auditoría del nivel 5 se imprimen en el certificado.
      // Vienen del GameManager y no del servidor porque son de esta sesión;
      // si alguien vuelve al certificado en otro momento, simplemente no
      // aparece esa casilla y el resto del documento queda igual.
      const auditoria = gameManager.getResultadoAuditoriaN5();
      mostrarCertificado(
        sceneManager.scene,
        () => mostrarMenu(),
        auditoria
          ? {
              promedioCalificacion: auditoria.promedioCalificacion,
              tasaAcierto: auditoria.tasaAcierto,
            }
          : undefined
      );
    },
    () => mostrarRankingCurso(sceneManager.scene, () => mostrarMenu()),
    perfilActivo?.nombreCompleto,
    () => void volverAlCatalogo()
  );
  // OJO: aca NO va attachControl ni setupXR.
  //
  // La camara ya queda enganchada al canvas dentro de SceneManager. Si se
  // la engancha una segunda vez, cada clic sobre el menu lo captura el
  // control de camara, y Babylon descarta el evento POINTERUP para la GUI
  // cuando el puntero quedo capturado. Como TODOS los botones del menu
  // reaccionan a POINTERUP, el resultado es un menu que se ve perfecto pero
  // en el que no responde absolutamente nada.
  //
  // setupXR tampoco corresponde: en el menu no hay piso ni escena que
  // recorrer, y monta otra capa que interviene los punteros. El modo XR se
  // arma al entrar a cada nivel, que es donde tiene sentido.
}

function volverAlMenu(): void {
  // El ambiente del taller pertenece al garaje: en el menú estorba.
  detenerAmbiente();
  sceneManager.scene.dispose();
  sceneManager = new SceneManager(engine);
  mostrarMenu();
}

// Reinicia la escena y vuelve a cargar el mismo nivel (usado por el
// botón "Reintentar auditoría" cuando el jugador reprueba el Nivel 5).
function reintentarNivel(numeroNivel: number): void {
  sceneManager.scene.dispose();
  sceneManager = new SceneManager(engine);
  cargarNivel(numeroNivel);
}

function cargarNivel(numeroNivel: number): void {
  gameManager.reiniciarNivel();
  gameManager.onPuntajeCambiado.clear();

  const hud = new HUD(sceneManager.scene);
  gameManager.onPuntajeCambiado.add((puntaje) => hud.actualizarPuntaje(puntaje));

  const onCompletado = () => {
    gameManager.completarNivel(numeroNivel);
    reproducir("nivelCompletado");

    // El avance queda asociado a la persona, no al navegador. Es lo que
    // permite retomar donde quedó aunque entre desde otro computador, y lo que
    // hace posible que el administrador vea quién completó qué.
    if (perfilActivo) {
      void registrarFaseCompletada(perfilActivo.id, CURSO_ID, numeroNivel, gameManager.puntaje);

      // Resultado de ESTA fase, para el ranking.
      //
      // Va separado del avance porque responden preguntas distintas: el avance
      // dice hasta dónde llegó la persona, el resultado dice qué tan bien lo
      // hizo. Y sobre todo, el ranking necesita el puntaje fase por fase — el
      // total del curso es la suma. El marcador del juego se reinicia en cada
      // nivel, así que gameManager.puntaje es exactamente el de esta fase.
      void guardarResultadoDeFase(
        CURSO_ID,
        numeroNivel,
        gameManager.puntaje,
        gameManager.segundosDelNivel()
      );
    }
  };

  if (numeroNivel === 0) {
    const { objetos } = cargarTutorial(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
  } else if (numeroNivel === 1) {
    const { objetos } = cargarNivel1(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
  } else if (numeroNivel === 2) {
    const { objetos, slots } = cargarNivel2(sceneManager.scene, hud, volverAlMenu, onCompletado);
    objetos.forEach((obj) => sceneManager.shadowGenerator.addShadowCaster(obj.mesh));
    slots.forEach((s) => sceneManager.shadowGenerator.addShadowCaster(s.mesh));
  } else if (numeroNivel === 3) {
    const { maquina, impresora } = cargarNivel3(sceneManager.scene, hud, volverAlMenu, onCompletado);
    maquina.getChildMeshes().forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m));
    impresora.getChildMeshes().forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m));
  } else if (numeroNivel === 4) {
    const { items, zonas, senales, npc } = cargarNivel4(sceneManager.scene, hud, volverAlMenu, onCompletado);
    items.forEach((item) => sceneManager.shadowGenerator.addShadowCaster(item.mesh));
    zonas.forEach((z) => sceneManager.shadowGenerator.addShadowCaster(z));
    senales.forEach((s) => sceneManager.shadowGenerator.addShadowCaster(s.mesh));
    // El operario también proyecta sombra: sin ella una figura de pie sobre
    // el piso se ve pegada encima, no parada ahí.
    npc.mesh.getChildMeshes().forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m));
  } else if (numeroNivel === 5) {
    const { puntos } = cargarNivel5(sceneManager.scene, hud, volverAlMenu, onCompletado, () => reintentarNivel(5));
    puntos.forEach((p) => p.meshesSombra.forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m)));
  }

  iniciarAmbiente();

  const nombreSuelo = sueloPorNivel[numeroNivel];
  const suelo = sceneManager.scene.getMeshByName(nombreSuelo) as Mesh | null;
  setupXR(sceneManager.scene, suelo ? [suelo] : []);
}

// Desde el menú del juego se vuelve al catálogo, no a la pantalla de acceso:
// la sesión sigue abierta y la persona puede querer entrar a otro curso. Para
// cerrar sesión de verdad está el botón del catálogo.
async function volverAlCatalogo(): Promise<void> {
  detenerAmbiente();
  sceneManager.scene.dispose();
  sceneManager = new SceneManager(engine);

  // Se relee del servidor en vez de reutilizar el perfil que había en memoria:
  // si al administrador se le dio de baja mientras jugaba, corresponde que se
  // entere ahora y no que siga entrando.
  const sesion = await leerSesion();
  if (!sesion) {
    mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
    return;
  }
  abrirCatalogo(sesion.perfil);
}

// El rol que trae el perfil recién autenticado sí es confiable: viene del
// registro, no de la sesión guardada. Esta variante se usa al entrar por la
// puerta. Para una sesión ya abierta se usa abrirSesionGuardada, que revalida.
function abrirSegunRol(perfil: Perfil): void {
  if (perfil.rol === "administrador") {
    mostrarAdministracion(() => {
      // Al cerrar sesión desde administración se vuelve a la puerta, no al
      // juego: quien administra no necesariamente tiene inscripción.
      mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
    });
    return;
  }

  abrirCatalogo(perfil);
}

// El trabajador entra al catálogo, no directo al juego.
//
// Antes el login llevaba al menú de niveles porque el 5S era lo único que
// existía. Ahora la plataforma aloja varios cursos, así que primero se elige
// uno. Con un solo curso publicado se ve una tarjeta sola; cuando haya más se
// agregan al lado sin tocar esta pantalla.
function abrirCatalogo(perfil: Perfil): void {
  perfilActivo = perfil;
  mostrarCatalogo(
    perfil,
    () => {
      // Por ahora todos los cursos abren el juego 5S, que es el único que
      // existe. Cuando haya otros, acá se decide cuál cargar según el id.
      void iniciarCursoDelJugador();
    },
    () => mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil))
  );
}

/**
 * Arranca el curso restaurando el avance guardado de esa persona.
 *
 * Hasta ahora el progreso vivía suelto en el navegador: era del equipo, no de
 * quien jugaba. Si dos personas usaban el mismo computador de planta,
 * compartían avance; y si alguien cambiaba de equipo, empezaba de cero.
 */
async function iniciarCursoDelJugador(): Promise<void> {
  gameManager.reiniciarTodo();

  if (perfilActivo) {
    const guardado = await progresoDe(perfilActivo.id, CURSO_ID);
    guardado?.fasesCompletadas.forEach((fase) => gameManager.completarNivel(fase));
  }

  mostrarMenu();
}

// Abre lo que corresponda a una sesión guardada, revalidando el rol.
//
// Sin esto bastaba con editar la sesión en el navegador y cambiar el rol a
// "administrador" para entrar al panel: el rol se leía del mismo dato que el
// usuario controla.
async function abrirSesionGuardada(): Promise<void> {
  const sesion = await leerSesion();
  if (!sesion) {
    mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
    return;
  }

  const rol = await rolVerificado(sesion);
  abrirSegunRol({ ...sesion.perfil, rol });
}

function arrancar(): void {
  // El rol de una sesión guardada NO se acepta tal cual: se revalida contra el
  // registro de perfiles antes de decidir a qué pantalla se entra.
  void abrirSesionGuardada();
}

// Prepara los efectos y engancha el desbloqueo del audio al primer clic: los
// navegadores no dejan sonar nada antes de que el usuario interactúe.
iniciarAudio();

// Si algo falla al abrir, se limpia la sesión y se muestra la puerta.
//
// Sin esto, un dato viejo o corrupto en el navegador dejaba la pantalla en
// negro sin ningún mensaje: el error ocurría fuera de todo try, la ejecución
// se cortaba antes de dibujar nada y en la consola no aparecía referencia
// alguna al juego. Recargar no servía, porque el dato seguía ahí.
try {
  arrancar();
} catch (error) {
  console.error("[arranque] no se pudo abrir la sesión guardada:", error);
  void cerrarSesion();
  mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
}

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());