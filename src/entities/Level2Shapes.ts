import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Matrix } from "@babylonjs/core";
import {
  crearEngrapadora as crearEngrapadoraComun,
  crearCarpeta as crearCarpetaComun,
  crearManual as crearManualComun,
} from "./ObjetosComunes";
import { texturaGrano, texturaMetalCepillado, normalMetalCepillado } from "./TexturasSuperficie";
import type { ObjetoNivel2 } from "../data/levelConfig";

// ---------------------------------------------------------------------------
// Objetos del Nivel 2 (Seiton — Ordenar)
// ---------------------------------------------------------------------------
//
// REGLA DE DISEÑO: cada objeto tiene que reconocerse SIN leer su nombre.
//
// El jugador decide dónde va cada herramienta según su uso, y para eso primero
// tiene que saber qué está agarrando. Si hay que pasar el cursor por encima
// para enterarse, la decisión deja de ser sobre criterio de ubicación y pasa a
// ser sobre leer etiquetas.
//
// Cada objeto se construye alrededor de UN RASGO que lo delata, el que uno
// dibujaría si tuviera que explicarlo con un garabato:
//
//   teléfono → el cable rulo y el auricular sobre la horquilla
//   llaves   → los dientes del paletón
//   tijeras  → los dos aros para los dedos y el tornillo del centro
//   lápices  → la punta de madera y la goma del otro extremo
//   manual   → la espiral
//
// Sin ese rasgo, todos terminan siendo cajas y cilindros de colores distintos.
// El resto del detalle solo suma cuando ese rasgo ya está.
//
// Todo se fusiona en UNA malla: el arrastre solo detecta la malla raíz, así que
// las piezas sueltas como hijas no se podrían agarrar.

export function crearFormaNivel2(scene: Scene, datos: ObjetoNivel2): Mesh {
  const mesh = construirForma(scene, datos);

  // Los exclusivos de este nivel se escalan; los compartidos ya vienen con la
  // medida correcta desde ObjetosComunes y volver a escalarlos los deformaría
  // respecto de su gemelo del Nivel 1.
  if (PROPIOS.has(datos.id)) {
    escalar(mesh, ESCALA_PROPIOS);
  }

  return apoyarSobreLaBase(mesh);
}

/**
 * Baja la geometría hasta que su punto más bajo quede en y = 0.
 *
 * Cada objeto se modela con las medidas que le quedan naturales, así que cada
 * uno termina con su origen en un lugar distinto. Al colocarlos todos a la
 * altura del banco, unos flotarían y otros se hundirían en el tablero.
 *
 * Normalizarlo acá, midiendo, evita ajustar siete posiciones a mano y que se
 * rompan de nuevo cada vez que se retoque un modelo. Es el mismo criterio que
 * ya usa el Nivel 1.
 */
function apoyarSobreLaBase(mesh: Mesh): Mesh {
  mesh.computeWorldMatrix(true);
  const minimo = mesh.getBoundingInfo().boundingBox.minimumWorld.y;

  if (Math.abs(minimo) < 0.0005) return mesh;

  mesh.bakeTransformIntoVertices(Matrix.Translation(0, -minimo, 0));
  mesh.refreshBoundingInfo();
  return mesh;
}

/**
 * Aplica la escala del nivel y la deja horneada en la geometría.
 *
 * Se hornea en vez de dejar `scaling` puesto porque el sistema de arrastre y
 * las siluetas del estante trabajan con las medidas reales de la malla: con un
 * scaling colgando, las comprobaciones de "cabe en esta repisa" usarían el
 * tamaño sin escalar y darían resultados equivocados.
 */
function escalar(mesh: Mesh, factor: number): Mesh {
  mesh.bakeTransformIntoVertices(Matrix.Scaling(factor, factor, factor));
  mesh.refreshBoundingInfo();
  return mesh;
}

/**
 * Escala de los objetos exclusivos del Nivel 2.
 *
 * Los compartidos con el Nivel 1 se construyen en ObjetosComunes.ts, ya con su
 * medida real multiplicada por el factor de juego. Los de acá se modelaron
 * antes y a ojo, y quedaron notoriamente más chicos: al ponerlos al lado de la
 * engrapadora se notaba que pertenecían a escalas distintas.
 *
 * Escalarlos al final es más seguro que reescribir cada medida a mano: no toca
 * la geometría, que ya estaba bien resuelta, y garantiza que el factor sea el
 * mismo para todos.
 */
