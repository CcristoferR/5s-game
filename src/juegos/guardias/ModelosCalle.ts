import {
  Scene,
  Mesh,
  MeshBuilder,
  VertexData,
  TransformNode,
  PBRMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  Texture,
} from "@babylonjs/core";
import { crearAzar } from "./TexturasPBR";

// ===========================================================================
// Modelos de la calle: vehículos, árboles y faroles
// ===========================================================================
//
// Los usan dos sitios que antes eran dibujos planos: la calle que se ve por
// el ventanal y las cuatro cámaras del monitor. Que compartan modelo no es
// ahorro: es coherencia. La camioneta que se detiene en la reja por la CAM 01
// es la misma pieza que está estacionada frente al condominio, con la misma
// silueta y el mismo brillo de pintura mojada.
//
// Todo se construye con primitivas y perfiles extruidos, sin archivos. A la
// distancia a la que se ven —veinte metros por el ventanal, una imagen de
// quinientos píxeles en una cámara— lo que se lee es la silueta, el brillo del
// barniz y las luces. Eso es lo que está trabajado.

/**
 * Un perfil convexo en el plano XY, extruido a lo ancho de Z.
 *
 * Es la forma de hacer una carrocería con cuatro números: el lateral del auto
 * es un polígono, y el volumen sale de darle ancho. Cada cara lleva sus
 * propios vértices, así las aristas quedan vivas y el sombreado es plano, que
 * es como se ve la chapa de un vehículo con reflejos.
 *
 * El perfil va en sentido antihorario visto desde +Z. El orden de los índices
 * sigue la convención de Babylon (la de CreatePlane): una cara es frontal
 * cuando sus vértices giran en sentido antihorario vistos desde fuera.
 */
export function prismaDePerfil(scene: Scene, nombre: string, perfil: [number, number][], ancho: number): Mesh {
  const n = perfil.length;
  const posiciones: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const z0 = -ancho / 2;
  const z1 = ancho / 2;

  const tapa = (z: number, haciaMas: boolean): void => {
    const inicio = posiciones.length / 3;
    perfil.forEach(([x, y]) => {
      posiciones.push(x, y, z);
      uvs.push(x, y);
    });
    for (let i = 1; i < n - 1; i++) {
      if (haciaMas) indices.push(inicio, inicio + i + 1, inicio + i);
      else indices.push(inicio, inicio + i, inicio + i + 1);
    }
  };
  tapa(z1, true);
  tapa(z0, false);

  let recorrido = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = perfil[i];
    const [bx, by] = perfil[(i + 1) % n];
    const largo = Math.hypot(bx - ax, by - ay);
    const k = posiciones.length / 3;
    posiciones.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z1);
    uvs.push(recorrido, 0, recorrido + largo, 0, recorrido + largo, ancho, recorrido, ancho);
    indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
    recorrido += largo;
  }

  const normales: number[] = [];
  VertexData.ComputeNormals(posiciones, indices, normales);
  const datos = new VertexData();
  datos.positions = posiciones;
  datos.indices = indices;
  datos.normals = normales;
  datos.uvs = uvs;

  const malla = new Mesh(nombre, scene);
  datos.applyToMesh(malla);
  return malla;
}

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------

export interface Vehiculo {
  raiz: TransformNode;
  mallas: Mesh[];
  /** Las cuatro ruedas, para girarlas al avanzar. */
  ruedas: TransformNode[];
  /** Radio de la rueda, para convertir distancia en giro. */
  radioRueda: number;
  faros: PBRMaterial;
  traseras: PBRMaterial;
  intermitentes: PBRMaterial;
  /** Posiciones locales de los faros, por si hay que colgarles un foco. */
  posicionFaros: Vector3[];
}

export interface OpcionesVehiculo {
  color: Color3;
  /** Texto de la patente. Null para un vehículo sin patente visible. */
  patente?: string | null;
  /** Entorno reflejado por la chapa. Bajo fuera, donde la sonda es de la sala. */
  entorno?: number;
}

