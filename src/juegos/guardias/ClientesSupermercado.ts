import { Scene, Vector3, Color3, type Camera } from "@babylonjs/core";
import { sueloLibre } from "./ZonasSupermercado";
import { crearFigura, type Figura, type PaletaFigura, type Gesto } from "./Figura";
import type { Productos, TipoProducto } from "./ProductosSupermercado";
import { crearCarro, materialesCarro } from "./CarroSupermercado";

// ===========================================================================
// Los clientes de la sala de ventas
// ===========================================================================
//
// Ocho personas repartidas por las zonas del local. Cada una recorre su camino
// entre dos o tres puntos y se para delante de las góndolas.
//
// ─── POR QUÉ LAS FIGURAS DEL CONDOMINIO ──────────────────────────────────
//
// Porque ya están a la altura que pide el curso: cuerpo esculpido, ropa que
// dice quién es cada uno y una caminata que no patina (ver Figura). Unos
// clientes hechos aparte y más simples se verían como maniquíes al lado del
// supervisor del nivel 1. Lo que cambia es la ropa: aquí es una tarde de
// compras y no una noche de lluvia, así que hay polerones, camisas y el
// canasto del local.
//
// ─── POR QUÉ SIEMPRE LOS MISMOS ──────────────────────────────────────────
//
// Aquí no se sortea nada: ropa, estatura, tono de piel y recorrido son los
// mismos en todas las partidas. Si cambiaran, el jugador no podría reconocer a
// nadie, y le va a tocar distinguir a quién estaba observando. El joven alto
// del polerón mostaza está siempre en el último pasillo.
//
// Para eso cada uno lleva algo que se ve de lejos —un color, un canasto, un
// gorro, el pelo cano— y ninguno repite a la vez prenda y color.
//
// ─── QUÉ HACEN AL PARARSE ────────────────────────────────────────────────
//
// Se giran hacia el estante que tienen al lado y COMPRAN: alargan el brazo,
// cogen algo y lo echan al canasto, que se les va llenando a lo largo del
// turno. Tres de los ocho lo hacen (ver el campo compras).
//
// ─── POR QUÉ HACE FALTA QUE COMPREN ──────────────────────────────────────
//
// Porque sin ellos el cliente de la parka verde era el único del local que
// hacía algo con las manos, y entonces no había nada que distinguir: cualquier
// movimiento en un pasillo era EL movimiento. El jugador no aprendía a mirar,
// aprendía a detectar al que se mueve.
//
// Con tres canastos llenándose delante de él, los dos gestos empiezan igual
// —brazo al estante, vuelta con algo en la mano— y lo que cambia es dónde
// acaba esa mano y si antes miró a los lados. Eso ya es un criterio.
//
// Y es justo el gesto que hacía falta. Sin él, el cliente frena de cara al
// fondo del pasillo y se queda mirando al vacío: se lee como una figura a la
// que se le acabó el camino, no como alguien eligiendo un producto. Con el
// giro, cada parada tiene un motivo a la vista, y el motivo es la góndola.
//
// Por eso cada parada trae el punto del estante al que se gira —la cara de la
// góndola que le queda al lado, medida en la planta de aquí abajo— y no un
// ángulo: un ángulo habría que rehacerlo entero si la parada se mueve medio
// metro, y así el cliente sigue mirando lo que tiene delante.
//
// La cabeza también baja hacia el entrepaño, que está por debajo de sus ojos.
// Eso lo resuelve la figura sola (ver mirarHacia en Figura).
//
// ─── POR QUÉ NO SE ATRAVIESAN ────────────────────────────────────────────
//
// Tres cosas distintas, porque son tres estorbos distintos:
//
//   · ENTRE ELLOS. Nadie comparte tramo: cada recorrido va por su pasillo o
//     por su frente de estantería, así que dos clientes no se cruzan aunque
//     sus tiempos se desfasen.
//   · CONTRA LAS GÓNDOLAS. Ninguno se mete en una, porque los puntos se
//     midieron sobre la planta del modelo y dejan medio metro hasta cada
//     estante, que es lo que ocupa un cuerpo con un canasto al costado.
//   · CONTRA EL JUGADOR. Esto sí hace falta resolverlo en marcha, porque el
//     jugador va donde quiere. Cada cliente lleva un cilindro invisible con el
//     que chocas al caminar, y además se planta si el siguiente paso lo
//     metería encima de ti (ver `bulto` y `cederPasoA` en Figura).
//
// Los dos lados del último punto son necesarios. Solo el cilindro, y el
// cliente te empuja de espaldas por el pasillo como una topadora. Solo el
// frenar, y puedes meterte tú dentro de él y verle la cara por dentro.
//
// ─── LA PLANTA ────────────────────────────────────────────────────────────
//
// En coordenadas del juego, como la tabla de ZonasSupermercado. Medida sobre
// las mallas cargadas, a la altura de una persona:
//
//   · Góndolas del fondo:  de Z −7,11 a −1,31, de 1,25 m de ancho, con el
//                          borde izquierdo en X −8,96 · −5,89 · −2,82 · 0,25 ·
//                          3,32 · 6,39. Entre ellas, pasillos de 1,82 m
//                          centrados en X −6,80 · −3,73 · −0,66 · 2,41 · 5,48.
//   · Pasillo transversal: Z −1,31 a 1,30.
//   · Fila delantera:      Z 1,30 a 2,55, en dos tramos: X −8,17 a −2,37 y
//                          X 0,42 a 6,22.
//   · Mostrador de caja:   X 8,12 a 9,34 · Z 2,59 a 5,56. Se paga por el lado
//                          de la sala, el de X menor.

