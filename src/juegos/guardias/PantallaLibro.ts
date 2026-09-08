import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, Rectangle, ScrollViewer, Control, Button } from "@babylonjs/gui";
import {
  PALETA,
  TEXTO,
  MARGEN,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearDivisor,
  crearBotonPrincipal,
  crearBotonSecundario,
  crearBotonOpcion,
  rotularOpcion,
  marcarOpcion,
  altoDeTexto,
  desvanecer,
} from "../../ui/EstiloUI";
import {
  libroVacio,
  abrirServicio,
  registrar,
  entregarServicio,
  revisionDelSupervisor,
  calificar,
  horaDe,
  CARGO_FIJO,
  type EstadoLibro,
  type EntradaLibro,
} from "./LibroNovedades";
import { APERTURA, SUCESOS_CONDOMINIO, MINUTO_SUPERVISOR } from "./SucesosCondominio";

// ===========================================================================
// Pantalla del libro de novedades — Escenario 1 (condominio)
// ===========================================================================
//
// El nivel entero pasa por acá: se abre el servicio, se recorren los seis
// sucesos en orden, a mitad de turno cae la fiscalización de las 03:20 —solo
// informa, no corrige nada retroactivo— y al final se entrega el cargo fijo
// citando el párrafo de las novedades. Se cierra con la nota de calificar().
//
// ─── UNA SOLA GUI, UN SOLO VELO A LA VEZ ──────────────────────────────────
//
// Cada paso (suceso, aviso del supervisor, entrega, informe final) reemplaza
// lo que había en pantalla en vez de apilar veles nuevos encima. Con seis
// sucesos, apilar hubiera dejado seis capas de velo oscureciendo cada vez
// más la escena de fondo.

const ANCHO_TARJETA = 720;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;

