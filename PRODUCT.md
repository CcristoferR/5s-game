# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Trabajadores de empresas cliente** (operarios de planta, guardias de seguridad). Entran con su RUT, canjean un código de curso y practican situaciones reales en escenarios 3D desde el navegador, muchas veces en un computador compartido de planta. Su tarea: completar las fases o escenarios del curso, aprobar y obtener su certificado.
- **Administración: solo Bitplay** (confirmado el 02/10/2026). Un mismo panel administra a todas las empresas cliente: emite códigos de inscripción, ve quién se inscribió, quién avanza, quién terminó y quién quedó atrás, restablece contraseñas, suspende cuentas, descarga reportes en Excel y verifica certificados. Las empresas cliente no entran al panel por ahora.
- **Verificadores externos** (auditores, RR. HH. de otra empresa): comprueban un certificado con su código, sin cuenta.

## Product Purpose

ClassPlay (de Bitplay) es capacitación práctica en 3D para empresas: el equipo practica situaciones reales sin riesgo y la administración ve quién aprendió. Hoy tiene dos cursos: "Operación 5S" (5 fases en un taller) y "Formación y Perfeccionamiento para Guardias de Seguridad" (3 escenarios: condominio, supermercado, banco; basado en el manual de apoyo OS10). El éxito es que cada persona termine su curso con un certificado verificable y que Bitplay pueda mostrarle a cada empresa cliente su avance con datos claros.

## Positioning

Aprender haciendo en escenarios 3D de navegador, con decisiones que tienen consecuencias, más un portal que convierte cada intento en datos de avance, ranking y un certificado con código verificable en línea.

## Operating Context

- Landing pública en classplay.cl (hecha por Bitplay); la plataforma vive en classplay.cl/ingreso/.
- Acceso con RUT o número de ficha y contraseña; el código de cada curso se canjea dentro del catálogo.
- Computadores compartidos de planta y pantallas que se miran de lejos: existen preferencias de tema claro/oscuro, tamaño de texto y silencio guardadas por equipo.
- Escala esperada: 50 a 300 personas por empresa cliente, varias empresas en la misma base.
- Reportes en Excel para archivar o enviar a gerencia; certificados verificables con el código impreso.

## Capabilities and Constraints

- Backend Supabase con RLS: un trabajador solo lee sus propias filas; el administrador lee perfiles, inscripciones, progreso, certificados, códigos y la bitácora. Los resultados por fase (`resultados_fase`) solo los lee su dueño; para el panel se agrega una función solo para administradores (él corre el SQL en Supabase).
- El servidor guarda el mejor intento por fase (puntaje y tiempo), no cada intento. Los intentos fallidos de Guardias solo quedan en el historial local del equipo.
- Cada curso define su número de fases en la base (`total_fases`); la fase 0 del 5S es un tutorial y no cuenta.
- Front-end en TypeScript sin framework: pantallas del portal en DOM con plantillas y una hoja `portal.css`; el juego en Babylon.js sobre un canvas.
- Interfaz en español de Chile.

## Brand Commitments

- Nombre: **ClassPlay** ("classplay." en la landing), de Bitplay. Marca de la landing: la "C" con el triángulo de reproducción (`inicio/img/favicon.svg`) y el nombre en minúsculas con el punto final en verde.
- El usuario pidió (02/10/2026) que la plataforma deje de mostrar "5S" como marca y use la de ClassPlay: la "C" de la landing y el nombre "classplay".
- El certificado de Guardias dice "basado en el manual de apoyo OS10" y no puede leerse como el curso oficial.

## Evidence on Hand

- Cursos y escenarios jugables reales; datos reales en Supabase (pocas personas de prueba hoy).
- Imágenes de la landing en `inicio/img/` (capturas del panel y de los cursos); el logo de la landing (`inicio/img/logo.svg`) todavía es un marcador "[LOGO]".
- No hay clientes, testimonios ni métricas de uso que se puedan citar: no inventarlos.

## Product Principles

1. El dato tiene que llevar a una acción: quién no ha empezado, quién quedó atrás, qué código se agotó.
2. Lo que se ve de una persona es verdad del servidor, no del navegador.
3. Cada curso, actual o futuro, recibe el mismo trato en el panel: nada escrito a mano para el 5S.
4. Pensado para planta: legible de lejos, tolerante a equipos compartidos y a conexiones débiles.

## Accessibility & Inclusion

- Tamaño de texto ajustable (normal, grande, mayor) y tema claro/oscuro en todo el portal.
- Respetar `prefers-reduced-motion`.
