import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Observable } from "@babylonjs/core";
import {
  hacerArrastrable,
  type ResultadoSoltar,
  type LimitesArrastre,
  type BuscarEnganche,
} from "../core/InputController";

export interface DatosObjetoBase {
  id: string;
  posicionInicial: [number, number, number];
}

export interface ObjetoInteractableResult<T extends DatosObjetoBase> {
  mesh: Mesh;
  datos: T;
  onSoltar: Observable<ResultadoSoltar>;
  onAgarrar: Observable<Mesh>;
  /**
   * Deja el objeto quieto para siempre: ya no se puede agarrar ni volver a
   * clasificar.
   *
   * Marcar isPickable = false en la malla raiz NO alcanza. Los objetos llevan
   * piezas hijas con materiales propios, y PointerDragBehavior acepta el clic
   * sobre cualquier descendiente: bastaba con hacer clic en una de esas piezas
   * para volver a arrastrar un objeto ya clasificado, sumar puntos de nuevo y
   * terminar el nivel antes de tiempo.
   */
  fijar: () => void;
}

export function crearObjetoInteractable<T extends DatosObjetoBase>(
  scene: Scene,
  datos: T,
  crearMalla?: (scene: Scene, datos: T) => Mesh,
  limites?: LimitesArrastre,
  buscarEnganche?: BuscarEnganche
): ObjetoInteractableResult<T> {
  let mesh: Mesh;

  if (crearMalla) {
    mesh = crearMalla(scene, datos);
  } else {
    mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
    const mat = new StandardMaterial(`mat_${datos.id}`, scene);
    mat.diffuseColor = new Color3(0.6, 0.6, 0.65);
    mesh.material = mat;
  }

  mesh.position.set(...datos.posicionInicial);
  mesh.metadata = datos;

  const { onSoltar, onAgarrar, comportamiento } = hacerArrastrable(
    mesh,
    datos.posicionInicial[1],
    limites,
    buscarEnganche
  );

  const fijar = (): void => {
    mesh.removeBehavior(comportamiento);
    mesh.isPickable = false;
    mesh.getChildMeshes().forEach((hijo) => {
      hijo.isPickable = false;
    });
  };

  return { mesh, datos, onSoltar, onAgarrar, fijar };
}