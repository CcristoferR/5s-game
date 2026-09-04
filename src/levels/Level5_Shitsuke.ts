import { Scene, MeshBuilder, Vector3 } from "@babylonjs/core";
import { TextBlock, Control } from "@babylonjs/gui";
import {
  crearRegistroHallazgos,
  hacerAuditable,
  crearEtiquetaDespegada,
  crearBasuraNueva,
  pedirDictamen,
} from "../entities/HallazgoAuditoria";
import { crearTabletAuditoria } from "../ui/TabletAuditoria";
import { crearBotonPrincipal } from "../ui/EstiloUI";
import { crearPalletConCajas } from "../entities/WorkshopProps";
import { colocarTarjetaRoja } from "../entities/TarjetaRoja";
import { crearRotulo3D } from "../entities/Rotulo3D";
import { habilitarRealceAlPasar } from "../entities/RealceAlPasar";
import { habilitarEtiquetasAlPasar } from "../ui/EtiquetaObjeto";
import { chispasDeAcierto } from "../entities/Particulas";
import { mostrarInformeAuditoria } from "../ui/AuditReport";
import { cargarGaraje, iluminarInteriorGaraje } from "../entities/Garaje";
import { ambientarNivel } from "../entities/AmbienteNivel";
import { crearBancoDeTrabajo } from "../entities/Workbench";
import { crearPanelInterruptores, crearZonasPiso } from "../entities/ControlVisual";
import { GameManager } from "../core/GameManager";
import { reproducir } from "../core/Sonido";
import {
  briefingsNiveles,
  microLeccionesNiveles,
  circuitosNivel4,
  coloresNivel4,
  zonasPisoNivel4,
} from "../data/levelConfig";
import { mostrarAperturaNivel } from "../ui/BriefingPanel";
import { HUD } from "../ui/HUD";
import { luegoDe } from "../core/Animacion";
import { preguntarCierreDeNivel } from "../ui/PreguntaCierre";
import { TEXTO } from "../ui/EstiloUI";

// ~9 segundos por punto de control, con un piso de 35s. La cantidad de
// puntos varía según cuántos ítems dejó el jugador en el checklist del
// Nivel 4 (más la señalización), así que el tiempo se adapta en vez de
// quedar fijo en 40s como antes.
/**
 * Tiempo por punto a inspeccionar.
 *
 * Subido de 9 a 40. Nueve segundos alcanzaban cuando el nivel era hacer clic
 * en esferas rotuladas; ahora cada punto exige recorrer hasta el objeto,
 * mirarlo, abrir la inspección, LEER lo observado y decidir. Con el tiempo
 * viejo la auditoría se cerraba sola antes de terminar el primer recorrido.
 */
const SEGUNDOS_POR_PUNTO = 40;
/** Piso de tiempo, para que una planilla corta no quede asfixiada. */
const TIEMPO_MINIMO_SEGUNDOS = 150;

// Umbral de aprobación de la auditoría: hay que detectar correctamente al
// menos el 70% de los puntos de control para aprobar — igual que en una
// auditoría real, no basta con "haber jugado el nivel". Este umbral es
// lo que decide si se llama a onCompletado() (y por lo tanto si se
// desbloquea el certificado).
const UMBRAL_APROBACION = 0.7;

