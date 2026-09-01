import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  DynamicTexture,
  Color3,
  Mesh,
  Vector3,
} from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";

/**
 * Objetos que aparecen en más de un nivel, y las utilidades para construirlos.
 *
 * ─── POR QUÉ ESTE ARCHIVO ─────────────────────────────────────────────────
 *
 * La engrapadora, la carpeta y el manual existen en el Nivel 1 y en el 2. Hasta
 * ahora cada nivel construía el suyo por separado, y el resultado era que el
 * mismo objeto se veía distinto según dónde estuviera: la engrapadora del Nivel
 * 1 medía 46 cm y la del Nivel 2, 21. Una diferencia de más del doble en un
 * objeto que el jugador acaba de ver hace un minuto.
 *
 * Construirlos una sola vez acá garantiza que sean idénticos, y de paso obliga
 * a que cualquier mejora beneficie a los dos niveles a la vez.
 *
 * ─── ESCALA ───────────────────────────────────────────────────────────────
 *
 * Todos los objetos se modelan a su medida real multiplicada por FACTOR_JUEGO.
 * La medida real es lo que hace que la escena se lea bien —una engrapadora al
 * lado de una taza tiene que verse como se ven de verdad— y el factor da el
 * margen de holgura que hace falta para poder agarrarlos con el puntero sin
 * pelear.
 *
 * ─── REGLAS DE CONSTRUCCIÓN ───────────────────────────────────────────────
 *
 *  1. UNA SOLA MALLA. Todo se fusiona. Las piezas colgadas como hijas no las
 *     detecta el sistema de arrastre: se ven, pero al hacerles clic no pasa
 *     nada. Dos objetos del Nivel 1 tenían exactamente ese defecto y eran
 *     imposibles de clasificar.
 *
 *  2. APOYA SOBRE LA MESA. El punto más bajo queda en y = 0.
 *
 *  3. SE RECONOCE DE UN VISTAZO. La silueta primero, el detalle después.
 */

/** Holgura sobre la medida real, para poder agarrarlos cómodamente. */
export const FACTOR_JUEGO = 1.25;

/** Separación mínima con la mesa, para que no se vea el objeto incrustado. */
export const APOYO = 0.002;

/** Convierte centímetros reales a la escala del juego. */
export function cm(centimetros: number): number {
  return (centimetros / 100) * FACTOR_JUEGO;
}

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------

export function material(
  scene: Scene,
  nombre: string,
  color: Color3,
  rugosidad: number,
  metalico = 0,
  barnizado = false
): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;

  // Grano en la rugosidad para todo: una superficie perfectamente uniforme se
  // lee como plástico aunque el color sea correcto, porque el reflejo la cubre
  // por igual en vez de recorrerla.
  mat.microSurfaceTexture = texturaGrano(scene, metalico >= 0.6 ? 0.14 : 0.07);

  if (metalico >= 0.6) {
    mat.albedoTexture = texturaMetalCepillado(scene);
    // El albedo se aclara porque ahora lo multiplica una textura que ronda el
    // gris medio: sin esto el metal quedaría notoriamente más oscuro.
    mat.albedoColor = new Color3(
      Math.min(1, color.r * 1.35),
      Math.min(1, color.g * 1.35),
      Math.min(1, color.b * 1.35)
    );
  }

  if (barnizado) {
    // Capa de barniz: el reflejo nítido que separa una loza o un plástico
    // brillante de una superficie mate.
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = 0.6;
    mat.clearCoat.roughness = 0.15;
  }

  return mat;
}

/**
 * Material con un dibujo pintado a mano en un lienzo.
 *
 * Es lo que convierte un taco de hojas en "un diario viejo" y una caja en "una
 * caja sin etiqueta". Sale mucho más barato que modelar esos detalles y se lee
 * muchísimo mejor: el jugador reconoce el objeto por lo que dice, no solo por
 * su forma.
 */
