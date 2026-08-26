import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Vector3, Matrix } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";
import type { ObjetoNivel1 } from "../data/levelConfig";

// ---------------------------------------------------------------------------
// Objetos del Nivel 1 (Seiri — Clasificar)
// ---------------------------------------------------------------------------
//
// La regla de diseño acá no es "que se vea bonito", es QUE SE RECONOZCA. El
// jugador tiene que poder decir "eso es un casco rajado" o "eso es un diario
// viejo" desde la cámara del nivel, porque de esa lectura depende la decisión
// que el nivel le pide tomar. Un objeto ambiguo no es un problema estético:
// arruina el ejercicio.
//
// De ahí tres criterios que se repiten en todas las piezas:
//
// 1. SILUETA ANTES QUE DETALLE. Cada objeto tiene una forma general
//    inconfundible a la distancia (el asa de la taza, el ala del casco, la
//    espiral del manual). El detalle chico solo suma cuando ya se entendió qué
//    es.
// 2. LA PISTA DE LA DECISIÓN, VISIBLE. Si un objeto se descarta por algo, ese
//    algo se ve: la rajadura del casco, el moho de la taza, la etiqueta en
//    blanco de la caja. El jugador no tiene que adivinar el criterio.
// 3. CONTRASTE ENTRE PARECIDOS. Diario viejo y manual de procedimientos son
//    los dos "papel apilado"; se diferencian por color, encuadernación y tapa.
//
// Todas las texturas se generan por código (DynamicTexture): no hay archivos
// de imagen que administrar y quedan nítidas a cualquier resolución.

export function crearFormaNivel1(scene: Scene, datos: ObjetoNivel1): Mesh {
  return apoyarSobreLaBase(construirForma(scene, datos));
}

/**
 * Baja la geometría hasta que su punto más bajo quede en y = 0.
 *
 * Cada objeto se modela con las medidas que le quedan naturales, y por eso
 * cada uno termina con su origen en un lugar distinto: el cilindro de la taza
 * queda centrado en su altura, el ala del casco cae por debajo del domo. Al
 * colocarlos todos a la altura del banco, unos flotarían y otros se hundirían
 * — la taza se clavaría 13 cm dentro del tablero.
 *
 * Normalizarlo acá, midiendo, evita tener que ajustar diez posiciones a mano y
 * que se rompan de nuevo cada vez que se retoque un modelo.
 */
function apoyarSobreLaBase(mesh: Mesh): Mesh {
  mesh.computeWorldMatrix(true);
  const hijos = mesh.getChildMeshes().filter((hijo): hijo is Mesh => hijo instanceof Mesh);
  hijos.forEach((hijo) => hijo.computeWorldMatrix(true));

  let minimo = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
  hijos.forEach((hijo) => {
    minimo = Math.min(minimo, hijo.getBoundingInfo().boundingBox.minimumWorld.y);
  });

  if (Math.abs(minimo) < 0.0005) return mesh;

  // Se hornea el desplazamiento en los vértices del padre y se corrige la
  // posición de los hijos por igual: los hijos son relativos al origen del
  // padre, que no se mueve al hornear, así que sin esto quedarían desalineados.
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, -minimo, 0));
  hijos.forEach((hijo) => {
    hijo.position.y -= minimo;
  });
  mesh.refreshBoundingInfo();

  return mesh;
}