function patenteDe(scene: Scene, nombre: string, texto: string): PBRMaterial {
  const tex = new DynamicTexture(`tex_${nombre}`, { width: 256, height: 64 }, scene, true);
  tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  tex.anisotropicFilteringLevel = 16;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#f2f2ec";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "#20242a";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 58);
  ctx.fillStyle = "#15181c";
  ctx.font = "bold 40px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 128, 35);
  tex.update();

  const mat = new PBRMaterial(`mat_${nombre}`, scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.6;
  mat.metallic = 0;
  // Las patentes son retrorreflectantes: devuelven la luz hacia donde viene,
  // y por eso de noche se leen aunque el resto del auto esté en penumbra.
  mat.emissiveTexture = tex;
  mat.emissiveColor = new Color3(0.22, 0.22, 0.22);
  return mat;
}

/**
 * Una camioneta tipo SUV: el vehículo de las visitas y del estacionamiento.
 *
 * El eje largo va en +X (el frente mira a +X). Mide 4,7 × 1,85 × 1,7 m.
 */
export function crearVehiculo(scene: Scene, nombre: string, o: OpcionesVehiculo): Vehiculo {
  const raiz = new TransformNode(nombre, scene);
  const mallas: Mesh[] = [];
  const colgar = (m: Mesh): Mesh => {
    m.parent = raiz;
    mallas.push(m);
    return m;
  };
  const entorno = o.entorno ?? 0.35;

  const chapa = new PBRMaterial(`${nombre}_chapa`, scene);
  chapa.albedoColor = o.color;
  chapa.metallic = 0.45;
  chapa.roughness = 0.38;
  // Pintura de auto: base metalizada y barniz encima. De noche y mojada, el
  // barniz es lo único que se ve de la chapa — las luces corriendo por ella.
  chapa.clearCoat.isEnabled = true;
  chapa.clearCoat.intensity = 1;
  chapa.clearCoat.roughness = 0.06;
  chapa.environmentIntensity = entorno;

  const vidrio = new PBRMaterial(`${nombre}_vidrio`, scene);
  vidrio.albedoColor = new Color3(0.012, 0.014, 0.018);
  vidrio.metallic = 0.2;
  vidrio.roughness = 0.04;
  vidrio.environmentIntensity = entorno * 1.6;

  const goma = new PBRMaterial(`${nombre}_goma`, scene);
  goma.albedoColor = new Color3(0.02, 0.02, 0.022);
  goma.roughness = 0.88;
  goma.metallic = 0;

  const plastico = new PBRMaterial(`${nombre}_plastico`, scene);
  plastico.albedoColor = new Color3(0.03, 0.032, 0.035);
  plastico.roughness = 0.55;
  plastico.metallic = 0;
  plastico.environmentIntensity = entorno;

  const llanta = new PBRMaterial(`${nombre}_llanta`, scene);
  llanta.albedoColor = new Color3(0.55, 0.56, 0.58);
  llanta.metallic = 0.9;
  llanta.roughness = 0.3;
  llanta.environmentIntensity = entorno;

  const luz = (sufijo: string, color: Color3): PBRMaterial => {
    const m = new PBRMaterial(`${nombre}_${sufijo}`, scene);
    m.albedoColor = color.scale(0.35);
    m.roughness = 0.15;
    m.metallic = 0;
    m.emissiveColor = new Color3(0, 0, 0);
    return m;
  };
  const faros = luz("faros", new Color3(1, 0.97, 0.9));
  const traseras = luz("traseras", new Color3(0.7, 0.04, 0.03));
  const intermitentes = luz("intermitentes", new Color3(0.9, 0.5, 0.05));

  // --- Carrocería --------------------------------------------------------------
  const cuerpo = colgar(
    prismaDePerfil(
      scene,
      `${nombre}_cuerpo`,
      [
        [-2.35, 0.3],
        [2.25, 0.3],
        [2.38, 0.55],
        [2.32, 0.86],
        [1.1, 0.98],
        [-2.3, 1.02],
        [-2.4, 0.62],
      ],
      1.85
    )
  );
  cuerpo.material = chapa;

  const cabina = colgar(
    prismaDePerfil(
      scene,
      `${nombre}_cabina`,
      [
        [-2.0, 0.99],
        [0.95, 0.99],
        [0.25, 1.62],
        [-1.85, 1.66],
      ],
      1.66
    )
  );
  cabina.material = vidrio;

  const techo = colgar(MeshBuilder.CreateBox(`${nombre}_techo`, { width: 2.1, height: 0.06, depth: 1.62 }, scene));
  techo.position.set(-0.8, 1.66, 0);
  techo.material = chapa;

  // Pilares: sin ellos la cabina es un bloque de vidrio negro.
  [
    [0.62, 1.3, 0.12],
    [-0.8, 1.32, 0.1],
    [-1.92, 1.32, 0.14],
  ].forEach(([x, y, a], i) => {
    [-1, 1].forEach((lado) => {
      const pilar = colgar(MeshBuilder.CreateBox(`${nombre}_pilar_${i}_${lado}`, { width: a, height: 0.66, depth: 0.04 }, scene));
      pilar.position.set(x, y, lado * 0.84);
      pilar.rotation.z = i === 0 ? 0.72 : i === 2 ? -0.08 : 0;
      pilar.material = chapa;
    });
  });

  // Paragolpes, parrilla y espejos.
  [
    [2.36, 0.42, 2.0, 0.22],
    [-2.39, 0.42, 2.0, 0.22],
  ].forEach(([x, y, ancho, alto], i) => {
    const p = colgar(MeshBuilder.CreateBox(`${nombre}_paragolpes_${i}`, { width: 0.16, height: alto, depth: ancho }, scene));
    p.position.set(x, y, 0);
    p.material = plastico;
  });
  const parrilla = colgar(MeshBuilder.CreateBox(`${nombre}_parrilla`, { width: 0.04, height: 0.2, depth: 0.9 }, scene));
  parrilla.position.set(2.37, 0.68, 0);
  parrilla.material = plastico;
  [-1, 1].forEach((lado) => {
    const espejo = colgar(MeshBuilder.CreateBox(`${nombre}_espejo_${lado}`, { width: 0.14, height: 0.12, depth: 0.2 }, scene));
    espejo.position.set(0.72, 1.08, lado * 1.0);
    espejo.material = chapa;
  });

  // --- Luces -------------------------------------------------------------------
  const posicionFaros: Vector3[] = [];
  [-1, 1].forEach((lado) => {
    const faro = colgar(MeshBuilder.CreateBox(`${nombre}_faro_${lado}`, { width: 0.06, height: 0.13, depth: 0.34 }, scene));
    faro.position.set(2.34, 0.78, lado * 0.62);
    faro.material = faros;
    posicionFaros.push(faro.position.clone());

    const trasera = colgar(MeshBuilder.CreateBox(`${nombre}_trasera_${lado}`, { width: 0.05, height: 0.22, depth: 0.2 }, scene));
    trasera.position.set(-2.4, 0.82, lado * 0.76);
    trasera.material = traseras;

    [2.3, -2.38].forEach((x, i) => {
      const inter = colgar(MeshBuilder.CreateBox(`${nombre}_inter_${lado}_${i}`, { width: 0.08, height: 0.07, depth: 0.12 }, scene));
      inter.position.set(x, 0.62, lado * 0.86);
      inter.material = intermitentes;
    });
  });

  // --- Ruedas ------------------------------------------------------------------
  const RADIO = 0.36;
  const ruedas: TransformNode[] = [];
  [1.45, -1.45].forEach((x) => {
    [-1, 1].forEach((lado) => {
      const eje = new TransformNode(`${nombre}_eje_${x}_${lado}`, scene);
      eje.parent = raiz;
      eje.position.set(x, RADIO, lado * 0.82);
      const neumatico = colgar(
        MeshBuilder.CreateCylinder(`${nombre}_neum_${x}_${lado}`, { diameter: RADIO * 2, height: 0.26, tessellation: 24 }, scene)
      );
      neumatico.parent = eje;
      neumatico.position.set(0, 0, 0);
      neumatico.rotation.x = Math.PI / 2;
      neumatico.material = goma;
      const rin = colgar(
        MeshBuilder.CreateCylinder(`${nombre}_rin_${x}_${lado}`, { diameter: RADIO * 1.2, height: 0.27, tessellation: 16 }, scene)
      );
      rin.parent = eje;
      rin.rotation.x = Math.PI / 2;
      rin.material = llanta;
      ruedas.push(eje);
    });
  });

  // --- Patentes ------------------------------------------------------------------
  if (o.patente) {
    const mat = patenteDe(scene, `${nombre}_patente`, o.patente);
    [
      [2.445, -Math.PI / 2],
      [-2.475, Math.PI / 2],
    ].forEach(([x, giro], i) => {
      const placa = colgar(MeshBuilder.CreatePlane(`${nombre}_placa_${i}`, { width: 0.52, height: 0.12 }, scene));
      placa.position.set(x, 0.46, 0);
      placa.rotation.y = giro;
      placa.material = mat;
    });
  }

  return { raiz, mallas, ruedas, radioRueda: RADIO, faros, traseras, intermitentes, posicionFaros };
}

// ---------------------------------------------------------------------------
// Árboles y faroles
// ---------------------------------------------------------------------------

/**
 * Un árbol de plaza: tronco y copa de volúmenes facetados.
 *
 * De noche un árbol es una silueta recortada contra las luces de detrás, y
 * con la cámara moviéndose es lo que más delata la profundidad: la copa pasa
 * por delante de las ventanas del fondo a otra velocidad que ellas.
 */
export function crearArbol(
  scene: Scene,
  nombre: string,
  altura: number,
  semilla: number,
  follaje: PBRMaterial,
  corteza: PBRMaterial
): Mesh[] {
  const azar = crearAzar(semilla);
  const tronco = MeshBuilder.CreateCylinder(
    `${nombre}_tronco`,
    { height: altura * 0.55, diameterTop: 0.14, diameterBottom: 0.3, tessellation: 9 },
    scene
  );
  tronco.position.y = altura * 0.275;
  tronco.material = corteza;

  const copas: Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const radio = (0.9 + azar() * 0.6) * (altura / 6);
    const copa = MeshBuilder.CreateIcoSphere(`${nombre}_copa_${k}`, { radius: radio, subdivisions: 2, flat: true }, scene);
    const angulo = (k / 6) * Math.PI * 2 + azar();
    const abierto = k === 0 ? 0 : (0.45 + azar() * 0.4) * (altura / 6);
    copa.position.set(Math.cos(angulo) * abierto, altura * (0.62 + azar() * 0.25), Math.sin(angulo) * abierto);
    copa.scaling.y = 0.82;
    copas.push(copa);
  }
  const copa = Mesh.MergeMeshes(copas, true, true) ?? copas[0];
  copa.name = `${nombre}_copa`;
  copa.material = follaje;
  return [tronco, copa];
}