export function materialPintado(
  scene: Scene,
  nombre: string,
  anchoPx: number,
  altoPx: number,
  dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): PBRMaterial {
  const textura = new DynamicTexture(`tex_${nombre}`, { width: anchoPx, height: altoPx }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  dibujar(ctx, anchoPx, altoPx);
  textura.update();

  const mat = new PBRMaterial(nombre, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.85;
  mat.metallic = 0;
  mat.backFaceCulling = false;
  return mat;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

export function caja(
  scene: Scene,
  nombre: string,
  ancho: number,
  alto: number,
  fondo: number,
  x: number,
  y: number,
  z: number,
  mat: PBRMaterial
): Mesh {
  const mesh = MeshBuilder.CreateBox(nombre, { width: ancho, height: alto, depth: fondo }, scene);
  mesh.position.set(x, y, z);
  mesh.material = mat;
  return mesh;
}

export function cilindro(
  scene: Scene,
  nombre: string,
  diametro: number,
  altura: number,
  x: number,
  y: number,
  z: number,
  mat: PBRMaterial,
  lados = 20
): Mesh {
  const mesh = MeshBuilder.CreateCylinder(
    nombre,
    { diameter: diametro, height: altura, tessellation: lados },
    scene
  );
  mesh.position.set(x, y, z);
  mesh.material = mat;
  return mesh;
}

/** Lámina plana horizontal. Se usa para pegar los dibujos sobre los objetos. */
export function lamina(
  scene: Scene,
  nombre: string,
  ancho: number,
  fondo: number,
  x: number,
  y: number,
  z: number,
  mat: PBRMaterial
): Mesh {
  const mesh = MeshBuilder.CreatePlane(nombre, { width: ancho, height: fondo }, scene);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.material = mat;
  return mesh;
}

/** Lámina vertical, para las caras frontales de cajas y carpetas. */
export function laminaVertical(
  scene: Scene,
  nombre: string,
  ancho: number,
  alto: number,
  x: number,
  y: number,
  z: number,
  mat: PBRMaterial
): Mesh {
  const mesh = MeshBuilder.CreatePlane(nombre, { width: ancho, height: alto }, scene);
  mesh.position.set(x, y, z);
  mesh.material = mat;
  return mesh;
}

/**
 * Fusiona las piezas en una sola malla.
 *
 * Es obligatorio para cualquier objeto arrastrable. El sistema de arrastre solo
 * reconoce la malla raíz: si las piezas quedan como hijas, el objeto se ve pero
 * al hacerle clic no pasa nada.
 */
export function fusionar(partes: Mesh[], id: string): Mesh {
  const mesh = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  mesh.name = id;
  return mesh;
}

// ---------------------------------------------------------------------------
// ENGRAPADORA — Nivel 1 y Nivel 2
// ---------------------------------------------------------------------------

/**
 * Engrapadora de escritorio, 16 cm de largo.
 *
 * La silueta es lo que la identifica: base baja y alargada, morro redondeado y
 * brazo superior algo levantado por delante. Ese perfil se reconoce incluso a
 * contraluz, y por eso la construcción parte de ahí antes que del detalle.
 */
export function crearEngrapadora(scene: Scene, id: string): Mesh {
  const matCuerpo = material(scene, `matCuerpoEng_${id}`, new Color3(0.09, 0.10, 0.12), 0.3, 0.15, true);
  const matAcero = material(scene, `matAceroEng_${id}`, new Color3(0.55, 0.57, 0.60), 0.2, 0.85);
  const matGoma = material(scene, `matGomaEng_${id}`, new Color3(0.05, 0.05, 0.06), 0.92);

  const LARGO = cm(16);
  const ANCHO = cm(4.6);
  const partes: Mesh[] = [];

  // Patas de goma: separan el cuerpo del tablero, como una de verdad.
  [-1, 1].forEach((lado, i) => {
    partes.push(
      caja(scene, `pataEng_${id}_${i}`, cm(2.2), cm(0.4), ANCHO * 0.85,
        lado * LARGO * 0.34, APOYO + cm(0.2), 0, matGoma)
    );
  });

  const yBase = APOYO + cm(0.4);

  // Base.
  partes.push(caja(scene, `baseEng_${id}`, LARGO * 0.92, cm(1.5), ANCHO, 0, yBase + cm(0.75), 0, matCuerpo));

  // Morro redondeado del frente: sin esto la base se lee como un ladrillo.
  const morro = cilindro(scene, `morroEng_${id}`, ANCHO, cm(1.5), LARGO * 0.46, yBase + cm(0.75), 0, matCuerpo);
  morro.rotation.x = Math.PI / 2;
  morro.rotation.z = Math.PI / 2;
  partes.push(morro);

  // Yunque: la placa metálica que dobla la grapa. Es el detalle que identifica
  // el objeto de inmediato para quien haya usado una.
  partes.push(caja(scene, `yunqueEng_${id}`, cm(3.4), cm(0.25), ANCHO * 0.8, LARGO * 0.36, yBase + cm(1.6), 0, matAcero));
  partes.push(caja(scene, `ranuraEng_${id}`, cm(1.5), cm(0.3), cm(0.6), LARGO * 0.36, yBase + cm(1.65), 0, matGoma));

  // Bisagra trasera.
  const bisagra = cilindro(scene, `bisagraEng_${id}`, cm(1.3), ANCHO * 0.95, -LARGO * 0.42, yBase + cm(1.9), 0, matAcero);
  bisagra.rotation.x = Math.PI / 2;
  partes.push(bisagra);

  // Brazo superior, levantado por delante: la silueta clásica.
  const brazo = caja(scene, `brazoEng_${id}`, LARGO * 0.86, cm(1.4), ANCHO * 0.88, 0, yBase + cm(2.7), 0, matCuerpo);
  brazo.rotation.z = 0.085;
  partes.push(brazo);

  const tapaBrazo = caja(scene, `tapaEng_${id}`, LARGO * 0.66, cm(0.35), ANCHO * 0.5, cm(0.4), yBase + cm(3.6), 0, matAcero);
  tapaBrazo.rotation.z = 0.085;
  partes.push(tapaBrazo);

  // Cargador de grapas asomando por el costado.
  const cargador = caja(scene, `cargadorEng_${id}`, LARGO * 0.6, cm(0.6), cm(0.9), cm(0.5), yBase + cm(2.15), ANCHO * 0.46, matAcero);
  cargador.rotation.z = 0.085;
  partes.push(cargador);

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// CARPETA — Nivel 1 y Nivel 2
// ---------------------------------------------------------------------------

/**
 * Carpeta de proyecto, tamaño carta.
 *
 * La etiqueta escrita es lo que la distingue de "papeles sueltos": dice que hay
 * un proyecto en curso, o sea que es material vigente. Sin ella, una carpeta y
 * un diario viejo se ven igual desde arriba.
 */
export function crearCarpeta(scene: Scene, id: string, titulo = "PROYECTO ACTIVO"): Mesh {
  const matCarton = material(scene, `matCartonCar_${id}`, new Color3(0.78, 0.60, 0.26), 0.88);
  const matPapel = material(scene, `matPapelCar_${id}`, new Color3(0.95, 0.95, 0.92), 0.92);
  const matClip = material(scene, `matClipCar_${id}`, new Color3(0.55, 0.57, 0.60), 0.22, 0.85);

  const matEtiqueta = materialPintado(scene, `matEtiqCar_${id}`, 320, 128, (ctx, w, h) => {
    ctx.fillStyle = "#f7f5ee";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#c9b78e";
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // Franja de color arriba: es lo que hace que la etiqueta se lea como
    // etiqueta y no como un papel pegado.
    ctx.fillStyle = "#2f6d4a";
    ctx.fillRect(5, 5, w - 10, 14);

    ctx.fillStyle = "#2b3138";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.textAlign = "center";

    const palabras = titulo.split(" ");
    if (palabras.length > 1) {
      ctx.fillText(palabras[0], w / 2, 62);
      ctx.fillText(palabras.slice(1).join(" "), w / 2, 102);
    } else {
      ctx.fillText(titulo, w / 2, 82);
    }
  });

  const ANCHO = cm(23);
  const FONDO = cm(31);
  const partes: Mesh[] = [];

  partes.push(caja(scene, `tapaAbajoCar_${id}`, ANCHO, cm(0.4), FONDO, 0, APOYO + cm(0.2), 0, matCarton));

  // Hojas apenas desalineadas: lo que delata que la carpeta se usa.
  for (let i = 0; i < 4; i++) {
    const hoja = caja(scene, `hojaCar_${id}_${i}`, ANCHO * 0.94, cm(0.22), FONDO * 0.94,
      cm(0.25) * (i - 1.5), APOYO + cm(0.55) + i * cm(0.25), cm(0.2) * i, matPapel);
    hoja.rotation.y = (i - 1.5) * 0.014;
    partes.push(hoja);
  }

  const tapaArriba = caja(scene, `tapaArribaCar_${id}`, ANCHO, cm(0.4), FONDO, 0, APOYO + cm(1.8), 0, matCarton);
  tapaArriba.rotation.x = 0.02;
  partes.push(tapaArriba);

  // Lomo redondeado: sin esto la carpeta se lee como una tabla, no como dos
  // tapas plegadas sobre un contenido.
  const lomo = cilindro(scene, `lomoCar_${id}`, cm(2), FONDO, -ANCHO / 2, APOYO + cm(1), 0, matCarton, 14);
  lomo.rotation.x = Math.PI / 2;
  partes.push(lomo);

  // Pestaña con la etiqueta impresa.
  partes.push(caja(scene, `pestanaCar_${id}`, cm(8), cm(0.4), cm(3.4), ANCHO * 0.22, APOYO + cm(2), FONDO * 0.36, matCarton));
  partes.push(lamina(scene, `etiqCar_${id}`, cm(7), cm(2.8), ANCHO * 0.22, APOYO + cm(2.22), FONDO * 0.36, matEtiqueta));

  // Clip metálico sujetando documentos.
  partes.push(caja(scene, `clipCar_${id}`, cm(3.4), cm(0.9), cm(2), -ANCHO * 0.1, APOYO + cm(2.4), -FONDO * 0.3, matClip));
  partes.push(caja(scene, `clipLabioCar_${id}`, cm(3.4), cm(0.3), cm(0.8), -ANCHO * 0.1, APOYO + cm(2), -FONDO * 0.24, matClip));

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// MANUAL — Nivel 1 y Nivel 2
// ---------------------------------------------------------------------------

/**
 * Manual de procedimientos, con espiral y separadores.
 *
 * El espiral es la señal más económica de "documento de consulta": un libro
 * encuadernado se lee de principio a fin, uno espiralado se abre en la página
 * que hace falta. Y los separadores de colores dicen que está en uso.
 */
export function crearManual(scene: Scene, id: string, tituloArriba = "MANUAL"): Mesh {
  const matTapa = material(scene, `matTapaMan_${id}`, new Color3(0.16, 0.26, 0.38), 0.7);
  const matHoja = material(scene, `matHojaMan_${id}`, new Color3(0.93, 0.93, 0.90), 0.92);
  const matEspiral = material(scene, `matEspiralMan_${id}`, new Color3(0.5, 0.52, 0.55), 0.25, 0.85);

  const matPortada = materialPintado(scene, `matPortadaMan_${id}`, 320, 420, (ctx, w, h) => {
    ctx.fillStyle = "#2a4560";
    ctx.fillRect(0, 0, w, h);

    // Banda superior y filete: estructura de portada técnica.
    ctx.fillStyle = "#1b2d40";
    ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = "#d4a843";
    ctx.fillRect(0, 96, w, 6);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tituloArriba, w / 2, 62);

    ctx.font = "22px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("DE PROCEDIMIENTOS", w / 2, 150);

    // Renglones simulando el índice.
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let i = 0; i < 7; i++) {
      const ancho = i % 3 === 2 ? w * 0.4 : w * 0.62;
      ctx.fillRect(w * 0.19, 200 + i * 26, ancho, 7);
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("ÁREA DE OPERACIONES", w / 2, h - 34);
  });

  const ANCHO = cm(21);
  const FONDO = cm(28);
  const partes: Mesh[] = [];

  partes.push(caja(scene, `contraMan_${id}`, ANCHO, cm(0.35), FONDO, 0, APOYO + cm(0.175), 0, matTapa));

  for (let i = 0; i < 5; i++) {
    partes.push(
      caja(scene, `hojaMan_${id}_${i}`, ANCHO * 0.96, cm(0.16), FONDO * 0.96, 0, APOYO + cm(0.45) + i * cm(0.18), 0, matHoja)
    );
  }

  const yTapa = APOYO + cm(1.5);
  partes.push(caja(scene, `tapaMan_${id}`, ANCHO, cm(0.35), FONDO, 0, yTapa, 0, matTapa));
  partes.push(lamina(scene, `portadaMan_${id}`, ANCHO * 0.98, FONDO * 0.98, 0, yTapa + cm(0.2), 0, matPortada));

  // Espiral: anillos a lo largo del lomo.
  for (let i = 0; i < 11; i++) {
    const anillo = MeshBuilder.CreateTorus(
      `anilloMan_${id}_${i}`,
      { diameter: cm(1.5), thickness: cm(0.22), tessellation: 12 },
      scene
    );
    anillo.rotation.z = Math.PI / 2;
    anillo.position.set(-ANCHO / 2, APOYO + cm(0.85), -FONDO * 0.42 + i * (FONDO * 0.084));
    anillo.material = matEspiral;
    partes.push(anillo);
  }

  // Separadores de colores asomando: dicen que el manual se consulta.
  const colores = [new Color3(0.85, 0.3, 0.25), new Color3(0.9, 0.7, 0.2), new Color3(0.3, 0.6, 0.4)];
  colores.forEach((color, i) => {
    partes.push(
      caja(scene, `sepMan_${id}_${i}`, cm(2.4), cm(0.14), FONDO * 0.9,
        ANCHO * 0.44, APOYO + cm(0.55) + i * cm(0.3), 0,
        material(scene, `matSepMan_${id}_${i}`, color, 0.75))
    );
  });

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// TAZA — base compartida para la de café y la de lápices
// ---------------------------------------------------------------------------

/**
 * Taza de loza con hueco real, torneada por revolución.
 *
 * El hueco importa: es lo que permite que se le vea el contenido —café
 * estancado en un caso, lápices en el otro— y lo que la separa de un cilindro
 * macizo pintado de blanco.
 */
export function crearTazaBase(
  scene: Scene,
  id: string,
  colorLoza: Color3,
  conAsa: boolean
): { partes: Mesh[]; radioInterior: number; alturaInterior: number } {
  const matLoza = material(scene, `matLozaTaza_${id}`, colorLoza, 0.14, 0, true);

  const R = cm(4.2);
  const ALTO = cm(10);
  const PARED = cm(0.5);

  const perfil = [
    new Vector3(0, 0, 0),
    new Vector3(R * 0.82, 0, 0),
    new Vector3(R * 0.9, ALTO * 0.06, 0),
    new Vector3(R, ALTO * 0.45, 0),
    new Vector3(R, ALTO, 0),
    new Vector3(R - PARED, ALTO, 0),
    new Vector3(R - PARED, ALTO * 0.5, 0),
    new Vector3(R - PARED * 1.3, ALTO * 0.12, 0),
    new Vector3(0, ALTO * 0.1, 0),
  ];

  const cuerpo = MeshBuilder.CreateLathe(
    `cuerpoTaza_${id}`,
    { shape: perfil, tessellation: 36, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  cuerpo.position.y = APOYO;
  cuerpo.material = matLoza;

  const partes: Mesh[] = [cuerpo];

  if (conAsa) {
    // El asa se construye como un tubo en forma de C y no como un anillo
    // completo.
    //
    // Con el anillo, media rosca quedaba metida dentro de la pared de la taza:
    // las dos superficies compartían el mismo espacio y la tarjeta gráfica no
    // tiene forma de decidir cuál va delante. Al girar la cámara, el asa
    // parpadeaba y se veía atravesada por la loza. Es el defecto clásico de
    // dos mallas superpuestas.
    //
    // Un arco que arranca y termina en la pared, sin meterse, no tiene ese
    // problema y además es la forma real de un asa.
    const RADIO_ASA = cm(2.9);
    const centroAsa = new Vector3(R * 0.88, APOYO + ALTO * 0.55, 0);

    const camino: Vector3[] = [];
    // De -100° a 100°: deja los dos extremos apoyados contra la pared y el
    // arco hacia afuera, que es por donde entran los dedos.
    for (let i = 0; i <= 18; i++) {
      const angulo = (-100 + (200 * i) / 18) * (Math.PI / 180);
      camino.push(
        new Vector3(
          centroAsa.x + Math.cos(angulo) * RADIO_ASA,
          centroAsa.y + Math.sin(angulo) * RADIO_ASA,
          0
        )
      );
    }

    const asa = MeshBuilder.CreateTube(
      `asaTaza_${id}`,
      { path: camino, radius: cm(0.55), tessellation: 12, cap: Mesh.CAP_ALL },
      scene
    );
    asa.material = matLoza;
    partes.push(asa);
  }

  return { partes, radioInterior: R - PARED, alturaInterior: ALTO * 0.1 };
}