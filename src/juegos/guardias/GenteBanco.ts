import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  DynamicTexture,
  type Observer,
} from "@babylonjs/core";
import { crearFigura, type Figura, type PaletaFigura } from "./Figura";
import { montarPuertaBanco, type PuertaBanco } from "./PuertaBanco";
import { montarPantallaTurnos, type PantallaTurnos } from "./PantallaTurnosBanco";

// ===========================================================================
// La gente del banco: una mañana cualquiera
// ===========================================================================
//
// Tres cajeros atendiendo —la cuarta caja está cerrada, como casi siempre—,
// un cliente en cada caja abierta, tres en la fila y cuatro sentados
// esperando. Mientras corre la mañana, cada uno hace lo suyo: los atendidos
// terminan y se van, la pantalla llama al siguiente con su tin-tón, la fila
// avanza un puesto, entra gente por la puerta. Nada de eso pide nada al
// jugador. Es el fondo contra el que se va a ver lo que no es normal.
//
// ─── EL GUION ES FIJO ────────────────────────────────────────────────────
//
// Cada cosa pasa en su segundo, siempre el mismo, contado desde que empieza el
// turno y solo mientras el turno corre (la pausa lo detiene). No hay azar: lo
// que venga después en este nivel va a preguntar por lo que se vio, y lo que
// se vio tiene que ser lo mismo en todas las partidas.
//
// ─── LAS MEDIDAS ─────────────────────────────────────────────────────────
//
// Todas salen del modelo a escala 3, medidas con rayos: el eje de cada caja
// por su placa numerada, las sillas de oficina, las tres filas de asientos a
// cada lado, los postes de la fila y la puerta. El piso del hall está en 0,70
// y la explanada de fuera en 0,46.

/** El eje de cada caja, por su placa, y su silla. */
const CAJAS = [
  { placa: -3.15, silla: -3.18 },
  { placa: -1.15, silla: -1.05 },
  { placa: 1.09, silla: 1.05 },
  { placa: 3.07, silla: 3.18 },
] as const;
/** Donde se para quien atienden: a cuarenta centímetros del mesón. */
const Z_CLIENTE = 3.95;
/** La cadera del cajero: en la parte delantera del asiento, hacia el mesón. */
const Z_CAJERO = 5.25;
/** Alto del asiento de las sillas de oficina y de las de espera, sobre el piso. */
const ASIENTO_OFICINA = 0.531;
const ASIENTO_ESPERA = 0.448;
/** Alto de la cubierta del mesón sobre el piso. */
const MESON = 0.737;

/** El pasillo de la fila, entre los postes: su eje y los puestos, de la cabeza a la cola. */
const FILA_X = 0.73;
const FILA_Z = [1.6, 0.9, 0.2, -0.5] as const;

/** Las filas de asientos y dónde está cada asiento. */
const FILAS_ASIENTOS = [-1.43, 0.08, 1.58] as const;
const ASIENTOS_IZQ = [-2.34, -1.92, -1.5, -1.08, -0.66] as const;
const ASIENTOS_DER = [2.16, 2.58, 3.0, 3.42, 3.84] as const;

/** Los dos pasillos junto a los muros, entre los asientos y las ventanas. */
const PASILLO_IZQ = -3.4;
const PASILLO_DER = 4.75;
/** La calle entre las cajas y la fila, de un muro al otro. */
const Z_FRENTE_CAJAS = 2.7;

/** La puerta, por dentro y por fuera, y la vereda. */
const PUERTA_X = 0.667;
const Z_PUERTA_DENTRO = -3.45;
const Z_PUERTA_FUERA = -4.8;
const Z_VEREDA = -9.7;
/** Por dónde se llega y por dónde se va: la gente entra por la derecha y sale por la izquierda. */
const LEJOS_DER = 12.5;
const LEJOS_IZQ = -12;
/** Alto de la explanada de fuera. Ver alturaDelSuelo. */
const Y_FUERA = 0.458;

/** Paso de quien camina por un banco: sin prisa, pero tampoco paseando. */
const PASO = 1.1;

interface Persona {
  nombre: string;
  altura: number;
  paleta: PaletaFigura;
  telefono?: boolean;
}

// --- El reparto -------------------------------------------------------------
//
// Ropa de calle de una mañana de invierno en el centro, variada y reconocible:
// quien espera sentado y quien hace la fila tienen que poder distinguirse a
// diez metros por la silueta y el color. Ninguno lleva chaqueta oscura con
// gorro de lana negro: esa es ropa de otra historia.

