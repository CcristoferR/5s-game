/**
 * Audio del juego.
 *
 * Todo el sonido pasa por acá. Los niveles, el HUD y los paneles solo piden
 * efectos por nombre — `reproducir("acierto")` — y no saben nada de rutas,
 * volúmenes ni del estado del navegador.
 *
 * Tres cosas que resuelve este módulo y que si no se hacen bien arruinan la
 * experiencia:
 *
 *  1. EL BLOQUEO DEL NAVEGADOR. Chrome, Firefox y Safari no dejan sonar nada
 *     hasta que el usuario interactúa con la página. Si se intenta antes, el
 *     audio queda mudo para siempre en esa pestaña. Por eso el desbloqueo se
 *     engancha al primer clic o tecla, una sola vez.
 *
 *  2. LOS ARCHIVOS QUE FALTAN. Un efecto sin archivo no debe tirar el juego.
 *     Si algo no carga, ese efecto queda en silencio y el resto sigue igual.
 *
 *  3. EL SOLAPAMIENTO. Al clasificar rápido, dos aciertos seguidos pisan el
 *     mismo sonido y se corta. Cada efecto guarda varias copias y va rotando,
 *     así suenan superpuestos como corresponde.
 *
 * Los archivos van en `public/audio/` y se sirven desde `/audio/`.
 */

export type EfectoSonido =
  | "agarrar"
  | "soltar"
  | "acierto"
  | "error"
  | "boton"
  | "panel"
  | "nivelCompletado"
  | "ambiente"
  // Los del turno de guardia en el supermercado.
  | "radio"
  | "radioVencido"
  | "pregunta"
  | "cerrar"
  | "marca"
  | "mirada"
  // El llamador de turnos del banco.
  | "turnoBanco"
  // El asalto. Los pasos de los que corren no son un efecto de estos: ver
  // pisada(), más abajo.
  | "puertaGolpe"
  | "exclamacion";

interface DefinicionEfecto {
  archivo: string;
  /** Volumen propio del efecto, 0 a 1. Compensa que unos vienen más fuertes. */
  volumen: number;
  /** Copias simultáneas. Más de una para los efectos que se disparan seguido. */
  copias: number;
  /** Solo el ambiente se repite en bucle. */
  bucle?: boolean;
}

const EFECTOS: Record<EfectoSonido, DefinicionEfecto> = {
  agarrar: { archivo: "agarrar.mp3", volumen: 0.5, copias: 3 },
  soltar: { archivo: "soltar.mp3", volumen: 0.5, copias: 3 },
  acierto: { archivo: "acierto.mp3", volumen: 0.7, copias: 3 },
  error: { archivo: "error.mp3", volumen: 0.6, copias: 2 },
  boton: { archivo: "boton.mp3", volumen: 0.4, copias: 3 },
  panel: { archivo: "panel.mp3", volumen: 0.45, copias: 2 },
  nivelCompletado: { archivo: "nivel-completado.mp3", volumen: 0.8, copias: 1 },
  // El ambiente del taller va MUY bajo a propósito: tiene que notarse cuando
  // se apaga, no mientras suena. Si compite con los efectos, molesta.
  ambiente: { archivo: "ambiente-taller.mp3", volumen: 0.18, copias: 1, bucle: true },

  // ─── EL TURNO DE GUARDIA ────────────────────────────────────────────
  //
  // Seis efectos de interfaz para el supermercado, de los packs de Kenney
  // (dominio público, ver public/audio/CREDITOS.md). Vienen pasados a WAV
  // mono y igualados en volumen percibido, así que lo de aquí abajo solo
  // reparte importancia: la radio y la pregunta tienen que oírse; el tic de
  // la ronda y el de la barra, casi no.
  //
  // Son WAV y no MP3 como los demás: sin conversor en el equipo, pasarlos a
  // WAV desde el navegador era la forma de que no perdieran nada y de que
  // suenen en cualquier navegador. Pesan 30 KB cada uno, que para seis
  // efectos no es nada.
  radio: { archivo: "radio.wav", volumen: 0.6, copias: 2 },
  radioVencido: { archivo: "radio-vencido.wav", volumen: 0.55, copias: 2 },
  pregunta: { archivo: "pregunta.wav", volumen: 0.65, copias: 1 },
  cerrar: { archivo: "cerrar.wav", volumen: 0.4, copias: 2 },
  marca: { archivo: "marca.wav", volumen: 0.4, copias: 3 },
  mirada: { archivo: "mirada.wav", volumen: 0.3, copias: 2 },
  // El "tin-tón" de la pantalla de turnos. Es de la sala, no de la interfaz:
  // va bajo, como algo que suena al fondo del hall y no en el oído.
  turnoBanco: { archivo: "turno-banco.wav", volumen: 0.32, copias: 1 },
  // ─── EL ASALTO ──────────────────────────────────────────────────────
  //
  // Freesound, CC0 (ver public/audio/CREDITOS.md): la puerta que se abre de
  // un golpe contra el tope y la exclamación ahogada de un grupo chico.
  // Igualados en volumen como los demás; aquí se reparte cuánto pesa cada
  // uno. Tienen que sobresaltar: son lo que avisa a quien está mirando a otra
  // parte.
  puertaGolpe: { archivo: "puerta-golpe.wav", volumen: 0.85, copias: 1 },
  exclamacion: { archivo: "exclamacion.wav", volumen: 0.5, copias: 1 },
};

