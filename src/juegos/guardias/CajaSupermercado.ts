import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, Vector3 } from "@babylonjs/core";
import { materialLiso, bloque, fundir, choque } from "./UtileriaBodega";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import { loft } from "./ModeladoFigura";
import type { Productos, TipoProducto } from "./ProductosSupermercado";

// ===========================================================================
// La línea de cajas
// ===========================================================================
//
// La cinta, la zona de embolsado, el pinpad y la pila de canastos.
//
// ─── POR QUÉ AQUÍ Y NO EN OTRO SITIO ──────────────────────────────────────
//
// Porque es donde el jugador se planta. En la caja ocurre una de las nueve
// situaciones del turno —la cajera que anula ventas y se guarda el dinero—, y
// para verla hay que quedarse mirando el mostrador un buen rato. Era la parte
// más pobre del local y la más mirada: una plancha negra, una registradora y
// nada más. Ni cinta, ni bolsas, ni por dónde entra la compra.
//
// ─── Y POR QUÉ TAN POCAS PIEZAS ───────────────────────────────────────────
//
// A propósito. Una caja de supermercado de verdad está llena de cosas
// —dispensador de bolsas, revistero, cargadores, papeles, el bote de basura—,
// y meter todo eso aquí sería cambiar "vacío" por "desordenado". Esto es un
// nivel didáctico: tiene que leerse limpio. Van cuatro piezas, las cuatro que
// hacen que un mostrador se lea como una caja, y cada una en su sitio de
// verdad.
//
// ─── DE DÓNDE SALEN LAS MEDIDAS ───────────────────────────────────────────
//
// De barrer el mostrador del modelo con rayos, de cinco en cinco centímetros.
// Resultó que la pieza ya trae el sitio para todo, y no se veía:
//
//   · Z 2,80 a 3,65 · X 8,15 a 8,80: un rebaje de trece milímetros en la tapa
//     —la bandeja de embolsado, al otro lado de la registradora.
//   · Z 3,70 a 4,50: la tapa plana, con la registradora encima (Z 3,99-4,40).
//   · Z 4,55 a 5,50 · X 8,15 a 9,30: una RAMPA que baja de 1,04 a 0,86. Es el
//     cajón de la cinta: el cliente deja la compra abajo, en el extremo que da
//     a la entrada, y la cinta la sube hasta la registradora.
//
// Todo lo de aquí se apoya en esas tres cotas; nada flota ni tapa nada.

/** La tapa del mostrador y su rebaje, medidos. */
const TAPA_Y = 1.066;
const REBAJE_Y = 1.053;
/** Los bordes del mueble, medidos con rayos. */
const ESTRECHO_X: [number, number] = [8.15, 8.8];
const ANCHO_X: [number, number] = [8.15, 9.3];

/** El rebaje de embolsado, al lado de la cajera. */
const EMBOLSADO_Z: [number, number] = [2.8, 3.65];

/** La rampa de la cinta y la recta que la describe: y = A + B·(z − Z0). */
const CINTA_Z: [number, number] = [4.55, 5.5];
const RAMPA_Z0 = 4.8;
const RAMPA_Y0 = 0.997;
const RAMPA_PENDIENTE = -0.1857;
/** Lo que se inclina la cinta, en radianes: diez grados y medio. */
const INCLINACION = Math.atan(-RAMPA_PENDIENTE);

/** Altura de la rampa en una Z cualquiera. */
const alturaRampa = (z: number): number => RAMPA_Y0 + RAMPA_PENDIENTE * (z - RAMPA_Z0);

/**
 * Monta la línea de cajas.
 *
 * @param piso  Altura del suelo de la sala. Ver medirPisoSala.
 */
