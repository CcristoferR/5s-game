import { Scene, Vector3, Color3, type Camera } from "@babylonjs/core";
import { crearFigura, type Figura, type PaletaFigura } from "./Figura";
import type { Clientes } from "./ClientesSupermercado";
import type { ActorSituacion } from "./ActoresSupermercado";
import { PUERTA_X, sueloLibre } from "./ZonasSupermercado";

// ===========================================================================
// Los actores de las situaciones de sala: las tres inocentes y la distracción
// ===========================================================================
//
// Aparte de ActoresSupermercado porque son de otra naturaleza: aquí casi nadie
// hace nada malo. Tres de las cuatro situaciones son gente haciendo cosas
// normales —preguntar, hablar por teléfono, leer una etiqueta— que el jugador
// tiene que aprender a dejar pasar. La cuarta es la que se aprovecha de eso.
//
// ─── LAS DOS SEÑAS, DESDE EL MISMO SITIO ─────────────────────────────────
//
// La señora que pregunta (16:06) y la mujer de la distracción (17:08) hacen
// señas desde el mismo punto del frente de la sala, con el mismo gesto. Es a
// propósito: la primera enseña que alguien que te llama es alguien que te
// llama, y la segunda enseña a mirar también lo que hay DETRÁS de quien te
// llama. Si llamaran desde sitios distintos, el jugador compararía sitios en
// vez de mirar.

/**
 * Desde dónde hacen señas las dos: el frente de la sala, delante del hueco
 * entre las dos filas delanteras. Se ve desde la puerta, que es por donde se
 * empieza.
 *
 * Adelantada hacia la entrada y no pegada a la góndola: estuvo a metro y
 * medio del hombre de la distracción y, vista desde la puerta, quedaba
 * justo DELANTE de él. Lo tapaba entero, y lo que el panel pregunta es qué
 * hace él. Así los dos se ven a la vez, uno al lado del otro.
 */
const SEÑAS = { x: -1.2, z: 5.2 };
/**
 * Dónde se llena la chaqueta el de la distracción: frente a la fila delantera,
 * a metro y medio detrás de ella según se la mira desde la puerta.
 */
const HURTO_FRENTE = { x: -3.5, z: 3.15 };
/** La cara de la fila delantera que tiene delante. */
const ESTANTE_FRENTE_Z = 2.55;

/**
 * El umbral de la puerta: por donde entra la pareja de la distracción y por
 * donde se va quien se va. El mismo del hombre de la mochila.
 */
const UMBRAL_Z = 6.95;

/** Adónde se va la señora que pregunta si la atiendes: a comprar al pasillo 2. */
const AL_PASILLO_2 = [
  { x: -1.0, z: 2.95 },
  { x: -1.0, z: 0.0 },
  { x: -3.7, z: -0.9 },
  { x: -3.4, z: -3.0 },
];
/** La góndola que tiene delante en el pasillo 2. */
const ESTANTE_PASILLO_2 = { x: -2.82, z: -3.0 };

/** Cuánto se aparta del canasto el de la camisa celeste para hablar. */
const APARTE = 1.6;
/** El centro del primer pasillo, por donde se aparta. */
const PASILLO_1_X = -6.8;
/** El fondo del primer pasillo: no se aparta más allá de aquí. */
const FONDO_PASILLO_1_Z = -6.6;

const SEÑORA_PREGUNTA: PaletaFigura = {
  // Pelo cano y chaqueta turquesa: lo que el panel dice de ella, y lo que la
  // separa de la mujer de la distracción a primera vista.
  uniforme: new Color3(0.13, 0.44, 0.46),
  pantalon: new Color3(0.2, 0.2, 0.24),
  piel: new Color3(0.6, 0.45, 0.36),
  detalle: new Color3(0.85, 0.83, 0.78),
  pelo: new Color3(0.72, 0.7, 0.67),
  peinado: "largo",
  prenda: "chaqueta",
  accesorio: "bolso",
  zapato: new Color3(0.16, 0.12, 0.1),
  rasgos: { nariz: 0.95, mandibula: 1.1, ancho: 0.98 },
};

