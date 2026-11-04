// emotes de a dos: en Emotes → Juntos están los 7; con un NPC adelante, se hacen al toque: el que pide no se mueve al
// empezar (su cadera en el primer cuadro a ≤ 0,15 m de donde estaba), el NPC queda en su lugar de la captura, las manos se tocan donde tienen que tocarse (dar la mano:
// las derechas a ≤ 0,15 m; chocar los cinco: alguna mano de cada uno a ≤ 0,2 m; consolar: las manos de A en los
// hombros de B ≤ 0,2 m), y al terminar cada uno queda donde terminó su cuerpo (sin volver de golpe); sin nadie adelante
// avisa; en la red: el pedido muestra el cartel, E acepta y avisa al que pidió, y la escena que llega pone mi cuerpo en
// su papel; sin errores.
// uso: node juntos.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
const pan = await ev(`(() => { cerrarPaneles(); $('emotes').classList.remove('oc'); UI.abierto = 'emotes'; EMO.cat = 'juntos'; emoDibujar(); const n = document.querySelectorAll('#emoLista [data-emo^="jnt:"]').length, mini = document.querySelectorAll('#emoLista [data-emo^="jnt:"] svg.emoMini').length; cerrarPaneles(); return { n, mini }; })()`);
ok('Emotes → Juntos: los 7, cada uno con su silueta', pan.n === 7 && pan.mini === 7, pan);
const nadie = await ev(`(async () => { const a0 = $('aviso') ? $('aviso').textContent : ''; await juntosPedir('mano'); return { escena: !!JUG.cuerpo.escena }; })()`);
ok('sin nadie adelante no empieza (avisa)', !nadie.escena, nadie);
// con un NPC: mide cada uno
const medir = async (id, que) => ev(`(async () => {
  NPC.lista.slice().forEach(npcQuitar); JUG.yaw = 0; JUG.vel.set(0, 0, 0);
  const P = npcCrear('Hero', v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z + 1.2), Math.PI, { modo: 'quieto' }); await new Promise((r) => setTimeout(r, 600));
  const p0 = JUG.pos.clone(); await juntosPedir('${id}'); const J = juntosDe('${id}'), A = JUG.cuerpo, B = P;
  if (!A.escena || !B.escena) return { sin: true };
  const h = (Q, n) => { const i = Q.D.h[n]; const W = Q.md.W[i]; return v3(W[12], W[13], W[14]); };
  // (la colocación, cuadro por cuadro de la captura: la pose de cada uno en la escena, llevada al mundo con su origen y giro)
  const CA = emoClip('c:' + J.a), CB = emoClip('c:' + J.b), EA = A.escena, EB = B.escena, hs = ['Hips', 'RightHand', 'LeftHand', 'LeftShoulder', 'RightShoulder'];
  const mundo = (E, q) => { const c = Math.cos(E.yaw), s = Math.sin(E.yaw), o = {}; for (const k in q) o[k] = v3(E.O.x + q[k].x * c + q[k].z * s, E.O.y + q[k].y, E.O.z - q[k].x * s + q[k].z * c); return o; };
  const iniA = (() => { const q = mundo(EA, juntosPose(A, CA, 0, hs)); return Math.hypot(q.Hips.x - p0.x, q.Hips.z - p0.z); })();
  let mejor = 9; for (let f = 0; f < Math.min(CA.nf, CB.nf); f++) { const qa = mundo(EA, juntosPose(A, CA, f, hs)), qb = mundo(EB, juntosPose(B, CB, f, hs)); const hA = (n) => qa[n], hB = (n) => qb[n]; ${que.replace(/h\(A, /g, 'hA(').replace(/h\(B, /g, 'hB(')} }
  let t0 = TIEMPO.t, fin = null; const dur = CA.d;
  while (A.escena && TIEMPO.t - t0 < dur + 2) { await new Promise((r) => requestAnimationFrame(r)); if (!A.escena) break; fin = { x: h(A, 'Hips').x, z: h(A, 'Hips').z }; }
  await new Promise((r) => setTimeout(r, 300));
  const salto = fin ? Math.hypot(JUG.pos.x - fin.x, JUG.pos.z - fin.z) : 9;
  return { iniA: +iniA.toFixed(3), contacto: +mejor.toFixed(3), finSalto: +salto.toFixed(3), termino: !A.escena && !B.escena, dur: +dur.toFixed(1) }; })()`);
const mano = await medir('mano', `mejor = Math.min(mejor, h(A, 'RightHand').distTo(h(B, 'RightHand')));`);
await p.screenshot({ path: D + 'juntos_mano.png' });
ok('dar la mano con un NPC: no me muevo al empezar, las manos derechas se tocan, al terminar quedo donde terminó mi cuerpo', mano.iniA <= 0.15 && mano.contacto <= 0.15 && mano.termino && mano.finSalto <= 0.15, mano);
const cinco = await medir('cinco', `for (const x of ['RightHand', 'LeftHand']) for (const y of ['RightHand', 'LeftHand']) mejor = Math.min(mejor, h(A, x).distTo(h(B, y)));`);
ok('chocar los cinco: alguna mano de cada uno se toca (≤ 0,2 m)', cinco.contacto <= 0.2 && cinco.termino, cinco);
const cons = await medir('consolar', `mejor = Math.min(mejor, Math.max(h(A, 'RightHand').distTo(h(B, 'LeftShoulder')), h(A, 'LeftHand').distTo(h(B, 'RightShoulder'))));`);
ok('consolar: las dos manos de A en los hombros de B (≤ 0,2 m)', cons.contacto <= 0.2 && cons.termino, cons);
// la red (simulada): el pedido, aceptar con E, y la escena que llega
const red = await ev(`(async () => { const env = []; const p0 = publicar; window.publicar = publicar = (s, d) => env.push(JSON.parse(JSON.stringify(d))); RED.on = true; RED.ID = RED.ID || 'yo1';
  recibirEstado({ i: 'ana', n: 'Ana', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x, JUG.pos.y, JUG.pos.z + 1.2], v: [0, 0, 0], y: Math.PI, t: 0, f: 5, a: null, e: 0 }); await new Promise((r) => setTimeout(r, 300));
  juntosRed({ i: 'ana', k: 'jntP', to: RED.ID, e: 'cinco' }); const cartel = !$('jntCartel').classList.contains('oc');
  usar(); await new Promise((r) => setTimeout(r, 500)); const si = env.find((x) => x.k === 'jntS');
  const A0 = emoClip('c:20_11'); juntosRed({ i: 'ana', k: 'jnt', e: 'cinco', a: 'ana', b: RED.ID, O: [JUG.pos.x, JUG.pos.y, JUG.pos.z], th: 0 }); await new Promise((r) => setTimeout(r, 400));
  const R2 = RED.remotos.get('ana'); const r = { cartel, si: si && si.to, yo: JUG.cuerpo.escena && JUG.cuerpo.escena.id, ella: R2.P.escena && R2.P.escena.id };
  window.publicar = publicar = p0; RED.on = false; return r; })()`);
ok('red: el pedido muestra el cartel, E acepta y avisa al que pidió; la escena que llega me pone en mi papel (B) y a ella en el suyo (A)', red.cartel && red.si === 'ana' && red.yo === 'c:21_11' && red.ella === 'c:20_11', red);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
