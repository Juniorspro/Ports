// los 2338 emotes de captura de movimiento (CMU): catálogo en el HTML, panel con secciones, buscador, favoritos y
// recientes, se bajan a pedido (de al lado del HTML), las rotaciones que llegan son válidas y el cuerpo se mueve.
// Fotos de algunos (baile, patada, rueda, animal). Hay que abrirlo por http con la carpeta emotes/ al lado.
// uso: node emotes_cmu.mjs URL CARPETA
import { abrir } from './base.mjs';
const URL_ = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(URL_);
const fallidos = []; p.on('response', (r) => { if (r.status() >= 400) fallidos.push(r.status() + ' ' + r.url().split('/').pop()); });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
const cat = await ev(`({ n: CMU_CAT ? CMU_CAT.items.length : 0, cats: CMU_CAT ? [...new Set(CMU_CAT.items.map((x) => x[2]))] : [] })`);
ok('catálogo adentro del HTML (más de 2000)', cat.n > 2000, cat);
// el panel: secciones, cuenta, buscador, de a tandas
await ev(`abrirPanel ? abrirPanel('emotes') : null; 1`).catch(() => {});
const pan = await ev(`(() => { if (typeof abrirPanel === 'function') abrirPanel('emotes'); else { $('emotes').classList.remove('oc'); UI.abierto = 'emotes'; } emoDibujar();
  const tabs = [...document.querySelectorAll('#emotes .emoTabs button')].map((b) => b.dataset.emc), n = document.querySelectorAll('#emoLista .emoIt').length, cuenta = document.querySelector('#emotes .emoCuenta').textContent;
  return { tabs, n, cuenta }; })()`);
ok('panel con secciones (favoritos, recientes, peleas, deportes...) y de a tandas (≤ 120 tarjetas)', ['fav', 'rec', 'pelea', 'deporte', 'acrobacia', 'animal', 'caminar'].every((t) => pan.tabs.includes(t)) && pan.n <= 121 && pan.n > 50, pan);
const busca = await ev(`(() => { const q = document.querySelector('#emotes .emoBusca input'); q.value = 'cartwheel'; q.oninput(); const n = document.querySelectorAll('#emoLista .emoIt').length;
  const ids = [...document.querySelectorAll('#emoLista .emoIt')].slice(0, 3).map((e) => e.dataset.emo); q.value = ''; q.oninput(); return { n, ids }; })()`);
ok('el buscador encuentra "cartwheel"', busca.n > 0, busca);
const sec = await ev(`(() => { const r = {}; for (const c of ['pelea', 'baile', 'animal']) { EMO.cat = c; emoDibujar(); r[c] = document.querySelector('#emotes .emoCuenta').textContent; } EMO.cat = 'todos'; emoDibujar(); return r; })()`);
ok('cada sección filtra', Object.values(sec).every((t) => parseInt(t.replace(/\\D/g, '')) > 0), sec);
// favorito y reciente
const fav = await ev(`(() => { const est = document.querySelector('#emoLista .emoIt [data-emfav]'), id = est.dataset.emfav; est.click(); EMO.cat = 'fav'; emoDibujar(); const enFav = !!document.querySelector('#emoLista [data-emo="' + id + '"]');
  const guardado = JSON.parse(localStorage.getItem('rb_emo_fav') || '[]').includes(id); document.querySelector('#emoLista [data-emfav="' + id + '"]').click(); EMO.cat = 'todos'; emoDibujar(); return { id, enFav, guardado }; })()`);
ok('la estrella lo guarda en Favoritos (y en el navegador)', fav.enFav && fav.guardado, fav);
// bajar y hacer uno de cada categoría; las rotaciones decodificadas son cuaterniones (norma 1) y el cuerpo se mueve
await ev(`cerrarPaneles(); $('hud').classList.add('oc'); 1`);
const ids = await ev(`(() => { const r = []; for (const c of ['baile', 'pelea', 'acrobacia', 'animal', 'deporte', 'caminar']) { const x = CMU_CAT.items.find((y) => y[2] === c && y[3] > 3); if (x) r.push('c:' + x[0]); } return r; })()`);
const res = await ev(`(async () => { const out = {}; for (const id of ${JSON.stringify(ids)}) { const t0 = performance.now(), c = await emoCargar(id); if (!c) { out[id] = null; continue; }
  let mal = 0; for (let i = 0; i < c.r.length; i += 4) { const n = Math.hypot(c.r[i], c.r[i + 1], c.r[i + 2], c.r[i + 3]) / 32767; if (Math.abs(n - 1) > 0.01) mal++; }
  out[id] = { n: c.n.slice(0, 30), nf: c.nf, ms: Math.round(performance.now() - t0), mal }; } return out; })()`);
