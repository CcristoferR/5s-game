import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  VertexBuffer,
  ReflectionProbe,
  type AbstractMesh,
  type Node,
} from "@babylonjs/core";
import { materialLiso, bloque, fundir, choque } from "./UtileriaBodega";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import type { Productos, TipoProducto } from "./ProductosSupermercado";
import { materialDePrecios, tarjetaPrecio } from "./GraficaSupermercado";

// ===========================================================================
// Los refrigerados
// ===========================================================================
//
// Tres armarios de puertas de vidrio contra el muro ciego de la izquierda, con
// sus leches y sus bebidas dentro, su luz fría y su copete.
//
// ─── POR QUÉ AHÍ ──────────────────────────────────────────────────────────
//
// Porque es el único paño grande del local que no tiene nada. Medido con
// rayos sobre el modelo: la fachada es muro macizo desde el rincón izquierdo
// (X −9,96) hasta X −3,6, donde recién empieza la vidriera, y sube cuatro
// metros. Desde la entrada, mirando a la izquierda, se ve una pared gris de
// seis metros de ancho y nada delante: es lo primero que se nota al entrar y
// es lo que hace que la sala parezca una maqueta a medio montar.
//
// Y es donde van de verdad. El frío se pone contra un muro —no en medio de la
// sala— por las máquinas y por el tendido, y en los locales chicos suele ir
// junto a la entrada.
//
// ─── POR QUÉ NO QUITA SITIO PARA CAMINAR ──────────────────────────────────
//
// Porque ocupa ochenta centímetros de un espacio libre de cuatro metros y
// medio: la franja de la entrada va de Z 2,55 (la espalda de la fila
// delantera de góndolas) a Z 7,11 (la fachada). Con los armarios puestos
// quedan 3,7 m de paso, más que cualquier pasillo del local, que tiene 1,82.
//
// Y ninguno de los ocho recorridos de los clientes llega hasta ahí: el que
// más se acerca se para en Z 4,4 y mirando al otro lado. Aun así el mueble
// entra en la tabla de MUEBLES de ZonasSupermercado, que es lo que consultan
// las figuras antes de dar un paso: quien camine por ahí —el retenido, que va
// donde el jugador lo lleve— lo rodea en vez de atravesarlo.
//
// ─── Y POR QUÉ ES TODO MALLAS FUNDIDAS ────────────────────────────────────
//
// Porque son sesenta y tantas piezas entre chapas, estantes, marcos y
// productos, y sueltas serían sesenta y tantas llamadas de dibujo — que
// además se pagan dos veces, porque el suelo pulido las refleja. Fundidas por
// material, el mueble entero cuesta ocho.

/**
 * La cara interior de la fachada, medida con un rayo sobre el modelo ya
 * cargado. Es la misma que usa FachadaSupermercado para el muro bajo las
 * vidrieras.
 */
const MURO_Z = 7.112;
/** Lo que sobresale el mueble del muro. Un armario de frío mide 0,75-0,85. */
const FONDO = 0.8;
const FRENTE_Z = MURO_Z - FONDO;
/** Una puerta de armario de frío, con su marco. */
const ANCHO_MODULO = 1.2;
/**
 * Cuatro puertas: 4,80 m de los 6,36 que mide el paño ciego.
 *
 * Con tres se veía lo que se quería evitar: desde la puerta el mueble quedaba
 * metido en el rincón y el muro seguía siendo un paño gris de cuatro metros
 * con una cajita al fondo. Con cuatro, el frío ocupa el paño y lo que queda
 * libre —metro y medio hasta donde empieza la vidriera— se lee como el
 * remate normal de una instalación, no como un hueco.
 */
const MODULOS = 4;
/** Pegado al rincón, con la junta de dilatación que deja cualquier montaje. */
const IZQUIERDA_X = -9.88;
const DERECHA_X = IZQUIERDA_X + ANCHO_MODULO * MODULOS;
/** El zócalo va retranqueado: es donde se meten los pies al abrir la puerta. */
const ALTO_ZOCALO = 0.13;
/** Del piso al copete. Un mural de frío de local chico mide dos metros justos. */
const ALTO_CUERPO = 1.98;
const ALTO_COPETE = 0.26;
const ESPESOR_COSTADO = 0.05;
const ESPESOR_TABIQUE = 0.06;

