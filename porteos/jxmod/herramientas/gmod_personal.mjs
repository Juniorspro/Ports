// Los datos de Garry's Mod de verdad para la versión personal del dueño (no se publica; va sólo adentro de su APK):
// del contenido base de GMod (el depósito 4021 del servidor dedicado, el mismo que usa el juego —gmod_steam.js—) saca
//  - los spawnlists de fábrica (garrysmod/settings/spawnlist_default/*.txt), con su árbol, sus íconos y sólo los modelos
//    que existen en el contenido base (los de L4D, Portal, TF2, DoD, CS:GO y Lost Coast piden juegos que GMod no trae);
//  - el Lua de GMod que llena las listas del menú (lua/autorun/base_npcs.lua, base_vehicles.lua y game_hl2.lua) y los
//    nombres en inglés (resource/localization/en/*.properties);
//  - el spawnicon de cada modelo (materials/spawnicons/...png), uno por archivo (la app los sirve tal cual), y los iconitos
//    de 16 px de GMod (materials/icon16, materials/games/16) para las pestañas, el árbol y el panel de addons.
// Escribe SALIDA/jxp/{menu.json, lua/..., loc/..., iconos/..., ui/...}; armar_apk.py --personal lo pone en assets/www/rb/jxp/.
// Corre el juego en un navegador sin ventana (usa su código para leer el depósito de Steam): hace falta el HTML armado.
// uso: node herramientas/gmod_personal.mjs HTML SALIDA
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, SAL] = process.argv; const D = path.join(SAL, 'jxp');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await p.goto((/^https?:/.test(HTML) ? HTML : 'file://' + HTML) + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const n = await ev(`(async () => { for (let i = 0; i < 4; i++) { const x = await gbsIniciar(); if (x) return x.size; GBS.prom = null; await new Promise((r) => setTimeout(r, 2000)); } return 0; })()`);
if (!n) { console.error('no se pudo leer el contenido base de Steam'); process.exit(1); }
console.log('contenido base:', n, 'archivos');
// leer archivos (de a lotes, en base64)
async function leer(rutas) {
  const out = {};
  for (let i = 0; i < rutas.length; i += 40) {
    const r = await ev(`(async () => { const o = {}; const L = ${JSON.stringify(rutas.slice(i, i + 40))}; await gbsTraer(L.filter((x) => GBS.idx.has(x)));
      for (const ru of L) { let u = null; try { if (GBS.idx.has(ru)) u = gmArchivo(ru); if (!u && GBS.archivos.has(ru)) { const f = GBS.archivos.get(ru); u = await gbsLeer(f, 0, f.tam); } } catch (e) { u = null; }
        if (u) { let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); o[ru] = btoa(s); } } return o; })()`);
    for (const [k, v] of Object.entries(r)) out[k] = Buffer.from(v, 'base64');
    if (rutas.length > 200 && i % 800 === 0) console.log('  ', i, '/', rutas.length);
  }
  return out;
}
const sueltos = await ev(`[...GBS.archivos.keys()].filter((k) => /^garrysmod\\/(settings\\/spawnlist_default\\/.+\\.txt|lua\\/autorun\\/(base_npcs|base_vehicles|game_hl2)\\.lua|resource\\/localization\\/en\\/.+\\.properties)$/.test(k))`);
const S = await leer(sueltos);
// los spawnlists: id, padre, nombre, ícono y modelos (los que existen)
const listas = [];
for (const [ru, buf] of Object.entries(S)) {
  if (!/spawnlist_default/.test(ru)) continue;
  const t = buf.toString('utf8'), g = (k) => (new RegExp('"' + k + '"\\s*"([^"]*)"').exec(t) || [])[1];
  const mods = [...t.matchAll(/"model"\s*"(models[\\/][^"]+)"/gi)].map((m) => m[1].toLowerCase().replace(/\\/g, '/'));
  listas.push({ id: +g('id'), padre: +g('parentid'), nombre: g('name'), icono: g('icon'), mods });
}
const todos = [...new Set(listas.flatMap((l) => l.mods))];
const hay = await ev(`(() => { const L = ${JSON.stringify(todos)}; return L.map((m) => [gbsTiene(m) || (typeof gmlTiene === 'function' && gmlTiene(m)) ? 1 : 0, GBS.idx.has('materials/spawnicons/' + m.replace(/\\.mdl$/, '.png')) ? 1 : 0]); })()`);
const existe = new Map(todos.map((m, i) => [m, hay[i]]));
for (const l of listas) { l.total = l.mods.length; l.mods = l.mods.filter((m) => existe.get(m)[0]); }
// (una lista sin la mitad de sus modelos es de un juego que GMod no trae: afuera, y sus hijas también)
const fuera = new Set(listas.filter((l) => l.total && l.mods.length < l.total / 2).map((l) => l.id));
for (const l of listas) if (fuera.has(l.padre)) fuera.add(l.id);
const padresVacios = new Set(listas.filter((l) => !l.total).map((l) => l.id));
for (const id of padresVacios) if (listas.filter((x) => x.padre === id).every((x) => fuera.has(x.id))) fuera.add(id);
const quedan = listas.filter((l) => !fuera.has(l.id)).sort((a, c) => a.id - c.id);
const conIcono = [...new Set(quedan.flatMap((l) => l.mods))].filter((m) => existe.get(m)[1]);
console.log('listas', quedan.length, 'de', listas.length, '· modelos', [...new Set(quedan.flatMap((l) => l.mods))].length, '· con ícono', conIcono.length);
fs.mkdirSync(D, { recursive: true });
// el Lua y los nombres
for (const [ru, buf] of Object.entries(S)) {
  if (/\/lua\/autorun\//.test(ru)) { const f = path.join(D, 'lua', path.basename(ru)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); }
  if (/localization\/en\//.test(ru)) { const f = path.join(D, 'loc', path.basename(ru)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); }
}
// los íconos
let nI = 0, bI = 0;
const IC = await leer(conIcono.map((m) => 'materials/spawnicons/' + m.replace(/\.mdl$/, '.png')));
for (const [ru, buf] of Object.entries(IC)) { const f = path.join(D, 'iconos', ru.replace(/^materials\/spawnicons\//, '')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); nI++; bI += buf.length; }
const icono = new Set(Object.keys(IC).map((r) => r.replace(/^materials\/spawnicons\//, '').replace(/\.png$/, '.mdl')));
// los iconitos de 16 px de GMod (materials/icon16 y materials/games/16: pestañas, carpetas de los spawnlists y el panel de addons)
const uiR = await ev(`[...GBS.idx.keys()].filter((k) => /^materials\\/(icon16|games\\/16)\\/[^/]+\\.png$/.test(k))`);
const UI = await leer(uiR); let nU = 0;
for (const [ru, buf] of Object.entries(UI)) { const f = path.join(D, 'ui', ru.replace(/^materials\//, '')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); nU++; }
console.log('iconitos de 16 px:', nU);
const menu = { v: 1, fecha: new Date().toISOString().slice(0, 10), listas: quedan.map((l) => ({ id: l.id, padre: l.padre, n: l.nombre, ic: l.icono, m: l.mods, i: l.mods.map((m) => (icono.has(m) ? 1 : 0)) })),
  lua: fs.existsSync(path.join(D, 'lua')) ? fs.readdirSync(path.join(D, 'lua')) : [], loc: fs.existsSync(path.join(D, 'loc')) ? fs.readdirSync(path.join(D, 'loc')) : [] };
fs.writeFileSync(path.join(D, 'menu.json'), JSON.stringify(menu));
console.log('ok · íconos', nI, (bI / 1e6).toFixed(1), 'MB · Lua', menu.lua.join(', '), '· nombres', menu.loc.length);
await b.close(); process.exit(0);
