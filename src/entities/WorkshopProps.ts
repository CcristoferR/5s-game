import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Vector3 } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";

// ---------------------------------------------------------------------------
// Utilería de taller
// ---------------------------------------------------------------------------
//
// Mobiliario y objetos de fondo para el Nivel 3. Vive en su propio módulo y no
// dentro de Garaje.ts a propósito: el garaje lo comparten los cinco niveles, y
// llenarlo de utilería afectaría a todos. Acá cada nivel decide qué monta.
//
// Todo se coloca contra las paredes o fuera de la zona de juego. Nada de esto
// es interactivo: si algo tapara una mancha o se confundiera con una, estaría
// jugando en contra del ejercicio.

function material(scene: Scene, nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;

  // Grano en la rugosidad para todo lo que pase por acá. Una superficie
  // perfectamente uniforme se lee como plástico aunque el color sea correcto:
  // el reflejo la cubre por igual en vez de recorrerla. Los metales llevan
  // además el cepillado, porque el metal liso casi no existe en la realidad y
  // es lo que más delata una escena hecha con primitivas.
  mat.microSurfaceTexture = texturaGrano(scene, metalico >= 0.6 ? 0.14 : 0.07);
  if (metalico >= 0.6) {
    mat.albedoTexture = texturaMetalCepillado(scene);
    // El albedo se aclara porque ahora lo multiplica la textura, que ronda el
    // gris medio: sin esto el metal quedaría notoriamente más oscuro.
    mat.albedoColor = new Color3(
      Math.min(1, color.r * 1.35),
      Math.min(1, color.g * 1.35),
      Math.min(1, color.b * 1.35)
    );
  }

  return mat;
}

/** Estantería metálica con cajas y bidones. Llena la pared del fondo. */
export function crearEstanteriaTaller(scene: Scene, x: number, z: number, giroY: number): void {
  const raiz = new Mesh(`estanteria_${x}_${z}`, scene);
  raiz.position.set(x, 0, z);
  raiz.rotation.y = giroY;

  const matMetal = material(scene, `matEstanteria_${x}_${z}`, new Color3(0.36, 0.38, 0.4), 0.42, 0.7);
  const ANCHO = 2.2;
  const FONDO = 0.55;
  const ALTO = 2.1;

  // Montantes en las cuatro esquinas.
  [-1, 1].forEach((lx) => {
    [-1, 1].forEach((lz) => {
      const montante = MeshBuilder.CreateBox(`montante_${x}_${z}_${lx}_${lz}`, { width: 0.06, height: ALTO, depth: 0.06 }, scene);
      montante.position.set(lx * (ANCHO / 2 - 0.04), ALTO / 2, lz * (FONDO / 2 - 0.04));
      montante.material = matMetal;
      montante.parent = raiz;
      montante.receiveShadows = true;
    });
  });

  // Cuatro bandejas.
  for (let i = 0; i < 4; i++) {
    const bandeja = MeshBuilder.CreateBox(`bandeja_${x}_${z}_${i}`, { width: ANCHO, height: 0.035, depth: FONDO }, scene);
    bandeja.position.y = 0.22 + i * 0.6;
    bandeja.material = matMetal;
    bandeja.parent = raiz;
    bandeja.receiveShadows = true;
  }

  // Carga: cajas de cartón y bidones, con alturas y colores distintos para que
  // la estantería no se lea como una grilla repetida.
  const matCarton = material(scene, `matCartonEstante_${x}_${z}`, new Color3(0.55, 0.41, 0.27), 0.88);
  const matBidon = material(scene, `matBidonEstante_${x}_${z}`, new Color3(0.24, 0.42, 0.3), 0.55);

  const carga: Array<[number, number, number, PBRMaterial, number]> = [
    [-0.72, 0.82, 0.34, matCarton, 0.3],
    [-0.3, 0.82, 0.26, matCarton, 0.22],
    [0.55, 0.82, 0.3, matBidon, 0.34],
    [-0.6, 1.42, 0.3, matBidon, 0.32],
    [0.3, 1.42, 0.36, matCarton, 0.28],
    [0.8, 0.22, 0.4, matCarton, 0.36],
    [-0.85, 0.22, 0.34, matCarton, 0.3],
  ];

  carga.forEach(([px, py, ancho, mat, alto], i) => {
    const bulto = MeshBuilder.CreateBox(`bulto_${x}_${z}_${i}`, { width: ancho, height: alto, depth: 0.36 }, scene);
    bulto.position.set(px, py + alto / 2, (Math.random() - 0.5) * 0.1);
    bulto.rotation.y = (Math.random() - 0.5) * 0.25;
    bulto.material = mat;
    bulto.parent = raiz;
    bulto.receiveShadows = true;
  });
}

