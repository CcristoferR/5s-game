import { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  StackPanel,
  Rectangle,
  ScrollViewer,
  Control,
  Button,
  TextBlock,
} from "@babylonjs/gui";
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
  neutralizarAnimaciones,
  altoDeTexto,
  desvanecer,
} from "../../ui/EstiloUI";
import {
  libroVacio,
  abrirServicio,
  registrar,
  anular,
  intentarBorrar,
  registrarFiscalizacion,
  entregarServicio,
  revisionDelSupervisor,
  calificar,
  horaDe,
  CARGO_FIJO,
  type EstadoLibro,
  type EntradaLibro,
  type SucesoTurno,
} from "./LibroNovedades";
import {
  APERTURA,
  SUCESOS_CONDOMINIO,
  INSTRUCCIONES_FISCALIZACION,
} from "./SucesosCondominio";

// ===========================================================================
// Pantalla del libro de novedades — Escenario 1 (condominio)
// ===========================================================================
//
// El turno completo pasa por acá: se abre la cabecera, van llegando los tres
// sucesos, a las 03:20 fiscaliza el supervisor y a las 08:00 se entrega el
// servicio. Todo lo que se puntúa es lo que quedó escrito.
//
// ─── POR QUÉ NO HAY NINGÚN AVISO AL ELEGIR UNA REDACCIÓN ──────────────────
//
// Se elige una de las tres formas de anotar, se escribe, y no pasa NADA. Ni
// verde ni rojo ni explicación. Esa ausencia es el nivel: el manual prohíbe
// las opiniones y los hechos inventados, pero ningún sistema del mundo puede
// detectarlos al vuelo — nadie sabe si "actitud sospechosa" es lo que el
// guardia vio o lo que supuso. El error entra sin resistencia y solo aparece
// a las 03:20, cuando alguien lee el libro. Poner un aviso al elegir sería
// enseñar lo contrario de lo que pasa en el puesto.
//
// Las otras tres faltas SÍ avisan en el momento, y también es a propósito:
// borrar no funciona, la línea fuera de hora se ve en su renglón equivocado,
// y un párrafo mal citado se nota al entregar. Son controles duros. La
// diferencia entre unas y otras es justamente lo que se practica.
//
// ─── UNA SOLA GUI, UNA CAPA A LA VEZ ──────────────────────────────────────
//
// Cada paso reemplaza la capa anterior en vez de apilarse encima. Con el ida
// y vuelta constante entre el libro y los sucesos, apilar dejaría la escena
// del puesto cada vez más oscura hasta perderla del todo.

const ANCHO_TARJETA = 820;
const ANCHO_CONTENIDO = ANCHO_TARJETA - MARGEN * 2;

// Columnas del rayado del manual: HORA | ACTIVIDAD | OBSERVACIONES, más una
// franja al final para anular y borrar.
const COL_HORA = 56;
const COL_ACTIVIDAD = 128;
const COL_OBS = 430;
const COL_ACCIONES = 100;
const X_ACTIVIDAD = COL_HORA + 6;
const X_OBS = X_ACTIVIDAD + COL_ACTIVIDAD + 6;
const X_ACCIONES = X_OBS + COL_OBS + 20;

