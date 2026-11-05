// El baile del nene del bote («aura farming», Discord: «emote nuevo»). Hecho a mano con herramientas/emote_aura.py (un
// BVH con el esqueleto de CMU que pasa por emote_bvh.py, como los demás emotes de captura):
//  1. está en el panel de emotes, primero en «Baile», con su miniatura, y viene puesto en la ruleta;
//  2. se puede hacer: el personaje lo baila (clip de 4 s que se repite);
//  3. las manos nunca entran en el cuerpo (≥ 25 cm del eje del torso) ni en la cabeza (≥ 30 cm);
//  4. los pies quedan en el piso (lo más bajo de cada pie varía ≤ 8 cm) y ningún hueso salta más de 15 cm de un cuadro al
//     otro (a 30 por segundo; los bailes de captura llegan a 35-47 cm), tampoco al dar la vuelta;
//  5. sin errores de JS.
// uso: node emote_aura.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/aura'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const lista = await ev(`(() => { delete PREFS.ruleta; EMO.cat = 'baile'; EMO.q = ''; abrirEmotes(); emoDibujar(); const x = document.querySelector('#emoLista [data-emo]'); const r = { primero: x && x.dataset.emo, nombre: x && x.querySelector('b').textContent, mini: !!(x && x.querySelector('svg, img')), ruleta: rulSlots().includes('c:99_01') }; cerrarPaneles(); return r; })()`);
ok('1. está primero en «Baile», con miniatura, y viene en la ruleta', lista.primero === 'c:99_01' && lista.mini && lista.ruleta, lista);
const baila = await ev(`(async () => { emote('c:99_01'); for (let i = 0; i < 60 && !EMO.clips['c:99_01']; i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 500)); const C = EMO.clips['c:99_01']; return { emote: JUG.cuerpo.emote, nf: C && C.nf, dur: C && +(C.nf / C.fps).toFixed(2), loop: C && !!C.loop }; })()`);
ok('2. el personaje lo baila (4 s que se repiten)', baila.emote === 'c:99_01' && baila.dur >= 3.8 && baila.loop, baila);
const m = await ev(`(() => {
  const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.pos.set(JUG.pos.x + 3, JUG.pos.y, JUG.pos.z); P.yaw = 0; P.vel.set(0, 0, 0); P.suelo = true; P.emote = 'c:99_01'; P.emoteT = 0;
  const h = P.D.h, dSeg = (q, a, b) => { const ab = vsub(b, a), t = Math.max(0, Math.min(1, vdot(vsub(q, a), ab) / vdot(ab, ab))); return vsub(q, vadd(a, vscale(ab, t))).len(); };
  let minT = 9, minC = 9, salto = 0, prev = null; const pies = [[9, -9], [9, -9]];
  for (let k = 0; k < 180; k++) { P.emoteT += 1 / 30; animarPersona(P, 1 / 30); ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
    if (k < 20) continue;   // (el arranque desde estar parado)
    const W = P.md.W, q = (i) => v3(W[i][12], W[i][13], W[i][14]), hip = q(h.Hips), neck = q(h.Neck), head = q(h.Head);
    for (const mm of [h.LeftHand, h.RightHand]) { minT = Math.min(minT, dSeg(q(mm), hip, neck)); minC = Math.min(minC, q(mm).distTo(head)); }
    [h.LeftFoot, h.RightFoot].forEach((f, j) => { const y = q(f).y - P.pos.y; pies[j][0] = Math.min(pies[j][0], y); pies[j][1] = Math.max(pies[j][1], y); });
    const cur = Object.values(h).filter((x) => typeof x === 'number').map((i) => q(i)); if (prev) for (let i = 0; i < cur.length; i++) salto = Math.max(salto, cur[i].distTo(prev[i])); prev = cur; }
  borrarPersona(P); return { manoTorso: +minT.toFixed(3), manoCabeza: +minC.toFixed(3), pies: pies.map((x) => +(x[1] - x[0]).toFixed(3)), saltoCm: +(salto * 100).toFixed(1) }; })()`);
ok('3. las manos no entran en el cuerpo (≥ 25 cm del torso) ni en la cabeza (≥ 30 cm)', m.manoTorso >= 0.25 && m.manoCabeza >= 0.3, m);
ok('4. los pies quedan en el piso (≤ 8 cm) y nada salta más de 15 cm entre cuadros', m.pies.every((x) => x <= 0.08) && m.saltoCm <= 15, m);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently/i.test(x));
ok('5. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
