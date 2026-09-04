import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";
import { texturaGrano } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

// ---------------------------------------------------------------------------
// Estantería de destino del Nivel 2
// ---------------------------------------------------------------------------
//
// Propia y VACÍA, en vez de reusar la del taller.
//
// La de ambientación viene cargada de bultos y con cuatro baldas: no queda
// sitio donde poner nada, y con cuatro alturas no se distingue cuál es "la
// media" y cuál "la inferior". Acá hay dos baldas, anchas, despejadas y
// rotuladas — el mueble mismo dice qué va en cada una, que es lo que pide
// Seiton.
//
// ─── CÓMO SE SUBE ALGO A UNA REPISA ───────────────────────────────────────
//
// El arrastre del juego corre sobre un plano horizontal: el objeto conserva su
// altura y se desliza por el piso. Eso hace imposible levantar nada hasta una
// balda, y cambiar el plano de arrastre arreglaría este nivel rompiendo los
// otros cuatro.
//
// LO QUE HABÍA ANTES, y por qué no funcionaba: al soltar se lanzaba un rayo
// desde el cursor con scene.pick y se miraba si había caído sobre la bandeja.
// El predicado aceptaba cualquier malla pinchable, así que el garaje, los
// montantes del propio mueble y la utilería del fondo interceptaban el rayo
// primero. Encima no había ninguna señal en pantalla de a qué se estaba
// apuntando: el jugador soltaba a ciegas y casi siempre fallaba.
//
// LO QUE HAY AHORA: cada balda lleva un RECEPTOR, una lámina invisible y
// pinchable suspendida delante de su hueco. Mientras se arrastra, el nivel
// lanza un rayo que SOLO puede chocar con receptores —nada más está en la
// lista, así que nada puede taparlos— y si acierta uno, el objeto se imanta:
// sube solo hasta la balda y se queda ahí sostenido mientras el cursor no se
// mueva. El jugador VE dónde va a quedar antes de soltar.
//
// Los dos receptores son COPLANARES (mismo plano vertical, delante del mueble)
// y no se solapan en altura. Un rayo cruza ese plano en un único punto, así
// que jamás puede apuntar a las dos baldas a la vez: la ambigüedad se elimina
// por geometría, no a fuerza de reglas de desempate.

export type NivelBalda = "media" | "inferior";

export interface BaldaDestino {
  nivel: NivelBalda;
  /** Altura de la superficie donde se apoya lo que se guarda. */
  superficieY: number;
  mesh: Mesh;
  /** Lámina invisible a la que se apunta para colocar en esta balda. */
  receptor: Mesh;
}

export interface EstanteResult {
  baldas: BaldaDestino[];
  /** Devuelve la balda cuyo receptor es la malla dada, si lo es. */
  baldaDeReceptor: (malla: Mesh | null) => BaldaDestino | null;
  /** Sitio libre en una balda, de izquierda a derecha. */
  lugarEnBalda: (nivel: NivelBalda, indice: number) => Vector3;
  /** Punto donde queda sostenido el objeto mientras se apunta a la balda. */
  puntoSostenido: (nivel: NivelBalda, indice: number) => Vector3;
  /** Imprime la etiqueta con el nombre en el canto, bajo el objeto colocado. */
  rotular: (nivel: NivelBalda, indice: number, texto: string) => void;
  /** Enciende el borde de una balda mientras el cursor la está apuntando. */
  resaltar: (nivel: NivelBalda | null) => void;
}

// ESTANTERÍA MÁS GRANDE Y ROBUSTA.
//
// A 2,6 x 0,62 m se veía como un mueble de oficina perdido en un galpón de
// 12 x 19, y sobre todo no parecía que una caja de herramientas o un bidón
// cupieran en la balda de abajo — que es justo lo que el nivel pide hacer.
// Un mueble industrial tiene el fondo suficiente para que la pieza entre
// entera, no apoyada en el borde.
const ANCHO = 3.4;
const FONDO = 0.95;
const ALTO_BALDA_MEDIA = 1.25;
const ALTO_BALDA_INFERIOR = 0.32;

/** Separación entre sitios dentro de una balda. Cuatro por balda. */
const PASO_SITIO = 0.6;

