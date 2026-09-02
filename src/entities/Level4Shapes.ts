import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh } from "@babylonjs/core";
import { fusionar } from "./ObjetosComunes";
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

  // La ficha tiene grosor de cartulina montada, no de hoja: 2 cm sobre 50 de
  // ancho es una lámina, y a la distancia de la cámara desaparecía de canto.
  // Con 3,5 cm y un soporte debajo se lee como un objeto que se puede tomar.
  const tarjeta = MeshBuilder.CreateBox(datos.id, { width: 0.5, height: 0.035, depth: 0.35 }, scene);
  tarjeta.material = mat;

  // Marco: el borde de la ficha en un tono distinto al papel. Sin él los
  // cantos quedan del color del papel y la tarjeta se confunde con la mesa
  // cuando se la ve desde un costado.
  const matMarco = new PBRMaterial(`matMarco_${datos.id}`, scene);
  matMarco.albedoColor = new Color3(0.22, 0.26, 0.32);
  matMarco.roughness = 0.75;
  matMarco.metallic = 0.05;

  const marco = MeshBuilder.CreateBox(`marco_${datos.id}`, { width: 0.53, height: 0.02, depth: 0.38 }, scene);
  marco.position.y = -0.019;
  marco.material = matMarco;

  // Clip metálico en el borde superior, como el de una ficha de taller
  // colgada del tablero. Es el rasgo que la vuelve reconocible de lejos: sin
  // él las cuatro tarjetas son rectángulos idénticos.
  const matClip = new PBRMaterial(`matClip_${datos.id}`, scene);
  matClip.albedoColor = new Color3(0.66, 0.68, 0.72);
  matClip.roughness = 0.3;
  matClip.metallic = 0.9;

  const clip = MeshBuilder.CreateBox(`clip_${datos.id}`, { width: 0.1, height: 0.012, depth: 0.07 }, scene);
  clip.position.set(0, 0.022, -0.155);
  clip.material = matClip;

  const clipLomo = MeshBuilder.CreateBox(`clipLomo_${datos.id}`, { width: 0.1, height: 0.05, depth: 0.012 }, scene);
  clipLomo.position.set(0, 0.004, -0.188);
  clipLomo.material = matClip;

  // Todo en UNA malla: el arrastre solo detecta la malla raíz, así que las
  // piezas sueltas como hijas no se podrían agarrar. Es la misma regla que
  // siguen los objetos de los Niveles 1 y 2.
  return fusionar([tarjeta, marco, clip, clipLomo], datos.id);
}

/**
 * Ficha de señalización de seguridad.
 *
 * Lleva las franjas diagonales que se usan en la señalética industrial. Sin
 * ellas la ficha es un cuadrado de color, y el jugador tiene que deducir por
 * contexto que se trata de una señal — con las franjas se reconoce de
 * inmediato, que es justo lo que una señal de seguridad debe lograr.
 */
/**
 * Dibuja el pictograma de la senal.
 *
 * Es lo que vuelve el nivel jugable para alguien que nunca vio el juego. Con
 * placas de color liso hay que ADIVINAR cual va en cada zona, o leer los tres
 * rotulos y recordarlos. Con el simbolo encima, la asociacion es inmediata y
 * ademas es la de verdad: en senaletica industrial el verde marca una
 * condicion segura, el triangulo amarillo advierte de un riesgo y el circulo
 * rojo tachado prohibe.
 */
