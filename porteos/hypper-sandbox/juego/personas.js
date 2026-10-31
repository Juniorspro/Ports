// ---------------------------------------------------------------------------------------------------------
// personajes: los 14 skins del juego (huesos mixamo) con su gorro, animación hecha por código (parado,
// caminar, correr, saltar, agacharse, sentado, sostener el arma y los 15 emotes) y muñeco de trapo armado
// con los HitBox del juego (cajas y cápsulas con sus masas).
// ---------------------------------------------------------------------------------------------------------
const PERS = [];
const HUESOS = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const _skinCache = {};
function datosSkin(skin) {
  if (_skinCache[skin]) return _skinCache[skin];
  const arb = arbolJugador(), cr = arb.findIndex((n) => n.n === 'CharactersRoot');
  let si = arb.findIndex((n) => n.pa === cr && n.n === skin); if (si < 0) si = arb.findIndex((n) => n.pa === cr && n.n === 'Hero');
  const sub = subArbol(arb, si);
  const md = new Modelo(sub); md.actualizar();
  const h = {}; for (let i = 0; i < sub.length; i++) { const m = /^mixamorig\d*:(.*)$/.exec(sub[i].n); if (m && HUESOS.includes(m[1]) && h[m[1]] === undefined) h[m[1]] = i; }
  const rw = sub.map((x, i) => m4quat(md.W[i]));
  const rp = sub.map((x, i) => v3(md.W[i][12], md.W[i][13], md.W[i][14]));
  // altura del tobillo sobre la suela con el personaje parado (para apoyar los pies en el piso): si la malla en reposo
  // baja del 0 de la raíz (zapatos largos, patas grandes), se cuenta desde lo más bajo de la malla
  const S = sueloReposo(md, h, sub), tobillo = h.LeftFoot !== undefined && h.RightFoot !== undefined ? Math.max(0.02, Math.min(rp[h.LeftFoot].y, rp[h.RightFoot].y) - S.lo) : 0.08;
  return (_skinCache[skin] = { sub, h, rw, rp, cr, tobillo, pies: S.pies });
}
// la suela en la pose de reposo: lo más bajo de la malla con piel (0 si no baja del piso de la raíz) y, de cada pie, el
// talón y la punta de la suela (en el espacio del hueso del pie: al girar el pie al caminar, el talón o la punta de un
// pie largo, como el de un disfraz, bajaban del piso). Se lee de los vértices sin guardar copia (en un celular de 2 GB
// no conviene dejar las mallas en la memoria).
function sueloReposo(md, h, sub) {
  const lado = new Map(), pts = { L: [], R: [] }; let lo = 0;
  for (const [l, re] of [['L', /Left(Foot|ToeBase|Toe_End)$/], ['R', /Right(Foot|ToeBase|Toe_End)$/]]) sub.forEach((n, i) => { if (re.test(n.n)) lado.set(i, l); });
  for (const pz of md.pieles) {
    const x = md.A[pz.i], d = DATA.ms[x.m], H = pz.h, B = d && binDe(d); if (!d || d.sk === undefined || !B) continue;
    const dv = new DataView(B.buffer, B.byteOffset);
    for (let v = 0; v < d.v; v++) {
      const o = d.o + v * 14, px = d.mn[0] + dv.getUint16(o, true) / 65535 * d.sc[0], py = d.mn[1] + dv.getUint16(o + 2, true) / 65535 * d.sc[1], pz2 = d.mn[2] + dv.getUint16(o + 4, true) / 65535 * d.sc[2];
      let X = 0, Y = 0, Z = 0, wm = 0, bm = -1; const sk = d.sk + v * 8;
      for (let k = 0; k < 4; k++) {
        const w = dv.getUint8(sk + 4 + k) / 255; if (!w) continue; const b = dv.getUint8(sk + k), B = b * 12;
        X += w * (H[B] * px + H[B + 1] * py + H[B + 2] * pz2 + H[B + 3]); Y += w * (H[B + 4] * px + H[B + 5] * py + H[B + 6] * pz2 + H[B + 7]); Z += w * (H[B + 8] * px + H[B + 9] * py + H[B + 10] * pz2 + H[B + 11]);
        if (w > wm) { wm = w; bm = b; }
      }
      if (Y < lo) lo = Y;
      const l = bm >= 0 && x.bo && lado.get(x.bo[bm]); if (l) pts[l].push(X, Y, Z);
    }
  }
  // de cada pie: los puntos de la suela (hasta 1,5 cm arriba de lo más bajo del pie), el de más atrás y el de más adelante
  const pies = {};
  for (const [l, iF] of [['L', h.LeftFoot], ['R', h.RightFoot]]) {
    const q = pts[l]; if (iF === undefined || q.length < 9) continue;
    let mn = 1e9; for (let i = 1; i < q.length; i += 3) mn = Math.min(mn, q[i]);
    let a = -1, b = -1; for (let i = 0; i < q.length; i += 3) if (q[i + 1] < mn + 0.015) { if (a < 0 || q[i + 2] < q[a + 2]) a = i; if (b < 0 || q[i + 2] > q[b + 2]) b = i; }
    const W = md.W[iF], loc = (i) => { const dx = q[i] - W[12], dy = q[i + 1] - W[13], dz = q[i + 2] - W[14], c = (k) => (W[k] * dx + W[k + 1] * dy + W[k + 2] * dz) / (W[k] * W[k] + W[k + 1] * W[k + 1] + W[k + 2] * W[k + 2]); return v3(c(0), c(4), c(8)); };
    pies[l] = [loc(a), loc(b)];
  }
  return { lo, pies: pies.L && pies.R ? pies : null };
}
// tamaño de un personaje (los bajitos, como Jake o Finn, vienen con el modelo achicado en la raíz): alto respecto del Hero
// (k) y la altura de los ojos respecto de la de un humano de ese alto (ojo). Los demás: 1 y 1
// (tercer dato: 1 si flota, como The Boiled One: sin piernas, se desliza en vez de caminar)
function tamSkin(skin) { const t = DATA.tam && DATA.tam[skin]; return t ? { k: t[0], ojo: t[1] || 1, flota: !!t[2] } : { k: 1, ojo: 1, flota: false }; }
function crearPersona(skin, gorro, opt) {
  // (un personaje de un paquete aparte que todavía no llegó: mientras tanto el Hero, y se pide; cuando llega, se cambia)
  let quiere = null; if (!rbListo(rbDeSkin(skin))) { rbPedir(rbDeSkin(skin)); quiere = skin; skin = 'Hero'; }
  const D = datosSkin(skin), md = new Modelo(D.sub);
  const P = { skin, gorro, md, D, pos: v3(), yaw: 0, vel: v3(), suelo: true, sentado: false, agachado: false, arma: null, emote: null, emoteT: 0, t: Math.random() * 10,
    fase: 0, vivo: true, rag: null, vida: 100, base: md.r.map((r) => r.slice()), visible: true, nombre: (opt && opt.nombre) || '', mira: 0, tam: tamSkin(skin).k, flota: tamSkin(skin).flota };
  // gorro: sub-árbol del contenedor Hats, pegado a la cabeza
  if (gorro && gorro !== 'HatEmpty') {
    const arb = arbolJugador(), hats = arb.findIndex((n, i) => n.n === 'Hats' && arb[n.pa] && arb[n.pa].n === 'CharactersRoot');
    const gi = arb.findIndex((n) => n.pa === hats && n.n === gorro);
    if (gi >= 0) { P.gorroMd = new Modelo(subArbol(arb, gi)); P.gorroL = new Float32Array(16); m4trs(arb[gi].p, arb[gi].r, arb[gi].s, P.gorroL); P.gorroMd.p[0] = [0, 0, 0]; P.gorroMd.r[0] = [0, 0, 0, 1]; P.gorroMd.s[0] = [1, 1, 1]; }
  }
  P.hum = humanoPreparar(P);
  P.skinQuiere = quiere; PERS.push(P); return P;
}
function borrarPersona(P) { const i = PERS.indexOf(P); if (i >= 0) PERS.splice(i, 1); if (P.rag) ragdollFin(P); }
// gira un hueso alrededor de un eje del personaje (en reposo). Los giros se acumulan en el orden en que se
// piden (el último queda "afuera") y al final: r = r0 · (q0⁻¹ · R · q0)
const _qa = new Quat(), _qb = new Quat();
function girar(P, nombre, ax, ay, az, ang) {
  const i = P.D.h[nombre]; if (i === undefined || !ang) return;
  const R = Quat.axis(ax, ay, az, ang), acc = P.acc[i];
  P.acc[i] = acc ? R.mul(acc) : R;
}
function aplicarGiros(P) {
  for (const k in P.acc) {
    const i = +k, q0 = P.D.rw[i];
    _qa.mulTo(q0.conj(), P.acc[k]).mul(q0);
    const r = P.md.r[i]; _qb.set(r[0], r[1], r[2], r[3]).mul(_qa).norm(); r[0] = _qb.x; r[1] = _qb.y; r[2] = _qb.z; r[3] = _qb.w;
  }
}
// el cuerpo según lo que hace
function animarPersona(P, dt) {
  if (P.cuad) { natCuadPose(P, dt); return; } // SCP en cuatro patas (mod)
  if (P.hum) {
    if (P.emote) P.emoteT += dt;
    // nadando (agua.js): la pose de nado entra y sale suave
    P.nadoVol = !P.rag && !P.sentado && !P.emote ? aguaNadaPersona(P) : null; P.nadoK = (P.nadoK || 0) + ((P.nadoVol ? 1 : 0) - (P.nadoK || 0)) * Math.min(1, dt * 4);
    animarHumano(P, dt); if (P.poseExtra) P.poseExtra(P, dt); emoPose(P, dt); nadoPose(P, dt); cicPose(P, dt); agarreGm(P); return;
  }
  P.acc = {}; animarPersona0(P, dt); aplicarGiros(P);
}
function animarPersona0(P, dt) {
  const md = P.md; for (let i = 0; i < md.r.length; i++) { const b = P.base[i], r = md.r[i]; r[0] = b[0]; r[1] = b[1]; r[2] = b[2]; r[3] = b[3]; }
  P.t += dt;
  const sp = Math.hypot(P.vel.x, P.vel.z), corre = sp > 6.5, k = clamp(sp / 6, 0, 1.4);
  P.fase += dt * (sp > 0.2 ? 2.2 + sp * 0.9 : 0);
  const s = Math.sin(P.fase), c = Math.cos(P.fase), t = P.t;
  // brazos abajo (el modelo viene en T)
  const brazo = 1.2;
  girar(P, 'LeftArm', 0, 0, 1, -brazo); girar(P, 'RightArm', 0, 0, 1, brazo);
  girar(P, 'LeftForeArm', 0, 1, 0, 0.25); girar(P, 'RightForeArm', 0, 1, 0, -0.25);
  if (P.emote) { animarEmote(P, dt); return; }
  if (P.sentado) {
    girar(P, 'LeftUpLeg', 1, 0, 0, -1.45); girar(P, 'RightUpLeg', 1, 0, 0, -1.45);
    girar(P, 'LeftLeg', 1, 0, 0, 1.45); girar(P, 'RightLeg', 1, 0, 0, 1.45);
    if (P.manejando) { girar(P, 'LeftArm', 1, 0, 0, -0.9); girar(P, 'RightArm', 1, 0, 0, -0.9); girar(P, 'LeftForeArm', 0, 1, 0, 0.6); girar(P, 'RightForeArm', 0, 1, 0, -0.6); }
    return;
  }
  if (!P.suelo) {
    girar(P, 'LeftUpLeg', 1, 0, 0, -0.5); girar(P, 'RightUpLeg', 1, 0, 0, -0.2); girar(P, 'LeftLeg', 1, 0, 0, 0.8); girar(P, 'RightLeg', 1, 0, 0, 0.4);
    girar(P, 'LeftArm', 0, 0, 1, 0.5); girar(P, 'RightArm', 0, 0, 1, -0.5);
  } else if (sp > 0.2) {
    const a = (corre ? 0.75 : 0.5) * Math.min(1, k);
    girar(P, 'LeftUpLeg', 1, 0, 0, s * a); girar(P, 'RightUpLeg', 1, 0, 0, -s * a);
    girar(P, 'LeftLeg', 1, 0, 0, Math.max(0, -c) * a * 1.4 + 0.05); girar(P, 'RightLeg', 1, 0, 0, Math.max(0, c) * a * 1.4 + 0.05);
    girar(P, 'LeftArm', 1, 0, 0, -s * a * 0.8); girar(P, 'RightArm', 1, 0, 0, s * a * 0.8);
    girar(P, 'Spine', 1, 0, 0, corre ? 0.18 : 0.06); girar(P, 'Spine1', 0, 1, 0, s * 0.08);
  } else {
    girar(P, 'Spine1', 1, 0, 0, Math.sin(t * 1.6) * 0.02); girar(P, 'LeftArm', 0, 0, 1, Math.sin(t * 1.6) * 0.03);
  }
  if (P.agachado) { girar(P, 'LeftUpLeg', 1, 0, 0, -1.0); girar(P, 'RightUpLeg', 1, 0, 0, -1.0); girar(P, 'LeftLeg', 1, 0, 0, 1.6); girar(P, 'RightLeg', 1, 0, 0, 1.6); girar(P, 'Spine', 1, 0, 0, 0.35); }
  // con arma: los brazos hacia adelante y la cabeza/espalda siguen la mira
  if (P.arma && P.arma !== 'Hands') {
    girar(P, 'RightArm', 1, 0, 0, -1.3); girar(P, 'RightArm', 0, 1, 0, 0.2); girar(P, 'RightForeArm', 0, 1, 0, -0.15);
    girar(P, 'LeftArm', 1, 0, 0, -1.25); girar(P, 'LeftArm', 0, 1, 0, -0.75); girar(P, 'LeftForeArm', 0, 1, 0, 0.7);
  }
  girar(P, 'Spine2', 1, 0, 0, P.mira * 0.35); girar(P, 'Head', 1, 0, 0, P.mira * 0.5);
}
function animarEmote(P, dt) {
  P.emoteT += dt; const t = P.emoteT, s = Math.sin(t * 6), e = P.emote;
  switch (e) {
    case 'Hi': girar(P, 'RightArm', 0, 0, 1, -2.5); girar(P, 'RightForeArm', 0, 0, 1, -0.4 + s * 0.4); break;
    case 'Clap': { const a = 0.45 + Math.abs(s) * 0.4; girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'RightArm', 1, 0, 0, -1.2); girar(P, 'LeftArm', 0, 1, 0, -a); girar(P, 'RightArm', 0, 1, 0, a); break; }
    case 'Victory': girar(P, 'LeftArm', 0, 0, 1, 2.6 + s * 0.15); girar(P, 'RightArm', 0, 0, 1, -2.6 - s * 0.15); break;
    case 'Disagree': girar(P, 'Head', 0, 1, 0, s * 0.5); girar(P, 'RightArm', 1, 0, 0, -0.6); girar(P, 'RightForeArm', 0, 1, 0, -1.2); break;
    case 'ChickenDance': { girar(P, 'LeftArm', 0, 0, 1, 1.1 + s * 0.5); girar(P, 'RightArm', 0, 0, 1, -1.1 - s * 0.5); girar(P, 'LeftForeArm', 0, 1, 0, 2.2); girar(P, 'RightForeArm', 0, 1, 0, -2.2); girar(P, 'Hips', 0, 1, 0, s * 0.3); girar(P, 'LeftUpLeg', 1, 0, 0, Math.max(0, s) * -0.6); girar(P, 'LeftLeg', 1, 0, 0, Math.max(0, s) * 0.9); break; }
    case 'Sitting': girar(P, 'LeftUpLeg', 1, 0, 0, -1.45); girar(P, 'RightUpLeg', 1, 0, 0, -1.45); girar(P, 'LeftLeg', 1, 0, 0, 1.45); girar(P, 'RightLeg', 1, 0, 0, 1.45); break;
    case 'Scream': girar(P, 'Head', 1, 0, 0, -0.5); girar(P, 'Spine2', 1, 0, 0, -0.3); girar(P, 'LeftArm', 0, 0, 1, 1.9 + s * 0.1); girar(P, 'RightArm', 0, 0, 1, -1.9 - s * 0.1); break;
    case 'Kick': { const k = Math.sin(Math.min(1, t * 1.6) * Math.PI); girar(P, 'RightUpLeg', 1, 0, 0, -1.7 * k); girar(P, 'RightUpLeg', 0, 0, 1, 0.6 * k); girar(P, 'Spine', 0, 1, 0, 1.2 * k); girar(P, 'LeftArm', 0, 0, 1, 1.0); break; }
    case 'FightIdle': girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'RightArm', 1, 0, 0, -1.0); girar(P, 'LeftForeArm', 0, 1, 0, 2); girar(P, 'RightForeArm', 0, 1, 0, -2); girar(P, 'Spine1', 0, 1, 0, s * 0.1); girar(P, 'LeftUpLeg', 1, 0, 0, -0.3); girar(P, 'LeftLeg', 1, 0, 0, 0.4); break;
    case 'AirSquat': { const q = (Math.sin(t * 3) + 1) / 2; girar(P, 'LeftUpLeg', 1, 0, 0, -1.4 * q); girar(P, 'RightUpLeg', 1, 0, 0, -1.4 * q); girar(P, 'LeftLeg', 1, 0, 0, 2.2 * q); girar(P, 'RightLeg', 1, 0, 0, 2.2 * q); girar(P, 'LeftArm', 1, 0, 0, -1.5 * q); girar(P, 'RightArm', 1, 0, 0, -1.5 * q); P.bajar = 0.45 * q; break; }
    case 'Techno': girar(P, 'RightArm', 0, 0, 1, -1.6 - Math.max(0, s) * 1.2); girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'LeftForeArm', 0, 1, 0, 1.6); girar(P, 'Hips', 0, 1, 0, s * 0.15); girar(P, 'Head', 1, 0, 0, Math.abs(s) * 0.3); break;
    case 'Twerk': { girar(P, 'Spine', 1, 0, 0, 0.6); girar(P, 'Hips', 1, 0, 0, -0.4 + s * 0.35); girar(P, 'LeftUpLeg', 1, 0, 0, -0.7); girar(P, 'RightUpLeg', 1, 0, 0, -0.7); girar(P, 'LeftLeg', 1, 0, 0, 0.9); girar(P, 'RightLeg', 1, 0, 0, 0.9); girar(P, 'LeftArm', 0, 0, 1, 0.3); girar(P, 'RightArm', 0, 0, 1, -0.3); P.bajar = 0.25; break; }
    case 'Bencao': girar(P, 'RightArm', 1, 0, 0, -1.2); girar(P, 'RightForeArm', 0, 1, 0, -1.8 + s * 0.3); girar(P, 'Head', 1, 0, 0, 0.3); break;
    case 'Flair': { girar(P, 'Hips', 0, 1, 0, t * 8); girar(P, 'LeftUpLeg', 0, 0, 1, 1.0); girar(P, 'RightUpLeg', 0, 0, 1, -1.0); girar(P, 'LeftArm', 0, 0, 1, 1.0); girar(P, 'RightArm', 0, 0, 1, -1.0); break; }
    case 'Backflip': { const k = clamp(t / 1.1, 0, 1); girar(P, 'Hips', 1, 0, 0, -k * TAU); P.subir = Math.sin(k * Math.PI) * 1.1; girar(P, 'LeftUpLeg', 1, 0, 0, -Math.sin(k * Math.PI) * 1.4); girar(P, 'RightUpLeg', 1, 0, 0, -Math.sin(k * Math.PI) * 1.4); girar(P, 'LeftLeg', 1, 0, 0, Math.sin(k * Math.PI) * 1.8); girar(P, 'RightLeg', 1, 0, 0, Math.sin(k * Math.PI) * 1.8); if (t > 1.3) P.emote = null; break; }
  }
  if (t > 12 && e !== 'Sitting') P.emote = null;
}
function ubicarPersona(P) {
  if (P.rag || P.cuad) return;
  const y = P.pos.y - 1 - (P.bajar || 0) + (P.subir || 0) - (P.sentado ? 0.02 : 0);
  if (P.qVeh && P.sentado) {
    // sentado: el giro completo del vehículo, con el pivote en la cadera (1 m arriba de los pies; menos en los bajitos)
    const q = P.qVeh, d = q.rot(v3(0, -(P.tam || 1), 0));
    m4trs([P.pos.x + d.x, P.pos.y + d.y - (P.bajar || 0), P.pos.z + d.z], [q.x, q.y, q.z, q.w], [1, 1, 1], P.md.raiz);
  } else if (P.inclin) {
    // volando (mod): el cuerpo inclinado con el pivote en la cadera
    const q = Quat.axis(0, 1, 0, P.yaw).mul(P.inclin), d = q.rot(v3(0, -(P.tam || 1), 0));
    m4trs([P.pos.x + d.x, P.pos.y + d.y, P.pos.z + d.z], [q.x, q.y, q.z, q.w], [1, 1, 1], P.md.raiz);
  } else m4trs([P.pos.x, y, P.pos.z], [0, Math.sin(P.yaw / 2), 0, Math.cos(P.yaw / 2)], [1, 1, 1], P.md.raiz);
  P.md.sucio = true;
  P.bajar = 0; P.subir = 0;
}
function dibujarPersona(P) {
  if (!P.visible) return;
  P.cDib = PERS_N; // (lo que se lleva puesto, como la radio en la espalda, usa los huesos de este cuadro)
  // pateando en primera persona se ve el cuerpo: la cabeza (y el gorro) achicados a nada, que taparían la cámara
  const sinCabeza = P === JUG.cuerpo && !JUG.tercera && patadaActiva(P);
  patadaCabeza(P, sinCabeza);
  ubicarPersona(P);
  // (sentado, en un emote o en el piso como muñeco no se clavan los pies; se olvida el apoyo viejo para no tirar del pie al volver)
  // (los emotes de captura sí pasan por el apoyo: trae la altura del piso de la captura y que nada quede abajo del piso)
  const cmu = typeof P.emote === 'string' && P.emote.startsWith('c:');
  if (P.nadoK > 0.01 && P.nadoVol) nadoAltura(P);
  else if (!P.rag && P.hum && !P.sentado && (!P.emote || cmu) && !P.inclin && !P.cuad && !P.cic) { aterrizarPies(P); if (!P.emote) piesIK(P, TIEMPO.dt || 0.016); else P.ik = null; } else P.ik = null;
  P.md.encolar();
  if (P.gorroMd && !P.cicManos && !sinCabeza) {
    const hi = P.D.h.Head;
    if (hi !== undefined) { P.md.actualizar(); m4mul(P.md.W[hi], P.gorroL, _mb); P.gorroMd.ponerRaiz(_mb); P.gorroMd.encolar(); }
  }
  // el arma en la mano derecha (los modelos de tercera persona del juego, con su lugar en la mano)
  if (P.arma && !P.rag && !P.sentado && !P.emote && !P.cuad && !P.cicManos) {
    if (!armaGmDibujar(P)) {
      const A = arma3p(P, P.arma), hi = P.D.h.RightHand;
      if (A && hi !== undefined) { P.md.actualizar(); m4mul(P.md.W[hi], A.W, _mb); A.md.ponerRaiz(_mb); A.md.encolar(); }
    }
  }
}
// nadando acostado la cadera va justo debajo del agua (la captura viene acostada en el piso); flotando parado, como está
function nadoAltura(P) {
  P.ik = null; const hi = P.D.h.Hips; if (hi === undefined) return;
  P.md.actualizar(); const W = P.md.W[hi], meta = P.nadoVol.y1 - 0.08 * (P.tam || 1);
  P.md.raiz[13] += (meta - W[13]) * (P.nadoW || 0) * P.nadoK; P.md.sucio = true;
}
// pies en el piso: después de animar, se sube o baja el cuerpo para que el pie más bajo quede apoyado
// (agachado o al caer, del todo; caminando, sólo que no se hunda ni flote más de unos centímetros)
// lo que no puede quedar abajo del piso en un emote de captura: hueso y su grueso (el centro va así de arriba del piso)
const PISO_HUESOS = [['Hips', 0.09], ['Spine1', 0.1], ['Spine2', 0.1], ['Neck', 0.07], ['Head', 0.1], ['LeftHand', 0.03], ['RightHand', 0.03], ['LeftForeArm', 0.04], ['RightForeArm', 0.04], ['LeftLeg', 0.06], ['RightLeg', 0.06], ['LeftArm', 0.06], ['RightArm', 0.06], ['LeftFoot', 0.05], ['RightFoot', 0.05], ['LeftToeBase', 0.02], ['RightToeBase', 0.02], ['LeftHandMiddle3', 0.01], ['RightHandMiddle3', 0.01], ['LeftHandIndex3', 0.01], ['RightHandIndex3', 0.01], ['LeftHandRing3', 0.01], ['RightHandRing3', 0.01]];
function aterrizarPies(P) {
  const md = P.md, h = P.D.h; if (h.LeftFoot === undefined || h.RightFoot === undefined) return;
  md.actualizar();
  const yl = md.W[h.LeftFoot][13], yr = md.W[h.RightFoot][13], piso = P.pos.y - 1;
  // lo más bajo de la suela: el tobillo menos su altura o, con el pie girado, el talón o la punta
  let bajo = Math.min(yl, yr) - P.D.tobillo; const pz = P.D.pies;
  if (pz) for (const [l, iF] of [['L', h.LeftFoot], ['R', h.RightFoot]]) { const W = md.W[iF]; for (const q of pz[l]) { const y = W[1] * q.x + W[5] * q.y + W[9] * q.z + W[13]; if (y < bajo) bajo = y; } }
  const dy = piso - bajo, lleno = P.hum && P.hum.agach > 0.05;
  // (los que flotan se despegan del piso al deslizarse: lo calcula humFlotar)
  // (los emotes de captura de movimiento traen la altura de la cadera medida sobre el piso de la captura: acostado o
  // rodando los pies quedan abajo del tobillo y levantarlos lo hacía flotar; sólo se corrige un poco)
  const cmu = typeof P.emote === 'string' && P.emote.startsWith('c:');
  let meta = clamp(dy, lleno ? -0.75 : -0.06, cmu ? 0.06 : 0.5) + (P.flota && P.hum ? P.hum.flAlto || 0 : 0);
  // y ninguna parte del cuerpo abajo del piso (acostado, rodando, en cuatro patas): se sube lo que haga falta
  if (cmu) {
    // (los dedos no están en la tabla de huesos humanoides: se buscan por nombre en el esqueleto entero)
    const D = P.D; if (!D.pisoH) D.pisoH = PISO_HUESOS.map(([n, r]) => { const i = D.h[n] ?? D.h['mixamorig:' + n] ?? D.sub.findIndex((x) => x.n === n || x.n.endsWith(':' + n)); return [i, r * (P.tam || 1)]; }).filter((x) => x[0] !== undefined && x[0] >= 0);
    let sube = 0; for (const [i, r] of D.pisoH) { const f = r - (md.W[i][13] - piso); if (f > sube) sube = f; }
    meta = Math.max(meta, Math.min(sube, 0.8));
  }
  P.pieCorr = (P.pieCorr || 0) + (meta - (P.pieCorr || 0)) * Math.min(1, (TIEMPO.dt || 0.016) * 18);
  if (Math.abs(P.pieCorr) > 1e-4) { md.raiz[13] += P.pieCorr; md.sucio = true; }
}
// pies clavados: cuando un pie pisa, su lugar en el piso queda fijo mientras dure el apoyo y la pierna se acomoda
// (dos huesos: muslo y pantorrilla, la rodilla en el mismo plano que traía). Así el pie que pisa no patina aunque el
// clip no coincida del todo con la velocidad o la dirección. Se suelta al levantar el pie, si la pierna no llega o
// después de 0,7 s, con entrada y salida suaves
const IK_PIERNA = { L: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], R: ['RightUpLeg', 'RightLeg', 'RightFoot'] };
function rotEntre(a, b) {
  const la = a.len(), lb = b.len(); if (la < 1e-6 || lb < 1e-6) return new Quat();
  const c = vcross(a, b), s = c.len() / (la * lb), d = vdot(a, b) / (la * lb);
  if (s < 1e-7) return new Quat();
  return Quat.axis(c.x, c.y, c.z, Math.atan2(s, d));
}
function piesIK(P, dt) {
  if (!P.suelo || P.sentado || P.emote || P.rag || P.flota || DBG.sinIK) { P.ik = null; return; }   // (sin piernas no hay pies que clavar)
  const md = P.md, h = P.D.h, A = P.D.sub; md.actualizar();
  const W = md.W, piso = P.pos.y - 1, sp = Math.hypot(P.vel.x, P.vel.z), tob = P.D.tobillo;
  const ik = P.ik || (P.ik = { L: { w: 0 }, R: { w: 0 } });
  const D = P.D; if (!D.ikDedo) D.ikDedo = { L: D.sub.findIndex((n) => /LeftToeBase$/.test(n.n)), R: D.sub.findIndex((n) => /RightToeBase$/.test(n.n)) };
  let cambio = false;
  for (const lado of ['L', 'R']) {
    const [nU, nK, nA] = IK_PIERNA[lado], iU = h[nU], iK = h[nK], iA = h[nA];
    if (iU === undefined || iK === undefined || iA === undefined) continue;
    const S = ik[lado], Hp = v3(W[iU][12], W[iU][13], W[iU][14]), Kp = v3(W[iK][12], W[iK][13], W[iK][14]), Ap = v3(W[iA][12], W[iA][13], W[iA][14]);
    // el punto que pisa: entre el tobillo y la punta (al levantar el talón, el pie gira sobre la punta)
    const iT = D.ikDedo[lado], kc = 0.5, Cp = iT >= 0 ? v3(Ap.x + (W[iT][12] - Ap.x) * kc, 0, Ap.z + (W[iT][14] - Ap.z) * kc) : v3(Ap.x, 0, Ap.z);
    const vel = S.prev ? Math.hypot(Cp.x - S.prev.x, Cp.z - S.prev.z) / Math.max(dt, 1e-3) : 0;
    S.prev = Cp;
    const alto = Ap.y - piso - tob, a = Kp.distTo(Hp), b = Ap.distTo(Kp);
    // pisa: el pie (sin corregir) toca el piso y no va hacia adelante mucho más rápido que el cuerpo
    const apoya = alto < 0.03 && vel < sp + 1.5;
    if (apoya && !S.lock && S.w < 0.05) { S.lock = Cp; S.t = 0; }
    if (S.lock) {
      S.t += dt;
      // se suelta cuando el clip levanta el pie o cuando la pierna ya no llega (no se arrastra)
      // se suelta cuando el clip levanta el pie o cuando la pierna ya no llega (no se arrastra)
      const lejos = Math.hypot(Ap.x + S.lock.x - Cp.x - Hp.x, Ap.y - Hp.y, Ap.z + S.lock.z - Cp.z - Hp.z) > (a + b) * 0.985;
      if (alto > 0.07 || lejos || S.t > 1.0) S.lock = null; else S.ult = S.lock;
    }
    S.w = S.lock ? Math.min(1, S.w + dt / 0.05) : Math.max(0, S.w - dt / 0.12);
    if (S.w <= 0.001 || !S.ult) continue;
    const T = v3(Ap.x + (S.ult.x - Cp.x) * S.w, Ap.y, Ap.z + (S.ult.z - Cp.z) * S.w);
    // la rodilla nueva: misma distancia a la cadera y al tobillo, en el plano que trae la pierna
    const d = clamp(T.distTo(Hp), Math.abs(a - b) + 1e-3, a + b - 1e-3), dir = vsub(T, Hp).norm();
    const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
    let pol = vsub(Kp, Hp); pol = vsub(pol, vscale(dir, vdot(pol, dir)));
    if (pol.len() < 1e-5) pol = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)); pol.norm();
    const Kn = vadd(Hp, vadd(vscale(dir, x), vscale(pol, hh)));
    // giros en el mundo y de vuelta a cada hueso (el pie conserva su giro en el mundo)
    const qU = m4quat(W[iU]), qK = m4quat(W[iK]), qA = m4quat(W[iA]), qPU = m4quat(W[A[iU].pa]);
    const R1 = rotEntre(vsub(Kp, Hp), vsub(Kn, Hp)), qUn = R1.clone().mul(qU);
    const A2 = vadd(Hp, R1.rot(vsub(Ap, Hp)));
    const R2 = rotEntre(vsub(A2, Kn), vsub(T, Kn)), qKn = R2.clone().mul(R1).mul(qK);
    const pon = (i, q) => { q.norm(); const r = md.r[i]; r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w; };
    pon(iU, qPU.conj().mul(qUn)); pon(iK, qUn.conj().mul(qKn)); pon(iA, qKn.conj().mul(qA));
    cambio = true;
  }
  if (cambio) md.sucio = true;
}
// ---------------- agarre como en GMod, con cualquier personaje ----------------
// Las armas de GMod (herramientas/gmod.py) van como allá: el hueso de la mano del arma pegado al de la mano del jugador,
// con la mano cerrada como la del jugador de GMod. Todo se hace en el marco de la mano (de la muñeca al nudillo del
// medio, la normal de la palma y su perpendicular), que no depende de cómo esté armado cada esqueleto: el arma queda en
// la palma y los dedos la rodean en los 32 personajes (y el arma se agranda con la mano: la de Freddy es más grande)
const DEDOS_GM = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
function huesosMixamo(D) {
  if (!D.mx) { D.mx = {}; D.sub.forEach((n, i) => { const m = /^mixamorig\d*:(.*)$/.exec(n.n); if (m && D.mx[m[1]] === undefined) D.mx[m[1]] = i; }); }
  return D.mx;
}
// el marco de la mano (columnas x, y, z y el origen en la muñeca) y el largo de la muñeca al nudillo del medio. Las manos
// sin meñique usan el anular; las que tienen menos dedos (manos tipo mitón), el hueso de la mano con el marco que tiene
// el del Hero respecto del suyo (los esqueletos de Mixamo tienen los mismos ejes)
let _manoCal = null;
function manoMarco(W, ix, lado, out) {
  const h = W[ix[lado + 'Hand']]; if (!h) return 0;
  const m = W[ix[lado + 'HandMiddle1']], i = W[ix[lado + 'HandIndex1']], k = W[ix[lado + 'HandPinky1']] || W[ix[lado + 'HandRing1']];
  if (!m || !i || !k) {
    const C = manoCalibrar(lado); if (!C || !i) return 0;
    m4mul(h, C.K, out); const s = Math.hypot(out[0], out[1], out[2]) || 1;
    for (let c = 0; c < 12; c++) if (c % 4 !== 3) out[c] /= s;   // (sin la escala del hueso)
    return Math.hypot(i[12] - h[12], i[13] - h[13], i[14] - h[14]) * C.r;
  }
  let x0 = m[12] - h[12], x1 = m[13] - h[13], x2 = m[14] - h[14], L = Math.hypot(x0, x1, x2) || 1; x0 /= L; x1 /= L; x2 /= L;
  // (hay esqueletos con el hueso de la mano a mitad del antebrazo: la palma medía 2,6 veces el dedo del medio, cuando en
  // una mano es de 0,9 a 1,25. Ahí la muñeca va 1,15 dedos atrás del nudillo y la mano mide eso)
  let o0 = h[12], o1 = h[13], o2 = h[14];
  let f = 0, ant = m;   // (el largo del dedo: la suma de sus falanges, que no cambia al cerrarlo)
  for (let s = 2; s <= 4; s++) { const q = W[ix[lado + 'HandMiddle' + s]]; if (!q) break; f += Math.hypot(q[12] - ant[12], q[13] - ant[13], q[14] - ant[14]); ant = q; }
  if (f > 1e-4 && L > 1.5 * f) { L = 1.15 * f; o0 = m[12] - x0 * L; o1 = m[13] - x1 * L; o2 = m[14] - x2 * L; }
  const a0 = k[12] - o0, a1 = k[13] - o1, a2 = k[14] - o2, b0 = i[12] - o0, b1 = i[13] - o1, b2 = i[14] - o2;
  let n0 = a1 * b2 - a2 * b1, n1 = a2 * b0 - a0 * b2, n2 = a0 * b1 - a1 * b0; const dn = n0 * x0 + n1 * x1 + n2 * x2; n0 -= dn * x0; n1 -= dn * x1; n2 -= dn * x2;
  const ln = Math.hypot(n0, n1, n2) || 1; n0 /= ln; n1 /= ln; n2 /= ln;
  out[0] = x0; out[1] = x1; out[2] = x2; out[3] = 0; out[4] = n0; out[5] = n1; out[6] = n2; out[7] = 0;
  out[8] = x1 * n2 - x2 * n1; out[9] = x2 * n0 - x0 * n2; out[10] = x0 * n1 - x1 * n0; out[11] = 0; out[12] = o0; out[13] = o1; out[14] = o2; out[15] = 1;
  return L;
}
// el marco de la mano del Hero respecto de su hueso de la mano (y el largo respecto de la muñeca al índice), una vez
function manoCalibrar(lado) {
  const c = _manoCal || (_manoCal = {}); if (c[lado] !== undefined) return c[lado];
  const D = datosSkin('Hero'), md = new Modelo(D.sub), ix = huesosMixamo(D), F = new Float32Array(16); md.actualizar();
  const L = manoMarco(md.W, ix, lado, F), h = md.W[ix[lado + 'Hand']], i = md.W[ix[lado + 'HandIndex1']];
  if (!L || !h || !i) return (c[lado] = null);
  const Hn = Float32Array.from(h), s = Math.hypot(h[0], h[1], h[2]) || 1; for (let k = 0; k < 12; k++) if (k % 4 !== 3) Hn[k] /= s;
  const K = new Float32Array(16); m4mul(M4.inv(Hn), F, K);
  return (c[lado] = { K, r: L / Math.hypot(i[12] - h[12], i[13] - h[13], i[14] - h[14]) });
}
// el mango del arma en el marco de la mano (muñeca, nudillo del medio, palma; en metros): lo que queda dentro de la mano
// (los vértices a menos de 6,4 cm del centro de la palma, con la escala de la mano), su eje principal y su radio
function mangoArma(A, L) {
  const k = L / DATA.gm.manoR.L, mc = mallaCPU(A.m), P = mc.P, I = mc.I, G = A.Gm || (A.Gm = Float32Array.from(A.G)), pal = v3(L * 0.5, 0, 0), rad = 0.064 * k, pts = [];
  const V = []; for (let i = 0; i < P.length; i += 3) V.push(m4pt(G, P[i], P[i + 1], P[i + 2], v3()).scale(k));
  // (sobre las aristas, cada 1 cm: las barras largas como la de la palanca tienen vértices sólo en las puntas)
  for (let t = 0; t + 2 < I.length; t += 3) for (const [a, b] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) {
    if (a > b) continue; const pa = V[a], pb = V[b], n = Math.max(1, Math.ceil(pa.distTo(pb) / 0.01));
    for (let j = 0; j <= n; j++) { const q = vadd(pa, vscale(vsub(pb, pa), j / n)); if (q.distTo(pal) < rad) pts.push(q); }
  }
  if (pts.length < 6) return null;
  const c = pts.reduce((a, q) => a.add(q), v3()).scale(1 / pts.length);
  let ax = vsub(pts.reduce((a, q) => (q.distTo(c) > a.distTo(c) ? q : a), pts[0]), c).norm();
  for (let it = 0; it < 40; it++) { const nx = v3(); for (const q of pts) { const d = vsub(q, c); nx.add(vscale(d, vdot(d, ax))); } ax = nx.norm(); }
  const ds = pts.map((q) => { const d = vsub(q, c); return vsub(d, vscale(ax, vdot(d, ax))).len(); }).sort((x, y) => x - y);
  return { c, ax, r: ds[(ds.length * 0.5) | 0] };
}
// cuánto rodea una cadena de puntos el eje del mango (grados, del primero al último) y lo lejos que queda un punto del eje
function rodeaMango(Q, M) {
  const pp = (q) => { const d = vsub(q, M.c); return vsub(d, vscale(M.ax, vdot(d, M.ax))); };
  const ref = pp(Q[0]).norm(), e2 = vcross(M.ax, ref); let tot = 0, prev = null;
  for (const q of Q) { const u = pp(q), a = Math.atan2(vdot(u, e2), vdot(u, ref)); if (prev !== null) { let da = a - prev; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; tot += da; } prev = a; }
  return Math.abs(tot) * 180 / Math.PI;
}
const ejeMango = (q, M) => { const d = vsub(q, M.c); return vsub(d, vscale(M.ax, vdot(d, M.ax))).len(); };
// la mano derecha que agarra: cada dedo (índice a meñique) se cierra sobre el mango de verdad. Desde la postura de GMod, se
// prueba cuánto más (o menos) doblar las tres articulaciones (alrededor del eje en que se dobla ese dedo en GMod) y queda
// la que deja las articulaciones y la punta donde las tiene GMod (en el marco de la mano, a la escala de la mano: el arma
// está en el mismo lugar), sin meterse en el mango
function cerrarSobreMango(D, md, ix, A, G, out) {
  md.sucio = true; md.actualizar();
  const F = new Float32Array(16), L = manoMarco(md.W, ix, 'Right', F), PG = G.Right && G.Right.pos; if (!L || !PG) return;
  const Fi = M4.inv(F), M = mangoArma(A, L); if (!M) return;
  const rf = 0.065 * L;   // (el radio de un dedo, con el tamaño de la mano)
  for (const dedo of ['Index', 'Middle', 'Ring', 'Pinky']) {
    const g = G.Right[dedo], T = PG[dedo]; if (!g || !T) continue;
    const ids = [1, 2, 3, 4].map((k) => ix['RightHand' + dedo + k]); if (ids[0] === undefined || ids[1] === undefined || ids[2] === undefined) continue;
    md.sucio = true; md.actualizar();
    const J = ids.map((b) => (b === undefined ? null : m4pt(Fi, md.W[b][12], md.W[b][13], md.W[b][14], v3())));
    if (!J[3]) J[3] = vadd(J[2], vscale(vsub(J[2], J[1]), 0.8));
    const meta = T.map((q) => v3(q[0] * L, q[1] * L, q[2] * L));
    const ax = vcross(v3(g[0][0], g[0][1], g[0][2]), v3(g[2][0], g[2][1], g[2][2])); if (ax.len() < 0.05) continue; ax.norm();
    const doblar = (dl) => { const Q = J.map((q) => q.clone()); for (let k = 0; k < 3; k++) { const R = Quat.axis(ax.x, ax.y, ax.z, dl * (k === 2 ? 0.8 : 1)); for (let t = k + 1; t < 4; t++) Q[t] = vadd(Q[k], R.rot(vsub(Q[t], Q[k]))); } return Q; };
    let mejor = null;
    for (let dl = -0.7; dl <= 1.5; dl += 0.02) {
      const Q = doblar(dl); let pen = 0, e = 0;
      for (let k = 0; k < 3; k++) for (let u = 0.25; u <= 1; u += 0.25) { const d = ejeMango(vadd(Q[k], vscale(vsub(Q[k + 1], Q[k]), u)), M), f = Math.max(0, M.r + 0.6 * rf - d) / L; pen += f * f; }
      for (const [k, w] of [[1, 0.5], [2, 1], [3, 1.5]]) e += w * (Q[k].distTo(meta[k]) / L) ** 2;
      e += pen * 400; if (!mejor || e < mejor.e) mejor = { e, Q };
    }
    // cada falange hacia su dirección nueva, de a una (girando el hueso respecto de su padre)
    for (let k = 0; k < 3; k++) {
      const a = ids[k], bb = ids[k + 1]; if (a === undefined || bb === undefined) break;
      md.sucio = true; md.actualizar();
      const Wa = md.W[a], Wb = md.W[bb], cur = v3(Wb[12] - Wa[12], Wb[13] - Wa[13], Wb[14] - Wa[14]), th = vsub(mejor.Q[k + 1], mejor.Q[k]);
      const t = v3(F[0] * th.x + F[4] * th.y + F[8] * th.z, F[1] * th.x + F[5] * th.y + F[9] * th.z, F[2] * th.x + F[6] * th.y + F[10] * th.z);
      const loc = m4quat(md.W[D.sub[a].pa]).conj().mul(rotEntre(cur, t).mul(m4quat(Wa))).norm(), r = md.r[a];
      r[0] = loc.x; r[1] = loc.y; r[2] = loc.z; r[3] = loc.w;
      const o = out.find((x) => x[0] === a); if (o) { o[1] = loc.x; o[2] = loc.y; o[3] = loc.z; o[4] = loc.w; } else out.push([a, loc.x, loc.y, loc.z, loc.w]);
    }
  }
}
// los giros de los dedos para un arma, una vez por personaje: cada falange apunta como en GMod (en el marco de la mano),
// en la pose de enlace, y la mano derecha se cierra sobre el mango (cerrarSobreMango); son giros respecto de la mano, así
// que sirven en cualquier pose
function dedosCalcular(D, tipo, A) {
  const G = DATA.gm && DATA.gm.dedos && DATA.gm.dedos[tipo]; if (!G) return null;
  const md = new Modelo(D.sub), ix = huesosMixamo(D), F = new Float32Array(16), out = []; md.actualizar();
  for (const lado of ['Right', 'Left']) {
    if (!manoMarco(md.W, ix, lado, F)) continue;
    for (const dedo of DEDOS_GM) {
      const dirs = G[lado] && G[lado][dedo]; if (!dirs) continue;
      for (let s = 0; s < 3; s++) {
        const a = ix[lado + 'Hand' + dedo + (s + 1)], b = ix[lado + 'Hand' + dedo + (s + 2)]; if (a === undefined || b === undefined) break;
        md.sucio = true; md.actualizar();
        const Wa = md.W[a], Wb = md.W[b], g = dirs[s], cur = v3(Wb[12] - Wa[12], Wb[13] - Wa[13], Wb[14] - Wa[14]);
        const t = v3(F[0] * g[0] + F[4] * g[1] + F[8] * g[2], F[1] * g[0] + F[5] * g[1] + F[9] * g[2], F[2] * g[0] + F[6] * g[1] + F[10] * g[2]);
        const loc = m4quat(md.W[D.sub[a].pa]).conj().mul(rotEntre(cur, t).mul(m4quat(Wa))).norm(), r = md.r[a];
        r[0] = loc.x; r[1] = loc.y; r[2] = loc.z; r[3] = loc.w; out.push([a, loc.x, loc.y, loc.z, loc.w]);
      }
    }
  }
  if (A) cerrarSobreMango(D, md, ix, A, G, out);
  return out;
}
// cada cuadro, con un arma de GMod en la mano: los dedos cerrados como en GMod
function agarreGm(P) {
  const A = P.arma && !P.emote && !P.sentado && DATA.gm && DATA.gm.armas[P.arma]; if (!A) return;
  const c = P.D.dedosGm || (P.D.dedosGm = {}); if (c[P.arma] === undefined) c[P.arma] = dedosCalcular(P.D, A.tipo, A);   // (por arma: cada mango es distinto)
  const L = c[P.arma]; if (!L) return;
  for (const x of L) { const r = P.md.r[x[0]]; r[0] = x[1]; r[1] = x[2]; r[2] = x[3]; r[3] = x[4]; }
  P.md.sucio = true;
}
// el arma de GMod en la mano: marco de la mano (agrandado con la mano) por la matriz del arma
const _mfG = new Float32Array(16), _mgG = new Float32Array(16);
function armaGmDibujar(P) {
  const A = DATA.gm && DATA.gm.armas[P.arma]; if (!A) return false;
  P.md.actualizar(); const L = manoMarco(P.md.W, huesosMixamo(P.D), 'Right', _mfG); if (!L) return false;
  const k = clamp(L / DATA.gm.manoR.L, 0.3, 2.6); for (let i = 0; i < 12; i++) if (i % 4 !== 3) _mfG[i] *= k;   // (hasta Jake, que es chiquito)
  if (!A.Gm) A.Gm = Float32Array.from(A.G);
  m4mul(_mfG, A.Gm, _mgG);
  const c = P.armasGm || (P.armasGm = {}), md = c[P.arma] || (c[P.arma] = new Modelo([{ n: P.arma, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, m: A.m, mt: A.mt }]));
  md.ponerRaiz(_mgG); md.encolar(); return true;
}
const ARMA_3P = { Pistol: 'pistol', Revolver: 'revolver', Smg: 'smg', Akm: 'Akm', Sniper: 'sniper', Shotgun: 'Shotgun', RPG: 'RocketLauncher', Crossbow: 'crossbow', Bat: 'bat', GravityGun: 'GravityGun', PhysicsGun: 'PhysicGun', ToolBaton: 'ToolBaton' };
const _arma3pDatos = {};
function arma3p(P, nombre) {
  P.armas3p = P.armas3p || {};
  if (P.armas3p[nombre] !== undefined) return P.armas3p[nombre];
  let D = _arma3pDatos[nombre];
  if (D === undefined) {
    const arb = arbolJugador(), cr = arb.findIndex((n) => n.n === 'CharactersRoot'), wi = arb.findIndex((n) => n.pa === cr && n.n === 'Weapons');
    const ni = ARMA_3P[nombre] ? arb.findIndex((n) => n.pa === wi && n.n === ARMA_3P[nombre]) : -1;
    if (wi < 0 || ni < 0) D = null;
    else { const W = new Float32Array(16); m4trs(arb[wi].p, arb[wi].r, arb[wi].s, W); D = { sub: subArbol(arb, ni), W }; }
    _arma3pDatos[nombre] = D;
  }
  return (P.armas3p[nombre] = D ? { md: new Modelo(D.sub), W: D.W } : null);
}
// ---------------- muñeco de trapo ----------------
function ragdoll(P, impulso, donde) {
  if (P.rag) return;
  ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
  const md = P.md, A = md.A, cuerpos = new Map();
  for (let i = 0; i < A.length; i++) {
    const x = A[i]; if (!x.rb || !x.col) continue;
    const c = x.col[0], W = md.W[i], s = m4esc(W);
    let sh, cen = m4pt(W, c.c[0], c.c[1], c.c[2], v3());
    if (c.k === 'b') sh = boxShape(Math.max(0.03, Math.abs(c.s[0] * s) / 2), Math.max(0.03, Math.abs(c.s[1] * s) / 2), Math.max(0.03, Math.abs(c.s[2] * s) / 2));
    else if (c.k === 'c') sh = capsuleShape(c.r * s, Math.max(0.01, c.h * s / 2 - c.r * s));
    else sh = sphereShape((c.r || 0.1) * s);
    const b = new Body(sh, Math.max(1, x.rb.m), { fric: 0.8, rest: 0.05, damp: 0.1, angDamp: 0.8 });
    b.pos.copy(cen); b.q.copy(m4quat(W));
    if (c.k === 'c' && c.d !== 1) b.q.mul(c.d === 0 ? Quat.axis(0, 0, 1, Math.PI / 2) : Quat.axis(1, 0, 0, Math.PI / 2));
    b.group = 1000 + (P.id || PERS.indexOf(P)); b.persona = P; b.noJug = true; b.noGrab = false;
    b.vel.copy(P.vel); addBody(b);
    // del cuerpo al hueso: W = M(cuerpo) · off
    const Mb = m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], new Float32Array(16));
    cuerpos.set(i, { b, off: m4mul(M4.inv(Mb), W, new Float32Array(16)) });
  }
  // uniones con el ancestro más cercano que tenga cuerpo
  for (const [i, e] of cuerpos) {
    let p = A[i].pa; while (p >= 0 && !cuerpos.has(p)) p = A[p].pa;
    if (p < 0) continue;
    const W = md.W[i], pt = v3(W[12], W[13], W[14]), nom = A[i].n;
    const ax = vsub(pt, v3(md.W[p][12], md.W[p][13], md.W[p][14])); if (ax.len() < 1e-4) ax.set(0, 1, 0);
    const rod = /Leg$|ForeArm$/.test(nom);
    addJoint(cuerpos.get(p).b, e.b, pt, ax.norm(), rod ? { hinge: false, swing: 0.25, twist: 0.2 } : { swing: /Head/.test(nom) ? 0.6 : 0.9, twist: 0.5 });
  }
  if (impulso) { let best = null, bd = 1e9; for (const [i, e] of cuerpos) { const d = e.b.pos.distTo(donde || P.pos); if (d < bd) { bd = d; best = e.b; } } if (best) best.vel.add(impulso); }
  md.fijo = []; P.rag = { cuerpos, t: 0 };
}
function ragdollPaso(P) {
  const R2 = P.rag; if (!R2) return;
  for (const [i, e] of R2.cuerpos) { const b = e.b; const M = m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _mb); P.md.fijo[i] = m4mul(M, e.off, P.md.fijo[i] || new Float32Array(16)); }
  // los huesos sin cuerpo siguen a su padre
  P.md.sucio = true;
  const h = R2.cuerpos.get(P.D.h.Hips); if (h) P.pos.copy(h.b.pos);
}
function ragdollFin(P) { if (!P.rag) return; for (const [, e] of P.rag.cuerpos) removeBody(e.b); P.rag = null; P.md.fijo = null; P.md.sucio = true; }
// ---------------- daño ----------------
function danarPersona(P, dan, pos, d) {
  if (P === JUG.cuerpo) { danarJugador(dan, pos); return; }
  const vivia = P.vivo !== false;
  if (vivia) humAccion(P, 'golpe');
  if (P.npc && P.vivo) { P.vida -= dan; if (P.vida <= 0) { P.vivo = false; ragdoll(P, vscale(d.clone().norm(), Math.min(12, dan * 0.3)), pos); P.muertoT = 8; } }
  if (dan > 0 && vivia) sonVoz(P, P.vivo === false ? 'muere' : 'dolor', P.pos);   // (el que recibe el golpe: su voz; tirado, nada)
  if (P.remoto && typeof redDano === 'function') redDano(P, dan, d);
}
// ---------------- el cuerpo del jugador (tercera persona, vehículos, muerte) ----------------
function jugadorCuerpoNuevo() {
  if (JUG.cuerpo) borrarPersona(JUG.cuerpo);
  JUG.cuerpo = crearPersona(JUG.skinRol || JUG.skinMod || PREFS.skin, PREFS.gorro, { nombre: PREFS.nombre });
  const t = tamSkin(JUG.cuerpo.skin); jugadorTam(t.k, t.ojo);
}
function jugadorRagdoll() { const P = JUG.cuerpo; if (!P) return; P.vel.copy(JUG.vel); ragdoll(P, vscale(JUG.vel, 0.2)); }
function emote(e) {
  if (!JUG.cuerpo || JUG.vehiculo) return;
  // los de captura de movimiento se bajan la primera vez: arranca cuando llegó (si no, empezaría por la mitad)
  if (typeof e === 'string' && e.startsWith('c:') && typeof emoCargar === 'function' && !EMO.clips[e]) {
    aviso(T('emo.bajando'), 1.5); emoCargar(e).then((c) => { if (c) emote(e); else aviso(T('errRed'), 2); }); return;
  }
  if (typeof emoUsado === 'function') emoUsado(e);
  sonEmote(JUG.cuerpo, e);
  JUG.cuerpo.emote = e; JUG.cuerpo.emoteT = 0; if (!JUG.tercera) { JUG.tercera = true; JUG.terceraEmote = true; } if (typeof redEmote === 'function') redEmote(e);
}
function personasPaso(dt) {
  const P = JUG.cuerpo;
  if (P) {
    if (!JUG.vivo || NAT.rag) ragdollPaso(P);
    else {
      if (P.rag) ragdollFin(P);
      P.pos.copy(JUG.pos); P.vel.copy(JUG.vel); P.suelo = JUG.suelo || !!JUG.vehiculo; P.agachado = ENT.agachar && !JUG.vehiculo;
      P.yaw = JUG.vehiculo ? Math.atan2(...(() => { const f = JUG.vehiculo.b.q.rot(v3(0, 0, 1)); return [f.x, f.z]; })()) : JUG.yaw;
      P.sentado = !!JUG.vehiculo; P.manejando = !!JUG.vehiculo && JUG.asiento === 0 && JUG.vehiculo.veh.tipo !== 'asiento';
      P.qVeh = JUG.vehiculo ? JUG.vehiculo.b.q : null;
      P.arma = JUG.vehiculo ? null : ARM.lista[ARM.i]; P.mira = JUG.pitch;
      if (P.emote && (Math.hypot(JUG.vel.x, JUG.vel.z) > 0.5 || !JUG.suelo)) { P.emote = null; if (JUG.terceraEmote) { JUG.tercera = false; JUG.terceraEmote = false; } }
      if (!P.emote && JUG.terceraEmote) { JUG.tercera = false; JUG.terceraEmote = false; }
      natPersona(P, dt);
    }
  }
  for (const Q2 of PERS) {
    if (Q2 === P) continue;
    if (Q2.rag) { ragdollPaso(Q2); if (Q2.npc && (Q2.muertoT -= dt) <= 0) borrarPersona(Q2); }
  }
}
// con mucha gente: los que no se ven (fuera de la cámara y no al lado) no se animan ni se dibujan (el tiempo se junta para
// cuando vuelven); los de más de 40 m se animan un cuadro sí y uno no; los que ocupan menos del 20 % del alto de la
// pantalla usan su malla simplificada y los lejanos no hacen sombra
function dibujarPersonas() {
  PERS_N++;
  // (en patata, los aparatos más flojos o de 2 GB, los demás siempre con la simplificada: sus mallas enteras ni se suben
  // a la placa; en bajo, desde el 30 % del alto)
  const F = R.fr, cp = R.camPos, ty = Math.tan((CAM.fov || 70) * Math.PI / 360), dSom = (GFX.sombra || 0) >= 2 ? 35 : 22;
  const umbral = GFX.nombre === 'patata' ? 9 : GFX.nombre === 'bajo' ? 0.3 : GFX.lod === 0 && (GFX.sombra || 0) >= 3 ? 0.12 : 0.2;
  for (const P of PERS) {
    const yo = P === JUG.cuerpo;
    if (yo) { const ver = JUG.tercera || !JUG.vivo || (JUG.vehiculo && !JUG.fpVeh) || P.cicManos || patadaActiva(P); if (!ver) continue; }
    const tk = P.tam || 1, dx = P.pos.x - cp.x, dy = P.pos.y - cp.y, dz = P.pos.z - cp.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    P.dtJunto = Math.min(0.25, (P.dtJunto || 0) + (TIEMPO.dt || 0.016));
    if (!yo && d > 4 && F && !sphereIn(F, P.pos.x, P.pos.y - 1 + 0.95 * tk, P.pos.z, 1.4 * tk)) continue;
    if (!P.rag && (yo || d <= 40 || (PERS_N + (P.n1 || (P.n1 = 1 + (Math.random() * 7 | 0)))) % 2 === 0)) { animarPersona(P, P.dtJunto); P.dtJunto = 0; }
    const frac = 1.9 * tk / (2 * ty * Math.max(d, 0.1));
    P.md.lodBajo = !yo && (P.md.lodBajo ? frac < umbral + 0.01 : frac < umbral - 0.01);
    P.md.sinSombra = !yo && d > dSom;
    dibujarPersona(P);
  }
}
function personasLimpiar() { for (const P of PERS.slice()) borrarPersona(P); JUG.cuerpo = null; }

// llegó el paquete de un personaje: el mío y el del menú se rehacen con el de verdad (los de los otros jugadores, en red.js)
RBP.alListo.push((k) => {
  if (!k.startsWith('s_')) return; const s = k.slice(2);
  if (JUG.cuerpo && JUG.cuerpo.skinQuiere === s && JUEGO.estado === 'juego' && JUG.vivo) jugadorCuerpoNuevo();
  if (typeof MENU !== 'undefined' && MENU.lobby && MENU.lobby.skinQuiere === s) menuLobby(true, true);
});
