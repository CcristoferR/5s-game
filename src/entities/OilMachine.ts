import { Scene, MeshBuilder, PBRMaterial, Color3, TransformNode } from "@babylonjs/core";
import { texturaGrano, texturaMetalCepillado, normalMetalCepillado } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

export function crearMaquinaConFuga(scene: Scene, x: number, z: number): TransformNode {
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
    listón.position.set(0.15, 0.95 + i * 0.06, 0.36);
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

  const tuberia = MeshBuilder.CreateCylinder("tuberia", { diameter: 0.12, height: 0.6 }, scene);
  tuberia.rotation.z = Math.PI / 2;
  tuberia.position.set(-0.5, 0.4, 0);
  tuberia.parent = root;
  tuberia.material = matTuberia;

  const matFuga = new PBRMaterial("matFugaJunta", scene);
  matFuga.albedoColor = new Color3(0.08, 0.06, 0.04);
  matFuga.roughness = 0.15;
  matFuga.microSurfaceTexture = texturaGrano(scene, 0.07); // aceite: húmedo, brilloso

  const junta = MeshBuilder.CreateSphere("juntaFuga", { diameter: 0.14 }, scene);
  junta.position.set(-0.8, 0.4, 0);
  junta.parent = root;
  junta.material = matFuga;

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
  tablero.position.set(-0.1, 0.98, 0.36);
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
    ctx.fillText("REVISAR", w / 2, 52);
    ctx.fillText("JUNTA", w / 2, 92);
  });

  const aviso = MeshBuilder.CreateBox("avisoMaquina", { width: 0.24, height: 0.12, depth: 0.012 }, scene);
  aviso.position.set(-0.46, 0.62, 0.36);
  aviso.parent = root;
  aviso.material = matAviso;

  const matGoteo = new PBRMaterial("matGoteo", scene);
  matGoteo.albedoColor = new Color3(0.1, 0.08, 0.05);
  matGoteo.roughness = 0.1;
  matGoteo.microSurfaceTexture = texturaGrano(scene, 0.07);
  matGoteo.alpha = 0.9;

  const goteo = MeshBuilder.CreateCylinder("goteoFuga", { diameterTop: 0.02, diameterBottom: 0.06, height: 0.35 }, scene);
  goteo.position.set(-0.8, 0.22, 0);
  goteo.parent = root;
  goteo.material = matGoteo;

  return root;
}