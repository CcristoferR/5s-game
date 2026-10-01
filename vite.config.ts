import { defineConfig } from "vite";

// ===========================================================================
// Dónde vive la plataforma publicada
// ===========================================================================
//
// En classplay.cl la plataforma va en /ingreso/: la raíz del dominio es para
// la página de inicio. `base` hace que la versión publicada pida todo desde
// /ingreso/ —el código, los modelos, el audio— y no desde la raíz.
//
// Solo al compilar y en `npm run preview`, que muestra lo compilado:
// `npm run dev` sigue sirviendo en la raíz (localhost:5173/), como siempre.
//
// Si cambia la carpeta, cambia también CARPETA_EN_EL_SERVIDOR en
// scripts/empaquetar.mjs, que es la que arma el zip para cPanel.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/ingreso/" : "/",
}));
