import { Engine, Mesh } from "@babylonjs/core";
import { GameManager } from "./core/GameManager";
import { SceneManager } from "./core/SceneManager";
import { setupXR, cerrarXR } from "./core/XRManager";
import { iniciarAudio, iniciarAmbiente, detenerAmbiente, reproducir, establecerSilencio } from "./core/Sonido";
import { mostrarAcceso } from "./portal/PantallaAcceso";
import { mostrarAdministracion } from "./portal/PantallaAdmin";
import { mostrarCatalogo } from "./portal/PantallaCatalogo";
import { mostrarMiCuenta } from "./portal/PantallaMiCuenta";
import { aplicarTemaUI } from "./ui/EstiloUI";
import { iniciarPreferencias } from "./portal/Preferencias";
import { mostrarVerificacion } from "./portal/PantallaVerificacion";
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
import { fundirEntrePantallas } from "./ui/Transicion";
import { cargarConPantalla } from "./ui/PantallaCarga";
import { mostrarRankingCurso } from "./ui/RankingScreen";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, undefined, false);

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
//
// OJO: la linea de abajo tiene que quedar en 1 fijo. Volvio a aparecer como
// (1 / devicePixelRatio) con un tope de 2, creyendo que el tope la hacia
// segura, y no lo es: con la pantalla al 125% o 150% —lo normal en Windows—
// el divisor es 1.25 o 1.5 y el desfase vuelve igual. Se nota poco arriba y
// mucho abajo, porque crece con la distancia al borde superior: las primeras
// filas del menu todavia se dejan apretar y las ultimas ya no, igual que el
// ranking y el cerrar sesion, que estan al fondo del panel.
//
// Por el mismo motivo el cuarto argumento del Engine va en false:
// adaptToDeviceRatio hace exactamente lo mismo por su cuenta.
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
    () =>
      mostrarRankingCurso(sceneManager.scene, () => {
        // El menú se recrea en el tick siguiente, no en el mismo.
        //
        // La pantalla que se cierra libera su capa con un setTimeout diferido,
        // porque destruirla dentro del propio evento de clic corta el reparto
        // de controles de Babylon. Si el menú se creaba de inmediato, durante
        // ese instante convivían dos capas a pantalla completa sobre la misma
        // escena, cada una con su propio Layer: es lo que producía el
        // parpadeo gris al volver del ranking.
        //
        // Un tick de espera basta para que la anterior ya no exista.
        setTimeout(() => mostrarMenu(), 0);
      }),
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

/**
 * Cerrojo de transición.
 *
 * Como la reconstrucción ahora va diferida, un segundo clic alcanzaría a
 * entrar antes de que la primera empiece, y quedarían dos destrucciones de
 * escena encoladas sobre una escena que ya no existe.
 */
let cambiandoEscena = false;

/**
 * Destruye la escena actual y arma la siguiente, fuera del evento de clic.
 *
 * El diferido no es opcional. Estas funciones se llaman desde
 * onPointerUpObservable —el botón "Volver al menú" del HUD, el de reintentar—,
 * y destruir ahí mismo la capa que está repartiendo ese clic corta el recorrido
 * interno de controles de Babylon: el puntero queda tomado y los POINTERUP
 * siguientes no llegan nunca a la capa nueva. El menú se ve perfecto, el hover
 * responde, y ningún botón funciona.
 *
 * Es el mismo motivo por el que el menú libera su capa con setTimeout al
 * elegir un nivel, y por el que el ranking arma el menú en el tick siguiente.
 * Este camino era el único que había quedado sin la misma protección.
 */
function cambiarEscena(despues: () => void, tapar = fundirEntrePantallas): void {
  if (cambiandoEscena) return;
  cambiandoEscena = true;

  setTimeout(() => {
    void tapar(() => {
      // Primero la experiencia XR y después la escena: al revés queda
      // enganchada al reparto de punteros de un lienzo que ya no tiene dueño.
      cerrarXR();
      sceneManager.scene.dispose();
      sceneManager = new SceneManager(engine);
      despues();
    }).finally(() => {
      cambiandoEscena = false;
    });
  }, 0);
}

function volverAlMenu(): void {
  // El ambiente del taller pertenece al garaje: en el menú estorba.
  detenerAmbiente();
  cambiarEscena(() => mostrarMenu());
}

// Reinicia la escena y vuelve a cargar el mismo nivel (usado por el
// botón "Reintentar auditoría" cuando el jugador reprueba el Nivel 5).
function reintentarNivel(numeroNivel: number): void {
  // Reintentar destruye la escena y vuelve a armar el nivel: es la espera más
  // larga del juego. Por eso quien tapa es la pantalla de carga y no el
  // fundido — así se aprovecha para repasar de qué trataba la fase, que es
  // justo lo que le hace falta a alguien que acaba de reprobar la auditoría.
  //
  // Una sola capa tapando, no dos: pasar la pantalla de carga COMO tapadera
  // evita que el fundido y la carga se solapen, que era lo que ocurría al
  // anidarlas.
  cambiarEscena(
    () => construirNivel(numeroNivel),
    (accion) => cargarConPantalla(numeroNivel, accion)
  );
}

