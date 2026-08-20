import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, Animation } from "@babylonjs/core";

export interface NPCWorkerResult {
  mesh: Mesh;
  caminarHacia: (destino: Vector3, duracionSegundos: number, alTerminar?: () => void) => void;
  reaccionar: (exito: boolean) => void;
}

export function crearNPCWorker(scene: Scene): NPCWorkerResult {
  const mesh = MeshBuilder.CreateCapsule("npcWorker", { height: 1.2, radius: 0.22 }, scene);
  mesh.position.set(-4, 0.6, 1.2);

  const mat = new StandardMaterial("matNpcWorker", scene);
  mat.diffuseColor = new Color3(0.3, 0.5, 0.65);
  mesh.material = mat;

  function caminarHacia(destino: Vector3, duracionSegundos: number, alTerminar?: () => void): void {
    const fps = 30;
    const anim = new Animation(
      "npcCaminar", "position", fps,
      Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys([
      { frame: 0, value: mesh.position.clone() },
      { frame: fps * duracionSegundos, value: destino },
    ]);
    mesh.animations = [anim];
    scene.beginAnimation(mesh, 0, fps * duracionSegundos, false, 1, alTerminar);
  }

  // Reacción visual tras la prueba: un pequeño salto de alegría si el
  // estándar era claro, o un temblor de confusión si era ambiguo — le da
  // consecuencia real a "si el estándar es ambiguo, el NPC falla".
  function reaccionar(exito: boolean): void {
    let t = 0;
    const rotBase = mesh.rotation.y;

    const obs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;

      if (exito) {
        mesh.scaling.y = 1 + Math.max(0, Math.sin(t * 10)) * 0.18;
        if (t > 0.6) {
          mesh.scaling.y = 1;
          scene.onBeforeRenderObservable.remove(obs);
        }
      } else {
        mesh.rotation.y = rotBase + Math.sin(t * 14) * 0.35;
        if (t > 0.7) {
          mesh.rotation.y = rotBase;
          scene.onBeforeRenderObservable.remove(obs);
        }
      }
    });
  }

  return { mesh, caminarHacia, reaccionar };
}