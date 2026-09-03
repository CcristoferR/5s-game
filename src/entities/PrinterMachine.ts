import { Scene, MeshBuilder, PBRMaterial, Color3, TransformNode, Mesh } from "@babylonjs/core";
import { texturaGrano } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

// ---------------------------------------------------------------------------
// Impresora con cartucho de toner danado
// ---------------------------------------------------------------------------
//
// Es la segunda fuente de investigacion del Nivel 3: el polvo negro del suelo
// sale de aca, no de la maquina de aceite. Ese vinculo tiene que poder
// deducirse MIRANDO, sin leer nada.
//
// Antes eran cinco cajas: un cuerpo gris, una bandeja plana, una ranura oscura
// y una luz que parpadea. Como objeto no decia que fuera una impresora, y como
// pista no decia que el problema fuera el toner — la ranura negra podia ser
// cualquier hueco. Al lado de la maquina hidraulica, que ya tiene tablero,
// manometro y motor, el contraste saltaba a la vista.
//
// Lo que se agrego, y por que cada cosa:
//
//   - Tapa superior con junta y bandeja de salida con hojas apiladas: es la
//     silueta que hace reconocible una impresora a primera vista.
//   - Cajon de papel abajo, entreabierto: da profundidad y explica el volumen.
//   - Tablero con pantalla que dice TONER y luces de estado: convierte la luz
//     roja suelta en un diagnostico legible.
//   - Compuerta del toner abierta con el cartucho a la vista y polvo en el
//     borde: es LA pista. Une la impresora con las manchas del piso sin texto.
//   - Patas de goma: la apoyan en la mesa en vez de dejarla flotando.

