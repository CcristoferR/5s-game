import { Scene, Vector3, Ray, type AbstractMesh, type Camera, type Observer, type TransformNode } from "@babylonjs/core";
import type { AsaltoBanco } from "./AsaltoBanco";

// ===========================================================================
// Lo que el guardia alcanzó a ver
// ===========================================================================
//
// Mientras dura el asalto se va anotando, en silencio, qué datos de los dos
// sujetos tuvo el jugador delante de los ojos el tiempo suficiente para
// poder contarlos después. Nada de esto sale en pantalla: no hay barra de
// "observando" ni aviso de "visto". Se nota en la declaración, cuando
// Carabineros pregunta por algo que no se miró.
//
// ─── QUÉ ES "HABERLO VISTO" ─────────────────────────────────────────────
//
// Lo mismo que en el supermercado, dato por dato:
//   · estar a la distancia en que ese detalle se distingue —una cara, de
//     cerca; una chaqueta, desde el otro lado del hall—;
//   · estar donde se mira: dentro de un cono alrededor del centro de la
//     pantalla, no pegado al borde;
//   · sin nada sólido en medio: un muro, una columna, la puerta cerrada. Los
//     vidrios no tapan;
//   · y un rato: alrededor de un segundo. De un vistazo al pasar no se saca
//     una descripción.
//
// ─── Y POR QUÉ NO SE VIO ────────────────────────────────────────────────
//
// De lo que no se vio se guarda también el motivo, para que la declaración
// pueda decirlo: si mientras se podía ver el guardia estaba en el suelo —por
// hacerse el héroe—, o si simplemente miraba hacia otra parte. Para saberlo
// se cuenta, además, el tiempo en que cada dato estuvo AL ALCANCE: visible
// desde el puesto, de pie, mirando hacia donde había que mirar.

export type DatoAsalto =
  /** Cuántos eran: haber visto a los dos. */
  | "cuantos"
  /** Sujeto 1: la cara y el gorro. */
  | "s1Cara"
  /** Sujeto 1: la chaqueta y el pantalón. */
  | "s1Ropa"
  /** Sujeto 1: la contextura y la estatura, que piden verlo entero. */
  | "s1Cuerpo"
  /** Sujeto 1: el arma en la mano. */
  | "s1Arma"
  /** Sujeto 2: el polerón con la capucha. */
  | "s2Ropa"
  /** Sujeto 2: contextura, estatura y las zapatillas: entero. */
  | "s2Cuerpo"
  /** Sujeto 2: el bolso negro. */
  | "s2Bolso"
  /** Hacia dónde se fueron: verlos ya fuera, por la puerta o las ventanas. */
  | "huida";

export const DATOS_ASALTO: readonly DatoAsalto[] = [
  "cuantos",
  "s1Cara",
  "s1Ropa",
  "s1Cuerpo",
  "s1Arma",
  "s2Ropa",
  "s2Cuerpo",
  "s2Bolso",
  "huida",
];

/** Por qué no se vio un dato. */
export type MotivoNoVisto = "suelo" | "otraParte";

export interface ResumenObservacion {
  vistos: DatoAsalto[];
  /** De cada dato no visto, por qué. */
  noVistos: { dato: DatoAsalto; motivo: MotivoNoVisto }[];
  /** Las frases que se dijeron. Se oyen siempre, se mire o no. */
  oidas: string[];
}

export interface ObservacionBanco {
  visto(d: DatoAsalto): boolean;
  /** Null si se vio. */
  motivo(d: DatoAsalto): MotivoNoVisto | null;
  resumen(): ResumenObservacion;
  dispose(): void;
}

export interface OpcionesObservacion {
  camara: Camera;
  /** Los ojos del guardia de pie en su puesto, aunque esté en el suelo. */
  ojosDePie: Vector3;
  asalto: AsaltoBanco;
  /** Si el guardia está en el suelo ahora mismo. */
  enElSuelo: () => boolean;
  /** Si el turno corre: con un panel o la pausa delante, no se cuenta nada. */
  corriendo: () => boolean;
  /** Lo que tapa la vista. */
  tapa: (m: AbstractMesh) => boolean;
}

/** Un detalle que se puede ver: dónde está, desde qué distancia y con qué ángulo. */
interface Mira {
  punto: () => Vector3 | null;
  /** Hasta dónde se distingue, en metros. */
  alcance: number;
  /** Medio ángulo del cono de la mirada, en radianes. */
  cono: number;
}

