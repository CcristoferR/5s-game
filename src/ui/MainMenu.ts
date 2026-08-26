import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Rectangle, Control, Image, Button } from "@babylonjs/gui";

export interface NivelMenuInfo {
  numero: number;
  nombre: string;
  desbloqueado: boolean;
  completado: boolean;
}

const TITULO = "Operación 5S";
const BAJADA = "Programa de formación en metodología 5S";

const C = {
  panel: "#181c20",
  panelBorde: "#333b42",
  linea: "#282f35",

  titulo: "#ffffff",
  texto: "#e8ecea",
  secundario: "#a9b2b6",
  terciario: "#7d868b",

  bloqueadoFuerte: "#939ca2",
  bloqueadoSuave: "#7b858b",

  acento: "#4ec27a",
  filaActiva: "#1d2a23",
  filaActivaBorde: "#2f5a41",
  filaHover: "#242b31",

  huecoBarra: "#2a3238",
};

const ANCHO = 780;
const ALTO_FILA = 76;

export function mostrarMenuPrincipal(
  scene: Scene,
  niveles: NivelMenuInfo[],
  porcentajeMadurez: number,
  onSeleccionarNivel: (numero: number) => void,
  onVerCertificado: () => void,
  onVerRanking: () => void,
  /** Nombre de quien tiene la sesion abierta. Se muestra en la cabecera. */
  usuario?: string,
  /** Si se pasa, aparece el boton para salir de la sesion. */
  onCerrarSesion?: () => void
): { ocultar: () => void } {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("menuPrincipal", true, scene);

  // 1. La capa del menu queda fuera del post-proceso de la escena. Sin esto,
  //    el bloom y el tone mapping levantan los negros y todo se ve lavado.
  if (gui.layer) {
    gui.layer.applyPostProcess = false;
  }
  // 2. renderScale queda en 1 a proposito: la nitidez real la da el buffer
  //    del motor (setHardwareScalingLevel en main.ts). Supersamplear aqui
  //    encima solo costaria rendimiento sin ganar definicion.
  gui.renderScale = 1;
  // 3. La composicion escala proporcionalmente sin desarmarse.
  gui.idealWidth = 1600;
  gui.idealHeight = 900;
  gui.useSmallestIdeal = true;

  gui.addControl(crearFondo());

  // El tutorial (numero 0) aparece como una fila mas, pero NO es una de las
  // cinco fases: no cuenta para el progreso ni agrega un segmento a la barra.
  const fases = niveles.filter((n) => n.numero >= 1);
  const completadas = fases.filter((n) => n.completado).length;
  const certificadoListo = porcentajeMadurez === 100;

  const panel = new Rectangle("panelMenu");
  panel.width = ANCHO + "px";
  panel.height = 150 + niveles.length * ALTO_FILA + 116 + "px";
  panel.cornerRadius = 16;
  panel.thickness = 1;
  panel.color = C.panelBorde;
  panel.background = C.panel;
  panel.alpha = 0;
  gui.addControl(panel);

  const columna = new StackPanel("columnaMenu");
  columna.isVertical = true;
  columna.width = ANCHO - 2 + "px";
  panel.addControl(columna);

  columna.addControl(crearCabecera(usuario));
  columna.addControl(separador("sepCabecera"));

  const filas: Array<{ marco: Rectangle; zona: Button; nivel: NivelMenuInfo }> = [];
  niveles.forEach((nivel, i) => {
    const fila = crearFila(nivel);
    columna.addControl(fila.marco);
    filas.push({ marco: fila.marco, zona: fila.zona, nivel });
    if (i < niveles.length - 1) columna.addControl(separador("sepFila_" + i));
  });

  columna.addControl(separador("sepProgreso"));
  const progreso = crearProgreso(completadas, fases.length);
  columna.addControl(progreso.bloque);

  const pie = crearPie(certificadoListo, Boolean(onCerrarSesion));
  columna.addControl(pie.barra);

  // --- Interaccion ---
  let vivo = true;
  let observador: ReturnType<typeof scene.onBeforeRenderObservable.add> | null = null;

  function cerrar(despues: () => void): void {
    if (!vivo) return;
    vivo = false;
    if (observador) {
      scene.onBeforeRenderObservable.remove(observador);
      observador = null;
    }

    // Se oculta la interfaz COMPLETA, no solo el panel: el fondo es una imagen
    // a pantalla completa agregada directamente a la GUI, asi que apagar unicamente
    // el panel dejaba esa capa tapando el nivel.
    gui.rootContainer.isVisible = false;
    gui.rootContainer.isPointerBlocker = false;

    // El dispose va diferido a proposito: esto corre dentro del despacho de un
    // evento de puntero de esta misma textura, y destruirla en ese momento corta
    // el recorrido interno de controles de Babylon.
    setTimeout(() => {
      try {
        gui.dispose();
      } catch {
        /* la escena ya se recreo y se llevo esta textura: nada que liberar */
      }
    }, 0);

    despues();
  }

  filas.forEach((fila) => {
    if (!fila.nivel.desbloqueado) return;
    fila.zona.onPointerUpObservable.add(() => cerrar(() => onSeleccionarNivel(fila.nivel.numero)));
  });

  // El ranking cierra el menu igual que el certificado: RankingScreen monta
  // su propia capa y al cerrarse vuelve a llamar a mostrarMenu().
  pie.ranking.onPointerUpObservable.add(() => cerrar(() => onVerRanking()));

  if (pie.salir && onCerrarSesion) {
    pie.salir.onPointerUpObservable.add(() => cerrar(() => onCerrarSesion()));
  }

  if (pie.certificado) {
    pie.certificado.onPointerUpObservable.add(() => cerrar(() => onVerCertificado()));
  }

  // --- Entrada ---
  let t = 0;
  observador = scene.onBeforeRenderObservable.add(() => {
    if (!vivo) return;
    t += scene.getEngine().getDeltaTime() / 1000;

    panel.alpha = Math.min(1, t / 0.28);
    panel.top = Math.round((1 - suavizar(Math.min(1, t / 0.4))) * 14) + "px";

    const pConteo = suavizar(tramo(t, 0.18, 0.55));
    progreso.contador.text = Math.round(completadas * pConteo) + " de " + niveles.length + " fases";

    progreso.rellenos.forEach((relleno, i) => {
      if (i >= completadas) return;
      relleno.width = suavizar(tramo(t, 0.28 + i * 0.08, 0.28)) * 100 + "%";
    });

    if (t >= 1.2 && observador) {
      scene.onBeforeRenderObservable.remove(observador);
      observador = null;
    }
  });

  return { ocultar: () => cerrar(() => {}) };
}

