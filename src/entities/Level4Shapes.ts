import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import { materialPintadoNitido } from "./ObjetosComunes";

/**
 * Densidad de textura de las piezas de este nivel.
 *
 * Las plantillas y las fichas llevan texto que hay que PODER LEER antes de
 * colocarlas: la diferencia entre "PASILLO 1,20 m" y "ZONA ORDENADA" es la
 * unica decision del nivel que ningun control automatico corrige despues. A la
 * densidad de antes esa letra era un borron incluso con la camara encima.
 *
 * La lamina va con menos factor que la ficha porque es cinco veces mas grande
 * en el mundo: al mismo factor su textura pesaria cuatro veces mas por nada.
 */
const NITIDEZ_LAMINA = 2;
const NITIDEZ_FICHA = 2.5;
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
 * Plantilla de marcado, DE PIE.
 *
 * Antes iba tumbada en el suelo, que es como se usa de verdad — y era
 * ilegible. Una lamina apoyada en el piso se mira siempre en escorzo: por
 * mucha resolucion que tenga la textura, el texto llega a la pantalla
 * aplastado, y acercar la camara no arregla el angulo. Las fichas de color se
 * leian bien desde el primer dia justo porque estaban de pie.
 *
 * Asi que se apoya sobre unos tacos, como los carteles plegables de obra. Da
 * igual para el resultado: al colocarla se retira y lo que queda es la pintura
 * sobre el piso.
 *
 * Lleva escrito lo que va a quedar pintado. Es deliberado: la diferencia entre
 * "PASILLO · DESPEJADO 1,20 m" y "ZONA ORDENADA" tiene que poder leerse ANTES
 * de colocarla, porque elegir entre las dos es la única decisión del nivel que
 * ningún control automático puede corregir después.
 */
export function crearMarcaPiso(scene: Scene, datos: MarcaNivel4): Mesh {
  const partes: Mesh[] = [];

  const ANCHO = 0.72;
  const ALTO = 0.46;
  const ESPESOR = 0.035;
  // Altura del centro. La base queda casi a ras del piso.
  const CENTRO_Y = ALTO / 2 + 0.05;

  const matBastidor = new PBRMaterial(`matMarcaBastidor_${datos.id}`, scene);
  matBastidor.albedoColor = new Color3(0.32, 0.34, 0.37);
  matBastidor.roughness = 0.55;
  matBastidor.metallic = 0.5;

  // Cuerpo de la plantilla, DE PIE.
  const cuerpo = MeshBuilder.CreateBox(
    `marcaCuerpo_${datos.id}`,
    { width: ANCHO, height: ALTO, depth: ESPESOR },
    scene
  );
  cuerpo.position.y = CENTRO_Y;
  cuerpo.material = matBastidor;
  partes.push(cuerpo);

  // Pie: dos tacos que la apoyan. Sin ellos se lee como un cartel flotando.
  [-1, 1].forEach((lado) => {
    const taco = MeshBuilder.CreateBox(
      `marcaPie_${datos.id}_${lado}`,
      { width: 0.1, height: 0.05, depth: 0.16 },
      scene
    );
    taco.position.set(lado * (ANCHO / 2 - 0.09), 0.025, 0);
    taco.material = matBastidor;
    partes.push(taco);
  });

  const matLamina = materialPintadoNitido(scene, `matMarcaLamina_${datos.id}`, 768, 480, NITIDEZ_LAMINA, (ctx, w, h) => {
    ctx.fillStyle = datos.esEspecifica ? "#e9c65a" : "#b9b39a";
    ctx.fillRect(0, 0, w, h);

    // Rayado de seguridad en el marco.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(30,30,30,0.5)";
    ctx.lineWidth = 14;
    for (let i = -h; i < w + h; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.restore();

    // Ventana negra del texto, con margen ajustado: cada pixel que se le quita
    // al marco es letra mas grande.
    ctx.fillStyle = "#171a1c";
    ctx.fillRect(22, 92, w - 44, h - 184);

    ctx.fillStyle = datos.esEspecifica ? "#f2d47a" : "#d8d3c0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // El texto se parte en dos renglones antes que encogerse: "PASILLO ·
    // DESPEJADO 1,20 m" en una linea obliga a bajar la letra a la mitad.
    const palabras = datos.textoPintado.split(" ");
    let tamano = 96;
    ctx.font = `bold ${tamano}px system-ui, sans-serif`;

    const partir = (): string[] => {
      const lineas: string[] = [];
      let actual = "";
      palabras.forEach((palabra) => {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > w - 74 && actual) {
          lineas.push(actual);
          actual = palabra;
        } else {
          actual = prueba;
        }
      });
      if (actual) lineas.push(actual);
      return lineas;
    };

    let lineas = partir();
    while (lineas.length > 2 && tamano > 34) {
      tamano -= 6;
      ctx.font = `bold ${tamano}px system-ui, sans-serif`;
      lineas = partir();
    }

    const centro = h / 2;
    const paso = tamano + 12;
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, w / 2, centro + (i - (lineas.length - 1) / 2) * paso);
    });
  });

  // La cara impresa mira a -Z, que es de donde mira la camara.
  const lamina = MeshBuilder.CreateBox(
    `marcaLamina_${datos.id}`,
    { width: ANCHO - 0.05, height: ALTO - 0.05, depth: 0.014 },
    scene
  );
  lamina.position.set(0, CENTRO_Y, -ESPESOR / 2);
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

  const matCara = materialPintadoNitido(scene, `matFichaCara_${datos.id}`, 256, 288, NITIDEZ_FICHA, (ctx, w, h) => {
    ctx.fillStyle = datos.hex;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Banda del nombre: casi un tercio de la ficha. El color solo no basta —
    // rojo y amarillo se confunden bajo la luz calida del galpon, y el jugador
    // tiene que estar seguro de cual esta agarrando antes de pegarla.
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, h - 96, w, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px system-ui, sans-serif";
    ctx.textAlign = "center";
    let tamanoFicha = 54;
    while (ctx.measureText(datos.nombreVisible.toUpperCase()).width > w - 24 && tamanoFicha > 22) {
      tamanoFicha -= 3;
      ctx.font = `bold ${tamanoFicha}px system-ui, sans-serif`;
    }
    ctx.fillText(datos.nombreVisible.toUpperCase(), w / 2, h - 32);
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