import {
  Scene,
  Mesh,
  MeshBuilder,
  VertexData,
  PBRMaterial,
  Color3,
  Vector3,
  Matrix,
  DynamicTexture,
  Texture,
} from "@babylonjs/core";
import { crearAzar, fbm, normalesDesdeAltura, subirMapa, type Mapa } from "./TexturasPBR";
import { texturaToldo, type Edificio } from "./ExteriorSupermercado";

// ===========================================================================
// Los edificios de fuera del banco, con volumen
// ===========================================================================
//
// Eran una caja con la fachada pintada encima: ventanas, marcos y cortinas
// dibujados en un plano. De frente pasaba; por las ventanas del hall, a diez
// metros y en sesgo, se veía lo que era, un cartón liso con los vidrios
// celestes de un dibujo, y la luz resbalaba igual por todo: plástico.
//
// ─── LO QUE HACE QUE UN EDIFICIO SE LEA DE VERDAD ────────────────────────
//
//   · PROFUNDIDAD. Cada ventana es un hueco en el muro: el vidrio catorce
//     centímetros hacia dentro, con sus jambas y su dintel, el marco y el
//     parteluz, y el alféizar de piedra que sobresale. El sol los recorta con
//     sombras de verdad, que es lo primero que dice "muro".
//   · VIDRIO QUE REFLEJA. Liso y oscuro, con el reflejo de la cuadra y del
//     cielo (la sonda del exterior); detrás, un cuarto a oscuras, un visillo,
//     una persiana a medio bajar, una cortina corrida: cada ventana la suya.
//   · UN REVOQUE CON RELIEVE Y CON AÑOS. El grano del estuco en un mapa de
//     normales, para que la luz rasante lo levante; y la suciedad donde la
//     deja la lluvia: chorreada bajo cada alféizar, más oscura abajo, donde
//     salpica la vereda, y bajo la cornisa. Rugoso y casi sin reflejo.
//   · LO QUE CUELGA DE UN EDIFICIO. Cornisa, molduras entre pisos, zócalo de
//     piedra, bajada de agua con sus abrazaderas, algún equipo de aire
//     acondicionado bajo una ventana, rejas en las del primer piso, balcones
//     con baranda, letreros de los locales en volumen y el toldo.
//
// Todo va en unas pocas mallas por edificio, una por material, ya en su
// sitio del mundo: el exterior no se mueve, y así cuesta lo mismo que antes.
//
// ─── SIN AZAR ENTRE PARTIDAS ─────────────────────────────────────────────
//
// Cada edificio tiene su semilla: qué ventana tiene persiana, cuál tiene el
// aire acondicionado, cómo cae la suciedad. Siempre igual.

/** Lo que se pinta detrás de cada vidrio: ocho interiores en una sola textura. */
const CELDAS_X = 4;
const CELDAS_Y = 2;
const INTERIOR = {
  oscuro: 0,
  visillo: 1,
  cortinaIzquierda: 2,
  persiana: 3,
  cortinaDerecha: 4,
  roller: 5,
  planta: 6,
  oficina: 7,
} as const;

/** Cuánto se hunde el vidrio de una ventana en el muro, y el de la vitrina y el portal. */
const HONDO_VENTANA = 0.14;
const HONDO_VITRINA = 0.2;
const HONDO_PORTAL = 0.35;
/** Cuánto hay entre el muro de la fachada y el cuerpo del edificio: lo que ocupan los huecos. */
const ESPESOR = 0.4;
/** El lado de las texturas que se repiten: el grano del revoque, en metros. */
const TESELA_REVOQUE = 1.6;
/** La del ladrillo: cuatro ladrillos de 25 cm por ocho hiladas de 7,5 cm. */
const TESELA_LADRILLO_U = 1.0;
const TESELA_LADRILLO_V = 0.6;

// ---------------------------------------------------------------------------
// Una obra: caras que se van juntando para una sola malla
// ---------------------------------------------------------------------------

/**
 * Hacia qué lado mira una cara según el orden de sus vértices, en Babylon.
 * Se mide una vez con su propio cálculo de normales: así las caras que se
 * arman aquí salen del mismo lado que las de MeshBuilder y no hay que adivinar.
 */
let SIGNO = 0;
function signo(): number {
  if (SIGNO) return SIGNO;
  const normales: number[] = [];
  VertexData.ComputeNormals([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], normales);
  SIGNO = normales[2] > 0 ? 1 : -1;
  return SIGNO;
}

type UV = [number, number];

class Obra {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  ind: number[] = [];