interface Parada {
  x: number;
  z: number;
  /** Segundos que se queda mirando el estante. */
  pausa: number;
  /**
   * El punto del frente de estante al que se gira durante la pausa, en planta.
   * Sale de la tabla de aquí arriba: la cara de la góndola que tiene al lado.
   */
  mira: { x: number; z: number };
  /**
   * Por dónde pasa antes de llegar, sin detenerse. Para quien empuja un carro:
   * el carro va metro y medio por delante, y los giros tienen que caer donde
   * cabe, no junto a una góndola.
   */
  por?: { x: number; z: number }[];
}

export interface Cliente {
  /** Da nombre a sus mallas. Dice lo que se ve de lejos. */
  nombre: string;
  altura: number;
  /** Metros por segundo. De compras se va más despacio que por la calle. */
  velocidad: number;
  paleta: PaletaFigura;
  /** En bucle: del último punto vuelve al primero. Espera quieto en el primero. */
  ruta: Parada[];
  /**
   * Lo que se le ve en la mano si le toca hacer el gesto de guardar.
   *
   * Solo lo lleva quien puede actuar en alguna situación. Al resto no se les
   * pone: una caja invisible colgando de la muñeca de ocho personas es ocho
   * mallas por nada.
   */
  producto?: { color: Color3; medidas: [number, number, number]; tipo?: TipoProducto };
  /**
   * Lo que se le va acumulando en el canasto. Solo quien viene a comprar.
   *
   * Tenerlo es lo que hace que este cliente HAGA la compra: coge del estante y
   * lo echa al canasto, en bucle, toda la tarde. Ver el gesto "comprar" en
   * Figura.
   */
  compras?: { color: Color3; cuantas: number };
  /** Si lleva teléfono. Ver la situación del canasto y el teléfono. */
  telefono?: boolean;
  /** Si empuja un carro en vez de llevar canasto. Ver CarroSupermercado. */
  carro?: boolean;
}

