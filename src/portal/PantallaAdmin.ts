import "./portal.css";
import {
  cambiarEstadoCodigo,
  darDeBajaInscripcion,
  reactivarInscripcion,
  eliminarPersona,
  crearCodigo,
  listarCodigos,
  listarInscripciones,
  listarPerfiles,
  type Codigo,
  type Inscripcion,
  type Perfil,
} from "./Datos";
import { restablecerClave, generarClaveTemporal } from "./Credenciales";
import { cerrarSesion } from "./Sesion";

/**
 * Vista de administración.
 *
 * Es para gestionar el curso, no para jugarlo: desde acá se emiten los códigos
 * que habilitan la entrada y se ve quién se inscribió con cada uno. Por eso el
 * administrador no pasa por el menú de niveles — no tendría sentido llevarlo a
 * clasificar herramientas.
 *
 * Todo lo que se ve acá sale de src/portal/Datos.ts. Cuando exista el servidor,
 * esta pantalla no cambia: cambia de dónde vienen los datos.
 */
export function mostrarAdministracion(onSalir: () => void): void {
  const raiz = document.createElement("div");
  raiz.className = "portal portal--ancho";
  document.body.appendChild(raiz);

  void pintar();

  async function pintar(): Promise<void> {
    const [perfiles, codigos, inscripciones] = await Promise.all([
      listarPerfiles(),
      listarCodigos(),
      listarInscripciones(),
    ]);

    raiz.innerHTML = plantilla(perfiles, codigos, inscripciones);
    conectar();
  }

  function conectar(): void {
    const $ = <T extends HTMLElement>(sel: string): T => raiz.querySelector(sel) as T;

    $<HTMLButtonElement>("#btnSalirAdmin").addEventListener("click", () => {
      cerrarSesion();
      raiz.remove();
      onSalir();
    });

    $<HTMLFormElement>("#formCodigo").addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const prefijo = $<HTMLInputElement>("#nuevoPrefijo").value;
      const cupos = Number($<HTMLInputElement>("#nuevoCupos").value);
      const dias = Number($<HTMLInputElement>("#nuevoDias").value);
      const nota = $<HTMLInputElement>("#nuevaNota").value;

      const creado = await crearCodigo({
        prefijo,
        usosMaximos: Number.isFinite(cupos) && cupos > 0 ? cupos : 20,
        nota,
        diasVigencia: Number.isFinite(dias) && dias > 0 ? dias : null,
      });

      await pintar();

      // Se avisa el código recién creado porque es el dato que el supervisor
      // tiene que copiar y repartir; si se pierde entre la tabla, hay que
      // buscarlo a ojo.
      const banda = raiz.querySelector<HTMLParagraphElement>("#avisoAdmin");
      if (banda) {
        banda.textContent = `Código creado: ${creado.codigo}`;
        banda.className = "portal__aviso portal__aviso--ok";
        banda.hidden = false;
      }
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-codigo]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const codigo = boton.dataset.codigo!;
        const activar = boton.dataset.accion === "activar";
        await cambiarEstadoCodigo(codigo, activar);
        await pintar();
      });
    });

    // Restablecer contraseña. En planta no todos tienen correo, así que no hay
    // enlaces de recuperación: el administrador genera una clave temporal y se
    // la dicta a la persona, que está obligada a cambiarla al entrar.
    raiz.querySelectorAll<HTMLButtonElement>("[data-clave]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const temporal = generarClaveTemporal();
        await restablecerClave(boton.dataset.clave!, temporal);
        avisar(
          `Clave temporal: ${temporal} — dísela a la persona. Deberá cambiarla al entrar.`,
          "ok"
        );
      });
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-baja]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        await darDeBajaInscripcion(boton.dataset.baja!);
        await pintar();
        avisar("Inscripción dada de baja. El cupo del código quedó libre.", "ok");
      });
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-reactivar]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        await reactivarInscripcion(boton.dataset.reactivar!);
        await pintar();
        avisar("Inscripción reactivada.", "ok");
      });
    });

    // Eliminar borra el registro y no se puede deshacer, así que pide una
    // confirmación en el propio botón: el primer clic avisa, el segundo
    // ejecuta. Sin ventanas encima de ventanas, igual que en el ranking.
    raiz.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach((boton) => {
      let confirmando = false;
      boton.addEventListener("click", async () => {
        if (!confirmando) {
          confirmando = true;
          boton.textContent = "Confirmar";
          boton.classList.add("portal__accion--confirma");
          return;
        }
        await eliminarPersona(boton.dataset.eliminar!);
        await pintar();
        avisar("Registro eliminado.", "ok");
      });
    });
  }

  // Banda de aviso, compartida por todas las acciones de la pantalla.
  function avisar(texto: string, tipo: "ok" | "error"): void {
    const banda = raiz.querySelector<HTMLParagraphElement>("#avisoAdmin");
    if (!banda) return;
    banda.textContent = texto;
    banda.className = `portal__aviso portal__aviso--${tipo}`;
    banda.hidden = false;
  }
}

