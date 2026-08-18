import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";

export interface StainResult {
  mesh: Mesh;
  onLimpia: Observable<void>;
}

// Mancha con forma irregular (varios óvalos superpuestos, no un círculo
// perfecto) para que se lea como una mancha real de aceite. Al limpiarla
// se desvanece (menos opaca) además de achicarse — simula "frotar hasta
// que sale" en vez de solo encoger de golpe.
export function crearMancha(scene: Scene, id: string, x: number, z: number, clicksNecesarios = 5): StainResult {
  const mat = new StandardMaterial(`matMancha_${id}`, scene);
  mat.diffuseColor = new Color3(0.12, 0.1, 0.07);
  mat.alpha = 0.85;

  const nucleo = MeshBuilder.CreateDisc(`manchaNucleo_${id}`, { radius: 0.22, tessellation: 16 }, scene);
  nucleo.rotation.x = Math.PI / 2;

  const lobulo1 = MeshBuilder.CreateDisc(`manchaLobulo1_${id}`, { radius: 0.12, tessellation: 12 }, scene);
  lobulo1.rotation.x = Math.PI / 2;
  lobulo1.position.set(0.16, 0.001, 0.1);

  const lobulo2 = MeshBuilder.CreateDisc(`manchaLobulo2_${id}`, { radius: 0.1, tessellation: 12 }, scene);
  lobulo2.rotation.x = Math.PI / 2;
  lobulo2.position.set(-0.13, 0.001, -0.08);

  const mesh = Mesh.MergeMeshes([nucleo, lobulo1, lobulo2], true, true, undefined, false, true)!;
  mesh.name = `mancha_${id}`;
  mesh.material = mat;
  mesh.position.set(x, 0.911, z);

  const onLimpia = new Observable<void>();
  let clicksRestantes = clicksNecesarios;

  const escuchaClick = scene.onPointerObservable.add((info) => {
    if (info.type !== 1) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    clicksRestantes--;
    const progreso = clicksRestantes / clicksNecesarios;
    mesh.scaling.setAll(0.5 + progreso * 0.5);
    mat.alpha = 0.85 * progreso;

    if (clicksRestantes <= 0) {
      mesh.dispose();
      scene.onPointerObservable.remove(escuchaClick);
      onLimpia.notifyObservers();
    }
  });

  return { mesh, onLimpia };
}