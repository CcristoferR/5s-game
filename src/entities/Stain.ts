import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Observable } from "@babylonjs/core";

export interface StainResult {
  mesh: Mesh;
  onLimpia: Observable<void>;
}

export type TipoMancha = "aceite" | "polvo";

// Mancha con forma irregular, ahora con dos variantes visuales: aceite
// (brillante, húmeda) y polvo (mate, difusa) — cada una con su propio
// número de clicks para limpiar, coherente con cómo se comportaría en
// la realidad.
export function crearMancha(
  scene: Scene,
  id: string,
  x: number,
  z: number,
  tipo: TipoMancha = "aceite",
  clicksNecesarios?: number
): StainResult {
  const esPolvo = tipo === "polvo";
  const clicks = clicksNecesarios ?? (esPolvo ? 3 : 5);

  const mat = new PBRMaterial(`matMancha_${id}`, scene);
  mat.albedoColor = esPolvo ? new Color3(0.42, 0.4, 0.37) : new Color3(0.1, 0.08, 0.06);
  mat.roughness = esPolvo ? 0.85 : 0.15;
  const alphaBase = esPolvo ? 0.7 : 0.85;
  mat.alpha = alphaBase;

  const radioBase = esPolvo ? 0.26 : 0.22;
  const nucleo = MeshBuilder.CreateDisc(`manchaNucleo_${id}`, { radius: radioBase, tessellation: 16 }, scene);
  nucleo.rotation.x = Math.PI / 2;

  const lobulo1 = MeshBuilder.CreateDisc(`manchaLobulo1_${id}`, { radius: radioBase * 0.55, tessellation: 12 }, scene);
  lobulo1.rotation.x = Math.PI / 2;
  lobulo1.position.set(radioBase * 0.7, 0.001, radioBase * 0.45);

  const lobulo2 = MeshBuilder.CreateDisc(`manchaLobulo2_${id}`, { radius: radioBase * 0.45, tessellation: 12 }, scene);
  lobulo2.rotation.x = Math.PI / 2;
  lobulo2.position.set(-radioBase * 0.6, 0.001, -radioBase * 0.36);

  const mesh = Mesh.MergeMeshes([nucleo, lobulo1, lobulo2], true, true, undefined, false, true)!;
  mesh.name = `mancha_${id}`;
  mesh.material = mat;
  mesh.position.set(x, 0.911, z);

  const onLimpia = new Observable<void>();
  let clicksRestantes = clicks;

  const escuchaClick = scene.onPointerObservable.add((info) => {
    if (info.type !== 1) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    clicksRestantes--;
    const progreso = clicksRestantes / clicks;
    mesh.scaling.setAll(0.5 + progreso * 0.5);
    mat.alpha = alphaBase * progreso;

    if (clicksRestantes <= 0) {
      mesh.dispose();
      scene.onPointerObservable.remove(escuchaClick);
      onLimpia.notifyObservers();
    }
  });

  return { mesh, onLimpia };
}