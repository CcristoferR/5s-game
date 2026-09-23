# De dónde salió cada sonido

Los efectos del turno de guardia del supermercado vienen de los packs de
**Kenney** (www.kenney.nl), con licencia **Creative Commons Zero (CC0)**:
se pueden usar en proyectos personales, educativos y comerciales, sin pedir
permiso y sin obligación de dar créditos. Se da igual, que corresponde.

| Archivo del juego | Origen | Pack |
|---|---|---|
| `radio.wav` | `twoTone1`, filtrado como radio (ver abajo) | Digital Audio |
| `radio-vencido.wav` | `lowDown` | Digital Audio |
| `pregunta.wav` | `question_002` | Interface Sounds |
| `cerrar.wav` | `close_002` | Interface Sounds |
| `marca.wav` | `toggle_001` | Interface Sounds |
| `mirada.wav` | `pluck_001` | Interface Sounds |

Packs: <https://kenney.nl/assets/digital-audio> y
<https://kenney.nl/assets/interface-sounds>. Licencia:
<http://creativecommons.org/publicdomain/zero/1.0/>

## El ambiente de la sala

| Archivo del juego | Origen | Autor | Licencia |
|---|---|---|---|
| `ambiente-supermercado.mp3` | [freesound.org/people/Soundkrampf/sounds/237331](https://freesound.org/people/Soundkrampf/sounds/237331/) | Soundkrampf | CC0 |

Ambiente general de supermercado, 1:08, estéreo 48 kHz. Es la vista previa en
MP3 de Freesound, que basta de sobra para un fondo que suena a 0,16 de
volumen; el WAV original se baja desde esa misma página con una cuenta gratis.

No se le tocó nada al archivo. **El empalme del bucle se hace al cargar, en el
navegador**: se mezclan los últimos cuatro segundos sobre los primeros cuatro
con un fundido cruzado de potencia constante, y el resultado se repite con la
Web Audio API, que no pierde ni una muestra entre vuelta y vuelta. Así el
turno entero suena sin un solo corte y lo que se descarga siguen siendo un
millón y medio de bytes, no los ocho millones que ocuparía el mismo minuto en
WAV. Está en `src/core/Sonido.ts`, en la sección del ambiente de sala.

## La radio, además, va filtrada

El `twoTone1` tal cual sonaba a bip de menú, no a handie. Se le pasó por la
banda de un altavoz de radio —nada bajo 420 Hz ni sobre 2,9 kHz, con un pico
en 1,6 kHz y saturación suave— y se le agregó el chasquido de estática al
abrir y al cerrar el canal. Hecho con Web Audio, el guion está en el
scratchpad de la sesión (radio-filtrada.mjs); el original sin tocar está en
Escritorio/audio-kenney.

## Qué se les hizo

Vienen en `.ogg` estéreo. Aquí están en **WAV mono de 44,1 kHz**, con el
volumen igualado por RMS —que es lo que el oído llama "igual de fuerte",
mejor que igualar el pico— y un fundido de 5 ms en cada punta para que no
chasqueen al cortar. Pesan entre 9 y 75 KB.

Van en WAV y no en MP3 como los efectos más viejos (`acierto.mp3`,
`boton.mp3`…) porque en este equipo no hay conversor a MP3 instalado, y WAV
suena en cualquier navegador sin perder nada. Si algún día molesta el peso,
se pasan a MP3 y solo hay que cambiar el nombre del archivo en
`src/core/Sonido.ts`.

Los efectos anteriores del juego (5S) no vienen de aquí y no se tocaron.