// Exportada para el estudio de figuras (depurar-personas.html): sirve para
// mirar de cerca ropa, cara y accesorios sin cargar el escenario entero.
export const CLIENTES: readonly Cliente[] = [
  // --- Góndolas ---------------------------------------------------------------

  // Primer pasillo. Camisa celeste y canasto: sale del trabajo y pasa a comprar.
  {
    nombre: "camisaCeleste",
    altura: 1.77,
    velocidad: 0.9,
    paleta: {
      uniforme: new Color3(0.42, 0.55, 0.7),
      pantalon: new Color3(0.16, 0.16, 0.17),
      piel: new Color3(0.5, 0.34, 0.25),
      detalle: new Color3(0.86, 0.86, 0.84),
      pelo: new Color3(0.09, 0.06, 0.04),
      prenda: "camisa",
      accesorio: "canasto",
      zapato: new Color3(0.03, 0.025, 0.02),
      rasgos: { nariz: 1, mandibula: 0.85, ancho: 1.02 },
    },
    // Mira a un lado, luego al otro, luego otra vez al primero: entra por el
    // pasillo revisando las dos filas.
    //
    // Las pausas suben a siete segundos porque ahora en cada una hace la
    // compra, y el ciclo entero dura seis. Con las de cuatro y tres que tenía,
    // el jugador le pillaba media cogida y el gesto no se entendía.
    ruta: [
      { x: -6.45, z: -2.3, pausa: 7, mira: { x: -5.89, z: -2.3 } },
      { x: -7.15, z: -4.4, pausa: 7, mira: { x: -7.71, z: -4.4 } },
      { x: -6.5, z: -6.2, pausa: 6, mira: { x: -5.89, z: -6.2 } },
    ],
    producto: { color: new Color3(0.72, 0.28, 0.2), medidas: [0.12, 0.17, 0.08], tipo: "leche" },
    compras: { color: new Color3(0.72, 0.28, 0.2), cuantas: 4 },
    // El de la situación del teléfono: a las 16:42 deja el canasto en el
    // suelo y se aparta a contestar. Ver ActoresSupermercado.
    telefono: true,
  },

  // Pasillo del centro. La señora del abrigo camel, con bolso: la que más
  // despacio va y la que más se detiene.
  {
    nombre: "abrigoCamel",
    altura: 1.57,
    velocidad: 0.72,
    paleta: {
      uniforme: new Color3(0.46, 0.33, 0.2),
      pantalon: new Color3(0.1, 0.1, 0.11),
      piel: new Color3(0.55, 0.4, 0.32),
      detalle: new Color3(0.3, 0.2, 0.12),
      pelo: new Color3(0.4, 0.385, 0.36),
      peinado: "largo",
      prenda: "abrigo",
      accesorio: "bolso",
      zapato: new Color3(0.08, 0.05, 0.035),
      rasgos: { nariz: 0.9, mandibula: 1.15, ancho: 0.97 },
    },
    ruta: [
      { x: -0.3, z: -2.6, pausa: 5, mira: { x: 0.25, z: -2.6 } },
      { x: -1.0, z: -4.9, pausa: 7, mira: { x: -1.57, z: -4.9 } },
    ],
    // Un frasco: lo que se lee de cerca. Es de la situación inocente del
    // tercer pasillo —lo coge, lo lee y lo devuelve—, y de ninguna otra cosa.
    producto: { color: new Color3(0.86, 0.8, 0.62), medidas: [0.08, 0.13, 0.08], tipo: "cereal" },
  },

  // Cuarto pasillo. Parka verde oliva con la capucha a la espalda, y canasto.
  //
  // ESTE ES EL DEL HURTO (ver SituacionesSupermercado). Se eligió entre los
  // ocho por tres razones que se ven desde el otro extremo del pasillo: la
  // parka es la única prenda del local con sitio donde meter algo, lleva el
  // canasto —así que el gesto lo hace con la mano libre y se entiende—, y el
  // cuarto pasillo queda en mitad de la sala, no en una esquina a la que solo
  // se llega queriendo.
  {
    nombre: "parkaVerde",
    altura: 1.64,
    velocidad: 0.85,
    paleta: {
      uniforme: new Color3(0.2, 0.24, 0.13),
      pantalon: new Color3(0.05, 0.05, 0.06),
      piel: new Color3(0.4, 0.26, 0.19),
      detalle: new Color3(0.12, 0.13, 0.08),
      pelo: new Color3(0.12, 0.07, 0.04),
      peinado: "largo",
      prenda: "parka",
      accesorio: "canasto",
      rasgos: { nariz: 0.85, mandibula: 1.1, ancho: 0.96 },
    },
    ruta: [
      { x: 2.8, z: -5.6, pausa: 5, mira: { x: 3.32, z: -5.6 } },
      { x: 2.0, z: -3.6, pausa: 4, mira: { x: 1.5, z: -3.6 } },
      { x: 2.75, z: -2.0, pausa: 3, mira: { x: 3.32, z: -2.0 } },
    ],
    // SIN "compras" A PROPÓSITO. Es el único de los cuatro que lleva canasto y
    // no echa nada dentro: se pasa la tarde mirando estantes con el canasto
    // vacío colgando del brazo, que es literalmente lo que dice su panel. Los
    // otros tres lo van llenando delante del jugador, y ese contraste es lo
    // que hace que su gesto signifique algo en vez de ser el único que hay.
    //
    // Una caja del tamaño de un paquete de galletas, en amarillo. Empezó
    // siendo la mitad y de color hueso, y a tres metros no se distinguía de la
    // mano: lo que hay que ver de lejos no es QUÉ es, es que en la mano hay
    // algo que antes no estaba y después tampoco. Amarillo porque es lo que
    // más se recorta contra la parka verde oliva y contra el blanco del
    // estante.
    producto: { color: new Color3(0.93, 0.74, 0.12), medidas: [0.15, 0.2, 0.09], tipo: "lata" },
  },

  // Último pasillo. El joven alto del polerón mostaza: el que más rápido va y
  // el que menos se para.
  {
    nombre: "poleronMostaza",
    altura: 1.84,
    velocidad: 1.0,
    paleta: {
      uniforme: new Color3(0.6, 0.42, 0.08),
      pantalon: new Color3(0.09, 0.14, 0.26),
      piel: new Color3(0.3, 0.19, 0.13),
      detalle: new Color3(0.85, 0.83, 0.78),
      pelo: new Color3(0.03, 0.025, 0.02),
      peinado: "rapado",
      prenda: "poleron",
      zapato: new Color3(0.8, 0.8, 0.78),
      suela: new Color3(0.9, 0.9, 0.88),
      rasgos: { nariz: 1.05, mandibula: 0.9 },
    },
    ruta: [
      { x: 5.85, z: -3.6, pausa: 3, mira: { x: 6.39, z: -3.6 } },
      { x: 5.15, z: -6.1, pausa: 4, mira: { x: 4.57, z: -6.1 } },
      { x: 5.2, z: -2.1, pausa: 3, mira: { x: 4.57, z: -2.1 } },
    ],
  },

  // Pasillo transversal, lado izquierdo. El señor canoso de chaqueta beige, con
  // mochila: va entre las cabeceras de las góndolas y el revés de la fila
  // delantera.
  {
    nombre: "chaquetaBeige",
    altura: 1.69,
    velocidad: 0.78,
    paleta: {
      uniforme: new Color3(0.5, 0.44, 0.33),
      pantalon: new Color3(0.2, 0.15, 0.1),
      piel: new Color3(0.46, 0.31, 0.23),
      detalle: new Color3(0.25, 0.2, 0.14),
      pelo: new Color3(0.42, 0.41, 0.39),
      prenda: "chaqueta",
      accesorio: "mochila",
      zapato: new Color3(0.12, 0.07, 0.04),
      rasgos: { nariz: 1.15, mandibula: 0.9, ancho: 1.04 },
    },
    // Las dos primeras, de cara al revés de la fila delantera (Z 1,30). La
    // tercera, a la cabecera de la segunda góndola del fondo (Z −1,31): se da
    // media vuelta en el cruce, que es lo que más se ve de este recorrido.
    ruta: [
      { x: -7.3, z: 0.75, pausa: 5, mira: { x: -7.3, z: 1.3 } },
      { x: -4.0, z: 0.7, pausa: 4, mira: { x: -4.0, z: 1.3 } },
      { x: -5.2, z: -0.75, pausa: 3, mira: { x: -5.2, z: -1.31 } },
    ],
  },

  // --- Entrada ----------------------------------------------------------------

  // Frente de la fila delantera, tramo izquierdo. Chaqueta roja y gorro de lana
  // gris.
  {
    nombre: "chaquetaRoja",
    altura: 1.71,
    velocidad: 0.95,
    paleta: {
      uniforme: new Color3(0.48, 0.07, 0.06),
      pantalon: new Color3(0.06, 0.07, 0.1),
      piel: new Color3(0.2, 0.12, 0.08),
      detalle: new Color3(0.35, 0.35, 0.36),
      pelo: new Color3(0.03, 0.03, 0.03),
      prenda: "chaqueta",
      gorroLana: true,
      // Canasto nuevo. Está en el frente de la fila delantera, que es lo
      // primero que se ve al entrar por la puerta: es quien le enseña al
      // jugador, sin decírselo, cómo se ve alguien comprando.
      accesorio: "canasto",
      zapato: new Color3(0.2, 0.2, 0.22),
      suela: new Color3(0.7, 0.7, 0.68),
      rasgos: { nariz: 1.1, mandibula: 0.95 },
    },
    // El tercer punto queda casi dos metros de la estantería, y mira a ella
    // igual: es el paso atrás de quien compara dos productos del mismo
    // entrepaño. De cerca no se distinguiría de las otras dos paradas.
    ruta: [
      { x: -7.4, z: 3.1, pausa: 7, mira: { x: -7.4, z: 2.55 } },
      { x: -4.6, z: 3.15, pausa: 7, mira: { x: -4.6, z: 2.55 } },
      { x: -5.8, z: 4.4, pausa: 6, mira: { x: -5.8, z: 2.55 } },
    ],
    producto: { color: new Color3(0.85, 0.7, 0.24), medidas: [0.12, 0.17, 0.08], tipo: "lata" },
    compras: { color: new Color3(0.85, 0.7, 0.24), cuantas: 4 },
  },

  // Frente de la fila delantera, tramo derecho: lo primero que se ve al entrar.
  // La muchacha del polerón lila, con canasto.
  {
    nombre: "poleronLila",
    altura: 1.6,
    velocidad: 0.88,
    paleta: {
      uniforme: new Color3(0.38, 0.3, 0.46),
      pantalon: new Color3(0.04, 0.04, 0.05),
      piel: new Color3(0.6, 0.45, 0.36),
      detalle: new Color3(0.9, 0.88, 0.86),
      pelo: new Color3(0.3, 0.19, 0.1),
      peinado: "largo",
      prenda: "poleron",
      zapato: new Color3(0.75, 0.74, 0.72),
      suela: new Color3(0.92, 0.92, 0.9),
      rasgos: { nariz: 0.8, mandibula: 1.2, ancho: 0.94 },
    },
    // CON CARRO: es la única, que el local es chico. Recorre la fila de
    // delante hacia la derecha, parando tres veces con el carro estacionado
    // a lo largo del estante, y vuelve por arriba dando la vuelta por los dos
    // lados donde hay sitio: por la derecha antes de las cajas y por la
    // izquierda en el pasillo que corta la fila de delante, a metro y medio de
    // la punta de la góndola. Así el carro nunca tiene que girar junto a un
    // estante —va metro y medio por delante de ella y se lo comería—, y llega
    // a cada parada ya paralelo. Medido en dos vueltas enteras: ninguna
    // esquina del carro entra en un mueble; la más cercana queda a 16 cm.
    carro: true,
    ruta: [
      {
        x: 1.3,
        z: 3.2,
        pausa: 7,
        mira: { x: 1.3, z: 2.55 },
        por: [
          { x: 5.7, z: 3.25 },
          { x: 6.3, z: 3.8 },
          { x: 5.8, z: 4.45 },
          { x: 3.0, z: 4.5 },
          { x: 0.2, z: 4.5 },
          { x: -1.2, z: 4.35 },
          { x: -1.5, z: 3.95 },
          { x: -1.5, z: 3.4 },
          { x: -1.15, z: 3.22 },
        ],
      },
      { x: 2.95, z: 3.2, pausa: 6, mira: { x: 2.95, z: 2.55 } },
      { x: 4.6, z: 3.2, pausa: 7, mira: { x: 4.6, z: 2.55 } },
    ],
    producto: { color: new Color3(0.24, 0.42, 0.62), medidas: [0.12, 0.17, 0.08], tipo: "pasta" },
    compras: { color: new Color3(0.24, 0.42, 0.62), cuantas: 4 },
  },

  // --- Cajas ------------------------------------------------------------------

  // En el mostrador: deja las cosas al principio de la cinta y paga junto a la
  // registradora. Camisa verde agua y bolso.
  {
    nombre: "camisaVerdeAgua",
    altura: 1.67,
    velocidad: 0.82,
    paleta: {
      uniforme: new Color3(0.36, 0.56, 0.5),
      pantalon: new Color3(0.08, 0.1, 0.2),
      piel: new Color3(0.24, 0.15, 0.1),
      detalle: new Color3(0.9, 0.9, 0.88),
      pelo: new Color3(0.02, 0.02, 0.02),
      peinado: "largo",
      prenda: "camisa",
      accesorio: "bolso",
      rasgos: { nariz: 0.9, mandibula: 1.15, ancho: 0.95 },
    },
    // Los dos puntos van en la misma vertical, así que camina a lo largo del
    // mostrador y al llegar se gira de costado hacia él: noventa grados a la
    // vista, el giro más limpio de los ocho.
    ruta: [
      { x: 7.6, z: 3.0, pausa: 6, mira: { x: 8.12, z: 3.0 } },
      { x: 7.6, z: 4.3, pausa: 8, mira: { x: 8.12, z: 4.3 } },
    ],
  },
];

