import { Scene, MeshBuilder, PBRMaterial, StandardMaterial, Color3, Mesh, Vector3 } from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { crearRotulo3D } from "./Rotulo3D";

export interface DropZoneResult<T extends string> {
  mesh: Mesh;
  tipo: T;
}

// Medidas de la zona. Mas grandes que antes: en el garaje (12 x 19 m) los
// cuadrados de 1.6 m se perdian en el piso; a 2.2 m leen como demarcacion de
// area real, que es lo que son en una planta con 5S aplicado.
const LADO = 2.2;
const ANCHO_BORDE = 0.13;
const Z_ZONA = 2.4;

/**
 * Zona de clasificacion dibujada como demarcacion de piso: un panio de color
 * con su franja perimetral, al ras del suelo.
 *
 * Antes era una caja translucida de 5 cm de alto flotando sobre el piso. En una
 * planta las areas no se marcan con cajas: se marcan pintando el suelo, y esa
 * es justamente la herramienta visual que el jugador tiene que aprender a leer
 * en los niveles siguientes (Seiton y Seiketsu). Ademas el volumen levantado
 * chocaba con los objetos al soltarlos encima.
 */
export function crearDropZone<T extends string>(
  scene: Scene,
  tipo: T,
  x: number,
  color: Color3,
  _gui?: AdvancedDynamicTexture, // sin uso: la etiqueta ahora es 3D
  etiqueta?: string
): DropZoneResult<T> {
  // Franja perimetral: se dibuja primero y un pelo mas abajo, asi el panio
  // interior la tapa por el centro y queda solo el marco visible.
  const matBorde = new PBRMaterial(`matZonaBorde_${tipo}`, scene);
  matBorde.albedoColor = color.scale(1.35);
  matBorde.emissiveColor = color.scale(0.28);
  matBorde.roughness = 0.55;
  matBorde.metallic = 0;

  const borde = MeshBuilder.CreateGround(
    `zonaBorde_${tipo}`,
    { width: LADO + ANCHO_BORDE * 2, height: LADO + ANCHO_BORDE * 2 },
    scene
  );
  borde.position = new Vector3(x, 0.004, Z_ZONA);
  borde.material = matBorde;
  borde.isPickable = false;
  borde.receiveShadows = true;

  // Panio interior. Es el mesh que se devuelve porque es el que representa la
  // zona a efectos del juego.
  const matRelleno = new PBRMaterial(`matZona_${tipo}`, scene);
  matRelleno.albedoColor = color.scale(0.72);
  matRelleno.emissiveColor = color.scale(0.16);
  matRelleno.roughness = 0.75;
  matRelleno.metallic = 0;

  const mesh = MeshBuilder.CreateGround(`zona_${tipo}`, { width: LADO, height: LADO }, scene);
  mesh.position = new Vector3(x, 0.008, Z_ZONA);
  mesh.material = matRelleno;
  mesh.isPickable = false;
  mesh.receiveShadows = true;

  // Cartel vertical con la etiqueta: sin esto el nombre de la zona solo existe
  // como texto 2D flotando, y desde angulos bajos de camara no se entiende a
  // que rectangulo pertenece.
  const matPoste = new StandardMaterial(`matZonaPoste_${tipo}`, scene);
  matPoste.diffuseColor = new Color3(0.32, 0.33, 0.35);
  matPoste.specularColor = new Color3(0.1, 0.1, 0.1);

  const poste = MeshBuilder.CreateCylinder(`zonaPoste_${tipo}`, { diameter: 0.05, height: 1.05 }, scene);
  poste.position = new Vector3(x, 0.525, Z_ZONA + LADO / 2 + 0.16);
  poste.material = matPoste;
  poste.isPickable = false;

  // El nombre de la zona va pintado sobre el propio cartel, no como texto 2D
  // encima de la pantalla. Antes las tres etiquetas se amontonaban en el
  // centro al alejar la cámara y no se sabía cuál correspondía a cuál.
  if (etiqueta) {
    crearRotulo3D(
      scene,
      `zona_${tipo}`,
      etiqueta,
      new Vector3(x, 1.16, Z_ZONA + LADO / 2 + 0.16),
      {
        ancho: 1.15,
        alto: 0.3,
        colorFondo: colorHex(color.scale(0.55)),
        colorBorde: colorHex(color.scale(1.25)),
        mirarCamara: true,
      }
    );
  }

  return { mesh, tipo };
}

/** Color3 (0-1) a formato CSS, para pintar en el canvas del rótulo. */
function colorHex(color: Color3): string {
  const canal = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${canal(color.r)}, ${canal(color.g)}, ${canal(color.b)})`;
}