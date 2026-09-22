import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  Texture,
} from "@babylonjs/core";
import { crearAzar } from "./TexturasPBR";

// ===========================================================================
// Autos y árboles para el exterior de día
// ===========================================================================
//
// Los de ModelosCalle están hechos para la noche del condominio: de noche un
// auto es una silueta con dos faros y el barniz corriendo por la chapa, y con
// eso basta. De día, a cinco metros de la puerta del supermercado, las cajas
// facetadas se leían como juguetes.
//
// ─── EL AUTO ─────────────────────────────────────────────────────────────
//
// La carrocería se modela por secciones: una sucesión de rectángulos de
// esquinas redondeadas a lo largo del auto, unidas en una sola superficie
// suave. El borde de abajo sube sobre cada rueda en medio círculo, y así salen
// los pasos de rueda sin cortar nada. Encima, la cabina con sus vidrios
// inclinados, el techo pintado y los pilares; y los parachoques, los focos,
// la parrilla, los espejos y las ruedas con su llanta.
//
// El largo va en +X (el frente mira a +X), como los de ModelosCalle, para que
// se coloquen igual.

/** Un rectángulo de esquinas redondeadas en el plano ZY, a una X dada. */
function seccion(x: number, ancho: number, y0: number, y1: number, radio: number, puntos = 7): Vector3[] {
  const r = Math.max(0.001, Math.min(radio, ancho / 2 - 0.001, (y1 - y0) / 2 - 0.001));
  const z0 = -ancho / 2;
  const z1 = ancho / 2;
  const esquinas: [number, number, number][] = [
    [z1 - r, y1 - r, 0],
    [z0 + r, y1 - r, Math.PI / 2],
    [z0 + r, y0 + r, Math.PI],
    [z1 - r, y0 + r, (3 * Math.PI) / 2],
  ];
  const salida: Vector3[] = [];
  for (const [cz, cy, a0] of esquinas) {
    for (let i = 0; i <= puntos; i++) {
      const a = a0 + (i / puntos) * (Math.PI / 2);
      salida.push(new Vector3(x, cy + Math.sin(a) * r, cz + Math.cos(a) * r));
    }
  }
  return salida;
}

/** Una superficie cerrada por secciones, con las dos puntas tapadas. */
function lofting(scene: Scene, nombre: string, secciones: Vector3[][]): Mesh {
  const centro = (s: Vector3[]): Vector3[] => {
    const c = s.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / s.length);
    return s.map(() => c.clone());
  };
  const caminos = [centro(secciones[0]), ...secciones, centro(secciones[secciones.length - 1])];
  return MeshBuilder.CreateRibbon(nombre, { pathArray: caminos, closePath: true, sideOrientation: Mesh.DOUBLESIDE }, scene);
}

export interface OpcionesAuto {
  color: Color3;
  patente: string;
  /** Hatchback: la luneta cae hasta la cola. Si no, sedán con maleta. */
  hatch?: boolean;
}

/**
 * Un auto compacto de 4,3 m. Devuelve sus piezas en su propio espacio (frente
 * a +X, suelo en Y 0), listas para colgar de un nodo o fundir por material.
 */
