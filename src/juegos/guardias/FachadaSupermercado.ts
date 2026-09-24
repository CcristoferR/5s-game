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
  type Vector3,
} from "@babylonjs/core";

// ===========================================================================
// La fachada de vidrio y la entrada
// ===========================================================================
//
// El modelo trae el vidrio como tres láminas celestes al diez por ciento,
// sin marco: desde dentro se leían como paneles de color, no como vidrio, y
// la puerta era una ventana más que llegaba al suelo. Aquí se rehace entera:
//
//   · Vidrio de verdad: casi incoloro, con el reflejo del cielo y de la calle
//     que se hace más fuerte cuanto más de canto se mira (Fresnel), que es lo
//     que hace que un vidrio se lea como vidrio.
//   · Un marco de aluminio natural, delgado y sin parteluz: el de una vidriera
//     de local, que es un paño entero y no una ventana de casa.
//   · El derrame de cada hueco revestido: el del modelo salía manchado.
//   · Una puerta automática de dos hojas que se abren cuando alguien se acerca
//     —un cliente que entra o se va, o el guardia—, con su caja de motor y su
//     franja esmerilada de seguridad.
//   · Las antenas antihurto a los lados del paso y un felpudo.
//
// ─── EL MURO DEL MODELO ──────────────────────────────────────────────────
//
// Medido con rayos, no a ojo, y ojo con cómo: un rayo devuelve un solo golpe
// por malla, el más cercano, y el edificio entero es una malla. Contando eso:
//
//   · Bajo la franja verde, el muro de las vidrieras va de Z 7,112 (dentro)
//     a 7,282 (fuera): diecisiete centímetros, con sus jambas, antepecho y
//     dintel en cada hueco.
//   · La franja verde de arriba vuela sobre la vereda hasta 7,567. Debajo de
//     su vuelo, a 2,46 m, hay un plafón: las vidrieras quedan retranqueadas
//     28 cm bajo la franja, como en tantos locales.
//
// La versión anterior había medido el espesor en la franja (7,40 a 7,57) y
// montó ahí los marcos, derrames y repisas: por fuera sobresalían hasta
// 28 cm de la cara del muro, como cajas pegadas. Ahora el marco va al ras de
// la cara de fuera, que es donde va en una vidriera de local, y desde la sala
// la ventana se lee hundida en los once centímetros de muro que quedan.

/** Los huecos de las ventanas, en X, con su antepecho y su dintel. */
const VENTANAS: readonly [number, number][] = [
  [-3.68, -1.48],
  [-0.77, 1.29],
  [4.775, 6.83],
  [7.545, 9.605],
];
const VENTANA_Y: [number, number] = [0.515, 2.28];
/** El hueco de la puerta. */
const PUERTA_HUECO: [number, number] = [2.135, 3.93];
const PUERTA_Y: [number, number] = [0.17, 2.285];

/** Cara de dentro del muro de las vidrieras: la que se ve desde la sala. */
const MURO_DENTRO_Z = 7.112;
/** Cara de fuera, retranqueada bajo el vuelo de la franja verde. */
const MURO_FUERA_Z = 7.282;
/** El plafón bajo el vuelo de la franja verde. */
const PLAFON_Y = 2.46;

/** El marco: ancho a la vista y fondo. El travesaño de abajo, algo más ancho. */
const PERFIL = 0.04;
const PERFIL_BAJO = 0.06;
const FONDO_PERFIL = 0.06;
/** El marco va a haces de la cara de fuera, dos milímetros por dentro. */
const MARCO_Z1 = MURO_FUERA_Z - 0.002;
const MARCO_Z0 = MARCO_Z1 - FONDO_PERFIL;
const VIDRIO_Z = (MARCO_Z0 + MARCO_Z1) / 2;

/** Plano de las hojas de la puerta: por dentro, corriendo sobre el muro. */
const HOJAS_Z = MURO_DENTRO_Z - 0.032;

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
  /** Todas sus mallas. Las alumbran las luces de la sala. */
  mallas: Mesh[];
  /** Le pone el reflejo del exterior a lo que lo lleva. */
  reflejar(textura: BaseTexture): void;
  dispose(): void;
}

/**
 * Si un triángulo del muro del modelo es de lo que alumbra el sol: la cara de
 * fuera de las vidrieras o el plafón bajo la franja. Para separarLoDeFuera,
 * en ExteriorSupermercado: son caras del mismo muro que se ve desde la sala,
 * y por el centro del triángulo no se distinguen de él.
 */
