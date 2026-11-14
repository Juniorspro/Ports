// La carpeta de mods (gmod_carpeta.js; en la app, Carpeta.java + Web.java): addons de GMod desarmados en carpetas, como
// garrysmod/addons de la compu (Discord, TerminatorX). Con addons reales del Workshop desarmados a mano (uno con
// mayúsculas y minúsculas mezcladas y sin addon.json, uno con un addon.json raro —BOM, comentarios, comas de más—, uno
// dentro de una carpeta para ordenar, un mapa, un .gma suelto, una carpeta que no es un addon y basura: .psd, Thumbs.db):
//  A. la app de Android: el juego habla con PruebaCarpeta --servir, que contesta /carpeta/lista y /carpeta/paquete con la
//     misma clase que usa la app (Carpeta.java); JXNativo de mentira para lo demás:
//     1. lee todo: cuántos nuevos, nombres, ninguno con error, sin pedir nada a internet;
//     2. cada addon montado tiene exactamente los archivos del .gma original (rutas y bytes);
//     3. y lo mismo que instalar el .gma original: modelos, props del menú, armas, entidades, NPCs, vehículos, mapas,
//        personajes, Lua corrido y con error, y la sección del menú de props (otra pestaña, instalando los .gma);
//     4. al volver a abrir: todo montado desde lo guardado; al releer sola no se vuelve a copiar nada (bytes pedidos);
//     5. cambia un addon: sólo ése se vuelve a copiar; 6. se borra una carpeta: se quita; vuelve: se pone;
//     7. quitado a mano: no vuelve al releer; «Volver a ponerlo» lo pone; 8. deshabilitado: sigue sin montar;
//     9. sin permiso para la carpeta: no se quita nada; 10. «Olvidar carpeta»: se quitan los de la elegida, no los de
//        Android/data;
//  B. la compu (Chrome): «Elegir carpeta de mods» (el selector de verdad no se puede tocar desde la prueba: devuelve una
//     carpeta del navegador —OPFS— con los mismos archivos): lee, al volver a abrir relee sola sin copiar, cambia uno;
//  C. un navegador sin ese selector: la carpeta elegida con <input webkitdirectory> (se importa);
//  D. un .zip de la carpeta (el camino del iPhone): mismos archivos y bytes que los .gma originales;
//  E. capturas: el panel (compu y celular), Ajustes → Carpeta de mods, la ficha de uno, el menú de props.
// uso: node gmod_carpeta.mjs URL_HTML CARPETA_PRUEBA [CAPTURAS]   (CARPETA_PRUEBA: JXMOD/, Android_data_files_addons/,
//      gma_originales/<id>.gma)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawn, execFileSync } from 'child_process';
const [, , HTML, BASE, CAPS] = process.argv;
const AQUI = path.dirname(new URL(import.meta.url).pathname), APK = path.join(AQUI, '..', 'apk');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gmk-')), CARP = path.join(TMP, 'JXMOD'), APPD = path.join(TMP, 'appdata');
fs.cpSync(path.join(BASE, 'JXMOD'), CARP, { recursive: true }); fs.mkdirSync(APPD);
const pegarAppData = () => fs.cpSync(path.join(BASE, 'Android_data_files_addons'), APPD, { recursive: true });
const ORIG = { 'carpeta:c/addons/nyan_gun': '123277559', 'carpeta:c/addons/scp-096 nextbot': '367531149', 'carpeta:c/addons/kermit the frog': '485879458', 'carpeta:c/addons/vehiculos/jetski_kawasaki': '105908087',
  'carpeta:c/addons/destructible house': '107208395', 'carpeta:c/addons/popcorn_swep.gma': '171935748', 'carpeta:a/fire_extinguisher': '104607228' };
