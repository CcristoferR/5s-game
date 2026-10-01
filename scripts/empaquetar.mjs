// ===========================================================================
// Empaqueta lo que se sube a cPanel
// ===========================================================================
//
// En classplay.cl se publican dos cosas, cada una con su zip:
//
//   · La plataforma: `npm run publicar` (compila y después corre esto). Deja
//     classplay-subir.zip con una carpeta ingreso/ dentro: se extrae en
//     public_html y queda en classplay.cl/ingreso/.
//
//   · La página de inicio: `npm run publicar:inicio`. Deja
//     classplay-inicio.zip con lo que hay en la carpeta inicio/ del proyecto:
//     se extrae en public_html y queda en la raíz, classplay.cl.
//
// Los zips quedan en el Escritorio, o en la carpeta del proyecto si no hay
// Escritorio.
//
// ─── POR QUÉ LA PLATAFORMA VA DENTRO DE ingreso/ EN EL ZIP ────────────────
//
// Para que los dos zips se extraigan en el mismo sitio, public_html, sin que
// uno pise al otro: el de la plataforma nunca trae nada para la raíz. Con el
// contenido de dist/ suelto, como antes, extraerlo en public_html reemplazaría
// la página de inicio.
//
// ─── POR QUÉ SE ARMA A MANO ──────────────────────────────────────────────
//
// El servidor de cPanel es Linux, y al extraer un zip le pone a cada archivo
// los permisos que el zip trae anotados. Windows no tiene esos permisos: el
// tar de Windows anotaba 0777 en las carpetas y 0666 en los archivos —que
// cualquiera en el servidor puede modificar—, y el Compress-Archive de
// PowerShell 5 además escribe las rutas con "\", que el servidor extrae como
// archivos sueltos llamados "assets\index.js".
//
// Aquí cada entrada va con rutas "/" y marcada como hecha en Unix, con los
// permisos de un sitio web: 0755 las carpetas y 0644 los archivos. Es el
// formato zip de siempre, comprimido con deflate: lo abre cualquiera.

import { deflateRawSync, crc32 } from "node:zlib";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ES_INICIO = process.argv[2] === "inicio";

/**
 * La carpeta de la plataforma en el servidor. Tiene que coincidir con `base`
 * en vite.config.ts: el build pide todo desde ahí.
 */
const CARPETA_EN_EL_SERVIDOR = "ingreso";

const origen = join(process.cwd(), ES_INICIO ? "inicio" : "dist");
const prefijo = ES_INICIO ? "" : `${CARPETA_EN_EL_SERVIDOR}/`;

if (!existsSync(join(origen, "index.html"))) {
  console.error(
    ES_INICIO
      ? "Falta la página de inicio: no está inicio/index.html en el proyecto."
      : "No hay nada compilado en dist/. Primero hay que compilar: npm run build"
  );
  process.exit(1);
}

// Un build hecho para otra carpeta pide sus archivos donde no están, y el
// sitio queda en blanco. Se comprueba antes de armar nada.
if (!ES_INICIO && !readFileSync(join(origen, "index.html"), "utf8").includes(`/${prefijo}assets/`)) {
  console.error(
    `Lo que hay en dist/ no está compilado para /${prefijo}. ` +
      "Revisa base en vite.config.ts y vuelve a compilar: npm run build"
  );
  process.exit(1);
}

const escritorio = join(homedir(), "Desktop");
const destino = join(
  existsSync(escritorio) ? escritorio : process.cwd(),
  ES_INICIO ? "classplay-inicio.zip" : "classplay-subir.zip"
);
rmSync(destino, { force: true });

/** Los permisos con que queda cada cosa en el servidor. */
const CARPETA = 0o40755;
const ARCHIVO = 0o100644;

const locales = [];
const central = [];
let desplazamiento = 0;
let entradas = 0;

/** Fecha y hora en el formato de MS-DOS, que es el que usa el zip. */
function fechaDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const fecha = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [hora, fecha];
}

