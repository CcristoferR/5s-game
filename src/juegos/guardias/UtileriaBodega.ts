import { Scene, Mesh, MeshBuilder, PBRMaterial, Color3, DynamicTexture, Texture } from "@babylonjs/core";
import { crearAzar, fbm, subirMapa, type Mapa } from "./TexturasPBR";

// ===========================================================================
// Lo que hay dentro de la bodega
// ===========================================================================
//
// Un pallet con carga embalada y su transpaleta, un estante metálico contra el
// muro del fondo y cajas. Es lo mínimo para que el cuarto se lea como bodega
// al asomarse por la cortina, y no como un pasillo cerrado.
//
// ─── POR QUÉ LAS TEXTURAS SE HACEN CADA VEZ ───────────────────────────────
//
// Las de TexturasSuperficie se guardan en caché por escena, y los escenarios
// del curso comparten UNA sola. limpiarEscena las destruye al salir junto con
// las mallas, pero la caché sigue devolviéndolas: al volver a entrar, el
// material recibiría una textura muerta. Estas se generan en cada montaje y se
// van con él.
//
// ─── Y POR QUÉ TODO VA FUSIONADO ──────────────────────────────────────────
//
// Cada caja suelta sería una llamada de dibujo. Fusionadas por material, la
// bodega entera cuesta lo que media docena de mallas.

/** Lo que devuelve cada pieza: su malla visible y su volumen de choque. */
export interface PiezaBodega {
  mallas: Mesh[];
  choques: Mesh[];
}

/** Dibuja un mapa texel a texel. `color` recibe u y v de 0 a 1. */
export function mapaProcedural(
  lado: number,
  color: (u: number, v: number) => [number, number, number]
): Mapa {
  const datos = new Uint8Array(lado * lado * 4);
  const byte = (c: number): number => Math.round(Math.min(1, Math.max(0, c)) * 255);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const [r, g, b] = color(x / lado, y / lado);
      const k = (y * lado + x) * 4;
      datos[k] = byte(r);
      datos[k + 1] = byte(g);
      datos[k + 2] = byte(b);
      datos[k + 3] = 255;
    }
  }
  return { ancho: lado, alto: lado, datos };
}

export function materialLiso(
  scene: Scene,
  nombre: string,
  color: Color3,
  rugosidad: number,
  metalico = 0
): PBRMaterial {
  const mat = new PBRMaterial(nombre, scene);
  mat.albedoColor = color;
  mat.roughness = rugosidad;
  mat.metallic = metalico;
  return mat;
}

/** Una caja ya colocada, lista para fusionar. */
export function bloque(
  scene: Scene,
  nombre: string,
  ancho: number,
  alto: number,
  fondo: number,
  x: number,
  y: number,
  z: number,
  giroY = 0
): Mesh {
  const malla = MeshBuilder.CreateBox(nombre, { width: ancho, height: alto, depth: fondo }, scene);
  malla.position.set(x, y, z);
  malla.rotation.y = giroY;
  return malla;
}

/**
 * Una caja de cartón ya colocada.
 *
 * Aparte de bloque por la impresión: con las UV de fábrica de Babylon, cada
 * cara lateral recibe la textura girada a su manera, y las flechas de "este
 * lado arriba" salían apuntando al suelo. `wrap` las pone derechas en los
 * cuatro lados.
 */
function cajaCarton(
  scene: Scene,
  nombre: string,
  ancho: number,
  alto: number,
  fondo: number,
  x: number,
  y: number,
  z: number,
  giroY: number
): Mesh {
  const malla = MeshBuilder.CreateBox(nombre, { width: ancho, height: alto, depth: fondo, wrap: true }, scene);
  malla.position.set(x, y, z);
  malla.rotation.y = giroY;
  return malla;
}

/** Fusiona piezas de un mismo material en una malla estática. */
export function fundir(partes: Mesh[], nombre: string, mat: PBRMaterial): Mesh {
  const malla = Mesh.MergeMeshes(partes, true, true) ?? partes[0];
  malla.name = nombre;
  malla.material = mat;
  malla.isPickable = false;
  malla.freezeWorldMatrix();
  return malla;
}