const ESCALA_PROPIOS = 1.3;

/** Ids que se construyen acá y necesitan el ajuste de escala. */
const PROPIOS = new Set(["telefono", "taza_lapices", "llavero", "tijeras"]);

function construirForma(scene: Scene, datos: ObjetoNivel2): Mesh {
  switch (datos.id) {
    case "telefono":
      return crearTelefono(scene, datos.id);
    case "engrapadora2":
      // Misma construcción que en el Nivel 1: es el mismo objeto y el jugador
      // acaba de verlo. Antes cada nivel tenía la suya y la del 1 medía más del
      // doble que la del 2 — una diferencia imposible de no notar.
      return crearEngrapadoraComun(scene, datos.id);
    case "carpeta_activa2":
      return crearCarpetaComun(scene, datos.id, "PROYECTO ACTIVO");
    case "taza_lapices":
      return crearTazaLapices(scene, datos.id);
    case "llavero":
      return crearLlavero(scene, datos.id);
    case "tijeras":
      return crearTijeras(scene, datos.id);
    case "manual_referencia":
      // Mismo manual, otra portada: en el Nivel 2 es el de referencia rápida.
      return crearManualComun(scene, datos.id, "REFERENCIA");
    default: {
      const mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
      mesh.material = plastico(scene, `mat_${datos.id}`, new Color3(0.6, 0.6, 0.65));
      return mesh;
    }
  }
}

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------

/** Plástico mate: carcasas, cuerpos, mangos. */
function plastico(scene: Scene, nombre: string, color: Color3, rugosidad = 0.55): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = 0.05;
  mat.microSurfaceTexture = texturaGrano(scene, 0.1);
  return mat;
}

/** Metal cepillado: hojas, aros, tornillos, piezas cromadas. */
function metal(scene: Scene, nombre: string, color: Color3, rugosidad = 0.26): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = 0.85;
  mat.albedoTexture = texturaMetalCepillado(scene);
  mat.bumpTexture = normalMetalCepillado(scene);
  mat.invertNormalMapY = true;
  mat.microSurfaceTexture = texturaGrano(scene, 0.14);
  return mat;
}

/** Madera de lápiz. */
function madera(scene: Scene, nombre: string, color: Color3): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = 0.75;
  mat.metallic = 0;
  mat.microSurfaceTexture = texturaGrano(scene, 0.12);
  return mat;
}

function fusionar(partes: Mesh[], id: string): Mesh {
  const fusion = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  fusion.name = id;
  return fusion;
}

// ---------------------------------------------------------------------------
// Teléfono de oficina
// ---------------------------------------------------------------------------

