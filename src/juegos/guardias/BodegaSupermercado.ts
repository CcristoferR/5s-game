import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  PointLight,
  TransformNode,
  type Camera,
} from "@babylonjs/core";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import { fbm, subirMapa } from "./TexturasPBR";
import {
  bloque,
  fundir,
  mapaProcedural,
  materialLiso,
  materialesCarton,
  crearPalletConCarga,
  crearTranspaleta,
  crearEstanteBodega,
  type PiezaBodega,
} from "./UtileriaBodega";

// ===========================================================================
// La bodega del supermercado
// ===========================================================================
//
// El modelo de Bitplay no trae bodega: es una sola sala abierta, y en la
// escena de Maya no hay ni un nodo que se le parezca. Pero un supermercado sin
// bodega no existe, y para un guardia es de los sitios que más importan —ahí
// entra la mercadería y ahí no entra el público—, así que se construye.
//
// ─── POR QUÉ EN ESTA ESQUINA ──────────────────────────────────────────────
//
// Es el único hueco que no obliga a mover nada del modelo: el pasillo libre
// entre la última góndola y el muro del lado de la caja, desde el muro del
// fondo. Cerrarlo ahí deja la bodega detrás de la sala de ventas, a un
// pasillo de la caja, que es donde suele estar. Y no toca el .glb: si Bitplay
// reexporta, la bodega sigue en pie.
//
// ─── MEDIDAS ──────────────────────────────────────────────────────────────
//
// En coordenadas del juego, como la tabla de ZonasSupermercado:
//
//   · Muro del lado de la caja, cara interior: X 9,96.
//   · Muro del fondo, cara interior:           Z −7,11.
//   · Lomo de la última góndola:               X 7,64.
//
// El tabique lateral va a seis centímetros de ese lomo, y el del frente cierra
// a Z −3,0. Queda un cuarto de 2,16 × 4,0 m con la cortina mirando al pasillo.

/** Cara interior del muro del lado de la caja. */
const MURO_X = 9.96;
/** Cara interior del muro del fondo. */
const FONDO_Z = -7.11;

const ESPESOR = 0.1;
/**
 * Tres metros y abierto por arriba, como un tabique de bodega de verdad. Hasta
 * el techo, a seis metros, se leía como un volumen del edificio y no como un
 * cuarto hecho después.
 */
const ALTO_TABIQUE = 3.0;
const ALTO_VANO = 2.2;

/** Dónde está la bodega. La zona "Bodega" sale de aquí. */
export const PLANTA_BODEGA = {
  /** Cara del tabique que da a la góndola. */
  minX: 7.7,
  maxX: MURO_X,
  minZ: FONDO_Z,
  /** Cara del tabique de la cortina, la que da al pasillo. */
  maxZ: -3.0,
  puertaMinX: 8.26,
  puertaMaxX: 9.5,
} as const;

// Cortina de lamas.
const TIRAS = 8;
const ANCHO_TIRA = 0.2;
/** Hasta qué distancia de la cortina la empuja el cuerpo. */
const ALCANCE = 0.6;
/** Medio ancho del cuerpo, con la holgura de los brazos. */
const RADIO_CUERPO = 0.45;
/** Lo que se abre una lama con alguien pasando, en radianes. */
const ABERTURA = 1.05;
const RIGIDEZ = 38;
/** Baja a propósito: al soltarse, la lama se balancea un par de veces. */
const AMORTIGUACION = 5.5;

/**
 * Dónde está el centro de la salida de emergencia, a la altura a la que se ve.
 *
 * Alto a propósito: por debajo del metro y medio lo tapa el pallet que la
 * bloquea, y el punto se usa para saber si el jugador la tiene a la vista (ver
 * SituacionesSupermercado). Apuntando al centro del vano, la respuesta sería
 * siempre "no se ve" — justamente porque está tapada.
 */
export interface Bodega {
  salidaEmergencia: Vector3;
  /**
   * Pone o quita lo que bloquea la salida: el pallet delante y el fleje en la
   * barra.
   *
   * ─── POR QUÉ NO ESTÁ BLOQUEADA DESDE EL PRINCIPIO ───────────────────────
   *
   * Porque la ronda obliga a entrar a la bodega, así que el jugador ve esa
   * puerta en la primera vuelta del turno — y su situación no salta hasta las
   * 17:15. Con el pallet puesto desde el minuto cero, el jugador mira una
   * salida tapada a las 16:05, no pasa nada, y cuando hora y media después sí
   * pasa, lo que ha aprendido es que el juego responde tarde.
   *
   * Poniéndolo en su minuto, lo que ve es lo que hay: a las 16:05 la salida
   * está despejada y a las 17:15 alguien ha dejado un pallet delante y ha
   * amarrado la barra. Eso es una novedad, y por eso hay algo que reportar.
   *
   * No se vuelve a quitar al vencer la ventana: un pallet no se aparta solo.
   * Lo que vence es el plazo para darse cuenta.
   */
  taparSalida(tapada: boolean): void;
  dispose(): void;
}