export function crearAuto(scene: Scene, nombre: string, o: OpcionesAuto): Mesh[] {
  const piezas: Mesh[] = [];
  const L = 4.3;
  const EJE_DEL = 1.32;
  const EJE_TRAS = -1.28;
  const RADIO_RUEDA = 0.31;
  const ANCHO = 1.76;

  // --- Materiales ---------------------------------------------------------------
  const pintura = new PBRMaterial(`${nombre}_pintura`, scene);
  pintura.albedoColor = o.color;
  pintura.metallic = 0.35;
  pintura.roughness = 0.34;
  pintura.clearCoat.isEnabled = true;
  pintura.clearCoat.intensity = 1;
  pintura.clearCoat.roughness = 0.05;
  pintura.environmentIntensity = 0.9;

  const vidrio = new PBRMaterial(`${nombre}_vidrio`, scene);
  vidrio.albedoColor = new Color3(0.035, 0.045, 0.055);
  vidrio.metallic = 0.1;
  vidrio.roughness = 0.03;
  vidrio.environmentIntensity = 1.2;

  const plastico = new PBRMaterial(`${nombre}_plastico`, scene);
  plastico.albedoColor = new Color3(0.045, 0.047, 0.05);
  plastico.metallic = 0;
  plastico.roughness = 0.62;

  const goma = new PBRMaterial(`${nombre}_goma`, scene);
  goma.albedoColor = new Color3(0.03, 0.03, 0.032);
  goma.metallic = 0;
  goma.roughness = 0.9;

  const llanta = new PBRMaterial(`${nombre}_llanta`, scene);
  llanta.albedoColor = new Color3(0.72, 0.73, 0.75);
  llanta.metallic = 0.9;
  llanta.roughness = 0.28;
  llanta.environmentIntensity = 0.9;

  const faro = new PBRMaterial(`${nombre}_faro`, scene);
  faro.albedoColor = new Color3(0.82, 0.84, 0.86);
  faro.metallic = 0.6;
  faro.roughness = 0.12;
  faro.environmentIntensity = 1.1;

  const piloto = new PBRMaterial(`${nombre}_piloto`, scene);
  piloto.albedoColor = new Color3(0.55, 0.05, 0.04);
  piloto.metallic = 0.1;
  piloto.roughness = 0.2;
  piloto.emissiveColor = new Color3(0.12, 0.01, 0.01);

  // --- Carrocería baja -------------------------------------------------------------
  //
  // De la cola al frente. El borde de abajo sube en medio círculo sobre cada
  // eje: esos son los pasos de rueda.
  const arco = (x: number): number => {
    let sube = 0;
    for (const eje of [EJE_DEL, EJE_TRAS]) {
      const d = (x - eje) / (RADIO_RUEDA + 0.1);
      if (Math.abs(d) < 1) sube = Math.max(sube, Math.sqrt(1 - d * d) * (RADIO_RUEDA + 0.08));
    }
    return sube;
  };
  const perfilBajo: [number, number, number, number][] = [
    // [x, ancho, y0 (sin arco), y1]
    [-L / 2, 1.5, 0.42, 0.84],
    [-L / 2 + 0.06, 1.66, 0.34, 0.93],
    [-L / 2 + 0.2, 1.74, 0.3, 0.97],
    [-1.6, ANCHO, 0.28, 0.98],
    [-1.0, ANCHO, 0.28, 0.98],
    [-0.4, ANCHO, 0.27, 0.97],
    [0.3, ANCHO, 0.27, 0.95],
    [0.9, ANCHO, 0.28, 0.9],
    [1.6, 1.74, 0.29, 0.84],
    [1.95, 1.7, 0.3, 0.78],
    [L / 2 - 0.08, 1.62, 0.33, 0.7],
    [L / 2, 1.46, 0.4, 0.62],
  ];
  const secciones: Vector3[][] = [];
  // Interpolación fina para que los arcos salgan redondos.
  for (let k = 0; k < perfilBajo.length - 1; k++) {
    const [xa, wa, ya, ta] = perfilBajo[k];
    const [xb, wb, yb, tb] = perfilBajo[k + 1];
    const pasos = Math.max(1, Math.ceil((xb - xa) / 0.07));
    for (let s = 0; s < pasos; s++) {
      const t = s / pasos;
      const x = xa + (xb - xa) * t;
      const y0 = ya + (yb - ya) * t + arco(x);
      secciones.push(seccion(x, wa + (wb - wa) * t, y0, ta + (tb - ta) * t, 0.16));
    }
  }
  const [xu, wu, yu, tu] = perfilBajo[perfilBajo.length - 1];
  secciones.push(seccion(xu, wu, yu, tu, 0.16));
  const carroceria = lofting(scene, `${nombre}_carroceria`, secciones);
  carroceria.material = pintura;
  piezas.push(carroceria);

  // --- Cabina ------------------------------------------------------------------------
  //
  // Vidrio entero —parabrisas, laterales y luneta— con el techo pintado por
  // encima y los pilares. Las secciones se juntan en las puntas: eso es la
  // inclinación del parabrisas y de la luneta.
  const CINTURA = 0.94;
  const TECHO = 1.43;
  const cabina: [number, number, number][] = o.hatch
    ? [
        [-1.95, 1.58, 0.0],
        [-1.75, 1.46, 0.62],
        [-1.2, 1.36, 1.0],
        [0.2, 1.34, 1.0],
        [0.75, 1.46, 0.45],
        [1.12, 1.58, 0.0],
      ]
    : [
        [-1.45, 1.58, 0.0],
        [-1.05, 1.44, 0.8],
        [-0.75, 1.36, 1.0],
        [0.25, 1.34, 1.0],
        [0.78, 1.46, 0.45],
        [1.12, 1.58, 0.0],
      ];
  const seccionesCabina: Vector3[][] = [];
  // Las mismas secciones, pero solo la franja de arriba y un poco más
  // anchas: la piel del techo. Sigue exactamente la forma de la cabina, así
  // que baja con el parabrisas y la luneta en vez de quedar como una tabla
  // puesta encima.
  const seccionesTecho: Vector3[][] = [];
  for (let k = 0; k < cabina.length - 1; k++) {
    const [xa, wa, ha] = cabina[k];
    const [xb, wb, hb] = cabina[k + 1];
    const pasos = Math.max(1, Math.ceil((xb - xa) / 0.06));
    for (let s = 0; s < pasos; s++) {
      const t = s / pasos;
      const h = ha + (hb - ha) * t;
      const x = xa + (xb - xa) * t;
      // Sección trapecial: más angosta arriba, como una cabina de verdad.
      const w = wa + (wb - wa) * t - 0.1 * h;
      const y1 = Math.max(CINTURA + 0.01, CINTURA - 0.02 + (TECHO - CINTURA) * h);
      const radio = 0.14 * Math.max(0.2, h);
      seccionesCabina.push(seccion(x, w, CINTURA - 0.04, y1, radio));
      if (h > 0.93) seccionesTecho.push(seccion(x, w + 0.012, y1 - 0.045, y1 + 0.008, radio + 0.006));
    }
  }
  const [xc, wc, hc] = cabina[cabina.length - 1];
  seccionesCabina.push(seccion(xc, wc, CINTURA - 0.04, CINTURA - 0.02 + (TECHO - CINTURA) * hc + 0.01, 0.03));
  const cristales = lofting(scene, `${nombre}_cabina`, seccionesCabina);
  cristales.material = vidrio;
  piezas.push(cristales);

  if (seccionesTecho.length > 1) {
    const techo = lofting(scene, `${nombre}_techo`, seccionesTecho);
    techo.material = pintura;
    piezas.push(techo);
  }

  // Pilares B, entre la puerta de delante y la de atrás: finos y a ras del
  // vidrio lateral, que a esa altura de la cabina es vertical.
  const anchoPilar = (cabina[2][1] + cabina[3][1]) / 2 - 0.1;
  [-1, 1].forEach((lado) => {
    const pilar = MeshBuilder.CreateBox(`${nombre}_pilarB_${lado}`, { width: 0.07, height: TECHO - CINTURA - 0.1, depth: 0.016 }, scene);
    pilar.position.set(-0.28, (CINTURA + TECHO) / 2 - 0.05, lado * (anchoPilar / 2 + 0.004));
    pilar.material = pintura;
    piezas.push(pilar);
  });

  // --- Parachoques, parrilla, focos, espejos ------------------------------------------
  const pieza = (n: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: PBRMaterial, redondo = false): Mesh => {
    const m = redondo
      ? MeshBuilder.CreateCapsule(n, { radius: h / 2, height: d, orientation: new Vector3(0, 0, 1), tessellation: 12, subdivisions: 1 }, scene)
      : MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    if (redondo) m.scaling.x = w / h;
    m.position.set(x, y, z);
    m.material = mat;
    piezas.push(m);
    return m;
  };
  // Metidos en la carrocería: asoman lo justo para marcar la línea de abajo.
  pieza(`${nombre}_parachoquesDel`, 0.16, 0.16, 1.52, L / 2 - 0.07, 0.4, 0, plastico, true);
  pieza(`${nombre}_parachoquesTras`, 0.16, 0.16, 1.52, -L / 2 + 0.07, 0.44, 0, plastico, true);
  pieza(`${nombre}_parrilla`, 0.05, 0.12, 0.72, L / 2 + 0.005, 0.57, 0, plastico);
  [-1, 1].forEach((lado) => {
    const f = pieza(`${nombre}_faro_${lado}`, 0.06, 0.1, 0.34, L / 2 - 0.085, 0.64, lado * 0.56, faro, true);
    f.rotation.y = lado * 0.35;
    const p = pieza(`${nombre}_piloto_${lado}`, 0.06, 0.11, 0.32, -L / 2 + 0.05, 0.78, lado * 0.58, piloto, true);
    p.rotation.y = -lado * 0.3;
    const e = pieza(`${nombre}_espejo_${lado}`, 0.12, 0.09, 0.16, 0.95, 1.0, lado * 0.93, pintura, true);
    e.rotation.y = lado * 0.2;
  });

  // --- Ruedas ----------------------------------------------------------------------------
  for (const x of [EJE_DEL, EJE_TRAS]) {
    for (const lado of [-1, 1]) {
      const rueda = MeshBuilder.CreateCylinder(`${nombre}_neumatico`, { height: 0.2, diameter: RADIO_RUEDA * 2, tessellation: 28 }, scene);
      rueda.rotation.x = Math.PI / 2;
      rueda.position.set(x, RADIO_RUEDA, lado * 0.76);
      rueda.material = goma;
      piezas.push(rueda);
      const aro = MeshBuilder.CreateCylinder(`${nombre}_llanta`, { height: 0.205, diameter: RADIO_RUEDA * 1.25, tessellation: 20 }, scene);
      aro.rotation.x = Math.PI / 2;
      aro.position.set(x, RADIO_RUEDA, lado * 0.765);
      aro.material = llanta;
      piezas.push(aro);
      // El hueco oscuro del paso de rueda, detrás del neumático.
      const hueco = MeshBuilder.CreateCylinder(`${nombre}_pasoRueda`, { height: 0.5, diameter: RADIO_RUEDA * 2 + 0.14, tessellation: 20 }, scene);
      hueco.rotation.x = Math.PI / 2;
      hueco.position.set(x, RADIO_RUEDA + 0.02, lado * 0.45);
      hueco.material = plastico;
      piezas.push(hueco);
    }
  }

  // --- Patentes -----------------------------------------------------------------------------
  const patente = materialPatente(scene, `${nombre}_patente`, o.patente);
  [
    [L / 2 + 0.105, 0.42, Math.PI / 2],
    [-L / 2 - 0.105, 0.47, -Math.PI / 2],
  ].forEach(([x, y, giro], i) => {
    const p = MeshBuilder.CreatePlane(`${nombre}_placa_${i}`, { width: 0.36, height: 0.13 }, scene);
    p.position.set(x, y, 0);
    p.rotation.y = giro;
    p.material = patente;
    piezas.push(p);
  });

  return piezas;
}

