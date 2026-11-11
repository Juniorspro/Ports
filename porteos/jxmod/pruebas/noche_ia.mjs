// la IA recorriendo la pizzería: noche personalizada 20/20/20/20 defendida (puertas a tiempo, mirar Pirate Cove), con el
// tiempo simulado. Mientras caminan se mide en cada paso que no floten ni se hundan (pies contra el piso de abajo) y que
// no se metan en las paredes ni en los muebles (rayos a los costados a la altura de la cadera y del pecho); salas que
// recorre cada uno, y fotos de algunos caminando (desde atrás, a la altura de los ojos).
// uso: node noche_ia.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
let ok = 0, mal = 0; const chk = (c, t) => { console.log((c ? 'OK  ' : 'MAL ') + t); c ? ok++ : mal++; };
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria'); 1`);
for (let i = 0; i < 120 && !(await ev(`JUEGO.estado === 'juego' && typeof NOC !== 'undefined' && NOC.on`)); i++) await p.waitForTimeout(500);
await p.waitForTimeout(2000);
await ev(`UI.abierto = null; NOC.ui.menu.classList.add('oc'); nocheEmpezarNoche(7, [20, 20, 20, 20]);
  window.__M = { n: 0, piso: [], pared: [], salas: {}, peor: [] };
  window.__medir = () => {
    for (const A of NOC.anim) {
      (__M.salas[A.k] = __M.salas[A.k] || new Set()).add(A.sala);
      if (!A.ruta || A.estado === 'dentro') continue;
      const h = mundoRayo(vadd(A.pos, v3(0, 1.2, 0)), v3(0, -1, 0), 3); if (h) __M.piso.push(+(A.pos.y - (A.pos.y + 1.2 - h.t)).toFixed(3));
      let mn = 9; for (const y of [0.9, 1.6]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = mundoRayo(vadd(A.pos, v3(0, y, 0)), v3(Math.sin(a), 0, Math.cos(a)), 1); if (r) mn = Math.min(mn, r.t); }
      __M.pared.push(+mn.toFixed(3)); if (mn < 0.12) __M.peor.push([A.k, A.sala, A.destino, +A.pos.x.toFixed(2), +A.pos.z.toFixed(2), +mn.toFixed(2)]);
    }
  };
  window.__sim = (seg, dt) => { const n = Math.round(seg / dt); for (let i = 0; i < n; i++) { TIEMPO.t += dt;
    if (NOC.estado === 'juega') {
      for (const lado of ['izq', 'der']) { const cam = (TIEMPO.t % 8) < 1.2, hay = NOC.anim.some((A) => (A.estado === 'esquina' && (A.k !== 'F' || cam) || (A.k === 'X' && A.estado === 'corre')) && NOC_PUERTA[A.k] === lado); if (hay !== NOC.puerta[lado]) nocheBoton('puerta', lado); }
      const c = (TIEMPO.t % 8) < 1; if (c && NOC.cam === null) { UI.abierto = null; nocheTablet(); nocheCamElegir(2); } else if (!c && NOC.cam !== null) nocheTablet();
      NOC.poder = 100;   // (sin apagón: es para ver caminar)
    }
    nochePaso(dt); __medir(); if (window.__alParar && window.__alParar()) break; } return NOC.estado; }; 1`);
