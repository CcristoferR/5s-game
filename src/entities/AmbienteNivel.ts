import { Scene } from "@babylonjs/core";
import {
  crearEstanteriaTaller,
  crearTamboresAceite,
  crearPalletConCajas,
  crearCarroDeLimpieza,
  crearSenalPisoMojado,
  crearTableroHerramientas,
  crearPilaDeCajas,
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
//   Nivel 2   x -1.7 a 1.7, z 2.5 a 3.7   (puesto de trabajo y tablero)
//             x  2.2 a 4.8, z 2.7 a 3.6   (estantería de destino)
//             x -4.3 a 4.3, z -2 a 2.3    (recinto de arrastre)
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
      // Seiri: SATURADO. Es el único nivel donde el exceso es el mensaje.
      //
      // El curso arranca pidiendo visualizar el desorden acumulado —cajones
      // llenos de cosas guardadas "por si acaso", material que estorba y al
      // que uno ya se acostumbró—. Si la sala se ve despejada, el ejercicio
      // pierde sentido antes de empezar: no hay nada que seleccionar.
      //
      // Por eso acá hay el doble de utilería que en los demás niveles, y
      // apretada contra los pasillos en vez de ordenada contra las paredes.
      // Los objetos de juego se reparten ENTRE estas piezas.
      // NADA PROLIJO EN ESTE NIVEL.
      //
      // Las estanterías con sus bultos alineados y los pallets bien estibados
      // sirven para los niveles 2 a 5, donde el taller ya está en orden. Acá
      // contradicen el ejercicio: si el fondo se ve organizado, el desorden
      // parece limitado a las diez piezas que hay que clasificar.
      //
      // Por eso el Nivel 1 se arma casi solo con pilas sueltas —cajas
      // amontonadas donde cayeron, giradas y de medidas distintas— y deja una
      // sola estantería, medio vacía, contra la pared.
      crearEstanteriaTaller(scene, -5.1, 0.9, Math.PI / 2);

      crearPilaDeCajas(scene, -4.9, 4.5, 5);
      crearPilaDeCajas(scene, -3.6, 5.3, 4);
      crearPilaDeCajas(scene, -1.7, 5.6, 3);
      crearPilaDeCajas(scene, 1.3, 5.6, 4);
      crearPilaDeCajas(scene, 4.6, 4.3, 5);
      crearPilaDeCajas(scene, 5.3, 1.4, 3);
      crearPilaDeCajas(scene, -5.2, 2.6, 4);
      crearPilaDeCajas(scene, 4.2, 0.4, 2);

      // El carro abandonado en medio del paso, no estacionado contra la pared:
      // en un taller sin Seiri, los medios auxiliares también estorban.
      // Fuera de las zonas de clasificación.
      //
      // Estaba en (3.3, 3.0), que cae DENTRO del cuadro del área de descarte
      // —x de 1,5 a 3,7 y z de 1,3 a 3,5—. Se veía una escoba plantada en
      // medio de la zona roja, como si formara parte del ejercicio.
      crearCarroDeLimpieza(scene, 4.6, -0.9, 0.7);
      break;

    case 2:
      // Seiton: la utilería se va TODA al lado izquierdo y al fondo.
      //
      // El derecho lo ocupa la estantería de destino (x 2.2 a 4.8) y el centro
      // del fondo el puesto de trabajo con su tablero de siluetas. Los dos
      // destinos tienen que verse a la vez y sin nada delante: si hay que
      // girar la cámara para comparar dónde va cada cosa, el nivel deja de ser
      // un ejercicio de criterio y pasa a ser uno de puntería.
      //
      // Y SIN TABLERO DE HERRAMIENTAS DECORATIVO. Había uno colgado en la
      // pared derecha, idéntico al del ejercicio: el jugador arrastraba hasta
      // él y no pasaba nada, porque no recibe objetos. Un señuelo así no
      // enseña nada, solo hace perder tiempo.
      crearEstanteriaTaller(scene, -5.1, 2.4, Math.PI / 2);
      crearEstanteriaTaller(scene, -5.1, 4.7, Math.PI / 2);
      crearPalletConCajas(scene, -4.9, 6.4);
      crearCarroDeLimpieza(scene, 5.2, 5.6, Math.PI);
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
      // Shitsuke: el taller terminado y en uso. Es el nivel más poblado, pero
      // al revés que el 1 — allá era desorden, acá es un espacio completo y en
      // orden. También es el que más lo necesita: las estaciones de auditoría
      // están repartidas por el centro y sin nada alrededor el galpón se veía
      // como una sala vacía con cinco muebles sueltos.
      //
      // Los puntos de control viven entre z -0,7 y 0,5, así que todo esto va
      // por detrás y contra las paredes: acompaña sin taparlos.
      crearEstanteriaTaller(scene, 5.1, 2.2, -Math.PI / 2);
      crearEstanteriaTaller(scene, 5.1, 4.3, -Math.PI / 2);
      crearEstanteriaTaller(scene, -5.1, 2.2, Math.PI / 2);
      crearEstanteriaTaller(scene, -5.1, 4.3, Math.PI / 2);
      crearTableroHerramientas(scene, 5.85, 0.6, -Math.PI / 2);
      crearTableroHerramientas(scene, -5.85, 0.6, Math.PI / 2);
      crearPalletConCajas(scene, -4.6, 6.1);
      crearTamboresAceite(scene, 4.5, 6.0);
      crearCarroDeLimpieza(scene, 2.6, 5.6, Math.PI);
      break;
  }
}