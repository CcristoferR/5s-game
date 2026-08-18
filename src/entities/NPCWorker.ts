import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, Animation } from "@babylonjs/core";

export interface NPCWorkerResult {
  mesh: Mesh;
  caminarHacia: (destino: Vector3, duracionSegundos: number, alTerminar?: () => void) => void;
}

// NPC placeholder simple (una cápsula, sin articulaciones) que "prueba"
// el estándar caminando hacia el checklist terminado. Intencionalmente
// básico — el desafío del nivel es la claridad del checklist, no el
// personaje en sí.
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

  return { mesh, caminarHacia };
}