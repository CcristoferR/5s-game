import {
  Scene,
  FreeCamera,
  Vector3,
  Color4,
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import {
  cargarSupermercado,
  iluminarSupermercado,
  ampliarLucesSupermercado,
  type SupermercadoCargado,
} from "./EscenaSupermercado";
import { limpiarEscena, usarCamara } from "./LimpiezaEscena";
import { construirBodega } from "./BodegaSupermercado";
import { crearDetectorZonas, comprobarPlano, PUERTA_X } from "./ZonasSupermercado";
import { crearHudRecorrido } from "./HudRecorrido";
import { crearRelojTurno } from "./RelojTurno";
import { horaDe } from "./LibroNovedades";

// ===========================================================================
// Escenario 2 — Supermercado
// ===========================================================================
//
// El nivel se monta por pasos sobre el escenario recorrible. Por ahora tiene
// lo que hace que el local deje de ser un espacio suelto: cuatro zonas con
// nombre (ZonasSupermercado, con la bodega que el modelo no traía) y un turno
// que corre desde las 16:00 (RelojTurno, el mismo del condominio).
//
// ─── POR QUÉ ESTO EXISTE ANTES QUE LA MECÁNICA ────────────────────────────
//
// Porque el escenario llegó de Bitplay y hay que comprobarlo antes de montarle
// nada encima: que las texturas carguen, que la escala sea la que dice, que se
// pueda caminar dentro y que la iluminación funcione. Si algo de eso falla y ya
// hubiera lógica de nivel por medio, no habría forma de saber qué está roto.
//
// Es el mismo orden que se siguió con el garaje del 5S: primero entrar y mirar,
// después jugar.
//
// ─── Y POR QUÉ SE CAMINA EN VEZ DE ORBITAR ────────────────────────────────
//
// El escenario 1 tiene la cámara fija en la silla del conserje porque el
// trabajo ocurre en el mesón. Aquí es al revés: lo que hay que evaluar es si
// los pasillos, las góndolas y las alturas funcionan para un guardia que
// recorre la sala. Eso solo se sabe caminándola.

export interface RecorridoSupermercado {
  supermercado: SupermercadoCargado;
  /**
   * Arranca el turno: el reloj y los carteles de zona.
   *
   * Aparte de la creación a propósito. Hay que llamarla cuando la pantalla de
   * carga ya se fue; hacerlo antes es entrar con el turno empezado.
   */
  comenzar: () => void;
  dispose: () => void;
}

/** Altura de los ojos de una persona de pie. */
const ALTURA_OJO = 1.65;

/** Las 16:00 en minutos desde medianoche: el turno de tarde del local. */
const INICIO_TURNO = 16 * 60;
/** Ocho horas, como el turno del condominio. */
const DURACION_TURNO = 8 * 60;
/** El color del escenario, el mismo de su pantalla de carga en JuegoGuardias. */
const ACENTO = "#79a8bd";

export async function crearRecorridoSupermercado(
  scene: Scene,
  onSalir: () => void
): Promise<RecorridoSupermercado> {
  // Lo primero: vaciar lo que dejó el condominio. Ver LimpiezaEscena.
  limpiarEscena(scene);

  scene.clearColor = new Color4(0.09, 0.1, 0.13, 1);

  // La cámara se crea ANTES de cargar el modelo, y no después.
  //
  // limpiarEscena deja scene.activeCamera en null, y el bucle de render de
  // main.ts sigue corriendo mientras se descarga el .glb. Sin cámara, cada uno
  // de esos cuadros lanzaba "No camera defined": la escena quedaba en negro y
  // no se recuperaba aunque el modelo terminara de cargar.
  //
  // Creándola primero, el bucle siempre tiene a qué apuntar. Durante la carga
  // dibuja una escena vacía, que es exactamente lo que la pantalla de carga
  // está tapando.
  const camara = new FreeCamera(
    "camaraRecorrido",
    new Vector3(0, ALTURA_OJO, 0),
    scene
  );
  camara.minZ = 0.1;
  camara.speed = 0.14;
  camara.angularSensibility = 3200;
  camara.inertia = 0.82;

  // WASD además de las flechas: es lo que espera cualquiera que haya caminado
  // por un escenario en 3D.
  camara.keysUp.push(87);
  camara.keysDown.push(83);
  camara.keysLeft.push(65);
  camara.keysRight.push(68);

  // El jugador camina, no vuela: la cámara tiene volumen y choca con las
  // góndolas y los muros en vez de atravesarlos.
  scene.collisionsEnabled = true;
  camara.checkCollisions = true;
  camara.applyGravity = false;
  camara.ellipsoid = new Vector3(0.35, ALTURA_OJO / 2, 0.35);
  camara.ellipsoidOffset = new Vector3(0, ALTURA_OJO / 2, 0);

  usarCamara(scene, camara);

  // ESCALA 2,5. El modelo llega a menos de la mitad de tamaño.
  //
  // Medido sobre el propio OBJ: las góndolas salen de 0,72 m y una de verdad
  // mide 1,80. El mostrador de caja, 0,37 en vez de 1,10. El edificio entero,
  // 2,58 en vez de los seis y pico de una nave con parapeto y letrero.
  //
  // Tres piezas independientes dan factores de 2,4, 2,5 y 3,0: coinciden, así
  // que el modelo está a escala uniforme y solo hay que multiplicarlo. Si los
  // factores hubieran salido dispares, el problema sería otro y esto lo
  // habría tapado.
  //
  // De ahí venía lo de "aparezco volando": la cámara estaba a su altura
  // correcta de 1,65: eran las estanterías las que llegaban a la rodilla. No
  // había nada que corregir en la cámara.
  //
  // Se aplica al cargar y no moviendo la cámara porque de aquí salen también
  // el interior donde se puede caminar, la altura de las luces y las cajas de
  // colisión. Tocando solo la cámara, todo eso seguiría en miniatura.
  const supermercado = await cargarSupermercado(scene, {
    escala: 2.5,
    diagnostico: true,
  });

  // Ya con las medidas del modelo, se planta al jugador dentro de la sala.
  //
  // Se usa el INTERIOR y no el conjunto: el modelo trae un piso de 13,4 m y un
  // edificio de 8,3 × 6,1 dentro de él, así que la mitad de esa superficie es
  // explanada exterior. Colocando desde las medidas del conjunto se aparecía
  // fuera, detrás del muro trasero.
  //
  // Y se le planta recién pasada la puerta de vidrio, no en el centro de la
  // fachada: el turno empieza entrando al local, y el primer cartel que ve es
  // el de la entrada.
  const { interior } = supermercado;
  camara.position.set(PUERTA_X, ALTURA_OJO, interior.maxZ - 0.8);
  camara.setTarget(
    new Vector3((interior.minX + interior.maxX) / 2, ALTURA_OJO - 0.15, interior.minZ)
  );

  // ─── NO SE VUELA ──────────────────────────────────────────────────────
  //
  // Una FreeCamera avanza HACIA DONDE MIRA. Con la vista algo levantada y la
  // tecla de avanzar pulsada, eso es despegar — y no hacía falta ni querer:
  // bastaba caminar mirando un estante alto para ir subiendo sin darse
  // cuenta.
  //
  // Se fija la altura en cada cuadro en vez de activar la gravedad. La
  // gravedad resuelve la caída, pero deja el problema al revés: se sigue
  // pudiendo subir mirando arriba, y luego se cae. Aquí el suelo es uno y
  // plano, así que clavar la altura es más simple y no falla nunca.
  //
  // Mirar arriba y abajo sigue funcionando igual: lo que se anula es el
  // desplazamiento vertical, no la vista.
  //
  // El observador se guarda para quitarlo al salir. Antes no se quitaba: la
  // escena es la misma para todo el curso, así que cada entrada al
  // supermercado dejaba uno más escribiendo sobre una cámara ya destruida.
  const alturaCaminando = camara.position.y;
  const alturaFija = scene.onBeforeRenderObservable.add(() => {
    camara.position.y = alturaCaminando;
  });

  // La bodega no viene en el modelo: se construye. Ver BodegaSupermercado.
  // Antes de las luces, para que sus materiales entren en la ampliación del
  // tope de luces que se hace más abajo.
  const bodega = construirBodega(scene, camara, supermercado);

  // Los pasillos se reparten a lo largo del fondo de la sala. Se calculan desde
  // las medidas reales y no a ojo: si Bitplay manda una versión más grande, los
  // focos siguen cayendo donde tienen que caer.
  const pasillos = [-0.28, 0, 0.28].map((f) => supermercado.fondo * f);
  iluminarSupermercado(scene, supermercado.alto, pasillos);
  ampliarLucesSupermercado(scene);

  camara.attachControl(true);

  // --- Post-proceso ---------------------------------------------------------
  //
  // Discreto a propósito. En una sala de ventas no hay nada que florezca ni
  // viñeta que valga: el sitio está para que el producto se vea plano y parejo.
  // Lo único que aporta aquí es el suavizado de bordes, porque las góndolas son
  // todo líneas rectas y sin él se ven en escalera.
  const tuberia = new DefaultRenderingPipeline(
    "postProcesoSupermercado",
    true,
    scene,
    [camara]
  );
  tuberia.samples = 4;
  tuberia.bloomEnabled = false;
  tuberia.imageProcessingEnabled = true;
  tuberia.imageProcessing.contrast = 1.04;
  tuberia.imageProcessing.exposure = 1;
  tuberia.imageProcessing.toneMappingEnabled = true;

  // --- Salir ----------------------------------------------------------------
  const alPulsar = (e: KeyboardEvent): void => {
    if (e.key === "Escape") salir();
  };
  window.addEventListener("keydown", alPulsar);

  let cerrado = false;
  const ayuda = document.createElement("div");
  ayuda.textContent = "WASD o flechas para caminar · arrastrar para mirar · ESC para volver";
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
  });
  document.body.appendChild(ayuda);

  // ─── EL TURNO Y LAS ZONAS ─────────────────────────────────────────────
  //
  // Se montan aquí pero NO arrancan: lo hace comenzar(), con la pantalla de
  // carga ya retirada. Montar el escenario y esperar a que compile puede
  // llevar diez segundos, y con el reloj corriendo por detrás el jugador
  // entraría con el turno empezado y el cartel de la entrada ya visto por
  // nadie.
  const hud = crearHudRecorrido({
    hora: horaDe(INICIO_TURNO),
    turno: "Turno 16:00 a 24:00 horas",
    acento: ACENTO,
  });

  // El mismo reloj del condominio, a su misma velocidad. Cuenta minutos de
  // turno desde cero; la hora de pared se suma al mostrarla.
  const reloj = crearRelojTurno(scene, {
    minutoFinal: DURACION_TURNO,
    alAvanzar: (minuto) => hud.ponerHora(horaDe(INICIO_TURNO + minuto)),
  });

  const zonas = crearDetectorZonas((zona) => hud.anunciarZona(zona.nombre, zona.bajada));
  let enMarcha = false;
  /** Un respiro antes del primer cartel: que primero se vea la sala. */
  let esperaPrimerCartel = 0.8;
  const seguirZonas = scene.onBeforeRenderObservable.add(() => {
    if (!enMarcha) return;
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    if (esperaPrimerCartel > 0) {
      esperaPrimerCartel -= dt;
      return;
    }
    zonas.actualizar(camara.position.x, camara.position.z, dt);
  });

  const comenzar = (): void => {
    if (cerrado || enMarcha) return;
    enMarcha = true;
    // Ya con cuadros dibujados, que es cuando las cajas envolventes del
    // modelo están donde se ven.
    comprobarPlano(supermercado.mallas);
    hud.mostrar();
    reloj.correr(true);
  };

  /**
   * Sale del recorrido y devuelve el menú.
   *
   * ─── POR QUÉ DESMONTA TODO ANTES DE AVISAR ────────────────────────────
   *
   * Porque antes no lo hacía: soltaba el ratón de la cámara y llamaba al menú
   * dejando la escena tal cual. El resultado era que el menú se dibujaba
   * encima del supermercado, sobre su fondo azul, con el cartel de ayuda
   * todavía pegado abajo — y los quince megas del modelo seguían en memoria.
   *
   * El orden importa: primero se suelta el mando, después se desmonta la
   * escena, después se devuelve el color de fondo del portal, y solo entonces
   * se avisa. Avisar antes deja al menú montándose sobre una escena que se
   * está destruyendo debajo.
   */
  const salir = (): void => {
    if (cerrado) return;
    cerrado = true;
    window.removeEventListener("keydown", alPulsar);
    camara.detachControl();

    ayuda.remove();
    scene.onBeforeRenderObservable.remove(alturaFija);
    scene.onBeforeRenderObservable.remove(seguirZonas);
    reloj.dispose();
    hud.dispose();
    bodega.dispose();
    tuberia.dispose();
    // limpiarEscena deja además una cámara neutra y el fondo del portal, así
    // que el menú aparece sobre algo dibujable y con su color de siempre.
    limpiarEscena(scene);

    onSalir();
  };


  return {
    supermercado,
    comenzar,
    // salir() ya desmonta la escena entera, así que esto es solo el atajo por
    // si alguien cierra el recorrido desde fuera sin pasar por ESC.
    dispose: salir,
  };
}