import { Scene, Mesh, AbstractMesh, Color3, PointerEventTypes } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export interface ObjetoEtiquetable {
  mesh: Mesh;
  texto: string;
}

/**
 * Muestra el nombre del objeto que está bajo el cursor, y lo resalta.
 *
 * Sin esto, el Nivel 1 le pide al jugador clasificar diez objetos que solo
 * puede identificar por su forma. Por buena que sea la forma, alguien que juega
 * por primera vez no tiene cómo saber si una caja marrón es "una caja sin
 * etiqueta" o "chatarra": el nombre es parte de la información que necesita
 * para decidir, no un adorno.
 *
 * Se resuelve con UN solo observador de escena y UNA sola etiqueta reutilizada,
 * en vez de una etiqueta fija por objeto. Diez rótulos permanentes sobre un
 * banco de 4 metros se pisarían entre sí y taparían los objetos, que es
 * justamente lo que el jugador tiene que mirar.
 */
export function habilitarEtiquetasAlPasar(
  scene: Scene,
  gui: AdvancedDynamicTexture,
  objetos: ObjetoEtiquetable[]
): void {
  const porMalla = new Map<Mesh, string>();
  objetos.forEach((objeto) => porMalla.set(objeto.mesh, objeto.texto));

  // Texto con contorno en vez de recuadro de fondo: la capa del HUD recibe el
  // post-procesado de la escena, que lava los fondos oscuros. El contorno se
  // lee igual de bien sobre el piso claro del garaje o sobre el banco oscuro.
  const etiqueta = new TextBlock("etiquetaObjetoActivo", "");
  etiqueta.color = "#ffffff";
  etiqueta.fontSize = 15;
  etiqueta.fontWeight = "600";
  etiqueta.outlineWidth = 5;
  etiqueta.outlineColor = "rgba(0,0,0,0.85)";
  etiqueta.textWrapping = true;
  etiqueta.resizeToFit = true;
  etiqueta.width = "230px";
  etiqueta.isHitTestVisible = false;
  etiqueta.isVisible = false;
  gui.addControl(etiqueta);

  const COLOR_RESALTE = Color3.FromHexString("#ffffff");
  let activo: Mesh | null = null;

  /**
   * Sube por la jerarquía hasta encontrar el objeto arrastrable.
   *
   * Hace falta porque los objetos llevan piezas hijas con materiales propios
   * (el yunque cromado de la engrapadora, la espiral del manual): el clic puede
   * caer sobre cualquiera de ellas y aun así corresponde al objeto entero.
   */
  const buscarRaiz = (malla: AbstractMesh | null | undefined): Mesh | null => {
    let actual: AbstractMesh | null = malla ?? null;
    while (actual) {
      if (actual instanceof Mesh && porMalla.has(actual)) {
        return actual;
      }
      actual = actual.parent as AbstractMesh | null;
    }
    return null;
  };

  const resaltar = (objeto: Mesh, encendido: boolean): void => {
    objeto.renderOutline = encendido;
    objeto.outlineColor = COLOR_RESALTE;
    objeto.outlineWidth = 0.012;
    objeto.getChildMeshes().forEach((hijo) => {
      if (hijo instanceof Mesh) {
        hijo.renderOutline = encendido;
        hijo.outlineColor = COLOR_RESALTE;
        hijo.outlineWidth = 0.012;
      }
    });
  };

  const soltarActivo = (): void => {
    if (activo) {
      resaltar(activo, false);
      activo = null;
    }
    etiqueta.isVisible = false;
  };

  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERMOVE) return;

    const raiz = buscarRaiz(info.pickInfo?.pickedMesh);

    if (!raiz) {
      soltarActivo();
      return;
    }

    if (raiz !== activo) {
      soltarActivo();
      activo = raiz;
      resaltar(raiz, true);
      etiqueta.text = porMalla.get(raiz) ?? "";
      etiqueta.linkWithMesh(raiz);
      etiqueta.linkOffsetY = -46;
      etiqueta.isVisible = true;
    }
  });

  // Si el objeto se vuelve no seleccionable (ya fue clasificado), no puede
  // quedar resaltado ni con su nombre colgando.
  scene.onBeforeRenderObservable.add(() => {
    if (activo && !activo.isPickable) {
      soltarActivo();
    }
  });
}