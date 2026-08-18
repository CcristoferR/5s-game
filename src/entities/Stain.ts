import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";

export interface StainResult {
  mesh: Mesh;
  onLimpia: Observable<void>;
}

// Mancha que requiere varios clicks para desaparecer — simula "tallar",
// no un solo click. El contador de clicks vive acá mismo, encapsulado;
// el nivel solo escucha cuándo termina (onLimpia).
export function crearMancha(scene: Scene, id: string, x: number, z: number, clicksNecesarios = 5): StainResult {
  const mesh = MeshBuilder.CreateCylinder(`mancha_${id}`, { diameter: 0.5, height: 0.02 }, scene);
  mesh.position.set(x, 0.911, z); // justo encima de la superficie del escritorio (0.90), sin enterrarse

  const mat = new StandardMaterial(`matMancha_${id}`, scene);
  mat.diffuseColor = new Color3(0.15, 0.12, 0.08);
  mesh.material = mat;

  const onLimpia = new Observable<void>();
  let clicksRestantes = clicksNecesarios;

  mesh.isPickable = true;
  mesh.actionManager = null; // se usa onPointerDown vía observable global, más simple para clicks repetidos

  const escena_click = scene.onPointerObservable.add((info) => {
    if (info.type !== 1 /* POINTERDOWN */) return; // solo al presionar, no al soltar
    if (info.pickInfo?.pickedMesh !== mesh) return;

    clicksRestantes--;
    mesh.scaling.scaleInPlace(clicksRestantes / (clicksRestantes + 1)); // se ve "achicar" con cada click

    if (clicksRestantes <= 0) {
      mesh.dispose();
      scene.onPointerObservable.remove(escena_click);
      onLimpia.notifyObservers();
    }
  });

  return { mesh, onLimpia };
}