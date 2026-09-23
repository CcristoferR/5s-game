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
  | "mirada";

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
};

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
 */
const VOLUMEN_SALA = 0.16;
/** Lo que baja cuando el turno se pausa, sin llegar a apagarse. */
const AGACHADO = 0.25;

let contexto: AudioContext | null = null;
let bufferSala: AudioBuffer | null = null;
let cargaSala: Promise<AudioBuffer | null> | null = null;
let sala: { fuente: AudioBufferSourceNode; ganancia: GainNode } | null = null;
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
  return VOLUMEN_SALA * volumenGeneral * (salaAgachada ? AGACHADO : 1);
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
function cargarSala(): Promise<AudioBuffer | null> {
  if (bufferSala) return Promise.resolve(bufferSala);
  if (cargaSala) return cargaSala;
  cargaSala = (async () => {
    const ctx = obtenerContexto();
    if (!ctx) return null;
    try {
      const respuesta = await fetch(CARPETA + "ambiente-supermercado.mp3");
      if (!respuesta.ok) return null;
      bufferSala = empalmar(ctx, await ctx.decodeAudioData(await respuesta.arrayBuffer()));
      return bufferSala;
    } catch {
      // Sin ambiente se juega igual: es lo mismo que hace un efecto que falta.
      return null;
    }
  })();
  return cargaSala;
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
 * Arranca el ambiente de la sala, entrando poco a poco. Llamarlo dos veces no
 * lo apila.
 */
export function iniciarAmbienteSala(): void {
  if (!desbloqueado || silenciado || sala || arrancandoSala) return;
  arrancandoSala = true;
  void (async () => {
    const buffer = await cargarSala();
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
}

/** Corta el ambiente de la sala con un fundido corto. */
export function detenerAmbienteSala(): void {
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