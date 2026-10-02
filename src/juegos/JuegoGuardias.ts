import { Scene } from "@babylonjs/core";
import { mostrarMenuPrincipal, type NivelMenuInfo } from "../ui/MainMenu";
import { mostrarRankingCurso } from "../ui/RankingScreen";
import { mostrarCertificado } from "../ui/CertificateScreen";
import { CERTIFICADO_GUARDIAS } from "../core/Certificate";
import { GameManager } from "../core/GameManager";
import { CURSO_GUARDIAS } from "../portal/CursosJugables";
import { escucharTurnos, historialDe, estaAprobado } from "./guardias/HistorialTurnos";
import { cargarConPantalla, type BriefingCarga } from "../ui/PantallaCarga";
import { crearRecorridoSupermercado, type RecorridoSupermercado } from "./guardias/RecorridoSupermercado";
import { DURACION_TURNO, horaDelTurno, MINUTOS_RONDA_EN_RELOJ } from "./guardias/TurnoSupermercado";
import { crearPuestoConserjeria } from "./guardias/PuestoConserjeria";
import { crearPuestoBanco, type PuestoBanco } from "./guardias/PuestoBanco";
import { horaDe } from "./guardias/LibroNovedades";
import { INICIO_TURNO as INICIO_TURNO_BANCO, FIN_ATENCION as FIN_ATENCION_BANCO } from "./guardias/TurnoBanco";

// ===========================================================================
// Curso de Guardias de Seguridad
// ===========================================================================
//
// ─── CÓMO QUEDA REGISTRADO ────────────────────────────────────────────────
//
// Como el 5S: cada escenario es una fase del curso en la plataforma. Al
// aprobar uno, su nota va al ranking, su fase al avance de la persona, y con
// los tres se puede emitir el certificado. Todo eso lo guarda la base, así que
// el avance sigue a la persona a cualquier computador.
//
// Los escenarios no saben nada de esto: terminan registrando su turno en el
// historial (ver HistorialTurnos), y este archivo escucha ese registro y avisa
// a la plataforma. El historial del navegador se queda con el detalle —las
// faltas, cada decisión— y sirve de respaldo si la conexión falla.

const BRIEFINGS: Record<number, BriefingCarga> = {
  1: {
    rotulo: "Escenario 01",
    fase: "Condominio",
    traduccion: "Libro de novedades",
    contexto:
      "Turno de 00:00 a 08:00 en la conserjería de Las Araucarias. Todo lo que " +
      "ocurra queda escrito, en orden y con hechos: el libro no admite " +
      "opiniones, no admite borrones, y lo que no se anota es como si no " +
      "hubiera pasado. A las 03:20 pasa el supervisor a revisarlo.",
    color: "#bda079",
  },

  2: {
    rotulo: "Escenario 02",
    fase: "Supermercado",
    traduccion: "Rondas de verificación",
    contexto:
      `Turno de tarde, de ${horaDelTurno(0)} a ${horaDelTurno(DURACION_TURNO)}, ` +
      "en la sala de ventas. Jefatura solicita una ronda de verificación " +
      `cada ${MINUTOS_RONDA_EN_RELOJ} minutos por las cuatro zonas del local: entrada, góndolas, ` +
      "cajas y bodega. Mientras tanto, en la sala pasan cosas: Central te " +
      "avisará por radio dónde mirar, y tú decides qué hacer. No todo lo que " +
      "parece sospechoso lo es.",
    color: "#79a8bd",
  },

  // No anticipa lo que va a pasar: es el turno de cualquier mañana en el
  // acceso de una sucursal. El nivel tiene que llegar sin aviso.
  3: {
    rotulo: "Escenario 03",
    fase: "Banco",
    traduccion: "Puesto de acceso",
    contexto:
      `Turno de mañana, de ${horaDe(INICIO_TURNO_BANCO)} a ${horaDe(FIN_ATENCION_BANCO)}, ` +
      "en el acceso principal de una sucursal bancaria. Es un puesto fijo: " +
      "desde la puerta se vigila el ingreso y el hall entero, con la fila, " +
      "las sillas de espera y las cajas. No hay rondas que hacer; el trabajo " +
      "es estar y mirar.",
    color: "#8ba6c9",
  },
};

const ENCABEZADO = {
  titulo: "Guardias de Seguridad",
  bajada: "Formación y perfeccionamiento · manual de apoyo OS10",
  // El menú cuenta "escenarios", no "fases": así le habla el curso a quien lo hace.
  unidad: { una: "escenario", varias: "escenarios" },
};

const ESCENARIOS: readonly NivelMenuInfo[] = [
  { numero: 1, nombre: "CONDOMINIO - Libro de novedades", desbloqueado: true, completado: false },
  { numero: 2, nombre: "SUPERMERCADO - Rondas de verificación", desbloqueado: false, completado: false },
  { numero: 3, nombre: "BANCO - Puesto de acceso", desbloqueado: false, completado: false },
];

