import {
  Mesh,
  VertexData,
  VertexBuffer,
  Vector3,
  PBRMaterial,
  Color3,
  DynamicTexture,
  MeshBuilder,
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

export type TipoProducto = "cereal" | "pasta" | "leche" | "lata";

export type Productos = Partial<Record<TipoProducto, Mesh>>;

const DE_DONDE: Record<TipoProducto, string> = {
  cereal: "Cereales",
  pasta: "Pastas",
  leche: "Leches",
  lata: "Latas 01",
};

/**
 * Saca un producto de cada clase del modelo.
 *
 * Las plantillas quedan apagadas: no se ven ni cuentan para nada. Quien las
 * use las clona (ver la opción `plantilla` de Figura).
 */
export function extraerProductos(scene: Scene, mallas: readonly AbstractMesh[]): Productos {
  const salida: Productos = {};
  (Object.keys(DE_DONDE) as TipoProducto[]).forEach((tipo) => {
    const fuente = mallas.find((m) => m.name === DE_DONDE[tipo]);
    if (!(fuente instanceof Mesh)) return;
    const pieza = unaPieza(scene, fuente, `plantilla_${tipo}`);
    if (pieza) salida[tipo] = pieza;
  });
  return salida;
}

function unaPieza(scene: Scene, fuente: Mesh, nombre: string): Mesh | null {
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