const piel = {
  clara: new Color3(0.56, 0.41, 0.33),
  media: new Color3(0.47, 0.32, 0.24),
  morena: new Color3(0.38, 0.25, 0.18),
  oscura: new Color3(0.27, 0.17, 0.12),
};
const pelo = {
  negro: new Color3(0.05, 0.04, 0.035),
  castano: new Color3(0.16, 0.1, 0.06),
  canoso: new Color3(0.5, 0.48, 0.45),
  rubio: new Color3(0.42, 0.32, 0.18),
};

const CAJEROS: Persona[] = [
  {
    nombre: "cajera1",
    altura: 1.63,
    paleta: {
      uniforme: new Color3(0.84, 0.85, 0.86),
      pantalon: new Color3(0.08, 0.1, 0.17),
      piel: piel.media,
      detalle: new Color3(0.12, 0.2, 0.36),
      pelo: pelo.castano,
      peinado: "largo",
      prenda: "camisa",
      rasgos: { nariz: 0.85, mandibula: 1.15, ancho: 0.96 },
    },
  },
  {
    nombre: "cajero2",
    altura: 1.76,
    paleta: {
      uniforme: new Color3(0.1, 0.14, 0.24),
      pantalon: new Color3(0.07, 0.09, 0.15),
      piel: piel.clara,
      detalle: new Color3(0.86, 0.87, 0.88),
      pelo: pelo.negro,
      peinado: "corto",
      prenda: "chaqueta",
      rasgos: { nariz: 1.05, mandibula: 0.9, ancho: 1.02 },
    },
  },
  {
    nombre: "cajera3",
    altura: 1.6,
    paleta: {
      uniforme: new Color3(0.55, 0.68, 0.82),
      pantalon: new Color3(0.08, 0.1, 0.17),
      piel: piel.morena,
      detalle: new Color3(0.12, 0.2, 0.36),
      pelo: pelo.negro,
      peinado: "largo",
      prenda: "camisa",
      rasgos: { nariz: 0.9, mandibula: 1.1, ancho: 0.98 },
    },
  },
];