function dibujarPictograma(ctx: CanvasRenderingContext2D, id: string, lado: number): void {
  const c = lado / 2;

  ctx.save();
  ctx.translate(c, c);

  if (id === "senal_verde") {
    // Peaton: cabeza, torso y piernas en zancada. La zancada es lo que lo
    // distingue de una figura parada — se lee como "paso", no como "persona".
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-6, -74, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 30;

    ctx.beginPath();
    ctx.moveTo(-4, -44);
    ctx.lineTo(4, 22);
    ctx.stroke();

    // Piernas
    ctx.beginPath();
    ctx.moveTo(4, 18);
    ctx.lineTo(-34, 86);
    ctx.moveTo(4, 18);
    ctx.lineTo(40, 80);
    ctx.stroke();

    // Brazos
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(-2, -30);
    ctx.lineTo(-44, 10);
    ctx.moveTo(-2, -30);
    ctx.lineTo(36, -4);
    ctx.stroke();
  } else if (id === "senal_amarillo") {
    // Triangulo de advertencia con el rayo dentro.
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.moveTo(0, -104);
    ctx.lineTo(104, 82);
    ctx.lineTo(-104, 82);
    ctx.closePath();
    ctx.fill();

    // Interior amarillo: deja el triangulo como un borde grueso, que es como
    // se ve la senal real.
    ctx.fillStyle = "#e8b400";
    ctx.beginPath();
    ctx.moveTo(0, -66);
    ctx.lineTo(72, 60);
    ctx.lineTo(-72, 60);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.moveTo(18, -44);
    ctx.lineTo(-26, 10);
    ctx.lineTo(-2, 10);
    ctx.lineTo(-16, 52);
    ctx.lineTo(30, -8);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
  } else {
    // Prohibicion: circulo con la barra diagonal.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(-55, 55);
    ctx.lineTo(55, -55);
    ctx.stroke();
  }

  ctx.restore();
}

export function crearFormaSenal(scene: Scene, datos: SenalNivel4): Mesh {
  // 512 en vez de 256: el pictograma tiene curvas y diagonales, y a la
  // resolucion anterior los bordes quedaban dentados.
  const LADO = 512;
  const textura = new DynamicTexture(`texturaSenal_${datos.id}`, { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

  const [r, g, b] = datos.colorHex;
  const base = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, LADO, LADO);

  // Franjas diagonales oscuras en el borde, como la cinta de peligro.
  ctx.save();
  ctx.translate(LADO / 2, LADO / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-LADO, -LADO);
  ctx.fillStyle = "rgba(24,24,26,0.82)";
  for (let x = 0; x < LADO * 2; x += 112) {
    ctx.fillRect(x, 0, 56, LADO * 2);
  }
  ctx.restore();

  // Recuadro interior liso: deja ver el color puro, que es el dato que el
  // jugador tiene que asociar con la zona, y da fondo limpio al pictograma.
  ctx.fillStyle = base;
  ctx.fillRect(92, 92, LADO - 184, LADO - 184);

  ctx.strokeStyle = "rgba(20,20,22,0.85)";
  ctx.lineWidth = 16;
  ctx.strokeRect(92, 92, LADO - 184, LADO - 184);

  dibujarPictograma(ctx, datos.id, LADO);

  // Desgaste: unas marcas claras rompen la perfeccion de la impresion.
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(Math.random() * LADO, Math.random() * LADO, 6 + Math.random() * 12, 3);
  }

  textura.update();
  textura.anisotropicFilteringLevel = 16;

  const mat = new PBRMaterial(`matSenal_${datos.id}`, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.5;
  mat.metallic = 0.05;

  const placa = MeshBuilder.CreateBox(datos.id, { width: 0.42, height: 0.03, depth: 0.42 }, scene);
  placa.material = mat;

  // Base metalica apenas mayor que la placa: le da canto y sombra propia. Sin
  // ella la senal es una calcomania sobre el piso y no se distingue de las
  // marcas pintadas de las zonas.
  const matBase = new PBRMaterial(`matBaseSenal_${datos.id}`, scene);
  matBase.albedoColor = new Color3(0.3, 0.32, 0.35);
  matBase.roughness = 0.45;
  matBase.metallic = 0.7;

  const soporte = MeshBuilder.CreateBox(`baseSenal_${datos.id}`, { width: 0.46, height: 0.022, depth: 0.46 }, scene);
  soporte.position.y = -0.02;
  soporte.material = matBase;

  return fusionar([placa, soporte], datos.id);
}