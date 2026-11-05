// El ícono de la app (pedido: «como Discord: poder cambiar el ícono de la app, no el logo», y «íconos personalizados
// también, para que el usuario ponga»). En Ajustes → Ícono de la app:
//  1. están los 8 que vienen (Clásico, Noche, Dorado, Neón, Rojo, Blanco, Azul, VHS) y «Tu imagen», con su nombre;
//  2. en la app de Android: tocar «Dorado» le pide a Android ese ícono (JXNativo.iconoApp) y queda marcado al volver a abrir;
//  3. «Tu imagen» en Android: se recorta cuadrada (512×512) y se agrega un acceso directo con ella (JXNativo.accesoDirecto),
//     avisando por qué es un acceso directo;
//  4. en Safari de iPhone: el elegido pasa a ser el de «Agregar a inicio» (apple-touch-icon) y el instalador que se baja
//     (.mobileconfig) es un perfil válido con ese ícono, a pantalla completa;
//  5. sin errores de JS.
// uso: node icono_app.mjs URL_HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , HTML] = process.argv;
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 700)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errJS = [];
// (una imagen de prueba: 300×200, roja con un cuadrado verde)
const tmp = '/tmp/claude-0/icono_prueba.png';
{ const p0 = await (await b.newContext()).newPage(); const u = await p0.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#d00'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#0c0'; g.fillRect(100, 50, 100, 100); return c.toDataURL('image/png'); }); fs.writeFileSync(tmp, Buffer.from(u.split(',')[1], 'base64')); }
async function abrir(ctxOpc, nativo) {
  const ctx = await b.newContext(ctxOpc);
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  if (nativo) await ctx.addInitScript(() => { window.__llamadas = []; let ic = 'clasico'; window.JXNativo = { iconoApp(id) { window.__llamadas.push(['iconoApp', id]); ic = id; return 'ok'; }, iconoActual() { return ic; }, accesoDirecto(n, b64) { window.__llamadas.push(['accesoDirecto', n, b64.length, b64.slice(0, 30)]); return 'ok'; }, latido() {}, registroNativo() { return ''; }, registroVisto() {}, version() { return 'prueba'; } }; });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
  return { ctx, p, ev };
}
const abrirAjustes = (ev) => ev(`(() => { const b = document.querySelector('#rbInicio [data-rb=opciones]'); if (b) b.click(); return 1; })()`);
const verSeccion = (ev) => ev(`(() => { const t = document.querySelector('[data-aj=l]'); if (t) t.click(); const g = document.querySelector('.icGrilla'); return { hay: !!g, tiles: g ? [...g.querySelectorAll('.icTile')].map((x) => [x.dataset.ic, x.textContent.trim(), !!x.querySelector('img'), x.classList.contains('sel')]) : [] }; })()`);
// --- Android (la app) ---
let A = await abrir({ viewport: { width: 873, height: 393 }, isMobile: true, hasTouch: true }, true);
await abrirAjustes(A.ev); await A.p.waitForTimeout(800);
const s1 = await verSeccion(A.ev);
caso('1. los 8 íconos que vienen y «Tu imagen», con su nombre', s1.hay && s1.tiles.length === 9 && s1.tiles.slice(0, 8).every((t) => t[2] && t[1]) && s1.tiles.map((t) => t[1]).join(',') === 'Clásico,Noche,Dorado,Neón,Rojo,Blanco,Azul,VHS,Tu imagen', s1);
await A.p.click('.icTile[data-ic=dorado]'); await A.p.waitForTimeout(300);
const s2 = await A.ev(`({ llamadas: window.__llamadas.slice(), est: (document.getElementById('icEst') || {}).textContent, sel: (document.querySelector('.icTile.sel') || {}).dataset.ic })`);
// (se cierra y se vuelve a abrir Ajustes: queda marcado el elegido)
await A.ev(`(() => { const b = document.getElementById('aOk'); if (b) b.click(); return 1; })()`); await A.p.waitForTimeout(400); await abrirAjustes(A.ev); await A.p.waitForTimeout(600);
const s2b = await verSeccion(A.ev);
caso('2. Android: «Dorado» le pide ese ícono a Android y queda marcado', s2.llamadas.some((l) => l[0] === 'iconoApp' && l[1] === 'dorado') && /unos segundos/.test(s2.est || '') && s2b.tiles.find((t) => t[3])[0] === 'dorado', { ...s2, marcado: s2b.tiles.filter((t) => t[3]).map((t) => t[0]) });
await A.p.setInputFiles('#icArch', tmp); await A.p.waitForTimeout(1200);
const s3 = await A.ev(`(() => { const u = localStorage.getItem('jx_icono_app_propio') || localStorage.getItem(ICAPP.kp); return new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3); ok({ w: im.width, h: im.height, centro: px(256, 256), borde: px(10, 256), llamadas: window.__llamadas.slice(-1), est: document.getElementById('icEst').textContent, tile: !!document.querySelector('.icPropio img') }); }; im.src = u; }); })()`);
caso('3. «Tu imagen» en Android: cuadrada de 512, recortada al medio, y un acceso directo con ella', s3.w === 512 && s3.h === 512 && s3.centro[1] > 150 && s3.borde[0] > 150 && s3.llamadas[0][0] === 'accesoDirecto' && s3.llamadas[0][2] > 1000 && /acceso directo/.test(s3.est) && s3.tile, s3);
await A.ctx.close();
// --- Safari de iPhone ---
const I = await abrir({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, acceptDownloads: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }, false);
await abrirAjustes(I.ev); await I.p.waitForTimeout(800); await verSeccion(I.ev);
await I.p.click('.icTile[data-ic=neon]'); await I.p.waitForTimeout(300);
const s4 = await I.ev(`({ apple: (document.querySelector('link[rel=apple-touch-icon]') || {}).href || '', est: document.getElementById('icEst').textContent, boton: !!document.getElementById('icPerfil') })`);
const [dl] = await Promise.all([I.p.waitForEvent('download', { timeout: 10000 }).catch(() => null), I.p.click('#icPerfil').catch(() => {})]);
let perfil = null; if (dl) { const f = await dl.path(); perfil = fs.readFileSync(f, 'utf8'); }
const neon = await I.ev(`ICONOS_APP.find((x) => x.id === 'neon').png.split(',')[1]`);
const pv = perfil && { nombre: dl.suggestedFilename(), plist: /^<\?xml[\s\S]*<plist version="1.0">[\s\S]*<\/plist>$/.test(perfil.trim()), webclip: perfil.includes('com.apple.webClip.managed'), full: /<key>FullScreen<\/key><true\/>/.test(perfil), icono: perfil.includes(neon), url: (/<key>URL<\/key><string>([^<]+)/.exec(perfil) || [])[1] };
caso('4. Safari: el elegido es el de «Agregar a inicio» y el instalador es un perfil con ese ícono', (/icono-neon/.test(s4.apple) || s4.apple.includes(neon.slice(0, 200))) && /inicio/.test(s4.est) && s4.boton && pv && pv.plist && pv.webclip && pv.full && pv.icono && /^https?:\/\/.+index\.html$/.test(pv.url || ''), { s4: { ...s4, apple: s4.apple.slice(0, 60) }, pv });
await I.ctx.close();
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('5. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
