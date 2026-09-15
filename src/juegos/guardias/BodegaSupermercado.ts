import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  PointLight,
  TransformNode,
  Ray,
  type AbstractMesh,
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

/**
 * La losa medida en el OBJ, por si el rayo no encuentra el piso.
 *
 * Ojo, que no es cero: el edificio apoya en el plano del terreno, pero su losa
 * tiene diecisiete centímetros y el suelo que se pisa está encima.
 */
const PISO_MEDIDO = 0.16;

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

export interface Bodega {
  dispose(): void;
}

export function construirBodega(
  scene: Scene,
  camara: Camera,
  modelo: { raiz: TransformNode; mallas: AbstractMesh[] }
): Bodega {
  const piso = medirPiso(scene, modelo);
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
  const piezas = [
    crearEstanteBodega(scene, cartones, interiorX + 0.08, MURO_X - 0.06, FONDO_Z + 0.05, piso),
    crearPalletConCarga(scene, cartones, palletX, palletZ, piso),
    crearTranspaleta(scene, palletX, palletZ + 0.6, piso),
  ];

  [tabiques, dintel, zocalo, perfiles, demarcacion, respaldo, carcasa, difusor, ...piezas.flatMap((p) => p.mallas)].forEach(
    (malla) => (malla.receiveShadows = true)
  );

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

  return {
    // Mallas, luz y materiales se los lleva limpiarEscena con el resto del
    // escenario. Lo único que no es de la escena es el observador.
    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
    },
  };
}

/**
 * Altura del suelo en el centro de la bodega, medida con un rayo.
 *
 * Primero se ponen al día las matrices de mundo del modelo. Recién cargado y
 * centrado, sus mallas siguen con la posición de antes de moverlo, y el rayo
 * las buscaría donde ya no están. Con predicado propio Babylon ignora
 * isPickable, que en el escenario está apagado.
 */
function medirPiso(scene: Scene, modelo: { raiz: TransformNode; mallas: AbstractMesh[] }): number {
  modelo.raiz.getChildMeshes(false).forEach((malla) => malla.computeWorldMatrix(true));

  const x = (PLANTA_BODEGA.minX + PLANTA_BODEGA.maxX) / 2;
  const z = (PLANTA_BODEGA.minZ + PLANTA_BODEGA.maxZ) / 2;
  const rayo = new Ray(new Vector3(x, 1.5, z), Vector3.Down(), 3);
  const impacto = scene.pickWithRay(rayo, (malla) => modelo.mallas.includes(malla));

  if (impacto?.hit && impacto.pickedPoint) return impacto.pickedPoint.y;
  console.warn(`[bodega] el rayo no encontró el piso; se usa la losa medida (${PISO_MEDIDO} m).`);
  return PISO_MEDIDO;
}
