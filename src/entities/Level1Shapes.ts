import { Scene, MeshBuilder, Color3, Mesh, Matrix } from "@babylonjs/core";
import type { ObjetoNivel1 } from "../data/levelConfig";
import {
  cm,
  APOYO,
  material,
  materialPintado,
  caja,
  cilindro,
  lamina,
  laminaVertical,
  fusionar,
  crearEngrapadora,
  crearCarpeta,
  crearManual,
  crearTazaBase,
} from "./ObjetosComunes";

/**
 * Objetos del Nivel 1 (Seiri — clasificar).
 *
 * Este nivel consiste en mirar un objeto y decidir si se conserva, se descarta
 * o queda en duda. Si el objeto no se reconoce, no hay decisión posible: el
 * jugador termina leyendo la etiqueta y adivinando. Por eso acá la claridad de
 * la forma no es decoración, es la mecánica.
 *
 * Cada objeto lleva impresa la señal que justifica su clasificación:
 *
 *   NECESARIO   engrapadora, carpeta activa, cinta métrica, manual
 *   DESCARTAR   taza con café viejo, diario vencido, casco agrietado, chatarra
 *   DUDOSO      caja sin etiqueta, guantes de uso ocasional
 *
 * La engrapadora, la carpeta y el manual se construyen en ObjetosComunes.ts,
 * porque también aparecen en el Nivel 2 y tienen que ser idénticos.
 */

export function crearFormaNivel1(scene: Scene, datos: ObjetoNivel1): Mesh {
  const mesh = apoyarSobreLaBase(construir(scene, datos.id));
  mesh.name = datos.id;
  return mesh;
}

/**
 * Baja la geometría hasta que su punto más bajo quede exactamente en y = 0.
 *
 * Cada objeto se modela con las medidas que le quedan naturales, así que cada
 * uno termina con su origen en un lugar distinto: la engrapadora se hundía
 * 1,2 cm en el tablero por el cilindro del morro y el casco flotaba 1,4 cm
 * por la curvatura del domo.
 *
 * Medirlo y corregirlo acá evita ajustar diez posiciones a mano y que se
 * rompan de nuevo cada vez que se retoque un modelo. Es el mismo criterio que
 * ya usaba el Nivel 2.
 */
function apoyarSobreLaBase(mesh: Mesh): Mesh {
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();
  const minimo = mesh.getBoundingInfo().boundingBox.minimumWorld.y;

  if (Math.abs(minimo) < 0.0005) return mesh;

  // Se hornea en la geometría en vez de mover la posición: el nivel coloca
  // cada objeto en su coordenada y una posición corregida se perdería.
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, -minimo, 0));
  mesh.refreshBoundingInfo();
  return mesh;
}

function construir(scene: Scene, id: string): Mesh {
  switch (id) {
    case "engrapadora":
      return crearEngrapadora(scene, id);
    case "carpeta_activa":
      return crearCarpeta(scene, id, "PROYECTO ACTIVO");
    case "manual_procedimientos":
      return crearManual(scene, id, "MANUAL");
    case "taza_cafe":
      return crearTazaConCafe(scene, id);
    case "diario_viejo":
      return crearDiario(scene, id);
    case "caja_sin_etiqueta":
      return crearCajaSinEtiqueta(scene, id);
    case "casco_agrietado":
      return crearCasco(scene, id);
    case "cinta_metrica":
      return crearCintaMetrica(scene, id);
    case "guantes_ocasionales":
      return crearGuantes(scene, id);
    case "chatarra_metal":
      return crearChatarra(scene, id);
    default: {
      const mesh = MeshBuilder.CreateBox(id, { size: cm(15) }, scene);
      mesh.material = material(scene, `mat_${id}`, new Color3(0.6, 0.6, 0.65), 0.7);
      return mesh;
    }
  }
}

// ---------------------------------------------------------------------------
// DESCARTAR — taza con café olvidado
// ---------------------------------------------------------------------------

/**
 * No es una taza sucia genérica: es una taza que lleva días ahí.
 *
 * Tres señales lo dicen, y las tres son necesarias. El café opaco y bajo, no
 * lleno ni humeante. El cerco seco en la pared interior, que marca el nivel que
 * tenía antes de evaporarse. Y el chorreado por fuera, ya seco. Con solo una de
 * las tres se lee como "taza en uso" y el jugador la conserva.
 */
