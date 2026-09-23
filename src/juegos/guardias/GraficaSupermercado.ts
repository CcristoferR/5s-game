import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, Texture, VertexBuffer } from "@babylonjs/core";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import { materialLiso } from "./UtileriaBodega";

// ===========================================================================
// La gráfica del local
// ===========================================================================
//
// Las cenefas de precio de las baldas, el número de la caja y la banda
// esmerilada de las vidrieras.
//
// ─── POR QUÉ ──────────────────────────────────────────────────────────────
//
// Porque el local no tenía una sola letra suya. Había productos con su
// etiqueta y góndolas bien puestas, pero ni un precio, ni un número de caja,
// ni una marca en el vidrio: un almacén ordenado, no una tienda. Lo que
// distingue a un supermercado de un depósito con estanterías es justamente
// eso, y son tres cosas chicas.
//
// ─── Y POR QUÉ TAN POCO ───────────────────────────────────────────────────
//
// A propósito. Es fácil pasarse: carteles de oferta colgando de todos lados,
// flechas en el piso, vinilos tapando las vidrieras. Eso no se lee como una
// tienda, se lee como una tienda de juego. Aquí va lo que hay en cualquier
// local de verdad y casi no se nota hasta que falta.
//
// ─── DE DÓNDE SALEN LAS MEDIDAS ───────────────────────────────────────────
//
// Medidas sobre la malla "Estanterías" ya cargada, cara por cara: las baldas
// son las caras horizontales de área grande y están a 0,38 · 0,88 · 1,38
// —altura de mundo, no sobre el piso—; los frentes de cada góndola, a 56,5 cm
// del eje, que son los seis ejes X −8,335 · −5,265 · −2,195 · 0,875 · 3,945 ·
// 7,015 del fondo y el eje Z 1,925 de la fila delantera.

/** Altura de mundo de la cara de arriba de cada balda. */
const BALDAS = [0.38, 0.88, 1.38];
/** Del eje de una góndola a la nariz de sus baldas. */
const VUELO = 0.565;
/** Ejes de las seis góndolas del fondo. */
const EJES_FONDO = [-8.335, -5.265, -2.195, 0.875, 3.945, 7.015];
/** Lo que ocupan a lo largo: del muro del fondo a la boca del pasillo. */
const FONDO_Z: [number, number] = [-7.1, -1.37];
/** Eje de la fila delantera y sus dos tramos. */
const EJE_DELANTERA = 1.925;
const TRAMOS_DELANTERA: readonly [number, number][] = [
  [-8.11, -2.43],
  [0.48, 6.16],
];

/** Alto de la cenefa y cuánto sobresale de la cara de la balda. */
const ALTO_CENEFA = 0.032;
const SALIENTE = 0.005;
/**
 * Lo que mide en el local un tramo entero de la textura.
 *
 * Cuatro precios cada 1,04 m: veintiséis centímetros por etiqueta, que es lo
 * que ocupa una en un estante de verdad. Y a esa medida la textura queda a
 * unos 2.000 píxeles por metro en los dos ejes —ni estirada ni desperdiciada—,
 * que es la densidad a la que un texto se lee en este juego.
 */
const TRAMO_TEXTURA = 1.04;

/** Los precios que se ven en las cenefas. */
const PRECIOS = [1290, 890, 2450, 1690];

export function montarGrafica(scene: Scene, piso: number): void {
  cenefasDePrecio(scene);
  letreroDeCaja(scene, piso);
  bandaVidrieras(scene);
}

/**
 * Las cenefas de precio, colgadas de la nariz de cada balda.
 *
 * Cuarenta y dos tiras fundidas en una sola malla con una sola textura: un
 * estante con precios no puede costar cuarenta y dos llamadas de dibujo, y
 * menos aún el doble, que es lo que costaría contando el reflejo del piso.
 */
