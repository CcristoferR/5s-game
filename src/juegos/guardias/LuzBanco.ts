import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Color3,
  Vector3,
  SpotLight,
  HemisphericLight,
  ReflectionProbe,
  type AbstractMesh,
} from "@babylonjs/core";

// ===========================================================================
// La luz del hall del banco
// ===========================================================================
//
// El recorrido alumbraba con un relleno a tope y cuatro bombillas puntuales:
// todo igual de claro, sin que se supiera de dónde venía la luz, y un techo a
// cinco metros sin una sola luminaria a la vista.
//
// Aquí la luz tiene origen, como en el supermercado:
//
//   · Paneles LED cuadrados empotrados en el cielo raso, en retícula sobre el
//     hall y en una fila sobre el mesón. Es lo que lleva una sucursal: luz
//     pareja y blanca, sin nada colgando que cruce la vista.
//   · Seis focos bajo los paneles, hacia abajo, que dan el degradado: más luz
//     en el pasillo y en el mesón, menos contra los muros y en los rincones.
//   · Un relleno bajo, que es la luz que rebota del piso claro y los muros.
//
// El piso y el reflejo se montan aparte (ver PuestoBanco), con las mismas
// piezas del supermercado.

/** Lado de cada panel y lo que mide su marco. */
const PANEL = 1.2;
const MARCO = 0.05;

/**
 * Dónde van los paneles: una retícula de tres por tres sobre el hall y una
 * fila sobre el mesón, uno encima de cada caja (ver CAJAS en GenteBanco).
 */
const PANELES: readonly [number, number][] = [
  ...[-2.6, 0.7, 4.0].flatMap((x) => [-2.3, 0.4, 3.1].map((z) => [x, z] as [number, number])),
  ...[-3.15, -1.15, 1.09, 3.07].map((x) => [x, 5.1] as [number, number]),
];

/**
 * Los focos: bajo los paneles de los lados y del centro, en dos filas. Los del
 * fondo caen justo delante del mesón, que es donde se atiende y donde más
 * tiene que verse.
 */
const FOCOS: readonly [number, number][] = [
  [-2.6, -1.4],
  [0.7, -1.4],
  [4.0, -1.4],
  [-2.6, 3.1],
  [0.7, 3.1],
  [4.0, 3.1],
];

export interface LuzBanco {
  relleno: HemisphericLight;
  focos: SpotLight[];
  /** Los paneles: marcos y difusores, dos mallas. */
  paneles: Mesh[];
}

/**
 * @param cielo  Altura del cielo raso, medida.
 */
