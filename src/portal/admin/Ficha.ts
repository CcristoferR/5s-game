// ===========================================================================
// Ficha de una persona
// ===========================================================================
//
// Antes cada fila de la tabla de personas cargaba hasta cinco botones —hacer
// admin, clave, suspender, dar de baja, eliminar— y con doscientas filas eso
// era un muro de acciones donde era fácil apretar la de al lado. Ahora la fila
// solo abre esta ficha, y las acciones viven acá, junto a lo que se sabe de la
// persona: así se actúa sabiendo sobre quién.
//
// La ficha es un <dialog> modal: mientras está abierta, el resto del panel no
// recibe clics, y Esc la cierra. Las acciones que no tienen vuelta atrás piden
// un segundo clic, como en el resto del panel.

import { describirCurso } from "../CatalogoCursos";
import { icono } from "../Iconos";
import type { Matricula } from "./Indicadores";
import { estaDetenida } from "./Indicadores";
import type { DatosPanel } from "./Vistas";
import { duracion, escapar, fechaCorta, haceCuanto, iniciales, numero } from "./Formato";

export function fichaHtml(d: DatosPanel, perfilId: string, claveTemporal: string | null): string {
  const p = d.perfiles.find((x) => x.id === perfilId);
  if (!p) {
    return `
      <div class="ficha__cabeza">
        <h2 class="ficha__nombre" id="fichaNombre" tabindex="-1">Persona no encontrada</h2>
        <button class="icono-boton" type="button" data-accion="cerrar-ficha" aria-label="Cerrar ficha">${icono("cerrar")}</button>
      </div>
      <div class="ficha__cuerpo"><p class="tenue">Esta cuenta ya no existe. Puede que la haya eliminado otra persona.</p></div>`;
  }

  const propia = p.id === d.perfilPropio?.id;
  const esAdmin = p.rol === "administrador";
  const matriculas = d.matriculas
    .filter((m) => m.perfil.id === p.id)
    .sort((a, b) => Number(b.inscripcion.activa) - Number(a.inscripcion.activa));

  const etiquetas = [
    esAdmin ? `<span class="chip chip--dato">${icono("admin")}Administrador</span>` : "",
    p.suspendido ? `<span class="chip chip--error">${icono("pausa")}Cuenta suspendida</span>` : "",
    propia ? `<span class="chip chip--marca">Tu cuenta</span>` : "",
  ].join("");

  const clave = claveTemporal
    ? `
      <div class="ficha__clave" role="status">
        <span class="ficha__claveRotulo">${icono("llave")}Clave temporal</span>
        <code class="ficha__claveValor">${escapar(claveTemporal)}</code>
        <button class="boton-secundario" type="button" data-accion="copiar" data-texto="${escapar(claveTemporal)}">${icono("copiar")}Copiar</button>
        <p>Díctasela ahora: no queda guardada en ninguna parte y no se vuelve a mostrar. La anterior ya no sirve.</p>
      </div>`
    : "";

  const cursos =
    matriculas.length === 0
      ? `<p class="tenue">${esAdmin ? "Las cuentas de administración no se inscriben a cursos." : "Sin inscripciones. Se inscribe canjeando un código en su catálogo."}</p>`
      : matriculas.map((m) => bloqueCurso(d, m)).join("");

  // Lo que la base rechaza no se ofrece: otro administrador no se suspende
  // ni se le cambia la clave desde acá, y nadie se quita el rol a sí mismo.
  const acciones: string[] = [];

  if (!esAdmin || propia) {
    acciones.push(filaAccion(
      "Restablecer contraseña",
      "Genera una clave temporal para dictársela. La actual deja de servir.",
      `<button class="accion" type="button" data-accion="clave" data-perfil="${escapar(p.id)}" data-confirmar="¿Generar clave nueva?">${icono("llave")}Restablecer</button>`
    ));
  }

  if (!propia && !esAdmin) {
    acciones.push(
      p.suspendido
        ? filaAccion(
            "Reactivar cuenta",
            "Vuelve a poder entrar, con su avance y sus certificados intactos.",
            `<button class="accion accion--positiva" type="button" data-accion="reactivar-cuenta" data-perfil="${escapar(p.id)}">${icono("reactivar")}Reactivar</button>`
          )
        : filaAccion(
            "Suspender cuenta",
            "No puede entrar desde ya. Conserva su avance, su puntaje y sus certificados.",
            `<button class="accion" type="button" data-accion="suspender" data-perfil="${escapar(p.id)}" data-confirmar="¿Suspender ahora?">${icono("pausa")}Suspender</button>`
          )
    );
  }

  if (!propia) {
    acciones.push(
      esAdmin
        ? filaAccion(
            "Quitar administración",
            "Vuelve a ser trabajador y deja de ver este panel.",
            `<button class="accion" type="button" data-accion="degradar" data-perfil="${escapar(p.id)}" data-confirmar="¿Quitar el rol?">${icono("usuario")}Quitar admin</button>`
          )
        : filaAccion(
            "Hacer administrador",
            "Verá este panel la próxima vez que entre, con todos sus permisos.",
            `<button class="accion" type="button" data-accion="promover" data-perfil="${escapar(p.id)}" data-confirmar="¿Dar el rol?">${icono("admin")}Hacer admin</button>`
          )
    );
  }

  const eliminar =
    !propia && !esAdmin
      ? `
      <section class="ficha__seccion ficha__seccion--riesgo" aria-labelledby="fichaEliminar">
        <h3 class="ficha__subtitulo" id="fichaEliminar">Eliminar cuenta</h3>
        <div class="ficha__accion">
          <p>Borra la cuenta, sus inscripciones, su avance y sus certificados. No se puede deshacer; para conservar el historial, mejor suspenderla.</p>
          <button class="accion accion--riesgo" type="button" data-accion="eliminar" data-perfil="${escapar(p.id)}" data-confirmar="Sí, eliminar para siempre">${icono("basurero")}Eliminar</button>
        </div>
      </section>`
      : "";

  return `
    <header class="ficha__cabeza">
      <span class="avatar avatar--grande" aria-hidden="true">${escapar(iniciales(p.nombreCompleto))}</span>
      <div class="ficha__identidad">
        <h2 class="ficha__nombre" id="fichaNombre" tabindex="-1">${escapar(p.nombreCompleto)}</h2>
        <p class="ficha__sub">${escapar([p.identificador, p.empresa, p.area].filter(Boolean).join(" · "))}</p>
        ${etiquetas ? `<div class="ficha__etiquetas">${etiquetas}</div>` : ""}
      </div>
      <button class="icono-boton" type="button" data-accion="cerrar-ficha" aria-label="Cerrar ficha">${icono("cerrar")}</button>
    </header>

    <div class="ficha__cuerpo">
      <div class="ficha__avisos" aria-live="polite"></div>
      ${clave}

      <section class="ficha__seccion" aria-labelledby="fichaCursos">
        <h3 class="ficha__subtitulo" id="fichaCursos">Cursos</h3>
        ${cursos}
      </section>

      ${
        acciones.length > 0
          ? `<section class="ficha__seccion" aria-labelledby="fichaCuenta">
               <h3 class="ficha__subtitulo" id="fichaCuenta">Cuenta</h3>
               <p class="ficha__nota">Registrada el ${fechaCorta(p.creadoEn)}${p.suspendido && p.suspendidoEn ? ` · suspendida el ${fechaCorta(p.suspendidoEn)}` : ""}.</p>
               ${acciones.join("")}
             </section>`
          : ""
      }

      ${eliminar}
    </div>`;
}

