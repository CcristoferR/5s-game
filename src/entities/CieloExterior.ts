import { Scene, MeshBuilder, StandardMaterial, PBRMaterial, DynamicTexture, Color3, Texture, Mesh, Material } from "@babylonjs/core";

// ---------------------------------------------------------------------------
// Exterior del garaje
// ---------------------------------------------------------------------------
//
// Todo lo que se ve por las ventanas y por el portón. Sin esto, cada abertura
// del galpón daba a un vacío blanco: el garaje no parecía estar en ningún
// lado, y ese blanco plano era lo primero que delataba la escena como una
// maqueta.
//
// Es puramente decorativo: nada de acá es seleccionable, no proyecta ni recibe
// sombras y no participa del arrastre. No puede interferir con ningún nivel.

const RADIO_CIELO = 260;

/**
 * Cielo pintado sobre un canvas y envuelto alrededor de la escena.
 *
 * Se genera por código en vez de cargar un HDR: un panorama de cielo decente
 * pesa varios megas, y acá alcanza con un degradado, unas nubes y un sol. La
 * escena ya carga 2,4 MB de garaje; no vale la pena duplicar eso por el fondo.
 */
function pintarCielo(scene: Scene): DynamicTexture {
  const ancho = 1024;
  const alto = 512;
  const tex = new DynamicTexture("texturaCielo", { width: ancho, height: alto }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  // El horizonte queda a media altura de la textura, que es donde la esfera lo
  // cruza. Arriba cielo, abajo la bruma del terreno lejano.
  const horizonte = alto * 0.52;

  const cielo = ctx.createLinearGradient(0, 0, 0, horizonte);
  cielo.addColorStop(0, "#3f6ea8");
  cielo.addColorStop(0.45, "#79a5cf");
  cielo.addColorStop(0.82, "#b9d3e6");
  cielo.addColorStop(1, "#dce8ee");
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, ancho, horizonte);

  const tierra = ctx.createLinearGradient(0, horizonte, 0, alto);
  tierra.addColorStop(0, "#c3cbc0");
  tierra.addColorStop(0.25, "#93a08c");
  tierra.addColorStop(1, "#6d7869");
  ctx.fillStyle = tierra;
  ctx.fillRect(0, horizonte, ancho, alto - horizonte);

  // --- Sol ---
  //
  // Ubicado a la izquierda y alto, para coincidir con la luz direccional de la
  // escena, que apunta hacia (-0.3, -1, 0.25). Si el sol se dibujara en
  // cualquier lado, las sombras del interior contradirían al cielo.
  const solX = ancho * 0.28;
  const solY = horizonte * 0.34;

  const halo = ctx.createRadialGradient(solX, solY, 0, solX, solY, 190);
  halo.addColorStop(0, "rgba(255, 249, 224, 0.95)");
  halo.addColorStop(0.14, "rgba(255, 243, 205, 0.55)");
  halo.addColorStop(0.45, "rgba(255, 240, 200, 0.16)");
  halo.addColorStop(1, "rgba(255, 240, 200, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(solX, solY, 190, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 253, 242, 0.98)";
  ctx.beginPath();
  ctx.arc(solX, solY, 26, 0, Math.PI * 2);
  ctx.fill();

  // --- Nubes ---
  //
  // Cada nube se arma acumulando elipses de baja opacidad: al superponerse
  // generan bordes irregulares. Una sola elipse se lee como una mancha.
  const nube = (cx: number, cy: number, escala: number, opacidad: number): void => {
    ctx.fillStyle = `rgba(255,255,255,${opacidad})`;
    for (let i = 0; i < 22; i++) {
      const dx = (Math.random() - 0.5) * 190 * escala;
      const dy = (Math.random() - 0.5) * 34 * escala;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, (34 + Math.random() * 40) * escala, (13 + Math.random() * 15) * escala, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  nube(150, 108, 1.1, 0.055);
  nube(430, 76, 0.85, 0.05);
  nube(680, 128, 1.25, 0.045);
  nube(880, 92, 0.9, 0.05);
  nube(300, 186, 1.4, 0.035);
  nube(760, 205, 1.15, 0.03);

  // --- Cerros lejanos ---
  //
  // Rompen la línea recta del horizonte y dan sensación de distancia. Van muy
  // desaturados a propósito: el aire a esa distancia lava el color, y si
  // salieran nítidos parecerían estar al lado del galpón.
  const cerros = (color: string, base: number, altura: number, paso: number, semilla: number): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= ancho; x += paso) {
      const y = base - (Math.sin((x + semilla) / 130) * 0.5 + 0.5) * altura - Math.sin((x + semilla) / 47) * altura * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(ancho, alto);
    ctx.lineTo(0, alto);
    ctx.closePath();
    ctx.fill();
  };

  cerros("rgba(150, 166, 176, 0.75)", horizonte + 4, 34, 8, 0);
  cerros("rgba(126, 142, 130, 0.85)", horizonte + 12, 22, 8, 420);

  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

/**
 * Monta el cielo y el terreno exterior alrededor de la escena.
 *
 * Devuelve las mallas creadas por si el nivel quiere disponerlas a mano; en el
 * uso normal se van solas al destruirse la escena.
 */
export function crearExteriorGaraje(scene: Scene): { cielo: Mesh; terreno: Mesh } {
  // Cúpula: una esfera vista desde adentro. backFaceCulling en false es lo que
  // permite verla desde el interior; sin eso la esfera es invisible.
  const matCielo = new StandardMaterial("matCieloExterior", scene);
  matCielo.backFaceCulling = false;
  matCielo.disableLighting = true;
  matCielo.emissiveTexture = pintarCielo(scene);
  matCielo.diffuseColor = new Color3(0, 0, 0);
  matCielo.specularColor = new Color3(0, 0, 0);

  const cielo = MeshBuilder.CreateSphere("cieloExterior", { diameter: RADIO_CIELO * 2, segments: 24 }, scene);
  cielo.material = matCielo;
  cielo.isPickable = false;
  cielo.receiveShadows = false;
  // infiniteDistance mantiene la cúpula siempre centrada en la cámara: el
  // horizonte no se "corre" al girar y nunca se llega al borde.
  cielo.infiniteDistance = true;
  cielo.applyFog = false;

  // Terreno exterior: lo que se ve por el portón, a ras del piso del galpón.
  // Va apenas por debajo para que no pelee con el piso de concreto del modelo.
  const matTerreno = new PBRMaterial("matTerrenoExterior", scene);
  matTerreno.albedoColor = new Color3(0.44, 0.46, 0.42);
  matTerreno.roughness = 0.95;
  matTerreno.metallic = 0;
  matTerreno.emissiveColor = new Color3(0.06, 0.065, 0.055);

  const terreno = MeshBuilder.CreateGround("terrenoExterior", { width: 400, height: 400 }, scene);
  terreno.position.y = -0.06;
  terreno.material = matTerreno;
  terreno.isPickable = false;
  terreno.receiveShadows = false;

  return { cielo, terreno };
}

/**
 * Vuelve transparentes los vidrios del garaje.
 *
 * El modelo trae un material propio para los cristales, pero opaco: las
 * ventanas se veían como paneles blancos y tapaban justamente lo que hay que
 * mostrar. Se los busca por nombre y, si el modelo cambia y no aparece
 * ninguno, simplemente no se hace nada — nunca rompe la carga.
 */
export function hacerVidriosTransparentes(scene: Scene): number {
  let ajustados = 0;

  scene.materials.forEach((mat) => {
    const nombre = mat.name.toLowerCase();
    if (!nombre.includes("cristal") && !nombre.includes("vidrio") && !nombre.includes("glass")) return;

    mat.alpha = 0.16;
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND;

    if (mat instanceof PBRMaterial) {
      // Tinte apenas azulado y superficie pulida: un vidrio limpio de taller.
      mat.albedoColor = new Color3(0.62, 0.72, 0.78);
      mat.roughness = 0.06;
      mat.metallic = 0.1;
      mat.backFaceCulling = false;
    } else if (mat instanceof StandardMaterial) {
      mat.diffuseColor = new Color3(0.62, 0.72, 0.78);
      mat.specularPower = 128;
      mat.backFaceCulling = false;
    }

    ajustados++;
  });

  return ajustados;
}