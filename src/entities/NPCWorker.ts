import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Vector3, Animation } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";

export interface NPCWorkerResult {
  mesh: Mesh;
  /**
   * Punto por encima de la cabeza donde colgar el globo de diálogo.
   *
   * Existe porque la raíz de la figura está en los PIES, y una etiqueta atada
   * ahí aparecería sobre las piernas. Antes daba igual: la raíz era el centro
   * de una cápsula y quedaba a la altura del pecho.
   */
  anclaEtiqueta: Mesh;
  caminarHacia: (destino: Vector3, duracionSegundos: number, alTerminar?: () => void) => void;
  reaccionar: (exito: boolean) => void;
}

/**
 * Operario que pone a prueba el estándar del jugador.
 *
 * Antes era una cápsula celeste. Cumplía la función —se movía y reaccionaba—
 * pero no se leía como persona, y eso importa más de lo que parece: el remate
 * del Nivel 4 es ver a ALGUIEN intentando seguir tus instrucciones. Si lo que
 * camina hasta el tablero es una pastilla de color, la escena pierde justo lo
 * que la hace significar algo.
 *
 * Está armado con las mismas piezas simples que el resto del juego, sin sumar
 * un modelo externo. Lo que lo vuelve reconocible no es el detalle sino tres
 * cosas: la silueta humana (cabeza, torso, brazos, piernas), la ropa de
 * trabajo —casco y chaleco reflectante, que además son los elementos de
 * protección de los que habla el curso— y las proporciones.
 *
 * El casco es amarillo a propósito: es el mismo que aparece en el Nivel 1 como
 * objeto a clasificar. Repetir la pieza ata las fases entre sí.
 *
 * IMPORTANTE: la raíz va con los pies en y = 0 y todo se construye hacia
 * arriba. `caminarHacia` recibe destinos con y = 0,6 —la altura a la que
 * estaba el centro de la cápsula anterior—, así que ese desfase se compensa
 * dentro de la función en vez de tocar el nivel.
 */

const ALTURA_BASE_ANTERIOR = 0.6;

function pbr(scene: Scene, nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;
  mat.microSurfaceTexture = texturaGrano(scene, 0.1);
  return mat;
}

