import { Scene, ArcRotateCamera, Vector3 } from "@babylonjs/core";

// SE IMPORTA DEL MÓDULO, NO DESDE Tools.
//
// CreateScreenshot* no son métodos propios de Tools: se le ENGANCHAN desde
// Misc/screenshotTools en tiempo de carga. Si nadie importa ese módulo, el
// empaquetador lo descarta por no usarse, y en el juego compilado
// Tools.CreateScreenshotUsingRenderTargetAsync queda como undefined.
//
// Y lo peor es cómo fallaba: llamar a undefined lanza dentro de una promesa
// sin catch, así que no salía ningún error visible — el panel simplemente no
// aparecía nunca y todos los avisos que puse antes tampoco llegaban a
// ejecutarse. Funcionaba en desarrollo, donde no hay poda de módulos.
//
// Importándolas por su nombre, el módulo entra sí o sí en el paquete.
import { CreateScreenshotAsync } from "@babylonjs/core/Misc/screenshotTools";
import { AdvancedDynamicTexture } from "@babylonjs/gui";

// ---------------------------------------------------------------------------
// Fotografía Cero
// ---------------------------------------------------------------------------
//
// Video 2.2: fotografiar el estado inicial es "un paso crucial
// psicológicamente". Documenta el punto de partida, y esas fotos son las que
// después permiten comparar con el después y motivar al equipo al ver sus
// propios logros. Es también la mitad del Panel 5S del video 4.2 — el tablero
// público con el antes y el después del sector.
//
// ─── LO QUE HACE QUE ESTO FUNCIONE O NO ───────────────────────────────────
//
// 1. EL MISMO ENCUADRE. Es la condición de todo. Dos fotos desde ángulos
//    distintos no se comparan: se ven como dos salas diferentes y el "antes y
//    después" pierde todo su sentido. Por eso la primera captura GUARDA la
//    posición de la cámara y la segunda la restituye antes de disparar.
//
// 2. SIN INTERFAZ. Se renderiza a un destino aparte, no se copia el lienzo.
//    Copiar el lienzo traería el HUD, los carteles y el puntaje encima, y eso
//    no es una fotografía del área: es una captura de pantalla del juego.
//
// 3. CON LA ESCENA LISTA. Disparar en el primer cuadro daría un garaje a medio
//    construir, sin texturas ni sombras. Se espera a que la escena esté
//    completa; una foto del "antes" con el material todavía cargando sería una
//    prueba falsa.

/** Encuadre desde el que se tomó una foto, para poder repetirlo. */
export interface Encuadre {
  alpha: number;
  beta: number;
  radius: number;
  objetivo: { x: number; y: number; z: number };
}

export interface Fotografia {
  imagen: string;
  encuadre: Encuadre;
  tomadaEn: string;
}

/**
 * Ancho de la captura. El alto sale de la proporción REAL del lienzo.
 *
 * Estaba fijo en 1280 x 720. Si la ventana no es exactamente 16:9 —y casi
 * nunca lo es— el render a esa medida recorta y estira: la foto salía con más
 * zoom que el juego y con las proporciones cambiadas. Calculándolo se ve
 * exactamente el mismo encuadre que en pantalla.
 */
const ANCHO = 1600;

/** Resuelve a null si la promesa tarda más de lo aceptable. */
function conTope<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promesa.catch(() => null),
    new Promise<null>((listo) => setTimeout(() => listo(null), ms)),
  ]);
}

function leerEncuadre(camara: ArcRotateCamera): Encuadre {
  return {
    alpha: camara.alpha,
    beta: camara.beta,
    radius: camara.radius,
    objetivo: { x: camara.target.x, y: camara.target.y, z: camara.target.z },
  };
}

function aplicarEncuadre(camara: ArcRotateCamera, encuadre: Encuadre): void {
  camara.alpha = encuadre.alpha;
  camara.beta = encuadre.beta;
  camara.radius = encuadre.radius;
  camara.setTarget(new Vector3(encuadre.objetivo.x, encuadre.objetivo.y, encuadre.objetivo.z));
}

/**
 * Espera un cuadro, o 250 ms si el motor no está dibujando.
 *
 * requestAnimationFrame no se dispara con la pestaña en segundo plano ni si la
 * escena se detuvo. Sin tope, la captura se quedaba esperando un cuadro que no
 * iba a llegar — y como esto corre justo antes de volver al menú, el nivel
 * quedaba congelado.
 */
function unCuadro(): Promise<void> {
  return new Promise<void>((listo) => {
    let resuelto = false;
    const terminar = (): void => {
      if (resuelto) return;
      resuelto = true;
      listo();
    };
    requestAnimationFrame(terminar);
    setTimeout(terminar, 250);
  });
}

