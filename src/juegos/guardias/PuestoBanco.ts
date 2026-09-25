import {
  Scene,
  FreeCamera,
  Vector3,
  Color3,
  Color4,
  Mesh,
  Ray,
  PBRMaterial,
  VertexBuffer,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  type AbstractMesh,
  type Observer,
} from "@babylonjs/core";
import { cargarBanco, medirPiso, ALTURA_OJO, type BancoCargado } from "./EscenaBanco";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { iluminarBanco, ampliarLucesBanco, fotografiarHall } from "./LuzBanco";
import { construirExteriorBanco } from "./ExteriorBanco";
import { separarSueloSala, pulirSuelo, sombrasAlPie } from "./LuzSalaSupermercado";
import { crearHudRecorrido } from "./HudRecorrido";
import { crearRelojTurno } from "./RelojTurno";
import { crearPanelesTurno } from "./PanelesSupermercado";
import { crearGenteBanco } from "./GenteBanco";
import {
  precargarAmbienteSala,
  iniciarAmbienteSala,
  agacharAmbienteSala,
  detenerAmbienteSala,
} from "../../core/Sonido";
import {
  BRIEFING_TURNO,
  ETIQUETA_TURNO,
  FIN_DE_LA_CALMA,
  MINUTOS_POR_SEGUNDO,
  horaDelTurno,
} from "./TurnoBanco";

// ===========================================================================
// El puesto del guardia en el banco
// ===========================================================================
//
// El escenario 3 era un recorrido libre: se entraba al banco y se caminaba por
// él para conocerlo. Ahora es un turno, y el guardia de una sucursal no
// recorre nada: está en el acceso, de pie, y desde ahí vigila la puerta y el
// hall entero.
//
// Así que aquí no se camina. La cámara está plantada en el puesto, a la altura
// de los ojos, y lo único que se hace es mirar: arrastrando se gira la cabeza
// —a la puerta, a la fila, a las cajas— como la giraría cualquiera sin
// moverse de su sitio. Es la diferencia con el supermercado, y es a propósito:
// en este nivel lo que se juega es QUÉ se mira.

export interface PuestoBanco {
  banco: BancoCargado;
  /**
   * Abre el turno: la tarjeta de la jefatura y, al cerrarla, el reloj.
   *
   * Aparte de la creación, como en el supermercado: se llama cuando la
   * pantalla de carga ya se fue, o se entraría con el turno empezado.
   */
  comenzar: () => void;
  dispose: () => void;
}

/** Por qué se deja el puesto. "repetir" pide montarlo otra vez sin pasar por el menú. */
export type MotivoSalida = "menu" | "repetir";

/** El color del escenario, el mismo de su pantalla de carga en JuegoGuardias. */
const ACENTO = "#8ba6c9";

/**
 * Dónde está el puesto, en planta.
 *
 * Por dentro, a la derecha de la puerta según se entra y a setenta
 * centímetros del muro: la puerta queda a un paso a la izquierda y delante se
 * abre el hall entero, con la fila en el centro, las sillas de espera a los
 * dos lados y las cuatro cajas al fondo. Es el sitio desde donde un guardia
 * de acceso ve a la vez quién entra y qué pasa dentro.
 *
 * Medido sobre la planta del modelo a escala 3: la puerta tiene su eje en
 * X 0,6 y el muro de la fachada su cara interior en Z −3,95; la primera fila
 * de sillas empieza en Z −1,9, así que aquí hay más de un metro de paso libre
 * por delante.
 */
const PUESTO = { x: 2.35, z: -3.25 };
/** Hacia dónde mira al empezar: el mesón, entre la segunda y la tercera caja. */
const MIRA_AL_EMPEZAR = { x: 0.2, alto: 1.25, z: 4.6 };

/**
 * Cuánto se puede subir y bajar la vista, en radianes.
 *
 * Lo que da el cuello sin moverse del sitio: se ve el piso a los pies y las
 * luminarias del techo, pero no se da la vuelta por arriba. Sin tope, una
 * FreeCamera deja seguir girando hasta mirar al revés.
 */
