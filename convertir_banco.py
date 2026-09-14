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
1) Instala/abre Blender 4.x.
2) Cambia CARPETA_BANCO y ARCHIVO_SALIDA.
3) Ejecuta desde terminal:

    blender --background --python convertir_banco.py

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

CARPETA_BANCO = r"C:\Users\Cristofer Alvarado\Desktop\Banco"
ARCHIVO_SALIDA = r"C:\Users\Cristofer Alvarado\Desktop\5s-game\public\models\banco.glb"

# Maya/OBJ viene en centímetros.
ESCALA = 0.01

MAPAS = ("BaseColor", "Roughness", "Metallic", "Normal")

# Relación entre los materiales genéricos que trae Banco.obj y la carpeta
# real de texturas del paquete.
MATERIALES = {
    # Mostrador
    "set3": {
        "base": "Texturas/Mostrador/Mostrador_Mostrador_SG_BaseColor.1001.png",
        "roughness": "Texturas/Mostrador/Mostrador_Mostrador_SG_Roughness.1001.png",
        "metallic": "Texturas/Mostrador/Mostrador_Mostrador_SG_Metallic.1001.png",
        "normal": "Texturas/Mostrador/Mostrador_Mostrador_SG_Normal.1001.png",
    },

    # Estructura metálica de las sillas
    "set4": {
        "base": "Texturas/Sillas/Sillas_Asiento_Metal_SG_BaseColor.1001.png",
        "roughness": "Texturas/Sillas/Sillas_Asiento_Metal_SG_Roughness.1001.png",
        "metallic": "Texturas/Sillas/Sillas_Asiento_Metal_SG_Metallic.1001.png",
        "normal": "Texturas/Sillas/Sillas_Asiento_Metal_SG_Normal.1001.png",
    },

    # Asientos
    "set5": {
        "base": "Texturas/Sillas/Sillas_Asientis_SG_BaseColor.1001.png",
        "roughness": "Texturas/Sillas/Sillas_Asientis_SG_Roughness.1001.png",
        "metallic": "Texturas/Sillas/Sillas_Asientis_SG_Metallic.1001.png",
        "normal": "Texturas/Sillas/Sillas_Asientis_SG_Normal.1001.png",
    },

    # Pilares
    "set9": {
        "base": "Texturas/Pilares/Pilates_Pilares_SG_BaseColor.1001.png",
        "roughness": "Texturas/Pilares/Pilates_Pilares_SG_Roughness.1001.png",
        "metallic": "Texturas/Pilares/Pilates_Pilares_SG_Metallic.1001.png",
        "normal": "Texturas/Pilares/Pilates_Pilares_SG_Normal.1001.png",
    },

    # Banco / superficies principales del banco
    "set10": {
        "base": "Texturas/Base/Base Banco_Banco_SG_BaseColor.1001.png",
        "roughness": "Texturas/Base/Base Banco_Banco_SG_Roughness.1001.png",
        "metallic": "Texturas/Base/Base Banco_Banco_SG_Metallic.1001.png",
        "normal": "Texturas/Base/Base Banco_Banco_SG_Normal.1001.png",
    },

    # Estructuras
    "set11": {
        "base": "Texturas/Estructura/Estructura_Estructura1_BaseColor.1001.png",
        "roughness": "Texturas/Estructura/Estructura_Estructura1_Roughness.1001.png",
        "metallic": "Texturas/Estructura/Estructura_Estructura1_Metallic.1001.png",
        "normal": "Texturas/Estructura/Estructura_Estructura1_Normal.1001.png",
    },
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

    principled.inputs["Base Color"].default_value = (0.38, 0.55, 0.72, 1.0)
    principled.inputs["Roughness"].default_value = 0.06
    if "Alpha" in principled.inputs:
        principled.inputs["Alpha"].default_value = 0.22

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
        # Materiales auxiliares sin mapas en el OBJ.
        if original == "Puerta_Sg":
            principled.inputs["Base Color"].default_value = (0.18, 0.12, 0.07, 1.0)
            principled.inputs["Roughness"].default_value = 0.72
        elif original == "typeOpenPBRSurfaceSG":
            principled.inputs["Base Color"].default_value = (0.32, 0.51, 0.72, 1.0)
            principled.inputs["Roughness"].default_value = 0.55
        else:
            principled.inputs["Base Color"].default_value = COLOR_FALLBACK
            principled.inputs["Roughness"].default_value = 0.82
        return "color de respaldo"

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

    centro_x = (minimo.x + maximo.x) / 2.0
    centro_z = (minimo.z + maximo.z) / 2.0
    piso = minimo.y

    for objeto in objetos:
        objeto.location.x -= centro_x
        objeto.location.z -= centro_z
        objeto.location.y -= piso

    # Recalcular después de centrar.
    bpy.context.view_layer.update()

    minimo2, maximo2 = medir_objetos(objetos)
    log(
        "Dimensiones finales: "
        f"{maximo2.x - minimo2.x:.2f} x "
        f"{maximo2.y - minimo2.y:.2f} x "
        f"{maximo2.z - minimo2.z:.2f} m"
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


def main():
    log("=== CONVERSOR BANCO -> GLB ===")

    ruta_obj = os.path.join(CARPETA_BANCO, "Banco.obj")
    ruta_mtl = os.path.join(CARPETA_BANCO, "Banco.mtl")
    ruta_texturas = os.path.join(CARPETA_BANCO, "Texturas")

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
    aplicar_materiales(objetos, CARPETA_BANCO)
    centrar_y_apoyar(objetos)
    exportar_glb(ARCHIVO_SALIDA)

    if os.path.isfile(ARCHIVO_SALIDA):
        peso = os.path.getsize(ARCHIVO_SALIDA) / (1024 * 1024)
        log(f"GLB generado: {ARCHIVO_SALIDA}")
        log(f"Peso: {peso:.1f} MB")
        return 0

    log("ERROR: Blender terminó sin crear el GLB.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
