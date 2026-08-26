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