import { Scene, DynamicTexture, Texture, PBRMaterial, Color3 } from "@babylonjs/core";
import type { EscenaCamara } from "./SucesosCondominio";

// ===========================================================================
// Monitor de cámaras — las cuatro grabaciones del puesto
// ===========================================================================
//
// Antes esto era una imagen fija: cuatro recuadros con su rótulo, para que el
// monitor no se viera apagado. Ahora cada cuadrante muestra SU sitio del
// condominio —la reja, el estacionamiento, el pasillo, la bodega— y cuando
// ocurre un suceso, ese sitio es donde se ve ocurrir.
//
// ─── POR QUÉ NO SE VEÍA NADA ──────────────────────────────────────────────
//
// La pantalla tiene una luz azul propia a catorce centímetros por delante,
// que es la que tiñe el mesón y da el ambiente de la escena. Con el material
// anterior —casi espejo, roughness 0.22— esa luz se reflejaba en su propio
// monitor y lo tapaba entero con una mancha blanca. Daba igual lo que se
// dibujara debajo.
//
// Por eso el material va `unlit`: la pantalla no la ilumina nada, se muestra
// tal cual está dibujada. Que es, además, como funciona un monitor de verdad
// —emite su luz, no la recibe— y significa que lo que se dibuja acá es
// exactamente lo que se ve, sin que las luces de la sala lo laven.
//
// ─── EL MONITOR COMPLEMENTA, NO REEMPLAZA ─────────────────────────────────
//
// Todo lo que se ve acá está también escrito en el `aviso` del suceso. Quien
// mire la pantalla lo va a ver ocurrir; quien no, se entera igual al abrir el
// libro. Es deliberado: si mirar el monitor fuera obligatorio, perderse una
// camioneta por estar escribiendo sería una falta que el jugador no tuvo cómo
// evitar, y el libro dejaría de bastarse solo — que es justamente lo que el
// manual pide que sepa hacer un guardia.
//
// ─── CUÁNDO SE ENCIENDE Y CUÁNDO SE APAGA ─────────────────────────────────
//
// No hay temporizador. La cámara se enciende cuando el suceso ocurre y se
// apaga cuando la novedad queda escrita en el libro. O sea: el monitor
// muestra lo que está PENDIENTE. Es la mejor versión de la regla, porque
// convierte la pantalla en un recordatorio de lo que falta anotar en vez de
// en un adorno que se apaga solo a los diez segundos.

/** Rótulo de cada cuadrante, en el orden en que se dibujan. */
const ROTULOS = [
  "CAM 01  ACCESO",
  "CAM 02  ESTACIONAMIENTO",
  "CAM 03  PASILLO",
  "CAM 04  BODEGA",
];

const ANCHO_BASE = 640;
const ALTO_BASE = 400;

/**
 * Densidad de la textura. El dibujo no se entera: se escala el contexto.
 *
 * Tres, no dos. El monitor es el único sitio del juego donde el jugador se
 * ACERCA a mirar —la rueda del mouse baja el campo de visión hasta un tercio—
 * y con densidad doble, a ese acercamiento, se veían los píxeles del lienzo.
 * Con tres el cuadrante se dibuja sobre 948 × 588 píxeles reales, que aguanta
 * el zoom completo sin que se note el escalón.
 */
const FACTOR = 3;

/**
 * Cada cuánto se repinta, en milisegundos.
 *
 * Unas cinco imágenes por segundo, y por dos razones que apuntan al mismo
 * lado. La primera es costo: repintar un lienzo de 1280 × 800 en cada
 * fotograma es subir cuatro megas de textura sesenta veces por segundo para
 * mover una camioneta. La segunda es que se ve MEJOR así — un multiplexor de
 * CCTV real reparte los cuadros entre sus cámaras y entrega cinco o seis por
 * canal, y ese tirón es la firma de una grabación de seguridad.
 */
const MS_POR_CUADRO = 190;

/** Cuánto tarda una escena en llegar a su pose final, en segundos reales. */
const ENTRADA = 3.2;

/** Ancho y alto de un cuadrante, en las coordenadas en que se dibuja. */
const CW = ANCHO_BASE / 2;
const CH = ALTO_BASE / 2;
const QW = CW - 4;
const QH = CH - 4;

interface TomaActiva {
  indice: number;
  escena: EscenaCamara;
  /** Segundo real en que se encendió. Manda la animación de entrada. */
  desde: number;
  /** Minuto del turno en que ocurrió. Rotula la toma cuando hay más de una. */
  minuto: number;
}

