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
  VertexData,
  type AbstractMesh,
  type Light,
} from "@babylonjs/core";
import { crearAuto, crearArbolFrondoso } from "./ModelosExterior";
import { crearPatrullaBanco } from "./PatrullaBanco";
import { crearCalleBanco } from "./CalleBanco";
import { crearTallerFachadas } from "./FachadaBanco";
import {
  pbr,
  fundir,
  porMaterial,
  escalarUV,
  texturaAsfalto,
  texturaBaldosa,
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
  /**
   * Las luces que alumbran fuera: el sol, el cielo y las balizas de la
   * patrulla. Son las que quedan fuera de la exclusión del hall (ver el
   * puesto): una que no estuviera aquí no alumbraría nada de fuera.
   */
  luces: Light[];
  /** Los autos que pasan y la gente de la vereda. Ver CalleBanco. */
  calle: {
    /** Se detiene con la pausa y los paneles, como la sala. */
    congelar(quieta: boolean): void;
    /** La gente se va antes del asalto y vuelve con Carabineros. */
    despejar(vacia: boolean): void;
    dispose(): void;
  };
  /**
   * Las radiopatrullas de Carabineros, que llegan después del asalto: la del
   * sargento frente a la puerta y la del cabo en la calle del costado. Ver
   * PatrullaBanco.
   */
  patrulla: {
    /** Aparecen estacionadas, con su sombra y las balizas destellando. */
    aparecer(): void;
    /**
     * Qué baliza tiene encendida la del costado: la que se ve por la ventana
     * de la izquierda, y la que tiñe lo de dentro (ver el puesto).
     */
    destelloApoyo(): { rojo: boolean; azul: boolean };
    dispose(): void;
  };
}

/**
 * Dónde queda la patrulla: sobre la explanada, delante del banco y algo
 * cruzada, como quien llegó rápido y se subió, a unos pasos de la puerta:
 * el sargento se baja y entra. Medido para que desde el puesto, por la
 * puerta abierta, se vea entera y cerca: en la vereda la tapaba el marco, y
 * en la calle quedaba a veinte metros, del tamaño de un dedo.
 */
const PATRULLA = { x: -4.3, z: -6.3, giro: 0.12 };

/**
 * La segunda patrulla, la del cabo: estacionada en la calle del costado,
 * contra la solera del banco y mirando hacia el fondo, como quien dobló desde
 * la calle de delante. Justo detrás de la ventana baja del fondo de la pared
 * izquierda, que en la declaración queda detrás del sargento: las balizas se
 * ven destellar por ella todo el rato (ver la luz que se cuela en el puesto).
 */
const PATRULLA_APOYO = { x: -11.15, z: 6.0, giro: -Math.PI / 2 };

/**
 * La calle del costado izquierdo, la que se ve por las ventanas de ese lado:
 * de un sentido, hacia el fondo, con vereda a los dos lados. Antes era un
 * pasaje de baldosas vacío con el vecino a seis metros del banco; ahora el
 * vecino está donde deja sitio para una calle de verdad.
 *
 *   · la vereda del banco, de la explanada a la solera;
 *   · la calzada, a la altura de la calle de delante;
 *   · la vereda del vecino, hasta su fachada.
 *
 * Donde se junta con la calle de delante, la vereda de delante sigue de
 * largo a su altura —vereda continua— y los autos la cruzan subiendo y
 * bajando por dos rebajes de hormigón.
 */