/**
 * Volumen invisible que frena al jugador.
 *
 * La carga del pallet son veinte cajas: chocar contra cada una costaría
 * veinte comprobaciones por cuadro para frenar en el mismo sitio que una sola.
 */
export function choque(scene: Scene, nombre: string, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Mesh {
  const malla = bloque(
    scene,
    nombre,
    maxX - minX,
    maxY - minY,
    maxZ - minZ,
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  );
  malla.isVisible = false;
  malla.isPickable = false;
  malla.checkCollisions = true;
  return malla;
}

// ---------------------------------------------------------------------------
// Cartón
// ---------------------------------------------------------------------------

/**
 * Cara de caja de cartón: canaladura, fibra, bordes sucios y cinta de embalar.
 *
 * Con impresión lleva además las flechas de "este lado arriba" y un código de
 * barras. Sin nombre de marca a propósito: una marca inventada distrae, y una
 * real no se puede poner.
 */
function materialCarton(scene: Scene, nombre: string, tinte: string, semilla: number, impresion: boolean): PBRMaterial {
  const L = 512;
  const textura = new DynamicTexture(`tex_${nombre}`, { width: L, height: L }, scene, true);
  const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;
  const azar = crearAzar(semilla);

  ctx.fillStyle = tinte;
  ctx.fillRect(0, 0, L, L);

  for (let x = 0; x < L; x += 7) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x, 0, 2, L);
    ctx.fillStyle = "rgba(60,40,20,0.06)";
    ctx.fillRect(x + 3, 0, 2, L);
  }

  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = azar() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(70,45,20,0.07)";
    ctx.fillRect(azar() * L, azar() * L, 2 + azar() * 3, 1);
  }

  // Los cantos se ensucian primero: es lo que se agarra y lo que roza.
  const borde = ctx.createRadialGradient(L / 2, L / 2, L * 0.28, L / 2, L / 2, L * 0.74);
  borde.addColorStop(0, "rgba(0,0,0,0)");
  borde.addColorStop(1, "rgba(58,36,14,0.3)");
  ctx.fillStyle = borde;
  ctx.fillRect(0, 0, L, L);

  // Cinta por el centro: en la tapa es la costura, en los lados baja por ella.
  ctx.fillStyle = "rgba(146,102,52,0.55)";
  ctx.fillRect(L / 2 - 34, 0, 68, L);
  ctx.fillStyle = "rgba(255,240,210,0.16)";
  ctx.fillRect(L / 2 - 22, 0, 9, L);

  if (impresion) {
    ctx.fillStyle = "rgba(24,21,19,0.82)";
    const flecha = (cx: number, cy: number): void => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 28);
      ctx.lineTo(cx + 19, cy - 4);
      ctx.lineTo(cx + 7, cy - 4);
      ctx.lineTo(cx + 7, cy + 26);
      ctx.lineTo(cx - 7, cy + 26);
      ctx.lineTo(cx - 7, cy - 4);
      ctx.lineTo(cx - 19, cy - 4);
      ctx.closePath();
      ctx.fill();
    };
    flecha(66, 92);
    flecha(110, 92);

    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText("12 UN.", 332, 380);
    let x = 332;
    while (x < 474) {
      const grosor = 2 + Math.floor(azar() * 4);
      ctx.fillRect(x, 398, grosor, 58);
      x += grosor + 2 + Math.floor(azar() * 4);
    }
  }

  textura.update();
  textura.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  textura.anisotropicFilteringLevel = 8;

  const mat = new PBRMaterial(nombre, scene);
  mat.albedoTexture = textura;
  mat.roughness = 0.92;
  mat.metallic = 0;
  return mat;
}