/**
 * Los que suenan EN la sala —la pantalla de turnos, la puerta, la gente— y no
 * en la interfaz. Se congelan con ella: si un panel para el turno a mitad de
 * la exclamación, el resto de la exclamación suena al seguir, no encima del
 * panel. Ver congelarSonidosSala.
 */
const DE_LA_SALA: readonly EfectoSonido[] = ["turnoBanco", "puertaGolpe", "exclamacion"];

const CARPETA = "/audio/";

interface CanalEfecto {
  copias: HTMLAudioElement[];
  siguiente: number;
  volumen: number;
}

const canales = new Map<EfectoSonido, CanalEfecto>();

let desbloqueado = false;
let silenciado = false;
let volumenGeneral = 1;
let iniciado = false;

/**
 * Prepara los efectos y engancha el desbloqueo al primer gesto del usuario.
 * Se llama una vez, al arrancar el juego. Llamarlo de nuevo no hace nada.
 */
export function iniciarAudio(): void {
  if (iniciado) return;
  iniciado = true;

  (Object.keys(EFECTOS) as EfectoSonido[]).forEach((nombre) => {
    const definicion = EFECTOS[nombre];
    const copias: HTMLAudioElement[] = [];

    for (let i = 0; i < definicion.copias; i++) {
      const audio = new Audio(CARPETA + definicion.archivo);
      audio.preload = "auto";
      audio.loop = definicion.bucle ?? false;
      audio.volume = definicion.volumen;
      // Un archivo que no existe no debe ensuciar la consola ni cortar nada:
      // simplemente ese efecto queda mudo.
      audio.addEventListener("error", () => undefined);
      copias.push(audio);
    }

    canales.set(nombre, { copias, siguiente: 0, volumen: definicion.volumen });
  });

  const desbloquear = (): void => {
    desbloqueado = true;
    window.removeEventListener("pointerdown", desbloquear);
    window.removeEventListener("keydown", desbloquear);
  };

  window.addEventListener("pointerdown", desbloquear);
  window.addEventListener("keydown", desbloquear);
}

/** Dispara un efecto. Sin archivo, sin desbloqueo o en silencio, no hace nada. */
export function reproducir(nombre: EfectoSonido): void {
  if (!desbloqueado || silenciado) return;

  const canal = canales.get(nombre);
  if (!canal || canal.copias.length === 0) return;

  const audio = canal.copias[canal.siguiente];
  canal.siguiente = (canal.siguiente + 1) % canal.copias.length;

  audio.currentTime = 0;
  audio.volume = canal.volumen * volumenGeneral;
  // play() devuelve una promesa que se rechaza si el navegador lo impide.
  // No hay nada que hacer al respecto salvo no romper el juego.
  void audio.play().catch(() => undefined);
}

/** Los efectos de la sala que el último congelado dejó a medias. */
let salaEnPausa: HTMLAudioElement[] = [];

/**
 * Para los efectos de la sala que estén sonando, sin rebobinarlos, o los deja
 * seguir desde donde quedaron. Va con los paneles y la pausa del turno: lo que
 * se congela en pantalla se congela también en el oído.
 */