/** Un minuto del turno como hh:mm. El turno arranca a las 00:00. */
function horaDeMinuto(minuto: number): string {
  const h = Math.floor(minuto / 60) % 24;
  const m = Math.floor(minuto) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Cada cuántos segundos rota el cuadrante que tiene más de una toma. */
const CICLO_MULTIPLEXOR = 4.5;

export interface MonitorCamaras {
  material: PBRMaterial;
  /**
   * Enciende la toma de un suceso. Se queda en pantalla hasta `apagar`.
   *
   * Se identifica por el id del suceso y no por el cuadrante porque el ingreso
   * y la salida comparten la CAM 01: si la salida llegara con el ingreso aún
   * sin anotar, apagar "la cámara 1" apagaría la toma equivocada.
   */
  encender(id: string, indice: number, escena: EscenaCamara, minuto: number): void;
  /** Apaga la toma de ese suceso. Se llama cuando la novedad queda escrita. */
  apagar(id: string): void;
  /**
   * Pone las cámaras en hora con el turno.
   *
   * Antes cada cuadrante llevaba su propia cuenta desde que se encendía, así
   * que dos cámaras encendidas a distinta hora marcaban horas distintas. Ahora
   * la hora la manda el reloj del turno, que es lo correcto: un CCTV tiene un
   * solo reloj. Y de paso, estando en el puesto con el libro cerrado, esa
   * marca es el ÚNICO sitio donde el jugador puede ver qué hora es.
   */
  ajustarHora(minuto: number): void;
}

export function crearMonitorCamaras(scene: Scene): MonitorCamaras {
  const activas = new Map<string, TomaActiva>();

  /** Segundos reales desde que arrancó. Manda parpadeos, ruido y entradas. */
  let segundos = 0;
  let msAcumulados = MS_POR_CUADRO;

  /** Hora del turno que marcan las cámaras, en minutos. */
  let minutoBase = 0;
  let segundosEnBase = 0;

  const textura = new DynamicTexture(
    "tex_matPantallaCCTV",
    { width: ANCHO_BASE * FACTOR, height: ALTO_BASE * FACTOR },
    scene,
    true
  );
  textura.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  textura.anisotropicFilteringLevel = 16;

  function repintar(): void {
    const ctx = textura.getContext() as unknown as CanvasRenderingContext2D;

    ctx.save();
    ctx.scale(FACTOR, FACTOR);

    // Marco entre cuadrantes: es el bisel del multiplexor, no una pared.
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, ANCHO_BASE, ALTO_BASE);

    for (let i = 0; i < 4; i++) {
      // DOS TOMAS EN LA MISMA CÁMARA SE TURNAN, no se pisan.
      //
      // El ingreso y la salida ocurren los dos en la reja, así que comparten
      // la CAM 01. Antes ganaba la última encendida: si la salida llegaba con
      // el ingreso todavía sin anotar, la toma del ingreso desaparecía de la
      // pantalla aunque siguiera pendiente, y el jugador se quedaba con una
      // fila en el libro que ya no podía comprobar en ningún sitio.
      //
      // Ahora el cuadrante las rota, que es justo lo que hace un multiplexor
      // de verdad cuando tiene más señales que ventanas. Se ordenan por hora
      // para que el turno se vea en el orden en que pasó.
      const enEstaCamara = [...activas.values()]
        .filter((t) => t.indice === i)
        .sort((a, b) => a.minuto - b.minuto);

      const cual =
        enEstaCamara.length > 1
          ? Math.floor(segundos / CICLO_MULTIPLEXOR) % enEstaCamara.length
          : 0;
      const toma: TomaActiva | undefined = enEstaCamara[cual];

      ctx.save();
      ctx.translate((i % 2) * CW + 2, Math.floor(i / 2) * CH + 2);
      ctx.beginPath();
      ctx.rect(0, 0, QW, QH);
      ctx.clip();

      dibujarLugar(ctx, i);
      if (toma) {
        const avance = Math.min(1, (segundos - toma.desde) / ENTRADA);
        dibujarEvento(ctx, toma.escena, avance, segundos);
      }
      dibujarSenal(ctx, i, toma, cual, enEstaCamara.length);

      ctx.restore();
    }

    ctx.restore();
    textura.update();
  }

  repintar();

  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime();
    segundos += dt / 1000;
    segundosEnBase += dt / 1000;
    msAcumulados += dt;
    if (msAcumulados < MS_POR_CUADRO) return;
    msAcumulados = 0;
    repintar();
  });

  scene.onDisposeObservable.addOnce(() => {
    scene.onBeforeRenderObservable.remove(observador);
  });

  // El material de la pantalla, que es lo que decide si esto se ve o no.
  //
  // No basta con marcarlo `unlit`: hay que dejar explícitamente en cero cada
  // vía por la que la luz puede llegar al cristal, porque son cuatro y basta
  // con que quede una abierta para que vuelva la mancha blanca.
  //
  //   albedoColor negro   → las luces no tienen color que iluminar
  //   disableLighting     → ninguna luz de la sala aporta
  //   environmentIntensity → ni la sonda de reflejos de la escena
  //   roughness 1         → sin brillo especular que devuelva la luminaria
  //
  // Lo único que queda en pie es el emisivo, o sea el lienzo de arriba. Un
  // monitor emite su luz y no la recibe, así que además de funcionar es lo
  // que corresponde.
  const material = new PBRMaterial("matPantallaCCTV", scene);
  material.albedoColor = new Color3(0, 0, 0);
  material.emissiveTexture = textura;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.environmentIntensity = 0;
  material.metallic = 0;
  material.roughness = 1;

  // Y esta línea es la que hace que la pantalla EXISTA en pantalla.
  //
  // El plano lleva `rotation.y = Math.PI`, así que su normal apunta en
  // dirección contraria a la cámara del guardia. Con el descarte de caras
  // traseras activado —que es el valor por defecto— el plano sencillamente no
  // se dibuja, y lo que se ve en su lugar es la carcasa de detrás con la luz
  // azul del propio monitor reflejada encima. Esa era la mancha.
  //
  // El resto de superficies pintadas de la escena (las hojas del libro, la
  // tarjeta de claves) no tenían el problema porque vienen de materialPintado,
  // que ya lo desactiva. Esta se construye a mano y hay que decírselo.
  //
  // Se ve la cara trasera, o sea el lienzo espejado, y por eso la constante
  // ORIENTACION_PANTALLA lleva el horizontal en -1: ya estaba compensado.
  material.backFaceCulling = false;

  /** La marca de hora, como la escribiría una cámara: hh:mm:ss. */
  function marcaDeHora(): string {
    // Hora y minuto los manda el reloj del TURNO; los segundos corren en tiempo
    // real. Suena contradictorio y es a propósito: el turno va comprimido, así
    // que un minuto de servicio dura una fracción de segundo real. Sacando los
    // segundos del mismo sitio, el contador se quedaría clavado en 00 y la
    // marca parecería rota. Nadie cuadra los segundos de un CCTV contra su
    // minutero; lo que sí se nota es un reloj que no se mueve.
    const total = Math.max(0, minutoBase);
    const h = Math.floor(total / 60) % 24;
    const m = Math.floor(total) % 60;
    const s = Math.floor(segundos) % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function dibujarSenal(
    ctx: CanvasRenderingContext2D,
    indice: number,
    toma: TomaActiva | undefined,
    cual: number,
    cuantas: number
  ): void {
    const activa = toma !== undefined;
    // Líneas de barrido. El paso va en coordenadas de dibujo, así que con la
    // densidad al triple salen tres píxeles reales por línea en vez de dos:
    // más finas y más juntas, que es como se ven de verdad al acercarse.
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let y = 0; y < QH; y += 2.5) ctx.fillRect(0, y, QW, 0.9);

    // Grano. Se resiembra en cada cuadro: eso es lo que lo hace parecer ruido
    // de sensor y no suciedad pintada en la textura.
    //
    // Va en dos tamaños. Los puntos finos son el ruido propiamente dicho; los
    // gruesos y más tenues son la compresión, que es lo que de verdad delata
    // una grabación de CCTV. Con un solo tamaño el ruido se veía uniforme, y
    // el ruido uniforme parece textura, no señal.
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let n = 0; n < 52; n++) {
      ctx.fillRect(Math.random() * QW, Math.random() * QH, 0.8, 0.8);
    }
    ctx.fillStyle = "rgba(190,205,225,0.04)";
    for (let n = 0; n < 14; n++) {
      ctx.fillRect(Math.random() * QW, Math.random() * QH, 3, 3);
    }

    // Viñeta: ninguna óptica barata ilumina bien las esquinas.
    const vineta = ctx.createRadialGradient(QW / 2, QH / 2, QH * 0.3, QW / 2, QH / 2, QH * 0.9);
    vineta.addColorStop(0, "rgba(0,0,0,0)");
    vineta.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vineta;
    ctx.fillRect(0, 0, QW, QH);

    ctx.strokeStyle = activa ? "#8a5a1c" : "#1c242c";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, QW, QH);

    const color = activa ? "#ffc94d" : "#7cf0a4";

    // Banda oscura bajo los textos. Sin ella el rótulo se pierde justo cuando
    // el sitio de esa cámara tiene una zona clara detrás.
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, QW, 30);
    ctx.fillRect(0, QH - 26, QW, 26);

    ctx.fillStyle = color;
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "left";
    ctx.fillText(ROTULOS[indice], 12, 21);

    ctx.textAlign = "right";
    ctx.fillText(marcaDeHora(), QW - 12, QH - 8);

    // Con más de una toma pendiente se dice cuál se está viendo y cuántas
    // hay. Sin esto la cámara cambiaría sola cada pocos segundos y parecería
    // un fallo en vez de un reparto; y el jugador no tendría forma de saber
    // que le falta anotar dos cosas del mismo sitio.
    if (toma && cuantas > 1) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`${horaDeMinuto(toma.minuto)}  ${cual + 1}/${cuantas}`, 12, QH - 8);
    }

    // Testigo de grabación. Parpadea solo donde hay algo ocurriendo, así el
    // cuadrante que importa se distingue de un vistazo.
    if (activa && Math.floor(segundos * 1.6) % 2 === 0) {
      ctx.fillStyle = "#ff5252";
      ctx.beginPath();
      ctx.arc(QW - 17, 15, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "right";
      ctx.fillText("REC", QW - 27, 20);
    }
  }

  return {
    material,
    ajustarHora(minuto) {
      minutoBase = minuto;
    },
    encender(id, indice, escena, minuto) {
      minutoBase = minuto;
      segundosEnBase = 0;
      activas.set(id, { indice, escena, desde: segundos, minuto });
      // Sin esto el cuadrante tarda hasta un quinto de segundo en encenderse.
      // Se nota cuando el suceso llega con el monitor a la vista.
      repintar();
    },
    apagar(id) {
      if (!activas.delete(id)) return;
      repintar();
    },
  };
}

