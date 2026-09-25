import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  ReflectionProbe,
  TransformNode,
  type AbstractMesh,
  type Light,
} from "@babylonjs/core";
import { crearAuto, crearArbolFrondoso } from "./ModelosExterior";
import {
  pbr,
  fundir,
  porMaterial,
  escalarUV,
  texturaAsfalto,
  texturaBaldosa,
  texturaFachada,
  texturaToldo,
  texturaCielo,
  type Edificio,
} from "./ExteriorSupermercado";

// ===========================================================================
// Lo que se ve desde el banco: la explanada, la calle y la cuadra de enfrente
// ===========================================================================
//
// Detrás de la puerta y de las ventanas había vacío: el color de fondo de la
// escena. Desde el puesto la puerta queda a un par de metros, y cada vez que
// alguien entra o sale se ve lo que hay fuera; por las ventanas de los
// costados, todo el rato.
//
// Es una mañana de centro, en capas a distancias reales:
//
//   · la explanada del propio banco, que trae el modelo, y la vereda;
//   · la calle, de dos pistas, con un auto estacionado junto a la solera;
//   · la vereda de enfrente y una hilera de locales con oficinas encima;
//   · a los costados, los edificios vecinos, que es lo que se ve por las
//     ventanas laterales;
//   · el cielo de la mañana.
//
// Las texturas pintadas son las mismas del supermercado (ver
// ExteriorSupermercado): fachadas con sus ventanas y sus locales, asfalto y
// baldosa. Es la misma ciudad.
//
// ─── LA LUZ ES SUYA ──────────────────────────────────────────────────────
//
// Un sol y un cielo que SOLO alumbran lo de fuera, y las luces del hall que no
// alumbran nada de fuera: igual que en el supermercado, y por lo mismo. Sin
// esa separación el sol entraría por los muros —la sala no tiene sombras— y
// los paneles del techo teñirían la calle.

/** La explanada del modelo, a escala 3: su cara de arriba y su borde. */
export const Y_EXPLANADA = 0.45;
const BORDE_EXPLANADA = 8.36;
/** Hasta dónde llega la vereda antes de la calle. */
const VEREDA_FIN_Z = -11.2;
const CALLE_FIN_Z = -18.4;
const VEREDA_ENFRENTE_FIN_Z = -21.4;
/** Lo que baja la calzada respecto de la vereda: la solera. */
const SOLERA = 0.14;
const Y_CALLE = Y_EXPLANADA - SOLERA;

export interface ExteriorBanco {
  /** Todo lo de fuera, para dejarlo fuera de las luces del hall. */
  mallas: AbstractMesh[];
  /** El sol y el cielo: las únicas luces que alumbran fuera. */
  luces: Light[];
}

/**
 * @param proyectan  Lo del modelo que da sombra fuera: el edificio del banco
 *                   sobre su explanada.
 * @param deFuera    Lo del modelo que está fuera y tiene que alumbrarlo el sol:
 *                   la explanada.
 */
