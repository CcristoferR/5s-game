import { Scene, Vector3, Color3, MeshBuilder, PBRMaterial, Mesh, type Camera } from "@babylonjs/core";
import { crearFigura, type Figura, type PaletaFigura } from "./Figura";
import type { OpcionSituacion } from "./PanelesSupermercado";
import type { Clientes } from "./ClientesSupermercado";
import type { Bodega } from "./BodegaSupermercado";
import { PUERTA_X, sueloLibre } from "./ZonasSupermercado";
import type { Oficina } from "./OficinaSupermercado";
import { crearActoresSala } from "./ActoresSala";

// ===========================================================================
// Lo que de verdad ocurre en la sala cuando ocurre una situación
// ===========================================================================
//
// Cada situación del turno tiene aquí su actor: alguien o algo que hace lo que
// el panel va a describir. Sin esto, el panel era un texto sobre una escena que
// no lo respaldaba — el jugador leía "un cliente se guarda un producto" y en el
// pasillo no había nadie guardándose nada.
//
// ─── POR QUÉ ES ESTE ARCHIVO Y NO CUATRO SITIOS ──────────────────────────
//
// Porque los cuatro actores son de sitios distintos —uno es un cliente de
// ClientesSupermercado, otro una figura nueva, otro una puerta de la bodega y
// otro una mochila en el suelo— y lo único que tienen en común es el papel que
// hacen. Aquí se reúnen por ese papel, y el recorrido pide lo que necesita por
// el id de la situación sin saber de qué está hecho cada uno.
//
// ─── QUÉ TIENE QUE DEVOLVER CADA UNO ─────────────────────────────────────
//
// Un PUNTO: lo que el jugador tiene que tener a la vista para que su situación
// salte. No es el centro del actor, es la parte de él que de verdad se ve —el
// pecho de una persona y no sus pies, la franja de puerta que asoma por encima
// del pallet y no el centro del vano, que está tapado.

/** El mostrador de caja, medido como la tabla de ClientesSupermercado. */
const CAJA = { minX: 8.12, maxX: 9.34, minZ: 2.59, maxZ: 5.56 };
/** Cara interior del muro del lado de la caja. */
const MURO_X = 9.96;

/**
 * Dónde se planta la cajera: entre el mostrador y el muro.
 *
 * Quedan 62 cm entre los dos, y una figura mide 46 de hombro a hombro, así
 * que entra con ocho centímetros a cada lado. Es estrecho y es lo correcto:
 * un puesto de caja lo es.
 */
const CAJERA_X = (CAJA.maxX + MURO_X) / 2;
const CAJERA_Z = 3.35;

/** Dónde acaba apoyada la mochila: contra el muro, al costado de la puerta. */
const MOCHILA = new Vector3(4.28, 0, 6.72);

const UNIFORME_CAJERA: PaletaFigura = {
  // El verde de la marca del local, el mismo del zócalo de la bodega.
  uniforme: new Color3(0.23, 0.5, 0.22),
  pantalon: new Color3(0.09, 0.1, 0.13),
  piel: new Color3(0.52, 0.37, 0.28),
  detalle: new Color3(0.86, 0.86, 0.83),
  pelo: new Color3(0.14, 0.09, 0.05),
  peinado: "largo",
  prenda: "camisa",
  rasgos: { nariz: 0.9, mandibula: 1.1, ancho: 0.96 },
};

const HOMBRE_MOCHILA: PaletaFigura = {
  uniforme: new Color3(0.17, 0.19, 0.24),
  pantalon: new Color3(0.28, 0.3, 0.34),
  piel: new Color3(0.38, 0.25, 0.18),
  detalle: new Color3(0.5, 0.5, 0.5),
  pelo: new Color3(0.05, 0.04, 0.03),
  peinado: "rapado",
  prenda: "chaqueta",
  accesorio: "mochila",
  zapato: new Color3(0.1, 0.1, 0.11),
  rasgos: { nariz: 1.05, mandibula: 1.0, ancho: 1.02 },
};

