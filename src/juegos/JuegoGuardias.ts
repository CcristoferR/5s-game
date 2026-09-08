import { Scene } from "@babylonjs/core";
import { mostrarMenuPrincipal, type NivelMenuInfo } from "../ui/MainMenu";
import { GameManager } from "../core/GameManager";
import { crearPuestoConserjeria } from "./guardias/PuestoConserjeria";

// ===========================================================================
// Curso de Guardias de Seguridad — menú del curso
// ===========================================================================
//
// Primera pieza del segundo curso. Por ahora es solo el menú de escenarios: es
// lo que cierra la tubería. Hasta hace nada, canjear cualquier curso abría el
// galpón del 5S; con esto cada curso abre lo suyo. Que detrás todavía no haya
// un escenario jugable no importa — lo que se estaba probando era que la
// plataforma distinga dos cursos, y eso ya se comprueba entrando.
//
// ─── POR QUÉ REUSA EL MENÚ DEL 5S Y NO TIENE UNO PROPIO ───────────────────
//
// Porque MainMenu.ts nunca fue del 5S. Recibe los niveles como dato desde el
// primer día —`niveles: NivelMenuInfo[]`— y lo único suyo del 5S eran el título
// y la bajada, que ahora se pasan al llamarlo.
//
// Duplicar 800 líneas de menú para cambiar un encabezado dejaría dos pantallas
// que hay que arreglar dos veces cada vez que aparezca un fallo de interfaz. Y
// el jugador que termina el 5S y entra a guardias se encuentra la misma
// pantalla que ya sabe usar, que es lo que se quería.

/** Título y bajada de este curso. */
// Encabezado propio del curso, pendiente de conectar.
//
// mostrarMenuPrincipal todavía no acepta un título/bajada por parámetro: hoy
// muestra los del 5S fijos. Cuando el menú los reciba —es un cambio pequeño en
// MainMenu— este es el texto que va. Se deja anotado para no perderlo.
//
// const ENCABEZADO = {
//   titulo: "Guardias de Seguridad",
//   bajada: "Formación y perfeccionamiento · manual de apoyo OS10",
// };

/**
 * Los escenarios del curso.
 *
 * ─── EL ORDEN ES DELIBERADO ────────────────────────────────────────────────
 *
 * El condominio va PRIMERO, no último. Es donde el manual tiene sustancia —el
 * libro de novedades ocupa tres páginas con formato completo y prohibiciones
 * explícitas: no arrancar hojas, no usar corrector, anular entre paréntesis— y
 * es el único que no depende del contenido legal que el documento no trae.
 * Hurto, robo y flagrancia solo aparecen como preguntas del cuestionario, sin
 * respuesta: sin eso, el supermercado no se puede calificar.
 *
 * El formato del nombre es "TÉRMINO - Traducción", que es el que MainMenu parte
 * en dos para dibujar la tarjeta. El 5S usa "SEIRI - Clasificar"; aquí el
 * término es el sitio y la traducción lo que se evalúa en él.
 */
const ESCENARIOS: NivelMenuInfo[] = [
  {
    numero: 1,
    nombre: "CONDOMINIO - Libro de novedades",
    // Único desbloqueado. Los otros dos se abren cuando existan: un menú que
    // deja entrar a una pantalla vacía es peor que uno que dice que falta.
    desbloqueado: true,
    completado: false,
  },
  {
    numero: 2,
    nombre: "SUPERMERCADO - Prevención y flagrancia",
    desbloqueado: false,
    completado: false,
  },
  {
    numero: 3,
    nombre: "BANCO - Comunicaciones y enlace",
    desbloqueado: false,
    completado: false,
  },
];

/**
 * Escenarios de guardias ya terminados, en esta sesión.
 *
 * ─── POR QUÉ NO USA GameManager ───────────────────────────────────────────
 *
 * Porque GameManager guarda los niveles completados en un único Set de
 * números, sin distinguir de qué curso son. Marcar ahí el escenario 1 de
 * guardias marcaría también el Nivel 1 del 5S: subiría el porcentaje de
 * madurez y acercaría el certificado de un curso que la persona no jugó.
 *
 * Esto es un parche a la espera de que GameManager acepte una clave de curso.
 * Se pierde al recargar, que es mejor que corromper el progreso del otro
 * curso — y mientras haya un solo escenario jugable casi no se nota.
 */
const escenariosCompletados = new Set<number>();

/**
 * Abre el menú del curso.
 *
 * @param scene            Escena ya montada por main.ts. El menú se dibuja
 *                         encima con una capa a pantalla completa, así que le
 *                         da igual qué haya debajo — hoy es el garaje del 5S,
 *                         que queda tapado por el fondo opaco del panel.
 * @param onVolverAlPortal Salir del curso.
 */
export function abrirMenuGuardias(
  scene: Scene,
  onVolverAlPortal: () => void,
  usuario?: string
): void {
  const gameManager = GameManager.getInstance();

  const escenarios = ESCENARIOS.map((e) => ({
    ...e,
    completado: escenariosCompletados.has(e.numero),
  }));

  mostrarMenuPrincipal(
    scene,
    escenarios,
    gameManager.getPorcentajeMadurez(),
    (numero) => {
      // TODAVÍA NO HAY ESCENARIOS. Se avisa y se vuelve al menú.
      //
      // Es a propósito que esto sea un aviso y no una pantalla a medias: un
      // nivel vacío se lee como que el juego está roto, y un aviso se lee como
      // que falta contenido, que es la verdad.
      // El escenario 1 está jugable de punta a punta: se abre el libro
      // haciendo clic sobre él, se recorre el turno de 00:00 a 08:00 y se
      // cierra con el informe del supervisor.
      if (numero === 1) {
        crearPuestoConserjeria(scene, () => {
          escenariosCompletados.add(1);
          abrirMenuGuardias(scene, onVolverAlPortal, usuario);
        });
        return;
      }

      window.alert(
        `El escenario ${numero} todavía está en construcción.\n\n` +
          "El primero en llegar será el del condominio: turno completo desde el " +
          "puesto, con el libro de novedades."
      );
      abrirMenuGuardias(scene, onVolverAlPortal, usuario);
    },
    // Sin certificado ni ranking mientras no haya nada que certificar.
    () => onVolverAlPortal(),
    () => onVolverAlPortal(),
    usuario,
    onVolverAlPortal
  );
}