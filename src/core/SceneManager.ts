import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color4,
  Color3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ColorCurves,
  SSAO2RenderingPipeline,
} from "@babylonjs/core";

export class SceneManager {
  scene: Scene;
  shadowGenerator: ShadowGenerator;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.shadowGenerator = this.configurarAmbiente();
  }

  private configurarAmbiente(): ShadowGenerator {
    this.scene.clearColor = new Color4(0.85, 0.87, 0.9, 1);

    // PROFUNDIDAD ATMOSFÉRICA. El garaje tiene 19 m de fondo y hasta ahora la
    // pared del fondo se veía con la misma nitidez y el mismo contraste que el
    // banco que el jugador tiene delante. En un espacio real el aire se
    // interpone y el contraste cae con la distancia; sin eso el cerebro no
    // percibe la escala y la nave se siente más chica de lo que es.
    //
    // La densidad es deliberadamente baja: tiene que notarse al fondo y ser
    // imperceptible sobre la mesa, o el nivel se vería con neblina.
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.014;
    this.scene.fogColor = new Color3(0.62, 0.64, 0.68);

    const relleno = new HemisphericLight("luzRelleno", new Vector3(0, 1, 0), this.scene);
    relleno.intensity = 0.4;
    relleno.diffuse = new Color3(1, 1, 1);

    const principal = new DirectionalLight("luzPrincipal", new Vector3(-0.3, -1, 0.25), this.scene);
    principal.intensity = 1.2;
    principal.diffuse = new Color3(1, 0.97, 0.9);

    const luzVentana = new DirectionalLight("luzVentana", new Vector3(0.6, -0.2, 0.1), this.scene);
    luzVentana.intensity = 0.28;
    luzVentana.diffuse = new Color3(0.6, 0.72, 0.85);
    luzVentana.specular = new Color3(0, 0, 0);

    const shadowGenerator = new ShadowGenerator(2048, principal);

    // SOMBRAS DE CONTACTO, por filtrado de porcentaje cercano (PCF).
    //
    // Antes esto usaba useCloseExponentialShadowMap. Esa técnica aproxima la
    // oclusión con una función exponencial, y esa aproximación "derrama"
    // sombra donde no hay nada que la proyecte: sobre una superficie plana y
    // grande como el tablero del banco aparecía un borrón oscuro flotando en
    // el medio, sin objeto encima que lo justificara. Se veía en los cinco
    // niveles porque los cinco usan el mismo banco.
    //
    // PCF resuelve la oclusión muestreando el mapa de profundidad de verdad,
    // así que no inventa sombra: si no hay caster, no hay sombra. Además deja
    // el contacto nítido —que es lo que le dice al ojo que algo está apoyado y
    // no flotando— sin necesidad de desenfocar todo el mapa.
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

    // Los sesgos separan la superficie de su propia sombra. Con PCF hacen
    // falta un poco más altos que con la variante exponencial; por debajo de
    // estos valores reaparece el moteado sobre las superficies horizontales.
    shadowGenerator.bias = 0.0016;
    shadowGenerator.normalBias = 0.014;

    // La sombra no llega a negro: en un interior siempre hay luz rebotada.
    shadowGenerator.darkness = 0.35;

    // El frustum se ciñe a la zona de juego. Repartir 2048 píxeles entre los
    // 19 m del garaje deja unos pocos para una taza de 20 cm; acotándolo, esos
    // mismos píxeles se concentran donde ocurre la acción.
    principal.shadowMinZ = 1;
    principal.shadowMaxZ = 18;

    // Cámara orbital centrada en la zona de trabajo. Reemplaza a la FreeCamera
    // fija, que nunca recibía attachControl: el jugador no podía mirar nada.
    // Los ángulos iniciales reproducen el encuadre de antes; lo nuevo es que
    // ahora se puede girar alrededor y acercarse.
    const camara = new ArcRotateCamera(
      "camPrincipal",
      -Math.PI / 2, // alpha: mirando desde el frente
      1.12,         // beta: algo elevada, para ver la mesa desde arriba
      7.6,          // radio: distancia al centro de la escena
      new Vector3(0, 0.75, 0.9), // punto medio entre el banco y las zonas
      this.scene
    );

    // Límites: sin esto la cámara se mete bajo el piso o se aleja fuera del
    // garaje, y el jugador se pierde sin saber cómo volver.
    // El garaje es MUCHO mas grande que la oficina que habia antes (12 x 19 m
    // contra 12 x 14). Con el tope de alejamiento viejo la zona de juego
    // quedaba diminuta en medio de una nave vacia; recortarlo mantiene el banco
    // y las zonas ocupando la pantalla, sin perder la sensacion de galpon.
    camara.lowerRadiusLimit = 3.6;
    camara.upperRadiusLimit = 9.5;
    camara.lowerBetaLimit = 0.25;
camara.upperBetaLimit = 1.52;    
camara.wheelDeltaPercentage = 0.02;
    camara.panningSensibility = 0; // el botón derecho no desplaza el centro
    camara.minZ = 0.1;

    // Colisiones: la cámara se frena contra las paredes, los pilares y el
    // portón del garaje en vez de atravesarlos. El radio de colisión de
    // medio metro la detiene un poco antes de tocar la superficie, así no
    // se ve el muro pixelado a un centímetro de la lente.
    camara.checkCollisions = true;
    camara.collisionRadius = new Vector3(0.5, 0.5, 0.5);

    const lienzo = this.scene.getEngine().getRenderingCanvas();
    if (lienzo) {
      // El arrastre de objetos sigue funcionando: PointerDragBehavior suelta
      // el control de la cámara mientras se arrastra y lo devuelve al soltar.
      camara.attachControl(lienzo, true);
    }

    // El límite de radio por sí solo no alcanza: el garaje mide 12 m de ancho
    // pero 19 de fondo, así que la distancia que cabe depende de hacia dónde
    // esté mirando la cámara. Girando hacia un costado con radio 9 se atraviesa
    // la pared lateral y se termina viendo el garaje desde afuera.
    //
    // Red de seguridad por si el garaje todavía no terminó de cargar y no hay
    // contra qué colisionar: mide la posición de la cámara contra el volumen
    // del galpón y, si se pasa,
    // le recorta el radio en esa misma proporción. El resultado es que puedes
    // alejarte bastante mirando a lo largo del garaje, y al girar hacia un lado
    // la cámara se acerca sola en vez de salirse.
    const MURO_X = 5.8;
    const MURO_Z_ATRAS = -9.2;
    const MURO_Z_FRENTE = 9.2;
    const TECHO = 8.6;

    this.scene.onBeforeRenderObservable.add(() => {
      const posicion = camara.position;
      const exceso = Math.max(
        Math.abs(posicion.x) / MURO_X,
        posicion.y / TECHO,
        posicion.z < 0 ? posicion.z / MURO_Z_ATRAS : posicion.z / MURO_Z_FRENTE,
        1
      );
      if (exceso > 1) {
        camara.radius = Math.max(camara.lowerRadiusLimit ?? 1, camara.radius / exceso);
      }
    });

    this.scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
    this.scene.environmentIntensity = 0.7;

    const pipeline = new DefaultRenderingPipeline("pipelineOficina", true, this.scene, [camara]);
    pipeline.fxaaEnabled = false; // el antialiasing real de la GPU (MSAA) ya cubre esto
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = 0.1;
    pipeline.bloomKernel = 32;
    // MAPEO DE TONO. Sin esto, todo lo que supera el blanco se recorta de
    // golpe: las ventanas del garaje salían como manchas planas sin detalle.
    // ACES comprime los altos en curva, como hace una cámara real, y recupera
    // la textura de los marcos a contraluz.
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

    // El contraste baja de 1.2 a 1.05 porque ACES ya aporta el suyo: dejarlo
    // alto encima del mapeo aplasta los medios y ensucia el hormigón.
    // La exposición sube un poco para compensar que ACES oscurece la imagen.
    pipeline.imageProcessing.contrast = 1.05;
    pipeline.imageProcessing.exposure = 1.15;
    // AJUSTE DE COLOR. Cálido en los medios, frío en las sombras: es lo que
    // separa una imagen fotografiada de una calculada. La luz de los focos del
    // taller es cálida y lo que queda en penumbra lo ilumina el rebote del
    // cielo por las ventanas, que es azulado. Reproducirlo aquí, en vez de
    // teñir cada material, mantiene el garaje de Bitplay intacto.
    const curvas = new ColorCurves();
    curvas.globalSaturation = 12;
    curvas.highlightsHue = 32;
    curvas.highlightsDensity = 18;
    curvas.highlightsExposure = 6;
    curvas.shadowsHue = 220;
    curvas.shadowsDensity = 16;
    pipeline.imageProcessing.colorCurves = curvas;
    pipeline.imageProcessing.colorCurvesEnabled = true;

    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 0.35;

    const ssao = new SSAO2RenderingPipeline("ssaoOficina", this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camara]);
    // Radio calibrado al tamaño de los objetos, no del mobiliario. A 1.5 m el
    // oclusor no oscurecía nada alrededor de una taza de 20 cm; a 0.45 aparece
    // la sombrita en el borde donde el objeto se junta con la superficie, que
    // es media ilusión de peso.
    ssao.radius = 0.45;
    ssao.totalStrength = 0.9;
    ssao.expensiveBlur = true;
    ssao.samples = 16;

    return shadowGenerator;
  }
}