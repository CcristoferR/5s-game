import {
  Mesh,
  VertexData,
  VertexBuffer,
  Vector3,
  PBRMaterial,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Texture,
  type AbstractMesh,
  type Scene,
} from "@babylonjs/core";

// ===========================================================================
// Los productos que la gente saca de las góndolas
// ===========================================================================
//
// Lo que un cliente tenía en la mano era una caja lisa de un color: amarilla la
// del hurto, roja o azul la de las compras. De lejos pasaba; de cerca, al lado
// de góndolas llenas de cajas de cereal, latas y leches con su etiqueta, era un
// bloque de juguete, y lo que el jugador tiene que mirar es justamente eso.
//
// Ahora es literalmente un producto del estante: una copia de una de las cajas
// de cereal, de las latas, de las leches o de los paquetes de pasta del
// modelo, con su misma etiqueta y su mismo material. Lo que el cliente se echa
// al canasto —o bajo la parka— es lo mismo que hay en la góndola de al lado.
//
// ─── CÓMO SE SACA UNO ────────────────────────────────────────────────────
//
// En el modelo cada clase de producto es una sola malla con todas las piezas
// fundidas: 328 cajas de cereal, 240 latas… Se separan por vértices que se
// tocan —igual que se contaron las láminas del vidrio— y se toma una pieza del
// tamaño más repetido, que es la que de verdad es un producto y no un tapón o
// un resto. La leche se lleva además su tapa, que viene como pieza aparte.
//
// Se hace una vez al cargar, con las mallas más livianas: las botellas (60 mil
// vértices) no hacen falta y no se tocan.
//
// ─── Y POR QUÉ SEGUÍAN PARECIENDO BLOQUES ────────────────────────────────
//
// Porque en el modelo las cajas están impresas por una sola cara, la que da
// al pasillo: la de cereal tiene la etiqueta en un costado grande y las otras
// tres caras de un café liso; la de pasta, una cara impresa y el resto azul
// marino. En el estante no se nota —solo se ve el frente—, pero en la mano de
// alguien que se gira, de espaldas o de lado, era un ladrillo de color.
//
// Así que a las cajas se les imprime también la cara de atrás, con la misma
// etiqueta y bien orientada —vista desde atrás se lee derecha, no en espejo—,
// y los envases se giran un octavo de vuelta: con dos caras impresas y en
// diagonal, desde cualquier lado se ve al menos una etiqueta de medio lado.

export type TipoProducto = "cereal" | "pasta" | "leche" | "lata";

export type Productos = Partial<Record<TipoProducto, Mesh>>;

const DE_DONDE: Record<TipoProducto, string> = {
  cereal: "Cereales",
  pasta: "Pastas",
  leche: "Leches",
  lata: "Latas 01",
};

/**
 * Cómo se arregla cada envase. Las cajas —la leche también, que es un
 * tetra— llevan etiqueta atrás y van en diagonal; la lata es un cilindro con
 * la etiqueta alrededor y no necesita nada.
 */
const ARREGLO: Record<TipoProducto, { etiquetaAtras: boolean; diagonal: boolean }> = {
  cereal: { etiquetaAtras: true, diagonal: true },
  pasta: { etiquetaAtras: true, diagonal: true },
  leche: { etiquetaAtras: true, diagonal: true },
  lata: { etiquetaAtras: false, diagonal: false },
};

/** Los pixeles de una textura, para saber qué cara de un envase está impresa. */
interface Pixeles {
  datos: Uint8Array;
  ancho: number;
  alto: number;
}

async function leerTextura(mesh: Mesh): Promise<Pixeles | null> {
  const tex = (mesh.material as PBRMaterial | null)?.albedoTexture;
  if (!(tex instanceof Texture)) return null;
  await new Promise<void>((listo) => Texture.WhenAllReady([tex], () => listo()));
  const leidos = await tex.readPixels();
  if (!leidos) return null;
  const { width, height } = tex.getSize();
  return { datos: new Uint8Array(leidos.buffer, leidos.byteOffset, leidos.byteLength), ancho: width, alto: height };
}

/**
 * Saca un producto de cada clase del modelo.
 *
 * Las plantillas quedan apagadas: no se ven ni cuentan para nada. Quien las
 * use las clona (ver la opción `plantilla` de Figura).
 *
 * Asíncrona porque lee las texturas, para saber qué caras están impresas.
 */
export async function extraerProductos(scene: Scene, mallas: readonly AbstractMesh[]): Promise<Productos> {
  const salida: Productos = {};
  for (const tipo of Object.keys(DE_DONDE) as TipoProducto[]) {
    const fuente = mallas.find((m) => m.name === DE_DONDE[tipo]);
    if (!(fuente instanceof Mesh)) continue;
    const arreglo = ARREGLO[tipo];
    const pixeles = arreglo.etiquetaAtras ? await leerTextura(fuente) : null;
    const pieza = unaPieza(scene, fuente, `plantilla_${tipo}`, arreglo, pixeles);
    if (pieza) salida[tipo] = pieza;
  }
  return salida;
}

