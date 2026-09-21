import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, TransformNode, Vector3 } from "@babylonjs/core";
import { loft, capsula, cabezaEsculpida, peloEsculpido, texturaTela, type Anillo } from "./ModeladoFigura";
import type { PaletaFigura, Prenda } from "./Figura";

// ===========================================================================
// El cuerpo y la ropa de cada figura
// ===========================================================================
//
// Cada pieza cuelga del hueso que la mueve, igual que antes, pero ya no son
// cajas: el tronco tiene cintura, pecho y hombros que caen; las mangas y las
// perneras se afinan hacia la muñeca y el tobillo; los zapatos tienen talón,
// empeine y puntera; y la cara tiene nariz, cuencas, orejas, cejas y ojos.
//
// La ropa dice quién es cada uno antes que la cara. El supervisor lleva
// chaqueta de uniforme con cinturón, placa, charreteras, radio al pecho, gorra
// de plato y la tablilla de la fiscalización en la mano. Los vecinos van de
// calle y cada uno con su silueta: parka con capucha y mochila, abrigo largo
// con bolso, chaqueta con gorro de lana, gabardina con paraguas cerrado — es
// Puerto Montt y llueve.
//
// En el supermercado es una tarde de compras: polerón con la capucha caída y
// bolsillo canguro, camisa metida en el pantalón con cinturón, y el canasto
// del local colgando de la mano.

/** Medidas de una figura de 1,75 m. La altura se ajusta escalando la raíz. */
export const MEDIDAS = {
  cadera: 0.9275,
  // La articulación va bajo la línea del hombro y algo hacia dentro: más
  // arriba, el remate redondo de la manga asomaba como una hombrera.
  hombroX: 0.178,
  hombroY: 0.445,
  cuello: 0.595,
  brazo: 0.28,
  antebrazo: 0.25,
  caderaX: 0.095,
  muslo: 0.44,
  canilla: 0.405,
  tobillo: 0.075,
  punta: 0.185,
  talon: -0.075,
};

/** Centro del cráneo respecto al nodo de la cabeza. */
const CENTRO_CRANEO = 0.112;

export interface Esqueleto {
  cuerpo: TransformNode;
  cabeza: TransformNode;
  hombros: TransformNode[];
  codos: TransformNode[];
  caderas: TransformNode[];
  rodillas: TransformNode[];
  tobillos: TransformNode[];
  /**
   * Lo que cuelga de una mano —el canasto— y de cuál. Lo pone vestir; Figura
   * lo mantiene a plomo y deja ese brazo casi quieto.
   */
  carga?: { nodo: TransformNode; brazo: number };
}

/** El tronco de cada prenda, de la cadera al cuello. */
function tronco(prenda: Prenda): Anillo[] {
  const base: Anillo[] = [
    { y: -0.075, x: 0.163, delante: 0.106, atras: 0.112 },
    { y: 0.04, x: 0.157, delante: 0.1, atras: 0.104 },
    { y: 0.15, x: 0.148, delante: 0.098, atras: 0.094 },
    { y: 0.28, x: 0.168, delante: 0.122, atras: 0.098, cz: 0.004 },
    { y: 0.39, x: 0.186, delante: 0.118, atras: 0.1, forma: 2.4 },
    { y: 0.458, x: 0.198, delante: 0.1, atras: 0.094, forma: 2.9 },
    { y: 0.505, x: 0.15, delante: 0.084, atras: 0.08, forma: 2.3 },
    { y: 0.55, x: 0.078, delante: 0.068, atras: 0.064 },
    { y: 0.585, x: 0.064, delante: 0.06, atras: 0.058 },
  ];
  const holgura = { uniforme: 0, camisa: 0, parka: 0.02, abrigo: 0.012, chaqueta: 0.008, poleron: 0.016 }[prenda];
  const anillos = base.map((a, i) => {
    const h = i >= base.length - 2 ? holgura * 0.4 : holgura;
    return { ...a, x: a.x + h, delante: a.delante + h, atras: (a.atras ?? a.delante) + h };
  });
  // Faldones: la parka baja a la mitad del muslo y el abrigo casi a la rodilla,
  // con vuelo para que las piernas quepan al caminar.
  //
  // Y casi rectos por los costados, que es como cae un abrigo. Con sección de
  // óvalo la tela se estrechaba justo detrás y delante de cada pierna, y al
  // dar el paso el muslo la atravesaba: de perfil se veía un parche del color
  // del pantalón en mitad del faldón.
  if (prenda === "parka" || prenda === "abrigo") anillos.slice(0, 2).forEach((a) => (a.forma = 2.6));
  if (prenda === "parka") anillos.unshift({ y: -0.17, x: 0.186, delante: 0.128, atras: 0.134, forma: 3.2 });
  if (prenda === "abrigo") {
    anillos.unshift({ y: -0.2, x: 0.184, delante: 0.13, atras: 0.136, forma: 3.2 });
    anillos.unshift({ y: -0.34, x: 0.2, delante: 0.152, atras: 0.156, forma: 3.2 });
  }
  // El polerón acaba en un elástico bajo la cintura, que recoge la tela. Por lo
  // mismo que los faldones, recogido pero no ovalado.
  if (prenda === "poleron") anillos.unshift({ y: -0.13, x: 0.176, delante: 0.117, atras: 0.123, forma: 3 });
  return anillos;
}