function crearTelefono(scene: Scene, id: string): Mesh {
  const matCuerpo = plastico(scene, `matCuerpo_${id}`, new Color3(0.11, 0.11, 0.13), 0.5);
  const matTecla = plastico(scene, `matTecla_${id}`, new Color3(0.52, 0.53, 0.56), 0.45);
  const matCable = plastico(scene, `matCable_${id}`, new Color3(0.09, 0.09, 0.11), 0.6);
  const matPantalla = plastico(scene, `matPantalla_${id}`, new Color3(0.35, 0.45, 0.4), 0.2);

  const partes: Mesh[] = [];

  // Base inclinada hacia el usuario, como los teléfonos de escritorio reales.
  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.2, height: 0.045, depth: 0.22 }, scene);
  base.position.y = 0.022;
  base.material = matCuerpo;
  partes.push(base);

  // Teclado 3x4: es lo que separa un teléfono de una caja negra cualquiera.
  for (let fila = 0; fila < 4; fila++) {
    for (let col = 0; col < 3; col++) {
      const tecla = MeshBuilder.CreateBox(`tecla_${id}_${fila}_${col}`, { width: 0.028, height: 0.008, depth: 0.02 }, scene);
      tecla.position.set(-0.032 + col * 0.032, 0.048, -0.03 - fila * 0.028);
      tecla.material = matTecla;
      partes.push(tecla);
    }
  }

  const pantalla = MeshBuilder.CreateBox(`pantalla_${id}`, { width: 0.1, height: 0.006, depth: 0.03 }, scene);
  pantalla.position.set(-0.03, 0.048, 0.06);
  pantalla.material = matPantalla;
  partes.push(pantalla);

  // Horquilla: los dos apoyos donde descansa el auricular.
  [-1, 1].forEach((lado, i) => {
    const apoyo = MeshBuilder.CreateBox(`apoyo_${id}_${i}`, { width: 0.02, height: 0.018, depth: 0.03 }, scene);
    apoyo.position.set(0.072, 0.054, lado * 0.06);
    apoyo.material = matCuerpo;
    partes.push(apoyo);
  });

  // AURICULAR: el rasgo principal. Dos cápsulas gruesas en los extremos y un
  // puente más fino entre ellas — esa silueta de hueso es la que hace que se
  // lea como teléfono a la primera.
  const puente = MeshBuilder.CreateBox(`puente_${id}`, { width: 0.038, height: 0.026, depth: 0.13 }, scene);
  puente.position.set(0.072, 0.076, 0);
  puente.material = matCuerpo;
  partes.push(puente);

  [-1, 1].forEach((lado, i) => {
    const capsula = MeshBuilder.CreateCylinder(`capsula_${id}_${i}`, { diameter: 0.05, height: 0.032, tessellation: 18 }, scene);
    capsula.position.set(0.072, 0.079, lado * 0.072);
    capsula.material = matCuerpo;
    partes.push(capsula);
  });

  // CABLE RULO: el detalle que nadie confunde. Se arma con anillos apilados en
  // curva; sin él, el auricular podría ser cualquier pieza suelta.
  const VUELTAS = 9;
  for (let i = 0; i < VUELTAS; i++) {
    const t = i / (VUELTAS - 1);
    const rulo = MeshBuilder.CreateTorus(`rulo_${id}_${i}`, { diameter: 0.03, thickness: 0.005, tessellation: 12 }, scene);
    rulo.rotation.z = Math.PI / 2;
    // Baja del auricular hacia la base describiendo una curva.
    rulo.position.set(0.052 - t * 0.055, 0.062 - t * 0.028, -0.082 - t * 0.02);
    rulo.material = matCable;
    partes.push(rulo);
  }

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// Engrapadora
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Carpeta de proyecto
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Taza con lápices
// ---------------------------------------------------------------------------