export interface ActorSituacion {
  /** Empieza a hacer lo suyo. Se llama al abrirse la ventana de su situación. */
  empezar(): void;
  /**
   * Deja de hacerlo.
   *
   * Llega con la opción que el jugador eligió, o con null si la ventana venció
   * sin que nadie la viera. El actor puede así rematar distinto según lo que se
   * haya decidido — que es lo que hace que la decisión se note en la sala y no
   * solo en la tarjeta que se acaba de cerrar.
   */
  terminar(opcion: OpcionSituacion | null): void;
  /** Lo que hay que tener a la vista. Null si todavía no hay nada que ver. */
  punto(): Vector3 | null;
  /**
   * Si lo que el panel va a describir ya ha ocurrido delante del jugador.
   *
   * Sin esto, el panel salta a media acción. Ver enSuMomento en
   * SituacionesSupermercado.
   */
  enSuMomento(): boolean;
  /**
   * Si ya no queda nada que ver aunque la ventana siga abierta: el actor se
   * fue. La situación se da entonces por perdida en el acto.
   */
  terminada?(): boolean;
}

export interface Actores {
  /** Por id de situación. Ver SituacionesSupermercado. */
  de(id: string): ActorSituacion | null;
  /** Clava a los actores propios de este archivo. Ver Clientes.congelar. */
  congelar(quietos: boolean): void;
  dispose(): void;
}

/**
 * Monta los actores de la sala.
 *
 * @param camara    La del jugador. El hombre de la mochila le cede el paso.
 * @param clientes  Los ocho del recorrido: uno de ellos hace el hurto.
 * @param bodega    De ella salen la salida de emergencia y lo que la tapa.
 * @param oficina   Donde acaba el retenido cuando lo llevas hasta su puerta.
 * @param piso      Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 */
