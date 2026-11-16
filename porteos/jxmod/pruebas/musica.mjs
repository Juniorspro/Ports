// La música del menú (juego/musica.js, Ajustes → Música). Lo que se mide:
//  1. los datos: 10 estaciones de 35 canciones, sin repetidas, con id de YouTube válido;
//  2. web, sin toque: el reproductor se arma después de que el menú se puede tocar (y no antes), escondido, con la canción
//     de Casual; no se le pide sonar hasta el primer toque; con el toque suena (el estado del reproductor, por sus eventos,
//     pasa a «reproduciendo») y la placa del menú dice qué suena;
//  3. el volumen: el general por el de la música, también moviendo las barras de Ajustes sin «Listo»;
//  4. cambiar de estación (la tarjeta) cambia el video en el momento; «siguiente» recorre las 35 sin repetir y la vuelta
//     nueva no empieza con la última; «anterior» vuelve;
//  5. un error 150 (el dueño no deja insertarlo) salta solo a la siguiente y queda anotado; 6 seguidos: silencio;
//  6. «Sin música» saca el reproductor y la placa;
//  7. al empezar una partida, fundido (el volumen baja en ~1 s) y ningún iframe de YouTube jugando; al volver al menú, la
//     misma canción desde donde iba;
//  8. en segundo plano (__jxFondo, como la app de Android, y visibilitychange) se pausa y vuelve; con el editor de la
//     música de los emotes abierto, también;
//  9. en la app (JXNativo) suena sin toque;
// 10. Casual sin internet: con el paquete a_musica (armado con PAQUETE con los mu_*), se baja solo después de que el menú se
//     puede tocar, cada canción queda en la caché, la siguiente suena del archivo (<audio>, avanza) y, sin internet
//     (setOffline), sigue sonando y la página nueva arranca con la música guardada; sin el paquete, sigue por YouTube;
// 11. Mi música: 3 archivos (hechos con ffmpeg) se agregan, suenan del aparato, sin internet; quedan al recargar; se saca
//     uno y quedan 2; el tope (300 MB) avisa;
// 12. la placa del menú en el clásico y el depósito (873×402 con 40 px de muesca, 640×360, celular parado, tablet, compu):
//     adentro de la pantalla, sin pisar nada del menú, lo que se toca ≥ 44 px, letra ≥ 14 px, contraste ≥ 4,5; en los 14
//     idiomas (873×402 y 640×360; el árabe espejado);
// 13. la pestaña Música en el celular y la compu: las 12 tarjetas, lo tocable ≥ 44 px, letra ≥ 14 px, nada se sale;
// 14. sin errores de JS.
// YouTube no reproduce desde este entorno (contesta «Este contenido no está disponible»): para lo que necesita que suene
// se usa un reproductor simulado que contesta los mismos mensajes (listening, onReady, onStateChange, infoDelivery,
// onError; playVideo, pauseVideo, loadVideoById, setVolume); con YouTube de verdad se mira que el iframe carga y su API
// contesta (parte 0).
// uso: node musica.mjs URL_HTML [URL_CON_PAQUETE] [CARPETA_FOTOS]   (SOLO=1,2,...: sólo esas partes)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { execFileSync } from 'child_process'; import { mkdirSync, existsSync, statSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, HTML_PAQ = '', DIR = tmpdir() + '/musica_fotos'] = process.argv; const D = DIR.replace(/\/$/, '') + '/';
try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 1500))); return ok; };
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
const bAuto = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS.concat(['--autoplay-policy=no-user-gesture-required']) });
const errJS = [];
const FUERA = /Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME|youtube|googlevideo/i;
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const PREFS0 = (o) => Object.assign({ bienvenida: true, tutVisto: true, nombre: 'NijulaX', nombreOk: true, lang: 'es', mapa: 'Desert', gfx: 'bajo' }, o || {});