/** Los dos cartones de la bodega: el impreso y el liso, algo más oscuro. */
export function materialesCarton(scene: Scene): [PBRMaterial, PBRMaterial] {
  return [
    materialCarton(scene, "matCartonImpresoBodega", "#b8966b", 41, true),
    materialCarton(scene, "matCartonLisoBodega", "#a98659", 73, false),
  ];
}

// ---------------------------------------------------------------------------
// Pallet con carga
// ---------------------------------------------------------------------------

/**
 * Pallet de 1,0 × 1,2 m con cuatro camadas de cajas, las tres de abajo
 * envueltas en film.
 *
 * El film es lo que lo hace mercadería recibida y no cajas apiladas: así llega
 * del proveedor, y así se queda hasta que alguien lo desarma para reponer.
 */
export function crearPalletConCarga(
  scene: Scene,
  cartones: [PBRMaterial, PBRMaterial],
  cx: number,
  cz: number,
  piso: number
): PiezaBodega {
  const ANCHO = 1.0;
  const LARGO = 1.2;
  const ALTO_PALLET = 0.144;

  const madera = new PBRMaterial("matMaderaPalletBodega", scene);
  madera.albedoTexture = subirMapa(
    scene,
    "texMaderaPalletBodega",
    // Vetas a lo largo de U: las tablas se construyen a lo largo de X.
    mapaProcedural(256, (u, v) => {
      const k = 0.8 + fbm(u * 3, v * 42, 31) * 0.34;
      return [0.66 * k, 0.53 * k, 0.37 * k];
    }),
    true,
    Texture.WRAP_ADDRESSMODE
  );
  madera.roughness = 0.9;
  madera.metallic = 0;

  const tablas: Mesh[] = [];
  // Tres largueros, a lo largo del pallet.
  [-0.45, 0, 0.45].forEach((dx, i) =>
    tablas.push(bloque(scene, `larguero_${i}`, LARGO, 0.1, 0.1, cx + dx, piso + 0.072, cz, Math.PI / 2))
  );
  // Tres tablas de base y siete de cubierta, de través.
  [-0.55, 0, 0.55].forEach((dz, i) =>
    tablas.push(bloque(scene, `base_${i}`, ANCHO, 0.022, 0.1, cx, piso + 0.011, cz + dz))
  );
  for (let i = 0; i < 7; i++) {
    const dz = -0.55 + (1.1 / 6) * i;
    tablas.push(bloque(scene, `cubierta_${i}`, ANCHO, 0.022, 0.1, cx, piso + 0.133, cz + dz));
  }

  // Camadas de dos por tres. La de arriba, a medio desarmar.
  const azar = crearAzar(907);
  const porMaterial: [Mesh[], Mesh[]] = [[], []];
  const CAJA = { x: 0.48, y: 0.28, z: 0.38 };
  for (let camada = 0; camada < 4; camada++) {
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 2; col++) {
        if (camada === 3 && (fila === 0 || (fila === 1 && col === 1))) continue;
        const caja = cajaCarton(
          scene,
          `cargaPallet_${camada}_${fila}_${col}`,
          CAJA.x,
          CAJA.y,
          CAJA.z,
          cx + (col - 0.5) * (CAJA.x + 0.01) + (azar() - 0.5) * 0.02,
          piso + ALTO_PALLET + CAJA.y * (camada + 0.5),
          cz + (fila - 1) * (CAJA.z + 0.005) + (azar() - 0.5) * 0.02,
          (azar() - 0.5) * 0.04
        );
        porMaterial[azar() < 0.7 ? 0 : 1].push(caja);
      }
    }
  }

  const film = new PBRMaterial("matFilmPalletBodega", scene);
  film.albedoColor = new Color3(0.9, 0.93, 0.96);
  film.alpha = 0.16;
  film.roughness = 0.12;
  film.metallic = 0;
  film.backFaceCulling = false;
  // ─── POR QUÉ EN DOS PASADAS ───────────────────────────────────────────
  //
  // El film es una caja transparente vista por sus dos lados, y sin esto
  // Babylon dibuja sus seis caras en el orden en que vienen: según desde dónde
  // se mire, la cara de atrás tapa a la de delante y el pallet entero cambia
  // de brillo al caminar, como si la carga flotara o parpadeara. Con la pasada
  // separada se dibujan primero las caras de atrás y después las de delante,
  // que es el orden en que se ven, y el envoltorio queda quieto.
  film.separateCullingPass = true;
  const envoltura = bloque(scene, "filmPalletBodega", ANCHO + 0.02, CAJA.y * 3, LARGO - 0.04, cx, piso + ALTO_PALLET + CAJA.y * 1.5, cz);
  envoltura.material = film;
  envoltura.isPickable = false;

  return {
    mallas: [
      fundir(tablas, "palletBodega", madera),
      fundir(porMaterial[0], "cargaPalletImpresa", cartones[0]),
      fundir(porMaterial[1], "cargaPalletLisa", cartones[1]),
      envoltura,
    ],
    choques: [
      choque(scene, "choquePalletBodega", cx - ANCHO / 2, cx + ANCHO / 2, piso, piso + 1.4, cz - LARGO / 2, cz + LARGO / 2),
    ],
  };
}

