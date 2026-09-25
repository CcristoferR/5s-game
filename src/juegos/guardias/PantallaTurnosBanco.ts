import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Color3,
  type Observer,
} from "@babylonjs/core";
import { reproducir } from "../../core/Sonido";

// ===========================================================================
// La pantalla de turnos
// ===========================================================================
//
// La tele del muro del fondo llegaba sin textura: un rectángulo negro sobre
// las cajas. En una sucursal esa pantalla es la que llama los números, y es
// lo que más dice "banco" de todo el hall: el número grande, la caja a la que
// ir y los últimos llamados debajo. Cuando llama, suena el tin-tón y el número
// nuevo parpadea unos segundos, que es lo que hace que la gente levante la
// vista.

/**
 * La tele, medida en el modelo a escala 3 por sus vértices. La cara más
 * adelantada del marco está en 5,731: la imagen va justo delante, o el marco
 * le tapa un costado al mirarla de lado.
 */
const TELE = { x0: -0.524, x1: 1.824, y0: 3.481, y1: 4.802, z: 5.731 };
/** Lo que se deja de marco alrededor de la imagen. */
const MARCO = 0.055;
/** En la proporción de la imagen, 2,24 por 1,21: si no, la letra sale estirada. */
const ALTO_PX = 720;
const ANCHO_PX = Math.round((ALTO_PX * (TELE.x1 - TELE.x0 - MARCO * 2)) / (TELE.y1 - TELE.y0 - MARCO * 2));

export interface Llamado {
  numero: string;
  caja: number;
}

export interface PantallaTurnos {
  /** Llama un número a una caja: la pantalla cambia, parpadea y suena. */
  llamar(llamado: Llamado): void;
  /** La deja quieta, o la suelta. Para la pausa. */
  congelar(quieta: boolean): void;
  malla: Mesh;
  dispose(): void;
}

export function montarPantallaTurnos(scene: Scene, iniciales: Llamado[]): PantallaTurnos {
  const ancho = TELE.x1 - TELE.x0 - MARCO * 2;
  const alto = TELE.y1 - TELE.y0 - MARCO * 2;
  const malla = MeshBuilder.CreatePlane("pantallaTurnosBanco", { width: ancho, height: alto }, scene);
  // La cara del plano mira a −Z, hacia el hall: tal como sale.
  malla.position.set((TELE.x0 + TELE.x1) / 2, (TELE.y0 + TELE.y1) / 2, TELE.z - 0.003);
  malla.isPickable = false;

  const tex = new DynamicTexture("texPantallaTurnosBanco", { width: ANCHO_PX, height: ALTO_PX }, scene, true);
  tex.hasAlpha = false;
  const mat = new StandardMaterial("matPantallaTurnosBanco", scene);
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  // La imagen es la luz, y nada más: el color emisivo de un material estándar
  // se SUMA a su textura, y con él encendido la pantalla salía en blanco.
  // Por debajo del umbral del resplandor: una pantalla bien regulada se lee,
  // no deslumbra.
  mat.emissiveColor = new Color3(0, 0, 0);
  tex.level = 0.92;
  mat.diffuseColor = new Color3(0, 0, 0);
  mat.specularColor = new Color3(0, 0, 0);
  malla.material = mat;
  malla.freezeWorldMatrix();

  const historial: Llamado[] = iniciales.slice(-4);
  /** Segundos que le quedan al parpadeo del último llamado. */
  let parpadeo = 0;
  let encendidoAntes = true;
  let quieta = false;

  const dibujar = (resaltado: boolean): void => {
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const W = ANCHO_PX;
    const H = ALTO_PX;
    // Fondo: azul noche con un degradado leve, el de cualquier llamador.
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, "#0e2340");
    fondo.addColorStop(1, "#081628");
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, W, H);
    // Cabecera.
    ctx.fillStyle = "#16365f";
    ctx.fillRect(0, 0, W, 104);
    ctx.fillStyle = "#e9eef5";
    ctx.font = "600 44px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("ATENCIÓN EN CAJAS", 48, 54);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9fb4cf";
    ctx.font = "500 34px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Su número · Caja", W - 48, 54);

    const actual = historial[historial.length - 1];
    if (actual) {
      // El llamado de ahora: grande, en un recuadro que se enciende al llamar.
      ctx.fillStyle = resaltado ? "#f2c14e" : "#1d4677";
      ctx.fillRect(48, 140, W - 96, 250);
      ctx.fillStyle = resaltado ? "#0b1a2e" : "#ffffff";
      ctx.textAlign = "left";
      ctx.font = "700 170px system-ui, 'Segoe UI', Arial, sans-serif";
      ctx.fillText(actual.numero, 96, 268);
      ctx.textAlign = "right";
      ctx.font = "600 64px system-ui, 'Segoe UI', Arial, sans-serif";
      ctx.fillText("CAJA", W - 250, 232);
      ctx.font = "700 150px system-ui, 'Segoe UI', Arial, sans-serif";
      ctx.fillText(String(actual.caja), W - 96, 268);
    }
    // Los anteriores, en renglones.
    ctx.font = "500 50px system-ui, 'Segoe UI', Arial, sans-serif";
    historial
      .slice(0, -1)
      .reverse()
      .forEach((l, i) => {
        const y = 470 + i * 78;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.0)";
        ctx.fillRect(48, y - 36, W - 96, 72);
        ctx.fillStyle = "#b9c7da";
        ctx.textAlign = "left";
        ctx.fillText(l.numero, 96, y);
        ctx.textAlign = "right";
        ctx.fillText(`Caja ${l.caja}`, W - 96, y);
      });
    tex.update(true);
  };
  dibujar(false);

  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (quieta || parpadeo <= 0) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    parpadeo = Math.max(0, parpadeo - dt);
    // Tres encendidos de medio segundo y queda fijo, sin resaltar.
    const encendido = parpadeo > 0 && Math.floor(parpadeo / 0.5) % 2 === 1;
    if (encendido !== encendidoAntes) {
      encendidoAntes = encendido;
      dibujar(encendido);
    }
  });

  return {
    malla,
    llamar(llamado) {
      historial.push(llamado);
      while (historial.length > 4) historial.shift();
      parpadeo = 3.0;
      encendidoAntes = true;
      dibujar(true);
      reproducir("turnoBanco");
    },
    congelar(q) {
      quieta = q;
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
    },
  };
}
