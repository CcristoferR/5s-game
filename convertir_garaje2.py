"""
Convierte el garaje que entregó Bitplay (FBX + texturas UDIM de Maya) en un
único .glb listo para cargar en Babylon.js.

Resuelve los tres problemas del paquete original:
  1. ESCALA — el modelo viene en centímetros de Maya (12,25 m de ancho medidos
     como 1225 unidades). Babylon trabaja en metros, así que se multiplica por
     0.01 y se aplica la transformación.
  2. UDIM — las UV se salen del rango 0-1 (van hasta 3.97). Babylon no soporta
     UDIM. El script detecta el tile de cada cara, le resta el desplazamiento
     para devolverla a 0-1, y le asigna la textura de ESE tile. Si un material
     usa varios tiles (PilaresConcreto usa 1012 y 1013), lo divide en un
     material por tile.
  3. TEXTURAS SIN CONECTAR — el .mtl no referencia ninguna imagen (todos los
     colores vienen en negro). Acá se arma el Principled BSDF de cada material
     con BaseColor, Roughness, Metallic y Normal, con los espacios de color
     correctos.

USO
---
  1. Editá las tres rutas de CONFIGURACIÓN de abajo.
  2. Abrí una terminal en la carpeta donde esté este archivo y ejecutá:

       blender --background --python convertir_garaje.py

     (En Windows, si `blender` no es reconocido, usá la ruta completa:
      "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe")

  3. Leé el resumen que imprime al final: dice qué materiales quedaron con
     textura y cuáles no.

Probado con Blender 4.x.
"""

import bpy
import os
import sys

# ---------------------------------------------------------------------------
# CONFIGURACIÓN — editá estas tres rutas
# ---------------------------------------------------------------------------

CARPETA_GARAJE = r"C:\Users\Cristofer Alvarado\Desktop\Garaje\Garaje"
ARCHIVO_SALIDA = r"C:\Users\Cristofer Alvarado\Desktop\5s-game\public\models\garaje.glb"

# Maya exporta en centímetros; Babylon asume metros.
ESCALA = 0.01

# Materiales que son vidrio: se hacen transparentes en vez de buscarles textura.
MATERIALES_VIDRIO = ["Cristal"]

# El paquete no trae textura para la pared lateral (tile 1021) ni para la
# trasera (tile 1014). En vez de dejarlas planas, se reutiliza una textura
# que SÍ vino. Por defecto la de la pared frontal: es del mismo material y
# la misma familia visual, así las tres paredes se ven coherentes.
#
# Si preferís un hormigón crudo más industrial en las paredes que faltan,
# cambiá ("Pared_SG", 1002) por ("concreto_interior__SG", 1001).
SUSTITUTOS = {
    "Pared_Lateral": ("Pared_SG", 1002),
    "Pared_trasera": ("Pared_SG", 1002),
}

# Materiales cuyo nombre en el FBX no se parece al de su textura.
# "Estructura" en el modelo se llama "Concreto_SG" en los archivos.
ALIAS = {
    "Estructura": "Concreto_SG",
}

# Color de reemplazo para materiales sin textura NI sustituto, para que no
# queden negros. Es un hormigón neutro (RGBA lineal).
COLOR_SIN_TEXTURA = (0.42, 0.41, 0.39, 1.0)

MAPAS = ["BaseColor", "Roughness", "Metallic", "Normal"]

# ---------------------------------------------------------------------------


def log(mensaje):
    print("[garaje] " + mensaje)
    sys.stdout.flush()


def limpiar_escena():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def nombre_base(nombre):
    """Blender agrega sufijos .001 al desduplicar; los quitamos."""
    partes = nombre.rsplit(".", 1)
    if len(partes) == 2 and partes[1].isdigit() and len(partes[1]) == 3:
        return partes[0]
    return nombre


def indexar_texturas(raiz):
    """Recorre 'Texturas listas' y devuelve {nombre_archivo: ruta_completa}.

    Ignora los .tx (texturas de Arnold, inútiles para web) y las miniaturas
    de .mayaSwatches.
    """
    indice = {}
    for carpeta, subcarpetas, archivos in os.walk(raiz):
        subcarpetas[:] = [s for s in subcarpetas if s != ".mayaSwatches"]
        for archivo in archivos:
            if archivo.lower().endswith(".png"):
                indice[archivo] = os.path.join(carpeta, archivo)
    return indice


