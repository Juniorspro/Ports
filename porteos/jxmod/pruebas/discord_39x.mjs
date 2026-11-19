// Lo del Discord después de la 3.9.1, en el navegador (celular apaisado):
//  · el recorte de la cámara (GOLDEN): la imagen ocupa toda la pantalla y sólo los botones se corren (jxMargenes, hud.js)
//  · la cámara de frente (Rampa: «2ª persona, verte de frente»): el botón pasa por 1ª → 3ª → de frente → 1ª
//  · un video del aparato en la tele (34Bits): suena por el juego y se ve en la pantalla como textura; y la grabación del
//    juego graba su imagen y su sonido (con YouTube no se puede: es otro sitio)
//  · los personajes importados en la pestaña de NPCs, como NPC y como muñeco de trapo
// uso: node discord_39x.mjs URL_HTML CARPETA   (el video de prueba: prueba_video.mp4 al lado del HTML)
import { abrir } from './base.mjs';
import fs from 'fs';
import { execSync } from 'child_process';
const [, , HTML, D = '/tmp/claude-0/d39x'] = process.argv; fs.mkdirSync(D, { recursive: true });
const { b, p, err, ev } = await abrir(HTML, true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
await ev(`cerrarPaneles(); DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); 1`);
// 1) el recorte de la cámara: 40 px a la izquierda
const antes = await ev(`(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top)]; }; return { pausa: r('[data-btn=pausa]') || r('#bpausa'), cv: [R.cv.getBoundingClientRect().left, R.cv.getBoundingClientRect().width, innerWidth] }; })()`);
await ev(`jxMargenes([40, 0, 0, 0]); 1`); await p.waitForTimeout(400);
const desp = await ev(`(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top)]; }; return { pausa: r('[data-btn=pausa]') || r('#bpausa'), cv: [R.cv.getBoundingClientRect().left, R.cv.getBoundingClientRect().width, innerWidth], sa: getComputedStyle(document.documentElement).getPropertyValue('--jxSaL') }; })()`);
ok('con 40 px de recorte la imagen sigue ocupando todo el ancho', desp.cv[0] === 0 && Math.abs(desp.cv[1] - desp.cv[2]) < 1, desp.cv);
ok('y los botones de la izquierda se corren ≥ 30 px', antes.pausa && desp.pausa && desp.pausa[0] - antes.pausa[0] >= 30, { antes: antes.pausa, despues: desp.pausa, sa: desp.sa });
await p.screenshot({ path: `${D}/1_recorte.jpg`, type: 'jpeg', quality: 80 });
await ev(`jxMargenes([0, 0, 0, 0]); 1`);
// 2) la cámara de frente
const cams = [];
for (let k = 0; k < 4; k++) {
  await ev(`(() => { const e = new KeyboardEvent('keydown', { code: 'KeyV', key: 'v', bubbles: true }); document.dispatchEvent(e); setTimeout(() => { const u = new KeyboardEvent('keyup', { code: 'KeyV', key: 'v', bubbles: true }); document.dispatchEvent(u); }, 60); return 1; })()`);
  await p.waitForTimeout(700);
  cams.push(await ev(`(() => { const d = vsub(CAM.pos, JUG.ojoPos), f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); return [JUG.tercera ? (JUG.frente ? 'frente' : 'tercera') : 'primera', +(d.x * f.x + d.z * f.z).toFixed(2)]; })()`));
  if (cams[k][0] === 'frente') await p.screenshot({ path: `${D}/2_frente.jpg`, type: 'jpeg', quality: 80 });
}
ok('la cámara pasa por 3ª, de frente (adelante de la cara) y vuelve a 1ª', cams[0][0] === 'tercera' && cams[0][1] < -1 && cams[1][0] === 'frente' && cams[1][1] > 1 && cams[2][0] === 'primera', cams);
// 3) un video del aparato en la tele
await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0.05; return 1; })()`);
const tv = await ev(`(async () => {
  const r = await fetch('prueba_video.mp4'), bl = await r.blob(); const id = ++LOCALF.n; LOCALF.m.set(id, { url: URL.createObjectURL(bl), nombre: 'prueba.mp4', video: true });
  const e = entidadCrear({ t: 'pantalla', p: [JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z + 3.2], yaw: Math.PI, prm: { w: 2, fz: 1 } });
  if (!e) return { error: 'sin entidad' }; audioIniciar(); radioPoner(e, 'lf:' + id, 0, 'prueba', true); window.__tvE = e; return { ok: true, vid: e.vid };
})()`);
await p.waitForTimeout(4000);
const tvEst = await ev(`(() => { const e = window.__tvE, S = EST.son.get(e); return { suena: !!S && S.listo && !S.a.paused, video: S && S.a.tagName, ancho: S && S.a.videoWidth, nivel: +(e.nivel || 0).toFixed(3), tex: !!(S && S.tex && R.tex[S.tex.k]) }; })()`);
ok('el video del aparato suena por el juego y la tele tiene su textura', tvEst.suena && tvEst.video === 'VIDEO' && tvEst.ancho === 640 && tvEst.tex, Object.assign(tvEst, tv));
await p.screenshot({ path: `${D}/3_tele.jpg`, type: 'jpeg', quality: 85 });
// el centro de la tele tiene la imagen del video (testsrc2: colores fuertes), no el vidrio negro
const px = await ev(`(() => { const e = window.__tvE, P = pantEsquinas(e), c = v3((P[0].x + P[2].x) / 2, (P[0].y + P[2].y) / 2, (P[0].z + P[2].z) / 2), v = R.vpMundo, x = v[0] * c.x + v[4] * c.y + v[8] * c.z + v[12], y = v[1] * c.x + v[5] * c.y + v[9] * c.z + v[13], w = v[3] * c.x + v[7] * c.y + v[11] * c.z + v[15];
  return [Math.round((x / w * 0.5 + 0.5) * innerWidth), Math.round((0.5 - y / w * 0.5) * innerHeight)]; })()`);
fs.writeFileSync(`${D}/px.json`, JSON.stringify(px));
// 4) la grabación del juego con la tele: 4 s en «El juego»
await ev(`(() => { const o = grabOp(); o.modo = 'juego'; o.cal = '720'; o.fps = 30; window.__grabTipos = [['video/webm;codecs=vp8,opus', 'webm', 'WebM']]; grabEmpezar(); return 1; })()`);
await p.waitForTimeout(5000); await ev(`grabParar(); 1`);
await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
const ult = await ev(`(() => ({ ok: GRAB.ult.ok, ms: GRAB.ult.ms, bytes: GRAB.ult.bytes, W: GRAB.ult.W, H: GRAB.ult.H }))()`);
ok('la grabación del juego se guarda', ult.ok && ult.bytes > 50000, ult);
// 5) los personajes importados en la pestaña de NPCs (una entrada de mentira, sin el modelo: sólo el menú)
const sp = await ev(`(() => { PJI.lista.push({ id: 'prueba_pj01', n: 'Prueba Importado', img: RETRATO_SIL, fecha: 1 }); spawnNpcsTab(); const C = DATA.menu.find((c) => c.npcs), s = C.sub.find((x) => x.n === T('sp.npcImport')); const r = { sub: !!s, it: s ? s.it : [], nombres: s ? s.it.map(propNom) : [] }; PJI.lista.pop(); spawnNpcsTab(); return r; })()`);
ok('la pestaña de NPCs tiene «Tus personajes importados», como NPC y como muñeco', sp.sub && sp.it.length === 2 && /NPC/.test(sp.nombres[0]) && /\(/.test(sp.nombres[1]), sp);
console.log('errores', err.slice(0, 5));
console.log(R.every(Boolean) ? `TODO BIEN ${R.length}/${R.length}` : `FALLAN ${R.filter((x) => !x).length} de ${R.length}`);
await b.close();