ok('se bajan y decodifican (cuaterniones de norma 1)', Object.values(res).every((x) => x && x.mal === 0), res);
// (parado en el piso: en el aire o moviéndose el emote se corta, como debe)
const mueve = await ev(`(async () => { const id = ${JSON.stringify(ids[0])}; for (let k = 0; k < 100 && !(JUG.suelo && Math.hypot(JUG.vel.x, JUG.vel.z) < 0.1); k++) await new Promise((r) => setTimeout(r, 50)); emote(id); await new Promise((r) => setTimeout(r, 300)); const P = JUG.cuerpo, i = P.D.h['mixamorig:LeftForeArm'] ?? Object.values(P.D.h)[10];
  const hi = P.D.h['mixamorig:Hips'] ?? P.D.h.Hips; const a = []; for (let k = 0; k < 16; k++) { await new Promise((r) => setTimeout(r, 250)); P.md.actualizar(); const w = P.md.W[i], h = P.md.W[hi]; a.push([w[12] - h[12], w[13] - h[13], w[14] - h[14]]); }   // (respecto de la cadera, 4 s: el baile en el lugar)
  let mx = 0; for (let k = 1; k < a.length; k++) mx = Math.max(mx, Math.hypot(a[k][0] - a[0][0], a[k][1] - a[0][1], a[k][2] - a[0][2])); return { emote: P.emote, mueve: +mx.toFixed(3), rec: EMO.rec[0] }; })()`);
ok('el emote se juega: el antebrazo se mueve y queda en Recientes', mueve.mueve > 0.05 && mueve.rec === ids[0], mueve);
ok('vale para la red', await ev(`emoValido(${JSON.stringify(ids[1])})`));
// los pies en el piso: en los que no son de saltar ni de acrobacia, lo más bajo del cuerpo toca el piso en algún momento
// (entre -15 y +3 cm, como el Hero parado) y casi siempre anda cerca (mediana entre -15 y +8 cm)
await ev(`window.__malla = (P) => { const md = P.md; md.sucio = true; md.actualizar(); let lo = 1e9; for (const pz of md.pieles) { const x = md.A[pz.i], d = DATA.ms[x.m], c = mallaCPU(x.m), H = pz.h, B = binDe(d), dv = new DataView(B.buffer, B.byteOffset);
    for (let v = 0; v < d.v; v += 3) { let y = 0; const o = d.sk + v * 8;
      for (let k = 0; k < 4; k++) { const bi = dv.getUint8(o + k), w = dv.getUint8(o + 4 + k) / 255; if (!w) continue; const B = bi * 12 + 4;
        y += w * (H[B] * c.P[v * 3] + H[B + 1] * c.P[v * 3 + 1] + H[B + 2] * c.P[v * 3 + 2] + H[B + 3]); }
      lo = Math.min(lo, y); } } return lo; }; 1`);
const pies = await ev(`(async () => { TIEMPO.dt = 1 / 30; const out = {}, piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  const lista = CMU_CAT.items.filter((x) => ['baile', 'caminar', 'pelea', 'gesto'].includes(x[2]) && x[3] > 3 && !/jump|hop|leap|flip|cartwheel|climb|sit|lie|crawl|kneel|fall|roll|ladder|stair/i.test(x[1])).filter((_, i) => i % 37 === 0).slice(0, 10);
  for (const x of lista) { const id = 'c:' + x[0], c = await emoCargar(id); if (!c) { out[x[0]] = null; continue; }
    const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.pos.set(JUG.pos.x, piso + 0.95, JUG.pos.z + 4); P.yaw = 0; P.vel.set(0, 0, 0); P.suelo = true; P.emote = id; P.emoteT = 0;
    const ys = []; for (let k = 0; k < Math.min(c.nf * 2, 200); k++) { P.emoteT += 1 / 30; animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); if (k % 4 === 0 && k > 10) ys.push((window.__malla(P) - piso) * 100); }
    borrarPersona(P); ys.sort((a, b) => a - b); out[x[0] + ' ' + x[1].slice(0, 22)] = [+ys[0].toFixed(1), +ys[ys.length >> 1].toFixed(1)]; }
  return out; })()`);