const CLIENTES: Record<string, Persona> = {
  // En las cajas al empezar.
  abrigoGris: {
    nombre: "abrigoGris",
    altura: 1.58,
    paleta: {
      uniforme: new Color3(0.36, 0.37, 0.39),
      pantalon: new Color3(0.1, 0.1, 0.12),
      piel: piel.clara,
      detalle: new Color3(0.5, 0.2, 0.22),
      pelo: pelo.canoso,
      peinado: "largo",
      prenda: "abrigo",
      accesorio: "bolso",
      zapato: new Color3(0.06, 0.04, 0.03),
      rasgos: { nariz: 0.9, mandibula: 1.12, ancho: 0.97 },
    },
  },
  parkaAzul: {
    nombre: "parkaAzul",
    altura: 1.8,
    paleta: {
      uniforme: new Color3(0.12, 0.22, 0.42),
      pantalon: new Color3(0.2, 0.2, 0.22),
      piel: piel.morena,
      detalle: new Color3(0.75, 0.75, 0.72),
      pelo: pelo.castano,
      prenda: "parka",
      accesorio: "mochila",
      zapato: new Color3(0.8, 0.8, 0.78),
      suela: new Color3(0.9, 0.9, 0.88),
      rasgos: { nariz: 1.0, mandibula: 1.0 },
    },
  },
  chaquetaCafe: {
    nombre: "chaquetaCafe",
    altura: 1.71,
    paleta: {
      uniforme: new Color3(0.33, 0.21, 0.12),
      pantalon: new Color3(0.15, 0.16, 0.2),
      piel: piel.media,
      detalle: new Color3(0.8, 0.76, 0.66),
      pelo: pelo.canoso,
      peinado: "rapado",
      prenda: "chaqueta",
      zapato: new Color3(0.12, 0.07, 0.04),
      rasgos: { nariz: 1.12, mandibula: 0.85, ancho: 1.04 },
    },
  },
  // En la fila.
  poleronOliva: {
    nombre: "poleronOliva",
    altura: 1.74,
    telefono: true,
    paleta: {
      uniforme: new Color3(0.3, 0.33, 0.18),
      pantalon: new Color3(0.13, 0.18, 0.32),
      piel: piel.oscura,
      detalle: new Color3(0.82, 0.82, 0.8),
      pelo: pelo.negro,
      peinado: "rapado",
      prenda: "poleron",
      zapato: new Color3(0.85, 0.85, 0.83),
      suela: new Color3(0.92, 0.92, 0.9),
      rasgos: { nariz: 1.05, mandibula: 0.95 },
    },
  },
  camisaBlanca: {
    nombre: "camisaBlanca",
    altura: 1.82,
    paleta: {
      uniforme: new Color3(0.85, 0.86, 0.87),
      pantalon: new Color3(0.22, 0.22, 0.24),
      piel: piel.clara,
      detalle: new Color3(0.22, 0.22, 0.24),
      pelo: pelo.rubio,
      prenda: "camisa",
      zapato: new Color3(0.04, 0.03, 0.03),
      rasgos: { nariz: 1.0, mandibula: 0.88, ancho: 1.01 },
    },
  },
  abrigoCamel: {
    nombre: "abrigoCamelBanco",
    altura: 1.62,
    paleta: {
      uniforme: new Color3(0.5, 0.36, 0.22),
      pantalon: new Color3(0.1, 0.1, 0.11),
      piel: piel.media,
      detalle: new Color3(0.3, 0.2, 0.12),
      pelo: pelo.castano,
      peinado: "largo",
      prenda: "abrigo",
      accesorio: "bolso",
      zapato: new Color3(0.08, 0.05, 0.035),
      rasgos: { nariz: 0.88, mandibula: 1.18, ancho: 0.95 },
    },
  },
  // Sentados.
  chaquetaRoja: {
    nombre: "chaquetaRojaBanco",
    altura: 1.66,
    telefono: true,
    paleta: {
      uniforme: new Color3(0.56, 0.13, 0.14),
      pantalon: new Color3(0.08, 0.08, 0.09),
      piel: piel.clara,
      detalle: new Color3(0.2, 0.2, 0.22),
      pelo: pelo.castano,
      peinado: "largo",
      prenda: "chaqueta",
      rasgos: { nariz: 0.82, mandibula: 1.15, ancho: 0.95 },
    },
  },
  camisaAzul: {
    nombre: "camisaAzul",
    altura: 1.77,
    paleta: {
      uniforme: new Color3(0.2, 0.3, 0.52),
      pantalon: new Color3(0.28, 0.26, 0.22),
      piel: piel.morena,
      detalle: new Color3(0.86, 0.86, 0.84),
      pelo: pelo.negro,
      prenda: "camisa",
      zapato: new Color3(0.12, 0.07, 0.04),
      rasgos: { nariz: 1.08, mandibula: 0.92, ancho: 1.02 },
    },
  },
  poleronGris: {
    nombre: "poleronGris",
    altura: 1.69,
    telefono: true,
    paleta: {
      uniforme: new Color3(0.52, 0.53, 0.55),
      pantalon: new Color3(0.12, 0.16, 0.28),
      piel: piel.media,
      detalle: new Color3(0.2, 0.2, 0.22),
      pelo: pelo.castano,
      prenda: "poleron",
      zapato: new Color3(0.2, 0.2, 0.22),
      rasgos: { nariz: 0.95, mandibula: 1.0 },
    },
  },
  parkaBeige: {
    nombre: "parkaBeige",
    altura: 1.6,
    paleta: {
      uniforme: new Color3(0.66, 0.6, 0.48),
      pantalon: new Color3(0.2, 0.18, 0.16),
      piel: piel.clara,
      detalle: new Color3(0.4, 0.35, 0.27),
      pelo: pelo.canoso,
      peinado: "largo",
      prenda: "parka",
      rasgos: { nariz: 0.9, mandibula: 1.1, ancho: 0.97 },
    },
  },
  // Los que llegan.
  chaquetaVerde: {
    nombre: "chaquetaVerdeBanco",
    altura: 1.78,
    paleta: {
      uniforme: new Color3(0.14, 0.3, 0.24),
      pantalon: new Color3(0.18, 0.18, 0.2),
      piel: piel.media,
      detalle: new Color3(0.42, 0.14, 0.1),
      pelo: pelo.castano,
      prenda: "chaqueta",
      accesorio: "mochila",
      zapato: new Color3(0.1, 0.06, 0.04),
      rasgos: { nariz: 1.05, mandibula: 0.9 },
    },
  },
  poleronBurdeo: {
    nombre: "poleronBurdeo",
    altura: 1.64,
    paleta: {
      uniforme: new Color3(0.36, 0.1, 0.14),
      pantalon: new Color3(0.14, 0.18, 0.3),
      piel: piel.morena,
      detalle: new Color3(0.8, 0.78, 0.74),
      pelo: pelo.negro,
      peinado: "largo",
      prenda: "poleron",
      zapato: new Color3(0.82, 0.82, 0.8),
      suela: new Color3(0.9, 0.9, 0.88),
      rasgos: { nariz: 0.86, mandibula: 1.12, ancho: 0.96 },
    },
  },
};

