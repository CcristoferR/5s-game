import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  DynamicTexture,
  type Observer,
} from "@babylonjs/core";
import { crearFigura, type Figura } from "./Figura";
import { SUJETO_1, SUJETO_2 } from "./AsaltantesBanco";
import {
  CAJAS,
  MESON,
  PASILLO_IZQ,
  PUERTA_X,
  Y_FUERA,
  Z_CLIENTE,
  Z_PUERTA_DENTRO,
  type GenteBanco,
  type SalaEnAsalto,
} from "./GenteBanco";
import type { Subtitulos } from "./SubtitulosTurno";
import { reproducir, cortarAmbienteSala } from "../../core/Sonido";

// ===========================================================================
// El asalto
// ===========================================================================
//
// A las 9:45 entran dos. Uno se queda en medio del hall con el arma y
// controla la sala; el otro va a la caja 2 con un bolso y el cajero le llena
// el bolso. Salen corriendo, doblan a la izquierda y se van por el costado
// del banco. Algo más de un minuto, contado desde que la puerta se abre de
// golpe.
//
// ─── SIEMPRE IGUAL ───────────────────────────────────────────────────────
//
// Todo pasa en su segundo, sin azar, en tiempo del turno: la pausa lo detiene
// a la mitad y lo retoma donde estaba. Es a propósito. Después se va a
// preguntar por lo que se vio —cuántos eran, cómo iban, qué dijeron, por
// dónde se fueron—, y eso tiene que haber pasado igual para todos.
//
// ─── TODO LO QUE SE PREGUNTA ESTUVO A LA VISTA ───────────────────────────
//
// Desde el puesto, sin moverse:
//   · entran por la puerta, a un paso a la izquierda del guardia;
//   · el que controla la sala se planta a dos metros, y en un momento se le
//     acerca a uno, apuntándole: su cara, su gorro, su chaqueta, el arma;
//   · el otro cruza por el pasillo de las ventanas hasta la caja 2, que se ve
//     de frente, y ahí se queda con su bolso;
//   · lo que dicen sale escrito abajo, y quién lo dice lo cuenta su boca y su
//     brazo;
//   · al irse, la puerta queda abierta y se les ve doblar a la izquierda, y
//     enseguida pasar corriendo por el costado, detrás de las dos ventanas
//     grandes de la pared izquierda.

/** El sitio desde donde el que controla la sala ve a todos: la boca de la fila. */
const CONTROL = { x: 0.72, z: -2.45 };
/**
 * Donde se planta delante del guardia: a un metro. Más cerca, desde los ojos
 * del guardia se veía solo una cara; a un metro se ven a la vez la cara, el
 * gorro, la chaqueta y el arma, que es lo que después se va a preguntar.
 */
const ANTE_EL_GUARDIA = { x: 1.42, z: -2.86 };
/**
 * Por dónde llegan, fuera, desde la derecha de la explanada. El primero
 * revienta la puerta desde el último punto, a un paso largo: si llegara
 * caminando hasta el umbral, la puerta —que se abre sola para quien se
 * acerca— empezaría a abrirse despacio antes del golpe.
 */
const LLEGADA_1 = [{ x: 3.8, z: -6.3 }, { x: 1.6, z: -5.6 }];
const LLEGADA_2 = [{ x: 4.6, z: -6.9 }, { x: 1.9, z: -5.9 }, { x: 0.62, z: -4.95 }];
/**
 * El bolso, sobre el mesón de la caja 2, y dónde se para él: medio metro a
 * su izquierda. Si se parara delante del bolso, desde el puesto del guardia
 * su espalda taparía justo lo que hay que ver —la mano del cajero que saca
 * la plata y la mete en el bolso—; corrido, el bolso queda a la vista a su
 * derecha.
 */
