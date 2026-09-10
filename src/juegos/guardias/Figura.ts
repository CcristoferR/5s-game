import {
  Scene,
  TransformNode,
  Vector3,
  Color3,
  MeshBuilder,
  PBRMaterial,
  Mesh,
  Observer,
} from "@babylonjs/core";

// ===========================================================================
// Figura humana
// ===========================================================================
//
// Una persona armada con cajas y cilindros, que camina.
//
// ─── POR QUÉ ASÍ Y NO UN MODELO IMPORTADO ─────────────────────────────────
//
// Un personaje con esqueleto y animaciones se ve mejor de cerca, sin duda.
// Pero hay que conseguirlo, pesa varios megas, hay que licenciarlo y hay que
// vestirlo de guardia chileno. Nada de eso está disponible hoy.
//
// Y a la distancia a la que se ve esta figura —entre tres y ocho metros, en un
// hall en penumbra— lo que la hace creíble no es el detalle de la cara. Son
// tres cosas, y las tres se pueden construir:
//
//   1. PROPORCIÓN. La cabeza es un séptimo del cuerpo, los ojos caen a 1,63 m,
//      el hombro a 1,44, la cadera a 0,93. Una figura con proporciones malas
//      se ve mal por muy bien modelada que esté.
//   2. LA CAMINATA. Las piernas alternan, los brazos van al revés que las
//      piernas, la rodilla se dobla solo al pasar, y el cuerpo sube y baja dos
//      veces por zancada. Sin eso, es un maniquí deslizándose.
//   3. QUE NO PATINE. La fase del paso avanza según la DISTANCIA recorrida y
//      no según el reloj. Es la diferencia entre alguien que camina y alguien
//      que hace el gesto de caminar mientras lo arrastran.
//
// ─── ESTÁ HECHA PARA REPETIRSE ────────────────────────────────────────────
//
// Hoy la usa el supervisor de las 03:20. Los residentes que entran de noche,
// el guardia saliente del relevo o quien venga después salen de acá cambiando
// la paleta y la ruta. Por eso no sabe nada del escenario: recibe puntos y
// camina, y quién es y a qué viene se decide fuera.

/** Alto total de la figura, en metros. Todo lo demás se deriva de esto. */
const ALTURA = 1.75;

// Alturas anatómicas, en fracción de la altura total. Salen de la proporción
// canónica de un adulto: no son gusto, son medidas.
const H_CADERA = 0.53;
const H_HOMBRO = 0.82;
const H_CUELLO = 0.87;

/** Metros que se avanzan por zancada completa (dos pasos). */
const ZANCADA = 1.5;

/** Medidas de la pierna. Las usan el modelado Y el cálculo del apoyo. */
const MUSLO = 0.44;
/** De la rodilla a la suela. */
const CAIDA_PIE = 0.48;
/**
 * Punta y talón del zapato respecto al eje de la pierna.
 *
 * Estaban al revés: 0,07 de punta y -0,17 de talón dejaban el zapato con
 * diecisiete centímetros por DETRÁS del tobillo y siete por delante. Como la
 * figura avanza hacia su +Z local —ver rumboDeseado, que usa atan2(dx, dz)—,
 * el resultado era una persona caminando de frente con los pies puestos al
 * revés.
 *
 * El largo total del zapato no cambia; lo que cambia es de qué lado del tobillo
 * está. El cálculo del apoyo sigue valiendo igual: solo necesita que PUNTA sea
 * el extremo delantero y TALON el trasero, y eso se mantiene.
 */
const PUNTA = 0.17;
const TALON = -0.07;

/** De la cadera a la suela, con la pierna recta. */
const LARGO_PIERNA = MUSLO + CAIDA_PIE;