export function cargarNivel5(
  scene: Scene,
  hud: HUD,
  onVolverMenu: () => void,
  onCompletado: () => void,
  onReintentar: () => void
) {
  const gameManager = GameManager.getInstance();
  const gui = hud.gui;

  // Mismo escenario que los cuatro niveles anteriores: el garaje de Bitplay.
  // En este nivel importa especialmente, porque la auditoría consiste en
  // recorrer el espacio que el jugador transformó — tiene que ser el mismo.
  void cargarGaraje(scene).catch((error) => console.error("[nivel5] garaje:", error));

  // Tres focos repartidos a lo largo del recorrido de auditoría: los puntos
  // de control se distribuyen por todo el garaje y ninguno puede quedar en
  // penumbra, o el jugador pierde tiempo buscando en vez de inspeccionando.
  iluminarInteriorGaraje(scene, [
    { z: -1.2, intensidad: 0.9 },
    { z: 0.8, intensidad: 0.85 },
    { z: 2.6, intensidad: 0.8 },
  ]);

  // Utileria de fondo. Ver AmbienteNivel.ts: la cantidad y el tipo cambian
  // por nivel para acompanar lo que ensena cada S.
  ambientarNivel(scene, 5);

  // Suelo invisible al ras del piso del garaje. Conserva el nombre "sueloN5"
  // porque main.ts lo busca así para indicarle a WebXR dónde se puede
  // teletransportar el jugador.
  const suelo = MeshBuilder.CreateGround("sueloN5", { width: 12, height: 19 }, scene);
  suelo.position.y = -0.02;
  suelo.isVisible = false;

  // El mismo banco de trabajo de los otros niveles, en vez de una caja suelta:
  // el jugador está auditando el puesto que ordenó antes, así que tiene que
  // reconocerlo.
  crearBancoDeTrabajo(scene, { nombre: "escritorioN5", ancho: 3, fondo: 1.4, z: -0.5 });

  // Los puntos de control se generan a partir del estándar que el
  // jugador construyó en el Nivel 4 (checklist + señalización), con
  // desviaciones sorteadas de nuevo en cada intento — así cumple lo que
  // pide la guía: "desviaciones introducidas aleatoriamente" sobre "el
  // checklist que él mismo ayudó a construir en el Nivel 4".

  const instruccion = new TextBlock(
    "instruccionNivel5",
    // La instrucción vieja seguía hablando de esferas y de marcar y desmarcar,
    // que era la mecánica anterior. Decía lo contrario de lo que hay que hacer.
    `Recorre el área y examina cada punto de la planilla. Al inspeccionar algo, TÚ decides si cumple el estándar o si registras una no conformidad. Necesitas ${Math.round(
      UMBRAL_APROBACION * 100
    )}% de aciertos para aprobar.`
  );
  instruccion.color = "white";
  instruccion.fontSize = TEXTO.cuerpo;
  instruccion.outlineWidth = 3;
  instruccion.outlineColor = "rgba(0,0,0,0.6)";
  instruccion.textWrapping = true;
  // Sin esto el bloque ocupa el alto completo de la pantalla y el texto
  // queda centrado verticalmente, ignorando su propio 'top'.
  instruccion.resizeToFit = true;
  instruccion.width = "560px";
  instruccion.top = "70px";
  instruccion.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  gui.addControl(instruccion);

  // Se retira sola a los doce segundos: es una consigna de arranque, no un
  // cartel permanente. Ocupaba el centro de la vista durante toda la auditoría,
  // justo sobre la zona que hay que recorrer.
  luegoDe(scene, 12000, () => {
    instruccion.isVisible = false;
  });

  // ===================================================================
  // AUDITORÍA SOBRE OBJETOS REALES
  // ===================================================================
  //
  // Se fueron las esferas flotantes. Video 4.3 (2:25): "Genba, Genbutsu,
  // Genjitsu — debemos estar en el tiempo real en el lugar de trabajo
  // observando". Una esfera sobre un pedestal es un rótulo que ya dice dónde
  // mirar; auditar es lo contrario.
  //
  // Ahora los desvíos están EN los objetos y hay que recorrer el área para
  // verlos. La planilla lateral lista qué se audita, no dónde está el problema.
  mostrarAperturaNivel(scene, 5, briefingsNiveles[5], microLeccionesNiveles[5], () => {});

  const registro = crearRegistroHallazgos();

  // --- 1. Seguimiento de las tarjetas rojas del Nivel 1 ---
  //
  // Esta es la conexión con Seiri, y es la que más enseña: video 3.1 (3:29),
  // la tarjeta necesita "un responsable que le haga seguimiento al cumplimiento
  // y control". El jugador escribió un plazo con su puño y letra hace cuatro
  // niveles; ahora le toca comprobar si venció.
  //
  // No se inventa nada: se leen las tarjetas que él mismo emitió.
  // ===================================================================
  // DE DÓNDE SALEN LOS PUNTOS DE ESTA AUDITORÍA
  // ===================================================================
  //
  // De tres sitios, y dos de ellos son cosas que hizo el propio jugador:
  //
  //   1. DESVÍOS SEMBRADOS. Deterioro normal del área — una etiqueta que se
  //      despegó, basura que apareció después de la última limpieza. No
  //      dependen de nadie: son lo que pasa cuando el estándar deja de
  //      sostenerse solo.
  //
  //   2. LAS TARJETAS ROJAS DEL NIVEL 1. Video 3.1 (3:29): la tarjeta necesita
  //      "un responsable que le haga seguimiento al cumplimiento y control".
  //      Se auditan TODAS las que emitió, no una. Antes se leía únicamente
  //      tarjetas[0] y las demás se perdían: se podían etiquetar tres bultos
  //      en Seiri y encontrar uno solo cuatro niveles después, que es
  //      exactamente lo contrario de hacer seguimiento.
  //
  //   3. EL ESTÁNDAR DEL NIVEL 4. El taller se monta tal como quedó
  //      estandarizado: el tablero con los colores que él puso en cada
  //      interruptor y el pasillo con el texto que él eligió dejar pintado.
  //      Este enganche estaba cortado — el Nivel 4 guardaba el estándar y el
  //      Nivel 5 no lo leía nunca —, así que los dos errores que el Nivel 4
  //      deja pasar a propósito (el color que nada valida y el rótulo sin
  //      medida que el Andon no puede detectar) no aparecían jamás. Eran los
  //      únicos fallos del juego pensados para descubrirse auditando, y no
  //      había auditoría que los descubriera.
  //
  // Todos los puntos se arman en UNA sola lista. La planilla lateral se genera
  // después a partir de ella, así que no puede volver a pasar que haya un
  // objeto sin fila o una fila sin objeto.

  const tarjetas = gameManager.getTarjetasRojas();
  const estandar = gameManager.getEstandarNivel4();
  const hoy = new Date();

  /** Un punto de la auditoría: el objeto que se inspecciona y su fila. */
  interface PuntoAuditoria {
    id: string;
    /** Fila de la planilla. Dice QUÉ se audita, nunca dónde está el problema. */
    planilla: string;
    zona: string;
    titulo: string;
    observacion: string;
    detalle: string;
    esDesvio: boolean;
    centro: Vector3;
    tamano: { ancho: number; alto: number; fondo: number };
    montar?: () => void;
  }

  const puntos: PuntoAuditoria[] = [];

  // --- 1. Desvíos sembrados ---------------------------------------------
  puntos.push(
    {
      id: "etiqueta_despegada",
      planilla: "Rotulado de la estantería derecha",
      esDesvio: true,
      zona: "Estantería derecha · rotulado",
      titulo: "Etiqueta despegada",
      observacion:
        "La etiqueta 'REPUESTOS' está sujeta por una sola esquina y cuelga inclinada. El resto de los rótulos del área están rectos y pegados.",
      detalle: "La etiqueta 'REPUESTOS' cuelga de una esquina. Sin rótulo legible, la estantería deja de estar identificada.",
      centro: new Vector3(4.3, 1.12, 1.6),
      tamano: { ancho: 0.7, alto: 0.5, fondo: 0.7 },
      montar: () => crearEtiquetaDespegada(scene, 4.32, 1.12, 1.6, -Math.PI / 2),
    },
    {
      id: "basura_nueva",
      planilla: "Limpieza del piso junto al puesto",
      esDesvio: true,
      zona: "Piso junto al puesto · limpieza",
      titulo: "Residuo nuevo en el área",
      observacion:
        "Hay una bolsa de residuos en el piso, fuera de cualquier contenedor. El último registro de limpieza del área es de esta mañana.",
      detalle: "Una bolsa apareció después de la última limpieza. El estándar de Seiso no se está sosteniendo.",
      // Corrida junto al banco: la fila de la planilla dice "junto al puesto" y
      // estaba a dos metros y medio de ahí, en medio del pasillo — que además
      // es donde ahora va la demarcación pintada en el Nivel 4.
      centro: new Vector3(-2.2, 0.28, 0.7),
      tamano: { ancho: 0.8, alto: 0.75, fondo: 0.8 },
      montar: () => crearBasuraNueva(scene, -2.2, 0.7),
    },
    {
      id: "banco_conforme",
      planilla: "Orden sobre el banco de trabajo",
      esDesvio: false,
      zona: "Puesto de trabajo · orden",
      titulo: "Puesto de trabajo",
      observacion:
        "La superficie está despejada, sin objetos ajenos ni material acumulado. Todo lo que hay encima corresponde a la tarea en curso.",
      detalle: "Despejado y sin objetos ajenos. Cumple el estándar: no hay nada que reportar acá.",
      centro: new Vector3(0, 0.6, -0.5),
      tamano: { ancho: 3.1, alto: 1.2, fondo: 1.5 },
    }
  );

  // --- 2. Seguimiento de TODAS las tarjetas rojas ------------------------
  //
  // Sitios repartidos por el fondo, uno por bulto etiquetado. Están separados
  // entre sí y de las otras estaciones para que ningún volumen de inspección
  // se solape con otro: dos cajas invisibles superpuestas hacen que el clic
  // caiga siempre en la misma y la otra sea inauditable.
  const SITIOS_BULTOS: Array<[number, number]> = [
    [-3.8, 4.4],
    [3.9, 4.4],
    [-1.4, 5.3],
    [1.8, 5.3],
  ];

  tarjetas.forEach((tarjeta, i) => {
    // Si algún día hay más tarjetas que sitios, se sigue hacia el fondo en vez
    // de apilar dos bultos en el mismo punto.
    const sitio = SITIOS_BULTOS[i] ?? [(-1) ** i * 2.6, 6.2 + Math.floor(i / SITIOS_BULTOS.length) * 1.2];
    const [bx, bz] = sitio;

    const ilegible = tarjeta.plazo === null;
    const vencida = tarjeta.plazo !== null && tarjeta.plazo < hoy;
    const numero = i + 1;
    const codigo = String(numero).padStart(4, "0");

    puntos.push({
      id: `tarjeta_${tarjeta.objetoId}`,
      planilla: `Tarjeta roja N° ${codigo} · ${tarjeta.nombreObjeto}`,
      esDesvio: ilegible || vencida,
      zona: `Tarjeta roja N° ${codigo} · seguimiento`,
      titulo: ilegible || vencida ? "Tarjeta roja sin resolver" : "Tarjeta roja vigente",
      // Se muestran los datos y la fecha de hoy, pero NO si venció: comparar
      // las dos fechas es el ejercicio.
      observacion:
        `Tarjeta N° ${codigo} sobre material todavía en el área.\n` +
        `Objeto: ${tarjeta.nombreObjeto}\n` +
        `Responsable: ${tarjeta.responsable}\n` +
        `Plazo escrito: ${tarjeta.plazoTexto}\n` +
        `Fecha de hoy: ${hoy.toLocaleDateString("es-CL")}`,
      detalle: ilegible
        ? `El plazo dice "${tarjeta.plazoTexto}" y no es una fecha verificable. Una tarjeta sin plazo comprobable no se puede auditar: cuenta como no conformidad.`
        : vencida
          ? `Venció el ${tarjeta.plazoTexto} y el material sigue en el área. Responsable: ${tarjeta.responsable}. El seguimiento no se hizo.`
          : `Plazo hasta el ${tarjeta.plazoTexto}, todavía vigente. Responsable: ${tarjeta.responsable}. Nada que reportar por ahora.`,
      centro: new Vector3(bx, 0.7, bz),
      tamano: { ancho: 1.6, alto: 1.5, fondo: 1.6 },
      montar: () => {
        crearPalletConCajas(scene, bx, bz);
        colocarTarjetaRoja(scene, `auditoria_${tarjeta.objetoId}`, bx, 0.6, bz - 0.8, numero, {
          responsable: tarjeta.responsable,
          plazo: tarjeta.plazoTexto,
        });
        crearRotulo3D(scene, `bultoEtiquetado_${tarjeta.objetoId}`, tarjeta.nombreObjeto, new Vector3(bx, 1.5, bz), {
          ancho: 1.7,
          alto: 0.26,
          lineasMax: 2,
          colorFondo: "#1a1f24",
          colorBorde: "rgba(255,255,255,0.22)",
          mirarCamara: true,
          alturaTextoMin: 0.075,
        });
      },
    });
  });

  // --- 3. El estándar instalado en el Nivel 4 ---------------------------

  if (estandar.senalizacion.length > 0) {
    const panel = crearPanelInterruptores(scene, 1.9, 1.35, 3.2, 0, circuitosNivel4, coloresNivel4);

    // Los receptores del Nivel 4 son cajas invisibles pinchables para que el
    // imán tenga a qué apuntar. Acá estorban: interceptarían el rayo antes que
    // el volumen de inspección y el punto quedaría imposible de auditar.
    panel.interruptores.forEach((interruptor) => {
      interruptor.receptor.isPickable = false;
    });

    // El tablero se monta con los colores que el jugador puso, aciertos y
    // errores incluidos. Que la instalación funcione igual con un color
    // equivocado es justamente lo que se está auditando.
    estandar.senalizacion.forEach((asignacion) => {
      const color = coloresNivel4.find((c) => c.id === asignacion.colorElegidoId);
      if (color) panel.rotular(asignacion.zonaId, color);
    });

    const desalineadas = estandar.senalizacion.filter((a) => !a.esCorrecta);

    // La observación pone lado a lado el color del interruptor y el de su foco,
    // sin decir si coinciden. Comparar los pares es el trabajo del auditor.
    const detalleColores = estandar.senalizacion
      .map((asignacion) => {
        const circuito = circuitosNivel4.find((c) => c.id === asignacion.zonaId);
        const puesto = coloresNivel4.find((c) => c.id === asignacion.colorElegidoId);
        const foco = coloresNivel4.find((c) => c.id === circuito?.colorCorrectoId);
        return `${circuito?.descripcion ?? asignacion.zonaDescripcion}: interruptor ${puesto?.nombreVisible ?? "sin etiquetar"} · foco ${foco?.nombreVisible ?? "sin color"}`;
      })
      .join("\n");

    puntos.push({
      id: "estandar_colores",
      planilla: "Señalización por color de los interruptores",
      esDesvio: desalineadas.length > 0,
      zona: "Tablero de interruptores · gestión visual",
      titulo: desalineadas.length > 0 ? "Señalización por color inconsistente" : "Señalización por color",
      observacion:
        `Tablero señalizado en la estandarización del área.\n${detalleColores}`,
      detalle:
        desalineadas.length > 0
          ? `${desalineadas.length} interruptor${desalineadas.length === 1 ? "" : "es"} lleva${desalineadas.length === 1 ? "" : "n"} un color distinto al de su foco. Nada lo impidió y nada lo avisó cuando se instaló: la convención de color es el control más débil, y este es el único momento en que el fallo se ve.`
          : "Cada interruptor lleva el color de su foco. Se puede cortar el circuito correcto sin probar los tres.",
      // El panel de interruptores crecio: su volumen tiene que cubrirlo entero
      // o quedan placas que no responden al clic.
      centro: new Vector3(1.9, 1.25, 3.0),
      tamano: { ancho: 2.3, alto: 1.3, fondo: 0.8 },
    });
  }

  const itemPasillo = estandar.checklist.find((item) => item.id === "chk_zona_pasillo");

  if (itemPasillo) {
    const zonaPasillo = zonasPisoNivel4.find((z) => z.id === "zona_pasillo");

    if (zonaPasillo) {
      const pisos = crearZonasPiso(scene, [zonaPasillo]);
      pisos.zonas.forEach((zona) => {
        zona.receptor.isPickable = false;
      });
      // Con el texto que el jugador eligió dejar pintado, sea el que sea.
      pisos.pintar(zonaPasillo.id, itemPasillo.texto);

      puntos.push({
        id: "estandar_pasillo",
        planilla: "Demarcación del pasillo de tránsito",
        esDesvio: !itemPasillo.esValido,
        zona: "Pasillo de tránsito · señalización de caminos",
        titulo: itemPasillo.esValido ? "Pasillo demarcado" : "Demarcación sin criterio verificable",
        observacion:
          `El pasillo está demarcado y la franja se conserva completa.\n` +
          `Texto pintado: "${itemPasillo.texto}"\n` +
          `Ancho libre medido en la inspección: 0,95 m.`,
        detalle: itemPasillo.esValido
          ? "La demarcación dice qué se exige y cuánto. Con la medida escrita, cualquiera verifica el punto sin preguntarle a nadie... y midiendo, hoy no se cumple: hay 0,95 m contra los 1,20 m exigidos."
          : "El pasillo está pintado, pero el texto no fija ninguna medida. Sin un criterio verificable no hay forma de dictaminar si cumple: un punto que no se puede medir no se puede auditar, y por eso queda como no conformidad.",
        // Chato a propósito: un volumen alto sobre una franja de cinco metros
        // se cruzaría en el camino de los rayos que van a los bultos del fondo.
        centro: new Vector3(0, 0.12, 2.1),
        tamano: { ancho: 5.0, alto: 0.25, fondo: 1.05 },
      });
    }
  }

  // --- Montaje: objeto, volumen de inspección y fila, en el mismo paso ---
  puntos.forEach((punto) => {
    punto.montar?.();
    hacerAuditable(
      scene,
      registro,
      {
        id: punto.id,
        // Cada punto tiene su propia fila: la planilla se genera de esta misma
        // lista, así que el identificador sirve para las dos cosas.
        puntoPlanilla: punto.id,
        esDesvio: punto.esDesvio,
        zona: punto.zona,
        titulo: punto.titulo,
        observacion: punto.observacion,
        detalle: punto.detalle,
      },
      punto.centro,
      punto.tamano
    );
  });

  // --- Planilla lateral ---
  //
  // Sale de la lista de puntos, no de un array escrito a mano. Antes eran dos
  // listas paralelas y se desincronizaban: la planilla tenía una fila de
  // tarjetas hubiera una o tres.
  const puntosPlanilla = puntos.map((punto) => ({ id: punto.id, texto: punto.planilla }));

  const tablet = crearTabletAuditoria(scene, gui, puntosPlanilla);

  hud.definirObjetivo("Inspecciona cada punto y dictamina si cumple.");
  hud.definirTotalTarea(puntosPlanilla.length);

  let revisados = 0;
  let aciertos = 0;

  registro.onAuditar.add((h) => {
    // El reloj se detiene mientras el panel está abierto. Leer la observación
    // es parte del ejercicio, no una penalización: si el tiempo corriera, la
    // forma más rentable de jugar sería decidir sin leer.
    corriendoTiempo = false;

    pedirDictamen(gui, h, (registraNoConformidad) => {
      corriendoTiempo = true;
      // "Seguir mirando": no cuenta como inspeccionado. Se puede volver.
      if (registraNoConformidad === null) return;

      h.auditado = true;
      h.reportado = registraNoConformidad;
      revisados++;
      hud.actualizarProgreso(revisados);

      // El acierto se mide sobre el DICTAMEN, no sobre dónde se hizo clic.
      // Reportar lo que está mal y dejar pasar lo que está bien son las dos
      // mitades del mismo trabajo: un auditor que inventa faltas hace tanto
      // daño como el que no ve las reales.
      const acerto = registraNoConformidad === h.esDesvio;

      if (acerto) {
        aciertos++;
        gameManager.sumarPuntos(15);
        reproducir("acierto");
        chispasDeAcierto(scene, h.mesh.position.clone(), 0.6);
      } else {
        reproducir("error");
      }

      // La planilla registra lo que el jugador DECIDIÓ, no lo que era cierto.
      // El contraste entre ambas cosas es el informe final.
      tablet.resolver(h.puntoPlanilla, registraNoConformidad ? "hallazgo" : "conforme", h.detalle);
      hud.mostrarFeedback(acerto, `${h.titulo} — ${h.detalle}`, h.mesh.position.clone());

      if (revisados >= registro.hallazgos.length) {
        luegoDe(scene, 1100, () => finalizarAuditoria());
      }
    });
  });

  // El realce se enciende sobre TODOS los objetos auditables por igual.
  //
  // Es deliberado que no distinga los que tienen desvío: si el juego marcara
  // los defectuosos, auditar se reduciría a hacer clic donde brilla. El
  // contorno solo dice "esto se puede revisar", no "esto está mal".
  habilitarRealceAlPasar(scene, registro.hallazgos.map((h) => h.mesh));

  // Nombre al pasar el cursor. Sin esto no hay forma de saber QUÉ se está
  // mirando: los volúmenes de inspección son transparentes y se montan sobre
  // utilería que en los otros niveles no responde a nada.
  habilitarEtiquetasAlPasar(
    scene,
    gui,
    registro.hallazgos.map((h) => ({ mesh: h.mesh, texto: `Inspeccionar: ${h.zona}` }))
  );

  // --- Recorrido con tiempo ---
  //
  // El limite sale de cuantos puntos hay que verificar, no de un numero fijo:
  // la planilla cambia de largo segun si el jugador emitio tarjetas rojas.
  const tiempoLimite = Math.max(TIEMPO_MINIMO_SEGUNDOS, registro.hallazgos.length * SEGUNDOS_POR_PUNTO);

  let finalizado = false;
  let corriendoTiempo = true;
  const inicioAuditoria = performance.now();

  const botonFinalizar = crearBotonPrincipal("btnFinalizarAuditoria", "Cerrar la auditoria", 260);
  botonFinalizar.top = "-40px";
  botonFinalizar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  botonFinalizar.onPointerUpObservable.add(() => {
    if (!finalizado) finalizarAuditoria();
  });
  gui.addControl(botonFinalizar);

  scene.onBeforeRenderObservable.add(() => {
    if (!corriendoTiempo || finalizado) return;

    const transcurrido = (performance.now() - inicioAuditoria) / 1000;
    const restante = Math.max(0, Math.ceil(tiempoLimite - transcurrido));
    hud.actualizarTiempoRestante(restante);

    // Se cierra sola al agotarse: una auditoria tiene su ventana de tiempo.
    if (restante <= 0) finalizarAuditoria();
  });

  function finalizarAuditoria(): void {
    finalizado = true;
    corriendoTiempo = false;
    botonFinalizar.isVisible = false;
    instruccion.isVisible = false;
    tablet.ocultar();

    // El informe se arma sobre los objetos REALES, no sobre esferas.
    //
    // Un punto no revisado cuenta como fallo: en una auditoría, no mirar algo
    // no es lo mismo que declararlo conforme — es no haberlo auditado. Antes,
    // dejar una esfera sin marcar equivalía a decir "acá no hay problema" y se
    // podía aprobar sin recorrer nada.
    const filas = registro.hallazgos.map((h) => ({
      datos: {
        id: h.id,
        posicion: [h.mesh.position.x, h.mesh.position.z] as [number, number],
        descripcionControl: h.titulo,
        tituloControl: h.titulo,
        tipoEvidencia: "sinProblema" as const,
        explicacion: h.detalle,
        tieneDesviacion: h.esDesvio,
        calificacion: h.esDesvio ? 2 : 5,
      },
      // Lo que el jugador DECIDIÓ. Sin inspeccionar cuenta como no reportado.
      marcadoPorJugador: h.reportado === true,
    }));

    const totalPuntos = registro.hallazgos.length;
    const aciertosFinales = registro.hallazgos.filter(
      (h) => h.auditado && h.esDesvio
    ).length + registro.hallazgos.filter((h) => !h.auditado && !h.esDesvio).length;

    // Calificación 5S del ÁREA, no de cada punto.
    //
    // Es la proporción de puntos que cumplen, llevada a la escala 1-5 que usan
    // las auditorías del curso. Antes salía de promediar números fijos, así
    // que daba casi siempre lo mismo sin importar cómo estuviera el área.
    const conformes = registro.hallazgos.filter((h) => !h.esDesvio).length;
    const tasaAcierto = totalPuntos > 0 ? aciertosFinales / totalPuntos : 0;
    const promedioCalificacion = totalPuntos > 0 ? 1 + (conformes / totalPuntos) * 4 : 5;
    const aciertos = aciertosFinales;
    const aprobado = tasaAcierto >= UMBRAL_APROBACION;

    // El puntaje del minijuego premia la detección correcta del jugador
    // — no depende de si el área "salió buena o mala" (eso es al azar),
    // sino de qué tan buen auditor fue.
    const puntosBase = aciertos * 10;
    gameManager.sumarPuntos(puntosBase);
    gameManager.registrarResultadoAuditoriaN5({ promedioCalificacion, tasaAcierto, aprobado });

    // El Nivel 5 (y por lo tanto el 100% de madurez y el certificado)
    // solo se marca como completado si el jugador APRUEBA la auditoría.
    // Antes esto se llamaba siempre, sin importar el resultado — por eso
    // el certificado salía pasara lo que pasara.
    if (aprobado) {
      onCompletado();
    }

    const segundosTotales = Math.floor((performance.now() - inicioAuditoria) / 1000);

    // El resultado del curso lo registra main.ts contra Supabase al completar
    // cada fase, y de ahí sale el ranking. Acá había además una copia local
    // en el navegador: quedaba de la época en que el ranking era personal y
    // solo de este nivel. Mantener dos registros del mismo hecho es pedir que
    // algún día muestren números distintos.

    mostrarInformeAuditoria(gui, filas, () => {
      // Pregunta de cierre del programa completo: el jugador acaba de ver su
      // informe punto por punto, y acá se le pide decidir qué hacer con una
      // desviación que se repite — que es de lo que trata Shitsuke.
      preguntarCierreDeNivel(gui, hud, 5, (cierre) => {
        // El panel sale enseguida. La explicación de la pregunta viaja adentro
        // de él, así que ya no hay que esperar a que se apague ningún cartel:
        // esta pausa es solo para que el cierre no se sienta abrupto.
        luegoDe(scene, 700, () => {
          hud.mostrarResultadoAuditoria(aprobado, puntosBase, tasaAcierto, promedioCalificacion, segundosTotales, onVolverMenu, onReintentar, cierre);
        });
      });
    });
  }

  // Se devuelven las mallas auditables: main.ts las usa para las sombras.
  return { puntos: registro.hallazgos };
}