/** Los escenarios del curso: son sus fases en la plataforma. */
const TOTAL_ESCENARIOS = ESCENARIOS.length;

/**
 * ─── TODOS LOS ESCENARIOS ABIERTOS — SOLO AL PROBAR ─────────────────────
 *
 * El curso se abre en orden: el supermercado al aprobar el condominio, y el
 * banco al aprobar el supermercado. Mientras se construye, eso obligaría a
 * jugar dos turnos enteros antes de llegar al banco.
 *
 * En `npm run dev`, con esto en true, los tres están abiertos. En la versión
 * publicada (`npm run build`) import.meta.env.DEV es false: el curso se abre
 * siempre en orden, aunque esto se quede en true. Para ver el desbloqueo en
 * dev, cambiar el `true` por `false`.
 */
const ESCENARIOS_ABIERTOS = import.meta.env.DEV && true;

/** Quien juega. */
export interface JugadorGuardias {
  /** El id de su perfil: con él se guarda todo, en el navegador y en la base. */
  id: string;
  /** Su nombre, para la cabecera del menú. */
  nombre: string;
}

export interface OpcionesCursoGuardias {
  /** Null solo sin sesión, en pruebas: el avance queda entonces en este navegador. */
  jugador: JugadorGuardias | null;
  volverAlPortal: () => void;
  /**
   * Sube a la plataforma un escenario aprobado: su fase al avance, su nota al
   * ranking y, con los tres, el derecho al certificado. Ver main.ts.
   */
  registrarAprobado: (escenario: number, nota: number, segundos: number) => void;
}

/**
 * Con quién se guarda el historial de este navegador: la cuenta, no el
 * nombre. Dos personas con el mismo nombre en el mismo computador no
 * comparten avance, y cambiarse el nombre en Mi cuenta no lo borra.
 */
function claveDe(jugador: JugadorGuardias | null): string {
  return jugador?.id ?? "invitado";
}

/**
 * Si un escenario está aprobado.
 *
 * Con sesión manda la plataforma: el GameManager trae el avance guardado en la
 * base al abrir el curso (ver iniciarCursoDelJugador en main.ts) y suma lo
 * que se aprueba en esta visita. Sin sesión, el historial del navegador.
 */
function estaAprobadoEl(gameManager: GameManager, jugador: JugadorGuardias | null, numero: number): boolean {
  return jugador ? gameManager.estaCompletado(numero) : estaAprobado(claveDe(null), numero);
}

/**
 * Escucha los turnos que registran los escenarios y avisa a la plataforma de
 * cada aprobado.
 *
 * También se avisa al repetir un escenario ya aprobado: la base se queda con
 * el mejor intento, así que repetir solo puede subir el puntaje del ranking.
 */
function escucharAprobados(gameManager: GameManager, opciones: OpcionesCursoGuardias): void {
  const clave = claveDe(opciones.jugador);
  escucharTurnos((turno) => {
    if (turno.curso !== "guardias" || turno.usuario !== clave || !turno.aprobado) return;
    gameManager.completarNivel(turno.escenario);
    if (opciones.jugador) opciones.registrarAprobado(turno.escenario, turno.nota, turno.duracionSegundos);
  });
}

/**
 * Sube lo que quedó aprobado en este navegador y no está en la plataforma.
 *
 * Pasa si la conexión se cortó justo al terminar un turno: el historial lo
 * guardó, pero el aviso al servidor falló las tres veces. La próxima vez que
 * se abre el curso, el avance de la base no lo trae, y aquí se reenvía, con el
 * mejor intento aprobado de ese escenario.
 */
function subirPendientes(gameManager: GameManager, opciones: OpcionesCursoGuardias): void {
  const { jugador } = opciones;
  if (!jugador) return;
  for (let numero = 1; numero <= TOTAL_ESCENARIOS; numero++) {
    if (gameManager.estaCompletado(numero)) continue;
    const mejor = historialDe(jugador.id, numero)
      .filter((t) => t.aprobado && t.curso === "guardias")
      .sort((a, b) => b.nota - a.nota)[0];
    if (!mejor) continue;
    gameManager.completarNivel(numero);
    opciones.registrarAprobado(numero, mejor.nota, mejor.duracionSegundos);
  }
}

