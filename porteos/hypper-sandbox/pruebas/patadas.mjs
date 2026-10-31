// patadas: F a pie (o el botón del celular) patea con el clip Kick en 0,64 s; empuja una caja que está adelante, lastima a
// un NPC (y su voz), tira a un muñeco; no se repite antes de 0,75 s; en un vehículo F sigue siendo bajar; en primera
// persona se ve el cuerpo sin la cabeza (después vuelve todo); los demás la ven (y no se repite con el estado viejo).
// uso: node patadas.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML, true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
const PASO = `const paso = (n) => { for (let i = 0; i < n; i++) { TIEMPO.t += 1 / 60; TIEMPO.dt = 1 / 60; animarPersona(JUG.cuerpo, 1 / 60); patadasPaso(1 / 60); physStep(1 / 60); } };`;
// la caja adelante
const caja = await ev(`(() => { ${PASO} JUG.yaw = 0; const f = v3(0, 0, 1), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10), o = crearObjeto('Box4', v3(JUG.pos.x, piso, JUG.pos.z + 1.0), new Quat()); paso(30);
  const z0 = o.b.pos.z; PAT.t = -9; ENT.pulsos.push('salir'); atenderPulsos(); const em = JUG.cuerpo.emote; let dur = 0, vmax = 0; for (let i = 0; i < 90; i++) { paso(1); if (patadaActiva(JUG.cuerpo)) dur = (i + 1) / 60; vmax = Math.max(vmax, o.b.vel.z); }
  const out = { emote: em, dura: +dur.toFixed(2), vz: +vmax.toFixed(2), corrio: +(o.b.pos.z - z0).toFixed(2) }; borrarObjeto(o, true); return out; })()`);
ok('F a pie patea (emote "Patada") y dura ~0,64 s (0,55-0,75)', caja.emote === 'Patada' && caja.dura >= 0.55 && caja.dura <= 0.75, caja);
ok('la caja de adelante sale volando hacia adelante (> 3 m/s) y se corre más de medio metro', caja.vz > 3 && caja.corrio > 0.5, caja);
// el NPC: dolor, vida, voz; el muñeco tirado sale empujado
const npc = await ev(`(async () => { ${PASO} const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.vida = 100; P.vivo = true; P.pos.set(JUG.pos.x, JUG.pos.y, JUG.pos.z + 1.1); P.vel.set(0, 0, 0);
  const son = []; const f0 = sonar; sonar = function (n) { son.push(n); return f0.apply(this, arguments); };
  PAT.t = -9; patear(); paso(40); const vida = P.vida;
  // otra enseguida: no (espera)
  const t0 = PAT.t; patear(); const repite = PAT.t !== t0; paso(30);
  // tirado: los cuerpos del muñeco salen empujados
  P.vida = 1; P.vivo = true; danarPersona(P, 50, P.pos.clone(), v3(0, 0, 1)); paso(60); let v0 = 0; for (const [, e] of P.rag.cuerpos) { e.b.vel.set(0, 0, 0); }
  PAT.t = -9; patear(); paso(25); let vm = 0; for (const [, e] of P.rag.cuerpos) vm = Math.max(vm, e.b.vel.len());
  sonar = f0; borrarPersona(P); return { vida, repite, voz: son.filter((n) => /^VZ_h_dolor/.test(n)).length, golpe: son.filter((n) => /^CB_Flesh/.test(n)).length, muneco: +vm.toFixed(2) }; })()`);
ok('patear a un NPC le saca 20 de vida, suena el golpe y su voz', npc.vida === 80 && npc.golpe >= 1 && npc.voz >= 1, npc);
ok('no se puede patear de nuevo antes de 0,75 s', !npc.repite, npc);
ok('al muñeco tirado lo empuja (> 3 m/s)', npc.muneco > 3, npc);
// en un vehículo, F baja (no patea)
const veh = await ev(`(() => { JUG.cuerpo.emote = null; const o = crearObjeto('Sedan', v3(JUG.pos.x + 6, JUG.pos.y, JUG.pos.z), new Quat()); if (!o) return { sin: true }; subirVehiculo(o); PAT.t = -9; ENT.pulsos.push('salir'); atenderPulsos(); const r = { bajo: !JUG.vehiculo, patea: patadaActiva(JUG.cuerpo) }; borrarObjeto(o, true); return r; })()`);
ok('en un vehículo F baja y no patea', veh.sin || (veh.bajo && !veh.patea), veh);
// primera persona: el cuerpo a la vista sin la cabeza, y después todo como antes
await ev(`JUG.tercera = false; JUG.pitch = 0.45; JUG.cuerpo.emote = null; 1`); await p.waitForTimeout(400);
const cabeza0 = await ev(`JUG.cuerpo.md.s[JUG.cuerpo.D.h.Head][0]`);
const fp = await ev(`(async () => { const P = JUG.cuerpo, hc = P.D.h.Head, s0 = P.md.s[hc].slice(); const dib = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(P.cDib === PERS_N))));
  const antes = await dib(); PAT.t = -9; patear(); await new Promise((ok) => setTimeout(ok, 120)); const durante = await dib(), sCab = P.md.s[hc][0];
  return { antes, durante, sCab, s0: s0[0] }; })()`);
await p.waitForTimeout(80); await p.screenshot({ path: D + 'patada_1p.png' });
await p.waitForTimeout(1200);
const fp2 = await ev(`(() => { const P = JUG.cuerpo, hc = P.D.h.Head; return { s: P.md.s[hc][0], emote: P.emote }; })()`);
ok('en primera persona se ve el cuerpo mientras patea (con la cabeza achicada) y no antes', !fp.antes && fp.durante && fp.sCab < 0.01 * cabeza0 && fp.s0 === cabeza0, { ...fp, cabeza0 });
ok('al terminar, la cabeza vuelve a su tamaño (aunque el cuerpo ya no se dibuje)', Math.abs(fp2.s - cabeza0) < 1e-6 && !fp2.emote, { ...fp2, cabeza0 });
// tercera persona: foto
await ev(`JUG.tercera = true; JUG.pitch = 0.1; 1`); await p.waitForTimeout(400); await ev(`PAT.t = -9; patear(); 1`); await p.waitForTimeout(260);
await p.screenshot({ path: D + 'patada_3p.png' });
// el botón del celular
await ev(`JUG.tercera = false; JUG.cuerpo.emote = null; 1`); await p.waitForTimeout(1000);
const bt = await ev(`(() => { const e = $('bpatada'); return e ? { ver: getComputedStyle(e).display !== 'none' && !e.classList.contains('oc'), r: (() => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })() } : null; })()`);
if (bt) { await ev(`PAT.t = -9; 1`); await p.touchscreen.tap(bt.r[0], bt.r[1]); await p.waitForTimeout(150); }
const tocado = await ev(`patadaActiva(JUG.cuerpo)`);
ok('en el celular está el botón de la patada y patea', bt && bt.ver && tocado, bt);
// los demás: el estado "Patada" la reproduce una vez
const rem = await ev(`(() => { recibirEstado({ i: 'otro', n: 'Otro', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 'Patada' });
  const R2 = RED.remotos.get('otro'), P = R2.P, a = P.emote; for (let i = 0; i < 50; i++) animarPersona(P, 1 / 60); const fin = P.emote;
  recibirEstado({ i: 'otro', n: 'Otro', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 'Patada' }); const otraVez = P.emote;
  return { a, fin, otraVez }; })()`);
ok('los demás la ven (el estado "Patada") y el estado viejo no la repite', rem.a === 'Patada' && rem.fin === null && rem.otraVez === null, rem);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
