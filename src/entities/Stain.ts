import { Scene, MeshBuilder, PBRMaterial, DynamicTexture, Color3, Mesh, Observable, Vector3, PointerEventTypes, Material } from "@babylonjs/core";

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
  // CLAVE: la silueta se dibuja en blanco sobre negro, y el canvas queda
  // opaco en todo el cuadrado. Sin esto Babylon lee el canal alfa — opaco en
  // todas partes — y la mancha aparece como un cuadrado perfecto en el piso.
  // Con getAlphaFromRGB usa el brillo: negro = transparente, blanco = mancha.
  tex.getAlphaFromRGB = true;
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
  mat.transparencyMode = Material.MATERIAL_ALPHABLEND;

  const alphaBase = esPolvo ? 0.78 : 0.92;
  mat.alpha = alphaBase;

  const radio = esPolvo ? 0.34 : 0.3;
  const mesh = MeshBuilder.CreateGround(`mancha_${id}`, { width: radio * 2, height: radio * 2 }, scene);
  mesh.material = mat;
  // Apoyada en el piso, apenas por encima para no pelearse con el suelo.
  mesh.position.set(x, 0.012, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;

  // --- Aviso de que se puede limpiar ---
  //
  // Antes esto era un aro luminoso alrededor. Se veía como un círculo blanco
  // pegado al piso: una figura geométrica perfecta al lado de una mancha
  // irregular, que delataba el truco. Ahora el aviso es la mancha misma, que
  // se aclara apenas al pasar el cursor — se entiende que responde, sin sumar
  // ningún objeto que no existiría en un taller.
  const emisionBase = esPolvo ? 0.03 : 0.02;
  mat.emissiveColor = new Color3(emisionBase, emisionBase, emisionBase);
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
      // Remate de la limpieza.
      //
      // La mancha misma se encoge y se apaga, y suelta un último puñado de
      // gotas. No se agrega ninguna malla nueva: antes quedaba una marca de
      // humedad dibujada sobre un plano propio, y ese plano se veía como un
      // cuadrado claro en el piso — una forma geométrica perfecta justo donde
      // acababa de haber una mancha irregular.
      mesh.isPickable = false;
      scene.onPointerObservable.remove(escuchaPuntero);
      lanzarSalpicaduras(scene, mesh.position, esPolvo);
      apagarMancha(scene, mesh, mat);
      onLimpia.notifyObservers();
    }
  });

  // Realce al pasar el cursor: la mancha levanta un punto su brillo propio.
  const animacionRealce = scene.onBeforeRenderObservable.add(() => {
    if (mesh.isDisposed()) {
      scene.onBeforeRenderObservable.remove(animacionRealce);
      return;
    }
    const objetivo = cursorEncima ? emisionBase + 0.16 : emisionBase;
    const actual = mat.emissiveColor.r + (objetivo - mat.emissiveColor.r) * 0.16;
    mat.emissiveColor.set(actual, actual, actual);
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

/**
 * Apaga la mancha: se encoge y se desvanece hasta desaparecer.
 *
 * Trabaja sobre la malla que ya existe, así que conserva la silueta irregular
 * hasta el último cuadro. Cualquier plano nuevo, por más que se desvanezca,
 * delata su forma rectangular mientras dura.
 */
function apagarMancha(scene: Scene, mesh: Mesh, mat: PBRMaterial): void {
  const alphaInicial = mat.alpha;
  const escalaInicial = mesh.scaling.x;
  const inicio = performance.now();

  const observador = scene.onBeforeRenderObservable.add(() => {
    if (mesh.isDisposed()) {
      scene.onBeforeRenderObservable.remove(observador);
      return;
    }

    const avance = Math.min(1, (performance.now() - inicio) / 420);
    // Arranca despacio y se va rápido al final: se lee como una última pasada
    // de trapo, no como un objeto que se apaga con un interruptor.
    const suave = avance * avance;

    mesh.scaling.setAll(escalaInicial * (1 - suave * 0.75));
    mat.alpha = alphaInicial * (1 - suave);

    if (avance >= 1) {
      scene.onBeforeRenderObservable.remove(observador);
      mesh.dispose();
    }
  });
}