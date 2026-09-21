"""
Convierte el escenario Banco (OBJ + MTL + texturas de Maya) a un único GLB
listo para Babylon.js.

El paquete de Banco viene como:
    Banco.obj
    Banco.mtl
    Texturas/...

El OBJ trae materiales genéricos de Maya (set3, set4, set5, etc.) y el MTL
no enlaza las texturas. Por eso este script importa la geometría y reconstruye
los materiales PBR usando las texturas reales del paquete.

USO
---
1) Instala/abre Blender 4.x o 5.x.
2) Cambia CARPETA_BANCO y ARCHIVO_SALIDA, o pásalos después de "--".
3) Ejecuta desde terminal:

    blender --background --python convertir_banco.py
    blender --background --python convertir_banco.py -- <carpeta_banco> <salida.glb>

Al terminar debe existir:
    .../public/models/banco.glb

El GLB queda en metros y centrado sobre el suelo, para cargarlo directamente
desde Babylon con:

    ImportMeshAsync("/models/banco.glb", scene)
"""

import bpy
import os
import sys

# ---------------------------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------------------------

# El paquete de septiembre (14/09). El de agosto sigue en Desktop\Banco.
CARPETA_BANCO = r"C:\Users\Cristofer Alvarado\Desktop\wetransfer_banco-y-supermercado_2026-09-14_2331\Banco"
ARCHIVO_SALIDA = r"C:\Users\Cristofer Alvarado\Desktop\5s-game\public\models\banco.glb"

# Maya/OBJ viene en centímetros.
ESCALA = 0.01

MAPAS = ("BaseColor", "Roughness", "Metallic", "Normal")

# Relación entre los materiales que trae Banco.obj y la carpeta real de
# texturas del paquete.
#
# ─── ACTUALIZADO AL PAQUETE DE SEPTIEMBRE ────────────────────────────────
#
# El reexportado de Bitplay cambió tres cosas, y las tres rompían el mapeo
# anterior en silencio: el material sin entrada aquí sale gris liso, sin dar
# ningún error.
#
#   1. La carpeta Pilares pasó a llamarse Pilar, y su textura de
#      Pilates_Pilares_SG a Pilates_set14.
#   2. Aparecieron dos carpetas nuevas: Barrera y Puerta.
#   3. Los materiales pasaron de diez a dieciocho.
#
# ─── DE DÓNDE SALE LA TABLA ──────────────────────────────────────────────
#
# De las CONEXIONES del Banco.ma: qué nodo de textura entra en el shader de
# cada grupo de sombreado. Es la asignación real, la que Bitplay ve en Maya.
#
# Una primera versión se dedujo de los nombres de grupo del OBJ y se equivocó
# en tres, que la escena del .ma desmiente sin dudas:
#
#   · set11 es la ESTRUCTURA (losa, cielo y techo), no la barrera. Convertido
#     así, el edificio entero salía con la textura roja de la barrera.
#   · set19 es la BARRERA de fila (seis postes y dos cintas), no un pilar.
#   · set18 son las cuatro PLACAS de sobre el mostrador, no el mostrador.
#
# Y cuatro materiales no llevan textura en Maya, solo color: las letras del
# rótulo, los números de las placas, los perfiles de ventana y el vidrio. Se
# les pone su color original en vez de pintarlos con una textura ajena.
#
# EL RÓTULO. Los materiales typeOpenPBRSurfaceSG y pasted__typeOpenPBRSurfaceSG
# van sobre geometría llamada typeMesh, que es la herramienta Type de Maya:
# texto en 3D. O sea que ESAS SON LAS LETRAS del letrero. EscenaBanco las
# enciende buscando "type" en el nombre del material.


def _mapas(prefijo):
    """Los cuatro mapas de un material, a partir de su prefijo en Texturas/."""
    return {
        "base": f"Texturas/{prefijo}_BaseColor.1001.png",
        "roughness": f"Texturas/{prefijo}_Roughness.1001.png",
        "metallic": f"Texturas/{prefijo}_Metallic.1001.png",
        "normal": f"Texturas/{prefijo}_Normal.1001.png",
    }


