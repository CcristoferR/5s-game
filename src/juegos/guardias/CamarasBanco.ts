import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import { loft } from "./ModeladoFigura";

// ===========================================================================
// Las cámaras de seguridad del hall
// ===========================================================================
//
// Una sucursal bancaria está llena de cámaras, y el hall no tenía ninguna.
// Aquí van las que tendría cualquiera, donde las pone quien las instala:
//
//   · dos domos chicos bajo el alero de las cajas, entre caja y caja, de
//     cara a quien se acerca al mesón: es la toma de la cara de cada cliente
//     que atienden. Quedan a la altura de la vista desde el puesto, bajo las
//     placas de las cajas;
//   · un domo grande colgado del cielo en medio del hall, de los que giran:
//     la sala entera, la fila y las sillas;
//   · dos cámaras de brazo en las esquinas altas: una en la de delante a la
//     derecha, sobre el puesto, que mira el acceso —es la que señala el
//     sargento cuando pide las grabaciones—, y otra al fondo a la izquierda,
//     que mira el hall hacia la puerta.
//
// Con su luz roja encendida: que se vea que graban. Fija, sin parpadeo: una
// luz que parpadea en el borde de la vista durante todo el turno distrae.
//
// ─── LAS MEDIDAS ─────────────────────────────────────────────────────────
//
// Medidas con rayos sobre el modelo a escala 3 (piso del hall en 0,70):
// cielo raso en 5,95; muro izquierdo por dentro en X −4,217 y el derecho en
// 5,589; fachada en Z −3,945 y fondo en 5,861. El alero sobre el mesón tiene
// la cara de abajo a 2,56 y va de Z 4,4 a 5,0; las placas de las cajas
// cuelgan por delante, en su frente.

export interface CamarasBanco {
  /**
   * El lente de la cámara que mira el acceso, en la esquina de delante a la
   * derecha: adonde mira el sargento cuando pide las grabaciones.
   */
  acceso: Vector3;
  dispose(): void;
}

/** Cara de abajo del alero del mesón, y a qué fondo van los domos bajo él. */
const ALERO_Y = 2.56;
const ALERO_Z = 4.55;
const MURO_DER_X = 5.589;
const MURO_IZQ_X = -4.217;