export function congelarSonidosSala(quietos: boolean): void {
  if (quietos) {
    DE_LA_SALA.forEach((nombre) =>
      canales.get(nombre)?.copias.forEach((audio) => {
        if (audio.paused || audio.ended) return;
        audio.pause();
        salaEnPausa.push(audio);
      })
    );
    return;
  }
  const seguir = salaEnPausa;
  salaEnPausa = [];
  if (silenciado) return;
  seguir.forEach((audio) => void audio.play().catch(() => undefined));
}

/** Los corta del todo, al salir del nivel: lo que quedó a medias no vuelve a sonar. */
export function detenerSonidosSala(): void {
  salaEnPausa = [];
  DE_LA_SALA.forEach((nombre) =>
    canales.get(nombre)?.copias.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    })
  );
}

/** Arranca el ambiente del taller en bucle. Reentrante: no se apila. */
export function iniciarAmbiente(): void {
  if (!desbloqueado || silenciado) return;
  const canal = canales.get("ambiente");
  const audio = canal?.copias[0];
  if (!audio || !audio.paused) return;
  audio.volume = (canal as CanalEfecto).volumen * volumenGeneral;
  void audio.play().catch(() => undefined);
}

/** Corta el ambiente. Se llama al salir de un nivel. */
export function detenerAmbiente(): void {
  const audio = canales.get("ambiente")?.copias[0];
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

/** Silencia o restablece todo el audio. Devuelve el estado resultante. */
export function alternarSilencio(): boolean {
  silenciado = !silenciado;
  if (silenciado) {
    detenerAmbiente();
    detenerAmbienteSala();
  }
  return silenciado;
}

/**
 * Fija el silencio a un valor concreto.
 *
 * Distinta de alternarSilencio: la pantalla de ajustes tiene un interruptor
 * con dos estados definidos, y alternar desde ahí haría que el interruptor y
 * el sonido se desincronizaran si algo más lo cambia por otro lado.
 */
export function establecerSilencio(valor: boolean): void {
  silenciado = valor;
  if (silenciado) {
    detenerAmbiente();
    detenerAmbienteSala();
  }
}

export function estaSilenciado(): boolean {
  return silenciado;
}

/** Volumen general, 0 a 1. Multiplica al volumen propio de cada efecto. */
export function ajustarVolumen(valor: number): void {
  volumenGeneral = Math.min(1, Math.max(0, valor));
  const ambiente = canales.get("ambiente");
  const audio = ambiente?.copias[0];
  if (audio && ambiente) {
    audio.volume = ambiente.volumen * volumenGeneral;
  }
  ponerNivelSala(0.15);
  ponerNivelTono(0.15);
}

// ===========================================================================
// El ambiente de la sala del supermercado
// ===========================================================================
//
// Un minuto y ocho segundos de sala de supermercado —voces lejanas, carros,
// la caja— que tiene que sonar TODO el turno sin que se note la vuelta.
//
// ─── POR QUÉ NO ES UN EFECTO MÁS DE LOS DE ARRIBA ─────────────────────────
//
// Porque los de arriba son <audio> del navegador, y un <audio loop> no empalma:
// entre el final y el principio queda un hueco de unos milisegundos —en MP3,
// además, el propio formato añade silencio al empezar y al acabar—, y un
// ambiente continuo que hace "clic" cada minuto se nota muchísimo más que si
// no hubiera ambiente. Aquí el bucle lo lleva la Web Audio API, que repite el
// buffer muestra a muestra sin perder ni una.
//
// ─── Y POR QUÉ HAY QUE EMPALMARLO IGUAL ───────────────────────────────────
//
// Porque que no falte ni sobre una muestra no basta: la grabación empieza y
// acaba en puntos distintos de la onda, así que al volver a empezar hay un
// salto —un chasquido—. Se arregla mezclando los últimos cuatro segundos
// sobre los primeros cuatro con un fundido cruzado de potencia constante: la
// cola entra donde entraba la cabeza, y la cabeza ya no arranca de cero. Al
// final de la vuelta, la onda vale exactamente lo que vale al empezar.
//
// El empalme se hace una vez, al cargar, sobre el audio ya decodificado: así
// el archivo que se descarga sigue siendo el MP3 de millón y medio, y no un
// WAV de ocho.

/** Lo que dura el fundido cruzado del empalme, en segundos. */
const EMPALME = 4;
/**
 * El ambiente va bajo a propósito, como el del taller: tiene que sostener la
 * sala por debajo, no competir con la radio ni con los avisos.
 *
 * ─── DE DÓNDE SALE EL NÚMERO ──────────────────────────────────────────────
 *
 * De comparar energías, no a oído. La grabación tiene un RMS de 0,036 y los
 * efectos del turno están igualados a 0,11 de RMS, que con su volumen propio
 * —la radio, 0,6— quedan en 0,066. A 0,25, el ambiente suena en 0,009: unos
 * 17 dB por debajo de la radio. Ahí se oye el local sin que haya que levantar
 * la voz por encima de él; estuvo en 0,16 y era un rumor que se perdía.
 */
const VOLUMEN_SALA = 0.25;
/** Lo que baja cuando el turno se pausa, sin llegar a apagarse. */
const AGACHADO = 0.25;

/**
 * Los ambientes de sala que hay, cada uno con su archivo y su nivel.
 *
 * El del banco va algo más alto que el del súper porque la grabación es más
 * baja —un RMS de 0,025 contra 0,036—: a 0,3 suena en 0,0075, un punto por
 * debajo del súper, que es lo que tiene que sonar un hall de banco.
 *
 * Y se le SUAVIZAN LOS PICOS al cargar (ver suavizarPicos): trae cinco golpes
 * secos —una puerta, un timbre, algo que cae— y en ese nivel un golpe en el
 * fondo se confunde con algo que está pasando en la sala.
 */
const AMBIENTES = {
  supermercado: { archivo: "ambiente-supermercado.mp3", volumen: VOLUMEN_SALA, suavizar: false },
  banco: { archivo: "ambiente-banco.mp3", volumen: 0.3, suavizar: true },
} as const;
export type AmbienteSala = keyof typeof AMBIENTES;

let contexto: AudioContext | null = null;
/** Lo cargado de cada ambiente, ya preparado. Se carga una vez por partida. */
const cargasSala = new Map<AmbienteSala, Promise<AudioBuffer | null>>();
/** El que suena, o el último que sonó: su volumen es el que manda. */
let ambienteActual: AmbienteSala = "supermercado";
let sala: { fuente: AudioBufferSourceNode; ganancia: GainNode } | null = null;
/** Si la sala se calló de golpe. Ver cortarAmbienteSala. */
let salaCallada = false;
/** El zumbido del local que queda cuando se calla la gente. */
let tono: { fuente: AudioBufferSourceNode; ganancia: GainNode } | null = null;
let arrancandoSala = false;
let salaAgachada = false;

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  contexto = new Constructor();
  return contexto;
}

