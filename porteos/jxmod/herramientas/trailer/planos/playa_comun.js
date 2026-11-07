// lo común de la playa (P8 y P9): el mar a 9,5 m, la costa oeste, atardecer cálido sobre el mar (al este)
(() => {
  const C = CINE;
  C.playa = { dir: v3(1, 0.155, 0.22).norm(), solCol: [1.0, 0.68, 0.48], ambS: [0.36, 0.30, 0.46], ambG: [0.36, 0.26, 0.22],
    top: [0.13, 0.11, 0.36], mid: [0.98, 0.62, 0.54], bot: [0.60, 0.44, 0.46], sol: [1.0, 0.62, 0.38], niebla: [0.96, 0.64, 0.56] };
  // dónde está la orilla en z = -214: el primer punto (de oeste a este) con el terreno 0,35 m arriba del agua
  const Z = -214; let X = -560;
  for (let x = -575; x < -470; x += 0.25) { const y = pisoBajo(v3(x, 0, Z), 300); if (y !== null && y < 9.5 + 0.35) { X = x; break; } }
  C.orilla = v3(X, pisoBajo(v3(X, 0, Z), 300), Z);
  C.marPreparar({ nivel: 9.5, area: [-620, -400, 300, 380], paso: 1, haciaOrilla: [-1, 0.05], altoOlas: 1.0, mojado: 0.45, nieA: 280, nieB: 2600, nieC: null });
  return 'playa: orilla en ' + C.orilla.x.toFixed(2) + ', ' + C.orilla.y.toFixed(2);
})();
