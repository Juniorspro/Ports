// ---------------- editor de animaciones (emotes propios) y cinemáticas ----------------
// Un personaje tuyo parado delante; la cámara gira alrededor (arrastrar en el vacío, rueda o pellizco para acercar).
// Tocás una articulación (los puntos) y la girás arrastrando (como una bola: hacia donde arrastrás) o con tres
// deslizadores; la cadera además sube, baja y se corre. La línea de tiempo tiene cuadros clave: lo que cambiás en un
// momento sin clave crea una ahí (con la pose que había); entre claves la pose se mezcla suave. Se puede empezar de
// cero (parado) o de cualquier emote del juego o tuyo, copiar un lado al otro (espejo), y grabar la cámara en cada
// clave para ver la animación como cinemática. Se guarda como emote ("Míos"), se exporta (.rbanim) y se publica en la
// tienda, donde los demás la bajan; en una sala los demás la ven aunque no la tengan (la piden).
const EDA = { on: false, el: null, P: null, keys: [], dur: 3, t: 0, play: false, loop: true, cat: 'baile', nombre: '', id: null, sel: 'RightArm',
  cam: { yaw: 0, pit: 0.15, dist: 3.4 }, cine: false, grabaCam: false, idx: null, puntos: null, arr: null, centro: v3(), tGuard: 0 };
const EDA_FPS = 20;
const EDA_HUESOS = HUESOS_ANIM_RB;
const EDA_ESPEJO = (n) => (n.startsWith('Left') ? 'Right' + n.slice(4) : n.startsWith('Right') ? 'Left' + n.slice(5) : null);
const _ea = new Quat(), _eb = new Quat(), _ec = new Quat();

