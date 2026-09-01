import "./portal.css";
import {
  cambiarEstadoCodigo,
  darDeBajaInscripcion,
  reactivarInscripcion,
  eliminarPersona,
  cambiarRol,
  explicarRechazoRol,
  crearAdministrador,
  restablecerClave,
  explicarRechazoClave,
  LARGO_MINIMO_CLAVE,
  type ResultadoAltaAdmin,
  crearCodigo,
  listarCodigos,
  listarInscripciones,
  listarPerfiles,
  listarCursos,
  cambiarEstadoCurso,
  type Curso,
  type Codigo,
  type Inscripcion,
  type Perfil,
} from "./Datos";
import {
  exportarPersonas,
  exportarRanking,
  exportarCodigos,
  exportarResumenAreas,
  resumenPorArea,
  type ResumenArea,
} from "./Reportes";
import { mostrarVerificacion } from "./PantallaVerificacion";
import { cerrarSesion, leerSesion } from "./Sesion";
import { rankingCompleto, formatearDuracion, type FilaRankingAdmin } from "./Ranking";
import { CURSO_ID } from "./Datos";

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
    const [perfiles, codigos, inscripciones, cursos, ranking, areas, sesion] = await Promise.all([
      listarPerfiles(),
      listarCodigos(),
      listarInscripciones(),
      listarCursos(),
      // Sin recorte por empresa ni límite: administración necesita la tabla
      // entera. La función de base de datos verifica el rol antes de
      // responder, así que esta llamada falla si no es administrador.
      rankingCompleto(CURSO_ID),
      resumenPorArea(),
      // Hace falta saber quién está mirando para no ofrecerle el botón que le
      // quitaría su propio permiso: la base lo rechaza igual, pero es mejor
      // que el botón no esté a que aparezca y falle.
      leerSesion(),
    ]);

    raiz.innerHTML = plantilla(
      perfiles,
      codigos,
      inscripciones,
      cursos,
      ranking,
      areas,
      sesion?.perfil.id ?? null
    );
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

      const cursoId = $<HTMLSelectElement>("#nuevoCurso").value;
      const lote = $<HTMLInputElement>("#nuevoLote").value;
      const cupos = Number($<HTMLInputElement>("#nuevoCupos").value);
      const dias = Number($<HTMLInputElement>("#nuevoDias").value);
      const nota = $<HTMLInputElement>("#nuevaNota").value;

      // La vigencia se pide en días y la base la guarda como fecha: se
      // convierte acá para que el administrador no tenga que calcularla.
      const venceEn =
        Number.isFinite(dias) && dias > 0
          ? new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
          : null;

      const creado = await crearCodigo({
        cursoId,
        lote,
        usosMaximos: Number.isFinite(cupos) && cupos > 0 ? cupos : 20,
        nota,
        venceEn,
      });

      // El formulario se limpia salvo los cupos: lo habitual es emitir varios
      // lotes seguidos con el mismo tamaño y distinta etiqueta.
      if (creado) {
        $<HTMLInputElement>("#nuevoLote").value = "";
        $<HTMLInputElement>("#nuevaNota").value = "";
      }

      await pintar();

      // Se avisa el código recién creado porque es el dato que el supervisor
      // tiene que copiar y repartir; si se pierde entre la tabla, hay que
      // buscarlo a ojo.
      avisar(
        creado
          ? `Código creado: ${creado.codigo}`
          : "No se pudo crear el código. Revisa tu conexión.",
        creado ? "ok" : "error"
      );
    });

    $<HTMLFormElement>("#formAdmin").addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const boton = $<HTMLFormElement>("#formAdmin").querySelector("button")!;
      const clave = $<HTMLInputElement>("#adminClave").value;

      // El botón se bloquea mientras trabaja: crear la cuenta son tres viajes
      // al servidor y un segundo envío dejaría dos cuentas a medio hacer.
      boton.disabled = true;

      const resultado = await crearAdministrador({
        nombreCompleto: $<HTMLInputElement>("#adminNombre").value,
        identificador: $<HTMLInputElement>("#adminIdentificador").value,
        empresa: $<HTMLInputElement>("#adminEmpresa").value,
        area: $<HTMLInputElement>("#adminArea").value,
        clave,
      });

      boton.disabled = false;

      if (!resultado.ok) {
        avisar(explicarRechazoAlta(resultado.motivo), "error");
        // La cuenta quedó creada pero sin el ascenso: conviene refrescar para
        // que aparezca en la tabla y se pueda terminar con un clic.
        if (resultado.motivo === "rol_pendiente") await pintar();
        return;
      }

      $<HTMLFormElement>("#formAdmin").reset();
      await pintar();
      avisar(`${resultado.perfil.nombreCompleto} ya puede entrar al panel.`, "ok");
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-codigo]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const codigo = boton.dataset.codigo!;
        const activar = boton.dataset.accion === "activar";
        await cambiarEstadoCodigo(codigo, activar);
        await pintar();
      });
    });

    raiz.querySelector<HTMLButtonElement>("#abrirVerificacion")?.addEventListener("click", () => {
      // El panel se retira y se vuelve a pintar al cerrar el verificador: es
      // más limpio que superponer pantallas, y garantiza que los datos que se
      // ven al volver estén al día.
      raiz.remove();
      mostrarVerificacion({ onVolver: () => mostrarAdministracion(onSalir) });
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-reporte]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const tipo = boton.dataset.reporte!;
        const etiqueta = boton.querySelector(".reporte__nombre")!.textContent;

        // El botón se desactiva mientras arma el archivo. Con muchas filas la
        // consulta tarda, y sin esta señal el administrador vuelve a hacer
        // clic y se descarga el mismo reporte tres veces.
        boton.disabled = true;
        boton.classList.add("reporte--trabajando");

        try {
          const cuantas =
            tipo === "personas" ? await exportarPersonas()
            : tipo === "ranking" ? await exportarRanking()
            : tipo === "areas" ? await exportarResumenAreas()
            : await exportarCodigos();

          avisar(
            cuantas === 0
              ? `${etiqueta}: no hay datos para exportar todavía.`
              : `${etiqueta}: ${cuantas} ${cuantas === 1 ? "fila descargada" : "filas descargadas"}.`,
            cuantas === 0 ? "error" : "ok"
          );
        } catch (error) {
          console.error("[reportes]", error);
          avisar("No se pudo generar el reporte. Revisa tu conexión.", "error");
        } finally {
          boton.disabled = false;
          boton.classList.remove("reporte--trabajando");
        }
      });
    });

    raiz.querySelectorAll<HTMLButtonElement>("[data-curso]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        await cambiarEstadoCurso(boton.dataset.curso!, boton.dataset.accion === "publicar");
        await pintar();
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

    // Restablecer clave tambien confirma en dos pasos: genera una contrasenia
    // nueva, y la anterior deja de servir en el acto.
    raiz.querySelectorAll<HTMLButtonElement>("[data-clave]").forEach((boton) => {
      const etiqueta = boton.textContent ?? "";
      let confirmando = false;

      boton.addEventListener("click", async () => {
        if (!confirmando) {
          confirmando = true;
          boton.textContent = "Confirmar";
          boton.classList.add("portal__accion--confirma");
          return;
        }

        boton.disabled = true;
        const resultado = await restablecerClave(boton.dataset.clave!);

        confirmando = false;
        boton.disabled = false;
        boton.textContent = etiqueta;
        boton.classList.remove("portal__accion--confirma");

        if (!resultado.ok) {
          avisar(explicarRechazoClave(resultado.motivo), "error");
          return;
        }

        // El aviso NO se refresca con pintar() a proposito: repintar borraria
        // la banda y con ella la unica copia de la clave. No queda guardada en
        // ninguna parte legible, asi que si se pierde hay que generar otra.
        const nombre = boton.closest("tr")?.querySelector("strong")?.textContent ?? "la persona";
        avisar(
          `Clave temporal de ${nombre}: ${resultado.clave} — anotala ahora, no se vuelve a mostrar.`,
          "ok"
        );
      });
    });

    // Dar o quitar administrador confirma en el propio botón, igual que
    // eliminar: es un permiso, no una preferencia, y conviene que cueste un
    // clic de más.
    raiz.querySelectorAll<HTMLButtonElement>("[data-rol]").forEach((boton) => {
      const etiqueta = boton.textContent ?? "";
      let confirmando = false;

      boton.addEventListener("click", async () => {
        if (!confirmando) {
          confirmando = true;
          boton.textContent = "Confirmar";
          boton.classList.add("portal__accion--confirma");
          return;
        }

        boton.disabled = true;
        const nuevoRol = boton.dataset.accion === "promover" ? "administrador" : "trabajador";
        const resultado = await cambiarRol(boton.dataset.rol!, nuevoRol);

        if (!resultado.ok) {
          // Se deshace la confirmación para que el botón vuelva a su estado
          // normal en vez de quedar pidiendo un clic que ya no va a funcionar.
          confirmando = false;
          boton.disabled = false;
          boton.textContent = etiqueta;
          boton.classList.remove("portal__accion--confirma");
          avisar(explicarRechazoRol(resultado.motivo), "error");
          return;
        }

        await pintar();
        avisar(
          nuevoRol === "administrador"
            ? "Ahora es administrador. Verá el panel la próxima vez que entre."
            : "Vuelve a ser trabajador.",
          "ok"
        );
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

/** Texto para el administrador cuando el alta no procede. */
function explicarRechazoAlta(motivo: Exclude<ResultadoAltaAdmin, { ok: true }>["motivo"]): string {
  switch (motivo) {
    case "identificador_repetido":
      return "Ese RUT o correo ya tiene cuenta. Búscalo en la tabla y dale Hacer admin.";
    case "clave_corta":
      return `La contraseña necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
    case "rol_pendiente":
      return "La cuenta se creó, pero quedó como trabajador. Dale Hacer admin en la tabla.";
    default:
      return "No se pudo crear la cuenta. Revisa tu conexión.";
  }
}

function plantilla(
  perfiles: Perfil[],
  codigos: Codigo[],
  inscripciones: Inscripcion[],
  cursos: Curso[],
  ranking: FilaRankingAdmin[],
  areas: ResumenArea[],
  perfilPropio: string | null
): string {
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
          <h2 class="portal__tituloSeccion">Verificar un certificado</h2>
          <p class="portal__nota portal__nota--arriba">
            Comprueba si un certificado presentado por alguien fue emitido por esta
            plataforma. Basta el código impreso al pie del documento.
          </p>
          <button class="reporte" type="button" id="abrirVerificacion">
            <span class="reporte__nombre">Abrir verificador</span>
            <span class="reporte__desc">
              Escribe el código y confirma nombre, curso, puntaje y fecha de emisión
            </span>
          </button>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Reportes</h2>
          <p class="portal__nota portal__nota--arriba">
            Archivos Excel con formato, listos para archivar o adjuntar.
          </p>

          <div class="reportes">
            <button class="reporte" type="button" data-reporte="personas">
              <span class="reporte__nombre">Personas y avance</span>
              <span class="reporte__desc">Una fila por inscripción, con fases completadas y estado</span>
            </button>
            <button class="reporte" type="button" data-reporte="ranking">
              <span class="reporte__nombre">Ranking completo</span>
              <span class="reporte__desc">Todos los participantes ordenados por puntaje</span>
            </button>
            <button class="reporte" type="button" data-reporte="areas">
              <span class="reporte__nombre">Resumen por área</span>
              <span class="reporte__desc">Cobertura de la capacitación en cada área</span>
            </button>
            <button class="reporte" type="button" data-reporte="codigos">
              <span class="reporte__nombre">Códigos emitidos</span>
              <span class="reporte__desc">Consumo de cupos y vigencia de cada código</span>
            </button>
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Cobertura por área</h2>
          <div class="portal__tablaEnvoltura">
            ${tablaAreas(areas)}
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Cursos de la plataforma</h2>
          <div class="portal__tablaEnvoltorio">
            ${tablaCursos(cursos, inscripciones)}
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Agregar administrador</h2>
          <form id="formAdmin">
            <div class="portal__fila">
              <div class="portal__campo">
                <label class="portal__etiqueta" for="adminNombre">Nombre completo</label>
                <input class="portal__entrada" id="adminNombre" required />
              </div>
              <div class="portal__campo">
                <label class="portal__etiqueta" for="adminIdentificador">RUT o correo</label>
                <input class="portal__entrada" id="adminIdentificador" required />
              </div>
            </div>
            <div class="portal__fila">
              <div class="portal__campo">
                <label class="portal__etiqueta" for="adminEmpresa">Empresa</label>
                <input class="portal__entrada" id="adminEmpresa" />
              </div>
              <div class="portal__campo">
                <label class="portal__etiqueta" for="adminArea">Área</label>
                <input class="portal__entrada" id="adminArea" placeholder="Capacitación" />
              </div>
              <div class="portal__campo">
                <label class="portal__etiqueta" for="adminClave">Contraseña</label>
                <input class="portal__entrada" id="adminClave" type="password" required
                       minlength="${LARGO_MINIMO_CLAVE}" placeholder="mínimo ${LARGO_MINIMO_CLAVE} caracteres" />
              </div>
            </div>
            <button class="portal__boton" type="submit">Crear administrador</button>
          </form>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Emitir código</h2>
          <form id="formCodigo">
            <div class="portal__fila">
              <div class="portal__campo">
                <label class="portal__etiqueta" for="nuevoCurso">Curso</label>
                <select class="portal__entrada" id="nuevoCurso">
                  ${cursos
                    .filter((c) => c.activo)
                    .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
                    .join("")}
                </select>
              </div>

              <div class="portal__campo">
                <label class="portal__etiqueta" for="nuevoLote">Lote</label>
                <input class="portal__entrada" id="nuevoLote" placeholder="PLANTA" maxlength="10" />
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
            ${tablaCodigos(codigos, cursos)}
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Ranking del curso</h2>
          <div class="portal__tablaEnvoltura">
            ${tablaRanking(ranking)}
          </div>
        </section>

        <section class="portal__seccion">
          <h2 class="portal__tituloSeccion">Personas registradas</h2>
          <div class="portal__tablaEnvoltura">
            ${tablaPersonas(perfiles, inscripciones, cursos, perfilPropio)}
          </div>
        </section>
      </div>
    </div>
  `;
}

/**
 * Cuántos completaron el curso en cada área.
 *
 * Es lo primero que mira una jefatura: no le interesa persona por persona, le
 * interesa si su área está al día. Y hace visible que un turno completo quedó
 * sin capacitar, algo que en una lista de cien nombres pasa desapercibido.
 */
function tablaAreas(areas: ResumenArea[]): string {
  if (areas.length === 0) {
    return `<p class="portal__vacio">Todavía no hay personas inscritas.</p>`;
  }

  const filas = areas
    .map((a) => {
      // Bajo 50% se marca en rojo: es el umbral donde deja de ser un
      // rezago normal y pasa a ser algo que hay que ir a mirar.
      const color = a.cobertura >= 80 ? "ok" : a.cobertura >= 50 ? "media" : "baja";
      return `
        <tr>
          <td>${a.area}</td>
          <td>${a.inscritos}</td>
          <td>${a.completados}</td>
          <td>${a.enCurso}</td>
          <td>${a.sinEmpezar}</td>
          <td>
            <div class="cobertura">
              <div class="cobertura__carril">
                <span class="cobertura__barra cobertura__barra--${color}" style="width:${a.cobertura}%"></span>
              </div>
              <span class="cobertura__cifra">${a.cobertura}%</span>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr>
          <th>Área</th><th>Inscritos</th><th>Completados</th>
          <th>En curso</th><th>Sin empezar</th><th>Cobertura</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function tablaCodigos(codigos: Codigo[], cursos: Curso[]): string {
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
          <td>${cursos.find((x) => x.id === c.cursoId)?.nombre ?? c.cursoId}</td>
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
          <th>Código</th><th>Curso</th><th>Usos</th><th>Vigencia</th><th>Estado</th><th>Nota</th><th></th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

/**
 * Cursos publicados, con cuánta gente hay inscrita en cada uno.
 *
 * Retirar un curso no lo borra: deja de aparecer en el catálogo pero conserva
 * las inscripciones y el historial de quienes ya lo hicieron. Borrarlo haría
 * desaparecer la prueba de esas capacitaciones.
 */

/**
 * Ranking completo, tal como lo ve administración.
 *
 * A diferencia del que ve el trabajador, acá va la lista entera y con la
 * empresa a la vista: es la información que hace falta para comparar áreas,
 * detectar quién quedó a mitad de camino y decidir a quién acompañar.
 *
 * El orden lo define la base de datos —puntaje descendente, y a igual puntaje
 * gana el menor tiempo—, así que esta función solo dibuja.
 */
function tablaRanking(ranking: FilaRankingAdmin[]): string {
  if (ranking.length === 0) {
    return `<p class="portal__vacio">Todavía nadie completó una fase de este curso.</p>`;
  }

  const filas = ranking
    .map(
      (f) => `
        <tr>
          <td>${f.posicion}</td>
          <td>${f.nombreCompleto}</td>
          <td>${f.empresa || "—"}</td>
          <td>${f.area || "—"}</td>
          <td>${f.fasesAprobadas} de 5</td>
          <td>${f.puntajeTotal}</td>
          <td>${formatearDuracion(f.segundosTotal)}</td>
        </tr>`
    )
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr>
          <th>#</th><th>Nombre</th><th>Empresa</th><th>Área</th>
          <th>Fases</th><th>Puntaje</th><th>Tiempo</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function tablaCursos(cursos: Curso[], inscripciones: Inscripcion[]): string {
  if (cursos.length === 0) {
    return `<p class="portal__vacio">Todavía no hay cursos publicados.</p>`;
  }

  const filas = cursos
    .map((curso) => {
      const inscritos = inscripciones.filter((i) => i.cursoId === curso.id && i.activa).length;
      const estado = curso.activo
        ? `<span class="portal__estado portal__estado--activo">Publicado</span>`
        : `<span class="portal__estado portal__estado--baja">Retirado</span>`;
      const accion = curso.activo
        ? `<button class="portal__accion" data-curso="${curso.id}" data-accion="retirar">Retirar</button>`
        : `<button class="portal__accion" data-curso="${curso.id}" data-accion="publicar">Publicar</button>`;

      return `
        <tr class="${curso.activo ? "" : "portal__fila--baja"}">
          <td>${curso.nombre}</td>
          <td>${curso.totalFases} fases</td>
          <td>${curso.duracionMinutos} min</td>
          <td>${inscritos}</td>
          <td>${estado}</td>
          <td class="portal__acciones">${accion}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla">
      <thead>
        <tr><th>Curso</th><th>Fases</th><th>Duración</th><th>Inscritos</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p class="portal__nota">
      Un curso retirado deja de aparecer en el catálogo, pero conserva las inscripciones
      y el historial de quienes ya lo cursaron.
    </p>`;
}

function tablaPersonas(
  perfiles: Perfil[],
  inscripciones: Inscripcion[],
  cursos: Curso[],
  perfilPropio: string | null
): string {
  if (perfiles.length === 0) {
    return `<p class="portal__vacio">Todav\u00eda no se registr\u00f3 nadie.</p>`;
  }

  const filas = perfiles
    .map((p) => {
      const inscripcion = inscripciones.find((i) => i.perfilId === p.id);
      const activa = inscripcion?.activa ?? false;

      // El avance vive hoy en el navegador de cada equipo, no ac\u00e1. Hasta que
      // el progreso viaje al servidor se asume sin avance, que es el caso en
      // el que eliminar es seguro. Cuando el dato exista, esta l\u00ednea es lo
      // \u00fanico que cambia.
      const sinAvance = true;

      const esAdmin = p.rol === "administrador";
      const esUnoMismo = p.id === perfilPropio;

      const rol = esAdmin
        ? `<span class="portal__estado portal__estado--activo">Administrador</span>`
        : `<span class="portal__estado portal__estado--neutro">Trabajador</span>`;

      const estado = !inscripcion
        ? `<span class="portal__estado portal__estado--neutro">Sin inscripci\u00f3n</span>`
        : activa
          ? `<span class="portal__estado portal__estado--activo">Activa</span>`
          : `<span class="portal__estado portal__estado--baja">De baja</span>`;

      const curso = inscripcion
        ? cursos.find((c) => c.id === inscripcion.cursoId)?.nombre ?? "\u2014"
        : "\u2014";

      const acciones: string[] = [];

      // El propio administrador no ve el bot\u00f3n sobre su fila: quitarse el
      // permiso es la forma m\u00e1s f\u00e1cil de quedarse afuera del panel.
      if (!esUnoMismo) {
        acciones.push(
          esAdmin
            ? `<button class="portal__accion" data-rol="${p.id}" data-accion="degradar">Quitar admin</button>`
            : `<button class="portal__accion" data-rol="${p.id}" data-accion="promover">Hacer admin</button>`
        );
      }

      // Restablecer clave se ofrece siempre, tambien sobre la propia fila: es
      // el caso legitimo de un administrador que perdio la suya y todavia
      // tiene la sesion abierta.
      acciones.push(
        `<button class="portal__accion" data-clave="${p.id}">Restablecer clave</button>`
      );

      // Dar de baja es lo cotidiano y es reversible; eliminar borra el
      // registro y solo se ofrece cuando no hay nada que perder.
      if (inscripcion && activa) {
        acciones.push(
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

      // Seis columnas en vez de diez: los datos que siempre se leen juntos
      // \u2014nombre y ficha, empresa y \u00e1rea, curso y c\u00f3digo, estado y fecha\u2014
      // van apilados en una sola celda. No se pierde ning\u00fan dato y la tabla
      // entra en la tarjeta sin barra de desplazamiento.
      return `
        <tr class="${activa || !inscripcion ? "" : "portal__fila--baja"}">
          <td class="portal__apilada">
            <strong>${escapar(p.nombreCompleto)}</strong>
            <span class="portal__subdato">${escapar(p.identificador)}</span>
          </td>
          <td class="portal__apilada">
            ${escapar(p.empresa) || "\u2014"}
            <span class="portal__subdato">${escapar(p.area) || "\u2014"}</span>
          </td>
          <td>${rol}</td>
          <td class="portal__apilada">
            ${escapar(curso)}
            <span class="portal__subdato portal__subdato--codigo">${escapar(inscripcion?.codigoUsado || "\u2014")}</span>
          </td>
          <td class="portal__apilada">
            ${estado}
            <span class="portal__subdato">${inscripcion ? fecha(inscripcion.inscritoEn) : "\u2014"}</span>
          </td>
          <td class="portal__acciones">${acciones.join("")}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="portal__tabla portal__tabla--personas">
      <thead>
        <tr>
          <th>Persona</th><th>Empresa / \u00e1rea</th><th>Rol</th>
          <th>Curso</th><th>Inscripci\u00f3n</th><th></th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p class="portal__nota">
      Dar de baja libera el cupo del c\u00f3digo y conserva el historial. Eliminar
      borra el registro. Para sumar un administrador, la persona se registra con
      un c\u00f3digo y ac\u00e1 se le cambia el rol.
    </p>`;
}

/**
 * Escapa el texto que viene de la base antes de incrustarlo en el HTML.
 *
 * Los nombres, empresas y \u00e1reas los escribe cada persona al registrarse. Sin
 * esto, alguien que ponga etiquetas HTML en su nombre las ejecuta en el
 * navegador del administrador, que es justamente quien m\u00e1s permisos tiene.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}