/** Tambores de aceite. Explican de dónde sale el aceite del nivel. */
export function crearTamboresAceite(scene: Scene, x: number, z: number): void {
  const matTambor = material(scene, `matTambor_${x}_${z}`, new Color3(0.16, 0.28, 0.42), 0.4, 0.55);
  const matAro = material(scene, `matAroTambor_${x}_${z}`, new Color3(0.12, 0.2, 0.3), 0.35, 0.7);

  const posiciones: Array<[number, number]> = [
    [0, 0],
    [0.68, 0.12],
    [0.34, -0.62],
  ];

  posiciones.forEach(([dx, dz], i) => {
    const tambor = MeshBuilder.CreateCylinder(`tambor_${x}_${z}_${i}`, { diameter: 0.58, height: 0.88, tessellation: 24 }, scene);
    tambor.position.set(x + dx, 0.44, z + dz);
    tambor.material = matTambor;
    tambor.receiveShadows = true;

    // Nervaduras: los tambores reales las tienen y ayudan a leer el cilindro.
    [0.3, 0.58].forEach((altura, j) => {
      const aro = MeshBuilder.CreateCylinder(`aroTambor_${x}_${z}_${i}_${j}`, { diameter: 0.6, height: 0.05, tessellation: 24 }, scene);
      aro.position.set(x + dx, altura, z + dz);
      aro.material = matAro;
    });

    const tapa = MeshBuilder.CreateCylinder(`tapaTambor_${x}_${z}_${i}`, { diameter: 0.59, height: 0.035, tessellation: 24 }, scene);
    tapa.position.set(x + dx, 0.885, z + dz);
    tapa.material = matAro;
  });
}

/** Pallet con cajas apiladas. */
export function crearPalletConCajas(scene: Scene, x: number, z: number): void {
  const matMadera = material(scene, `matPallet_${x}_${z}`, new Color3(0.5, 0.38, 0.24), 0.9);

  for (let i = 0; i < 5; i++) {
    const tabla = MeshBuilder.CreateBox(`tablaPallet_${x}_${z}_${i}`, { width: 1.2, height: 0.035, depth: 0.16 }, scene);
    tabla.position.set(x, 0.12, z - 0.5 + i * 0.25);
    tabla.material = matMadera;
    tabla.receiveShadows = true;
  }
  [-1, 1].forEach((lado, i) => {
    const larguero = MeshBuilder.CreateBox(`largueroPallet_${x}_${z}_${i}`, { width: 1.2, height: 0.1, depth: 0.1 }, scene);
    larguero.position.set(x, 0.05, z + lado * 0.45);
    larguero.material = matMadera;
  });

  const matCaja = material(scene, `matCajaPallet_${x}_${z}`, new Color3(0.57, 0.43, 0.29), 0.88);
  const cajas: Array<[number, number, number, number]> = [
    [-0.26, 0.28, 0.48, 0.32],
    [0.28, 0.28, 0.44, 0.32],
    [0.02, 0.6, 0.5, 0.3],
  ];
  cajas.forEach(([dx, py, ancho, alto], i) => {
    const caja = MeshBuilder.CreateBox(`cajaPallet_${x}_${z}_${i}`, { width: ancho, height: alto, depth: 0.44 }, scene);
    caja.position.set(x + dx, py, z);
    caja.rotation.y = (Math.random() - 0.5) * 0.2;
    caja.material = matCaja;
    caja.receiveShadows = true;
  });
}

/**
 * Carro de limpieza con balde y mopa.
 *
 * Es el objeto más importante de la utilería: le da sentido a la acción del
 * nivel. Ver las herramientas de limpieza en la escena hace que frotar el piso
 * se lea como una tarea del puesto y no como un minijuego pegado encima.
 */