/**
 * Lo que tarda en arrancar el primero, y cuánto más espera cada siguiente.
 *
 * Escalonado para que no echen a andar todos en el mismo cuadro, que es justo
 * lo que delataría que los mueve la misma mano.
 */
const PRIMER_ARRANQUE = 0.6;
const ARRANQUE_ESCALONADO = 0.7;

/**
 * A qué altura del estante se le va la vista durante la pausa, en metros
 * sobre el piso de la sala.
 *
 * El entrepaño del medio de una góndola de 1,80. Es donde mira quien compra
 * —lo de arriba y lo de abajo hay que ir a buscarlo— y queda por debajo de los
 * ojos de los ocho, así que todos bajan algo la cabeza.
 */
const ALTURA_ENTREPANO = 1.15;

/**
 * Radio del cilindro invisible de cada cliente, en metros.
 *
 * Treinta centímetros: el ancho de hombros de la figura más lo que sobresale
 * un canasto colgando del codo. Más ajustado, el brazo se te mete dentro al
 * pasar rozando; más ancho, chocas con aire medio metro antes del cuerpo.
 */
const BULTO = 0.3;

/**
 * Por dónde se coge un envase de cada balda, en altura de mundo.
 *
 * Las baldas de las góndolas están a 0,38 · 0,88 · 1,38 (medidas cara por cara
 * sobre la malla "Estanterías"; ver GraficaSupermercado), y un envase se coge
 * por el medio, una mano por encima de la balda.
 */
