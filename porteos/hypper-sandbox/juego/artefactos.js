// ---------------- artefactos: la catapulta (como la de Simple Sandbox 3) y la bomba de Rick Prime ----------------
// Catapulta: E la dispara: el brazo gira de atrás para adelante y lo que está en la cuchara (cosas, gente, vos) sale
// volando para adelante y arriba; después el brazo vuelve solo. Bomba de Rick Prime (el aparato Omega de Rick and Morty):
// E elige a qué personaje borrar; cuenta 5 segundos con pitidos y luz verde, y explota en un destello verde que elimina a
// TODOS los que tienen ese personaje (gente de la partida, NPC, otros jugadores y vos si sos ese), sin tocar a nadie más.
// En la sala, los dos se ven y pasan para todos.
const ART = { cat: new Map(), omega: new Map(), flash: 0 };
const CAT_REPOSO = -0.3, CAT_TIRO = 1.5, CAT_SUELTA = 0.8, CAT_VEL = 17;   // (ángulos del brazo en radianes; velocidad del tiro en m/s)
const OMEGA_CUENTA = 5;
const artDe = (o) => o && o.art;
// ---------------- usar (E) ----------------
function artUsar(o) {
  if (o.art === 'catapulta') { artCatapultaTirar(o, true); return true; }
  if (o.art === 'omega') { artOmegaElegir(o); return true; }
  return false;
}
function artPista(o) { return o.art === 'catapulta' ? 'E: ' + T('art.tirar') : o.art === 'omega' ? 'E: ' + T('art.omega') : ''; }
// ---------------- la catapulta ----------------
// el brazo: la otra pieza del paquete (CatapultaBrazo), dibujada en el eje de la base y girando sobre él. Su largo va
// en el eje horizontal más largo de su malla; la cuchara está en la punta más alta (se mira en la malla), la argolla en
// la otra. Adelante de la base: su eje horizontal más largo (la cuchara queda atrás y tira para adelante)
const ejeLargo = (d) => (d.sc[0] >= d.sc[2] ? v3(1, 0, 0) : v3(0, 0, 1));
function artBrazo() {
  if (ART.brazo !== undefined) return ART.brazo;
  const k = DATA.pfPorNombre.CatapultaBrazo, n = k && DATA.pf[k].find((x) => x.m !== undefined);
  if (!n || !mallaCPU(n.m)) return (ART.brazo = null);
  // (la cuchara es la punta más ancha: la argolla de hierro de la otra punta es más alta, pero angosta)
  const d = DATA.ms[n.m], a = ejeLargo(d), L = Math.max(d.sc[0], d.sc[2]), H = d.sc[1], P = mallaCPU(n.m).P; let wa = 0, wb = 0;
  for (let i = 0; i < P.length; i += 3) { const t = P[i] * a.x + P[i + 2] * a.z, w = Math.abs(P[i] * a.z - P[i + 2] * a.x); if (t > L * 0.3) wa = Math.max(wa, w); else if (t < -L * 0.3) wb = Math.max(wb, w); }
  const s = wa >= wb ? 1 : -1, ac = vscale(a, s);   // (hacia la cuchara)
  return (ART.brazo = { m: n.m, mt: n.mt, L, H, ac, arg: vadd(vscale(ac, -L * 0.44), v3(0, H * 0.45, 0)), cuch: vadd(vscale(ac, L * 0.4), v3(0, H * 0.75, 0)) });
}
function artCat(o) {
  let c = ART.cat.get(o); if (c) return c;
  const d = DATA.ms[(DATA.pf[DATA.pfPorNombre.Catapulta] || []).find((x) => x.m !== undefined).m];
  const f = ejeLargo(d), B = artBrazo(), yaw = (v) => Math.atan2(v.x, v.z);
  // (el brazo con la cuchara hacia atrás; el giro, sobre el eje de costado: positivo levanta la cuchara)
  c = { a: CAT_REPOSO, t: -9, tiro: false, eje: d.sc[1] * 0.88, f, q0: Quat.axis(0, 1, 0, yaw(vscale(f, -1)) - yaw(B ? B.ac : f)), lat: vcross(v3(0, 1, 0), f).norm() };
  ART.cat.set(o, c); return c;
}
const _cA = new Float32Array(16), _cB = new Float32Array(16), _cM = new Float32Array(16);
// matriz del brazo: la base · el eje · el giro · la argolla en el eje
function artBrazoMatriz(o, c, out) {
  const B = artBrazo(), b = o.b;
  // (la del modelo de la base, como objetoMatriz: el cuerpo de la física está en su centro de masa, no en el piso)
  m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _cA); m4trs([-o.c.x, -o.c.y, -o.c.z], [0, 0, 0, 1], [1, 1, 1], _cB); m4mul(_cA, _cB, _cA);
  const q = Quat.axis(c.lat.x, c.lat.y, c.lat.z, c.a).mul(c.q0), off = q.rot(B.arg);
  m4trs([-off.x, c.eje - off.y, -off.z], [q.x, q.y, q.z, q.w], [1, 1, 1], _cB);
  return m4mul(_cA, _cB, out);
}
// la cuchara en el mundo
function artCuchara(o, c) { const B = artBrazo(), M = artBrazoMatriz(o, c, _cM); return m4pt(M, B.cuch.x, B.cuch.y, B.cuch.z, v3()); }
function artCatapultaTirar(o, local) {
  if (!artBrazo()) return;
  const c = artCat(o); if (c.tiro || TIEMPO.t - c.t < 1.2) return;
  c.tiro = true; c.t = TIEMPO.t; c.lanzo = false;
  sonar('CB_Swing', o.b.pos, 0.9, 0.55); sonar('PS_wood2', o.b.pos, 0.8, 0.7);
  if (local && RED.on && !o.remoto) publicar('a', { k: 'catap', o: claveObj(o) });
}
function artCatapultaPaso(o, c, dt) {
  if (c.tiro) {
    c.a = Math.min(CAT_TIRO, c.a + dt * 9);
    // al pasar por arriba suelta: lo que estaba en la cuchara sale para adelante y arriba
    if (!c.lanzo && c.a > CAT_SUELTA) { c.lanzo = true; artCatapultaLanzar(o, c); }
    if (c.a >= CAT_TIRO) c.tiro = false;
  } else c.a = Math.max(CAT_REPOSO, c.a - dt * 0.9);   // (vuelve despacio)
  if (c.ign && (c.ignT -= dt) <= 0) { for (const b of c.ign) { if (b.noCollide) b.noCollide.delete(o.b); if (o.b.noCollide) o.b.noCollide.delete(b); } c.ign = null; }
}
// (lo que sale de la cuchara no choca con la base por medio segundo: estaba apoyado en ella y la atravesaba al salir)
function artSinChoque(o, c, b) { (b.noCollide || (b.noCollide = new Set())).add(o.b); (o.b.noCollide || (o.b.noCollide = new Set())).add(b); (c.ign || (c.ign = [])).push(b); c.ignT = 0.5; }
function artCatapultaLanzar(o, c) {
  const a0 = c.a; c.a = CAT_REPOSO; const p = artCuchara(o, c); c.a = a0;   // (lo que estaba en la cuchara en reposo)
  const f = o.b.q.rot(c.f), dir = v3(f.x * 0.72, 0.7, f.z * 0.72).norm(), R = 1.1;
  let n = 0;
  for (const b of PH.bodies) {
    if (b === o.b || b.estatico || b.frozen || b.held || !b.dynamic && !b.persona) continue;
    if (b.pos.distTo(p) > R + (b.r || 0.3)) continue;
    b.vel.copy(vscale(dir, CAT_VEL)); b.wake(); n++; artSinChoque(o, c, b);
  }
  // yo (si estoy en la cuchara) y la gente de la partida
  const pies = v3(JUG.pos.x, JUG.pos.y - 0.6, JUG.pos.z);
  if (!JUG.vehiculo && pies.distTo(p) < R + 0.4) { JUG.vel.copy(vscale(dir, CAT_VEL)); JUG.suelo = false; JUG.tiempoSuelo = 0; n++; }
  for (const P of PERS) {
    if (P === JUG.cuerpo || P.remoto || !P.npc) continue;
    if (P.pos.distTo(p) < R + 0.6) { if (!P.rag && typeof npcTumbar === 'function') npcTumbar(P, vscale(dir, CAT_VEL), 0); else if (typeof danarPersona === 'function' && !P.rag) danarPersona(P, 1, P.pos.clone(), dir); if (P.rag) for (const [, e] of P.rag.cuerpos) { e.b.vel.copy(vscale(dir, CAT_VEL)); e.b.wake(); } n++; }
  }
  if (n) sonar('CB_Impact1', p, 0.6, 0.7);
}
// ---------------- la bomba de Rick Prime ----------------
function artOmegaElegir(o) {
  const s = ART.omega.get(o); if (s && s.cuenta) return;
  // los personajes que hay cerca primero (la gente y vos), después todos
  const hay = new Set([JUG.cuerpo && (JUG.skinRol || JUG.skinMod || PREFS.skin)]); for (const P of PERS) if (!P.rag && P.skin) hay.add(P.skinQuiere || P.skin);
  for (const R2 of RED.remotos.values()) hay.add(R2.skinReal || R2.skin);
  const L = [...hay].filter(Boolean).concat(DATA.chars.filter((x) => !hay.has(x)));
  let p = $('omegaPan');
  if (!p) {
    p = document.createElement('div'); p.id = 'omegaPan'; p.className = 'panel oc'; document.body.appendChild(p);
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-om]'); if (b) { const o2 = ART.elegida; artOmegaPanelCerrar(); if (o2 && OBJS.includes(o2)) artOmegaArmar(o2, b.dataset.om, true); } else if (e.target === p) artOmegaPanelCerrar(); });
  }
  ART.elegida = o;
  p.innerHTML = `<div class="caja omegaCaja"><h3>${esc(T('art.omegaTit'))}</h3><p>${esc(T('art.omegaAyuda'))}</p><div class="omegaLista">${L.map((s) => `<button data-om="${esc(s)}"${hay.has(s) ? ' class="cerca"' : ''}><img src="${icono(RETRATO[s] || s)}" alt=""><span>${esc(skinNom(s))}</span></button>`).join('')}</div></div>`;
  cerrarPaneles(); p.classList.remove('oc'); UI.abierto = 'omega'; soltarPuntero();
}
function artOmegaPanelCerrar() { const p = $('omegaPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'omega') UI.abierto = null; }
function artOmegaArmar(o, skin, local) {
  if (!DATA.chars.includes(skin)) return;
  ART.omega.set(o, { skin, cuenta: OMEGA_CUENTA, ult: 99 });
  aviso(T('art.omegaArmada') + ': ' + skinNom(skin), 2.5);
  if (local && RED.on && !o.remoto) publicar('a', { k: 'omega', o: claveObj(o), s: skin });
}
function artOmegaPaso(o, s, dt) {
  if (!s.cuenta) return;
  s.cuenta = Math.max(0, s.cuenta - dt);
  const seg = Math.ceil(s.cuenta); if (seg !== s.ult) { s.ult = seg; if (seg > 0) sonar('UI_blip', o.b.pos, 0.9, 1 + (OMEGA_CUENTA - seg) * 0.12); }
  // (la luz verde late cada vez más rápido)
  o.md.extra = { rim: [0.2, 2.4 * (0.5 + 0.5 * Math.sin(TIEMPO.t * (6 + (OMEGA_CUENTA - s.cuenta) * 4))), 0.4] };
  if (s.cuenta <= 0) artOmegaExplotar(o, s.skin);
}
// el destello: elimina a todos los de ese personaje (lo hace cada uno con lo suyo; en la sala avisa el que la tenía)
function artOmegaExplotar(o, skin) {
  const p = o.b.pos.clone(); ART.omega.delete(o);
  if (!o.remoto) { borrarObjeto(o, true); if (RED.on) publicar('a', { k: 'omegab', s: skin, p: [p.x, p.y, p.z] }); }
  artOmegaEfecto(p, skin);
}
function artOmegaEfecto(p, skin) {
  sonar('GrenadeExplode', p, 1, 0.55); ART.flash = 1; ART.flashP = p;
  let n = 0;
  for (const P of PERS.slice()) {
    if (P === JUG.cuerpo || P.remoto || P.rag || (P.skinQuiere || P.skin) !== skin) continue;
    if (typeof danarPersona === 'function') { danarPersona(P, 9999, P.pos.clone(), v3(0, 1, 0)); n++; }
  }
  const mio = JUG.skinRol || JUG.skinMod || PREFS.skin;
  if (mio === skin && JUG.vivo && (typeof SALA === 'undefined' || !SALA || SALA.pvp !== 0)) { danarJugador(9999, null); n++; }
  chatMostrar('RezoBox', T('art.omegaFin').replace('%s', skinNom(skin)));
}
function artRed(d) {
  if (d.k === 'catap') { const o = typeof d.o === 'string' ? buscarObjeto(d.o) : null; if (o && o.art === 'catapulta') artCatapultaTirar(o, false); }
  else if (d.k === 'omega') { const o = typeof d.o === 'string' ? buscarObjeto(d.o) : null; if (o && o.art === 'omega' && typeof d.s === 'string') artOmegaArmar(o, d.s, false); }
  else if (d.k === 'omegab' && typeof d.s === 'string' && DATA.chars.includes(d.s) && Array.isArray(d.p)) {
    const p = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0));
    for (const [o, s] of ART.omega) if (s.skin === d.s && o.b.pos.distTo(p) < 3) ART.omega.delete(o);
    artOmegaEfecto(p, d.s);
  }
}
// ---------------- cada cuadro ----------------
function artPaso(dt) {
  for (const o of OBJS) {
    if (!o.art) continue;
    if (o.art === 'catapulta') artCatapultaPaso(o, artCat(o), dt);
    else if (o.art === 'omega') { const s = ART.omega.get(o); if (s) artOmegaPaso(o, s, dt); }
  }
  for (const o of ART.cat.keys()) if (!OBJS.includes(o)) ART.cat.delete(o);
  for (const o of ART.omega.keys()) if (!OBJS.includes(o)) ART.omega.delete(o);
  // el destello verde de la bomba (más fuerte cerca)
  if (ART.flash > 0) {
    ART.flash = Math.max(0, ART.flash - dt * 0.7);
    let f = $('omegaFlash'); if (!f) { f = document.createElement('div'); f.id = 'omegaFlash'; document.body.appendChild(f); }
    const cerca = ART.flashP ? clamp(1 - ART.flashP.distTo(CAM.pos) / 120, 0.25, 1) : 1;
    f.style.opacity = (ART.flash * cerca).toFixed(3);
  }
}
function artDibujar() {
  const B = artBrazo(); if (!B) return;
  for (const o of OBJS) {
    if (o.art !== 'catapulta' || o.md.oculto) continue;
    const M = artBrazoMatriz(o, artCat(o), new Float32Array(16));
    for (let k = 0; k < B.mt.length; k++) encolar(B.m, k, B.mt[k], M, null, null);
  }
}
