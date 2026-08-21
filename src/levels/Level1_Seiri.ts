import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, PointLight } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock, Button, Control } from "@babylonjs/gui";
import { objetosNivel1, type ZonaClasificacion } from "../data/levelConfig";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearDropZone } from "../entities/DropZone";
import { crearAmbienteOficina } from "../entities/OfficeAmbience";
import { crearFormaNivel1 } from "../entities/Level1Shapes";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

const posicionesZonas: Record<ZonaClasificacion, number> = {
  necesario: -2,
  dudoso: 0,
  descartar: 2,
};

const etiquetasZonas: Record<ZonaClasificacion, string> = {
  necesario: "NECESARIO",
  dudoso: "DUDOSO",
  descartar: "DESCARTAR",
};

export function cargarNivel1(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  crearAmbienteOficina(scene);

  const suelo = MeshBuilder.CreateGround("suelo", { width: 10, height: 10 }, scene);
  const matSuelo = new PBRMaterial("matSuelo", scene);
  matSuelo.albedoColor = new Color3(0.55, 0.52, 0.46);
  matSuelo.roughness = 0.45;
  matSuelo.metallic = 0.05;
  suelo.material = matSuelo;
  suelo.receiveShadows = true;

  // Escritorio ampliado: ahora aloja 10 objetos en dos filas, acercándose
  // a lo que pide la guía ("decenas de objetos"), no solo 4-5 sueltos.
  const escritorio = MeshBuilder.CreateBox("escritorio", { width: 3.6, height: 0.1, depth: 1.4 }, scene);
  escritorio.position.set(0, 0.85, -0.5);
  const matEscritorio = new PBRMaterial("matEscritorio", scene);
  matEscritorio.albedoColor = new Color3(0.4, 0.28, 0.18);
  matEscritorio.roughness = 0.5;
  escritorio.material = matEscritorio;
  escritorio.receiveShadows = true;

  crearLamparaDeMesa(scene);
  crearSenalTarjetaRoja(scene, posicionesZonas.dudoso);

  const objetos = objetosNivel1.map((datos) => crearObjetoInteractable(scene, datos, crearFormaNivel1));

  const zonaNecesario = crearDropZone(scene, "necesario", posicionesZonas.necesario, new Color3(0.2, 0.7, 0.3), gui, etiquetasZonas.necesario);
  const zonaDudoso = crearDropZone(scene, "dudoso", posicionesZonas.dudoso, new Color3(0.85, 0.7, 0.15), gui, etiquetasZonas.dudoso);
  const zonaDescartar = crearDropZone(scene, "descartar", posicionesZonas.descartar, new Color3(0.75, 0.2, 0.2), gui, etiquetasZonas.descartar);

  mostrarMicroLeccionTarjetaRoja(gui);

  const inicioNivel = performance.now();
  let corriendoTiempo = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    const segundos = Math.floor((performance.now() - inicioNivel) / 1000);
    hud.actualizarTiempo(segundos);
  });

  let objetosResueltos = 0;
  const conteoZonas: Record<ZonaClasificacion, number> = { necesario: 0, dudoso: 0, descartar: 0 };

  // Se registra el resultado del PRIMER intento de cada objeto (aunque
  // el nivel deje reintentar después de un error) — esto es lo que
  // permite mostrar al final un "% clasificado correctamente al primer
  // intento" real, tal como pide la guía ("% de objetos correctamente
  // clasificados"), sin tener que bloquear los reintentos que ya tiene
  // el nivel.
  const primerIntentoPorObjeto = new Map<string, boolean>();

  objetos.forEach((objeto) => {
    objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente) return;

      const zonaMasCercana = (Object.entries(posicionesZonas) as [ZonaClasificacion, number][])
        .reduce((mejor, actual) =>
          Math.abs(mesh.position.x - actual[1]) < Math.abs(mesh.position.x - mejor[1]) ? actual : mejor
        )[0];

      const esCorrecto = zonaMasCercana === objeto.datos.zonaCorrecta;

      if (!primerIntentoPorObjeto.has(objeto.datos.id)) {
        primerIntentoPorObjeto.set(objeto.datos.id, esCorrecto);
      }

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
          // Incluye el % que pide la guía de verdad: objetos que quedaron
          // bien clasificados ya en el primer intento (no cuenta los que
          // se corrigieron después de un error).
          const aciertosPrimerIntento = [...primerIntentoPorObjeto.values()].filter(Boolean).length;
          const pctPrimerIntento = Math.round((aciertosPrimerIntento / objetos.length) * 100);

          hud.mostrarFeedback(
            true,
            `¡Clasificación completa! Necesario: ${conteoZonas.necesario} · Dudoso: ${conteoZonas.dudoso} · Descartar: ${conteoZonas.descartar}\n📊 ${pctPrimerIntento}% clasificado correctamente al primer intento (${aciertosPrimerIntento}/${objetos.length})`
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
  base.position.set(-1.9, 0.91, -0.85);
  base.material = matBase;

  const brazo = MeshBuilder.CreateCylinder("lamparaBrazo", { diameter: 0.02, height: 0.5 }, scene);
  brazo.position.set(-1.9, 1.16, -0.85);
  brazo.material = matBase;

  const matPantalla = new PBRMaterial("matLamparaPantalla", scene);
  matPantalla.albedoColor = new Color3(0.9, 0.85, 0.7);
  matPantalla.emissiveColor = new Color3(0.6, 0.5, 0.3);
  matPantalla.roughness = 0.6;

  const pantalla = MeshBuilder.CreateCylinder("lamparaPantalla", { diameterTop: 0.03, diameterBottom: 0.16, height: 0.14 }, scene);
  pantalla.position.set(-1.75, 1.35, -0.75);
  pantalla.rotation.z = -0.5;
  pantalla.material = matPantalla;

  const luz = new PointLight("luzLampara", new Vector3(-1.75, 1.3, -0.7), scene);
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

  const poste = MeshBuilder.CreateCylinder("posteTarjetaRoja", { diameter: 0.03, height: 0.5 }, scene);
  poste.position.set(x, 0.25, 2.15);
  poste.material = matPoste;

  const matTarjeta = new PBRMaterial("matTarjetaRoja", scene);
  matTarjeta.albedoColor = new Color3(0.78, 0.1, 0.1);
  matTarjeta.roughness = 0.35;

  const tarjeta = MeshBuilder.CreatePlane("tarjetaRoja", { width: 0.18, height: 0.24 }, scene);
  tarjeta.position.set(0, 0.17, 0.01);
  tarjeta.rotation.y = 0.3;
  tarjeta.parent = poste;
  tarjeta.material = matTarjeta;
}

// Micro-lección de la guía: explica qué es una tarjeta roja (red tag)
// antes de empezar a clasificar, para que "Dudoso" tenga sentido real y
// no sea solo una tercera categoría genérica.
function mostrarMicroLeccionTarjetaRoja(gui: AdvancedDynamicTexture): void {
  const panel = new Rectangle("microLeccionTarjetaRoja");
  panel.width = "460px";
  panel.height = "220px";
  panel.cornerRadius = 14;
  panel.thickness = 1;
  panel.color = "rgba(255,255,255,0.2)";
  panel.background = "rgba(18, 20, 24, 0.95)";
  panel.zIndex = 25;
  gui.addControl(panel);

  const titulo = new TextBlock("tituloMicroLeccion", "🏷️ ¿Qué es una tarjeta roja?");
  titulo.color = "white";
  titulo.fontSize = 19;
  titulo.top = "-70px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(titulo);

  const texto = new TextBlock(
    "textoMicroLeccion",
    "En la metodología 5S, la zona 'Dudoso' representa objetos que reciben una tarjeta roja física: quedan marcados para revisión, en vez de decidir su destino a la ligera."
  );
  texto.color = "rgba(255,255,255,0.9)";
  texto.fontSize = 14;
  texto.textWrapping = true;
  texto.width = "400px";
  texto.top = "0px";
  texto.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(texto);

  const boton = Button.CreateSimpleButton("btnCerrarMicroLeccion", "Entendido");
  boton.width = "160px";
  boton.height = "42px";
  boton.color = "white";
  boton.cornerRadius = 8;
  boton.thickness = 0;
  boton.background = "#2e7d46";
  boton.top = "-16px";
  boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  boton.onPointerUpObservable.add(() => {
    panel.isVisible = false;
  });
  panel.addControl(boton);
}