// ---------------------------------------------------------------------------
// Transpaleta
// ---------------------------------------------------------------------------

/**
 * Transpaleta manual con las horquillas metidas bajo el pallet y el timón
 * hacia la puerta, que es como queda cuando alguien la deja a medio trabajo.
 *
 * @param frenteZ  La cara del pallet que mira a la puerta.
 */
export function crearTranspaleta(scene: Scene, cx: number, frenteZ: number, piso: number): PiezaBodega {
  const rojo = materialLiso(scene, "matTranspaletaBodega", new Color3(0.6, 0.07, 0.05), 0.42, 0.15);
  const caucho = materialLiso(scene, "matRuedasTranspaleta", new Color3(0.04, 0.04, 0.045), 0.85);

  const cuerpo: Mesh[] = [
    bloque(scene, "horquillaA", 0.16, 0.05, 1.15, cx - 0.19, piso + 0.035, frenteZ - 0.5),
    bloque(scene, "horquillaB", 0.16, 0.05, 1.15, cx + 0.19, piso + 0.035, frenteZ - 0.5),
    bloque(scene, "chasisTranspaleta", 0.54, 0.12, 0.16, cx, piso + 0.1, frenteZ + 0.1),
  ];

  const bomba = MeshBuilder.CreateCylinder("bombaTranspaleta", { diameter: 0.1, height: 0.3, tessellation: 16 }, scene);
  bomba.position.set(cx, piso + 0.3, frenteZ + 0.18);
  cuerpo.push(bomba);

  // El timón, inclinado hacia la puerta. rotation.x positivo lleva su extremo
  // de arriba hacia +Z, comprobado con la matriz de Babylon.
  const INCLINACION = 0.36;
  const LARGO_TIMON = 1.05;
  const baseTimon = { y: piso + 0.4, z: frenteZ + 0.18 };
  const timon = MeshBuilder.CreateCylinder("timonTranspaleta", { diameter: 0.035, height: LARGO_TIMON, tessellation: 10 }, scene);
  timon.position.set(
    cx,
    baseTimon.y + (LARGO_TIMON / 2) * Math.cos(INCLINACION),
    baseTimon.z + (LARGO_TIMON / 2) * Math.sin(INCLINACION)
  );
  timon.rotation.x = INCLINACION;
  cuerpo.push(timon);

  const empunadura = MeshBuilder.CreateCylinder("empunaduraTranspaleta", { diameter: 0.034, height: 0.36, tessellation: 10 }, scene);
  empunadura.position.set(
    cx,
    baseTimon.y + LARGO_TIMON * Math.cos(INCLINACION),
    baseTimon.z + LARGO_TIMON * Math.sin(INCLINACION)
  );
  empunadura.rotation.z = Math.PI / 2;
  cuerpo.push(empunadura);

  const ruedas = [-0.07, 0.07].map((dx, i) => {
    const rueda = MeshBuilder.CreateCylinder(`ruedaTranspaleta_${i}`, { diameter: 0.18, height: 0.05, tessellation: 20 }, scene);
    rueda.position.set(cx + dx, piso + 0.09, frenteZ + 0.2);
    rueda.rotation.z = Math.PI / 2;
    return rueda;
  });

  return {
    mallas: [fundir(cuerpo, "transpaletaBodega", rojo), fundir(ruedas, "ruedasTranspaleta", caucho)],
    choques: [],
  };
}

