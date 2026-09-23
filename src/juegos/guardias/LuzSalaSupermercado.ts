import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  Plane,
  MirrorTexture,
  DynamicTexture,
  SpotLight,
  VertexBuffer,
  BoundingBox,
  Frustum,
  Matrix,
  type AbstractMesh,
  type TransformNode,
} from "@babylonjs/core";
import { CIELO_RASO } from "./EscenaSupermercado";

// ===========================================================================
// La luz de la sala: luminarias, suelo pulido y la sombra al pie
// ===========================================================================
//
// Hasta ahora la sala la alumbraba casi solo un relleno ambiental: los tres
// focos "de pasillo" colgaban a 6,7 m, por encima del cielo raso, y dos de
// ellos fuera del edificio. A esa distancia y con la caída física de la luz no
// aportaban nada, y todo se veía igual de claro en todas partes, sin que se
// supiera de dónde venía la luz.
//
// Aquí la luz tiene origen:
//
//   · Filas de luminarias lineales de LED pegadas al cielo raso sobre cada
//     pasillo, que es como se alumbra un supermercado: líneas continuas de
//     luz blanca.
//
//     Colgaban de cables, y era peor: setenta cables de seis milímetros
//     cruzando la vista a media altura. A esa distancia un cable no llega a
//     ocupar un pixel entero, así que titila al caminar —aparece y desaparece
//     entre pixel y pixel— y la sala se ve como si estuviera rota. Adosadas
//     al techo desaparece el problema entero y además es lo que lleva un
//     local nuevo. Lo único que cuelga en la sala son los letreros de
//     pasillo, de sus dos varillas, que sí se leen como lo que son.
//   · Seis focos bajo esas filas, hacia abajo, que dan el degradado: más luz
//     en el pasillo, menos contra los muros y en los rincones.
//   · El suelo, aparte del resto del edificio y pulido, con el reflejo de las
//     góndolas, de la gente y de las propias luminarias: las líneas de luz
//     que se estiran por el piso hacia uno son lo que hace que un porcelanato
//     se lea como porcelanato.
//   · Una sombra suave al pie de cada persona. Sin ella las figuras parecían
//     flotar un par de centímetros sobre el piso.

/**
 * Las filas de luminarias: una sobre el eje de cada pasillo del fondo —los
 * mismos de los letreros, ver PasillosSupermercado— y una más corta sobre las
 * cajas, que empieza pasada la bodega.
 */
const FILAS: readonly { x: number; desdeZ: number; hastaZ: number }[] = [
  ...[-6.8, -3.73, -0.66, 2.41, 5.48].map((x) => ({ x, desdeZ: -6.7, hastaZ: 6.5 })),
  { x: 8.75, desdeZ: -2.5, hastaZ: 6.5 },
];
/** Largo de cada módulo y la junta entre dos seguidos. */
const MODULO = 2.4;
const JUNTA = 0.05;
/**
 * La sección del perfil, adosado al cielo raso: ancho y bajo, como una
 * pantalla lineal de LED moderna. Más ancho que el de antes —catorce
 * centímetros— porque ahora se mira desde seis metros y no desde cuatro, y
 * porque lo que se ve es su difusor encendido, no su silueta.
 */
const ANCHO_PERFIL = 0.14;
const ALTO_PERFIL = 0.05;

/** Dónde van los focos: bajo las filas 1, 3 y 5, uno detrás y otro delante. */
const FOCOS: readonly [number, number][] = [
  [-6.8, -3.9],
  [-6.8, 3.4],
  [-0.66, -3.9],
  [-0.66, 3.4],
  [5.48, -3.9],
  [5.48, 3.4],
];

/**
 * Cuelga las filas de luminarias.
 *
 * Dos mallas en total —los marcos y los difusores—, por muchos módulos que
 * sean: se dibujan de una vez.
 *
 */