/**
 * La huella del mueble, para la tabla de muebles de la sala.
 *
 * Se exporta desde aquí y no se copia allá a mano: si el armario se mueve, se
 * mueve también lo que las figuras esquivan.
 */
export const ZONA_REFRIGERADOS = {
  minX: IZQUIERDA_X,
  maxX: DERECHA_X,
  minZ: FRENTE_Z,
  maxZ: MURO_Z,
} as const;

/**
 * Qué va en cada balda, de arriba abajo y de módulo en módulo.
 *
 * No es decoración al azar: las leches arriba, a la altura de la mano, y las
 * bebidas abajo, que es como se ordena un mural de frío —lo pesado abajo— y
 * de paso hace que las tres puertas no se vean iguales.
 */
const PLAN: readonly (readonly TipoProducto[])[] = [
  ["leche", "leche", "lata", "leche"],
  ["leche", "lata", "lata", "leche"],
  ["lata", "leche", "leche", "lata"],
  ["lata", "lata", "leche", "lata"],
];

/** Alturas de las baldas sobre el piso: la de abajo es el propio fondo. */
const BALDAS = [0.28, 0.68, 1.08, 1.48];

/**
 * Monta los armarios de frío contra el muro de la izquierda.
 *
 * @param piso       Altura del suelo de la sala. Ver medirPisoSala.
 * @param productos  Las plantillas sacadas de las góndolas. Lo que hay dentro
 *                   del armario es lo mismo que hay en los estantes del local:
 *                   la misma malla y la misma etiqueta.
 */