const MUJER_SEÑAS: PaletaFigura = {
  uniforme: new Color3(0.08, 0.08, 0.1),
  pantalon: new Color3(0.12, 0.16, 0.28),
  piel: new Color3(0.47, 0.33, 0.25),
  detalle: new Color3(0.55, 0.12, 0.14),
  pelo: new Color3(0.2, 0.11, 0.06),
  peinado: "largo",
  prenda: "abrigo",
  accesorio: "bolso",
  rasgos: { nariz: 0.9, mandibula: 1.05, ancho: 0.95 },
};

const HOMBRE_DISTRACCION: PaletaFigura = {
  // Chaqueta holgada y gorro de lana: la otra prenda del local, con la parka,
  // con sitio donde meter algo.
  uniforme: new Color3(0.3, 0.26, 0.2),
  pantalon: new Color3(0.08, 0.09, 0.12),
  piel: new Color3(0.4, 0.27, 0.19),
  detalle: new Color3(0.1, 0.1, 0.1),
  pelo: new Color3(0.05, 0.04, 0.03),
  prenda: "chaqueta",
  gorroLana: true,
  zapato: new Color3(0.9, 0.9, 0.88),
  suela: new Color3(0.95, 0.95, 0.93),
  rasgos: { nariz: 1.1, mandibula: 0.9, ancho: 1.04 },
};

export interface ActoresSala {
  de(id: string): ActorSituacion | null;
  congelar(quietos: boolean): void;
  dispose(): void;
}