const COSTADO_CALZADA: [number, number] = [-14.6, -10.2];
const VECINO_IZQ_X = -16.4;
const COSTADO_FIN = 30;
/** Lo que mide cada rebaje, a lo largo de la calle. */
const REBAJE = 0.6;

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
  const [CX0, CX1] = COSTADO_CALZADA;
  losa("veredaBanco", -60, 60, VEREDA_FIN_Z, -BORDE_EXPLANADA + 0.02, Y_VEREDA, baldosa, 2.4);
  // La calle del costado: sus dos veredas y la calzada, que empieza al pie
  // del rebaje.
  losa("veredaCostadoBanco", CX1, -BORDE_EXPLANADA + 0.02, -BORDE_EXPLANADA, COSTADO_FIN, Y_VEREDA, baldosa, 2.4);
  losa("veredaCostadoVecino", VECINO_IZQ_X - 0.4, CX0, -BORDE_EXPLANADA, COSTADO_FIN, Y_VEREDA, baldosa, 2.4);
  losa("calzadaCostadoBanco", CX0, CX1, -BORDE_EXPLANADA + REBAJE, COSTADO_FIN, Y_CALLE, asfalto, 5);
  losa("pasajeDerechoBanco", BORDE_EXPLANADA - 0.02, 15.5, -BORDE_EXPLANADA, 16, Y_VEREDA, baldosa, 2.4);
  losa("calzadaBanco", -60, 60, CALLE_FIN_Z, VEREDA_FIN_Z, Y_CALLE, asfalto, 5);
  losa("veredaEnfrenteBanco", -60, 60, VEREDA_ENFRENTE_FIN_Z, CALLE_FIN_Z, Y_VEREDA, baldosa, 2.4);

  // Los dos rebajes: de la calle de delante a la vereda que se cruza, y de
  // esa vereda a la calzada del costado. Hormigón, como la solera: se ven
  // más claros que el asfalto, como los de verdad.
  const rebaje = (nombre: string, zBajo: number, zAlto: number): void => {
    const vd = new VertexData();
    vd.positions = [CX0, Y_CALLE + 0.003, zBajo, CX1, Y_CALLE + 0.003, zBajo, CX1, Y_VEREDA, zAlto, CX0, Y_VEREDA, zAlto];
    vd.uvs = [CX0 / 1.2, zBajo / 1.2, CX1 / 1.2, zBajo / 1.2, CX1 / 1.2, zAlto / 1.2, CX0 / 1.2, zAlto / 1.2];
    vd.indices = [0, 1, 2, 0, 2, 3];
    const normales: number[] = [];
    VertexData.ComputeNormals(vd.positions, vd.indices, normales);
    // Que mire hacia arriba, venga como venga el orden de los puntos.
    if (normales[1] < 0) {
      vd.indices = [0, 2, 1, 0, 3, 2];
      VertexData.ComputeNormals(vd.positions, vd.indices, normales);
    }
    vd.normals = normales;
    const m = new Mesh(nombre, scene);
    vd.applyToMesh(m);
    m.material = solera;
    m.receiveShadows = true;
    reciben.push(m);
    guardar(m);
  };
  rebaje("rebajeEntradaCostadoBanco", VEREDA_FIN_Z - REBAJE, VEREDA_FIN_Z);
  rebaje("rebajeCostadoBanco", -BORDE_EXPLANADA + REBAJE, -BORDE_EXPLANADA);

  /**
   * El alto del suelo bajo una rueda: la calzada, los rebajes y la vereda
   * que se cruza. Es lo que pisan los autos que doblan.
   */
  const suelo = (x: number, z: number): number => {
    const enLaBoca = x > CX0 - 0.3 && x < CX1 + 0.3;
    if (z < VEREDA_FIN_Z) {
      if (enLaBoca && z > VEREDA_FIN_Z - REBAJE) return Y_CALLE + ((Y_VEREDA - Y_CALLE) * (z - (VEREDA_FIN_Z - REBAJE))) / REBAJE;
      return Y_CALLE;
    }
    if (z < -BORDE_EXPLANADA || !enLaBoca) return Y_VEREDA;
    if (z < -BORDE_EXPLANADA + REBAJE) return Y_VEREDA - ((Y_VEREDA - Y_CALLE) * (z + BORDE_EXPLANADA)) / REBAJE;
    return Y_CALLE;
  };

  // Las soleras de canto, la arista de piedra entre vereda y calle: la de
  // delante, cortada donde entra la calle del costado, y las dos de este.
  const cantos: Mesh[] = [];
  const canto = (x0: number, x1: number, z0: number, z1: number): void => {
    const m = MeshBuilder.CreateBox("soleraBanco", { width: x1 - x0, height: SOLERA + 0.03, depth: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, Y_CALLE + (SOLERA + 0.03) / 2 - 0.02, (z0 + z1) / 2);
    cantos.push(m);
  };
  canto(-60, CX0, VEREDA_FIN_Z - 0.07, VEREDA_FIN_Z + 0.07);
  canto(CX1, 60, VEREDA_FIN_Z - 0.07, VEREDA_FIN_Z + 0.07);
  canto(-60, 60, CALLE_FIN_Z - 0.07, CALLE_FIN_Z + 0.07);
  canto(CX0 - 0.07, CX0 + 0.07, -BORDE_EXPLANADA, COSTADO_FIN);
  canto(CX1 - 0.07, CX1 + 0.07, -BORDE_EXPLANADA, COSTADO_FIN);
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
  // La de este lado, cortada en la boca de la calle del costado.
  raya(-60, CX0 - 0.4, VEREDA_FIN_Z - 0.37, VEREDA_FIN_Z - 0.25);
  raya(CX1 + 0.4, 60, VEREDA_FIN_Z - 0.37, VEREDA_FIN_Z - 0.25);
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
  // el banco: es lo que dan las ventanas laterales. Con volumen: huecos,
  // marcos, alféizares, cornisas y un revoque con relieve y con años (ver
  // FachadaBanco). Pintados en un plano se veían de cartón.
  const taller = crearTallerFachadas(scene);
  const edificio = (nombre: string, e: Edificio, centro: Vector3, giro: number, fondo: number, semilla: number): void => {
    taller.edificio(nombre, e, centro, giro, fondo, semilla).forEach((m) => {
      m.receiveShadows = true;
      guardar(m);
      reciben.push(m);
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
  // El de la izquierda, al sol y a diez metros de las ventanas: un beige algo
  // tostado, no el casi blanco de antes, que al sol se quemaba.
  const VECINO_IZQ: Edificio = { x0: 0, x1: 22, alto: 14.5, pisos: 4, muro: "#cbbfa8", marco: "#ffffff", local: "", colorLocal: "#5b6b76", toldo: null };
  const VECINO_DER: Edificio = { x0: 0, x1: 22, alto: 11.8, pisos: 3, muro: "#a7b4ad", marco: "#f4f1ea", local: "", colorLocal: "#5b6b76", toldo: null, balcones: true };
  edificio("vecinoIzquierdoBanco", VECINO_IZQ, new Vector3(VECINO_IZQ_X, Y_VEREDA, 2.5), -Math.PI / 2, 10, 411);
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

  // Las patrullas: montadas ya, como un auto más de fuera —con su sol, su
  // sombra y su reflejo del cielo—, pero apagadas hasta que llegan. La del
  // sargento, en la explanada frente a la puerta; la del cabo, en la calle
  // del costado, y con su destello a destiempo de la otra.
  const patrulla = crearPatrullaBanco(scene, new Vector3(PATRULLA.x, Y_EXPLANADA + 0.012, PATRULLA.z), PATRULLA.giro);
  const apoyo = crearPatrullaBanco(scene, new Vector3(PATRULLA_APOYO.x, Y_CALLE + 0.004, PATRULLA_APOYO.z), PATRULLA_APOYO.giro, {
    nombre: "patrullaApoyoBanco",
    patente: "Z-4388",
    fase: 0.43,
  });
  const piezasPatrulla: Mesh[] = [];
  for (const m of [...porMaterial(patrulla.piezas), ...porMaterial(apoyo.piezas)]) {
    guardar(m);
    // La mancha de debajo no da sombra: es la sombra.
    if (!m.name.includes("sombraContacto")) dan.push(m);
    piezasPatrulla.push(m);
    if (m.material instanceof PBRMaterial && !reflejanCielo.includes(m.material)) reflejanCielo.push(m.material);
    m.setEnabled(false);
  }

  // La calle viva: autos que pasan —algunos doblan al costado— y gente
  // caminando. Son de fuera —el sol los alumbra, el hall no—, pero se mueven:
  // no entran en lo que se dibuja una vez ni se congelan (ver abajo).
  const calle = crearCalleBanco(scene, {
    yVereda: Y_VEREDA,
    zCarril: (VEREDA_FIN_Z + CALLE_FIN_Z) / 2,
    carriles: [-8.5, -8.85, -9.3, -9.7],
    costado: {
      xCarril: (CX0 + CX1) / 2,
      zFin: COSTADO_FIN,
      // Cada vereda, con sus dos carriles de a pie. Las puntas donde se da la
      // vuelta, fuera de lo que se ve desde el puesto: la de delante la tapa
      // la fachada; la del fondo queda más allá de las ventanas.
      veredaBanco: [-9.0, -9.6],
      veredaVecino: [-15.2, -15.8],
      zBanco: [-6, 16],
      zVecino: [-7.6, 16],
    },
    cruce: { x0: CX0, x1: CX1, z0: VEREDA_FIN_Z, z1: -BORDE_EXPLANADA },
    suelo,
  });
  const moviles = new Set<AbstractMesh>(calle.mallas);
  calle.mallas.forEach((m) => mallas.push(m));

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
  // Las balizas, igual que el sol: solo lo de fuera. Sin sombras, una luz que
  // alumbrara el edificio le pintaría también las paredes de dentro.
  [...patrulla.luces, ...apoyo.luces].forEach((l) => (l.includedOnlyMeshes = [...mallas]));

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
  mallas.forEach((m) => {
    if (!moviles.has(m)) sonda.renderList!.push(m);
  });
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
  mallas.forEach((m) => {
    if (!moviles.has(m)) m.freezeWorldMatrix();
  });

  return {
    mallas,
    luces: [sol, cieloLuz, ...patrulla.luces, ...apoyo.luces],
    calle: {
      congelar: (q) => calle.congelar(q),
      despejar: (v) => calle.despejar(v),
      dispose: () => calle.dispose(),
    },
    patrulla: {
      aparecer() {
        piezasPatrulla.forEach((m) => m.setEnabled(true));
        // Las sombras de fuera se dibujaron una vez, sin ellas: otra vez, con
        // ellas dentro, o quedarían flotando.
        mapa?.resetRefreshCounter();
        patrulla.encender();
        apoyo.encender();
        // Quien pasa por la vereda las mira: las balizas, a la altura del techo.
        calle.mirarAlPasar([
          new Vector3(PATRULLA.x, Y_EXPLANADA + 1.35, PATRULLA.z),
          new Vector3(PATRULLA_APOYO.x, Y_CALLE + 1.35, PATRULLA_APOYO.z),
        ]);
      },
      destelloApoyo: () => apoyo.destello(),
      dispose: () => {
        patrulla.dispose();
        apoyo.dispose();
      },
    },
  };
}
