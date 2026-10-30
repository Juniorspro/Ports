// Verity con Gemini: (1) tu propia clave de Google AI Studio (el juego le habla directo a Google: chat y voz), (2) el
// terminal secreto (aparece buscando "terminal"; con el código del dueño, el permiso firmado de la tienda) y (3) la
// sección IA del panel con el tutorial. La tienda se atiende con worker.js de verdad (TIENDA_SIM: carpeta con el token,
// la cuenta de Cloudflare y la clave de Gemini en "gemini"; el código del dueño en "verity_codigo").
// uso: TIENDA_SIM=... node verity_gemini.mjs Hypper.html carpeta
import { abrir } from './base.mjs';
import fs from 'fs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', SIM = process.env.TIENDA_SIM;
const G = fs.readFileSync(SIM + '/gemini', 'utf8').trim(), COD = fs.readFileSync(SIM + '/verity_codigo', 'utf8').trim();
const T = fs.readFileSync(SIM + '/token', 'utf8').trim(), A = fs.readFileSync(SIM + '/cuenta', 'utf8').trim(), filas = new Map();
const DB = { prepare(sql) { const st = { args: [], bind(...a) { st.args = a; return st; }, async run() { return {}; },
  async first() { if (/RETURNING c, v/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0 }; f.c += st.args[2]; f.v += st.args[3]; filas.set(k, f); return f; } if (/RETURNING c/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0 }; f.c += 1; filas.set(k, f); return { c: f.c }; } return null; } }; return st; } };
