---
name: ClassPlay
description: Plataforma de capacitación práctica en 3D de Bitplay; portal, panel de administración y certificados.
colors:
  noche-fondo: "#0d0e10"
  noche-panel: "#14171b"
  noche-elevado: "#1b1f24"
  noche-hundido: "#101215"
  papel-fondo: "#f3f2ee"
  papel-panel: "#ffffff"
  papel-hundido: "#f7f6f3"
  tinta: "#131417"
  texto-sobre-noche: "#f5f4f0"
  cuerpo-sobre-noche: "#c9cbc4"
  rotulo-sobre-noche: "#9a9d96"
  tenue-sobre-noche: "#878a83"
  cuerpo-sobre-papel: "#33352f"
  rotulo-sobre-papel: "#5e6059"
  tenue-sobre-papel: "#6f716b"
  lima-classplay: "#b8ed72"
  lima-encendida: "#cbf590"
  tinta-lima: "#131a0d"
  verde-campo: "#43661d"
  rampa-reposo-noche: "#565c52"
  rampa-avance-noche: "#86b04e"
  rampa-reposo-papel: "#a9b0a2"
  rampa-avance-papel: "#7aa443"
  referencia-noche: "#8e918a"
  acierto-noche: "#9bd08a"
  aviso-noche: "#e8b061"
  error-noche: "#f0a493"
  dato-noche: "#8db4cc"
  acierto-papel: "#3f7a22"
  aviso-papel: "#94600b"
  error-papel: "#b23a2b"
  dato-papel: "#2c5f7d"
typography:
  marca:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.05em"
  display:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  cifra:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  codigo:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "13.5px"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  pip: "2px"
  dato: "4px"
  control: "8px"
  ficha: "10px"
  plancha: "12px"
  pastilla: "999px"
spacing:
  hueco-fino: "2px"
  apretado: "6px"
  control: "12px"
  bloque: "20px"
  plancha: "24px"
  lienzo: "40px"
components:
  button-primary:
    backgroundColor: "{colors.lima-classplay}"
    textColor: "{colors.tinta-lima}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.lima-encendida}"
    textColor: "{colors.tinta-lima}"
  button-primary-papel:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.texto-sobre-noche}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-secondary:
    backgroundColor: "{colors.noche-panel}"
    textColor: "{colors.texto-sobre-noche}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  input-field:
    backgroundColor: "{colors.noche-hundido}"
    textColor: "{colors.texto-sobre-noche}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  filter-chip-active:
    backgroundColor: "{colors.texto-sobre-noche}"
    textColor: "{colors.noche-fondo}"
    rounded: "{rounded.pastilla}"
    padding: "6px 12px"
  plancha:
    backgroundColor: "{colors.noche-panel}"
    rounded: "{rounded.plancha}"
    padding: "22px 24px"
  nav-item-active:
    backgroundColor: "{colors.noche-elevado}"
    textColor: "{colors.texto-sobre-noche}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
---

# Design System: ClassPlay

## Overview

**Creative North Star: "La consola nocturna"**

