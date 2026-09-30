import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  TransformNode,
  DynamicTexture,
  type Observer,
} from "@babylonjs/core";
import { crearFigura, type PaletaFigura } from "./Figura";
import { Y_FUERA, type GenteBanco } from "./GenteBanco";
import type { Subtitulos } from "./SubtitulosTurno";

// ===========================================================================
// Carabineros
// ===========================================================================
//
// Llegan después del asalto —el puesto corta a negro y vuelve veinte minutos
// más tarde— y son dos, como llega una patrulla:
//
//   · el sargento, a un metro del guardia, que le toma la declaración. Con
//     su libreta en la izquierda y el lápiz en la derecha: mira al guardia
//     cuando pregunta y anota cuando se le contesta;
//   · un cabo junto a las cajas, resguardando el sitio del suceso —la caja 2,
//     que nadie debe tocar hasta que lleguen los peritos—.
//
// Se montan con el resto de la gente, al principio, y se quedan fuera de
// escena hasta que llegan: así se iluminan como los demás (ver
// ampliarLucesBanco) y tienen su sombra al pie.
//
// ─── EL UNIFORME ──────────────────────────────────────────────────────────
//
// El verde de Carabineros en chaqueta, pantalón y gorra de plato, con la
// camisa caqui en el cuello, el escudo dorado en la gorra, la placa y la
// radio al pecho: el "uniforme" de VestuarioFigura, en verde.

/** Verde oliva oscuro: el de la chaqueta y la gorra. */
const VERDE = new Color3(0.1, 0.15, 0.085);

function uniformeCarabinero(piel: Color3, rasgos: PaletaFigura["rasgos"]): PaletaFigura {
  return {
    uniforme: VERDE,
    pantalon: new Color3(0.085, 0.125, 0.072),
    piel,
    // La camisa caqui verdosa que asoma en el cuello.
    detalle: new Color3(0.46, 0.47, 0.34),
    gorra: true,
    pelo: new Color3(0.05, 0.04, 0.035),
    peinado: "rapado",
    prenda: "uniforme",
    zapato: new Color3(0.02, 0.02, 0.022),
    rasgos,
  };
}

/**
 * Dónde se para el sargento: a metro y medio del guardia, hacia el hall, en
 * la boca de la fila, que está libre. A esa distancia, desde los ojos del
 * guardia, se le ve de la gorra a la cintura, con la libreta en la que
 * anota; a un metro llenaba la pantalla y la libreta quedaba bajo el borde.
 *
 * Y a más de 1,45 m del centro de la puerta (ver ALCANCE en PuertaBanco): un
 * palmo más cerca y la puerta se le abría, y se quedaba abierta toda la
 * declaración.
 */
const SARGENTO = { x: 1.05, z: -2.45 };
/**
 * Por dónde entra el sargento: desde la explanada, donde dejó la patrulla,
 * derecho a la puerta y de ahí al guardia. Empieza a dos metros de la puerta,
 * fuera del alcance que la abre: se abre cuando él llega, no antes.
 */
const ENTRADA = [
  { x: 0.52, z: -6.2 },
  { x: 0.62, z: -4.8 },
  { x: 0.74, z: -3.45 },
  SARGENTO,
];
/** A qué paso entra: decidido, pero sin correr. */
const PASO_SARGENTO = 1.3;
/** El cabo: delante de las cajas 1 y 2, mirando al hall, lejos del paso. */
const CABO = { x: -2.55, z: 2.95 };
const MIRA_EL_CABO = { x: 0.9, z: 0.4 };

export interface OpcionesCarabineros {
  piso: number;
  /** Los ojos del guardia en su puesto. */
  guardia: Vector3;
  gente: GenteBanco;
  subtitulos: Subtitulos;
}

