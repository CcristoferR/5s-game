import type { Certificado } from "../portal/Datos";

/**
 * Dibuja el certificado como imagen, con Canvas 2D nativo del navegador.
 *
 * Antes era genérico: el mismo papel para todos, sin nombre y sin registro en
 * ninguna parte. Servía de recuerdo, no de comprobante — nadie podía verificar
 * después si era real.
 *
 * Ahora lleva el nombre de la persona, su empresa, la fecha de finalización,
 * el puntaje y un código de verificación emitido y guardado en el servidor.
 * Ese código es lo que lo convierte en documento: con él, RRHH o un auditor
 * externo pueden comprobar que la emisión existe.
 */

const ANCHO = 1200;
const ALTO = 850;

/**
 * Píxeles reales por unidad de dibujo.
 *
 * Todo se traza con las medidas de arriba, pero el lienzo se crea al doble y
 * el contexto se escala. Así las proporciones no cambian ni una coma y la
 * imagen tiene cuatro veces más píxeles: se lee nítida tanto en la vista
 * previa como al abrir el archivo descargado y acercarse.
 *
 * Antes el lienzo era de 1200x850 y se mostraba a 620 px de ancho: el
 * navegador tenía que reducirlo casi a la mitad y los textos chicos —el
 * código, los rótulos de las casillas— se deshacían.
 */
const ESCALA = 2;

export function generarCertificado(
  certificado: Certificado,
  datosAuditoria?: { promedioCalificacion: number; tasaAcierto: number }
): string {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * ESCALA;
  canvas.height = ALTO * ESCALA;
  const ctx = canvas.getContext("2d")!;

  // A partir de acá se dibuja en las medidas originales y el contexto se
  // encarga de multiplicar. Ninguna coordenada del resto del archivo cambia.
  ctx.scale(ESCALA, ESCALA);

  fondoYMarco(ctx);
  encabezado(ctx);
  cuerpo(ctx, certificado);
  resultados(ctx, certificado, datosAuditoria);
  pie(ctx, certificado);

  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------

function fondoYMarco(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Doble marco: el exterior grueso da presencia, el interior fino le da el
  // aire formal que uno espera de un documento.
  ctx.strokeStyle = "#1f5c3a";
  ctx.lineWidth = 12;
  ctx.strokeRect(28, 28, ANCHO - 56, ALTO - 56);

  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, ANCHO - 96, ALTO - 96);

  // Esquinas ornamentales, discretas.
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3;
  const esquinas: [number, number, number, number][] = [
    [48, 48, 1, 1],
    [ANCHO - 48, 48, -1, 1],
    [48, ALTO - 48, 1, -1],
    [ANCHO - 48, ALTO - 48, -1, -1],
  ];
  esquinas.forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * 34, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 34);
    ctx.stroke();
  });
}

function encabezado(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = "center";

  ctx.fillStyle = "#8a7a4a";
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText("CERTIFICADO DE FINALIZACIÓN", ANCHO / 2, 128);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#12261c";
  ctx.font = "bold 52px Georgia, 'Times New Roman', serif";
  ctx.fillText("Operación 5S", ANCHO / 2, 192);

  ctx.fillStyle = "#5a6b60";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Programa de formación en metodología 5S", ANCHO / 2, 226);

  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ANCHO / 2 - 70, 250);
  ctx.lineTo(ANCHO / 2 + 70, 250);
  ctx.stroke();
}

function cuerpo(ctx: CanvasRenderingContext2D, c: Certificado): void {
  ctx.textAlign = "center";

  ctx.fillStyle = "#5a6b60";
  ctx.font = "19px system-ui, sans-serif";
  ctx.fillText("Se certifica que", ANCHO / 2, 312);

  // El nombre es lo más importante del documento y se trata como tal: es lo
  // primero que alguien busca al recibirlo.
  ctx.fillStyle = "#12261c";
  ctx.font = "bold 42px Georgia, 'Times New Roman', serif";
  ctx.fillText(ajustar(ctx, c.nombre || "Participante", ANCHO - 220, 42), ANCHO / 2, 368);

  // Línea bajo el nombre, como en un diploma impreso.
  ctx.strokeStyle = "#d8d2c4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ANCHO / 2 - 300, 388);
  ctx.lineTo(ANCHO / 2 + 300, 388);
  ctx.stroke();

  // La empresa y el área solo aparecen si están cargadas: una línea vacía o
  // con guiones se ve peor que no ponerla.
  const procedencia = [c.empresa, c.area].filter((x) => x && x.trim()).join("  ·  ");
  if (procedencia) {
    ctx.fillStyle = "#7a8a80";
    ctx.font = "17px system-ui, sans-serif";
    ctx.fillText(procedencia, ANCHO / 2, 414);
  }

  ctx.fillStyle = "#3a4a42";
  ctx.font = "19px system-ui, sans-serif";
  ctx.fillText("completó las cinco fases del programa:", ANCHO / 2, 462);
  ctx.font = "600 19px system-ui, sans-serif";
  ctx.fillText("Clasificar · Ordenar · Limpiar · Estandarizar · Disciplina", ANCHO / 2, 492);
}

