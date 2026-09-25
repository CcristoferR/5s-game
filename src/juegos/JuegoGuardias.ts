import { Scene } from "@babylonjs/core";
import {
  mostrarMenuPrincipal,
  type NivelMenuInfo,
} from "../ui/MainMenu";
import { GameManager } from "../core/GameManager";
import {
  estaAprobado,
} from "./guardias/HistorialTurnos";
import {
  cargarConPantalla,
  type BriefingCarga,
} from "../ui/PantallaCarga";
import {
  crearRecorridoSupermercado,
  type RecorridoSupermercado,
} from "./guardias/RecorridoSupermercado";
import {
  DURACION_TURNO,
  horaDelTurno,
  MINUTOS_RONDA_EN_RELOJ,
} from "./guardias/TurnoSupermercado";
import {
  crearPuestoConserjeria,
} from "./guardias/PuestoConserjeria";
import {
  crearPuestoBanco,
  type PuestoBanco,
} from "./guardias/PuestoBanco";
import {
  horaDe,
} from "./guardias/LibroNovedades";
import {
  INICIO_TURNO as INICIO_TURNO_BANCO,
  FIN_ATENCION as FIN_ATENCION_BANCO,
} from "./guardias/TurnoBanco";

// ===========================================================================
// Curso de Guardias de Seguridad
// ===========================================================================

const BRIEFINGS: Record<
  number,
  BriefingCarga
> = {
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
  bajada:
    "Formación y perfeccionamiento · manual de apoyo OS10",
};

const ESCENARIOS: NivelMenuInfo[] = [
  {
    numero: 1,
    nombre:
      "CONDOMINIO - Libro de novedades",
    desbloqueado: true,
    completado: false,
  },

  {
    numero: 2,
    nombre:
      "SUPERMERCADO - Rondas de verificación",
    desbloqueado: false,
    completado: false,
  },

  {
    numero: 3,
    nombre:
      "BANCO - Puesto de acceso",
    desbloqueado: true,
    completado: false,
  },
];

const escenariosCompletados =
  new Set<number>();

void escenariosCompletados;

export function abrirMenuGuardias(
  scene: Scene,
  onVolverAlPortal: () => void,
  usuario?: string
): void {
  const gameManager =
    GameManager.getInstance();

  const quienJuega =
    usuario?.trim() || "invitado";

  const condominioAprobado =
    estaAprobado(
      quienJuega,
      1
    );

  const escenarios =
    ESCENARIOS.map((e) => ({
      ...e,

      completado:
        estaAprobado(
          quienJuega,
          e.numero
        ),

      desbloqueado:
        e.numero === 2
          ? condominioAprobado
          : e.numero === 3
          ? true
          : e.desbloqueado,
    }));

  mostrarMenuPrincipal(
    scene,
    escenarios,
    gameManager.getPorcentajeMadurez(),

    (numero) => {
      // =========================================================
      // ESCENARIO 1
      // =========================================================
      if (numero === 1) {
        void cargarConPantalla(
          numero,

          async () => {
            crearPuestoConserjeria(
              scene,
              quienJuega,

              () => {
                abrirMenuGuardias(
                  scene,
                  onVolverAlPortal,
                  usuario
                );
              }
            );

            const TOPE_MS =
              8000;

            await Promise.race([
              scene.whenReadyAsync(
                true
              ),

              new Promise<void>(
                (listo) =>
                  setTimeout(
                    listo,
                    TOPE_MS
                  )
              ),
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
                  abrirMenuGuardias(
                    scene,
                    onVolverAlPortal,
                    usuario
                  );
                },

                // Con quien se guarda el turno en el historial, como el
                // condominio: es lo que deja marcar el escenario aprobado.
                quienJuega
              );

              const TOPE_MS =
                10000;

              await Promise.race([
                scene.whenReadyAsync(
                  true
                ),

                new Promise<void>(
                  (listo) =>
                    setTimeout(
                      listo,
                      TOPE_MS
                    )
                ),
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
                  abrirMenuGuardias(
                    scene,
                    onVolverAlPortal,
                    usuario
                  );
                },

                quienJuega
              );

              const TOPE_MS =
                10000;

              await Promise.race([
                scene.whenReadyAsync(
                  true
                ),

                new Promise<void>(
                  (listo) =>
                    setTimeout(
                      listo,
                      TOPE_MS
                    )
                ),
              ]);
            },

            BRIEFINGS[numero]
          ).then(() => puesto?.comenzar());
        };

        montarTurno();

        return;
      }

      abrirMenuGuardias(
        scene,
        onVolverAlPortal,
        usuario
      );
    },

    () =>
      onVolverAlPortal(),

    () =>
      onVolverAlPortal(),

    usuario,
    onVolverAlPortal,
    ENCABEZADO
  );
}