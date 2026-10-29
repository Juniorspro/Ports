// ---------------- Cíclope (mod oficial): rayos de los ojos ----------------
// Con el mod sos Cíclope (modelo propio con los huesos del juego, los lentes rubí se dibujan aparte) y aparece un botón
// rojo (tecla H). Tocarlo tira un láser suave desde los ojos (empuja y lastima poco); mantenerlo 1 s lanza la
// definitiva, que se ve en toda la sala: una cinemática de 6 s (cae de rodillas, se levanta, se saca los lentes y
// grita) y 15 s de rayo que destruye todo lo que toca, con el cielo y el ambiente rojos. Si el rayo agarra a alguien,
// se queda pegado y lo hace volar: el que lo recibe pasa a primera persona con las manos arriba gritando "no, no, no",
// ve todo rojo y se come el golpe final.
const CIC_CARGA = 1, CIC_CINE = 6, CIC_FURIA = 15, CIC_PEGA = 3.2, CIC_ESPERA = 20, CIC_LARGO = 400;
const CIC = { boton: null, aro: null, apretado: false, carga: 0, tecla: false, espera: 0, tLaser: 0, ults: new Map(), rayos: [], vic: null,
  rojo: 0, rojoAnt: -1, ciego: 0, capaR: null, capaC: null, inmune: false, quieto: false, son: null };
// los ojos en el espacio del hueso de la cabeza (como lo usa la piel: el punto de la malla menos la articulación, que
// mira a +Z), medidos en la textura de la cara: [medio ancho entre ojos, alto, adelante (párpado), plano de los lentes,
// tamaño de la cabeza (los lentes se hacen a esa medida)]
const CIC_OJO = { Ciclope: [0.025, 0.0447, 0.141, 0.173, 1.11], def: [0.032, 0.03, 0.13, 0.16, 1] };
const cicOjoDe = (P) => CIC_OJO[P && P.skin] || CIC_OJO.def;
const cicHay = () => NAT.mods.has('ciclope') && JUEGO.estado === 'juego';
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const qVer = (de, a) => { const d = vsub(a, de).norm(); return Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1))); };

