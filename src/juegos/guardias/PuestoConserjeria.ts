import {
  Scene,
  FreeCamera,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  PBRMaterial,
  HemisphericLight,
  PointLight,
  SpotLight,
  Mesh,
  TransformNode,
  Plane,
  MirrorTexture,
  ReflectionProbe,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  ShadowGenerator,
  Texture,
  DynamicTexture,
  ActionManager,
  ExecuteCodeAction,
  PointerEventTypes,
  Quaternion,
  type IWheelEvent,
} from "@babylonjs/core";
import { mostrarPantallaLibro, type SesionLibro } from "./PantallaLibro";
import { crearFigura, UNIFORME_SUPERVISOR, ROPA_RESIDENTE } from "./Figura";
import { crearMonitorCamaras, type MonitorCamaras } from "./MonitorCamaras";
import { crearPaginasLibro, type PaginasLibro } from "./PaginasLibro";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { CAMARAS_POR_SUCESO } from "./SucesosCondominio";
import { materialPintado, materialPintadoNitido } from "../../entities/ObjetosComunes";
import { texturaGrano, texturaMetalCepillado } from "../../entities/TexturasSuperficie";
import {
  superficieCaucho,
  relievePapel,
} from "./TexturasPuesto";
import {
  generarMadera,
  generarCuero,
  generarCantoHojas,
  generarHazFlexo,
  generarDegradadoReflector,
  subirMapa,
  proyectarUVCaja,
  proyectarUVCanto,
} from "./TexturasPBR";
import { crearAtmosferaTurno, type AtmosferaTurno, type PiezasExterior } from "./AtmosferaTurno";
import { reproducir } from "../../core/Sonido";

// ===========================================================================
// Puesto de conserjería — escenario del Escenario 1
// ===========================================================================
//
// Un mesón de recepción de noche, visto desde la silla del guardia.
//
// ─── POR QUÉ ESTO PUEDE VERSE MEJOR QUE EL 5S ─────────────────────────────
//
// No es por tener mejores modelos: es por CUÁNTO ESPACIO HAY QUE LLENAR.
//
// El 5S transcurre en un galpón de 12 × 19 m que hay que amueblar entero,
// visible desde cualquier ángulo porque la cámara orbita. El presupuesto de
// detalle se reparte entre doscientos metros cuadrados, y por eso todo tiene
// que ser sencillo.
//
// Acá la cámara está FIJA en la silla y solo gira un poco. Lo que se ve son
// dos metros y medio de mesón. El mismo esfuerzo repartido en treinta veces
// menos superficie: cabe el bisel del monitor, el grano del cuero del libro,
// el desgaste de la radio.
//
// ─── Y POR QUÉ ES DE NOCHE ────────────────────────────────────────────────
//
// Porque la oscuridad hace la mitad del trabajo gratis. Con luz de día hay que
// modelar bien todo, porque todo se ve. De noche solo se ve lo que las tres
// fuentes de luz alcanzan —el monitor, el flexo y el ventanal— y el resto se
// pierde en penumbra sin que se note que no está.
//
// No es un truco: es exactamente el turno del que habla el manual, cuyo
// ejemplo de libro va de 00:00 a 08:00.
//
// Cada luz de esta escena SALE de un objeto que se ve. Una luz sin fuente
// visible se lee como un error de iluminación; una que nace del monitor que
// está ahí delante se lee como un monitor encendido.

// ---------------------------------------------------------------------------
// Orientación de las texturas
// ---------------------------------------------------------------------------
//
// Cómo cae una textura sobre una malla depende de la normal del plano, del
// orden en que se aplican las rotaciones y de si la textura dinámica invierte
// la V. Son cuatro cosas que se multiplican entre sí, y deducirlas sobre el
// papel es una forma lenta de equivocarse: en este archivo ya salieron dos
// textos espejados razonándolo así.
//
// Por eso van aquí, en constantes con nombre. Si algo sale al revés en
// pantalla, se cambia el signo de la línea que corresponde y se vuelve a
// mirar. Es una comprobación de cinco segundos contra media hora de deducción.
//
//   ESPEJADO al derecho y al revés  ->  cambiar el HORIZONTAL de esa pieza
//   PATAS ARRIBA                    ->  cambiar el VERTICAL
//   GIRADO un cuarto de vuelta      ->  el problema es la rotación de la
//                                       malla, no la textura

/** Piezas apoyadas en el mesón, vistas desde arriba: libro y tarjeta. */
const ORIENTACION_APOYADA = { horizontal: 1, vertical: 1 };

/**
 * Aplica una orientación a la textura de un material pintado.
 *
 * -1 en horizontal invierte la textura de izquierda a derecha; -1 en vertical,
 * de arriba abajo. Con 1 y 1 no toca nada.
 */
function orientar(mat: PBRMaterial, o: { horizontal: number; vertical: number }): PBRMaterial {
  // uScale y uOffset viven en Texture, no en la clase base: las texturas de
  // entorno no las tienen. Se comprueba antes de tocarlas.
  [mat.albedoTexture, mat.emissiveTexture].forEach((base) => {
    if (!(base instanceof Texture)) return;
    base.uScale = o.horizontal;
    base.uOffset = o.horizontal < 0 ? 1 : 0;
    base.vScale = o.vertical;
    base.vOffset = o.vertical < 0 ? 1 : 0;
  });
  return mat;
}

/** Altura del ojo del guardia, sentado. */
const ALTURA_OJO = 1.3;

/**
 * Las dos poses de la cámara.
 *
 * Sentado en la silla, y echado sobre el libro para escribir en él. El libro
 * está en (-0,12 · 0,06) sobre el mesón, así que la pose de escritura se
 * planta encima suyo y algo por detrás, mirando hacia abajo: es el ángulo en
 * el que uno mira un libro que tiene delante, y deja la plana entera dentro
 * del cuadro sin que la cabeza se coma el borde.
 */
const POSE_SILLA = new Vector3(0, ALTURA_OJO, -0.62);
const MIRA_SILLA = new Vector3(0, ALTURA_OJO - 0.22, 0.6);
const POSE_LIBRO = new Vector3(-0.12, 1.2, -0.34);
const MIRA_LIBRO = new Vector3(-0.12, 0.78, 0.07);

/** Cuánto de lo que falta se recorre por segundo al inclinarse. */
const VELOCIDAD_INCLINARSE = 3.4;

/** Campo de visión sentado en la silla. */
const FOV_SILLA = 0.95;
/**
 * Campo de visión inclinado sobre el libro.
 *
 * ─── POR QUÉ TAMBIÉN SE ESTRECHA EL CAMPO ─────────────────────────────────
 *
 * Acercar la cámara no basta. Con el campo del puesto, desde 59 cm el libro
 * abierto ocupa poco más de la mitad del ancho de la pantalla, y con la
 * tarjeta de trabajo apoyada abajo le queda menos de media altura: el texto
 * de las páginas sale demasiado chico para leerse, que es exactamente lo que
 * el libro en la mesa venía a resolver.
 *
 * Con 0,62 la plana llena el encuadre casi de lado a lado. Y hay un motivo
 * más: al inclinarse sobre algo, la atención se estrecha de verdad. El campo
 * cerrado no es un truco para agrandar el papel, es lo que hace el cuerpo.
 */
const FOV_LIBRO = 0.62;

/**
 * Poder mirar el libro de cerca.
 *
 * La escritura del turno ocurre sobre el mesón, no en un panel flotando en el
 * aire: para leer lo escrito hay que acercarse, y para mirar el monitor hay
 * que volver a enderezarse. Es la misma economía de atención que el resto del
 * nivel —no se puede tener todo delante a la vez— pero contada con el cuerpo.
 */
export interface VistaPuesto {
  inclinarseAlLibro(): void;
  /**
   * Vuelve a la silla.
   *
   * `devolverControl` en falso deja la cámara enderezada pero SIN devolverle
   * el ratón al jugador. Hace falta para la llegada del supervisor: esa
   * secuencia toma la cámara para seguirle mientras cruza el hall, y si al
   * terminar de enderezarse se reenganchara el control, el jugador podría
   * girar en mitad de la escena peleando contra el giro asistido.
   */
  volverALaSilla(devolverControl?: boolean): void;
  /** Cuánto está inclinada la cámara sobre el libro: 0 sentada, 1 encima. */
  inclinacion(): number;
  /** Si ya está lo bastante cerca como para que la interfaz del libro aparezca. */
  sobreElLibro(): boolean;
  /** Quieta en la silla, sin inclinación en curso. */
  enLaSilla(): boolean;
}

/** Altura de la superficie del mesón. */
const ALTO_MESON = 0.76;

/** Cuánto puede girar la cabeza, en radianes. Ver la nota de la cámara. */
const GIRO_MAXIMO = 0.62;
const CABECEO_MAXIMO = 0.42;

export interface PuestoResult {
  /** Superficie del mesón. Sobre ella se apoyan libro, radio y tabla. */
  meson: Mesh;
  /** Pantalla del monitor. Las cámaras dibujan aquí. */
  pantalla: Mesh;
  /** Cuerpo de la radio. Parpadea cuando entra un mensaje. */
  radio: Mesh;
  /** Enciende o apaga el parpadeo del piloto de la radio. */
  avisarRadio: (encendido: boolean) => void;
  /** El flexo, que se enciende y se apaga con un clic sobre él. */
  flexo: Flexo;
  /** El cielo y la calle del ventanal, que siguen la hora del turno. */
  atmosfera: AtmosferaTurno;
  /** Las cuatro cámaras del circuito cerrado. */
  monitor: MonitorCamaras;
}

export function crearPuestoConserjeria(
  scene: Scene,
  usuario: string,
  onLibroCompletado?: () => void
): PuestoResult {
  configurarEscenaNocturna(scene);
  const { camara, vista } = montarCamara(scene);
  montarPostProceso(scene, camara);

  const monitor = crearMonitorCamaras(scene);
  // Las hojas del libro, que ahora muestran lo escrito de verdad.
  // La letra espera a que la cámara termine de inclinarse: escribir a mitad
  // del movimiento es escribir sin mirar.
  const paginas = crearPaginasLibro(scene, { listoParaTrazar: () => vista.inclinacion() > 0.9 });

  const meson = construirMeson(scene);
  const { pantalla } = construirMonitor(scene, monitor);
  montarZoomMonitor(scene, camara, vista);
  const { radio, avisarRadio } = construirRadio(scene);

  // La radio se atiende apretando la radio.
  //
  // El piloto encendido señala al aparato, así que el aparato tiene que
  // responder. Si la única forma de contestar fuera abrir el libro y buscar
  // una fila, el aviso estaría apuntando a un objeto que no hace nada — y
  // eso enseña a no fiarse de lo que el puesto indica, que es lo contrario
  // de lo que este nivel quiere enseñar.
  radio.actionManager = new ActionManager(scene);
  radio.actionManager.hoverCursor = "pointer";
  radio.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => libro?.atenderRadio())
  );

  // El libro se abre y se cierra las veces que haga falta: la sesión se crea
  // en el primer clic y desde ahí se reabre donde quedó. Sin esto el turno
  // sería un viaje de ida —abrir el libro y no poder volver al puesto—, y el
  // monitor no lo miraría nadie nunca.
  let libro: SesionLibro | null = null;
  // El supervisor se monta más abajo, cuando ya existe la puerta por la que
  // tiene que entrar. Para cuando alguien haga clic en el libro ya está.
  let supervisor: Supervisor | null = null;
  let residentes: Residentes | null = null;
  let atmosfera: AtmosferaTurno | null = null;

  // El clic va sobre la tapa Y sobre cada hoja, así que hay tres mallas que
  // pueden abrir el libro. Este cerrojo evita que dos avisos seguidos monten
  // dos sesiones, cada una con su apertura y su capa.
  let abriendo = false;

  construirLibro(scene, paginas, () => {
    if (libro) {
      libro.abrir();
      return;
    }
    if (abriendo) return;
    abriendo = true;

    libro = mostrarPantallaLibro(
      scene,
      () => onLibroCompletado?.(),
      {
        // Traducir de sucesos a cuadrantes es cosa de acá: el libro no sabe
        // que existe un monitor, y un escenario sin cámaras pasaría un enlace
        // vacío sin tocar una línea del libro.
        alOcurrir(suceso) {
          const toma = CAMARAS_POR_SUCESO[suceso.id];
          if (toma) monitor.encender(suceso.id, toma.indice, toma.escena, suceso.minuto, toma.rotulo);
        },
        alQuedarEscrita(suceso) {
          monitor.apagar(suceso.id);
        },
      },
      {
        llegaSupervisor(alPlantarse) {
          // Si por lo que sea no hay figura montada, el libro no se queda
          // colgado esperando a alguien que no va a entrar nunca: se muestran
          // los reparos igual. Una sala mal montada puede verse fea; no puede
          // dejar el turno sin poder terminarse.
          if (!supervisor) {
            alPlantarse();
            return;
          }
          supervisor.llegar(alPlantarse);
        },
        seRetiraSupervisor() {
          supervisor?.retirarse();
        },
        suenaRadio(activa) {
          // El piloto del equipo. Es el único aviso que se ve ESTANDO EN EL
          // PUESTO, con el libro cerrado: sin él, una llamada entrante solo
          // existiría dentro de un menú, y la radio volvería a ser atrezo.
          avisarRadio(activa);
        },
        alAvanzarMinuto(minuto) {
          residentes?.enMinuto(minuto);
          // Y el cielo del ventanal: la noche pasa a la misma hora que el libro.
          atmosfera?.enMinuto(minuto);
          // Las cámaras marcan la hora del turno, no una suya. Es el único
          // reloj que el jugador tiene a la vista estando en el puesto.
          monitor.ajustarHora(minuto);
        },
      },
      usuario,
      {
        // El libro no mueve la cámara ni dibuja papel: avisa qué está
        // pasando y el puesto decide cómo se ve. Un escenario sin mesón
        // pasaría un enlace vacío y el turno seguiría jugándose igual.
        seAbre() {
          vista.inclinarseAlLibro();
        },
        seCierra(devolverControl) {
          vista.volverALaSilla(devolverControl);
        },
        seEscribe(estado, aLaVista, alTerminar) {
          paginas.escribir(estado, aLaVista, alTerminar);
        },
      }
    );
  });
  construirTablaDeClaves(scene);
  construirDotacionDelPuesto(scene);
  construirSala(scene);
  const exterior = construirHallYVentanal(scene);
  const puerta = construirPuertaHall(scene);
  // Antes de las sombras y de los reflejos, para que la figura entre en las dos
  // listas: proyecta sombra sobre el piso y se refleja en él como todo lo demás.
  supervisor = montarSupervisor(scene, camara, puerta);
  const ascensor = construirAscensor(scene);
  residentes = montarResidentes(scene, puerta, ascensor);
  construirLuminarias(scene);
  const flexo = construirFlexo(scene);

  // La calle y el cielo, que siguen la hora. Van antes de las sombras y los
  // reflejos: sus planos se reconocen por el nombre para quedar fuera de los dos.
  const cielo = crearAtmosferaTurno(scene, {
    ...exterior,
    relleno: scene.getLightByName("luzRellenoNoche") as HemisphericLight | null,
  });
  atmosfera = cielo;

  montarSombras(scene, flexo.luz);

  // Los reflejos van los ÚLTIMOS: la sonda fotografía la sala y el espejo
  // guarda la lista de lo que refleja, así que todo tiene que existir ya.
  montarReflejos(scene);
  ampliarLucesPorMaterial(scene);

  // La cámara se engancha al final, cuando ya no se va a mover nada más.
  camara.attachControl(true);

  return { meson, pantalla, radio, avisarRadio, flexo, atmosfera: cielo, monitor };
}

/**
 * Sombras proyectadas por el flexo.
 *
 * ─── POR QUÉ SOLO EL FLEXO ────────────────────────────────────────────────
 *
 * Porque cada luz que proyecta sombra cuesta dibujar la escena otra vez desde
 * su posición, en cada cuadro. Con tres fuentes serían cuatro pasadas por
 * cuadro para ganar muy poco: el monitor da una luz difusa y frontal que
 * apenas produce sombra visible, y la farola queda al otro lado del ventanal.
 *
 * El flexo es el único que da una luz dura, lateral y cercana — la que de
 * verdad recorta la radio y el libro contra el mesón. Una sola sombra bien
 * puesta hace más que tres a medias.
 *
 * ─── QUÉ CAMBIA ───────────────────────────────────────────────────────────
 *
 * Que los objetos pasen de estar PEGADOS sobre el mesón a estar APOYADOS
 * encima. Es la diferencia entre una maqueta y un sitio.
 */
function montarSombras(scene: Scene, flexo: SpotLight): void {
  // 1024 alcanza de sobra: el foco cubre medio metro de mesón, así que ese
  // mapa reparte más de dos mil píxeles por metro. Subirlo no se notaría.
  const sombras = new ShadowGenerator(1024, flexo);

  // Filtro de contacto: da sombras muy nítidas junto al objeto que las produce
  // y difusas al alejarse, que es como se comporta la luz real. Con el filtro
  // simple, la sombra de la radio saldría igual de dura a diez centímetros que
  // a medio metro, y ese es el aspecto que delata a un motor 3D.
  sombras.useContactHardeningShadow = true;
  sombras.contactHardeningLightSizeUVRatio = 0.08;
  sombras.bias = 0.00012;
  sombras.normalBias = 0.008;
  sombras.darkness = 0.28;

  // QUIÉN RECIBE LA SOMBRA: SOLO EL MESÓN.
  //
  // Antes la recibía todo lo que se llamara "Hall" o "Muro", que es el hall
  // entero: paredes, jambas, piso, ascensor. Y la única luz que genera
  // sombras es este flexo, con 2,4 m de alcance apuntando al libro. El
  // ascensor está a cinco metros: nunca hubo sombra suya que recibir.
  //
  // Pero pedirla igual NO sale gratis, y ahí estaba el hormigueo de los
  // bordes. El filtro de contacto que se usa arriba rota su patrón de
  // muestreo con un ángulo sacado de un hash de la posición del píxel en el
  // espacio de la luz (ver shadowsFragmentFunctions: getRand sobre
  // vPositionFromLight). Un hash devuelve valores muy distintos ante
  // entradas muy parecidas — para eso sirve.
  //
  // En una superficie vista de canto, un píxel de movimiento de cámara
  // desplaza el punto del mundo una barbaridad. Así que el hash salta, el
  // ángulo cambia por completo, y con él el valor de la sombra. Fotograma a
  // fotograma eso es un rayado que hierve, y se ceba justo donde la
  // superficie está más en rasante y más lejos del foco: las jambas de los
  // huecos y la línea del suelo con la pared.
  //
  // Acotándolo al mesón, el filtro solo trabaja donde el mapa de sombras
  // tiene datos de verdad y la superficie se ve de frente. Que es, además,
  // el único sitio donde había algo que sombrear.
  scene.meshes.forEach((malla) => {
    const nombre = malla.name;
    if (nombre.includes("Meson")) {
      malla.receiveShadows = true;
      return;
    }

    // Explícito y no por omisión: los muros, el zócalo y el piso se marcan
    // como receptores al construirse, así que hay que apagarlo aquí.
    malla.receiveShadows = false;

    if (nombre.includes("Hall") || nombre.includes("Muro")) return;
    // La pantalla y el cristal no proyectan: son planos sin grosor y su sombra
    // saldría como una lámina negra flotando.
    // Los sitios del circuito cerrado están a dos kilómetros: nada que sombrear.
    if (nombre.includes("pantalla") || nombre.includes("cristal") || nombre.includes("calle") || nombre.startsWith("cctv")) return;
    // El propio flexo tampoco: la luz sale de dentro de su pantalla, y la
    // cabeza taparía el foco entero en su propio mapa de sombras.
    if (nombre.includes("Flexo")) return;
    sombras.addShadowCaster(malla);
  });
}

// ---------------------------------------------------------------------------
// Escena y cámara
// ---------------------------------------------------------------------------

/**
 * Deja la escena lista para una noche de interior.
 *
 * ─── POR QUÉ NO SE USA SceneManager ───────────────────────────────────────
 *
 * Porque está construido para el otro juego, y bien: monta una cámara orbital,
 * un sol direccional, luz entrando por las ventanas del galpón y niebla clara
 * de día. Todo eso es correcto para el 5S y todo eso sobra acá.
 *
 * Reutilizarlo obligaría a llenarlo de condicionales —"si es de noche no
 * pongas sol"— hasta que dejara de servirle bien a ninguno de los dos. Es más
 * limpio que cada juego arme el ambiente que necesita: comparten el motor y
 * las piezas, no la iluminación.
 *
 * Lo que sí se hereda es la escena ya creada, así que lo primero es retirar lo
 * que trae puesto.
 */
/**
 * Retira el post-proceso que este escenario haya dejado puesto.
 *
 * La escena la comparten los dos cursos y el menú, y estas tuberías se montan
 * sobre las cámaras de la escena: si no se quitan, siguen ahí después de
 * salir del turno.
 */
function retirarPostProceso(scene: Scene): void {
  ["postProcesoPuesto", "oclusionPuesto"].forEach((nombre) => {
    const tuberia = scene.postProcessRenderPipelineManager.supportedPipelines.find(
      (p) => p.name === nombre
    );
    if (!tuberia) return;
    scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
      nombre,
      scene.cameras
    );
    tuberia.dispose();
  });
}

function configurarEscenaNocturna(scene: Scene): void {
  // Fuera todo lo del escenario anterior.
  //
  // Antes aquí solo se soltaban luces y cámaras, y con eso bastaba mientras
  // el condominio fue el único escenario: se entraba desde el galpón del 5S,
  // que trae poco más que eso. Con tres escenarios compartiendo una sola
  // escena ya no vale — volver al condominio después del supermercado
  // dejaba dentro las góndolas.
  //
  // Se centraliza en limpiarEscena para que los tres hagan lo mismo: que
  // cada uno limpie a su manera es cómo se acaba teniendo un escenario que
  // quita las mallas pero no las tuberías, y otro que no quita nada.
  limpiarEscena(scene);
  scene.fogMode = Scene.FOGMODE_NONE;

  // Azul muy oscuro, no negro. Solo se ve por el ventanal, pero es el color
  // contra el que se recorta el edificio de enfrente.
  scene.clearColor = new Color4(0.016, 0.019, 0.028, 1);

  // Relleno mínimo y frío.
  //
  // Baja respecto a cuando la sala estaba a oscuras: entonces era lo único que
  // daba volumen a lo que las tres lámparas no alcanzaban. Ahora el techo
  // ilumina el hall entero y este relleno solo tiene que evitar que los
  // rincones se cierren del todo. Dejarlo alto aplanaría los reflejos del
  // piso, que es lo que ahora hace el trabajo.
  // Sube de 0,07 a 0,16 y se entibia. A 0,07 los rincones no es que
  // quedaran oscuros: quedaban NEGROS, sin información ninguna, y un negro
  // plano no se lee como penumbra sino como un agujero. Con algo de rebote
  // los muros conservan su forma en las zonas donde el techo no llega, que
  // es exactamente lo que hace la luz indirecta en un sitio real.
  //
  // El groundColor sigue siendo frío a propósito: lo que rebota del piso de
  // porcelanato es la luz de la calle, no la de las luminarias.
  const relleno = new HemisphericLight("luzRellenoNoche", new Vector3(0, 1, 0), scene);
  // 0,20. El rebote sube otro poco para que las zonas donde no llega ninguna
  // luminaria conserven su forma, que es lo que hace falta para que en un
  // vídeo se distinga qué hay ahí.
  relleno.intensity = 0.26;
  relleno.diffuse = new Color3(0.56, 0.56, 0.62);
  relleno.groundColor = new Color3(0.1, 0.11, 0.16);
}

/**
 * Tone mapping, bloom, grano, viñeta, FXAA y oclusión ambiental.
 *
 * ─── POR QUÉ VA APARTE Y DESPUÉS DE LA CÁMARA ─────────────────────────────
 *
 * Estaba dentro de configurarEscenaNocturna y se enganchaba a la cámara
 * activa de ese momento — que es la NEUTRA que deja limpiarEscena. Dos líneas
 * más abajo montarCamara activa la del puesto y usarCamara retira la neutra.
 * Resultado: las dos tuberías quedaban colgadas de una cámara destruida y el
 * turno entero se dibujaba SIN post-proceso. Sin mapeo de tonos, sin bloom,
 * sin oclusión: todo lo que se había calibrado aquí no llegaba a pantalla, y
 * es buena parte de por qué la escena se veía plana.
 *
 * Se comprobó leyendo las tuberías en ejecución: "postProcesoPuesto" y
 * "oclusionPuesto" apuntaban a [camaraNeutra]. Ahora se montan con la cámara
 * del puesto ya creada.
 */
