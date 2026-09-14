import { Scene, Color3, Vector3, SpotLight, HemisphericLight, PBRMaterial } from "@babylonjs/core";
import { construirCalleExterior } from "./CalleExterior";

// ===========================================================================
// El paso de la noche por el ventanal
// ===========================================================================
//
// El turno va de 00:00 a 08:00, y la calle lo cuenta:
//
//   · 00:00 — negro cerrado. Solo el resplandor sodio de la ciudad bajo las
//     nubes, los faroles y las ventanas de quien sigue despierto.
//   · De madrugada las ventanas se van apagando, primero unas, después otras.
//     La tele del bloque sigue parpadeando azul hasta pasada la una.
//   · 06:00 — azul oscuro. Se encienden las cocinas: luz fría de LED, la de
//     quien se levanta a trabajar.
//   · 07:38 — la fotocelda apaga los faroles, con su parpadeo.
//   · 08:00 — un naranja tenue bajo las nubes, detrás de los techos, y las
//     fachadas de enfrente ya se leen.
//
// Y la sala lo nota: el vidrio, que de noche es casi un espejo, se vuelve
// transparente cuando fuera hay más luz que dentro; entra una luz difusa que
// toca el piso junto al ventanal; el relleno de la sala se entibia.
//
// ─── REPARTO ──────────────────────────────────────────────────────────────
//
// Este archivo decide QUÉ HORA ES y cómo se ve eso: las claves del cielo y lo
// que cambia dentro de la sala. La calle —con su profundidad, sus fachadas y
// sus luces— está en CalleExterior, que recibe el estado y lo pinta.
//
// La hora que manda es la del turno, pero la que se ve la sigue con un retardo
// corto: con el turno adelantado el reloj salta trece minutos por segundo, y
// sin suavizar el cielo cambiaría a tirones.

type RGB = [number, number, number];

const limitar = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);