/** Nivel al que debe estar sonando ahora mismo el ambiente de sala. */
function nivelSala(): number {
  if (salaCallada) return 0;
  return AMBIENTES[ambienteActual].volumen * volumenGeneral * (salaAgachada ? AGACHADO : 1);
}

/** Lleva la ganancia al nivel que toca, sin saltos. */
function ponerNivelSala(segundos: number): void {
  if (!sala || !contexto) return;
  const ahora = contexto.currentTime;
  sala.ganancia.gain.cancelScheduledValues(ahora);
  sala.ganancia.gain.setValueAtTime(sala.ganancia.gain.value, ahora);
  sala.ganancia.gain.linearRampToValueAtTime(nivelSala(), ahora + segundos);
}

/** Descarga el ambiente, lo decodifica y lo deja empalmado para el bucle. */
function cargarSala(cual: AmbienteSala): Promise<AudioBuffer | null> {
  const ya = cargasSala.get(cual);
  if (ya) return ya;
  const carga = (async () => {
    const ctx = obtenerContexto();
    if (!ctx) return null;
    try {
      const definicion = AMBIENTES[cual];
      const respuesta = await fetch(CARPETA + definicion.archivo);
      if (!respuesta.ok) return null;
      const crudo = await ctx.decodeAudioData(await respuesta.arrayBuffer());
      if (definicion.suavizar) suavizarPicos(crudo);
      return empalmar(ctx, crudo);
    } catch {
      // Sin ambiente se juega igual: es lo mismo que hace un efecto que falta.
      return null;
    }
  })();
  cargasSala.set(cual, carga);
  return carga;
}

