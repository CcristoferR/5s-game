import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Observable, Vector3 } from "@babylonjs/core";
import { texturaGrano, texturaConcreto } from "./TexturasSuperficie";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { crearRotulo3D } from "./Rotulo3D";
import { crearTelefono } from "./Level2Shapes";
import { crearCarpeta, crearEngrapadora, materialPintado } from "./ObjetosComunes";
import type { TipoEvidencia } from "../data/levelConfig";

/** Objetos que puede exhibir un punto de control. */
type ObjetoAuditado = "telefono" | "carpeta" | "engrapadora";

export interface AuditPointResult {
  mesh: Mesh;
  estaMarcado: () => boolean;
  onCambio: Observable<boolean>;
  meshesSombra: Mesh[];
}

/**
 * Altura del pedestal.
 *
 * Subido de 0,5 a 0,95: a media altura los objetos quedaban muy por debajo de
 * la linea de vision de la camara y se veian en escorzo, casi de canto. A la
 * altura de una mesa se ven de frente, que es como se mira algo que hay que
 * juzgar.
 */
const ALTURA_PEDESTAL = 0.95;

/**
 * Aumento de las evidencias.
 *
 * Los objetos venian a tamano real —un telefono de 15 cm, una carpeta de 30—
 * y a la distancia a la que se recorre el galpon eso son unos pocos pixeles:
 * imposible reconocer QUE es, que era justamente lo que habia que arreglar.
 *
 * Estas piezas no son utileria del taller, son piezas EXHIBIDAS para que
 * alguien las evalue. Como en una vitrina, se muestran mas grandes que en la
 * vida real. El unico punto que se entendia sin esfuerzo era la tarjeta roja,
 * y era por lo mismo: grande y de un color que no se puede ignorar.
 */
const ESCALA_EXHIBE = 2.1;

