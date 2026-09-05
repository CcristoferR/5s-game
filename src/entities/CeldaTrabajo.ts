import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh } from "@babylonjs/core";
import { texturaGrano } from "./TexturasSuperficie";
import { materialPintado } from "./ObjetosComunes";

// ---------------------------------------------------------------------------
// Pizarra de instrucciones
// ---------------------------------------------------------------------------
//
// Reemplaza al texto blanco flotando sobre el techo.
//
// Ese texto rompía la inmersión de la peor manera: se leía como un subtítulo
// del juego, no como algo del taller. Y contradecía la propia lección del
// nivel — Seiton pide que el área hable por sí sola, con la información EN el
// sitio. Un galpón real tiene la instrucción escrita en una pizarra colgada de
// la pared, y ahí es donde tiene que estar.
//
// Como pieza física además ancla el fondo: la pared de ladrillo estaba vacía y
// ahora tiene algo a lo que mirar.

export interface LineaPizarra {
  texto: string;
  /** Destacada: se escribe más grande y en color. Para el título. */
  titulo?: boolean;
}

/**
 * Pizarra blanca con marco de aluminio y bandeja de rotuladores.
 *
 * @param giroY  Orientación. Cero mira hacia el interior desde el fondo.
 */
export function crearPizarraInstrucciones(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  giroY: number,
  lineas: LineaPizarra[]
): Mesh {
  const ANCHO = 2.9;
  const ALTO = 1.55;

  // El texto se dibuja a 2048 px de ancho para que se lea sin acercarse. La
  // proporción del lienzo copia la de la pizarra, así ninguna letra se estira.
  const RES = 2048;
  const RES_ALTO = Math.round((RES * ALTO) / ANCHO);

  const matSuperficie = materialPintado(
    scene,
    "matPizarraInstrucciones",
    RES,
    RES_ALTO,
    (ctx, w, h) => {
      // Blanco muy levemente frío y con grano: un blanco puro y plano se ve
      // como un rectángulo de interfaz pegado a la pared.
      ctx.fillStyle = "#eef1f0";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.012)" : "rgba(255,255,255,0.02)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }

      // Restos de marcador mal borrado en una esquina. Es el detalle que
      // convierte una superficie blanca en una pizarra usada.
      ctx.strokeStyle = "rgba(90,110,120,0.1)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(w * 0.72, h * 0.12);
      ctx.bezierCurveTo(w * 0.8, h * 0.2, w * 0.88, h * 0.1, w * 0.94, h * 0.22);
      ctx.stroke();

      const margen = w * 0.07;
      let cursor = h * 0.2;

      lineas.forEach((linea) => {
        if (linea.titulo) {
          ctx.fillStyle = "#1f6b45";
          ctx.font = `bold ${Math.round(h * 0.115)}px system-ui, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(linea.texto, margen, cursor);

          // Subrayado a mano alzada, como el de un rotulador.
          ctx.strokeStyle = "#1f6b45";
          ctx.lineWidth = h * 0.012;
          ctx.beginPath();
          ctx.moveTo(margen, cursor + h * 0.035);
          ctx.lineTo(margen + ctx.measureText(linea.texto).width, cursor + h * 0.028);
          ctx.stroke();

          cursor += h * 0.19;
          return;
        }

        ctx.fillStyle = "#26343b";
        ctx.font = `${Math.round(h * 0.082)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(linea.texto, margen, cursor);
        cursor += h * 0.125;
      });
    }
  );

  const superficie = MeshBuilder.CreateBox(
    "pizarraInstrucciones",
    { width: ANCHO, height: ALTO, depth: 0.03 },
    scene
  );
  superficie.position.set(x, y, z);
  superficie.rotation.y = giroY;
  superficie.material = matSuperficie;
  superficie.isPickable = false;

  // --- Marco de aluminio ---
  const matMarco = new PBRMaterial("matMarcoPizarra", scene);
  matMarco.albedoColor = new Color3(0.68, 0.7, 0.72);
  matMarco.roughness = 0.38;
  matMarco.metallic = 0.82;
  matMarco.microSurfaceTexture = texturaGrano(scene, 0.05);

  const GRUESO = 0.055;
  const perfil = (nombre: string, ancho: number, alto: number, dx: number, dy: number): void => {
    const pieza = MeshBuilder.CreateBox(nombre, { width: ancho, height: alto, depth: 0.05 }, scene);
    pieza.position.set(x + Math.cos(giroY) * dx, y + dy, z - Math.sin(giroY) * dx);
    pieza.rotation.y = giroY;
    pieza.material = matMarco;
    pieza.isPickable = false;
  };

  perfil("marcoPizarraSup", ANCHO + GRUESO * 2, GRUESO, 0, ALTO / 2 + GRUESO / 2);
  perfil("marcoPizarraInf", ANCHO + GRUESO * 2, GRUESO, 0, -ALTO / 2 - GRUESO / 2);
  perfil("marcoPizarraIzq", GRUESO, ALTO, -ANCHO / 2 - GRUESO / 2, 0);
  perfil("marcoPizarraDer", GRUESO, ALTO, ANCHO / 2 + GRUESO / 2, 0);

  // ===================================================================
  // SOPORTE CON RUEDAS
  // ===================================================================
  //
  // La pizarra iba colgada de la pared, y ahí estaba el problema: el garaje es
  // un modelo cargado, así que no hay forma fiable de saber dónde cae el muro
  // desde el código. Cualquier profundidad que se elija es una estimación, y
  // basta con errar veinte centímetros —o colgarla frente a un portón— para
  // que se vea flotando. Eso ya pasó dos veces.
  //
  // Un caballete con ruedas se apoya en el SUELO, que sí sabemos dónde está.
  // Deja de depender de la geometría del garaje y además es más fiel: en un
  // taller la pizarra del turno se mueve al área donde se está trabajando.
  const matPata = new PBRMaterial("matPataPizarra", scene);
  matPata.albedoColor = new Color3(0.32, 0.34, 0.37);
  matPata.roughness = 0.42;
  matPata.metallic = 0.75;

  const alturaBase = y - ALTO / 2 - GRUESO;

  [-1, 1].forEach((lado) => {
    const dx = lado * (ANCHO / 2 - 0.12);

    const pata = MeshBuilder.CreateBox(
      `pataPizarra_${lado}`,
      { width: 0.07, height: alturaBase, depth: 0.07 },
      scene
    );
    pata.position.set(
      x + Math.cos(giroY) * dx,
      alturaBase / 2,
      z - Math.sin(giroY) * dx
    );
    pata.rotation.y = giroY;
    pata.material = matPata;
    pata.isPickable = false;

    // Pie en T: dos ruedas por pata, adelante y atrás. Es lo que impide que
    // el conjunto se lea como una tabla clavada en el aire.
    const pie = MeshBuilder.CreateBox(
      `piePizarra_${lado}`,
      { width: 0.09, height: 0.05, depth: 0.62 },
      scene
    );
    pie.position.set(
      x + Math.cos(giroY) * dx,
      0.075,
      z - Math.sin(giroY) * dx
    );
    pie.rotation.y = giroY;
    pie.material = matPata;
    pie.isPickable = false;

    [-1, 1].forEach((frente) => {
      const rueda = MeshBuilder.CreateCylinder(
        `ruedaPizarra_${lado}_${frente}`,
        { diameter: 0.1, height: 0.045, tessellation: 14 },
        scene
      );
      rueda.position.set(
        x + Math.cos(giroY) * dx + Math.sin(giroY) * frente * 0.26,
        0.05,
        z - Math.sin(giroY) * dx + Math.cos(giroY) * frente * 0.26
      );
      rueda.rotation.z = Math.PI / 2;
      rueda.rotation.y = giroY;
      rueda.material = matPata;
      rueda.isPickable = false;
    });
  });

  // Travesaño entre las dos patas, a media altura.
  const travesanoPizarra = MeshBuilder.CreateBox(
    "travesanoPizarra",
    { width: ANCHO - 0.24, height: 0.05, depth: 0.05 },
    scene
  );
  travesanoPizarra.position.set(x, alturaBase * 0.45, z);
  travesanoPizarra.rotation.y = giroY;
  travesanoPizarra.material = matPata;
  travesanoPizarra.isPickable = false;

  // Bandeja inferior para los rotuladores. Sobresale hacia el taller: es lo
  // que da profundidad y evita que la pizarra parezca una lámina plana.
  const bandeja = MeshBuilder.CreateBox(
    "bandejaPizarra",
    { width: ANCHO * 0.55, height: 0.03, depth: 0.11 },
    scene
  );
  bandeja.position.set(
    x + Math.sin(giroY) * 0.06,
    y - ALTO / 2 - 0.05,
    z + Math.cos(giroY) * 0.06
  );
  bandeja.rotation.y = giroY;
  bandeja.material = matMarco;
  bandeja.isPickable = false;

  const rotulador = MeshBuilder.CreateCylinder(
    "rotuladorPizarra",
    { diameter: 0.028, height: 0.13, tessellation: 10 },
    scene
  );
  rotulador.position.set(
    x + Math.cos(giroY) * 0.5 + Math.sin(giroY) * 0.06,
    y - ALTO / 2 - 0.02,
    z - Math.sin(giroY) * 0.5 + Math.cos(giroY) * 0.06
  );
  rotulador.rotation.z = Math.PI / 2;
  rotulador.rotation.y = giroY;
  rotulador.material = matMarco;
  rotulador.isPickable = false;

  return superficie;
}