export function colgarLuminarias(scene: Scene): Mesh[] {
  // Pegadas al cielo raso: el marco toca el techo y el difusor mira al piso.
  const y = CIELO_RASO - ALTO_PERFIL / 2;

  // Perfil de aluminio pintado en blanco, como el cielo raso.
  const pintura = new PBRMaterial("matPerfilLuminaria", scene);
  pintura.albedoColor = new Color3(0.9, 0.9, 0.89);
  pintura.metallic = 0;
  pintura.roughness = 0.45;
  pintura.maxSimultaneousLights = 8;

  // El difusor opal: luz propia, más fuerte que el blanco de la pantalla para
  // que el resplandor del post-proceso lo tome a él y a nada más.
  const opal = new StandardMaterial("matDifusorLuminaria", scene);
  opal.disableLighting = true;
  opal.emissiveColor = new Color3(1, 0.985, 0.95).scale(2.6);
  opal.diffuseColor = new Color3(0, 0, 0);
  opal.specularColor = new Color3(0, 0, 0);

  const perfiles: Mesh[] = [];
  const difusores: Mesh[] = [];
  let n = 0;
  for (const fila of FILAS) {
    const largoFila = fila.hastaZ - fila.desdeZ;
    const cuantos = Math.max(1, Math.round(largoFila / MODULO));
    const paso = largoFila / cuantos;
    for (let i = 0; i < cuantos; i++) {
      const z = fila.desdeZ + paso * (i + 0.5);
      const largo = paso - JUNTA;
      // El marco, contra el cielo raso.
      const perfil = MeshBuilder.CreateBox(`perfilLuminaria_${n}`, { width: ANCHO_PERFIL, height: ALTO_PERFIL, depth: largo }, scene);
      perfil.position.set(fila.x, y, z);
      perfiles.push(perfil);
      // El difusor: toda la cara de abajo, hundida un centímetro en el marco,
      // que es lo que hace el borde blanco alrededor de la luz.
      const difusor = MeshBuilder.CreateBox(
        `difusorLuminaria_${n}`,
        { width: ANCHO_PERFIL - 0.022, height: 0.012, depth: largo - 0.04 },
        scene
      );
      difusor.position.set(fila.x, y - ALTO_PERFIL / 2 + 0.004, z);
      difusores.push(difusor);
      n++;
    }
  }
  const fundir = (nombre: string, piezas: Mesh[], material: PBRMaterial | StandardMaterial): Mesh => {
    const m = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
    m.name = nombre;
    m.material = material;
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  };
  return [
    fundir("perfilesLuminarias", perfiles, pintura),
    fundir("difusoresLuminarias", difusores, opal),
  ];
}

/**
 * Los focos de la sala, bajo las luminarias y hacia abajo.
 *
 * Conos anchos —143 grados, plenos hasta los 109— que se solapan: el piso
 * queda parejo bajo las filas y la luz cae hacia los muros y los rincones,
 * que es lo que hace una sala de techo alto con líneas de luz. El techo no
 * recibe nada de ellos, como no recibe de una luminaria que alumbra hacia
 * abajo.
 *
 * El cono interior importa: sin él, un foco PBR se apaga en degradado desde
 * el eje, y a 45 grados ya daba menos de un tercio. Medido apagando todo lo
 * demás: los seis juntos apenas se notaban.
 *
 * Con el relleno y la luz de la bodega son ocho, el tope por material (ver
 * ampliarLucesSupermercado).
 */
export function encenderFocosSala(scene: Scene): SpotLight[] {
  return FOCOS.map(([x, z], i) => {
    // Justo bajo las luminarias, que ahora van pegadas al techo.
    const foco = new SpotLight(`focoSala_${i}`, new Vector3(x, CIELO_RASO - 0.12, z), new Vector3(0, -1, 0), 2.5, 1, scene);
    foco.innerAngle = 1.9;
    // Blanco neutro, el de un LED de 4000 K.
    foco.diffuse = new Color3(1, 0.97, 0.93);
    foco.specular = new Color3(0.9, 0.88, 0.85);
    // Veinte y no siete y medio: los focos subieron de 4,1 m a ras del cielo
    // raso, y la luz cae con el cuadrado de la distancia —de 3,95 m al piso a
    // 5,77 son 2,1 veces menos—. Con el mismo número, la sala se veía apagada.
    foco.intensity = 20;
    foco.range = 16;
    return foco;
  });
}