const BOLSO = { x: -1.0, z: 4.6 };
const EN_LA_CAJA = { x: -1.52, z: Z_CLIENTE + 0.02 };
/** El camino del de la caja: por la puerta y el pasillo de las ventanas. */
const A_LA_CAJA = [
  { x: PUERTA_X, z: -3.5 },
  { x: 0.2, z: -3.15 },
  { x: PASILLO_IZQ, z: -2.55 },
  { x: PASILLO_IZQ, z: 2.7 },
  { x: EN_LA_CAJA.x, z: 3.3 },
  EN_LA_CAJA,
];
/** Adónde se aparta quien estaba en la caja 2 cuando llega él. */
const APARTARSE = { x: -2.35, z: 3.7 };
/**
 * Fuera: doblan a la izquierda y corren por el costado del banco, pegados al
 * muro, hacia atrás. Es por donde se les ve irse: primero por la puerta
 * abierta y después por las dos ventanas grandes de la pared izquierda, que
 * desde el puesto se ven de frente al otro lado del hall. Al fondo del
 * costado salen de escena.
 */
const HUIDA_1 = [{ x: 0.7, z: -4.9 }, { x: 0.15, z: -6.1 }, { x: -6.3, z: -6.6 }, { x: -6.9, z: 1 }, { x: -7.1, z: 12 }];
const HUIDA_2 = [{ x: 0.62, z: -4.9 }, { x: 0.05, z: -6.0 }, { x: -6.6, z: -6.3 }, { x: -7.3, z: 1 }, { x: -7.5, z: 12 }];

/** A qué paso va cada cosa. */
const ANDAR_FUERA = 1.35;
const ENTRAR = 1.9;
const CORRER = 3.1;

/** Lo que dicen, en orden. Ver Paso 6: hay que poder oírlo —aquí, leerlo—. */
export const FRASES = {
  entrada: "¡Esto es un asalto! ¡Todos al suelo!",
  guardia: "¡Tú, quieto! ¡Las manos donde las vea!",
  caja: "¡La plata en el bolso, rápido!",
  salida: "¡Ya, vámonos, vámonos!",
} as const;

/**
 * Los momentos del asalto, para lo que venga después (los paneles de
 * decisión): cuando entran gritando, cuando uno se acerca al guardia, cuando
 * salen corriendo y cuando ya se fueron.
 */
export type MomentoAsalto = "entran" | "seAcerca" | "salen" | "despues";

/** En qué va el asalto. */
export type FaseAsalto = "espera" | "llegan" | "dentro" | "huida" | "despues" | "fin";

export interface AsaltoBanco {
  /** Los dos: el que controla la sala y el de la caja. */
  sujetos: [Figura, Figura];
  /**
   * El del arma se vuelve hacia el guardia: le apunta, lo mira y le grita
   * esa frase, durante esos segundos. Es lo que pasa cuando el guardia hace
   * algo que no debe (ver MomentosBanco). Si estaba por irse, se queda
   * cubriendo la puerta hasta terminar.
   */
  encararGuardia(frase: string, segundos: number): void;
  /** Las frases que se dijeron en voz alta hasta ahora. Se oyen siempre. */
  frasesDichas(): ReadonlySet<string>;
  /** Empieza: se acercan por fuera y a los tres segundos revientan la puerta. */
  comenzar(): void;
  fase(): FaseAsalto;
  /** Segundos desde que empezó, en tiempo del turno. */
  tiempo(): number;
  /** Lo deja todo quieto donde está, o lo suelta. Para la pausa. */
  congelar(quieto: boolean): void;
  dispose(): void;
}

export interface OpcionesAsalto {
  piso: number;
  gente: GenteBanco;
  /** Dónde está el guardia: los ojos del jugador. */
  guardia: () => Vector3;
  subtitulos: Subtitulos;
  /** Avisa de cada momento del asalto. Ver MomentoAsalto. */
  alMomento?: (m: MomentoAsalto) => void;
}