// ---------------- el botón (tocar: láser; mantener 1 s: definitiva) ----------------
function cicBoton() {
  let b = CIC.boton;
  if (!b) {
    b = CIC.boton = document.createElement('div'); b.id = 'cicBt'; b.className = 'cicBt';
    b.innerHTML = `<svg viewBox="0 0 64 64" class="cicAro"><circle cx="32" cy="32" r="29"/><circle class="cicCarga" cx="32" cy="32" r="29"/></svg>${icoHTML('ico:ciclope')}<small>(H)</small><b class="cicEsp"></b>`;
    CIC.aro = b.querySelector('.cicCarga');
    const ap = (e) => { e.preventDefault(); e.stopPropagation(); audioIniciar(); cicApretar(true); };
    const su = (e) => { e.preventDefault(); e.stopPropagation(); cicApretar(false); };
    b.addEventListener('pointerdown', ap); b.addEventListener('pointerup', su); b.addEventListener('pointercancel', su); b.addEventListener('pointerleave', (e) => { if (CIC.apretado) su(e); });
    $('hud').appendChild(b);
  }
  return b;
}
addEventListener('keydown', (e) => { if (e.code !== 'KeyH' || e.repeat || !cicHay() || UI.abierto || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; CIC.tecla = true; cicApretar(true); });
addEventListener('keyup', (e) => { if (e.code === 'KeyH' && CIC.tecla) { CIC.tecla = false; cicApretar(false); } });
function cicApretar(si) {
  if (si) { if (CIC.apretado || !cicHay()) return; CIC.apretado = true; CIC.carga = 0; CIC.t0Carga = performance.now(); CIC.usada = false; cicSonCarga(true); return; }
  if (!CIC.apretado) return;
  CIC.apretado = false; cicSonCarga(false);
  if (!CIC.usada && !cicMia()) cicLaser(); // (soltó antes del segundo: láser suave)
}
const cicMia = () => CIC.ults.get('yo') || null;

// ---------------- cada cuadro ----------------
function cicPaso(dt) {
  const hay = cicHay(), b = cicBoton();
  b.style.display = hay ? '' : 'none';
  if (hay && !CIC.ayudo) { CIC.ayudo = true; aviso(T('cic.ayuda'), 3.5); }
  if (!hay) { if (cicMia()) cicTerminar(cicMia()); CIC.apretado = false; CIC.ayudo = false; }
  CIC.espera = Math.max(0, CIC.espera - dt); CIC.tLaser -= dt;
  if (CIC.apretado) {
    CIC.carga = (performance.now() - CIC.t0Carga) / 1000; // (tiempo real: el botón no depende de la cámara lenta)
    if (CIC.carga >= CIC_CARGA && !CIC.usada) { CIC.usada = true; cicSonCarga(false); if (CIC.espera > 0) aviso(T('cic.espera') + ' ' + Math.ceil(CIC.espera) + ' s', 1.5); else cicDefinitiva(); }
  }
  const k = CIC.apretado && !CIC.usada ? clamp(CIC.carga / CIC_CARGA, 0, 1) : 0;
  CIC.aro.style.strokeDashoffset = String(182.2 * (1 - k));
  b.classList.toggle('carga', k > 0); b.classList.toggle('ya', !!cicMia());
  const esp = b.querySelector('.cicEsp'), te = CIC.espera > 0 ? String(Math.ceil(CIC.espera)) : ''; if (esp.textContent !== te) esp.textContent = te;
  if (CIC.son && CIC.son.c) CIC.son.c.frequency.setTargetAtTime(90 + 260 * k, AUD.ctx.currentTime, 0.05);
  // las definitivas (la mía y las de los demás)
  for (const U of [...CIC.ults.values()]) cicUltPaso(U, dt);
  CIC.inmune = !!cicMia(); CIC.quieto = !!cicMia() || !!CIC.vic;
  if (CIC.vic) cicVictimaPaso(dt);
  cicSonPaso();
  // los láseres suaves se apagan solos
  for (let i = CIC.rayos.length - 1; i >= 0; i--) { const r = CIC.rayos[i]; r.t += dt; if (r.t >= r.dur) CIC.rayos.splice(i, 1); }
  // el cielo y el ambiente rojos (para todos mientras alguien está en la definitiva)
  let meta = 0; for (const U of CIC.ults.values()) { const u = TIEMPO.t - U.t0; meta = Math.max(meta, ss(4.8, 6.2, u) * (1 - ss(CIC_CINE + CIC_FURIA - 0.4, CIC_CINE + CIC_FURIA + 1.2, u))); }
  CIC.rojo += (meta - CIC.rojo) * Math.min(1, dt * 2.5); if (CIC.rojo < 0.002 && meta === 0) CIC.rojo = 0;
  if (Math.abs(CIC.rojo - CIC.rojoAnt) > 0.004) { CIC.rojoAnt = CIC.rojo; DIA.aplicada = -1; }
  if (!CIC.vic) CIC.ciego = Math.max(0, CIC.ciego - dt * 0.9);
  cicCapas();
  document.body.classList.toggle('cicCine', CIC.camOn === 'cine' || !!CIC.vic);
}
// las capas de color de la pantalla: el tinte rojo de todo y el rojo del que recibe el rayo
function cicCapas() {
  if (!CIC.capaR) {
    CIC.capaR = document.createElement('div'); CIC.capaR.id = 'cicRojo'; CIC.capaC = document.createElement('div'); CIC.capaC.id = 'cicCiego';
    const h = $('hud'); h.parentNode.insertBefore(CIC.capaR, h); h.parentNode.insertBefore(CIC.capaC, h);
  }
  const jr = JUEGO.estado === 'juego', r = jr ? CIC.rojo * 0.5 : 0, c = jr ? CIC.ciego : 0;
  if (CIC.capaR._o !== r) { CIC.capaR._o = r; CIC.capaR.style.opacity = r.toFixed(3); CIC.capaR.style.display = r > 0.003 ? '' : 'none'; }
  if (CIC.capaC._o !== c) { CIC.capaC._o = c; CIC.capaC.style.opacity = c.toFixed(3); CIC.capaC.style.display = c > 0.003 ? '' : 'none'; }
}
// el cielo, el sol y la luz del ambiente hacia el rojo (lo llama diaAplicar)
function cicCielo() {
  const k = CIC.rojo; if (k <= 0) return;
  const C = R.cielo;
  if (C) { C.top = _mix3(C.top, [0.32, 0.015, 0.01], k); C.mid = _mix3(C.mid, [1.0, 0.16, 0.05], k); C.bot = _mix3(C.bot, [0.62, 0.07, 0.03], k); C.sol = _mix3(C.sol, [1.0, 0.22, 0.08], k); }
  R.solCol = _mix3(R.solCol, [1.25, 0.24, 0.1], k * 0.85);
  R.ambS = _mix3(R.ambS, [0.62, 0.12, 0.07], k * 0.8); R.ambG = _mix3(R.ambG, [0.34, 0.06, 0.035], k * 0.8);
  R.niebla.c = _mix3(R.niebla.c, [0.5, 0.08, 0.04], k * 0.75);
}

// ---------------- los ojos ----------------
// el marco de la cabeza: el del hueso con su escala (igual que la piel), así lo que se dibuja queda pegado a la cara
function cicMarco(W) { const c = wp(W), q = m4quat(W), s = m4esc(W); return { c, q, s, en: (x, y, z) => vadd(c, q.rot(v3(x * s, y * s, z * s))) }; }
function cicCabeza(P) {
  const i = P && P.D.h.Head; if (i === undefined || !P.md) return null;
  P.md.actualizar(); const H = cicMarco(P.md.W[i]), o = cicOjoDe(P);
  H.o = o; H.ojo = H.en(0, o[1], o[2]); H.fw = H.q.rot(v3(0, 0, 1)); return H;
}
// de dónde sale el rayo de un jugador (en primera persona, de la cámara)
function cicOrigen(P, local) {
  if (local && !JUG.tercera && !cicMia()) return vadd(vadd(CAM.pos, vscale(CAM.fwd, 0.7)), vscale(CAM.arr, -0.13)); // (en primera persona: de la cara, un poco abajo de la vista)
  const H = cicCabeza(P); return H ? vadd(H.ojo, vscale(H.fw, 0.03)) : vadd(P ? P.pos : JUG.pos, v3(0, 0.6, 0));
}
// adónde apunto: lo que hay en el centro de la pantalla
function cicMira() { const h = raycast(CAM.pos, CAM.fwd, CIC_LARGO, null); return h ? h.p : vadd(CAM.pos, vscale(CAM.fwd, CIC_LARGO)); }

// ---------------- láser suave ----------------
function cicLaser() {
  if (!cicHay() || CIC.tLaser > 0 || !JUG.vivo || JUG.vehiculo) return;
  CIC.tLaser = 0.28;
  const o = cicOrigen(JUG.cuerpo, true), d = vsub(cicMira(), o).norm(), h = raycast(o, d, 120, null), p = h ? h.p : vadd(o, vscale(d, 120));
  CIC.rayos.push({ o, p, t: 0, dur: 0.3 }); cicSonLaser(o);
  if (h) {
    efectoImpacto(p, h.n || vscale(d, -1), 'mundo'); luzTemporal(p, 5, [8, 0.6, 0.3], 0.25);
    const b = h.body;
    if (b && b.persona && b.persona !== JUG.cuerpo) danarPersona(b.persona, 14, p, d);
    else if (b && b.obj) { danarObjeto(b.obj, 18, p, d); if (b.dynamic && !b.frozen) { b.vel.addS(d, Math.min(9, 400 / b.mass)); b.wake(); } }
  }
  publicar('a', { k: 'cic', f: 'l', o: [r3(o.x), r3(o.y), r3(o.z)], p: [r3(p.x), r3(p.y), r3(p.z)] });
}

// ---------------- la definitiva ----------------
function cicDefinitiva() {
  if (cicMia() || !JUG.vivo) return;
  if (JUG.vehiculo) salirVehiculo();
  if (NAT.volando) natVolar(false); if (NAT.scp) natScp(false); if (NAT.rag) natRag(false);
  if (ARM.agarre) soltarAgarre(); if (ARM.grav) soltarGrav();
  if (JUG.cuerpo) JUG.cuerpo.emote = null;
  const U = cicUltNueva('yo', JUG.cuerpo, JUG.pos.clone(), JUG.yaw);
  U.terc = JUG.tercera; U.arma = ARM.lista[ARM.i]; JUG.tercera = true;
  const i = ARM.lista.indexOf('Hands'); if (i >= 0) elegirArma(i);
  publicar('a', { k: 'cic', f: 'u', p: [r3(U.pos.x), r3(U.pos.y), r3(U.pos.z)], y: r3(U.yaw) });
}
function cicUltNueva(id, P, pos, yaw) {
  const vieja = CIC.ults.get(id); if (vieja) cicTerminar(vieja, true);
  const f = v3(Math.sin(yaw), 0, Math.cos(yaw));
  const U = { id, P, pos, yaw, t0: TIEMPO.t, dir: vadd(vscale(f, 0.55), v3(0, 0.84, 0)).norm(), dirMeta: null, hit: null, hitMeta: null, tExp: 0, tRed: 0, vic: null, sinPegar: 0, ignora: null, ruido: null, encendido: false };
  CIC.ults.set(id, U); if (P) P.cic = U;
  return U;
}
function cicTerminar(U, callado) {
  if (CIC.ults.get(U.id) !== U) return;
  CIC.ults.delete(U.id); cicSonRayo(U, false);
  if (U.P) { U.P.cic = null; U.P.cicLentes = null; U.P.bajar = 0; }
  if (U.id === 'yo') {
    JUG.tercera = U.terc; CIC.espera = CIC_ESPERA;
    const i = ARM.lista.indexOf(U.arma); if (i >= 0) elegirArma(i);
    if (!callado) publicar('a', { k: 'cic', f: 'fin' });
  }
}
function cicUltPaso(U, dt) {
  const u = TIEMPO.t - U.t0;
  if (U.id !== 'yo') { const R2 = RED.remotos.get(U.id); if (!R2 || u > CIC_CINE + CIC_FURIA + 3) { cicTerminar(U, true); return; } if (U.P !== R2.P) { U.P = R2.P; U.P.cic = U; } }
  else if (JUG.cuerpo && U.P !== JUG.cuerpo) { U.P = JUG.cuerpo; U.P.cic = U; }
  if (u >= CIC_CINE + CIC_FURIA) { if (U.id === 'yo') cicTerminar(U); return; }
  // los lentes: en la cara, en la mano y al piso
  const P = U.P; if (P) P.cicLentes = u < 3.35 ? 'cara' : u < 4.75 ? 'mano' : 'piso';
  // el rayo: sale a los 5,4 s (para arriba, como en la película) y después va adonde apunta
  const fuego = u >= 5.4;
  if (fuego && !U.encendido) { U.encendido = true; const o = cicOrigen(P, false); sonar('GrenadeExplode', o, 1.6, 0.55); CAM.temblor = Math.max(CAM.temblor, U.id === 'yo' ? 0.9 : clamp(1.2 - o.distTo(CAM.pos) / 60, 0, 0.8)); luzTemporal(o, 40, [60, 6, 3], 1.2); cicSonRayo(U, true); }
  if (U.id === 'yo') {
    // quieto de rodillas; en la cinemática tampoco gira
    JUG.vel.x = 0; JUG.vel.z = 0; JUG.pos.x = U.pos.x; JUG.pos.z = U.pos.z; ENT.disparo = ENT.disparo2 = false;
    if (u < CIC_CINE) { JUG.yaw = U.yaw; JUG.pitch = -0.32; }
  }
  if (!fuego || !P) return;
  const o = cicOrigen(P, false);
  if (U.id === 'yo') {
    if (u >= CIC_CINE) {
      // adonde apunto, o al que tengo agarrado
      U.sinPegar -= dt;
      let meta = vsub(cicMira(), o).norm();
      const V = U.vic;
      if (V) { if (!V.P || !PERS.includes(V.P) || TIEMPO.t - V.t0 > CIC_PEGA) cicSoltar(U, true); else meta = vsub(cicPecho(V.P), o).norm(); }
      U.dirMeta = meta;
    }
    if (U.dirMeta) U.dir.lerpTo(U.dirMeta, Math.min(1, dt * (U.vic ? 9 : 7))).norm();
    const h = raycast(o, U.dir, CIC_LARGO, null); U.hit = h ? h.p : vadd(o, vscale(U.dir, CIC_LARGO));
    // si pasa cerca de alguien (a menos de 1,3 m y sin una pared en el medio), lo agarra
    if (!U.vic && U.sinPegar <= 0 && u >= CIC_CINE) {
      const lim = h ? h.t : CIC_LARGO; let mejor = null, md = 1.3;
      for (const Q of PERS) {
        if (Q === JUG.cuerpo || Q === U.ignora || Q === U.P || Q.vivo === false) continue;
        const c = cicPecho(Q), t = vdot(vsub(c, o), U.dir); if (t < 0.8 || t > lim + 1.2) continue;
        const dd = vsub(c, vadd(o, vscale(U.dir, t))).len(); if (dd < md) { md = dd; mejor = Q; }
      }
      if (mejor) cicPegar(U, mejor);
    }
    if (h) cicGolpe(U, h, dt, o);
    if ((U.tRed -= dt) <= 0) { U.tRed = 0.1; publicar('a', { k: 'cic', f: 'd', d: [r4(U.dir.x), r4(U.dir.y), r4(U.dir.z)], h: [r3(U.hit.x), r3(U.hit.y), r3(U.hit.z)] }); }
  } else {
    // el de otro: lo que manda (suavizado); hasta que llega, para arriba
    if (U.dirMeta) U.dir.lerpTo(U.dirMeta, Math.min(1, dt * 10)).norm();
    const fin = U.hitMeta || vadd(o, vscale(U.dir, CIC_LARGO));
    U.hit = U.hit ? U.hit.lerpTo(fin, Math.min(1, dt * 10)) : fin.clone();
    if (!U.hitMeta) { const h = raycast(o, U.dir, CIC_LARGO, null); if (h) U.hit = h.p; }
  }
  // lo que se ve en la punta: fuego, humo y chispas (en todos los juegos)
  if (U.hit && U.hit.distTo(o) < CIC_LARGO - 1) {
    const p = U.hit;
    for (let i = 0; i < 3; i++) particula(vadd(p, v3((Math.random() - 0.5) * 0.8, Math.random() * 0.4, (Math.random() - 0.5) * 0.8)), v3((Math.random() - 0.5) * 4, 2 + Math.random() * 5, (Math.random() - 0.5) * 4), 0.35 + Math.random() * 0.3, 0.5 + Math.random() * 0.5, [1, 0.28 + Math.random() * 0.25, 0.08, 1], 'fuego', 1.1);
    if (Math.random() < 0.35) particula(vadd(p, v3(0, 0.5, 0)), v3((Math.random() - 0.5) * 2, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 2), 1.8 + Math.random(), 1 + Math.random(), [0.2, 0.1, 0.09, 0.6], 'humo', 2.4);
    for (let i = 0; i < 2; i++) particula(p, v3((Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14), 0.4 + Math.random() * 0.4, 0.04, [1, 0.6, 0.3, 1], 'chispa', 0);
  }
}
// lo que toca el rayo: explota, vuela, se rompe; a una persona la agarra
function cicGolpe(U, h, dt, o) {
  const b = h.body, P = b && b.persona;
  if (P && P !== JUG.cuerpo && !U.vic && U.sinPegar <= 0 && P !== U.ignora) { cicPegar(U, P); return; }
  if (U.vic && P === U.vic.P) {
    // al agarrado: lo lleva volando
    if (P.rag) for (const [, e] of P.rag.cuerpos) { e.b.vel.lerpTo(vadd(vscale(U.dir, 17), v3(0, 4.5, 0)), Math.min(1, dt * 5)); e.b.wake(); }
    return;
  }
  if (b && b.dynamic && !b.frozen && !b.persona) { b.vel.addS(U.dir, Math.min(40, 3200 / b.mass) * dt * 4); b.vel.y += 9 * dt; b.ang.addS(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 8 * dt); b.wake(); }
  if (b && b.obj && Math.random() < dt * 4) danarObjeto(b.obj, 40, h.p, U.dir);
  if ((U.tExp -= dt) <= 0) { U.tExp = 0.3; explosion(vsub(h.p, vscale(U.dir, 0.4)), 3.6, 60); }
}
function cicPegar(U, P) {
  U.vic = { P, t0: TIEMPO.t, id: P.remoto || null };
  cicVictimaVista(P);
  if (P.remoto) publicar('a', { k: 'cic', f: 'v', to: P.remoto, o: (() => { const o = cicOrigen(U.P, false); return [r3(o.x), r3(o.y), r3(o.z)]; })(), d: [r4(U.dir.x), r4(U.dir.y), r4(U.dir.z)] });
  else { if (!P.rag) ragdoll(P, vadd(vscale(U.dir, 14), v3(0, 5, 0)), P.pos); danarPersona(P, 20, P.pos, U.dir); }
}
function cicSoltar(U, golpe) {
  const V = U.vic; U.vic = null; U.sinPegar = 0.5; U.ignora = V && V.P; setTimeout(() => { if (U.ignora === (V && V.P)) U.ignora = null; }, 1500);
  if (!golpe || !V || !V.P) return;
  const P = V.P, c = cicPecho(P);
  // el golpe final (al remoto se lo da su propio juego cuando termina lo suyo)
  if (!P.remoto) { explosion(c.clone(), 3, 120); danarPersona(P, 200, c, U.dir); }
}
// el pecho de alguien (de pie o tirado)
function cicPecho(P) {
  if (P.rag) { const e = P.rag.cuerpos.get(P.D.h.Spine1) || P.rag.cuerpos.get(P.D.h.Hips); if (e) return e.b.pos; }
  return vadd(P.pos, v3(0, 0.25, 0));
}
// a alguien lo agarra el rayo (lo ven todos): manos arriba y el grito
function cicVictimaVista(P) { P.cicVicT = TIEMPO.t; if (P !== JUG.cuerpo) sonar('CicNoNo', P.pos, 1.4); }

// ---------------- me agarró el rayo de otro ----------------
function cicSerVictima(d, U) {
  if (!JUG.vivo || CIC.vic) return;
  if (JUG.vehiculo) salirVehiculo();
  if (NAT.volando) natVolar(false); if (NAT.scp) natScp(false); if (NAT.rag) natRag(false);
  const o = Array.isArray(d.o) ? v3(num(d.o[0], -1e4, 1e4, 0), num(d.o[1], -1e4, 1e4, 0), num(d.o[2], -1e4, 1e4, 0)) : JUG.pos.clone();
  const dir = Array.isArray(d.d) ? v3(num(d.d[0], -1, 1, 0), num(d.d[1], -1, 1, 0), num(d.d[2], -1, 1, 1)).norm() : vsub(JUG.pos, o).norm();
  CIC.vic = { t0: TIEMPO.t, U, o, dir, terc: JUG.tercera, pvp: !SALA || SALA.pvp !== 0 && SALA.pvp !== false };
  JUG.tercera = false; if (JUG.cuerpo) { JUG.cuerpo.emote = null; JUG.cuerpo.cicManos = true; JUG.cuerpo.cicVicT = TIEMPO.t; }
  sonar('CicNoNo', null, 1.1);
}
function cicVictimaPaso(dt) {
  const V = CIC.vic, t = TIEMPO.t - V.t0, U = V.U && CIC.ults.get(V.U.id) === V.U ? V.U : null;
  if (U && U.P) { V.o = cicOrigen(U.P, false); if (U.dir) V.dir.lerpTo(U.dir, Math.min(1, dt * 6)).norm(); }
  if (!JUG.vivo) { cicVictimaFin(false); return; }
  // vuela para donde lo empuja el rayo, mirando al que se lo tira
  const meta = vadd(vscale(V.dir, 15), v3(0, 3.8, 0)); JUG.vel.lerpTo(meta, Math.min(1, dt * 4)); JUG.suelo = false;
  const d = vsub(V.o, JUG.ojoPos).norm(), yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(clamp(d.y, -1, 1));
  let dy = yaw - JUG.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; JUG.yaw += dy * Math.min(1, dt * 8); JUG.pitch += (pitch - JUG.pitch) * Math.min(1, dt * 8);
  CIC.ciego = Math.min(0.94, Math.max(CIC.ciego, ss(0, 1.3, t) * 0.94)); CAM.temblor = Math.max(CAM.temblor, 0.55);
  if (V.pvp) danarJugador(9 * dt, V.o);
  if (t >= CIC_PEGA || (V.U && !U)) cicVictimaFin(true);
}
function cicVictimaFin(golpe) {
  const V = CIC.vic; if (!V) return; CIC.vic = null;
  if (JUG.cuerpo) JUG.cuerpo.cicManos = false;
  if (golpe && JUG.vivo) {
    // el golpe final: todo rojo un momento, explota y sale volando
    efectoExplosion(JUG.pos.clone()); sonar('GrenadeExplode', null, 1.5, 0.8); CAM.temblor = 1.4; CIC.ciego = 1;
    JUG.vel.addS(V.dir, 26).y += 9;
    if (V.pvp) danarJugador(95, V.o);
  }
  if (JUG.vivo) JUG.tercera = V.terc;
}

// ---------------- la pose: de rodillas, sacarse los lentes, el grito, la cabeza siguiendo al rayo; manos arriba ----------------
function cicPose(P, dt) {
  const U = P.cic;
  if (U) cicPoseDef(P, TIEMPO.t - U.t0, U);
  const tv = P.cicVicT !== undefined ? TIEMPO.t - P.cicVicT : 1e9;
  if (tv < CIC_PEGA + 0.3 || P.cicManos) cicPoseManos(P, tv);
}
function cicPoseDef(P, u, U) {
  const md = P.md, h = P.D.h; if (h.Hips === undefined || h.LeftUpLeg === undefined) return;
  const fin = CIC_CINE + CIC_FURIA, up = v3(0, 1, 0), qy = Quat.axis(0, 1, 0, P.yaw), fw = qy.rot(v3(0, 0, 1)), izq = qy.rot(v3(1, 0, 0)), lado = vcross(up, fw).norm();
  // pesos de cada parte a lo largo del tiempo
  const wK = ss(0.05, 0.9, u) * (1 - ss(fin - 0.1, fin + 0.6, u));            // de rodillas
  const wB = ss(0.25, 1.1, u) * (1 - ss(1.75, 2.7, u));                        // agachado con las manos en el piso
  const wM = ss(2.55, 3.2, u) * (1 - ss(4.3, 4.9, u));                         // la mano derecha a la cara
  const wF = ss(3.35, 4.25, u);                                                 // (y se la lleva con los lentes)
  const wS = ss(4.6, 5.3, u) * (1 - ss(fin - 0.1, fin + 0.6, u));             // brazos abajo y abiertos, puños
  const wCab = ss(1.7, 2.2, u) * (1 - ss(2.8, 3.4, u));                         // cabeza gacha
  const wGrito = ss(4.7, 5.3, u) * (1 - ss(5.9, 6.6, u));                       // cabeza para atrás
  const wApunta = ss(5.5, 6.6, u) * (1 - ss(fin - 0.1, fin + 0.6, u));        // la cabeza sigue al rayo
  // bajar la cadera hasta que las rodillas toquen el piso
  P.bajar = 0; ubicarPersona(P); md.actualizar();
  const W = md.W, piso = P.pos.y - 1, iUL = h.LeftUpLeg, iLL = h.LeftLeg, iRU = h.RightUpLeg, iRL = h.RightLeg;
  const a = wp(W[iUL]).distTo(wp(W[iLL])), b = wp(W[iLL]).distTo(wp(W[h.LeftFoot])), alfrente = 0.12;
  const yCad = piso + 0.07 + Math.sqrt(Math.max(0.01, a * a - alfrente * alfrente));
  const B = (Math.min(W[iUL][13], W[iRU][13]) - yCad) * wK;
  P.bajar = B; ubicarPersona(P); P.bajar = B; md.actualizar();
  // en cuatro patas la cadera se inclina adelante (después las piernas se acomodan solas con la rodilla en el piso)
  if (wB > 0.01) { girarMundo(P, 'Hips', lado, 0.6 * wB); md.actualizar(); }
  // piernas: rodilla en el piso (un poco adelante de la cadera), pie atrás en puntas
  if (wK > 0.01) for (const [iU, iK, iA] of [[iUL, iLL, h.LeftFoot], [iRU, iRL, h.RightFoot]]) {
    if (iA === undefined) continue;
    const H = wp(md.W[iU]), Kp = v3(H.x + fw.x * alfrente, piso + 0.07, H.z + fw.z * alfrente), sb = 0.2;
    const Aj = vadd(Kp, vadd(vscale(fw, -b * Math.cos(sb)), v3(0, b * Math.sin(sb), 0))), A0 = wp(md.W[iA]);
    const T = vadd(vscale(A0, 1 - wK), vscale(Aj, wK)), qFin = qy.clone().mul(Quat.axis(1, 0, 0, 2.0 * wK)).mul(P.D.rw[iA]);
    ik2(P, iU, iK, iA, T, fw, qFin); md.sucio = true; md.actualizar();
  }
  // el torso: agachado (manos al piso), derecho, y en el grito un poco hacia atrás
  const dobla = 0.75 * wB - 0.24 * wGrito;
  if (Math.abs(dobla) > 0.001) { girarMundo(P, 'Spine', lado, dobla * 0.4); girarMundo(P, 'Spine1', lado, dobla * 0.35); girarMundo(P, 'Spine2', lado, dobla * 0.25); }
  // la cara al frente (sin el "mirar alrededor" de la animación de parado): sobre eso se baja o se tira atrás
  const wCara = ss(0.3, 0.9, u) * (1 - ss(5.5, 6.2, u));
  if (wCara > 0.01) {
    const Hd = cicCabeza(P);
    if (Hd) {
      const ax = vcross(Hd.fw, fw), sn = ax.len(), ang = Math.atan2(sn, vdot(Hd.fw, fw)) * wCara;
      if (sn > 1e-5) { ax.scale(1 / sn); girarMundo(P, 'Neck', ax, ang * 0.4); girarMundo(P, 'Head', ax, ang * 0.6); }
    }
  }
  const cab = 0.55 * wCab + 0.3 * wB - 1.05 * wGrito;
  if (Math.abs(cab) > 0.001) { girarMundo(P, 'Neck', lado, cab * 0.4); girarMundo(P, 'Head', lado, cab * 0.6); }
  // la cabeza mira para donde va el rayo
  if (wApunta > 0.01 && U.dir) {
    const Hd = cicCabeza(P);
    if (Hd) {
      const dd = vadd(vscale(Hd.fw, 1 - wApunta), vscale(U.dir, wApunta)).norm(), ax = vcross(Hd.fw, dd), s = ax.len(), ang = Math.atan2(s, vdot(Hd.fw, dd));
      if (s > 1e-5) { ax.scale(1 / s); const ang2 = Math.min(ang, 1.6); girarMundo(P, 'Spine1', ax, ang2 * 0.2); girarMundo(P, 'Spine2', ax, ang2 * 0.2); girarMundo(P, 'Neck', ax, ang2 * 0.25); girarMundo(P, 'Head', ax, ang2 * 0.35); }
    }
  }
  md.actualizar();
  // brazos
  const brazo = (s, nA, nF, nH) => {
    const iA = h[nA], iF = h[nF], iH = h[nH]; if (iA === undefined || iF === undefined || iH === undefined) return;
    const lat = vscale(izq, s);
    if (wB > 0.01) {
      // manos apoyadas en el piso, adelante de las rodillas
      const S = wp(md.W[iA]), T = v3(S.x + fw.x * 0.2 + lat.x * 0.07, piso + 0.04, S.z + fw.z * 0.2 + lat.z * 0.07), H0 = wp(md.W[iH]);
      ik2(P, iA, iF, iH, vadd(vscale(H0, 1 - wB), vscale(T, wB)), vadd(vscale(fw, -0.4), vadd(lat, vscale(up, 0.3))), null); md.sucio = true; md.actualizar();
    }
    if (wS > 0.01) {
      // abajo y abiertos, un poco atrás, el codo apenas doblado (como en la foto)
      huesoApuntar(P, nA, nF, vadd(vadd(vscale(up, -0.8), vscale(lat, 0.52)), vscale(fw, -0.14)).norm(), wS * 0.9);
      huesoApuntar(P, nF, nH, vadd(vadd(vscale(up, -0.86), vscale(lat, 0.3)), vscale(fw, 0.12)).norm(), wS * 0.85);
    }
  };
  brazo(1, 'LeftArm', 'LeftForeArm', 'LeftHand');
  brazo(-1, 'RightArm', 'RightForeArm', 'RightHand');
  // la mano derecha: a la cara (agarra los lentes) y se los lleva para el costado
  if (wM > 0.01 && h.RightArm !== undefined && h.RightForeArm !== undefined && h.RightHand !== undefined) {
    const Hd = cicCabeza(P);
    if (Hd) {
      const cara = vadd(vadd(Hd.ojo, vscale(Hd.fw, 0.07)), vscale(izq, -0.05)), afuera = vadd(vadd(wp(md.W[h.RightArm]), vscale(izq, -0.45)), vadd(vscale(fw, 0.06), v3(0, -0.18, 0)));
      const T = vadd(vscale(cara, 1 - wF), vscale(afuera, wF)), H0 = wp(md.W[h.RightHand]);
      ik2(P, h.RightArm, h.RightForeArm, h.RightHand, vadd(vscale(H0, 1 - wM), vscale(T, wM)), vadd(vscale(up, -0.7), vadd(vscale(izq, -0.6), vscale(fw, 0.1))), null);
    }
  }
  md.sucio = true;
}
// las manos delante de la cara, abiertas hacia el rayo, temblando (codos abajo y afuera); la cabeza un poco para atrás
function cicPoseManos(P, t) {
  const w = P.cicManos ? 1 : ss(0, 0.25, t) * (1 - ss(CIC_PEGA - 0.1, CIC_PEGA + 0.3, t)); if (w < 0.01) return;
  const h = P.D.h, md = P.md, qy = Quat.axis(0, 1, 0, P.yaw), fw = qy.rot(v3(0, 0, 1)), izq = qy.rot(v3(1, 0, 0)), up = v3(0, 1, 0), tt = TIEMPO.t;
  if (!P.cicManos) girarMundo(P, 'Head', vcross(up, fw).norm(), -0.22 * w);
  const H = cicCabeza(P); if (!H) return;
  for (const [s, nA, nF, nH] of [[1, 'LeftArm', 'LeftForeArm', 'LeftHand'], [-1, 'RightArm', 'RightForeArm', 'RightHand']]) {
    const iA = h[nA], iF = h[nF], iH = h[nH]; if (iA === undefined || iF === undefined || iH === undefined) continue;
    const lat = vscale(izq, s), sac = 0.025 * Math.sin(tt * 29 + s * 1.7), k = H.s;
    const T = vadd(H.ojo, vadd(vscale(fw, (0.31 + sac) * k), vadd(vscale(lat, 0.13 * k), vscale(up, (-0.03 + sac) * k))));
    md.actualizar(); const H0 = wp(md.W[iH]);
    // la palma hacia el rayo y los dedos para arriba (en pose T la palma mira abajo y los dedos al costado)
    const R0 = s > 0 ? qBase(v3(0, 1, 0), v3(0, 0, -1), v3(-1, 0, 0)) : qBase(v3(0, -1, 0), v3(0, 0, -1), v3(1, 0, 0));
    ik2(P, iA, iF, iH, vadd(vscale(H0, 1 - w), vscale(T, w)), vadd(vscale(up, -0.8), vadd(vscale(lat, 0.55), vscale(fw, -0.15))), null); md.sucio = true; md.actualizar();
    // (mezclada con la de la pose: la muñeca entera girada deforma algunas mallas)
    const qh = m4quat(md.W[iH]), qb = qh.clone().slerpTo(qy.clone().mul(R0).mul(P.D.rw[iH]), (P.skin === 'Ciclope' ? 0.3 : 0.7) * w), ql = m4quat(md.W[iF]).conj().mul(qb).norm(), r = md.r[iH];
    r[0] = ql.x; r[1] = ql.y; r[2] = ql.z; r[3] = ql.w; md.sucio = true;
  }
}

// ---------------- lo que se dibuja: lentes, ojos, rayos y luces ----------------
let CIC_MAT = null;
function cicMats() {
  if (CIC_MAT) return CIC_MAT;
  const aditivo = (k, c) => { const id = matPropio(k, c, { pbr: [0.5, 0, 0.04] }), m = R.mats[id]; m.blend = true; m.add = true; m.unlit = true; m.sombra = false; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; return id; };
  return (CIC_MAT = { marco: matPropio('cicMarco', [0.06, 0.06, 0.07], { pbr: [0.3, 0.8, 0.05] }), lente: matPropio('cicLente', [0.45, 0.02, 0.03], { pbr: [0.08, 0.2, 0.06] }),
    nucleo: matPropio('cicNucleo', [1, 0.86, 0.82], { pbr: [0.5, 0, 0.04] }), haz: aditivo('cicHaz', [1, 0.14, 0.08]) });
}
function cicDibujar() {
  const M = cicMats();
  if (JUG.cuerpo) JUG.cuerpo.cicPosDib = JUG.cuerpo.pos.clone(); // (dónde estaba el cuerpo con estos huesos)
  for (const P of PERS) {
    if (P.skin !== 'Ciclope' || P.rag || P.cDib !== PERS_N || P.cicManos) continue;
    const H = cicCabeza(P); if (!H) continue;
    const U = P.cic, u = U ? TIEMPO.t - U.t0 : -1, st = P.cicLentes || 'cara';
    const carga = P === JUG.cuerpo && CIC.apretado && !CIC.usada ? clamp(CIC.carga / CIC_CARGA, 0, 1) : 0, laser = P === JUG.cuerpo ? clamp(CIC.tLaser / 0.28, 0, 1) : 0;
    if (st === 'cara') cicLentes(H, M, 0.35 + 2.5 * carga + 3 * laser);
    else if (st === 'mano') {
      // agarrados del puente, pasando la muñeca hacia los dedos, mirando al frente; al principio salen de la cara
      const iH = P.D.h.RightHand, iF = P.D.h.RightForeArm;
      if (iH !== undefined && iF !== undefined) {
        const cm = wp(P.md.W[iH]), dm = vsub(cm, wp(P.md.W[iF])).norm(), k = ss(3.35, 3.7, u);
        const pm = vadd(cm, vscale(dm, 0.05 * H.s)), qm = Quat.axis(0, 1, 0, P.yaw).mul(Quat.axis(1, 0, 0, 0.35));
        const pc = H.en(0, H.o[1], H.o[3]), pp = vadd(vscale(pc, 1 - k), vscale(pm, k)), qq = H.q.clone().slerpTo(qm, k);
        cicLentes({ q: qq, s: H.s, en: (x, y, z) => vadd(pp, qq.rot(v3(x * H.s, y * H.s, z * H.s))), o: null }, M, 0.3);
      }
    } else if (st === 'piso') {
      if (!P.cicPiso) { const iH = P.D.h.RightHand, p0 = iH !== undefined ? wp(P.md.W[iH]) : H.c; P.cicPiso = { p: p0, v: vadd(vscale(Quat.axis(0, 1, 0, P.yaw).rot(v3(-1, 0, 0)), 0.8), v3(0, 1.2, 0)), q: H.q.clone(), quieto: false }; }
      const L = P.cicPiso;
      if (!L.quieto) { L.v.y -= 9.8 * TIEMPO.dt; const s = vscale(L.v, TIEMPO.dt), hh = raycast(L.p, s.clone().norm(), s.len() + 0.02, null); if (hh && L.v.y < 0) { L.p = vadd(hh.p, v3(0, 0.012, 0)); L.quieto = true; L.q = Quat.axis(0, 1, 0, P.yaw + 0.6).mul(Quat.axis(1, 0, 0, -Math.PI / 2)); } else { L.p.add(s); L.q.mul(Quat.axis(1, 0.3, 0, TIEMPO.dt * 9)).norm(); } }
      cicLentes({ q: L.q, s: H.s, en: (x, y, z) => vadd(L.p, L.q.rot(v3(x * H.s, y * H.s, z * H.s))), o: null }, M, 0.25);
    }
    if (st !== 'piso') P.cicPiso = null;
    // ojos que brillan: sin lentes (desde que se los saca) y al cargar
    const brillo = Math.max(u >= 3.6 ? ss(3.6, 4.6, u) : 0, carga * 0.6);
    if (brillo > 0.01) {
      for (const s of [1, -1]) dibujarCaja(H.en(s * H.o[0], H.o[1] - 0.001, H.o[2] + 0.003), [0.021 * H.s, 0.008 * H.s, 0.005 * H.s], H.q, M.nucleo, { c: [1, 0.4, 0.35, 1], em: [3.6 * brillo, 0.35 * brillo, 0.22 * brillo] });
    }
  }
  // la definitiva: el rayo grueso
  for (const U of CIC.ults.values()) {
    const u = TIEMPO.t - U.t0; if (u < 5.4 || !U.P || !U.hit) continue;
    const o = cicOrigen(U.P, false), k = ss(5.4, 5.75, u) * (1 - ss(CIC_CINE + CIC_FURIA - 0.4, CIC_CINE + CIC_FURIA, u));
    if (k > 0.01) cicHazDibujar(o, U.hit, (0.42 + 0.06 * Math.sin(TIEMPO.t * 37)) * k, k, M);
  }
  // los láseres suaves
  for (const r of CIC.rayos) { const k = 1 - r.t / r.dur; cicHazDibujar(r.o, r.p, 0.06 * k + 0.02, k * 0.8, M); }
}
// unos lentes rubí: la barra de los vidrios, el marco arriba, el puente y las patillas hasta las orejas, por fuera de la
// cabeza (a la altura de los ojos mide hasta ±8 cm en las orejas). F: el marco donde van (en la cara, la mano o el piso)
function cicLentes(F, M, brillo) {
  const o = F.o || CIC_OJO.Ciclope, t = o[4] || 1, y = o[1] + 0.001 * t, z = o[3], k = F.s * t, w = F.en, q = F.q;
  dibujarCaja(w(0, y, z), [0.15 * k, 0.03 * k, 0.009 * k], q, M.lente, { em: [1.4 * brillo, 0.08 * brillo, 0.06 * brillo] });
  dibujarCaja(w(0, y + 0.018 * t, z - 0.001 * t), [0.156 * k, 0.007 * k, 0.013 * k], q, M.marco);
  dibujarCaja(w(0, y - 0.006 * t, z + 0.006 * t), [0.014 * k, 0.016 * k, 0.005 * k], q, M.marco);
  if (F.o) for (const s of [1, -1]) dibujarCaja(w(s * 0.083 * t, y + 0.012 * t, z - 0.066 * t), [0.006 * k, 0.008 * k, 0.128 * k], q, M.marco); // (en la mano o en el piso, plegadas)
}
// un haz: el centro blanco y capas rojas que suman luz, giradas alrededor del eje (parece redondo)
function cicHazDibujar(a, b, grosor, k, M) {
  const dc = Math.min(b.distTo(CAM.pos), a.distTo(CAM.pos) + 99), cortar = dc < 2.2 ? 2.2 - dc : 0;
  if (cortar > 0) b = vadd(a, vscale(vsub(b, a), Math.max(0, 1 - cortar / Math.max(0.01, b.distTo(a)))));
  const d = vsub(b, a), L = d.len(); if (L < 0.05) return;
  const dn = vscale(d, 1 / L), c = vadd(a, vscale(d, 0.5)), q = qMirar(dn);
  dibujarCaja(c, [grosor * 0.28, grosor * 0.28, L], q, M.nucleo, { em: [9 * k, 3 * k, 2.6 * k] });
  for (let i = 0; i < 3; i++) {
    const qi = q.clone().mul(Quat.axis(0, 0, 1, i * Math.PI / 3 + TIEMPO.t * 2));
    dibujarCaja(c, [grosor * 0.75, grosor * 0.75, L], qi, M.haz, { c: [1, 0.16, 0.08, 0.32 * k] });
    dibujarCaja(c, [grosor * 1.9, grosor * 1.9, L], qi, M.haz, { c: [1, 0.07, 0.04, 0.09 * k] });
  }
}
// luces rojas: en los ojos y en la punta del rayo (lo llama lucesJuntar)
function cicLuces() {
  for (const U of CIC.ults.values()) {
    const u = TIEMPO.t - U.t0; if (!U.P) continue;
    // la luz de los ojos va adelante de la cara (pegada a los ojos encendía el pelo de rojo: parecían ojos arriba de la
    // cabeza); con el rayo, sobre el rayo, a 1,5 m
    if (u >= 3.6 && u < 5.4) { const H = cicCabeza(U.P); if (H) luzPuntual(vadd(H.ojo, vscale(H.fw, 0.5)), 1.4, [1.2, 0.08, 0.05]); }
    if (u >= 5.4 && U.dir) luzPuntual(vadd(cicOrigen(U.P, false), vscale(U.dir, 1.5)), 14, [26, 2.6, 1.4]);
    if (u >= 5.4 && U.hit) { const k = clamp(U.hit.distTo(CAM.pos) / 9, 0.06, 1); luzPuntual(vadd(U.hit, v3(0, 1, 0)), 18, [40 * k, 5 * k, 2 * k]); } // (más suave si pega al lado de la cámara: al que agarró)
  }
  for (const r of CIC.rayos) luzPuntual(r.p, 5, [6 * (1 - r.t / r.dur), 0.5, 0.3]);
}

// ---------------- la cámara: la cinemática (todos), la de la definitiva (el que la tira) ----------------
function cicCamara(out) {
  CIC.camOn = false;
  // al que agarró el rayo: sus ojos (la cámara delante de la cara, así la cabeza queda atrás y se ven sus manos)
  if (CIC.vic) {
    // (los huesos son del cuadro anterior y vuela rápido: el ojo respecto del cuerpo, más donde está el cuerpo ahora)
    const P = JUG.cuerpo, H = P && P.cicPosDib ? cicCabeza(P) : null;
    if (H) { out.pos.copy(vadd(vsub(H.en(0, H.o[1], H.o[2] + 0.075), P.cicPosDib), P.pos)); out.q.copy(Quat.euler(JUG.yaw, JUG.pitch)); CIC.camOn = true; return true; }
    return false;
  }
  // la cinemática más reciente
  let U = null; for (const x of CIC.ults.values()) { const u = TIEMPO.t - x.t0; if (u < CIC_CINE && (!U || x.t0 > U.t0)) U = x; }
  if (U && U.P) {
    const u = TIEMPO.t - U.t0, P = U.P, qy = Quat.axis(0, 1, 0, U.id === 'yo' ? U.yaw : P.yaw), f = qy.rot(v3(0, 0, 1)), izq = qy.rot(v3(1, 0, 0)), up = v3(0, 1, 0);
    const Hd = cicCabeza(P), Hc = Hd ? Hd.c : vadd(P.pos, v3(0, 0.5, 0)), B = P.pos;
    let c, m;
    if (u < 1.75) { const k = ss(0, 1.75, u); c = vadd(B, vadd(vscale(f, 2.4 - 0.5 * k), vadd(vscale(izq, 1.45 - 0.35 * k), vscale(up, -0.3 - 0.15 * k)))); m = vadd(B, vscale(up, -0.45)); }
    else if (u < 3.35) { const k = ss(1.75, 3.35, u); c = vadd(Hc, vadd(vscale(izq, 1.35 - 0.2 * k), vadd(vscale(f, 0.3), vscale(up, 0.02)))); m = vadd(Hc, vadd(vscale(f, 0.12), vscale(up, -0.1))); }
    else if (u < 4.65) { const k = ss(3.35, 4.65, u); c = vadd(Hc, vadd(vscale(f, 0.85 - 0.15 * k), vadd(vscale(up, 0.05), vscale(izq, 0.08)))); m = vadd(Hc, vscale(up, 0.03)); }
    else { const k = ss(4.65, 6, u); c = vadd(B, vadd(vscale(f, 3.3 + 1.9 * k), vadd(vscale(izq, 0.45), vscale(up, -0.5 + 0.3 * k)))); m = vadd(Hc, vscale(up, 0.3 + 0.7 * k)); }
    // que no quede atrás de una pared
    const dv = vsub(c, Hc), L = dv.len(), hh = L > 0.01 ? mundoRayo(Hc, vscale(dv, 1 / L), L + 0.2) : null;
    if (hh) c = vadd(Hc, vscale(dv, Math.max(0.25, hh.t - 0.2) / L));
    out.pos.copy(c); out.q.copy(qVer(c, m)); CIC.camOn = 'cine'; return true;
  }
  // la mía: sobre el hombro, apuntando con la mira
  const Y = cicMia();
  if (Y && Y.P && TIEMPO.t - Y.t0 >= CIC_CINE) {
    const q = Quat.euler(JUG.yaw, JUG.pitch), fw = q.rot(v3(0, 0, 1)), der = q.rot(v3(-1, 0, 0)), Hd = cicCabeza(Y.P), piv = Hd ? vadd(Hd.c, v3(0, 0.25, 0)) : vadd(JUG.pos, v3(0, 0.2, 0));
    const atras = vadd(vadd(vscale(fw, -3.6), vscale(der, 1.0)), v3(0, 0.45, 0)), L = atras.len(), hh = mundoRayo(piv, vscale(atras, 1 / L), L + 0.3);
    out.pos.copy(vadd(piv, vscale(atras, hh ? Math.max(0.3, hh.t - 0.3) / L : 1))); out.q.copy(q); CIC.camOn = true; return true;
  }
  return false;
}

// ---------------- la red ----------------
function cicRed(d) {
  const R2 = RED.remotos.get(d.i);
  if (d.f === 'u' && R2 && Array.isArray(d.p)) cicUltNueva(d.i, R2.P, v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)), num(d.y, -1e3, 1e3, 0));
  else if (d.f === 'd') {
    const U = CIC.ults.get(d.i); if (!U || !Array.isArray(d.d) || !Array.isArray(d.h)) return;
    U.dirMeta = v3(num(d.d[0], -1, 1, 0), num(d.d[1], -1, 1, 0), num(d.d[2], -1, 1, 1)).norm(); U.hitMeta = v3(num(d.h[0], -1e5, 1e5, 0), num(d.h[1], -1e5, 1e5, 0), num(d.h[2], -1e5, 1e5, 0));
  } else if (d.f === 'v') {
    const U = CIC.ults.get(d.i);
    if (d.to === RED.ID) cicSerVictima(d, U);
    else { const V = RED.remotos.get(d.to); if (V) cicVictimaVista(V.P); }
  } else if (d.f === 'l' && Array.isArray(d.o) && Array.isArray(d.p)) {
    const o = v3(num(d.o[0], -1e5, 1e5, 0), num(d.o[1], -1e5, 1e5, 0), num(d.o[2], -1e5, 1e5, 0)), p = v3(num(d.p[0], -1e5, 1e5, 0), num(d.p[1], -1e5, 1e5, 0), num(d.p[2], -1e5, 1e5, 0));
    if (o.distTo(p) > 200) return;
    CIC.rayos.push({ o, p, t: 0, dur: 0.3 }); cicSonLaser(o); efectoImpacto(p, vsub(o, p).norm(), 'mundo');
  } else if (d.f === 'fin') { const U = CIC.ults.get(d.i); if (U) cicTerminar(U, true); }
}
function cicFin() { for (const U of [...CIC.ults.values()]) cicTerminar(U, true); if (CIC.vic) cicVictimaFin(false); CIC.rayos.length = 0; CIC.apretado = false; cicSonCarga(false); CIC.rojo = 0; CIC.ciego = 0; DIA.aplicada = -1; }