export function construirExteriorBanco(scene: Scene, proyectan: AbstractMesh[], deFuera: AbstractMesh[]): ExteriorBanco {
  const mallas: AbstractMesh[] = [...deFuera];
  const guardar = <T extends AbstractMesh>(m: T): T => {
    m.isPickable = false;
    mallas.push(m);
    return m;
  };
  const reciben: AbstractMesh[] = [...deFuera];
  const dan: AbstractMesh[] = [...proyectan];

  // --- El suelo -------------------------------------------------------------

  const asfalto = pbr(scene, "matAsfaltoBanco", texturaAsfalto(scene), 0.9);
  const baldosa = pbr(scene, "matVeredaBanco", texturaBaldosa(scene), 0.85);
  const solera = new PBRMaterial("matSoleraBanco", scene);
  solera.albedoColor = new Color3(0.64, 0.63, 0.6);
  solera.roughness = 0.85;
  solera.metallic = 0;
  const pintura = new PBRMaterial("matPinturaVialBanco", scene);
  pintura.albedoColor = new Color3(0.9, 0.9, 0.88);
  pintura.roughness = 0.7;
  pintura.metallic = 0;

  const losa = (nombre: string, x0: number, x1: number, z0: number, z1: number, y: number, mat: PBRMaterial, metros: number): Mesh => {
    const m = MeshBuilder.CreateGround(nombre, { width: x1 - x0, height: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    escalarUV(m, (x1 - x0) / metros, (z1 - z0) / metros);
    m.material = mat;
    m.receiveShadows = true;
    reciben.push(m);
    return guardar(m);
  };

  // Un fondo muy grande a la altura de la calle, para que nada se asome al
  // vacío mirando de canto por una ventana.
  losa("fondoBanco", -220, 220, -220, 220, Y_CALLE - 0.02, asfalto, 6);
  // La vereda, de la explanada a la solera, y a los costados del banco hasta
  // los edificios vecinos. Medio centímetro por debajo de la explanada: al ras,
  // las dos caras pelean por el mismo píxel y el borde parpadea.
  const Y_VEREDA = Y_EXPLANADA - 0.005;
  losa("veredaBanco", -60, 60, VEREDA_FIN_Z, -BORDE_EXPLANADA + 0.02, Y_VEREDA, baldosa, 2.4);
  losa("pasajeIzquierdoBanco", -14, -BORDE_EXPLANADA + 0.02, -BORDE_EXPLANADA, 16, Y_VEREDA, baldosa, 2.4);
  losa("pasajeDerechoBanco", BORDE_EXPLANADA - 0.02, 15.5, -BORDE_EXPLANADA, 16, Y_VEREDA, baldosa, 2.4);
  losa("calzadaBanco", -60, 60, CALLE_FIN_Z, VEREDA_FIN_Z, Y_CALLE, asfalto, 5);
  losa("veredaEnfrenteBanco", -60, 60, VEREDA_ENFRENTE_FIN_Z, CALLE_FIN_Z, Y_VEREDA, baldosa, 2.4);

  // Las soleras de canto, la arista de piedra entre vereda y calle.
  const cantos: Mesh[] = [];
  [VEREDA_FIN_Z, CALLE_FIN_Z].forEach((z) => {
    const m = MeshBuilder.CreateBox("soleraBanco", { width: 120, height: SOLERA + 0.03, depth: 0.14 }, scene);
    m.position.set(0, Y_CALLE + (SOLERA + 0.03) / 2 - 0.02, z);
    cantos.push(m);
  });
  const mCantos = guardar(fundir("solerasBanco", cantos, solera));
  mCantos.receiveShadows = true;
  reciben.push(mCantos);

  // La pintura de la calle: los bordes continuos y el eje segmentado.
  const rayas: Mesh[] = [];
  const raya = (x0: number, x1: number, z0: number, z1: number): void => {
    const m = MeshBuilder.CreateGround("rayaBanco", { width: x1 - x0, height: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, Y_CALLE + 0.006, (z0 + z1) / 2);
    rayas.push(m);
  };
  raya(-60, 60, VEREDA_FIN_Z - 0.37, VEREDA_FIN_Z - 0.25);
  raya(-60, 60, CALLE_FIN_Z + 0.25, CALLE_FIN_Z + 0.37);
  const ejeZ = (VEREDA_FIN_Z + CALLE_FIN_Z) / 2;
  for (let x = -60; x < 60; x += 7) raya(x, x + 3, ejeZ - 0.06, ejeZ + 0.06);
  const mRayas = guardar(fundir("pinturaVialBanco", rayas, pintura));
  mRayas.receiveShadows = true;
  reciben.push(mRayas);

  // --- Los edificios ----------------------------------------------------------
  //
  // Enfrente, una hilera de locales con oficinas encima: lo que se ve cada vez
  // que la puerta se abre. A los costados, los vecinos, con sus fachadas hacia
  // el banco: es lo que dan las ventanas laterales.
  const edificio = (
    nombre: string,
    e: Edificio,
    centro: Vector3,
    giro: number,
    fondo: number,
    semilla: number
  ): void => {
    const ancho = e.x1 - e.x0;
    const raiz = new TransformNode(nombre, scene);
    raiz.position.copyFrom(centro);
    raiz.rotation.y = giro;

    const cuerpo = MeshBuilder.CreateBox(`${nombre}_cuerpo`, { width: ancho, height: e.alto, depth: fondo }, scene);
    cuerpo.parent = raiz;
    cuerpo.position.set(0, e.alto / 2, fondo / 2 + 0.02);
    const matCuerpo = new PBRMaterial(`mat_${nombre}_cuerpo`, scene);
    matCuerpo.albedoColor = Color3.FromHexString(e.muro).scale(0.92);
    matCuerpo.roughness = 0.9;
    matCuerpo.metallic = 0;
    cuerpo.material = matCuerpo;

    const fachada = MeshBuilder.CreatePlane(`${nombre}_fachada`, { width: ancho, height: e.alto }, scene);
    fachada.parent = raiz;
    fachada.position.set(0, e.alto / 2, 0);
    const mat = new PBRMaterial(`mat_${nombre}_fachada`, scene);
    const pintada = texturaFachada(scene, `tex_${nombre}`, e, semilla);
    mat.albedoTexture = pintada.albedo;
    // Las ventanas encendidas son de la noche del supermercado; aquí es de
    // mañana y no se usan. Se desechan ya: sin material que las lleve, nadie
    // las recogería al salir.
    pintada.luz.dispose();
    mat.roughness = 0.82;
    mat.metallic = 0;
    fachada.material = mat;

    const piezas: Mesh[] = [cuerpo, fachada];
    if (e.toldo) {
      const t = MeshBuilder.CreatePlane(`${nombre}_toldo`, { width: Math.min(ancho - 1.2, 7.5), height: 1.35 }, scene);
      t.parent = raiz;
      t.position.set(0, 2.95, -0.55);
      t.rotation.x = -0.62;
      const mt = new PBRMaterial(`mat_${nombre}_toldo`, scene);
      mt.albedoTexture = texturaToldo(scene, `texToldo_${nombre}`, e.toldo);
      mt.roughness = 0.8;
      mt.metallic = 0;
      mt.backFaceCulling = false;
      t.material = mt;
      piezas.push(t);
    }
    raiz.computeWorldMatrix(true);
    piezas.forEach((m) => {
      m.computeWorldMatrix(true);
      guardar(m);
      dan.push(m);
    });
  };

  // Enfrente: la fachada mira al banco, hacia +Z. Un plano de Babylon mira a
  // −Z, así que se le da media vuelta.
  const Z_ENFRENTE = VEREDA_ENFRENTE_FIN_Z - 0.6;
  const ENFRENTE: Edificio[] = [
    { x0: -34, x1: -21, alto: 10.5, pisos: 3, muro: "#e3d7bf", marco: "#ffffff", local: "FARMACIA", colorLocal: "#2f8a4c", toldo: ["#2f8a4c", "#2f8a4c"] },
    { x0: -20, x1: -9.5, alto: 13.6, pisos: 4, muro: "#9c5a44", marco: "#efe8dc", local: "CAFÉ", colorLocal: "#5a3a26", toldo: ["#3d2a1e", "#3d2a1e"], ladrillo: true },
    { x0: -8.5, x1: 6.5, alto: 19.5, pisos: 6, muro: "#c9ccce", marco: "#3a3f44", local: "", colorLocal: "#5b6b76", toldo: null, balcones: true },
    { x0: 7.5, x1: 18, alto: 9.2, pisos: 3, muro: "#d9b56a", marco: "#fdf8ee", local: "LIBRERÍA", colorLocal: "#2d4f8e", toldo: ["#2d4f8e", "#e9e4d6"] },
    { x0: 19, x1: 32, alto: 12.2, pisos: 4, muro: "#b9cdd8", marco: "#ffffff", local: "ÓPTICA", colorLocal: "#3a4a5a", toldo: null },
  ];
  ENFRENTE.forEach((e, i) =>
    edificio(`enfrenteBanco_${i}`, e, new Vector3((e.x0 + e.x1) / 2, Y_VEREDA, Z_ENFRENTE), Math.PI, 12, 300 + i * 17)
  );
  // Los vecinos, a los lados del banco, de cara a sus ventanas.
  const VECINO_IZQ: Edificio = { x0: 0, x1: 22, alto: 14.5, pisos: 4, muro: "#d8d2c4", marco: "#ffffff", local: "", colorLocal: "#5b6b76", toldo: null };
  const VECINO_DER: Edificio = { x0: 0, x1: 22, alto: 11.8, pisos: 3, muro: "#a7b4ad", marco: "#f4f1ea", local: "", colorLocal: "#5b6b76", toldo: null, balcones: true };
  edificio("vecinoIzquierdoBanco", VECINO_IZQ, new Vector3(-14, Y_VEREDA, 2.5), -Math.PI / 2, 10, 411);
  edificio("vecinoDerechoBanco", VECINO_DER, new Vector3(15.5, Y_VEREDA, 2.5), Math.PI / 2, 10, 437);

  // --- Árboles de la vereda y un auto estacionado ------------------------------

  const follaje = new PBRMaterial("matFollajeBanco", scene);
  follaje.albedoColor = new Color3(0.27, 0.41, 0.16);
  follaje.roughness = 0.85;
  follaje.metallic = 0;
  const follajeHondo = new PBRMaterial("matFollajeHondoBanco", scene);
  follajeHondo.albedoColor = new Color3(0.14, 0.25, 0.09);
  follajeHondo.roughness = 0.9;
  follajeHondo.metallic = 0;
  const corteza = new PBRMaterial("matCortezaBanco", scene);
  corteza.albedoColor = new Color3(0.23, 0.17, 0.12);
  corteza.roughness = 0.95;
  corteza.metallic = 0;
  // A los lados de la puerta, dejando libre lo que se ve desde el puesto.
  [-9.5, 10.5, -26, 27].forEach((x, i) => {
    crearArbolFrondoso(scene, `arbolBanco_${i}`, 6.2 + (i % 2) * 1.1, 21 + i * 5, [follaje, follajeHondo], corteza).forEach((m) => {
      m.position.x += x;
      m.position.z += VEREDA_FIN_Z + 0.9;
      m.position.y += Y_VEREDA;
      guardar(m);
      dan.push(m);
    });
  });

  const reflejanCielo: PBRMaterial[] = [];
  const estacionar = (nombre: string, color: Color3, patente: string, x: number, z: number, giro: number, hatch: boolean): void => {
    const raiz = new TransformNode(nombre, scene);
    const piezas = crearAuto(scene, nombre, { color, patente, hatch });
    piezas.forEach((m) => (m.parent = raiz));
    raiz.position.set(x, Y_CALLE + 0.004, z);
    raiz.rotation.y = giro;
    raiz.computeWorldMatrix(true);
    for (const m of porMaterial(piezas)) {
      guardar(m);
      dan.push(m);
      if (m.material instanceof PBRMaterial && !reflejanCielo.includes(m.material)) reflejanCielo.push(m.material);
    }
  };
  estacionar("autoBanco_0", new Color3(0.62, 0.64, 0.66), "LR·KP·31", 8.2, VEREDA_FIN_Z - 1.25, Math.PI, false);
  estacionar("autoBanco_1", new Color3(0.08, 0.18, 0.32), "FZ·HT·84", -13.5, CALLE_FIN_Z + 1.25, 0, true);

  // --- El cielo -------------------------------------------------------------------
  //
  // El de la tarde del supermercado, que es un cielo de día despejado: azul
  // arriba y velado hacia el horizonte. Por las ventanas altas del hall es lo
  // único que se ve.
  const esfera = MeshBuilder.CreateSphere("cieloBanco", { diameter: 1900, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const matCielo = new StandardMaterial("matCieloBanco", scene);
  matCielo.emissiveTexture = texturaCielo(scene, "texCieloBanco", "tarde");
  matCielo.disableLighting = true;
  matCielo.backFaceCulling = false;
  esfera.material = matCielo;
  esfera.infiniteDistance = true;
  guardar(esfera);

  // --- La luz de la mañana ----------------------------------------------------------
  //
  // El sol, alto y por detrás del banco: alumbra de lleno la hilera de enfrente
  // —que es lo que se ve por la puerta— y deja la fachada del banco y su
  // explanada en su propia sombra, que es como se ve una calle de centro a
  // media mañana.
  const sol = new DirectionalLight("solBanco", new Vector3(-0.38, -0.66, -0.65).normalize(), scene);
  sol.position = new Vector3(20, 40, 30);
  sol.diffuse = new Color3(1, 0.95, 0.86);
  sol.specular = new Color3(1, 0.95, 0.88);
  sol.intensity = 3.2;
  const cieloLuz = new HemisphericLight("cieloLuzBanco", new Vector3(0, 1, 0), scene);
  // Poco azul: la sombra de la calle es algo fría, pero con el cielo puro
  // la vereda a la sombra del banco salía celeste, como mojada.
  cieloLuz.diffuse = new Color3(0.8, 0.84, 0.92);
  cieloLuz.groundColor = new Color3(0.42, 0.4, 0.37);
  cieloLuz.intensity = 1.0;
  sol.includedOnlyMeshes = [...mallas];
  cieloLuz.includedOnlyMeshes = [...mallas];

  // Sombras: una vez. Fuera no se mueve nada.
  const sombras = new ShadowGenerator(2048, sol);
  sombras.usePercentageCloserFiltering = true;
  sombras.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  sombras.bias = 0.0009;
  sombras.normalBias = 0.02;
  sombras.darkness = 0.15;
  sol.shadowMinZ = 5;
  sol.shadowMaxZ = 110;
  dan.forEach((m) => sombras.addShadowCaster(m, false));
  reciben.forEach((m) => (m.receiveShadows = true));
  const mapa = sombras.getShadowMap();
  if (mapa) mapa.refreshRate = 0;

  // El reflejo de lo de fuera: el cielo y la cuadra, fotografiados una vez
  // desde la calle. Sin esto, lo de fuera reflejaría el entorno de la escena,
  // que es el HALL —muros azules—, y la explanada salía celeste, como mojada.
  const sonda = new ReflectionProbe("sondaExteriorBanco", 256, scene);
  sonda.position = new Vector3(0, 1.6, (VEREDA_FIN_Z + CALLE_FIN_Z) / 2);
  mallas.forEach((m) => sonda.renderList!.push(m));
  sonda.refreshRate = 0;
  // Un cuadro después: enchufada antes, lo que la sonda dibuja intenta leerla
  // mientras se escribe (ver la del condominio).
  const reflejanFuera = new Set<PBRMaterial>(reflejanCielo);
  mallas.forEach((m) => {
    if (m.material instanceof PBRMaterial) reflejanFuera.add(m.material);
  });
  scene.onAfterRenderObservable.addOnce(() => {
    reflejanFuera.forEach((m) => (m.reflectionTexture = sonda.cubeTexture));
  });

  // Nada de esto se mueve.
  mallas.forEach((m) => m.freezeWorldMatrix());

  return { mallas, luces: [sol, cieloLuz] };
}