export function crearAsaltoBanco(scene: Scene, o: OpcionesAsalto): AsaltoBanco {
  const { piso, gente, subtitulos } = o;
  const en = (p: { x: number; z: number }, y = piso): Vector3 => new Vector3(p.x, y, p.z);
  const fuera = (p: { x: number; z: number }): Vector3 => en(p, Y_FUERA);

  // --- Los dos --------------------------------------------------------------
  const s1 = crearFigura(scene, "asalto_sujeto1", { ...SUJETO_1, fase: 2.7 });
  const s2 = crearFigura(scene, "asalto_sujeto2", { ...SUJETO_2, fase: 5.3 });
  s1.situar(fuera(LLEGADA_1[0]), fuera(LLEGADA_1[1]));
  s2.situar(fuera(LLEGADA_2[0]), fuera(LLEGADA_2[1]));
  s1.visible(false);
  s2.visible(false);
  gente.registrar(s1);
  gente.registrar(s2);

  // --- Los fajos -------------------------------------------------------------
  //
  // Billetes de diez mil —azules— de a cien, con su faja de papel. Cinco, que
  // salen de uno en uno del cajón y entran en el bolso.
  const matFajo = materialFajo(scene);
  const FAJOS = 5;
  const fajos: Mesh[] = [];
  for (let i = 0; i < FAJOS; i++) {
    const f = MeshBuilder.CreateBox(`fajoBanco_${i}`, { width: 0.022, height: 0.155, depth: 0.07 }, scene);
    f.material = matFajo;
    f.isPickable = false;
    f.isVisible = false;
    fajos.push(f);
  }

  // --- El reloj del asalto y lo que tiene pendiente ----------------------------
  let t = 0;
  let enMarcha = false;
  let quieto = false;
  let cerrado = false;
  let fase: FaseAsalto = "espera";
  const pendientes: { t: number; hacer: () => void }[] = [];
  const luego = (segundos: number, hacer: () => void): void => {
    pendientes.push({ t: t + segundos, hacer });
  };
  const momento = (m: MomentoAsalto): void => o.alMomento?.(m);
  const dichas = new Set<string>();
  const decir = (quien: Figura, frase: string, segundos: number): void => {
    quien.hablar(segundos - 0.2, true);
    subtitulos.decir(frase, segundos);
    dichas.add(frase);
  };
  /** Hasta cuándo el del arma no le quita la vista —ni el arma— al guardia. */
  let vigilaGuardia = -1;

  let sala: SalaEnAsalto | null = null;
  const cajero = (): Figura | null => sala?.cajeros[1] ?? null;
  const cabezaDe = (f: Figura): Vector3 => f.raiz.position.add(new Vector3(0, 1.55, 0));

  // --- El que controla la sala: hacia dónde apunta -----------------------------
  //
  // Recorre la sala con el arma, un sitio cada dos segundos: la fila y las
  // cajas, las sillas de la izquierda, a su compañero, las sillas de la
  // derecha y, cada vuelta, al guardia. El arma no salta de uno a otro: va.
  const BARRIDO = [
    new Vector3(0.7, piso + 0.9, 4.0),
    new Vector3(-1.6, piso + 0.6, -0.2),
    new Vector3(CAJAS[1].placa, piso + 1.0, 4.0),
    new Vector3(3.0, piso + 0.6, 0.2),
    new Vector3(0.9, piso + 0.8, 3.0),
    null, // el guardia
  ];
  let barriendo = false;
  let apuntaA: Vector3 | null = null;
  const apunta = new Vector3(0.7, piso + 1.2, 4);
  let cambioBarrido = 0;
  let indiceBarrido = 0;
  const pechoDelGuardia = (): Vector3 => o.guardia().subtract(new Vector3(0, 0.4, 0));

  // --- El cajero llenando el bolso --------------------------------------------
  //
  // Cada fajo, en cuatro segundos: la mano baja al cajón bajo el mesón —desde
  // el hall se ve desaparecer tras el frente—, vuelve con el fajo, lo lleva
  // por encima del mesón hasta el bolso y lo deja caer dentro. La otra mano,
  // arriba, todo el rato. El cuerpo, echado hacia el mesón para llegar.
  let cargando = false;
  let relojCarga = 0;
  let fajoEnMano: Mesh | null = null;
  let fajosDados = 0;
  const cayendo: { malla: Mesh; desde: Vector3; hasta: Vector3; t: number }[] = [];
  let bolsoAbierto: Vector3 | null = null;
  let manoDesde: Vector3 | null = null;
  const CICLO_FAJO = 3.9;
  const cajon = (): Vector3 => new Vector3(CAJAS[1].silla - 0.25, piso + 0.64, 4.92);
  const alzada = (): Vector3 => new Vector3(CAJAS[1].silla - 0.22, piso + MESON + 0.22, 4.86);
  const bocaDelBolso = (): Vector3 => bolsoAbierto ?? new Vector3(BOLSO.x, piso + MESON + 0.26, BOLSO.z);
  const sobreBolso = (): Vector3 => bocaDelBolso().add(new Vector3(0, 0.1, 0.02));
  const dentroBolso = (): Vector3 => bocaDelBolso().add(new Vector3(0, 0.01, 0.02));

  const mezcla = (a: Vector3, b: Vector3, u: number): Vector3 => {
    const s = u * u * (3 - 2 * u);
    return Vector3.Lerp(a, b, s);
  };
  /** Dónde va la mano del cajero en este segundo del ciclo de un fajo. */
  const manoDelCajero = (c: number, desde: Vector3): Vector3 => {
    const tramos: [number, Vector3][] = [
      [0, desde],
      [0.8, cajon()],
      [1.3, cajon().add(new Vector3(0.03, 0.01, -0.02))],
      [2.0, alzada()],
      [2.7, sobreBolso()],
      [3.05, dentroBolso()],
      [3.5, sobreBolso()],
      [CICLO_FAJO, sobreBolso()],
    ];
    for (let k = 1; k < tramos.length; k++) {
      const [t1, p1] = tramos[k];
      const [t0, p0] = tramos[k - 1];
      if (c <= t1) return mezcla(p0, p1, (c - t0) / (t1 - t0));
    }
    return sobreBolso();
  };

  // --- Las reacciones de la sala -----------------------------------------------
  //
  // En el orden en que se enteran: primero los más cerca de la puerta, de
  // tres en tres décimas. Quien está sentado se encoge sobre las rodillas con
  // las manos en la nuca; quien está de pie se agacha en cuclillas. La mitad
  // levanta la vista hacia el del arma de vez en cuando; la otra mitad no la
  // levanta del suelo. Los cajeros, manos arriba y mirándolo.
  const reaccionar = (s: SalaEnAsalto): void => {
    const puerta = en({ x: PUERTA_X, z: Z_PUERTA_DENTRO });
    const orden = [...s.clientes].sort(
      (a, b) => Vector3.Distance(a.raiz.position, puerta) - Vector3.Distance(b.raiz.position, puerta)
    );
    const enLaCaja2 = s.enCaja[1];
    orden.forEach((f, k) => {
      const demora = 0.55 + k * 0.33;
      luego(demora, () => {
        // Quien iba andando se queda donde está: nadie sigue su camino con
        // un arma apuntando a la sala.
        if (!f.quieta()) f.detener();
        f.gesticular(null);
        f.mirarA(null);
        if (f === enLaCaja2) {
          // La de la caja 2 se aparta del mesón antes de agacharse: ahí se
          // va a poner él.
          f.caminar([en(APARTARSE)], 1.3, () => {
            f.mirarHacia(en({ x: APARTARSE.x - 0.3, z: 5 }));
            f.cubrirse(true);
          });
          return;
        }
        if (!f.sentada()) f.mirarHacia(en({ x: PUERTA_X, z: -3.4 }));
        f.cubrirse(true);
      });
    });
    // Quiénes levantan la vista: uno sí y otro no.
    orden.forEach((f, k) => {
      if (k % 2 === 1) return;
      const mira = (): void => {
        if (fase === "despues" || fase === "fin" || cerrado) return;
        f.mirarA(cabezaDe(s1));
        luego(1.3 + (k % 3) * 0.4, () => {
          if (fase !== "despues" && fase !== "fin") f.mirarA(null);
        });
        luego(4.5 + k * 0.7, mira);
      };
      luego(3 + k * 0.9, mira);
    });
    s.cajeros.forEach((f, i) => {
      luego(0.75 + i * 0.25, () => {
        f.manosArriba(true);
      });
    });
  };

  /** Después: la sala se va levantando, sin prisa y sin ruido. */
  const recuperarse = (s: SalaEnAsalto): void => {
    const puertaVista = en({ x: PUERTA_X, z: -4.6 }, piso + 1.3);
    s.cajeros.forEach((f, i) => {
      luego(5 + i * 0.9, () => {
        f.manosArriba(false);
        f.inclinarse(0);
        f.mirarA(puertaVista);
      });
    });
    s.clientes.forEach((f, k) => {
      luego(8 + k * 0.8, () => {
        f.cubrirse(false);
        f.mirarA(puertaVista);
      });
    });
  };

  // --- El guion ------------------------------------------------------------------
  const guion = (): void => {
    fase = "llegan";
    // Se acercan por la explanada, desde la derecha. Desde dentro no se les
    // ve: la fachada no tiene ventanas a esa altura. La puerta, cerrada.
    luego(0.4, () => {
      s1.visible(true);
      s2.visible(true);
      s1.caminar(LLEGADA_1.slice(1).map(fuera), ANDAR_FUERA, entran);
      s2.caminar(LLEGADA_2.slice(1).map(fuera), ANDAR_FUERA, () => {
        // El de la caja, medio segundo detrás, directo al pasillo de las
        // ventanas y a la carrera.
        s2.caminar(A_LA_CAJA.map((p) => en(p)), CORRER - 0.2, enLaCaja);
      });
    });
  };

  /** La puerta se abre de un golpe y entra el primero, gritando. */
  const entran = (): void => {
    fase = "dentro";
    sala = gente.asalto();
    sala.puerta?.forzar(4);
    reproducir("puertaGolpe");
    s1.caminar([fuera({ x: 0.72, z: -4.72 }), en({ x: PUERTA_X, z: -3.5 }), en(CONTROL)], ENTRAR, () => {
      barriendo = true;
      cambioBarrido = t;
    });
    apuntaA = BARRIDO[0];
    luego(0.3, () => {
      cortarAmbienteSala();
      decir(s1, FRASES.entrada, 3.2);
      s1.gesticular("ordenar");
    });
    // El momento se congela un segundo después del grito: con el que grita ya
    // dentro, el arma a la vista y la gente empezando a agacharse. Antes, a
    // los 0,3 s, lo congelado era una puerta abriéndose.
    luego(1.4, () => momento("entran"));
    luego(0.95, () => reproducir("exclamacion"));
    luego(3.4, () => s1.gesticular(null));
    reaccionar(sala);
  };

  /** El de la caja llega al mesón: deja el bolso, grita y el cajero empieza. */
  const enLaCaja = (): void => {
    s2.mirarHacia(en({ x: EN_LA_CAJA.x + 0.25, z: 8 }));
    const c = cajero();
    if (c) s2.mirarA(cabezaDe(c).add(new Vector3(0, -0.35, 0)));
    s2.inclinarse(0.14);
    luego(0.4, () => {
      s2.soltarCarga(en(BOLSO, piso + MESON));
      const bolso = s2.cargaEnElSuelo();
      // La boca del bolso: la carga guarda la altura del asa.
      if (bolso) bolsoAbierto = bolso.add(new Vector3(0, -0.14 * (SUJETO_2.altura ?? 1.75) / 1.75, 0));
    });
    luego(0.7, () => {
      decir(s2, FRASES.caja, 2.8);
      s2.gesticular("ordenar");
    });
    luego(3.0, () => {
      s2.gesticular(null);
      // Y la mano en el borde del bolso, sujetándolo abierto.
      s2.apoyarManos([null, en({ x: BOLSO.x - 0.07, z: BOLSO.z - 0.2 }, piso + MESON + 0.27)]);
    });
    // El cajero baja una mano y empieza a sacar la plata.
    luego(2.4, () => {
      if (!c) return;
      c.inclinarse(0.4);
      manoDesde = c.palmaEnMundo(1);
      cargando = true;
      relojCarga = 0;
    });
    // Mientras tanto, el otro se le acerca al guardia.
    luego(4.5, alGuardia);
  };

  /** El que controla la sala se le planta delante al guardia, apuntándole. */
  const alGuardia = (): void => {
    barriendo = false;
    apuntaA = null;
    s1.caminar([en(ANTE_EL_GUARDIA)], 1.2, () => {
      s1.mirarHacia(o.guardia());
      s1.mirarA(o.guardia());
      luego(0.25, () => decir(s1, FRASES.guardia, 3.3));
      // A media frase: ya se le ve la cara de cerca y el arma apuntando.
      luego(1.3, () => momento("seAcerca"));
      // Lo mira fijo unos segundos y vuelve a su sitio sin dejar de apuntarle.
      luego(7.5, () => {
        s1.mirarA(null);
        s1.caminar([en(CONTROL)], 1.1, () => {
          barriendo = true;
          cambioBarrido = t;
        });
      });
    });
  };

  /** Ya está la plata: se van. */
  const seVan = (): void => {
    fase = "huida";
    const c = cajero();
    c?.inclinarse(0);
    c?.manosArriba(true);
    s2.apoyarManos(null);
    s2.inclinarse(0);
    s2.mirarA(null);
    s2.recogerCarga();
    luego(0.35, () => {
      barriendo = false;
      apuntaA = BARRIDO[2];
      decir(s1, FRASES.salida, 2.4);
    });
    luego(0.8, () => {
      s2.caminar(
        [...A_LA_CAJA.slice(0, -1)].reverse().map((p) => en(p)).concat(en({ x: PUERTA_X, z: -3.5 })),
        CORRER,
        () => {
          sala?.puerta?.forzar(5);
          reproducir("pasosCorriendo");
          momento("salen");
          s2.caminar(HUIDA_2.map(fuera), CORRER + 0.3, () => s2.visible(false));
        }
      );
    });
  };

  // --- Cada cuadro -------------------------------------------------------------------
  let salioElPrimero = false;
  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!enMarcha || quieto || cerrado) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    t += dt;
    subtitulos.avanzar(dt);
    for (let k = 0; k < pendientes.length; k++) {
      if (pendientes[k].t > t) continue;
      const [p] = pendientes.splice(k, 1);
      k -= 1;
      p.hacer();
    }

    // El arma: hacia el guardia cuando le toca, o al sitio del barrido.
    if (fase === "dentro" || fase === "huida") {
      const vigila = t < vigilaGuardia;
      const cerca = vigila || (Vector3.Distance(s1.raiz.position, en(ANTE_EL_GUARDIA)) < 0.5 && !barriendo);
      if (barriendo && !vigila && t - cambioBarrido > 2.1) {
        cambioBarrido = t;
        indiceBarrido = (indiceBarrido + 1) % BARRIDO.length;
        apuntaA = BARRIDO[indiceBarrido];
        s1.mirarHacia(apuntaA ?? o.guardia());
      }
      const objetivo = cerca || (barriendo && apuntaA === null) ? pechoDelGuardia() : apuntaA ?? pechoDelGuardia();
      Vector3.LerpToRef(apunta, objetivo, Math.min(1, dt * 3.2), apunta);
      if (!salioElPrimero) {
        s1.apoyarManos([null, apunta]);
        if (vigila) {
          s1.mirarA(o.guardia());
          // Parado, se gira de cuerpo entero hacia el guardia; andando, no le
          // tuerce el camino: solo la cabeza y el arma.
          if (s1.quieta()) s1.mirarHacia(o.guardia());
        } else if (!cerca) s1.mirarA(apunta.add(new Vector3(0, 0.5, 0)));
      }
    }

    // El cajero, fajo a fajo.
    const c = cajero();
    if (cargando && c && manoDesde) {
      relojCarga += dt;
      const ciclo = relojCarga % CICLO_FAJO;
      const vuelta = Math.floor(relojCarga / CICLO_FAJO);
      const desde = vuelta === 0 ? manoDesde : sobreBolso();
      const mano = manoDelCajero(ciclo, desde);
      c.apoyarManos(["arriba", mano]);
      // Mira el bolso y al que se lo pide; al cajón no, porque lo sabe de memoria.
      c.mirarA(ciclo > 1.7 && ciclo < 3.3 ? sobreBolso() : cabezaDe(s2));
      if (!fajoEnMano && ciclo >= 1.0 && ciclo < 2.9 && fajosDados < FAJOS) {
        fajoEnMano = fajos[fajosDados];
        fajoEnMano.isVisible = true;
        c.sostener(fajoEnMano, 1);
      }
      if (fajoEnMano && ciclo >= 3.05) {
        const suelto = c.sostener(null, 1);
        if (suelto) {
          const desdeP = suelto.getAbsolutePosition().clone();
          cayendo.push({ malla: suelto, desde: desdeP, hasta: dentroBolso().add(new Vector3(0, -0.14, 0)), t: 0 });
        }
        fajoEnMano = null;
        fajosDados += 1;
        if (fajosDados >= FAJOS) {
          cargando = false;
          luego(0.9, seVan);
        }
      }
    }
    // Lo que cae dentro del bolso, y se pierde de vista.
    for (let k = cayendo.length - 1; k >= 0; k--) {
      const f = cayendo[k];
      f.t += dt / 0.32;
      f.malla.position.copyFrom(Vector3.Lerp(f.desde, f.hasta, Math.min(1, f.t)));
      if (f.t >= 1) {
        f.malla.isVisible = false;
        cayendo.splice(k, 1);
      }
    }

    // El primero sale detrás del segundo, cuando este ya cruzó el umbral:
    // apuntando a la sala hasta el último momento, y sin cruzarse con él.
    // Si está vigilando al guardia —porque este quiso salir detrás—, primero
    // termina de amenazarlo y después se va.
    if (fase === "huida" && !salioElPrimero && s2.raiz.position.z < -3.85 && t >= vigilaGuardia) {
      salioElPrimero = true;
      s1.apoyarManos(null);
      s1.mirarA(null);
      s1.caminar([en({ x: PUERTA_X, z: -3.5 }), ...HUIDA_1.map(fuera)], CORRER, () => {
        s1.visible(false);
        fase = "despues";
        momento("despues");
        if (sala) recuperarse(sala);
        luego(16, () => (fase = "fin"));
      });
    }
  });

  return {
    sujetos: [s1, s2],
    encararGuardia(frase, segundos) {
      if (cerrado || salioElPrimero || (fase !== "dentro" && fase !== "huida")) return;
      vigilaGuardia = t + segundos;
      decir(s1, frase, Math.min(segundos, 2.8));
    },
    frasesDichas: () => dichas,
    comenzar() {
      if (enMarcha || cerrado) return;
      enMarcha = true;
      guion();
    },
    fase: () => fase,
    tiempo: () => t,
    congelar(q) {
      quieto = q;
    },
    dispose() {
      cerrado = true;
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      fajos.forEach((f) => f.dispose());
      matFajo.dispose(true, true);
    },
  };
}

