import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, Texture, Vector3, VertexBuffer } from "@babylonjs/core";
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

/** La tarjeta de precio: once centímetros por cuatro, como una de verdad. */
const ANCHO_TARJETA = 0.11;
const ALTO_TARJETA = 0.042;
const SALIENTE = 0.006;

/**
 * Qué es cada malla de producto del modelo y a cuánto se vende.
 *
 * ─── POR QUÉ UNA TABLA Y NO PRECIOS SUELTOS ───────────────────────────────
 *
 * Porque el precio es del PRODUCTO, no del cartel. Antes cada tira de balda
 * llevaba una fila de precios inventados que se repetía a lo largo del
 * estante: la misma leche tenía cuatro precios distintos en el mismo metro, y
 * otro más en el refrigerador. Desde dentro del juego eso no se entiende.
 *
 * Ahora sale todo de aquí: los carteles de las góndolas miran QUÉ hay encima
 * de cada tramo de balda y ponen el precio de eso, y el mural de frío usa la
 * misma tabla. Una leche vale 1.090 esté donde esté.
 *
 * Las claves son los nombres de las mallas del .glb; ver ProductosSupermercado.
 */
// ─── QUÉ ES CADA MALLA ────────────────────────────────────────────────────
//
// Los nombres del .glb no dicen qué hay dentro ("Latas 01", "Latas 02"…), así
// que se comprobó uno por uno dejando visible una sola malla y mirando el
// estante: la 02 son los tarros de pasta de tomate, la 03 las bebidas en lata
// y la 01 la conserva. Si Bitplay reexporta el modelo, esto es lo primero que
// hay que volver a mirar.
export const CATALOGO: Record<string, { nombre: string; medida: string; precio: number }> = {
  Cereales: { nombre: "CEREAL", medida: "350 g", precio: 2490 },
  Pastas: { nombre: "PASTA CON QUESO", medida: "400 g", precio: 1190 },
  Leches: { nombre: "LECHE ENTERA", medida: "1 L", precio: 1090 },
  "Latas 01": { nombre: "CONSERVA", medida: "400 g", precio: 1290 },
  "Latas 02": { nombre: "PASTA DE TOMATE", medida: "200 g", precio: 890 },
  "Latas 03": { nombre: "BEBIDA EN LATA", medida: "350 ml", precio: 690 },
  Botellas: { nombre: "BEBIDA", medida: "1,5 L", precio: 1490 },
};

/** El orden en que van las celdas dentro del atlas de tarjetas. */
const CLAVES = Object.keys(CATALOGO);

export function montarGrafica(scene: Scene, piso: number): void {
  cartelesDePrecio(scene);
  letreroDeCaja(scene, piso);
  letreroDeSalida(scene, piso);
  carteldeOfertas(scene, piso);
  bandaVidrieras(scene);
}

/**
 * El material de las tarjetas: un atlas con una celda por producto.
 *
 * ─── POR QUÉ UN ATLAS Y NO UNA TEXTURA POR PRECIO ─────────────────────────
 *
 * Porque así todas las tarjetas del local —las ciento y pico de las góndolas y
 * las del mural de frío— comparten material y se pueden fundir en una sola
 * malla. Con una textura por producto serían siete materiales y siete llamadas
 * de dibujo, catorce contando el reflejo del piso.
 *
 * Cada tarjeta elige su celda horneando sus UV al crearse (ver tarjetaPrecio).
 */
