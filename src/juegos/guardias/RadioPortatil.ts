import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, Vector3, DynamicTexture, Texture, Curve3 } from "@babylonjs/core";
import { loft } from "./ModeladoFigura";
import { subirMapa, type Mapa } from "./TexturasPBR";
import { superficieCaucho } from "./TexturasPuesto";
import { texturaMetalCepillado } from "../../entities/TexturasSuperficie";

// ===========================================================================
// La radio portátil del puesto, en su cargador
// ===========================================================================
//
// Era una caja negra con un palito y un punto rojo. Se leía como "radio" solo
// porque el nivel decía que había una.
//
// Ahora es un equipo portátil de servicio metido en su cargador de mesa, que
// es como vive una radio en una conserjería: cuerpo de plástico con las
// esquinas redondeadas y la costura de la batería, bandas de caucho a los
// lados, rejilla de altavoz con sus ranuras en relieve, pantalla de cristal
// líquido, teclas, antena helicoidal de goma, perilla de canales estriada,
// pulsador de habla en el costado, tapa del conector con su tornillo y clip
// atrás. El cargador lleva su piloto verde y el cable baja por el pasacables
// del mesón.
//
// ─── LA PANTALLA ES EL AVISO ──────────────────────────────────────────────
//
// En reposo la retroiluminación está apagada y la pantalla se ve gris
// verdosa, con el canal escrito: así están las radios de verdad para ahorrar
// batería. Cuando entra una llamada se enciende, parpadea "RX" con el nombre
// de quien llama y el piloto de arriba late en rojo. Se ve desde la silla sin
// tener que leer nada, y de cerca dice quién está llamando.
//
// ─── TODO CUELGA DE MALLAS ────────────────────────────────────────────────
//
// El clic en cualquier pieza —la antena, la perilla, el cargador— atiende la
// llamada. Babylon busca el gestor de acciones subiendo por los padres, y ese
// camino se corta en un TransformNode; por eso no hay ninguno en la cadena.

export interface RadioPortatil {
  /** El cargador, raíz de todas las piezas. Es lo que recibe el clic. */
  raiz: Mesh;
  /** Enciende o apaga el aviso de llamada entrante. */
  avisar(encendido: boolean): void;
}

/** Mapa de normales desde una función de altura, repetible en los bordes. */
function mapaNormal(ancho: number, alto: number, altura: (x: number, y: number) => number, fuerza: number): Mapa {
  const h = new Float32Array(ancho * alto);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) h[y * ancho + x] = altura(x, y);
  const en = (x: number, y: number): number => h[((y + alto) % alto) * ancho + ((x + ancho) % ancho)];
  const datos = new Uint8Array(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const nx = (en(x - 1, y) - en(x + 1, y)) * fuerza;
      const ny = (en(x, y - 1) - en(x, y + 1)) * fuerza;
      const largo = Math.hypot(nx, ny, 1);
      const k = (y * ancho + x) * 4;
      datos[k] = Math.round(((nx / largo) * 0.5 + 0.5) * 255);
      datos[k + 1] = Math.round(((ny / largo) * 0.5 + 0.5) * 255);
      datos[k + 2] = Math.round(((1 / largo) * 0.5 + 0.5) * 255);
      datos[k + 3] = 255;
    }
  }
  return { ancho, alto, datos };
}

function mapaColor(ancho: number, alto: number, color: (x: number, y: number) => number): Mapa {
  const datos = new Uint8Array(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = Math.round(Math.max(0, Math.min(1, color(x, y))) * 255);
      const k = (y * ancho + x) * 4;
      datos[k] = v;
      datos[k + 1] = v;
      datos[k + 2] = Math.min(255, v + 2);
      datos[k + 3] = 255;
    }
  }
  return { ancho, alto, datos };
}

const suave = (a: number, b: number, t: number): number => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/**
 * Altura de la rejilla del altavoz: marco a ras, bisel, panel algo hundido y
 * nueve ranuras horizontales con los extremos redondeados.
 */
function alturaRejilla(x: number, y: number, lado: number): number {
  const margen = 14;
  const dx = Math.max(margen - x, x - (lado - 1 - margen), 0);
  const dy = Math.max(margen - y, y - (lado - 1 - margen), 0);
  const fuera = Math.hypot(dx, dy);
  const panel = 1 - 0.25 * (1 - suave(0, 5, fuera));
  let ranura = 1;
  const filas = 9;
  const paso = (lado - 2 * margen - 16) / (filas - 1);
  for (let f = 0; f < filas; f++) {
    const cy = margen + 8 + f * paso;
    const cx = Math.max(margen + 22, Math.min(lado - margen - 22, x));
    const d = Math.hypot(x - cx, y - cy) - 4.2;
    ranura = Math.min(ranura, suave(-1.2, 1.2, d));
  }
  return panel * (0.15 + 0.85 * ranura);
}

