import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// ---------------------------------------------------------------------------
// Reglas de análisis del código
// ---------------------------------------------------------------------------
//
// El compilador ya detecta lo que no encaja de tipo. Esto detecta otra clase de
// error: lo que compila perfectamente y aun así está mal.
//
// ─── POR QUÉ NO SE ACTIVA EL CONJUNTO COMPLETO ────────────────────────────
//
// La tentación con una herramienta así es encender todas las reglas
// recomendadas y ponerse a arreglar los cuatrocientos avisos que salen. Es mala
// idea en un proyecto que ya funciona: se toca código que nadie estaba tocando,
// se introducen fallos en niveles que estaban bien, y el aviso útil queda
// enterrado entre trescientos de estilo.
//
// Aquí se encienden solo las reglas que atrapan errores REALES —cosas que
// producen bugs, no cosas feas— y se deja apagado todo lo que es cuestión de
// gusto. Si más adelante alguna regla apagada demuestra valer la pena, se
// enciende una a una y se arregla lo que saque.

export default tseslint.config(
  {
    // El código compilado, las dependencias y los modelos no se analizan.
    ignores: ["dist/**", "node_modules/**", "public/**", "*.config.js"],
  },

  eslint.configs.recommended,

  // Reglas que necesitan conocer los tipos. Son las que valen: sin tipos, el
  // analizador no puede saber que un `await` sobra o que una promesa se soltó.
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // El juego corre en el navegador.
        window: "readonly",
        document: "readonly",
        console: "readonly",
        performance: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLFormElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        crypto: "readonly",
        navigator: "readonly",
        alert: "readonly",
      },
    },

    rules: {
      // --- Errores de verdad ------------------------------------------------

      // Una promesa sin await ni catch es el fallo silencioso por excelencia:
      // la operación falla, nadie se entera y el juego sigue con datos viejos.
      // El código ya usa `void` para marcar las intencionales, así que esta
      // regla distingue las de verdad.
      "@typescript-eslint/no-floating-promises": "error",

      // Pasar una función async donde se espera una síncrona: el error que
      // produce se pierde y el llamador cree que terminó.
      "@typescript-eslint/no-misused-promises": "error",

      // Variables e imports que sobran. Suelen ser el rastro de un cambio a
      // medio terminar. Se permite el prefijo _ para lo deliberado.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // --- Ruido apagado a propósito ---------------------------------------

      // Babylon y Supabase devuelven `any` en varios sitios y no es culpa de
      // este código. Encender esto llenaría la salida de avisos que solo se
      // arreglan poniendo aserciones de tipo, que no hacen el código más
      // seguro: solo callan al analizador.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "off",

      // El código usa plantillas con números y booleanos a propósito, en textos
      // que se muestran en pantalla.
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  }
);