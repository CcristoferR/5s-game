import {
  Scene,
  TransformNode,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  Observer,
  PBRMaterial,
  type Material,
} from "@babylonjs/core";
import { vestir, MEDIDAS, type Esqueleto } from "./VestuarioFigura";
import type { Peinado, Rasgos } from "./ModeladoFigura";

// ===========================================================================
// Figura humana
// ===========================================================================
//
// Una persona que camina: el supervisor de las 03:20 y los vecinos que cruzan
// el hall de noche, y los clientes de la sala de ventas del supermercado.
//
// ─── DE MAQUETA A PERSONA ─────────────────────────────────────────────────
//
// Antes eran cajas: torso, brazos y piernas rectangulares y una cabeza lisa.
// Era lo único del hall que seguía viéndose como maqueta, y el supervisor lo
// enseñaba a dos metros de la cámara en el momento de más atención del turno.
// Además la camisa y la visera estaban en la espalda, así que de frente la
// figura no tenía nada.
//
// Ahora el cuerpo es esculpido (ver VestuarioFigura y ModeladoFigura): tronco
// con cintura y hombros, miembros que se afinan, manos, zapatos con talón y
// puntera, cara con sus volúmenes y ropa que dice quién es cada uno.
//
// ─── LO QUE HACE CREÍBLE LA CAMINATA ──────────────────────────────────────
//
//   1. PROPORCIÓN. Los ojos caen a 1,66 m, el hombro a 1,41, la cadera a 0,93.
//   2. LA CAMINATA. Las piernas alternan, los brazos van al revés, la rodilla
//      se dobla solo al pasar, el talón despega antes de levantar el pie y la
//      cadera sube y baja lo que le toca.
//   3. QUE NO PATINE. La fase del paso avanza según la DISTANCIA recorrida, y
//      el cuerpo se apoya siempre sobre el punto más bajo de los dos zapatos.
//   4. QUE MIRE. Plantado delante de alguien, inclina la cabeza hacia sus ojos
//      en vez de mirar al horizonte por encima de él.

/** Alto de referencia de la figura, en metros. */
const ALTURA = 1.75;

/** Metros que se avanzan por zancada completa (dos pasos). */
const ZANCADA = 1.5;

/** De la cadera a la suela, con la pierna recta. */
const LARGO_PIERNA = MEDIDAS.muslo + MEDIDAS.canilla + MEDIDAS.tobillo;

/**
 * Cuánto abre la pierna, en radianes.
 *
 * Sale de la condición de que el pie apoyado no se mueva mientras el cuerpo
 * pasa por encima: el pie se separa de la cadera como `L·sen(A·sen(fase))` y la
 * fase avanza 2π por ZANCADA, así que en el centro del apoyo `A = ZANCADA/(2π·L)`.
 */
const APERTURA_PIERNA = ZANCADA / (2 * Math.PI * LARGO_PIERNA);

/**
 * A cuántos metros de aquel a quien cede el paso se planta la figura.
 *
 * Ochenta centímetros: algo más que los sesenta y cinco a los que la frenaría
 * el choque —su cilindro más el volumen del jugador—, para que se detenga con
 * un palmo de aire por delante y no pegada a la cara. Frenar justo en el
 * contacto se lee como un tropiezo; frenar antes, como alguien que te ve venir.
 */
const ESPACIO_PERSONAL = 0.8;

/**
 * Cuánto espera, en segundos, a que el jugador se aparte de su camino antes de
 * seguir igual.
 *
 * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
 *
 * Porque ceder el paso sin límite deja a una figura clavada para siempre si el
 * jugador se queda quieto donde ella tiene que pasar — y el jugador se queda
 * quieto justo donde le manda Central. Pasó con la pareja de la distracción:
 * entraba por la puerta, el jugador estaba en la entrada esperándola, y el
 * hombre se quedó parado en el umbral el resto del turno. Nunca llegó a la
 * góndola y su situación no podía saltar.
 *
 * Con paciencia, espera un segundo y medio —lo que tarda cualquiera en
 * esquivar a alguien— y sigue. Solo espera sin límite si el jugador está
 * plantado EN su destino: ahí seguir sería meterse dentro de él. Es lo que
 * mantiene al retenido de la escolta a su distancia cuando te paras.
 */
const PACIENCIA = 1.5;

/**
 * ─── POR QUÉ LOS GESTOS SE REPITEN, Y POR QUÉ SON LENTOS ──────────────────
 *
 * Porque el jugador no sabe que tiene que mirar. Llega al pasillo cuando
 * llega, y si el gesto ocurriera una sola vez habría que acertar el segundo:
 * el que entra tarde vería a alguien de pie mirando un estante y el panel le
 * hablaría de algo que no pasó delante de él.
 *
 * Y lentos porque un gesto no se entiende por el recorrido que hace la mano,
 * se entiende por dónde se PARA. El de guardar estuvo en cinco segundos y
 * medio y en siete, y las dos veces se leía que cogía algo del estante y no se
 * leía que se lo guardaba: las dos paradas —la mano en la balda y la mano en
 * el cuerpo— tienen que durar lo suficiente para verlas.
 *
 * Los tiempos concretos de cada uno están en COREOGRAFIA.
 */

