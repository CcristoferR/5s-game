import { Mesh, PointerDragBehavior, Vector3, Observable } from "@babylonjs/core";
import { reproducir } from "./Sonido";
import { actualizarSombraContacto, ocultarSombraContacto } from "../entities/SombraContacto";

export interface ResultadoSoltar {
  mesh: Mesh;
  movioSuficiente: boolean;
  distancia: number; // distancia recorrida en el arrastre — usada en el Nivel 2 para medir "eficiencia de ubicación"
}

const DISTANCIA_MINIMA_ARRASTRE = 0.3;

/**
 * Recinto dentro del cual puede moverse un objeto arrastrado.
 *
 * Sin limites el arrastre es un plano infinito: el objeto atraviesa paredes,
 * tableros y muebles, porque nada lo detiene. El caso mas visible es el panel
 * vertical de las estaciones del Nivel 2 — la herramienta lo cruzaba de lado a
 * lado como si no existiera.
 */
export interface LimitesArrastre {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export function hacerArrastrable(
  mesh: Mesh,
  alturaFija: number,
  limites?: LimitesArrastre
): { onSoltar: Observable<ResultadoSoltar>; onAgarrar: Observable<Mesh>; comportamiento: PointerDragBehavior } {
  const comportamiento = new PointerDragBehavior({ dragPlaneNormal: Vector3.Up() });
  comportamiento.useObjectOrientationForDragging = false;

  const onSoltar = new Observable<ResultadoSoltar>();
  const onAgarrar = new Observable<Mesh>();

  let posicionAlAgarrar = mesh.position.clone();

  comportamiento.onDragStartObservable.add(() => {
    posicionAlAgarrar = mesh.position.clone();
    mesh.scaling.setAll(1.15);
    reproducir("agarrar");
    onAgarrar.notifyObservers(mesh);
  });

  comportamiento.onDragObservable.add(() => {
    mesh.position.y = alturaFija;

    if (limites) {
      mesh.position.x = Math.min(limites.xMax, Math.max(limites.xMin, mesh.position.x));
      mesh.position.z = Math.min(limites.zMax, Math.max(limites.zMin, mesh.position.z));
    }

    // Va despues de aplicar los limites: si se calculara antes, la sombra
    // quedaria adelantada al objeto contra los bordes del recinto.
    actualizarSombraContacto(mesh.getScene(), mesh);
  });

  comportamiento.onDragEndObservable.add(() => {
    mesh.scaling.setAll(1);
    ocultarSombraContacto(mesh.getScene());
    const distancia = Vector3.Distance(
      new Vector3(posicionAlAgarrar.x, 0, posicionAlAgarrar.z),
      new Vector3(mesh.position.x, 0, mesh.position.z)
    );
    reproducir("soltar");
    onSoltar.notifyObservers({ mesh, movioSuficiente: distancia >= DISTANCIA_MINIMA_ARRASTRE, distancia });
  });

  mesh.addBehavior(comportamiento);

  // Se devuelve el comportamiento para poder desmontarlo cuando el objeto queda
  // fijado. No alcanza con marcarlo no seleccionable: PointerDragBehavior acepta
  // el clic sobre cualquier descendiente, asi que una pieza hija todavia
  // seleccionable vuelve a habilitar el arrastre.
  return { onSoltar, onAgarrar, comportamiento };
}