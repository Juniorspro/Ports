// el Lua de los addons de GMod en el juego de verdad: un arma (Nyan Gun) a la mano desde el menú, que dispara, suena y se
// ve en primera persona; entidades de un addon (HBOMBS) puestas con su SpawnFunction, que piensan y caen; la HUD; lo que
// cuesta por cuadro; y la tienda GMod (pestaña nueva) con resultados reales del Workshop por el puente de la tienda.
// uso: node gmod_lua.mjs URL_HTML [CARPETA_FOTOS]   (los .gma se sirven desde URL_HTML/../gma/ID.gma)
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/', URL0 = process.argv[2], BASE = URL0.replace(/[^/]*$/, '');
// (el puente /api/gmod/* de la tienda corre acá mismo con el código del worker, contra Steam de verdad)
const W = (await import('../tienda/worker.js')).default; globalThis.caches = globalThis.caches || { default: { match: async () => null, put: async () => {} } };
const envW = { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }), run: async () => ({}) }) } };
let pedidosPuente = 0;
const { b, p, err, ev } = await abrir(URL0, false, null, async (pg) => {
  await pg.route(/\/api\/gmod\//, async (rt) => { pedidosPuente++; try { const r = await W.fetch(new Request(rt.request().url()), envW, {}); await rt.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { await rt.fulfill({ status: 502, body: String(e) }); } });
});
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 });
// costo base del cuadro (sin addons) para comparar
const medir = async (s) => { await p.waitForTimeout(400); return ev(`(async () => { const L = []; let t = performance.now(); for (let i = 0; i < ${Math.round(s * 30)}; i++) { await new Promise((r) => requestAnimationFrame(r)); } return +(TIEMPO.msProm || 0).toFixed(2); })()`); };
const ms0 = await medir(3);
// ---- 1) Nyan Gun: instalar desde el .gma, el arma aparece en el menú y a la mano ----
const inst = await ev(`(async () => { const b = new Uint8Array(await (await fetch('${BASE}gma/123277559.gma')).arrayBuffer()); const A = await gmInstalar('123277559', { nombre: 'Nyan Gun' }, b);
  const C = DATA.menu.find((c) => c.n === 'GMod'), it = C ? C.sub.flatMap((s) => s.it) : [];
  return { lua: A.lua.length, corridos: A.luaCorridos, err: A.luaErr.slice(0, 3), sweps: A.sweps, enMenu: it.filter((x) => /^gm(swep|ent):/.test(x)), ms: A.luaMs }; })()`);
ok('el addon carga su Lua sin errores y su arma aparece en la pestaña GMod', inst.lua > 0 && !inst.err.length && inst.enMenu.includes('gmswep:weapon_nyangun'), inst);
const dar = await ev(`(async () => { spawnElegir('GMod', 'gmswep:weapon_nyangun'); await new Promise((r) => setTimeout(r, 400)); const n = ARM.lista[ARM.i]; return { en: n, tipo: DEF_ARMAS[n] && DEF_ARMAS[n].tipo, nom: DEF_ARMAS[n] && DEF_ARMAS[n].nom, swep: !!GMA.swep, vista: DEF_ARMAS[n].base || (GMA.swep && GMA.swep.vmMd ? 'propia' : ''), dibuja: dibujarVista() }; })()`);
ok('tocarla en el menú la pone en la mano (con su nombre y una vista en primera persona)', dar.tipo === 'gmswep' && dar.swep && dar.nom === 'Nyan Gun' && dar.vista && dar.dibuja, dar);
const tiro = await ev(`(async () => { let balas = 0, son = 0; const ib = impactoBala, so = sonar; impactoBala = (...a) => { balas++; return ib(...a); }; sonar = (...a) => { son++; return so(...a); };
  const e0 = GMA.errores.length; ENT.disparo = true; await new Promise((r) => setTimeout(r, 2000)); ENT.disparo = false; await new Promise((r) => setTimeout(r, 300));
  impactoBala = ib; sonar = so; return { balas, son, errores: GMA.errores.slice(e0, e0 + 3), faltan: [...(GMA.faltan || new Map()).keys()].slice(0, 8) }; })()`);
ok('mantener el disparo 2 s dispara (balas y sonidos del addon) sin errores de Lua', tiro.balas >= 5 && tiro.son >= 1 && !tiro.errores.length, tiro);
await p.waitForTimeout(300); await p.screenshot({ path: D + 'gmod_nyan.png' });
// ---- 2) HBOMBS: entidades con SpawnFunction, Think y física ----
const hb = await ev(`(async () => { const b = new Uint8Array(await (await fetch('${BASE}gma/1547995555.gma')).arrayBuffer()); const A = await gmInstalar('1547995555', { nombre: 'HBOMBS' }, b);
  const o0 = OBJS.length; JUG.pitch = 0.35; await new Promise((r) => setTimeout(r, 100));
  const puestos = []; for (const c of A.sents.slice(0, 3)) { const e = gmaSpawnMenu('gment:' + c); puestos.push({ c, ok: !!(e && e.o), modelo: e && e.modelo }); await new Promise((r) => setTimeout(r, 150)); }
  await new Promise((r) => setTimeout(r, 2500));
  const vivos = [...GMA.ents.values()].filter((e) => e.tipo === 'ent' && e.vivo && e.o && !e.o.borrado);
  return { sents: A.sents.length, err: A.luaErr.slice(0, 3), puestos, objetos: OBJS.length - o0, vivos: vivos.length, quietos: vivos.filter((e) => e.o.b.sleep || e.o.b.vel.len() < 0.3).length, pensaron: vivos.filter((e) => e.proxS > 0).length }; })()`);
