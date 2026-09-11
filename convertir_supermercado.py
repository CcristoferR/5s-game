#!/usr/bin/env python3
"""
Convierte el supermercado de Bitplay a un GLB listo para Babylon.

═══════════════════════════════════════════════════════════════════════════
POR QUÉ HAY QUE CONVERTIRLO Y NO CARGAR EL OBJ DIRECTO
═══════════════════════════════════════════════════════════════════════════

El paquete llega como OBJ + un .mtl + trece carpetas de texturas sueltas. Tres
problemas, y el primero es el que deja la escena gris como en la captura:

  1. EL .MTL NO ENLAZA NINGUNA TEXTURA. Sus quince materiales solo declaran
     "Kd 0.00 0.00 0.00" — negro, sin una sola línea map_Kd. Las texturas
     existen, y están completas (BaseColor, Normal, Metallic, Roughness,
     Height), pero nadie las conectó con la geometría. Cargando el OBJ tal
     cual, Babylon hace exactamente lo que dice el archivo: pintar todo plano.

  2. ESTÁ EN CENTÍMETROS. Lo dice la primera línea del OBJ. Babylon trabaja en
     metros, y el resto del juego asume metros: sin convertir, el supermercado
     mide 1.337 metros de ancho.

  3. SON 5.046 GRUPOS Y 101.554 CARAS. Cada grupo es una malla aparte y una
     llamada de dibujo aparte. Fusionados por material quedan quince, que es
     lo que un navegador puede mover sin arrastrarse.

Convertir una vez deja un archivo que Babylon abre con la misma función que ya
usa el garaje del 5S, sin lógica de materiales en el código del juego.

═══════════════════════════════════════════════════════════════════════════
CÓMO SE AVERIGUÓ QUÉ TEXTURA VA EN CADA MATERIAL
═══════════════════════════════════════════════════════════════════════════

El paquete no lo dice: los materiales se llaman set1 … set13 y las carpetas
Base, Caja, Estanteria, Letrero, Maquina, Cosas Techo y siete de Comidas. Son
trece y trece, así que la correspondencia existe, pero hay que deducirla.

Se dedujo por dos vías, cruzadas:

  · LOS NOMBRES DE LOS OBJETOS que usa cada material. El OBJ conserva los
    nombres de Maya, y ahí están "Estante_con_comida7 Lata02 pCylinder",
    "Leches", "Botellas", "Cereal". Eso resuelve las comidas, incluida la
    numeración de las tres latas distintas.

  · LA CAJA ENVOLVENTE de cada material, para lo que los nombres no delatan.
    El letrero es un plano de 4,14 × 0,90 m colgado entre 1,20 y 2,10 m de
    altura; las cosas del techo están entre 1,58 y 2,77 m; la máquina es un
    cubo de 17 cm. Con las medidas no hay ambigüedad posible.

═══════════════════════════════════════════════════════════════════════════
UNA NOTA SOBRE METALLIC Y ROUGHNESS
═══════════════════════════════════════════════════════════════════════════

glTF no usa dos imágenes separadas: empaqueta las dos en una sola, con la
rugosidad en el canal verde y la metalicidad en el azul. Las texturas vienen
en archivos aparte, así que hay que combinarlas. Si se entregara cada una por
su lado, el visor leería la rugosidad del canal rojo —que no es— y todo saldría
con un brillo equivocado.

Uso:
    python3 convertir_supermercado.py <carpeta_del_paquete> <salida.glb>
"""

import base64
import io
import json
import os
import struct
import sys
from collections import defaultdict

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Correspondencia entre los materiales del OBJ y las carpetas de texturas.
#
# Deducida como se explica arriba. Si Bitplay reexporta el modelo y cambian los
# nombres, este diccionario es lo único que hay que revisar.
# ---------------------------------------------------------------------------
MATERIALES = {
    "set1": ("Base", "Edificio: muros y estructura"),
    "set2": ("Letrero", "Letrero colgante"),
    "set3": ("Estanteria", "Estanterías"),
    "set4": ("Maquina", "Máquina"),
    "set5": ("Cosas Techo", "Instalaciones de techo"),
    "set6": ("Caja", "Caja registradora"),
    "set7": ("Comidas/Pasta", "Pastas"),
    "set8": ("Comidas/Leche", "Leches"),
    "set9": ("Comidas/Lata03", "Latas 03"),
    "set10": ("Comidas/Lata02", "Latas 02"),
    "set11": ("Comidas/Lata01", "Latas 01"),
    "set12": ("Comidas/Cereal", "Cereales"),
    "set13": ("Comidas/Botella", "Botellas"),
    # El piso llega sin material propio. Se le pone la textura del edificio,
    # que es la única de 2048 px y la pensada para superficies grandes.
    "initialShadingGroup": ("Base", "Piso"),
    # Un tabique delgado de 5,45 m sin textura asignada en el paquete. Se deja
    # con color liso: inventarle una sería peor que dejarlo neutro.
    "aiStandardSurface3SG": (None, "Tabique"),
}

