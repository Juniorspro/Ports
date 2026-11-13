// Instalar un addon que sólo está en SteamPipe sin pasarlo entero por la memoria del juego (Discord, 3.1, iPhone: «no
// instalan los mods»; Safari cierra la página cuando pasa de su tope de memoria, y antes el addon bajado se armaba en un
// arreglo de su tamaño, se copiaba otra vez para guardarlo y se leía entero para su SHA-1). En un celular emulado, por la
// tienda de verdad (necesita internet):
//  1. el addon se instala y monta (props, archivos) y el .gma guardado es idéntico (SHA-256 y tamaño: comparar entre la
//     versión de antes y la de ahora, que lo imprimen);
//  2. la memoria: el pico de PSS del proceso que dibuja mientras baja y se guarda (sin el montaje, que es igual en las dos),
//     sobre lo que usaba antes (MB), y el pico de la memoria de JavaScript (con la de los arreglos);
//  3. sin errores de JS.
// uso: node gmod_pipe_memoria.mjs URL_HTML [ID=111412589]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , HTML, ID = '111412589'] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const MARCA = '--jx-pipe=' + process.pid;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--enable-precise-memory-info', MARCA] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const dib = () => {
  const L = {}; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'); L[d] = { pp: +st.slice(st.lastIndexOf(')') + 2).split(' ')[1], cmd: fs.readFileSync('/proc/' + d + '/cmdline', 'utf8') }; } catch (e) {} }
  const raiz = Object.keys(L).find((k) => L[k].cmd.includes(MARCA) && !L[k].cmd.includes('--type=')); if (!raiz) return 0;
  const H = new Set([raiz]); let c = true; while (c) { c = false; for (const k in L) if (!H.has(k) && H.has(String(L[k].pp))) { H.add(k); c = true; } }
  let v = 0; for (const k of H) if (L[k].cmd.includes('--type=renderer')) { try { v += +/^Pss:\s+(\d+)/m.exec(fs.readFileSync('/proc/' + k + '/smaps_rollup', 'utf8'))[1] / 1024; } catch (e) {} }
  return Math.round(v);
};
await p.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(p); await cdp.send('HeapProfiler.collectGarbage');
const base = dib(); let pico = base, picoJS = 0, n = 0, fase = '';
// (por fase: «bajando» va desde que empieza SteamPipe hasta que el addon está guardado en la caché —antes de montarlo—)
const vigila = setInterval(async () => { const v = dib(); n++; if (fase === 'bajando') pico = Math.max(pico, v); fase = await p.evaluate(() => window.__fase || '').catch(() => fase); }, 200);
const vigilaJS = setInterval(() => { if (fase !== 'bajando') return; cdp.send('Runtime.getHeapUsage').then((h) => { picoJS = Math.max(picoJS, (h.usedSize + (h.embedderHeapUsedSize || 0) + (h.backingStorageSize || 0)) / 1048576); }).catch(() => {}); }, 250);
const r = await ev(`(async () => { const t0 = performance.now(); let porPipe = false; const o = gpBajar, om = gmMontar; gpBajar = async (...a) => { porPipe = true; window.__fase = 'bajando'; const x = await o(...a); window.__tipo = x instanceof Blob ? 'Blob' : 'bytes'; return x; }; gmMontar = (...a) => { window.__fase = 'montando'; gmMontar = om; return om(...a); };
  try { const A = await gmInstalar('${ID}', { nombre: 'prueba', sinDeps: true }); await A.listo; gpBajar = o;
    const c = await gmCacheLeer('${ID}'), u = c instanceof Blob ? new Uint8Array(await c.arrayBuffer()) : c, h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map((x) => x.toString(16).padStart(2, '0')).join('');
    return { ok: true, porPipe, tipo: window.__tipo, seg: +((performance.now() - t0) / 1000).toFixed(1), props: A.props.length, archivos: A.G && A.G.archivos ? A.G.archivos.size : 0, mb: +(u.length / 1048576).toFixed(1), sha256: h.slice(0, 16) };
  } catch (e) { gpBajar = o; return { ok: false, error: String(e && e.message || e).slice(0, 200) }; } })()`);
clearInterval(vigila); clearInterval(vigilaJS);
ok('1. se instala por SteamPipe y se monta', r.ok && r.porPipe && r.props + r.archivos > 0, r);
console.log('MEMORIA ' + JSON.stringify({ id: ID, mb: r.mb, dibujaAntesMB: base, picoDibujaBajandoMB: pico, subeBajandoMB: pico - base, picoJSconArreglosMB: Math.round(picoJS), muestras: n, tipo: r.tipo, sha256: r.sha256 }));
ok('2. la memoria mientras baja y se guarda (antes de montar)', n > 5, { subeMB: pico - base, picoJS: Math.round(picoJS) });
const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('3. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