const VISTA_ARRIBA = -0.75;
const VISTA_ABAJO = 0.7;

/**
 * @param onSalir  Al dejar el puesto. "menu" vuelve al menú; "repetir" pide
 *                 montarlo otra vez.
 * @param usuario  Quien juega. Es con quien se guardará el turno.
 */
export async function crearPuestoBanco(
  scene: Scene,
  onSalir: (motivo?: MotivoSalida) => void,
  usuario = "invitado"
): Promise<PuestoBanco> {
  void usuario;
  // Lo primero: vaciar lo que dejó el escenario anterior. Ver LimpiezaEscena.
  limpiarEscena(scene);
  scene.clearColor = new Color4(0.7, 0.78, 0.88, 1);

  // La cámara, ANTES de cargar el modelo: el bucle de render sigue corriendo
  // mientras se descarga, y sin cámara cada cuadro lanzaría "No camera
  // defined" (ver el mismo comentario en el supermercado).
  const camara = new FreeCamera("camaraPuestoBanco", new Vector3(0, ALTURA_OJO, 0), scene);
  camara.minZ = 0.05;
  camara.maxZ = 2400;
  camara.angularSensibility = 3200;
  camara.inertia = 0.8;
  // Solo mirar. Sin el teclado enganchado, las flechas y WASD no mueven al
  // guardia de su puesto: el ratón es lo único que queda, y gira la cabeza.
  camara.inputs.removeByType("FreeCameraKeyboardMoveInput");
  usarCamara(scene, camara);

  const banco = await cargarBanco(scene);

  // --- El puesto ------------------------------------------------------------
  const piso = medirPiso(scene, banco.mallas, PUESTO.x, PUESTO.z);
  const cielo = medirCielo(scene, banco.mallas, PUESTO.x, PUESTO.z, piso);
  camara.position.set(PUESTO.x, piso + ALTURA_OJO, PUESTO.z);
  camara.setTarget(new Vector3(MIRA_AL_EMPEZAR.x, piso + MIRA_AL_EMPEZAR.alto, MIRA_AL_EMPEZAR.z));
  const enSuSitio = camara.position.clone();
  // Plantado: la posición no se mueve, y la vista, dentro de lo que da el
  // cuello. Cada cuadro, porque la inercia del ratón sigue girando un poco
  // después de soltar y podría pasarse del tope.
  const plantado: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    camara.position.copyFrom(enSuSitio);
    camara.rotation.x = Math.min(VISTA_ABAJO, Math.max(VISTA_ARRIBA, camara.rotation.x));
  });

  // --- Lo de fuera -----------------------------------------------------------
  //
  // La explanada del modelo pasa a ser de fuera —la alumbra el sol—, y el
  // edificio da su sombra sobre ella y sobre la vereda.
  const explanada = banco.mallas.filter((m) => m.material?.name === "initialShadingGroup");
  const edificio = banco.mallas.filter((m) => !explanada.includes(m));
  const exterior = construirExteriorBanco(scene, edificio, explanada);
  const deFuera = new Set<AbstractMesh>(exterior.mallas);

  // --- La luz del hall ---------------------------------------------------------
  iluminarBanco(scene, cielo);
  // Lo de dentro no alumbra lo de fuera: la calle tiene su sol.
  scene.lights
    .filter((l) => !exterior.luces.includes(l))
    .forEach((l) => l.excludedMeshes.push(...exterior.mallas));

  // Las ventanas: el vidrio del modelo llegaba casi opaco, gris, y por las
  // ventanas no se veía la calle que ahora hay detrás.
  afinarVidrio(banco.mallas);

  // El piso, aparte del resto del edificio y pulido: mármol claro con el
  // reflejo de lo que tiene encima, que es lo que hace que un hall de banco se
  // lea como tal. Las mismas piezas del supermercado.
  const estructura = banco.mallas.find((m) => m.material?.name === "set11");
  const suelo = estructura instanceof Mesh ? separarSueloSala(estructura, piso) : null;
  if (suelo) {
    suelo.name = "sueloBanco";
    pulirSuelo(scene, suelo, piso, (m) => !deFuera.has(m) && !m.name.endsWith("_sombraAlPie"));
  }
  // Y el cielo raso, en blanco: llegaba con el mismo mármol gris oscuro que el
  // resto de la estructura, y un techo oscuro a cinco metros, con los paneles
  // encendidos encima, hacía del hall una cueva.
  if (estructura instanceof Mesh) pintarCieloRaso(scene, estructura, cielo);

  // El ambiente del hall se va bajando y decodificando mientras se monta el
  // resto, para que suene a tiempo al cerrar la tarjeta.
  precargarAmbienteSala("banco");

  // La gente: cajeros, clientes, la puerta y la pantalla de turnos. Antes que
  // las sombras al pie y que la ampliación de luces, que tienen que contarla.
  const puerta = banco.mallas.find((m) => m.material?.name === "set13");
  const gente = crearGenteBanco(scene, piso, puerta instanceof Mesh ? puerta : null);

  // El entorno de los reflejos, con el hall ya completo. Sin la gente, que se
  // mueve: en un reflejo fijo se quedaría congelada en su primer cuadro.
  fotografiarHall(
    scene,
    new Vector3(0.7, piso + 1.8, 0.6),
    scene.meshes.filter((m) => m !== suelo && !m.name.startsWith("banco_"))
  );

  // Una sombra al pie de cada persona, cuando las haya. Ver sombrasAlPie.
  sombrasAlPie(scene, scene.transformNodes.filter((n) => n.name.startsWith("figura_")));

  // Todo compilado para la cantidad de luces que hay. Lo último, cuando ya
  // existen todos los materiales.
  ampliarLucesBanco(scene);

  // --- Post-proceso -------------------------------------------------------------
  //
  // El del supermercado: suavizado de bordes, un resplandor que solo toma lo
  // que pasa de blanco —los paneles y su reflejo en el piso— y el mapeo ACES,
  // que deja sitio por arriba para que la calle a pleno sol se vea más clara
  // que el hall sin quemarse.
  const tuberia = new DefaultRenderingPipeline("postProcesoBanco", true, scene, [camara]);
  tuberia.samples = 4;
  tuberia.bloomEnabled = true;
  tuberia.bloomThreshold = 1.0;
  tuberia.bloomWeight = 0.3;
  tuberia.bloomKernel = 48;
  tuberia.bloomScale = 0.5;
  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.contrast = 1.06;
  tuberia.imageProcessing.exposure = 1.1;
  tuberia.imageProcessing.toneMappingEnabled = true;
  tuberia.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

  // --- La barra de controles ------------------------------------------------
  //
  // Los controles están en la tarjeta del inicio. La barra se queda hasta que
  // el jugador mira alrededor por primera vez —ya sabe cómo— o cinco segundos.
  const ayuda = document.createElement("div");
  ayuda.textContent = "Arrastrar para mirar alrededor · ESC para la pausa";
  Object.assign(ayuda.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    borderRadius: "8px",
    background: "rgba(10, 12, 16, 0.78)",
    color: "#e8ecf4",
    font: "500 13px/1 system-ui, sans-serif",
    letterSpacing: "0.3px",
    pointerEvents: "none",
    zIndex: "40",
    opacity: "0",
    transition: "opacity 600ms ease",
  });
  document.body.appendChild(ayuda);
  const CONTROLES_A_LA_VISTA_MS = 5000;
  let temporizadorAyuda: ReturnType<typeof setTimeout> | undefined;
  const apagarAyuda = (): void => {
    clearTimeout(temporizadorAyuda);
    ayuda.style.opacity = "0";
    window.removeEventListener("pointerdown", alMirar);
  };
  const alMirar = (): void => {
    if (enMarcha) apagarAyuda();
  };

  // --- El turno -------------------------------------------------------------
  //
  // Se monta aquí pero no arranca: comenzar() abre la tarjeta y el reloj corre
  // cuando se cierra.
  const hud = crearHudRecorrido({ hora: horaDelTurno(0), turno: ETIQUETA_TURNO, acento: ACENTO });
  const paneles = crearPanelesTurno(scene);
  const reloj = crearRelojTurno(scene, {
    minutoFinal: FIN_DE_LA_CALMA,
    minutosPorSegundo: MINUTOS_POR_SEGUNDO,
    // Al paso de las figuras: si el equipo va lento, el turno y la gente se
    // frenan juntos (ver pasoMaximo en RelojTurno).
    pasoMaximo: 0.05,
    alAvanzar: (minuto) => hud.ponerHora(horaDelTurno(minuto)),
  });

  let cerrado = false;
  let comenzado = false;
  /** Si el turno está corriendo: ni la tarjeta del inicio ni la pausa delante. */
  let enMarcha = false;

  const comenzar = (): void => {
    if (cerrado || comenzado) return;
    comenzado = true;
    // Con la tarjeta delante no se mira alrededor. Y sin la cámara escuchando
    // el puntero, el clic llega entero al botón (ver main.ts).
    camara.detachControl();
    paneles.mostrarBriefing(BRIEFING_TURNO, () => {
      if (cerrado) return;
      camara.attachControl(true);
      hud.mostrar();
      // El hall empieza a sonar con el turno, entrando en dos segundos.
      iniciarAmbienteSala("banco");
      gente.comenzar();
      reloj.correr(true);
      enMarcha = true;
      ayuda.style.opacity = "1";
      temporizadorAyuda = setTimeout(apagarAyuda, CONTROLES_A_LA_VISTA_MS);
      window.addEventListener("pointerdown", alMirar);
    });
  };

  // --- Salir -----------------------------------------------------------------
  //
  // En el orden del supermercado: se suelta el mando, se desmonta la escena y
  // solo entonces se avisa. Avisar antes deja al menú montándose sobre una
  // escena que se está destruyendo debajo.
  const salir = (motivo: MotivoSalida = "menu"): void => {
    if (cerrado) return;
    cerrado = true;
    enMarcha = false;
    window.removeEventListener("keydown", alPulsar);
    camara.detachControl();
    apagarAyuda();
    ayuda.remove();
    if (plantado) scene.onBeforeRenderObservable.remove(plantado);
    detenerAmbienteSala();
    gente.dispose();
    reloj.dispose();
    hud.dispose();
    paneles.dispose();
    tuberia.dispose();
    limpiarEscena(scene);
    onSalir(motivo);
  };

  // --- La pausa ---------------------------------------------------------------
  //
  // ESC detiene el turno —reloj parado y la vista suelta— y desde ahí se sigue
  // o se sale. Antes de empezar, con la tarjeta de jefatura puesta, no hay
  // turno que perder y ESC sale directo, como en el supermercado.
  //
  // Va al final por lo mismo que allá: la tecla puede llegar antes de que el
  // puesto termine de montarse.
  let enPausa = false;
  const abrirPausa = (): void => {
    if (enPausa || cerrado || !comenzado || !enMarcha) return;
    enPausa = true;
    enMarcha = false;
    reloj.correr(false);
    gente.congelar(true);
    // La sala no se calla en la pausa, pero se aparta.
    agacharAmbienteSala(true);
    camara.detachControl();
    hud.ocultar();
    paneles.mostrarPausa(
      () => seguirTrasPausa(),
      () => salir("menu")
    );
  };
  const seguirTrasPausa = (): void => {
    if (!enPausa) return;
    enPausa = false;
    agacharAmbienteSala(false);
    if (cerrado) return;
    gente.congelar(false);
    camara.attachControl(true);
    hud.mostrar();
    reloj.correr(true);
    enMarcha = true;
  };
  const alPulsar = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    if (!comenzado) {
      salir("menu");
      return;
    }
    if (enPausa) {
      if (paneles.cerrarPausa()) seguirTrasPausa();
      return;
    }
    abrirPausa();
  };
  window.addEventListener("keydown", alPulsar);

  return {
    banco,
    comenzar,
    dispose: () => salir("menu"),
  };
}

