import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  DynamicTexture,
  Color3,
  Texture,
  Mesh,
  Material,
} from "@babylonjs/core";

// ---------------------------------------------------------------------------
// Exterior del garaje
// ---------------------------------------------------------------------------
//
// Todo lo que se ve por las ventanas y por el portón: cielo, patio pavimentado,
// una manzana de galpones alrededor, árboles y postes de luz.
//
// Sin esto cada abertura daba a un blanco plano — el galpón parecía flotar en
// la nada, y ese vacío era lo primero que delataba la escena como una maqueta.
//
// CRITERIO DE COSTO. La vista desde adentro es corta y siempre encuadrada por
// una abertura, así que nada de acá necesita detalle: son cajas con textura de
// ventanas y esferas achatadas por copa de árbol. Todo queda fuera del picking,
// sin sombras y sin colisiones, así que no puede interferir con ningún nivel ni
// pesar en el render.

const RADIO_CIELO = 300;
const RADIO_MANZANA = 44;

function pbr(scene: Scene, nombre: string, color: Color3, rugosidad: number, metalico = 0): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;
  // Piso mínimo de luz: los edificios están fuera del alcance de las luces del
  // interior y, sin esto, quedarían como siluetas negras contra el cielo.
  mat.emissiveColor = color.scale(0.22);
  return mat;
}

// ---------------------------------------------------------------------------
// Cielo
// ---------------------------------------------------------------------------

