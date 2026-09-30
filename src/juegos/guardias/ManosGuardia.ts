import {
  Scene,
  Vector3,
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  TransformNode,
  type AbstractMesh,
  type Observer,
  type TargetCamera,
} from "@babylonjs/core";
import { crearFigura, type PaletaFigura } from "./Figura";
import { loft } from "./ModeladoFigura";

// ===========================================================================
// El cuerpo del guardia
// ===========================================================================
//
// El guardia era una cámara: miraba, pero no tenía cuerpo. Cuando el del
// arma grita "¡las manos donde las vea!" y se elige obedecer, no se veía
// obedecer. Primero fueron las manos: suben a la vista, abiertas, y se quedan
// ahí mientras los asaltantes están dentro; si mandan al guardia al suelo,
// quedan apoyadas en las baldosas; cuando se van, bajan.
//
// Ahora es el cuerpo entero. Mirando hacia abajo se ve lo que ve cualquiera
// que se mira a sí mismo de pie: el pecho del uniforme con la corbata y la
// placa, el cinturón con la hebilla y la radio —la del primer momento del
// asalto, la que no hay que tocar con un arma delante—, las piernas y los
// zapatos, y las manos colgando a los lados.
//
// ─── UNA FIGURA DE PIE EN EL PUESTO ──────────────────────────────────────
//
// Es una Figura entera —la misma de todos, con el uniforme del guardia—
// plantada en el puesto, con los ojos donde está la cámara y el cuerpo un
// palmo por detrás de ellos, que es donde está el de cualquiera. Gira con la
// vista, así que siempre queda debajo de ella. Se mueve con el mismo IK que
// usan los cajeros para teclear, con su peso, su respiración y su temblor.
//
// La cabeza no se dibuja: los ojos están dentro de ella. Y la radio del pecho
// del uniforme de fábrica pasa al cinturón, que es donde la lleva un guardia
// de sucursal y donde la busca la mano en el primer momento.
//
// ─── EN EL SUELO ─────────────────────────────────────────────────────────
//
// Tirado en el suelo no hay cuerpo que ver —queda debajo y detrás de los
// ojos—, así que ahí se dibujan solo los antebrazos y las manos, apoyadas en
// las baldosas delante de la cara. Mientras cae, la figura pasa de estar de
// pie en el puesto a ir colgada de la cámara, como iba antes: con la vista
// pegada al piso, sus hombros quedan donde las manos alcanzan las baldosas.
//
// ─── CON LA SALA, Y EN EL SUELO POR ENCIMA ───────────────────────────────
//
// De pie, el cuerpo se dibuja con la sala, tapando y tapado como cualquier
// cosa: justo delante del puesto hay una fila de sillas de espera, con el
// respaldo a un palmo de las rodillas, y mirando hacia abajo los zapatos
// quedan bajo el asiento. Dibujado por encima de todo, se habrían visto los
// pies encima de la silla.
//
// En el suelo, las manos van en su propio grupo, después de todo lo demás:
// la cámara queda a ras del piso, entre las patas de esas sillas, y una mano
// a cuarenta centímetros de los ojos no puede meterse en una de ellas.

/** Lo que hacen las manos. */
export type PoseManos =
  /** Colgando a los lados: se ven solo mirando hacia abajo. */
  | "abajo"
  /** A la vista, abiertas, a la altura del pecho: no se tiene nada en ellas. */
  | "vista"
  /** Más arriba, a la altura de la cara: lo que pide quien apunta a un metro. */
  | "alto"
  /** Apoyadas en el piso, delante: tirado en el suelo. */
  | "suelo";

export interface ManosGuardia {
  poner(pose: PoseManos): void;
  dispose(): void;
}

export interface OpcionesCuerpoGuardia {
  /** Los ojos del guardia de pie en su puesto: bajo ellos se planta el cuerpo. */
  ojos: Vector3;
  /** Cuánto está en el suelo, de 0 de pie a 1 tirado del todo (ver el puesto). */
  caida: () => number;
}

/** El nombre de la figura: sus piezas empiezan todas por él. */
export const NOMBRE_CUERPO_GUARDIA = "guardia_primeraPersona";

