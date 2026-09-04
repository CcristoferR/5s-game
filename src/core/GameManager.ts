import { Observable } from "@babylonjs/core";

// Lo que el jugador construyó en el Nivel 4 (Seiketsu): los ítems que dejó
// en la zona "checklist" (sin importar si eran correctos o no) y el color
// que asignó a cada zona de señalización. El Nivel 5 usa esto como el
// estándar a auditar — así se cumple lo que pide la guía: "aplica el
// checklist que él mismo ayudó a construir en el Nivel 4".
export interface ItemChecklistConstruido {
  id: string;
  texto: string;
  // true si el ítem realmente correspondía al checklist según la guía
  // (zonaCorrecta === "checklist" en levelConfig). Si el jugador se
  // equivocó en el Nivel 4 y dejó ahí un ítem ambiguo, viaja como false —
  // el Nivel 5 lo usa para explicar por qué ese punto nunca puede "cumplir".
  esValido: boolean;
}

export interface SenalizacionConstruida {
  zonaId: string;
  zonaDescripcion: string;
  colorElegidoId: string;
  esCorrecta: boolean;
}

export interface EstandarNivel4 {
  checklist: ItemChecklistConstruido[];
  senalizacion: SenalizacionConstruida[];
}

export interface ResultadoAuditoriaNivel5 {
  promedioCalificacion: number; // 1-5, promedio real de los puntos de control auditados
  tasaAcierto: number; // 0-1, qué tan bien detectó el jugador cada punto
  aprobado: boolean;
}

// Single source of truth del progreso del jugador: puntaje, nivel actual,
// niveles desbloqueados/completados — y ahora también el estándar que el
// jugador construyó en el Nivel 4 y el resultado de la auditoría del
// Nivel 5, que es lo que conecta ambos niveles y controla si corresponde
// entregar el certificado. Cuando exista login/backend, esto es lo único
// que hay que conectar para guardar el progreso real — el resto del juego
// no cambia.
/**
 * Tarjeta roja tal como la llenó el jugador en el Nivel 1.
 *
 * Se guarda el texto del plazo EXACTAMENTE como se escribió, además de la
 * fecha interpretada. Si alguien puso algo que no es una fecha, el Nivel 5
 * tiene que poder mostrar lo que puso — parte de auditar es encontrar una
 * tarjeta mal llenada.
 */
export interface TarjetaRojaEmitida {
  objetoId: string;
  nombreObjeto: string;
  responsable: string;
  plazoTexto: string;
  /** Fecha interpretada. Null si el texto no era una fecha reconocible. */
  plazo: Date | null;
}

export class GameManager {
  private static instance: GameManager;

  puntaje = 0;
  nivelActual = 1;
  onPuntajeCambiado = new Observable<number>();

  // El 0 es el tutorial: siempre disponible y rejugable, no forma parte de
  // las cinco fases ni suma al porcentaje de madurez.
  private nivelesDesbloqueados = new Set<number>([0, 1]);
  private nivelesCompletados = new Set<number>();
  private readonly totalNiveles = 5;

  /**
   * Tarjetas rojas emitidas en el Nivel 1.
   *
   * Se conservan para el Nivel 5, donde el jugador tiene que AUDITAR su propio
   * trabajo: comprobar si el plazo que él mismo escribió ya venció y el objeto
   * sigue ahí. Video 3.1 (3:29): la tarjeta necesita "un responsable que le
   * haga seguimiento al cumplimiento y control". Ese seguimiento es el
   * ejercicio del Nivel 5.
   *
   * Vive en memoria durante la sesión, igual que el estándar del Nivel 4: no
   * es progreso que haya que guardar en el servidor, es el estado de una
   * partida.
   */
  private tarjetasRojas: TarjetaRojaEmitida[] = [];

  private estandarNivel4: EstandarNivel4 = { checklist: [], senalizacion: [] };
  private resultadoAuditoriaNivel5: ResultadoAuditoriaNivel5 | null = null;

