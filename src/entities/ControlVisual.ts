import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Mesh,
  Vector3,
  PointLight,
} from "@babylonjs/core";
import { materialPintado } from "./ObjetosComunes";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";
import type {
  PuertoNivel4,
  ZonaPisoNivel4,
  CircuitoNivel4,
  ColorNivel4,
  FormaConector,
} from "../data/levelConfig";

// ===========================================================================
// Los controles visuales del entorno — Nivel 4 (Seiketsu)
// ===========================================================================
//
// Tres piezas, tres grados de control sobre el mismo error. El orden importa
// más que cualquiera de ellas por separado, y es lo que el nivel enseña:
//
//   ARMARIO DE CONECTORES — poka-yoke. Cada puerto tiene una forma y solo
//   acepta su conector. El error no se avisa: no puede ocurrir.
//
//   ZONAS DE PISO — Andon. Aceptan cualquier plantilla, y si es la que no va,
//   el contorno parpadea en rojo y suena la chicharra. El error ocurre y se
//   corrige porque alguien lo ve.
//
//   PANEL DE INTERRUPTORES — convención de color. No valida nada. Se puede
//   pintar un interruptor del color que sea y la instalación sigue andando.
//   El fallo solo aparece cuando alguien audita, que es el Nivel 5.
//
// ─── ORIENTACIÓN ──────────────────────────────────────────────────────────
//
// La cámara observa desde Z NEGATIVO. Con giroY = 0 el frente de un mueble
// mira a -Z, o sea hacia el jugador. Es la misma convención que usan el
// tablero de siluetas y la estantería del Nivel 2.

/** Hacia el jugador. */
function frenteDe(giroY: number): { x: number; z: number } {
  return { x: -Math.sin(giroY), z: -Math.cos(giroY) };
}

/** A lo ancho del mueble. */
function ladoDe(giroY: number): { x: number; z: number } {
  return { x: Math.cos(giroY), z: -Math.sin(giroY) };
}

// ---------------------------------------------------------------------------
// ANDON
// ---------------------------------------------------------------------------

/**
 * Parpadeo rojo de aviso sobre un marco.
 *
 * Video 4.2 (1:32) nombra el Andon entre las herramientas de control visual.
 * Un Andon no corrige nada: avisa. Por eso esto no bloquea la acción, la
 * señala — la pieza vuelve a su sitio igual, y lo que queda es que el jugador
 * VIO el error en el momento en que lo cometió.
 *
 * Tres destellos y no uno: un solo parpadeo se confunde con un artefacto de
 * render. Tres seguidos se leen como una alarma.
 *
 * @param alSonar  Se llama en cada destello. El nivel lo usa para la chicharra;
 *                 este módulo no toca el audio, para poder montarlo en escenas
 *                 sin sonido.
 */
export function dispararAndon(
  scene: Scene,
  material: PBRMaterial,
  colorReposo: Color3,
  alSonar?: () => void
): void {
  const DESTELLOS = 3;
  const DURACION = 220;
  const inicio = performance.now();
  let ultimoDestello = -1;

  const observador = scene.onBeforeRenderObservable.add(() => {
    const transcurrido = performance.now() - inicio;
    const destello = Math.floor(transcurrido / DURACION);

    if (destello >= DESTELLOS * 2) {
      material.emissiveColor.copyFrom(colorReposo);
      scene.onBeforeRenderObservable.remove(observador);
      return;
    }

    const encendido = destello % 2 === 0;

    if (encendido && destello !== ultimoDestello) {
      ultimoDestello = destello;
      if (alSonar) alSonar();
    }

    material.emissiveColor.set(encendido ? 0.95 : 0.12, encendido ? 0.1 : 0.03, encendido ? 0.08 : 0.03);
  });
}

// ---------------------------------------------------------------------------
// ESTACIÓN A — Armario de conectores (poka-yoke)
// ---------------------------------------------------------------------------

export interface PuertoMontado {
  id: string;
  forma: FormaConector;
  /** Lámina invisible a la que se apunta. Solo engancha su propia forma. */
  receptor: Mesh;
  /** Dónde queda el conector una vez enchufado. */
  anclaje: Vector3;
  /** Dónde se sostiene mientras el jugador apunta, antes de soltar. */
  sostenido: Vector3;
  ocupado: boolean;
}

