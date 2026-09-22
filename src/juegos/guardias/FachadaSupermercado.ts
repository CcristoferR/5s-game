import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  TransformNode,
  DynamicTexture,
  Texture,
  type Camera,
  type BaseTexture,
} from "@babylonjs/core";

// ===========================================================================
// La fachada de vidrio y la entrada
// ===========================================================================
//
// El modelo trae el vidrio como tres láminas celestes al diez por ciento,
// sin marco y metidas quince centímetros por detrás del muro: desde dentro se
// leían como paneles de color, no como vidrio, y la puerta era una ventana más
// que llegaba al suelo. Aquí se rehace entera:
//
//   · Vidrio de verdad: casi incoloro, con el reflejo del cielo y de la calle
//     que se hace más fuerte cuanto más de canto se mira (Fresnel), que es lo
//     que hace que un vidrio se lea como vidrio.
//   · Carpintería de aluminio en cada hueco, con un parteluz al medio de las
//     ventanas, como las de cualquier local de barrio.
//   · Una puerta automática de dos hojas que se abren cuando alguien se acerca
//     —un cliente que entra o se va, o el guardia—, con su caja de motor y su
//     franja esmerilada de seguridad.
//   · Las antenas antihurto a los lados del paso y un felpudo.
//
// ─── LAS MEDIDAS ─────────────────────────────────────────────────────────
//
// Sacadas del modelo con rayos contra el muro, no a ojo: cuatro ventanas de
// 2,06 × 1,76 m con el alféizar a 0,52, y la puerta de 1,79 × 2,12 sobre un
// umbral de 0,17. El muro va de Z 7,396 (cara de dentro) a 7,567 (de fuera).

/** Los huecos de las ventanas, en X, con su alféizar y su dintel. */
const VENTANAS: readonly [number, number][] = [
  [-3.68, -1.48],
  [-0.77, 1.29],
  [4.78, 6.83],
  [7.55, 9.61],
];
const VENTANA_Y: [number, number] = [0.52, 2.28];
/** El hueco de la puerta. */
const PUERTA_HUECO: [number, number] = [2.14, 3.93];
const PUERTA_Y: [number, number] = [0.17, 2.29];

const MURO_DENTRO_Z = 7.396;
const MURO_FUERA_Z = 7.567;
/** Plano del vidrio fijo: a media pared, como va la carpintería de un local. */
const VIDRIO_Z = (MURO_DENTRO_Z + MURO_FUERA_Z) / 2;
/** Plano de las hojas de la puerta: por dentro del muro, sobre su cara. */
const HOJAS_Z = MURO_DENTRO_Z - 0.045;

/** Ancho a la vista de los perfiles, y su fondo. */
const PERFIL = 0.05;
const FONDO_PERFIL = 0.09;

/** A cuánta distancia de la puerta alguien la hace abrir. */
const ALCANCE_SENSOR = 2.2;
/** Lo que corre cada hoja al abrirse. */
const RECORRIDO_HOJA = 0.86;

export interface Fachada {
  /**
   * Los materiales que reflejan el exterior. Se les enchufa la sonda cuando
   * esté dibujada: ver ExteriorSupermercado.
   */
  reflejantes: PBRMaterial[];
  /** Todas sus mallas, para dejarlas fuera de las luces de la calle. */
  mallas: Mesh[];
  /** Le pone el reflejo del exterior a lo que lo lleva. */
  reflejar(textura: BaseTexture): void;
  dispose(): void;
}

/**
 * Monta la fachada y la entrada.
 *
 * @param piso  Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 */