function agregar(nombre, datos, esCarpeta, cuando) {
  const nombreZip = Buffer.from(nombre, "utf8");
  const [hora, fecha] = fechaDos(cuando);
  let metodo = 0;
  let guardado = datos;
  const crc = esCarpeta ? 0 : crc32(datos);
  if (!esCarpeta) {
    const comprimido = deflateRawSync(datos, { level: 9 });
    // Lo que ya viene comprimido —el audio— se guarda tal cual si no achica.
    if (comprimido.length < datos.length) {
      metodo = 8;
      guardado = comprimido;
    }
  }

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // versión necesaria para extraer: 2.0
  local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
  local.writeUInt16LE(metodo, 8);
  local.writeUInt16LE(hora, 10);
  local.writeUInt16LE(fecha, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(guardado.length, 18);
  local.writeUInt32LE(datos.length, 22);
  local.writeUInt16LE(nombreZip.length, 26);
  local.writeUInt16LE(0, 28);
  locales.push(local, nombreZip, guardado);

  const modo = esCarpeta ? CARPETA : ARCHIVO;
  const cabecera = Buffer.alloc(46);
  cabecera.writeUInt32LE(0x02014b50, 0);
  cabecera.writeUInt16LE((3 << 8) | 20, 4); // hecho en Unix: el servidor respeta los permisos
  cabecera.writeUInt16LE(20, 6);
  cabecera.writeUInt16LE(0x0800, 8);
  cabecera.writeUInt16LE(metodo, 10);
  cabecera.writeUInt16LE(hora, 12);
  cabecera.writeUInt16LE(fecha, 14);
  cabecera.writeUInt32LE(crc, 16);
  cabecera.writeUInt32LE(guardado.length, 20);
  cabecera.writeUInt32LE(datos.length, 24);
  cabecera.writeUInt16LE(nombreZip.length, 28);
  cabecera.writeUInt16LE(0, 30); // extra
  cabecera.writeUInt16LE(0, 32); // comentario
  cabecera.writeUInt16LE(0, 34); // disco
  cabecera.writeUInt16LE(0, 36); // atributos internos
  cabecera.writeUInt32LE(((modo << 16) | (esCarpeta ? 0x10 : 0)) >>> 0, 38);
  cabecera.writeUInt32LE(desplazamiento, 42);
  central.push(cabecera, nombreZip);

  desplazamiento += local.length + nombreZip.length + guardado.length;
  entradas += 1;
}

function recorrer(carpeta, prefijo) {
  for (const nombre of readdirSync(carpeta).sort()) {
    const ruta = join(carpeta, nombre);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      agregar(`${prefijo}${nombre}/`, Buffer.alloc(0), true, info.mtime);
      recorrer(ruta, `${prefijo}${nombre}/`);
    } else {
      agregar(`${prefijo}${nombre}`, readFileSync(ruta), false, info.mtime);
    }
  }
}
// La carpeta de la plataforma va como entrada propia, para que se cree con sus
// permisos (0755) y no con los que decida el servidor.
if (prefijo) agregar(prefijo, Buffer.alloc(0), true, new Date());
recorrer(origen, prefijo);

const tamanoCentral = central.reduce((suma, b) => suma + b.length, 0);
const fin = Buffer.alloc(22);
fin.writeUInt32LE(0x06054b50, 0);
fin.writeUInt16LE(0, 4);
fin.writeUInt16LE(0, 6);
fin.writeUInt16LE(entradas, 8);
fin.writeUInt16LE(entradas, 10);
fin.writeUInt32LE(tamanoCentral, 12);
fin.writeUInt32LE(desplazamiento, 16);
fin.writeUInt16LE(0, 20);
writeFileSync(destino, Buffer.concat([...locales, ...central, fin]));

const mb = (statSync(destino).size / 1024 / 1024).toFixed(1);
console.log(`\nListo para subir: ${destino} (${mb} MB, ${entradas} elementos)`);
if (ES_INICIO) {
  console.log("En cPanel → public_html: Cargar el zip, Extraer y borrar el zip.");
  console.log("Queda en https://classplay.cl/");
} else {
  console.log(
    `En cPanel → public_html: borrar ${prefijo}assets si existe, Cargar el zip, Extraer y borrar el zip.`
  );
  console.log(`Queda en https://classplay.cl/${prefijo}`);
}