export function montarLineaDeCajas(scene: Scene, piso: number, productos: Productos): void {
  const mat = (nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial => {
    const m = materialLiso(scene, nombre, color, rugosidad, metalico);
    m.maxSimultaneousLights = 10;
    return m;
  };

  // La goma de la cinta: negra pero no un agujero negro, y con algo de brillo
  // —una cinta de caja está pulida por el uso—.
  const goma = mat("matCintaCaja", new Color3(0.055, 0.058, 0.062), 0.5);
  // ─── POR QUÉ EL ACERO VA TAN OSCURO ───────────────────────────────────
  //
  // Porque en esta sala no hay entorno que reflejar, y un acero se ve por lo
  // que refleja, no por su color. Con el albedo alto que le pondría uno de
  // primeras (0,73) la bandeja de embolsado salía BLANCA —parecía una hoja de
  // papel puesta sobre el mostrador—. A 0,5 y con brillo, bajo la luz de la
  // sala se lee como la chapa que es.
  const acero = mat("matAceroCaja", new Color3(0.34, 0.35, 0.36), 0.28, 0.4);
  // Las guías y el rodillo sí van claros: son piezas chicas y de canto, y
  // contra la goma negra es su brillo lo que las dibuja.
  const aceroClaro = mat("matGuiaCaja", new Color3(0.68, 0.69, 0.7), 0.35, 0.3);
  const oscuro = mat("matPlasticoCaja", new Color3(0.13, 0.135, 0.14), 0.42);

  const piezasGoma: Mesh[] = [];
  const piezasAcero: Mesh[] = [];
  const piezasClaras: Mesh[] = [];
  const piezasOscuras: Mesh[] = [];

  // --- La cinta -----------------------------------------------------------
  //
  // Una banda de goma tumbada sobre la rampa, con sus dos guías de acero y el
  // rodillo del extremo de abajo, que es lo que delata que la cinta anda.
  const cintaDesdeZ = CINTA_Z[0] + 0.07;
  const cintaHastaZ = CINTA_Z[1] - 0.06;
  const cintaCentroZ = (cintaDesdeZ + cintaHastaZ) / 2;
  const cintaLargo = (cintaHastaZ - cintaDesdeZ) / Math.cos(INCLINACION);
  const cintaCentroY = alturaRampa(cintaCentroZ) + 0.008;
  const cintaAncho = ANCHO_X[1] - ANCHO_X[0] - 0.14;
  const cintaCentroX = (ANCHO_X[0] + ANCHO_X[1]) / 2;

  const banda = bloque(scene, "cintaCaja", cintaAncho, 0.014, cintaLargo, cintaCentroX, cintaCentroY, cintaCentroZ);
  banda.rotation.x = INCLINACION;
  piezasGoma.push(banda);

  // Las guías: dos perfiles a los lados, siguiendo la misma pendiente.
  [-1, 1].forEach((lado) => {
    const guia = bloque(
      scene,
      `guiaCinta_${lado}`,
      0.03,
      0.05,
      cintaLargo + 0.05,
      cintaCentroX + lado * (cintaAncho / 2 + 0.022),
      cintaCentroY + 0.014,
      cintaCentroZ
    );
    guia.rotation.x = INCLINACION;
    piezasClaras.push(guia);
  });

  // El rodillo de abajo, cruzado: media caña de acero asomando bajo la goma.
  const rodillo = MeshBuilder.CreateCylinder(
    "rodilloCinta",
    { height: cintaAncho + 0.04, diameter: 0.05, tessellation: 16 },
    scene
  );
  rodillo.rotation.z = Math.PI / 2;
  rodillo.position.set(cintaCentroX, alturaRampa(cintaHastaZ) + 0.003, cintaHastaZ);
  piezasClaras.push(rodillo);

  // El separador de compras, atravesado sobre la cinta.
  //
  // Va claro y no negro a propósito: uno negro sobre una cinta negra no se ve,
  // y el separador existe justamente para verse — es lo que el de atrás busca
  // con la vista para saber dónde acaba la compra del de delante.
  const separador = bloque(
    scene,
    "separadorCompras",
    cintaAncho - 0.06,
    0.034,
    0.045,
    cintaCentroX,
    alturaRampa(cintaCentroZ + 0.16) + 0.031,
    cintaCentroZ + 0.16
  );
  separador.rotation.x = INCLINACION;
  piezasClaras.push(separador);

  // --- La zona de embolsado -----------------------------------------------
  //
  // Una bandeja de acero metida en el rebaje que ya trae la tapa: al ras, sin
  // sobresalir, que es como está en un local.
  const bandejaZ = (EMBOLSADO_Z[0] + EMBOLSADO_Z[1]) / 2;
  const bandejaLargo = EMBOLSADO_Z[1] - EMBOLSADO_Z[0] - 0.16;
  const bandejaAncho = ESTRECHO_X[1] - ESTRECHO_X[0] - 0.14;
  const bandejaX = (ESTRECHO_X[0] + ESTRECHO_X[1]) / 2;
  piezasAcero.push(
    bloque(scene, "bandejaEmbolsado", bandejaAncho, 0.006, bandejaLargo, bandejaX, REBAJE_Y + 0.004, bandejaZ)
  );
  // Y su reborde, tres milímetros, para que la bandeja se lea como bandeja.
  [-1, 1].forEach((lado) => {
    piezasAcero.push(
      bloque(scene, `bordeBandeja_${lado}`, 0.012, 0.014, bandejaLargo, bandejaX + lado * (bandejaAncho / 2), REBAJE_Y + 0.008, bandejaZ)
    );
  });

  // Las bolsas, dobladas en un taco sobre la esquina de la bandeja. Un taco y
  // no bolsas colgando: colgando hay que modelar pliegues, y un pliegue mal
  // hecho ensucia más de lo que suma.
  const bolsas = materialPintadoNitido(scene, "matBolsasCaja", 200, 120, 3, (ctx, w, h) => {
    ctx.fillStyle = "#e9ebea";
    ctx.fillRect(0, 0, w, h);
    // Una banda verde y nada más: a quince centímetros de lado, un texto
    // impreso no se lee, solo ensucia.
    ctx.fillStyle = "#2f6b2c";
    ctx.fillRect(0, h * 0.44, w, h * 0.13);
    // Los dobleces del taco, que es lo que lo hace un taco de bolsas y no un
    // ladrillo blanco.
    ctx.strokeStyle = "rgba(146,154,148,0.55)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 6);
      ctx.lineTo(w, (h * i) / 6);
      ctx.stroke();
    }
  });
  bolsas.maxSimultaneousLights = 10;
  const taco = bloque(scene, "tacoBolsas", 0.24, 0.022, 0.17, bandejaX + 0.08, REBAJE_Y + 0.017, EMBOLSADO_Z[0] + 0.16);
  taco.rotation.y = 0.08;
  taco.material = bolsas;
  taco.isPickable = false;
  taco.receiveShadows = true;
  taco.freezeWorldMatrix();

  // --- El pinpad ----------------------------------------------------------
  //
  // Del lado del cliente y girado hacia él: es lo que dice que ahí se paga.
  // El cuerpo va claro y no negro: sobre una tapa negra, un aparato negro de
  // diez centímetros es una mancha. Claro se lee como lo que es desde el otro
  // lado del mostrador, que es desde donde se mira.
  const teclado = materialPintadoNitido(scene, "matPinpadCaja", 120, 160, 4, (ctx, w, h) => {
    ctx.fillStyle = "#c9ced1";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#9aa1a5";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    // La pantallita.
    ctx.fillStyle = "#26352d";
    ctx.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.27);
    ctx.fillStyle = "#8fe6b4";
    ctx.font = `700 ${Math.round(h * 0.08)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("$ 0", w * 0.82, h * 0.28);
    // Las teclas.
    for (let f = 0; f < 4; f++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = f === 3 ? (c === 0 ? "#b44a46" : c === 2 ? "#4d8b53" : "#8e979c") : "#8e979c";
        ctx.fillRect(w * (0.15 + c * 0.25), h * (0.43 + f * 0.135), w * 0.2, h * 0.105);
      }
    }
  });
  teclado.maxSimultaneousLights = 10;
  const pinpad = bloque(scene, "pinpadCaja", 0.105, 0.022, 0.14, ESTRECHO_X[0] + 0.1, TAPA_Y + 0.014, 3.82);
  pinpad.rotation.z = 0.32;
  pinpad.material = teclado;
  pinpad.isPickable = false;
  pinpad.receiveShadows = true;
  pinpad.freezeWorldMatrix();
  // Su pie, para que no parezca pegado con cinta.
  piezasOscuras.push(bloque(scene, "pieDelPinpad", 0.07, 0.016, 0.09, ESTRECHO_X[0] + 0.1, TAPA_Y + 0.006, 3.82));

  fundir(piezasGoma, "cintaDeCaja", goma);
  fundir(piezasAcero, "aceroDeCaja", acero);
  fundir(piezasClaras, "guiasDeCaja", aceroClaro);
  fundir(piezasOscuras, "plasticoDeCaja", oscuro);

  // --- La compra de quien está pagando ------------------------------------
  //
  // Tres cosas sobre la cinta. Sin ellas la caja se lee cerrada: hay una
  // cajera, hay un cliente delante y la cinta está vacía, como si nadie
  // estuviera comprando nada. Son copias de los productos de la góndola, así
  // que es mercadería del propio local.
  compraEnLaCinta(productos, cintaCentroX, cintaCentroZ);

  // --- La pila de canastos ------------------------------------------------
  //
  // Al principio de la línea, contra el extremo del mostrador: es donde se
  // dejan al salir y de donde se cogen al entrar. Son los MISMOS canastos que
  // lleva la gente en la mano —mismo perfil y mismo rojo—, así que el jugador
  // los reconoce sin leer nada.
  pilaDeCanastos(scene, piso, (ZONA_CANASTOS.minX + ZONA_CANASTOS.maxX) / 2, (ZONA_CANASTOS.minZ + ZONA_CANASTOS.maxZ) / 2);
}

/**
 * La compra de quien está pagando, esperando sobre la cinta.
 *
 * Se clonan de las plantillas de la góndola (ver ProductosSupermercado) y se
 * funden por clase: toda la compra cuesta dos o tres dibujos.
 */
function compraEnLaCinta(productos: Productos, cx: number, cz: number): void {
  // De pie y no tumbados. Los envases del modelo están impresos por delante y
  // por detrás, y el resto de sus caras son lisas: tumbado, un cereal enseña
  // el costado y se lee como una tabla de color. La Z es relativa al centro de
  // la cinta.
  const compra: { tipo: TipoProducto; dx: number; dz: number; giro: number }[] = [
    { tipo: "leche", dx: -0.2, dz: -0.24, giro: Math.PI / 4 + 0.12 },
    { tipo: "cereal", dx: 0.16, dz: -0.1, giro: Math.PI / 4 - 0.2 },
    { tipo: "lata", dx: -0.02, dz: 0.0, giro: 0.3 },
    { tipo: "lata", dx: 0.11, dz: 0.07, giro: -0.2 },
  ];

  const porTipo = new Map<TipoProducto, Mesh[]>();
  compra.forEach(({ tipo, dx, dz, giro }, i) => {
    const plantilla = productos[tipo];
    if (!plantilla) return;
    const copia = plantilla.clone(`compraCinta_${tipo}_${i}`) as Mesh;
    copia.setEnabled(true);
    copia.isVisible = true;
    const caja = copia.getBoundingInfo().boundingBox.extendSize;
    const z = cz + dz;
    copia.position.set(cx + dx, alturaRampa(z) + 0.012 + caja.y, z);
    copia.rotation.set(0, giro, 0);
    // Todo lo que está encima de la cinta comparte su inclinación: si no, los
    // envases quedan de pie sobre un plano inclinado, que es lo que delata a
    // un decorado.
    copia.rotation.x += INCLINACION;
    const lista = porTipo.get(tipo) ?? [];
    lista.push(copia);
    porTipo.set(tipo, lista);
  });

  porTipo.forEach((copias, tipo) => {
    const material = productos[tipo]?.material;
    const fundida = copias.length === 1 ? copias[0] : Mesh.MergeMeshes(copias, true, true);
    if (!fundida) return;
    fundida.name = `compraEnLaCinta_${tipo}`;
    if (material) fundida.material = material;
    fundida.isPickable = false;
    fundida.receiveShadows = true;
    fundida.freezeWorldMatrix();
  });
}

/**
 * La huella de la pila de canastos, para la tabla de muebles de la sala.
 *
 * Va con los demás muebles (ver ZonasSupermercado) porque está justo en el
 * camino que usa quien va a la oficina: sin esto, una figura la atravesaría.
 */
export const ZONA_CANASTOS = { minX: 8.6, maxX: 8.92, minZ: 5.58, maxZ: 6.04 } as const;

/** Cinco canastos encajados uno dentro de otro. */
function pilaDeCanastos(scene: Scene, piso: number, x: number, z: number): void {
  const plastico = materialLiso(scene, "matCanastoPila", new Color3(0.5, 0.045, 0.04), 0.42);
  plastico.maxSimultaneousLights = 10;
  plastico.backFaceCulling = false;
  plastico.twoSidedLighting = true;

  const CUANTOS = 5;
  // Encajados: cada uno sube seis centímetros, no los veintitrés que mide.
  const PASO = 0.062;
  const piezas: Mesh[] = [];
  for (let i = 0; i < CUANTOS; i++) {
    const canasto = loft(
      scene,
      `canastoPila_${i}`,
      [
        { y: 0, x: 0.082, delante: 0.15, forma: 5 },
        { y: 0.02, x: 0.088, delante: 0.162, forma: 5 },
        { y: 0.21, x: 0.1, delante: 0.184, forma: 5 },
        { y: 0.23, x: 0.106, delante: 0.192, forma: 5 },
      ],
      { lados: 24, tapaAbajo: true }
    );
    canasto.position.set(x, piso + 0.004 + i * PASO, z);
    // Ninguno cae recto sobre el anterior: apilados a mano nunca quedan
    // alineados, y ese medio grado es lo que hace que la pila no parezca una
    // sola pieza estirada.
    canasto.rotation.y = (i % 2 === 0 ? 1 : -1) * (0.03 + i * 0.012);
    piezas.push(canasto);
  }

  // Las asas, solo en el de arriba.
  //
  // Son lo que convierte la pila en canastos: sin ellas, cinco cestas
  // encajadas se leen de lejos como un cubo de basura rojo. Y solo en el de
  // arriba porque es el único cuyas asas se ven: las de los de abajo quedan
  // dentro del siguiente, que es lo que pasa al apilarlos de verdad.
  const arriba = piso + 0.004 + (CUANTOS - 1) * PASO;
  [-1, 1].forEach((s) => {
    const camino = [
      new Vector3(x + s * 0.1, arriba + 0.03, z - 0.11),
      new Vector3(x + s * 0.062, arriba + 0.16, z - 0.08),
      new Vector3(x + s * 0.014, arriba + 0.222, z - 0.04),
      new Vector3(x + s * 0.014, arriba + 0.222, z + 0.04),
      new Vector3(x + s * 0.062, arriba + 0.16, z + 0.08),
      new Vector3(x + s * 0.1, arriba + 0.03, z + 0.11),
    ];
    piezas.push(
      MeshBuilder.CreateTube(
        `asaCanastoPila_${s}`,
        { path: camino, radius: 0.0065, tessellation: 8, cap: Mesh.CAP_ALL },
        scene
      )
    );
  });

  fundir(piezas, "pilaDeCanastos", plastico);

  // Choca como cualquier mueble, con su volumen y no canasto a canasto.
  choque(
    scene,
    "pilaCanastos_choque",
    x - 0.14,
    x + 0.14,
    piso,
    piso + 0.23 + (CUANTOS - 1) * PASO,
    z - 0.23,
    z + 0.23
  );
}
