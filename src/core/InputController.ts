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

/**
 * Consulta de enganche: dónde debería estar el objeto ahora mismo.
 *
 * ─── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * El arrastre de este juego corre sobre un plano horizontal, así que el objeto
 * conserva su altura y se desliza por el piso. Sirve para las zonas pintadas
 * en el suelo de los Niveles 1 y 4, pero hace FÍSICAMENTE IMPOSIBLE subir algo
 * a una repisa o colgarlo de un tablero, que es de lo que trata el Nivel 2.
 *
 * Cambiar el plano de arrastre a uno vertical arreglaría el Nivel 2 y rompería
 * los otros cuatro: con la cámara orbital, arrastrar en el plano de pantalla
 * hace que los objetos salgan volando en cuanto se gira un poco la vista.
 *
 * El enganche resuelve las dos cosas: quien lo pasa recibe en cada cuadro la
 * posición LIBRE (la del piso, donde el arrastre quiere dejar el objeto) y
 * puede devolver otra —la de la balda, la de la silueta— a la que el objeto se
 * imanta mientras el cursor siga apuntando ahí. Devolver null lo deja en el
 * piso, como siempre.
 *
 * Es opcional. Sin él, esta función se comporta exactamente igual que antes:
 * los Niveles 0, 1, 3, 4 y 5 no cambian ni una coma.
 */
export interface PuntoEnganche {
  /** Dónde va la malla en este cuadro. */
  punto: Vector3;
  /** Sostenida en el aire: sin sombra de contacto, que es de apoyo. */
  enElAire: boolean;
}

export type BuscarEnganche = (posicionLibre: Vector3) => PuntoEnganche | null;

export function hacerArrastrable(
  mesh: Mesh,
  alturaFija: number,
  limites?: LimitesArrastre,
  buscarEnganche?: BuscarEnganche
): { onSoltar: Observable<ResultadoSoltar>; onAgarrar: Observable<Mesh>; comportamiento: PointerDragBehavior } {
  const comportamiento = new PointerDragBehavior({ dragPlaneNormal: Vector3.Up() });
  comportamiento.useObjectOrientationForDragging = false;

  // Con enganche, la malla la coloca ESTE módulo y no el comportamiento.
  //
  // PointerDragBehavior no aplica el desplazamiento de golpe: acumula un
  // objetivo interno y cada cuadro acerca la malla un 20 % hacia él. Si además
  // nosotros la movemos a la balda, las dos fuerzas se pelean y el objeto
  // tirita entre el piso y la repisa. Con moveAttached en false el
  // comportamiento solo informa dónde está el cursor y no toca la malla.
  if (buscarEnganche) comportamiento.moveAttached = false;

  const onSoltar = new Observable<ResultadoSoltar>();
  const onAgarrar = new Observable<Mesh>();

  let posicionAlAgarrar = mesh.position.clone();

  // Distancia entre el punto donde se pinchó y el origen del objeto. Sin esto
  // el objeto salta para centrarse bajo el cursor al primer movimiento.
  const desfaseAgarre = new Vector3();
  const posicionLibre = new Vector3();

  // Escala del objeto antes de tomarlo, para devolvérsela al soltar.
  let escalaBase = mesh.scaling.x;

  comportamiento.onDragStartObservable.add((evento) => {
    posicionAlAgarrar = mesh.position.clone();

    if (buscarEnganche) {
      desfaseAgarre.set(
        mesh.position.x - evento.dragPlanePoint.x,
        0,
        mesh.position.z - evento.dragPlanePoint.z
      );
      posicionLibre.set(mesh.position.x, alturaFija, mesh.position.z);
    }

    // La escala de agarre se calcula sobre la que TENGA el objeto, no sobre 1.
    //
    // Antes se fijaba 1,15 al tomar y 1 al soltar, dando por hecho que todos
    // los objetos venían a tamaño natural. Desde que el Nivel 1 los agranda
    // para que se distingan en el galpón, eso los encogía de golpe al primer
    // clic y los dejaba diminutos para siempre.
    escalaBase = mesh.scaling.x;
    mesh.scaling.setAll(escalaBase * 1.15);
    reproducir("agarrar");
    onAgarrar.notifyObservers(mesh);
  });

  comportamiento.onDragObservable.add((evento) => {
    // --- Camino de siempre: sin enganche, el objeto se desliza por el piso ---
    if (!buscarEnganche) {
      mesh.position.y = alturaFija;

      if (limites) {
        mesh.position.x = Math.min(limites.xMax, Math.max(limites.xMin, mesh.position.x));
        mesh.position.z = Math.min(limites.zMax, Math.max(limites.zMin, mesh.position.z));
      }

      // Va despues de aplicar los limites: si se calculara antes, la sombra
      // quedaria adelantada al objeto contra los bordes del recinto.
      actualizarSombraContacto(mesh.getScene(), mesh);
      return;
    }

    // --- Camino con enganche ---
    //
    // La posición libre se calcula ENTERA a partir de dónde corta el cursor el
    // plano de arrastre, no sumando desplazamientos. Es lo que permite que el
    // objeto vuelva al piso exactamente donde está el cursor al desimantarse:
    // acumulando, cada viaje a la repisa dejaría un desfase que no se corrige
    // nunca.
    posicionLibre.set(
      evento.dragPlanePoint.x + desfaseAgarre.x,
      alturaFija,
      evento.dragPlanePoint.z + desfaseAgarre.z
    );

    if (limites) {
      posicionLibre.x = Math.min(limites.xMax, Math.max(limites.xMin, posicionLibre.x));
      posicionLibre.z = Math.min(limites.zMax, Math.max(limites.zMin, posicionLibre.z));
    }

    const enganche = buscarEnganche(posicionLibre);
    mesh.position.copyFrom(enganche ? enganche.punto : posicionLibre);

    if (enganche?.enElAire) {
      // En el aire no hay sombra de contacto: es lo que hace evidente que el
      // objeto se despegó del piso y está sostenido sobre el sitio.
      ocultarSombraContacto(mesh.getScene());
      return;
    }

    actualizarSombraContacto(mesh.getScene(), mesh);
  });

  comportamiento.onDragEndObservable.add(() => {
    mesh.scaling.setAll(escalaBase);
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