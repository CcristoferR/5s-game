import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, PointLight } from "@babylonjs/core";
import { objetosNivel1, type ZonaClasificacion, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
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

  crearLamparaDeMesa(scene);
  crearSenalTarjetaRoja(scene, posicionesZonas.dudoso);

  const objetos = objetosNivel1.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel1));

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

  objetos.forEach((objeto) => {
    objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente) return;

      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaClasificacion, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === objeto.datos.zonaCorrecta;

      if (esCorrecto) {
        gameManager.sumarPuntos(10);
        hud.mostrarFeedback(true, objeto.datos.explicacion);
        mesh.isPickable = false;
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

          setTimeout(() => {
            hud.mostrarResultadoFinal("Nivel 1", objetosResueltos * 10, bonusTiempo, segundosTotales, onVolverMenu);
          }, 1400);
        }
      } else {
        hud.mostrarFeedback(false, objeto.datos.explicacion);
      }
    });
  });

  return { objetos, zonas: [zonaNecesario, zonaDudoso, zonaDescartar] };
}

// Lámpara de mesa: un punto de luz cálido y localizado sobre los objetos
// — un solo elemento nuevo, pero con impacto real en la iluminación de
// esa zona específica de la escena.
function crearLamparaDeMesa(scene: Scene): void {
  const matBase = new PBRMaterial("matLamparaBase", scene);
  matBase.albedoColor = new Color3(0.15, 0.15, 0.16);
  matBase.roughness = 0.4;
  matBase.metallic = 0.5;

  const base = MeshBuilder.CreateCylinder("lamparaBase", { diameter: 0.14, height: 0.03 }, scene);
  base.position.set(-1.75, 0.96, -0.9);
  base.material = matBase;

  const brazo = MeshBuilder.CreateCylinder("lamparaBrazo", { diameter: 0.02, height: 0.5 }, scene);
  brazo.position.set(-1.75, 1.21, -0.9);
  brazo.material = matBase;

  const matPantalla = new PBRMaterial("matLamparaPantalla", scene);
  matPantalla.albedoColor = new Color3(0.9, 0.85, 0.7);
  matPantalla.emissiveColor = new Color3(0.6, 0.5, 0.3);
  matPantalla.roughness = 0.6;

  const pantalla = MeshBuilder.CreateCylinder("lamparaPantalla", { diameterTop: 0.03, diameterBottom: 0.16, height: 0.14 }, scene);
  pantalla.position.set(-1.6, 1.4, -0.8);
  pantalla.rotation.z = -0.5;
  pantalla.material = matPantalla;

  const luz = new PointLight("luzLampara", new Vector3(-1.6, 1.35, -0.75), scene);
  luz.diffuse = new Color3(1, 0.85, 0.6);
  luz.intensity = 0.35;
  luz.range = 4;
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
  poste.position.set(x - 1.45, 0.35, 2.4);
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