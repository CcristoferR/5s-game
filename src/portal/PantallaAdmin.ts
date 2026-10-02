import "./portal.css";
import "./admin/admin.css";
import {
  cambiarEstadoCodigo,
  cambiarEstadoCurso,
  cambiarRol,
  cambiarSuspension,
  crearAdministrador,
  crearCodigo,
  darDeBajaInscripcion,
  eliminarCuenta,
  explicarRechazoClave,
  explicarRechazoEliminar,
  explicarRechazoRol,
  explicarRechazoSuspension,
  LARGO_MINIMO_CLAVE,
  leerBitacora,
  listarCertificados,
  listarCodigos,
  listarCursos,
  listarInscripciones,
  listarPerfiles,
  listarProgreso,
  reactivarInscripcion,
  restablecerClave,
  type ResultadoAltaAdmin,
} from "./Datos";
import { rankingCompleto, resultadosDelPanel } from "./Ranking";
import {
  exportarCodigos,
  exportarPersonas,
  exportarRanking,
  exportarResumenAreas,
  type AlcanceReporte,
} from "./Reportes";
import { mostrarVerificacion } from "./PantallaVerificacion";
import { cerrarSesion, leerSesion } from "./Sesion";
import { manejar } from "./Manejador";
import { cambiarPreferencias, leerPreferencias } from "./Preferencias";
import { aplicarTemaUI } from "../ui/EstiloUI";
import { marcaClassplay } from "./Marca";
import { icono } from "./Iconos";
import { armarMatriculas, empresasDe, type FiltroPersonas, type Vista } from "./admin/Indicadores";
import { conectarGraficos } from "./admin/Graficos";
import { fichaHtml } from "./admin/Ficha";
import { escapar, iniciales } from "./admin/Formato";
import {
  esqueleto,
  navegacion,
  resultadoPersonas,
  selectores,
  titulos,
  vistaCodigos,
  vistaCursos,
  vistaPersonas,
  vistaReportes,
  vistaResumen,
  vistaSeguridad,
  VISTAS,
  type DatosPanel,
  type EstadoPanel,
  type FiltroCodigos,
  type OrdenPersonas,
} from "./admin/Vistas";

/**
 * Panel de administración de ClassPlay.
 *
 * Lo usa Bitplay para todas las empresas cliente: un riel a la izquierda con
 * las secciones, y arriba el alcance —curso y empresa— que rige lo que se ve.
 * Cada cifra del resumen abre la lista de personas que cuenta, porque un
 * número que no se puede abrir obliga a buscar a mano a quién se refiere.
 *
 * ─── CÓMO SE DIBUJA ───────────────────────────────────────────────────────
 *
 * Los datos se piden todos juntos (perfiles, inscripciones, progreso,
 * certificados, códigos, resultados por fase, rankings y bitácora) y el resto
 * se calcula acá: cambiar de curso, de empresa, de sección o de página no
 * vuelve a consultar el servidor. Solo una acción que escribe —suspender,
 * emitir un código— recarga, y mientras recarga la pantalla anterior queda a
 * la vista, atenuada, en vez de parpadear a un esqueleto.
 *
 * Los clics se escuchan una sola vez en la raíz, por el atributo data-accion:
 * las vistas se redibujan enteras y así no hay que volver a enganchar nada.
 */

const CLAVE_ESTADO = "classplay-panel";

/** Lo que se recuerda entre visitas: la sección y el alcance elegidos. */
function leerEstadoGuardado(): Pick<EstadoPanel, "vista" | "cursoId" | "empresa"> {
  const porDefecto = { vista: "resumen" as Vista, cursoId: null, empresa: null };
  try {
    const crudo = localStorage.getItem(CLAVE_ESTADO);
    if (!crudo) return porDefecto;
    const datos = JSON.parse(crudo) as Partial<EstadoPanel>;
    return {
      vista: VISTAS.some((v) => v.id === datos.vista) ? (datos.vista as Vista) : "resumen",
      cursoId: typeof datos.cursoId === "string" ? datos.cursoId : null,
      empresa: typeof datos.empresa === "string" ? datos.empresa : null,
    };
  } catch {
    return porDefecto;
  }
}