export interface GenteBanco {
  /** Todas las figuras, estén o no en escena. */
  figuras: Figura[];
  /** Arranca el guion de la mañana. Hasta entonces cada uno está en su sitio, quieto en lo suyo. */
  comenzar(): void;
  /** Clava a todos, la puerta y la pantalla como están, o los suelta. */
  congelar(quietos: boolean): void;
  dispose(): void;
}

/**
 * @param piso        Alto del piso del hall, medido.
 * @param mallaPuerta La puerta del modelo con su marco, para separarle la hoja.
 */
export function crearGenteBanco(scene: Scene, piso: number, mallaPuerta: Mesh | null): GenteBanco {
  const figuras: Figura[] = [];
  const crear = (p: Persona, fase: number): Figura => {
    const f = crearFigura(scene, `banco_${p.nombre}`, {
      paleta: p.paleta,
      altura: p.altura,
      fase,
      telefono: p.telefono,
    });
    figuras.push(f);
    return f;
  };
  const en = (x: number, z: number, y = piso): Vector3 => new Vector3(x, y, z);

  // --- Los cajeros --------------------------------------------------------
  //
  // Sentados de golpe en su silla, de cara al hall, con las manos en el
  // teclado. Ver `atenderCaja` para lo que hacen con la cabeza.
  const cajeros = CAJEROS.map((p, i) => {
    const f = crear(p, 3 + i * 1.7);
    const caja = CAJAS[i];
    const avance = f.avanceAlSentarse(ASIENTO_OFICINA);
    f.situar(en(caja.silla, Z_CAJERO - avance), en(caja.silla, Z_CAJERO - 5));
    f.visible(true);
    f.sentarse(ASIENTO_OFICINA, true);
    return f;
  });
  /** Las manos del cajero sobre el teclado: su izquierda queda hacia +X, porque mira a −Z. */
  const teclado = (i: number): [Vector3, Vector3] => {
    const x = CAJAS[i].silla;
    const y = piso + MESON + 0.016;
    return [en(x + 0.15, 4.97, y), en(x - 0.15, 4.97, y)];
  };
  cajeros.forEach((f, i) => f.apoyarManos(teclado(i), true));

  // --- Los clientes --------------------------------------------------------
  const c = CLIENTES;
  const figuraDe = new Map<string, Figura>();
  const persona = (p: Persona, fase: number): Figura => {
    const f = crear(p, fase);
    figuraDe.set(p.nombre, f);
    return f;
  };
  const enCaja = [persona(c.abrigoGris, 1.1), persona(c.parkaAzul, 2.3), persona(c.chaquetaCafe, 4.1)];
  const enFila = [persona(c.poleronOliva, 5.2), persona(c.camisaBlanca, 6.6), persona(c.abrigoCamel, 7.9)];
  const sentados = [
    { f: persona(c.chaquetaRoja, 0.4), x: ASIENTOS_DER[2], fila: 0 },
    { f: persona(c.camisaAzul, 2.9), x: ASIENTOS_DER[1], fila: 1 },
    { f: persona(c.poleronGris, 8.8), x: ASIENTOS_IZQ[3], fila: 0 },
    { f: persona(c.parkaBeige, 3.6), x: ASIENTOS_IZQ[2], fila: 2 },
  ];
  const llegan = [persona(c.chaquetaVerde, 9.4), persona(c.poleronBurdeo, 6.1)];
  /** Todos los que no son cajeros. */
  const clientes = [...figuraDe.values()];

  /**
   * Dónde se para para sentarse: delante del asiento lo que adelanta su muslo.
   * La cadera queda cuatro dedos por detrás del centro del asiento, hacia el
   * respaldo, que es como se sienta quien espera.
   */
  const paraSentarse = (f: Figura, x: number, fila: number): Vector3 =>
    en(x, FILAS_ASIENTOS[fila] - 0.04 + f.avanceAlSentarse(ASIENTO_ESPERA));

  enCaja.forEach((f, i) => {
    f.situar(en(CAJAS[i].placa, Z_CLIENTE), en(CAJAS[i].placa, Z_CLIENTE + 5));
    f.visible(true);
  });
  enFila.forEach((f, i) => {
    f.situar(en(FILA_X, FILA_Z[i]), en(FILA_X, FILA_Z[i] + 5));
    f.visible(true);
  });
  sentados.forEach(({ f, x, fila }) => {
    f.situar(paraSentarse(f, x, fila), en(x, 20));
    f.visible(true);
    f.sentarse(ASIENTO_ESPERA, true);
  });
  // Los que llegan esperan fuera, apagados, en la vereda de la derecha.
  llegan.forEach((f) => {
    f.situar(en(LEJOS_DER, Z_VEREDA, Y_FUERA), en(0, Z_VEREDA, Y_FUERA));
    f.visible(false);
  });

  // Los que miran el teléfono mientras esperan.
  sentados[0].f.gesticular("celular");
  sentados[2].f.gesticular("celular");
  enFila[0].gesticular("celular");

  // --- La puerta y la pantalla ------------------------------------------------
  const puerta: PuertaBanco | null = mallaPuerta
    ? montarPuertaBanco(scene, mallaPuerta, () =>
        figuras.filter((f) => f.raiz.isEnabled()).map((f) => f.raiz.position)
      )
    : null;
  let numero = 46;
  const turno = (n: number): string => `C-${String(n).padStart(3, "0")}`;
  const pantalla: PantallaTurnos = montarPantallaTurnos(scene, [
    { numero: turno(44), caja: 2 },
    { numero: turno(45), caja: 3 },
    { numero: turno(46), caja: 1 },
  ]);
  letreroCajaCerrada(scene, piso);
  rotularCajas(scene, placasDelModelo(scene));

  // --- Quién está en cada caja, y quién en la fila ----------------------------
  //
  // Lo que el guion va moviendo. `atendiendo[i]` es el cliente de la caja i
  // cuando ya llegó al mesón; mientras camina hacia ella es null y el cajero
  // lo espera mirándolo venir.
  const atendiendo: (Figura | null)[] = [enCaja[0], enCaja[1], enCaja[2]];
  const viniendo: (Figura | null)[] = [null, null, null];
  const fila: Figura[] = [...enFila];

  // --- Esperas del guion ------------------------------------------------------
  //
  // En tiempo del turno y no del reloj de la pared: con la pausa puesta no
  // corren, igual que no corre nada de la sala.
  const esperas: { t: number; hacer: () => void }[] = [];
  const despues = (segundos: number, hacer: () => void): void => {
    esperas.push({ t: tiempo + segundos, hacer });
  };

  // --- Rutas ------------------------------------------------------------------
  /** De su caja a la calle, por el pasillo de la izquierda y la puerta. Sale hacia la izquierda. */
  const salida = (i: number): Vector3[] => [
    en(CAJAS[i].placa, 3.2),
    en(PASILLO_IZQ, Z_FRENTE_CAJAS),
    en(PASILLO_IZQ, -2.55),
    en(0.3, -3.2),
    en(PUERTA_X, Z_PUERTA_DENTRO),
    en(PUERTA_X, Z_PUERTA_FUERA, Y_FUERA),
    en(PUERTA_X, -8.6, Y_FUERA),
    en(-3, Z_VEREDA, Y_FUERA),
    en(LEJOS_IZQ, Z_VEREDA, Y_FUERA),
  ];
  /** De la vereda de la derecha a dentro, por la puerta. */
  const entrada = (): Vector3[] => [
    en(3.5, Z_VEREDA, Y_FUERA),
    en(PUERTA_X, -8.6, Y_FUERA),
    en(PUERTA_X, Z_PUERTA_FUERA, Y_FUERA),
    en(PUERTA_X, Z_PUERTA_DENTRO),
  ];
  /** De la cabeza de la fila a la caja. */
  const deFilaACaja = (i: number): Vector3[] => [
    en(FILA_X, 2.5),
    en(CAJAS[i].placa, 3.3),
    en(CAJAS[i].placa, Z_CLIENTE),
  ];

  /** Deja a alguien de cara al mesón de su caja al llegar. */
  const llegaACaja = (f: Figura, i: number) => (): void => {
    f.mirarHacia(en(CAJAS[i].placa, Z_CLIENTE + 5));
    viniendo[i] = null;
    atendiendo[i] = f;
  };

  /** Se va: camina a la calle y, lejos, sale de escena. */
  const irse = (i: number): void => {
    const f = atendiendo[i];
    if (!f) return;
    atendiendo[i] = null;
    f.mirarA(null);
    f.caminar(salida(i), PASO, () => f.visible(false));
  };

  /** La pantalla llama al siguiente número a la caja i. */
  const llamar = (i: number): void => {
    numero += 1;
    pantalla.llamar({ numero: turno(numero), caja: i + 1 });
    miranPantalla = 3.2;
  };

  /** La cabeza de la fila va a la caja i, y el resto avanza un puesto, uno tras otro. */
  const pasaLaFila = (i: number): void => {
    const primero = fila.shift();
    if (!primero) return;
    primero.gesticular(null);
    viniendo[i] = primero;
    primero.caminar(deFilaACaja(i), PASO, llegaACaja(primero, i));
    fila.forEach((f, k) => {
      // Cada uno echa a andar un poco después del de delante, como pasa en
      // cualquier fila: nadie avanza hasta que se abre el hueco.
      despues(0.45 + k * 0.55, () =>
        f.caminar([en(FILA_X, FILA_Z[k])], 0.8, () => f.mirarHacia(en(FILA_X, 20)))
      );
    });
  };

  /** Se une a la cola de la fila. */
  const aLaFila = (f: Figura): void => {
    const k = fila.length;
    fila.push(f);
    f.visible(true);
    f.caminar([...entrada(), en(FILA_X, -2.4), en(FILA_X, FILA_Z[Math.min(k, FILA_Z.length - 1)])], PASO, () =>
      f.mirarHacia(en(FILA_X, 20))
    );
  };

  /**
   * Entra y se sienta en la primera fila de la derecha, en el asiento del
   * pasillo.
   *
   * Pasa por delante del guardia, a un metro, y sube por el pasillo de la
   * derecha: el de la izquierda es el de los que se van, y por ahí se habría
   * cruzado de frente con alguno.
   */
  const aSentarse = (f: Figura, x: number, filaAsiento: number): void => {
    f.visible(true);
    const destino = paraSentarse(f, x, filaAsiento);
    f.caminar(
      [...entrada(), en(1.6, -2.3), en(PASILLO_DER, -2.3), en(PASILLO_DER, destino.z), destino],
      PASO,
      () => {
        f.mirarHacia(en(x, 20));
        // Se da la vuelta y después se sienta: nadie se sienta girando.
        despues(0.65, () => f.sentarse(ASIENTO_ESPERA));
      }
    );
  };

  /**
   * Alguien que esperaba sentado a la derecha se levanta y va a la caja i por
   * el pasillo de ese lado. Si miraba el teléfono, primero lo guarda.
   */
  const deAsientoACaja = (f: Figura, filaAsiento: number, i: number): void => {
    const delante = FILAS_ASIENTOS[filaAsiento] - 0.04 + f.avanceAlSentarse(ASIENTO_ESPERA);
    viniendo[i] = f;
    f.gesticular(null);
    f.mirarA(null);
    f.caminar(
      [en(PASILLO_DER, delante), en(PASILLO_DER, Z_FRENTE_CAJAS), en(CAJAS[i].placa, 3.3), en(CAJAS[i].placa, Z_CLIENTE)],
      PASO,
      llegaACaja(f, i)
    );
  };

  // --- El guion ---------------------------------------------------------------
  //
  // En segundos desde que empieza el turno. La mañana tranquila dura lo que el
  // reloj tarda de las 9:00 a las 9:45: unos ciento doce segundos.
  //
  // Las entradas llegan por la derecha y las salidas se van por la izquierda,
  // y están puestas para no cruzarse en la puerta, en la vereda ni en los
  // pasillos: medido tramo a tramo, a 1,1 m/s, nadie ocupa el mismo trozo de
  // camino a la vez que otro que viene de frente.
  const guion: { t: number; hacer: () => void }[] = [
    { t: 12, hacer: () => irse(0) },
    { t: 14, hacer: () => { llamar(0); pasaLaFila(0); } },
    { t: 22, hacer: () => aLaFila(llegan[0]) },
    { t: 44, hacer: () => irse(1) },
    { t: 46, hacer: () => { llamar(1); pasaLaFila(1); } },
    { t: 56, hacer: () => aSentarse(llegan[1], ASIENTOS_DER[4], 0) },
    { t: 66, hacer: () => irse(0) },
    { t: 68, hacer: () => { llamar(0); pasaLaFila(0); } },
    { t: 78, hacer: () => irse(2) },
    { t: 80, hacer: () => { llamar(2); deAsientoACaja(sentados[1].f, sentados[1].fila, 2); } },
    { t: 100, hacer: () => irse(1) },
    // Este llamado es para la señora de rojo, que esperaba sentada mirando el
    // teléfono: así la fila no se vacía y queda gente de pie en el hall.
    { t: 102, hacer: () => { llamar(1); deAsientoACaja(sentados[0].f, sentados[0].fila, 1); } },
  ];
  let proximo = 0;

  // --- Cada cuadro --------------------------------------------------------------
  let tiempo = 0;
  let enMarcha = false;
  let quietos = false;
  let cerrado = false;
  /** Segundos que le quedan a la gente mirando la pantalla tras un llamado. */
  let miranPantalla = 0;
  /** El centro de la pantalla de turnos, adonde se mira tras un llamado. */
  const PANTALLA = new Vector3(0.65, 4.14, 5.76);

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (quietos || cerrado) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    if (enMarcha) {
      tiempo += dt;
      while (proximo < guion.length && guion[proximo].t <= tiempo) guion[proximo++].hacer();
      for (let k = esperas.length - 1; k >= 0; k--) {
        if (esperas[k].t > tiempo) continue;
        const [espera] = esperas.splice(k, 1);
        espera.hacer();
      }
    }
    miranPantalla = Math.max(0, miranPantalla - dt);

    // La altura del suelo de quien cruza la puerta: el hall está 24 cm por
    // encima de la explanada, y el umbral es el escalón.
    figuras.forEach((f) => {
      const p = f.raiz.position;
      if (!f.raiz.isEnabled()) return;
      const t = Math.min(1, Math.max(0, (p.z + 4.35) / 0.45));
      p.y = Y_FUERA + (piso - Y_FUERA) * t;
    });

    // Los cajeros: al cliente cuando lo tienen delante, al monitor el resto,
    // y tecleando mientras miran el monitor. Si viene alguien, lo miran venir.
    cajeros.forEach((f, i) => {
      const cliente = atendiendo[i];
      const quien = viniendo[i];
      const monitor = en(CAJAS[i].silla, 4.72, piso + 1.05);
      if (quien) {
        f.mirarA(quien.raiz.position.add(new Vector3(0, 1.55, 0)));
        f.apoyarManos(teclado(i), false);
        return;
      }
      if (!cliente) {
        f.mirarA(en(FILA_X, FILA_Z[0], piso + 1.5));
        f.apoyarManos(teclado(i), false);
        return;
      }
      // Tramos de unos segundos, distintos en cada caja: de cada diez, unos
      // cuatro mirando al cliente.
      const alCliente = Math.sin(tiempo * 0.55 + i * 2.1) + Math.sin(tiempo * 0.23 + i) * 0.6 > 0.45;
      if (alCliente) {
        f.mirarA(cliente.raiz.position.add(new Vector3(0, 1.5, 0)));
        f.apoyarManos(teclado(i), false);
      } else {
        f.mirarA(monitor);
        f.apoyarManos(teclado(i), true);
      }
    });

    // Los atendidos miran a su cajero, y de vez en cuando a otra parte.
    atendiendo.forEach((f, i) => {
      if (!f) return;
      const aOtraParte = Math.sin(tiempo * 0.31 + i * 1.7) > 0.8;
      f.mirarA(aOtraParte ? PANTALLA : en(CAJAS[i].silla, Z_CAJERO, piso + 1.1));
    });

    // Tras un llamado, quien espera levanta la vista a la pantalla: los que
    // están de pie en la fila y los sentados. Los del teléfono no: esos se
    // enteran tarde, como siempre (el gesto baja la cabeza por encima de esto).
    // Quien ya va camino de una caja no cuenta: mira a su cajero.
    const esperando = [...fila.filter((f) => f.quieta()), ...clientes.filter((f) => f.sentada())];
    esperando.forEach((f) => f.mirarA(miranPantalla > 0 ? PANTALLA : null));
  });

  return {
    figuras,
    comenzar() {
      enMarcha = true;
    },
    congelar(q) {
      quietos = q;
      figuras.forEach((f) => f.congelar(q));
      puerta?.congelar(q);
      pantalla.congelar(q);
    },
    dispose() {
      cerrado = true;
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      puerta?.dispose();
      pantalla.dispose();
      figuras.forEach((f) => f.dispose());
    },
  };
}

