import "./panelMejora.css";
import type { Fotografia } from "../core/FotografiaCero";

// ---------------------------------------------------------------------------
// Panel de mejora 5S
// ---------------------------------------------------------------------------
//
// Video 4.2: el Panel 5S es "un tablero público que muestra la foto del antes
// y después del sector, los integrantes y las mejoras logradas". Es una de las
// herramientas de gestión visual que el curso nombra por su nombre.
//
// ─── POR QUÉ ES UNA CAPA DEL NAVEGADOR ────────────────────────────────────
//
// Las dos fotos son imágenes de 1280 px. Mostrarlas dentro de la interfaz del
// juego significaría convertirlas en texturas sobre geometría, con el mismo
// reescalado que ya nos costó nitidez en los carteles. Como capa del navegador
// se muestran a resolución nativa, se pueden ampliar y el navegador las
// interpola bien.
//
// Además sobrevive a la destrucción de la escena, así que el panel puede
// quedarse abierto mientras por detrás se arma el menú.
//
// ─── EL DESLIZADOR ────────────────────────────────────────────────────────
//
// Se pueden ver de dos formas: lado a lado y superpuestas con un deslizador.
// La segunda es la que convence: al arrastrar sobre la misma imagen se ve
// desaparecer el desorden en el sitio exacto donde estaba, y ahí es donde el
// jugador reconoce su propio trabajo. Lado a lado se comparan dos cuadros;
// superpuestas se ve el cambio.

export function mostrarPanelMejora(
  antes: Fotografia,
  despues: Fotografia,
  datos: { nombre: string; metrosLiberados: number; fases: number },
  onCerrar: () => void
): void {
  const capa = document.createElement("div");
  capa.className = "panelMejora";
  document.body.appendChild(capa);

  capa.innerHTML = `
    <div class="panelMejora__marco">
      <header class="panelMejora__encabezado">
        <p class="panelMejora__rotulo">PANEL DE MEJORA 5S</p>
        <h1 class="panelMejora__titulo">Antes y después del área</h1>
        <p class="panelMejora__bajada">
          Responsable: <strong>${escapar(datos.nombre)}</strong>
        </p>
      </header>

      <div class="panelMejora__vista" id="vistaMejora">
        <img class="panelMejora__foto panelMejora__foto--antes" src="${antes.imagen}" alt="Estado inicial del área" />
        <div class="panelMejora__capaDespues" id="capaDespues">
          <img class="panelMejora__foto" src="${despues.imagen}" alt="Estado del área tras aplicar las 4 primeras S" />
        </div>

        <div class="panelMejora__tirador" id="tiradorMejora" role="separator" aria-label="Comparar antes y después">
          <span class="panelMejora__asa"></span>
        </div>

        <span class="panelMejora__marca panelMejora__marca--antes">ANTES</span>
        <span class="panelMejora__marca panelMejora__marca--despues">DESPUÉS</span>
      </div>

      <p class="panelMejora__ayuda">Arrastra la línea para comparar.</p>

      <div class="panelMejora__cifras">
        <div class="panelMejora__cifra">
          <span class="panelMejora__dato">${datos.metrosLiberados.toFixed(2).replace(".", ",")} m²</span>
          <span class="panelMejora__pie">Espacio recuperado</span>
        </div>
        <div class="panelMejora__cifra">
          <span class="panelMejora__dato">${datos.fases}</span>
          <span class="panelMejora__pie">Fases aplicadas</span>
        </div>
        <div class="panelMejora__cifra">
          <span class="panelMejora__dato">${fecha(antes.tomadaEn)}</span>
          <span class="panelMejora__pie">Fotografía inicial</span>
        </div>
      </div>

      <div class="panelMejora__acciones">
        <button class="panelMejora__boton panelMejora__boton--secundario" id="descargarMejora" type="button">
          Descargar el panel
        </button>
        <button class="panelMejora__boton" id="cerrarMejora" type="button">Continuar</button>
      </div>
    </div>`;

  const vista = capa.querySelector<HTMLDivElement>("#vistaMejora")!;
  const capaDespues = capa.querySelector<HTMLDivElement>("#capaDespues")!;
  const tirador = capa.querySelector<HTMLDivElement>("#tiradorMejora")!;

  // --- Deslizador ---
  //
  // Se mueve recortando la capa del "después" por la izquierda. Las dos
  // imágenes ocupan exactamente el mismo sitio, así que el recorte revela una
  // sobre la otra sin desplazar nada: el punto exacto del galpón coincide en
  // ambas, que es lo que hace legible la comparación.
  let posicion = 50;

  const aplicar = (porcentaje: number): void => {
    posicion = Math.min(100, Math.max(0, porcentaje));
    capaDespues.style.clipPath = `inset(0 0 0 ${posicion}%)`;
    tirador.style.left = `${posicion}%`;
  };

  aplicar(posicion);

  const moverDesde = (clienteX: number): void => {
    const caja = vista.getBoundingClientRect();
    aplicar(((clienteX - caja.left) / caja.width) * 100);
  };

  let arrastrando = false;

  const empezar = (evento: PointerEvent): void => {
    arrastrando = true;
    tirador.setPointerCapture(evento.pointerId);
    moverDesde(evento.clientX);
  };

  const mover = (evento: PointerEvent): void => {
    if (arrastrando) moverDesde(evento.clientX);
  };

  const soltar = (): void => {
    arrastrando = false;
  };

  tirador.addEventListener("pointerdown", empezar);
  tirador.addEventListener("pointermove", mover);
  tirador.addEventListener("pointerup", soltar);
  tirador.addEventListener("pointercancel", soltar);

  // Clic en cualquier punto de la imagen: lleva la línea ahí. Arrastrar el asa
  // es lo natural, pero pedirle a alguien que acierte a una línea de 3 px es
  // pedirle puntería.
  vista.addEventListener("pointerdown", (evento) => {
    if (evento.target === tirador || tirador.contains(evento.target as Node)) return;
    moverDesde(evento.clientX);
  });

  // --- Descargar ---
  //
  // El panel real es un tablero que se cuelga en el área. Poder llevárselo
  // como imagen es lo que permite que salga de la pantalla y llegue a la
  // pared, que es donde el curso lo quiere.
  capa.querySelector<HTMLButtonElement>("#descargarMejora")!.addEventListener("click", () => {
    void descargarComparativa(antes, despues, datos);
  });

  const cerrar = (): void => {
    capa.classList.add("panelMejora--saliendo");
    setTimeout(() => {
      capa.remove();
      onCerrar();
    }, 220);
  };

  capa.querySelector<HTMLButtonElement>("#cerrarMejora")!.addEventListener("click", cerrar);

  // Entrada suave: sin esto el panel aparece de golpe justo después del
  // resultado del nivel, y se siente como un salto.
  requestAnimationFrame(() => capa.classList.add("panelMejora--visible"));
}