export function crearCarroDeLimpieza(scene: Scene, x: number, z: number, giroY: number): void {
  const raiz = new Mesh(`carroLimpieza_${x}_${z}`, scene);
  raiz.position.set(x, 0, z);
  raiz.rotation.y = giroY;

  const matBalde = material(scene, `matBalde_${x}_${z}`, new Color3(0.85, 0.68, 0.12), 0.45);
  const matPlastico = material(scene, `matPlasticoCarro_${x}_${z}`, new Color3(0.2, 0.22, 0.25), 0.55);
  const matMetal = material(scene, `matMetalCarro_${x}_${z}`, new Color3(0.45, 0.47, 0.5), 0.35, 0.8);

  // Balde amarillo con escurridor.
  const balde = MeshBuilder.CreateCylinder(`balde_${x}_${z}`, { diameterTop: 0.44, diameterBottom: 0.36, height: 0.42, tessellation: 22 }, scene);
  balde.position.y = 0.28;
  balde.material = matBalde;
  balde.parent = raiz;
  balde.receiveShadows = true;

  const escurridor = MeshBuilder.CreateBox(`escurridor_${x}_${z}`, { width: 0.4, height: 0.16, depth: 0.2 }, scene);
  escurridor.position.set(0, 0.55, 0.06);
  escurridor.material = matPlastico;
  escurridor.parent = raiz;

  // Agua sucia adentro: detalle chico que cuenta que el balde está en uso.
  const agua = MeshBuilder.CreateCylinder(`aguaBalde_${x}_${z}`, { diameter: 0.4, height: 0.02, tessellation: 22 }, scene);
  agua.position.y = 0.4;
  agua.material = material(scene, `matAguaBalde_${x}_${z}`, new Color3(0.32, 0.34, 0.3), 0.12);
  agua.parent = raiz;

  // Base con ruedas.
  const base = MeshBuilder.CreateBox(`baseCarro_${x}_${z}`, { width: 0.5, height: 0.06, depth: 0.42 }, scene);
  base.position.y = 0.05;
  base.material = matPlastico;
  base.parent = raiz;

  [-1, 1].forEach((lx) => {
    [-1, 1].forEach((lz) => {
      const rueda = MeshBuilder.CreateCylinder(`ruedaCarro_${x}_${z}_${lx}_${lz}`, { diameter: 0.09, height: 0.04, tessellation: 12 }, scene);
      rueda.rotation.z = Math.PI / 2;
      rueda.position.set(lx * 0.19, 0.045, lz * 0.15);
      rueda.material = matMetal;
      rueda.parent = raiz;
    });
  });

  // Mopa apoyada en el borde, inclinada.
  const palo = MeshBuilder.CreateCylinder(`paloMopa_${x}_${z}`, { diameter: 0.035, height: 1.5, tessellation: 10 }, scene);
  palo.position.set(0.24, 0.82, -0.16);
  palo.rotation.z = -0.28;
  palo.rotation.x = 0.16;
  palo.material = matMetal;
  palo.parent = raiz;

  const cabezal = MeshBuilder.CreateBox(`cabezalMopa_${x}_${z}`, { width: 0.3, height: 0.1, depth: 0.13 }, scene);
  cabezal.position.set(0.47, 0.12, -0.36);
  cabezal.rotation.z = -0.28;
  cabezal.material = material(scene, `matCabezalMopa_${x}_${z}`, new Color3(0.72, 0.7, 0.62), 0.95);
  cabezal.parent = raiz;
  cabezal.receiveShadows = true;

  // Flecos de la mopa.
  for (let i = 0; i < 7; i++) {
    const fleco = MeshBuilder.CreateBox(`flecoMopa_${x}_${z}_${i}`, { width: 0.03, height: 0.13, depth: 0.02 }, scene);
    fleco.position.set(0.4 + i * 0.022, 0.07, -0.36 + (Math.random() - 0.5) * 0.08);
    fleco.rotation.z = -0.28 + (Math.random() - 0.5) * 0.2;
    fleco.material = material(scene, `matFlecoMopa_${x}_${z}_${i}`, new Color3(0.68, 0.66, 0.58), 0.95);
    fleco.parent = raiz;
  }
}

