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
  // la palanca de Half-Life 2 / Garry's Mod (herramientas/gmod.py): el brazo con el guante del traje HEV, sus animaciones
  // (sacar, quieto, tres golpes que pegan y dos al aire) y sus sonidos; alcance y ritmo como en HL2 (75 unidades, 0,4 s)
  Crowbar: { nodo: 'Crowbar', ic: 'W_Crowbar', fuego: 'CB_miss1', pega: ['CB_hit1', 'CB_hit2', 'CB_hit3'], falla: ['CB_miss1', 'CB_miss2'], sacar: 'CB_draw', quieto: 'CB_idle',
    sF: 'CB_Swing', sImp: ['CB_Impact1', 'CB_Impact2'], sCarne: ['CB_Flesh1', 'CB_Flesh2', 'CB_Flesh3', 'CB_Flesh4', 'CB_Flesh5'], car: 0, cad: 0.4, dan: 25, empuje: 70, tipo: 'golpe', alcance: 1.95, prop: 'Crowbar' },
  // (la Gravity Gun de HL2 y la Physics Gun y la Tool Gun de GMod, de herramientas/gmod.py: vista con sus animaciones,
  // "sujeta" mientras tiene algo agarrado, y sus sonidos)
  GravityGun: { nodo: 'GM_GravGun', ic: 'W_GravGun', fuego: 'GG_fire', sacar: 'GG_draw', quieto: 'GG_idle', sujeta: 'GG_hold', sS: 'GG_Open', sF: ['GG_Launch1', 'GG_Launch2', 'GG_Launch3', 'GG_Launch4'],
    sAgarra: 'GG_Pickup', sSuelta: 'GG_Drop', sVacio: 'GG_Dry', sSosten: 'GG_Hold', car: 0, cad: 0.5, tipo: 'grav', prop: 'GravityGun' },
  PhysicsGun: { nodo: 'GM_PhysGun', ic: 'W_PhysGun', sacar: 'PG_draw', quieto: 'PG_idle', sujeta: 'PG_hold', sS: 'genericReadyNew_1', sSuelta: 'PG_Off', sSosten: 'PG_Hold', car: 0, cad: 0.1, tipo: 'fisica' },
  ToolBaton: { nodo: 'GM_ToolGun', ic: 'W_ToolGun', fuego: 'TG_fire', sacar: 'TG_draw', quieto: 'TG_idle', sS: 'genericReadyNew_1', sF: ['TG_Fire1', 'TG_Fire2'], car: 0, cad: 0.35, tipo: 'tool' },
  Camera: { nodo: 'Camera', ic: 'Camera', sS: 'Click', car: 0, cad: 0.6, tipo: 'foto' },
};
const ARM = { lista: ['RPG', 'Pistol', 'Camera', 'Hands', 'Crowbar', 'ToolBaton', 'PhysicsGun'], i: 6, balas: {}, t: 0, ocup: 0, recargando: 0, v: null, sway: { x: 0, y: 0, z: 0, qx: 0, qy: 0 }, bob: 0,
  agarre: null, grav: null, rotando: false, zoom: false };