function montarPostProceso(scene: Scene, camara: FreeCamera): void {
  // Postproceso.
  //
  // El grano y la viñeta siguen valiendo —es de noche— pero bajan los dos. Con
  // la sala iluminada, el grano de antes se veía como suciedad sobre una
  // superficie clara en vez de como ruido de sensor, y la viñeta cerraba tanto
  // que se comía los muros laterales justo ahora que existen.
  // Fuera cualquier tubería de un turno anterior.
  //
  // Entrar al escenario, volver al menú y entrar otra vez montaba una
  // segunda tubería encima de la primera: grano sobre grano, viñeta sobre
  // viñeta y una oclusión ambiental de más, cada una con su buffer. La
  // imagen se ensuciaba un poco más en cada vuelta y parecía que había
  // bajado la resolución. Como llevan nombre propio, se pueden buscar y
  // retirar antes de montar las nuevas.
  retirarPostProceso(scene);

  // Se engancha a la cámara del puesto, recibida ya creada. Ver la nota de la
  // función: engancharlo a la activa del momento lo dejaba en la neutra.
  const tuberia = new DefaultRenderingPipeline("postProcesoPuesto", true, scene, [camara]);
  // MSAA de la tarjeta. Se deja puesto, pero NO basta acá: ver justo abajo.
  tuberia.samples = 4;

  // ─── ANTIALIASING DE PANTALLA ────────────────────────────────────────
  //
  // Esto es lo que quita el hormigueo de los bordes al girar la cámara.
  //
  // El multimuestreo de arriba suaviza los bordes cuando la escena se
  // dibuja directamente sobre el lienzo. Pero acá no se dibuja así: con la
  // oclusión ambiental enganchada a la misma cámara, la imagen pasa por
  // objetivos de render intermedios que no llevan multimuestreo, y el
  // suavizado se pierde por el camino. El resultado es que las aristas
  // quedan en escalones de píxel.
  //
  // Quieto no se nota casi. Girando sí, y muchísimo: los escalones saltan
  // de un píxel al de al lado en cada fotograma, y eso se ve como una línea
  // que hormiguea. Se ceba justo donde hay más contraste —la puerta casi
  // negra contra el muro claro, el zócalo oscuro entre la pared y el suelo—
  // que son exactamente las líneas donde aparece.
  //
  // FXAA trabaja sobre la imagen ya terminada, al final de toda la cadena,
  // así que da igual por cuántos objetivos intermedios haya pasado antes.
  //
  // El 5S lo tiene apagado y allí está bien: su escena es un galpón de día,
  // sin contrastes extremos, y el multimuestreo le alcanza. Un puesto de
  // noche es el caso contrario — casi todo el cuadro es una arista entre
  // algo iluminado y algo negro.
  tuberia.fxaaEnabled = true;

  tuberia.bloomEnabled = true;
  // Umbral alto: florecen las luminarias, la pantalla y los pilotos, no el
  // techo ni el mesón.
  tuberia.bloomThreshold = 0.85;
  tuberia.bloomWeight = 0.3;
  tuberia.bloomKernel = 46;

  tuberia.grainEnabled = true;
  // Baja de 3,5: el grano estaba calibrado para una sala a oscuras. Sobre
  // superficies claras y bien iluminadas deja de leerse como ruido de sensor
  // y empieza a leerse como suciedad en la pantalla.
  tuberia.grain.intensity = 1.1;

  // Y SIN ANIMAR, que era de donde venía el hormigueo de las paredes.
  //
  // Animado, el grano se resiembra entero en cada fotograma. Sobre una
  // superficie grande, plana y en penumbra —la esquina de un muro, el
  // encuentro del suelo con la pared— no hay ningún detalle que lo
  // disimule, así que es lo único que se mueve en esa parte del cuadro.
  //
  // Y se nota sobre todo AL GIRAR, que es lo que despistaba del origen: la
  // vista sigue la pared mientras el grano se queda clavado a la pantalla,
  // y esa diferencia entre lo que se mueve y lo que no es justo lo que el
  // ojo caza. Quieto pasa desapercibido; girando parece que la pared
  // parpadea.
  //
  // Fijo conserva lo que el grano aporta —quitarle a la imagen ese acabado
  // demasiado limpio de render— sin nada que hormiguee.
  tuberia.grain.animated = false;

  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.vignetteEnabled = true;
  // Y la viñeta afloja: a 1,5 se comía los muros laterales y el hueco del
  // ascensor, que son justo las paredes que dan sensación de sala.
  // Y la viñeta afloja otro poco, hasta 0,75: es la que se comía las esquinas
  // del cuadro, y en una grabación las esquinas son donde está el hall.
  tuberia.imageProcessing.vignetteWeight = 0.75;
  tuberia.imageProcessing.vignetteColor = new Color4(0, 0, 0.02, 1);
  tuberia.imageProcessing.contrast = 1.12;
  // Sube un punto: no aclara los negros —eso mataría la noche— sino que abre
  // el rango medio, que es donde vive el detalle nuevo de muros y suelo.
  tuberia.imageProcessing.exposure = 1.05;
  tuberia.imageProcessing.toneMappingEnabled = true;

  // OCLUSIÓN AMBIENTAL
  //
  // Oscurece los rincones donde dos superficies se juntan: el pie del monitor
  // contra el mesón, el canto del libro contra la tapa, la unión del frente con
  // la mesa. En la realidad esos huecos reciben menos luz rebotada, y el motor
  // no lo sabe: sin esto, cada objeto termina en un borde limpio contra el
  // suelo y todo parece pegado con recorte.
  //
  // Es lo que más aporta en una escena cerrada y vista de cerca como esta, y
  // por eso vale su coste — aquí no hay un galpón entero que procesar, solo un
  // mesón.
  // ssaoRatio a 1, y esa es la corrección importante.
  //
  // Estaba en 0,75: la oclusión se calculaba a tres cuartos de resolución y
  // después se estiraba hasta el tamaño del cuadro. Como el patrón de
  // muestreo no cae en los mismos píxeles de un fotograma al siguiente, al
  // girar la cámara el sombreado REPTABA por las aristas — y las aristas es
  // justo donde la oclusión trabaja, así que el efecto se concentraba en las
  // líneas del encuentro entre muros y en la del suelo con la pared. Se veía
  // como un parpadeo en las juntas.
  //
  // Calculada a resolución completa no hay estirado y no hay reptado. Cuesta
  // más, pero es una sala fija con la cámara en una silla: no hay presupuesto
  // de dibujo que defender aquí.
  const oclusion = new SSAO2RenderingPipeline("oclusionPuesto", scene, {
    ssaoRatio: 1,
    blurRatio: 1,
  });
  // Radio algo más corto y fuerza algo menor: con la sala más iluminada, una
  // oclusión larga y fuerte deja de leerse como sombra de rincón y empieza a
  // leerse como suciedad en las esquinas.
  oclusion.radius = 0.45;
  oclusion.totalStrength = 0.95;
  // Alcance corto: interesa el rincón de dos centímetros, no oscurecer la sala.
  oclusion.maxZ = 6;
  oclusion.samples = 16;
  oclusion.expensiveBlur = true;
  scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("oclusionPuesto", [camara]);
}

/**
 * Cámara fija en la silla, con giro limitado.
 *
 * ─── POR QUÉ FIJA Y NO LIBRE ──────────────────────────────────────────────
 *
 * Un guardia de puesto no camina: está sentado frente al mesón ocho horas, y
 * ese encierro es parte de lo que el nivel cuenta. Dejarlo caminar convertiría
 * el turno en un paseo y obligaría a modelar el edificio entero.
 *
 * ─── PERO TAMPOCO INMÓVIL ─────────────────────────────────────────────────
 *
 * Puede girar la cabeza unos 35 grados a cada lado y mirar algo arriba y
 * abajo. Con eso alcanza para tener que ELEGIR dónde mirar: el monitor y el
 * libro no caben cómodos en el mismo encuadre, así que atender la radio
 * mientras se escribe cuesta, igual que en el puesto real.
 *
 * Una cámara completamente inmóvil lo daría todo servido en un solo cuadro y
 * el turno dejaría de tener atención que administrar.
 */
function montarCamara(scene: Scene): { camara: FreeCamera; vista: VistaPuesto } {
  const camara = new FreeCamera("camaraPuesto", POSE_SILLA.clone(), scene);
  // Se activa a mano y se retira la neutra que dejó la limpieza. Antes esto no
  // hacía falta porque era la primera cámara de la escena y Babylon la activaba
  // sola; ya no lo es.
  usarCamara(scene, camara);
  camara.setTarget(MIRA_SILLA.clone());

  camara.minZ = 0.05;
  camara.fov = 0.95;

  // Sin teclas de desplazamiento: la silla no se mueve.
  camara.keysUp = [];
  camara.keysDown = [];
  camara.keysLeft = [];
  camara.keysRight = [];
  camara.inputs.removeByType("FreeCameraKeyboardMoveInput");

  camara.angularSensibility = 2600;

  const giroBase = camara.rotation.y;
  const cabeceoBase = camara.rotation.x;

  // --- Inclinarse sobre el libro -------------------------------------------
  //
  // `destino` es a dónde se quiere estar (0 sentado, 1 sobre el libro) y
  // `avance` dónde se está de verdad. La distancia entre los dos es lo que se
  // recorre cada cuadro, así que un cambio de idea a mitad de camino no da un
  // salto: la cámara se da la vuelta desde donde iba.
  let destino = 0;
  let avance = 0;
  let controlSuelto = false;
  let devolverControl = true;

  const posicionViva = new Vector3();
  const miraViva = new Vector3();

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    avance += (destino - avance) * Math.min(1, dt * VELOCIDAD_INCLINARSE);
    if (Math.abs(destino - avance) < 0.0015) avance = destino;

    if (avance <= 0) {
      // Sentado. Manda el jugador, con los topes de giro de siempre.
      if (controlSuelto && devolverControl) {
        camara.attachControl(true);
        controlSuelto = false;
      }
      // Con el control cedido a una secuencia, la posición se fija igual
      // pero el giro lo lleva ella: tocarlo aquí sería quitárselo.
      if (controlSuelto) {
        camara.position.copyFrom(POSE_SILLA);
        return;
      }
      camara.rotation.y = Math.min(
        giroBase + GIRO_MAXIMO,
        Math.max(giroBase - GIRO_MAXIMO, camara.rotation.y)
      );
      camara.rotation.x = Math.min(
        cabeceoBase + CABECEO_MAXIMO,
        Math.max(cabeceoBase - CABECEO_MAXIMO, camara.rotation.x)
      );
      camara.position.copyFrom(POSE_SILLA);
      return;
    }

    // Inclinándose o ya inclinado: manda la animación. Se suelta el control
    // del ratón porque si no el jugador pelea contra la interpolación y la
    // cámara tiembla entre las dos.
    if (!controlSuelto) {
      camara.detachControl();
      controlSuelto = true;
    }

    const k = suavizarInclinacion(avance);
    Vector3.LerpToRef(POSE_SILLA, POSE_LIBRO, k, posicionViva);
    Vector3.LerpToRef(MIRA_SILLA, MIRA_LIBRO, k, miraViva);
    camara.position.copyFrom(posicionViva);
    camara.setTarget(miraViva);
    camara.fov = FOV_SILLA + (FOV_LIBRO - FOV_SILLA) * k;
  });

  return {
    camara,
    vista: {
      inclinarseAlLibro() {
        destino = 1;
        devolverControl = true;
      },
      volverALaSilla(devolver = true) {
        destino = 0;
        devolverControl = devolver;
      },
      inclinacion: () => avance,
      sobreElLibro: () => avance > 0.5,
      // La rueda solo manda con la cámara quieta en la silla. Durante el
      // recorrido y sobre el libro el campo lo lleva la inclinación, y si los
      // dos escribieran en él cada cuadro se pelearían y la imagen temblaría.
      enLaSilla: () => avance <= 0,
    },
  };
}

/**
 * Suavizado de la inclinación.
 *
 * Arranca y frena despacio, y de paso corrige un detalle que se nota mucho:
 * con interpolación recta el tramo final —el que se ve de cerca, con el libro
 * llenando el cuadro— es el que más rápido pasa. Así el movimiento se asienta
 * sobre el papel en vez de clavarse.
 */
function suavizarInclinacion(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}


// ---------------------------------------------------------------------------
// La dotación del puesto
// ---------------------------------------------------------------------------
//
// Una conserjería no es un mesón en una sala vacía: es un sitio de trabajo con
// sus cosas. El tablero de llaves, los casilleros del correo, el extintor con
// su señalética, la papelera, el calendario. Sin eso, el hall se lee como una
// maqueta de arquitecto y no como un lugar donde alguien pasa ocho horas.
//
// ─── LO QUE HACE QUE UN OBJETO NO PAREZCA DE PLÁSTICO ─────────────────────
//
// Cuatro cosas, y ninguna es "más polígonos":
//
//  1. VARIOS MATERIALES POR OBJETO. Un extintor no es un bloque rojo: es
//     chapa pintada, una válvula de latón, una maneta cromada, una manguera de
//     goma y una etiqueta de papel. Cada una devuelve la luz de forma distinta,
//     y ESO es lo que el ojo lee como "cosa real" frente a "cosa de juguete".
//
//  2. NADA PERFECTAMENTE LISO NI PERFECTAMENTE MATE. Un valor de rugosidad
//     redondo y repetido en todo delata el render. Aquí cada pieza lleva el
//     suyo: 0,3 en el cromo, 0,45 en la chapa esmaltada, 0,9 en el cartón.
//
//  3. PIEZAS REDONDAS DONDE LAS HAY. El cuerpo de un extintor es un cilindro
//     con casquete, no una caja. Una caja con esquinas vivas siempre se ve
//     como una caja, por muy bien pintada que esté.
//
//  4. NADA ALINEADO DEL TODO. Los llaveros cuelgan cada uno con su ángulo y
//     el calendario va un poco torcido. La simetría perfecta es de render; una
//     conserjería de verdad la deshace en una semana.

/** Cuelga una pieza de la pared, orientada hacia dentro de la sala. */
function enPared(malla: Mesh | TransformNode, lado: -1 | 1): void {
  // Las paredes laterales miran al eje X, así que todo lo que se cuelga en
  // ellas gira un cuarto de vuelta. El signo decide cuál de las dos.
  malla.rotation.y = (lado * Math.PI) / 2;
}

/**
 * Tablero de llaves.
 *
 * El mueble con el que se reconoce una conserjería antes que por ninguna otra
 * cosa. Panel con la cuadrícula de ganchos, cada uno con su llave y su etiqueta
 * numerada, y una placa grabada arriba.
 *
 * ─── QUÉ HACE QUE SE LEA COMO UN TABLERO Y NO COMO UN CARTEL ──────────────
 *
 * A cuatro metros no se distingue el dentado de una llave, así que lo que
 * identifica el mueble no es el detalle: es el PATRÓN. Tres filas de seis
 * etiquetas numeradas, con algo colgando de cada una y unos huecos donde falta.
 * Eso se reconoce de un vistazo aunque no se vea ninguna llave entera.
 *
 * Por eso los números van impresos en el panel —grandes, sobre recuadro claro—
 * y no confiados a las etiquetas que cuelgan, que a esta distancia son cuatro
 * píxeles.
 */
function construirTableroDeLlaves(scene: Scene): void {
  const X = -ANCHO_SALA / 2 + 0.07;
  // Más cerca y más grande.
  //
  // Estaba a 2,55 de profundidad y medía 95 × 75. Desde la silla eso cae en el
  // borde del giro máximo y ocupa poco más de un dedo de pantalla: aunque esté
  // bien modelado, a ese tamaño no se distingue qué mueble es.
  //
  // Adelantándolo a 2,1 y subiéndolo a 1,15 × 0,9 se mira de frente y con
  // tamaño suficiente para leer los números, que es lo que lo identifica.
  const Z = 2.1;
  const Y = 1.5;
  const ANCHO = 1.15;
  const ALTO = 0.9;
  const FONDO = 0.11;

  const raiz = new TransformNode("tableroLlaves", scene);
  raiz.position.set(X, Y, Z);
  enPared(raiz, 1);

  // Aluminio del armazón. Rugosidad baja y metalicidad alta: un perfil de
  // aluminio devuelve la luz del foco y es lo que dibuja el contorno del mueble
  // contra el muro.
  const matPerfilLlaves = new PBRMaterial("matPerfilLlaves", scene);
  matPerfilLlaves.albedoColor = new Color3(0.62, 0.63, 0.65);
  matPerfilLlaves.roughness = 0.34;
  matPerfilLlaves.metallic = 0.82;

  // --- Panel de fondo -------------------------------------------------------
  //
  // Va como plano y no como caja: de una caja se ve la cara de atrás, y ahí el
  // rótulo sale escrito al revés. Y aun de frente, la textura de un plano se
  // muestra espejada según hacia dónde mire, así que se corrige con orientar
  // —el mismo ayudante que usan la pantalla del monitor y las hojas del libro.
  const respaldo = MeshBuilder.CreatePlane(
    "tableroLlavesRespaldo",
    { width: ANCHO - 0.05, height: ALTO - 0.05 },
    scene
  );
  respaldo.position.z = FONDO / 2 - 0.014;
  respaldo.material = orientar(
    materialPintadoNitido(scene, "matFondoLlaves", 460, 360, 2.5, (ctx, w, h) => {
      // Melamina clara con su veta suave.
      const base = ctx.createLinearGradient(0, 0, 0, h);
      // Melamina clara de verdad. Un panel a media luz devuelve poco, y lo que
      // hace legible el conjunto es el contraste entre el fondo claro y las
      // llaves oscuras colgando delante.
      base.addColorStop(0, "#e8e1cf");
      base.addColorStop(1, "#d8d0bb");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(120, 108, 84, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + (Math.random() - 0.5) * 6);
        ctx.stroke();
      }

      // Roces y marcas de uso, concentrados bajo cada gancho: es donde la llave
      // golpea el panel al colgarla.
      ctx.fillStyle = "rgba(105, 92, 66, 0.09)";
      for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 13, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rayas de separación entre filas.
      ctx.strokeStyle = "rgba(80, 72, 54, 0.3)";
      ctx.lineWidth = 1.5;
      for (let fila = 1; fila < 3; fila++) {
        ctx.beginPath();
        ctx.moveTo(26, 74 + fila * 96);
        ctx.lineTo(w - 26, 74 + fila * 96);
        ctx.stroke();
      }

      // Los números, en recuadro claro. Esto es lo que identifica el mueble a
      // distancia, así que van grandes y con contraste alto.
      for (let fila = 0; fila < 3; fila++) {
        for (let col = 0; col < 6; col++) {
          // Etiquetas más grandes y con más contraste: blanco casi puro con
          // borde oscuro. Son lo único que a cuatro metros dice qué es este
          // mueble, así que se dibujan para leerse de lejos, no para quedar
          // bonitas de cerca.
          const x = 56 + col * 72;
          const y = 118 + fila * 98;
          ctx.fillStyle = "rgba(253, 252, 248, 0.96)";
          ctx.fillRect(x - 31, y, 62, 30);
          ctx.strokeStyle = "rgba(60, 54, 40, 0.7)";
          ctx.lineWidth = 1.6;
          ctx.strokeRect(x - 31, y, 62, 30);
          ctx.fillStyle = "#1d1d18";
          ctx.font = "bold 22px monospace";
          ctx.textAlign = "center";
          ctx.fillText(String(101 + fila * 6 + col), x, y + 23);
        }
      }
    }),
    { horizontal: -1, vertical: 1 }
  );
  respaldo.parent = raiz;

  // --- Armazón --------------------------------------------------------------
  [
    { n: "sup", w: ANCHO, h: 0.026, x: 0, y: ALTO / 2 - 0.013 },
    { n: "inf", w: ANCHO, h: 0.026, x: 0, y: -ALTO / 2 + 0.013 },
    { n: "izq", w: 0.026, h: ALTO, x: -ANCHO / 2 + 0.013, y: 0 },
    { n: "der", w: 0.026, h: ALTO, x: ANCHO / 2 - 0.013, y: 0 },
  ].forEach((p) => {
    const m = MeshBuilder.CreateBox(
      `tableroLlavesCostero_${p.n}`,
      { width: p.w, height: p.h, depth: FONDO },
      scene
    );
    m.position.set(p.x, p.y, 0);
    m.material = matPerfilLlaves;
    m.parent = raiz;
  });

  // Placa grabada del rótulo, atornillada al costero superior. Va como pieza
  // aparte y no pintada en el panel: una placa tiene canto y brillo propio, y
  // eso es lo que la hace leer como metal y no como una pegatina.
  const placa = MeshBuilder.CreatePlane(
    "tableroLlavesPlaca",
    { width: ANCHO * 0.72, height: 0.075 },
    scene
  );
  placa.position.set(0, ALTO / 2 + 0.055, FONDO / 2 - 0.03);
  placa.material = orientar(
    materialPintadoNitido(scene, "matPlacaLlaves", 340, 36, 3, (ctx, w, h) => {
      const al = ctx.createLinearGradient(0, 0, 0, h);
      al.addColorStop(0, "#9aa0a6");
      al.addColorStop(0.5, "#c2c7cc");
      al.addColorStop(1, "#8d9399");
      ctx.fillStyle = al;
      ctx.fillRect(0, 0, w, h);
      // Cepillado del aluminio.
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 70; i++) {
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Texto grabado: sombra clara debajo y letra oscura encima.
      ctx.textAlign = "center";
      ctx.font = "bold 19px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("LLAVES · DEPARTAMENTOS", w / 2, h / 2 + 8);
      ctx.fillStyle = "#26262a";
      ctx.fillText("LLAVES · DEPARTAMENTOS", w / 2, h / 2 + 7);
    }),
    { horizontal: -1, vertical: 1 }
  );
  placa.parent = raiz;

  // --- Ganchos y llaveros ---------------------------------------------------
  const matGancho = new PBRMaterial("matGanchoLlaves", scene);
  matGancho.albedoColor = new Color3(0.68, 0.69, 0.71);
  matGancho.roughness = 0.28;
  matGancho.metallic = 0.93;

  const matLlave = new PBRMaterial("matLlaveLlaves", scene);
  matLlave.albedoColor = new Color3(0.72, 0.63, 0.4);
  matLlave.roughness = 0.33;
  matLlave.metallic = 0.88;

  const matEtiqueta = new PBRMaterial("matEtiquetaLlaves", scene);
  matEtiqueta.albedoColor = new Color3(0.86, 0.83, 0.72);
  matEtiqueta.roughness = 0.92;
  matEtiqueta.metallic = 0;

  for (let fila = 0; fila < 3; fila++) {
    for (let col = 0; col < 6; col++) {
      const px = -ANCHO / 2 + 0.135 + col * 0.177;
      const py = ALTO / 2 - 0.17 - fila * 0.235;

      // Gancho en ele: poste y punta. El poste solo se ve como un palito; la
      // punta hacia arriba es lo que lo convierte en un gancho.
      const poste = MeshBuilder.CreateCylinder(
        `llavesPoste_${fila}_${col}`,
        { diameter: 0.007, height: 0.032, tessellation: 8 },
        scene
      );
      poste.rotation.x = Math.PI / 2;
      poste.position.set(px, py, FONDO / 2 - 0.032);
      poste.material = matGancho;
      poste.parent = raiz;

      const punta = MeshBuilder.CreateCylinder(
        `llavesPunta_${fila}_${col}`,
        { diameter: 0.007, height: 0.016, tessellation: 8 },
        scene
      );
      punta.position.set(px, py + 0.007, FONDO / 2 - 0.05);
      punta.material = matGancho;
      punta.parent = raiz;

      // Una de cada siete está fuera: hay vecinos con su llave arriba. Un
      // tablero completo se ve como un patrón impreso, no como un mueble en uso.
      if ((fila * 6 + col) % 7 === 3) continue;

      const ladeo = (((fila * 7 + col * 3) % 5) - 2) * 0.09;
      const juego = new TransformNode(`llavesJuego_${fila}_${col}`, scene);
      juego.position.set(px, py, FONDO / 2 - 0.056);
      juego.rotation.z = ladeo;
      juego.parent = raiz;

      const anilla = MeshBuilder.CreateTorus(
        `llavesAnilla_${fila}_${col}`,
        { diameter: 0.03, thickness: 0.0045, tessellation: 12 },
        scene
      );
      anilla.rotation.x = Math.PI / 2;
      anilla.position.y = -0.022;
      anilla.material = matGancho;
      anilla.parent = juego;

      // Llave con paletón y dentado. Tres cajitas de un milímetro que a esta
      // distancia no se distinguen una a una, pero que juntas dan la silueta
      // irregular que el ojo reconoce como llave y no como palito.
      const paleton = MeshBuilder.CreateCylinder(
        `llavesPaleton_${fila}_${col}`,
        { diameter: 0.019, height: 0.003, tessellation: 12 },
        scene
      );
      paleton.rotation.x = Math.PI / 2;
      paleton.position.y = -0.042;
      paleton.material = matLlave;
      paleton.parent = juego;

      const caña = MeshBuilder.CreateBox(
        `llavesCana_${fila}_${col}`,
        { width: 0.0075, height: 0.048, depth: 0.0025 },
        scene
      );
      caña.position.y = -0.072;
      caña.material = matLlave;
      caña.parent = juego;

      [0.0, 0.012, 0.024].forEach((dy, i) => {
        const diente = MeshBuilder.CreateBox(
          `llavesDiente_${fila}_${col}_${i}`,
          { width: 0.005, height: 0.006, depth: 0.0025 },
          scene
        );
        diente.position.set(0.006, -0.086 + dy, 0);
        diente.material = matLlave;
        diente.parent = juego;
      });

      const etiqueta = MeshBuilder.CreateBox(
        `llavesEtiqueta_${fila}_${col}`,
        { width: 0.03, height: 0.042, depth: 0.002 },
        scene
      );
      etiqueta.position.set(0.026, -0.056, 0.004);
      etiqueta.rotation.z = ladeo * 0.5;
      etiqueta.material = matEtiqueta;
      etiqueta.parent = juego;
    }
  }
}

/**
 * Extintor con su señalética.
 *
 * El manual lo nombra en varios sitios —altura de instalación, estado de la
 * aguja, métodos de extinción— y el cuestionario pregunta por él. Que esté a
 * la vista en el puesto no es solo ambientación: es material del curso.
 *
 * Se construye por piezas porque un extintor tiene cinco materiales distintos
 * y ahí está la diferencia entre un objeto y un bloque rojo.
 */