function construirForma(scene: Scene, datos: ObjetoNivel1): Mesh {
  switch (datos.id) {
    case "engrapadora":
      return crearEngrapadora(scene, datos.id);
    case "taza_cafe":
      return crearTaza(scene, datos.id);
    case "carpeta_activa":
      return crearCarpeta(scene, datos.id);
    case "diario_viejo":
      return crearDiario(scene, datos.id);
    case "caja_sin_etiqueta":
      return crearCajaSellada(scene, datos.id);
    case "casco_agrietado":
      return crearCasco(scene, datos.id);
    case "cinta_metrica":
      return crearCintaMetrica(scene, datos.id);
    case "guantes_ocasionales":
      return crearGuantes(scene, datos.id);
    case "chatarra_metal":
      return crearChatarra(scene, datos.id);
    case "manual_procedimientos":
      return crearManual(scene, datos.id);
    default: {
      const mesh = MeshBuilder.CreateBox(datos.id, { size: 0.4 }, scene);
      const mat = new PBRMaterial(`mat_${datos.id}`, scene);
      mat.albedoColor = new Color3(0.6, 0.6, 0.65);
      mat.roughness = 0.7;
      mesh.material = mat;
      return mesh;
    }
  }
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

function material(scene: Scene, nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;

  // Grano en la rugosidad para todo lo que pase por acá. Una superficie
  // perfectamente uniforme se lee como plástico aunque el color sea correcto:
  // el reflejo la cubre por igual en vez de recorrerla. Los metales llevan
  // además el cepillado, porque el metal liso casi no existe en la realidad y
  // es lo que más delata una escena hecha con primitivas.
  mat.microSurfaceTexture = texturaGrano(scene, metalico >= 0.6 ? 0.14 : 0.07);
  if (metalico >= 0.6) {
    mat.albedoTexture = texturaMetalCepillado(scene);
    // El albedo se aclara porque ahora lo multiplica la textura, que ronda el
    // gris medio: sin esto el metal quedaría notoriamente más oscuro.
    mat.albedoColor = new Color3(
      Math.min(1, color.r * 1.35),
      Math.min(1, color.g * 1.35),
      Math.min(1, color.b * 1.35)
    );
  }

  return mat;
}

/** Textura dibujada por código sobre un canvas 2D. */
function textura(
  scene: Scene,
  nombre: string,
  ancho: number,
  alto: number,
  dibujar: (ctx: CanvasRenderingContext2D) => void
): DynamicTexture {
  const tex = new DynamicTexture(nombre, { width: ancho, height: alto }, scene, true);
  dibujar(tex.getContext() as CanvasRenderingContext2D);
  tex.update();
  return tex;
}

/**
 * Une las piezas en una sola malla y le cuelga los detalles como hijos.
 *
 * Los hijos NO se fusionan a propósito: llevan materiales distintos, y fusionar
 * obligaría a un multi-material. Que sean hijos no afecta al arrastre —
 * PointerDragBehavior acepta el clic sobre cualquier descendiente del objeto.
 */
function unir(piezas: Mesh[], id: string, mat: PBRMaterial): Mesh {
  const fusion = Mesh.MergeMeshes(piezas, true, true, undefined, false, true)!;
  fusion.name = id;
  fusion.material = mat;
  return fusion;
}

function agregar(padre: Mesh, pieza: Mesh, mat: PBRMaterial): Mesh {
  pieza.parent = padre;
  pieza.material = mat;
  return pieza;
}

// ---------------------------------------------------------------------------
// NECESARIO — engrapadora
// ---------------------------------------------------------------------------

function crearEngrapadora(scene: Scene, id: string): Mesh {
  const matCuerpo = material(scene, `matCuerpo_${id}`, new Color3(0.1, 0.11, 0.14), 0.3, 0.35);

  // Base con dos escalones: la parte que apoya y el cuerpo del cargador.
  const base = MeshBuilder.CreateBox(`base_${id}`, { width: 0.46, height: 0.05, depth: 0.15 }, scene);
  const cargador = MeshBuilder.CreateBox(`cargador_${id}`, { width: 0.40, height: 0.07, depth: 0.13 }, scene);
  cargador.position.set(-0.02, 0.055, 0);

  const fusion = unir([base, cargador], id, matCuerpo);

  // Brazo superior inclinado y bisagra atrás: es la silueta que hace que se
  // lea como engrapadora y no como un ladrillo negro.
  const matBrazo = material(scene, `matBrazo_${id}`, new Color3(0.14, 0.15, 0.18), 0.28, 0.4);
  const brazo = MeshBuilder.CreateBox(`brazo_${id}`, { width: 0.42, height: 0.055, depth: 0.12 }, scene);
  brazo.position.set(0.01, 0.135, 0);
  brazo.rotation.z = -0.09;
  agregar(fusion, brazo, matBrazo);

  const bisagra = MeshBuilder.CreateCylinder(`bisagra_${id}`, { diameter: 0.055, height: 0.13 }, scene);
  bisagra.rotation.x = Math.PI / 2;
  bisagra.position.set(-0.21, 0.1, 0);
  agregar(fusion, bisagra, material(scene, `matBisagra_${id}`, new Color3(0.5, 0.51, 0.54), 0.22, 0.9));

  // Yunque cromado del frente: donde se dobla la grapa.
  const matCromo = material(scene, `matCromo_${id}`, new Color3(0.76, 0.77, 0.8), 0.15, 0.95);
  const yunque = MeshBuilder.CreateBox(`yunque_${id}`, { width: 0.09, height: 0.012, depth: 0.13 }, scene);
  yunque.position.set(0.19, 0.03, 0);
  agregar(fusion, yunque, matCromo);

  return fusion;
}

// ---------------------------------------------------------------------------
// DESCARTAR — taza con café viejo
// ---------------------------------------------------------------------------

function crearTaza(scene: Scene, id: string): Mesh {
  const matTaza = material(scene, `matCuerpo_${id}`, new Color3(0.9, 0.9, 0.88), 0.16);

  const cuerpo = MeshBuilder.CreateCylinder(`cuerpo_${id}`, { diameterTop: 0.23, diameterBottom: 0.19, height: 0.26, tessellation: 28 }, scene);
  const labio = MeshBuilder.CreateTorus(`labio_${id}`, { diameter: 0.23, thickness: 0.016, tessellation: 28 }, scene);
  labio.position.y = 0.13;

  // Asa en C, armada con tres tramos: la silueta que identifica una taza de
  // un vistazo, incluso de lejos.
  const asaSup = MeshBuilder.CreateCylinder(`asaSup_${id}`, { diameter: 0.022, height: 0.09 }, scene);
  asaSup.rotation.z = Math.PI / 2;
  asaSup.position.set(0.15, 0.07, 0);
  const asaMed = MeshBuilder.CreateCylinder(`asaMed_${id}`, { diameter: 0.022, height: 0.13 }, scene);
  asaMed.position.set(0.19, 0.005, 0);
  const asaInf = MeshBuilder.CreateCylinder(`asaInf_${id}`, { diameter: 0.022, height: 0.09 }, scene);
  asaInf.rotation.z = Math.PI / 2;
  asaInf.position.set(0.15, -0.06, 0);

  const fusion = unir([cuerpo, labio, asaSup, asaMed, asaInf], id, matTaza);

  // El café: turbio y con película, no un disco negro limpio. Es la pista de
  // que la taza lleva días ahí — el motivo por el que se descarta.
  const texCafe = textura(scene, `texCafe_${id}`, 128, 128, (ctx) => {
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "rgba(96, 104, 62, 0.55)";
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + Math.random() * 12, 5 + Math.random() * 9, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const matCafe = material(scene, `matCafe_${id}`, new Color3(1, 1, 1), 0.45);
  matCafe.albedoTexture = texCafe;
  const cafe = MeshBuilder.CreateCylinder(`cafe_${id}`, { diameter: 0.2, height: 0.015, tessellation: 24 }, scene);
  cafe.position.y = 0.095;
  agregar(fusion, cafe, matCafe);

  // Cerco reseco en la pared interior, por encima del líquido.
  const cerco = MeshBuilder.CreateCylinder(`cerco_${id}`, { diameter: 0.205, height: 0.02, tessellation: 24 }, scene);
  cerco.position.y = 0.113;
  agregar(fusion, cerco, material(scene, `matCerco_${id}`, new Color3(0.32, 0.24, 0.15), 0.75));

  return fusion;
}

// ---------------------------------------------------------------------------
// NECESARIO — carpeta de proyecto activo
// ---------------------------------------------------------------------------

function crearCarpeta(scene: Scene, id: string): Mesh {
  const matCarpeta = material(scene, `mat_${id}`, new Color3(0.78, 0.6, 0.24), 0.82);

  // Tapa inferior y superior con el lomo apenas más grueso: se lee como una
  // carpeta cerrada, no como una tabla.
  const tapaInf = MeshBuilder.CreateBox(`tapaInf_${id}`, { width: 0.36, height: 0.012, depth: 0.46 }, scene);
  const lomo = MeshBuilder.CreateBox(`lomo_${id}`, { width: 0.03, height: 0.05, depth: 0.46 }, scene);
  lomo.position.set(-0.18, 0.02, 0);
  const tapaSup = MeshBuilder.CreateBox(`tapaSup_${id}`, { width: 0.36, height: 0.012, depth: 0.46 }, scene);
  tapaSup.position.set(0.004, 0.045, 0);
  tapaSup.rotation.z = 0.02;

  const fusion = unir([tapaInf, lomo, tapaSup], id, matCarpeta);

  // Papeles asomando: dice "esta carpeta está en uso", que es exactamente el
  // criterio por el que se queda.
  const papeles = MeshBuilder.CreateBox(`papeles_${id}`, { width: 0.33, height: 0.026, depth: 0.44 }, scene);
  papeles.position.set(0.012, 0.026, 0.008);
  agregar(fusion, papeles, material(scene, `matPapeles_${id}`, new Color3(0.95, 0.95, 0.93), 0.9));

  // Etiqueta con renglones escritos en el lomo.
  const texEtiqueta = textura(scene, `texEtiqueta_${id}`, 256, 96, (ctx) => {
    ctx.fillStyle = "#f6f5f0";
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = "#3b4a63";
    ctx.fillRect(0, 0, 256, 16);
    ctx.fillStyle = "rgba(40,44,52,0.75)";
    ctx.fillRect(20, 38, 150, 9);
    ctx.fillRect(20, 58, 200, 7);
  });
  const matEtiqueta = material(scene, `matEtiqueta_${id}`, new Color3(1, 1, 1), 0.85);
  matEtiqueta.albedoTexture = texEtiqueta;

  const etiqueta = MeshBuilder.CreateBox(`etiquetaCarpeta_${id}`, { width: 0.16, height: 0.004, depth: 0.09 }, scene);
  etiqueta.position.set(0.05, 0.053, 0.13);
  agregar(fusion, etiqueta, matEtiqueta);

  return fusion;
}

// ---------------------------------------------------------------------------
// DESCARTAR — diario viejo
// ---------------------------------------------------------------------------

function crearDiario(scene: Scene, id: string): Mesh {
  // Papel amarillento: el color ya cuenta que es viejo, antes de leer nada.
  const matPagina = material(scene, `matPagina_${id}`, new Color3(0.82, 0.78, 0.63), 0.92);

  const hojas: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.3, height: 0.009, depth: 0.4 }, scene);
    hoja.position.set((Math.random() - 0.5) * 0.012, i * 0.01, (Math.random() - 0.5) * 0.014);
    hoja.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.035;
    hojas.push(hoja);
  }
  const fusion = unir(hojas, id, matPagina);

  // Portada con cabecera de diario: título grande, filete y columnas de texto.
  // Es lo que lo separa del manual, que también es papel apilado.
  const texPortada = textura(scene, `texPortada_${id}`, 320, 420, (ctx) => {
    ctx.fillStyle = "#ddd6c0";
    ctx.fillRect(0, 0, 320, 420);

    ctx.fillStyle = "#2b2b28";
    ctx.fillRect(24, 26, 272, 34);
    ctx.fillRect(24, 70, 272, 4);

    ctx.fillStyle = "rgba(60,60,56,0.5)";
    for (let col = 0; col < 3; col++) {
      const x = 24 + col * 94;
      for (let fila = 0; fila < 22; fila++) {
        const ancho = 60 + Math.random() * 24;
        ctx.fillRect(x, 92 + fila * 14, ancho, 5);
      }
    }

    // Foto del recuadro central: una mancha gris, como en un diario impreso.
    ctx.fillStyle = "rgba(90,90,86,0.55)";
    ctx.fillRect(112, 210, 96, 70);

    // Manchas de humedad: refuerzan que lleva meses ahí.
    ctx.fillStyle = "rgba(150,130,80,0.28)";
    ctx.beginPath();
    ctx.ellipse(268, 360, 40, 28, 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  const matPortada = material(scene, `matPortada_${id}`, new Color3(1, 1, 1), 0.9);
  matPortada.albedoTexture = texPortada;

  const portada = MeshBuilder.CreateBox(`portada_${id}`, { width: 0.31, height: 0.008, depth: 0.41 }, scene);
  portada.position.y = 5 * 0.01;
  agregar(fusion, portada, matPortada);

  // Doblez central: los diarios se guardan plegados.
  const doblez = MeshBuilder.CreateBox(`doblez_${id}`, { width: 0.31, height: 0.014, depth: 0.02 }, scene);
  doblez.position.y = 5 * 0.01 + 0.003;
  agregar(fusion, doblez, material(scene, `matDoblez_${id}`, new Color3(0.72, 0.68, 0.55), 0.95));

  return fusion;
}

// ---------------------------------------------------------------------------
// DUDOSO — caja sin etiqueta
// ---------------------------------------------------------------------------

function crearCajaSellada(scene: Scene, id: string): Mesh {
  const matCaja = material(scene, `mat_${id}`, new Color3(0.58, 0.43, 0.29), 0.85);

  const caja = MeshBuilder.CreateBox(id, { width: 0.38, height: 0.3, depth: 0.34 }, scene);
  caja.material = matCaja;

  // Solapas superiores: le dan volumen de caja cerrada en vez de cubo liso.
  const matSolapa = material(scene, `matSolapa_${id}`, new Color3(0.52, 0.38, 0.25), 0.85);
  [-1, 1].forEach((lado, i) => {
    const solapa = MeshBuilder.CreateBox(`solapa_${id}_${i}`, { width: 0.38, height: 0.012, depth: 0.165 }, scene);
    solapa.position.set(0, 0.155, lado * 0.085);
    agregar(caja, solapa, matSolapa);
  });

  // Cinta de embalar cruzando la junta.
  const matCinta = material(scene, `matCinta_${id}`, new Color3(0.76, 0.68, 0.5), 0.3);
  const cinta = MeshBuilder.CreateBox(`cinta_${id}`, { width: 0.07, height: 0.02, depth: 0.35 }, scene);
  cinta.position.y = 0.157;
  agregar(caja, cinta, matCinta);

  // Etiqueta EN BLANCO con un signo de pregunta.
  //
  // Es la pieza clave del objeto: el jugador tiene que entender que el problema
  // no es la caja, es que nadie sabe qué hay adentro. Por eso va a "Dudoso" y
  // no a la basura — se le pone tarjeta roja y se revisa.
  const texEtiqueta = textura(scene, `texEtiquetaCaja_${id}`, 200, 150, (ctx) => {
    ctx.fillStyle = "#f4f2ec";
    ctx.fillRect(0, 0, 200, 150);
    ctx.strokeStyle = "rgba(60,60,60,0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 184, 134);
    ctx.fillStyle = "#8c3a3a";
    ctx.font = "bold 92px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 100, 80);
  });
  const matEtiqueta = material(scene, `matEtiquetaCaja_${id}`, new Color3(1, 1, 1), 0.88);
  matEtiqueta.albedoTexture = texEtiqueta;

  const etiqueta = MeshBuilder.CreateBox(`etiquetaCaja_${id}`, { width: 0.2, height: 0.15, depth: 0.006 }, scene);
  etiqueta.position.set(0, 0.01, 0.172);
  agregar(caja, etiqueta, matEtiqueta);

  return caja;
}

// ---------------------------------------------------------------------------
// DESCARTAR — casco de seguridad agrietado
// ---------------------------------------------------------------------------

function crearCasco(scene: Scene, id: string): Mesh {
  const matCasco = material(scene, `mat_${id}`, new Color3(0.95, 0.72, 0.06), 0.32, 0.03);

  const domo = MeshBuilder.CreateSphere(`domo_${id}`, { diameter: 0.38, segments: 20 }, scene);
  domo.scaling.y = 0.66;

  // Ala perimetral, más marcada adelante: la silueta inconfundible de un casco
  // de obra visto desde arriba, que es como lo ve la cámara del nivel.
  const ala = MeshBuilder.CreateCylinder(`ala_${id}`, { diameterTop: 0.5, diameterBottom: 0.46, height: 0.022, tessellation: 28 }, scene);
  ala.position.y = -0.085;

  const visera = MeshBuilder.CreateBox(`visera_${id}`, { width: 0.2, height: 0.02, depth: 0.11 }, scene);
  visera.position.set(0, -0.078, 0.21);

  const fusion = unir([domo, ala, visera], id, matCasco);

  // Nervadura central: detalle real de los cascos, ayuda a leer el volumen.
  const nervadura = MeshBuilder.CreateBox(`nervadura_${id}`, { width: 0.035, height: 0.03, depth: 0.3 }, scene);
  nervadura.position.y = 0.1;
  agregar(fusion, nervadura, material(scene, `matNervadura_${id}`, new Color3(0.88, 0.66, 0.05), 0.35));

  // LA RAJADURA — el motivo del descarte, en tres tramos quebrados para que se
  // lea como una fractura y no como una raya pintada. Un casco rajado no
  // protege: va a la basura, no a revisión.
  const matGrieta = material(scene, `matGrieta_${id}`, new Color3(0.05, 0.04, 0.03), 0.95);
  const tramos: Array<[Vector3, number, number]> = [
    [new Vector3(-0.05, 0.105, 0.02), 0.16, 0.5],
    [new Vector3(0.03, 0.1, -0.06), 0.13, -0.3],
    [new Vector3(0.1, 0.075, -0.13), 0.1, 0.9],
  ];
  tramos.forEach(([posicion, largo, giro], i) => {
    const tramo = MeshBuilder.CreateBox(`grieta_${id}_${i}`, { width: 0.014, height: 0.02, depth: largo }, scene);
    tramo.position.copyFrom(posicion);
    tramo.rotation.y = giro;
    agregar(fusion, tramo, matGrieta);
  });

  return fusion;
}

// ---------------------------------------------------------------------------
// NECESARIO — cinta métrica
// ---------------------------------------------------------------------------

function crearCintaMetrica(scene: Scene, id: string): Mesh {
  const matCarcasa = material(scene, `mat_${id}`, new Color3(0.95, 0.74, 0.08), 0.34, 0.08);

  // Carcasa achatada, como las de obra, no un disco.
  const carcasa = MeshBuilder.CreateBox(`carcasa_${id}`, { width: 0.19, height: 0.17, depth: 0.09 }, scene);
  const canto = MeshBuilder.CreateCylinder(`canto_${id}`, { diameter: 0.17, height: 0.092, tessellation: 24 }, scene);
  canto.rotation.x = Math.PI / 2;
  canto.position.y = 0.01;

  const fusion = unir([carcasa, canto], id, matCarcasa);

  const matNegro = material(scene, `matNegro_${id}`, new Color3(0.12, 0.12, 0.13), 0.5);
  const franja = MeshBuilder.CreateBox(`franja_${id}`, { width: 0.2, height: 0.045, depth: 0.094 }, scene);
  franja.position.y = -0.055;
  agregar(fusion, franja, matNegro);

  // LA CINTA SALIENDO — sin esto es una caja amarilla cualquiera. Con la cinta
  // graduada asomando, se lee al instante.
  const texCinta = textura(scene, `texCinta_${id}`, 256, 48, (ctx) => {
    ctx.fillStyle = "#f0e6c8";
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = "#22252a";
    for (let i = 0; i < 26; i++) {
      const x = i * 10 + 4;
      const alto = i % 5 === 0 ? 22 : 12;
      ctx.fillRect(x, 48 - alto, 2.5, alto);
    }
    ctx.fillRect(0, 0, 256, 3);
  });
  const matCinta = material(scene, `matCinta_${id}`, new Color3(1, 1, 1), 0.35, 0.25);
  matCinta.albedoTexture = texCinta;

  const cinta = MeshBuilder.CreateBox(`cinta_${id}`, { width: 0.26, height: 0.004, depth: 0.045 }, scene);
  cinta.position.set(0.21, -0.045, 0);
  cinta.rotation.z = 0.06;
  agregar(fusion, cinta, matCinta);

  const gancho = MeshBuilder.CreateBox(`gancho_${id}`, { width: 0.012, height: 0.035, depth: 0.05 }, scene);
  gancho.position.set(0.335, -0.03, 0);
  agregar(fusion, gancho, material(scene, `matGancho_${id}`, new Color3(0.66, 0.67, 0.7), 0.22, 0.92));

  // Clip de cinturón, atrás.
  const clip = MeshBuilder.CreateBox(`clip_${id}`, { width: 0.03, height: 0.09, depth: 0.012 }, scene);
  clip.position.set(-0.06, -0.02, -0.052);
  agregar(fusion, clip, material(scene, `matClip_${id}`, new Color3(0.55, 0.56, 0.6), 0.3, 0.85));

  return fusion;
}

// ---------------------------------------------------------------------------
// DUDOSO — guantes de trabajo (uso ocasional)
// ---------------------------------------------------------------------------

function crearGuantes(scene: Scene, id: string): Mesh {
  const matGuante = material(scene, `mat_${id}`, new Color3(0.72, 0.58, 0.4), 0.88);

  // Cada guante se arma con palma, cuatro dedos y pulgar. Antes eran dos
  // cápsulas cruzadas, que podían pasar por cualquier cosa; con los dedos la
  // lectura es inmediata.
  const construirGuante = (sufijo: string, desplazamiento: Vector3, giro: number): Mesh[] => {
    const piezas: Mesh[] = [];

    const palma = MeshBuilder.CreateBox(`palma_${id}_${sufijo}`, { width: 0.13, height: 0.035, depth: 0.15 }, scene);
    piezas.push(palma);

    const puno = MeshBuilder.CreateBox(`puno_${id}_${sufijo}`, { width: 0.115, height: 0.04, depth: 0.07 }, scene);
    puno.position.set(0, 0, -0.1);
    piezas.push(puno);

    for (let d = 0; d < 4; d++) {
      const dedo = MeshBuilder.CreateCapsule(`dedo_${id}_${sufijo}_${d}`, { height: 0.1, radius: 0.016 }, scene);
      dedo.rotation.x = Math.PI / 2;
      dedo.position.set(-0.045 + d * 0.03, 0.002, 0.115);
      piezas.push(dedo);
    }

    const pulgar = MeshBuilder.CreateCapsule(`pulgar_${id}_${sufijo}`, { height: 0.075, radius: 0.017 }, scene);
    pulgar.rotation.z = Math.PI / 2;
    pulgar.rotation.y = 0.5;
    pulgar.position.set(0.075, 0, 0.035);
    piezas.push(pulgar);

    piezas.forEach((pieza) => {
      pieza.rotation.y += giro;
      pieza.position.addInPlace(desplazamiento);
    });

    return piezas;
  };

  // Uno encima del otro y girados: montoncito de guantes dejados sobre el banco.
  const piezas = [
    ...construirGuante("a", new Vector3(-0.03, 0, 0), -0.25),
    ...construirGuante("b", new Vector3(0.04, 0.04, 0.01), 0.35),
  ];

  return unir(piezas, id, matGuante);
}

// ---------------------------------------------------------------------------
// DUDOSO — pieza de metal sin identificar
// ---------------------------------------------------------------------------

function crearChatarra(scene: Scene, id: string): Mesh {
  // Óxido: rugoso y poco metálico, lo contrario de una herramienta cuidada.
  const matOxido = material(scene, `mat_${id}`, new Color3(0.42, 0.24, 0.13), 0.78, 0.35);

  const piezas: Mesh[] = [];

  // Chapa doblada: la forma que más grita "esto es un resto", no una pieza útil.
  const chapa = MeshBuilder.CreateBox(`chapa_${id}`, { width: 0.26, height: 0.014, depth: 0.14 }, scene);
  chapa.rotation.set(0.1, 0.35, 0.08);
  piezas.push(chapa);

  const chapaDoblada = MeshBuilder.CreateBox(`chapaDoblada_${id}`, { width: 0.12, height: 0.013, depth: 0.13 }, scene);
  chapaDoblada.rotation.set(0.9, 0.35, 0);
  chapaDoblada.position.set(0.14, 0.045, -0.01);
  piezas.push(chapaDoblada);

  const perfil = MeshBuilder.CreateBox(`perfil_${id}`, { width: 0.19, height: 0.035, depth: 0.035 }, scene);
  perfil.rotation.set(0, -0.6, 0.25);
  perfil.position.set(-0.05, 0.04, 0.05);
  piezas.push(perfil);

  const tuerca = MeshBuilder.CreateCylinder(`tuerca_${id}`, { diameter: 0.055, height: 0.03, tessellation: 6 }, scene);
  tuerca.rotation.x = 0.4;
  tuerca.position.set(-0.11, 0.025, -0.05);
  piezas.push(tuerca);

  const varilla = MeshBuilder.CreateCylinder(`varilla_${id}`, { diameter: 0.018, height: 0.22 }, scene);
  varilla.rotation.set(Math.PI / 2, 0.9, 0);
  varilla.position.set(0.02, 0.015, -0.06);
  piezas.push(varilla);

  return unir(piezas, id, matOxido);
}

// ---------------------------------------------------------------------------
// NECESARIO — manual de procedimientos
// ---------------------------------------------------------------------------

function crearManual(scene: Scene, id: string): Mesh {
  const matPagina = material(scene, `matPagina_${id}`, new Color3(0.93, 0.93, 0.9), 0.9);

  const hojas: Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const hoja = MeshBuilder.CreateBox(`hoja_${id}_${i}`, { width: 0.28, height: 0.008, depth: 0.37 }, scene);
    hoja.position.y = i * 0.0085;
    hojas.push(hoja);
  }
  const fusion = unir(hojas, id, matPagina);

  // Tapa institucional: azul, con bloque de título y franja. Contrasta a
  // propósito con el diario (amarillento y desprolijo) para que no se
  // confundan, que son los dos objetos de papel del nivel.
  const texTapa = textura(scene, `texTapa_${id}`, 300, 400, (ctx) => {
    ctx.fillStyle = "#26456e";
    ctx.fillRect(0, 0, 300, 400);
    ctx.fillStyle = "#1b3253";
    ctx.fillRect(0, 300, 300, 100);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(38, 74, 190, 20);
    ctx.fillRect(38, 106, 150, 20);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(38, 152, 224, 6);
    ctx.fillRect(38, 172, 200, 6);
    ctx.fillRect(38, 192, 214, 6);

    // Sello/logo de la empresa abajo a la derecha.
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 5;
    ctx.strokeRect(196, 328, 62, 44);
  });
  const matTapa = material(scene, `matTapa_${id}`, new Color3(1, 1, 1), 0.55);
  matTapa.albedoTexture = texTapa;

  const tapa = MeshBuilder.CreateBox(`tapa_${id}`, { width: 0.29, height: 0.009, depth: 0.38 }, scene);
  tapa.position.y = 6 * 0.0085;
  agregar(fusion, tapa, matTapa);

  // ESPIRAL REAL: anillos separados en vez de un tubo liso. Es el detalle que
  // más rápido distingue el manual del diario a la distancia.
  const matEspiral = material(scene, `matEspiral_${id}`, new Color3(0.62, 0.63, 0.66), 0.28, 0.8);
  for (let i = 0; i < 9; i++) {
    const anillo = MeshBuilder.CreateTorus(`anillo_${id}_${i}`, { diameter: 0.036, thickness: 0.006, tessellation: 12 }, scene);
    anillo.rotation.y = Math.PI / 2;
    anillo.position.set(-0.145, 0.026, -0.15 + i * 0.0375);
    agregar(fusion, anillo, matEspiral);
  }

  // Separadores de colores asomando: refuerzan que es un documento de consulta
  // en uso, no papel para tirar.
  const coloresSeparador = [new Color3(0.85, 0.3, 0.25), new Color3(0.9, 0.7, 0.2), new Color3(0.3, 0.6, 0.4)];
  coloresSeparador.forEach((color, i) => {
    const separador = MeshBuilder.CreateBox(`separador_${id}_${i}`, { width: 0.035, height: 0.005, depth: 0.39 }, scene);
    separador.position.set(0.13, 0.012 + i * 0.012, 0);
    agregar(fusion, separador, material(scene, `matSeparador_${id}_${i}`, color, 0.75));
  });

  return fusion;
}