export function crearActoresSala(
  scene: Scene,
  camara: Camera,
  clientes: Clientes,
  piso: number
): ActoresSala {
  const en = (p: { x: number; z: number }): Vector3 => new Vector3(p.x, piso, p.z);
  const umbral = new Vector3(PUERTA_X, piso, UMBRAL_Z);
  const ojoJugador = (): Vector3 => camara.globalPosition.clone();
  /** Lo que hay que tener a la vista de una figura: su pecho. */
  const pecho = (f: Figura, altura: number): Vector3 => {
    const p = f.raiz.position;
    return new Vector3(p.x, p.y + altura * 0.75, p.z);
  };

  const figuras: Figura[] = [];
  const persona = (nombre: string, paleta: PaletaFigura, altura: number, fase: number, extra = {}) => {
    const f = crearFigura(scene, nombre, {
      paleta,
      altura,
      fase,
      bulto: 0.3,
      cederPasoA: () => camara.globalPosition,
      sueloLibre,
      ...extra,
    });
    figuras.push(f);
    return f;
  };

  // --- La señora que pregunta ----------------------------------------------
  //
  // Está desde el principio, mirando la fila delantera como una clienta más.
  // Así, cuando a las 16:06 se gira y te llama, no aparece de la nada: es
  // alguien que ya estaba ahí y que ahora te necesita.
  const ALTURA_SEÑORA = 1.6;
  const señora = persona("senoraPregunta", SEÑORA_PREGUNTA, ALTURA_SEÑORA, 2.3);
  const miraFila = new Vector3(SEÑAS.x - 0.7, piso + 1.15, ESTANTE_FRENTE_Z);
  señora.situar(en(SEÑAS), miraFila);
  señora.mirarHacia(miraFila);
  señora.visible(true);
  let señoraFase: "quieta" | "llamando" | "yendose" | "comprando" | "fuera" = "quieta";

  // --- La pareja de la distracción -------------------------------------------
  //
  // No están hasta su minuto: entran por la puerta, cada uno a su sitio. Es lo
  // que hacen de verdad —llegan juntos, se separan en la entrada— y es además
  // lo que los diferencia de la señora de las 16:06, que estaba comprando.
  const ALTURA_MUJER = 1.66;
  const ALTURA_HOMBRE = 1.8;
  const mujer = persona("mujerSenas", MUJER_SEÑAS, ALTURA_MUJER, 5.4);
  const complice = persona("hombreDistraccion", HOMBRE_DISTRACCION, ALTURA_HOMBRE, 8.8, {
    // Una botella chica, oscura: cabe en el bolsillo de una chaqueta.
    producto: { color: new Color3(0.18, 0.1, 0.07), medidas: [0.07, 0.18, 0.07] },
  });
  let parejaFase: "fuera" | "entrando" | "actuando" | "yendose" | "idos" = "fuera";
  let esperaMujer = 0;
  let esperaComplice = 0;

  // --- El del teléfono (camisa celeste, primer pasillo) -----------------------
  let telefonoFase: "nada" | "llegando" | "apartandose" | "hablando" | "volviendo" = "nada";
  let esperaColgar = 0;
  /** Dónde dejó el canasto, para volver a por él. */
  let junto: Vector3 | null = null;

  let congelados = false;

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (congelados) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

    // Quien llama, te mira: se gira hacia ti mientras hace señas.
    if (señoraFase === "llamando" && señora.quieta()) señora.mirarHacia(ojoJugador());
    if (parejaFase === "actuando" && mujer.quieta()) mujer.mirarHacia(ojoJugador());

    // La pareja entra escalonada: primero él, después ella.
    if (parejaFase === "entrando" && esperaMujer > 0) {
      esperaMujer -= dt;
      if (esperaMujer <= 0) {
        mujer.situar(umbral, en(SEÑAS));
        mujer.visible(true);
        mujer.caminar([en({ x: 1.6, z: 5.2 }), en(SEÑAS)], 1.0, () => {
          mujer.gesticular("llamar");
        });
      }
    }
    // Y se va escalonada: primero ella, después él.
    if (parejaFase === "yendose" && esperaComplice > 0) {
      esperaComplice -= dt;
      if (esperaComplice <= 0) {
        complice.caminar([en({ x: -1.0, z: 4.0 }), en({ x: 1.0, z: 4.9 }), umbral], 1.15, () => {
          complice.visible(false);
          parejaFase = "idos";
        });
      }
    }

    // El del teléfono: llega a su parada, deja el canasto y se aparta.
    const f = clientes.figuraDe("camisaCeleste");
    if (telefonoFase === "llegando" && f && clientes.quieto("camisaCeleste")) {
      const p = f.raiz.position;
      // El canasto, a sus pies y del lado del centro del pasillo: pegado a la
      // góndola no se vería desde la boca del pasillo.
      const haciaCentro = Math.sign(PASILLO_1_X - p.x) || 1;
      junto = new Vector3(p.x, piso, p.z);
      f.soltarCarga(new Vector3(p.x + haciaCentro * 0.28, piso, p.z));
      // Se aparta hacia el fondo, salvo que ya esté en el fondo.
      const destinoZ = p.z - APARTE > FONDO_PASILLO_1_Z ? p.z - APARTE : p.z + APARTE;
      telefonoFase = "apartandose";
      clientes.mandarA("camisaCeleste", [new Vector3(PASILLO_1_X, piso, destinoZ)], 0.8, () => {
        // Si la ventana se cerró mientras se apartaba, ya va de vuelta.
        if (telefonoFase !== "apartandose") return;
        telefonoFase = "hablando";
        // De perfil para quien mira desde la boca del pasillo: cara a la
        // góndola de enfrente, con el teléfono a la vista.
        clientes.mirarA("camisaCeleste", new Vector3(-5.89, piso + 1.5, destinoZ));
        clientes.actuar("camisaCeleste", "telefono");
      });
    }
    if (telefonoFase === "volviendo" && esperaColgar > 0) {
      esperaColgar -= dt;
      if (esperaColgar <= 0 && junto) {
        clientes.mandarA("camisaCeleste", [junto], 0.8, () => {
          clientes.figuraDe("camisaCeleste")?.recogerCarga();
          clientes.soltar("camisaCeleste");
          telefonoFase = "nada";
          junto = null;
        });
      }
    }
  });

  return {
    congelar(quietos) {
      congelados = quietos;
      figuras.forEach((f) => f.congelar(quietos));
    },

    de(id) {
      switch (id) {
        case "clienta-pregunta":
          return {
            empezar: () => {
              if (señoraFase !== "quieta") return;
              señoraFase = "llamando";
              señora.gesticular("llamar");
            },
            terminar: (opcion) => {
              if (señoraFase !== "llamando") return;
              señora.gesticular(null);
              // Atendida, se va a comprar: le dijiste dónde estaba lo que
              // buscaba. Sin atender, se cansa y se va del local.
              if (opcion?.correcta) {
                señoraFase = "comprando";
                señora.caminar(AL_PASILLO_2.map(en), 0.8, () => {
                  señora.mirarHacia(new Vector3(ESTANTE_PASILLO_2.x, piso + 1.15, ESTANTE_PASILLO_2.z));
                });
                return;
              }
              señoraFase = "yendose";
              señora.caminar([en({ x: 0.0, z: 4.6 }), umbral], 0.9, () => {
                señora.visible(false);
                señoraFase = "fuera";
              });
            },
            punto: () => (señora.gestoALaVista() ? pecho(señora, ALTURA_SEÑORA) : null),
            enSuMomento: () => señora.remateALaVista(),
          };

        case "maniobra-de-distraccion":
          return {
            empezar: () => {
              if (parejaFase !== "fuera") return;
              parejaFase = "entrando";
              complice.situar(umbral, en(HURTO_FRENTE));
              complice.visible(true);
              complice.caminar(
                [en({ x: 1.0, z: 4.9 }), en({ x: -1.0, z: 4.0 }), en(HURTO_FRENTE)],
                1.15,
                () => {
                  complice.mirarHacia(new Vector3(HURTO_FRENTE.x, piso + 1.15, ESTANTE_FRENTE_Z));
                  complice.gesticular("guardar");
                  parejaFase = "actuando";
                }
              );
              esperaMujer = 1.8;
            },
            terminar: () => {
              if (parejaFase !== "actuando" && parejaFase !== "entrando") return;
              parejaFase = "yendose";
              complice.gesticular(null);
              mujer.gesticular(null);
              esperaMujer = 0;
              mujer.caminar([en({ x: 0.0, z: 4.6 }), umbral], 1.1, () => mujer.visible(false));
              esperaComplice = 1.5;
            },
            // Lo que hay que ver es a ÉL, no a ella: ella es lo que te llama,
            // él es lo que pasa. Quien solo mira a la que hace señas no llega
            // a ver nada, que es exactamente como funciona la maniobra.
            punto: () =>
              parejaFase === "actuando" && complice.gestoALaVista() ? pecho(complice, ALTURA_HOMBRE) : null,
            enSuMomento: () => complice.remateALaVista(),
            terminada: () => parejaFase === "idos",
          };

        case "canasto-y-telefono":
          return {
            empezar: () => {
              if (telefonoFase !== "nada") return;
              telefonoFase = "llegando";
              clientes.retener("camisaCeleste");
            },
            terminar: () => {
              if (telefonoFase === "nada" || telefonoFase === "volviendo") return;
              // Si se le acaba la ventana a medio apartarse, igual vuelve.
              telefonoFase = "volviendo";
              clientes.retener("camisaCeleste");
              esperaColgar = 1.2;
              if (!junto) {
                clientes.soltar("camisaCeleste");
                telefonoFase = "nada";
              }
            },
            // Solo con el canasto en el suelo y el teléfono en la oreja: antes
            // de eso es un cliente parado en su pasillo.
            punto: () => {
              if (telefonoFase !== "hablando") return null;
              if (!clientes.enPlenoGesto("camisaCeleste")) return null;
              return clientes.puntoDe("camisaCeleste");
            },
            enSuMomento: () => clientes.enElRemate("camisaCeleste"),
          };

        case "mira-mucho-un-producto":
          return {
            empezar: () => clientes.actuar("abrigoCamel", "leer"),
            terminar: () => clientes.actuar("abrigoCamel", null),
            punto: () => (clientes.enPlenoGesto("abrigoCamel") ? clientes.puntoDe("abrigoCamel") : null),
            // Cuando la mano vuelve vacía del estante. Es lo único que la
            // distingue del hurto, y por eso es lo que hay que haber visto.
            enSuMomento: () => clientes.enElRemate("abrigoCamel"),
          };

        default:
          return null;
      }
    },

    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
      figuras.forEach((f) => f.dispose());
    },
  };
}