export function abrirMenuGuardias(scene: Scene, opciones: OpcionesCursoGuardias): void {
  const gameManager = GameManager.getInstance();
  const { jugador } = opciones;
  const quienJuega = claveDe(jugador);
  const volverAlMenu = (): void => abrirMenuGuardias(scene, opciones);

  escucharAprobados(gameManager, opciones);
  subirPendientes(gameManager, opciones);

  const aprobadoEl = (numero: number): boolean => estaAprobadoEl(gameManager, jugador, numero);
  const escenarios = ESCENARIOS.map((e) => ({
    ...e,
    completado: aprobadoEl(e.numero),
    // En orden: cada uno se abre al aprobar el anterior. Uno ya aprobado
    // queda abierto siempre, para poder repetirlo y mejorar su puntaje.
    desbloqueado:
      ESCENARIOS_ABIERTOS || e.numero === 1 || aprobadoEl(e.numero) || aprobadoEl(e.numero - 1),
  }));
  const aprobados = escenarios.filter((e) => e.completado).length;

  mostrarMenuPrincipal(
    scene,
    escenarios,
    // El menú da el certificado por listo al 100 %: con los tres aprobados.
    Math.round((aprobados / TOTAL_ESCENARIOS) * 100),

    (numero) => {
      // =========================================================
      // ESCENARIO 1
      // =========================================================
      if (numero === 1) {
        void cargarConPantalla(
          numero,
          async () => {
            crearPuestoConserjeria(scene, quienJuega, volverAlMenu);

            const TOPE_MS = 8000;
            await Promise.race([
              scene.whenReadyAsync(true),
              new Promise<void>((listo) => setTimeout(listo, TOPE_MS)),
            ]);
          },
          BRIEFINGS[numero]
        );
        return;
      }

      // =========================================================
      // ESCENARIO 2
      // =========================================================
      if (numero === 2) {
        // Montar el turno, con su pantalla de carga.
        //
        // Va en una función con nombre porque se llama dos veces: al entrar
        // desde el menú y cuando el jugador pide REPETIR desde la pantalla de
        // la nota. Repitiendo no se pasa por el menú —el recorrido ya se
        // desmontó solo, ver salir()— y se ahorra el viaje de ida y vuelta.
        const montarTurno = (): void => {
          // El turno arranca cuando se levanta la pantalla de carga, no cuando
          // termina de montarse el escenario. Ver comenzar().
          let recorrido: RecorridoSupermercado | null = null;

          void cargarConPantalla(
            numero,
            async () => {
              recorrido = await crearRecorridoSupermercado(
                scene,
                (motivo) => {
                  if (motivo === "repetir") {
                    montarTurno();
                    return;
                  }
                  volverAlMenu();
                },
                // Con quien se guarda el turno en el historial.
                quienJuega
              );

              const TOPE_MS = 10000;
              await Promise.race([
                scene.whenReadyAsync(true),
                new Promise<void>((listo) => setTimeout(listo, TOPE_MS)),
              ]);
            },
            BRIEFINGS[numero]
          ).then(() => recorrido?.comenzar());
        };

        montarTurno();
        return;
      }

      // =========================================================
      // ESCENARIO 3 — BANCO
      // =========================================================
      if (numero === 3) {
        // Como el supermercado: el turno arranca cuando se levanta la
        // pantalla de carga, y "repetir" lo vuelve a montar sin pasar por el
        // menú.
        const montarTurno = (): void => {
          let puesto: PuestoBanco | null = null;

          void cargarConPantalla(
            numero,
            async () => {
              puesto = await crearPuestoBanco(
                scene,
                (motivo) => {
                  if (motivo === "repetir") {
                    montarTurno();
                    return;
                  }
                  volverAlMenu();
                },
                quienJuega
              );

              const TOPE_MS = 10000;
              await Promise.race([
                scene.whenReadyAsync(true),
                new Promise<void>((listo) => setTimeout(listo, TOPE_MS)),
              ]);
            },
            BRIEFINGS[numero]
          ).then(() => puesto?.comenzar());
        };

        montarTurno();
        return;
      }

      volverAlMenu();
    },

    // Certificado. Lo emite la base, que comprueba que estén los tres.
    // El menú vuelve en el tick siguiente, cuando la capa del certificado ya
    // se liberó (ver mostrarRankingCurso en main.ts: dos capas a la vez
    // parpadeaban).
    () =>
      mostrarCertificado(scene, () => setTimeout(volverAlMenu, 0), undefined, {
        cursoId: CURSO_GUARDIAS,
        diseno: CERTIFICADO_GUARDIAS,
        incompleto:
          "La plataforma todavía no tiene los tres escenarios aprobados. Si acabas de aprobar el último, " +
          "vuelve a intentarlo en un momento.",
      }),

    // Ranking del curso de guardias, con sus escenarios como fases.
    () =>
      mostrarRankingCurso(scene, () => setTimeout(volverAlMenu, 0), {
        cursoId: CURSO_GUARDIAS,
        totalFases: TOTAL_ESCENARIOS,
        unidad: "escenarios",
      }),

    jugador?.nombre,

    () => {
      // Fuera del curso nadie más registra turnos de guardias: se deja de
      // escuchar, para no avisar con las opciones de esta visita.
      escucharTurnos(null);
      opciones.volverAlPortal();
    },

    ENCABEZADO
  );
}
