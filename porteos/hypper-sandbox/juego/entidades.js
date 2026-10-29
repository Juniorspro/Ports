// ---------------- entidades: cosas con comportamiento que ponen los mapas y los mods ----------------
// Piano gigante (cada tecla suena al pisarla: jugadores, autos, objetos), radio (emisoras por internet en 3D o un video de
// YouTube; se lleva en la espalda y se pega donde sea con la pistola de física), mega rampa (sus triángulos se suman al piso: los autos bajan por ella),
// botón que hace aparecer un auto, teletransporte, zona de muerte, cartel, luz, impulso, meta y música de ambiente.
// Las del mapa salen de su archivo; las que pone un mod se comparten con la sala.
const ENTS = { lista: [], sig: 1, autos: [], tAutos: 0, t0: 0 };
const ENT_INFO = {
  piano: ['piano', { n: 25, o: 3, a: 1.2, l: 5 }], radio: ['radio', { v: '', vol: 1, r: 40 }], rampa: ['rampa', { alto: 120, ancho: 16, ang: 50, salto: true }],
  boton_autos: ['boton_autos', { auto: '', a: null, ya: null, ini: false }], teleport: ['teleport', { a: null }], zona_muerte: ['zona_muerte', { s: [6, 3, 6] }], cartel: ['cartel', { texto: 'RezoBox', color: '#ffffff' }],
  luz: ['luz', { color: '#ffd9a0', r: 14, i: 1 }], impulso: ['impulso', { f: 16, d: 8 }], meta: ['meta', { texto: '' }], musica: ['musica', { v: '', r: 60 }],
};
const autosMax = () => (ENT.tactil ? 10 : 16), AUTO_OCIOSO = 25;
const ahoraS = () => Date.now() / 1000;
const entW = (e, x, y, z) => vadd(e.p, e.q.rot(v3(x, y, z)));
const entPos = (e) => (e.b ? e.b.pos : e.p);
const ytId = (s) => { const m = /(?:v=|youtu\.be\/|embed\/|shorts\/|^)([\w-]{11})(?:[?&#]|$)/.exec(String(s || '').trim()); return m ? m[1] : ''; };
const colorRGB = (h) => (/^#[0-9a-f]{6}$/i.test(h || '') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) : [1, 1, 1]);

function entidadCrear(d, opt) {
  opt = opt || {};
  const info = ENT_INFO[d.t]; if (!info || !Array.isArray(d.p)) return null;
  const e = { t: d.t, p: v3(+d.p[0] || 0, +d.p[1] || 0, +d.p[2] || 0), yaw: +d.yaw || 0, prm: Object.assign({}, info[1], d.prm || {}), id: opt.id || ENTS.sig++, dueno: opt.dueno || 'yo',
    key: opt.key || null, red: !!opt.red, cajas: [], mallas: [] };
  ENTS.sig = Math.max(ENTS.sig, e.id + 1);
  e.q = Quat.axis(0, 1, 0, e.yaw);
  try { const C = ENT_TIPO[e.t]; if (C && C.crear) C.crear(e); } catch (x) { console.warn('entidad', e.t, x); }
  ENTS.lista.push(e); return e;
}
function entidadQuitar(e) {
  const i = ENTS.lista.indexOf(e); if (i >= 0) ENTS.lista.splice(i, 1);
  for (const b of e.cajas) cajaQuitar(b);
  if (e.tris) mundoQuitarTris(e.tris);
  for (const m of e.mallas) mallaPropiaBorrar(m);
  if (e.b) removeBody(e.b);
  if (e.tag) e.tag.remove();
  if (YT.fuente === e) ytQuitar();
  estParar(e);
}
function entidadesLimpiar() { for (const e of ENTS.lista.slice()) entidadQuitar(e); ENTS.autos.length = 0; ytQuitar(); for (const e of [...EST.son.keys()]) estParar(e); radioCerrar(); ENTS.t0 = TIEMPO.t; }
function entidadDatos(e) {
  const prm = JSON.parse(JSON.stringify(e.prm)); let p = entPos(e);
  // la radio: el lugar de su base (la caja va 24 cm arriba), su giro y si quedó congelada (pegada a una pared)
  if (e.t === 'radio' && e.b) { p = vsub(e.b.pos, v3(0, 0.24, 0)); prm.q = [e.b.q.x, e.b.q.y, e.b.q.z, e.b.q.w].map((x) => +x.toFixed(4)); prm.fz = e.b.frozen ? 1 : 0; prm.ll = e.prm.ll ? 1 : 0; }
  return { t: e.t, p: [p.x, p.y, p.z].map((x) => +x.toFixed(3)), yaw: +e.yaw.toFixed(4), prm };
}
function entidadesCargar(lista) { for (const d of lista || []) entidadCrear(d); ENTS.t0 = TIEMPO.t; }
// lo que pisa algo cerca de una entidad: pies de los jugadores, ruedas de los autos y objetos sueltos
function pisadores(c, rad) {
  const L = [], cerca = (p) => Math.abs(p.x - c.x) < rad && Math.abs(p.z - c.z) < rad && Math.abs(p.y - c.y) < rad;
  if (JUG.vivo && !JUG.vehiculo) { if (NAT.scp && NAT.pies) for (const f of NAT.pies) L.push(f.p); else L.push(v3(JUG.pos.x, JUG.pos.y - 0.98, JUG.pos.z)); }
  if (RED.on) for (const R2 of RED.remotos.values()) if (!R2.veh) L.push(v3(R2.P.pos.x, R2.P.pos.y - 0.98, R2.P.pos.z));
  for (const b of PH.bodies) {
    if (!b.invMass || !cerca(b.pos)) continue;
    const o = b.obj;
    if (o && o.veh && o.veh.ruedas.length) { for (const w of o.veh.ruedas) { const p = vadd(b.pos, b.q.rot(w.p)); p.y -= w.r + 0.05; L.push(p); } }
    else L.push(v3(b.pos.x, b.pos.y - b.r * 0.6, b.pos.z));
  }
  return L.filter(cerca);
}
const _locE = new Quat();
const entLocal = (e, p) => _locE.set(-e.q.x, -e.q.y, -e.q.z, e.q.w).rot(vsub(p, e.p));
const pieJug = () => v3(JUG.pos.x, JUG.pos.y - 0.98, JUG.pos.z);

// ---------------- cada tipo ----------------
const ENT_TIPO = {
  // piano gigante en el piso: las blancas a ras, las negras más altas; la tecla baja y suena mientras algo la pisa
  piano: {
    crear(e) {
      const P = e.prm, n = clamp(P.n | 0, 5, 61), a = clamp(+P.a || 1.2, 0.4, 4), l = clamp(+P.l || 5, 1, 20), o0 = clamp(P.o | 0, 0, 7);
      const BL = [0, 2, 4, 5, 7, 9, 11]; let nb = 0; for (let s = 0; s < n; s++) if (BL.includes(s % 12)) nb++;
      const W = nb * a; let wi = 0; e.teclas = []; e.blancas = [];
      for (let s = 0; s < n; s++) {
        const midi = 12 * (o0 + 1) + s, blanca = BL.includes(s % 12), hz = 440 * Math.pow(2, (midi - 69) / 12);
        const k = blanca ? { blanca, hz, x: W / 2 - (wi + 0.5) * a, w: a * 0.94, y0: 0, h: 0.3, z: l / 2, L: l } : { blanca, hz, x: W / 2 - wi * a, w: a * 0.56, y0: 0.3, h: 0.25, z: l * 0.69, L: l * 0.62 };
        k.ap = 0; k.t = 0; k.on = false; e.teclas.push(k); if (blanca) { e.blancas.push(k); wi++; }
      }
      e.W = W; e.L = l; e.a = a; e.rad = Math.hypot(W / 2, l) + 2;
      e.cajas = e.teclas.map((k) => cajaFija(entW(e, k.x, k.y0 + k.h / 2, k.z), [k.w / 2, k.h / 2, k.L / 2], e.q));
      e.cajas.push(cajaFija(entW(e, 0, 0.75, l + 0.35), [W / 2 + 0.4, 0.75, 0.35], e.q));
    },
    paso(e, dt) {
      const c = entW(e, 0, 0, e.L / 2);
      for (const k of e.teclas) k.pisa = false;
      for (const pt of pisadores(c, e.rad)) {
        const L = entLocal(e, pt); if (L.z < 0 || L.z > e.L || L.y < -0.3 || L.y > 1.4 || Math.abs(L.x) > e.W / 2) continue;
        let k = L.y > 0.43 ? e.teclas.find((t) => !t.blanca && Math.abs(L.x - t.x) < t.w / 2 + 0.05 && L.z > t.z - t.L / 2) : null;
        if (!k) k = e.blancas[Math.floor((e.W / 2 - L.x) / e.a)];
        if (k) k.pisa = true;
      }
      for (const k of e.teclas) {
        if (k.pisa) { if (!k.on) { k.on = true; notaTocar(k.hz, 2.4, entW(e, k.x, 0.4, k.z), 1.1, 'piano'); } k.t = 0.12; }
        else if (k.on && (k.t -= dt) <= 0) k.on = false;
        k.ap += ((k.on ? 1 : 0) - k.ap) * Math.min(1, dt * 18);
      }
    },
    dibujar(e) {
      const mB = matPropio('teclaB', [0.92, 0.92, 0.88], { pbr: [0.22, 0, 0.05] }), mN = matPropio('teclaN', [0.04, 0.04, 0.05], { pbr: [0.18, 0, 0.05] }), mM = matPropio('pianoMadera', [0.1, 0.05, 0.035], { pbr: [0.3, 0, 0.05] });
      for (const k of e.teclas) dibujarCaja(entW(e, k.x, k.y0 + k.h / 2 - k.ap * 0.1, k.z), [k.w, k.h, k.L], e.q, k.blanca ? mB : mN, k.ap > 0.05 ? { em: [0.12 * k.ap, 0.4 * k.ap, 0.9 * k.ap] } : null);
      dibujarCaja(entW(e, 0, 0.75, e.L + 0.35), [e.W + 0.8, 1.5, 0.7], e.q, mM);
      dibujarCaja(entW(e, 0, 0.02, e.L / 2), [e.W + 0.8, 0.04, e.L + 0.3], e.q, mM);
    },
  },
  // radio: una caja que se puede agarrar, tirar y pegar donde sea con la pistola de física (queda congelada); también
  // se lleva en la espalda. Suena la emisora (en 3D) o el video elegido desde donde esté
  radio: {
    crear(e) {
      const b = new Body(boxShape(0.36, 0.22, 0.14), 6, { fric: 0.7, rest: 0.1 }), q = e.prm.q;
      b.pos.copy(vadd(e.p, v3(0, 0.24, 0)));
      const qq = Array.isArray(q) && q.length === 4 ? new Quat(+q[0] || 0, +q[1] || 0, +q[2] || 0, +q[3] || 0) : null;
      b.q.copy(qq && Math.hypot(qq.x, qq.y, qq.z, qq.w) > 0.5 ? qq.norm() : e.q); b.ent = e; b.snd = 'metal'; e.b = b;
      if (e.prm.fz) b.frozen = true;
      if (e.dueno !== 'yo') { b.frozen = true; b.noGrab = true; } // la de otro jugador la mueve su dueño (llega por la red)
      if (!e.prm.ll) addBody(b);
      const v = fuenteRadio(e.prm.v); if (v) { e.vid = v; e.t0 = ahoraS(); }
    },
    paso(e, dt) {
      const P = radioPortador(e);
      if (e.prm.ll) {
        if (PH.bodies.includes(e.b)) removeBody(e.b);
        // (cuando no se dibuja, por ejemplo la propia en primera persona, va más o menos en la espalda para el sonido)
        if (P && P.cDib !== PERS_N) { const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)); e.b.pos.copy(vadd(vadd(P.pos, v3(0, 0.42, 0)), vscale(f, -0.3))); e.b.q.copy(Quat.axis(0, 1, 0, P.yaw)); }
        return;
      }
      if (e.dueno !== 'yo') { radioRemotaPaso(e, dt); return; }
      radioRedPaso(e, dt);
    },
    dibujar(e) {
      if (e.prm.ll) { const P = radioPortador(e); if (P && P.cDib === PERS_N) radioEnEspalda(e, P); return; }
      radioDibujarEn(e, e.b.pos, e.b.q, 1);
    },
    usar(e) { if (e.dueno !== 'yo') { aviso(T('ra.deOtro'), 2); return true; } radioAbrir(e); return true; },
  },
  musica: { crear(e) { const v = fuenteRadio(e.prm.v); if (v) { e.vid = v; e.t0 = ahoraS(); } } },
  // mega rampa (se pone en el piso; sube "alto" metros): plataforma arriba para los autos, caída que se curva, recta
  // empinada, curva hasta el piso, recta y salto final
  rampa: {
    crear(e) {
      const P = e.prm, H = clamp(+P.alto || 120, 10, 600), W = clamp(+P.ancho || 16, 6, 80), th = clamp(+P.ang || 50, 15, 80) * Math.PI / 180;
      // perfil (y, z, ángulo de bajada) en metros desde la punta de arriba:
      // 1) plataforma; 2) caída en parábola: la trayectoria de un auto que sale a v0, así el que llega a esa velocidad o
      // menos baja apoyado (con una curva circular se despegaba de la cresta a 20 m/s); 3) recta empinada; 4) curva de
      // abajo amplia (aguanta ~3 g a la velocidad de abajo); 5) recta; 6) salto final suave
      const Lp = 18, g = 9.81, t2 = Math.tan(th), R2 = clamp(H * 0.6, 25, 90), d2 = R2 * (1 - Math.cos(th));
      const v0 = Math.min(30, Math.sqrt(Math.max(4, (H * 0.75 - d2) * 2 * g / (t2 * t2)))), k = g / (2 * v0 * v0), xm = t2 / (2 * k), dP = k * xm * xm;
      const Ls = Math.max(0, (H - dP - d2) / Math.sin(th)), F = 36, RK = 70, KA = P.salto === false ? 0 : 0.38;
      const pts = [], pon = (y, z, ang) => pts.push({ y, z, ang });
      for (let z = 0; z <= Lp; z += 6) pon(0, z, 0);
      const nP = Math.max(8, Math.ceil(xm / 1.5));
      for (let i = 1; i <= nP; i++) { const x = xm * i / nP; pon(-k * x * x, Lp + x, Math.atan(2 * k * x)); }
      let y = -dP, z = Lp + xm;
      const nS = Math.max(1, Math.ceil(Ls / 6));
      for (let i = 1; i <= nS; i++) pon(y - Math.sin(th) * Ls * i / nS, z + Math.cos(th) * Ls * i / nS, th);
      y -= Math.sin(th) * Ls; z += Math.cos(th) * Ls;
      const nA = Math.max(8, Math.ceil(R2 * th / 1.5)), cy = y + R2 * Math.cos(th), cz = z + R2 * Math.sin(th); // centro arriba y adelante
      for (let i = 1; i <= nA; i++) { const a = th * (1 - i / nA); pon(cy - R2 * Math.cos(a), cz - R2 * Math.sin(a), a); }
      y = cy - R2; z = cz;
      for (let i = 1; i <= 6; i++) pon(y, z + F * i / 6, 0);
      z += F;
      if (KA) { const nK = Math.ceil(RK * KA / 1.5); for (let i = 1; i <= nK; i++) { const a = KA * i / nK; pon(y + RK - RK * Math.cos(a), z + RK * Math.sin(a), -a); } }
      e.perfil = pts; e.W = W; e.H = H;
      const S = geoNuevo(), E = geoNuevo(), tris = [], hw = 1.8, gr = 1.2, X = W / 2;
      const O = vadd(e.p, v3(0, H, 0)), ew = (x, y, z) => vadd(O, e.q.rot(v3(x, y, z))), pW = (x, p, dy) => ew(x, p.y + (dy || 0), p.z);
      e.arriba = O;
      // piso de la rampa (normales suaves) y los triángulos que chocan
      let largo = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], n = e.q.rot(v3(0, Math.cos(p.ang), Math.sin(p.ang)));
        if (i) largo += Math.hypot(p.y - pts[i - 1].y, p.z - pts[i - 1].z);
        for (const x of [X, -X]) { const w = pW(x, p); S.P.push(w.x, w.y, w.z); S.N.push(n.x, n.y, n.z); S.U.push(largo / 4, (x + X) / 4); } // (U a lo largo: las líneas del asfalto siguen la rampa)
        if (i) { const k = i * 2; S.I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const A = pW(X, a), B = pW(-X, a), C = pW(-X, b), D = pW(X, b);
        tris.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, D.x, D.y, D.z);
        // barandas a los dos lados (adentro y afuera) y tapa
        for (const s of [1, -1]) {
          const x = s * X, xo = s * (X + 0.5), p0 = pW(x, a), p1 = pW(x, b), q0 = pW(x, a, hw), q1 = pW(x, b, hw), o0 = pW(xo, a, -gr), o1 = pW(xo, b, -gr), t0 = pW(xo, a, hw), t1 = pW(xo, b, hw);
          const nIn = e.q.rot(v3(-s, 0, 0)), nOut = e.q.rot(v3(s, 0, 0));
          geoQuad(E, p0, p1, q1, q0, nIn, 2); geoQuad(E, o0, o1, t1, t0, nOut, 2); geoQuad(E, q0, q1, t1, t0, e.q.rot(v3(0, 1, 0)), 2);
          tris.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, q1.x, q1.y, q1.z, p0.x, p0.y, p0.z, q1.x, q1.y, q1.z, q0.x, q0.y, q0.z);
        }
        // panza
        const u0 = pW(X + 0.5, a, -gr), u1 = pW(-X - 0.5, a, -gr), u2 = pW(-X - 0.5, b, -gr), u3 = pW(X + 0.5, b, -gr);
        geoQuad(E, u0, u1, u2, u3, e.q.rot(v3(0, -Math.cos(b.ang), -Math.sin(b.ang))), 2);
      }
      // plataforma de arriba más ancha (para los autos) con paredes atrás y a los costados
      const pa = 14, pz0 = -36, pz1 = 0, PY = 0;
      const plat = [ew(X + pa, PY, pz0), ew(-X - pa, PY, pz0), ew(-X - pa, PY, pz1), ew(X + pa, PY, pz1)];
      geoQuad(S, plat[0], plat[1], plat[2], plat[3], e.q.rot(v3(0, 1, 0)), 4);
      tris.push(...[0, 1, 2, 0, 2, 3].flatMap((i) => [plat[i].x, plat[i].y, plat[i].z]));
      const pared = (x0, z0, x1, z1) => { const a = ew(x0, PY, z0), b = ew(x1, PY, z1), c = ew(x1, PY + hw, z1), d = ew(x0, PY + hw, z0), n = vcross(vsub(b, a), v3(0, 1, 0)).norm();
        geoQuad(E, a, b, c, d, n, 2); geoQuad(E, a, b, c, d, vscale(n, -1), 2); tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); };
      pared(X + pa, pz0, -X - pa, pz0); pared(X + pa, pz0, X + pa, pz1); pared(-X - pa, pz0, -X - pa, pz1); pared(X + pa, pz1, X, pz1); pared(-X - pa, pz1, -X, pz1);
      const pb = [ew(X + pa, PY - gr, pz0), ew(-X - pa, PY - gr, pz0), ew(-X - pa, PY - gr, pz1), ew(X + pa, PY - gr, pz1)];
      geoQuad(E, pb[0], pb[1], pb[2], pb[3], e.q.rot(v3(0, -1, 0)), 4);
      // columnas hasta el piso cada tanto (y debajo de la plataforma)
      const cols = [[X + pa - 2, pz0 + 2], [-X - pa + 2, pz0 + 2], [X + pa - 2, -2], [-X - pa + 2, -2]];
      // (la punta de la columna queda debajo de la panza también en la pendiente: antes asomaba y un auto que bajaba
      // con la suspensión apretada chocaba contra ella)
      for (let i = 0; i < pts.length; i++) if (i % 6 === 3 && -pts[i].y < H - 4 && pts[i].y > -H + 3) { const b2 = pts[i].y - Math.abs(Math.tan(pts[i].ang)) * 0.9 - 0.25; cols.push([X - 0.9, pts[i].z, b2], [-X + 0.9, pts[i].z, b2]); }
      for (const [x, z, yy] of cols) {
        const top = ew(x, (yy || 0) - gr, z), piso = pisoBajo(v3(top.x, top.y - 1, top.z), 0); if (piso === null || top.y - piso < 2) continue;
        const h = (top.y - piso) / 2, c = v3(top.x, piso + h, top.z);
        geoCaja(E, c, [0.8, h, 0.8], e.q, 3); e.cajas.push(cajaFija(c, [0.8, h, 0.8], e.q));
      }
      e.tris = mundoSumarTris(tris);
      const asf = matDelJuego(/asphalt|road/i);
      e.mPiso = asf >= 0 ? asf : matPropio('rampaPiso', [0.32, 0.33, 0.36], { pbr: [0.85, 0, 0.03] }); e.mEst = matPropio('rampaEstr', [0.92, 0.72, 0.16], { pbr: [0.5, 0.1, 0.04] });
      e.mallas = [mallaPropia(S), mallaPropia(E)];
      e.rad = Math.hypot(W, pts[pts.length - 1].z) + 40;
    },
    dibujar(e) { encolar(e.mallas[0], 0, e.mPiso, IDM, null, null); encolar(e.mallas[1], 0, e.mEst, IDM, null, null); },
  },
  // botón en el piso: si el auto de este botón ya no está (lo borraron, explotó o se lo llevaron lejos), aparece otro
  boton_autos: {
    crear(e) { e.cajas.push(cajaFija(entW(e, 0, 0.06, 0), [0.75, 0.06, 0.75], e.q)); e.ap = 0; e.tP = 0; },
    paso(e, dt) {
      if (e.prm.ini && !e.iniHecho) { e.iniHecho = true; botonAutoPulsar(e, true); }
      const L = entLocal(e, pieJug()), pisa = JUG.vivo && !JUG.vehiculo && Math.abs(L.x) < 0.85 && Math.abs(L.z) < 0.85 && L.y > -0.3 && L.y < 0.7;
      if (pisa && !e.pisa && TIEMPO.t - e.tP > 1.2) { e.tP = TIEMPO.t; botonAutoPulsar(e); }
      e.pisa = pisa; e.ap += ((pisa ? 1 : 0) - e.ap) * Math.min(1, dt * 14);
    },
    dibujar(e) {
      const mB = matPropio('botonBase', [0.18, 0.18, 0.2], { pbr: [0.4, 0.6, 0.04] }), mR = matPropio('botonRojo', [0.85, 0.06, 0.05], { pbr: [0.3, 0, 0.05] });
      dibujarCaja(entW(e, 0, 0.04, 0), [1.6, 0.08, 1.6], e.q, mB);
      dibujarCaja(entW(e, 0, 0.13 - e.ap * 0.06, 0), [1.1, 0.1, 1.1], e.q, mR, { em: [0.5 + 0.4 * Math.sin(TIEMPO.t * 4), 0.05, 0.03] });
      const pa = botonAutoLugar(e); if (CREA.on) linea(entW(e, 0, 0.3, 0), vadd(pa.p, v3(0, 0.5, 0)), [1, 0.3, 0.2, 0.8]);
    },
    usar(e) { botonAutoPulsar(e); return true; },
  },
  teleport: {
    crear(e) { e.tP = 0; },
    paso(e) {
      if (!e.prm.a || TIEMPO.t - e.tP < 1.5 || !JUG.vivo) return;
      const L = entLocal(e, JUG.vehiculo ? JUG.vehiculo.b.pos : pieJug()); if (Math.hypot(L.x, L.z) > 1.3 || L.y < -0.6 || L.y > 2.2) return;
      e.tP = TIEMPO.t; const d = v3(e.prm.a[0], e.prm.a[1], e.prm.a[2]);
      if (JUG.vehiculo) { const b = JUG.vehiculo.b; b.pos.copy(vadd(d, v3(0, 1.2, 0))); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.updateWorld(); }
      else { JUG.pos.copy(vadd(d, v3(0, 1.05, 0))); JUG.vel.set(0, 0, 0); }
      sonar('Click', null, 0.7, 1.6); for (let i = 0; i < 16; i++) particula(vadd(d, v3((Math.random() - 0.5) * 1.5, Math.random() * 2, (Math.random() - 0.5) * 1.5)), v3(0, 2, 0), 0.6, 0.12, [0.3, 0.9, 1, 1], 'fog', 0.5);
    },
    dibujar(e) {
      const m = matPropio('tele', [0.1, 0.45, 0.6], { pbr: [0.3, 0.2, 0.04] }), k = 0.7 + 0.3 * Math.sin(TIEMPO.t * 3);
      dibujarCaja(entW(e, 0, 0.05, 0), [2.4, 0.1, 2.4], e.q, m, { em: [0.2 * k, 1.2 * k, 1.6 * k] });
      if (CREA.on && e.prm.a) linea(entW(e, 0, 0.3, 0), v3(e.prm.a[0], e.prm.a[1] + 0.3, e.prm.a[2]), [0.3, 0.9, 1, 0.9]);
    },
    luz(e) { luzPuntual(entW(e, 0, 1, 0), 6, [0.4, 2.2, 3]); },
  },
  zona_muerte: {
    paso(e) {
      if (!JUG.vivo) return; const s = e.prm.s || [6, 3, 6], L = entLocal(e, JUG.pos);
      if (Math.abs(L.x) < s[0] / 2 && Math.abs(L.z) < s[2] / 2 && L.y > -1 && L.y < s[1]) danarJugador(1e6, e.p);
    },
    dibujar(e) { if (!CREA.on) return; const s = e.prm.s || [6, 3, 6]; dibujarCaja(entW(e, 0, s[1] / 2, 0), [s[0], s[1], s[2]], e.q, matPropio('muerte', [0.5, 0.02, 0.02]), { em: [0.9, 0.05, 0.05] }); },
  },
  cartel: {
    dibujar(e) {
      const m = matPropio('cartelPalo', [0.35, 0.22, 0.12], { pbr: [0.8, 0, 0.03] }), mt = matPropio('cartelTabla', [0.92, 0.88, 0.78], { pbr: [0.8, 0, 0.03] });
      dibujarCaja(entW(e, 0, 1.1, 0), [0.14, 2.2, 0.14], e.q, m); dibujarCaja(entW(e, 0, 2.5, 0), [2.6, 1.3, 0.12], e.q, mt);
      if (!e.tag) { e.tag = document.createElement('div'); e.tag.className = 'etiqueta cartelT'; $('hud').appendChild(e.tag); }
      const p = entW(e, 0, 2.5, 0), cl = p.distTo(CAM.pos) < 40 ? clipDe(p) : null;
      if (cl) { e.tag.style.display = ''; const k = (e.prm.ico || '') + '|' + (e.prm.texto || ''); if (e.tagK !== k) { e.tagK = k; e.tag.innerHTML = (e.prm.ico ? icoHTML('ico:' + e.prm.ico, 'cartelIco') : '') + `<span dir="auto">${esc(e.prm.texto || '')}</span>`; } e.tag.style.color = e.prm.color || '#fff'; e.tag.style.transform = `translate(${cl.x}px,${cl.y}px) translate(-50%,-50%)`; } else e.tag.style.display = 'none';
    },
  },
  luz: {
    dibujar(e) { const c = colorRGB(e.prm.color); dibujarCaja(e.p, [0.25, 0.25, 0.25], null, matPropio('foco', [1, 1, 1], { pbr: [0.3, 0, 0.04] }), { c: [c[0], c[1], c[2], 1], em: c.map((x) => x * 2.5) }); },
    luz(e) { const c = colorRGB(e.prm.color), k = clamp(+e.prm.i || 1, 0.05, 6) * 3; luzPuntual(e.p, clamp(+e.prm.r || 14, 1, 80), c.map((x) => x * k)); },
  },
  impulso: {
    crear(e) { e.tP = 0; },
    paso(e) {
      if (TIEMPO.t - e.tP < 0.6 || !JUG.vivo) return;
      const L = entLocal(e, JUG.vehiculo ? JUG.vehiculo.b.pos : pieJug()); if (Math.abs(L.x) > 1.3 || Math.abs(L.z) > 1.3 || L.y < -0.5 || L.y > 1.6) return;
      e.tP = TIEMPO.t; const f = e.q.rot(v3(0, 0, 1)), up = clamp(+e.prm.f || 0, 0, 200), fw = clamp(+e.prm.d || 0, 0, 200);
      if (JUG.vehiculo) { const b = JUG.vehiculo.b; b.wake(); b.vel.y = Math.max(b.vel.y, up * 0.8); b.vel.addS(f, fw * 0.8); }
      else { JUG.vel.y = up; JUG.vel.addS(f, fw); JUG.suelo = false; JUG.pos.y += 0.05; }
      sonar('Melee1', e.p, 0.7, 1.5);
    },
    dibujar(e) {
      const m = matPropio('impulso', [0.1, 0.5, 0.15], { pbr: [0.3, 0.2, 0.04] }), k = 0.6 + 0.4 * Math.sin(TIEMPO.t * 5);
      dibujarCaja(entW(e, 0, 0.05, 0), [2.4, 0.1, 2.4], e.q, m, { em: [0.2 * k, 1.4 * k, 0.3 * k] });
      for (let i = 0; i < 3; i++) dibujarCaja(entW(e, 0, 0.12, -0.6 + i * 0.6), [0.9 - i * 0.25, 0.04, 0.22], e.q, m, { em: [1.5, 1.8, 1.5] });
    },
  },
  meta: {
    crear(e) { e.tP = -10; },
    paso(e) {
      if (TIEMPO.t - e.tP < 5 || !JUG.vivo) return;
      const L = entLocal(e, JUG.vehiculo ? JUG.vehiculo.b.pos : JUG.pos); if (Math.abs(L.x) > 4.6 || Math.abs(L.z) > 1.6 || L.y < -1 || L.y > 6) return;
      e.tP = TIEMPO.t; const t = TIEMPO.t - ENTS.t0, mm = Math.floor(t / 60), ss = (t % 60).toFixed(1).padStart(4, '0');
      aviso((e.prm.texto || T('meta')) + ' · ' + mm + ':' + ss, 4); sonar('Click', null, 1, 0.8); ENTS.t0 = TIEMPO.t;
      for (let i = 0; i < 40; i++) particula(entW(e, (Math.random() - 0.5) * 8, 5, 0), v3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), 1.5, 0.12, [Math.random(), Math.random(), Math.random(), 1], 'chispa', 0.5);
    },
    dibujar(e) {
      const mB = matPropio('metaB', [0.95, 0.95, 0.95], { pbr: [0.5, 0, 0.04] }), mN = matPropio('metaN', [0.05, 0.05, 0.05], { pbr: [0.5, 0, 0.04] });
      for (const x of [-4.4, 4.4]) dibujarCaja(entW(e, x, 2.6, 0), [0.4, 5.2, 0.4], e.q, mB);
      for (let i = 0; i < 18; i++) for (let j = 0; j < 2; j++) dibujarCaja(entW(e, -4.25 + i * 0.5, 4.95 + j * 0.5, 0), [0.5, 0.5, 0.25], e.q, (i + j) % 2 ? mN : mB);
    },
  },
};
// ---------------- botón de autos y limpieza de autos sin usar ----------------
let _listaAutos = null;
function listaAutos() {
  if (_listaAutos) return _listaAutos;
  return (_listaAutos = Object.keys(DATA.pfPorNombre || {}).filter((n) => { const a = DATA.pf[DATA.pfPorNombre[n]], mb = (a && a[0].mb) || []; return mb.includes('SCC_Drivetrain') || mb.includes('RB_Controller'); }).sort());
}
function botonAutoLugar(e) {
  const a = e.prm.a; return { p: Array.isArray(a) ? v3(a[0], a[1], a[2]) : entW(e, 0, 0, 5), yaw: e.prm.ya != null ? +e.prm.ya : e.yaw };
}
function botonAutoPulsar(e, callado) {
  const L = botonAutoLugar(e), o = e.auto;
  if (o && OBJS.includes(o) && o.veh && !o.veh.roto && o.b.pos.distTo(L.p) < 10) { aviso(T('autoYa'), 1.5); sonar('Click', e.p, 0.5, 0.7); return; }
  const lista = listaAutos(), nom = lista.includes(e.prm.auto) ? e.prm.auto : e.prm.i != null ? lista[Math.abs(e.prm.i | 0) % Math.max(1, lista.length)] : lista[(Math.random() * lista.length) | 0]; if (!nom) return;
  // si algo ocupa el lugar (otro auto), un poco más arriba
  const n = crearObjeto(nom, vadd(L.p, v3(0, 0.3, 0)), Quat.axis(0, 1, 0, L.yaw)); if (!n) return;
  n.usoT = TIEMPO.t; ENTS.autos.push(n); e.auto = n; if (!callado) { sonar('Click', e.p, 0.9, 1.2); aviso(T('autoNuevo'), 1.5); }
  if (typeof redObjeto === 'function') redObjeto();
  autosLimpiar(true);
}
function autosLimpiar(ya) {
  if (!ya && TIEMPO.t - ENTS.tAutos < 2) return; ENTS.tAutos = TIEMPO.t;
  ENTS.autos = ENTS.autos.filter((o) => OBJS.includes(o));
  const usados = new Set(); if (RED.on) for (const R2 of RED.remotos.values()) if (R2.veh) usados.add(R2.veh.k);
  const deBoton = new Set(ENTS.lista.filter((e) => e.auto).map((e) => e.auto));
  for (const o of ENTS.autos) if (JUG.vehiculo === o || o.b.held || o.b.vel.lenSq() > 1 || usados.has(claveObj(o))) o.usoT = TIEMPO.t;
  while (ENTS.autos.length > autosMax()) {
    const c = ENTS.autos.filter((o) => JUG.vehiculo !== o && TIEMPO.t - o.usoT > AUTO_OCIOSO).sort((a, b) => (deBoton.has(a) - deBoton.has(b)) || a.usoT - b.usoT)[0];
    if (!c) break; borrarObjeto(c); ENTS.autos.splice(ENTS.autos.indexOf(c), 1);
  }
}
// ---------------- cada cuadro ----------------
const ENT_SIN_CREADOR = new Set(['teleport', 'impulso', 'zona_muerte', 'meta']); // en el creador no te mueven ni te matan
function entidadesPaso(dt) {
  for (const e of ENTS.lista) { const C = ENT_TIPO[e.t]; if (C && C.paso && !(CREA.on && ENT_SIN_CREADOR.has(e.t))) C.paso(e, dt); }
  if (ENTS.autos.length) autosLimpiar(false);
  ytPaso(dt); estPaso(dt);
}
function dibujarEntidades() {
  GEO.pi = 0;
  for (const e of ENTS.lista) { const C = ENT_TIPO[e.t]; if (C && C.dibujar) C.dibujar(e); }
  if (typeof creadorDibujar === 'function') creadorDibujar();
}
function entidadesLuces() { for (const e of ENTS.lista) { const C = ENT_TIPO[e.t]; if (C && C.luz && entPos(e).distTo(CAM.pos) < 120) C.luz(e); } }
function entidadCerca() { let best = null, bd = 2.2; for (const e of ENTS.lista) { const C = ENT_TIPO[e.t]; if (!C || !C.usar || (e.prm && e.prm.ll)) continue; const d = entPos(e).distTo(pieJug()); if (d < bd) { bd = d; best = e; } } return best; }
function entidadUsar(e) { const C = ENT_TIPO[e.t]; return !!(C && C.usar && C.usar(e)); }
// el piano y la radio que pone un mod: delante del jugador, uno de cada uno (si ya está, se trae)
function entidadPonerMod(t, callado) {
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = t === 'piano' ? 3 : 1.6, p = vadd(JUG.pos, vscale(f, d));
  const y = pisoBajo(v3(p.x, JUG.pos.y + 1, p.z), 0); p.y = y === null ? JUG.pos.y - 1 : y;
  let e = ENTS.lista.find((x) => x.t === t && x.dueno === 'yo' && x.red && !x.mod);
  if (t === 'radio' && e && (e.prm.ll || entPos(e).distTo(JUG.pos) < 6)) { if (!callado) radioAbrir(e); return; }
  const vid = e && e.vid, t0 = e && e.t0, tit = e && e.tit, lista = e && e.lista;
  if (e) { entidadQuitar(e); entidadRed('entb', e); }
  e = entidadCrear({ t, p: [p.x, p.y, p.z], yaw: JUG.yaw }, { red: true });
  if (vid) Object.assign(e, { vid, t0, tit, lista });
  entidadRed('ent', e);
  if (t === 'radio' && !callado) radioAbrir(e);
}
// ---------------- en la sala: las que pone un mod se ven y suenan para todos ----------------
function entidadRed(k, e) {
  if (!RED.on || !e.red) return;
  if (k === 'ent') publicar('a', { k: 'ent', n: e.id, d: entidadDatos(e) });
  else if (k === 'entb') publicar('a', { k: 'entb', n: e.id });
  else if (k === 'radio') publicar('a', { k: 'radio', n: e.id, v: e.vid || '', s: e.t0 ? Math.round(ahoraS() - e.t0) : 0, t: (e.tit || '').slice(0, 100) });
  RED.wSucio = true;
}
const entidadesMias = () => ENTS.lista.filter((e) => e.red && e.dueno === 'yo').map((e) => ({ n: e.id, d: entidadDatos(e), v: e.vid || '', s: e.t0 ? Math.round(ahoraS() - e.t0) : 0, tt: (e.tit || '').slice(0, 100) }));
function entidadRemota(id, x) {
  if (!x || typeof x !== 'object' || !x.d || !ENT_INFO[x.d.t]) return null;
  const key = id + ':' + (x.n | 0); let e = ENTS.lista.find((y) => y.key === key);
  const v = validarRB({ formato: 'rezobox-mapa', nombre: 'red', base: 'FlatGrass', entidades: [x.d] }), d = typeof v === 'object' && v.entidades[0]; if (!d) return null;
  if (!e) e = entidadCrear(d, { dueno: id, key });
  else if (e.t === 'radio') radioRemotaDatos(e, d);
  else if (e.b && v3(d.p[0], d.p[1], d.p[2]).distTo(e.b.pos) > 1.5) { e.b.pos.set(d.p[0], d.p[1] + 0.24, d.p[2]); e.b.vel.set(0, 0, 0); e.b.updateWorld(); }
  if (x.v !== undefined) radioPoner(e, fuenteRadio(x.v), num(x.s, 0, 1e6, 0), limpio(String(x.tt || x.t || ''), 100), false);
  return e;
}
function entidadesRecibir(id, lista) {
  const vivas = new Set();
  for (const x of (Array.isArray(lista) ? lista : []).slice(0, 300)) { const e = entidadRemota(id, x); if (e) vivas.add(e); }
  for (const e of ENTS.lista.slice()) if (e.dueno === id && !vivas.has(e)) entidadQuitar(e);
}
function entidadHecho(d) {
  if (d.k === 'ent') entidadRemota(d.i, { n: d.n, d: d.d });
  else if (d.k === 'entb') { const e = ENTS.lista.find((y) => y.key === d.i + ':' + (d.n | 0)); if (e) entidadQuitar(e); }
  else if (d.k === 'radio') { const e = ENTS.lista.find((y) => y.key === d.i + ':' + (d.n | 0)); if (e) radioPoner(e, fuenteRadio(d.v), num(d.s, 0, 1e6, 0), limpio(String(d.t || ''), 100), false); }
  else if (d.k === 'entp') { const e = ENTS.lista.find((y) => y.key === d.i + ':' + (d.n | 0)); if (e && e.t === 'radio') radioRemotaPose(e, d); }
}
function entidadesDe(id) { for (const e of ENTS.lista.slice()) if (e.dueno === id) entidadQuitar(e); }