/** Cuánto hay que tenerlo delante para que cuente, en segundos. */
const UMBRAL = 1.0;
/** Salvo la huida: se les ve pasar, no posar. */
const UMBRAL_HUIDA = 0.6;
/** Cada cuántos cuadros se mira: los rayos son lo caro, y la vista no cambia tanto. */
const CADA = 3;

export function crearObservacionBanco(scene: Scene, o: OpcionesObservacion): ObservacionBanco {
  const nodo = (nombre: string): TransformNode | null => scene.getTransformNodeByName(nombre);
  const malla = (nombre: string): AbstractMesh | null => scene.getMeshByName(nombre);
  const [s1, s2] = o.asalto.sujetos;
  const dentro = (f: typeof s1): boolean => f.raiz.isEnabled();

  // Los puntos de cada sujeto, en el mundo, cada vez que se piden.
  const cabeza = (n: string) => (): Vector3 | null => {
    const c = nodo(`${n}_cabeza`);
    return c ? c.getAbsolutePosition().add(new Vector3(0, 0.1, 0)) : null;
  };
  const pecho = (n: string) => (): Vector3 | null => {
    const c = nodo(`${n}_cuerpo`);
    return c ? c.getAbsolutePosition().add(new Vector3(0, 0.28, 0)) : null;
  };
  const pies = (f: typeof s1) => (): Vector3 => f.raiz.position.add(new Vector3(0, 0.08, 0));

  const MIRAS = {
    s1Cabeza: { punto: cabeza("asalto_sujeto1"), alcance: 5.5, cono: 0.45 },
    s1Pecho: { punto: pecho("asalto_sujeto1"), alcance: 11, cono: 0.55 },
    s1Pies: { punto: pies(s1), alcance: 11, cono: 0.6 },
    s1Arma: {
      punto: () => malla("asalto_sujeto1_arma")?.getAbsolutePosition() ?? null,
      alcance: 7,
      cono: 0.5,
    },
    s2Cabeza: { punto: cabeza("asalto_sujeto2"), alcance: 11, cono: 0.55 },
    s2Pecho: { punto: pecho("asalto_sujeto2"), alcance: 11, cono: 0.55 },
    s2Pies: { punto: pies(s2), alcance: 11, cono: 0.6 },
    s2Bolso: {
      punto: () => nodo("asalto_sujeto2_asaBolso")?.getAbsolutePosition().add(new Vector3(0, -0.25, 0)) ?? null,
      alcance: 9,
      cono: 0.55,
    },
  } satisfies Record<string, Mira>;

  // Lo que hay que ver a la vez para que cuente cada dato, y de quién es.
  const REQUIERE: Record<Exclude<DatoAsalto, "cuantos" | "huida">, { quien: typeof s1; miras: Mira[] }> = {
    s1Cara: { quien: s1, miras: [MIRAS.s1Cabeza] },
    s1Ropa: { quien: s1, miras: [MIRAS.s1Pecho] },
    s1Cuerpo: { quien: s1, miras: [MIRAS.s1Cabeza, MIRAS.s1Pies] },
    s1Arma: { quien: s1, miras: [MIRAS.s1Arma] },
    s2Ropa: { quien: s2, miras: [MIRAS.s2Pecho] },
    s2Cuerpo: { quien: s2, miras: [MIRAS.s2Cabeza, MIRAS.s2Pies] },
    s2Bolso: { quien: s2, miras: [MIRAS.s2Bolso] },
  };

  const tiempoVisto = new Map<DatoAsalto, number>();
  const alAlcance = new Map<DatoAsalto, number>();
  const alAlcanceEnSuelo = new Map<DatoAsalto, number>();
  const vistos = new Set<DatoAsalto>();
  const sumar = (m: Map<DatoAsalto, number>, d: DatoAsalto, dt: number): void => {
    m.set(d, (m.get(d) ?? 0) + dt);
  };

  const rayo = new Ray(Vector3.Zero(), Vector3.Forward(), 1);
  const hacia = new Vector3();
  /** Si ese punto se ve desde esos ojos: cerca, sin nada en medio y, si se pide, en el cono. */
  const seVe = (ojos: Vector3, punto: Vector3, alcance: number, cono: number | null): boolean => {
    punto.subtractToRef(ojos, hacia);
    const distancia = hacia.length();
    if (distancia < 0.05 || distancia > alcance) return false;
    hacia.scaleInPlace(1 / distancia);
    if (cono !== null && Vector3.Dot(o.camara.getDirection(Vector3.Forward()), hacia) < Math.cos(cono)) return false;
    // Un pelo corto: llegando justo, el rayo toca lo que se quiere ver.
    rayo.origin.copyFrom(ojos);
    rayo.direction.copyFrom(hacia);
    rayo.length = distancia - 0.1;
    const golpe = scene.pickWithRay(rayo, o.tapa, true);
    return !golpe?.hit;
  };

  let cuadro = 0;
  let acumulado = 0;
  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const fase = o.asalto.fase();
    if (!o.corriendo() || (fase !== "dentro" && fase !== "huida" && fase !== "despues")) return;
    acumulado += dt;
    cuadro += 1;
    if (cuadro % CADA !== 0) return;
    const paso = acumulado;
    acumulado = 0;

    const ojos = o.camara.globalPosition;
    const suelo = o.enElSuelo();

    // Cada dato de los sujetos, mientras están dentro de la escena.
    for (const [dato, req] of Object.entries(REQUIERE) as [DatoAsalto, (typeof REQUIERE)[keyof typeof REQUIERE]][]) {
      if (!dentro(req.quien)) continue;
      const puntos = req.miras.map((m) => m.punto());
      if (puntos.some((p) => p === null)) continue;
      // Al alcance: desde el puesto, de pie, girando la cabeza lo que haga falta.
      const alcance = req.miras.every((m, i) => seVe(o.ojosDePie, puntos[i]!, m.alcance, null));
      if (!alcance) continue;
      sumar(alAlcance, dato, paso);
      if (suelo) sumar(alAlcanceEnSuelo, dato, paso);
      // Visto: desde donde están de verdad los ojos, y mirándolo.
      const enVista = !suelo && req.miras.every((m, i) => seVe(ojos, puntos[i]!, m.alcance, m.cono));
      if (enVista) {
        sumar(tiempoVisto, dato, paso);
        if ((tiempoVisto.get(dato) ?? 0) >= UMBRAL) vistos.add(dato);
      }
    }

    // Cuántos eran: haber visto a cada uno, de lo que sea.
    const alguno1 = ["s1Cara", "s1Ropa", "s1Cuerpo", "s1Arma"].some((d) => (tiempoVisto.get(d as DatoAsalto) ?? 0) >= 0.5);
    const alguno2 = ["s2Ropa", "s2Cuerpo", "s2Bolso"].some((d) => (tiempoVisto.get(d as DatoAsalto) ?? 0) >= 0.5);
    if (alguno1 && alguno2) vistos.add("cuantos");
    if (dentro(s1) || dentro(s2)) {
      const a = alAlcance.get("s1Ropa") ?? 0;
      const b = alAlcance.get("s2Ropa") ?? 0;
      alAlcance.set("cuantos", Math.min(a, b));
      alAlcanceEnSuelo.set("cuantos", Math.min(alAlcanceEnSuelo.get("s1Ropa") ?? 0, alAlcanceEnSuelo.get("s2Ropa") ?? 0));
    }

    // Hacia dónde se fueron: a cualquiera de los dos, ya fuera del banco —por
    // la puerta abierta o por las ventanas del costado—.
    if (fase === "huida" || fase === "despues") {
      for (const f of [s1, s2]) {
        if (!dentro(f)) continue;
        const p = f.raiz.position;
        const fuera = p.z < -4.25 || p.x < -4.5;
        if (!fuera) continue;
        const pecho = p.add(new Vector3(0, 1.2, 0));
        if (!seVe(o.ojosDePie, pecho, 25, null)) continue;
        sumar(alAlcance, "huida", paso / 2);
        if (suelo) sumar(alAlcanceEnSuelo, "huida", paso / 2);
        if (!suelo && seVe(ojos, pecho, 25, 0.6)) {
          sumar(tiempoVisto, "huida", paso);
          if ((tiempoVisto.get("huida") ?? 0) >= UMBRAL_HUIDA) vistos.add("huida");
        }
      }
    }
  });

  const motivo = (d: DatoAsalto): MotivoNoVisto | null => {
    if (vistos.has(d)) return null;
    const total = alAlcance.get(d) ?? 0;
    const enSuelo = alAlcanceEnSuelo.get(d) ?? 0;
    return total > 0 && enSuelo >= total * 0.5 ? "suelo" : "otraParte";
  };

  return {
    visto: (d) => vistos.has(d),
    motivo,
    resumen: () => ({
      vistos: DATOS_ASALTO.filter((d) => vistos.has(d)),
      noVistos: DATOS_ASALTO.filter((d) => !vistos.has(d)).map((d) => ({ dato: d, motivo: motivo(d) ?? "otraParte" })),
      oidas: [...o.asalto.frasesDichas()],
    }),
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
    },
  };
}