  /**
   * Un cuadrilátero de cuatro puntos en orden de vuelta, con la normal que
   * tiene que tener. El orden de los índices se elige para que mire hacia ella.
   */
  quad(p: Vector3[], n: Vector3, uvs: UV[], tono = 1): void {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i].x, p[i].y, p[i].z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(tono, tono, tono, 1);
    }
    const ax = p[1].x - p[0].x, ay = p[1].y - p[0].y, az = p[1].z - p[0].z;
    const bx = p[2].x - p[0].x, by = p[2].y - p[0].y, bz = p[2].z - p[0].z;
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const deFrente = (cx * n.x + cy * n.y + cz * n.z) * signo() > 0;
    const orden = deFrente ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of orden) this.ind.push(base + i);
  }

  /**
   * Una caja entre dos esquinas. Las UV salen del mundo, en metros divididos
   * por la tesela, o de la función que se le pase. `tonos` oscurece caras
   * sueltas —la de abajo de una cornisa está en su propia sombra—.
   */
  caja(
    min: Vector3,
    max: Vector3,
    uvDe: (p: Vector3, n: Vector3) => UV = uvPlanar(1),
    tonos: Partial<Record<"arriba" | "abajo" | "frente" | "fondo" | "lados", number>> = {},
    sinFondo = true
  ): void {
    const [x0, y0, z0] = [min.x, min.y, min.z];
    const [x1, y1, z1] = [max.x, max.y, max.z];
    const cara = (pts: [number, number, number][], n: Vector3, tono: number): void => {
      const p = pts.map(([x, y, z]) => new Vector3(x, y, z));
      this.quad(p, n, p.map((q) => uvDe(q, n)), tono);
    };
    const lado = tonos.lados ?? 1;
    // Frente (−Z: hacia la calle), arriba, abajo, los dos lados y el fondo.
    cara([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], new Vector3(0, 0, -1), tonos.frente ?? 1);
    cara([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], new Vector3(0, 1, 0), tonos.arriba ?? 1);
    cara([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], new Vector3(0, -1, 0), tonos.abajo ?? 0.7);
    cara([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], new Vector3(-1, 0, 0), lado);
    cara([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], new Vector3(1, 0, 0), lado);
    if (!sinFondo) cara([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], new Vector3(0, 0, 1), tonos.fondo ?? 1);
  }

  /** Suma una malla hecha por Babylon (un cilindro), transformada. */
  sumar(vd: VertexData, m: Matrix, tono = 1): void {
    const base = this.pos.length / 3;
    const p = vd.positions!;
    const n = vd.normals!;
    const t = vd.uvs!;
    const v = new Vector3();
    for (let i = 0; i < p.length / 3; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], m, v);
      this.pos.push(v.x, v.y, v.z);
      Vector3.TransformNormalFromFloatsToRef(n[i * 3], n[i * 3 + 1], n[i * 3 + 2], m, v);
      v.normalize();
      this.nor.push(v.x, v.y, v.z);
      this.uv.push(t[i * 2], t[i * 2 + 1]);
      this.col.push(tono, tono, tono, 1);
    }
    for (const i of vd.indices!) this.ind.push(base + i);
  }

  vacia(): boolean {
    return this.ind.length === 0;
  }

  /** La malla, ya en el mundo: se lleva todo por la matriz del edificio. */
  malla(scene: Scene, nombre: string, material: PBRMaterial, m: Matrix): Mesh {
    const v = new Vector3();
    const pos = new Float32Array(this.pos.length);
    const nor = new Float32Array(this.nor.length);
    for (let i = 0; i < this.pos.length / 3; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], m, v);
      pos.set([v.x, v.y, v.z], i * 3);
      Vector3.TransformNormalFromFloatsToRef(this.nor[i * 3], this.nor[i * 3 + 1], this.nor[i * 3 + 2], m, v);
      v.normalize();
      nor.set([v.x, v.y, v.z], i * 3);
    }
    const vd = new VertexData();
    vd.positions = pos;
    vd.normals = nor;
    vd.uvs = new Float32Array(this.uv);
    vd.colors = new Float32Array(this.col);
    vd.indices = this.ind.length > 65535 ? new Uint32Array(this.ind) : new Uint16Array(this.ind);
    const malla = new Mesh(nombre, scene);
    vd.applyToMesh(malla, false);
    malla.hasVertexAlpha = false;
    malla.material = material;
    malla.isPickable = false;
    return malla;
  }
}

/** UV planares en metros según hacia dónde mira la cara. */
function uvPlanar(tesela: number): (p: Vector3, n: Vector3) => UV {
  return (p, n) => {
    if (Math.abs(n.y) > 0.5) return [p.x / tesela, p.z / tesela];
    if (Math.abs(n.x) > 0.5) return [p.z / tesela, p.y / tesela];
    return [p.x / tesela, p.y / tesela];
  };
}

// ---------------------------------------------------------------------------
// Texturas compartidas
// ---------------------------------------------------------------------------

/**
 * El grano del estuco, como relieve: poros de milímetros y ondas de
 * centímetros. Se calcula una vez; cada edificio sube su copia, porque cada
 * uno la repite a su propia escala.
 */
function normalRevoque(): Mapa {
  const L = 256;
  const altura = new Float32Array(L * L);
  const m = TESELA_REVOQUE / L;
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const u = x * m;
      const v = y * m;
      altura[y * L + x] =
        (fbm(u * 90, v * 90, 11, 3) - 0.5) * 0.0016 + (fbm(u * 14, v * 14, 23, 3) - 0.5) * 0.0012 + (fbm(u * 3, v * 3, 5, 2) - 0.5) * 0.002;
    }
  }
  return { ancho: L, alto: L, datos: normalesDesdeAltura(altura, L, L, m, m, 1) };
}

/** Hiladas de ladrillo con la cantería hundida, repitiéndose sin corte. */
function normalLadrillo(): Mapa {
  const W = 256;
  const H = 256;
  const mu = TESELA_LADRILLO_U / W;
  const mv = TESELA_LADRILLO_V / H;
  const altura = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const vy = y * mv;
    const hilada = Math.floor(vy / 0.075);
    const enHilada = vy - hilada * 0.075;
    for (let x = 0; x < W; x++) {
      const ux = x * mu + (hilada % 2) * 0.125;
      const enLadrillo = ((ux % 0.25) + 0.25) % 0.25;
      const junta = Math.min(enHilada, 0.075 - enHilada) < 0.006 || Math.min(enLadrillo, 0.25 - enLadrillo) < 0.006;
      altura[y * W + x] = junta ? -0.004 : (fbm(x * 0.3, y * 0.3, 41, 2) - 0.5) * 0.001;
    }
  }
  return { ancho: W, alto: H, datos: normalesDesdeAltura(altura, W, H, mu, mv, 1) };
}

function lienzo(scene: Scene, nombre: string, w: number, h: number): { tex: DynamicTexture; ctx: CanvasRenderingContext2D } {
  const tex = new DynamicTexture(nombre, { width: w, height: h }, scene, true);
  tex.anisotropicFilteringLevel = 8;
  return { tex, ctx: tex.getContext() as unknown as CanvasRenderingContext2D };
}

