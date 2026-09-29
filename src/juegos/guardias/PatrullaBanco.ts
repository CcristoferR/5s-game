import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  TransformNode,
  PointLight,
  StandardMaterial,
  type Observer,
} from "@babylonjs/core";
import { crearAuto } from "./ModelosExterior";

// ===========================================================================
// La radiopatrulla de Carabineros
// ===========================================================================
//
// La que llega después del asalto y queda en la vereda, frente al banco, con
// las balizas encendidas. Es lo primero que dice "llegó Carabineros": antes de
// que el sargento abra la boca, por la puerta abierta se ve la patrulla y la
// vereda tiñéndose de rojo y de azul.
//
// El auto es el de la calle (crearAuto), con los colores de Carabineros:
// carrocería verde, techo blanco, las puertas blancas con el nombre, y la
// barra de balizas encima. Las balizas son dos cosas a la vez: los lentes,
// que se encienden por encima del umbral del resplandor y brillan, y dos
// luces que alumbran de verdad lo de fuera —la explanada, la vereda, la
// calle, el propio auto—. Lo de dentro no: una luz sin sombras que alumbrara
// el hall atravesaría los muros.
//
// ─── EL DESTELLO ──────────────────────────────────────────────────────────
//
// El de cualquier patrulla: dos golpes rojos, dos azules, y vuelta a empezar,
// algo menos de una vez por segundo. Un parpadeo parejo, rojo-azul-rojo-azul,
// se lee como luces de feria.

/** Verde de Carabineros, el de la carrocería. */
const VERDE = new Color3(0.035, 0.12, 0.06);
const BLANCO = new Color3(0.86, 0.87, 0.86);

/** Cuánto dura una vuelta del destello, en segundos. */
const VUELTA = 0.9;
/** Los golpes de cada color, en fracciones de la vuelta: [desde, hasta]. */
const GOLPES_ROJO: [number, number][] = [[0, 0.08], [0.15, 0.23]];
const GOLPES_AZUL: [number, number][] = [[0.5, 0.58], [0.65, 0.73]];
/** Intensidad de cada luz encendida. Con caída física: a cinco metros tiñe, a quince apenas. */
const INTENSIDAD = 26;

export interface PatrullaBanco {
  /** Las piezas del auto, ya colocadas: quien las recibe las alumbra, las funde y les da sombra. */
  piezas: Mesh[];
  /** Las dos balizas como luces. Quien monta el exterior les dice qué alumbran. */
  luces: PointLight[];
  /** Arranca el destello. */
  encender(): void;
  dispose(): void;
}

/**
 * @param posicion  Dónde se apoyan las ruedas.
 * @param giro      Hacia dónde mira el frente: 0 es +X.
 */