export interface ArmarioResult {
  puertos: PuertoMontado[];
  /** Enciende el borde de un puerto mientras el cursor lo apunta. */
  resaltar: (id: string | null) => void;
}

const ANCHO_PUERTO = 0.3;

/** Dibuja el hueco de un puerto: la forma que solo acepta su conector. */
function dibujarBoca(ctx: CanvasRenderingContext2D, forma: FormaConector, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2 - 22;
  const r = 78;

  ctx.fillStyle = "#0d1216";
  ctx.strokeStyle = "#7d8b95";
  ctx.lineWidth = 9;
  ctx.beginPath();

  if (forma === "cuadrado") {
    ctx.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
  } else if (forma === "circulo") {
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.92, cy + r * 0.66);
    ctx.lineTo(cx - r * 0.92, cy + r * 0.66);
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();
}

export function crearArmarioConectores(
  scene: Scene,
  x: number,
  z: number,
  giroY: number,
  puertos: PuertoNivel4[]
): ArmarioResult {
  const frente = frenteDe(giroY);
  const lado = ladoDe(giroY);

  const ANCHO = puertos.length * (ANCHO_PUERTO + 0.12) + 0.26;
  const ALTO = 1.5;
  const FONDO = 0.34;
  const Y_CENTRO = 0.95;

  const matCuerpo = new PBRMaterial("matArmarioConectores", scene);
  matCuerpo.albedoColor = new Color3(0.24, 0.28, 0.32);
  matCuerpo.roughness = 0.45;
  matCuerpo.metallic = 0.7;
  matCuerpo.albedoTexture = texturaMetalCepillado(scene);
  matCuerpo.microSurfaceTexture = texturaGrano(scene, 0.1);

  const cuerpo = MeshBuilder.CreateBox(
    "armarioConectores",
    { width: ANCHO, height: ALTO, depth: FONDO },
    scene
  );
  cuerpo.position.set(x, Y_CENTRO, z);
  cuerpo.rotation.y = giroY;
  cuerpo.material = matCuerpo;
  cuerpo.receiveShadows = true;
  cuerpo.isPickable = false;

  // Patas: el armario se apoya, no flota.
  [-1, 1].forEach((signo) => {
    const pata = MeshBuilder.CreateBox(
      `pataArmario_${signo}`,
      { width: 0.08, height: Y_CENTRO - ALTO / 2, depth: 0.08 },
      scene
    );
    const d = signo * (ANCHO / 2 - 0.08);
    pata.position.set(
      x + lado.x * d,
      (Y_CENTRO - ALTO / 2) / 2,
      z + lado.z * d
    );
    pata.rotation.y = giroY;
    pata.material = matCuerpo;
    pata.isPickable = false;
  });

  // Cartel del armario. Video 4.2 (1:32): letreros y carteles son control
  // visual tanto como el Andon.
  const matRotulo = materialPintado(scene, "matRotuloArmario", 768, 128, (ctx, w, h) => {
    ctx.fillStyle = "#182026";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(0, h - 9, w, 9);
    ctx.fillStyle = "#e8edf0";
    ctx.font = "bold 54px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TABLERO DE CONEXIONES", w / 2, h / 2 - 4);
  });

  const rotulo = MeshBuilder.CreateBox(
    "rotuloArmario",
    { width: ANCHO - 0.1, height: 0.16, depth: 0.014 },
    scene
  );
  rotulo.position.set(
    x + frente.x * (FONDO / 2 + 0.008),
    Y_CENTRO + ALTO / 2 - 0.16,
    z + frente.z * (FONDO / 2 + 0.008)
  );
  rotulo.rotation.y = giroY;
  rotulo.material = matRotulo;
  rotulo.isPickable = false;

  const matResalte = new PBRMaterial("matResaltePuerto", scene);
  matResalte.albedoColor = new Color3(0.15, 0.55, 0.32);
  matResalte.emissiveColor = new Color3(0.22, 0.75, 0.42);
  matResalte.roughness = 1;

  const marcos = new Map<string, Mesh>();
  const montados: PuertoMontado[] = [];

  // Distancias medidas desde el centro del armario hacia el jugador. Los
  // receptores quedan COPLANARES: un rayo cruza ese plano en un solo punto, así
  // que el cursor nunca puede apuntar a dos puertos a la vez.
  const CARA = FONDO / 2 + 0.008;
  const ENCHUFADO = FONDO / 2 + 0.09;
  const SOSTENIDO = FONDO / 2 + 0.24;
  const RECEPTOR = FONDO / 2 + 0.15;

  puertos.forEach((puerto) => {
    const d = puerto.desplazamiento;

    const matBoca = materialPintado(scene, `matBoca_${puerto.id}`, 256, 320, (ctx, w, h) => {
      ctx.fillStyle = "#333f47";
      ctx.fillRect(0, 0, w, h);

      dibujarBoca(ctx, puerto.forma, w, h);

      ctx.fillStyle = "#1a2126";
      ctx.fillRect(0, h - 58, w, 58);
      ctx.fillStyle = "#aab6bd";
      ctx.font = "bold 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(puerto.etiqueta, w / 2, h - 20);
    });

    const boca = MeshBuilder.CreateBox(
      `boca_${puerto.id}`,
      { width: ANCHO_PUERTO, height: ANCHO_PUERTO * 1.25, depth: 0.012 },
      scene
    );
    boca.position.set(x + lado.x * d + frente.x * CARA, Y_CENTRO, z + lado.z * d + frente.z * CARA);
    boca.rotation.y = giroY;
    boca.material = matBoca;
    boca.isPickable = false;

    const marco = MeshBuilder.CreateBox(
      `marcoPuerto_${puerto.id}`,
      { width: ANCHO_PUERTO + 0.05, height: ANCHO_PUERTO * 1.25 + 0.05, depth: 0.008 },
      scene
    );
    marco.position.set(
      x + lado.x * d + frente.x * (CARA - 0.004),
      Y_CENTRO,
      z + lado.z * d + frente.z * (CARA - 0.004)
    );
    marco.rotation.y = giroY;
    marco.material = matResalte;
    marco.isPickable = false;
    marco.isVisible = false;
    marcos.set(puerto.id, marco);

    // TRANSPARENTE, NO INVISIBLE: con isVisible = false Babylon descarta la
    // malla antes de comprobar si es pinchable y el rayo no la encuentra nunca.
    const receptor = MeshBuilder.CreateBox(
      `receptorPuerto_${puerto.id}`,
      { width: ANCHO_PUERTO + 0.1, height: ANCHO_PUERTO * 1.25 + 0.1, depth: 0.02 },
      scene
    );
    receptor.position.set(
      x + lado.x * d + frente.x * RECEPTOR,
      Y_CENTRO,
      z + lado.z * d + frente.z * RECEPTOR
    );
    receptor.rotation.y = giroY;
    receptor.visibility = 0;
    receptor.isPickable = true;

    montados.push({
      id: puerto.id,
      forma: puerto.forma,
      receptor,
      anclaje: new Vector3(
        x + lado.x * d + frente.x * ENCHUFADO,
        Y_CENTRO,
        z + lado.z * d + frente.z * ENCHUFADO
      ),
      sostenido: new Vector3(
        x + lado.x * d + frente.x * SOSTENIDO,
        Y_CENTRO,
        z + lado.z * d + frente.z * SOSTENIDO
      ),
      ocupado: false,
    });
  });

  const resaltar = (id: string | null): void => {
    marcos.forEach((marco, clave) => {
      marco.isVisible = clave === id;
    });
  };

  return { puertos: montados, resaltar };
}

