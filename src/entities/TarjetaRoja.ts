import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, TransformNode } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, InputText } from "@babylonjs/gui";
import { materialPintado } from "./ObjetosComunes";
import {
  PALETA,
  TEXTO,
  crearVelo,
  crearTarjeta,
  crearFilete,
  crearRotulo,
  crearParrafo,
  crearEspacio,
  crearBotonPrincipal,
  crearBotonSecundario,
} from "../ui/EstiloUI";

// ---------------------------------------------------------------------------
// Tarjeta roja
// ---------------------------------------------------------------------------
//
// La pieza central del Nivel 1 reestructurado, y el motivo por el que
// desapareció la categoría "Dudoso".
//
// El curso es explícito (video 3.1, 3:29): las tarjetas rojas "siempre deben
// de tener un plazo para tomar acción y que debe haber un responsable que le
// haga seguimiento". Una etiqueta sin esos dos datos no es una tarjeta roja:
// es un adhesivo. Sin responsable nadie la mira, y sin plazo se queda pegada
// para siempre — que es exactamente el desorden que se quería eliminar.
//
// Por eso acá hay un formulario de verdad, con dos campos obligatorios, y no
// un botón de "etiquetar". Rellenarlo es la lección.

export interface DatosTarjeta {
  responsable: string;
  plazo: string;
}

/** Plazo por defecto: un mes desde hoy, el máximo que recomienda el curso. */
function plazoSugerido(): string {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() + 1);
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Pide responsable y plazo antes de colocar la tarjeta.
 *
 * Devuelve null si la persona cancela: etiquetar es una decisión y se puede
 * desistir de ella, igual que se puede dejar un objeto donde estaba.
 */
export function pedirDatosTarjeta(
  gui: AdvancedDynamicTexture,
  nombreObjeto: string,
  donde: string,
  onListo: (datos: DatosTarjeta | null) => void
): void {
  const ANCHO = 460;

  const velo = crearVelo(gui, "veloTarjetaRoja");

  // La tarjeta cuelga del velo y no de la capa: así el velo la arrastra al
  // ocultarse y no hace falta coordinar dos controles sueltos.
  const tarjeta = crearTarjeta(velo, "panelTarjetaRoja", ANCHO + 72, 520);

  const columna = new StackPanel("columnaTarjetaRoja");
  columna.isVertical = true;
  columna.width = ANCHO + "px";
  tarjeta.addControl(columna);

  crearFilete(tarjeta, "fileteTarjetaRoja", ANCHO + 72, PALETA.error);
  columna.addControl(crearEspacio("aireTarjeta1", 18));
  columna.addControl(crearRotulo("rotuloTarjetaRoja", "TARJETA ROJA", PALETA.error));
  columna.addControl(crearEspacio("aireTarjeta2", 8));
  columna.addControl(
    crearParrafo("objetoTarjetaRoja", nombreObjeto, ANCHO, TEXTO.titulo, PALETA.titulo, "700")
  );
  columna.addControl(crearEspacio("aireTarjeta3", 4));
  columna.addControl(
    crearParrafo("dondeTarjetaRoja", donde, ANCHO, TEXTO.menor, PALETA.rotulo)
  );
  columna.addControl(crearEspacio("aireTarjeta4", 16));
  columna.addControl(
    crearParrafo(
      "ayudaTarjetaRoja",
      "Se etiqueta lo innecesario que no se puede resolver ahora mismo. La tarjeta necesita alguien que le haga seguimiento y una fecha límite: sin eso nadie la mira y no vence nunca, y el objeto sigue estorbando con una etiqueta encima.",
      ANCHO,
      TEXTO.menor,
      PALETA.cuerpo
    )
  );
  columna.addControl(crearEspacio("aireTarjeta5", 18));

  // --- Campos ---
  const campo = (nombre: string, rotulo: string, valor: string, marcador: string): InputText => {
    columna.addControl(crearRotulo(`rot_${nombre}`, rotulo));
    columna.addControl(crearEspacio(`aire_${nombre}`, 6));

    const entrada = new InputText(nombre, valor);
    entrada.width = ANCHO + "px";
    entrada.height = "46px";
    entrada.placeholderText = marcador;
    entrada.color = PALETA.titulo;
    entrada.background = PALETA.tarjetaSuave;
    entrada.focusedBackground = PALETA.tarjetaSuave;
    entrada.placeholderColor = PALETA.tenue;
    entrada.thickness = 1;
    entrada.fontSize = TEXTO.menor;
    entrada.paddingLeft = "12px";
    columna.addControl(entrada);
    columna.addControl(crearEspacio(`aireTras_${nombre}`, 14));

    return entrada;
  };

  const responsable = campo("campoResponsable", "¿QUIÉN HARÁ EL SEGUIMIENTO?", "", "Tu nombre o el de tu supervisor");
  const plazo = campo("campoPlazo", "¿HASTA CUÁNDO HAY PLAZO?", plazoSugerido(), "dd/mm/aaaa");

  const aviso = crearParrafo("avisoTarjetaRoja", "", ANCHO, TEXTO.menor, PALETA.error);
  aviso.isVisible = false;
  columna.addControl(aviso);

  columna.addControl(crearEspacio("aireTarjeta6", 6));

  const cerrar = (datos: DatosTarjeta | null): void => {
    // Se liberan en el tick siguiente: esto corre dentro del despacho del clic
    // sobre estos mismos controles, y destruirlos ahí corta el recorrido
    // interno de la interfaz.
    velo.isVisible = false;
    setTimeout(() => {
      velo.dispose();
      onListo(datos);
    }, 0);
  };

  const confirmar = crearBotonPrincipal("btnColocarTarjeta", "Colocar tarjeta", ANCHO);
  confirmar.onPointerUpObservable.add(() => {
    const nombre = responsable.text.trim();
    const fecha = plazo.text.trim();

    // Se valida de verdad, no por formalidad: una tarjeta sin responsable ni
    // plazo es justo lo que el curso advierte que no sirve.
    if (nombre.length < 3) {
      aviso.text = "Escribe quién hará el seguimiento.";
      aviso.isVisible = true;
      return;
    }
    if (fecha.length < 6) {
      aviso.text = "Indica hasta cuándo hay plazo para resolverlo.";
      aviso.isVisible = true;
      return;
    }

    cerrar({ responsable: nombre, plazo: fecha });
  });
  columna.addControl(confirmar);
  columna.addControl(crearEspacio("aireTarjeta7", 10));

  const cancelar = crearBotonSecundario("btnCancelarTarjeta", "Ahora no", ANCHO);
  cancelar.onPointerUpObservable.add(() => cerrar(null));
  columna.addControl(cancelar);

  velo.onPointerUpObservable.add(() => cerrar(null));
}

