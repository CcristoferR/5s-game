import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import { materialPintado } from "./ObjetosComunes";
import { texturaGrano, texturaMetalCepillado } from "./TexturasSuperficie";
import type { ConectorNivel4, MarcaNivel4, ColorNivel4 } from "../data/levelConfig";

// ---------------------------------------------------------------------------
// Las piezas que el jugador manipula en el Nivel 4
// ---------------------------------------------------------------------------
//
// Ya no son tarjetas con texto. Antes el nivel se jugaba emparejando fichas
// sobre una mesa, y eso no es estandarizar: es un test de lectura con forma de
// juego. Ahora cada pieza es una herramienta de control visual real —un
// conector codificado, una plantilla de pintura de piso, una etiqueta de
// color— y se instala en el sitio del taller al que pertenece.
//
// Todas se fusionan en una sola malla. Es obligatorio para cualquier objeto
// arrastrable: el sistema de arrastre solo reconoce la malla raíz, y con las
// piezas como hijas el objeto se ve pero al hacerle clic no pasa nada.

/** Convierte "#rrggbb" en Color3. */
function desdeHex(hex: string): Color3 {
  return Color3.FromHexString(hex.startsWith("#") ? hex : `#${hex}`);
}

// ---------------------------------------------------------------------------
// Conector con forma propia (poka-yoke)
// ---------------------------------------------------------------------------

/**
 * Cable con el conector moldeado según su puerto.
 *
 * Video 4.2 (2:38): "un ejemplo es el de rompecabezas donde una pieza solo
 * encaja en un sitio específico". La forma NO es decorativa: es la única
 * información que el jugador tiene para saber dónde va, y es también lo que el
 * nivel comprueba. Por eso cada una es inconfundible de un vistazo, incluso
 * desde el otro extremo del taller.
 */
export function crearConector(scene: Scene, datos: ConectorNivel4): Mesh {
  const partes: Mesh[] = [];

  const matCuerpo = new PBRMaterial(`matConectorCuerpo_${datos.id}`, scene);
  matCuerpo.albedoColor = new Color3(0.14, 0.15, 0.17);
  matCuerpo.roughness = 0.65;
  matCuerpo.metallic = 0.15;
  matCuerpo.microSurfaceTexture = texturaGrano(scene, 0.1);

  const matMetal = new PBRMaterial(`matConectorMetal_${datos.id}`, scene);
  matMetal.albedoColor = new Color3(0.55, 0.57, 0.6);
  matMetal.roughness = 0.3;
  matMetal.metallic = 0.85;
  matMetal.albedoTexture = texturaMetalCepillado(scene);

  // Mango: lo que se agarra.
  const mango = MeshBuilder.CreateBox(
    `conectorMango_${datos.id}`,
    { width: 0.16, height: 0.16, depth: 0.2 },
    scene
  );
  mango.position.z = 0.14;
  mango.material = matCuerpo;
  partes.push(mango);

  // Espiga: la pieza con forma. Es lo que entra en el puerto.
  let espiga: Mesh;
  if (datos.forma === "cuadrado") {
    espiga = MeshBuilder.CreateBox(
      `conectorEspiga_${datos.id}`,
      { width: 0.14, height: 0.14, depth: 0.1 },
      scene
    );
  } else if (datos.forma === "circulo") {
    espiga = MeshBuilder.CreateCylinder(
      `conectorEspiga_${datos.id}`,
      { diameter: 0.15, height: 0.1, tessellation: 22 },
      scene
    );
    espiga.rotation.x = Math.PI / 2;
  } else {
    espiga = MeshBuilder.CreateCylinder(
      `conectorEspiga_${datos.id}`,
      { diameter: 0.19, height: 0.1, tessellation: 3 },
      scene
    );
    espiga.rotation.x = Math.PI / 2;
  }
  espiga.position.z = -0.01;
  espiga.material = matMetal;
  partes.push(espiga);

  // Cable enrollado detrás. Sin él la pieza se lee como un tapón suelto y no
  // como el extremo de una instalación.
  for (let i = 0; i < 4; i++) {
    const tramo = MeshBuilder.CreateTorus(
      `conectorCable_${datos.id}_${i}`,
      { diameter: 0.15, thickness: 0.028, tessellation: 14 },
      scene
    );
    tramo.rotation.x = Math.PI / 2;
    tramo.position.set(0, -0.005 + i * 0.012, 0.3 + i * 0.055);
    tramo.material = matCuerpo;
    partes.push(tramo);
  }

  const conector = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  conector.name = datos.id;
  conector.receiveShadows = true;
  return conector;
}

// ---------------------------------------------------------------------------
// Plantilla de pintura de piso (señalización de caminos)
// ---------------------------------------------------------------------------

