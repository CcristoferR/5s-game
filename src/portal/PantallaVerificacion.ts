import "./portal.css";
import { verificarCertificado, type Verificacion } from "./Datos";

/**
 * Verificación de un certificado.
 *
 * Es lo que convierte el certificado en un comprobante y no en una imagen que
 * cualquiera podría fabricar: quien recibe el papel escribe el código impreso y
 * confirma que la emisión existe de verdad.
 *
 * ─── FUNCIONA SIN CUENTA ──────────────────────────────────────────────────
 *
 * A propósito. Quien verifica suele ser alguien de afuera —un auditor, el área
 * de personal de otra empresa— y pedirle que se registre en la plataforma solo
 * para validar un papel haría que nadie lo verificara nunca.
 *
 * Por eso la consulta del servidor es pública, y devuelve únicamente lo que ya
 * está impreso en el certificado: nombre, curso, puntaje y fecha. El RUT no se
 * expone jamás — una consulta abierta que lo devolviera sería una vía directa
 * para recolectar datos personales probando códigos al azar.
 */
export function mostrarVerificacion(opciones?: {
  /** Si se pasa, aparece un botón para volver en vez de cerrar la pestaña. */
  onVolver?: () => void;
  /** Código precargado, por ejemplo si llega en la dirección web. */
  codigoInicial?: string;
}): void {
  const raiz = document.createElement("div");
  raiz.className = "portal portal--pagina";
  document.body.appendChild(raiz);

  raiz.innerHTML = plantilla(Boolean(opciones?.onVolver));
  conectar();

  const campo = raiz.querySelector<HTMLInputElement>("#codigoVerificar")!;
  if (opciones?.codigoInicial) {
    campo.value = opciones.codigoInicial;
    void consultar();
  }
  campo.focus();

  function conectar(): void {
    raiz.querySelector<HTMLButtonElement>("#volverVerificar")?.addEventListener("click", () => {
      raiz.remove();
      opciones?.onVolver?.();
    });

    raiz.querySelector<HTMLFormElement>("#formVerificar")!.addEventListener("submit", (evento) => {
      evento.preventDefault();
      void consultar();
    });

    // Se escribe siempre en mayúscula y con los guiones puestos: el código va
    // impreso así, y obligar a reproducir el formato exacto sería una fuente
    // de fallos que no aporta nada.
    const entrada = raiz.querySelector<HTMLInputElement>("#codigoVerificar")!;
    entrada.addEventListener("input", () => {
      const limpio = entrada.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const partes: string[] = [];
      if (limpio.length > 0) partes.push(limpio.slice(0, 2));
      if (limpio.length > 2) partes.push(limpio.slice(2, 6));
      if (limpio.length > 6) partes.push(limpio.slice(6, 10));
      entrada.value = partes.join("-");
    });
  }

  async function consultar(): Promise<void> {
    const codigo = raiz.querySelector<HTMLInputElement>("#codigoVerificar")!.value.trim();
    const zona = raiz.querySelector<HTMLDivElement>("#resultadoVerificar")!;
    const boton = raiz.querySelector<HTMLButtonElement>("#botonVerificar")!;

    if (codigo.length < 8) {
      zona.innerHTML = aviso("Escribe el código completo que aparece en el certificado.");
      return;
    }

    boton.disabled = true;
    boton.textContent = "Verificando…";
    zona.innerHTML = "";

    try {
      const resultado = await verificarCertificado(codigo);
      zona.innerHTML = resultado.valido ? tarjetaValida(resultado, codigo) : tarjetaInvalida(codigo);
    } catch (error) {
      console.error("[verificacion]", error);
      zona.innerHTML = aviso("No se pudo consultar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Verificar";
    }
  }
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

function plantilla(conVolver: boolean): string {
  return `
    <header class="barra">
      <div class="barra__marca">
        <span class="barra__sello">5S</span>
        <span class="barra__nombre">Verificación de certificados</span>
      </div>
      ${conVolver ? `<button class="boton boton--borde" id="volverVerificar" type="button">Volver</button>` : ""}
    </header>

    <main class="lamina lamina--angosta">
      <div class="verif__intro">
        <h1 class="lamina__titulo">Comprobar un certificado</h1>
        <p class="lamina__bajada">
          Escribe el código que aparece al pie del certificado para confirmar que
          fue emitido por esta plataforma.
        </p>
      </div>

      <form class="verif__form" id="formVerificar">
        <label class="portal__etiqueta" for="codigoVerificar">Código de verificación</label>
        <div class="verif__fila">
          <input class="verif__campo" id="codigoVerificar" placeholder="5S-XXXX-XXXX"
                 autocomplete="off" spellcheck="false" maxlength="12" />
          <button class="boton boton--principal" id="botonVerificar" type="submit">Verificar</button>
        </div>
      </form>

      <div id="resultadoVerificar"></div>
    </main>
  `;
}

/**
 * Certificado auténtico.
 *
 * El resultado tiene que leerse de un vistazo, porque quien verifica
 * normalmente lo hace con el papel en la mano y comparando. Por eso el veredicto
 * va primero y grande, y los datos debajo en pares rótulo–valor, en el mismo
 * orden en que aparecen impresos.
 */
function tarjetaValida(v: Verificacion, codigo: string): string {
  const datos: [string, string][] = [
    ["Nombre", v.nombre ?? "—"],
    ["Curso", v.curso ?? "—"],
    ["Empresa", v.empresa || "—"],
    ["Área", v.area || "—"],
    ["Puntaje", String(v.puntaje ?? 0)],
    ["Fecha de emisión", v.emitidoEn ? fechaLarga(v.emitidoEn) : "—"],
    ["Código", codigo],
  ];

  return `
    <section class="verif__resultado verif__resultado--valido">
      <div class="verif__veredicto">
        <span class="verif__marca verif__marca--ok">✓</span>
        <div>
          <h2>Certificado válido</h2>
          <p>Esta emisión está registrada en la plataforma.</p>
        </div>
      </div>

      <dl class="verif__datos">
        ${datos
          .map(
            ([rotulo, valor]) => `
          <div class="verif__dato">
            <dt>${rotulo}</dt>
            <dd${rotulo === "Código" ? ' class="verif__mono"' : ""}>${escapar(valor)}</dd>
          </div>`
          )
          .join("")}
      </dl>

      <p class="verif__pie">
        Los datos mostrados son los que figuran en el certificado al momento de
        su emisión.
      </p>
    </section>
  `;
}

/**
 * Código no encontrado.
 *
 * El mensaje evita acusar de falsificación: lo más habitual es un error al
 * copiar el código, no un intento de engaño. Por eso se sugiere revisarlo antes
 * de sacar conclusiones.
 */
function tarjetaInvalida(codigo: string): string {
  return `
    <section class="verif__resultado verif__resultado--invalido">
      <div class="verif__veredicto">
        <span class="verif__marca verif__marca--error">!</span>
        <div>
          <h2>No encontramos ese código</h2>
          <p>
            No hay ningún certificado emitido con el código
            <strong class="verif__mono">${escapar(codigo)}</strong>.
          </p>
        </div>
      </div>

      <p class="verif__pie">
        Revisa que esté copiado tal cual aparece en el documento. Si el código es
        correcto y aun así no aparece, el certificado no fue emitido por esta
        plataforma.
      </p>
    </section>
  `;
}

function aviso(texto: string): string {
  return `<p class="portal__aviso portal__aviso--error">${texto}</p>`;
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}