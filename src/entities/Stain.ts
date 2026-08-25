import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Observable, Vector3, PointerEventTypes } from "@babylonjs/core";

export interface StainResult {
  mesh: Mesh;
  onLimpia: Observable<void>;
}

export type TipoMancha = "aceite" | "polvo";

/**
 * Dibuja la silueta de la mancha sobre un canvas y la devuelve como textura.
 *
 * Se usa como mapa de opacidad, así que lo único que importa es el blanco y
 * negro: blanco donde hay suciedad, negro donde no. Con esto la mancha deja de
 * ser un círculo perfecto — que es lo que delataba que era geometría — y pasa a
 * tener borde irregular y desvanecido, como un derrame real.
 */
function crearSiluetaMancha(scene: Scene, id: string, esPolvo: boolean): DynamicTexture {
  const tam = 256;
  const tex = new DynamicTexture(`siluetaMancha_${id}`, { width: tam, height: tam }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, tam, tam);

  const centro = tam / 2;

  // Cuerpo principal: un óvalo deformado con varios lóbulos encima. El
  // desenfoque de los bordes lo da un degradado radial por lóbulo.
  const manchon = (cx: number, cy: number, radio: number, opacidad: number): void => {
    const grad = ctx.createRadialGradient(cx, cy, radio * 0.35, cx, cy, radio);
    grad.addColorStop(0, `rgba(255,255,255,${opacidad})`);
    grad.addColorStop(0.75, `rgba(255,255,255,${opacidad * 0.85})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radio, 0, Math.PI * 2);
    ctx.fill();
  };

  manchon(centro, centro, esPolvo ? 96 : 84, 1);
  manchon(centro + 46, centro + 30, esPolvo ? 52 : 44, 0.95);
  manchon(centro - 40, centro - 26, esPolvo ? 46 : 38, 0.9);
  manchon(centro + 18, centro - 48, esPolvo ? 38 : 30, 0.85);

  // Salpicaduras sueltas alrededor: un derrame nunca termina en un borde limpio.
  const salpicaduras = esPolvo ? 14 : 9;
  for (let i = 0; i < salpicaduras; i++) {
    const angulo = Math.random() * Math.PI * 2;
    const distancia = 90 + Math.random() * 34;
    manchon(
      centro + Math.cos(angulo) * distancia,
      centro + Math.sin(angulo) * distancia,
      4 + Math.random() * (esPolvo ? 13 : 9),
      0.5 + Math.random() * 0.4
    );
  }

  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/**
 * Mancha de piso que se limpia a fuerza de clics.
 *
 * Dos variantes: aceite (oscuro y brillante, cuesta más) y polvo de tóner
 * (gris y mate). Ambas se apoyan en el piso y avisan visualmente que se pueden
 * limpiar cuando el cursor pasa por encima — sin ese aviso, alguien que juega
 * por primera vez no tiene forma de saber que son interactivas y no parte del
 * decorado.
 */
export function crearMancha(
  scene: Scene,
  id: string,
  x: number,
  z: number,
  tipo: TipoMancha = "aceite",
  clicksNecesarios?: number
): StainResult {
  const esPolvo = tipo === "polvo";
  const clicks = clicksNecesarios ?? (esPolvo ? 3 : 5);

  const mat = new PBRMaterial(`matMancha_${id}`, scene);
  mat.albedoColor = esPolvo ? new Color3(0.34, 0.32, 0.3) : new Color3(0.06, 0.05, 0.04);
  // El aceite es casi espejo y el polvo no refleja nada: esa diferencia de
  // brillo es lo que permite distinguir de un vistazo un derrame de un
  // ensuciado seco, sin necesidad de leer ningún cartel.
  mat.roughness = esPolvo ? 0.95 : 0.08;
  mat.metallic = esPolvo ? 0 : 0.25;

  const silueta = crearSiluetaMancha(scene, id, esPolvo);
  mat.opacityTexture = silueta;

  const alphaBase = esPolvo ? 0.78 : 0.92;
  mat.alpha = alphaBase;

  const radio = esPolvo ? 0.34 : 0.3;
  const mesh = MeshBuilder.CreateGround(`mancha_${id}`, { width: radio * 2, height: radio * 2 }, scene);
  mesh.material = mat;
  // Apoyada en el piso, apenas por encima para no pelearse con el suelo.
  mesh.position.set(x, 0.012, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;

  // --- Aviso de que se puede limpiar ---
  const matAro = new PBRMaterial(`matAroMancha_${id}`, scene);
  matAro.albedoColor = new Color3(0.55, 0.85, 0.95);
  matAro.emissiveColor = new Color3(0.3, 0.6, 0.7);
  matAro.roughness = 0.5;
  matAro.alpha = 0;

  const aro = MeshBuilder.CreateTorus(`aroMancha_${id}`, { diameter: radio * 2.5, thickness: 0.016, tessellation: 28 }, scene);
  aro.position.set(x, 0.016, z);
  aro.isPickable = false;
  aro.material = matAro;

  let cursorEncima = false;

  const onLimpia = new Observable<void>();
  let clicksRestantes = clicks;

  const escuchaPuntero = scene.onPointerObservable.add((info) => {
    if (mesh.isDisposed()) return;

    if (info.type === PointerEventTypes.POINTERMOVE) {
      cursorEncima = info.pickInfo?.pickedMesh === mesh;
      return;
    }

    if (info.type !== PointerEventTypes.POINTERPICK) return;
    if (info.pickInfo?.pickedMesh !== mesh) return;

    clicksRestantes--;
    const progreso = clicksRestantes / clicks;

    // La mancha encoge y se aclara con cada pasada, en vez de desaparecer de
    // golpe: el jugador ve que está avanzando y cuánto le falta.
    mesh.scaling.setAll(0.55 + progreso * 0.45);
    mat.alpha = alphaBase * (0.25 + progreso * 0.75);

    lanzarSalpicaduras(scene, mesh.position, esPolvo);

    if (clicksRestantes <= 0) {
      // Queda una marca de humedad que se evapora: sin eso la mancha se
      // esfuma de un cuadro al otro y el gesto de limpiar pierde su remate.
      dejarRastroHumedo(scene, mesh.position, radio, esPolvo);

      mesh.dispose();
      aro.dispose();
      scene.onPointerObservable.remove(escuchaPuntero);
      onLimpia.notifyObservers();
    }
  });

  // Latido suave del aro cuando el cursor está encima.
  const animacionAro = scene.onBeforeRenderObservable.add(() => {
    if (aro.isDisposed()) {
      scene.onBeforeRenderObservable.remove(animacionAro);
      return;
    }
    const objetivo = cursorEncima ? 0.75 : 0;
    matAro.alpha += (objetivo - matAro.alpha) * 0.18;

    if (matAro.alpha > 0.02) {
      const latido = 1 + Math.sin(performance.now() / 260) * 0.045;
      aro.scaling.setAll(latido);
    }
  });

  return { mesh, onLimpia };
}

/** Gotas que saltan al frotar. Duran poco: son el acuse de recibo del clic. */
function lanzarSalpicaduras(scene: Scene, centro: Vector3, esPolvo: boolean): void {
  const cantidad = 5;

  for (let i = 0; i < cantidad; i++) {
    const gota = MeshBuilder.CreateSphere(`salpicadura_${Date.now()}_${i}`, { diameter: 0.03 + Math.random() * 0.025, segments: 6 }, scene);
    gota.isPickable = false;
    gota.position.copyFrom(centro);
    gota.position.y = 0.04;

    const mat = new PBRMaterial(`matSalpicadura_${Date.now()}_${i}`, scene);
    mat.albedoColor = esPolvo ? new Color3(0.34, 0.32, 0.3) : new Color3(0.08, 0.06, 0.05);
    mat.roughness = esPolvo ? 0.9 : 0.12;
    gota.material = mat;

    const angulo = Math.random() * Math.PI * 2;
    const velocidad = new Vector3(Math.cos(angulo) * 0.011, 0.032 + Math.random() * 0.016, Math.sin(angulo) * 0.011);
    const nacimiento = performance.now();

    const observador = scene.onBeforeRenderObservable.add(() => {
      if (gota.isDisposed()) {
        scene.onBeforeRenderObservable.remove(observador);
        return;
      }

      velocidad.y -= 0.0022;
      gota.position.addInPlace(velocidad);

      const vida = performance.now() - nacimiento;
      if (gota.position.y <= 0.012 || vida > 900) {
        scene.onBeforeRenderObservable.remove(observador);
        gota.dispose();
        mat.dispose();
      }
    });
  }
}

/** Huella húmeda que se evapora tras terminar de limpiar. */
function dejarRastroHumedo(scene: Scene, centro: Vector3, radio: number, esPolvo: boolean): void {
  const rastro = MeshBuilder.CreateGround(`rastroHumedo_${Date.now()}`, { width: radio * 2.2, height: radio * 2.2 }, scene);
  rastro.isPickable = false;
  rastro.position.copyFrom(centro);
  rastro.position.y = 0.013;

  const mat = new PBRMaterial(`matRastro_${Date.now()}`, scene);
  mat.albedoColor = new Color3(0.62, 0.66, 0.68);
  mat.roughness = esPolvo ? 0.7 : 0.12;
  mat.alpha = 0.35;
  rastro.material = mat;

  const nacimiento = performance.now();
  const observador = scene.onBeforeRenderObservable.add(() => {
    if (rastro.isDisposed()) {
      scene.onBeforeRenderObservable.remove(observador);
      return;
    }

    const avance = (performance.now() - nacimiento) / 1100;
    mat.alpha = 0.35 * (1 - avance);
    rastro.scaling.setAll(1 + avance * 0.25);

    if (avance >= 1) {
      scene.onBeforeRenderObservable.remove(observador);
      rastro.dispose();
      mat.dispose();
    }
  });
}