// ---------------------------------------------------------------------------
// Estante metálico
// ---------------------------------------------------------------------------

/**
 * Estantería metálica de cuatro bandejas contra el muro, con cajas de tamaños
 * sueltos y algún hueco: una bodega en uso nunca está completa.
 */
export function crearEstanteBodega(
  scene: Scene,
  cartones: [PBRMaterial, PBRMaterial],
  minX: number,
  maxX: number,
  fondoZ: number,
  piso: number
): PiezaBodega {
  const PROFUNDIDAD = 0.45;
  const ALTO = 2.0;
  const PERFIL = 0.035;
  const NIVELES = [0.12, 0.66, 1.2, 1.74];
  const largo = maxX - minX;
  const frenteZ = fondoZ + PROFUNDIDAD;
  const cz = fondoZ + PROFUNDIDAD / 2;

  const acero = materialLiso(scene, "matEstanteBodega", new Color3(0.56, 0.58, 0.61), 0.45, 0.3);

  const piezas: Mesh[] = [];
  [minX + PERFIL / 2, maxX - PERFIL / 2].forEach((x, i) =>
    [fondoZ + PERFIL / 2, frenteZ - PERFIL / 2].forEach((z, j) =>
      piezas.push(bloque(scene, `montante_${i}_${j}`, PERFIL, ALTO, PERFIL, x, piso + ALTO / 2, z))
    )
  );
  NIVELES.forEach((altura, i) => {
    piezas.push(bloque(scene, `bandeja_${i}`, largo, 0.02, PROFUNDIDAD, (minX + maxX) / 2, piso + altura, cz));
    // Pestaña del frente: es la línea que el ojo sigue para contar bandejas.
    piezas.push(bloque(scene, `pestana_${i}`, largo, 0.05, 0.012, (minX + maxX) / 2, piso + altura - 0.015, frenteZ));
  });

  const azar = crearAzar(4211);
  const porMaterial: [Mesh[], Mesh[]] = [[], []];
  NIVELES.forEach((altura, nivel) => {
    let x = minX + 0.06;
    while (x < maxX - 0.3) {
      const ancho = 0.28 + azar() * 0.22;
      if (x + ancho > maxX - 0.05) break;
      // Uno de cada seis sitios, vacío.
      if (azar() > 0.17) {
        const alto = 0.18 + azar() * (nivel === 3 ? 0.2 : 0.3);
        const fondo = 0.3 + azar() * 0.1;
        const caja = cajaCarton(
          scene,
          `cajaEstante_${nivel}_${porMaterial[0].length + porMaterial[1].length}`,
          ancho,
          alto,
          fondo,
          x + ancho / 2,
          piso + altura + 0.01 + alto / 2,
          fondoZ + 0.04 + fondo / 2,
          (azar() - 0.5) * 0.06
        );
        porMaterial[azar() < 0.5 ? 0 : 1].push(caja);
      }
      x += ancho + 0.03 + azar() * 0.04;
    }
  });

  const mallas = [fundir(piezas, "estanteBodega", acero)];
  if (porMaterial[0].length) mallas.push(fundir(porMaterial[0], "cajasEstanteImpresas", cartones[0]));
  if (porMaterial[1].length) mallas.push(fundir(porMaterial[1], "cajasEstanteLisas", cartones[1]));

  return {
    mallas,
    choques: [choque(scene, "choqueEstanteBodega", minX, maxX, piso, piso + ALTO, fondoZ, frenteZ)],
  };
}