export function mostrarAdministracion(onSalir: () => void): void {
  const raiz = document.createElement("div");
  raiz.className = "portal portal--consola";
  document.body.appendChild(raiz);

  const estado: EstadoPanel = {
    ...leerEstadoGuardado(),
    personas: { busqueda: "", filtro: "todas", orden: "nombre", pagina: 1 },
    codigos: { filtro: "todos", recienCreado: null },
    ranking: { pagina: 1 },
    nuevoAdminAbierto: false,
    tablas: new Set(),
  };

  let datos: DatosPanel | null = null;
  let fichaPerfil: string | null = null;
  let claveTemporal: string | null = null;
  let primeraPintura = true;
  let esperaBusqueda = 0;

  raiz.innerHTML = armazon();

  const $ = <T extends HTMLElement>(selector: string): T => raiz.querySelector<T>(selector)!;
  const nav = $("#rielNav");
  const yo = $("#rielYo");
  const botonTema = $<HTMLButtonElement>("#botonTema");
  const lienzo = $("#lienzo");
  const cabezaTitulos = $("#lienzoTitulos");
  const cabezaAlcance = $("#lienzoAlcance");
  const cuerpo = $("#lienzoCuerpo");
  const ficha = $<HTMLDialogElement>("#ficha");
  const avisos = $("#avisos");

  conectarGraficos(raiz);
  pintarMarco();
  cuerpo.innerHTML = esqueleto();
  enganchar();
  void cargar();

  // -------------------------------------------------------------------------
  // Datos
  // -------------------------------------------------------------------------

  async function cargar(): Promise<void> {
    cuerpo.setAttribute("aria-busy", "true");
    if (datos) cuerpo.classList.add("lienzo__cuerpo--recargando");

    try {
      const [perfiles, codigos, inscripciones, cursos, progresos, certificados, resultados, sesion, bitacora] =
        await Promise.all([
          listarPerfiles(),
          listarCodigos(),
          listarInscripciones(),
          listarCursos(),
          listarProgreso(),
          listarCertificados(),
          resultadosDelPanel(),
          // Hace falta saber quién mira para no ofrecerle lo que le quitaría
          // su propio acceso: la base lo rechaza igual, pero es mejor que el
          // botón no esté a que aparezca y falle.
          leerSesion(),
          leerBitacora(150),
        ]);

      // Un ranking por curso, todos a la vez. La función verifica en el
      // servidor que quien llama sea administrador.
      const rankings = new Map(
        await Promise.all(cursos.map(async (c) => [c.id, await rankingCompleto(c.id)] as const))
      );

      datos = {
        perfiles,
        cursos,
        inscripciones,
        progresos,
        codigos,
        certificados,
        resultados,
        rankings,
        bitacora,
        perfilPropio: sesion?.perfil ?? null,
        matriculas: armarMatriculas({ perfiles, cursos, inscripciones, progresos, certificados }),
        empresas: empresasDe(perfiles),
        cargadoEn: new Date(),
      };

      // Lo recordado de la visita anterior puede no existir más: un curso
      // borrado o una empresa sin gente. Se vuelve a "todos" en vez de
      // mostrar un panel vacío sin explicación.
      if (estado.cursoId && !cursos.some((c) => c.id === estado.cursoId)) estado.cursoId = null;
      if (estado.empresa && !datos.empresas.some((x) => x.clave === estado.empresa)) estado.empresa = null;
    } catch (error) {
      console.error("[admin] cargar:", error);
      if (!datos) {
        cuerpo.removeAttribute("aria-busy");
        cuerpo.innerHTML = `
          <div class="vacio vacio--error">${icono("alerta")}
            <p>No se pudieron cargar los datos. Revisa la conexión y vuelve a intentar.</p>
            <button class="boton-primario" type="button" data-accion="recargar">${icono("recargar")}Reintentar</button>
          </div>`;
        return;
      }
      avisar("No se pudieron actualizar los datos. Revisa tu conexión.", "error");
    } finally {
      cuerpo.classList.remove("lienzo__cuerpo--recargando");
      cuerpo.removeAttribute("aria-busy");
    }

    pintarMarco();
    pintarVista(false);
    if (fichaPerfil && ficha.open) pintarFicha();
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  function pintarMarco(): void {
    nav.innerHTML = navegacion(datos, estado);
    pintarTitulos();
    cabezaAlcance.innerHTML = selectores(datos, estado);

    const propio = datos?.perfilPropio;
    yo.innerHTML = propio
      ? `<span class="avatar" aria-hidden="true">${escapar(iniciales(propio.nombreCompleto))}</span>
         <span class="riel__yoDatos"><strong>${escapar(propio.nombreCompleto)}</strong><small>Administración</small></span>`
      : "";

    const claro = leerPreferencias().tema === "claro";
    botonTema.innerHTML = icono(claro ? "luna" : "sol");
    botonTema.setAttribute("aria-label", claro ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
    botonTema.title = claro ? "Tema oscuro" : "Tema claro";
  }

  function pintarTitulos(): void {
    cabezaTitulos.innerHTML = titulos(datos, estado);
  }

  /**
   * Dibuja la sección activa.
   *
   * @param alInicio Vuelve el lienzo arriba. Al cambiar de sección sí; al
   *                 recargar tras una acción no, para no perder el lugar.
   */
  function pintarVista(alInicio = true): void {
    if (!datos) return;

    const vistas: Record<Vista, () => string> = {
      resumen: () => vistaResumen(datos!, estado),
      personas: () => vistaPersonas(datos!, estado),
      codigos: () => vistaCodigos(datos!, estado),
      cursos: () => vistaCursos(datos!, estado),
      reportes: () => vistaReportes(datos!, estado),
      seguridad: () => vistaSeguridad(datos!, estado),
    };

    cuerpo.innerHTML = vistas[estado.vista]();
    if (alInicio) {
      // En pantallas angostas el que desplaza es la página entera, no el lienzo.
      lienzo.scrollTop = 0;
      raiz.scrollTop = 0;
    }

    // El único movimiento del panel: los gráficos se dibujan al entrar la
    // primera vez. Después aparecen quietos, porque cambiar de filtro con
    // todo animándose cada vez cansa.
    if (primeraPintura) {
      primeraPintura = false;
      raiz.classList.add("consola--entrada");
      window.setTimeout(() => raiz.classList.remove("consola--entrada"), 1600);
    }
  }

  function pintarResultadoPersonas(): void {
    const zona = raiz.querySelector<HTMLElement>("#resultadoPersonas");
    if (zona && datos) zona.innerHTML = resultadoPersonas(datos, estado);
  }

  function pintarFicha(): void {
    if (!datos || !fichaPerfil) return;
    const contenido = ficha.querySelector<HTMLElement>(".ficha__cuerpo");
    const desplazamiento = contenido?.scrollTop ?? 0;
    ficha.innerHTML = fichaHtml(datos, fichaPerfil, claveTemporal);
    const nuevo = ficha.querySelector<HTMLElement>(".ficha__cuerpo");
    if (nuevo) nuevo.scrollTop = desplazamiento;
    // El botón que tenía el foco ya no existe: sin esto el foco cae al
    // documento y el teclado queda fuera de la ficha.
    if (!ficha.contains(document.activeElement)) {
      ficha.querySelector<HTMLElement>("#fichaNombre")?.focus({ preventScroll: true });
    }
  }

  function irA(vista: Vista): void {
    estado.vista = vista;
    guardarEstado();
    pintarMarco();
    pintarVista();
  }

  function guardarEstado(): void {
    try {
      localStorage.setItem(
        CLAVE_ESTADO,
        JSON.stringify({ vista: estado.vista, cursoId: estado.cursoId, empresa: estado.empresa })
      );
    } catch {
      // Sin almacenamiento el panel funciona igual; solo no recuerda el alcance.
    }
  }

  // -------------------------------------------------------------------------
  // Ficha
  // -------------------------------------------------------------------------

  function abrirFicha(perfilId: string): void {
    if (!datos) return;
    fichaPerfil = perfilId;
    claveTemporal = null;
    pintarFicha();
    if (!ficha.open) ficha.showModal();
    ficha.querySelector<HTMLElement>("#fichaNombre")?.focus({ preventScroll: true });
  }

  function cerrarFicha(): void {
    if (ficha.open) ficha.close();
  }

  ficha.addEventListener("close", () => {
    const anterior = fichaPerfil;
    fichaPerfil = null;
    // La clave temporal no se guarda en ninguna parte: al cerrar se pierde,
    // y así debe ser.
    claveTemporal = null;
    ficha.innerHTML = "";
    if (anterior) {
      raiz
        .querySelector<HTMLElement>(`[data-accion="abrir-ficha"][data-perfil="${CSS.escape(anterior)}"]`)
        ?.focus({ preventScroll: true });
    }
  });

  // -------------------------------------------------------------------------
  // Avisos
  // -------------------------------------------------------------------------

  /**
   * Aviso flotante. Con la ficha abierta va dentro de ella: lo que está fuera
   * de un diálogo modal queda tapado y nadie lo vería.
   */
  function avisar(texto: string, tipo: "ok" | "error"): void {
    const destino = ficha.open ? ficha.querySelector<HTMLElement>(".ficha__avisos") ?? avisos : avisos;

    const aviso = document.createElement("div");
    aviso.className = `aviso aviso--${tipo}`;
    aviso.setAttribute("role", tipo === "error" ? "alert" : "status");
    aviso.innerHTML = `${icono(tipo === "ok" ? "ok" : "alerta")}<p></p>
      <button class="icono-boton icono-boton--mini" type="button" data-accion="cerrar-aviso" aria-label="Cerrar aviso">${icono("cerrar")}</button>`;
    aviso.querySelector("p")!.textContent = texto;
    destino.appendChild(aviso);

    while (destino.children.length > 3) destino.firstElementChild?.remove();
    // Los errores se quedan hasta que alguien los lea y los cierre.
    if (tipo === "ok") window.setTimeout(() => aviso.remove(), 6000);
  }

  // -------------------------------------------------------------------------
  // Confirmación en dos pasos
  // -------------------------------------------------------------------------

  /**
   * Primer clic: el botón cambia a la pregunta. Segundo clic: se ejecuta.
   *
   * Sin ventanas encima de ventanas. Si nadie confirma en seis segundos, el
   * botón vuelve solo a su estado: una confirmación armada que queda ahí
   * esperando es un accidente para el próximo clic distraído.
   */
  function armar(boton: HTMLElement): void {
    boton.dataset.armado = "1";
    boton.dataset.original = boton.innerHTML;
    boton.innerHTML = `${icono("alerta")}<span>${escapar(boton.dataset.confirmar ?? "¿Confirmar?")}</span>`;
    boton.classList.add("accion--confirma");
    boton.dataset.temporizador = String(window.setTimeout(() => desarmar(boton), 6000));
  }

  function desarmar(boton: HTMLElement): void {
    if (boton.dataset.armado !== "1") return;
    window.clearTimeout(Number(boton.dataset.temporizador));
    boton.innerHTML = boton.dataset.original ?? boton.innerHTML;
    boton.classList.remove("accion--confirma");
    delete boton.dataset.armado;
  }

  /** Corre una acción que escribe en la base, con el botón ocupado mientras tanto. */
  async function trabajar(boton: HTMLElement, tarea: () => Promise<void>): Promise<void> {
    const b = boton as HTMLButtonElement;
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
    try {
      await tarea();
    } catch (error) {
      console.error("[admin]", error);
      avisar("No se pudo completar la acción. Revisa tu conexión.", "error");
    } finally {
      if (b.isConnected) {
        b.disabled = false;
        b.removeAttribute("aria-busy");
        desarmar(b);
      }
    }
  }

  const nombreDe = (perfilId: string): string =>
    datos?.perfiles.find((p) => p.id === perfilId)?.nombreCompleto ?? "La persona";

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  async function ejecutar(boton: HTMLElement): Promise<void> {
    if ((boton as HTMLButtonElement).disabled) return;
    const accion = boton.dataset.accion!;

    if (boton.dataset.confirmar && boton.dataset.armado !== "1") {
      armar(boton);
      return;
    }

    switch (accion) {
      // --- Navegación ---
      case "ir": {
        if (boton.dataset.filtro) {
          estado.personas.filtro = boton.dataset.filtro as FiltroPersonas;
          estado.personas.pagina = 1;
          estado.personas.busqueda = "";
        }
        if (boton.dataset.orden) estado.personas.orden = boton.dataset.orden as OrdenPersonas;
        cerrarFicha();
        irA(boton.dataset.vista as Vista);
        return;
      }
      case "elegir-curso": {
        estado.cursoId = boton.dataset.curso ?? null;
        estado.ranking.pagina = 1;
        estado.personas.pagina = 1;
        if (boton.dataset.quedarse) {
          guardarEstado();
          pintarMarco();
          pintarVista();
        } else {
          irA("resumen");
        }
        return;
      }
      case "recargar":
        await cargar();
        return;
      case "tema": {
        const tema = leerPreferencias().tema === "claro" ? "oscuro" : "claro";
        cambiarPreferencias({ tema });
        aplicarTemaUI(tema);
        pintarMarco();
        return;
      }
      case "salir":
        // El error del cierre se registra en vez de perderse: si falla, la
        // sesión seguiría viva en el servidor creyendo la persona que salió.
        cerrarSesion().catch((error) => console.error("[admin] cerrar sesion:", error));
        raiz.remove();
        onSalir();
        return;
      case "verificador":
        // El panel se retira y se vuelve a armar al cerrar el verificador: es
        // más limpio que superponer pantallas y los datos vuelven al día.
        raiz.remove();
        mostrarVerificacion({ onVolver: () => mostrarAdministracion(onSalir) });
        return;

      // --- Vistas ---
      case "filtro-personas":
        estado.personas.filtro = boton.dataset.filtro as FiltroPersonas;
        estado.personas.pagina = 1;
        pintarVista(false);
        return;
      case "limpiar-busqueda":
        estado.personas.busqueda = "";
        estado.personas.filtro = "todas";
        estado.personas.pagina = 1;
        pintarVista(false);
        return;
      case "pagina":
        estado.personas.pagina = Number(boton.dataset.destino) || 1;
        pintarResultadoPersonas();
        raiz.querySelector("#resultadoPersonas")?.scrollIntoView({ block: "start" });
        return;
      case "pagina-ranking":
        estado.ranking.pagina = Number(boton.dataset.destino) || 1;
        pintarVista(false);
        return;
      case "filtro-codigos":
        estado.codigos.filtro = boton.dataset.filtro as FiltroCodigos;
        pintarVista(false);
        return;
      case "descartar-creado":
        estado.codigos.recienCreado = null;
        pintarVista(false);
        return;
      case "alternar-tabla": {
        const id = boton.dataset.bloque!;
        const comoTabla = !estado.tablas.has(id);
        if (comoTabla) estado.tablas.add(id);
        else estado.tablas.delete(id);
        // Se alterna en el lugar, sin redibujar: así no salta la página.
        const bloque = boton.closest(".bloque");
        bloque?.querySelector<HTMLElement>(".bloque__grafico")?.toggleAttribute("hidden", comoTabla);
        bloque?.querySelector<HTMLElement>(".gemela")?.toggleAttribute("hidden", !comoTabla);
        boton.setAttribute("aria-pressed", String(comoTabla));
        boton.innerHTML = `${icono(comoTabla ? "grafico" : "tabla")}<span>${comoTabla ? "Ver gráfico" : "Ver tabla"}</span>`;
        return;
      }
      case "nuevo-admin":
        estado.nuevoAdminAbierto = !estado.nuevoAdminAbierto;
        pintarVista(false);
        if (estado.nuevoAdminAbierto) raiz.querySelector<HTMLInputElement>("#adminNombre")?.focus();
        return;
      case "abrir-ficha":
        abrirFicha(boton.dataset.perfil!);
        return;
      case "cerrar-ficha":
        cerrarFicha();
        return;
      case "cerrar-aviso":
        boton.closest(".aviso")?.remove();
        return;
      case "copiar":
        await copiar(boton.dataset.texto ?? "");
        return;

      // --- Reportes ---
      case "reporte":
        await trabajar(boton, async () => {
          boton.classList.add("trabajando");
          const alcance: AlcanceReporte = { cursoId: estado.cursoId, empresa: estado.empresa };
          const tipo = boton.dataset.reporte;
          try {
            const filas =
              tipo === "personas"
                ? await exportarPersonas(alcance)
                : tipo === "ranking"
                  ? await exportarRanking(alcance)
                  : tipo === "areas"
                    ? await exportarResumenAreas(alcance)
                    : await exportarCodigos({ cursoId: estado.cursoId });
            avisar(
              filas === 0
                ? "No hay datos para ese reporte con el curso y la empresa elegidos."
                : `Reporte descargado: ${filas} ${filas === 1 ? "fila" : "filas"}.`,
              filas === 0 ? "error" : "ok"
            );
          } finally {
            boton.classList.remove("trabajando");
          }
        });
        return;

      // --- Escrituras ---
      case "codigo-baja":
      case "codigo-activar": {
        const codigo = boton.dataset.codigo!;
        const activar = accion === "codigo-activar";
        await trabajar(boton, async () => {
          await cambiarEstadoCodigo(codigo, activar);
          await cargar();
          avisar(
            activar ? `${codigo} vuelve a estar disponible.` : `${codigo} quedó dado de baja: ya no se puede canjear.`,
            "ok"
          );
        });
        return;
      }
      case "curso-retirar":
      case "curso-publicar": {
        const publicar = accion === "curso-publicar";
        await trabajar(boton, async () => {
          await cambiarEstadoCurso(boton.dataset.curso!, publicar);
          await cargar();
          avisar(
            publicar
              ? "El curso vuelve a aparecer en el catálogo."
              : "El curso ya no aparece en el catálogo. Las inscripciones y el avance se conservan.",
            "ok"
          );
        });
        return;
      }
      case "inscripcion-baja":
      case "inscripcion-reactivar": {
        const reactivar = accion === "inscripcion-reactivar";
        await trabajar(boton, async () => {
          if (reactivar) await reactivarInscripcion(boton.dataset.inscripcion!);
          else await darDeBajaInscripcion(boton.dataset.inscripcion!);
          await cargar();
          avisar(
            reactivar ? "Inscripción reactivada." : "Inscripción dada de baja. El cupo del código quedó libre.",
            "ok"
          );
        });
        return;
      }
      case "suspender":
      case "reactivar-cuenta": {
        const perfilId = boton.dataset.perfil!;
        const suspender = accion === "suspender";
        await trabajar(boton, async () => {
          const resultado = await cambiarSuspension(perfilId, suspender);
          if (!resultado.ok) {
            avisar(explicarRechazoSuspension(resultado.motivo), "error");
            return;
          }
          const nombre = nombreDe(perfilId);
          await cargar();
          avisar(
            suspender
              ? `${nombre} ya no puede entrar. Su avance y sus certificados se conservan.`
              : `${nombre} vuelve a tener acceso.`,
            "ok"
          );
        });
        return;
      }
      case "clave": {
        const perfilId = boton.dataset.perfil!;
        await trabajar(boton, async () => {
          const resultado = await restablecerClave(perfilId);
          if (!resultado.ok) {
            avisar(explicarRechazoClave(resultado.motivo), "error");
            return;
          }
          // No se recarga nada: no cambió ningún dato a la vista, y la clave
          // tiene que quedar en pantalla hasta que se cierre la ficha.
          claveTemporal = resultado.clave;
          pintarFicha();
          ficha.querySelector<HTMLElement>(".ficha__clave")?.scrollIntoView({ block: "nearest" });
        });
        return;
      }
      case "promover":
      case "degradar": {
        const perfilId = boton.dataset.perfil!;
        const nuevoRol = accion === "promover" ? "administrador" : "trabajador";
        await trabajar(boton, async () => {
          const resultado = await cambiarRol(perfilId, nuevoRol);
          if (!resultado.ok) {
            avisar(explicarRechazoRol(resultado.motivo), "error");
            return;
          }
          await cargar();
          avisar(
            nuevoRol === "administrador"
              ? `${nombreDe(perfilId)} verá el panel la próxima vez que entre.`
              : `${nombreDe(perfilId)} vuelve a ser trabajador.`,
            "ok"
          );
        });
        return;
      }
      case "eliminar": {
        const perfilId = boton.dataset.perfil!;
        await trabajar(boton, async () => {
          const resultado = await eliminarCuenta(perfilId);
          if (!resultado.ok) {
            avisar(explicarRechazoEliminar(resultado.motivo), "error");
            return;
          }
          cerrarFicha();
          await cargar();
          avisar(
            `${resultado.nombre} se eliminó por completo. Su RUT vuelve a quedar libre para registrarse.`,
            "ok"
          );
        });
        return;
      }
    }
  }

  async function copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(`Copiado: ${texto}`, "ok");
    } catch {
      // Sin permiso de portapapeles (o en http): se deja seleccionado para
      // copiarlo a mano, que es mejor que fallar callado.
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      (ficha.open ? ficha : raiz).appendChild(campo);
      campo.select();
      const ok = document.execCommand("copy");
      campo.remove();
      avisar(ok ? `Copiado: ${texto}` : `No se pudo copiar. El texto es: ${texto}`, ok ? "ok" : "error");
    }
  }

  // -------------------------------------------------------------------------
  // Formularios
  // -------------------------------------------------------------------------

  async function emitirCodigo(form: HTMLFormElement): Promise<void> {
    const campo = <T extends HTMLElement>(id: string): T => form.querySelector<T>(`#${id}`)!;
    const cupos = Number(campo<HTMLInputElement>("nuevoCupos").value);
    const textoDias = campo<HTMLInputElement>("nuevoDias").value.trim();
    const dias = Number(textoDias);

    if (!Number.isInteger(cupos) || cupos < 1 || cupos > 5000) {
      avisar("Los cupos tienen que ser un número entero entre 1 y 5.000.", "error");
      campo<HTMLInputElement>("nuevoCupos").focus();
      return;
    }
    if (textoDias && (!Number.isInteger(dias) || dias < 1 || dias > 3650)) {
      avisar("La vigencia va en días, entre 1 y 3.650. Déjala vacía si el código no vence.", "error");
      campo<HTMLInputElement>("nuevoDias").focus();
      return;
    }

    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await trabajar(boton, async () => {
      // La vigencia se pide en días y la base la guarda como fecha: se
      // convierte acá para que nadie tenga que calcularla.
      const venceEn = textoDias ? new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10) : null;
      const creado = await crearCodigo({
        cursoId: campo<HTMLSelectElement>("nuevoCurso").value,
        lote: campo<HTMLInputElement>("nuevoLote").value,
        usosMaximos: cupos,
        nota: campo<HTMLInputElement>("nuevaNota").value,
        venceEn,
      });

      if (!creado) {
        avisar("No se pudo crear el código. Revisa tu conexión e intenta de nuevo.", "error");
        return;
      }

      // El código recién hecho queda arriba, grande y con su botón de copiar:
      // es el dato que hay que repartir, y perdido en la tabla hay que
      // buscarlo a ojo.
      estado.codigos.recienCreado = creado.codigo;
      estado.codigos.filtro = "todos";
      await cargar();
    });
  }

  async function altaAdministrador(form: HTMLFormElement): Promise<void> {
    const valor = (id: string): string => form.querySelector<HTMLInputElement>(`#${id}`)!.value;
    if (!valor("adminNombre").trim() || !valor("adminIdentificador").trim()) {
      avisar("Escribe el nombre y el RUT o correo de la persona.", "error");
      return;
    }
    if (valor("adminClave").length < LARGO_MINIMO_CLAVE) {
      avisar(`La contraseña necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`, "error");
      return;
    }

    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await trabajar(boton, async () => {
      // El botón queda bloqueado mientras trabaja: crear la cuenta son tres
      // viajes al servidor y un segundo envío dejaría dos cuentas a medias.
      const resultado = await crearAdministrador({
        nombreCompleto: valor("adminNombre"),
        identificador: valor("adminIdentificador"),
        empresa: valor("adminEmpresa"),
        area: valor("adminArea"),
        clave: valor("adminClave"),
      });

      if (!resultado.ok) {
        avisar(explicarRechazoAlta(resultado.motivo), "error");
        // La cuenta quedó creada pero sin el ascenso: se recarga para que
        // aparezca y se pueda terminar desde su ficha.
        if (resultado.motivo === "rol_pendiente") await cargar();
        return;
      }

      estado.nuevoAdminAbierto = false;
      await cargar();
      avisar(`${resultado.perfil.nombreCompleto} ya puede entrar al panel.`, "ok");
    });
  }

  // -------------------------------------------------------------------------
  // Eventos
  // -------------------------------------------------------------------------

  function enganchar(): void {
    raiz.addEventListener("click", (evento) => {
      const objetivo = evento.target as HTMLElement;

      // Clic en el fondo oscuro que rodea la ficha: el propio <dialog> recibe
      // el clic, no su contenido.
      if (objetivo === ficha) {
        cerrarFicha();
        return;
      }

      const boton = objetivo.closest<HTMLElement>("[data-accion]");
      if (boton && raiz.contains(boton)) {
        evento.preventDefault();
        void ejecutar(boton).catch((error) => console.error("[admin]", error));
        return;
      }

      // Toda la fila de una persona abre su ficha, no solo el nombre.
      const fila = objetivo.closest<HTMLElement>("tr[data-perfil]");
      if (fila && !objetivo.closest("a, button, input, select, label")) abrirFicha(fila.dataset.perfil!);
    });

    raiz.addEventListener("change", (evento) => {
      const objetivo = evento.target as HTMLSelectElement;
      if (objetivo.id === "selCurso") {
        estado.cursoId = objetivo.value || null;
        estado.personas.pagina = 1;
        estado.ranking.pagina = 1;
        if (estado.personas.filtro === "sin_curso" && estado.cursoId) estado.personas.filtro = "todas";
      } else if (objetivo.id === "selEmpresa") {
        estado.empresa = objetivo.value || null;
        estado.personas.pagina = 1;
        estado.ranking.pagina = 1;
      } else if (objetivo.id === "ordenPersonas") {
        estado.personas.orden = objetivo.value as OrdenPersonas;
        estado.personas.pagina = 1;
        pintarResultadoPersonas();
        return;
      } else {
        return;
      }
      guardarEstado();
      pintarTitulos();
      pintarVista(false);
    });

    raiz.addEventListener("input", (evento) => {
      const objetivo = evento.target as HTMLInputElement;
      if (objetivo.id !== "buscadorPersonas") return;
      estado.personas.busqueda = objetivo.value;
      estado.personas.pagina = 1;
      // Solo se redibuja la tabla, no el buscador: el campo conserva el foco
      // y el cursor donde estaban.
      window.clearTimeout(esperaBusqueda);
      esperaBusqueda = window.setTimeout(pintarResultadoPersonas, 120);
    });

    raiz.addEventListener(
      "submit",
      manejar("admin", async (evento: SubmitEvent) => {
        const form = evento.target as HTMLFormElement;
        evento.preventDefault();
        if (form.id === "formCodigo") await emitirCodigo(form);
        else if (form.id === "formAdmin") await altaAdministrador(form);
      })
    );
  }
}

