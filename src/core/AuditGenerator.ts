import type { EstandarNivel4 } from "./GameManager";
import { puntosControlRespaldoNivel5, type PuntoControlNivel5, type TipoEvidencia } from "../data/levelConfig";

// Posiciones disponibles para los pedestales de auditoría del Nivel 5.
// Se reparten en dos filas para que quepan hasta 8 puntos sin
// amontonarse (checklist del Nivel 4 hasta 5 + señalización hasta 3).
const POSICIONES_DISPONIBLES: [number, number][] = [
  [-4.5, 0.5], [-2.7, -0.3], [-0.9, 0.4], [0.9, -0.3],
  [2.7, 0.5], [4.5, -0.3], [-1.8, 2.2], [1.8, 2.2],
];

const TIPOS_EVIDENCIA_DESVIACION: Exclude<TipoEvidencia, "sinProblema">[] = [
  "tarjetaVencida",
  "manchaVisible",
  "objetoFueraDeLugar",
];

function entero(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sortea la calificación real (1-5) de un punto de control, al estilo de
// un checklist de auditoría de industria. Se evita a propósito el 3:
// cada punto tiene que mapear con claridad a "cumple" (4-5, sin evidencia
// visual) o "incumple" (1-2, con evidencia visual que el jugador debe
// detectar) — un punto ambiguo no sería jugable en la mecánica de clic.
function sortearCalificacion(): number {
  return Math.random() < 0.5 ? entero(4, 5) : entero(1, 2);
}

function evidenciaAlAzar(): TipoEvidencia {
  return TIPOS_EVIDENCIA_DESVIACION[entero(0, TIPOS_EVIDENCIA_DESVIACION.length - 1)];
}

// Genera los puntos de control del Nivel 5 a partir del estándar que el
// jugador construyó en el Nivel 4. Se llama una vez por intento (al
// entrar o reintentar el nivel), así las desviaciones cambian cada vez —
// cumpliendo lo que pide la guía: "desviaciones introducidas
// aleatoriamente".
/**
 * Acorta el texto de un item del checklist para el cartel de la estacion.
 *
 * Los items los define el jugador en el Nivel 4, asi que no hay rotulos
 * curados para ellos como si los hay para los puntos de respaldo. Se toman las
 * primeras palabras sin cortar ninguna por la mitad: el cartel solo tiene que
 * decir QUE se audita ahi, y la frase completa sigue estando en el informe
 * final, donde hay sitio para leerla.
 */
function tituloCorto(texto: string): string {
  const limpio = texto.trim();
  if (limpio.length <= 22) return limpio;

  const corte = limpio.slice(0, 22);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > 10 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
}

export function generarPuntosControlNivel5(estandar: EstandarNivel4): PuntoControlNivel5[] {
  const puntos: PuntoControlNivel5[] = [];

  // 1) Un punto de control por cada ítem que el jugador dejó en la zona
  // "checklist" del Nivel 4 — es, literalmente, "el checklist que él
  // mismo ayudó a construir".
  estandar.checklist.forEach((item) => {
    const posicion = POSICIONES_DISPONIBLES[puntos.length % POSICIONES_DISPONIBLES.length];

    if (!item.esValido) {
      // El jugador clasificó mal este ítem en el Nivel 4 (era ambiguo o
      // irrelevante, pero lo dejó igual en el checklist). Un estándar
      // poco claro no se puede sostener en el tiempo — este punto queda
      // forzado como desviación, con una explicación que conecta el
      // error de vuelta al Nivel 4 en vez de simular un problema físico
      // nuevo y arbitrario.
      puntos.push({
        id: `chk_${item.id}`,
        posicion,
        descripcionControl: item.texto,
        tituloControl: tituloCorto(item.texto),
        tieneDesviacion: true,
        tipoEvidencia: evidenciaAlAzar(),
        calificacion: 1,
        explicacion:
          "Este ítem quedó en tu checklist del Nivel 4, pero era una instrucción ambigua — un estándar poco claro nunca se puede dar por cumplido.",
      });
      return;
    }

    const calificacion = sortearCalificacion();
    const cumple = calificacion >= 4;
    puntos.push({
      id: `chk_${item.id}`,
      posicion,
      descripcionControl: item.texto,
      tituloControl: tituloCorto(item.texto),
      tieneDesviacion: !cumple,
      tipoEvidencia: cumple ? "sinProblema" : evidenciaAlAzar(),
      calificacion,
      explicacion: cumple
        ? "El estándar definido en el Nivel 4 se está siguiendo correctamente en este punto."
        : "Se detectó una desviación respecto al estándar que definiste en el Nivel 4.",
    });
  });

  // 2) Un punto de control por cada zona de señalización del Nivel 4 —
  // la otra mitad del estándar (códigos de color). También sirven de
  // respaldo si el jugador dejó pocos ítems en el checklist.
  estandar.senalizacion.forEach((zona) => {
    const posicion = POSICIONES_DISPONIBLES[puntos.length % POSICIONES_DISPONIBLES.length];

    if (!zona.esCorrecta) {
      // El jugador puso el color equivocado en esta zona en el Nivel 4
      // — igual que con un ítem de checklist mal clasificado, eso no se
      // arregla solo con el paso del tiempo: el punto queda forzado
      // como desviación.
      puntos.push({
        id: `sen_${zona.zonaId}`,
        posicion,
        descripcionControl: `Código de color — ${zona.zonaDescripcion}`,
        tituloControl: tituloCorto(`Código de color — ${zona.zonaDescripcion}`),
        tieneDesviacion: true,
        tipoEvidencia: "objetoFueraDeLugar",
        calificacion: 1,
        explicacion: "En el Nivel 4 se asignó el color equivocado a esta zona — el estándar visual nunca quedó bien definido acá.",
      });
      return;
    }

    const calificacion = sortearCalificacion();
    const cumple = calificacion >= 4;
    puntos.push({
      id: `sen_${zona.zonaId}`,
      posicion,
      descripcionControl: `Código de color — ${zona.zonaDescripcion}`,
      tituloControl: tituloCorto(`Código de color — ${zona.zonaDescripcion}`),
      tieneDesviacion: !cumple,
      tipoEvidencia: cumple ? "sinProblema" : "objetoFueraDeLugar",
      calificacion,
      explicacion: cumple
        ? "La señalización de color sigue el estándar definido en el Nivel 4."
        : "La señal de esta zona ya no corresponde al color definido como estándar — se desalineó con el tiempo.",
    });
  });

  // Red de seguridad: si el jugador llega al Nivel 5 sin datos guardados
  // del Nivel 4 (por ejemplo, recargó la página y perdió el estado en
  // memoria), se usa un set de respaldo para que el nivel siga siendo
  // jugable en vez de mostrarse vacío.
  if (puntos.length === 0) {
    return puntosControlRespaldoNivel5.map((p) => ({ ...p }));
  }

  return puntos;
}