import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Mesh } from "@babylonjs/core";
import type { ItemChecklistNivel4, SenalNivel4 } from "../data/levelConfig";

// ---------------------------------------------------------------------------
// Objetos del Nivel 4 (Seiketsu — Estandarizar)
// ---------------------------------------------------------------------------
//
// Acá el jugador compara instrucciones para decidir cuáles sirven como estándar
// y cuáles son demasiado vagas. Para comparar necesita LEERLAS, así que la
// tarjeta lleva su texto impreso.
//
// Antes solo mostraba un número y había que levantarla para ver qué decía. Eso
// convertía el nivel en un juego de memoria —agarrar, leer, soltar, recordar—
// en vez de una comparación, que es lo que se busca enseñar.

/** Reparte un texto en renglones que entren en el ancho dado. */
function repartirEnRenglones(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMaximo: number,
  maximoRenglones: number
): string[] {
  const palabras = texto.split(/\s+/);
  const renglones: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= anchoMaximo || !actual) {
      actual = prueba;
    } else {
      renglones.push(actual);
      actual = palabra;
      if (renglones.length === maximoRenglones - 1) break;
    }
  }

  if (actual && renglones.length < maximoRenglones) renglones.push(actual);
  return renglones;
}

export function crearFormaNivel4(scene: Scene, datos: ItemChecklistNivel4, numero: number): Mesh {
  // Textura apaisada: la tarjeta es más ancha que profunda, y una textura
  // cuadrada estiraría las letras al aplicarse.
  // Resolución alta: la tarjeta mide 0,5 m de ancho, así que a 1280 px quedan
  // unos 2.560 píxeles por metro. Con los 512 anteriores la letra se
  // deshacía en cuanto la cámara no estaba encima, y había que hacer zoom
  // máximo para leerla.
  const ANCHO = 1280;
  const ALTO = 900;

  const textura = new DynamicTexture(`textura_${datos.id}`, { width: ANCHO, height: ALTO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

  // Papel con un tono cálido y una trama muy leve: el blanco puro se ve
  // digital, no impreso.
  ctx.fillStyle = "#f0ece0";
  ctx.fillRect(0, 0, ANCHO, ALTO);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.5)" : "rgba(140,130,110,0.06)";
    ctx.fillRect(Math.random() * ANCHO, Math.random() * ALTO, 3, 3);
  }

  ctx.strokeStyle = "#c9c2ac";
  ctx.lineWidth = 12;

  ctx.strokeRect(24, 24, ANCHO - 48, ALTO - 48);

  // Franja superior con el número: hace de encabezado y deja el número
  // disponible para referirse a la tarjeta, sin robarle lugar al texto.
  ctx.fillStyle = "#3c4a5a";
  // Encabezado más bajo que antes en proporción: el espacio ganado va al

  // texto, que es lo que hay que poder leer.

  ctx.fillRect(24, 24, ANCHO - 48, 116);

  ctx.fillStyle = "#f2f3f1";
  ctx.font = "bold 64px system-ui, sans-serif";

  ctx.textAlign = "left";

  ctx.textBaseline = "middle";

  ctx.fillText(`INSTRUCCIÓN ${numero}`, 56, 84);

  // El texto de la instrucción, que es lo que el jugador tiene que evaluar.
  ctx.fillStyle = "#22252a";
  // 108 px sobre 1280 equivale a 43 px sobre los 512 de antes: la letra no
  // solo se ve más nítida, es un 27 % más grande en el mundo. Es lo que hace
  // que se lea sin acercarse.
  ctx.font = "600 108px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const renglones = repartirEnRenglones(ctx, datos.textoVisible, ANCHO - 130, 5);

  renglones.forEach((linea, i) => {

    ctx.fillText(linea, 62, 188 + i * 132);

  });

  textura.update();

  const mat = new PBRMaterial(`mat_${datos.id}`, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.9;
  mat.metallic = 0;
  // Filtrado anisotrópico al máximo: sin esto el texto se emborrona en cuanto
  // la tarjeta se ve en ángulo, que es como se la ve casi siempre con una
  // cámara que orbita por encima de la mesa.
  textura.anisotropicFilteringLevel = 16;

  const tarjeta = MeshBuilder.CreateBox(datos.id, { width: 0.5, height: 0.02, depth: 0.35 }, scene);
  tarjeta.material = mat;

  return tarjeta;
}

/**
 * Ficha de señalización de seguridad.
 *
 * Lleva las franjas diagonales que se usan en la señalética industrial. Sin
 * ellas la ficha es un cuadrado de color, y el jugador tiene que deducir por
 * contexto que se trata de una señal — con las franjas se reconoce de
 * inmediato, que es justo lo que una señal de seguridad debe lograr.
 */
export function crearFormaSenal(scene: Scene, datos: SenalNivel4): Mesh {
  const LADO = 256;
  const textura = new DynamicTexture(`texturaSenal_${datos.id}`, { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

  const [r, g, b] = datos.colorHex;
  const base = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, LADO, LADO);

  // Franjas diagonales oscuras, como la cinta de peligro.
  ctx.save();
  ctx.translate(LADO / 2, LADO / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-LADO, -LADO);
  ctx.fillStyle = "rgba(24,24,26,0.82)";
  for (let x = 0; x < LADO * 2; x += 56) {
    ctx.fillRect(x, 0, 28, LADO * 2);
  }
  ctx.restore();

  // Recuadro interior liso: deja ver el color puro, que es el dato que el
  // jugador tiene que asociar con la zona. Todo rayado escondería el color.
  ctx.fillStyle = base;
  ctx.fillRect(46, 46, LADO - 92, LADO - 92);

  ctx.strokeStyle = "rgba(20,20,22,0.85)";
  ctx.lineWidth = 8;
  ctx.strokeRect(46, 46, LADO - 92, LADO - 92);

  // Desgaste: unas marcas claras rompen la perfección de la impresión.
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(Math.random() * LADO, Math.random() * LADO, 3 + Math.random() * 6, 2);
  }

  textura.update();

  const mat = new PBRMaterial(`matSenal_${datos.id}`, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.5;
  mat.metallic = 0.05;

  const mesh = MeshBuilder.CreateBox(datos.id, { width: 0.42, height: 0.02, depth: 0.42 }, scene);
  mesh.material = mat;

  return mesh;
}