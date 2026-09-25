import {
  Scene,
  Color3,
  Plane,
  Vector3,
  Matrix,
  Frustum,
  BoundingBox,
  MirrorTexture,
  PBRMaterial,
  StandardMaterial,
  HemisphericLight,
  type SpotLight,
  type AbstractMesh,
  type DefaultRenderingPipeline,
} from "@babylonjs/core";

// ===========================================================================
// La sala al anochecer
// ===========================================================================
//
// Fuera el sol baja, el cielo se pone naranjo y se encienden los faroles (ver
// ExteriorSupermercado). Dentro, hasta ahora, la sala era exactamente la misma
// a las 16:00 que a las 19:55: los mismos focos, la misma intensidad, el mismo
// piso. El reloj avanzaba y el local no se enteraba.
//
// Esto es lo que cambia dentro con la hora:
//
//   · LAS VIDRIERAS SE VUELVEN ESPEJO. Es lo que se ve en cualquier local de
//     noche: con la calle a oscuras y la sala encendida, el vidrio deja de
//     mostrar lo de fuera y devuelve lo de dentro. Aquí es un reflejo PLANO de
//     verdad —la sala renderizada otra vez desde el otro lado del vidrio—, no
//     una foto: en él se ven las góndolas, las luminarias y la gente pasando.
//   · LA SALA PASA A ALUMBRARSE SOLA. El relleno baja un poco —era en parte
//     la luz de día que rebota— y los focos suben: la luz se reparte menos
//     pareja y se hacen los charcos bajo las luminarias, que es como se ve un
//     local de noche. En conjunto la sala queda IGUAL de clara; lo que cambia
//     es de dónde viene la luz.
//   · LAS LUMINARIAS BRILLAN MÁS, y su reflejo en el piso pulido se marca más.
//     Contra las vidrieras oscuras, las líneas de luz del techo pasan a ser lo
//     que se ve de la sala.
//
// Nada de esto toca la lógica: solo luces, materiales y un espejo. Se llama
// cada minuto del turno junto con la hora de fuera.

/** Las dos puntas de la tarde para el interior. */
const DIA = {
  relleno: 0.66,
  focos: 20,
  opal: 2.6,
  resplandor: 0.32,
  piso: 0.55,
};
/**
 * De noche, menos relleno y más foco: la sala queda igual de clara donde se
 * mira —las baldas, el piso de los pasillos— y el contraste sube por arriba,
 * en el cielo raso y los muros, que es lo primero que delata que fuera ya no
 * hay día. Con la primera versión (0,54 y 25,5) la diferencia con las 16:00
 * se veía solo poniendo las dos capturas lado a lado.
 */
const NOCHE = {
  relleno: 0.49,
  focos: 29,
  opal: 3.5,
  resplandor: 0.46,
  piso: 0.72,
};

/**
 * Cuánto devuelve la vidriera de noche.
 *
 * ─── POR QUÉ TANTO MÁS QUE UN VIDRIO DE VERDAD ────────────────────────────
 *
 * Un vidrio refleja un cuatro por ciento visto de frente. Con eso tal cual el
 * espejo se dibujaba bien —se comprobó poniéndolo como espejo puro: salía la
 * sala entera, la gente caminando, los letreros al revés— pero sobre el vidrio
 * no se notaba nada: un velo del cuatro por ciento encima de la calle.
 *
 * En la realidad sí se nota porque de noche el ojo se adapta a la sala
 * encendida y la calle queda negra; una pantalla no se adapta. Así que el
 * vidrio sube su reflectancia al anochecer —el factor de F0, doce veces la de
 * día— y el espejo su nivel. Medido con capturas a las 19:57: con eso se ven
 * a la vez la calle de noche, con sus ventanas encendidas, y la sala encima,
 * que es exactamente como se ve un escaparate desde dentro.
 */
const REFLEJO_NOCHE = 2.4;
const F0_NOCHE = 12;

export interface NocheSala {
  /** Pone la sala a esa hora del día, en horas con decimales. */
  ajustarHora(hora: number): void;
}

export interface OpcionesNocheSala {
  focos: SpotLight[];
  tuberia: DefaultRenderingPipeline;
  /** El vidrio de las vidrieras y de las hojas de la puerta. */
  vidrio: PBRMaterial | null;
  /** El plano del vidrio de las vidrieras, en Z. */
  vidrioZ: number;
  /** Lo que no entra en el reflejo de las vidrieras. */
  excluir: (malla: AbstractMesh) => boolean;
}