/**
 * Compone las dos fotos en una sola imagen descargable.
 *
 * Se dibujan en un lienzo con sus rótulos y las cifras, en vez de bajar dos
 * archivos sueltos: el panel es UNA pieza, y separado en dos deja de contar
 * nada.
 */
async function descargarComparativa(
  antes: Fotografia,
  despues: Fotografia,
  datos: { nombre: string; metrosLiberados: number; fases: number }
): Promise<void> {
  const cargar = (src: string): Promise<HTMLImageElement> =>
    new Promise((listo, falla) => {
      const img = new Image();
      img.onload = () => listo(img);
      img.onerror = () => falla(new Error("no se pudo leer la imagen"));
      img.src = src;
    });

  const [imgAntes, imgDespues] = await Promise.all([cargar(antes.imagen), cargar(despues.imagen)]);

  const MARGEN = 48;
  const CABECERA = 150;
  const PIE = 130;
  const anchoFoto = imgAntes.width;
  const altoFoto = imgAntes.height;

  const lienzo = document.createElement("canvas");
  lienzo.width = anchoFoto * 2 + MARGEN * 3;
  lienzo.height = CABECERA + altoFoto + PIE;
  const ctx = lienzo.getContext("2d")!;

  ctx.fillStyle = "#0d1013";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);

  ctx.fillStyle = "#7fb495";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("PANEL DE MEJORA 5S", MARGEN, 62);

  ctx.fillStyle = "#f5f7f6";
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.fillText("Antes y después del área", MARGEN, 118);

  ctx.drawImage(imgAntes, MARGEN, CABECERA);
  ctx.drawImage(imgDespues, MARGEN * 2 + anchoFoto, CABECERA);

  const rotular = (texto: string, x: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, CABECERA, 190, 54);
    ctx.fillStyle = "#0d1013";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText(texto, x + 22, CABECERA + 37);
  };

  rotular("ANTES", MARGEN, "#c98d80");
  rotular("DESPUÉS", MARGEN * 2 + anchoFoto, "#7fb495");

  ctx.fillStyle = "rgba(224,230,228,0.78)";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(
    `Responsable: ${datos.nombre}   ·   Espacio recuperado: ${datos.metrosLiberados
      .toFixed(2)
      .replace(".", ",")} m²   ·   ${datos.fases} fases aplicadas`,
    MARGEN,
    CABECERA + altoFoto + 58
  );

  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(
    `Fotografía inicial: ${fecha(antes.tomadaEn)}   ·   Fotografía final: ${fecha(despues.tomadaEn)}`,
    MARGEN,
    CABECERA + altoFoto + 96
  );

  lienzo.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "panel-mejora-5s.png";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}