import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  DynamicTexture,
  Color3,
  Vector3,
  Ray,
  AbstractMesh,
} from "@babylonjs/core";

// ---------------------------------------------------------------------------
// Sombra de contacto del objeto arrastrado
// ---------------------------------------------------------------------------
//
// Mientras un objeto va en la mano no proyecta nada, así que no se sabe sobre
// qué zona va a caer hasta soltarlo. El jugador suelta, mira dónde quedó, y
// corrige. Una mancha debajo elimina ese paso: se ve el destino antes de
// soltar.
//
// ─── QUÉ HACE QUE SE VEA REAL Y NO UN CÍRCULO PEGADO ───────────────────────
//
// Tres cosas, y las tres importan:
//
//   1. BUSCA LA SUPERFICIE. Un rayo hacia abajo encuentra qué hay bajo el
//      objeto — el piso, la tabla del banco, una repisa — y la sombra se apoya
//      ahí. Sin esto, un objeto sobre el banco proyectaría en el suelo, un
//      metro más abajo y corrido en perspectiva: el error más delator.
//
//   2. RESPONDE A LA ALTURA. Cuanto más lejos está el objeto de la superficie,
//      más grande y más tenue es la mancha; al acercarse se contrae y se
//      oscurece. Es lo que hace una sombra de verdad y lo que comunica
//      "esto está por posarse acá".
//
//   3. TOMA LA FORMA DEL OBJETO. La huella se escala con la caja envolvente,
//      así una carpeta larga proyecta alargado y una taza proyecta redondo.
//
// ─── UNA SOLA, COMPARTIDA ─────────────────────────────────────────────────
//
// Solo hay un objeto en la mano a la vez, así que hay una sola mancha para
// toda la escena. Se crea la primera vez que se necesita y se reutiliza: nada
// que crear ni destruir en medio del arrastre.

/** Radio de la huella sin escalar. Se ajusta luego a cada objeto. */
const RADIO_BASE = 0.5;

/** Altura sobre la superficie: lo justo para no pelearse con ella. */
const APOYO = 0.006;

/** Distancia a partir de la cual la sombra ya no se dibuja. */
const ALCANCE_MAXIMO = 2.2;

const sombraPorEscena = new WeakMap<Scene, Mesh>();

/**
 * Textura de la huella: un degradado radial de negro a transparente.
 *
 * El borde difuso es lo que la distingue de una calcomanía. Un disco de borde
 * duro se lee como un objeto apoyado en el piso; este se lee como sombra.
 * El degradado no es lineal a propósito — una sombra real es densa en el
 * centro y se va perdiendo rápido hacia afuera.
 */
function texturaHuella(scene: Scene): DynamicTexture {
  const LADO = 256;
  const textura = new DynamicTexture("texSombraContacto", { width: LADO, height: LADO }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, LADO, LADO);

  const c = LADO / 2;
  const degradado = ctx.createRadialGradient(c, c, 0, c, c, c);
  degradado.addColorStop(0, "rgba(0,0,0,1)");
  degradado.addColorStop(0.42, "rgba(0,0,0,0.85)");
  degradado.addColorStop(0.72, "rgba(0,0,0,0.32)");
  degradado.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = degradado;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  textura.update();
  textura.hasAlpha = true;

  return textura;
}