const AI = { async run(m, inp) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${m}`, { method: 'POST', headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' }, body: JSON.stringify(inp) }); const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d.result; } };
const cache = new Map(); globalThis.caches = { default: { async match(r) { const x = cache.get(r.url); return x ? new Response(x) : undefined; }, async put(r, res) { cache.set(r.url, new Uint8Array(await res.arrayBuffer())); } } };
const DS = fs.existsSync(SIM + '/deepseek') ? fs.readFileSync(SIM + '/deepseek', 'utf8').trim() : '';
const W = (await import('../tienda/worker.js')).default, env = { DB, AI, GEMINI_KEY: G, ...(DS ? { DEEPSEEK_KEY: DS } : {}) }, pedidos = [], google = [], afuera = [];
let demora = 0; // (para probar la X: la tienda tarda en contestar)
const { b, p, ev, err } = await abrir(HTML, false, [], (pg) => pg.addInitScript(() => { window.webkitSpeechRecognition = window.SpeechRecognition = undefined; }));
await p.route(/\/api\/verity(\/voz|\/llave|\/crear|\/ias)?(\?.*)?$/, async (route) => {
  if (demora) await new Promise((ok) => setTimeout(ok, demora));
  const q = route.request(), r = await W.fetch(new Request(q.url().replace(/^https:\/\/[^/]+/, 'https://x.dev'), { method: q.method(), headers: { 'Content-Type': 'application/json' }, body: q.method() === 'POST' ? q.postData() : undefined }), env);
  const body = Buffer.from(await r.arrayBuffer()); pedidos.push(q.url().replace(/^.*\/api\//, '').slice(0, 24) + ' ' + r.status + (/json/.test(r.headers.get('content-type') || '') ? ' ' + (JSON.parse(body.toString()).f || '') : ''));
  await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body });
});
p.on('request', (q) => { if (/generativelanguage/.test(q.url())) google.push(q.url().replace(/^.*models\//, '').slice(0, 50)); if (/ovh\.net|llm7\.io|pollinations/.test(q.url())) afuera.push(q.url().replace(/^https:\/\/([^/]+).*$/, '$1')); });
let fallas = 0; const ok = (c, t, x) => { if (!c) fallas++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const espera = (ms) => p.waitForTimeout(ms);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.resDin=false; PREFS.lang='pt'; PREFS.nombre='Juni'; PREFS.verGem = ''; PREFS.verTk = ''; localStorage.removeItem('rb_verity'); PREFS.mods = {verity: true}; inicioMostrar(false); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; empezarPartida('FlatGrass')`);
await espera(6000); await ev(`audioIniciar(); 1`);
// ---- la sección IA y el tutorial ----
await ev(`verPanel(true); VER.pan.querySelector('[data-v=ia]').click(); 1`); await espera(200);
const ia = JSON.parse(await ev(`JSON.stringify({ cerebro: VER.pan.querySelector('.verCerebro').textContent, tx: VER.pan.querySelector('.verIAtx').textContent.slice(0, 60), abierta: !VER.pan.querySelector('.verIAp').classList.contains('oc') })`));
ok(ia.abierta && /Auto/.test(ia.cerebro), 'el panel muestra qué IA usa (y la sección IA, en el idioma del juego)', ia);
await ev(`VER.pan.querySelector('[data-v=tuto]').click(); 1`); await espera(200);
const tu = JSON.parse(await ev(`JSON.stringify({ vis: !$('verTuto').classList.contains('oc'), t: $('verTuto').querySelector('b').textContent, pasos: [...$('verTuto').querySelectorAll('li')].map((l) => l.textContent.slice(0, 30)), link: $('verTuto').querySelector('a').href })`));
ok(tu.vis && tu.pasos.length === 4 && /aistudio/.test(tu.link) && /chave/i.test(tu.t), 'el tutorial de la clave de Google AI Studio (en portugués acá)', tu);
await p.screenshot({ path: D + 'g1_tutorial.png' });
await ev(`verTutorial(false); 1`);
// ---- tu propia clave: se prueba y queda; Verity le habla directo a Google ----
await ev(`$('verGemIn').value = ${JSON.stringify(G)}; VER.pan.querySelector('[data-v=gemGuardar]').click(); 1`);
for (let i = 0; i < 60 && !(await ev(`verCerebro() === 'propia'`)); i++) await espera(250);
ok(await ev(`verCerebro() === 'propia' && VER.pan.querySelector('.verCerebro').classList.contains('gem')`), 'con tu clave: el panel dice que usa tus claves', await ev(`VER.pan.querySelector('.verCerebro').textContent`));
await p.screenshot({ path: D + 'g2_panel_ia.png' });
await ev(`verPanel(false); 1`);
const g0 = google.length, n0 = Number(await ev(`VER.hist.length`));
await ev(`verPreguntar('oi Verity! faz uma escada pra mim', '', '', 'yo'); 1`);
for (let i = 0; i < 120 && (await ev(`VER.pensando`)); i++) await espera(200);
let voz = false; for (let i = 0; i < 60; i++) { await espera(200); if (await ev(`!!VER.yo.voz`)) { voz = true; break; } }
const r1 = JSON.parse(await ev(`JSON.stringify({ h: VER.hist.slice(-1)[0], obra: !!VER.obra || VER.mios.length > 0 })`));
ok(google.length > g0 && r1.h && r1.h[0] === 'v' && r1.obra, 'pregunta en portugués: contesta con Gemini directo (sin la tienda) y construye', { dijo: r1.h && r1.h[1], google: google.slice(g0) });
ok(voz && google.some((u) => /tts/.test(u)), 'y habla con la voz de Gemini (portugués, que la tienda gratis no tiene)', { voz });
await ev(`verAcciones([{ a: 'limpiar' }]); PREFS.verGem = ''; 1`); await espera(3000);
// ---- el terminal secreto ----
await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.q = 'terminal'; spawnDibujar(); 1`); await espera(300);
const tile = await ev(`(() => { const d = [...$('grilla').children].find((x) => /Terminal/.test(x.textContent)); if (d) d.click(); return !!d; })()`);
await espera(400); await ev(`UI.q = ''; 1`);
const ent = await ev(`!!ENTS.lista.find((e) => e.t === 'terminal')`);
ok(tile && ent, 'buscando "terminal" aparece el prop secreto y se pone', { tile, ent });
await ev(`JUG.tercera = true; JUG.pitch = 0.25; 1`); await espera(600); await p.screenshot({ path: D + 'g3_terminal.png' }); await ev(`JUG.tercera = false; JUG.pitch = 0.05; 1`);
await ev(`entidadUsar(ENTS.lista.find((e) => e.t === 'terminal')); 1`); await espera(300);
await ev(`$('verTermIn').value = 'VRT-nada-nada'; $('verTerm').querySelector('[data-t=ok]').click(); 1`); await espera(1500);
ok(!(await ev(`!!PREFS.verTk`)), 'con un código malo no pasa nada');
await ev(`$('verTermIn').value = ${JSON.stringify(COD.toLowerCase())}; $('verTerm').querySelector('[data-t=ok]').click(); 1`);
for (let i = 0; i < 40 && !(await ev(`!!PREFS.verTk`)); i++) await espera(200);
ok(await ev(`!!PREFS.verTk && PREFS.verTk.length === 40`), 'con el código del dueño: la tienda da el permiso firmado (ya no hace falta: Gemini es para todos)');
const n1 = pedidos.length; await ev(`verPreguntar('oi, tudo bem?', '', '', 'yo'); 1`);
for (let i = 0; i < 120 && (await ev(`VER.pensando`)); i++) await espera(200); await espera(4000);
ok(pedidos.slice(n1).some((x) => /^verity 200 gemini/.test(x)) && pedidos.slice(n1).some((x) => /voz/.test(x)), 'y la tienda le contesta con tu Gemini (y su voz)', pedidos.slice(n1));

// ---- el menú de IAs: las del dueño para todos, la gratis sin clave, la X ----
await ev(`PREFS.verGem = ''; PREFS.verTk = ''; PREFS.verClaves = {}; VER.iasT = 0; verPanel(true); VER.pan.querySelector('.verIAp').classList.remove('oc'); 1`); await espera(1500);
const menu = JSON.parse(await ev(`JSON.stringify({ chips: [...VER.pan.querySelectorAll('.verIAs button')].map((b) => b.textContent + (b.classList.contains('sel') ? '*' : '') + (b.classList.contains('no') ? '-' : '')), ias: VER.ias, prov: [...$('verProv').options].map((o) => o.textContent) })`));
ok(menu.chips.length === 5 && /^Auto\*/.test(menu.chips[0]) && menu.ias && menu.ias.gemini === true && menu.prov.length === 6, 'menú: Auto / Gemini / DeepSeek / Gratis / Mis claves (las de RezoBox, para todos) y claves de 6 proveedores', menu);
await p.screenshot({ path: D + 'g5_menu_ias.png' });
// auto: la tienda piensa con Gemini (para todos, sin código ni server premium)
let n2 = pedidos.length; await ev(`verPanel(false); verPreguntar('hola Verity, ¿qué hacés?', '', '', 'yo'); 1`);
for (let i = 0; i < 150 && (await ev(`VER.pensando`)); i++) await espera(200);
ok(pedidos.slice(n2).some((x) => /^verity 200 gemini/.test(x)) && (await ev(`VER.ultIA`)) === 'gemini', 'Auto: piensa con el Gemini de RezoBox (para todos)', pedidos.slice(n2));
// deepseek (si la tienda tiene su clave): sin saldo, sigue sola con Gemini y el menú lo marca
if (DS) {
  await ev(`PREFS.verIA = 'deepseek'; 1`); n2 = pedidos.length;
  await ev(`verPreguntar('contame un chiste corto', '', '', 'yo'); 1`);
  for (let i = 0; i < 150 && (await ev(`VER.pensando`)); i++) await espera(200);
  await ev(`VER.iasT = 0; verIasCargar(); 1`); await espera(1500);
  const ds = JSON.parse(await ev(`JSON.stringify({ ult: VER.ultIA, ias: VER.ias, chip: [...VER.pan.querySelectorAll('.verIAs button')][2].className })`));
  ok(ds.ult === 'gemini' && ds.ias.deepseek === false && /no/.test(ds.chip), 'DeepSeek sin saldo: sigue sola con Gemini y el menú lo muestra como "no anda ahora"', ds);
}
// gratis sin clave: OVHcloud / LLM7 desde el aparato, sin la tienda
await ev(`PREFS.verIA = 'gratis'; 1`); n2 = pedidos.length; const a0 = afuera.length;
await ev(`verPreguntar('poneme una pelota', '', '', 'yo'); 1`);
for (let i = 0; i < 300 && (await ev(`VER.pensando`)); i++) await espera(200);
const gr = JSON.parse(await ev(`JSON.stringify({ ult: VER.ultIA, h: VER.hist.slice(-1)[0] })`));
ok(['ovh', 'llm7', 'pollinations'].includes(gr.ult) && !pedidos.slice(n2).some((x) => /^verity /.test(x)) && gr.h && gr.h[0] === 'v', 'Gratis sin clave: contesta con los modelos gratis ya puestos, sin la tienda', { ...gr, afuera: afuera.slice(a0) });
// la X de la esquina: mientras piensa aparece y corta (la respuesta que llega después no se dice)
await ev(`PREFS.verIA = 'auto'; 1`); demora = 6000; const h0 = Number(await ev(`VER.hist.length`));
await ev(`verPreguntar('decime algo largo', '', '', 'yo'); 1`); await espera(1200);
const x1 = JSON.parse(await ev(`JSON.stringify({ vis: !!$('verEstado') && !$('verEstado').classList.contains('oc'), q: $('verEstado') && $('verEstado').dataset.q, t: $('verEstado') && $('verEstado').textContent })`));
await p.screenshot({ path: D + 'g6_x_piensa.png' });
await ev(`$('verEstado').querySelector('button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 1`); await espera(7500); demora = 0;
const x2 = JSON.parse(await ev(`JSON.stringify({ pensando: VER.pensando, n: VER.hist.length, vis: !$('verEstado').classList.contains('oc') })`));
ok(x1.vis && x1.q === 'piensa' && !x2.pensando && x2.n === h0 + 1 && !x2.vis, 'la X en la esquina: "Verity está pensando" → la corta y no dice la respuesta que llega tarde', { x1, x2 });
// mientras crea: el contador y la X cancelan (no se instala nada)
const m0 = Number(await ev(`Object.keys(INST.mods).length`)); demora = 8000;
await ev(`verInventar('mod', 'super salto'); 1`); await espera(2500);
const c1 = JSON.parse(await ev(`JSON.stringify({ q: $('verEstado').dataset.q, t: $('verEstado').textContent })`));
await p.screenshot({ path: D + 'g7_x_crea.png' });
await ev(`$('verEstado').querySelector('button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 1`); await espera(12000); demora = 0;
const c2 = JSON.parse(await ev(`JSON.stringify({ ocupado: VCR.ocupado, n: Object.keys(INST.mods).length })`));
ok(c1.q === 'crea' && /\d:\d\d/.test(c1.t) && !c2.ocupado && c2.n === m0, 'creando: "Verity está creando 0:02" con la X, que la cancela (no instala nada)', { c1, c2 });
// crear con los gratis sin clave (piensa sin apuro)
await ev(`PREFS.verIA = 'gratis'; 1`); const t3 = Date.now();
await ev(`verInventar('mod', 'un mod de super velocidad con un botón que me lanza para arriba'); 1`); await espera(1000);
for (let i = 0; i < 900 && (await ev(`VCR.ocupado`)); i++) await espera(500);
const c3 = JSON.parse(await ev(`(() => { const L = Object.values(INST.mods); const m = L[L.length - 1]; return JSON.stringify({ n: L.length, nombre: m && m.nombre, cod: !!(m && m.codigo), act: !!(m && modsFuente()[m.id]) }); })()`));
ok(c3.n === m0 + 1 && c3.act, 'crear con los gratis sin clave: arma el mod y lo prende', { ...c3, seg: Math.round((Date.now() - t3) / 1000) });
await ev(`PREFS.verIA = 'auto'; 1`);
console.log('errores:', [...new Set(err.filter((e) => !/WebSocket|mqtt|Failed to load resource|favicon|isExternal/i.test(e)))].slice(0, 6).join(' | ') || 'ninguno');
await b.close(); process.exit(fallas ? 1 : 0);
