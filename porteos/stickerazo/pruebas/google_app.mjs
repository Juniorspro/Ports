// Entrar con Google desde la app (en el navegador, como en el celular pero con la página en otra pestaña): el botón, la
// pestaña de Google (acá la «confirma» la prueba con un token firmado con la llave de prueba), elegir el @ y quedar
// adentro; y una cuenta vieja (sólo @) que ve el aviso para conectar Google. Saca capturas en SALIDA.
// uso: node google_app.mjs [SALIDA=/tmp/claude-0/sz_google]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import crypto from 'crypto';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
import { arrancar } from './servidor_local.mjs';
const SAL = process.argv[2] || '/tmp/claude-0/sz_google'; fs.mkdirSync(SAL, { recursive: true });
const WEB = new URL('../web/', import.meta.url).pathname, PW = 8996, PC = 8999, API = `http://127.0.0.1:${PC}`, CLIENTE = 'prueba-stickerazo.apps.googleusercontent.com';
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PW);
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { srv, env: ENV } = await arrancar(PC, 'clave-admin', { SZ_GOOGLE_CLIENT_ID: CLIENTE, SZ_JWKS_PRUEBA: JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' }] }) });
const b64u = (b) => Buffer.from(b).toString('base64url'), ahora = () => Math.floor(Date.now() / 1000);
const token = (d) => { const c = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' })), u = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENTE, iat: ahora(), exp: ahora() + 3600, ...d })); return `${c}.${u}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(c + '.' + u), privateKey))}`; };
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
const z = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const errores = [];
async function celular(cuenta) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/^INFO:|api\/yt|status of 40[13]/.test(m.text())) errores.push(m.text().slice(0, 200)); });
  await p.addInitScript(([u, c]) => { window.SZ_API = u; localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); if (c) localStorage.setItem('sz_cuenta', c); }, [API, cuenta || '']);
  await p.goto(`http://127.0.0.1:${PW}/index.html`); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
  return { ctx, p };
}
// 1) cuenta nueva con Google
{
  const { ctx, p } = await celular();
  await p.tap('#tabs [data-t="Perfil"]'); await p.waitForSelector('#gEntrar'); await z(500);
  ok(await p.isVisible('#gEntrar') && !(await p.$('#regNombre')), 'sin cuenta: el perfil ofrece «Entrar con Google» (y no el @ suelto)');
  await p.screenshot({ path: `${SAL}/1_entrar.png` });
  const [pest] = await Promise.all([ctx.waitForEvent('page'), p.tap('#gEntrar')]);
  const e = new URL(pest.url()).searchParams.get('e');
  ok(/\/entrar\?e=[a-f0-9]{64}$/.test(pest.url()) && e === (await p.evaluate(() => window.__szEntrando)), 'abre la página de Google en otra pestaña (en el celu: el navegador) con su e');
  await pest.close(); await p.waitForSelector('.esperaG'); await z(400); await p.screenshot({ path: `${SAL}/2_esperando.png` });
  // (lo que hace Google + la página: manda el token con e como nonce)
  const r = await fetch(`${API}/api/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credencial: token({ sub: 'google-ui', nonce: e }), e }) });
  ok(r.ok, 'Google confirma la cuenta');
  await p.waitForSelector('#regNombre', { timeout: 8000 }); await z(400);
  ok(/Elegí tu @/.test(await p.textContent('#tabPerfil')), 'la app se da cuenta sola y, como la cuenta es nueva, pide elegir el @');
  await p.fill('#regNombre', 'la.ui'); await p.screenshot({ path: `${SAL}/3_elegir.png` });
  await p.tap('#regEntrar'); await p.waitForSelector('#tabPerfil .arroba', { timeout: 10000 }); await z(1200);
  const c = await p.evaluate(() => JSON.parse(localStorage.sz_cuenta));
  ok(c.nombre === 'la.ui' && c.google === true && /la\.ui/.test(await p.textContent('#tabPerfil .arroba')), 'adentro como @la.ui, con Google');
  await p.screenshot({ path: `${SAL}/4_adentro.png` });
  await ctx.close();
}
// 2) una cuenta vieja (sólo @): el aviso para conectar Google
{
  const llave = 'llave-de-una-cuenta-vieja-1234', id = 'viejaui001', T = process.env.SZ_BASE ? 'sz_' : '';
  await ENV.DB.prepare(`INSERT INTO ${T}usuarios (id, nombre, clave, avatar, creado) VALUES (?, ?, ?, ?, ?)`).bind(id, 'el.viejo', crypto.createHash('sha256').update(llave).digest('hex'), '{}', Date.now()).run();
  const { ctx, p } = await celular(JSON.stringify({ token: `${id}.${llave}`, id, nombre: 'el.viejo' }));
  await p.tap('#tabs [data-t="Perfil"]'); await p.waitForSelector('#tarjG', { timeout: 10000 }); await z(800);
  ok(await p.isVisible('#tarjG'), 'una cuenta vieja ve en su perfil «Conectá tu cuenta de Google»');
  await p.screenshot({ path: `${SAL}/5_vieja.png` });
  // (si intenta algo que escribe, el servidor dice que falta Google y la app muestra la hoja)
  await p.evaluate(async () => { const C = await import('/comunidad.js'); try { await C.api('/api/yo', { method: 'PATCH', json: { bio: 'x' } }); } catch (e) { /* esperado */ } });
  await p.waitForSelector('#modal .pideG', { timeout: 5000 }); await z(500);
  ok(await p.isVisible('#modal .pideG'), 'si intenta escribir algo, aparece la hoja para conectar Google');
  await p.screenshot({ path: `${SAL}/6_pide.png` });
  await ctx.close();
}
// 3) tus packs en tu cuenta: el celular A guarda un pack; en el celular B (como si borraras la app) vuelve al entrar
{
  async function entrarGoogle(p, ctx, sub, nombre) {
    await p.tap('#tabs [data-t="Perfil"]'); await p.waitForSelector('#gEntrar');
    const [pest] = await Promise.all([ctx.waitForEvent('page'), p.tap('#gEntrar')]);
    const e = new URL(pest.url()).searchParams.get('e'); await pest.close();
    await fetch(`${API}/api/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credencial: token({ sub, nonce: e }), e }) });
    if (nombre) { await p.waitForSelector('#regNombre', { timeout: 8000 }); await p.fill('#regNombre', nombre); await p.tap('#regEntrar'); }
    await p.waitForSelector('#tabPerfil .arroba', { timeout: 10000 });
  }
  const A = await celular(); await entrarGoogle(A.p, A.ctx, 'google-nube-ui', 'la.nube');
  // (un pack hecho en el celular A: dos stickers y su bandeja, guardados como los guarda la app)
  await A.p.evaluate(async () => {
    const P = await import('/puente.js');
    const img = async (color, tipo) => { const c = document.createElement('canvas'); c.width = c.height = tipo === 'image/png' ? 96 : 512; const x = c.getContext('2d'); x.fillStyle = color; x.beginPath(); x.arc(c.width / 2, c.height / 2, c.width / 3, 0, 7); x.fill(); return new Promise((ok) => c.toBlob(ok, tipo, 0.9)); };
    await P.guardarArchivo('pnube1', 's1.webp', await img('#ff3e8a', 'image/webp')); await P.guardarArchivo('pnube1', 's2.webp', await img('#ffd23f', 'image/webp'));
    await P.guardarArchivo('pnube1', 'bandeja.png', await img('#3ec7ff', 'image/png'));
    const packs = await P.leerPacks();
    packs.push({ id: 'pnube1', nombre: 'Mi pack en la nube', autor: 'Stickerazo', animado: false, stickers: [{ archivo: 's1.webp', emojis: ['😎'] }, { archivo: 's2.webp', emojis: ['🧉'] }], bandeja: 'bandeja.png', v: 1, n: 2, creado: Date.now() });
    await P.guardarPacks(packs);
  });
  const token1 = await A.p.evaluate(() => JSON.parse(localStorage.sz_cuenta).token);
  // (la app sube primero la lista del pack y después cada archivo: se espera a que esté completo)
  let nube = null; for (let i = 0; i < 40 && !(nube && nube.packs.length && !nube.packs[0].incompleto); i++) { await z(500); nube = await (await fetch(`${API}/api/nube`, { headers: { Authorization: 'Bearer ' + token1 } })).json(); }
  ok(nube.packs.length === 1 && !nube.packs[0].incompleto && Object.keys(nube.packs[0].archivos).length === 3, `celular A: el pack se guardó solo en la cuenta, unos segundos después (${nube.usado} bytes)`);
  await A.ctx.close();
  const Bc = await celular(); await entrarGoogle(Bc.p, Bc.ctx, 'google-nube-ui');
  await Bc.p.waitForFunction(async () => { const P = await import('/puente.js'); return (await P.leerPacks()).some((x) => x.id === 'pnube1'); }, null, { timeout: 15000 }).catch(() => {});
  const rec = await Bc.p.evaluate(async () => { const P = await import('/puente.js'); const pk = (await P.leerPacks()).find((x) => x.id === 'pnube1'); if (!pk) return null; const bl = await Promise.all(['s1.webp', 's2.webp', 'bandeja.png'].map((n) => P.blobDe('pnube1', n))); return { nombre: pk.nombre, n: pk.stickers.length, archivos: bl.filter((b) => b && b.size > 0).length }; });
  ok(rec && rec.nombre === 'Mi pack en la nube' && rec.n === 2 && rec.archivos === 3, 'celular B (sin nada): al entrar con la misma cuenta de Google, el pack vuelve con sus 3 archivos');
  const avisoTxt = await Bc.p.evaluate(() => document.querySelector('#aviso') && document.querySelector('#aviso').textContent);
  ok(/Recuperamos 1 pack/.test(avisoTxt || ''), `y lo avisa: «${avisoTxt}»`);
  await Bc.p.tap('#tabs [data-t="Mios"]'); await z(1200); await Bc.p.screenshot({ path: `${SAL}/7_recuperado.png` });
  // (borrarlo en el celular B también lo borra de la cuenta)
  await Bc.p.evaluate(async () => { const P = await import('/puente.js'); await P.borrarPack('pnube1'); await P.guardarPacks((await P.leerPacks()).filter((x) => x.id !== 'pnube1')); });
  const tokenB = await Bc.p.evaluate(() => JSON.parse(localStorage.sz_cuenta).token);
  let n2 = 1; for (let i = 0; i < 30 && n2; i++) { await z(500); n2 = (await (await fetch(`${API}/api/nube`, { headers: { Authorization: 'Bearer ' + tokenB } })).json()).packs.length; }
  ok(n2 === 0, 'borrarlo en un celular lo borra de la cuenta');
  await Bc.ctx.close();
}
ok(!errores.length, 'sin errores en la página' + (errores.length ? ': ' + errores.join(' | ') : ''));
await b.close(); web.close(); srv.close();
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`); process.exit(fallas ? 1 : 0);