// ---------------------------------------------------------------------------
// Fondo
// ---------------------------------------------------------------------------

function crearFondo(): Image {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, 900);
  base.addColorStop(0, "#0d1013");
  base.addColorStop(1, "#06080a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1600, 900);

  const luz = ctx.createRadialGradient(800, 300, 0, 800, 300, 900);
  luz.addColorStop(0, "rgba(120,140,150,0.10)");
  luz.addColorStop(1, "rgba(120,140,150,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, 1600, 900);

  const imagen = new Image("fondoMenu", canvas.toDataURL("image/png"));
  imagen.width = "100%";
  imagen.height = "100%";
  imagen.stretch = Image.STRETCH_FILL;
  imagen.isHitTestVisible = false;
  return imagen;
}

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------

// Trazados a mano en canvas a 4x y mostrados a su tamano real: quedan
// nitidos, toman el color exacto que se les pide y se ven identicos en
// cualquier equipo. Los emoji dependen de la fuente del sistema.
function crearIcono(
  nombre: string,
  tipo: "candado" | "check" | "flecha" | "sello" | "copa" | "salida",
  color: string,
  tamano: number
): Image {
  const lado = tamano * 4;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(lado / 24, lado / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (tipo === "candado") {
    ctx.beginPath();
    ctx.arc(12, 10.4, 3.8, Math.PI, 2 * Math.PI);
    ctx.stroke();
    trazarRectRedondo(ctx, 5.4, 10.4, 13.2, 9.2, 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 15, 1.2, 0, 2 * Math.PI);
    ctx.fill();
  } else if (tipo === "check") {
    ctx.beginPath();
    ctx.moveTo(5, 12.6);
    ctx.lineTo(9.8, 17.4);
    ctx.lineTo(19, 7);
    ctx.stroke();
  } else if (tipo === "flecha") {
    ctx.beginPath();
    ctx.moveTo(10, 5.8);
    ctx.lineTo(16.2, 12);
    ctx.lineTo(10, 18.2);
    ctx.stroke();
  } else if (tipo === "salida") {
    // Puerta con flecha saliendo: el simbolo universal de cerrar sesion.
    ctx.beginPath();
    ctx.moveTo(13.5, 4.5);
    ctx.lineTo(5.5, 4.5);
    ctx.lineTo(5.5, 19.5);
    ctx.lineTo(13.5, 19.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, 12);
    ctx.lineTo(20, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16.8, 8.4);
    ctx.lineTo(20.4, 12);
    ctx.lineTo(16.8, 15.6);
    ctx.stroke();
  } else if (tipo === "copa") {
    ctx.beginPath();
    ctx.moveTo(7.2, 4.4);
    ctx.lineTo(16.8, 4.4);
    ctx.lineTo(16.8, 9.2);
    ctx.bezierCurveTo(16.8, 13.2, 14.6, 15, 12, 15);
    ctx.bezierCurveTo(9.4, 15, 7.2, 13.2, 7.2, 9.2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7.2, 5.8);
    ctx.bezierCurveTo(4.2, 5.8, 3.6, 9.6, 6.6, 10.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16.8, 5.8);
    ctx.bezierCurveTo(19.8, 5.8, 20.4, 9.6, 17.4, 10.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(12, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9.8, 18);
    ctx.lineTo(14.2, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.4, 20);
    ctx.lineTo(15.6, 20);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(12, 9.4, 5.4, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.6, 13.9);
    ctx.lineTo(7.2, 21);
    ctx.lineTo(12, 18.7);
    ctx.lineTo(16.8, 21);
    ctx.lineTo(15.4, 13.9);
    ctx.stroke();
  }

  const icono = new Image(nombre, canvas.toDataURL("image/png"));
  icono.width = tamano + "px";
  icono.height = tamano + "px";
  icono.stretch = Image.STRETCH_UNIFORM;
  // Decorativo: si acepta el hit test, se queda el clic destinado a la fila
  // o al boton que lo contiene (ver nota en crearFila).
  icono.isHitTestVisible = false;
  return icono;
}

function trazarRectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Cabecera
// ---------------------------------------------------------------------------

function crearCabecera(usuario?: string): Rectangle {
  const cabecera = new Rectangle("cabeceraMenu");
  cabecera.width = ANCHO - 2 + "px";
  cabecera.height = "118px";
  cabecera.thickness = 0;
  cabecera.background = "transparent";

  const titulo = new TextBlock("tituloMenu", TITULO.toUpperCase());
  titulo.color = C.titulo;
  titulo.fontSize = 38;
  titulo.fontWeight = "600";
  titulo.height = "46px";
  titulo.top = "26px";
  titulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(titulo);

  // Quien esta jugando, arriba a la izquierda. Sin esto, en un computador
  // compartido de planta nadie sabe con que sesion esta abierto el curso.
  if (usuario) {
    const identidad = new TextBlock("usuarioMenu", usuario);
    identidad.color = C.secundario;
    identidad.fontSize = 13;
    identidad.width = "300px";
    identidad.height = "20px";
    identidad.left = "26px";
    identidad.top = "18px";
    identidad.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    identidad.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    identidad.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    identidad.isHitTestVisible = false;
    cabecera.addControl(identidad);
  }

  const bajada = new TextBlock("bajadaMenu", BAJADA);
  bajada.color = C.secundario;
  bajada.fontSize = 14;
  bajada.height = "20px";
  bajada.top = "72px";
  bajada.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(bajada);

  const filete = new Rectangle("fileteCabecera");
  filete.width = "48px";
  filete.height = "3px";
  filete.cornerRadius = 2;
  filete.thickness = 0;
  filete.background = C.acento;
  filete.top = "100px";
  filete.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  cabecera.addControl(filete);

  return cabecera;
}

// ---------------------------------------------------------------------------
// Fila de nivel
// ---------------------------------------------------------------------------

// Button trae animaciones propias (baja la opacidad al pasar el mouse y
// encoge el control al hacer clic). Se anulan para conservar exactamente el
// aspecto disenado: el resaltado de las filas y de los botones lo manejan sus
// propios handlers de hover mas abajo.
function sinAnimacionesDeBoton(boton: Button): void {
  boton.pointerEnterAnimation = () => {};
  boton.pointerOutAnimation = () => {};
  boton.pointerDownAnimation = () => {};
  boton.pointerUpAnimation = () => {};
}

// IMPORTANTE — por que todos los hijos llevan isHitTestVisible = false:
//
// En Babylon GUI un contenedor le ofrece el clic primero a sus hijos, en orden
// inverso, y si alguno lo acepta corta ahi: el contenedor NUNCA ejecuta sus
// propios observables (ver Container._processPicking). TextBlock e Image
// aceptan el hit test por defecto.
//
// Como el manejador del clic vive en 'zona' (el rectangulo de la fila) pero la
// fila esta tapada casi entera por sus textos y su icono, sin esto el clic solo
// funcionaba si caia en un hueco entre textos. De ahi que pareciera aleatorio y
// que cambiara al abrir las devtools: al variar el tamanio, variaban los huecos.
// Lo mismo aplica a los botones de la barra inferior (crearBotonPie).
function crearFila(nivel: NivelMenuInfo): { marco: Rectangle; zona: Button } {
  const separado = separarNombre(nivel.nombre);
  const estado = nivel.completado ? "completado" : nivel.desbloqueado ? "disponible" : "bloqueado";

  const marco = new Rectangle("marcoFila_" + nivel.numero);
  marco.width = ANCHO - 2 + "px";
  marco.height = ALTO_FILA + "px";
  marco.thickness = 0;
  marco.background = "transparent";

  // Button en vez de Rectangle a proposito: Button sobrescribe _processPicking
  // y ejecuta SIEMPRE sus propios observables cuando el punto cae dentro, sin
  // cederle el evento a los hijos. Un Rectangle, en cambio, le ofrece el clic
  // primero a cada hijo y se queda sin ejecutar nada si alguno lo acepta.
  const zona = new Button("fila_" + nivel.numero);
  zona.width = ANCHO - 34 + "px";
  zona.height = ALTO_FILA - 10 + "px";
  zona.cornerRadius = 10;
  zona.thickness = estado === "disponible" ? 1 : 0;
  zona.color = C.filaActivaBorde;
  zona.background = estado === "disponible" ? C.filaActiva : "transparent";
  zona.isPointerBlocker = nivel.desbloqueado;
  sinAnimacionesDeBoton(zona);
  marco.addControl(zona);

  if (estado === "disponible") {
    const marca = new Rectangle("marcaFila_" + nivel.numero);
    marca.width = "3px";
    marca.height = "30px";
    marca.cornerRadius = 2;
    marca.thickness = 0;
    marca.background = C.acento;
    marca.isHitTestVisible = false;
    marca.left = "1px";
    marca.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    zona.addControl(marca);
  }

  const colorNumero = estado === "bloqueado" ? C.bloqueadoSuave : estado === "disponible" ? C.secundario : C.terciario;
  const colorTermino = estado === "bloqueado" ? C.bloqueadoFuerte : C.titulo;
  const colorTraduccion = estado === "bloqueado" ? C.bloqueadoSuave : C.secundario;

  const numero = new TextBlock(
    "numeroFila_" + nivel.numero,
    nivel.numero === 0 ? "\u25B8" : "0" + nivel.numero
  );
  numero.color = colorNumero;
  numero.fontSize = 14;
  numero.width = "40px";
  numero.left = "22px";
  numero.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  numero.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  numero.isHitTestVisible = false;
  zona.addControl(numero);

  const termino = new TextBlock("terminoFila_" + nivel.numero, separado.termino.toUpperCase());
  termino.color = colorTermino;
  termino.fontSize = 23;
  termino.fontWeight = estado === "bloqueado" ? "400" : "600";
  termino.width = "190px";
  termino.left = "70px";
  termino.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  termino.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  termino.isHitTestVisible = false;
  zona.addControl(termino);

  const traduccion = new TextBlock("traduccionFila_" + nivel.numero, separado.traduccion);
  traduccion.color = colorTraduccion;
  traduccion.fontSize = 15;
  traduccion.width = "220px";
  traduccion.left = "272px";
  traduccion.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  traduccion.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  traduccion.isHitTestVisible = false;
  zona.addControl(traduccion);

  const etiqueta = estado === "completado" ? "Completado" : estado === "disponible" ? "Comenzar" : "Bloqueado";
  const colorEstado = estado === "disponible" ? C.acento : estado === "completado" ? C.secundario : C.bloqueadoSuave;

  const textoEstado = new TextBlock("estadoFila_" + nivel.numero, etiqueta);
  textoEstado.color = colorEstado;
  textoEstado.fontSize = 14;
  textoEstado.fontWeight = estado === "disponible" ? "600" : "400";
  textoEstado.width = "200px";
  textoEstado.left = "-46px";
  textoEstado.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  textoEstado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  textoEstado.isHitTestVisible = false;
  zona.addControl(textoEstado);

  const tipoIcono = estado === "completado" ? "check" : estado === "disponible" ? "flecha" : "candado";
  const icono = crearIcono("iconoFila_" + nivel.numero, tipoIcono, colorEstado, estado === "disponible" ? 15 : 16);
  icono.left = "-20px";
  icono.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  zona.addControl(icono);

  if (nivel.desbloqueado) {
    zona.hoverCursor = "pointer";
    zona.onPointerEnterObservable.add(() => {
      zona.background = estado === "disponible" ? "#25352b" : C.filaHover;
      icono.left = "-15px";
    });
    zona.onPointerOutObservable.add(() => {
      zona.background = estado === "disponible" ? C.filaActiva : "transparent";
      icono.left = "-20px";
    });
  }

  return { marco, zona };
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

function crearProgreso(completadas: number, totalFases: number): {
  bloque: Rectangle;
  contador: TextBlock;
  rellenos: Rectangle[];
} {
  const bloque = new Rectangle("bloqueProgreso");
  bloque.width = ANCHO - 2 + "px";
  bloque.height = "70px";
  bloque.thickness = 0;
  bloque.background = "transparent";

  const rotulo = new TextBlock("rotuloProgreso", "PROGRESO");
  rotulo.color = C.terciario;
  rotulo.fontSize = 12;
  rotulo.fontWeight = "600";
  rotulo.width = "300px";
  rotulo.height = "16px";
  rotulo.left = "26px";
  rotulo.top = "16px";
  rotulo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  rotulo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  rotulo.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  bloque.addControl(rotulo);

  const contador = new TextBlock("contadorProgreso", "0 de " + totalFases + " fases");
  contador.color = completadas > 0 ? C.texto : C.secundario;
  contador.fontSize = 14;
  contador.fontWeight = "600";
  contador.width = "300px";
  contador.height = "18px";
  contador.left = "-26px";
  contador.top = "15px";
  contador.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  contador.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  contador.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  bloque.addControl(contador);

  // Anchos redondeados a entero: una posicion fraccionaria obliga al canvas
  // a interpolar el borde del segmento y se ve como un pixel sucio.
  const util = ANCHO - 54;
  const separacion = 8;
  const anchoSegmento = Math.floor((util - separacion * (totalFases - 1)) / totalFases);
  const rellenos: Rectangle[] = [];

  for (let i = 0; i < totalFases; i++) {
    const hueco = new Rectangle("huecoProgreso_" + i);
    hueco.width = anchoSegmento + "px";
    hueco.height = "6px";
    hueco.cornerRadius = 3;
    hueco.thickness = 0;
    hueco.background = C.huecoBarra;
    hueco.left = 26 + i * (anchoSegmento + separacion) + "px";
    hueco.top = "44px";
    hueco.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hueco.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    bloque.addControl(hueco);

    const relleno = new Rectangle("rellenoProgreso_" + i);
    relleno.width = "0%";
    relleno.height = "6px";
    relleno.cornerRadius = 3;
    relleno.thickness = 0;
    relleno.background = C.acento;
    relleno.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hueco.addControl(relleno);
    rellenos.push(relleno);
  }

  return { bloque, contador, rellenos };
}

// ---------------------------------------------------------------------------
// Barra inferior: ranking + certificado
// ---------------------------------------------------------------------------

function crearPie(certificadoListo: boolean, conSesion: boolean): {
  barra: Rectangle;
  ranking: Button;
  certificado: Button | null;
  salir: Button | null;
} {
  const barra = new Rectangle("barraPie");
  barra.width = ANCHO - 54 + "px";
  barra.height = "54px";
  barra.thickness = 0;
  barra.background = "transparent";

  const ranking = crearBotonPie("botonRanking", "Ranking", "copa", C.secundario, 138);
  ranking.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  barra.addControl(ranking);

  let certificado: Button | null = null;
  let salir: Button | null = null;

  // Salir de la sesion, junto al Ranking. Centrado se solapaba con la nota
  // del certificado, que ocupa 400 px a la derecha. Siempre visible: en un
  // equipo compartido, el turno siguiente tiene que poder entrar con su
  // propia cuenta sin recargar la pagina.
  if (conSesion) {
    salir = crearBotonPie("botonSalir", "Cerrar sesión", "salida", C.terciario, 158);
    salir.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    salir.left = "150px";
    barra.addControl(salir);
  }

  if (certificadoListo) {
    certificado = crearBotonPie("botonCertificado", "Ver certificado", "sello", C.acento, 192);
    certificado.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    barra.addControl(certificado);
  } else {
    const nota = new TextBlock("notaCertificado", "El certificado se habilita al completar las 5 fases");
    nota.color = C.terciario;
    nota.fontSize = 13;
    nota.width = "400px";
    nota.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    nota.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    barra.addControl(nota);
  }

  return { barra, ranking, certificado, salir };
}

// Boton de la barra inferior: icono + texto, borde fino, sin relleno.
function crearBotonPie(
  nombre: string,
  etiqueta: string,
  icono: "copa" | "sello" | "salida",
  color: string,
  ancho: number
): Button {
  const boton = new Button(nombre);
  boton.width = ancho + "px";
  boton.height = "38px";
  boton.cornerRadius = 8;
  boton.thickness = 1;
  boton.color = C.panelBorde;
  boton.background = "transparent";
  boton.isPointerBlocker = true;
  boton.hoverCursor = "pointer";
  sinAnimacionesDeBoton(boton);

  const grafico = crearIcono(nombre + "_icono", icono, color, 17);
  grafico.left = "15px";
  grafico.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  boton.addControl(grafico);

  const texto = new TextBlock(nombre + "_texto", etiqueta);
  texto.color = color;
  texto.fontSize = 14;
  texto.fontWeight = "600";
  texto.left = "15px";
  texto.isHitTestVisible = false;
  boton.addControl(texto);

  boton.onPointerEnterObservable.add(() => {
    boton.background = C.filaHover;
    boton.color = color;
  });
  boton.onPointerOutObservable.add(() => {
    boton.background = "transparent";
    boton.color = C.panelBorde;
  });

  return boton;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function separador(nombre: string): Rectangle {
  const marco = new Rectangle(nombre);
  marco.width = ANCHO - 54 + "px";
  marco.height = "1px";
  marco.thickness = 0;
  marco.background = C.linea;
  return marco;
}

function separarNombre(nombre: string): { termino: string; traduccion: string } {
  const partes = nombre.split(/\s[-–—]\s/);
  if (partes.length < 2) return { termino: nombre.trim(), traduccion: "" };
  return { termino: partes[0].trim(), traduccion: partes[1].trim() };
}

function tramo(t: number, inicio: number, duracion: number): number {
  return Math.min(1, Math.max(0, (t - inicio) / duracion));
}

function suavizar(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}