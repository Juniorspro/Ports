// ---------------- patadas ----------------
// F (a pie; en un vehículo sigue siendo bajar) o el botón de la patada en el celular: la patada de verdad del juego (el
// clip "Kick", su tramo del golpe al doble de velocidad: 0,64 s). Al estirar la pierna (a los 0,2 s) empuja los props que
// tiene adelante, lastima y empuja a la gente y tira los muñecos. En primera persona se ve el cuerpo (sin la cabeza, que
// taparía la cámara): se ve la pierna. Los demás la ven por el estado (emote "Patada").
const PAT = { de: 0.55, a: 1.95, v: 2.2, golpe: 0.2, espera: 0.75, t: -9 };
const patadaActiva = (P) => P && P.emote === 'Patada';
function patear() {
  const P = JUG.cuerpo;
  if (!P || !JUG.vivo || JUG.vehiculo || JUG.nada || P.rag || TIEMPO.t - PAT.t < PAT.espera) return;
  PAT.t = TIEMPO.t; PAT.pego = false;
  P.emote = 'Patada'; P.emoteT = 0;
  sonar('CB_Swing', null, 0.55, 0.85 + Math.random() * 0.1);
}
// la cabeza y los brazos achicados a nada (pateando en primera persona: taparían la cámara y se meterían en la vista;
// queda la pierna) o de vuelta a su tamaño
const PAT_HUESOS = ['Head', 'LeftShoulder', 'RightShoulder'];
// en primera persona se ve el cuerpo pateando o haciendo un emote (en un emote se achica sólo la cabeza: los brazos son lo que se mira)
const cuerpoEnPrimera = (P) => !!P && P === JUG.cuerpo && !JUG.tercera && !HCAM.ver && JUG.vivo && !JUG.vehiculo && (patadaActiva(P) || (!!P.emote && !P.rag && !P.sentado));
function patadaCabeza(P, sin, soloCabeza) {
  if (!P || (!sin && !P.cabezaS)) return;
  if (sin && P.cabezaS && P.cabezaSolo !== !!soloCabeza) patadaCabeza(P, false);   // (cambió de patada a emote o al revés)
  if (!P.cabezaS) { P.cabezaSolo = !!soloCabeza; P.cabezaS = (soloCabeza ? ['Head'] : PAT_HUESOS).map((n) => { const i = P.D.h[n]; return i === undefined ? null : [i, P.md.s[i].slice()]; }).filter(Boolean); }
  const k = sin ? 0.001 : 1;
  for (const [i, s0] of P.cabezaS) { const s = P.md.s[i]; s[0] = s0[0] * k; s[1] = s0[1] * k; s[2] = s0[2] * k; }
  if (!sin) P.cabezaS = null; P.md.sucio = true;
}
// cada cuadro: el golpe en su momento (sólo la mía; la de los demás la hace cada uno en su juego)
function patadasPaso(dt) {
  const P = JUG.cuerpo;
  if (P && P.cabezaS && !cuerpoEnPrimera(P)) patadaCabeza(P, false);   // (terminó en primera persona: el cuerpo ya no se dibuja, la cabeza vuelve igual)
  if (!patadaActiva(P) || PAT.pego || P.emoteT < PAT.golpe) return;
  PAT.pego = true;
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), tk = P.tam || 1, pie = vadd(JUG.pos, v3(f.x * 0.85 * tk, -0.95 + 0.75 * tk, f.z * 0.85 * tk)), R = 0.75 * tk;
  let pego = null;
  // los props: empujón hacia adelante y un poco arriba (como mucho 9 m/s; a lo liviano más)
  for (const o of OBJS) {
    const b = o.b; if (!b || b.noPhys || b.dead || (b.frozen && !o.remoto)) continue;
    if (b.pos.distTo(pie) > R + (b.shape.r || 0.5)) continue;
    const d = vsub(b.pos, JUG.pos); d.y = 0; if (vdot(d, f) < 0) continue;
    if (o.remoto) redReclamar(o);
    const dv = Math.min(9, 600 / Math.max(b.mass, 1));
    b.wake(); b.vel.addS(f, dv); b.vel.y += dv * 0.35; b.ang.addS(vcross(v3(0, 1, 0), f), dv * 0.4);
    pego = pego || { p: b.pos.clone(), carne: false };
  }
  // la gente (NPC, otros jugadores) y los muñecos tirados
  for (const Q of PERS) {
    if (Q === P || Q.visible === false) continue;
    const c = v3(Q.pos.x, Q.pos.y - 0.95 + 0.9 * (Q.tam || 1), Q.pos.z), d = vsub(c, JUG.pos); d.y = 0;
    if (c.distTo(pie) > R + 0.45 * (Q.tam || 1) || vdot(d, f) < 0) continue;
    if (Q.rag) { for (const [, e] of Q.rag.cuerpos) { e.b.wake(); e.b.vel.addS(f, 6); e.b.vel.y += 2.5; } }
    else { danarPersona(Q, 20, c, f.clone()); if (Q.npc && Q.vivo !== false) { Q.vel.addS(f, 4); Q.vel.y += 2; } }
    pego = { p: c, carne: true };
  }
  if (pego) {
    const L = pego.carne ? ['CB_Flesh1', 'CB_Flesh2', 'CB_Flesh3'] : ['CB_Impact1', 'CB_Impact2'];
    sonar(azarDe(L), pego.p, 0.85); efectoImpacto(pego.p, vscale(f, -1), pego.carne ? 'cuerpo' : 'golpe');
    CAM.temblor = Math.max(CAM.temblor || 0, 0.12);
  }
}