export function crearImpresoraConToner(scene: Scene, x: number, z: number): TransformNode {
  const root = new TransformNode("impresoraRoot", scene);
  root.position.set(x, 0, z);

  const cuerpoClaro = new PBRMaterial("matImpresoraCuerpo", scene);
  cuerpoClaro.albedoColor = new Color3(0.82, 0.82, 0.84);
  cuerpoClaro.roughness = 0.4;
  cuerpoClaro.microSurfaceTexture = texturaGrano(scene, 0.07);
  cuerpoClaro.metallic = 0.1;

  // Gris mas oscuro para tapa, cajon y compuerta. Las impresoras reales usan
  // dos tonos, y aca ademas separa las piezas moviles del cuerpo fijo.
  const cuerpoOscuro = new PBRMaterial("matImpresoraOscuro", scene);
  cuerpoOscuro.albedoColor = new Color3(0.3, 0.32, 0.34);
  cuerpoOscuro.roughness = 0.55;
  cuerpoOscuro.microSurfaceTexture = texturaGrano(scene, 0.07);
  cuerpoOscuro.metallic = 0.15;

  const negro = new PBRMaterial("matImpresoraNegro", scene);
  negro.albedoColor = new Color3(0.07, 0.07, 0.075);
  negro.roughness = 0.5;
  negro.microSurfaceTexture = texturaGrano(scene, 0.09);

  const parte = (malla: Mesh, material: PBRMaterial): Mesh => {
    malla.parent = root;
    malla.material = material;
    malla.receiveShadows = true;
    return malla;
  };

  // --- Cuerpo ---
  parte(
    MeshBuilder.CreateBox("impresoraCuerpo", { width: 0.55, height: 0.3, depth: 0.5 }, scene),
    cuerpoClaro
  ).position.y = 0.2;

  // Cajon de papel, apenas afuera: la linea horizontal que interrumpe el
  // bloque es lo que evita que se lea como una caja maciza.
  parte(
    MeshBuilder.CreateBox("impresoraCajon", { width: 0.53, height: 0.09, depth: 0.5 }, scene),
    cuerpoOscuro
  ).position.set(0, 0.095, 0.02);

  const tirador = parte(
    MeshBuilder.CreateBox("impresoraTirador", { width: 0.16, height: 0.02, depth: 0.02 }, scene),
    negro
  );
  tirador.position.set(0, 0.095, -0.26);

  // --- Tapa superior ---
  const tapa = parte(
    MeshBuilder.CreateBox("impresoraTapa", { width: 0.56, height: 0.07, depth: 0.51 }, scene),
    cuerpoOscuro
  );
  tapa.position.y = 0.385;
  // Inclinada al minimo: una tapa perfectamente cerrada se funde con el
  // cuerpo, y la sombra de la junta es lo que la delata como pieza aparte.
  tapa.rotation.x = -0.012;

  // --- Bandeja de salida con hojas ---
  const bandejaMat = new PBRMaterial("matImpresoraBandeja", scene);
  bandejaMat.albedoColor = new Color3(0.72, 0.73, 0.74);
  bandejaMat.roughness = 0.65;
  bandejaMat.microSurfaceTexture = texturaGrano(scene, 0.07);

  const bandeja = parte(
    MeshBuilder.CreateBox("impresoraBandeja", { width: 0.42, height: 0.015, depth: 0.3 }, scene),
    bandejaMat
  );
  bandeja.position.set(0, 0.345, -0.06);
  bandeja.rotation.x = 0.08;

  const papel = new PBRMaterial("matImpresoraPapel", scene);
  papel.albedoColor = new Color3(0.95, 0.95, 0.93);
  papel.roughness = 0.85;
  papel.microSurfaceTexture = texturaGrano(scene, 0.05);

  // Tres hojas apiladas y desalineadas. La desalineacion importa: una pila
  // perfecta se lee como un bloque solido, no como papel.
  for (let i = 0; i < 3; i++) {
    const hoja = parte(
      MeshBuilder.CreateBox(`impresoraHoja_${i}`, { width: 0.36, height: 0.004, depth: 0.26 }, scene),
      papel
    );
    hoja.position.set(-0.008 + i * 0.007, 0.357 + i * 0.005, -0.06 + i * 0.004);
    hoja.rotation.x = 0.08;
    hoja.rotation.y = (i - 1) * 0.012;
  }

  // --- Tablero de control ---
  //
  // La luz roja sola decia "algo pasa". La pantalla dice QUE pasa, y eso es lo
  // que convierte la impresora en una pista y no en un adorno con una luz.
  const matTablero = materialPintado(scene, "matImpresoraTablero", 512, 192, (ctx, w, h) => {
    ctx.fillStyle = "#20262b";
    ctx.fillRect(0, 0, w, h);

    // Pantalla
    ctx.fillStyle = "#0f1a14";
    ctx.fillRect(24, 26, 268, 140);
    ctx.strokeStyle = "#3b464e";
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 26, 268, 140);

    ctx.fillStyle = "#8ce0a4";
    ctx.font = "bold 40px ui-monospace, monospace";
    ctx.fillText("TONER", 48, 84);
    ctx.font = "600 30px ui-monospace, monospace";
    ctx.fillStyle = "#d8a25f";
    ctx.fillText("REVISAR", 48, 132);

    // Botones fisicos
    ctx.fillStyle = "#39424a";
    [340, 410, 480].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, 62, 26, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#8f9aa2";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COPIA", 340, 128);
    ctx.fillText("STOP", 410, 128);
    ctx.fillText("OK", 480, 128);
  });

  const tablero = parte(
    MeshBuilder.CreateBox("impresoraTablero", { width: 0.3, height: 0.11, depth: 0.012 }, scene),
    matTablero
  );
  tablero.position.set(-0.1, 0.27, -0.256);

  // --- Compuerta del toner, abierta ---
  //
  // Esta es la pista. Abierta y hacia adelante interrumpe la silueta, asi que
  // el ojo va ahi antes que a ninguna otra parte de la impresora.
  const compuerta = parte(
    MeshBuilder.CreateBox("impresoraCompuerta", { width: 0.26, height: 0.19, depth: 0.014 }, scene),
    cuerpoOscuro
  );
  compuerta.position.set(0.14, 0.22, -0.3);
  compuerta.rotation.x = -0.75;

  // Hueco negro detras: sin el, la compuerta abierta deja ver el cuerpo claro
  // y no parece que hubiera nada adentro.
  const hueco = parte(
    MeshBuilder.CreateBox("impresoraHueco", { width: 0.24, height: 0.17, depth: 0.02 }, scene),
    negro
  );
  hueco.position.set(0.14, 0.24, -0.248);

  // Cartucho asomando, torcido: puesto derecho parece instalado y correcto.
  const cartucho = parte(
    MeshBuilder.CreateBox("impresoraCartucho", { width: 0.2, height: 0.075, depth: 0.13 }, scene),
    negro
  );
  cartucho.position.set(0.14, 0.235, -0.235);
  cartucho.rotation.z = 0.07;

  const asaCartucho = parte(
    MeshBuilder.CreateBox("impresoraAsaCartucho", { width: 0.11, height: 0.016, depth: 0.02 }, scene),
    cuerpoOscuro
  );
  asaCartucho.position.set(0.14, 0.28, -0.28);
  asaCartucho.rotation.z = 0.07;

  // Polvo de toner en el borde inferior de la compuerta. Es el detalle que
  // cierra el razonamiento: el mismo negro mate que las manchas del piso,
  // saliendo justo de aca.
  const polvo = new PBRMaterial("matImpresoraPolvo", scene);
  polvo.albedoColor = new Color3(0.05, 0.05, 0.055);
  polvo.roughness = 0.95;
  polvo.metallic = 0;

  for (let i = 0; i < 5; i++) {
    const grano = parte(
      MeshBuilder.CreateBox(`impresoraPolvo_${i}`, { width: 0.03 + Math.random() * 0.04, height: 0.004, depth: 0.02 }, scene),
      polvo
    );
    grano.position.set(0.05 + Math.random() * 0.18, 0.152, -0.29 - Math.random() * 0.05);
    grano.rotation.y = Math.random() * Math.PI;
  }

  // --- Luz de estado ---
  const matLuz = new PBRMaterial("matImpresoraLuz", scene);
  matLuz.albedoColor = new Color3(0.8, 0.15, 0.1);
  matLuz.microSurfaceTexture = texturaGrano(scene, 0.1);
  matLuz.emissiveColor = new Color3(0.9, 0.15, 0.1);

  const luz = parte(
    MeshBuilder.CreateSphere("impresoraLuzEstado", { diameter: 0.028 }, scene),
    matLuz
  );
  luz.position.set(0.14, 0.315, -0.256);

  // --- Patas ---
  const goma = new PBRMaterial("matImpresoraPata", scene);
  goma.albedoColor = new Color3(0.12, 0.12, 0.13);
  goma.roughness = 0.9;

  const patas: Array<[number, number]> = [
    [-0.22, -0.19],
    [0.22, -0.19],
    [-0.22, 0.19],
    [0.22, 0.19],
  ];
  patas.forEach(([px, pz], i) => {
    const pata = parte(
      MeshBuilder.CreateCylinder(`impresoraPata_${i}`, { diameter: 0.045, height: 0.05, tessellation: 8 }, scene),
      goma
    );
    pata.position.set(px, 0.025, pz);
  });

  let tiempo = 0;
  scene.onBeforeRenderObservable.add(() => {
    tiempo += scene.getEngine().getDeltaTime() / 1000;
    const parpadeo = (Math.sin(tiempo * 4) + 1) / 2;
    matLuz.emissiveColor = new Color3(0.9 * parpadeo, 0.1 * parpadeo, 0.08 * parpadeo);
  });

  return root;
}