const ALTURAS_DE_COGER = [0.48, 0.98, 1.48] as const;

/** El gesto que hace cada cliente cuando nadie le manda otro. */
function gestoDe(cliente: Cliente): Gesto | null {
  return cliente.compras ? "comprar" : null;
}

export interface Clientes {
  /** Echa a andar a todos. Hasta entonces esperan de pie en su primera parada. */
  andar(): void;
  /**
   * Pone a uno a hacer un gesto, y lo deja clavado en su parada mientras lo
   * haga. Null lo devuelve a su recorrido.
   *
   * ─── POR QUÉ SE QUEDA QUIETO ────────────────────────────────────────────
   *
   * Porque el gesto solo se ve estando parado —caminando se apaga solo, ver
   * Figura— y porque el jugador tiene que poder encontrarlo. Si siguiera su
   * ruta, entrar al pasillo y verlo dependería de en qué tramo lo pillaras, y
   * una situación que dura quince minutos no puede depender de eso.
   *
   * Si le pilla a mitad de camino, termina de llegar a su parada y se queda
   * ahí: cortarle el paso en seco lo dejaría plantado en mitad del pasillo.
   */
  actuar(nombre: string, gesto: Gesto | null): void;
  /**
   * Dónde tiene el pecho, en coordenadas de la escena.
   *
   * Es el punto que hay que tener a la vista para que salte su situación. El
   * pecho y no los pies ni la cabeza: los pies se los tapa una góndola desde
   * casi cualquier sitio, y la cabeza se sale por arriba del encuadre en
   * cuanto te acercas.
   */
  puntoDe(nombre: string): Vector3 | null;
  /**
   * Si ese cliente está haciendo su gesto AHORA y se le ve hacerlo.
   *
   * Falso mientras termina de llegar a su parada: el gesto está puesto pero
   * caminando no se hace, y lo que hay delante del jugador es un señor con un
   * canasto. Ver gestoALaVista en Figura.
   */
  enPlenoGesto(nombre: string): boolean;
  /** Si ese cliente está en el remate de su gesto. Ver remateALaVista. */
  enElRemate(nombre: string): boolean;
  /**
   * Lo deja quieto donde llegue, sin gesto, fuera de su ronda. Para las
   * situaciones que le hacen hacer algo más largo que un gesto: soltar el
   * canasto, apartarse, contestar el teléfono.
   */
  retener(nombre: string): void;
  /** Lo devuelve a su ronda desde donde esté, con su gesto de siempre. */
  soltar(nombre: string): void;
  /** Si ya no está caminando: llegó a su parada o a donde lo mandaron. */
  quieto(nombre: string): boolean;
  /** La figura de ese cliente, para lo que las situaciones le hagan hacer. */
  figuraDe(nombre: string): Figura | null;
  /**
   * Lo saca de su ronda y lo manda por esa ruta, de una vez.
   *
   * Es para cuando un cliente deja de ser cliente y pasa a hacer algo suyo:
   * el de la parka verde, que después del pasillo cruza la línea de cajas y
   * se va. No vuelve al bucle por su cuenta — quien lo mandó decide qué hacer
   * con él al terminar.
   */
  mandarA(nombre: string, ruta: Vector3[], velocidad: number, alLlegar?: () => void): void;
  /** Lo quita de la sala. Se fue: ya no está, y no vuelve. */
  esconder(nombre: string): void;
  /** Lo gira hacia un punto. Solo surte efecto estando parado. */
  mirarA(nombre: string, punto: Vector3): void;
  /**
   * Le quita, o le devuelve, la cortesía de apartarse del jugador.
   *
   * ─── PARA QUÉ HACE FALTA QUITÁRSELA ─────────────────────────────────────
   *
   * Porque la cortesía y los recorridos con final se estorban. El retenido de
   * la línea de cajas termina entrando por la puerta de la oficina — y delante
   * de esa puerta está, por fuerza, el jugador, que es quien lo ha llevado
   * hasta ahí. Cediéndole el paso se queda clavado a ochenta centímetros y no
   * entra nunca: el final de la escena depende de que el jugador adivine que
   * tiene que apartarse.
   *
   * Quitándosela durante esos dos segundos puede rozarte al pasar. Es un mal
   * menor comparado con una escena que no termina, y el jugador lo lee como lo
   * que es: alguien que se mete por la puerta.
   */
  cederElPaso(nombre: string, activo: boolean): void;
  /**
   * Clava a los ocho donde están, o los suelta.
   *
   * Se usa con un panel de decisión delante. El reloj del turno ya se para
   * ahí; esto para la sala, que es la otra mitad de "congelar el momento".
   */
  congelar(quietos: boolean): void;
  dispose(): void;
}

