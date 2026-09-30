import {
  Scene,
  Mesh,
  Vector3,
  VertexBuffer,
  TransformNode,
  type AbstractMesh,
  type Observer,
} from "@babylonjs/core";

// ===========================================================================
// La puerta del banco
// ===========================================================================
//
// El modelo trae la puerta en una sola malla con su marco: la hoja no se
// podía abrir. Y por esa puerta entra y sale la gente —y va a entrar más
// adelante lo que no es gente corriente—, así que aquí se separa la hoja del
// marco y se cuelga de su bisagra.
//
// Se abre hacia fuera, como toda puerta de salida de un local con público, y
// sola: cuando alguien llega a ella por cualquiera de los dos lados. Se cierra
// más despacio de lo que se abre, que es lo que hace el cierrapuertas.
//
// ─── LA BISAGRA, DEL LADO DEL GUARDIA ────────────────────────────────────
//
// El modelo la trae con el pomo a la derecha, o sea, con la bisagra a la
// izquierda: abierta hacia fuera, la hoja quedaba justo en la línea de vista
// del puesto y tapaba la vereda de la izquierda, que es por donde se van los
// del asalto. Se le da media vuelta a la hoja —el pomo pasa a la izquierda,
// y es igual por las dos caras— y se cuelga de la derecha: abierta, queda
// del lado del guardia, pegada a la fachada, y la izquierda se ve entera.

/**
 * La hoja, medida triángulo a triángulo en el modelo a escala 3: una losa de
 * X −0,002 a 1,335, Y 0,634 a 2,665 y Z −4,019 a −3,990, más el tablero en
 * relieve y el pomo por fuera, que llega a Z −4,147.
 *
 * Lo que la separa del marco es el GROSOR, no el contorno: el revestimiento
 * del vano, el alféizar y el dintel pasan por los mismos X e Y que la hoja
 * pero atraviesan el muro entero, de −4,188 a −3,807. En esa profundidad solo
 * cabe la hoja.
 */
const HOJA = { x0: -0.01, x1: 1.34, y0: 0.62, y1: 2.67, z0: -4.15, z1: -3.985 };
/** La bisagra: el canto izquierdo de la hoja, visto desde dentro, en su cara de fuera. */
const BISAGRA = new Vector3(1.335, 0, -4.019);
/** Centro del vano, para saber quién está llegando a la puerta. */
export const CENTRO_PUERTA = new Vector3(0.667, 0, -4.0);
/** Lo abierta que queda: casi a escuadra con el muro de fuera. */
const ABIERTA = -1.45;
/** A qué distancia del vano alguien hace que se abra. */
const ALCANCE = 1.45;
/**
 * Lo que cede la hoja con la llave echada cuando alguien la empuja: el juego
 * del pestillo en el cerradero, un centímetro y medio en el canto. Lo justo
 * para que se vea que se empujó y que no abrió.
 */
const JUEGO_CON_LLAVE = -0.012;
/** Lo que dura el golpeteo de la hoja contra el marco, en segundos. */
const DURA_EMPUJON = 0.55;

export interface PuertaBanco {
  /** De 0 cerrada a 1 abierta del todo. */
  apertura(): number;
  /**
   * La abre de un empujón y la sujeta abierta esos segundos: quien entra a la
   * carrera no espera a que la puerta se abra sola. Después la suelta y el
   * cierrapuertas la cierra como siempre.
   */
  forzar(segundos: number): void;
  /**
   * Echa la llave, o la quita. Con la llave echada la puerta ya no se abre
   * para quien llega a ella: se queda cerrada aunque la empujen. Un empujón de
   * los que la revientan (forzar) la abre igual.
   */
  trancar(conLlave: boolean): void;
  /** Si tiene la llave echada. */
  trancada(): boolean;
  /**
   * Alguien la empuja con la llave echada: la hoja cede lo que da el pestillo
   * y golpea dos o tres veces contra el marco. Sin llave no hace nada: la
   * puerta ya se abre sola.
   */
  empujar(): void;
  /** La deja quieta como esté, o la suelta. Para la pausa. */
  congelar(quieta: boolean): void;
  dispose(): void;
}

/**
 * @param malla     La malla de la puerta con su marco (material "set13").
 * @param quienes   Dónde está cada uno de los que pueden cruzar, cada cuadro.
 *                  Los que no están en escena no cuentan.
 */