// ---------------- abrir y cerrar ----------------
function edaAbrir(id) {
  if (JUEGO.estado !== 'juego' || EDA.on) return;
  cerrarPaneles(); edaPanel();
  EDA.on = true; UI.abierto = 'eda'; soltarPuntero(); document.body.classList.add('edaOn'); EDA.el.classList.remove('oc');
  // el muñeco: tu personaje, delante tuyo y mirándote, en el piso
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), p = vadd(JUG.pos, vscale(f, 3));
  const y = pisoBajo(v3(p.x, JUG.pos.y + 1, p.z), 0); p.y = (y === null ? JUG.pos.y - 1 : y) + 1;
  EDA.P = crearPersona(JUG.skinMod || PREFS.skin, PREFS.gorro, { nombre: '' }); EDA.P.pos.copy(p); EDA.P.yaw = JUG.yaw + Math.PI; EDA.P.suelo = true;
  EDA.centro.copy(p); EDA.terc = JUG.tercera; JUG.tercera = false;
  EDA.cam.yaw = EDA.P.yaw; EDA.cam.pit = 0.12; EDA.cam.dist = 3.4;
  EDA.idx = emoIndices(EDA.P, { b: EDA_HUESOS });
  animarPersona(EDA.P, 0);
  EDA.base = edaPoseActual(); // (la pose de parado: el punto de partida)
  EDA.P.poseExtra = edaPoseAplicar;
  if (id && edaCargar(id)) { /* ya cargada */ } else edaNueva();
  edaDibujar();
}
function edaCerrar() {
  if (!EDA.on) return;
  EDA.on = false; EDA.play = false; EDA.cine = false; if (EDA.P) { borrarPersona(EDA.P); EDA.P = null; } if (EDA.terc !== undefined) { JUG.tercera = EDA.terc; EDA.terc = undefined; }
  EDA.el.classList.add('oc'); document.body.classList.remove('edaOn'); if (UI.abierto === 'eda') UI.abierto = null;
}
// ---------------- la pose: claves → huesos ----------------
// pose = { q: { hueso: [x, y, z, w] }, h: [x, y, z] (lugar de la cadera, en el marco del modelo) }
function edaPoseActual() {
  const P = EDA.P, md = P.md, q = {};
  EDA_HUESOS.forEach((n, k) => { const i = EDA.idx[k]; if (i >= 0) q[n] = md.r[i].slice(); });
  const hi = EDA.idx[0]; return { q, h: hi >= 0 ? md.p[hi].slice() : [0, 0, 0] };
}
const edaCopia = (po) => ({ q: Object.fromEntries(Object.entries(po.q).map(([k, v]) => [k, v.slice()])), h: po.h.slice(), cam: po.cam ? Object.assign({}, po.cam) : null });
const suave = (x) => x * x * (3 - 2 * x);
// la pose en el tiempo t: entre dos claves, mezcla suave (y con vuelta a la primera si se repite)
function edaPoseEn(t) {
  const K = EDA.keys; if (!K.length) return EDA.base;
  if (K.length === 1) return K[0];
  let a = null, b = null, ta = 0, tb = 0;
  for (let i = 0; i < K.length; i++) if (K[i].t <= t + 1e-6) a = i;
  if (a === null) { a = K.length - 1; b = 0; ta = K[a].t - EDA.dur; tb = K[0].t; if (!EDA.loop) return K[0]; }
  else if (a === K.length - 1) { if (!EDA.loop) return K[a]; b = 0; ta = K[a].t; tb = K[0].t + EDA.dur; }
  else { b = a + 1; ta = K[a].t; tb = K[b].t; }
  const u = tb - ta > 1e-6 ? suave(clamp((t - ta) / (tb - ta), 0, 1)) : 0;
  return edaMezcla(K[a], K[b], u);
}
function edaMezcla(A, B, u) {
  const q = {};
  for (const n of Object.keys(A.q)) { const x = A.q[n], y = B.q[n] || x; _ea.set(x[0], x[1], x[2], x[3]); _eb.set(y[0], y[1], y[2], y[3]); _ea.slerpTo(_eb, u); q[n] = [_ea.x, _ea.y, _ea.z, _ea.w]; }
  const h = A.h.map((v, i) => v + (B.h[i] - v) * u);
  let cam = null; if (A.cam && B.cam) { cam = {}; for (const k of ['yaw', 'pit', 'dist']) cam[k] = A.cam[k] + (B.cam[k] - A.cam[k]) * u; }
  return { q, h, cam };
}
// (lo llama animarPersona después de la animación de parado: la pose del editor en el momento de la línea de tiempo)
function edaPoseAplicar(P) {
  if (!EDA.on || P !== EDA.P) return;
  const po = edaPoseEn(EDA.t), md = P.md;
  EDA_HUESOS.forEach((n, k) => { const i = EDA.idx[k], v = po.q[n]; if (i >= 0 && v) { const r = md.r[i]; r[0] = v[0]; r[1] = v[1]; r[2] = v[2]; r[3] = v[3]; } });
  const hi = EDA.idx[0]; if (hi >= 0) { const p = md.p[hi]; p[0] = po.h[0]; p[1] = po.h[1]; p[2] = po.h[2]; }
  P.pos.copy(EDA.centro); P.vel.set(0, 0, 0); P.suelo = true; P.emote = null;
  md.sucio = true;
}
// la clave donde se edita: la que está en el tiempo de ahora o una nueva ahí con la pose que había
function edaClaveAhora() {
  const t = Math.round(EDA.t * EDA_FPS) / EDA_FPS;
  let k = EDA.keys.find((x) => Math.abs(x.t - t) < 0.5 / EDA_FPS);
  if (!k) { k = Object.assign(edaCopia(edaPoseEn(t)), { t }); EDA.keys.push(k); EDA.keys.sort((a, b) => a.t - b.t); }
  EDA.t = k.t; return k;
}
function edaNueva() { EDA.keys = [Object.assign(edaCopia(EDA.base), { t: 0 })]; EDA.dur = 3; EDA.t = 0; EDA.loop = true; EDA.cat = 'baile'; EDA.nombre = ''; EDA.id = null; EDA.play = false; }
// empezar desde un emote: claves cada 0,25 s (o el clip entero si es corto)
function edaDesde(id) {
  const C = emoClip(id); if (!C) { if (DATA.emotes.includes(id)) aviso(T('eda.clasico'), 2.5); return; }
  const P = EDA.P, md = P.md, idx = emoIndices(P, C), paso = C.d > 6 ? 0.5 : 0.25, K = [];
  for (let t = 0; t <= C.d + 1e-6; t += paso) {
    const f = Math.min(C.nf - 1, Math.round(t * C.fps)), po = edaCopia(EDA.base);
    C.b.forEach((n, k) => { if (!po.q[n] && n !== 'Hips') return; const o = (f * C.b.length + k) * 4; po.q[n] = [C.r[o] / 32767, C.r[o + 1] / 32767, C.r[o + 2] / 32767, C.r[o + 3] / 32767]; });
    const hi = idx[C.b.indexOf('Hips')]; if (C.h && hi >= 0) { const b0 = P.D.sub[hi].p; po.h = [0, 1, 2].map((c) => b0[c] + C.h[f * 3 + c] / 1000); }
    K.push(Object.assign(po, { t: +t.toFixed(3) }));
  }
  EDA.keys = K; EDA.dur = +(C.d).toFixed(2); EDA.loop = C.loop; EDA.t = 0; EDA.nombre = (C.n || '') + ' 2'; EDA.id = null;
  const x = emoLista().find((e) => e.id === id); EDA.cat = x && ['baile', 'gesto', 'accion'].includes(x.cat) ? x.cat : 'baile';
  edaDibujar();
}
// una tuya guardada: con sus claves si las tiene; si no (bajada de la tienda), desde el clip
function edaCargar(id) {
  const v = INST.anims[id]; if (!v) return false;
  if (v.edit && Array.isArray(v.edit.keys) && v.edit.keys.length) {
    EDA.keys = v.edit.keys.map((k) => Object.assign(edaCopia(k), { t: k.t })); EDA.dur = v.edit.dur || (v.clip.nf - 1) / v.clip.fps; EDA.loop = !!v.clip.loop; EDA.t = 0;
  } else edaDesde('u:' + id);
  EDA.nombre = v.nombre; EDA.cat = v.cat || 'baile'; EDA.id = /^local-/.test(id) ? id : null; return true;
}
// ---------------- girar huesos ----------------
const edaI = (n) => EDA.idx[EDA_HUESOS.indexOf(n)];
function edaRotPadre(n) { const i = edaI(n), pa = EDA.P.D.sub[i].pa; return pa >= 0 ? m4quat(EDA.P.md.W[pa]).norm() : new Quat(); }
// girar el hueso elegido con una rotación en el mundo (la de la bola al arrastrar)
function edaGirarMundo(dq) {
  const n = EDA.sel, k = edaClaveAhora(), v = k.q[n]; if (!v) return;
  const Wp = edaRotPadre(n); _ea.set(v[0], v[1], v[2], v[3]);
  const nq = Wp.clone().conj().mul(dq).mul(Wp).mul(_ea).norm(); k.q[n] = [nq.x, nq.y, nq.z, nq.w];
  edaTocado();
}
// los deslizadores: giro en grados respecto de la pose de parado, en los ejes del hueso
function edaEuler(n) {
  const k = edaPoseEn(EDA.t), v = k.q[n], b = EDA.base.q[n]; if (!v || !b) return [0, 0, 0];
  const d = _ea.set(b[0], b[1], b[2], b[3]).conj().mul(_eb.set(v[0], v[1], v[2], v[3])).norm(); // (conj da uno nuevo)
  // (X Y Z intrínsecos)
  const sx = 2 * (d.w * d.x - d.y * d.z), cx = 1 - 2 * (d.x * d.x + d.y * d.y), sy = clamp(2 * (d.w * d.y + d.z * d.x), -1, 1), sz = 2 * (d.w * d.z - d.x * d.y), cz = 1 - 2 * (d.y * d.y + d.z * d.z);
  return [Math.atan2(sx, cx), Math.asin(sy), Math.atan2(sz, cz)].map((a) => Math.round(a * 180 / Math.PI));
}
function edaPonerEuler(n, e) {
  const k = edaClaveAhora(), b = EDA.base.q[n]; if (!b) return;
  const r = e.map((a) => a * Math.PI / 180), qx = Quat.axis(1, 0, 0, r[0]), qy = Quat.axis(0, 1, 0, r[1]), qz = Quat.axis(0, 0, 1, r[2]);
  _ea.set(b[0], b[1], b[2], b[3]); const q = _ea.clone().mul(qx).mul(qy).mul(qz).norm(); k.q[n] = [q.x, q.y, q.z, q.w];
  edaTocado(true);
}
function edaCadera(c, v) { const k = edaClaveAhora(); k.h[c] = EDA.base.h[c] + v; edaTocado(true); }
// espejo: el lado elegido pasa al otro. Se refleja el giro de ese hueso respecto de su pose de enlace (que es simétrica
// en el esqueleto), en el marco del personaje (x → -x), y se pone sobre la pose de enlace del otro lado
function edaEspejo() {
  const n = EDA.sel, m = EDA_ESPEJO(n); if (!m) { aviso(T('eda.sinEspejo'), 1.5); return; }
  const k = edaClaveAhora(), P = EDA.P, inn = edaI(n), im = edaI(m), rw = P.D.rw; if (!k.q[m] || !rw || !rw[inn] || !rw[im]) return;
  P.md.actualizar();
  const Ry = Quat.axis(0, 1, 0, P.yaw), Rc = Ry.clone().conj();
  const Mn = Rc.clone().mul(m4quat(P.md.W[inn]).norm()), Dn = Mn.mul(rw[inn].conj()); // (giro respecto del enlace, en el personaje)
  // (reflejado: x → -x en el marco del esqueleto, que puede estar un poco girado dentro del modelo: el de la cadera)
  const Rs = rw[edaI('Hips')] || new Quat(), Ds = Rs.conj().mul(Dn).mul(Rs), Dm = Rs.clone().mul(new Quat(Ds.x, -Ds.y, -Ds.z, Ds.w)).mul(Rs.conj());
  const Wm = Ry.clone().mul(Dm).mul(rw[im]), pa = P.D.sub[im].pa, Wp = pa >= 0 ? m4quat(P.md.W[pa]).norm() : new Quat();
  const L = Wp.conj().mul(Wm).norm(); k.q[m] = [L.x, L.y, L.z, L.w];
  edaTocado(); aviso(T('eda.espejado'), 1);
}
function edaReiniciarHueso() { const k = edaClaveAhora(), n = EDA.sel; if (EDA.base.q[n]) k.q[n] = EDA.base.q[n].slice(); if (n === 'Hips') k.h = EDA.base.h.slice(); edaTocado(true); }
function edaTocado(sinSliders) { EDA.cambio = true; edaLinea(); if (!sinSliders) edaSliders(); }
// ---------------- cámara: alrededor del muñeco (o la grabada, en la cinemática) ----------------
function edaCamara(out) {
  if (!EDA.on || !EDA.P) return;
  let c = EDA.cam; if (EDA.cine) { const po = edaPoseEn(EDA.t); if (po.cam) c = po.cam; }
  const m = vadd(EDA.centro, v3(0, 0.05, 0)), d = clamp(c.dist, 1.2, 12), pit = clamp(c.pit, -1.2, 1.3);
  const p = vadd(m, v3(Math.sin(c.yaw) * Math.cos(pit) * d, Math.sin(pit) * d, Math.cos(c.yaw) * Math.cos(pit) * d));
  out.pos.copy(p); out.q.copy(qVer(p, m));
}
// ---------------- cada cuadro: reproducir, puntos de las articulaciones ----------------
function edaPaso(dt) {
  if (!EDA.on || !EDA.P) return;
  if (EDA.play) { EDA.t += dt; if (EDA.t > EDA.dur) { if (EDA.loop || EDA.cine) EDA.t %= EDA.dur; else { EDA.t = EDA.dur; EDA.play = false; edaBotones(); } } edaLinea(); }
  edaPuntos();
}
function edaPuntos() {
  const P = EDA.P, cont = EDA.puntos; if (!cont || !P) return;
  if (!cont.childElementCount) cont.innerHTML = EDA_HUESOS.map((n) => `<i data-hu="${n}" title="${n}"></i>`).join('');
  const vp = R.vpMundo, W = R.cv.clientWidth, H = R.cv.clientHeight, ver = !EDA.play && !EDA.cine;
  cont.style.display = ver ? '' : 'none'; if (!ver || !vp) return;
  P.md.actualizar();
  for (const el of cont.children) {
    const i = edaI(el.dataset.hu), M = i >= 0 ? P.md.W[i] : null; if (!M) { el.style.display = 'none'; continue; }
    const x = M[12], y = M[13], z = M[14], cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0.05) { el.style.display = 'none'; continue; }
    el.style.display = ''; el.style.transform = `translate(${((cx / cw * 0.5 + 0.5) * W).toFixed(1)}px,${((0.5 - cy / cw * 0.5) * H).toFixed(1)}px)`;
    el.classList.toggle('sel', el.dataset.hu === EDA.sel);
  }
}
// ---------------- guardar, exportar, publicar ----------------
// el clip: cada cuadro a 20 por segundo, rotaciones locales (int16) y la cadera respecto de la de reposo (mm)
function edaClip() {
  const nf = Math.max(2, Math.round(EDA.dur * EDA_FPS) + 1), b = EDA_HUESOS.filter((n) => EDA.base.q[n]), R16 = new Int16Array(nf * b.length * 4), H16 = new Int16Array(nf * 3);
  const hi = edaI('Hips'), b0 = hi >= 0 ? EDA.P.D.sub[hi].p : [0, 0, 0];
  for (let f = 0; f < nf; f++) {
    const po = edaPoseEn(Math.min(EDA.dur, f / EDA_FPS) - (f === nf - 1 && EDA.loop ? 1e-4 : 0));
    b.forEach((n, k) => { let v = po.q[n]; const o = (f * b.length + k) * 4; if (f && R16[o - b.length * 4 + 3] * v[3] + R16[o - b.length * 4] * v[0] + R16[o - b.length * 4 + 1] * v[1] + R16[o - b.length * 4 + 2] * v[2] < 0) v = v.map((x) => -x);
      for (let c = 0; c < 4; c++) R16[o + c] = Math.round(clamp(v[c], -1, 1) * 32767); });
    for (let c = 0; c < 3; c++) H16[f * 3 + c] = Math.round(clamp((po.h[c] - b0[c]) * 1000, -32767, 32767));
  }
  const b64 = (a) => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  return { fps: EDA_FPS, nf, b, r: b64(R16), h: b64(H16), loop: EDA.loop };
}
function edaDatos() {
  return { formato: 'rezobox-anim', nombre: (EDA.nombre || '').trim() || T('eda.sinNombre'), autor: PREFS.nombre, descripcion: '', cat: EDA.cat, foto: EDA.foto || null, clip: edaClip() };
}
// una foto chica del muñeco en la pose de ahora (para la tarjeta del emote)
function edaFoto(listo) {
  const P = EDA.P; P.md.actualizar(); const hi = edaI('Hips'), M = P.md.W[hi], vp = R.vpMundo;
  const pt = (x, y, z) => { const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; return [(vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw, (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw]; };
  JUEGO.fotoCb = () => {
    try {
      const c0 = pt(M[12], M[13], M[14]), c1 = pt(M[12], M[13] + 1.1, M[14]), W = R.cv.width, H = R.cv.height;
      const lado = Math.abs(c1[1] - c0[1]) * H * 1.5, cx = (c0[0] * 0.5 + 0.5) * W, cy = (0.5 - c0[1] * 0.5) * H;
      const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
      x.drawImage(R.cv, cx - lado / 2, cy - lado / 2 - lado * 0.05, lado, lado, 0, 0, 160, 160);
      let f = c.toDataURL('image/webp', 0.8); if (!/^data:image\/webp/.test(f) || f.length > 58000) f = c.toDataURL('image/jpeg', 0.75);
      EDA.foto = f.length < 58000 ? f : null;
    } catch (e) { EDA.foto = null; }
    listo && listo();
  };
  JUEGO.foto = 2;
}
function edaGuardar(despues) {
  EDA.play = false; EDA.cine = false; edaBotones();
  edaFoto(() => {
    const v = validarRB(edaDatos()); if (typeof v === 'string') { aviso(v, 3); return; }
    const id = EDA.id || 'local-' + Math.random().toString(36).slice(2, 10); EDA.id = id;
    v.id = id; v.edit = { keys: EDA.keys.map((k) => Object.assign(edaCopia(k), { t: k.t })), dur: EDA.dur };
    INST.anims[id] = v; guardarLS('rb_instalados', INST); emoOlvidar('u:' + id); EDA.cambio = false;
    aviso(T('eda.guardado'), 2); despues && despues(v);
  });
}
function edaPublicar() {
  if (!PREFS.nombre) { aviso(T('b.nombre'), 2); return; }
  edaGuardar(async (v) => {
    const r = await tiendaPublicar(Object.assign({}, v, { id: undefined, edit: undefined }));
    if (!r || !r.id) { aviso(T('errRed'), 2); return; }
    // queda la publicada (con sus claves, para seguir editándola como copia) en lugar de la local
    if (INST.anims[r.id] && INST.anims[v.id]) { INST.anims[r.id].edit = INST.anims[v.id].edit; delete INST.anims[v.id]; guardarLS('rb_instalados', INST); EDA.id = null; }
    aviso(`${T('publicado')} ${T('clave')} ${r.clave}`, 6);
  });
}
function edaExportar() { const v = validarRB(edaDatos()); if (typeof v === 'string') { aviso(v, 3); return; } descargarArchivo(v); }
// ---------------- el panel ----------------
function edaPanel() {
  if (EDA.el) return;
  const el = EDA.el = document.createElement('div'); el.id = 'edaPan'; el.className = 'oc';
  el.innerHTML = `<div class="edaPuntos"></div><div class="edaVista"></div>
    <div class="edaArriba"><b>${icoHTML('ico:animacion')}<span class="edaTit"></span></b><input class="edaNom" maxlength="40" spellcheck="false">
      <select class="edaCat"></select><select class="edaDesde"></select><span class="edaEsp"></span>
      <button data-ea="verity" class="edaVer" data-vcr="1"></button><button data-ea="guardar"></button><button data-ea="publicar" class="edaG"></button><button data-ea="exportar" class="edaChico"></button><button data-ea="salir" class="edaChico"></button></div>
    <div class="edaLado"><div class="edaHueso"></div><div class="edaSl"></div><div class="edaBts"></div><div class="edaAyuda"></div></div>
    <div class="edaAbajo"><div class="edaCtl"></div><div class="edaLinea"><div class="edaPista"><div class="edaClaves"></div><i class="edaCursor"></i></div></div></div>`;
  document.body.appendChild(el);
  EDA.puntos = el.querySelector('.edaPuntos');
  el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ea]'); if (b) edaAccion(b.dataset.ea); });
  el.addEventListener('keydown', (ev) => ev.stopPropagation());
  el.querySelector('.edaNom').oninput = (ev) => { EDA.nombre = ev.target.value; };
  el.querySelector('.edaCat').onchange = (ev) => { EDA.cat = ev.target.value; };
  el.querySelector('.edaDesde').onchange = (ev) => { const v = ev.target.value; ev.target.value = ''; if (v === 'nueva') { edaNueva(); edaDibujar(); } else if (v) edaDesde(v); };
  // tocar una articulación la elige; arrastrar desde ella la gira; arrastrar en el vacío mueve la cámara
  const vista = el.querySelector('.edaVista'); let arr = null;
  const abajo = (ev) => {
    const hu = ev.target.closest && ev.target.closest('[data-hu]');
    if (hu) { EDA.sel = hu.dataset.hu; edaDibujar(); }
    arr = { x: ev.clientX, y: ev.clientY, hueso: !!hu, id: ev.pointerId, toques: (arr && arr.toques) || new Map() };
    arr.toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  };
  const mueve = (ev) => {
    if (!arr) return; const T0 = arr.toques.get(ev.pointerId); if (!T0) return;
    // dos dedos: pellizco = acercar
    if (arr.toques.size >= 2) { const [a, b] = [...arr.toques.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); T0.x = ev.clientX; T0.y = ev.clientY; const [c, d] = [...arr.toques.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y); if (d0 > 10) EDA.cam.dist = clamp(EDA.cam.dist * d0 / d1, 1.2, 12); return; }
    const dx = ev.clientX - T0.x, dy = ev.clientY - T0.y; T0.x = ev.clientX; T0.y = ev.clientY;
    if (arr.hueso && !EDA.play) {
      // la bola: arrastrar hacia la derecha gira alrededor del "arriba" de la cámara, hacia abajo alrededor de su "derecha"
      const L = Math.hypot(dx, dy); if (L < 0.5) return;
      const ax = vadd(vscale(CAM.arr, dx), vscale(CAM.der, dy)).norm(), dq = Quat.axis(ax.x, ax.y, ax.z, L * 0.012);
      edaGirarMundo(dq);
    } else { EDA.cam.yaw -= dx * 0.008; EDA.cam.pit = clamp(EDA.cam.pit + dy * 0.006, -1.2, 1.3); }
  };
  const arriba = (ev) => { if (arr) { arr.toques.delete(ev.pointerId); if (!arr.toques.size) { if (arr.hueso) edaSliders(); arr = null; } } };
  for (const t of [vista, EDA.puntos]) { t.addEventListener('pointerdown', abajo); t.addEventListener('pointermove', mueve); t.addEventListener('pointerup', arriba); t.addEventListener('pointercancel', arriba); }
  vista.addEventListener('wheel', (ev) => { EDA.cam.dist = clamp(EDA.cam.dist * (ev.deltaY > 0 ? 1.1 : 0.9), 1.2, 12); ev.preventDefault(); }, { passive: false });
  // la línea de tiempo: tocar mueve el cursor; arrastrar una clave la corre
  const pista = el.querySelector('.edaPista'); let mov = null;
  const tDe = (ev) => { const r = pista.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * EDA.dur; };
  pista.addEventListener('pointerdown', (ev) => {
    const kd = ev.target.closest('[data-k]'); EDA.play = false; edaBotones();
    mov = kd ? EDA.keys[+kd.dataset.k] : null; EDA.t = mov ? mov.t : Math.round(tDe(ev) * EDA_FPS) / EDA_FPS;
    try { pista.setPointerCapture(ev.pointerId); } catch (e) {} edaLinea(); edaSliders(); ev.preventDefault();
  });
  pista.addEventListener('pointermove', (ev) => {
    if (ev.buttons === 0 && ev.pointerType === 'mouse') return; const t = Math.round(tDe(ev) * EDA_FPS) / EDA_FPS;
    if (mov) { if (!EDA.keys.some((k) => k !== mov && Math.abs(k.t - t) < 0.5 / EDA_FPS)) { mov.t = t; EDA.keys.sort((a, b) => a.t - b.t); } }
    EDA.t = t; edaLinea(); edaSliders();
  });
  pista.addEventListener('pointerup', () => { mov = null; });
}
function edaAccion(a) {
  const [k, v] = a.split(':');
  if (k === 'salir') { if (EDA.cambio && !confirm(T('eda.salirQ'))) return; edaCerrar(); return; }
  if (k === 'guardar') return edaGuardar();
  if (k === 'verity') return verCreaPanel('anim'); // (Verity te arma la animación: la deja acá para tocarla)
  if (k === 'publicar') return edaPublicar();
  if (k === 'exportar') return edaExportar();
  if (k === 'play') { EDA.play = !EDA.play; EDA.cine = false; if (EDA.play && EDA.t >= EDA.dur - 1e-3) EDA.t = 0; }
  else if (k === 'cine') { EDA.cine = !EDA.cine; EDA.play = EDA.cine; if (EDA.cine) EDA.t = 0; }
  else if (k === 'inicio') { EDA.t = 0; EDA.play = false; }
  else if (k === 'clave') { edaClaveAhora(); if (EDA.grabaCam) edaClaveAhora().cam = Object.assign({}, EDA.cam); EDA.cambio = true; }
  else if (k === 'borrar') { const i = EDA.keys.findIndex((x) => Math.abs(x.t - EDA.t) < 0.5 / EDA_FPS); if (i >= 0 && EDA.keys.length > 1) { EDA.keys.splice(i, 1); EDA.cambio = true; } }
  else if (k === 'ant' || k === 'sig') { const L = EDA.keys.map((x) => x.t); const t = k === 'ant' ? [...L].reverse().find((x) => x < EDA.t - 1e-3) : L.find((x) => x > EDA.t + 1e-3); if (t !== undefined) EDA.t = t; EDA.play = false; }
  else if (k === 'dur') { const d = clamp(+v || 3, 0.5, 30); EDA.dur = d; for (const x of EDA.keys) x.t = Math.min(x.t, d); EDA.t = Math.min(EDA.t, d); EDA.cambio = true; }
  else if (k === 'loop') EDA.loop = !EDA.loop;
  else if (k === 'camgr') { EDA.grabaCam = !EDA.grabaCam; if (EDA.grabaCam) { edaClaveAhora().cam = Object.assign({}, EDA.cam); aviso(T('eda.camAyuda'), 3); } }
  else if (k === 'espejo') edaEspejo();
  else if (k === 'rhueso') edaReiniciarHueso();
  else if (k === 'rpose') { const c = edaClaveAhora(); Object.assign(c, edaCopia(EDA.base), { t: c.t }); edaTocado(); }
  edaDibujar();
}
function edaDibujar() {
  if (!EDA.el) return; const el = EDA.el;
  el.querySelector('.edaTit').textContent = T('eda.tit');
  const nom = el.querySelector('.edaNom'); nom.placeholder = T('nombre'); if (document.activeElement !== nom) nom.value = EDA.nombre;
  el.querySelector('.edaCat').innerHTML = CATS_ANIM_RB.map((c) => `<option value="${c}"${c === EDA.cat ? ' selected' : ''}>${esc(T('emo.' + c))}</option>`).join('');
  el.querySelector('.edaDesde').innerHTML = `<option value="">${esc(T('eda.desde'))}</option><option value="nueva">${esc(T('eda.nueva'))}</option>`
    + emoLista().filter((e) => e.cat !== 'clasico').map((e) => `<option value="${esc(e.id)}">${esc(e.n)}</option>`).join('');
  const bt = (k, g, t, cl) => `<button data-ea="${k}" class="${cl || ''}">${g ? glifo(g) : ''}${t ? `<span>${esc(t)}</span>` : ''}</button>`;
  el.querySelector('[data-ea=guardar]').innerHTML = glifo('guardar') + `<span>${esc(T('guardar'))}</span>`;
  el.querySelector('[data-ea=verity]').innerHTML = icoHTML('ico:verity') + '<span>Verity</span>'; el.querySelector('[data-ea=verity]').title = T('ver.cr.t.anim');
  el.querySelector('[data-ea=publicar]').innerHTML = glifo('subir') + `<span>${esc(T('publicar'))}</span>`;
  el.querySelector('[data-ea=exportar]').innerHTML = glifo('bajar'); el.querySelector('[data-ea=exportar]').title = T('exportar');
  el.querySelector('[data-ea=salir]').innerHTML = glifo('no'); el.querySelector('[data-ea=salir]').title = T('cerrar');
  el.querySelector('.edaHueso').innerHTML = `<b>${esc(T('eda.hueso'))}</b><select class="edaSelH">${EDA_HUESOS.map((n) => `<option value="${n}"${n === EDA.sel ? ' selected' : ''}>${esc(edaNomHueso(n))}</option>`).join('')}</select>`;
  el.querySelector('.edaSelH').onchange = (ev) => { EDA.sel = ev.target.value; edaSliders(); };
  el.querySelector('.edaBts').innerHTML = bt('espejo', 'girar', T('eda.espejo')) + bt('rhueso', 'atras', T('eda.rhueso')) + bt('rpose', 'persona', T('eda.rpose'));
  el.querySelector('.edaAyuda').textContent = T(ENT.tactil ? 'eda.ayudaT' : 'eda.ayuda');
  edaSliders(); edaBotones(); edaLinea();
}
const edaNomHueso = (n) => { const k = 'hu.' + n, t = T(k); return t === k ? n : t; };
function edaBotones() {
  const el = EDA.el; if (!el) return;
  const bt = (k, g, t, on) => `<button data-ea="${k}" class="${on ? 'on' : ''}" title="${esc(t)}">${glifo(g)}</button>`;
  el.querySelector('.edaCtl').innerHTML = bt('inicio', 'atras', T('eda.inicio')) + bt('ant', 'atras', T('eda.ant')) + bt('play', EDA.play && !EDA.cine ? 'parar' : 'jugar', T('eda.play'), EDA.play && !EDA.cine)
    + bt('sig', 'adelante', T('eda.sig')) + `<button data-ea="clave" class="edaClaveB" title="${esc(T('eda.clave'))}">${glifo('mas')}<span>${esc(T('eda.clave'))}</span></button>` + bt('borrar', 'basura', T('eda.borrar'))
    + `<label class="edaDur">${esc(T('eda.dur'))}<input type="number" min="0.5" max="30" step="0.25" value="${EDA.dur}"></label>`
    + bt('loop', 'girar', T('eda.loop'), EDA.loop) + bt('camgr', 'mira', T('eda.camgr'), EDA.grabaCam) + `<button data-ea="cine" class="${EDA.cine ? 'on' : ''}" title="${esc(T('eda.cine'))}">${glifo('video')}<span>${esc(T('eda.cine'))}</span></button>`;
  const d = el.querySelector('.edaDur input'); d.onchange = () => edaAccion('dur:' + d.value);
}
function edaSliders() {
  const el = EDA.el; if (!el) return; const n = EDA.sel, e = edaEuler(n), S = el.querySelector('.edaSl');
  const sl = (k, i, a, b, v, paso, etq) => `<label>${etq}<input type="range" min="${a}" max="${b}" step="${paso}" value="${v}" data-sl="${k}:${i}"><output>${typeof v === 'number' ? (paso < 1 ? v.toFixed(2) : v) : v}</output></label>`;
  let h = ['X', 'Y', 'Z'].map((ax, i) => sl('r', i, -180, 180, e[i], 1, ax + '°')).join('');
  if (n === 'Hips') { const po = edaPoseEn(EDA.t); h += [[1, T('eda.altura')], [0, T('eda.lado')], [2, T('eda.adelante')]].map(([c, t]) => sl('h', c, -1.2, 1.2, +(po.h[c] - EDA.base.h[c]).toFixed(2), 0.01, t)).join(''); }
  S.innerHTML = h;
  S.oninput = (ev) => {
    const r = ev.target.dataset && ev.target.dataset.sl; if (!r) return; const [k, i] = r.split(':'), v = +ev.target.value; ev.target.nextElementSibling.textContent = k === 'h' ? v.toFixed(2) : v;
    if (k === 'r') { const cur = edaEuler(n); cur[+i] = v; edaPonerEuler(n, cur); } else edaCadera(+i, v);
  };
}
function edaLinea() {
  const el = EDA.el; if (!el) return; const C = el.querySelector('.edaClaves');
  const k = EDA.keys.map((x, i) => `${x.t.toFixed(3)}${x.cam ? 'c' : ''}`).join(',');
  if (C.dataset.k !== k + '|' + EDA.dur) { C.dataset.k = k + '|' + EDA.dur; C.innerHTML = EDA.keys.map((x, i) => `<i data-k="${i}" class="${x.cam ? 'cam' : ''}" style="left:${(x.t / EDA.dur * 100).toFixed(2)}%"></i>`).join('') + `<span class="edaFin">${EDA.dur.toFixed(2)} s</span>`; }
  el.querySelector('.edaCursor').style.left = (EDA.t / EDA.dur * 100).toFixed(2) + '%';
  C.querySelectorAll('[data-k]').forEach((d) => d.classList.toggle('sel', Math.abs(EDA.keys[+d.dataset.k].t - EDA.t) < 0.5 / EDA_FPS));
  const tt = el.querySelector('.edaAhora') || (() => { const s = document.createElement('span'); s.className = 'edaAhora'; el.querySelector('.edaLinea').appendChild(s); return s; })();
  tt.textContent = EDA.t.toFixed(2) + ' s';
}