export function crearPuntoControl(
  scene: Scene,
  _gui: AdvancedDynamicTexture,
  id: string,
  x: number,
  z: number,
  descripcion: string,
  tipoEvidencia: TipoEvidencia,
  objeto: ObjetoAuditado = "engrapadora",
  numero = 1,
  titulo = descripcion
): AuditPointResult {
  const pedestal = crearPedestal(scene, id, x, z, numero);
  const evidencia = crearEvidencia(scene, id, x, z, tipoEvidencia, objeto);

  // Marcador mas grande y mas bajo. Flotando a 80 cm sobre el pedestal quedaba
  // desligado de lo que representa: se veia una bola blanca en el aire y la
  // evidencia aparte. Justo encima se lee como "esta es la marca DE esto".
  const mesh = MeshBuilder.CreateSphere(`punto_${id}`, { diameter: 0.38 }, scene);
  mesh.position.set(x, ALTURA_PEDESTAL + 0.62, z);

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
  // Cartel corto anclado a la estación, no una frase flotando.
  //
  // Antes cada punto colgaba su descripción completa en el aire: cinco frases
  // de tres renglones a la vez tapaban justo la escena que hay que auditar, se
  // solapaban entre ellas y no se sabía cuál iba con cuál. Ahora el cartel dice
  // solo QUÉ se audita, y la frase completa vive en el informe final, donde hay
  // sitio para leerla y donde de verdad hace falta.
  crearRotulo3D(scene, `punto_${id}`, titulo, new Vector3(x, ALTURA_PEDESTAL + 0.98, z), {
    ancho: 0.78,
    alto: 0.2,
    lineasMax: 1,
    colorFondo: "#1a1f24",
    colorBorde: "rgba(255,255,255,0.22)",
    mirarCamara: true,
    // Letra grande pese al cartel chico: es la medida que decide si se lee
    // desde donde se recorre el galpón. Con una sola palabra entra holgada.
    alturaTextoMin: 0.1,
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

/**
 * Estacion de inspeccion.
 *
 * Antes era un cilindro de concreto, y con la evidencia encima se leia como un
 * tacho de basura con cosas apoyadas: la forma redonda y el gris sucio no
 * dicen "esto es un puesto de control", dicen "esto es un tambor".
 *
 * Ahora es un mueble: base metalica, cuerpo de concreto, sobre claro con canto
 * y un numero grande al frente. Eso hace tres cosas a la vez —le da identidad
 * de estacion, la separa visualmente de la utileria del galpon, y numera los
 * puntos para poder hablar de "el 3" en el informe.
 */
function crearPedestal(scene: Scene, id: string, x: number, z: number, numero: number): Mesh {
  const ALTO_BASE = 0.1;
  const ALTO_SOBRE = 0.06;
  const ALTO_CUERPO = ALTURA_PEDESTAL - ALTO_BASE - ALTO_SOBRE;
  const LADO = 0.72;

  const concreto = new PBRMaterial(`matPedestal_${id}`, scene);
  concreto.albedoTexture = texturaConcreto(scene);
  concreto.albedoColor = new Color3(0.62, 0.62, 0.6);
  concreto.roughness = 0.65;
  concreto.metallic = 0.05;

  const metal = new PBRMaterial(`matPedestalMetal_${id}`, scene);
  metal.albedoColor = new Color3(0.26, 0.29, 0.32);
  metal.roughness = 0.42;
  metal.metallic = 0.75;
  metal.microSurfaceTexture = texturaGrano(scene, 0.06);

  // Cuerpo. Prismatico y no cilindrico: una cara plana al frente es lo que
  // permite montarle el numero, y ademas quita el parecido con un tambor.
  const cuerpo = MeshBuilder.CreateBox(
    `pedestal_${id}`,
    { width: LADO, height: ALTO_CUERPO, depth: LADO },
    scene
  );
  cuerpo.position.set(x, ALTO_BASE + ALTO_CUERPO / 2, z);
  cuerpo.material = concreto;
  cuerpo.receiveShadows = true;

  // Base: apoya el mueble en el piso en vez de dejarlo brotando de el.
  const base = MeshBuilder.CreateBox(
    `pedestalBase_${id}`,
    { width: LADO + 0.08, height: ALTO_BASE, depth: LADO + 0.08 },
    scene
  );
  base.position.set(x, ALTO_BASE / 2, z);
  base.material = metal;
  base.receiveShadows = true;

  // Sobre: mas claro que el cuerpo para que la evidencia se recorte contra el.
  // Con todo del mismo gris, los objetos oscuros desaparecian sobre la tapa.
  const sobreMat = new PBRMaterial(`matPedestalSobre_${id}`, scene);
  sobreMat.albedoColor = new Color3(0.82, 0.82, 0.79);
  sobreMat.roughness = 0.5;
  sobreMat.metallic = 0.08;
  sobreMat.microSurfaceTexture = texturaGrano(scene, 0.05);

  const sobre = MeshBuilder.CreateBox(
    `pedestalSobre_${id}`,
    { width: LADO + 0.06, height: ALTO_SOBRE, depth: LADO + 0.06 },
    scene
  );
  sobre.position.set(x, ALTURA_PEDESTAL - ALTO_SOBRE / 2, z);
  sobre.material = sobreMat;
  sobre.receiveShadows = true;

  // Numero al frente. Se lee desde lejos sin ocupar espacio en el aire, y es
  // lo que permite recorrer el galpon sabiendo cuantas estaciones faltan.
  const chapa = materialPintado(scene, `matPedestalNumero_${id}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#20262b";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#586570";
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    ctx.fillStyle = "#e8edf0";
    ctx.font = "bold 150px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(numero).padStart(2, "0"), w / 2, h / 2 + 6);
  });

  const numeroChapa = MeshBuilder.CreateBox(
    `pedestalChapa_${id}`,
    { width: 0.26, height: 0.26, depth: 0.014 },
    scene
  );
  numeroChapa.position.set(x, ALTO_BASE + ALTO_CUERPO * 0.62, z - LADO / 2 - 0.007);
  numeroChapa.material = chapa;

  return cuerpo;
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
  // Relleno mas presente que antes: al 12% de opacidad la marca se perdia a la
  // distancia a la que se recorre el galpon y el punto quedaba en "dos
  // cuadrados" indistinguibles.
  ctx.fillStyle = vacia ? "rgba(214,150,40,0.3)" : "rgba(120,190,150,0.2)";
  ctx.fillRect(0, 0, LADO, LADO);

  ctx.strokeStyle = vacia ? "rgba(245,186,72,1)" : "rgba(150,215,175,0.95)";
  // Linea mas gruesa: una demarcacion de piso real se ve desde el otro lado
  // de la nave, no es un detalle que haya que buscar de cerca.
  ctx.lineWidth = 24;
  // Linea cortada: asi es la cinta de demarcacion real, y ademas distingue la
  // marca de cualquier borde de la geometria.
  ctx.setLineDash([44, 26]);
  ctx.strokeRect(16, 16, LADO - 32, LADO - 32);

  textura.update();

  const mat = new PBRMaterial(`matMarca_${id}`, scene);
  mat.albedoTexture = textura;
  mat.opacityTexture = textura;
  mat.emissiveTexture = textura;
  // Algo de emision propia para que la marca no dependa de que le llegue luz:
  // los pedestales estan repartidos y algunos quedan en penumbra.
  mat.emissiveColor = new Color3(0.55, 0.55, 0.55);
  mat.roughness = 0.85;
  mat.metallic = 0;
  mat.backFaceCulling = false;

  const marca = MeshBuilder.CreateGround(`marca_${id}`, { width: ancho, height: fondo }, scene);
  marca.position.set(x, y, z);
  marca.material = mat;
  marca.isPickable = false;

  return marca;
}

/**
 * Apoya una malla sobre una superficie, sea cual sea su escala.
 *
 * Con las evidencias aumentadas ya no sirve un desplazamiento fijo en Y: cada
 * objeto tiene su altura y al escalarlo cambia. Se mide su caja envolvente ya
 * escalada y se corrige, asi que ninguno queda flotando ni hundido.
 */
function apoyarSobre(malla: Mesh, alturaSuperficie: number): void {
  malla.computeWorldMatrix(true);
  const base = malla.getBoundingInfo().boundingBox.minimumWorld.y;
  malla.position.y += alturaSuperficie - base;
}

/** Construye el objeto que nombra la descripcion del punto, ya exhibible. */
function objetoDelPunto(scene: Scene, id: string, cual: ObjetoAuditado): Mesh {
  const malla =
    cual === "telefono"
      ? crearTelefono(scene, `auditTel_${id}`)
      : cual === "carpeta"
        ? crearCarpeta(scene, `auditCar_${id}`, "PROYECTO ACTIVO")
        : crearEngrapadora(scene, `auditEng_${id}`);

  malla.scaling.setAll(ESCALA_EXHIBE);
  return malla;
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
    soporte.position.set(x, y, z);
    soporte.rotation.y = -0.35;
    apoyarSobre(soporte, y);
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
    creados.push(crearMarcaDeSitio(scene, id, x - 0.02, y, z - 0.06, 0.62, 0.56, false));

    const soporte = objetoDelPunto(scene, id, objeto);
    soporte.position.set(x - 0.02, y, z - 0.06);
    apoyarSobre(soporte, y);
    creados.push(soporte);

    const matMancha = new PBRMaterial(`matManchaAudit_${id}`, scene);
    matMancha.albedoColor = new Color3(0.07, 0.055, 0.04);
    // Mancha de aceite: brillante y con reflejo, no mate. El brillo es lo que
    // la delata a distancia y lo que la distingue de una sombra.
    matMancha.roughness = 0.12;
    matMancha.metallic = 0.1;

    const mancha = MeshBuilder.CreateDisc(`manchaAudit_${id}`, { radius: 0.3, tessellation: 24 }, scene);
    mancha.rotation.x = Math.PI / 2;
    mancha.position.set(x + 0.2, y + 0.002, z + 0.2);
    mancha.scaling.z = 0.72;
    mancha.material = matMancha;
    creados.push(mancha);

    // Salpicaduras alrededor: un derrame real no es un circulo perfecto, y sin
    // ellas la mancha se lee como una calcomania.
    const salpicaduras: Array<[number, number, number]> = [
      [0.44, 0.1, 0.085],
      [0.08, 0.42, 0.07],
      [0.38, 0.44, 0.05],
      [-0.12, 0.3, 0.045],
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
    creados.push(crearMarcaDeSitio(scene, id, x - 0.21, y, z, 0.36, 0.44, true));
    creados.push(crearMarcaDeSitio(scene, id + "_b", x + 0.21, y, z, 0.36, 0.44, false));

    const fuera = objetoDelPunto(scene, id, objeto);
    // Corrido hacia adelante y torcido: apoyado al voleo, no colocado.
    fuera.position.set(x + 0.26, y, z + 0.3);
    apoyarSobre(fuera, y);
    fuera.rotation.y = 0.9;
    fuera.rotation.z = 0.06;
    creados.push(fuera);
  } else {
    // sinProblema: el objeto que nombra la descripcion, centrado y derecho
    // dentro de su marca. Es la referencia de "asi se ve un punto que cumple",
    // y por eso importa que sea reconocible: si es una caja gris, el jugador
    // no tiene con que comparar los demas.
    creados.push(crearMarcaDeSitio(scene, id, x, y, z, 0.62, 0.58, false));

    const enSuSitio = objetoDelPunto(scene, id, objeto);
    enSuSitio.position.set(x, y, z);
    apoyarSobre(enSuSitio, y);
    creados.push(enSuSitio);
  }

  return creados;
}