export function construirFachada(scene: Scene, camara: Camera, piso: number): Fachada {
  // El vidrio del modelo se retira: lo sustituyen las láminas de aquí, que
  // además chocan hueco por hueco en vez de ser una lámina corrida.
  const original = scene.getMeshByName("Vidrio de fachada");
  if (original) original.setEnabled(false);

  const mallas: Mesh[] = [];
  const guardar = <T extends Mesh>(m: T): T => {
    m.isPickable = false;
    mallas.push(m);
    return m;
  };

  // --- Materiales -------------------------------------------------------------

  // Casi incoloro, con un punto de verde en el canto como el float de
  // verdad. El alfa bajo deja pasar la calle; el reflejo va encima del alfa
  // (radiancia sobre alfa), así que el vidrio brilla aunque se vea a través.
  const vidrio = new PBRMaterial("matVidrioFachada", scene);
  vidrio.albedoColor = new Color3(0.86, 0.93, 0.94);
  vidrio.alpha = 0.12;
  vidrio.metallic = 0;
  vidrio.roughness = 0.03;
  vidrio.indexOfRefraction = 1.52;
  vidrio.backFaceCulling = false;
  vidrio.twoSidedLighting = true;
  vidrio.useRadianceOverAlpha = true;
  vidrio.useSpecularOverAlpha = true;
  vidrio.environmentIntensity = 0.85;
  vidrio.maxSimultaneousLights = 8;

  // Aluminio anodizado gris grafito: el de la carpintería de un comercio.
  const aluminio = new PBRMaterial("matAluminioFachada", scene);
  aluminio.albedoColor = new Color3(0.2, 0.21, 0.22);
  aluminio.metallic = 0.85;
  aluminio.roughness = 0.34;
  aluminio.environmentIntensity = 0.6;
  aluminio.maxSimultaneousLights = 8;

  // La caja del motor de la puerta, en aluminio natural cepillado.
  const cepillado = new PBRMaterial("matMotorPuerta", scene);
  cepillado.albedoColor = new Color3(0.72, 0.73, 0.74);
  cepillado.metallic = 0.9;
  cepillado.roughness = 0.42;
  cepillado.environmentIntensity = 0.6;
  cepillado.maxSimultaneousLights = 8;

  // La franja esmerilada que llevan las puertas de vidrio para que nadie se
  // estrelle contra ellas. Se ve desde los dos lados y no lleva texto.
  const esmerilado = new PBRMaterial("matEsmeriladoPuerta", scene);
  esmerilado.albedoColor = new Color3(0.93, 0.95, 0.96);
  esmerilado.alpha = 0.55;
  esmerilado.metallic = 0;
  esmerilado.roughness = 0.6;
  esmerilado.backFaceCulling = false;
  esmerilado.maxSimultaneousLights = 8;

  const negro = new PBRMaterial("matSensorPuerta", scene);
  negro.albedoColor = new Color3(0.03, 0.03, 0.035);
  negro.roughness = 0.2;
  negro.metallic = 0;
  negro.maxSimultaneousLights = 8;

  // --- Utilidades ---------------------------------------------------------------

  /** Una caja por sus extremos, en coordenadas del mundo. */
  const caja = (nombre: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Mesh => {
    const m = MeshBuilder.CreateBox(nombre, { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return m;
  };
  /** Varias cajas del mismo material en una sola malla: un dibujo, no diez. */
  const fundir = (nombre: string, piezas: Mesh[], material: PBRMaterial): Mesh => {
    const m = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
    m.name = nombre;
    m.material = material;
    return guardar(m);
  };
  /** Un vidrio vertical en el plano Z, por sus extremos. */
  const lamina = (nombre: string, x0: number, x1: number, y0: number, y1: number, z: number): Mesh => {
    const m = MeshBuilder.CreatePlane(nombre, { width: x1 - x0, height: y1 - y0 }, scene);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    m.material = vidrio;
    return guardar(m);
  };

  // --- Ventanas: marco, parteluz y dos vidrios -----------------------------------

  const perfiles: Mesh[] = [];
  const zp0 = VIDRIO_Z - FONDO_PERFIL / 2;
  const zp1 = VIDRIO_Z + FONDO_PERFIL / 2;
  VENTANAS.forEach(([x0, x1], i) => {
    const [y0, y1] = VENTANA_Y;
    const medio = (x0 + x1) / 2;
    perfiles.push(
      caja(`perfilV_${i}_i`, x0, x0 + PERFIL, y0, y1, zp0, zp1),
      caja(`perfilV_${i}_d`, x1 - PERFIL, x1, y0, y1, zp0, zp1),
      caja(`perfilV_${i}_ab`, x0, x1, y0, y0 + PERFIL * 1.4, zp0, zp1),
      caja(`perfilV_${i}_ar`, x0, x1, y1 - PERFIL, y1, zp0, zp1),
      caja(`perfilV_${i}_m`, medio - PERFIL / 2, medio + PERFIL / 2, y0, y1, zp0, zp1)
    );
    const vy0 = y0 + PERFIL * 1.4;
    const vy1 = y1 - PERFIL;
    const vidrioVentana = [
      lamina(`vidrioVentana_${i}_a`, x0 + PERFIL, medio - PERFIL / 2, vy0, vy1, VIDRIO_Z),
      lamina(`vidrioVentana_${i}_b`, medio + PERFIL / 2, x1 - PERFIL, vy0, vy1, VIDRIO_Z),
    ];
    // Chocan como chocaba el vidrio del modelo. No tapan la vista a nada que
    // importe, pero se marcan igual: solo detienen el paso.
    vidrioVentana.forEach((v) => {
      v.checkCollisions = true;
      v.metadata = { soloPaso: true };
    });
  });

  // --- Puerta: marco fijo, caja del motor y sensor -------------------------------

  const [px0, px1] = PUERTA_HUECO;
  const [py0, py1] = PUERTA_Y;
  const centroPuerta = (px0 + px1) / 2;
  perfiles.push(
    caja("perfilPuerta_i", px0, px0 + PERFIL, py0, py1, zp0, zp1),
    caja("perfilPuerta_d", px1 - PERFIL, px1, py0, py1, zp0, zp1),
    caja("perfilPuerta_ar", px0, px1, py1 - PERFIL, py1, zp0, zp1)
  );
  fundir("carpinteriaFachada", perfiles, aluminio);

  // La caja del motor va por dentro, sobre el hueco, y tapa el riel por el
  // que corren las hojas: sin ella, las hojas colgarían de la nada.
  fundir(
    "motorPuerta",
    [caja("motorPuerta_caja", px0 - 0.95, px1 + 0.95, py1 - 0.02, py1 + 0.2, HOJAS_Z - 0.085, MURO_DENTRO_Z)],
    cepillado
  );
  fundir("sensorPuerta", [caja("sensorPuerta_caja", centroPuerta - 0.09, centroPuerta + 0.09, py1 - 0.07, py1 - 0.02, HOJAS_Z - 0.08, HOJAS_Z - 0.02)], negro);

  // --- Las dos hojas ----------------------------------------------------------------

  const anchoHoja = (px1 - px0) / 2 + 0.02;
  const altoHoja = py1 - py0 - 0.04;
  const hojas = [-1, 1].map((lado) => {
    const nodo = new TransformNode(`hojaPuerta_${lado}`, scene);
    const cx = centroPuerta + (lado * anchoHoja) / 2 - lado * 0.01;
    nodo.position.set(cx, py0 + 0.02 + altoHoja / 2, HOJAS_Z);

    const w = anchoHoja / 2;
    const h = altoHoja / 2;
    const f = 0.045;
    const marco = fundir(
      `marcoHoja_${lado}`,
      [
        caja(`marcoHoja_${lado}_i`, -w, -w + f, -h, h, -0.022, 0.022),
        caja(`marcoHoja_${lado}_d`, w - f, w, -h, h, -0.022, 0.022),
        caja(`marcoHoja_${lado}_ab`, -w, w, -h, -h + f * 2, -0.022, 0.022),
        caja(`marcoHoja_${lado}_ar`, -w, w, h - f, h, -0.022, 0.022),
      ],
      aluminio
    );
    marco.parent = nodo;
    const cristal = lamina(`vidrioHoja_${lado}`, -w + f, w - f, -h + f * 2, h - f, 0);
    cristal.parent = nodo;
    const franja = MeshBuilder.CreatePlane(`franjaHoja_${lado}`, { width: anchoHoja - f * 2, height: 0.09 }, scene);
    franja.parent = nodo;
    // A la altura de la vista de un adulto, que es donde la exige la norma.
    franja.position.set(0, 1.45 - (py0 + 0.02 + altoHoja / 2) + piso, 0.004);
    franja.material = esmerilado;
    guardar(franja);
    return { nodo, cerrada: cx, lado };
  });

  // Lo que impide salir: la puerta se abre, pero el guardia no se va del
  // puesto. Invisible, en el plano del muro, y sin tapar la vista.
  const barrera = guardar(caja("barreraPuerta", px0, px1, 0, py1, VIDRIO_Z - 0.02, VIDRIO_Z + 0.02));
  barrera.isVisible = false;
  barrera.checkCollisions = true;
  barrera.metadata = { soloPaso: true };

  // --- El espesor del muro en cada hueco ------------------------------------------
  //
  // El muro del modelo son dos caras con el hueco recortado y nada entre
  // ellas: medido con rayos dentro del espesor, a los lados del hueco no hay
  // superficie ninguna. Mirando la ventana de canto se veía el vacío entre las
  // dos caras, y la carpintería parecía una ventana pegada encima del muro en
  // vez de metida en él. Aquí se reviste el hueco —jambas, dintel y alféizar—
  // y se le pone la repisa por dentro y el vierteaguas por fuera, que es lo
  // que hace que una ventana se lea como hundida en diecisiete centímetros de
  // pared.
  const revoque = new PBRMaterial("matRevoqueHuecos", scene);
  // Del tono de la pared de la sala bajo sus mismas luces. El material del
  // muro no sirve: es un atlas del edificio entero, y en una cara de diecisiete
  // centímetros saldría la franja verde de la fachada.
  revoque.albedoColor = new Color3(0.8, 0.8, 0.79);
  revoque.metallic = 0;
  revoque.roughness = 0.92;
  revoque.maxSimultaneousLights = 8;
  const piedra = new PBRMaterial("matRepisaVentana", scene);
  piedra.albedoColor = new Color3(0.9, 0.89, 0.86);
  piedra.metallic = 0;
  piedra.roughness = 0.38;
  piedra.environmentIntensity = 0.5;
  piedra.maxSimultaneousLights = 8;
  // Un milímetro por dentro de cada cara del muro: coplanares con ellas
  // parpadearían.
  const zr0 = MURO_DENTRO_Z + 0.001;
  const zr1 = MURO_FUERA_Z - 0.001;
  const R = 0.04;
  const revestido: Mesh[] = [];
  const repisas: Mesh[] = [];
  VENTANAS.forEach(([x0, x1], i) => {
    const [y0, y1] = VENTANA_Y;
    revestido.push(
      caja(`jamba_${i}_i`, x0 - R, x0, y0 - R, y1 + R, zr0, zr1),
      caja(`jamba_${i}_d`, x1, x1 + R, y0 - R, y1 + R, zr0, zr1),
      caja(`dintel_${i}`, x0 - R, x1 + R, y1, y1 + R, zr0, zr1),
      caja(`alfeizar_${i}`, x0 - R, x1 + R, y0 - R, y0, zr0, zr1)
    );
    repisas.push(
      // Repisa por dentro, diez centímetros hacia la sala.
      caja(`repisa_${i}`, x0 - 0.06, x1 + 0.06, y0 - 0.03, y0 + 0.004, MURO_DENTRO_Z - 0.1, VIDRIO_Z - FONDO_PERFIL / 2),
      // Vierteaguas por fuera, con su vuelo.
      caja(`vierteaguas_${i}`, x0 - 0.05, x1 + 0.05, y0 - 0.05, y0 - 0.005, VIDRIO_Z + FONDO_PERFIL / 2, MURO_FUERA_Z + 0.05)
    );
  });
  revestido.push(
    caja("jambaPuerta_i", px0 - R, px0, py0 - 0.02, py1 + R, zr0, zr1),
    caja("jambaPuerta_d", px1, px1 + R, py0 - 0.02, py1 + R, zr0, zr1),
    caja("dintelPuerta", px0 - R, px1 + R, py1, py1 + R, zr0, zr1)
  );
  fundir("revestimientoHuecos", revestido, revoque);
  fundir("repisasVentanas", repisas, piedra);
  // El umbral de la puerta: una pletina de aluminio sobre el escalón.
  fundir("umbralPuerta", [caja("umbralPuerta_caja", px0, px1, py0 - 0.012, py0 + 0.004, MURO_DENTRO_Z - 0.06, MURO_FUERA_Z + 0.02)], aluminio);

  // --- Felpudo ----------------------------------------------------------------------

  const felpudo = guardar(MeshBuilder.CreateGround("felpudoEntrada", { width: px1 - px0 + 0.3, height: 1.3 }, scene));
  felpudo.position.set(centroPuerta, piso + 0.006, MURO_DENTRO_Z - 0.7);
  felpudo.material = materialFelpudo(scene);
  felpudo.receiveShadows = true;

  // --- Antenas antihurto --------------------------------------------------------------

  const plasticoAntena = new PBRMaterial("matAntenaAntihurto", scene);
  plasticoAntena.albedoColor = new Color3(0.86, 0.87, 0.88);
  plasticoAntena.metallic = 0;
  plasticoAntena.roughness = 0.35;
  plasticoAntena.maxSimultaneousLights = 8;
  const acrilico = new PBRMaterial("matAcrilicoAntena", scene);
  acrilico.albedoColor = new Color3(0.78, 0.86, 0.9);
  acrilico.alpha = 0.28;
  acrilico.metallic = 0;
  acrilico.roughness = 0.08;
  acrilico.backFaceCulling = false;
  acrilico.useSpecularOverAlpha = true;
  acrilico.maxSimultaneousLights = 8;
  const baseAntena = new PBRMaterial("matBaseAntena", scene);
  baseAntena.albedoColor = new Color3(0.16, 0.17, 0.18);
  baseAntena.metallic = 0.2;
  baseAntena.roughness = 0.5;
  baseAntena.maxSimultaneousLights = 8;

  // A los dos lados del paso, un poco por dentro de la puerta. Dejan metro y
  // medio libre: medido contra las rutas de quienes entran y salen, nadie las
  // roza.
  const ANTENA_Z = MURO_DENTRO_Z - 0.65;
  const piezasAntena: Mesh[] = [];
  const piezasAcrilico: Mesh[] = [];
  const piezasBase: Mesh[] = [];
  [px0 + 0.16, px1 - 0.16].forEach((x, i) => {
    const alto = 1.55;
    const fondo = 0.42;
    const grueso = 0.035;
    const z0 = ANTENA_Z - fondo / 2;
    const z1 = ANTENA_Z + fondo / 2;
    const y0 = piso + 0.06;
    const marco = 0.035;
    piezasAntena.push(
      caja(`antena_${i}_de`, x - grueso / 2, x + grueso / 2, y0, y0 + alto, z0, z0 + marco),
      caja(`antena_${i}_tr`, x - grueso / 2, x + grueso / 2, y0, y0 + alto, z1 - marco, z1),
      caja(`antena_${i}_ar`, x - grueso / 2, x + grueso / 2, y0 + alto - marco, y0 + alto, z0, z1),
      caja(`antena_${i}_me`, x - grueso / 2, x + grueso / 2, y0 + alto * 0.5, y0 + alto * 0.5 + 0.02, z0, z1)
    );
    piezasAcrilico.push(caja(`acrilico_${i}`, x - 0.006, x + 0.006, y0, y0 + alto - marco, z0 + marco, z1 - marco));
    piezasBase.push(caja(`baseAntena_${i}`, x - 0.07, x + 0.07, piso, piso + 0.06, z0 - 0.02, z1 + 0.02));
    // Choca, pero no tapa: detrás de la de la derecha queda la mochila del
    // acceso, y un rayo de vista que se cortara en el acrílico dejaría la
    // situación sin poder verse desde media sala.
    const choque = guardar(caja(`choqueAntena_${i}`, x - 0.05, x + 0.05, piso, piso + alto, z0, z1));
    choque.isVisible = false;
    choque.checkCollisions = true;
    choque.metadata = { soloPaso: true };
  });
  fundir("antenasAntihurto", piezasAntena, plasticoAntena);
  fundir("acrilicoAntenas", piezasAcrilico, acrilico);
  fundir("basesAntenas", piezasBase, baseAntena);

  // --- Las hojas se abren solas -------------------------------------------------------

  /** Quién hace abrir la puerta: el guardia y cualquiera que ande por ahí. */
  const personas = scene.transformNodes.filter((n) => n.name.startsWith("figura_"));
  let apertura = 0;
  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const cerca = (x: number, z: number): boolean =>
      Math.hypot(x - centroPuerta, z - HOJAS_Z) < ALCANCE_SENSOR;
    let alguien = cerca(camara.globalPosition.x, camara.globalPosition.z);
    for (const p of personas) {
      if (alguien) break;
      if (p.isEnabled() && cerca(p.position.x, p.position.z)) alguien = true;
    }
    // Abre más rápido de lo que cierra: el motor de una puerta de supermercado
    // espera a que el paso quede libre antes de juntar las hojas.
    const objetivo = alguien ? 1 : 0;
    apertura += (objetivo - apertura) * Math.min(1, dt * (alguien ? 3.2 : 1.6));
    const recorrido = RECORRIDO_HOJA * apertura * apertura * (3 - 2 * apertura);
    for (const h of hojas) h.nodo.position.x = h.cerrada + h.lado * recorrido;
  });

  const reflejantes = [vidrio, aluminio, cepillado];
  return {
    reflejantes,
    mallas,
    reflejar(textura) {
      for (const m of reflejantes) m.reflectionTexture = textura;
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
    },
  };
}

/** Felpudo de goma con canales, oscuro y con el borde marcado. */
function materialFelpudo(scene: Scene): PBRMaterial {
  const tex = new DynamicTexture("texFelpudo", { width: 512, height: 384 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#1b1d1f";
  ctx.fillRect(0, 0, 512, 384);
  // Canales de goma: el dibujo de un felpudo de tráfico.
  for (let y = 22; y < 362; y += 10) {
    ctx.fillStyle = y % 20 === 2 ? "#26292c" : "#17191b";
    ctx.fillRect(22, y, 468, 5);
  }
  ctx.strokeStyle = "#2c3034";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 368);
  tex.update();
  tex.anisotropicFilteringLevel = 8;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new PBRMaterial("matFelpudo", scene);
  mat.albedoTexture = tex;
  mat.metallic = 0;
  mat.roughness = 0.92;
  mat.maxSimultaneousLights = 8;
  return mat;
}