function unaPieza(
  scene: Scene,
  fuente: Mesh,
  nombre: string,
  arreglo: { etiquetaAtras: boolean; diagonal: boolean },
  pixeles: Pixeles | null
): Mesh | null {
  const pos = fuente.getVerticesData(VertexBuffer.PositionKind);
  const nor = fuente.getVerticesData(VertexBuffer.NormalKind);
  const uv = fuente.getVerticesData(VertexBuffer.UVKind);
  const idx = fuente.getIndices();
  if (!pos || !idx) return null;
  const W = fuente.computeWorldMatrix(true);
  const n = pos.length / 3;

  // En el mundo: el producto sale a su tamaño real, con la escala del modelo.
  const P = new Float32Array(n * 3);
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], W, v);
    P[3 * i] = v.x;
    P[3 * i + 1] = v.y;
    P[3 * i + 2] = v.z;
  }

  // Piezas: vértices unidos por triángulo o por estar en el mismo sitio.
  const padre = new Int32Array(n);
  for (let i = 0; i < n; i++) padre[i] = i;
  const raiz = (a: number): number => {
    while (padre[a] !== a) {
      padre[a] = padre[padre[a]];
      a = padre[a];
    }
    return a;
  };
  const unir = (a: number, b: number): void => {
    a = raiz(a);
    b = raiz(b);
    if (a !== b) padre[a] = b;
  };
  const porSitio = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[3 * i] * 2000)},${Math.round(P[3 * i + 1] * 2000)},${Math.round(P[3 * i + 2] * 2000)}`;
    const otro = porSitio.get(k);
    if (otro === undefined) porSitio.set(k, i);
    else unir(i, otro);
  }
  for (let i = 0; i < idx.length; i += 3) {
    unir(idx[i], idx[i + 1]);
    unir(idx[i], idx[i + 2]);
  }
  const grupos = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const g = raiz(i);
    let lista = grupos.get(g);
    if (!lista) grupos.set(g, (lista = []));
    lista.push(i);
  }

  interface Pieza {
    verts: number[];
    min: Vector3;
    max: Vector3;
  }
  const piezas: Pieza[] = [...grupos.values()].map((verts) => {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const i of verts) {
      min.minimizeInPlaceFromFloats(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
      max.maximizeInPlaceFromFloats(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
    }
    return { verts, min, max };
  });

  // La pieza "de verdad": la del tamaño más repetido y, entre esas, la más
  // alta —el cuerpo del producto y no su tapa—.
  const firma = (p: Pieza): string => `${p.verts.length}:${(p.max.y - p.min.y).toFixed(2)}`;
  const cuenta = new Map<string, number>();
  piezas.forEach((p) => cuenta.set(firma(p), (cuenta.get(firma(p)) ?? 0) + 1));
  const candidatas = [...piezas].sort(
    (a, b) => (cuenta.get(firma(b)) ?? 0) * (b.max.y - b.min.y) - (cuenta.get(firma(a)) ?? 0) * (a.max.y - a.min.y)
  );
  const cuerpo = candidatas[0];
  if (!cuerpo) return null;
  // Y lo que va pegado encima: la tapa de la leche.
  const encima = piezas.filter(
    (p) =>
      p !== cuerpo &&
      p.min.x >= cuerpo.min.x - 0.01 &&
      p.max.x <= cuerpo.max.x + 0.01 &&
      p.min.z >= cuerpo.min.z - 0.01 &&
      p.max.z <= cuerpo.max.z + 0.01 &&
      p.min.y >= cuerpo.max.y - 0.03 &&
      p.min.y <= cuerpo.max.y + 0.05
  );
  const elegidas = [cuerpo, ...encima];

  // Centro del cuerpo, para que la plantilla quede en su origen.
  const c = cuerpo.min.add(cuerpo.max).scale(0.5);
  const mapa = new Map<number, number>();
  const nPos: number[] = [];
  const nNor: number[] = [];
  const nUv: number[] = [];
  for (const p of elegidas) {
    for (const i of p.verts) {
      mapa.set(i, nPos.length / 3);
      nPos.push(P[3 * i] - c.x, P[3 * i + 1] - c.y, P[3 * i + 2] - c.z);
      if (nor) {
        Vector3.TransformNormalFromFloatsToRef(nor[3 * i], nor[3 * i + 1], nor[3 * i + 2], W, v);
        v.normalize();
        nNor.push(v.x, v.y, v.z);
      }
      if (uv) nUv.push(uv[2 * i], uv[2 * i + 1]);
    }
  }
  // El .glb entra con un eje en espejo —así pasa Babylon de glTF a su mano
  // izquierda—, y al hornear el espejo en los vértices los triángulos quedan
  // al revés. Se les da la vuelta para que la cara de fuera siga siendo la de
  // fuera.
  const espejo = W.determinant() < 0;
  const nIdx: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = mapa.get(idx[i]);
    const b = mapa.get(idx[i + 1]);
    const d = mapa.get(idx[i + 2]);
    if (a === undefined || b === undefined || d === undefined) continue;
    if (espejo) nIdx.push(a, d, b);
    else nIdx.push(a, b, d);
  }
  if (arreglo.etiquetaAtras && nor && uv && pixeles) imprimirAtras(nPos, nNor, nUv, nIdx, pixeles);
  if (arreglo.diagonal) girarEnY(nPos, nNor, Math.PI / 4);

  const datos = new VertexData();
  datos.positions = nPos;
  datos.indices = nIdx;
  if (nor) datos.normals = nNor;
  if (uv) datos.uvs = nUv;
  const malla = new Mesh(nombre, scene);
  datos.applyToMesh(malla);
  malla.material = fuente.material;
  malla.isPickable = false;
  malla.setEnabled(false);
  return malla;
}

/**
 * Imprime la cara de atrás de una caja con la etiqueta del frente.
 *
 * Las caras se reconocen por su normal —la caja está centrada en el origen—,
 * y la impresa es, de las cuatro verticales, la de más variedad de color en
 * la textura: una etiqueta tiene letras, dibujos y fondo; una cara lisa, un
 * solo color. (Por el tamaño de sus UV no sirve: medido, las caras lisas
 * también ocupan su buen trozo de textura.) Se ajusta cómo cae la etiqueta
 * sobre su cara —una transformación afín de la posición a la UV, por mínimos
 * cuadrados— y se aplica a la cara opuesta con el eje horizontal dado vuelta:
 * quien la mira desde atrás tiene la derecha al revés, y así la lee derecha.
 *
 * Los vértices de la cara de atrás se duplican antes de cambiarles la UV: si
 * los compartiera con un costado, el costado se estiraría con ella.
 */
function imprimirAtras(pos: number[], nor: number[], uv: number[], idx: number[], pixeles: Pixeles): void {
  type Cara = "+x" | "-x" | "+z" | "-z";
  // Hasta dónde llega la caja en cada eje: solo cuentan los triángulos que
  // están en su borde. Los de la tapa de la leche, que también miran hacia
  // los lados, quedan cerca del centro y no son la cara de la caja.
  let bordeX = 0;
  let bordeZ = 0;
  for (let i = 0; i < pos.length; i += 3) {
    bordeX = Math.max(bordeX, Math.abs(pos[i]));
    bordeZ = Math.max(bordeZ, Math.abs(pos[i + 2]));
  }
  const caraDe = (t: number): Cara | null => {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    const nx = nor[3 * a] + nor[3 * b] + nor[3 * c];
    const ny = nor[3 * a + 1] + nor[3 * b + 1] + nor[3 * c + 1];
    const nz = nor[3 * a + 2] + nor[3 * b + 2] + nor[3 * c + 2];
    if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) return null;
    // El lado por dónde cae el triángulo y no por el signo de la normal: la
    // caja está centrada, y así no importa hacia dónde gire el triángulo.
    if (Math.abs(nx) > Math.abs(nz)) {
      const x = (pos[3 * a] + pos[3 * b] + pos[3 * c]) / 3;
      if (Math.abs(x) < bordeX * 0.9) return null;
      return x > 0 ? "+x" : "-x";
    }
    const z = (pos[3 * a + 2] + pos[3 * b + 2] + pos[3 * c + 2]) / 3;
    if (Math.abs(z) < bordeZ * 0.9) return null;
    return z > 0 ? "+z" : "-z";
  };
  const triangulos = new Map<Cara, number[]>();
  for (let t = 0; t < idx.length; t += 3) {
    const cara = caraDe(t);
    if (!cara) continue;
    let lista = triangulos.get(cara);
    if (!lista) triangulos.set(cara, (lista = []));
    lista.push(t);
  }
  /**
   * Cuánto varía el color sobre una cara: se muestrea la textura en una
   * rejilla de puntos de cada triángulo y se mide la dispersión.
   */
  const variedad = (cara: Cara): number => {
    const { datos, ancho, alto } = pixeles;
    let suma = 0;
    let suma2 = 0;
    let cuenta = 0;
    for (const t of triangulos.get(cara) ?? []) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      for (let i = 0; i <= 6; i++) {
        for (let j = 0; j <= 6 - i; j++) {
          const wa = i / 6;
          const wb = j / 6;
          const wc = 1 - wa - wb;
          const u = wa * uv[2 * a] + wb * uv[2 * b] + wc * uv[2 * c];
          const v = wa * uv[2 * a + 1] + wb * uv[2 * b + 1] + wc * uv[2 * c + 1];
          const x = Math.min(ancho - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * ancho)));
          const y = Math.min(alto - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * alto)));
          const k = (y * ancho + x) * 4;
          const luz = 0.3 * datos[k] + 0.59 * datos[k + 1] + 0.11 * datos[k + 2];
          suma += luz;
          suma2 += luz * luz;
          cuenta++;
        }
      }
    }
    if (!cuenta) return 0;
    const media = suma / cuenta;
    return Math.sqrt(Math.max(0, suma2 / cuenta - media * media));
  };
  const caras: Cara[] = ["+x", "-x", "+z", "-z"];
  const impresa = caras.reduce((a, b) => (variedad(b) > variedad(a) ? b : a));
  const opuesta = ((impresa[0] === "+" ? "-" : "+") + impresa[1]) as Cara;
  // Si atrás ya hay algo impreso, no se toca.
  if (variedad(opuesta) > variedad(impresa) * 0.5) return;

  // La coordenada horizontal de la cara: z en las de x, x en las de z.
  const eje = impresa[1] === "x" ? 2 : 0;
  const verts = new Set<number>();
  for (const t of triangulos.get(impresa) ?? []) for (let k = 0; k < 3; k++) verts.add(idx[t + k]);
  // Mínimos cuadrados de u y de v sobre (s, y, 1).
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const bu = [0, 0, 0];
  const bv = [0, 0, 0];
  for (const i of verts) {
    const f = [pos[3 * i + eje], pos[3 * i + 1], 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) M[3 * r + c] += f[r] * f[c];
      bu[r] += f[r] * uv[2 * i];
      bv[r] += f[r] * uv[2 * i + 1];
    }
  }
  const det = (m: number[]): number =>
    m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const resolver = (b: number[]): number[] | null => {
    const d = det(M);
    if (Math.abs(d) < 1e-12) return null;
    return [0, 1, 2].map((col) => {
      const m = M.slice();
      for (let r = 0; r < 3; r++) m[3 * r + col] = b[r];
      return det(m) / d;
    });
  };
  const au = resolver(bu);
  const av = resolver(bv);
  if (!au || !av) return;

  for (const t of triangulos.get(opuesta) ?? []) {
    for (let k = 0; k < 3; k++) {
      const i = idx[t + k];
      const nuevo = pos.length / 3;
      pos.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
      nor.push(nor[3 * i], nor[3 * i + 1], nor[3 * i + 2]);
      const s = -pos[3 * i + eje];
      const y = pos[3 * i + 1];
      uv.push(au[0] * s + au[1] * y + au[2], av[0] * s + av[1] * y + av[2]);
      idx[t + k] = nuevo;
    }
  }
}

/** Gira posiciones y normales alrededor del eje vertical. */
function girarEnY(pos: number[], nor: number[], angulo: number): void {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  const girar = (a: number[]): void => {
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i];
      const z = a[i + 2];
      a[i] = x * c + z * s;
      a[i + 2] = -x * s + z * c;
    }
  };
  girar(pos);
  if (nor.length) girar(nor);
}

/**
 * Un billete de diez mil pesos, para la mano de la cajera: el azul del de
 * verdad, con su retrato y sus números, en una lámina fina.
 */
export function crearBillete(scene: Scene, nombre: string): Mesh {
  const tex = new DynamicTexture(`tex_${nombre}`, { width: 512, height: 256 }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, "#3b6fb0");
  g.addColorStop(0.5, "#5f8fc8");
  g.addColorStop(1, "#2f5c96");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 236);
  // Retrato: un óvalo con su busto.
  ctx.fillStyle = "rgba(20,40,80,0.45)";
  ctx.beginPath();
  ctx.ellipse(150, 128, 62, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(230,238,250,0.35)";
  ctx.beginPath();
  ctx.ellipse(150, 110, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(118, 140, 64, 50);
  ctx.fillStyle = "#eaf1fb";
  ctx.font = "bold 58px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("10.000", 486, 90);
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("DIEZ MIL PESOS", 486, 128);
  ctx.font = "16px sans-serif";
  ctx.fillText("BANCO CENTRAL DE CHILE", 486, 220);
  tex.update();
  const mat = new PBRMaterial(`mat_${nombre}`, scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.7;
  mat.metallic = 0;
  mat.albedoColor = new Color3(1, 1, 1);
  mat.backFaceCulling = false;
  const billete = MeshBuilder.CreatePlane(nombre, { width: 0.155, height: 0.07 }, scene);
  billete.material = mat;
  billete.isPickable = false;
  billete.setEnabled(false);
  return billete;
}
