import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  DirectionalLight,
  VertexBuffer,
  TransformNode,
  HemisphericLight,
  ShadowGenerator,
  ReflectionProbe,
  type AbstractMesh,
  type BaseTexture,
  type Light,
} from "@babylonjs/core";
import { crearFarol } from "./ModelosCalle";
import { crearAuto, crearArbolFrondoso } from "./ModelosExterior";
import { crearAzar, fbm } from "./TexturasPBR";

// ===========================================================================
// Lo que se ve por las vidrieras: el estacionamiento, la calle y el barrio
// ===========================================================================
//
// Hasta ahora, detrás del vidrio había un vacío gris azulado sobre la
// explanada del modelo. Desde dentro, que es desde donde se juega, las cinco
// vidrieras eran cinco cuadros del mismo color.
//
// Ahora es una tarde de barrio, en capas a distancias reales para que al
// caminar por la sala cada una se desplace a su velocidad:
//
//   · 7–21 m    la vereda del local y el estacionamiento, con tres autos.
//   · 21–25 m   el bandejón con árboles y la vereda pública.
//   · 25–32 m   la calle, con su paso de cebra a la altura de la puerta.
//   · 32–48 m   la vereda de enfrente y una hilera de seis edificios con
//               locales abajo: farmacia, panadería, ferretería…
//   · 140 m     la ciudad, velada por la distancia.
//   · 800 m     la cordillera, con nieve.
//   · infinito  el cielo de la tarde.
//
// ─── POR QUÉ NO MÁS ──────────────────────────────────────────────────────
//
// Porque desde dentro solo se ve por cinco huecos de dos metros, y un barrio
// lleno de cosas se lee como un decorado. Pocas piezas, cada una bien hecha:
// fachadas pintadas con sus ventanas y sus locales, toldos de verdad en
// volumen, autos con reflejo y sombras bajo ellos.
//
// ─── LA LUZ ES SUYA ──────────────────────────────────────────────────────
//
// Un sol de tarde y un cielo que SOLO alumbran lo de fuera (includedOnlyMeshes),
// y las luces de la sala que no alumbran nada de fuera. Sin esa separación el
// sol entraría por las paredes —no hay sombras en la sala— y los tubos del
// techo teñirían la calle de blanco frío. La sombra se calcula una sola vez:
// fuera no se mueve nada.

/** Cara exterior del muro de la fachada. */
const FACHADA_Z = 7.567;
const VEREDA_LOCAL_Z = 9.6;
const ESTACIONAMIENTO_FIN_Z = 21.2;
const BANDEJON_FIN_Z = 22.4;
const VEREDA_Z = 25.0;
const CALLE_FIN_Z = 32.4;
const VEREDA_ENFRENTE_FIN_Z = 35.4;
/** Alto de las veredas sobre la calzada: un bordillo. */
const SOLERA = 0.12;
/** Eje de la puerta: el paso de cebra va enfrente. */
const PUERTA_X = 3.03;

export interface Exterior {
  /** Todo lo de fuera, para dejarlo fuera de las luces de la sala. */
  mallas: AbstractMesh[];
  /** El sol y el cielo: las únicas luces que alumbran fuera. */
  luces: Light[];
  /**
   * Avisa cuando el reflejo del exterior está dibujado, con la textura. Se
   * dibuja una vez, en el primer cuadro.
   */
  alReflejar(usar: (textura: BaseTexture) => void): void;
}

/**
 * Monta el exterior.
 *
 * @param proyectan  Lo de la escena que tiene que dar sombra fuera: el
 *                   edificio del local, que a esta hora tapa el sol de parte
 *                   del estacionamiento.
 */
