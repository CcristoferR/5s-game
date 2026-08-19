import { Mesh, PointerDragBehavior, Vector3, Observable } from "@babylonjs/core";

export interface ResultadoSoltar {
  mesh: Mesh;
  movioSuficiente: boolean; // false = fue un click/tap sin arrastre real, no una decisión
}

const DISTANCIA_MINIMA_ARRASTRE = 0.3;

export function hacerArrastrable(mesh: Mesh, alturaFija: number): { onSoltar: Observable<ResultadoSoltar>; onAgarrar: Observable<Mesh> } {
  const comportamiento = new PointerDragBehavior({ dragPlaneNormal: Vector3.Up() });
  comportamiento.useObjectOrientationForDragging = false;

  const onSoltar = new Observable<ResultadoSoltar>();
  const onAgarrar = new Observable<Mesh>();

  let posicionAlAgarrar = mesh.position.clone();

  comportamiento.onDragStartObservable.add(() => {
    posicionAlAgarrar = mesh.position.clone();
    mesh.scaling.setAll(1.15);
    onAgarrar.notifyObservers(mesh);
  });

  comportamiento.onDragObservable.add(() => {
    mesh.position.y = alturaFija;
  });

  comportamiento.onDragEndObservable.add(() => {
    mesh.scaling.setAll(1);
    const distancia = Vector3.Distance(
      new Vector3(posicionAlAgarrar.x, 0, posicionAlAgarrar.z),
      new Vector3(mesh.position.x, 0, mesh.position.z)
    );
    onSoltar.notifyObservers({ mesh, movioSuficiente: distancia >= DISTANCIA_MINIMA_ARRASTRE });
  });

  mesh.addBehavior(comportamiento);

  return { onSoltar, onAgarrar };
}