/**
 * Cuánto abre la pierna, en radianes.
 *
 * No es un número elegido a ojo: SALE de la zancada, y de una condición muy
 * concreta —que el pie apoyado no se mueva del suelo mientras el cuerpo pasa
 * por encima—. Si la pierna oscila más rápido de lo que avanza el cuerpo, el
 * pie de apoyo se arrastra hacia atrás; si oscila menos, patina hacia delante.
 * Las dos cosas se ven, y se ven feas.
 *
 * La cuenta: el pie se separa de la cadera como `L·sen(A·sen(fase))`, y la
 * fase avanza `2π` por cada ZANCADA recorrida. Derivando y pidiendo que en el
 * centro del apoyo la velocidad del pie respecto al suelo sea cero, queda
 * `A = ZANCADA / (2π · L)`.
 *
 * Da un paso corto y contenido, que además es el que corresponde: alguien
 * cruzando el hall de un condominio a las tres de la mañana no zanquea.
 *
 * La primera versión llevaba 0,62 puesto a ojo. El pie recorría más de un
 * metro por paso y se arrastraba por el suelo en cada apoyo.
 */
const APERTURA_PIERNA = ZANCADA / (2 * Math.PI * LARGO_PIERNA);

export interface PaletaFigura {
  /** Chaqueta y gorra. */
  uniforme: Color3;
  /** Pantalón. */
  pantalon: Color3;
  /** Manos y cara. */
  piel: Color3;
  /** Camisa que asoma bajo la chaqueta, y la cinta de la gorra. */
  detalle: Color3;
  /** Gorra de plato. Solo la lleva quien está de servicio. */
  gorra?: boolean;
}

export interface OpcionesFigura {
  paleta: PaletaFigura;
  /**
   * Altura en metros. Por defecto 1,75.
   *
   * Importa cuando hay más de una figura en escena: tres personas idénticas
   * cruzando el mismo hall se leen como copias del mismo muñeco, y el ojo lo
   * nota antes que ningún otro defecto.
   */
  altura?: number;
}

/**
 * Gorra de plato.
 *
 * La lleva quien está de servicio. A diez metros y en penumbra es lo único
 * que distingue a un supervisor de un residente que vuelve a casa, así que no
 * es un adorno: es la diferencia entre las dos personas que aparecen en el
 * hall.
 */
export const UNIFORME_SUPERVISOR: PaletaFigura = {
  uniforme: new Color3(0.09, 0.1, 0.14),
  pantalon: new Color3(0.06, 0.065, 0.09),
  piel: new Color3(0.52, 0.4, 0.33),
  detalle: new Color3(0.62, 0.66, 0.72),
  gorra: true,
};

/**
 * Ropa de calle, para los residentes.
 *
 * Sin gorra y con colores más sueltos que el uniforme. De noche casi todo se
 * ve en penumbra, así que lo que las separa entre sí no es tanto el color como
 * el contraste: una parka clara y unos vaqueros oscuros se distinguen a diez
 * metros; dos grises no.
 */
export const ROPA_RESIDENTE: PaletaFigura[] = [
  {
    uniforme: new Color3(0.28, 0.3, 0.36),
    pantalon: new Color3(0.11, 0.13, 0.2),
    piel: new Color3(0.55, 0.42, 0.34),
    detalle: new Color3(0.72, 0.74, 0.78),
  },
  {
    uniforme: new Color3(0.42, 0.19, 0.17),
    pantalon: new Color3(0.16, 0.16, 0.17),
    piel: new Color3(0.62, 0.49, 0.4),
    detalle: new Color3(0.8, 0.78, 0.7),
  },
  {
    uniforme: new Color3(0.16, 0.26, 0.24),
    pantalon: new Color3(0.2, 0.2, 0.22),
    piel: new Color3(0.47, 0.35, 0.29),
    detalle: new Color3(0.66, 0.7, 0.72),
  },
  {
    uniforme: new Color3(0.6, 0.58, 0.53),
    pantalon: new Color3(0.13, 0.15, 0.24),
    piel: new Color3(0.58, 0.45, 0.37),
    detalle: new Color3(0.3, 0.31, 0.34),
  },
];

export interface Figura {
  raiz: TransformNode;
  /** Coloca la figura de golpe, sin caminar. */
  situar(punto: Vector3, mirandoHacia?: Vector3): void;
  /** Camina por los puntos, en orden, y avisa al llegar al último. */
  caminar(ruta: Vector3[], velocidad: number, alLlegar?: () => void): void;
  /** Gira suavemente hasta quedar de cara a ese punto. */
  mirarHacia(punto: Vector3): void;
  visible(v: boolean): void;
  dispose(): void;
}