/**
 * Aparta el suelo de la sala del resto del edificio, en una malla propia.
 *
 * ─── POR QUÉ ─────────────────────────────────────────────────────────────
 *
 * El modelo trae el suelo en la misma malla que los muros y el techo, con el
 * mismo material. Para pulirlo —menos rugosidad y el reflejo— hace falta un
 * material solo suyo: puesto en el del edificio, el reflejo del plano del
 * piso saldría también en los muros.
 *
 * Por triángulos: los horizontales a la altura del piso.
 *
 * @returns La malla del suelo, o null si no había suelo.
 */
export function separarSueloSala(malla: Mesh, piso: number): Mesh | null {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  const indices = malla.getIndices();
  if (!pos || !indices) return null;
  const mundo = malla.computeWorldMatrix(true);
  const v = [new Vector3(), new Vector3(), new Vector3()];
  const normal = new Vector3();
  const resto: number[] = [];
  const suelo: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], mundo, v[k]);
    }
    Vector3.CrossToRef(v[1].subtract(v[0]), v[2].subtract(v[0]), normal);
    normal.normalize();
    const y = (v[0].y + v[1].y + v[2].y) / 3;
    const esSuelo = Math.abs(normal.y) > 0.9 && Math.abs(y - piso) < 0.03;
    (esSuelo ? suelo : resto).push(indices[t], indices[t + 1], indices[t + 2]);
  }
  if (!suelo.length) return null;
  const copia = malla.clone("sueloSala", malla.parent)!;
  copia.makeGeometryUnique();
  copia.setIndices(suelo);
  malla.setIndices(resto);
  copia.freezeWorldMatrix();
  // Material propio: el mismo, con otra rugosidad y el reflejo.
  if (malla.material instanceof PBRMaterial) copia.material = malla.material.clone("sueloSala");
  return copia;
}

/**
 * Pule el suelo: menos rugosidad y el reflejo de lo que tiene encima.
 *
 * El reflejo es un espejo plano, dibujado cada cuadro, igual que el piso del
 * hall del condominio (ver montarReflejos en PuestoConserjeria): a 1024 y con
 * desenfoque adaptativo, que difumina más cuanto más lejos, como un
 * porcelanato de verdad. Un reflejo nítido parecería un espejo de baño.
 *
 * ─── LO QUE SE DIBUJA EN EL ESPEJO ───────────────────────────────────────
 *
 * Solo lo que se puede ver reflejado. Babylon no recorta lo que queda fuera
 * de cuadro al dibujar una textura: le da todo lo de la lista, y con la sala
 * entera —cada cliente son veintitantas piezas— el espejo costaba más
 * llamadas de dibujo que la propia escena (480 contra 290). Cada cuadro se
 * mira la imagen de cada objeto al otro lado del piso, y entra solo si esa
 * imagen cae en lo que ve la cámara: exactamente lo que el espejo puede
 * mostrar. Lo de detrás del guardia, o al otro lado de una góndola que no
 * está en pantalla, no se dibuja. El reflejo es el mismo.
 *
 * @param reflejable  Qué entra en el reflejo. Se pregunta cada cuadro, así que
 *                    lo que aparece después —un producto en la mano— entra
 *                    solo.
 */