MATERIALES = {
    "set3": _mapas("Mostrador/Mostrador_Mostrador_SG"),  # Mostrador
    "set4": _mapas("Sillas/Sillas_Asiento_Metal_SG"),  # Sillas de espera: estructura
    "set5": _mapas("Sillas/Sillas_Asientis_SG"),  # Sillas de espera: asientos
    "set6": _mapas("Sillas Off/Silla Off_SillaOff_SG"),  # Sillas de oficina: tapizado
    "set7": _mapas("Sillas Off/Silla Off_Silla_Plastico_SG"),  # Sillas de oficina: plástico
    "set10": _mapas("Base/Base Banco_Banco_SG"),  # Suelo y muros
    "set11": _mapas("Estructura/Estructura_Estructura1"),  # Losa, cielo y techo
    "set13": _mapas("Puerta/Puerta_Puerta_Sg"),  # Marco, hoja y manilla de la puerta
    "set17": _mapas("Pilar/Pilates_set14"),  # Pilares
    "set18": _mapas("Letrero/Cartelito_Letrero_SG1"),  # Placas sobre el mostrador
    "set19": _mapas("Barrera/Barrera_Barrera_SG"),  # Barrera de fila: postes y cintas
    "initialShadingGroup": _mapas("Base/Base Banco_Banco_SG"),  # Plano del suelo

    # Sin textura en Maya: su color original.
    "typeOpenPBRSurfaceSG": {"color": (0.538, 0.538, 0.200), "roughness": 0.5},  # Letras del rótulo
    "pasted__typeOpenPBRSurfaceSG": {"color": (0.538, 0.538, 0.200), "roughness": 0.5},  # Segunda capa
    "aiStandardSurface3SG": {"color": (0.708, 0.800, 0.800), "roughness": 0.5},  # Números de las placas
    # Blanco en Maya. Un punto por debajo: a 1,0 se quema con la luz de la sala.
    "Palos_ventana_SG": {"color": (0.92, 0.92, 0.92), "roughness": 0.5},  # Perfiles de ventana

    # Los monitores y la tele. En Maya llevan una textura de pantalla
    # (Interior_Monitor_SG) que el paquete no incluye: color liso oscuro, que
    # para una pantalla apagada es lo correcto.
    "set12": {"color": (0.05, 0.055, 0.06), "roughness": 0.35},

    # aiStandardSurface2SG es el vidrio: no pasa por la tabla, ver material_vidrio.
}

COLOR_FALLBACK = (0.34, 0.36, 0.39, 1.0)


def log(texto):
    print("[banco] " + texto)
    sys.stdout.flush()


def nombre_base(nombre):
    """Quita sufijos .001, .002, etc. que Blender agrega al importar."""
    partes = nombre.rsplit(".", 1)
    if len(partes) == 2 and partes[1].isdigit() and len(partes[1]) == 3:
        return partes[0]
    return nombre


def limpiar_escena():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cargar_imagen(ruta, es_color):
    imagen = bpy.data.images.load(ruta, check_existing=True)
    imagen.colorspace_settings.name = "sRGB" if es_color else "Non-Color"
    return imagen


def crear_nodo_textura(arbol, ruta, x, y, es_color):
    if not ruta or not os.path.isfile(ruta):
        return None

    nodo = arbol.nodes.new("ShaderNodeTexImage")
    nodo.location = (x, y)
    nodo.image = cargar_imagen(ruta, es_color)
    return nodo


def material_vidrio(material):
    material.use_nodes = True
    arbol = material.node_tree
    arbol.nodes.clear()

    salida = arbol.nodes.new("ShaderNodeOutputMaterial")
    salida.location = (500, 0)

    principled = arbol.nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (150, 0)

    # Los valores del shader Vidrio de Maya: azul grisáceo muy claro y 15 % de
    # opacidad.
    principled.inputs["Base Color"].default_value = (0.62, 0.68, 0.80, 1.0)
    principled.inputs["Roughness"].default_value = 0.06
    if "Alpha" in principled.inputs:
        principled.inputs["Alpha"].default_value = 0.15

    try:
        material.surface_render_method = "DITHERED"
    except (AttributeError, TypeError):
        try:
            material.blend_method = "BLEND"
        except (AttributeError, TypeError):
            pass

    arbol.links.new(principled.outputs["BSDF"], salida.inputs["Surface"])