export function esCaraDeFueraFachada(centro: Vector3, normal: Vector3): boolean {
  const caraFuera = Math.abs(normal.z) > 0.7 && Math.abs(centro.z - MURO_FUERA_Z) < 0.02 && centro.y < PLAFON_Y + 0.01;
  const plafon = Math.abs(normal.y) > 0.7 && Math.abs(centro.y - PLAFON_Y) < 0.05 && centro.z > MURO_FUERA_Z;
  return caraFuera || plafon;
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

  // Casi incoloro, con un punto de verde como el float de verdad. El alfa
  // bajo deja pasar la calle; el reflejo va encima del alfa (radiancia sobre
  // alfa), así que el vidrio brilla aunque se vea a través. El albedo, casi
  // negro: un vidrio no tiene color propio que las luces aclaren, solo quita
  // un poco de luz y refleja. Claro, las luces de la sala le ponían un velo
  // blanco y la calle se veía como tras un vidrio empañado.
  const vidrio = new PBRMaterial("matVidrioFachada", scene);
  vidrio.albedoColor = new Color3(0.035, 0.045, 0.045);
  vidrio.alpha = 0.1;
  vidrio.metallic = 0;
  vidrio.roughness = 0.03;
  vidrio.indexOfRefraction = 1.52;
  vidrio.backFaceCulling = false;
  vidrio.twoSidedLighting = true;
  vidrio.useRadianceOverAlpha = true;
  vidrio.useSpecularOverAlpha = true;
  vidrio.environmentIntensity = 0.85;
  vidrio.maxSimultaneousLights = 8;

  // Aluminio anodizado natural, satinado: el de las vidrieras de un local.
  // Claro a propósito: sobre el muro blanco, un marco oscuro se come la
  // ventana y la hace parecer una reja.
  //
  // Sin el reflejo del exterior, y metálico solo a medias: la sonda está en
  // medio del estacionamiento, y en los cantos del marco, vistos desde la
  // sala, reflejaba el pasto en verde y el cielo en rosa. El satinado del
  // anodizado se ve con el brillo de las luces, que es lo que tiene.
  const aluminio = new PBRMaterial("matAluminioFachada", scene);
  aluminio.albedoColor = new Color3(0.74, 0.75, 0.76);
  aluminio.metallic = 0.35;
  aluminio.roughness = 0.4;
  aluminio.maxSimultaneousLights = 8;

  // La caja del motor de la puerta, en aluminio natural cepillado. Por
  // dentro: tampoco refleja la calle.
  const cepillado = new PBRMaterial("matMotorPuerta", scene);
  cepillado.albedoColor = new Color3(0.72, 0.73, 0.74);
  cepillado.metallic = 0.4;
  cepillado.roughness = 0.45;
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

  // El derrame de los huecos, visto desde la sala: del tono de la pared bajo
  // sus mismas luces.
  const revoque = new PBRMaterial("matRevoqueHuecos", scene);
  revoque.albedoColor = new Color3(0.8, 0.8, 0.79);
  revoque.metallic = 0;
  revoque.roughness = 0.92;
  revoque.maxSimultaneousLights = 8;

  // --- Utilidades ---------------------------------------------------------------

  /** Una caja por sus extremos, en coordenadas del mundo. */
  const caja = (nombre: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Mesh => {
    const m = MeshBuilder.CreateBox(nombre, { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, scene);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return m;
  };
  /** Varias piezas del mismo material en una sola malla: un dibujo, no diez. */
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

  // --- El derrame de cada hueco ---------------------------------------------------
  //
  // El modelo trae jambas, antepecho y dintel, pero con la textura del atlas
  // del edificio, y en esas caras la textura cae justo al borde de la franja
  // verde: vistas de canto se manchaban de verde y rosa. Se revisten con el
  // tono de la pared, seis milímetros por delante de las del modelo —los
  // huecos se midieron con rayos cada cinco, y con milímetro y medio la cara
  // del modelo asomaba—, desde la cara de dentro hasta meterse en el marco.
  // Las cajas van hundidas en el muro: lo que asoma es solo la cara del borde.
  const huecos: { x: [number, number]; y: [number, number]; puerta: boolean }[] = [
    ...VENTANAS.map((x) => ({ x, y: VENTANA_Y, puerta: false })),
    { x: PUERTA_HUECO, y: PUERTA_Y, puerta: true },
  ];
  const R = 0.02;
  const S = 0.006;
  const zr0 = MURO_DENTRO_Z + 0.001;
  const zr1 = MARCO_Z0 + 0.01;
  const derrames: Mesh[] = [];
  for (const [i, h] of huecos.entries()) {
    const [x0, x1] = h.x;
    const [y0, y1] = h.y;
    derrames.push(
      caja(`jamba_${i}_i`, x0 - R, x0 + S, y0 - R, y1 + R, zr0, zr1),
      caja(`jamba_${i}_d`, x1 - S, x1 + R, y0 - R, y1 + R, zr0, zr1),
      caja(`dintel_${i}`, x0, x1, y1 - S, y1 + R, zr0, zr1)
    );
    // La puerta no lleva antepecho: abajo va el umbral.
    if (!h.puerta) derrames.push(caja(`antepecho_${i}`, x0, x1, y0 - R, y0 + S, zr0, zr1));
  }
  fundir("derramesHuecos", derrames, revoque);

  // --- Ventanas: un marco y un paño --------------------------------------------------

  // El marco se mete un centímetro en el muro por cada lado y el derrame se
  // mete otro en el marco: así no queda rendija a la vista entre los dos.
  const perfiles: Mesh[] = [];
  VENTANAS.forEach(([x0, x1], i) => {
    const [y0, y1] = VENTANA_Y;
    perfiles.push(
      caja(`perfilV_${i}_i`, x0 - 0.01, x0 + PERFIL, y0 - 0.01, y1 + 0.01, MARCO_Z0, MARCO_Z1),
      caja(`perfilV_${i}_d`, x1 - PERFIL, x1 + 0.01, y0 - 0.01, y1 + 0.01, MARCO_Z0, MARCO_Z1),
      caja(`perfilV_${i}_ab`, x0, x1, y0 - 0.01, y0 + PERFIL_BAJO, MARCO_Z0, MARCO_Z1),
      caja(`perfilV_${i}_ar`, x0, x1, y1 - PERFIL, y1 + 0.01, MARCO_Z0, MARCO_Z1)
    );
    const vidrioVentana = lamina(`vidrioVentana_${i}`, x0 + PERFIL, x1 - PERFIL, y0 + PERFIL_BAJO, y1 - PERFIL, VIDRIO_Z);
    // Choca como chocaba el vidrio del modelo. No tapa la vista a nada que
    // importe, pero se marca igual: solo detiene el paso.
    vidrioVentana.checkCollisions = true;
    vidrioVentana.metadata = { soloPaso: true };
  });

  // --- Puerta: marco fijo, caja del motor y sensor -------------------------------

  const [px0, px1] = PUERTA_HUECO;
  const [py0, py1] = PUERTA_Y;
  const centroPuerta = (px0 + px1) / 2;
  perfiles.push(
    caja("perfilPuerta_i", px0 - 0.01, px0 + PERFIL, py0, py1 + 0.01, MARCO_Z0, MARCO_Z1),
    caja("perfilPuerta_d", px1 - PERFIL, px1 + 0.01, py0, py1 + 0.01, MARCO_Z0, MARCO_Z1),
    caja("perfilPuerta_ar", px0, px1, py1 - PERFIL, py1 + 0.01, MARCO_Z0, MARCO_Z1)
  );
  fundir("carpinteriaFachada", perfiles, aluminio);

  // La caja del motor va por dentro, sobre el hueco, y tapa el riel por el
  // que corren las hojas: sin ella, las hojas colgarían de la nada.
  fundir(
    "motorPuerta",
    [caja("motorPuerta_caja", px0 - 0.95, px1 + 0.95, py1 - 0.02, py1 + 0.2, HOJAS_Z - 0.085, MURO_DENTRO_Z - 0.001)],
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
  // puesto. Invisible, dentro del hueco, y sin tapar la vista.
  const barrera = guardar(caja("barreraPuerta", px0, px1, 0, py1, VIDRIO_Z - 0.02, VIDRIO_Z + 0.02));
  barrera.isVisible = false;
  barrera.checkCollisions = true;
  barrera.metadata = { soloPaso: true };

  // El umbral: una pletina de aluminio de la cara de dentro a la de fuera,
  // sobre el escalón del hueco.
  fundir("umbralPuerta", [caja("umbralPuerta_caja", px0, px1, py0 - 0.012, py0 + 0.004, HOJAS_Z - 0.04, MURO_FUERA_Z + 0.01)], aluminio);

  // --- Felpudo ----------------------------------------------------------------------

  // Por dentro, con el borde a un centímetro del muro.
  const felpudo = guardar(MeshBuilder.CreateGround("felpudoEntrada", { width: px1 - px0 + 0.3, height: 1.3 }, scene));
  felpudo.position.set(centroPuerta, piso + 0.006, MURO_DENTRO_Z - 0.01 - 0.65);
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
  const ANTENA_Z = 6.746;
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

  // ─── LO QUE NO SE MUEVE, CONGELADO ────────────────────────────────────
  //
  // De toda la fachada, lo único que se mueve son las dos hojas de la puerta,
  // y sus piezas cuelgan de un nodo (`hojaPuerta_*`). Todo lo demás —marcos,
  // vidrios, derrames, umbral, felpudo, antenas— se coloca y se queda quieto,
  // así que se le congela la matriz de mundo y Babylon deja de recalcularla en
  // cada cuadro. La regla es exacta y no hay que mantener una lista: lo que
  // cuelga de algo se deja en paz, lo que no, se congela.
  mallas.forEach((malla) => {
    if (!malla.parent) malla.freezeWorldMatrix();
  });

  const reflejantes = [vidrio];
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