function pintarCielo(scene: Scene): DynamicTexture {
  // RESOLUCIÓN DEL CIELO.
  //
  // Subida de 2048 x 1024 a 4096 x 2048. Parece mucho para un fondo, pero esa
  // textura se estira sobre TODO el domo: a 2048 px, el trozo que se ve por
  // una ventana usaba apenas doscientos píxeles de ancho, y por eso el cielo
  // salía con bandas y el borde del sol dentado.
  //
  // Es una sola textura y se genera una vez por escena, así que el coste es
  // memoria de vídeo, no velocidad de dibujo.
  const ancho = 4096;
  const alto = 2048;
  const tex = new DynamicTexture("texturaCielo", { width: ancho, height: alto }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  // El horizonte se dibuja bien abajo: la mayor parte de lo que se ve por una
  // ventana es cielo, no suelo, y el suelo real lo pone el patio.
  const horizonte = alto * 0.62;

  const cielo = ctx.createLinearGradient(0, 0, 0, horizonte);
// DÍA DESPEJADO, no cerrado.
  //
  // El degradado iba de un azul apagado a un gris muy claro, y eso es un cielo
  // encapotado. Un día de sol tiene el cenit saturado y el horizonte cálido —
  // ese contraste es lo que hace que se lea como buen tiempo.
  cielo.addColorStop(0, "#1f5aa8");
  cielo.addColorStop(0.35, "#4b8fd4");
  cielo.addColorStop(0.68, "#8fc2e8");
  cielo.addColorStop(0.9, "#d6e6f0");
  // Antes esta franja llegaba casi a blanco puro y, vista por el portón,
  // parecía una pared blanca en vez de un horizonte.
  cielo.addColorStop(1, "#cfdce4");
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, ancho, horizonte);

  const suelo = ctx.createLinearGradient(0, horizonte, 0, alto);
  suelo.addColorStop(0, "#8d9c88");
  suelo.addColorStop(1, "#5d6a58");
  ctx.fillStyle = suelo;
  ctx.fillRect(0, horizonte, ancho, alto - horizonte);

  // --- Sol ---
  // A la izquierda y alto, para coincidir con la luz direccional de la escena.
  // Si estuviera en cualquier lado, las sombras del interior contradirían al
  // cielo y la escena se sentiría rara sin que se sepa por qué.
  const escala = ancho / 2048;
  const solX = ancho * 0.26;
  const solY = horizonte * 0.3;

  const halo = ctx.createRadialGradient(solX, solY, 0, solX, solY, 340 * escala);
  halo.addColorStop(0, "rgba(255, 251, 232, 0.9)");
  halo.addColorStop(0.1, "rgba(255, 246, 214, 0.45)");
  halo.addColorStop(0.4, "rgba(255, 242, 205, 0.14)");
  halo.addColorStop(1, "rgba(255, 242, 205, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(solX - 340 * escala, solY - 340 * escala, 680 * escala, 680 * escala);

  ctx.fillStyle = "rgba(255, 254, 246, 0.98)";
  ctx.beginPath();
  ctx.arc(solX, solY, 34 * escala, 0, Math.PI * 2);
  ctx.fill();

  // --- Nubes ---
  // Cada nube acumula elipses de baja opacidad: al superponerse dan bordes
  // irregulares. Una sola elipse se lee como una mancha pegada al cielo.
  const nube = (cx: number, cy: number, escala: number, opacidad: number): void => {
    ctx.fillStyle = `rgba(255,255,255,${opacidad})`;
    for (let i = 0; i < 26; i++) {
      const dx = (Math.random() - 0.5) * 300 * escala;
      const dy = (Math.random() - 0.5) * 46 * escala;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, (48 + Math.random() * 60) * escala, (18 + Math.random() * 20) * escala, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  nube(300, 170, 1.2, 0.07);
  nube(760, 120, 0.95, 0.06);
  nube(1200, 200, 1.35, 0.055);
  nube(1620, 140, 1.05, 0.06);
  nube(520, 330, 1.5, 0.035);
  nube(1420, 380, 1.25, 0.03);

  // --- Cerros lejanos ---
  // Van muy desaturados: a esa distancia el aire lava el color, y si salieran
  // nítidos parecerían estar pegados al galpón.
  const cerros = (color: string, base: number, altura: number, semilla: number): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= ancho; x += 10) {
      const y =
        base -
        (Math.sin((x + semilla) / 260) * 0.5 + 0.5) * altura -
        Math.sin((x + semilla) / 94) * altura * 0.24;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(ancho, alto);
    ctx.lineTo(0, alto);
    ctx.closePath();
    ctx.fill();
  };

  cerros("rgba(148, 166, 180, 0.65)", horizonte + 6, 66, 0);
  cerros("rgba(122, 140, 132, 0.8)", horizonte + 18, 40, 840);

  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

// ---------------------------------------------------------------------------
// Patio pavimentado
// ---------------------------------------------------------------------------

function pintarPavimento(scene: Scene): DynamicTexture {
  const tam = 512;
  const tex = new DynamicTexture("texturaPavimento", { width: tam, height: tam }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = "#5c5f60";
  ctx.fillRect(0, 0, tam, tam);

  // Grano del asfalto.
  for (let i = 0; i < 5200; i++) {
    const claro = Math.random() > 0.5;
    ctx.fillStyle = claro ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(Math.random() * tam, Math.random() * tam, 2.5, 2.5);
  }

  // Parches de reparación y manchas: un patio de taller nunca es parejo.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 30}, ${40 + Math.random() * 30}, ${40 + Math.random() * 30}, 0.28)`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * tam, Math.random() * tam, 30 + Math.random() * 70, 24 + Math.random() * 50, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Demarcación de estacionamiento, desgastada.
  ctx.strokeStyle = "rgba(226, 220, 190, 0.5)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(tam * 0.5, 0);
  ctx.lineTo(tam * 0.5, tam);
  ctx.stroke();

  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 26;
  tex.vScale = 26;
  return tex;
}

// ---------------------------------------------------------------------------
// Galpones vecinos
// ---------------------------------------------------------------------------

/**
 * Fachada de edificio vecino.
 *
 * ─── POR QUÉ SE REHIZO ────────────────────────────────────────────────────
 *
 * La anterior era una retícula de rectángulos oscuros sobre un color plano, a
 * 512 px. Vista por una ventana se leía como una caja de cartón pintada, y con
 * razón: a un edificio real lo que lo hace creíble no es tener ventanas, es
 * todo lo demás — que los vidrios no sean todos iguales, que haya cornisas que
 * proyecten sombra, que la planta baja sea distinta del resto, que las juntas
 * de los paneles se marquen y que la lluvia haya dejado chorreones bajo los
 * alféizares.
 *
 * Nada de eso cuesta geometría: es todo dibujo sobre la textura. Por eso se
 * puede subir tanto el detalle sin tocar el rendimiento — son catorce cajas
 * igual que antes.
 */
function pintarFachada(scene: Scene, nombre: string, base: string): DynamicTexture {
  const ancho = 1024;
  const alto = 1024;
  const tex = new DynamicTexture(nombre, { width: ancho, height: alto }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  const azar = (semilla: number): number => {
    const x = Math.sin(semilla * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // --- Hormigón de fondo, con juntas de panel ---
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, ancho, alto);

  // Veteado: manchas grandes de baja opacidad. Un color plano es lo que más
  // delata una superficie pintada.
  for (let i = 0; i < 260; i++) {
    const r = 30 + azar(i) * 90;
    ctx.fillStyle = azar(i * 3) > 0.5 ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.arc(azar(i * 7) * ancho, azar(i * 11) * alto, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Juntas horizontales de los paneles prefabricados, con su sombra debajo.
  const PANELES = 8;
  for (let f = 1; f < PANELES; f++) {
    const y = (f / PANELES) * alto;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, y - 2, ancho, 3);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(0, y + 1, ancho, 2);
  }

  // --- Ventanas ---
  const COLS = 6;
  const FILAS = 7;
  const margenX = ancho * 0.06;
  const margenSup = alto * 0.07;
  const zonaBaja = alto * 0.2;
  const anchoUtil = ancho - margenX * 2;
  const altoUtil = alto - margenSup - zonaBaja;

  const anchoHueco = anchoUtil / COLS;
  const altoHueco = altoUtil / FILAS;
  const w = anchoHueco * 0.68;
  const h = altoHueco * 0.62;

  for (let c = 0; c < COLS; c++) {
    for (let f = 0; f < FILAS; f++) {
      const x = margenX + c * anchoHueco + (anchoHueco - w) / 2;
      const y = margenSup + f * altoHueco + (altoHueco - h) / 2;
      const semilla = c * 31 + f * 7;

      // Dintel: banda clara arriba del hueco. Es lo que da relieve — sin ella
      // la ventana parece un agujero recortado en una lámina.
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(x - 5, y - 7, w + 10, 7);

      // Sombra propia del hueco, arriba y a la izquierda.
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);

      // El vidrio. Cada uno distinto: ese es el punto.
      //
      // Un edificio con todas las ventanas idénticas se lee como un patrón
      // repetido, que es exactamente el aspecto de cartón impreso. En uno real
      // unas reflejan cielo, otras están en sombra, algunas tienen la luz
      // encendida y unas pocas una persiana bajada.
      const tipo = azar(semilla);

      if (tipo > 0.86) {
        // Encendida: amarillo cálido, más brillante cuanto más arriba.
        const calor = 0.55 + azar(semilla * 2) * 0.35;
        ctx.fillStyle = `rgba(255, ${Math.round(205 + calor * 30)}, ${Math.round(130 + calor * 50)}, ${calor})`;
        ctx.fillRect(x, y, w, h);
      } else if (tipo > 0.62) {
        // Persiana bajada: mate y de un tono próximo al muro.
        ctx.fillStyle = "rgba(150,146,136,0.85)";
        ctx.fillRect(x, y, w, h);
        for (let l = 0; l < 7; l++) {
          ctx.fillStyle = "rgba(0,0,0,0.1)";
          ctx.fillRect(x, y + (h / 7) * l, w, 1.5);
        }
      } else {
        // Vidrio: degradado de cielo reflejado, más claro arriba.
        const vidrio = ctx.createLinearGradient(x, y, x, y + h);
        const frio = 0.35 + azar(semilla * 5) * 0.3;
        vidrio.addColorStop(0, `rgba(${Math.round(120 + frio * 90)}, ${Math.round(160 + frio * 70)}, ${Math.round(190 + frio * 55)}, 1)`);
        vidrio.addColorStop(1, "rgba(38, 52, 66, 1)");
        ctx.fillStyle = vidrio;
        ctx.fillRect(x, y, w, h);

        // Reflejo diagonal. Es el detalle que dice "esto es vidrio" y no
        // "esto es un rectángulo azul".
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y + h);
        ctx.lineTo(x + w * 0.5, y - h * 0.1);
        ctx.lineTo(x + w * 0.78, y - h * 0.1);
        ctx.lineTo(x + w * 0.08, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Montante central: casi ninguna ventana industrial es un solo paño.
      ctx.fillStyle = "rgba(40,44,48,0.75)";
      ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
      ctx.fillRect(x, y + h * 0.45, w, 2.5);

      // Marco.
      ctx.strokeStyle = "rgba(48,52,56,0.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Alféizar y su chorreón. La suciedad que baja de las ventanas es de las
      // señales más fuertes de que un edificio lleva años ahí.
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x - 5, y + h, w + 10, 5);

      if (azar(semilla * 13) > 0.45) {
        const chorreon = ctx.createLinearGradient(0, y + h, 0, y + h + altoHueco * 0.55);
        chorreon.addColorStop(0, "rgba(0,0,0,0.16)");
        chorreon.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = chorreon;
        ctx.fillRect(x + w * 0.1, y + h + 5, w * 0.8, altoHueco * 0.55);
      }
    }
  }

  // --- Planta baja: portones, no ventanas ---
  //
  // Es lo que distingue una nave industrial de un bloque de oficinas, y lo que
  // hace que el vecindario del galpón parezca su vecindario.
  const yBaja = alto - zonaBaja;

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, yBaja - 10, ancho, 10);

  for (let i = 0; i < 3; i++) {
    const pw = ancho * 0.24;
    const px = ancho * 0.07 + i * (ancho * 0.31);
    const ph = zonaBaja * 0.62;
    const py = yBaja + zonaBaja * 0.16;

    ctx.fillStyle = "rgba(58,62,66,0.95)";
    ctx.fillRect(px, py, pw, ph);

    // Lamas del portón seccional.
    for (let l = 0; l < 9; l++) {
      ctx.fillStyle = l % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.14)";
      ctx.fillRect(px, py + (ph / 9) * l, pw, ph / 9);
    }

    ctx.strokeStyle = "rgba(30,33,36,0.9)";
    ctx.lineWidth = 4;
    ctx.strokeRect(px, py, pw, ph);
  }

  // Zócalo sucio: la banda que salpica la lluvia al rebotar en el suelo.
  const zocalo = ctx.createLinearGradient(0, alto - 60, 0, alto);
  zocalo.addColorStop(0, "rgba(0,0,0,0)");
  zocalo.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = zocalo;
  ctx.fillRect(0, alto - 60, ancho, 60);

  // --- Cornisa ---
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, margenSup * 0.34, ancho, 10);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(0, margenSup * 0.2, ancho, margenSup * 0.14);

  // Bajante vertical, con su sombra. Rompe la simetría de la retícula.
  const bx = ancho * (0.2 + azar(ancho) * 0.6);
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.fillRect(bx + 7, margenSup * 0.34, 9, alto - margenSup * 0.34);
  ctx.fillStyle = "rgba(90,92,88,0.9)";
  ctx.fillRect(bx, margenSup * 0.34, 9, alto - margenSup * 0.34);

  tex.update();
  return tex;
}

function crearManzanaVecina(scene: Scene): void {
  const paletas = ["#7a6a5c", "#6b6f74", "#7d7566", "#5f6a6e", "#84766a"];

  // Anillo de galpones alrededor del garaje.
  //
  // Va en anillo y no de un solo lado porque el galpón tiene aberturas en las
  // cuatro paredes: mire por donde mire el jugador, tiene que haber algo. Son
  // catorce cajas — el costo es despreciable y resuelve todos los ángulos.
  const cantidad = 14;

  for (let i = 0; i < cantidad; i++) {
    const angulo = (i / cantidad) * Math.PI * 2 + 0.22;
    const distancia = RADIO_MANZANA + (i % 3) * 9;
    const ancho = 12 + (i % 4) * 5;
    const alto = 6 + (i % 5) * 2.6;
    const fondo = 10 + (i % 3) * 6;

    const mat = pbr(scene, `matVecino_${i}`, Color3.FromHexString(paletas[i % paletas.length]), 0.82);
    mat.albedoTexture = pintarFachada(scene, `texVecino_${i}`, paletas[i % paletas.length]);
    // La textura ya trae el color; el tinte se deja neutro para no ensuciarla.
    mat.albedoColor = new Color3(1, 1, 1);

    // LA MISMA TEXTURA HACE DE MAPA DE BRILLO.
    //
    // Con roughness uniforme, el vidrio y el hormigón reflejan igual, y eso es
    // lo que hace que una fachada se vea impresa. Usando la textura como mapa
    // de microsuperficie, las zonas CLARAS —los vidrios y los reflejos que
    // llevan pintados— quedan pulidas y las oscuras mates.
    //
    // No es físicamente exacto, pero acierta donde importa: las ventanas
    // brillan y el muro no. Y sale gratis, porque reusa una textura que ya
    // estaba en memoria.
    mat.microSurfaceTexture = mat.albedoTexture;
    mat.metallic = 0.22;
    mat.roughness = 0.58;

    // Emisión ligada a la textura: las ventanas encendidas se ven encendidas
    // aunque el edificio esté en sombra. Sin esto, al caer el sol de lado la
    // fachada entera se apagaba por igual y el vecindario parecía deshabitado.
    mat.emissiveTexture = mat.albedoTexture;
    mat.emissiveColor = new Color3(0.16, 0.15, 0.13);

    const edificio = MeshBuilder.CreateBox(`vecino_${i}`, { width: ancho, height: alto, depth: fondo }, scene);
    edificio.position.set(Math.cos(angulo) * distancia, alto / 2, Math.sin(angulo) * distancia);
    edificio.rotation.y = -angulo + (Math.random() - 0.5) * 0.4;
    edificio.material = mat;
    edificio.isPickable = false;
    edificio.receiveShadows = false;

    // Techo a dos aguas insinuado con un prisma achatado y girado: rompe la
    // silueta plana de la caja, que es lo que más delata un edificio falso.
    const matTecho = pbr(scene, `matTechoVecino_${i}`, new Color3(0.3, 0.31, 0.33), 0.7, 0.3);
    const techo = MeshBuilder.CreateCylinder(
      `techoVecino_${i}`,
      { diameter: ancho * 0.78, height: fondo * 1.02, tessellation: 3 },
      scene
    );
    techo.rotation.z = Math.PI / 2;
    techo.rotation.x = Math.PI / 2;
    techo.position.set(0, alto / 2 + ancho * 0.16, 0);
    techo.parent = edificio;
    techo.material = matTecho;
    techo.isPickable = false;
  }
}

// ---------------------------------------------------------------------------
// Vegetación y postes
// ---------------------------------------------------------------------------

// Huella del galpón: 12 m de ancho por 19 m de fondo, centrado en el origen.
const MEDIO_ANCHO_GALPON = 6;
const MEDIO_FONDO_GALPON = 9.5;

/** Empuja un punto hacia afuera si cayó dentro del galpón o demasiado cerca. */
function afueraDelGalpon(x: number, z: number, margen: number): { x: number; z: number } {
  const limiteX = MEDIO_ANCHO_GALPON + margen;
  const limiteZ = MEDIO_FONDO_GALPON + margen;

  if (Math.abs(x) >= limiteX || Math.abs(z) >= limiteZ) return { x, z };

  const sobraX = limiteX - Math.abs(x);
  const sobraZ = limiteZ - Math.abs(z);
  return sobraX < sobraZ
    ? { x: Math.sign(x || 1) * limiteX, z }
    : { x, z: Math.sign(z || 1) * limiteZ };
}

/**
 * Árbol de vereda.
 *
 * POCOS Y BUENOS. Una versión anterior plantaba veinte árboles y una docena de
 * arbustos alrededor del galpón: además de ser un bosque donde debería haber un
 * patio industrial, la repetición de la misma esfera verde una y otra vez es
 * exactamente lo que hace que una escena se vea de plástico. Quedaron cuatro,
 * ubicados a mano frente a las ventanas, y cada uno recibe el detalle que antes
 * se repartía entre veinte.
 *
 * Lo que hace que se lea como un árbol y no como un poste con bolas encima:
 *
 *   - el tronco se abre en dos ramas, así la copa tiene de dónde salir;
 *   - la copa son siete masas de distinto tamaño en desorden, no una esfera;
 *   - cada masa recibe una rotación propia, de modo que el ruido del sombreado
 *     nunca se repite entre dos vecinas;
 *   - hay tres verdes en juego, y las masas de arriba llevan el más claro
 *     porque son las que reciben el sol.
 */
function crearArbol(
  scene: Scene,
  indice: number,
  x: number,
  z: number,
  altura: number,
  escalaCopa: number,
  matTronco: PBRMaterial,
  verdes: PBRMaterial[]
): void {
  const tronco = MeshBuilder.CreateCylinder(
    `troncoExt_${indice}`,
    { diameterTop: 0.22, diameterBottom: 0.46, height: altura, tessellation: 9 },
    scene
  );
  tronco.position.set(x, altura / 2, z);
  tronco.material = matTronco;
  tronco.isPickable = false;

  // Dos ramas que arrancan del tercio superior del tronco.
  [-1, 1].forEach((lado, i) => {
    const rama = MeshBuilder.CreateCylinder(
      `ramaExt_${indice}_${i}`,
      { diameterTop: 0.09, diameterBottom: 0.2, height: altura * 0.42, tessellation: 7 },
      scene
    );
    rama.position.set(x + lado * altura * 0.11, altura * 0.86, z + (i === 0 ? 0.12 : -0.14));
    rama.rotation.z = -lado * 0.5;
    rama.rotation.x = (i === 0 ? 1 : -1) * 0.18;
    rama.material = matTronco;
    rama.isPickable = false;
  });

  // Copa: masas de distinto tamaño, desordenadas y con giro propio.
  const masas: Array<[number, number, number, number, number]> = [
    [0, 1.02, 0, 2.5, 2],
    [0.82, 0.72, 0.3, 1.9, 1],
    [-0.75, 0.8, -0.28, 2.05, 1],
    [0.3, 0.55, -0.8, 1.75, 0],
    [-0.36, 0.6, 0.78, 1.65, 0],
    [0.5, 1.28, -0.2, 1.5, 2],
    [-0.42, 1.2, 0.34, 1.4, 2],
  ];

  masas.forEach(([dx, dy, dz, diametro, indiceVerde], j) => {
    const masa = MeshBuilder.CreateSphere(
      `copaExt_${indice}_${j}`,
      { diameter: diametro * escalaCopa, segments: 10 },
      scene
    );
    masa.position.set(x + dx * escalaCopa, altura + dy * escalaCopa, z + dz * escalaCopa);
    masa.scaling.set(1, 0.74, 1.05);
    // Rotación propia por masa: sin esto el sombreado se repite idéntico entre
    // esferas vecinas y el conjunto se lee como plástico.
    masa.rotation.set(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.5);
    masa.material = verdes[indiceVerde];
    masa.isPickable = false;
  });
}

function crearVegetacion(scene: Scene): void {
  const matTronco = pbr(scene, "matTroncoExterior", new Color3(0.29, 0.22, 0.16), 0.92);

  // Tres verdes: sombra, medio y el que recibe el sol.
  const verdes = [
    pbr(scene, "matCopaOscura", new Color3(0.14, 0.24, 0.13), 0.94),
    pbr(scene, "matCopaMedia", new Color3(0.2, 0.33, 0.17), 0.92),
    pbr(scene, "matCopaClara", new Color3(0.29, 0.44, 0.22), 0.9),
  ];

  // Cuatro árboles, colocados a mano: uno frente a cada pared, a la distancia
  // justa para entrar en el hueco de una ventana sin taparla entera.
  const arboles: Array<[number, number, number, number]> = [
    [-8.4, -2.6, 4.4, 1.05],
    [8.6, 3.2, 4.0, 0.95],
    [-3.6, -12.4, 4.7, 1.12],
    [4.4, 12.6, 4.2, 1.0],
  ];

  arboles.forEach(([px, pz, altura, escala], i) => {
    const { x, z } = afueraDelGalpon(px, pz, 2);
    crearArbol(scene, i, x, z, altura, escala, matTronco, verdes);
  });

  // Césped al pie de las paredes largas. Angosto: es una vereda con pasto, no
  // un parque, y su función es que el galpón no nazca directo del asfalto.
  const matPasto = pbr(scene, "matPastoExterior", new Color3(0.24, 0.33, 0.2), 0.96);
  [-1, 1].forEach((lado, i) => {
    const cantero = MeshBuilder.CreateGround(`canteroExt_${i}`, { width: 2.6, height: 21 }, scene);
    cantero.position.set(lado * 8.1, -0.045, 0);
    cantero.material = matPasto;
    cantero.isPickable = false;
  });
}

function crearPostesDeLuz(scene: Scene): void {
  const matPoste = pbr(scene, "matPosteExterior", new Color3(0.34, 0.35, 0.37), 0.5, 0.6);
  const matLampara = pbr(scene, "matLamparaExterior", new Color3(0.9, 0.88, 0.78), 0.4);
  matLampara.emissiveColor = new Color3(0.55, 0.52, 0.4);

  for (let i = 0; i < 6; i++) {
    const angulo = (i / 6) * Math.PI * 2 + 0.4;
    const distancia = 19;
    const x = Math.cos(angulo) * distancia;
    const z = Math.sin(angulo) * distancia;
    const ALTO = 6.5;

    const mastil = MeshBuilder.CreateCylinder(`posteExt_${i}`, { diameter: 0.22, height: ALTO, tessellation: 8 }, scene);
    mastil.position.set(x, ALTO / 2, z);
    mastil.material = matPoste;
    mastil.isPickable = false;

    const brazo = MeshBuilder.CreateBox(`brazoPosteExt_${i}`, { width: 1.1, height: 0.14, depth: 0.14 }, scene);
    brazo.position.set(x + 0.5, ALTO - 0.2, z);
    brazo.material = matPoste;
    brazo.isPickable = false;

    const luminaria = MeshBuilder.CreateBox(`luminariaExt_${i}`, { width: 0.6, height: 0.16, depth: 0.3 }, scene);
    luminaria.position.set(x + 1.0, ALTO - 0.32, z);
    luminaria.material = matLampara;
    luminaria.isPickable = false;
  }
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

export function crearExteriorGaraje(scene: Scene): { cielo: Mesh; patio: Mesh } {
  // Cúpula: una esfera vista desde adentro. backFaceCulling en false es lo que
  // permite verla desde el interior; sin eso la esfera es invisible.
  const matCielo = new StandardMaterial("matCieloExterior", scene);
  matCielo.backFaceCulling = false;
  matCielo.disableLighting = true;
  matCielo.emissiveTexture = pintarCielo(scene);
  matCielo.diffuseColor = new Color3(0, 0, 0);
  matCielo.specularColor = new Color3(0, 0, 0);

  const cielo = MeshBuilder.CreateSphere("cieloExterior", { diameter: RADIO_CIELO * 2, segments: 28 }, scene);
  cielo.material = matCielo;
  cielo.isPickable = false;
  cielo.receiveShadows = false;
  // infiniteDistance mantiene la cúpula centrada en la cámara: el horizonte no
  // se corre al orbitar y nunca se llega al borde del mundo.
  cielo.infiniteDistance = true;
  cielo.applyFog = false;

  // Patio pavimentado. Va apenas por debajo del piso del galpón para que se
  // lea como un umbral y no pelee con la losa por el mismo plano.
  const matPatio = new PBRMaterial("matPatioExterior", scene);
  matPatio.albedoTexture = pintarPavimento(scene);
  matPatio.roughness = 0.86;
  matPatio.metallic = 0.05;
  matPatio.emissiveColor = new Color3(0.05, 0.05, 0.05);

  const patio = MeshBuilder.CreateGround("patioExterior", { width: 220, height: 220 }, scene);
  patio.position.y = -0.05;
  patio.material = matPatio;
  patio.isPickable = false;
  patio.receiveShadows = false;

  crearManzanaVecina(scene);
  crearVegetacion(scene);
  crearPostesDeLuz(scene);

  return { cielo, patio };
}

/**
 * Vuelve transparentes los vidrios del garaje.
 *
 * El modelo trae un material propio para los cristales, pero opaco: las
 * ventanas se veían como paneles blancos y tapaban justamente lo que hay que
 * mostrar. Se los busca por nombre y, si el modelo cambia y no aparece ninguno,
 * simplemente no se hace nada — nunca rompe la carga.
 */
export function hacerVidriosTransparentes(scene: Scene): number {
  let ajustados = 0;

  scene.materials.forEach((mat) => {
    const nombre = mat.name.toLowerCase();
    if (!nombre.includes("cristal") && !nombre.includes("vidrio") && !nombre.includes("glass")) return;

    mat.alpha = 0.14;
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND;

    if (mat instanceof PBRMaterial) {
      mat.albedoColor = new Color3(0.6, 0.7, 0.76);
      mat.roughness = 0.05;
      mat.metallic = 0.1;
      mat.backFaceCulling = false;
    } else if (mat instanceof StandardMaterial) {
      mat.diffuseColor = new Color3(0.6, 0.7, 0.76);
      mat.specularPower = 128;
      mat.backFaceCulling = false;
    }

    ajustados++;
  });

  return ajustados;
}