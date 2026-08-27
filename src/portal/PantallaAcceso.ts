import "./portal.css";
import {
  buscarPerfilPorIdentificador,
  explicarRechazo,
  inscribirPerfilExistente,
  registrarCuenta,
  tieneInscripcion,
  type Perfil,
} from "./Datos";
import { verificarCredenciales, revisarClave, definirClave } from "./Credenciales";
import { abrirSesion } from "./Sesion";

/**
 * Puerta de entrada al curso.
 *
 * Construida en DOM y no con la interfaz de Babylon, a propósito:
 *
 *  - los campos son <input> de verdad, con autocompletado, pegar y el teclado
 *    correcto en celular. El InputText de Babylon reimplementa todo eso y
 *    falla justo en esos detalles;
 *  - no depende del motor 3D. Si Babylon tarda o falla, el portal aparece
 *    igual en vez de dejar una pantalla negra sin explicación.
 *
 * El juego sigue en el canvas; solo la puerta está en el DOM.
 */

export interface ResultadoAcceso {
  perfil: Perfil;
}

export function mostrarAcceso(onEntrar: (resultado: ResultadoAcceso) => void): void {
  const raiz = document.createElement("div");
  raiz.className = "portal";
  raiz.innerHTML = plantilla();
  document.body.appendChild(raiz);

  const $ = <T extends HTMLElement>(selector: string): T => raiz.querySelector(selector) as T;

  const pestanaIngresar = $<HTMLButtonElement>("#pestanaIngresar");
  const pestanaRegistro = $<HTMLButtonElement>("#pestanaRegistro");
  const formIngresar = $<HTMLFormElement>("#formIngresar");
  const formRegistro = $<HTMLFormElement>("#formRegistro");
  const aviso = $<HTMLParagraphElement>("#aviso");

  function mostrarAviso(texto: string, ok = false): void {
    aviso.textContent = texto;
    aviso.className = ok ? "portal__aviso portal__aviso--ok" : "portal__aviso";
    aviso.hidden = false;
  }

  function limpiarAviso(): void {
    aviso.hidden = true;
  }

  function cambiarPestana(aRegistro: boolean): void {
    limpiarAviso();
    pestanaRegistro.setAttribute("aria-selected", String(aRegistro));
    pestanaIngresar.setAttribute("aria-selected", String(!aRegistro));
    formRegistro.hidden = !aRegistro;
    formIngresar.hidden = aRegistro;
  }

  pestanaIngresar.addEventListener("click", () => cambiarPestana(false));
  pestanaRegistro.addEventListener("click", () => cambiarPestana(true));

  function entrar(perfil: Perfil): void {
    abrirSesion(perfil);
    raiz.remove();
    onEntrar({ perfil });
  }

  // --- Ingresar ---
  //
  // Se pide solo el identificador: es un curso interno donde el acceso lo
  // controla el código que entregó el supervisor, no una contraseña por
  // persona. Sumar contraseñas obligaría a recuperarlas, y en planta eso
  // termina en gente que no puede hacer la capacitación.
  formIngresar.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarAviso();

    const identificador = $<HTMLInputElement>("#ingresoIdentificador").value.trim();
    if (!identificador) {
      mostrarAviso("Escribe tu RUT o número de ficha.");
      return;
    }

    const clave = $<HTMLInputElement>("#ingresoClave").value;
    if (!clave) {
      mostrarAviso("Escribe tu contraseña.");
      return;
    }

    const perfil = await buscarPerfilPorIdentificador(identificador);

    // Se verifica SIEMPRE, exista o no el perfil, y el aviso es el mismo en
    // los dos casos. Decir "ese usuario no existe" confirmaría qué RUT están
    // registrados, que es lo primero que un atacante quiere averiguar.
    const verificacion = await verificarCredenciales(identificador, perfil?.id ?? null, clave);

    if (!verificacion.ok) {
      if (verificacion.motivo === "bloqueado") {
        mostrarAviso(
          `Demasiados intentos fallidos. Vuelve a probar en ${verificacion.minutosRestantes} minutos.`
        );
      } else {
        mostrarAviso("El RUT o la contraseña no coinciden.");
      }
      return;
    }

    if (!perfil) {
      mostrarAviso("El RUT o la contraseña no coinciden.");
      return;
    }

    // Clave temporal entregada por el administrador: hay que cambiarla antes
    // de seguir, o quedaría circulando una contraseña que un tercero conoce.
    if (verificacion.debeCambiar) {
      const nueva = window.prompt(
        "Tu contraseña fue restablecida.\n\nEscribe una nueva (mínimo 8 caracteres):"
      );
      if (!nueva) return;
      const revision = revisarClave(nueva);
      if (!revision.ok) {
        mostrarAviso(revision.motivo!);
        return;
      }
      await definirClave(perfil.id, nueva);
    }

    // El administrador entra sin inscripción: no hace el curso, lo administra.
    if (perfil.rol === "administrador") {
      entrar(perfil);
      return;
    }

    if (!(await tieneInscripcion(perfil.id))) {
      const codigo = window.prompt(
        "Estás registrado pero no tienes una inscripción vigente.\n\nEscribe el código que te entregaron:"
      );
      if (!codigo) return;

      const resultado = await inscribirPerfilExistente(perfil, codigo);
      if (!resultado.ok) {
        mostrarAviso(explicarRechazo(resultado.motivo ?? "inexistente"));
        return;
      }
    }

    entrar(perfil);
  });

  // --- Registrarme ---
  formRegistro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarAviso();

    const datos = {
      nombreCompleto: $<HTMLInputElement>("#regNombre").value.trim(),
      identificador: $<HTMLInputElement>("#regIdentificador").value.trim(),
      empresa: $<HTMLInputElement>("#regEmpresa").value.trim(),
      area: $<HTMLInputElement>("#regArea").value.trim(),
      clave: $<HTMLInputElement>("#regClave").value,
    };
    const claveRepetida = $<HTMLInputElement>("#regClave2").value;

    if (!datos.nombreCompleto || !datos.identificador) {
      mostrarAviso("Completa tu nombre y tu RUT o número de ficha.");
      return;
    }

    const revision = revisarClave(datos.clave);
    if (!revision.ok) {
      mostrarAviso(revision.motivo!);
      return;
    }

    // Repetirla evita el caso más común y más molesto: registrarse con una
    // contraseña mal tipeada y quedar afuera desde el primer día.
    if (datos.clave !== claveRepetida) {
      mostrarAviso("Las dos contraseñas no coinciden.");
      return;
    }

    const resultado = await registrarCuenta(datos);
    if (!resultado.ok) {
      mostrarAviso(explicarRechazo(resultado.motivo));
      return;
    }

    entrar(resultado.perfil);
  });

  // Foco en el primer campo: quien llega solo tiene que empezar a escribir.
  $<HTMLInputElement>("#ingresoIdentificador").focus();
}