ok('las entidades del addon se ponen delante (SpawnFunction), tienen cuerpo y caen al piso', hb.sents > 0 && hb.puestos.every((x) => x.ok) && hb.vivos >= hb.puestos.length && hb.quietos === hb.vivos, hb);
ok('sus Think corren (5 por segundo o lo que pidan)', hb.pensaron === hb.vivos, hb.pensaron);
await ev(`JUG.pitch = 0.25; 1`); await p.waitForTimeout(400); await p.screenshot({ path: D + 'gmod_hbombs.png' });
// ---- 3) HUD de un addon (HUDPaint) ----
const hud = await ev(`(async () => { gmaEnLado('C', () => GMA.R.c(GMA.R.cargar('hook.Add("HUDPaint", "prueba", function() draw.RoundedBox(8, 20, 20, 220, 50, Color(0, 0, 0, 180)); draw.SimpleText("Hola desde Lua", "DermaLarge", 30, 28, Color(255, 220, 0)) end)', 'prueba'), 'prueba'));
  await new Promise((r) => setTimeout(r, 300)); const c = document.getElementById('gmHUD'); if (!c) return { canvas: false };
  const g = c.getContext('2d'), d = g.getImageData(40 * (c.width / innerWidth), 40 * (c.height / innerHeight), 1, 1).data; return { canvas: true, w: c.width, pixel: [...d] }; })()`);
ok('HUDPaint dibuja encima del juego (surface/draw)', hud.canvas && hud.pixel[3] > 100, hud);
await p.screenshot({ path: D + 'gmod_hud.png' });
await ev(`GMA.hooks.get('HUDPaint').delete('prueba'); 1`);
// ---- 4) costo ----
const ms1 = await medir(3), lua = await ev(`+(GMA.ms || 0).toFixed(3)`);
ok('el Lua de 2 addons cuesta poco por cuadro (≤ 1 ms)', lua <= 1, { msCuadroSin: ms0, msCuadroCon: ms1, msLua: lua });
// ---- 5) desmontar: el Lua se reinicia sin los addons y sin restos ----
const des = await ev(`(async () => { gmQuitar('1547995555'); gmQuitar('123277559'); await new Promise((r) => setTimeout(r, 300)); return { clases: GMA.clases.size, armas: GMA.armas.size, ents: [...GMA.ents.values()].filter((e) => e.tipo === 'ent' && e.vivo).length, enMano: ARM.lista.filter((n) => /^gm:/.test(n)).length, activo: !!GMA.activo }; })()`);
ok('quitar los addons saca sus clases, entidades y armas', des.ents === 0 && des.enMano === 0 && !des.activo, des);
// ---- 6) la tienda: pestaña GMod con el Workshop de verdad ----
const tienda = await ev(`(async () => { cerrarPaneles(); inicioMostrar(true); RB.t.tab = 'gmod'; RB.t.vista = 'explorar'; RB.t.q = ''; RB.t.etq = 'Weapon'; inicioPanel('tienda');
  for (let i = 0; i < 60 && (RB.t.cargando || !RB.t.items.length); i++) await new Promise((r) => setTimeout(r, 250));
  const tiles = RB.el.querySelectorAll('.rbTiendaG .rbTile').length, conFoto = [...RB.el.querySelectorAll('.rbTiendaG .rbTile img')].filter((i) => /^https:/.test(i.src)).length;
  return { items: RB.t.items.length, total: RB.t.total, tiles, conFoto, primero: RB.t.items[0] && RB.t.items[0].t, error: RB.t.error }; })()`);
ok('la pestaña GMod de la tienda muestra addons reales del Workshop (con foto) por categoría', tienda.items >= 20 && tienda.tiles >= 20 && tienda.conFoto >= 20, tienda);
await p.waitForTimeout(1500); await p.screenshot({ path: D + 'gmod_tienda.png' });
const ficha = await ev(`(async () => { const id = RB.t.items[0].id; inicioAccion('ver:' + id, document.body); await new Promise((r) => setTimeout(r, 300)); const f = RB.el.querySelector('.rbFicha'); return { ficha: !!f, titulo: f && f.querySelector('h3').textContent, boton: f && !!f.querySelector('[data-rb^="instalar:"], .gmImpFicha') }; })()`);
ok('tocar uno abre su ficha con Instalar (o Importar .gma si Steam no lo da directo)', ficha.ficha && ficha.boton, ficha);
await p.waitForTimeout(800); await p.screenshot({ path: D + 'gmod_ficha.png' });
const bus = await ev(`(async () => { inicioAccion('fichaNo', document.body); RB.t.etq = ''; RB.t.q = 'nyan'; gmTiendaCargar(true); for (let i = 0; i < 60 && RB.t.cargando; i++) await new Promise((r) => setTimeout(r, 250)); return { items: RB.t.items.length, conNyan: RB.t.items.filter((x) => /nyan/i.test(x.t)).length }; })()`);
ok('el buscador encuentra por texto ("nyan")', bus.conNyan >= 5, bus);
ok('pasó por el puente de la tienda', pedidosPuente >= 3, pedidosPuente);
const errs = err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|willReadFrequently|\[GMod\]|steamusercontent|429/.test(e));
ok('sin errores de JS', errs.length === 0, errs.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