CM_A_M = 0.01
"""El OBJ declara centímetros en su primera línea. El resto del juego usa metros."""

LADO_GRANDE = 1024
"""Resolución para lo que el jugador ve de cerca: muros, piso, estanterías."""

LADO_PEQUENO = 512
"""
Resolución para los productos de las góndolas.

Una lata mide once centímetros y nunca se mira a menos de dos metros. A 1024
px eso son más de nueve mil píxeles de textura por centímetro de lata: detalle
que no llega a la pantalla y sí llega a la descarga. A la mitad no se aprecia
diferencia y el archivo baja a menos de la tercera parte.
"""

CALIDAD_JPEG = 86
"""
Los mapas de color van en JPEG y no en PNG.

Ninguno necesita transparencia, y para una fotografía de etiqueta el JPEG a 86
es indistinguible del PNG pesando un octavo. Los mapas de normales y el de
metal/rugosidad SÍ siguen en PNG: no son imágenes, son datos por canal, y la
compresión con pérdida les introduce artefactos que se ven como relieve sucio
sobre las superficies lisas.
"""


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Lectura del OBJ
# ---------------------------------------------------------------------------
def leer_obj(ruta):
    """
    Devuelve, por material, las caras trianguladas con posición, normal y UV.

    Se triangula al vuelo porque glTF solo admite triángulos y el modelo viene
    con quads. Se usa el abanico desde el primer vértice, que es correcto para
    los polígonos convexos que exporta Maya.
    """
    pos, nor, uvs = [], [], []
    por_material = defaultdict(list)
    material = None

    with open(ruta, "r", errors="ignore") as f:
        for linea in f:
            if linea.startswith("v "):
                p = linea.split()
                pos.append((float(p[1]), float(p[2]), float(p[3])))
            elif linea.startswith("vn "):
                p = linea.split()
                nor.append((float(p[1]), float(p[2]), float(p[3])))
            elif linea.startswith("vt "):
                p = linea.split()
                uvs.append((float(p[1]), float(p[2])))
            elif linea.startswith("usemtl"):
                material = linea.split(None, 1)[1].strip()
            elif linea.startswith("f ") and material:
                verts = []
                for tok in linea.split()[1:]:
                    partes = (tok.split("/") + ["", ""])[:3]
                    iv = int(partes[0]) - 1
                    it = int(partes[1]) - 1 if partes[1] else -1
                    inn = int(partes[2]) - 1 if partes[2] else -1
                    verts.append((iv, it, inn))
                for k in range(1, len(verts) - 1):
                    por_material[material].append((verts[0], verts[k], verts[k + 1]))

    return pos, nor, uvs, por_material


def construir_malla(pos, nor, uvs, triangulos):
    """
    Arma los arreglos de vértices de una malla.

    En OBJ, posición, normal y UV se indexan por separado; en glTF los tres
    comparten índice. Así que se crea un vértice por combinación distinta y se
    reutiliza el que ya exista — de lo contrario el archivo triplicaría su
    tamaño repitiendo posiciones idénticas.
    """
    mapa = {}
    P, N, T, I = [], [], [], []

    for tri in triangulos:
        for clave in tri:
            if clave not in mapa:
                iv, it, inn = clave
                mapa[clave] = len(P)
                x, y, z = pos[iv]
                P.append((x * CM_A_M, y * CM_A_M, z * CM_A_M))
                N.append(nor[inn] if 0 <= inn < len(nor) else (0.0, 1.0, 0.0))
                if 0 <= it < len(uvs):
                    u, v = uvs[it]
                    # OBJ mide V desde abajo y glTF desde arriba. Sin invertir,
                    # las etiquetas de los productos salen cabeza abajo.
                    T.append((u, 1.0 - v))
                else:
                    T.append((0.0, 0.0))
            I.append(mapa[clave])

    return (
        np.array(P, dtype=np.float32),
        np.array(N, dtype=np.float32),
        np.array(T, dtype=np.float32),
        # Ninguna malla del modelo pasa de 65.536 vértices, así que los índices
        # caben en 16 bits. Con 32 pesaban el doble sin aportar nada: dos
        # megas de archivo para direccionar vértices que no existen.
        np.array(I, dtype=np.uint16 if len(P) < 65536 else np.uint32),
    )