export function materialDePrecios(scene: Scene): PBRMaterial {
  const existente = scene.getMaterialByName("matTarjetaPrecio");
  if (existente instanceof PBRMaterial) return existente;

  const ALTO_CELDA = 100;
  const material = materialPintadoNitido(
    scene,
    "matTarjetaPrecio",
    260,
    ALTO_CELDA * CLAVES.length,
    2,
    (ctx, w) => {
      CLAVES.forEach((clave, i) => {
        const { nombre, medida, precio } = CATALOGO[clave];
        const y0 = i * ALTO_CELDA;
        // El cartoncillo.
        ctx.fillStyle = "#f8f8f6";
        ctx.fillRect(0, y0, w, ALTO_CELDA);
        ctx.strokeStyle = "#cfd3cd";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, y0 + 1, w - 2, ALTO_CELDA - 2);
        // Qué es, arriba a la izquierda, como en cualquier estante.
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#23282b";
        ctx.font = "700 17px system-ui, 'Segoe UI', sans-serif";
        ctx.fillText(nombre, 11, y0 + 25);
        ctx.fillStyle = "#71777c";
        ctx.font = "500 14px system-ui, 'Segoe UI', sans-serif";
        ctx.fillText(medida, 11, y0 + 43);
        // El código de barras: chico y en una esquina, no una regla de lado a
        // lado como estaba antes.
        ctx.fillStyle = "rgba(40,46,50,0.75)";
        for (let b = 0; b < 13; b++) {
          ctx.fillRect(11 + b * 3.2, y0 + 57, b % 3 === 0 ? 1.6 : 1, 26);
        }
        // Y el precio, que es lo que se lee de lejos.
        ctx.textAlign = "right";
        ctx.fillStyle = "#15181a";
        ctx.font = "800 44px system-ui, 'Segoe UI', sans-serif";
        ctx.fillText("$" + precio.toLocaleString("es-CL"), w - 12, y0 + 84);
      });
    }
  );
  const textura = material.albedoTexture;
  if (textura instanceof Texture) {
    textura.wrapU = Texture.CLAMP_ADDRESSMODE;
    textura.wrapV = Texture.CLAMP_ADDRESSMODE;
  }
  material.maxSimultaneousLights = 10;
  return material;
}

/**
 * Una tarjeta de precio suelta, con la celda del producto que le toca.
 *
 * Se devuelve sin material: quien la pide funde todas las suyas en una malla y
 * le pone el de materialDePrecios.
 *
 * @param giro  Hacia dónde mira. Un plano de Babylon mira a −Z sin girar.
 */
export function tarjetaPrecio(
  scene: Scene,
  nombre: string,
  clave: string,
  x: number,
  y: number,
  z: number,
  giro: number
): Mesh | null {
  const celda = CLAVES.indexOf(clave);
  if (celda < 0) return null;
  const malla = MeshBuilder.CreatePlane(nombre, { width: ANCHO_TARJETA, height: ALTO_TARJETA }, scene);
  malla.position.set(x, y, z);
  malla.rotation.y = giro;
  const uv = malla.getVerticesData(VertexBuffer.UVKind);
  if (uv) {
    // La celda 0 es la de arriba del lienzo, y en las UV el 1 es arriba: por
    // eso se cuenta al revés.
    const desde = (CLAVES.length - 1 - celda) / CLAVES.length;
    for (let i = 1; i < uv.length; i += 2) uv[i] = desde + uv[i] / CLAVES.length;
    malla.setVerticesData(VertexBuffer.UVKind, uv);
  }
  return malla;
}

/**
 * Los carteles de precio de las góndolas: uno por cada producto de cada balda.
 *
 * ─── POR QUÉ SE MIDE LO QUE HAY EN LA BALDA ───────────────────────────────
 *
 * Porque un cartel de precio dice el precio DE LO QUE TIENE ENCIMA. La versión
 * anterior era una cinta con precios repetidos cada veintiséis centímetros: en
 * una balda con tres productos salían diez etiquetas, cuatro precios distintos
 * para la misma leche, y de cerca la tira de códigos de barras parecía una
 * regla de medir.
 *
 * Aquí se mira la geometría: cada malla de producto del modelo se recorre, se
 * ve en qué balda, en qué cara de qué góndola y en qué tramo cae cada envase,
 * y se juntan los tramos seguidos del mismo producto. Cada tramo se lleva UNA
 * tarjeta, centrada, con el precio de ese producto sacado del catálogo. Si una
 * balda tiene tres productos, salen tres tarjetas.
 *
 * Todas fundidas en una malla: un local lleno de precios cuesta un dibujo.
 */
