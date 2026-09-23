import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  Quaternion,
  TransformNode,
  DynamicTexture,
  type AbstractMesh,
  type BaseTexture,
} from "@babylonjs/core";

// ===========================================================================
// El carro de supermercado
// ===========================================================================
//
// Un carro de alambre como los de cualquier súper de barrio, de unos cien
// litros: canasto de alambre cincado que se angosta hacia adelante —es lo que
// deja encajar uno en otro—, bandeja de abajo, el manillar verde de la marca,
// parachoques grises en las esquinas y cuatro ruedas giratorias.
//
// Todo de verdad, alambre por alambre: unos doscientos cilindros finos
// fundidos en una sola malla por material. Visto de cerca se ve la rejilla y a
// través de ella; de lejos, la trama gris que es un carro.
//
// En coordenadas del carro: el origen en el suelo, al centro; +Z es la nariz y
// −Z el manillar.

/** Medidas del carro, en metros. */
export const CARRO = {
  /** Del manillar a la nariz. */
  largo: 0.94,
  /** Altura del manillar. */
  altoAsa: 0.98,
  /** Dónde queda el manillar, en Z del carro. */
  asaZ: -0.49,
  /** Lo que avanza cada carro al encajar en el de delante. */
  encaje: 0.26,
  /** El fondo del canasto, por dentro: sobre él se apoya lo que se echa. */
  fondoY: 0.535,
} as const;

/** Grosor del alambre del canasto, y del marco. */
const ALAMBRE = 0.0045;
const MARCO = 0.011;

export interface MaterialesCarro {
  alambre: PBRMaterial;
  plastico: PBRMaterial;
  gris: PBRMaterial;
  goma: PBRMaterial;
}

/**
 * Los materiales de un juego de carros.
 *
 * @param conReflejo  Afuera el alambre refleja la calle —se le enchufa la sonda
 *                    del exterior— y puede ser metal de verdad. Adentro no hay
 *                    entorno que reflejar: metal puro se vería negro, así que
 *                    es metálico a medias y vive del brillo de los focos.
 */
export function materialesCarro(scene: Scene, sufijo: string, conReflejo: boolean): MaterialesCarro {
  const alambre = new PBRMaterial(`matAlambreCarro_${sufijo}`, scene);
  alambre.albedoColor = new Color3(0.8, 0.81, 0.83);
  alambre.metallic = conReflejo ? 0.95 : 0.45;
  alambre.roughness = conReflejo ? 0.28 : 0.34;
  alambre.maxSimultaneousLights = 8;
  // Los alambres miden medio centímetro: sin esto, su brillo parpadea al
  // moverse la cámara.
  alambre.enableSpecularAntiAliasing = true;

  // El verde de la marca, el de la franja de la fachada.
  const plastico = new PBRMaterial(`matPlasticoCarro_${sufijo}`, scene);
  plastico.albedoColor = new Color3(0.1, 0.36, 0.13);
  plastico.metallic = 0;
  plastico.roughness = 0.42;
  plastico.maxSimultaneousLights = 8;

  const gris = new PBRMaterial(`matGrisCarro_${sufijo}`, scene);
  gris.albedoColor = new Color3(0.24, 0.25, 0.27);
  gris.metallic = 0;
  gris.roughness = 0.55;
  gris.maxSimultaneousLights = 8;

  const goma = new PBRMaterial(`matGomaCarro_${sufijo}`, scene);
  goma.albedoColor = new Color3(0.05, 0.05, 0.055);
  goma.metallic = 0;
  goma.roughness = 0.82;
  goma.maxSimultaneousLights = 8;

  return { alambre, plastico, gris, goma };
}

export interface ModeloCarro {
  /** Las mallas fuente, una por material, en coordenadas del carro. */
  partes: Mesh[];
  /**
   * La reja de atrás, aparte: gira sobre su bisagra de arriba cuando otro
   * carro se encaja por detrás.
   */
  reja: Mesh;
  /** Dónde está la bisagra de la reja, en el carro. */
  bisagra: Vector3;
}

/**
 * Arma un carro. Las mallas quedan en el origen, sin padre: quien lo use las
 * cuelga de su nodo, o las instancia para un corral entero.
 */