// ---------------- el reproductor simulado de YouTube ----------------
// (la página de youtube-nocookie.com/embed/ID: contesta como la API de verdad; los ids de MALOS dan ese error al cargarse)
const MALOS = {};
const SIMULADO = (id, q) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script>
const MAL = ${JSON.stringify(MALOS)}, DUR = 180;
const S = window.S = { vid: ${JSON.stringify(id)}, est: -1, cur: +(${JSON.stringify(q.get('start') || '0')}), vol: 100, cmds: [], listo: false };
const mandar = (event, info) => parent.postMessage(JSON.stringify({ event, info, id: 'x', channel: 'widget' }), '*');
function estado(e) { S.est = e; mandar('onStateChange', e); mandar('infoDelivery', { playerState: e, currentTime: S.cur, duration: DUR, volume: S.vol }); }
function sonar() { if (MAL[S.vid]) { mandar('onError', MAL[S.vid]); return; } estado(1); }
addEventListener('message', (e) => {
  let d; try { d = JSON.parse(e.data); } catch (x) { return; }
  if (d.event === 'listening') { S.listo = true; mandar('initialDelivery', { apiInterface: ['playVideo'], playerState: -1, currentTime: S.cur, duration: DUR, volume: S.vol }); mandar('onReady', null); return; }
  if (d.event !== 'command') return; S.cmds.push(d.func + (d.args && d.args.length ? ':' + JSON.stringify(d.args) : ''));
  if (d.func === 'playVideo') sonar();
  else if (d.func === 'pauseVideo') { if (S.est === 1) estado(2); }
  else if (d.func === 'setVolume') { S.vol = d.args[0]; mandar('infoDelivery', { volume: S.vol }); }
  else if (d.func === 'loadVideoById') { const a = d.args[0] || {}; S.vid = a.videoId || a; S.cur = +a.startSeconds || 0; estado(-1); sonar(); }
  else if (d.func === 'seekTo') { S.cur = +d.args[0] || 0; }
});
setInterval(() => { if (S.est !== 1) return; S.cur += 0.25; mandar('infoDelivery', { currentTime: S.cur, playerState: 1, duration: DUR }); if (S.cur >= DUR) { S.cur = DUR; estado(0); } }, 250);
</script></body>`;
async function simularYT(ctx) {
  await ctx.route(/https:\/\/www\.youtube-nocookie\.com\/embed\/.*/, (r) => { const u = new URL(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: SIMULADO(u.pathname.split('/').pop(), u.searchParams) }); });
}
// abrir el juego. o: { prefs, w, h, movil, ins, auto (sin pedir toque), nativo, real (YouTube de verdad), url, antes }
async function abrir(nom, o = {}) {
  const w = o.w || 873, h = o.h || 402, movil = o.movil ?? w < 1000;
  const ctx = await (o.auto ? bAuto : b).newContext({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  if (!o.real) await simularYT(ctx);
  await ctx.addInitScript((P) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0(o.prefs));
  if (o.nativo) await ctx.addInitScript(() => { window.JXNativo = { salir() {}, abrir() {} }; });
  if (o.antes) await ctx.addInitScript(o.antes);
  const p = await ctx.newPage(); const mios = [];
  p.on('pageerror', (e) => { const t = nom + ': ' + e.message.slice(0, 200); errJS.push(t); mios.push(t); });
  p.on('console', (m) => { if (m.type() === 'error' && !FUERA.test(m.text())) { const t = nom + ' consola: ' + m.text().slice(0, 200); errJS.push(t); mios.push(t); } });
  if (o.ins) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: o.ins, right: 0, top: 0, bottom: 0 } }); }
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  const t0 = Date.now();
  await p.goto((o.url || HTML) + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  return { ctx, p, ev, mios, t0 };
}
const esperar = async (A, js, ms = 8000) => { try { await A.p.waitForFunction((x) => window.__ev(x), js, { timeout: ms, polling: 50 }); return true; } catch (e) { return false; } };
const yt = (A) => { const fr = A.p.frames().find((x) => /youtube-nocookie\.com\/embed/.test(x.url())); return fr ? fr.evaluate(() => window.S ? { vid: S.vid, est: S.est, cur: S.cur, vol: S.vol, cmds: S.cmds.slice() } : null).catch(() => null) : Promise.resolve(null); };
const menuListo = (A) => esperar(A, `musEnMenu()`, 30000);

// ======================= 1. los datos =======================
if (corre(1)) {
  const A = await abrir('datos');
  const d = await A.ev(`(() => { const E = MUS_DATOS.map((e) => ({ k: e.k, n: e.c.length, malos: e.c.filter((c) => !/^[\\w-]{11}$/.test(c[0])).length })); const todos = MUS_DATOS.flatMap((e) => e.c.map((c) => c[0])); return { E, n: todos.length, rep: todos.length - new Set(todos).size, est: MUS_EST.map((e) => e[0]).join(','), casualArch: MUS_DATOS[0].c.filter((c) => /^mu_[a-z0-9_]+$/.test(c[3])).length }; })()`);
  caso('1 · 10 estaciones de 35, con id válido, sin repetidas', d.E.length === 10 && d.E.every((e) => e.n === 35 && !e.malos) && d.rep === 0 && d.n === 350 && d.est === d.E.map((e) => e.k).join(','), d);
  caso('1 · las 35 de Casual con su archivo del paquete', d.casualArch === 35, d.casualArch);
  await A.ctx.close();
}

// ======================= 0. YouTube de verdad: el iframe carga y la API contesta =======================
if (corre(0)) {
  // (una estación de YouTube: Casual suena del paquete a_musica cuando el armado lo trae, sin reproductor de YouTube; y un
  // toque en el fondo, como el jugador en la web)
  const A = await abrir('real', { real: true, auto: true, prefs: { musEst: 'westside' } });
  await menuListo(A); await A.p.mouse.click(Math.round(873 * 0.8), Math.round(402 * 0.45));
  const ok = await esperar(A, `!!MUS.ytListo`, 30000);
  const r = await A.ev(`({ listo: !!MUS.ytListo, src: (document.querySelector('#musMini iframe') || {}).src || '' })`);
  caso('0 · con YouTube de verdad el reproductor carga y contesta (onReady/initialDelivery)', ok && /youtube-nocookie\.com\/embed\/[\w-]{11}\?/.test(r.src) && /enablejsapi=1/.test(r.src), r);
  await A.ctx.close();
}

// ======================= 2 a 9: con el reproductor simulado =======================
if ([2, 3, 4, 5, 6, 7, 8].some(corre)) {
  const A = await abrir('web');
  // (el reproductor no se arma antes de que el menú se pueda tocar: MUS.menuT, la primera vez que se pudo tocar, y
  // MUS.armadoT, cuando se armó, en el reloj de la página)
  await menuListo(A);
  await esperar(A, `document.querySelectorAll('#musMini iframe').length === 1 && !!MUS.ytListo`, 15000);
  const antes = await A.ev(`({ menuT: Math.round(MUS.menuT), armadoT: Math.round(MUS.armadoT), carga: Math.round(performance.now()) })`), tIfr = 0, tMenu = 0;
  let s = await yt(A); const can0 = await A.ev(`({ c: MUS.cancion, est: MUS.est, chip: MUS.chip && !MUS.chip.classList.contains('oc') ? MUS.chip.textContent : '' })`);
  caso('2 · el reproductor se arma después de que el menú se puede tocar (1,2 s después, sin toque), escondido, con Casual', antes.menuT > 0 && antes.armadoT - antes.menuT >= 1150 && s && s.vid === can0.c && can0.est === 'casual',
    { antes, ms: antes.armadoT - antes.menuT, can0, ifrEstilo: await A.ev(`(() => { const r = document.querySelector('#musMini').getBoundingClientRect(), c = getComputedStyle(document.querySelector('#musMini')); return [r.width, r.height, c.opacity, c.pointerEvents]; })()`) });
  await A.p.waitForTimeout(2500); s = await yt(A);
  caso('2 · web sin toque: no se le pide sonar', s && !s.cmds.some((c) => c === 'playVideo') && s.est !== 1, s && s.cmds);
  caso('2 · la placa dice «Tocá…» antes del toque', /Tocá/.test(can0.chip), can0.chip);
  const tToque = Date.now(); await A.p.mouse.click(700, 220);
  const sono = await esperar(A, `MUS.sonando && MUS.ytEst === 1`, 5000); const tSuena = Date.now() - tToque;
  s = await yt(A);
  caso('2 · con el primer toque suena (estado «reproduciendo» por los eventos de la API) en < 1 s', sono && s.est === 1 && tSuena < 1000, { ms: tSuena, est: s.est });
  // (lo que se ve —la estación y la canción con su artista, o lo que entre entero— y su descripción, siempre completa)
  const chip1 = await A.ev(`(() => { const v = (s) => { const e = MUS.chip.querySelector(s); return e.classList.contains('oc') ? '' : e.textContent; }; return { e: v('.musChipE'), c: v('.musChipC'), lbl: MUS.chip.querySelector('.musChipT').getAttribute('aria-label') }; })()`);
  const can1 = await A.ev(`(() => { const c = musActual('casual'); return { t: c.titulo, a: c.artista }; })()`);
  caso('2 · la placa del menú dice la estación y la canción', (chip1.c === can1.t + ' · ' + can1.a || chip1.c === can1.t) && (chip1.e === 'Casual' || chip1.e === '') && chip1.lbl.includes('Casual') && chip1.lbl.includes(can1.t), { chip1, can1 });
  // 3. el volumen
  if (corre(3)) {
    await A.ev(`PREFS.vol = 80; PREFS.musVol = 60; musVolAplicar(true); 1`); await A.p.waitForTimeout(400); s = await yt(A);
    const v1 = s.vol;
    await A.ev(`musAbrirTab(); 1`); await A.p.waitForTimeout(500);
    await A.p.evaluate(() => { const r = document.getElementById('aMusV'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await A.p.waitForTimeout(400); s = await yt(A); const v2 = s.vol;
    await A.p.evaluate(() => { const r = document.getElementById('aV'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await A.p.waitForTimeout(400); s = await yt(A); const v3 = s.vol;
    const guardado = await A.ev(`JSON.parse(localStorage.getItem('jx_prefs')).musVol`);
    caso('3 · el volumen es el general por el de la música (80×60 %=48; música 30 % → 24; general 50 → 15)', v1 === 48 && v2 === 24 && v3 === 15 && guardado === 30, { v1, v2, v3, guardado });
    await A.ev(`PREFS.vol = 80; PREFS.musVol = 60; guardarPrefs(); cerrarPaneles(); $('ajustes').classList.add('oc'); musVolAplicar(true); 1`);
  }
  // 4. estaciones, siguiente y anterior
  if (corre(4)) {
    await A.ev(`musAbrirTab(); 1`); await A.p.waitForTimeout(400);
    await A.p.click('#ajustesCaja .musTarj[data-mus=westside]');
    await A.p.waitForTimeout(600); s = await yt(A);
    const w = await A.ev(`({ c: MUS.cancion, k: PREFS.musEst, en: MUS_DATOS.find((e) => e.k === 'westside').c.some((c) => c[0] === MUS.cancion), sel: document.querySelector('#ajustesCaja .musTarj.sel').dataset.mus, chip: MUS.chip.querySelector('.musChipT').getAttribute('aria-label') })`);
    caso('4 · tocar West Side cambia el video en el momento (y queda marcada y guardada)', w.en && s.vid === w.c && s.est === 1 && w.sel === 'westside' && /West Side/.test(w.chip) && (await A.ev(`JSON.parse(localStorage.getItem('jx_prefs')).musEst`)) === 'westside', { w, s: s.vid });
    // las 35 sin repetir y la vuelta nueva
    const vistos = []; for (let i = 0; i < 35; i++) { vistos.push(await A.ev(`MUS.cancion`)); await A.ev(`musSiguiente(1); 1`); }
    const vuelta = await A.ev(`MUS.cancion`);
    s = await yt(A);
    caso('4 · «siguiente» pasa por las 35 sin repetir; la vuelta nueva no empieza con la última', new Set(vistos).size === 35 && vuelta !== vistos[34] && s.vid === vuelta, { distintas: new Set(vistos).size, ultima: vistos[34], primera2: vuelta });
    // al terminar un video pasa a la siguiente, una sola (el «terminó» llega dos veces: onStateChange e infoDelivery)
    const i0 = await A.ev(`musOrden('westside').i`); await A.p.waitForTimeout(1600); await A.ev(`musYTcmd('seekTo', [179.6]); 1`);
    const paso1 = await esperar(A, `musOrden('westside').i !== ${i0}`, 5000); await A.p.waitForTimeout(1200);
    const i1 = await A.ev(`musOrden('westside').i`); s = await yt(A);
    caso('4 · al terminar el video pasa a la siguiente, una sola vez', paso1 && (i1 === i0 + 1 || (i0 === 34 && i1 === 0)) && s.est === 1, { i0, i1, est: s.est });
    const ant0 = await A.ev(`MUS.cancion`); await A.ev(`musSiguiente(1); 1`); await A.ev(`musSiguiente(-1); 1`);
    caso('4 · «anterior» vuelve a la de antes', (await A.ev(`MUS.cancion`)) === ant0);
    // cada estación recuerda por dónde iba
    const enW = await A.ev(`MUS.cancion`); await A.ev(`musElegir('ncs'); 1`); await A.p.waitForTimeout(300); await A.ev(`musElegir('westside'); 1`); await A.p.waitForTimeout(300);
    caso('4 · al volver a una estación sigue en la misma canción', (await A.ev(`MUS.cancion`)) === enW);
    await A.ev(`cerrarPaneles(); $('ajustes').classList.add('oc'); 1`);
  }
  // 5. el error 150 y muchos seguidos
  if (corre(5)) {
    const sig = await A.ev(`(() => { const p = musOrden(musElegida()); return p.o[(p.i + 1) % p.o.length]; })()`);
    const sig2 = await A.ev(`(() => { const p = musOrden(musElegida()); return p.o[(p.i + 2) % p.o.length]; })()`);
    MALOS[sig] = 150;
    // (el simulado lee la lista al cargarse: se rearma el reproductor)
    await A.ev(`musYTquitar(); MUS.est = ''; 1`); await A.p.waitForTimeout(600);
    await A.ev(`musSiguiente(1); 1`);
    const salto = await esperar(A, `MUS.cancion === ${JSON.stringify(sig2)} && MUS.sonando`, 4000);
    const nota = await A.ev(`MUS.eventos.filter((e) => e.includes(${JSON.stringify(sig)}) && /150/.test(e)).length`);
    caso('5 · un error 150 salta solo a la siguiente y queda anotado', salto && nota >= 1, { sig, sig2, ahora: await A.ev(`MUS.cancion`), eventos: await A.ev(`MUS.eventos.slice(-3)`) });
    delete MALOS[sig];
    // (todas con error: a la sexta, silencio un minuto, sin avisos)
    for (const c of await A.ev(`musLista('westside').map((c) => c[0])`)) MALOS[c] = 150;
    await A.ev(`musYTquitar(); MUS.est = ''; 1`);
    const calla = await esperar(A, `MUS.esperaHasta > Date.now() && !MUS.fu && !document.querySelector('#musMini iframe')`, 8000);
    const aviso = await A.ev(`$('aviso').classList.contains('ve') ? $('aviso').textContent : ''`);
    caso('5 · 6 errores seguidos: silencio (sin reproductor y sin avisos)', calla && !aviso, { calla, aviso, ev: await A.ev(`MUS.eventos.slice(-2)`) });
    for (const k in MALOS) delete MALOS[k];
    await A.ev(`MUS.esperaHasta = 0; MUS.errSeg = 0; musElegir('casual'); 1`); await esperar(A, `MUS.sonando`, 5000);
  }
  // 6. Sin música
  if (corre(6)) {
    await A.ev(`musAbrirTab(); 1`); await A.p.waitForTimeout(300);
    await A.p.click('#ajustesCaja .musTarj[data-mus=no]'); await A.p.waitForTimeout(600);
    const r = await A.ev(`({ ifr: document.querySelectorAll('iframe[src*="youtube"]').length, chip: !!MUS.chip && !MUS.chip.classList.contains('oc'), fu: MUS.fu })`);
    caso('6 · «Sin música» saca el reproductor y la placa', r.ifr === 0 && !r.chip && !r.fu, r);
    await A.p.click('#ajustesCaja .musTarj[data-mus=casual]'); await esperar(A, `MUS.sonando`, 5000);
    await A.ev(`cerrarPaneles(); $('ajustes').classList.add('oc'); 1`);
  }
  // 7. la partida: fundido, nada de YouTube jugando; al volver, sigue
  if (corre(7)) {
    await A.p.waitForTimeout(1500);
    const c0 = await A.ev(`MUS.cancion`); s = await yt(A); const vol0 = s.vol;
    // (el fundido solo: la pantalla de carga se abre —como al empezar una partida— pero no se carga nada, así el procesador
    // está libre y se ve la bajada entera; después se cierra y la música vuelve)
    await A.ev(`window.__carga.abrir('prueba', '', ''); 1`);
    const vols = []; const tF = Date.now(); let fuera = -1;
    while (Date.now() - tF < 3000) { s = await yt(A); if (s) vols.push(s.vol); else { fuera = await A.ev(`document.querySelectorAll('iframe[src*="youtube"]').length`); if (fuera === 0) break; } await A.p.waitForTimeout(50); }
    const medios = [...new Set(vols.filter((v) => v > 0 && v < vol0))];
    const va = await A.ev(`(() => { const p = musOrden('casual'); return { c: p.o[p.i], t: p.t, ms: MUS.fundidoMs }; })()`);
    caso('7 · al abrirse la carga de una partida: fundido (el volumen baja de a poco en ~1 s) y después ningún iframe de YouTube', medios.length >= 5 && fuera === 0 && va.c === c0 && va.ms >= 950 && va.ms <= 1300, { vol0, medios, fuera, va });
    await A.ev(`window.__carga.fin(); 1`); await esperar(A, `MUS.sonando`, 15000);
    // (y la partida de verdad, con la carga: después, nada de YouTube)
    await A.ev(`(() => { window.__cargaPrueba = true; RB.horaPartida = 'normal'; RB.mapaPartida = null; SALA = null; CREA.on = false; entrarConCarga('x', 'FlatGrass', () => { inicioMostrar(false); return empezarPartida('FlatGrass'); }); return 1; })()`);
    await esperar(A, `JUEGO.estado === 'juego'`, 60000); await A.p.waitForTimeout(2000);
    caso('7 · jugando no hay reproductor de la música', (await A.ev(`document.querySelectorAll('#musMini iframe').length + (MUS.au ? 1 : 0)`)) === 0);
    // (dónde quedó: la canción y el segundo guardados al empezar la partida)
    const va2 = await A.ev(`(() => { const p = musOrden('casual'); return { c: p.o[p.i], t: p.t }; })()`);
    await A.ev(`irMenuPrincipal(); 1`);
    await esperar(A, `MUS.sonando`, 15000);
    const src = await A.ev(`(document.querySelector('#musMini iframe') || {}).src || ''`), st = +((/[?&]start=(\d+)/.exec(src) || [])[1] || -1);
    caso('7 · al volver al menú sigue la misma canción desde donde iba', (await A.ev(`MUS.cancion`)) === va2.c && src.includes(va2.c) && st >= Math.max(0, va2.t - 1) && st <= va2.t + 1, { c: va2.c, start: st, t: va2.t });
  }
  // 8. segundo plano y el editor de la música de los emotes
  if (corre(8)) {
    await esperar(A, `MUS.sonando`, 5000);
    await A.ev(`__jxFondo(1); 1`); await A.p.waitForTimeout(1200); s = await yt(A);
    const pausa = s.est === 2; const cur0 = s.cur; await A.p.waitForTimeout(1500); s = await yt(A);
    caso('8 · en segundo plano (la app al pausarse) queda en pausa y no avanza', pausa && s.est === 2 && s.cur === cur0, { est: s.est, cur0, cur: s.cur });
    await A.ev(`__jxFondo(0); 1`); const vuelve = await esperar(A, `MUS.ytEst === 1`, 4000);
    caso('8 · al volver, sigue', vuelve);
    await A.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await A.p.waitForTimeout(1000); s = await yt(A); const ocult = s.est;
    await A.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    const vuelve2 = await esperar(A, `MUS.ytEst === 1`, 4000);
    caso('8 · con la página oculta (visibilitychange) también, y vuelve', ocult === 2 && vuelve2, { ocult });
    await A.ev(`EMU.ed = { id: 'x' }; 1`); await A.p.waitForTimeout(800); s = await yt(A); const conEd = s.est;
    await A.ev(`EMU.ed = null; 1`); const vuelve3 = await esperar(A, `MUS.ytEst === 1`, 4000);
    caso('8 · con el editor de la música de los emotes abierto se calla; al cerrarlo sigue', conEd === 2 && vuelve3, { conEd });
  }
  await A.ctx.close();
}
// 9. la app de Android: sin toque
if (corre(9)) {
  const A = await abrir('app', { nativo: true });
  await menuListo(A);
  const sono = await esperar(A, `MUS.sonando && MUS.ytEst === 1`, 10000);
  caso('9 · en la app (JXNativo) suena sola, sin toque', sono && !(await A.ev(`MUS.toque`)), await A.ev(`({ nativo: MUS.nativo, ytEst: MUS.ytEst })`));
  await A.ctx.close();
}

// ======================= 10. Casual sin internet (con el paquete) =======================
if (corre(10) && HTML_PAQ) {
  const A = await abrir('paquete', { url: HTML_PAQ });
  await menuListo(A); const tm = Date.now();
  const info = await A.ev(`musPaqInfo()`);
  await A.p.mouse.click(700, 220);
  const bajo = await esperar(A, `MUS.paq.est === 'listo'`, 120000); const tBaja = Date.now() - tm;
  const paq = await A.ev(`({ est: MUS.paq.est, n: Object.keys(MUS.paq.idx || {}).length, ms: MUS.paq.ms, cache: !!MUS.paq.cache })`);
  caso('10 · el paquete de Casual se baja solo después de que el menú se puede tocar y queda guardado (35 canciones)', bajo && paq.n === 35 && paq.cache, { info, paq, msDesdeMenu: tBaja });
  await A.ev(`musSiguiente(1); 1`);
  const ar = await esperar(A, `MUS.fu === 'ar' && MUS.au && !MUS.au.paused && MUS.au.currentTime > 0.5`, 10000);
  caso('10 · la siguiente suena del archivo (<audio>, avanza) y ya no hay YouTube', ar && (await A.ev(`document.querySelectorAll('#musMini iframe').length`)) === 0, await A.ev(`({ fu: MUS.fu, t: MUS.au && MUS.au.currentTime, src: MUS.au && MUS.au.src.slice(0, 10), vol: MUS.au && MUS.au.volume })`));
  const vol = await A.ev(`Math.abs(MUS.au.volume - PREFS.vol / 100 * musVolumen() / 100) < 0.01`);
  caso('10 · el <audio> con el mismo volumen (general × música)', vol);
  // sin internet: sigue y las siguientes también
  await A.ctx.setOffline(true);
  await A.ev(`musSiguiente(1); 1`);
  const sin = await esperar(A, `MUS.fu === 'ar' && !MUS.au.paused && MUS.au.currentTime > 0.5`, 10000);
  caso('10 · sin internet la siguiente también suena (de la caché)', sin, await A.ev(`({ fu: MUS.fu, online: navigator.onLine, ev: MUS.eventos.slice(-2) })`));
  // la página nueva: el HTML de nuevo con internet, y enseguida sin (la música tiene que salir de lo guardado)
  await A.ctx.setOffline(false);
  await A.p.reload(); await A.p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await A.ctx.setOffline(true);
  await menuListo(A); await A.p.mouse.click(700, 220);
  const otra = await esperar(A, `MUS.paq.est === 'listo' && MUS.fu === 'ar' && !MUS.au.paused && MUS.au.currentTime > 0.5`, 15000);
  caso('10 · al abrir de nuevo, sin internet, Casual suena de lo guardado', otra, await A.ev(`({ paq: MUS.paq.est, fu: MUS.fu, online: navigator.onLine })`));
  // la memoria: la página con la música de archivo sonando
  const mem = await A.ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1`);
  caso('10 · memoria de JS con la música del archivo sonando (MB)', mem > 0, mem);
  await A.ctx.setOffline(false);
  await A.ctx.close();
}

