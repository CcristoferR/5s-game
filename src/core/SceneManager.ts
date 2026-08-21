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
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 14;
    shadowGenerator.bias = 0.001;

    // Cámara orbital centrada en la zona de trabajo. Reemplaza a la FreeCamera
    // fija, que nunca recibía attachControl: el jugador no podía mirar nada.
    // Los ángulos iniciales reproducen el encuadre de antes; lo nuevo es que
    // ahora se puede girar alrededor y acercarse.
    const camara = new ArcRotateCamera(
      "camPrincipal",
      -Math.PI / 2, // alpha: mirando desde el frente
      1.05,         // beta: algo elevada, para ver la mesa desde arriba
      9,            // radio: distancia al centro de la escena
      new Vector3(0, 0.9, 0.6), // punto medio entre la mesa y las zonas
      this.scene
    );

    // Límites: sin esto la cámara se mete bajo el piso o se aleja fuera del
    // garaje, y el jugador se pierde sin saber cómo volver.
    camara.lowerRadiusLimit = 4.5;
    camara.upperRadiusLimit = 11;
    camara.lowerBetaLimit = 0.25;
    camara.upperBetaLimit = 1.45;
    camara.wheelDeltaPercentage = 0.02;
    camara.panningSensibility = 0; // el botón derecho no desplaza el centro
    camara.minZ = 0.1;

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
    // Esto mide la posición real de la cámara contra las paredes y, si se pasa,
    // le recorta el radio en esa misma proporción. El resultado es que podés
    // alejarte bastante mirando a lo largo del garaje, y al girar hacia un lado
    // la cámara se acerca sola en vez de salirse.
    const MURO_X = 5.4;
    const MURO_Z_ATRAS = -8.8;
    const MURO_Z_FRENTE = 8.4;
    const TECHO = 8.2;

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
    pipeline.imageProcessing.contrast = 1.2;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 0.35;

    const ssao = new SSAO2RenderingPipeline("ssaoOficina", this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camara]);
    ssao.radius = 1.5;
    ssao.totalStrength = 0.7;
    ssao.samples = 16;

    return shadowGenerator;
  }
}