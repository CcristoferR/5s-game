import { Scene, RawCubeTexture, Texture, Engine, Constants } from "@babylonjs/core";

/**
 * Entorno de iluminación de la escena.
 *
 * Los materiales PBR necesitan saber qué hay alrededor para calcular sus
 * reflejos. Sin un entorno propio, Babylon usa uno genérico de estudio: por eso
 * las patas metálicas del banco, los montantes de las estanterías y los
 * tambores reflejaban una habitación blanca abstracta que no existe en ninguna
 * parte del juego. Se veía correcto pero muerto — el reflejo no contaba nada
 * sobre el lugar.
 *
 * Acá se arma un cubo de seis caras con los tonos reales del garaje: cielo por
 * el frente, ladrillo a los lados, concreto abajo, luz cálida arriba. No es un
 * panorama fotográfico y no hace falta: un reflejo sobre una pata de 8 cm nunca
 * se lee como imagen, se lee como dirección y color de la luz.
 *
 * CALIBRADO PARA NO CAMBIAR EL BRILLO DE LA ESCENA. La intensidad se ajustó
 * para que la escena quede igual de iluminada que con el entorno genérico: la
 * diferencia tiene que verse en QUÉ reflejan los metales, no en cuánta luz hay.
 * Un entorno más brillante lavaría la escena y volvería el juego incómodo.
 *
 * Se genera por código, así que no agrega peso de descarga. Un archivo .env
 * prefiltrado de Babylon pesa entre 1 y 4 MB, y el juego ya carga 2,4 MB solo
 * de garaje.
 */

const LADO = 64;

/** Píxeles de una cara, con degradado vertical entre dos tonos. */
function pintarCara(
  arriba: [number, number, number],
  abajo: [number, number, number],
  brillo = 1
): Uint8Array {
  const datos = new Uint8Array(LADO * LADO * 4);

  for (let y = 0; y < LADO; y++) {
    const t = y / (LADO - 1);
    const r = (arriba[0] + (abajo[0] - arriba[0]) * t) * brillo;
    const g = (arriba[1] + (abajo[1] - arriba[1]) * t) * brillo;
    const b = (arriba[2] + (abajo[2] - arriba[2]) * t) * brillo;

    for (let x = 0; x < LADO; x++) {
      const i = (y * LADO + x) * 4;
      datos[i] = Math.min(255, r * 255);
      datos[i + 1] = Math.min(255, g * 255);
      datos[i + 2] = Math.min(255, b * 255);
      datos[i + 3] = 255;
    }
  }

  return datos;
}

/**
 * Monta el entorno del garaje como fuente de reflejos de la escena.
 *
 * El orden de las caras es el que espera Babylon: +X, -X, +Y, -Y, +Z, -Z.
 */
export function aplicarEntornoGaraje(scene: Scene): RawCubeTexture {
  // Paleta tomada de lo que realmente rodea al jugador dentro del galpón.
  const CIELO_ALTO: [number, number, number] = [0.34, 0.48, 0.68];
  const CIELO_BAJO: [number, number, number] = [0.7, 0.79, 0.87];
  const LADRILLO_ALTO: [number, number, number] = [0.44, 0.28, 0.21];
  const LADRILLO_BAJO: [number, number, number] = [0.32, 0.21, 0.16];
  const CONCRETO: [number, number, number] = [0.54, 0.54, 0.52];
  const TECHO_CALIDO: [number, number, number] = [0.56, 0.51, 0.44];

  const caras = [
    // Paredes laterales de ladrillo. Una algo más clara que la otra: si las dos
    // fueran idénticas el reflejo saldría simétrico y se leería como falso.
    pintarCara(LADRILLO_ALTO, LADRILLO_BAJO, 1.12),
    pintarCara(LADRILLO_ALTO, LADRILLO_BAJO, 0.88),
    // Techo: cálido, que es lo que devuelven las luminarias.
    pintarCara(TECHO_CALIDO, TECHO_CALIDO, 1.05),
    // Piso de concreto, que rebota luz neutra hacia arriba.
    pintarCara(CONCRETO, CONCRETO, 0.8),
    // Fondo con el portón y las ventanas grandes: la única dirección desde la
    // que entra luz de afuera. De acá sale el reflejo azulado que hace que el
    // metal se lea como metal.
    pintarCara(CIELO_ALTO, CIELO_BAJO, 1.18),
    pintarCara(LADRILLO_ALTO, CONCRETO, 0.92),
  ];

  const entorno = new RawCubeTexture(
    scene,
    caras,
    LADO,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
    // CON mipmaps: es lo que permite el desenfoque por rugosidad. Un material
    // mate toma un nivel borroso del cubo y uno pulido toma el nítido. Sin
    // mipmaps toda superficie reflejaría igual de nítido, que es justo lo que
    // delata un PBR mal configurado.
    true,
    false,
    Engine.TEXTURE_TRILINEAR_SAMPLINGMODE
  );

  // Los colores de arriba están escritos como se ven, no en espacio lineal.
  entorno.gammaSpace = true;
  entorno.coordinatesMode = Texture.CUBIC_MODE;

  scene.environmentTexture = entorno;

  // 0.72 y no más: con el entorno genérico la escena estaba en 0.7, y este cubo
  // es de brillo parecido. Subirlo lavaría los materiales y aplanaría las
  // sombras — el objetivo es cambiar el reflejo, no la iluminación.
  scene.environmentIntensity = 0.72;

  return entorno;
}