function plantilla(perfiles: Perfil[], codigos: Codigo[], inscripciones: Inscripcion[]): string {
  const trabajadores = perfiles.filter((p) => p.rol === "trabajador");

  return `
    <div class="portal__tarjeta portal__tarjeta--ancha">
      <div class="portal__filete portal__filete--admin"></div>
      <div class="portal__cuerpo">
        <div class="portal__encabezadoAdmin">
          <div>
            <p class="portal__rotulo">ADMINISTRACIÓN</p>
            <h1 class="portal__titulo">Curso 5S</h1>
            <p class="portal__bajada" style="margin-bottom:0">
              ${trabajadores.length} persona${trabajadores.length === 1 ? "" : "s"} registrada${trabajadores.length === 1 ? "" : "s"}
              · ${inscripciones.length} inscripci${inscripciones.length === 1 ? "ón" : "ones"}
              · ${codigos.length} código${codigos.length === 1 ? "" : "s"}
            </p>
          </div>
          <button class="portal__boton portal__boton--secundario" id="btnSalirAdmin" type="button">
            Cerrar sesión
          </button>
        </div>

        <p class="portal__aviso" id="avisoAdmin" hidden></p>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Emitir código</h2>
          <form id="formCodigo">
            <div class="portal__fila">
              <div class="portal__campo">
                <label class="portal__etiqueta" for="nuevoPrefijo">Lote</label>
                <input class="portal__entrada" id="nuevoPrefijo" placeholder="PLANTA" />
              </div>
              <div class="portal__campo">
                <label class="portal__etiqueta" for="nuevoCupos">Cupos</label>
                <input class="portal__entrada" id="nuevoCupos" type="number" min="1" value="20" />
              </div>
              <div class="portal__campo">
                <label class="portal__etiqueta" for="nuevoDias">Días de vigencia</label>
                <input class="portal__entrada" id="nuevoDias" type="number" min="0" placeholder="sin vencimiento" />
              </div>
            </div>
            <div class="portal__campo">
              <label class="portal__etiqueta" for="nuevaNota">Nota interna</label>
              <input class="portal__entrada" id="nuevaNota" placeholder="Turno mañana — planta principal" />
            </div>
            <button class="portal__boton" type="submit">Generar código</button>
          </form>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Códigos emitidos</h2>
          <div class="portal__tablaEnvoltura">
            ${tablaCodigos(codigos)}
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Personas inscritas</h2>
          <div class="portal__tablaEnvoltura">
            ${tablaPersonas(trabajadores, inscripciones)}
          </div>
        </section>
      </div>
    </div>
  `;
}

