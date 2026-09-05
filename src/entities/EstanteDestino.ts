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
// MEDIDAS DE RACK INDUSTRIAL, NO DE MUEBLE DE OFICINA.
//
// Un estante de 3,4 x 0,95 m seguía leyéndose pequeño en un galpón de 12 x 19,
// y sobre todo no transmitía que soportara peso: los montantes finos y el
// fondo corto hacían que un bidón de veinte kilos pareciera fuera de sitio ahí
// encima. Un rack de verdad es profundo, alto y con perfilería visible.
const ANCHO = 3.9;
const FONDO = 1.15;
const ALTO_BALDA_MEDIA = 1.42;
const ALTO_BALDA_INFERIOR = 0.36;
const ALTO_MUEBLE = 2.15;
/** Escuadra de los montantes. Gruesos: es lo que hace que se vea capaz. */
const MONTANTE = 0.14;

/** Separación entre sitios dentro de una balda. Cuatro por balda. */
// Separación entre sitios: 78 cm.
//
// Subida de 60 a 78 porque las etiquetas crecieron a 62 cm de ancho — a 60 de
// paso se solapaban una con otra y el nombre de un objeto se comía el del
// vecino. El rack mide 3,9 m de frente, así que con este paso siguen entrando
// cuatro sitios por balda con holgura.
const PASO_SITIO = 0.78;

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
        { width: MONTANTE, height: ALTO_MUEBLE, depth: MONTANTE },
        scene
      );
      const dx = lx * (ANCHO / 2 - 0.05);
      const dz = lz * (FONDO / 2 - 0.05);
      montante.position.set(
        x + Math.cos(giroY) * dx + Math.sin(giroY) * dz,
        ALTO_MUEBLE / 2,
        z - Math.sin(giroY) * dx + Math.cos(giroY) * dz
      );
      montante.rotation.y = giroY;
      montante.material = metal;
      montante.receiveShadows = true;
      // No pinchable: si intercepta el rayo, tapa su propio receptor.
      montante.isPickable = false;
    });
  });

  // Pies de anclaje al piso y travesaños de arriostre.
  //
  // Son las dos piezas que separan un rack de un mueble: los pies dicen que
  // está atornillado —no apoyado— y los travesaños en cruz son lo que en la
  // realidad impide que la estructura se venza de lado con carga. Sin ellos,
  // un estante alto con un bidón encima se ve inestable aunque no lo esté.
  [-1, 1].forEach((lx) => {
    const dx = lx * (ANCHO / 2 - 0.05);

    const pie = MeshBuilder.CreateBox(
      `estDestPie_${lx}`,
      { width: MONTANTE + 0.1, height: 0.04, depth: FONDO + 0.16 },
      scene
    );
    pie.position.set(x + Math.cos(giroY) * dx, 0.02, z - Math.sin(giroY) * dx);
    pie.rotation.y = giroY;
    pie.material = metal;
    pie.isPickable = false;

    // Travesaño horizontal, no diagonal.
    //
    // El primero iba en diagonal combinando giro en Y y en X a la vez, y esas
    // dos rotaciones juntas no dan la inclinación que uno espera: la barra
    // salía disparada atravesando las baldas y el muro. Un travesaño recto
    // entre montantes cumple lo mismo —dice que la estructura está trabada—
    // y no depende de encadenar rotaciones.
    [0.55, 1.55].forEach((altura, i) => {
      const travesano = MeshBuilder.CreateBox(
        `estDestTravesano_${lx}_${i}`,
        { width: 0.05, height: 0.05, depth: FONDO - MONTANTE },
        scene
      );
      travesano.position.set(
        x + Math.cos(giroY) * dx,
        altura,
        z - Math.sin(giroY) * dx
      );
      travesano.rotation.y = giroY;
      travesano.material = metal;
      travesano.isPickable = false;
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
    // ROTULADO DE TALLER, NO CARTELERÍA.
    //
    // Antes cada balda llevaba su texto ocupando los 3,9 m de frente, en letra
    // de 60 cm. Un rótulo así no existe en ninguna planta: los estantes se
    // marcan con una franja de precaución donde hay riesgo y con etiquetas
    // pequeñas en el canto, del tamaño de una tarjeta. Un cartel gigante grita
    // "esto es un tutorial"; una etiqueta chica dice "esto es un taller".
    //
    // La franja va SOLO en la balda inferior, que es la de carga pesada, y es
    // exactamente el uso que le da la norma: señalar dónde hay que tener
    // cuidado, no decorar.
    const esCargaPesada = nivel === "inferior";

    const matCanto = materialPintado(
      scene,
      `matCantoBalda_${nivel}`,
      2048,
      128,
      (ctx, w, h) => {
        if (esCargaPesada) {
          // Franja diagonal amarilla y negra de precaución.
          ctx.fillStyle = "#d8b23a";
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#1a1a1a";
          const paso = h * 1.6;
          for (let i = -h; i < w + h; i += paso) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + h * 0.7, 0);
            ctx.lineTo(i + h * 0.7 - h, h);
            ctx.lineTo(i - h, h);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // Canto liso pintado, como el perfil de un rack real.
          ctx.fillStyle = "#2a3138";
          ctx.fillRect(0, 0, w, h);
        }
      }
    );

    const canto = MeshBuilder.CreateBox(
      `cantoBalda_${nivel}`,
      { width: ANCHO, height: 0.1, depth: 0.03 },
      scene
    );
    canto.position.set(
      x + frenteX * (FONDO / 2 + 0.015),
      y - 0.06,
      z + frenteZ * (FONDO / 2 + 0.015)
    );
    canto.rotation.y = giroY;
    canto.material = esCargaPesada ? matCanto : metal;
    canto.isPickable = false;

    // Etiqueta pequeña en el extremo izquierdo del canto, como las de
    // ubicación que llevan los racks de almacén.
    const matEtiqueta = materialPintado(
      scene,
      `matEtiquetaBalda_${nivel}`,
      // Proporción 1536 x 480 = 3,2 : 1, la misma que la placa de 68 x 21 cm.
      // Si el lienzo y la pieza no coinciden en forma, el texto se estira o se
      // aplasta antes incluso de dibujarlo.
      1536,
      480,
      (ctx, w, h) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w * 0.055, h);

        ctx.fillStyle = "#111417";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // SE ENCOGE HASTA QUE ENTRA.
        //
        // Con tamaño fijo, "USO OCASIONAL" y "PESADO · VA ABAJO" se salían por
        // la derecha y quedaban en "USO OCASION" y "PESADO · VA A". Una
        // etiqueta cortada no identifica nada, que es justo lo contrario de
        // para lo que existe.
        const margenIzq = w * 0.1;
        const disponible = w - margenIzq - w * 0.06;

        let tam = Math.round(h * 0.4);
        ctx.font = `bold ${tam}px system-ui, sans-serif`;

        while (ctx.measureText(rotulo).width > disponible && tam > h * 0.16) {
          tam -= 2;
          ctx.font = `bold ${tam}px system-ui, sans-serif`;
        }

        ctx.fillText(rotulo, margenIzq, h / 2);
      }
    );

    const etiqueta = MeshBuilder.CreateBox(
      `etiquetaBalda_${nivel}`,
      // Placa de 68 x 21 cm.
      //
      // La anterior medía 46 x 14 y su letra quedaba en unos 4 cm de alto: a
      // la distancia desde la que se juega eso no se lee, por mucha resolución
      // que tenga la textura. El problema no era el dibujo, era el TAMAÑO
      // FÍSICO del cartel. Las etiquetas de ubicación de un rack real son
      // grandes justamente por esto.
      { width: 0.68, height: 0.21, depth: 0.008 },
      scene
    );
    etiqueta.position.set(
      x + Math.cos(giroY) * (-ANCHO / 2 + 0.52) + frenteX * (FONDO / 2 + 0.04),
      y - 0.06,
      z - Math.sin(giroY) * (-ANCHO / 2 + 0.4) + frenteZ * (FONDO / 2 + 0.035)
    );
    etiqueta.rotation.y = giroY;
    etiqueta.material = matEtiqueta;
    etiqueta.isPickable = false;

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

    // La bandeja mide 0,07 de alto y está CENTRADA en y, así que su cara
    // superior está en y + 0,035 — no en y + 0,025. Ese centímetro de
    // diferencia es lo que hundía cada objeto dentro de la balda.
    baldas.push({ nivel, superficieY: y + 0.036, mesh: bandeja, receptor });
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
      // 2048 x 496 = 4,13 : 1, la proporción exacta de la placa de 62 x 15 cm.
      //
      // Antes era 2048 x 384, o sea 5,33 : 1 sobre una pieza de 4,13 : 1: el
      // texto se estiraba a lo ancho antes de dibujarse. Ese es el otro motivo
      // por el que se veía mal, además del tamaño.
      2048,
      496,
      (ctx, w, h) => {
        // Blanco puro y texto casi negro: el par anterior —crema sobre gris
        // azulado— tenía poco contraste y con la luz cálida del galpón el
        // texto se lavaba. Una etiqueta se imprime en negro sobre blanco por
        // este motivo exacto.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#2e7d46";
        ctx.fillRect(0, 0, w, h * 0.11);

        ctx.fillStyle = "#111417";
        // El tamaño se calcula sobre el alto del lienzo, no en píxeles fijos:
        // así subir la resolución no encoge la letra.
        const base = Math.round(h * 0.44);
        ctx.font = `bold ${base}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Se encoge la letra en vez de recortar el nombre: "Carpeta de
        // mantenimiento" cortada a la mitad no identifica nada.
        let tamano = base;
        while (ctx.measureText(texto.toUpperCase()).width > w * 0.9 && tamano > base * 0.4) {
          tamano -= 2;
          ctx.font = `bold ${tamano}px system-ui, sans-serif`;
        }
        ctx.fillText(texto.toUpperCase(), w / 2, h / 2 + h * 0.06);
      }
    );

    const etiqueta = MeshBuilder.CreateBox(
      `etiquetaBalda_${nivel}_${indice}`,
      // De 50 x 9 cm a 62 x 15. Con 9 cm de alto la letra quedaba en 4 y no
      // se leía desde donde se juega, por nítida que fuera la textura.
      { width: 0.62, height: 0.15, depth: 0.012 },
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