/**
 * Baja los golpes secos de una grabación sin tocar el resto.
 *
 * Un limitador hecho a mano, una vez, sobre el audio ya decodificado: mide la
 * energía en tramos de 50 ms y, donde un tramo pasa de dos veces y cuarto la
 * mediana, lo baja justo hasta ahí. La ganancia se prepara con anticipación
 * —se toma el mínimo de un entorno de 100 ms a cada lado— y se suaviza, así
 * que el golpe se queda en un roce, sin el bombeo de un compresor que se
 * dispara tarde. Las voces y el murmullo, que viven por debajo, no cambian.
 */
function suavizarPicos(buffer: AudioBuffer): void {
  const sr = buffer.sampleRate;
  const canales = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const tramo = Math.round(sr * 0.05);
  const cuantos = Math.floor(buffer.length / tramo);
  const energia = new Float32Array(cuantos);
  for (let t = 0; t < cuantos; t++) {
    let s = 0;
    for (let i = t * tramo; i < (t + 1) * tramo; i++) {
      let v = 0;
      for (const c of canales) v += c[i];
      v /= canales.length;
      s += v * v;
    }
    energia[t] = Math.sqrt(s / tramo);
  }
  const mediana = Float32Array.from(energia).sort()[Math.floor(cuantos / 2)];
  const techo = mediana * 2.25;
  const ganancia = new Float32Array(cuantos);
  for (let t = 0; t < cuantos; t++) ganancia[t] = energia[t] > techo ? techo / energia[t] : 1;
  // Anticipación: el mínimo de ±2 tramos. Y suavizado: media de ±2 tramos.
  const anticipada = ganancia.map((_, t) => {
    let m = 1;
    for (let k = -2; k <= 2; k++) m = Math.min(m, ganancia[Math.min(cuantos - 1, Math.max(0, t + k))]);
    return m;
  });
  const suave = anticipada.map((_, t) => {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += anticipada[Math.min(cuantos - 1, Math.max(0, t + k))];
    return s / 5;
  });
  // Muestra a muestra, entre el centro de un tramo y el del siguiente.
  for (let i = 0; i < buffer.length; i++) {
    const pos = i / tramo - 0.5;
    const a = Math.min(cuantos - 1, Math.max(0, Math.floor(pos)));
    const b = Math.min(cuantos - 1, a + 1);
    const f = Math.min(1, Math.max(0, pos - a));
    const g = suave[a] + (suave[b] - suave[a]) * f;
    if (g >= 0.9999) continue;
    for (const c of canales) c[i] *= g;
  }
}

/** Devuelve el mismo audio con el final fundido sobre el principio. */
function empalmar(ctx: AudioContext, crudo: AudioBuffer): AudioBuffer {
  const cruce = Math.min(Math.round(EMPALME * crudo.sampleRate), Math.floor(crudo.length / 3));
  const largo = crudo.length - cruce;
  const salida = ctx.createBuffer(crudo.numberOfChannels, largo, crudo.sampleRate);
  for (let c = 0; c < crudo.numberOfChannels; c++) {
    const dentro = crudo.getChannelData(c);
    const fuera = salida.getChannelData(c);
    fuera.set(dentro.subarray(0, largo));
    for (let i = 0; i < cruce; i++) {
      // Potencia constante: con un fundido lineal, en mitad del cruce las dos
      // señales suman menos energía que cada una por su lado y el ambiente se
      // ahueca justo en la costura.
      const paso = i / cruce;
      fuera[i] = dentro[i] * Math.sqrt(paso) + dentro[largo + i] * Math.sqrt(1 - paso);
    }
  }
  return salida;
}

/**
 * Va bajando y preparando el ambiente sin sonar todavía.
 *
 * ─── POR QUÉ HACE FALTA ───────────────────────────────────────────────────
 *
 * Porque descargar millón y medio de bytes y decodificar sesenta y ocho
 * segundos de MP3 lleva unos segundos, y si eso empieza cuando arranca el
 * turno, el local entra mudo y se enciende tarde. Llamándolo al montar el
 * nivel —que tarda lo suyo con quince megas de modelo—, para cuando el
 * jugador cierra la tarjeta de jefatura el audio ya está listo y entra a
 * tiempo.
 *
 * No suena nada ni hace falta que el navegador esté desbloqueado: decodificar
 * se puede con el contexto dormido.
 */
export function precargarAmbienteSala(cual: AmbienteSala = "supermercado"): void {
  void cargarSala(cual);
}