function cartelesDePrecio(scene: Scene): void {
  /** Una cara de góndola: por dónde se recorre y hacia dónde mira. */
  interface Cara {
    clave: string;
    /** Centro de la góndola en el eje que no se recorre. */
    eje: number;
    /** De qué lado del eje está esta cara: −1 o +1. */
    lado: number;
    /** Dónde se cuelgan las tarjetas en ese eje. */
    fijo: number;
    giro: number;
    /** Si la balda se recorre a lo largo de Z (góndolas del fondo) o de X. */
    porZ: boolean;
    desde: number;
    hasta: number;
  }

  const caras: Cara[] = [];
  EJES_FONDO.forEach((eje, g) =>
    [-1, 1].forEach((lado) =>
      caras.push({
        clave: `f${g}_${lado}`,
        eje,
        lado,
        fijo: eje + lado * (VUELO + SALIENTE),
        giro: lado < 0 ? Math.PI / 2 : -Math.PI / 2,
        porZ: true,
        desde: FONDO_Z[0],
        hasta: FONDO_Z[1],
      })
    )
  );
  TRAMOS_DELANTERA.forEach(([x0, x1], t) =>
    [-1, 1].forEach((lado) =>
      caras.push({
        clave: `d${t}_${lado}`,
        eje: EJE_DELANTERA,
        lado,
        fijo: EJE_DELANTERA + lado * (VUELO + SALIENTE),
        giro: lado < 0 ? 0 : Math.PI,
        porZ: false,
        desde: x0,
        hasta: x1,
      })
    )
  );

  // --- Qué hay encima de cada palmo de balda --------------------------------
  //
  // Se mira solo la franja de veintidós centímetros justo sobre la balda: es
  // donde está la base del envase. Mirando más arriba, un cereal de medio
  // metro contaría también en la balda de encima.
  const PASO = 0.05;
  const BANDA = 0.22;
  const ocupado = new Map<string, string>();
  const punto = new Vector3();
  for (const clave of CLAVES) {
    const malla = scene.getMeshByName(clave);
    if (!(malla instanceof Mesh)) continue;
    const pos = malla.getVerticesData(VertexBuffer.PositionKind);
    if (!pos) continue;
    const mundo = malla.getWorldMatrix();
    // Uno de cada tres vértices: para saber si hay producto o no, sobra.
    for (let i = 0; i + 8 < pos.length; i += 9) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], mundo, punto);
      const nivel = BALDAS.findIndex((balda) => punto.y > balda + 0.01 && punto.y < balda + BANDA);
      if (nivel < 0) continue;
      for (const cara of caras) {
        const separacion = cara.porZ ? punto.x - cara.eje : punto.z - cara.eje;
        if (Math.sign(separacion) !== cara.lado || Math.abs(separacion) > 0.63) continue;
        const largo = cara.porZ ? punto.z : punto.x;
        if (largo < cara.desde || largo > cara.hasta) continue;
        ocupado.set(`${cara.clave}|${nivel}|${Math.round(largo / PASO)}`, clave);
        break;
      }
    }
  }

  // --- Un cartel por tramo seguido -----------------------------------------
  const tarjetas: Mesh[] = [];
  for (const cara of caras) {
    for (let nivel = 0; nivel < BALDAS.length; nivel++) {
      const primero = Math.ceil(cara.desde / PASO);
      const ultimo = Math.floor(cara.hasta / PASO);
      const tramo: (string | null)[] = [];
      for (let b = primero; b <= ultimo; b++) {
        tramo.push(ocupado.get(`${cara.clave}|${nivel}|${b}`) ?? null);
      }
      let i = 0;
      while (i < tramo.length) {
        const que = tramo[i];
        if (!que) {
          i++;
          continue;
        }
        let j = i;
        let lleno = i;
        while (j + 1 < tramo.length) {
          const siguiente = tramo[j + 1];
          if (siguiente === que) {
            j++;
            lleno = j;
            continue;
          }
          // Un hueco de hasta diez centímetros no parte el grupo: es el sitio
          // del que alguien acaba de sacar un envase.
          if (siguiente === null && j + 1 - lleno <= 2) {
            j++;
            continue;
          }
          break;
        }
        const ancho = (lleno - i + 1) * PASO;
        if (ancho >= 0.16) {
          const centro = (primero + (i + lleno) / 2) * PASO;
          const alto = BALDAS[nivel] - ALTO_TARJETA / 2 - 0.004;
          const tarjeta = tarjetaPrecio(
            scene,
            `precio_${cara.clave}_${nivel}_${i}`,
            que,
            cara.porZ ? cara.fijo : centro,
            alto,
            cara.porZ ? centro : cara.fijo,
            cara.giro
          );
          if (tarjeta) tarjetas.push(tarjeta);
        }
        i = lleno + 1;
      }
    }
  }

  if (tarjetas.length === 0) return;
  const fundida = Mesh.MergeMeshes(tarjetas, true, true);
  if (!fundida) return;
  fundida.name = "cartelesDePrecio";
  fundida.material = materialDePrecios(scene);
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
 * El "SALIDA" sobre la puerta, por dentro.
 *
 * ─── POR QUÉ NO VA EN EL PISO ─────────────────────────────────────────────
 *
 * Porque una flecha pintada en el suelo de una sala de 16 × 14 m con una sola
 * puerta no la lee nadie: lo que se mira al buscar la salida es la altura de
 * los carteles. Y porque el piso de esta sala es un porcelanato pulido que
 * refleja —lo pintado saldría también reflejado y doblado—, así que una
 * calcomanía ahí es de las pocas cosas que sí se notarían de más.
 *
 * Sobre el hueco de la puerta, justo encima de la caja del motor, que es
 * donde va en cualquier local.
 */