/** Pliegues verticales de una tela: franjas claras y oscuras que se repiten algo irregulares. */
function pliegues(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, paso: number, azar: () => number, alfa = 1): void {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  for (let k = 0; k < w; k += paso * (0.7 + azar() * 0.6)) {
    const g = ctx.createLinearGradient(x + k, 0, x + k + paso, 0);
    g.addColorStop(0, "rgba(0,0,0,0.22)");
    g.addColorStop(0.45, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(x + k, y, paso, h);
  }
  // Más oscuro abajo, donde la tela se junta y le llega menos luz.
  const abajo = ctx.createLinearGradient(0, y, 0, y + h);
  abajo.addColorStop(0, "rgba(0,0,0,0)");
  abajo.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = abajo;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Los ocho interiores detrás de los vidrios, uno por celda. De día, desde la
 * calle, un cuarto se ve oscuro: lo que se distingue es lo que está pegado al
 * vidrio —una cortina, una persiana, una planta— y, al fondo, apenas el techo
 * con algo de luz.
 */
function texturaInteriores(scene: Scene): DynamicTexture {
  const CW = 128;
  const CH = 192;
  const { tex, ctx } = lienzo(scene, "texInterioresEdificios", CW * CELDAS_X, CH * CELDAS_Y);
  const azar = crearAzar(77);
  const cuarto = (x: number, y: number, claridad: number): void => {
    const g = ctx.createLinearGradient(0, y, 0, y + CH);
    g.addColorStop(0, `rgb(${Math.round(58 * claridad)},${Math.round(56 * claridad)},${Math.round(54 * claridad)})`);
    g.addColorStop(0.35, `rgb(${Math.round(30 * claridad)},${Math.round(29 * claridad)},${Math.round(28 * claridad)})`);
    g.addColorStop(1, `rgb(${Math.round(16 * claridad)},${Math.round(15 * claridad)},${Math.round(15 * claridad)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, CW, CH);
    // El fondo del cuarto: una pared algo más clara y el marco de una puerta.
    ctx.fillStyle = `rgba(90,86,80,${0.12 * claridad})`;
    ctx.fillRect(x + CW * 0.15, y + CH * 0.18, CW * 0.7, CH * 0.5);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + CW * 0.62, y + CH * 0.3, CW * 0.18, CH * 0.45);
  };
  for (let i = 0; i < CELDAS_X * CELDAS_Y; i++) {
    const x = (i % CELDAS_X) * CW;
    const y = Math.floor(i / CELDAS_X) * CH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, CW, CH);
    ctx.clip();
    switch (i) {
      case INTERIOR.oscuro:
        cuarto(x, y, 1);
        // Un mueble contra la pared y una lámpara de pie.
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x + 8, y + CH * 0.62, CW * 0.45, CH * 0.38);
        ctx.fillStyle = "rgba(120,110,90,0.25)";
        ctx.fillRect(x + CW * 0.78, y + CH * 0.35, 14, 10);
        break;
      case INTERIOR.visillo:
        cuarto(x, y, 1.1);
        pliegues(ctx, x, y, CW, CH, "rgb(226,224,216)", 11, azar, 0.78);
        break;
      case INTERIOR.cortinaIzquierda:
        cuarto(x, y, 0.9);
        pliegues(ctx, x, y, CW * 0.42, CH, "rgb(196,178,142)", 12, azar);
        break;
      case INTERIOR.persiana: {
        cuarto(x, y, 1);
        // Persiana americana bajada hasta más de la mitad: listones con su
        // sombra, y abajo el cuarto.
        const hasta = CH * 0.62;
        for (let k = 0; k < hasta; k += 7) {
          ctx.fillStyle = "rgb(206,204,198)";
          ctx.fillRect(x, y + k, CW, 5);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(x, y + k + 5, CW, 2);
        }
        ctx.fillStyle = "rgb(150,148,142)";
        ctx.fillRect(x, y + hasta, CW, 4);
        break;
      }
      case INTERIOR.cortinaDerecha:
        cuarto(x, y, 0.9);
        pliegues(ctx, x + CW * 0.5, y, CW * 0.5, CH, "rgb(104,40,38)", 13, azar);
        break;
      case INTERIOR.roller: {
        cuarto(x, y, 1);
        const hasta = CH * 0.68;
        const g = ctx.createLinearGradient(0, y, 0, y + hasta);
        g.addColorStop(0, "rgb(222,218,206)");
        g.addColorStop(1, "rgb(196,192,180)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, CW, hasta);
        ctx.fillStyle = "rgb(120,118,112)";
        ctx.fillRect(x, y + hasta - 3, CW, 5);
        break;
      }
      case INTERIOR.planta:
        cuarto(x, y, 1.15);
        // Una planta en el alféizar de dentro, a contraluz.
        ctx.fillStyle = "rgb(96,62,40)";
        ctx.fillRect(x + CW * 0.18, y + CH * 0.84, CW * 0.2, CH * 0.16);
        for (let k = 0; k < 14; k++) {
          ctx.fillStyle = k % 3 === 0 ? "rgb(42,70,34)" : "rgb(30,52,26)";
          ctx.beginPath();
          ctx.ellipse(
            x + CW * (0.2 + azar() * 0.22),
            y + CH * (0.62 + azar() * 0.2),
            5 + azar() * 7,
            9 + azar() * 8,
            azar() * 3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        break;
      case INTERIOR.oficina: {
        // Oficina: lamas verticales cerradas, gris claro, y una franja de
        // tubos encendidos que se cuela arriba.
        cuarto(x, y, 1.2);
        for (let k = 0; k < CW; k += 10) {
          ctx.fillStyle = "rgb(186,188,186)";
          ctx.fillRect(x + k, y + 8, 8, CH - 8);
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(x + k + 8, y + 8, 2, CH - 8);
        }
        ctx.fillStyle = "rgba(240,245,245,0.5)";
        ctx.fillRect(x, y, CW, 6);
        break;
      }
    }
    // El vidrio mismo: algo de polvo y una veladura pareja.
    ctx.fillStyle = "rgba(160,170,178,0.06)";
    ctx.fillRect(x, y, CW, CH);
    ctx.restore();
  }
  tex.update(true);
  return tex;
}

/** El interior de un local visto por la vitrina: luz, estanterías con productos y el mesón. */
function texturaTienda(scene: Scene): DynamicTexture {
  const W = 512;
  const H = 256;
  const { tex, ctx } = lienzo(scene, "texTiendaEdificios", W, H);
  const azar = crearAzar(91);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgb(214,206,190)");
  g.addColorStop(0.6, "rgb(150,142,128)");
  g.addColorStop(1, "rgb(96,90,82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Tubos del techo.
  for (let x = 30; x < W; x += 120) {
    ctx.fillStyle = "rgba(255,252,240,0.85)";
    ctx.fillRect(x, 10, 70, 5);
  }
  // Estanterías contra el fondo, con productos de colores.
  const colores = ["#b53b33", "#2f6aa3", "#e1b73c", "#3c8a4f", "#e6e0d4", "#7a4b8f", "#d9772e"];
  for (let fila = 0; fila < 4; fila++) {
    const y = 48 + fila * 38;
    ctx.fillStyle = "rgb(70,66,60)";
    ctx.fillRect(0, y + 28, W, 4);
    for (let x = 4; x < W - 10; ) {
      const w = 6 + Math.floor(azar() * 10);
      const h = 12 + Math.floor(azar() * 14);
      ctx.fillStyle = colores[Math.floor(azar() * colores.length)];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, y + 28 - h, w, h);
      ctx.globalAlpha = 1;
      x += w + 2;
    }
  }
  // El mesón, delante.
  ctx.fillStyle = "rgb(60,52,44)";
  ctx.fillRect(W * 0.55, H * 0.72, W * 0.4, H * 0.28);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, W, H);
  tex.update(true);
  return tex;
}

/**
 * La unidad de fuera de un aire acondicionado: la rejilla redonda del
 * ventilador a la izquierda y las celosías a la derecha. La esquina de
 * abajo a la derecha es chapa lisa, para las caras que no son el frente.
 */
function texturaAire(scene: Scene): DynamicTexture {
  const W = 256;
  const H = 128;
  const { tex, ctx } = lienzo(scene, "texAireEdificios", W, H);
  ctx.fillStyle = "rgb(214,215,212)";
  ctx.fillRect(0, 0, W, H);
  const cx = 70;
  const cy = 64;
  ctx.fillStyle = "rgb(40,42,44)";
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(150,152,150)";
  ctx.lineWidth = 2;
  for (let r = 10; r <= 50; r += 8) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy);
  ctx.lineTo(cx + 50, cy);
  ctx.moveTo(cx, cy - 50);
  ctx.lineTo(cx, cy + 50);
  ctx.stroke();
  for (let y = 16; y < 104; y += 7) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(150, y, 90, 3);
  }
  // Una marca de óxido chorreada bajo la unidad, y polvo.
  ctx.fillStyle = "rgba(120,90,60,0.12)";
  ctx.fillRect(0, H - 10, W, 10);
  tex.update(true);
  return tex;
}

// ---------------------------------------------------------------------------
// El taller: materiales compartidos y cada edificio
// ---------------------------------------------------------------------------

export interface TallerFachadas {
  /**
   * Un edificio con su fachada en volumen, mirando a −Z en su propio espacio
   * (como un plano de Babylon), girado y puesto en el mundo.
   *
   * @returns Sus mallas, ya en el mundo: una por material.
   */
  edificio(nombre: string, e: Edificio, centro: Vector3, giro: number, fondo: number, semilla: number): Mesh[];
}

export function crearTallerFachadas(scene: Scene): TallerFachadas {
  const datosRevoque = normalRevoque();
  const datosLadrillo = normalLadrillo();
  let subidas = 0;
  /** Un relieve propio, repetido a la escala que se le diga. */
  const relieve = (ladrillo: boolean, uScale: number, vScale: number, nivel: number): Texture => {
    const t = ladrillo
      ? subirMapa(scene, `normalLadrillo_${subidas++}`, datosLadrillo, false, Texture.WRAP_ADDRESSMODE)
      : subirMapa(scene, `normalRevoque_${subidas++}`, datosRevoque, false);
    t.uScale = uScale;
    t.vScale = vScale;
    t.level = nivel;
    return t;
  };
  const lineal = (hex: string): Color3 => Color3.FromHexString(hex).toLinearSpace();

  const vidrio = new PBRMaterial("matVidrioEdificios", scene);
  vidrio.albedoTexture = texturaInteriores(scene);
  vidrio.roughness = 0.05;
  vidrio.metallic = 0;
  vidrio.environmentIntensity = 1;

  const vidrioTienda = new PBRMaterial("matVitrinaEdificios", scene);
  vidrioTienda.albedoTexture = texturaTienda(scene);
  vidrioTienda.roughness = 0.05;
  vidrioTienda.metallic = 0;
  vidrioTienda.environmentIntensity = 1;

  // Los colores de los materiales, en lineal: es como los lee el PBR.
  const piedra = new PBRMaterial("matPiedraEdificios", scene);
  piedra.albedoColor = lineal("#b8b3aa");
  piedra.roughness = 0.88;
  piedra.metallic = 0;
  piedra.environmentIntensity = 0.5;
  piedra.bumpTexture = relieve(false, 1, 1, 0.8);

  const metal = new PBRMaterial("matMetalEdificios", scene);
  metal.albedoColor = lineal("#2a2c2f");
  metal.metallic = 0.7;
  metal.roughness = 0.45;

  const pvc = new PBRMaterial("matBajadaEdificios", scene);
  pvc.albedoColor = lineal("#9a9c9a");
  pvc.metallic = 0;
  pvc.roughness = 0.55;

  const aire = new PBRMaterial("matAireEdificios", scene);
  aire.albedoTexture = texturaAire(scene);
  aire.metallic = 0.2;
  aire.roughness = 0.5;

  const marcos = new Map<string, PBRMaterial>();
  const marco = (hex: string): PBRMaterial => {
    let m = marcos.get(hex);
    if (m) return m;
    const color = Color3.FromHexString(hex);
    m = new PBRMaterial(`matMarco_${hex.slice(1)}_Edificios`, scene);
    m.albedoColor = color.toLinearSpace().scale(0.92);
    // El claro, PVC; el oscuro, aluminio.
    const oscuro = color.r + color.g + color.b < 1;
    m.metallic = oscuro ? 0.55 : 0;
    m.roughness = oscuro ? 0.35 : 0.42;
    marcos.set(hex, m);
    return m;
  };

  const interiorDeVentana = (celda: number, espejo: boolean): UV[] => {
    const u0 = (celda % CELDAS_X) / CELDAS_X;
    const u1 = u0 + 1 / CELDAS_X;
    const fila = Math.floor(celda / CELDAS_X);
    const v1 = 1 - fila / CELDAS_Y;
    const v0 = v1 - 1 / CELDAS_Y;
    const [a, b] = espejo ? [u1, u0] : [u0, u1];
    return [
      [a, v0],
      [b, v0],
      [b, v1],
      [a, v1],
    ];
  };

  return {
    edificio(nombre, e, centro, giro, fondo, semilla) {
      const W = e.x1 - e.x0;
      const H = e.alto;
      const azar = crearAzar(semilla);
      const mundo = Matrix.RotationY(giro).multiply(Matrix.Translation(centro.x, centro.y, centro.z));

      // --- Dónde va cada cosa ---------------------------------------------------
      //
      // La misma composición que tenía la fachada pintada: el local abajo, más
      // alto que los pisos, y una retícula de ventanas encima.
      const ALTO_LOCAL = 3.6;
      const altoPiso = (H - ALTO_LOCAL - 0.6) / Math.max(1, e.pisos - 1);
      const cols = Math.max(2, Math.round(W / 2.6));
      const paso = W / cols;
      const colX = (c: number): number => -W / 2 + paso * (c + 0.5);

      interface Hueco {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
        hondo: number;
        tipo: "ventana" | "balcon" | "vitrina" | "portal" | "baja";
      }
      const huecos: Hueco[] = [];
      for (let piso = 1; piso < e.pisos; piso++) {
        const base = ALTO_LOCAL + 0.3 + (piso - 1) * altoPiso;
        for (let c = 0; c < cols; c++) {
          const w = Math.min(1.5, paso * 0.58);
          const y1 = base + altoPiso * 0.82;
          // Con balcón, la ventana baja hasta la losa: es la puerta del balcón.
          const y0 = e.balcones ? base + 0.12 : y1 - altoPiso * 0.55;
          huecos.push({ x0: colX(c) - w / 2, x1: colX(c) + w / 2, y0, y1, hondo: HONDO_VENTANA, tipo: e.balcones ? "balcon" : "ventana" });
        }
      }
      const margen = Math.max(0.6, W * 0.08);
      if (e.local) {
        huecos.push({ x0: -W / 2 + margen, x1: W / 2 - margen, y0: 0.35, y1: 2.6, hondo: HONDO_VITRINA, tipo: "vitrina" });
      } else {
        huecos.push({ x0: -1.1, x1: 1.1, y0: 0, y1: 2.75, hondo: HONDO_PORTAL, tipo: "portal" });
        for (let c = 0; c < cols; c++) {
          if (Math.abs(colX(c)) < 2.2) continue;
          const w = Math.min(1.4, paso * 0.55);
          huecos.push({ x0: colX(c) - w / 2, x1: colX(c) + w / 2, y0: 1.05, y1: 2.65, hondo: HONDO_VENTANA, tipo: "baja" });
        }
      }

      // --- El revoque, pintado a la medida de esta fachada -------------------------
      //
      // Color con sus manchas, la suciedad chorreada bajo cada alféizar, la de
      // abajo y la de bajo la cornisa. Si es de ladrillo, las hiladas, a la
      // misma medida que su relieve.
      const PX = 40;
      const TW = Math.min(1024, Math.round(W * PX));
      const TH = Math.min(1024, Math.round(H * PX));
      const sx = TW / W;
      const sy = TH / H;
      const { tex: texMuro, ctx } = lienzo(scene, `texMuro_${nombre}`, TW, TH);
      const aCanvas = (x: number, y: number): [number, number] => [(x + W / 2) * sx, TH - y * sy];
      ctx.fillStyle = e.muro;
      ctx.fillRect(0, 0, TW, TH);
      if (e.ladrillo) {
        for (let fila = 0; fila * 0.075 < H; fila++) {
          const y = fila * 0.075;
          for (let x = -W / 2 - (fila % 2) * 0.125; x < W / 2; x += 0.25) {
            const t = 0.82 + azar() * 0.3;
            ctx.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(82 * t)},${Math.round(60 * t)})`;
            const [px, py] = aCanvas(x, y + 0.075);
            ctx.fillRect(px + 0.5, py + 0.5, 0.25 * sx - 1, 0.075 * sy - 1);
          }
        }
      }
      // Manchas grandes: el tono nunca es parejo en un muro con años.
      {
        const C = 64;
        const chico = document.createElement("canvas");
        chico.width = C;
        chico.height = C;
        const c2 = chico.getContext("2d");
        if (c2) {
          const img = c2.createImageData(C, C);
          for (let y = 0; y < C; y++) {
            for (let x = 0; x < C; x++) {
              const n = fbm((x / C) * W * 0.35, (y / C) * H * 0.35, semilla, 4) - 0.5;
              const i = (y * C + x) * 4;
              const claro = n > 0;
              img.data[i] = claro ? 255 : 30;
              img.data[i + 1] = claro ? 250 : 26;
              img.data[i + 2] = claro ? 240 : 20;
              img.data[i + 3] = Math.min(255, Math.abs(n) * (claro ? 70 : 120));
            }
          }
          c2.putImageData(img, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(chico, 0, 0, TW, TH);
        }
      }
      // Chorreado bajo cada alféizar: la lluvia arrastra el polvo del alféizar
      // y lo deja en lenguas que se apagan hacia abajo.
      for (const h of huecos) {
        if (h.tipo === "portal" || h.tipo === "vitrina") continue;
        const largo = 0.8 + azar() * 1.2;
        const [px0, py0] = aCanvas(h.x0 + 0.05, h.y0);
        const ancho = (h.x1 - h.x0 - 0.1) * sx;
        for (let k = 0; k < 7; k++) {
          const lx = px0 + azar() * ancho;
          const lw = (0.04 + azar() * 0.14) * sx;
          const ll = largo * (0.4 + azar() * 0.6) * sy;
          const g = ctx.createLinearGradient(0, py0, 0, py0 + ll);
          g.addColorStop(0, `rgba(48,42,34,${0.1 + azar() * 0.1})`);
          g.addColorStop(1, "rgba(48,42,34,0)");
          ctx.fillStyle = g;
          ctx.fillRect(lx, py0, lw, ll);
        }
      }
      // Abajo: lo que salpica la vereda y lo que deja la gente al apoyarse.
      {
        const g = ctx.createLinearGradient(0, TH - 1.6 * sy, 0, TH);
        g.addColorStop(0, "rgba(40,36,30,0)");
        g.addColorStop(1, "rgba(40,36,30,0.3)");
        ctx.fillStyle = g;
        ctx.fillRect(0, TH - 1.6 * sy, TW, 1.6 * sy);
        for (let k = 0; k < W * 90; k++) {
          ctx.fillStyle = `rgba(35,30,25,${0.05 + azar() * 0.1})`;
          const r = 1 + azar() * 2.5;
          ctx.fillRect(azar() * TW, TH - azar() * azar() * 0.9 * sy, r, r);
        }
      }
      // Bajo la cornisa, donde no lava la lluvia.
      {
        const g = ctx.createLinearGradient(0, 0, 0, 0.9 * sy);
        g.addColorStop(0, "rgba(38,34,28,0.22)");
        g.addColorStop(1, "rgba(38,34,28,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, TW, 0.9 * sy);
      }
      // El grano fino del color, que el relieve completa.
      for (let k = 0; k < TW * TH * 0.015; k++) {
        ctx.fillStyle = azar() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(azar() * TW, azar() * TH, 1.5, 1.5);
      }
      texMuro.update(true);

      const revoque = new PBRMaterial(`matMuro_${nombre}`, scene);
      revoque.albedoTexture = texMuro;
      revoque.metallic = 0;
      revoque.roughness = 0.93;
      // Casi sin reflejo del entorno: un revoque no brilla.
      revoque.environmentIntensity = 0.45;
      revoque.bumpTexture = e.ladrillo
        ? relieve(true, W / TESELA_LADRILLO_U, H / TESELA_LADRILLO_V, 1)
        : relieve(false, W / TESELA_REVOQUE, H / TESELA_REVOQUE, 0.9);

      const cuerpoMat = new PBRMaterial(`matCuerpo_${nombre}`, scene);
      cuerpoMat.albedoColor = lineal(e.muro).scale(0.8);
      cuerpoMat.metallic = 0;
      cuerpoMat.roughness = 0.93;
      cuerpoMat.environmentIntensity = 0.45;

      // --- Las obras: una por material --------------------------------------------
      const muro = new Obra();
      const oVidrio = new Obra();
      const oTienda = new Obra();
      const oMarco = new Obra();
      const oPiedra = new Obra();
      const oMetal = new Obra();
      const oPvc = new Obra();
      const oAire = new Obra();
      const oCuerpo = new Obra();
      const oLetrero = new Obra();
      const uvMuro = (p: Vector3): UV => [(p.x + W / 2) / W, p.y / H];
      const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

      // El muro con sus huecos: por franjas horizontales entre los bordes de
      // los huecos, y en cada franja lo que queda entre ellos.
      const cortes = [...new Set([0, H, ...huecos.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
      for (let i = 0; i < cortes.length - 1; i++) {
        const ya = cortes[i];
        const yb = cortes[i + 1];
        if (yb - ya < 1e-4) continue;
        const tapan = huecos
          .filter((h) => h.y0 <= ya + 1e-4 && h.y1 >= yb - 1e-4)
          .map((h) => [h.x0, h.x1])
          .sort((a, b) => a[0] - b[0]);
        let x = -W / 2;
        const franja = (xa: number, xb: number): void => {
          if (xb - xa < 1e-4) return;
          const p = [V(xa, ya, 0), V(xb, ya, 0), V(xb, yb, 0), V(xa, yb, 0)];
          muro.quad(p, V(0, 0, -1), p.map(uvMuro));
        };
        for (const [x0, x1] of tapan) {
          franja(x, x0);
          x = Math.max(x, x1);
        }
        franja(x, W / 2);
      }
      // Los cantos del muro y su tapa: el espesor entre la fachada y el cuerpo.
      for (const s of [-1, 1]) {
        const xs = (s * W) / 2;
        const p = [V(xs, 0, 0), V(xs, 0, ESPESOR), V(xs, H, ESPESOR), V(xs, H, 0)];
        muro.quad(p, V(s, 0, 0), p.map(uvMuro), 0.85);
      }
      oCuerpo.caja(V(-W / 2, 0, ESPESOR), V(W / 2, H, fondo), uvPlanar(4), { frente: 0.8 }, false);

      // Cada hueco: jambas, dintel, el vidrio al fondo, el marco y el alféizar.
      let aires = 0;
      for (const h of huecos) {
        const d = h.hondo;
        const jamba = (x: number, s: number): void => {
          const p = [V(x, h.y0, 0), V(x, h.y0, d), V(x, h.y1, d), V(x, h.y1, 0)];
          muro.quad(p, V(s, 0, 0), p.map(uvMuro), 0.74);
        };
        jamba(h.x0, 1);
        jamba(h.x1, -1);
        const dintel = [V(h.x0, h.y1, 0), V(h.x1, h.y1, 0), V(h.x1, h.y1, d), V(h.x0, h.y1, d)];
        muro.quad(dintel, V(0, -1, 0), dintel.map(uvMuro), 0.58);
        if (h.tipo !== "ventana" && h.tipo !== "baja") {
          const piso = [V(h.x0, h.y0, 0), V(h.x0, h.y0, d), V(h.x1, h.y0, d), V(h.x1, h.y0, 0)];
          oPiedra.quad(piso, V(0, 1, 0), piso.map((q) => [q.x, q.z] as UV), 0.9);
        }

        // El vidrio, al fondo del hueco.
        const vid = [V(h.x0, h.y0, d), V(h.x1, h.y0, d), V(h.x1, h.y1, d), V(h.x0, h.y1, d)];
        if (h.tipo === "vitrina") {
          const n = Math.max(1, Math.round((h.x1 - h.x0) / 3));
          const uvs: UV[] = [
            [0, 0],
            [n, 0],
            [n, 1],
            [0, 1],
          ];
          oTienda.quad(vid, V(0, 0, -1), uvs);
        } else {
          const opciones: number[] =
            h.tipo === "balcon"
              ? [INTERIOR.visillo, INTERIOR.cortinaIzquierda, INTERIOR.cortinaDerecha, INTERIOR.roller, INTERIOR.oscuro]
              : h.tipo === "portal"
                ? [INTERIOR.oscuro]
                : [INTERIOR.oscuro, INTERIOR.visillo, INTERIOR.cortinaIzquierda, INTERIOR.persiana, INTERIOR.cortinaDerecha, INTERIOR.roller, INTERIOR.planta, INTERIOR.oficina];
          oVidrio.quad(vid, V(0, 0, -1), interiorDeVentana(opciones[Math.floor(azar() * opciones.length)], azar() < 0.5));
        }

        // El marco: un cerco a ras del vidrio y el parteluz en medio.
        const t = h.tipo === "vitrina" ? 0.07 : 0.055;
        const zf0 = d - 0.05;
        const zf1 = d + 0.005;
        const mat = h.tipo === "vitrina" || h.tipo === "portal" ? oMetal : oMarco;
        mat.caja(V(h.x0, h.y1 - t, zf0), V(h.x1, h.y1, zf1));
        mat.caja(V(h.x0, h.y0, zf0), V(h.x1, h.y0 + t, zf1));
        mat.caja(V(h.x0, h.y0, zf0), V(h.x0 + t, h.y1, zf1));
        mat.caja(V(h.x1 - t, h.y0, zf0), V(h.x1, h.y1, zf1));
        if (h.tipo === "vitrina") {
          const n = Math.max(2, Math.round((h.x1 - h.x0) / 1.6));
          for (let k = 1; k < n; k++) {
            const x = h.x0 + ((h.x1 - h.x0) * k) / n;
            mat.caja(V(x - t / 2, h.y0, zf0), V(x + t / 2, h.y1, zf1));
          }
        } else {
          const xm = (h.x0 + h.x1) / 2;
          mat.caja(V(xm - 0.025, h.y0, zf0), V(xm + 0.025, h.y1, zf1));
          // En los altos, un travesaño: la banderola de arriba.
          if (h.y1 - h.y0 > 1.9) mat.caja(V(h.x0, h.y1 - 0.5, zf0), V(h.x1, h.y1 - 0.45, zf1));
        }

        // El alféizar de piedra, que sale del muro, y el zócalo bajo la vitrina.
        if (h.tipo === "ventana" || h.tipo === "baja") {
          oPiedra.caja(V(h.x0 - 0.06, h.y0 - 0.05, -0.07), V(h.x1 + 0.06, h.y0, d), uvPlanar(1), { abajo: 0.55 });
        }

        // Rejas en las ventanas bajas: barrotes y dos pletinas, a ras del muro.
        if (h.tipo === "baja" || h.tipo === "portal") {
          const z0 = h.tipo === "portal" ? d - 0.12 : 0.02;
          for (let x = h.x0 + 0.1; x < h.x1 - 0.05; x += 0.12) oMetal.caja(V(x - 0.009, h.y0, z0), V(x + 0.009, h.y1, z0 + 0.018));
          for (const y of [h.y0 + 0.15, h.y1 - 0.15]) oMetal.caja(V(h.x0, y - 0.015, z0 - 0.004), V(h.x1, y + 0.015, z0 + 0.022));
        }

        // Balcón: losa volada y baranda de barrotes.
        if (h.tipo === "balcon") {
          const bx0 = (h.x0 + h.x1) / 2 - paso * 0.42;
          const bx1 = (h.x0 + h.x1) / 2 + paso * 0.42;
          const prof = 0.9;
          oPiedra.caja(V(bx0, h.y0 - 0.14, -prof), V(bx1, h.y0, 0), uvPlanar(1), { abajo: 0.5 });
          const alto = 0.95;
          const yb = h.y0;
          for (let x = bx0 + 0.04; x < bx1 - 0.02; x += 0.115) oMetal.caja(V(x - 0.008, yb, -prof + 0.03), V(x + 0.008, yb + alto, -prof + 0.046));
          for (let z = -prof + 0.15; z < -0.05; z += 0.115) {
            oMetal.caja(V(bx0 + 0.03, yb, z - 0.008), V(bx0 + 0.046, yb + alto, z + 0.008));
            oMetal.caja(V(bx1 - 0.046, yb, z - 0.008), V(bx1 - 0.03, yb + alto, z + 0.008));
          }
          oMetal.caja(V(bx0 + 0.02, yb + alto, -prof + 0.02), V(bx1 - 0.02, yb + alto + 0.04, -prof + 0.06));
          oMetal.caja(V(bx0 + 0.02, yb + alto, -prof + 0.02), V(bx0 + 0.06, yb + alto + 0.04, 0));
          oMetal.caja(V(bx1 - 0.06, yb + alto, -prof + 0.02), V(bx1 - 0.02, yb + alto + 0.04, 0));
        }

        // Algún aire acondicionado bajo una ventana de los pisos, colgado del
        // muro: no todos, y nunca dos seguidos en la misma fila.
        if (h.tipo === "ventana" && altoPiso * 0.27 >= 0.78 && azar() < 0.24 && aires < 5) {
          aires++;
          const cx = (h.x0 + h.x1) / 2 + (azar() - 0.5) * 0.3;
          const yTop = h.y0 - 0.14;
          const uvAire = (p: Vector3, n: Vector3): UV => {
            if (n.z < -0.5) return [(p.x - (cx - 0.4)) / 0.8, (p.y - (yTop - 0.55)) / 0.55];
            return [0.95, 0.05];
          };
          oAire.caja(V(cx - 0.4, yTop - 0.55, -0.3), V(cx + 0.4, yTop, -0.02), uvAire, { abajo: 0.6 });
          // Las dos ménsulas que lo sostienen.
          for (const s of [-0.3, 0.3]) oMetal.caja(V(cx + s - 0.015, yTop - 0.6, -0.32), V(cx + s + 0.015, yTop - 0.55, 0));
        }
      }

      // --- Molduras, zócalo, cornisa ----------------------------------------------
      //
      // Una moldura en cada losa y otra más gruesa sobre el local; el zócalo
      // de piedra abajo; la cornisa volada arriba, con su cara de abajo en
      // sombra, y el remate del parapeto.
      const moldura = (y: number, alto: number, vuelo: number, tonoAbajo = 0.55): void =>
        oPiedra.caja(V(-W / 2, y, -vuelo), V(W / 2, y + alto, 0), uvPlanar(1), { abajo: tonoAbajo });
      moldura(ALTO_LOCAL, 0.2, 0.07);
      for (let piso = 2; piso < e.pisos; piso++) moldura(ALTO_LOCAL + 0.3 + (piso - 1) * altoPiso - 0.06, 0.12, 0.04);
      moldura(H - 0.5, 0.3, 0.24, 0.45);
      moldura(H - 0.2, 0.2, 0.1);
      // El zócalo, partido donde está el portal.
      const portal = huecos.find((h) => h.tipo === "portal");
      if (portal) {
        oPiedra.caja(V(-W / 2, 0, -0.025), V(portal.x0, 0.5, 0));
        oPiedra.caja(V(portal.x1, 0, -0.025), V(W / 2, 0.5, 0));
      } else {
        oPiedra.caja(V(-W / 2, 0, -0.025), V(W / 2, 0.35, 0));
      }

      // --- La bajada de agua ---------------------------------------------------
      {
        const x = W / 2 - 0.32;
        const largo = H - 0.4;
        const tubo = VertexData.CreateCylinder({ height: largo, diameter: 0.1, tessellation: 12 });
        oPvc.sumar(tubo, Matrix.Translation(x, 0.15 + largo / 2, -0.09));
        for (let y = 1.2; y < H - 0.6; y += 2.4) oMetal.caja(V(x - 0.07, y, -0.15), V(x + 0.07, y + 0.04, 0));
        // El codo de abajo, que echa el agua a la vereda.
        const codo = VertexData.CreateCylinder({ height: 0.22, diameter: 0.1, tessellation: 12 });
        oPvc.sumar(codo, Matrix.RotationX(Math.PI / 2.6).multiply(Matrix.Translation(x, 0.12, -0.17)));
      }

      // --- El local: letrero en volumen y toldo --------------------------------------
      const piezas: Mesh[] = [];
      let letreroMat: PBRMaterial | null = null;
      if (e.local) {
        const { tex, ctx: c } = lienzo(scene, `texLetrero_${nombre}`, 1024, 128);
        c.fillStyle = e.colorLocal;
        c.fillRect(0, 0, 1024, 128);
        const brillo = c.createLinearGradient(0, 0, 0, 128);
        brillo.addColorStop(0, "rgba(255,255,255,0.12)");
        brillo.addColorStop(1, "rgba(0,0,0,0.18)");
        c.fillStyle = brillo;
        c.fillRect(0, 0, 1024, 128);
        c.fillStyle = "#ffffff";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = "800 78px system-ui, 'Segoe UI', sans-serif";
        c.fillText(e.local, 512, 68);
        tex.update(true);
        letreroMat = new PBRMaterial(`matLetrero_${nombre}`, scene);
        letreroMat.albedoTexture = tex;
        letreroMat.metallic = 0;
        letreroMat.roughness = 0.45;
        const lx0 = -W / 2 + margen - 0.1;
        const lx1 = W / 2 - margen + 0.1;
        const uvLetrero = (p: Vector3, n: Vector3): UV => (n.z < -0.5 ? [(p.x - lx0) / (lx1 - lx0), (p.y - 2.98) / 0.55] : [0.01, 0.5]);
        oLetrero.caja(V(lx0, 2.98, -0.12), V(lx1, 3.53, 0), uvLetrero, { abajo: 0.6 });
        if (e.toldo) {
          // Colgado bajo el letrero: el borde de arriba contra el muro y el de
          // abajo salido casi un metro, tapando lo alto de la vitrina.
          const ancho = Math.min(W - 1.2, 7.5);
          const t = MeshBuilder.CreatePlane(`${nombre}_toldo`, { width: ancho, height: 1.25 }, scene);
          const mt = new PBRMaterial(`mat_${nombre}_toldo`, scene);
          mt.albedoTexture = texturaToldo(scene, `texToldo_${nombre}`, e.toldo);
          mt.roughness = 0.85;
          mt.metallic = 0;
          mt.backFaceCulling = false;
          t.material = mt;
          t.bakeTransformIntoVertices(Matrix.RotationX(0.72).multiply(Matrix.Translation(0, 2.48, -0.43)));
          t.bakeTransformIntoVertices(mundo);
          t.isPickable = false;
          piezas.push(t);
        }
      }

      const salida: [Obra, PBRMaterial | null, string][] = [
        [muro, revoque, "muro"],
        [oCuerpo, cuerpoMat, "cuerpo"],
        [oVidrio, vidrio, "vidrios"],
        [oTienda, vidrioTienda, "vitrina"],
        [oMarco, marco(e.marco), "marcos"],
        [oPiedra, piedra, "piedra"],
        [oMetal, metal, "fierro"],
        [oPvc, pvc, "bajada"],
        [oAire, aire, "aire"],
        [oLetrero, letreroMat, "letrero"],
      ];
      for (const [obra, material, cual] of salida) {
        if (obra.vacia() || !material) continue;
        piezas.push(obra.malla(scene, `${nombre}_${cual}`, material, mundo));
      }
      return piezas;
    },
  };
}