/**
 * Guarda el resultado de una fase insistiendo si el servidor no responde.
 *
 * Tres intentos, esperando cada vez un poco más. Cubre el caso real: un
 * tropiezo de red suelto justo al terminar un nivel dejaba la fase fuera del
 * ranking mientras el avance sí quedaba guardado, y el jugador terminaba con
 * el certificado emitido pero una fase menos en la tabla.
 *
 * El RPC conserva el mejor intento, así que repetir la llamada es inofensivo:
 * si la primera sí había llegado, la segunda no cambia nada.
 */
async function guardarConReintentos(fase: number, puntaje: number, segundos: number): Promise<void> {
  for (let intento = 1; intento <= 3; intento++) {
    if (await guardarResultadoDeFase(CURSO_ID, fase, puntaje, segundos)) return;
    await new Promise((listo) => setTimeout(listo, intento * 1500));
  }

  console.error(
    `[ranking] La fase ${fase} no se pudo guardar tras 3 intentos. ` +
      `Vuelve a jugarla para que quede registrada en el ranking.`
  );
}

function cargarNivel(numeroNivel: number): void {
  // Entrar a un nivel usa la pantalla de carga, no el fundido suave: acá la
  // espera es larga —se arma el garaje entero— y conviene ocuparla con el
  // contexto de la fase en vez de dejar la pantalla apagada. El fundido queda
  // para los saltos cortos, como volver al menú.
  void cargarConPantalla(numeroNivel, () => construirNivel(numeroNivel));
}

// Armado del nivel. Separado de cargarNivel para que todo esto ocurra con la
// pantalla ya oscurecida: montar el garaje y los objetos toma varios cuadros y
// sin el fundido se veía aparecer por partes.
function construirNivel(numeroNivel: number): void {
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
      //
      // Con reintentos: esta escritura ya se perdió una vez en producción. Se
      // guardó el avance (y por lo tanto el certificado dio el curso por
      // completo) pero la fila del ranking no llegó, y la persona quedó con
      // "4 de 5 fases" habiendo hecho las cinco. Como se lanzaba sin esperar
      // el resultado, el fallo solo apareció en la consola y nadie lo vio.
      void guardarConReintentos(
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

  // Mismo diferido que cambiarEscena: esto también sale de un clic sobre la
  // capa del menú, y destruirla en ese momento deja el puntero tomado.
  await new Promise<void>((listo) => setTimeout(listo, 0));

  await fundirEntrePantallas(() => {
    cerrarXR();
    sceneManager.scene.dispose();
    sceneManager = new SceneManager(engine);
  });

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
    () => mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil)),
    () =>
      mostrarMiCuenta(perfil, () => {
        // Se relee el perfil del servidor en vez de reutilizar el que había en
        // memoria: si la persona corrigió su nombre, el catálogo tiene que
        // saludarla con el nuevo, no con el viejo.
        void (async () => {
          const sesion = await leerSesion();
          if (sesion) abrirCatalogo(sesion.perfil);
          else mostrarAcceso((resultado) => abrirSegunRol(resultado.perfil));
        })();
      })
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
  // VERIFICACIÓN PÚBLICA DE CERTIFICADOS.
  //
  // Se entra escribiendo #verificar al final de la dirección, sin cuenta y sin
  // pasar por el acceso. Es deliberado: quien verifica un certificado suele ser
  // alguien de afuera —un auditor, el área de personal de otra empresa— y
  // pedirle que se registre solo para validar un papel haría que nadie lo
  // verificara nunca.
  //
  // Admite además el código en la dirección, por ejemplo
  // #verificar/5S-QY5P-VHHD, para poder enviar un enlace que abra el resultado
  // directamente.
  const ruta = window.location.hash.replace(/^#\/?/, "");
  if (ruta.startsWith("verificar")) {
    const codigo = ruta.split("/")[1];
    mostrarVerificacion({ codigoInicial: codigo ? decodeURIComponent(codigo) : undefined });
    return;
  }

  // El rol de una sesión guardada NO se acepta tal cual: se revalida contra el
  // registro de perfiles antes de decidir a qué pantalla se entra.
  void abrirSesionGuardada();
}

// Prepara los efectos y engancha el desbloqueo del audio al primer clic: los
// navegadores no dejan sonar nada antes de que el usuario interactúe.
// Las preferencias del equipo van PRIMERO, antes de dibujar cualquier
// pantalla. Aplicarlas después haría que el portal apareciera un instante con
// el tema y el tamaño anteriores y saltara al correcto: ese parpadeo se nota
// mucho más que el cambio en sí.
const preferencias = iniciarPreferencias();
// La interfaz del juego (menú, ranking, certificado) también sigue el tema.
// Los niveles no: ahí manda la iluminación del garaje.
aplicarTemaUI(preferencias.tema);

iniciarAudio();
// El silencio guardado se aplica sobre el audio ya iniciado: si el equipo
// quedó en silencio la vez anterior, no debe sonar nada mientras alguien
// busca dónde apagarlo.
establecerSilencio(preferencias.silencio);

// TEMPORAL: vigila si las capas de interfaz se acumulan al navegar entre
// pantallas. Borrar esta línea y el archivo Diagnostico.ts cuando el
// destello y el ruido estén resueltos.

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