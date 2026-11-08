// Quién habla (voz.js): Ana (compu) y Beto (celular, 873×393 táctil), cada uno en su navegador, en una sala con un broker
// local. El micrófono de cada uno es un tono que la prueba prende y apaga (getUserMedia de mentira), así se sabe cuándo
// empieza a hablar. Se mide: cuánto tarda en aparecer la ficha (la propia y la del otro, por WebRTC de verdad), que se
// vaya al callarse, las fotos (retrato del personaje, la de Google propia, iniciales con un modelo de GMod), el ajuste
// para apagarlo, que no se toque la página en cada cuadro mientras alguien habla y que el panel no tape ningún botón de
// la HUD, en la compu y en el celular, en varios tamaños de pantalla.
// uso: node voz_hud.mjs HTML_o_URL [CARPETA_FOTOS]   (entorno: BROKER_DIR = carpeta con mc/broker, PUERTO)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json');
const [, , HTML, FOTOS] = process.argv;
const PUERTO = +(process.env.PUERTO || 8899), BROKER = 'ws://127.0.0.1:' + PUERTO + '/mqtt';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const RR = []; const ok = (n, c, d) => { RR.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
const SALA = { id: 'vozhud01', n: 'Voz HUD', m: 'FlatGrass', mo: 'Free', of: 0, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40, pw: 0 };
// (un PNG de 1×1 para la «foto de Google» de mentira)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const MIC = () => {
  // el micrófono de mentira: un tono de 220 Hz con un poco de vibrato, apagado hasta que la prueba lo prende
  navigator.mediaDevices.getUserMedia = async () => {
    const c = new AudioContext(); const o = c.createOscillator(), v = c.createOscillator(), vg = c.createGain(), g = c.createGain(), d = c.createMediaStreamDestination();
    o.frequency.value = 220; v.frequency.value = 5; vg.gain.value = 12; v.connect(vg).connect(o.frequency); g.gain.value = 0; o.connect(g).connect(d); o.start(); v.start();
    window.__hablar = (si) => { g.gain.setValueAtTime(si ? 0.7 : 0, c.currentTime); window.__hablarT = Date.now(); return window.__hablarT; };
    return d.stream;
  };
};
async function abrir(nombre, celu) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await b.newContext(celu ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.addInitScript(MIC);
  const p = await ctx.newPage(), err = []; p.on('pageerror', (e) => err.push(nombre + ': ' + e.message.slice(0, 200)));
  const url = /^https?:/.test(HTML) ? HTML : 'file://' + HTML;
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'test&gfx=patata&broker=' + encodeURIComponent(BROKER));
  await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  // (cuándo aparece y cuándo se va cada ficha, con la hora de la compu: la misma en los dos navegadores)
  await ev(`window.__fichas = {}; window.__cruce = {}; new MutationObserver((l) => { for (const m of l) { const e = m.target; if (!e.classList || !e.classList.contains('vozF') || !e.dataset.v) continue; const k = e.dataset.v, F = window.__fichas[k] || (window.__fichas[k] = {}); if (e.classList.contains('hab') && !F.hab) F.hab = Date.now(); if (e.classList.contains('sale') && !F.sale) F.sale = Date.now(); } for (const m of l) for (const n of m.removedNodes || []) if (n.dataset && n.dataset.v) { const F = window.__fichas[n.dataset.v] || (window.__fichas[n.dataset.v] = {}); F.fuera = Date.now(); } }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    { const o = vozHablaNivel; vozHablaNivel = function (id, m, R2) { if (m >= VOZH_SI && !window.__cruce[id]) window.__cruce[id] = Date.now(); return o.apply(this, arguments); }; } 1`);
  return { b, ctx, p, ev, err };
}
const A = await abrir('Ana', false), B = await abrir('Beto', true);
await A.ev(`PREFS.nombre = 'Ana'; PREFS.skin = 'Soldier'; PREFS.bienvenida = true; audioIniciar(); entrarSala(${JSON.stringify(SALA)}); 1`);
await B.ev(`PREFS.nombre = 'Beto'; PREFS.skin = 'Jean'; PREFS.bienvenida = true; audioIniciar(); entrarSala(${JSON.stringify(SALA)}); 1`);
await espera(5000);
const idA = await A.ev('RED.ID'), idB = await B.ev('RED.ID');
ok('Ana y Beto están en la sala y se ven', (await A.ev('RED.remotos.size')) === 1 && (await B.ev('RED.remotos.size')) === 1, { idA, idB });
// Ana prende el micrófono (callada): la voz llega a Beto por WebRTC
await A.ev('vozActivar(); 1');
let conectado = false; for (let i = 0; i < 40 && !conectado; i++) { await espera(250); conectado = await B.ev(`(() => { const C = VOZ.ent.get('${idA}'); return !!(C && C.an); })()`); }
ok('la voz de Ana le llega a Beto (WebRTC)', conectado, { conectado });
await espera(1200);
const nadie = JSON.parse(await B.ev("JSON.stringify(document.querySelectorAll('#vozHud .vozF:not(.vozMas)').length)"));
ok('callados: el panel no muestra a nadie', nadie === 0, nadie);
// ---- Ana habla 3 s ----
const mutPromesa = B.ev(`(async () => { await new Promise((r) => setTimeout(r, 900)); let n = 0, cu = 0, on = true; const mo = new MutationObserver((l) => { n += l.length; }); mo.observe($('hud'), { subtree: true, attributes: true, childList: true, characterData: true, attributeFilter: undefined }); const f = () => { if (on) { cu++; requestAnimationFrame(f); } }; requestAnimationFrame(f); await new Promise((r) => setTimeout(r, 1500)); on = false; mo.disconnect(); return JSON.stringify({ n, cu }); })()`);
const t0 = await A.p.evaluate(() => window.__hablar(true));
await espera(3000);
const fA = JSON.parse(await A.ev("JSON.stringify(window.__fichas.yo || {})")), fB = JSON.parse(await B.ev(`JSON.stringify({ f: window.__fichas['${idA}'] || {}, cruce: window.__cruce['${idA}'] || 0 })`));
const latA = fA.hab ? fA.hab - t0 : null, latB = fB.f.hab ? fB.f.hab - t0 : null, uiB = fB.f.hab && fB.cruce ? fB.f.hab - fB.cruce : null;
ok('Ana se ve a sí misma en el panel ≤ 150 ms después de empezar a hablar', latA !== null && latA <= 150, { ms: latA });
ok('Beto ve a Ana ≤ 150 ms después de que su voz le llega (y de punta a punta por WebRTC ≤ 600 ms)', uiB !== null && uiB <= 150 && latB <= 600, { msDesdeQueLlega: uiB, msDePuntaAPunta: latB });
const mut = JSON.parse(await mutPromesa);
ok('mientras habla, la página no se toca en cada cuadro (cambios / cuadro ≈ 0)', mut.n / Math.max(1, mut.cu) < 0.1, Object.assign(mut, { porCuadro: +(mut.n / Math.max(1, mut.cu)).toFixed(3) }));
const fichaB = JSON.parse(await B.ev(`(() => { const e = document.querySelector('#vozHud .vozF[data-v="${idA}"]'); if (!e) return 'null'; const i = e.querySelector('.vozAv img'); return JSON.stringify({ nom: e.querySelector('b').textContent, img: i ? i.src === retrato('Soldier') : false, hab: e.classList.contains('hab'), tag: [...RED.remotos.values()][0].tag.classList.contains('habla'), capa: getComputedStyle($('vozHud')).willChange, aria: e.getAttribute('aria-label') }); })()`));
ok('la ficha de Ana en Beto: su nombre, el retrato de su personaje (Soldier) y el anillo; su nombre arriba también dice que habla', fichaB && fichaB.nom === 'Ana' && fichaB.img && fichaB.hab && fichaB.tag && fichaB.capa === 'transform', fichaB);
if (FOTOS) { await A.p.screenshot({ path: FOTOS + '/voz_hud_pc.png' }); await B.p.screenshot({ path: FOTOS + '/voz_hud_celu.png' }); }
// ---- Ana se calla: se va de los dos lados ----
const t1 = await A.p.evaluate(() => window.__hablar(false));
await espera(1600);
const gA = JSON.parse(await A.ev("JSON.stringify(window.__fichas.yo || {})")), gB = JSON.parse(await B.ev(`JSON.stringify(window.__fichas['${idA}'] || {})`));
const quedan = JSON.parse(await B.ev("JSON.stringify(document.querySelectorAll('#vozHud .vozF:not(.vozMas)').length)"));
ok('al callarse, la ficha se apaga (fundido) y se va en menos de 1,2 s, en los dos', gA.fuera && gB.fuera && gA.fuera - t1 < 1200 && gB.fuera - t1 < 1200 && gA.sale < gA.fuera && quedan === 0, { anaSeVa: gA.fuera - t1, betoLaSaca: gB.fuera - t1, quedan });
// ---- las fotos: la de Google propia, iniciales con un modelo de GMod ----
const fotos = JSON.parse(await A.ev(`(() => { const g = CU.u, tk = CU.token; CU.u = Object.assign({}, CU.u, { foto: 'https://lh3.googleusercontent.com/a/prueba' }); CU.token = 'prueba'; const yo = vozFicha('yo', null); CU.token = tk; CU.u = g;
  const gm = vozFicha('xx', { nombre: 'Juan Pérez', skin: 'gmpm:models/player/kleiner.mdl' }), sin = vozFicha('yy', { nombre: 'zeta', skin: 'NoExiste' });
  return JSON.stringify({ yo: (yo.querySelector('img') || {}).src || '', gm: gm.querySelector('.vozAv').textContent, gmIni: gm.querySelector('.vozAv').classList.contains('ini'), sin: sin.querySelector('.vozAv').textContent }); })()`));
