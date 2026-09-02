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
  | "ambiente";

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
  if (silenciado) detenerAmbiente();
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
  if (silenciado) detenerAmbiente();
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
}