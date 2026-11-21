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
const { srv, env: ENV } = await arrancar(PC, 'clave-admin', { GOOGLE_CLIENT_ID: CLIENTE, SZ_JWKS_PRUEBA: JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' }] }) });
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
ok(!errores.length, 'sin errores en la página' + (errores.length ? ': ' + errores.join(' | ') : ''));
await b.close(); web.close(); srv.close();
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`); process.exit(fallas ? 1 : 0);