/**
 * Pone a los clientes en la sala, cada uno en su primera parada.
 *
 * @param camara  La del jugador. Es a quien le ceden el paso: ver Figura.
 * @param piso    Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 */
/**
 * @param productos  Los productos de verdad de la góndola, para las manos y los
 *                   canastos. Sin ellos, cajas lisas del color de la tabla.
 */
export function crearClientes(scene: Scene, camara: Camera, piso: number, productos: Productos = {}): Clientes {
  const punto = (p: { x: number; z: number }): Vector3 => new Vector3(p.x, piso, p.z);
  /** El punto del estante, ya a la altura a la que se le va la vista. */
  const estante = (p: Parada): Vector3 =>
    new Vector3(p.mira.x, piso + ALTURA_ENTREPANO, p.mira.z);

  /** Quiénes NO se apartan del jugador ahora mismo. Ver cederElPaso. */
  const sinCortesia = new Set<string>();

  // Los carros de la sala, con sus materiales: sin reflejo del entorno,
  // que dentro no hay. Ver materialesCarro.
  const materialesSala = CLIENTES.some((c) => c.carro) ? materialesCarro(scene, "sala", false) : null;
  const carros: ReturnType<typeof crearCarro>[] = [];

  const enSala = CLIENTES.map((cliente, i) => {
    const carro = cliente.carro && materialesSala ? crearCarro(scene, `carro_${cliente.nombre}`, materialesSala) : null;
    if (carro) carros.push(carro);
    const figura = crearFigura(scene, `cliente_${cliente.nombre}`, {
      paleta: cliente.paleta,
      altura: cliente.altura,
      fase: i * 1.3,
      bulto: BULTO,
      cederPasoA: () => (sinCortesia.has(cliente.nombre) ? null : camara.globalPosition),
      sueloLibre,
      producto: cliente.producto,
      plantilla: cliente.producto?.tipo ? productos[cliente.producto.tipo] : undefined,
      // Lo que se echa al canasto es lo mismo que coge del estante.
      compras: cliente.compras && {
        ...cliente.compras,
        plantilla: cliente.producto?.tipo ? productos[cliente.producto.tipo] : undefined,
      },
      telefono: cliente.telefono,
      carro: carro?.nodo,
      // Las tres baldas de las góndolas, medidas sobre el modelo (ver
      // GraficaSupermercado), más diez centímetros: el medio de un envase
      // apoyado en ellas, que es por donde se coge. Con esto la mano va a una
      // balda de verdad y no a un punto fijo delante del pecho.
      alturasEstante: ALTURAS_DE_COGER,
    });
    // Ya de cara a su estante, no a la parada siguiente: los que arrancan más
    // tarde pasan varios segundos quietos, y en esos segundos tienen que estar
    // haciendo lo mismo que hacen en cualquier otra pausa.
    figura.situar(punto(cliente.ruta[0]), estante(cliente.ruta[0]));
    figura.mirarHacia(estante(cliente.ruta[0]));
    // El carro, estacionado hacia donde echará a andar.
    if (carro) {
      const desde = cliente.ruta[0];
      const hacia = cliente.ruta[1].por?.[0] ?? cliente.ruta[1];
      figura.situarCarro(Math.atan2(hacia.x - desde.x, hacia.z - desde.z));
    }
    // Quien viene a comprar, compra: el gesto se le pone y no se le quita en
    // todo el turno. Solo se ve estando parado —caminando se apaga solo, ver
    // Figura— así que lo hace en cada pausa delante de una góndola y en
    // ninguna otra parte.
    figura.gesticular(gestoDe(cliente));
    figura.visible(true);
    return {
      cliente,
      figura,
      /** La última parada a la que llegó. */
      parada: 0,
      /** Los segundos que le quedan en ella. */
      espera: PRIMER_ARRANQUE + i * ARRANQUE_ESCALONADO,
      andando: false,
      /** Mientras esté actuando no arranca hacia la parada siguiente. */
      actuando: false,
    };
  });

  const porNombre = new Map(enSala.map((c) => [c.cliente.nombre, c]));
  let enMarcha = false;

  let congelados = false;

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (!enMarcha || congelados) return;
    // El mismo tope que la caminata de Figura: con un tirón, la pausa y el paso
    // descuentan el mismo tiempo.
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

    for (const c of enSala) {
      if (c.andando) continue;
      // Actuando se queda donde está, y su espera no corre: al soltarlo,
      // arranca en el acto en vez de deberle quince minutos de pausa.
      if (c.actuando) continue;
      c.espera -= dt;
      if (c.espera > 0) continue;

      const siguiente = (c.parada + 1) % c.cliente.ruta.length;
      c.andando = true;
      const parada = c.cliente.ruta[siguiente];
      c.figura.caminar([...(parada.por ?? []).map(punto), punto(parada)], c.cliente.velocidad, () => {
        c.andando = false;
        c.parada = siguiente;
        c.espera = c.cliente.ruta[siguiente].pausa;
        // Frena mirando hacia donde venía caminando y desde ahí se gira al
        // estante. El giro es gradual —lo suaviza Figura—, así que se ve
        // llegar, girarse y quedarse, en ese orden.
        c.figura.mirarHacia(estante(c.cliente.ruta[siguiente]));
      });
    }
  });

  return {
    andar() {
      enMarcha = true;
    },

    actuar(nombre, gesto) {
      const c = porNombre.get(nombre);
      if (!c) return;
      c.actuando = gesto !== null;
      // Al soltarlo vuelve a SU gesto, no a ninguno: quien compraba sigue
      // comprando. Con null a secas, el de la camisa celeste dejaba de llenar
      // el canasto el resto de la tarde después de su llamada.
      c.figura.gesticular(gesto ?? gestoDe(c.cliente));
    },

    retener(nombre) {
      const c = porNombre.get(nombre);
      if (!c) return;
      c.actuando = true;
      c.figura.gesticular(null);
    },

    soltar(nombre) {
      const c = porNombre.get(nombre);
      if (!c) return;
      c.actuando = false;
      c.andando = false;
      // Un respiro antes de echar a andar: recién soltado, arrancar en el mismo
      // cuadro se lee como un muñeco al que le han dado cuerda.
      c.espera = 0.8;
      c.figura.gesticular(gestoDe(c.cliente));
    },

    quieto(nombre) {
      const c = porNombre.get(nombre);
      return !!c && !c.andando && c.figura.quieta();
    },

    figuraDe(nombre) {
      return porNombre.get(nombre)?.figura ?? null;
    },

    mandarA(nombre, ruta, velocidad, alLlegar) {
      const c = porNombre.get(nombre);
      if (!c) return;
      // Fuera del bucle y sin gesto: lo que venga ahora lo manda quien llama.
      c.actuando = true;
      c.andando = false;
      c.figura.gesticular(null);
      c.figura.caminar(ruta, velocidad, alLlegar);
    },

    congelar(quietos) {
      congelados = quietos;
      enSala.forEach((c) => c.figura.congelar(quietos));
    },

    cederElPaso(nombre, activo) {
      if (activo) sinCortesia.delete(nombre);
      else sinCortesia.add(nombre);
    },

    mirarA(nombre, punto) {
      porNombre.get(nombre)?.figura.mirarHacia(punto);
    },

    esconder(nombre) {
      const c = porNombre.get(nombre);
      if (!c) return;
      c.actuando = true;
      c.figura.visible(false);
    },

    enElRemate(nombre) {
      const c = porNombre.get(nombre);
      return !!c && c.figura.remateALaVista();
    },

    enPlenoGesto(nombre) {
      const c = porNombre.get(nombre);
      return !!c && c.figura.gestoALaVista();
    },

    puntoDe(nombre) {
      const c = porNombre.get(nombre);
      if (!c) return null;
      const p = c.figura.raiz.position;
      // Tres cuartos de su estatura: el pecho de esa persona, no de una media.
      return new Vector3(p.x, p.y + c.cliente.altura * 0.75, p.z);
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observador);
      enSala.forEach((c) => c.figura.dispose());
      carros.forEach((c) => {
        c.mallas.forEach((m) => m.dispose());
        c.nodo.dispose();
      });
    },
  };
}