function construirExtintor(scene: Scene): void {
  const X = ANCHO_SALA / 2 - 0.12;
  const Z = 2.3;
  // El manual pregunta a qué altura se instala: la maneta sobre 1,20 del suelo.
  const Y_BASE = 0.78;

  const raiz = new TransformNode("extintorHall", scene);
  raiz.position.set(X, Y_BASE, Z);
  enPared(raiz, -1);

  // Chapa esmaltada roja. Rugosidad baja y algo de metal: el esmalte de un
  // extintor tiene brillo, no es mate como una pared.
  const matCuerpo = new PBRMaterial("matExtintorCuerpo", scene);
  matCuerpo.albedoColor = new Color3(0.44, 0.04, 0.03);
  matCuerpo.roughness = 0.32;
  matCuerpo.metallic = 0.45;

  const matNegro = new PBRMaterial("matExtintorNegro", scene);
  matNegro.albedoColor = new Color3(0.035, 0.035, 0.04);
  matNegro.roughness = 0.68;
  matNegro.metallic = 0.15;

  const matCromo = new PBRMaterial("matExtintorCromo", scene);
  matCromo.albedoColor = new Color3(0.72, 0.72, 0.74);
  matCromo.roughness = 0.18;
  matCromo.metallic = 0.95;

  const matLaton = new PBRMaterial("matExtintorLaton", scene);
  matLaton.albedoColor = new Color3(0.62, 0.5, 0.22);
  matLaton.roughness = 0.34;
  matLaton.metallic = 0.9;

  // Botella: cilindro con casquete esférico arriba. Un cilindro a secas acaba
  // en un canto plano que se ve falso al instante.
  const botella = MeshBuilder.CreateCylinder(
    "extintorBotella",
    { diameter: 0.15, height: 0.42, tessellation: 24 },
    scene
  );
  botella.position.y = 0.21;
  botella.material = matCuerpo;
  botella.parent = raiz;

  const casquete = MeshBuilder.CreateSphere(
    "extintorCasquete",
    { diameter: 0.15, segments: 16 },
    scene
  );
  casquete.scaling.y = 0.55;
  casquete.position.y = 0.42;
  casquete.material = matCuerpo;
  casquete.parent = raiz;

  const base = MeshBuilder.CreateCylinder(
    "extintorBase",
    { diameter: 0.155, height: 0.025, tessellation: 24 },
    scene
  );
  base.position.y = 0.012;
  base.material = matNegro;
  base.parent = raiz;

  // Cuello, válvula de latón y maneta cromada.
  const cuello = MeshBuilder.CreateCylinder(
    "extintorCuello",
    { diameter: 0.045, height: 0.06, tessellation: 14 },
    scene
  );
  cuello.position.y = 0.47;
  cuello.material = matLaton;
  cuello.parent = raiz;

  const maneta = MeshBuilder.CreateBox(
    "extintorManeta",
    { width: 0.075, height: 0.014, depth: 0.03 },
    scene
  );
  maneta.position.set(0, 0.505, -0.012);
  maneta.rotation.z = 0.06;
  maneta.material = matCromo;
  maneta.parent = raiz;

  // Manómetro: la esfera que el manual pregunta en qué posición debe estar.
  const manometro = MeshBuilder.CreateCylinder(
    "extintorManometro",
    { diameter: 0.036, height: 0.016, tessellation: 16 },
    scene
  );
  manometro.rotation.x = Math.PI / 2;
  manometro.position.set(0.032, 0.472, -0.026);
  manometro.material = materialPintado(scene, "matManometro", 96, 96, (ctx, w, h) => {
    ctx.fillStyle = "#e8e6de";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    // Zona verde de presión correcta, entre dos rojas.
    ctx.lineWidth = 13;
    ctx.strokeStyle = "#2e8b45";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 14, Math.PI * 1.28, Math.PI * 1.72);
    ctx.stroke();
    ctx.strokeStyle = "#a82b20";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 14, Math.PI * 0.9, Math.PI * 1.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 14, Math.PI * 1.72, Math.PI * 2.1);
    ctx.stroke();
    // Aguja en verde: en servicio.
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 + 22 * Math.cos(Math.PI * 1.5), h / 2 + 22 * Math.sin(Math.PI * 1.5));
    ctx.stroke();
  });
  manometro.parent = raiz;

  // Pasador de seguridad y su precinto: dos piezas de un centímetro que nadie
  // mira y sin las cuales el extintor parece de atrezo.
  const pasador = MeshBuilder.CreateTorus(
    "extintorPasador",
    { diameter: 0.03, thickness: 0.004, tessellation: 12 },
    scene
  );
  pasador.rotation.y = Math.PI / 2;
  pasador.position.set(-0.042, 0.5, -0.005);
  pasador.material = matCromo;
  pasador.parent = raiz;

  // Manguera: tubo de goma bajando por el costado hasta la boquilla.
  const manguera = MeshBuilder.CreateCylinder(
    "extintorManguera",
    { diameter: 0.018, height: 0.26, tessellation: 10 },
    scene
  );
  manguera.rotation.z = -0.22;
  manguera.position.set(0.072, 0.34, -0.03);
  manguera.material = matNegro;
  manguera.parent = raiz;

  const boquilla = MeshBuilder.CreateCylinder(
    "extintorBoquilla",
    { diameterTop: 0.034, diameterBottom: 0.02, height: 0.07, tessellation: 12 },
    scene
  );
  boquilla.rotation.z = -0.3;
  boquilla.position.set(0.104, 0.2, -0.032);
  boquilla.material = matNegro;
  boquilla.parent = raiz;

  // Etiqueta. Un extintor sin etiqueta es un bombona roja.
  const etiqueta = MeshBuilder.CreateCylinder(
    "extintorEtiqueta",
    { diameter: 0.152, height: 0.17, tessellation: 24 },
    scene
  );
  etiqueta.position.y = 0.23;
  etiqueta.material = materialPintadoNitido(
    scene,
    "matEtiquetaExtintor",
    300,
    170,
    2,
    (ctx, w, h) => {
      ctx.fillStyle = "#c9c4b6";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#8f1a12";
      ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = "#f2efe6";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("POLVO QUÍMICO SECO", w / 2, 25);
      ctx.fillStyle = "#22221e";
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.fillText("ABC", w / 2, 82);
      ctx.font = "15px system-ui, sans-serif";
      ctx.fillText("6 kg  ·  EXTINTOR PORTÁTIL", w / 2, 112);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("REVISIÓN: 03 / 2026", w / 2, 140);
      ctx.strokeStyle = "#22221e";
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 40, w - 12, h - 48);
    }
  );
  etiqueta.parent = raiz;

  // Soporte de pared.
  const soporte = MeshBuilder.CreateBox(
    "extintorSoporte",
    { width: 0.1, height: 0.06, depth: 0.09 },
    scene
  );
  soporte.position.set(0, 0.3, 0.055);
  soporte.material = matNegro;
  soporte.parent = raiz;

  // Señalética reglamentaria, encima y bien alta para verse de lejos.
  const senal = MeshBuilder.CreatePlane(
    "extintorSenal",
    { width: 0.21, height: 0.21 },
    scene
  );
  senal.position.set(0, 0.92, -0.018);
  senal.rotation.y = Math.PI;
  senal.material = materialPintadoNitido(
    scene,
    "matSenalExtintor",
    210,
    210,
    2.5,
    (ctx, w, h) => {
      ctx.fillStyle = "#b01a12";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f4f2ec";
      ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = "#b01a12";
      ctx.fillRect(14, 14, w - 28, h - 28);

      // Pictograma: silueta de extintor con la llama.
      ctx.fillStyle = "#f4f2ec";
      ctx.fillRect(w * 0.42, h * 0.34, w * 0.13, h * 0.4);
      ctx.beginPath();
      ctx.arc(w * 0.485, h * 0.34, w * 0.065, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(w * 0.465, h * 0.24, w * 0.04, h * 0.08);
      ctx.beginPath();
      ctx.moveTo(w * 0.62, h * 0.62);
      ctx.quadraticCurveTo(w * 0.7, h * 0.46, w * 0.64, h * 0.34);
      ctx.quadraticCurveTo(w * 0.78, h * 0.46, w * 0.7, h * 0.66);
      ctx.closePath();
      ctx.fill();

      ctx.font = "bold 19px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EXTINTOR", w / 2, h - 24);
    }
  );
  senal.parent = raiz;
}

/**
 * Papelera de rejilla metálica.
 *
 * La de toda la vida: chapa perforada. Se hace con dos cilindros abiertos —uno
 * exterior de rejilla y otro interior oscuro— porque una papelera opaca a esta
 * distancia se lee como un cubo de plástico.
 */
