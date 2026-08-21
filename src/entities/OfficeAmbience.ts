import { Scene, MeshBuilder, PBRMaterial, Color3, Texture, PointLight, Vector3 } from "@babylonjs/core";

// ---------------------------------------------------------------------------
// Texturas procedurales (canvas 2D, igual técnica que ya usa Certificate.ts)
// ---------------------------------------------------------------------------
//
// Nada de esto es lógica de juego: son solo generadores de imagen que
// reemplazan colores planos por superficies con variación sutil, para que
// respondan mejor a las luces/SSAO/bloom que ya arma SceneManager en vez
// de verse como un color sólido sin volumen. Se generan una sola vez, al
// cargar el ambiente, y se comparten entre las mallas que las usan.

function clamp255(valor: number): number {
  return Math.max(0, Math.min(255, valor));
}

// Superficie pintada (paredes, cielo raso, marco de cuadro): rompe la
// monotonía de un color plano con ruido finísimo + un sombreado apenas
// perceptible hacia abajo — se lee como imperfección natural de la
// pintura, no como "una textura". anisotropicFilteringLevel + el tiling
// (uScale/vScale, definido por quien la usa) es lo que evita que se vea
// borrosa en paredes grandes vistas de cerca.
function crearTexturaPintura(scene: Scene, nombre: string, colorBase: [number, number, number]): Texture {
  const tam = 512;
  const canvas = document.createElement("canvas");
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = colorBase;

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, tam, tam);

  const datos = ctx.getImageData(0, 0, tam, tam);
  for (let i = 0; i < datos.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    datos.data[i] = clamp255(datos.data[i] + n);
    datos.data[i + 1] = clamp255(datos.data[i + 1] + n);
    datos.data[i + 2] = clamp255(datos.data[i + 2] + n);
  }
  ctx.putImageData(datos, 0, 0);

  const sombra = ctx.createLinearGradient(0, 0, 0, tam);
  sombra.addColorStop(0, "rgba(0,0,0,0)");
  sombra.addColorStop(1, "rgba(0,0,0,0.07)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, tam, tam);

  const textura = new Texture(canvas.toDataURL("image/png"), scene);
  textura.name = nombre;
  textura.wrapU = Texture.WRAP_ADDRESSMODE;
  textura.wrapV = Texture.WRAP_ADDRESSMODE;
  textura.anisotropicFilteringLevel = 8;
  return textura;
}

// Cielo del "afuera" que se ve por la ventana: gradiente + un par de
// nubes suaves. Antes era un color plano emissivo — con esto la ventana
// deja de leerse como un rectángulo celeste y pasa a leerse como vista.
function crearTexturaCielo(scene: Scene): Texture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, "#9fc0dc");
  cielo.addColorStop(0.55, "#cfe1ee");
  cielo.addColorStop(1, "#eef4ee");
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(72, 95, 52, 15, 0, 0, Math.PI * 2);
  ctx.ellipse(140, 70, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(170, 150, 46, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const textura = new Texture(canvas.toDataURL("image/png"), scene);
  textura.name = "texturaCielo";
  return textura;
}

// Trama fina tipo tejido para la alfombra — a la distancia se lee como
// tela con cuerpo, no como una plancha de color liso.
function crearTexturaAlfombra(scene: Scene, colorBase: [number, number, number]): Texture {
  const tam = 256;
  const canvas = document.createElement("canvas");
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = colorBase;

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, tam, tam);

  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x < tam; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tam);
    ctx.stroke();
  }
  for (let y = 0; y < tam; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(tam, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 2; x < tam; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tam);
    ctx.stroke();
  }

  const textura = new Texture(canvas.toDataURL("image/png"), scene);
  textura.name = "texturaAlfombra";
  textura.wrapU = Texture.WRAP_ADDRESSMODE;
  textura.wrapV = Texture.WRAP_ADDRESSMODE;
  textura.uScale = 6;
  textura.vScale = 4.5;
  textura.anisotropicFilteringLevel = 8;
  return textura;
}

// Escena minimalista tipo "paisaje de colina" para el interior del
// cuadro — reemplaza el color plano sin necesitar un archivo de imagen
// externo.
function crearTexturaCuadro(scene: Scene): Texture {
  const w = 190;
  const h = 130;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const cielo = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  cielo.addColorStop(0, "#dce8e0");
  cielo.addColorStop(1, "#c3d6c8");
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h * 0.6);

  const tierra = ctx.createLinearGradient(0, h * 0.55, 0, h);
  tierra.addColorStop(0, "#6f8a5e");
  tierra.addColorStop(1, "#4a6440");
  ctx.fillStyle = tierra;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  ctx.fillStyle = "rgba(70,95,65,0.55)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.quadraticCurveTo(w * 0.35, h * 0.4, w * 0.65, h * 0.56);
  ctx.quadraticCurveTo(w * 0.85, h * 0.64, w, h * 0.53);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const textura = new Texture(canvas.toDataURL("image/png"), scene);
  textura.name = "texturaCuadro";
  return textura;
}

