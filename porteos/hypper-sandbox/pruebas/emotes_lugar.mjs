// emotes que no se buguean: reproduce (simulado a 30 cuadros por segundo, en un personaje aparte) todos los de captura
// que se repiten y una muestra de los demás (y los del paquete) y mide: cuánto se aleja la cadera del jugador
// (horizontal) y el giro más grande de un hueso entre dos cuadros, comparando la primera pasada (el movimiento de la
// captura) con lo que pasa al repetirse (el empalme). Criterios: cadera ≤ 0,6 m en todos; en los que se repiten, el
// empalme no gira un hueso más de 12° por encima de lo que gira la captura sola (en el 95 %), y nunca más de 45°; y lo
// que se repite cubre al menos la mitad del clip (no un pedacito).
// uso: node emotes_lugar.mjs URL_HTML [MUESTRA_DE_LOS_DEMAS]
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const N = +(process.argv[3] || 300);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2000);
const r = await ev(`(async () => {
  const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.visible = false; const hi = P.D.h.Hips, md = P.md, nb = md.r.length;
  const loops = CMU_CAT.items.filter((x) => x[4]).map((x) => 'c:' + x[0]), otros = CMU_CAT.items.filter((x) => !x[4]).map((x) => 'c:' + x[0]);
  const paso = Math.max(1, Math.floor(otros.length / ${N})), ids = loops.concat(otros.filter((x, i) => i % paso === 0)).concat(Object.keys(DATA.emo).map((k) => 'rb:' + k));
  const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;
  const out = [];
  const cs = ids.filter((id) => id.startsWith('c:'));
  for (let vez = 0; vez < 3; vez++) for (let i = 0; i < cs.length; i += 40) await Promise.all(cs.slice(i, i + 40).filter((id) => !EMO.clips[id]).map((id) => emoCargar(id)));   // (de a 40, con reintentos)
  for (const id of ids) {
    const C = emoClip(id); if (!C) { out.push({ id, falta: true }); continue; }
    const dt = 1 / 30, primera = C.loop ? emoBucle(C, true)[1] / C.fps : C.d, T = C.loop ? Math.min(primera + 2 * C.d + 1, 40) : C.d;
    let prev = null, saltoNat = 0, saltoTot = 0, lejos = 0;
    for (let t = 0; t < T; t += dt) {
      for (let i = 0; i < nb; i++) { const b0 = P.base[i]; md.r[i][0] = b0[0]; md.r[i][1] = b0[1]; md.r[i][2] = b0[2]; md.r[i][3] = b0[3]; }
      const s0 = P.D.sub[hi].p; md.p[hi][0] = s0[0]; md.p[hi][1] = s0[1]; md.p[hi][2] = s0[2];
      P.emote = id; P.emoteT = t; emoPose(P, dt); if (!P.emote) break;
      lejos = Math.max(lejos, Math.hypot(md.p[hi][0] - s0[0], md.p[hi][2] - s0[2]) * (P.D.sub[0].s ? 1 : 1));
      const cur = md.r.map((q) => q.slice());
      if (prev && t > 0.3) { let m = 0; for (let i = 0; i < nb; i++) m = Math.max(m, ang(prev[i], cur[i])); if (t < primera - 0.3) saltoNat = Math.max(saltoNat, m); saltoTot = Math.max(saltoTot, m); }
      prev = cur;
    }
    const bq = C.loop ? emoBucle(C, true) : null; out.push({ id, loop: C.loop, lejos: +lejos.toFixed(2), nat: Math.round(saltoNat), tot: Math.round(saltoTot), cubre: bq ? +((bq[1] - bq[0]) / (C.nf - 1)).toFixed(2) : 1 });
  }
  borrarPersona(P); return out; })()`);
const ok = r.filter((x) => !x.falta), L = ok.filter((x) => x.loop);
const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
// (la cadera del modelo está en las unidades del esqueleto: se mide igual antes y después)
console.log(JSON.stringify({ clips: ok.length, faltan: r.length - ok.length, loops: L.length,
  cadera: { p50: q(ok.map((x) => x.lejos), 0.5), p95: q(ok.map((x) => x.lejos), 0.95), max: Math.max(...ok.map((x) => x.lejos)), mas06: ok.filter((x) => x.lejos > 0.6).length },
  empalme: { exceso_p50: q(L.map((x) => x.tot - x.nat), 0.5), exceso_p95: q(L.map((x) => x.tot - x.nat), 0.95), mas12: L.filter((x) => x.tot - x.nat > 12).length, mas45: L.filter((x) => x.tot > 45 && x.tot - x.nat > 12).length, tot_p95: q(L.map((x) => x.tot), 0.95) },
  cubre: { min: Math.min(...L.map((x) => x.cubre)), p50: q(L.map((x) => x.cubre), 0.5), menos50: L.filter((x) => x.cubre < 0.5).length },
  peores: L.slice().sort((a, b2) => (b2.tot - b2.nat) - (a.tot - a.nat)).slice(0, 5) }));
console.log('errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 3));
await b.close();
