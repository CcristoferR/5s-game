import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";
import { materialPintado } from "./ObjetosComunes";

// ---------------------------------------------------------------------------
// Tablero de sombras
// ---------------------------------------------------------------------------
//
// La pieza que reemplaza a las casillas con carteles de frecuencia.
//
// Video 3.2 (1:52): "un lugar para cada cosa... una etiqueta para cada cosa y
// cada cosa con su etiqueta". Y en 1:38: el área de trabajo debe "hablar por
// sí sola". Una casilla que dice "uso muy frecuente" no habla sola: hay que
// leerla e interpretarla. Una silueta pintada sí — se ve el hueco con forma de
// llave y no hace falta explicar qué va ahí.
//
// Por eso cada silueta es un objetivo INDIVIDUAL y no una zona genérica: si
// cualquier herramienta valiera en cualquier hueco, volveríamos a clasificar
// por categoría, que es justo lo que este nivel dejó atrás.
//
// ─── DOS ERRORES QUE ESTE ARCHIVO ARRASTRABA ──────────────────────────────
//
// 1. LAS SILUETAS NO SE VEÍAN. El panel tiene 0,07 m de fondo y el hueco con
//    el dibujo medía 0,012 m colocado en el MISMO centro: quedaba enterrado
//    dentro del panel, tapado por delante y por detrás. El jugador veía una
//    plancha oscura y lisa. Ahora el hueco se apoya sobre la CARA FRONTAL.
//
// 2. LA ORIENTACIÓN ESTABA AL REVÉS. El punto de destino se adelantaba hacia
//    +Z, que es donde está el fondo del galpón — o sea, detrás del panel. La
//    cámara mira desde -Z, así que la herramienta bien colocada se iba a parar
//    a la cara ciega. Ahora el frente del tablero con giroY = 0 mira a -Z, que
//    es de donde mira el jugador.

export type SiluetaId = "llave" | "destornillador" | "martillo" | "alicate";

export interface HuecoTablero {
  id: SiluetaId;
  /** Centro del hueco en el mundo. Es donde queda posada la herramienta. */
  centro: Vector3;
  mesh: Mesh;
  /**
   * Panel de recepción: la lámina invisible a la que se APUNTA para colocar.
   *
   * Es lo que hace posible colgar algo en un tablero que está a 1,60 m cuando
   * el arrastre corre por el piso. Ver EstanteDestino.ts, que explica el
   * mecanismo completo.
   */
  receptor: Mesh;
  ocupado: boolean;
}

export interface TableroResult {
  huecos: HuecoTablero[];
  /** Escribe el rótulo bajo un hueco al colocar bien la herramienta. */
  rotular: (id: SiluetaId, texto: string) => void;
  /** Enciende el marco de un hueco mientras el cursor lo está apuntando. */
  resaltar: (id: SiluetaId | null) => void;
}

const ANCHO_HUECO = 0.46;
const ALTO_HUECO = 0.62;
const FONDO_PANEL = 0.07;

/**
 * Cara de un hueco: silueta arriba y banda de rótulo abajo.
 *
 * Se redibuja entera al rotular en vez de superponer otra malla, para que el
 * nombre quede impreso EN el panel — en una planta la etiqueta está pintada en
 * el tablero, no colgando al lado.
 */
