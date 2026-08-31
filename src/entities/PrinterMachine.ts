import { Scene, MeshBuilder, PBRMaterial, Color3, TransformNode } from "@babylonjs/core";
import { texturaGrano } from "./TexturasSuperficie";

// Impresora con cartucho de tóner dañado — segunda fuente de
// investigación del nivel, distinta a la máquina con fuga de aceite.
// La luz de estado parpadea para atraer la atención del jugador hacia
// esta zona sin necesitar texto adicional.
export function crearImpresoraConToner(scene: Scene, x: number, z: number): TransformNode {
  const root = new TransformNode("impresoraRoot", scene);
  root.position.set(x, 0, z);

  const matCuerpo = new PBRMaterial("matImpresoraCuerpo", scene);
  matCuerpo.albedoColor = new Color3(0.82, 0.82, 0.84);
  matCuerpo.roughness = 0.4;
  matCuerpo.microSurfaceTexture = texturaGrano(scene, 0.07);
  matCuerpo.metallic = 0.1;

  const cuerpo = MeshBuilder.CreateBox("impresoraCuerpo", { width: 0.55, height: 0.35, depth: 0.5 }, scene);
  cuerpo.position.y = 0.175;
  cuerpo.parent = root;
  cuerpo.material = matCuerpo;
  cuerpo.receiveShadows = true;

  const matBandeja = new PBRMaterial("matImpresoraBandeja", scene);
  matBandeja.albedoColor = new Color3(0.95, 0.95, 0.92);
  matBandeja.roughness = 0.7;
  matBandeja.microSurfaceTexture = texturaGrano(scene, 0.07);

  const bandeja = MeshBuilder.CreateBox("impresoraBandeja", { width: 0.4, height: 0.02, depth: 0.3 }, scene);
  bandeja.position.set(0, 0.36, -0.05);
  bandeja.parent = root;
  bandeja.material = matBandeja;

  // Rendija del cartucho, entreabierta — la pista visual de que el
  // tóner es la fuente del polvo negro.
  const matRendija = new PBRMaterial("matImpresoraRendija", scene);
  matRendija.albedoColor = new Color3(0.08, 0.08, 0.08);
  matRendija.roughness = 0.6;
  matRendija.microSurfaceTexture = texturaGrano(scene, 0.07);

  const rendija = MeshBuilder.CreateBox("impresoraRendija", { width: 0.5, height: 0.05, depth: 0.02 }, scene);
  rendija.position.set(0, 0.05, 0.26);
  rendija.parent = root;
  rendija.material = matRendija;

  const matLuz = new PBRMaterial("matImpresoraLuz", scene);
  matLuz.albedoColor = new Color3(0.8, 0.15, 0.1);
  matLuz.microSurfaceTexture = texturaGrano(scene, 0.1);
  matLuz.emissiveColor = new Color3(0.9, 0.15, 0.1);

  const luz = MeshBuilder.CreateSphere("impresoraLuzEstado", { diameter: 0.03 }, scene);
  luz.position.set(0.2, 0.2, 0.26);
  luz.parent = root;
  luz.material = matLuz;

  let tiempo = 0;
  scene.onBeforeRenderObservable.add(() => {
    tiempo += scene.getEngine().getDeltaTime() / 1000;
    const parpadeo = (Math.sin(tiempo * 4) + 1) / 2;
    matLuz.emissiveColor = new Color3(0.9 * parpadeo, 0.1 * parpadeo, 0.08 * parpadeo);
  });

  return root;
}