function crearTazaLapices(scene: Scene, id: string): Mesh {
  const matTaza = plastico(scene, `matTaza_${id}`, new Color3(0.22, 0.42, 0.58), 0.35);
  const matMadera = madera(scene, `matMadera_${id}`, new Color3(0.82, 0.66, 0.42));
  const matMina = plastico(scene, `matMina_${id}`, new Color3(0.1, 0.09, 0.09), 0.7);
  const matVirola = metal(scene, `matVirola_${id}`, new Color3(0.72, 0.72, 0.74), 0.3);

  const partes: Mesh[] = [];

  const taza = MeshBuilder.CreateCylinder(`taza_${id}`, { diameterTop: 0.1, diameterBottom: 0.085, height: 0.12, tessellation: 24 }, scene);
  taza.position.y = 0.06;
  taza.material = matTaza;
  partes.push(taza);

  // Borde marcado: sin él la taza se ve como un cilindro macizo.
  const borde = MeshBuilder.CreateTorus(`borde_${id}`, { diameter: 0.1, thickness: 0.008, tessellation: 24 }, scene);
  borde.position.y = 0.12;
  borde.material = matTaza;
  partes.push(borde);

  // LÁPICES: cuerpo hexagonal, punta de madera con la mina asomando y goma con
  // su virola metálica del otro lado. Esos tres detalles son los que hacen que
  // se lean como lápices y no como palitos de colores.
  const lapices: Array<[number, number, number, Color3]> = [
    [-0.022, -0.4, 0.16, new Color3(0.85, 0.62, 0.12)],
    [0.018, 0.34, 0.175, new Color3(0.2, 0.35, 0.62)],
    [0.004, -0.12, 0.15, new Color3(0.68, 0.22, 0.2)],
    [-0.008, 0.5, 0.165, new Color3(0.35, 0.55, 0.32)],
  ];

  lapices.forEach(([dx, giro, largo, color], i) => {
    const matCuerpo = madera(scene, `matLapiz_${id}_${i}`, color);

    // Cuerpo de seis caras, como los lápices de verdad.
    const cuerpo = MeshBuilder.CreateCylinder(`lapiz_${id}_${i}`, { diameter: 0.011, height: largo, tessellation: 6 }, scene);
    cuerpo.position.set(dx, 0.1 + largo / 2 - 0.045, dx * 0.6);
    cuerpo.rotation.z = giro * 0.16;
    cuerpo.rotation.x = giro * 0.1;
    cuerpo.material = matCuerpo;
    partes.push(cuerpo);

    // Punta: cono de madera con la mina negra en el extremo.
    const punta = MeshBuilder.CreateCylinder(`punta_${id}_${i}`, { diameterTop: 0.002, diameterBottom: 0.011, height: 0.018, tessellation: 8 }, scene);
    const alturaPunta = 0.1 + largo - 0.045 + 0.009;
    punta.position.set(dx + giro * 0.028, alturaPunta, dx * 0.6 + giro * 0.018);
    punta.rotation.z = giro * 0.16;
    punta.rotation.x = giro * 0.1;
    punta.material = matMadera;
    partes.push(punta);

    const mina = MeshBuilder.CreateCylinder(`mina_${id}_${i}`, { diameterTop: 0.0015, diameterBottom: 0.003, height: 0.005, tessellation: 6 }, scene);
    mina.position.set(dx + giro * 0.032, alturaPunta + 0.011, dx * 0.6 + giro * 0.021);
    mina.rotation.z = giro * 0.16;
    mina.rotation.x = giro * 0.1;
    mina.material = matMina;
    partes.push(mina);

    // Virola de la goma, abajo: solo se ve en los que asoman poco, pero suma
    // cuando el jugador acerca la cámara.
    const virola = MeshBuilder.CreateCylinder(`virola_${id}_${i}`, { diameter: 0.012, height: 0.01, tessellation: 8 }, scene);
    virola.position.set(dx - giro * 0.01, 0.1 - 0.045 + 0.008, dx * 0.6 - giro * 0.006);
    virola.rotation.z = giro * 0.16;
    virola.material = matVirola;
    partes.push(virola);
  });

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// Llavero
// ---------------------------------------------------------------------------

function crearLlavero(scene: Scene, id: string): Mesh {
  const matAnillo = metal(scene, `matAnillo_${id}`, new Color3(0.66, 0.67, 0.7), 0.2);
  const matLlave = metal(scene, `matLlave_${id}`, new Color3(0.76, 0.71, 0.46), 0.3);

  const partes: Mesh[] = [];

  const GROSOR = 0.02;
  const anillo = MeshBuilder.CreateTorus(`anillo_${id}`, { diameter: 0.14, thickness: GROSOR, tessellation: 24 }, scene);
  anillo.position.y = GROSOR / 2;
  anillo.material = matAnillo;
  partes.push(anillo);

  const ALTO = 0.006;

  [-0.34, 0, 0.34].forEach((giro, i) => {
    const dirX = Math.sin(giro);
    const dirZ = Math.cos(giro);

    // Cabeza perforada: la anilla pasa por ahí. El agujero se insinúa con un
    // rebaje central en vez de un booleano, que sería mucho más costoso.
    const cabeza = MeshBuilder.CreateCylinder(`cabezaLlave_${id}_${i}`, { diameter: 0.036, height: ALTO, tessellation: 16 }, scene);
    cabeza.position.set(dirX * 0.055, ALTO / 2, dirZ * 0.03 + 0.02);
    cabeza.material = matLlave;
    partes.push(cabeza);

    const ojo = MeshBuilder.CreateTorus(`ojoLlave_${id}_${i}`, { diameter: 0.018, thickness: 0.004, tessellation: 12 }, scene);
    ojo.position.set(dirX * 0.055, ALTO + 0.001, dirZ * 0.03 + 0.02);
    ojo.material = matAnillo;
    partes.push(ojo);

    // Caña: la parte lisa entre la cabeza y los dientes.
    const cana = MeshBuilder.CreateBox(`canaLlave_${id}_${i}`, { width: 0.011, height: ALTO, depth: 0.075 }, scene);
    cana.position.set(dirX * 0.1, ALTO / 2, dirZ * 0.068 + 0.03);
    cana.rotation.y = giro;
    cana.material = matLlave;
    partes.push(cana);

    // DIENTES DEL PALETÓN: el rasgo decisivo.
    //
    // Sin ellos una llave es una tirita de metal con una cabeza redonda —
    // podría ser una espátula, una etiqueta o cualquier cosa. Con la silueta
    // dentada, se reconoce al instante y desde cualquier ángulo.
    const alturasDiente = [0.016, 0.009, 0.014, 0.007, 0.012];
    alturasDiente.forEach((anchoDiente, d) => {
      const diente = MeshBuilder.CreateBox(`diente_${id}_${i}_${d}`, { width: anchoDiente, height: ALTO, depth: 0.011 }, scene);
      const avance = 0.048 + d * 0.013;
      diente.position.set(
        dirX * (0.1 + avance * 0.55) + Math.cos(giro) * (anchoDiente / 2 - 0.004),
        ALTO / 2,
        dirZ * (0.068 + avance * 0.55) + 0.03 - Math.sin(giro) * (anchoDiente / 2 - 0.004)
      );
      diente.rotation.y = giro;
      diente.material = matLlave;
      partes.push(diente);
    });
  });

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// Tijeras
// ---------------------------------------------------------------------------

function crearTijeras(scene: Scene, id: string): Mesh {
  const matHoja = metal(scene, `matHoja_${id}`, new Color3(0.74, 0.75, 0.78), 0.18);
  const matMango = plastico(scene, `matMango_${id}`, new Color3(0.16, 0.16, 0.18), 0.45);
  const matTornillo = metal(scene, `matTornillo_${id}`, new Color3(0.5, 0.5, 0.53), 0.3);

  const partes: Mesh[] = [];
  const ALTO = 0.005;
  const APERTURA = 0.2;

  [-1, 1].forEach((lado, i) => {
    const giro = lado * APERTURA;

    // Hoja: se afina hacia la punta, como una hoja de tijera real.
    const hoja = MeshBuilder.CreateCylinder(
      `hoja_${id}_${i}`,
      { diameterTop: 0.006, diameterBottom: 0.017, height: 0.14, tessellation: 4 },
      scene
    );
    hoja.rotation.x = Math.PI / 2;
    hoja.rotation.z = giro;
    hoja.position.set(Math.sin(giro) * 0.07, ALTO, 0.07 * Math.cos(giro));
    hoja.scaling.y = 0.35;
    hoja.material = matHoja;
    partes.push(hoja);

    // Brazo del mango, desde el tornillo hacia atrás.
    const brazo = MeshBuilder.CreateBox(`brazo_${id}_${i}`, { width: 0.012, height: ALTO, depth: 0.075 }, scene);
    brazo.position.set(Math.sin(-giro) * 0.035, ALTO / 2, -0.037 * Math.cos(giro));
    brazo.rotation.y = -giro;
    brazo.material = matMango;
    partes.push(brazo);

    // AROS PARA LOS DEDOS: junto con el tornillo, son lo que hace que un par de
    // hojas cruzadas se lea como tijera y no como dos cuchillos apoyados.
    const aro = MeshBuilder.CreateTorus(`aro_${id}_${i}`, { diameter: 0.05, thickness: 0.011, tessellation: 20 }, scene);
    aro.rotation.x = Math.PI / 2;
    aro.rotation.z = -giro;
    aro.position.set(Math.sin(-giro) * 0.088, ALTO / 2, -0.095 * Math.cos(giro));
    aro.scaling.z = 0.42;
    aro.material = matMango;
    partes.push(aro);
  });

  // TORNILLO CENTRAL: el punto donde se cruzan. Va último y encima de todo.
  const tornillo = MeshBuilder.CreateCylinder(`tornillo_${id}`, { diameter: 0.016, height: ALTO * 2.4, tessellation: 14 }, scene);
  tornillo.position.y = ALTO;
  tornillo.material = matTornillo;
  partes.push(tornillo);

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// Manual de referencia
// ---------------------------------------------------------------------------