/**
 * Arranca el ambiente de la sala, entrando poco a poco. Llamarlo dos veces no
 * lo apila.
 */
export function iniciarAmbienteSala(cual: AmbienteSala = "supermercado"): void {
  if (!desbloqueado || silenciado || sala || arrancandoSala) return;
  arrancandoSala = true;
  ambienteActual = cual;
  void (async () => {
    const buffer = await cargarSala(cual);
    const ctx = obtenerContexto();
    arrancandoSala = false;
    // Entre la descarga y aquí el jugador ha podido salirse del nivel o
    // silenciar: entonces ya no hay nada que arrancar.
    if (!buffer || !ctx || sala || silenciado) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0;
    fuente.connect(ganancia);
    ganancia.connect(ctx.destination);
    fuente.start();
    sala = { fuente, ganancia };
    // Entra en dos segundos: la sala no se enciende de golpe al abrir la
    // puerta, y así tampoco pisa la tarjeta del inicio del turno.
    ponerNivelSala(2);
  })();
}

/** Baja el ambiente mientras el turno está en pausa, y lo devuelve al salir. */
export function agacharAmbienteSala(agachado: boolean): void {
  salaAgachada = agachado;
  ponerNivelSala(0.35);
  ponerNivelTono(0.35);
}

/**
 * La sala se calla de golpe: nadie habla, nadie se mueve.
 *
 * Las voces y los ruidos del local se cortan en un tercio de segundo, y lo que
 * queda es el zumbido del edificio —la ventilación, las luces—, bajo. Sin él
 * el corte sería silencio digital, que no existe en ninguna sala y se lee como
 * que se rompió el audio.
 *
 * El zumbido se genera aquí: ruido filtrado hacia los graves, en bucle de tres
 * segundos. No hace falta ningún archivo para eso.
 */
export function cortarAmbienteSala(): void {
  salaCallada = true;
  ponerNivelSala(0.3);
  arrancarTono();
}

/** Lo contrario: la sala vuelve a sonar, entrando en esos segundos. */
export function devolverAmbienteSala(segundos = 3): void {
  salaCallada = false;
  ponerNivelSala(segundos);
  ponerNivelTono(segundos);
}

/** Nivel del zumbido: solo con la sala callada. */
function nivelTono(): number {
  return salaCallada ? 0.02 * volumenGeneral * (salaAgachada ? AGACHADO : 1) : 0;
}

function ponerNivelTono(segundos: number): void {
  if (!tono || !contexto) return;
  const ahora = contexto.currentTime;
  tono.ganancia.gain.cancelScheduledValues(ahora);
  tono.ganancia.gain.setValueAtTime(tono.ganancia.gain.value, ahora);
  tono.ganancia.gain.linearRampToValueAtTime(nivelTono(), ahora + segundos);
}

