import { Scene, ParticleSystem, DynamicTexture, Vector3, Color4 } from "@babylonjs/core";

/**
 * Partículas de retroalimentación.
 *
 * Le dan al juego el "se siente como juego" que pidió el cliente: al acertar
 * salta un puñado de estrellas del objeto, al equivocarse una bocanada seca y
 * oscura. Es la misma información que ya daba el cartel de texto, pero llega
 * primero y por otro canal — el jugador se entera de que estuvo bien antes de
 * terminar de leer nada.
 *
 * CRITERIOS
 *
 * Brotan del punto donde ocurrió la acción, no del centro de la pantalla. Una
 * explosión de estrellas en el medio de la pantalla premia "haber hecho algo";
 * una que sale del objeto que acabas de soltar premia ESA decisión, que es lo
 * que el nivel quiere reforzar.
 *
 * El error dura menos que el acierto (0,5 s contra 1,1 s) y no usa estrellas.
 * En un juego educativo el error es información, no castigo: tiene que
 * notarse y desaparecer, no quedarse celebrando el fracaso.
 *
 * Cada sistema se destruye solo cuando termina. Los niveles crean y descartan
 * escenas todo el tiempo, y un emisor olvidado sigue vivo consumiendo cuadros.
 */

let texturaEstrella: DynamicTexture | null = null;
let texturaMota: DynamicTexture | null = null;

