import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3 } from "@babylonjs/core";
import { objetosNivel1, type ZonaClasificacion, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { moverMalla, luegoDe } from "../core/Animacion";
import { crearDropZone } from "../entities/DropZone";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearFormaNivel1 } from "../entities/Level1Shapes";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

// Separacion entre zonas. Se abrio de 2 a 2.7 m porque las zonas ahora miden
// 2.2 m de lado (antes 1.6): a la separacion vieja las demarcaciones quedaban
// pegadas una con otra y no se leian como areas distintas.
const posicionesZonas: Record<ZonaClasificacion, number> = {
  necesario: -2.7,
  dudoso: 0,
  descartar: 2.7,
};

const etiquetasZonas: Record<ZonaClasificacion, string> = {
  necesario: "NECESARIO",
  dudoso: "DUDOSO",
  descartar: "DESCARTAR",
};

export function cargarNivel1(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // ESCENARIO: el garaje real entregado por Bitplay reemplaza a la oficina
  // que antes se generaba por código. La carga es asíncrona: los objetos del
  // nivel se crean igual y el garaje aparece un instante después.
  //
  // A propósito NO se le pasa el shadowGenerator: el garaje tiene techo, y
  // si el techo proyectara la sombra de la luz direccional dejaría todo el
  // interior a oscuras. La luz de adentro la resuelve iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel1] garaje:", error));
  iluminarInteriorGaraje(scene, [
    { z: -0.5, intensidad: 0.9 },
    { z: 2.2, intensidad: 0.7, tinte: new Color3(0.95, 0.96, 1) },
  ]);

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "suelo" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("suelo", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  crearBancoDeTrabajo(scene);

  crearSenalTarjetaRoja(scene, posicionesZonas.dudoso);

  const objetos = objetosNivel1.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel1));

  // Al pasar el cursor por un objeto se muestra su nombre y se lo resalta.
  //
  // Es información necesaria para jugar, no un adorno: el nivel pide clasificar
  // diez objetos, y por buena que sea la forma, alguien que juega por primera
  // vez no puede saber si una caja marrón es 'caja sin etiqueta' o 'chatarra'.
  // Sin el nombre, la decisión se vuelve adivinanza.
  habilitarEtiquetasAlPasar(
    scene,
    gui,
    objetos.map((objeto) => ({ mesh: objeto.mesh, texto: objeto.datos.nombreVisible }))
  );

  const zonaNecesario = crearDropZone(scene, "necesario", posicionesZonas.necesario, new Color3(0.2, 0.7, 0.3), gui, etiquetasZonas.necesario);
  const zonaDudoso = crearDropZone(scene, "dudoso", posicionesZonas.dudoso, new Color3(0.85, 0.7, 0.15), gui, etiquetasZonas.dudoso);
  const zonaDescartar = crearDropZone(scene, "descartar", posicionesZonas.descartar, new Color3(0.75, 0.2, 0.2), gui, etiquetasZonas.descartar);

  // APERTURA DEL NIVEL
  //
  // Primero se plantea la situación y la decisión a resolver, después el
  // concepto de la fase, y recién al cerrar todo eso empieza a correr el
  // nivel. Por eso el cronómetro arranca en false y se reinicia dentro de
  // arrancarNivel: si contara desde la carga, el tiempo de lectura entraría
  // en el puntaje y leer el contexto saldría caro.
  let inicioNivel = performance.now();
  let corriendoTiempo = false;

  function arrancarNivel(): void {
    inicioNivel = performance.now();
    corriendoTiempo = true;
  }

  mostrarAperturaNivel(
    scene,
    1,
    briefingsNiveles[1],
    microLeccionesNiveles[1],
    arrancarNivel
  );

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let objetosResueltos = 0;
  const conteoZonas: Record<ZonaClasificacion, number> = { necesario: 0, dudoso: 0, descartar: 0 };

  // Z de las zonas de piso y medio lado util, definidos en DropZone.
  const Z_ZONA = 2.4;
  const MEDIO_LADO_UTIL = 0.62;

  /**
   * Lugar donde se apoya el objeto dentro de su zona.
   *
   * Los objetos se acomodan en una grilla en vez de quedar donde cayeron: una
   * zona con cinco objetos amontonados y superpuestos no se lee como un area
   * clasificada, que es justo lo que el nivel quiere ensenar a construir.
   */
  const lugarEnZona = (zona: ZonaClasificacion, indice: number): Vector3 => {
    const columna = indice % 3;
    const fila = Math.floor(indice / 3);
    return new Vector3(
      posicionesZonas[zona] + (columna - 1) * MEDIO_LADO_UTIL,
      0.012,
      Z_ZONA + (fila - 0.5) * MEDIO_LADO_UTIL
    );
  };

  objetos.forEach((objeto) => {
    // Al agarrar otro objeto el jugador ya pasó a lo siguiente: se apaga el
    // mensaje anterior para dejar la pantalla limpia y que el resultado de
    // ESTA acción se lea sin competencia.
    objeto.onAgarrar.add(() => hud.ocultarFeedback());

    objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente) return;

      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaClasificacion, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === objeto.datos.zonaCorrecta;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        // Las partículas brotan del objeto recién soltado, no del centro de la
        // pantalla: así premian ESA decisión y no el hecho de haber hecho algo.
        hud.mostrarFeedback(true, objeto.datos.explicacion, mesh.position.clone());

        // Se fija ANTES de moverlo: mientras viaja a su lugar el objeto ya no
        // debe poder agarrarse, o el jugador lo vuelve a soltar en otra zona y
        // se cuenta dos veces.
        objeto.fijar();
        moverMalla(scene, mesh, lugarEnZona(zonaMasCercana, conteoZonas[objeto.datos.zonaCorrecta]), 320);

        objetosResueltos++;
        conteoZonas[objeto.datos.zonaCorrecta]++;

        if (objetosResueltos === objetos.length) {
          corriendoTiempo = false;
          const segundosTotales = Math.floor((performance.now() - inicioNivel) / 1000);
          // Bonus recalibrado: con 10 objetos (antes 5), completar rápido toma más tiempo real.
          const bonusTiempo = Math.max(0, 90 - segundosTotales);
          gameManager.sumarPuntos(bonusTiempo);
          onCompletado();

          // Resumen de la decisión tomada — refuerza el objetivo pedagógico
          // del nivel (criterio, no intuición) antes de pasar al puntaje.
          hud.mostrarFeedback(
            true,
            `¡Clasificación completa! Necesario: ${conteoZonas.necesario} · Dudoso: ${conteoZonas.dudoso} · Descartar: ${conteoZonas.descartar}`
          );

          luegoDe(scene, 1600, () => {
            // Pregunta de cierre: plantea un caso nuevo y pide aplicar el
            // criterio que el nivel acaba de hacer practicar. El resultado se
            // muestra recién después de responderla.
            preguntarCierreDeNivel(gui, hud, 1, () => {
              luegoDe(scene, 1400, () => {
                hud.mostrarResultadoFinal("Nivel 1", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
              });
            });
          });
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion, mesh.position.clone());

        // Vuelve a su lugar en el banco. Antes se quedaba flotando sobre la
        // zona equivocada a la altura del tablero, y con cada error la escena
        // acumulaba objetos suspendidos en el aire.
        moverMalla(scene, mesh, new Vector3(...objeto.datos.posicionInicial), 300);
      }
    });
  });

  return { objetos, zonas: [zonaNecesario, zonaDudoso, zonaDescartar] };
}