export function mostrarPantallaLibro(scene: Scene, onCompletado: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("pantallaLibro", true, scene);

  let estado: EstadoLibro = abrirServicio(libroVacio(), APERTURA);
  let indiceSiguiente = 0;
  let supervisorHecho = false;

  let capaActual: Rectangle | null = null;

  function reemplazarCapa(nueva: Rectangle): void {
    const anterior = capaActual;
    capaActual = nueva;
    if (anterior) {
      setTimeout(() => {
        try {
          anterior.dispose();
        } catch {
          /* ya se reemplazó */
        }
      }, 0);
    }
  }

  mostrarLibro();

  // --- Vista principal: el libro con lo escrito hasta ahora --------------
  function mostrarLibro(): void {
    const velo = crearVelo(gui, "veloLibro");
    const alto = 560;
    const tarjeta = crearTarjeta(velo, "tarjetaLibro", ANCHO_TARJETA, alto);
    crearFilete(tarjeta, "fileteLibro", ANCHO_TARJETA, PALETA.aviso);

    const encabezado = new StackPanel("encabezadoLibro");
    encabezado.isVertical = true;
    encabezado.width = ANCHO_CONTENIDO + "px";
    encabezado.left = MARGEN + "px";
    encabezado.top = "28px";
    encabezado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    encabezado.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(encabezado);

    encabezado.addControl(crearRotulo("rotuloLibro", "LIBRO DE NOVEDADES"));
    encabezado.addControl(crearEspacio("aireRotuloLibro", 8));
    encabezado.addControl(
      crearParrafo(
        "tituloLibro",
        `${APERTURA.instalacion} · turno ${APERTURA.turno}`,
        ANCHO_CONTENIDO,
        TEXTO.destacado,
        PALETA.titulo,
        "600"
      )
    );
    encabezado.addControl(crearEspacio("aireDivisorLibro", 16));
    encabezado.addControl(crearDivisor("divisorLibro", ANCHO_CONTENIDO));

    const scroll = new ScrollViewer("scrollLibro");
    scroll.width = ANCHO_CONTENIDO + 12 + "px";
    scroll.height = alto - 220 + "px";
    scroll.thickness = 0;
    scroll.barColor = PALETA.tenue;
    scroll.barBackground = "rgba(255,255,255,0.05)";
    scroll.left = MARGEN + "px";
    scroll.top = "142px";
    scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(scroll);

    const lista = new StackPanel("listaLibro");
    lista.isVertical = true;
    lista.width = ANCHO_CONTENIDO + "px";
    scroll.addControl(lista);

    estado.entradas.forEach((entrada) => lista.addControl(filaEntrada(entrada)));

    const boton = crearBotonPrincipal("btnContinuarTurno", textoBotonContinuar(), 220);
    boton.left = -MARGEN + "px";
    boton.top = "-20px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    boton.onPointerUpObservable.add(() => avanzar());
    tarjeta.addControl(boton);

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  function textoBotonContinuar(): string {
    if (indiceSiguiente >= SUCESOS_CONDOMINIO.length) return "Cerrar el turno";
    if (!supervisorHecho && SUCESOS_CONDOMINIO[indiceSiguiente].minuto >= MINUTO_SUPERVISOR) {
      return "03:20 — Fiscalización";
    }
    return "Continuar el turno";
  }

  /** Una línea del libro tal como quedó escrita. */
  function filaEntrada(entrada: EntradaLibro): Rectangle {
    const texto = entrada.anulada ? `(${entrada.observaciones})` : entrada.observaciones;
    const anchoTexto = ANCHO_CONTENIDO - 90;
    const alto = altoDeTexto(texto, anchoTexto, TEXTO.menor) + 44;

    const marco = new Rectangle(`filaLibro_${entrada.numero}`);
    marco.width = ANCHO_CONTENIDO + "px";
    marco.height = alto + "px";
    marco.thickness = 0;
    marco.paddingBottom = "8px";
    marco.isHitTestVisible = false;

    const numero = crearParrafo(
      `numeroLibro_${entrada.numero}`,
      `N.° ${entrada.numero} · ${entrada.hora}`,
      80,
      TEXTO.menor,
      PALETA.tenue,
      "600"
    );
    numero.left = "0px";
    numero.top = "2px";
    numero.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    numero.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marco.addControl(numero);

    const cuerpo = crearParrafo(
      `cuerpoLibro_${entrada.numero}`,
      `${entrada.actividad ? entrada.actividad + " — " : ""}${texto}`,
      anchoTexto,
      TEXTO.menor,
      entrada.anulada ? PALETA.tenue : PALETA.cuerpo
    );
    cuerpo.left = "90px";
    cuerpo.top = "0px";
    cuerpo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marco.addControl(cuerpo);

    return marco;
  }

  // --- Avanza: siguiente suceso, o la fiscalización, o el cierre ---------
  function avanzar(): void {
    if (indiceSiguiente >= SUCESOS_CONDOMINIO.length) {
      mostrarEntrega();
      return;
    }

    const suceso = SUCESOS_CONDOMINIO[indiceSiguiente];
    if (!supervisorHecho && suceso.minuto >= MINUTO_SUPERVISOR) {
      supervisorHecho = true;
      mostrarSupervisor();
      return;
    }

    mostrarSuceso(suceso);
  }

  // --- Un suceso: tres formas de anotarlo ---------------------------------
  function mostrarSuceso(suceso: (typeof SUCESOS_CONDOMINIO)[number]): void {
    const velo = crearVelo(gui, "veloSuceso");
    const alto = 150 + 96 * suceso.opciones.length + 130;
    const tarjeta = crearTarjeta(velo, "tarjetaSuceso", ANCHO_TARJETA, alto);
    crearFilete(tarjeta, "fileteSuceso", ANCHO_TARJETA, PALETA.dato);

    const columna = new StackPanel("columnaSuceso");
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.left = MARGEN + "px";
    columna.top = "30px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);

    columna.addControl(crearRotulo("rotuloSuceso", `${horaDe(suceso.minuto)} · ${suceso.actividad}`));
    columna.addControl(crearEspacio("aireRotuloSuceso", 10));
    columna.addControl(
      crearParrafo("avisoSuceso", suceso.aviso, ANCHO_CONTENIDO, TEXTO.destacado, PALETA.titulo, "600")
    );
    columna.addControl(crearEspacio("aireDivisorSuceso", 18));
    columna.addControl(crearDivisor("divisorSuceso", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorSuceso", 16));

    const botonesPorIndice = new Map<number, Button>();
    let explicacion: ReturnType<typeof crearParrafo> | null = null;

    suceso.opciones.forEach((opcion, i) => {
      const boton = crearBotonOpcion(`btnOpcionSuceso_${i}`, opcion.texto, ANCHO_CONTENIDO);
      botonesPorIndice.set(i, boton);
      rotularOpcion(boton, String.fromCharCode(65 + i));
      boton.onPointerUpObservable.add(() => {
        // Una sola vez: una vez elegida la redacción, el punto queda escrito.
        if (explicacion) return;

        estado = registrar(estado, suceso, opcion);
        marcarOpcion(boton, opcion.clase === "factual");
        botonesPorIndice.forEach((otro, j) => {
          if (j !== i) otro.alpha = 0.35;
        });

        explicacion = crearParrafo(
          "explicacionSuceso",
          opcion.explicacion,
          ANCHO_CONTENIDO,
          TEXTO.menor,
          PALETA.tenue
        );
        columna.addControl(crearEspacio("aireExplicacionSuceso", 16));
        columna.addControl(explicacion);

        const continuar = crearBotonPrincipal("btnContinuarSuceso", "Anotado — seguir el turno", 260);
        continuar.left = -MARGEN + "px";
        continuar.top = "-20px";
        continuar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        continuar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        continuar.onPointerUpObservable.add(() => {
          indiceSiguiente += 1;
          mostrarLibro();
        });
        tarjeta.addControl(continuar);
      });
      columna.addControl(boton);
      if (i < suceso.opciones.length - 1) columna.addControl(crearEspacio(`aireOpcionSuceso_${i}`, 10));
    });

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // --- La fiscalización de las 03:20 --------------------------------------
  function mostrarSupervisor(): void {
    const faltas = revisionDelSupervisor(estado);

    const velo = crearVelo(gui, "veloSupervisor");
    const alto = 300 + Math.max(0, faltas.length - 1) * 70;
    const tarjeta = crearTarjeta(velo, "tarjetaSupervisor", ANCHO_TARJETA, Math.min(alto, 560));
    crearFilete(tarjeta, "fileteSupervisor", ANCHO_TARJETA, PALETA.error);

    const encabezado = new StackPanel("encabezadoSupervisor");
    encabezado.isVertical = true;
    encabezado.width = ANCHO_CONTENIDO + "px";
    encabezado.left = MARGEN + "px";
    encabezado.top = "30px";
    encabezado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    encabezado.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(encabezado);

    encabezado.addControl(crearRotulo("rotuloSupervisor", "03:20 · FISCALIZACIÓN"));
    encabezado.addControl(crearEspacio("aireRotuloSupervisor", 10));
    encabezado.addControl(
      crearParrafo(
        "tituloSupervisor",
        "El supervisor de la instalación revisa lo escrito hasta ahora.",
        ANCHO_CONTENIDO,
        TEXTO.titulo,
        PALETA.titulo,
        "600"
      )
    );
    encabezado.addControl(crearEspacio("aireDivisorSupervisor", 16));
    encabezado.addControl(crearDivisor("divisorSupervisor", ANCHO_CONTENIDO));
    encabezado.addControl(crearEspacio("airePostDivisorSupervisor", 14));

    if (faltas.length === 0) {
      encabezado.addControl(
        crearParrafo(
          "sinFaltasSupervisor",
          "No encuentra observaciones que hacer. Lo anotado hasta ahora se sostiene.",
          ANCHO_CONTENIDO,
          TEXTO.menor,
          PALETA.acierto
        )
      );
    } else {
      faltas.forEach((falta, i) => {
        encabezado.addControl(
          crearParrafo(`faltaSupervisor_${i}`, `• ${falta.descripcion}`, ANCHO_CONTENIDO, TEXTO.menor, PALETA.error)
        );
        encabezado.addControl(crearEspacio(`aireFaltaSupervisor_${i}`, 8));
      });
    }

    const boton = crearBotonPrincipal("btnCerrarSupervisor", "Seguir el turno", 220);
    boton.left = -MARGEN + "px";
    boton.top = "-20px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    boton.onPointerUpObservable.add(() => mostrarLibro());
    tarjeta.addControl(boton);

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // --- Entrega: cargo fijo y cita del párrafo -----------------------------
  function mostrarEntrega(): void {
    const inventarioDeclarado = new Set<string>();
    let parrafoCitado: number | null = null;

    const velo = crearVelo(gui, "veloEntrega");
    const alto = 560;
    const tarjeta = crearTarjeta(velo, "tarjetaEntrega", ANCHO_TARJETA, alto);
    crearFilete(tarjeta, "fileteEntrega", ANCHO_TARJETA, PALETA.aviso);

    const columna = new StackPanel("columnaEntrega");
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.left = MARGEN + "px";
    columna.top = "28px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);

    columna.addControl(crearRotulo("rotuloEntrega", "08:00 · ENTREGA DEL SERVICIO"));
    columna.addControl(crearEspacio("aireRotuloEntrega", 8));
    columna.addControl(
      crearParrafo(
        "tituloEntrega",
        "Declara el cargo fijo completo y cita el párrafo donde constan las novedades.",
        ANCHO_CONTENIDO,
        TEXTO.cuerpo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorEntrega", 16));
    columna.addControl(crearDivisor("divisorEntrega", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorEntrega", 16));

    columna.addControl(crearRotulo("rotuloCargo", "CARGO FIJO"));
    columna.addControl(crearEspacio("aireRotuloCargo", 8));
    CARGO_FIJO.forEach((item, i) => {
      const boton = crearBotonSecundario(`btnCargo_${i}`, `☐  ${item}`, ANCHO_CONTENIDO);
      boton.onPointerUpObservable.add(() => {
        if (inventarioDeclarado.has(item)) {
          inventarioDeclarado.delete(item);
          boton.textBlock!.text = `☐  ${item}`;
        } else {
          inventarioDeclarado.add(item);
          boton.textBlock!.text = `☑  ${item}`;
        }
      });
      columna.addControl(boton);
      columna.addControl(crearEspacio(`aireCargo_${i}`, 6));
    });

    columna.addControl(crearEspacio("aireRotuloParrafo", 8));
    columna.addControl(crearRotulo("rotuloParrafo", "PÁRRAFO DE LAS NOVEDADES"));
    columna.addControl(crearEspacio("aireRotuloParrafo2", 8));

    const numerables = estado.entradas.filter((e) => e.clase !== null);
    const filaBotones = new StackPanel("filaBotonesParrafo");
    filaBotones.isVertical = false;
    filaBotones.height = "40px";
    filaBotones.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.addControl(filaBotones);

    const botonesParrafo = new Map<number, Button>();
    numerables.forEach((entrada) => {
      const boton = crearBotonSecundario(`btnParrafo_${entrada.numero}`, String(entrada.numero), 46);
      boton.paddingLeft = "6px";
      botonesParrafo.set(entrada.numero, boton);
      boton.onPointerUpObservable.add(() => {
        parrafoCitado = entrada.numero;
        botonesParrafo.forEach((otro, num) => {
          otro.color = num === entrada.numero ? PALETA.dato : PALETA.borde;
        });
      });
      filaBotones.addControl(boton);
    });

    const boton = crearBotonPrincipal("btnEntregar", "Entregar el servicio", 220);
    boton.left = -MARGEN + "px";
    boton.top = "-20px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    boton.onPointerUpObservable.add(() => {
      // Si no se citó ningún párrafo, se manda igual con 0: entregarServicio
      // ya sabe anotar la falta de "párrafo mal citado" cuando no existe.
      estado = entregarServicio(estado, Array.from(inventarioDeclarado), parrafoCitado ?? 0);
      mostrarInformeFinal();
    });
    tarjeta.addControl(boton);

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // --- Informe final: nota y faltas ---------------------------------------
  function mostrarInformeFinal(): void {
    const { nota, faltas } = calificar(estado);

    const velo = crearVelo(gui, "veloInformeFinal");
    const alto = Math.min(600, 260 + faltas.length * 60);
    const tarjeta = crearTarjeta(velo, "tarjetaInformeFinal", ANCHO_TARJETA, alto);
    crearFilete(tarjeta, "fileteInformeFinal", ANCHO_TARJETA, nota >= 60 ? PALETA.acierto : PALETA.error);

    const columna = new StackPanel("columnaInformeFinal");
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.left = MARGEN + "px";
    columna.top = "30px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);

    columna.addControl(crearRotulo("rotuloInformeFinal", "TURNO ENTREGADO"));
    columna.addControl(crearEspacio("aireRotuloInformeFinal", 10));
    columna.addControl(
      crearParrafo(
        "notaInformeFinal",
        `Nota del turno: ${nota} / 100`,
        ANCHO_CONTENIDO,
        TEXTO.mayor,
        nota >= 60 ? PALETA.acierto : PALETA.error,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorInformeFinal", 18));
    columna.addControl(crearDivisor("divisorInformeFinal", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorInformeFinal", 14));

    if (faltas.length === 0) {
      columna.addControl(
        crearParrafo(
          "sinFaltasInformeFinal",
          "El libro quedó sin faltas: cronológico, sin opiniones ni hechos inventados, entregado completo.",
          ANCHO_CONTENIDO,
          TEXTO.menor,
          PALETA.acierto
        )
      );
    } else {
      faltas.forEach((falta, i) => {
        columna.addControl(
          crearParrafo(
            `faltaInformeFinal_${i}`,
            `• ${falta.descripcion}`,
            ANCHO_CONTENIDO,
            TEXTO.menor,
            PALETA.error
          )
        );
        columna.addControl(crearEspacio(`aireFaltaInformeFinal_${i}`, 6));
      });
    }

    const boton = crearBotonPrincipal("btnCerrarInformeFinal", "Salir del puesto", 200);
    boton.left = -MARGEN + "px";
    boton.top = "-20px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    boton.onPointerUpObservable.add(() => {
      velo.isPointerBlocker = false;
      desvanecer(velo, velo.alpha, 0, 140, () => {
        velo.isVisible = false;
        setTimeout(() => {
          try {
            velo.dispose();
          } catch {
            /* ya se salió */
          }
        }, 0);
      });
      onCompletado();
    });
    tarjeta.addControl(boton);

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }
}