// ---------------------------------------------------------------------------
// Los cuatro sitios
// ---------------------------------------------------------------------------
//
// Cada cámara dibuja SIEMPRE su sitio, haya suceso o no. Es lo que hace que el
// monitor se lea como cuatro puntos del condominio y no como cuatro recuadros
// apagados esperando: la reja está ahí desde el minuto cero, y cuando llega la
// camioneta llega A la reja.
//
// La paleta va deliberadamente alta para lo que es una escena nocturna. No se
// está pintando la noche, se está pintando un MONITOR que muestra la noche, y
// esa pantalla se mira desde metro y medio en una sala a oscuras.

function dibujarLugar(ctx: CanvasRenderingContext2D, indice: number): void {
  ctx.fillStyle = "#141a21";
  ctx.fillRect(0, 0, QW, QH);

  if (indice === 0) dibujarAcceso(ctx);
  else if (indice === 1) dibujarEstacionamiento(ctx);
  else if (indice === 2) dibujarPasillo(ctx);
  else dibujarBodega(ctx);
}

/** CAM 01 — la reja principal, mirando hacia la calle. */
function dibujarAcceso(ctx: CanvasRenderingContext2D): void {
  const horizonte = QH * 0.44;

  const fondo = ctx.createLinearGradient(0, 0, 0, horizonte);
  fondo.addColorStop(0, "#151b23");
  fondo.addColorStop(1, "#28313c");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, QW, horizonte);

  // Vereda: la franja clara que separa la calle del antejardín.
  ctx.fillStyle = "#3a4450";
  ctx.fillRect(0, horizonte, QW, QH * 0.05);

  const suelo = ctx.createLinearGradient(0, horizonte, 0, QH);
  suelo.addColorStop(0, "#2c343e");
  suelo.addColorStop(1, "#181e25");
  ctx.fillStyle = suelo;
  ctx.fillRect(0, horizonte + QH * 0.05, QW, QH);

  // La reja, corrida a la derecha.
  ctx.strokeStyle = "#5c6875";
  ctx.lineWidth = 2;
  for (let x = QW * 0.54; x < QW * 0.99; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, horizonte - QH * 0.2);
    ctx.lineTo(x, horizonte + QH * 0.14);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(QW * 0.54, horizonte - QH * 0.2);
  ctx.lineTo(QW * 0.99, horizonte - QH * 0.2);
  ctx.stroke();

  // Pilar con su luminaria encendida.
  ctx.fillStyle = "#4a545f";
  ctx.fillRect(QW * 0.48, horizonte - QH * 0.3, 11, QH * 0.44);
  ctx.fillStyle = "#fff0c8";
  ctx.beginPath();
  ctx.arc(QW * 0.48 + 5, horizonte - QH * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();

  // El charco de luz de esa luminaria sobre el pavimento.
  const charco = ctx.createRadialGradient(
    QW * 0.48, horizonte + QH * 0.3, 2,
    QW * 0.48, horizonte + QH * 0.3, QW * 0.34
  );
  charco.addColorStop(0, "rgba(255, 235, 190, 0.16)");
  charco.addColorStop(1, "rgba(255, 235, 190, 0)");
  ctx.fillStyle = charco;
  ctx.fillRect(0, horizonte, QW, QH);
}

/** CAM 02 — el estacionamiento de visitas, con sus bahías demarcadas. */
function dibujarEstacionamiento(ctx: CanvasRenderingContext2D): void {
  const horizonte = QH * 0.32;

  // Muro del fondo con su zócalo.
  ctx.fillStyle = "#333c47";
  ctx.fillRect(0, 0, QW, horizonte);
  ctx.fillStyle = "#1d242c";
  ctx.fillRect(0, horizonte - 5, QW, 5);

  const suelo = ctx.createLinearGradient(0, horizonte, 0, QH);
  suelo.addColorStop(0, "#2f3841");
  suelo.addColorStop(1, "#161c23");
  ctx.fillStyle = suelo;
  ctx.fillRect(0, horizonte, QW, QH - horizonte);

  // Demarcación de las bahías. Convergen levemente hacia el fondo: es lo que
  // da profundidad sin tener que dibujar perspectiva de verdad.
  ctx.strokeStyle = "rgba(226, 230, 214, 0.34)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(QW * (0.14 + i * 0.26), horizonte + 3);
    ctx.lineTo(QW * (0.03 + i * 0.33), QH);
    ctx.stroke();
  }

  // Luminaria del cielo y su charco, que es lo que hace que el suelo no sea
  // una superficie plana y muerta.
  const charco = ctx.createRadialGradient(
    QW * 0.62, horizonte + QH * 0.2, 4,
    QW * 0.62, horizonte + QH * 0.2, QW * 0.42
  );
  charco.addColorStop(0, "rgba(214, 230, 255, 0.13)");
  charco.addColorStop(1, "rgba(214, 230, 255, 0)");
  ctx.fillStyle = charco;
  ctx.fillRect(0, horizonte, QW, QH);

  // Pilar estructural pegado al borde izquierdo.
  ctx.fillStyle = "#3d4650";
  ctx.fillRect(0, horizonte - QH * 0.22, 15, QH);
}