export function iluminarBanco(scene: Scene, cielo: number): LuzBanco {
  const relleno = new HemisphericLight("luzRellenoBanco", new Vector3(0, 1, 0), scene);
  // Bajo a propósito: con el relleno de antes, a uno, el hall entero quedaba
  // en el mismo gris claro y los focos no tenían dónde notarse.
  relleno.intensity = 0.5;
  relleno.diffuse = new Color3(1, 0.985, 0.96);
  // Lo que sube del piso de mármol claro: es lo que le llega al cielo raso.
  relleno.groundColor = new Color3(0.6, 0.59, 0.57);

  // --- Los paneles -----------------------------------------------------------
  //
  // Marco blanco al ras del cielo y el difusor opal un centímetro hundido: el
  // borde claro alrededor de la luz es lo que los hace leer como paneles y no
  // como cuadrados pegados.
  const pintura = new PBRMaterial("matMarcoPanelBanco", scene);
  pintura.albedoColor = new Color3(0.9, 0.9, 0.89);
  pintura.metallic = 0;
  pintura.roughness = 0.45;
  const opal = new StandardMaterial("matDifusorPanelBanco", scene);
  opal.disableLighting = true;
  // Por encima del blanco, para que el resplandor del post-proceso tome el
  // difusor y nada más.
  opal.emissiveColor = new Color3(1, 0.985, 0.95).scale(2.4);
  opal.diffuseColor = new Color3(0, 0, 0);
  opal.specularColor = new Color3(0, 0, 0);

  const marcos: Mesh[] = [];
  const difusores: Mesh[] = [];
  PANELES.forEach(([x, z], i) => {
    const marco = MeshBuilder.CreateBox(`marcoPanelBanco_${i}`, { width: PANEL, height: 0.04, depth: PANEL }, scene);
    marco.position.set(x, cielo - 0.02, z);
    marcos.push(marco);
    const difusor = MeshBuilder.CreateBox(
      `difusorPanelBanco_${i}`,
      { width: PANEL - MARCO * 2, height: 0.01, depth: PANEL - MARCO * 2 },
      scene
    );
    difusor.position.set(x, cielo - 0.042, z);
    difusores.push(difusor);
  });
  const fundir = (nombre: string, piezas: Mesh[], material: PBRMaterial | StandardMaterial): Mesh => {
    const m = Mesh.MergeMeshes(piezas, true, true) ?? piezas[0];
    m.name = nombre;
    m.material = material;
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  };
  const paneles = [fundir("marcosPanelesBanco", marcos, pintura), fundir("difusoresPanelesBanco", difusores, opal)];

  // --- Los focos -------------------------------------------------------------
  //
  // Conos anchos y con el interior amplio, como los de la sala del súper: un
  // foco PBR se apaga en degradado desde su eje, y sin cono interior a media
  // distancia ya no da casi nada. Solapados, el piso queda parejo bajo la
  // retícula y cae hacia los muros.
  const focos = FOCOS.map(([x, z], i) => {
    const foco = new SpotLight(`focoBanco_${i}`, new Vector3(x, cielo - 0.12, z), new Vector3(0, -1, 0), 2.5, 1, scene);
    foco.innerAngle = 1.9;
    // Blanco neutro, el de un LED de 4000 K.
    foco.diffuse = new Color3(1, 0.97, 0.93);
    foco.specular = new Color3(0.9, 0.88, 0.85);
    foco.intensity = 18;
    foco.range = 16;
    return foco;
  });

  return { relleno, focos, paneles };
}

/**
 * Sube el tope de luces por material.
 *
 * Babylon compila cada material para cuatro luces por defecto y las que
 * sobran no se calculan, en silencio. Dentro son siete —el relleno y los seis
 * focos—: con cuatro, cada cosa del hall se alumbraría con los primeros que le
 * tocaran y la luz saldría a parches.
 */
export function ampliarLucesBanco(scene: Scene): void {
  scene.materials.forEach((mat) => {
    if (mat instanceof PBRMaterial) mat.maxSimultaneousLights = 8;
  });
}

/**
 * El entorno de los reflejos: el hall fotografiado una vez desde el centro.
 *
 * Sin él, lo que brilla —el mesón negro, los monitores, los postes de la fila—
 * refleja la nada y sale negro, con ese aspecto de plástico barato que tienen
 * los materiales brillantes cuando nadie les dice qué hay alrededor.
 *
 * Una sola vez: la sala está quieta, y refrescarla cada cuadro serían seis
 * dibujados más por fotograma para obtener la misma imagen.
 */
export function fotografiarHall(scene: Scene, centro: Vector3, entran: AbstractMesh[]): void {
  const sonda = new ReflectionProbe("sondaBanco", 256, scene);
  sonda.position = centro;
  entran.forEach((m) => sonda.renderList!.push(m));
  sonda.refreshRate = 0;
  // Un cuadro después, por lo mismo que la sonda del condominio: enchufada
  // antes, cada material que la sonda dibuja intentaría leerla mientras se
  // escribe, y WebGL aborta ese dibujo.
  scene.onAfterRenderObservable.addOnce(() => {
    scene.environmentTexture = sonda.cubeTexture;
    scene.environmentIntensity = 0.7;
  });
}