export function crearAmbienteOficina(scene: Scene): void {
  // --- Paredes: PBR + textura de pintura sutil en vez de color plano ---
  const matPared = new PBRMaterial("matPared", scene);
  matPared.albedoTexture = crearTexturaPintura(scene, "texturaPared", [234, 229, 211]);
  (matPared.albedoTexture as Texture).uScale = 5;
  (matPared.albedoTexture as Texture).vScale = 2.2;
  matPared.roughness = 0.68;
  matPared.metallic = 0;
  matPared.emissiveColor = new Color3(0.09, 0.086, 0.076);
  matPared.backFaceCulling = false;

  const paredFondo = MeshBuilder.CreatePlane("paredFondo", { width: 16, height: 7 }, scene);
  paredFondo.position.set(0, 3.2, 6);
  paredFondo.material = matPared;
  paredFondo.receiveShadows = true;

  const paredIzq = MeshBuilder.CreatePlane("paredIzq", { width: 14, height: 7 }, scene);
  paredIzq.position.set(-6, 3.2, 1);
  paredIzq.rotation.y = Math.PI / 2;
  paredIzq.material = matPared;
  paredIzq.receiveShadows = true;

  const paredDer = MeshBuilder.CreatePlane("paredDer", { width: 14, height: 7 }, scene);
  paredDer.position.set(6, 3.2, 1);
  paredDer.rotation.y = -Math.PI / 2;
  paredDer.material = matPared;
  paredDer.receiveShadows = true;

  // Rodapiés: definen dónde termina la pared y empieza el piso — antes
  // se veían fundidos sin transición, esto le da estructura real al cuarto.
  const matRodapie = new PBRMaterial("matRodapie", scene);
  matRodapie.albedoColor = new Color3(0.32, 0.29, 0.25);
  matRodapie.roughness = 0.4;
  matRodapie.metallic = 0;
  matRodapie.emissiveColor = new Color3(0.03, 0.028, 0.024);

  const rodapieFondo = MeshBuilder.CreateBox("rodapieFondo", { width: 16, height: 0.15, depth: 0.03 }, scene);
  rodapieFondo.position.set(0, 0.08, 5.98);
  rodapieFondo.material = matRodapie;

  const rodapieIzq = MeshBuilder.CreateBox("rodapieIzq", { width: 0.03, height: 0.15, depth: 14 }, scene);
  rodapieIzq.position.set(-5.98, 0.08, 1);
  rodapieIzq.material = matRodapie;

  const rodapieDer = MeshBuilder.CreateBox("rodapieDer", { width: 0.03, height: 0.15, depth: 14 }, scene);
  rodapieDer.position.set(5.98, 0.08, 1);
  rodapieDer.material = matRodapie;

  // --- Ventana: cielo con gradiente + nubes en vez de color plano, y
  // vidrio con una pizca de reflejo PBR real ---
  const matVentana = new PBRMaterial("matVentana", scene);
  matVentana.albedoTexture = crearTexturaCielo(scene);
  matVentana.emissiveTexture = matVentana.albedoTexture;
  matVentana.emissiveColor = new Color3(0.75, 0.8, 0.8);
  matVentana.emissiveIntensity = 1.4;
  matVentana.roughness = 0.08;
  matVentana.metallic = 0.15;
  matVentana.backFaceCulling = false;

  const ventana = MeshBuilder.CreatePlane("ventana", { width: 2.2, height: 1.6 }, scene);
  ventana.position.set(-5.9, 3.4, 0.5);
  ventana.rotation.y = Math.PI / 2;
  ventana.material = matVentana;

  const matMarco = new PBRMaterial("matMarcoVentana", scene);
  matMarco.albedoColor = new Color3(0.36, 0.31, 0.26);
  matMarco.roughness = 0.55;
  matMarco.metallic = 0;
  const marco = MeshBuilder.CreateBox("marcoVentana", { width: 0.06, height: 1.7, depth: 2.4 }, scene);
  marco.position.set(-5.95, 3.4, 0.5);
  marco.material = matMarco;

  // --- Lámpara: housing metálico + una tira que realmente emite luz,
  // en vez de una sola caja pareja "auto-iluminada". El PointLight es lo
  // que hace que el techo/paredes de alrededor realmente se iluminen —
  // antes la lámpara brillaba pero no alumbraba nada. Sin sombras
  // propias para no sumar costo: la sombra "real" ya la da la luz
  // direccional principal de SceneManager.
  const matHousingLampara = new PBRMaterial("matHousingLampara", scene);
  matHousingLampara.albedoColor = new Color3(0.55, 0.56, 0.58);
  matHousingLampara.roughness = 0.35;
  matHousingLampara.metallic = 0.6;

  const housingLampara = MeshBuilder.CreateBox("housingLampara", { width: 1.5, height: 0.1, depth: 0.55 }, scene);
  housingLampara.position.set(0, 6.5, 1);
  housingLampara.material = matHousingLampara;

  const matTiraLampara = new PBRMaterial("matTiraLampara", scene);
  matTiraLampara.albedoColor = new Color3(0.95, 0.93, 0.85);
  matTiraLampara.emissiveColor = new Color3(0.85, 0.8, 0.62);
  matTiraLampara.roughness = 0.3;

  const tiraLampara = MeshBuilder.CreateBox("tiraLampara", { width: 1.3, height: 0.03, depth: 0.35 }, scene);
  tiraLampara.position.set(0, 6.44, 1);
  tiraLampara.material = matTiraLampara;

  const luzLampara = new PointLight("luzLampara", new Vector3(0, 6.3, 1), scene);
  luzLampara.diffuse = new Color3(1, 0.93, 0.78);
  luzLampara.intensity = 0.75;
  luzLampara.range = 10;

  // --- Alfombra bajo el escritorio: ahora con trama de tejido en vez de
  // color plano ---
  const matAlfombra = new PBRMaterial("matAlfombra", scene);
  matAlfombra.albedoTexture = crearTexturaAlfombra(scene, [82, 100, 96]);
  matAlfombra.roughness = 0.92;
  matAlfombra.metallic = 0;

  const alfombra = MeshBuilder.CreateGround("alfombra", { width: 4, height: 3 }, scene);
  alfombra.position.set(0, 0.005, 0.2);
  alfombra.material = matAlfombra;
  alfombra.receiveShadows = true;

  // --- Cuadro en la pared de fondo: ahora con una escena mínima en vez
  // de un rectángulo de color liso ---
  const matCuadroMarco = new PBRMaterial("matCuadroMarco", scene);
  matCuadroMarco.albedoColor = new Color3(0.27, 0.22, 0.18);
  matCuadroMarco.roughness = 0.5;
  matCuadroMarco.metallic = 0;
  const cuadroMarco = MeshBuilder.CreatePlane("cuadroMarco", { width: 1.1, height: 0.8 }, scene);
  cuadroMarco.position.set(3.2, 3.6, 5.95);
  cuadroMarco.material = matCuadroMarco;

  const matCuadroInterior = new PBRMaterial("matCuadroInterior", scene);
  matCuadroInterior.albedoTexture = crearTexturaCuadro(scene);
  matCuadroInterior.roughness = 0.65;
  matCuadroInterior.metallic = 0;
  const cuadroInterior = MeshBuilder.CreatePlane("cuadroInterior", { width: 0.95, height: 0.65 }, scene);
  cuadroInterior.position.set(3.2, 3.6, 5.93);
  cuadroInterior.material = matCuadroInterior;

  // --- Planta en la esquina: mismo conteo de hojas, cada una con un
  // verde ligeramente distinto para que no se lea como copias idénticas ---
  const matMaceta = new PBRMaterial("matMaceta", scene);
  matMaceta.albedoColor = new Color3(0.5, 0.32, 0.24);
  matMaceta.roughness = 0.65;
  matMaceta.metallic = 0;
  const maceta = MeshBuilder.CreateCylinder("maceta", { diameterTop: 0.5, diameterBottom: 0.35, height: 0.5 }, scene);
  maceta.position.set(-4.8, 0.25, 4.8);
  maceta.material = matMaceta;
  maceta.receiveShadows = true;

  // Techo: comparte la misma textura de pintura que las paredes (una
  // sola carga de textura, reutilizada) para que la luz de la lampara
  // tenga una superficie real donde pegar en vez de perderse en el
  // vacio — antes no habia ninguna malla arriba del cuarto.
  const matTecho = new PBRMaterial("matTecho", scene);
  matTecho.albedoTexture = crearTexturaPintura(scene, "texturaTecho", [226, 222, 210]);
  (matTecho.albedoTexture as Texture).uScale = 4;
  (matTecho.albedoTexture as Texture).vScale = 3.5;
  matTecho.roughness = 0.85;
  matTecho.metallic = 0;
  matTecho.emissiveColor = new Color3(0.04, 0.038, 0.034);
  matTecho.backFaceCulling = false;
  const techo = MeshBuilder.CreatePlane("techo", { width: 14, height: 16 }, scene);
  techo.position.set(0, 6.75, 1);
  techo.rotation.x = Math.PI / 2;
  techo.material = matTecho;
  techo.receiveShadows = true;

  [0, 0.3, -0.3, 0.15, -0.15].forEach((offset, i) => {
    const matHoja = new PBRMaterial(`matHojaPlanta_${i}`, scene);
    matHoja.albedoColor = new Color3(0.2 + i * 0.015, 0.4 + i * 0.02, 0.19 + i * 0.01);
    matHoja.roughness = 0.8;
    matHoja.metallic = 0;

    const hoja = MeshBuilder.CreateSphere(`hojaPlanta_${i}`, { diameterX: 0.15, diameterY: 0.5, diameterZ: 0.15 }, scene);
    hoja.position.set(-4.8 + offset, 0.85 + i * 0.05, 4.8 + offset * 0.6);
    hoja.rotation.z = offset * 0.8;
    hoja.material = matHoja;
  });
}