/** Cartel plegable de piso mojado. */
export function crearSenalPisoMojado(scene: Scene, x: number, z: number, giroY: number): void {
  const raiz = new Mesh(`senalPiso_${x}_${z}`, scene);
  raiz.position.set(x, 0, z);
  raiz.rotation.y = giroY;

  const tex = new DynamicTexture(`texSenalPiso_${x}_${z}`, { width: 256, height: 384 }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#e8b511";
  ctx.fillRect(0, 0, 256, 384);

  // Figura resbalando, dibujada con formas simples: se lee a la distancia
  // mejor que cualquier texto.
  ctx.fillStyle = "#1c1c1a";
  ctx.beginPath();
  ctx.arc(128, 96, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(128, 150);
  ctx.rotate(-0.45);
  ctx.fillRect(-16, -22, 32, 76);
  ctx.restore();
  ctx.fillRect(70, 236, 96, 15);
  ctx.save();
  ctx.translate(150, 210);
  ctx.rotate(0.7);
  ctx.fillRect(-11, 0, 22, 62);
  ctx.restore();

  ctx.fillStyle = "#1c1c1a";
  ctx.fillRect(20, 300, 216, 10);
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PISO", 128, 348);
  tex.update();

  const matCartel = material(scene, `matSenalPiso_${x}_${z}`, new Color3(1, 1, 1), 0.5);
  matCartel.albedoTexture = tex;
  matCartel.backFaceCulling = false;

  // Dos paños en A.
  [-1, 1].forEach((lado, i) => {
    const pano = MeshBuilder.CreateBox(`panoSenal_${x}_${z}_${i}`, { width: 0.34, height: 0.62, depth: 0.02 }, scene);
    pano.position.set(0, 0.32, lado * 0.09);
    pano.rotation.x = lado * 0.24;
    pano.material = matCartel;
    pano.parent = raiz;
    pano.receiveShadows = true;
  });
}

/**
 * Goteo continuo desde el punto de fuga hasta el piso.
 *
 * Es la pieza que conecta causa y efecto: el jugador ve caer el aceite justo
 * sobre la mancha que después tiene que limpiar. Sin esto, la pregunta de causa
 * raíz del final del nivel se responde por descarte; con esto, se responde por
 * haber mirado.
 */
export function crearGoteoDeFuga(scene: Scene, origen: Vector3, alturaPiso = 0.02): void {
  const matGota = material(scene, "matGotaFuga", new Color3(0.1, 0.07, 0.03), 0.08, 0.3);

  const gota = MeshBuilder.CreateSphere("gotaFuga", { diameter: 0.055, segments: 8 }, scene);
  gota.material = matGota;
  gota.isPickable = false;
  gota.scaling.y = 1.5;
  gota.position.copyFrom(origen);

  let velocidad = 0;
  let esperandoDesde = performance.now();
  let cayendo = false;

  scene.onBeforeRenderObservable.add(() => {
    if (gota.isDisposed()) return;

    if (!cayendo) {
      // Pausa entre gota y gota: un goteo continuo sería una manguera, no una
      // fuga, y perdería el efecto de "esto lleva tiempo pasando".
      if (performance.now() - esperandoDesde > 1900) {
        cayendo = true;
        velocidad = 0;
        gota.position.copyFrom(origen);
        gota.scaling.set(1, 1.5, 1);
        gota.isVisible = true;
      }
      return;
    }

    velocidad += 0.0016;
    gota.position.y -= velocidad;
    // Se estira al acelerar, como una gota real.
    gota.scaling.y = 1.5 + velocidad * 14;

    if (gota.position.y <= alturaPiso) {
      cayendo = false;
      gota.isVisible = false;
      esperandoDesde = performance.now();
      salpicarImpacto(scene, new Vector3(origen.x, alturaPiso, origen.z), matGota);
    }
  });
}

/** Onda breve al impactar la gota contra el piso. */
function salpicarImpacto(scene: Scene, punto: Vector3, matBase: PBRMaterial): void {
  const onda = MeshBuilder.CreateTorus(`ondaImpacto_${Date.now()}`, { diameter: 0.08, thickness: 0.012, tessellation: 16 }, scene);
  onda.position.copyFrom(punto);
  onda.position.y += 0.004;
  onda.isPickable = false;

  const mat = matBase.clone(`matOnda_${Date.now()}`)!;
  mat.alpha = 0.8;
  onda.material = mat;

  const nacimiento = performance.now();
  const observador = scene.onBeforeRenderObservable.add(() => {
    if (onda.isDisposed()) {
      scene.onBeforeRenderObservable.remove(observador);
      return;
    }
    const avance = (performance.now() - nacimiento) / 480;
    onda.scaling.setAll(1 + avance * 2.6);
    mat.alpha = 0.8 * (1 - avance);

    if (avance >= 1) {
      scene.onBeforeRenderObservable.remove(observador);
      onda.dispose();
      mat.dispose();
    }
  });
}