def candidatos_de_nombre(material):
    """Formas posibles del nombre de un material dentro del nombre de archivo.

    Blender 5 importa los materiales SIN el sufijo _SG de Maya y a veces les
    agrega un número: el shading group "Techo_SG" llega como "Techo1". Las
    texturas, en cambio, conservan el nombre original. Se prueban todas las
    variantes razonables hasta que una calce.
    """
    nombres = []
    base = material.rstrip("0123456789")

    if base in ALIAS:
        nombres.append(ALIAS[base])

    for variante in (base, material):
        if variante.endswith("_SG"):
            nombres.append(variante)
        else:
            nombres.append(variante + "_SG")

    unicos = []
    for nombre in nombres:
        if nombre and nombre not in unicos:
            unicos.append(nombre)
    return unicos


def buscar_textura(indice, material, mapa, tile):
    """Encuentra la textura de un material para un tile y un tipo de mapa.

    Los archivos vienen con prefijo de carpeta ("Pared Frontal_Pared_SG_..."),
    así que se busca por sufijo en vez de por nombre exacto.
    """
    for nombre in candidatos_de_nombre(material):
        sufijo = "{0}_{1}.{2}.png".format(nombre, mapa, tile)
        for archivo, ruta in indice.items():
            if archivo.endswith(sufijo):
                return ruta
    return None


