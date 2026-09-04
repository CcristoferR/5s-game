import { Scene, MeshBuilder, Vector3, Mesh, AbstractMesh } from "@babylonjs/core";
import { TextBlock, Control, StackPanel, Rectangle } from "@babylonjs/gui";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { objetosNivel2, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { crearTableroSombras, type HuecoTablero } from "../entities/TableroSombras";
import { crearEstanteDestino, type BaldaDestino, type NivelBalda } from "../entities/EstanteDestino";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { reproducir } from "../core/Sonido";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { crearFormaNivel2 } from "../entities/Level2Shapes";
import { moverMalla, luegoDe } from "../core/Animacion";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";
import { TEXTO } from "../ui/EstiloUI";
import type { PuntoEnganche } from "../core/InputController";

// ===========================================================================
// NIVEL 2 — SEITON (Ordenar)
// ===========================================================================
//
// ─── EL PROBLEMA QUE ESTE NIVEL TENÍA ─────────────────────────────────────
//
// Era, con diferencia, el peor de los cinco, y no por diseño sino porque las
// dos formas de colocar un objeto estaban rotas:
//
//   EL TABLERO. Se comprobaba la distancia entre el objeto y el hueco con
//   Vector3.Distance(...) < 0.42. El hueco está a 1,7 m de altura y el objeto
//   arrastrado se desliza por el piso, a 0: solo la diferencia de altura ya
//   son 1,7 > 0,42, así que la condición NO PODÍA cumplirse nunca. Colgar una
//   herramienta era literalmente imposible. Encima las siluetas ni se veían:
//   la lámina del dibujo quedaba enterrada dentro del panel.
//
//   LA ESTANTERÍA. Se apuntaba con el cursor y se lanzaba un rayo, pero el
//   predicado aceptaba cualquier malla pinchable: el garaje, los montantes del
//   propio mueble y la utilería de fondo interceptaban el rayo antes que la
//   bandeja. Y no había ninguna señal en pantalla de a qué se estaba
//   apuntando, así que se soltaba a ciegas.
//
// ─── CÓMO SE RESUELVE SIN TOCAR LOS OTROS NIVELES ─────────────────────────
//
// La causa de fondo es que el arrastre corre sobre un plano horizontal: el
// objeto conserva su altura y se desliza. Es lo correcto para las zonas
// pintadas en el suelo de los Niveles 1 y 4, y cambiarlo por un plano vertical
// arreglaría este nivel y rompería los otros cuatro — con la cámara orbital,
// arrastrar en el plano de pantalla lanza los objetos por el aire en cuanto se
// gira un poco la vista.
//
// Así que el arrastre no se toca. Lo que se agrega es un ENGANCHE opcional
// (ver InputController.ts): mientras se arrastra, este nivel lanza un rayo que
// SOLO puede chocar contra receptores —láminas invisibles delante de cada
// sitio válido, y nada más está en la lista, así que nada puede taparlas—. Si
// acierta uno, el objeto se imanta: sube solo hasta la silueta o la balda y se
// queda sostenido ahí mientras el cursor siga apuntando. Se ve dónde va a
// quedar ANTES de soltar, con el borde del sitio encendido y su nombre en
// pantalla. Sin enganche, ningún otro nivel cambia una línea.
//
// ─── LOS CRITERIOS QUE ENSEÑA (L-E-F) ─────────────────────────────────────
//
// Video 3.2 (1:52): "un lugar para cada cosa... una etiqueta para cada cosa y
// cada cosa con su etiqueta". Y en 1:38: el área de trabajo debe "hablar por
// sí sola" — por eso el destino es un SITIO del entorno y no una casilla de un
// menú flotante.
//
// Video 3.3 (1:13): se ordena "por tipo de objeto, frecuencia de uso, fácil
// acceso y por peso del objeto... en estanterías los objetos de gran peso
// suelen ser colocados en la parte inferior".
//
// De ahí los tres destinos:
//   uso diario     → tablero de siluetas, sobre el propio banco de trabajo
//   uso ocasional  → repisa media
//   objetos pesados→ repisa inferior, obligatoriamente
//
// Y la etiqueta no la escribe el jugador: APARECE SOLA al acertar, impresa en
// el sitio. Es la mitad de la regla que siempre se olvida.

/** Aumento mientras hay que encontrar y reconocer los objetos por el galpón. */
const ESCALA_OBJETO = 2.0;

/** Tamaño una vez guardado. Más chico, para que la balda no se vea abarrotada. */
const ESCALA_COLOCADO = 1.25;

// Agarre: el arrastre agranda el objeto un 15 % mientras se lo sostiene.
const FACTOR_AGARRE = 1.15;

// --- Sitio de cada mueble ---------------------------------------------------
//
// Todo mira a -Z, que es de donde mira la cámara del juego. El puesto de
// trabajo va al centro del fondo y la estantería a su derecha: las dos zonas
// se ven a la vez sin girar, que es condición para poder comparar destinos.
const Z_PUESTO = 3.0;
const Y_TABLERO = 1.62;
const Z_TABLERO = 3.58;
const X_ESTANTE = 3.5;
const Z_ESTANTE = 3.2;

/** Apoya una malla sobre una superficie, sea cual sea su escala. */
function apoyarSobre(malla: Mesh, alturaSuperficie: number): void {
  malla.computeWorldMatrix(true);
  const base = malla.getBoundingInfo().boundingBox.minimumWorld.y;
  malla.position.y += alturaSuperficie - base;
}

/**
 * Deja una herramienta colgada de cara al tablero, alineada con su silueta.
 *
 * ─── POR QUÉ NO ALCANZA CON rotation.set(0, 0, 0) ─────────────────────────
 *
 * Las siluetas están dibujadas verticales, pero las herramientas no comparten
 * eje. Se modelaron en distintos momentos y cada una quedó con el suyo:
 *
 *   llave fija      eje largo en Z (0,26)   ·  tumbada
 *   martillo        eje largo en Z (0,24)   ·  tumbada
 *   alicate         eje largo en Z (0,20)   ·  tumbado
 *   destornillador  eje largo en Y (0,16)   ·  de pie
 *
 * Poniendo la rotación en cero, el destornillador quedaba bien y las otras
 * tres se clavaban perpendiculares al panel, apuntando a la cámara.
 *
 * Se corrige MIDIENDO en vez de con una tabla por herramienta: se compara el
 * alto contra el fondo de la caja envolvente y, si la pieza es más larga en Z
 * que en Y, se la gira un cuarto de vuelta para llevar su eje largo a la
 * vertical. Así cualquier herramienta que se agregue después queda bien sin
 * tocar esta función — y si alguien remodela una, sigue funcionando.
 *
 * extendSize es la media caja en coordenadas LOCALES, así que no la afecta el
 * giro que el objeto traiga de haber estado tirado por el piso.
 */
function colgarEnSilueta(malla: Mesh): void {
  const media = malla.getBoundingInfo().boundingBox.extendSize;

  // Un cuarto de vuelta sobre X lleva el eje Z a la vertical y deja la cara
  // plana de la herramienta contra el panel.
  malla.rotation.set(media.z > media.y ? Math.PI / 2 : 0, 0, 0);
}

/** Qué sitio está apuntando el cursor en este momento. */
type SitioApuntado =
  | { tipo: "silueta"; hueco: HuecoTablero }
  | { tipo: "balda"; balda: BaldaDestino };

export function cargarNivel2(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // ESCENARIO: el mismo garaje del Nivel 1, para que el jugador sienta que
  // sigue trabajando en el espacio que empezó a ordenar y no en otro lugar.
  // La carga es asíncrona: los objetos del nivel se crean igual y el garaje
  // aparece un instante después.
  //
  // A propósito NO se le pasa el shadowGenerator: el garaje tiene techo, y si
  // el techo proyectara la sombra de la luz direccional dejaría todo el
  // interior a oscuras. La luz de adentro la resuelve iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel2] garaje:", error));

  // Tres focos: sobre la zona donde están los objetos sueltos, sobre el puesto
  // con el tablero y sobre la estantería. Los dos destinos tienen que leerse
  // igual de bien o el jugador elige por visibilidad y no por criterio.
  iluminarInteriorGaraje(scene, [
    { z: 0.2, intensidad: 0.9 },
    { z: 2.9, intensidad: 0.85 },
    { z: 3.2, intensidad: 0.7 },
  ]);

  // Utileria de fondo. Ver AmbienteNivel.ts: la cantidad y el tipo cambian
  // por nivel para acompanar lo que ensena cada S.
  ambientarNivel(scene, 2);

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "sueloN2" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("sueloN2", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // EL BANCO VUELVE, y con un motivo.
  //
  // Se había quitado porque ofrecía una superficie donde dejarlo todo sin
  // decidir. Pero lo de uso diario tiene que quedar EN EL PUNTO DE USO, y sin
  // puesto de trabajo no hay punto de uso: el tablero colgaría de una pared
  // cualquiera y "está cerca" dejaría de significar algo. El banco no es un
  // destino válido — no recibe objetos —, es lo que le da sentido al tablero
  // que tiene encima.
  crearBancoDeTrabajo(scene, { nombre: "bancoN2", ancho: 3.2, fondo: 0.95, z: Z_PUESTO });

  const tablero = crearTableroSombras(scene, 0, Y_TABLERO, Z_TABLERO, 0, [
    "llave",
    "destornillador",
    "martillo",
    "alicate",
  ]);

  // Estantería propia del nivel: vacía, de dos baldas y rotulada en el mueble.
  // La de ambientación viene cargada de bultos y con cuatro alturas — no hay
  // dónde poner nada y no se distingue cuál es la media y cuál la inferior.
  const estante = crearEstanteDestino(scene, X_ESTANTE, Z_ESTANTE, 0);

  // Recinto de arrastre, por delante de los muebles.
  //
  // El objeto NO necesita llegar hasta la estantería: para eso está el imán.
  // Los límites solo evitan que se meta dentro de un mueble o de una pared,
  // desde donde ya no se podría recuperar.
  const limitesArrastre = { xMin: -4.3, xMax: 4.3, zMin: -2.0, zMax: 2.3 };

  // =========================================================================
  // EL IMÁN
  // =========================================================================

  /** Receptores: la única lista que el rayo puede tocar. */
  const receptores = new Map<AbstractMesh, SitioApuntado>();
  tablero.huecos.forEach((hueco) => receptores.set(hueco.receptor, { tipo: "silueta", hueco }));
  estante.baldas.forEach((balda) => receptores.set(balda.receptor, { tipo: "balda", balda }));

  /** Cuántos objetos lleva ya cada balda. Decide el sitio del siguiente. */
  const ocupacion: Record<NivelBalda, number> = { media: 0, inferior: 0 };

  /** Altura a la que cada objeto queda APOYADO en el piso, ya escalado. */
  const alzadaEnPiso = new Map<Mesh, number>();

  /** Sitio enganchado ahora mismo. Se lee al soltar. */
  let apuntado: SitioApuntado | null = null;

  const aviso = new TextBlock("avisoSitioNivel2", "");
  aviso.color = "#a9e0bd";
  aviso.fontSize = TEXTO.destacado;
  aviso.fontWeight = "700";
  aviso.outlineWidth = 5;
  aviso.outlineColor = "rgba(0,0,0,0.85)";
  aviso.top = "-150px";
  aviso.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  aviso.isVisible = false;
  gui.addControl(aviso);

  const nombreDelSitio = (sitio: SitioApuntado): string =>
    sitio.tipo === "silueta"
      ? `Silueta de ${sitio.hueco.id} — suelta para colgar`
      : sitio.balda.nivel === "media"
        ? "Repisa media · uso ocasional — suelta para guardar"
        : "Repisa inferior · objetos pesados — suelta para guardar";

  const apagarAviso = (): void => {
    apuntado = null;
    aviso.isVisible = false;
    tablero.resaltar(null);
    estante.resaltar(null);
  };

  /**
   * Se consulta en cada cuadro del arrastre.
   *
   * El predicado del rayo solo admite receptores, así que nada de la escena
   * puede interponerse: ni el garaje, ni el mueble, ni el objeto que se lleva
   * en la mano. Es la diferencia con el `scene.pick` de antes, que aceptaba
   * cualquier malla y fallaba casi siempre.
   */
  const buscarEnganche = (mesh: Mesh) => (libre: Vector3): PuntoEnganche | null => {
    // Altura de reposo corregida por el agrandado del agarre: sin esto el
    // objeto se hunde en el piso mientras se lo arrastra.
    const alPiso = (alzadaEnPiso.get(mesh) ?? 0) * FACTOR_AGARRE;
    const enElPiso: PuntoEnganche = {
      punto: new Vector3(libre.x, alPiso, libre.z),
      enElAire: false,
    };

    const golpe = scene.pick(scene.pointerX, scene.pointerY, (m) => receptores.has(m));
    const sitio = golpe?.hit && golpe.pickedMesh ? receptores.get(golpe.pickedMesh) ?? null : null;

    // Un hueco ya ocupado deja de ser destino: dos herramientas no comparten
    // silueta, y admitirlo desdibujaría "un lugar para cada cosa".
    if (!sitio || (sitio.tipo === "silueta" && sitio.hueco.ocupado)) {
      if (apuntado) apagarAviso();
      return enElPiso;
    }

    apuntado = sitio;
    aviso.text = nombreDelSitio(sitio);
    aviso.isVisible = true;

    if (sitio.tipo === "silueta") {
      tablero.resaltar(sitio.hueco.id);
      estante.resaltar(null);
      return { punto: sitio.hueco.receptor.position, enElAire: true };
    }

    tablero.resaltar(null);
    estante.resaltar(sitio.balda.nivel);
    return {
      punto: estante.puntoSostenido(sitio.balda.nivel, ocupacion[sitio.balda.nivel]),
      enElAire: true,
    };
  };

  // =========================================================================
  // OBJETOS
  // =========================================================================

  const objetos = objetosNivel2.map((datos) => {
    // La malla se crea dentro de crearObjetoInteractable, así que el enganche
    // necesita saber a qué malla pertenece antes de que exista. Se resuelve
    // con una casilla que se rellena justo después: el enganche no se consulta
    // hasta que alguien arrastra, mucho después de esta línea.
    const casilla: { mesh: Mesh | null } = { mesh: null };

    const objeto = crearObjetoInteractable(
      scene,
      datos,
      crearFormaNivel2,
      limitesArrastre,
      (libre) => (casilla.mesh ? buscarEnganche(casilla.mesh)(libre) : null)
    );

    casilla.mesh = objeto.mesh;

    // Mismo criterio que en el Nivel 1: a tamaño real las herramientas se
    // pierden en un galpón de 12 x 19 m, y acá además hay que reconocer CUÁL
    // es cada una para encajarla en su silueta.
    objeto.mesh.scaling.setAll(ESCALA_OBJETO);

    const [px, , pz] = datos.posicionInicial;
    objeto.mesh.position.set(px, 0, pz);
    if (datos.rotacionY !== undefined) objeto.mesh.rotation.y = datos.rotacionY;
    apoyarSobre(objeto.mesh, 0);

    alzadaEnPiso.set(objeto.mesh, objeto.mesh.position.y);

    return objeto;
  });

  const realce = habilitarRealceAlPasar(scene, objetos.map((o) => o.mesh));

  habilitarEtiquetasAlPasar(
    scene,
    gui,
    objetos.map((o) => ({ mesh: o.mesh, texto: o.datos.nombreVisible }))
  );

  // =========================================================================
  // PANTALLA
  // =========================================================================

  // Los tres criterios, permanentes.
  //
  // No es un tutorial: es la regla que el jugador tiene que aplicar ocho veces
  // seguidas, y tenerla delante convierte el nivel en un ejercicio de criterio
  // en vez de uno de memoria. La etiqueta al pasar el cursor dice QUÉ es cada
  // objeto; decidir DÓNDE va sigue siendo suyo.
  // Los dos textos van en una COLUMNA, no en alturas fijas.
  //
  // Antes cada uno tenía su "top" en píxeles. El primero se ajusta a dos
  // renglones según el ancho de la ventana, así que crecía hacia abajo y se
  // montaba sobre el segundo — que estaba clavado a 104 px y no se enteraba.
  // Apilados, el segundo siempre queda debajo del primero, mida lo que mida.
  const consignas = new StackPanel("consignasNivel2");
  consignas.isVertical = true;
  consignas.width = "900px";
  consignas.top = "62px";
  consignas.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  consignas.isHitTestVisible = false;
  gui.addControl(consignas);

  const criterios = new TextBlock(
    "criteriosNivel2",
    "Uso diario → tablero de siluetas   ·   Uso ocasional → repisa media   ·   Objetos pesados → repisa inferior"
  );
  criterios.color = "white";
  criterios.fontSize = TEXTO.cuerpo;
  criterios.outlineWidth = 3;
  criterios.outlineColor = "rgba(0,0,0,0.6)";
  criterios.textWrapping = true;
  criterios.resizeToFit = true;
  criterios.width = "880px";
  consignas.addControl(criterios);

  const separacion = new Rectangle("aireConsignas");
  separacion.width = "1px";
  separacion.height = "12px";
  separacion.thickness = 0;
  separacion.background = "transparent";
  consignas.addControl(separacion);

  const ayuda = new TextBlock(
    "ayudaNivel2",
    "Arrastra el objeto y APUNTA con el cursor al sitio: subirá solo hasta ahí."
  );
  ayuda.color = "#c9d4dd";
  ayuda.fontSize = TEXTO.menor;
  ayuda.outlineWidth = 3;
  ayuda.outlineColor = "rgba(0,0,0,0.6)";
  ayuda.textWrapping = true;
  ayuda.resizeToFit = true;
  ayuda.width = "760px";
  consignas.addControl(ayuda);

  let inicioNivel = performance.now();
  let corriendoTiempo = false;

  hud.definirObjetivo("Dale un lugar a cada cosa: silueta, repisa media o repisa inferior.");
  hud.definirTotalTarea(objetosNivel2.length);

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo) return;
    hud.actualizarTiempo(Math.floor((performance.now() - inicioNivel) / 1000));
  });

  const arrancarCronometro = (): void => {
    if (corriendoTiempo) return;
    corriendoTiempo = true;
    inicioNivel = performance.now();
    // El reloj del ranking arranca con el primer objeto que se toca, no al
    // cargar el nivel: leer la apertura no cuenta como tiempo de juego.
    gameManager.iniciarCronometroNivel();
  };

  mostrarAperturaNivel(scene, 2, briefingsNiveles[2], microLeccionesNiveles[2], () => {});

  let colocados = 0;

  const registrarAvance = (): void => {
    colocados++;
    hud.actualizarProgreso(colocados);

    if (colocados < objetosNivel2.length) return;

    corriendoTiempo = false;
    criterios.isVisible = false;
    ayuda.isVisible = false;
    apagarAviso();

    const segundosTotales = Math.round((performance.now() - inicioNivel) / 1000);
    const bonusTiempo = Math.max(0, 120 - segundosTotales);
    gameManager.sumarPuntos(bonusTiempo);
    onCompletado();

    hud.mostrarFeedback(true, "Cada cosa tiene su lugar y su etiqueta. El área ya habla sola.");

    luegoDe(scene, 1200, () => {
      preguntarCierreDeNivel(gui, hud, 2, (cierre) => {
        luegoDe(scene, 700, () => {
          hud.mostrarResultadoFinal(
            "Nivel 2",
            colocados * 10,
            bonusTiempo,
            segundosTotales,
            onVolverMenu,
            cierre
          );
        });
      });
    });
  };

  /** Devuelve el objeto a donde estaba y lo deja apoyado. */
  const devolver = (mesh: Mesh, datos: (typeof objetosNivel2)[number]): void => {
    moverMalla(scene, mesh, new Vector3(datos.posicionInicial[0], mesh.position.y, datos.posicionInicial[2]), 300);
    luegoDe(scene, 320, () => apoyarSobre(mesh, 0));
  };

  const fallar = (mesh: Mesh, datos: (typeof objetosNivel2)[number], mensaje: string): void => {
    reproducir("error");
    hud.mostrarFeedback(false, mensaje, mesh.position.clone());
    devolver(mesh, datos);
  };

  objetos.forEach((objeto) => {
    objeto.onAgarrar.add(() => arrancarCronometro());

    objeto.onSoltar.add(({ mesh }) => {
      const sitio = apuntado;
      const datos = objeto.datos;
      apagarAviso();

      // No se apuntó a ningún sitio: el objeto se queda donde cayó. No es un
      // error —todavía no decidió nada— así que no se penaliza ni se devuelve.
      if (!sitio) {
        apoyarSobre(mesh, 0);
        return;
      }

      // --- Tablero de siluetas: uso diario, en el punto de uso ---
      if (sitio.tipo === "silueta") {
        if (datos.destino !== "tablero") {
          fallar(
            mesh,
            datos,
            datos.destino === "inferior"
              ? "El tablero es para lo que se usa a diario y se toma de un movimiento. Esto pesa: va abajo."
              : "El tablero es para lo que se usa todos los días. Esto se consulta de vez en cuando: repisa media."
          );
          return;
        }

        if (datos.silueta !== sitio.hueco.id) {
          fallar(
            mesh,
            datos,
            "Esa silueta es de otra herramienta. Cada una tiene la suya: por eso están dibujadas."
          );
          return;
        }

        sitio.hueco.ocupado = true;
        objeto.fijar();
        realce.quitar(mesh);

        moverMalla(scene, mesh, sitio.hueco.centro, 240);
        luegoDe(scene, 260, () => {
          colgarEnSilueta(mesh);
          mesh.scaling.setAll(ESCALA_COLOCADO);
        });

        // LA ETIQUETA SE ESCRIBE SOLA.
        //
        // Es la segunda mitad de la regla del curso —"una etiqueta para cada
        // cosa"— y verla aparecer al acertar enseña que el lugar sin rótulo no
        // basta: el sitio queda identificado para quien venga después.
        tablero.rotular(sitio.hueco.id, datos.nombreVisible);

        gameManager.sumarPuntos(10);
        reproducir("acierto");
        hud.mostrarFeedback(true, datos.explicacion, mesh.position.clone());
        registrarAvance();
        return;
      }

      // --- Estantería: frecuencia y, por encima de todo, peso ---
      const nivel = sitio.balda.nivel;

      if (datos.destino !== nivel) {
        fallar(
          mesh,
          datos,
          datos.destino === "inferior"
            ? "Pesa demasiado para esa altura. Los objetos de gran peso van en la balda inferior."
            : datos.destino === "tablero"
              ? "Esta se usa a diario: su sitio es el tablero, sobre el banco, no la estantería."
              : "La balda inferior es para el peso. Esto se consulta de vez en cuando: va a la media."
        );
        return;
      }

      const indice = ocupacion[nivel];
      ocupacion[nivel]++;

      objeto.fijar();
      realce.quitar(mesh);

      moverMalla(scene, mesh, estante.lugarEnBalda(nivel, indice), 240);
      luegoDe(scene, 260, () => {
        mesh.rotation.y = 0;
        mesh.scaling.setAll(ESCALA_COLOCADO);
        apoyarSobre(mesh, sitio.balda.superficieY);
      });

      // Misma regla que en el tablero: el sitio queda rotulado solo.
      estante.rotular(nivel, indice, datos.nombreVisible);

      gameManager.sumarPuntos(10);
      reproducir("acierto");
      hud.mostrarFeedback(true, datos.explicacion, mesh.position.clone());
      registrarAvance();
    });
  });

  // Se devuelven los huecos del tablero: main.ts los usa para las sombras.
  return { objetos, slots: tablero.huecos };
}