const rows = [
  [1,"C1","C1 · Preparación local y medición","C1","","resumen"],
  [2,"H0","Inicio del proyecto","C1","PM","hito inicio",0,"",0],
  [3,"A01","Entrada legal, técnica y conexión de pagos","C1","Equipo técnico y Asesoría legal","tarea",15,"2",15000],
  [4,"A02","Definición y prueba de medición","C1","Equipo técnico y agencia","tarea",14,"2",900],
  [5,"A01/A02","Prueba integral y autorización de salida","C1","Equipo técnico, Asesoría legal y PM","tarea",1,"8,9,14,15,24,19",0],
  [6,"C2","C2 · Campaña digital y orgánico","C2","","resumen"],
  [7,"A03","Seis piezas: dos anuncios, tres tutoriales y un kit","C2","Agencia","tarea",10,"4",1800],
  [8,"A04.1","Configurar campaña básica","C2","Agencia","tarea",5,"7",600],
  [9,"A09.1","Preparar recomendación y distribución orgánica","C2","Agencia","tarea",4,"7",300],
  [10,"A04.2","Pauta básica permitida y control de inversión","C2","Agencia","tarea",90,"25",37500],
  [11,"A09.2","Probar tutoriales, comercios y recomendación","C2","Agencia","tarea",15,"25",300],
  [12,"A09.3","Priorizar y mejorar los contenidos orgánicos","C2","Agencia","tarea",75,"11",300],
  [13,"C3","C3 · Comercios y acompañamiento","C3","","resumen"],
  [14,"A05.1","Habilitar los primeros 20 comercios","C3","Agencia","tarea",14,"3",900],
  [15,"A06.1","Guía digital de uso y ayuda","C3","Agencia y equipo operativo","tarea",7,"3",300],
  [16,"A05.2","Ampliar la red hasta 50 comercios","C3","Agencia","tarea",30,"25",600],
  [17,"A06.2","Acompañar usuarios y comercios","C3","Agencia y equipo operativo","tarea",90,"25",600],
  [18,"C4","C4 · Influencers","C4","","resumen"],
  [19,"A07.1","Contratar cuatro influencers","C4","Agencia","tarea",10,"3",600],
  [20,"A07.2","Cuatro contenidos de diciembre","C4","Influencers y agencia","tarea",31,"25",4100],
  [21,"A07.3","Cuatro contenidos de enero","C4","Influencers y agencia","tarea",31,"20",4100],
  [22,"A07.4","Cuatro contenidos de febrero","C4","Influencers y agencia","tarea",28,"21",4100],
  [23,"C5","C5 · Evento y prensa","C5","","resumen"],
  [24,"A08.1","Preparar evento y material de prensa","C5","Agencia","tarea",14,"3",300],
  [25,"H1","Lanzamiento y evento de prensa (A08.2)","C5","PM y organización del evento","hito inicio",0,"5",8000],
  [26,"A08.3","Registrar cobertura de prensa","C5","Agencia","tarea",15,"25",300],
  [27,"A10","Gestión · Control y cierre","G","","resumen"],
  [28,"A10.1","Control quincenal 1","G","PM y agencia","tarea",1,"25+14",150],
  [29,"A10.2","Control quincenal 2","G","PM y agencia","tarea",1,"28+14",150],
  [30,"A10.3","Control quincenal 3","G","PM y agencia","tarea",1,"29+14",150],
  [31,"A10.4","Control quincenal 4","G","PM y agencia","tarea",1,"30+14",150],
  [32,"A10.5","Control quincenal 5","G","PM y agencia","tarea",1,"31+14",150],
  [33,"A10.6","Control quincenal 6","G","PM y agencia","tarea",1,"32+14",150],
  [34,"H2","Cierre y evaluación de los 90 días (A10)","G","PM","hito cierre",0,"10,12,16,17,22,26,33",0]
];
const changes = {
  "10": {
    "cost": 25500
  },
  "19": {
    "name": "Contratar ocho influencers (4 de educación financiera)",
    "dur": 14
  },
  "20": {
    "name": "Ocho contenidos de diciembre",
    "cost": 8100
  },
  "21": {
    "name": "Ocho contenidos de enero",
    "cost": 8100
  },
  "22": {
    "name": "Ocho contenidos de febrero",
    "cost": 8100
  }
};

export function makeBlink(variant = false) {
  const groups = new Map(rows.filter(row => row[5] === 'resumen').map(row => [row[3], String(row[0])]));
  return {
    name: 'Fintech Landing Blink',
    start: '2026-11-01',
    reserve: 3500,
    budget: 85000,
    scope: 'Adaptación legal y técnica local, conexión bancaria, medición, piezas de campaña, Meta y TikTok, comercios, acompañamiento, creadores, prensa y controles quincenales. Objetivo de 50.000 activados en los 90 días desde el lanzamiento.',
    exclusions: 'Billetera nueva, otros países, contratación permanente, pago por adhesión a comercios, bonos de referidos y campaña específica de microcréditos.',
    tasks: rows.map(([id, code, name, group, responsible, type, duration = 0, deps = '', cost = 0]) => {
      const change = variant ? changes[id] : undefined;
      const kind = type === 'resumen' ? 'group' : type === 'tarea' ? 'task' : 'milestone';
      const sourceCodes = code.match(/A\d{2}/g) ?? (code === 'H1' ? ['A08'] : code === 'H2' ? ['A10'] : []);
      return {
        id: String(id), code, name: change?.name ?? name, kind, group,
        parentId: kind === 'group' ? null : groups.get(group),
        responsible, duration: change?.dur ?? duration, cost: change?.cost ?? cost,
        sourceCodes,
        predecessors: deps.split(',').filter(Boolean).map(value => {
          const [predecessor, lag = '0'] = value.split('+');
          return { id: predecessor, lag: Number(lag) };
        }),
        ...(type === 'hito cierre' ? { atEnd: true } : {}),
      };
    }),
  };
}