export function vestir(scene: Scene, nombre: string, esq: Esqueleto, paleta: PaletaFigura): Mesh[] {
  const prenda: Prenda = paleta.prenda ?? (paleta.gorra ? "uniforme" : "chaqueta");
  const piezas: Mesh[] = [];
  const tela = texturaTela(scene);

  const creados: PBRMaterial[] = [];
  const mat = (sufijo: string, color: Color3, rugosidad: number, o: { tela?: boolean; brillo?: number; metal?: number } = {}): PBRMaterial => {
    const m = new PBRMaterial(`mat${nombre}_${sufijo}`, scene);
    creados.push(m);
    m.albedoColor = color;
    m.roughness = rugosidad;
    m.metallic = o.metal ?? 0;
    if (o.tela) {
      m.bumpTexture = tela;
      m.bumpTexture.level = 0.32;
    }
    if (o.brillo) {
      // El brillo de canto de la tela: la silueta se aclara donde la luz roza,
      // que es lo que separa un paño de un plástico mate.
      m.sheen.isEnabled = true;
      m.sheen.intensity = o.brillo;
      m.sheen.color = Color3.Lerp(color, Color3.White(), 0.3);
      m.sheen.roughness = 0.55;
    }
    return m;
  };

  const matRopa = mat("ropa", paleta.uniforme, 0.84, { tela: true, brillo: 0.18 });
  const matPantalon = mat("pantalon", paleta.pantalon, 0.88, { tela: true, brillo: 0.15 });
  const matDetalle = mat("detalle", paleta.detalle, 0.7, { tela: true });
  // Sin brillo de canto: sobre la piel se leía como una capa blanca de yeso.
  const matPiel = mat("piel", paleta.piel, 0.52);
  const matPelo = mat("pelo", paleta.pelo ?? new Color3(0.05, 0.04, 0.035), 0.5, { brillo: 0.25 });
  const matZapato = mat("zapato", paleta.zapato ?? new Color3(0.025, 0.025, 0.03), paleta.gorra ? 0.3 : 0.6);
  const matSuela = mat("suela", paleta.suela ?? new Color3(0.02, 0.02, 0.02), 0.8);
  const matOscuro = mat("oscuro", new Color3(0.02, 0.02, 0.025), 0.45);
  const matOjo = mat("ojo", new Color3(0.035, 0.025, 0.02), 0.18);
  const matDorado = mat("dorado", new Color3(0.42, 0.31, 0.13), 0.55, { metal: 0.35 });
  // Latón gastado, no un espejo: con el reflejo entero de la sala la placa
  // salía como un punto de luz blanca en el pecho.
  matDorado.environmentIntensity = 0.15;

  const poner = (m: Mesh, padre: TransformNode, material: PBRMaterial, x = 0, y = 0, z = 0): Mesh => {
    m.parent = padre;
    m.position.set(x, y, z);
    m.material = material;
    m.isPickable = false;
    piezas.push(m);
    return m;
  };
  const caja = (sufijo: string, w: number, h: number, d: number, padre: TransformNode, material: PBRMaterial, x: number, y: number, z: number): Mesh =>
    poner(MeshBuilder.CreateBox(`${nombre}_${sufijo}`, { width: w, height: h, depth: d }, scene), padre, material, x, y, z);
  const bola = (sufijo: string, padre: TransformNode, material: PBRMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number): Mesh => {
    const m = poner(MeshBuilder.CreateSphere(`${nombre}_${sufijo}`, { diameter: 1, segments: 12 }, scene), padre, material, x, y, z);
    m.scaling.set(sx, sy, sz);
    return m;
  };

  // --- Tronco y cadera ------------------------------------------------------
  const anillosTronco = tronco(prenda);
  poner(loft(scene, `${nombre}_tronco`, anillosTronco, { lados: 28, tapaAbajo: true, tapaArriba: true, uVueltas: 3, vPorMetro: 5 }), esq.cuerpo, matRopa);
  poner(
    loft(scene, `${nombre}_cadera`, [
      { y: -0.2, x: 0.11, delante: 0.08 },
      { y: -0.12, x: 0.156, delante: 0.1, atras: 0.108 },
      { y: 0.02, x: 0.152, delante: 0.098, atras: 0.1 },
    ], { lados: 24, tapaAbajo: true, tapaArriba: true, uVueltas: 3, vPorMetro: 5 }),
    esq.cuerpo,
    matPantalon
  );

  const frente = (y: number): number => {
    // Dónde queda la cara delantera del tronco a esa altura, para apoyar ahí
    // la placa, la cremallera o las correas sin que floten ni se hundan.
    for (let i = 1; i < anillosTronco.length; i++) {
      const a = anillosTronco[i - 1];
      const b = anillosTronco[i];
      if (y <= b.y) {
        const t = (y - a.y) / (b.y - a.y);
        return (a.cz ?? 0) + a.delante + (b.delante - a.delante) * t;
      }
    }
    return 0.06;
  };

  if (prenda === "uniforme") {
    // Camisa y corbata en la abertura del cuello, cinturón, placa, charreteras
    // y la radio: lo que convierte una chaqueta oscura en un uniforme.
    poner(loft(scene, `${nombre}_cuelloCamisa`, [
      // Por fuera del tronco en todo su alto: donde coincidían las dos
      // superficies el borde salía dentado.
      { y: 0.555, x: 0.082, delante: 0.074, atras: 0.07 },
      { y: 0.572, x: 0.078, delante: 0.072, atras: 0.068 },
      { y: 0.588, x: 0.071, delante: 0.067, atras: 0.064 },
      { y: 0.592, x: 0.067, delante: 0.063, atras: 0.061 },
    ], { lados: 24 }), esq.cuerpo, matDetalle);
    // Inclinada como el pecho: arriba toca el cuello y abajo el esternón.
    const corbata = caja("corbata", 0.022, 0.15, 0.006, esq.cuerpo, matOscuro, 0, 0.49, frente(0.49) + 0.008);
    corbata.rotation.x = -0.17;
    poner(loft(scene, `${nombre}_cinturon`, [
      { y: 0.07, x: 0.16, delante: 0.104, atras: 0.106 },
      { y: 0.11, x: 0.158, delante: 0.102, atras: 0.104 },
    ], { lados: 28 }), esq.cuerpo, matOscuro);
    caja("hebilla", 0.045, 0.035, 0.008, esq.cuerpo, matDorado, 0, 0.09, 0.108);
    const placa = poner(MeshBuilder.CreateCylinder(`${nombre}_placa`, { diameter: 0.032, height: 0.005, tessellation: 20 }, scene), esq.cuerpo, matDorado, 0.085, 0.37, frente(0.37) + 0.002);
    placa.rotation.x = Math.PI / 2;
    [-1, 1].forEach((lado) => {
      const charretera = caja(`charretera_${lado}`, 0.11, 0.012, 0.055, esq.cuerpo, matRopa, lado * 0.14, 0.49, 0);
      charretera.rotation.z = -lado * 0.42;
    });
    caja("radio", 0.05, 0.09, 0.03, esq.cuerpo, matOscuro, -0.1, 0.36, frente(0.36) + 0.012);
    const antena = poner(MeshBuilder.CreateCylinder(`${nombre}_antena`, { diameter: 0.008, height: 0.07, tessellation: 8 }, scene), esq.cuerpo, matOscuro, -0.115, 0.44, frente(0.36) + 0.012);
    antena.rotation.z = 0.1;
  } else if (prenda === "camisa") {
    // Cuello con sus dos puntas, botonadura y la camisa metida en el pantalón:
    // la pretina sube hasta el cinturón y tapa el faldón.
    poner(loft(scene, `${nombre}_cuelloCamisa`, [
      { y: 0.552, x: 0.086, delante: 0.078, atras: 0.072 },
      { y: 0.575, x: 0.08, delante: 0.074, atras: 0.07 },
      { y: 0.598, x: 0.074, delante: 0.067, atras: 0.066 },
      { y: 0.604, x: 0.07, delante: 0.063, atras: 0.063 },
    ], { lados: 24 }), esq.cuerpo, matRopa);
    [-1, 1].forEach((lado) => {
      const punta = caja(`puntaCuello_${lado}`, 0.036, 0.034, 0.005, esq.cuerpo, matRopa, lado * 0.024, 0.538, frente(0.538) + 0.004);
      punta.rotation.z = lado * 0.62;
      punta.rotation.x = -0.2;
    });
    [0.14, 0.24, 0.34, 0.44].forEach((y, k) => bola(`botonCamisa_${k}`, esq.cuerpo, matDetalle, 0, y, frente(y) + 0.002, 0.011, 0.011, 0.005));
    poner(loft(scene, `${nombre}_pretina`, [
      { y: -0.08, x: 0.167, delante: 0.11, atras: 0.116 },
      { y: 0.04, x: 0.161, delante: 0.104, atras: 0.108 },
      { y: 0.075, x: 0.16, delante: 0.103, atras: 0.106 },
    ], { lados: 28 }), esq.cuerpo, matPantalon);
    poner(loft(scene, `${nombre}_cinturon`, [
      { y: 0.07, x: 0.163, delante: 0.106, atras: 0.109 },
      { y: 0.105, x: 0.161, delante: 0.105, atras: 0.107 },
    ], { lados: 28 }), esq.cuerpo, matOscuro);
    caja("hebilla", 0.04, 0.03, 0.007, esq.cuerpo, matDorado, 0, 0.0875, 0.109);
  } else if (prenda === "poleron") {
    // Sin cremallera: se pone por la cabeza. De lejos lo delata la capucha
    // caída en la espalda; de cerca, el bolsillo canguro y los cordones.
    poner(loft(scene, `${nombre}_capucha`, [
      { y: 0.43, x: 0.11, delante: 0.045, cz: -0.115 },
      { y: 0.5, x: 0.13, delante: 0.062, cz: -0.125 },
      { y: 0.565, x: 0.115, delante: 0.058, cz: -0.115 },
      { y: 0.59, x: 0.07, delante: 0.035, cz: -0.1 },
    ], { lados: 18, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 5 }), esq.cuerpo, matRopa);
    poner(loft(scene, `${nombre}_bolsillo`, [0, 0.03, 0.14, 0.17].map((y, k) => ({
      y,
      x: k < 2 ? 0.125 : 0.1,
      delante: 0.009,
      cz: frente(y) - 0.001,
      forma: 4,
    })), { lados: 16, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 5 }), esq.cuerpo, matRopa);
    [-1, 1].forEach((lado) => {
      const cordon = caja(`cordon_${lado}`, 0.006, 0.13, 0.006, esq.cuerpo, matDetalle, lado * 0.034, 0.47, frente(0.47) + 0.006);
      cordon.rotation.x = -0.12;
    });
  } else {
    // Cremallera de arriba abajo: la línea que parte en dos la ropa de calle.
    const alto = anillosTronco[anillosTronco.length - 2].y - anillosTronco[0].y;
    const medio = anillosTronco[0].y + alto / 2;
    const cremallera = caja("cremallera", 0.012, alto, 0.006, esq.cuerpo, matDetalle, 0, medio, 0);
    cremallera.position.z = frente(medio) + 0.001;
    cremallera.scaling.y = 0.97;
  }

  if (prenda === "parka") {
    poner(loft(scene, `${nombre}_capucha`, [
      { y: 0.44, x: 0.1, delante: 0.05, cz: -0.1 },
      { y: 0.53, x: 0.13, delante: 0.07, cz: -0.11 },
      { y: 0.6, x: 0.1, delante: 0.06, cz: -0.1 },
      { y: 0.63, x: 0.05, delante: 0.03, cz: -0.09 },
    ], { lados: 18, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 5 }), esq.cuerpo, matRopa);
  }
  if (prenda === "abrigo") {
    poner(loft(scene, `${nombre}_cinta`, [
      { y: 0.13, x: 0.162, delante: 0.112, atras: 0.108 },
      { y: 0.165, x: 0.16, delante: 0.11, atras: 0.106 },
    ], { lados: 28 }), esq.cuerpo, matRopa);
    [0.26, 0.05, -0.12].forEach((y, k) => bola(`boton_${k}`, esq.cuerpo, matOscuro, 0.035, y, frente(y) + 0.003, 0.018, 0.018, 0.008));
  }

  // --- Accesorios del tronco ---------------------------------------------
  if (paleta.accesorio === "mochila") {
    poner(loft(scene, `${nombre}_mochila`, [
      { y: 0.1, x: 0.12, delante: 0.05, cz: -0.17, forma: 3.2 },
      { y: 0.14, x: 0.135, delante: 0.065, cz: -0.175, forma: 3.2 },
      { y: 0.42, x: 0.13, delante: 0.06, cz: -0.17, forma: 3.2 },
      { y: 0.46, x: 0.11, delante: 0.045, cz: -0.16, forma: 3 },
    ], { lados: 20, tapaAbajo: true, tapaArriba: true, uVueltas: 2, vPorMetro: 5 }), esq.cuerpo, matOscuro);
    [-1, 1].forEach((lado) => {
      const correa = caja(`correa_${lado}`, 0.032, 0.34, 0.012, esq.cuerpo, matOscuro, lado * 0.095, 0.33, frente(0.33) + 0.004);
      correa.rotation.x = -0.18;
    });
  }
  if (paleta.accesorio === "bolso") {
    caja("bolso", 0.07, 0.19, 0.25, esq.cuerpo, matOscuro, 0.215, -0.08, 0.01);
    // La tira sube por el pecho desde el bolso, pasa por encima del hombro
    // contrario y baja por la espalda. Antes solo iba por delante y terminaba
    // en el aire: de espaldas, su punta asomaba sobre el hombro como una antena.
    const zDelante = frente(0.28) + 0.006;
    const zDetras =
      Math.min(...anillosTronco.filter((a) => a.y > -0.05 && a.y < 0.52).map((a) => (a.cz ?? 0) - (a.atras ?? a.delante))) - 0.006;
    [zDelante, zDetras].forEach((z, k) => {
      const tira = caja(`tiraBolso_${k}`, 0.024, 0.635, 0.01, esq.cuerpo, matOscuro, 0.0325, 0.25, z);
      tira.rotation.z = 0.556;
    });
    const sobreHombro = caja("tiraBolsoHombro", 0.024, 0.01, zDelante - zDetras + 0.01, esq.cuerpo, matOscuro, -0.135, 0.517, (zDelante + zDetras) / 2);
    sobreHombro.rotation.z = 0.61;
  }

  // --- Cabeza ---------------------------------------------------------------
  poner(capsula(scene, `${nombre}_cuello`, 0.09, 0.05, 0.054, { lados: 14 }), esq.cabeza, matPiel, 0, 0.07, -0.006);
  const { malla: craneo, ojos } = cabezaEsculpida(scene, `${nombre}_craneo`, paleta.rasgos);
  poner(craneo, esq.cabeza, matPiel, 0, CENTRO_CRANEO, 0);
  poner(peloEsculpido(scene, `${nombre}_pelo`, paleta.peinado ?? "corto", paleta.rasgos), esq.cabeza, matPelo, 0, CENTRO_CRANEO, 0);
  if (paleta.peinado === "largo") bola("mono", esq.cabeza, matPelo, 0, CENTRO_CRANEO + 0.03, -0.108, 0.075, 0.07, 0.065);

  const ancho = paleta.rasgos?.ancho ?? 1;
  ojos.forEach((o, k) => {
    const lado = k === 0 ? -1 : 1;
    bola(`ojo_${lado}`, esq.cabeza, matOjo, o.x, CENTRO_CRANEO + o.y, o.z - 0.005, 0.02, 0.015, 0.013);
    const ceja = caja(`ceja_${lado}`, 0.03, 0.0055, 0.007, esq.cabeza, matPelo, o.x + lado * 0.002, CENTRO_CRANEO + o.y + 0.021, o.z + 0.006);
    ceja.rotation.z = -lado * 0.12;
    const oreja = bola(`oreja_${lado}`, esq.cabeza, matPiel, lado * 0.072 * ancho, CENTRO_CRANEO - 0.004, -0.004, 0.02, 0.058, 0.036);
    oreja.rotation.y = lado * 0.3;
  });

  if (paleta.gorra) {
    const c = CENTRO_CRANEO;
    const matGorra = mat("gorra", paleta.uniforme, 0.6, { tela: true, brillo: 0.3 });
    poner(loft(scene, `${nombre}_gorraCinta`, [
      { y: c + 0.035, x: 0.081, delante: 0.104, atras: 0.1, cz: 0.003 },
      { y: c + 0.072, x: 0.083, delante: 0.106, atras: 0.102, cz: 0.003 },
    ], { lados: 32 }), esq.cabeza, matOscuro);
    poner(loft(scene, `${nombre}_gorraCopa`, [
      { y: c + 0.07, x: 0.084, delante: 0.107, atras: 0.103, cz: 0.003 },
      { y: c + 0.092, x: 0.094, delante: 0.12, atras: 0.112, cz: 0.008 },
      { y: c + 0.112, x: 0.101, delante: 0.128, atras: 0.118, cz: 0.012, forma: 2.3 },
      { y: c + 0.119, x: 0.094, delante: 0.12, atras: 0.11, cz: 0.012 },
      { y: c + 0.123, x: 0.05, delante: 0.06, atras: 0.055, cz: 0.012 },
    ], { lados: 32, tapaArriba: true, uVueltas: 2, vPorMetro: 6 }), esq.cabeza, matGorra);
    const visera = poner(MeshBuilder.CreateCylinder(`${nombre}_visera`, { diameter: 1, height: 0.006, tessellation: 32 }, scene), esq.cabeza, matOscuro, 0, c + 0.037, 0.078);
    visera.scaling.set(0.17, 1, 0.12);
    visera.rotation.x = 0.24;
    caja("escudo", 0.03, 0.026, 0.005, esq.cabeza, matDorado, 0, c + 0.088, 0.121);
  }
  if (paleta.gorroLana) {
    const c = CENTRO_CRANEO;
    poner(loft(scene, `${nombre}_gorroLana`, [
      // El borde sobre la frente, no sobre las cejas.
      { y: c + 0.034, x: 0.084, delante: 0.104, atras: 0.108 },
      { y: c + 0.064, x: 0.086, delante: 0.106, atras: 0.11 },
      { y: c + 0.07, x: 0.082, delante: 0.1, atras: 0.105 },
      { y: c + 0.1, x: 0.077, delante: 0.095, atras: 0.1 },
      { y: c + 0.132, x: 0.058, delante: 0.07, atras: 0.075 },
      { y: c + 0.147, x: 0.03, delante: 0.036, atras: 0.04 },
      { y: c + 0.151, x: 0.01, delante: 0.012 },
    ], { lados: 30, tapaAbajo: true, tapaArriba: true, uVueltas: 4, vPorMetro: 12 }), esq.cabeza, matDetalle);
  }

  // --- Brazos y manos -----------------------------------------------------
  const grueso = { uniforme: 0, camisa: 0, parka: 0.012, abrigo: 0.006, chaqueta: 0.006, poleron: 0.01 }[prenda];
  [0, 1].forEach((i) => {
    const lado = i === 0 ? -1 : 1;
    poner(capsula(scene, `${nombre}_brazo_${lado}`, MEDIDAS.brazo, 0.05 + grueso, 0.043 + grueso, { bulto: 0.004, fondo: 0.95 }), esq.hombros[i], matRopa);
    poner(capsula(scene, `${nombre}_antebrazo_${lado}`, MEDIDAS.antebrazo - 0.02, 0.045 + grueso, 0.037 + grueso, { fondo: 0.92 }), esq.codos[i], matRopa);
    // La mano, con la palma hacia el muslo: fina en X, ancha en Z.
    const mano = poner(loft(scene, `${nombre}_mano_${lado}`, [
      { y: -0.18, x: 0.005, delante: 0.01 },
      { y: -0.17, x: 0.01, delante: 0.022, cz: 0.004 },
      { y: -0.14, x: 0.013, delante: 0.033, cz: 0.004 },
      { y: -0.1, x: 0.016, delante: 0.04, cz: 0.002 },
      { y: -0.065, x: 0.018, delante: 0.042 },
      { y: -0.03, x: 0.02, delante: 0.03 },
      { y: 0.015, x: 0.018, delante: 0.023 },
    ], { lados: 16, tapaAbajo: true, tapaArriba: true }), esq.codos[i], matPiel, 0, -MEDIDAS.antebrazo, 0);
    mano.rotation.z = lado * 0.08;
    mano.scaling.setAll(0.9);
    const pulgar = poner(capsula(scene, `${nombre}_pulgar_${lado}`, 0.045, 0.011, 0.009, { lados: 10 }), esq.codos[i], matPiel, -lado * 0.004, -MEDIDAS.antebrazo - 0.04, 0.03);
    pulgar.rotation.x = -0.45;
  });

  if (paleta.accesorio === "tablilla") {
    // La tablilla de la fiscalización, en la mano izquierda: a lo que viene.
    const i = 0;
    const tabla = caja("tablilla", 0.012, 0.31, 0.23, esq.codos[i], mat("tablilla", new Color3(0.035, 0.035, 0.04), 0.45), -0.018, -MEDIDAS.antebrazo - 0.13, 0.05);
    tabla.rotation.x = -0.08;
    const hoja = caja("hojaTablilla", 0.003, 0.26, 0.2, esq.codos[i], mat("papel", new Color3(0.85, 0.84, 0.8), 0.9), -0.026, -MEDIDAS.antebrazo - 0.14, 0.05);
    hoja.rotation.x = -0.08;
  }
  if (paleta.accesorio === "paraguas") {
    // Paraguas cerrado en la derecha, con la punta hacia delante: está lloviendo.
    const i = 1;
    const nodo = new TransformNode(`${nombre}_paraguas`, scene);
    nodo.parent = esq.codos[i];
    nodo.position.set(0.012, -MEDIDAS.antebrazo - 0.06, 0.02);
    nodo.rotation.x = -0.32;
    poner(capsula(scene, `${nombre}_mango`, 0.08, 0.013, 0.013, { lados: 10 }), nodo, mat("mango", new Color3(0.2, 0.1, 0.05), 0.4), 0, 0.05, 0);
    poner(loft(scene, `${nombre}_tela`, [
      { y: -0.58, x: 0.003, delante: 0.003 },
      { y: -0.5, x: 0.012, delante: 0.012 },
      { y: -0.2, x: 0.034, delante: 0.03 },
      { y: -0.06, x: 0.022, delante: 0.02 },
      { y: -0.02, x: 0.008, delante: 0.008 },
    ], { lados: 8, tapaArriba: true, vPorMetro: 6 }), nodo, mat("telaParaguas", new Color3(0.03, 0.04, 0.08), 0.5, { tela: true }));
  }
  if (paleta.accesorio === "canasto") {
    // El canasto del local, en la mano derecha. Cuelga de su propio nodo en el
    // puño, y es Figura quien lo mantiene a plomo mientras el brazo se mueve.
    const i = 1;
    const asa = new TransformNode(`${nombre}_asaCanasto`, scene);
    asa.parent = esq.codos[i];
    asa.position.set(0.004, -MEDIDAS.antebrazo - 0.085, 0.01);
    esq.carga = { nodo: asa, brazo: i };

    // Abierto por arriba y se ve el interior: sin descartar caras traseras y
    // con la luz por los dos lados.
    const plastico = mat("canasto", new Color3(0.5, 0.045, 0.04), 0.42);
    plastico.backFaceCulling = false;
    plastico.twoSidedLighting = true;
    // A lo largo de la marcha, más ancho de boca que de fondo.
    poner(loft(scene, `${nombre}_canasto`, [
      { y: -0.43, x: 0.082, delante: 0.15, forma: 5 },
      { y: -0.41, x: 0.088, delante: 0.162, forma: 5 },
      { y: -0.22, x: 0.1, delante: 0.184, forma: 5 },
      { y: -0.2, x: 0.106, delante: 0.192, forma: 5 },
    ], { lados: 32, tapaAbajo: true }), asa, plastico);
    // Las dos asas, levantadas y juntas en la mano.
    [-1, 1].forEach((s) => {
      const camino = [
        new Vector3(s * 0.1, -0.2, -0.11),
        new Vector3(s * 0.06, -0.07, -0.08),
        new Vector3(s * 0.012, -0.008, -0.04),
        new Vector3(s * 0.012, -0.008, 0.04),
        new Vector3(s * 0.06, -0.07, 0.08),
        new Vector3(s * 0.1, -0.2, 0.11),
      ];
      poner(MeshBuilder.CreateTube(`${nombre}_asaCanasto_${s}`, { path: camino, radius: 0.0065, tessellation: 8, cap: Mesh.CAP_ALL }, scene), asa, plastico);
    });
    // Vacío de fábrica. Lo que lleva dentro lo pone Figura, compra a compra
    // (ver la opción compras): el canasto que se llena es el de quien paga, y
    // el del cliente de la parka verde tiene que seguir vacío toda la tarde.
    // Con una leche y un cereal de serie, su canasto nunca lo estuvo.
  }

  // --- Piernas y zapatos --------------------------------------------------
  [0, 1].forEach((i) => {
    const lado = i === 0 ? -1 : 1;
    // El muslo nace más fino y engorda por debajo de la cadera. Con todo el
    // grueso arriba, su remate asomaba por los costados de la chaqueta a la
    // altura de la cadera, como un parche del color del pantalón.
    poner(capsula(scene, `${nombre}_muslo_${lado}`, MEDIDAS.muslo, 0.07, 0.057, { bulto: 0.012, dondeBulto: 0.62, fondo: 0.96 }), esq.caderas[i], matPantalon);
    poner(capsula(scene, `${nombre}_canilla_${lado}`, MEDIDAS.canilla - 0.01, 0.058, 0.046, { bulto: 0.006, dondeBulto: 0.72, fondo: 0.97 }), esq.rodillas[i], matPantalon);

    // El zapato se modela a lo largo de Y y se tumba: Y pasa a ser el largo
    // (hacia +Z) y el fondo del anillo pasa a ser el alto.
    const zapato = (sufijo: string, material: PBRMaterial, aro: [number, number, number, number, number][]): void => {
      const m = loft(scene, `${nombre}_${sufijo}_${lado}`, aro.map(([largo, x, abajo, arriba, centro]) => ({ y: largo, x, delante: abajo, atras: arriba, cz: -centro, forma: 3 })), { lados: 18, tapaAbajo: true, tapaArriba: true });
      m.rotation.x = Math.PI / 2;
      m.bakeCurrentTransformIntoVertices();
      poner(m, esq.tobillos[i], material);
    };
    // [largo, semiancho, semialto abajo, semialto arriba, centro vertical]
    zapato("zapato", matZapato, [
      [MEDIDAS.talon, 0.026, 0.02, 0.02, -0.046],
      [MEDIDAS.talon + 0.015, 0.04, 0.026, 0.045, -0.047],
      [-0.02, 0.045, 0.026, 0.06, -0.047],
      [0.045, 0.048, 0.026, 0.048, -0.047],
      [0.11, 0.05, 0.026, 0.028, -0.048],
      [0.16, 0.043, 0.022, 0.018, -0.052],
      [MEDIDAS.punta - 0.008, 0.022, 0.012, 0.01, -0.062],
      [MEDIDAS.punta, 0.008, 0.005, 0.005, -0.067],
    ]);
    zapato("suela", matSuela, [
      [MEDIDAS.talon + 0.004, 0.024, 0.005, 0.005, -0.069],
      [MEDIDAS.talon + 0.02, 0.043, 0.006, 0.006, -0.069],
      [0.12, 0.053, 0.006, 0.006, -0.069],
      [MEDIDAS.punta - 0.012, 0.03, 0.005, 0.005, -0.069],
      [MEDIDAS.punta - 0.002, 0.01, 0.004, 0.004, -0.069],
    ]);
  });

  // Los materiales de base se crean todos de entrada, pero no todas las
  // figuras los usan: el dorado es del uniforme y de la camisa, y el negro, de
  // quien lleva correas, botones o cinturón. Los que no quedaron en ninguna
  // pieza se van ya: sin malla que se los lleve, ni Figura ni limpiarEscena
  // los encontrarían después.
  creados.filter((m) => !piezas.some((p) => p.material === m)).forEach((m) => m.dispose());

  return piezas;
}
