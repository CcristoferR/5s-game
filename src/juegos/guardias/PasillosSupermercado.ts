import { Scene, MeshBuilder, Color3 } from "@babylonjs/core";
import { materialPintadoNitido } from "../../entities/ObjetosComunes";
import { materialLiso } from "./UtileriaBodega";

// ===========================================================================
// Los letreros de los pasillos
// ===========================================================================
//
// Un cartel colgado sobre la boca de cada pasillo, del 1 al 5 de izquierda a
// derecha según se entra.
//
// ─── POR QUÉ HACEN FALTA ─────────────────────────────────────────────────
//
// Porque Central y los paneles hablan del "cuarto pasillo" y del "primer
// pasillo", y hasta ahora no había nada en la sala que dijera cuál era cuál.
// Quien ya lo había jugado contaba góndolas; quien no, entraba en cualquiera.
// Un aviso de radio que no se puede seguir no es un aviso.
//
// Y es lo que hay en cualquier supermercado: el número del pasillo colgado a
// la vista desde el pasillo transversal.

/** Los centros de los cinco pasillos, en X. Ver la planta de ClientesSupermercado. */
const PASILLOS_X = [-6.8, -3.73, -0.66, 2.41, 5.48];
/**
 * Lo que se vende en cada uno, para la línea de abajo del cartel.
 *
 * Salen de lo que hay de verdad en esas góndolas —cereales, pastas, latas y
 * leches, que es lo que trae el modelo— repartido como lo reparte cualquier
 * local: lo seco junto, lo líquido junto y la limpieza al final.
 */
const CATEGORIAS = ["ABARROTES", "CONSERVAS", "BEBIDAS", "LÁCTEOS", "LIMPIEZA"];
/** Sobre la boca de los pasillos: el frente de las góndolas está en Z −1,31. */
const LETRERO_Z = -1.2;
/** Por encima de las góndolas, que miden 1,80, y a la vista desde la entrada. */
const LETRERO_Y = 2.5;
const ANCHO = 1.3;
const ALTO = 0.36;

/**
 * @param piso   Altura del suelo de la sala. Ver medirPisoSala: no es cero.
 * @param techo  Hasta dónde suben las varillas de las que cuelga.
 */
export function colgarLetrerosPasillos(scene: Scene, piso: number, techo: number): void {
  const metal = materialLiso(scene, "matVarillaPasillo", new Color3(0.55, 0.56, 0.58), 0.4, 0.6);
  const largoVarilla = Math.max(0.3, techo - (LETRERO_Y + ALTO / 2));

  PASILLOS_X.forEach((x, i) => {
    const numero = i + 1;
    // El verde de la marca, el mismo del uniforme de la cajera.
    //
    // Debajo del número, lo que se vende en ese pasillo. Es la línea que
    // llevan estos carteles en cualquier local, y aquí además hace algo: el
    // jugador que oye "revisa el tercer pasillo" no tiene por qué saber que el
    // tercero es el de las bebidas, pero sí reconoce dónde estuvo antes.
    const material = materialPintadoNitido(scene, `matLetreroPasillo_${numero}`, 390, 108, 2, (ctx, w, h) => {
      ctx.fillStyle = "#2f6b2c";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 5;
      ctx.strokeRect(9, 9, w - 18, h - 18);
      ctx.fillStyle = "#f4f6f2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(h * 0.42)}px system-ui, 'Segoe UI', sans-serif`;
      ctx.fillText(`PASILLO ${numero}`, w / 2, h * 0.41);
      ctx.fillStyle = "rgba(244,246,242,0.82)";
      ctx.font = `600 ${Math.round(h * 0.2)}px system-ui, 'Segoe UI', sans-serif`;
      ctx.letterSpacing = "3px";
      ctx.fillText(CATEGORIAS[i] ?? "", w / 2, h * 0.73);
      ctx.letterSpacing = "0px";
    });

    // Dos caras, una hacia la entrada y otra hacia el fondo: un plano solo se
    // ve de un lado, y del otro saldría el número al revés.
    [Math.PI, 0].forEach((giro, cara) => {
      const letrero = MeshBuilder.CreatePlane(`letreroPasillo_${numero}_${cara}`, { width: ANCHO, height: ALTO }, scene);
      letrero.material = material;
      letrero.rotation.y = giro;
      letrero.position.set(x, piso + LETRERO_Y, LETRERO_Z + (cara === 0 ? 0.006 : -0.006));
      letrero.isPickable = false;
    });

    [-1, 1].forEach((lado) => {
      const varilla = MeshBuilder.CreateCylinder(
        `varillaPasillo_${numero}_${lado}`,
        // Veintidós milímetros y ocho caras: con quince y seis, a seis metros
        // de altura la varilla no llegaba a ocupar un pixel y titilaba al
        // caminar, como pasaba con los cables de las luminarias.
        { height: largoVarilla, diameter: 0.022, tessellation: 8 },
        scene
      );
      varilla.material = metal;
      varilla.position.set(x + lado * (ANCHO / 2 - 0.1), piso + LETRERO_Y + ALTO / 2 + largoVarilla / 2, LETRERO_Z);
      varilla.isPickable = false;
    });
  });
}