function filaAccion(titulo: string, explicacion: string, boton: string): string {
  return `
    <div class="ficha__accion">
      <p><strong>${titulo}</strong>${explicacion}</p>
      ${boton}
    </div>`;
}

function bloqueCurso(d: DatosPanel, m: Matricula): string {
  const desc = describirCurso(m.curso);
  const resultados = d.resultados
    ? new Map(
        d.resultados
          .filter((r) => r.perfilId === m.perfil.id && r.cursoId === m.curso.id)
          .map((r) => [r.fase, r])
      )
    : null;

  let estado = "";
  if (!m.inscripcion.activa) estado = `<span class="chip chip--tenue">${icono("baja")}De baja</span>`;
  else if (m.estado === "completado") estado = `<span class="chip chip--ok">${icono("ok")}Completó</span>`;
  else if (estaDetenida(m)) estado = `<span class="chip chip--aviso">${icono("reloj")}Sin avanzar</span>`;
  else if (m.estado === "en_curso") estado = `<span class="chip chip--marca">En curso</span>`;
  else estado = `<span class="chip chip--tenue">Sin empezar</span>`;

  const medida = (n: number): string =>
    desc.medida.una === "nota" ? `Nota ${numero(n)}` : `${numero(n)} pts`;

  const fases = desc.fases
    .map((f, i) => {
      const fase = i + 1;
      const hecha = m.fasesHechas.includes(fase) || m.estado === "completado";
      const r = resultados?.get(fase);
      return `
        <li class="ficha-fase${hecha ? " ficha-fase--hecha" : ""}">
          <span class="ficha-fase__marca" aria-hidden="true">${hecha ? icono("ok") : `<i>${fase}</i>`}</span>
          <span class="ficha-fase__nombre">${escapar(f.nombre)}${f.detalle ? `<small>${escapar(f.detalle)}</small>` : ""}</span>
          ${
            hecha
              ? r
                ? `<span class="ficha-fase__dato">${medida(r.puntaje)}</span>
                   <span class="ficha-fase__dato">${r.segundos > 0 ? duracion(r.segundos) : "—"}</span>
                   <span class="ficha-fase__fecha" title="Último intento aprobado">${fechaCorta(r.actualizadoEn)}</span>`
                : `<span class="ficha-fase__estado">Aprobada</span>`
              : `<span class="ficha-fase__estado">Pendiente</span>`
          }
        </li>`;
    })
    .join("");

  const certificado = m.certificado
    ? `
      <div class="ficha-curso__cert">
        ${icono("certificado")}
        <span>Certificado <code>${escapar(m.certificado.codigo)}</code> · ${fechaCorta(m.certificado.emitidoEn)}</span>
        <button class="icono-boton icono-boton--mini" type="button" data-accion="copiar" data-texto="${escapar(m.certificado.codigo)}"
                aria-label="Copiar código del certificado" title="Copiar">${icono("copiar")}</button>
      </div>`
    : m.estado === "completado"
      ? `<p class="ficha__nota">${icono("info")}<span>Completó el curso; el certificado se emite la primera vez que lo abre.</span></p>`
      : "";

  const accion = m.inscripcion.activa
    ? `<button class="accion" type="button" data-accion="inscripcion-baja" data-inscripcion="${escapar(m.inscripcion.id)}" data-confirmar="¿Dar de baja?">${icono("baja")}Dar de baja</button>`
    : `<button class="accion accion--positiva" type="button" data-accion="inscripcion-reactivar" data-inscripcion="${escapar(m.inscripcion.id)}">${icono("reactivar")}Reactivar inscripción</button>`;

  return `
    <article class="ficha-curso${m.inscripcion.activa ? "" : " ficha-curso--baja"}">
      <header class="ficha-curso__cabeza">
        <h4 class="ficha-curso__titulo">${escapar(desc.corto)}</h4>
        ${estado}
      </header>
      <p class="ficha-curso__meta">
        Inscrito el ${fechaCorta(m.inscripcion.inscritoEn)}${m.inscripcion.codigoUsado ? ` con <code>${escapar(m.inscripcion.codigoUsado)}</code>` : ""}
        · ${m.ultimaActividad ? `actividad: ${haceCuanto(m.ultimaActividad).toLowerCase()}` : "sin actividad"}
        ${m.puntaje > 0 ? ` · ${numero(m.puntaje)} pts en total` : ""}
      </p>
      <ol class="ficha-fases">${fases}</ol>
      ${certificado}
      <footer class="ficha-curso__pie">
        <span class="ficha__nota">${m.inscripcion.activa ? "Dar de baja libera el cupo del código y conserva el historial." : `Dada de baja${m.inscripcion.bajaEn ? ` el ${fechaCorta(m.inscripcion.bajaEn)}` : ""}.`}</span>
        ${accion}
      </footer>
    </article>`;
}
