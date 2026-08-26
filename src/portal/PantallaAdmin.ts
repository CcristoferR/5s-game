import "./portal.css";
import {
  cambiarEstadoCodigo,
  crearCodigo,
  listarCodigos,
  listarInscripciones,
  listarPerfiles,
  type Codigo,
  type Inscripcion,
  type Perfil,
} from "./Datos";
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
      return `
        <tr>
          <td>${p.nombreCompleto}</td>
          <td>${p.identificador}</td>
          <td>${p.empresa || "—"}</td>
          <td>${p.area || "—"}</td>
          <td class="portal__codigo">${inscripcion?.codigoUsado ?? "—"}</td>
          <td>${inscripcion ? fecha(inscripcion.inscritoEn) : "Sin inscripción"}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr>
          <th>Nombre</th><th>RUT / ficha</th><th>Empresa</th><th>Área</th><th>Código usado</th><th>Inscripción</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}