/**
 * Un fajo de billetes de diez mil: el azul del billete, los cantos de papel y
 * la faja blanca atravesada. Un solo material para los cinco.
 */
function materialFajo(scene: Scene): PBRMaterial {
  const tex = new DynamicTexture("texFajoBanco", { width: 256, height: 128 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const fondo = ctx.createLinearGradient(0, 0, 256, 128);
  fondo.addColorStop(0, "#3d6f9e");
  fondo.addColorStop(1, "#2b577f");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, 256, 128);
  // Un poco de dibujo del billete, de lejos es solo textura.
  ctx.strokeStyle = "rgba(220,235,250,0.25)";
  ctx.lineWidth = 2;
  for (let y = 10; y < 128; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y - 8, 170, y + 8, 256, y);
    ctx.stroke();
  }
  // La faja.
  ctx.fillStyle = "#efe9dc";
  ctx.fillRect(108, 0, 40, 128);
  ctx.fillStyle = "#c9b98f";
  ctx.fillRect(108, 0, 3, 128);
  ctx.fillRect(145, 0, 3, 128);
  tex.update(true);
  const mat = new PBRMaterial("matFajoBanco", scene);
  mat.albedoTexture = tex;
  mat.albedoColor = new Color3(1, 1, 1);
  mat.roughness = 0.8;
  mat.metallic = 0;
  return mat;
}
