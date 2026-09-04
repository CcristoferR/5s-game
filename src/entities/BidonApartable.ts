import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Vector3, Observable } from "@babylonjs/core";
import { crearObjetoInteractable } from "./InteractableObject";
import { texturaGrano } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

// ---------------------------------------------------------------------------
// Bidón que hay que apartar
// ---------------------------------------------------------------------------
//
// Video 3.4 (0:41): "en esta S no se trata solo de limpiar sino, y más
// importante, la labor de limpieza la realizaremos con el objetivo final de
// poder realizar una inspección a nuestros equipos y áreas".
//
// Ese es el bidón. Debajo hay un charco que lleva ahí meses y que no se ve
// desde ningún ángulo de la cámara: la única forma de encontrarlo es correr el
// bulto. Un nivel donde toda la suciedad está a la vista enseña a limpiar; uno
// donde hay que levantar lo que está apoyado enseña a inspeccionar, que es lo
// que pide la 3S.
//
// No es utilería: es utilería que se mueve. Se apoya en el mismo arrastre del
// resto del juego —con el enganche que corrige la altura, para que no se hunda
// en el piso mientras se lo empuja— y se queda quieto en cuanto destapa lo que
// tapaba.

export interface BidonResult {
  mesh: Mesh;
  /** Se apartó lo suficiente como para dejar ver lo que había debajo. */
  onApartado: Observable<void>;
  /** Deja de poder moverse. Se llama al terminar el nivel. */
  fijar: () => void;
}

/** Cuánto hay que correrlo para que cuente como apartado. */
const DISTANCIA_APARTADO = 0.75;

function crearFormaBidon(scene: Scene, id: string): Mesh {
  const matCuerpo = new PBRMaterial(`matBidonCuerpo_${id}`, scene);
  // Azul de bidón de aceite industrial: es el color que hace que se lea como
  // un envase de producto y no como un tacho de basura.
  matCuerpo.albedoColor = new Color3(0.12, 0.26, 0.46);
  matCuerpo.roughness = 0.55;
  matCuerpo.metallic = 0.35;
  matCuerpo.microSurfaceTexture = texturaGrano(scene, 0.1);

  const cuerpo = MeshBuilder.CreateCylinder(
    `bidonCuerpo_${id}`,
    { diameter: 0.56, height: 0.86, tessellation: 24 },
    scene
  );
  cuerpo.position.y = 0.43;
  cuerpo.material = matCuerpo;

  const matAro = new PBRMaterial(`matBidonAro_${id}`, scene);
  matAro.albedoColor = new Color3(0.08, 0.18, 0.33);
  matAro.roughness = 0.45;
  matAro.metallic = 0.5;

  // Nervaduras: un cilindro liso se ve como una lata de refresco gigante.
  const partes: Mesh[] = [cuerpo];
  [0.24, 0.62].forEach((altura, i) => {
    const aro = MeshBuilder.CreateTorus(
      `bidonAro_${id}_${i}`,
      { diameter: 0.58, thickness: 0.035, tessellation: 20 },
      scene
    );
    aro.position.y = altura;
    aro.material = matAro;
    partes.push(aro);
  });

  const tapa = MeshBuilder.CreateCylinder(
    `bidonTapa_${id}`,
    { diameter: 0.58, height: 0.05, tessellation: 24 },
    scene
  );
  tapa.position.y = 0.87;
  tapa.material = matAro;
  partes.push(tapa);

  // Etiqueta. Dice qué hay dentro, que es lo que hace verosímil el charco:
  // un bidón de lubricante que lleva meses sin moverse gotea por la base.
  const matEtiqueta = materialPintado(scene, `matBidonEtiqueta_${id}`, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#e9e4d6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#12406f";
    ctx.fillRect(0, 0, w, 46);

    ctx.fillStyle = "#12406f";
    ctx.font = "bold 62px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ACEITE", w / 2, 128);
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText("HIDR\u00c1ULICO", w / 2, 178);

    ctx.fillStyle = "#8a7f66";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText("200 L", w / 2, 224);
  });

  const etiqueta = MeshBuilder.CreateCylinder(
    `bidonEtiqueta_${id}`,
    { diameter: 0.575, height: 0.34, tessellation: 24 },
    scene
  );
  etiqueta.position.y = 0.45;
  etiqueta.material = matEtiqueta;
  partes.push(etiqueta);

  const bidon = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  bidon.name = id;
  bidon.receiveShadows = true;
  return bidon;
}

/**
 * Monta el bidón sobre el punto indicado y avisa cuando lo apartan.
 *
 * @param limites  Recinto de arrastre. Sin él el bidón atraviesa las paredes.
 */
export function crearBidonApartable(
  scene: Scene,
  id: string,
  x: number,
  z: number,
  limites: { xMin: number; xMax: number; zMin: number; zMax: number }
): BidonResult {
  const onApartado = new Observable<void>();
  const origen = new Vector3(x, 0, z);

  // El bidón se dibuja con su base en y = 0, así que el origen de la malla ya
  // está a ras de piso: la altura de arrastre es 0 y no hace falta corregirla.
  const objeto = crearObjetoInteractable(
    scene,
    { id, posicionInicial: [x, 0, z] as [number, number, number] },
    (s, d) => crearFormaBidon(s, d.id),
    limites
  );

  let apartado = false;

  objeto.onSoltar.add(({ mesh }) => {
    if (apartado) return;

    const recorrido = Vector3.Distance(
      new Vector3(origen.x, 0, origen.z),
      new Vector3(mesh.position.x, 0, mesh.position.z)
    );

    if (recorrido < DISTANCIA_APARTADO) return;

    apartado = true;
    onApartado.notifyObservers();
  });

  return { mesh: objeto.mesh, onApartado, fijar: objeto.fijar };
}