// Mods sin la tienda (Discord, noviembre de 2026: «no puedo instalar ningún mod» —Failed to fetch · DrGBase—, «no deja
// MUCHOS mods», «No deja instalar varios nextbots», «le doy a jugar y no me deja»). La tienda devuelve su corte (429
// «error code: 1027», sin permiso de otro sitio: el navegador lo ve como «sin red») y el puente público también (429).
// En la app (simulada: el juego servido desde appassets.androidplatform.net con JXNativo.red() = 2; /red/_steam… lo
// contesta SteamPipe.java —el mismo código del APK— con apk/pruebas/unido/ServidorSteamPipe.java, y /red/<sitio> con las
// reglas de Red.java) y en la web:
//  1. app: DrGBase (1560118657, sin archivo directo: SteamPipe) se instala sin la tienda;
//  2. app: un nextbot 3D (Eric Cartman Nextbot, 2844252208, también sin archivo directo) se instala sin la tienda;
//  3. app: Jugar (menú → Nueva partida → Empezar, con la pantalla de carga) entra a la partida en < 40 s;
//  4. web: el mismo DrGBase avisa algo que se entiende (gm.sinRed), no «Failed to fetch»;
//  5. web: Jugar entra a la partida en < 40 s;
//  6. sin errores de JS.
// uso: node mods_sin_tienda.mjs URL_HTML (de /tmp/claude-0/srv, servido en 127.0.0.1); CLASES=dir de ServidorSteamPipe
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFile, spawn } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML] = process.argv; const DIR = '/tmp/claude-0/srv', CLASES = process.env.CLASES || '/tmp/claude-0/sp_srv', PUERTO = 8981;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const errs = [];
// (las reglas de Red.java: sitio permitido y ruta sin trucos; YouTube, sólo /results)
const SITIOS = /^(?:[a-z0-9-]+\.steamcontent\.com|[a-z0-9-]+\.api\.radio-browser\.info|www\.youtube\.com)$/;
function destino(p, q) {
  if (!p.startsWith('/red/')) return null; const resto = p.slice(5), i = resto.indexOf('/'); if (i <= 0) return null;
  const sitio = resto.slice(0, i).toLowerCase(), ruta = resto.slice(i), r = ruta.toLowerCase();
  if (!SITIOS.test(sitio) || /\.\.|%2e|%2f|@|\\/.test(r)) return null; if (sitio === 'www.youtube.com' && ruta !== '/results') return null;
  return 'https://' + sitio + ruta + (q ? '?' + q : '');
}
const curl = (url) => new Promise((res) => {
  execFile('curl', ['-s', '-m', '40', '-D', '-', '-o', '-', '-A', 'JXMod/3.0 (Android)', url], { encoding: 'buffer', maxBuffer: 64 << 20 }, (e, out) => {
    if (!out || !out.length) return res({ st: 502, body: Buffer.alloc(0), ct: 'text/plain' });
    let s = out, st = 502, ct = 'application/octet-stream';
    for (;;) { const j = s.indexOf('\r\n\r\n'); if (j < 0) break; const cab = s.slice(0, j).toString('latin1'); if (!/^HTTP\//.test(cab)) break; st = +cab.split(' ')[1] || 502; const m = /^content-type:\s*(.+)$/im.exec(cab); if (m) ct = m[1].trim(); s = s.slice(j + 4); if (!/^HTTP\//.test(s.slice(0, 5).toString('latin1'))) break; }
    res({ st, body: s, ct });
  });
});
// el servidor de Java con SteamPipe (lo que contesta la app)
const jv = spawn('java', ['-Dstdout.encoding=UTF-8', '-cp', CLASES, 'ServidorSteamPipe', String(PUERTO)], { stdio: ['ignore', 'pipe', 'pipe'] });
const jlog = []; jv.stdout.on('data', (d) => jlog.push(...String(d).trim().split('\n'))); jv.stderr.on('data', (d) => { const s = String(d); if (!/Picked up/.test(s)) jlog.push('ERR ' + s.trim()); });
for (let i = 0; i < 100 && !jlog.includes('listo'); i++) await new Promise((r) => setTimeout(r, 100));
if (!jlog.includes('listo')) { console.log('el servidor de Java no arrancó', jlog); process.exit(2); }

async function correr(app) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const cuenta = { tienda: [], red: [], redSt: [], steam: [], puente: 0 };
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  // la tienda con el corte de Cloudflare, y el puente público también caído
  await ctx.route(/rezobox-tienda\.[^/]+\.workers\.dev\/api\/(?!cuenta\/config)/, (r) => { cuenta.tienda.push(r.request().url().replace(/^.*\/api\//, '').slice(0, 60)); return r.fulfill({ status: 429, contentType: 'text/plain; charset=UTF-8', body: 'error code: 1027' }); });
  await ctx.route(/^https:\/\/(cors\.eu\.org|r\.jina\.ai)\//, (r) => { cuenta.puente++; return r.fulfill({ status: 429, contentType: 'text/html', body: 'Too Many Requests' }); });
  let url = HTML;
  if (app) {
    url = 'https://appassets.androidplatform.net/index.html';
    await ctx.route('https://appassets.androidplatform.net/**', async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith('/red/_steam')) {
        cuenta.steam.push(u.pathname.slice(5, 60));
        try { const x = await fetch('http://127.0.0.1:' + PUERTO + u.pathname); return r.fulfill({ status: x.status, contentType: 'application/json', body: Buffer.from(await x.arrayBuffer()) }); }
        catch (e) { return r.fulfill({ status: 502, body: '' }); }
      }
      if (u.pathname.startsWith('/red/')) {
        const d = r.request().method() === 'GET' ? destino(u.pathname, u.search.slice(1)) : null; cuenta.red.push(u.pathname.slice(0, 70));
        if (!d) return r.fulfill({ status: 403, body: '' });
        const x = await curl(d); cuenta.redSt.push(u.pathname.slice(5, 60).replace(/[0-9a-f]{40}$/, 'SHA') + ' → ' + x.st); return r.fulfill({ status: x.st, contentType: x.ct, body: x.body });
      }
      const f = u.pathname === '/' || u.pathname === '/index.html' ? path.join(DIR, path.basename(new URL(HTML).pathname)) : path.join(DIR, decodeURIComponent(u.pathname));
      if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await ctx.addInitScript(() => { window.JXNativo = new Proxy({}, { get: (o, k) => (k === 'red' ? () => 2 : k === 'registroNativo' ? () => '' : () => {}) }); });
  }
  // (con la pantalla de carga de verdad, como al tocar Jugar)
  await ctx.addInitScript(() => { window.__cargaPrueba = true; });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push((app ? 'app: ' : 'web: ') + e.message.slice(0, 160)));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  const o = { modo: app ? 'app' : 'web' };
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(true); 1`);
  o.redNivel = await ev(`redNivel()`);
  // 1, 2 y 4: instalar con la cola, como el botón Instalar
  const instalar = async (id, nom) => {
    const t0 = Date.now(), s0 = cuenta.steam.length, t1 = cuenta.tienda.length;
    const r = await ev(`gmcPoner('${id}', { nombre: '${nom}' }).then((A) => ({ ok: true, nombre: A && A.nombre, archivos: A && A.G ? A.G.archivos.size + (A.G.perezosos ? A.G.perezosos.size : 0) : 0 }), (e) => ({ ok: false, err: String((e && e.message) || e) }))`);
    return Object.assign(r, { s: +((Date.now() - t0) / 1000).toFixed(1), steam: cuenta.steam.slice(s0), tienda: cuenta.tienda.length - t1, red: cuenta.redSt.splice(0).slice(-6) });
  };
  o.drg = await instalar('1560118657', 'DrGBase');
  if (app) o.cartman = await instalar('2844252208', 'Eric Cartman Nextbot');
  // (uno con archivo directo que no está en el catálogo: en la app, sin la tienda, por los detalles de Steam)
  if (app) o.directo = await instalar('1509872044', 'Eric Cartman');
  if (app) o.directoEnCat = await ev(`gmCatalogo().then((C) => !!(C && C.porId.get('1509872044')))`);
  if (app) o.noExiste = await instalar('999999999999', 'no existe');
  o.sinRed = await ev(`T('gm.sinRed')`);
  o.errRed = await ev(`[gmErrRed(new TypeError('Failed to fetch')).message, gmErrRed(new TypeError('Load failed')).message, gmErrRed(new Error('otra cosa')).message]`);
  // 3 y 5: Jugar desde el menú, con la pantalla de carga
  await ev(`(() => { const b = document.querySelector('.ptHome [data-rb="nueva"]'); b.click(); return 1; })()`);   // (el mapa elegido de la portada: abre Empezar partida nueva)
  await p.waitForSelector('[data-rb="empezar"]', { timeout: 15000 });
  const tj = Date.now();
  await p.click('[data-rb="empezar"]');
  const entro = await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo && window.__carga && window.__carga.listo`), null, { timeout: 40000 }).then(() => true, () => false);
  o.jugar = { entro, s: +((Date.now() - tj) / 1000).toFixed(1), carga: await ev(`({ paso: __carga.paso, p: __carga.p, err: __carga.err })`) };
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/jugar_' + o.modo + '.png' });
  await b.close();
  return o;
}
let A = null, W = null;
try { A = await correr(true); W = await correr(false); } finally { jv.kill(); }
ok('1. app: DrGBase (sin archivo directo) se instala sin la tienda', A.redNivel === 2 && A.drg.ok && A.drg.tienda === 0 && A.drg.steam.some((x) => x.startsWith('_steampipe/1560118657')), A.drg);
ok('2. app: el nextbot de Cartman (sin archivo directo) se instala sin la tienda', A.cartman.ok && A.cartman.tienda === 0 && A.cartman.steam.some((x) => x.startsWith('_steampipe/2844252208')), A.cartman);
ok('2b. app: uno con archivo directo que no está en el catálogo (Eric Cartman) se baja de Steam sin la tienda', A.directo.ok && A.directo.tienda === 0 && (A.directoEnCat || A.directo.steam.some((x) => x.startsWith('_steamdet/1509872044'))), Object.assign({ enCatalogo: A.directoEnCat }, A.directo));
ok('2c. app: uno que no existe avisa «No existe en el Workshop» sin la tienda', !A.noExiste.ok && /Workshop/.test(A.noExiste.err) && A.noExiste.tienda === 0, A.noExiste);
ok('3. app: Jugar entra a la partida (< 40 s) con la tienda caída', A.jugar.entro, A.jugar);
ok('4. web: sin tienda ni puente, DrGBase avisa «' + (W && W.sinRed) + '» (no «Failed to fetch» ni «Steam: 429»)', W.redNivel === 0 && !W.drg.ok && W.drg.err === W.sinRed && W.errRed[0] === W.sinRed && W.errRed[1] === W.sinRed && W.errRed[2] === 'otra cosa', { drg: W.drg, errRed: W.errRed });
ok('5. web: Jugar entra a la partida (< 40 s) con la tienda caída', W.jugar.entro, W.jugar);
ok('6. sin errores de JS', !errs.length, errs.slice(0, 4));
console.log('Java (últimas):', jlog.slice(-8).join(' | '));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