export function crearEstanteDestino(scene: Scene, x: number, z: number, giroY: number): EstanteResult {
  const metal = new PBRMaterial("matEstanteDestino", scene);
  metal.albedoColor = new Color3(0.26, 0.32, 0.4);
  metal.roughness = 0.45;
  metal.metallic = 0.72;
  metal.microSurfaceTexture = texturaGrano(scene, 0.06);

  // Hacia el jugador. Con giroY = 0 vale (0, 0, -1), igual que en el tablero.
  const frenteX = -Math.sin(giroY);
  const frenteZ = -Math.cos(giroY);
  // A lo ancho del mueble.
  const ladoX = Math.cos(giroY);
  const ladoZ = -Math.sin(giroY);

  // Montantes en las cuatro esquinas.
  [-1, 1].forEach((lx) => {
    [-1, 1].forEach((lz) => {
      const montante = MeshBuilder.CreateBox(
        `estDestMontante_${lx}_${lz}`,
        { width: 0.1, height: 1.85, depth: 0.1 },
        scene
      );
      const dx = lx * (ANCHO / 2 - 0.05);
      const dz = lz * (FONDO / 2 - 0.05);
      montante.position.set(
        x + Math.cos(giroY) * dx + Math.sin(giroY) * dz,
        0.775,
        z - Math.sin(giroY) * dx + Math.cos(giroY) * dz
      );
      montante.rotation.y = giroY;
      montante.material = metal;
      montante.receiveShadows = true;
      // No pinchable: si intercepta el rayo, tapa su propio receptor.
      montante.isPickable = false;
    });
  });

  const baldas: BaldaDestino[] = [];
  const marcos = new Map<NivelBalda, Mesh>();

  const matResalte = new PBRMaterial("matResalteBalda", scene);
  matResalte.albedoColor = new Color3(0.15, 0.55, 0.32);
  matResalte.emissiveColor = new Color3(0.22, 0.75, 0.42);
  matResalte.roughness = 1;

  const definiciones: Array<{
    nivel: NivelBalda;
    y: number;
    /** Alto del hueco de esta balda: es lo que ocupa su receptor. */
    altoHueco: number;
    rotulo: string;
    color: string;
  }> = [
    { nivel: "media", y: ALTO_BALDA_MEDIA, altoHueco: 0.5, rotulo: "USO OCASIONAL", color: "#7ea3ba" },
    { nivel: "inferior", y: ALTO_BALDA_INFERIOR, altoHueco: 0.58, rotulo: "PESADO · VA ABAJO", color: "#bda079" },
  ];

  // El receptor va a esta distancia del centro del mueble, igual para las dos
  // baldas: es lo que las mantiene coplanares.
  const DIST_RECEPTOR = FONDO / 2 + 0.14;

  definiciones.forEach(({ nivel, y, altoHueco, rotulo, color }) => {
    const bandeja = MeshBuilder.CreateBox(
      `baldaDestino_${nivel}`,
      { width: ANCHO, height: 0.07, depth: FONDO },
      scene
    );
    bandeja.position.set(x, y, z);
    bandeja.rotation.y = giroY;
    bandeja.material = metal;
    bandeja.receiveShadows = true;
    bandeja.isPickable = false;

    // Frontal rotulado. El rótulo va IMPRESO en el mueble y no flotando al
    // lado: el sitio tiene que estar identificado en el sitio mismo, que es
    // literalmente lo que dice la regla de la etiqueta.
    const matFrontal = materialPintado(scene, `matFrontalBalda_${nivel}`, 4096, 512, (ctx, w, h) => {
      ctx.fillStyle = "#1b2228";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = color;
      ctx.fillRect(0, h - 20, w, 20);

      ctx.fillStyle = "#e8edf0";
      // La franja mide 3,4 x 0,22 m: una proporción de 15 a 1. Con una textura
      // de 2048 x 256 el texto se estiraba a lo ancho y se aplastaba a lo
      // alto. Con 4096 x 512 y letra proporcional al alto, se lee entero.
      ctx.font = `bold ${Math.round(h * 0.52)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rotulo, w / 2, h / 2 - 8);
    });

    const frontal = MeshBuilder.CreateBox(
      `frontalBalda_${nivel}`,
      { width: ANCHO, height: 0.22, depth: 0.025 },
      scene
    );
    frontal.position.set(
      x + frenteX * (FONDO / 2 + 0.01),
      y - 0.09,
      z + frenteZ * (FONDO / 2 + 0.01)
    );
    frontal.rotation.y = giroY;
    frontal.material = matFrontal;
    frontal.isPickable = false;

    // Receptor: la lámina a la que se apunta. Ver la nota de cabecera.
    const receptor = MeshBuilder.CreateBox(
      `receptorBalda_${nivel}`,
      { width: ANCHO, height: altoHueco, depth: 0.02 },
      scene
    );
    receptor.position.set(
      x + frenteX * DIST_RECEPTOR,
      y + altoHueco / 2 + 0.03,
      z + frenteZ * DIST_RECEPTOR
    );
    receptor.rotation.y = giroY;
    receptor.visibility = 0;
    receptor.isPickable = true;

    const marco = MeshBuilder.CreateBox(
      `marcoBalda_${nivel}`,
      { width: ANCHO + 0.04, height: 0.035, depth: 0.035 },
      scene
    );
    marco.position.set(
      x + frenteX * (FONDO / 2 + 0.02),
      y + 0.05,
      z + frenteZ * (FONDO / 2 + 0.02)
    );
    marco.rotation.y = giroY;
    marco.material = matResalte;
    marco.isPickable = false;
    marco.isVisible = false;
    marcos.set(nivel, marco);

    baldas.push({ nivel, superficieY: y + 0.025, mesh: bandeja, receptor });
  });

  const baldaDeReceptor = (malla: Mesh | null): BaldaDestino | null =>
    baldas.find((b) => b.receptor === malla) ?? null;

  /** Desplazamiento lateral del sitio número `indice` dentro de una balda. */
  const desplazamientoDe = (indice: number): number => (indice % 4) * PASO_SITIO - 0.9;

  const lugarEnBalda = (nivel: NivelBalda, indice: number): Vector3 => {
    const balda = baldas.find((b) => b.nivel === nivel)!;
    const d = desplazamientoDe(indice);
    return new Vector3(x + ladoX * d, balda.superficieY, z + ladoZ * d);
  };

  /**
   * Dónde queda el objeto mientras el jugador lo sostiene sobre la balda.
   *
   * Un poco por delante y por encima del sitio definitivo: así se lee como
   * "sostenido a punto de dejarlo", no como ya guardado. La diferencia importa
   * porque hasta que no suelte todavía puede arrepentirse.
   */
  const puntoSostenido = (nivel: NivelBalda, indice: number): Vector3 => {
    const sitio = lugarEnBalda(nivel, indice);
    return new Vector3(
      sitio.x + frenteX * 0.24,
      sitio.y + 0.16,
      sitio.z + frenteZ * 0.24
    );
  };

  /**
   * Etiqueta impresa en el canto de la balda, justo debajo de lo colocado.
   *
   * Es la segunda mitad de la regla del curso: no basta con que la cosa tenga
   * un lugar, el lugar tiene que decir qué va ahí. Aparece sola al acertar,
   * igual que el rótulo del tablero de siluetas.
   */
  const rotular = (nivel: NivelBalda, indice: number, texto: string): void => {
    const balda = baldas.find((b) => b.nivel === nivel);
    if (!balda) return;

    const d = desplazamientoDe(indice);

    const matEtiqueta = materialPintado(
      scene,
      `matEtiquetaBalda_${nivel}_${indice}`,
      512,
      96,
      (ctx, w, h) => {
        ctx.fillStyle = "#f2f4f0";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#2e7d46";
        ctx.fillRect(0, 0, w, 12);

        ctx.fillStyle = "#1b2228";
        ctx.font = "bold 42px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Se encoge la letra en vez de recortar el nombre: "Carpeta de
        // mantenimiento" cortada a la mitad no identifica nada.
        let tamano = 42;
        while (ctx.measureText(texto.toUpperCase()).width > w - 28 && tamano > 18) {
          tamano -= 2;
          ctx.font = `bold ${tamano}px system-ui, sans-serif`;
        }
        ctx.fillText(texto.toUpperCase(), w / 2, h / 2 + 6);
      }
    );

    const etiqueta = MeshBuilder.CreateBox(
      `etiquetaBalda_${nivel}_${indice}`,
      { width: 0.5, height: 0.094, depth: 0.012 },
      scene
    );
    etiqueta.position.set(
      x + ladoX * d + frenteX * (FONDO / 2 + 0.03),
      balda.superficieY - 0.115,
      z + ladoZ * d + frenteZ * (FONDO / 2 + 0.03)
    );
    etiqueta.rotation.y = giroY;
    etiqueta.material = matEtiqueta;
    etiqueta.isPickable = false;
  };

  const resaltar = (nivel: NivelBalda | null): void => {
    marcos.forEach((marco, clave) => {
      marco.isVisible = clave === nivel;
    });
  };

  return { baldas, baldaDeReceptor, lugarEnBalda, puntoSostenido, rotular, resaltar };
}