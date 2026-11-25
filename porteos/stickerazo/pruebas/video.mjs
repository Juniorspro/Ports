// El editor de video (web/video.js): elegir un video (su sonido queda como un audio verde), texto (amarillo), un audio del
// celu (verde), elegir con un toque (aparecen las manijas), alargar el audio con la manija (se repite), mover el texto
// manteniendo apretado, reproducir, exportar el sticker animado (≤ 500 KB, se guarda en un pack) y el video con sonido.
// uso: node video.mjs [CARPETA_FOTOS] (los archivos de prueba: /tmp/claude-0/sz_video/prueba.webm y musica.webm, de ffmpeg)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = '/home/user/Ports/porteos/stickerazo/', WEB = RAIZ + 'web/', SAL = process.argv[2] || '/tmp/claude-0/sz_video/fotos', ARCH = '/tmp/claude-0/sz_video/';
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((ok) => srv.listen(8995, ok));
const { arrancar } = await import(RAIZ + 'pruebas/servidor_local.mjs'); const com = await arrancar(8996);
let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:8996'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) {} });
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const E = (f, a) => p.evaluate(f, a);
fs.mkdirSync(SAL, { recursive: true });
const foto = async (nom) => { await espera(350); await p.screenshot({ path: `${SAL}/${String(++n).padStart(2, '0')}_${nom}.png` }); };
const clips = () => E(() => [...document.querySelectorAll('#vVideo .vvClip')].map((d) => { const r = d.getBoundingClientRect(); return { id: d.dataset.id, cls: d.className.replace('vvClip ', ''), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), txt: d.textContent.trim() }; }));
const elegirArchivo = async (sel, archivo) => { const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click(sel)]); await ch.setFiles(archivo); };
await p.goto('http://127.0.0.1:8995/index.html'); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
await espera(1200); await E(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
await foto('inicio');
const alCrear = async () => { await p.click('.centro, [data-t="Crear"]'); await espera(500); };
await alCrear(); await foto('crear'); ok(await p.isVisible('#bVideo'), 'Crear tiene «Sticker de video»');
await p.click('#bVideo'); await espera(500); ok(await p.isVisible('#vVideo'), 'se abre el editor de video'); await foto('vacio');
// 1. el video (su sonido aparece como audio verde)
await elegirArchivo('#vVideo .vvHerr [data-a="base"]', ARCH + 'prueba.webm');
await p.waitForFunction(() => document.querySelectorAll('#vVideo .vvClip').length >= 2, null, { timeout: 20000 }).catch(() => {});
let L = await clips(); ok(L.some((c) => c.cls.includes('video')) && L.some((c) => c.cls.includes('audio') && /Sonido original/.test(c.txt)), 'video y su sonido en la línea', L.map((c) => c.cls + ':' + c.txt));
await espera(2500); await foto('con_video');
// 2. texto
await p.click('#vVideo .vvHerr [data-a="texto"]'); await p.fill('#vvTx', 'Hola che!'); await p.click('#modal [data-c="#ffd23f"]'); await p.click('#modal [data-x="1"]'); await espera(300);
L = await clips(); const tx = L.find((c) => c.cls.includes('texto')); ok(!!tx && /Hola che/.test(tx.txt), 'texto en su pista (amarillo con T)', tx);
// 3. audio del celu
await p.click('#vVideo .vvHerr [data-a="audio"]'); await espera(300); await foto('hoja_audio');
await elegirArchivo('#modal [data-f="gal"]', ARCH + 'musica.webm');
await p.waitForFunction(() => [...document.querySelectorAll('#vVideo .vvClip.audio')].length >= 2, null, { timeout: 15000 }).catch(() => {});
L = await clips(); const au = L.filter((c) => c.cls.includes('audio')); ok(au.length === 2, 'dos audios: el original y el del celu', au.map((c) => c.txt));
const colAudio = await E(() => [...document.querySelectorAll('#vVideo .vvClip.audio')].map((d) => getComputedStyle(d).getPropertyValue('--c').trim())); ok(colAudio.every((c) => c === '#1fa35b'), 'los del celu en verde', colAudio);
// 4. tocar el audio del celu: se elige y aparecen las manijas
const gal = (await clips()).filter((c) => c.cls.includes('audio')).pop();
await p.mouse.click(gal.x + Math.min(gal.w - 10, 30), gal.y + gal.h / 2); await espera(250);
let manijas = await E(() => document.querySelectorAll('#vVideo .vvClip.sel .vvManija').length); ok(manijas === 2, 'al tocarlo: manijas a los dos lados', manijas); await foto('elegido');
const t1a = await E(() => { const id = document.querySelector('#vVideo .vvClip.sel').dataset.id; return window.__vv && window.__vv().clips.find((c) => c.id === id).t1; });
// 5. alargar con la manija derecha (más que lo que dura: se repite)
await E(() => window.__vv().irA(4)); await espera(200);
const der = await E(() => { const r = document.querySelector('#vVideo .vvClip.sel .vvManija.der').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.move(der.x, der.y); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(der.x + k * 14, der.y); await p.mouse.up(); await espera(200);
const t1b = await E(() => { const id = document.querySelector('#vVideo .vvClip.sel').dataset.id; return window.__vv().clips.find((c) => c.id === id).t1; });
ok(t1b > t1a + 1.5, 'la manija lo alarga', { antes: t1a, despues: t1b }); await foto('alargado');
// 6. mantener apretado el texto y moverlo en el tiempo
await E(() => window.__vv().irA(1)); await espera(200);
const t = (await clips()).find((c) => c.cls.includes('texto')), t0a = await E(() => window.__vv().clips.find((c) => c.pista === 'texto').t0);
await p.mouse.move(t.x + 20, t.y + t.h / 2); await p.mouse.down(); await espera(480); console.log('   después de mantener:', await E(() => window.__vvG()), 'clip en', t); for (let k = 1; k <= 8; k++) await p.mouse.move(t.x + 20 + k * 12, t.y + t.h / 2); await foto('moviendo'); await p.mouse.up(); await espera(200);
const t0b = await E(() => window.__vv().clips.find((c) => c.pista === 'texto').t0); ok(t0b > t0a + 0.6, 'mantener y arrastrar lo corre en el tiempo', { antes: t0a, despues: t0b });
// 7. reproducir
await E(() => window.__vv().irA(0)); await p.click('#vVideo .vvPlay'); await espera(1300); const tj = await E(() => window.__vv().t); await p.click('#vVideo .vvPlay');
ok(tj > 0.8 && tj < 2.5, 'reproduce (el tiempo avanza con el audio)', tj); await foto('reproduciendo');
// 8. pellizcar no se prueba acá (dos dedos); el zoom por código
await E(() => { const v = window.__vv(); v.pps = 25; v.irA(2); }); await espera(200); await foto('alejado');
// 9. exportar el sticker animado → se guarda en un pack
await E(() => window.__vv().irA(0)); await p.click('#vVideo [data-a="exportar"]'); await espera(300); await foto('exportar');
await p.click('#modal [data-e="st"]');
await p.waitForFunction(() => /Guardar sticker/.test(document.querySelector('#modal').textContent), null, { timeout: 120000 }).catch(() => {});
await foto('guardar'); ok(/Guardar sticker/.test(await E(() => document.querySelector('#modal').textContent)), 'sale la hoja de guardar');
await p.click('#modal .pri[data-x="1"]');
await p.waitForFunction(() => window.__sz.E.vista === 'vPack', null, { timeout: 30000 }).catch(() => {});
const pk = await E(async () => { const P = window.__sz.E.packs; const pack = P.find((x) => x.id === window.__sz.E.packId); if (!pack) return null; const r = await fetch(document.querySelector('#vPack img[src]')?.src || ''); return { animado: pack.animado, n: pack.stickers.length, archivo: pack.stickers[0].archivo }; });
const bytes = await E(async () => { const pack = window.__sz.E.packs.find((x) => x.id === window.__sz.E.packId); const db = await new Promise((ok) => { const r = indexedDB.open('stickerazo'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); if (!db) return -1; return await new Promise((ok) => { try { const q = db.transaction('archivos').objectStore('archivos').get(pack.id + '/' + pack.stickers[0].archivo); q.onsuccess = () => ok(q.result ? q.result.size : -2); q.onerror = () => ok(-3); } catch (e) { ok(-4); } }); });
ok(pk && pk.animado && pk.n === 1, 'quedó en un pack animado', pk); ok(bytes > 1000 && bytes <= 500 * 1024, 'el WebP pesa 500 KB o menos', bytes);
ok(!(await p.isVisible('#vVideo')), 'el editor se cierra al guardar'); await foto('pack');
// 10. el video con sonido (en el navegador se baja)
await E(() => window.__sz.ir && window.__sz.ir('vInicio')); await espera(400); await alCrear();
await p.click('#bVideo'); await elegirArchivo('#vVideo .vvHerr [data-a="base"]', ARCH + 'prueba.webm'); await p.waitForFunction(() => document.querySelectorAll('#vVideo .vvClip').length >= 2, null, { timeout: 20000 }).catch(() => {});
await p.click('#vVideo [data-a="exportar"]'); await espera(300);
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#modal [data-e="mp4"]')]);
let tam = 0, nombre = ''; if (dl) { const ruta = SAL + '/' + dl.suggestedFilename(); await dl.saveAs(ruta); tam = fs.statSync(ruta).size; nombre = ruta; }
ok(tam > 50000, 'el video con sonido se graba', { nombre: path.basename(nombre), tam });
if (nombre) { const { execSync } = await import('child_process'); try { console.log('   ffprobe:', execSync(`ffprobe -v error -show_entries stream=codec_type,codec_name,r_frame_rate,width,height -of csv=p=0 "${nombre}"`).toString().trim().replace(/\n/g, ' | ')); } catch (e) { console.log('   ffprobe falló'); } }
// 11. para el editor de WhatsApp: 5 s con sonido (video) y la imagen con 10 s de audio, con la guía
await E(() => window.__vv().irA(1)); await p.click('#vVideo [data-a="exportar"]'); await espera(300);
const [d5] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#modal [data-e="wa5"]')]);
let r5 = null; if (d5) { const ruta = SAL + '/' + d5.suggestedFilename(); await d5.saveAs(ruta); const { execSync } = await import('child_process'); r5 = { nombre: path.basename(ruta), dur: +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${ruta}"`).toString().trim(), audio: execSync(`ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "${ruta}"`).toString().trim() }; }
await p.waitForSelector('#modal .vvGuia', { timeout: 10000 }).catch(() => {}); await foto('guia_video');
ok(r5 && r5.dur > 4.5 && r5.dur < 5.6 && !!r5.audio && /^wa_sticker_sonido/.test(r5.nombre), 'sticker con sonido: video de 5 s con audio', r5);
ok(await p.isVisible('#modal .vvGuia'), 'aparecen los pasos para WhatsApp');
await p.click('#modal [data-x="0"]'); await espera(200);
await p.click('#vVideo [data-a="exportar"]'); await espera(300);
const bajadas = []; const oye = (d) => bajadas.push(d); p.on('download', oye);
await p.click('#modal [data-e="wa10"]'); await p.waitForSelector('#modal .vvGuia', { timeout: 20000 }).catch(() => {}); await espera(800); p.off('download', oye);
const info = []; for (const d of bajadas) { const ruta = SAL + '/' + d.suggestedFilename(); await d.saveAs(ruta); info.push({ n: path.basename(ruta), kb: Math.round(fs.statSync(ruta).size / 1024) }); }
ok(info.some((x) => /\.png$/.test(x.n)) && info.some((x) => /\.wav$/.test(x.n)), 'quieto con audio: la imagen y el audio', info); await foto('guia_quieto');
// 12. mandar con sonido (el motor de WhatsApp, simulado): vincular con el código, elegir los segundos y mandar
await p.click('#modal [data-x="0"]').catch(() => {}); await espera(200);
await E(() => {
  const st = { vinculado: false, pedidos: [], enviado: null };
  window.__waPrueba = st;
  window.SZN = { waPedir: (id, ruta, json) => { const d = JSON.parse(json); st.pedidos.push(ruta);
    let r = { ok: true };
    if (ruta === 'estado') r = { ok: true, vinculado: st.vinculado, yo: st.vinculado ? '•••••••6789' : null };
    if (ruta === 'vincular') { r = { ok: true, codigo: 'K7QW2M9P' }; setTimeout(() => { st.vinculado = true; }, 3000); }
    if (ruta === 'grupos') r = { ok: true, lista: [{ id: '1203@g.us', nombre: 'Los pibes' }, { id: '1204@g.us', nombre: 'Familia' }] };
    if (ruta === 'enviar') { st.enviado = d; r = { ok: true, para: d.destino === 'yo' ? 'yo' : d.destino }; }
    setTimeout(() => window.__szWA(id, JSON.stringify(r)), 60); } };
});
await E(() => window.__vv().irA(0)); await p.click('#vVideo [data-a="exportar"]'); await espera(300);
await p.click('#modal [data-e="wamotor"]'); await p.waitForSelector('#modal #vvAc', { timeout: 8000 }).catch(() => {});
ok(await p.isVisible('#modal #vvAc'), 'sin vincular: pide aceptar el riesgo y el número'); await foto('wa_vincular');
ok(await E(() => document.querySelector('#modal [data-x="1"]').disabled), 'sin aceptar no deja pedir el código');
await p.click('#modal #vvAc'); await p.fill('#modal #vvNum', '54 9 11 2345 6789'); await p.click('#modal [data-x="1"]');
await p.waitForSelector('#modal .vvCodigo', { timeout: 8000 }).catch(() => {});
ok((await E(() => (document.querySelector('#modal .vvCodigo') || {}).textContent)) === 'K7QW-2M9P', 'muestra el código de 8 letras'); await foto('wa_codigo');
await p.waitForSelector('#modal #vvSegR', { timeout: 15000 }).catch(() => {});
ok(await p.isVisible('#modal #vvSegR'), 'al vincularse pasa a la hoja de mandar'); 
await p.click('#modal [data-d="grupo"]'); await p.waitForSelector('#modal [data-g]', { timeout: 5000 }).catch(() => {});
ok((await E(() => document.querySelectorAll('#modal [data-g]').length)) === 2, 'lista los grupos'); await foto('wa_grupos');
await p.click('#modal [data-d="yo"]');
const segMax = await E(() => { const r = document.querySelector('#modal #vvSegR'); r.value = r.max; r.dispatchEvent(new Event('input')); return +r.max; });
await foto('wa_mandar');
await p.click('#modal [data-x="1"]');
await p.waitForFunction(() => window.__waPrueba.enviado, null, { timeout: 90000 }).catch(() => {});
const env = await E(() => { const d = window.__waPrueba.enviado; if (!d) return null; return { ...d, webp: d.webp.length, ogg: d.ogg.length, webpIni: atob(d.webp.slice(0, 16)).slice(0, 12), oggIni: atob(d.ogg.slice(0, 8)).slice(0, 4), oggB64: d.ogg }; });
ok(env && /^RIFF....WEBP/s.test(env.webpIni) && env.webp * 0.75 <= 500 * 1024, 'manda un WebP de 500 KB o menos', env && { kb: Math.round(env.webp * 0.75 / 1024) });
let durOgg = -1; if (env) { const ruta = SAL + '/wa_audio.ogg'; fs.writeFileSync(ruta, Buffer.from(env.oggB64, 'base64')); const { execSync } = await import('child_process'); durOgg = +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${ruta}`).toString().trim(); }
ok(env && env.oggIni === 'OggS' && env.segundos === segMax && Math.abs(durOgg - segMax) < 0.1 && env.destino === 'yo' && env.animado === true, 'manda el Ogg/Opus con los segundos elegidos, a mi chat', env && { segundos: env.segundos, segMax, durOgg, kb: Math.round(env.ogg * 0.75 / 1024), destino: env.destino });
await espera(400); await foto('wa_mandado');
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
await b.close(); srv.close(); com.close && com.close();
console.log(fallas ? `${fallas} FALLAS` : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