/** Curva suave de 0 a 1 entre dos horas. */
const entre = (h: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (h - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function prepararNocheSala(scene: Scene, o: OpcionesNocheSala): NocheSala {
  const relleno = scene.getLightByName("luzRellenoSupermercado") as HemisphericLight | null;
  const opal = scene.getMaterialByName("matDifusorLuminaria") as StandardMaterial | null;
  const espejoPiso = scene.textures.find((t) => t.name === "espejoSueloSala") as MirrorTexture | undefined;
  const colorOpal = new Color3(1, 0.985, 0.95);

  // --- El espejo de las vidrieras -----------------------------------------
  //
  // Un reflejo plano, como el del piso, sobre el plano del vidrio. Los cuatro
  // paños y el marco fijo de la puerta están en el mismo plano, así que un
  // solo espejo sirve para todos; las hojas de la puerta van diecisiete
  // centímetros por dentro, y en ellas el reflejo sale corrido esa nada, que
  // en un vidrio que además se mueve no se ve.
  //
  // A 1024 y sin apenas desenfoque: al revés que el piso —que es porcelanato
  // y difumina—, un vidrio refleja nítido, y a 512 las luminarias salían
  // escalonadas.
  //
  // Y solo se dibuja cuando hace falta. De día el reflejo no se ve —la calle
  // está más clara que la sala— así que el espejo queda quieto y a cero; al
  // atardecer empieza a dibujarse cada cuadro. Además Babylon solo dibuja el
  // reflejo de un material cuando alguna malla con ese material está en
  // pantalla: mirando hacia el fondo del local, no cuesta nada.
  let espejo: MirrorTexture | null = null;
  if (o.vidrio) {
    espejo = new MirrorTexture("espejoVidrieras", 1024, scene, true);
    // La normal mira hacia la calle: es el lado que se recorta. Lo que queda
    // dentro de la sala es lo que se refleja.
    espejo.mirrorPlane = new Plane(0, 0, 1, -o.vidrioZ);
    espejo.adaptiveBlurKernel = 4;

    // Igual que el del piso: una malla solo entra si su imagen reflejada cae
    // dentro de lo que ve la cámara. Sin esto el espejo dibujaría el local
    // entero, incluido lo que queda a la espalda del jugador.
    const planos = Frustum.GetPlanes(Matrix.Identity());
    let cuadro = -1;
    const imagen = new BoundingBox(Vector3.Zero(), Vector3.Zero());
    const min = new Vector3();
    const max = new Vector3();
    espejo.renderListPredicate = (m) => {
      if (!m.isEnabled() || !m.isVisible || o.excluir(m)) return false;
      const camara = scene.activeCamera;
      if (!camara) return true;
      if (scene.getFrameId() !== cuadro) {
        cuadro = scene.getFrameId();
        Frustum.GetPlanesToRef(camara.getTransformationMatrix(), planos);
      }
      const caja = m.getBoundingInfo().boundingBox;
      min.set(caja.minimumWorld.x, caja.minimumWorld.y, 2 * o.vidrioZ - caja.maximumWorld.z);
      max.set(caja.maximumWorld.x, caja.maximumWorld.y, 2 * o.vidrioZ - caja.minimumWorld.z);
      imagen.reConstruct(min, max);
      return imagen.isInFrustum(planos);
    };
    espejo.level = 0;
    espejo.refreshRate = 0;
    o.vidrio.reflectionTexture = espejo;
  }

  let dibujando = false;
  return {
    ajustarHora(h) {
      // El interior va un poco por detrás del cielo: la sala se nota de noche
      // cuando fuera ya no hay luz, no cuando empieza el naranjo.
      const noche = entre(h, 18.6, 19.85);
      const mezcla = (a: number, b: number): number => a + (b - a) * noche;

      if (relleno) {
        relleno.intensity = mezcla(DIA.relleno, NOCHE.relleno);
        // Un punto más tibia: la luz de día que entraba por las vidrieras era
        // fría, y sin ella lo que queda es el LED de la sala.
        relleno.diffuse = Color3.Lerp(new Color3(1, 0.99, 0.96), new Color3(1, 0.965, 0.915), noche);
      }
      o.focos.forEach((foco) => (foco.intensity = mezcla(DIA.focos, NOCHE.focos)));
      if (opal) opal.emissiveColor = colorOpal.scale(mezcla(DIA.opal, NOCHE.opal));
      o.tuberia.bloomWeight = mezcla(DIA.resplandor, NOCHE.resplandor);
      if (espejoPiso) espejoPiso.level = mezcla(DIA.piso, NOCHE.piso);

      if (espejo && o.vidrio) {
        // El reflejo asoma con el ocaso y a las 19:45 ya es un espejo.
        const reflejo = entre(h, 18.8, 19.8);
        espejo.level = REFLEJO_NOCHE * reflejo;
        // De día, el vidrio de siempre; de noche, el que devuelve la sala.
        o.vidrio.metallicF0Factor = 1 + (F0_NOCHE - 1) * reflejo;
        const hace = reflejo > 0.005;
        // Solo al cambiar: volver a poner un refreshRate reinicia su cuenta, y
        // a cero significa "dibújate una vez más".
        if (hace !== dibujando) {
          dibujando = hace;
          espejo.refreshRate = hace ? 1 : 0;
        }
      }
    },
  };
}