function arrancarTono(): void {
  if (!desbloqueado || silenciado) return;
  const ctx = obtenerContexto();
  if (!ctx) return;
  if (!tono) {
    const largo = Math.round(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    // Ruido rojo: blanco integrado con fuga, que deja casi solo los graves.
    let v = 0;
    for (let i = 0; i < largo; i++) {
      v = v * 0.985 + (Math.random() * 2 - 1) * 0.12;
      datos[i] = v;
    }
    // Empalme de medio segundo, como el del ambiente: sin chasquido al volver.
    const cruce = Math.round(ctx.sampleRate * 0.5);
    for (let i = 0; i < cruce; i++) {
      const p = i / cruce;
      datos[i] = datos[i] * Math.sqrt(p) + datos[largo - cruce + i] * Math.sqrt(1 - p);
    }
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    fuente.loopEnd = (largo - cruce) / ctx.sampleRate;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0;
    fuente.connect(ganancia);
    ganancia.connect(ctx.destination);
    fuente.start();
    tono = { fuente, ganancia };
  }
  ponerNivelTono(1.2);
}

/** Corta el ambiente de la sala con un fundido corto. */
export function detenerAmbienteSala(): void {
  // El zumbido también, si estaba.
  const zumbido = tono;
  tono = null;
  salaCallada = false;
  if (zumbido && contexto) {
    const ahora = contexto.currentTime;
    zumbido.ganancia.gain.cancelScheduledValues(ahora);
    zumbido.ganancia.gain.setValueAtTime(zumbido.ganancia.gain.value, ahora);
    zumbido.ganancia.gain.linearRampToValueAtTime(0, ahora + 0.6);
    zumbido.fuente.stop(ahora + 0.65);
  }
  const actual = sala;
  sala = null;
  salaAgachada = false;
  if (!actual || !contexto) return;
  const ahora = contexto.currentTime;
  actual.ganancia.gain.cancelScheduledValues(ahora);
  actual.ganancia.gain.setValueAtTime(actual.ganancia.gain.value, ahora);
  actual.ganancia.gain.linearRampToValueAtTime(0, ahora + 0.8);
  // Se para DESPUÉS del fundido: pararlo en seco es el mismo chasquido que se
  // evitó en el empalme.
  actual.fuente.stop(ahora + 0.85);
}

// ===========================================================================
// Las pisadas de quien corre
// ===========================================================================
//
// Antes, cuando los del asalto salían corriendo, sonaba de una vez una
// grabación de cuatro segundos y medio de gente corriendo. No iba con nada:
// sonaba justo cuando la escena se paraba para preguntar —y seguía encima
// del panel—, después los dos corrían en silencio, y aunque nada se parara,
// la grabación tiene su ritmo y las piernas el suyo.
//
// Ahora cada pisada suena en el cuadro en que el pie toca el suelo (ver
// Figura.pisadas): más fuerte cerca, de su lado —izquierda o derecha— y
// apagada si es fuera, detrás de los vidrios. Se paran con la figura.
//
// ─── DE DÓNDE SALEN ───────────────────────────────────────────────────────
//
// De esa misma grabación, cortada al cargar: se buscan los golpes que
// sobresalen de la mediana, se quedan los más fuertes que no traen otro
// pegado detrás, y de cada uno se guardan 170 ms, el ataque entero y la cola
// fundida. Igualados en pico, para que ninguno salte sobre los demás. Se
// alternan, cada uno con un punto de tono distinto: el mismo golpe repetido
// se reconoce enseguida como una máquina.

const ARCHIVO_PISADAS = "pasos-corriendo.wav";
/** Una pisada a un par de metros suena a lo que sonaba la grabación entera. */
const VOLUMEN_PISADA = 0.55;
/** Los tonos, en orden: fijos, como todo en el nivel. */
const TONOS_PISADA = [1, 0.95, 1.04, 0.98, 1.06, 0.93, 1.02];
let cargaPisadas: Promise<void> | null = null;
let cortesPisada: AudioBuffer[] | null = null;
let siguientePisada = 0;

export interface Pisada {
  /** De 0 a 1: ya con la distancia y lo fuerte que pisa, lo calcula quien pisa. */
  volumen: number;
  /** De −1, del todo a la izquierda de quien escucha, a 1, a la derecha. */
  lado: number;
  /** Detrás de los vidrios de la fachada: sin los agudos. */
  fuera: boolean;
}

/** Baja y corta las pisadas sin sonar. Como el ambiente: al montar el nivel. */
export function precargarPisadas(): void {
  if (cargaPisadas) return;
  cargaPisadas = (async () => {
    const ctx = obtenerContexto();
    if (!ctx) return;
    try {
      const respuesta = await fetch(CARPETA + ARCHIVO_PISADAS);
      if (!respuesta.ok) return;
      const cortes = cortarPisadas(ctx, await ctx.decodeAudioData(await respuesta.arrayBuffer()));
      if (cortes.length > 0) cortesPisada = cortes;
    } catch {
      // Sin pisadas se juega igual, como con cualquier efecto que falta.
    }
  })();
}

/** Los golpes sueltos de la grabación, listos para sonar uno a uno. */
function cortarPisadas(ctx: AudioContext, crudo: AudioBuffer): AudioBuffer[] {
  const sr = crudo.sampleRate;
  const datos = crudo.getChannelData(0);
  // La envolvente: el pico de cada tramo de 5 ms.
  const tramo = Math.round(sr * 0.005);
  const cuantos = Math.floor(datos.length / tramo);
  const envolvente = new Float32Array(cuantos);
  for (let t = 0; t < cuantos; t++) {
    let m = 0;
    for (let i = t * tramo; i < (t + 1) * tramo; i++) m = Math.max(m, Math.abs(datos[i]));
    envolvente[t] = m;
  }
  const mediana = Float32Array.from(envolvente).sort()[Math.floor(cuantos / 2)];
  // Golpes: máximos de ±25 ms por encima de tres veces la mediana, y con al
  // menos 120 ms entre uno y el siguiente.
  const golpes: { t: number; pico: number }[] = [];
  for (let t = 5; t < cuantos - 5; t++) {
    const v = envolvente[t];
    if (v < mediana * 3) continue;
    let mayor = true;
    for (let k = -5; k <= 5 && mayor; k++) mayor = envolvente[t + k] <= v;
    if (!mayor) continue;
    if (golpes.length > 0 && t - golpes[golpes.length - 1].t < 24) continue;
    golpes.push({ t, pico: v });
  }
  // Los que no tienen otro golpe dentro de sus 170 ms y que caen limpios: de
  // los 60 ms en adelante nada pasa del 40 % del golpe. Sin eso se colaban
  // cortes con otra pisada más floja dentro —que el igualado de volumen, al
  // subirlos, dejaba oír como un doble golpe— o con el ruido de fondo alto.
  // Y con fuerza: uno flojo, igualado a los demás, sube su ruido con él.
  // De los que quedan, los ocho más fuertes. En esta grabación, cinco.
  const limpio = (g: { t: number; pico: number }): boolean => {
    if (g.pico < mediana * 5) return false;
    let resto = 0;
    for (let t = g.t + 12; t < Math.min(cuantos, g.t + 34); t++) resto = Math.max(resto, envolvente[t]);
    return resto < g.pico * 0.4;
  };
  const elegidos = golpes
    .filter((g, i) => (i + 1 >= golpes.length || golpes[i + 1].t - g.t > 34) && limpio(g))
    .sort((a, b) => b.pico - a.pico)
    .slice(0, 8);
  if (elegidos.length === 0) return [];
  const picoComun = elegidos.map((g) => g.pico).sort((a, b) => a - b)[Math.floor(elegidos.length / 2)];
  const LARGO = Math.round(sr * 0.17);
  const ENTRADA = Math.round(sr * 0.002);
  const SALIDA = Math.round(sr * 0.07);
  return elegidos.map((g) => {
    // El arranque del golpe: hacia atrás mientras la envolvente siga por
    // encima de un cuarto del pico, hasta 30 ms.
    let inicio = g.t;
    while (inicio > Math.max(1, g.t - 6) && envolvente[inicio - 1] > g.pico * 0.25) inicio -= 1;
    const desde = Math.max(0, inicio * tramo - Math.round(sr * 0.003));
    const largo = Math.min(LARGO, datos.length - desde);
    const corte = ctx.createBuffer(1, largo, sr);
    const salida = corte.getChannelData(0);
    const escala = picoComun / g.pico;
    for (let i = 0; i < largo; i++) {
      let f = i < ENTRADA ? i / ENTRADA : 1;
      const cola = i - (largo - SALIDA);
      if (cola > 0) f = Math.min(f, 0.5 + 0.5 * Math.cos((Math.PI * cola) / SALIDA));
      salida[i] = datos[desde + i] * escala * f;
    }
    return corte;
  });
}

/** Suena una pisada, ya. Si todavía no están cortadas, no suena nada. */
export function pisada(p: Pisada): void {
  if (!desbloqueado || silenciado) return;
  if (!cortesPisada || !contexto) {
    precargarPisadas();
    return;
  }
  const ctx = contexto;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  const k = siguientePisada;
  siguientePisada += 1;
  const fuente = ctx.createBufferSource();
  fuente.buffer = cortesPisada[k % cortesPisada.length];
  fuente.playbackRate.value = TONOS_PISADA[k % TONOS_PISADA.length];
  const ganancia = ctx.createGain();
  ganancia.gain.value = VOLUMEN_PISADA * volumenGeneral * Math.min(1, Math.max(0, p.volumen));
  const lado = ctx.createStereoPanner();
  lado.pan.value = Math.min(0.85, Math.max(-0.85, p.lado));
  if (p.fuera) {
    const vidrio = ctx.createBiquadFilter();
    vidrio.type = "lowpass";
    vidrio.frequency.value = 1100;
    fuente.connect(vidrio);
    vidrio.connect(ganancia);
  } else {
    fuente.connect(ganancia);
  }
  ganancia.connect(lado);
  lado.connect(ctx.destination);
  fuente.start();
}