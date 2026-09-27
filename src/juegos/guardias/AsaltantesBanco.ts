import { Color3 } from "@babylonjs/core";
import type { OpcionesFigura } from "./Figura";

// ===========================================================================
// Los dos sujetos del asalto
// ===========================================================================
//
// Distintos de un vistazo, y a propósito por lo que se ve primero de una
// persona: la contextura, la altura y la silueta de la ropa. El que controla
// la sala es grueso, alto y oscuro, con el gorro de lana; el que va a la caja,
// delgado, más bajo y claro, con la capucha puesta y el bolso negro. Un
// testigo que los miró puede describir a cada uno por separado sin mezclarlos.
//
// Ningún cliente del banco lleva lo que llevan ellos (ver el reparto en
// GenteBanco): si alguien del hall se les pareciera, la descripción de la
// declaración dejaría de servir para distinguirlos.
//
// Todo lo que se va a poder preguntar de ellos está aquí y en ningún otro
// sitio: la ropa, la altura, la contextura, el arma y el bolso.

/**
 * El sujeto 1: el que entra primero, grita y controla la sala.
 *
 * Contextura gruesa, chaqueta oscura cerrada, gorro de lana negro y jeans
 * oscuros; alrededor de 1,75. El arma en la derecha. Es exactamente la
 * descripción que un testigo atento puede dar —"contextura gruesa, chaqueta
 * oscura, gorro de lana negro, aproximadamente 1,75"—, sin nada que haya que
 * suponer.
 */
export const SUJETO_1: Pick<OpcionesFigura, "paleta" | "altura" | "contextura" | "arma" | "manoDelGesto"> = {
  altura: 1.76,
  contextura: 1.2,
  arma: true,
  // El arma va en la derecha: las órdenes, con la izquierda.
  manoDelGesto: 0,
  paleta: {
    uniforme: new Color3(0.045, 0.05, 0.058),
    pantalon: new Color3(0.07, 0.085, 0.13),
    piel: new Color3(0.44, 0.3, 0.22),
    // El gorro de lana y la cremallera: negros.
    detalle: new Color3(0.018, 0.018, 0.02),
    pelo: new Color3(0.05, 0.04, 0.035),
    peinado: "rapado",
    prenda: "chaqueta",
    gorroLana: true,
    zapato: new Color3(0.035, 0.035, 0.04),
    rasgos: { nariz: 1.12, mandibula: 0.72, ancho: 1.1 },
  },
};

/**
 * El sujeto 2: el que va a la caja con el bolso.
 *
 * Delgado y más bajo, alrededor de 1,68: polerón gris claro con la capucha
 * puesta, jeans azules, zapatillas blancas y un bolso de lona negro en la
 * izquierda.
 */
export const SUJETO_2: Pick<OpcionesFigura, "paleta" | "altura" | "contextura"> = {
  altura: 1.68,
  contextura: 0.9,
  paleta: {
    uniforme: new Color3(0.47, 0.48, 0.5),
    pantalon: new Color3(0.14, 0.2, 0.34),
    piel: new Color3(0.5, 0.35, 0.26),
    detalle: new Color3(0.82, 0.82, 0.8),
    pelo: new Color3(0.07, 0.05, 0.04),
    peinado: "corto",
    prenda: "poleron",
    capuchaPuesta: true,
    accesorio: "bolsoMano",
    zapato: new Color3(0.9, 0.9, 0.88),
    suela: new Color3(0.94, 0.94, 0.92),
    rasgos: { nariz: 0.95, mandibula: 1.12, ancho: 0.93 },
  },
};
