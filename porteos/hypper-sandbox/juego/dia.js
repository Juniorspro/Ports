// ---------------------------------------------------------------------------------------------------------
// hora del día (Anfitrión → Día del juego): el sol del mapa a mediodía y desde ahí sale, cruza y se pone;
// atardecer naranja, noche azul oscura con estrellas, luna (que también da sombra) y faros/lámparas.
// Con "ciclo" la hora avanza sola (un día cada 12 minutos). En la sala la manda el anfitrión.
// ---------------------------------------------------------------------------------------------------------
const DIA = { hora: 12, ciclo: false, vel: 2, base: null, aplicada: -1 };   // vel: horas de juego por minuto real
function diaGuardarBase() {
  DIA.base = { sol: R.sol.clone(), solCol: R.solCol.slice(), ambS: R.ambS.slice(), ambG: R.ambG.slice(),
    cielo: R.cielo ? { top: R.cielo.top.slice(), mid: R.cielo.mid.slice(), bot: R.cielo.bot.slice(), sol: R.cielo.sol.slice() } : null, niebla: Object.assign({}, R.niebla, { c: R.niebla.c.slice() }) };
  DIA.aplicada = -1; diaAplicar();
}
const _mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function diaPaso(dt) {
  if (DIA.ciclo) { DIA.hora = (DIA.hora + dt * DIA.vel / 60) % 24; }
  if (Math.abs(DIA.hora - DIA.aplicada) > 0.002) diaAplicar();
}
function diaAplicar() {
  const B = DIA.base; if (!B || !B.cielo) return;
  DIA.aplicada = DIA.hora;
  if (MUNDO.nombre === 'Space') { R.noche = 0; return; }
  const h = DIA.hora, el0 = Math.asin(clamp(B.sol.y, 0.2, 0.98)), az0 = Math.atan2(B.sol.x, B.sol.z);
  // elevación: el mapa a las 12; 0 a las 6 y 18; negativa de noche. Recorrido de este a oeste
  const el = el0 * Math.sin((h - 6) / 12 * Math.PI), az = az0 + (h - 12) / 12 * Math.PI * 0.85;
  const sol = v3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).norm();
  const s = sol.y;
  const dia = sstep(-0.1, 0.3, s), tarde = sstep(-0.16, 0.02, s) * (1 - sstep(0.06, 0.36, s)), noche = 1 - sstep(-0.22, 0.0, s);
  const C = R.cielo, N = { top: [0.012, 0.02, 0.06], mid: [0.05, 0.07, 0.13], bot: [0.03, 0.035, 0.05] };
  C.top = _mix3(_mix3(N.top, B.cielo.top, dia), [0.25, 0.32, 0.55], tarde * 0.35);
  C.mid = _mix3(_mix3(N.mid, B.cielo.mid, dia), [1.0, 0.56, 0.32], tarde * 0.75);
  C.bot = _mix3(_mix3(N.bot, B.cielo.bot, dia), [0.45, 0.32, 0.3], tarde * 0.5);
  C.sol = _mix3(B.cielo.sol, [1.0, 0.45, 0.18], tarde);
  // de día y al atardecer alumbra el sol; de noche, la luna (azulada y débil, del lado contrario)
  if (s > -0.08) { R.sol.copy(sol.y < 0.04 ? v3(sol.x, 0.04, sol.z).norm() : sol); R.solCol = _mix3(B.solCol, [1.0, 0.5, 0.22], tarde).map((x) => x * sstep(-0.08, 0.12, s)); }
  else { const l = v3(-sol.x, Math.max(0.35, -sol.y), -sol.z).norm(); R.sol.copy(l); R.solCol = [0.16, 0.2, 0.3].map((x) => x * noche); }
  R.luna = v3(-sol.x, Math.max(0.2, -sol.y), -sol.z).norm();
  const k = 0.2 + 0.8 * dia;
  R.ambS = _mix3(B.ambS.map((x) => x * k), [0.11, 0.13, 0.23], noche * 0.8);
  R.ambG = _mix3(B.ambG.map((x) => x * k), [0.05, 0.05, 0.07], noche * 0.8);
  R.ambS = _mix3(R.ambS, [0.75, 0.48, 0.38], tarde * 0.35);
  if (!(DATA.aj[MUNDO.nombre] && DATA.aj[MUNDO.nombre].fog && DATA.aj[MUNDO.nombre].fd > 0)) R.niebla.c = C.mid.slice();
  else R.niebla.c = _mix3(B.niebla.c, C.mid, 1 - dia * 0.7);
  R.noche = noche;
  // los ojos se acostumbran: de noche se ve un poco más (pero sigue oscuro)
  R.expoK = 1 + noche * 1.3 + tarde * 0.15;
  // las lámparas del mapa y de los props se prenden solas de noche
  R.lucesMapa = noche > 0.5;
}
// faros de los vehículos cuando está oscuro (y con el motor andando)
function vehiculoLuces(o) {
  const V = o.veh; if (!V || V.tipo === 'asiento' || V.roto || !(R.noche > 0.25 || R.expoK > 1.5)) return;
  if (V.motor < 0.05 && !V.conductor) return;
  const b = o.b, f = b.q.rot(v3(0, 0, 1)), a = o.b.aabb, largo = Math.max(a.x1 - a.x0, a.z1 - a.z0) * 0.5;
  const p = vadd(b.pos, vadd(vscale(f, largo * 0.95), v3(0, 0.2, 0)));
  luzPuntual(p, 38, [9, 8.4, 7], vadd(f, v3(0, -0.12, 0)).norm(), Math.cos(0.42));
}