export function modelarCarro(scene: Scene, nombre: string, m: MaterialesCarro): ModeloCarro {
  const alambres: Mesh[] = [];
  const marcos: Mesh[] = [];
  const verdes: Mesh[] = [];
  const grises: Mesh[] = [];
  const gomas: Mesh[] = [];
  const reja: Mesh[] = [];
  let n = 0;
  const arriba = Vector3.Up();
  const q = new Quaternion();

  /** Un tramo de alambre recto entre dos puntos. */
  const tramo = (lista: Mesh[], a: Vector3, b: Vector3, grosor: number, lados = 4): void => {
    const d = b.subtract(a);
    const largo = d.length();
    if (largo < 1e-4) return;
    const c = MeshBuilder.CreateCylinder(
      `${nombre}_t${n++}`,
      { height: largo, diameter: grosor, tessellation: lados, cap: lados > 4 ? Mesh.CAP_ALL : Mesh.NO_CAP },
      scene
    );
    Quaternion.FromUnitVectorsToRef(arriba, d.normalize(), q);
    c.rotationQuaternion = q.clone();
    c.position.copyFrom(a.add(b).scale(0.5));
    lista.push(c);
  };
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => Vector3.Lerp(a, b, t);

  // ─── EL CANASTO ─────────────────────────────────────────────────────────
  //
  // Ocho esquinas: el borde de arriba y el fondo, más ancho atrás que en la
  // nariz. El fondo sube hacia la nariz, como el de los carros de verdad.
  const topAtras = 0.93;
  const topDelante = 0.92;
  const tRI = v(-0.265, topAtras, -0.45); // arriba, atrás, izquierda
  const tRD = v(0.265, topAtras, -0.45);
  const tFI = v(-0.225, topDelante, 0.46); // arriba, nariz
  const tFD = v(0.225, topDelante, 0.46);
  const bRI = v(-0.225, CARRO.fondoY - 0.01, -0.36); // fondo, atrás
  const bRD = v(0.225, CARRO.fondoY - 0.01, -0.36);
  const bFI = v(-0.19, CARRO.fondoY + 0.03, 0.38); // fondo, nariz
  const bFD = v(0.19, CARRO.fondoY + 0.03, 0.38);

  // Los costados: verticales cada cinco centímetros y cuatro horizontales.
  const costado = (tR: Vector3, tF: Vector3, bR: Vector3, bF: Vector3): void => {
    const cuantos = 18;
    for (let i = 0; i <= cuantos; i++) {
      const t = i / cuantos;
      tramo(alambres, lerp(bR, bF, t), lerp(tR, tF, t), ALAMBRE);
    }
    [0.28, 0.55, 0.8].forEach((h) => tramo(alambres, lerp(bR, tR, h), lerp(bF, tF, h), ALAMBRE));
  };
  costado(tRI, tFI, bRI, bFI);
  costado(tRD, tFD, bRD, bFD);

  // La nariz: verticales y las mismas horizontales.
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    tramo(alambres, lerp(bFI, bFD, t), lerp(tFI, tFD, t), ALAMBRE);
  }
  [0.28, 0.55, 0.8].forEach((h) => tramo(alambres, lerp(bFI, tFI, h), lerp(bFD, tFD, h), ALAMBRE));

  // El fondo: longitudinales cada cuatro centímetros y cinco travesaños.
  for (let i = 0; i <= 11; i++) {
    const t = i / 11;
    tramo(alambres, lerp(bRI, bRD, t), lerp(bFI, bFD, t), ALAMBRE);
  }
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    tramo(alambres, lerp(bRI, bFI, t), lerp(bRD, bFD, t), ALAMBRE);
  }

  // El marco: el borde de arriba y las aristas, más gruesos.
  tramo(marcos, tRI, tRD, MARCO, 6);
  tramo(marcos, tRI, tFI, MARCO, 6);
  tramo(marcos, tRD, tFD, MARCO, 6);
  tramo(marcos, tFI, tFD, MARCO, 6);
  tramo(marcos, bRI, bFI, MARCO * 0.8, 6);
  tramo(marcos, bRD, bFD, MARCO * 0.8, 6);
  tramo(marcos, bFI, bFD, MARCO * 0.8, 6);
  tramo(marcos, bRI, tRI, MARCO * 0.8, 6);
  tramo(marcos, bRD, tRD, MARCO * 0.8, 6);
  tramo(marcos, bFI, tFI, MARCO * 0.8, 6);
  tramo(marcos, bFD, tFD, MARCO * 0.8, 6);

  // La reja de atrás, colgada del borde de arriba: se arma en torno a su
  // bisagra para poder girarla después.
  const bisagra = v(0, topAtras - 0.005, -0.45);
  const rejaIzq = v(-0.255, topAtras - 0.01, -0.45).subtract(bisagra);
  const rejaDer = v(0.255, topAtras - 0.01, -0.45).subtract(bisagra);
  const rejaBI = v(-0.22, CARRO.fondoY + 0.02, -0.37).subtract(bisagra);
  const rejaBD = v(0.22, CARRO.fondoY + 0.02, -0.37).subtract(bisagra);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    tramo(reja, lerp(rejaBI, rejaBD, t), lerp(rejaIzq, rejaDer, t), ALAMBRE);
  }
  [0.33, 0.66].forEach((h) => tramo(reja, lerp(rejaBI, rejaIzq, h), lerp(rejaBD, rejaDer, h), ALAMBRE));
  tramo(reja, rejaBI, rejaBD, MARCO * 0.8, 6);
  tramo(reja, rejaBI, rejaIzq, MARCO * 0.8, 6);
  tramo(reja, rejaBD, rejaDer, MARCO * 0.8, 6);

  // ─── EL CHASIS ──────────────────────────────────────────────────────────
  //
  // Dos largueros bajos de rueda a rueda, los montantes que suben al manillar
  // y los que sostienen el canasto, y la bandeja de abajo.
  const ruedaY = 0.115;
  const chasisY = 0.17;
  const traseras = 0.225;
  const delanteras = 0.18;
  const zT = -0.37;
  const zD = 0.37;
  [-1, 1].forEach((s) => {
    tramo(marcos, v(s * traseras, chasisY, zT), v(s * delanteras, chasisY, zD), 0.02, 8);
    // Montante al manillar: desde la rueda de atrás, inclinado hacia atrás.
    tramo(marcos, v(s * traseras, chasisY, zT), v(s * 0.255, CARRO.altoAsa - 0.02, CARRO.asaZ + 0.01), 0.02, 8);
    // Soporte del canasto en la nariz.
    tramo(marcos, v(s * delanteras, chasisY, zD), v(s * 0.19, CARRO.fondoY + 0.02, 0.36), 0.016, 8);
    // Tirante del canasto al montante.
    tramo(marcos, v(s * 0.235, CARRO.fondoY - 0.005, -0.3), v(s * 0.245, 0.62, -0.42), 0.012, 6);
  });
  // Travesaños del chasis.
  tramo(marcos, v(-traseras, chasisY, zT), v(traseras, chasisY, zT), 0.018, 8);
  tramo(marcos, v(-delanteras, chasisY, zD), v(delanteras, chasisY, zD), 0.018, 8);
  // La bandeja de abajo, de alambre.
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x0 = -0.2 + 0.4 * t;
    tramo(alambres, v(x0, chasisY + 0.035, -0.3), v(x0 * 0.85, chasisY + 0.035, 0.3), ALAMBRE);
  }
  tramo(alambres, v(-0.2, chasisY + 0.035, -0.3), v(0.2, chasisY + 0.035, -0.3), ALAMBRE * 1.4);
  tramo(alambres, v(-0.17, chasisY + 0.035, 0.3), v(0.17, chasisY + 0.035, 0.3), ALAMBRE * 1.4);
  tramo(alambres, v(-0.2, chasisY + 0.035, 0), v(0.19, chasisY + 0.035, 0), ALAMBRE * 1.4);
  [-1, 1].forEach((s) => tramo(marcos, v(s * 0.2, chasisY, -0.3), v(s * 0.2, chasisY + 0.035, -0.3), 0.01, 6));

  // ─── EL MANILLAR ────────────────────────────────────────────────────────
  const asa = MeshBuilder.CreateCylinder(`${nombre}_asa`, { height: 0.5, diameter: 0.034, tessellation: 16 }, scene);
  asa.rotation.z = Math.PI / 2;
  asa.position.set(0, CARRO.altoAsa, CARRO.asaZ);
  verdes.push(asa);
  [-1, 1].forEach((s) => {
    // Las tapas del manillar y la pieza que lo abraza al montante.
    const tapa = MeshBuilder.CreateCylinder(`${nombre}_tapaAsa_${s}`, { height: 0.03, diameter: 0.042, tessellation: 16 }, scene);
    tapa.rotation.z = Math.PI / 2;
    tapa.position.set(s * 0.265, CARRO.altoAsa, CARRO.asaZ);
    grises.push(tapa);
  });
  // La placa de la marca en la nariz.
  const placa = MeshBuilder.CreateBox(`${nombre}_placa`, { width: 0.2, height: 0.075, depth: 0.008 }, scene);
  placa.position.set(0, 0.8, 0.463);
  placa.rotation.x = -0.02;
  verdes.push(placa);

  // ─── PARACHOQUES Y RUEDAS ───────────────────────────────────────────────
  [-1, 1].forEach((s) => {
    // Las esquinas de la nariz, arriba: donde se golpea todo.
    const esquina = MeshBuilder.CreateBox(`${nombre}_parachoques_${s}`, { width: 0.05, height: 0.05, depth: 0.05 }, scene);
    esquina.position.set(s * 0.215, topDelante - 0.005, 0.455);
    grises.push(esquina);
    // Y el de abajo, sobre el chasis.
    const bajo = MeshBuilder.CreateBox(`${nombre}_parachoquesBajo_${s}`, { width: 0.06, height: 0.05, depth: 0.05 }, scene);
    bajo.position.set(s * 0.17, chasisY, zD + 0.035);
    grises.push(bajo);
  });
  const rueda = (x: number, z: number, i: number): void => {
    // La horquilla, la placa que gira y la rueda de goma con su buje.
    const placaRueda = MeshBuilder.CreateBox(`${nombre}_placaRueda_${i}`, { width: 0.07, height: 0.012, depth: 0.07 }, scene);
    placaRueda.position.set(x, chasisY - 0.015, z);
    grises.push(placaRueda);
    [-1, 1].forEach((s) => {
      const pata = MeshBuilder.CreateBox(`${nombre}_horquilla_${i}_${s}`, { width: 0.006, height: 0.085, depth: 0.03 }, scene);
      pata.position.set(x + s * 0.022, chasisY - 0.06, z - 0.012);
      marcos.push(pata);
    });
    const goma = MeshBuilder.CreateCylinder(`${nombre}_rueda_${i}`, { height: 0.03, diameter: 0.115, tessellation: 20 }, scene);
    goma.rotation.z = Math.PI / 2;
    goma.position.set(x, ruedaY - 0.058, z - 0.03);
    gomas.push(goma);
    const buje = MeshBuilder.CreateCylinder(`${nombre}_buje_${i}`, { height: 0.034, diameter: 0.045, tessellation: 12 }, scene);
    buje.rotation.z = Math.PI / 2;
    buje.position.copyFrom(goma.position);
    grises.push(buje);
  };
  rueda(-traseras, zT, 0);
  rueda(traseras, zT, 1);
  rueda(-delanteras, zD, 2);
  rueda(delanteras, zD, 3);

  const fundir = (sufijo: string, piezas: Mesh[], material: PBRMaterial): Mesh => {
    const malla = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
    malla.name = `${nombre}_${sufijo}`;
    malla.material = material;
    malla.isPickable = false;
    return malla;
  };
  const rejaMalla = fundir("reja", reja, m.alambre);
  const partes = [
    fundir("alambre", [...alambres, ...marcos], m.alambre),
    fundir("verde", verdes, m.plastico),
    fundir("gris", grises, m.gris),
    fundir("ruedas", gomas, m.goma),
  ];
  // La placa lleva el nombre del local: se pinta sobre el verde.
  pintarPlaca(scene, nombre, partes[1]);
  return { partes, reja: rejaMalla, bisagra };
}