// Señal física de tarjeta roja junto a la zona "Dudoso": conecta el
// concepto de la metodología con algo visible en la escena, no solo
// el nombre del botón.
function crearSenalTarjetaRoja(scene: Scene, x: number): void {
  const matPoste = new PBRMaterial("matPosteTarjetaRoja", scene);
  matPoste.albedoColor = new Color3(0.4, 0.4, 0.42);
  matPoste.roughness = 0.5;
  matPoste.metallic = 0.4;

  const poste = MeshBuilder.CreateCylinder("posteTarjetaRoja", { diameter: 0.035, height: 0.7 }, scene);
  // Justo DELANTE de la zona Dudoso, centrada con ella.
  //
  // Antes iba a x - 1.45, que cae en el pasillo entre Necesario y Dudoso:
  // pegada al borde de la zona verde, parecía pertenecer a esa. La tarjeta
  // roja ES el concepto de Dudoso, así que tiene que leerse junto a ella.
  //
  // Va delante (z menor) y no encima para no chocar con la grilla donde
  // aterrizan los objetos clasificados, que ocupa z entre 2.09 y 2.71.
  poste.position.set(x, 0.35, 1.05);
  poste.material = matPoste;

  const matTarjeta = new PBRMaterial("matTarjetaRoja", scene);
  matTarjeta.albedoColor = new Color3(0.78, 0.1, 0.1);
  matTarjeta.roughness = 0.35;

  const tarjeta = MeshBuilder.CreatePlane("tarjetaRoja", { width: 0.26, height: 0.34 }, scene);
  tarjeta.position.set(0, 0.25, 0.015);
  tarjeta.rotation.y = 0.3;
  tarjeta.parent = poste;
  tarjeta.material = matTarjeta;
}

// Micro-lección de la guía: explica qué es una tarjeta roja (red tag)
// antes de empezar a clasificar, para que "Dudoso" tenga sentido real y
// no sea solo una tercera categoría genérica.