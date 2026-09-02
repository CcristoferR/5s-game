import "./portal.css";
import {
  actualizarMiPerfil,
  cambiarMiClave,
  explicarRechazoMiClave,
  LARGO_MINIMO_CLAVE,
  type Perfil,
} from "./Datos";
import {
  leerPreferencias,
  cambiarPreferencias,
  type EscalaTexto,
} from "./Preferencias";
import { establecerSilencio } from "../core/Sonido";
import { aplicarTemaUI } from "../ui/EstiloUI";

/**
 * Mi cuenta.
 *
 * Reúne lo que hasta ahora obligaba a molestar a un administrador o a entrar a
 * la consola de la base: corregir los propios datos y cambiar la propia
 * contraseña. Y suma los ajustes de presentación del equipo.
 *
 * ─── POR QUÉ LAS PREFERENCIAS ESTÁN ACÁ Y NO EN UN MENÚ APARTE ────────────
 *
 * Porque nadie busca "ajustes" en un curso de capacitación. Están donde la
 * persona ya va a entrar por otro motivo —a arreglar su nombre o su clave— y
 * de paso las encuentra. Un menú de ajustes propio se usaría la mitad.
 *
 * ─── QUÉ NO SE PUEDE EDITAR ───────────────────────────────────────────────
 *
 * El RUT o correo no se toca: es la identidad con la que se inicia sesión, y
 * cambiarlo dejaría la cuenta sin poder entrar. El rol y la suspensión tampoco
 * aparecen: los cambia un administrador, y la base los protege con
 * disparadores propios aunque alguien manipulara la petición.
 */
export function mostrarMiCuenta(perfil: Perfil, onVolver: () => void): void {
  const raiz = document.createElement("div");
  // "portal" a secas, como la pantalla de acceso: es un formulario centrado.
  // La variante --pagina es para las pantallas con barra superior propia
  // (catálogo, verificación) y quita el centrado y el margen — usarla acá
  // dejaba la tarjeta pegada al borde izquierdo y sin aire.
  //
  // El modificador --alto acompaña porque esta tarjeta es larga: con el
  // centrado vertical puro, una tarjeta más alta que la ventana queda cortada
  // por arriba y esa parte no se alcanza ni desplazando.
  raiz.className = "portal portal--alto";
  document.body.appendChild(raiz);

  raiz.innerHTML = plantilla(perfil);

  const $ = <T extends HTMLElement>(sel: string): T => raiz.querySelector<T>(sel)!;

  const banda = $<HTMLParagraphElement>("#avisoCuenta");

  function avisar(texto: string, tipo: "ok" | "error"): void {
    banda.textContent = texto;
    banda.className = `portal__aviso portal__aviso--${tipo}`;
    banda.hidden = false;
  }

  function cerrar(): void {
    raiz.remove();
    onVolver();
  }

  // --- Volver ---
  $<HTMLButtonElement>("#volverCuenta").addEventListener("click", cerrar);

  // --- Datos personales ---
  $<HTMLFormElement>("#formDatos").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const boton = $<HTMLFormElement>("#formDatos").querySelector("button")!;
    boton.disabled = true;

    const resultado = await actualizarMiPerfil({
      nombreCompleto: $<HTMLInputElement>("#miNombre").value,
      empresa: $<HTMLInputElement>("#miEmpresa").value,
      area: $<HTMLInputElement>("#miArea").value,
    });

    boton.disabled = false;

    if (!resultado.ok) {
      avisar(
        resultado.motivo === "nombre_vacio"
          ? "Escribe tu nombre completo: es el que aparece en el certificado."
          : "No se pudieron guardar los datos. Revisa tu conexión.",
        "error"
      );
      return;
    }

    avisar("Datos actualizados.", "ok");
  });

  // --- Contraseña ---
  $<HTMLFormElement>("#formClave").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const boton = $<HTMLFormElement>("#formClave").querySelector("button")!;
    boton.disabled = true;

    const resultado = await cambiarMiClave(
      $<HTMLInputElement>("#claveNueva").value,
      $<HTMLInputElement>("#claveRepetida").value
    );

    boton.disabled = false;

    if (!resultado.ok) {
      avisar(explicarRechazoMiClave(resultado.motivo), "error");
      return;
    }

    // Los campos se vacían al terminar: dejar la contraseña escrita en
    // pantalla en un equipo compartido es justo lo que no conviene.
    $<HTMLFormElement>("#formClave").reset();
    avisar("Contraseña cambiada. Úsala la próxima vez que entres.", "ok");
  });

  // --- Preferencias del equipo ---
  //
  // Se aplican al instante, sin botón de guardar. Son ajustes que se evalúan
  // mirando: hay que ver el resultado para saber si es el que se quería.
  $<HTMLInputElement>("#temaClaro").addEventListener("change", (evento) => {
    const claro = (evento.target as HTMLInputElement).checked;
    const tema = claro ? "claro" : "oscuro";
    cambiarPreferencias({ tema });
    // La interfaz del juego lee sus colores al construir cada pantalla, así
    // que se avisa ahora y el menú ya aparece con el tema nuevo.
    aplicarTemaUI(tema);
  });

  const botonesEscala = raiz.querySelectorAll<HTMLButtonElement>("[data-escala]");

  botonesEscala.forEach((boton) => {
    boton.addEventListener("click", () => {
      cambiarPreferencias({ escala: boton.dataset.escala as EscalaTexto });

      // El estado se repinta sobre los botones que ya están, sin rehacer la
      // pantalla: reconstruirla perdería lo que la persona tenga escrito en
      // los campos de datos o de contraseña.
      botonesEscala.forEach((otro) => {
        const activo = otro === boton;
        otro.classList.toggle("portal__opcion--activa", activo);
        otro.setAttribute("aria-pressed", String(activo));
      });
    });
  });

  $<HTMLInputElement>("#silencio").addEventListener("change", (evento) => {
    const silencio = (evento.target as HTMLInputElement).checked;
    cambiarPreferencias({ silencio });
    // El módulo de sonido se entera en el acto: si el ambiente estaba sonando,
    // se corta acá mismo en vez de esperar al próximo nivel.
    establecerSilencio(silencio);
  });

  $<HTMLInputElement>("#miNombre").focus();
}