// ---------------------------------------------------------------------------
// ESTACIÓN B — Zonas de piso (Andon)
// ---------------------------------------------------------------------------

export interface ZonaMontada {
  id: string;
  /** Lámina invisible a la que se apunta. Acepta cualquier plantilla. */
  receptor: Mesh;
  /** Dónde queda la plantilla al soltarla bien. */
  anclaje: Vector3;
  /** Dónde se sostiene mientras se apunta. */
  sostenido: Vector3;
  ancho: number;
  fondo: number;
  pintada: boolean;
}

export interface ZonasPisoResult {
  zonas: ZonaMontada[];
  resaltar: (id: string | null) => void;
  /** Parpadeo rojo del contorno, con chicharra. */
  avisarError: (id: string, alSonar?: () => void) => void;
  /** Pinta la zona de amarillo con su texto. Irreversible. */
  pintar: (id: string, texto: string) => void;
}

export function crearZonasPiso(scene: Scene, zonas: ZonaPisoNivel4[]): ZonasPisoResult {
  const marcos = new Map<string, Mesh>();
  const contornos = new Map<string, { mesh: Mesh; material: PBRMaterial; reposo: Color3 }>();
  const montadas: ZonaMontada[] = [];

  zonas.forEach((zona) => {
    const [cx, cz] = zona.centro;

    // Contorno punteado: dice que ahí FALTA algo, sin decir qué. El grosor de
    // la línea se dibuja en la textura y no con geometría, así que una zona de
    // 5 m y una de 1 m se ven con el mismo trazo.
    const proporcion = zona.ancho / zona.fondo;
    const anchoPx = Math.round(Math.min(1024, Math.max(256, 256 * proporcion)));

    const matContorno = materialPintado(
      scene,
      `matContornoZona_${zona.id}`,
      anchoPx,
      256,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(210, 200, 150, 0.10)";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "#c8bd8a";
        ctx.lineWidth = 10;
        ctx.setLineDash([34, 26]);
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(200, 189, 138, 0.85)";
        ctx.font = `bold ${Math.round(h / 6)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(zona.etiqueta, w / 2, h / 2);
      }
    );
    matContorno.emissiveColor = new Color3(0.12, 0.03, 0.03);

    const contorno = MeshBuilder.CreateGround(
      `contornoZona_${zona.id}`,
      { width: zona.ancho, height: zona.fondo },
      scene
    );
    contorno.position.set(cx, 0.014, cz);
    contorno.material = matContorno;
    contorno.isPickable = false;
    contornos.set(zona.id, {
      mesh: contorno,
      material: matContorno,
      reposo: new Color3(0.12, 0.03, 0.03),
    });

    const matResalte = new PBRMaterial(`matResalteZona_${zona.id}`, scene);
    matResalte.albedoColor = new Color3(0.15, 0.55, 0.32);
    matResalte.emissiveColor = new Color3(0.22, 0.75, 0.42);
    matResalte.roughness = 1;

    const marco = MeshBuilder.CreateGround(
      `marcoZona_${zona.id}`,
      { width: zona.ancho + 0.14, height: zona.fondo + 0.14 },
      scene
    );
    marco.position.set(cx, 0.008, cz);
    marco.material = matResalte;
    marco.isPickable = false;
    marco.isVisible = false;
    marcos.set(zona.id, marco);

    // Receptor horizontal, un palmo sobre el piso. Las zonas no se solapan en
    // planta, así que un rayo solo puede tocar una.
    const receptor = MeshBuilder.CreateBox(
      `receptorZona_${zona.id}`,
      { width: zona.ancho, height: 0.02, depth: zona.fondo },
      scene
    );
    receptor.position.set(cx, 0.1, cz);
    receptor.visibility = 0;
    receptor.isPickable = true;

    montadas.push({
      id: zona.id,
      receptor,
      anclaje: new Vector3(cx, 0.02, cz),
      sostenido: new Vector3(cx, 0.42, cz),
      ancho: zona.ancho,
      fondo: zona.fondo,
      pintada: false,
    });
  });

  const resaltar = (id: string | null): void => {
    marcos.forEach((marco, clave) => {
      marco.isVisible = clave === id;
    });
  };

  const avisarError = (id: string, alSonar?: () => void): void => {
    const contorno = contornos.get(id);
    if (!contorno) return;
    dispararAndon(scene, contorno.material, contorno.reposo, alSonar);
  };

  const pintar = (id: string, texto: string): void => {
    const contorno = contornos.get(id);
    const zona = zonas.find((z) => z.id === id);
    const montada = montadas.find((m) => m.id === id);
    if (!contorno || !zona || !montada) return;

    montada.pintada = true;
    contorno.reposo = new Color3(0.05, 0.04, 0.01);
    contorno.material.emissiveColor.copyFrom(contorno.reposo);

    const proporcion = zona.ancho / zona.fondo;
    const anchoPx = Math.round(Math.min(1024, Math.max(256, 256 * proporcion)));

    contorno.mesh.material = materialPintado(
      scene,
      `matZonaPintada_${id}`,
      anchoPx,
      256,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);

        // Franja perimetral amarilla, continua: es la señalización de caminos
        // del Video 4.2 (1:32) tal cual se ve en una planta.
        ctx.strokeStyle = "#e0b024";
        ctx.lineWidth = 26;
        ctx.strokeRect(13, 13, w - 26, h - 26);

        // Rayado diagonal en el borde: el detalle que hace que se lea como
        // pintura de seguridad y no como un rectángulo de color.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.strokeStyle = "rgba(30, 30, 30, 0.55)";
        ctx.lineWidth = 9;
        for (let i = -h; i < w + h; i += 34) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + h, h);
          ctx.stroke();
        }
        ctx.restore();

        // El interior se despeja para que el texto se lea.
        ctx.clearRect(30, 30, w - 60, h - 60);
        ctx.fillStyle = "rgba(224, 176, 36, 0.16)";
        ctx.fillRect(30, 30, w - 60, h - 60);

        ctx.fillStyle = "#f2d47a";
        let tamano = Math.round(h / 5);
        ctx.font = `bold ${tamano}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        while (ctx.measureText(texto).width > w - 90 && tamano > 16) {
          tamano -= 3;
          ctx.font = `bold ${tamano}px system-ui, sans-serif`;
        }
        ctx.fillText(texto, w / 2, h / 2);
      }
    );
  };

  return { zonas: montadas, resaltar, avisarError, pintar };
}