function darArma(n) {
  if (!DEF_ARMAS[n]) return;
  if (!ARM.lista.includes(n)) ARM.lista.push(n);
  elegirArma(ARM.lista.indexOf(n)); aviso(DEF_ARMAS[n].nom || n);
}
const azarDe = (a) => (Array.isArray(a) ? a[(Math.random() * a.length) | 0] : a);   // (uno de varios sonidos)
// las armas de Half-Life 2 (herramientas/gmod.py, DATA.gm.hl2): la vista, sus animaciones y sus sonidos en lugar de los del
// juego (el daño, el cargador y el ritmo quedan como estaban); en tercera persona, la postura de GMod de su tipo
function armasHL2() {
  const H = DATA.gm && DATA.gm.hl2; if (!H) return;
  for (const [a, x] of Object.entries(H)) {
    const D = DEF_ARMAS[a]; if (!D) continue;
    const c = (suf) => x.clips.find((n) => n.endsWith('_' + suf)) || null;
    Object.assign(D, { nodo: x.nodo, ic: x.ic, sacar: c('draw'), quieto: c('idle'), fuego: c('fire'), recarga: c('reload') || D.recarga, tras: c('pump') });
    if (x.sF) D.sF = x.sF; if (x.sR) D.sR = x.sR;
    const t = DATA.gm.armas[a] && DATA.gm.armas[a].tipo;
    if (t) { POSE_ARMA[a] = 'gm_idle_' + t; ACC_ARMA[a] = ['gm_range_' + t, humClipNombre('Reload', 'gm_reload_' + t) ? 'gm_reload_' + t : (ACC_ARMA[a] || [])[1] || null]; }
  }
}
function elegirArma(i) {
  if (i < 0 || i >= ARM.lista.length) return;
  soltarAgarre(); ARM.i = i; const n = ARM.lista[i], D = DEF_ARMAS[n];
  if (ARM.balas[n] === undefined) ARM.balas[n] = D.car;
  ARM.v = vistaArma(D.nodo); ARM.recargando = 0; ARM.zoom = false; ARM.apunta = false; ARM.apK = 0;
  ARM.ocup = ARM.v && D.sacar ? Math.min(0.7, vistaTocar(ARM.v, D.sacar)) : 0.2;
  if (D.sS) sonar(D.sS, null, 0.6); else sonar('UI_arma', null, 0.35);   // (cambiar de arma: el clic de HL2)
  hudArma();
}
function hudArma() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  const icA = (d, x) => icono(d.ic) || (/^ico:/.test(d.ic || '') ? icoSrc(d.ic) : '') || icono('W_' + x);
  $('iArma').src = icA(D, n); $('nArma').textContent = D.nom || n;
  $('muni').textContent = D.car ? `${ARM.balas[n]} | ∞` : '';
  const b = $('barra'); b.innerHTML = '';
  ARM.lista.forEach((x, k) => { const d = document.createElement('div'); d.className = 'ra' + (k === ARM.i ? ' sel' : ''); d.innerHTML = `<img src="${icA(DEF_ARMAS[x], x)}">${esc(DEF_ARMAS[x].nom || x)}`; d.onclick = () => { elegirArma(k); }; b.appendChild(d); });
  b.classList.remove('oc'); ARM.barraT = 2.5; $('arribaDe').style.visibility = 'hidden';
}
// ---------------- de dónde sale el tiro ----------------
// Lo que dispara el jugador (balas, perdigones, el cohete, la flecha, los golpes, la pistola física, la de gravedad y la
// Tool Gun) sale de sus ojos y va hacia donde apunta él, como en GMod (GetShootPos y GetAimVector), no de la cámara de la
// imagen. En primera persona son lo mismo; con la cámara libre (camlibre.js) no: el cohete, las balas y el rayo salían de
// la cámara libre y hacia donde miraba ella (Discord: «si activás la freecam, después equipás el bazooka y disparás, no
// dispara desde tu personaje, sino desde la freecam»). Igual con la cámara de la Tool Gun (HCAM) y en tercera persona, donde
// la cámara va 3 m atrás: el rumbo era el mismo, pero el cohete salía detrás de la cabeza y los golpes (2 m) no llegaban.
// ¿la cámara no está en los ojos? (la cámara libre arranca en los ojos, pero gira sola: cuenta aunque no se haya movido; en
// un vehículo no se dispara y los ojos no se actualizan: la cámara es la del vehículo, como siempre)
function camaraAfuera() { return !JUG.vehiculo && !!((typeof CLIB !== 'undefined' && CLIB.modo) || HCAM.ver || JUG.tercera || (JUG.ojoPos && CAM.pos.distTo(JUG.ojoPos) > 0.25)); }
function miraOjo() { return camaraAfuera() && JUG.ojoPos ? JUG.ojoPos : CAM.pos; }
function miraDir() { return camaraAfuera() ? Quat.euler(JUG.yaw, JUG.pitch).rot(v3(0, 0, 1)) : CAM.fwd; }
// la boca del arma: en primera persona la del arma de la vista; con la cámara afuera, la mano derecha del personaje (donde
// lleva el arma) 0,3 m hacia donde apunta o, si no hay cuerpo, debajo de los ojos (como npcBoca con los NPCs)
function bocaArma(d) {
  if (!camaraAfuera()) return vistaPuntaMundo();
  const f = d || miraDir(), o = JUG.ojoPos, P = JUG.cuerpo, hi = P && P.D && P.D.h && P.D.h.RightHand, W = hi !== undefined && P.md && P.md.W && P.md.W[hi];
  let p = W ? v3(W[12], W[13], W[14]) : null;
  if (!p || !isFinite(p.x + p.y + p.z) || p.distTo(o) > 1.2 * (JUG.tam || 1)) p = vadd(o, v3(0, -0.3, 0));
  return p.addS(f, 0.3);
}
// de dónde sale un proyectil del jugador y hacia dónde va: en primera persona, 0,8 m adelante de los ojos sobre la mira;
// con la cámara afuera, de la boca del arma en la mano hacia lo que está en la mira (lo primero que toca el rayo de los
// ojos), así pega donde apunta. Si entre los ojos y la salida hay algo (pegado a una pared), sale de los ojos: si no,
// aparecía del otro lado y la atravesaba
function salidaProyectil(o, d) {
  const afuera = camaraAfuera(); let p = afuera ? bocaArma(d) : vadd(o, vscale(d, 0.8)), dir = d;
  if (afuera) { const h = raycast(o, d, 300, null), v = vsub(h ? h.p : vadd(o, vscale(d, 300)), p), L = v.len(); if (L > 1.5 && vdot(v, d) > 0.7 * L) dir = v.scale(1 / L); }
  const e = vsub(p, o), Le = e.len(); if (Le > 1e-3 && raycast(o, e.scale(1 / Le), Le, null)) p = o.clone();
  return { p, d: dir };
}
// ---------------- disparo ----------------
function rayoDesdeCamara(disp, base) {
  const d = (base || CAM.fwd).clone();
  if (disp) { d.x += (Math.random() - 0.5) * disp * 2; d.y += (Math.random() - 0.5) * disp * 2; d.z += (Math.random() - 0.5) * disp * 2; d.norm(); }
  return d;
}
function impactoBala(o, d, D, dan) {
  const h = raycast(o, d, 400, JUG.vehiculo ? JUG.vehiculo.b : null);
  const fin = h ? h.p : vadd(o, vscale(d, 400));
  const mz = bocaArma(d);
  efectoTraza(mz || o, fin);
  if (!h) return;
  efectoImpacto(h.p, h.n, h.body ? 'cuerpo' : 'mundo');
  if (h.body) {
    const b = h.body; b.wake && b.wake();
    if (b.dynamic) b.applyVel(vscale(d, Math.min(8, dan * 0.6 / Math.max(1, b.mass * 0.05))), vsub(h.p, b.pos), 1);
    if (b.obj) danarObjeto(b.obj, dan, h.p, d);
    if (b.persona) danarPersona(b.persona, dan, h.p, d, b);
    if (b.verity) verEmpujon(b.verity, vscale(d, Math.min(9, 2 + dan * 0.25)), true); // (a Verity el tiro la empuja)
  }
}
function disparar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  if (ARM.ocup > 0 || ARM.t > 0) return;
  if (D.car && ARM.balas[n] <= 0) { recargar(); return; }
  ARM.t = D.cad;
  const o = miraOjo().clone(), dir = miraDir().clone();   // (de los ojos del personaje hacia donde apunta: ver camaraAfuera)
  switch (D.tipo) {
    case 'bala': case 'perdigones': {
      if (!MODS.municionInfinita) ARM.balas[n]--;
      const k = D.tipo === 'perdigones' ? 8 : 1;
      for (let i = 0; i < k; i++) impactoBala(o, rayoDesdeCamara(D.tipo === 'perdigones' ? 0.06 : (D.disp || 0.004) * (ARM.zoom ? 0.2 : 1) * (1 - 0.6 * (ARM.apK || 0)), dir), D, D.dan);
      if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego);
      sonar(azarDe(D.sF), null, 0.8); efectoFogonazo();
      // (el arma sube la mira; no con la cámara libre ni mirando por la cámara de la Tool Gun: ahí la mira del personaje no
      // se mueve con el dedo y cada tiro la dejaba más arriba, sin poder bajarla)
      if (!(typeof CLIB !== 'undefined' && CLIB.modo) && !HCAM.ver) JUG.pitch = Math.max(-1.55, JUG.pitch - (D.tipo === 'perdigones' ? 0.04 : D.dan > 50 ? 0.03 : 0.008)); ARM.retro = 1;   // (sin pasar de mirar arriba: si no, la cámara se da vuelta)
      if (typeof redDisparo === 'function') redDisparo(n);
      break;
    }
    case 'cohete': {
      if (!MODS.municionInfinita) ARM.balas[n]--; if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); sonar(azarDe(D.sF), null, 0.8);
      const s = salidaProyectil(o, dir); lanzarProyectil('RPG Rocket', s.p, s.d, 38, 0, D.dan, true, 0);
      break;
    }
    case 'flecha': {
      if (!MODS.municionInfinita) ARM.balas[n]--; if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); sonar(azarDe(D.sF), null, 0.8);
      const s = salidaProyectil(o, dir); lanzarProyectil('Arrow', s.p, s.d, 70, 1, D.dan, false, 0);
      break;
    }
    case 'golpe': {
      if (typeof redDisparo === 'function') redDisparo(n);   // (los demás oyen el golpe y ven el movimiento)
      if (D.pega) {   // (como en HL2: el golpe se sabe al toque; si pega, la animación que pega; si no, al aire con su silbido)
        const h = raycast(o, dir, D.alcance, JUG.vehiculo ? JUG.vehiculo.b : null), l = h ? D.pega : D.falla;
        if (ARM.v) vistaTocar(ARM.v, l[(Math.random() * l.length) | 0]);
        if (h) golpeAplicar(D, h); else sonar(azarDe(D.sF), null, 0.7);   // (el golpe en el momento, con lo que se apuntó)
        break;
      }
      const pun = ARM.v && (D.fuego2 && Math.random() < 0.5 ? D.fuego2 : D.fuego); if (pun) vistaTocar(ARM.v, pun); sonar(azarDe(D.sF), null, 0.6);
      ARM.golpeT = 0.12; ARM.golpeD = D;
      break;
    }
    case 'grav': gravPrimario(); if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego); break;
    case 'tool': if (typeof herramientaUsar === 'function') herramientaUsar(false); if (ARM.v && D.fuego) vistaTocar(ARM.v, D.fuego, { vel: 1.6 }); if (D.sF) sonar(azarDe(D.sF), null, 0.55); break;
    case 'foto': sacarFoto(); break;
  }
  if (D.car) hudArma();
  if (D.tipo !== 'fisica') humAccion(JUG.cuerpo, 'tiro');
}
function golpeAplicar(D, h0) {
  const f = miraDir(), h = h0 || raycast(miraOjo(), f, D.alcance, JUG.vehiculo ? JUG.vehiculo.b : null);
  if (!h) return;
  const imp = D.sImp && (h.body && h.body.persona ? D.sCarne : D.sImp);   // (la palanca: metal contra metal, o contra la carne)
  sonar(imp ? imp[(Math.random() * imp.length) | 0] : 'Melee1', h.p, 0.8); efectoImpacto(h.p, h.n, 'golpe');
  if (h.body) {
    const b = h.body; b.wake && b.wake();
    // (la palanca empuja como en HL2: un cajón de 50 kg sale a ~1,4 m/s, algo liviano bastante más)
    if (b.dynamic) b.applyVel(vscale(f, D.empuje ? Math.min(D.empuje, b.mass * 7) : Math.min(10, D.dan * 4 / Math.max(1, b.mass * 0.2))), vsub(h.p, b.pos), 1);
    if (b.obj) danarObjeto(b.obj, D.dan, h.p, f);
    if (b.persona) danarPersona(b.persona, D.dan, h.p, f, b);
  }
}
function recargar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  if (D && D.tipo === 'gmswep') { if (typeof GMA !== 'undefined') GMA.pedirRecarga = true; return; }   // (el arma de un mod recarga con su SWEP:Reload: también desde el botón de la pantalla)
  if (!D.car || ARM.balas[n] >= D.car || ARM.recargando > 0) return;
  const dur = ARM.v && D.recarga ? vistaTocar(ARM.v, D.recarga) : 1.2;
  ARM.recargando = Math.max(0.6, Math.min(4, dur)); ARM.ocup = ARM.recargando;   // (la .357 de HL2 tarda 3,7 s)
  if (D.sR) sonar(azarDe(D.sR), null, 0.7);
  humAccion(JUG.cuerpo, 'recarga'); if (typeof redRecarga === 'function') redRecarga();
}
// ---------------- proyectiles ----------------
const PROY = [];
// (adel: cuánto adelante de o aparece; el jugador ya pasa la salida justa —salidaProyectil— y va 0)
function lanzarProyectil(nombre, o, d, vel, grav, dan, explota, adel) {
  const key = DATA.pfPorNombre[nombre]; const md = key ? new Modelo(DATA.pf[key]) : null;
  if (md) md.p[0] = [0, 0, 0];
  const p = { md, pos: vadd(o, vscale(d, adel === undefined ? 0.8 : adel)), vel: vscale(d, vel), grav, dan, explota, vida: 6, clavado: null, nombre };
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
  // (util.BlastDamage de los addons es sólo el daño: sin dibujo ni sonido, como en GMod)
  if (!explosion.sinFx) sonar('GrenadeExplode', p, 1.4); verExplosion(p, radio);
  if (!explosion.remota) redExplosion(p, radio, dan, explosion.fuente);
  if (!explosion.sinFx) efectoExplosion(p, clamp(radio / 6, 0.6, 3));
  for (const b of PH.bodies) {
    if (!b.dynamic && !b.frozen) continue;
    const d = vsub(b.pos, p), L = d.len(); if (L > radio * 1.6) continue;
    const k = (1 - L / (radio * 1.6)); b.frozen = b.frozen && !b.obj ? b.frozen : b.frozen; b.wake();
    if (b.dynamic) b.vel.addS(d.scale(1 / (L || 1)), k * 22 * Math.min(1, 300 / b.mass + 0.15)).y += k * 6;
    if (b.dynamic) b.ang.addS(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), k * 6);
    // (en multijugador cada objeto lo daña sólo su dueño, cuando le llega la explosión: si no, la copia del barril del otro
    // explotaba acá también y mandaba su explosión, y en la pantalla del dueño explotaba dos veces)
    if (b.obj && b.obj !== explosion.fuente && !b.obj.remoto) danarObjeto(b.obj, dan * k, b.pos, d);
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
  if (o.gmEnt && typeof gmaDanoObj === 'function' && gmaDanoObj(o, dan, p, d)) return;   // (una entidad de un addon de GMod: su OnTakeDamage)
  if (o.nombre === 'Rocket' && !o.encendido && !o.exploto && dan < 900) { o.encendido = 2.5; return; }
  if (o.tipo === 'explota' && !o.exploto) {
    o.vidaObj -= dan / 40;
    if (o.vidaObj <= 0) { o.exploto = true; explosion.fuente = o; setTimeout(() => { if (OBJS.includes(o)) { explosion(o.b.pos.clone(), 6, 100); borrarObjeto(o); } explosion.fuente = null; }, 60); }
  }
  if (o.tipo === 'vehiculo' && o.veh) { o.veh.vida -= dan; if (o.veh.vida <= 0 && !o.veh.roto) vehiculoRoto(o); }
}
function danarJugador(dan, de) {
  if (!JUG.vivo || JUEGO.dios || CIC.inmune) return;
  if (!MODS.invencible) { JUG.vida -= dan; if (dan > 0) sonVoz(JUG.cuerpo, JUG.vida <= 0 ? 'muere' : 'dolor'); } else if (dan > 0 && dan < 1e5) modEscudo(); JUG.golpeT = 0.4; humAccion(JUG.cuerpo, 'golpe');
  if (JUG.vida <= 0) { JUG.vida = 0; morirJugador(); }
}
// ---------------- pistola física ----------------
function fisicaPaso(dt) {
  const A = ARM.agarre;
  if (!A) return;
  const b = A.b;
  if (!PH.bodies.includes(b)) { ARM.agarre = null; return; }
  const meta = vadd(miraOjo(), vscale(miraDir(), A.dist));   // (adelante de los ojos del personaje, no de la cámara libre)
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
  const h = raycast(miraOjo(), miraDir(), 50, JUG.vehiculo ? JUG.vehiculo.b : null);
  if (!h || !h.body || h.body.estatico || h.body.noGrab) return;
  let b = h.body; if (b.npc && typeof npcAgarrarRag === 'function') b = npcAgarrarRag(b, h.p);   // (un NPC vivo: muñeco de trapo)
  if (b.obj) redReclamar(b.obj); b.frozen = false; b.wake();
  const camQ = Quat.axis(0, 1, 0, JUG.yaw);
  ARM.agarre = { b, dist: h.t, rl: b.q.conj().rot(vsub(h.p, b.pos)), qrel: camQ.conj().mul(b.q), ini: agarreInicio(b) };
  b.held = true; if (b.obj && b.obj.veh) b.obj.veh.agarrado = true;
  vistaSujeta(true);
}
// la vista del arma mientras sostiene algo (la pistola física y la de gravedad: "sujeta" en bucle) y al soltar
function vistaSujeta(si) {
  const D = DEF_ARMAS[ARM.lista[ARM.i]]; if (!D || !ARM.v) return;
  if (si && D.sujeta) vistaTocar(ARM.v, D.sujeta, { loop: true });
  else if (!si && D.quieto) { vistaTocar(ARM.v, D.quieto, { loop: true }); if (D.sSuelta) sonar(D.sSuelta, null, 0.5); }
}
function soltarAgarre(congelar) {
  const A = ARM.agarre; if (!A) return;
  A.b.held = false; if (A.b.obj && A.b.obj.veh) A.b.obj.veh.agarrado = false;
  if (congelar) { A.b.frozen = true; A.b.vel.set(0, 0, 0); A.b.ang.set(0, 0, 0); efectoCongelar(A.b); sonar('Click', null, 0.6); }
  else A.b.wake();
  ARM.agarre = null; vistaSujeta(false); ENT.rotar = false;
}
// dónde estaba lo que se agarra (con la pistola de física o la de gravedad): un toque lo devuelve ahí, como estaba
const agarreInicio = (b) => ({ p: b.pos.clone(), q: b.q.clone(), frozen: !!b.frozen });
function volverAgarre() {
  const G = ARM.agarre || ARM.grav; if (!G || !G.ini) return false;
  const b = G.b, ini = G.ini;
  if (ARM.agarre) soltarAgarre(false); else soltarGrav();
  b.pos.copy(ini.p); b.q.copy(ini.q); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.frozen = ini.frozen; b.wake(); if (b.updateWorld) b.updateWorld();
  if (b.obj && typeof redObjeto === 'function') redObjeto(b.obj);
  efectoCongelar(b); sonar('Click', null, 0.6); return true;
}
// ---------------- pistola de gravedad ----------------
function gravPrimario() {
  const D = DEF_ARMAS.GravityGun, sL = () => sonar(azarDe(D.sF), null, 0.7), f = miraDir();
  if (ARM.grav) { const b = ARM.grav.b; soltarGrav(true); b.vel.addS(f, Math.min(50, 2500 / Math.max(10, b.mass))); sL(); return; }
  const h = raycast(miraOjo(), f, 10, null);
  if (h && h.body && h.body.verity) { verEmpujon(h.body.verity, vadd(vscale(f, 14), v3(0, 3, 0))); sL(); return; }
  if (h && h.body && h.body.persona && (h.body.persona.npc || h.body.persona.npcRem) && !h.body.persona.rag && typeof npcTumbar === 'function') { npcTumbar(h.body.persona, vadd(vscale(f, 14), v3(0, 4, 0)), 0); sL(); return; }   // (un NPC: sale volando como muñeco)
  if (h && h.body && h.body.dynamic) { h.body.wake(); h.body.vel.addS(f, Math.min(50, 1500 / Math.max(10, h.body.mass))); sL(); natEmpujon(h.body); return; }
  sonar(D.sVacio, null, 0.6);   // (nada que empujar: en seco, como en HL2)
}
function gravSecundario() {
  if (ARM.grav) { soltarGrav(); return; }
  const h = raycast(miraOjo(), miraDir(), 25, null);
  if (h && h.body && h.body.npc && typeof npcAgarrarRag === 'function') h.body = npcAgarrarRag(h.body, h.p);   // (un NPC vivo: muñeco de trapo)
  if (h && h.body && !h.body.estatico && h.body.mass < 2000) { if (h.body.obj) redReclamar(h.body.obj); h.body.frozen = false; ARM.grav = { b: h.body, ini: agarreInicio(h.body) }; h.body.held = true; h.body.wake(); sonar(DEF_ARMAS.GravityGun.sAgarra, null, 0.6); vistaSujeta(true); }
  else sonar(DEF_ARMAS.GravityGun.sVacio, null, 0.5);
}
// (lanzado: la vista vuelve a quieto sin el sonido de soltar)
function soltarGrav(lanzado) { if (ARM.grav) { ARM.grav.b.held = false; ARM.grav.b.wake(); ARM.grav = null; const D = DEF_ARMAS[ARM.lista[ARM.i]]; if (lanzado && D && D.quieto && ARM.v) vistaTocar(ARM.v, D.quieto, { loop: true }); else vistaSujeta(false); } }
function gravPaso(dt) {
  const G = ARM.grav; if (!G) return;
  const b = G.b; if (!PH.bodies.includes(b)) { ARM.grav = null; return; }
  const meta = vadd(miraOjo(), vscale(miraDir(), 2.5 + b.r));
  b.vel.copy(vsub(meta, b.pos).scale(Math.min(1 / dt, 12))); b.ang.scale(0.8); b.held = true; b.wake();
}
// ---------------- cámara de fotos ----------------
function sacarFoto() {
  sonar('Click', null, 0.8); JUEGO.foto = 2;
}
// ---------------- cada cuadro ----------------
// las de fuego del juego (las que se apuntan; el rifle de francotirador tiene su mira telescópica)
const armaDeFuego = (D) => !!D && (D.tipo === 'bala' || D.tipo === 'perdigones') && !D.mira && !!D.nodo;
function armasPaso(dt) {
  ARM.t -= dt; if (ARM.ocup > 0) ARM.ocup -= dt;
  { const D0 = DEF_ARMAS[ARM.lista[ARM.i]], si = ARM.apunta && armaDeFuego(D0) && !(ARM.recargando > 0) && !(ARM.ocup > 0 && !(ARM.apK > 0.02)) && !JUG.tercera && JUG.vivo && !JUG.vehiculo && !UI.abierto ? 1 : 0;
    ARM.apK = (ARM.apK || 0) + (si - (ARM.apK || 0)) * Math.min(1, dt * 14); if (ARM.apK < 0.002 && !si) ARM.apK = 0; }   // (entra y sale en ~0,2 s)
  if (ARM.recargando > 0) { ARM.recargando -= dt; if (ARM.recargando <= 0) { const n = ARM.lista[ARM.i]; ARM.balas[n] = DEF_ARMAS[n].car; hudArma(); } }
  if (ARM.barraT > 0) { ARM.barraT -= dt; if (ARM.barraT <= 0) { $('barra').classList.add('oc'); $('arribaDe').style.visibility = ''; } }
  if (ARM.golpeT > 0) { ARM.golpeT -= dt; if (ARM.golpeT <= 0) golpeAplicar(ARM.golpeD); }
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  // (las que tienen animación de quieto, como la palanca, vuelven a ella cuando termina la otra)
  if (ARM.v && D.quieto && ARM.v.clip && !ARM.v.loop && ARM.v.t >= ARM.v.clip.d) {
    if (D.tras && ARM.v.clip === DATA.anPorNombre[D.fuego]) vistaTocar(ARM.v, D.tras); else vistaTocar(ARM.v, D.quieto, { loop: true });   // (la escopeta: después del tiro, la corredera)
  }
  // (el celular en la compu: clic para usarlo con el mouse)
  if (D.tipo === 'celu' && !ENT.tactil && ENT.bloqueado && ENT.disparo && !CELM.foco && !UI.abierto) { ENT.disparo = false; celmFoco(true); }
  // (tirado como muñeco o en cuatro patas no se usan armas; en el creador el clic elige y pone)
  if (!UI.abierto && JUG.vivo && !JUG.vehiculo && !NAT.rag && !NAT.scp && !(CREA.on && creadorPaso())) {
    if (D.tipo === 'fisica') {
      // en el celular un toque agarra y otro suelta (no hay que mantener); con el mouse, mantener como siempre
      const flanco = ENT.disparo && !ARM.fisAnt; ARM.fisAnt = ENT.disparo;
      if (ENT.tactil) { if (flanco) { if (ARM.agarre) soltarAgarre(false); else agarrarFisica(); } }
      // (después de congelar algo hay que soltar el clic para agarrar otra vez: si no, lo volvía a agarrar y descongelar)
      else { if (!ENT.disparo) ARM.trasCongelar = false; if (ENT.disparo && !ARM.agarre && !ARM.trasCongelar) agarrarFisica(); if (!ENT.disparo && ARM.agarre) soltarAgarre(false); }
      if (ARM.agarre && ENT.disparo2) { soltarAgarre(true); ENT.disparo2 = false; ARM.trasCongelar = true; }
      else if (!ARM.agarre && ENT.disparo2) { ENT.disparo2 = false; const h = raycast(miraOjo(), miraDir(), 50, null); if (h && h.body && h.body.frozen && !h.body.estatico) { h.body.frozen = false; h.body.wake(); aviso('Descongelado', 1); } }
      if (ARM.agarre && ENT.rueda) { ARM.agarre.dist = clamp(ARM.agarre.dist - ENT.rueda * 0.6, 1.5, 50); }
      ARM.rotando = !!ARM.agarre && (ENT.teclas.has('KeyE') || ENT.rotar);
      if (ARM.agarre && ENT.pulsoDist) { ARM.agarre.dist = clamp(ARM.agarre.dist + ENT.pulsoDist, 1.5, 50); ENT.pulsoDist = 0; }
      if (ENT.tactil !== ARM.fbVis || !!ARM.agarre !== ARM.fbAg) { ARM.fbVis = ENT.tactil; ARM.fbAg = !!ARM.agarre; $('fisBotones').classList.toggle('oc', !(ENT.tactil && ARM.agarre)); }
    } else {
      if (ENT.disparo && D.tipo !== 'gmswep') { disparar(); if (D.semi) ENT.disparo = ENT.tactil ? ENT.disparo : false; }
      if (ENT.disparo2 && D.tipo !== 'gmswep') {
        ENT.disparo2 = false;
        if (D.tipo === 'grav') gravSecundario();
        else if (D.tipo === 'tool' && typeof herramientaUsar === 'function') herramientaUsar(true);
        else if (D.mira) { ARM.zoom = !ARM.zoom; }
        else if (armaDeFuego(D)) { ARM.apunta = !ARM.apunta; if (ARM.apunta && !(ARM.apK > 0.02)) ARM.apTok = (ARM.apTok || 0) + 1; }   // (apuntar: el arma al centro, la vista más cerrada)
      }
      if (ENT.rueda && !ARM.agarre) { elegirArma((ARM.i + (ENT.rueda > 0 ? 1 : -1) + ARM.lista.length) % ARM.lista.length); }
    }
  }
  ENT.rueda = 0;
  fisicaPaso(dt); gravPaso(dt);
  if ((ARM.agarre || ARM.grav) && D.sSosten) bucle('sosten', D.sSosten, null, 0.35, 1);
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
  if ((!ARM.v && !celmEnMano() && !((DEF_ARMAS[ARM.lista[ARM.i]] || {}).tipo === 'gmswep' && !(DEF_ARMAS[ARM.lista[ARM.i]] || {}).nodo)) || JUG.tercera || HCAM.ver || !JUG.vivo || JUG.vehiculo || ARM.zoom || CIC.vic || CIC.camOn || EDA.on || NOC.cam !== null || NOC.susto) return false;
  if (JUG.cuerpo && JUG.cuerpo.emote && JUG.cuerpo.emote !== 'Patada') return false;   // (haciendo un emote en primera persona se ve el cuerpo, sin el arma en la mano de la cámara)
  if (celmEnMano()) return celmVistaDibujar();   // (el celular: la mano que lo sostiene, celumano.js)
  { const D = DEF_ARMAS[ARM.lista[ARM.i]] || {}; if (D.tipo === 'gmswep' && !D.nodo) return typeof gmaVistaDibujar === 'function' && gmaVistaDibujar(); }   // (un arma de un addon de GMod con su propio ViewModel)
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
  // (de la boca del arma: con la cámara libre o en tercera persona, la del arma en la mano del personaje)
  const o = miraOjo(), f = miraDir(), p0 = bocaArma(f) || vadd(o, v3(0, -0.2, 0)), p1 = vadd(A.b.pos, A.b.q.rot(A.rl));
  const n = 16, c = [0.35, 0.78, 1, 0.95];   // (celeste, como el de la Physics Gun de GMod)
  let prev = p0;
  const mid = vadd(o, vscale(f, A.dist * 0.5));
  for (let i = 1; i <= n; i++) {
    const t = i / n, a = vadd(vscale(p0, (1 - t) * (1 - t)), vadd(vscale(mid, 2 * t * (1 - t)), vscale(p1, t * t)));
    linea(prev, a, c); prev = a;
  }
}
