import {
  Engine,
  Scene,
  FreeCamera,
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
    relleno.intensity = 0.85;
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
    shadowGenerator.blurKernel = 9;
    shadowGenerator.bias = 0.001;

    const camara = new FreeCamera("camPrincipal", new Vector3(0, 4.5, -6), this.scene);
    camara.setTarget(new Vector3(0, 1, 0));

    this.scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
    this.scene.environmentIntensity = 1.05;

    const pipeline = new DefaultRenderingPipeline("pipelineOficina", true, this.scene, [camara]);
    pipeline.fxaaEnabled = false; // el antialiasing real de la GPU (MSAA) ya cubre esto
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = 0.1;
    pipeline.bloomKernel = 32;
    pipeline.imageProcessing.contrast = 1.2;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 0.08;

    const ssao = new SSAO2RenderingPipeline("ssaoOficina", this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camara]);
    ssao.radius = 1.5;
    ssao.totalStrength = 0.5;
    ssao.samples = 16;

    return shadowGenerator;
  }
}