def construir_material(material, carpeta_banco):
    original = nombre_base(material.name)

    # El vidrio del mostrador no necesita textura.
    if original == "aiStandardSurface2SG":
        material_vidrio(material)
        return "vidrio"

    rutas = MATERIALES.get(original)
    material.use_nodes = True
    arbol = material.node_tree
    arbol.nodes.clear()

    salida = arbol.nodes.new("ShaderNodeOutputMaterial")
    salida.location = (600, 0)

    principled = arbol.nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (220, 0)

    arbol.links.new(principled.outputs["BSDF"], salida.inputs["Surface"])

    if rutas is None:
        # Un material que no está en la tabla sale gris liso sin dar ningún
        # error. Se avisa en voz alta: así se colaron los tres materiales
        # cruzados de la primera versión.
        principled.inputs["Base Color"].default_value = COLOR_FALLBACK
        principled.inputs["Roughness"].default_value = 0.82
        return "COLOR DE RESPALDO: no está en la tabla MATERIALES"

    if "color" in rutas:
        principled.inputs["Base Color"].default_value = (*rutas["color"], 1.0)
        principled.inputs["Roughness"].default_value = rutas.get("roughness", 0.82)
        return "color liso de Maya"

    encontradas = []

    # BaseColor
    ruta_base = os.path.join(carpeta_banco, rutas["base"])
    base = crear_nodo_textura(arbol, ruta_base, -500, 300, True)
    if base:
        arbol.links.new(base.outputs["Color"], principled.inputs["Base Color"])
        encontradas.append("BaseColor")

    # Roughness
    ruta_rough = os.path.join(carpeta_banco, rutas["roughness"])
    rough = crear_nodo_textura(arbol, ruta_rough, -500, 0, False)
    if rough:
        arbol.links.new(rough.outputs["Color"], principled.inputs["Roughness"])
        encontradas.append("Roughness")

    # Metallic
    ruta_metal = os.path.join(carpeta_banco, rutas["metallic"])
    metal = crear_nodo_textura(arbol, ruta_metal, -500, -300, False)
    if metal:
        arbol.links.new(metal.outputs["Color"], principled.inputs["Metallic"])
        encontradas.append("Metallic")

    # Normal
    ruta_normal = os.path.join(carpeta_banco, rutas["normal"])
    normal = crear_nodo_textura(arbol, ruta_normal, -500, -600, False)
    if normal:
        mapa_normal = arbol.nodes.new("ShaderNodeNormalMap")
        mapa_normal.location = (-150, -600)
        arbol.links.new(normal.outputs["Color"], mapa_normal.inputs["Color"])
        arbol.links.new(mapa_normal.outputs["Normal"], principled.inputs["Normal"])
        encontradas.append("Normal")

    if "BaseColor" not in encontradas:
        principled.inputs["Base Color"].default_value = COLOR_FALLBACK

    if "Roughness" not in encontradas:
        principled.inputs["Roughness"].default_value = 0.82

    return ", ".join(encontradas) if encontradas else "color de respaldo"


def importar_obj(ruta_obj):
    # Blender 4.x
    try:
        bpy.ops.wm.obj_import(filepath=ruta_obj)
        log("Importador OBJ: bpy.ops.wm.obj_import")
        return True
    except (AttributeError, RuntimeError) as error:
        log("wm.obj_import no disponible: " + type(error).__name__)

    # Blender 3.x / versiones anteriores
    try:
        bpy.ops.import_scene.obj(filepath=ruta_obj)
        log("Importador OBJ: bpy.ops.import_scene.obj")
        return True
    except (AttributeError, RuntimeError) as error:
        log("import_scene.obj no disponible: " + type(error).__name__)

    return False


def medir_objetos(objetos):
    minimo = Vector((float("inf"), float("inf"), float("inf")))
    maximo = Vector((float("-inf"), float("-inf"), float("-inf")))

    for objeto in objetos:
        objeto.select_set(False)
        objeto.hide_viewport = False
        objeto.hide_render = False
        objeto.update_tag()
        objeto.matrix_world = objeto.matrix_world.copy()
        objeto.data.update()

        for vertice in objeto.data.vertices:
            punto = objeto.matrix_world @ vertice.co
            minimo.x = min(minimo.x, punto.x)
            minimo.y = min(minimo.y, punto.y)
            minimo.z = min(minimo.z, punto.z)
            maximo.x = max(maximo.x, punto.x)
            maximo.y = max(maximo.y, punto.y)
            maximo.z = max(maximo.z, punto.z)

    return minimo, maximo


def Vector(valor):
    # Import tardío para mantener el script simple y compatible.
    from mathutils import Vector as BlenderVector
    return BlenderVector(valor)


def aplicar_materiales(objetos, carpeta_banco):
    usados = set()

    for objeto in objetos:
        if objeto.type != "MESH":
            continue

        for slot in objeto.material_slots:
            if slot.material is None:
                continue

            material = slot.material
            clave = nombre_base(material.name)

            if clave not in usados:
                estado = construir_material(material, carpeta_banco)
                usados.add(clave)
                log(f"Material {clave}: {estado}")