// ======================= 11. Mi música =======================
if (corre(11)) {
  const T0 = tmpdir() + '/musica_prueba_' + process.pid; mkdirSync(T0, { recursive: true });
  const F = [['uno.mp3', ['-c:a', 'libmp3lame', '-b:a', '96k']], ['dos.ogg', ['-c:a', 'libopus', '-b:a', '48k']], ['tres.m4a', ['-c:a', 'aac', '-b:a', '96k']]].map(([n, c], i) => {
    const f = T0 + '/' + n; execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${330 + 110 * i}:duration=20`, '-ac', '2', ...c, f]); return f; });
  const A = await abrir('mia');
  await menuListo(A); await A.p.mouse.click(700, 220);
  await A.ev(`musAbrirTab(); 1`); await A.p.waitForTimeout(400);
  await A.p.click('#ajustesCaja .musTarj[data-mus=mia]'); await A.p.waitForTimeout(300);
  await A.p.setInputFiles('#ajustesCaja .musMiaAgr input', F);
  const tres = await esperar(A, `(MUS.mias || []).length === 3 && MUS.fu === 'ar' && !MUS.au.paused && MUS.au.currentTime > 0.3`, 10000);
  const li = await A.ev(`[...document.querySelectorAll('#ajustesCaja .musMiaL li')].map((l) => l.textContent.trim())`);
  caso('11 · se agregan 3 archivos, se ven con su tamaño y suenan del aparato', tres && li.length === 3 && li.every((t) => /KB|MB/.test(t)), { li, fu: await A.ev(`MUS.fu`) });
  await A.ctx.setOffline(true); await A.ev(`musSiguiente(1); 1`);
  const sinRed = await esperar(A, `MUS.fu === 'ar' && !MUS.au.paused && MUS.au.currentTime > 0.3`, 8000);
  caso('11 · sin internet siguen sonando', sinRed);
  await A.ctx.setOffline(false);
  await A.p.reload(); await A.p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await menuListo(A); await A.p.mouse.click(700, 220);
  const quedan = await esperar(A, `(MUS.mias || []).length === 3 && MUS.fu === 'ar' && !MUS.au.paused`, 25000);
  caso('11 · al recargar quedan los 3 y suena Mi música', quedan, await A.ev(`({ n: (MUS.mias || []).length, k: musElegida(), fu: MUS.fu, est: MUS.est, c: MUS.cancion, au: !!MUS.au, pausa: MUS.au && MUS.au.paused, src: MUS.au && MUS.au.src.slice(0, 12), err: MUS.au && MUS.au.error && MUS.au.error.code, toque: MUS.toque, bloq: MUS.bloqueado, ev: MUS.eventos.slice(-3) })`));
  await A.ev(`musAbrirTab(); 1`); await A.p.waitForTimeout(400);
  await A.p.click('#ajustesCaja .musMiaL li:first-child [data-musx]'); await A.p.waitForTimeout(500);
  const dos = await A.ev(`(MUS.mias || []).length`);
  await A.p.reload(); await A.p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await menuListo(A);
  await A.ev(`musMiaLeer(); 1`); await A.p.waitForTimeout(500);
  caso('11 · se saca uno: quedan 2 (también al recargar)', dos === 2 && (await A.ev(`(MUS.mias || []).length`)) === 2);
  // el tope: un archivo «de» 301 MB (un Blob de mentira con ese tamaño no hace falta: se prueba la cuenta)
  const tope = await A.ev(`(async () => { const f = new File([new Uint8Array(16)], 'grande.mp3', { type: 'audio/mpeg' }); Object.defineProperty(f, 'size', { value: 301 * 1048576 }); const n = await musMiaAgregar([f]); return { n, aviso: $('aviso').textContent }; })()`);
  caso('11 · más de 300 MB: no se guarda y avisa', tope.n === 0 && /300/.test(tope.aviso), tope);
  await A.ctx.close();
}

// ======================= 12. la placa del menú: pantallas e idiomas =======================
// lo que no puede pisar: todo lo que se ve y se toca del menú
const PISABLES = `.clLogo, .clLista .clIt, .clArriba > *, .clAbajo > *, .clVerG > *:not(.oc), .dpPerfil, .dpVer, .dpDer > *, .dpAyuda:not(.oc), .dpMapa, .dpJugar, .dpCaja`;
const MEDIR_CHIP = `(() => {
  const c = MUS.chip; if (!c || c.classList.contains('oc') || c.style.visibility === 'hidden') return { falta: true };
  const home = c.parentElement, W = home.clientWidth, H = home.clientHeight;
  const R = (e) => { let x = 0, y = 0, n = e; while (n && n !== home) { x += n.offsetLeft; y += n.offsetTop; const t = getComputedStyle(n).transform; if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); x += m.m41; y += m.m42; } n = n.offsetParent; } return { x, y, r: x + e.offsetWidth, b: y + e.offsetHeight, w: e.offsetWidth, h: e.offsetHeight }; };
  const ins = getComputedStyle(home.querySelector('.clSonda, .dpSonda') || home); const iz = parseFloat(ins.paddingLeft) || 0;
  const rc = R(c), pisa = [];
  for (const e of home.querySelectorAll(${JSON.stringify(PISABLES)})) { if (!e.offsetWidth || e.closest('.oc')) continue; const r = R(e); if (r.x < rc.r && rc.x < r.r && r.y < rc.b && rc.y < r.b) pisa.push((e.className.baseVal ?? e.className) + ''); }
  const bts = [...c.querySelectorAll('button')].filter((x) => !x.classList.contains('oc') && x.offsetWidth);
  // (lo que se toca: el botón con su ::before, si se estira)
  const toca = bts.map((x) => { const s = getComputedStyle(x, '::before'), ext = s.content !== 'none' && s.position === 'absolute' ? Math.max(0, -parseFloat(s.top) || 0) + Math.max(0, -parseFloat(s.bottom) || 0) : 0; return [Math.round(x.offsetWidth), Math.round(x.offsetHeight + ext)]; });
  const letras = [...c.querySelectorAll('.musChipE, .musChipC')].filter((x) => x.offsetWidth).map((x) => parseFloat(getComputedStyle(x).fontSize));
  // (nada cortado: ni el texto ni su caja —con overflow escondido— se pasan de lo que se ve; como pruebas/menu_clasico.mjs)
  const cortado = [...c.querySelectorAll('.musChipX, .musChipE, .musChipC')].some((x) => x.offsetWidth && x.scrollWidth > x.clientWidth + 1);
  return { W, H, x: rc.x, y: rc.y, w: rc.w, h: rc.h, adentro: rc.x >= Math.max(0, iz) - 0.5 && rc.y >= -0.5 && rc.r <= W + 0.5 && rc.b <= H + 0.5, pisa, toca, letras, cortado, corta: c.classList.contains('musCorta'), rtl: RB.el.dir === 'rtl' };
})()`;
// el contraste: el color del texto contra el de la placa —que es un poco transparente: lo peor, encima de algo blanco— (en el
// clásico, la placa es el ::after del botón; en el depósito, el fondo del botón); el nombre de la estación va de su color:
// se miden los de las 12
const CONTRASTE = `(() => {
  const c = MUS.chip, rgb = (s) => s.match(/[\\d.]+/g).map(Number), lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (m) => 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]), cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const t = c.querySelector('.musChipT'); let f = getComputedStyle(t).backgroundColor;
  if (/clChip/.test(t.className)) f = getComputedStyle(t, '::after').backgroundColor;
  const m = rgb(f), a = m[3] === undefined ? 1 : m[3], peor = [0, 1, 2].map((i) => a * m[i] + (1 - a) * 255), lf = L(peor);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const res = { cancion: +cr(L(rgb(getComputedStyle(c.querySelector('.musChipC')).color)), lf).toFixed(2) };
  for (const e of MUS_EST.concat([['mia', '#ffd166']])) res[e[0]] = +cr(L(hex(e[1])), lf).toFixed(2);
  return { fondo: f, peor: peor.map(Math.round), res };
})()`;
if (corre(12)) {
  const PANT = [['celu', 873, 402, true, 40], ['chico', 640, 360, true, 0], ['parado', 402, 873, true, 0], ['tablet', 1180, 820, true, 0], ['compu', 1280, 720, false, 0]];
  for (const menu of ['clasico', 'deposito']) for (const [n, w, h, movil, ins] of PANT) {
    const A = await abrir(menu + ' ' + n, { w, h, movil, ins, prefs: { menuInicio: menu }, auto: true });
    await menuListo(A); await A.p.mouse.click(Math.round(w * 0.6), Math.round(h * 0.4)); await esperar(A, `MUS.sonando`, 6000);
    await A.p.waitForTimeout(menu === 'deposito' ? 6000 : 2500);
    const m = await A.ev(MEDIR_CHIP), con = m.falta ? null : await A.ev(CONTRASTE);
    const ok = !m.falta && m.adentro && !m.pisa.length && m.toca.every(([tw, th]) => tw >= 44 && th >= 44) && m.letras.every((f) => f >= 14) && !m.cortado && Object.values(con.res).every((x) => x >= 4.5);
    caso(`12 · placa · ${menu} ${n} ${w}×${h}`, ok, { m, con });
    await A.p.screenshot({ path: `${D}placa_${menu}_${n}.jpg`, type: 'jpeg', quality: 80 });
    await A.ctx.close();
  }
  // los 14 idiomas (en el clásico y el depósito, 873×402 con muesca y 640×360)
  for (const menu of ['clasico', 'deposito']) for (const [w, h, ins] of [[873, 402, 40], [640, 360, 0]]) {
    const A = await abrir(menu + ' idiomas ' + w, { w, h, ins, movil: true, prefs: { menuInicio: menu }, auto: true });
    await menuListo(A); await A.p.mouse.click(Math.round(w * 0.6), Math.round(h * 0.4)); await esperar(A, `MUS.sonando`, 6000); await A.p.waitForTimeout(menu === 'deposito' ? 5000 : 1500);
    const malos = [];
    for (const l of IDIOMAS) {
      await A.ev(`idiomaAplicar('${l}'); inicioLista(); 1`); await A.p.waitForTimeout(menu === 'deposito' ? 900 : 700);
      const m = await A.ev(MEDIR_CHIP);
      const bien = !m.falta && m.adentro && !m.pisa.length && m.toca.every(([tw, th]) => tw >= 44 && th >= 44) && m.letras.every((f) => f >= 14) && !m.cortado && (l === 'ar') === m.rtl;
      if (!bien) malos.push({ l, m });
      if (l === 'ar' || l === 'ja') await A.p.screenshot({ path: `${D}placa_${menu}_${w}_${l}.jpg`, type: 'jpeg', quality: 75 });
    }
    caso(`12 · placa · ${menu} ${w}×${h}: los 14 idiomas (árabe espejado)`, !malos.length, malos);
    await A.ctx.close();
  }
}

// ======================= 13. la pestaña Música =======================
if (corre(13)) {
  for (const [n, w, h, movil, ins] of [['celu', 873, 402, true, 40], ['chico', 640, 360, true, 0], ['compu', 1280, 720, false, 0]]) {
    const A = await abrir('pestaña ' + n, { w, h, movil, ins, auto: true });
    await menuListo(A); await A.p.mouse.click(Math.round(w * 0.6), Math.round(h * 0.4)); await esperar(A, `MUS.sonando`, 6000);
    const malos = [];
    for (const l of IDIOMAS) {
      await A.ev(`idiomaAplicar('${l}'); inicioLista(); cerrarPaneles(); musAbrirTab(); 1`); await A.p.waitForTimeout(500);
      // (desde la 3.7 el cartel entra con una animación —se agranda un poco y gira—: se mide cuando terminó)
      await A.ev(`Promise.all(document.getElementById('ajustesCaja').getAnimations({ subtree: true }).map((a) => a.finished.catch(() => 0))).then(() => 1)`);
      const m = await A.ev(`(() => {
        const S = document.querySelector('#ajustesCaja [data-ajs=mu]'); if (!S || S.classList.contains('oc')) return { falta: true };
        const tar = [...S.querySelectorAll('.musTarj')], bts = [...S.querySelectorAll('button, .musMiaAgr, input[type=range]')].filter((x) => x.offsetWidth && !x.closest('.oc'));
        const chicos = bts.filter((x) => x.type !== 'range' && (x.offsetHeight < 44 || x.offsetWidth < 44)).map((x) => (x.dataset.mus || x.className) + ':' + x.offsetWidth + 'x' + x.offsetHeight);
        const letras = [...S.querySelectorAll('b, small, span, p, li')].filter((x) => x.offsetWidth && x.childElementCount === 0 && x.textContent.trim()).map((x) => parseFloat(getComputedStyle(x).fontSize));
        const sale = [...S.querySelectorAll('.musTarj, .musAhora, .musMiaL li')].filter((x) => x.scrollWidth > x.offsetWidth + 1).map((x) => x.dataset.mus || x.className);
        const caja = document.getElementById('ajustesCaja').getBoundingClientRect(), dentro = caja.left >= -0.5 && caja.right <= innerWidth + 0.5 && caja.top >= -0.5 && caja.bottom <= innerHeight + 0.5;
        const sel = S.querySelectorAll('.musTarj.sel').length, horiz = S.parentElement.scrollWidth > S.parentElement.clientWidth + 1;
        // (la pestaña entera adentro de lo que se ve de su columna, abierta desde la placa del menú)
        const tb = document.querySelector('#ajustesCaja .ajTabs [data-aj=mu]'), col = tb.parentElement, rb = tb.getBoundingClientRect(), rc = col.getBoundingClientRect();
        const pestana = rb.top >= rc.top - 0.5 && rb.bottom <= rc.bottom + 0.5 && rb.left >= rc.left - 0.5 && rb.right <= rc.right + 0.5 && tb.classList.contains('sel');
        const pestanaR = [Math.round(rb.top - rc.top), Math.round(rc.bottom - rb.bottom)];
        return { n: tar.length, chicos, minLetra: Math.min(...letras), sale, dentro, sel, horiz, pestana, pestanaR, dir: getComputedStyle(S).direction };
      })()`);
      const bien = !m.falta && m.n === 12 && !m.chicos.length && m.minLetra >= 14 && !m.sale.length && m.dentro && m.sel === 1 && !m.horiz && m.pestana;
      if (!bien) malos.push({ l, m });
      if (l === 'es' || l === 'ar') await A.p.screenshot({ path: `${D}pestana_${n}_${l}.jpg`, type: 'jpeg', quality: 82 });
    }
    caso(`13 · pestaña Música · ${n} ${w}×${h}: la pestaña entera a la vista en su columna, 12 tarjetas, ≥ 44 px, letra ≥ 14 px, nada se sale (14 idiomas)`, !malos.length, malos.slice(0, 4));
    await A.ctx.close();
  }
}

// ======================= 15. el costo (con BASE=URL de la 3.6) =======================
// (como pruebas/menu_clasico.mjs: el procesador 4× más lento, 873×402 a 2×, en el menú quieto; corridas alternadas)
//  · el tiempo hasta poder tocar el menú, contra la 3.6 (no más de 3 % arriba, en la mediana: la máquina compartida da ±2 s);
//  · con la música sonando contra sin música: ms de JS y del hilo principal por segundo, el heap, y el procesador y la
//    memoria de todos los procesos del navegador (el reproductor de YouTube va en su propio proceso; en Android, en el
//    mismo): sin música, YouTube de verdad (carga; desde acá no reproduce) y Casual del archivo (Opus, sonando de verdad);
//  · lo que baja el reproductor de YouTube al armarse (la página y su código).
if (corre(15) && process.env.BASE) {
  const { readFileSync, readdirSync } = await import('fs');
  const N = +(process.env.CORRIDAS || 3), CLK = 100;
  const arbol = (pid) => { const hijos = {}; for (const d of readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = readFileSync(`/proc/${d}/stat`, 'utf8'), pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; (hijos[pp] = hijos[pp] || []).push(+d); } catch (e) {} } const L = [pid]; for (let i = 0; i < L.length; i++) L.push(...(hijos[L[i]] || [])); return L; };
  const cpu = (L) => L.reduce((a, p) => { try { const f = readFileSync(`/proc/${p}/stat`, 'utf8').slice(readFileSync(`/proc/${p}/stat`, 'utf8').lastIndexOf(')') + 2).split(' '); return a + (+f[11]) + (+f[12]); } catch (e) { return a; } }, 0) / CLK;
  const rss = (L) => L.reduce((a, p) => { try { const m = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${p}/status`, 'utf8')); return a + (m ? +m[1] : 0); } catch (e) { return a; } }, 0) / 1024;
  async function tocable(url) {
    const bb = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0({ dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }));
    await ctx.addInitScript(() => { window.__toc = null; const mira = () => { const j = document.querySelector('#rbInicio .clIt.clPri, #rbInicio .dpJugar'), c = document.getElementById('carga'), ri = document.getElementById('rbInicio'); if (j && j.offsetWidth > 0 && ri && !ri.classList.contains('oc') && (!c || c.classList.contains('oc') || c.classList.contains('salir'))) { setTimeout(() => { window.__toc = performance.now(); }, 0); return; } requestAnimationFrame(mira); }; requestAnimationFrame(mira); });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(url + '?test&perezoso&gfx=bajo'); await p.waitForFunction(() => window.__toc, null, { timeout: 300000 });
    const r = await p.evaluate(() => window.__toc); await bb.close(); return r;
  }
  // (el proceso del navegador se encuentra por una marca en su línea de comandos)
  const raiz = (marca) => { const L = []; for (const d of readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { if (readFileSync(`/proc/${d}/cmdline`, 'utf8').includes(marca)) L.push(+d); } catch (e) {} } const S = new Set(L); return L.find((p) => { try { const st = readFileSync(`/proc/${p}/stat`, 'utf8'); return !S.has(+st.slice(st.lastIndexOf(')') + 2).split(' ')[1]); } catch (e) { return false; } }); };
  async function costo(url, esc) {
    const marca = '--jx-medida=' + process.pid + '-' + Math.random().toString(36).slice(2);
    const bb = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS.concat(['--autoplay-policy=no-user-gesture-required', marca]) });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0({ musEst: esc === 'no' ? 'no' : 'casual' }));
    const p = await ctx.newPage(); let ytBytes = 0;
    ctx.on('requestfinished', async (r) => { if (/youtube|ytimg|googlevideo|ggpht/.test(r.url())) { try { const z = await r.sizes(); ytBytes += z.responseBodySize + z.responseHeadersSize; } catch (e) {} } });
    const ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(url + '?test&gfx=bajo'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
    await p.waitForFunction(() => window.__ev(`musEnMenu()`), null, { timeout: 60000 }); await p.mouse.click(600, 200);
    if (esc === 'ar') { await p.waitForFunction(() => window.__ev(`MUS.paq.est === 'listo'`), null, { timeout: 120000 }); await ev(`musSiguiente(1); 1`); await p.waitForFunction(() => window.__ev(`MUS.fu === 'ar' && !MUS.au.paused`), null, { timeout: 20000 }); }
    if (esc === 'yt') { await ev(`MUS.paq.est = 'no'; MUS.paq.idx = null; 1`); await p.waitForFunction(() => window.__ev(`!!MUS.ytListo`), null, { timeout: 30000 }); }
    await p.waitForTimeout(4000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(1500);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const pid = raiz(marca), L = arbol(pid), m0 = await met(), c0 = cpu(L), t0 = Date.now();
    await p.waitForTimeout(8000);
    const m1 = await met(), c1 = cpu(arbol(pid)), t1 = Date.now(), mem = rss(arbol(pid));
    await cdp.send('HeapProfiler.collectGarbage'); const m2 = await met();
    const sono = await ev(`({ fu: MUS.fu, sonando: MUS.sonando || (MUS.au && !MUS.au.paused) })`);
    await bb.close();
    const s = (t1 - t0) / 1000;
    return { js: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / s, hilo: (m1.TaskDuration - m0.TaskDuration) * 1000 / s, heap: m2.JSHeapUsedSize / 1048576, cpuPct: (c1 - c0) / s * 100, rssMB: mem, ytKB: ytBytes / 1024, sono };
  }
  // el tiempo hasta poder tocar, alternando (PARTE15=tocable o costo: sólo eso)
  const P15 = process.env.PARTE15 || '', prom = (L) => L.reduce((a, x) => a + x, 0) / L.length;
  if (P15 !== 'costo') {
  const T = { '3.6': [], ahora: [] };
  for (let i = 0; i < N; i++) for (const [k, u] of i % 2 ? [['ahora', HTML], ['3.6', process.env.BASE]] : [['3.6', process.env.BASE], ['ahora', HTML]]) T[k].push(await tocable(u));
  const t36 = prom(T['3.6']), tAh = prom(T.ahora);
  const med = (L) => { const a = L.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }, m36 = med(T['3.6']), mAh = med(T.ahora);
  caso(`15 · hasta poder tocar el menú (4× más lento, ${N} corridas alternadas): la 3.6 ${Math.round(t36)} ms (mediana ${Math.round(m36)}), ahora ${Math.round(tAh)} ms (mediana ${Math.round(mAh)}): ${((tAh / t36 - 1) * 100).toFixed(1)} % (no más de 3 % arriba, en la mediana)`, mAh <= m36 * 1.03, T);
  }
  if (P15 !== 'tocable') {
  // el costo de la música sonando
  const C = {}; for (const e of ['no', 'yt', 'ar']) C[e] = [];
  const URLS = { no: HTML, yt: HTML, ar: HTML_PAQ || HTML };
  for (let i = 0; i < Math.max(2, N - 1); i++) for (const e of ['no', 'yt', 'ar']) { if (e === 'ar' && !HTML_PAQ) continue; const r = await costo(URLS[e], e); C[e].push(r); console.log('  costo', e, JSON.stringify(r)); }
  const R2 = {}; for (const e in C) if (C[e].length) { R2[e] = {}; for (const k of ['js', 'hilo', 'heap', 'cpuPct', 'rssMB', 'ytKB']) R2[e][k] = +prom(C[e].map((x) => x[k])).toFixed(1); R2[e].sono = C[e].map((x) => x.sono.fu + (x.sono.sonando ? '+' : '-')).join(' '); }
  console.log('costo en el menú (4× más lento, 873×402 a 2×; js y hilo en ms por segundo; cpuPct de todos los procesos; rssMB suma de todos):\n' + Object.entries(R2).map(([e, r]) => '  ' + e.padEnd(3) + ' ' + JSON.stringify(r)).join('\n'));
  caso('15 · el costo medido (sin música, YouTube cargado, Casual del archivo sonando)', !!R2.no, R2);
  }
}

caso('14 · sin errores de JS', !errJS.length, errJS.slice(0, 10));
await b.close(); await bAuto.close();
const ok = RES.filter(Boolean).length; console.log(`\n${ok}/${RES.length} pasaron`);
process.exit(ok === RES.length ? 0 : 1);