export interface Farol {
  raiz: TransformNode;
  mallas: Mesh[];
  /** Posición del bulbo en coordenadas del mundo, ya colocada la raíz. */
  bulbo(): Vector3;
}

/**
 * Farol de calle de brazo, con la luminaria encendida por debajo.
 *
 * El brazo mira a +X local; se gira la raíz para orientarlo hacia la calzada.
 */
export function crearFarol(scene: Scene, nombre: string, altura: number, poste: PBRMaterial, luminaria: PBRMaterial): Farol {
  const raiz = new TransformNode(nombre, scene);
  const mallas: Mesh[] = [];
  const colgar = (m: Mesh): Mesh => {
    m.parent = raiz;
    mallas.push(m);
    return m;
  };

  const columna = colgar(
    MeshBuilder.CreateCylinder(`${nombre}_poste`, { height: altura, diameterTop: 0.1, diameterBottom: 0.18, tessellation: 12 }, scene)
  );
  columna.position.y = altura / 2;
  columna.material = poste;

  const brazo = colgar(MeshBuilder.CreateBox(`${nombre}_brazo`, { width: 1.15, height: 0.07, depth: 0.07 }, scene));
  brazo.position.set(0.55, altura - 0.12, 0);
  brazo.material = poste;

  const cabeza = colgar(MeshBuilder.CreateBox(`${nombre}_cabeza`, { width: 0.56, height: 0.12, depth: 0.3 }, scene));
  cabeza.position.set(1.08, altura - 0.16, 0);
  cabeza.material = poste;

  const foco = colgar(MeshBuilder.CreateGround(`${nombre}_foco`, { width: 0.46, height: 0.22 }, scene));
  foco.position.set(1.08, altura - 0.225, 0);
  foco.rotation.z = Math.PI;
  foco.material = luminaria;

  return {
    raiz,
    mallas,
    bulbo: () => {
      raiz.computeWorldMatrix(true);
      return Vector3.TransformCoordinates(new Vector3(1.08, altura - 0.3, 0), raiz.getWorldMatrix());
    },
  };
}