function construirPapelera(scene: Scene): void {
  const raiz = new TransformNode("papeleraHall", scene);
  raiz.position.set(1.64, 0, 0.12);
  // Un poco girada: nadie deja la papelera alineada con la mesa.
  raiz.rotation.y = 0.34;

  const matRejilla = new PBRMaterial("matPapeleraRejilla", scene);
  matRejilla.albedoColor = new Color3(0.2, 0.2, 0.22);
  matRejilla.roughness = 0.44;
  matRejilla.metallic = 0.8;
  matRejilla.backFaceCulling = false;
  // Perforada de verdad: el alfa recorta los agujeros, y por ellos se ve el
  // interior. Pintarlos como manchas oscuras nunca engaña.
  matRejilla.opacityTexture = materialPintado(
    scene,
    "matPapeleraAgujeros",
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      for (let fy = 0; fy < 16; fy++) {
        for (let fx = 0; fx < 16; fx++) {
          ctx.beginPath();
          ctx.arc(fx * 8 + (fy % 2) * 4 + 4, fy * 8 + 4, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  ).albedoTexture;

  const cuerpo = MeshBuilder.CreateCylinder(
    "papeleraCuerpo",
    { diameterTop: 0.27, diameterBottom: 0.22, height: 0.34, tessellation: 28, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  cuerpo.position.y = 0.17;
  cuerpo.material = matRejilla;
  cuerpo.parent = raiz;

  const matInterior = new PBRMaterial("matPapeleraInterior", scene);
  matInterior.albedoColor = new Color3(0.045, 0.045, 0.05);
  matInterior.roughness = 0.9;
  matInterior.metallic = 0;

  const fondo = MeshBuilder.CreateCylinder(
    "papeleraFondo",
    { diameter: 0.215, height: 0.012, tessellation: 24 },
    scene
  );
  fondo.position.y = 0.008;
  fondo.material = matInterior;
  fondo.parent = raiz;

  // Aro del borde: el remate que hace que la chapa no acabe en un canto vivo.
  const aro = MeshBuilder.CreateTorus(
    "papeleraAro",
    { diameter: 0.275, thickness: 0.012, tessellation: 28 },
    scene
  );
  aro.position.y = 0.34;
  aro.material = matRejilla;
  aro.parent = raiz;

  // Un par de papeles arrugados dentro.
  const matPapel = new PBRMaterial("matPapeleraPapel", scene);
  matPapel.albedoColor = new Color3(0.76, 0.74, 0.68);
  matPapel.roughness = 0.95;
  matPapel.metallic = 0;
  [
    { x: 0.04, y: 0.24, z: -0.02, s: 0.07 },
    { x: -0.03, y: 0.22, z: 0.03, s: 0.055 },
  ].forEach((p, i) => {
    const bola = MeshBuilder.CreateSphere(
      `papeleraPapel_${i}`,
      { diameter: p.s, segments: 5 },
      scene
    );
    bola.position.set(p.x, p.y, p.z);
    bola.rotation.set(i * 1.1, i * 0.7, i * 0.4);
    bola.material = matPapel;
    bola.parent = raiz;
  });
}

/**
 * Calendario de pared.
 *
 * Un taco de hoja mensual, de los que regala la administración. Va torcido a
 * propósito: cuelga de un clavo, y nada que cuelgue de un clavo queda recto.
 */
function construirCalendario(scene: Scene): void {
  const raiz = new TransformNode("calendarioHall", scene);
  raiz.position.set(-ANCHO_SALA / 2 + 0.05, 1.58, 1.78);
  enPared(raiz, 1);
  raiz.rotation.z = 0.028;

  const matCarton = new PBRMaterial("matCalendarioCarton", scene);
  matCarton.albedoColor = new Color3(0.24, 0.26, 0.3);
  matCarton.roughness = 0.9;
  matCarton.metallic = 0;

  const respaldo = MeshBuilder.CreateBox(
    "calendarioRespaldo",
    { width: 0.26, height: 0.36, depth: 0.008 },
    scene
  );
  respaldo.material = matCarton;
  respaldo.parent = raiz;

  const hoja = MeshBuilder.CreatePlane(
    "calendarioHoja",
    { width: 0.235, height: 0.3 },
    scene
  );
  hoja.position.set(0, -0.022, -0.006);
  hoja.rotation.y = Math.PI;
  hoja.material = materialPintadoNitido(
    scene,
    "matCalendarioHoja",
    235,
    300,
    2.5,
    (ctx, w, h) => {
      ctx.fillStyle = "#efece2";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2c3a4d";
      ctx.fillRect(0, 0, w, 46);
      ctx.fillStyle = "#f4f2ea";
      ctx.font = "bold 25px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SEPTIEMBRE", w / 2, 31);

      const dias = ["L", "M", "M", "J", "V", "S", "D"];
      ctx.fillStyle = "#6a6a62";
      ctx.font = "bold 13px system-ui, sans-serif";
      dias.forEach((d, i) => ctx.fillText(d, 22 + i * 32, 68));

      // Rejilla del mes. Los domingos en rojo, como los de verdad.
      let dia = 1;
      for (let fila = 0; fila < 5; fila++) {
        for (let col = 0; col < 7; col++) {
          if (fila === 0 && col < 1) continue;
          if (dia > 30) break;
          ctx.fillStyle = col === 6 ? "#a8322a" : "#33332e";
          ctx.font = "14px system-ui, sans-serif";
          ctx.fillText(String(dia), 22 + col * 32, 96 + fila * 34);
          dia += 1;
        }
      }

      // El día del turno, marcado a bolígrafo.
      ctx.strokeStyle = "#2a3d8f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(22 + 6 * 32, 96 + 1 * 34 - 5, 13, 11, 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  );
  hoja.parent = raiz;

  // Espiral y clavo.
  const matAlambre = new PBRMaterial("matCalendarioAlambre", scene);
  matAlambre.albedoColor = new Color3(0.6, 0.6, 0.62);
  matAlambre.roughness = 0.3;
  matAlambre.metallic = 0.92;
  for (let i = 0; i < 9; i++) {
    const anilla = MeshBuilder.CreateTorus(
      `calendarioEspiral_${i}`,
      { diameter: 0.016, thickness: 0.002, tessellation: 8 },
      scene
    );
    anilla.rotation.y = Math.PI / 2;
    anilla.position.set(-0.1 + i * 0.025, 0.166, -0.004);
    anilla.material = matAlambre;
    anilla.parent = raiz;
  }
}

/**
 * Cartel de aforo y normas.
 *
 * La chapa reglamentaria que hay en todo hall. Va junto a la puerta, que es
 * donde se pone para que la lea quien entra.
 */
function construirCartelAforo(scene: Scene): void {
  const cartel = MeshBuilder.CreatePlane(
    "cartelAforoHall",
    { width: 0.3, height: 0.4 },
    scene
  );
  cartel.position.set(ANCHO_SALA / 2 - 0.11, 1.62, 3.5);
  cartel.rotation.y = -Math.PI / 2;
  cartel.material = materialPintadoNitido(
    scene,
    "matCartelAforo",
    300,
    400,
    2.5,
    (ctx, w, h) => {
      ctx.fillStyle = "#e6e3d9";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#3a3a34";
      ctx.lineWidth = 3;
      ctx.strokeRect(9, 9, w - 18, h - 18);

      ctx.fillStyle = "#1f2a3a";
      ctx.fillRect(9, 9, w - 18, 52);
      ctx.fillStyle = "#f2efe6";
      ctx.font = "bold 21px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CONDOMINIO", w / 2, 33);
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText("LAS ARAUCARIAS", w / 2, 51);

      ctx.fillStyle = "#33332e";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("AFORO MÁXIMO", w / 2, 92);
      ctx.font = "bold 52px system-ui, sans-serif";
      ctx.fillText("48", w / 2, 143);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("PERSONAS", w / 2, 163);

      ctx.strokeStyle = "#b9b4a6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(26, 180);
      ctx.lineTo(w - 26, 180);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#33332e";
      ctx.fillText("NORMAS DE ACCESO", 26, 202);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#4e4e46";
      [
        "· Toda visita se registra en conserjería.",
        "· Prohibido el ingreso sin autorización",
        "  del residente.",
        "· El personal de seguridad puede solicitar",
        "  identificación.",
        "· Zonas comunes cierran a las 23:00 horas.",
      ].forEach((linea, i) => ctx.fillText(linea, 26, 224 + i * 16));

      ctx.textAlign = "center";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "#7a7a70";
      ctx.fillText("ADMINISTRACIÓN · PUERTO MONTT", w / 2, h - 24);
    }
  );
}

/**
 * Silla del puesto.
 *
 * No se ve entera nunca —la cámara está sentada en ella— pero sí sus brazos y
 * el respaldo al girar, y eso basta para que el sitio se lea como ocupado.
 */
function construirSillaGuardia(scene: Scene): void {
  const raiz = new TransformNode("sillaGuardia", scene);
  raiz.position.set(0, 0, -0.66);
  raiz.rotation.y = 0.06;

  const matTapiz = new PBRMaterial("matSillaTapiz", scene);
  matTapiz.albedoColor = new Color3(0.09, 0.1, 0.12);
  matTapiz.roughness = 0.94;
  matTapiz.metallic = 0;
  // Tejido, no plástico. El grano modula el brillo para que la luz no
  // resbale plana sobre el tapizado: sin esto, la silla se ve de goma.
  //
  // Va como microrrelieve y no como mapa de normales porque el tapizado no
  // tiene volumen que proyecte sombra, solo una trama que cambia cómo brilla.
  matTapiz.microSurfaceTexture = texturaGrano(scene, 0.22);

  const matEstructura = new PBRMaterial("matSillaEstructura", scene);
  matEstructura.albedoColor = new Color3(0.16, 0.16, 0.18);
  matEstructura.roughness = 0.42;
  matEstructura.metallic = 0.7;

  const asiento = MeshBuilder.CreateBox(
    "sillaAsiento",
    { width: 0.46, height: 0.09, depth: 0.44 },
    scene
  );
  asiento.position.y = 0.46;
  asiento.material = matTapiz;
  asiento.parent = raiz;

  const respaldo = MeshBuilder.CreateBox(
    "sillaRespaldo",
    { width: 0.44, height: 0.5, depth: 0.08 },
    scene
  );
  respaldo.position.set(0, 0.74, -0.2);
  respaldo.rotation.x = -0.14;
  respaldo.material = matTapiz;
  respaldo.parent = raiz;

  [-1, 1].forEach((lado) => {
    const brazo = MeshBuilder.CreateBox(
      `sillaBrazo_${lado > 0 ? "d" : "i"}`,
      { width: 0.05, height: 0.045, depth: 0.3 },
      scene
    );
    brazo.position.set(lado * 0.255, 0.65, -0.02);
    brazo.material = matEstructura;
    brazo.parent = raiz;

    const soporte = MeshBuilder.CreateBox(
      `sillaSoporteBrazo_${lado > 0 ? "d" : "i"}`,
      { width: 0.03, height: 0.16, depth: 0.05 },
      scene
    );
    soporte.position.set(lado * 0.255, 0.55, -0.1);
    soporte.material = matEstructura;
    soporte.parent = raiz;
  });

  // Columna y cruceta de cinco brazos con sus ruedas.
  const columna = MeshBuilder.CreateCylinder(
    "sillaColumna",
    { diameter: 0.06, height: 0.34, tessellation: 16 },
    scene
  );
  columna.position.y = 0.26;
  columna.material = matEstructura;
  columna.parent = raiz;

  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const pata = MeshBuilder.CreateBox(
      `sillaPata_${i}`,
      { width: 0.04, height: 0.03, depth: 0.27 },
      scene
    );
    pata.position.set(Math.sin(ang) * 0.13, 0.08, Math.cos(ang) * 0.13);
    pata.rotation.y = ang;
    pata.material = matEstructura;
    pata.parent = raiz;

    const rueda = MeshBuilder.CreateCylinder(
      `sillaRueda_${i}`,
      { diameter: 0.055, height: 0.022, tessellation: 12 },
      scene
    );
    rueda.rotation.z = Math.PI / 2;
    rueda.position.set(Math.sin(ang) * 0.25, 0.028, Math.cos(ang) * 0.25);
    rueda.material = matEstructura;
    rueda.parent = raiz;
  }
}

/** Monta todo lo que amuebla el puesto. */
function construirDotacionDelPuesto(scene: Scene): void {
  construirTableroDeLlaves(scene);
  construirExtintor(scene);
  construirPapelera(scene);
  construirCalendario(scene);
  construirCartelAforo(scene);
  construirSillaGuardia(scene);
  alumbrarPared(scene);
}

/**
 * La luz del paño de la conserjería.
 *
 * ─── ESTO ES LO QUE FALTABA DE VERDAD ─────────────────────────────────────
 *
 * El tablero y los casilleros se veían como dos recortes negros, y no era
 * por cómo estaban hechos: es que esa pared NO RECIBÍA LUZ DE NADA. Las
 * luminarias del techo van por el centro de la sala y el muro está a cuatro
 * metros y medio, así que ahí no llegaba más que el rebote.
 *
 * Un objeto sin luz no tiene volumen, y sin volumen no hay modelado que
 * valga: se ve la silueta y nada más. Por eso parecían dos cuadrados.
 *
 * Y tiene sentido que exista: en una conserjería el tablero de llaves está
 * alumbrado a propósito, porque el guardia tiene que ver de un vistazo qué
 * llave falta. Aquí hace exactamente lo mismo.
 *
 * ─── POR QUÉ NO SE COME EL PRESUPUESTO DE LUCES ───────────────────────────
 *
 * Cada material admite ocho luces a la vez y la sala ya va justa. Acotando
 * el foco a las mallas de este paño, el resto de la escena ni lo cuenta —es
 * el mismo recurso que usa el bañador del ascensor—. Y de paso no derrama
 * luz sobre el muro, que debe seguir en penumbra para que el charco se lea
 * como un foco y no como iluminación general.
 */
function alumbrarPared(scene: Scene): void {
  const foco = new SpotLight(
    "luzParedConserjeria",
    new Vector3(-ANCHO_SALA / 2 + 0.75, ALTO_SALA - 0.3, 2.7),
    // APUNTANDO AL TABLERO, no a la pared en general.
    //
    // Estaba en (−1, −0,42, 0,25) y el tablero caía a 44,7° del eje, con el
    // medio cono en 43: se quedaba JUSTO fuera y solo le llegaba el borde del
    // haz. Por eso salía apagado por mucho que se subiera la intensidad — el
    // problema no era cuánta luz daba, era hacia dónde.
    // Recalculada para la nueva posición del tablero. Un foco mal apuntado no
    // se arregla subiendo la intensidad: o el mueble cae dentro del cono o no.
    new Vector3(-0.52, -0.78, -0.35),
    1.5,
    3,
    scene
  );
  foco.diffuse = new Color3(1, 0.94, 0.84);
  foco.specular = new Color3(1, 0.96, 0.9);
  foco.intensity = 7.4;
  foco.range = 4.2;

  foco.includedOnlyMeshes = scene.meshes.filter(
    (m) =>
      m.name.startsWith("tableroLlaves") ||
      m.name.startsWith("llaves") ||
      m.name.startsWith("calendario")
  );

  // La luminaria que lo justifica: un aplique sobre el paño. Una luz sin
  // lámpara a la vista se nota, aunque no se sepa decir por qué.
  const matAplique = new PBRMaterial("matApliqueConserjeria", scene);
  matAplique.albedoColor = new Color3(0.14, 0.15, 0.17);
  matAplique.roughness = 0.45;
  matAplique.metallic = 0.6;

  const brazo = MeshBuilder.CreateBox(
    "apliqueConserjeriaBrazo",
    { width: 0.22, height: 0.03, depth: 0.04 },
    scene
  );
  brazo.position.set(-ANCHO_SALA / 2 + 0.13, ALTO_SALA - 0.28, 2.7);
  brazo.material = matAplique;

  const pantalla = MeshBuilder.CreateCylinder(
    "apliqueConserjeriaPantalla",
    { diameterTop: 0.16, diameterBottom: 0.09, height: 0.11, tessellation: 18 },
    scene
  );
  pantalla.rotation.z = -0.5;
  pantalla.position.set(-ANCHO_SALA / 2 + 0.26, ALTO_SALA - 0.33, 2.7);
  pantalla.material = matAplique;

  const bombilla = MeshBuilder.CreateSphere(
    "apliqueConserjeriaBombilla",
    { diameter: 0.075, segments: 10 },
    scene
  );
  bombilla.position.set(-ANCHO_SALA / 2 + 0.29, ALTO_SALA - 0.37, 2.7);
  const matBombilla = new PBRMaterial("matBombillaConserjeria", scene);
  matBombilla.albedoColor = new Color3(0, 0, 0);
  matBombilla.emissiveColor = new Color3(1, 0.93, 0.79);
  matBombilla.disableLighting = true;
  bombilla.material = matBombilla;
}

// ---------------------------------------------------------------------------
// Mesón
// ---------------------------------------------------------------------------

function construirMeson(scene: Scene): Mesh {
  const LARGO = 2.6;
  const FONDO = 0.86;
  const GRUESO = 0.06;

  // ─── MADERA MACIZA BARNIZADA, CON TODOS SUS MAPAS ───────────────────────
  //
  // Era una foto de veta con un relieve sacado de su propio brillo y UNA sola
  // rugosidad para toda la tabla. Bajo el flexo brillaba igual el poro que la
  // veta, y así brilla un plástico. Encima el color era casi negro: la luz
  // llegaba y no tenía nada que devolver.
  //
  // Ahora es un tablero de cuatro tablas con su veta de catedral, su poro, su
  // oclusión y, sobre todo, SU BARNIZ: una capa aparte que devuelve el reflejo
  // nítido del flexo y de las luminarias mientras la madera de debajo reparte
  // la luz según su veta. Ver TexturasPBR.
  //
  // La zona gastada va donde se apoyan los antebrazos al escribir, delante del
  // libro. El cerco de la taza, a la derecha y bajo el flexo: donde se deja la
  // taza para no mojar el libro.
  const mapas = generarMadera({
    ancho: 1024,
    alto: 2048,
    fondoM: FONDO,
    largoM: LARGO,
    tablas: 4,
    semilla: 1987,
    desgaste: { u: 0.16, v: 0.45, radioU: 0.17, radioV: 0.14 },
    taza: { um: 0.13, vm: 1.66, radioM: 0.037 },
  });
  const color = subirMapa(scene, "texMesonColor", mapas.albedo, true);
  const normal = subirMapa(scene, "texMesonNormal", mapas.normal, false);
  const orm = subirMapa(scene, "texMesonORM", mapas.orm, false);
  const barniz = subirMapa(scene, "texMesonBarniz", mapas.barniz, false);
  const normalBarniz = subirMapa(scene, "texMesonNormalBarniz", mapas.normalBarniz, false);

  const matTapa = new PBRMaterial("matTapaMeson", scene);
  matTapa.albedoTexture = color;
  matTapa.bumpTexture = normal;
  matTapa.metallicTexture = orm;
  matTapa.useAmbientOcclusionFromMetallicTextureRed = true;
  matTapa.useRoughnessFromMetallicTextureGreen = true;
  matTapa.useMetallnessFromMetallicTextureBlue = true;
  // Con mapa, estos dos pasan a ser multiplicadores: el valor sale de la textura.
  matTapa.metallic = 1;
  matTapa.roughness = 1;
  matTapa.clearCoat.isEnabled = true;
  matTapa.clearCoat.intensity = 1;
  matTapa.clearCoat.roughness = 1;
  matTapa.clearCoat.texture = barniz;
  matTapa.clearCoat.useRoughnessFromMainTexture = true;
  matTapa.clearCoat.bumpTexture = normalBarniz;
  matTapa.clearCoat.indexOfRefraction = 1.5;
  // Más entorno que el resto de la sala: un barniz tiene que devolverla.
  matTapa.environmentIntensity = 1.5;

  const tapa = MeshBuilder.CreateBox("tapaMeson", { width: LARGO, height: GRUESO, depth: FONDO }, scene);
  // Veta a lo largo en la tapa y en los cantos, sin aplastarse. Ver la función.
  proyectarUVCaja(tapa, { u: FONDO, v: LARGO });
  tapa.position.set(0, ALTO_MESON - GRUESO / 2, 0.3);
  tapa.material = matTapa;
  tapa.receiveShadows = true;

  // Canto redondeado, hacia el jugador. Es el borde que queda a un palmo de la
  // cámara: si se deja en arista viva, es lo primero que delata que es una caja.
  // La veta sigue desde la tapa y dobla por el canto sin corte.
  const canto = MeshBuilder.CreateCylinder(
    "cantoMeson",
    { diameter: GRUESO, height: LARGO, tessellation: 32 },
    scene
  );
  proyectarUVCanto(canto, LARGO, { u: FONDO, v: LARGO });
  canto.rotation.z = Math.PI / 2;
  canto.position.set(0, ALTO_MESON - GRUESO / 2, 0.3 - FONDO / 2);
  canto.material = matTapa;

  // El frente es el mismo árbol, teñido más oscuro y con un barniz satinado:
  // en un mueble de recepción la cara vertical nunca va igual que la cubierta.
  const matFrente = new PBRMaterial("matFrenteMeson", scene);
  matFrente.albedoTexture = color;
  matFrente.albedoColor = new Color3(0.42, 0.36, 0.33);
  matFrente.bumpTexture = normal;
  matFrente.metallicTexture = orm;
  matFrente.useAmbientOcclusionFromMetallicTextureRed = true;
  matFrente.useRoughnessFromMetallicTextureGreen = true;
  matFrente.useMetallnessFromMetallicTextureBlue = true;
  matFrente.metallic = 1;
  matFrente.roughness = 1;
  matFrente.clearCoat.isEnabled = true;
  matFrente.clearCoat.intensity = 0.55;
  matFrente.clearCoat.roughness = 0.3;

  const frente = MeshBuilder.CreateBox(
    "frenteMeson",
    { width: LARGO, height: ALTO_MESON - GRUESO, depth: 0.05 },
    scene
  );
  proyectarUVCaja(frente, { u: FONDO, v: LARGO }, { u: 0.35, v: 0 });
  frente.position.set(0, (ALTO_MESON - GRUESO) / 2, 0.3 - FONDO / 2);
  frente.material = matFrente;
  frente.receiveShadows = true;

  return tapa;
}

// ---------------------------------------------------------------------------
// Monitor de cámaras
// ---------------------------------------------------------------------------

function construirMonitor(scene: Scene, monitor: MonitorCamaras): { pantalla: Mesh } {
  const X = 0.18;
  const Z = 0.56;

  const matCarcasa = new PBRMaterial("matCarcasaMonitor", scene);
  matCarcasa.albedoColor = new Color3(0.045, 0.048, 0.055);
  matCarcasa.roughness = 0.42;
  matCarcasa.metallic = 0.25;
  matCarcasa.microSurfaceTexture = texturaGrano(scene, 0.07);

  // Pie y columna. Un monitor apoyado directamente sobre la tapa se ve pegado.
  const pie = MeshBuilder.CreateCylinder(
    "pieMonitor",
    { diameterTop: 0.22, diameterBottom: 0.26, height: 0.018, tessellation: 28 },
    scene
  );
  pie.position.set(X, ALTO_MESON + 0.009, Z);
  pie.material = matCarcasa;

  const columna = MeshBuilder.CreateBox(
    "columnaMonitor",
    { width: 0.05, height: 0.16, depth: 0.045 },
    scene
  );
  columna.position.set(X, ALTO_MESON + 0.09, Z);
  columna.material = matCarcasa;

  // Carcasa, ligeramente inclinada hacia el guardia.
  const ANCHO = 0.72;
  const ALTO = 0.44;
  const INCLINACION = -0.11;

  const carcasa = MeshBuilder.CreateBox(
    "carcasaMonitor",
    { width: ANCHO, height: ALTO, depth: 0.035 },
    scene
  );
  carcasa.position.set(X, ALTO_MESON + 0.39, Z);
  carcasa.rotation.x = INCLINACION;
  carcasa.material = matCarcasa;
  carcasa.receiveShadows = true;

  // Pantalla: la fuente de luz principal de la escena.
  //
  // Va como material propio Y como luz puntual. Solo lo primero haría una
  // pantalla brillante que no ilumina nada; solo lo segundo, una luz que sale
  // de un cristal apagado.
  //
  // El material no recibe luz (ver MonitorCamaras): la luz de abajo está a
  // catorce centímetros por delante del cristal, y con un material normal se
  // reflejaba en él y lo tapaba entero con una mancha blanca. Un monitor
  // emite su luz, no la recibe. Lo que muestra lo filman las cuatro cámaras
  // del circuito y lo compone su propio sombreador.
  const pantalla = MeshBuilder.CreatePlane(
    "pantallaMonitor",
    { width: ANCHO - 0.045, height: ALTO - 0.045 },
    scene
  );
  pantalla.position.set(
    X,
    ALTO_MESON + 0.39 + Math.sin(-INCLINACION) * 0.02,
    Z - 0.021
  );
  // Solo la inclinación, SIN girar el plano media vuelta.
  //
  // Antes llevaba también `rotation.y = Math.PI`, y ahí estaba el problema:
  // Babylon compone los ángulos de Euler en orden YXZ, así que ese giro de
  // 180° invierte el eje X y la inclinación acaba aplicándose al revés que en
  // la carcasa. Los dos quedaban inclinados 0,11 rad en sentidos opuestos: el
  // borde de arriba del plano se hundía unos cuatro centímetros dentro de la
  // carcasa y solo se veía la mitad de abajo de la imagen.
  //
  // Sin el giro, el plano queda paralelo a la carcasa y con su cara frontal
  // hacia la cámara —que está en z negativo, y la normal de un plano de
  // Babylon apunta hacia -Z—, así que se ve entero y sin espejar.
  pantalla.rotation.x = INCLINACION;
  // Sin orientar: el sombreador ya lee la imagen con el origen arriba a la
  // izquierda, igual que el lienzo de los rótulos.
  pantalla.material = monitor.material;
  monitor.vincularPantalla(pantalla);

  const luzPantalla = new PointLight(
    "luzPantallaMonitor",
    new Vector3(X, ALTO_MESON + 0.42, Z - 0.16),
    scene
  );
  // Azulada y fría, como cualquier monitor. Es la que tiñe el mesón y las
  // manos del guardia, y la que da el ambiente entero de la escena.
  luzPantalla.diffuse = new Color3(0.52, 0.68, 0.95);
  luzPantalla.intensity = 1.35;
  luzPantalla.range = 2.6;

  // Esta luz está catorce centímetros POR DELANTE del cristal, mirándolo de
  // frente. Sin excluirla, el monitor se ilumina a sí mismo y la imagen
  // desaparece bajo su propio reflejo. El material ya no acepta luz, pero se
  // deja igual: si alguien alguna vez le devuelve la iluminación al cristal,
  // que no reaparezca la mancha por este lado.
  luzPantalla.excludedMeshes.push(pantalla);

  return { pantalla };
}


/**
 * Acercarse al monitor con la rueda del mouse.
 *
 * Los cuadrantes miden algo más de un palmo en la pantalla real y están al
 * fondo del mesón: se distingue que una cámara está en ámbar, pero no la
 * patente de una camioneta. La rueda acerca y aleja de forma continua.
 *
 * ─── POR QUÉ LA RUEDA Y NO UN CLIC ────────────────────────────────────────
 *
 * Antes era un clic sobre el cristal que alternaba entre dos posiciones
 * fijas: o lejos o cerca, sin nada en medio. Tenía dos problemas. Uno, que
 * hay que apuntarle a la pantalla para usarlo, y a un objeto pequeño al fondo
 * del mesón no siempre se le acierta. Dos, que el 5S ya usa la rueda para
 * acercarse, así que el jugador que viene del otro curso llega con el gesto
 * aprendido y acá no le respondía.
 *
 * ─── POR QUÉ MUEVE EL CAMPO DE VISIÓN Y NO LA CÁMARA ──────────────────────
 *
 * Acercar la cámara la metería dentro del mesón o de la carcasa según hacia
 * dónde estuviera mirando el jugador, y habría que resolver colisiones para
 * algo que en el fondo es entornar los ojos. Moviendo el FOV el tope de giro
 * sigue funcionando igual, porque la cámara no se ha movido de la silla.
 *
 * ─── POR QUÉ EL PASO ES PROPORCIONAL ──────────────────────────────────────
 *
 * Cada muesca de la rueda cambia el campo un porcentaje del que hay, no una
 * cantidad fija. Es lo mismo que hace el 5S con la distancia de su cámara
 * (wheelDeltaPercentage), y es lo que hace que el gesto se sienta parejo:
 * con paso fijo, las últimas muescas al acercarse darían saltos enormes
 * porque el campo que queda ya es muy chico.
 */
function montarZoomMonitor(scene: Scene, camara: FreeCamera, vista: VistaPuesto): void {
  const FOV_LEJOS = FOV_SILLA;
  /** Con este campo, la patente de la camioneta se lee. */
  const FOV_CERCA = 0.3;
  /** Cuánto cambia el campo por muesca, en tanto por uno. */
  const PASO = 0.12;
  /** Cuánto del camino que falta se recorre por cuadro. */
  const SUAVIDAD = 0.18;

  let destino = FOV_LEJOS;

  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERWHEEL) return;
    // Inclinado sobre el libro la rueda no hace nada: ahí el campo lo lleva la
    // inclinación. Sin esto, girar la rueda con el libro abierto dejaba un
    // destino guardado que daba un tirón al volver a la silla.
    if (!vista.enLaSilla()) return;
    const evento = info.event as IWheelEvent;

    // deltaY es positivo al girar hacia el usuario, que es alejarse.
    const sentido = Math.sign(evento.deltaY) || 0;
    if (sentido === 0) return;

    destino = Math.min(FOV_LEJOS, Math.max(FOV_CERCA, destino * (1 + sentido * PASO)));

    // Sin esto la rueda hace scroll en la página que contiene el juego.
    evento.preventDefault?.();
  });

  scene.onBeforeRenderObservable.add(() => {
    if (!vista.enLaSilla()) return;
    const resto = destino - camara.fov;
    // Por debajo de una milésima ya no se ve moverse: se asienta y se deja de
    // calcular una interpolación que nunca termina de llegar.
    camara.fov = Math.abs(resto) < 0.001 ? destino : camara.fov + resto * SUAVIDAD;
  });
}

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

function construirRadio(scene: Scene): { radio: Mesh; avisarRadio: (encendido: boolean) => void } {
  const X = -0.72;
  const Z = 0.42;

  const caucho = superficieCaucho(scene, "texCauchoRadio");

  const matCuerpo = new PBRMaterial("matCuerpoRadio", scene);
  matCuerpo.albedoTexture = caucho.color;
  matCuerpo.bumpTexture = caucho.relieve;
  matCuerpo.roughness = 0.72;
  matCuerpo.metallic = 0.1;

  const cuerpo = MeshBuilder.CreateBox("cuerpoRadio", { width: 0.13, height: 0.2, depth: 0.06 }, scene);
  cuerpo.position.set(X, ALTO_MESON + 0.1, Z);
  cuerpo.rotation.x = 0.18;
  cuerpo.material = matCuerpo;
  cuerpo.receiveShadows = true;

  // Antena.
  const matMetal = new PBRMaterial("matAntenaRadio", scene);
  matMetal.albedoColor = new Color3(0.16, 0.16, 0.18);
  matMetal.roughness = 0.34;
  matMetal.metallic = 0.85;
  matMetal.albedoTexture = texturaMetalCepillado(scene);

  const antena = MeshBuilder.CreateCylinder(
    "antenaRadio",
    { diameterTop: 0.008, diameterBottom: 0.013, height: 0.17, tessellation: 10 },
    scene
  );
  antena.position.set(X - 0.045, ALTO_MESON + 0.27, Z - 0.01);
  antena.rotation.x = 0.18;
  antena.material = matMetal;

  // Rejilla del altavoz. Es el detalle que hace que se lea como radio y no como
  // un bloque negro.
  const matRejilla = materialPintado(scene, "matRejillaRadio", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#0b0c0e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1c1f24";
    for (let y = 6; y < h - 4; y += 9) {
      for (let x = 6; x < w - 4; x += 9) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  const rejilla = MeshBuilder.CreateBox(
    "rejillaRadio",
    { width: 0.1, height: 0.075, depth: 0.008 },
    scene
  );
  rejilla.position.set(X, ALTO_MESON + 0.135, Z - 0.031);
  rejilla.rotation.x = 0.18;
  rejilla.material = matRejilla;

  // Piloto. Apagado en reposo; parpadea cuando entra un mensaje.
  const matPiloto = new PBRMaterial("matPilotoRadio", scene);
  matPiloto.albedoColor = new Color3(0.2, 0.05, 0.04);
  matPiloto.emissiveColor = new Color3(0.06, 0.012, 0.01);
  matPiloto.roughness = 0.25;

  const piloto = MeshBuilder.CreateSphere("pilotoRadio", { diameter: 0.016, segments: 10 }, scene);
  piloto.position.set(X + 0.042, ALTO_MESON + 0.185, Z - 0.028);
  piloto.material = matPiloto;

  let avisando = false;

  scene.onBeforeRenderObservable.add(() => {
    if (!avisando) return;
    // Latido, no destello. Un parpadeo brusco se confunde con un fallo de
    // dibujado; uno que respira se lee como un aviso.
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    matPiloto.emissiveColor.set(0.25 + pulso * 1.35, 0.04 + pulso * 0.14, 0.03);
  });

  const avisarRadio = (encendido: boolean): void => {
    avisando = encendido;
    if (!encendido) matPiloto.emissiveColor.set(0.06, 0.012, 0.01);
  };

  return { radio: cuerpo, avisarRadio };
}

// ---------------------------------------------------------------------------
// Libro de novedades
// ---------------------------------------------------------------------------

/**
 * El libro, abierto sobre el mesón.
 *
 * Por ahora es solo el objeto: dos páginas con el rayado de tres columnas que
 * exige el manual —HORA, ACTIVIDAD, OBSERVACIONES— y las tapas de cartón duro.
 * Escribir en él vendrá después, sobre una interfaz aparte; esto es lo que se
 * ve en la escena.
 */
function construirLibro(scene: Scene, paginas: PaginasLibro, onAbrir: () => void): Mesh {
  const X = -0.12;
  const Z = 0.06;
  const GIRO = 0.06;

  // ─── TAPAS DE CUERINA GRANULADA ──────────────────────────────────────────
  //
  // Eran un color café liso con ruido en el brillo. Un libro de novedades es
  // un libro de actas de tapa dura forrada en cuerina: grano en relieve,
  // cúpulas pulidas por la mano, surcos mates y los cantos gastados hasta
  // clarear. Bajo el flexo es eso lo que atrapa la luz — y el brillo
  // aterciopelado de canto (sheen) es lo que la separa de un plástico.
  const cuero = generarCuero({ ancho: 1024, alto: 1024, fondoM: 0.4, largoM: 0.62, semilla: 77 });
  const matTapa = new PBRMaterial("matTapaLibro", scene);
  matTapa.albedoTexture = subirMapa(scene, "texCueroLibroColor", cuero.albedo, true);
  matTapa.bumpTexture = subirMapa(scene, "texCueroLibroNormal", cuero.normal, false);
  matTapa.metallicTexture = subirMapa(scene, "texCueroLibroORM", cuero.orm, false);
  matTapa.useAmbientOcclusionFromMetallicTextureRed = true;
  matTapa.useRoughnessFromMetallicTextureGreen = true;
  matTapa.useMetallnessFromMetallicTextureBlue = true;
  matTapa.metallic = 1;
  matTapa.roughness = 1;
  matTapa.sheen.isEnabled = true;
  matTapa.sheen.intensity = 0.35;
  matTapa.sheen.color = new Color3(0.85, 0.62, 0.55);
  matTapa.sheen.roughness = 0.5;
  matTapa.environmentIntensity = 1.2;

  // El canto del taco de hojas: sin él, el borde de las páginas mostraba el
  // rayado del libro aplastado en ocho milímetros.
  const canto = generarCantoHojas(1024, 48, 5);
  const matCanto = new PBRMaterial("matCantoHojas", scene);
  matCanto.albedoTexture = subirMapa(scene, "texCantoHojasColor", canto.albedo, true, Texture.CLAMP_ADDRESSMODE);
  matCanto.bumpTexture = subirMapa(scene, "texCantoHojasNormal", canto.normal, false, Texture.CLAMP_ADDRESSMODE);
  matCanto.roughness = 0.86;
  matCanto.metallic = 0;

  const tapa = MeshBuilder.CreateBox("tapaLibro", { width: 0.62, height: 0.014, depth: 0.4 }, scene);
  proyectarUVCaja(tapa, { u: 0.4, v: 0.62 });
  tapa.position.set(X, ALTO_MESON + 0.007, Z);
  tapa.rotation.y = GIRO;
  tapa.material = matTapa;
  tapa.receiveShadows = true;

  // Todo el bloque del libro se abre haciendo clic en cualquiera de sus
  // piezas —tapa, páginas o lomo—, así que el receptor de clics es la tapa,
  // que es la pieza más grande y la que queda debajo de las páginas.
  tapa.actionManager = new ActionManager(scene);
  tapa.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, onAbrir));

  // El taco de hojas, de papel liso. Lo escrito va en un plano aparte, encima
  // (ver hojaEscrita): la cara de arriba de una caja proyecta la textura
  // girada un cuarto de vuelta, y el rayado corría a lo largo del lomo — las
  // columnas quedaban de canto y lo escrito se habría leído de costado.
  const matTaco = new PBRMaterial("matTacoHojas", scene);
  matTaco.albedoColor = new Color3(0.78, 0.74, 0.63);
  matTaco.roughness = 0.92;
  matTaco.metallic = 0;

  // Las dos páginas, con el rayado impreso.
  [-1, 1].forEach((lado) => {
    const pagina = MeshBuilder.CreateBox(
      `paginaLibro_${lado}`,
      { width: 0.29, height: 0.008, depth: 0.375 },
      scene
    );
    const dx = Math.cos(GIRO) * lado * 0.152;
    const dz = -Math.sin(GIRO) * lado * 0.152;
    pagina.position.set(X + dx, ALTO_MESON + 0.018, Z + dz);
    pagina.rotation.y = GIRO;
    const matPagina = orientar(paginas.material(lado), ORIENTACION_APOYADA);
    // Fibra de papel. Muy sutil, pero es lo que impide que la hoja devuelva la
    // luz del flexo como un brillo plano de plástico.
    matPagina.bumpTexture = relievePapel(scene, `relievePapel_${lado}`);
    matPagina.bumpTexture.level = 0.35;
    pagina.material = matTaco;
    pagina.receiveShadows = true;

    // La hoja escrita: un plano tendido sobre el taco, con el ancho de la
    // textura a lo ancho del libro y su alto hacia el fondo. Así el rayado
    // queda como se lee un libro abierto —cabecera arriba, renglones de
    // izquierda a derecha— y lo que se escribe se lee de frente desde la silla.
    // Sin picking: el clic tiene que llegar a la página de debajo.
    const hoja = MeshBuilder.CreatePlane(`hojaEscrita_${lado}`, { width: 0.29, height: 0.375 }, scene);
    hoja.parent = pagina;
    hoja.position.y = 0.0046;
    hoja.rotation.x = Math.PI / 2;
    hoja.material = matPagina;
    hoja.isPickable = false;
    hoja.receiveShadows = true;

    // Las páginas quedan por encima de la tapa en pantalla, así que también
    // necesitan su propio receptor o el clic sobre ellas no llegaría a nada.
    pagina.actionManager = new ActionManager(scene);
    pagina.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, onAbrir));

    // Tres cantos visibles por página: el de delante, el del fondo y el
    // exterior. El del lomo lo tapa el lomo. Van hijos de la página, así giran
    // con ella, y sin picking: el clic tiene que llegar a la página de detrás.
    const cantos: [string, number, number, number, number][] = [
      ["frente", 0.29, 0, -0.1878, 0],
      ["fondo", 0.29, 0, 0.1878, Math.PI],
      ["exterior", 0.375, lado * 0.1453, 0, lado > 0 ? -Math.PI / 2 : Math.PI / 2],
    ];
    cantos.forEach(([nombre, ancho, x, z, giro]) => {
      const plano = MeshBuilder.CreatePlane(`cantoHojas_${nombre}_${lado}`, { width: ancho, height: 0.008 }, scene);
      plano.parent = pagina;
      plano.position.set(x, 0, z);
      plano.rotation.y = giro;
      plano.material = matCanto;
      plano.isPickable = false;
      plano.receiveShadows = true;
    });
  });

  // Lomo, algo más alto que las páginas: es lo que hace que se lea como un
  // libro abierto y no como dos hojas sueltas.
  const lomo = MeshBuilder.CreateBox("lomoLibro", { width: 0.02, height: 0.026, depth: 0.4 }, scene);
  proyectarUVCaja(lomo, { u: 0.4, v: 0.62 }, { u: 0, v: 0.3 });
  lomo.position.set(X, ALTO_MESON + 0.02, Z);
  lomo.rotation.y = GIRO;
  lomo.material = matTapa;

  return tapa;
}


// ---------------------------------------------------------------------------
// Tabla de claves
// ---------------------------------------------------------------------------

/**
 * La tarjeta plastificada con las claves, apoyada en el mesón.
 *
 * ─── POR QUÉ ESTÁ A LA VISTA ──────────────────────────────────────────────
 *
 * Porque en un puesto real está a la vista. Un guardia no memoriza la Clave 10
 * contrarreloj: la tiene plastificada delante y la consulta. Esconderla para
 * "hacerlo más difícil" mediría memoria, que no es la habilidad del oficio —
 * la habilidad es leer la fila correcta y actuar sin trabarse.
 *
 * Y como los códigos se repiten durante el turno, la tarjeta se va necesitando
 * cada vez menos. Eso es aprender de verdad, no aprobar un test.
 */
function construirTablaDeClaves(scene: Scene): void {
  const tarjeta = MeshBuilder.CreateBox(
    "tablaClaves",
    { width: 0.3, height: 0.004, depth: 0.21 },
    scene
  );
  tarjeta.position.set(0.78, ALTO_MESON + 0.005, 0.13);
  tarjeta.rotation.y = -0.22;
  tarjeta.material = orientar(materialPintadoNitido(scene, "matTablaClaves", 400, 280, 2.5, (ctx, w, h) => {
    ctx.fillStyle = "#f1efe6";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#1d2733";
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CLAVE 10  ·  CÓDIGO Q", w / 2, 23);

    // SOLO las entradas del manual que están bien traducidas.
    //
    // La tabla del documento viene de un traductor automático y varias filas no
    // significan nada — "10-26 La Indiferencia Information/Cancel Pasado Dura
    // Message/Ignore" es literal. Calificar con eso sería enseñar algo falso,
    // así que aquí van únicamente las coherentes. Alcanzan de sobra.
    const filas: Array<[string, string]> = [
      ["10-4", "Mensaje recibido"],
      ["10-8", "En servicio"],
      ["10-12", "Visitantes presentes"],
      ["10-20", "¿Cuál es su ubicación?"],
      ["10-23", "Haga una pausa"],
      ["10-33", "Emergencia en esta estación"],
      ["10-70", "Fuego en"],
      ["10-77", "Contacto negativo"],
      ["QTH", "Domicilio · lugar"],
      ["QRV", "Estoy listo · atento"],
      ["QSL", "Acuso recibo"],
      ["QAP", "Atento en frecuencia"],
    ];

    ctx.font = "bold 13px monospace";
    filas.forEach(([codigo, significado], i) => {
      const y = 52 + i * 18;
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(29, 39, 51, 0.05)";
        ctx.fillRect(6, y - 13, w - 12, 18);
      }
      ctx.fillStyle = "#1d2733";
      ctx.textAlign = "left";
      ctx.fillText(codigo, 14, y);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(significado, 82, y);
      ctx.font = "bold 13px monospace";
    });
  }), ORIENTACION_APOYADA);
}