function materialPatente(scene: Scene, nombre: string, texto: string): PBRMaterial {
  const tex = new DynamicTexture(`tex_${nombre}`, { width: 256, height: 96 }, scene, true);
  tex.anisotropicFilteringLevel = 8;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#f3f3ee";
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "#1c2026";
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = "#15181c";
  ctx.font = "bold 50px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 128, 52);
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("CHILE", 128, 16);
  tex.update();
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new PBRMaterial(`mat_${nombre}`, scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.5;
  mat.metallic = 0;
  return mat;
}

/**
 * Un árbol de vereda frondoso: tronco con su primera ramificación y una copa
 * de bultos suaves en dos verdes, uno a la luz y otro más hondo.
 *
 * Devuelve las piezas ya fundidas por material, en su propio espacio (pie en
 * Y 0).
 */
export function crearArbolFrondoso(
  scene: Scene,
  nombre: string,
  altura: number,
  semilla: number,
  hojas: [PBRMaterial, PBRMaterial],
  corteza: PBRMaterial
): Mesh[] {
  const azar = crearAzar(semilla);
  const tronco = MeshBuilder.CreateCylinder(`${nombre}_tronco`, { height: altura * 0.5, diameterTop: 0.13, diameterBottom: 0.28, tessellation: 12 }, scene);
  tronco.position.y = altura * 0.25;
  const ramas: Mesh[] = [tronco];
  for (let k = 0; k < 3; k++) {
    const r = MeshBuilder.CreateCylinder(`${nombre}_rama`, { height: altura * 0.26, diameterTop: 0.05, diameterBottom: 0.11, tessellation: 8 }, scene);
    const a = (k / 3) * Math.PI * 2 + azar();
    r.position.set(Math.cos(a) * 0.18, altura * 0.55, Math.sin(a) * 0.18);
    r.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    ramas.push(r);
  }
  const madera = Mesh.MergeMeshes(ramas, true, true) ?? tronco;
  madera.name = `${nombre}_madera`;
  madera.material = corteza;

  const bultos: [Mesh[], Mesh[]] = [[], []];
  const radioCopa = altura * 0.24;
  for (let k = 0; k < 11; k++) {
    const r = radioCopa * (0.45 + azar() * 0.35);
    const b = MeshBuilder.CreateSphere(`${nombre}_bulto`, { diameter: r * 2, segments: 10 }, scene);
    const a = azar() * Math.PI * 2;
    const d = azar() * radioCopa * 0.75;
    const y = altura * (0.66 + azar() * 0.22);
    b.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    b.scaling.y = 0.85;
    // Los de arriba y de fuera, al sol; los de dentro y abajo, en sombra.
    bultos[y > altura * 0.76 || d > radioCopa * 0.45 ? 0 : 1].push(b);
  }
  const salida: Mesh[] = [madera];
  bultos.forEach((grupo, i) => {
    if (grupo.length === 0) return;
    const m = Mesh.MergeMeshes(grupo, true, true) ?? grupo[0];
    m.name = `${nombre}_copa_${i}`;
    m.material = hojas[i];
    salida.push(m);
  });
  return salida;
}