function cenefasDePrecio(scene: Scene): void {
  const material = materialPintadoNitido(scene, "matCenefaPrecio", 1024, 24, 2, (ctx, w, h) => {
    ctx.fillStyle = "#f4f5f3";
    ctx.fillRect(0, 0, w, h);
    // La ranura de abajo del portaprecios, que es lo que le da el canto.
    ctx.fillStyle = "#c2c6c1";
    ctx.fillRect(0, h - 2.5, w, 2.5);
    const paso = w / PRECIOS.length;
    PRECIOS.forEach((precio, i) => {
      const x = i * paso;
      ctx.fillStyle = "#1b2a1a";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(h * 0.52)}px system-ui, 'Segoe UI', sans-serif`;
      ctx.fillText("$" + precio.toLocaleString("es-CL"), x + paso * 0.08, h * 0.44);
      // El código de barras, que de lejos es la manchita gris que se ve en
      // cualquier estante.
      ctx.fillStyle = "rgba(35,45,35,0.55)";
      for (let b = 0; b < 16; b++) ctx.fillRect(x + paso * 0.08 + b * 5, h * 0.66, 1.8, h * 0.24);
      // La separación entre etiqueta y etiqueta.
      ctx.fillStyle = "rgba(120,128,120,0.5)";
      ctx.fillRect(x + paso - 1.5, 2, 1.5, h - 5);
    });
  });
  const textura = material.albedoTexture;
  if (textura instanceof Texture) {
    // La tira repite la textura a lo largo de sus casi seis metros, así que
    // tiene que envolver y no engancharse en el último píxel.
    textura.wrapU = Texture.WRAP_ADDRESSMODE;
    textura.wrapV = Texture.CLAMP_ADDRESSMODE;
  }

  const tiras: Mesh[] = [];
  /**
   * Una tira sobre la nariz de una balda.
   *
   * @param giro  Hacia dónde mira. Un plano de Babylon mira a −Z sin girar.
   */
  const tira = (nombre: string, largo: number, x: number, y: number, z: number, giro: number, desfase: number): void => {
    const malla = MeshBuilder.CreatePlane(nombre, { width: largo, height: ALTO_CENEFA }, scene);
    malla.position.set(x, y, z);
    malla.rotation.y = giro;
    // Las UV se hornean aquí: así la textura se repite cada 1,04 m midiendo lo
    // mismo en todas las tiras, largas o cortas, y cada una empieza por un
    // precio distinto —si no, las tres baldas de una góndola enseñarían la
    // misma fila de números una encima de otra.
    const uv = malla.getVerticesData(VertexBuffer.UVKind);
    if (uv) {
      const veces = largo / TRAMO_TEXTURA;
      for (let i = 0; i < uv.length; i += 2) uv[i] = uv[i] * veces + desfase;
      malla.setVerticesData(VertexBuffer.UVKind, uv);
    }
    tiras.push(malla);
  };

  const largoFondo = FONDO_Z[1] - FONDO_Z[0];
  const centroFondo = (FONDO_Z[0] + FONDO_Z[1]) / 2;
  EJES_FONDO.forEach((eje, g) => {
    BALDAS.forEach((alto, b) => {
      const y = alto - ALTO_CENEFA / 2 - 0.004;
      const desfase = ((g * 3 + b) % 4) / 4;
      // Las góndolas del fondo miran a sus dos pasillos, uno por cada cara.
      tira(`cenefa_f${g}_${b}_izq`, largoFondo, eje - VUELO - SALIENTE, y, centroFondo, Math.PI / 2, desfase);
      tira(`cenefa_f${g}_${b}_der`, largoFondo, eje + VUELO + SALIENTE, y, centroFondo, -Math.PI / 2, desfase + 0.5);
    });
  });

  TRAMOS_DELANTERA.forEach(([x0, x1], t) => {
    const largo = x1 - x0;
    const centro = (x0 + x1) / 2;
    BALDAS.forEach((alto, b) => {
      const y = alto - ALTO_CENEFA / 2 - 0.004;
      const desfase = ((t * 5 + b) % 4) / 4;
      tira(`cenefa_d${t}_${b}_atras`, largo, centro, y, EJE_DELANTERA - VUELO - SALIENTE, 0, desfase);
      tira(`cenefa_d${t}_${b}_frente`, largo, centro, y, EJE_DELANTERA + VUELO + SALIENTE, Math.PI, desfase + 0.25);
    });
  });

  const fundida = Mesh.MergeMeshes(tiras, true, true);
  if (!fundida) return;
  fundida.name = "cenefasDePrecio";
  fundida.material = material;
  fundida.isPickable = false;
  fundida.receiveShadows = true;
  fundida.freezeWorldMatrix();
}

/**
 * El número de la caja, colgado sobre el mostrador.
 *
 * Mismo verde, mismo tamaño de letra y mismas varillas que los letreros de
 * pasillo (ver PasillosSupermercado): en un local la señalética es toda de la
 * misma familia, y aquí además el jugador ya aprendió a leer esos carteles.
 */
function letreroDeCaja(scene: Scene, piso: number): void {
  const ANCHO = 0.78;
  const ALTO = 0.3;
  const X = 8.73;
  const Z = 4.07;
  const Y = piso + 2.5;

  const material = materialPintadoNitido(scene, "matLetreroCaja", 260, 100, 3, (ctx, w, h) => {
    ctx.fillStyle = "#2f6b2c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = "#f4f6f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(h * 0.46)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.fillText("CAJA 1", w / 2, h * 0.53);
  });

  // Las dos caras: una mira a la sala y la otra a la salida, que es por donde
  // se vuelve desde la puerta.
  [Math.PI / 2, -Math.PI / 2].forEach((giro, cara) => {
    const letrero = MeshBuilder.CreatePlane(`letreroCaja_${cara}`, { width: ANCHO, height: ALTO }, scene);
    letrero.material = material;
    letrero.rotation.y = giro;
    letrero.position.set(X + (cara === 0 ? -0.006 : 0.006), Y, Z);
    letrero.isPickable = false;
    letrero.receiveShadows = true;
    letrero.freezeWorldMatrix();
  });

  const metal = materialLiso(scene, "matVarillaCaja", new Color3(0.55, 0.56, 0.58), 0.4, 0.6);
  metal.maxSimultaneousLights = 10;
  const largo = Math.max(0.3, piso + 5 - (Y + ALTO / 2));
  const varillas = [-1, 1].map((lado) => {
    const varilla = MeshBuilder.CreateCylinder(
      `varillaCaja_${lado}`,
      { height: largo, diameter: 0.022, tessellation: 8 },
      scene
    );
    varilla.position.set(X, Y + ALTO / 2 + largo / 2, Z + lado * (ANCHO / 2 - 0.1));
    return varilla;
  });
  const fundida = Mesh.MergeMeshes(varillas, true, true);
  if (fundida) {
    fundida.name = "varillasCaja";
    fundida.material = metal;
    fundida.isPickable = false;
    fundida.freezeWorldMatrix();
  }
}

/**
 * La banda esmerilada de las vidrieras.
 *
 * ─── QUÉ ES ───────────────────────────────────────────────────────────────
 *
 * La franja mate que llevan todos los locales a la altura del pecho para que
 * nadie se estrelle contra un vidrio que no ve. Las puertas del local ya
 * llevan la suya (ver FachadaSupermercado); las vidrieras no, y era lo único
 * que las delataba como huecos vacíos en vez de cristales.
 *
 * Es lo más discreto que se le puede poner a una vidriera —no lleva texto ni
 * color— y sin embargo es lo que hace que el vidrio se vea. Va por dentro,
 * que es donde se pega el vinilo.
 */
function bandaVidrieras(scene: Scene): void {
  const VENTANAS: readonly [number, number][] = [
    [-3.68, -1.48],
    [-0.77, 1.29],
    [4.775, 6.83],
    [7.545, 9.605],
  ];
  /** A la altura del pecho, y estrecha: ocho centímetros. */
  const ALTURA = 1.46;
  const ALTO = 0.08;
  /** Por dentro del vidrio, que está en Z 7,25. */
  const Z = 7.225;

  const esmerilado = new PBRMaterial("matBandaVidriera", scene);
  esmerilado.albedoColor = new Color3(0.93, 0.95, 0.96);
  esmerilado.alpha = 0.5;
  esmerilado.metallic = 0;
  esmerilado.roughness = 0.62;
  esmerilado.backFaceCulling = false;
  esmerilado.twoSidedLighting = true;
  esmerilado.maxSimultaneousLights = 10;

  const bandas = VENTANAS.map(([x0, x1], i) => {
    const banda = MeshBuilder.CreatePlane(`bandaVidriera_${i}`, { width: x1 - x0 - 0.08, height: ALTO }, scene);
    banda.position.set((x0 + x1) / 2, ALTURA, Z);
    return banda;
  });
  const fundida = Mesh.MergeMeshes(bandas, true, true);
  if (!fundida) return;
  fundida.name = "bandasVidrieras";
  fundida.material = esmerilado;
  fundida.isPickable = false;
  fundida.freezeWorldMatrix();
}