function letreroDeSalida(scene: Scene, piso: number): void {
  const material = materialPintadoNitido(scene, "matLetreroSalida", 300, 96, 3, (ctx, w, h) => {
    ctx.fillStyle = "#1f5d32";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = "#f2f6f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(h * 0.42)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("SALIDA", w / 2, h * 0.53);
    ctx.letterSpacing = "0px";
  });

  const letrero = MeshBuilder.CreatePlane("letreroSalida", { width: 0.62, height: 0.2 }, scene);
  letrero.material = material;
  // Sin girar mira a −Z, o sea, a la sala: es el cartel que se ve al volver
  // hacia la puerta, no el que ve quien entra.
  letrero.position.set(3.03, piso + 2.46, 7.08);
  letrero.isPickable = false;
  letrero.receiveShadows = true;
  letrero.freezeWorldMatrix();
}

/**
 * Un cartel de ofertas colgado sobre la fila delantera.
 *
 * Uno solo, y sobre una góndola —no sobre un paso—: lo que hace que un local
 * parezca de verdad es que TENGA promoción, no que esté empapelado. Con uno
 * por pasillo, la sala se convierte en un techo de carteles y encima tapan
 * los números de pasillo, que son los que el turno necesita que se lean.
 */
function carteldeOfertas(scene: Scene, piso: number): void {
  const ANCHO = 1.5;
  const ALTO = 0.4;
  const X = -5.3;
  const Z = 1.925;
  const Y = piso + 2.55;

  const material = materialPintadoNitido(scene, "matCartelOfertas", 420, 112, 3, (ctx, w, h) => {
    ctx.fillStyle = "#b8232a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = "#fdf6ef";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(h * 0.4)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.letterSpacing = "5px";
    ctx.fillText("OFERTAS", w / 2, h * 0.4);
    ctx.font = `600 ${Math.round(h * 0.17)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.fillText("DE LA SEMANA", w / 2, h * 0.72);
    ctx.letterSpacing = "0px";
  });

  [Math.PI, 0].forEach((giro, cara) => {
    const cartel = MeshBuilder.CreatePlane(`cartelOfertas_${cara}`, { width: ANCHO, height: ALTO }, scene);
    cartel.material = material;
    cartel.rotation.y = giro;
    cartel.position.set(X, Y, Z + (cara === 0 ? 0.006 : -0.006));
    cartel.isPickable = false;
    cartel.receiveShadows = true;
    cartel.freezeWorldMatrix();
  });

  const metal = materialLiso(scene, "matVarillaOfertas", new Color3(0.55, 0.56, 0.58), 0.4, 0.6);
  metal.maxSimultaneousLights = 10;
  const largo = Math.max(0.3, piso + 5 - (Y + ALTO / 2));
  const varillas = [-1, 1].map((lado) => {
    const varilla = MeshBuilder.CreateCylinder(
      `varillaOfertas_${lado}`,
      { height: largo, diameter: 0.022, tessellation: 8 },
      scene
    );
    varilla.position.set(X + lado * (ANCHO / 2 - 0.12), Y + ALTO / 2 + largo / 2, Z);
    return varilla;
  });
  const fundida = Mesh.MergeMeshes(varillas, true, true);
  if (fundida) {
    fundida.name = "varillasOfertas";
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
  /**
   * A la altura del pecho y estrecha: diez centímetros.
   *
   * Estuvo en ocho y medio transparente, y de lejos no se leía como una banda
   * sino como una raya rara cruzando el cristal, que es peor que no ponerla.
   */
  const ALTURA = 1.46;
  const ALTO = 0.1;
  /** Por dentro del vidrio, que está en Z 7,25. */
  const Z = 7.225;

  const esmerilado = new PBRMaterial("matBandaVidriera", scene);
  esmerilado.albedoColor = new Color3(0.93, 0.95, 0.96);
  esmerilado.alpha = 0.62;
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
