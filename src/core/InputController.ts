import { Mesh, PointerDragBehavior, Vector3, Observable } from "@babylonjs/core";

// Abstrae "cómo se agarra y suelta un objeto". Los niveles solo llaman a
// esta función sin saber si por debajo es mouse/touch o, más adelante,
// un control de VR — eso permite agregar el modo inmersivo sin tocar la
// lógica de cada nivel.
export function hacerArrastrable(mesh: Mesh, alturaFija: number): { onSoltar: Observable<Mesh> } {
  const comportamiento = new PointerDragBehavior({ dragPlaneNormal: Vector3.Up() });
  comportamiento.useObjectOrientationForDragging = false;

  const onSoltar = new Observable<Mesh>();

  comportamiento.onDragStartObservable.add(() => {
    mesh.scaling.setAll(1.15); // pequeño feedback visual: "esto es lo que estoy agarrando"
  });

  comportamiento.onDragObservable.add(() => {
    mesh.position.y = alturaFija; // mantiene la altura fija, evita que se hunda o flote raro
  });

  comportamiento.onDragEndObservable.add(() => {
    mesh.scaling.setAll(1);
    onSoltar.notifyObservers(mesh);
  });

  mesh.addBehavior(comportamiento);

  return { onSoltar };
}