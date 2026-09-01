import { Scene } from "@babylonjs/core";
import {
  crearEstanteriaTaller,
  crearTamboresAceite,
  crearPalletConCajas,
  crearCarroDeLimpieza,
  crearSenalPisoMojado,
  crearTableroHerramientas,
} from "./WorkshopProps";

// ---------------------------------------------------------------------------
// Ambientación por nivel
// ---------------------------------------------------------------------------
//
// El galpón mide 12 x 19 m y los cinco niveles lo comparten. Hasta ahora solo
// el Nivel 3 montaba utilería, así que en el resto se veía un espacio enorme
// con tres muebles al centro: no se leía como un taller en uso.
//
// La cantidad no es pareja a propósito, y ese es el punto: la escena acompaña
// lo que enseña cada S.
//
//   Tutorial  nada.        Se están aprendiendo los controles; cualquier cosa
//                          alrededor compite con la única tarea que hay.
//   Seiri     saturado.    Sobra material por todos lados — es exactamente el
//                          problema que la S viene a resolver.
//   Seiton    ordenado.    Dos estanterías enfrentadas y el tablero de sombras:
//                          un lugar definido para cada cosa.
//   Seiso     lo actual.   Tambores que explican la fuga y carro de limpieza.
//   Seiketsu  despejado.   Poco mobiliario y señalización a la vista: el
//                          estándar se sostiene solo.
//   Shitsuke  completo.    El taller terminado, todo en su sitio. Es lo que el
//                          jugador viene a auditar y la recompensa visual.
//
// ZONAS OCUPADAS POR EL JUEGO — no invadir:
//   Nivel 1   x -2.7 a 2.7, z -1 a 2      (zonas de clasificación)
//   Nivel 2   x -3.3 a 3.3, z de estación (casillas del estante)
//   Nivel 3   x -4 a 3.6,   z -1.3 a 2.5  (manchas, equipo, impresora)
//   Nivel 4   x -3.6 a 3.6, z 1.8         (tablero y papelera)
//             x -2 a 2,     z 4.2         (zonas de señalización)
//   Nivel 5   x -4 a 4,     z -0.7 a 0.5  (puntos de control)
//
// De ahí sale la regla de colocación: todo va contra las paredes laterales
// (|x| >= 4.5) o al fondo (z >= 2), y en el Nivel 4 además se evita la banda
// z 4.2 del centro. Nada de esto es interactivo.

/**
 * Monta la utilería de fondo del nivel indicado.
 *
 * Se llama una vez al construir el nivel, después del garaje y antes de los
 * objetos de juego.
 */
export function ambientarNivel(scene: Scene, numeroNivel: number): void {
  switch (numeroNivel) {
    case 0:
      // El tutorial se queda vacío a propósito.
      break;

    case 1:
      // Seiri: acumulación. Dos pallets, tambores y estantería llena — la sala
      // tiene que dar la sensación de que sobra material antes de clasificar.
      crearPalletConCajas(scene, -5.0, 4.6);
      crearPalletConCajas(scene, -5.1, 2.9);
      crearTamboresAceite(scene, 5.0, 3.4);
      crearEstanteriaTaller(scene, 5.1, 0.9, -Math.PI / 2);
      break;

    case 2:
      // Seiton: dos estanterías enfrentadas encuadran la estación de trabajo,
      // y el tablero de sombras dice sin palabras de qué trata la S.
      crearEstanteriaTaller(scene, 5.1, 2.4, -Math.PI / 2);
      crearEstanteriaTaller(scene, -5.1, 2.4, Math.PI / 2);
      crearTableroHerramientas(scene, 5.85, 0.6, -Math.PI / 2);
      crearPalletConCajas(scene, -5.0, 4.7);
      break;

    case 3:
      // Seiso: la disposición que ya tenía el nivel, con las mismas
      // coordenadas. Los tambores explican de dónde sale el aceite y el carro
      // hace que limpiar se lea como tarea del puesto.
      crearEstanteriaTaller(scene, 5.1, 3.4, -Math.PI / 2);
      crearTamboresAceite(scene, 4.5, 0.4);
      crearPalletConCajas(scene, -5.0, 4.6);
      crearCarroDeLimpieza(scene, -1.5, 3.6, 0.5);
      crearSenalPisoMojado(scene, 0.9, 1.9, -0.35);
      break;

    case 4:
      // Seiketsu: menos cosas que en los anteriores. Acá lo que se muestra es
      // que cada cosa tiene su sitio marcado — el carro estacionado contra la
      // pared en vez de abandonado al medio, la señal ya puesta.
      //
      // Nada al centro del fondo: la banda z 4.2 la ocupan las zonas de
      // señalización del propio nivel.
      crearEstanteriaTaller(scene, 5.1, 1.6, -Math.PI / 2);
      crearTableroHerramientas(scene, -5.85, 1.2, Math.PI / 2);
      crearCarroDeLimpieza(scene, -5.0, 3.0, Math.PI / 2);
      crearSenalPisoMojado(scene, -4.7, 4.6, 0.3);
      break;

    case 5:
      // Shitsuke: el taller terminado. Es el más poblado después del Nivel 1,
      // pero al revés — ahí era desorden, acá es un espacio completo y en
      // orden. Los puntos de control viven en z -0.7 a 0.5, así que todo esto
      // queda por detrás y no tapa ninguno.
      crearEstanteriaTaller(scene, 5.1, 2.2, -Math.PI / 2);
      crearEstanteriaTaller(scene, -5.1, 2.2, Math.PI / 2);
      crearTableroHerramientas(scene, 5.85, 4.4, -Math.PI / 2);
      crearPalletConCajas(scene, -5.0, 4.7);
      crearTamboresAceite(scene, 4.4, 4.5);
      break;
  }
}