/**
 * El nombre del local en la placa de la nariz. Un calco con fondo
 * transparente, pegado un milímetro por delante de la placa.
 */
function pintarPlaca(scene: Scene, nombre: string, verde: Mesh): void {
  const tex = new DynamicTexture(`tex_${nombre}_placa`, { width: 256, height: 96 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 96);
  ctx.fillStyle = "#f4f6f2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 40px system-ui, 'Segoe UI', sans-serif";
  ctx.fillText("súper", 128, 50);
  tex.hasAlpha = true;
  tex.update();
  const mat = new StandardMaterial(`mat_${nombre}_placa`, scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = new Color3(0.1, 0.1, 0.1);
  mat.emissiveColor = new Color3(0.25, 0.25, 0.25);
  const calco = MeshBuilder.CreatePlane(`${nombre}_calco`, { width: 0.19, height: 0.07 }, scene);
  // El plano mira a −Z: media vuelta para que mire hacia adelante.
  calco.rotation.set(-0.02, Math.PI, 0);
  calco.position.set(0, 0.8, 0.4675);
  calco.material = mat;
  calco.isPickable = false;
  calco.parent = verde;
}

/**
 * Una sombra suave bajo el carro, alargada: lo apoya en el piso. Mismo
 * truco que la sombra al pie de las personas (ver LuzSalaSupermercado).
 */
export function sombraCarro(scene: Scene, nombre: string, largo: number, ancho: number): Mesh {
  const tex = new DynamicTexture(`tex_${nombre}`, { width: 64, height: 128 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 64, 128);
  // Un rectángulo de esquinas muy redondas y borde difuso: capas de menos a
  // más opacas hacia el centro.
  for (let i = 0; i < 14; i++) {
    const m = i * 2;
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.beginPath();
    ctx.roundRect(4 + m, 4 + m, 56 - m * 2, 120 - m * 2, 18);
    ctx.fill();
  }
  tex.hasAlpha = true;
  tex.update();
  const mat = new StandardMaterial(`mat_${nombre}`, scene);
  mat.diffuseColor = new Color3(0, 0, 0);
  mat.specularColor = new Color3(0, 0, 0);
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  mat.zOffset = -2;
  const sombra = MeshBuilder.CreateGround(nombre, { width: ancho, height: largo }, scene);
  sombra.material = mat;
  sombra.isPickable = false;
  return sombra;
}

/**
 * Un carro suelto, para que lo empuje alguien: el modelo colgado de un nodo,
 * con su sombra.
 */
export function crearCarro(scene: Scene, nombre: string, m: MaterialesCarro): { nodo: TransformNode; mallas: Mesh[] } {
  const nodo = new TransformNode(nombre, scene);
  const modelo = modelarCarro(scene, nombre, m);
  modelo.partes.forEach((p) => (p.parent = nodo));
  modelo.reja.parent = nodo;
  modelo.reja.position.copyFrom(modelo.bisagra);
  const sombra = sombraCarro(scene, `${nombre}_sombraAlPie`, 1.0, 0.62);
  sombra.parent = nodo;
  sombra.position.y = 0.004;
  return { nodo, mallas: [...modelo.partes, modelo.reja, sombra] };
}

/**
 * El corral de los carros: unos cuantos encajados uno en otro, contra la
 * fachada, junto a la puerta. Instancias del mismo carro: cinco carros cuestan
 * lo que uno.
 *
 * @param donde   El pie del primero —el de más adelante— y hacia dónde miran.
 * @param cuantos Cuántos carros en fila.
 * @returns Las mallas —fuentes e instancias— para la luz de fuera, y el
 *          material de alambre, que refleja la calle.
 */
export function montarCorral(
  scene: Scene,
  donde: { x: number; y: number; z: number; rumbo: number },
  cuantos: number
): { mallas: AbstractMesh[]; reflejan: PBRMaterial[]; reflejar: (t: BaseTexture) => void } {
  const materiales = materialesCarro(scene, "corral", true);
  const modelo = modelarCarro(scene, "carroCorral", materiales);
  const mallas: AbstractMesh[] = [];
  const adelante = new Vector3(Math.sin(donde.rumbo), 0, Math.cos(donde.rumbo));
  for (let i = 0; i < cuantos; i++) {
    const nodo = new TransformNode(`carroCorral_${i}`, scene);
    // Cada uno encajado en el de delante: un encaje más atrás y un pelo más
    // arriba, que es como quedan —el de atrás monta sobre las ruedas del otro—.
    const p = new Vector3(donde.x, donde.y + i * 0.006, donde.z).subtract(adelante.scale(i * CARRO.encaje));
    nodo.position.copyFrom(p);
    nodo.rotation.y = donde.rumbo;
    const piezas: AbstractMesh[] =
      i === 0 ? modelo.partes : modelo.partes.map((parte) => parte.createInstance(`${parte.name}_${i}`));
    piezas.forEach((pz) => (pz.parent = nodo));
    const reja = i === 0 ? modelo.reja : modelo.reja.createInstance(`${modelo.reja.name}_${i}`);
    reja.parent = nodo;
    reja.position.copyFrom(modelo.bisagra);
    // La reja del de delante se levanta: la empuja la nariz del que se encaja
    // por detrás. La del último queda colgando.
    reja.rotation.x = i < cuantos - 1 ? -1.25 : 0;
    nodo.computeWorldMatrix(true);
    [...piezas, reja].forEach((pz) => {
      pz.computeWorldMatrix(true);
      pz.freezeWorldMatrix();
      pz.isPickable = false;
    });
    mallas.push(...piezas, reja);
  }
  // Una sola sombra alargada bajo la fila entera.
  const largoFila = CARRO.largo + (cuantos - 1) * CARRO.encaje;
  const sombra = sombraCarro(scene, "corralCarros_sombra", largoFila + 0.1, 0.66);
  const centro = new Vector3(donde.x, donde.y + 0.003, donde.z).subtract(adelante.scale(((cuantos - 1) * CARRO.encaje) / 2));
  sombra.position.copyFrom(centro);
  sombra.rotation.y = donde.rumbo;
  mallas.push(sombra);
  return {
    mallas,
    reflejan: [materiales.alambre],
    reflejar(t) {
      materiales.alambre.reflectionTexture = t;
    },
  };
}