export function construirExterior(scene: Scene, proyectan: AbstractMesh[]): Exterior {
  const mallas: AbstractMesh[] = [];
  const guardar = <T extends AbstractMesh>(m: T): T => {
    m.isPickable = false;
    mallas.push(m);
    return m;
  };
  const reciben: Mesh[] = [];
  const dan: AbstractMesh[] = [...proyectan];
  const reflejados: AbstractMesh[] = [];

  // --- Materiales del suelo ------------------------------------------------------------

  const asfalto = pbr(scene, "matAsfaltoExterior", texturaAsfalto(scene), 0.9);
  const concreto = pbr(scene, "matVeredaExterior", texturaBaldosa(scene), 0.85);
  const pasto = pbr(scene, "matPastoExterior", texturaPasto(scene), 0.95);
  const solera = new PBRMaterial("matSoleraExterior", scene);
  solera.albedoColor = new Color3(0.62, 0.61, 0.58);
  solera.roughness = 0.85;
  solera.metallic = 0;
  const pintura = new PBRMaterial("matPinturaVial", scene);
  pintura.albedoColor = new Color3(0.9, 0.9, 0.88);
  pintura.roughness = 0.7;
  pintura.metallic = 0;
  const azulPreferencial = new PBRMaterial("matPreferencial", scene);
  azulPreferencial.albedoTexture = texturaPreferencial(scene);
  azulPreferencial.roughness = 0.75;
  azulPreferencial.metallic = 0;

  /** Una losa horizontal por sus extremos. Grosor para las veredas. */
  const losa = (nombre: string, x0: number, x1: number, z0: number, z1: number, y: number, alto: number, mat: PBRMaterial, metrosTextura?: number): Mesh => {
    const m = alto > 0
      ? MeshBuilder.CreateBox(nombre, { width: x1 - x0, height: alto, depth: z1 - z0 }, scene)
      : MeshBuilder.CreateGround(nombre, { width: x1 - x0, height: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, y + (alto > 0 ? alto / 2 : 0), (z0 + z1) / 2);
    // La textura se repite en metros y no por pieza: las UV de cada losa se
    // estiran a su tamaño, y así todas comparten un solo material.
    if (metrosTextura) escalarUV(m, (x1 - x0) / metrosTextura, (z1 - z0) / metrosTextura);
    m.material = mat;
    m.receiveShadows = true;
    reciben.push(m);
    reflejados.push(m);
    return guardar(m);
  };

  // --- El suelo: de la fachada a la vereda de enfrente ----------------------------------

  // Un piso de fondo muy grande, para que nada se asome al vacío mirando de
  // canto por la última vidriera.
  losa("fondoExterior", -320, 320, -80, 420, -0.03, 0, pasto, 6);
  // La vereda del local, un bordillo por encima del estacionamiento.
  losa("veredaLocal", -12, 12.5, FACHADA_Z, VEREDA_LOCAL_Z, 0, SOLERA, concreto, 2.4);
  losa("estacionamiento", -19, 15, VEREDA_LOCAL_Z, ESTACIONAMIENTO_FIN_Z, 0.004, 0, asfalto, 5);
  losa("bandejon", -60, 60, ESTACIONAMIENTO_FIN_Z, BANDEJON_FIN_Z, 0, SOLERA * 0.8, pasto, 3);
  losa("veredaPublica", -60, 60, BANDEJON_FIN_Z, VEREDA_Z, 0, SOLERA, concreto, 2.4);
  losa("calzada", -60, 60, VEREDA_Z, CALLE_FIN_Z, 0.002, 0, asfalto, 5);
  losa("veredaEnfrente", -60, 60, CALLE_FIN_Z, VEREDA_ENFRENTE_FIN_Z, 0, SOLERA, concreto, 2.4);
  losa("antejardines", -60, 60, VEREDA_ENFRENTE_FIN_Z, 60, 0, SOLERA * 0.5, concreto, 2.4);

  // Las soleras de canto: la arista clara de piedra que separa vereda y calle.
  const soleras: Mesh[] = [];
  const canto = (x0: number, x1: number, z: number): void => {
    const m = MeshBuilder.CreateBox("solera", { width: x1 - x0, height: SOLERA + 0.03, depth: 0.14 }, scene);
    m.position.set((x0 + x1) / 2, (SOLERA + 0.03) / 2 - 0.02, z);
    soleras.push(m);
  };
  canto(-12, 12.5, VEREDA_LOCAL_Z);
  canto(-60, 60, BANDEJON_FIN_Z);
  canto(-60, 60, VEREDA_Z);
  canto(-60, 60, CALLE_FIN_Z);
  const mSoleras = fundir("solerasExterior", soleras, solera);
  mSoleras.receiveShadows = true;
  reciben.push(mSoleras);
  reflejados.push(mSoleras);
  guardar(mSoleras);

  // --- Pintura: estacionamientos, preferencial, calle y paso de cebra -------------------

  const lineas: Mesh[] = [];
  const raya = (x0: number, x1: number, z0: number, z1: number): void => {
    const m = MeshBuilder.CreateGround("raya", { width: x1 - x0, height: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, 0.008, (z0 + z1) / 2);
    lineas.push(m);
  };
  const ANCHO_BAHIA = 2.6;
  const BAHIA_Z0 = VEREDA_LOCAL_Z + 0.25;
  const BAHIA_Z1 = BAHIA_Z0 + 5.0;
  for (let x = -18; x <= 14.2; x += ANCHO_BAHIA) raya(x - 0.06, x + 0.06, BAHIA_Z0, BAHIA_Z1);
  raya(-18, 14.2, BAHIA_Z1 - 0.06, BAHIA_Z1 + 0.06);
  // Calle: bordes continuos y eje segmentado.
  raya(-60, 60, VEREDA_Z + 0.25, VEREDA_Z + 0.37);
  raya(-60, 60, CALLE_FIN_Z - 0.37, CALLE_FIN_Z - 0.25);
  const ejeZ = (VEREDA_Z + CALLE_FIN_Z) / 2;
  for (let x = -60; x < 60; x += 7) {
    if (Math.abs(x + 1.5 - PUERTA_X) < 4) continue;
    raya(x, x + 3, ejeZ - 0.06, ejeZ + 0.06);
  }
  // Paso de cebra, frente a la puerta: barras paralelas al tránsito.
  for (let z = VEREDA_Z + 0.6; z < CALLE_FIN_Z - 0.6; z += 1.0) raya(PUERTA_X - 2, PUERTA_X + 2, z, z + 0.5);
  guardar(fundir("pinturaVial", lineas, pintura));

  // Estacionamiento preferencial, el más cercano a la puerta.
  const preferencial = MeshBuilder.CreateGround("estacionamientoPreferencial", { width: ANCHO_BAHIA - 0.12, height: 5.0 - 0.1 }, scene);
  preferencial.position.set(-18 + ANCHO_BAHIA * 8 + ANCHO_BAHIA / 2, 0.007, (BAHIA_Z0 + BAHIA_Z1) / 2);
  preferencial.material = azulPreferencial;
  preferencial.receiveShadows = true;
  reciben.push(preferencial);
  guardar(preferencial);

  // Topes de concreto al fondo de cada estacionamiento.
  const topes: Mesh[] = [];
  for (let x = -18 + ANCHO_BAHIA / 2; x < 14.2; x += ANCHO_BAHIA) {
    const t = MeshBuilder.CreateBox("tope", { width: 1.5, height: 0.11, depth: 0.16 }, scene);
    t.position.set(x, 0.055, BAHIA_Z0 + 0.45);
    topes.push(t);
  }
  const mTopes = guardar(fundir("topesEstacionamiento", topes, solera));
  dan.push(mTopes);

  // --- Autos --------------------------------------------------------------------------------

  const autos: { color: Color3; bahia: number; patente: string; ladoCalle?: boolean }[] = [
    { color: new Color3(0.62, 0.64, 0.66), bahia: 3, patente: "KD·TR·42" },
    { color: new Color3(0.42, 0.06, 0.07), bahia: 6, patente: "HX·LP·19" },
    { color: new Color3(0.9, 0.9, 0.88), bahia: 10, patente: "JR·BW·73" },
  ];
  const materialesAuto: PBRMaterial[] = [];
  /**
   * Un auto quieto: sus quince piezas fundidas en una por material. Se ve
   * igual —mismas mallas, mismos materiales, mismo sitio— y en vez de quince
   * dibujos por auto son seis. Los autos de aquí no se mueven nunca.
   */
  const estacionar = (nombre: string, color: Color3, patente: string, x: number, z: number, giro: number, hatch = false): void => {
    const raiz = new TransformNode(nombre, scene);
    const piezas = crearAuto(scene, nombre, { color, patente, hatch });
    piezas.forEach((m) => (m.parent = raiz));
    raiz.position.set(x, 0.004, z);
    raiz.rotation.y = giro;
    raiz.computeWorldMatrix(true);
    for (const m of porMaterial(piezas)) {
      guardar(m);
      dan.push(m);
      if (m.material instanceof PBRMaterial && !materialesAuto.includes(m.material)) materialesAuto.push(m.material);
    }
  };
  // De punta hacia el local, como se estaciona en un supermercado.
  autos.forEach((a, i) =>
    estacionar(`autoExterior_${i}`, a.color, a.patente, -18 + ANCHO_BAHIA * a.bahia + ANCHO_BAHIA / 2, BAHIA_Z0 + 2.6, Math.PI / 2, i === 1)
  );
  // Uno estacionado en la calle, junto a la vereda de enfrente.
  estacionar("autoExterior_calle", new Color3(0.08, 0.18, 0.32), "PT·GS·55", -9.5, CALLE_FIN_Z - 1.2, 0, true);

  // --- Árboles y faroles ------------------------------------------------------------------

  const follaje = new PBRMaterial("matFollajeExterior", scene);
  follaje.albedoColor = new Color3(0.26, 0.4, 0.15);
  follaje.roughness = 0.85;
  follaje.metallic = 0;
  const follajeHondo = new PBRMaterial("matFollajeHondoExterior", scene);
  follajeHondo.albedoColor = new Color3(0.14, 0.25, 0.09);
  follajeHondo.roughness = 0.9;
  follajeHondo.metallic = 0;
  const corteza = new PBRMaterial("matCortezaExterior", scene);
  corteza.albedoColor = new Color3(0.23, 0.17, 0.12);
  corteza.roughness = 0.95;
  corteza.metallic = 0;
  [-15.5, -6.5, 10.5, 19.5].forEach((x, i) => {
    const partes = crearArbolFrondoso(scene, `arbolExterior_${i}`, 6.4 + (i % 2) * 1.2, 11 + i * 7, [follaje, follajeHondo], corteza);
    partes.forEach((m) => {
      m.position.x += x;
      m.position.z += (ESTACIONAMIENTO_FIN_Z + BANDEJON_FIN_Z) / 2;
      m.position.y += SOLERA * 0.8;
      guardar(m);
      dan.push(m);
      reflejados.push(m);
    });
  });
  const poste = new PBRMaterial("matPosteExterior", scene);
  poste.albedoColor = new Color3(0.32, 0.34, 0.36);
  poste.metallic = 0.6;
  poste.roughness = 0.45;
  const luminaria = new PBRMaterial("matLuminariaExterior", scene);
  luminaria.albedoColor = new Color3(0.85, 0.86, 0.84);
  luminaria.roughness = 0.3;
  luminaria.metallic = 0;
  [-11, 16].forEach((x, i) => {
    const f = crearFarol(scene, `farolExterior_${i}`, 7.5, poste, luminaria);
    f.raiz.position.set(x, SOLERA, VEREDA_Z - 0.5);
    // El brazo, sobre la calzada.
    f.raiz.rotation.y = -Math.PI / 2;
    f.raiz.computeWorldMatrix(true);
    for (const m of porMaterial(f.mallas)) {
      guardar(m);
      dan.push(m);
      reflejados.push(m);
    }
  });

  // --- La hilera de enfrente ---------------------------------------------------------------

  const EDIFICIOS: Edificio[] = [
    { x0: -36, x1: -23, alto: 9.5, pisos: 3, muro: "#e3d7bf", marco: "#ffffff", local: "FARMACIA", colorLocal: "#2f8a4c", toldo: ["#2f8a4c", "#2f8a4c"] },
    { x0: -22, x1: -11.5, alto: 12.8, pisos: 4, muro: "#9c5a44", marco: "#efe8dc", local: "PANADERÍA", colorLocal: "#b5652e", toldo: ["#c9602c", "#f1e6d2"], ladrillo: true },
    { x0: -10.5, x1: 1.5, alto: 7.2, pisos: 2, muro: "#c9ccce", marco: "#3a3f44", local: "FERRETERÍA", colorLocal: "#c23b2f", toldo: null },
    { x0: 2.5, x1: 17, alto: 16.5, pisos: 5, muro: "#b9cdd8", marco: "#ffffff", local: "", colorLocal: "#5b6b76", toldo: null, balcones: true },
    { x0: 18, x1: 27.5, alto: 8.2, pisos: 2, muro: "#d9b56a", marco: "#fdf8ee", local: "LIBRERÍA", colorLocal: "#2d4f8e", toldo: ["#2d4f8e", "#e9e4d6"] },
    { x0: 28.5, x1: 42, alto: 11.2, pisos: 3, muro: "#eeeeea", marco: "#2b2f33", local: "CAFÉ", colorLocal: "#5a3a26", toldo: ["#3d2a1e", "#3d2a1e"] },
  ];
  const Z_FRENTE = VEREDA_ENFRENTE_FIN_Z + 0.8;
  EDIFICIOS.forEach((e, i) => {
    const ancho = e.x1 - e.x0;
    const fondo = 12;
    const cuerpo = MeshBuilder.CreateBox(`edificioEnfrente_${i}`, { width: ancho, height: e.alto, depth: fondo }, scene);
    cuerpo.position.set((e.x0 + e.x1) / 2, e.alto / 2, Z_FRENTE + fondo / 2 + 0.02);
    const matCuerpo = new PBRMaterial(`matCuerpoEdificio_${i}`, scene);
    matCuerpo.albedoColor = Color3.FromHexString(e.muro).scale(0.92);
    matCuerpo.roughness = 0.9;
    matCuerpo.metallic = 0;
    cuerpo.material = matCuerpo;
    guardar(cuerpo);
    reflejados.push(cuerpo);

    const fachada = MeshBuilder.CreatePlane(`fachadaEnfrente_${i}`, { width: ancho, height: e.alto }, scene);
    fachada.position.set((e.x0 + e.x1) / 2, e.alto / 2, Z_FRENTE);
    const mat = new PBRMaterial(`matFachadaEnfrente_${i}`, scene);
    mat.albedoTexture = texturaFachada(scene, `texFachadaEnfrente_${i}`, e, 100 + i * 13);
    mat.roughness = 0.82;
    mat.metallic = 0;
    fachada.material = mat;
    guardar(fachada);
    reflejados.push(fachada);

    // El toldo del local, en volumen: una lámina inclinada sobre la vereda.
    if (e.toldo) {
      const t = MeshBuilder.CreatePlane(`toldoEnfrente_${i}`, { width: Math.min(ancho - 1.2, 7.5), height: 1.35 }, scene);
      t.position.set((e.x0 + e.x1) / 2, 2.95, Z_FRENTE - 0.55);
      t.rotation.x = -0.62;
      const mt = new PBRMaterial(`matToldoEnfrente_${i}`, scene);
      mt.albedoTexture = texturaToldo(scene, `texToldo_${i}`, e.toldo);
      mt.roughness = 0.8;
      mt.metallic = 0;
      mt.backFaceCulling = false;
      t.material = mt;
      guardar(t);
      dan.push(t);
      reflejados.push(t);
    }
  });

  // --- Lo lejano ------------------------------------------------------------------------------

  const lejos = (nombre: string, tex: DynamicTexture, ancho: number, alto: number, z: number, y: number): Mesh => {
    const m = MeshBuilder.CreatePlane(nombre, { width: ancho, height: alto }, scene);
    m.position.set(0, y, z);
    const mat = new StandardMaterial(`mat_${nombre}`, scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    tex.hasAlpha = true;
    mat.backFaceCulling = false;
    m.material = mat;
    reflejados.push(m);
    return guardar(m);
  };
  lejos("ciudadLejana", texturaCiudad(scene), 520, 64, 150, 30);
  lejos("cordillera", texturaCordillera(scene), 3400, 260, 820, 105);

  // --- El cielo ---------------------------------------------------------------------------------

  const cielo = MeshBuilder.CreateSphere("cieloTarde", { diameter: 1900, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const matCielo = new StandardMaterial("matCieloTarde", scene);
  matCielo.emissiveTexture = texturaCielo(scene);
  matCielo.disableLighting = true;
  matCielo.backFaceCulling = false;
  cielo.material = matCielo;
  cielo.infiniteDistance = true;
  guardar(cielo);
  reflejados.push(cielo);

  // --- Luz de tarde ---------------------------------------------------------------------------

  // Por detrás y a la derecha del local, bajo: alumbra de lleno la hilera de
  // enfrente —que es lo que se ve desde dentro— y tiende las sombras de los
  // autos hacia la calle.
  const sol = new DirectionalLight("solTarde", new Vector3(-0.52, -0.46, 0.72).normalize(), scene);
  sol.position = new Vector3(40, 45, -50);
  sol.diffuse = new Color3(1, 0.87, 0.7);
  sol.specular = new Color3(1, 0.9, 0.78);
  sol.intensity = 3.1;
  const cieloLuz = new HemisphericLight("cieloLuzTarde", new Vector3(0, 1, 0), scene);
  cieloLuz.diffuse = new Color3(0.6, 0.7, 0.88);
  cieloLuz.groundColor = new Color3(0.36, 0.34, 0.31);
  cieloLuz.intensity = 0.95;
  // Solo lo de fuera. Los materiales de la sala ni se enteran de estas dos.
  sol.includedOnlyMeshes = [...mallas];
  cieloLuz.includedOnlyMeshes = [...mallas];

  // Sombras: una vez, al arrancar. Fuera no se mueve nada.
  const sombras = new ShadowGenerator(2048, sol);
  sombras.usePercentageCloserFiltering = true;
  sombras.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  sombras.bias = 0.0006;
  sombras.normalBias = 0.015;
  sombras.darkness = 0.25;
  dan.forEach((m) => sombras.addShadowCaster(m, false));
  const mapa = sombras.getShadowMap();
  if (mapa) mapa.refreshRate = 0;

  // --- El reflejo de todo esto --------------------------------------------------------------

  // Una sonda en el estacionamiento que fotografía el exterior una sola vez.
  // Es lo que ven reflejado los vidrios de la fachada y la chapa de los
  // autos: el cielo y la hilera de enfrente, que es lo que tienen delante.
  const sonda = new ReflectionProbe("sondaExterior", 256, scene);
  sonda.position = new Vector3(PUERTA_X, 1.6, 15);
  reflejados.forEach((m) => sonda.renderList!.push(m));
  sonda.refreshRate = 0;
  const esperan: ((t: BaseTexture) => void)[] = [];
  let lista: BaseTexture | null = null;
  // Un cuadro después, por el mismo motivo que la sonda del condominio: si se
  // enchufa antes, lo que la sonda dibuja intenta leerla mientras se escribe.
  scene.onAfterRenderObservable.addOnce(() => {
    lista = sonda.cubeTexture;
    materialesAuto.forEach((m) => (m.reflectionTexture = sonda.cubeTexture));
    esperan.forEach((f) => f(sonda.cubeTexture));
  });

  return {
    mallas,
    luces: [sol, cieloLuz],
    alReflejar(usar) {
      if (lista) usar(lista);
      else esperan.push(usar);
    },
  };
}

// ===========================================================================
// Materiales y texturas pintadas
// ===========================================================================

function pbr(scene: Scene, nombre: string, tex: DynamicTexture, rugosidad: number): PBRMaterial {
  const m = new PBRMaterial(nombre, scene);
  m.albedoTexture = tex;
  m.roughness = rugosidad;
  m.metallic = 0;
  return m;
}

function fundir(nombre: string, piezas: Mesh[], material: PBRMaterial): Mesh {
  const m = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
  m.name = nombre;
  m.material = material;
  return m;
}

/**
 * Funde las piezas de un objeto quieto por material: una malla por material,
 * en coordenadas del mundo. Lo que no se puede fundir queda como estaba.
 */
function porMaterial(piezas: Mesh[]): Mesh[] {
  const grupos = new Map<unknown, Mesh[]>();
  for (const m of piezas) {
    m.computeWorldMatrix(true);
    const k = m.material ?? null;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(m);
  }
  const salida: Mesh[] = [];
  for (const [, grupo] of grupos) {
    if (grupo.length === 1) {
      salida.push(grupo[0]);
      continue;
    }
    const nombre = grupo[0].name;
    const material = grupo[0].material;
    // Si las piezas no traen los mismos datos de vértice —unas con UV y otras
    // sin—, no se pueden fundir: se quedan como estaban, que también se ve bien.
    let unida: Mesh | null = null;
    try {
      unida = Mesh.MergeMeshes(grupo, false, true);
    } catch {
      unida = null;
    }
    if (unida) grupo.forEach((m) => m.dispose());
    if (unida) {
      unida.name = nombre;
      unida.material = material;
      salida.push(unida);
    } else salida.push(...grupo);
  }
  return salida;
}

/** Multiplica las UV de una malla: la textura se repite tantas veces. */
function escalarUV(m: Mesh, su: number, sv: number): void {
  const uv = m.getVerticesData(VertexBuffer.UVKind);
  if (!uv) return;
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] *= su;
    uv[i + 1] *= sv;
  }
  m.setVerticesData(VertexBuffer.UVKind, uv);
}

/**
 * Manchas grandes de ruido sobre lo pintado: desgaste, humedad vieja, pasto
 * más tupido. Se calculan en un lienzo chico y se estiran —son manchas de
 * metros, no necesitan detalle— así la carga no paga un ruido por píxel.
 */
function manchas(ctx: CanvasRenderingContext2D, L: number, escala: number, semilla: number, tinte: [number, number, number], fuerza: number): void {
  const C = 128;
  const chico = document.createElement("canvas");
  chico.width = C;
  chico.height = C;
  const c2 = chico.getContext("2d");
  if (!c2) return;
  const img = c2.createImageData(C, C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const n = fbm((x * L) / C / escala, (y * L) / C / escala, semilla, 4) - 0.5;
      const i = (y * C + x) * 4;
      const oscuro = n < 0;
      img.data[i] = oscuro ? 0 : tinte[0];
      img.data[i + 1] = oscuro ? 0 : tinte[1];
      img.data[i + 2] = oscuro ? 0 : tinte[2];
      img.data[i + 3] = Math.min(255, Math.abs(n) * fuerza * 255);
    }
  }
  c2.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(chico, 0, 0, L, L);
}

function lienzo(scene: Scene, nombre: string, ancho: number, alto: number): { tex: DynamicTexture; ctx: CanvasRenderingContext2D } {
  const tex = new DynamicTexture(nombre, { width: ancho, height: alto }, scene, true);
  tex.anisotropicFilteringLevel = 8;
  return { tex, ctx: tex.getContext() as unknown as CanvasRenderingContext2D };
}

/** Grano: puntos sueltos de varios tonos, para que nada se vea plano. */
function grano(ctx: CanvasRenderingContext2D, ancho: number, alto: number, semilla: number, cuantos: number, tonos: string[], tam: [number, number]): void {
  const azar = crearAzar(semilla);
  for (let i = 0; i < cuantos; i++) {
    ctx.fillStyle = tonos[Math.floor(azar() * tonos.length)];
    const s = tam[0] + azar() * (tam[1] - tam[0]);
    ctx.fillRect(azar() * ancho, azar() * alto, s, s);
  }
}

function texturaAsfalto(scene: Scene): DynamicTexture {
  const L = 1024;
  const { tex, ctx } = lienzo(scene, "texAsfaltoExterior", L, L);
  ctx.fillStyle = "#56585b";
  ctx.fillRect(0, 0, L, L);
  // Manchas grandes: el desgaste y los parches de un asfalto con años.
  manchas(ctx, L, 180, 7, [150, 150, 146], 0.55);
  grano(ctx, L, L, 3, 26000, ["#6c6e70", "#47494b", "#7a7c7e", "#3f4143", "#8a8a88"], [1, 2.6]);
  tex.update();
  return tex;
}

function texturaBaldosa(scene: Scene): DynamicTexture {
  // Baldosa microvibrada de 40 cm, la de las veredas: cada una con su
  // cuadriculado de nueve y un tono apenas distinto al de al lado.
  const L = 512;
  const { tex, ctx } = lienzo(scene, "texBaldosaExterior", L, L);
  const azar = crearAzar(21);
  const n = 6;
  const lado = L / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t = 176 + Math.floor(azar() * 14);
      ctx.fillStyle = `rgb(${t},${t - 4},${t - 12})`;
      ctx.fillRect(i * lado, j * lado, lado, lado);
      ctx.strokeStyle = "rgba(90,86,80,0.35)";
      ctx.lineWidth = 1;
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(i * lado + (k * lado) / 3, j * lado + 4);
        ctx.lineTo(i * lado + (k * lado) / 3, (j + 1) * lado - 4);
        ctx.moveTo(i * lado + 4, j * lado + (k * lado) / 3);
        ctx.lineTo((i + 1) * lado - 4, j * lado + (k * lado) / 3);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = "rgba(70,66,60,0.8)";
  ctx.lineWidth = 3;
  for (let k = 0; k <= n; k++) {
    ctx.beginPath();
    ctx.moveTo(k * lado, 0);
    ctx.lineTo(k * lado, L);
    ctx.moveTo(0, k * lado);
    ctx.lineTo(L, k * lado);
    ctx.stroke();
  }
  grano(ctx, L, L, 5, 9000, ["rgba(120,116,108,0.5)", "rgba(210,206,198,0.5)"], [1, 2]);
  tex.update();
  return tex;
}

function texturaPasto(scene: Scene): DynamicTexture {
  const L = 512;
  const { tex, ctx } = lienzo(scene, "texPastoExterior", L, L);
  ctx.fillStyle = "#4f6b2e";
  ctx.fillRect(0, 0, L, L);
  manchas(ctx, L, 60, 13, [150, 170, 90], 0.6);
  grano(ctx, L, L, 9, 16000, ["#5d7a36", "#3f5723", "#6c8a40", "#77794a"], [1, 2.2]);
  tex.update();
  return tex;
}

function texturaPreferencial(scene: Scene): DynamicTexture {
  const { tex, ctx } = lienzo(scene, "texPreferencial", 256, 512);
  ctx.fillStyle = "#2f63a8";
  ctx.fillRect(0, 0, 256, 512);
  // El símbolo de accesibilidad, en blanco, centrado.
  ctx.fillStyle = "#f2f4f6";
  ctx.strokeStyle = "#f2f4f6";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(128, 150, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(122, 185);
  ctx.lineTo(122, 265);
  ctx.lineTo(180, 265);
  ctx.lineTo(196, 320);
  ctx.moveTo(122, 215);
  ctx.lineTo(170, 215);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 290, 52, Math.PI * 0.55, Math.PI * 1.75);
  ctx.stroke();
  grano(ctx, 256, 512, 17, 2500, ["rgba(255,255,255,0.12)", "rgba(0,0,0,0.12)"], [1, 2]);
  tex.update();
  return tex;
}

interface Edificio {
  x0: number;
  x1: number;
  alto: number;
  pisos: number;
  muro: string;
  marco: string;
  local: string;
  colorLocal: string;
  toldo: [string, string] | null;
  ladrillo?: boolean;
  balcones?: boolean;
}

/**
 * La fachada entera de un edificio de enfrente, pintada: muro con su textura,
 * ventanas con marco, reflejo de cielo y alguna cortina, el local de abajo
 * con su vitrina y su letrero, y la cornisa.
 */
function texturaFachada(scene: Scene, nombre: string, e: Edificio, semilla: number): DynamicTexture {
  const ancho = e.x1 - e.x0;
  const PX_M = 64;
  const W = Math.min(2048, Math.round(ancho * PX_M));
  const H = Math.min(2048, Math.round(e.alto * PX_M));
  const sx = W / ancho;
  const sy = H / e.alto;
  const { tex, ctx } = lienzo(scene, nombre, W, H);
  const azar = crearAzar(semilla);

  // Muro.
  ctx.fillStyle = e.muro;
  ctx.fillRect(0, 0, W, H);
  if (e.ladrillo) {
    const alto = 0.075 * sy;
    const largo = 0.25 * sx;
    for (let y = 0, fila = 0; y < H; y += alto, fila++) {
      for (let x = (fila % 2) * -largo / 2; x < W; x += largo) {
        const t = 0.85 + azar() * 0.25;
        ctx.fillStyle = `rgba(${Math.round(150 * t)},${Math.round(84 * t)},${Math.round(62 * t)},1)`;
        ctx.fillRect(x + 1, y + 1, largo - 2, alto - 2);
      }
    }
  } else {
    grano(ctx, W, H, semilla, Math.round(W * H * 0.02), ["rgba(0,0,0,0.05)", "rgba(255,255,255,0.06)"], [1, 3]);
  }
  // Suciedad que baja de las cornisas y los alféizares: vertical y leve.
  const sucio = ctx.createLinearGradient(0, 0, 0, H);
  sucio.addColorStop(0, "rgba(40,36,30,0.14)");
  sucio.addColorStop(0.2, "rgba(40,36,30,0)");
  sucio.addColorStop(0.85, "rgba(40,36,30,0)");
  sucio.addColorStop(1, "rgba(40,36,30,0.18)");
  ctx.fillStyle = sucio;
  ctx.fillRect(0, 0, W, H);

  // Pisos: el de abajo, el local, más alto que los demás.
  const altoLocal = 3.6;
  const altoPiso = (e.alto - altoLocal - 0.6) / Math.max(1, e.pisos - 1);
  const cols = Math.max(2, Math.round(ancho / 2.6));
  const paso = ancho / cols;

  const ventana = (cx: number, yTop: number, w: number, h: number): void => {
    const x = (cx - w / 2) * sx;
    const y = H - yTop * sy;
    const pw = w * sx;
    const ph = h * sy;
    // Alféizar y dintel.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x - 3, y + ph, pw + 6, 5);
    ctx.fillStyle = e.marco;
    ctx.fillRect(x - 5, y - 5, pw + 10, ph + 10);
    // Vidrio: reflejo de cielo, más claro arriba.
    const g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, "#9fb9d3");
    g.addColorStop(0.55, "#58728c");
    g.addColorStop(1, "#2f3d4b");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, pw, ph);
    // Alguna cortina a medio correr.
    if (azar() < 0.45) {
      const colores = ["#e8dcc4", "#d7c7a3", "#c9d3d8", "#e3cfc7", "#bfb49a"];
      ctx.fillStyle = colores[Math.floor(azar() * colores.length)];
      const cubre = 0.3 + azar() * 0.5;
      if (azar() < 0.5) ctx.fillRect(x, y, pw * cubre, ph);
      else ctx.fillRect(x + pw * (1 - cubre), y, pw * cubre, ph);
    }
    // Reflejo diagonal: la franja de brillo que tiene cualquier vidrio.
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + pw * 0.15, y);
    ctx.lineTo(x + pw * 0.45, y);
    ctx.lineTo(x + pw * 0.05, y + ph);
    ctx.lineTo(x, y + ph);
    ctx.closePath();
    ctx.fill();
    // Parteluz.
    ctx.fillStyle = e.marco;
    ctx.fillRect(x + pw / 2 - 2, y, 4, ph);
  };

  for (let piso = 1; piso < e.pisos; piso++) {
    const base = altoLocal + 0.3 + (piso - 1) * altoPiso;
    for (let c = 0; c < cols; c++) {
      const cx = paso * (c + 0.5);
      ventana(cx, base + altoPiso * 0.82, Math.min(1.5, paso * 0.58), altoPiso * 0.55);
      if (e.balcones) {
        // Baranda del balcón: barrotes finos sobre una losa.
        const bx = (cx - paso * 0.42) * sx;
        const by = H - (base + altoPiso * 0.26) * sy;
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(bx, by + 0.05 * sy, paso * 0.84 * sx, 0.12 * sy);
        ctx.fillStyle = "#f4f4f2";
        ctx.fillRect(bx, by, paso * 0.84 * sx, 0.08 * sy);
        ctx.fillStyle = "rgba(40,44,48,0.8)";
        for (let b = 0; b < paso * 0.84 * sx; b += 9) ctx.fillRect(bx + b, by - 0.9 * sy, 2, 0.9 * sy);
        ctx.fillRect(bx, by - 0.92 * sy, paso * 0.84 * sx, 3);
      }
    }
    // Línea de losa entre pisos.
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, H - base * sy, W, 4);
  }

  // El local de abajo: vitrina, puerta y letrero.
  const yLocal = H - altoLocal * sy;
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, yLocal - 6, W, 6);
  if (e.local) {
    const margen = Math.max(0.6, ancho * 0.08) * sx;
    const gl = ctx.createLinearGradient(0, yLocal + 1.1 * sy, 0, H);
    gl.addColorStop(0, "#6f8599");
    gl.addColorStop(1, "#1f262d");
    ctx.fillStyle = "#2a2f35";
    ctx.fillRect(margen - 6, yLocal + 1.0 * sy, W - margen * 2 + 12, H - yLocal - 1.0 * sy);
    ctx.fillStyle = gl;
    ctx.fillRect(margen, yLocal + 1.1 * sy, W - margen * 2, H - yLocal - 1.1 * sy - 0.25 * sy);
    // Interior del local, apenas: estanterías y luz cálida al fondo.
    ctx.fillStyle = "rgba(255,226,170,0.18)";
    ctx.fillRect(margen, yLocal + 1.4 * sy, W - margen * 2, 0.9 * sy);
    ctx.fillStyle = "rgba(20,20,20,0.35)";
    for (let k = margen + 20; k < W - margen - 20; k += 70) ctx.fillRect(k, yLocal + 1.6 * sy, 40, H - yLocal - 2.0 * sy);
    // Montantes de la vitrina.
    ctx.fillStyle = "#2a2f35";
    for (let k = margen; k <= W - margen; k += (W - margen * 2) / 4) ctx.fillRect(k - 3, yLocal + 1.1 * sy, 6, H - yLocal - 1.1 * sy);
    // Letrero.
    ctx.fillStyle = e.colorLocal;
    ctx.fillRect(margen - 6, yLocal + 0.15 * sy, W - margen * 2 + 12, 0.75 * sy);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(0.52 * sy)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.fillText(e.local, W / 2, yLocal + 0.53 * sy);
  } else {
    // Sin local: el acceso a los departamentos, con su portal y su reja.
    const pw = 2.4 * sx;
    const px = W / 2 - pw / 2;
    ctx.fillStyle = e.marco;
    ctx.fillRect(px - 8, yLocal + 0.6 * sy, pw + 16, H - yLocal - 0.6 * sy);
    ctx.fillStyle = "#2c3238";
    ctx.fillRect(px, yLocal + 0.7 * sy, pw, H - yLocal - 0.7 * sy);
    ctx.fillStyle = "rgba(200,210,220,0.25)";
    for (let k = 6; k < pw; k += 10) ctx.fillRect(px + k, yLocal + 0.7 * sy, 2, H - yLocal - 0.7 * sy);
    for (let c = 0; c < cols; c++) {
      const cx = paso * (c + 0.5);
      if (Math.abs(cx - ancho / 2) < 2.2) continue;
      ventana(cx, altoLocal - 0.6, Math.min(1.4, paso * 0.55), 1.6);
    }
  }
  // Zócalo.
  ctx.fillStyle = "rgba(30,30,30,0.35)";
  ctx.fillRect(0, H - 0.25 * sy, W, 0.25 * sy);
  // Cornisa.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, 0.22 * sy);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0.22 * sy, W, 3);

  tex.update();
  return tex;
}