// (una patada puede rozar el piso con la punta un instante: el mínimo hasta -18)
ok('pies en el piso durante los emotes (mín -18..+3 cm, mediana -15..+8)', Object.values(pies).every((v) => v && v[0] >= -18 && v[0] <= 3 && v[1] >= -15 && v[1] <= 8), pies);
// acostado o rodando: el cuerpo no flota (lo más bajo, a menos de 12 cm del piso casi todo el tiempo)
const suelo = await ev(`(async () => { TIEMPO.dt = 1 / 30; const out = {}, piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  for (const x of CMU_CAT.items.filter((y) => /roll over|lie down|crawl/i.test(y[1]) && y[3] > 3).slice(0, 4)) { const id = 'c:' + x[0], c = await emoCargar(id); if (!c) continue;
    const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.pos.set(JUG.pos.x, piso + 0.95, JUG.pos.z + 4); P.yaw = 0; P.vel.set(0, 0, 0); P.suelo = true; P.emote = id; P.emoteT = 0;
    const ys = []; for (let k = 0; k < Math.min(c.nf * 2, 240); k++) { P.emoteT += 1 / 30; animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); if (k % 4 === 0 && k > 10) ys.push((window.__malla(P) - piso) * 100); }
    borrarPersona(P); ys.sort((a, b) => a - b); out[x[0] + ' ' + x[1].slice(0, 22)] = [+ys[Math.floor(ys.length * 0.1)].toFixed(1), +ys[Math.floor(ys.length * 0.8)].toFixed(1)]; }
  return out; })()`);
// (gateando, en la captura los dedos apuntan para abajo: apoyan en las puntas y el cuerpo queda hasta 12-13 cm arriba)
ok('acostado o rodando ni flota ni se hunde (lo más bajo entre -15 y +15 cm el 80 % del tiempo)', Object.keys(suelo).length > 0 && Object.values(suelo).every((v) => v[1] < 15 && v[0] > -15), suelo);
// fotos de 3/4 con un NPC, en mitad de cada uno
for (const id of ids.slice(0, 4)) {
  await ev(`(async () => { if (window.__P) borrarPersona(window.__P); const P = window.__P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true;
    P.pos.set(JUG.pos.x + Math.sin(JUG.yaw) * 3, JUG.pos.y, JUG.pos.z + Math.cos(JUG.yaw) * 3); P.yaw = JUG.yaw + Math.PI; P.vel.set(0, 0, 0); P.suelo = true; P.emote = ${JSON.stringify(id)}; P.emoteT = 0;
    const c = EMO.clips[${JSON.stringify(id)}]; for (let k = 0; k < Math.min(60, c.nf * 1.5); k++) { P.emoteT += 1 / 30; animarPersona(P, 1 / 30); } ubicarPersona(P); aterrizarPies(P); return 1; })()`);
  await ev(`(() => { const c = window.__P.pos, q0 = v3(c.x + Math.sin(JUG.yaw + 2.4) * 3.2, c.y + 0.6, c.z + Math.cos(JUG.yaw + 2.4) * 3.2), t = v3(c.x, c.y + 0.1, c.z), f = vsub(t, q0).norm();
    let q = Quat.euler(Math.atan2(f.x, f.z), Math.asin(f.y)); if (q.rot(v3(0, 0, 1)).distTo(f) > 0.01) q = Quat.euler(Math.atan2(f.x, f.z), -Math.asin(f.y)); DBG.cam = { p: q0, q }; return 1; })()`);
  await p.waitForTimeout(400); await p.screenshot({ path: D + 'emo_' + id.slice(2) + '.jpg', type: 'jpeg', quality: 80 });
}
// (el servidor de prueba no tiene favicon.ico: no cuenta)
const errs = err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e) && !(/404/.test(e) && fallidos.every((f) => /favicon/.test(f))));
ok('sin errores (ni pedidos que fallen, salvo el favicon)', !errs.length && fallidos.every((f) => /favicon/.test(f)), { errs: errs.slice(0, 4), fallidos });
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
