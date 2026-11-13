// La radio con YouTube, liviana (Discord, 3.1: «cuando pongo la radio 3D en YouTube para poner mi musiquita se crashea»).
// En un celular emulado de gama baja (calidad Patata, el procesador 4 veces más lento, y todo en un solo proceso que
// dibuja, como la vista web de Android), con la radio sonando YouTube:
//  1. quieto al lado de la radio: el reproductor se arma una sola vez y la memoria (PSS de todos los procesos) se mantiene;
//  2. caminando por el borde del alcance (40 m, ida y vuelta de 38 a 42 m cada medio segundo, 20 s): antes el reproductor
//     de YouTube se volvía a armar a cada cruce (cada vez ~2,5 MB de código de YouTube a leer y guardar); ahora se arma
//     a lo sumo una vez más;
//  2b. fuera del alcance más de 8 s (ya no se oye): el video queda en pausa —no se sigue bajando ni decodificando— y al
//     volver sigue;
//  3. parado entre dos radios con YouTube, moviéndose un poco: lo mismo (no salta de una a la otra a cada paso);
//  4. sin errores de JS.
// Da los números: armadas del reproductor, memoria de los procesos (MB) y tareas largas del hilo del juego (ms).
// uso: node radio_yt_liviana.mjs URL_HTML [antes]   (necesita internet para YouTube)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , HTML, MODO = ''] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const MARCA = '--jx-radio=' + process.pid;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--disable-site-isolation-trials', '--disable-features=IsolateOrigins,site-per-process', '--enable-precise-memory-info', MARCA] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Mobile Safari/537.36' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
// (cuántos reproductores de YouTube se arman, y las tareas largas del hilo del juego; igual en la versión de antes)
await ctx.addInitScript(() => {
  window.__ytN = 0; window.__largas = 0; const vistos = new WeakSet(), cuenta = (f) => { if (/youtube/.test(f.src || '') && !vistos.has(f)) { vistos.add(f); window.__ytN++; } };
  // (cada reproductor una vez: el aviso del contenedor y el del reproductor llegan juntos la primera vez)
  new MutationObserver((L) => { for (const m of L) for (const n of m.addedNodes) { if (n.tagName === 'IFRAME') cuenta(n); else if (n.querySelectorAll) for (const f of n.querySelectorAll('iframe')) cuenta(f); } }).observe(document, { childList: true, subtree: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas += e.duration; }).observe({ type: 'longtask', buffered: false }); } catch (e) {}
});
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
let caida = false; p.on('crash', () => { caida = true; });
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const cdp = await ctx.newCDPSession(p);
// memoria: PSS de todos los procesos del navegador (el que dibuja tiene el juego y YouTube juntos, como en Android)
const pss = () => {
  const L = {}; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'); L[d] = { pp: +st.slice(st.lastIndexOf(')') + 2).split(' ')[1], cmd: fs.readFileSync('/proc/' + d + '/cmdline', 'utf8') }; } catch (e) {} }
  const raiz = Object.keys(L).find((k) => L[k].cmd.includes(MARCA) && !L[k].cmd.includes('--type=')); if (!raiz) return { tot: 0, dib: 0 };
  const H = new Set([raiz]); let c = true; while (c) { c = false; for (const k in L) if (!H.has(k) && H.has(String(L[k].pp))) { H.add(k); c = true; } }
  let tot = 0, dib = 0; for (const k of H) { let v = 0; try { v = +/^Pss:\s+(\d+)/m.exec(fs.readFileSync('/proc/' + k + '/smaps_rollup', 'utf8'))[1] / 1024; } catch (e) {} tot += v; if (L[k].cmd.includes('--type=renderer')) dib += v; }
  return { tot: Math.round(tot), dib: Math.round(dib) };
};
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'patata'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.waitForTimeout(5000);
const m0 = pss();
// ---- 1: la radio con YouTube, quieto al lado ----
await ev(`(() => { entidadPonerMod('radio', true); const e = radioMia(); e.b.frozen = true; radioPoner(e, 'dQw4w9WgXcQ', 0, 'prueba', true); window.__R = e; JUG.pos.set(e.b.pos.x + 3, JUG.pos.y, e.b.pos.z); JUG.vel.set(0, 0, 0); window.__largas = 0; return 1; })()`);
await p.waitForTimeout(20000);
const s1 = await ev(`JSON.stringify({ armadas: window.__ytN, est: YT.est, largas: Math.round(window.__largas), js: Math.round(performance.memory.usedJSHeapSize / 1048576) })`).then(JSON.parse); const m1 = pss();
const fr = p.frames().find((x) => /youtube/.test(x.url()));
const vid = fr ? await fr.evaluate(() => { const v = document.querySelector('video'); return v ? { t: +v.currentTime.toFixed(1), res: v.videoWidth + 'x' + v.videoHeight } : null; }).catch(() => null) : null;
ok('1. quieto al lado: el reproductor se arma una vez y suena', s1.armadas === 1 && s1.est === 1 && !caida, { s1, video: vid, pssMB: { sinRadio: m0, conRadio: m1, sube: m1.tot - m0.tot } });
// ---- 2: por el borde del alcance ----
const borde = async (pos, seg) => {
  await ev(`window.__ytN0 = window.__ytN; window.__largas = 0; 1`); let max = 0; const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < seg * 1000 && !caida) { await ev(`(() => { const P = ${pos}(${k++}); JUG.pos.set(P.x, JUG.pos.y, P.z); JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(500); if (k % 4 === 0) max = Math.max(max, pss().tot); }
  return Object.assign(await ev(`JSON.stringify({ armadas: window.__ytN - window.__ytN0, largas: Math.round(window.__largas) })`).then(JSON.parse), { pssMax: max });
};
await ev(`window.__bordePos = (k) => { const e = window.__R, d = k % 2 ? 42 : 38; return v3(e.b.pos.x + d, 0, e.b.pos.z); }; 1`);
const s2 = await borde('window.__bordePos', 20);
ok('2. ida y vuelta por el borde del alcance (38 ↔ 42 m, 20 s): el reproductor se arma a lo sumo una vez más', MODO === 'antes' ? true : s2.armadas <= 1 && !caida, s2);
// ---- 2b: fuera del alcance (43 m, ya no se oye) un rato: el video queda en pausa; al volver sigue ----
await ev(`(() => { const e = window.__R; JUG.pos.set(e.b.pos.x + 43, JUG.pos.y, e.b.pos.z); JUG.vel.set(0, 0, 0); return 1; })()`);
await p.waitForTimeout(16000);
const fr2 = p.frames().find((x) => /youtube/.test(x.url())), vt = () => (fr2 ? fr2.evaluate(() => { const v = document.querySelector('video'); return v ? +v.currentTime.toFixed(1) : null; }).catch(() => null) : null);
const lejos = await ev(`JSON.stringify({ est: YT.est, vol: YT.vol, cargado: !!YT.ifr })`).then(JSON.parse), t2a = await vt(); await p.waitForTimeout(3000); const t2b = await vt();
await ev(`(() => { const e = window.__R; JUG.pos.set(e.b.pos.x + 3, JUG.pos.y, e.b.pos.z); return 1; })()`);
let cerca = null; for (let i = 0; i < 12; i++) { await p.waitForTimeout(1000); cerca = await ev(`JSON.stringify({ est: YT.est, vol: YT.vol })`).then(JSON.parse); if (cerca.est === 1) break; }
ok('2b. a 43 m (no se oye) más de 8 s: el video en pausa (no avanza) sin desarmarse; de vuelta, sigue sonando', MODO === 'antes' ? true : lejos.cargado && lejos.vol === 0 && lejos.est === 2 && t2a !== null && t2b - t2a < 0.5 && cerca.est === 1 && cerca.vol > 0, { lejos, avanzo3s: t2a !== null && t2b !== null ? +(t2b - t2a).toFixed(1) : null, cerca });
// ---- 3: entre dos radios ----
await ev(`(() => { const e = window.__R, f = v3(e.b.pos.x + 12, e.b.pos.y, e.b.pos.z), y = pisoBajo(v3(f.x, f.y + 1, f.z), 0);
  const o = entidadCrear({ t: 'radio', p: [f.x, y === null ? f.y : y, f.z], yaw: 0 }, { red: false }); o.b.frozen = true; radioPoner(o, 'jNQXAC9IVRw', 0, 'otra', true); window.__R2 = o; return 1; })()`);
await ev(`window.__entre = (k) => { const a = window.__R.b.pos, c = window.__R2.b.pos, m = (k % 2 ? 0.55 : 0.45); return v3(a.x + (c.x - a.x) * m, 0, a.z + 2); }; 1`);
const s3 = await borde('window.__entre', 20);
ok('3. parado entre dos radios con YouTube, moviéndose medio metro (20 s): no salta de una a la otra', MODO === 'antes' ? true : s3.armadas <= 1 && !caida, s3);
const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('4. sin errores de JS ni caídas', !err.length && !caida, err.slice(0, 5));
console.log('NUMEROS ' + JSON.stringify({ modo: MODO || 'nuevo', quieto: s1, borde: s2, entre: s3, pss: { sinRadio: m0, conRadio: m1 } }));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
