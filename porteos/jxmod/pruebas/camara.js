(() => { const R0 = {}; const paso = 1 / 60; JUG.noclip = false; JUG.vivo = true; JUG.vehiculo = null;
  const suelo = (x, z) => { const h = mundoRayo(v3(x, 50, z), v3(0, -1, 0), 200); return h ? 50 - h.t : 0; };
  const y0 = suelo(0, 0); JUG.pos.set(0, y0 + 4, 0); JUG.vel.set(0, 0, 0);
  const ent0 = { x: 0, y: 0, saltar: false, agachar: false, correr: false };
  let minDy = 0, ojos = [];
  for (let i = 0; i < 120; i++) { TIEMPO.dt = paso; jugadorPaso(paso, ent0); jugadorCamara(CAM); if (JUG.suelo) { const d = CAM.pos.y - (JUG.pos.y + JUG.ojo); minDy = Math.min(minDy, d); } }
  R0.caida3m_hundida_cm = +(-minDy * 100).toFixed(1);
  // caminando: amplitud del balanceo
  let mn = 1e9, mx = -1e9; for (let i = 0; i < 180; i++) { TIEMPO.dt = paso; jugadorPaso(paso, { x: 0, y: 1, saltar: false, agachar: false, correr: false }); jugadorCamara(CAM); if (i > 60) { const d = CAM.pos.y - JUG.pos.y; mn = Math.min(mn, d); mx = Math.max(mx, d); } }
  R0.balanceo_cm = +((mx - mn) * 100).toFixed(1);
  // agacharse: cuánto tarda en bajar el 90 %
  let t90 = -1; const ojo0 = JUG.pos.y + JUG.ojo; for (let i = 0; i < 60; i++) { TIEMPO.dt = paso; jugadorPaso(paso, { x: 0, y: 0, saltar: false, agachar: true, correr: false }); jugadorCamara(CAM); if (t90 < 0 && (CAM.pos.y - JUG.pos.y) < JUG.ojo * (1 - 0.45 * 0.9)) t90 = i / 60; }
  R0.agacharse_s = t90;
  return JSON.stringify(R0); })()