function suave(a: number, b: number, x: number): number {
  const t = limitar((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

const desdeHex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

/** sRGB a lineal. Los colores se piensan en sRGB; la luz se mezcla en lineal. */
const lineal = (c: RGB): RGB => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];

// ---------------------------------------------------------------------------
// Las claves de la noche
// ---------------------------------------------------------------------------

interface ClaveCielo {
  minuto: number;
  cenit: string;
  horizonte: string;
  /** Lo que brilla bajo el horizonte: la ciudad de noche, el sol al amanecer. */
  resplandor: string;
  fuerzaResplandor: number;
  /** La cara de abajo de las nubes. */
  nubes: string;
  /** Cuánta luz recibe la fachada de enfrente, como multiplicador por canal. */
  fachada: RGB;
  /** La luz que entra por el ventanal. */
  entrante: string;
  fuerzaEntrante: number;
}

export const CLAVES_CIELO: ClaveCielo[] = [
  {
    minuto: 0,
    cenit: "#010103",
    horizonte: "#05060a",
    resplandor: "#1c0e06",
    fuerzaResplandor: 0.35,
    nubes: "#060608",
    fachada: [1, 1, 1],
    entrante: "#000000",
    fuerzaEntrante: 0,
  },
  {
    // La noche cerrada dura hasta las cinco. El amanecer no empieza a las
    // doce y cuarto: si el cielo aclarara parejo durante ocho horas, a las
    // tres ya se vería gris.
    minuto: 300,
    cenit: "#010204",
    horizonte: "#06080d",
    resplandor: "#170d07",
    fuerzaResplandor: 0.3,
    nubes: "#07080b",
    fachada: [1, 1, 1],
    entrante: "#000000",
    fuerzaEntrante: 0,
  },
  {
    minuto: 360,
    cenit: "#04091a",
    horizonte: "#0f1d3d",
    resplandor: "#1f3060",
    fuerzaResplandor: 0.55,
    // Las nubes, un punto por DEBAJO del cielo: al amanecer se leen como
    // masas oscuras contra la claridad, no como más cielo.
    nubes: "#0b1224",
    fachada: [1.5, 1.7, 2.4],
    entrante: "#3a55a0",
    fuerzaEntrante: 0.35,
  },
  {
    minuto: 420,
    cenit: "#0b1a3a",
    horizonte: "#36466e",
    resplandor: "#b0707a",
    fuerzaResplandor: 0.75,
    nubes: "#2a2c40",
    fachada: [2.4, 2.5, 3.0],
    entrante: "#7f8ab8",
    fuerzaEntrante: 0.6,
  },
  {
    // Naranja tenue y solo abajo. Es septiembre en Puerto Montt y está
    // nublado: el sol no se ve, se ve la parte de abajo de las nubes
    // encendiéndose por detrás de los techos.
    minuto: 480,
    cenit: "#243b66",
    horizonte: "#c98a5e",
    resplandor: "#e8a070",
    fuerzaResplandor: 0.8,
    nubes: "#5d4e5a",
    // Luz de día nublado sobre las fachadas: neutra, algo fría. El naranja se
    // queda en el cielo; si también tiñe las paredes, la calle entera se lee
    // como un atardecer de postal.
    fachada: [3.4, 3.4, 3.7],
    entrante: "#ffc38a",
    fuerzaEntrante: 1,
  },
];

/** Todo lo que cambia con la hora, ya en valores lineales. */
export interface EstadoAtmosfera {
  cenit: RGB;
  horizonte: RGB;
  resplandor: RGB;
  fuerzaResplandor: number;
  nubes: RGB;
  fachada: RGB;
  entrante: RGB;
  fuerzaEntrante: number;
  /** Ventanas que se apagan a la 01:10. */
  ventanasA: number;
  /** Ventanas que se apagan a las 02:40. */
  ventanasB: number;
  /** El televisor del bloque, hasta la 01:40. */
  tele: number;
  /** Cocinas que se encienden a las 05:55. */
  cocinasTempranas: number;
  /** Cocinas que se encienden a las 06:40. */
  cocinasTardias: number;
  /** Los faroles, que se apagan a las 07:38. */
  farola: number;
  /** De 0 a 1 entre las 05:30 y las 08:00. */
  claridad: number;
}

/** El estado de la calle a una hora del turno. Función pura. */
export function estadoEn(minuto: number): EstadoAtmosfera {
  const m = limitar(minuto, 0, 480);
  let i = 0;
  while (i < CLAVES_CIELO.length - 2 && m > CLAVES_CIELO[i + 1].minuto) i++;
  const a = CLAVES_CIELO[i];
  const b = CLAVES_CIELO[i + 1];
  const t = suave(0, 1, (m - a.minuto) / (b.minuto - a.minuto));

  const mezclar = (x: RGB, y: RGB): RGB => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  const color = (x: string, y: string): RGB => mezclar(lineal(desdeHex(x)), lineal(desdeHex(y)));

  return {
    cenit: color(a.cenit, b.cenit),
    horizonte: color(a.horizonte, b.horizonte),
    resplandor: color(a.resplandor, b.resplandor),
    fuerzaResplandor: a.fuerzaResplandor + (b.fuerzaResplandor - a.fuerzaResplandor) * t,
    nubes: color(a.nubes, b.nubes),
    fachada: mezclar(a.fachada, b.fachada),
    entrante: color(a.entrante, b.entrante),
    fuerzaEntrante: a.fuerzaEntrante + (b.fuerzaEntrante - a.fuerzaEntrante) * t,
    ventanasA: 1 - suave(68, 72, m),
    ventanasB: 1 - suave(158, 162, m),
    tele: 1 - suave(98, 101, m),
    cocinasTempranas: suave(354, 357, m),
    cocinasTardias: suave(399, 402, m),
    farola: 1 - suave(457, 460, m),
    claridad: suave(330, 480, m),
  };
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

/** Lo que la atmósfera necesita de la sala, construido antes. */
export interface PiezasExterior {
  /** El vidrio del ventanal: reflejo, transparencia y lluvia. */
  cristal: PBRMaterial;
  farola: SpotLight;
  bulboFarola: PBRMaterial;
  /** Posición del bulbo de la farola de este lado, para colgar su halo. */
  posicionBulbo: Vector3;
  relleno: HemisphericLight | null;
}

export interface AtmosferaTurno {
  /** La hora del turno. Lo que se ve la sigue suavemente. */
  enMinuto(minuto: number): void;
  /** Salta a una hora sin suavizar. */
  fijarMinuto(minuto: number): void;
}

export function crearAtmosferaTurno(scene: Scene, piezas: PiezasExterior): AtmosferaTurno {
  const calle = construirCalleExterior(scene, {
    farola: piezas.farola,
    bulboFarola: piezas.bulboFarola,
    posicionBulbo: piezas.posicionBulbo,
  });

  // --- La luz que entra por el ventanal ----------------------------------------
  //
  // Difusa y ancha, sin sombra ni recorte de ventana: un cielo nublado no dibuja
  // la ventana en el suelo, lo aclara. Solo alcanza al hall, no a lo del mesón,
  // que queda a cuatro metros y bajo el flexo.
  const entrante = new SpotLight(
    "luzAmanecerVentanal",
    new Vector3(0, 2.1, 5.4),
    new Vector3(0, -0.45, -1).normalize(),
    1.3,
    1.5,
    scene
  );
  entrante.range = 9;
  entrante.intensity = 0;
  entrante.specular = new Color3(0.3, 0.3, 0.3);
  entrante.includedOnlyMeshes = scene.meshes.filter((m) =>
    /^(pisoHall|alfeizarVentanal|MuroAntepechoHall|MuroDintelHall|marcoVentanal|junquilloVentanal|TechoHall|MuroLateralHall|ZocaloHall|JambaPuertaHall|JambaAscensorHall|MuroFondoHall)/.test(
      m.name
    )
  );

  const rellenoBase = piezas.relleno ? piezas.relleno.diffuse.clone() : null;
  const intensidadRellenoBase = piezas.relleno?.intensity ?? 0;

  let minutoObjetivo = 0;
  let minutoVisible = 0;
  let tiempo = 0;

  function aplicar(e: EstadoAtmosfera): void {
    // La fotocelda no apaga de golpe: el tubo titila un par de segundos.
    let farola = e.farola;
    if (farola > 0.02 && farola < 0.98) {
      const tic = Math.sin(Math.floor(tiempo * 14) * 12.9898) * 43758.5453;
      farola *= tic - Math.floor(tic) > 0.4 ? 1 : 0.2;
    }

    calle.aplicar(e, farola, tiempo);
    piezas.farola.intensity = 26 * farola;
    piezas.bulboFarola.emissiveColor.set(farola, 0.86 * farola, 0.6 * farola);

    // De noche el vidrio devuelve la sala; al clarear fuera, deja ver.
    piezas.cristal.environmentIntensity = 1.6 - 0.8 * e.claridad;
    piezas.cristal.alpha = 0.42 - 0.12 * e.claridad;
    piezas.cristal.emissiveColor.set(
      0.34 * (0.55 + 0.45 * farola) + 0.28 * e.claridad,
      0.39 * (0.6 + 0.4 * farola) + 0.3 * e.claridad,
      0.48 * (0.7 + 0.3 * farola) + 0.33 * e.claridad
    );

    const tope = Math.max(e.entrante[0], e.entrante[1], e.entrante[2], 1e-4);
    entrante.diffuse.set(e.entrante[0] / tope, e.entrante[1] / tope, e.entrante[2] / tope);
    entrante.intensity = 7 * e.fuerzaEntrante;

    if (piezas.relleno && rellenoBase) {
      const k = e.claridad * 0.35;
      piezas.relleno.diffuse.set(
        rellenoBase.r + (entrante.diffuse.r * 0.7 - rellenoBase.r) * k,
        rellenoBase.g + (entrante.diffuse.g * 0.7 - rellenoBase.g) * k,
        rellenoBase.b + (entrante.diffuse.b * 0.7 - rellenoBase.b) * k
      );
      piezas.relleno.intensity = intensidadRellenoBase + 0.07 * e.claridad;
    }
  }

  aplicar(estadoEn(0));

  const observador = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    tiempo += dt;
    minutoVisible += (minutoObjetivo - minutoVisible) * (1 - Math.exp(-dt / 0.45));
    if (Math.abs(minutoObjetivo - minutoVisible) < 0.001) minutoVisible = minutoObjetivo;
    aplicar(estadoEn(minutoVisible));
  });
  // La escena se vacía al salir del turno; el observador no tiene que seguir
  // escribiendo en materiales que ya no existen.
  const cielo = calle.mallas.find((m) => m.name === "calleExteriorCielo");
  cielo?.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observador));

  return {
    enMinuto(minuto) {
      minutoObjetivo = limitar(minuto, 0, 480);
    },
    fijarMinuto(minuto) {
      minutoObjetivo = limitar(minuto, 0, 480);
      minutoVisible = minutoObjetivo;
      aplicar(estadoEn(minutoVisible));
    },
  };
}