export interface CarabinerosBanco {
  /**
   * Los pone en escena: el cabo ya dentro, resguardando las cajas —entró
   * primero—, y el sargento fuera, en la explanada, a punto de entrar. Se
   * hace con la pantalla en negro.
   */
  preparar(): void;
  /**
   * El sargento entra: cruza la puerta, que se le abre, llega hasta el
   * guardia, se vuelve hacia él y saca la libreta. Avisa al llegar.
   */
  entrar(alLlegar: () => void): void;
  /** El sargento dice una frase: su boca y el subtítulo. */
  decir(frase: string, segundos: number): void;
  /** Mira al guardia y habla, sin subtítulo: la pregunta está escrita en el panel. */
  preguntar(segundos: number): void;
  /** Anota en la libreta lo que se le acaba de contestar. */
  anotar(segundos: number): void;
  /** Cierra la libreta y la baja: terminó. */
  guardarLibreta(): void;
  /**
   * El sargento lleva la vista a ese punto esos segundos —la cámara de la que
   * habla— y vuelve a mirar al guardia.
   */
  mirarUnRato(punto: Vector3, segundos: number): void;
  /** Dónde mirar para tenerle la cara delante. */
  cara(): Vector3;
  dispose(): void;
}

export function crearCarabinerosBanco(scene: Scene, o: OpcionesCarabineros): CarabinerosBanco {
  const { piso } = o;
  const en = (p: { x: number; z: number }, y = piso): Vector3 => new Vector3(p.x, y, p.z);

  const sargento = crearFigura(scene, "carabinero_sargento", {
    altura: 1.8,
    contextura: 1.06,
    fase: 1.9,
    paleta: uniformeCarabinero(new Color3(0.46, 0.32, 0.24), { nariz: 1.02, mandibula: 1.05, ancho: 1.02 }),
  });
  const cabo = crearFigura(scene, "carabinero_cabo", {
    altura: 1.74,
    contextura: 0.98,
    fase: 4.4,
    paleta: uniformeCarabinero(new Color3(0.4, 0.27, 0.2), { nariz: 0.96, mandibula: 0.92, ancho: 0.97 }),
  });
  const ojos = o.guardia.clone();
  sargento.situar(en(SARGENTO), new Vector3(ojos.x, piso, ojos.z));
  cabo.situar(en(CABO), en(MIRA_EL_CABO));
  sargento.visible(false);
  cabo.visible(false);
  o.gente.registrar(sargento);
  o.gente.registrar(cabo);

  // --- La libreta y el lápiz ---------------------------------------------
  //
  // No cuelgan de la mano: se colocan cada cuadro sobre la palma, con la
  // orientación del cuerpo del sargento. Así la libreta queda plana y de cara
  // a él aunque el brazo llegue a su sitio con el antebrazo algo girado.
  const materiales: PBRMaterial[] = [];
  const mat = (nombre: string, color: Color3, rugosidad: number): PBRMaterial => {
    const m = new PBRMaterial(`matCarabinero_${nombre}`, scene);
    m.albedoColor = color;
    m.metallic = 0;
    m.roughness = rugosidad;
    materiales.push(m);
    return m;
  };
  const libreta = new TransformNode("libretaSargento", scene);
  const tapa = MeshBuilder.CreateBox("libretaSargento_tapa", { width: 0.1, height: 0.012, depth: 0.145 }, scene);
  tapa.parent = libreta;
  tapa.material = mat("tapa", new Color3(0.05, 0.075, 0.05), 0.7);
  const hoja = MeshBuilder.CreateBox("libretaSargento_hoja", { width: 0.092, height: 0.002, depth: 0.136 }, scene);
  hoja.parent = libreta;
  hoja.position.y = 0.007;
  // La hoja, con renglones y lo que lleva escrito: de lejos, una hoja usada.
  const texHoja = new DynamicTexture("texLibretaSargento", { width: 128, height: 192 }, scene, true);
  {
    const ctx = texHoja.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#ece8dc";
    ctx.fillRect(0, 0, 128, 192);
    ctx.strokeStyle = "rgba(90,120,170,0.45)";
    ctx.lineWidth = 1;
    for (let y = 22; y < 192; y += 12) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(120, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(30,40,80,0.8)";
    ctx.lineWidth = 1.3;
    for (let r = 0; r < 9; r++) {
      const y = 20 + r * 12;
      const largo = 60 + ((r * 37) % 50);
      ctx.beginPath();
      ctx.moveTo(12, y);
      for (let x = 12; x < 12 + largo; x += 4) ctx.lineTo(x, y - 2 - ((x * 7 + r * 13) % 5));
      ctx.stroke();
    }
    texHoja.update(true);
  }
  const matHoja = mat("hoja", new Color3(1, 1, 1), 0.9);
  matHoja.albedoTexture = texHoja;
  hoja.material = matHoja;
  const lapiz = new TransformNode("lapizSargento", scene);
  const cuerpoLapiz = MeshBuilder.CreateCylinder("lapizSargento_cuerpo", { height: 0.13, diameter: 0.008, tessellation: 10 }, scene);
  cuerpoLapiz.parent = lapiz;
  // A lo largo de +Z, con la punta en el origen del nodo: el nodo se pone en
  // la punta y mira hacia donde queda el otro extremo.
  cuerpoLapiz.rotation.x = Math.PI / 2;
  cuerpoLapiz.position.z = 0.065;
  cuerpoLapiz.material = mat("lapiz", new Color3(0.04, 0.06, 0.16), 0.35);
  const piezas: Mesh[] = [tapa, hoja, cuerpoLapiz];
  piezas.forEach((m) => {
    m.isPickable = false;
    m.setEnabled(false);
  });

  // --- Lo que hace el sargento -------------------------------------------
  /** "entra": caminando hacia el guardia, con las manos libres y la libreta guardada. */
  type Modo = "entra" | "espera" | "pregunta" | "anota" | "guardada";
  let modo: Modo = "espera";
  let quedan = 0;
  let t = 0;
  let presentes = false;
  let cerrado = false;
  /** Adónde mira un rato, si se le pidió, y hasta cuándo. Ver mirarUnRato. */
  let miraAparte: { punto: Vector3; hasta: number } | null = null;
  const frente = new Vector3();
  const derecha = new Vector3();
  const arriba = Vector3.Up();
  const sobreLaLibreta = new Vector3();

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!presentes || cerrado) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    t += dt;
    if (modo === "pregunta" || modo === "anota") {
      quedan -= dt;
      if (quedan <= 0) modo = "espera";
    }

    const base = sargento.raiz.position;
    ojos.subtractToRef(base, frente);
    frente.y = 0;
    frente.normalize();
    derecha.set(frente.z, 0, -frente.x);

    if (miraAparte && t >= miraAparte.hasta) miraAparte = null;
    if (modo === "guardada") {
      sargento.apoyarManos(null);
      sargento.mirarA(miraAparte ? miraAparte.punto : ojos);
      return;
    }
    // Entrando: braceo de andar, y la vista al frente hasta cruzar la puerta;
    // dentro, ya al guardia, que es a quien viene a ver.
    if (modo === "entra") {
      sargento.mirarA(base.z > -3.3 ? ojos : null);
      return;
    }

    // La libreta, a la altura del pecho y algo a la izquierda: a la cintura
    // se leía como alguien que carga una bandeja.
    const escala = 1.8 / 1.75;
    const libretaEn = base
      .add(arriba.scale(1.25 * escala))
      .addInPlace(frente.scale(0.27))
      .addInPlace(derecha.scale(-0.06));
    const izquierda = libretaEn.add(arriba.scale(-0.035));
    sargento.mirarA(miraAparte ? miraAparte.punto : modo === "anota" ? libretaEn : ojos);

    // La libreta, tomada por su borde con la mano izquierda: a la altura del
    // centro de la mano —que queda un poco por debajo del punto de la palma,
    // con los dedos colgando— y corrida hacia el medio del cuerpo. Encima de
    // la palma, como estaba, flotaba ocho centímetros sobre la mano. Con el
    // borde de fuera algo más alto: de cara a quien escribe.
    libreta.position
      .copyFrom(sargento.palmaEnMundo(0))
      .addInPlace(arriba.scale(-0.045))
      .addInPlace(derecha.scale(0.045));
    libreta.rotation.set(-0.55, Math.atan2(frente.x, frente.z), 0);

    // El lápiz se pone por la punta: sobre la hoja cuando escribe —va y
    // vuelve a lo ancho del renglón, baja despacio y se levanta un poco entre
    // palabra y palabra—, y apoyado en el borde de la libreta cuando escucha.
    // La mano, encima, algo atrás y a la derecha de la punta, que es como se
    // toma un lápiz para escribir. Puesto desde la palma, apuntaba al techo
    // cada vez que la mano quedaba más baja que la hoja.
    sobreLaLibreta.copyFrom(libreta.position).addInPlace(arriba.scale(0.01));
    const punta =
      modo === "anota"
        ? sobreLaLibreta
            .add(derecha.scale(-0.01 + 0.03 * Math.sin(t * 1.7)))
            .addInPlace(frente.scale(0.015 * Math.sin(t * 0.7)))
            .addInPlace(arriba.scale(0.004 + 0.008 * Math.abs(Math.sin(t * 9.5))))
        : sobreLaLibreta.add(derecha.scale(0.07)).addInPlace(arriba.scale(0.02));
    const mano = punta.add(arriba.scale(0.055)).addInPlace(derecha.scale(0.035)).addInPlace(frente.scale(-0.03));
    sargento.apoyarManos([izquierda, mano]);
    lapiz.position.copyFrom(punta);
    lapiz.lookAt(
      punta.add(arriba.scale(0.8)).addInPlace(derecha.scale(0.45)).addInPlace(frente.scale(-0.4))
    );
  });

  return {
    preparar() {
      if (cerrado || presentes) return;
      presentes = true;
      modo = "entra";
      // Fuera, de cara a la puerta. La altura la pone GenteBanco, que baja a
      // la explanada a quien está pasado el umbral.
      sargento.situar(en(ENTRADA[0], Y_FUERA), en(ENTRADA[1], Y_FUERA));
      sargento.apoyarManos(null);
      cabo.situar(en(CABO), en(MIRA_EL_CABO));
      sargento.visible(true);
      cabo.visible(true);
      cabo.mirarA(en(MIRA_EL_CABO, piso + 1.4));
      piezas.forEach((m) => m.setEnabled(false));
    },
    entrar(alLlegar) {
      if (cerrado || !presentes) return;
      sargento.caminar(
        ENTRADA.slice(1).map((p) => en(p)),
        PASO_SARGENTO,
        () => {
          if (cerrado) return;
          sargento.mirarHacia(new Vector3(ojos.x, piso, ojos.z));
          // Se vuelve y, ya de cara, saca la libreta.
          modo = "espera";
          piezas.forEach((m) => m.setEnabled(true));
          alLlegar();
        }
      );
    },
    decir(frase, segundos) {
      if (cerrado) return;
      sargento.hablar(Math.max(0.5, segundos - 0.2));
      o.subtitulos.decir(frase, segundos);
      // Hablando se mira al guardia; caminando o con la libreta guardada, se
      // sigue en lo suyo.
      if (modo !== "guardada" && modo !== "entra") {
        modo = "pregunta";
        quedan = segundos;
      }
    },
    preguntar(segundos) {
      if (cerrado) return;
      sargento.hablar(Math.max(0.5, segundos));
      if (modo === "guardada" || modo === "entra") return;
      modo = "pregunta";
      quedan = segundos;
    },
    anotar(segundos) {
      if (cerrado || modo === "guardada" || modo === "entra") return;
      modo = "anota";
      quedan = segundos;
    },
    guardarLibreta() {
      modo = "guardada";
      piezas.forEach((m) => m.setEnabled(false));
    },
    mirarUnRato(punto, segundos) {
      if (cerrado) return;
      miraAparte = { punto: punto.clone(), hasta: t + segundos };
    },
    cara: () => sargento.raiz.position.add(new Vector3(0, 1.62, 0)),
    dispose() {
      cerrado = true;
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      piezas.forEach((m) => m.dispose());
      libreta.dispose();
      lapiz.dispose();
      texHoja.dispose();
      materiales.forEach((m) => m.dispose(true, true));
      // Las figuras las desmonta GenteBanco, que las tiene registradas.
    },
  };
}