// ---------------- sonidos hechos acá (sin archivos): el láser, la carga y el rayo ----------------
function cicSonLaser(pos) {
  if (!AUD.ctx || !PREFS.vol) return;
  const c = AUD.ctx, t = c.currentTime, F = fuente3D(pos, 0.5), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.24);
  o2.type = 'square'; o2.frequency.setValueAtTime(1520, t); o2.frequency.exponentialRampToValueAtTime(230, t + 0.24);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g); o2.connect(g); g.connect(F.g); o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
}
function cicSonCarga(si) {
  if (CIC.son) { const S = CIC.son; CIC.son = null; try { S.g.gain.setTargetAtTime(0, AUD.ctx.currentTime, 0.04); S.c.stop(AUD.ctx.currentTime + 0.2); } catch (e) {} }
  if (!si || !AUD.ctx || !PREFS.vol) return;
  const c = AUD.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 90; g.gain.value = 0;
  g.gain.setTargetAtTime(0.12, c.currentTime, 0.15); o.connect(g); g.connect(AUD.master); o.start(); CIC.son = { c: o, g };
}
// el rayo: un rugido grave (ruido filtrado + dos sierras que tiemblan) que sale de los ojos
function cicSonRayo(U, si) {
  if (U.ruido) { const S = U.ruido; U.ruido = null; try { S.g.gain.setTargetAtTime(0, AUD.ctx.currentTime, 0.2); for (const n of S.n) n.stop(AUD.ctx.currentTime + 1); } catch (e) {} }
  if (!si || !AUD.ctx || !PREFS.vol) return;
  const c = AUD.ctx, F = fuente3D(cicOrigen(U.P, false), 0), g = F.g, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), dd = b.getChannelData(0);
  for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
  const ru = c.createBufferSource(); ru.buffer = b; ru.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
  const s1 = c.createOscillator(), s2 = c.createOscillator(), tr = c.createOscillator(), trG = c.createGain(), mix = c.createGain();
  s1.type = 'sawtooth'; s1.frequency.value = 52; s2.type = 'sawtooth'; s2.frequency.value = 78.5; tr.frequency.value = 13; trG.gain.value = 0.25; mix.gain.value = 0.75;
  tr.connect(trG); trG.connect(mix.gain); ru.connect(lp); lp.connect(mix); s1.connect(mix); s2.connect(mix); mix.connect(g);
  g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(1.4, c.currentTime + 0.25);
  for (const x of [ru, s1, s2, tr]) x.start();
  U.ruido = { g, p: F.p, n: [ru, s1, s2, tr] };
}
// (el rugido sigue a los ojos)
function cicSonPaso() { for (const U of CIC.ults.values()) if (U.ruido && U.P) ponerPos(U.ruido.p, cicOrigen(U.P, false)); }