// ---------------- la fuente de una radio: emisora por internet (en 3D) o video de YouTube ----------------
// e.vid es "rb:" + el id de la emisora en Radio Browser, o el id de 11 letras de un video. Las emisoras pasan por el
// sonido del juego: panner HRTF en la radio, más bajo de lejos, apagado detrás de paredes y con el eco del lugar; suenan
// las tres radios más cercanas a la vez. YouTube no deja pasar su sonido por el juego ni esconder su reproductor, así
// que un video suena desde una ventanita (el volumen sí sigue a la distancia).
const esEst = (v) => typeof v === 'string' && /^rb:[0-9a-f-]{36}$/.test(v);
const fuenteRadio = (v) => (esEst(v) ? v : ytId(v));
const EST = { son: new Map(), url: new Map(), t: 0, max: 3 };
// la dirección del audio de la emisora; si no es https (o no deja pasarlo por el sonido del juego) va por la tienda
function estUrl(id) {
  if (EST.url.has(id)) return Promise.resolve(EST.url.get(id));
  return fetch(TIENDA_URL + 'radio/u/' + id).then((r) => r.json()).then((d) => { const u = /^https:\/\//.test(d.u || '') ? d.u : null; EST.url.set(id, u); return u; }).catch(() => null);
}
function estSonar(e) {
  const c = AUD.ctx; if (!c) return null;
  const a = new Audio(); a.crossOrigin = 'anonymous'; a.preload = 'auto';
  const S = { e, vid: e.vid, a, src: null, F: null, an: null, nivel: new Uint8Array(64), prox: false, listo: false, tOcl: 0, tap: false, reint: 2, fin: 0, espera: 0 }; // (espera: hora límite para que arranque)
  try { S.src = c.createMediaElementSource(a); } catch (x) { return null; }
  S.F = fuente3D(entPos(e), 0); S.F.p.panningModel = 'HRTF'; S.F.p.rolloffFactor = 0; S.src.connect(S.F.g);
  S.an = c.createAnalyser(); S.an.fftSize = 64; S.src.connect(S.an);
  a.onerror = () => estFallo(S); a.onplaying = () => { S.listo = true; S.espera = 0; };
  a.onended = () => { if (S.fin++ < 3) { a.load(); a.play().catch(() => {}); } else estFallo(S); }; // (una emisora que se corta, se vuelve a conectar)
  const id = e.vid.slice(3);
  estUrl(id).then((u) => { if (EST.son.get(e) !== S) return; S.prox = !u; S.espera = performance.now() + 9000; a.src = u || TIENDA_URL + 'radio/play/' + id; a.play().catch(() => {}); });
  return S;
}
function estFallo(S) {
  if (EST.son.get(S.e) !== S) return;
  if (!S.prox) { S.prox = true; S.listo = false; S.espera = performance.now() + 9000; S.a.src = TIENDA_URL + 'radio/play/' + S.vid.slice(3); S.a.play().catch(() => {}); return; }
  const e = S.e; estParar(e); e.estMala = S.vid; // (esa emisora no se vuelve a probar en esta radio)
  if (e.dueno === 'yo') radioSiguiente(e, true);
}
function estParar(e) {
  const S = EST.son.get(e); if (!S) return; EST.son.delete(e); e.nivel = 0;
  try { S.a.onerror = S.a.onended = null; S.a.pause(); S.a.removeAttribute('src'); S.a.load(); } catch (x) {}
  try { S.src.disconnect(); S.an.disconnect(); S.F.g.disconnect(); S.F.f.disconnect(); S.F.p.disconnect(); } catch (x) {}
}
function estPaso(dt) {
  // cada cuadro: dónde está cada radio que suena, su volumen y su nivel (para que los parlantes latan con la música)
  for (const [e, S] of EST.son) {
    if (!ENTS.lista.includes(e) || e.vid !== S.vid) { estParar(e); continue; }
    const p = entPos(e); ponerPos(S.F.p, p);
    S.an.getByteTimeDomainData(S.nivel); let m = 0; for (const v of S.nivel) m = Math.max(m, Math.abs(v - 128)); e.nivel = S.listo && !S.a.paused ? m / 128 : 0;
    const r = clamp(+e.prm.r || 40, 4, 400), d = p.distTo(CAM.pos), k = clamp(1 - (d - 3) / (r - 3), 0, 1), t = AUD.ctx.currentTime;
    S.tOcl -= dt; if (S.tOcl <= 0) { S.tOcl = 0.3; S.tap = d > 2 && audioTapado(p); S.F.f.frequency.setTargetAtTime(S.tap ? 900 : 20000, t, 0.08); }
    S.F.g.gain.setTargetAtTime(0.9 * Math.pow(k, 1.6) * clamp(+e.prm.vol || 1, 0, 1) * (S.tap ? 0.5 : 1), t, 0.06);
    if (S.a.paused && S.a.getAttribute('src') && (S.reint -= dt) <= 0) { S.reint = 2; S.a.play().catch(() => {}); } // (si el navegador no la dejó arrancar sin un toque)
    // una emisora que se queda cargando sin dar error: a los 9 s se prueba por la tienda (y si tampoco, la siguiente)
    if (!S.listo && S.espera && !S.a.paused && performance.now() > S.espera) { S.espera = 0; estFallo(S); continue; }
  }
  EST.t -= dt; if (EST.t > 0) return; EST.t = 0.5;
  if (!AUD.ctx || JUEGO.estado !== 'juego') { for (const e of [...EST.son.keys()]) estParar(e); return; }
  const cerca = ENTS.lista.filter((e) => esEst(e.vid) && e.estMala !== e.vid).map((e) => [e, entPos(e).distTo(CAM.pos), clamp(+e.prm.r || 40, 4, 400)])
    .filter(([e, d, r]) => d < r || (EST.son.has(e) && d < r + 6)).sort((a, b) => a[1] - b[1]).slice(0, EST.max).map((x) => x[0]);
  for (const e of [...EST.son.keys()]) if (!cerca.includes(e)) estParar(e);
  for (const e of cerca) if (!EST.son.has(e)) { const S = estSonar(e); if (S) EST.son.set(e, S); }
}

// ---------------- videos de YouTube: un solo reproductor para el más cercano que se oye ----------------
const YT = { caja: null, ifr: null, fuente: null, vid: null, vol: -1, t: 0, pan: null };
function ytCaja() {
  if (YT.caja) return YT.caja;
  const c = document.createElement('div'); c.id = 'ytMini'; c.className = 'oc';
  c.innerHTML = `<div class="ytV"></div><div class="ytB"><span class="ytT" dir="auto"></span><button data-yt="buscar">${glifo('buscar')}</button><button data-yt="parar">${glifo('parar')}</button></div>`;
  c.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); const b = ev.target.closest('[data-yt]'); if (!b) return; ev.preventDefault();
    if (b.dataset.yt === 'parar' && YT.fuente) radioPoner(YT.fuente, '', 0, '', true); else if (b.dataset.yt === 'buscar' && YT.fuente) radioAbrir(YT.fuente); });
  document.body.appendChild(c); return (YT.caja = c);
}
function ytCmd(func, args) { try { YT.ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {} }
function ytQuitar() { if (YT.ifr) YT.ifr.remove(); YT.ifr = null; YT.fuente = null; YT.vid = null; YT.vol = -1; if (YT.caja) YT.caja.classList.add('oc'); }
function ytCargar(e) {
  ytQuitar(); const c = ytCaja();
  YT.fuente = e; YT.vid = e.vid;
  const s = Math.max(0, Math.floor(ahoraS() - (e.t0 || ahoraS()))), f = document.createElement('iframe');
  f.allow = 'autoplay; encrypted-media'; f.title = 'YouTube'; f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  f.src = `https://www.youtube-nocookie.com/embed/${e.vid}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1&start=${s}` + (/^https?:/.test(location.origin) ? '&origin=' + encodeURIComponent(location.origin) : '');
  f.onload = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'rb' }), '*'); } catch (x) {} YT.vol = -1; ytVolumen(true); };
  c.querySelector('.ytV').appendChild(f); YT.ifr = f; c.querySelector('.ytT').textContent = sinEmoji(e.tit) || 'YouTube'; c.classList.remove('oc');
}
function ytVolumen(forzar) {
  const e = YT.fuente; if (!e || !YT.ifr) return;
  const r = clamp(+e.prm.r || 40, 4, 400), d = entPos(e).distTo(CAM.pos), k = clamp(1 - (d - 3) / (r - 3), 0, 1), tap = d > 2 && audioTapado(entPos(e));
  const vol = Math.round(100 * clamp(PREFS.vol / 100, 0, 1) * Math.pow(k, 1.6) * clamp(+e.prm.vol || 1, 0, 1) * (tap ? 0.45 : 1));
  if (forzar || Math.abs(vol - YT.vol) >= 2 || (vol === 0) !== (YT.vol === 0)) { ytCmd('setVolume', [vol]); YT.vol = vol; }
}
function ytPaso(dt) {
  YT.t -= dt; if (YT.t > 0) return; YT.t = 0.25;
  let best = null, bd = 1e9;
  if (JUEGO.estado === 'juego') for (const e of ENTS.lista) { if (!e.vid || esEst(e.vid)) continue; const d = entPos(e).distTo(CAM.pos); if (d < clamp(+e.prm.r || 40, 4, 400) && d < bd) { bd = d; best = e; } }
  if (!best) { if (YT.ifr) ytQuitar(); return; }
  if (best !== YT.fuente || best.vid !== YT.vid) ytCargar(best);
  ytVolumen(false);
}
addEventListener('message', (ev) => {
  if (!YT.ifr || ev.source !== YT.ifr.contentWindow || !/youtube/.test(ev.origin)) return;
  let d; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (x) { return; }
  if (!d || typeof d !== 'object') return;
  const e = YT.fuente; if (!e) return;
  if (d.event === 'onError') radioSiguiente(e, true);
  else if ((d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 0)) radioSiguiente(e, false);
  if (d.event === 'infoDelivery' && d.info && d.info.videoData && d.info.videoData.title && !e.tit) { e.tit = limpio(d.info.videoData.title, 100); YT.caja.querySelector('.ytT').textContent = sinEmoji(e.tit); }
});
// la radio pasa a lo siguiente de la búsqueda (o vuelve a empezar el video); si algo no se puede poner, salta
function radioSiguiente(e, error) {
  if (e.dueno !== 'yo') { if (error) { if (!esEst(e.vid)) e.vid = null; ytQuitar(); } return; }
  const L = e.lista || [], i = L.findIndex((x) => x.id === e.vid), est = esEst(e.vid);
  if (L.length > 1 && (i >= 0 || error)) { const s = L[(i + 1) % L.length]; radioPoner(e, s.id, 0, s.t, true); if (error) aviso(T(est ? 'ra.salta' : 'ytSalta'), 1.5); }
  else if (error) { radioPoner(e, '', 0, '', true); aviso(T(est ? 'ra.no' : 'ytNo'), 2.5); }
  else radioPoner(e, e.vid, 0, e.tit, true);
}
function radioPoner(e, vid, s, tit, mio) {
  if (!e) return;
  if (vid === (e.vid || '') && Math.abs((ahoraS() - (e.t0 || 0)) - s) < 4 && !mio) return;
  const antes = e.vid; e.vid = vid || null; e.t0 = ahoraS() - (s || 0); e.tit = tit || ''; e.prm.v = e.vid || '';
  if (e.vid !== antes) { e.estMala = null; estParar(e); }
  if (YT.fuente === e) { if (!vid || esEst(vid)) ytQuitar(); else ytCargar(e); }
  if (mio) { entidadRed('radio', e); if (esEst(vid)) fetch(TIENDA_URL + 'radio/clic/' + vid.slice(3)).catch(() => {}); }
  if (RADIO.e === e) radioDibujar();
}