export function crearRadioPortatil(scene: Scene, posicion: Vector3, giro: number): RadioPortatil {
  const caucho = superficieCaucho(scene, "texCauchoRadio");

  const material = (nombre: string, color: Color3, rugosidad: number, metal = 0): PBRMaterial => {
    const m = new PBRMaterial(nombre, scene);
    m.albedoColor = color;
    m.roughness = rugosidad;
    m.metallic = metal;
    return m;
  };

  // Plástico ABS de equipo de servicio: casi negro, satinado y con un punteado
  // fino. El relieve del caucho, bajo, es el que le quita el aspecto de pieza
  // recién salida del molde.
  const matPlastico = material("matCuerpoRadio", new Color3(0.03, 0.032, 0.036), 0.46);
  matPlastico.bumpTexture = caucho.relieve;
  matPlastico.bumpTexture.level = 0.3;

  const matCaucho = material("matCauchoRadio", new Color3(1, 1, 1), 0.78);
  matCaucho.albedoTexture = caucho.color;
  matCaucho.bumpTexture = caucho.relieve;

  const matBase = material("matBaseRadio", new Color3(0.05, 0.052, 0.056), 0.55);
  matBase.bumpTexture = caucho.relieve;
  matBase.bumpTexture.level = 0.2;

  const matMetal = material("matMetalRadio", new Color3(0.32, 0.33, 0.35), 0.32, 0.9);
  matMetal.albedoTexture = texturaMetalCepillado(scene);

  const matCristal = material("matCristalRadio", new Color3(0.008, 0.009, 0.011), 0.07);
  const matNegro = material("matNegroRadio", new Color3(0.012, 0.012, 0.014), 0.6);

  // Rejilla: color y relieve salen de la misma altura, así las ranuras son
  // oscuras exactamente donde se hunden.
  const LADO_REJILLA = 256;
  const matRejilla = material("matRejillaRadio", new Color3(1, 1, 1), 0.55);
  matRejilla.albedoTexture = subirMapa(
    scene,
    "texRejillaRadioColor",
    // Ranuras oscuras sobre plástico gris antracita: más oscuro, la rejilla
    // entera se hundía en negro y no se distinguía una ranura de otra.
    mapaColor(LADO_REJILLA, LADO_REJILLA, (x, y) => 0.05 + 0.17 * alturaRejilla(x, y, LADO_REJILLA)),
    true,
    Texture.CLAMP_ADDRESSMODE
  );
  matRejilla.bumpTexture = subirMapa(
    scene,
    "texRejillaRadioRelieve",
    mapaNormal(LADO_REJILLA, LADO_REJILLA, (x, y) => alturaRejilla(x, y, LADO_REJILLA), 3.5),
    false,
    Texture.CLAMP_ADDRESSMODE
  );

  // Estrías de la perilla: dan la vuelta al cilindro.
  const matPerilla = material("matPerillaRadio", new Color3(0.02, 0.021, 0.024), 0.5);
  matPerilla.bumpTexture = subirMapa(
    scene,
    "texEstriasRadio",
    mapaNormal(128, 16, (x) => Math.abs(Math.sin((x / 128) * Math.PI * 26)), 2.5),
    false,
    Texture.WRAP_ADDRESSMODE
  );

  const matLed = material("matPilotoRadio", new Color3(0.22, 0.04, 0.03), 0.15);
  matLed.emissiveColor = new Color3(0.06, 0.012, 0.01);
  const matLedCarga = material("matLedCargaRadio", new Color3(0.04, 0.2, 0.06), 0.15);
  matLedCarga.emissiveColor = new Color3(0.12, 0.85, 0.3);

  const rotulo = (nombre: string, w: number, h: number, dibujar: (ctx: CanvasRenderingContext2D) => void): PBRMaterial => {
    const tex = new DynamicTexture(`tex_${nombre}`, { width: w, height: h }, scene, true);
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 8;
    dibujar(tex.getContext() as unknown as CanvasRenderingContext2D);
    tex.update();
    const m = material(nombre, new Color3(1, 1, 1), 0.5);
    m.albedoTexture = tex;
    return m;
  };

  // --- Pantalla ---------------------------------------------------------------
  const texLcd = new DynamicTexture("texLcdRadio", { width: 256, height: 112 }, scene, true);
  texLcd.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  texLcd.anisotropicFilteringLevel = 8;
  const matLcd = material("matLcdRadio", new Color3(1, 1, 1), 0.3);
  matLcd.albedoTexture = texLcd;
  matLcd.emissiveTexture = texLcd;
  // En reposo, una retroiluminación mínima: lo justo para que la pantalla se
  // distinga del plástico desde la silla. Con la llamada se enciende entera.
  matLcd.emissiveColor = new Color3(0.3, 0.3, 0.3);

  function pintarLcd(aviso: boolean, rx: boolean): void {
    const ctx = texLcd.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = aviso ? "#b9e27c" : "#7f8f70";
    ctx.fillRect(0, 0, 256, 112);
    // El cristal hace sombra arriba y abajo sobre el fondo.
    const sombra = ctx.createLinearGradient(0, 0, 0, 112);
    sombra.addColorStop(0, "rgba(0,0,0,0.22)");
    sombra.addColorStop(0.25, "rgba(0,0,0,0)");
    sombra.addColorStop(0.8, "rgba(0,0,0,0)");
    sombra.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = sombra;
    ctx.fillRect(0, 0, 256, 112);

    const tinta = "rgba(16, 28, 10, 0.9)";
    const fantasma = "rgba(16, 28, 10, 0.08)";
    // Barras de señal.
    const barras = aviso ? 4 : 3;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < barras ? tinta : fantasma;
      ctx.fillRect(14 + i * 9, 30 - (i + 1) * 5, 6, (i + 1) * 5);
    }
    // Batería llena.
    ctx.strokeStyle = tinta;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(206, 9, 32, 17);
    ctx.fillStyle = tinta;
    ctx.fillRect(238, 13, 4, 9);
    for (let i = 0; i < 3; i++) ctx.fillRect(210 + i * 9.5, 13, 7, 9);

    // Texto principal: los segmentos apagados se ven apenas debajo.
    ctx.font = "bold 36px Consolas, 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = fantasma;
    ctx.fillText("88 8888888", 14, 76);
    ctx.fillStyle = tinta;
    ctx.fillText(aviso ? `${rx ? "RX" : "  "} CENTRAL` : "CH 03  SEG", 14, 76);
    ctx.font = "bold 15px Consolas, 'Courier New', monospace";
    ctx.fillText(aviso ? "LLAMADA ENTRANTE" : "UHF 1  ESCUCHA", 14, 100);
    texLcd.update();
  }
  pintarLcd(false, false);

  // --- Cargador (raíz) ------------------------------------------------------
  const base = loft(scene, "baseRadio", [
    { y: 0, x: 0.056, delante: 0.05, forma: 3.4 },
    { y: 0.004, x: 0.058, delante: 0.052, forma: 3.4 },
    { y: 0.03, x: 0.055, delante: 0.049, atras: 0.051, forma: 3.4 },
    { y: 0.042, x: 0.05, delante: 0.043, atras: 0.047, forma: 3.2 },
    { y: 0.045, x: 0.046, delante: 0.039, atras: 0.043, forma: 3 },
  ], { lados: 40, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 8 });
  base.material = matBase;
  base.position.copyFrom(posicion);
  base.rotation.y = giro;
  base.receiveShadows = true;

  const poner = (m: Mesh, padre: Mesh, mat: PBRMaterial, x: number, y: number, z: number): Mesh => {
    m.parent = padre;
    m.position.set(x, y, z);
    m.material = mat;
    return m;
  };

  // Boca del cargador, donde entra la radio.
  poner(loft(scene, "bocaBaseRadio", [
    { y: 0.0445, x: 0.041, delante: 0.033, forma: 3.4 },
    { y: 0.0465, x: 0.039, delante: 0.031, forma: 3.4 },
  ], { lados: 32, tapaArriba: true }), base, matNegro, 0, 0, 0.002);

  const ledCarga = poner(MeshBuilder.CreateSphere("ledCargaRadio", { diameter: 0.006, segments: 10 }, scene), base, matLedCarga, 0.034, 0.03, -0.049);
  ledCarga.scaling.z = 0.45;

  // El cable del cargador, hasta el pasacables del mesón.
  const recorrido = Curve3.CreateCatmullRomSpline(
    [new Vector3(0, 0.014, 0.05), new Vector3(0.004, 0.006, 0.072), new Vector3(0.008, 0.0035, 0.098), new Vector3(0.004, 0.003, 0.118), new Vector3(0, -0.03, 0.124)],
    8
  ).getPoints();
  poner(MeshBuilder.CreateTube("cableRadio", { path: recorrido, radius: 0.0024, tessellation: 10, cap: Mesh.CAP_ALL }, scene), base, matNegro, 0, 0, 0);
  const pasacables = poner(MeshBuilder.CreateTorus("pasacablesRadio", { diameter: 0.026, thickness: 0.004, tessellation: 24 }, scene), base, matNegro, 0, 0.001, 0.124);
  pasacables.isPickable = false;
  poner(MeshBuilder.CreateDisc("agujeroPasacablesRadio", { radius: 0.011, tessellation: 20 }, scene), base, material("matAgujeroRadio", new Color3(0, 0, 0), 1), 0, 0.0008, 0.124).rotation.x = Math.PI / 2;

  // --- Cuerpo -----------------------------------------------------------------
  //
  // Metido en el cargador y algo reclinado hacia atrás, con el frente mirando
  // al guardia. La costura a la altura de la batería es la línea que dice que
  // el pack se quita.
  const cuerpo = loft(scene, "cuerpoRadio", [
    { y: 0, x: 0.031, delante: 0.019, atras: 0.021, forma: 4.5 },
    { y: 0.004, x: 0.034, delante: 0.021, atras: 0.023, forma: 4.5 },
    { y: 0.05, x: 0.035, delante: 0.022, atras: 0.024, forma: 4.5 },
    { y: 0.0515, x: 0.0336, delante: 0.0206, atras: 0.0226, forma: 4.5 },
    { y: 0.054, x: 0.035, delante: 0.022, atras: 0.024, forma: 4.5 },
    { y: 0.15, x: 0.035, delante: 0.022, atras: 0.024, forma: 4.5 },
    { y: 0.157, x: 0.032, delante: 0.02, atras: 0.022, forma: 4.2 },
    { y: 0.161, x: 0.024, delante: 0.014, atras: 0.016, forma: 3.5 },
    { y: 0.1625, x: 0.01, delante: 0.006, forma: 3 },
  ], { lados: 48, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 7 });
  poner(cuerpo, base, matPlastico, 0, 0.02, 0.002);
  cuerpo.rotation.x = 0.14;
  cuerpo.receiveShadows = true;

  const FRENTE = -0.0222;

  // Rejilla, pantalla con su cristal, teclas y rótulo.
  poner(MeshBuilder.CreatePlane("rejillaRadio", { width: 0.054, height: 0.056 }, scene), cuerpo, matRejilla, 0, 0.083, FRENTE - 0.0003);
  poner(MeshBuilder.CreatePlane("marcoLcdRadio", { width: 0.05, height: 0.027 }, scene), cuerpo, matCristal, 0, 0.133, FRENTE - 0.0004);
  poner(MeshBuilder.CreatePlane("lcdRadio", { width: 0.041, height: 0.018 }, scene), cuerpo, matLcd, 0, 0.1335, FRENTE - 0.0007);
  [-1, 1].forEach((lado) => {
    poner(
      MeshBuilder.CreateCapsule(`teclaRadio_${lado}`, { radius: 0.0032, height: 0.014, tessellation: 12, orientation: Vector3.Right() }, scene),
      cuerpo,
      matCaucho,
      lado * 0.011,
      0.1155,
      FRENTE - 0.0006
    ).scaling.z = 0.55;
  });
  poner(MeshBuilder.CreatePlane("rotuloRadio", { width: 0.05, height: 0.009 }, scene), cuerpo, rotulo("matRotuloRadio", 256, 48, (ctx) => {
    ctx.fillStyle = "#08090a";
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = "#8d939b";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("UHF  ·  16 CH  ·  4 W", 128, 26);
  }), 0, 0.044, FRENTE - 0.0003);

  // Bandas de caucho a los costados, pulsador de habla y botón a la izquierda,
  // tapa del conector con su tornillo a la derecha.
  [-1, 1].forEach((lado) => {
    const banda = poner(MeshBuilder.CreatePlane(`bandaRadio_${lado}`, { width: 0.03, height: 0.095 }, scene), cuerpo, matCaucho, lado * 0.0353, 0.1, 0.001);
    banda.rotation.y = lado < 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  const ptt = poner(MeshBuilder.CreateCapsule("pttRadio", { radius: 0.0042, height: 0.036, tessellation: 14 }, scene), cuerpo, matCaucho, -0.0358, 0.112, -0.002);
  ptt.scaling.x = 0.55;
  const boton = poner(MeshBuilder.CreateCapsule("botonLateralRadio", { radius: 0.0034, height: 0.011, tessellation: 12 }, scene), cuerpo, matCaucho, -0.0356, 0.084, -0.002);
  boton.scaling.x = 0.55;
  poner(MeshBuilder.CreateBox("tapaConectorRadio", { width: 0.002, height: 0.024, depth: 0.018 }, scene), cuerpo, matCaucho, 0.0357, 0.126, 0);
  const tornillo = poner(MeshBuilder.CreateCylinder("tornilloRadio", { diameter: 0.0035, height: 0.0012, tessellation: 12 }, scene), cuerpo, matMetal, 0.0369, 0.134, 0);
  tornillo.rotation.z = Math.PI / 2;

  // Clip de cinturón, atrás.
  poner(MeshBuilder.CreateBox("clipRadio", { width: 0.028, height: 0.07, depth: 0.003 }, scene), cuerpo, matNegro, 0, 0.1, 0.0255);

  // --- Arriba: antena, perilla y piloto -------------------------------------
  poner(MeshBuilder.CreateCylinder("collarAntenaRadio", { diameterTop: 0.012, diameterBottom: 0.014, height: 0.009, tessellation: 20 }, scene), cuerpo, matMetal, -0.017, 0.164, 0.001);
  // Antena helicoidal de goma: los anillos alternan grueso y fino a lo largo,
  // que es la espiral de dentro marcándose en la funda.
  const anillos = [];
  const tramos = 26;
  for (let k = 0; k <= tramos; k++) {
    const t = k / tramos;
    const radio = (k % 2 ? 0.0058 : 0.0067) * (1 - 0.3 * t);
    anillos.push({ y: 0.168 + t * 0.098, x: radio, delante: radio });
  }
  anillos.push({ y: 0.269, x: 0.0035, delante: 0.0035 });
  anillos.push({ y: 0.2705, x: 0.0012, delante: 0.0012 });
  poner(loft(scene, "antenaRadio", anillos, { lados: 16, tapaAbajo: true, tapaArriba: true, vPorMetro: 30 }), cuerpo, matCaucho, -0.017, 0, 0.001);

  const perilla = poner(MeshBuilder.CreateCylinder("perillaRadio", { diameter: 0.016, height: 0.013, tessellation: 32 }, scene), cuerpo, matPerilla, 0.012, 0.168, 0.001);
  poner(MeshBuilder.CreateCylinder("tapaPerillaRadio", { diameter: 0.0145, height: 0.0015, tessellation: 32 }, scene), perilla, matNegro, 0, 0.007, 0);
  poner(MeshBuilder.CreateBox("marcaPerillaRadio", { width: 0.0012, height: 0.0008, depth: 0.0055 }, scene), perilla, material("matMarcaRadio", new Color3(0.75, 0.75, 0.72), 0.6), 0, 0.0079, -0.003);
  perilla.rotation.y = 0.9;

  const piloto = poner(MeshBuilder.CreateSphere("pilotoRadio", { diameter: 0.0065, segments: 12 }, scene), cuerpo, matLed, 0.028, 0.1605, -0.009);
  piloto.scaling.y = 0.6;

  // --- Aviso --------------------------------------------------------------------
  let avisando = false;
  let rxAnterior: boolean | null = null;

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (!avisando) return;
    const ahora = performance.now();
    // Latido, no destello: uno brusco se confunde con un fallo de dibujado.
    const pulso = 0.5 + 0.5 * Math.sin(ahora / 260);
    matLed.emissiveColor.set(0.25 + pulso * 1.35, 0.04 + pulso * 0.14, 0.03);
    const rx = Math.floor(ahora / 450) % 2 === 0;
    if (rx !== rxAnterior) {
      rxAnterior = rx;
      pintarLcd(true, rx);
    }
  });
  scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observador));

  return {
    raiz: base,
    avisar(encendido) {
      if (encendido === avisando) return;
      avisando = encendido;
      rxAnterior = null;
      // La retroiluminación: apagada en reposo, encendida con la llamada.
      matLcd.emissiveColor.setAll(encendido ? 1.1 : 0.3);
      if (!encendido) {
        matLed.emissiveColor.set(0.06, 0.012, 0.01);
        pintarLcd(false, false);
      }
    },
  };
}