/**
 * Las placas del modelo con el número de cada caja: el fondo ("set18") y los
 * números en relieve que lleva delante ("aiStandardSurface3SG").
 */
function placasDelModelo(scene: Scene): Mesh[] {
  return scene.meshes.filter(
    (x): x is Mesh => x instanceof Mesh && (x.material?.name === "set18" || x.material?.name === "aiStandardSurface3SG")
  );
}

/**
 * Las placas de las cajas, sobre la viga del mesón.
 *
 * Las del modelo traen una textura café y gastada con el número pintado: sin
 * metal se ven marrones y con metal, oxidadas. Se tapan con unas nuevas del
 * mismo tamaño y en el mismo sitio —fondo grafito, "CAJA" arriba y el número
 * grande en blanco—, que es la señalética de una sucursal y se lee desde la
 * puerta.
 */
function rotularCajas(scene: Scene, placasModelo: Mesh[]): void {
  placasModelo.forEach((m) => (m.isVisible = false));
  CAJAS.forEach((caja, i) => {
    const tex = new DynamicTexture(`texPlacaCaja_${i}`, { width: 384, height: 256 }, scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#1f242b";
    ctx.fillRect(0, 0, 384, 256);
    ctx.fillStyle = "#16365f";
    ctx.fillRect(0, 0, 384, 14);
    ctx.fillStyle = "#aab4c2";
    ctx.font = "600 44px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CAJA", 192, 62);
    ctx.fillStyle = "#f2f4f7";
    ctx.font = "700 150px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.fillText(String(i + 1), 192, 168);
    tex.update(true);
    const mat = new PBRMaterial(`matPlacaCaja_${i}`, scene);
    mat.albedoTexture = tex;
    // El número algo encendido, como una placa retroiluminada: se lee desde
    // la puerta aunque la viga quede a contraluz de los paneles.
    mat.emissiveTexture = tex;
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mat.roughness = 0.5;
    mat.metallic = 0;
    const placa = MeshBuilder.CreatePlane(`placaCaja_${i}`, { width: 0.52, height: 0.35 }, scene);
    placa.position.set(caja.placa, 2.985, 4.636);
    placa.material = mat;
    placa.isPickable = false;
    placa.freezeWorldMatrix();
  });
}