export function crearFigura(scene: Scene, nombre: string, opciones: OpcionesFigura): Figura {
  const paleta = opciones.paleta;
  // Todas las medidas del cuerpo salen de la altura, así que basta con
  // escalarla para tener personas distintas sin tocar ni una proporción.
  const escala = (opciones.altura ?? ALTURA) / ALTURA;
  const mat = (sufijo: string, color: Color3, rugosidad: number): PBRMaterial => {
    const m = new PBRMaterial(`mat${nombre}_${sufijo}`, scene);
    m.albedoColor = color;
    m.roughness = rugosidad;
    m.metallic = 0;
    return m;
  };

  // La tela de uniforme no brilla; la piel algo más, porque la piel siempre
  // devuelve algo de luz y sin eso la cara se ve como cartón pintado.
  const matUniforme = mat("uniforme", paleta.uniforme, 0.86);
  const matPantalon = mat("pantalon", paleta.pantalon, 0.9);
  const matPiel = mat("piel", paleta.piel, 0.62);
  const matDetalle = mat("detalle", paleta.detalle, 0.72);
  const matZapato = mat("zapato", new Color3(0.03, 0.03, 0.04), 0.42);

  const raiz = new TransformNode(`figura_${nombre}`, scene);

  const piezas: Mesh[] = [];
  const caja = (
    sufijo: string,
    ancho: number,
    alto: number,
    fondo: number,
    material: PBRMaterial,
    padre: TransformNode
  ): Mesh => {
    const m = MeshBuilder.CreateBox(
      `${nombre}_${sufijo}`,
      { width: ancho, height: alto, depth: fondo },
      scene
    );
    m.material = material;
    m.parent = padre;
    piezas.push(m);
    return m;
  };

  // --- Tronco ---------------------------------------------------------------
  //
  // El cuerpo cuelga de un nodo a la altura de la cadera. Todo lo que se mueve
  // al caminar —el balanceo vertical, la inclinación hacia delante— se aplica
  // ahí y arrastra al resto, en vez de tener que mover diez piezas a mano.
  const cuerpo = new TransformNode(`${nombre}_cuerpo`, scene);
  cuerpo.parent = raiz;
  cuerpo.position.y = ALTURA * H_CADERA;

  // Torso en dos tramos: abdomen más estrecho y pecho más ancho. Un solo
  // bloque recto es lo que hace que una figura simple parezca un armario.
  const abdomen = caja("abdomen", 0.31, 0.24, 0.19, matUniforme, cuerpo);
  abdomen.position.y = 0.12;

  const pecho = caja("pecho", 0.4, 0.28, 0.22, matUniforme, cuerpo);
  pecho.position.y = 0.38;

  // Camisa entre las solapas: un triángulo claro que rompe la mancha oscura
  // del uniforme y da un punto de contraste a la altura del pecho.
  const camisa = caja("camisa", 0.11, 0.2, 0.02, matDetalle, cuerpo);
  camisa.position.set(0, 0.4, -0.111);

  // Hombros redondeados. Sin ellos el torso termina en dos esquinas rectas y
  // la silueta se lee como una caja incluso a contraluz.
  [-1, 1].forEach((lado) => {
    const hombro = MeshBuilder.CreateSphere(
      `${nombre}_hombro_${lado}`,
      { diameter: 0.19, segments: 10 },
      scene
    );
    hombro.material = matUniforme;
    hombro.parent = cuerpo;
    hombro.position.set(lado * 0.19, ALTURA * (H_HOMBRO - H_CADERA), 0);
    hombro.scaling.y = 0.82;
    piezas.push(hombro);
  });

  // --- Cabeza ---------------------------------------------------------------
  const cabeza = new TransformNode(`${nombre}_cabeza`, scene);
  cabeza.parent = cuerpo;
  cabeza.position.y = ALTURA * (H_CUELLO - H_CADERA);

  const cuello = MeshBuilder.CreateCylinder(
    `${nombre}_cuello`,
    { diameter: 0.1, height: 0.07, tessellation: 12 },
    scene
  );
  cuello.material = matPiel;
  cuello.parent = cabeza;
  cuello.position.y = 0.02;
  piezas.push(cuello);

  const craneo = MeshBuilder.CreateSphere(
    `${nombre}_craneo`,
    { diameter: 0.2, segments: 14 },
    scene
  );
  craneo.material = matPiel;
  craneo.parent = cabeza;
  craneo.position.y = 0.13;
  // Un cráneo esférico se ve a balón. Alargado y algo estrecho, se ve cabeza.
  craneo.scaling.set(0.88, 1.12, 0.96);
  piezas.push(craneo);

  // Gorra de plato. Es lo que dice "esta persona es de seguridad" antes de que
  // se le vea nada más, y a diez metros es lo único que se distingue. Por eso
  // los residentes no la llevan: sin ella se lee "alguien que vive aquí".
  if (paleta.gorra) {
  const gorra = MeshBuilder.CreateCylinder(
    `${nombre}_gorra`,
    { diameterTop: 0.215, diameterBottom: 0.2, height: 0.07, tessellation: 16 },
    scene
  );
  gorra.material = matUniforme;
  gorra.parent = cabeza;
  gorra.position.y = 0.22;
  piezas.push(gorra);

  const cinta = MeshBuilder.CreateCylinder(
    `${nombre}_cintaGorra`,
    { diameter: 0.204, height: 0.018, tessellation: 16 },
    scene
  );
  cinta.material = matDetalle;
  cinta.parent = cabeza;
  cinta.position.y = 0.195;
  piezas.push(cinta);

  const visera = caja("visera", 0.18, 0.014, 0.1, matUniforme, cabeza);
  visera.position.set(0, 0.192, -0.09);
  visera.rotation.x = -0.16;
  }

  // --- Extremidades ---------------------------------------------------------
  //
  // Cada una es un nodo en la articulación de arriba (hombro o cadera) con el
  // segmento colgando hacia abajo, y otro nodo en el codo o la rodilla. Girar
  // el de arriba mueve el miembro entero; el de abajo, solo la parte de abajo.
  // Es un esqueleto de dos huesos, que es lo mínimo para que doblar se vea
  // como doblar y no como estirarse.
  interface Miembro {
    alto: TransformNode;
    bajo: TransformNode;
  }

  const brazos: Miembro[] = [];
  const piernas: Miembro[] = [];

  [-1, 1].forEach((lado) => {
    const hombro = new TransformNode(`${nombre}_artHombro_${lado}`, scene);
    hombro.parent = cuerpo;
    hombro.position.set(lado * 0.215, ALTURA * (H_HOMBRO - H_CADERA) - 0.02, 0);

    const brazo = caja("brazo", 0.085, 0.28, 0.095, matUniforme, hombro);
    brazo.position.y = -0.14;

    const codo = new TransformNode(`${nombre}_artCodo_${lado}`, scene);
    codo.parent = hombro;
    codo.position.y = -0.28;

    const antebrazo = caja("antebrazo", 0.078, 0.25, 0.088, matUniforme, codo);
    antebrazo.position.y = -0.125;

    const mano = MeshBuilder.CreateSphere(
      `${nombre}_mano_${lado}`,
      { diameter: 0.082, segments: 8 },
      scene
    );
    mano.material = matPiel;
    mano.parent = codo;
    mano.position.y = -0.27;
    mano.scaling.set(0.85, 1.15, 0.7);
    piezas.push(mano);

    brazos.push({ alto: hombro, bajo: codo });

    const cadera = new TransformNode(`${nombre}_artCadera_${lado}`, scene);
    cadera.parent = cuerpo;
    cadera.position.set(lado * 0.1, 0, 0);

    const muslo = caja("muslo", 0.125, MUSLO, 0.135, matPantalon, cadera);
    muslo.position.y = -MUSLO / 2;

    const rodilla = new TransformNode(`${nombre}_artRodilla_${lado}`, scene);
    rodilla.parent = cadera;
    rodilla.position.y = -MUSLO;

    const pantorrilla = caja("pantorrilla", 0.105, 0.42, 0.115, matPantalon, rodilla);
    pantorrilla.position.y = -0.21;

    const zapato = caja("zapato", 0.1, 0.06, PUNTA - TALON, matZapato, rodilla);
    zapato.position.set(0, -(CAIDA_PIE - 0.03), (PUNTA + TALON) / 2);

    piernas.push({ alto: cadera, bajo: rodilla });
  });

  // --- Movimiento -----------------------------------------------------------

  let ruta: Vector3[] = [];
  let indiceRuta = 0;
  let velocidad = 0;
  let alLlegar: (() => void) | undefined;

  /** Metros recorridos en total. Es lo que manda la fase del paso. */
  let recorrido = 0;
  /** Rumbo actual y rumbo al que se quiere llegar, en radianes. */
  let rumbo = 0;
  let rumboDeseado = 0;
  /** Cuánto está caminando ahora, de 0 a 1. Suaviza arrancar y parar. */
  let marcha = 0;
  /** Reloj propio, para el balanceo de estar quieto. */
  let reloj = 0;

  function girarHacia(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    rumboDeseado = Math.atan2(dx, dz);
  }

  /** Diferencia de ángulos por el camino corto. Sin esto gira al revés. */
  function acortar(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    reloj += dt;

    // --- Avance por la ruta -------------------------------------------------
    let avanzando = false;
    if (indiceRuta < ruta.length) {
      const destino = ruta[indiceRuta];
      const dx = destino.x - raiz.position.x;
      const dz = destino.z - raiz.position.z;
      const falta = Math.hypot(dx, dz);

      if (falta < 0.04) {
        indiceRuta += 1;
        if (indiceRuta >= ruta.length) {
          const aviso = alLlegar;
          alLlegar = undefined;
          ruta = [];
          if (aviso) aviso();
        }
      } else {
        girarHacia(dx, dz);
        // No avanza de frente hasta no estar más o menos encarado. Si no,
        // camina de lado en las esquinas, que es el gesto que delata al robot.
        const desvio = Math.abs(acortar(rumboDeseado - rumbo));
        const freno = desvio > 1.2 ? 0.15 : 1;
        const paso = Math.min(falta, velocidad * freno * dt);
        raiz.position.x += (dx / falta) * paso;
        raiz.position.z += (dz / falta) * paso;
        recorrido += paso;
        avanzando = paso > 0.0005;
      }
    }

    // --- Giro ---------------------------------------------------------------
    const resto = acortar(rumboDeseado - rumbo);
    rumbo += resto * Math.min(1, dt * 7);
    raiz.rotation.y = rumbo;

    // --- Ciclo de caminata --------------------------------------------------
    //
    // La marcha entra y sale progresivamente. Sin esto, arrancar y parar son
    // saltos: las piernas pasan de rectas a abiertas en un cuadro.
    marcha += ((avanzando ? 1 : 0) - marcha) * Math.min(1, dt * 6);

    const fase = (recorrido / ZANCADA) * Math.PI * 2;
    const amplitud = marcha;

    piernas.forEach((pierna, i) => {
      const lado = i === 0 ? 0 : Math.PI;
      const f = fase + lado;
      pierna.alto.rotation.x = Math.sin(f) * APERTURA_PIERNA * amplitud;
      // La rodilla se doblaba al REVÉS: la pantorrilla salía hacia delante,
      // como la pata de un ave. Una rodilla humana lleva el talón hacia atrás,
      // y en este esqueleto eso es un giro POSITIVO.
      //
      // Solo dobla en el tramo en que la pierna pasa hacia delante, que es
      // cuando el pie tiene que despegar del suelo; doblarla también al apoyar
      // sería andar en cuclillas. Y el desfase de 0,6 es lo que hace que el
      // talón despegue justo después de que la pierna empiece a adelantarse,
      // no a la vez.
      pierna.bajo.rotation.x = Math.max(0, -Math.sin(f - 0.6)) * 1.0 * amplitud;
    });

    brazos.forEach((brazo, i) => {
      const lado = i === 0 ? Math.PI : 0;
      const f = fase + lado;
      // Los brazos van al revés que las piernas y con menos recorrido: nadie
      // camina braceando tanto como abre las piernas.
      brazo.alto.rotation.x = Math.sin(f) * 0.34 * amplitud;
      // El codo nunca se estira del todo, ni parado. Un brazo perfectamente
      // recto es la postura menos humana que existe.
      brazo.bajo.rotation.x = -(0.14 + Math.max(0, Math.sin(f)) * 0.3) * amplitud - 0.1;
    });

    // Inclinación hacia delante al caminar y balanceo de hombros.
    cuerpo.rotation.x = 0.06 * amplitud;
    cuerpo.rotation.y = Math.sin(fase) * 0.07 * amplitud;

    // --- Altura de la cadera --------------------------------------------
    //
    // No es un vaivén inventado: es la altura a la que TIENE que estar la
    // cadera para que el pie más bajo apoye justo en el suelo. Se calcula la
    // caída de cada pierna con los ángulos que acaban de ponerse, y el cuerpo
    // se coloca sobre la mayor de las dos.
    //
    // Antes había aquí un `|sen(fase)| · 0,028` puesto a mano. Tenía la fase
    // correcta —el cuerpo baja cuando las piernas se abren— pero no sabía nada
    // de dónde estaban los pies, y con las piernas abiertas hundía la suela
    // dos centímetros en el piso. En un hall con el suelo pulido eso se ve dos
    // veces: el pie dentro de la baldosa y su reflejo saliendo de ella.
    //
    // Calculándolo, el balanceo sale solo y con la amplitud exacta que le toca
    // a estas piernas: sube al pasar sobre la pierna de apoyo y baja al abrir.
    const caida = (miembro: Miembro): number => {
      // Ángulos en el mundo: el muslo arrastra la inclinación del tronco, y la
      // pantorrilla arrastra además la del muslo.
      const m = miembro.alto.rotation.x + cuerpo.rotation.x;
      const p = m + miembro.bajo.rotation.x;
      const yRodilla = -MUSLO * Math.cos(m);
      // De las dos esquinas bajas del zapato manda la que quede más abajo, que
      // depende de hacia dónde esté girado el pie.
      const z = Math.sin(p) > 0 ? PUNTA : TALON;
      const ySuela = -CAIDA_PIE * Math.cos(p) - z * Math.sin(p);
      return -(yRodilla + ySuela);
    };

    const apoyo = Math.max(caida(piernas[0]), caida(piernas[1]));
    // La respiración solo se nota parado; caminando la tapa el propio paso.
    const respirar = Math.sin(reloj * 1.1) * 0.006 * (1 - amplitud);
    cuerpo.position.y = apoyo + respirar;

    // La cabeza compensa el balanceo del tronco: la mirada de quien camina se
    // mantiene bastante más quieta que el cuerpo.
    cabeza.rotation.y = -cuerpo.rotation.y * 0.75;
    cabeza.rotation.x = -cuerpo.rotation.x * 0.6 + Math.sin(reloj * 0.9) * 0.01;
  });

  raiz.scaling.setAll(escala);
  raiz.setEnabled(false);

  return {
    raiz,
    situar(punto, mirandoHacia) {
      raiz.position.copyFrom(punto);
      ruta = [];
      indiceRuta = 0;
      alLlegar = undefined;
      marcha = 0;
      if (mirandoHacia) {
        rumbo = Math.atan2(mirandoHacia.x - punto.x, mirandoHacia.z - punto.z);
        rumboDeseado = rumbo;
        raiz.rotation.y = rumbo;
      }
    },
    caminar(nuevaRuta, vel, aviso) {
      ruta = nuevaRuta.slice();
      indiceRuta = 0;
      velocidad = vel;
      alLlegar = aviso;
    },
    mirarHacia(punto) {
      girarHacia(punto.x - raiz.position.x, punto.z - raiz.position.z);
    },
    visible(v) {
      raiz.setEnabled(v);
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      piezas.forEach((m) => m.dispose());
      raiz.dispose();
    },
  };
}