// ---------------------------------------------------------------------------
// ESTACIÓN C — Panel de interruptores y sus focos
// ---------------------------------------------------------------------------

export interface InterruptorMontado {
  id: string;
  receptor: Mesh;
  anclaje: Vector3;
  sostenido: Vector3;
  ocupado: boolean;
}

export interface PanelInterruptoresResult {
  interruptores: InterruptorMontado[];
  resaltar: (id: string | null) => void;
  /** Pinta la placa del interruptor del color elegido. No valida nada. */
  rotular: (id: string, color: ColorNivel4) => void;
}

export function crearPanelInterruptores(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  giroY: number,
  circuitos: CircuitoNivel4[],
  colores: ColorNivel4[]
): PanelInterruptoresResult {
  const frente = frenteDe(giroY);
  const lado = ladoDe(giroY);

  const ANCHO = circuitos.length * 0.44 + 0.2;
  const ALTO = 0.62;
  const FONDO = 0.12;

  const matPanel = new PBRMaterial("matPanelInterruptores", scene);
  matPanel.albedoColor = new Color3(0.2, 0.23, 0.26);
  matPanel.roughness = 0.5;
  matPanel.metallic = 0.55;
  matPanel.microSurfaceTexture = texturaGrano(scene, 0.09);

  const panel = MeshBuilder.CreateBox(
    "panelInterruptores",
    { width: ANCHO, height: ALTO, depth: FONDO },
    scene
  );
  panel.position.set(x, y, z);
  panel.rotation.y = giroY;
  panel.material = matPanel;
  panel.receiveShadows = true;
  panel.isPickable = false;

  // Poste hasta el piso: el panel está en medio del taller, no en una pared.
  const alturaPoste = y - ALTO / 2;
  const poste = MeshBuilder.CreateBox(
    "postePanelInterruptores",
    { width: 0.09, height: alturaPoste, depth: 0.09 },
    scene
  );
  poste.position.set(x, alturaPoste / 2, z);
  poste.rotation.y = giroY;
  poste.material = matPanel;
  poste.isPickable = false;

  const matResalte = new PBRMaterial("matResalteInterruptor", scene);
  matResalte.albedoColor = new Color3(0.15, 0.55, 0.32);
  matResalte.emissiveColor = new Color3(0.22, 0.75, 0.42);
  matResalte.roughness = 1;

  const CARA = FONDO / 2 + 0.008;
  const PUESTO = FONDO / 2 + 0.035;
  const RECEPTOR = FONDO / 2 + 0.13;
  const SOSTENIDO = FONDO / 2 + 0.2;

  const marcos = new Map<string, Mesh>();
  const placas = new Map<string, Mesh>();
  const montados: InterruptorMontado[] = [];

  /** Cara de la placa. Vacía al montar, con el color elegido al asignarlo. */
  const caraPlaca = (id: string, descripcion: string, color: ColorNivel4 | null): PBRMaterial =>
    materialPintado(scene, `matPlaca_${id}_${color?.id ?? "vacia"}`, 320, 256, (ctx, w, h) => {
      ctx.fillStyle = color ? color.hex : "#2b343a";
      ctx.fillRect(0, 0, w, h);

      // Palanca del interruptor, dibujada. Deja claro que la placa pertenece a
      // un interruptor y no es un cartel suelto.
      ctx.fillStyle = "#1b2126";
      ctx.fillRect(w / 2 - 34, 26, 68, 96);
      ctx.fillStyle = "#c6ccd0";
      ctx.fillRect(w / 2 - 24, 36, 48, 44);

      ctx.fillStyle = color ? "rgba(0,0,0,0.28)" : "#20272c";
      ctx.fillRect(0, h - 96, w, 96);

      ctx.fillStyle = color ? "#ffffff" : "#7d8b95";
      ctx.textAlign = "center";
      let tamano = 26;
      ctx.font = `bold ${tamano}px system-ui, sans-serif`;

      // El texto se parte en dos renglones si hace falta: "Circuito de la zona
      // de pallets" no entra de una en 320 px.
      const palabras = descripcion.split(" ");
      const lineas: string[] = [];
      let actual = "";
      palabras.forEach((palabra) => {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > w - 26 && actual) {
          lineas.push(actual);
          actual = palabra;
        } else {
          actual = prueba;
        }
      });
      if (actual) lineas.push(actual);

      const visibles = lineas.slice(0, 3);
      visibles.forEach((linea, i) => {
        ctx.fillText(linea, w / 2, h - 70 + i * 30);
      });
    });

  circuitos.forEach((circuito) => {
    const d = circuito.desplazamiento;

    const placa = MeshBuilder.CreateBox(
      `placa_${circuito.id}`,
      { width: 0.34, height: 0.4, depth: 0.014 },
      scene
    );
    placa.position.set(x + lado.x * d + frente.x * CARA, y, z + lado.z * d + frente.z * CARA);
    placa.rotation.y = giroY;
    placa.material = caraPlaca(circuito.id, circuito.descripcion, null);
    placa.isPickable = false;
    placas.set(circuito.id, placa);

    const marco = MeshBuilder.CreateBox(
      `marcoInterruptor_${circuito.id}`,
      { width: 0.39, height: 0.45, depth: 0.008 },
      scene
    );
    marco.position.set(
      x + lado.x * d + frente.x * (CARA - 0.004),
      y,
      z + lado.z * d + frente.z * (CARA - 0.004)
    );
    marco.rotation.y = giroY;
    marco.material = matResalte;
    marco.isPickable = false;
    marco.isVisible = false;
    marcos.set(circuito.id, marco);

    const receptor = MeshBuilder.CreateBox(
      `receptorInterruptor_${circuito.id}`,
      { width: 0.4, height: 0.46, depth: 0.02 },
      scene
    );
    receptor.position.set(
      x + lado.x * d + frente.x * RECEPTOR,
      y,
      z + lado.z * d + frente.z * RECEPTOR
    );
    receptor.rotation.y = giroY;
    receptor.visibility = 0;
    receptor.isPickable = true;

    montados.push({
      id: circuito.id,
      receptor,
      anclaje: new Vector3(
        x + lado.x * d + frente.x * PUESTO,
        y,
        z + lado.z * d + frente.z * PUESTO
      ),
      sostenido: new Vector3(
        x + lado.x * d + frente.x * SOSTENIDO,
        y,
        z + lado.z * d + frente.z * SOSTENIDO
      ),
      ocupado: false,
    });

    // --- El foco de este circuito -------------------------------------------
    //
    // Video 4.2 (5:29): "los focos pertenecientes a dichos interruptores están
    // señalizados con el mismo color". El foco YA viene con su color puesto:
    // es el dato que el jugador tiene que ir a leer al otro extremo del taller
    // antes de decidir qué ficha pone en el interruptor. Sin esto la estación
    // sería adivinar; con esto es inspeccionar.
    const color = colores.find((c) => c.id === circuito.colorCorrectoId);
    const [lx, lz] = circuito.lampara;
    crearFocoColgado(scene, circuito.id, lx, lz, color?.hex ?? "#ffffff");
  });

  const resaltar = (id: string | null): void => {
    marcos.forEach((marco, clave) => {
      marco.isVisible = clave === id;
    });
  };

  const rotular = (id: string, color: ColorNivel4): void => {
    const placa = placas.get(id);
    const circuito = circuitos.find((c) => c.id === id);
    if (!placa || !circuito) return;
    placa.material = caraPlaca(circuito.id, circuito.descripcion, color);
  };

  return { interruptores: montados, resaltar, rotular };
}