export function mostrarPantallaLibro(scene: Scene, onCompletado: () => void): void {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("pantallaLibro", true, scene);

  let estado: EstadoLibro = libroVacio();
  /** Cuántos sucesos han ocurrido ya. Los ocurridos y no escritos son pendientes. */
  let sucesosLlegados = 0;
  const escritos = new Set<string>();
  let fiscalizacionHecha = false;

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

  function cerrarTodo(): void {
    const velo = capaActual;
    capaActual = null;
    if (!velo) return;
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
  }

  /** Botón chico para las acciones de cada renglón. */
  function botonMinimo(nombre: string, texto: string, color: string): Button {
    const boton = Button.CreateSimpleButton(nombre, texto);
    boton.width = COL_ACCIONES + "px";
    boton.height = "24px";
    boton.fontSize = 12;
    boton.fontWeight = "600";
    boton.cornerRadius = 6;
    boton.thickness = 1;
    boton.color = PALETA.borde;
    boton.background = "transparent";
    boton.hoverCursor = "pointer";
    neutralizarAnimaciones(boton);
    if (boton.textBlock) {
      boton.textBlock.color = color;
      boton.textBlock.isHitTestVisible = false;
    }
    boton.onPointerEnterObservable.add(() => (boton.color = PALETA.tenue));
    boton.onPointerOutObservable.add(() => (boton.color = PALETA.borde));
    return boton;
  }

  /** Armazón común: velo, tarjeta, filete y columna de contenido. */
  function armarCapa(
    nombre: string,
    alto: number,
    colorFilete: string
  ): { velo: Rectangle; tarjeta: Rectangle; columna: StackPanel } {
    const velo = crearVelo(gui, `velo${nombre}`);
    const tarjeta = crearTarjeta(velo, `tarjeta${nombre}`, ANCHO_TARJETA, alto);
    crearFilete(tarjeta, `filete${nombre}`, ANCHO_TARJETA, colorFilete);

    const columna = new StackPanel(`columna${nombre}`);
    columna.isVertical = true;
    columna.width = ANCHO_CONTENIDO + "px";
    columna.left = MARGEN + "px";
    columna.top = "28px";
    columna.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    columna.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(columna);

    return { velo, tarjeta, columna };
  }

  function botonAbajo(tarjeta: Rectangle, nombre: string, texto: string, ancho: number): Button {
    const boton = crearBotonPrincipal(nombre, texto, ancho);
    boton.left = -MARGEN + "px";
    boton.top = "-24px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(boton);
    return boton;
  }

  mostrarApertura();

  // ─── 00:00 · La cabecera ────────────────────────────────────────────────
  //
  // No es un trámite: el manual dedica media página al formato, y abrir mal
  // un libro es el error que después nadie puede arreglar. Se muestra campo
  // por campo, con los nombres que usa el manual, y se escribe entera como
  // párrafo 1.
  function mostrarApertura(): void {
    const { velo, tarjeta, columna } = armarCapa("Apertura", 560, PALETA.aviso);

    columna.addControl(crearRotulo("rotuloApertura", "00:00 · INICIO DEL SERVICIO"));
    columna.addControl(crearEspacio("aireRotuloApertura", 10));
    columna.addControl(
      crearParrafo(
        "tituloApertura",
        "Antes de nada se abre el libro con la cabecera del servicio.",
        ANCHO_CONTENIDO,
        TEXTO.titulo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorApertura", 18));
    columna.addControl(crearDivisor("divisorApertura", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorApertura", 16));

    const campos: [string, string][] = [
      ["INSTALACIÓN", APERTURA.instalacion],
      ["CIUDAD Y FECHA", `${APERTURA.ciudad}, ${APERTURA.fecha}`],
      ["TURNO", APERTURA.turno],
      ["SUPERVISOR DE TURNO", APERTURA.supervisor],
      ["GUARDIA SALIENTE", APERTURA.guardiaSaliente],
      ["GUARDIA ENTRANTE", APERTURA.guardiaEntrante],
    ];

    campos.forEach(([etiqueta, valor], i) => {
      const fila = new Rectangle(`filaApertura_${i}`);
      fila.width = ANCHO_CONTENIDO + "px";
      fila.height = "30px";
      fila.thickness = 0;
      fila.isHitTestVisible = false;

      const rotulo = crearParrafo(
        `etiquetaApertura_${i}`,
        etiqueta,
        200,
        TEXTO.rotulo,
        PALETA.rotulo,
        "600"
      );
      rotulo.left = "0px";
      rotulo.top = "3px";
      rotulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fila.addControl(rotulo);

      const dato = crearParrafo(
        `valorApertura_${i}`,
        valor,
        ANCHO_CONTENIDO - 220,
        TEXTO.menor,
        PALETA.cuerpo
      );
      dato.left = "220px";
      dato.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fila.addControl(dato);

      columna.addControl(fila);
    });

    columna.addControl(crearEspacio("aireNotaApertura", 16));
    columna.addControl(
      crearParrafo(
        "notaApertura",
        "Los guardias de turno van uno por línea y el párrafo cierra con las firmas del " +
          "saliente y el entrante. Las mismas dos firmas vuelven a las 08:00, en la entrega.",
        ANCHO_CONTENIDO,
        TEXTO.menor,
        PALETA.tenue
      )
    );

    botonAbajo(tarjeta, "btnAbrirServicio", "Abrir el servicio", 220).onPointerUpObservable.add(
      () => {
        estado = abrirServicio(estado, APERTURA);
        mostrarLibro();
      }
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── El libro: el centro del nivel ──────────────────────────────────────
  //
  // Todo pasa por esta vista. Lo escrito arriba, lo que falta por anotar
  // abajo, y las acciones de cada renglón al costado. Desde acá se avanza el
  // turno, se anota una novedad pendiente, se anula una constancia o se
  // intenta borrarla.
  function mostrarLibro(): void {
    const ALTO = 640;
    const { velo, tarjeta } = armarCapa("Libro", ALTO, PALETA.aviso);

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
    encabezado.addControl(crearEspacio("aireRayadoLibro", 16));

    // Encabezado del rayado. Es el formato del manual y conviene tenerlo a la
    // vista todo el rato: es lo primero que se aprende del libro.
    const rayado = new Rectangle("rayadoLibro");
    rayado.width = ANCHO_CONTENIDO + "px";
    rayado.height = "26px";
    rayado.thickness = 0;
    rayado.isHitTestVisible = false;
    [
      ["HORA", 0, COL_HORA],
      ["ACTIVIDAD", X_ACTIVIDAD, COL_ACTIVIDAD],
      ["OBSERVACIONES", X_OBS, COL_OBS],
    ].forEach(([texto, x, ancho]) => {
      const celda = crearParrafo(
        `rayado_${texto}`,
        texto as string,
        ancho as number,
        TEXTO.rotulo,
        PALETA.rotulo,
        "600"
      );
      celda.left = x + "px";
      celda.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      rayado.addControl(celda);
    });
    encabezado.addControl(rayado);
    encabezado.addControl(crearDivisor("divisorLibro", ANCHO_CONTENIDO));

    // Las novedades que ya ocurrieron y siguen sin anotar.
    const pendientes = SUCESOS_CONDOMINIO.slice(0, sucesosLlegados).filter(
      (s) => !escritos.has(s.id)
    );
    const altoPendientes = pendientes.length === 0 ? 0 : 34 + pendientes.length * 52;

    const scroll = new ScrollViewer("scrollLibro");
    scroll.width = ANCHO_CONTENIDO + 14 + "px";
    // 172 arriba (encabezado + rayado) y 110 abajo (el botón), menos lo que
    // ocupen los pendientes, que se meten entre medio.
    scroll.height = Math.max(120, ALTO - 282 - altoPendientes) + "px";
    scroll.thickness = 0;
    scroll.barColor = PALETA.tenue;
    scroll.barBackground = "rgba(255,255,255,0.05)";
    scroll.left = MARGEN + "px";
    scroll.top = "172px";
    scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(scroll);

    const lista = new StackPanel("listaLibro");
    lista.isVertical = true;
    lista.width = ANCHO_CONTENIDO + "px";
    scroll.addControl(lista);
    estado.entradas.forEach((entrada) => lista.addControl(filaEntrada(entrada)));

    if (pendientes.length > 0) {
      const zona = new StackPanel("zonaPendientes");
      zona.isVertical = true;
      zona.width = ANCHO_CONTENIDO + "px";
      zona.left = MARGEN + "px";
      zona.top = "-110px";
      zona.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      zona.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      tarjeta.addControl(zona);

      zona.addControl(
        crearRotulo(
          "rotuloPendientes",
          pendientes.length === 1 ? "SIN ANOTAR" : `SIN ANOTAR (${pendientes.length})`,
          PALETA.aviso
        )
      );
      zona.addControl(crearEspacio("airePendientes", 8));

      pendientes.forEach((suceso) => {
        const boton = crearBotonSecundario(
          `btnPendiente_${suceso.id}`,
          `${horaDe(suceso.minuto)}  ·  ${suceso.actividad}`,
          ANCHO_CONTENIDO
        );
        if (boton.textBlock) {
          boton.textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          boton.textBlock.paddingLeft = "16px";
        }
        boton.onPointerUpObservable.add(() => mostrarSuceso(suceso));
        zona.addControl(boton);
        zona.addControl(crearEspacio(`airePendiente_${suceso.id}`, 6));
      });
    }

    botonAbajo(tarjeta, "btnAvanzar", textoAvanzar(), 260).onPointerUpObservable.add(() =>
      avanzar()
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  function textoAvanzar(): string {
    if (sucesosLlegados < SUCESOS_CONDOMINIO.length) return "Seguir el turno";
    if (!fiscalizacionHecha) return "03:20 · Llega el supervisor";
    return "08:00 · Entregar el servicio";
  }

  function avanzar(): void {
    if (sucesosLlegados < SUCESOS_CONDOMINIO.length) {
      sucesosLlegados += 1;
      mostrarLibro();
      return;
    }
    if (!fiscalizacionHecha) {
      fiscalizacionHecha = true;
      estado = registrarFiscalizacion(estado, INSTRUCCIONES_FISCALIZACION);
      mostrarFiscalizacion();
      return;
    }
    mostrarEntrega();
  }

  /**
   * De un renglón del libro al suceso del turno que lo originó.
   *
   * Se empareja por hora y actividad, que es lo que escribe registrar(). No
   * hace falta guardar el id en la entrada: el libro es un documento, y en el
   * documento no existe ningún identificador interno del juego.
   */
  function sucesoDeEntrada(entrada: EntradaLibro): SucesoTurno | undefined {
    return SUCESOS_CONDOMINIO.find(
      (s) => horaDe(s.minuto) === entrada.hora && s.actividad === entrada.actividad
    );
  }

  /** Un renglón del libro, con sus dos acciones al costado. */
  function filaEntrada(entrada: EntradaLibro): Rectangle {
    const texto = entrada.anulada ? `(${entrada.observaciones})` : entrada.observaciones;
    const altoTexto = altoDeTexto(texto, COL_OBS, TEXTO.menor);
    const alto = Math.max(altoTexto, 54) + 26;

    const marco = new Rectangle(`filaLibro_${entrada.numero}`);
    marco.width = ANCHO_CONTENIDO + "px";
    marco.height = alto + "px";
    marco.thickness = 0;
    marco.paddingBottom = "6px";

    const color = entrada.anulada ? PALETA.tenue : PALETA.cuerpo;

    const hora = crearParrafo(
      `horaLibro_${entrada.numero}`,
      entrada.hora,
      COL_HORA,
      TEXTO.menor,
      entrada.anulada ? PALETA.tenue : PALETA.titulo,
      "600"
    );
    hora.left = "0px";
    hora.top = "2px";
    hora.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hora.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    hora.isHitTestVisible = false;
    marco.addControl(hora);

    const actividad = crearParrafo(
      `actividadLibro_${entrada.numero}`,
      entrada.actividad,
      COL_ACTIVIDAD,
      TEXTO.rotulo,
      entrada.anulada ? PALETA.tenue : PALETA.rotulo,
      "600"
    );
    actividad.left = X_ACTIVIDAD + "px";
    actividad.top = "4px";
    actividad.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    actividad.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    actividad.isHitTestVisible = false;
    marco.addControl(actividad);

    const obs = crearParrafo(`obsLibro_${entrada.numero}`, texto, COL_OBS, TEXTO.menor, color);
    obs.left = X_OBS + "px";
    obs.top = "0px";
    obs.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    obs.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    obs.isHitTestVisible = false;
    marco.addControl(obs);

    // El separador de párrafos del manual: ===== 3 =====
    const correlativo = crearParrafo(
      `numeroLibro_${entrada.numero}`,
      `=====  ${entrada.numero}  =====`,
      COL_OBS,
      TEXTO.rotulo,
      PALETA.tenue,
      "600"
    );
    correlativo.left = X_OBS + "px";
    correlativo.top = "-4px";
    correlativo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    correlativo.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    correlativo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    correlativo.isHitTestVisible = false;
    marco.addControl(correlativo);

    if (!entrada.anulada) {
      const borrar = botonMinimo(`btnBorrar_${entrada.numero}`, "Borrar", PALETA.tenue);
      borrar.left = X_ACCIONES + "px";
      borrar.top = "0px";
      borrar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      borrar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      borrar.onPointerUpObservable.add(() => {
        // No borra. Anota la falta y avisa por qué — este control SÍ es duro.
        estado = intentarBorrar(estado);
        mostrarNota(
          "EN EL LIBRO NO SE BORRA",
          "No está permitido extraer hojas, usar corrector ni rayar escrituras. Lo escrito " +
            "queda: si hay un error, se anula entre paréntesis y la línea sigue a la vista. " +
            "El intento también queda registrado.",
          PALETA.error,
          () => mostrarLibro()
        );
      });
      marco.addControl(borrar);

      const anularBoton = botonMinimo(`btnAnular_${entrada.numero}`, "Anular", PALETA.aviso);
      anularBoton.left = X_ACCIONES + "px";
      anularBoton.top = "28px";
      anularBoton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      anularBoton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      anularBoton.onPointerUpObservable.add(() => {
        estado = anular(estado, entrada.numero);

        // Si la constancia anulada era una novedad, esa novedad vuelve a estar
        // sin anotar: el turno la tuvo igual y el libro ya no la registra.
        // Reaparece en la bandeja para poder redactarla de nuevo — anotarla
        // tarde caerá fuera de orden, pero eso pesa mucho menos que entregar
        // el servicio sin la constancia.
        const suceso = sucesoDeEntrada(entrada);
        if (suceso) {
          escritos.delete(suceso.id);
          mostrarNota(
            "ANULADA",
            "La línea queda entre paréntesis y sigue a la vista: el manual no permite " +
              "hacerla desaparecer. La novedad vuelve a estar sin anotar, así que hay que " +
              "escribirla de nuevo — entregar el turno sin ella pesa más que anotarla tarde.",
            PALETA.aviso,
            () => mostrarLibro()
          );
          return;
        }
        mostrarLibro();
      });
      marco.addControl(anularBoton);
    }

    return marco;
  }

  // ─── Un suceso: tres formas de anotarlo, cero comentarios ───────────────
  function mostrarSuceso(suceso: SucesoTurno): void {
    // El alto sale del texto real, con la MISMA cuenta que usa crearBotonOpcion
    // por dentro (sangría 62 + 20 de aire, mínimo 60, más 30 de relleno). Si las
    // dos cuentas se separan, o la tarjeta corta la última opción o queda un
    // hueco muerto abajo.
    const ANCHO_ETIQUETA = ANCHO_CONTENIDO - 82;
    const altoAviso = altoDeTexto(suceso.aviso, ANCHO_CONTENIDO, TEXTO.destacado);
    const altoOpciones = suceso.opciones.reduce(
      (suma, o) => suma + Math.max(60, altoDeTexto(o.texto, ANCHO_ETIQUETA, TEXTO.destacado) + 30),
      0
    );
    const separaciones = (suceso.opciones.length - 1) * 10;
    const alto = 118 + altoAviso + altoOpciones + separaciones;
    const { velo, columna } = armarCapa("Suceso", alto, PALETA.dato);

    columna.addControl(
      crearRotulo("rotuloSuceso", `${horaDe(suceso.minuto)} · ${suceso.actividad}`)
    );
    columna.addControl(crearEspacio("aireRotuloSuceso", 10));
    columna.addControl(
      crearParrafo(
        "avisoSuceso",
        suceso.aviso,
        ANCHO_CONTENIDO,
        TEXTO.destacado,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorSuceso", 18));
    columna.addControl(crearDivisor("divisorSuceso", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorSuceso", 16));

    let yaElegida = false;
    suceso.opciones.forEach((opcion, i) => {
      const boton = crearBotonOpcion(`btnOpcionSuceso_${i}`, opcion.texto, ANCHO_CONTENIDO);
      rotularOpcion(boton, String.fromCharCode(65 + i));
      boton.onPointerUpObservable.add(() => {
        if (yaElegida) return;
        yaElegida = true;
        // Se escribe y se vuelve al libro. Nada más: ni marca, ni explicación.
        estado = registrar(estado, suceso, opcion);
        escritos.add(suceso.id);
        mostrarLibro();
      });
      columna.addControl(boton);
      if (i < suceso.opciones.length - 1) {
        columna.addControl(crearEspacio(`aireOpcionSuceso_${i}`, 10));
      }
    });

    // Sin botón de salida: la novedad ya ocurrió y hay que anotarla. Se puede
    // elegir CUÁNDO —dejándola pendiente y siguiendo el turno— pero eso se
    // decide en el libro, no acá.

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── Aviso breve: prohibiciones y confirmaciones ────────────────────────
  function mostrarNota(
    rotulo: string,
    cuerpo: string,
    color: string,
    alCerrar: () => void
  ): void {
    const alto = 210 + altoDeTexto(cuerpo, ANCHO_CONTENIDO, TEXTO.cuerpo);
    const { velo, tarjeta, columna } = armarCapa("Nota", alto, color);

    columna.addControl(crearRotulo("rotuloNota", rotulo, color));
    columna.addControl(crearEspacio("aireCuerpoNota", 14));
    columna.addControl(crearParrafo("cuerpoNota", cuerpo, ANCHO_CONTENIDO, TEXTO.cuerpo));

    botonAbajo(tarjeta, "btnCerrarNota", "Entendido", 180).onPointerUpObservable.add(alCerrar);

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── 03:20 · La fiscalización ───────────────────────────────────────────
  //
  // Aquí sale todo lo que entró en silencio. El párrafo ya quedó escrito en el
  // libro antes de mostrar esta pantalla; lo que se ve acá son los reparos.
  function mostrarFiscalizacion(): void {
    const faltas = revisionDelSupervisor(estado);
    const alto = Math.min(620, 320 + faltas.length * 96);
    const { velo, tarjeta, columna } = armarCapa(
      "Fiscalizacion",
      alto,
      faltas.length === 0 ? PALETA.acierto : PALETA.error
    );

    columna.addControl(crearRotulo("rotuloFiscalizacion", "03:20 · FISCALIZACIÓN"));
    columna.addControl(crearEspacio("aireRotuloFiscalizacion", 10));
    columna.addControl(
      crearParrafo(
        "tituloFiscalizacion",
        `${APERTURA.supervisor}, supervisor de turno, revisa el libro.`,
        ANCHO_CONTENIDO,
        TEXTO.titulo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorFiscalizacion", 16));
    columna.addControl(crearDivisor("divisorFiscalizacion", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorFiscalizacion", 16));

    if (faltas.length === 0) {
      columna.addControl(
        crearParrafo(
          "sinReparosFiscalizacion",
          "Sin reparos. Lo escrito hasta ahora se sostiene: cronológico, sin apreciaciones " +
            "personales y sin hechos que no consten.",
          ANCHO_CONTENIDO,
          TEXTO.cuerpo,
          PALETA.acierto
        )
      );
    } else {
      faltas.forEach((falta, i) => {
        columna.addControl(
          crearParrafo(
            `faltaFiscalizacion_${i}`,
            falta.descripcion,
            ANCHO_CONTENIDO,
            TEXTO.cuerpo,
            PALETA.error,
            "500"
          )
        );
        columna.addControl(crearEspacio(`aireFundamento_${i}`, 4));
        columna.addControl(
          crearParrafo(
            `fundamentoFiscalizacion_${i}`,
            falta.fundamento,
            ANCHO_CONTENIDO,
            TEXTO.menor,
            PALETA.tenue
          )
        );
        columna.addControl(crearEspacio(`aireFaltaFiscalizacion_${i}`, 14));
      });
    }

    columna.addControl(crearEspacio("aireCierreFiscalizacion", 6));
    columna.addControl(
      crearParrafo(
        "cierreFiscalizacion",
        "La visita queda anotada como constancia, con sus instrucciones y la firma del " +
          "fiscalizador. Lo ya escrito no se puede reescribir, pero una constancia errada sí " +
          "se puede anular.",
        ANCHO_CONTENIDO,
        TEXTO.menor,
        PALETA.tenue
      )
    );

    botonAbajo(tarjeta, "btnCerrarFiscalizacion", "Volver al libro", 220).onPointerUpObservable.add(
      () => mostrarLibro()
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── 08:00 · La entrega ─────────────────────────────────────────────────
  function mostrarEntrega(): void {
    const inventario = new Set<string>();
    let parrafoCitado = 1;

    const { velo, tarjeta, columna } = armarCapa("Entrega", 620, PALETA.aviso);

    columna.addControl(crearRotulo("rotuloEntrega", "08:00 · ENTREGA"));
    columna.addControl(crearEspacio("aireRotuloEntrega", 8));
    columna.addControl(
      crearParrafo(
        "tituloEntrega",
        "Procedo a hacer entrega del servicio conforme al cargo fijo, más lo siguiente:",
        ANCHO_CONTENIDO,
        TEXTO.cuerpo,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorEntrega", 14));
    columna.addControl(crearDivisor("divisorEntrega", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorEntrega", 14));

    CARGO_FIJO.forEach((item, i) => {
      const boton = crearBotonSecundario(`btnCargo_${i}`, `☐   ${item}`, ANCHO_CONTENIDO);
      if (boton.textBlock) {
        boton.textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        boton.textBlock.paddingLeft = "16px";
      }
      boton.onPointerUpObservable.add(() => {
        if (inventario.has(item)) {
          inventario.delete(item);
          if (boton.textBlock) boton.textBlock.text = `☐   ${item}`;
        } else {
          inventario.add(item);
          if (boton.textBlock) boton.textBlock.text = `☑   ${item}`;
        }
      });
      columna.addControl(boton);
      columna.addControl(crearEspacio(`aireCargo_${i}`, 6));
    });

    columna.addControl(crearEspacio("airePreParrafo", 12));
    columna.addControl(crearDivisor("divisorParrafo", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostParrafo", 14));

    // La cita del párrafo. El manual la deja como un espacio en blanco:
    // "Novedades indicadas en el párrafo ____". Por eso va como número libre y
    // no como lista de los que existen — poder equivocarse es el punto.
    const filaCita = new Rectangle("filaCita");
    filaCita.width = ANCHO_CONTENIDO + "px";
    filaCita.height = "46px";
    filaCita.thickness = 0;

    const textoCita = crearParrafo(
      "textoCita",
      "Novedades indicadas en el párrafo",
      340,
      TEXTO.cuerpo,
      PALETA.cuerpo
    );
    textoCita.left = "0px";
    textoCita.top = "10px";
    textoCita.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    textoCita.isHitTestVisible = false;
    filaCita.addControl(textoCita);

    const numero = new TextBlock("numeroCita", String(parrafoCitado));
    numero.width = "60px";
    numero.color = PALETA.titulo;
    numero.fontSize = TEXTO.titulo;
    numero.fontWeight = "600";
    numero.left = "354px";
    numero.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    numero.isHitTestVisible = false;
    filaCita.addControl(numero);

    const maximo = estado.proximoParrafo;

    // Al costado del número se muestra QUÉ párrafo es. Sin esto, elegir sería
    // un ejercicio de memoria: en el puesto el guardia tiene el libro delante
    // y hojea hacia atrás para encontrar dónde quedaron sus novedades. No
    // regala la respuesta —todos los párrafos dicen su actividad— pero exige
    // saber que la apertura y la fiscalización no son novedades del servicio.
    const referencia = crearParrafo(
      "referenciaCita",
      "",
      ANCHO_CONTENIDO,
      TEXTO.menor,
      PALETA.tenue
    );

    const refrescarCita = (): void => {
      numero.text = String(parrafoCitado);
      const entrada = estado.entradas.find((e) => e.numero === parrafoCitado);
      referencia.text = entrada
        ? `Párrafo ${parrafoCitado}: ${entrada.hora} · ${entrada.actividad}` +
          (entrada.anulada ? " (anulado)" : "")
        : `El párrafo ${parrafoCitado} todavía no está escrito.`;
    };

    const menos = crearBotonSecundario("btnCitaMenos", "−", 46);
    menos.left = "420px";
    menos.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    menos.onPointerUpObservable.add(() => {
      parrafoCitado = Math.max(1, parrafoCitado - 1);
      refrescarCita();
    });
    filaCita.addControl(menos);

    const mas = crearBotonSecundario("btnCitaMas", "+", 46);
    mas.left = "474px";
    mas.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    mas.onPointerUpObservable.add(() => {
      parrafoCitado = Math.min(maximo, parrafoCitado + 1);
      refrescarCita();
    });
    filaCita.addControl(mas);

    const cierreCita = crearParrafo(
      "cierreCita",
      "del presente servicio.",
      180,
      TEXTO.cuerpo,
      PALETA.cuerpo
    );
    cierreCita.left = "534px";
    cierreCita.top = "10px";
    cierreCita.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cierreCita.isHitTestVisible = false;
    filaCita.addControl(cierreCita);

    columna.addControl(filaCita);
    columna.addControl(crearEspacio("aireReferenciaCita", 4));
    columna.addControl(referencia);
    refrescarCita();

    botonAbajo(tarjeta, "btnEntregar", "Entregar el servicio", 240).onPointerUpObservable.add(
      () => {
        estado = entregarServicio(
          estado,
          Array.from(inventario),
          parrafoCitado,
          // Todo lo que alcanzó a ocurrir en el turno, esté anotado o no. Lo
          // que falte lo caza entregarServicio.
          SUCESOS_CONDOMINIO.slice(0, sucesosLlegados)
        );
        mostrarInformeFinal();
      }
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── El informe del turno ───────────────────────────────────────────────
  function mostrarInformeFinal(): void {
    const { nota, faltas } = calificar(estado);
    const alto = Math.min(620, 300 + faltas.length * 96);
    const { velo, tarjeta, columna } = armarCapa(
      "Informe",
      alto,
      nota >= 60 ? PALETA.acierto : PALETA.error
    );

    columna.addControl(crearRotulo("rotuloInforme", "TURNO ENTREGADO"));
    columna.addControl(crearEspacio("aireRotuloInforme", 10));
    columna.addControl(
      crearParrafo(
        "notaInforme",
        `${nota} / 100`,
        ANCHO_CONTENIDO,
        TEXTO.mayor,
        nota >= 60 ? PALETA.acierto : PALETA.error,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireDivisorInforme", 16));
    columna.addControl(crearDivisor("divisorInforme", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorInforme", 16));

    if (faltas.length === 0) {
      columna.addControl(
        crearParrafo(
          "sinFaltasInforme",
          "El libro quedó sin faltas: en orden cronológico, sin apreciaciones personales ni " +
            "hechos que no consten, y entregado conforme al cargo fijo.",
          ANCHO_CONTENIDO,
          TEXTO.cuerpo,
          PALETA.acierto
        )
      );
    } else {
      faltas.forEach((falta, i) => {
        columna.addControl(
          crearParrafo(
            `faltaInforme_${i}`,
            falta.subsanada ? `${falta.descripcion}  —  anulada` : falta.descripcion,
            ANCHO_CONTENIDO,
            TEXTO.cuerpo,
            falta.subsanada ? PALETA.aviso : PALETA.error,
            "500"
          )
        );
        columna.addControl(crearEspacio(`aireFundInforme_${i}`, 4));
        columna.addControl(
          crearParrafo(
            `fundInforme_${i}`,
            falta.fundamento,
            ANCHO_CONTENIDO,
            TEXTO.menor,
            PALETA.tenue
          )
        );
        columna.addControl(crearEspacio(`aireFaltaInforme_${i}`, 14));
      });
    }

    botonAbajo(tarjeta, "btnSalirInforme", "Salir del puesto", 220).onPointerUpObservable.add(
      () => {
        cerrarTodo();
        onCompletado();
      }
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }
}