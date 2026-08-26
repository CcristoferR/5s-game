import { Engine, Mesh } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { setupXR } from "./core/XRManager";
import { iniciarAudio, iniciarAmbiente, detenerAmbiente, reproducir } from "./core/Sonido";
import { mostrarAcceso } from "./portal/PantallaAcceso";
import { mostrarAdministracion } from "./portal/PantallaAdmin";
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
import { mostrarRankingNivel5 } from "./ui/RankingScreen";

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
    () => mostrarCertificado(sceneManager.scene, () => mostrarMenu()),
    () => mostrarRankingNivel5(sceneManager.scene, () => mostrarMenu()),
    leerSesion()?.perfil.nombreCompleto,
    () => salirDeLaSesion()
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
    const { items, zonas, senales } = cargarNivel4(sceneManager.scene, hud, volverAlMenu, onCompletado);
    items.forEach((item) => sceneManager.shadowGenerator.addShadowCaster(item.mesh));
    zonas.forEach((z) => sceneManager.shadowGenerator.addShadowCaster(z));
    senales.forEach((s) => sceneManager.shadowGenerator.addShadowCaster(s.mesh));
  } else if (numeroNivel === 5) {
    const { puntos } = cargarNivel5(sceneManager.scene, hud, volverAlMenu, onCompletado, () => reintentarNivel(5));
    puntos.forEach((p) => p.meshesSombra.forEach((m) => sceneManager.shadowGenerator.addShadowCaster(m)));
  }

  iniciarAmbiente();

  const nombreSuelo = sueloPorNivel[numeroNivel];
  const suelo = sceneManager.scene.getMeshByName(nombreSuelo) as Mesh | null;
  setupXR(sceneManager.scene, suelo ? [suelo] : []);
}

// ARRANQUE
//
// El curso tiene puerta: sin sesión abierta no se llega al menú. La sesión
// sobrevive a recargar la página, así que quien ya entró no vuelve a ver el
// acceso — y sobre todo, no gasta otro cupo de su código.
//
// El administrador no entra al juego: su sesión lo lleva a la vista de
// administración. No tendría sentido mandarlo a clasificar herramientas.
// Cierra la sesión y vuelve a la puerta.
//
// El ambiente del taller se corta acá: si el jugador sale desde el menú, la
// escena no se recrea y el sonido seguiría sonando detrás del formulario.
//
// El progreso NO se borra. Es del navegador, no de la sesión: si la misma
// persona vuelve a entrar en el mismo equipo, retoma donde quedó. Cuando el
// progreso viva en el servidor, pasará a viajar con la cuenta.
function salirDeLaSesion(): void {
  detenerAmbiente();
  cerrarSesion();
  mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
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

  mostrarMenu();
}

// Abre lo que corresponda a una sesión guardada, revalidando el rol.
//
// Sin esto bastaba con editar la sesión en el navegador y cambiar el rol a
// "administrador" para entrar al panel: el rol se leía del mismo dato que el
// usuario controla.
async function abrirSesionGuardada(): Promise<void> {
  const sesion = leerSesion();
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
  cerrarSesion();
  mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
}

engine.runRenderLoop(() => sceneManager.scene.render());
window.addEventListener("resize", () => engine.resize());