function crearTazaConCafe(scene: Scene, id: string): Mesh {
  const { partes, radioInterior } = crearTazaBase(scene, id, new Color3(0.93, 0.93, 0.91), true);

  const matCafe = material(scene, `matCafe_${id}`, new Color3(0.09, 0.05, 0.028), 0.1);
  const matResto = material(scene, `matResto_${id}`, new Color3(0.26, 0.15, 0.08), 0.78);

  // Superficie del café, baja y opaca.
  partes.push(cilindro(scene, `cafe_${id}`, radioInterior * 2 * 0.97, cm(0.4), 0, APOYO + cm(3.4), 0, matCafe, 28));

  // Película seca encima: el brillo apagado de algo que lleva días.
  const pelicula = cilindro(scene, `pelicula_${id}`, radioInterior * 2 * 0.7, cm(0.06), 0, APOYO + cm(3.6), 0, matResto, 20);
  pelicula.position.x = cm(0.6);
  partes.push(pelicula);

  // Cerco seco en la pared interior — la marca del nivel anterior.
  const cerco = MeshBuilder.CreateTorus(`cerco_${id}`, { diameter: radioInterior * 2, thickness: cm(0.22), tessellation: 24 }, scene);
  cerco.position.y = APOYO + cm(5.2);
  cerco.material = matResto;
  partes.push(cerco);

  // Chorreado por fuera, ya seco.
  const chorreado = caja(scene, `chorreado_${id}`, cm(0.7), cm(4), cm(0.25), cm(4.1), APOYO + cm(7), cm(1.4), matResto);
  chorreado.rotation.z = 0.1;
  partes.push(chorreado);

  const gota = cilindro(scene, `gota_${id}`, cm(1.1), cm(0.12), cm(4.2), APOYO + cm(0.06), cm(1.4), matResto, 14);
  partes.push(gota);

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// DESCARTAR — diario de hace seis meses
// ---------------------------------------------------------------------------

/**
 * Un diario se reconoce por su portada, no por su forma: doblado es un
 * rectángulo de papel como cualquier otro.
 *
 * Por eso la portada va impresa, con cabecera, titular, columnas y foto. Y la
 * fecha vieja bien visible: es lo único que justifica descartarlo, porque un
 * diario de hoy sería material vigente.
 */
function crearDiario(scene: Scene, id: string): Mesh {
  const matPapel = material(scene, `matPapelDia_${id}`, new Color3(0.86, 0.84, 0.78), 0.94);

  const matPortada = materialPintado(scene, `matPortadaDia_${id}`, 420, 560, (ctx, w, h) => {
    // Papel de diario: no es blanco, tira a hueso, y con los años amarillea.
    ctx.fillStyle = "#ded8c8";
    ctx.fillRect(0, 0, w, h);

    // Cabecera.
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 54px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("EL DIARIO", w / 2, 62);

    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 78);
    ctx.lineTo(w - 24, 78);
    ctx.stroke();

    // La fecha vieja: la señal que justifica descartarlo.
    ctx.fillStyle = "#3a3a3a";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("MARTES 12 DE FEBRERO", w / 2, 102);

    ctx.beginPath();
    ctx.moveTo(24, 114);
    ctx.lineTo(w - 24, 114);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Titular.
    ctx.fillStyle = "#111111";
    ctx.font = "bold 38px Georgia, serif";
    ctx.textAlign = "left";
    ctx.fillText("Cierra la planta", 26, 168);
    ctx.fillText("por mantención", 26, 208);

    // Foto.
    ctx.fillStyle = "#a9a294";
    ctx.fillRect(26, 228, 172, 124);
    ctx.fillStyle = "#8b8478";
    ctx.fillRect(38, 296, 148, 56);
    ctx.fillStyle = "#c2bbad";
    ctx.beginPath();
    ctx.arc(150, 262, 22, 0, Math.PI * 2);
    ctx.fill();

    // Columnas de texto: rayas grises que a esta escala se leen como párrafos.
    ctx.fillStyle = "rgba(30,30,30,0.55)";
    for (let col = 0; col < 2; col++) {
      const x = 214 + col * 100;
      for (let i = 0; i < 11; i++) {
        const ancho = i % 4 === 3 ? 52 : 88;
        ctx.fillRect(x, 232 + i * 11, ancho, 4);
      }
    }
    for (let col = 0; col < 4; col++) {
      const x = 26 + col * 100;
      for (let i = 0; i < 16; i++) {
        const ancho = i % 5 === 4 ? 50 : 88;
        ctx.fillRect(x, 372 + i * 11, ancho, 4);
      }
    }

    // Manchas de amarilleo por el borde: el papel envejecido.
    ctx.fillStyle = "rgba(160,130,70,0.16)";
    ctx.fillRect(0, 0, 18, h);
    ctx.fillRect(w - 22, 0, 22, h);
    ctx.fillRect(0, h - 26, w, 26);
  });

  const ANCHO = cm(29);
  const FONDO = cm(38);
  const partes: Mesh[] = [];

  // Varias hojas apiladas y desalineadas: un diario nunca queda parejo.
  for (let i = 0; i < 4; i++) {
    const hoja = caja(scene, `hojaDia_${id}_${i}`, ANCHO - i * cm(0.4), cm(0.2), FONDO - i * cm(0.5),
      cm(0.3) * i, APOYO + cm(0.1) + i * cm(0.2), cm(0.25) * i, matPapel);
    hoja.rotation.y = (i - 1.5) * 0.02;
    partes.push(hoja);
  }

  // El pliegue central, que es lo que hace que se lea "diario" y no "resma".
  const pliegue = cilindro(scene, `pliegueDia_${id}`, cm(1), ANCHO * 0.98, 0, APOYO + cm(0.5), -FONDO / 2, matPapel, 10);
  pliegue.rotation.z = Math.PI / 2;
  partes.push(pliegue);

  partes.push(lamina(scene, `portadaDia_${id}`, ANCHO * 0.96, FONDO * 0.94, 0, APOYO + cm(0.92), 0, matPortada));

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// DUDOSO — caja sin etiqueta
// ---------------------------------------------------------------------------

/**
 * Lo que la hace dudosa no es la caja: es la ausencia de información.
 *
 * Se resuelve mostrando dónde DEBERÍA estar la etiqueta y no está — un
 * rectángulo más claro con restos de pegamento, como queda cuando alguien
 * arranca la anterior. Una caja cerrada y limpia no transmite nada; una con la
 * marca de la etiqueta arrancada se lee de inmediato.
 */
function crearCajaSinEtiqueta(scene: Scene, id: string): Mesh {
  const matCarton = material(scene, `matCartonCaja_${id}`, new Color3(0.72, 0.55, 0.34), 0.92);
  const matCinta = material(scene, `matCintaCaja_${id}`, new Color3(0.80, 0.74, 0.58), 0.55);

  const matCara = materialPintado(scene, `matCaraCaja_${id}`, 400, 300, (ctx, w, h) => {
    ctx.fillStyle = "#b78d57";
    ctx.fillRect(0, 0, w, h);

    // Grano del cartón: rayas horizontales muy tenues.
    ctx.strokeStyle = "rgba(90,60,30,0.10)";
    ctx.lineWidth = 2;
    for (let y = 6; y < h; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Marca de la etiqueta arrancada: rectángulo más claro con borde irregular.
    ctx.fillStyle = "#cba874";
    ctx.fillRect(112, 92, 176, 116);
    ctx.fillStyle = "rgba(150,110,60,0.35)";
    for (let i = 0; i < 26; i++) {
      const x = 112 + Math.random() * 176;
      const y = 92 + Math.random() * 116;
      ctx.fillRect(x, y, 3 + Math.random() * 9, 2 + Math.random() * 4);
    }
    ctx.strokeStyle = "rgba(120,85,45,0.55)";
    ctx.setLineDash([9, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(112, 92, 176, 116);
    ctx.setLineDash([]);

    // El signo de interrogación escrito a mano encima: alguien ya se preguntó
    // qué había adentro y no lo resolvió.
    ctx.fillStyle = "#4a3520";
    ctx.font = "bold 84px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("?", 200, 178);
  });

  const A = cm(30);
  const AL = cm(22);
  const F = cm(24);
  const partes: Mesh[] = [];

  partes.push(caja(scene, `cuerpoCaja_${id}`, A, AL, F, 0, APOYO + AL / 2, 0, matCarton));

  // Cara frontal con el dibujo.
  partes.push(laminaVertical(scene, `caraCaja_${id}`, A * 0.94, AL * 0.9, 0, APOYO + AL / 2, -F / 2 - cm(0.1), matCara));

  // Cinta de embalaje: cruza la tapa y baja por los dos costados.
  partes.push(caja(scene, `cintaCaja_${id}`, cm(5), cm(0.15), F + cm(0.2), 0, APOYO + AL + cm(0.05), 0, matCinta));
  partes.push(caja(scene, `cintaFrenteCaja_${id}`, cm(5), cm(4), cm(0.15), 0, APOYO + AL - cm(2), -F / 2 - cm(0.05), matCinta));
  partes.push(caja(scene, `cintaAtrasCaja_${id}`, cm(5), cm(4), cm(0.15), 0, APOYO + AL - cm(2), F / 2 + cm(0.05), matCinta));

  // Solapas de la tapa apenas levantadas: la caja está cerrada pero no sellada,
  // que es coherente con "nadie sabe qué hay adentro".
  const solapa = caja(scene, `solapaCaja_${id}`, A * 0.46, cm(0.3), F * 0.9, -A * 0.26, APOYO + AL + cm(0.4), 0, matCarton);
  solapa.rotation.z = -0.12;
  partes.push(solapa);

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// DESCARTAR — casco de seguridad agrietado
// ---------------------------------------------------------------------------

/**
 * Un casco entero y uno rajado tienen la misma silueta. Lo único que los separa
 * es la grieta, así que la grieta tiene que verse sí o sí desde arriba, que es
 * de donde mira la cámara.
 *
 * Va oscura y recorriendo el domo entero, no como una raya fina: a la distancia
 * de juego, una fisura sutil no se percibe y el jugador conserva un casco que
 * debería descartar — que es justo el error que el nivel busca corregir.
 */
function crearCasco(scene: Scene, id: string): Mesh {
  // LA GRIETA VA PINTADA SOBRE EL DOMO, no construida con piezas.
  //
  // La versión anterior la armaba con cajas negras apoyadas sobre la esfera. A
  // la distancia de juego no se veían: quedaban ocultas por la curvatura o se
  // confundían con una sombra, y el casco se leía como uno sano. En un nivel
  // donde hay que decidir si algo se descarta, eso es el error más caro
  // posible.
  //
  // Pintada en la textura, la fisura recorre el domo completo, es negra y
  // ancha, y se ve desde cualquier ángulo de cámara.
  const matCasco = materialPintado(scene, `matCascoTex_${id}`, 640, 320, (ctx, w, h) => {
    // Amarillo de seguridad como base.
    ctx.fillStyle = "#e8ad14";
    ctx.fillRect(0, 0, w, h);

    // Sombreado suave hacia el borde inferior: le da volumen al domo aunque
    // la geometría sea una media esfera lisa.
    for (let y = 0; y < h; y++) {
      const oscuridad = Math.pow(y / h, 2) * 0.22;
      ctx.fillStyle = `rgba(60,40,0,${oscuridad})`;
      ctx.fillRect(0, y, w, 1);
    }

    // Nervaduras: los refuerzos que todo casco lleva de adelante atrás.
    ctx.strokeStyle = "rgba(140,95,0,0.35)";
    ctx.lineWidth = 7;
    [0.18, 0.5, 0.82].forEach((frac) => {
      ctx.beginPath();
      ctx.moveTo(w * frac, 0);
      ctx.lineTo(w * frac, h);
      ctx.stroke();
    });

    // LA GRIETA. Trazo quebrado, no una línea recta: una fisura real cambia de
    // dirección al avanzar porque sigue las tensiones del material.
    const quiebres = [
      [0.30, 0.02], [0.33, 0.18], [0.29, 0.32], [0.35, 0.46],
      [0.31, 0.60], [0.37, 0.74], [0.34, 0.90], [0.39, 1.0],
    ];

    // Halo claro alrededor: el material blanquea al agrietarse, y ese contraste
    // es lo que hace que la grieta se lea incluso de lejos.
    ctx.strokeStyle = "rgba(255,238,190,0.85)";
    ctx.lineWidth = 15;
    ctx.lineJoin = "round";
    ctx.beginPath();
    quiebres.forEach(([x, y], i) => {
      const px = w * x;
      const py = h * y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // La fisura misma.
    ctx.strokeStyle = "#141008";
    ctx.lineWidth = 7;
    ctx.beginPath();
    quiebres.forEach(([x, y], i) => {
      const px = w * x;
      const py = h * y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Ramificaciones cortas: una grieta nunca es un trazo único.
    ctx.lineWidth = 4;
    [[0.33, 0.18, 0.26, 0.26], [0.35, 0.46, 0.43, 0.52], [0.31, 0.60, 0.24, 0.68]].forEach(
      ([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(w * x1, h * y1);
        ctx.lineTo(w * x2, h * y2);
        ctx.stroke();
      }
    );

    // Marcas de uso: el casco está gastado, no recién salido de la caja.
    ctx.fillStyle = "rgba(90,60,10,0.18)";
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillRect(x, y, 4 + Math.random() * 22, 3 + Math.random() * 6);
    }
  });
  matCasco.roughness = 0.4;
  matCasco.metallic = 0;

  const matCascoLiso = material(scene, `matCascoLiso_${id}`, new Color3(0.90, 0.66, 0.08), 0.4, 0, true);
  const matArnes = material(scene, `matArnes_${id}`, new Color3(0.16, 0.16, 0.18), 0.85);
  const matSombra = material(scene, `matSombraCasco_${id}`, new Color3(0.06, 0.05, 0.03), 0.95);

  const R = cm(11);
  const partes: Mesh[] = [];

  // Domo: media esfera achatada, con la grieta en su textura.
  const domo = MeshBuilder.CreateSphere(`domoCasco_${id}`, { diameter: R * 2, slice: 0.5, segments: 26 }, scene);
  domo.scaling.y = 0.82;
  domo.position.y = APOYO + cm(1.4);
  domo.material = matCasco;
  partes.push(domo);

  // Ala perimetral, más ancha por delante como los cascos reales.
  const ala = MeshBuilder.CreateTorus(`alaCasco_${id}`, { diameter: R * 2.02, thickness: cm(2.2), tessellation: 28 }, scene);
  ala.scaling.z = 1.18;
  ala.scaling.y = 0.42;
  ala.position.y = APOYO + cm(1.4);
  ala.material = matCascoLiso;
  partes.push(ala);

  // Nervadura central en relieve, sobre las pintadas.
  partes.push(caja(scene, `nervCasco_${id}`, cm(2.2), cm(0.9), R * 1.86, 0, APOYO + cm(8.2), 0, matCascoLiso));

  // TROZO FALTANTE en el borde del ala, en el arranque de la grieta.
  //
  // Es la segunda señal, y hace falta: la grieta pintada dice que el material
  // se fisuró, pero un pedazo ausente del ala se ve como silueta contra el
  // fondo y se percibe incluso sin mirar la textura.
  const muesca = caja(scene, `muescaCasco_${id}`, cm(3.4), cm(3), cm(2.6), -cm(4.6), APOYO + cm(1.4), -R * 0.92, matSombra);
  muesca.rotation.y = 0.4;
  partes.push(muesca);

  // Esquirla levantada al lado de la muesca: dice que el material cedió y no
  // que la pieza vino así de fábrica.
  const esquirla = caja(scene, `esquirlaCasco_${id}`, cm(2.6), cm(0.5), cm(2.2), -cm(6.4), APOYO + cm(2.6), -R * 0.78, matCascoLiso);
  esquirla.rotation.z = 0.55;
  esquirla.rotation.y = 0.4;
  partes.push(esquirla);

  // Arnés interior asomando por el hueco del ala: da profundidad y ayuda a
  // leerlo como casco y no como un cuenco dado vuelta.
  [-1, 1].forEach((lado, i) => {
    partes.push(caja(scene, `arnes_${id}_${i}`, cm(1.2), cm(0.4), R * 1.5, lado * cm(4), APOYO + cm(2.2), 0, matArnes));
  });
  partes.push(caja(scene, `arnesCruz_${id}`, R * 1.5, cm(0.4), cm(1.2), 0, APOYO + cm(2.2), 0, matArnes));

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// NECESARIO — cinta métrica
// ---------------------------------------------------------------------------

/**
 * La cinta métrica se identifica por la lengüeta con números, no por la caja.
 *
 * Sin la cinta asomando, la carcasa amarilla es un objeto anónimo. Con ella
 * afuera y las marcas impresas, se reconoce al instante — y de paso dice que es
 * una herramienta en uso, que es lo que justifica conservarla.
 */
function crearCintaMetrica(scene: Scene, id: string): Mesh {
  const matCarcasa = material(scene, `matCarcasaCin_${id}`, new Color3(0.90, 0.68, 0.10), 0.4, 0, true);
  const matGoma = material(scene, `matGomaCin_${id}`, new Color3(0.10, 0.10, 0.12), 0.9);
  const matMetal = material(scene, `matMetalCin_${id}`, new Color3(0.62, 0.63, 0.66), 0.25, 0.85);

  const matCinta = materialPintado(scene, `matCintaCin_${id}`, 512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#f2e07a";
    ctx.fillRect(0, 0, w, h);

    // Marcas y números. A la escala de juego no se leen los dígitos, pero el
    // patrón de rayas sí se percibe, y eso basta para reconocer una huincha.
    ctx.strokeStyle = "#1e1e1e";
    for (let i = 0; i < 34; i++) {
      const x = 12 + i * 15;
      const largo = i % 10 === 0 ? h * 0.62 : i % 5 === 0 ? h * 0.42 : h * 0.26;
      ctx.lineWidth = i % 10 === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, largo);
      ctx.stroke();

      if (i % 10 === 0 && i > 0) {
        ctx.fillStyle = "#1e1e1e";
        ctx.font = "bold 22px system-ui, sans-serif";
        ctx.fillText(String(i / 10 * 10), x + 5, h * 0.86);
      }
    }
  });

  const A = cm(7);
  const partes: Mesh[] = [];

  // Carcasa con el canto de goma alrededor.
  partes.push(caja(scene, `cuerpoCin_${id}`, A, cm(6.6), cm(3.4), 0, APOYO + cm(3.3), 0, matCarcasa));
  partes.push(caja(scene, `gomaCin_${id}`, A * 1.06, cm(2), cm(3.6), 0, APOYO + cm(1), 0, matGoma));
  partes.push(caja(scene, `gomaSupCin_${id}`, A * 1.06, cm(1.4), cm(3.6), 0, APOYO + cm(6), 0, matGoma));

  // Rueda del retractor: la circunferencia visible en el costado.
  const rueda = cilindro(scene, `ruedaCin_${id}`, cm(4.6), cm(0.3), 0, APOYO + cm(3.4), cm(1.75), matGoma, 22);
  rueda.rotation.x = Math.PI / 2;
  partes.push(rueda);

  // Traba y clip.
  partes.push(caja(scene, `trabaCin_${id}`, cm(2.2), cm(0.9), cm(0.7), 0, APOYO + cm(5.2), -cm(1.8), matGoma));
  partes.push(caja(scene, `clipCin_${id}`, cm(0.9), cm(3), cm(0.3), -A / 2 - cm(0.3), APOYO + cm(2.6), 0, matMetal));

  // La cinta asomando, con una leve caída.
  const lengueta = caja(scene, `lenguetaCin_${id}`, cm(11), cm(0.12), cm(2.5), A / 2 + cm(5), APOYO + cm(0.5), 0, matCinta);
  lengueta.rotation.z = -0.04;
  partes.push(lengueta);
  partes.push(lamina(scene, `marcasCin_${id}`, cm(11), cm(2.5), A / 2 + cm(5), APOYO + cm(0.58), 0, matCinta));

  // Gancho del extremo, doblado hacia arriba.
  partes.push(caja(scene, `ganchoCin_${id}`, cm(0.35), cm(1.4), cm(2.7), A / 2 + cm(10.4), APOYO + cm(1.1), 0, matMetal));

  return fusionar(partes, id);
}

// ---------------------------------------------------------------------------
// DUDOSO — guantes de uso ocasional
// ---------------------------------------------------------------------------

/**
 * Par de guantes de trabajo, en buen estado.
 *
 * Lo dudoso acá no es el estado del objeto sino su frecuencia de uso: están
 * sanos, pero se ocupan pocas veces al mes. Por eso se modelan limpios y
 * completos — un guante roto se descartaría sin dudar y el nivel perdería el
 * matiz que quiere enseñar.
 *
 * Los tres colores (cuero claro, puño azul, refuerzo oscuro) son los de un
 * guante real y son justamente los que dan la lectura: el puño de otro color
 * dice "esto se calza".
 *
 * IMPORTANTE: la versión anterior devolvía una malla raíz con las piezas como
 * hijas y sin fusionar. Medía cero, no la detectaba el sistema de arrastre y el
 * objeto era imposible de clasificar. Ahora se fusiona como todos los demás.
 */
function crearGuantes(scene: Scene, id: string): Mesh {
  // Guante simple y legible: palma plana con cinco dedos y puño de color.
  //
  // El intento anterior rotaba cada pieza por separado combinando giros en dos
  // ejes. Con cilindros eso no funciona: al aplicar un giro sobre otro, el
  // orden en que Babylon los compone cambia el eje del segundo, y los dedos
  // terminaron apuntando a cualquier lado. En la captura se veían palitos
  // blancos desparramados.
  //
  // La solución es no rotar pieza por pieza. Cada guante se arma DERECHO en el
  // origen, se fusiona, y recién entonces se gira y se mueve la malla ya
  // completa. Un solo giro sobre una sola malla no tiene ese problema.
  //
  // Y la forma es deliberadamente simple: cajas achatadas con las puntas
  // redondeadas. Un guante vacío sobre una mesa es una silueta plana, no un
  // volumen; lo que lo identifica es el contorno de mano y el puño de otro
  // color, no el detalle.
  const matCuero = material(scene, `matCueroGua_${id}`, new Color3(0.80, 0.67, 0.46), 0.92);
  const matPuno = material(scene, `matPunoGua_${id}`, new Color3(0.17, 0.33, 0.58), 0.92);
  const matCostura = material(scene, `matCostGua_${id}`, new Color3(0.44, 0.31, 0.17), 0.92);

  const GRUESO = cm(1.3);

  /** Construye un guante derecho, apuntando hacia -Z, con su centro en 0. */
  function armarGuante(sufijo: string): Mesh {
    const piezas: Mesh[] = [];
    const y = GRUESO / 2;

    // Palma.
    piezas.push(caja(scene, `palmaGua_${id}_${sufijo}`, cm(9.5), GRUESO, cm(11), 0, y, 0, matCuero));

    // Borde superior redondeado, de donde salen los dedos.
    const nudillos = cilindro(scene, `nudGua_${id}_${sufijo}`, GRUESO, cm(9.5), 0, y, -cm(5.5), matCuero, 10);
    nudillos.rotation.z = Math.PI / 2;
    piezas.push(nudillos);

    // Cuatro dedos rectos, sin abanico: paralelos se leen mejor que abiertos,
    // y evitan tener que rotar cada uno.
    const largos = [cm(5.6), cm(6.4), cm(6), cm(4.8)];
    largos.forEach((largo, i) => {
      const dx = (i - 1.5) * cm(2.4);
      const zCentro = -cm(5.5) - largo / 2;

      piezas.push(caja(scene, `dedoGua_${id}_${sufijo}_${i}`, cm(1.9), GRUESO * 0.85, largo, dx, y, zCentro, matCuero));

      // Punta redondeada: es lo que separa un dedo de un palito cortado.
      const punta = MeshBuilder.CreateSphere(`puntaGua_${id}_${sufijo}_${i}`, { diameter: cm(1.9), segments: 8 }, scene);
      punta.scaling.y = 0.7;
      punta.position.set(dx, y, zCentro - largo / 2);
      punta.material = matCuero;
      piezas.push(punta);
    });

    // Pulgar: caja corta al costado, apenas inclinada hacia afuera. Sin él,
    // cuatro dedos paralelos parecen un peine.
    const pulgar = caja(scene, `pulgarGua_${id}_${sufijo}`, cm(4.6), GRUESO * 0.85, cm(2), cm(6.4), y, -cm(2), matCuero);
    pulgar.rotation.y = 0.42;
    piezas.push(pulgar);

    const puntaPulgar = MeshBuilder.CreateSphere(`puntaPulGua_${id}_${sufijo}`, { diameter: cm(2), segments: 8 }, scene);
    puntaPulgar.scaling.y = 0.7;
    puntaPulgar.position.set(cm(8.5), y, -cm(2.9));
    puntaPulgar.material = matCuero;
    piezas.push(puntaPulgar);

    // Puño elástico azul: la señal más fuerte de "esto se calza".
    piezas.push(caja(scene, `punoGua_${id}_${sufijo}`, cm(9), cm(2.3), cm(4.4), 0, cm(1.15), cm(7.6), matPuno));

    const bordePuno = cilindro(scene, `bordePunoGua_${id}_${sufijo}`, cm(2.3), cm(9), 0, cm(1.15), cm(9.8), matPuno, 10);
    bordePuno.rotation.z = Math.PI / 2;
    piezas.push(bordePuno);

    // Dos costuras: rompen la superficie plana del cuero.
    piezas.push(caja(scene, `costLargaGua_${id}_${sufijo}`, cm(0.3), cm(0.18), cm(8.5), cm(3.2), GRUESO, -cm(1), matCostura));
    piezas.push(caja(scene, `costPunoGua_${id}_${sufijo}`, cm(9.2), cm(0.2), cm(0.3), 0, GRUESO, cm(5.3), matCostura));

    return fusionar(piezas, `guante_${id}_${sufijo}`);
  }

  // Cada guante ya fusionado se gira y se coloca. Un solo giro sobre una malla
  // completa se comporta como uno espera; encadenar giros pieza por pieza, no.
  const izquierdo = armarGuante("a");
  izquierdo.rotation.y = -0.32;
  izquierdo.position.set(-cm(5), 0, cm(1));

  const derecho = armarGuante("b");
  derecho.rotation.y = 2.6; // casi al revés: uno queda cruzado sobre el otro
  derecho.position.set(cm(5.5), cm(1.2), -cm(1));

  return fusionar([izquierdo, derecho], id);
}

// ---------------------------------------------------------------------------
// DESCARTAR — pieza de metal sin identificar
// ---------------------------------------------------------------------------

/**
 * El objeto más difícil del nivel, porque "chatarra" no tiene forma propia: se
 * reconoce por lo que le pasó, no por lo que es.
 *
 * Cuatro señales lo resuelven, y las cuatro tienen que ir juntas. Óxido, que
 * dice que lleva tiempo sin uso. Un corte irregular, que dice que se rompió y
 * no que se fabricó así. Perforaciones que no llevan a ninguna parte, que
 * impiden leerlo como una pieza con función. Y una deformación, porque una
 * pieza sana está derecha.
 *
 * IMPORTANTE: igual que los guantes, la versión anterior no fusionaba las
 * piezas y el objeto no se podía arrastrar.
 */
function crearChatarra(scene: Scene, id: string): Mesh {
  // "Chatarra" no tiene forma propia: se reconoce por lo que le PASÓ, no por
  // lo que es. Un rectángulo de metal puede ser una pieza nueva esperando
  // montaje o un resto para tirar, y de eso depende toda la decisión.
  //
  // La versión anterior era un cuerpo doblado con dientes en el borde, y a la
  // distancia de juego se leía como una simple barra. Cuatro señales lo
  // resuelven, y ninguna alcanza sola:
  //
  //   1. ÓXIDO PINTADO, con manchas de verdad y no un color plano marrón. Es
  //      lo que dice "lleva tiempo tirada" antes que cualquier otra cosa.
  //   2. UN QUIEBRE EN L, no un doblez suave: el metal se partió, no se plegó.
  //   3. UN EXTREMO DESGARRADO con dientes desparejos, frente a un corte
  //      limpio que indicaría fabricación.
  //   4. TORNILLERÍA SUELTA todavía puesta, comida de óxido: la pieza fue
  //      arrancada de algo, no fabricada así.
  const matOxido = materialPintado(scene, `matOxidoCha_${id}`, 512, 256, (ctx, w, h) => {
    // Base de metal gris: el óxido tiene que verse encima de algo, no ser el
    // material entero, o se lee como plástico marrón.
    ctx.fillStyle = "#6a6660";
    ctx.fillRect(0, 0, w, h);

    // Manchas de óxido en tres tonos, de la más extensa a la más oscura.
    const capas: [string, number, number][] = [
      ["rgba(150,84,32,0.75)", 42, 60],
      ["rgba(112,54,18,0.75)", 34, 40],
      ["rgba(70,30,8,0.7)", 22, 26],
    ];
    capas.forEach(([color, tamano, cuantas]) => {
      ctx.fillStyle = color;
      for (let i = 0; i < cuantas; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.beginPath();
        // Manchas irregulares: un círculo perfecto no se lee como corrosión.
        for (let p = 0; p < 9; p++) {
          const ang = (p / 9) * Math.PI * 2;
          const r = tamano * (0.45 + Math.random() * 0.55);
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r * 0.7;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    });

    // Picaduras: los puntos oscuros donde el óxido ya perforó la superficie.
    ctx.fillStyle = "rgba(25,12,4,0.8)";
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Restos de pintura industrial descascarada: dice que esto tuvo una
    // función y la perdió.
    ctx.fillStyle = "rgba(40,80,110,0.45)";
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillRect(x, y, 18 + Math.random() * 60, 10 + Math.random() * 26);
    }
  });
  matOxido.roughness = 0.95;
  matOxido.metallic = 0.3;

  const matOscuro = material(scene, `matOscuroCha_${id}`, new Color3(0.08, 0.06, 0.05), 0.96);
  const matTornillo = material(scene, `matTornCha_${id}`, new Color3(0.34, 0.20, 0.10), 0.9, 0.4);

  const partes: Mesh[] = [];

  // Tramo largo, apoyado y con una leve inclinación: nada tirado queda recto.
  const largo = caja(scene, `largoCha_${id}`, cm(17), cm(1.1), cm(5.5), 0, APOYO + cm(0.8), 0, matOxido);
  largo.rotation.y = 0.12;
  largo.rotation.z = 0.04;
  partes.push(largo);

  // Ala vertical: el quiebre en L. Es lo que separa una pletina de un perfil
  // roto, y da una silueta que se reconoce desde arriba.
  const ala = caja(scene, `alaCha_${id}`, cm(11), cm(4.5), cm(1.1), -cm(2), APOYO + cm(2.6), cm(2.6), matOxido);
  ala.rotation.y = 0.12;
  ala.rotation.x = -0.18;
  partes.push(ala);

  // Extremo desgarrado: dientes de largo y ángulo distintos. La irregularidad
  // es la señal — un corte parejo se leería como pieza fabricada.
  const dientes: [number, number, number][] = [
    [cm(2.6), cm(1.6), 0.3],
    [cm(1.4), cm(0.6), -0.5],
    [cm(3.2), cm(-0.5), 0.15],
    [cm(1.8), cm(-1.7), 0.6],
  ];
  dientes.forEach(([profundidad, z, giro], i) => {
    const diente = caja(scene, `dienteCha_${id}_${i}`, profundidad, cm(1.1), cm(1.3), cm(8.5) + profundidad / 2, APOYO + cm(0.8), z, matOxido);
    diente.rotation.y = 0.12 + giro;
    diente.rotation.z = 0.04 + (i % 2 ? 0.12 : -0.1);
    partes.push(diente);
  });

  // Perforaciones que no llevan a ninguna parte: impiden leerlo como una pieza
  // con función.
  [-cm(5.5), -cm(1), cm(3.5)].forEach((x, i) => {
    partes.push(cilindro(scene, `agujeroCha_${id}_${i}`, cm(1.6), cm(1.3), x, APOYO + cm(0.8), cm(0.5) * (i - 1), matOscuro, 12));
  });

  // Perno con su tuerca, todavía puesto y comido de óxido.
  partes.push(cilindro(scene, `pernoCha_${id}`, cm(1.6), cm(2.4), -cm(6.6), APOYO + cm(1.9), cm(1.4), matTornillo, 6));
  partes.push(cilindro(scene, `tuercaCha_${id}`, cm(2.6), cm(1), -cm(6.6), APOYO + cm(3.3), cm(1.4), matTornillo, 6));

  // Una arandela suelta al lado, caída: refuerza que la pieza fue arrancada.
  const arandela = MeshBuilder.CreateTorus(`arandelaCha_${id}`, { diameter: cm(2.6), thickness: cm(0.5), tessellation: 12 }, scene);
  arandela.position.set(cm(5.5), APOYO + cm(1.6), -cm(3.4));
  arandela.material = matTornillo;
  partes.push(arandela);

  // Escamas de óxido desprendidas alrededor: lo que se cae de una pieza así.
  for (let i = 0; i < 6; i++) {
    const escama = caja(scene, `escamaCha_${id}_${i}`,
      cm(0.8 + (i % 3) * 0.5), cm(0.18), cm(0.7 + ((i + 1) % 3) * 0.5),
      -cm(7) + i * cm(2.8), APOYO + cm(0.09), cm(3.6) * Math.sin(i * 2.1), matOscuro);
    escama.rotation.y = i * 0.7;
    partes.push(escama);
  }

  return fusionar(partes, id);
}