// ---------------------------------------------------------------------------
// Hall, ventanal y flexo
// ---------------------------------------------------------------------------

/**
 * Lo que hay más allá del mesón.
 *
 * No es decorado: es lo que hace que el puesto esté EN algún sitio. Un mesón
 * flotando en negro se ve como una maqueta; con un hall detrás, una farola que
 * entra por el ventanal y un suelo que devuelve algo de luz, se ve como la
 * conserjería de un edificio a las tres de la mañana.
 *
 * Está deliberadamente poco detallado y muy poco iluminado: se ve la silueta y
 * poco más, que es exactamente lo que se ve de noche desde detrás de un mesón
 * con un monitor encendido en la cara.
 */
// ---------------------------------------------------------------------------
// La sala
// ---------------------------------------------------------------------------

const ANCHO_SALA = 8.8;
const ALTO_SALA = 3.2;
const Z_FONDO = 4.6;
const Z_ESPALDA = -2.8;

/**
 * El hall del condominio: piso, muros, techo y zócalo.
 *
 * ─── POR QUÉ AHORA SÍ HAY TECHO ───────────────────────────────────────────
 *
 * Antes la escena era un mesón flotando sobre un suelo, con un muro al fondo y
 * nada más. Funcionaba porque estaba a oscuras: lo que no existe no se ve.
 *
 * Pero un hall de condominio a las tres de la mañana NO está a oscuras. Tiene
 * las luminarias encendidas —a media potencia, en modo noche, pero encendidas—
 * porque el conserje trabaja ahí y porque un edificio con el hall apagado se
 * ve abandonado. En cuanto se enciende la luz, el vacío de arriba se nota.
 *
 * Así que la sala se cierra: cuatro muros, techo y zócalo. Es geometría muy
 * barata —seis cajas y dos planos— y es lo que permite que la escena aguante
 * estar iluminada.
 *
 * ─── EL PISO ES LO QUE HACE EL TRABAJO ────────────────────────────────────
 *
 * Porcelanato pulido, que es lo que hay en el hall de cualquier condominio de
 * los últimos veinte años. Refleja las luminarias del techo en franjas
 * verticales, y esas franjas son la firma visual del sitio: se reconoce el
 * lugar por el suelo antes que por ninguna otra cosa.
 *
 * El reflejo es real, no pintado — ver montarReflejos().
 */