export function montarPuertaBanco(scene: Scene, malla: Mesh, quienes: () => Vector3[]): PuertaBanco | null {
  const hoja = separarHoja(malla);
  if (!hoja) return null;
  const bisagra = new TransformNode("bisagraPuertaBanco", scene);
  bisagra.position.copyFrom(BISAGRA);
  hoja.setParent(bisagra);

  let angulo = 0;
  let quieta = false;
  /** Segundos que le quedan sujeta abierta. Ver forzar. */
  let sujeta = 0;
  /** Con la llave echada: no se abre para quien llega. Ver trancar. */
  let conLlave = false;
  /** Segundos que le quedan al golpeteo de un empujón con llave. Ver empujar. */
  let empujon = 0;
  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (quieta) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    sujeta = Math.max(0, sujeta - dt);
    const alguien =
      sujeta > 0 ||
      (!conLlave && quienes().some((p) => Math.hypot(p.x - CENTRO_PUERTA.x, p.z - CENTRO_PUERTA.z) < ALCANCE));
    const objetivo = alguien ? ABIERTA : 0;
    // (ABIERTA es negativa: la bisagra está a la derecha, ver arriba.)
    // Abre en algo más de medio segundo; cierra en un segundo y medio, y los
    // últimos grados despacio: el cierrapuertas frena antes del golpe. De un
    // empujón, en un cuarto de segundo.
    const rapidez = sujeta > 0 ? 11 : alguien ? 5 : 2.2;
    angulo += (objetivo - angulo) * Math.min(1, dt * rapidez);
    if (!alguien && Math.abs(angulo) < 0.004) angulo = 0;
    // El empujón con la llave echada: la hoja va y vuelve contra el marco,
    // cada vez con menos fuerza, como quien sacude una puerta que no abre.
    let juego = 0;
    if (empujon > 0) {
      empujon = Math.max(0, empujon - dt);
      const hecho = DURA_EMPUJON - empujon;
      juego = JUEGO_CON_LLAVE * Math.abs(Math.sin(hecho * 17)) * (empujon / DURA_EMPUJON);
    }
    bisagra.rotation.y = angulo + juego;
  });

  return {
    apertura: () => angulo / ABIERTA,
    forzar(segundos) {
      sujeta = Math.max(sujeta, segundos);
    },
    trancar(si) {
      conLlave = si;
    },
    trancada: () => conLlave,
    empujar() {
      if (conLlave && angulo === 0) empujon = DURA_EMPUJON;
    },
    congelar(q) {
      quieta = q;
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
    },
  };
}

/**
 * Aparta la hoja de la malla de la puerta y la deja en coordenadas del mundo.
 *
 * Por triángulos: los que caen enteros dentro de la caja de la hoja (ver
 * HOJA).
 */
function separarHoja(malla: Mesh): Mesh | null {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  const indices = malla.getIndices();
  if (!pos || !indices) return null;
  const mundo = malla.computeWorldMatrix(true);
  const v = new Vector3();
  const dentro = (i: number): boolean => {
    Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], mundo, v);
    return (
      v.x >= HOJA.x0 && v.x <= HOJA.x1 && v.y >= HOJA.y0 && v.y <= HOJA.y1 && v.z >= HOJA.z0 && v.z <= HOJA.z1
    );
  };
  const deLaHoja: number[] = [];
  const resto: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    (dentro(a) && dentro(b) && dentro(c) ? deLaHoja : resto).push(a, b, c);
  }
  if (!deLaHoja.length) return null;
  const hoja = malla.clone("hojaPuertaBanco", malla.parent)!;
  hoja.makeGeometryUnique();
  hoja.setIndices(deLaHoja);
  malla.setIndices(resto);
  // Fuera de la jerarquía del modelo y con su escala horneada: así cuelga de
  // la bisagra con su tamaño real y gira sobre ella.
  hoja.setParent(null);
  hoja.bakeCurrentTransformIntoVertices();
  // Media vuelta sobre su propio eje vertical: el pomo pasa al canto de la
  // izquierda y la bisagra puede ir a la derecha. Ver la cabecera.
  const centroX = 0.6665;
  const centroZ = -4.0045;
  hoja.setPivotPoint(new Vector3(centroX, 0, centroZ));
  hoja.rotation.y = Math.PI;
  hoja.bakeCurrentTransformIntoVertices();
  hoja.setPivotPoint(Vector3.Zero());
  // La caja envolvente, la de la hoja sola: la del clon era la de la puerta
  // entera, con el marco.
  hoja.refreshBoundingInfo();
  hoja.isPickable = false;
  hoja.checkCollisions = false;
  return hoja;
}

/** Para dejar la hoja fuera de lo que da sombra o se refleja, si hace falta. */
export function esHojaPuerta(m: AbstractMesh): boolean {
  return m.name === "hojaPuertaBanco";
}
