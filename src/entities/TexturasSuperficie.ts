import { Scene, DynamicTexture } from "@babylonjs/core";

/**
 * Texturas de superficie generadas por código.
 *
 * Una superficie real nunca es homogénea. Un color plano con rugosidad
 * uniforme se lee como plástico aunque el color sea correcto, y el ojo lo
 * detecta sin saber por qué: es lo que hace que un objeto bien modelado
 * parezca de juguete.
 *
 * Estas funciones devuelven ruido sutil para romper esa uniformidad. Se
 * generan en un lienzo y no salen de un archivo, así que no agregan peso de
 * descarga ni dependen de que alguien mande imágenes.
 *
 * Todas se cachean por nombre: una misma textura la comparten todas las mallas
 * que la pidan, en vez de generarse una vez por objeto.
 */

const cache = new Map<string, DynamicTexture>();

function obtener(
  scene: Scene,
  nombre: string,
  lado: number,
  dibujar: (ctx: CanvasRenderingContext2D, lado: number) => void
): DynamicTexture {
  // La escena se destruye al cambiar de nivel y se lleva sus texturas, así que
  // la caché se compara contra la escena actual: una textura de la escena
  // anterior ya está muerta y dejaría la malla en negro.
  const yaHecha = cache.get(nombre);
  if (yaHecha && yaHecha.getScene() === scene) return yaHecha;

  const textura = new DynamicTexture(nombre, { width: lado, height: lado }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  dibujar(ctx, lado);
  textura.update();
  cache.set(nombre, textura);
  return textura;
}

/**
 * Grano fino en escala de grises, alrededor del gris medio.
 *
 * Pensado para el canal de rugosidad: al multiplicar por el valor base, unas
 * zonas quedan algo más pulidas y otras más mate. Es lo que hace que el
 * reflejo recorra la superficie en vez de cubrirla por igual.
 */
export function texturaGrano(scene: Scene, intensidad = 0.08): DynamicTexture {
  const nombre = `granoSuperficie_${intensidad.toFixed(2)}`;
  return obtener(scene, nombre, 256, (ctx, lado) => {
    const imagen = ctx.createImageData(lado, lado);
    const datos = imagen.data;

    for (let i = 0; i < datos.length; i += 4) {
      // Dos frecuencias: una fina que da el grano y otra gruesa que evita que
      // el patrón se lea como televisión sin señal.
      const fino = (Math.random() - 0.5) * 2;
      const grueso = (Math.random() - 0.5) * 0.6;
      const valor = 128 + (fino + grueso) * intensidad * 255 * 0.5;
      const nivel = Math.max(0, Math.min(255, valor));
      datos[i] = nivel;
      datos[i + 1] = nivel;
      datos[i + 2] = nivel;
      datos[i + 3] = 255;
    }
    ctx.putImageData(imagen, 0, 0);
  });
}

/**
 * Veta de madera: bandas irregulares recorriendo el eje horizontal.
 *
 * Para el tablero del banco de trabajo, que es la superficie más grande y más
 * mirada del juego — todos los objetos se apoyan encima.
 */
export function texturaVetaMadera(scene: Scene): DynamicTexture {
  return obtener(scene, "vetaMaderaBanco", 512, (ctx, lado) => {
    ctx.fillStyle = "#8a6038";
    ctx.fillRect(0, 0, lado, lado);

    // Vetas: líneas curvas de grosor y tono variables. La irregularidad es lo
    // que las hace leer como madera y no como rayas.
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * lado;
      const claro = Math.random() > 0.5;
      const alfa = 0.04 + Math.random() * 0.09;
      ctx.strokeStyle = claro ? `rgba(215,180,140,${alfa})` : `rgba(58,36,18,${alfa})`;
      ctx.lineWidth = 0.6 + Math.random() * 3.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        lado * 0.3, y + (Math.random() - 0.5) * 26,
        lado * 0.7, y + (Math.random() - 0.5) * 26,
        lado, y + (Math.random() - 0.5) * 14
      );
      ctx.stroke();
    }

    // SIN NUDOS.
    //
    // Acá se dibujaban tres nudos por textura, para romper la repetición de
    // las bandas. En una tabla real funcionan, pero esta textura se repite en
    // mosaico sobre el tablero: los tres nudos reaparecían en cada repetición,
    // siempre en la misma posición relativa, y lo que se veía eran manchas
    // oscuras sueltas en el medio de la mesa. Una mancha que se repite deja de
    // leerse como veta y pasa a leerse como suciedad o como un error de
    // sombreado — de hecho eso pareció al principio.
    //
    // La variación del patrón ya la dan las bandas onduladas de arriba, que al
    // no ser simétricas no delatan la repetición.
  });
}

/**
 * Metal cepillado: rayas finas en una sola dirección.
 *
 * Para montantes, marcos y estructuras. El metal liso es lo que más delata a
 * una escena hecha con primitivas, porque en la realidad casi no existe.
 */