/** CAM 03 — el pasillo del segundo piso de la torre A, en fuga al fondo. */
function dibujarPasillo(ctx: CanvasRenderingContext2D): void {
  const fx = QW * 0.53;
  const fy = QH * 0.47;
  const fw = QW * 0.17;
  const fh = QH * 0.32;

  ctx.fillStyle = "#12181e";
  ctx.fillRect(0, 0, QW, QH);

  // Piso: trapecio del borde inferior al fondo. Con esto solo ya se lee como
  // un pasillo; el resto son las paredes que lo cierran.
  ctx.fillStyle = "#2b333d";
  ctx.beginPath();
  ctx.moveTo(0, QH);
  ctx.lineTo(QW, QH);
  ctx.lineTo(fx + fw / 2, fy + fh / 2);
  ctx.lineTo(fx - fw / 2, fy + fh / 2);
  ctx.closePath();
  ctx.fill();

  // Paredes laterales, la de la derecha algo más apagada para que el volumen
  // se lea sin tener que iluminar nada.
  ctx.fillStyle = "#242c35";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(fx - fw / 2, fy - fh / 2);
  ctx.lineTo(fx - fw / 2, fy + fh / 2);
  ctx.lineTo(0, QH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1b222a";
  ctx.beginPath();
  ctx.moveTo(QW, 0);
  ctx.lineTo(fx + fw / 2, fy - fh / 2);
  ctx.lineTo(fx + fw / 2, fy + fh / 2);
  ctx.lineTo(QW, QH);
  ctx.closePath();
  ctx.fill();

  // Muro del fondo.
  ctx.fillStyle = "#323b46";
  ctx.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);

  // Puertas de los departamentos sobre la pared izquierda, encogiendo hacia
  // el fondo.
  ctx.fillStyle = "#161c23";
  [0.08, 0.3, 0.5].forEach((t) => {
    const alto = QH * (0.6 - t * 0.46);
    ctx.fillRect(
      t * (fx - fw / 2),
      QH * 0.52 - alto / 2,
      QW * (0.085 - t * 0.05),
      alto
    );
  });
}

/**
 * CAM 04 — la bodega.
 *
 * Mira desde el fondo hacia la puerta, no al revés. Es la orientación que tiene
 * sentido en una bodega vigilada: lo que importa es quién entra, así que la
 * cámara se cuelga en la pared del fondo apuntando a la única abertura.
 *
 * Y es también lo que permite que el suceso del candado se LEA. Con la cámara
 * mirando a los estantes, una puerta entornada a la espalda no se vería.
 */
function dibujarBodega(ctx: CanvasRenderingContext2D): void {
  const suelo = QH * 0.62;

  // Muro del fondo: hormigón, más claro arriba porque es donde pega el tubo.
  const pared = ctx.createLinearGradient(0, 0, 0, suelo);
  pared.addColorStop(0, "#3a4450");
  pared.addColorStop(1, "#242c35");
  ctx.fillStyle = pared;
  ctx.fillRect(0, 0, QW, suelo);

  // Juntas del bloque de hormigón. Dos líneas bastan para dar la escala del
  // muro; más convierten la pared en un dibujo de ladrillos.
  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  ctx.lineWidth = 1;
  [0.2, 0.42].forEach((t) => {
    ctx.beginPath();
    ctx.moveTo(0, suelo * t);
    ctx.lineTo(QW, suelo * t);
    ctx.stroke();
  });

  // Radier: liso, con su junta de dilatación en fuga y algo más oscuro al
  // fondo. La fuga es lo que separa un suelo de una franja de color.
  const radier = ctx.createLinearGradient(0, suelo, 0, QH);
  radier.addColorStop(0, "#2a323b");
  radier.addColorStop(1, "#434d59");
  ctx.fillStyle = radier;
  ctx.fillRect(0, suelo, QW, QH - suelo);
  ctx.fillStyle = "#1a212a";
  ctx.fillRect(0, suelo - 2, QW, 3);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.5;
  [[0.34, 0.12], [0.72, 0.95]].forEach(([arriba, abajo]) => {
    ctx.beginPath();
    ctx.moveTo(QW * arriba, suelo);
    ctx.lineTo(QW * abajo, QH);
    ctx.stroke();
  });

  // --- Estantería de la izquierda, en fuga ---------------------------------
  //
  // Los montantes se acortan y se juntan hacia el fondo. Con eso solo, una
  // estantería plana pasa a tener profundidad sin dibujar una sola diagonal
  // más de las imprescindibles.
  const montantes = [
    { x: 0.02, alto: 0.52, y: 0.1 },
    { x: 0.17, alto: 0.44, y: 0.16 },
    { x: 0.29, alto: 0.38, y: 0.2 },
  ];
  ctx.fillStyle = "#4a5561";
  montantes.forEach((m) => ctx.fillRect(QW * m.x, QH * m.y, 5, QH * m.alto));

  // Baldas y su carga.
  [0.3, 0.45].forEach((fila, nivel) => {
    ctx.fillStyle = "#525d6a";
    ctx.beginPath();
    ctx.moveTo(QW * 0.02, QH * (fila + 0.06));
    ctx.lineTo(QW * 0.31, QH * fila);
    ctx.lineTo(QW * 0.31, QH * fila + 4);
    ctx.lineTo(QW * 0.02, QH * (fila + 0.06) + 5);
    ctx.closePath();
    ctx.fill();

    const cajas: [number, number, string][] = nivel === 0
      ? [[0.04, 0.1, "#6b7ембр".length ? "#6b7480" : "#6b7480"], [0.16, 0.08, "#57616d"], [0.25, 0.055, "#727c88"]]
      : [[0.05, 0.09, "#5d6773"], [0.15, 0.07, "#6e7884"], [0.23, 0.065, "#525c68"]];
    cajas.forEach(([x, ancho, color], i) => {
      const escala = 1 - x * 0.5;
      const alto = QH * 0.09 * escala;
      const py = QH * (fila + 0.055 - x * 0.19) - alto;
      ctx.fillStyle = color;
      ctx.fillRect(QW * x, py, QW * ancho, alto);
      // Tapa y cinta: dos trazos que convierten un rectángulo en una caja.
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      ctx.fillRect(QW * x, py, QW * ancho, 2.5);
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.fillRect(QW * x + QW * ancho * 0.45, py, 2, alto);
      // Etiqueta pegada, solo en las de delante: al fondo sería un punto.
      if (i === 0) {
        ctx.fillStyle = "rgba(232,236,228,0.5)";
        ctx.fillRect(QW * x + 3, py + alto * 0.4, QW * ancho * 0.42, alto * 0.28);
      }
    });
  });

  // --- La puerta, a la derecha ---------------------------------------------
  //
  // Cerrada por defecto: hoja de acero en su marco, con la argolla y el candado
  // enganchado. Es la pieza que el suceso del candado modifica, así que se
  // dibuja completa aunque no esté pasando nada — si solo apareciera cuando
  // ocurre algo, el cambio no se leería como un cambio.
  const px = QW * 0.62;
  const pw = QW * 0.3;
  const py = QH * 0.14;
  const ph = suelo - py;

  ctx.fillStyle = "#39424d";
  ctx.fillRect(px - 5, py - 5, pw + 10, ph + 5);
  const hoja = ctx.createLinearGradient(px, 0, px + pw, 0);
  hoja.addColorStop(0, "#5a6470");
  hoja.addColorStop(0.6, "#4a535f");
  hoja.addColorStop(1, "#3d4650");
  ctx.fillStyle = hoja;
  ctx.fillRect(px, py, pw, ph);

  // Refuerzos horizontales de la hoja.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  [0.28, 0.64].forEach((t) => ctx.fillRect(px, py + ph * t, pw, 3));

  // Argolla y candado cerrado: el arco baja y cierra sobre la hembrilla.
  ctx.fillStyle = "#2c343d";
  ctx.fillRect(px - 3, py + ph * 0.46, 12, 16);
  candado(ctx, px + 2, py + ph * 0.5, false);

  // --- Techo y equipamiento -------------------------------------------------
  // Tubo fluorescente encendido, con su chorro sobre el radier.
  ctx.fillStyle = "#2f3842";
  ctx.fillRect(QW * 0.24, QH * 0.03, QW * 0.34, 7);
  ctx.fillStyle = "rgba(226, 240, 255, 0.8)";
  ctx.fillRect(QW * 0.25, QH * 0.03 + 2, QW * 0.32, 3.5);
  const chorro = ctx.createRadialGradient(
    QW * 0.41, QH * 0.55, 4,
    QW * 0.41, QH * 0.55, QW * 0.5
  );
  chorro.addColorStop(0, "rgba(214, 232, 255, 0.11)");
  chorro.addColorStop(1, "rgba(214, 232, 255, 0)");
  ctx.fillStyle = chorro;
  ctx.fillRect(0, 0, QW, QH);

  // Extintor colgado: lo pide el manual en cada recinto, y una mancha roja en
  // una escena de grises la ancla como sitio real.
  ctx.fillStyle = "#8f2b22";
  ctx.fillRect(QW * 0.5, QH * 0.3, 9, QH * 0.16);
  ctx.fillStyle = "#b8382c";
  ctx.fillRect(QW * 0.5, QH * 0.3, 4, QH * 0.16);
  ctx.fillStyle = "#2a323b";
  ctx.fillRect(QW * 0.5 + 1, QH * 0.27, 7, QH * 0.035);

  // Pallet con carga envuelta, en el suelo.
  ctx.fillStyle = "#4a4034";
  ctx.fillRect(QW * 0.08, QH * 0.78, QW * 0.26, QH * 0.05);
  ctx.fillStyle = "#2f281f";
  for (let i = 0; i < 4; i++) ctx.fillRect(QW * (0.1 + i * 0.065), QH * 0.83, 5, QH * 0.05);
  ctx.fillStyle = "rgba(180, 196, 210, 0.32)";
  ctx.fillRect(QW * 0.1, QH * 0.66, QW * 0.22, QH * 0.12);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(QW * 0.1, QH * 0.66, QW * 0.22, 3);
}

