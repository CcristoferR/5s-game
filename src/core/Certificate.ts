// Genera el certificado como imagen usando Canvas 2D (nativo del
// navegador, sin librerías nuevas) y ofrece descargarlo o compartirlo.
// Solo se llega a esta pantalla si el Nivel 5 fue aprobado (ver
// GameManager/MainMenu), así que "datosAuditoria" siempre debería venir
// con datos reales — el parámetro es opcional solo como red de
// seguridad para no romper el render si algo llegó a fallar antes.
export function generarCertificado(datosAuditoria?: { promedioCalificacion: number; tasaAcierto: number }): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 700;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#2e7d46";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);

  ctx.fillStyle = "#1a2b22";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Certificado de Finalización", canvas.width / 2, 180);

  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = "#3a4550";
  ctx.fillText("Programa de Gamificación 5S", canvas.width / 2, 230);

  ctx.font = "20px system-ui, sans-serif";
  ctx.fillStyle = "#333";
  ctx.fillText("Se certifica que el participante completó exitosamente", canvas.width / 2, 320);
  ctx.fillText("los 5 niveles del programa: Clasificar, Ordenar, Limpiar,", canvas.width / 2, 355);
  ctx.fillText("Estandarizar y Disciplina.", canvas.width / 2, 390);

  const fecha = new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = "#555";
  ctx.fillText(`Fecha: ${fecha}`, canvas.width / 2, 460);

  if (datosAuditoria) {
    const tasaPct = Math.round(datosAuditoria.tasaAcierto * 100);
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillStyle = "#2e7d46";
    ctx.fillText(
      `Auditoría final (Nivel 5): ${tasaPct}% de aciertos — calificación ${datosAuditoria.promedioCalificacion.toFixed(1)}/5`,
      canvas.width / 2,
      495
    );
  }

  ctx.beginPath();
  ctx.arc(canvas.width / 2, 560, 50, 0, Math.PI * 2);
  ctx.fillStyle = "#2e7d46";
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText("5S", canvas.width / 2, 568);

  return canvas.toDataURL("image/png");
}

export function descargarCertificado(dataUrl: string): void {
  const enlace = document.createElement("a");
  enlace.href = dataUrl;
  enlace.download = "certificado-5s.png";
  enlace.click();
}

// Web Share API: no todos los navegadores/dispositivos la soportan (sobre
// todo en escritorio) — por eso se revisa antes; si no está disponible,
// simplemente no hace nada y la descarga sigue siendo la vía principal.
export async function compartirCertificado(dataUrl: string): Promise<void> {
  const nav = navigator as any;
  if (!nav.share) return;

  const blob = await (await fetch(dataUrl)).blob();
  const archivo = new File([blob], "certificado-5s.png", { type: "image/png" });

  try {
    await nav.share({
      title: "Certificado 5S",
      text: "Completé el programa de gamificación 5S",
      files: [archivo],
    });
  } catch {
    // El usuario canceló el share nativo — no es un error real, se ignora.
  }
}