/**
 * @param piso  Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 */
export function construirBodega(scene: Scene, camara: Camera, piso: number): Bodega {
  const { minX, maxZ, puertaMinX, puertaMaxX } = PLANTA_BODEGA;
  const interiorX = minX + ESPESOR;
  const frenteZ = maxZ - ESPESOR / 2;
  const centroPuerta = (puertaMinX + puertaMaxX) / 2;
  const anchoPuerta = puertaMaxX - puertaMinX;

  // --- Tabiques ---------------------------------------------------------------
  //
  // Gris claro con zócalo verde: los colores del propio local, que tiene los
  // muros grises y las franjas de la marca en ese verde.
  const pintura = new PBRMaterial("matPinturaBodega", scene);
  pintura.albedoTexture = subirMapa(
    scene,
    "texPinturaBodega",
    mapaProcedural(256, (u, v) => {
      const k = 0.94 + fbm(u * 5, v * 5, 17) * 0.1;
      return [0.78 * k, 0.78 * k, 0.765 * k];
    }),
    true
  );
  pintura.roughness = 0.9;
  pintura.metallic = 0;

  const verde = materialLiso(scene, "matZocaloBodega", new Color3(0.23, 0.52, 0.2), 0.6);
  const perfil = materialLiso(scene, "matPerfilBodega", new Color3(0.64, 0.66, 0.68), 0.38, 0.25);
  const amarillo = materialLiso(scene, "matSenalizacionBodega", new Color3(0.92, 0.72, 0.08), 0.55);

  const mitadAlto = piso + ALTO_TABIQUE / 2;
  // El lateral se mete dos centímetros en el muro del fondo y se detiene
  // detrás del tabique del frente. Cara con cara, las dos parpadearían.
  const desdeZ = FONDO_Z - 0.02;
  const hastaZ = maxZ - ESPESOR;
  const anchoIzq = puertaMinX - minX;
  const anchoDer = MURO_X + 0.02 - puertaMaxX;
  const tabiques = fundir(
    [
      bloque(scene, "tabiqueLateral", ESPESOR, ALTO_TABIQUE, hastaZ - desdeZ, minX + ESPESOR / 2, mitadAlto, (desdeZ + hastaZ) / 2),
      bloque(scene, "tabiqueFrenteGondola", anchoIzq, ALTO_TABIQUE, ESPESOR, minX + anchoIzq / 2, mitadAlto, frenteZ),
      bloque(scene, "tabiqueFrenteMuro", anchoDer, ALTO_TABIQUE, ESPESOR, puertaMaxX + anchoDer / 2, mitadAlto, frenteZ),
    ],
    "tabiquesBodega",
    pintura
  );
  tabiques.checkCollisions = true;

  // El dintel va aparte y SIN choque. La cámara choca con una elipse que llega
  // hasta 2,48 m, y el vano mide 2,2 desde la losa: con choque, no se podría
  // pasar por la puerta.
  const dintel = fundir(
    [bloque(scene, "dintelBodega", anchoPuerta, ALTO_TABIQUE - ALTO_VANO, ESPESOR, centroPuerta, piso + (ALTO_TABIQUE + ALTO_VANO) / 2, frenteZ)],
    "dintelBodega",
    pintura
  );

  const Z_FUERA = maxZ + 0.003;
  const Z_DENTRO = hastaZ - 0.003;
  const ALTO_ZOCALO = 0.3;
  const yZocalo = piso + ALTO_ZOCALO / 2;
  const zocalo = fundir(
    [
      bloque(scene, "zocaloLateralFuera", 0.006, ALTO_ZOCALO, maxZ - FONDO_Z, minX - 0.003, yZocalo, (FONDO_Z + maxZ) / 2),
      bloque(scene, "zocaloLateralDentro", 0.006, ALTO_ZOCALO, hastaZ - FONDO_Z, interiorX + 0.003, yZocalo, (FONDO_Z + hastaZ) / 2),
      bloque(scene, "zocaloFrenteFueraA", anchoIzq + 0.006, ALTO_ZOCALO, 0.006, minX - 0.006 + (anchoIzq + 0.006) / 2, yZocalo, Z_FUERA),
      bloque(scene, "zocaloFrenteFueraB", MURO_X - puertaMaxX, ALTO_ZOCALO, 0.006, (puertaMaxX + MURO_X) / 2, yZocalo, Z_FUERA),
      bloque(scene, "zocaloFrenteDentroA", puertaMinX - interiorX, ALTO_ZOCALO, 0.006, (interiorX + puertaMinX) / 2, yZocalo, Z_DENTRO),
      bloque(scene, "zocaloFrenteDentroB", MURO_X - puertaMaxX, ALTO_ZOCALO, 0.006, (puertaMaxX + MURO_X) / 2, yZocalo, Z_DENTRO),
    ],
    "zocaloBodega",
    verde
  );

  const yRemate = piso + ALTO_TABIQUE + 0.0175;
  const perfiles = fundir(
    [
      // Remates de los cantos de arriba.
      bloque(scene, "remateLateral", 0.14, 0.035, maxZ - 0.14 - FONDO_Z, minX + ESPESOR / 2, yRemate, (FONDO_Z + maxZ - 0.14) / 2),
      bloque(scene, "remateFrente", MURO_X - minX + 0.04, 0.035, 0.14, (minX - 0.02 + MURO_X + 0.02) / 2, yRemate, frenteZ),
      // El umbral y el riel del que cuelga la cortina.
      bloque(scene, "umbralBodega", anchoPuerta, 0.008, ESPESOR + 0.04, centroPuerta, piso + 0.004, frenteZ),
      bloque(scene, "rielCortina", anchoPuerta, 0.05, 0.06, centroPuerta, piso + ALTO_VANO - 0.025, frenteZ),
    ],
    "perfilesBodega",
    perfil
  );

  // --- Piso y demarcación --------------------------------------------------------
  //
  // Un centímetro por encima de la losa: más cerca, las dos superficies se
  // pelean por el mismo píxel a distancia.
  const anchoInterior = MURO_X - interiorX;
  const fondoInterior = hastaZ - FONDO_Z;
  const suelo = MeshBuilder.CreateGround("pisoBodega", { width: anchoInterior, height: fondoInterior }, scene);
  suelo.position.set(interiorX + anchoInterior / 2, piso + 0.01, FONDO_Z + fondoInterior / 2);
  const texPiso = subirMapa(
    scene,
    "texPisoBodega",
    mapaProcedural(256, (u, v) => {
      const k = 0.86 + fbm(u * 4, v * 4, 5) * 0.16 + fbm(u * 40, v * 40, 9) * 0.06;
      return [0.47 * k, 0.47 * k, 0.46 * k];
    }),
    true
  );
  texPiso.uScale = 2;
  texPiso.vScale = 3;
  const hormigon = new PBRMaterial("matPisoBodega", scene);
  hormigon.albedoTexture = texPiso;
  hormigon.roughness = 0.82;
  hormigon.metallic = 0;
  suelo.material = hormigon;
  suelo.isPickable = false;
  suelo.freezeWorldMatrix();

  // La transpaleta trabaja dentro de la demarcación amarilla, como en
  // cualquier bodega con recepción de pallets.
  const palletX = interiorX + 0.56;
  const palletZ = -5.6;
  const yCinta = piso + 0.0125;
  const demarcacion = fundir(
    [
      bloque(scene, "cintaFondo", 1.14, 0.003, 0.05, interiorX + 0.6, yCinta, -6.35),
      bloque(scene, "cintaFrente", 1.14, 0.003, 0.05, interiorX + 0.6, yCinta, -4.6),
      bloque(scene, "cintaLado", 0.05, 0.003, 1.8, interiorX + 1.17, yCinta, -5.475),
      // Guardacantos de la puerta: lo primero que golpea un pallet al entrar.
      bloque(scene, "guardacantoA", 0.024, 1.2, ESPESOR + 0.012, puertaMinX + 0.012, piso + 0.7, frenteZ),
      bloque(scene, "guardacantoB", 0.024, 1.2, ESPESOR + 0.012, puertaMaxX - 0.012, piso + 0.7, frenteZ),
    ],
    "senalizacionBodega",
    amarillo
  );

  // --- Letrero sobre la puerta ------------------------------------------------------
  const placa = materialLiso(scene, "matPlacaLetreroBodega", new Color3(0.08, 0.09, 0.1), 0.5);
  const respaldo = fundir(
    [bloque(scene, "respaldoLetreroBodega", 1.04, 0.34, 0.012, centroPuerta, piso + 2.6, maxZ + 0.006)],
    "respaldoLetreroBodega",
    placa
  );
  const letrero = MeshBuilder.CreatePlane("letreroBodega", { width: 1.0, height: 0.3 }, scene);
  letrero.material = materialPintadoNitido(scene, "matLetreroBodega", 500, 150, 3, (ctx, w, h) => {
    ctx.fillStyle = "#2f7a33";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 64px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText("BODEGA", w / 2, h * 0.42);
    ctx.font = "600 21px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText("SOLO PERSONAL AUTORIZADO", w / 2, h * 0.77);
  });
  // Un plano de Babylon mira a −Z; el pasillo está hacia +Z.
  letrero.rotation.y = Math.PI;
  letrero.position.set(centroPuerta, piso + 2.6, maxZ + 0.013);
  letrero.isPickable = false;

  // --- Salida de emergencia -----------------------------------------------------
  //
  // ─── POR QUÉ EXISTE ───────────────────────────────────────────────────────
  //
  // Porque hay una situación del turno que habla de ella (ver
  // SituacionesSupermercado): la salida tapada y la barra amarrada. Sin puerta
  // en la escena, ese panel era un texto sobre una pared lisa — el jugador leía
  // que la salida estaba bloqueada mirando un sitio donde no había salida
  // ninguna.
  //
  // ─── POR QUÉ EN EL MURO DEL FONDO ─────────────────────────────────────────
  //
  // Porque es el único de los cuatro que da a la calle Y que se ve de frente
  // entrando por la cortina. En el muro lateral quedaría de canto: el letrero
  // verde, que es lo que hace entender de un vistazo qué puerta es esa, se
  // leería en escorzo desde cualquier sitio donde se pueda estar de pie.
  //
  // Eso obliga a acortar el estante metálico, que antes ocupaba el fondo de
  // lado a lado. Tapando la puerta, el estante la escondería entera.
  const EMERGENCIA_X = 9.4;
  const ANCHO_HOJA = 0.92;
  const ALTO_HOJA = 2.05;
  /** Donde termina el estante para dejarle sitio a la puerta. */
  const FIN_ESTANTE = 8.86;

  const pinturaHoja = materialLiso(scene, "matHojaEmergencia", new Color3(0.74, 0.75, 0.76), 0.55, 0.1);
  const acero = materialLiso(scene, "matHerrajeEmergencia", new Color3(0.58, 0.59, 0.62), 0.35, 0.65);
  const plastico = materialLiso(scene, "matFlejeEmergencia", new Color3(0.86, 0.66, 0.06), 0.4);

  const yHoja = piso + ALTO_HOJA / 2;
  const zHoja = FONDO_Z + 0.03;
  const hoja = fundir(
    [bloque(scene, "hojaEmergencia", ANCHO_HOJA, ALTO_HOJA, 0.05, EMERGENCIA_X, yHoja, zHoja)],
    "hojaEmergencia",
    pinturaHoja
  );

  const jambaX = ANCHO_HOJA / 2 + 0.04;
  const marco = fundir(
    [
      bloque(scene, "jambaEmergenciaA", 0.07, ALTO_HOJA + 0.12, 0.1, EMERGENCIA_X - jambaX, piso + (ALTO_HOJA + 0.12) / 2, FONDO_Z + 0.05),
      bloque(scene, "jambaEmergenciaB", 0.07, ALTO_HOJA + 0.12, 0.1, EMERGENCIA_X + jambaX, piso + (ALTO_HOJA + 0.12) / 2, FONDO_Z + 0.05),
      bloque(scene, "dintelEmergencia", ANCHO_HOJA + 0.22, 0.07, 0.1, EMERGENCIA_X, piso + ALTO_HOJA + 0.09, FONDO_Z + 0.05),
    ],
    "marcoEmergencia",
    acero
  );

  // La barra antipánico, a la altura a la que se empuja con la cadera, y los
  // dos soportes en que se apoya.
  const yBarra = piso + 1.02;
  const barra = fundir(
    [
      bloque(scene, "barraEmergencia", 0.8, 0.055, 0.055, EMERGENCIA_X, yBarra, zHoja + 0.075),
      bloque(scene, "soporteEmergenciaA", 0.05, 0.1, 0.09, EMERGENCIA_X - 0.34, yBarra, zHoja + 0.045),
      bloque(scene, "soporteEmergenciaB", 0.05, 0.1, 0.09, EMERGENCIA_X + 0.34, yBarra, zHoja + 0.045),
    ],
    "barraEmergencia",
    acero
  );

  // El fleje: una cinta que cruza de jamba a jamba por delante de la barra, y
  // que es lo que impide que la barra baje. Amarillo porque tiene que leerse
  // como algo que alguien puso, no como parte de la puerta.
  const fleje = fundir(
    [
      bloque(scene, "flejeEmergencia", ANCHO_HOJA + 0.08, 0.022, 0.022, EMERGENCIA_X, yBarra + 0.012, zHoja + 0.105),
      bloque(scene, "flejeNudoEmergencia", 0.05, 0.05, 0.05, EMERGENCIA_X + 0.26, yBarra + 0.012, zHoja + 0.105),
    ],
    "flejeEmergencia",
    plastico
  );

  const carteEmergencia = MeshBuilder.CreatePlane("letreroEmergencia", { width: 0.8, height: 0.24 }, scene);
  carteEmergencia.material = materialPintadoNitido(scene, "matLetreroEmergencia", 400, 120, 3, (ctx, w, h) => {
    ctx.fillStyle = "#1f7a3a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 34px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText("SALIDA DE EMERGENCIA", w / 2, h * 0.5);
  });
  // Como el de la bodega: un plano de Babylon mira a −Z y el cuarto está a +Z.
  carteEmergencia.rotation.y = Math.PI;
  carteEmergencia.position.set(EMERGENCIA_X, piso + ALTO_HOJA + 0.3, FONDO_Z + 0.07);
  carteEmergencia.isPickable = false;

  // --- Cortina de lamas -------------------------------------------------------------
  //
  // Cada lama cuelga de su propio nodo, puesto en el riel: así gira desde
  // arriba, como una de verdad, y no desde su centro.
  //
  // Casi transparente: una cortina de lamas se ve a través, y lo que la delata
  // son los cantos y el brillo, no un velo. Más opaca, dos lamas solapadas
  // dejaban la bodega en niebla vista desde un metro.
  const pvc = new PBRMaterial("matCortinaBodega", scene);
  pvc.albedoColor = new Color3(0.7, 0.8, 0.84);
  pvc.alpha = 0.2;
  pvc.roughness = 0.22;
  pvc.metallic = 0;
  pvc.backFaceCulling = false;
  pvc.twoSidedLighting = true;

  const cuelgue = piso + ALTO_VANO - 0.05;
  const largoTira = ALTO_VANO - 0.07;
  const paso = anchoPuerta / TIRAS;
  const tiras = Array.from({ length: TIRAS }, (_, i) => {
    const x = puertaMinX + paso * (i + 0.5);
    const nodo = new TransformNode(`colgadorCortina_${i}`, scene);
    // Alternadas medio centímetro: se solapan, y en el mismo plano parpadearían.
    nodo.position.set(x, cuelgue, frenteZ + (i % 2 === 0 ? -0.005 : 0.005));
    const tira = MeshBuilder.CreateBox(`lamaCortina_${i}`, { width: ANCHO_TIRA, height: largoTira, depth: 0.003 }, scene);
    tira.parent = nodo;
    tira.position.y = -largoTira / 2;
    tira.material = pvc;
    tira.isPickable = false;
    return { nodo, x, angulo: 0, velocidad: 0 };
  });

  // --- Luz --------------------------------------------------------------------------
  const carcasa = fundir(
    [bloque(scene, "carcasaLuminariaBodega", 1.24, 0.06, 0.1, centroPuerta, piso + 2.72, FONDO_Z + 0.05)],
    "carcasaLuminariaBodega",
    materialLiso(scene, "matCarcasaLuminaria", new Color3(0.86, 0.87, 0.88), 0.5)
  );
  const tubo = new PBRMaterial("matTuboBodega", scene);
  tubo.albedoColor = new Color3(0.97, 0.98, 1);
  tubo.unlit = true;
  const difusor = fundir(
    [bloque(scene, "tuboBodega", 1.18, 0.022, 0.07, centroPuerta, piso + 2.68, FONDO_Z + 0.05)],
    "tuboBodega",
    tubo
  );

  const luz = new PointLight("luzBodega", new Vector3(centroPuerta, piso + 2.5, -5.6), scene);
  luz.diffuse = new Color3(0.94, 0.97, 1);
  luz.specular = new Color3(0.3, 0.3, 0.3);
  luz.intensity = 0.45;
  luz.range = 5;

  // --- Carga --------------------------------------------------------------------------
  const cartones = materialesCarton(scene);
  const piezas: PiezaBodega[] = [
    // Hasta FIN_ESTANTE y no hasta el muro: el resto del fondo es la puerta.
    crearEstanteBodega(scene, cartones, interiorX + 0.08, FIN_ESTANTE, FONDO_Z + 0.05, piso),
    crearPalletConCarga(scene, cartones, palletX, palletZ, piso),
    crearTranspaleta(scene, palletX, palletZ + 0.6, piso),
  ];

  // ─── EL PALLET QUE TAPA LA SALIDA ───────────────────────────────────────
  //
  // Uno solo, no dos. El cuarto mide 2,20 m de ancho y un pallet cargado ocupa
  // 1,00: dos en fila contra la puerta y otro en la demarcación dejan un paso
  // de ocho centímetros, y el jugador se queda sin poder entrar a la bodega —
  // que es una zona de la ronda obligatoria. Con uno, la salida queda igual de
  // tapada y se puede llegar hasta metro y medio de ella.
  //
  // Va aparte de las otras piezas porque se enciende y se apaga: ver
  // taparSalida.
  const estorbo = crearPalletConCarga(scene, cartones, EMERGENCIA_X, FONDO_Z + 0.66, piso);
  piezas.push(estorbo);

  [
    tabiques,
    dintel,
    zocalo,
    perfiles,
    demarcacion,
    respaldo,
    carcasa,
    difusor,
    hoja,
    marco,
    barra,
    fleje,
    ...piezas.flatMap((p) => p.mallas),
  ].forEach((malla) => (malla.receiveShadows = true));

  // --- La cortina se aparta al pasar ------------------------------------------------
  //
  // Hacia donde va el jugador, no hacia el lado contrario de donde está: al
  // cruzar, "el lado contrario" cambia justo en el plano de la cortina, y las
  // lamas le atravesarían la cara para ponerse detrás.
  let zAnterior = camara.position.z;
  let sentido = -1;
  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    if (dt <= 0) return;

    const { x, z } = camara.position;
    const vz = (z - zAnterior) / dt;
    zAnterior = z;
    if (Math.abs(vz) > 0.2) sentido = Math.sign(vz);

    const dz = Math.abs(z - frenteZ);
    const cerca = dz < ALCANCE ? 1 - dz / ALCANCE : 0;

    for (const tira of tiras) {
      const lateral = Math.max(0, 1 - Math.max(0, Math.abs(x - tira.x) - ANCHO_TIRA / 2) / RADIO_CUERPO);
      const objetivo = sentido * ABERTURA * cerca * lateral;
      if (objetivo === 0 && Math.abs(tira.angulo) < 1e-4 && Math.abs(tira.velocidad) < 1e-4) continue;

      tira.velocidad += ((objetivo - tira.angulo) * RIGIDEZ - tira.velocidad * AMORTIGUACION) * dt;
      tira.angulo += tira.velocidad * dt;
      // rotation.x positivo lleva la punta de abajo hacia −Z (comprobado con
      // la matriz de Babylon); el ángulo se guarda con +Z positivo.
      tira.nodo.rotation.x = -tira.angulo;
    }
  });

  // Empieza despejada. La tapa la situación de las 17:15 (ver ActoresSupermercado).
  const taparSalida = (tapada: boolean): void => {
    estorbo.mallas.forEach((m) => (m.isVisible = tapada));
    // El choque va con lo que se ve: con el pallet escondido pero su caja de
    // colisión puesta, el jugador chocaría contra el aire delante de la puerta.
    estorbo.choques.forEach((m) => (m.checkCollisions = tapada));
    fleje.isVisible = tapada;
  };
  taparSalida(false);

  return {
    taparSalida,

    // Por encima del pallet que la tapa —que llega a 1,40— y por debajo del
    // dintel: la franja de puerta que de verdad se ve desde dentro del cuarto.
    salidaEmergencia: new Vector3(EMERGENCIA_X, piso + 1.8, FONDO_Z + 0.1),

    // Mallas, luz y materiales se los lleva limpiarEscena con el resto del
    // escenario. Lo único que no es de la escena es el observador.
    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
    },
  };
}