/** Espera a que la escena esté armada del todo, con un tope por seguridad. */
async function esperarEscenaLista(scene: Scene): Promise<void> {
  await Promise.race([
    scene.whenReadyAsync(true),
    new Promise<void>((listo) => setTimeout(listo, 6000)),
  ]);

  // Un par de cuadros más: whenReady dice que se puede dibujar, no que ya se
  // haya dibujado con todo en su sitio.
  await unCuadro();
  await unCuadro();
}

/**
 * Toma la fotografía del estado inicial.
 *
 * @param encuadreForzado  Si se pasa, la cámara se mueve ahí antes de disparar.
 *                         Es lo que usa la foto del "después" para repetir
 *                         exactamente el mismo punto de vista.
 */
export async function tomarFotografia(
  scene: Scene,
  encuadreForzado?: Encuadre,
  /**
   * Esperar a que la escena termine de armarse.
   *
   * Solo hace falta en la Fotografía Cero, que se dispara con el nivel
   * recién abierto. Para la foto final es puro tiempo perdido —el galpón
   * lleva minutos dibujándose— y ahí esa espera costaba SEIS SEGUNDOS: la
   * comprobación de destinos de render nunca se satisface con el
   * postprocesado activo, así que agotaba su tope entero. En ese rato el
   * jugador ya había cerrado el nivel y la foto llegaba tarde.
   */
  esperarArmado = true
): Promise<Fotografia | null> {
  const camara = scene.activeCamera as ArcRotateCamera | null;
  if (!camara) return null;

  if (esperarArmado) {
    await esperarEscenaLista(scene);
  } else {
    // Un par de cuadros bastan: la escena ya está viva y dibujándose.
    await unCuadro();
    await unCuadro();
  }

  // Se guarda el encuadre actual para devolver la cámara donde estaba: el
  // jugador no debe notar que se le movió la vista.
  const encuadreJugador = leerEncuadre(camara);

  if (encuadreForzado) {
    aplicarEncuadre(camara, encuadreForzado);
    await unCuadro();
  }

  const encuadre = encuadreForzado ?? encuadreJugador;

  // SE OCULTA LA INTERFAZ ANTES DE DISPARAR.
  //
  // Esto no salía gratis: la interfaz de Babylon se dibuja como una capa DENTRO
  // de la escena, así que el render a destino aparte se la llevaba igual. La
  // primera versión de la Fotografía Cero salió con el panel de apertura, el
  // HUD y el puntaje encima — una captura de pantalla del juego, no una foto
  // del área.
  //
  // Se apagan todas las capas de interfaz y se vuelven a encender al terminar,
  // pase lo que pase.
  const capas = scene.textures.filter(
    (t): t is AdvancedDynamicTexture => t instanceof AdvancedDynamicTexture
  );
  const visibilidadPrevia = capas.map((c) => c.rootContainer.isVisible);
  capas.forEach((c) => (c.rootContainer.isVisible = false));

  // Un cuadro para que el apagado surta efecto antes de capturar. Con tope:
  // si el motor dejó de dibujar —pestaña en segundo plano, escena detenida—
  // requestAnimationFrame no vuelve nunca, y esto se llama justo antes de
  // salir del nivel.
  await unCuadro();

  const motor = scene.getEngine();

  // Alto acotado.
  //
  // Se calcula desde la proporción del lienzo, pero getRenderHeight puede
  // devolver 0 en el instante justo en que el motor está redimensionando. Un
  // alto de 0 no da una foto mala: da una captura inválida y ningún error
  // legible. El tope inferior evita ese caso.
  const alto = Math.max(
    360,
    Math.round((ANCHO * motor.getRenderHeight()) / Math.max(1, motor.getRenderWidth()))
  );

  try {
    // SE CAPTURA EL LIENZO. Es el método simple y el que funcionaba.
    //
    // El render a destino aparte es más "correcto" en teoría —deja fuera las
    // capas de interfaz por sí solo— pero depende del antialias sobre destino
    // de render, que falla en algunas placas sin avisar. Como acá la interfaz
    // ya está apagada a mano, capturar el lienzo da el mismo resultado por un
    // camino que no se rompe.
    const imagen = await conTope(
      CreateScreenshotAsync(motor, camara, { width: ANCHO, height: alto }),
      6000
    );

    if (!imagen) {
      console.warn("[foto] la captura no devolvió imagen");
      return null;
    }

    return { imagen, encuadre, tomadaEn: new Date().toISOString() };
  } catch (error) {
    // Con el error a la vista.
    //
    // El catch estaba vacío, así que cualquier fallo acá dentro desaparecía
    // sin dejar rastro: el panel no salía y no había nada que mirar. Eso costó
    // varios intentos a ciegas.
    console.error("[foto] falló la captura:", error);
    return null;
  } finally {
    capas.forEach((c, i) => (c.rootContainer.isVisible = visibilidadPrevia[i]));
    if (encuadreForzado) aplicarEncuadre(camara, encuadreJugador);
  }
}