/**
 * Coloca la tarjeta roja física sobre el objeto.
 *
 * Lleva impresos el número, el responsable y el plazo. Que se lean en la
 * escena importa: en una planta la tarjeta se consulta mirándola, no abriendo
 * un sistema. Y en el Nivel 5 el jugador tendrá que auditar precisamente si
 * ese plazo venció.
 */
export function colocarTarjetaRoja(
  scene: Scene,
  id: string,
  x: number,
  y: number,
  z: number,
  numero: number,
  datos: DatosTarjeta
): TransformNode {
  const raiz = new TransformNode(`tarjetaRoja_${id}`, scene);
  raiz.position.set(x, y, z);

  const matAlambre = new PBRMaterial(`matAlambreTR_${id}`, scene);
  matAlambre.albedoColor = new Color3(0.62, 0.62, 0.66);
  matAlambre.roughness = 0.35;
  matAlambre.metallic = 0.85;

  const alambre = MeshBuilder.CreateCylinder(
    `alambreTR_${id}`,
    { diameter: 0.009, height: 0.13, tessellation: 8 },
    scene
  );
  alambre.position.y = 0.15;
  alambre.rotation.z = 0.2;
  alambre.parent = raiz;
  alambre.material = matAlambre;

  const matTarjeta = materialPintado(scene, `matTarjetaRojaImpresa_${id}`, 768, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#b4231f";
    ctx.fillRect(0, 0, w, h);

    // Fibra de cartón: el rojo plano se lee como plástico.
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 5, 4);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 12;
    ctx.strokeRect(32, 32, w - 64, h - 64);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 112px system-ui, sans-serif";
    ctx.fillText("TARJETA", w / 2, 184);
    ctx.fillText("ROJA", w / 2, 296);

    ctx.font = "600 60px ui-monospace, monospace";
    ctx.fillText(`N° ${String(numero).padStart(4, "0")}`, w / 2, 400);

    // Los dos datos que exige el curso, impresos y legibles.
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText("RESPONSABLE", 72, 524);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 52px system-ui, sans-serif";
    ctx.fillText(recortar(datos.responsable, 18), 72, 592);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText("PLAZO", 72, 712);

    ctx.fillStyle = "rgba(60,10,8,0.9)";
    ctx.fillRect(60, 744, w - 120, 124);
    ctx.fillStyle = "#ffd9d4";
    ctx.font = "bold 68px ui-monospace, monospace";
    ctx.fillText(recortar(datos.plazo, 12), 88, 828);
  });

  // Filtrado anisotrópico al máximo. La tarjeta casi nunca se mira de frente
  // —cuelga girada y la cámara orbita— y sin esto el texto se deshace en
  // cuanto se ve en ángulo, que es justo cuando hace falta leerla.
  const texturaTarjeta = matTarjeta.albedoTexture;
  if (texturaTarjeta) texturaTarjeta.anisotropicFilteringLevel = 16;

  const tarjeta = MeshBuilder.CreateBox(
    `chapaTR_${id}`,
    { width: 0.19, height: 0.26, depth: 0.005 },
    scene
  );
  tarjeta.position.set(0.045, 0.03, 0.02);
  tarjeta.rotation.set(0, -0.28, 0.12);
  tarjeta.parent = raiz;
  tarjeta.material = matTarjeta;

  return raiz;
}

function recortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : texto.slice(0, maximo - 1) + "…";
}

/** Marco de cinta roja del área de descarte, pintado en el piso. */
export function crearAreaDescarte(
  scene: Scene,
  x: number,
  z: number,
  ancho: number,
  fondo: number
): Mesh {
  const LADO = 512;
  const textura = materialPintado(scene, "matAreaDescarte", LADO, LADO, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // Interior apenas teñido: es una zona delimitada, no una alfombra.
    ctx.fillStyle = "rgba(176,58,46,0.13)";
    ctx.fillRect(0, 0, w, h);

    // Cinta a rayas, como la de demarcación real.
    const GROSOR = 34;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(GROSOR, GROSOR, w - GROSOR * 2, h - GROSOR * 2);
    ctx.clip("evenodd");

    ctx.fillStyle = "#b0392e";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(245,240,235,0.9)";
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.translate(-w, -h);
    for (let i = 0; i < w * 2; i += 64) {
      ctx.fillRect(i, 0, 32, h * 2);
    }
    ctx.restore();
  });

  const piso = MeshBuilder.CreateGround("areaDescarte", { width: ancho, height: fondo }, scene);
  piso.position.set(x, 0.012, z);
  piso.material = textura;
  piso.isPickable = false;

  return piso;
}