/** Texto para el administrador cuando el alta no procede. */
function explicarRechazoAlta(motivo: Exclude<ResultadoAltaAdmin, { ok: true }>["motivo"]): string {
  switch (motivo) {
    case "identificador_repetido":
      return "Ese RUT o correo ya tiene cuenta. Búscalo en Personas y dale el rol desde su ficha.";
    case "clave_corta":
      return `La contraseña necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
    case "rol_pendiente":
      return "La cuenta se creó, pero quedó como trabajador. Ábrela en Personas y dale Hacer admin.";
    default:
      return "No se pudo crear la cuenta. Revisa tu conexión.";
  }
}

/** El esqueleto fijo de la consola: riel, cabecera, lienzo, avisos y ficha. */
function armazon(): string {
  return `
    <div class="consola">
      <aside class="riel" aria-label="Panel de administración">
        <div class="riel__marca">
          ${marcaClassplay()}
          <span class="riel__producto">Panel</span>
        </div>
        <nav class="riel__nav" id="rielNav" aria-label="Secciones"></nav>
        <div class="riel__pie">
          <div class="riel__yo" id="rielYo"></div>
          <div class="riel__acciones">
            <button class="icono-boton" type="button" id="botonTema" data-accion="tema"></button>
            <button class="icono-boton" type="button" data-accion="salir" aria-label="Cerrar sesión" title="Cerrar sesión">${icono("salir")}</button>
          </div>
        </div>
      </aside>

      <main class="lienzo" id="lienzo">
        <header class="lienzo__cabeza">
          <div class="lienzo__titulos" id="lienzoTitulos"></div>
          <div class="lienzo__alcance" role="group" aria-label="Alcance de los datos">
            <div class="lienzo__selectores" id="lienzoAlcance"></div>
            <button class="icono-boton" type="button" data-accion="recargar" aria-label="Actualizar los datos" title="Actualizar los datos">${icono("recargar")}</button>
          </div>
        </header>
        <div class="lienzo__cuerpo" id="lienzoCuerpo"></div>
      </main>
    </div>

    <div class="avisos" id="avisos" aria-live="polite"></div>
    <dialog class="ficha" id="ficha" aria-labelledby="fichaNombre"></dialog>`;
}