ClassPlay vive en la noche de su landing: un negro casi puro (#0D0E10) con paneles apenas más claros, líneas finas de un 7 a 10 % de blanco y un solo color que enciende la pantalla, el verde lima de la marca. El portal no decora: ordena. Cada pantalla es una consola de trabajo donde la información se agrupa en planchas separadas por líneas, no en tarjetas sueltas, y el lima aparece solo donde hay algo que hacer o algo que ya se logró.

El tono es de herramienta profesional que se mira de lejos en una planta: letra Geist con interletrado cerrado en los títulos, cifras grandes y proporcionales, y textos cortos en español de Chile que nombran la acción. El tema claro no invierte el oscuro: cambia a un papel cálido (#F3F2EE) con paneles blancos y pasa el lima, que sobre blanco no se ve, a un verde campo oscuro.

**Key Characteristics:**
- Un solo acento, lima, que además es el dato de "completado" en todos los gráficos.
- Planchas con divisiones de 1 px en vez de tarjetas flotantes.
- Cada cifra abre la lista que cuenta.
- Íconos dibujados con un mismo trazo (1,75 en grilla de 24), nunca caracteres.
- Dos temas con valores propios, validados por contraste.

## Colors

Noche y papel como superficies, lima como única voz, y una rampa del mismo verde para los estados de avance.

### Primary
- **Lima ClassPlay** (lima-classplay): botón principal sobre noche, foco, selección de texto, sección activa del riel, punto del nombre "classplay." y el estado "completado" en los gráficos.
- **Verde campo** (verde-campo): el mismo papel que el lima sobre el tema claro, donde el lima no tiene contraste; marcas, enlaces y dato "completado".
- **Tinta lima** (tinta-lima): texto sobre el lima; contraste 13:1.

### Neutral
- **Noche fondo** (noche-fondo): el suelo de toda pantalla oscura, igual que la landing.
- **Noche panel** (noche-panel): planchas, tarjetas de curso y la ficha de una persona.
- **Noche elevado / hundido** (noche-elevado, noche-hundido): lo que flota sobre un panel (ayudas, avisos) y lo que se hunde en él (campos de texto, fichas internas).
- **Papel fondo y panel** (papel-fondo, papel-panel): las mismas funciones en el tema claro.
- **Textos** (texto-sobre-noche, cuerpo-, rótulo-, tenue-): cuatro escalones que pasan 4,5:1 sobre su panel; el tenue se reserva para marcadores de posición y ejes.

### Rampa de avance
- **Reposo → avance → completado** (rampa-reposo, rampa-avance, lima-classplay en noche; rampa-reposo-papel, rampa-avance-papel, verde-campo en papel): "sin empezar", "en curso" y "completaron". Validada con el validador ordinal de dataviz en los dos temas.
- **Referencia** (referencia-noche): la línea de inscritos en la curva acumulada, el total contra el que se mide el avance.

### Estados
- **Acierto, aviso, error, dato** (acierto-, aviso-, error-, dato- en cada tema): solo para estados, siempre con ícono y palabra; nunca como color de una serie.

### Named Rules
**La regla de la única voz.** El lima es el único acento del portal. Si algo no es una acción principal, un foco o un logro, no lleva lima.

**La regla del dato que se enciende.** En los gráficos, más avance es más luz: el estado completado es el escalón más encendido de la rampa, nunca un color nuevo.

## Typography

**Display Font:** Geist (con system-ui y Segoe UI de respaldo), servida desde el propio proyecto.
**Body Font:** Geist.
**Label/Mono Font:** ui-monospace / Cascadia Mono / Consolas, solo para códigos de inscripción, de certificado y claves.

**Character:** Una sola familia, como en la landing: el peso y el interletrado hacen la jerarquía. Los títulos se cierran (−0,03 em) y el cuerpo respira.

### Hierarchy
- **Marca** (650, 21 px, −0,05 em): el nombre "classplay." junto a la C; es logo, no texto.
- **Display** (600, 26–30 px, 1,15): título de cada pantalla.
- **Cifra** (600, 34 px, 1,05, −0,035 em): las cifras de cabecera; proporcionales.
- **Title** (600, 16 px, 1,3): título de cada bloque o plancha.
- **Body** (400, 14–15 px, 1,5): tablas, ayudas y textos de la ficha.
- **Label** (500, 12,5–13 px): rótulos de campos, ejes, ayudas bajo un título.

### Named Rules
**La regla de las cifras tabulares solo en columnas.** Las tablas y los ejes usan cifras tabulares; una cifra suelta se deja proporcional.

## Layout

El panel es una consola de dos columnas: un riel de 252 px con la marca, las secciones y la sesión al pie, y un lienzo que desplaza solo. La cabecera del lienzo (título, línea de alcance y selectores de curso y empresa) queda fija arriba. El contenido se limita a 1.440 px y se ordena en filas de planchas: una banda de cuatro cifras, y luego pares de bloques (2/3 y 1/3, o mitades) separados por una línea de 1 px. Entre filas, 20 px.

Bajo 1.100 px los pares se apilan y la banda de cifras pasa a 2×2. Bajo 900 px el riel se vuelve barra superior con las secciones en una fila desplazable, y la tabla de personas pasa a lista bajo 600 px. El portal del trabajador mantiene sus tarjetas centradas (acceso, Mi cuenta) y la página con barra superior (catálogo, verificación).

## Elevation & Depth

Plano por defecto: la profundidad la dan los escalones de superficie (fondo, panel, elevado, hundido) y las líneas finas. Solo lo que flota sobre el contenido lleva sombra.

### Shadow Vocabulary
- **Flotante** (`0 12px 32px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3)` en noche; `0 14px 36px rgba(19,20,23,.16), 0 2px 6px rgba(19,20,23,.08)` en papel): ayudas emergentes, avisos y la ficha lateral.
- **Apoyo** (`0 1px 2px rgba(0,0,0,.4)` en noche; `0 1px 3px rgba(19,20,23,.08), 0 8px 24px rgba(19,20,23,.05)` en papel): la tarjeta del acceso y Mi cuenta sobre el fondo.

### Named Rules
**La regla de la plancha.** Los bloques que se leen juntos comparten una superficie y se separan con una línea de 1 px; no se anidan tarjetas dentro de tarjetas.

## Shapes

Esquinas suaves y constantes: 8 px en controles, 10 px en fichas internas, 12 px en planchas y tarjetas, píldora completa en filtros y estados. Las barras de datos van rectas en la base y con 4 px en el extremo del dato; las casillas de fase, 2 px. Bordes de 1 px siempre; nunca un borde lateral de color más grueso.

## Components

### Buttons
- **Shape:** esquinas de 8 px.
- **Primary:** lima con tinta lima sobre noche; tinta con texto claro sobre papel. 9 × 16 px de relleno, peso 600.
- **Hover / Focus:** el lima se enciende (lima-encendida); el foco es un contorno de 2 px del color de la marca, separado 2 px.
- **Secondary:** relleno de realce, borde fino y texto claro. **Acción** (dentro de tablas y fichas): más chica, con ícono; la de riesgo es roja solo en el borde y el texto.
- **Confirmación en dos pasos:** el primer clic convierte el botón en la pregunta (rojo suave); el segundo ejecuta; a los 6 s vuelve solo.

### Chips
- **Estado:** píldora con ícono y palabra, en el color de su estado sobre su versión suave.
- **Filtros:** píldoras con borde fino y la cuenta al lado; el activo se invierte (fondo del color del texto, texto del color del fondo).

### Cards / Containers
- **Corner Style:** 12 px.
- **Background:** noche-panel o papel-panel.
- **Shadow Strategy:** ninguna en reposo (ver Elevation & Depth).
- **Border:** 1 px al 10 % de blanco, o al 13 % de tinta en papel.
- **Internal Padding:** 22 × 24 px.

### Inputs / Fields
- **Style:** fondo hundido, borde fino, 8 px de radio, 9 × 12 px de relleno.
- **Focus:** borde en lima translúcido y un halo de 3 px del lima suave.
- **Selects:** dibujados por la hoja (sin la flecha del sistema), con su lista en los colores del tema.

### Navigation
- **Riel:** ítems con ícono de 19 px, texto 14,5 px peso 500 y cuenta a la derecha. El activo tiene fondo de realce y el ícono en lima. En celular, fila desplazable bajo la marca.

### Cifras de cabecera
Una banda partida en cuatro con líneas de 1 px; cada cifra es un botón que abre la lista que cuenta, con una flecha que aparece al pasar el mouse.

### Gráficos
Barras de 14 px (22 px en la barra de estados) con 2 px de separación entre tramos; curva acumulada con líneas de 2 px y el área de los completados al 13 % del lima. Cada marca muestra su detalle al pasar el mouse o al llegar con el teclado, y cada gráfico tiene su tabla equivalente.

## Do's and Don'ts

### Do:
- **Do** usar el lima solo para la acción principal, el foco, la sección activa y el dato "completado".
- **Do** validar cualquier color nuevo de gráfico con el validador de dataviz contra la superficie del tema (#14171B y #FFFFFF).
- **Do** acompañar todo color de estado con su ícono y su palabra.
- **Do** dar a cada cifra un destino: la lista filtrada que la explica.
- **Do** dibujar los íconos en la grilla de 24 con trazo de 1,75.

### Don't:
- **Don't** poner un rótulo en mayúsculas encima de un título.
- **Don't** usar caracteres (✓, !, ⚠) como íconos.
- **Don't** anidar tarjetas ni agregar bordes laterales de color más gruesos que 1 px.
- **Don't** usar el lima como texto o trazo sobre el tema claro; ahí va el verde campo.
- **Don't** volver a escribir "5S" como marca de la plataforma: la marca es ClassPlay; 5S es el nombre de un curso.
