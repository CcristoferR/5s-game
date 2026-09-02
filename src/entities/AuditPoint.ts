import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Observable, Vector3 } from "@babylonjs/core";
import { texturaGrano, texturaConcreto } from "./TexturasSuperficie";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { crearRotulo3D } from "./Rotulo3D";
import { crearTelefono } from "./Level2Shapes";
import { crearCarpeta, crearEngrapadora } from "./ObjetosComunes";
import type { TipoEvidencia } from "../data/levelConfig";

/** Objetos que puede exhibir un punto de control. */
type ObjetoAuditado = "telefono" | "carpeta" | "engrapadora";

export interface AuditPointResult {
  mesh: Mesh;
  estaMarcado: () => boolean;
  onCambio: Observable<boolean>;
  meshesSombra: Mesh[];
}

const ALTURA_PEDESTAL = 0.5;

export function crearPuntoControl(
  scene: Scene,
  _gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string,
  tipoEvidencia: TipoEvidencia,
  objeto: ObjetoAuditado = "engrapadora"
): AuditPointResult {
  const pedestal = crearPedestal(scene, id, x, z);
  const evidencia = crearEvidencia(scene, id, x, z, tipoEvidencia, objeto);

  const mesh = MeshBuilder.CreateSphere(`punto_${id}`, { diameter: 0.28 }, scene);
  mesh.position.set(x, ALTURA_PEDESTAL + 0.8, z);

  const colorNeutro = new Color3(0.55, 0.55, 0.6);
  const colorMarcado = new Color3(0.85, 0.45, 0.1);

  const mat = new PBRMaterial(`matPunto_${id}`, scene);
  mat.albedoColor = colorNeutro;
  // Microtextura de rugosidad: una esfera de color liso se lee como plástico.
  mat.microSurfaceTexture = texturaGrano(scene, 0.1);
  mat.emissiveColor = colorNeutro.scale(0.15);
  mat.roughness = 0.25;
  mat.metallic = 0.4;
  mesh.material = mat;

  // Rótulo sobre un cartel propio, encima del punto de control. Antes era
  // texto 2D anclado: con varios puntos repartidos por el garaje, las
  // descripciones se apilaban en el centro de la pantalla y no se sabía
  // cuál pertenecía a cuál.
  crearRotulo3D(scene, `punto_${id}`, descripcion, new Vector3(x, ALTURA_PEDESTAL + 1.28, z), {
    ancho: 1.25,
    alto: 0.34,
    lineasMax: 3,
    colorFondo: "#1d2227",
    colorBorde: "rgba(255,255,255,0.3)",
    mirarCamara: true,
  });

  let marcado = false;
  const onCambio = new Observable<boolean>();

  scene.onPointerObservable.add((info) => {
    if (info.type !== 1) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    marcado = !marcado;
    mesh.scaling.setAll(marcado ? 1.5 : 1);
    mat.albedoColor = marcado ? colorMarcado : colorNeutro;
    mat.emissiveColor = (marcado ? colorMarcado : colorNeutro).scale(marcado ? 0.4 : 0.15);
    onCambio.notifyObservers(marcado);
  });

  return { mesh, estaMarcado: () => marcado, onCambio, meshesSombra: [pedestal, ...evidencia, mesh] };
}

function crearPedestal(scene: Scene, id: string, x: number, z: number): Mesh {
  // Concreto texturado, igual que los pedestales y muebles del resto del
  // juego. Antes era gris plano: al lado de los objetos texturados de los
  // niveles 1 a 4, el Nivel 5 se veía de otra época.
  const mat = new PBRMaterial(`matPedestal_${id}`, scene);
  mat.albedoTexture = texturaConcreto(scene);
  mat.albedoColor = new Color3(0.72, 0.7, 0.66);
  mat.roughness = 0.6;
  mat.metallic = 0.1;

  const pedestal = MeshBuilder.CreateCylinder(`pedestal_${id}`, { diameterTop: 0.5, diameterBottom: 0.42, height: ALTURA_PEDESTAL }, scene);
  pedestal.position.set(x, ALTURA_PEDESTAL / 2, z);
  pedestal.material = mat;
  pedestal.receiveShadows = true;

  return pedestal;
}

/**
 * Marca de sitio: el rectangulo pintado que delimita donde va cada cosa.
 *
 * Es el lenguaje visual del 5S y hace legible el nivel sin explicar nada. Un
 * objeto DENTRO de su marca se lee como "esta en su lugar"; el mismo objeto
 * al lado de una marca vacia se lee como desviacion, aunque el jugador no haya
 * leido el rotulo. Antes habia que deducirlo del texto, y con la camara lejos
 * el texto es lo ultimo que se mira.
 *
 * @param vacia  Marca sin objeto encima: se pinta en ambar, el color con que
 *               se senala una falta en planta.
 */
