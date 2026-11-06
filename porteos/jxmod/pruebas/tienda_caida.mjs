// La tienda caída (Discord, noviembre de 2026: «no me entra la tienda», «la tele tampoco anda»: el servidor de la tienda
// —un Worker de Cloudflare con el plan gratis— contestaba «error code: 1027», el tope de pedidos por día). Con la tienda
// devolviendo ese corte (429 en texto, sin permiso de otro sitio: el navegador lo ve como «sin red»), en la app (simulada:
// el juego servido desde appassets.androidplatform.net con JXNativo, y /red/ resuelto con las mismas reglas que Web.java
// —Red.java—) y en la web:
//  1. app: la tele busca «música para jugar» y trae ≥ 5 videos sin pedirle nada a la tienda;
//  2. app y web: pegar un link de YouTube lo pone en la lista con su título de verdad (oEmbed), sin la tienda;
//  3. app y web: la radio encuentra emisoras (Radio Browser directo), sin la tienda;
//  4. web: la tele sin la tienda avisa que no pudo conectar (o que el servidor está saturado), no «No hay resultados»;
//  5. lo que se pide solo (el latido de lo social) deja de ir a la tienda después de 3 fallas: de 20 seguidos llegan ≤ 3;
//     lo que pide la persona (abrir la lista de la tienda) sí sale;
//  6. app: los pedazos de Steam van por /red/ (y si fallan, por la tienda); web: por la tienda;
//  7. sin errores de JS.
// uso: node tienda_caida.mjs URL_HTML (de /tmp/claude-0/srv, servido en 127.0.0.1)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFile } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML] = process.argv; const DIR = '/tmp/claude-0/srv';
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const errs = [];
// (las reglas de Red.java: sitio permitido y ruta sin trucos; YouTube, sólo /results)
const SITIOS = /^(?:[a-z0-9-]+\.steamcontent\.com|[a-z0-9-]+\.api\.radio-browser\.info|www\.youtube\.com)$/;
function destino(p, q) {
  if (!p.startsWith('/red/')) return null; const resto = p.slice(5), i = resto.indexOf('/'); if (i <= 0) return null;
  const sitio = resto.slice(0, i).toLowerCase(), ruta = resto.slice(i), r = ruta.toLowerCase();
  if (!SITIOS.test(sitio) || /\.\.|%2e|%2f|@|\\/.test(r)) return null; if (sitio === 'www.youtube.com' && ruta !== '/results') return null;
  return 'https://' + sitio + ruta + (q ? '?' + q : '');
}
const curl = (url, yt) => new Promise((res) => {
  const a = ['-s', '-m', '25', '-D', '-', '-o', '-', '--compressed', '-A', yt ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' : 'JXMod/3.0 (Android)'];
  if (yt) a.push('-H', 'Accept-Language: es-419,es;q=0.9,en;q=0.8', '-H', 'Cookie: CONSENT=YES+1; SOCS=CAI');
  execFile('curl', [...a, url], { encoding: 'buffer', maxBuffer: 64 << 20 }, (e, out) => {
    if (!out || !out.length) return res({ st: 502, body: Buffer.alloc(0), ct: 'text/plain' });
    // (la última cabecera: con redirecciones hay varias)
    let s = out, st = 502, ct = 'application/octet-stream';
    for (;;) { const j = s.indexOf('\r\n\r\n'); if (j < 0) break; const cab = s.slice(0, j).toString('latin1'); if (!/^HTTP\//.test(cab)) break; st = +cab.split(' ')[1] || 502; const m = /^content-type:\s*(.+)$/im.exec(cab); if (m) ct = m[1].trim(); s = s.slice(j + 4); if (!/^HTTP\//.test(s.slice(0, 5).toString('latin1'))) break; }
    res({ st, body: s, ct });
  });
});
async function correr(app) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cuenta = { tienda: [], red: [] };
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  // la tienda con el corte de Cloudflare
  await ctx.route(/rezobox-tienda\.[^/]+\.workers\.dev\/api\/(?!cuenta\/config)/, (r) => { cuenta.tienda.push(r.request().url().replace(/^.*\/api\//, '').slice(0, 60)); return r.fulfill({ status: 429, contentType: 'text/plain; charset=UTF-8', body: 'error code: 1027' }); });
  let url = HTML;
  if (app) {
    url = 'https://appassets.androidplatform.net/index.html';
    await ctx.route('https://appassets.androidplatform.net/**', async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith('/red/')) {
        const d = r.request().method() === 'GET' ? destino(u.pathname, u.search.slice(1)) : null; cuenta.red.push(u.pathname.slice(0, 70));
        if (!d) return r.fulfill({ status: 403, body: '' });
        const x = await curl(d, d.startsWith('https://www.youtube.com/')); return r.fulfill({ status: x.st, contentType: x.ct, body: x.body });
      }
      const f = u.pathname === '/' || u.pathname === '/index.html' ? path.join(DIR, path.basename(new URL(HTML).pathname)) : path.join(DIR, decodeURIComponent(u.pathname));
      if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await ctx.addInitScript(() => { window.JXNativo = new Proxy({}, { get: (o, k) => (k === 'red' ? () => 1 : k === 'registroNativo' ? () => '' : () => {}) }); });
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push((app ? 'app: ' : 'web: ') + e.message.slice(0, 160)));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(1500);
  const o = { modo: app ? 'app' : 'web' };
  o.redApp = await ev(`redApp()`);
  // 1 y 4: la tele (se abre y busca sola «música para jugar»)
  const t0 = cuenta.tienda.length;
  await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); window.__tele = entidadCrear({ t: 'pantalla', p: [JUG.pos.x + f.x * 4, JUG.pos.y - 0.9, JUG.pos.z + f.z * 4], yaw: JUG.yaw + Math.PI }); radioAbrir(__tele); return 1; })()`);
  await p.waitForFunction(() => window.__ev(`RADIO.n > 0 && !RADIO.cargando`), null, { timeout: 60000 }).catch(() => {});
  o.tele = await ev(`({ n: RADIO.res.length, ej: RADIO.res.slice(0, 2).map((x) => x.t.slice(0, 40)), vacio: (document.querySelector('#radioRes .radioVacio') || {}).textContent || '' })`);
  o.tele.tienda = cuenta.tienda.length - t0;
  // 2: un link pegado
  const t1 = cuenta.tienda.length;
  await ev(`(() => { $('radioQ').value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; radioBuscar($('radioQ').value, ''); return 1; })()`);
  await p.waitForFunction(() => window.__ev(`!RADIO.cargando`), null, { timeout: 30000 }).catch(() => {});
  o.link = await ev(`({ n: RADIO.res.length, id: RADIO.res[0] && RADIO.res[0].id, t: RADIO.res[0] && RADIO.res[0].t.slice(0, 50) })`); o.link.tienda = cuenta.tienda.length - t1;
  await ev(`cerrarPaneles(); 1`);
  // 3: la radio, emisoras
  const t2 = cuenta.tienda.length;
  await ev(`(() => { window.__radio = entidadCrear({ t: 'radio', p: [JUG.pos.x + 1.5, JUG.pos.y - 0.9, JUG.pos.z + 1.5], yaw: 0 }); radioAbrir(__radio); if (RADIO.modo !== 'est') radioModo('est'); radioBuscar('rock', ''); return 1; })()`);
  await p.waitForFunction(() => window.__ev(`!RADIO.cargando`), null, { timeout: 40000 }).catch(() => {});
  o.radio = await ev(`({ modo: RADIO.modo, n: RADIO.res.length, ej: RADIO.res.slice(0, 2).map((x) => x.t) })`); o.radio.tienda = cuenta.tienda.length - t2;
  await ev(`cerrarPaneles(); 1`);
  // 5: el freno: 20 latidos seguidos y después algo que pide la persona
  const t3 = cuenta.tienda.length;
  await ev(`(async () => { for (let i = 0; i < 20; i++) await fetch(TIENDA_URL + 'social/latido', { method: 'POST' }).catch(() => {}); return 1; })()`);
  const lat = cuenta.tienda.slice(t3).filter((x) => /latido/.test(x)).length;
  await ev(`fetch(TIENDA_URL + 'lista?tipo=mod&q=&orden=pop&p=0').catch(() => {}); 1`); await p.waitForTimeout(800);
  o.freno = { latidosQueLlegaron: lat, frenada: await ev(`tiendaFrenada()`), personaSale: cuenta.tienda.slice(t3).some((x) => /^lista/.test(x)) };
  // 6: un pedazo de Steam (uno que no existe: se ve por dónde va)
  const t4 = cuenta.tienda.length, r4 = cuenta.red.length;
  await ev(`gpPedirCDN(TIENDA_URL, ['cache1-lax1.steamcontent.com'], '/depot/4000/chunk/0000000000000000000000000000000000000000').catch(() => {}).then(() => 1)`);
  o.steam = { red: cuenta.red.length - r4, tienda: cuenta.tienda.slice(t4).filter((x) => /gmod\/cdn/.test(x)).length };
  o.vacioSat = await ev(`[T('tienda.sat'), T('errRed')]`);
  await b.close();
  return o;
}
const A = await correr(true), W = await correr(false);
ok('1. app: la tele busca «música para jugar» y trae ≥ 5 videos sin la tienda', A.redApp && A.tele.n >= 5 && A.tele.tienda === 0, A.tele);
ok('2. app y web: un link de YouTube pegado se pone con su título, sin la tienda', [A, W].every((x) => x.link.n === 1 && x.link.id === 'dQw4w9WgXcQ' && /Rick Astley/i.test(x.link.t || '') && x.link.tienda === 0), { app: A.link, web: W.link });
ok('3. app y web: la radio encuentra emisoras sin la tienda', [A, W].every((x) => x.radio.n >= 3 && x.radio.tienda === 0), { app: A.radio, web: W.radio });
ok('4. web: la tele sin la tienda avisa que no pudo conectar o que está saturada (no «No hay resultados»)', !W.redApp && W.tele.n === 0 && W.vacioSat.includes(W.tele.vacio), W.tele);
ok('5. el latido deja de ir a la tienda tras 3 fallas (de 20, ≤ 3) y lo que pide la persona sale', [A, W].every((x) => x.freno.latidosQueLlegaron <= 3 && x.freno.frenada && x.freno.personaSale), { app: A.freno, web: W.freno });
ok('6. app: los pedazos de Steam van por /red/ (2) y después por la tienda; web: por la tienda', A.steam.red === 2 && A.steam.tienda === 2 && W.steam.red === 0 && W.steam.tienda >= 1, { app: A.steam, web: W.steam });
ok('7. sin errores de JS', !errs.length, errs.slice(0, 4));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
