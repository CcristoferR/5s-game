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
  crearBotonSecundario,
  crearBotonOpcion,
  rotularOpcion,
  neutralizarAnimaciones,
  altoDeTexto,
  desvanecer,
  afinarGui,
  conAlfa,
  crearBotonTurno as botonTurno,
} from "../../ui/EstiloUI";
import {
  libroVacio,
  abrirServicio,
  registrar,
  anular,
  intentarBorrar,
  registrarCodigoIncorrecto,
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
import { crearRelojTurno, type RelojTurno } from "./RelojTurno";
import { registrarTurno, NOTA_APROBACION } from "./HistorialTurnos";
import { LLAMADAS_RADIO, type LlamadaRadio } from "./ComunicacionesRadio";
import {
  APERTURA,
  SUCESOS_CONDOMINIO,
  INSTRUCCIONES_FISCALIZACION,
  MINUTO_FISCALIZACION,
  MINUTO_ENTREGA,
  CAMARAS_POR_SUCESO,
} from "./SucesosCondominio";

// ===========================================================================
// Pantalla del libro de novedades — Escenario 1 (condominio)
// ===========================================================================
//
// El turno completo pasa por acá: se abre la cabecera, van llegando las
// novedades, a las 03:20 fiscaliza el supervisor y a las 08:00 se entrega el
// servicio. Todo lo que se puntúa es lo que quedó escrito.
//
// ─── POR QUÉ NO HAY NINGÚN AVISO AL ELEGIR UNA REDACCIÓN ──────────────────
//
// Se elige una de las cuatro formas de anotar, se escribe, y no pasa NADA. Ni
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

/**
 * Ancho del botón de una acción de registro.
 *
 * De las medidas de columna que había aquí ya no queda ninguna: los
 * registros dejaron de ser filas de una tabla y se apilan, así que cada uno
 * mide lo que mide su texto. Ver filaEntrada.
 */
const COL_ACCIONES = 100;

/**
 * Medidas de un registro del turno.
 *
 * Van en el módulo y no dentro de mostrarPantallaLibro por un motivo que
 * cuesta ver y se paga caro: los ayudantes de esa función se declaran
 * DESPUÉS de su `return`. Con `function` da igual, porque se eleva entera y
 * queda disponible; con `const` no — la línea nunca llega a ejecutarse, la
 * constante se queda en la zona muerta temporal para siempre, y el primero
 * que la lee se lleva un ReferenceError en tiempo de ejecución.
 *
 * TypeScript no lo avisa: no sigue la zona muerta a través de un return
 * dentro de un cierre. Compilaba limpio y reventaba al abrir el libro.
 */
/** Ancho útil de un registro, ya descontada la barra del visor. */
const ANCHO_REGISTRO = ANCHO_CONTENIDO - 18;
/** Grosor del raíl de estado, a la izquierda del registro. */
const RAIL = 2;
/** Aire entre el raíl y el contenido. */
const SANGRIA = 16;

/**
 * La acción de una fila que pide algo —responder la radio, anotar una
 * novedad—, dibujada como pastilla al costado. Antes era una etiqueta en
 * mayúsculas con una flecha, y no se leía como algo que se pueda apretar.
 */
function pastillaAccion(nombre: string, texto: string, color: string): Rectangle {
  const pastilla = new Rectangle(nombre);
  pastilla.width = "128px";
  pastilla.height = "34px";
  pastilla.cornerRadius = 17;
  pastilla.thickness = 1;
  pastilla.color = conAlfa(color, 0.6);
  pastilla.background = conAlfa(color, 0.18);
  pastilla.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  pastilla.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  pastilla.left = -SANGRIA + "px";
  pastilla.isHitTestVisible = false;

  const rotulo = new TextBlock(`${nombre}_texto`, texto);
  rotulo.color = PALETA.titulo;
  rotulo.fontSize = 14;
  rotulo.fontWeight = "600";
  rotulo.isHitTestVisible = false;
  pastilla.addControl(rotulo);
  return pastilla;
}

/**
 * El libro abierto, como algo que dura todo el turno.
 *
 * Antes esta pantalla era de ida: se abría y no se salía hasta entregar el
 * servicio. Ahora se puede cerrar para volver al puesto —a mirar el monitor,
 * que es donde se ve ocurrir lo que hay que anotar— y volver a abrirla con
 * todo lo escrito donde estaba.
 */
export interface SesionLibro {
  /** Vuelve a abrir el libro donde quedó. */
  abrir(): void;
  /**
   * Atiende la llamada de radio que esté entrando, si la hay.
   *
   * Existe porque el aviso de una llamada es el piloto del equipo, sobre el
   * mesón: lo natural al verlo encenderse es apretar la radio, no abrir el
   * libro y buscar una fila. Sin esto, el aviso señalaba a un aparato que no
   * respondía.
   */
  atenderRadio(): void;
}

/**
 * Lo que el libro le cuenta al monitor.
 *
 * El libro no sabe de cuadrantes ni de cámaras: solo avisa qué pasó y qué
 * quedó escrito. Quién enciende qué pantalla se decide fuera — así el libro
 * sigue funcionando igual en un escenario que no tenga monitor.
 */
export interface EnlaceMonitor {
  /** Un suceso acaba de ocurrir. */
  alOcurrir(suceso: SucesoTurno): void;
  /** La novedad quedó escrita: ya no está pendiente. */
  alQuedarEscrita(suceso: SucesoTurno): void;
}

/**
 * Lo que el libro necesita de la sala.
 *
 * Igual que con el monitor: el libro no sabe que hay una puerta ni una figura
 * caminando. Solo avisa que llegó la hora de la fiscalización y espera a que
 * le digan que ya puede mostrar los reparos. Un escenario sin sala —o sin
 * supervisor modelado— pasa un enlace que llama al aviso de inmediato y el
 * libro funciona igual.
 */
export interface EnlaceEscena {
  /** Es la hora: que entre. Llama a `alPlantarse` cuando esté en el mesón. */
  llegaSupervisor(alPlantarse: () => void): void;
  /** Terminó la fiscalización: que se vaya. */
  seRetiraSupervisor(): void;
  /**
   * El turno avanzó un minuto.
   *
   * La sala decide qué hace con esa hora: quién cruza el hall, qué marcan las
   * cámaras. El libro no sabe nada de eso — solo lleva la hora, porque la hora
   * del turno es un dato del documento.
   */
  alAvanzarMinuto(minuto: number): void;
  /**
   * Entra o se cierra una llamada de radio.
   *
   * La escena lo usa para el piloto del equipo. Va aquí y no dentro del panel
   * porque el aviso tiene que verse ESTANDO EN EL PUESTO, con el libro
   * cerrado: si solo se anunciara en la interfaz, la radio volvería a ser un
   * menú y no un aparato que hay sobre el mesón.
   */
  suenaRadio(activa: boolean): void;
}

/**
 * Lo que el libro necesita del mesón.
 *
 * El libro dejó de ser un panel que se abre encima de la escena: ahora es el
 * cuaderno que hay sobre la mesa. Abrirlo inclina la cámara sobre él, y lo
 * que se escribe aparece en sus hojas. Nada de eso lo hace este archivo —solo
 * avisa— porque la escritura del turno es la misma tenga o no un mesón
 * detrás: un escenario sin libro modelado pasa un enlace vacío y todo sigue
 * funcionando.
 */
export interface EnlaceMeson {
  /** Se abrió el libro: acercarse a él. */
  seAbre(): void;
  /**
   * Se cerró: volver a la silla.
   *
   * `devolverControl` va en falso cuando el cierre es parte de una secuencia
   * guionada —la llegada del supervisor—, porque ahí la cámara la lleva la
   * escena y el jugador no debe poder girarla hasta que termine.
   */
  seCierra(devolverControl: boolean): void;
  /**
   * Cambió lo escrito: pasarlo a las hojas.
   *
   * `aLaVista` dice si el libro está descubierto, sin panel delante. Solo
   * entonces lo nuevo se TRAZA —letra a letra, como se escribe— y
   * `alTerminar` llega cuando cae la última letra, o enseguida si no había
   * nada que escribir. Con un panel encima o sentado en la silla las hojas
   * esperan: la constancia se escribe cuando el guardia vuelve a inclinarse.
   */
  seEscribe(estado: EstadoLibro, aLaVista: boolean, alTerminar?: () => void): void;
}

export function mostrarPantallaLibro(
  scene: Scene,
  onCompletado: () => void,
  monitor: EnlaceMonitor,
  escena: EnlaceEscena,
  usuario: string,
  meson: EnlaceMeson
): SesionLibro {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("pantallaLibro", true, scene);
  // FUERA DEL POST-PROCESO.
  //
  // Una capa de Babylon pasa por defecto por la tubería de la cámara, y el
  // puesto tiene bloom, grano, viñeta y contraste. Mientras esa tubería estuvo
  // colgada de una cámara destruida no se notaba; en cuanto se enganchó bien,
  // la interfaz empezó a recibirlo todo: el botón claro florecía, el texto salía
  // granulado y la tarjeta se lavaba. La interfaz no es parte de la escena y no
  // tiene por qué verse a través de la cámara.
  if (gui.layer) gui.layer.applyPostProcess = false;
  afinarGui(gui);

  let estado: EstadoLibro = libroVacio();
  const escritos = new Set<string>();
  let fiscalizacionHecha = false;
  /** Cuándo se abrió el servicio de verdad, para medir cuánto duró el intento. */
  const comenzadoEn = new Date();

  /**
   * Novedades que ya ocurrieron, por su id. Las ocurridas y no escritas son
   * las pendientes.
   *
   * ─── POR QUÉ POR ID Y NO POR UN CONTADOR ────────────────────────────────
   *
   * Antes esto era un número: cuántas habían ocurrido, contando desde el
   * principio de la lista. Funcionaba mientras la lista estuviera en orden
   * cronológico, y eso era una condición que ningún sitio comprobaba ni decía.
   *
   * En cuanto una novedad cambió de hora sin cambiar de sitio en la lista, el
   * turno se quedó atascado en ella: miraba la siguiente por índice, veía que
   * su hora aún no había llegado, y daba por hecho que ninguna de las
   * posteriores había ocurrido tampoco. Dos novedades no aparecieron a su hora
   * y las tres saltaron juntas más tarde.
   *
   * Con el conjunto de ids se recorren TODAS y cada una responde por su propia
   * hora. El orden de la lista pasa a ser cosa de quien la lee, no una regla
   * oculta de la que depende que el turno funcione.
   */
  const ocurridos = new Set<string>();

  /** Llamadas ya entradas, para no repetirlas. */
  const radioEntradas = new Set<string>();
  /** La que está sonando y aún no se ha atendido, si hay alguna. */
  let llamadaEnEspera: LlamadaRadio | null = null;

  /**
   * Qué pantalla está al frente.
   *
   * Interesa solo para saber si el libro está cerrado —el jugador se fue a
   * mirar el monitor— y el clic sobre la tapa debe reabrirlo.
   */
  let pantallaActual: "libro" | "otra" | "cerrado" = "otra";

  /**
   * Hay una secuencia en marcha en la sala.
   *
   * Es un estado aparte de "qué pantalla está al frente", y hace falta porque
   * durante la llegada del supervisor NO hay ninguna pantalla al frente: el
   * libro se aparta a propósito para que se le vea entrar. Sin esta bandera,
   * apartar el libro se leía como "el jugador se fue al puesto" y el reloj se
   * reanudaba solo, con el turno corriendo por debajo de una escena guionada
   * — y residentes cruzando el hall justo cuando entra el supervisor.
   */
  let enSecuencia = false;

  /**
   * El reloj de la cabecera del libro, mientras esté en pantalla.
   *
   * Se guarda para poder actualizarlo minuto a minuto sin rehacer la
   * pantalla: reconstruir la tarjeta entera sesenta veces por turno perdería
   * la posición del visor en cada latido, que es justo lo que hace ilegible
   * una lista que crece.
   */
  let relojEnPantalla: TextBlock | null = null;

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

  /**
   * Deja correr el turno solo cuando el jugador no está decidiendo.
   *
   * Con el libro a la vista o estando en el puesto, el reloj corre: son los
   * momentos en los que el jugador mira, espera y decide qué hacer, y es ahí
   * donde el tiempo tiene que pesar.
   *
   * Con un panel delante —eligiendo una redacción, leyendo los reparos,
   * cuadrando el cargo fijo— se detiene. No por piedad: porque dejarlo correr
   * ahí solo metería prisa por leer, y porque con el reloj parado NINGÚN
   * suceso puede dispararse encima de otra pantalla. Toda una familia de
   * errores desaparece por construcción.
   */
  /**
   * Cambia de pantalla, y con ella la postura.
   *
   * La pose va aparte de la pantalla porque no se deduce de ella: escribir
   * la apertura y elegir la redacción de una novedad son paneles distintos y
   * los dos ocurren con la nariz metida en el libro, mientras que atender al
   * supervisor y leer el informe final ocurren sentado. Deducirlo del tipo de
   * pantalla obligaría a mirar quién llama; decirlo en cada sitio se lee solo.
   */
  function verPantalla(
    cual: "libro" | "otra" | "cerrado",
    pose: "libro" | "silla" = "libro",
    alTrazado?: () => void
  ): void {
    pantallaActual = cual;
    if (cual === "cerrado" || pose === "silla") meson.seCierra(!enSecuencia);
    else meson.seAbre();
    // Las hojas se ponen al día en cada cambio de pantalla. Toda escritura
    // termina en uno, así que con esto no hace falta acordarse de repintar
    // detrás de cada constancia. Y solo con la vista del libro al frente se
    // ve trazar: detrás de un panel no hay nadie mirando la plana.
    meson.seEscribe(estado, cual === "libro", alTrazado);
    ajustarReloj();
  }

  function ajustarReloj(): void {
    if (estado.cerrado || enSecuencia) {
      reloj.correr(false);
      return;
    }
    reloj.correr(pantallaActual === "libro" || pantallaActual === "cerrado");
  }

  /**
   * Retira YA la capa que esté al frente, sin desvanecerla.
   *
   * Sin ceremonia y de forma síncrona, porque se usa justo antes de montar
   * otra: lo que importa es que no lleguen a existir dos a la vez, no que la
   * saliente se vaya con gracia.
   */
  function retirarCapaYa(): void {
    const velo = capaActual;
    capaActual = null;
    relojEnPantalla = null;
    if (!velo) return;
    velo.isPointerBlocker = false;
    try {
      velo.dispose();
    } catch {
      /* ya se había ido */
    }
  }

  /** Quita de pantalla lo que esté al frente, sin tocar el estado. */
  function desmontarCapa(): void {
    // La cabecera se va con la capa: dejar la referencia viva haría que el
    // reloj siguiera escribiendo sobre un control ya desechado.
    relojEnPantalla = null;
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

  /**
   * Cierra el libro para volver al puesto.
   *
   * La sesión sigue viva: lo escrito, lo anulado y la hora del turno siguen
   * donde estaban. El turno NO se pausa mientras el libro está cerrado —esa
   * es la gracia, porque es entonces cuando se ve pasar algo por el monitor.
   */
  function cerrarPorAhora(): void {
    verPantalla("cerrado");
    desmontarCapa();
  }

  /** Cierra del todo. El turno se entregó y ya no hay a qué volver. */
  function cerrarTodo(): void {
    verPantalla("cerrado");
    desmontarCapa();
  }

  /** Botón chico para las acciones de cada renglón. */
  function botonMinimo(nombre: string, texto: string, color: string): Button {
    const boton = Button.CreateSimpleButton(nombre, texto);
    boton.width = COL_ACCIONES + "px";
    boton.height = "26px";
    boton.fontSize = 12;
    boton.fontWeight = "600";
    boton.cornerRadius = 13;
    boton.thickness = 1;
    boton.color = PALETA.borde;
    boton.background = "transparent";
    boton.hoverCursor = "pointer";
    neutralizarAnimaciones(boton);
    if (boton.textBlock) {
      boton.textBlock.color = color;
      boton.textBlock.isHitTestVisible = false;
    }
    boton.onPointerEnterObservable.add(() => {
      boton.color = conAlfa(color, 0.6);
      boton.background = conAlfa(color, 0.12);
    });
    boton.onPointerOutObservable.add(() => {
      boton.color = PALETA.borde;
      boton.background = "transparent";
    });
    return boton;
  }

  /** Armazón común: velo, tarjeta, filete y columna de contenido. */
  /**
   * Monta una pantalla del libro.
   *
   * `apoyada` es la diferencia entre un panel y una mesa. Los paneles de
   * decisión —la apertura, la redacción de una novedad, los reparos del
   * supervisor— van centrados sobre un velo opaco, porque exigen una
   * respuesta y lo de detrás sobra mientras tanto.
   *
   * La pantalla del libro no. Ahora que la cámara se inclina sobre el mesón y
   * lo escrito aparece en las hojas de verdad, taparlo con un velo opaco
   * anularía justo lo que se acaba de ganar: se apoya abajo, sin oscurecer,
   * y el libro se lee por encima de ella.
   */
  function armarCapa(
    nombre: string,
    alto: number,
    colorFilete: string,
    apoyada = false
  ): { velo: Rectangle; tarjeta: Rectangle; columna: StackPanel } {
    // SOLO PUEDE HABER UNA CAPA, y se garantiza aquí.
    //
    // Antes cada pantalla retiraba la anterior al final de sí misma, con
    // reemplazarCapa. Bastaba con que un camino no llegara a llamarla —o la
    // llamara con capaActual ya en nulo— para que quedaran dos vivas, una
    // encima de la otra, y la de arriba bloqueaba el puntero de la de abajo:
    // el jugador se quedaba mirando un botón que no respondía.
    //
    // Eso llevaba tiempo pudiendo pasar sin que se notara, porque el velo era
    // opaco y tapaba entera la capa sobrante. En cuanto el del libro se hizo
    // transparente para dejar ver el mesón, quedó a la vista.
    //
    // Retirándola al MONTAR en vez de al reemplazar, la invariante deja de
    // depender de que cada pantalla se acuerde de cumplirla.
    retirarCapaYa();

    const velo = crearVelo(gui, `velo${nombre}`);
    if (apoyada) {
      // Sigue bloqueando el puntero —el mesón no se manosea con el libro
      // abierto— pero deja ver. Un velo transparente que bloquea es
      // exactamente lo que hace falta: mirar sí, tocar no.
      velo.background = "transparent";
    }
    const tarjeta = crearTarjeta(velo, `tarjeta${nombre}`, ANCHO_TARJETA, alto);
    // Esquinas más abiertas y una sombra suave: la tarjeta se separa de la
    // escena por profundidad, no por brillo.
    tarjeta.cornerRadius = 18;
    tarjeta.shadowColor = "rgba(0,0,0,0.45)";
    tarjeta.shadowBlur = 28;
    tarjeta.shadowOffsetY = 10;
    if (apoyada) {
      tarjeta.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      tarjeta.top = "-26px";
      // Algo translúcida: se sigue viendo el mesón por debajo del papel de
      // la tarjeta, y eso es lo que la ata a la escena en vez de dejarla
      // flotando delante.
      tarjeta.alpha = 0.96;
    }
    // El filete de color, más corto que la tarjeta: a todo lo ancho asomaba
    // en ángulo recto por encima de las esquinas redondeadas.
    const filete = crearFilete(tarjeta, `filete${nombre}`, ANCHO_TARJETA - 72, colorFilete);
    filete.cornerRadius = 2;

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

  /**
   * Una lista que puede crecer más que su tarjeta.
   *
   * Los reparos del supervisor y las faltas del informe salen de contar
   * errores, así que su número no se sabe al escribir el panel: un turno
   * limpio trae cero y uno desastroso puede traer ocho. Las tarjetas topan su
   * alto para no salirse de la pantalla, y sin un scroll lo que pasa del tope
   * se dibuja igual, por debajo del borde y encima del botón.
   *
   * Devuelve la pila donde meter el contenido; el scroll se encarga del resto.
   */
  function listaDesplazable(
    tarjeta: Rectangle,
    nombre: string,
    arriba: number,
    alto: number
  ): StackPanel {
    const scroll = new ScrollViewer(`scroll${nombre}`);
    scroll.width = ANCHO_CONTENIDO + 14 + "px";
    scroll.height = Math.max(80, alto) + "px";
    scroll.thickness = 0;
    scroll.barColor = PALETA.tenue;
    scroll.barBackground = "rgba(255,255,255,0.05)";
    scroll.left = MARGEN + "px";
    scroll.top = arriba + "px";
    scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(scroll);

    const pila = new StackPanel(`pila${nombre}`);
    pila.isVertical = true;
    pila.width = ANCHO_CONTENIDO + "px";
    scroll.addControl(pila);
    return pila;
  }

  function botonAbajo(tarjeta: Rectangle, nombre: string, texto: string, ancho: number): Button {
    const boton = botonTurno(nombre, texto, ancho, "principal");
    boton.left = -MARGEN + "px";
    boton.top = "-24px";
    boton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    boton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(boton);
    return boton;
  }

  /**
   * El reloj del turno.
   *
   * Arranca detenido: hasta que no se abre el libro con la cabecera de las
   * 00:00, el servicio no ha empezado. Y se detiene en cada panel de decisión,
   * que es lo que garantiza que nada salte encima de otra pantalla.
   */
  const reloj: RelojTurno = crearRelojTurno(scene, {
    minutoFinal: MINUTO_ENTREGA,
    // Todo lo que exige atención: cada novedad, la fiscalización y el relevo.
    // Ordenados, porque el reloj busca el próximo recorriéndolos de principio
    // a fin y se queda con el primero que aún no ha alcanzado.
    hitos: [
      ...SUCESOS_CONDOMINIO.map((s) => s.minuto),
      MINUTO_FISCALIZACION,
      MINUTO_ENTREGA,
    ].sort((a, b) => a - b),
    alAvanzar: alPasarMinuto,
  });

  mostrarApertura();

  return {
    abrir() {
      // Con el servicio ya entregado no hay libro al que volver, y con el
      // libro ya en pantalla el clic sobre la tapa no debe apilar otra capa.
      if (estado.cerrado || pantallaActual !== "cerrado") return;
      mostrarLibro();
    },
    atenderRadio() {
      // Sin llamada entrando, la radio no hace nada: es un equipo a la
      // escucha, no un menú que se abra cuando a uno le apetece.
      if (estado.cerrado || !llamadaEnEspera) return;
      // Y solo desde el puesto: con un panel delante, el velo ya bloquea el
      // puntero, pero esta guarda evita apilar una capa sobre otra si el
      // clic llegara por cualquier otro camino.
      if (pantallaActual === "otra") return;
      mostrarLlamadaRadio(llamadaEnEspera);
    },
  };

  // ─── 00:00 · La cabecera ────────────────────────────────────────────────
  //
  // No es un trámite: el manual dedica media página al formato, y abrir mal
  // un libro es el error que después nadie puede arreglar. Se muestra campo
  // por campo, con los nombres que usa el manual, y se escribe entera como
  // párrafo 1.
  function mostrarApertura(): void {
    verPantalla("otra");
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
    // LA TARJETA ESPERA A LA ÚLTIMA LETRA.
    //
    // Si hay algo nuevo, se escribe ahora sobre las hojas, y la tarjeta que se
    // apoya abajo taparía justo la mitad de la plana donde cae. Se monta
    // igual —así ninguna otra pantalla puede quedar debajo— pero oculta, y
    // entra cuando la constancia está escrita. Sin nada que escribir, entra
    // enseguida, como siempre.
    let capa: Rectangle | null = null;
    let trazado = false;
    const aparecer = (): void => {
      if (!capa || capaActual !== capa) return;
      capa.isVisible = true;
      desvanecer(capa, 0, 1, 200);
    };
    verPantalla("libro", "libro", () => {
      trazado = true;
      aparecer();
    });

    // La tarjeta se apoya abajo y deja el libro a la vista por encima, así que
    // su alto es un compromiso: lo bastante para trabajar, lo justo para no
    // tapar la plana. Las tres medidas se declaran juntas porque el scroll de
    // en medio se calcula restando las otras dos — que es lo que evita volver
    // a tener bloques peleándose por el mismo sitio.
    const ALTO = 470;
    const ALTO_ENCABEZADO = 128;
    const ALTO_BOTONERA = 110;

    const { velo, tarjeta } = armarCapa("Libro", ALTO, PALETA.aviso, true);

    // ── Cabecera ────────────────────────────────────────────────────────────
    //
    // Rótulo, instalación y RELOJ DEL TURNO. Lo último es lo que faltaba: el
    // turno corre solo desde que empieza, y con el libro abierto no había forma
    // de saber qué hora era. Se pedía trabajar contra un reloj invisible.
    const cabecera = new Rectangle("cabeceraLibro");
    cabecera.width = ANCHO_CONTENIDO + "px";
    cabecera.height = ALTO_ENCABEZADO - 22 + "px";
    cabecera.thickness = 0;
    cabecera.left = MARGEN + "px";
    cabecera.top = "26px";
    cabecera.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cabecera.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(cabecera);

    const rotulo = etiqueta("rotuloLibro", "LIBRO DE NOVEDADES", PALETA.rotulo, 320);
    rotulo.fontSize = 11;
    cabecera.addControl(rotulo);

    const titulo = crearParrafo(
      "tituloLibro",
      APERTURA.instalacion,
      ANCHO_CONTENIDO - 200,
      TEXTO.destacado,
      PALETA.titulo,
      "600"
    );
    titulo.top = "22px";
    titulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    titulo.isHitTestVisible = false;
    cabecera.addControl(titulo);

    // El reloj, a la derecha y en monoespaciado: es un dato de instrumento, no
    // prosa. Se guarda la referencia porque tiene que latir cada minuto sin
    // rehacer la pantalla entera.
    // Dentro de una pastilla: se lee como un instrumento y no como un título
    // más de la cabecera.
    const pastillaReloj = new Rectangle("pastillaRelojLibro");
    pastillaReloj.width = "150px";
    pastillaReloj.height = "46px";
    pastillaReloj.cornerRadius = 12;
    pastillaReloj.thickness = 1;
    pastillaReloj.color = conAlfa(PALETA.dato, 0.35);
    pastillaReloj.background = conAlfa(PALETA.dato, 0.12);
    pastillaReloj.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    pastillaReloj.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    pastillaReloj.isHitTestVisible = false;
    cabecera.addControl(pastillaReloj);

    relojEnPantalla = new TextBlock("relojLibro", horaDe(reloj.minuto()));
    relojEnPantalla.color = PALETA.titulo;
    relojEnPantalla.fontSize = 26;
    relojEnPantalla.fontWeight = "700";
    relojEnPantalla.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    relojEnPantalla.isHitTestVisible = false;
    pastillaReloj.addControl(relojEnPantalla);

    const pieTurno = etiqueta("pieTurnoLibro", `TURNO ${APERTURA.turno}`, PALETA.tenue, 220);
    pieTurno.fontSize = 11;
    pieTurno.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    pieTurno.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    pieTurno.top = "56px";
    cabecera.addControl(pieTurno);

    // Filete de un píxel en vez de divisor: separa sin dibujar una raya.
    const filete = new Rectangle("fileteLibro");
    filete.width = ANCHO_CONTENIDO + "px";
    filete.height = "1px";
    filete.thickness = 0;
    filete.background = PALETA.linea;
    filete.left = MARGEN + "px";
    filete.top = ALTO_ENCABEZADO - 14 + "px";
    filete.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    filete.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    filete.isHitTestVisible = false;
    tarjeta.addControl(filete);

    // Las novedades que ya ocurrieron y siguen sin anotar.
    const pendientes = SUCESOS_CONDOMINIO.filter((s) => ocurridos.has(s.id)).filter(
      (s) => !escritos.has(s.id)
    );

    // ── El visor ────────────────────────────────────────────────────────────
    //
    // Todo el contenido va en UN solo visor: los pendientes primero y lo escrito
    // debajo. Antes eran dos bloques anclados a bordes opuestos, cada uno con su
    // alto calculado para terminar justo donde empezaba el otro; en cuanto la
    // tarjeta cambió de tamaño la cuenta dejó de cuadrar y se dibujaron encima.
    // Apilados, el solapamiento no es que esté corregido: no se puede dar.
    const scroll = new ScrollViewer("scrollLibro");
    scroll.width = ANCHO_CONTENIDO + "px";
    scroll.height = ALTO - ALTO_ENCABEZADO - ALTO_BOTONERA + "px";
    scroll.thickness = 0;
    // Barra de tres píxeles, sin fondo y sin flechas. Una barra de sistema en
    // una tarjeta oscura canta muchísimo, y aquí no hace falta agarrarla: se
    // desplaza con la rueda.
    scroll.barSize = 3;
    scroll.barColor = "rgba(255,255,255,0.22)";
    scroll.barBackground = "transparent";
    scroll.wheelPrecision = 0.02;
    scroll.left = MARGEN + "px";
    scroll.top = ALTO_ENCABEZADO + "px";
    scroll.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    tarjeta.addControl(scroll);

    const lista = new StackPanel("listaLibro");
    lista.isVertical = true;
    // Más estrecho que el visor a propósito: es lo que garantiza que la barra
    // horizontal —que en una lista de texto no pinta nada— no aparezca nunca.
    lista.width = ANCHO_REGISTRO + "px";
    scroll.addControl(lista);

    // La llamada sin atender va ARRIBA DEL TODO, por delante de las novedades.
    //
    // Una frecuencia no espera: mientras no se conteste, el otro extremo no
    // sabe si se le oye. Anotar puede aguantar medio minuto; responder a
    // central, no.
    if (llamadaEnEspera) {
      const enEspera = llamadaEnEspera;
      const marco = registro("filaRadio", 70, PALETA.dato, conAlfa(PALETA.dato, 0.14));
      marco.isPointerBlocker = true;
      marco.hoverCursor = "pointer";
      marco.onPointerEnterObservable.add(() => (marco.background = conAlfa(PALETA.dato, 0.22)));
      marco.onPointerOutObservable.add(() => (marco.background = conAlfa(PALETA.dato, 0.14)));

      const tituloRadio = etiqueta(
        "radioTitulo",
        `${horaDe(enEspera.minuto)}   RADIO`,
        PALETA.titulo,
        320
      );
      tituloRadio.fontSize = TEXTO.menor;
      tituloRadio.left = SANGRIA + "px";
      tituloRadio.top = "13px";
      marco.addControl(tituloRadio);

      const pieRadio = etiqueta(
        "radioPie",
        `LLAMADA DE ${enEspera.quien} SIN ATENDER`,
        PALETA.dato,
        360
      );
      pieRadio.fontSize = 11;
      pieRadio.left = SANGRIA + "px";
      pieRadio.top = "37px";
      marco.addControl(pieRadio);

      marco.addControl(pastillaAccion("radioAccion", "Responder  ›", PALETA.dato));

      marco.onPointerUpObservable.add(() => mostrarLlamadaRadio(enEspera));
      lista.addControl(marco);
      lista.addControl(crearEspacio("aireTrasRadio", 12));
    }

    if (pendientes.length > 0) {
      pendientes.forEach((suceso) => lista.addControl(filaPendiente(suceso)));
      lista.addControl(crearEspacio("aireTrasPendientes", 12));
    }

    if (estado.entradas.length > 0) {
      const rotuloEscrito = etiqueta(
        "rotuloEscrito",
        `ESCRITO   ${estado.entradas.length}`,
        PALETA.tenue,
        ANCHO_REGISTRO
      );
      rotuloEscrito.fontSize = 11;
      rotuloEscrito.height = "24px";
      rotuloEscrito.paddingLeft = SANGRIA + "px";
      lista.addControl(rotuloEscrito);
    }

    // Lo ya escrito sigue aquí —además de en las hojas— porque es desde donde se
    // anula una constancia, que es la única corrección que el manual permite.
    estado.entradas.forEach((entrada) => lista.addControl(filaEntrada(entrada)));

    // Adelantar. Ya no hace avanzar el turno —eso lo hace el reloj, corra el
    // jugador o no—: solo acelera las horas muertas. Se apaga solo en cuanto
    // ocurre algo, así que no hay forma de saltarse una novedad con él.
    // Mientras adelanta, el botón pasa al ámbar de aviso: se ve de reojo que el
    // turno va rápido, sin tener que leer la etiqueta.
    const acentoAvance = (): string => (reloj.estaAdelantando() ? PALETA.aviso : PALETA.dato);
    const btnAvanzar = botonTurno(
      "btnAdelantar",
      reloj.estaAdelantando() ? "Adelantando…  »" : "Adelantar el turno  »",
      260,
      "principal",
      acentoAvance
    );
    btnAvanzar.left = -MARGEN + "px";
    btnAvanzar.top = "-24px";
    btnAvanzar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    btnAvanzar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(btnAvanzar);
    btnAvanzar.onPointerUpObservable.add(() => {
      reloj.adelantar(!reloj.estaAdelantando());
      if (btnAvanzar.textBlock) {
        btnAvanzar.textBlock.text = reloj.estaAdelantando()
          ? "Adelantando…  »"
          : "Adelantar el turno  »";
      }
      // El puntero sigue encima al soltar: se repinta en ese estado.
      btnAvanzar.background = conAlfa(acentoAvance(), 0.32);
      btnAvanzar.color = conAlfa(acentoAvance(), 0.8);
    });

    // Salir al puesto. Es la pieza que hace utilizable el monitor: sin esto
    // el libro tapa la escena de punta a punta y las cámaras no las ve nadie.
    const btnPuesto = botonTurno("btnVolverPuesto", "Volver al puesto", 200, "secundario");
    btnPuesto.left = MARGEN + "px";
    btnPuesto.top = "-24px";
    btnPuesto.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    btnPuesto.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    tarjeta.addControl(btnPuesto);
    btnPuesto.onPointerUpObservable.add(() => cerrarPorAhora());

    // Oculta mientras se traza: ni se ve ni recibe clics. `aparecer` la trae.
    velo.isVisible = false;
    capa = velo;
    reemplazarCapa(velo);
    if (trazado) aparecer();
  }

  /**
   * El turno corrió un minuto. Aquí se decide qué pasa a esa hora.
   *
   * Es el único sitio del nivel donde se dispara algo por tiempo, y el orden
   * importa: primero las novedades, después la fiscalización, al final la
   * entrega. Si en un mismo minuto coincidieran dos cosas —y con el turno
   * adelantado puede pasar— la novedad se anota antes de que llegue nadie a
   * revisarla, que es lo justo.
   */
  function alPasarMinuto(minuto: number): void {
    escena.alAvanzarMinuto(minuto);
    if (relojEnPantalla) relojEnPantalla.text = horaDe(minuto);

    // --- ¿Ocurre alguna novedad a esta hora? --------------------------------
    //
    // En bucle porque con el turno adelantado pueden vencer dos de golpe. Se
    // repinta UNA vez al final y no dentro del bucle: dos repintados seguidos
    // del mismo libro es trabajo tirado y un parpadeo de la capa.
    let ocurrioAlgo = false;
    for (const suceso of SUCESOS_CONDOMINIO) {
      if (ocurridos.has(suceso.id) || suceso.minuto > minuto) continue;
      ocurridos.add(suceso.id);
      monitor.alOcurrir(suceso);
      ocurrioAlgo = true;
    }
    // --- ¿Entra alguna llamada de radio? -----------------------------------
    //
    // Solo una a la vez: si ya hay una sin atender, la siguiente espera su
    // turno. Dos llamadas encimadas no ocurren en una frecuencia real, y
    // encima dejarían al jugador sin saber a cuál está respondiendo.
    if (!llamadaEnEspera) {
      const entra = LLAMADAS_RADIO.find(
        (l) => !radioEntradas.has(l.id) && l.minuto <= minuto
      );
      if (entra) {
        radioEntradas.add(entra.id);
        llamadaEnEspera = entra;
        escena.suenaRadio(true);
        // Se corta el adelanto igual que con una novedad: una llamada es
        // tráfico que hay que atender, no un trámite que se pueda saltar.
        reloj.adelantar(false);
        reloj.respirar(2.2);
        if (pantallaActual === "libro") mostrarLibro();
      }
    }

    if (ocurrioAlgo) {
      // Pasó algo: se corta el adelanto. Quien estuviera saltándose las horas
      // muertas se entera en el acto, en vez de descubrir la novedad tres
      // horas más tarde en la bandeja.
      reloj.adelantar(false);
      // Un par de segundos para levantar la vista antes de que el turno siga
      // corriendo. Es lo que separa enterarse de una novedad de encontrársela
      // ya acumulada en la bandeja.
      reloj.respirar(2.2);
      if (pantallaActual === "libro") mostrarLibro();
    }

    // --- 03:20, la fiscalización -------------------------------------------
    if (!fiscalizacionHecha && minuto >= MINUTO_FISCALIZACION) {
      fiscalizacionHecha = true;
      estado = registrarFiscalizacion(estado, INSTRUCCIONES_FISCALIZACION);

      // El libro se aparta: el supervisor entra por la puerta del hall y hay
      // que poder verlo. Si el panel saliera ahora, taparía con un velo opaco
      // justamente lo que hay que mirar.
      //
      // Y el turno se detiene mientras dura. No es una pausa de cortesía: con
      // el reloj corriendo por debajo, los residentes seguirían cruzando el
      // hall en mitad de la fiscalización.
      enSecuencia = true;
      verPantalla("cerrado");
      desmontarCapa();
      escena.llegaSupervisor(() => {
        enSecuencia = false;
        verPantalla("otra", "silla");
        mostrarFiscalizacion();
      });
      return;
    }

    // --- 08:00, la entrega --------------------------------------------------
    //
    // Llega el relevo. No se pregunta si el jugador está listo, igual que en el
    // puesto: lo que no quedó anotado a las 08:00 ya no se anota.
    if (fiscalizacionHecha && minuto >= MINUTO_ENTREGA) {
      reloj.correr(false);
      mostrarEntrega();
    }
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
  // -------------------------------------------------------------------------
  // Los registros del turno
  // -------------------------------------------------------------------------
  //
  // Antes cada constancia era una fila de cuatro columnas —hora, actividad,
  // observaciones, acciones— con los botones colgando a la derecha. Esa forma
  // traía dos problemas, y ninguno era de gusto.
  //
  // El primero: la última columna empujaba el ancho hasta pasarse del visor, y
  // de ahí salía la barra horizontal. En una lista de texto esa barra no
  // debería existir nunca.
  //
  // El segundo: una tabla de cuatro columnas necesita mucho ancho para respirar
  // y aquí no hay. Apilado —hora y actividad arriba, observación debajo a todo
  // lo ancho, acciones al pie— cabe de sobra, se lee mejor, y de paso se parece
  // más a lo que es: un asiento de libro, no una hoja de cálculo.
  //
  // El estado va en un RAÍL de dos píxeles a la izquierda en vez de en el color
  // del texto. Se ve de reojo sin leer la fila, y deja el texto en su color
  // legible en lugar de apagarlo para que signifique algo.


  /** El armazón de un registro: fondo, raíl de estado y esquinas suaves. */
  function registro(nombre: string, alto: number, colorRail: string, fondo: string): Rectangle {
    const marco = new Rectangle(nombre);
    marco.width = ANCHO_REGISTRO + "px";
    marco.height = alto + "px";
    marco.thickness = 0;
    marco.cornerRadius = 12;
    marco.background = fondo;
    marco.paddingBottom = "8px";

    // El raíl, como una píldora separada del borde: pegado al canto de una
    // tarjeta redondeada asomaba recto por las esquinas.
    const rail = new Rectangle(`${nombre}_rail`);
    rail.width = RAIL + 1 + "px";
    rail.height = "62%";
    rail.cornerRadius = 2;
    rail.left = "6px";
    rail.thickness = 0;
    rail.background = colorRail;
    rail.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    rail.isHitTestVisible = false;
    marco.addControl(rail);

    return marco;
  }

  /** Texto monoespaciado para horas, correlativos y etiquetas de estado. */
  function etiqueta(nombre: string, texto: string, color: string, ancho: number): TextBlock {
    const bloque = new TextBlock(nombre, texto);
    bloque.width = ancho + "px";
    bloque.height = "18px";
    bloque.color = color;
    bloque.fontSize = TEXTO.rotulo;
    bloque.fontWeight = "700";
    bloque.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    bloque.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bloque.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bloque.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    bloque.isHitTestVisible = false;
    return bloque;
  }

  function filaEntrada(entrada: EntradaLibro): Rectangle {
    const texto = entrada.anulada ? `(${entrada.observaciones})` : entrada.observaciones;
    const anchoTexto = ANCHO_REGISTRO - SANGRIA * 2;
    const altoTexto = altoDeTexto(texto, anchoTexto, TEXTO.menor);
    const alto = 44 + altoTexto + (entrada.anulada ? 14 : 42);

    const marco = registro(
      `filaLibro_${entrada.numero}`,
      alto,
      entrada.anulada ? "rgba(255,255,255,0.13)" : PALETA.dato,
      "rgba(255,255,255,0.028)"
    );

    // Correlativo, hora y actividad en una sola línea de datos.
    const cabecera = etiqueta(
      `cabLibro_${entrada.numero}`,
      `${String(entrada.numero).padStart(2, "0")}   ${entrada.hora}   ${entrada.actividad}`,
      entrada.anulada ? PALETA.tenue : PALETA.rotulo,
      anchoTexto - 100
    );
    cabecera.left = SANGRIA + "px";
    cabecera.top = "12px";
    marco.addControl(cabecera);

    if (entrada.anulada) {
      const sello = etiqueta(`selloLibro_${entrada.numero}`, "ANULADA", PALETA.aviso, 96);
      sello.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      sello.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      sello.left = -SANGRIA + "px";
      sello.top = "12px";
      marco.addControl(sello);
    }

    const obs = crearParrafo(
      `obsLibro_${entrada.numero}`,
      texto,
      anchoTexto,
      TEXTO.menor,
      entrada.anulada ? PALETA.tenue : PALETA.cuerpo
    );
    obs.left = SANGRIA + "px";
    obs.top = "38px";
    obs.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    obs.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    obs.isHitTestVisible = false;
    marco.addControl(obs);

    if (!entrada.anulada) {
      // Las acciones al pie del propio registro: donde no estorban a la lectura
      // y, sobre todo, donde no empujan el ancho de la lista.
      const anularBoton = botonMinimo(`btnAnular_${entrada.numero}`, "Anular", PALETA.aviso);
      anularBoton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      anularBoton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      anularBoton.left = -SANGRIA + "px";
      anularBoton.top = "-14px";
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

      const borrar = botonMinimo(`btnBorrar_${entrada.numero}`, "Borrar", PALETA.tenue);
      borrar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      borrar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      borrar.left = -SANGRIA - COL_ACCIONES - 8 + "px";
      borrar.top = "-14px";
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
    }

    return marco;
  }

  /**
   * Una novedad ocurrida y todavía sin anotar.
   *
   * Raíl ámbar y algo más de cuerpo que un registro escrito: es lo único de
   * esta pantalla que pide una acción, y el turno no la espera. La fila entera
   * es el botón — un objetivo de sesenta píxeles de alto, no una línea de texto.
   */
  function filaPendiente(suceso: SucesoTurno): Rectangle {
    const REPOSO = conAlfa(PALETA.aviso, 0.1);
    const ENCIMA = conAlfa(PALETA.aviso, 0.18);

    const marco = registro(`pendiente_${suceso.id}`, 66, PALETA.aviso, REPOSO);
    marco.isPointerBlocker = true;
    marco.hoverCursor = "pointer";

    const titulo = etiqueta(
      `pendienteTitulo_${suceso.id}`,
      `${horaDe(suceso.minuto)}   ${suceso.actividad}`,
      PALETA.titulo,
      320
    );
    titulo.fontSize = TEXTO.menor;
    titulo.left = SANGRIA + "px";
    titulo.top = "13px";
    marco.addControl(titulo);

    const toma = CAMARAS_POR_SUCESO[suceso.id];
    const pie = etiqueta(
      `pendientePie_${suceso.id}`,
      toma ? `SIN ANOTAR · SE VE EN CAM 0${toma.indice + 1}` : "SIN ANOTAR",
      PALETA.aviso,
      360
    );
    pie.fontSize = 11;
    pie.left = SANGRIA + "px";
    pie.top = "37px";
    marco.addControl(pie);

    marco.addControl(pastillaAccion(`pendienteAccion_${suceso.id}`, "Anotar  ›", PALETA.aviso));

    marco.onPointerEnterObservable.add(() => (marco.background = ENCIMA));
    marco.onPointerOutObservable.add(() => (marco.background = REPOSO));
    marco.onPointerUpObservable.add(() => mostrarSuceso(suceso));

    return marco;
  }

  // ─── Un suceso: cuatro formas de anotarlo, cero comentarios ─────────────
  function mostrarSuceso(suceso: SucesoTurno): void {
    verPantalla("otra");
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
    // Margen, rótulo, aire, aviso, aire, divisor y aire: lo que va antes de
    // la primera opción.
    const altoCabecera = 28 + 18 + 10 + altoAviso + 18 + 1 + 16;
    const PIE = 27;
    const altoNecesario = altoCabecera + altoOpciones + separaciones + PIE;

    // CON CUATRO REDACCIONES NO SIEMPRE CABE.
    //
    // Con tres, la tarjeta más larga del turno rondaba los 600 px. La cuarta
    // —la incompleta— la lleva por encima de 800 en los sucesos de texto largo,
    // y en un portátil eso se sale por abajo: la última opción queda fuera de
    // la pantalla y no hay forma de elegirla. Si no cabe, la tarjeta se topa al
    // alto disponible y las opciones van en un visor; el aviso queda fijo
    // arriba, que es lo que hay que tener a la vista mientras se decide.
    const altoDisponible = Math.max(420, gui.getSize().height - 48);
    const cabe = altoNecesario <= altoDisponible;
    const alto = cabe ? altoNecesario : altoDisponible;
    const { velo, tarjeta, columna } = armarCapa("Suceso", alto, PALETA.dato);

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

    const opciones = cabe
      ? columna
      : listaDesplazable(tarjeta, "OpcionesSuceso", altoCabecera, alto - altoCabecera - PIE);

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
        // La cámara vuelve a la calma: lo que mostraba ya está en el libro.
        monitor.alQuedarEscrita(suceso);
        mostrarLibro();
      });
      opciones.addControl(boton);
      if (i < suceso.opciones.length - 1) {
        opciones.addControl(crearEspacio(`aireOpcionSuceso_${i}`, 10));
      }
    });

    // Sin botón de salida: la novedad ya ocurrió y hay que anotarla. Se puede
    // elegir CUÁNDO —dejándola pendiente y siguiendo el turno— pero eso se
    // decide en el libro, no acá.

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── Aviso breve: prohibiciones y confirmaciones ────────────────────────
  /**
   * La llamada de radio.
   *
   * Mismo formato que un suceso del libro —mensaje arriba, opciones debajo,
   * explicación al elegir— y eso es deliberado: para el alumno, escoger el
   * código correcto y escoger la redacción correcta son el mismo ejercicio
   * hecho sobre dos soportes distintos. Lo que cambia es el soporte, no el
   * criterio.
   */
  function mostrarLlamadaRadio(llamada: LlamadaRadio): void {
    verPantalla("otra", "silla");

    const ANCHO_ETIQUETA = ANCHO_CONTENIDO - 82;
    const altoOpciones = llamada.opciones.reduce(
      (suma, o) =>
        suma +
        Math.max(60, altoDeTexto(`${o.codigo}   ${o.significado}`, ANCHO_ETIQUETA, TEXTO.cuerpo) + 30) +
        10,
      0
    );
    const altoMensaje = altoDeTexto(llamada.mensaje, ANCHO_CONTENIDO, TEXTO.cuerpo);
    const alto = Math.min(660, 210 + altoMensaje + altoOpciones);

    const { velo, columna } = armarCapa("Radio", alto, PALETA.dato);

    columna.addControl(crearRotulo("rotuloRadio", "RADIO · LLAMADA ENTRANTE", PALETA.dato));
    columna.addControl(crearEspacio("aireRotuloRadio", 10));
    columna.addControl(
      crearParrafo(
        "quienRadio",
        `${llamada.quien}  ·  ${horaDe(llamada.minuto)}`,
        ANCHO_CONTENIDO,
        TEXTO.destacado,
        PALETA.titulo,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireQuienRadio", 12));

    // El mensaje, como transcripción. Va entrecomillado y en cursiva visual
    // (color de dato) para que se lea como algo que SE OYE, no como una
    // instrucción del juego.
    columna.addControl(
      crearParrafo(
        "mensajeRadio",
        `«${llamada.mensaje}»`,
        ANCHO_CONTENIDO,
        TEXTO.cuerpo,
        PALETA.cuerpo
      )
    );
    columna.addControl(crearEspacio("aireMensajeRadio", 14));
    columna.addControl(crearDivisor("divisorRadio", ANCHO_CONTENIDO));
    columna.addControl(crearEspacio("airePostDivisorRadio", 12));
    columna.addControl(
      crearParrafo(
        "instruccionRadio",
        "Responda con el código que corresponda. La tarjeta de claves está sobre el mesón.",
        ANCHO_CONTENIDO,
        TEXTO.menor,
        PALETA.tenue
      )
    );
    columna.addControl(crearEspacio("aireInstruccionRadio", 12));

    llamada.opciones.forEach((opcion, i) => {
      const boton = crearBotonOpcion(
        `btnRadio_${llamada.id}_${i}`,
        `${opcion.codigo}   ·   ${opcion.significado}`,
        ANCHO_CONTENIDO
      );
      boton.onPointerUpObservable.add(() => {
        // La llamada queda atendida tanto si se acierta como si no: en una
        // frecuencia real no se puede volver a contestar lo mismo.
        llamadaEnEspera = null;
        escena.suenaRadio(false);

        if (!opcion.correcta) {
          estado = registrarCodigoIncorrecto(
            estado,
            `Se respondió ${opcion.codigo} a la llamada de las ${horaDe(llamada.minuto)}.`
          );
        }

        mostrarNota(
          opcion.correcta ? `${opcion.codigo} · CORRECTO` : `${opcion.codigo} · NO CORRESPONDE`,
          opcion.explicacion,
          opcion.correcta ? PALETA.dato : PALETA.error,
          () => {
            // Si la llamada traía trabajo, se avisa de que viene. La novedad
            // llega sola por el reloj unos minutos después; esto solo evita
            // que aparezca en la bandeja sin que nadie sepa de dónde salió.
            if (llamada.anuncia && opcion.correcta) {
              mostrarNota(
                "QUEDA PENDIENTE",
                "La ronda solicitada aparecerá en la bandeja cuando se realice. Recuerde que " +
                  "lo que central pide por radio también se registra en el libro: una ronda " +
                  "que no queda escrita es, para el servicio, una ronda que no se hizo.",
                PALETA.aviso,
                () => mostrarLibro()
              );
              return;
            }
            mostrarLibro();
          }
        );
      });
      columna.addControl(boton);
      if (i < llamada.opciones.length - 1) {
        columna.addControl(crearEspacio(`aireRadio_${i}`, 10));
      }
    });

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

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
    // Sentado: el supervisor está de pie al otro lado del mesón y hay que
    // mirarlo a él, no al papel.
    verPantalla("otra", "silla");
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

    // Los reparos, en un scroll: son tantos como errores se hayan cometido y
    // el alto de la tarjeta está topado. Ver listaDesplazable.
    const reparos = listaDesplazable(tarjeta, "Fiscalizacion", 152, alto - 152 - 128);

    if (faltas.length === 0) {
      reparos.addControl(
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
        reparos.addControl(
          crearParrafo(
            `faltaFiscalizacion_${i}`,
            falta.descripcion,
            ANCHO_CONTENIDO,
            TEXTO.cuerpo,
            PALETA.error,
            "500"
          )
        );
        reparos.addControl(crearEspacio(`aireFundamento_${i}`, 4));
        reparos.addControl(
          crearParrafo(
            `fundamentoFiscalizacion_${i}`,
            falta.fundamento,
            ANCHO_CONTENIDO,
            TEXTO.menor,
            PALETA.tenue
          )
        );
        reparos.addControl(crearEspacio(`aireFaltaFiscalizacion_${i}`, 14));
      });
    }

    reparos.addControl(crearEspacio("aireCierreFiscalizacion", 12));
    reparos.addControl(
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
      () => {
        // Se va mientras el libro se vuelve a abrir. No hay que esperarlo:
        // sale por detrás del panel y quien cierre el libro después lo pilla
        // cruzando el hall o ya fuera, según cuánto tarde.
        escena.seRetiraSupervisor();
        mostrarLibro();
      }
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── 08:00 · La entrega ─────────────────────────────────────────────────
  function mostrarEntrega(): void {
    verPantalla("otra");
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

    // El cuerpo, en un visor.
    //
    // Iba en la pila de la tarjeta, sin desplazamiento, y ya andaba justo:
    // cuatro artículos del cargo fijo, el enunciado de la cita y la fila del
    // selector suman casi los 620 px que mide. Cualquier línea de más —y el
    // enunciado son dos— se dibujaría por debajo del borde y encima del
    // botón de entregar, que es como se rompieron antes la fiscalización y
    // el informe. Con visor deja de importar cuánto crezca.
    const cuerpo = listaDesplazable(tarjeta, "Entrega", 150, 620 - 150 - 118);

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
      cuerpo.addControl(boton);
      cuerpo.addControl(crearEspacio(`aireCargo_${i}`, 6));
    });

    cuerpo.addControl(crearEspacio("airePreParrafo", 12));
    cuerpo.addControl(crearDivisor("divisorParrafo", ANCHO_CONTENIDO));
    cuerpo.addControl(crearEspacio("airePostParrafo", 14));

    // EL ENUNCIADO, que es lo que faltaba.
    //
    // Antes lo único escrito era la frase del manual, "Novedades indicadas
    // en el párrafo ____", con un selector al lado. Así no se lee como una
    // pregunta: se lee como una casilla que rellenar, y lo natural es subir
    // el número hasta el final y entregar.
    //
    // Poder equivocarse sigue siendo el punto, pero equivocarse tiene que
    // ser por no aplicar bien el criterio, no por no saber que había uno.
    // Decir cuál es el criterio no da la respuesta: los párrafos siguen
    // siendo siete y hay que saber cuáles recogen una novedad del turno y
    // cuáles no. Eso es exactamente lo que el ejercicio quiere preguntar.
    cuerpo.addControl(
      crearParrafo(
        "enunciadoCita",
        "Indica el párrafo donde consta una novedad del turno. Al lado del número " +
          "aparece de qué constancia se trata.",
        ANCHO_CONTENIDO,
        TEXTO.menor,
        PALETA.tenue
      )
    );
    cuerpo.addControl(crearEspacio("aireEnunciadoCita", 12));

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

    // El tope es el último párrafo ESCRITO, no el siguiente por escribir.
    //
    // proximoParrafo es el número que va a tomar esta misma entrega, que
    // todavía no existe. Con el tope ahí, el selector dejaba subir hasta un
    // párrafo en blanco: quien apretaba "+" hasta el final —buscando la
    // novedad más reciente, que es lo razonable— se llevaba la falta de cita
    // con el mensaje "no existe el párrafo 8", refiriéndose a un número que
    // el propio selector le había ofrecido.
    //
    // Y una entrega no puede citarse a sí misma, así que ese número no es
    // que estuviera mal elegido: es que nunca podía estar bien. Ofrecer una
    // opción que jamás es válida no enseña nada, solo descuenta diez puntos.
    //
    // Lo que SÍ sigue siendo decisión del alumno es no citar la apertura ni
    // la fiscalización: existen, se pueden elegir, y elegirlas está mal
    // porque en ellas no consta ninguna novedad. Eso es lo que el ejercicio
    // quiere preguntar.
    const maximo = Math.max(1, estado.proximoParrafo - 1);

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

    cuerpo.addControl(filaCita);
    cuerpo.addControl(crearEspacio("aireReferenciaCita", 4));
    cuerpo.addControl(referencia);
    refrescarCita();

    botonAbajo(tarjeta, "btnEntregar", "Entregar el servicio", 240).onPointerUpObservable.add(
      () => {
        estado = entregarServicio(
          estado,
          Array.from(inventario),
          parrafoCitado,
          // Todo lo que alcanzó a ocurrir en el turno, esté anotado o no. Lo
          // que falte lo caza entregarServicio.
          SUCESOS_CONDOMINIO.filter((s) => ocurridos.has(s.id))
        );
        // La entrega se firma A LA VISTA: se retira el panel, la última
        // constancia del turno se escribe sobre el libro con las dos firmas y
        // recién entonces llega el informe. Es el cierre del nivel, y es el
        // plano que tiene que quedar.
        retirarCapaYa();
        verPantalla("libro", "libro", () => mostrarInformeFinal());
      }
    );

    desvanecer(velo, 0, 1, 160);
    reemplazarCapa(velo);
  }

  // ─── El informe del turno ───────────────────────────────────────────────
  function mostrarInformeFinal(): void {
    // El turno terminó: el libro ya se entregó y no hay nada más que escribir.
    verPantalla("otra", "silla");
    const { nota, faltas } = calificar(estado);
    const aprobado = nota >= NOTA_APROBACION;

    // El turno queda registrado ANTES de dibujar nada. Si la pantalla fallara
    // al pintarse, el intento ya está guardado: lo que no puede perderse es el
    // desempeño, no el cartel que lo muestra.
    const { guardado } = registrarTurno({
      usuario,
      curso: "guardias",
      escenario: 1,
      iniciadoEn: comenzadoEn,
      nota,
      faltas,
    });

    const alto = Math.min(640, 330 + faltas.length * 96);
    const { velo, tarjeta, columna } = armarCapa(
      "Informe",
      alto,
      aprobado ? PALETA.acierto : PALETA.error
    );

    columna.addControl(
      crearRotulo("rotuloInforme", aprobado ? "TURNO APROBADO" : "TURNO NO APROBADO")
    );
    columna.addControl(crearEspacio("aireRotuloInforme", 10));
    columna.addControl(
      crearParrafo(
        "notaInforme",
        `${nota} / 100`,
        ANCHO_CONTENIDO,
        TEXTO.mayor,
        aprobado ? PALETA.acierto : PALETA.error,
        "600"
      )
    );
    columna.addControl(crearEspacio("aireMinimoInforme", 4));
    columna.addControl(
      crearParrafo(
        "minimoInforme",
        guardado
          ? `Mínimo para aprobar: ${NOTA_APROBACION}. El turno queda registrado en tu historial.`
          : `Mínimo para aprobar: ${NOTA_APROBACION}. No se pudo guardar el turno en este equipo.`,
        ANCHO_CONTENIDO,
        TEXTO.menor,
        PALETA.tenue
      )
    );
    columna.addControl(crearEspacio("aireDivisorInforme", 16));
    columna.addControl(crearDivisor("divisorInforme", ANCHO_CONTENIDO));

    // Mismo caso que la fiscalización: las faltas son tantas como errores
    // haya, y la tarjeta tiene el alto topado.
    const detalle = listaDesplazable(tarjeta, "Informe", 226, alto - 226 - 118);

    if (faltas.length === 0) {
      detalle.addControl(
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
        detalle.addControl(
          crearParrafo(
            `faltaInforme_${i}`,
            falta.subsanada ? `${falta.descripcion}  —  anulada` : falta.descripcion,
            ANCHO_CONTENIDO,
            TEXTO.cuerpo,
            falta.subsanada ? PALETA.aviso : PALETA.error,
            "500"
          )
        );
        detalle.addControl(crearEspacio(`aireFundInforme_${i}`, 4));
        detalle.addControl(
          crearParrafo(
            `fundInforme_${i}`,
            falta.fundamento,
            ANCHO_CONTENIDO,
            TEXTO.menor,
            PALETA.tenue
          )
        );
        detalle.addControl(crearEspacio(`aireFaltaInforme_${i}`, 14));
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