ok('foto: la propia de Google si entraste con tu cuenta; con un modelo de GMod o sin retrato, las iniciales', fotos.yo === 'https://lh3.googleusercontent.com/a/prueba' && fotos.gm === 'JP' && fotos.gmIni && fotos.sin === 'ZE', fotos);
// ---- el ajuste: apagado no aparece nadie (el nombre arriba igual avisa) ----
await B.ev('PREFS.vozHud = false; vozHudAjuste(); 1');
await A.p.evaluate(() => window.__hablar(true)); await espera(1500);
const apagado = JSON.parse(await B.ev(`JSON.stringify({ fichas: document.querySelectorAll('#vozHud .vozF:not(.vozMas)').length, tag: [...RED.remotos.values()][0].tag.classList.contains('habla') })`));
await B.ev('PREFS.vozHud = true; vozHudAjuste(); 1'); await espera(300);
const prendido = JSON.parse(await B.ev("JSON.stringify(document.querySelectorAll('#vozHud .vozF:not(.vozMas)').length)"));
await A.p.evaluate(() => window.__hablar(false));
ok('Ajustes → «Mostrar quién habla» apagado: sin panel (el nombre arriba sigue avisando); al prenderlo vuelve', apagado.fichas === 0 && apagado.tag && prendido === 1, { apagado, prendido });
const ajTexto = JSON.parse(await B.ev("JSON.stringify([T('aj.vozHud'), (PREFS.lang = 'en', T('aj.vozHud')), (PREFS.lang = 'ja', T('aj.vozHud')), (PREFS.lang = 'es', T('voz.habla'))])"));
ok('los textos nuevos están traducidos (14 idiomas)', ajTexto[0] !== 'aj.vozHud' && ajTexto[1] === 'Show who is talking (voice chat)' && /話/.test(ajTexto[2]) && ajTexto[3].includes('{n}'), ajTexto);
// ---- que no tape nada: varios en el panel, en la compu y en el celular, en varios tamaños ----
const TAPA = `(() => { const P = $('vozHud'); const fs = [...P.querySelectorAll('.vozF:not(.oc)')].map((e) => e.getBoundingClientRect()); if (!fs.length) return JSON.stringify({ sin: 1 });
  const u = { l: Math.min(...fs.map((r) => r.left)), t: Math.min(...fs.map((r) => r.top)), r: Math.max(...fs.map((r) => r.right)), b: Math.max(...fs.map((r) => r.bottom)) };
  const otros = [...document.querySelectorAll('#hud .bt, #hud .bt-t, #hud .redondo, #redEst, #vida, #fps, #chat > div, #palanca, #hudHab')].filter((e) => !P.contains(e)).map((e) => [e.id || e.dataset.btn || e.className, e.getBoundingClientRect()]).filter(([, r]) => r.width > 0 && r.height > 0);
  const tapa = otros.filter(([, r]) => r.left < u.r && r.right > u.l && r.top < u.b && r.bottom > u.t).map(([n]) => String(n).slice(0, 30));
  // (los nombres se ven enteros o, si no entran, la fila queda sólo con las fotos: nunca «J…»)
  const cortados = [...P.querySelectorAll('.vozF:not(.oc) b')].filter((b) => b.clientWidth > 0 && b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent);
  return JSON.stringify({ u: [u.l, u.t, u.r, u.b].map(Math.round), tapa, fuera: u.l < 0 || u.t < 0 || u.r > VW() || u.b > VH(), cortados, compacto: P.classList.contains('compacto') }); })()`;