// ---------------- la radio en la espalda (sólo la propia): sale de la física y va pegada al pecho del que la lleva ----------------
let PERS_N = 0; // cuadro de dibujo de los personajes (la radio se dibuja con los huesos de ese mismo cuadro)
const RADIO_ESP = 0.78; // en la espalda va un poco más chica
const radioMia = () => ENTS.lista.find((x) => x.t === 'radio' && x.dueno === 'yo' && x.red && !x.mod) || null;
function radioPortador(e) {
  if (!e.prm.ll) return null;
  if (e.dueno === 'yo') return JUG.cuerpo;
  const R2 = RED.remotos.get(e.dueno); return R2 ? R2.P : null;
}
function radioEspalda(e, si) {
  if (!e || e.t !== 'radio' || e.dueno !== 'yo' || !!e.prm.ll === !!si) return;
  if (si && (!JUG.vivo || !JUG.cuerpo)) return;
  if (ARM.agarre && ARM.agarre.b === e.b) soltarAgarre(false);
  if (ARM.grav && ARM.grav.b === e.b) soltarGrav();
  e.prm.ll = si ? 1 : 0;
  if (si) { removeBody(e.b); e.b.frozen = false; e.b.held = false; }
  else {
    // al soltarla queda parada en el piso, detrás
    const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), p = vsub(JUG.pos, vscale(f, 0.9)), y = pisoBajo(v3(p.x, JUG.pos.y + 0.5, p.z), 0);
    e.b.pos.set(p.x, (y === null ? JUG.pos.y - 1 : y) + 0.24, p.z); e.b.q.copy(Quat.axis(0, 1, 0, JUG.yaw)); e.b.vel.copy(JUG.vel); e.b.ang.set(0, 0, 0);
    e.b.frozen = false; if (!PH.bodies.includes(e.b)) addBody(e.b); e.b.updateWorld(); e.b.wake();
  }
  sonar('Click', null, 0.7, si ? 1.1 : 0.8); entidadRed('ent', e);
  if (RADIO.e === e) radioDibujar(); if (typeof modMenuDibujar === 'function') modMenuDibujar();
}
// qué tan atrás del hueso del pecho está la espalda: los colisionadores del torso (cajas y cápsulas del juego) en esa dirección
function espaldaDe(P, c, n) {
  const md = P.md, A = md.A; let best = -1;
  for (const nom of ['Spine', 'Spine1', 'Spine2']) {
    const j = P.D.h[nom]; if (j === undefined || !A[j] || !A[j].col) continue;
    const k = A[j].col[0], W = md.W[j], s = m4esc(W), cen = m4pt(W, k.c[0], k.c[1], k.c[2], v3()), ej = [0, 1, 2].map((a) => v3(W[a * 4], W[a * 4 + 1], W[a * 4 + 2]).norm());
    let sop = vdot(vsub(cen, c), n);
    if (k.k === 'b') for (let a = 0; a < 3; a++) sop += Math.abs(vdot(ej[a], n)) * Math.abs(k.s[a] * s) / 2;
    else if (k.k === 'c') { const d = ej[k.d === 0 ? 0 : k.d === 2 ? 2 : 1]; sop += k.r * s + Math.abs(vdot(d, n)) * Math.max(0, k.h * s / 2 - k.r * s); }
    else sop += (k.r || 0.1) * s;
    if (sop > best) best = sop;
  }
  return best > 0.02 && best < 0.6 ? best : 0.14;
}
function radioEnEspalda(e, P) {
  const md = P.md, h = P.D.h, i = h.Spine2 !== undefined ? h.Spine2 : h.Spine1; if (i === undefined) return;
  md.actualizar();
  const W = md.W[i], qd = m4quat(W).mul(P.D.rw[i].conj()).norm(); // del personaje en reposo (mirando a +Z) al mundo, con la pose de ahora
  const n = qd.rot(v3(0, 0, -1)), up = qd.rot(v3(0, 1, 0)), c = wp(W);
  const pos = vadd(vadd(c, vscale(n, espaldaDe(P, c, n) + 0.14 * RADIO_ESP + 0.012)), vscale(up, -0.12));
  e.b.pos.copy(pos); e.b.q.copy(qd);
  radioDibujarEn(e, pos, qd, RADIO_ESP);
}
// la caja roja con dos parlantes (laten con la música), el dial, la manija y la antena; los parlantes miran a -Z
function radioDibujarEn(e, c, q, s) {
  const w = (x, y, z) => vadd(c, q.rot(v3(x * s, y * s, z * s)));
  const mC = matPropio('radioCaja', [0.62, 0.1, 0.08], { pbr: [0.35, 0.2, 0.05] }), mG = matPropio('radioRejilla', [0.08, 0.08, 0.09], { pbr: [0.6, 0.4, 0.04] }), mP = matPropio('radioMetal', [0.75, 0.75, 0.78], { pbr: [0.25, 0.9, 0.05] });
  const pulso = YT.fuente === e && YT.vol > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(TIEMPO.t * 7.3)) : clamp((e.nivel || 0) * 2.4, 0, 1), suena = pulso > 0.02 || (YT.fuente === e && YT.vol > 0);
  dibujarCaja(c, [0.72 * s, 0.44 * s, 0.28 * s], q, mC);
  for (const sx of [-0.19, 0.19]) dibujarCaja(w(sx, -0.03, -0.142 - pulso * 0.006), [(0.24 + pulso * 0.016) * s, (0.24 + pulso * 0.016) * s, 0.012 * s], q, mG);
  dibujarCaja(w(0, 0.15, -0.142), [0.2 * s, 0.07 * s, 0.012 * s], q, mP, { em: suena ? [1.6, 0.8, 0.2] : [0.15, 0.08, 0.02] });
  dibujarCaja(w(0, 0.285, 0), [0.5 * s, 0.04 * s, 0.05 * s], q, mP);
  for (const sx of [-0.23, 0.23]) dibujarCaja(w(sx, 0.245, 0), [0.04 * s, 0.07 * s, 0.05 * s], q, mP);
  dibujarCaja(w(0.31, 0.47, 0.06), [0.014 * s, 0.52 * s, 0.014 * s], q.clone().mul(Quat.axis(0, 0, 1, -0.35)), mP);
}
// ---------------- en la sala: dónde está la radio (agarrada, tirada o pegada a una pared) ----------------
function radioRedPaso(e, dt) {
  if (!e.red || !RED.on) return;
  const b = e.b, mueve = !!b.held || !b.sleep, fz = !!b.frozen;
  e.tRed = (e.tRed || 0) - dt;
  if ((mueve && e.tRed <= 0) || fz !== !!e.fzAnt || (e.movia && !mueve)) {
    e.tRed = 0.1; e.fzAnt = fz; e.movia = mueve;
    publicar('a', { k: 'entp', n: e.id, p: [r3(b.pos.x), r3(b.pos.y), r3(b.pos.z)], q: [r4(b.q.x), r4(b.q.y), r4(b.q.z), r4(b.q.w)], fz: fz ? 1 : 0 });
    if (!mueve) RED.wSucio = true;
  }
}
function radioRemotaPose(e, d) {
  if (!Array.isArray(d.p) || !Array.isArray(d.q)) return;
  const q = new Quat(num(d.q[0], -1, 1, 0), num(d.q[1], -1, 1, 0), num(d.q[2], -1, 1, 0), num(d.q[3], -1, 1, 1));
  if (Math.hypot(q.x, q.y, q.z, q.w) < 0.5) return;
  e.meta = { p: v3(num(d.p[0], -1e5, 1e5, 0), num(d.p[1], -1e5, 1e5, 0), num(d.p[2], -1e5, 1e5, 0)), q: q.norm() }; e.prm.fz = d.fz ? 1 : 0;
}
// datos completos de la radio de otro (al ponerla, llevarla o soltarla, y lo que queda guardado en la sala)
function radioRemotaDatos(e, d) {
  const prm = d.prm || {}, ll = prm.ll ? 1 : 0;
  if (Array.isArray(prm.q)) radioRemotaPose(e, { p: [d.p[0], d.p[1] + 0.24, d.p[2]], q: prm.q, fz: prm.fz });
  if (ll !== (e.prm.ll ? 1 : 0)) {
    e.prm.ll = ll;
    if (ll) removeBody(e.b);
    else { if (e.meta) { e.b.pos.copy(e.meta.p); e.b.q.copy(e.meta.q); } if (!PH.bodies.includes(e.b)) addBody(e.b); e.b.updateWorld(); }
  }
}
// la de otro: quieta (la mueve su dueño); se acerca suave a donde dice la red
function radioRemotaPaso(e, dt) {
  const b = e.b; b.frozen = true; b.noGrab = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0);
  const M = e.meta; if (!M) return;
  if (b.pos.distTo(M.p) > 0.0005 || Math.abs(vdot4(b.q, M.q)) < 0.99999) {
    const k = b.pos.distTo(M.p) > 8 ? 1 : 1 - Math.exp(-dt * 14); b.pos.lerpTo(M.p, k); b.q.slerpTo(M.q, k); b.updateWorld();
  }
}

