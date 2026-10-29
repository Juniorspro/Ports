// ---------------------------------------------------------------------------------------------------------
// armas y herramientas en la mano: barra de armas (como el juego: RPG, Pistol, Camera, Hands, ToolBaton,
// PhysicsGun) y las que se agregan desde el menú. Disparo con rayo, cohetes, flechas, golpes, pistola física
// (agarrar, mover, girar, congelar), pistola de gravedad (atraer y lanzar), cámara de fotos y Tool Gun.
// ---------------------------------------------------------------------------------------------------------
const DEF_ARMAS = {
  Pistol: { nodo: 'Pistol', ic: 'W_Pistol', fuego: 'pistolfire', sacar: 'pistolready', recarga: 'pistolreload', sF: 'pistol2Fire_1', sS: 'PistolReady2', sR: 'pistolreload', car: 12, cad: 0.18, dan: 25, tipo: 'bala', semi: true, prop: 'Pistol' },
  Revolver: { nodo: 'Revolver', ic: 'W_Revolver', fuego: 'revolverFire', sacar: 'revolverReady', recarga: 'revolvertoreload', sF: 'revolverfire2', sS: 'revolverready', sR: 'pistolreload', car: 6, cad: 0.45, dan: 55, tipo: 'bala', semi: true, prop: 'Revolver' },
  Smg: { nodo: 'Smg', ic: 'W_Smg', fuego: 'smgfire', sacar: 'smgready', recarga: 'smgreload', sF: 'smgfire', sS: 'smgready', sR: 'smgreload', car: 30, cad: 0.075, dan: 14, tipo: 'bala', disp: 0.025, prop: 'Smg' },
  Akm: { nodo: 'Akm', ic: 'W_Akm', fuego: 'AKmFire', sacar: 'AKmReady', recarga: 'AKmReloadclip', sF: 'AkFire3', sS: 'Akready', sR: 'Akreloadcliponly', car: 30, cad: 0.1, dan: 24, tipo: 'bala', disp: 0.018, prop: 'Akm' },
  Sniper: { nodo: 'Sniper', ic: 'W_Sniper', fuego: 'sniperFire', sacar: 'sniperready', recarga: 'sniperreload', sF: 'sniperfire2', sS: 'genericReady', sR: 'sniperreload', car: 5, cad: 1.1, dan: 100, tipo: 'bala', semi: true, mira: true, prop: 'Sniper' },
  Shotgun: { nodo: 'Shotgun', ic: 'W_Shotgun', fuego: 'shotgunFire', sacar: 'shotgunReady', recarga: 'shotgunToReload', sF: 'shotgunFire', sS: 'ShotgunReady2', sR: 'ShotgunReloadOnceCut', car: 8, cad: 0.85, dan: 12, tipo: 'perdigones', semi: true, prop: 'Shotgun' },
  RPG: { nodo: 'RPG', ic: 'W_RPG', fuego: 'rocketlauncherFire', sacar: 'rocketlauncherReady', recarga: 'rocketlauncherReload', sF: 'RocketlauncherFire2', sS: 'RocketLauncherReady', sR: 'RocketLauncherReload', car: 1, cad: 0.6, dan: 120, tipo: 'cohete', semi: true, prop: 'RPG' },
  Crossbow: { nodo: 'Crossbow', ic: 'W_Crossbow', fuego: 'crossbowfire', sacar: 'crossbowready', recarga: 'crossbowreload', sF: 'crossbowfire', sS: 'genericReady', sR: 'crossbowreload', car: 1, cad: 0.4, dan: 90, tipo: 'flecha', semi: true, prop: 'Crossbow' },
  Bat: { nodo: 'Bat', ic: 'W_Bat', fuego: 'bathit1', sacar: 'batReady', sF: 'Arm_Swing_edited', sS: 'grabholster', car: 0, cad: 0.55, dan: 35, tipo: 'golpe', alcance: 2.4, prop: 'Bat' },
  Hands: { nodo: 'Hands', ic: 'Hands', fuego: 'Punch', fuego2: 'Hook', sacar: 'Draw', sF: 'Arm_Swing_edited', car: 0, cad: 0.45, dan: 15, tipo: 'golpe', alcance: 2.0 },
  GravityGun: { nodo: 'GravityGun', ic: 'W_GravityGun', fuego: 'Armature|Bottle-Hit', sacar: 'Armature|Bottle-Draw', sS: 'genericReadyNew_1', car: 0, cad: 0.5, tipo: 'grav', prop: 'GravityGun' },
  PhysicsGun: { nodo: 'PhysicsGun', ic: 'PhysicsGun', sS: 'genericReadyNew_1', car: 0, cad: 0.1, tipo: 'fisica' },
  ToolBaton: { nodo: 'ToolBaton', ic: 'ToolBaton', fuego: 'Armature|Bottle-Hit', sacar: 'Armature|Bottle-Draw', sS: 'genericReadyNew_1', car: 0, cad: 0.35, tipo: 'tool' },
  Camera: { nodo: 'Camera', ic: 'Camera', sS: 'Click', car: 0, cad: 0.6, tipo: 'foto' },
};
const ARM = { lista: ['RPG', 'Pistol', 'Camera', 'Hands', 'ToolBaton', 'PhysicsGun'], i: 5, balas: {}, t: 0, ocup: 0, recargando: 0, v: null, sway: { x: 0, y: 0, z: 0, qx: 0, qy: 0 }, bob: 0,
  agarre: null, grav: null, rotando: false, zoom: false };