// ---------------------------------------------------------------------------
// Cinta de delimitación
// ---------------------------------------------------------------------------
//
// Video 3.3, paso 4: una vez definido el sitio de cada cosa "se procede a
// delimitar, pintar líneas en el suelo y colocar las etiquetas".
//
// Cumple una función visual además de la didáctica: sin líneas, los muebles se
// leen como puestos al azar en medio del mapa. La cinta los ata al piso y
// convierte tres objetos sueltos en una celda de trabajo.

/**
 * Marco de cinta pintado en el piso alrededor de una zona.
 *
 * Se dibuja como contorno hueco, no como rectángulo relleno: una alfombra de
 * color taparía el hormigón y se vería como una zona de destino más, que es
 * justo lo que no es. Acá solo se marca el perímetro.
 */
export function crearCintaDelimitacion(
  scene: Scene,
  x: number,
  z: number,
  ancho: number,
  fondo: number,
  opciones: { color?: string; grosorCm?: number; discontinua?: boolean } = {}
): Mesh {
  const { color = "#d8b23a", grosorCm = 9, discontinua = false } = opciones;

  // Resolución proporcional al tamaño real, para que la cinta tenga el mismo
  // grosor aparente en zonas grandes y pequeñas.
  const PX_POR_METRO = 220;
  const anchoPx = Math.round(ancho * PX_POR_METRO);
  const altoPx = Math.round(fondo * PX_POR_METRO);
  const grosorPx = Math.round((grosorCm / 100) * PX_POR_METRO);

  const material = materialPintado(
    scene,
    `matCinta_${x}_${z}`,
    anchoPx,
    altoPx,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = color;
      ctx.lineWidth = grosorPx;

      if (discontinua) ctx.setLineDash([grosorPx * 4, grosorPx * 2.2]);

      const mitad = grosorPx / 2;
      ctx.strokeRect(mitad, mitad, w - grosorPx, h - grosorPx);

      // Desgaste: la cinta de un taller en uso está rozada por las ruedas de
      // las transpaletas. Sin esto se ve recién pintada, que es lo que menos
      // encaja en un galpón con años encima.
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 26; i++) {
        ctx.globalAlpha = 0.15 + Math.random() * 0.3;
        const lado = Math.floor(Math.random() * 4);
        const largo = grosorPx * (1 + Math.random() * 3);
        if (lado === 0) ctx.fillRect(Math.random() * w, 0, largo, grosorPx);
        else if (lado === 1) ctx.fillRect(Math.random() * w, h - grosorPx, largo, grosorPx);
        else if (lado === 2) ctx.fillRect(0, Math.random() * h, grosorPx, largo);
        else ctx.fillRect(w - grosorPx, Math.random() * h, grosorPx, largo);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  );

  material.alpha = 0.95;

  const marco = MeshBuilder.CreateGround(
    `cintaDelimitacion_${x}_${z}`,
    { width: ancho, height: fondo },
    scene
  );
  // Justo sobre el hormigón, por debajo de cualquier otra marca del nivel.
  marco.position.set(x, 0.011, z);
  marco.material = material;
  marco.isPickable = false;
  marco.receiveShadows = true;

  return marco;
}