/**
 * El cartel de la caja cerrada: un atril de acrílico sobre el mesón de la
 * caja 4. Es lo que explica que haya una caja sin nadie, y lo que se ve en
 * cualquier sucursal a media mañana.
 */
function letreroCajaCerrada(scene: Scene, piso: number): void {
  const tex = new DynamicTexture("texCajaCerrada", { width: 512, height: 192 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#f4f4f2";
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = "#16365f";
  ctx.fillRect(0, 0, 512, 22);
  ctx.fillStyle = "#1c1f24";
  ctx.font = "700 64px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CAJA CERRADA", 256, 96);
  ctx.fillStyle = "#5a6068";
  ctx.font = "500 30px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillText("Por favor, espere su turno", 256, 152);
  tex.update(true);

  const mat = new PBRMaterial("matCajaCerrada", scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.35;
  mat.metallic = 0;
  const cartel = MeshBuilder.CreatePlane("cartelCajaCerrada", { width: 0.42, height: 0.16 }, scene);
  // Sobre la cubierta, de cara al hall y algo inclinado hacia atrás, como un
  // atril: se lee de pie desde la fila.
  cartel.position.set(CAJAS[3].placa, piso + MESON + 0.09, 4.5);
  cartel.rotation.x = 0.28;
  cartel.material = mat;
  cartel.isPickable = false;
  // El pie del atril: una lámina de acrílico transparente por detrás.
  const pie = MeshBuilder.CreateBox("pieCajaCerrada", { width: 0.42, height: 0.004, depth: 0.12 }, scene);
  pie.position.set(CAJAS[3].placa, piso + MESON + 0.003, 4.54);
  const matPie = new StandardMaterial("matPieCajaCerrada", scene);
  matPie.diffuseColor = new Color3(0.8, 0.85, 0.88);
  matPie.alpha = 0.35;
  pie.material = matPie;
  pie.isPickable = false;
  [cartel, pie].forEach((m) => m.freezeWorldMatrix());
}
