import { Scene, MeshBuilder, Color3, Vector3, Mesh, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import { TextBlock, Control } from "@babylonjs/gui";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { objetosNivel1, pesadosNivel1, briefingsNiveles, microLeccionesNiveles } from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { crearObjetoInteractable } from "../entities/InteractableObject";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { moverMalla, luegoDe } from "../core/Animacion";
import { crearDropZone } from "../entities/DropZone";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { crearFormaNivel1 } from "../entities/Level1Shapes";
import { crearRotulo3D } from "../entities/Rotulo3D";
import {
  crearPalletConCajas,
  crearTamboresAceite,
  crearPilaDeCajas,
  crearExtintor,
  crearBasureroIndustrial,
} from "../entities/WorkshopProps";
import { pedirDatosTarjeta, colocarTarjetaRoja, crearAreaDescarte, interpretarPlazo } from "../entities/TarjetaRoja";
import { reproducir } from "../core/Sonido";
import { TEXTO } from "../ui/EstiloUI";
import { GameManager } from "../core/GameManager";
import { HUD } from "../ui/HUD";

/**
 * Profundidad de las dos zonas de clasificación.
 *
 * Se mantienen adelante, cerca de la cámara: los objetos ahora vienen de todo
 * el galpón, así que las zonas son el punto de llegada y conviene que estén
 * siempre a la vista mientras se recorre el fondo buscando.
 */
const Z_ZONA = 2.4;

/**
 * Recinto por el que se puede arrastrar.
 *
 * Sin esto los objetos se salian del galpon, y no era un problema estetico
 * sino un bloqueo: el arrastre corre sobre un plano horizontal y la camara
 * llega casi a ras del piso (beta 1.52), asi que el rayo del cursor corta ese
 * plano a decenas de metros. Un movimiento brusco hacia el horizonte mandaba
 * la pieza fuera del recinto, la camara esta limitada a los muros y ya no
 * habia forma de recuperarla ni de terminar el nivel.
 *
 * Los margenes salen de las zonas, no de un numero redondo: las demarcaciones
 * llegan hasta x = 4.4 y hasta z = Z_ZONA + 1.6, y hay que poder soltar dentro
 * de ellas con holgura. Por detras se corta antes de los muros del garaje
 * (x = 5.8, z = 9.2) para que nada quede pegado contra una pared.
 */
const LIMITES_ARRASTRE = {
  // Cerrado de ±4,9 a ±4,3.
  //
  // A 4,9 los objetos seguían metiéndose en el muro: el límite mide el CENTRO
  // de la malla, y con la escala del nivel las piezas sobresalen medio metro
  // hacia los lados. Restando ese medio metro dejan de tocar la pared.
  xMin: -4.3,
  xMax: 4.3,
  zMin: -2.0,
  zMax: Z_ZONA + 1.7,
};

/**
 * Aumento de los objetos del nivel.
 *
 * Subido de 1,7 a 2,2 tras probarlo en el galpón: a 1,7 las piezas chicas
 * —cinta métrica, engrapadora— seguían costando de distinguir desde el otro
 * extremo, y en este nivel hay que ENCONTRARLAS antes de clasificarlas.
 */
const ESCALA_OBJETO = 2.2;

/**
 * Apoya una malla sobre una superficie, sea cual sea su escala.
 *
 * Mide la caja envolvente ya escalada y corrige la altura, así que ningún
 * objeto queda flotando ni hundido en la balda.
 */
function apoyarSobre(malla: Mesh, alturaSuperficie: number): void {
  malla.computeWorldMatrix(true);
  const base = malla.getBoundingInfo().boundingBox.minimumWorld.y;
  malla.position.y += alturaSuperficie - base;
}

export function cargarNivel1(scene: Scene, hud: HUD, onVolverMenu: () => void, onCompletado: () => void) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // ESCENARIO: el garaje real entregado por Bitplay reemplaza a la oficina
  // que antes se generaba por código. La carga es asíncrona: los objetos del
  // nivel se crean igual y el garaje aparece un instante después.
  //
  // A propósito NO se le pasa el shadowGenerator: el garaje tiene techo, y
  // si el techo proyectara la sombra de la luz direccional dejaría todo el
  // interior a oscuras. La luz de adentro la resuelve iluminarInteriorGaraje.
  void cargarGaraje(scene).catch((error) => console.error("[nivel1] garaje:", error));
  iluminarInteriorGaraje(scene, [
    { z: -0.5, intensidad: 0.9 },
    { z: 2.2, intensidad: 0.7, tinte: new Color3(0.95, 0.96, 1) },
  ]);

  // Utileria de fondo. Ver AmbienteNivel.ts: la cantidad y el tipo cambian
  // por nivel para acompanar lo que ensena cada S.
  ambientarNivel(scene, 1);

  // Suelo invisible al ras del piso del garaje. No se ve, pero sigue
  // llamándose "suelo" porque main.ts lo busca por ese nombre para decirle
  // a WebXR sobre qué superficie se puede teletransportar.
  const suelo = MeshBuilder.CreateGround("suelo", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // SIN BANCO DE TRABAJO EN ESTE NIVEL.
  //
  // La mesa era el centro de la escena y con ella los objetos volvían a
  // ordenarse solos encima. Seiri no empieza con todo dispuesto sobre una
  // superficie: empieza con el material donde estorba. Quitarla libera el
  // centro para las dos zonas y obliga a recorrer el galpón.
  //
  // Los demás niveles la conservan: en el 2 es la estación de trabajo.

  // Panel de apertura: explica de qué va la S antes de empezar.
  // Panel de apertura: explica de qué va la S antes de empezar. El cronómetro
  // no arranca acá — arranca con el primer objeto que se toca, así que leer no
  // cuesta puntos.
  // El callback va VACÍO a propósito.
  //
  // Antes daba una indicación con hud.mostrarFeedback(true, ...), y esa
  // función no solo escribe un cartel: reproduce el sonido de acierto y lanza
  // las chispas de celebración. O sea que el juego felicitaba al jugador al
  // cerrar el panel de apertura, antes de que hubiera hecho absolutamente
  // nada — y encima gastaba el efecto que debería marcar el primer acierto.
  //
  // El objetivo del nivel ya está permanente en el panel del HUD, así que no
  // hace falta anunciarlo por otra vía.
  mostrarAperturaNivel(scene, 1, briefingsNiveles[1], microLeccionesNiveles[1], () => {});

  // ===================================================================
  // OBJETOS REPARTIDOS POR EL TALLER
  // ===================================================================
  //
  // Ya no hay una fila de objetos sobre el banco. Cada uno está donde
  // estorbaría de verdad —bloqueando el portón, tirado en el pasillo,
  // olvidado en una repisa, caído detrás de la estantería— y el jugador
  // tiene que recorrer el galpón para encontrarlos.
  //
  // El banco sigue en escena, pero como mueble: sostiene dos objetos, no diez.
  const objetos = objetosNivel1.map((datos) => {
    const objeto = crearObjetoInteractable(scene, datos, crearFormaNivel1, LIMITES_ARRASTRE);

    // Aumentados respecto de su tamaño real.
    //
    // A escala 1:1 una engrapadora mide 15 cm y el galpón mide 12 x 19 m: en
    // pantalla eran motas, y peor todavía repartidas por todo el recinto en
    // vez de alineadas sobre una mesa. Agrandados se reconocen desde el otro
    // extremo, que es condición para poder buscarlos.
    objeto.mesh.scaling.setAll(datos.escala ?? ESCALA_OBJETO);

    const [px, superficieY, pz] = datos.posicionInicial;
    objeto.mesh.position.set(px, superficieY, pz);
    if (datos.rotacionY !== undefined) objeto.mesh.rotation.y = datos.rotacionY;

    // La altura del dato es la de la SUPERFICIE donde se apoya —el piso, la
    // tapa de un pallet, una balda— y acá se corrige para que quede encima y
    // no atravesándola ni flotando. Con la escala aplicada ninguna altura fija
    // serviría: cada pieza mide distinto.
    apoyarSobre(objeto.mesh, superficieY);

    return objeto;
  });

  // ===================================================================
  // PESADOS: NO SE MUEVEN
  // ===================================================================
  //
  // Video 3.1: si un objeto innecesario es muy pesado, se le pone la tarjeta y
  // se DEJA EN SU LUGAR, con un plazo para gestionar el traslado. Intentar
  // arrastrarlos sería enseñar lo contrario, así que directamente no se
  // arrastran: solo aceptan tarjeta roja.
  //
  // Su forma sale de la utilería del taller que ya existía, sin modelar nada
  // nuevo.
  // Extintor en la pared derecha, DETRÁS de la pila de cajas.
  //
  // El curso insiste en que el desorden no solo estorba: oculta riesgos. Un
  // pasillo con cajas delante del extintor no es un problema de estética — es
  // que el día del incendio nadie lo alcanza. Se monta antes que la pila para
  // que quede tapado, y al retirarla aparecen el cartel y la marca del piso
  // que explican solos por qué había que despejar.
  crearExtintor(scene, 5.55, 0.2, -Math.PI / 2);

  // Basurero, separado del área de descarte.
  const basurero = crearBasureroIndustrial(scene, -4.55, -0.55);
  crearRotulo3D(scene, "basurero", "BASURA", new Vector3(-4.55, 1.6, -0.55), {
    ancho: 0.95,
    alto: 0.24,
    lineasMax: 1,
    colorFondo: "#1a1f24",
    colorBorde: "rgba(255,255,255,0.22)",
    mirarCamara: true,
    alturaTextoMin: 0.1,
  });

  const pesados = pesadosNivel1.map((datos) => {
    const [px, pz] = datos.posicion;
    if (datos.forma === "pallet") crearPalletConCajas(scene, px, pz);
    else if (datos.forma === "tambores") crearTamboresAceite(scene, px, pz);
    else crearPilaDeCajas(scene, px, pz, 5);

    // Zona de clic propia: la utilería del taller no es interactuable, así que
    // se le monta encima un volumen invisible que sí lo es. Evita tener que
    // rehacer esas piezas solo para poder pincharlas.
    const zona = MeshBuilder.CreateBox(`pesado_${datos.id}`, { width: 1.3, height: 1.1, depth: 1.3 }, scene);
    zona.position.set(px, 0.6, pz);

    // TRANSPARENTE, NO INVISIBLE. La diferencia decide si funciona o no.
    //
    // isVisible = false lo saca del sondeo de punteros —Babylon descarta lo
    // invisible antes de comprobar si es pinchable— así que el volumen no
    // recibía nunca el clic y los dos objetos pesados eran imposibles de
    // etiquetar. Con visibility = 0 la malla sigue "visible" para el sondeo
    // pero no se dibuja.
    zona.visibility = 0;
    zona.isPickable = true;

    // Rótulo permanente. Los objetos sueltos avisan al pasar el cursor por
    // encima, pero estos son utilería del taller: sin un cartel no hay nada
    // que insinúe que se puede actuar sobre ellos.
    // Cartel mas grande y mas alto.
    //
    // Medía 1,50 x 0,26 m con letras de 7,5 cm, y estos tres objetos están al
    // fondo del galpón: desde donde arranca la cámara quedaba una rayita
    // ilegible. El problema no era la resolución de la textura —el rótulo va a
    // 1400 px por metro— sino el tamaño físico del cartel. Un rótulo de planta
    // se dimensiona por la distancia desde la que hay que leerlo.
    // El rótulo se corre hacia el centro del galpón.
    //
    // Los bultos están contra las paredes, y un cartel que mira siempre a la
    // cámara sobresale medio metro hacia los lados: pegado al muro, la mitad
    // del texto quedaba fuera de la pared y se veía cortado. Desplazarlo hacia
    // dentro lo deja entero sin dejar de señalar su bulto.
    const desplazado = px > 0 ? px - 0.9 : px < 0 ? px + 0.9 : px;

    crearRotulo3D(scene, `pesado_${datos.id}`, datos.nombreVisible, new Vector3(desplazado, 1.62, pz), {
      ancho: 2.1,
      alto: 0.42,
      lineasMax: 2,
      colorFondo: "#1a1f24",
      colorBorde: "rgba(255,255,255,0.3)",
      mirarCamara: true,
      alturaTextoMin: 0.135,
    });

    return { datos, zona, etiquetado: false };
  });

  const realce = habilitarRealceAlPasar(scene, objetos.map((o) => o.mesh));

  habilitarEtiquetasAlPasar(
    scene,
    gui,
    objetos.map((o) => ({ mesh: o.mesh, texto: o.datos.nombreVisible }))
  );

  // ===================================================================
  // DOS ZONAS, NO TRES
  // ===================================================================
  //
  // Desapareció "Dudoso". Era una tercera pila donde ir dejando lo que no se
  // quería decidir, y Seiri consiste justamente en decidir. Lo que el curso
  // plantea para lo no resuelto es la tarjeta roja: el objeto queda marcado
  // con responsable y plazo, y va igual al área de descarte.
  const zonaNecesario = crearDropZone(
    scene,
    "necesario",
    -3.0,
    new Color3(0.2, 0.7, 0.3),
    gui,
    // NO se llama "Necesario".
    //
    // En Seiri lo necesario no se lleva a ninguna zona: se queda donde está y
    // se despeja alrededor. La zona existe solo por mecánica —hay que poder
    // comprobar que el jugador lo reconoció— así que el cartel dice lo que de
    // verdad es: un área donde se retiene lo útil mientras se limpia. El orden
    // fino llega en Seiton.
    "ÁREA DE RETENCIÓN — lo que se conserva"
  );

  // Área de descarte con su cinta roja perimetral. Video 3.1: los objetos
  // etiquetados "deben ser llevados a un lugar específico al cual llamaremos
  // área de descarte", que además permite medir en metros cuadrados lo
  // liberado.
  const zonaDescarte = crearDropZone(
    scene,
    "descartar",
    3.0,
    new Color3(0.75, 0.2, 0.2),
    gui,
    "ÁREA DE DESCARTE"
  );
  crearAreaDescarte(scene, 3.0, Z_ZONA, 3.2, 3.2);

  let inicioNivel = performance.now();
  let corriendoTiempo = false;

  hud.definirObjetivo("Recorre el taller y clasifica lo que estorba.");
  hud.definirTotalTarea(objetosNivel1.length + pesadosNivel1.length);

  // Metros cuadrados liberados. Es el indicador que el curso propone para
  // dimensionar el resultado de la 1S, y aquí es el que le da sentido a mover
  // un pallet entero frente a tirar una taza.
  let metrosLiberados = 0;
  const metrosTotales =
    objetosNivel1.reduce((suma, o) => suma + o.metros, 0) +
    pesadosNivel1.reduce((suma, o) => suma + o.metros, 0);

  const contadorEspacio = new TextBlock(
    "espacioRecuperado",
    `Espacio recuperado: 0,00 m² de ${metrosTotales.toFixed(2).replace(".", ",")} m²`
  );
  contadorEspacio.color = "white";
  contadorEspacio.fontSize = TEXTO.cuerpo;
  contadorEspacio.fontWeight = "600";
  contadorEspacio.outlineWidth = 3;
  contadorEspacio.outlineColor = "rgba(0,0,0,0.6)";
  contadorEspacio.top = "-96px";
  contadorEspacio.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  gui.addControl(contadorEspacio);

  const sumarMetros = (metros: number): void => {
    if (metros <= 0) return;
    metrosLiberados += metros;
    contadorEspacio.text = `Espacio recuperado: ${metrosLiberados
      .toFixed(2)
      .replace(".", ",")} m² de ${metrosTotales.toFixed(2).replace(".", ",")} m²`;
  };

  let resueltos = 0;
  let tarjetasEmitidas = 0;

  // Se vacía el registro al empezar: si se rejuega el Nivel 1, las tarjetas de
  // la vuelta anterior no deben aparecer en la auditoría.
  gameManager.limpiarTarjetasRojas();
  const conteo = { necesario: 0, descartar: 0, tarjetaRoja: 0 };

  const registrarAvance = (): void => {
    resueltos++;
    hud.actualizarProgreso(resueltos);

    if (resueltos < objetosNivel1.length + pesadosNivel1.length) return;

    const segundosTotales = Math.round((performance.now() - inicioNivel) / 1000);
    const bonusTiempo = Math.max(0, 120 - segundosTotales);
    gameManager.sumarPuntos(bonusTiempo);
    onCompletado();

    hud.mostrarFeedback(
      true,
      `Clasificación completa · ${metrosLiberados.toFixed(2).replace(".", ",")} m² liberados · ` +
        `${conteo.tarjetaRoja} tarjeta${conteo.tarjetaRoja === 1 ? "" : "s"} roja${
          conteo.tarjetaRoja === 1 ? "" : "s"
        } emitida${conteo.tarjetaRoja === 1 ? "" : "s"}`
    );

    luegoDe(scene, 1200, () => {
      preguntarCierreDeNivel(gui, hud, 1, (cierre) => {
        luegoDe(scene, 700, () => {
          hud.mostrarResultadoFinal(
            "Nivel 1",
            resueltos * 10,
            bonusTiempo,
            segundosTotales,
            onVolverMenu,
            cierre
          );
        });
      });
    });
  };

  // ===================================================================
  // TARJETA ROJA SOBRE LOS PESADOS
  // ===================================================================
  pesados.forEach((pesado) => {
    pesado.zona.actionManager = new ActionManager(scene);
    pesado.zona.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if (pesado.etiquetado) return;

        if (!corriendoTiempo) {
          corriendoTiempo = true;
          inicioNivel = performance.now();
        }

        pedirDatosTarjeta(gui, pesado.datos.nombreVisible, pesado.datos.donde, (datos) => {
          if (!datos) return;

          pesado.etiquetado = true;
          tarjetasEmitidas++;

          // Se registra para el Nivel 5: ahí el jugador tendrá que auditar su
          // propia tarjeta y comprobar si el plazo que escribió ya venció.
          gameManager.registrarTarjetaRoja({
            objetoId: pesado.datos.id,
            nombreObjeto: pesado.datos.nombreVisible,
            responsable: datos.responsable,
            plazoTexto: datos.plazo,
            plazo: interpretarPlazo(datos.plazo),
          });

          conteo.tarjetaRoja++;

          const [px, pz] = pesado.datos.posicion;

          // Altura según lo que se etiqueta, y siempre POR DELANTE del bulto.
          //
          // Antes iba a 0,62 m fijos y desplazada de lado: sobre el pallet
          // funcionaba, pero dentro de la pila de cajas —que llega al metro y
          // medio— la tarjeta quedaba enterrada entre los bultos y no se veía
          // aparecer. Cada forma tiene su altura y la tarjeta se adelanta para
          // que nada la tape.
          const alturaTarjeta =
            pesado.datos.forma === "pila" ? 1.5 : pesado.datos.forma === "tambores" ? 1.0 : 0.55;

          colocarTarjetaRoja(
            scene,
            pesado.datos.id,
            px,
            alturaTarjeta,
            pz - 0.8,
            tarjetasEmitidas,
            datos
          );

          // Suma metros aunque no se mueva: el espacio sigue ocupado hoy, pero
          // ya está comprometido con responsable y plazo. Es exactamente lo
          // que mide el área de descarte del curso.
          sumarMetros(pesado.datos.metros);
          reproducir("acierto");
          hud.mostrarFeedback(true, pesado.datos.explicacion);
          registrarAvance();
        });
      })
    );
  });

  // ===================================================================
  // CLASIFICACIÓN DE LO QUE SÍ SE MUEVE
  // ===================================================================
  // Separación entre objetos ya clasificados.
  //
  // Subida de 0,62 a 0,95: los objetos están al doble de tamaño que antes, y
  // con la rejilla vieja se encimaban unos con otros dentro de la zona.
  const MEDIO_LADO_UTIL = 0.78;

  /**
   * Tamaño al que quedan los objetos una vez clasificados.
   *
   * Mientras hay que ENCONTRARLOS conviene que sean grandes; una vez dentro de
   * la zona, lo que importa es que quepan y se lean como un conjunto ordenado.
   * A tamaño de búsqueda no entraban diez piezas en un cuadro de 2,2 m y se
   * montaban unas sobre otras.
   *
   * Que se achiquen al llegar además refuerza la idea: el área clasificada se
   * ve ordenada, no como otro montón.
   */
  const ESCALA_ORDENADO = 1.15;

  /** Lleva el objeto a su casilla y lo deja ordenado y derecho. */
  const acomodarEnZona = (mesh: Mesh, destino: Vector3): void => {
    moverMalla(scene, mesh, destino, 260);
    luegoDe(scene, 270, () => {
      mesh.scaling.setAll(ESCALA_ORDENADO);
      // Alineado con la zona: lo clasificado deja de estar al voleo.
      mesh.rotation.y = 0;
      apoyarSobre(mesh, 0.02);
    });
  };
  const lugarEnZona = (x: number, indice: number): Vector3 => {
    // Cuatro columnas por tres filas: doce casillas dentro del cuadro de la
    // zona. Con tres columnas no entraban las diez piezas.
    const columna = indice % 4;
    const fila = Math.floor(indice / 4);
    return new Vector3(
      x + (columna - 1.5) * MEDIO_LADO_UTIL,
      0.02,
      Z_ZONA + (fila - 1) * MEDIO_LADO_UTIL
    );
  };

  objetos.forEach((objeto) => {
    objeto.onSoltar.add(({ mesh, movioSuficiente }) => {
      if (!movioSuficiente) return;

      if (!corriendoTiempo) {
        corriendoTiempo = true;
        inicioNivel = performance.now();
      }

      // Se comprueba por cercanía al centro de la zona. DropZone expone la
      // malla, no un test de contención, así que el criterio vive acá: medio
      // lado de la demarcación, que es lo que se ve pintado en el piso.
      const dentroDe = (centroX: number): boolean =>
        Math.abs(mesh.position.x - centroX) <= 1.4 && Math.abs(mesh.position.z - Z_ZONA) <= 1.4;

      // --- ¿Al basurero? ---
      //
      // Se comprueba primero y NO abre ningún formulario: la basura no lleva
      // tarjeta ni responsable ni plazo. Que la interacción sea distinta es
      // parte de la lección — soltar y desaparece, sin trámite.
      const enBasurero =
        Math.abs(mesh.position.x - basurero.position.x) < 1.0 &&
        Math.abs(mesh.position.z - basurero.position.z) < 1.0;

      if (enBasurero) {
        if (objeto.datos.destino !== "basura") {
          reproducir("error");
          hud.mostrarFeedback(
            false,
            objeto.datos.destino === "necesario"
              ? "Eso sirve. Al tacho va solo el residuo evidente."
              : "Esto no es basura: hay que decidir qué hacer con ello. Va al área de descarte, con tarjeta si corresponde.",
            mesh.position.clone()
          );
          moverMalla(scene, mesh, new Vector3(objeto.datos.posicionInicial[0], 0, objeto.datos.posicionInicial[2]), 300);
          luegoDe(scene, 320, () => apoyarSobre(mesh, objeto.datos.posicionInicial[1]));
          return;
        }

        objeto.fijar();
        realce.quitar(mesh);

        // Cae dentro y desaparece: no ocupa sitio en ninguna zona, porque
        // dejó de existir para el área.
        moverMalla(scene, mesh, new Vector3(basurero.position.x, 0.75, basurero.position.z), 240);
        luegoDe(scene, 260, () => mesh.dispose());

        sumarMetros(objeto.datos.metros);
        gameManager.sumarPuntos(10);
        reproducir("acierto");
        hud.mostrarFeedback(true, objeto.datos.explicacion, mesh.position.clone());
        registrarAvance();
        return;
      }

      const enNecesario = dentroDe(-3.0);
      const enDescarte = dentroDe(3.0);
      if (!enNecesario && !enDescarte) return;

      const destino = objeto.datos.destino;

      // Lo necesario y lo que va directo a la basura se resuelven soltándolo
      // en la zona que corresponde.
      const aciertoDirecto =
        (enNecesario && destino === "necesario") || (enDescarte && destino === "descartar");

      // Lo que requiere tarjeta roja también termina en el área de descarte,
      // pero solo cuenta si viene etiquetado. Soltarlo sin tarjeta es saltarse
      // el paso: no se sabe quién responde ni hasta cuándo.
      const necesitaTarjeta = enDescarte && destino === "tarjetaRoja";

      if (necesitaTarjeta) {
        pedirDatosTarjeta(gui, objeto.datos.nombreVisible, objeto.datos.donde, (datos) => {
          if (!datos) {
            // Sin tarjeta no se queda en el área: vuelve a su sitio.
            moverMalla(scene, mesh, new Vector3(...objeto.datos.posicionInicial), 300);
            hud.mostrarFeedback(
              false,
              "Sin responsable ni plazo, la etiqueta no sirve: el objeto se quedaría ahí para siempre."
            );
            return;
          }

          tarjetasEmitidas++;

          gameManager.registrarTarjetaRoja({
            objetoId: objeto.datos.id,
            nombreObjeto: objeto.datos.nombreVisible,
            responsable: datos.responsable,
            plazoTexto: datos.plazo,
            plazo: interpretarPlazo(datos.plazo),
          });

          conteo.tarjetaRoja++;
          objeto.fijar();
          realce.quitar(mesh);

          const posicion = lugarEnZona(3.0, conteo.descartar + conteo.tarjetaRoja - 1);
          acomodarEnZona(mesh, posicion);

          // La tarjeta se coloca CUANDO EL OBJETO YA LLEGÓ, no al mismo tiempo.
          //
          // Antes se creaba de inmediato en el destino, así que aparecía sola
          // en la zona mientras el objeto todavía viajaba, y a una altura fija
          // que no tenía nada que ver con su tamaño: sobre la caja quedaba
          // hundida dentro y sobre los guantes flotando. Ahora se espera al
          // final del movimiento y se toma la altura real de su tapa.
          luegoDe(scene, 300, () => {
            const tapa = mesh.getBoundingInfo().boundingBox.maximumWorld.y;
            colocarTarjetaRoja(
              scene,
              objeto.datos.id,
              mesh.position.x + 0.12,
              tapa - 0.04,
              mesh.position.z + 0.1,
              tarjetasEmitidas,
              datos
            );
          });

          sumarMetros(objeto.datos.metros);
          gameManager.sumarPuntos(10);
          reproducir("acierto");
          hud.mostrarFeedback(true, objeto.datos.explicacion, mesh.position.clone());
          registrarAvance();
        });
        return;
      }

      if (aciertoDirecto) {
        objeto.fijar();
        realce.quitar(mesh);

        const zonaX = enNecesario ? -3.0 : 3.0;
        const indice = enNecesario ? conteo.necesario : conteo.descartar + conteo.tarjetaRoja;
        if (enNecesario) conteo.necesario++;
        else conteo.descartar++;

        acomodarEnZona(mesh, lugarEnZona(zonaX, indice));

        sumarMetros(objeto.datos.metros);
        gameManager.sumarPuntos(10);
        reproducir("acierto");
        hud.mostrarFeedback(true, objeto.datos.explicacion, mesh.position.clone());
        registrarAvance();
        return;
      }

      // Error: vuelve a donde estaba. No se queda flotando sobre la zona
      // equivocada, que es como la escena terminaba llena de objetos en el aire.
      reproducir("error");
      hud.mostrarFeedback(false, objeto.datos.explicacion, mesh.position.clone());
      moverMalla(scene, mesh, new Vector3(...objeto.datos.posicionInicial), 300);
    });
  });

  return { objetos, zonas: [zonaNecesario, zonaDescarte] };
}