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
  type IWheelEvent,
} from "@babylonjs/core";
import { mostrarPantallaLibro, type SesionLibro } from "./PantallaLibro";
import { crearFigura, UNIFORME_SUPERVISOR, ROPA_RESIDENTE } from "./Figura";
import { crearMonitorCamaras, type MonitorCamaras } from "./MonitorCamaras";
import { crearPaginasLibro, type PaginasLibro } from "./PaginasLibro";
import { CAMARAS_POR_SUCESO } from "./SucesosCondominio";
import { materialPintado, materialPintadoNitido } from "../../entities/ObjetosComunes";
import { texturaGrano, texturaMetalCepillado } from "../../entities/TexturasSuperficie";
import {
  superficieMadera,
  superficieCaucho,
  relievePapel,
} from "./TexturasPuesto";

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

/**
 * Pantalla del monitor: plano vertical mirando al jugador.
 *
 * El horizontal estaba en -1 para compensar que el plano se veía por detrás,
 * girado media vuelta. Ya no se gira (ver construirMonitor), así que se ve la
 * cara frontal y la textura va tal cual.
 */
const ORIENTACION_PANTALLA = { horizontal: 1, vertical: 1 };

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
}

export function crearPuestoConserjeria(
  scene: Scene,
  usuario: string,
  onLibroCompletado?: () => void
): PuestoResult {
  configurarEscenaNocturna(scene);
  const { camara, vista } = montarCamara(scene);

  const monitor = crearMonitorCamaras(scene);
  // Las hojas del libro, que ahora muestran lo escrito de verdad.
  const paginas = crearPaginasLibro(scene);

  const meson = construirMeson(scene);
  const { pantalla } = construirMonitor(scene, monitor);
  montarZoomMonitor(scene, camara, vista);
  const { radio, avisarRadio } = construirRadio(scene);

  // El libro se abre y se cierra las veces que haga falta: la sesión se crea
  // en el primer clic y desde ahí se reabre donde quedó. Sin esto el turno
  // sería un viaje de ida —abrir el libro y no poder volver al puesto—, y el
  // monitor no lo miraría nadie nunca.
  let libro: SesionLibro | null = null;
  // El supervisor se monta más abajo, cuando ya existe la puerta por la que
  // tiene que entrar. Para cuando alguien haga clic en el libro ya está.
  let supervisor: Supervisor | null = null;
  let residentes: Residentes | null = null;

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
          if (toma) monitor.encender(suceso.id, toma.indice, toma.escena, suceso.minuto);
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
        alAvanzarMinuto(minuto) {
          residentes?.enMinuto(minuto);
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
        seEscribe(estado) {
          paginas.pintar(estado);
        },
      }
    );
  });
  construirTablaDeClaves(scene);
  construirSala(scene);
  construirHallYVentanal(scene);
  const puerta = construirPuertaHall(scene);
  // Antes de las sombras y de los reflejos, para que la figura entre en las dos
  // listas: proyecta sombra sobre el piso y se refleja en él como todo lo demás.
  supervisor = montarSupervisor(scene, camara, puerta);
  const ascensor = construirAscensor(scene);
  residentes = montarResidentes(scene, puerta, ascensor);
  construirLuminarias(scene);
  const flexo = construirFlexo(scene);

  montarSombras(scene, flexo);

  // Los reflejos van los ÚLTIMOS: la sonda fotografía la sala y el espejo
  // guarda la lista de lo que refleja, así que todo tiene que existir ya.
  montarReflejos(scene);
  ampliarLucesPorMaterial(scene);

  // La cámara se engancha al final, cuando ya no se va a mover nada más.
  camara.attachControl(true);

  return { meson, pantalla, radio, avisarRadio };
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

  // Proyecta todo lo que está sobre el mesón; el mesón y el piso las reciben.
  scene.meshes.forEach((malla) => {
    const nombre = malla.name;
    const recibe = nombre.includes("Meson") || nombre.includes("Hall") || nombre.includes("Muro");
    if (recibe) {
      malla.receiveShadows = true;
      return;
    }
    // La pantalla y el cristal no proyectan: son planos sin grosor y su sombra
    // saldría como una lámina negra flotando.
    if (nombre.includes("pantalla") || nombre.includes("cristal") || nombre.includes("calle")) return;
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
  // Fuera el amanecer del galpón.
  scene.lights.slice().forEach((luz) => luz.dispose());
  scene.cameras.slice().forEach((camara) => camara.dispose());
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
  relleno.intensity = 0.2;
  relleno.diffuse = new Color3(0.56, 0.56, 0.62);
  relleno.groundColor = new Color3(0.1, 0.11, 0.16);

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

  const tuberia = new DefaultRenderingPipeline("postProcesoPuesto", true, scene, scene.cameras);
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
  tuberia.imageProcessing.exposure = 0.95;
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
  scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
    "oclusionPuesto",
    scene.cameras
  );
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
// Mesón
// ---------------------------------------------------------------------------

function construirMeson(scene: Scene): Mesh {
  const madera = superficieMadera(scene, "texMaderaMeson");

  const matTapa = new PBRMaterial("matTapaMeson", scene);
  matTapa.albedoTexture = madera.color;
  // El relieve es lo que hace que la veta atrape la luz del flexo por un lado
  // y se ensombrezca por el otro. Sin él la madera es una foto sobre plástico.
  matTapa.bumpTexture = madera.relieve;
  matTapa.roughness = 0.38;
  matTapa.metallic = 0.04;
  // Reflejo bajo pero presente: una tapa mate no devuelve nada del monitor y
  // se ve como cartón. Con algo de brillo aparece el resplandor de la pantalla
  // sobre la madera, que es lo que hace creíble un puesto de noche.
  matTapa.reflectivityColor = new Color3(0.24, 0.24, 0.26);

  const tapa = MeshBuilder.CreateBox("tapaMeson", { width: 2.6, height: 0.06, depth: 0.86 }, scene);
  tapa.position.set(0, ALTO_MESON - 0.03, 0.3);
  tapa.material = matTapa;
  tapa.receiveShadows = true;

  // Canto redondeado, hacia el jugador. Es el borde que queda a un palmo de la
  // cámara: si se deja en arista viva, es lo primero que delata que es una caja.
  const canto = MeshBuilder.CreateCylinder(
    "cantoMeson",
    { diameter: 0.06, height: 2.6, tessellation: 20 },
    scene
  );
  canto.rotation.z = Math.PI / 2;
  canto.position.set(0, ALTO_MESON - 0.03, 0.3 - 0.43);
  canto.material = matTapa;

  const matFrente = new PBRMaterial("matFrenteMeson", scene);
  matFrente.albedoColor = new Color3(0.13, 0.1, 0.085);
  matFrente.roughness = 0.7;
  matFrente.metallic = 0;

  const frente = MeshBuilder.CreateBox(
    "frenteMeson",
    { width: 2.6, height: ALTO_MESON - 0.06, depth: 0.05 },
    scene
  );
  frente.position.set(0, (ALTO_MESON - 0.06) / 2, 0.3 - 0.43);
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
  // El material es `unlit` (ver MonitorCamaras): la luz de abajo está a
  // catorce centímetros por delante del cristal, y con un material normal se
  // reflejaba en él y lo tapaba entero con una mancha blanca. Un monitor
  // emite su luz, no la recibe.
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
  pantalla.material = orientar(monitor.material, ORIENTACION_PANTALLA);

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

  const matTapa = new PBRMaterial("matTapaLibro", scene);
  matTapa.albedoColor = new Color3(0.11, 0.075, 0.06);
  matTapa.roughness = 0.78;
  matTapa.metallic = 0;
  matTapa.microSurfaceTexture = texturaGrano(scene, 0.22);

  const tapa = MeshBuilder.CreateBox("tapaLibro", { width: 0.62, height: 0.014, depth: 0.4 }, scene);
  tapa.position.set(X, ALTO_MESON + 0.007, Z);
  tapa.rotation.y = GIRO;
  tapa.material = matTapa;
  tapa.receiveShadows = true;

  // Todo el bloque del libro se abre haciendo clic en cualquiera de sus
  // piezas —tapa, páginas o lomo—, así que el receptor de clics es la tapa,
  // que es la pieza más grande y la que queda debajo de las páginas.
  tapa.actionManager = new ActionManager(scene);
  tapa.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, onAbrir));

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
    pagina.material = matPagina;
    pagina.receiveShadows = true;

    // Las páginas quedan por encima de la tapa en pantalla, así que también
    // necesitan su propio receptor o el clic sobre ellas no llegaría a nada.
    pagina.actionManager = new ActionManager(scene);
    pagina.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, onAbrir));
  });

  // Lomo, algo más alto que las páginas: es lo que hace que se lea como un
  // libro abierto y no como dos hojas sueltas.
  const lomo = MeshBuilder.CreateBox("lomoLibro", { width: 0.02, height: 0.026, depth: 0.4 }, scene);
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
  const matPiso = materialPintado(scene, "matPisoHall", 1024, 1024, (ctx, w, h) => {
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

  matPiso.albedoTexture!.wrapU = Texture.WRAP_ADDRESSMODE;
  matPiso.albedoTexture!.wrapV = Texture.WRAP_ADDRESSMODE;
  (matPiso.albedoTexture as Texture).uScale = 11;
  (matPiso.albedoTexture as Texture).vScale = 9;
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
  matMuro.albedoColor = new Color3(0.42, 0.42, 0.44);
  matMuro.roughness = 0.82;
  matMuro.metallic = 0;
  matMuro.microSurfaceTexture = texturaGrano(scene, 0.16);

  const matZocalo = new PBRMaterial("matZocaloHall", scene);
  matZocalo.albedoColor = new Color3(0.13, 0.13, 0.145);
  matZocalo.roughness = 0.35;
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
  const matPanel = new PBRMaterial("matPanelLuminaria", scene);
  // Blanco neutro tirando a cálido: el LED de 4000 K que se usa en halls.
  matPanel.albedoColor = new Color3(0, 0, 0);
  matPanel.emissiveColor = new Color3(1, 0.94, 0.82);
  matPanel.roughness = 1;
  matPanel.metallic = 0;

  const matMarco = new PBRMaterial("matMarcoLuminaria", scene);
  matMarco.albedoColor = new Color3(0.16, 0.16, 0.17);
  matMarco.roughness = 0.4;
  matMarco.metallic = 0.5;

  const posiciones: [number, number][] = [
    [-1.9, 0.4],
    [1.9, 0.4],
    [-1.9, 2.2],
    [1.9, 2.2],
    [-1.9, 4.0],
    [1.9, 4.0],
  ];

  posiciones.forEach(([x, z], i) => {
    const marco = MeshBuilder.CreateBox(
      `luminariaMarcoHall_${i}`,
      { width: 1.24, height: 0.06, depth: 0.34 },
      scene
    );
    marco.position.set(x, ALTO_SALA - 0.03, z);
    marco.material = matMarco;

    const panel = MeshBuilder.CreateGround(
      `luminariaPanelHall_${i}`,
      { width: 1.16, height: 0.26 },
      scene
    );
    panel.position.set(x, ALTO_SALA - 0.062, z);
    panel.rotation.z = Math.PI;
    panel.material = matPanel;
  });

  // Las que sí alumbran.
  //
  // Antes eran dos, y ninguna coincidía con las seis luminarias del techo:
  // los paneles se veían encendidos en unas coordenadas y la luz salía de
  // otras. El ojo no lo razona, pero lo nota — la sala parecía iluminada por
  // algo que no estaba a la vista.
  //
  // Ahora son tres, una por cada FILA de luminarias, en su misma z. Siguen
  // siendo menos que los paneles porque seis luces reales pasarían del tope
  // de ocho por material y empezarían a caerse de los cálculos; con una por
  // fila el reparto ya se corresponde con lo que se ve encendido.
  [0.4, 2.2, 4.0].forEach((z, i) => {
    const luz = new PointLight(`luzTechoHall_${i}`, new Vector3(0, ALTO_SALA - 0.12, z), scene);
    luz.diffuse = new Color3(1, 0.95, 0.86);
    luz.specular = new Color3(1, 0.97, 0.92);
    // Repartida entre tres en vez de concentrada en dos: el total sube algo,
    // pero sobre todo se reparte, que es lo que quita el efecto de foco.
    //
    // Sube a 5,4 para que la sala se lea bien en una grabación. La noche NO
    // se pierde subiendo las luminarias: se perdería subiendo el rebote o la
    // exposición, que aclaran también lo que no está iluminado. Alimentando
    // las lámparas, lo que crece son los charcos de luz y el contraste entre
    // ellos y el resto — que es precisamente el aspecto de un sitio de noche
    // con las luces encendidas.
    luz.intensity = 5.4;
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
  const reflejables = scene.meshes.filter((m) => m !== piso && m.name !== "calleExterior");

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
    if (mat instanceof PBRMaterial) mat.maxSimultaneousLights = 8;
  });
}

function construirHallYVentanal(scene: Scene): void {
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
  matAcera.microSurfaceTexture = texturaGrano(scene, 0.3);

  const acera = MeshBuilder.CreateGround(
    "aceraExterior",
    { width: 14, height: 4.2 },
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

  // Cristal. Apenas visible, con un reflejo tenue: es lo que separa el adentro
  // del afuera sin tapar lo que pasa al otro lado.
  const matCristal = new PBRMaterial("matCristalVentanal", scene);
  matCristal.albedoColor = new Color3(0.04, 0.05, 0.07);
  matCristal.roughness = 0.05;
  matCristal.metallic = 0.65;
  matCristal.alpha = 0.24;

  const cristal = MeshBuilder.CreatePlane("cristalVentanal", { width: 2.8, height: 1.4 }, scene);
  cristal.position.set(0, 1.6, 4.52);
  cristal.material = matCristal;

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

  // Calle: un plano lejano con la luz de una farola. No hay geometría detrás
  // porque no hace falta — de noche, desde dentro, no se ve más que eso.
  const calle = MeshBuilder.CreatePlane("calleExterior", { width: 9, height: 5 }, scene);
  calle.position.set(0, 2, 8.4);
  calle.material = materialCalleNocturna(scene);

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
  matAcero.albedoColor = new Color3(0.34, 0.35, 0.37);
  matAcero.roughness = 0.3;
  matAcero.metallic = 0.85;
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
    { n: "cabinaIzqHall", w: 0.06, h: ALTO, d: hondo, x: X - ANCHO / 2, y: ALTO / 2, z: centroZ },
    { n: "cabinaDerHall", w: 0.06, h: ALTO, d: hondo, x: X + ANCHO / 2, y: ALTO / 2, z: centroZ },
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

  // --- Marco ----------------------------------------------------------------
  [
    { n: "marcoAscIzqHall", w: 0.08, h: ALTO + 0.08, d: 0.1, x: X - ANCHO / 2 - 0.04, y: ALTO / 2 },
    { n: "marcoAscDerHall", w: 0.08, h: ALTO + 0.08, d: 0.1, x: X + ANCHO / 2 + 0.04, y: ALTO / 2 },
    { n: "marcoAscSupHall", w: ANCHO + 0.16, h: 0.08, d: 0.1, x: X, y: ALTO + 0.04 },
  ].forEach((p) => {
    const m = MeshBuilder.CreateBox(p.n, { width: p.w, height: p.h, depth: p.d }, scene);
    m.position.set(p.x, p.y, 4.64);
    m.material = matAcero;
  });

  // Indicador de piso: la flecha que se enciende cuando el ascensor llega.
  const matIndicador = new PBRMaterial("matIndicadorAscensor", scene);
  matIndicador.albedoColor = new Color3(0, 0, 0);
  // Enciende tenue en reposo en lugar de quedarse apagado del todo: un panel
  // negro no se lee como indicador, se lee como un rectángulo pintado.
  matIndicador.emissiveColor = new Color3(0.3, 0.34, 0.42);
  matIndicador.roughness = 1;
  const indicador = MeshBuilder.CreatePlane(
    "indicadorAscensorHall",
    { width: 0.16, height: 0.1 },
    scene
  );
  indicador.position.set(X, ALTO + 0.2, 4.58);
  indicador.rotation.y = Math.PI;
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
  const hojas = [-1, 1].map((lado) => {
    const hoja = MeshBuilder.CreateBox(
      `hojaAscensorHall_${lado > 0 ? "d" : "i"}`,
      { width: ANCHO / 2, height: ALTO, depth: 0.05 },
      scene
    );
    hoja.position.set(X + (lado * ANCHO) / 4, ALTO / 2, 4.7);
    hoja.material = matAcero;
    return { malla: hoja, lado, cerrada: X + (lado * ANCHO) / 4 };
  });

  // El foco se acota AQUÍ y no al crearlo, porque las hojas se construyen
  // justo arriba: filtrando antes, las dos piezas que más se miran del
  // ascensor —las que se abren— habrían quedado fuera de su propia luz.
  bañador.includedOnlyMeshes = scene.meshes.filter(
    (m) =>
      m.name.includes("Ascensor") ||
      m.name.includes("ascensor") ||
      m.name.startsWith("cabina") ||
      m.name.startsWith("marcoAsc")
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
  const ANCHO = 1.2;
  const ALTO = 2.15;
  const X_GOZNE = 2.95;

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
 * Lo que se ve por el ventanal.
 *
 * ─── DÓNDE HAY QUE PINTAR, Y POR QUÉ IMPORTA TANTO ────────────────────────
 *
 * Un ventanal no enseña todo lo que hay detrás: enseña el cono que dejan pasar
 * su hueco y la posición de quien mira. Desde la silla, por este ventanal, del
 * plano de la calle solo se ve la franja u 0,23–0,77 · v 0,29–0,78. Todo lo
 * que se pinte fuera de ahí no lo verá nadie nunca.
 *
 * En la versión anterior las cinco ventanas encendidas del edificio de
 * enfrente estaban en u 0,12 · 0,18 · 0,31 · 0,84 · 0,90 — LAS CINCO fuera del
 * cono. Lo único que caía dentro era el halo de la farola, y por eso el
 * ventanal se veía como un rectángulo negro con una mancha caliente: no era
 * que faltara contenido, es que estaba pintado donde no se mira.
 *
 * Así que la composición se hace al revés de lo normal: primero se marca la
 * franja visible y dentro de ella se coloca lo que tiene que leerse —el
 * edificio de enfrente, la vereda, el asfalto mojado—. Lo de los bordes es
 * relleno para que no se corte, no contenido.
 */
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

function materialCalleNocturna(scene: Scene): PBRMaterial {
  // La franja que de verdad se ve por el hueco: u 0,23–0,77 · v 0,29–0,78.
  // Solo hacen falta las verticales para componer, porque la fachada y el
  // suelo cruzan el ancho entero; las horizontales quedan de referencia en el
  // comentario de arriba.
  const V0 = 0.29;
  const V1 = 0.78;

  const mat = materialPintado(scene, "matCalleNocturna", 1400, 780, (ctx, w, h) => {
    // --- Cielo ---------------------------------------------------------------
    const cielo = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    cielo.addColorStop(0, "#070a12");
    cielo.addColorStop(1, "#131a2b");
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, w, h);

    // --- Edificio de enfrente -------------------------------------------------
    //
    // Ocupa la mitad alta de la franja visible. Es la pieza que da la escala:
    // sin algo construido al otro lado, el ventanal podría dar a cualquier
    // parte, y un condominio da a otro edificio.
    const yEdificio = h * (V0 - 0.06);
    const altoEdificio = h * (V1 - V0) * 0.62;
    ctx.fillStyle = "#191d29";
    ctx.fillRect(0, yEdificio, w, altoEdificio);

    // Cornisa: una línea clara arriba que lo despega del cielo.
    ctx.fillStyle = "rgba(90, 100, 120, 0.35)";
    ctx.fillRect(0, yEdificio, w, 4);

    // Retícula de ventanas. Cinco filas por doce columnas, repartidas por todo
    // el ancho —el cono visible se lleva las de en medio y el resto rellena—.
    const COLS = 12;
    const FILAS = 5;
    const anchoV = (w / COLS) * 0.46;
    const altoV = (altoEdificio / FILAS) * 0.5;
    /** Cuáles están encendidas. Fijo y no al azar: la fachada no parpadea. */
    const encendidas = new Set(["1,3", "2,6", "2,7", "3,4", "0,8", "3,9", "4,5"]);

    for (let f = 0; f < FILAS; f += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const x = (c + 0.5) * (w / COLS) - anchoV / 2;
        const y = yEdificio + 26 + f * (altoEdificio / FILAS);
        const viva = encendidas.has(`${f},${c}`);

        ctx.fillStyle = viva ? "#ffd58e" : "#0d1119";
        ctx.fillRect(x, y, anchoV, altoV);

        if (viva) {
          // Derrame de la luz sobre la fachada. Es lo que hace que la ventana
          // parezca encendida y no un rectángulo amarillo pegado.
          const g = ctx.createRadialGradient(
            x + anchoV / 2,
            y + altoV / 2,
            2,
            x + anchoV / 2,
            y + altoV / 2,
            anchoV * 2.4
          );
          g.addColorStop(0, "rgba(255, 208, 136, 0.4)");
          g.addColorStop(1, "rgba(255, 208, 136, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x + anchoV / 2, y + altoV / 2, anchoV * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // --- Vereda y calzada ------------------------------------------------------
    const ySuelo = yEdificio + altoEdificio;
    const suelo = ctx.createLinearGradient(0, ySuelo, 0, h);
    suelo.addColorStop(0, "#0f1119");
    suelo.addColorStop(0.3, "#15171f");
    suelo.addColorStop(1, "#0a0c11");
    ctx.fillStyle = suelo;
    ctx.fillRect(0, ySuelo, w, h - ySuelo);

    // Bordillo: la línea que separa vereda de calzada.
    ctx.fillStyle = "rgba(120, 128, 142, 0.22)";
    ctx.fillRect(0, ySuelo + (h - ySuelo) * 0.34, w, 3);

    // --- Farola ----------------------------------------------------------------
    //
    // Cae en u 0,66 · v 0,34, dentro del cono. Se conserva porque era lo único
    // que se veía antes y porque el poste está modelado justo delante: el halo
    // pintado es el resplandor de esa misma lámpara sobre el fondo.
    const halo = ctx.createRadialGradient(w * 0.66, h * 0.34, 8, w * 0.66, h * 0.34, 260);
    halo.addColorStop(0, "rgba(255, 226, 168, 0.8)");
    halo.addColorStop(0.35, "rgba(255, 214, 140, 0.17)");
    halo.addColorStop(1, "rgba(255, 214, 140, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.34, 260, 0, Math.PI * 2);
    ctx.fill();

    // --- Asfalto mojado --------------------------------------------------------
    //
    // Septiembre en Puerto Montt. Cada luz encendida se estira hacia abajo
    // sobre el suelo, que es lo que hace que una calle de noche se lea como
    // mojada. Cuesta cuatro degradados y cambia la escena entera.
    // El reflejo se apaga en el primer tercio del suelo. Llegando abajo del
    // todo, los rastros dejaban de leerse como reflejos y se veían como
    // columnas de luz plantadas en la calzada.
    const reflejar = (x: number, color: string, ancho: number, fuerza: number): void => {
      const largo = (h - ySuelo) * 0.62;
      const g = ctx.createLinearGradient(0, ySuelo, 0, ySuelo + largo);
      g.addColorStop(0, color.replace("ALPHA", String(fuerza)));
      g.addColorStop(0.35, color.replace("ALPHA", String(fuerza * 0.34)));
      g.addColorStop(1, color.replace("ALPHA", "0"));
      ctx.fillStyle = g;
      // Más estrecho abajo que arriba: un reflejo sobre mojado se afila con la
      // distancia, no baja con el mismo ancho.
      ctx.beginPath();
      ctx.moveTo(x - ancho / 2, ySuelo);
      ctx.lineTo(x + ancho / 2, ySuelo);
      ctx.lineTo(x + ancho * 0.18, ySuelo + largo);
      ctx.lineTo(x - ancho * 0.18, ySuelo + largo);
      ctx.closePath();
      ctx.fill();
    };

    reflejar(w * 0.66, "rgba(255, 214, 140, ALPHA)", 150, 0.26);
    encendidas.forEach((clave) => {
      const c = Number(clave.split(",")[1]);
      reflejar((c + 0.5) * (w / COLS), "rgba(255, 208, 136, ALPHA)", 58, 0.1);
    });
  });

  mat.emissiveColor = new Color3(1, 1, 1);
  mat.emissiveTexture = mat.albedoTexture;
  mat.roughness = 1;
  return mat;
}

/** Flexo del mesón. La única luz cálida de la escena, y la que da sombras. */
function construirFlexo(scene: Scene): SpotLight {
  const X = 0.95;
  const Z = 0.5;

  const matMetal = new PBRMaterial("matFlexo", scene);
  matMetal.albedoColor = new Color3(0.08, 0.085, 0.095);
  matMetal.roughness = 0.4;
  matMetal.metallic = 0.6;

  const base = MeshBuilder.CreateCylinder(
    "baseFlexo",
    { diameterTop: 0.1, diameterBottom: 0.14, height: 0.02, tessellation: 22 },
    scene
  );
  base.position.set(X, ALTO_MESON + 0.01, Z);
  base.material = matMetal;

  const brazo = MeshBuilder.CreateCylinder(
    "brazoFlexo",
    { diameter: 0.016, height: 0.42, tessellation: 10 },
    scene
  );
  brazo.position.set(X - 0.07, ALTO_MESON + 0.21, Z - 0.03);
  brazo.rotation.z = 0.34;
  brazo.material = matMetal;

  const pantalla = MeshBuilder.CreateCylinder(
    "pantallaFlexo",
    { diameterTop: 0.06, diameterBottom: 0.15, height: 0.11, tessellation: 22 },
    scene
  );
  pantalla.position.set(X - 0.19, ALTO_MESON + 0.37, Z - 0.07);
  pantalla.rotation.z = 2.5;
  pantalla.material = matMetal;

  const matBombilla = new PBRMaterial("matBombillaFlexo", scene);
  matBombilla.albedoColor = new Color3(1, 0.9, 0.72);
  matBombilla.emissiveColor = new Color3(1.6, 1.25, 0.78);
  matBombilla.roughness = 1;

  const bombilla = MeshBuilder.CreateSphere("bombillaFlexo", { diameter: 0.05, segments: 12 }, scene);
  bombilla.position.set(X - 0.21, ALTO_MESON + 0.33, Z - 0.075);
  bombilla.material = matBombilla;

  // Cálida y de alcance corto: alumbra el libro y poco más. Es la que hace que
  // se pueda escribir, y su contraste contra el azul del monitor es lo que da
  // profundidad a todo el mesón.
  //
  // ─── ES UN FOCO Y NO UNA BOMBILLA, Y ESO IMPORTA ────────────────────────
  //
  // Un PointLight ilumina en todas direcciones y en Babylon proyecta sombra
  // con un mapa cúbico: seis texturas por cuadro, caro y de peor calidad. Un
  // foco alumbra en un cono y le basta una. Como este flexo apunta al libro y
  // a ningún otro sitio, el cono es además lo que hace de verdad.
  //
  // Y hacía falta que ALGO proyectara sombra. Sin una sola sombra proyectada,
  // la radio, el libro y el monitor se ven pegados sobre el mesón en lugar de
  // apoyados encima, por muy buenos que sean los materiales.
  const luz = new SpotLight(
    "luzFlexo",
    new Vector3(X - 0.23, ALTO_MESON + 0.32, Z - 0.09),
    new Vector3(-0.42, -1, -0.5),
    1.7,
    2.4,
    scene
  );
  luz.diffuse = new Color3(1, 0.82, 0.58);
  luz.intensity = 5.2;
  luz.range = 2.4;

  return luz;
}