function obtenerSombra(scene: Scene): Mesh {
  const existente = sombraPorEscena.get(scene);
  if (existente && !existente.isDisposed()) return existente;

  const huella = texturaHuella(scene);

  const mat = new PBRMaterial("matSombraContacto", scene);
  // Sin iluminar: una sombra no recibe luz. Si el material respondiera a los
  // focos del garaje, la mancha se aclararía justo bajo las luces, que es
  // exactamente al revés de como se comporta una sombra.
  mat.unlit = true;
  mat.albedoColor = new Color3(0, 0, 0);
  // El degradado viaja en el canal alfa del albedo, no en una textura de
  // opacidad aparte: en modo unlit Babylon no consulta la de opacidad, y la
  // mancha saldría como un cuadrado negro sólido.
  mat.albedoTexture = huella;
  mat.useAlphaFromAlbedoTexture = true;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  mat.alpha = 1;
  mat.backFaceCulling = false;

  const sombra = MeshBuilder.CreateGround(
    "sombraContacto",
    { width: RADIO_BASE * 2, height: RADIO_BASE * 2 },
    scene
  );
  sombra.material = mat;
  sombra.isPickable = false;
  // No entra en el cálculo de sombras del sol ni recibe ninguna: es una
  // superficie pintada, no geometría del mundo.
  sombra.receiveShadows = false;
  // Se dibuja después del resto para que se funda bien con lo que tiene
  // debajo en vez de pelear por profundidad con la tabla del banco.
  sombra.alphaIndex = 5;
  sombra.isVisible = false;

  sombraPorEscena.set(scene, sombra);
  return sombra;
}

/** Descarta la malla que se está arrastrando y sus piezas. */
function esDelObjeto(candidata: AbstractMesh, objeto: Mesh): boolean {
  let nodo: AbstractMesh | null = candidata;
  while (nodo) {
    if (nodo === objeto) return true;
    nodo = nodo.parent as AbstractMesh | null;
  }
  return false;
}

/**
 * Coloca la sombra bajo el objeto, sobre la superficie que tenga debajo.
 *
 * Se llama en cada cuadro del arrastre.
 */
export function actualizarSombraContacto(scene: Scene, objeto: Mesh): void {
  const sombra = obtenerSombra(scene);

  const caja = objeto.getBoundingInfo().boundingBox;
  const centro = caja.centerWorld;
  const extension = caja.extendSizeWorld;
  const baseObjeto = centro.y - extension.y;

  // El rayo sale de la base del objeto, no de su centro: si saliera del centro
  // podría arrancar por debajo de una superficie y encontrar la de más abajo.
  const rayo = new Ray(new Vector3(centro.x, baseObjeto + 0.02, centro.z), Vector3.Down(), ALCANCE_MAXIMO);

  const impacto = scene.pickWithRay(
    rayo,
    (malla) => malla.isVisible && malla !== sombra && !esDelObjeto(malla, objeto)
  );

  if (!impacto?.hit || !impacto.pickedPoint) {
    sombra.isVisible = false;
    return;
  }

  const separacion = Math.max(0, baseObjeto - impacto.pickedPoint.y);

  // Cuanto más alto va el objeto, más se abre la huella y más se diluye. Los
  // números salen de probar: por encima de medio metro la sombra ya no aporta
  // información y solo ensucia, así que se desvanece del todo.
  const factor = Math.min(1, separacion / 0.55);
  const apertura = 1 + factor * 0.85;
  const opacidad = (1 - factor) * 0.55 + 0.06;

  // La huella toma la planta del objeto: alargada si el objeto es alargado.
  // El mínimo evita que una pieza muy fina proyecte una raya invisible.
  const anchoX = Math.max(0.12, extension.x * 2);
  const anchoZ = Math.max(0.12, extension.z * 2);

  sombra.scaling.set(
    ((anchoX * 1.35) / (RADIO_BASE * 2)) * apertura,
    1,
    ((anchoZ * 1.35) / (RADIO_BASE * 2)) * apertura
  );

  sombra.position.set(impacto.pickedPoint.x, impacto.pickedPoint.y + APOYO, impacto.pickedPoint.z);
  (sombra.material as PBRMaterial).alpha = opacidad;
  sombra.isVisible = true;
}

/** Esconde la sombra al soltar el objeto. */
export function ocultarSombraContacto(scene: Scene): void {
  const sombra = sombraPorEscena.get(scene);
  if (sombra && !sombra.isDisposed()) sombra.isVisible = false;
}