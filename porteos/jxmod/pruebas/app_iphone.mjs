// La app nativa de iPhone/iPad (ios/JXMod/main.swift: el juego en una WKWebView). Acá no hay iOS: se carga el juego como
// lo carga la app —window.JX_IOS_APP, el puente window.webkit.messageHandlers.jx (falso, anota los mensajes) y el mismo
// script de «guardar» que inyecta la app, sacado de main.swift— y se revisa lo que le toca al juego:
//  1. no ofrece «Agregar a inicio» (ya es una app) y se considera instalada;
//  2. Ajustes → Ícono de la app: la ayuda de la app, sin el instalador de Safari, y tocar «Dorado» le pide ese ícono a iOS
//     por el puente ({ k: 'icono', id: 'dorado' });
//  3. lo que el juego descarga con <a download> (la foto del juego, un archivo) va por el puente para guardarlo/compartirlo,
//     con el contenido entero;
//  4. abrir un enlace de afuera no navega la app (se abre afuera);
//  5. sin errores de JS.
// uso: node app_iphone.mjs URL_DE_web/index.html
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const [, , URL0] = process.argv;
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const swift = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ios', 'JXMod', 'main.swift'), 'utf8');
const m = /static let guardarJS = """\n([\s\S]*?)\n(\s*)"""/.exec(swift); const sangria = m[2].length;
const GUARDAR = m[1].split('\n').map((l) => l.slice(sangria)).join('\n');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
await ctx.addInitScript({ content: 'window.__msgs = []; window.webkit = { messageHandlers: { jx: { postMessage(x) { window.__msgs.push(JSON.parse(JSON.stringify(x))); } } } }; window.JX_IOS_APP = 1;' + GUARDAR });
const p = await ctx.newPage(); const errJS = []; p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
await p.goto(URL0 + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
await p.waitForTimeout(5000);
const c1 = await ev(`({ ios: IOS, instalada: IOS_INSTALADA, appweb: typeof JX_APPWEB !== 'undefined', aviso: !!document.getElementById('iosInst'), app: icappIOSApp() })`);
caso('1. no ofrece «Agregar a inicio»: ya es una app', c1.ios && c1.instalada && c1.appweb && !c1.aviso && c1.app, c1);
await ev(`(() => { const b = document.querySelector('#rbInicio [data-rb=opciones]'); if (b) b.click(); return 1; })()`); await p.waitForTimeout(800);
await ev(`(() => { const t = document.querySelector('[data-aj=l]'); if (t) t.click(); return 1; })()`); await p.waitForTimeout(300);
await p.click('.icTile[data-ic=dorado]'); await p.waitForTimeout(300);
const c2 = await ev(`({ ayuda: (document.querySelector('.icGrilla') || {}).parentElement && document.querySelector('.icGrilla').parentElement.querySelector('.lgAyuda').textContent, perfil: !!document.getElementById('icPerfil'), est: document.getElementById('icEst').textContent, msgs: window.__msgs.slice() })`);
caso('2. ícono: ayuda de la app, sin el instalador de Safari, y «Dorado» se le pide a iOS', c2.ayuda === (await ev(`T('ic.ayudaIOS')`)) && !c2.perfil && c2.msgs.some((x) => x.k === 'icono' && x.id === 'dorado'), c2);
await ev(`(() => { const b = document.getElementById('aOk'); if (b) b.click(); return 1; })()`);
// (un archivo cualquiera y la foto del juego, que se saca dibujando la escena)
const c3 = await ev(`(async () => {
  window.__msgs.length = 0;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['hola JXMod ñ'], { type: 'text/plain' })); a.download = 'prueba.txt'; a.click();
  fotoGuardar();
  for (let i = 0; i < 60 && window.__msgs.filter((x) => x.k === 'guardar').length < 2; i++) await new Promise((r) => setTimeout(r, 100));
  const g = window.__msgs.filter((x) => x.k === 'guardar');
  const txt = g.find((x) => x.nombre === 'prueba.txt'), foto = g.find((x) => /\\.png$/.test(x.nombre));
  const dec = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  let fw = 0; if (foto) { const im = new Image(); im.src = 'data:image/png;base64,' + foto.b64; await im.decode().catch(() => {}); fw = im.naturalWidth; }
  return { n: g.length, txt: txt && dec(txt.b64), foto: foto && foto.nombre, fotoAncho: fw, navego: location.href.includes('blob:') };
})()`);
caso('3. lo que se descarga va por el puente para guardarlo (archivo y foto del juego)', c3.n === 2 && c3.txt === 'hola JXMod ñ' && c3.foto && c3.fotoAncho > 100 && !c3.navego, c3);
const antes = p.url();
await ev(`(() => { abrirRed('https://example.com/'); return 1; })()`); await p.waitForTimeout(500);
caso('4. un enlace de afuera no saca al juego de la app', p.url() === antes, { url: p.url() });
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('5. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