export function montarRefrigerados(scene: Scene, piso: number, productos: Productos): void {
  const mat = (nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial => {
    const m = materialLiso(scene, nombre, color, rugosidad, metalico);
    // Igual que el resto de la sala: entre el relleno, los seis focos y el sol
    // de la tarde se pasa del tope de cuatro luces por material, y las que
    // sobran no se calculan y no avisan. Ver ampliarLucesSupermercado.
    m.maxSimultaneousLights = 10;
    return m;
  };

  // ─── POR QUÉ CASI NADA ES METAL ───────────────────────────────────────
  //
  // Porque en esta escena no hay entorno que reflejar: la única sonda que se
  // monta mira al estacionamiento y se enchufa a los autos y al vidrio de la
  // fachada, no a toda la escena. Un material metálico sin entorno se dibuja
  // NEGRO —le pasó a las latas del modelo, y por eso se les quitó el metal—,
  // así que estas chapas van con poco metal y más albedo: la chapa pintada de
  // un mural de frío no espejea, y el aluminio del marco tampoco.
  const acero = mat("matRefriAcero", new Color3(0.62, 0.63, 0.65), 0.45, 0.25);
  const oscuro = mat("matRefriZocalo", new Color3(0.2, 0.21, 0.23), 0.55, 0.2);
  const aluminio = mat("matRefriAluminio", new Color3(0.78, 0.79, 0.8), 0.4, 0.35);
  // El interior, blanco y con un punto de emisión: un armario de frío por
  // dentro está lleno de luz rebotada, y sin esto el fondo se ve más oscuro
  // que la sala aunque tenga la regleta encendida justo encima.
  const blancoFrio = mat("matRefriInterior", new Color3(0.9, 0.92, 0.94), 0.5);
  blancoFrio.emissiveColor = new Color3(0.13, 0.145, 0.16);
  // La regleta: lo único que de verdad se ve encendido. No es una luz de la
  // escena —ya hay nueve y cada una se paga en todos los materiales—, es una
  // chapa que emite: a través del vidrio es exactamente lo mismo.
  const regleta = mat("matRefriRegleta", new Color3(0.96, 0.98, 1), 0.35);
  regleta.emissiveColor = new Color3(1.35, 1.45, 1.55);

  const piezasAcero: Mesh[] = [];
  const piezasOscuras: Mesh[] = [];
  const piezasBlancas: Mesh[] = [];
  const piezasAluminio: Mesh[] = [];
  const piezasRegleta: Mesh[] = [];
  const cristales: Mesh[] = [];

  const centroZ = (FRENTE_Z + MURO_Z) / 2;
  const anchoTotal = ANCHO_MODULO * MODULOS;
  const centroX = IZQUIERDA_X + anchoTotal / 2;
  const altoCaja = ALTO_CUERPO - ALTO_ZOCALO;
  const centroCajaY = piso + ALTO_ZOCALO + altoCaja / 2;

  // --- El armario ---------------------------------------------------------
  //
  // Dos costados, dos tabiques entre módulos y la tapa. El fondo va aparte,
  // en blanco, porque es lo que se ve por el vidrio.
  piezasAcero.push(
    bloque(scene, "refriCostado_izq", ESPESOR_COSTADO, altoCaja, FONDO, IZQUIERDA_X + ESPESOR_COSTADO / 2, centroCajaY, centroZ),
    bloque(scene, "refriCostado_der", ESPESOR_COSTADO, altoCaja, FONDO, DERECHA_X - ESPESOR_COSTADO / 2, centroCajaY, centroZ),
    bloque(scene, "refriTapa", anchoTotal, 0.07, FONDO, centroX, piso + ALTO_CUERPO - 0.035, centroZ)
  );
  for (let i = 1; i < MODULOS; i++) {
    piezasAcero.push(
      bloque(scene, `refriTabique_${i}`, ESPESOR_TABIQUE, altoCaja, FONDO, IZQUIERDA_X + i * ANCHO_MODULO, centroCajaY, centroZ)
    );
  }

  // El zócalo, retranqueado cuatro centímetros: es la sombra de debajo la que
  // hace que el mueble se vea apoyado y no dibujado sobre el piso.
  piezasOscuras.push(
    bloque(scene, "refriZocalo", anchoTotal - 0.02, ALTO_ZOCALO, FONDO - 0.04, centroX, piso + ALTO_ZOCALO / 2, centroZ + 0.02)
  );

  // El copete: la chapa de arriba, donde va el cartel.
  piezasOscuras.push(
    bloque(scene, "refriCopete", anchoTotal, ALTO_COPETE, FONDO, centroX, piso + ALTO_CUERPO + ALTO_COPETE / 2, centroZ)
  );

  // --- El fondo y las baldas ----------------------------------------------
  const fondoZ = MURO_Z - 0.025;
  piezasBlancas.push(
    bloque(scene, "refriFondo", anchoTotal - 0.1, altoCaja - 0.02, 0.04, centroX, centroCajaY, fondoZ)
  );
  const FONDO_BALDA = 0.6;
  const baldaZ = MURO_Z - 0.05 - FONDO_BALDA / 2;
  for (let m = 0; m < MODULOS; m++) {
    const x = IZQUIERDA_X + (m + 0.5) * ANCHO_MODULO;
    const ancho = ANCHO_MODULO - ESPESOR_TABIQUE - 0.02;
    BALDAS.forEach((alto, i) => {
      piezasBlancas.push(
        bloque(scene, `refriBalda_${m}_${i}`, ancho, 0.025, FONDO_BALDA, x, piso + alto, baldaZ)
      );
    });
    // La regleta de luz, escondida tras la ceja de la tapa.
    piezasRegleta.push(
      bloque(scene, `refriRegleta_${m}`, ancho - 0.08, 0.04, 0.07, x, piso + ALTO_CUERPO - 0.12, MURO_Z - 0.24)
    );
  }

  // --- Los precios --------------------------------------------------------
  //
  // Una tarjeta por balda, la misma que llevan las góndolas y con el precio
  // del mismo catálogo: la leche del mural vale lo que la leche del estante.
  // Ver GraficaSupermercado.
  const tarjetas: Mesh[] = [];
  for (let m = 0; m < MODULOS; m++) {
    const x = IZQUIERDA_X + (m + 0.5) * ANCHO_MODULO;
    BALDAS.forEach((alto, i) => {
      const tipo = PLAN[i][m];
      const tarjeta = tarjetaPrecio(
        scene,
        `refriPrecio_${m}_${i}`,
        // Las mismas claves del catálogo de la sala: así la leche del mural
        // vale lo que la leche de la góndola. Ver GraficaSupermercado.
        tipo === "lata" ? "Latas 03" : "Leches",
        x,
        piso + alto + 0.026,
        baldaZ - FONDO_BALDA / 2 - 0.004,
        0
      );
      if (tarjeta) tarjetas.push(tarjeta);
    });
  }

  // --- Los portaprecios (retirados) ---------------------------------------
  //
  // Lo que había aquí era una tira corrida con precios repetidos cada palmo.
  // De lejos pasaba; de cerca era una regla de medir, y encima decía cuatro
  // precios distintos para la misma leche. Ahora va la tarjeta de arriba.

  // --- Las puertas --------------------------------------------------------
  //
  // Marco de aluminio, cristal y tirador vertical. El cristal va tres
  // centímetros por dentro del frente del mueble, que es donde queda una
  // puerta cerrada.
  const vidrioZ = FRENTE_Z + 0.035;
  const huecoAbajo = piso + ALTO_ZOCALO + 0.03;
  const huecoArriba = piso + ALTO_CUERPO - 0.09;
  const PERFIL = 0.05;
  for (let m = 0; m < MODULOS; m++) {
    const x0 = IZQUIERDA_X + m * ANCHO_MODULO + 0.035;
    const x1 = IZQUIERDA_X + (m + 1) * ANCHO_MODULO - 0.035;
    const ancho = x1 - x0;
    const x = (x0 + x1) / 2;
    const alto = huecoArriba - huecoAbajo;
    const y = (huecoAbajo + huecoArriba) / 2;
    piezasAluminio.push(
      bloque(scene, `refriMarcoAb_${m}`, ancho, PERFIL, 0.055, x, huecoAbajo + PERFIL / 2, vidrioZ),
      bloque(scene, `refriMarcoAr_${m}`, ancho, PERFIL, 0.055, x, huecoArriba - PERFIL / 2, vidrioZ),
      bloque(scene, `refriMarcoIz_${m}`, PERFIL, alto, 0.055, x0 + PERFIL / 2, y, vidrioZ),
      bloque(scene, `refriMarcoDe_${m}`, PERFIL, alto, 0.055, x1 - PERFIL / 2, y, vidrioZ)
    );
    // El tirador: una barra vertical por fuera, con sus dos escuadras.
    const tiradorX = x1 - 0.1;
    const tirador = MeshBuilder.CreateCylinder(`refriTirador_${m}`, { height: alto * 0.62, diameter: 0.03, tessellation: 10 }, scene);
    tirador.position.set(tiradorX, y, vidrioZ - 0.075);
    piezasAluminio.push(tirador);
    [-1, 1].forEach((lado) => {
      piezasAluminio.push(
        bloque(scene, `refriEscuadra_${m}_${lado}`, 0.022, 0.022, 0.06, tiradorX, y + lado * alto * 0.31, vidrioZ - 0.045)
      );
    });
    cristales.push(
      bloque(scene, `refriCristal_${m}`, ancho - PERFIL * 2 + 0.01, alto - PERFIL * 2 + 0.01, 0.012, x, y, vidrioZ)
    );
  }

  // --- El cartel del copete -----------------------------------------------
  //
  // El verde de la marca, el mismo de los letreros de pasillo y del uniforme
  // de la cajera. Una sola palabra: el mueble ya dice lo que es.
  const cartel = materialPintadoNitido(scene, "matRefriCartel", 720, 52, 3, (ctx, w, h) => {
    ctx.fillStyle = "#2f6b2c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(0, h - 3, w, 3);
    ctx.fillStyle = "#f4f6f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(h * 0.52)}px system-ui, 'Segoe UI', sans-serif`;
    ctx.letterSpacing = "6px";
    ctx.fillText("REFRIGERADOS", w / 2, h * 0.5);
  });
  cartel.maxSimultaneousLights = 10;
  // Sin giro: un plano de Babylon mira hacia −Z, que es hacia la sala. Los
  // letreros de pasillo llevan el suyo girado media vuelta justo por eso.
  const rotulo = MeshBuilder.CreatePlane("refriCartel", { width: anchoTotal - 0.16, height: 0.145 }, scene);
  rotulo.material = cartel;
  rotulo.position.set(centroX, piso + ALTO_CUERPO + ALTO_COPETE * 0.52, FRENTE_Z - 0.004);
  rotulo.isPickable = false;
  rotulo.receiveShadows = true;
  rotulo.freezeWorldMatrix();

  // --- Lo que hay dentro --------------------------------------------------
  const porTipo = llenarBaldas(productos, piso, baldaZ, FONDO_BALDA);

  // --- Fundido y choque ---------------------------------------------------
  const vidrio = new PBRMaterial("matRefriVidrio", scene);
  // Casi incoloro y con el reflejo por encima del alfa, igual que el de la
  // fachada: un vidrio no tiene color propio, solo quita algo de luz.
  vidrio.albedoColor = new Color3(0.05, 0.06, 0.06);
  vidrio.alpha = 0.13;
  vidrio.metallic = 0;
  vidrio.roughness = 0.04;
  vidrio.indexOfRefraction = 1.52;
  vidrio.backFaceCulling = false;
  vidrio.twoSidedLighting = true;
  vidrio.useRadianceOverAlpha = true;
  vidrio.useSpecularOverAlpha = true;
  vidrio.environmentIntensity = 0.85;
  vidrio.maxSimultaneousLights = 10;

  const fundidas = [
    fundir(piezasAcero, "refrigeradosAcero", acero),
    fundir(piezasOscuras, "refrigeradosChapa", oscuro),
    fundir(piezasBlancas, "refrigeradosInterior", blancoFrio),
    fundir(piezasAluminio, "refrigeradosAluminio", aluminio),
    fundir(piezasRegleta, "refrigeradosRegleta", regleta),
    fundir(tarjetas, "refrigeradosPrecios", materialDePrecios(scene)),
    fundir(cristales, "refrigeradosVidrio", vidrio),
    ...porTipo,
  ];
  // Reciben sombra como todo lo de dentro: el sol de la tarde entra por las
  // vidrieras y el propio edificio le hace sombra a este rincón. Sin esto, la
  // luz del sol los alumbraría A TRAVÉS del muro.
  fundidas.forEach((m) => (m.receiveShadows = true));

  // Un solo volumen de choque para el mueble entero: tres armarios con sus
  // marcos serían treinta comprobaciones por cuadro para frenar en el mismo
  // sitio que una.
  choque(
    scene,
    "refrigerados_choque",
    IZQUIERDA_X,
    DERECHA_X,
    piso,
    piso + ALTO_CUERPO + ALTO_COPETE,
    // Cinco centímetros por delante del frente: es lo que sobresalen los
    // tiradores, y frenar justo en el cristal dejaría meter la cámara dentro
    // de ellos.
    FRENTE_Z - 0.05,
    MURO_Z
  );
}

/**
 * Enchufa el reflejo de la sala al vidrio de las puertas.
 *
 * ─── POR QUÉ HACE FALTA Y POR QUÉ VA APARTE ───────────────────────────────
 *
 * Un vidrio sin nada que reflejar no se ve: entre los marcos quedaba un hueco
 * y el armario parecía una estantería abierta con perfiles de aluminio. Lo que
 * dice "esto tiene puertas" es el reflejo de la sala corriendo por el cristal
 * cuando uno se mueve.
 *
 * Y va aparte del montaje porque una sonda fotografía LO QUE HAY cuando se
 * dispara: montada con el armario, retrataría una sala a medio construir —sin
 * fachada, sin luces y sin góndolas iluminadas—. Se llama al final, con el
 * nivel entero en pie.
 *
 * Se dispara UNA sola vez (refreshRate 0) y no vuelve a costar nada. Por eso
 * quedan fuera los que se mueven: una persona congelada dentro del cristal
 * durante todo el turno se lee como un fallo, y no reflejarla no se nota.
 */
export function reflejarRefrigerados(scene: Scene, piso: number): void {
  const vidrio = scene.getMaterialByName("matRefriVidrio");
  if (!(vidrio instanceof PBRMaterial)) return;

  const sonda = new ReflectionProbe("sondaRefrigerados", 128, scene);
  sonda.position = new Vector3((IZQUIERDA_X + DERECHA_X) / 2, piso + 1.15, FRENTE_Z - 0.9);
  scene.meshes.forEach((malla) => {
    if (!malla.isVisible || malla.getTotalVertices() === 0) return;
    if (malla.name.startsWith("refrigeradosVidrio")) return;
    if (seMueve(malla)) return;
    sonda.renderList!.push(malla);
  });
  sonda.refreshRate = 0;
  // Un cuadro después, igual que la sonda del exterior: enchufarla antes hace
  // que el material intente leerla mientras se está escribiendo.
  scene.onAfterRenderObservable.addOnce(() => {
    vidrio.reflectionTexture = sonda.cubeTexture;
  });
}

/** Si la malla cuelga de alguien que camina o de un carro que se empuja. */
function seMueve(malla: AbstractMesh): boolean {
  let nodo: Node | null = malla;
  while (nodo) {
    if (nodo.name.startsWith("figura_") || nodo.name.startsWith("carro")) return true;
    nodo = nodo.parent;
  }
  return false;
}

/**
 * Llena las baldas con productos de la góndola y los funde por clase.
 *
 * Las medidas de cada envase no se escriben a mano: se sacan de la propia
 * plantilla ya girada, porque las cajas vienen horneadas en diagonal (ver
 * ProductosSupermercado) y su caja envolvente no es la del envase.
 */
function llenarBaldas(
  productos: Productos,
  piso: number,
  baldaZ: number,
  fondoBalda: number
): Mesh[] {
  const copiasPorTipo = new Map<TipoProducto, Mesh[]>();

  BALDAS.forEach((alto, nivel) => {
    for (let m = 0; m < MODULOS; m++) {
      const tipo = PLAN[nivel][m];
      const plantilla = productos[tipo];
      if (!plantilla) continue;

      // El giro que pone la etiqueta de cara. Las cajas vienen horneadas en
      // diagonal (ver ProductosSupermercado) y además su cara impresa no es la
      // que uno diría: midiendo la varianza de color de la textura cara por
      // cara, la etiqueta de la leche cae a 135°, así que un octavo de vuelta
      // en más la deja mirando a la sala. La lata es un cilindro con la
      // etiqueta alrededor y no necesita nada.
      const giro = tipo === "lata" ? 0 : Math.PI / 4;
      const tam = medirGirado(plantilla, giro);
      if (!tam) continue;

      const anchoUtil = ANCHO_MODULO - ESPESOR_TABIQUE - 0.08;
      const pasoX = tam.x + 0.012;
      const columnas = Math.max(1, Math.floor(anchoUtil / pasoX));
      const pasoZ = tam.z + 0.01;
      const filas = Math.max(1, Math.min(3, Math.floor((fondoBalda - 0.06) / pasoZ)));
      const centroModulo = IZQUIERDA_X + (m + 0.5) * ANCHO_MODULO;
      const inicioX = centroModulo - ((columnas - 1) * pasoX) / 2;
      // El frente de la balda: los envases van alineados al borde, que es como
      // queda un estante repuesto, y las filas de atrás detrás.
      const frenteZ = baldaZ - fondoBalda / 2 + 0.04 + tam.z / 2;

      const lista = copiasPorTipo.get(tipo) ?? [];
      for (let c = 0; c < columnas; c++) {
        for (let f = 0; f < filas; f++) {
          // Algún hueco, siempre el mismo: una balda perfecta y llena hasta el
          // borde se lee como un patrón, no como un estante del que la gente
          // saca cosas. El hueco va por delante, que es de donde se saca.
          if (f === 0 && (c + nivel * 2 + m * 3) % 7 === 0) continue;
          const copia = plantilla.clone(`refriProducto_${nivel}_${m}_${c}_${f}`) as Mesh;
          copia.setEnabled(true);
          copia.isVisible = true;
          // Cada envase, un pelo torcido respecto del de al lado: repuestos a
          // mano nunca quedan en línea perfecta.
          const ruido = ((c * 7 + f * 13 + nivel * 5 + m * 3) % 11) / 11 - 0.5;
          copia.rotation.y = giro + ruido * 0.12;
          copia.position.set(
            inicioX + c * pasoX + ruido * 0.008,
            piso + alto + 0.0125 + tam.y / 2,
            frenteZ + f * pasoZ
          );
          lista.push(copia);
        }
      }
      copiasPorTipo.set(tipo, lista);
    }
  });

  const salida: Mesh[] = [];
  copiasPorTipo.forEach((copias, tipo) => {
    const original = productos[tipo]?.material;
    const fundida = Mesh.MergeMeshes(copias, true, true);
    if (!fundida) return;
    fundida.name = `refrigeradosProductos_${tipo}`;
    if (original instanceof PBRMaterial) {
      // ─── POR QUÉ NO SE REUSA EL MATERIAL DE LA GÓNDOLA ─────────────────
      //
      // Porque dentro del armario la luz es otra: la regleta está a treinta
      // centímetros y los focos de la sala no entran. Con el material de la
      // góndola, los envases de dentro salían más oscuros que los del
      // estante de enfrente, y un mural de frío se reconoce justo por lo
      // contrario: es lo único del local que se ve iluminado por dentro.
      //
      // La emisión va por textura y no por color plano: un color plano le
      // suma luz igual al cartón que a la etiqueta y la borra. Con la propia
      // etiqueta de emisor, lo que se aclara es el dibujo.
      const propio = original.clone(`matRefri_${tipo}`);
      if (propio) {
        propio.emissiveTexture = propio.albedoTexture;
        propio.emissiveColor = new Color3(0.24, 0.25, 0.26);
        propio.maxSimultaneousLights = 10;
        fundida.material = propio;
      } else fundida.material = original;
    } else if (original) fundida.material = original;
    fundida.isPickable = false;
    fundida.freezeWorldMatrix();
    salida.push(fundida);
  });
  return salida;
}

/**
 * El tamaño real de un envase ya girado, medido sobre sus vértices.
 *
 * ─── POR QUÉ NO VALE SU CAJA ENVOLVENTE ───────────────────────────────────
 *
 * Porque las cajas del modelo vienen horneadas en diagonal (ver
 * ProductosSupermercado) y su caja envolvente es la del envase GIRADO: para
 * una leche de siete centímetros de ancho mide once. Y al girarla de vuelta,
 * Babylon no vuelve a mirar la geometría: rota esa caja de once y devuelve
 * dieciséis. Con ese número salían tres leches donde caben doce, separadas
 * como si faltara medio estante.
 */
function medirGirado(malla: Mesh, giro: number): Vector3 | null {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  if (!pos || pos.length < 9) return null;
  const cos = Math.cos(giro);
  const sen = Math.sin(giro);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    // El mismo giro que aplica Babylon en Y: +Z hacia +X.
    const x = pos[i] * cos + pos[i + 2] * sen;
    const z = -pos[i] * sen + pos[i + 2] * cos;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    if (pos[i + 1] < minY) minY = pos[i + 1];
    if (pos[i + 1] > maxY) maxY = pos[i + 1];
  }
  const tam = new Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  return tam.x < 0.01 || tam.z < 0.01 ? null : tam;
}