export function crearNPCWorker(scene: Scene): NPCWorkerResult {
  const raiz = new Mesh("npcWorker", scene);
  raiz.position.set(-4, 0, 1.2);

  const matPiel = pbr(scene, "matPielNpc", new Color3(0.76, 0.58, 0.44), 0.85);
  const matCamisa = pbr(scene, "matCamisaNpc", new Color3(0.28, 0.38, 0.52), 0.8);
  const matChaleco = pbr(scene, "matChalecoNpc", new Color3(0.95, 0.72, 0.12), 0.7);
  const matReflectante = pbr(scene, "matReflectanteNpc", new Color3(0.88, 0.9, 0.92), 0.25, 0.2);
  const matPantalon = pbr(scene, "matPantalonNpc", new Color3(0.22, 0.25, 0.32), 0.85);
  const matBota = pbr(scene, "matBotaNpc", new Color3(0.16, 0.13, 0.11), 0.75);
  const matCasco = pbr(scene, "matCascoNpc", new Color3(0.95, 0.72, 0.06), 0.35);

  const matCinturon = pbr(scene, "matCinturonNpc", new Color3(0.3, 0.24, 0.18), 0.7);
  const matHebilla = pbr(scene, "matHebillaNpc", new Color3(0.7, 0.7, 0.72), 0.3, 0.8);
  matHebilla.albedoTexture = texturaMetalCepillado(scene);

  const agregar = (malla: Mesh, mat: PBRMaterial): Mesh => {
    malla.material = mat;
    malla.parent = raiz;
    return malla;
  };

  // --- Piernas ---
  [-1, 1].forEach((lado, i) => {
    const pierna = MeshBuilder.CreateCapsule(`piernaNpc_${i}`, { height: 0.52, radius: 0.075 }, scene);
    pierna.position.set(lado * 0.085, 0.32, 0);
    agregar(pierna, matPantalon);

    // Bota: más ancha que la pierna y adelantada. Le da apoyo a la figura —
    // sin ella el personaje parece flotar.
    const bota = MeshBuilder.CreateBox(`botaNpc_${i}`, { width: 0.11, height: 0.09, depth: 0.2 }, scene);
    bota.position.set(lado * 0.085, 0.045, 0.03);
    agregar(bota, matBota);
  });

  // --- Torso ---
  const torso = MeshBuilder.CreateBox("torsoNpc", { width: 0.32, height: 0.42, depth: 0.19 }, scene);
  torso.position.y = 0.79;
  agregar(torso, matCamisa);

  // CHALECO REFLECTANTE: la prenda que identifica a un operario de planta de un
  // vistazo. Va un poco más ancho que el torso para que se lea como algo puesto
  // encima y no como el color de la camisa.
  const chaleco = MeshBuilder.CreateBox("chalecoNpc", { width: 0.34, height: 0.3, depth: 0.21 }, scene);
  chaleco.position.y = 0.8;
  agregar(chaleco, matChaleco);

  // Bandas reflectantes: dos horizontales y dos verticales sobre el pecho.
  [0.72, 0.87].forEach((altura, i) => {
    const banda = MeshBuilder.CreateBox(`bandaNpc_${i}`, { width: 0.345, height: 0.035, depth: 0.215 }, scene);
    banda.position.y = altura;
    agregar(banda, matReflectante);
  });

  [-1, 1].forEach((lado, i) => {
    const tirante = MeshBuilder.CreateBox(`tiranteNpc_${i}`, { width: 0.035, height: 0.3, depth: 0.216 }, scene);
    tirante.position.set(lado * 0.1, 0.8, 0);
    agregar(tirante, matReflectante);
  });

  const cinturon = MeshBuilder.CreateBox("cinturonNpc", { width: 0.33, height: 0.05, depth: 0.2 }, scene);
  cinturon.position.y = 0.6;
  agregar(cinturon, matCinturon);

  const hebilla = MeshBuilder.CreateBox("hebillaNpc", { width: 0.055, height: 0.045, depth: 0.02 }, scene);
  hebilla.position.set(0, 0.6, 0.105);
  agregar(hebilla, matHebilla);

  // --- Brazos ---
  [-1, 1].forEach((lado, i) => {
    const brazo = MeshBuilder.CreateCapsule(`brazoNpc_${i}`, { height: 0.4, radius: 0.055 }, scene);
    brazo.position.set(lado * 0.205, 0.8, 0);
    brazo.rotation.z = lado * 0.12;
    agregar(brazo, matCamisa);

    // Mano: una esfera chica basta a esta distancia, pero sin ella el brazo
    // termina en un corte seco que se nota.
    const mano = MeshBuilder.CreateSphere(`manoNpc_${i}`, { diameter: 0.075, segments: 8 }, scene);
    mano.position.set(lado * 0.23, 0.59, 0);
    agregar(mano, matPiel);
  });

  // --- Cabeza ---
  const cuello = MeshBuilder.CreateCylinder("cuelloNpc", { diameter: 0.07, height: 0.05, tessellation: 10 }, scene);
  cuello.position.y = 1.02;
  agregar(cuello, matPiel);

  const cabeza = MeshBuilder.CreateSphere("cabezaNpc", { diameter: 0.2, segments: 14 }, scene);
  cabeza.scaling.set(1, 1.1, 0.95);
  cabeza.position.y = 1.13;
  agregar(cabeza, matPiel);

  // --- Casco ---
  // Mismo casco amarillo que aparece en el Nivel 1: repetir la pieza ata las
  // fases entre sí y refuerza que es el mismo puesto de trabajo.
  const domo = MeshBuilder.CreateSphere("cascoNpc", { diameter: 0.215, segments: 14 }, scene);
  domo.scaling.y = 0.7;
  domo.position.y = 1.2;
  agregar(domo, matCasco);

  const ala = MeshBuilder.CreateCylinder("alaCascoNpc", { diameterTop: 0.29, diameterBottom: 0.27, height: 0.015, tessellation: 20 }, scene);
  ala.position.y = 1.185;
  agregar(ala, matCasco);

  const visera = MeshBuilder.CreateBox("viseraCascoNpc", { width: 0.12, height: 0.014, depth: 0.07 }, scene);
  visera.position.set(0, 1.185, 0.135);
  agregar(visera, matCasco);

  // Nervadura central del casco, como los de obra reales.
  const nervadura = MeshBuilder.CreateBox("nervaduraCascoNpc", { width: 0.022, height: 0.02, depth: 0.2 }, scene);
  nervadura.position.y = 1.27;
  agregar(nervadura, matCasco);

  // Malla invisible sobre el casco: solo sirve de punto de anclaje.
  const anclaEtiqueta = MeshBuilder.CreateBox("anclaEtiquetaNpc", { size: 0.01 }, scene);
  anclaEtiqueta.position.y = 1.45;
  anclaEtiqueta.isVisible = false;
  anclaEtiqueta.isPickable = false;
  anclaEtiqueta.parent = raiz;

  function caminarHacia(destino: Vector3, duracionSegundos: number, alTerminar?: () => void): void {
    // El nivel pide destinos a la altura del centro de la cápsula anterior; la
    // figura nueva se apoya en el piso, así que se descuenta ese desfase acá.
    const destinoEnPiso = new Vector3(destino.x, destino.y - ALTURA_BASE_ANTERIOR, destino.z);

    // Se orienta hacia donde camina: un personaje que se desplaza de costado
    // delata que es una figura movida, no alguien caminando.
    const avance = destinoEnPiso.subtract(raiz.position);
    if (avance.length() > 0.01) {
      raiz.rotation.y = Math.atan2(avance.x, avance.z);
    }

    const fps = 30;
    const anim = new Animation(
      "npcCaminar",
      "position",
      fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys([
      { frame: 0, value: raiz.position.clone() },
      { frame: fps * duracionSegundos, value: destinoEnPiso },
    ]);
    raiz.animations = [anim];

    // Balanceo mientras camina: un cuerpo que se traslada sin moverse nada se
    // ve como una pieza deslizándose. Dos grados de vaivén alcanzan.
    const inicio = performance.now();
    const balanceo = scene.onBeforeRenderObservable.add(() => {
      const transcurrido = (performance.now() - inicio) / 1000;
      if (transcurrido >= duracionSegundos) {
        raiz.rotation.z = 0;
        raiz.position.y = 0;
        scene.onBeforeRenderObservable.remove(balanceo);
        return;
      }
      raiz.rotation.z = Math.sin(transcurrido * 9) * 0.035;
      raiz.position.y = Math.abs(Math.sin(transcurrido * 9)) * 0.02;
    });

    scene.beginAnimation(raiz, 0, fps * duracionSegundos, false, 1, alTerminar);
  }

  /**
   * Reacción tras probar el estándar: salto de alegría si era claro, o negar
   * con el cuerpo si era ambiguo.
   *
   * Le da consecuencia visible a la regla del nivel — "si el estándar es
   * ambiguo, el operario falla" — sin necesidad de leer el informe.
   */
  function reaccionar(exito: boolean): void {
    let t = 0;
    const rotBase = raiz.rotation.y;

    const obs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;

      if (exito) {
        // Salta de verdad, en vez de estirarse: con una figura humana, estirar
        // el cuerpo se ve como una deformación, no como alegría.
        raiz.position.y = Math.max(0, Math.sin(t * 9)) * 0.13;
        if (t > 0.8) {
          raiz.position.y = 0;
          scene.onBeforeRenderObservable.remove(obs);
        }
      } else {
        raiz.rotation.y = rotBase + Math.sin(t * 12) * 0.4;
        if (t > 0.9) {
          raiz.rotation.y = rotBase;
          scene.onBeforeRenderObservable.remove(obs);
        }
      }
    });
  }

  return { mesh: raiz, anclaEtiqueta, caminarHacia, reaccionar };
}