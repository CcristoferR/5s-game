import type { SucesoTurno } from "./LibroNovedades";

// ===========================================================================
// Sucesos del turno — Condominio, 00:00 a 08:00
// ===========================================================================
//
// Esto es SOLO contenido: la hora de cada suceso, lo que el guardia ve, y las
// tres formas de anotarlo (factual, opinión, inventada). Las reglas de qué
// pasa con cada una viven en LibroNovedades.ts; acá no hay lógica, solo lo
// que le toca vivir al guardia esa noche.
//
// Van seis. Tres antes de la fiscalización de las 03:20 y tres después, para
// que la visita del supervisor caiga a mitad de turno y no al final, que es
// donde no enseñaría nada: si apareciera después del último suceso, la
// revisión no podría cambiar cómo se escribe lo que queda.
//
// El desorden cronológico (para poner a prueba "fuera_de_orden") no está
// como suceso aparte: se prueba dejando que el jugador intente anotar algo
// con una hora anterior a la última, no fabricando un suceso para eso.

export const APERTURA = {
  instalacion: "Condominio Las Araucarias",
  ciudad: "Puerto Montt",
  fecha: "14 de septiembre de 2026",
  turno: "00:00 a 08:00 horas",
};

export const SUCESOS_CONDOMINIO: SucesoTurno[] = [
  {
    id: "vehiculo-tarde",
    minuto: 45,
    actividad: "CONTROL DE ACCESO",
    aviso:
      "Un vehículo no registrado en la nómina de residentes se detiene frente a la reja y hace " +
      "luces para que le abran.",
    opciones: [
      {
        texto:
          "23:45 hrs. Vehículo placa no identificada solicita acceso en reja principal. No figura en " +
          "nómina de residentes. Se contacta a conserjería del edificio B, quien autoriza el ingreso " +
          "como visita del depto. 302.",
        clase: "factual",
        explicacion: "Se registra lo que se hizo y quién autorizó. Es comprobable por cualquiera que lea el libro después.",
      },
      {
        texto: "Vehículo sospechoso intenta entrar sin autorización, parecía que buscaba algo que robar.",
        clase: "opinion",
        explicacion:
          "\"Parecía que buscaba algo que robar\" es lo que el guardia supuso, no lo que vio. El manual lo prohíbe: no se imponen apreciaciones personales.",
      },
      {
        texto: "Vehículo del depto. 302 llega de visita, como todas las noches de jueves.",
        clase: "inventada",
        explicacion:
          "Nada de lo que pasó esa noche dice que es un patrón semanal. Afirmar \"como todas las noches de jueves\" es agregar un hecho que no consta.",
      },
    ],
  },
  {
    id: "ronda-perimetro",
    minuto: 90,
    actividad: "RONDA",
    aviso: "Toca la ronda perimetral. Al pasar por el sector de estacionamientos, un foco no enciende.",
    opciones: [
      {
        texto:
          "01:30 hrs. Ronda perimetral sin novedad. Se detecta luminaria apagada en pasillo de " +
          "estacionamientos, sector C. Se informa a administración vía radio para su reparación.",
        clase: "factual",
        explicacion: "Describe lo hallado y la acción tomada, sin adornarlo. Es exactamente lo que el libro necesita registrar.",
      },
      {
        texto: "Ronda perimetral sin novedad. Iluminación deficiente, un peligro para la seguridad del condominio.",
        clase: "opinion",
        explicacion: "Un foco apagado es un hecho. Que sea \"un peligro para la seguridad\" es la evaluación del guardia, no algo que se observó.",
      },
      {
        texto: "Ronda perimetral sin novedad. Falla eléctrica en todo el sector C por corte de suministro.",
        clase: "inventada",
        explicacion: "Un foco apagado no prueba un corte de suministro en todo el sector. Es una causa inventada para un hecho menor.",
      },
    ],
  },
  {
    id: "reclamo-ruido",
    minuto: 150,
    actividad: "ATENCIÓN A RESIDENTE",
    aviso: "Una residente del depto. 105 baja a conserjería a reclamar por ruidos molestos del depto. 108.",
    opciones: [
      {
        texto:
          "02:30 hrs. Residente del depto. 105 reporta ruidos molestos provenientes del depto. 108. " +
          "Se sube a verificar: se constata música a volumen alto. Se solicita bajar el volumen y el " +
          "residente accede.",
        clase: "factual",
        explicacion: "Lo que se reportó, lo que se comprobó y cómo terminó. Tres hechos, en ese orden, sin agregar nada.",
      },
      {
        texto:
          "Residente del depto. 105 reporta ruidos molestos del depto. 108. Los vecinos de ese " +
          "departamento siempre generan problemas.",
        clase: "opinion",
        explicacion: "\"Siempre generan problemas\" es un juicio sobre las personas, no sobre lo que pasó esta noche.",
      },
      {
        texto:
          "Residente del depto. 105 reporta ruidos molestos del depto. 108, donde según vecinos se " +
          "estaría realizando una fiesta clandestina.",
        clase: "inventada",
        explicacion: "El guardia solo constató música alta. \"Fiesta clandestina\" y \"según vecinos\" no están respaldados por lo que se verificó.",
      },
    ],
  },
  {
    id: "puerta-emergencia",
    minuto: 260,
    actividad: "RONDA",
    aviso:
      "En la ronda de las 04:20, la puerta de emergencia de la torre A está entreabierta, con el " +
      "seguro forzado.",
    opciones: [
      {
        texto:
          "04:20 hrs. Ronda torre A. Se detecta puerta de emergencia entreabierta con seguro forzado. " +
          "Se cierra y se refuerza. Se informa a administración para revisión de la cerradura.",
        clase: "factual",
        explicacion: "El hallazgo, la acción inmediata y el aviso a quien corresponde. Nada más y nada menos que eso.",
      },
      {
        texto: "Ronda torre A. Puerta de emergencia forzada, obra de delincuentes que rondan el sector.",
        clase: "opinion",
        explicacion: "El seguro forzado es el hecho. Quién lo hizo y por qué es una conjetura que el guardia no puede sostener con lo que vio.",
      },
      {
        texto: "Ronda torre A. Se sorprende a un sujeto intentando forzar la puerta de emergencia, que huye al ser visto.",
        clase: "inventada",
        explicacion: "Nadie fue sorprendido ni vio huir a nadie: el guardia encontró la puerta ya forzada. Inventar el momento del hecho es lo que el manual prohíbe.",
      },
    ],
  },
  {
    id: "camion-mudanza",
    minuto: 340,
    actividad: "CONTROL DE ACCESO",
    aviso: "A las 05:40 llega un camión de mudanza pidiendo entrar para descargar en la torre B.",
    opciones: [
      {
        texto:
          "05:40 hrs. Camión de mudanza solicita acceso para torre B. Se verifica autorización previa " +
          "en libro de administración a nombre del depto. 604. Se autoriza el ingreso.",
        clase: "factual",
        explicacion: "Se verificó contra un registro antes de autorizar. Eso es lo que hace que la anotación sea comprobable, no solo una versión del guardia.",
      },
      {
        texto: "Camión de mudanza a las 05:40, un horario poco apropiado para hacer ese tipo de trabajo.",
        clase: "opinion",
        explicacion: "Que el horario sea \"poco apropiado\" es una opinión del guardia sobre la mudanza, no un hecho del servicio.",
      },
      {
        texto: "Camión de mudanza a las 05:40, autorizado telefónicamente por el administrador del condominio.",
        clase: "inventada",
        explicacion: "La autorización fue por libro de administración, no telefónica. Cambiar cómo se autorizó es afirmar algo que no ocurrió así.",
      },
    ],
  },
  {
    id: "corte-luz",
    minuto: 410,
    actividad: "INCIDENTE",
    aviso: "A las 06:50 se corta la luz en todo el condominio por unos minutos.",
    opciones: [
      {
        texto:
          "06:50 hrs. Corte de suministro eléctrico en todo el condominio, duración aproximada de 6 " +
          "minutos. Se activa iluminación de emergencia. Se restablece el servicio sin incidentes.",
        clase: "factual",
        explicacion: "Duración, respuesta y resultado. Es todo lo que hace falta para que quien lea el libro entienda qué pasó.",
      },
      {
        texto: "Corte de luz en todo el condominio, la compañía eléctrica de la zona tiene un pésimo servicio.",
        clase: "opinion",
        explicacion: "Calificar el servicio de la eléctrica es un juicio del guardia. El libro registra el corte, no una opinión sobre la empresa.",
      },
      {
        texto: "Corte de luz provocado por sobrecarga en el tablero del edificio C, según indica el eléctrico de turno.",
        clase: "inventada",
        explicacion: "Nadie confirmó la causa esa noche. Atribuirla a una sobrecarga y citar a \"el eléctrico de turno\" es inventar un dato que no consta.",
      },
    ],
  },
];

/** Minuto del turno en el que cae la fiscalización del manual (03:20). */
export const MINUTO_SUPERVISOR = 200;