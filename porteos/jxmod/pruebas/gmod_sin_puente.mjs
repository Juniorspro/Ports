// la tienda GMod sin ningún puente (el worker sin desplegar y el puente público caído): busca en el catálogo que va al
// lado del HTML, muestra fotos, filtra por categoría, encuentra por texto, abre la ficha e instala bajando el .gma
// directo del servidor de archivos de Steam (que deja pedir desde una página); el arma del addon queda en el menú.
// uso: node gmod_sin_puente.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const pedidos = { api: 0, puente: 0, cdn: 0, cat: 0, lector: 0 }; let lectorCaido = false;
const { b, p, err, ev } = await abrir(process.argv[2], false, null, async (pg) => {
  await pg.route(/\/api\/gmod\//, (rt) => { pedidos.api++; return rt.fulfill({ status: 404, body: 'no existe' }); });
  await pg.route(/cors\.eu\.org/, (rt) => { pedidos.puente++; return rt.abort(); });
  await pg.route(/r\.jina\.ai/, (rt) => { pedidos.lector++; return lectorCaido ? rt.abort() : rt.continue(); });
  pg.on('request', (q) => { const u = q.url(); if (/cdn\.steamusercontent\.com/.test(u)) pedidos.cdn++; if (/gm_cat\./.test(u)) pedidos.cat++; });
});
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cargado = async () => { for (let i = 0; i < 80; i++) { if (!(await ev(`RB.t.cargando`))) return; await espera(250); } };
await ev(`PREFS.bienvenida = true; inicioMostrar(true); RB.t.tab = 'gmod'; RB.t.vista = 'explorar'; RB.t.q = ''; RB.t.etq = ''; inicioPanel('tienda'); 1`);
await cargado();
const t0 = await ev(`({ items: RB.t.items.length, total: RB.t.total, error: RB.t.error, fotos: [...RB.el.querySelectorAll('.rbTiendaG .rbTile img')].filter((i) => /^https:/.test(i.src)).length, primero: RB.t.items[0] && RB.t.items[0].t })`);
ok('sin worker ni puente, la pestaña GMod muestra el Workshop entero en vivo (con foto)', t0.items >= 20 && t0.fotos >= 20 && !t0.error && t0.total > 50000, t0);
await espera(1500); const fotosOk = await ev(`[...RB.el.querySelectorAll('.rbTiendaG .rbTile img')].slice(0, 8).filter((i) => i.complete && i.naturalWidth > 0).length`);
ok('las fotos se ven', fotosOk >= 6, fotosOk);
await p.screenshot({ path: D + 'gmod_sin_puente.png' });
await ev(`inicioAccion('etq:Weapon', document.body); 1`); await cargado();
const arm = await ev(`({ items: RB.t.items.length, total: RB.t.total, todasArmas: RB.t.items.every((x) => x.tags.includes('Weapon')) })`);
ok('la categoría Armas filtra', arm.items >= 20 && arm.todasArmas, arm);
await ev(`RB.t.etq = ''; RB.t.q = 'nyan'; gmTiendaCargar(true); 1`); await cargado();
const bus = await ev(`({ items: RB.t.items.length, primeros: RB.t.items.slice(0, 3).map((x) => x.t) })`);
ok('el buscador encuentra "nyan" (Nyan Gun primero)', bus.items >= 1 && /nyan gun/i.test(bus.primeros[0]), bus);
const otro = await ev(`(async () => { const it = RB.t.items.find((x) => x.dir === undefined); if (!it) return { hay: false }; inicioAccion('ver:' + it.id, document.body); for (let i = 0; i < 60 && !(it.subs && it.d); i++) await new Promise((r) => setTimeout(r, 250)); const f = RB.el.querySelector('.rbFicha');
  return { hay: true, t: it.t, subs: it.subs, mb: it.mb, d: (it.d || '').slice(0, 60), tags: it.tags, boton: !!(f && f.querySelector('[data-rb^="instalar:"], .gmImpFicha')) }; })()`);
ok('la ficha de uno que no está en el catálogo se completa sola (suscriptos, tamaño, descripción)', otro.hay && otro.subs > 0 && otro.d && otro.boton, otro);
await p.screenshot({ path: D + 'gmod_sin_puente_vivo.png' }); await ev(`inicioAccion('fichaNo', document.body); 1`);
await ev(`inicioAccion('ver:123277559', document.body); 1`); await espera(400);
await p.screenshot({ path: D + 'gmod_sin_puente_ficha.png' });
const inst = await ev(`(async () => { const t0 = performance.now(); inicioAccion('instalar:123277559', document.body); for (let i = 0; i < 240 && (!GMOD.addons.has('123277559') || RB.t.gmProg); i++) await new Promise((r) => setTimeout(r, 250));
  const A = GMOD.addons.get('123277559'); if (A && A.listo) await A.listo; return { montado: !!A, s: +((performance.now() - t0) / 1000).toFixed(1), sweps: A && A.sweps, err: A && A.luaErr.length, guardado: !!(PREFS.gmod && PREFS.gmod['123277559']) }; })()`);
ok('Instalar baja el .gma directo de Steam, lo monta y corre su Lua (el arma queda lista)', inst.montado && inst.sweps && inst.sweps.includes('weapon_nyangun') && inst.err === 0 && pedidos.cdn >= 1, Object.assign(inst, pedidos));
await espera(400); await p.screenshot({ path: D + 'gmod_sin_puente_instalado.png' });
ok('no usó ningún puente (el catálogo sale de al lado del HTML)', pedidos.cat >= 1, pedidos);
await ev(`RB.t.q = ''; RB.t.etq = ''; RB.t.ficha = null; inicioAccion('gmdir', document.body); 1`); await cargado();
const dir = await ev(`({ items: RB.t.items.length, todos: RB.t.items.every((x) => x.dir === true), total: RB.t.total })`);
ok('"Sólo descarga directa": todos se instalan directo (del catálogo, al instante)', dir.items >= 20 && dir.todos, dir);
lectorCaido = true; await ev(`inicioAccion('gmdir', document.body); 1`); await cargado();
const caido = await ev(`({ items: RB.t.items.length, error: RB.t.error })`);
ok('si el lector también se cae, la tienda sigue con el catálogo', caido.items >= 20 && !caido.error, caido);
const errs = err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|willReadFrequently|\[GMod\]|Failed to load resource/.test(e));
ok('sin errores de JS', errs.length === 0, errs.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
