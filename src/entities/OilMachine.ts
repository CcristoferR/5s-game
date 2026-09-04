import { Scene, MeshBuilder, PBRMaterial, Color3, TransformNode, Mesh, Vector3 } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado, normalMetalCepillado } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

export interface MaquinaConFuga {
  root: TransformNode;
  /** La junta que pierde. Es lo que hay que pinchar para sellar. */
  junta: Mesh;
  /** De dónde caen las gotas, en coordenadas del mundo. */
  puntoFuga: Vector3;
  /** Elimina la fuente: corta el goteo y apaga el piloto de falla. */
  sellar: () => void;
  estaSellada: () => boolean;
}

// ---------------------------------------------------------------------------
// ORIENTACIÓN — dónde está el frente y dónde el dorso
// ---------------------------------------------------------------------------
//
// La cámara del juego observa desde Z NEGATIVO hacia +Z. O sea que la cara
// visible de cualquier mueble es la de -Z.
//
// El tablero de control, la rejilla y el cartel de aviso estaban todos en
// z = +0.36: el dorso. La máquina le mostraba al jugador una caja gris lisa y
// escondía contra la pared el manómetro, las luces y el cartel — justo lo que
// la hace legible como equipo averiado. Ahora van al frente.
//
// Y la junta que pierde hace el camino inverso: se va AL DORSO. Es deliberado.
// Video 3.4 (0:41): la limpieza se hace "con el objetivo final de poder
// realizar una inspección". Si la fuga se ve desde el sitio donde uno ya está
// parado, no hay inspección: hay un botón. Desde el frente se ven las señales
// —el piloto de falla parpadeando y el cartel que manda mirar al dorso— y para
// encontrar la causa hay que rodear el equipo.
export function crearMaquinaConFuga(scene: Scene, x: number, z: number): MaquinaConFuga {
  const root = new TransformNode("maquinaRoot", scene);
  root.position.set(x, 0, z);

  const matCuerpo = new PBRMaterial("matMaquinaCuerpo", scene);
  matCuerpo.albedoColor = new Color3(0.25, 0.27, 0.29);
  matCuerpo.roughness = 0.4;
  matCuerpo.metallic = 0.75;
  matCuerpo.albedoTexture = texturaMetalCepillado(scene);
  matCuerpo.bumpTexture = normalMetalCepillado(scene);
  matCuerpo.invertNormalMapY = true;
  matCuerpo.microSurfaceTexture = texturaGrano(scene, 0.14); // metal industrial: brillo real, no plástico

  const cuerpo = MeshBuilder.CreateBox("maquinaCuerpo", { width: 0.9, height: 1.3, depth: 0.7 }, scene);
  cuerpo.position.y = 0.65;
  cuerpo.parent = root;
  cuerpo.material = matCuerpo;
  cuerpo.receiveShadows = true;

  // Rejilla de ventilación: varias tiras horizontales — el detalle que
  // hace que se lea como maquinaria industrial real, no una caja lisa.
  const matRejilla = new PBRMaterial("matRejillaMaquina", scene);
  matRejilla.albedoColor = new Color3(0.12, 0.12, 0.13);
  matRejilla.roughness = 0.5;
  matRejilla.metallic = 0.6;
  matRejilla.albedoTexture = texturaMetalCepillado(scene);
  matRejilla.bumpTexture = normalMetalCepillado(scene);
  matRejilla.invertNormalMapY = true;
  matRejilla.microSurfaceTexture = texturaGrano(scene, 0.14);

  for (let i = 0; i < 4; i++) {
    const listón = MeshBuilder.CreateBox(`rejilla_${i}`, { width: 0.5, height: 0.03, depth: 0.02 }, scene);
    listón.position.set(0.15, 0.95 + i * 0.06, -0.36);
    listón.parent = root;
    listón.material = matRejilla;
  }

  const matTuberia = new PBRMaterial("matTuberia", scene);
  matTuberia.albedoColor = new Color3(0.42, 0.44, 0.46);
  matTuberia.roughness = 0.3;
  matTuberia.metallic = 0.8;
  matTuberia.albedoTexture = texturaMetalCepillado(scene);
  matTuberia.bumpTexture = normalMetalCepillado(scene);
  matTuberia.invertNormalMapY = true;
  matTuberia.microSurfaceTexture = texturaGrano(scene, 0.14);

  // Sale por detrás, no por el costado: es el tramo que hay que seguir para
  // llegar a la junta.
  const tuberia = MeshBuilder.CreateCylinder("tuberia", { diameter: 0.12, height: 0.62 }, scene);
  tuberia.rotation.x = Math.PI / 2;
  tuberia.position.set(0.28, 0.45, 0.55);
  tuberia.parent = root;
  tuberia.material = matTuberia;

  const matFuga = new PBRMaterial("matFugaJunta", scene);
  matFuga.albedoColor = new Color3(0.08, 0.06, 0.04);
  matFuga.roughness = 0.15;
  matFuga.microSurfaceTexture = texturaGrano(scene, 0.07); // aceite: húmedo, brilloso

  const junta = MeshBuilder.CreateSphere("juntaFuga", { diameter: 0.17 }, scene);
  junta.position.set(0.28, 0.45, 0.9);
  junta.parent = root;
  junta.material = matFuga;
  // Pinchable: es el único punto del equipo sobre el que se puede actuar.
  junta.isPickable = true;

  // --- Lo que la vuelve reconocible como maquina ---
  //
  // El cuerpo era una caja lisa con rejilla. Una caja gris no dice nada: el
  // jugador entiende que ahi pasa algo solo porque hay una mancha debajo.
  // Un tablero con manometro y luces, un motor arriba y una base atornillada
  // la convierten en equipo industrial de un vistazo, que es lo que hace
  // creible la fuga.

  // Tablero de control sobre la cara frontal.
  const matTablero = materialPintado(scene, "matTableroMaquina", 512, 384, (ctx, w, h) => {
    ctx.fillStyle = "#1f262b";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#3c474e";
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Manometro: caratula, marcas y aguja pasada de la zona verde. La aguja
    // en rojo es coherente con la fuga — el equipo esta trabajando mal.
    const cx = 150;
    const cy = 150;
    ctx.fillStyle = "#e8e6df";
    ctx.beginPath();
    ctx.arc(cx, cy, 84, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2a3138";
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.strokeStyle = "#3f8f52";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(cx, cy, 66, Math.PI * 0.78, Math.PI * 1.55);
    ctx.stroke();

    ctx.strokeStyle = "#b03a2e";
    ctx.beginPath();
    ctx.arc(cx, cy, 66, Math.PI * 1.55, Math.PI * 2.16);
    ctx.stroke();

    ctx.strokeStyle = "#1c2226";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 62, cy - 30);
    ctx.stroke();

    ctx.fillStyle = "#1c2226";
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8d99a1";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BAR", cx, cy + 58);

    // Luces indicadoras.
    const luces: Array<[string, string]> = [
      ["#4caf50", "MARCHA"],
      ["#d4a017", "PRESI\u00d3N"],
      ["#c0392b", "FALLA"],
    ];
    luces.forEach(([color, rotulo], i) => {
      const ly = 78 + i * 92;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(310, ly, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(303, ly - 7, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#aab6bd";
      ctx.font = "600 24px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(rotulo, 346, ly + 9);
    });

    ctx.fillStyle = "#6f7c84";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UNIDAD HIDR\u00c1ULICA", w / 2, h - 34);
  });

  const tablero = MeshBuilder.CreateBox("tableroMaquina", { width: 0.62, height: 0.46, depth: 0.03 }, scene);
  tablero.position.set(-0.1, 0.98, -0.36);
  tablero.parent = root;
  tablero.material = matTablero;

  // Motor sobre el cuerpo, con aletas de refrigeracion.
  const motor = MeshBuilder.CreateCylinder("motorMaquina", { diameter: 0.34, height: 0.5, tessellation: 20 }, scene);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.05, 1.45, 0);
  motor.parent = root;
  motor.material = matCuerpo;

  for (let i = 0; i < 7; i++) {
    const aleta = MeshBuilder.CreateCylinder(`aletaMotor_${i}`, { diameter: 0.38, height: 0.018, tessellation: 20 }, scene);
    aleta.rotation.z = Math.PI / 2;
    aleta.position.set(-0.13 + i * 0.045, 1.45, 0);
    aleta.parent = root;
    aleta.material = matRejilla;
  }

  // Base y pernos: la maquina se apoya en el piso, no flota sobre el.
  const base = MeshBuilder.CreateBox("baseMaquina", { width: 1.02, height: 0.08, depth: 0.82 }, scene);
  base.position.y = 0.04;
  base.parent = root;
  base.material = matRejilla;
  base.receiveShadows = true;

  const pernos: Array<[number, number]> = [
    [-0.42, -0.32],
    [0.42, -0.32],
    [-0.42, 0.32],
    [0.42, 0.32],
  ];
  pernos.forEach(([px, pz], i) => {
    const perno = MeshBuilder.CreateCylinder(`pernoMaquina_${i}`, { diameter: 0.07, height: 0.04, tessellation: 6 }, scene);
    perno.position.set(px, 0.09, pz);
    perno.parent = root;
    perno.material = matTuberia;
  });

  // Cartel de advertencia junto a la junta que pierde: es la senal que en un
  // taller real indica donde mirar.
  const matAviso = materialPintado(scene, "matAvisoMaquina", 256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#d8b026";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("REVISAR JUNTA", w / 2, 52);
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("AL DORSO \u21bb", w / 2, 96);
  });

  const aviso = MeshBuilder.CreateBox("avisoMaquina", { width: 0.3, height: 0.15, depth: 0.012 }, scene);
  aviso.position.set(-0.46, 0.62, -0.37);
  aviso.parent = root;
  aviso.material = matAviso;

  const matGoteo = new PBRMaterial("matGoteo", scene);
  matGoteo.albedoColor = new Color3(0.1, 0.08, 0.05);
  matGoteo.roughness = 0.1;
  matGoteo.microSurfaceTexture = texturaGrano(scene, 0.07);
  matGoteo.alpha = 0.9;

  const goteo = MeshBuilder.CreateCylinder("goteoFuga", { diameterTop: 0.02, diameterBottom: 0.07, height: 0.4 }, scene);
  goteo.position.set(0.28, 0.22, 0.9);
  goteo.parent = root;
  goteo.material = matGoteo;
  goteo.isPickable = false;

  // --- Piloto de falla, en la cara frontal --------------------------------
  //
  // La luz "FALLA" del tablero esta pintada en la textura, asi que no puede
  // parpadear sin repintar el lienzo en cada cuadro. Este piloto es una pieza
  // aparte por eso: late en rojo mientras la fuga sigue viva y queda en verde
  // fijo al sellarla. Es la unica pista que se ve desde donde el jugador
  // arranca, y la que lo manda a rodear el equipo.
  const matPiloto = new PBRMaterial("matPilotoFalla", scene);
  matPiloto.albedoColor = new Color3(0.5, 0.08, 0.06);
  matPiloto.emissiveColor = new Color3(0.8, 0.1, 0.08);
  matPiloto.roughness = 0.25;

  const piloto = MeshBuilder.CreateSphere("pilotoFallaMaquina", { diameter: 0.11, segments: 12 }, scene);
  piloto.position.set(0.3, 1.16, -0.37);
  piloto.parent = root;
  piloto.material = matPiloto;
  piloto.isPickable = false;

  let sellada = false;

  const latido = scene.onBeforeRenderObservable.add(() => {
    if (piloto.isDisposed()) {
      scene.onBeforeRenderObservable.remove(latido);
      return;
    }
    if (sellada) return;
    // Latido lento. Una luz que parpadea rapido se lee como error de render;
    // una que respira se lee como equipo encendido y averiado.
    const pulso = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 420));
    matPiloto.emissiveColor.set(pulso, pulso * 0.12, pulso * 0.1);
  });

  const sellar = (): void => {
    if (sellada) return;
    sellada = true;

    // El goteo se corta y la junta deja de estar aceitosa.
    goteo.isVisible = false;
    matFuga.albedoColor = new Color3(0.44, 0.46, 0.48);
    matFuga.roughness = 0.35;
    matFuga.metallic = 0.8;

    // Abrazadera nueva sobre la junta: la reparacion tiene que VERSE, o el
    // jugador no sabe si el clic hizo algo.
    const abrazadera = MeshBuilder.CreateTorus(
      "abrazaderaJunta",
      { diameter: 0.22, thickness: 0.038, tessellation: 18 },
      scene
    );
    abrazadera.rotation.x = Math.PI / 2;
    abrazadera.position.copyFrom(junta.position);
    abrazadera.parent = root;
    abrazadera.material = matTuberia;
    abrazadera.isPickable = false;

    junta.isPickable = false;

    matPiloto.albedoColor = new Color3(0.1, 0.4, 0.16);
    matPiloto.emissiveColor = new Color3(0.16, 0.7, 0.26);
  };

  return {
    root,
    junta,
    puntoFuga: new Vector3(x + 0.28, 0.24, z + 0.9),
    sellar,
    estaSellada: () => sellada,
  };
}