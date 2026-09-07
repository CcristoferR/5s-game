// ---------------------------------------------------------------------------
// Manejadores de eventos asíncronos
// ---------------------------------------------------------------------------
//
// `addEventListener` espera una función que no devuelve nada. Pasarle una
// `async` compila sin protestar, funciona en el caso feliz, y esconde un fallo
// que solo aparece cuando algo sale mal:
//
//     boton.addEventListener("click", async () => {
//       await guardarEnLaBase();   // si esto falla...
//       cerrarPanel();
//     });
//
// El navegador no espera esa promesa ni la vigila. Si `guardarEnLaBase` lanza,
// la promesa se rechaza y nadie la atrapa: no hay error en consola visible, no
// se ejecuta `cerrarPanel`, y para la persona el botón simplemente no hizo
// nada. En un portal donde los clics escriben en la base de datos —dar de alta,
// suspender, canjear un código— eso significa operaciones que fallan en
// silencio.
//
// `manejar` envuelve el manejador para que el fallo tenga dónde caer. No cambia
// el comportamiento del caso feliz: la única diferencia es que el error deja de
// perderse.
//
//     boton.addEventListener("click", manejar(async () => { ... }));

/**
 * Envuelve un manejador asíncrono para que sus errores no se pierdan.
 *
 * @param etiqueta Aparece en el mensaje de consola. Sirve para saber de qué
 *                 pantalla salió sin tener que rastrear la pila.
 */
export function manejar<E extends Event>(
  etiqueta: string,
  fn: (evento: E) => Promise<void>
): (evento: E) => void {
  return (evento: E) => {
    void fn(evento).catch((error: unknown) => {
      console.error(`[${etiqueta}]`, error);
    });
  };
}