def centrar_y_apoyar(objetos):
    minimo, maximo = medir_objetos(objetos)

    # En Blender el eje vertical es Z: el importador ya pasó el OBJ, que viene
    # con Y hacia arriba, a su sistema. Tomar Y como altura centraba el modelo
    # a lo alto y lo apoyaba de costado.
    centro_x = (minimo.x + maximo.x) / 2.0
    centro_y = (minimo.y + maximo.y) / 2.0
    piso = minimo.z

    for objeto in objetos:
        objeto.location.x -= centro_x
        objeto.location.y -= centro_y
        objeto.location.z -= piso

    # Recalcular después de centrar.
    bpy.context.view_layer.update()

    minimo2, maximo2 = medir_objetos(objetos)
    log(
        "Dimensiones finales: "
        f"{maximo2.x - minimo2.x:.2f} de ancho x "
        f"{maximo2.z - minimo2.z:.2f} de alto x "
        f"{maximo2.y - minimo2.y:.2f} de fondo (m)"
    )


def convertir_a_metros(objetos):
    # Aplica escala local de las geometrías importadas antes de la escala global.
    bpy.ops.object.select_all(action="DESELECT")

    for objeto in objetos:
        objeto.select_set(True)

    if objetos:
        bpy.context.view_layer.objects.active = objetos[0]
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Escala CM -> M sobre todos los objetos.
    for objeto in objetos:
        objeto.scale = (ESCALA, ESCALA, ESCALA)

    bpy.context.view_layer.update()
    for objeto in objetos:
        bpy.context.view_layer.objects.active = objeto
        objeto.select_set(True)

    if objetos:
        bpy.context.view_layer.objects.active = objetos[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def exportar_glb(ruta_salida):
    carpeta = os.path.dirname(ruta_salida)
    if carpeta and not os.path.isdir(carpeta):
        os.makedirs(carpeta)

    bpy.ops.object.select_all(action="SELECT")

    log("Exportando GLB...")
    try:
        bpy.ops.export_scene.gltf(
            filepath=ruta_salida,
            export_format="GLB",
            export_image_format="WEBP",
            export_image_quality=85,
            export_apply=True,
            export_yup=True,
        )
    except (TypeError, RuntimeError):
        # Compatibilidad con Blender que no soporte exportación WEBP.
        bpy.ops.export_scene.gltf(
            filepath=ruta_salida,
            export_format="GLB",
            export_image_format="JPEG",
            export_apply=True,
            export_yup=True,
        )


def rutas_de_trabajo():
    """Carpeta y salida: las que vengan después de "--", o las de arriba."""
    argumentos = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    carpeta = argumentos[0] if len(argumentos) > 0 else CARPETA_BANCO
    salida = argumentos[1] if len(argumentos) > 1 else ARCHIVO_SALIDA
    return carpeta, salida


def main():
    log("=== CONVERSOR BANCO -> GLB ===")

    carpeta_banco, archivo_salida = rutas_de_trabajo()
    log(f"Paquete: {carpeta_banco}")
    ruta_obj = os.path.join(carpeta_banco, "Banco.obj")
    ruta_mtl = os.path.join(carpeta_banco, "Banco.mtl")
    ruta_texturas = os.path.join(carpeta_banco, "Texturas")

    if not os.path.isfile(ruta_obj):
        log("ERROR: no encuentro " + ruta_obj)
        return 1

    if not os.path.isfile(ruta_mtl):
        log("ERROR: no encuentro " + ruta_mtl)
        return 1

    if not os.path.isdir(ruta_texturas):
        log("ERROR: no encuentro " + ruta_texturas)
        return 1

    limpiar_escena()

    if not importar_obj(ruta_obj):
        log("ERROR: ningún importador OBJ funcionó.")
        return 1

    objetos = [
        objeto
        for objeto in bpy.context.scene.objects
        if objeto.type == "MESH"
    ]

    log(f"Mallas importadas: {len(objetos)}")

    if not objetos:
        log("ERROR: el OBJ no trajo geometría.")
        return 1

    convertir_a_metros(objetos)
    aplicar_materiales(objetos, carpeta_banco)
    centrar_y_apoyar(objetos)
    exportar_glb(archivo_salida)

    if os.path.isfile(archivo_salida):
        peso = os.path.getsize(archivo_salida) / (1024 * 1024)
        log(f"GLB generado: {archivo_salida}")
        log(f"Peso: {peso:.1f} MB")
        return 0

    log("ERROR: Blender terminó sin crear el GLB.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())