function texturaToldo(scene: Scene, nombre: string, [a, b]: [string, string]): DynamicTexture {
  const { tex, ctx } = lienzo(scene, nombre, 512, 128);
  const franjas = 12;
  for (let k = 0; k < franjas; k++) {
    ctx.fillStyle = k % 2 === 0 ? a : b;
    ctx.fillRect((k * 512) / franjas, 0, 512 / franjas + 1, 128);
  }
  // Pliegue y sombra del borde.
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0.12)");
  g.addColorStop(0.8, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);
  tex.update();
  return tex;
}

function texturaCiudad(scene: Scene): DynamicTexture {
  const W = 2048;
  const H = 256;
  const { tex, ctx } = lienzo(scene, "texCiudadLejana", W, H);
  ctx.clearRect(0, 0, W, H);
  const azar = crearAzar(31);
  // Dos filas de bloques, la de atrás más velada: el aire los aclara.
  const fila = (color: string, alto: [number, number], ventanas: string): void => {
    let x = 0;
    while (x < W) {
      const w = 30 + azar() * 90;
      const h = alto[0] + azar() * (alto[1] - alto[0]);
      ctx.fillStyle = color;
      ctx.fillRect(x, H - h, w, h);
      ctx.fillStyle = ventanas;
      for (let yy = H - h + 8; yy < H - 6; yy += 9) {
        for (let xx = x + 5; xx < x + w - 5; xx += 8) if (azar() < 0.55) ctx.fillRect(xx, yy, 4, 4);
      }
      x += w + azar() * 14;
    }
  };
  fila("rgba(150,168,186,1)", [60, 190], "rgba(175,190,205,0.9)");
  fila("rgba(126,144,160,1)", [30, 110], "rgba(150,165,180,0.9)");
  // Velo de aire, más denso abajo.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(206,214,222,0)");
  g.addColorStop(1, "rgba(206,214,222,0.35)");
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  tex.update();
  return tex;
}