/**
 * Un candado colgando de su argolla.
 *
 * `abierto` levanta el arco y lo saca de la hembrilla. Es un detalle de seis
 * píxeles, pero es LA diferencia que el jugador tiene que ver para escribir la
 * constancia correcta, así que se dibuja con el arco completo en las dos
 * posiciones en vez de sugerirlo con un color.
 */
function candado(ctx: CanvasRenderingContext2D, x: number, y: number, abierto: boolean): void {
  const cuerpoAlto = 11;
  const cuerpoAncho = 9;

  ctx.strokeStyle = "#aab4c0";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (abierto) {
    // Arco girado sobre su eje: sale de la hembrilla y queda ladeado.
    ctx.arc(x + cuerpoAncho * 0.9, y - 1, 4.6, Math.PI * 0.9, Math.PI * 2.05);
  } else {
    ctx.arc(x + cuerpoAncho / 2, y, 4.2, Math.PI, 0);
  }
  ctx.stroke();

  const cuerpo = ctx.createLinearGradient(x, y, x + cuerpoAncho, y);
  cuerpo.addColorStop(0, "#8e99a6");
  cuerpo.addColorStop(1, "#5f6874");
  ctx.fillStyle = cuerpo;
  ctx.fillRect(x, y, cuerpoAncho, cuerpoAlto);
  ctx.fillStyle = "#2b333c";
  ctx.fillRect(x + cuerpoAncho / 2 - 1, y + cuerpoAlto * 0.55, 2, 3);
}

// ---------------------------------------------------------------------------
// Lo que ocurre encima
// ---------------------------------------------------------------------------
//
// `avance` va de 0 a 1 durante los primeros segundos y después se queda en 1.
// Eso hace dos cosas a la vez: quien esté mirando el monitor VE llegar la
// camioneta, y quien llegue tarde encuentra la escena en su pose final, que
// sigue describiendo el hecho. Nada desaparece por haber tardado.

function dibujarEvento(
  ctx: CanvasRenderingContext2D,
  escena: EscenaCamara,
  avance: number,
  segundos: number
): void {
  if (escena === "vehiculo-en-reja") vehiculoEnReja(ctx, avance);
  else if (escena === "vehiculo-saliendo") vehiculoSaliendo(ctx, avance);
  else if (escena === "vehiculo-detenido") vehiculoDetenido(ctx, segundos);
  else if (escena === "pasillo-abierto") pasilloAbierto(ctx, avance);
  else if (escena === "bodega-abierta") bodegaAbierta(ctx, avance);
}