export function crearPatrullaBanco(scene: Scene, posicion: Vector3, giro: number): PatrullaBanco {
  const raiz = new TransformNode("patrullaBanco", scene);
  raiz.position.copyFrom(posicion);
  raiz.rotation.y = giro;

  const piezas = crearAuto(scene, "patrullaBanco", { color: VERDE, patente: "Z-4217", hatch: false });
  const materiales: PBRMaterial[] = [];

  // El techo y los pilares, en blanco: la misma pintura, otro color.
  const carroceria = piezas.find((m) => m.name === "patrullaBanco_carroceria");
  const pintura = carroceria?.material instanceof PBRMaterial ? carroceria.material : null;
  if (pintura) {
    const blanca = pintura.clone("patrullaBanco_pinturaBlanca");
    blanca.albedoColor = BLANCO;
    materiales.push(blanca);
    piezas
      .filter((m) => m.name === "patrullaBanco_techo" || m.name.startsWith("patrullaBanco_pilarB"))
      .forEach((m) => (m.material = blanca));
  }

  // --- Las puertas ------------------------------------------------------------
  //
  // Un panel blanco a cada lado, sobre la parte recta del costado —entre los
  // dos pasos de rueda y por debajo de la cintura, donde la chapa no curva—,
  // con una franja verde arriba y abajo y el nombre en medio.
  const texPuerta = new DynamicTexture("texPuertaPatrulla", { width: 1024, height: 192 }, scene, true);
  {
    const ctx = texPuerta.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#eceeea";
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = "#0d3a1f";
    ctx.fillRect(0, 0, 1024, 16);
    ctx.fillRect(0, 176, 1024, 16);
    ctx.font = "700 104px 'Arial Black', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CARABINEROS", 512, 100);
    texPuerta.update(true);
  }
  const matPuerta = new PBRMaterial("patrullaBanco_puertas", scene);
  matPuerta.albedoTexture = texPuerta;
  matPuerta.metallic = 0.3;
  matPuerta.roughness = 0.34;
  matPuerta.clearCoat.isEnabled = true;
  matPuerta.clearCoat.intensity = 1;
  matPuerta.clearCoat.roughness = 0.05;
  materiales.push(matPuerta);
  [-1, 1].forEach((lado) => {
    const panel = MeshBuilder.CreatePlane(`patrullaBanco_puerta_${lado}`, { width: 1.6, height: 0.3 }, scene);
    // A un milímetro y medio de la chapa: pegado, sin parpadeo.
    panel.position.set(0, 0.61, lado * 0.8825);
    // El plano mira a −Z; el de +Z se da vuelta. Así el nombre se lee bien
    // de los dos lados, de atrás hacia adelante en uno y al revés en el otro,
    // como en cualquier patrulla.
    panel.rotation.y = lado > 0 ? Math.PI : 0;
    panel.material = matPuerta;
    piezas.push(panel);
  });

  // --- La barra de balizas ------------------------------------------------------
  const TECHO = 1.418;
  const negro = new PBRMaterial("patrullaBanco_barra", scene);
  negro.albedoColor = new Color3(0.03, 0.03, 0.035);
  negro.metallic = 0.2;
  negro.roughness = 0.4;
  materiales.push(negro);
  const base = MeshBuilder.CreateBox("patrullaBanco_barraBase", { width: 0.24, height: 0.05, depth: 1.14 }, scene);
  base.position.set(-0.25, TECHO + 0.025, 0);
  base.material = negro;
  piezas.push(base);

  const lente = (nombre: string, color: Color3, z: number): PBRMaterial => {
    const m = new PBRMaterial(`patrullaBanco_lente${nombre}`, scene);
    m.albedoColor = color.scale(0.35);
    m.metallic = 0;
    m.roughness = 0.12;
    m.emissiveColor = color.scale(0.08);
    materiales.push(m);
    const caja = MeshBuilder.CreateBox(`patrullaBanco_lente${nombre}`, { width: 0.2, height: 0.075, depth: 0.52 }, scene);
    caja.position.set(-0.25, TECHO + 0.05 + 0.0375, z);
    caja.material = m;
    piezas.push(caja);
    return m;
  };
  const ROJO = new Color3(1, 0.07, 0.04);
  const AZUL = new Color3(0.06, 0.24, 1);
  const lenteRojo = lente("Rojo", ROJO, -0.29);
  const lenteAzul = lente("Azul", AZUL, 0.29);

  // --- La sombra de contacto -------------------------------------------------
  //
  // La explanada está a la sombra del banco, y la del auto cae sobre sombra:
  // no se distingue, y la patrulla parecía flotar un dedo sobre el piso. Una
  // mancha oscura y difusa debajo, más cerrada bajo las ruedas, la asienta.
  // No proyecta sombra ella misma (ver el exterior).
  const texSombra = new DynamicTexture("texSombraPatrulla", { width: 256, height: 128 }, scene, true);
  {
    const ctx = texSombra.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 128);
    ctx.filter = "blur(10px)";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(28, 24, 200, 80, 30);
    ctx.fill();
    ctx.filter = "blur(5px)";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (const x of [58, 198]) {
      ctx.fillRect(x - 16, 22, 32, 18);
      ctx.fillRect(x - 16, 88, 32, 18);
    }
    texSombra.hasAlpha = true;
    texSombra.update(true);
  }
  const matSombra = new StandardMaterial("patrullaBanco_sombraContacto", scene);
  matSombra.diffuseColor = new Color3(0, 0, 0);
  matSombra.specularColor = new Color3(0, 0, 0);
  matSombra.disableLighting = true;
  matSombra.opacityTexture = texSombra;
  const sombra = MeshBuilder.CreateGround("patrullaBanco_sombraContacto", { width: 4.9, height: 2.3 }, scene);
  sombra.position.y = 0.006;
  sombra.material = matSombra;
  piezas.push(sombra);

  piezas.forEach((m) => {
    m.parent = raiz;
    m.isPickable = false;
  });

  const luz = (nombre: string, color: Color3, z: number): PointLight => {
    const l = new PointLight(`baliza${nombre}Patrulla`, new Vector3(-0.25, TECHO + 0.22, z), scene);
    l.parent = raiz;
    l.diffuse = color;
    l.specular = color;
    // Apagadas hasta que llega: montadas ya, para que los materiales de fuera
    // se compilen contándolas y encenderlas no cueste un tirón.
    l.intensity = 0;
    return l;
  };
  const luzRoja = luz("Roja", ROJO, -0.3);
  const luzAzul = luz("Azul", AZUL, 0.3);
  raiz.computeWorldMatrix(true);
  piezas.forEach((m) => m.computeWorldMatrix(true));

  // --- El destello ---------------------------------------------------------------
  let encendida = false;
  let t = 0;
  const dentro = (p: number, golpes: [number, number][]): boolean => golpes.some(([a, b]) => p >= a && p < b);
  const APAGADO_ROJO = ROJO.scale(0.08);
  const APAGADO_AZUL = AZUL.scale(0.08);
  // Por encima de 1: pasa el umbral del resplandor (ver la tubería del puesto).
  const PRENDIDO_ROJO = ROJO.scale(7);
  const PRENDIDO_AZUL = AZUL.scale(7);
  const observador: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (!encendida) return;
    t += Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const p = (t % VUELTA) / VUELTA;
    const rojo = dentro(p, GOLPES_ROJO);
    const azul = dentro(p, GOLPES_AZUL);
    luzRoja.intensity = rojo ? INTENSIDAD : 0;
    luzAzul.intensity = azul ? INTENSIDAD * 1.25 : 0;
    lenteRojo.emissiveColor = rojo ? PRENDIDO_ROJO : APAGADO_ROJO;
    lenteAzul.emissiveColor = azul ? PRENDIDO_AZUL : APAGADO_AZUL;
  });

  return {
    piezas,
    luces: [luzRoja, luzAzul],
    encender() {
      encendida = true;
    },
    dispose() {
      if (observador) scene.onBeforeRenderObservable.remove(observador);
      encendida = false;
      luzRoja.dispose();
      luzAzul.dispose();
      texPuerta.dispose();
      texSombra.dispose();
      // Las piezas y sus materiales se van con el resto del exterior.
    },
  };
}