await ev(`__sim(5, 0.05)`);
// fotos: cada tanto, el primero que esté caminando, visto desde atrás
let fotos = 0;
for (let t = 0; t < 40 && fotos < 8; t++) {
  await ev(`window.__ya = window.__ya || new Set(); const nuevo = (A) => A.ruta && A.ri > 0 && A.ri < A.ruta.length - 1 && A.estado !== 'dentro' && !__ya.has(A.k + A.sala + A.destino); window.__alParar = () => NOC.anim.some(nuevo); __sim(60, 0.05)`);
  const q = await J(`(() => { NOC.quieta = true; const A = NOC.anim.find((A) => A.ruta && A.ri > 0 && A.ri < A.ruta.length - 1 && A.estado !== 'dentro' && !__ya.has(A.k + A.sala + A.destino)); if (!A) return null; __ya.add(A.k + A.sala + A.destino); const f = v3(Math.sin(A.yaw), 0, Math.cos(A.yaw)), o = vadd(A.pos, v3(0, 1.65, 0)), h = mundoRayo(o, vscale(f, -1), 3.2), d = h ? Math.max(1.2, h.t - 0.3) : 3.2;
    JUG.noclip = true; JUG.pos.set(o.x - f.x * d, A.pos.y + 0.75, o.z - f.z * d); JUG.vel.set(0, 0, 0); JUG.yaw = A.yaw; JUG.pitch = 0.18; NOC.linterna = true; return [A.nom, A.sala, A.destino, A.estado]; })()`);
  if (!q) continue;
  await ev(`if (NOC.cam !== null) nocheTablet(); UI.abierto = null; 1`);
  const m0 = await ev(`R.marca`); for (let i = 0; i < 40 && (await ev(`R.marca`)) < m0 + 4; i++) await p.waitForTimeout(200);
  await p.screenshot({ path: S + `ia_${fotos}_${q[0]}_${q[1]}_${q[2]}.png` }); fotos++;
  // (de vuelta a la oficina: afuera, delante de uno, te agarra)
  await ev(`const O = DATA.fn.oficina; JUG.noclip = false; JUG.pos.set(O.c[0], O.c[1] + 1.0, O.c[2]); JUG.vel.set(0, 0, 0); JUG.yaw = O.yaw; NOC.linterna = false; NOC.quieta = false; __sim(4, 0.05)`);
}
// y la noche entera hasta las 6 (la tapa "5 AM → 6 AM")
await ev(`window.__alParar = () => NOC.estado === 'gano' || NOC.estado === 'perdio'; __sim(89 * 6.5, 0.05)`);
await ev(`const O = DATA.fn.oficina; JUG.noclip = false; JUG.pos.set(O.c[0], O.c[1] + 1.0, O.c[2]); JUG.yaw = O.yaw; 1`);
await p.waitForTimeout(3500); await p.screenshot({ path: S + 'ia_6am.png' });
const M = await J(`{ piso: __M.piso, pared: __M.pared, salas: Object.fromEntries(Object.entries(__M.salas).map(([k, v]) => [k, [...v]])), peor: __M.peor.slice(0, 12), hora: NOC.hora, estado: NOC.estado }`);
const ord = (a) => a.slice().sort((x, y) => x - y), pc = (a, q) => ord(a)[Math.floor((a.length - 1) * q)];
const fl = M.piso.map(Math.abs);
console.log('pasos caminando', M.piso.length, '| piso: máx', Math.max(...fl).toFixed(3), 'm, p99', pc(fl, 0.99).toFixed(3), '| pared más cerca: mín', Math.min(...M.pared).toFixed(2), 'm, p1', pc(M.pared, 0.01).toFixed(2));
console.log('salas', JSON.stringify(M.salas), '| hora', M.hora.toFixed(2), M.estado);
if (M.peor.length) console.log('cerca de la pared:', JSON.stringify(M.peor));
chk(M.estado === 'gano' && M.hora >= 6, 'la noche entera defendida: llegan las 6 AM (' + M.estado + ', ' + M.hora.toFixed(2) + ')');
chk(M.piso.length > 500, 'caminaron (' + M.piso.length + ' pasos medidos)');
chk(pc(fl, 0.99) < 0.06 && Math.max(...fl) < 0.45, 'ni flotan ni se hunden (99 % a menos de 6 cm del piso; el máximo, en el escalón del escenario)');
chk(pc(M.pared, 0.01) >= 0.15, 'no se meten en las paredes ni en los muebles (99 % a 15 cm o más)');
chk(M.salas.B.length >= 5 && M.salas.C.length >= 5 && M.salas.F.length >= 3, 'recorren las salas: ' + ['F', 'B', 'C', 'X'].map((k) => k + ' ' + M.salas[k].join('/')).join(' · '));
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
console.log('resultado:', ok, 'bien,', mal, 'mal');
await b.close();