/** El uniforme del guardia de la sucursal: azul marino, camisa celeste en el puño. */
const UNIFORME_GUARDIA: PaletaFigura = {
  uniforme: new Color3(0.055, 0.07, 0.11),
  pantalon: new Color3(0.045, 0.052, 0.075),
  piel: new Color3(0.47, 0.33, 0.25),
  detalle: new Color3(0.26, 0.33, 0.44),
  pelo: new Color3(0.06, 0.05, 0.045),
  peinado: "rapado",
  prenda: "uniforme",
};

/** A qué altura de la figura quedan los ojos, para colgarla de ellos. */
const OJOS = 1.63;
/** Lo que el eje del cuerpo queda por detrás de los ojos: la cara por delante del cuello. */
const NUCA = 0.1;

/** Curva en S: arranca y frena sin tirones. */
function suave(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * @param piso  Dónde está el piso, para apoyar las manos en él.
 */
export function crearManosGuardia(scene: Scene, camara: TargetCamera, piso: number, o: OpcionesCuerpoGuardia): ManosGuardia {
  const f = crearFigura(scene, NOMBRE_CUERPO_GUARDIA, { paleta: UNIFORME_GUARDIA, altura: 1.75, fase: 0.8 });
  // Cuelga de un ancla que se lleva cada cuadro: de pie, en el puesto y
  // derecha; en el suelo, pegada a la cámara. Ver EN EL SUELO.
  const ancla = new TransformNode(`${NOMBRE_CUERPO_GUARDIA}_ancla`, scene);
  f.raiz.parent = ancla;
  f.raiz.position.set(0, -OJOS, -NUCA);
  // Las figuras nacen fuera de escena: esta está siempre.
  f.visible(true);

  const cintura = scene.getTransformNodeByName(`${NOMBRE_CUERPO_GUARDIA}_cuerpo`);
  const materialesRadio = cintura ? montarRadioAlCinto(scene, cintura) : [];

  // ─── QUÉ SE DIBUJA ────────────────────────────────────────────────────
  //
  //   · la cabeza y el cuello, nunca: los ojos están dentro;
  //   · la radio del pecho del uniforme, nunca: la radio va al cinturón;
  //   · los antebrazos y las manos, siempre;
  //   · el resto del cuerpo, solo de pie.
  const cabeza = scene.getTransformNodeByName(`${NOMBRE_CUERPO_GUARDIA}_cabeza`);
  const deLaCabeza = new Set<AbstractMesh>(cabeza ? cabeza.getChildMeshes(false) : []);
  const manos: AbstractMesh[] = [];
  const cuerpo: AbstractMesh[] = [];
  f.raiz.getChildMeshes(false).forEach((m) => {
    m.isPickable = false;
    const nombre = m.name.slice(NOMBRE_CUERPO_GUARDIA.length);
    if (deLaCabeza.has(m) || nombre === "_radio" || nombre === "_antena") {
      m.isVisible = false;
      return;
    }
    (/^_(antebrazo|mano)_/.test(nombre) ? manos : cuerpo).push(m);
  });
  let cuerpoALaVista = true;

  // Zapatos de uniforme: lustrados, no de calle.
  const zapato = scene.getMaterialByName(`mat${NOMBRE_CUERPO_GUARDIA}_zapato`);
  if (zapato instanceof PBRMaterial) zapato.roughness = 0.3;

  /** La sombra al pie, que pone el puesto después (ver sombrasAlPie). */
  let sombra: AbstractMesh | null = null;

  let pose: PoseManos = "abajo";
  /**
   * Un punto delante de los ojos, en el marco de la vista, pero con la
   * cabeza como mucho algo inclinada: quien se mira los zapatos con las manos
   * en alto no las baja con la vista, las sigue teniendo delante del pecho.
   * Con el marco entero de la cámara, mirando a plomo se le metían en él; con
   * este tope quedan a un palmo del pecho, arriba en la imagen.
   */
  const CABECEO_MANOS = 0.95;
  const marcoManos = new Matrix();
  const enVista = (x: number, y: number, z: number): Vector3 => {
    Matrix.RotationYawPitchRollToRef(camara.rotation.y, Math.min(camara.rotation.x, CABECEO_MANOS), 0, marcoManos);
    return Vector3.TransformCoordinates(new Vector3(x, y, z), marcoManos).addInPlace(camara.position);
  };
  const adelante = new Vector3();
  const dePie = new Vector3(o.ojos.x, piso + OJOS, o.ojos.z);

  // ─── LA MUÑECA ───────────────────────────────────────────────────────
  //
  // El IK lleva la palma a su sitio pero no gira la muñeca, y la mano de la
  // figura cuelga de canto, con la palma hacia el muslo: levantada así,
  // desde los ojos se veía de perfil, con los dedos hacia el centro, y
  // parecía que el guardia señalaba algo. Aquí la muñeca se gira según la
  // pose, sin saltos:
  //   · colgando, como cuelga la de cualquiera: algo girada hacia dentro;
  //   · a la vista y en alto, con el dorso hacia los ojos y los dedos arriba:
  //     es lo que se ve de las propias manos cuando se le muestran las palmas
  //     a quien se tiene delante;
  //   · en el suelo, con la palma contra las baldosas.
  const manosMallas = f.raiz.getChildMeshes(false).filter((m) => /_mano_/.test(m.name));
  const MUNECA: Record<PoseManos, [number, number, number]> = {
    // [doblez, giro, ladeo]; el giro y el ladeo, hacia fuera en cada mano.
    abajo: [0, -0.4, 0.08],
    vista: [0.38, -1.3, 0.08],
    alto: [0.5, -1.3, 0.08],
    suelo: [-0.35, -1.45, 0.08],
  };
  let dt = 0;

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

    // El ancla: de pie, en el puesto, derecha y girada con la vista; en el
    // suelo, donde la cámara y como ella.
    const caida = o.caida();
    const e = suave(caida);
    Vector3.LerpToRef(dePie, camara.position, e, ancla.position);
    ancla.rotation.set(camara.rotation.x * e, camara.rotation.y, camara.rotation.z * e);

    // El cuerpo, solo de pie del todo: al empezar a caer se va con la
    // cámara, que baja a ras del piso a través de donde estaba el pecho.
    const verCuerpo = caida <= 0;
    if (!sombra) sombra = f.raiz.getChildMeshes(true).find((m) => m.name.endsWith("_sombraAlPie")) ?? null;
    if (verCuerpo !== cuerpoALaVista) {
      cuerpoALaVista = verCuerpo;
      cuerpo.forEach((m) => (m.isVisible = verCuerpo));
      if (sombra) sombra.isVisible = verCuerpo;
      // En el suelo, las manos por encima de todo (ver CON LA SALA...).
      manos.forEach((m) => (m.renderingGroupId = verCuerpo ? 0 : 1));
    }

    const [doblez, giro, ladeo] = MUNECA[pose];
    const k = Math.min(1, dt * 6);
    manosMallas.forEach((m) => {
      const lado = m.name.endsWith("_1") ? 1 : -1;
      m.rotation.x += (doblez - m.rotation.x) * k;
      m.rotation.y += (lado * giro - m.rotation.y) * k;
      m.rotation.z += (lado * ladeo - m.rotation.z) * k;
    });
    switch (pose) {
      case "abajo":
        f.apoyarManos(null);
        break;
      case "vista":
        // Abiertas, algo separadas, a la altura del pecho y a un antebrazo
        // de distancia: se ven en las dos esquinas de abajo.
        f.apoyarManos([enVista(-0.23, -0.1, 0.36), enVista(0.23, -0.1, 0.36)]);
        break;
      case "alto":
        f.apoyarManos([enVista(-0.22, -0.03, 0.4), enVista(0.22, -0.03, 0.4)]);
        break;
      case "suelo": {
        // En el piso, delante de la cara y a los lados: donde se apoya quien
        // se tira al suelo. En el mundo, no en la cámara: el piso no se
        // inclina con la cabeza.
        camara.getDirectionToRef(Vector3.Forward(), adelante);
        adelante.y = 0;
        if (adelante.lengthSquared() < 1e-6) adelante.set(0, 0, 1);
        adelante.normalize();
        const ojo = camara.globalPosition;
        const y = piso + 0.03;
        const lado = (s: number): Vector3 =>
          new Vector3(ojo.x + adelante.x * 0.34 + adelante.z * s * 0.19, y, ojo.z + adelante.z * 0.34 - adelante.x * s * 0.19);
        f.apoyarManos([lado(-1), lado(1)]);
        break;
      }
    }
  });

  return {
    poner(p) {
      pose = p;
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      // La radio cuelga de la figura y se va con ella; sus materiales, no.
      f.dispose();
      materialesRadio.forEach((m) => m.dispose());
      ancla.dispose();
    },
  };
}

