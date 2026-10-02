// ---------------------------------------------------------------------------
// Íconos del portal
// ---------------------------------------------------------------------------
//
// Dibujados acá, todos en la misma grilla de 24 y con el mismo trazo, en vez
// de caracteres como ✓ o ⚠: un carácter cambia de forma y de grosor según la
// fuente y el sistema, y al lado de un trazo dibujado se nota prestado.
//
// Siempre van con aria-hidden: el texto del botón o la etiqueta que acompaña
// al ícono es lo que se anuncia.

const TRAZOS = {
  resumen:
    '<rect x="3.5" y="3.5" width="7" height="8.5" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15" width="7" height="5.5" rx="1.5"/>',
  personas:
    '<path d="M15.5 20.5v-1.25a3.75 3.75 0 0 0-3.75-3.75h-5.5a3.75 3.75 0 0 0-3.75 3.75v1.25"/><circle cx="9" cy="8" r="3.5"/><path d="M21.5 20.5v-1.25a3.75 3.75 0 0 0-2.75-3.6"/><path d="M15.75 4.65a3.5 3.5 0 0 1 0 6.7"/>',
  codigos:
    '<path d="M3.5 8.75V6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2.25a3.25 3.25 0 0 0 0 6.5v2.25a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2.25a3.25 3.25 0 0 0 0-6.5Z"/><path d="M14 4.5v2.25"/><path d="M14 17.25v2.25"/><path d="M14 10.5v3"/>',
  cursos: '<path d="m12 3.5 8.5 4.25L12 12 3.5 7.75 12 3.5Z"/><path d="m3.5 12 8.5 4.25L20.5 12"/><path d="m3.5 16.25 8.5 4.25 8.5-4.25"/>',
  reportes:
    '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5Z"/><path d="M14 3.5v5h5"/><path d="M9 17.5v-3"/><path d="M12 17.5v-5.5"/><path d="M15 17.5v-2"/>',
  seguridad: '<path d="M12 20.75s7-3.25 7-9.25v-5.5L12 3.25 5 6v5.5c0 6 7 9.25 7 9.25Z"/><path d="m9.25 12 2 2 3.75-3.75"/>',
  salir: '<path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4"/><path d="m15.5 16.5 4.5-4.5-4.5-4.5"/><path d="M20 12H9.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.75v2M12 19.25v2M4.75 4.75l1.4 1.4M17.85 17.85l1.4 1.4M2.75 12h2M19.25 12h2M4.75 19.25l1.4-1.4M17.85 6.15l1.4-1.4"/>',
  luna: '<path d="M20.25 14.25A8.25 8.25 0 1 1 9.75 3.75a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  recargar:
    '<path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5"/><path d="M3.5 20.5v-5h5"/><path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9l2.4 2.4"/><path d="M20.5 3.5v5h-5"/>',
  buscar: '<circle cx="11" cy="11" r="6.75"/><path d="m20.25 20.25-4.5-4.5"/>',
  copiar: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  derecha: '<path d="m9.5 18 6-6-6-6"/>',
  izquierda: '<path d="m14.5 18-6-6 6-6"/>',
  abajo: '<path d="m6 9.5 6 6 6-6"/>',
  alerta: '<path d="M10.3 4.2 2.9 17.1a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 16.75h.01"/>',
  info: '<circle cx="12" cy="12" r="8.75"/><path d="M12 16v-4.5"/><path d="M12 8h.01"/>',
  ok: '<circle cx="12" cy="12" r="8.75"/><path d="m8.5 12.25 2.4 2.4 4.6-5"/>',
  error: '<circle cx="12" cy="12" r="8.75"/><path d="m15 9-6 6M9 9l6 6"/>',
  reloj: '<circle cx="12" cy="12" r="8.75"/><path d="M12 7.25V12l3 2"/>',
  descarga: '<path d="M12 3.5v11.5"/><path d="m7.25 10.25 4.75 4.75 4.75-4.75"/><path d="M4.5 20.5h15"/>',
  certificado: '<circle cx="12" cy="9" r="5.75"/><path d="m8.6 13.9-1.35 6.6L12 17.75l4.75 2.75-1.35-6.6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  llave: '<circle cx="8" cy="15.5" r="4"/><path d="m10.85 12.65 8.4-8.4"/><path d="m16.25 7.25 2.75 2.75"/><path d="m13.75 9.75 2 2"/>',
  pausa: '<circle cx="12" cy="12" r="8.75"/><path d="M10 9.25v5.5M14 9.25v5.5"/>',
  basurero: '<path d="M4 6.75h16"/><path d="M10 11v6M14 11v6"/><path d="m5.75 6.75.85 12a2 2 0 0 0 2 1.75h6.8a2 2 0 0 0 2-1.75l.85-12"/><path d="M9 6.75v-3h6v3"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5v-.75a5.75 5.75 0 0 1 5.75-5.75h3.5a5.75 5.75 0 0 1 5.75 5.75v.75"/>',
  admin: '<path d="M12 20.75s7-3.25 7-9.25v-5.5L12 3.25 5 6v5.5c0 6 7 9.25 7 9.25Z"/><circle cx="12" cy="10" r="2.25"/><path d="M8.75 16a3.5 3.5 0 0 1 6.5 0"/>',
  baja: '<circle cx="12" cy="12" r="8.75"/><path d="M8 12h8"/>',
  reactivar: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5v5h5"/>',
  tabla: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  grafico: '<path d="M3.5 20.5h17"/><path d="M6.5 16.5v-5"/><path d="M11 16.5v-10"/><path d="M15.5 16.5v-7.5"/>',
  flecha: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function icono(nombre: NombreIcono, clase = "icono"): string {
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${TRAZOS[nombre]}</svg>`;
}
