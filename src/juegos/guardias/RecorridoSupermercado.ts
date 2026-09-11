import {
  Scene,
  FreeCamera,
  Vector3,
  Color4,
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import {
  cargarSupermercado,
  iluminarSupermercado,
  ampliarLucesSupermercado,
  type SupermercadoCargado,
} from "./EscenaSupermercado";

// ===========================================================================
// Escenario 2 — Supermercado, modo recorrido
// ===========================================================================
//
// Todavía no es el nivel: es el escenario cargado y recorrible, para poder
// verlo y decidir sobre él.
//
// ─── POR QUÉ ESTO EXISTE ANTES QUE LA MECÁNICA ────────────────────────────
//
// Porque el escenario llegó de Bitplay y hay que comprobarlo antes de montarle
// nada encima: que las texturas carguen, que la escala sea la que dice, que se
// pueda caminar dentro y que la iluminación funcione. Si algo de eso falla y ya
// hubiera lógica de nivel por medio, no habría forma de saber qué está roto.
//
// Es el mismo orden que se siguió con el garaje del 5S: primero entrar y mirar,
// después jugar.
//
// ─── Y POR QUÉ SE CAMINA EN VEZ DE ORBITAR ────────────────────────────────
//
// El escenario 1 tiene la cámara fija en la silla del conserje porque el
// trabajo ocurre en el mesón. Aquí es al revés: lo que hay que evaluar es si
// los pasillos, las góndolas y las alturas funcionan para un guardia que
// recorre la sala. Eso solo se sabe caminándola.

export interface RecorridoSupermercado {
  supermercado: SupermercadoCargado;
  dispose: () => void;
}

/** Altura de los ojos de una persona de pie. */
const ALTURA_OJO = 1.65;

export async function crearRecorridoSupermercado(
  scene: Scene,
  onSalir: () => void
): Promise<RecorridoSupermercado> {
  scene.clearColor = new Color4(0.09, 0.1, 0.13, 1);

  const supermercado = await cargarSupermercado(scene, { diagnostico: true });

  // Los pasillos se reparten a lo largo del fondo de la sala. Se calculan desde
  // las medidas reales y no a ojo: si Bitplay manda una versión más grande, los
  // focos siguen cayendo donde tienen que caer.
  const pasillos = [-0.28, 0, 0.28].map((f) => supermercado.fondo * f);
  iluminarSupermercado(scene, supermercado.alto, pasillos);
  ampliarLucesSupermercado(scene);

  // --- Cámara ---------------------------------------------------------------
  //
  // Entra por el frente de la sala mirando hacia dentro, que es por donde
  // entraría alguien. Empezar en el centro obliga a girarse para entender dónde
  // se está.
  const camara = new FreeCamera(
    "camaraRecorrido",
    new Vector3(0, ALTURA_OJO, -supermercado.fondo / 2 + 1.2),
    scene
  );
  camara.setTarget(new Vector3(0, ALTURA_OJO - 0.15, 0));
  camara.minZ = 0.1;
  camara.speed = 0.14;
  camara.angularSensibility = 3200;
  camara.inertia = 0.82;

  // WASD además de las flechas: es lo que espera cualquiera que haya caminado
  // por un escenario en 3D.
  camara.keysUp.push(87);
  camara.keysDown.push(83);
  camara.keysLeft.push(65);
  camara.keysRight.push(68);

  // El jugador camina, no vuela: la cámara tiene volumen y choca con las
  // góndolas y los muros en vez de atravesarlos.
  scene.collisionsEnabled = true;
  camara.checkCollisions = true;
  camara.applyGravity = false;
  camara.ellipsoid = new Vector3(0.35, ALTURA_OJO / 2, 0.35);
  camara.ellipsoidOffset = new Vector3(0, ALTURA_OJO / 2, 0);

  scene.activeCamera = camara;
  camara.attachControl(true);

  // --- Post-proceso ---------------------------------------------------------
  //
  // Discreto a propósito. En una sala de ventas no hay nada que florezca ni
  // viñeta que valga: el sitio está para que el producto se vea plano y parejo.
  // Lo único que aporta aquí es el suavizado de bordes, porque las góndolas son
  // todo líneas rectas y sin él se ven en escalera.
  const tuberia = new DefaultRenderingPipeline(
    "postProcesoSupermercado",
    true,
    scene,
    [camara]
  );
  tuberia.samples = 4;
  tuberia.bloomEnabled = false;
  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.contrast = 1.04;
  tuberia.imageProcessing.exposure = 1;
  tuberia.imageProcessing.toneMappingEnabled = true;

  // --- Salir ----------------------------------------------------------------
  const alPulsar = (e: KeyboardEvent): void => {
    if (e.key === "Escape") salir();
  };
  window.addEventListener("keydown", alPulsar);

  let cerrado = false;
  const salir = (): void => {
    if (cerrado) return;
    cerrado = true;
    window.removeEventListener("keydown", alPulsar);
    camara.detachControl();
    onSalir();
  };

  const ayuda = document.createElement("div");
  ayuda.textContent = "WASD o flechas para caminar · arrastrar para mirar · ESC para volver";
  Object.assign(ayuda.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    borderRadius: "8px",
    background: "rgba(10, 12, 16, 0.78)",
    color: "#e8ecf4",
    font: "500 13px/1 system-ui, sans-serif",
    letterSpacing: "0.3px",
    pointerEvents: "none",
    zIndex: "40",
  });
  document.body.appendChild(ayuda);

  return {
    supermercado,
    dispose: () => {
      salir();
      ayuda.remove();
      tuberia.dispose();
      camara.dispose();
      supermercado.dispose();
    },
  };
}