(() => {
  // un personaje haciendo de todo; en cada cuadro se mide qué tan lejos queda el pie más bajo del piso
  const P = crearPersona('Soldier', 'HatEmpty', {}); const suelo = (x, z) => { const h = mundoRayo(v3(x, 50, z), v3(0, -1, 0), 200); return h ? 50 - h.t : 0; };
  const y0 = suelo(0, 5); P.pos.set(0, y0 + 1, 5); P.yaw = 0; P.suelo = true;
  const med = (nombre, seg, f) => {
    let mx = 0, mn = 0, suma = 0, n = 0;
    for (let i = 0; i < seg * 60; i++) {
      TIEMPO.dt = 1 / 60; f && f(i / 60); animarPersona(P, 1 / 60); ubicarPersona(P); if (!P.sentado && !P.emote) aterrizarPies(P); P.md.actualizar();
      if (!P.suelo) continue;
      const h = P.D.h, py = Math.min(P.md.W[h.LeftFoot][13], P.md.W[h.RightFoot][13]) - (P.pos.y - 1) - P.D.tobillo;
      mx = Math.max(mx, py); mn = Math.min(mn, py); suma += Math.abs(py); n++;
    }
    return { [nombre]: { flotaMax_cm: +(mx * 100).toFixed(1), hundeMax_cm: +(-mn * 100).toFixed(1), prom_cm: +(suma / Math.max(1, n) * 100).toFixed(1) } };
  };
  const R0 = {};
  Object.assign(R0, med('quieto', 2));
  Object.assign(R0, med('corriendo', 3, () => { P.vel.set(0, 0, 5.5); }));
  Object.assign(R0, med('costado', 2, () => { P.vel.set(4, 0, 0); }));
  P.vel.set(0, 0, 0);
  Object.assign(R0, med('agachado', 2, () => { P.agachado = true; }));
  Object.assign(R0, med('agachadoCaminando', 2, () => { P.agachado = true; P.vel.set(0, 0, 2.5); }));
  P.agachado = false; P.vel.set(0, 0, 0);
  // salto: 0,8 s en el aire y después aterriza
  Object.assign(R0, med('salto+aterrizaje', 2, (t) => { P.suelo = !(t > 0.2 && t < 1.0); P.vel.y = t < 0.6 ? 3 : -3; }));
  P.vel.set(0, 0, 0); P.suelo = true;
  for (const a of ['Pistol', 'Akm', 'RPG', 'Bat']) { P.arma = a; Object.assign(R0, med('arma_' + a, 1)); }
  return JSON.stringify(R0);
})()
