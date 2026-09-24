import { Scene, MeshBuilder, Color3, Vector3 } from "@babylonjs/core";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import { bloque, fundir, materialLiso } from "./UtileriaBodega";

// ===========================================================================
// La puerta de la oficina
// ===========================================================================
//
// ─── POR QUÉ EXISTE ───────────────────────────────────────────────────────
//
// Porque el juego lleva todo el turno hablando de un sitio que no estaba en
// ninguna parte. "Ir hasta la oficina a dar aviso a jefatura", "se le invita a
// la oficina", "el tiempo que tardas en llegar a la oficina": el jugador lee
// la palabra cuatro veces en dos horas y no hay una sola puerta en el local
// que la diga. Un sitio que solo existe en los textos no es un sitio.
//
// Y hacía falta para el remate del hurto. A un detenido se le lleva a la
// oficina, no al almacén — la bodega es "solo personal autorizado" y es donde
// entra la mercadería. Mandarlo para allá era enseñar un procedimiento
// equivocado justo como resultado de la respuesta correcta, que es el peor
// sitio donde equivocarse.
//
// ─── POR QUÉ EN ESE MURO ──────────────────────────────────────────────────
//
// Entre el final del mostrador (Z 5,56) y la fachada (Z 7,11) quedan 1,55 m
// de muro libre en X 9,96, justo detrás de la línea de cajas. Es donde está
// la oficina en cualquier supermercado: pegada a las cajas, porque es donde
// se cuadra el dinero y donde el jefe de turno tiene que poder asomarse.
//
// Y le viene bien al recorrido: el jugador que retiene a alguien en la caja lo
// lleva a tres metros, no cruzando la sala entera.

/** Cara interior del muro del lado de la caja. */
const MURO_X = 9.96;
/** Centro de la puerta, entre el final del mostrador y la fachada. */
const OFICINA_Z = 6.35;
const ANCHO_HOJA = 0.9;
const ALTO_HOJA = 2.05;

export interface Oficina {
  /**
   * Dónde desaparece quien entra: el plano de la puerta.
   *
   * No dentro —no hay dentro, la oficina es una puerta y un muro— sino en el
   * vano mismo. Quien llega ahí ha entrado.
   */
  umbral: Vector3;
  /**
   * Dónde hay que estar para dar por hecho que has llegado a la oficina.
   *
   * Un metro y medio por delante de la hoja. Es lo que hay que pisar para que
   * el detenido que te sigue entre: sin este punto, el jugador tendría que
   * meterse dentro del muro para "llegar".
   */
  llegada: Vector3;
}

/**
 * @param piso  Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 */
export function construirOficina(scene: Scene, piso: number): Oficina {
  const madera = materialLiso(scene, "matHojaOficina", new Color3(0.42, 0.31, 0.22), 0.6);
  const acero = materialLiso(scene, "matMarcoOficina", new Color3(0.62, 0.63, 0.65), 0.4, 0.5);

  const zHoja = MURO_X - 0.03;
  const hoja = fundir(
    [bloque(scene, "hojaOficina", 0.06, ALTO_HOJA, ANCHO_HOJA, zHoja, piso + ALTO_HOJA / 2, OFICINA_Z)],
    "hojaOficina",
    madera
  );

  const jamba = ANCHO_HOJA / 2 + 0.04;
  const marco = fundir(
    [
      bloque(scene, "jambaOficinaA", 0.1, ALTO_HOJA + 0.12, 0.07, MURO_X - 0.05, piso + (ALTO_HOJA + 0.12) / 2, OFICINA_Z - jamba),
      bloque(scene, "jambaOficinaB", 0.1, ALTO_HOJA + 0.12, 0.07, MURO_X - 0.05, piso + (ALTO_HOJA + 0.12) / 2, OFICINA_Z + jamba),
      bloque(scene, "dintelOficina", 0.1, 0.07, ANCHO_HOJA + 0.22, MURO_X - 0.05, piso + ALTO_HOJA + 0.09, OFICINA_Z),
      // La manilla, del lado por el que se abre.
      bloque(scene, "manillaOficina", 0.06, 0.035, 0.13, zHoja - 0.04, piso + 1.02, OFICINA_Z - 0.3),
    ],
    "marcoOficina",
    acero
  );

  const letrero = MeshBuilder.CreatePlane("letreroOficina", { width: 0.52, height: 0.17 }, scene);
  letrero.material = materialPintadoNitido(scene, "matLetreroOficina", 320, 105, 3, (ctx, w, h) => {
    ctx.fillStyle = "#1a1d22";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = "#f2f4f6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 44px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText("OFICINA", w / 2, h * 0.5);
  });
  // Un plano de Babylon mira a −Z; la sala está hacia −X desde este muro, así
  // que hay que girarlo un cuarto de vuelta. Comprobado con la matriz: con
  // rotation.y = +π/2 la normal (0,0,−1) queda en (−1,0,0).
  letrero.rotation.y = Math.PI / 2;
  letrero.position.set(MURO_X - 0.09, piso + ALTO_HOJA + 0.3, OFICINA_Z);
  letrero.isPickable = false;

  [hoja, marco].forEach((malla) => {
    malla.receiveShadows = true;
    // La hoja tiene choque como cualquier muro: la oficina no se puede
    // atravesar, solo mirar.
    malla.checkCollisions = true;
  });

  // La puerta está cerrada y no se abre nunca: ni ella, ni su marco, ni el
  // letrero se mueven en todo el turno, así que Babylon no tiene que
  // recalcularles la matriz de mundo cuadro a cuadro.
  [hoja, marco, letrero].forEach((malla) => malla.freezeWorldMatrix());

  return {
    umbral: new Vector3(MURO_X - 0.25, piso, OFICINA_Z),
    llegada: new Vector3(MURO_X - 1.5, piso, OFICINA_Z),
  };
}