# ---------------------------------------------------------------------------
# Texturas
# ---------------------------------------------------------------------------
def buscar(carpeta, sufijo):
    """Encuentra el PNG de un mapa concreto, ignorando las miniaturas de Maya."""
    if not os.path.isdir(carpeta):
        return None
    for n in sorted(os.listdir(carpeta)):
        if n.endswith(".png") and sufijo.lower() in n.lower() and "swatch" not in n.lower():
            return os.path.join(carpeta, n)
    return None


def a_png(img, lado):
    """Reescala si hace falta y devuelve los bytes del PNG."""
    if max(img.size) > lado:
        img = img.resize((lado, lado), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, compress_level=9)
    return buf.getvalue()


def a_jpeg(img, lado):
    """Igual, pero en JPEG. Solo para mapas de color."""
    if max(img.size) > lado:
        img = img.resize((lado, lado), Image.LANCZOS)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=CALIDAD_JPEG, optimize=True)
    return buf.getvalue()


def combinar_metal_rugosidad(ruta_metal, ruta_rug, lado):
    """
    Empaqueta metalicidad y rugosidad en una sola imagen, como pide glTF.

    Verde = rugosidad, azul = metalicidad. El rojo queda libre (glTF lo reserva
    para oclusión ambiental, que este paquete no trae).
    """
    if not ruta_metal and not ruta_rug:
        return None

    def canal(ruta, por_defecto):
        if not ruta:
            return Image.new("L", (lado, lado), por_defecto)
        with Image.open(ruta) as im:
            return im.convert("L").resize((lado, lado), Image.LANCZOS)

    rug = canal(ruta_rug, 200)
    met = canal(ruta_metal, 0)
    vacio = Image.new("L", (lado, lado), 255)
    return a_png(Image.merge("RGB", (vacio, rug, met)), lado)


def cargar_texturas(base, sub):
    """Devuelve los tres mapas que glTF necesita: color, normal y metal/rugosidad."""
    carpeta = os.path.join(base, "Texturas", sub)
    # Los productos de góndola van a media resolución; el resto, completa.
    lado = LADO_PEQUENO if sub.startswith("Comidas/") else LADO_GRANDE
    color = buscar(carpeta, "BaseColor")
    normal = buscar(carpeta, "Normal")
    metal = buscar(carpeta, "Metallic")
    rug = buscar(carpeta, "Roughness")

    salida = {}
    if color:
        with Image.open(color) as im:
            salida["color"] = a_jpeg(im, lado)
    if normal:
        with Image.open(normal) as im:
            salida["normal"] = a_png(im.convert("RGB"), lado)
    mr = combinar_metal_rugosidad(metal, rug, lado)
    if mr:
        salida["mr"] = mr
    return salida


# ---------------------------------------------------------------------------
# Escritura del GLB
# ---------------------------------------------------------------------------
class Buffer:
    """Acumula los datos binarios y devuelve las vistas que los describen."""

    def __init__(self):
        self.datos = bytearray()
        self.vistas = []

    def agregar(self, blob, destino=None):
        # glTF exige que cada vista arranque en múltiplo de 4.
        while len(self.datos) % 4:
            self.datos.append(0)
        inicio = len(self.datos)
        self.datos.extend(blob)
        vista = {"buffer": 0, "byteOffset": inicio, "byteLength": len(blob)}
        if destino:
            vista["target"] = destino
        self.vistas.append(vista)
        return len(self.vistas) - 1