export function crearActores(
  scene: Scene,
  camara: Camera,
  clientes: Clientes,
  bodega: Bodega,
  oficina: Oficina,
  piso: number
): Actores {
  const figuras: Figura[] = [];
  // Las de sala —las tres inocentes y la distracción— van aparte. Ver
  // ActoresSala.
  const sala = crearActoresSala(scene, camara, clientes, piso);

  // --- La cajera ------------------------------------------------------------
  //
  // Existe TODO el turno, no solo durante su situación. Un mostrador con la
  // registradora encendida y nadie detrás es de las cosas que más delatan que
  // un local está vacío por dentro, y el jugador pasa por caja en cada ronda.
  // Lo que cambia en su minuto no es que aparezca: es lo que hace con las
  // manos.
  const cajera = crearFigura(scene, "cajera", {
    paleta: UNIFORME_CAJERA,
    altura: 1.63,
    fase: 4.2,
    // Un billete: fino, claro y en la mano un par de segundos. No hay que
    // reconocer el valor, hay que ver que sale de la caja y acaba en el
    // delantal.
    producto: { color: new Color3(0.74, 0.84, 0.66), medidas: [0.17, 0.09, 0.012] },
  });
  figuras.push(cajera);
  const puestoCajera = new Vector3(CAJERA_X, piso, CAJERA_Z);
  // De cara a la sala: al cliente que paga, que llega por el lado de X menor.
  // Así el gesto de alargar la mano va hacia la registradora y se ve de
  // frente desde el pasillo, no de espaldas.
  const miraCajera = new Vector3(CAJA.minX - 0.6, piso + 1.35, CAJERA_Z - 0.35);
  cajera.situar(puestoCajera, miraCajera);
  cajera.mirarHacia(miraCajera);
  cajera.visible(true);
  // Sin cilindro de choque: el mostrador ya impide llegar hasta ella, y un
  // cilindro de 30 cm en un hueco de 62 asomaría por delante del mostrador.

  // --- El hombre de la mochila ---------------------------------------------
  //
  // También existe desde el principio, y por una razón que se cobra en su
  // minuto: si aparece de la nada al abrirse la ventana, el jugador ve
  // materializarse a alguien. Estando ahí desde el turno, con la mochila a la
  // espalda, cuando llegue su momento el jugador puede reconocerlo —"ese
  // llevaba una mochila"—, que es la mitad de lo que el panel le va a pedir.
  const hombre = crearFigura(scene, "hombreMochila", {
    paleta: HOMBRE_MOCHILA,
    altura: 1.79,
    fase: 7.1,
    // Las dos mitades, igual que los ocho clientes: no se le atraviesa nadie y
    // él no atraviesa a nadie. Camina por la entrada, que es por donde entra el
    // jugador al turno, así que es el que más papeletas tiene de chocarse.
    bulto: 0.3,
    cederPasoA: () => camara.globalPosition,
    sueloLibre,
  });
  figuras.push(hombre);
  const ESPERA = new Vector3(1.9, piso, 4.6);
  const DEJA = new Vector3(MOCHILA.x - 0.45, piso, MOCHILA.z - 0.55);
  // ─── POR DÓNDE SE VA ──────────────────────────────────────────────────────
  //
  // POR LA PUERTA, y no hacia dentro del local. Estuvo yendo a un punto de la
  // sala y era un error de lectura completo: lo que el jugador veía era a
  // alguien dejando una mochila y METIÉNDOSE en el supermercado, o sea, a un
  // cliente cualquiera que empieza su compra. La mochila dejaba de ser un bulto
  // abandonado y pasaba a ser el bolso de alguien que está ahí mismo.
  //
  // Se le quita de la escena justo en el vano, antes del vidrio. No cruza el
  // cristal —una figura atravesando la puerta rompe la sala, igual que un
  // cliente atravesando una góndola— y el momento en que desaparece queda
  // enmarcado por el vano y a contraluz, que es donde menos se nota.
  const SE_VA = new Vector3(PUERTA_X, piso, 6.95);
  hombre.situar(ESPERA, new Vector3(ESPERA.x, piso + 1.2, 2.55));
  hombre.mirarHacia(new Vector3(ESPERA.x, piso + 1.15, 2.55));
  hombre.visible(true);

  // La mochila en el suelo. Nace escondida y solo aparece cuando él la suelta.
  const mochila = crearMochila(scene, MOCHILA.x, piso, MOCHILA.z);
  mochila.isVisible = false;

  // --- La salida del de la parka verde -------------------------------------
  //
  // ─── EL CAMINO ────────────────────────────────────────────────────────────
  //
  // Del cuarto pasillo a la puerta, rodeando la fila delantera por el lado de
  // la caja, que es por donde se sale de verdad. Medido sobre la planta de
  // ClientesSupermercado: baja al pasillo transversal (Z −0,9), lo recorre
  // hacia el muro de la caja, sube por delante del mostrador —ahí es donde
  // pasa la línea de cajas— y cruza la entrada hasta el vano.
  //
  // Se PARA un momento delante de la caja. No es adorno: es la ventana en la
  // que el jugador que lo venía siguiendo puede mirarlo y que salte el panel.
  // Sin esa parada habría que cazarlo de paso, y son cuatro segundos.
  const SALIDA_A_CAJA = [
    new Vector3(2.41, piso, -0.9),
    new Vector3(6.9, piso, 0.4),
    new Vector3(7.25, piso, 2.9),
  ];
  const SALIDA_A_PUERTA = [
    new Vector3(5.2, piso, 5.6),
    new Vector3(PUERTA_X, piso, 6.95),
  ];
  // ─── SI LO RETIENES, SE QUEDA CONTIGO ─────────────────────────────────────
  //
  // Se gira hacia ti y no se separa: si te mueves, va detrás a metro y medio.
  // No se lo lleva nadie a ninguna parte y no desaparece — te lo quedas hasta
  // que acabe el turno.
  //
  // ─── Y SE ACABA EN LA PUERTA DE LA OFICINA ────────────────────────────────
  //
  // Lo llevas hasta ahí y entra. No choca con lo que dice la tarjeta —lo
  // obligatorio es haber llamado ya a Carabineros, y esperarlos en la oficina
  // con el procedimiento a la vista es donde se hace— y le da un final a la
  // escena. Sin puerta a la que llegar, el retenido te seguía por el local el
  // resto del turno, y lo que eso parece no es un procedimiento, es que el
  // juego se ha colgado.
  //
  // ─── POR QUÉ VA POR DONDE TÚ PISASTE ──────────────────────────────────────
  //
  // Porque en línea recta no llega. Las figuras ya no atraviesan muebles (ver
  // sueloLibre en ZonasSupermercado), así que un retenido que apunte derecho a
  // donde estás se estampa contra el mostrador en cuanto lo rodeas tú.
  //
  // Siguiendo tus pisadas —una miga cada cuarenta centímetros— va por un camino
  // que ya sabemos que se puede andar, porque acabas de andarlo tú. Es lo más
  // barato que existe y no necesita mapa de navegación ninguno.
  //
  // ─── LO QUE ESTUVO ANTES Y POR QUÉ ESTABA MAL ─────────────────────────────
  //
  // Estuvo yéndose solo hacia la cortina de la bodega. Dos errores en uno: la
  // bodega es "solo personal autorizado" y es por donde entra la mercadería —a
  // un detenido se le lleva a la oficina, no al almacén—, y además caminaba él
  // solo, que no es lo que dice la opción ni lo que haría nadie.
  //
  // Era además el mismo error que la propia situación enseña a evitar en su
  // opción C: mostrar como resultado de la respuesta correcta algo que no es el
  // procedimiento correcto.
  //
  // ─── SI NO LO LLEVAS, SE QUEDA CONTIGO ────────────────────────────────────
  //
  // No hay temporizador que lo resuelva por ti. Quien retiene a alguien y sigue
  // su ronda como si nada lo lleva detrás el resto de la tarde, y eso también
  // dice algo.
  /** A qué distancia te sigue, en metros. */
  const A_LA_ZAGA = 1.5;
  /** Cada cuántos metros de los tuyos se deja una miga del camino. */
  const PASO_DE_ESCOLTA = 0.4;
  /** Cuántas migas se guardan: cuatro de cuarenta centímetros, 1,6 m de zaga. */
  const MIGAS_MAXIMAS = 4;
  /** Cuánto tienes que acercarte tú a la puerta para que él entre. */
  const CERCA_DE_LA_OFICINA = 2.4;
  /**
   * Por dónde se rodea el mostrador para llegar a la oficina.
   *
   * Pasado el extremo del mostrador y a medio metro largo de su canto: el
   * hueco por el que se pasa entre la línea de cajas y la fachada.
   */
  const RODEO_OFICINA = new Vector3(CAJA.minX - 0.55, piso, CAJA.maxZ + 0.75);
  /** El rastro de por dónde has pasado, de lo más viejo a lo más nuevo. */
  const migas: Vector3[] = [];
  let ultimaMiga: Vector3 | null = null;
  /** Lo que se queda parado delante de la caja antes de seguir, en segundos. */
  const DUDA_EN_CAJA = 4.5;

  let fugaFase:
    | "quieto"
    | "hacia-caja"
    | "en-caja"
    | "hacia-puerta"
    | "retenido"
    | "en-oficina"
    | "fuera" = "quieto";
  let esperaCaja = 0;

  /** Por dónde va su encargo: nada, yendo, dejándola, o ya soltada. */
  let fase: "quieto" | "yendo" | "dejando" | "soltada" = "quieto";
  let esperaSuelta = 0;
  /**
   * Segundos que lleva la mochila en el suelo. El panel espera a que pase un
   * rato: saltando en el mismo cuadro en que la suelta, el jugador no llega a
   * verla apoyada en el muro ni a él alejándose de ella, que es justo lo que
   * el panel le pregunta.
   */
  let enElSuelo = 0;

  let congelados = false;

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (congelados) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

    // El de la parka, retenido: no se separa del jugador.
    if (fugaFase === "retenido") {
      const ojo = camara.globalPosition;
      const aPie = new Vector3(ojo.x, piso, ojo.z);

      // ¿Lo has traído hasta la puerta? Entra, y se acabó.
      //
      // ─── Y SE LE RODEA EL MOSTRADOR ─────────────────────────────────────
      //
      // El umbral está en el muro del fondo, al otro lado de la línea de
      // cajas. En cuanto las figuras dejaron de atravesar muebles, el último
      // tramo dejó de funcionar: echaba a andar hacia la puerta, se estampaba
      // contra el canto del mostrador y se quedaba ahí clavado para siempre.
      //
      // Con un punto intermedio —pasado el final del mostrador y medio metro
      // por delante de su canto— el camino existe. Es el mismo que tiene que
      // hacer el jugador, y por eso funciona: si él puede llegar, este también.
      if (Vector3.Distance(aPie, oficina.llegada) < CERCA_DE_LA_OFICINA) {
        fugaFase = "en-oficina";
        // Y deja de apartarse de ti: delante de la puerta estás tú, y con la
        // cortesía puesta se quedaría a ochenta centímetros sin entrar nunca.
        clientes.cederElPaso("parkaVerde", false);
        clientes.mandarA("parkaVerde", [RODEO_OFICINA, oficina.umbral], 1.0, () =>
          clientes.esconder("parkaVerde")
        );
        return;
      }

      const el = clientes.puntoDe("parkaVerde");
      if (!el) return;
      const suyo = new Vector3(el.x, piso, el.z);

      // Una miga cada cuarenta centímetros tuyos, y nunca cada cuadro:
      // reiniciarle la ruta sesenta veces por segundo no le deja dar un paso,
      // se queda temblando en el sitio.
      if (!ultimaMiga || Vector3.Distance(ultimaMiga, aPie) > PASO_DE_ESCOLTA) {
        ultimaMiga = aPie.clone();
        migas.push(aPie.clone());
        // Más de cuatro migas es que se ha descolgado: se le perdona el tramo
        // más viejo para que recorte y vuelva a pegarse.
        while (migas.length > MIGAS_MAXIMAS) migas.shift();
        clientes.mandarA("parkaVerde", [migas[0]], 1.15);
      }

      // Miga alcanzada: a por la siguiente.
      if (migas.length > 0 && Vector3.Distance(suyo, migas[0]) < 0.35) {
        migas.shift();
        if (migas.length > 0) clientes.mandarA("parkaVerde", [migas[0]], 1.15);
      }

      // Alcanzado, te mira a la cara. Un retenido no se queda mirando al techo:
      // mira a quien lo retuvo, y eso es lo que lo hace leerse como retenido y
      // no como un cliente que pasaba por ahí.
      if (Vector3.Distance(aPie, suyo) < A_LA_ZAGA + 0.45) {
        clientes.mirarA("parkaVerde", ojo);
      }
      return;
    }

    // El de la parka, parado delante de la caja antes de salir.
    if (fugaFase === "en-caja") {
      esperaCaja -= dt;
      if (esperaCaja <= 0) {
        fugaFase = "hacia-puerta";
        clientes.mandarA("parkaVerde", SALIDA_A_PUERTA, 1.2, () => {
          fugaFase = "fuera";
          clientes.esconder("parkaVerde");
        });
      }
    }

    if (fase === "soltada") enElSuelo += dt;
    if (fase !== "dejando") return;
    esperaSuelta -= dt;
    if (esperaSuelta > 0) return;
    // Se cambia la que lleva puesta por la del suelo en el mismo cuadro: en
    // uno la tiene a la espalda y en el siguiente está apoyada en el muro.
    ocultarMochilaDe(scene, "hombreMochila");
    mochila.isVisible = true;
    fase = "soltada";
    // Algo más rápido que como vino: el que deja un bulto y se va no se
    // entretiene, y esa prisa es la mitad de lo que hace que se note.
    hombre.caminar([SE_VA], 1.25, () => hombre.visible(false));
  });

  return {
    congelar(quietos) {
      congelados = quietos;
      figuras.forEach((fig) => fig.congelar(quietos));
      sala.congelar(quietos);
    },

    de(id) {
      switch (id) {
        case "producto-bajo-la-chaqueta":
          return {
            empezar: () => clientes.actuar("parkaVerde", "guardar"),
            terminar: (opcion) => {
              // ─── SI NADIE LO MIRA, SE VA ─────────────────────────────────
              //
              // Sin nadie mirando (la ventana venció) o con el guardia camino
              // de la oficina (avisar), sale sin pagar por la línea de cajas.
              // Es lo que la explicación de avisar le dice al jugador que
              // puede pasar, y lo que Central le cuenta después si se lo
              // perdió: con esto, además, lo ve pasar.
              //
              // Con intervenir devuelve el producto y sigue su compra; con
              // observar, lo que venga lo decide la situación encadenada.
              if (opcion === null || opcion.clase === "avisar") {
                if (fugaFase !== "quieto") return;
                fugaFase = "hacia-puerta";
                clientes.actuar("parkaVerde", null);
                clientes.cederElPaso("parkaVerde", false);
                clientes.mandarA("parkaVerde", [...SALIDA_A_CAJA, ...SALIDA_A_PUERTA], 1.15, () => {
                  fugaFase = "fuera";
                  clientes.esconder("parkaVerde");
                });
                return;
              }
              clientes.actuar("parkaVerde", null);
            },
            enSuMomento: () => clientes.enElRemate("parkaVerde"),
            // Null mientras no se le esté viendo el gesto: si no, el panel
            // salta contando el rato que llevas mirando a alguien que todavía
            // venía andando por el pasillo, y se abre para hablarte de un hurto
            // que no ha ocurrido delante de ti.
            punto: () => (clientes.enPlenoGesto("parkaVerde") ? clientes.puntoDe("parkaVerde") : null),
          };

        case "sale-sin-pagar":
          return {
            empezar: () => {
              if (fugaFase !== "quieto") return;
              fugaFase = "hacia-caja";
              // Más rápido que paseando: el que lleva algo encima no se
              // entretiene, y esa prisa es parte de lo que hay que ver.
              clientes.mandarA("parkaVerde", SALIDA_A_CAJA, 1.15, () => {
                fugaFase = "en-caja";
                esperaCaja = DUDA_EN_CAJA;
              });
            },
            terminar: (opcion) => {
              if (
                fugaFase === "quieto" ||
                fugaFase === "retenido" ||
                fugaFase === "en-oficina" ||
                fugaFase === "fuera"
              ) {
                return;
              }
              // Solo lo detiene abordarlo BIEN. Las dos opciones de esta
              // situación son de clase "intervenir" —ver el comentario de la
              // tabla— así que aquí hay que mirar cuál de las dos: quitarle el
              // producto y soltarlo también es intervenir, y termina con él en
              // la calle igual que dejarlo salir.
              if (opcion?.clase === "intervenir" && opcion.correcta) {
                fugaFase = "retenido";
                migas.length = 0;
                ultimaMiga = null;
                clientes.mandarA("parkaVerde", [], 1.0);
                clientes.mirarA("parkaVerde", camara.globalPosition);
                return;
              }
              fugaFase = "hacia-puerta";
              // Por lo mismo que al entrar en la oficina: si te quedas en su
              // camino de salida, con la cortesía puesta no sale nunca y la
              // situación se queda a medias para siempre.
              clientes.cederElPaso("parkaVerde", false);
              clientes.mandarA("parkaVerde", SALIDA_A_PUERTA, 1.2, () => {
                fugaFase = "fuera";
                clientes.esconder("parkaVerde");
              });
            },
            // Cruzar la línea de cajas no tiene remate: o la está pasando o no.
            enSuMomento: () => true,
            // Salió por la puerta sin que lo miraras: ya no hay nada que ver.
            terminada: () => fugaFase === "fuera",
            punto: () => {
              // ─── SE MIRA DÓNDE ESTÁ, NO SI "YA LLEGÓ" ───────────────────
              //
              // Esto estuvo pidiendo que hubiera alcanzado su punto de la caja
              // —que la fase fuera "en-caja"— y era frágil de una forma que
              // solo se ve jugando: él le cede el paso al jugador y no se le
              // acerca a menos de ochenta centímetros, así que un jugador
              // plantado justo donde él va a pararse le deja clavado a un
              // palmo del destino. No "llegaba" nunca, la fase no cambiaba, y
              // su propia situación no saltaba. Vigilarlo de cerca —que es lo
              // que el panel anterior te acaba de pedir— rompía el remate.
              //
              // Con la posición no puede pasar: si está en la franja de la
              // línea de cajas, está pasando la línea de cajas, se haya
              // detenido donde se haya detenido.
              if (
                fugaFase === "quieto" ||
                fugaFase === "retenido" ||
                fugaFase === "en-oficina" ||
                fugaFase === "fuera"
              ) {
                return null;
              }
              const p = clientes.puntoDe("parkaVerde");
              if (!p) return null;
              // Pasado el extremo de la fila delantera (X 6,22) y a la altura
              // del mostrador. Antes de eso va por el pasillo transversal y es
              // un cliente más; pasado Z 5,2 ya está cruzando la entrada.
              if (p.x < 6.5 || p.z < 1.2 || p.z > 5.2) return null;
              return p;
            },
          };

        case "anulaciones-en-caja":
          return {
            empezar: () => cajera.gesticular("guardar"),
            terminar: () => cajera.gesticular(null),
            enSuMomento: () => cajera.remateALaVista(),
            punto: () => {
              if (!cajera.gestoALaVista()) return null;
              const p = cajera.raiz.position;
              // A la altura de los hombros: el pecho lo tapa el mostrador
              // desde media zona de cajas.
              return new Vector3(p.x, p.y + 1.42, p.z);
            },
          };

        case "salida-de-emergencia-bloqueada":
          return {
            // Alguien deja el pallet delante y amarra la barra. Hasta este
            // minuto la salida estaba despejada, y por eso hay novedad.
            // Una puerta tapada no tiene momento: lo está desde que la tapan.
            enSuMomento: () => true,
            empezar: () => bodega.taparSalida(true),
            // No se destapa al vencer la ventana: un pallet no se aparta solo.
            // Lo que se acaba es el plazo para darse cuenta, no el problema.
            terminar: () => undefined,
            punto: () => bodega.salidaEmergencia,
          };

        case "mochila-en-el-acceso":
          return {
            empezar: () => {
              if (fase !== "quieto") return;
              fase = "yendo";
              hombre.caminar([DEJA], 1.0, () => {
                hombre.mirarHacia(new Vector3(MOCHILA.x, piso + 0.25, MOCHILA.z));
                fase = "dejando";
                // Lo que tarda en agacharse, dejarla y enderezarse. No hay
                // animación de agacharse; este par de segundos parado de cara
                // al suelo es lo que la sugiere.
                esperaSuelta = 2.2;
              });
            },
            // No se "termina": una mochila abandonada no se recoge sola porque
            // se acabe la ventana. Se queda ahí el resto del turno, que es lo
            // que la hace incómoda.
            // HASTA QUE LA HAYA SOLTADO. Es el mismo fallo que el del gesto a
            // medias: el panel saltaba mientras él seguía andando hacia la
            // puerta con la mochila puesta, y preguntaba por un bulto
            // abandonado que todavía llevaba a la espalda.
            enSuMomento: () => fase === "soltada" && enElSuelo >= 1.5,
            terminar: () => undefined,
            punto: () => {
              // Ya en el suelo: lo que hay que ver es el bulto.
              if (fase === "soltada") return new Vector3(MOCHILA.x, piso + 0.3, MOCHILA.z);
              // Mientras la está dejando, él. Pero no antes: yendo hacia la
              // puerta con la mochila puesta es un cliente más, y preguntar
              // por un bulto abandonado mirando a alguien que lo lleva a la
              // espalda no tiene sentido.
              if (fase !== "dejando") return null;
              const p = hombre.raiz.position;
              return new Vector3(p.x, p.y + 1.3, p.z);
            },
          };

        default:
          return sala.de(id);
      }
    },

    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
      sala.dispose();
      figuras.forEach((f) => f.dispose());
      mochila.dispose();
    },
  };
}