function resultados(
  ctx: CanvasRenderingContext2D,
  c: Certificado,
  auditoria?: { promedioCalificacion: number; tasaAcierto: number }
): void {
  const y = 560;
  const casillas: [string, string][] = [
    ["PUNTAJE", String(c.puntaje)],
    ["FINALIZACIÓN", fechaCorta(c.emitidoEn)],
  ];

  if (auditoria) {
    casillas.push([
      "AUDITORÍA FINAL",
      `${Math.round(auditoria.tasaAcierto * 100)}% · ${auditoria.promedioCalificacion.toFixed(1)}/5`,
    ]);
  }

  const ancho = 250;
  const total = casillas.length * ancho;
  const inicio = ANCHO / 2 - total / 2;

  ctx.textAlign = "center";
  casillas.forEach(([rotulo, valor], i) => {
    const x = inicio + ancho * i + ancho / 2;

    ctx.fillStyle = "#8a7a4a";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText(rotulo, x, y);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#12261c";
    ctx.font = "bold 25px system-ui, sans-serif";
    ctx.fillText(valor, x, y + 34);

    // Separador entre casillas, salvo después de la última.
    if (i < casillas.length - 1) {
      ctx.strokeStyle = "#ddd7c9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + ancho / 2, y - 14);
      ctx.lineTo(x + ancho / 2, y + 44);
      ctx.stroke();
    }
  });
}

function pie(ctx: CanvasRenderingContext2D, c: Certificado): void {
  // Sello a la izquierda.
  const sx = 250;
  const sy = 700;
  ctx.beginPath();
  ctx.arc(sx, sy, 52, 0, Math.PI * 2);
  ctx.fillStyle = "#1f5c3a";
  ctx.fill();
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("5S", sx, sy + 9);

  // Código de verificación a la derecha. Es lo que convierte esta imagen en
  // un documento comprobable: sin él, cualquiera podría fabricar uno igual.
  const cx = ANCHO - 250;

  ctx.fillStyle = "#8a7a4a";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("CÓDIGO DE VERIFICACIÓN", cx, sy - 30);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#12261c";
  ctx.font = "bold 27px 'Courier New', monospace";
  ctx.fillText(c.codigo, cx, sy + 4);

  ctx.fillStyle = "#7a8a80";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("Verificable ante el área de capacitación", cx, sy + 32);

  ctx.strokeStyle = "#d8d2c4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 150, sy + 46);
  ctx.lineTo(cx + 150, sy + 46);
  ctx.stroke();
}

// ---------------------------------------------------------------------------

/** Encoge la letra hasta que el texto entre, en vez de recortarlo. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, maximo: number, cuerpo: number): string {
  let tamano = cuerpo;
  while (ctx.measureText(texto).width > maximo && tamano > 18) {
    tamano -= 2;
    ctx.font = `bold ${tamano}px Georgia, 'Times New Roman', serif`;
  }
  return texto;
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function descargarCertificado(dataUrl: string, codigo: string): void {
  const enlace = document.createElement("a");
  enlace.href = dataUrl;
  // El código en el nombre del archivo: si alguien guarda varios certificados,
  // se distinguen sin abrirlos.
  enlace.download = `certificado-5s-${codigo}.png`;
  enlace.click();
}

/**
 * Comparte el certificado por el menú nativo del sistema.
 *
 * No todos los navegadores lo soportan, sobre todo en escritorio. Si no está
 * disponible no hace nada: la descarga sigue siendo la vía principal.
 */
export async function compartirCertificado(dataUrl: string, codigo: string): Promise<void> {
  const nav = navigator as Navigator & {
    share?: (datos: unknown) => Promise<void>;
    canShare?: (datos: unknown) => boolean;
  };
  if (!nav.share) return;

  const blob = await (await fetch(dataUrl)).blob();
  const archivo = new File([blob], `certificado-5s-${codigo}.png`, { type: "image/png" });

  try {
    await nav.share({
      title: "Certificado 5S",
      text: `Completé el programa de formación 5S. Código de verificación: ${codigo}`,
      files: [archivo],
    });
  } catch {
    // El usuario canceló el menú de compartir: no es un error.
  }
}