export function texturaMetalCepillado(scene: Scene): DynamicTexture {
  return obtener(scene, "metalCepillado", 256, (ctx, lado) => {
    ctx.fillStyle = "#8e9196";
    ctx.fillRect(0, 0, lado, lado);

    for (let i = 0; i < 900; i++) {
      const y = Math.random() * lado;
      const largo = 20 + Math.random() * 90;
      const x = Math.random() * lado;
      const claro = Math.random() > 0.5;
      ctx.strokeStyle = claro ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + largo, y + (Math.random() - 0.5) * 1.5);
      ctx.stroke();
    }
  });
}
// ---------------------------------------------------------------------------
// Relieve del metal
// ---------------------------------------------------------------------------
//
// Las texturas de arriba pintan COLOR: dicen de qué color es cada punto, pero
// no si sobresale o se hunde. La luz las ve como una superficie lisa con un
// dibujo encima.
//
// Un mapa normal guarda, en cada punto, hacia dónde mira la superficie. Con eso
// la luz rebota distinto en cada surco y el relieve aparece sin sumar un solo
// triángulo.
//
// SOLO PARA METAL, a propósito. En la madera el efecto quedaba exagerado: la
// luz rasante del garaje marcaba tanto la veta que el tablero parecía
// corrugado. En el metal en cambio los surcos del cepillado ESTIRAN el reflejo
// del entorno en una dirección, y ese estiramiento es justo lo que el ojo
// reconoce como metal en vez de plástico gris.

/**
 * Convierte un campo de alturas en un mapa de normales.
 *
 * Para cada punto mide cuánto sube o baja respecto de sus vecinos y guarda esa
 * inclinación en los canales R y G, que es el formato que espera Babylon.
 */
function normalDesdeAltura(
  scene: Scene,
  nombre: string,
  lado: number,
  altura: (x: number, y: number) => number,
  fuerza: number
): DynamicTexture {
  const yaHecha = cache.get(nombre);
  if (yaHecha && yaHecha.getScene() === scene) return yaHecha;

  const textura = new DynamicTexture(nombre, { width: lado, height: lado }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  const imagen = ctx.createImageData(lado, lado);
  const datos = imagen.data;

  // El módulo mantiene continuos los bordes: la textura se repite en mosaico y
  // sin esto aparecería una costura marcada en cada repetición.
  const h = (x: number, y: number): number => altura((x + lado) % lado, (y + lado) % lado);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * fuerza;
      const dy = (h(x, y + 1) - h(x, y - 1)) * fuerza;

      let nx = -dx;
      let ny = -dy;
      const largo = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= largo;
      ny /= largo;

      const i = (y * lado + x) * 4;
      datos[i] = (nx * 0.5 + 0.5) * 255;
      datos[i + 1] = (ny * 0.5 + 0.5) * 255;
      datos[i + 2] = (1 / largo) * 127.5 + 127.5;
      datos[i + 3] = 255;
    }
  }

  ctx.putImageData(imagen, 0, 0);
  textura.update();
  // Filtrado alto: sin esto el relieve se deshace en cuanto la superficie se ve
  // en ángulo, que es la mayoría del tiempo con una cámara que orbita.
  textura.anisotropicFilteringLevel = 16;
  cache.set(nombre, textura);
  return textura;
}

/**
 * Relieve del metal cepillado: surcos finos en una sola dirección.
 *
 * La fuerza es baja (0,8) a propósito. Con valores altos el metal se ve
 * repujado, como chapa golpeada; lo que se busca es la microtextura que hace
 * que el reflejo se estire, no un relieve visible.
 */
export function normalMetalCepillado(scene: Scene): DynamicTexture {
  const LADO = 256;

  // Ruido fino para que los surcos no salgan perfectamente paralelos: el
  // cepillado real tiene irregularidades y son las que rompen el brillo.
  const irregular = (x: number, y: number): number => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };

  return normalDesdeAltura(
    scene,
    "normalMetalCepillado",
    LADO,
    (x, y) => Math.sin(y * 2.4) * 0.3 + irregular(Math.floor(x / 2), Math.floor(y / 3)) * 0.35,
    0.8
  );
}

/**
 * Concreto: grano fino con manchas amplias y alguna veta de junta.
 *
 * Para pedestales, bases y elementos de obra. Es la superficie más repetida del
 * garaje, así que se apoya en manchas de escala grande: si solo tuviera grano
 * fino, la repetición del mosaico saltaría a la vista.
 */
export function texturaConcreto(scene: Scene): DynamicTexture {
  return obtener(scene, "texturaConcreto", 256, (ctx, lado) => {
    ctx.fillStyle = "#8d8b86";
    ctx.fillRect(0, 0, lado, lado);

    // Manchas amplias: variación de tono que rompe la uniformidad.
    for (let i = 0; i < 22; i++) {
      const gris = 120 + Math.random() * 40;
      ctx.fillStyle = `rgba(${gris},${gris - 2},${gris - 6},0.16)`;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * lado,
        Math.random() * lado,
        22 + Math.random() * 60,
        18 + Math.random() * 45,
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Poros del árido.
    for (let i = 0; i < 2600; i++) {
      const claro = Math.random() > 0.55;
      ctx.fillStyle = claro ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(Math.random() * lado, Math.random() * lado, 2, 2);
    }
  });
}

/**
 * Cartón corrugado: canaladuras verticales y fibra.
 *
 * Para cajas y bultos. Las canaladuras son lo que distingue una caja de cartón
 * de un cubo marrón — sin ellas, cualquier caja del juego podía ser de madera,
 * de plástico o de lo que fuera.
 */
export function texturaCarton(scene: Scene): DynamicTexture {
  return obtener(scene, "texturaCarton", 256, (ctx, lado) => {
    ctx.fillStyle = "#b5946a";
    ctx.fillRect(0, 0, lado, lado);

    // Canaladuras: par de líneas claro/oscuro que simulan el relieve del
    // corrugado sin necesitar geometría.
    for (let x = 0; x < lado; x += 9) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x, 0, 3, lado);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(x + 4, 0, 3, lado);
    }

    // Fibra del papel.
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(60,40,20,0.05)";
      ctx.fillRect(Math.random() * lado, Math.random() * lado, 2, 1);
    }
  });
}