/** Estrella de cinco puntas, dibujada por código. */
function obtenerTexturaEstrella(scene: Scene): DynamicTexture {
  // Basta con comparar la escena: al destruirse una escena se lleva sus
  // texturas, así que una guardada de otra escena nunca debe reutilizarse.
  if (texturaEstrella && texturaEstrella.getScene() === scene) {
    return texturaEstrella;
  }

  const LADO = 128;
  const textura = new DynamicTexture("texturaEstrella", { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, LADO, LADO);

  const centro = LADO / 2;
  const puntas = 5;
  const radioExterno = LADO * 0.44;
  const radioInterno = radioExterno * 0.44;

  // Resplandor detrás: sin él la estrella se ve recortada y dura. Con él
  // parece emitir luz, que es lo que se espera de una chispa.
  const halo = ctx.createRadialGradient(centro, centro, 0, centro, centro, radioExterno);
  halo.addColorStop(0, "rgba(255,255,255,0.55)");
  halo.addColorStop(0.5, "rgba(255,255,255,0.14)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LADO, LADO);

  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const radio = i % 2 === 0 ? radioExterno : radioInterno;
    const angulo = (i * Math.PI) / puntas - Math.PI / 2;
    const x = centro + Math.cos(angulo) * radio;
    const y = centro + Math.sin(angulo) * radio;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  textura.update();
  textura.hasAlpha = true;
  texturaEstrella = textura;
  return textura;
}

/** Mota redonda difusa, para el error y para el polvo. */
function obtenerTexturaMota(scene: Scene): DynamicTexture {
  if (texturaMota && texturaMota.getScene() === scene) {
    return texturaMota;
  }

  const LADO = 64;
  const textura = new DynamicTexture("texturaMota", { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, LADO, LADO);

  const centro = LADO / 2;
  const degradado = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
  degradado.addColorStop(0, "rgba(255,255,255,1)");
  degradado.addColorStop(0.45, "rgba(255,255,255,0.5)");
  degradado.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, LADO, LADO);

  textura.update();
  textura.hasAlpha = true;
  texturaMota = textura;
  return textura;
}

/**
 * Lanza un sistema, lo deja emitir un instante y lo destruye.
 *
 * `targetStopDuration` corta la emisión, pero el sistema sigue existiendo
 * mientras las últimas partículas terminan su vida. El dispose se agenda
 * después de eso; hacerlo antes las borraría a mitad de vuelo.
 */
function dispararYLimpiar(sistema: ParticleSystem, duracionEmision: number): void {
  sistema.targetStopDuration = duracionEmision;
  sistema.disposeOnStop = true;
  sistema.start();
}

/**
 * Estrellas de acierto.
 *
 * Salen hacia arriba abriéndose, con gravedad suave para que caigan un poco al
 * final en vez de irse al infinito: ese pequeño arco es lo que las hace ver
 * como algo lanzado y no como un efecto pegado encima.
 */
export function chispasDeAcierto(scene: Scene, punto: Vector3, intensidad = 1): void {
  const sistema = new ParticleSystem("chispasAcierto", Math.round(46 * intensidad), scene);
  sistema.particleTexture = obtenerTexturaEstrella(scene);
  sistema.emitter = punto.clone();

  sistema.minEmitBox = new Vector3(-0.09, 0, -0.09);
  sistema.maxEmitBox = new Vector3(0.09, 0.06, 0.09);

  // Dorado que vira a verde: el dorado dice "premio" y el verde es el color
  // con el que el resto del juego marca lo correcto.
  sistema.color1 = new Color4(1, 0.86, 0.42, 1);
  sistema.color2 = new Color4(0.62, 0.86, 0.55, 1);
  sistema.colorDead = new Color4(0.55, 0.78, 0.6, 0);

  sistema.minSize = 0.05 * intensidad;
  sistema.maxSize = 0.13 * intensidad;
  sistema.minLifeTime = 0.5;
  sistema.maxLifeTime = 1.1;

  sistema.emitRate = 260 * intensidad;
  sistema.blendMode = ParticleSystem.BLENDMODE_ADD;
  sistema.gravity = new Vector3(0, -2.4, 0);

  sistema.direction1 = new Vector3(-1.1, 2.6, -1.1);
  sistema.direction2 = new Vector3(1.1, 3.6, 1.1);
  sistema.minEmitPower = 0.7;
  sistema.maxEmitPower = 1.6;
  sistema.updateSpeed = 0.016;

  // Giro propio: sin él todas las estrellas apuntan igual y se nota que son
  // la misma imagen repetida.
  sistema.minAngularSpeed = -3;
  sistema.maxAngularSpeed = 3;

  dispararYLimpiar(sistema, 0.16);
}

/**
 * Bocanada de error.
 *
 * Gris rojizo, sin brillo aditivo y hacia los costados: la idea es que se lea
 * como algo que se apaga, no como una explosión. Dura poco a propósito.
 */
export function humoDeError(scene: Scene, punto: Vector3): void {
  const sistema = new ParticleSystem("humoError", 26, scene);
  sistema.particleTexture = obtenerTexturaMota(scene);
  sistema.emitter = punto.clone();

  sistema.minEmitBox = new Vector3(-0.07, 0, -0.07);
  sistema.maxEmitBox = new Vector3(0.07, 0.05, 0.07);

  sistema.color1 = new Color4(0.78, 0.34, 0.28, 0.85);
  sistema.color2 = new Color4(0.45, 0.24, 0.22, 0.7);
  sistema.colorDead = new Color4(0.3, 0.18, 0.16, 0);

  sistema.minSize = 0.07;
  sistema.maxSize = 0.19;
  sistema.minLifeTime = 0.28;
  sistema.maxLifeTime = 0.55;

  sistema.emitRate = 160;
  // Sin BLENDMODE_ADD: el aditivo ilumina, y un error no debe verse festivo.
  sistema.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  sistema.gravity = new Vector3(0, -1.1, 0);

  sistema.direction1 = new Vector3(-1.5, 0.5, -1.5);
  sistema.direction2 = new Vector3(1.5, 1.2, 1.5);
  sistema.minEmitPower = 0.5;
  sistema.maxEmitPower = 1.1;
  sistema.updateSpeed = 0.016;

  dispararYLimpiar(sistema, 0.12);
}

/**
 * Celebración de fin de nivel: lluvia de estrellas que cae sobre la escena.
 *
 * Más larga y desde arriba, para que se sienta distinta de un acierto suelto.
 * Terminar las cinco fases tiene que valer más que clasificar un objeto.
 */
export function lluviaDeEstrellas(scene: Scene, centro: Vector3): void {
  const sistema = new ParticleSystem("lluviaEstrellas", 160, scene);
  sistema.particleTexture = obtenerTexturaEstrella(scene);
  sistema.emitter = new Vector3(centro.x, centro.y + 4.2, centro.z);

  sistema.minEmitBox = new Vector3(-3.2, 0, -2.2);
  sistema.maxEmitBox = new Vector3(3.2, 0.4, 2.2);

  sistema.color1 = new Color4(1, 0.88, 0.5, 1);
  sistema.color2 = new Color4(0.7, 0.9, 0.62, 1);
  sistema.colorDead = new Color4(0.7, 0.85, 0.7, 0);

  sistema.minSize = 0.06;
  sistema.maxSize = 0.16;
  sistema.minLifeTime = 1.4;
  sistema.maxLifeTime = 2.4;

  sistema.emitRate = 90;
  sistema.blendMode = ParticleSystem.BLENDMODE_ADD;
  sistema.gravity = new Vector3(0, -1.5, 0);

  // Caen casi rectas, con una deriva mínima: una lluvia, no una explosión.
  sistema.direction1 = new Vector3(-0.35, -0.6, -0.35);
  sistema.direction2 = new Vector3(0.35, -1, 0.35);
  sistema.minEmitPower = 0.2;
  sistema.maxEmitPower = 0.6;
  sistema.updateSpeed = 0.016;

  sistema.minAngularSpeed = -2;
  sistema.maxAngularSpeed = 2;

  dispararYLimpiar(sistema, 1.6);
}

/**
 * Punto delante de la cámara, para eventos que no ocurren en un lugar de la
 * escena — por ejemplo acertar una pregunta de un panel.
 *
 * Sin esto habría que elegir una posición fija del mundo, y las partículas
 * aparecerían fuera de cuadro apenas el jugador gire la cámara.
 */
export function puntoFrenteALaCamara(scene: Scene, distancia = 3.4): Vector3 {
  const camara = scene.activeCamera;
  if (!camara) return Vector3.Zero();

  const adelante = camara.getForwardRay(distancia).direction.normalize();
  return camara.position.add(adelante.scale(distancia));
}