export function pulirSuelo(scene: Scene, suelo: Mesh, piso: number, reflejable: (m: AbstractMesh) => boolean): MirrorTexture | null {
  const mat = suelo.material;
  if (!(mat instanceof PBRMaterial)) return null;
  // La rugosidad sale del canal verde de su textura —0,48 en las baldosas— y
  // el factor la multiplica: queda en 0,15, un porcelanato pulido.
  mat.roughness = 0.3;
  mat.enableSpecularAntiAliasing = true;
  // Un dieléctrico refleja un cuatro por ciento de frente, y sobre baldosa
  // blanca eso no se ve: medido, el reflejo solo aparecía subiendo su
  // intensidad a doce. El esmalte de un porcelanato pulido brilla más que eso,
  // así que se sube la reflectancia de frente a un diez por ciento —y con ella
  // la de canto, por Fresnel— en vez de inflar el reflejo entero: la baldosa
  // sigue viéndose baldosa y el reflejo crece donde crece en la realidad, al
  // mirar el piso a lo lejos.
  mat.metallicF0Factor = 2.2;
  // Y no más: con el reflejo más fuerte, el piso se llenaba del brillo de la
  // calle —que ahora le da el sol de frente— y las manchas que entran por las
  // vidrieras se perdían dentro de ese brillo parejo.
  mat.environmentIntensity = 1.0;

  const espejo = new MirrorTexture("espejoSueloSala", 1024, scene, true);
  // El plano del suelo, mirando hacia arriba, a la altura del piso.
  espejo.mirrorPlane = new Plane(0, -1, 0, piso);
  const planos = Frustum.GetPlanes(Matrix.Identity());
  let cuadro = -1;
  const imagen = new BoundingBox(Vector3.Zero(), Vector3.Zero());
  const min = new Vector3();
  const max = new Vector3();
  espejo.renderListPredicate = (m) => {
    if (m === suelo || !m.isEnabled() || !m.isVisible || !reflejable(m)) return false;
    const camara = scene.activeCamera;
    if (!camara) return true;
    // Los planos de la cámara, una vez por cuadro y no por objeto.
    if (scene.getFrameId() !== cuadro) {
      cuadro = scene.getFrameId();
      Frustum.GetPlanesToRef(camara.getTransformationMatrix(), planos);
    }
    const caja = m.getBoundingInfo().boundingBox;
    min.set(caja.minimumWorld.x, 2 * piso - caja.maximumWorld.y, caja.minimumWorld.z);
    max.set(caja.maximumWorld.x, 2 * piso - caja.minimumWorld.y, caja.maximumWorld.z);
    imagen.reConstruct(min, max);
    return imagen.isInFrustum(planos);
  };
  espejo.adaptiveBlurKernel = 22;
  espejo.level = 0.55;
  mat.reflectionTexture = espejo;
  return espejo;
}

/**
 * Una sombra suave al pie de cada persona.
 *
 * Un disco en el suelo con un degradado radial, colgado de la raíz de la
 * figura: la sigue al caminar y se apaga con ella cuando sale de escena. No
 * es una sombra calculada —con luces de techo de toda la sala, la sombra de
 * una persona es justamente eso, una mancha difusa bajo los pies— y cuesta
 * un dibujo por figura, sin mapa de sombras.
 *
 * @param figuras  Las raíces de las figuras (los nodos "figura_…"), que están
 *                 a la altura de los pies.
 */
export function sombrasAlPie(scene: Scene, figuras: TransformNode[]): Mesh[] {
  const tex = new DynamicTexture("texSombraAlPie", { width: 128, height: 128 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(0.45, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex.hasAlpha = true;
  tex.update();

  const mat = new StandardMaterial("matSombraAlPie", scene);
  mat.diffuseColor = new Color3(0, 0, 0);
  mat.specularColor = new Color3(0, 0, 0);
  mat.emissiveColor = new Color3(0, 0, 0);
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  // Por encima del suelo sin despegarse de él: el desplazamiento de
  // profundidad evita el parpadeo sin levantar el disco.
  mat.zOffset = -2;
  mat.backFaceCulling = true;

  return figuras.map((raiz) => {
    const disco = MeshBuilder.CreateGround(`${raiz.name}_sombraAlPie`, { width: 0.95, height: 0.95 }, scene);
    disco.material = mat;
    disco.parent = raiz;
    disco.position.y = 0.004;
    disco.isPickable = false;
    return disco;
  });
}