/** Convierte "#rrggbb" en Color3. */
function desdeHex(hex: string): Color3 {
  return Color3.FromHexString(hex.startsWith("#") ? hex : `#${hex}`);
}

/**
 * Foco colgado del techo, con la pantalla del color de su circuito.
 *
 * Cuelga alto y encendido desde el primer cuadro. Es una pista de lectura, no
 * un objetivo: no se toca, se mira.
 */
function crearFocoColgado(scene: Scene, id: string, x: number, z: number, hex: string): void {
  const ALTURA = 2.85;
  const color = desdeHex(hex);

  const matCable = new PBRMaterial(`matCableFoco_${id}`, scene);
  matCable.albedoColor = new Color3(0.12, 0.12, 0.13);
  matCable.roughness = 0.8;

  const cable = MeshBuilder.CreateCylinder(
    `cableFoco_${id}`,
    { diameter: 0.02, height: 1.0, tessellation: 6 },
    scene
  );
  cable.position.set(x, ALTURA + 0.5, z);
  cable.material = matCable;
  cable.isPickable = false;

  const matPantalla = new PBRMaterial(`matPantallaFoco_${id}`, scene);
  matPantalla.albedoColor = color;
  matPantalla.emissiveColor = color.scale(0.55);
  matPantalla.roughness = 0.55;
  matPantalla.metallic = 0.2;

  const pantalla = MeshBuilder.CreateCylinder(
    `pantallaFoco_${id}`,
    { diameterTop: 0.12, diameterBottom: 0.46, height: 0.28, tessellation: 22 },
    scene
  );
  pantalla.position.set(x, ALTURA, z);
  pantalla.material = matPantalla;
  pantalla.isPickable = false;

  const matBombilla = new PBRMaterial(`matBombillaFoco_${id}`, scene);
  matBombilla.albedoColor = color;
  matBombilla.emissiveColor = color.scale(1.6);
  matBombilla.roughness = 1;

  const bombilla = MeshBuilder.CreateSphere(
    `bombillaFoco_${id}`,
    { diameter: 0.17, segments: 12 },
    scene
  );
  bombilla.position.set(x, ALTURA - 0.13, z);
  bombilla.material = matBombilla;
  bombilla.isPickable = false;

  // Luz real, de alcance corto y tenue: tiñe el suelo de debajo lo justo para
  // que se vea a qué zona pertenece cada foco, sin alterar la iluminación del
  // galpón ni competir con los focos del garaje.
  const luz = new PointLight(`luzFoco_${id}`, new Vector3(x, ALTURA - 0.3, z), scene);
  luz.diffuse = color;
  luz.intensity = 0.55;
  luz.range = 3.4;
}