function plantilla(perfil: Perfil): string {
  const p = leerPreferencias();

  // Botones propios en lugar de un desplegable.
  //
  // La lista que abre un <select> la dibuja el sistema operativo, no la hoja
  // de estilos: en Windows salía en blanco con las opciones ilegibles, y
  // color-scheme no alcanza a arreglarlo en todos los navegadores. Con tres
  // opciones fijas un grupo de botones se ve igual en todas partes, se lee de
  // un vistazo sin desplegar nada, y en pantalla táctil se acierta mejor.
  const opcion = (valor: EscalaTexto, rotulo: string): string =>
    `<button type="button" class="portal__opcion${p.escala === valor ? " portal__opcion--activa" : ""}"
             data-escala="${valor}" aria-pressed="${p.escala === valor}">${rotulo}</button>`;

  return `
    <div class="portal__tarjeta portal__tarjeta--media">
      <div class="portal__filete"></div>
      <div class="portal__cuerpo">

        <h1 class="portal__titulo">Mi cuenta</h1>
        <p class="portal__bajada">${escapar(perfil.identificador)}</p>

      <p class="portal__aviso" id="avisoCuenta" hidden></p>

      <section class="portal__seccion">
        <h2 class="portal__tituloSeccion">Mis datos</h2>
        <p class="portal__nota">
          Estos datos son los que se imprimen en el certificado.
        </p>
        <form id="formDatos">
          <div class="portal__campo">
            <label class="portal__etiqueta" for="miNombre">Nombre completo</label>
            <input class="portal__entrada" id="miNombre" required
                   value="${escapar(perfil.nombreCompleto)}" />
          </div>
          <div class="portal__fila">
            <div class="portal__campo">
              <label class="portal__etiqueta" for="miEmpresa">Empresa</label>
              <input class="portal__entrada" id="miEmpresa" value="${escapar(perfil.empresa)}" />
            </div>
            <div class="portal__campo">
              <label class="portal__etiqueta" for="miArea">Área</label>
              <input class="portal__entrada" id="miArea" value="${escapar(perfil.area)}" />
            </div>
          </div>
          <button class="portal__boton" type="submit">Guardar datos</button>
        </form>
      </section>

      <section class="portal__seccion">
        <h2 class="portal__tituloSeccion">Contraseña</h2>
        <form id="formClave">
          <div class="portal__fila">
            <div class="portal__campo">
              <label class="portal__etiqueta" for="claveNueva">Nueva contraseña</label>
              <input class="portal__entrada" id="claveNueva" type="password" required
                     minlength="${LARGO_MINIMO_CLAVE}"
                     placeholder="mínimo ${LARGO_MINIMO_CLAVE} caracteres" />
            </div>
            <div class="portal__campo">
              <label class="portal__etiqueta" for="claveRepetida">Repite la contraseña</label>
              <input class="portal__entrada" id="claveRepetida" type="password" required />
            </div>
          </div>
          <button class="portal__boton" type="submit">Cambiar contraseña</button>
        </form>
      </section>

      <section class="portal__seccion">
        <h2 class="portal__tituloSeccion">Este equipo</h2>
        <p class="portal__nota">
          Se guardan en este computador, no en tu cuenta: sirven para el puesto,
          los use quien los use.
        </p>

        <label class="portal__ajuste" for="temaClaro">
          <span>
            Tema claro
            <span class="portal__subdato">Solo cambia el portal, no el juego.</span>
          </span>
          <input type="checkbox" id="temaClaro"${p.tema === "claro" ? " checked" : ""} />
        </label>

        <label class="portal__ajuste" for="silencio">
          <span>
            Silenciar sonido
            <span class="portal__subdato">Apaga efectos y ambiente del juego.</span>
          </span>
          <input type="checkbox" id="silencio"${p.silencio ? " checked" : ""} />
        </label>

        <div class="portal__ajuste">
          <span>
            Tamaño de texto
            <span class="portal__subdato">Para pantallas que se miran de lejos.</span>
          </span>
          <div class="portal__grupoOpciones" role="group" aria-label="Tamaño de texto">
            ${opcion("normal", "Normal")}
            ${opcion("grande", "Grande")}
            ${opcion("mayor", "Mayor")}
          </div>
        </div>
      </section>

        <div class="portal__pie">
          <button class="portal__boton portal__boton--secundario" id="volverCuenta" type="button">
            Volver
          </button>
        </div>

      </div>
    </div>`;
}

/** Escapa el texto antes de incrustarlo en el HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}