function darArma(n) {
  if (!DEF_ARMAS[n]) return;
  if (!ARM.lista.includes(n)) ARM.lista.push(n);
  elegirArma(ARM.lista.indexOf(n)); aviso(n);
}
function elegirArma(i) {
  if (i < 0 || i >= ARM.lista.length) return;
  soltarAgarre(); ARM.i = i; const n = ARM.lista[i], D = DEF_ARMAS[n];
  if (ARM.balas[n] === undefined) ARM.balas[n] = D.car;
  ARM.v = vistaArma(D.nodo); ARM.recargando = 0; ARM.zoom = false;
  ARM.ocup = ARM.v && D.sacar ? Math.min(0.7, vistaTocar(ARM.v, D.sacar)) : 0.2;
  if (D.sS) sonar(D.sS, null, 0.6);
  hudArma();
}
function hudArma() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  $('iArma').src = icono(D.ic) || icono('W_' + n); $('nArma').textContent = n;
  $('muni').textContent = D.car ? `${ARM.balas[n]} | ∞` : '';
  const b = $('barra'); b.innerHTML = '';
  ARM.lista.forEach((x, k) => { const d = document.createElement('div'); d.className = 'ra' + (k === ARM.i ? ' sel' : ''); d.innerHTML = `<img src="${icono(DEF_ARMAS[x].ic) || icono('W_' + x)}">${x}`; d.onclick = () => { elegirArma(k); }; b.appendChild(d); });
  b.classList.remove('oc'); ARM.barraT = 2.5; $('arribaDe').style.visibility = 'hidden';
}
// ---------------- disparo ----------------
function rayoDesdeCamara(disp) {
  const d = CAM.fwd.clone();
  if (disp) { d.x += (Math.random() - 0.5) * disp * 2; d.y += (Math.random() - 0.5) * disp * 2; d.z += (Math.random() - 0.5) * disp * 2; d.norm(); }
  return d;
}
function impactoBala(o, d, D, dan) {
  const h = raycast(o, d, 400, JUG.vehiculo ? JUG.vehiculo.b : null);
  const fin = h ? h.p : vadd(o, vscale(d, 400));
  const mz = vistaPuntaMundo();
  efectoTraza(mz || o, fin);
  if (!h) return;
  efectoImpacto(h.p, h.n, h.body ? 'cuerpo' : 'mundo');
  if (h.body) {
    const b = h.body; b.wake && b.wake();
    if (b.dynamic) b.applyVel(vscale(d, Math.min(8, dan * 0.6 / Math.max(1, b.mass * 0.05))), vsub(h.p, b.pos), 1);
    if (b.obj) danarObjeto(b.obj, dan, h.p, d);
    if (b.persona) danarPersona(b.persona, dan, h.p, d, b);
  }
}
function disparar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  if (ARM.ocup > 0 || ARM.t > 0) return;
  if (D.car && ARM.balas[n] <= 0) { recargar(); return; }
  ARM.t = D.cad;
  const o = CAM.pos.clone();
  switch (D.tipo) {
    case 'bala': case 'perdigones': {
      if (!MODS.municionInfinita) ARM.balas[n]--;
      const k = D.tipo === 'perdigones' ? 8 : 1;
      for (let i = 0; i < k; i++) impactoBala(o, rayoDesdeCamara(D.tipo === 'perdigones' ? 0.06 : (D.disp || 0.004) * (ARM.zoom ? 0.2 : 1)), D, D.dan);
      if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego);
      sonar(D.sF, null, 0.8); efectoFogonazo();
      JUG.pitch -= D.tipo === 'perdigones' ? 0.04 : D.dan > 50 ? 0.03 : 0.008; ARM.retro = 1;
      if (typeof redDisparo === 'function') redDisparo(n);
      break;
    }
    case 'cohete': {
      if (!MODS.municionInfinita) ARM.balas[n]--; if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); sonar(D.sF, null, 0.8);
      lanzarProyectil('RPG Rocket', o, CAM.fwd, 38, 0, D.dan, true);
      break;
    }
    case 'flecha': {
      if (!MODS.municionInfinita) ARM.balas[n]--; if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); sonar(D.sF, null, 0.8);
      lanzarProyectil('Arrow', o, CAM.fwd, 70, 1, D.dan, false);
      break;
    }
    case 'golpe': {
      const pun = ARM.v && (D.fuego2 && Math.random() < 0.5 ? D.fuego2 : D.fuego); if (pun) vistaTocar(ARM.v, pun); sonar(D.sF, null, 0.6);
      ARM.golpeT = 0.12; ARM.golpeD = D;
      break;
    }
    case 'grav': gravPrimario(); if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); break;
    case 'tool': if (typeof herramientaUsar === 'function') herramientaUsar(false); if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego, { vel: 1.6 }); break;
    case 'foto': sacarFoto(); break;
  }
  if (D.car) hudArma();
  if (D.tipo !== 'fisica') humAccion(JUG.cuerpo, 'tiro');
}
function golpeAplicar(D) {
  const h = raycast(CAM.pos, CAM.fwd, D.alcance, JUG.vehiculo ? JUG.vehiculo.b : null);
  if (!h) return;
  sonar('Melee1', h.p, 0.8); efectoImpacto(h.p, h.n, 'golpe');
  if (h.body) {
    const b = h.body; b.wake && b.wake();
    if (b.dynamic) b.applyVel(vscale(CAM.fwd, Math.min(10, D.dan * 4 / Math.max(1, b.mass * 0.2))), vsub(h.p, b.pos), 1);
    if (b.obj) danarObjeto(b.obj, D.dan, h.p, CAM.fwd);
    if (b.persona) danarPersona(b.persona, D.dan, h.p, CAM.fwd, b);
  }
}
function recargar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  if (!D.car || ARM.balas[n] >= D.car || ARM.recargando > 0) return;
  const dur = ARM.v && D.recarga ? vistaTocar(ARM.v, D.recarga) : 1.2;
  ARM.recargando = Math.max(0.6, Math.min(3, dur)); ARM.ocup = ARM.recargando;
  if (D.sR) sonar(D.sR, null, 0.7);
  humAccion(JUG.cuerpo, 'recarga'); if (typeof redRecarga === 'function') redRecarga();
}
// ---------------- proyectiles ----------------
const PROY = [];
function lanzarProyectil(nombre, o, d, vel, grav, dan, explota) {
  const key = DATA.pfPorNombre[nombre]; const md = key ? new Modelo(DATA.pf[key]) : null;
  if (md) md.p[0] = [0, 0, 0];
  const p = { md, pos: vadd(o, vscale(d, 0.8)), vel: vscale(d, vel), grav, dan, explota, vida: 6, clavado: null, nombre };
  PROY.push(p); return p;
}
function proyectilesPaso(dt) {
  for (let i = PROY.length - 1; i >= 0; i--) {
    const p = PROY[i];
    p.vida -= dt; if (p.vida <= 0) { PROY.splice(i, 1); continue; }
    if (p.clavado) { if (p.clavado.b) { const b = p.clavado.b; p.pos.copy(vadd(b.pos, b.q.rot(p.clavado.rl))); p.q = b.q.clone().mul(p.clavado.ql); } continue; }
    p.vel.y -= GRAV * MUNDO.gravedad * p.grav * dt;
    const L = p.vel.len() * dt, d = vscale(p.vel, 1 / (p.vel.len() || 1));
    const h = raycast(p.pos, d, L, JUG.vehiculo ? JUG.vehiculo.b : null);
    if (h) {
      p.pos.copy(h.p);
      if (p.explota) { explosion(h.p, 6, p.dan); PROY.splice(i, 1); continue; }
      // flecha: queda clavada
      efectoImpacto(h.p, h.n, 'golpe'); sonar('Melee1', h.p, 0.5, 1.4);
      if (h.body) {
        const b = h.body; if (b.dynamic) b.applyVel(vscale(d, 3), vsub(h.p, b.pos), 1);
        if (b.obj) danarObjeto(b.obj, p.dan, h.p, d); if (b.persona) danarPersona(b.persona, p.dan, h.p, d, b);
        p.clavado = { b, rl: b.q.conj().rot(vsub(h.p, b.pos)), ql: b.q.conj().mul(qMirar(d)) };
      } else p.clavado = { b: null };
      p.vida = 20; continue;
    }
    p.pos.addS(p.vel, dt);
    if (p.explota && Math.random() < 0.7) particula(p.pos, vscale(p.vel, -0.05), 0.6, 0.35, [0.7, 0.7, 0.7, 0.5], 'humo');
  }
}
function qMirar(d) {
  const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(clamp(d.y, -1, 1));
  return Quat.euler(yaw, pitch);
}
function dibujarProyectiles() {
  for (const p of PROY) {
    if (!p.md) continue;
    const q = p.q || qMirar(p.vel.lenSq() > 0.01 ? vscale(p.vel, 1 / p.vel.len()) : CAM.fwd);
    p.md.ponerRaiz(m4trs([p.pos.x, p.pos.y, p.pos.z], [q.x, q.y, q.z, q.w], [1, 1, 1], _mb)); p.md.encolar();
  }
}
// ---------------- explosiones y daño ----------------
function explosion(p, radio, dan) {
  if (MODS.explosion && MODS.explosion !== 1 && !explosion.remota) { radio *= MODS.explosion; dan *= MODS.explosion; }
  sonar('GrenadeExplode', p, 1.4);
  if (!explosion.remota) redExplosion(p, radio, dan);
  efectoExplosion(p);
  for (const b of PH.bodies) {
    if (!b.dynamic && !b.frozen) continue;
    const d = vsub(b.pos, p), L = d.len(); if (L > radio * 1.6) continue;
    const k = (1 - L / (radio * 1.6)); b.frozen = b.frozen && !b.obj ? b.frozen : b.frozen; b.wake();
    if (b.dynamic) b.vel.addS(d.scale(1 / (L || 1)), k * 22 * Math.min(1, 300 / b.mass + 0.15)).y += k * 6;
    if (b.dynamic) b.ang.addS(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), k * 6);
    if (b.obj && b.obj !== explosion.fuente) danarObjeto(b.obj, dan * k, b.pos, d);
    if (b.persona && !explosion.remota) danarPersona(b.persona, dan * k, b.pos, d, b);
  }
  const dj = JUG.pos.distTo(p);
  if (dj < radio * 1.4 && !JUG.vehiculo && !CIC.inmune) { danarJugador(dan * (1 - dj / (radio * 1.4)), p); JUG.vel.addS(vsub(JUG.pos, p).norm(), 12 * (1 - dj / (radio * 1.4))); JUG.vel.y += 4; }
  CAM.temblor = Math.max(CAM.temblor, clamp(1.5 - dj / 30, 0, 1));
}
function explosivosPaso(dt) {
  for (const o of OBJS) {
    if (o.tipo !== 'explota' || o.exploto || o.remoto) continue;
    if (o.nombre === 'Mine') {
      const c = o.b.pos; let toca = JUG.vivo && !JUG.vehiculo && JUG.pos.distTo(c) < 1.3;
      if (!toca) for (const b of PH.bodies) { if (b === o.b || !b.dynamic || b.sleep) continue; if (b.pos.distTo(c) < 1.1 + b.r * 0.5) { toca = true; break; } }
      if (toca && TIEMPO.t - o.creado > 1.5) danarObjeto(o, 999, c, v3(0, 1, 0));
    }
    if (o.nombre === 'Rocket' && o.encendido) {
      o.encendido -= dt; const up = o.b.q.rot(v3(0, 1, 0)); o.b.wake(); o.b.frozen = false; o.b.vel.addS(up, 30 * dt); o.b.held = false;
      particula(vsub(o.b.pos, vscale(up, 0.6)), vscale(up, -6), 0.4, 0.25, [1, 0.6, 0.2, 1], 'fuego'); particula(vsub(o.b.pos, vscale(up, 0.7)), vscale(up, -2), 1.2, 0.4, [0.6, 0.6, 0.6, 0.5], 'humo');
      bucle('cohete' + o.id, 'NitrousPlaceHolderSound', o.b.pos, 0.6, 1.1);
      if (o.encendido <= 0) danarObjeto(o, 999, o.b.pos, up);
    }
  }
}
function danarObjeto(o, dan, p, d) {
  if (o.nombre === 'Rocket' && !o.encendido && !o.exploto && dan < 900) { o.encendido = 2.5; return; }
  if (o.tipo === 'explota' && !o.exploto) {
    o.vidaObj -= dan / 40;
    if (o.vidaObj <= 0) { o.exploto = true; explosion.fuente = o; setTimeout(() => { if (OBJS.includes(o)) { explosion(o.b.pos.clone(), 6, 100); borrarObjeto(o); } explosion.fuente = null; }, 60); }
  }
  if (o.tipo === 'vehiculo' && o.veh) { o.veh.vida -= dan; if (o.veh.vida <= 0 && !o.veh.roto) vehiculoRoto(o); }
}
function danarJugador(dan, de) {
  if (!JUG.vivo || JUEGO.dios || CIC.inmune) return;
  if (!MODS.invencible) JUG.vida -= dan; else if (dan > 0 && dan < 1e5) modEscudo(); JUG.golpeT = 0.4; humAccion(JUG.cuerpo, 'golpe');
  if (JUG.vida <= 0) { JUG.vida = 0; morirJugador(); }
}
// ---------------- pistola física ----------------
function fisicaPaso(dt) {
  const A = ARM.agarre;
  if (!A) return;
  const b = A.b;
  if (!PH.bodies.includes(b)) { ARM.agarre = null; return; }
  const meta = vadd(CAM.pos, vscale(CAM.fwd, A.dist));
  const pAg = vadd(b.pos, b.q.rot(A.rl));
  const dv = vsub(meta, pAg);
  b.held = true; b.frozen = false; b.wake();
  b.vel.copy(dv.scale(Math.min(1 / dt, 14))).scale(1);
  const vm = b.vel.len(); if (vm > 40) b.vel.scale(40 / vm);
  // orientación: se mantiene la relativa a la cámara (o se gira si está rotando)
  if (ARM.rotando) { const qy = Quat.axis(0, 1, 0, -ENT.rdx * 0.006), qx = Quat.axis(1, 0, 0, ENT.rdy * 0.006); A.qrel = qy.mul(qx).mul(A.qrel); }
  const camQ = Quat.axis(0, 1, 0, JUG.yaw);
  const qmeta = camQ.clone().mul(A.qrel);
  const dq = new Quat().mulTo(qmeta, b.q.conj()); if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
  b.ang.set(dq.x * 2 / dt * 0.35, dq.y * 2 / dt * 0.35, dq.z * 2 / dt * 0.35);
}
function agarrarFisica() {
  const h = raycast(CAM.pos, CAM.fwd, 50, JUG.vehiculo ? JUG.vehiculo.b : null);
  if (!h || !h.body || h.body.estatico || h.body.noGrab) return;
  const b = h.body; if (b.obj) redReclamar(b.obj); b.frozen = false; b.wake();
  const camQ = Quat.axis(0, 1, 0, JUG.yaw);
  ARM.agarre = { b, dist: h.t, rl: b.q.conj().rot(vsub(h.p, b.pos)), qrel: camQ.conj().mul(b.q) };
  b.held = true; if (b.obj && b.obj.veh) b.obj.veh.agarrado = true;
}
function soltarAgarre(congelar) {
  const A = ARM.agarre; if (!A) return;
  A.b.held = false; if (A.b.obj && A.b.obj.veh) A.b.obj.veh.agarrado = false;
  if (congelar) { A.b.frozen = true; A.b.vel.set(0, 0, 0); A.b.ang.set(0, 0, 0); efectoCongelar(A.b); sonar('Click', null, 0.6); }
  else A.b.wake();
  ARM.agarre = null;
}
// ---------------- pistola de gravedad ----------------
function gravPrimario() {
  if (ARM.grav) { const b = ARM.grav.b; soltarGrav(); b.vel.addS(CAM.fwd, Math.min(50, 2500 / Math.max(10, b.mass))); sonar('Melee1', b.pos, 0.6, 0.7); return; }
  const h = raycast(CAM.pos, CAM.fwd, 10, null);
  if (h && h.body && h.body.dynamic) { h.body.wake(); h.body.vel.addS(CAM.fwd, Math.min(50, 1500 / Math.max(10, h.body.mass))); sonar('Melee1', h.p, 0.6, 0.7); natEmpujon(h.body); }
}
function gravSecundario() {
  if (ARM.grav) { soltarGrav(); return; }
  const h = raycast(CAM.pos, CAM.fwd, 25, null);
  if (h && h.body && !h.body.estatico && h.body.mass < 2000) { if (h.body.obj) redReclamar(h.body.obj); h.body.frozen = false; ARM.grav = { b: h.body }; h.body.held = true; h.body.wake(); }
}
function soltarGrav() { if (ARM.grav) { ARM.grav.b.held = false; ARM.grav.b.wake(); ARM.grav = null; } }
function gravPaso(dt) {
  const G = ARM.grav; if (!G) return;
  const b = G.b; if (!PH.bodies.includes(b)) { ARM.grav = null; return; }
  const meta = vadd(CAM.pos, vscale(CAM.fwd, 2.5 + b.r));
  b.vel.copy(vsub(meta, b.pos).scale(Math.min(1 / dt, 12))); b.ang.scale(0.8); b.held = true; b.wake();
}
// ---------------- cámara de fotos ----------------
function sacarFoto() {
  sonar('Click', null, 0.8); JUEGO.foto = 2;
}
// ---------------- cada cuadro ----------------
function armasPaso(dt) {
  ARM.t -= dt; if (ARM.ocup > 0) ARM.ocup -= dt;
  if (ARM.recargando > 0) { ARM.recargando -= dt; if (ARM.recargando <= 0) { const n = ARM.lista[ARM.i]; ARM.balas[n] = DEF_ARMAS[n].car; hudArma(); } }
  if (ARM.barraT > 0) { ARM.barraT -= dt; if (ARM.barraT <= 0) { $('barra').classList.add('oc'); $('arribaDe').style.visibility = ''; } }
  if (ARM.golpeT > 0) { ARM.golpeT -= dt; if (ARM.golpeT <= 0) golpeAplicar(ARM.golpeD); }
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  // (tirado como muñeco o en cuatro patas no se usan armas; en el creador el clic elige y pone)
  if (!UI.abierto && JUG.vivo && !JUG.vehiculo && !NAT.rag && !NAT.scp && !(CREA.on && creadorPaso())) {
    if (D.tipo === 'fisica') {
      // en el celular un toque agarra y otro suelta (no hay que mantener); con el mouse, mantener como siempre
      const flanco = ENT.disparo && !ARM.fisAnt; ARM.fisAnt = ENT.disparo;
      if (ENT.tactil) { if (flanco) { if (ARM.agarre) soltarAgarre(false); else agarrarFisica(); } }
      // (después de congelar algo hay que soltar el clic para agarrar otra vez: si no, lo volvía a agarrar y descongelar)
      else { if (!ENT.disparo) ARM.trasCongelar = false; if (ENT.disparo && !ARM.agarre && !ARM.trasCongelar) agarrarFisica(); if (!ENT.disparo && ARM.agarre) soltarAgarre(false); }
      if (ARM.agarre && ENT.disparo2) { soltarAgarre(true); ENT.disparo2 = false; ARM.trasCongelar = true; }
      else if (!ARM.agarre && ENT.disparo2) { ENT.disparo2 = false; const h = raycast(CAM.pos, CAM.fwd, 50, null); if (h && h.body && h.body.frozen && !h.body.estatico) { h.body.frozen = false; h.body.wake(); aviso('Descongelado', 1); } }
      if (ARM.agarre && ENT.rueda) { ARM.agarre.dist = clamp(ARM.agarre.dist - ENT.rueda * 0.6, 1.5, 50); }
      ARM.rotando = !!ARM.agarre && (ENT.teclas.has('KeyE') || ENT.rotar);
      if (ARM.agarre && ENT.pulsoDist) { ARM.agarre.dist = clamp(ARM.agarre.dist + ENT.pulsoDist, 1.5, 50); ENT.pulsoDist = 0; }
      if (ENT.tactil !== ARM.fbVis || !!ARM.agarre !== ARM.fbAg) { ARM.fbVis = ENT.tactil; ARM.fbAg = !!ARM.agarre; $('fisBotones').classList.toggle('oc', !(ENT.tactil && ARM.agarre)); }
    } else {
      if (ENT.disparo) { disparar(); if (D.semi) ENT.disparo = ENT.tactil ? ENT.disparo : false; }
      if (ENT.disparo2) {
        ENT.disparo2 = false;
        if (D.tipo === 'grav') gravSecundario();
        else if (D.tipo === 'tool' && typeof herramientaUsar === 'function') herramientaUsar(true);
        else if (D.mira) { ARM.zoom = !ARM.zoom; }
      }
      if (ENT.rueda && !ARM.agarre) { elegirArma((ARM.i + (ENT.rueda > 0 ? 1 : -1) + ARM.lista.length) % ARM.lista.length); }
    }
  }
  ENT.rueda = 0;
  fisicaPaso(dt); gravPaso(dt);
  proyectilesPaso(dt); explosivosPaso(dt);
  // vaivén del arma
  const sp = Math.hypot(JUG.vel.x, JUG.vel.z) * (JUG.suelo ? 1 : 0.2);
  ARM.bob += dt * sp * 1.6;
  const S = ARM.sway, k = 1 - Math.exp(-dt * 10);
  ARM.retro = (ARM.retro || 0) * Math.exp(-dt * 14);
  S.x += (Math.sin(ARM.bob) * 0.012 * Math.min(1, sp / 6) + clamp(-ENT.mdx * 0.0004, -0.02, 0.02) - S.x) * k;
  S.y += (Math.abs(Math.cos(ARM.bob)) * 0.01 * Math.min(1, sp / 6) - S.x * 0.1 - S.y) * k;
  S.z = -ARM.retro * 0.03;
  if (ARM.v) vistaAplicar(ARM.v, dt);
}
function dibujarVista() {
  if (!ARM.v || JUG.tercera || !JUG.vivo || JUG.vehiculo || ARM.zoom || CIC.vic || CIC.camOn) return false;
  vistaUbicar(ARM.v, CAM.pos, CAM.q, ARM.sway); ARM.v.md.encolar();
  return true;
}
// punta del arma en el mundo (para trazas y el rayo de la pistola física)
function vistaPuntaMundo() {
  const v = ARM.v; if (!v || v.mz < 0 || JUG.tercera) return null;
  v.md.actualizar(); const W = v.md.W[v.mz]; return v3(W[12], W[13], W[14]);
}
function dibujarRayoFisica() {
  const A = ARM.agarre; if (!A) return;
  const p0 = vistaPuntaMundo() || vadd(CAM.pos, v3(0, -0.2, 0)), p1 = vadd(A.b.pos, A.b.q.rot(A.rl));
  const n = 16, c = [1, 0.82, 0.25, 0.95];
  let prev = p0;
  const mid = vadd(CAM.pos, vscale(CAM.fwd, A.dist * 0.5));
  for (let i = 1; i <= n; i++) {
    const t = i / n, a = vadd(vscale(p0, (1 - t) * (1 - t)), vadd(vscale(mid, 2 * t * (1 - t)), vscale(p1, t * t)));
    linea(prev, a, c); prev = a;
  }
}
