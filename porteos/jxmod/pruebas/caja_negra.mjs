// La caja negra (pedido: «se pega después de segundos y queda ahí … dame log»). En un celular emulado, con la app de
// Android de mentira (JXNativo: latido y el log del sistema) y el Viewfinder:
//  1. jugando, el juego manda el latido a la app (1 por segundo) y la caja guarda los pasos riesgosos (hooks del mod) y
//     el estado; en el celular el motor es DirectX 90 aunque se elija Alto (no compila los shaders ps_3_0 pesados);
//  2. si la vez anterior se trabó adentro de un mod (la app vuelve a abrir con ?colgado=1), al arrancar aparece «El
//     juego se trabó» con el último paso, el registro del juego y el de la app, y ese mod queda apagado;
//  3. «Copiar registro» lo copia entero;
//  4. Ajustes → «Registro de fallas» lo muestra cuando quieras;
//  5. sin errores de JS.
// uso: node caja_negra.mjs URL_HTML URL_CARPETA_GMA
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, CARP] = process.argv;
const VF = '3780178294';
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'],
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 11 Pro 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 JXMod/2.9-prueba9' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
await ctx.addInitScript(() => { window.__lat = 0; window.JXNativo = { latido() { window.__lat++; }, registroNativo() { return 'motivo: colgado (sin latido 46 s)\n--- consola del juego ---\nERROR prueba\n--- log de la app ---\nW/chromium: prueba'; }, registroVisto() {}, version() { return 'prueba'; } }; });
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const abrir = async (q) => { await p.goto(HTML + (q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); };
let bien = 0, tot = 0;
await abrir('');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'alto'; GFX.auto = false; aplicarGfx(); guardarPrefs(); 1`);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${VF}.gma')).arrayBuffer()); const A = await gmInstalar('${VF}', { nombre: 'Viewfinder', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(8000);
const j = await ev(`(() => { const c = JSON.parse(localStorage.getItem('jx_caja') || 'null'); return { latidos: window.__lat, pasos: (c && c.l || []).filter((x) => / paso /.test(x)).slice(-4), estado: c && c.e, sm3: gmrtSM3(), calidad: GFX.nombre, ps30: [...GRT.progs.values()].filter((P) => P.ps3 && P.p).length }; })()`);
tot++; if (caso('1. latido a la app, pasos de los hooks del mod en la caja, y DirectX 90 en el celu aunque sea Alto', j.latidos >= 4 && j.pasos.some((x) => /hook .* del mod/.test(x)) && j.estado && j.sm3 === false && j.calidad === 'alto' && j.ps30 === 0, { latidos: j.latidos, pasos: j.pasos, sm3: j.sm3, ps30Compilados: j.ps30, estado: j.estado && { juego: j.estado.juego, dx: j.estado.dx, mods: j.estado.mods } })) bien++;
// 2: la vez anterior se trabó adentro del mod (lo que la caja tendría escrito) y la app vuelve a abrir el juego
await ev(`(() => { cnGuardar = function () {}; const c = JSON.parse(localStorage.getItem('jx_caja')); c.paso = 'hook HUDPaint del mod Viewfinder'; c.addon = '${VF}'; localStorage.setItem('jx_caja', JSON.stringify(c)); localStorage.setItem('rb_vivo', String(Date.now())); return 1; })()`);
await abrir('?colgado=1');
await p.waitForSelector('#cnVen', { timeout: 15000 }).catch(() => {});
const v = await ev(`(() => { const v = document.getElementById('cnVen'); if (!v) return { hay: false }; const t = v.querySelector('textarea').value; return { hay: true, texto: v.innerText.slice(0, 300), tienePaso: /ÚLTIMO PASO.*hook HUDPaint del mod Viewfinder/.test(t), tieneApp: /log de la app/.test(t), largo: t.length, apagado: GMA.apagados.has('${VF}') }; })()`);
await p.screenshot({ path: '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad/caja_negra.png', timeout: 120000 }).catch(() => {});
tot++; if (caso('2. después del cuelgue: «El juego se trabó» con el último paso y el log de la app, y el mod queda apagado', v.hay && v.tienePaso && v.tieneApp && v.apagado && /apagué el mod/.test(v.texto), v)) bien++;
// 3
await p.click('#cnVen [data-cn="copiar"]'); await p.waitForTimeout(500);
const cl = await p.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; } });
const ta = await ev(`document.querySelector('#cnVen textarea').value`);
tot++; if (caso('3. «Copiar registro» copia el registro entero', cl === ta && cl.length > 200, { copiado: cl.length, ventana: ta.length })) bien++;
// 4
await p.click('#cnVen [data-cn="cerrar"]');
await ev(`(() => { abrirAjustes ? abrirAjustes() : (typeof ajustesAbrir === 'function' && ajustesAbrir()); return 1; })()`).catch(() => {});
let hay4 = await ev(`!!document.getElementById('aReg')`);
if (!hay4) { await ev(`(() => { const f = Object.keys(window).length; return 1; })()`); }
if (hay4) await ev(`document.getElementById('aReg').click(), 1`);
const v4 = await ev(`(() => { const v = document.getElementById('cnVen'); return { boton: !!document.getElementById('aReg'), ventana: !!v, titulo: v ? v.innerText.slice(0, 40) : '' }; })()`);
tot++; if (caso('4. Ajustes → «Registro de fallas» lo muestra', v4.boton && v4.ventana && /Registro de fallas/.test(v4.titulo), v4)) bien++;
const err = errJS.filter((e) => !/WebSocket|net::|Failed to load/i.test(e));
tot++; if (caso('5. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