function crearMarcaDeSitio(
  scene: Scene,
  id: string,
  x: number,
  y: number,
  z: number,
  ancho: number,
  fondo: number,
  vacia: boolean
): Mesh {
  const LADO = 256;
  const textura = new DynamicTexture(`texMarca_${id}`, { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

  // El interior va casi transparente para que se siga viendo el pedestal: es
  // pintura sobre la superficie, no una bandeja apoyada encima.
  ctx.clearRect(0, 0, LADO, LADO);
  ctx.fillStyle = vacia ? "rgba(196,142,44,0.16)" : "rgba(120,170,140,0.12)";
  ctx.fillRect(0, 0, LADO, LADO);

  ctx.strokeStyle = vacia ? "rgba(232,176,70,0.95)" : "rgba(150,205,170,0.85)";
  ctx.lineWidth = 14;
  // Linea cortada: asi es la cinta de demarcacion real, y ademas distingue la
  // marca de cualquier borde de la geometria.
  ctx.setLineDash([34, 20]);
  ctx.strokeRect(16, 16, LADO - 32, LADO - 32);

  textura.update();

  const mat = new PBRMaterial(`matMarca_${id}`, scene);
  mat.albedoTexture = textura;
  mat.opacityTexture = textura;
  mat.emissiveTexture = textura;
  mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
  mat.roughness = 0.85;
  mat.metallic = 0;
  mat.backFaceCulling = false;

  const marca = MeshBuilder.CreateGround(`marca_${id}`, { width: ancho, height: fondo }, scene);
  marca.position.set(x, y, z);
  marca.material = mat;
  marca.isPickable = false;

  return marca;
}

/** Construye el objeto que nombra la descripcion del punto. */
function objetoDelPunto(scene: Scene, id: string, cual: ObjetoAuditado): Mesh {
  switch (cual) {
    case "telefono":
      return crearTelefono(scene, `auditTel_${id}`);
    case "carpeta":
      return crearCarpeta(scene, `auditCar_${id}`, "PROYECTO ACTIVO");
    case "engrapadora":
      return crearEngrapadora(scene, `auditEng_${id}`);
  }
}

function crearEvidencia(
  scene: Scene,
  id: string,
  x: number,
  z: number,
  tipo: TipoEvidencia,
  objeto: ObjetoAuditado
): Mesh[] {
  const y = ALTURA_PEDESTAL + 0.01;
  const creados: Mesh[] = [];

  if (tipo === "tarjetaVencida") {
    // Tarjeta roja colgada de un alambre, no un plano flotando.
    //
    // La tarjeta roja del 5S es una etiqueta de carton que se ATA al objeto
    // observado. Sin el alambre ni el objeto, el plano rojo anterior no se
    // leia como tarjeta: parecia un cartel suelto en el aire.
    const soporte = objetoDelPunto(scene, id, objeto);
    soporte.position.set(x, y + 0.06, z);
    soporte.rotation.y = -0.35;
    creados.push(soporte);

    const matAlambre = new PBRMaterial(`matAlambre_${id}`, scene);
    matAlambre.albedoColor = new Color3(0.6, 0.6, 0.64);
    matAlambre.roughness = 0.35;
    matAlambre.metallic = 0.85;

    const alambre = MeshBuilder.CreateCylinder(`alambre_${id}`, { diameter: 0.012, height: 0.3, tessellation: 8 }, scene);
    alambre.position.set(x + 0.12, y + 0.34, z + 0.02);
    alambre.rotation.z = 0.18;
    alambre.material = matAlambre;
    creados.push(alambre);

    // La tarjeta lleva su texto impreso: numero de tarjeta, motivo y fecha.
    // Es exactamente lo que trae una tarjeta roja real, y es la evidencia que
    // el jugador tiene que juzgar — la fecha esta vencida.
    const ANCHO = 512;
    const ALTO = 640;
    const tex = new DynamicTexture(`texTarjeta_${id}`, { width: ANCHO, height: ALTO }, scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;

    ctx.fillStyle = "#b4231f";
    ctx.fillRect(0, 0, ANCHO, ALTO);

    // Fibra del carton: el rojo plano se lee como plastico.
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(Math.random() * ANCHO, Math.random() * ALTO, 3, 2);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, ANCHO - 40, ALTO - 40);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 76px system-ui, sans-serif";
    ctx.fillText("TARJETA", ANCHO / 2, 130);
    ctx.fillText("ROJA", ANCHO / 2, 210);

    ctx.font = "600 40px system-ui, sans-serif";
    ctx.fillText("N\u00b0 0472", ANCHO / 2, 300);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "500 34px system-ui, sans-serif";
    ctx.fillText("Uso dudoso", ANCHO / 2, 372);
    ctx.fillText("pendiente de decisi\u00f3n", ANCHO / 2, 418);

    // La fecha va destacada sobre fondo oscuro: es el dato que decide si el
    // punto cumple o no, asi que tiene que saltar antes que el resto.
    ctx.fillStyle = "rgba(60,10,8,0.9)";
    ctx.fillRect(60, 476, ANCHO - 120, 110);
    ctx.fillStyle = "#ffd9d4";
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.fillText("VENCE 15/06", ANCHO / 2, 548);

    tex.update();
    tex.anisotropicFilteringLevel = 16;

    const matTarjeta = new PBRMaterial(`matTarjeta_${id}`, scene);
    matTarjeta.albedoTexture = tex;
    matTarjeta.roughness = 0.85;
    matTarjeta.metallic = 0;

    const tarjeta = MeshBuilder.CreateBox(`tarjeta_${id}`, { width: 0.26, height: 0.33, depth: 0.006 }, scene);
    tarjeta.position.set(x + 0.14, y + 0.32, z + 0.03);
    tarjeta.rotation.set(0, -0.5, 0.18);
    tarjeta.material = matTarjeta;
    creados.push(tarjeta);
  } else if (tipo === "manchaVisible") {
    // El area SI tiene su marca de sitio y su objeto en orden: el problema no
    // es el desorden, es la suciedad. Distinguir una cosa de la otra es
    // justamente lo que se audita.
    creados.push(crearMarcaDeSitio(scene, id, x - 0.02, y, z - 0.06, 0.46, 0.4, false));

    const soporte = objetoDelPunto(scene, id, objeto);
    soporte.position.set(x - 0.02, y + 0.06, z - 0.06);
    creados.push(soporte);

    const matMancha = new PBRMaterial(`matManchaAudit_${id}`, scene);
    matMancha.albedoColor = new Color3(0.07, 0.055, 0.04);
    // Mancha de aceite: brillante y con reflejo, no mate. El brillo es lo que
    // la delata a distancia y lo que la distingue de una sombra.
    matMancha.roughness = 0.12;
    matMancha.metallic = 0.1;

    const mancha = MeshBuilder.CreateDisc(`manchaAudit_${id}`, { radius: 0.19, tessellation: 24 }, scene);
    mancha.rotation.x = Math.PI / 2;
    mancha.position.set(x + 0.16, y + 0.002, z + 0.16);
    mancha.scaling.z = 0.72;
    mancha.material = matMancha;
    creados.push(mancha);

    // Salpicaduras alrededor: un derrame real no es un circulo perfecto, y sin
    // ellas la mancha se lee como una calcomania.
    const salpicaduras: Array<[number, number, number]> = [
      [0.3, 0.08, 0.055],
      [0.06, 0.28, 0.04],
      [0.26, 0.3, 0.03],
    ];
    salpicaduras.forEach(([dx, dz, radio], i) => {
      const gota = MeshBuilder.CreateDisc(`salpAudit_${id}_${i}`, { radius: radio, tessellation: 10 }, scene);
      gota.rotation.x = Math.PI / 2;
      gota.rotation.y = Math.random() * Math.PI;
      gota.position.set(x + dx, y + 0.002, z + dz);
      gota.scaling.z = 0.65;
      gota.material = matMancha;
      creados.push(gota);
    });
  } else if (tipo === "objetoFueraDeLugar") {
    // Dos marcas y un solo objeto. La de la izquierda esta vacia en ambar
    // —falta lo que deberia estar ahi— y el objeto aparece FUERA de la suya,
    // apoyado de cualquier forma. Se entiende de un vistazo, sin leer nada.
    creados.push(crearMarcaDeSitio(scene, id, x - 0.2, y, z, 0.32, 0.34, true));
    creados.push(crearMarcaDeSitio(scene, id + "_b", x + 0.2, y, z, 0.32, 0.34, false));

    const fuera = objetoDelPunto(scene, id, objeto);
    // Corrido hacia adelante y torcido: apoyado al voleo, no colocado.
    fuera.position.set(x + 0.22, y + 0.06, z + 0.26);
    fuera.rotation.y = 0.9;
    fuera.rotation.z = 0.06;
    creados.push(fuera);
  } else {
    // sinProblema: el objeto que nombra la descripcion, centrado y derecho
    // dentro de su marca. Es la referencia de "asi se ve un punto que cumple",
    // y por eso importa que sea reconocible: si es una caja gris, el jugador
    // no tiene con que comparar los demas.
    creados.push(crearMarcaDeSitio(scene, id, x, y, z, 0.46, 0.42, false));

    const enSuSitio = objetoDelPunto(scene, id, objeto);
    enSuSitio.position.set(x, y + 0.06, z);
    creados.push(enSuSitio);
  }

  return creados;
}