const FASE = (k) => !process.env.FASES || process.env.FASES.includes(k);
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 700) : '')); return ok; };
let bien = 0, tot = 0; const C = (n, ok, info) => { tot++; if (caso(n, ok, info)) bien++; };
// ---- la app de mentira: Carpeta.java sirviendo la carpeta ----
const JC = path.join(TMP, 'java'); fs.mkdirSync(JC);
execFileSync('javac', ['--release', '8', '-Xlint:-options', '-nowarn', '-d', JC, path.join(APK, 'web/src/com/jxmod/app/Carpeta.java'), path.join(APK, 'pruebas/unido/PruebaCarpeta.java')], { stdio: 'pipe' });
const PJ = 8900 + Math.floor(Math.random() * 60);
const java = spawn('java', ['-Dfile.encoding=UTF-8', '-Dsun.jnu.encoding=UTF-8', '-cp', JC, 'PruebaCarpeta', '--servir', String(PJ), CARP, APPD], { env: { ...process.env, LC_ALL: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => java.stdout.once('data', ok));
// (pase lo que pase, al salir se cierra el servidor y se borra la copia de la carpeta)
process.on('exit', () => { try { java.kill(); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
process.on('uncaughtException', (e) => { console.log('ERROR', e && e.message ? e.message.split('\n')[0] : e); process.exit(2); });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errJS = [];
async function contexto(celu, app, extra) {
  const ctx = await b.newContext(celu ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const st = { paquete: 0, bytes: 0, lista: 0, fuera: [], midiendo: false, arbol: '' };
  if (app) await ctx.exposeFunction('__natArbol', (v) => { st.arbol = v; });
  // (sin internet: todo lo que no es de la compu se corta; se anota lo que se intentó mientras se leía la carpeta)
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { if (st.midiendo) st.fuera.push(r.request().url().replace(/^https?:\/\//, '').slice(0, 60)); return r.abort('internetdisconnected'); });
  await ctx.route('**/gma_orig/*', (r) => r.fulfill({ status: 200, body: fs.readFileSync(path.join(BASE, 'gma_originales', path.basename(new URL(r.request().url()).pathname))) }));
  if (app) {
    await ctx.route('**/carpeta/**', async (r) => {
      const u = new URL(r.request().url());
      if (!st.arbol && u.pathname === '/carpeta/lista') { const x = await (await fetch(`http://127.0.0.1:${PJ}${u.pathname}`)).json(); st.lista++; x.raices[1] = { k: 'c', nombre: '', id: '', ok: false, sin: true }; x.a = x.a.filter((a) => a[0] !== 1); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) }); }
      if (st.listaFalla && u.pathname === '/carpeta/lista') { const x = await (await fetch(`http://127.0.0.1:${PJ}${u.pathname}`)).json(); x.raices[1] = { k: 'c', nombre: 'JXMOD', id: 'primary:JXMOD', ok: false, sin: false, error: 'sin permiso' }; x.a = x.a.filter((a) => a[0] !== 1); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) }); }
      const x = await fetch(`http://127.0.0.1:${PJ}${u.pathname}${u.search}`), body = Buffer.from(await x.arrayBuffer());
      if (u.pathname === '/carpeta/paquete') { st.paquete++; st.bytes += body.length; } else st.lista++;
      return r.fulfill({ status: x.status, headers: { 'content-type': x.headers.get('content-type') || 'application/octet-stream' }, body });
    });
    await ctx.addInitScript(() => {
      window.__nat = { olvidada: 0, creada: 0, arbol: localStorage.getItem('__nat_arbol') || '' };
      const arbol = (v) => { window.__nat.arbol = v; try { if (v) localStorage.setItem('__nat_arbol', v); else localStorage.removeItem('__nat_arbol'); } catch (e) {} window.__natArbol(v); };
      window.JXNativo = { carpeta: () => 1, carpetaEstado: () => JSON.stringify({ arbol: window.__nat.arbol, nombre: 'JXMOD', permiso: true, app: 'Android/data/com.jxmod.app/files/addons', sdk: 34 }),
        carpetaElegir: () => { arbol('primary:JXMOD'); setTimeout(() => window.__jxCarpeta(JSON.stringify({ ok: true, nombre: 'JXMOD', arbol: 'primary:JXMOD' })), 50); }, carpetaOlvidar: () => { window.__nat.olvidada++; arbol(''); }, carpetaCrear: () => { window.__nat.creada++; return 'ya'; } };
    });
  }
  if (extra) await extra(ctx);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  const abrir = async (q) => { await p.goto(HTML + (q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; guardarPrefs(); 1`); };
  return { ctx, p, ev, abrir, st };
}
const esperar = async (ev, cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return Date.now() - t0; await new Promise((r) => setTimeout(r, 300)); } return -1; };
// (en la página: la huella de cada archivo de un addon montado —los que quedaron en el disco también— o de un .gma)
const AYUDAS = `window.__h = {
  hu(u) { let a = 2166136261, b = 5381; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 16777619); b = (Math.imul(b, 33) + u[i]) | 0; } return (a >>> 0).toString(36) + (b >>> 0).toString(36) + ':' + u.length; },
  async deG(G) { const o = {}; for (const [r, u] of G.archivos) o[r] = this.hu(u); for (const [r, x] of G.perezosos || []) o[r] = this.hu(new Uint8Array(await G.blob.slice(x.o, x.o + x.t).arrayBuffer())); return o; },
  async orig(w) { const u = new Uint8Array(await (await fetch('/gma_orig/' + w + '.gma')).arrayBuffer()); const G = GMF.gma(u); return { nombre: G.nombre, h: await this.deG(G) }; },
  async comparar(id, w) { const A = GMOD.addons.get(id); if (!A) return { id, falta: true }; const a = await this.deG(A.G), o = await this.orig(w); const ka = Object.keys(a).sort(), ko = Object.keys(o.h).sort();
    const sobran = ka.filter((k) => !(k in o.h)), faltan = ko.filter((k) => !(k in a)), distintos = ka.filter((k) => k in o.h && a[k] !== o.h[k]);
    return { id, n: ka.length, nOrig: ko.length, sobran: sobran.slice(0, 4), faltan: faltan.slice(0, 4), distintos: distintos.slice(0, 4) }; },
  resumen(A) { const M = DATA.menu.find((c) => c.n === 'GMod'), s = M && M.sub.find((x) => x.gm === A.id);
    return { archivos: A.G.archivos.size + (A.G.perezosos ? A.G.perezosos.size : 0), modelos: A.props.length, menuProps: gmPropsMenu(A).length, armas: (A.sweps || []).length, ents: (A.sents || []).length,
      npc: (A.listas && A.listas.NPC ? A.listas.NPC.size : 0), veh: (A.listas && A.listas.Vehicles ? A.listas.Vehicles.size : 0), mapas: [...GBSP.mapas.values()].filter((m) => m.id === A.id).length,
      pms: gmpLista().filter((r) => A.G.archivos.has(r)).length, lua: A.lua.length, luaErr: (A.luaErr || []).length, tipo: gmbTipo(A).k, menu: s ? s.it.length : 0, menuTipos: s ? [...new Set(s.it.map((x) => x.split(':')[0]))].sort().join(',') : '' }; },
};1`;
const cap = async (p, n) => { if (CAPS) { fs.mkdirSync(CAPS, { recursive: true }); await p.screenshot({ path: path.join(CAPS, n + '.png') }); } };
const CUENTA_E = `(() => { const R = (document.querySelector('.gmk .gmkRes') || {}).textContent || '', n = +((/^(\\d+)/.exec(R) || [0, -1])[1]), secc = [...document.querySelectorAll('.gmk .gmkSecc em')].map((e) => +e.textContent);
  const t = document.querySelector('.rbAviso.ve'), L = document.querySelector('.gmkLista'), a = t && t.getBoundingClientRect(), b = L && L.getBoundingClientRect();
  return { R, n, suma: secc.reduce((x, y) => x + y, 0), hecho: (document.querySelector('.gmk .gmkHecho') || {}).textContent || '', aviso: t ? t.textContent : '', tapa: !!(a && b && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right) }; })()`;
const abrirPanel = async (ev, p) => { await ev(`inicioMostrar(true); RB.t.tab = 'gmod'; RB.t.vista = 'instalados'; RB.t.carpeta = true; RB.t.ficha = null; inicioPanel('tienda'); 1`); await p.waitForTimeout(700); };

// ================= A. la app de Android =================
if (FASE('A')) {
const A = await contexto(false, true);
await A.abrir(''); await A.ev(AYUDAS);
const r0 = await esperar(A.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 60000), e0 = await A.ev(`({ ...GMK.ultRes, prefs: Object.keys(PREFS.gmod || {}).length })`);
await abrirPanel(A.ev, A.p); await cap(A.p, 'a0_panel_vacio');
const b0 = await A.ev(`[...document.querySelectorAll('.gmk [data-gmk]')].map((x) => x.dataset.gmk)`);
C('0. recién instalada: al abrir lee sola Android/data (vacía), no inventa nada y ofrece «Elegir carpeta» y «Volver a leer»', r0 >= 0 && e0.nuevos === 0 && e0.prefs === 0 && b0.includes('elegir') && b0.includes('leer'), { leida: r0 >= 0, nuevos: e0.nuevos, botones: b0 });
pegarAppData();
A.st.midiendo = true;
await A.p.click('.gmk [data-gmk=elegir]');
await esperar(A.ev, `!!(GMK.ultRes && GMK.ultRes.nuevos && !GMK.leyendo)`, 120000);
const r1 = await A.ev(`GMK.ultRes`);
A.st.midiendo = false;
const ids1 = await A.ev(`Object.keys(PREFS.gmod || {}).filter((x) => /^carpeta:/.test(x)).sort()`);
C('1. lee la carpeta elegida y Android/data: 7 addons nuevos (5 carpetas, 1 .gma suelto, 1 en Android/data), 1 que no es addon, sin errores', r1.nuevos === 7 && r1.errores === 0 && r1.vacios === 1 && ids1.length === 7 && Object.keys(ORIG).every((k) => ids1.includes(k)), { ...r1, ids: ids1 });
const nombres = await A.ev(`Object.fromEntries(Object.entries(PREFS.gmod).filter(([k]) => /^carpeta:/.test(k)).map(([k, x]) => [k.replace(/^carpeta:/, ''), x.n]))`);
C('1b. nombres: el del addon.json raro sin espacios, el de la carpeta si no hay addon.json, el del .gma suelto', nombres['c/addons/scp-096 nextbot'] === 'SCP 096 - Nextbot' && nombres['c/addons/kermit the frog'] === 'Kermit The Frog' && nombres['c/addons/popcorn_swep.gma'] === 'Popcorn SWEP' && nombres['c/addons/nyan_gun'] === 'Nyan Gun', nombres);
const luaListo = (ev, ids) => esperar(ev, `${JSON.stringify(ids)}.every((id) => { const A = GMOD.addons.get(id); return A && (A.luaCorridos !== undefined || !A.lua.length); })`, 90000);
const tLua = await luaListo(A.ev, Object.keys(ORIG));
const porCarpeta = A.st.fuera.filter((u) => /carpeta/.test(u)).length;
C('1c. sin internet: lee y monta los 7 (los pedidos a internet son sólo del contenido base que pide el montaje, el mismo que con un .gma, y no hacen falta)', porCarpeta === 0 && tLua >= 0, { leerMs: r1.ms, luaListoMs: tLua, pedidosCarpeta: A.st.lista + A.st.paquete, MBleidos: +(A.st.bytes / 1048576).toFixed(2), intentosInternet: A.st.fuera.length, ejemplos: [...new Set(A.st.fuera.map((u) => u.split('/')[0]))].slice(0, 4) });
await A.p.waitForTimeout(800); await cap(A.p, 'a1_panel_leido');
const CUENTA = `(() => { const R = (document.querySelector('.gmk .gmkRes') || {}).textContent || '', n = +((/^(\\d+)/.exec(R) || [0, -1])[1]), secc = [...document.querySelectorAll('.gmk .gmkSecc em')].map((e) => +e.textContent);
  const t = document.querySelector('.rbAviso.ve'), L = document.querySelector('.gmkLista'), a = t && t.getBoundingClientRect(), b = L && L.getBoundingClientRect();
  return { R, n, secc, suma: secc.reduce((x, y) => x + y, 0), hecho: (document.querySelector('.gmk .gmkHecho') || {}).textContent || '', aviso: t ? t.textContent : '', tapa: !!(a && b && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right) }; })()`;
const k1 = await A.ev(CUENTA);
C('1d. arriba el total es la suma de las secciones y dice cuántos de cada carpeta (7 = 6 + 1); el resultado se ve adentro del panel y ningún aviso tapa la lista', k1.n === 7 && k1.suma === 7 && /6 de tu carpeta/.test(k1.R) && /1 de Android\/data/.test(k1.R) && /7 nuevos/.test(k1.hecho) && !k1.tapa && !k1.aviso, k1);
const comp = [];
for (const [id, w] of Object.entries(ORIG)) comp.push(await A.ev(`__h.comparar(${JSON.stringify(id)}, '${w}')`));
C('2. cada addon montado tiene los mismos archivos que su .gma original, byte por byte (también el de mayúsculas mezcladas y el de addon.json raro; sin el .psd ni Thumbs.db)', comp.every((c) => !c.falta && c.n === c.nOrig && !c.sobran.length && !c.faltan.length && !c.distintos.length), comp.map((c) => `${c.id.replace('carpeta:', '')}: ${c.n}/${c.nOrig}${c.sobran.length ? ' sobran ' + c.sobran : ''}${c.faltan.length ? ' faltan ' + c.faltan : ''}${c.distintos.length ? ' distintos ' + c.distintos : ''}`));
const res1 = await A.ev(`Object.fromEntries(${JSON.stringify(Object.keys(ORIG))}.map((id) => [id, GMOD.addons.get(id) ? __h.resumen(GMOD.addons.get(id)) : null]))`);
// ---- B0: lo mismo instalando los .gma originales (otra pestaña, sin nada guardado) ----
const R = await contexto(false, false);
await R.abrir(''); await R.ev(AYUDAS);
const resO = {};
for (const [id, w] of Object.entries(ORIG)) {
  resO[id] = await R.ev(`(async () => { const u = new Uint8Array(await (await fetch('/gma_orig/${w}.gma')).arrayBuffer()); const A = await gmInstalar('${w}', { nombre: '${w}', sinDeps: true }, u); await A.listo; return 1; })()`);
}
await luaListo(R.ev, Object.values(ORIG));
for (const [id, w] of Object.entries(ORIG)) resO[id] = await R.ev(`__h.resumen(GMOD.addons.get('${w}'))`);
// (el «type» del addon.json —weapon, npc, model…— decide la etiqueta de su tarjeta: Kermit está desarmado sin addon.json, así que
// no se puede saber que el autor dijo «model»; todo lo demás tiene que ser igual)
const sinJson = (id) => /kermit/.test(id), sinTipo = (o) => { const x = { ...o }; delete x.tipo; return x; };
const dif = Object.keys(ORIG).filter((id) => JSON.stringify(sinJson(id) ? sinTipo(res1[id]) : res1[id]) !== JSON.stringify(sinJson(id) ? sinTipo(resO[id]) : resO[id]));
console.log('      (Kermit, sin addon.json: tarjeta «' + res1['carpeta:c/addons/kermit the frog'].tipo + '»; con el .gma, que dice type=model: «' + resO['carpeta:c/addons/kermit the frog'].tipo + '»)');
C('3. lo mismo que instalar el .gma: modelos, props del menú, armas, entidades, NPCs, vehículos, mapas, personajes, Lua y su sección en el menú', !dif.length, dif.length ? dif.map((id) => ({ id, carpeta: res1[id], gma: resO[id] })) : Object.fromEntries(Object.entries(res1).map(([k, v]) => [k.replace('carpeta:', ''), `${v.tipo} ${v.archivos} arch, ${v.menu} en el menú (${v.menuTipos}), ${v.armas} armas, ${v.npc} NPC, ${v.veh} veh, ${v.mapas} mapas, ${v.pms} pj, lua ${v.lua}/${v.luaErr} err`])));
await R.ctx.close();
// 4. volver a abrir
A.st.paquete = 0; A.st.bytes = 0; A.st.lista = 0;
const t4 = Date.now(); await A.abrir(''); await A.ev(AYUDAS);
const mont = await esperar(A.ev, `${JSON.stringify(Object.keys(ORIG))}.every((id) => GMOD.addons.has(id))`, 60000);
const lect = await esperar(A.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 60000);
const r4 = await A.ev(`GMK.ultRes`);
C('4. al volver a abrir: los 7 montados desde lo guardado y la relectura sola no copia nada (sólo la lista y los addon.json)', mont >= 0 && lect >= 0 && r4.iguales === 7 && r4.nuevos === 0 && r4.cambiados === 0 && A.st.bytes < 16384, { montadosEnMs: mont, relecturaMs: r4.ms, iguales: r4.iguales, pedidosLista: A.st.lista, pedidosPaquete: A.st.paquete, bytesPedidos: A.st.bytes, desdeAbrirMs: Date.now() - t4 });
// 5. cambia un addon (se agrega un archivo al Nyan Gun)
fs.writeFileSync(path.join(CARP, 'addons/nyan_gun/materials/prueba_cambio.vmt'), '"VertexLitGeneric" { "$basetexture" "models/weapons/v_nyan" }\n');
A.st.bytes = 0; A.st.paquete = 0;
const r5 = await A.ev(`gmkLeer({ toque: true })`);
await luaListo(A.ev, ['carpeta:c/addons/nyan_gun']);
const nyan = await A.ev(`({ tiene: GMOD.addons.get('carpeta:c/addons/nyan_gun').G.archivos.has('materials/prueba_cambio.vmt'), armas: (GMOD.addons.get('carpeta:c/addons/nyan_gun').sweps || []).length })`);
C('5. cambia un addon: sólo ése se vuelve a copiar y queda con el archivo nuevo', r5.cambiados === 1 && r5.nuevos === 0 && r5.iguales === 6 && nyan.tiene && nyan.armas === res1['carpeta:c/addons/nyan_gun'].armas && A.st.bytes < 1.3 * (5.6 * 1048576), { ...r5, ...nyan, MBpedidos: +(A.st.bytes / 1048576).toFixed(2) });
const msj5 = await A.ev(`gmkMsj()`);
fs.rmSync(path.join(CARP, 'addons/nyan_gun/materials/prueba_cambio.vmt'));
// 6. se borra una carpeta (se mueve afuera) y vuelve
fs.renameSync(path.join(CARP, 'addons/Destructible House'), path.join(TMP, 'Destructible House'));
const r6 = await A.ev(`gmkLeer({ toque: true })`);
const msj6 = await A.ev(`gmkMsj()`);
const casa = await A.ev(`(async () => ({ montado: GMOD.addons.has('carpeta:c/addons/destructible house'), lista: !!PREFS.gmod['carpeta:c/addons/destructible house'], guardado: !!(await gmCacheLeerSeguro('carpeta:c/addons/destructible house')), mapas: [...GBSP.mapas.values()].filter((m) => /destructible/.test(m.id)).length }))()`);
fs.renameSync(path.join(TMP, 'Destructible House'), path.join(CARP, 'addons/Destructible House'));
const r6b = await A.ev(`gmkLeer({ toque: true })`);
const msj6b = await A.ev(`gmkMsj()`);
const casa2 = await A.ev(`({ montado: GMOD.addons.has('carpeta:c/addons/destructible house'), mapas: [...GBSP.mapas.values()].filter((m) => /destructible/.test(m.id)).length })`);
C('6. se borra una carpeta: el addon se quita (del juego, de la lista, de lo guardado y su mapa); vuelve: se pone', r6.quitados === 1 && !casa.montado && !casa.lista && !casa.guardado && casa.mapas === 0 && r6b.nuevos === 1 && casa2.montado && casa2.mapas === 1, { r6: { quitados: r6.quitados, iguales: r6.iguales }, casa, r6b: { nuevos: r6b.nuevos }, casa2 });
C('6c. con uno, el resultado va en singular: «1 actualizado», «1 quitado», «1 nuevo»', /1 actualizado\b/.test(msj5) && !/actualizados/.test(msj5) && /1 quitado\b/.test(msj6) && !/quitados/.test(msj6) && /1 nuevo\b/.test(msj6b) && !/nuevos/.test(msj6b), { msj5, msj6, msj6b });
// 7. quitado a mano
await A.ev(`gmQuitar('carpeta:c/addons/popcorn_swep.gma'); 1`);
const r7 = await A.ev(`gmkLeer({ toque: true })`);
const pop = await A.ev(`({ montado: GMOD.addons.has('carpeta:c/addons/popcorn_swep.gma'), fila: (GMK.filas.find((f) => f.id === 'carpeta:c/addons/popcorn_swep.gma') || {}).estado })`);
await abrirPanel(A.ev, A.p); await cap(A.p, 'a2_panel_quitado');
const r7b = await A.ev(`gmkPonerOtraVez('carpeta:c/addons/popcorn_swep.gma')`);
const pop2 = await A.ev(`GMOD.addons.has('carpeta:c/addons/popcorn_swep.gma')`);
C('7. quitado a mano: no vuelve al releer (queda «Quitado» con «Volver a ponerlo»); al tocarlo se pone', r7.fuera === 1 && r7.nuevos === 0 && !pop.montado && pop.fila === 'quitado' && r7b.nuevos === 1 && pop2, { r7: { fuera: r7.fuera, nuevos: r7.nuevos }, pop, r7b: { nuevos: r7b.nuevos }, pop2 });
// 8. deshabilitado
await A.ev(`gmHabilitar('carpeta:c/addons/kermit the frog', false)`);
const r8 = await A.ev(`gmkLeer({ toque: true })`);
const ker = await A.ev(`({ montado: GMOD.addons.has('carpeta:c/addons/kermit the frog'), fila: (GMK.filas.find((f) => f.id === 'carpeta:c/addons/kermit the frog') || {}).estado })`);
await A.ev(`gmHabilitar('carpeta:c/addons/kermit the frog', true)`);
const ker2 = await esperar(A.ev, `GMOD.addons.has('carpeta:c/addons/kermit the frog')`, 20000);
C('8. deshabilitado: releer no lo copia ni lo monta («Deshabilitado»); habilitado vuelve desde lo guardado', !ker.montado && ker.fila === 'off' && r8.cambiados === 0 && r8.nuevos === 0 && ker2 >= 0, { ker, r8: { iguales: r8.iguales }, ker2 });
// 9. sin permiso
A.st.listaFalla = true;
const r9 = await A.ev(`gmkLeer({ toque: true })`); A.st.listaFalla = false;
const n9 = await A.ev(`Object.keys(PREFS.gmod).filter((x) => /^carpeta:c/.test(x)).length`);
C('9. si se perdió el permiso de la carpeta: no se quita nada de lo guardado', r9.quitados === 0 && n9 === 6, { quitados: r9.quitados, siguen: n9 });
// 10. olvidar
await abrirPanel(A.ev, A.p); await A.p.click('.gmk [data-gmk=olvidar]'); await A.p.waitForTimeout(300); await cap(A.p, 'a3_olvidar_pregunta');
await A.p.click('#cfDlg [data-cf=si]'); await A.p.waitForTimeout(800);
const r10 = await A.ev(`({ c: Object.keys(PREFS.gmod).filter((x) => /^carpeta:c/.test(x)).length, a: Object.keys(PREFS.gmod).filter((x) => /^carpeta:a/.test(x)).length, montadosC: [...GMOD.addons.keys()].filter((x) => /^carpeta:c/.test(x)).length, nat: window.__nat.olvidada })`);
C('10. «Olvidar carpeta» (con pregunta): se quitan los 6 de la elegida y queda el de Android/data', r10.c === 0 && r10.montadosC === 0 && r10.a === 1 && r10.nat === 1, r10);
await cap(A.p, 'a4_olvidada');
const k10 = await A.ev(CUENTA);
C('10b. con uno solo arriba dice «1 addon» (en singular) y coincide con su sección; «Olvidada» se dice adentro del panel', /^1 addon ·/.test(k10.R) && k10.suma === 1 && /olvidada/i.test(k10.hecho) && !k10.tapa, k10);
// (y elegir otra vez: el selector de la app avisa y se lee sola)
await A.p.click('.gmk [data-gmk=elegir]');
const r11 = await esperar(A.ev, `Object.keys(PREFS.gmod).filter((x) => /^carpeta:c/.test(x)).length === 6 && !GMK.leyendo`, 60000);
C('11. «Elegir carpeta» → lo que contesta el selector de la app → se lee sola y vuelven los 6', r11 >= 0, { ms: r11 });
await abrirPanel(A.ev, A.p); await A.p.waitForTimeout(500); await cap(A.p, 'a5_panel_compu');
// la ficha de uno y el menú de props
await A.p.click('.gmkFila [data-rb="ver:carpeta:c/addons/nyan_gun"]'); await A.p.waitForTimeout(700); await cap(A.p, 'a6_ficha');
const ficha = await A.ev(`({ aviso: !!document.querySelector('.rbFicha .gmAviso'), titulo: (document.querySelector('.rbFicha h3') || {}).textContent })`);
await A.p.click('.rbFicha [data-rb=fichaNo]'); await A.p.waitForTimeout(400);
const volvio = await A.ev(`!!document.querySelector('.gmk .gmkCaja')`);
C('12. «Ver» abre la ficha (con el aviso de que es de la carpeta) y «‹» vuelve a la carpeta', ficha.aviso && ficha.titulo === 'Nyan Gun' && volvio, { ...ficha, volvio });
// Ajustes → Carpeta de mods
await A.ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await A.p.waitForTimeout(6000);
await A.ev(`abrirAjustes(); 1`); await A.p.click('#ajustesCaja [data-aj=m]'); await A.p.waitForTimeout(500); await cap(A.p, 'a7_ajustes');
const aj = await A.ev(`({ filas: document.querySelectorAll('#ajustesCaja .gmkFila').length, botones: [...document.querySelectorAll('#ajustesCaja .gmk [data-gmk]')].map((x) => x.dataset.gmk) })`);
C('13. Ajustes → Carpeta de mods: la misma lista y los botones (volver a leer, cambiar, olvidar)', aj.filas >= 8 && ['leer', 'elegir', 'olvidar'].every((k) => aj.botones.includes(k)), aj);
await A.ev(`$('ajustes').classList.add('oc'); abrirSpawn ? abrirSpawn() : null; 1`).catch(() => {});
await A.ev(`(() => { const i = DATA.menu.findIndex((c) => c.n === 'GMod'); UI.tab = i; UI.abierto = 'spawn'; $('spawn').classList.remove('oc'); spawnTabs(); spawnDibujar(); return i; })()`).catch(() => {});
await A.p.waitForTimeout(2500); await cap(A.p, 'a8_menu_props');
await A.ctx.close();

}
// ================= B. la compu: el selector de carpetas del navegador (OPFS en la prueba) =================
if (FASE('B')) {
const W = await contexto(false, false, async (ctx) => {
  await ctx.route('**/carpeta_web/**', (r) => { const rel = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/carpeta_web\//, '')); return r.fulfill({ status: 200, body: fs.readFileSync(path.join(CARP, rel)) }); });
  await ctx.addInitScript(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('JXMOD');
    // (Chrome for Testing se cierra entero al sacar de IndexedDB una carpeta guardada —el Chrome de verdad no—: en la base
    // queda una marca y al leerla se devuelve la carpeta de OPFS, como devolvería el navegador la guardada)
    const put0 = IDBObjectStore.prototype.put, get0 = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.put = function (v, k) { if (v && typeof v === 'object' && v.kind === 'directory') { window.__guardoH = (window.__guardoH || 0) + 1; v = { __opfs: v.name }; } return put0.call(this, v, k); };
    navigator.storage.getDirectory().then((r) => r.getDirectoryHandle('JXMOD', { create: true })).then((h) => { window.__opfsJX = h; });
    IDBObjectStore.prototype.get = function (k) {
      const q = get0.call(this, k); if (this.name !== 'h') return q;
      return new Proxy(q, { get(t, p) { if (p === 'result') { const r = t.result; return r && r.__opfs ? window.__opfsJX : r; } const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, p, v) { t[p] = v; return true; } });
    };
  });
});
const BASE_GM = /gm_lib|gm_mapas|api\/gmod\/(base|cdn)|steamcontent/;
await W.abrir(''); await W.ev(AYUDAS);
const lista = []; (function ir(d, pre) { for (const n of fs.readdirSync(d)) { const f = path.join(d, n), r = pre ? pre + '/' + n : n; if (fs.statSync(f).isDirectory()) ir(f, r); else lista.push(r); } })(CARP, '');
await W.ev(`(async () => { const raiz = await navigator.storage.getDirectory(); try { await raiz.removeEntry('JXMOD', { recursive: true }); } catch (e) {} const R = await raiz.getDirectoryHandle('JXMOD', { create: true });
  for (const r of ${JSON.stringify(lista)}) { const p = r.split('/'); let d = R; for (const s of p.slice(0, -1)) d = await d.getDirectoryHandle(s, { create: true });
    const w = await (await d.getFileHandle(p[p.length - 1], { create: true })).createWritable(); await w.write(await (await fetch('/carpeta_web/' + r.split('/').map(encodeURIComponent).join('/'))).blob()); await w.close(); } return 1; })()`);
await abrirPanel(W.ev, W.p); await cap(W.p, 'b0_web_vacio');
W.st.midiendo = true;
await W.p.click('.gmk [data-gmk=elegir]');
const rb = await esperar(W.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 90000); W.st.midiendo = false;
const rB = await W.ev(`GMK.ultRes`);
const compB = []; for (const [id, w] of Object.entries(ORIG)) if (/^carpeta:c/.test(id)) compB.push(await W.ev(`__h.comparar(${JSON.stringify(id.replace('carpeta:c/', 'carpeta:c/'))}, '${w}')`));
const otros = W.st.fuera.filter((u) => !BASE_GM.test(u));
C('B1. compu: «Elegir carpeta de mods» (JXMOD) → 6 addons nuevos, iguales byte por byte a los .gma, sin internet (sólo el contenido base que pide cualquier montaje)', rb >= 0 && rB.nuevos === 6 && rB.errores === 0 && compB.every((c) => !c.falta && !c.sobran.length && !c.faltan.length && !c.distintos.length) && !otros.length, { nuevos: rB.nuevos, ms: rB.ms, comparados: compB.map((c) => c.id.replace('carpeta:', '') + ' ' + c.n + '/' + c.nOrig), otrosPedidos: otros, contenidoBase: W.st.fuera.length - otros.length, carpetaGuardada: await W.ev('window.__guardoH || 0') });
await W.p.waitForTimeout(500); await cap(W.p, 'b1_web_leida');
await W.abrir(''); await W.ev(AYUDAS);
const rb2 = await esperar(W.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 60000);
const rB2 = rb2 >= 0 ? await W.ev(`GMK.ultRes`) : null, montB = await W.ev(`[...GMOD.addons.keys()].filter((x) => /^carpeta:c/.test(x)).length`);
C('B2. compu: al volver a abrir, el permiso guardado deja releerla sola: 6 iguales, nada copiado', rB2 && rB2.iguales === 6 && rB2.nuevos + rB2.cambiados === 0 && montB === 6, { rB2: rB2 && { iguales: rB2.iguales, ms: rB2.ms }, montados: montB });
await W.ev(`(async () => { const R = await (await navigator.storage.getDirectory()).getDirectoryHandle('JXMOD'); const d = await (await (await R.getDirectoryHandle('addons')).getDirectoryHandle('Kermit The Frog')).getDirectoryHandle('Lua'); const w = await (await d.getFileHandle('nuevo_prueba.lua', { create: true })).createWritable(); await w.write('print(1)'); await w.close(); return 1; })()`);
await abrirPanel(W.ev, W.p); await W.p.click('.gmk [data-gmk=leer]');
await esperar(W.ev, `!!(GMK.ultRes && !GMK.leyendo && GMK.ultRes.cambiados)`, 60000);
const rB3 = await W.ev(`({ ...GMK.ultRes, tiene: GMOD.addons.get('carpeta:c/addons/kermit the frog').G.archivos.has('lua/nuevo_prueba.lua') })`);
C('B3. compu: se agrega un .lua (en Lua/, con mayúsculas) → «Volver a leer» copia sólo ese addon, con el archivo en minúsculas', rB3.cambiados === 1 && rB3.iguales === 5 && rB3.tiene, { cambiados: rB3.cambiados, iguales: rB3.iguales, tiene: rB3.tiene });
// (el seguro: si el navegador se cerró leyendo la carpeta guardada, al abrir no se vuelve a leer, se borra y se avisa)
await W.ev(`localStorage.setItem('jx_gmk_h', 'leyendo'); 1`);
await W.abrir(''); await W.ev(AYUDAS); await W.p.waitForTimeout(6000);
await abrirPanel(W.ev, W.p); await W.p.waitForTimeout(600); await cap(W.p, 'b2_web_seguro');
const rB4 = await W.ev(`({ nota: localStorage.getItem('jx_gmk_h'), h: GMK.h, leyo: !!GMK.ultRes, aviso: [...document.querySelectorAll('.gmkAviso')].map((x) => x.textContent).join(' | '), montados: [...GMOD.addons.keys()].filter((x) => /^carpeta:c/.test(x)).length })`);
C('B4. si el navegador se cerró leyendo la carpeta guardada: al abrir no la vuelve a leer, la borra, avisa, y los mods guardados siguen puestos', /^roto:/.test(rB4.nota) && rB4.h === null && !rB4.leyo && /cada vez|every time/.test(rB4.aviso) && rB4.montados === 6, { ...rB4, nota: String(rB4.nota).slice(0, 20) });
await W.ctx.close();

}
// ================= C. sin el selector de carpetas: <input webkitdirectory> =================
if (FASE('C')) {
const N = await contexto(false, false, async (ctx) => { await ctx.addInitScript(() => { delete window.showDirectoryPicker; }); });
await N.abrir(''); await N.ev(AYUDAS); await abrirPanel(N.ev, N.p); await cap(N.p, 'c0_sin_selector');
const [fc] = await Promise.all([N.p.waitForEvent('filechooser'), N.p.click('.gmk [data-gmk=elegirI]')]);
await fc.setFiles(CARP);
const rc = await esperar(N.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 90000);
const rC = await N.ev(`({ ...GMK.ultRes, ids: Object.keys(PREFS.gmod || {}).filter((x) => /^carpeta:i/.test(x)).sort() })`);
C('C. otro navegador: la carpeta elegida con <input webkitdirectory> se importa: 6 addons', rc >= 0 && rC.nuevos === 6 && rC.errores === 0, { nuevos: rC.nuevos, ids: rC.ids });
await N.ctx.close();

}
// ================= D. un .zip de la carpeta (el camino del iPhone) =================
if (FASE('D')) {
const ZIP = path.join(TMP, 'addons.zip');
execFileSync('python3', ['-I', '-c', `import zipfile,os,sys
b=sys.argv[1]; z=zipfile.ZipFile(sys.argv[2],'w')
for r,ds,fs in os.walk(os.path.join(b,'addons')):
  for f in sorted(fs):
    p=os.path.join(r,f); a=os.path.relpath(p,b); z.write(p,a,zipfile.ZIP_STORED if f.endswith('.gma') or f.endswith('.mp3') else zipfile.ZIP_DEFLATED)
z.writestr('__MACOSX/addons/._nyan_gun','basura'); z.writestr('addons/.DS_Store','basura'); z.close()`, CARP, ZIP]);
const Z = await contexto(true, false, async (ctx) => { await ctx.addInitScript(() => { delete window.showDirectoryPicker; }); await ctx.route('**/prueba.zip', (r) => r.fulfill({ status: 200, body: fs.readFileSync(ZIP) })); });
await Z.abrir(''); await Z.ev(AYUDAS); await abrirPanel(Z.ev, Z.p); await cap(Z.p, 'd0_celu_web');
const rD = await Z.ev(`(async () => { const f = new File([await (await fetch('/prueba.zip')).blob()], 'addons.zip', { type: 'application/zip' }); await gmkImportar([f], false); return GMK.ultRes; })()`);
const compD = []; for (const [id, w] of Object.entries(ORIG)) if (/^carpeta:c/.test(id)) compD.push(await Z.ev(`__h.comparar(${JSON.stringify(id.replace('carpeta:c/', 'carpeta:i/'))}, '${w}')`));
C('D. .zip de la carpeta (deflate y sin comprimir, con basura de Mac): 6 addons iguales byte por byte a los .gma', rD.nuevos === 6 && rD.errores === 0 && compD.every((c) => !c.falta && !c.sobran.length && !c.faltan.length && !c.distintos.length), { nuevos: rD.nuevos, ms: rD.ms, MBzip: +(fs.statSync(ZIP).size / 1048576).toFixed(1), comparados: compD.map((c) => c.id.replace('carpeta:', '') + ' ' + c.n + '/' + c.nOrig + (c.distintos.length ? ' DISTINTOS' : '')) });
await abrirPanel(Z.ev, Z.p); await Z.p.waitForTimeout(500); await cap(Z.p, 'd1_celu_zip');
// (el mismo .zip soltado sobre la pestaña GMod: ya está todo, no se copia nada de nuevo)
const rD2 = await Z.ev(`(async () => { const f = new File([await (await fetch('/prueba.zip')).blob()], 'addons.zip', { type: 'application/zip' }); const dt = new DataTransfer(); dt.items.add(f);
  const P = document.querySelector('.rbPan_tienda'); P.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); const marca = P.classList.contains('gmkArrastre');
  GMK.ultRes = null; P.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  for (let i = 0; i < 200 && !(GMK.ultRes && !GMK.leyendo); i++) await new Promise((r) => setTimeout(r, 100)); return { marca, ...GMK.ultRes }; })()`);
C('D2. el mismo .zip soltado sobre la pestaña: se marca la zona al arrastrar y no copia nada de nuevo (6 iguales)', rD2.marca && rD2.iguales === 6 && rD2.nuevos === 0, { marca: rD2.marca, iguales: rD2.iguales, nuevos: rD2.nuevos, ms: rD2.ms });
await Z.ctx.close();

}
// ================= E. el panel en el celular (la app) =================
if (FASE('E')) {
pegarAppData();
const E = await contexto(true, true);
await E.abrir(''); await esperar(E.ev, `!!(GMK.ultRes && !GMK.leyendo)`, 60000); await abrirPanel(E.ev, E.p); await E.p.waitForTimeout(400); await cap(E.p, 'e0_celu_app_inicio');
await E.p.click('.gmk [data-gmk=elegir]'); await esperar(E.ev, `!!(GMK.ultRes && GMK.ultRes.nuevos > 1 && !GMK.leyendo)`, 120000); await E.p.waitForTimeout(500); await cap(E.p, 'e1_celu_app_leido');
const kE = await E.ev(CUENTA_E);
C('E0. celular (la app): Android/data se leyó sola al abrir; al elegir JXMOD, el resultado se ve adentro del panel, ningún aviso tapa la lista y arriba 7 = 6 + 1, la suma de las secciones', !kE.tapa && !kE.aviso && /6 nuevos/.test(kE.hecho) && kE.n === kE.suma && kE.n === 7, kE);
const sing = {};
for (const [lang, bien1, mal1] of [['es', '1 archivo', /\b1 archivos\b/], ['en', '1 file', /\b1 files\b/], ['pt', '1 arquivo', /\b1 arquivos\b/]]) {
  sing[lang] = await E.ev(`(() => { PREFS.lang = '${lang}'; const G = document.querySelector('.rbTiendaG'); gmkPintar(G, 'tienda'); const f = [...G.querySelectorAll('.gmkFila')].find((x) => /destruct/i.test(x.textContent)); return f ? f.querySelector('small').textContent : ''; })()`);
  sing[lang] = { txt: sing[lang], ok: sing[lang].includes(bien1) && !mal1.test(sing[lang]) };
}
C('E1. «1 archivo» en singular (es, en, pt), no «1 archivos»', Object.values(sing).every((x) => x.ok), sing);
const largos = {};
for (const lang of ['de', 'ru', 'ar', 'fil']) {
  largos[lang] = await E.ev(`(() => { PREFS.lang = '${lang}'; if (typeof idiomaAplicar === 'function') try { idiomaAplicar('${lang}'); } catch (e) {} RB.t.carpeta = true; inicioPanel('tienda'); const P = document.querySelector('.rbPan_tienda'), G = P.querySelector('.tiDesliza'), C = P.querySelector('.gmkCaja');
    return { lista: G.scrollWidth > G.clientWidth + 1, caja: C.scrollWidth > C.clientWidth + 1, filas: [...P.querySelectorAll('.gmkFila')].filter((f) => f.scrollWidth > f.clientWidth + 1).length, botones: [...P.querySelectorAll('.gmkAcc button')].filter((b) => b.scrollWidth > b.clientWidth + 1).length, hecho: (P.querySelector('.gmkHecho') || {}).textContent || '' }; })()`);
  if (lang === 'ru') await cap(E.p, 'e3_celu_ru');
}
C('E2. celular en alemán, ruso, árabe y filipino: nada se sale (caja, lista, filas ni botones) y el resultado de la lectura cambia de idioma con el juego', Object.values(largos).every((x) => !x.lista && !x.caja && !x.filas && !x.botones && x.hecho && !/nuevos/.test(x.hecho)) && /новых: 6/.test(largos.ru.hecho) && /6 neu/.test(largos.de.hecho), largos);
await E.ev(`idiomaAplicar('es'); RB.t.carpeta = true; inicioPanel('tienda'); 1`);
const ancho = await E.ev(`(() => { const P = document.querySelector('.rbPan_tienda'), G = P.querySelector('.tiDesliza'); return { desborda: G.scrollWidth > G.clientWidth + 1, cab: P.querySelector('.tiCab').scrollWidth > P.querySelector('.tiCab').clientWidth + 1, filas: [...P.querySelectorAll('.gmkFila')].filter((f) => f.scrollWidth > f.clientWidth + 1).length }; })()`);
C('E. celular: nada se sale del panel (ni la cabecera, ni la lista, ni las filas)', !ancho.desborda && !ancho.cab && ancho.filas === 0, ancho);
await E.p.evaluate(() => { const d = document.querySelector('.gmk details.gmkAyuda'); if (d) d.open = true; d && d.scrollIntoView(); }); await E.p.waitForTimeout(300); await cap(E.p, 'e2_celu_ayuda');
// Ajustes en el celular, jugando: las cinco pestañas se pueden tocar (la de la carpeta quedaba debajo del pie)
await E.ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await E.p.waitForTimeout(6000);
await E.ev(`abrirAjustes(); 1`); await E.p.waitForTimeout(400);
const tabsE = await E.ev(`[...document.querySelectorAll('#ajustesCaja .ajTabs button')].map((b) => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [b.dataset.aj, !!e && b.contains(e)]; })`);
// (el juego en el celular emulado va a 1-2 cuadros por segundo: Playwright tarda de 6 a 9 s en tocar)
let tocoE = true; try { await E.p.click('#ajustesCaja [data-aj=m]', { timeout: 40000 }); } catch (e) { tocoE = false; }
await E.p.waitForTimeout(500); await cap(E.p, 'e4_celu_ajustes');
const ajE = await E.ev(`({ visible: !document.querySelector('[data-ajs=m]').classList.contains('oc'), filas: document.querySelectorAll('#ajustesCaja .gmkFila').length, sale: [...document.querySelectorAll('#ajustesCaja .gmk button')].filter((x) => x.scrollWidth > x.clientWidth + 1).length })`);
C('E3. celular, jugando: en Ajustes las 5 pestañas se pueden tocar (también «Carpeta de mods», que quedaba debajo del pie) y su lista entra', tocoE && tabsE.length === 5 && tabsE.every((x) => x[1]) && ajE.visible && ajE.filas >= 7 && !ajE.sale, { toco: tocoE, tabs: tabsE, ...ajE });
await E.ctx.close();

}
C('sin errores de JS', !errJS.length, errJS.slice(0, 5));
console.log(`\n${bien}/${tot} bien`);
await b.close(); java.kill(); fs.rmSync(TMP, { recursive: true, force: true });
process.exit(bien === tot ? 0 : 1);
