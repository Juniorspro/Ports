// radio 3D (emisoras por internet), radio en la espalda, pegarla con la pistola de física, menú MOD y nada de emojis
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', que = process.argv[4] || 'todo', celu = que === 'celu';
const { b, p, err, ev } = await abrir(HTML, celu);
const espera = (ms) => p.waitForTimeout(ms);
// cámara de prueba mirando al pecho del jugador desde un costado
const camA = (x, y, z) => ev(`const c = v3(JUG.pos.x + ${x}, JUG.pos.y + ${y}, JUG.pos.z + ${z}), d = vsub(vadd(JUG.pos, v3(0, 0.35, 0)), c).norm(); DBG.cam = { p: c, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(d.y)) }; 1`);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {piano:true, radio:true, volar:true, ragdoll:true, scp:true}; inicioMostrar(true); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await espera(4000);
await ev(`natScp(false); JUG.pos.set(30, 1.6, 30); JUG.vel.set(0,0,0); JUG.yaw = 0; JUG.pitch = 0.1; 1`); await espera(800);
// ---- menú MOD ----
console.log('botón MOD:', await ev(`JSON.stringify({ve: MODM.boton && MODM.boton.style.display !== 'none', columnaVieja: !!document.getElementById('modBtns')})`));
if (celu) await p.tap('.modmBt'); else await p.keyboard.press('KeyU');
await espera(500);
console.log('menú abierto:', await ev(`JSON.stringify({abierto: MODM.abierto, ui: UI.abierto, filas: document.querySelectorAll('#modMenu .mmIt').length, botones: document.querySelectorAll('#modMenu .mmBt').length, imgs: document.querySelectorAll('#modMenu img.ico').length})`));
await p.screenshot({ path: D + 'm1_menu_mod.png' });
// prender volar desde el menú (queda abierto y marcado)
await p.click('[data-mm="nat:volar"]'); await espera(400);
console.log('volar desde el menú:', await ev(`JSON.stringify({volando: NAT.volando, marcado: document.querySelector('[data-mm="nat:volar"]').classList.contains('on'), abierto: MODM.abierto})`));
await p.click('[data-mm="nat:volar"]'); await espera(300);
if (!celu) { await p.keyboard.press('KeyU'); await espera(300); console.log('U cierra:', await ev(`String(!MODM.abierto && !UI.abierto)`)); }
else { await p.tap('#toque', { position: { x: 400, y: 250 } }).catch(() => {}); await espera(300); console.log('tocar afuera cierra:', await ev(`String(!MODM.abierto)`)); }
if (celu) { console.log('errores:', err.filter((e) => !/WebSocket|mqtt|Failed to load resource/i.test(e)).slice(0, 8).join(' | ') || 'ninguno'); await b.close(); process.exit(0); }
// ---- radio: emisoras ----
await ev(`natAccion('radio')`); await espera(5000);
console.log('panel radio:', await ev(`JSON.stringify({ui: UI.abierto, modo: RADIO.modo, n: RADIO.res.length, primero: RADIO.res[0] && RADIO.res[0].t, generos: document.querySelectorAll('.raGen button').length})`));
await p.screenshot({ path: D + 'r1_panel_emisoras.png' });
await p.click('[data-ra="gen:lofi"]'); await espera(4000);
console.log('lofi:', await ev(`RADIO.res.slice(0,4).map(x=>x.t).join(' · ')`));
await p.click('[data-ra="poner:0"]');
let est = '';
for (let i = 0; i < 12; i++) { await espera(1000); est = await ev(`(() => { const e = radioMia(), S = EST.son.get(e); return JSON.stringify({vid: e.vid, tit: e.tit, suena: !!S, listo: S && S.listo, prox: S && S.prox, t: S && +S.a.currentTime.toFixed(1), nivel: +(e.nivel||0).toFixed(3), err: S && S.a.error && S.a.error.code}); })()`); if (JSON.parse(est).t > 3) break; }
console.log('emisora:', est);
let max = 0; for (let i = 0; i < 20; i++) { await espera(100); max = Math.max(max, Number(await ev(`radioMia().nivel || 0`))); }
console.log('nivel máximo (parlantes laten):', max.toFixed(3));
await ev(`radioCerrar()`); await espera(400);
// volumen por distancia y panner en la radio
const vol = [];
for (const dz of [2, 15, 30, 45]) { await ev(`const e = radioMia(); JUG.pos.set(e.b.pos.x, 1.6, e.b.pos.z - ${dz}); JUG.yaw = 0`); await espera(900); vol.push(await ev(`(() => { const e = radioMia(), S = EST.son.get(e); if (!S) return '${dz}m: sin sonido'; const pp = S.F.p; return '${dz}m: g=' + S.F.g.gain.value.toFixed(3) + ' panner=' + [pp.positionX.value, pp.positionY.value, pp.positionZ.value].map((v,i)=>(v - [e.b.pos.x, e.b.pos.y, e.b.pos.z][i]).toFixed(2)).join(','); })()`)); }
console.log('distancia:', vol.join(' | '));
await ev(`const e = radioMia(); JUG.pos.set(e.b.pos.x, 1.6, e.b.pos.z - 4); JUG.yaw = 0`); await espera(1500);
// ---- en la espalda ----
await ev(`radioEspalda(radioMia(), true); JUG.tercera = true; JUG.yaw = 0; JUG.pitch = 0.1`); await espera(1200);
console.log('espalda:', await ev(`(() => { const e = radioMia(); return JSON.stringify({ll: e.prm.ll, enFisica: PH.bodies.includes(e.b), suena: EST.son.has(e), dist: +e.b.pos.distTo(JUG.pos).toFixed(2), alto: +(e.b.pos.y - JUG.pos.y).toFixed(2)}); })()`));
await p.screenshot({ path: D + 'e1_espalda_tercera.png' });
// cámara de costado y de atrás (con DBG.cam): ver que no atraviese ni flote
for (const [n, ang] of [['costado', Math.PI / 2], ['atras', Math.PI], ['diag', Math.PI * 0.75]]) {
  await camA(Math.sin(ang) * 2.2, 0.5, Math.cos(ang) * 2.2); await espera(700);
  await p.screenshot({ path: D + `e2_espalda_${n}.png` });
}
await ev(`DBG.cam = null; 1`);
// medir: la caja de la radio contra el colisionador del pecho, con varios personajes
const med = [];
for (const sk of ['Hero', 'Soldier', 'Goku', 'Zombie', 'Robot']) {
  const r = await ev(`(() => { if (!DATA.chars.includes('${sk}')) return '${sk}: no está'; PREFS.skin = '${sk}'; jugadorCuerpoNuevo(); return 'ok'; })()`); if (r !== 'ok') { med.push(r); continue; }
  await espera(600);
  med.push(await ev(`(() => { const e = radioMia(), P = JUG.cuerpo, h = P.D.h, i = h.Spine2 !== undefined ? h.Spine2 : h.Spine1; P.md.actualizar(); const W = P.md.W[i], qd = m4quat(W).mul(P.D.rw[i].conj()).norm(), n = qd.rot(v3(0,0,-1)), c = wp(W), atras = espaldaDe(P, c, n);
    const caraDel = vdot(vsub(e.b.pos, c), n) - 0.14 * RADIO_ESP; return '${sk}: espalda ' + atras.toFixed(3) + ' m, cara de la radio ' + caraDel.toFixed(3) + ' m, luz ' + ((caraDel - atras) * 100).toFixed(1) + ' cm'; })()`));
  await camA(2.2, 0.5, 0); await espera(500); await p.screenshot({ path: D + 'e3_' + sk + '.png' });
}
console.log('medidas:', med.join(' | '));
await ev(`DBG.cam = null; PREFS.skin = 'Hero'; jugadorCuerpoNuevo(); 1`);
// correr y volar con la radio puesta: va pegada
await ev(`ENT.teclas.add('KeyW'); ENT.correr = true`); await espera(1500);
console.log('corriendo:', await ev(`(() => { const e = radioMia(); return JSON.stringify({dist: +e.b.pos.distTo(JUG.pos).toFixed(2), v: +JUG.vel.len().toFixed(1)}); })()`));
await p.screenshot({ path: D + 'e4_corriendo.png' });
await ev(`ENT.teclas.delete('KeyW'); ENT.correr = false`); await espera(800);
// soltarla: queda en el piso detrás
await ev(`radioEspalda(radioMia(), false)`); await espera(1500);
console.log('soltada:', await ev(`(() => { const e = radioMia(), piso = pisoBajo(v3(e.b.pos.x, e.b.pos.y + 1, e.b.pos.z), 0); return JSON.stringify({ll: e.prm.ll, enFisica: PH.bodies.includes(e.b), sobrePiso: +(e.b.pos.y - 0.22 - piso).toFixed(3), suena: EST.son.has(e)}); })()`));
// ---- pistola de física: agarrarla, llevarla a la pared y congelarla ----
await ev(`(() => { const e = radioMia(); window.__pared = cajaFija(v3(e.b.pos.x, 3, e.b.pos.z + 6), [4, 3, 0.25]); JUG.pos.set(e.b.pos.x, 1.6, e.b.pos.z - 3); JUG.yaw = 0; JUG.tercera = false; ARM.lista.includes('PhysicsGun') && elegirArma(ARM.lista.indexOf('PhysicsGun')); })()`);
await espera(600);
await ev(`(() => { const e = radioMia(); const d = vsub(e.b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); })()`); await espera(300);
// como con el mouse: mantener el clic izquierdo agarra; el derecho (sin soltar el izquierdo) la congela
await ev(`JUG.vel.set(0,0,0); ENT.disparo = true`); await espera(300);
console.log('agarrada:', await ev(`String(!!ARM.agarre && ARM.agarre.b === radioMia().b)`));
// la llevo contra la pared, a unos 2,5 m de alto, y la congelo
await ev(`JUG.pitch = -0.25; ARM.agarre && (ARM.agarre.dist = 11)`); await espera(1800);
await ev(`ENT.disparo2 = true`); await espera(400); await ev(`ENT.disparo = false`); await espera(300);
const p0 = await ev(`JSON.stringify(radioMia().b.pos)`); await espera(3000);
console.log('pegada en la pared:', await ev(`(() => { const e = radioMia(), b = e.b, a = JSON.parse('${p0}'), d = entidadDatos(e); return JSON.stringify({congelada: b.frozen, alto: +b.pos.y.toFixed(2), seMovio: +Math.hypot(b.pos.x-a.x, b.pos.y-a.y, b.pos.z-a.z).toFixed(4), aPared: +(window.__pared.pos.z - 0.25 - (b.pos.z + 0.14)).toFixed(2), guarda: {fz: d.prm.fz, q: d.prm.q}}); })()`));
await ev(`JUG.tercera = true; JUG.pos.set(radioMia().b.pos.x + 3, 1.6, radioMia().b.pos.z - 4); JUG.yaw = -0.6; JUG.pitch = 0.2`); await espera(900);
await p.screenshot({ path: D + 'f1_pegada_pared.png' });
// ---- YouTube aparte (con su ventanita) ----
await ev(`radioAbrir(radioMia()); radioModo('yt')`); await espera(5000);
console.log('youtube:', await ev(`JSON.stringify({modo: RADIO.modo, n: RADIO.res.length, nota: document.querySelector('.raNota').textContent.slice(0, 60)})`));
await p.screenshot({ path: D + 'y1_youtube.png' });
// elegir un video: suena (el video avanza) pero no se ve nada en pantalla
await ev(`window.__ytT = 0; addEventListener('message', (m) => { try { const d = typeof m.data === 'string' ? JSON.parse(m.data) : m.data; if (d && d.info && d.info.currentTime) window.__ytT = d.info.currentTime; } catch (x) {} }); 1`);
await p.click('[data-ra="poner:0"]'); await ev(`radioCerrar(); const e = radioMia(); JUG.pos.set(e.b.pos.x + 3, 1.6, e.b.pos.z); 1`); await espera(12000);
console.log('youtube escondido:', await ev(`(() => { const c = document.getElementById('ytMini'), cs = c && getComputedStyle(c), r = c && c.getBoundingClientRect(); return JSON.stringify({ suena: !!YT.ifr, opacidad: cs && cs.opacity, z: cs && cs.zIndex, toca: cs && cs.pointerEvents, tam: r && [Math.round(r.width), Math.round(r.height)], videoAvanza: +(window.__ytT || 0).toFixed(1), vol: YT.vol }); })()`));
await p.screenshot({ path: D + 'y2_youtube_sonando.png' });
await ev(`radioModo('est'); radioCerrar()`);
// ---- sin emojis en la pantalla ----
const emo = await ev(`(() => { const re = /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{1F1E6}-\\u{1F1FF}\\u{FE0F}]/u, malos = [];
  for (const el of document.querySelectorAll('body *')) { if (el.closest('script,style')) continue; for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.nodeValue)) malos.push(el.tagName + ':' + n.nodeValue.trim().slice(0, 30)); for (const a of ['placeholder', 'title', 'value']) if (el.getAttribute && re.test(el.getAttribute(a) || '')) malos.push(a + ':' + el.getAttribute(a).slice(0, 30)); }
  for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (/content:\\s*"[^"]*[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(r.cssText)) malos.push('css:' + r.selectorText); } catch (x) {} }
  return malos.length + (malos.length ? ' → ' + malos.slice(0, 10).join(' | ') : ''); })()`);
console.log('emojis en pantalla:', emo);
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|Failed to load resource/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