function construirSala(scene: Scene): void {
  // --- Piso: porcelanato pulido, baldosa de 80 cm ---------------------------
  // 2048 en vez de 1024, y con la JUNTA dibujada dentro.
  //
  // Antes la textura era una baldosa suelta que se repetía once por nueve, y
  // la cuadrícula la daba solo la geometría: el resultado era un suelo
  // continuo con líneas encima. Dibujando cuatro baldosas con su junta y su
  // tono propio dentro de la misma textura, cada repetición trae ya cuatro
  // piezas distintas — y el ojo deja de encontrar el patrón.
  const matPiso = materialPintado(scene, "matPisoHall", 2048, 2048, (ctx, w, h) => {
    // Base cálida grisácea. El porcelanato de hall casi nunca es blanco puro:
    // tira a hueso o a gris arena, que es lo que le da el aire de sitio usado.
    ctx.fillStyle = "#8d8b86";
    ctx.fillRect(0, 0, w, h);

    // Veteado suave, como el mármol falso de las baldosas comerciales. Van
    // pocas y muy tenues: el porcelanato imita la piedra de lejos, no de cerca.
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    for (let i = 0; i < 90; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.lineWidth = 0.6 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + 60 - Math.random() * 120,
        y + 40,
        x + 120 - Math.random() * 240,
        y + 90,
        x + 180 - Math.random() * 360,
        y + 150
      );
      ctx.stroke();
    }

    // Manchas grandes de tono, para que dos baldosas contiguas no salgan
    // idénticas. Sin esto se ve la repetición de la textura al instante.
    for (let i = 0; i < 24; i += 1) {
      const r = 60 + Math.random() * 150;
      const mancha = ctx.createRadialGradient(
        Math.random() * w,
        Math.random() * h,
        4,
        Math.random() * w,
        Math.random() * h,
        r
      );
      mancha.addColorStop(0, "rgba(160,155,148,0.14)");
      mancha.addColorStop(1, "rgba(160,155,148,0)");
      ctx.fillStyle = mancha;
      ctx.fillRect(0, 0, w, h);
    }

    // Junta. Fina y oscura: en el porcelanato rectificado casi no se ve, pero
    // es la línea que dice "esto son baldosas" y no una superficie continua.
    ctx.strokeStyle = "rgba(46,44,42,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });

  // Cuatro baldosas por textura: junta, variación de tono y brillo de pulido.
  {
    const ctx = (matPiso.albedoTexture as DynamicTexture).getContext() as unknown as CanvasRenderingContext2D;
    const L = 2048 / 2;

    // Cada baldosa, un pelo distinta de sus vecinas. Es lo que impide que se
    // vea la cuadrícula repetida: en un suelo real no hay dos iguales.
    [
      [0, 0, "rgba(255,255,255,0.028)"],
      [1, 0, "rgba(0,0,0,0.03)"],
      [0, 1, "rgba(0,0,0,0.018)"],
      [1, 1, "rgba(255,255,255,0.016)"],
    ].forEach(([cx, cy, tinte]) => {
      ctx.fillStyle = tinte as string;
      ctx.fillRect((cx as number) * L, (cy as number) * L, L, L);
    });

    // La junta: una ranura oscura con su reborde claro. Sin el reborde se ve
    // como una raya pintada; con él, como un canto biselado.
    ctx.strokeStyle = "rgba(46, 44, 40, 0.55)";
    ctx.lineWidth = 7;
    [0, L, 2048].forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p, 0); ctx.lineTo(p, 2048);
      ctx.moveTo(0, p); ctx.lineTo(2048, p);
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    [0, L, 2048].forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p - 5, 0); ctx.lineTo(p - 5, 2048);
      ctx.moveTo(0, p - 5); ctx.lineTo(2048, p - 5);
      ctx.stroke();
    });

    (matPiso.albedoTexture as DynamicTexture).update();
  }

  matPiso.albedoTexture!.wrapU = Texture.WRAP_ADDRESSMODE;
  matPiso.albedoTexture!.wrapV = Texture.WRAP_ADDRESSMODE;
  // Menos repeticiones porque cada una trae ya cuatro baldosas: 6 × 5 sobre
  // los 8,8 × 7,4 m da baldosas de unos 73 cm, que es la medida comercial.
  (matPiso.albedoTexture as Texture).uScale = 6;
  (matPiso.albedoTexture as Texture).vScale = 5;
  // Rugosidad muy baja: es la que convierte la luminaria en una franja larga
  // sobre el suelo. Por encima de 0,15 el reflejo se disuelve y el piso vuelve
  // a parecer hormigón pintado.
  // 0,16 y no 0,09. A 0,09 el piso devolvía la sala como un espejo de baño y
  // el reflejo competía con lo reflejado. El porcelanato pulido difumina algo
  // lo que devuelve: se sigue viendo el hall en el suelo, pero desenfocado,
  // que es lo que lo hace leer como piedra y no como agua.
  matPiso.roughness = 0.16;
  matPiso.metallic = 0;

  const piso = MeshBuilder.CreateGround(
    "pisoHall",
    { width: ANCHO_SALA, height: Z_FONDO - Z_ESPALDA },
    scene
  );
  piso.position.set(0, 0, (Z_FONDO + Z_ESPALDA) / 2);
  piso.material = matPiso;
  piso.receiveShadows = true;

  // --- Muros ---------------------------------------------------------------
  //
  // Pintura mate clara. En el hall real es beige o gris claro; acá tira a frío
  // porque de noche todo lo blanco recoge el color de la luz que le llega, y
  // la que llega es la de las luminarias y la del monitor.
  const matMuro = new PBRMaterial("matMuroHall", scene);
  // YESO PINTADO, no un color plano.
  //
  // Estaba con albedo liso, y un color plano sobre una superficie de ocho
  // metros es lo que hace que una pared se lea como cartón: no tiene ninguna
  // información: ni el grano del rodillo, ni la suciedad que se acumula
  // abajo, ni el roce de los muebles.
  //
  // Va SIN repetir (una sola vuelta sobre los 8,8 m) a propósito. Una textura
  // repetida muchas veces sube la frecuencia y vuelve el hormigueo de las
  // jambas; a un texel por centímetro no hay nada que pueda hervir.
  matMuro.albedoTexture = materialPintado(
    scene,
    "texYesoMuro",
    1024,
    1024,
    (ctx, w, h) => {
      // PLANO Y UNIFORME, sin gradiente ni manchas grandes.
      //
      // Antes llevaba un degradado vertical —más sucio abajo— y ciento treinta
      // manchas suaves. Las dos cosas estaban mal, y por el mismo motivo:
      //
      // En Babylon CADA CARA de una caja recibe el rango completo de la
      // textura. Así que el degradado no caía hacia el suelo: caía de arriba
      // abajo DE CADA CARA, fuera cual fuera su tamaño y su orientación. Un muro
      // largo lo estiraba a ocho metros, una jamba lo comprimía en dieciocho
      // centímetros y el techo lo recibía tumbado. Por eso las paredes parecían
      // de estilos distintos: cada una mostraba un trozo distinto de la misma
      // imagen.
      //
      // Y las manchas, con tan poco contraste entre ellas, no se leían como
      // pintura sino como humedad.
      //
      // Una pared pintada de verdad es CASI uniforme. La variación que se ve en
      // ella no está en la pintura: la ponen las lámparas. Así que la textura se
      // limita a dar el grano finísimo del rodillo, que es lo único que impide
      // que la superficie se vea como plástico, y todo lo demás lo hace la luz.
      ctx.fillStyle = "#74767a";
      ctx.fillRect(0, 0, w, h);

      // Grano del rodillo: puntos diminutos y muy tenues, repartidos por igual.
      // A un texel por centímetro esto no se distingue de cerca; lo que hace es
      // romper el color plano para que la luz no resbale como sobre un plástico.
      for (let i = 0; i < 5200; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.035)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
      }
    }
  ).albedoTexture;
  matMuro.roughness = 0.86;
  matMuro.metallic = 0;
  // SIN TEXTURA DE MICRORRELIEVE. Aquí estaba el hervor de las jambas.
  //
  // Llevaba texturaGrano modulando el brillo, y en la cara grande del muro no
  // molesta: son 256 píxeles de ruido repartidos en ocho metros y medio, o sea
  // una variación lentísima.
  //
  // El problema es que en Babylon CADA CARA de una caja recibe el rango
  // completo de la textura. Así que en la jamba —la cara de canto, de dieciocho
  // centímetros— esos mismos 256 píxeles de ruido se comprimen en esos
  // dieciocho centímetros. Vista casi de perfil, que es como se ve siempre una
  // jamba, eso son cientos de tejeles por píxel: moiré, y cambia con cada
  // movimiento de la cámara.
  //
  // Explica lo que se veía y lo que no: las paredes grandes nunca hormiguearon
  // y los bordes de los huecos sí. Y explica que empeorara al retrasar las
  // hojas del ascensor, porque eso dejó MÁS jamba a la vista.
  //
  // Una pared pintada mate no pierde nada con rugosidad constante: el grano no
  // se apreciaba de todos modos a esta distancia.

  const matZocalo = new PBRMaterial("matZocaloHall", scene);
  matZocalo.albedoColor = new Color3(0.13, 0.13, 0.145);
  // Sube de 0,35. Un zócalo lacado brilla, pero es una tira de doce
  // centímetros vista casi de canto: el peor caso posible para el brillo
  // especular. Con algo más de rugosidad el reflejo se reparte en vez de
  // concentrarse en una línea de un píxel.
  matZocalo.roughness = 0.52;
  matZocalo.metallic = 0.1;

  const largo = Z_FONDO - Z_ESPALDA;
  const centroZ = (Z_FONDO + Z_ESPALDA) / 2;

  [-1, 1].forEach((lado) => {
    const muro = MeshBuilder.CreateBox(
      `MuroLateralHall_${lado > 0 ? "d" : "i"}`,
      { width: 0.16, height: ALTO_SALA, depth: largo },
      scene
    );
    muro.position.set((lado * ANCHO_SALA) / 2, ALTO_SALA / 2, centroZ);
    muro.material = matMuro;
    muro.receiveShadows = true;

    // Zócalo: el remate oscuro donde el muro toca el suelo. Es una caja de
    // doce centímetros y hace más por el realismo que casi cualquier otra
    // pieza — sin él, muro y piso se juntan en una arista limpia que ningún
    // edificio construido tiene.
    const zocalo = MeshBuilder.CreateBox(
      `ZocaloHall_${lado > 0 ? "d" : "i"}`,
      { width: 0.04, height: 0.12, depth: largo },
      scene
    );
    zocalo.position.set((lado * (ANCHO_SALA - 0.18)) / 2, 0.06, centroZ);
    zocalo.material = matZocalo;
    zocalo.receiveShadows = true;
  });

  // Muro de la espalda del conserje. La cámara no gira lo suficiente para
  // verlo, pero la sonda de reflejos sí lo ve: sin él, el piso reflejaría el
  // vacío por detrás y se abriría un agujero negro en el suelo.
  const espalda = MeshBuilder.CreateBox(
    "MuroEspaldaHall",
    { width: ANCHO_SALA, height: ALTO_SALA, depth: 0.16 },
    scene
  );
  espalda.position.set(0, ALTO_SALA / 2, Z_ESPALDA);
  espalda.material = matMuro;
  espalda.receiveShadows = true;

  // --- Techo ---------------------------------------------------------------
  //
  // Cielo falso de placas de 60 cm, que es lo que lleva un hall de condominio.
  // La retícula se pinta en vez de modelarse: a tres metros y vista siempre en
  // escorzo, la diferencia no se aprecia y ahorra doscientas cajas.
  const matTecho = materialPintado(scene, "matTechoHall", 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#c9c7c2";
    ctx.fillRect(0, 0, w, h);

    // Poro de la placa mineral: puntitos irregulares, muy tenues.
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = `rgba(150,148,143,${0.06 + Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }

    // Perfilería vista, en T. La sombra al costado es lo que la levanta del
    // plano: sin ella la retícula se lee como una raya dibujada.
    ctx.strokeStyle = "rgba(96,94,90,0.5)";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(224,222,218,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });

  matTecho.albedoTexture!.wrapU = Texture.WRAP_ADDRESSMODE;
  matTecho.albedoTexture!.wrapV = Texture.WRAP_ADDRESSMODE;
  (matTecho.albedoTexture as Texture).uScale = 14;
  (matTecho.albedoTexture as Texture).vScale = 12;
  matTecho.roughness = 0.94;
  matTecho.metallic = 0;

  const techo = MeshBuilder.CreateGround(
    "TechoHall",
    { width: ANCHO_SALA, height: largo },
    scene
  );
  techo.position.set(0, ALTO_SALA, centroZ);
  // El suelo mira hacia arriba; girado media vuelta, mira hacia abajo.
  techo.rotation.z = Math.PI;
  techo.material = matTecho;
}

/**
 * Luminarias empotradas del cielo falso.
 *
 * ─── POR QUÉ SEIS PANELES Y SOLO DOS LÁMPARAS ─────────────────────────────
 *
 * Porque cada luz real cuesta en cada cuadro y cada panel emisivo es gratis.
 * Los seis paneles se VEN encendidos —y se reflejan en el piso, que es lo que
 * de verdad importa— pero solo dos emiten luz de verdad, colocadas para cubrir
 * el mesón y el fondo del hall.
 *
 * Nadie mira un techo y cuenta cuántas de las luminarias que ve están
 * iluminando. Lo que se nota es que el sitio está alumbrado y que el suelo
 * devuelve las franjas, y eso lo dan los paneles.
 *
 * ─── Y POR QUÉ A MEDIA POTENCIA ───────────────────────────────────────────
 *
 * Es la iluminación de noche de un edificio: la suficiente para trabajar y
 * para que el hall no parezca abandonado, no la de las diez de la mañana. Deja
 * sitio para que el flexo siga siendo la luz que manda sobre el libro, que es
 * donde ocurre el nivel.
 */
function construirLuminarias(scene: Scene): void {
  // ─── LAS LUMINARIAS ───────────────────────────────────────────────────────
  //
  // Eran un rectángulo blanco liso dentro de un marco negro, y por eso se veían
  // como pegatinas: un panel LED real no emite de forma uniforme.
  //
  // Lo que le faltaba, por orden de lo que más se nota:
  //
  //  1. EL DIFUSOR. La placa de plástico que reparte la luz no es lisa: tiene
  //     un prismado fino que se ve como una retícula, y se ve MÁS donde más luz
  //     hay. Sin él, el panel es un rectángulo de color plano.
  //
  //  2. LA CAÍDA HACIA LOS BORDES. Los diodos van repartidos por dentro pero el
  //     marco come luz en el perímetro: un panel siempre está más claro por el
  //     centro. Un blanco uniforme de borde a borde no lo hace ninguna lámpara.
  //
  //  3. EL CANTO DEL MARCO. Un panel de techo está EMPOTRADO: tiene un grosor y
  //     ese grosor recibe luz por dentro y sombra por fuera.
  const matPanel = new PBRMaterial("matPanelLuminaria", scene);
  matPanel.albedoColor = new Color3(0, 0, 0);
  // Blanco neutro tirando a cálido: el LED de 4000 K que se usa en halls.
  matPanel.emissiveColor = new Color3(1, 0.94, 0.82);
  matPanel.roughness = 1;
  matPanel.metallic = 0;
  matPanel.emissiveTexture = materialPintado(
    scene,
    "texDifusorLuminaria",
    512,
    128,
    (ctx, w, h) => {
      // Caída del centro a los bordes, en las dos direcciones.
      const luz = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.62);
      luz.addColorStop(0, "#fff6e6");
      luz.addColorStop(0.55, "#f7ead3");
      luz.addColorStop(1, "#d8c9ac");
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, w, h);

      // Prismado del difusor: retícula fina, más marcada en el centro, que es
      // donde la luz que la atraviesa la revela.
      ctx.strokeStyle = "rgba(120, 108, 86, 0.16)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 7) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Las dos filas de diodos, insinuadas por detrás del difusor. No se ven
      // como puntos —para eso está el difusor— pero sí como dos franjas algo
      // más claras, que es exactamente lo que se aprecia mirando un panel.
      [0.33, 0.67].forEach((t) => {
        const fila = ctx.createLinearGradient(0, h * t - 10, 0, h * t + 10);
        fila.addColorStop(0, "rgba(255,255,255,0)");
        fila.addColorStop(0.5, "rgba(255,255,255,0.2)");
        fila.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = fila;
        ctx.fillRect(0, h * t - 10, w, 20);
      });

      // Borde: el canto del marco tapa los diodos de la orilla.
      ctx.strokeStyle = "rgba(60, 52, 38, 0.45)";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    }
  ).albedoTexture as Texture;

  const matMarco = new PBRMaterial("matMarcoLuminaria", scene);
  matMarco.albedoColor = new Color3(0.2, 0.2, 0.21);
  matMarco.roughness = 0.35;
  matMarco.metallic = 0.55;

  // Cara interior del cajón, que recibe el rebote del difusor. Es lo que hace
  // que el marco no sea una línea negra alrededor de un rectángulo blanco.
  const matGarganta = new PBRMaterial("matGargantaLuminaria", scene);
  matGarganta.albedoColor = new Color3(0.72, 0.7, 0.66);
  matGarganta.roughness = 0.85;
  matGarganta.metallic = 0;

  const posiciones: [number, number][] = [
    [-1.9, 0.4],
    [1.9, 0.4],
    [-1.9, 2.2],
    [1.9, 2.2],
    [-1.9, 4.0],
    [1.9, 4.0],
  ];

  posiciones.forEach(([x, z], i) => {
    // Cajón empotrado: el marco por fuera y la garganta por dentro, algo más
    // arriba, para que el panel quede retranqueado y tenga canto.
    const marco = MeshBuilder.CreateBox(
      `luminariaMarcoHall_${i}`,
      { width: 1.28, height: 0.075, depth: 0.38 },
      scene
    );
    marco.position.set(x, ALTO_SALA - 0.028, z);
    marco.material = matMarco;

    const garganta = MeshBuilder.CreateBox(
      `luminariaGargantaHall_${i}`,
      { width: 1.2, height: 0.05, depth: 0.3 },
      scene
    );
    garganta.position.set(x, ALTO_SALA - 0.022, z);
    garganta.material = matGarganta;

    const panel = MeshBuilder.CreateGround(
      `luminariaPanelHall_${i}`,
      { width: 1.16, height: 0.27 },
      scene
    );
    panel.position.set(x, ALTO_SALA - 0.05, z);
    panel.rotation.z = Math.PI;
    panel.material = matPanel;

  });

  // Las que sí alumbran, Y EN EL SITIO DONDE ESTÁN LAS LÁMPARAS.
  //
  // Estaban las tres en x = 0, o sea en el eje de la sala. Pero las seis
  // luminarias van en x = ±1,9: la luz salía justo del hueco entre ellas, del
  // trozo de techo donde no hay nada. Se veía, y con razón — dos manchas de luz
  // en mitad del plafón con las lámparas a los lados.
  //
  // Ahora son cuatro, una por columna de luminarias a cada lado y repartidas en
  // profundidad. Cada mancha de luz sale de una lámpara que está ahí.
  //
  // Cuatro y no seis por el tope de ocho luces por material: con la de relleno,
  // el flexo y la de la pantalla, seis dejarían fuera a alguna. Cuatro bien
  // colocadas alumbran igual que seis, porque el techo es bajo y los conos se
  // solapan.
  [
    { x: -1.9, z: 1.1 },
    { x: 1.9, z: 1.1 },
    { x: -1.9, z: 3.4 },
    { x: 1.9, z: 3.4 },
  ].forEach((p, i) => {
    const luz = new PointLight(
      `luzTechoHall_${i}`,
      new Vector3(p.x, ALTO_SALA - 0.1, p.z),
      scene
    );
    luz.diffuse = new Color3(1, 0.95, 0.86);
    luz.specular = new Color3(1, 0.97, 0.92);
    // Repartida entre cuatro: cada una aporta menos, pero el conjunto cubre
    // mejor y sin el efecto de foco que daban tres muy separadas.
    luz.intensity = 4.6;
    luz.range = 9;
  });
}

/**
 * Reflejos reales: el piso devuelve la sala.
 *
 * ─── DOS COSAS DISTINTAS, PORQUE HACEN FALTA LAS DOS ──────────────────────
 *
 * 1. La SONDA (ReflectionProbe) fotografía la sala en un cubo y se la entrega
 *    a la escena entera como entorno. Sin ella, todo lo metálico —el flexo, el
 *    bisel del monitor, la carcasa de la radio— refleja la nada y sale negro,
 *    que es el aspecto de plástico barato que tienen los metales en 3D cuando
 *    nadie les dice qué hay alrededor.
 *
 *    Se dibuja UNA sola vez, al arrancar. La sala está quieta: refrescarla en
 *    cada cuadro sería pagar seis renderizados por fotograma para obtener
 *    siempre la misma imagen.
 *
 * 2. El ESPEJO (MirrorTexture) es el reflejo del suelo, y es plano: devuelve
 *    las luminarias como franjas verticales que se estiran hacia la cámara.
 *    La sonda no puede darlo —un cubo no sabe de planos— y es justamente lo
 *    que hace que un piso se lea como pulido y no como gris claro.
 *
 *    Este sí se dibuja cada cuadro, pero a media resolución y con desenfoque:
 *    un reflejo de porcelanato nunca es nítido, así que la falta de definición
 *    no solo no molesta, es lo correcto.
 */
function montarReflejos(scene: Scene): void {
  const piso = scene.getMeshByName("pisoHall");
  if (!piso) return;

  // Todo lo que no sea el propio suelo entra en el reflejo.
  // startsWith y no comparación exacta: ahora la calle es varias mallas, no
  // una. Todas empiezan por "calleExterior" justamente para que este filtro y
  // el de sombras las cacen sin tener que enumerarlas.
  // Lo mismo con los sitios del circuito cerrado ("cctv…"): no están en la sala.
  const reflejables = scene.meshes.filter(
    (m) => m !== piso && !m.name.startsWith("calleExterior") && !m.name.startsWith("cctv")
  );

  // --- 1. Entorno -----------------------------------------------------------
  const sonda = new ReflectionProbe("sondaPuesto", 256, scene);
  sonda.position = new Vector3(0, 1.5, 1.2);
  reflejables.forEach((m) => sonda.renderList!.push(m));
  // Cero significa "dibújate una vez y no vuelvas": la sala no se mueve, así
  // que refrescarla cada cuadro sería pagar seis renderizados por fotograma
  // para obtener siempre exactamente la misma imagen.
  sonda.refreshRate = 0;

  // El entorno se enchufa DESPUÉS de que la sonda se haya dibujado.
  //
  // Si se asigna antes —que es lo que parece natural, y era lo que había—,
  // cada material que la sonda dibuja dentro de sí misma intenta leer la
  // misma textura que la sonda está escribiendo en ese momento. WebGL no lo
  // permite y aborta el draw:
  //
  //   GL_INVALID_OPERATION: glDrawElements: Feedback loop formed between
  //   Framebuffer and active Texture
  //
  // Son seis caras de cubo por cada malla de la lista, así que la consola se
  // llena de cientos de errores en el primer fotograma y los objetos que
  // caen en ellos se dibujan mal.
  //
  // Esperar un fotograma lo resuelve entero: la sonda se dibuja sin entorno
  // —no hay nada que leer, no hay bucle— y el entorno queda puesto para todo
  // lo que venga después. Lo único que se pierde es el rebote del entorno
  // sobre sí mismo dentro del cubo, que a 256 píxeles y de noche no se ve.
  scene.onAfterRenderObservable.addOnce(() => {
    scene.environmentTexture = sonda.cubeTexture;
    // Bajo, porque es de noche: el entorno tiene que dar forma a los metales,
    // no iluminar la escena por su cuenta.
    scene.environmentIntensity = 0.35;
  });

  // --- 2. Espejo del suelo --------------------------------------------------
  // 1024 y no 512.
  //
  // El reflejo del piso se dibuja en su propia textura, y a 512 píxeles esa
  // textura tiene bastante menos resolución que la pantalla: al mover la
  // cámara, lo reflejado va saltando de píxel en píxel y tiembla justo donde
  // el suelo se junta con la pared, que es donde el reflejo se ve más
  // comprimido por el ángulo rasante.
  //
  // Es la segunda causa del parpadeo en esa línea, aparte del reptado de la
  // oclusión: las dos se notan en el mismo sitio porque las dos fallan por
  // lo mismo, calcular a menos resolución de la que se muestra.
  const espejo = new MirrorTexture("espejoPiso", 1024, scene, true);
  // El plano del suelo, mirando hacia arriba. La distancia es 0 porque el
  // suelo está exactamente en y = 0.
  espejo.mirrorPlane = new Plane(0, -1, 0, 0);
  espejo.renderList = reflejables;
  // Desenfoque adaptativo: difumina más cuanto más lejos, que es como se
  // comporta un reflejo real sobre un suelo. Sin desenfoque el porcelanato
  // sale como un espejo de baño y se ve peor, no mejor.
  espejo.adaptiveBlurKernel = 26;
  espejo.level = 0.42;

  const matPiso = piso.material as PBRMaterial;
  matPiso.reflectionTexture = espejo;
}

/**
 * Sube el tope de luces por material.
 *
 * Babylon compila cada material para un número fijo de luces —cuatro por
 * defecto— y las que sobran simplemente no se calculan, en silencio. Con el
 * relleno, las dos del techo, el monitor, el flexo y la farola son seis, así
 * que sin esto el mesón perdería dos y nadie diría por qué.
 *
 * Se hace al final, cuando ya existen todos los materiales.
 */
function ampliarLucesPorMaterial(scene: Scene): void {
  scene.materials.forEach((mat) => {
    if (!(mat instanceof PBRMaterial)) return;
    // Diez y no ocho: el libro y lo que hay junto al flexo suman la luz
    // rebotada, y el piso del hall la que entra por el ventanal al amanecer.
    // Con ocho alguna se descartaría en silencio justo cuando se enciende.
    mat.maxSimultaneousLights = 10;

    // ─── EL HORMIGUEO DE LAS SUPERFICIES PULIDAS ──────────────────────
    //
    // Esto es lo que quita el parpadeo de la puerta del ascensor, del zócalo
    // y del marco de la puerta del hall.
    //
    // Las tres tienen en común que son lisas y metálicas —rugosidad de un
    // tercio— y el muro, que está a 0,82, no parpadea nunca. Ese contraste es
    // lo que señala la causa, y descarta las que ya se probaron: no es la
    // oclusión, ni el reflejo del piso, ni el grano, ni el antialiasing de
    // bordes. Ninguna de ésas distingue entre pulido y rugoso.
    //
    // En una superficie pulida el brillo especular es muy estrecho: puede
    // caber en menos de un píxel. Al girar la cámara ese brillo cae dentro o
    // fuera del píxel de un fotograma al siguiente, y el píxel salta entre
    // encendido y apagado. Sobre una arista larga y fina —el canto de una
    // hoja de ascensor, una tira de zócalo— se ve como una línea que hierve.
    //
    // No lo arregla el antialiasing de bordes porque no es un borde de
    // geometría: es sombreado por debajo del tamaño del píxel. Lo que hace
    // esta corrección es ensanchar el brillo según lo deprisa que gire la
    // normal en pantalla, de modo que nunca sea más estrecho que el píxel que
    // tiene que mostrarlo. Deja de haber nada que quepa entre dos píxeles.
    mat.enableSpecularAntiAliasing = true;
  });

  // Y filtrado alto en TODAS las texturas de la escena, venga de donde venga.
  //
  // Los ayudantes que fabrican texturas ya lo ponen, pero este barrido cierra
  // el caso general: cualquier textura montada a mano en cualquier sitio
  // queda cubierta sin que haya que acordarse de ponérselo una por una.
  scene.textures.forEach((tex) => {
    if (tex instanceof Texture) tex.anisotropicFilteringLevel = 16;
  });
}

function construirHallYVentanal(scene: Scene): Omit<PiezasExterior, "relleno"> {
  // El piso y los muros laterales los pone construirSala. Acá queda solo lo
  // que mira al exterior: el hueco del ventanal, el cristal, la calle y la
  // farola que entra por él.
  const matMuro = scene.getMaterialByName("matMuroHall") as PBRMaterial;

  // Muro del fondo con el hueco del ventanal.
  // Paño izquierdo, partido para dejar el hueco del ascensor.
  //
  // Los residentes tienen que ir A ALGÚN SITIO. Antes caminaban hacia el muro
  // lateral y se metían dentro de él: no había ascensor, ni puerta, ni nada —
  // simplemente desaparecían atravesando la pared, que es de las cosas que más
  // delatan que un escenario está a medio construir.
  //
  // Va en la pared del fondo y no en la lateral por una razón de encuadre: la
  // cámara solo gira treinta y cinco grados a cada lado, y el muro lateral cae
  // casi fuera de ese arco. Aquí, a la izquierda del ventanal, queda dentro de
  // lo que el jugador puede mirar.
  [
    { nombre: "MuroFondoHall_-1", x: -4.275, ancho: 1.05, alto: 3.2, y: 1.6 },
    { nombre: "JambaAscensorHall", x: -1.925, ancho: 1.05, alto: 3.2, y: 1.6 },
    { nombre: "DintelAscensorHall", x: -3.1, ancho: 1.3, alto: 1.05, y: 2.675 },
  ].forEach((p) => {
    const pieza = MeshBuilder.CreateBox(
      p.nombre,
      { width: p.ancho, height: p.alto, depth: 0.18 },
      scene
    );
    pieza.position.set(p.x, p.y, 4.6);
    pieza.material = matMuro;
    pieza.receiveShadows = true;
  });

  // Paño derecho, partido para dejar el vano de la puerta.
  //
  // Hasta ahora la sala no tenía por dónde entrar. Daba igual mientras no
  // entrara nadie, pero el supervisor de las 03:20 tiene que aparecer por
  // algún sitio, y aparecer de la nada en medio del hall es peor que no
  // aparecer. Un hall de condominio tiene su puerta junto al ventanal, y esta
  // está donde estaría.
  [
    { nombre: "JambaPuertaHall", x: 1.575, ancho: 0.35, alto: 3.2, y: 1.6 },
    { nombre: "MuroFondoHall_1", x: 3.875, ancho: 1.85, alto: 3.2, y: 1.6 },
    { nombre: "DintelPuertaHall", x: 2.35, ancho: 1.2, alto: 1.05, y: 2.675 },
  ].forEach((p) => {
    const pieza = MeshBuilder.CreateBox(
      p.nombre,
      { width: p.ancho, height: p.alto, depth: 0.18 },
      scene
    );
    pieza.position.set(p.x, p.y, 4.6);
    pieza.material = matMuro;
    pieza.receiveShadows = true;
  });

  const dintel = MeshBuilder.CreateBox("MuroDintelHall", { width: 2.8, height: 0.9, depth: 0.18 }, scene);
  dintel.position.set(0, 2.75, 4.6);
  dintel.material = matMuro;

  const antepecho = MeshBuilder.CreateBox("MuroAntepechoHall", { width: 2.8, height: 0.9, depth: 0.18 }, scene);
  antepecho.position.set(0, 0.45, 4.6);
  antepecho.material = matMuro;

  // Acera. Sin ella, al abrirse la puerta se ve el vacío detrás —y al
  // supervisor de pie sobre nada mientras espera para entrar. También tapa el
  // hueco que se veía por debajo del ventanal, donde el suelo del hall
  // terminaba y empezaba el color de fondo.
  const matAcera = new PBRMaterial("matAceraExterior", scene);
  matAcera.albedoColor = new Color3(0.17, 0.17, 0.185);
  matAcera.roughness = 0.88;
  matAcera.metallic = 0;
  // Sin grano, por lo mismo que el muro: es otra pieza grande y de cantos
  // estrechos, y encima se ve en rasante desde dentro del hall.

  // Ancha: ahora se ve también por la puerta de vidrio, en ángulo, y a catorce
  // metros se le veía el borde.
  const acera = MeshBuilder.CreateGround(
    "aceraExterior",
    { width: 160, height: 4.2 },
    scene
  );
  // A ras del hall, no un escalón por debajo.
  //
  // Un umbral con su peldaño sería más fiel, pero la figura que espera fuera
  // para entrar apoya siempre en y = 0: con la acera hundida se quedaría
  // flotando sobre ella, y eso se ve justo cuando la puerta se abre y se mira
  // hacia allá. Vale más un suelo continuo que un detalle que delata al muñeco.
  acera.position.set(0, 0, 6.5);
  acera.material = matAcera;
  acera.receiveShadows = true;

  // Cristal.
  //
  // ─── DE NOCHE, UNA VENTANA ES SOBRE TODO UN ESPEJO ──────────────────
  //
  // Con la sala iluminada y la calle a oscuras, por un cristal casi no se
  // ve el exterior: lo que se ve es el interior devuelto. Estaba montado al
  // revés —transparencia alta y reflejo del entorno al mínimo— y por eso el
  // hueco se leía como un agujero negro en la pared en lugar de como un
  // vidrio. Es el rasgo que más delata la hora del día, y no costaba nada.
  //
  // El reflejo sale de la sonda que ya fotografía la sala para el resto de
  // materiales, así que subirlo aquí no añade ni un pase de dibujado: es
  // decirle a ESTE material que use el entorno más que los demás.
  const matCristal = new PBRMaterial("matCristalVentanal", scene);
  matCristal.albedoColor = new Color3(0.03, 0.04, 0.06);
  matCristal.roughness = 0.04;
  matCristal.metallic = 0.9;
  matCristal.alpha = 0.42;
  matCristal.environmentIntensity = 1.6;
  // Sin esto el reflejo se apagaría por los bordes justo donde el cristal
  // se ve más de canto, que es donde un vidrio real refleja MÁS.
  matCristal.useHorizonOcclusion = false;

  // DOS HOJAS, una a cada lado del montante central.
  //
  // Era un solo paño de 2,8 m que cruzaba por detrás del montante. Como el
  // marco tiene nueve centímetros de canto y el cristal es un plano metido
  // dentro de ese volumen, el montante lo atravesaba: dos superficies en el
  // mismo sitio, sin orden estable de dibujado, y con transparencia encima.
  // Es el mismo fallo que tenía la puerta del hall.
  //
  // Partido en dos, cada hoja se queda en su hueco y no toca nada. Que es,
  // además, cómo se acristala una ventana de dos hojas de verdad.
  const cristales = [-1, 1].map((lado) => {
    const hoja = MeshBuilder.CreatePlane(
      `cristalVentanal_${lado > 0 ? "d" : "i"}`,
      { width: 1.32, height: 1.42 },
      scene
    );
    hoja.position.set(lado * 0.705, 1.6, 4.52);
    hoja.material = matCristal;
    return hoja;
  });
  const cristal = cristales[0];

  // Marco del ventanal.
  //
  // Sin él, el hueco se leía como un rectángulo negro pegado a la pared y no
  // como una ventana. Lo que convierte un agujero en ventana no es lo que se
  // vea al otro lado —de noche, poco— sino el perfil que lo enmarca y el
  // travesaño que lo parte: son las dos cosas que el ojo busca para
  // reconocerlo.
  const matMarcoVentanal = new PBRMaterial("matMarcoVentanal", scene);
  matMarcoVentanal.albedoColor = new Color3(0.22, 0.23, 0.25);
  matMarcoVentanal.roughness = 0.36;
  matMarcoVentanal.metallic = 0.78;
  matMarcoVentanal.albedoTexture = texturaMetalCepillado(scene);

  [
    { n: "marcoVentanalSup", w: 2.9, h: 0.09, x: 0, y: 2.34 },
    { n: "marcoVentanalInf", w: 2.9, h: 0.09, x: 0, y: 0.86 },
    { n: "marcoVentanalIzq", w: 0.09, h: 1.58, x: -1.45, y: 1.6 },
    { n: "marcoVentanalDer", w: 0.09, h: 1.58, x: 1.45, y: 1.6 },
    // Montante central. Es el que de verdad hace el trabajo: parte el hueco en
    // dos hojas y le da escala a lo que hay detrás.
    { n: "marcoVentanalCentro", w: 0.07, h: 1.5, x: 0, y: 1.6 },
  ].forEach((p) => {
    const m = MeshBuilder.CreateBox(
      p.n,
      { width: p.w, height: p.h, depth: 0.09 },
      scene
    );
    m.position.set(p.x, p.y, 4.55);
    m.material = matMarcoVentanal;
  });

  // --- Alféizar y vierteaguas ----------------------------------------------
  //
  // Una ventana no acaba en el marco: por dentro tiene una repisa y por
  // fuera una pieza inclinada que echa el agua para afuera. Son los dos
  // detalles que hacen que el hueco se lea como algo CONSTRUIDO —con su
  // grosor de muro— y no como un dibujo pegado a la pared.
  //
  // Y aportan lo que aquí más falta: una superficie horizontal justo bajo el
  // cristal, que recoge la luz de la farola de la calle y marca el borde
  // inferior. Sin ella, el ventanal se disuelve en el muro por abajo.
  const matAlfeizar = new PBRMaterial("matAlfeizarVentanal", scene);
  matAlfeizar.albedoColor = new Color3(0.3, 0.3, 0.31);
  matAlfeizar.roughness = 0.62;
  matAlfeizar.metallic = 0;

  const alfeizar = MeshBuilder.CreateBox(
    "alfeizarVentanal",
    { width: 3.02, height: 0.045, depth: 0.26 },
    scene
  );
  alfeizar.position.set(0, 0.845, 4.44);
  alfeizar.material = matAlfeizar;
  alfeizar.receiveShadows = true;

  // Por fuera, con caída. La inclinación es poca —cinco grados bastan— pero
  // es lo que hace que atrape un brillo distinto al del alféizar de dentro.
  const vierteaguas = MeshBuilder.CreateBox(
    "vierteaguasVentanal",
    { width: 3.02, height: 0.04, depth: 0.2 },
    scene
  );
  vierteaguas.position.set(0, 0.83, 4.72);
  vierteaguas.rotation.x = -0.09;
  vierteaguas.material = matMarcoVentanal;

  // Junquillo: el listón fino que sujeta el vidrio contra el marco. Es una
  // pieza de dos centímetros que nadie mira, y sin la cual el cristal parece
  // flotar dentro del hueco en vez de estar montado en él.
  const matJunquillo = new PBRMaterial("matJunquilloVentanal", scene);
  matJunquillo.albedoColor = new Color3(0.15, 0.155, 0.17);
  matJunquillo.roughness = 0.55;
  matJunquillo.metallic = 0.4;

  [
    { w: 2.86, h: 0.022, x: 0, y: 2.295 },
    { w: 2.86, h: 0.022, x: 0, y: 0.905 },
    { w: 0.022, h: 1.4, x: -1.418, y: 1.6 },
    { w: 0.022, h: 1.4, x: 1.418, y: 1.6 },
  ].forEach((p, i) => {
    const j = MeshBuilder.CreateBox(
      `junquilloVentanal_${i}`,
      { width: p.w, height: p.h, depth: 0.03 },
      scene
    );
    j.position.set(p.x, p.y, 4.495);
    j.material = matJunquillo;
  });

  // La calle ya no es un plano pintado detrás del vidrio: la construye la
  // atmósfera del turno con profundidad real. Ver CalleExterior.

  montarLluviaEnCristal(scene, cristal);

  // Poste de la farola.
  //
  // Es el objeto que hace que el ventanal deje de ser un fondo pintado. Un
  // plano lejano, por bien pintado que esté, no da profundidad: hace falta
  // algo SÓLIDO entre el cristal y ese fondo, y a seis metros el poste cruza
  // justo la parte del hueco que se ve desde la silla.
  const matFarola = new PBRMaterial("matPosteFarola", scene);
  matFarola.albedoColor = new Color3(0.08, 0.085, 0.095);
  matFarola.roughness = 0.55;
  matFarola.metallic = 0.6;

  const poste = MeshBuilder.CreateCylinder(
    "posteFarola",
    { diameterTop: 0.09, diameterBottom: 0.13, height: 3.4, tessellation: 12 },
    scene
  );
  poste.position.set(1.6, 1.7, 6.4);
  poste.material = matFarola;

  const brazo = MeshBuilder.CreateBox(
    "brazoFarola",
    { width: 0.46, height: 0.07, depth: 0.07 },
    scene
  );
  brazo.position.set(1.4, 3.38, 6.4);
  brazo.material = matFarola;

  // La luminaria: una caja oscura con la cara de abajo encendida. El bulbo
  // emisivo importa más que el poste — es lo que dice de dónde sale el halo.
  const matBulbo = new PBRMaterial("matBulboFarola", scene);
  matBulbo.albedoColor = new Color3(0, 0, 0);
  matBulbo.emissiveColor = new Color3(1, 0.86, 0.6);
  matBulbo.roughness = 1;

  const carcasa = MeshBuilder.CreateBox(
    "carcasaFarola",
    { width: 0.42, height: 0.09, depth: 0.24 },
    scene
  );
  carcasa.position.set(1.2, 3.32, 6.4);
  carcasa.material = matFarola;

  const bulbo = MeshBuilder.CreateGround(
    "bulboFarola",
    { width: 0.36, height: 0.19 },
    scene
  );
  bulbo.position.set(1.2, 3.27, 6.4);
  bulbo.rotation.z = Math.PI;
  bulbo.material = matBulbo;

  // Farola: la luz que entra por el ventanal y recorta las siluetas del hall.
  const farola = new SpotLight(
    "luzFarola",
    new Vector3(1.6, 3.4, 6.4),
    new Vector3(-0.35, -1, -0.72),
    1.5,
    3,
    scene
  );
  farola.diffuse = new Color3(1, 0.86, 0.62);
  farola.intensity = 26;

  // Acotada a lo que hay fuera.
  //
  // Es una farola de la calle: alumbra la acera y la fachada de enfrente, y
  // lo que entre por el ventanal ya lo aporta el resto. Contarla también para
  // los muros, el suelo y el mobiliario del hall gastaba uno de los ocho
  // huecos de luz por material sin aportar nada apreciable — y ese hueco hace
  // falta para la cuarta luminaria del techo.
  farola.includedOnlyMeshes = scene.meshes.filter(
    (m) => m.name.startsWith("calle") || m.name.startsWith("acera") || m.name.startsWith("farola")
  );

  return {
    cristal: matCristal,
    farola,
    bulboFarola: matBulbo,
    posicionBulbo: bulbo.position.clone(),
  };
}

/**
 * El ascensor del hall.
 *
 * Cabina, dos hojas correderas e indicador de piso. No es adorno: es el sitio
 * al que van los residentes, y hasta que existió no tenían ninguno — cruzaban
 * el hall y se metían dentro del muro.
 *
 * ─── POR QUÉ HAY CABINA Y NO SOLO UNAS PUERTAS ────────────────────────────
 *
 * Porque una figura que se apaga justo en el plano de la puerta se ve tan mal
 * como una que atraviesa la pared. Con la cabina detrás, el residente ENTRA,
 * se queda dentro, las hojas se cierran y recién entonces deja de dibujarse.
 * Ya no desaparece: se va, que es distinto.
 *
 * La cabina es una caja cerrada con su plafón encendido dentro. Cuesta seis
 * planos y es lo que se ve cada vez que las puertas se abren.
 */
interface Ascensor {
  pedirAbierto(quien: string): void;
  soltar(quien: string): void;
  /** Delante de las puertas, en el hall. */
  readonly frente: Vector3;
  /** Dentro de la cabina. */
  readonly dentro: Vector3;
}

function construirAscensor(scene: Scene): Ascensor {
  const X = -3.1;
  const ANCHO = 1.3;
  const ALTO = 2.15;
  /** Cara interior del muro del fondo. */
  const Z_MURO = 4.69;
  const FONDO_CABINA = 5.5;

  const matAcero = new PBRMaterial("matAceroAscensor", scene);
  matAcero.albedoColor = new Color3(0.52, 0.54, 0.57);
  // EL ASCENSOR SALÍA NEGRO, y la causa es de manual.
  //
  // Un material metálico no tiene color difuso: todo lo que muestra es lo que
  // REFLEJA. Y lo que hay para reflejar aquí es la sonda de entorno de la
  // sala, que de noche está casi apagada. Metalicidad 0,85 sobre un entorno
  // oscuro da exactamente lo que se veía: una plancha negra.
  //
  // Bajando a 0,55 y subiendo el albedo, parte de la superficie vuelve a ser
  // difusa y recoge la luz de las lámparas. Sigue leyéndose como acero —el
  // cepillado y el brillo siguen ahí— pero deja de depender de un entorno que
  // no existe. Es el compromiso de siempre en interiores nocturnos.
  matAcero.roughness = 0.4;
  matAcero.metallic = 0.55;
  matAcero.environmentIntensity = 1.1;
  matAcero.albedoTexture = texturaMetalCepillado(scene);

  const matCabina = new PBRMaterial("matCabinaAscensor", scene);
  matCabina.albedoColor = new Color3(0.2, 0.2, 0.22);
  matCabina.roughness = 0.42;
  matCabina.metallic = 0.35;

  // --- Cabina ---------------------------------------------------------------
  const centroZ = (Z_MURO + FONDO_CABINA) / 2;
  const hondo = FONDO_CABINA - Z_MURO;
  [
    { n: "cabinaFondoHall", w: ANCHO, h: ALTO, d: 0.06, x: X, y: ALTO / 2, z: FONDO_CABINA },
    // Las paredes de la cabina, APARTADAS del hueco.
    //
    // Estaban centradas en el borde del vano (x = ±0,65 desde el eje), o sea
    // que la mitad de cada una asomaba DENTRO del hueco y la otra mitad se
    // enterraba en el muro. Eso metía una tercera pieza en un borde donde ya
    // competían la jamba y la hoja.
    //
    // Nueve centímetros más afuera y arrancando por detrás de las hojas: la
    // cabina queda donde tiene que estar —al otro lado— y el borde del hueco
    // deja de tener nada que la dispute.
    { n: "cabinaIzqHall", w: 0.06, h: ALTO, d: hondo, x: X - ANCHO / 2 - 0.09, y: ALTO / 2, z: centroZ },
    { n: "cabinaDerHall", w: 0.06, h: ALTO, d: hondo, x: X + ANCHO / 2 + 0.09, y: ALTO / 2, z: centroZ },
    { n: "cabinaTechoHall", w: ANCHO, h: 0.06, d: hondo, x: X, y: ALTO, z: centroZ },
    { n: "cabinaSueloHall", w: ANCHO, h: 0.04, d: hondo, x: X, y: 0.02, z: centroZ },
  ].forEach((p) => {
    const m = MeshBuilder.CreateBox(p.n, { width: p.w, height: p.h, depth: p.d }, scene);
    m.position.set(p.x, p.y, p.z);
    m.material = matCabina;
    m.receiveShadows = true;
  });

  // Plafón de la cabina. Es emisivo y no una lámpara de verdad: la escena ya
  // lleva seis luces y esta se ve dos veces en todo el turno.
  const matPlafon = new PBRMaterial("matPlafonAscensor", scene);
  matPlafon.albedoColor = new Color3(0, 0, 0);
  matPlafon.emissiveColor = new Color3(0.95, 0.92, 0.84);
  matPlafon.roughness = 1;
  const plafon = MeshBuilder.CreateGround(
    "cabinaPlafonHall",
    { width: ANCHO - 0.24, height: hondo - 0.24 },
    scene
  );
  plafon.position.set(X, ALTO - 0.05, centroZ);
  plafon.rotation.z = Math.PI;
  plafon.material = matPlafon;

  // ═══ PORTAL DEL ASCENSOR ══════════════════════════════════════════════════
  //
  // Rehecho entero, y con esto se resuelve además el hervor del borde.
  //
  // ─── EL PROBLEMA ERA EL CANTO DE OBRA ─────────────────────────────────────
  //
  // El muro tiene dieciocho centímetros de espesor y las hojas iban al fondo
  // del hueco, así que entre la cara del hall y la hoja quedaba a la vista todo
  // ese canto. Una superficie así se ve SIEMPRE casi de perfil —es su
  // definición—, y en rasante un píxel de movimiento de cámara barre medio
  // metro de superficie: todo lo que se calcule por píxel se desestabiliza.
  //
  // Y resulta que un ascensor de verdad no tiene ese canto a la vista. El hueco
  // va forrado: un portal de acero que cubre jambas y dintel, y las hojas
  // corriendo justo detrás, dentro del propio espesor del muro. Arreglar el
  // diseño arregla el defecto, que es la mejor clase de arreglo que hay.
  //
  // Canto visible: cuatro centímetros y medio en vez de dieciocho. Y los cuatro
  // son cara de acero del portal, no hormigón.

  const Z_CARA = 4.51;

  // Mismo criterio que las hojas: metalicidad moderada para que el portal
  // recoja la luz de la sala en vez de depender del reflejo del entorno.
  const matPortal = new PBRMaterial("matPortalAscensor", scene);
  matPortal.albedoColor = new Color3(0.6, 0.61, 0.63);
  matPortal.roughness = 0.38;
  matPortal.metallic = 0.6;
  matPortal.environmentIntensity = 1.1;

  // Jambas y dintel. Montados a caballo sobre la cara del muro —sobresalen un
  // centímetro y se meten tres— para que ninguna de sus caras comparta plano
  // con ninguna del muro.
  const CANTO = 0.12;
  [
    { n: "portalAscensorIzq", w: CANTO, h: ALTO + CANTO, x: X - ANCHO / 2 - CANTO / 2 + 0.03, y: (ALTO + CANTO) / 2 },
    { n: "portalAscensorDer", w: CANTO, h: ALTO + CANTO, x: X + ANCHO / 2 + CANTO / 2 - 0.03, y: (ALTO + CANTO) / 2 },
    { n: "portalAscensorSup", w: ANCHO + CANTO * 2 - 0.06, h: CANTO, x: X, y: ALTO + CANTO / 2 - 0.03 },
  ].forEach((p) => {
    const m = MeshBuilder.CreateBox(p.n, { width: p.w, height: p.h, depth: 0.04 }, scene);
    m.position.set(p.x, p.y, Z_CARA - 0.01);
    m.material = matPortal;
  });

  // Umbral. La chapa del suelo entre el hall y la cabina, con sus guías. Es la
  // pieza que remata el conjunto por abajo y la que delata que ahí hay un hueco
  // por el que se pasa, no un panel pegado a la pared.
  const umbral = MeshBuilder.CreateBox(
    "portalAscensorUmbral",
    { width: ANCHO + 0.04, height: 0.02, depth: 0.16 },
    scene
  );
  umbral.position.set(X, 0.012, Z_CARA + 0.06);
  umbral.material = matPortal;

  const matGuia = new PBRMaterial("matGuiaAscensor", scene);
  matGuia.albedoColor = new Color3(0.1, 0.1, 0.11);
  matGuia.roughness = 0.5;
  matGuia.metallic = 0.6;
  [-1, 1].forEach((lado) => {
    const guia = MeshBuilder.CreateBox(
      `portalAscensorGuia_${lado > 0 ? "d" : "i"}`,
      { width: ANCHO + 0.04, height: 0.006, depth: 0.012 },
      scene
    );
    guia.position.set(X, 0.023, Z_CARA + 0.06 + lado * 0.035);
    guia.material = matGuia;
  });

  // Botonera de llamada, en la jamba derecha. Dos pulsadores: subir y bajar.
  const matPlaca = new PBRMaterial("matPlacaAscensor", scene);
  matPlaca.albedoColor = new Color3(0.3, 0.31, 0.33);
  matPlaca.roughness = 0.34;
  matPlaca.metallic = 0.9;

  const placa = MeshBuilder.CreateBox(
    "portalAscensorPlaca",
    { width: 0.09, height: 0.2, depth: 0.012 },
    scene
  );
  placa.position.set(X + ANCHO / 2 + 0.16, 1.08, Z_CARA - 0.02);
  placa.material = matPlaca;

  const matPulsador = new PBRMaterial("matPulsadorAscensor", scene);
  matPulsador.albedoColor = new Color3(0.05, 0.05, 0.06);
  matPulsador.emissiveColor = new Color3(0.5, 0.42, 0.22);
  matPulsador.roughness = 0.4;
  [0.045, -0.045].forEach((dy, i) => {
    const boton = MeshBuilder.CreateCylinder(
      `portalAscensorPulsador_${i}`,
      { diameter: 0.035, height: 0.008, tessellation: 16 },
      scene
    );
    boton.rotation.x = Math.PI / 2;
    boton.position.set(X + ANCHO / 2 + 0.16, 1.08 + dy, Z_CARA - 0.028);
    boton.material = matPulsador;
  });

  // Indicador de piso, embutido en el dintel dentro de su propia placa oscura.
  // Antes flotaba suelto sobre el marco; ahora es parte del conjunto.
  const marcoInd = MeshBuilder.CreateBox(
    "portalAscensorMarcoInd",
    { width: 0.26, height: 0.14, depth: 0.02 },
    scene
  );
  marcoInd.position.set(X, ALTO + CANTO + 0.08, Z_CARA - 0.015);
  marcoInd.material = matPortal;

  const matIndicador = new PBRMaterial("matIndicadorAscensor", scene);
  matIndicador.albedoColor = new Color3(0, 0, 0);
  // Enciende tenue en reposo en lugar de quedarse apagado del todo: un panel
  // negro no se lee como indicador, se lee como un rectángulo pintado.
  matIndicador.emissiveColor = new Color3(0.3, 0.34, 0.42);
  matIndicador.roughness = 1;
  const indicador = MeshBuilder.CreatePlane(
    "indicadorAscensorHall",
    { width: 0.19, height: 0.085 },
    scene
  );
  indicador.position.set(X, ALTO + CANTO + 0.08, Z_CARA - 0.027);
  indicador.material = matIndicador;

  // --- La luz del hueco -----------------------------------------------------
  //
  // El ascensor está en x = -3,1 y las luminarias del techo van por el centro
  // de la sala: el hueco quedaba en el borde del reparto, apagado y plano,
  // justo el sitio por el que entran y salen todos los residentes del turno.
  // Con foco propio deja de ser un hueco en la pared y pasa a ser un sitio.
  //
  // Va apuntando a la pared, no al suelo: un bañador rasante saca el relieve
  // del marco de acero y del retranqueo de las hojas, que es lo que da
  // volumen. Apuntándolo al piso solo se conseguiría una mancha redonda.
  const bañador = new SpotLight(
    "luzAscensorHall",
    new Vector3(X, ALTO_SALA - 0.25, 4.05),
    new Vector3(0, -0.55, 1),
    1.5,
    3,
    scene
  );
  bañador.diffuse = new Color3(1, 0.96, 0.89);
  bañador.specular = new Color3(1, 0.98, 0.94);
  bañador.intensity = 5.4;
  bañador.range = 3.4;

  // Solo ilumina lo suyo.
  //
  // Cada material admite ocho luces a la vez y la sala ya va justa. Acotando
  // este foco a las mallas del ascensor, el resto de la escena ni siquiera lo
  // cuenta: no le quita el sitio a ninguna de las que sí tienen que llegar al
  // mesón. Y de paso no derrama luz sobre el muro del ventanal, que está al
  // lado y debe seguir en penumbra.
  // --- Hojas ----------------------------------------------------------------
  //
  // Van detrás de la cara del muro. Al abrirse se meten por detrás de los
  // paños de pared, que es donde se esconden las de verdad: sin ese retranqueo
  // se verían deslizarse por delante de la pared como dos placas sueltas.
  // LAS HOJAS SON MÁS ANCHAS QUE EL HUECO. Aquí estaba el parpadeo.
  //
  // Medían exactamente el vano: sus cantos caían en x = −3,75 y x = −2,45, que
  // son justo los bordes del hueco del muro. Y aunque las hojas estén un
  // centímetro por detrás, en pantalla ESE BORDE Y EL DEL HUECO CAEN SOBRE LOS
  // MISMOS PÍXELES.
  //
  // Cuando dos siluetas coinciden así, el píxel del borde está cubierto en
  // parte por las dos, y cuál gana depende de por dónde pase exactamente el
  // canto dentro de ese píxel. Al girar la cámara eso cambia sin parar, y el
  // borde hierve. No es profundidad, ni material, ni sombra: por eso no lo
  // arreglaba nada de lo que se tocó antes.
  //
  // El solape lo resuelve por construcción, y es cómo se monta un ascensor de
  // verdad: las hojas son más anchas que el vano y quedan escondidas tras el
  // muro. Así el único canto que se ve es el del hueco —una sola silueta— y no
  // hay nada con lo que competir.
  const SOLAPE = 0.09;
  const ANCHO_HOJA = ANCHO / 2 + SOLAPE;

  const hojas = [-1, 1].map((lado) => {
    const hoja = MeshBuilder.CreateBox(
      `hojaAscensorHall_${lado > 0 ? "d" : "i"}`,
      { width: ANCHO_HOJA, height: ALTO, depth: 0.05 },
      scene
    );

    // Se corren hacia afuera media anchura de solape, para que sigan juntándose
    // en el centro del hueco al cerrarse.
    const cerrada = X + lado * (ANCHO / 4 + SOLAPE / 2);

    // DENTRO DEL ESPESOR DEL MURO, justo detrás del portal.
    //
    // El muro va de z 4,51 a 4,69 y la hoja de 4,545 a 4,595: queda metida en
    // su espesor. Eso cumple las dos cosas a la vez, que es lo que no se
    // conseguía moviéndolas hacia delante o hacia atrás:
    //
    //   · Cerrada, está a tres centímetros y medio del portal, así que casi no
    //     queda canto a la vista. Antes eran dieciocho.
    //   · Abierta, corre hacia el lado y queda ENTERRADA en el muro, que en esa
    //     zona es macizo. Se esconde sin necesidad de estar al fondo.
    hoja.position.set(cerrada, ALTO / 2, 4.57);
    hoja.material = matAcero;
    return { malla: hoja, lado, cerrada };
  });

  // El foco se acota AQUÍ y no al crearlo, porque las hojas se construyen
  // justo arriba: filtrando antes, las dos piezas que más se miran del
  // ascensor —las que se abren— habrían quedado fuera de su propia luz.
  bañador.includedOnlyMeshes = scene.meshes.filter(
    (m) =>
      m.name.includes("Ascensor") ||
      m.name.includes("ascensor") ||
      m.name.startsWith("cabina") ||
      m.name.startsWith("portalAscensor") ||
      m.name.startsWith("indicadorAscensor")
  );

  const RECORRIDO = ANCHO / 2 + 0.04;
  let abierto = 0;
  const pidiendo = new Set<string>();

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const objetivo = pidiendo.size > 0 ? 1 : 0;
    const resto = objetivo - abierto;
    if (Math.abs(resto) > 0.001) {
      // Las puertas de ascensor van lentas y parejas, sin acelerón ni frenazo.
      abierto += Math.sign(resto) * Math.min(Math.abs(resto), dt * 0.9);
      hojas.forEach((h) => {
        h.malla.position.x = h.cerrada + h.lado * RECORRIDO * abierto;
      });
    }
    // El indicador acompaña a la puerta: encendido con ella abierta.
    matIndicador.emissiveColor.set(
      0.12 + abierto * 0.7,
      0.12 + abierto * 0.62,
      0.14 + abierto * 0.2
    );
  });

  return {
    pedirAbierto(quien) {
      pidiendo.add(quien);
    },
    soltar(quien) {
      pidiendo.delete(quien);
    },
    frente: new Vector3(X, 0, 3.85),
    dentro: new Vector3(X, 0, 5.05),
  };
}

/**
 * La puerta de acceso al hall.
 *
 * Hoja acristalada con marco de aluminio, de las que lleva cualquier
 * condominio: perfil delgado, travesaño a media altura, tirador vertical
 * largo y brazo cierrapuertas arriba.
 *
 * ─── POR QUÉ GIRA SOBRE UN NODO Y NO SOBRE SÍ MISMA ───────────────────────
 *
 * Una malla gira alrededor de su centro, y una puerta que gira sobre su centro
 * atraviesa el muro con medio batiente. El eje va en un nodo colocado sobre el
 * gozne, y la hoja cuelga de él desplazada media hoja: así el borde del gozne
 * se queda quieto y el resto barre, que es lo que hace una puerta.
 *
 * Abre hacia DENTRO, que es como abren las puertas de hall — hacia fuera darían
 * en la vereda.
 */
export interface PuertaHall {
  /** Pide que se abra y la mantiene abierta hasta que ese mismo soltar(). */
  pedirAbierta(quien: string): void;
  soltar(quien: string): void;
}

function construirPuertaHall(scene: Scene): PuertaHall {
  // MISMO CASO QUE LAS HOJAS DEL ASCENSOR, y por eso las mismas cotas raras.
  //
  // El vano de la puerta va de x = 1,75 a x = 2,95, que son las caras de las
  // dos jambas. Con la hoja midiendo 1,20 y el gozne en 2,95, el marco
  // ocupaba EXACTAMENTE ese hueco: sus dos cantos caían sobre el plano de
  // las jambas, y encima el marco está metido en el canto del muro. Dos
  // caras compartiendo plano en el mismo tramo es lo que hace hervir el
  // borde al girar la cámara.
  //
  // Con 1,16 de ancho y el gozne en 2,93 la hoja va de 1,77 a 2,93: dos
  // centímetros de holgura por cada lado, sin tocar ninguna jamba. Que es
  // además como se monta un marco de verdad — nadie encaja una puerta a
  // medida exacta del hueco, se deja holgura y luego se remata.
  const ANCHO = 1.16;
  const ALTO = 2.15;
  const X_GOZNE = 2.93;

  const eje = new TransformNode("ejePuertaHall", scene);
  eje.position.set(X_GOZNE, 0, 4.6);

  const matPerfil = new PBRMaterial("matPerfilPuerta", scene);
  matPerfil.albedoColor = new Color3(0.2, 0.21, 0.23);
  matPerfil.roughness = 0.34;
  matPerfil.metallic = 0.82;
  matPerfil.albedoTexture = texturaMetalCepillado(scene);

  const matVidrio = new PBRMaterial("matVidrioPuerta", scene);
  matVidrio.albedoColor = new Color3(0.05, 0.06, 0.08);
  matVidrio.roughness = 0.06;
  matVidrio.metallic = 0.55;
  matVidrio.alpha = 0.3;

  // DOS PAÑOS DE CRISTAL, uno a cada lado del travesaño.
  //
  // Antes era un solo paño de lado a lado, y ahí estaba el parpadeo. Los
  // perfiles tienen cinco centímetros de canto y el cristal poco más de uno,
  // así que el cristal quedaba METIDO dentro del volumen de los perfiles: el
  // travesaño del medio lo atravesaba entero y los montantes se le solapaban
  // un centímetro por cada lado.
  //
  // Dos superficies ocupando el mismo sitio no tienen un orden estable de
  // dibujado, y al girar la cámara la tarjeta gráfica va cambiando cuál
  // queda delante. Con el cristal translúcido encima, eso se ve como un
  // parpadeo en la hoja de la puerta.
  //
  // Partirlo en dos paños es además cómo está hecha una puerta de verdad:
  // el travesaño no cruza por delante del vidrio, separa dos vidrios.
  const HUECO = 0.07;
  const Y_TRAVESANO = 0.98;
  const CANTO_TRAVESANO = 0.09;

  // Cada paño se queda dentro del hueco del marco, sin llegar a tocarlo.
  const panos: [number, number][] = [
    // [centro en Y, alto]
    [
      (HUECO + (Y_TRAVESANO - CANTO_TRAVESANO / 2)) / 2,
      Y_TRAVESANO - CANTO_TRAVESANO / 2 - HUECO - 0.01,
    ],
    [
      (Y_TRAVESANO + CANTO_TRAVESANO / 2 + (ALTO - HUECO)) / 2,
      ALTO - HUECO - (Y_TRAVESANO + CANTO_TRAVESANO / 2) - 0.01,
    ],
  ];

  panos.forEach(([y, alto], i) => {
    const pano = MeshBuilder.CreateBox(
      `cristalPuertaHall_${i}`,
      { width: ANCHO - 0.14, height: alto, depth: 0.012 },
      scene
    );
    // Un centímetro hacia la calle: el marco queda resaltado por dentro,
    // como en una puerta real, y de paso ninguna cara del cristal comparte
    // plano con ninguna cara del perfil.
    pano.position.set(-ANCHO / 2, y, 0.01);
    pano.material = matVidrio;
    pano.parent = eje;
  });

  // Marco: cuatro perfiles y un travesaño. El travesaño importa más de lo que
  // parece — es lo que impide que la hoja se lea como una lámina de vidrio
  // suelta y la convierte en una puerta.
  const perfiles: [number, number, number, number][] = [
    [-ANCHO / 2, ALTO - 0.03, ANCHO, 0.06],
    [-ANCHO / 2, 0.03, ANCHO, 0.06],
    [-0.03, ALTO / 2, 0.06, ALTO],
    [-ANCHO + 0.03, ALTO / 2, 0.06, ALTO],
    [-ANCHO / 2, 0.98, ANCHO, 0.09],
  ];
  perfiles.forEach(([x, y, ancho, alto], i) => {
    const p = MeshBuilder.CreateBox(
      `perfilPuertaHall_${i}`,
      { width: ancho, height: alto, depth: 0.05 },
      scene
    );
    p.position.set(x, y, 0);
    p.material = matPerfil;
    p.parent = eje;
  });

  // Tirador vertical, del lado opuesto al gozne.
  const tirador = MeshBuilder.CreateCylinder(
    "tiradorPuertaHall",
    { diameter: 0.03, height: 0.85, tessellation: 12 },
    scene
  );
  tirador.position.set(-ANCHO + 0.11, 1.05, -0.055);
  tirador.material = matPerfil;
  tirador.parent = eje;

  // Brazo del cierrapuertas. Va fijo al muro, no a la hoja: no gira con ella.
  const brazo = MeshBuilder.CreateBox(
    "cierraPuertaHall",
    { width: 0.26, height: 0.05, depth: 0.05 },
    scene
  );
  brazo.position.set(X_GOZNE - 0.2, ALTO + 0.02, 4.52);
  brazo.material = matPerfil;

  // --- Apertura -------------------------------------------------------------
  //
  // Se guarda el ángulo al que se quiere llegar y cada cuadro se acerca un
  // poco. Es un cierrapuertas hidráulico: nunca da un golpe, siempre llega
  // frenando. Y como es una interpolación y no una animación con duración
  // fija, pedirle que cierre a mitad de la apertura no la hace saltar.
  let objetivo = 0;
  const ABIERTA = -1.35;

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const resto = objetivo - eje.rotation.y;
    if (Math.abs(resto) < 0.002) {
      eje.rotation.y = objetivo;
      return;
    }
    // Abre más rápido de lo que cierra, como el muelle de verdad.
    const rapidez = objetivo < eje.rotation.y ? 5.5 : 2.6;
    eje.rotation.y += resto * Math.min(1, dt * rapidez);
  });

  // ─── QUIÉN LA TIENE ABIERTA ───────────────────────────────────────────
  //
  // Se lleva la cuenta de quién la está pidiendo, no un simple abierta/cerrada.
  // Por el hall pasan el supervisor y los residentes, y con un interruptor
  // suelto el primero que terminara de cruzar cerraría la puerta en las
  // narices del que venía detrás. Con la cuenta, la hoja se cierra cuando la
  // ha soltado el último.
  const pidiendo = new Set<string>();
  const revisar = (): void => {
    objetivo = pidiendo.size > 0 ? ABIERTA : 0;
  };

  return {
    pedirAbierta(quien) {
      pidiendo.add(quien);
      revisar();
    },
    soltar(quien) {
      pidiendo.delete(quien);
      revisar();
    },
  };
}

// ---------------------------------------------------------------------------
// Los residentes
// ---------------------------------------------------------------------------

/**
 * Gente que entra y sale del condominio durante el turno.
 *
 * ─── POR QUÉ HACEN FALTA ──────────────────────────────────────────────────
 *
 * Porque un hall vacío ocho horas seguidas no es un condominio, es un
 * decorado. Y sobre todo porque el conserje no está solo en un edificio
 * abandonado: está en un sitio donde vive gente que llega tarde, que sale a
 * trabajar de madrugada y que pasa por delante del mesón. Esa es la mitad del
 * trabajo que el manual describe —control de acceso— aunque en este escenario
 * todavía no haya que anotarlos.
 *
 * ─── DÓNDE CAEN EN EL TURNO, Y POR QUÉ AHÍ ────────────────────────────────
 *
 * En los huecos. El turno tiene dos tramos largos sin ninguna novedad: de la
 * 01:30 a la fiscalización de las 03:20, y de ahí a las 08:00. Son las horas
 * muertas de cualquier turno de noche, y son también donde el jugador estaría
 * mirando una sala quieta sin nada que hacer.
 *
 * Los residentes las llenan sin inventarse nada: los que llegan tarde a casa
 * caen en la primera parte de la noche, y los que salen a trabajar entre las
 * 06:30 y las 07:35, que es cuando sale la gente a trabajar de verdad. La hora
 * muerta se llena con lo que de hecho pasa a esa hora.
 *
 * Y NINGUNO cruza cerca de las 03:20. No es casualidad: el hall tiene que
 * estar despejado cuando entra el supervisor, porque ese momento es el que
 * carga todo el peso del nivel y no puede competir con nadie.
 */
export interface Residentes {
  /** El turno avanzó un minuto. Decide si a alguien le toca cruzar. */
  enMinuto(minuto: number): void;
}

interface Cruce {
  minuto: number;
  /** Cuál de los vecinos. Índice en VECINOS. */
  vecino: number;
  /** Entrar desde la calle, o salir del edificio hacia la calle. */
  sentido: "entra" | "sale";
}

/**
 * Los vecinos del edificio.
 *
 * Son personas fijas, no combinaciones al azar. El color de la ropa y la
 * estatura se cuecen al construir la malla, así que no se pueden cambiar a
 * mitad de partida: intentarlo daría un horario que dice una cosa y una figura
 * que se ve de otra.
 *
 * Y tiene sentido que sean fijos. En un condominio se repite la misma gente:
 * quien sale a trabajar a las seis y media es el mismo que ayer, y el conserje
 * lo conoce. Que el jugador reconozca a alguien que ya vio entrar de madrugada
 * vale más que tener veinte desconocidos distintos.
 */
const VECINOS = [
  { paleta: 0, altura: 1.72, velocidad: 1.12 },
  { paleta: 1, altura: 1.63, velocidad: 1.02 },
  { paleta: 2, altura: 1.8, velocidad: 1.24 },
  { paleta: 3, altura: 1.58, velocidad: 0.96 },
];

const CRUCES: Cruce[] = [
  // Primera parte de la noche: los que vuelven a casa.
  { minuto: 12, vecino: 0, sentido: "entra" },
  { minuto: 52, vecino: 1, sentido: "entra" },
  { minuto: 118, vecino: 2, sentido: "entra" },
  // Madrugada: los que salen a trabajar. El 0 y el 2 son los mismos que
  // volvieron de noche; el 3 no se le vio entrar, y tampoco hace falta —
  // llevaba en casa desde antes de que empezara el turno.
  { minuto: 388, vecino: 3, sentido: "sale" },
  { minuto: 424, vecino: 0, sentido: "sale" },
  { minuto: 451, vecino: 2, sentido: "sale" },
];

function montarResidentes(
  scene: Scene,
  puerta: PuertaHall,
  ascensor: Ascensor
): Residentes {
  // Recorrido: la calle, el umbral, el cruce por delante del mesón y el
  // ascensor. Cada punto es un sitio que EXISTE en la escena y que el jugador
  // puede mirar. Nadie se desvanece contra una pared.
  const CALLE = new Vector3(2.35, 0, 6.2);
  const UMBRAL = new Vector3(2.35, 0, 4.15);
  const CRUCE = new Vector3(0.5, 0, 3.1);

  const vecinos = VECINOS.map((v, i) => ({
    figura: crearFigura(scene, `vecino${i}`, {
      paleta: ROPA_RESIDENTE[v.paleta],
      altura: v.altura,
    }),
    velocidad: v.velocidad,
    ocupado: false,
  }));

  function cruzar(cruce: Cruce): void {
    const vecino = vecinos[cruce.vecino];
    // Si ese vecino todavía está cruzando —solo puede pasar adelantando mucho
    // el turno— sencillamente no sale otra vez. Vale más un residente de menos
    // que el mismo hombre duplicado a media sala.
    if (!vecino || vecino.ocupado) return;

    vecino.ocupado = true;
    const { figura, velocidad } = vecino;
    const clave = `vecino_${cruce.vecino}`;

    const terminar = (): void => {
      figura.visible(false);
      puerta.soltar(clave);
      ascensor.soltar(clave);
      vecino.ocupado = false;
    };

    figura.visible(true);

    if (cruce.sentido === "entra") {
      puerta.pedirAbierta(clave);
      figura.situar(CALLE, UMBRAL);
      // Un momento entre que la hoja empieza a abrirse y el residente cruza el
      // vano. Sin esa pausa lo atraviesa cuando todavía está en medio.
      setTimeout(() => {
        figura.caminar([UMBRAL], velocidad, () => {
          // Ya está dentro: la puerta de calle se suelta y se cierra detrás.
          puerta.soltar(clave);
          figura.caminar([CRUCE], velocidad, () => {
            // El ascensor se pide al llegar al cruce, no al final: le da tiempo
            // a abrirse mientras el residente recorre los últimos metros, igual
            // que quien llama al ascensor desde lejos.
            ascensor.pedirAbierto(clave);
            figura.caminar([ascensor.frente, ascensor.dentro], velocidad, () => {
              figura.mirarHacia(new Vector3(ascensor.dentro.x, 0, 0));
              // Las puertas se cierran con él dentro, y recién entonces se deja
              // de dibujar. No desaparece: se va.
              ascensor.soltar(clave);
              setTimeout(terminar, 1600);
            });
          });
        });
      }, 420);
      return;
    }

    // Sale: aparece dentro de la cabina, con las puertas ya abriéndose.
    ascensor.pedirAbierto(clave);
    figura.situar(ascensor.dentro, ascensor.frente);
    setTimeout(() => {
      figura.caminar([ascensor.frente, CRUCE], velocidad, () => {
        ascensor.soltar(clave);
        // Se pide la puerta de calle AL LLEGAR al cruce, por lo mismo.
        puerta.pedirAbierta(clave);
        figura.caminar([UMBRAL, CALLE], velocidad, terminar);
      });
    }, 900);
  }

  let siguiente = 0;

  return {
    enMinuto(minuto) {
      // Se recorre hacia delante y nunca hacia atrás: con el turno adelantado
      // pueden vencer varios minutos de golpe, y ninguno debe perderse ni
      // repetirse.
      while (siguiente < CRUCES.length && CRUCES[siguiente].minuto <= minuto) {
        cruzar(CRUCES[siguiente]);
        siguiente += 1;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// La visita de las 03:20
// ---------------------------------------------------------------------------

/**
 * El supervisor entra, camina hasta el mesón y después se va.
 *
 * ─── POR QUÉ ESTO NO PODÍA SER UN PANEL ───────────────────────────────────
 *
 * La fiscalización es el momento del nivel: es cuando todo lo que el jugador
 * escribió mal en silencio sale a la luz. Hasta ahora llegaba como un cartel
 * que aparecía encima del libro, y un cartel no llega: se muestra. La
 * diferencia entre las dos cosas es la diferencia entre que te fiscalicen y
 * que te avisen de que te fiscalizaron.
 *
 * ─── Y POR QUÉ EL LIBRO SE APARTA ─────────────────────────────────────────
 *
 * Porque el libro ocupa la pantalla entera sobre un velo opaco. Si el
 * supervisor caminara con el libro abierto, caminaría detrás de una cortina y
 * no lo vería nadie. Así que el orden es: se cierra el libro, se ve entrar al
 * supervisor, y el panel de reparos aparece cuando ya está delante del mesón.
 * Cuando se cierra el panel, se le ve irse.
 *
 * ─── LA CÁMARA GIRA SOLA, Y SE DEVUELVE ───────────────────────────────────
 *
 * El jugador podría estar mirando la radio cuando se abre la puerta y perderse
 * la entrada entera. Durante la secuencia el control del ratón se suelta y la
 * cámara gira hacia la puerta, como giraría cualquiera al oír entrar a alguien
 * a las tres de la mañana. Al terminar se devuelve el control exactamente
 * donde estaba: la cámara no se queda enganchada ni salta de vuelta.
 */
export interface Supervisor {
  /** Entra por la puerta y camina al mesón. Avisa al llegar. */
  llegar(alPlantarse: () => void): void;
  /** Da media vuelta y se va. */
  retirarse(): void;
}

function montarSupervisor(scene: Scene, camara: FreeCamera, puerta: PuertaHall): Supervisor {
  const figura = crearFigura(scene, "supervisor", { paleta: UNIFORME_SUPERVISOR, altura: 1.78 });

  // Fuera, en la vereda, esperando. Nunca se le ve ahí: la puerta está cerrada
  // y el muro tapa, pero tiene que existir en algún sitio antes de entrar.
  const FUERA = new Vector3(2.35, 0, 6.1);
  const UMBRAL = new Vector3(2.35, 0, 4.2);
  const MEDIO = new Vector3(1.5, 0, 2.5);
  const ANTE_MESON = new Vector3(0.62, 0, 1.18);
  /** Dónde está la cara del guardia, que es a lo que mira al plantarse. */
  const OJOS_GUARDIA = new Vector3(0, ALTURA_OJO, -0.62);

  figura.situar(FUERA, UMBRAL);

  // --- Giro asistido de la cámara ------------------------------------------
  let mirandoA: Vector3 | null = null;

  scene.onBeforeRenderObservable.add(() => {
    if (!mirandoA) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const dx = mirandoA.x - camara.position.x;
    const dz = mirandoA.z - camara.position.z;
    const deseado = Math.atan2(dx, dz);
    // Despacio: es un giro de cabeza, no un latigazo de cámara.
    camara.rotation.y += (deseado - camara.rotation.y) * Math.min(1, dt * 2.2);
  });

  function tomarCamara(destino: Vector3): void {
    camara.detachControl();
    mirandoA = destino;
  }

  function devolverCamara(): void {
    mirandoA = null;
    camara.attachControl(true);
  }

  return {
    llegar(alPlantarse) {
      figura.visible(true);
      figura.situar(FUERA, UMBRAL);
      tomarCamara(new Vector3(2.35, 0, 4.6));
      puerta.pedirAbierta("supervisor");

      // Medio segundo entre que la puerta empieza a abrirse y él entra. Sin esa
      // pausa cruza el vano mientras la hoja todavía está en medio.
      setTimeout(() => {
        figura.caminar([UMBRAL, MEDIO, ANTE_MESON], 1.15, () => {
          figura.mirarHacia(OJOS_GUARDIA);
          puerta.soltar("supervisor");
          // Un momento parado antes de que salte el panel: llega, se planta,
          // y entonces habla. Abrir el panel en el mismo cuadro en que se
          // detiene le quita el peso a la llegada entera.
          setTimeout(() => {
            devolverCamara();
            alPlantarse();
          }, 700);
        });
        // La cámara lo sigue de verdad mientras cruza el hall: se le pasa la
        // posición VIVA de la figura, no una copia. Apuntando a un punto fijo
        // la cámara se quedaba mirando el mesón mientras él caminaba fuera de
        // cuadro, que es peor que no girar.
        mirandoA = figura.raiz.position;
      }, 520);
    },

    retirarse() {
      puerta.pedirAbierta("supervisor");
      figura.caminar([MEDIO, UMBRAL, FUERA], 1.15, () => {
        puerta.soltar("supervisor");
        figura.visible(false);
      });
    },
  };
}

/**
 * Lluvia corriendo por el cristal del ventanal.
 *
 * ─── POR QUÉ LLUEVE ───────────────────────────────────────────────────────
 *
 * Porque el turno es del 14 de septiembre en Puerto Montt, y en Puerto Montt
 * en septiembre llueve. No es un efecto puesto por bonito: es la respuesta a
 * dónde y cuándo pasa esto.
 *
 * Y hace por el ventanal lo que ningún fondo pintado consigue. Un cristal
 * limpio es invisible —lo que se ve es lo de detrás— así que el hueco se lee
 * como un agujero. Con agua encima el cristal EXISTE: hay algo entre el hall y
 * la calle, y esa capa es la que convierte el rectángulo en una ventana.
 *
 * ─── CÓMO ESTÁ HECHA ──────────────────────────────────────────────────────
 *
 * Una textura sobre el vidrio con gotas que resbalan. No hay física: cada gota
 * tiene su carril, su velocidad y su tamaño, baja hasta abajo y vuelve a
 * salir arriba. A través de un cristal en penumbra, la diferencia entre eso y
 * una simulación no se ve.
 *
 * Se redibuja a doce cuadros por segundo y no en cada uno. El agua sobre un
 * vidrio se mueve despacio, así que a doce ya va fluida — y el resto del
 * tiempo la GPU se dedica a la escena, que es donde hace falta.
 */
function montarLluviaEnCristal(scene: Scene, cristal: Mesh): void {
  const ANCHO = 512;
  const ALTO = 256;
  const CUADROS_POR_SEGUNDO = 12;

  const textura = new DynamicTexture("texLluviaCristal", { width: ANCHO, height: ALTO }, scene, true);
  const ctx = textura.getContext() as CanvasRenderingContext2D;
  textura.hasAlpha = true;

  const material = cristal.material as PBRMaterial;
  // La lluvia va como EMISIVA y no como color: el agua del cristal no tiene
  // color propio, lo que se ve es la luz de la farola quebrándose en ella. En
  // albedo quedaría como suciedad gris pegada al vidrio.
  material.emissiveTexture = textura;
  material.emissiveColor = new Color3(0.34, 0.39, 0.48);

  interface Gota {
    x: number;
    y: number;
    velocidad: number;
    largo: number;
    grosor: number;
    /** Cuánto se desvía de la vertical mientras baja. */
    deriva: number;
  }

  const nueva = (arriba: boolean): Gota => ({
    x: Math.random() * ANCHO,
    y: arriba ? -Math.random() * ALTO : Math.random() * ALTO,
    velocidad: 14 + Math.random() * 46,
    largo: 8 + Math.random() * 34,
    grosor: 0.8 + Math.random() * 1.8,
    // Ninguna gota baja recta. Sobre un vidrio el agua tantea, se desvía hacia
    // donde encuentra menos resistencia; cuarenta y seis regueros perfectamente
    // verticales se leen como rayas dibujadas, no como agua.
    deriva: (Math.random() - 0.5) * 9,
  });

  // Pocas y espaciadas. Con noventa el cristal se cubría entero y competía con
  // lo que hay detrás, que es justo lo que la ventana tiene que dejar ver.
  const gotas: Gota[] = Array.from({ length: 46 }, () => nueva(false));

  /**
   * Salpicaduras quietas: las que no resbalan y se quedan pegadas.
   *
   * Muy pequeñas y muy tenues. Grandes y numerosas —como estaban— no se leían
   * como agua sino como polvo sobre el vidrio, que es el efecto contrario.
   */
  const quietas = Array.from({ length: 90 }, () => ({
    x: Math.random() * ANCHO,
    y: Math.random() * ALTO,
    r: 0.5 + Math.random() * 1.1,
  }));

  let desdeUltimo = 0;

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    desdeUltimo += dt;
    if (desdeUltimo < 1 / CUADROS_POR_SEGUNDO) return;
    const paso = desdeUltimo;
    desdeUltimo = 0;

    ctx.clearRect(0, 0, ANCHO, ALTO);

    ctx.fillStyle = "rgba(186, 202, 224, 0.3)";
    quietas.forEach((q) => {
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    });

    gotas.forEach((gota, i) => {
      gota.y += gota.velocidad * paso;
      gota.x += gota.deriva * paso;
      if (gota.y - gota.largo > ALTO) gotas[i] = nueva(true);

      // El reguero: más tenue arriba y más marcado en la cabeza de la gota,
      // que es donde se junta el agua.
      const rastro = ctx.createLinearGradient(
        gota.x - gota.deriva * 0.4,
        gota.y - gota.largo,
        gota.x,
        gota.y
      );
      rastro.addColorStop(0, "rgba(190, 205, 225, 0)");
      rastro.addColorStop(1, "rgba(214, 228, 245, 0.72)");
      ctx.strokeStyle = rastro;
      ctx.lineWidth = gota.grosor;
      ctx.beginPath();
      ctx.moveTo(gota.x - gota.deriva * 0.4, gota.y - gota.largo);
      ctx.lineTo(gota.x, gota.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(224, 236, 250, 0.85)";
      ctx.beginPath();
      ctx.arc(gota.x, gota.y, gota.grosor * 0.9, 0, Math.PI * 2);
      ctx.fill();
    });

    textura.update();
  });
}

/**
 * El flexo del mesón: la única luz cálida de la escena, la que da sombras y la
 * única que el guardia puede apagar.
 *
 * ─── POR QUÉ SE REHIZO ────────────────────────────────────────────────────
 *
 * La pantalla estaba montada al revés: el giro dejaba la boca ancha mirando
 * hacia arriba y la punta estrecha hacia el mesón, con la bombilla asomando
 * por la punta y la tapa inferior cerrando el cono. Encendido no se veía
 * encendido: se veía una bola amarilla pegada a un cucurucho.
 *
 * Ahora la cabeza se orienta con un cuaternión desde la dirección real de la
 * luz: la boca apunta exactamente adonde alumbra, por dentro hay un reflector
 * que se enciende con la bombilla, y el brazo es de dos tramos con sus
 * rótulas, como un flexo de arquitecto.
 *
 * ─── Y POR QUÉ APUNTA AL LIBRO ────────────────────────────────────────────
 *
 * El foco anterior caía setenta centímetros a la derecha del libro: la plana
 * quedaba en el borde del cono, justo donde la luz ya se apaga. La cabeza se
 * adelanta sobre el mesón y apunta a la plana con unos treinta y cinco grados
 * de caída: rasante lo justo para que la veta y las rayas del barniz se lean,
 * no tanto como para dejar la página en penumbra. Desde la silla queda a la
 * derecha del monitor, sin tapar ninguna cámara.
 */
export interface Flexo {
  luz: SpotLight;
  /** Enciende o apaga, con la inercia de una lámpara de verdad. */
  alternar(): void;
  /** Deja la lámpara encendida o apagada en el acto, sin rampa ni sonido. */
  fijar(encendido: boolean): void;
  encendido(): boolean;
}

/** Un cilindro tendido entre dos puntos. */
function varilla(
  scene: Scene,
  nombre: string,
  desde: Vector3,
  hasta: Vector3,
  diametro: number,
  material: PBRMaterial
): Mesh {
  const eje = hasta.subtract(desde);
  const pieza = MeshBuilder.CreateCylinder(
    nombre,
    { diameter: diametro, height: eje.length(), tessellation: 14 },
    scene
  );
  pieza.position = desde.add(eje.scale(0.5));
  pieza.rotationQuaternion = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), eje.normalize(), pieza.rotationQuaternion);
  pieza.material = material;
  return pieza;
}

function construirFlexo(scene: Scene): Flexo {
  const X = 0.95;
  const Z = 0.5;
  const Y = ALTO_MESON;

  const LUZ = new Vector3(0.55, Y + 0.42, 0.18);
  const OBJETIVO = new Vector3(-0.02, Y, 0.04);
  const DIRECCION = OBJETIVO.subtract(LUZ).normalize();
  const PIVOTE = new Vector3(X, Y + 0.034, Z);
  const CODO = new Vector3(0.86, Y + 0.33, 0.44);
  const NUCA = LUZ.subtract(DIRECCION.scale(0.105));

  // --- Materiales -----------------------------------------------------------
  const esmalte = new PBRMaterial("matEsmalteFlexo", scene);
  esmalte.albedoColor = new Color3(0.028, 0.03, 0.034);
  esmalte.roughness = 0.38;
  esmalte.metallic = 0;
  // Pintura al horno: el brillo nítido de las luminarias corre por el brazo.
  esmalte.clearCoat.isEnabled = true;
  esmalte.clearCoat.intensity = 0.9;
  esmalte.clearCoat.roughness = 0.1;

  const cromo = new PBRMaterial("matCromoFlexo", scene);
  cromo.albedoColor = new Color3(0.78, 0.78, 0.8);
  cromo.metallic = 1;
  cromo.roughness = 0.18;

  // El interior de la pantalla: blanco reflector que, encendido, brilla más al
  // fondo —donde está la bombilla— que en la boca.
  const reflector = new PBRMaterial("matReflectorFlexo", scene);
  reflector.albedoColor = new Color3(0.86, 0.84, 0.8);
  reflector.roughness = 0.42;
  reflector.metallic = 0.35;
  reflector.emissiveTexture = subirMapa(
    scene,
    "texReflectorFlexo",
    generarDegradadoReflector(64),
    false,
    Texture.CLAMP_ADDRESSMODE
  );
  reflector.emissiveColor = new Color3(0, 0, 0);

  const vidrio = new PBRMaterial("matBombillaFlexo", scene);
  vidrio.albedoColor = new Color3(1, 0.96, 0.88);
  vidrio.roughness = 0.2;
  vidrio.metallic = 0;

  const led = new PBRMaterial("matPilotoFlexo", scene);
  led.albedoColor = new Color3(0.08, 0.04, 0.01);
  led.roughness = 0.3;

  // --- Base -----------------------------------------------------------------
  const base = MeshBuilder.CreateCylinder(
    "baseFlexo",
    { diameterTop: 0.105, diameterBottom: 0.145, height: 0.024, tessellation: 40 },
    scene
  );
  base.position.set(X, Y + 0.012, Z);
  base.material = esmalte;

  const aro = MeshBuilder.CreateTorus("aroBaseFlexo", { diameter: 0.14, thickness: 0.004, tessellation: 40 }, scene);
  aro.position.set(X, Y + 0.002, Z);
  aro.material = cromo;

  const interruptor = MeshBuilder.CreateCylinder(
    "interruptorFlexo",
    { diameter: 0.02, height: 0.012, tessellation: 20 },
    scene
  );
  interruptor.position.set(X - 0.03, Y + 0.028, Z - 0.035);
  interruptor.material = cromo;

  // Piloto del interruptor: la señal de encendido que se ve aunque la cabeza
  // mire hacia otro lado.
  const piloto = MeshBuilder.CreateSphere("pilotoFlexo", { diameter: 0.005, segments: 8 }, scene);
  piloto.position.set(X + 0.028, Y + 0.0245, Z - 0.038);
  piloto.material = led;

  const piezas: Mesh[] = [base, aro, interruptor, piloto];

  // --- Brazo ----------------------------------------------------------------
  const rotula = (nombre: string, punto: Vector3, diametro: number): void => {
    const esfera = MeshBuilder.CreateSphere(nombre, { diameter: diametro, segments: 16 }, scene);
    esfera.position.copyFrom(punto);
    esfera.material = cromo;
    piezas.push(esfera);
  };
  rotula("rotulaBaseFlexo", PIVOTE, 0.024);
  rotula("rotulaCodoFlexo", CODO, 0.022);
  rotula("rotulaNucaFlexo", NUCA, 0.02);

  // Dos varillas paralelas por tramo, como los flexos de verdad.
  const tramo = (nombre: string, a: Vector3, b: Vector3, separacion: number, diametro: number): void => {
    const lateral = Vector3.Cross(b.subtract(a).normalize(), Vector3.Up()).normalize().scale(separacion / 2);
    [-1, 1].forEach((lado) => {
      piezas.push(
        varilla(scene, `${nombre}_${lado}`, a.add(lateral.scale(lado)), b.add(lateral.scale(lado)), diametro, esmalte)
      );
    });
  };
  tramo("brazoInferiorFlexo", PIVOTE, CODO, 0.014, 0.0075);
  tramo("brazoSuperiorFlexo", CODO, NUCA, 0.012, 0.007);
  // El muelle que compensa el peso del brazo.
  piezas.push(
    varilla(
      scene,
      "muelleFlexo",
      PIVOTE.add(new Vector3(0, 0.03, 0.012)),
      Vector3.Lerp(PIVOTE, CODO, 0.7).add(new Vector3(0, 0, 0.012)),
      0.005,
      cromo
    )
  );

  // --- Cabeza ---------------------------------------------------------------
  //
  // El eje del cilindro es la Y local, con la base ancha abajo: se gira la -Y
  // local hacia la dirección de la luz, y la boca queda mirando adonde alumbra.
  const LARGO_CABEZA = 0.125;
  const orientacion = new Quaternion();
  Quaternion.FromUnitVectorsToRef(new Vector3(0, -1, 0), DIRECCION, orientacion);
  const centro = LUZ.add(DIRECCION.scale(0.028 - LARGO_CABEZA / 2));

  const pantalla = MeshBuilder.CreateCylinder(
    "pantallaFlexo",
    { diameterTop: 0.058, diameterBottom: 0.155, height: LARGO_CABEZA, tessellation: 48, cap: Mesh.CAP_END },
    scene
  );
  pantalla.position.copyFrom(centro);
  pantalla.rotationQuaternion = orientacion.clone();
  pantalla.material = esmalte;

  // Por dentro, una segunda superficie con las caras hacia el eje: es la que se
  // ve al mirar dentro de la boca, y la que se enciende.
  const interior = MeshBuilder.CreateCylinder(
    "interiorFlexo",
    {
      diameterTop: 0.054,
      diameterBottom: 0.149,
      height: LARGO_CABEZA - 0.003,
      tessellation: 48,
      cap: Mesh.CAP_END,
      sideOrientation: Mesh.BACKSIDE,
    },
    scene
  );
  interior.position.copyFrom(centro.subtract(DIRECCION.scale(0.0015)));
  interior.rotationQuaternion = orientacion.clone();
  interior.material = reflector;

  const reborde = MeshBuilder.CreateTorus("rebordeFlexo", { diameter: 0.152, thickness: 0.005, tessellation: 48 }, scene);
  reborde.position.copyFrom(LUZ.add(DIRECCION.scale(0.028)));
  reborde.rotationQuaternion = orientacion.clone();
  reborde.material = cromo;

  const bombilla = MeshBuilder.CreateSphere("bombillaFlexo", { diameter: 0.046, segments: 20 }, scene);
  bombilla.position.copyFrom(LUZ.subtract(DIRECCION.scale(0.035)));
  bombilla.material = vidrio;

  piezas.push(pantalla, interior, reborde, bombilla);

  // --- La luz ---------------------------------------------------------------
  //
  // Un foco y no una bombilla: un PointLight proyecta sombra con un mapa cúbico
  // —seis texturas por cuadro— y a un foco le basta una. Como el flexo alumbra
  // en un cono, el cono además es lo que hace de verdad.
  //
  // Lleva textura de proyección: el reflector reparte la luz en anillos tenues,
  // con el centro algo más cálido y el borde deshecho. Sin ella el charco sobre
  // el mesón es un círculo de borde matemático.
  // Más baja que el 5,2 anterior: ahora la plana cae en el centro del cono y
  // no en su borde, y con el post-proceso por fin enganchado a la cámara la
  // página blanca se quemaba entera.
  const INTENSIDAD = 3.4;
  const luz = new SpotLight("luzFlexo", LUZ.clone(), DIRECCION.clone(), 1.45, 2.2, scene);
  luz.diffuse = new Color3(1, 0.84, 0.62);
  luz.specular = new Color3(1, 0.9, 0.74);
  luz.range = 2.4;
  luz.shadowMinZ = 0.03;
  luz.shadowMaxZ = 2.4;
  luz.projectionTexture = subirMapa(scene, "texHazFlexo", generarHazFlexo(256), false, Texture.CLAMP_ADDRESSMODE);
  luz.projectionTextureLightNear = 0.02;
  luz.projectionTextureLightFar = 2.4;

  // LA LUZ REBOTADA.
  //
  // Lo que el flexo pone sobre la madera vuelve hacia arriba teñido de madera:
  // es lo que calienta el canto del libro, la base del monitor y la tarjeta de
  // claves cuando la lámpara se enciende. Babylon no calcula rebotes, así que
  // se pone a mano: una luz tenue, cálida y sin brillo propio justo sobre el
  // charco. Acotada a lo que hay cerca, y nunca al propio mesón — la madera no
  // se ilumina con su propio reflejo.
  //
  // Hemisférica y mirando hacia abajo, no puntual. La primera versión era un
  // PointLight a siete centímetros del papel, y con la caída física de PBR eso
  // quemaba un círculo blanco en la página. Un rebote no sale de un punto: sale
  // de todo el charco, así que ilumina parejo las caras que miran hacia la
  // mesa —el canto del libro, los costados de la base del monitor— y deja
  // intactas las que miran hacia arriba.
  const INTENSIDAD_REBOTE = 0.4;
  const CHARCO = OBJETIVO.add(new Vector3(0, 0.05, 0));
  const rebote = new HemisphericLight("luzReboteFlexo", new Vector3(0, -1, 0), scene);
  rebote.diffuse = new Color3(1, 0.7, 0.44);
  rebote.groundColor = new Color3(0, 0, 0);
  rebote.specular = new Color3(0, 0, 0);
  rebote.includedOnlyMeshes = scene.meshes.filter((m) => {
    if (/^(tapaMeson|cantoMeson|frenteMeson)/.test(m.name) || m.name.includes("Hall") || m.name.startsWith("calle")) {
      return false;
    }
    m.computeWorldMatrix(true);
    return Vector3.Distance(m.getBoundingInfo().boundingSphere.centerWorld, CHARCO) < 0.95;
  });

  // --- Encender y apagar ------------------------------------------------------
  //
  // No es un interruptor de dos estados: la lámpara tarda un instante en llegar
  // y al apagarse deja un rescoldo de filamento. Son décimas de segundo, y son
  // las que hacen que el clic se note en la luz de la sala.
  let objetivo = 1;
  let nivel = 1;

  const aplicar = (): void => {
    luz.intensity = INTENSIDAD * nivel;
    rebote.intensity = INTENSIDAD_REBOTE * nivel;
    const brillo = Math.pow(nivel, 1.6);
    vidrio.emissiveColor.set(3.2 * brillo, 2.55 * brillo, 1.7 * brillo);
    reflector.emissiveColor.set(0.72 * brillo, 0.58 * brillo, 0.4 * brillo);
    led.emissiveColor.set(1.4 * nivel, 0.55 * nivel, 0.08 * nivel);
  };
  aplicar();

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (nivel === objetivo) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const tau = objetivo > nivel ? 0.07 : 0.16;
    nivel += (objetivo - nivel) * (1 - Math.exp(-dt / tau));
    if (Math.abs(objetivo - nivel) < 0.002) nivel = objetivo;
    aplicar();
  });
  base.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observador));

  const alternar = (): void => {
    objetivo = objetivo > 0.5 ? 0 : 1;
    reproducir("boton");
  };

  // Cualquier pieza de la lámpara la enciende: nadie apunta a un interruptor de
  // dos centímetros al fondo del mesón.
  piezas.forEach((pieza) => {
    pieza.actionManager = new ActionManager(scene);
    pieza.actionManager.hoverCursor = "pointer";
    pieza.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, alternar));
  });

  const fijar = (encendido: boolean): void => {
    objetivo = encendido ? 1 : 0;
    nivel = objetivo;
    aplicar();
  };

  return { luz, alternar, fijar, encendido: () => objetivo > 0.5 };
}