function tablaCodigos(codigos: Codigo[]): string {
  if (codigos.length === 0) {
    return `<p class="portal__vacio">Todavía no hay códigos emitidos.</p>`;
  }

  const filas = codigos
    .map((c) => {
      const vencido = Boolean(c.venceEn && new Date(c.venceEn).getTime() < Date.now());
      const agotado = c.usosActuales >= c.usosMaximos;

      let estado = `<span class="portal__insignia portal__insignia--ok">Disponible</span>`;
      if (!c.activo) estado = `<span class="portal__insignia portal__insignia--baja">Dado de baja</span>`;
      else if (vencido) estado = `<span class="portal__insignia portal__insignia--baja">Vencido</span>`;
      else if (agotado) estado = `<span class="portal__insignia portal__insignia--gastado">Sin cupos</span>`;

      const accion = c.activo
        ? `<button class="portal__boton portal__boton--secundario" data-codigo="${c.codigo}" data-accion="baja">Dar de baja</button>`
        : `<button class="portal__boton portal__boton--secundario" data-codigo="${c.codigo}" data-accion="activar">Reactivar</button>`;

      return `
        <tr>
          <td class="portal__codigo">${c.codigo}</td>
          <td>${c.usosActuales} / ${c.usosMaximos}</td>
          <td>${c.venceEn ? fecha(c.venceEn) : "Sin vencimiento"}</td>
          <td>${estado}</td>
          <td>${c.nota || "—"}</td>
          <td>${accion}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr>
          <th>Código</th><th>Usos</th><th>Vigencia</th><th>Estado</th><th>Nota</th><th></th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function tablaPersonas(perfiles: Perfil[], inscripciones: Inscripcion[]): string {
  if (perfiles.length === 0) {
    return `<p class="portal__vacio">Todavía no se registró nadie.</p>`;
  }

  const filas = perfiles
    .map((p) => {
      const inscripcion = inscripciones.find((i) => i.perfilId === p.id);
      const activa = inscripcion?.activa ?? false;

      // El avance vive hoy en el navegador de cada equipo, no acá. Hasta que
      // el progreso viaje al servidor se asume sin avance, que es el caso en
      // el que eliminar es seguro. Cuando el dato exista, esta línea es lo
      // único que cambia.
      const sinAvance = true;

      const estado = !inscripcion
        ? `<span class="portal__estado portal__estado--neutro">Sin inscripción</span>`
        : activa
          ? `<span class="portal__estado portal__estado--activo">Activa</span>`
          : `<span class="portal__estado portal__estado--baja">De baja</span>`;

      // Dos acciones distintas a propósito. Dar de baja es lo cotidiano y es
      // reversible; eliminar borra el registro y solo se ofrece cuando no hay
      // nada que perder.
      const acciones: string[] = [];
      if (inscripcion && activa) {
        acciones.push(
          `<button class="portal__accion" data-clave="${p.id}">Restablecer clave</button>`,
          `<button class="portal__accion" data-baja="${inscripcion.id}">Dar de baja</button>`
        );
      }
      if (inscripcion && !activa) {
        acciones.push(
          `<button class="portal__accion" data-reactivar="${inscripcion.id}">Reactivar</button>`
        );
      }
      if (sinAvance) {
        acciones.push(
          `<button class="portal__accion portal__accion--riesgo" data-eliminar="${p.id}">Eliminar</button>`
        );
      }

      return `
        <tr class="${activa || !inscripcion ? "" : "portal__fila--baja"}">
          <td>${p.nombreCompleto}</td>
          <td>${p.identificador}</td>
          <td>${p.empresa || "—"}</td>
          <td>${p.area || "—"}</td>
          <td class="portal__codigo">${inscripcion?.codigoUsado ?? "—"}</td>
          <td>${inscripcion ? fecha(inscripcion.inscritoEn) : "—"}</td>
          <td>${estado}</td>
          <td class="portal__acciones">${acciones.join("")}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr>
          <th>Nombre</th><th>RUT / ficha</th><th>Empresa</th><th>Área</th>
          <th>Código usado</th><th>Inscripción</th><th>Estado</th><th></th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p class="portal__nota">
      Dar de baja libera el cupo del código y conserva el historial de la persona.
      Eliminar borra el registro y solo está disponible mientras no haya avance.
    </p>`;
}

function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}