// ---------------- el panel de la radio: emisoras (3D) o YouTube ----------------
const RADIO = { e: null, res: [], q: '', tag: '', cargando: false, n: 0, modo: 'est', guard: {} };
const RADIO_GENEROS = ['lofi', 'pop', 'rock', 'electronic', 'reggaeton', 'hip hop', 'latin', 'jazz', 'classical', 'anime', 'news'];
function radioCrearPanel() {
  if ($('radioPan')) return;
  const p = document.createElement('div'); p.id = 'radioPan'; p.className = 'panel oc';
  p.innerHTML = `<div class="caja radioCaja"><h3>${icoHTML('ico:radio')} <span class="raTit"></span></h3>
    <div class="raTabs"><button data-ra="modo:est">${glifo('mundo')} <span class="raTEst"></span></button><button data-ra="modo:yt">${glifo('video')} YouTube</button></div>
    <div class="radioBus"><input id="radioQ" maxlength="80" spellcheck="false"><button class="boton chico" data-ra="buscar">${glifo('buscar')}</button></div>
    <div class="raGen"></div><div class="raNota"></div><div id="radioAhora"></div><div id="radioRes"></div>
    <div class="fila raVol">${glifo('volumen')} <input type="range" id="radioVol" min="0" max="100"></div>
    <div class="radioPie"><button class="boton chico" data-ra="espalda"></button><button class="boton chico gris" data-ra="parar"></button><button class="boton chico gris" data-ra="cerrar"></button></div></div>`;
  document.body.appendChild(p);
  p.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ra]'); if (!b) { if (ev.target === p) radioCerrar(); return; }
    const [a, v] = b.dataset.ra.split(/:(.*)/s), e = RADIO.e; if (!e) return;
    if (a === 'buscar') radioBuscar($('radioQ').value, '');
    else if (a === 'gen') { $('radioQ').value = ''; radioBuscar('', v); }
    else if (a === 'modo') radioModo(v);
    else if (a === 'cerrar') radioCerrar();
    else if (a === 'parar') radioPoner(e, '', 0, '', true);
    else if (a === 'espalda') radioEspalda(e, !e.prm.ll);
    else if (a === 'poner') {
      const it = RADIO.res[+v]; if (!it) return; const yt = RADIO.modo === 'yt', id = yt ? it.id : 'rb:' + it.id;
      e.lista = RADIO.res.map((x) => ({ id: yt ? x.id : 'rb:' + x.id, t: x.t })); audioIniciar(); radioPoner(e, id, 0, it.t, true);
    }
  });
  // (la foto de una emisora que no carga se cambia por el ícono de la radio)
  p.addEventListener('error', (ev) => { const im = ev.target; if (im && im.tagName === 'IMG' && im.dataset.f) { delete im.dataset.f; im.src = icoSrc('ico:radio'); } }, true);
  $('radioQ').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); radioBuscar($('radioQ').value, ''); } });
  $('radioVol').addEventListener('input', (ev) => { if (RADIO.e) { RADIO.e.prm.vol = +ev.target.value / 100; YT.vol = -1; } });
}
function radioModo(m) {
  if (m !== 'est' && m !== 'yt') return;
  RADIO.guard[RADIO.modo] = { res: RADIO.res, q: RADIO.q, tag: RADIO.tag }; RADIO.modo = m; RADIO.n++; RADIO.cargando = false;
  const g = RADIO.guard[m] || { res: [], q: '', tag: '' }; RADIO.res = g.res; RADIO.q = g.q; RADIO.tag = g.tag;
  $('radioQ').value = RADIO.q; $('radioQ').placeholder = T(m === 'yt' ? 'ytBuscar' : 'ra.buscar');
  radioDibujar(); if (!RADIO.res.length) radioBuscar(m === 'yt' ? 'música para jugar' : '', '');
}
function radioAbrir(e) {
  if (!e) return;
  radioCrearPanel(); cerrarPaneles(); RADIO.e = e; UI.abierto = 'radio'; soltarPuntero();
  const p = $('radioPan'); p.classList.remove('oc');
  p.querySelector('.raTit').textContent = T('radio'); p.querySelector('.raTEst').textContent = T('ra.emisoras');
  p.querySelector('[data-ra=parar]').innerHTML = glifo('parar') + ' ' + esc(T('apagar')); p.querySelector('[data-ra=cerrar]').innerHTML = glifo('no') + ' ' + esc(T('cerrar'));
  $('radioVol').value = Math.round(100 * clamp(+e.prm.vol || 1, 0, 1));
  const m = e.vid && !esEst(e.vid) ? 'yt' : RADIO.modo; if (m !== RADIO.modo) radioModo(m); else { $('radioQ').placeholder = T(m === 'yt' ? 'ytBuscar' : 'ra.buscar'); $('radioQ').value = RADIO.q; }
  radioDibujar(); if (!RADIO.res.length && !RADIO.cargando) radioBuscar(RADIO.modo === 'yt' ? 'música para jugar' : '', '');
  if (!ENT.tactil) setTimeout(() => $('radioQ').focus(), 50);
}
function radioCerrar() { const p = $('radioPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'radio') UI.abierto = null; RADIO.e = null; }
async function radioBuscar(q, tag) {
  const yt = RADIO.modo === 'yt'; q = String(q || '').trim().slice(0, 80); tag = yt ? '' : String(tag || '');
  if (yt && !q) return;
  RADIO.q = q; RADIO.tag = tag; const n = ++RADIO.n; RADIO.cargando = true; radioDibujar();
  try {
    const u = yt ? 'yt?q=' + encodeURIComponent(q) : 'radio?q=' + encodeURIComponent(q) + (tag ? '&tag=' + encodeURIComponent(tag) : '');
    const d = await (await fetch(TIENDA_URL + u)).json(); if (n !== RADIO.n) return;
    RADIO.res = (d.items || []).filter((x) => (yt ? ytId(x.id) === x.id : /^[0-9a-f-]{36}$/.test(x.id || '')));
  } catch (x) { if (n !== RADIO.n) return; RADIO.res = []; aviso(T('errRed'), 2); }
  RADIO.cargando = false; radioDibujar();
}
function radioDibujar() {
  const R0 = $('radioRes'); if (!R0 || !RADIO.e) return; const e = RADIO.e, yt = RADIO.modo === 'yt', p = $('radioPan');
  p.querySelectorAll('.raTabs button').forEach((b) => b.classList.toggle('sel', b.dataset.ra === 'modo:' + RADIO.modo));
  p.querySelector('.raGen').innerHTML = yt ? '' : RADIO_GENEROS.map((g) => `<button class="${RADIO.tag === g ? 'sel' : ''}" data-ra="gen:${g}">${esc(g)}</button>`).join('');
  p.querySelector('.raNota').textContent = yt ? T('ra.notaYt') : '';
  p.querySelector('[data-ra=espalda]').innerHTML = glifo('espalda') + ' ' + esc(T(e.prm.ll ? 'ra.soltar' : 'ra.espalda'));
  p.querySelector('[data-ra=espalda]').style.display = e.dueno === 'yo' ? '' : 'none';
  $('radioAhora').innerHTML = e.vid ? `<div class="radioYa">${glifo(esEst(e.vid) ? 'musica' : 'video')} <b dir="auto">${esc(sinEmoji(e.tit) || e.vid)}</b></div>` : '';
  const sel = (x) => (yt ? x.id : 'rb:' + x.id) === e.vid;
  R0.innerHTML = RADIO.cargando ? `<div class="radioVacio">${esc(T('cargando'))}</div>` : !RADIO.res.length ? `<div class="radioVacio">${esc(T('sinRes'))}</div>`
    : RADIO.res.map((x, i) => yt
      ? `<button class="radioIt${sel(x) ? ' sel' : ''}" data-ra="poner:${i}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${x.id}/mqdefault.jpg"><span><b dir="auto">${esc(sinEmoji(x.t))}</b><small dir="auto">${esc(sinEmoji(x.c))}${x.d ? ' · ' + esc(x.d) : ''}</small></span></button>`
      : `<button class="radioIt est${sel(x) ? ' sel' : ''}" data-ra="poner:${i}">${x.i ? `<img loading="lazy" alt="" referrerpolicy="no-referrer" data-f="1" src="${esc(x.i)}">` : icoHTML('ico:radio')}<span><b dir="auto">${esc(sinEmoji(x.t))}</b><small dir="auto">${esc(sinEmoji([x.c, x.g, x.b ? x.b + ' kbps' : ''].filter(Boolean).join(' · ')))}</small></span></button>`).join('');
}