function plantilla(): string {
  return `
    <div class="portal__tarjeta">
      <div class="portal__filete"></div>
      <div class="portal__cuerpo">
        <p class="portal__rotulo">CAPACITACIÓN</p>
        <h1 class="portal__titulo">Plataforma de capacitación</h1>
        <p class="portal__bajada">
          Ingresa con tu cuenta para ver tus cursos. Si es tu primera vez,
          regístrate: el código de cada curso se pide después.
        </p>

        <div class="portal__pestanas" role="tablist">
          <button type="button" class="portal__pestana" id="pestanaIngresar" role="tab" aria-selected="true">
            Ingresar
          </button>
          <button type="button" class="portal__pestana" id="pestanaRegistro" role="tab" aria-selected="false">
            Registrarme
          </button>
        </div>

        <form id="formIngresar" novalidate>
          <div class="portal__campo">
            <label class="portal__etiqueta" for="ingresoIdentificador">RUT o número de ficha</label>
            <input class="portal__entrada" id="ingresoIdentificador" name="identificador"
                   autocomplete="username" placeholder="12345678-9" />
          </div>

          <div class="portal__campo">
            <label class="portal__etiqueta" for="ingresoClave">Contraseña</label>
            <input class="portal__entrada" id="ingresoClave" name="password" type="password"
                   autocomplete="current-password" placeholder="Tu contraseña" />
          </div>

          <button class="portal__boton" type="submit">Entrar al curso</button>

          <p class="portal__ayuda portal__ayuda--bajoBoton">
            ¿Olvidaste tu contraseña? Pídele a tu supervisor que te la restablezca.
          </p>
        </form>

        <form id="formRegistro" novalidate hidden>
          <div class="portal__campo">
            <label class="portal__etiqueta" for="regNombre">Nombre completo</label>
            <input class="portal__entrada" id="regNombre" autocomplete="name" placeholder="Nombre y apellido" />
          </div>

          <div class="portal__campo">
            <label class="portal__etiqueta" for="regIdentificador">RUT o número de ficha</label>
            <input class="portal__entrada" id="regIdentificador" autocomplete="username" placeholder="12345678-9" />
          </div>

          <div class="portal__fila">
            <div class="portal__campo">
              <label class="portal__etiqueta" for="regEmpresa">Empresa</label>
              <input class="portal__entrada" id="regEmpresa" autocomplete="organization" placeholder="Empresa" />
            </div>
            <div class="portal__campo">
              <label class="portal__etiqueta" for="regArea">Área</label>
              <input class="portal__entrada" id="regArea" placeholder="Planta, bodega, oficina" />
            </div>
          </div>

          

          <div class="portal__campo">
            <label class="portal__etiqueta" for="regClave">Crea tu contraseña</label>
            <input class="portal__entrada" id="regClave" type="password"
                   autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
          </div>

          <div class="portal__campo">
            <label class="portal__etiqueta" for="regClave2">Repite la contraseña</label>
            <input class="portal__entrada" id="regClave2" type="password"
                   autocomplete="new-password" placeholder="La misma otra vez" />
          </div>

          <p class="portal__ayuda">
            La contraseña la vas a necesitar cada vez que entres. El código solo se pide
            ahora, al registrarte.
          </p>
          <p class="portal__ayuda">Te lo entrega tu supervisor. Cada código sirve para una cantidad limitada de personas.</p>

          <button class="portal__boton" type="submit">Registrarme y entrar</button>
        </form>

        <p class="portal__aviso" id="aviso" hidden></p>
      </div>
    </div>
  `;
}