/**
 * La radio portátil en el cinturón, del lado derecho y algo hacia delante:
 * donde la alcanza la mano sin buscarla, y donde se ve al mirar hacia abajo.
 *
 * Una radio de mano de las de siempre: el cuerpo negro de cantos redondeados,
 * la antena de goma en la esquina de atrás, las dos perillas arriba, y el
 * clip que la sujeta al cinturón. Sin marca.
 *
 * En el marco de la cintura de la figura (el nodo "cuerpo", a la altura de
 * la cadera): el cinturón va de 7 a 11 cm por encima, y la radio cuelga de él
 * con la parte de arriba asomando un par de dedos.
 */
function montarRadioAlCinto(scene: Scene, cintura: TransformNode): PBRMaterial[] {
  const nombre = `${NOMBRE_CUERPO_GUARDIA}_radioCinto`;
  const mat = (sufijo: string, color: Color3, rugosidad: number): PBRMaterial => {
    const m = new PBRMaterial(`mat${nombre}_${sufijo}`, scene);
    m.albedoColor = color;
    m.metallic = 0;
    m.roughness = rugosidad;
    return m;
  };
  const plastico = mat("plastico", new Color3(0.022, 0.022, 0.025), 0.5);
  const goma = mat("goma", new Color3(0.015, 0.015, 0.017), 0.85);
  const perilla = mat("perilla", new Color3(0.035, 0.035, 0.04), 0.4);

  // Dónde va: sobre la curva del cinturón, a un ángulo de su frente. El
  // cinturón es una elipse de 16 por 10,3 cm de semiejes (ver VestuarioFigura).
  const angulo = 0.85;
  const sx = 0.159;
  const sz = 0.103;
  const px = sx * Math.sin(angulo);
  const pz = sz * Math.cos(angulo);
  const normal = new Vector3(px / (sx * sx), 0, pz / (sz * sz)).normalize();
  const FONDO = 0.0175;
  const CLIP = 0.005;
  const soporte = new TransformNode(nombre, scene);
  soporte.parent = cintura;
  soporte.position.set(px + normal.x * (FONDO + CLIP), 0.068, pz + normal.z * (FONDO + CLIP));
  soporte.rotation.y = Math.atan2(normal.x, normal.z);

  const poner = (m: Mesh, material: PBRMaterial): Mesh => {
    m.parent = soporte;
    m.material = material;
    m.isPickable = false;
    return m;
  };
  // El cuerpo: 5,8 de ancho, 3,5 de fondo y 13 de alto, de cantos redondos.
  poner(
    loft(scene, `${nombre}_cuerpo`, [
      { y: -0.066, x: 0.022, delante: 0.012, forma: 3 },
      { y: -0.062, x: 0.028, delante: 0.017, forma: 3.6 },
      { y: 0.052, x: 0.029, delante: 0.0175, forma: 3.6 },
      { y: 0.06, x: 0.027, delante: 0.016, forma: 3.4 },
      { y: 0.064, x: 0.021, delante: 0.011, forma: 3 },
    ], { lados: 28, tapaAbajo: true, tapaArriba: true }),
    plastico
  );
  // La antena, en la esquina de atrás del lado de fuera, algo abierta.
  const antena = poner(
    MeshBuilder.CreateCylinder(`${nombre}_antena`, { height: 0.095, diameterTop: 0.009, diameterBottom: 0.013, tessellation: 14 }, scene),
    goma
  );
  antena.position.set(0.016, 0.064 + 0.047, -0.006);
  antena.rotation.z = -0.06;
  const punta = poner(MeshBuilder.CreateSphere(`${nombre}_puntaAntena`, { diameter: 0.0095, segments: 8 }, scene), goma);
  punta.position.set(0.0132, 0.064 + 0.094, -0.006);
  // Las dos perillas de arriba: volumen y canal.
  [-0.012, 0.0].forEach((x, k) => {
    const p = poner(
      MeshBuilder.CreateCylinder(`${nombre}_perilla_${k}`, { height: 0.012, diameter: k === 0 ? 0.013 : 0.011, tessellation: 16 }, scene),
      perilla
    );
    p.position.set(x - 0.002, 0.064 + 0.006, 0.002);
  });
  // El clip del cinturón, entre la radio y la tela.
  const clip = poner(MeshBuilder.CreateBox(`${nombre}_clip`, { width: 0.034, height: 0.07, depth: CLIP }, scene), plastico);
  clip.position.set(0, 0.03, -FONDO - CLIP / 2);
  return [plastico, goma, perilla];
}