const VARIOS = "(() => { clearInterval(window.__varios); const ids = ['yo', ...RED.remotos.keys(), 'f1', 'f2', 'f3']; window.__varios = setInterval(() => { vozHablaNivel('yo', 40, null); for (const R2 of RED.remotos.values()) vozHablaNivel(R2.id, 40, R2); for (const k of ['f1', 'f2', 'f3']) vozHablaNivel(k, 40, { nombre: 'Jugador ' + k, skin: 'Hero' }); }, 40); return 1; })()";
const tamanos = [];
for (const [P, celu, sizes] of [[A, false, [[1280, 720], [1024, 576], [1920, 1080]]], [B, true, [[873, 393], [800, 360], [915, 412], [1024, 768]]]]) {
  await P.ev(VARIOS);
  for (const [w, h] of sizes) {
    await P.p.setViewportSize({ width: w, height: h }); await espera(700);
    const r = JSON.parse(await P.ev(TAPA)); tamanos.push([(celu ? 'celu ' : 'pc ') + w + 'x' + h, r]);
  }
  if (FOTOS) await P.p.screenshot({ path: FOTOS + '/voz_hud_' + (celu ? 'celu' : 'pc') + '_varios.png' });
  await P.ev('clearInterval(window.__varios); 1');
}
ok('con 5 hablando, el panel no tapa ningún botón ni la vida, el chat o los FPS, no se sale de la pantalla y los nombres no quedan cortados (compu: 1280×720, 1024×576, 1920×1080; celular: 873×393, 800×360, 915×412 y tableta 1024×768)', tamanos.every(([, r]) => !r.sin && !r.tapa.length && !r.fuera && !r.cortados.length), tamanos);
const err = [...A.err, ...B.err];
ok('sin errores de JS', !err.length, err.slice(0, 5));
console.log(`RESUMEN ${RR.filter(Boolean).length}/${RR.length}`);
await A.b.close(); await B.b.close(); srv.close(); process.exit(0);
