import { Scene, FreeCamera, Camera, Vector3, Color4 } from "@babylonjs/core";

/**
 * Deja la escena vacía antes de montar un escenario.
 *
 * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
 *
 * Los tres escenarios del curso comparten UNA sola escena de Babylon. Hasta
 * ahora solo el condominio la vaciaba al entrar; el supermercado y el banco se
 * limitaban a poner su color de fondo y cargar su modelo encima de lo que
 * hubiera.
 *
 * El resultado era que al pasar de un escenario a otro sobrevivía todo lo
 * anterior, y cada cosa daba su propio síntoma:
 *
 *   · LAS MALLAS. El hall del condominio, su ventanal y los edificios de la
 *     calle seguían ahí, metidos dentro del supermercado.
 *
 *   · LAS LUCES. Las del turno de noche se sumaban a las del escenario nuevo.
 *     Y como cada material admite ocho a la vez, pasado ese número la tarjeta
 *     empieza a descartar: de ahí que la iluminación saliera arbitraria.
 *
 *   · LAS TUBERÍAS DE POST-PROCESO. El grano, la viñeta y el mapeo de tonos
 *     del puesto nocturno se seguían aplicando al supermercado, que es un local
 *     iluminado. Eso es lo que teñía la imagen.
 *
 *   · LA SONDA DE REFLEJOS. Los materiales metálicos del modelo nuevo
 *     reflejaban una fotografía del escenario viejo.
 *
 * ─── QUÉ NO SE TOCA ───────────────────────────────────────────────────────
 *
 * Las capas de interfaz. El menú y los paneles del libro viven en texturas de
 * pantalla completa que no son de la escena 3D, y se gestionan solas: barrerlas
 * aquí dejaría al jugador sin menú al volver.
 *
 * ─── Y POR QUÉ NUNCA QUEDA SIN CÁMARA ─────────────────────────────────────
 *
 * Porque una escena de Babylon sin cámara activa no se dibuja: scene.render()
 * lanza "No camera defined" en cada cuadro y el bucle de main.ts se queda ahí.
 * Lo que se ve entonces es el último buffer limpiado —un color plano— y ni
 * siquiera el menú, porque la interfaz también se dibuja dentro de ese render.
 *
 * Eso pasaba al pulsar ESC para volver al menú: la limpieza destruía la cámara
 * del recorrido y no ponía otra. De ahí la pantalla de color liso.
 *
 * Así que al terminar se deja una cámara neutra. No sirve para jugar —no tiene
 * controles enganchados— pero garantiza que la escena siga dibujándose y que
 * el menú aparezca encima.
 *
 * ─── Y QUIEN MONTE UN ESCENARIO TIENE QUE RETIRARLA ───────────────────────
 *
 * Llamando a usarCamara() con la suya. No es opcional.
 *
 * Babylon marca como activa la PRIMERA cámara que se crea, y ninguno de los
 * escenarios lo hacía a mano porque hasta ahora siempre eran los primeros. Con
 * la cámara neutra por delante, la del escenario se creaba pero no llegaba a
 * activarse nunca: el jugador miraba desde la neutra, plantada en el origen y
 * detrás de cualquier muro que hubiera por ahí. Eso es lo que dejaba el
 * condominio en un color liso mientras los otros dos abrían bien.
 */
export const NOMBRE_CAMARA_NEUTRA = "camaraNeutra";

/**
 * Activa la cámara del escenario y retira la neutra.
 *
 * Todo escenario debe llamarla justo después de crear su cámara. Hace las dos
 * cosas juntas a propósito: son las dos caras del mismo paso, y separarlas es
 * cómo se acaba teniendo una escena con dos cámaras y la equivocada al mando.
 */
export function usarCamara(scene: Scene, camara: Camera): void {
  scene.activeCamera = camara;
  scene
    .getCameraByName(NOMBRE_CAMARA_NEUTRA)
    ?.dispose();
}

/**
 * Vacía la escena: mallas, luces, partículas, sondas, entorno, tuberías de
 * post-proceso y cámaras. Ver las notas de la cabecera del archivo.
 */
export function limpiarEscena(scene: Scene): void {
  // Las mallas, con sus materiales y texturas.
  //
  // El segundo parámetro es el importante: sin él, los materiales y las
  // texturas del escenario anterior se quedan en memoria. Con tres modelos de
  // entre dos y dieciséis megas, eso se acumula rápido y acaba explicando por
  // qué el tercer escenario tarda más que los dos primeros.
  scene.meshes.slice().forEach((malla) => {
    try {
      malla.dispose(false, true);
    } catch {
      /* ya se había ido */
    }
  });

  // Los nodos de transformación que quedan huérfanos al irse sus mallas.
  scene.transformNodes.slice().forEach((nodo) => {
    try {
      nodo.dispose();
    } catch {
      /* ya se había ido */
    }
  });

  scene.lights.slice().forEach((luz) => luz.dispose());
  scene.particleSystems.slice().forEach((sistema) => sistema.dispose());
  scene.reflectionProbes?.slice().forEach((sonda) => sonda.dispose());

  // El entorno: si no se quita, el escenario nuevo refleja el viejo.
  scene.environmentTexture?.dispose();
  scene.environmentTexture = null;

  // Las tuberías de post-proceso.
  //
  // Hay que desengancharlas de las cámaras ANTES de destruirlas, y hacerlo
  // antes de destruir las cámaras: al revés se intenta soltar de algo que ya no
  // existe. Se recorre una copia porque desmontar cada una modifica la lista.
  const tuberias = scene.postProcessRenderPipelineManager.supportedPipelines.slice();
  tuberias.forEach((tuberia) => {
    try {
      scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
        tuberia.name,
        scene.cameras
      );
      tuberia.dispose();
    } catch {
      /* alguna no estaba enganchada */
    }
  });

  // Y por último las cámaras, cuando ya nadie depende de ellas.
  scene.cameras.slice().forEach((camara) => camara.dispose());

  // La cámara neutra que deja la escena dibujable. Ver la nota de arriba.
  const neutra = new FreeCamera(NOMBRE_CAMARA_NEUTRA, new Vector3(0, 1.6, -4), scene);
  neutra.setTarget(Vector3.Zero());
  neutra.minZ = 0.1;
  scene.activeCamera = neutra;

  // Y el fondo del portal, para que quien se monte encima parta de un color
  // conocido en vez de heredar el del escenario que acaba de irse.
  scene.clearColor = new Color4(0.05, 0.06, 0.07, 1);
}