function caraHueco(scene: Scene, nombre: string, id: SiluetaId, rotulo: string | null) {
  return materialPintado(scene, nombre, 640, 880, (ctx, w, h) => {
    ctx.fillStyle = "#2f3a41";
    ctx.fillRect(0, 0, w, h);

    dibujarSilueta(ctx, id, w, h);

    const banda = h * 0.168;
    ctx.fillStyle = rotulo ? "#1d2a23" : "#242d33";
    ctx.fillRect(0, h - banda, w, banda);
    ctx.strokeStyle = rotulo ? "#4e9c6b" : "#3f4b53";
    ctx.lineWidth = w * (rotulo ? 0.0156 : 0.0125);
    ctx.strokeRect(0, h - banda, w, banda);

    if (rotulo) {
      ctx.fillStyle = "#a9e0bd";
      ctx.font = `bold ${Math.round(w * 0.086)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(rotulo.toUpperCase(), w / 2, h - banda * 0.35);
    }
  });
}

/** Dibuja la silueta de una herramienta, centrada en el lienzo. */
function dibujarSilueta(ctx: CanvasRenderingContext2D, id: SiluetaId, w: number, h: number): void {
  ctx.save();
  ctx.translate(w / 2, h / 2 - 30 * (w / 320));

  // El dibujo está trazado para un lienzo de 320 px. Al subir la resolución se
  // escala, así que se puede volver a subir sin reescribir coordenadas.
  const k = w / 320;
  ctx.scale(k, k);

  ctx.fillStyle = "#8a99a3";
  ctx.strokeStyle = "#8a99a3";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // LAS SILUETAS COPIAN LA FORMA DEL MODELO, no una idea de la herramienta.
  //
  // Si no coinciden, el tablero deja de enseñar: el jugador no puede decidir
  // mirando y termina probando hueco por hueco. El alicate salía como una X
  // —dos barras cruzadas— cuando el modelo tiene dos ramas que se juntan
  // arriba y se abren abajo, y el martillo tenía la cabeza al revés respecto
  // de cómo queda colgado.

  if (id === "llave") {
    // Cuerpo recto con una boca en U en cada punta, como el modelo.
    ctx.fillRect(-15, -140, 30, 280);

    [-1, 1].forEach((lado) => {
      const y = lado * 158;
      ctx.fillRect(-38, y - 22, 76, 44);
      // El hueco de la boca: se recorta pintando el fondo del panel.
      ctx.fillStyle = "#2f3a41";
      ctx.fillRect(-13, y - lado * 24, 26, 34);
      ctx.fillStyle = "#8a99a3";
    });
  } else if (id === "destornillador") {
    // Mango grueso arriba, vástago fino abajo, punta plana. Vertical, que es
    // como cuelga.
    ctx.beginPath();
    ctx.moveTo(-30, -170);
    ctx.lineTo(30, -170);
    ctx.lineTo(24, -48);
    ctx.lineTo(-24, -48);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(-8, -48, 16, 190);
    ctx.fillRect(-17, 142, 34, 26);
  } else if (id === "martillo") {
    // Cabeza ARRIBA y cabo hacia abajo: así queda al colgarlo del tablero.
    // Antes estaba invertido y no coincidía con la pieza.
    ctx.fillRect(-88, -168, 176, 52);

    // Uña curva a un lado, que es lo que lo distingue de un mazo.
    ctx.beginPath();
    ctx.moveTo(-88, -168);
    ctx.lineTo(-124, -140);
    ctx.lineTo(-118, -108);
    ctx.lineTo(-88, -116);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(-16, -116, 32, 286);
  } else {
    // Alicate: ramas que CONVERGEN arriba (las mordazas) y se abren abajo (los
    // mangos), con el eje en medio. Antes eran dos barras cruzadas en aspa.
    [-1, 1].forEach((lado) => {
      ctx.beginPath();
      ctx.moveTo(lado * 10, -180);
      ctx.lineTo(lado * 26, -40);
      ctx.lineTo(lado * 62, 176);
      ctx.lineTo(lado * 26, 176);
      ctx.lineTo(lado * 4, -40);
      ctx.closePath();
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(0, -34, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2f3a41";
    ctx.beginPath();
    ctx.arc(0, -34, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Monta el tablero con sus huecos y devuelve los objetivos de colocación.
 *
 * @param giroY  Orientación. Con 0 el frente mira a -Z, que es desde donde
 *               mira la cámara del juego.
 */
export function crearTableroSombras(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  giroY: number,
  siluetas: SiluetaId[]
): TableroResult {
  const anchoPanel = siluetas.length * (ANCHO_HUECO + 0.1) + 0.18;

  // Vector que apunta hacia AFUERA del tablero, o sea hacia el jugador.
  // Todo lo que tiene que verse —siluetas, receptores, herramientas colgadas—
  // se desplaza a lo largo de él. Con giroY = 0 vale (0, 0, -1).
  const frenteX = -Math.sin(giroY);
  const frenteZ = -Math.cos(giroY);

  const matPanel = new PBRMaterial("matTableroSombras", scene);
  matPanel.albedoColor = new Color3(0.18, 0.22, 0.25);
  matPanel.roughness = 0.75;
  matPanel.metallic = 0.08;

  const panel = MeshBuilder.CreateBox(
    "tableroSombras",
    { width: anchoPanel, height: 1.05, depth: FONDO_PANEL },
    scene
  );
  panel.position.set(x, y, z);
  panel.rotation.y = giroY;
  panel.material = matPanel;
  panel.receiveShadows = true;

  // Repisa inferior del tablero: le da grosor y evita que se lea como una
  // calcomanía pegada a la pared.
  const repisa = MeshBuilder.CreateBox(
    "repisaTableroSombras",
    { width: anchoPanel, height: 0.05, depth: 0.18 },
    scene
  );
  repisa.position.set(x, y - 0.55, z);
  repisa.rotation.y = giroY;
  repisa.material = matPanel;

  // Montantes hasta el piso. El tablero ya no cuelga de una pared —está detrás
  // del banco, en medio del taller— así que necesita sostenerse: sin patas se
  // ve una plancha flotando a metro y medio del suelo.
  [-1, 1].forEach((lado) => {
    const dx = Math.cos(giroY) * lado * (anchoPanel / 2 - 0.06);
    const dz = -Math.sin(giroY) * lado * (anchoPanel / 2 - 0.06);
    const alturaPata = y - 0.525;
    const pata = MeshBuilder.CreateBox(
      `pataTableroSombras_${lado}`,
      { width: 0.08, height: alturaPata, depth: 0.08 },
      scene
    );
    pata.position.set(x + dx, alturaPata / 2, z + dz);
    pata.rotation.y = giroY;
    pata.material = matPanel;
    pata.receiveShadows = true;
  });

  const huecos: HuecoTablero[] = [];
  const marcos = new Map<SiluetaId, Mesh>();

  // Material del marco de resalte. Uno solo, compartido: son cuatro cuadros y
  // no hay motivo para crear cuatro materiales idénticos.
  const matResalte = new PBRMaterial("matResalteHueco", scene);
  matResalte.albedoColor = new Color3(0.15, 0.55, 0.32);
  matResalte.emissiveColor = new Color3(0.22, 0.75, 0.42);
  matResalte.roughness = 1;

  siluetas.forEach((id, i) => {
    const desplazamiento = (i - (siluetas.length - 1) / 2) * (ANCHO_HUECO + 0.1);

    // El panel puede estar girado, así que el desplazamiento lateral se
    // proyecta sobre su propio eje en vez de sumarse a X sin más.
    const dx = Math.cos(giroY) * desplazamiento;
    const dz = -Math.sin(giroY) * desplazamiento;

    // Distancias desde el centro del panel, medidas hacia el jugador.
    const CARA = FONDO_PANEL / 2 + 0.008; // la silueta, apoyada sobre el frente
    const POSADO = FONDO_PANEL / 2 + 0.1; // la herramienta, colgada delante
    const RECEPTOR = FONDO_PANEL / 2 + 0.16; // la lámina a la que se apunta

    const hueco = MeshBuilder.CreateBox(
      `huecoTablero_${id}`,
      { width: ANCHO_HUECO, height: ALTO_HUECO, depth: 0.012 },
      scene
    );
    hueco.position.set(x + dx + frenteX * CARA, y + 0.11, z + dz + frenteZ * CARA);
    hueco.rotation.y = giroY;
    hueco.material = caraHueco(scene, `matHueco_${id}`, id, null);
    hueco.isPickable = false;

    // Marco de resalte, apagado hasta que el cursor apunte a este hueco.
    const marco = MeshBuilder.CreateBox(
      `marcoHueco_${id}`,
      { width: ANCHO_HUECO + 0.05, height: ALTO_HUECO + 0.05, depth: 0.008 },
      scene
    );
    marco.position.set(x + dx + frenteX * (CARA - 0.004), y + 0.11, z + dz + frenteZ * (CARA - 0.004));
    marco.rotation.y = giroY;
    marco.material = matResalte;
    marco.isPickable = false;
    marco.isVisible = false;
    marcos.set(id, marco);

    // ─── EL RECEPTOR ────────────────────────────────────────────────────────
    //
    // Lámina fina, invisible y pinchable, suspendida delante de la silueta.
    //
    // TRANSPARENTE, NO INVISIBLE: con isVisible = false Babylon la descarta
    // antes de comprobar si es pinchable y el rayo no la encuentra nunca. Es
    // exactamente el mismo tropiezo que ya estaba documentado en los objetos
    // pesados del Nivel 1.
    //
    // Los cuatro receptores son COPLANARES y no se solapan de lado: un rayo
    // cruza ese plano en un único punto, así que no hay forma de que el cursor
    // apunte a dos huecos a la vez.
    const receptor = MeshBuilder.CreateBox(
      `receptorHueco_${id}`,
      { width: ANCHO_HUECO + 0.08, height: ALTO_HUECO + 0.1, depth: 0.02 },
      scene
    );
    receptor.position.set(x + dx + frenteX * RECEPTOR, y + 0.11, z + dz + frenteZ * RECEPTOR);
    receptor.rotation.y = giroY;
    receptor.visibility = 0;
    receptor.isPickable = true;

    huecos.push({
      id,
      centro: new Vector3(x + dx + frenteX * POSADO, y + 0.11, z + dz + frenteZ * POSADO),
      mesh: hueco,
      receptor,
      ocupado: false,
    });
  });

  /**
   * Escribe el nombre en la banda inferior del hueco.
   *
   * Se redibuja la textura entera en vez de superponer otra malla: así el
   * rótulo queda impreso en el tablero, que es como está en una planta — no es
   * un cartel flotante, es pintura sobre el panel.
   */
  const rotular = (id: SiluetaId, texto: string): void => {
    const hueco = huecos.find((h) => h.id === id);
    if (!hueco) return;
    hueco.mesh.material = caraHueco(scene, `matHuecoRot_${id}`, id, texto);
  };

  const resaltar = (id: SiluetaId | null): void => {
    marcos.forEach((marco, clave) => {
      marco.isVisible = clave === id;
    });
  };

  return { huecos, rotular, resaltar };
}