def convertir(entrada, salida):
    obj = os.path.join(entrada, "Supermercado.obj")
    if not os.path.isfile(obj):
        raise SystemExit(f"No encuentro {obj}")

    log("Leyendo el OBJ…")
    pos, nor, uvs, por_material = leer_obj(obj)
    log(f"  {len(pos):,} vértices · {sum(len(v) for v in por_material.values()):,} triángulos")

    buf = Buffer()
    accesores, mallas, materiales, texturas, imagenes = [], [], [], [], []
    indice_material = {}

    def accesor(arr, tipo, componente, destino, minmax=False):
        vista = buf.agregar(arr.tobytes(), destino)
        a = {
            "bufferView": vista,
            "componentType": componente,
            "count": int(arr.shape[0]),
            "type": tipo,
        }
        if minmax:
            a["min"] = [float(x) for x in arr.min(axis=0)]
            a["max"] = [float(x) for x in arr.max(axis=0)]
        accesores.append(a)
        return len(accesores) - 1

    def textura(blob):
        vista = buf.agregar(blob)
        tipo = "image/jpeg" if blob[:2] == b"\xff\xd8" else "image/png"
        imagenes.append({"bufferView": vista, "mimeType": tipo})
        texturas.append({"source": len(imagenes) - 1, "sampler": 0})
        return len(texturas) - 1

    log("Preparando materiales y texturas…")
    for nombre, (sub, descripcion) in MATERIALES.items():
        if nombre not in por_material:
            continue
        mat = {
            "name": descripcion,
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": [1, 1, 1, 1],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.85,
            },
        }
        if sub:
            mapas = cargar_texturas(entrada, sub)
            if "color" in mapas:
                mat["pbrMetallicRoughness"]["baseColorTexture"] = {
                    "index": textura(mapas["color"])
                }
            if "mr" in mapas:
                mat["pbrMetallicRoughness"]["metallicRoughnessTexture"] = {
                    "index": textura(mapas["mr"])
                }
                # Con el mapa presente, los factores actúan como multiplicadores.
                mat["pbrMetallicRoughness"]["metallicFactor"] = 1.0
                mat["pbrMetallicRoughness"]["roughnessFactor"] = 1.0
            if "normal" in mapas:
                mat["normalTexture"] = {"index": textura(mapas["normal"])}
            log(f"  {nombre:<22} {descripcion:<30} {len(mapas)} mapas")
        else:
            mat["pbrMetallicRoughness"]["baseColorFactor"] = [0.72, 0.72, 0.74, 1]
            log(f"  {nombre:<22} {descripcion:<30} sin textura (color liso)")

        materiales.append(mat)
        indice_material[nombre] = len(materiales) - 1

    log("Fusionando geometría por material…")
    nodos = []
    for nombre, triangulos in por_material.items():
        if nombre not in indice_material:
            continue
        P, N, T, I = construir_malla(pos, nor, uvs, triangulos)
        primitiva = {
            "attributes": {
                "POSITION": accesor(P, "VEC3", 5126, 34962, minmax=True),
                "NORMAL": accesor(N, "VEC3", 5126, 34962),
                "TEXCOORD_0": accesor(T, "VEC2", 5126, 34962),
            },
            "indices": accesor(I, "SCALAR", 5123 if I.dtype == np.uint16 else 5125, 34963),
            "material": indice_material[nombre],
        }
        etiqueta = MATERIALES[nombre][1]
        mallas.append({"name": etiqueta, "primitives": [primitiva]})
        nodos.append({"mesh": len(mallas) - 1, "name": etiqueta})
        log(f"  {etiqueta:<30} {len(I) // 3:>7,} triángulos")

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "Conversor de escenarios Bitplay — supermercado",
        },
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodos)))}],
        "nodes": nodos,
        "meshes": mallas,
        "materials": materiales,
        "accessors": accesores,
        "bufferViews": buf.vistas,
        "buffers": [{"byteLength": len(buf.datos)}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
    }
    if texturas:
        gltf["textures"] = texturas
        gltf["images"] = imagenes

    log("Escribiendo el GLB…")
    json_bin = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bin += b" " * ((4 - len(json_bin) % 4) % 4)
    bin_bin = bytes(buf.datos)
    bin_bin += b"\0" * ((4 - len(bin_bin) % 4) % 4)

    total = 12 + 8 + len(json_bin) + 8 + len(bin_bin)
    with open(salida, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(json_bin), 0x4E4F534A))
        f.write(json_bin)
        f.write(struct.pack("<II", len(bin_bin), 0x004E4942))
        f.write(bin_bin)

    mb = os.path.getsize(salida) / 1e6
    log(f"\nListo: {salida}  ({mb:.1f} MB)")
    log(f"  {len(mallas)} mallas · {len(materiales)} materiales · {len(texturas)} texturas")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    convertir(sys.argv[1], sys.argv[2])