/** Curva en S: arranca y frena sin tirones. */
function suave(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** De 0 a 1 según cuánto se ha recorrido del tramo [a, b] del ciclo. */
/**
 * Cómo pone el canasto quien compra: brazo colgando, antebrazo horizontal y el
 * canasto delante del vientre, a unos 85 cm del suelo. Hombro en X, hombro en
 * Z (por lado) y codo.
 *
 * Es lo que hace cualquiera para echar algo dentro con la otra mano, y es lo
 * que más se ve de lejos: el canasto entero se mueve, no solo una mano.
 */
const CANASTO_ARRIBA: [number, number, number] = [0, -0.4, -1.5];

/**
 * Dónde acaba lo cogido, en el marco del tronco: por dentro de la parka, a la
 * altura de la cremallera. Unos cinco centímetros por detrás de la tela, para
 * que se vea hundirse en ella.
 */
const DENTRO_DE_LA_PRENDA = new Vector3(0.03, 1.2, 0.12);
/** Y en el marco del canasto: justo bajo la boca, asomando al entrar. */
const DENTRO_DEL_CANASTO = new Vector3(0, -0.27, 0);

function tramo(t: number, a: number, b: number): number {
  return suave((t - a) / (b - a));
}

export type Prenda = "uniforme" | "parka" | "abrigo" | "chaqueta" | "poleron" | "camisa";
export type Accesorio = "tablilla" | "mochila" | "bolso" | "paraguas" | "canasto";

export interface PaletaFigura {
  /** Chaqueta, abrigo o parka. */
  uniforme: Color3;
  /** Pantalón. */
  pantalon: Color3;
  /** Manos y cara. */
  piel: Color3;
  /** Camisa del uniforme, cremallera, gorro de lana. */
  detalle: Color3;
  /** Gorra de plato. Solo la lleva quien está de servicio. */
  gorra?: boolean;
  pelo?: Color3;
  peinado?: Peinado;
  prenda?: Prenda;
  accesorio?: Accesorio;
  gorroLana?: boolean;
  zapato?: Color3;
  suela?: Color3;
  rasgos?: Rasgos;
}

export interface OpcionesFigura {
  paleta: PaletaFigura;
  /**
   * Altura en metros. Por defecto 1,75. Tres personas idénticas cruzando el
   * mismo hall se leen como copias del mismo muñeco.
   */
  altura?: number;
  /**
   * Dónde arranca el vaivén de estar de pie, en segundos. Si falta, se sortea.
   * Quien tiene que comportarse igual en todas las partidas lo trae fijo.
   */
  fase?: number;
  /**
   * Radio en metros del cilindro invisible que le da cuerpo. Sin esto la
   * figura es un fantasma: el jugador se le mete dentro y le ve la cara desde
   * dentro del cráneo.
   */
  bulto?: number;
  /**
   * Dónde está, cuadro a cuadro, aquello a lo que esta figura le cede el paso
   * —el jugador—. Null cuando no hay a quién cedérselo.
   *
   * Es lo simétrico de `bulto`: el cilindro impide que te metas tú dentro de
   * ella, y esto impide que se meta ella dentro de ti.
   */
  cederPasoA?: () => Vector3 | null;
  /**
   * Si ese punto del suelo se puede pisar. Sin esto, la figura atraviesa
   * góndolas y mostradores como si no estuvieran.
   *
   * Una figura no consulta la colisión de la escena: interpola su posición y
   * ya. A los ocho clientes no se les notaba porque sus rutas están medidas
   * para no rozar nada, pero en cuanto una sigue al jugador su destino lo
   * decide él — y él puede ponerse al otro lado de una caja registradora.
   */
  sueloLibre?: (x: number, z: number) => boolean;
  /**
   * Lo que le aparece en la mano a mitad del gesto de guardar: el producto que
   * se lleva del estante, el billete que sale de la caja.
   *
   * Sin esto el gesto se entiende a medias. La mano va al estante y vuelve al
   * pecho, sí, pero vuelve vacía, y lo que el jugador ve es a alguien
   * rascándose. Con algo en la mano durante el tramo de en medio, la misma
   * animación pasa de "se toca la chaqueta" a "se guarda eso".
   *
   * Medidas en metros, de ancho, alto y fondo.
   */
  producto?: { color: Color3; medidas: [number, number, number] };
  /**
   * Lo que se le va acumulando en el canasto cada vez que compra algo.
   *
   * ─── POR QUÉ IMPORTA QUE SE LLENE ───────────────────────────────────────
   *
   * Porque es la prueba a la vista de que esa persona está comprando, y es el
   * contraste que hace legible al que no. A lo largo del turno los canastos de
   * la sala se van llenando; el del cliente de la parka verde sigue vacío al
   * final, y eso es exactamente lo que dice su panel.
   *
   * Un guardia de sala aprende a mirar los canastos antes que las caras.
   */
  compras?: { color: Color3; cuantas: number };
  /**
   * Si lleva teléfono. Solo lo saca con el gesto "telefono".
   *
   * Va aparte del producto porque quien lo lleva también compra: la misma mano
   * que echa cosas al canasto es la que, cuando suena, se lo lleva a la oreja.
   */
  telefono?: boolean;
}

/**
 * Los gestos que sabe hacer una figura.
 *
 * Todos son el MISMO esqueleto de movimiento —la mano va a un sitio, se queda
 * y vuelve— y lo que cambia es adónde va y qué lleva. Guardar y comprar
 * empiezan igual, en el estante; los otros tres son los de las situaciones
 * inocentes, y están hechos para parecerse a los sospechosos lo justo:
 *
 *   · llamar:   el brazo arriba, saludando. Quien quiere preguntarte algo.
 *   · telefono: la mano a la oreja, con el teléfono. Quien atiende una llamada.
 *   · leer:     coge un producto, se lo pone delante de la cara un buen rato y
 *               lo DEVUELVE al estante. Es el gesto del hurto con el final
 *               cambiado, y ese final es lo único que hay que mirar.
 */
export type Gesto = "guardar" | "comprar" | "llamar" | "telefono" | "leer";

interface Coreografia {
  /** Segundos que dura el ciclo entero. */
  ciclo: number;
  /** Si comprueba a los lados antes de alargar la mano. */
  vistazo: boolean;
  /** Los seis cortes: sube al estante, vuelve al cuerpo, baja el brazo. */
  tramos: [number, number, number, number, number, number];
  /**
   * Dónde acaba la mano: hombro en X, hombro en Z (por lado), codo y, si hace
   * falta, el giro del hombro en Y (por lado). Sin ese giro no hay forma de
   * llevarse la mano a la oreja con el codo hacia delante: el antebrazo solo
   * se dobla en el plano del brazo.
   */
  pose: [number, number, number, number?];
  /** Cuánto se encorva al dejar lo cogido en su sitio. */
  encorva: number;
  /** Entre qué fases se le ve lo que lleva en la mano. Null si no lleva nada. */
  producto: [number, number] | null;
  /** Entre qué fases el gesto SE ESTÁ VIENDO. Lo lee gestoALaVista. */
  visible: [number, number];
  /**
   * El REMATE: entre qué fases se está viendo lo que el gesto significa.
   *
   * No es el gesto entero. Es el tramo que empieza cuando lo cogido YA ha
   * desaparecido en su sitio —dentro de la prenda, dentro del canasto, de
   * vuelta en el estante— y sigue mientras la mano descansa. Empezaba un poco
   * antes, con el producto aún apoyado en el pecho, y el panel se abría justo
   * antes de verlo entrar. Es lo único que hay que haber visto para poder
   * responder por ello.
   */
  remate: [number, number];
  /**
   * Entre qué fases el producto viaja de la palma a su sitio. Al final de
   * este tramo ya está dentro —de la parka, del canasto— y se apaga.
   */
  entra?: [number, number];
  /** La mano va directa a su sitio, sin pasar por el estante. */
  sinEstante?: boolean;
  /**
   * Devuelve lo cogido: al soltar la pose la mano vuelve AL ESTANTE en vez de
   * al costado, y de ahí baja entre estas dos fases.
   */
  devuelve?: [number, number];
  /** Cuánto se mueve el brazo de lado a lado mientras está arriba. */
  saluda?: number;
  /** Cuánto baja la cabeza con la mano en su sitio. Por defecto 0,3. */
  inclina?: number;
}

/**
 * Los tiempos y las posturas de cada gesto.
 *
 * ─── POR QUÉ DOS Y NO UNO ─────────────────────────────────────────────────
 *
 * Porque un gesto solo significa algo al lado de otro. Con el cliente del
 * hurto como único que hacía algo con las manos, cualquier movimiento en un
 * pasillo era sospechoso — no había nada que distinguir, solo que detectar.
 *
 * Con los demás cogiendo cosas y echándolas al canasto, el jugador tiene que
 * mirar de verdad: los dos alargan el brazo al estante, los dos vuelven con
 * algo en la mano. Lo que cambia es dónde acaba esa mano y si antes miró a los
 * lados. Eso ya es un criterio, y un criterio es lo que el nivel enseña.
 */
const COREOGRAFIA: Record<Gesto, Coreografia> = {
  // Nueve segundos y seis tiempos. El codo se separa del costado y la mano
  // sube al pecho: la silueta cambia y se lee de lejos.
  guardar: {
    ciclo: 9,
    vistazo: true,
    tramos: [0.19, 0.31, 0.45, 0.57, 0.82, 0.93],
    // Medida, no a ojo: con esta pose la palma queda delante del centro del
    // pecho, a la altura de la cremallera. La de antes la dejaba junto a la
    // axila, a veinte centímetros de su lado, y desde lejos se leía como
    // alguien que se rasca el hombro.
    pose: [0.25, -0.95, -1.95],
    encorva: 0.15,
    producto: [0.3, 0.74],
    visible: [0.19, 0.93],
    remate: [0.75, 0.97],
    entra: [0.6, 0.74],
  },
  // Seis segundos y sin vistazo. El brazo cruza por delante y BAJA al canasto,
  // que es el sitio donde se pone lo que se va a pagar. Más corto porque no
  // hay nada que disimular: quien compra no se entretiene.
  comprar: {
    ciclo: 6,
    vistazo: false,
    tramos: [0.16, 0.3, 0.44, 0.56, 0.8, 0.92],
    // Brazo casi estirado hacia abajo y hacia dentro: la mano acaba justo
    // encima de la boca del canasto, que a la vez SUBE delante del vientre
    // (ver CANASTO_ARRIBA). La pose de antes dejaba la mano a la altura del
    // pecho y a ochenta centímetros del canasto: el producto se apagaba en el
    // aire, casi donde se apaga el del hurto, y los dos gestos se confundían.
    pose: [-0.6, -0.45, -0.15],
    encorva: 0.06,
    producto: [0.28, 0.74],
    visible: [0.16, 0.92],
    remate: [0.75, 0.95],
    entra: [0.6, 0.72],
  },
  // Cuatro segundos y medio: sube el brazo, saluda tres segundos largos y lo
  // baja. La cabeza no baja: mira a quien llama. Pose medida como las otras:
  // la mano queda por encima de la cabeza y a un palmo hacia fuera.
  llamar: {
    ciclo: 4.5,
    vistazo: false,
    sinEstante: true,
    tramos: [0, 0, 0.04, 0.14, 0.86, 0.96],
    pose: [-2.75, -0.15, 0, 1.45],
    encorva: 0,
    producto: null,
    visible: [0.14, 0.86],
    remate: [0.35, 0.86],
    saluda: 0.28,
    inclina: 0,
  },
  // Largo a propósito: una llamada no dura cuatro segundos. El teléfono sale
  // al subir la mano y se queda en la oreja lo que dure la situación. El codo
  // va hacia delante, que es como se sujeta un teléfono de verdad.
  telefono: {
    ciclo: 40,
    vistazo: false,
    sinEstante: true,
    tramos: [0, 0, 0.01, 0.03, 0.97, 0.99],
    pose: [-2.0, -0.88, -2.0, 0.65],
    encorva: 0,
    producto: [0.01, 0.99],
    visible: [0.03, 0.97],
    remate: [0.06, 0.97],
    inclina: 0.05,
  },
  // Doce segundos: alarga la mano, coge, se lo pone delante de la cara cinco
  // segundos, lo devuelve a la balda y baja el brazo vacío. El remate es ESO,
  // la mano volviendo sin nada: es lo que lo separa del gesto de guardar.
  leer: {
    ciclo: 12,
    vistazo: false,
    tramos: [0.06, 0.14, 0.2, 0.28, 0.66, 0.74],
    devuelve: [0.8, 0.9],
    pose: [-1.08, 0.6, -1.38, -1.05],
    encorva: 0.02,
    producto: [0.13, 0.76],
    visible: [0.06, 0.92],
    remate: [0.8, 0.97],
    inclina: 0.1,
  },
};

/**
 * El supervisor: uniforme oscuro, gorra de plato, placa, radio y la tablilla
 * de la fiscalización. A diez metros y en penumbra la gorra es lo que lo
 * distingue de un residente que vuelve a casa.
 */
export const UNIFORME_SUPERVISOR: PaletaFigura = {
  uniforme: new Color3(0.07, 0.085, 0.13),
  pantalon: new Color3(0.05, 0.058, 0.085),
  piel: new Color3(0.33, 0.21, 0.15),
  // Celeste de camisa de uniforme, no blanco: blanco bajo la luz del hall
  // se leía como un alzacuello.
  detalle: new Color3(0.26, 0.33, 0.44),
  gorra: true,
  pelo: new Color3(0.06, 0.05, 0.045),
  peinado: "rapado",
  prenda: "uniforme",
  accesorio: "tablilla",
  rasgos: { nariz: 1.05, mandibula: 0.8, ancho: 1.03 },
};

/**
 * Ropa de calle, para los residentes.
 *
 * Lo que las separa entre sí no es tanto el color como la silueta: una parka
 * con capucha y mochila, un abrigo largo con bolso, una chaqueta con gorro de
 * lana y una gabardina con paraguas se distinguen a diez metros; cuatro
 * chaquetas de colores no.
 */
export const ROPA_RESIDENTE: PaletaFigura[] = [
  {
    uniforme: new Color3(0.26, 0.28, 0.33),
    pantalon: new Color3(0.07, 0.1, 0.19),
    piel: new Color3(0.36, 0.24, 0.17),
    detalle: new Color3(0.08, 0.08, 0.09),
    pelo: new Color3(0.1, 0.07, 0.05),
    prenda: "parka",
    accesorio: "mochila",
    zapato: new Color3(0.36, 0.37, 0.4),
    suela: new Color3(0.78, 0.77, 0.74),
    rasgos: { nariz: 0.95, mandibula: 1 },
  },
  {
    uniforme: new Color3(0.38, 0.12, 0.13),
    pantalon: new Color3(0.08, 0.08, 0.09),
    piel: new Color3(0.45, 0.3, 0.23),
    detalle: new Color3(0.6, 0.55, 0.45),
    pelo: new Color3(0.14, 0.08, 0.045),
    peinado: "largo",
    prenda: "abrigo",
    accesorio: "bolso",
    rasgos: { nariz: 0.8, mandibula: 1.2, ancho: 0.95 },
  },
  {
    uniforme: new Color3(0.13, 0.22, 0.19),
    pantalon: new Color3(0.19, 0.19, 0.21),
    piel: new Color3(0.26, 0.16, 0.11),
    detalle: new Color3(0.42, 0.14, 0.1),
    pelo: new Color3(0.04, 0.035, 0.03),
    prenda: "chaqueta",
    gorroLana: true,
    rasgos: { nariz: 1.1, mandibula: 0.9 },
  },
  {
    uniforme: new Color3(0.52, 0.46, 0.36),
    pantalon: new Color3(0.12, 0.13, 0.2),
    piel: new Color3(0.42, 0.28, 0.21),
    detalle: new Color3(0.3, 0.26, 0.2),
    pelo: new Color3(0.55, 0.53, 0.5),
    prenda: "abrigo",
    accesorio: "paraguas",
    zapato: new Color3(0.12, 0.07, 0.04),
    rasgos: { nariz: 1, mandibula: 1.05 },
  },
];

export interface Figura {
  raiz: TransformNode;
  /** Coloca la figura de golpe, sin caminar. */
  situar(punto: Vector3, mirandoHacia?: Vector3): void;
  /** Camina por los puntos, en orden, y avisa al llegar al último. */
  caminar(ruta: Vector3[], velocidad: number, alLlegar?: () => void): void;
  /** Gira suavemente hasta quedar de cara a ese punto, y lo mira a su altura. */
  mirarHacia(punto: Vector3): void;
  /** Si ya no le queda camino por andar. */
  quieta(): boolean;
  /**
   * Pone un gesto, que se repite mientras esté puesto. Null lo quita.
   *
   * Entra y sale con un fundido de peso, no de golpe: un brazo que aparece ya
   * estirado se ve como un fallo de dibujado. Y solo se nota estando parada —
   * caminando, el gesto se apaga solo y vuelve el braceo, porque nadie se
   * guarda nada en el bolsillo mientras cruza un pasillo.
   */
  gesticular(gesto: Gesto | null): void;
  /**
   * Si ahora mismo el gesto se está VIENDO: parada, con peso, y en el tramo en
   * que la mano va al objeto, lo sostiene y se lo lleva al cuerpo.
   *
   * ─── PARA QUÉ HACE FALTA SABER ESTO ───────────────────────────────────────
   *
   * Para no preguntarle al jugador por algo que todavía no ha pasado delante
   * de él. La situación salta cuando lleva un rato mirando al actor, y sin
   * esta comprobación ese rato corría igual mientras el actor venía andando
   * por el pasillo: el panel se abría para contarle un hurto y lo último que
   * había visto era a un señor caminando con un canasto.
   *
   * Deja fuera a propósito el vistazo a los lados del principio y el bajar el
   * brazo del final. Los dos son parte del gesto, pero ninguno de los dos, por
   * sí solo, deja ver qué se llevó.
   */
  gestoALaVista(): boolean;
  /**
   * Deja en el suelo, en ese punto, lo que lleva colgando de la mano.
   *
   * Para quien suelta el canasto para atender el teléfono. El canasto se queda
   * donde lo dejó, derecho y en el suelo, aunque ella se aparte.
   */
  soltarCarga(punto: Vector3): void;
  /** Lo vuelve a coger, esté donde esté. */
  recogerCarga(): void;
  /** Dónde está lo que dejó en el suelo. Null si lo lleva en la mano. */
  cargaEnElSuelo(): Vector3 | null;
  /**
   * Si AHORA MISMO se está viendo el remate: lo cogido ya en su sitio.
   *
   * ─── POR QUÉ NO BASTA CON gestoALaVista ─────────────────────────────────
   *
   * Porque ese dice que hay algo que ver, y este dice que ya se ha visto LO
   * QUE IMPORTA. Con solo el primero, el panel saltaba a mitad del gesto: el
   * jugador llevaba su segundo y pico mirando, pero mirando el brazo estirado
   * hacia la balda. Se le preguntaba si lo había visto guardarse algo cuando
   * todavía no se lo había guardado.
   *
   * Es la diferencia entre "llevas un rato mirando" y "lo has visto hacerlo",
   * y es la segunda la que da derecho a preguntar.
   */
  remateALaVista(): boolean;
  /**
   * La deja clavada como está, o la suelta.
   *
   * ─── QUÉ SE CONGELA Y POR QUÉ ─────────────────────────────────────────────
   *
   * Todo: el avance por la ruta, el ciclo del paso, el gesto y hasta el vaivén
   * de estar de pie. La figura se queda en la postura exacta del cuadro en que
   * se congeló y sigue ahí al soltarla, sin saltos.
   *
   * Hace falta porque el reloj del turno se para con un panel delante pero la
   * escena no, y eso convertía la decisión en mentira: el jugador leía "pasa
   * la línea de cajas sin pagar", elegía ir a por él, cerraba la tarjeta — y
   * durante esos diez segundos de lectura el cliente había terminado de
   * cruzar la sala y había salido por la puerta. La respuesta correcta se
   * cobraba viendo exactamente lo contrario de lo que se había decidido.
   *
   * "Congelar el momento" tiene que incluir al momento, no solo al reloj.
   */
  congelar(quieta: boolean): void;
  visible(v: boolean): void;
  dispose(): void;
}

export function crearFigura(scene: Scene, nombre: string, opciones: OpcionesFigura): Figura {
  const escala = (opciones.altura ?? ALTURA) / ALTURA;
  const nodo = (sufijo: string, padre: TransformNode, x: number, y: number, z = 0): TransformNode => {
    const n = new TransformNode(`${nombre}_${sufijo}`, scene);
    n.parent = padre;
    n.position.set(x, y, z);
    return n;
  };

  // --- Esqueleto ------------------------------------------------------------
  //
  // Nodos en las articulaciones: la cadera arrastra el cuerpo entero, cada
  // miembro tiene su articulación de arriba y la de abajo, y el pie su tobillo.
  const raiz = new TransformNode(`figura_${nombre}`, scene);
  const cuerpo = nodo("cuerpo", raiz, 0, MEDIDAS.cadera);
  const cabeza = nodo("cabeza", cuerpo, 0, MEDIDAS.cuello);
  const esq: Esqueleto = { cuerpo, cabeza, hombros: [], codos: [], caderas: [], rodillas: [], tobillos: [] };
  [-1, 1].forEach((lado) => {
    const hombro = nodo(`artHombro_${lado}`, cuerpo, lado * MEDIDAS.hombroX, MEDIDAS.hombroY);
    esq.hombros.push(hombro);
    esq.codos.push(nodo(`artCodo_${lado}`, hombro, 0, -MEDIDAS.brazo));
    const cadera = nodo(`artCadera_${lado}`, cuerpo, lado * MEDIDAS.caderaX, 0);
    esq.caderas.push(cadera);
    const rodilla = nodo(`artRodilla_${lado}`, cadera, 0, -MEDIDAS.muslo);
    esq.rodillas.push(rodilla);
    esq.tobillos.push(nodo(`artTobillo_${lado}`, rodilla, 0, -MEDIDAS.canilla));
  });

  const piezas: Mesh[] = vestir(scene, nombre, esq, opciones.paleta);
  /** Lo que lleva colgando de una mano, si lleva algo. Lo pone vestir. */
  const carga = esq.carga;

  // --- Cuerpo sólido --------------------------------------------------------
  //
  // Un cilindro invisible, del alto de la figura, con el que choca el jugador.
  //
  // ─── POR QUÉ NO SIRVE LA PROPIA ROPA ──────────────────────────────────────
  //
  // Porque la colisión de Babylon prueba triángulo a triángulo, y un cuerpo
  // vestido son miles repartidos en veintitantas mallas que además se mueven
  // cada cuadro. Ocho caras alrededor de la cintura frenan igual de bien y no
  // se notan: lo que se siente al chocar es dónde te paras, no con qué.
  //
  // Colgado de la raíz, así que la sigue sola al caminar y se apaga con ella
  // —Babylon salta las mallas deshabilitadas al colisionar—, que es lo que
  // hace falta para que un cliente escondido no siga estorbando en su sitio.
  if (opciones.bulto) {
    const solido = MeshBuilder.CreateCylinder(
      `${nombre}_bulto`,
      { height: ALTURA, diameter: opciones.bulto * 2, tessellation: 8 },
      scene
    );
    solido.parent = raiz;
    solido.position.y = ALTURA / 2;
    solido.isVisible = false;
    // Fuera del picking: un clic sobre un cliente no puede robarle el evento a
    // lo que sí es interactivo, igual que pasa con el escenario.
    solido.isPickable = false;
    solido.checkCollisions = true;
    piezas.push(solido);
  }

  // --- Movimiento -----------------------------------------------------------

  let ruta: Vector3[] = [];
  let indiceRuta = 0;
  let velocidad = 0;
  let alLlegar: (() => void) | undefined;

  /** Metros recorridos en total. Es lo que manda la fase del paso. */
  let recorrido = 0;
  let rumbo = 0;
  let rumboDeseado = 0;
  /** Cuánto está caminando ahora, de 0 a 1. Suaviza arrancar y parar. */
  let marcha = 0;
  let reloj = opciones.fase ?? Math.random() * 10;
  /** A qué altura mira cuando está plantado, si se le dio un punto con altura. */
  let mirada: Vector3 | null = null;
  let cabeceo = 0;
  /** El gesto puesto, cuánto pesa ahora mismo y por dónde va su ciclo. */
  let gesto: Gesto | null = null;
  /**
   * El último gesto que tuvo puesto. Mientras el peso se apaga hay que seguir
   * dibujando ESE, no uno por defecto: al quitarle el saludo, el brazo tiene
   * que bajar desde arriba, no saltar a la postura de otro gesto.
   */
  let ultimoGesto: Gesto = "guardar";
  /** Si lo que llevaba colgando está en el suelo. Ver soltarCarga. */
  let cargaSuelta = false;
  let pesoGesto = 0;
  let relojGesto = 0;
  /** Lo que el gesto le gira la cabeza para mirar a los lados. */
  let giroGesto = 0;
  /** Lo que el gesto le baja la cabeza para mirarse las manos. */
  let inclinaGesto = 0;
  /** Peso y fase del gesto en el último cuadro. Los lee gestoALaVista. */
  let pesoUltimo = 0;
  let faseUltima = 0;
  /** Clavada donde está: ni anda, ni bracea, ni gesticula, ni respira. */
  let congelada = false;

  /**
   * El brazo con el que se gesticula: el que no lleva nada.
   *
   * Con el canasto en una mano, guardarse algo con esa misma mano exigiría
   * soltarlo primero, y eso ya es otra animación. Con la libre no hay nada
   * que explicar.
   */
  const brazoLibre = carga ? 1 - carga.brazo : 1;

  // Lo que sale en la mano a mitad del gesto. Nace apagado y solo se enciende
  // en el tramo en que la mano va del estante al pecho.
  let enLaMano: Mesh | null = null;
  /** Dónde va el producto en la mano, en el marco del antebrazo. */
  const palma = new Vector3(0, -MEDIDAS.antebrazo - 0.02, 0.06);
  if (opciones.producto) {
    const [ancho, alto, fondo] = opciones.producto.medidas;
    enLaMano = MeshBuilder.CreateBox(`${nombre}_enLaMano`, { width: ancho, height: alto, depth: fondo }, scene);
    const matProducto = new PBRMaterial(`${nombre}_matEnLaMano`, scene);
    matProducto.albedoColor = opciones.producto.color;
    matProducto.metallic = 0;
    matProducto.roughness = 0.65;
    enLaMano.material = matProducto;
    enLaMano.parent = esq.codos[brazoLibre];
    // EN LA PALMA. Estuvo medio producto más abajo —restándole también la
    // mitad de su alto— y quedaba colgando por delante de los dedos, como si
    // flotara: con el brazo caído se le veía a la altura del muslo. El puño
    // está justo al extremo del antebrazo, y ahí es donde se sujeta algo.
    enLaMano.position.copyFrom(palma);
    enLaMano.isVisible = false;
    enLaMano.isPickable = false;
    piezas.push(enLaMano);
  }

  // El teléfono: en la misma mano que el producto, y solo con su gesto.
  let telefono: Mesh | null = null;
  if (opciones.telefono) {
    telefono = MeshBuilder.CreateBox(`${nombre}_telefono`, { width: 0.07, height: 0.145, depth: 0.012 }, scene);
    const matTelefono = new PBRMaterial(`${nombre}_matTelefono`, scene);
    matTelefono.albedoColor = new Color3(0.05, 0.05, 0.06);
    matTelefono.metallic = 0.2;
    matTelefono.roughness = 0.35;
    telefono.material = matTelefono;
    telefono.parent = esq.codos[brazoLibre];
    telefono.position.copyFrom(palma);
    telefono.isVisible = false;
    telefono.isPickable = false;
    piezas.push(telefono);
  }
  /** Dónde va lo que cuelga de la mano, para devolverlo ahí al recogerlo. */
  const cargaEnMano = carga
    ? { padre: carga.nodo.parent, posicion: carga.nodo.position.clone() }
    : null;

  // Lo que se va echando al canasto. Nacen escondidas y se encienden de una en
  // una, al final de cada compra. Van dentro de la boca pero asomando por
  // encima del borde: metidas del todo no se verían desde la altura a la que
  // mira alguien de pie, y entonces no contarían para nada.
  const compras: Mesh[] = [];
  if (opciones.compras && carga) {
    const matCompra = new PBRMaterial(nombre + "_matCompras", scene);
    matCompra.albedoColor = opciones.compras.color;
    matCompra.metallic = 0;
    matCompra.roughness = 0.7;
    for (let i = 0; i < opciones.compras.cuantas; i++) {
      const bulto = MeshBuilder.CreateBox(
        nombre + "_compra_" + i,
        { width: 0.075, height: 0.2 + (i % 2) * 0.05, depth: 0.075 },
        scene
      );
      bulto.parent = carga.nodo;
      // Repartidas por la boca y con un giro suelto cada una: dos cajas
      // idénticas y alineadas se leen como decoración, no como compra.
      bulto.position.set(0.035 - (i % 3) * 0.035, -0.3, -0.11 + i * 0.075);
      bulto.rotation.set(0.05, (i % 2 === 0 ? 1 : -1) * 0.22, 0.04);
      bulto.material = matCompra;
      bulto.isVisible = false;
      bulto.isPickable = false;
      compras.push(bulto);
      piezas.push(bulto);
    }
  }

  function girarHacia(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    rumboDeseado = Math.atan2(dx, dz);
  }

  /**
   * Si puede dar el paso que la dejaría en ese punto.
   *
   * ─── POR QUÉ SOLO CUENTA ACERCARSE ────────────────────────────────────────
   *
   * Porque si bastara con estar cerca, plantarse al lado de un cliente lo
   * dejaría clavado hasta apartarse: tendría prohibido cualquier paso, incluso
   * el que lo aleja. Comparando con la distancia a la que ya está, lo único
   * que no puede hacer es encimársete. Seguir su camino bordeándote, sí.
   */
  function dejaPasar(x: number, z: number, destino: Vector3): boolean {
    const otro = opciones.cederPasoA?.();
    if (!otro) return true;
    const nueva = Math.hypot(x - otro.x, z - otro.z);
    if (nueva > ESPACIO_PERSONAL) return true;
    if (nueva >= Math.hypot(raiz.position.x - otro.x, raiz.position.z - otro.z)) return true;
    // Se le acercaría. Espera, salvo que lleve un rato esperando y el jugador
    // no esté plantado en su destino: entonces sigue. Ver PACIENCIA.
    const enSuDestino = Math.hypot(destino.x - otro.x, destino.z - otro.z) < ESPACIO_PERSONAL;
    return !enSuDestino && esperandoPaso > PACIENCIA;
  }
  /** Lo que lleva esperando a que el jugador se aparte, en segundos. */
  let esperandoPaso = 0;

  /** Diferencia de ángulos por el camino corto. Sin esto gira al revés. */
  function acortar(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!raiz.isEnabled() || congelada) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    reloj += dt;

    // --- Avance por la ruta -------------------------------------------------
    let avanzando = false;
    if (indiceRuta < ruta.length) {
      const destino = ruta[indiceRuta];
      const dx = destino.x - raiz.position.x;
      const dz = destino.z - raiz.position.z;
      const falta = Math.hypot(dx, dz);

      if (falta < 0.04) {
        indiceRuta += 1;
        if (indiceRuta >= ruta.length) {
          const aviso = alLlegar;
          alLlegar = undefined;
          ruta = [];
          if (aviso) aviso();
        }
      } else {
        girarHacia(dx, dz);
        // No avanza de frente hasta estar más o menos encarado: caminar de
        // lado en las esquinas es el gesto que delata al robot.
        const desvio = Math.abs(acortar(rumboDeseado - rumbo));
        const freno = desvio > 1.2 ? 0.15 : 1;
        const paso = Math.min(falta, velocidad * freno * dt);
        const x = raiz.position.x + (dx / falta) * paso;
        const z = raiz.position.z + (dz / falta) * paso;
        // Si el paso la metería encima del jugador, no lo da: se queda en el
        // sitio, con la ruta intacta, y sigue en cuanto le dejen. Se para de
        // verdad porque `avanzando` queda en falso y la caminata se apaga sola.
        const cede = !dejaPasar(x, z, destino);
        esperandoPaso = cede ? esperandoPaso + dt : 0;
        if (!cede && (opciones.sueloLibre?.(x, z) ?? true)) {
          raiz.position.x = x;
          raiz.position.z = z;
          recorrido += paso;
          avanzando = paso > 0.0005;
        }
      }
    }

    const resto = acortar(rumboDeseado - rumbo);
    rumbo += resto * Math.min(1, dt * 7);
    raiz.rotation.y = rumbo;

    // --- Ciclo de caminata --------------------------------------------------
    marcha += ((avanzando ? 1 : 0) - marcha) * Math.min(1, dt * 6);
    const fase = (recorrido / ZANCADA) * Math.PI * 2;
    const amplitud = marcha;

    // Inclinación hacia delante al caminar, balanceo de hombros y un vaivén
    // de peso muy leve estando quieto: nadie está perfectamente clavado.
    cuerpo.rotation.x = 0.05 * amplitud;
    cuerpo.rotation.y = Math.sin(fase) * 0.07 * amplitud;
    cuerpo.rotation.z = Math.sin(fase) * 0.025 * amplitud + Math.sin(reloj * 0.6) * 0.008 * (1 - amplitud);

    esq.caderas.forEach((cadera, i) => {
      const f = fase + (i === 0 ? 0 : Math.PI);
      // Positivo lleva la pierna hacia atrás (la figura avanza hacia su +Z).
      cadera.rotation.x = Math.sin(f) * APERTURA_PIERNA * amplitud;
      // La rodilla solo se dobla en el tramo en que la pierna pasa hacia
      // delante, con el talón hacia atrás (giro positivo).
      const doblez = Math.max(0, -Math.sin(f - 0.6)) * 1.0 * amplitud;
      esq.rodillas[i].rotation.x = doblez;
      // El pie va plano respecto al suelo; al doblar la rodilla el talón
      // despega antes que la puntera, y al adelantarse entra con la puntera
      // un poco arriba, apoyando primero el talón.
      const plano = -(cuerpo.rotation.x + cadera.rotation.x + doblez);
      const talonArriba = doblez * 0.45;
      const punteraArriba = -Math.pow(Math.max(0, -Math.sin(f)), 2) * 0.18 * amplitud;
      esq.tobillos[i].rotation.x = plano + talonArriba + punteraArriba;
    });

    esq.hombros.forEach((hombro, i) => {
      const lado = i === 0 ? -1 : 1;
      const f = fase + (i === 0 ? Math.PI : 0);
      if (carga?.brazo === i && !cargaSuelta) {
        // Con peso en la mano el brazo apenas bracea, va estirado y se abre
        // del cuerpo: es lo que separa el canasto de la pierna al caminar.
        hombro.rotation.x = Math.sin(f) * 0.08 * amplitud + Math.sin(reloj * 0.8 + i) * 0.01 * (1 - amplitud);
        hombro.rotation.z = lado * 0.24;
        esq.codos[i].rotation.x = -0.05;
        return;
      }
      // Los brazos van al revés que las piernas y algo separados del cuerpo,
      // para que las manos no atraviesen el abrigo.
      hombro.rotation.x = Math.sin(f) * 0.32 * amplitud + Math.sin(reloj * 0.8 + i) * 0.015 * (1 - amplitud);
      hombro.rotation.z = lado * (0.07 + 0.02 * amplitud);
      // El codo nunca se estira del todo, ni parado.
      esq.codos[i].rotation.x = -(0.16 + Math.max(0, Math.sin(f)) * 0.3) * amplitud - 0.12;
    });

    // --- El gesto -------------------------------------------------------
    //
    // Va DESPUÉS del braceo y lo pisa, porque el braceo escribe los mismos
    // tres ángulos cada cuadro: mezclarlo antes no serviría de nada.
    //
    // El peso sube y baja con el gesto puesto, y además se multiplica por lo
    // parada que está. Así, si echa a andar con el gesto puesto, el brazo
    // vuelve solo al braceo sin que nadie tenga que acordarse de quitarlo.
    const quiere = gesto !== null ? 1 : 0;
    pesoGesto += (quiere - pesoGesto) * Math.min(1, dt * 4);
    const peso = pesoGesto * (1 - amplitud);

    // EL CICLO SOLO CORRE CUANDO EL GESTO SE ESTÁ VIENDO.
    //
    // Si corriera siempre, a quien se le manda el gesto mientras va camino de
    // su parada le habría avanzado medio ciclo antes de llegar: se planta
    // delante del estante y lo primero que hace es sacarse la mano del pecho,
    // sin que nadie le haya visto meter nada. El gesto empieza cuando empieza
    // a verse.
    if (gesto !== null && peso > 0.05) relojGesto += dt;
    if (gesto !== null) ultimoGesto = gesto;
    const activo = gesto ?? ultimoGesto;
    const paso = COREOGRAFIA[activo];
    pesoUltimo = peso;
    faseUltima = (relojGesto / paso.ciclo) % 1;

    if (peso > 0.002) {
      const t = faseUltima;

      // Dos pesos que se relevan: primero el brazo se estira al estante, y al
      // empezar a volver al pecho el primero se apaga mientras el segundo
      // sube. Suman uno como mucho, así que lo que sobra es reposo.
      //
      // ─── LOS TRAMOS SE APOYAN, NO SE CRUZAN ─────────────────────────────
      //
      // Entre subir y bajar hay un rato en que el peso se queda en uno: el
      // brazo estirado de 0,40 a 0,54 y la mano en el pecho de 0,68 a 0,86.
      // Sin esas mesetas el brazo sube y baja de corrido, y de tres metros eso
      // no se lee como "coger algo y guardárselo", se lee como un tic. Lo que
      // hace entender un gesto es dónde se PARA, no por dónde pasa.
      const [e0, e1, s0, s1, b0, b1] = paso.tramos;
      let estirado = paso.sinEstante ? 0 : tramo(t, e0, e1) - tramo(t, s0, s1);
      // Si lo devuelve, al soltar la pose la mano vuelve a la balda y baja
      // desde ahí, no desde la cara.
      if (paso.devuelve) estirado += tramo(t, b0, b1) - tramo(t, paso.devuelve[0], paso.devuelve[1]);
      const alPecho = tramo(t, s0, s1) - tramo(t, b0, b1);
      const reposo = Math.max(0, 1 - estirado - alPecho);

      const hombro = esq.hombros[brazoLibre];
      const lado = brazoLibre === 0 ? -1 : 1;
      // Reposo, brazo estirado al estante y mano metida en la prenda.
      //
      // ─── EL CODO SALE DEL CUERPO ────────────────────────────────────────
      //
      // Es el número que hace que la segunda mitad del gesto se entienda. Con
      // el codo pegado al costado —como estuvo— llevarse la mano al pecho no
      // cambia la silueta: desde tres metros, un brazo doblado contra el
      // cuerpo y un brazo caído son la misma mancha, y lo único que se leía
      // era la primera mitad, la de coger algo del estante.
      //
      // Con el codo separado casi medio radián, entre el brazo y el costado
      // queda un hueco que se ve de lejos, y la postura pasa a ser la de
      // alguien que se está metiendo algo por dentro de la chaqueta — que es
      // exactamente lo que hay que poder contar sin leer el panel.
      //
      // ─── Y EN EL GESTO HONESTO VA AL REVÉS ──────────────────────────────
      //
      // Comprando, el codo NO se separa: el brazo cruza por delante y baja al
      // canasto, que cuelga del otro lado a la altura de la cadera. Esa es
      // toda la diferencia entre las dos animaciones, y es a propósito que sea
      // tan poca: el jugador no tiene que distinguir dos coreografías, tiene
      // que distinguir DÓNDE acaba la mano. Arriba y hacia dentro de la ropa,
      // o abajo y a la vista.
      const [poseX, poseZ, poseCodo, poseGiro = 0] = paso.pose;
      const objetivoX = reposo * hombro.rotation.x + estirado * -1.35 + alPecho * poseX;
      const objetivoZ = reposo * hombro.rotation.z + estirado * lado * 0.14 + alPecho * lado * poseZ;
      const objetivoCodo = reposo * esq.codos[brazoLibre].rotation.x + estirado * -0.28 + alPecho * poseCodo;

      hombro.rotation.x += (objetivoX - hombro.rotation.x) * peso;
      hombro.rotation.z += (objetivoZ - hombro.rotation.z) * peso;
      // El braceo no toca el giro del hombro, así que se escribe entero.
      hombro.rotation.y = lado * poseGiro * alPecho * peso;
      // Saludando, el brazo va de lado a lado mientras está arriba.
      if (paso.saluda) {
        hombro.rotation.z += Math.sin(relojGesto * Math.PI * 2 * 1.8) * paso.saluda * alPecho * peso;
      }
      esq.codos[brazoLibre].rotation.x += (objetivoCodo - esq.codos[brazoLibre].rotation.x) * peso;

      // EL TRONCO ACOMPAÑA AL BRAZO.
      //
      // Es lo que más se nota de lejos y lo que más barato sale. Un brazo
      // moviéndose a cuatro metros son unos píxeles; el cuerpo entero
      // inclinándose hacia el estante y volviendo a enderezarse se ve desde la
      // otra punta del pasillo, y es además lo que hace cualquiera al alcanzar
      // algo de una balda: nadie estira el brazo con la espalda quieta.
      // Estirándose se inclina hacia la balda; guardándoselo se encorva sobre
      // lo que se está metiendo dentro. Las dos veces el cuerpo entero se
      // mueve, y eso se ve desde la otra punta del pasillo.
      cuerpo.rotation.x += (0.22 * estirado + paso.encorva * alPecho) * peso;

      // Comprando, el canasto sale al encuentro de la mano: sube un poco
      // antes de que ella llegue y baja con ella. Sin esto la mano libre no
      // alcanza — el canasto cuelga del otro lado de la cadera, fuera de su
      // alcance — y el producto se apagaba en el aire.
      if (activo === "comprar" && carga && !cargaSuelta) {
        const b = carga.brazo;
        const ladoCanasto = b === 0 ? -1 : 1;
        const sube = tramo(t, s0 - 0.05, s1 - 0.05) - tramo(t, b0, b1);
        const [cx, cz, cc] = CANASTO_ARRIBA;
        const hc = esq.hombros[b];
        hc.rotation.x += (cx - hc.rotation.x) * sube * peso;
        hc.rotation.z += (ladoCanasto * cz - hc.rotation.z) * sube * peso;
        esq.codos[b].rotation.x += (cc - esq.codos[b].rotation.x) * sube * peso;
      }
      // Y baja la vista a lo que hace con las manos, como cualquiera.
      inclinaGesto = (paso.inclina ?? 0.3) * alPecho * peso;

      // Mira a un lado y al otro ANTES de alargar la mano, que es el detalle
      // que convierte el gesto en lo que es: sin esa comprobación, coger algo
      // de un estante es hacer la compra.
      // Solo quien tiene algo que esconder. El que compra no comprueba si lo
      // están mirando, y ESA es la mitad del tell: el vistazo a los dos lados
      // del pasillo no lo hace nadie que vaya a pagar lo que coge.
      //
      // Y OTRA VEZ AL TERMINAR, más corto: comprueba si alguien lo vio. Es lo
      // que cierra el gesto de quien se ha guardado algo, y es lo que hace
      // que el remate se lea aunque el jugador llegue tarde a la primera
      // mitad.
      if (paso.vistazo && t > 0.02 && t < 0.17) {
        giroGesto = Math.sin(((t - 0.02) / 0.15) * Math.PI * 2) * 0.75 * peso;
      } else if (paso.vistazo && t > 0.78 && t < 0.88) {
        giroGesto = Math.sin(((t - 0.78) / 0.1) * Math.PI * 2) * 0.5 * peso;
      } else {
        giroGesto = 0;
      }

      // ─── CUÁNDO SE VE EL PRODUCTO ───────────────────────────────────────
      //
      // Aparece cuando la mano llega al estante y desaparece con la mano ya
      // metida en la prenda, no al bajar el brazo. Ese orden es todo: si se
      // apagara al final, lo que se ve es a alguien que coge algo y lo suelta;
      // apagándose contra el pecho, lo que se ve es dónde se quedó.
      // Lo que lleva en la mano: el teléfono con su gesto, y si no el
      // producto. El otro, apagado.
      const objeto = activo === "telefono" ? telefono : enLaMano;
      const otro = activo === "telefono" ? enLaMano : telefono;
      if (otro) otro.isVisible = false;
      const [p0, p1] = paso.producto ?? [2, 2];
      const seVe = t >= p0 && t <= p1;
      // Al apagarse en el canasto, aparece una compra más dentro. Es lo que
      // convierte el gesto en algo con consecuencia: el canasto se va llenando
      // a lo largo del turno, y el del hurto es el único que sigue vacío.
      if (enLaMano && enLaMano.isVisible && !seVe && gesto === "comprar" && compras.length > 0) {
        const siguiente = compras.find((m) => !m.isVisible);
        if (siguiente) siguiente.isVisible = true;
      }
      if (objeto) {
        objeto.isVisible = seVe;
      }
      if (enLaMano && objeto === enLaMano) {
        // ─── NO DESAPARECE EN LA MANO: ENTRA ─────────────────────────────
        //
        // Durante el tramo "entra" el producto se despega de la palma y
        // viaja hasta su sitio: se hunde en la parka o cae dentro del
        // canasto. Que se apagara en la mano obligaba al jugador a deducir
        // dónde había ido; así lo ve ir.
        enLaMano.position.copyFrom(palma);
        const va = seVe && paso.entra ? tramo(t, paso.entra[0], paso.entra[1]) : 0;
        const destino =
          activo === "comprar"
            ? carga && !cargaSuelta
              ? Vector3.TransformCoordinates(DENTRO_DEL_CANASTO, carga.nodo.getWorldMatrix())
              : null
            : Vector3.TransformCoordinates(
                new Vector3(lado * DENTRO_DE_LA_PRENDA.x, DENTRO_DE_LA_PRENDA.y - cuerpo.position.y, DENTRO_DE_LA_PRENDA.z),
                cuerpo.getWorldMatrix()
              );
        if (va > 0 && destino) {
          const codo = esq.codos[brazoLibre];
          const desde = Vector3.TransformCoordinates(palma, codo.getWorldMatrix());
          const aqui = Vector3.Lerp(desde, destino, va);
          enLaMano.position.copyFrom(
            Vector3.TransformCoordinates(aqui, codo.getWorldMatrix().clone().invert())
          );
        }
      }
    } else {
      giroGesto = 0;
      inclinaGesto = 0;
      if (enLaMano) enLaMano.isVisible = false;
      if (telefono) telefono.isVisible = false;
      esq.hombros[brazoLibre].rotation.y = 0;
    }

    // Lo que cuelga de la mano cuelga a plomo: se le descuenta lo que se
    // inclinan el tronco y el brazo. Rígido con el antebrazo, el canasto
    // cabecearía con cada paso como si estuviera pegado a la muñeca.
    if (carga && !cargaSuelta) {
      const b = carga.brazo;
      carga.nodo.rotation.x = -(cuerpo.rotation.x + esq.hombros[b].rotation.x + esq.codos[b].rotation.x);
      carga.nodo.rotation.z = -(cuerpo.rotation.z + esq.hombros[b].rotation.z);
    }

    // --- Altura de la cadera --------------------------------------------
    //
    // La que TIENE que tener para que el punto más bajo de los zapatos apoye
    // justo en el suelo. Con el piso pulido del hall, un pie hundido se ve dos
    // veces: dentro de la baldosa y en el reflejo.
    const caida = (i: number): number => {
      const m = esq.caderas[i].rotation.x + cuerpo.rotation.x;
      const p = m + esq.rodillas[i].rotation.x;
      const q = p + esq.tobillos[i].rotation.x;
      const yTobillo = -MEDIDAS.muslo * Math.cos(m) - MEDIDAS.canilla * Math.cos(p);
      const suela = (z: number): number => yTobillo - MEDIDAS.tobillo * Math.cos(q) - z * Math.sin(q);
      return -Math.min(suela(MEDIDAS.punta), suela(MEDIDAS.talon));
    };
    const respirar = Math.sin(reloj * 1.1) * 0.005 * (1 - amplitud);
    cuerpo.position.y = Math.max(caida(0), caida(1)) + respirar;

    // --- Cabeza ---------------------------------------------------------
    //
    // Caminando compensa el balanceo del tronco: la mirada de quien camina va
    // bastante más quieta que el cuerpo. Plantado delante de alguien, baja o
    // sube la cabeza hacia sus ojos.
    let objetivo = 0;
    if (mirada) {
      // Altura de los ojos SOBRE EL MUNDO, no sobre los pies: el punto que
      // mira viene en coordenadas de la escena. En el hall daba lo mismo
      // porque allí se pisa el cero; el piso de la sala de ventas no lo es, y
      // sin sumarlo la figura calcula que el estante le queda más abajo de lo
      // que le queda y agacha la cabeza de más.
      const ojos = raiz.position.y + (cuerpo.position.y + MEDIDAS.cuello + 0.14) * escala;
      const distancia = Math.hypot(mirada.x - raiz.position.x, mirada.z - raiz.position.z);
      objetivo = Math.max(-0.25, Math.min(0.32, Math.atan2(ojos - mirada.y, Math.max(0.3, distancia))));
    }
    cabeceo += (objetivo * (1 - amplitud) - cabeceo) * Math.min(1, dt * 3);
    cabeza.rotation.y = -cuerpo.rotation.y * 0.75 + giroGesto;
    cabeza.rotation.x = -cuerpo.rotation.x * 0.6 + cabeceo + inclinaGesto + Math.sin(reloj * 0.9) * 0.008;
    cabeza.rotation.z = -cuerpo.rotation.z * 0.8;
  });

  raiz.scaling.setAll(escala);
  raiz.setEnabled(false);

  return {
    raiz,
    situar(punto, mirandoHacia) {
      raiz.position.copyFrom(punto);
      ruta = [];
      indiceRuta = 0;
      alLlegar = undefined;
      marcha = 0;
      mirada = null;
      if (mirandoHacia) {
        rumbo = Math.atan2(mirandoHacia.x - punto.x, mirandoHacia.z - punto.z);
        rumboDeseado = rumbo;
        raiz.rotation.y = rumbo;
      }
    },
    caminar(nuevaRuta, vel, aviso) {
      ruta = nuevaRuta.slice();
      indiceRuta = 0;
      velocidad = vel;
      alLlegar = aviso;
      mirada = null;
    },
    mirarHacia(punto) {
      girarHacia(punto.x - raiz.position.x, punto.z - raiz.position.z);
      // Un punto a ras de suelo es una dirección; uno con altura, unos ojos.
      mirada = punto.y > 0.2 ? punto.clone() : null;
    },
    congelar(quieta) {
      congelada = quieta;
    },
    quieta() {
      return indiceRuta >= ruta.length;
    },
    soltarCarga(punto) {
      if (!carga || cargaSuelta) return;
      cargaSuelta = true;
      carga.nodo.parent = null;
      // Fuera de la figura pierde su escala: se le devuelve a mano. Y se
      // apoya por el fondo, que está 43 cm por debajo del asa.
      carga.nodo.scaling.setAll(escala);
      carga.nodo.position.set(punto.x, punto.y + 0.43 * escala, punto.z);
      carga.nodo.rotation.set(0, rumbo, 0);
    },
    recogerCarga() {
      if (!carga || !cargaSuelta || !cargaEnMano) return;
      cargaSuelta = false;
      carga.nodo.parent = cargaEnMano.padre;
      carga.nodo.scaling.setAll(1);
      carga.nodo.position.copyFrom(cargaEnMano.posicion);
      carga.nodo.rotation.set(0, 0, 0);
    },
    cargaEnElSuelo() {
      if (!carga || !cargaSuelta) return null;
      return carga.nodo.position.clone();
    },
    remateALaVista() {
      const c = COREOGRAFIA[gesto ?? "guardar"];
      return (
        gesto !== null && pesoUltimo > 0.6 && faseUltima >= c.remate[0] && faseUltima <= c.remate[1]
      );
    },
    gestoALaVista() {
      // Desde que la mano arranca hasta que termina de sostener lo cogido.
      // Cada gesto tiene su tramo. Y con peso: caminando no vale, porque
      // caminando el gesto no se hace.
      const c = COREOGRAFIA[gesto ?? "guardar"];
      return gesto !== null && pesoUltimo > 0.6 && faseUltima >= c.visible[0] && faseUltima <= c.visible[1];
    },
    gesticular(nuevo) {
      if (nuevo === gesto) return;
      gesto = nuevo;
      // El ciclo arranca de cero al ponerlo: quien llegue justo cuando empieza
      // ve el gesto entero desde el principio, y no por la mitad.
      if (nuevo !== null) relojGesto = 0;
    },
    visible(v) {
      raiz.setEnabled(v);
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      // Si estaba en el suelo ya no cuelga de la figura, y raiz.dispose no lo
      // alcanzaría.
      if (carga && cargaSuelta) carga.nodo.dispose();
      // Los materiales son de esta figura y se van con ella. Las texturas no:
      // la de la tela es una sola para todas (ver texturaTela).
      const materiales = new Set(piezas.map((m) => m.material).filter((m): m is Material => m !== null));
      piezas.forEach((m) => m.dispose());
      materiales.forEach((m) => m.dispose(false, false));
      raiz.dispose();
    },
  };
}