def tile_de_uv(u, v):
    """Convierte una coordenada UV al número de tile UDIM que la contiene."""
    columna = int(u // 1)
    fila = int(v // 1)
    columna = max(0, min(9, columna))
    fila = max(0, fila)
    return 1001 + columna + 10 * fila


def desplazamiento_de_tile(tile):
    indice = tile - 1001
    return indice % 10, indice // 10


def separar_por_tile(objeto):
    """Divide cada material en uno por tile UDIM y devuelve las UV a 0-1.

    Devuelve un dict {nombre_material_nuevo: (material_original, tile)}.
    """
    malla = objeto.data
    if not malla.uv_layers:
        return {}

    uv = malla.uv_layers.active.data
    creados = {}
    nuevos_slots = {}

    for poligono in malla.polygons:
        if poligono.material_index >= len(objeto.material_slots):
            continue
        slot = objeto.material_slots[poligono.material_index]
        if slot.material is None:
            continue
        original = nombre_base(slot.material.name)

        # El tile se decide por el centro de la cara: así una cara que roza
        # el borde del tile no se va al vecino por un decimal.
        suma_u = 0.0
        suma_v = 0.0
        for indice_loop in poligono.loop_indices:
            suma_u += uv[indice_loop].uv[0]
            suma_v += uv[indice_loop].uv[1]
        total = len(poligono.loop_indices)
        tile = tile_de_uv(suma_u / total, suma_v / total)

        clave = (original, tile)
        if clave not in nuevos_slots:
            nombre_nuevo = "{0}__{1}".format(original, tile)
            material_nuevo = bpy.data.materials.get(nombre_nuevo)
            if material_nuevo is None:
                material_nuevo = bpy.data.materials.new(nombre_nuevo)
            if material_nuevo.name not in [s.name for s in objeto.material_slots]:
                objeto.data.materials.append(material_nuevo)
            indice_slot = [s.material.name for s in objeto.material_slots].index(material_nuevo.name)
            nuevos_slots[clave] = indice_slot
            creados[nombre_nuevo] = (original, tile)

        poligono.material_index = nuevos_slots[clave]

        offset_u, offset_v = desplazamiento_de_tile(tile)
        for indice_loop in poligono.loop_indices:
            uv[indice_loop].uv[0] -= offset_u
            uv[indice_loop].uv[1] -= offset_v

    return creados


def cargar_imagen(ruta, es_color):
    imagen = bpy.data.images.load(ruta, check_existing=True)
    # BaseColor va en sRGB; rugosidad, metalicidad y normales son datos, no
    # color — si se marcan mal, el material se ve descolorido o plano.
    imagen.colorspace_settings.name = "sRGB" if es_color else "Non-Color"
    return imagen


def armar_material(material, nombre_original, tile, indice_texturas, reporte):
    # En Blender 5 los materiales ya vienen con árbol de nodos y tocar
    # use_nodes emite un aviso de obsolescencia; solo se activa si hace falta.
    if getattr(material, "node_tree", None) is None:
        material.use_nodes = True
    arbol = material.node_tree
    arbol.nodes.clear()

    salida = arbol.nodes.new("ShaderNodeOutputMaterial")
    salida.location = (600, 0)
    principled = arbol.nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (200, 0)
    arbol.links.new(principled.outputs["BSDF"], salida.inputs["Surface"])

    es_vidrio = any(palabra.lower() in nombre_original.lower() for palabra in MATERIALES_VIDRIO)
    if es_vidrio:
        principled.inputs["Base Color"].default_value = (0.75, 0.82, 0.85, 1.0)
        principled.inputs["Roughness"].default_value = 0.05
        principled.inputs["Metallic"].default_value = 0.0
        if "Alpha" in principled.inputs:
            principled.inputs["Alpha"].default_value = 0.28
        # En Blender 4.2+ EEVEE Next reemplazó blend_method por
        # surface_render_method. Para el GLB lo que importa es el alpha, pero
        # se intenta igual para que se vea bien si abrís el .blend a mano.
        try:
            material.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            try:
                material.blend_method = "BLEND"
            except (AttributeError, TypeError):
                pass
        reporte.append((nombre_original, tile, "vidrio transparente"))
        return

    # Si este material no tiene textura propia, ¿hay una definida para
    # reutilizar? Se compara por sufijo porque el FBX antepone el nombre del
    # grupo ("Lateral_Pared_Lateral_SG" contiene "Pared_Lateral_SG").
    nombre_textura = nombre_original
    tile_textura = tile
    sustituido = False
    if buscar_textura(indice_texturas, nombre_original, "BaseColor", tile) is None:
        base_original = nombre_original.rstrip("0123456789")
        for clave, (reemplazo, tile_reemplazo) in SUSTITUTOS.items():
            if base_original.endswith(clave):
                nombre_textura = reemplazo
                tile_textura = tile_reemplazo
                sustituido = True
                break

    encontradas = []
    posicion_y = 300

    for mapa in MAPAS:
        ruta = buscar_textura(indice_texturas, nombre_textura, mapa, tile_textura)
        if ruta is None:
            continue

        nodo = arbol.nodes.new("ShaderNodeTexImage")
        nodo.location = (-500, posicion_y)
        nodo.image = cargar_imagen(ruta, es_color=(mapa == "BaseColor"))
        posicion_y -= 300
        encontradas.append(mapa)

        if mapa == "BaseColor":
            arbol.links.new(nodo.outputs["Color"], principled.inputs["Base Color"])
        elif mapa == "Roughness":
            arbol.links.new(nodo.outputs["Color"], principled.inputs["Roughness"])
        elif mapa == "Metallic":
            arbol.links.new(nodo.outputs["Color"], principled.inputs["Metallic"])
        elif mapa == "Normal":
            mapa_normal = arbol.nodes.new("ShaderNodeNormalMap")
            mapa_normal.location = (-180, posicion_y + 300)
            arbol.links.new(nodo.outputs["Color"], mapa_normal.inputs["Color"])
            arbol.links.new(mapa_normal.outputs["Normal"], principled.inputs["Normal"])

    if not encontradas:
        principled.inputs["Base Color"].default_value = COLOR_SIN_TEXTURA
        principled.inputs["Roughness"].default_value = 0.85
        reporte.append((nombre_original, tile, "SIN TEXTURA — color plano de reemplazo"))
    elif sustituido:
        reporte.append((
            nombre_original,
            tile,
            "REUTILIZA {0} tile {1}: {2}".format(nombre_textura, tile_textura, ", ".join(encontradas)),
        ))
    else:
        reporte.append((nombre_original, tile, "ok: " + ", ".join(encontradas)))


def main():
    log("=== VERSION 2 — con emparejamiento de nombres de material ===")

    ruta_fbx = os.path.join(CARPETA_GARAJE, "Garaje.fbx")
    ruta_texturas = os.path.join(CARPETA_GARAJE, "Texturas listas")

    if not os.path.isfile(ruta_fbx):
        log("ERROR: no encuentro " + ruta_fbx)
        return
    if not os.path.isdir(ruta_texturas):
        log("ERROR: no encuentro la carpeta " + ruta_texturas)
        return

    limpiar_escena()

    log("Importando FBX...")
    # Blender 5 reemplazó el importador de Python (import_scene.fbx) por uno
    # nuevo en C++ (wm.fbx_import). Se prueban ambos para funcionar en 3.x,
    # 4.x y 5.x sin cambiar nada.
    importado = False
    for operador in ("import_scene", "wm"):
        try:
            if operador == "import_scene":
                bpy.ops.import_scene.fbx(filepath=ruta_fbx)
            else:
                bpy.ops.wm.fbx_import(filepath=ruta_fbx)
            importado = True
            log("  importador usado: bpy.ops.{0}.fbx".format(operador))
            break
        except (AttributeError, RuntimeError) as error:
            log("  {0} no disponible ({1})".format(operador, type(error).__name__))
    if not importado:
        log("ERROR: ningún importador de FBX funcionó en esta versión de Blender.")
        return

    mallas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    log("Mallas importadas: {0}".format(len(mallas)))
    if not mallas:
        log("ERROR: el FBX no trajo geometría.")
        return

    indice_texturas = indexar_texturas(ruta_texturas)
    log("Texturas PNG encontradas: {0}".format(len(indice_texturas)))

    log("Separando por tile UDIM y devolviendo las UV a 0-1...")
    creados = {}
    for objeto in mallas:
        creados.update(separar_por_tile(objeto))

    log("Materiales resultantes: {0}".format(len(creados)))

    reporte = []
    for nombre_nuevo, (original, tile) in sorted(creados.items()):
        material = bpy.data.materials.get(nombre_nuevo)
        if material is not None:
            armar_material(material, original, tile, indice_texturas, reporte)

    # Limpieza de slots que quedaron sin usar tras el reasignado.
    for objeto in mallas:
        bpy.context.view_layer.objects.active = objeto
        bpy.ops.object.material_slot_remove_unused()

    log("Aplicando escala {0} (centímetros -> metros)...".format(ESCALA))
    bpy.ops.object.select_all(action="DESELECT")
    for objeto in mallas:
        objeto.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    for objeto in bpy.context.scene.objects:
        if objeto.parent is None:
            objeto.scale = (ESCALA, ESCALA, ESCALA)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    carpeta_salida = os.path.dirname(ARCHIVO_SALIDA)
    if carpeta_salida and not os.path.isdir(carpeta_salida):
        os.makedirs(carpeta_salida)

    log("Exportando GLB...")
    try:
        bpy.ops.export_scene.gltf(
            filepath=ARCHIVO_SALIDA,
            export_format="GLB",
            export_image_format="WEBP",
            export_image_quality=85,
            export_apply=True,
            export_yup=True,
        )
    except TypeError:
        # Blender 3.x no acepta WEBP ni export_image_quality.
        bpy.ops.export_scene.gltf(
            filepath=ARCHIVO_SALIDA,
            export_format="GLB",
            export_image_format="JPEG",
            export_apply=True,
            export_yup=True,
        )

    print("")
    print("=" * 68)
    print("RESUMEN POR MATERIAL")
    print("=" * 68)
    for original, tile, estado in sorted(reporte):
        print("  {0:32} tile {1}   {2}".format(original, tile, estado))
    print("=" * 68)

    if os.path.isfile(ARCHIVO_SALIDA):
        peso = os.path.getsize(ARCHIVO_SALIDA) / (1024 * 1024)
        print("GLB generado: {0}  ({1:.1f} MB)".format(ARCHIVO_SALIDA, peso))
    print("")


if __name__ == "__main__":
    main()