function texturaCordillera(scene: Scene): DynamicTexture {
  const W = 2048;
  const H = 512;
  const { tex, ctx } = lienzo(scene, "texCordillera", W, H);
  ctx.clearRect(0, 0, W, H);
  const cresta = (x: number): number => {
    const n = fbm(x / 260, 0.5, 41, 5);
    const picos = Math.pow(Math.abs(Math.sin(x / 190 + fbm(x / 400, 1.7, 43, 2) * 3)), 1.6);
    return H * (0.18 + 0.5 * n + 0.22 * picos);
  };
  // Cerro.
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, H - cresta(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, H * 0.2, 0, H);
  g.addColorStop(0, "#8d9db4");
  g.addColorStop(1, "#b3bfcd");
  ctx.fillStyle = g;
  ctx.fill();
  // Nieve en lo alto: solo por encima de una cota, y con los bordes rotos.
  ctx.save();
  ctx.clip();
  for (let x = 0; x <= W; x += 3) {
    const alto = cresta(x);
    const cota = H * 0.52;
    if (alto > cota) {
      const nieve = (alto - cota) * (0.55 + fbm(x / 30, 3.3, 47, 3) * 0.6);
      const gg = ctx.createLinearGradient(0, H - alto, 0, H - alto + nieve);
      gg.addColorStop(0, "rgba(246,247,250,0.95)");
      gg.addColorStop(1, "rgba(246,247,250,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(x, H - alto, 3, nieve);
    }
  }
  ctx.restore();
  tex.update();
  return tex;
}

function texturaCielo(scene: Scene): DynamicTexture {
  const W = 2048;
  const H = 1024;
  const { tex, ctx } = lienzo(scene, "texCieloTarde", W, H);
  // ─── EL LIENZO VA AL REVÉS ───────────────────────────────────────────────
  //
  // La esfera de Babylon pone v = 0 en el polo de arriba, y el lienzo sube a
  // la textura con la fila de arriba en v = 1. Así que el cenit se pinta
  // ABAJO del lienzo. Pintado al derecho, desde dentro se veía la franja gris
  // de debajo del horizonte donde tenía que estar el cielo.
  ctx.translate(0, H);
  ctx.scale(1, -1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  // La franja clara del horizonte, estrecha: desde dentro solo se ve el
  // cielo bajo —los primeros quince grados— y con la franja ancha ese cielo
  // salía gris. Así el azul empieza a pocos grados sobre los tejados.
  g.addColorStop(0, "#2d62ad");
  g.addColorStop(0.25, "#4a80c6");
  g.addColorStop(0.4, "#78a4d8");
  g.addColorStop(0.47, "#b3cde6");
  g.addColorStop(0.495, "#e4dccb");
  g.addColorStop(0.51, "#cdd0d0");
  g.addColorStop(1, "#b9bcbc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Nubes: cúmulos aplastados cerca del horizonte, blancos con el vientre gris.
  const azar = crearAzar(57);
  for (let i = 0; i < 70; i++) {
    const cx = azar() * W;
    const cy = H * (0.28 + azar() * 0.2);
    const r = 20 + azar() * 60;
    for (let k = 0; k < 7; k++) {
      const x = cx + (azar() - 0.5) * r * 3;
      const y = cy + (azar() - 0.5) * r * 0.5;
      const rr = r * (0.5 + azar() * 0.6);
      const gr = ctx.createRadialGradient(x, y - rr * 0.2, 0, x, y, rr);
      gr.addColorStop(0, "rgba(255,255,255,0.55)");
      gr.addColorStop(0.6, "rgba(236,238,242,0.3)");
      gr.addColorStop(1, "rgba(220,225,232,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, rr * 1.6, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  tex.update();
  return tex;
}