/**
 * Altura del cielo raso sobre el puesto, medida con un rayo hacia arriba.
 *
 * Como el piso: se mide y no se supone, porque de ella cuelgan los paneles y
 * los focos, y con la escala del modelo cambian las dos.
 */
function medirCielo(scene: Scene, mallas: AbstractMesh[], x: number, z: number, piso: number): number {
  const rayo = new Ray(new Vector3(x, piso + 1.2, z), Vector3.Up(), 30);
  const impacto = scene.pickWithRay(rayo, (m) => mallas.includes(m));
  return impacto?.hit && impacto.pickedPoint ? impacto.pickedPoint.y : piso + 5.25;
}

/**
 * Aparta el cielo raso de la estructura y lo pinta de blanco mate.
 *
 * Por triángulos, como el suelo (ver separarSueloSala): los horizontales a la
 * altura medida del cielo. Mate a propósito: un cielo raso es yeso pintado, y
 * con brillo devolvería los paneles como manchas.
 */
function pintarCieloRaso(scene: Scene, malla: Mesh, cielo: number): Mesh | null {
  const pos = malla.getVerticesData(VertexBuffer.PositionKind);
  const indices = malla.getIndices();
  if (!pos || !indices) return null;
  const mundo = malla.computeWorldMatrix(true);
  const v = [new Vector3(), new Vector3(), new Vector3()];
  const normal = new Vector3();
  const resto: number[] = [];
  const techo: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], mundo, v[k]);
    }
    Vector3.CrossToRef(v[1].subtract(v[0]), v[2].subtract(v[0]), normal);
    normal.normalize();
    const y = (v[0].y + v[1].y + v[2].y) / 3;
    const esTecho = Math.abs(normal.y) > 0.9 && Math.abs(y - cielo) < 0.03;
    (esTecho ? techo : resto).push(indices[t], indices[t + 1], indices[t + 2]);
  }
  if (!techo.length) return null;
  const copia = malla.clone("cieloRasoBanco", malla.parent)!;
  copia.makeGeometryUnique();
  copia.setIndices(techo);
  malla.setIndices(resto);
  const yeso = new PBRMaterial("matCieloRasoBanco", scene);
  yeso.albedoColor = new Color3(0.86, 0.86, 0.84);
  yeso.metallic = 0;
  yeso.roughness = 0.92;
  copia.material = yeso;
  copia.freezeWorldMatrix();
  return copia;
}

/**
 * El vidrio de las ventanas, que llegaba de Maya como una lámina gris casi
 * opaca: se deja transparente y con su reflejo, como un vidrio de verdad.
 */
function afinarVidrio(mallas: AbstractMesh[]): void {
  const vistos = new Set<PBRMaterial>();
  mallas.forEach((m) => {
    const mat = m.material;
    if (!(mat instanceof PBRMaterial) || vistos.has(mat)) return;
    if (mat.name !== "aiStandardSurface2SG") return;
    vistos.add(mat);
    mat.albedoTexture = null;
    mat.albedoColor = new Color3(0.9, 0.95, 0.97);
    mat.alpha = 0.12;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    mat.metallic = 0;
    mat.roughness = 0.04;
    // El reflejo no se apaga con la transparencia: un vidrio casi invisible
    // sigue devolviendo el brillo de la sala en los bordes, que es lo que dice
    // que ahí hay un vidrio.
    mat.useRadianceOverAlpha = true;
    mat.useSpecularOverAlpha = true;
  });
}
