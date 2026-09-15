import { AbstractMesh, Color3, PBRMaterial, Scene, Texture } from "@babylonjs/core";

/**
 * Afina los materiales de un escenario que llega en .glb.
 *
 * ─── POR QUÉ LAS LETRAS SE VEÍAN MAL ──────────────────────────────────────
 *
 * Los modelos de Bitplay se cargaban y se dejaban tal cual: nadie tocaba sus
 * materiales. Y un .glb no puede traer resuelto lo que peor sienta a un rótulo,
 * porque no forma parte del formato.
 *
 *  1. EL FILTRADO ANISOTRÓPICO. glTF define cómo se muestrea una textura de
 *     frente, pero no en ángulo, así que Babylon lo deja en 4. Y un rótulo casi
 *     nunca se mira de frente: se mira de paso, escorzado. Con filtrado bajo,
 *     la tarjeta tiene que resumir muchos tejeles en cada píxel y elige mal —
 *     los trazos finos de una letra se emborronan o desaparecen. Es, con
 *     diferencia, la causa principal de que un texto en 3D se vea sucio.
 *
 *  2. LA LUZ PROPIA DEL RÓTULO. Ninguno de los dos modelos trae materiales
 *     emisivos: comprobado leyendo los dos archivos. Eso significa que el
 *     letrero de un supermercado —que en la realidad va retroiluminado y es lo
 *     que se ve desde la calle— aquí depende de que le dé una lámpara. En una
 *     escena a media luz, sus letras quedan tan apagadas como el resto de la
 *     pared, y un cartel apagado no se lee.
 *
 * Las dos cosas se arreglan aquí, después de cargar y sin tocar el .glb, para
 * que Bitplay pueda reexportar el escenario sin que haya que rehacer nada.
 */

export interface OpcionesAfinado {
  /**
   * Fragmentos de nombre de material que son rótulos iluminados.
   *
   * Se comparan sin distinguir mayúsculas. Un material cuyo nombre contenga
   * alguno de estos pasa a emitir su propio color, como un cartel encendido.
   */
  letreros?: string[];
  /** Cuánto emite el rótulo. 1 es legible sin quemarse. */
  brilloLetrero?: number;
  /**
   * Fragmentos de nombre de material que NO son metal, aunque el modelo diga
   * que sí.
   *
   * ─── POR QUÉ LAS LATAS SE VEÍAN NEGRAS ──────────────────────────────────
   *
   * Bitplay entregó las tres latas del supermercado con el mapa de
   * metalicidad blanco entero: metal al cien por cien, etiqueta incluida. En
   * Maya se ven bien porque su escena tiene una luz de cielo que reflejar.
   * Aquí no hay entorno, y un metal PBR no tiene color propio —solo refleja
   * lo que lo rodea—, así que sin nada alrededor sale negro.
   *
   * Y la etiqueta impresa de una lata no es metal: es tinta sobre barniz.
   * Apagando el metal se ilumina como lo que es. Se prefirió a darle a la
   * escena una sonda de reflejos como la del condominio porque la sonda
   * cambia la luz de TODO el local, y el problema son tres materiales.
   */
  sinMetal?: string[];
  /**
   * Imprime en consola el nombre de cada material con el tamaño y la altura de
   * su malla.
   *
   * Sirve para identificar cuál es el rótulo cuando el exportador no le puso
   * nombre: el del banco llegó con nombres de Maya —set3, set9, set11— y desde
   * el código no hay forma de saber cuál es cuál. Con esta lista, mirar cuál
   * está alto y es ancho y plano lo resuelve en diez segundos.
   */
  diagnostico?: boolean;
}

export function afinarMateriales(
  scene: Scene,
  mallas: AbstractMesh[],
  opciones: OpcionesAfinado = {}
): void {
  const letreros = (opciones.letreros ?? []).map((t) => t.toLowerCase());
  const brillo = opciones.brilloLetrero ?? 1;
  const sinMetal = (opciones.sinMetal ?? []).map((t) => t.toLowerCase());

  // --- Filtrado, sobre todas las texturas del escenario ----------------------
  //
  // Se recorren las texturas de la escena y no los materiales uno a uno porque
  // un material PBR puede llevar seis mapas distintos —color, normal, rugosidad,
  // metalicidad, oclusión, altura— y todos se muestrean igual de mal. Hacerlo
  // por textura los alcanza todos sin enumerarlos.
  scene.textures.forEach((tex) => {
    if (!(tex instanceof Texture)) return;
    tex.anisotropicFilteringLevel = 16;
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  });

  // --- Metales apagados y rótulos encendidos ----------------------------------
  const vistos = new Set<string>();

  mallas.forEach((malla) => {
    const mat = malla.material;
    if (!(mat instanceof PBRMaterial)) return;
    if (vistos.has(mat.name)) return;
    vistos.add(mat.name);

    const nombre = mat.name.toLowerCase();

    if (sinMetal.some((t) => nombre.includes(t))) {
      // El mapa se queda, porque de él sigue saliendo la rugosidad. El factor
      // multiplica su canal de metal: en cero lo anula entero.
      mat.metallic = 0;
    }

    if (!letreros.some((t) => nombre.includes(t))) return;

    // Emite su propio color. Se usa la textura de color como emisiva —la misma
    // imagen, no una nueva— porque un rótulo retroiluminado brilla justamente
    // con los colores que tiene pintados: el fondo del cartel y las letras.
    mat.emissiveTexture = mat.albedoTexture;
    mat.emissiveColor = new Color3(brillo, brillo, brillo);

    // Y se le baja el brillo especular. Un cartel encendido no refleja la sala:
    // la luz sale de él. Dejarlo pulido le pone encima un reflejo que tapa
    // precisamente las letras.
    mat.roughness = Math.max(mat.roughness ?? 0.5, 0.7);
    mat.metallic = 0;
  });

  if (opciones.diagnostico) {
    const filas: string[] = [];
    const yaListado = new Set<string>();
    mallas.forEach((malla) => {
      const nombreMat = malla.material?.name ?? "(sin material)";
      if (yaListado.has(nombreMat)) return;
      yaListado.add(nombreMat);

      const caja = malla.getBoundingInfo().boundingBox;
      const t = caja.maximumWorld.subtract(caja.minimumWorld);
      filas.push(
        `  ${nombreMat.padEnd(30)} ` +
          `${t.x.toFixed(1)} × ${t.y.toFixed(1)} × ${t.z.toFixed(1)} m` +
          `   ·  altura ${caja.minimumWorld.y.toFixed(1)} a ${caja.maximumWorld.y.toFixed(1)}`
      );
    });
    console.log(
      "[Materiales] Para identificar el rótulo: busca el que esté alto y sea " +
        "ancho y plano.\n" +
        filas.join("\n")
    );
  }
}