/**
 * Plantilla de marcado, del tipo que se apoya en el piso para pintar encima.
 *
 * Lleva escrito lo que va a quedar pintado. Es deliberado: la diferencia entre
 * "PASILLO · DESPEJADO 1,20 m" y "ZONA ORDENADA" tiene que poder leerse ANTES
 * de colocarla, porque elegir entre las dos es la única decisión del nivel que
 * ningún control automático puede corregir después.
 */
export function crearMarcaPiso(scene: Scene, datos: MarcaNivel4): Mesh {
  const partes: Mesh[] = [];

  const matBastidor = new PBRMaterial(`matMarcaBastidor_${datos.id}`, scene);
  matBastidor.albedoColor = new Color3(0.32, 0.34, 0.37);
  matBastidor.roughness = 0.55;
  matBastidor.metallic = 0.5;

  const ANCHO = 0.78;
  const FONDO = 0.34;

  // Bastidor: cuatro listones que enmarcan la lámina.
  const listones: Array<[number, number, number, number]> = [
    [0, -FONDO / 2, ANCHO, 0.035],
    [0, FONDO / 2, ANCHO, 0.035],
    [-ANCHO / 2, 0, 0.035, FONDO],
    [ANCHO / 2, 0, 0.035, FONDO],
  ];
  listones.forEach(([lx, lz, ancho, fondo], i) => {
    const liston = MeshBuilder.CreateBox(
      `marcaListon_${datos.id}_${i}`,
      { width: ancho, height: 0.045, depth: fondo },
      scene
    );
    liston.position.set(lx, 0.022, lz);
    liston.material = matBastidor;
    partes.push(liston);
  });

  const matLamina = materialPintado(scene, `matMarcaLamina_${datos.id}`, 768, 320, (ctx, w, h) => {
    ctx.fillStyle = datos.esEspecifica ? "#e9c65a" : "#b9b39a";
    ctx.fillRect(0, 0, w, h);

    // Rayado de seguridad en los bordes.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(30,30,30,0.5)";
    ctx.lineWidth = 12;
    for (let i = -h; i < w + h; i += 46) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "#171a1c";
    ctx.fillRect(26, 84, w - 52, h - 168);

    ctx.fillStyle = datos.esEspecifica ? "#f2d47a" : "#d8d3c0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let tamano = 62;
    ctx.font = `bold ${tamano}px system-ui, sans-serif`;
    while (ctx.measureText(datos.textoPintado).width > w - 88 && tamano > 20) {
      tamano -= 3;
      ctx.font = `bold ${tamano}px system-ui, sans-serif`;
    }
    ctx.fillText(datos.textoPintado, w / 2, h / 2);
  });

  const lamina = MeshBuilder.CreateBox(
    `marcaLamina_${datos.id}`,
    { width: ANCHO - 0.06, height: 0.02, depth: FONDO - 0.06 },
    scene
  );
  lamina.position.y = 0.03;
  lamina.material = matLamina;
  partes.push(lamina);

  const marca = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  marca.name = datos.id;
  marca.receiveShadows = true;
  return marca;
}

// ---------------------------------------------------------------------------
// Ficha de color para el interruptor
// ---------------------------------------------------------------------------

/**
 * Etiqueta de color que se pega en la placa de un interruptor.
 *
 * Video 4.2 (5:29): los interruptores se señalizan por color y sus focos
 * llevan el mismo. Nada impide pegar la ficha equivocada — y eso es
 * exactamente lo que este nivel quiere que el jugador descubra.
 */
export function crearFichaColor(scene: Scene, datos: ColorNivel4): Mesh {
  const partes: Mesh[] = [];
  const color = desdeHex(datos.hex);

  const matCuerpo = new PBRMaterial(`matFichaCuerpo_${datos.id}`, scene);
  matCuerpo.albedoColor = color;
  matCuerpo.emissiveColor = color.scale(0.16);
  matCuerpo.roughness = 0.6;
  matCuerpo.metallic = 0.1;

  const cuerpo = MeshBuilder.CreateBox(
    `fichaCuerpo_${datos.id}`,
    { width: 0.3, height: 0.34, depth: 0.026 },
    scene
  );
  cuerpo.material = matCuerpo;
  partes.push(cuerpo);

  const matCara = materialPintado(scene, `matFichaCara_${datos.id}`, 256, 288, (ctx, w, h) => {
    ctx.fillStyle = datos.hex;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, h - 74, w, 74);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(datos.nombreVisible.toUpperCase(), w / 2, h - 26);
  });

  const cara = MeshBuilder.CreateBox(
    `fichaCara_${datos.id}`,
    { width: 0.29, height: 0.33, depth: 0.012 },
    scene
  );
  cara.position.z = -0.016;
  cara.material = matCara;
  partes.push(cara);

  const ficha = Mesh.MergeMeshes(partes, true, true, undefined, false, true)!;
  ficha.name = datos.id;
  ficha.receiveShadows = true;
  return ficha;
}