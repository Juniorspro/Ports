// El celular con más usos (Bugs y sugerencias 9iipm4vz: «cambiar el celular, ahora no tiene casi utilidad»):
//  1. en el inicio están Autos, Radar, Hora y Linterna (con su nombre traducido), además de las de antes;
//  2. Autos: la lista de vehículos; tocar uno lo pone delante;
//  3. Hora: «Noche» pone las 0:00, la barra cambia la hora y «que el tiempo corra solo» prende el ciclo;
//  4. Linterna: un toque la prende y otro la apaga;
//  5. Radar: un NPC 10 m adelante aparece como un punto rojo arriba del centro (adelante es arriba), y uno a la derecha,
//     a la derecha;
//  6. sin errores de JS. Fotos del inicio, el radar y la hora (CELU=1: en el celular).
// uso: node celular_apps.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/celular_apps'] = process.argv; fs.mkdirSync(D, { recursive: true });
const suf = process.env.CELU ? '_celu' : '';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test', !!process.env.CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 }); await p.waitForTimeout(1200);
const toca = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
await ev(`(() => { celAbrir(); return 1; })()`); await p.waitForTimeout(700);
const st1 = await ev(`[...document.querySelectorAll('#celular .celApp small')].map((x) => x.textContent)`);
await p.screenshot({ path: D + '/1_inicio' + suf + '.png' });
ok('1. Autos, Radar, Hora y Linterna en el inicio', ['Autos', 'Radar', 'Hora', 'Linterna'].every((x) => st1.includes(x)) && st1.length >= 11, st1);
// 2
await toca('[data-cel="app|autos"]'); await p.waitForTimeout(500);
const autos = await ev(`[...document.querySelectorAll('#celular .celIt')].map((x) => x.dataset.cel).slice(0, 6)`);
const v0 = await ev(`VEHS.length`); await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0.2; return 1; })()`); await p.waitForTimeout(300);
await toca('#celular .celIt'); await p.waitForTimeout(1200);
const v1 = await ev(`VEHS.length`);
ok('2. Autos: la lista y tocar uno lo pone delante', autos.length > 0 && v1 === v0 + 1, { autos, v0, v1 });
// 3
await toca('[data-cel="home"]'); await toca('[data-cel="app|hora"]'); await p.waitForTimeout(400);
await toca('[data-celh="0"]'); const h0 = await ev(`DIA.hora`);
await ev(`(() => { const r = document.querySelector('#celular .celHoraR'); r.value = 15.5; r.oninput({ target: r }); const c = document.querySelector('#celular .celCiclo input'); c.checked = true; c.onchange({ target: c }); return 1; })()`);
const h1 = await ev(`[DIA.hora, DIA.ciclo, document.querySelector('#celular .celHoraGrande').textContent]`);
await p.screenshot({ path: D + '/2_hora' + suf + '.png' });
await ev(`(() => { DIA.ciclo = false; DIA.hora = 12; DIA.aplicada = -1; diaAplicar(); return 1; })()`);
ok('3. Hora: Noche, la barra y el ciclo', h0 === 0 && Math.abs(h1[0] - 15.5) < 0.2 && h1[1] === true && h1[2] === '15:30', { h0, h1 });
// 4
await toca('[data-cel="home"]'); const l0 = await ev(`!!LINT.on`); await toca('[data-cel="app|linterna"]'); const l1 = await ev(`!!LINT.on`); await toca('[data-cel="app|linterna"]'); const l2 = await ev(`!!LINT.on`);
ok('4. Linterna: prende y apaga', l0 === false && l1 === true && l2 === false, [l0, l1, l2]);
// 5: dos NPC, uno adelante y otro a la derecha
await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0; return 1; })()`); await p.waitForTimeout(400);
await ev(`(() => { const f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), d = v3(CAM.der.x, 0, CAM.der.z).norm(); window.__a = npcCrear('Hero', vadd(JUG.pos, vscale(f, 10)), 0); window.__d = npcCrear('Hero', vadd(JUG.pos, vscale(d, 12)), 0); return 1; })()`);
await toca('[data-cel="app|radar"]'); await p.waitForTimeout(1200);
const rad = await ev(`(() => { const cv = document.querySelector('#celular .celRadar canvas'); if (!cv) return null; const x = cv.getContext('2d'), W = cv.width, k = (W / 2) / 40, c = W / 2;
  const rojo = (px, py) => { const d = x.getImageData(px - 3, py - 3, 7, 7).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 130 && d[i + 2] < 120) return true; return false; };
  const pa = window.__a.pos, pd = window.__d.pos, da = Math.hypot(pa.x - JUG.pos.x, pa.z - JUG.pos.z), dd = Math.hypot(pd.x - JUG.pos.x, pd.z - JUG.pos.z);
  return { adelante: rojo(c, Math.round(c - da * k)), derecha: rojo(Math.round(c + dd * k), c), da: +da.toFixed(1), dd: +dd.toFixed(1) }; })()`);
await p.screenshot({ path: D + '/3_radar' + suf + '.png' });
ok('5. Radar: el NPC de adelante arriba y el de la derecha a la derecha', rad && rad.adelante && rad.derecha, rad);
const errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource|willReadFrequently/.test(x));   // (el aviso de getImageData es de esta prueba, que lee el radar)
ok('6. sin errores de JS', !errJs.length, errJs.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
