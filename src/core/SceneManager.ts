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
} from "@babylonjs/core";

// Prepara la escena base (cámara, luz, sombras) que van a compartir todos
// los niveles. Luz de oficina — neutra y clara, muy distinta al atardecer
// cálido del proyecto del auto, porque acá se necesita ver bien los
// detalles de cada objeto para poder clasificarlo.
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
    relleno.intensity = 0.6;
    relleno.diffuse = new Color3(1, 1, 1);

    const principal = new DirectionalLight("luzPrincipal", new Vector3(-0.4, -1, 0.3), this.scene);
    principal.intensity = 0.9;
    principal.diffuse = new Color3(1, 0.98, 0.92);

    const shadowGenerator = new ShadowGenerator(1024, principal);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 12;

    // Cámara fija a propósito: el mouse debe quedar libre para el
    // arrastrar-y-soltar del Nivel 1, sin competir por el control con
    // el giro de cámara. No se llama a attachControl().
    const camara = new FreeCamera("camPrincipal", new Vector3(0, 4.5, -6), this.scene);
    camara.setTarget(new Vector3(0, 1, 0));

    return shadowGenerator;
  }
}