export function montarCamarasBanco(scene: Scene, piso: number, cielo: number): CamarasBanco {
  // --- Los materiales ------------------------------------------------------------
  const carcasa = new PBRMaterial("matCarcasaCamaraBanco", scene);
  carcasa.albedoColor = new Color3(0.8, 0.81, 0.82);
  carcasa.metallic = 0;
  carcasa.roughness = 0.38;
  // El domo: acrílico ahumado, casi negro y muy liso. Lo que lo delata como
  // domo es el reflejo de la sala en su curva.
  const ahumado = new PBRMaterial("matDomoCamaraBanco", scene);
  ahumado.albedoColor = new Color3(0.012, 0.012, 0.015);
  ahumado.metallic = 0;
  ahumado.roughness = 0.07;
  ahumado.metallicF0Factor = 1.4;
  const lente = new PBRMaterial("matLenteCamaraBanco", scene);
  lente.albedoColor = new Color3(0.008, 0.009, 0.012);
  lente.metallic = 0;
  lente.roughness = 0.05;
  const oscuro = new PBRMaterial("matOscuroCamaraBanco", scene);
  oscuro.albedoColor = new Color3(0.035, 0.036, 0.04);
  oscuro.metallic = 0;
  oscuro.roughness = 0.5;
  // La luz roja: por encima del blanco, para que el resplandor del
  // post-proceso la tome y se vea como una luz y no como un punto pintado.
  const luz = new StandardMaterial("matLuzCamaraBanco", scene);
  luz.disableLighting = true;
  luz.emissiveColor = new Color3(3.2, 0.16, 0.08);
  luz.diffuseColor = new Color3(0, 0, 0);
  luz.specularColor = new Color3(0, 0, 0);
  const materiales = [carcasa, ahumado, lente, oscuro, luz];

  const nodos: TransformNode[] = [];
  const mallas: Mesh[] = [];
  const pieza = (m: Mesh, padre: TransformNode, material: PBRMaterial | StandardMaterial): Mesh => {
    m.parent = padre;
    m.material = material;
    m.isPickable = false;
    mallas.push(m);
    return m;
  };
  const nodo = (nombre: string): TransformNode => {
    const n = new TransformNode(nombre, scene);
    nodos.push(n);
    return n;
  };
  /** Un casquete de esfera hacia abajo: el domo. */
  const casquete = (nombre: string, diametro: number, aplastado: number): Mesh => {
    const m = MeshBuilder.CreateSphere(nombre, { diameter: diametro, segments: 20, slice: 0.5 }, scene);
    m.rotation.x = Math.PI;
    m.scaling.y = aplastado;
    return m;
  };

  // ─── EL DOMO CHICO ─────────────────────────────────────────────────────
  //
  // Base blanca atornillada al techo, el aro que sujeta el domo y el domo
  // ahumado debajo. Trece centímetros: lo que mide uno de verdad.
  const domoChico = (nombre: string, x: number, y: number, z: number, mira: number): void => {
    const n = nodo(nombre);
    n.position.set(x, y, z);
    n.rotation.y = mira;
    pieza(MeshBuilder.CreateCylinder(`${nombre}_base`, { diameter: 0.135, height: 0.026, tessellation: 32 }, scene), n, carcasa).position.y = -0.013;
    pieza(MeshBuilder.CreateCylinder(`${nombre}_aro`, { diameter: 0.118, height: 0.012, tessellation: 32 }, scene), n, carcasa).position.y = -0.031;
    pieza(casquete(`${nombre}_domo`, 0.1, 0.9), n, ahumado).position.y = -0.036;
    // La luz, en el aro, del lado hacia donde mira.
    pieza(MeshBuilder.CreateSphere(`${nombre}_luz`, { diameter: 0.009, segments: 8 }, scene), n, luz).position.set(0, -0.031, 0.061);
  };

  // ─── EL DOMO COLGANTE ──────────────────────────────────────────────────
  //
  // El que gira: más grande, colgado de un tubo para que el domo quede por
  // debajo de los paneles de luz y vea la sala entera.
  const domoColgante = (nombre: string, x: number, z: number, caida: number): void => {
    const n = nodo(nombre);
    n.position.set(x, cielo, z);
    pieza(MeshBuilder.CreateCylinder(`${nombre}_tapa`, { diameter: 0.12, height: 0.018, tessellation: 28 }, scene), n, carcasa).position.y = -0.009;
    pieza(MeshBuilder.CreateCylinder(`${nombre}_tubo`, { diameter: 0.036, height: caida, tessellation: 16 }, scene), n, carcasa).position.y = -caida / 2;
    // La carcasa, de cantos redondeados, con el tubo entrando por arriba.
    const cuerpo = pieza(
      loft(scene, `${nombre}_carcasa`, [
        { y: -0.1, x: 0.084, delante: 0.084 },
        { y: -0.094, x: 0.093, delante: 0.093 },
        { y: -0.02, x: 0.095, delante: 0.095 },
        { y: -0.004, x: 0.082, delante: 0.082 },
        { y: 0.004, x: 0.05, delante: 0.05 },
        { y: 0.008, x: 0.02, delante: 0.02 },
      ], { lados: 36, tapaAbajo: true, tapaArriba: true }),
      n,
      carcasa
    );
    cuerpo.position.y = -caida;
    pieza(casquete(`${nombre}_domo`, 0.16, 0.95), n, ahumado).position.y = -caida - 0.098;
    pieza(MeshBuilder.CreateSphere(`${nombre}_luz`, { diameter: 0.01, segments: 8 }, scene), n, luz).position.set(0, -caida - 0.07, -0.095);
  };

  // ─── LA CÁMARA DE BRAZO ────────────────────────────────────────────────
  //
  // La de siempre en una esquina: una placa atornillada al muro, un brazo, y
  // la cámara alargada con su visera, apuntando a lo que vigila. El frente,
  // un vidrio oscuro con el lente detrás y la luz debajo.
  const deBrazo = (nombre: string, enElMuro: Vector3, haciaFuera: Vector3, apunta: Vector3): Vector3 => {
    const n = nodo(nombre);
    n.position.copyFrom(enElMuro);
    // La placa, de cara a la sala. (lookAt en el espacio del padre, que está
    // en el muro: la dirección hacia fuera es el punto al que mirar.)
    const placa = nodo(`${nombre}_soporte`);
    placa.parent = n;
    placa.lookAt(haciaFuera);
    pieza(MeshBuilder.CreateBox(`${nombre}_placa`, { width: 0.08, height: 0.11, depth: 0.016 }, scene), placa, carcasa).position.z = 0.008;
    // El brazo: sale del muro y baja un poco hasta la rótula.
    const LARGO = 0.17;
    const brazo = pieza(MeshBuilder.CreateCylinder(`${nombre}_brazo`, { diameter: 0.03, height: LARGO, tessellation: 14 }, scene), placa, carcasa);
    brazo.rotation.x = Math.PI / 2 + 0.28;
    brazo.position.set(0, -(LARGO / 2) * Math.sin(0.28), 0.016 + (LARGO / 2) * Math.cos(0.28));
    const rotula = new Vector3(0, -LARGO * Math.sin(0.28), 0.016 + LARGO * Math.cos(0.28));
    pieza(MeshBuilder.CreateSphere(`${nombre}_rotula`, { diameter: 0.036, segments: 12 }, scene), placa, carcasa).position.copyFrom(rotula);
    // La cámara, colgada de la rótula y mirando a lo que vigila.
    placa.computeWorldMatrix(true);
    const enRotula = Vector3.TransformCoordinates(rotula, placa.getWorldMatrix());
    const camara = nodo(`${nombre}_camara`);
    camara.position.copyFrom(enRotula);
    camara.lookAt(apunta);
    // El cuerpo, a lo largo de +Z: redondeado, casi cuadrado de sección.
    const cuerpo = pieza(
      loft(scene, `${nombre}_cuerpo`, [
        { y: -0.2, x: 0.036, delante: 0.036, forma: 2.6 },
        { y: -0.192, x: 0.042, delante: 0.042, forma: 2.8 },
        { y: 0.02, x: 0.043, delante: 0.043, forma: 2.8 },
        { y: 0.03, x: 0.04, delante: 0.04, forma: 2.8 },
      ], { lados: 28, tapaAbajo: true, tapaArriba: true }),
      camara,
      carcasa
    );
    cuerpo.rotation.x = -Math.PI / 2;
    cuerpo.position.set(0, -0.052, 0.04);
    // La visera, por encima y pasada del frente.
    const visera = pieza(MeshBuilder.CreateBox(`${nombre}_visera`, { width: 0.1, height: 0.006, depth: 0.27 }, scene), camara, carcasa);
    visera.position.set(0, -0.005, 0.11);
    // El frente: vidrio oscuro, el lente y la luz.
    const frente = pieza(MeshBuilder.CreateCylinder(`${nombre}_frente`, { diameter: 0.074, height: 0.005, tessellation: 28 }, scene), camara, lente);
    frente.rotation.x = Math.PI / 2;
    frente.position.set(0, -0.052, 0.242);
    const ojo = pieza(MeshBuilder.CreateCylinder(`${nombre}_lente`, { diameter: 0.03, height: 0.004, tessellation: 20 }, scene), camara, oscuro);
    ojo.rotation.x = Math.PI / 2;
    ojo.position.set(0, -0.048, 0.2455);
    pieza(MeshBuilder.CreateSphere(`${nombre}_luz`, { diameter: 0.008, segments: 8 }, scene), camara, luz).position.set(0, -0.078, 0.245);
    camara.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(new Vector3(0, -0.052, 0.245), camara.getWorldMatrix());
  };

  // --- Dónde van ----------------------------------------------------------------
  //
  // Bajo el alero, entre la caja 1 y la 2 y entre la 3 y la 4, con la luz
  // hacia el hall.
  domoChico("domoCajasBanco_0", -2.15, ALERO_Y, ALERO_Z, Math.PI);
  domoChico("domoCajasBanco_1", 2.08, ALERO_Y, ALERO_Z, Math.PI);
  // En medio del hall, entre dos paneles de luz de la columna del medio.
  domoColgante("domoHallBanco", 0.7, 1.75, 0.46);
  // La esquina de delante a la derecha, sobre el puesto, mirando el acceso.
  const acceso = deBrazo(
    "camaraAccesoBanco",
    new Vector3(MURO_DER_X, piso + 2.85, -3.35),
    new Vector3(-1, 0, 0),
    new Vector3(1.0, piso + 1.3, -3.4)
  );
  // La esquina del fondo a la izquierda, mirando el hall hacia la puerta.
  deBrazo(
    "camaraFondoBanco",
    new Vector3(MURO_IZQ_X, piso + 3.0, 5.45),
    new Vector3(1, 0, 0),
    new Vector3(1.4, piso + 1.2, -2.2)
  );

  // Nada de esto se mueve.
  nodos.forEach((n) => n.computeWorldMatrix(true));
  mallas.forEach((m) => m.freezeWorldMatrix());

  return {
    acceso,
    dispose() {
      mallas.forEach((m) => m.dispose());
      nodos.forEach((n) => n.dispose());
      materiales.forEach((m) => m.dispose());
    },
  };
}