/**
 * La mochila apoyada contra el muro: cuerpo, tapa y una correa que cae.
 *
 * Suelta y no colgada de nadie, así que se construye aparte de VestuarioFigura
 * — la de allí vive pegada al torso de una figura y no sabría estar en el
 * suelo.
 */
function crearMochila(scene: Scene, x: number, piso: number, z: number): Mesh {
  const tela = new PBRMaterial("matMochilaSuelo", scene);
  tela.albedoColor = new Color3(0.13, 0.15, 0.19);
  tela.metallic = 0;
  tela.roughness = 0.85;

  // ─── LAS PIEZAS SE ARMAN EN EL ORIGEN, NO EN SU SITIO ────────────────────
  //
  // Porque MergeMeshes hornea las posiciones DENTRO de los vértices y devuelve
  // una malla con la transformada en identidad. Armándolas ya colocadas, la
  // malla resultante tiene su geometría a cuatro metros del origen y su pivote
  // en el origen: girarla después no la gira sobre sí misma, la gira alrededor
  // del centro del local.
  //
  // Eso fue exactamente lo que pasó. Con un giro de −0,35 rad, la mochila
  // puesta en (4,28 · 6,72) acababa en (1,72 · 7,78) — medio metro DETRÁS de la
  // fachada. En la escena existía, era visible y no se veía desde ninguna
  // parte. Armada en el origen, position y rotation hacen lo que dicen.
  const ALTO = 0.26;
  const partes = [
    MeshBuilder.CreateBox("mochilaCuerpo", { width: 0.34, height: 0.5, depth: 0.24 }, scene),
    MeshBuilder.CreateBox("mochilaTapa", { width: 0.32, height: 0.16, depth: 0.12 }, scene),
    MeshBuilder.CreateBox("mochilaBolsillo", { width: 0.2, height: 0.18, depth: 0.06 }, scene),
    MeshBuilder.CreateBox("mochilaCorrea", { width: 0.06, height: 0.34, depth: 0.035 }, scene),
  ];
  partes[0].position.set(0, 0, 0);
  partes[1].position.set(0, 0.2, -0.07);
  partes[2].position.set(0, -0.06, 0.14);
  partes[3].position.set(-0.12, -0.05, -0.14);

  const mochila = Mesh.MergeMeshes(partes, true, true, undefined, false, false);
  if (!mochila) return partes[0];
  mochila.name = "mochilaAbandonada";
  mochila.material = tela;
  mochila.position.set(x, piso + ALTO, z);
  // Escorada contra el muro: una mochila dejada en el suelo no queda firme
  // como una caja, se vence.
  mochila.rotation.set(0.14, -0.35, 0.06);
  mochila.isPickable = false;
  mochila.receiveShadows = true;
  return mochila;
}

/**
 * Le quita la mochila de la espalda a una figura.
 *
 * Por nombre de malla y no por una API de Figura porque es lo único del juego
 * que se quita una prenda: darle a todas las figuras un método para desvestirse
 * por un caso sería pagarlo en las nueve.
 */
function ocultarMochilaDe(scene: Scene, nombreFigura: string): void {
  // Las correas van aparte y con otro nombre (ver VestuarioFigura). Escondiendo
  // solo el saco, el hombre se quedaba con los tirantes cruzados sobre el pecho
  // y nada colgando de ellos.
  const suyas = [`${nombreFigura}_mochila`, `${nombreFigura}_correa_`];
  scene.meshes
    .filter((m) => suyas.some((prefijo) => m.name.startsWith(prefijo)))
    .forEach((m) => (m.isVisible = false));
}
