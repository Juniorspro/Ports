// el celular (estilo GTA 5): el botón al lado del chat (o la O) lo sube; las apps; "Objetos" pone cosas adelante sin
// cerrar el celular; "Memes" suena y sale en el chat; "Jugadores" lista la sala y el dueño puede echar a alguien (al
// echado le llega, sale y no puede volver a entrar por 30 min; si igual manda, se lo vuelve a echar y no se dibuja); la
// I abre directo en Memes; tocar afuera o el botón de inicio lo guarda; sin errores.
// uso: node celular.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2], true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500); await p.touchscreen.tap(5, 300); await p.waitForTimeout(300);
const pos = async (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()`);
const bt = await pos('[data-btn=celular]'); await p.touchscreen.tap(bt[0], bt[1]); await p.waitForTimeout(600);
const ab = await ev(`(() => { const c = $('celular'), r = c.getBoundingClientRect(); return { ui: UI.abierto, apps: c.querySelectorAll('.celApp').length, dentro: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 30 && r.top >= 0, alto: Math.round(r.height) }; })()`);
ok('el botón sube el celular con sus 7 apps, entero en la pantalla', ab.ui === 'celular' && ab.apps === 7 && ab.dentro, ab);
await p.screenshot({ path: D + 'celular_inicio.png' });
// Objetos: poner dos cosas sin cerrarlo
const ap = await pos('#celular [data-cel="app|props"]'); await p.touchscreen.tap(ap[0], ap[1]); await p.waitForTimeout(400);
const n0 = await ev(`OBJS.length`);
for (let i = 0; i < 2; i++) { const it = await pos('#celular .celIt'); await p.touchscreen.tap(it[0], it[1]); await p.waitForTimeout(300); }
const ob = await ev(`({ ui: UI.abierto, puso: OBJS.length - ${n0}, items: document.querySelectorAll('#celular .celIt').length, cats: document.querySelectorAll('#celular .celChips button').length, txt: document.querySelector('#celular .celPuso').textContent })`);
ok('"Objetos": tocar uno lo pone adelante y el celular sigue abierto (2 puestos)', ob.ui === 'celular' && ob.puso === 2 && ob.items > 3 && ob.cats > 3, ob);
await p.screenshot({ path: D + 'celular_objetos.png' });
// buscar
await ev(`(() => { const i = document.querySelector('#celular .celBus'); i.value = 'sof'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`); await p.waitForTimeout(200);
const bus = await ev(`[...document.querySelectorAll('#celular .celIt small')].map((x) => x.textContent)`);
ok('el buscador encuentra en todas las categorías', bus.length >= 1 && bus.every((t) => /sof/i.test(t)), bus);
// Memes (con la I) y suena + chat
await ev(`celCerrar(); ENT.pulsos.push('memes'); atenderPulsos(); 1`); await p.waitForTimeout(800);
const mm = await ev(`({ ui: UI.abierto, app: CEL.app, n: document.querySelectorAll('#celular .celMeme').length })`);
const m1 = await pos('#celular .celMeme'); await p.touchscreen.tap(m1[0], m1[1]); await p.waitForTimeout(500);
const mc = await ev(`CHAT.length ? CHAT[CHAT.length - 1].t : ''`);
ok('la I abre el celular en Memes (36) y tocar uno sale en el chat', mm.ui === 'celular' && mm.app === 'memes' && mm.n === 36 && / Vine boom$/.test(mc), { mm, mc });
await p.screenshot({ path: D + 'celular_memes.png' });
// Jugadores y echar (simulando una sala mía)
const ech = await ev(`(async () => { const env = []; RED.on = true; RED.cli = { publish: (t, s) => env.push(JSON.parse(s)) }; SALA = { id: 'sx', n: 'Mi server', du: RED.ID, m: 'FlatGrass' };
  recibirEstado({ i: 'malo', n: 'Molesto', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 });
  celApp('gente'); await new Promise((r) => setTimeout(r, 200));
  const lista = [...document.querySelectorAll('#celular .celPers b')].map((x) => x.textContent), boton = !!document.querySelector('#celular [data-cel="echar|malo"]');
  document.querySelector('#celular [data-cel="echar|malo"]').click(); await new Promise((r) => setTimeout(r, 200));
  const sigue = RED.remotos.has('malo'); env.length = 0;
  recibirEstado({ i: 'malo', n: 'Molesto', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 });
  const vuelve = RED.remotos.has('malo'), reEcha = env.some((x) => x.k === 'echar' && x.to === 'malo');
  RED.on = false; RED.cli = null; return { lista, boton, sigue, vuelve, reEcha }; })()`);
ok('Jugadores: aparece la gente de la sala; el dueño la echa (se va y si vuelve a mandar, se lo echa otra vez)', ech.lista.includes('Molesto') && ech.boton && !ech.sigue && !ech.vuelve && ech.reEcha, ech);
await p.screenshot({ path: D + 'celular_gente.png' });
// del lado del echado: sólo vale si lo manda el dueño; sale y no puede volver
const yo = await ev(`(() => { SALA = { id: 'sy', n: 'Otro', du: 'dueno1', m: 'FlatGrass' }; celEchadoRed({ k: 'echar', to: RED.ID, i: 'cualquiera' }); const sigo = JUEGO.estado;
  celEchadoRed({ k: 'echar', to: RED.ID, i: 'dueno1' }); return { trucho: sigo, despues: JUEGO.estado, bloqueado: celMeEcharon('sy') }; })()`);
ok('al echado: un aviso trucho (no del dueño) no hace nada; el del dueño lo saca y no puede volver por 30 min', yo.trucho === 'juego' && yo.despues === 'principal' && yo.bloqueado, yo);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