/** Suavizado de entrada. Un vehículo que frena no lo hace linealmente. */
function suave(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * La camioneta, de perfil.
 *
 * ─── POR QUÉ VALE LA PENA DIBUJARLA BIEN ──────────────────────────────────
 *
 * Antes eran cinco rectángulos: un bloque para el cuerpo, otro para la
 * cabina, uno para el parabrisas y dos para las ruedas. De lejos pasaba, pero
 * el monitor es justo el sitio donde el jugador se acerca a mirar, y de cerca
 * se leía como un icono de aplicación, no como un vehículo grabado por una
 * cámara.
 *
 * Lo que la vuelve reconocible no son los detalles chicos, son cuatro cosas:
 * el hueco de los arcos de rueda —un auto no apoya la carrocería en el
 * suelo—, la caída del techo hacia atrás, el brillo horizontal a la altura de
 * las manillas, y la sombra de contacto debajo. Sin esa sombra el vehículo
 * flota, y flotando no hay dibujo que lo salve.
 *
 * ─── SE DIBUJA SIEMPRE MIRANDO A LA IZQUIERDA ─────────────────────────────
 *
 * Y si tiene que mirar al otro lado, se espeja el lienzo entero. Es la única
 * forma de no tener que escribir cada coordenada dos veces, y de que las dos
 * versiones sean de verdad el mismo vehículo — que importa, porque el juego
 * pide reconocer que la camioneta que sale a las 01:30 es la que entró a la
 * 01:00.
 *
 * @param x       Borde izquierdo del vehículo.
 * @param y       Línea de cintura: donde la chapa se junta con las ventanas.
 * @param ancho   Largo total.
 * @param alto    Alto del faldón, de la cintura al bajo de la carrocería.
 * @param color   Color de la chapa.
 * @param haciaLaIzquierda  Hacia dónde apunta el morro.
 */
function carroceria(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  color: string,
  haciaLaIzquierda = true
): void {
  const L = ancho;
  const H = alto;
  const suelo = y + H * 1.42;
  const techo = y - H * 0.98;
  const radioRueda = H * 0.62;

  ctx.save();
  if (haciaLaIzquierda) {
    ctx.translate(x, 0);
  } else {
    ctx.translate(x + L, 0);
    ctx.scale(-1, 1);
  }

  // --- Sombra de contacto ---------------------------------------------------
  //
  // Va antes que nada, para que todo lo demás caiga encima. Es más ancha que
  // el vehículo y muy aplastada: la luz de las luminarias viene de arriba.
  const sombra = ctx.createRadialGradient(L * 0.5, suelo, 2, L * 0.5, suelo, L * 0.56);
  sombra.addColorStop(0, "rgba(0,0,0,0.55)");
  sombra.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(0, suelo);
  ctx.scale(1, 0.22);
  ctx.translate(0, -suelo);
  ctx.fillStyle = sombra;
  ctx.beginPath();
  ctx.arc(L * 0.5, suelo, L * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Ruedas ---------------------------------------------------------------
  //
  // Antes que la carrocería: así el faldón les recorta la mitad de arriba y
  // quedan metidas en su arco en vez de pegadas por fuera.
  const ejes = [L * 0.21, L * 0.79];
  ejes.forEach((ex) => {
    ctx.fillStyle = "#080a0d";
    ctx.beginPath();
    ctx.arc(ex, suelo - radioRueda * 0.86, radioRueda, 0, Math.PI * 2);
    ctx.fill();
    // Llanta: un disco más claro y bastante más chico. A esta escala no hay
    // radios que dibujar, solo el contraste que dice que la rueda gira.
    ctx.fillStyle = "#39434e";
    ctx.beginPath();
    ctx.arc(ex, suelo - radioRueda * 0.86, radioRueda * 0.42, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- Faldón: el cuerpo bajo, de morro a portalón --------------------------
  //
  // No es un rectángulo. El morro cae y se adelanta abajo (el paragolpes), y
  // detrás la caja de carga termina recta. Entre medio, los dos arcos.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(L * 0.02, y + H * 0.28);
  ctx.quadraticCurveTo(0, y + H * 0.62, L * 0.015, y + H);
  ctx.lineTo(L * 0.05, y + H * 1.12);
  // Arco delantero.
  ctx.lineTo(ejes[0] - radioRueda * 1.05, y + H * 1.12);
  ctx.arc(ejes[0], y + H * 1.12, radioRueda * 1.05, Math.PI, 0, true);
  ctx.lineTo(ejes[1] - radioRueda * 1.05, y + H * 1.12);
  // Arco trasero.
  ctx.arc(ejes[1], y + H * 1.12, radioRueda * 1.05, Math.PI, 0, true);
  ctx.lineTo(L * 0.985, y + H * 1.12);
  ctx.lineTo(L, y + H * 0.1);
  ctx.lineTo(L * 0.02, y);
  ctx.closePath();
  ctx.fill();

  // Sombra bajo el faldón: oscurece el tercio inferior de la chapa. Es lo que
  // le da volumen al costado sin tener que dibujar un degradado por encima.
  const bajo = ctx.createLinearGradient(0, y + H * 0.35, 0, y + H * 1.12);
  bajo.addColorStop(0, "rgba(0,0,0,0)");
  bajo.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = bajo;
  ctx.fill();

  // --- Cabina ---------------------------------------------------------------
  //
  // Trapecio con el techo caído hacia atrás y el parabrisas tumbado. Esa
  // inclinación es lo que separa una camioneta moderna de una caja.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(L * 0.19, y + 1);
  ctx.lineTo(L * 0.34, techo);
  ctx.lineTo(L * 0.6, techo + H * 0.06);
  ctx.lineTo(L * 0.62, y + 1);
  ctx.closePath();
  ctx.fill();

  // --- Cristales ------------------------------------------------------------
  //
  // Dos, separados por el montante central. El parabrisas va más claro porque
  // devuelve la luz del cielo; la ventanilla lateral, más oscura, porque
  // detrás está el interior del vehículo, que no tiene luz.
  ctx.fillStyle = "#8ea3b8";
  ctx.beginPath();
  ctx.moveTo(L * 0.225, y - 2);
  ctx.lineTo(L * 0.35, techo + H * 0.14);
  ctx.lineTo(L * 0.425, techo + H * 0.14);
  ctx.lineTo(L * 0.425, y - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4d5c6b";
  ctx.beginPath();
  ctx.moveTo(L * 0.45, y - 2);
  ctx.lineTo(L * 0.45, techo + H * 0.15);
  ctx.lineTo(L * 0.585, techo + H * 0.19);
  ctx.lineTo(L * 0.585, y - 2);
  ctx.closePath();
  ctx.fill();

  // --- Línea de cintura -----------------------------------------------------
  //
  // El brillo horizontal a la altura de las manillas. Es el detalle que más
  // rinde de todos: una sola línea clara recorriendo el costado y la chapa
  // deja de ser plana.
  ctx.strokeStyle = "rgba(226, 236, 248, 0.34)";
  ctx.lineWidth = Math.max(1, H * 0.09);
  ctx.beginPath();
  ctx.moveTo(L * 0.06, y + H * 0.3);
  ctx.lineTo(L * 0.96, y + H * 0.24);
  ctx.stroke();

  // Junta de la puerta y borde de la caja de carga.
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L * 0.44, y + H * 0.06);
  ctx.lineTo(L * 0.44, y + H * 0.95);
  ctx.moveTo(L * 0.64, y + H * 0.02);
  ctx.lineTo(L * 0.64, y + H * 1.0);
  ctx.stroke();

  // Espejo retrovisor. Dos píxeles que se leen igual.
  ctx.fillStyle = "#2a323b";
  ctx.fillRect(L * 0.2, y - H * 0.16, L * 0.05, H * 0.16);

  ctx.restore();
}

/**
 * Faro encendido, con su cono y el charco que deja en el pavimento.
 *
 * El cono solo no basta: en una grabación nocturna lo que primero se ve no es
 * el haz, es la mancha de luz que el faro pone en el suelo. Sin ella el cono
 * parece un triángulo pegado al vehículo.
 */
function faro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hacia: number,
  alcance: number
): void {
  // Charco en el pavimento, delante del morro.
  const charco = ctx.createRadialGradient(
    x + hacia * alcance * 0.55, y + alcance * 0.16, 2,
    x + hacia * alcance * 0.55, y + alcance * 0.16, alcance * 0.62
  );
  charco.addColorStop(0, "rgba(255, 238, 196, 0.26)");
  charco.addColorStop(1, "rgba(255, 238, 196, 0)");
  ctx.save();
  ctx.translate(0, y + alcance * 0.16);
  ctx.scale(1, 0.34);
  ctx.translate(0, -(y + alcance * 0.16));
  ctx.fillStyle = charco;
  ctx.beginPath();
  ctx.arc(x + hacia * alcance * 0.55, y + alcance * 0.16, alcance * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // El haz.
  const cono = ctx.createLinearGradient(x, y, x + hacia * alcance, y);
  cono.addColorStop(0, "rgba(255, 244, 212, 0.4)");
  cono.addColorStop(1, "rgba(255, 240, 200, 0)");
  ctx.fillStyle = cono;
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x + hacia * alcance, y - alcance * 0.26);
  ctx.lineTo(x + hacia * alcance, y + alcance * 0.32);
  ctx.lineTo(x, y + 3);
  ctx.closePath();
  ctx.fill();

  // Núcleo: el punto brillante del propio faro. Es lo que hace que el haz
  // salga de algún sitio en vez de aparecer de la nada.
  const nucleo = ctx.createRadialGradient(x, y, 0.5, x, y, alcance * 0.14);
  nucleo.addColorStop(0, "rgba(255, 252, 238, 0.95)");
  nucleo.addColorStop(1, "rgba(255, 246, 214, 0)");
  ctx.fillStyle = nucleo;
  ctx.beginPath();
  ctx.arc(x, y, alcance * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 01:00 — la camioneta llega a la reja y se detiene.
 *
 * Entra por la derecha, que es por donde está la reja, y frena en el
 * antejardín. Queda ahí con los faros encendidos: es lo que el guardia tiene
 * delante mientras confirma con el 302 y anota la patente.
 */
function vehiculoEnReja(ctx: CanvasRenderingContext2D, avance: number): void {
  const y = QH * 0.44 + QH * 0.22;
  const x = QW * 1.02 - suave(avance) * QW * 0.66;

  faro(ctx, x + 1, y + QH * 0.07, -1, QW * 0.34);
  carroceria(ctx, x, y, QW * 0.3, QH * 0.09, "#5b636d", true);
}

/**
 * 01:30 — la misma camioneta, saliendo.
 *
 * Arranca del mismo punto donde quedó detenida y se va hacia la reja: quien
 * vio la toma de las 01:00 reconoce que es el mismo vehículo haciendo el
 * camino inverso, que es exactamente lo que hay que redactar.
 */
function vehiculoSaliendo(ctx: CanvasRenderingContext2D, avance: number): void {
  const y = QH * 0.44 + QH * 0.22;
  // Termina DENTRO del cuadro, no saliéndose por el borde: quien llegue
  // tarde a mirar tiene que encontrar el vehículo, no un rastro rojo.
  const x = QW * 0.12 + suave(avance) * QW * 0.5;
  const ancho = QW * 0.3;
  const alto = QH * 0.09;

  // Espejado: ahora el morro mira a la derecha, hacia la reja. Es el mismo
  // vehículo de las 01:00 haciendo el camino inverso, y que se reconozca es
  // justamente lo que hay que redactar en el libro.
  carroceria(ctx, x, y, ancho, alto, "#5b636d", false);

  // Luces traseras, que ahora quedan a la izquierda, y su rastro sobre el
  // pavimento. Van DESPUÉS de la carrocería para que el halo la desborde,
  // como desborda una luz encendida en una grabación.
  const cy = y + alto * 0.55;
  const rastro = ctx.createLinearGradient(x, cy, x - QW * 0.22, cy);
  rastro.addColorStop(0, "rgba(255, 72, 52, 0.3)");
  rastro.addColorStop(1, "rgba(255, 72, 52, 0)");
  ctx.fillStyle = rastro;
  ctx.fillRect(x - QW * 0.22, cy - alto * 0.5, QW * 0.22, alto * 1.1);

  const halo = ctx.createRadialGradient(x + 2, cy, 1, x + 2, cy, QW * 0.05);
  halo.addColorStop(0, "rgba(255, 96, 70, 0.75)");
  halo.addColorStop(1, "rgba(255, 96, 70, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x + 2, cy, QW * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6a4a";
  ctx.fillRect(x, cy - 2, 4, 5);
}
/**
 * 00:45 — la camioneta gris detenida en visitas, con las intermitentes.
 *
 * No se mueve: eso ES el suceso. Lo único vivo son las intermitentes y el
 * humo del escape, y por eso el ojo se va para allá aunque el cuadrante sea
 * pequeño y el monitor esté al fondo del mesón.
 */
function vehiculoDetenido(ctx: CanvasRenderingContext2D, segundos: number): void {
  const y = QH * 0.32 + QH * 0.34;
  const x = QW * 0.32;
  const ancho = QW * 0.36;
  const alto = QH * 0.1;

  carroceria(ctx, x, y, ancho, alto, "#6b737d", true);

  // El motor está encendido, y en una noche fría eso se ve. El humo sale por
  // detrás, o sea a la derecha, porque el morro mira a la izquierda.
  const humo = ctx.createRadialGradient(
    x + ancho + 4, y + alto * 1.3, 1,
    x + ancho + 4, y + alto * 1.3, 7 + Math.sin(segundos * 1.7) * 3
  );
  humo.addColorStop(0, "rgba(206, 218, 230, 0.20)");
  humo.addColorStop(1, "rgba(206, 218, 230, 0)");
  ctx.fillStyle = humo;
  ctx.beginPath();
  ctx.arc(x + ancho + 4, y + alto * 1.3, 7 + Math.sin(segundos * 1.7) * 3, 0, Math.PI * 2);
  ctx.fill();

  // Intermitentes. Es lo único vivo del cuadro, y por eso el ojo se va para
  // allá aunque el cuadrante sea pequeño y el monitor esté al fondo del mesón.
  if (Math.floor(segundos * 2) % 2 === 0) {
    [x + 3, x + ancho - 5].forEach((fx) => {
      const cy = y + alto * 0.5;
      const halo = ctx.createRadialGradient(fx, cy, 1, fx, cy, QW * 0.038);
      halo.addColorStop(0, "rgba(255, 196, 82, 0.62)");
      halo.addColorStop(1, "rgba(255, 190, 70, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(fx, cy, QW * 0.038, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(fx - 2, cy - 2, 4, 4);
    });
  }
}

/**
 * 00:30 — el pasillo con la luz encendida y la ventana abierta.
 *
 * Las dos cosas que dice el aviso, visibles a la vez: el plafón encendido con
 * su charco en el piso, y la hoja de la ventana batida hacia dentro. Cuando la
 * novedad queda escrita —"se cierra la ventana y se apagan las luces"— la
 * cámara vuelve sola a la calma, y ahí se ve que quedó resuelto.
 */
function pasilloAbierto(ctx: CanvasRenderingContext2D, avance: number): void {
  // La luz "prende" en el primer tramo: es la única forma de que quien esté
  // mirando note que algo cambió, y no que el pasillo siempre estuvo así.
  const fuerza = suave(avance);

  ctx.fillStyle = `rgba(255, 248, 224, ${0.85 * fuerza})`;
  ctx.fillRect(QW * 0.44, QH * 0.19, QW * 0.15, 5);

  const luz = ctx.createRadialGradient(QW * 0.51, QH * 0.23, 3, QW * 0.51, QH * 0.23, QH * 0.62);
  luz.addColorStop(0, `rgba(255, 242, 205, ${0.3 * fuerza})`);
  luz.addColorStop(1, "rgba(255, 242, 205, 0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, QW, QH);

  // --- La ventana abierta ---------------------------------------------------
  //
  // Va sobre el muro DERECHO, siguiendo su fuga. Antes era un rectángulo recto
  // pegado encima, y por eso se leía como un cartel flotando delante del
  // pasillo en vez de como un hueco en la pared. El pasillo tiene perspectiva;
  // lo que va en sus paredes también.
  //
  // El muro derecho va del borde de la pantalla (cerca) al vano del fondo
  // (lejos). Estas dos funciones dan, para un punto cualquiera de ese
  // recorrido, dónde caen su arista de arriba y la de abajo.
  const mx = (t: number) => QW * (0.615 + 0.385 * t);
  const myArriba = (t: number) => QH * 0.31 * (1 - t);
  const myAbajo = (t: number) => QH * (0.63 + 0.37 * t);
  /** Punto a la altura `h` (0 arriba, 1 abajo) del muro, en la fuga `t`. */
  const punto = (t: number, h: number): [number, number] => [
    mx(t),
    myArriba(t) + (myAbajo(t) - myArriba(t)) * h,
  ];

  // Adelantada hacia la cámara para que no se pise con el vano del fondo.
  const T1 = 0.44;
  const T2 = 0.74;

  // Hueco. Azul muy oscuro, no negro: al otro lado hay noche, y la noche
  // tiene color. En negro puro se veía como un agujero recortado.
  ctx.fillStyle = "#080c14";
  ctx.beginPath();
  ctx.moveTo(...punto(T1, 0.24));
  ctx.lineTo(...punto(T2, 0.24));
  ctx.lineTo(...punto(T2, 0.72));
  ctx.lineTo(...punto(T1, 0.72));
  ctx.closePath();
  ctx.fill();

  // Marco.
  ctx.strokeStyle = "#7b8794";
  ctx.lineWidth = 2;
  ctx.stroke();

  // La hoja batida hacia dentro del pasillo. Es lo que distingue una ventana
  // ABIERTA de una ventana simplemente oscura, y por eso vale la pena: sin
  // ella la novedad no se ve, se supone.
  const [hx1, hy1] = punto(T1, 0.24);
  const [hx2, hy2] = punto(T1, 0.72);
  ctx.fillStyle = "rgba(122, 137, 152, 0.72)";
  ctx.beginPath();
  ctx.moveTo(hx1, hy1);
  ctx.lineTo(hx1 - QW * 0.11, hy1 + QH * 0.07);
  ctx.lineTo(hx2 - QW * 0.11, hy2 + QH * 0.02);
  ctx.lineTo(hx2, hy2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#96a3b0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Reflejo del plafón en el cristal de la hoja. Un trazo, y el vidrio deja
  // de parecer chapa gris.
  ctx.strokeStyle = "rgba(255, 246, 220, 0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx1 - QW * 0.085, hy1 + QH * 0.09);
  ctx.lineTo(hx2 - QW * 0.05, hy2 - QH * 0.03);
  ctx.stroke();
}

/**
 * 02:10 — la bodega con la puerta entornada y el candado abierto.
 *
 * A diferencia de las otras cuatro, aquí no llega ni se va nada: la escena es
 * un ESTADO que ya estaba cuando la cámara lo enseña. Por eso `avance` no
 * mueve un vehículo sino que abre la hoja, y solo un poco — una puerta de par
 * en par contaría otra cosa, y lo que hay que redactar es exactamente esto:
 * entornada, no abierta; el candado suelto, no roto.
 *
 * La hoja se dibuja ENCIMA de la cerrada que ya pintó dibujarBodega, tapándola
 * con el hueco negro del marco: así el retranqueo queda a la vista y se lee
 * como una puerta que gira, no como un rectángulo que cambia de color.
 */
function bodegaAbierta(ctx: CanvasRenderingContext2D, avance: number): void {
  const suelo = QH * 0.62;
  const px = QW * 0.62;
  const pw = QW * 0.3;
  const py = QH * 0.14;
  const ph = suelo - py;

  // Entreabre hasta poco más de un tercio y se queda ahí.
  const hueco = pw * (0.14 + suave(avance) * 0.24);

  // El vano: negro, porque detrás de la puerta no hay luz.
  ctx.fillStyle = "#05070a";
  ctx.fillRect(px, py, pw, ph);

  // Luz del pasillo colándose por la rendija, sobre el radier. Es lo que hace
  // que la puerta se lea abierta de un vistazo, incluso antes de distinguir el
  // candado: un rectángulo negro no llama la atención, un reguero de luz sí.
  const rendija = ctx.createLinearGradient(px, suelo, px + hueco * 2.4, QH);
  rendija.addColorStop(0, "rgba(255, 244, 214, 0.2)");
  rendija.addColorStop(1, "rgba(255, 244, 214, 0)");
  ctx.fillStyle = rendija;
  ctx.beginPath();
  ctx.moveTo(px, suelo);
  ctx.lineTo(px + hueco, suelo);
  ctx.lineTo(px + hueco * 2.6, QH);
  ctx.lineTo(px - hueco * 0.4, QH);
  ctx.closePath();
  ctx.fill();

  // La hoja, corrida y en escorzo: se estrecha al girar hacia dentro.
  const anchoHoja = pw - hueco;
  const hoja = ctx.createLinearGradient(px + hueco, 0, px + pw, 0);
  hoja.addColorStop(0, "#6e7885");
  hoja.addColorStop(0.5, "#4a535f");
  hoja.addColorStop(1, "#39424d");
  ctx.fillStyle = hoja;
  ctx.beginPath();
  ctx.moveTo(px + hueco, py + ph * 0.03);
  ctx.lineTo(px + pw, py);
  ctx.lineTo(px + pw, py + ph);
  ctx.lineTo(px + hueco, py + ph * 0.97);
  ctx.closePath();
  ctx.fill();

  // Canto de la hoja: el grosor de la chapa, que es lo que remata el escorzo.
  ctx.fillStyle = "#8e99a6";
  ctx.fillRect(px + hueco - 2.5, py + ph * 0.03, 2.5, ph * 0.94);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  [0.28, 0.64].forEach((t) => ctx.fillRect(px + hueco, py + ph * t, anchoHoja, 3));

  // Argolla vacía y candado colgando abierto. Es el detalle que decide la
  // redacción: abierto, no forzado.
  ctx.fillStyle = "#2c343d";
  ctx.fillRect(px - 3, py + ph * 0.46, 12, 16);
  candado(ctx, px - 1, py + ph * 0.53, true);
}