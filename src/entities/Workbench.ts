import { Scene, MeshBuilder, PBRMaterial, Color3 } from "@babylonjs/core";
import { texturaVetaMadera, texturaMetalCepillado, texturaGrano } from "./TexturasSuperficie";

// Altura de la cara superior del tablero. Los niveles apoyan sus objetos aca:
// exportarla evita que cada uno tenga que repetir el numero a mano y que se
// desincronice si maniana cambia la altura del banco.
export const ALTURA_SUPERFICIE_BANCO = 0.945;

export interface OpcionesBanco {
  /** Prefijo de los nombres de malla y material. Debe ser unico dentro de la escena. */
  nombre?: string;
  ancho?: number;
  fondo?: number;
  /** Posicion en Z del centro del banco. */
  z?: number;
}

/**
 * Banco de trabajo de taller: tablero, canto, bastidor metalico, cuatro patas,
 * travesanios y estante inferior.
 *
 * Vive en su propio modulo porque lo comparten varios niveles. Antes cada nivel
 * creaba una unica caja flotando a media altura, sin patas: en la oficina
 * generada por codigo pasaba desapercibido, pero apoyado sobre el piso de
 * concreto del garaje se nota de inmediato que esta suspendido en el aire.
 */
export function crearBancoDeTrabajo(scene: Scene, opciones: OpcionesBanco = {}): void {
  const nombre = opciones.nombre ?? "escritorio";
  const ANCHO = opciones.ancho ?? 3.9;
  const FONDO = opciones.fondo ?? 1.5;
  const CENTRO_Z = opciones.z ?? -0.5;

  // El tablero mide 0.09 de alto y su cara superior queda en
  // ALTURA_SUPERFICIE_BANCO, asi que su centro va media altura mas abajo.
  const ALTO_TABLERO = ALTURA_SUPERFICIE_BANCO - 0.045;

  const matTablero = new PBRMaterial(`matTablero_${nombre}`, scene);
  // Veta real en vez de un marrón plano. Es la superficie más grande y más
  // mirada del juego: todos los objetos se apoyan encima, así que el jugador
  // la tiene delante todo el rato.
  matTablero.albedoTexture = texturaVetaMadera(scene);
  matTablero.albedoColor = new Color3(0.78, 0.72, 0.66);
  // El grano en la rugosidad hace que el reflejo recorra la madera en vez de
  // cubrirla por igual, que es lo que la delataba como plástico.
  matTablero.microSurfaceTexture = texturaGrano(scene, 0.1);
  matTablero.roughness = 0.62;
  matTablero.metallic = 0;

  const tablero = MeshBuilder.CreateBox(nombre, { width: ANCHO, height: 0.09, depth: FONDO }, scene);
  tablero.position.set(0, ALTO_TABLERO, CENTRO_Z);
  tablero.material = matTablero;
  tablero.receiveShadows = true;

  // Canto: remata el borde del tablero para que no termine en una arista viva.
  const matCanto = new PBRMaterial(`matCanto_${nombre}`, scene);
  matCanto.albedoColor = new Color3(0.3, 0.2, 0.12);
  matCanto.microSurfaceTexture = texturaGrano(scene, 0.08);
  matCanto.roughness = 0.5;

  const canto = MeshBuilder.CreateBox(`canto_${nombre}`, { width: ANCHO + 0.04, height: 0.035, depth: FONDO + 0.04 }, scene);
  canto.position.set(0, ALTO_TABLERO - 0.055, CENTRO_Z);
  canto.material = matCanto;
  canto.receiveShadows = true;

  const matMetal = new PBRMaterial(`matMetal_${nombre}`, scene);
  // Metal cepillado: el metal perfectamente liso casi no existe en la
  // realidad, y es lo que más delata una escena hecha con primitivas.
  matMetal.albedoTexture = texturaMetalCepillado(scene);
  matMetal.albedoColor = new Color3(0.42, 0.44, 0.47);
  matMetal.microSurfaceTexture = texturaGrano(scene, 0.14);
  matMetal.roughness = 0.38;
  matMetal.metallic = 0.75;

  const patas: [number, number][] = [
    [-ANCHO / 2 + 0.14, CENTRO_Z - FONDO / 2 + 0.14],
    [ANCHO / 2 - 0.14, CENTRO_Z - FONDO / 2 + 0.14],
    [-ANCHO / 2 + 0.14, CENTRO_Z + FONDO / 2 - 0.14],
    [ANCHO / 2 - 0.14, CENTRO_Z + FONDO / 2 - 0.14],
  ];

  patas.forEach(([px, pz], i) => {
    const pata = MeshBuilder.CreateBox(`pata_${nombre}_${i}`, { width: 0.08, height: ALTO_TABLERO - 0.07, depth: 0.08 }, scene);
    pata.position.set(px, (ALTO_TABLERO - 0.07) / 2, pz);
    pata.material = matMetal;
    pata.receiveShadows = true;
  });

  // Travesanios laterales: sin ellos las patas parecen cuatro palos sueltos.
  [-1, 1].forEach((lado, i) => {
    const travesanio = MeshBuilder.CreateBox(`travesanio_${nombre}_${i}`, { width: 0.06, height: 0.06, depth: FONDO - 0.28 }, scene);
    travesanio.position.set(lado * (ANCHO / 2 - 0.14), 0.28, CENTRO_Z);
    travesanio.material = matMetal;
    travesanio.receiveShadows = true;
  });

  const estante = MeshBuilder.CreateBox(`estante_${nombre}`, { width: ANCHO - 0.34, height: 0.04, depth: FONDO - 0.34 }, scene);
  estante.position.set(0, 0.3, CENTRO_Z);
  estante.material = matCanto;
  estante.receiveShadows = true;
}