  private constructor() {}

  /** Registra una tarjeta roja al colocarla en el Nivel 1. */
  registrarTarjetaRoja(tarjeta: TarjetaRojaEmitida): void {
    this.tarjetasRojas.push(tarjeta);
  }

  getTarjetasRojas(): TarjetaRojaEmitida[] {
    return [...this.tarjetasRojas];
  }

  /** Se vacía al reiniciar el Nivel 1, para no acumular las de la partida anterior. */
  limpiarTarjetasRojas(): void {
    this.tarjetasRojas = [];
  }

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  sumarPuntos(cantidad: number): void {
    this.puntaje += cantidad;
    this.onPuntajeCambiado.notifyObservers(this.puntaje);
  }

  /**
   * Borra todo el avance en memoria.
   *
   * Se llama al abrir el curso, antes de restaurar el progreso guardado de
   * quien entró. Sin esto, el avance de la persona anterior seguía cargado:
   * en un equipo compartido de planta, el turno siguiente veía niveles
   * desbloqueados que nunca jugó.
   */
  reiniciarTodo(): void {
    this.nivelesDesbloqueados = new Set<number>([0, 1]);
    this.nivelesCompletados = new Set<number>();
    this.puntaje = 0;
  }

  /**
   * Momento en que el jugador empezó a jugar el nivel actual.
   *
   * Se marca cuando termina la apertura, no cuando se carga el nivel: leer el
   * contexto no puede contar como tiempo de juego. Es el mismo criterio con el
   * que cada nivel arranca su propio reloj.
   *
   * Sirve para el desempate del ranking: a igual puntaje, gana quien lo logró
   * en menos tiempo.
   */
  private inicioDelNivel: number | null = null;

  iniciarCronometroNivel(): void {
    this.inicioDelNivel = performance.now();
  }

  /** Segundos jugados en el nivel actual. Cero si todavía no arrancó. */
  segundosDelNivel(): number {
    if (this.inicioDelNivel === null) return 0;
    return Math.max(0, Math.round((performance.now() - this.inicioDelNivel) / 1000));
  }

  reiniciarNivel(): void {
    this.puntaje = 0;
    this.inicioDelNivel = null;
    this.onPuntajeCambiado.notifyObservers(this.puntaje);
  }

  completarNivel(numero: number): void {
    this.nivelesCompletados.add(numero);
    this.nivelesDesbloqueados.add(numero + 1);
  }

  estaDesbloqueado(numero: number): boolean {
    return this.nivelesDesbloqueados.has(numero);
  }

  estaCompletado(numero: number): boolean {
    return this.nivelesCompletados.has(numero);
  }

  // Meta-progresión: qué porcentaje de la "madurez 5S" lleva el jugador,
  // según cuántos de los 5 niveles ya completó. Ojo: el Nivel 5 solo se
  // marca como completado si el jugador APRUEBA la auditoría (ver
  // registrarResultadoAuditoriaN5 y Level5_Shitsuke.ts) — por lo tanto el
  // 100% (y el certificado, que depende de llegar al 100%) ya no se
  // obtiene solo por "jugar" el nivel, sino por auditar bien.
  getPorcentajeMadurez(): number {
    const fases = [...this.nivelesCompletados].filter((numero) => numero >= 1).length;
    return Math.round((fases / this.totalNiveles) * 100);
  }

  guardarEstandarNivel4(estandar: EstandarNivel4): void {
    this.estandarNivel4 = estandar;
  }

  getEstandarNivel4(): EstandarNivel4 {
    return this.estandarNivel4;
  }

  registrarResultadoAuditoriaN5(resultado: ResultadoAuditoriaNivel5): void {
    this.resultadoAuditoriaNivel5 = resultado;
  }

  getResultadoAuditoriaN5(): ResultadoAuditoriaNivel5 | null {
    return this.resultadoAuditoriaNivel5;
  }
}