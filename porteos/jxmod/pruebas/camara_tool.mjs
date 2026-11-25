// La herramienta Cámara mejorada (Bugs y sugerencias 582w89z5: «mejor camera tool»), con la Tool Gun como un jugador:
//  1. los ajustes de la herramienta (dónde se pone, zoom, seguir suave) salen traducidos en su panel;
//  2. clic: pone la cámara 1 donde apunto; clic derecho sobre un NPC: la cámara lo sigue; clic derecho a la nada: miro por
//     ella y el centro de la imagen cae sobre el NPC (± 6°); muevo el NPC 4 m y la cámara lo vuelve a encontrar;
//  3. mientras miro, arriba dice «Cámara 1/… · siguiendo»; el clic izquierdo me devuelve a mis ojos y el cartel se va;
//  4. con zoom 30, la cámara 2 se ve con 30° de campo;
//  5. puesta sobre una caja suelta queda pegada: empujo la caja y la cámara viaja con ella (a la misma distancia);
//  6. sin errores de JS. Fotos: el panel, la vista siguiendo al NPC.
// uso: node camara_tool.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/camara_tool'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 }); await p.waitForTimeout(1200);
// la Tool Gun con la Cámara, y su panel
const st1 = await ev(`(() => { const i = DATA.herr.findIndex((h) => h.n === 'Camara'); UI.tab = DATA.menu.findIndex((c) => c.n === 'Tools'); abrirSpawn(); UI.herrSel = i; equiparHerramienta(i); spawnDibujar(); const ins = $('ins'); return { i, html: ins.textContent.slice(0, 300), sel: !!ins.querySelector('select'), zoom: ins.querySelector('input[type=number]') && ins.querySelector('input[type=number]').value }; })()`);
await p.screenshot({ path: D + '/1_panel.png' });
ok('1. el panel de la Cámara con sus ajustes traducidos', st1.i >= 0 && /Dónde se pone/.test(st1.html) && /Zoom/.test(st1.html) && /suave/i.test(st1.html) && st1.sel && st1.zoom === '70', st1);
await ev(`(() => { cerrarPaneles(); return 1; })()`);
// (la mira de la Tool Gun es la de la cámara, que se actualiza en el cuadro siguiente: se espera)
const mirar = async (x, y, z) => { await ev(`(() => { const d = vsub(v3(${x}, ${y}, ${z}), miraOjo()); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); return 1; })()`); await p.waitForTimeout(500); };
const P0 = await ev(`[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
// 2: cámara 1 en el piso, 4 m adelante y 3 a la derecha
await mirar(P0[0] + 3, P0[1] - 0.95, P0[2] + 4); await ev(`(() => { herramientaUsar(false); return 1; })()`);
// el NPC, 8 m adelante
const npc = await ev(`(() => { const P = npcCrear('Hero', v3(JUG.pos.x - 2, JUG.pos.y - 0.9, JUG.pos.z + 9), Math.PI); window.__npc = P; return !!P; })()`);
await p.waitForTimeout(800);
const pn = await ev(`(() => { const P = window.__npc; return [P.pos.x, P.pos.y, P.pos.z]; })()`);
await mirar(pn[0], pn[1], pn[2]);
if (process.env.DIAG) console.log('DIAG', JSON.stringify(await ev(`(() => { const r = raycast(miraOjo(), miraDir(), 80, null); const P = window.__npc; return { r: r ? { t: +r.t.toFixed(2), persona: !!(r.body && r.body.persona), esNpc: !!(r.body && r.body.persona === P), obj: !!(r.body && r.body.obj), keys: r.body ? Object.keys(r.body).filter((k) => /persona|npc|obj|gm/.test(k)) : null } : null, pos: [P.pos.x, P.pos.y, P.pos.z], b: P.b ? [P.b.pos.x, P.b.pos.y, P.b.pos.z] : null, cuerpos: Object.keys(P).filter((k) => /^b$|cuerpo|caps|body/i.test(k)) }; })()`)));
await ev(`(() => { herramientaUsar(true); return 1; })()`);
const sigue = await ev(`(() => { const c = OBJS.filter((o) => o.art === 'camara')[0]; return !!(c && c.camMira && c.camMira.persona === window.__npc); })()`);
await ev(`(() => { JUG.pitch = -1.3; return 1; })()`); await p.waitForTimeout(500); await ev(`(() => { herramientaUsar(true); return 1; })()`);   // (a la nada: el cielo)
await p.waitForTimeout(2500);
const apunta = `(() => { const P = window.__npc, t = v3(P.pos.x, P.pos.y + 0.6, P.pos.z), d = vsub(t, CAM.pos).norm(); return +(Math.acos(Math.min(1, vdot(d, CAM.fwd))) * 180 / Math.PI).toFixed(1); })()`;
const a1 = await ev(apunta);
await p.screenshot({ path: D + '/2_siguiendo.png' });
const hud = await ev(`(() => { const e = document.getElementById('camHud'); return e && !e.classList.contains('oc') ? e.textContent : null; })()`);
await ev(`(() => { const P = window.__npc; P.pos.x += 4; return 1; })()`); await p.waitForTimeout(2500);
const a2 = await ev(apunta);
ok('2. la cámara 1 sigue al NPC y lo vuelve a encontrar cuando se mueve', npc && sigue && a1 < 6 && a2 < 6, { npc, sigue, a1, a2 });
// volver a los ojos: mirando por la cámara, el clic izquierdo
await ev(`(() => { herramientaUsar(false); return 1; })()`); await p.waitForTimeout(400);
const hud2 = await ev(`(() => { const e = document.getElementById('camHud'); return e && !e.classList.contains('oc') ? e.textContent : null; })()`);
ok('3. arriba dice qué cámara es y que sigue a alguien; al volver a los ojos se va', /Cámara 1\/1/.test(hud || '') && /siguiendo/.test(hud || '') && !hud2 && (await ev(`!HCAM.ver`)), { hud, hud2 });
// 4: cámara 2 con zoom 30
await ev(`(() => { HER.params.Camara.Zoom = 30; return 1; })()`);
await mirar(P0[0] - 3, P0[1] - 0.95, P0[2] + 3); await ev(`(() => { herramientaUsar(false); return 1; })()`);
await ev(`(() => { JUG.pitch = -1.3; return 1; })()`); await p.waitForTimeout(500); await ev(`(() => { herramientaUsar(true); herramientaUsar(true); return 1; })()`); await p.waitForTimeout(800);
const fov = await ev(`[HCAM.ver ? OBJS.filter((o) => o.art === 'camara').indexOf(HCAM.ver) + 1 : 0, +CAM.fov.toFixed(1)]`);
await ev(`(() => { HCAM.ver = null; HER.params.Camara.Zoom = 70; return 1; })()`); await p.waitForTimeout(300);
ok('4. la cámara 2, con zoom 30, se ve con 30° de campo', fov[0] === 2 && Math.abs(fov[1] - 30) < 0.6, fov);
// 5: sobre una caja suelta
const caja = await ev(`(() => { JUG.yaw = Math.PI; JUG.pitch = 0.3; const o = spawnDelante('Crate', {}); return !!o; })()`);
await ev(`(() => { for (let k = 0; k < 120; k++) physStep(1 / 60); return 1; })()`);
const cp = await ev(`(() => { const o = OBJS.filter((x) => x.nombre === 'Crate').pop(); return [o.b.pos.x, o.b.pos.y + 0.3, o.b.pos.z]; })()`);
await mirar(cp[0], cp[1], cp[2]); await ev(`(() => { herramientaUsar(false); return 1; })()`);
const r5 = await ev(`(() => { const o = OBJS.filter((x) => x.nombre === 'Crate').pop(), c = OBJS.filter((x) => x.art === 'camara').pop(); if (!c.camPega) return { pegada: false }; const d0 = c.b.pos.distTo(o.b.pos), p0 = o.b.pos.clone();
  o.b.frozen = false; o.b.wake && o.b.wake(); o.b.vel.set(4, 2, 0); for (let k = 0; k < 90; k++) { physStep(1 / 60); herCamarasPaso(); }
  return { pegada: true, movio: +o.b.pos.distTo(p0).toFixed(2), d0: +d0.toFixed(3), d1: +c.b.pos.distTo(o.b.pos).toFixed(3) }; })()`);
ok('5. sobre una caja suelta queda pegada y viaja con ella', caja && r5.pegada && r5.movio > 1 && Math.abs(r5.d1 - r5.d0) < 0.02, r5);
const errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('6. sin errores de JS', !errJs.length, errJs.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
