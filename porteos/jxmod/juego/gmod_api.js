// ---------------- la API de Garry's Mod para el Lua de los addons ----------------
// Un solo Lua (gmod_lua.js) que hace de server y de cliente según quién llama: cada función que se registra (hook,
// timer, net.Receive, la de una entidad) recuerda de qué lado vino, y SERVER/CLIENT valen lo que corresponde en cada
// llamada. Las entidades guardan dos tablas de clase (la de init.lua y la de cl_init.lua), como en GMod. Unidades: el Lua
// ve pulgadas y Z arriba (Source); el juego, metros e Y arriba: se convierte en el borde. Lo que más usan los addons
// reales (análisis de 111 addons: Vector, Angle, ents.Create, hook, timer, net, util.TraceLine, surface/draw, SWEP...)
// está; lo que falta responde algo neutro en vez de romper el addon.
const GMA = { R: null, ctx: 'S', hooks: new Map(), timers: new Map(), tSimples: [], net: { S: new Map(), C: new Map() }, ents: new Map(), nid: 1000, clases: new Map(), armas: new Map(), efectos: new Map(), cvars: new Map(), lista: null, fuentes: new Map(), errores: [], cargados: new Set(), hud: null, entPorObj: new WeakMap(), jug: null, mundo: null, swep: null, dibujoHUD: false,
  // (los mods apagados en el panel GMod —los efectos de pantalla, por ejemplo—: sus hooks no corren; quedan guardados)
  apagados: (() => { try { return new Set(JSON.parse(localStorage.getItem('rb_gmb_apagados') || '[]').map(String)); } catch (e) { return new Set(); } })(), hookAddon: null };
const GS = 0.0254;
const gmaErr = (m) => {
  m = String(m); GMA.ultErr = true; const A = GMA.addonActual; if (A && A.luaErr && A.luaErr.length < 50) A.luaErr.push(m);
  const c = (GMA.errCuenta || (GMA.errCuenta = new Map())), n = (c.get(m) || 0) + 1; c.set(m, n); if (c.size > 500) c.clear();
  if (n > 3) return; GMA.errores.push(m); if (GMA.errores.length > 300) GMA.errores.shift(); if (typeof console !== 'undefined') console.warn('[GMod] ' + m);
};

// ---------------- valores: Vector, Angle, Color ----------------
class LVec { constructor(x, y, z) { this.x = +x || 0; this.y = +y || 0; this.z = +z || 0; } }
class LAng { constructor(p, y, r) { this.p = +p || 0; this.y = +y || 0; this.r = +r || 0; } }
const vG = (v) => (v ? v3(v.y * GS, v.z * GS, v.x * GS) : v3());               // Source → juego
const vS = (v) => new LVec(v.z / GS, v.x / GS, v.y / GS);          // juego → Source
const dG = (v) => (v ? v3(v.y, v.z, v.x) : v3(0, 0, 1));                               // direcciones
const dS = (v) => new LVec(v.z, v.x, v.y);
const RAD = Math.PI / 180;
// Angle → matriz de Source (columnas: adelante, izquierda, arriba) y al revés
function angMat(a) {
  if (!a) a = { p: 0, y: 0, r: 0 };
  const sp = Math.sin(a.p * RAD), cp = Math.cos(a.p * RAD), sy = Math.sin(a.y * RAD), cy = Math.cos(a.y * RAD), sr = Math.sin(a.r * RAD), cr = Math.cos(a.r * RAD);
  return [[cp * cy, cp * sy, -sp], [sr * sp * cy - cr * sy, sr * sp * sy + cr * cy, sr * cp], [cr * sp * cy + sr * sy, cr * sp * sy - sr * cy, cr * cp]];   // f, l, u
}
function matAng(f, l, u) {
  const xy = Math.hypot(f[0], f[1]);
  if (xy > 0.001) return new LAng(Math.atan2(-f[2], xy) / RAD, Math.atan2(f[1], f[0]) / RAD, Math.atan2(l[2], u[2]) / RAD);
  return new LAng(Math.atan2(-f[2], xy) / RAD, Math.atan2(-l[0], l[1]) / RAD, 0);
}
function angQuat(a) {   // el giro del juego
  const [f, l, u] = angMat(a), F = dG({ x: f[0], y: f[1], z: f[2] }), Lf = dG({ x: l[0], y: l[1], z: l[2] }), U = dG({ x: u[0], y: u[1], z: u[2] });
  // (en el juego el modelo convertido tiene x de Source en z del juego, y en x, z en y: la matriz va con esas columnas)
  const m = [[Lf.x, U.x, F.x], [Lf.y, U.y, F.y], [Lf.z, U.z, F.z]];
  const t = m[0][0] + m[1][1] + m[2][2]; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = 0.25 * s; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s; }
  return new Quat(x, y, z, w).norm();
}
function quatAng(q) { const F = dS(q.rot(v3(0, 0, 1))), Lf = dS(q.rot(v3(1, 0, 0))), U = dS(q.rot(v3(0, 1, 0))); return matAng([F.x, F.y, F.z], [Lf.x, Lf.y, Lf.z], [U.x, U.y, U.z]); }
const dirAng = (d) => { const xy = Math.hypot(d.x, d.y); return new LAng(Math.atan2(-d.z, xy) / RAD, Math.atan2(d.y, d.x) / RAD, 0); };

// ---------------- entidades ----------------
// una entidad de Lua: un objeto del juego (prop, entidad de un addon), el jugador, un arma o una "de punto" (sin cuerpo)
class LEnt {
  constructor(clase, tipo) { this.id = ++GMA.nid; this.clase = clase || 'prop_physics'; this.tipo = tipo || 'ent'; this.tabla = new LuaTable(); this.nw = new Map(); this.o = null; this.pos = v3(); this.q = new Quat(); this.vivo = true; this.vida = 100; this.vidaMax = 100; this.color = [255, 255, 255, 255]; this.modelo = ''; this.prox = 0; this.__mt = GMA.mtEnt; GMA.ents.set(this.id, this); }
}
const gmaDT = (e) => e.dtL || (e.dtL = new LuaTable());
const gmaTablaDe = (e) => (GMA.ctx === 'C' ? e.tablaC || (e.tablaC = new LuaTable()) : e.tabla);
const entValida = (e) => e instanceof LEnt && e.vivo && (e.tipo !== 'ent' || !e.o || !e.o.borrado);
// (el origen del modelo, que es lo que en GMod da GetPos: el cuerpo físico está en el centro del casco, corrido o.c del
// origen; antes se usaba el centro, y LocalToWorld, los asientos y las piezas quedaban hasta medio metro corridos)
const gmaOrigen = (o) => (o.c ? vsub(o.b.pos, o.b.q.rot(o.c)) : o.b.pos.clone());
const gmaOrigenPon = (o, p, q) => { o.b.pos.copy(p); if (o.c) o.b.pos.add((q || o.b.q).rot(o.c)); };
const gmaEntPos = (e) => (e.tipo === 'jug' ? (e === GMA.jug ? JUG.pos.clone().add(v3(0, -JUG.medio, 0)) : e.P ? e.P.pos.clone() : v3()) : e.P ? e.P.pos.clone() : e.o ? gmaOrigen(e.o) : e.pos.clone());
const entQ = (e) => (e.tipo === 'jug' ? Quat.axis(0, 1, 0, e === GMA.jug ? JUG.yaw : 0) : e.o ? e.o.b.q.clone() : e.q.clone());
function entDeObj(o) { let e = GMA.entPorObj.get(o); if (!e) { e = new LEnt(o.gmClase || (o.nombre && o.nombre.startsWith('gm:') ? 'prop_physics' : 'prop_physics'), 'ent'); e.o = o; e.modelo = o.nombre && o.nombre.startsWith('gm:') ? o.nombre.slice(3) : 'models/' + (o.nombre || 'error') + '.mdl'; GMA.entPorObj.set(o, e); } return e; }
// métodos de entidad que en GMod sólo están del lado del servidor
const GMA_SOLO_SERVIDOR = new Set(['Fire', 'Input', 'Use', 'Activate', 'Ignite', 'Extinguish', 'SetUseType', 'TakeDamage', 'TakeDamageInfo', 'SetTrigger', 'SetKeyValue', 'GetKeyValues', 'PointAtEntity', 'SetCreator', 'GetCreator', 'SetPhysicsAttacker', 'GetUnFreezable', 'SetUnFreezable']);
const NULL_ENT = (() => { const e = Object.create(LEnt.prototype); Object.assign(e, { id: 0, clase: 'NULL', tipo: 'null', tabla: new LuaTable(), nw: new Map(), vivo: false, pos: v3(), q: new Quat() }); return e; })();
// la clase de una entidad (la tabla ENT/SWEP del lado que corre ahora), con la cadena de bases
function claseTabla(nombre, ctx) { const c = GMA.clases.get(nombre) || GMA.armas.get(nombre); return c ? (ctx === 'C' && c.C ? c.C : c.S || c.C) : null; }

// ---------------- llamar al Lua desde el juego (con el lado y el tope de pasos) ----------------
function gmLlamar(f, ctx, ...a) {
  const R = GMA.R; if (!R || typeof f !== 'function') return E0;
  const c0 = GMA.ctx; GMA.ctx = ctx; gmaLado(ctx);
  const n0 = R.n; R.n = 0;
  try { return R.c(f, 'callback', ...a); }
  catch (e) { gmaErr(R.msgErr(e)); return E0; }
  finally { GMA.ctx = c0; gmaLado(c0); R.n = n0; }
}
// el lado en el Lua: SERVER/CLIENT y, con un modo de juego puesto, GAMEMODE (y GM) de ese lado
function gmaLado(ctx) {
  const R = GMA.R, G = R.G; G.set('SERVER', ctx === 'S'); G.set('CLIENT', ctx === 'C'); if (R.ovS) R.ov = ctx === 'C' ? R.ovC : R.ovS;
  const M = GMA.modo; if (M && !M.cargando && M.S) { const t = ctx === 'C' ? M.C : M.S; G.set('GAMEMODE', t); G.set('GM', t); }
}
const metodo = (e, nombre, ctx, ...a) => { const t = claseTabla(e.clase, ctx); if (!t) return E0; const f = buscarEnClase(t, nombre); return typeof f === 'function' ? gmLlamar(f, ctx, e, ...a) : E0; };
function buscarEnClase(t, k) { for (let n = 0; t && n < 20; n++) { const v = t.get(k); if (v !== undefined) return v; const b = t.get('BaseClass'); t = b instanceof LuaTable ? b : null; } return undefined; }

// ---------------- el Lua y su API ----------------
function gmaIniciar() {
  if (GMA.R) return GMA.R;
  const R = (GMA.R = luaCrearRuntime()), G = R.G, def = (t, n, f) => t.set(n, f), tabla = (o) => { const t = new LuaTable(); for (const k in o) t.set(k, o[k]); return t; };
  R.salida = (s) => gmaConsola(s);
  const lib = (n) => { let t = G.get(n); if (!(t instanceof LuaTable)) { t = new LuaTable(); G.set(n, t); } return t; };
  const num = (v, d) => (typeof v === 'number' ? v : R.aNum(v) ?? d);
  const vec = (v) => (v instanceof LVec ? v : new LVec());
  // ---- Vector ----
  const VM = (GMA.mtVec = new LuaTable()), VI = new LuaTable();
  VM.set('__index', (v, k) => (k === 'x' || k === 1 ? v.x : k === 'y' || k === 2 ? v.y : k === 'z' || k === 3 ? v.z : VI.get(k)));
  VM.set('__newindex', (v, k, x) => { if (k === 'x' || k === 1) v.x = +x; else if (k === 'y' || k === 2) v.y = +x; else if (k === 'z' || k === 3) v.z = +x; });
  const nv = (x, y, z) => { const v = new LVec(x, y, z); v.__mt = VM; return v; };
  GMA.nv = nv;
  VM.set('__add', (a, b) => { if (!(a instanceof LVec) || !(b instanceof LVec)) vOk(null, '__add'); return nv(a.x + b.x, a.y + b.y, a.z + b.z); }); VM.set('__sub', (a, b) => { if (!(a instanceof LVec) || !(b instanceof LVec)) vOk(null, '__sub'); return nv(a.x - b.x, a.y - b.y, a.z - b.z); });
  const vOk = (x, op) => { if (typeof x !== 'number' && !(x instanceof LVec)) GMA.R.err("bad argument to '" + op + "' (Vector or number expected, got " + R.tipo(x) + ')'); return x; };
  VM.set('__mul', (a, b) => { vOk(a, '__mul'); vOk(b, '__mul'); return typeof a === 'number' ? nv(b.x * a, b.y * a, b.z * a) : typeof b === 'number' ? nv(a.x * b, a.y * b, a.z * b) : nv(a.x * b.x, a.y * b.y, a.z * b.z); });
  VM.set('__div', (a, b) => { vOk(a, '__div'); vOk(b, '__div'); return typeof b === 'number' ? nv(a.x / b, a.y / b, a.z / b) : nv(a.x / b.x, a.y / b.y, a.z / b.z); });
  VM.set('__unm', (a) => nv(-a.x, -a.y, -a.z)); VM.set('__eq', (a, b) => a.x === b.x && a.y === b.y && a.z === b.z);
  VM.set('__tostring', (a) => R.fmtNum(+a.x.toFixed(6)) + ' ' + R.fmtNum(+a.y.toFixed(6)) + ' ' + R.fmtNum(+a.z.toFixed(6)));
  VM.set('MetaName', 'Vector');
  const len = (v) => Math.hypot(v.x, v.y, v.z);
  Object.entries({
    Length: (v) => len(v), LengthSqr: (v) => v.x * v.x + v.y * v.y + v.z * v.z, Length2D: (v) => Math.hypot(v.x, v.y), Length2DSqr: (v) => v.x * v.x + v.y * v.y,
    Distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), DistToSqr: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2, Distance2D: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    GetNormalized: (v) => { const l = len(v) || 1; return nv(v.x / l, v.y / l, v.z / l); }, GetNormal: (v) => { const l = len(v) || 1; return nv(v.x / l, v.y / l, v.z / l); },
    Normalize: (v) => { const l = len(v) || 1; v.x /= l; v.y /= l; v.z /= l; }, Dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z, DotProduct: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    Cross: (a, b) => nv(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x), Angle: (v) => { const a = dirAng(v); a.__mt = GMA.mtAng; return a; }, AngleEx: (v) => { const a = dirAng(v); a.__mt = GMA.mtAng; return a; },
    Add: (a, b) => { a.x += b.x; a.y += b.y; a.z += b.z; }, Sub: (a, b) => { a.x -= b.x; a.y -= b.y; a.z -= b.z; }, Mul: (a, k) => { a.x *= k; a.y *= k; a.z *= k; }, Div: (a, k) => { a.x /= k; a.y /= k; a.z /= k; },
    Set: (a, b) => { a.x = b.x; a.y = b.y; a.z = b.z; }, Zero: (a) => { a.x = a.y = a.z = 0; }, IsZero: (a) => !a.x && !a.y && !a.z, Unpack: (a) => [a.x, a.y, a.z], SetUnpacked: (a, x, y, z) => { a.x = x; a.y = y; a.z = z; },
    ToTable: (a) => R.tab([a.x, a.y, a.z]), ToColor: (a) => gmColor(a.x * 255, a.y * 255, a.z * 255, 255), IsEqualTol: (a, b, t) => Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t && Math.abs(a.z - b.z) <= t,
    Rotate: (v, a) => { const [f, l, u] = angMat(a), x = v.x, y = v.y, z = v.z; v.x = f[0] * x + l[0] * y + u[0] * z; v.y = f[1] * x + l[1] * y + u[1] * z; v.z = f[2] * x + l[2] * y + u[2] * z; },
    WithinAABox: (v, a, b) => v.x >= Math.min(a.x, b.x) && v.x <= Math.max(a.x, b.x) && v.y >= Math.min(a.y, b.y) && v.y <= Math.max(a.y, b.y) && v.z >= Math.min(a.z, b.z) && v.z <= Math.max(a.z, b.z),
    ToScreen: (v) => { const s = gmaPantalla(v); return tabla({ x: s.x, y: s.y, visible: s.vis }); },
  }).forEach(([k, f]) => VI.set(k, f));
  def(G, 'Vector', (x, y, z) => { if (x instanceof LVec) return nv(x.x, x.y, x.z); if (typeof x === 'string' && y === undefined && z === undefined) { const p = x.trim().split(/\s+/).map(Number); return nv(p[0] || 0, p[1] || 0, p[2] || 0); } return nv(num(x, 0), num(y, 0), num(z, 0)); });   // (Vector("1 2 3") o Vector("1", "2", "3"), como GMod)
  def(G, 'VectorRand', (a, b) => { if (a !== undefined) return nv(a + Math.random() * (b - a), a + Math.random() * (b - a), a + Math.random() * (b - a)); const v = nv(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); return v; });
  def(G, 'LerpVector', (t, a, b) => nv(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t));
  // ---- Angle ----
  const AM = (GMA.mtAng = new LuaTable()), AI = new LuaTable();
  const na = (p, y, r) => { const a = new LAng(p, y, r); a.__mt = AM; return a; };
  GMA.na = na;
  AM.set('__index', (a, k) => (k === 'p' || k === 'pitch' || k === 'x' || k === 1 ? a.p : k === 'y' || k === 'yaw' || k === 2 ? a.y : k === 'r' || k === 'roll' || k === 'z' || k === 3 ? a.r : AI.get(k)));
  AM.set('__newindex', (a, k, x) => { if (k === 'p' || k === 'pitch' || k === 'x' || k === 1) a.p = +x; else if (k === 'y' || k === 'yaw' || k === 2) a.y = +x; else if (k === 'r' || k === 'roll' || k === 'z' || k === 3) a.r = +x; });
  AM.set('__add', (a, b) => { if (!(a instanceof LAng) || !(b instanceof LAng)) vOk(null, '__add'); return na(a.p + b.p, a.y + b.y, a.r + b.r); }); AM.set('__sub', (a, b) => { if (!(a instanceof LAng) || !(b instanceof LAng)) vOk(null, '__sub'); return na(a.p - b.p, a.y - b.y, a.r - b.r); });
  AM.set('__mul', (a, b) => (typeof a === 'number' ? na(b.p * a, b.y * a, b.r * a) : na(a.p * b, a.y * b, a.r * b))); AM.set('__div', (a, b) => na(a.p / b, a.y / b, a.r / b));
  AM.set('__unm', (a) => na(-a.p, -a.y, -a.r)); AM.set('__eq', (a, b) => a.p === b.p && a.y === b.y && a.r === b.r);
  AM.set('__tostring', (a) => R.fmtNum(+a.p.toFixed(3)) + ' ' + R.fmtNum(+a.y.toFixed(3)) + ' ' + R.fmtNum(+a.r.toFixed(3))); AM.set('MetaName', 'Angle');
  const nrm = (x) => { x = ((x + 180) % 360 + 360) % 360 - 180; return x; };
  Object.entries({
    Forward: (a) => { const f = angMat(a)[0]; return nv(f[0], f[1], f[2]); }, Right: (a) => { const l = angMat(a)[1]; return nv(-l[0], -l[1], -l[2]); }, Up: (a) => { const u = angMat(a)[2]; return nv(u[0], u[1], u[2]); },
    Normalize: (a) => { a.p = nrm(a.p); a.y = nrm(a.y); a.r = nrm(a.r); }, Zero: (a) => { a.p = a.y = a.r = 0; }, IsZero: (a) => !a.p && !a.y && !a.r, Set: (a, b) => { a.p = b.p; a.y = b.y; a.r = b.r; },
    Unpack: (a) => [a.p, a.y, a.r], SetUnpacked: (a, p, y, r) => { a.p = p; a.y = y; a.r = r; }, Add: (a, b) => { a.p += b.p; a.y += b.y; a.r += b.r; }, Sub: (a, b) => { a.p -= b.p; a.y -= b.y; a.r -= b.r; },
    RotateAroundAxis: (a, ax, g) => { // (giro alrededor de un eje: con matrices)
      const [f, l, u] = angMat(a), A = len(ax) || 1, kx = ax.x / A, ky = ax.y / A, kz = ax.z / A, c = Math.cos(g * RAD), s = Math.sin(g * RAD);
      const rot = (v) => { const d = kx * v[0] + ky * v[1] + kz * v[2]; return [v[0] * c + (ky * v[2] - kz * v[1]) * s + kx * d * (1 - c), v[1] * c + (kz * v[0] - kx * v[2]) * s + ky * d * (1 - c), v[2] * c + (kx * v[1] - ky * v[0]) * s + kz * d * (1 - c)]; };
      const r = matAng(rot(f), rot(l), rot(u)); a.p = r.p; a.y = r.y; a.r = r.r;
    },
  }).forEach(([k, f]) => AI.set(k, f));
  def(G, 'Angle', (p, y, r) => { if (p instanceof LAng) return na(p.p, p.y, p.r); if (typeof p === 'string' && y === undefined && r === undefined) { const q = p.trim().split(/\s+/).map(Number); return na(q[0] || 0, q[1] || 0, q[2] || 0); } return na(num(p, 0), num(y, 0), num(r, 0)); });
  def(G, 'LerpAngle', (t, a, b) => na(a.p + nrm(b.p - a.p) * t, a.y + nrm(b.y - a.y) * t, a.r + nrm(b.r - a.r) * t));
  // ---- Color (una tabla con metatabla, como en GMod) ----
  const CM = (GMA.mtCol = new LuaTable()); CM.set('__index', CM); CM.set('MetaName', 'Color');
  CM.set('__tostring', (c) => [c.get('r'), c.get('g'), c.get('b'), c.get('a')].join(' ')); CM.set('__eq', (a, b) => ['r', 'g', 'b', 'a'].every((k) => a.get(k) === b.get(k)));
  const gmColor = (r, g, b, a) => { const t = new LuaTable(); t.set('r', Math.min(255, num(r, 255) | 0)); t.set('g', Math.min(255, num(g, 255) | 0)); t.set('b', Math.min(255, num(b, 255) | 0)); t.set('a', Math.min(255, num(a, 255) | 0)); t.mt = CM; return t; };
  GMA.color = gmColor;
  CM.set('ToVector', (c) => nv(num(c.get('r'), 255) / 255, num(c.get('g'), 255) / 255, num(c.get('b'), 255) / 255)); CM.set('ToTable', (c) => R.tab([c.get('r'), c.get('g'), c.get('b'), c.get('a')]));
  CM.set('Unpack', (c) => [c.get('r'), c.get('g'), c.get('b'), c.get('a')]); CM.set('Copy', (c) => gmColor(c.get('r'), c.get('g'), c.get('b'), c.get('a')));
  def(G, 'Color', (r, g, b, a) => gmColor(r, g, b, a === undefined ? 255 : a));
  def(G, 'ColorAlpha', (c, a) => gmColor(c.get('r'), c.get('g'), c.get('b'), a));
  def(G, 'HSVToColor', (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0); }; return gmColor(f(5) * 255, f(3) * 255, f(1) * 255, 255); });
  def(G, 'IsColor', (c) => c instanceof LuaTable && c.mt === CM);
  // ---- entidades ----
  const EM = (GMA.mtEnt = new LuaTable()), ENT_M = new LuaTable(), PLY_M = new LuaTable(), WEP_M = new LuaTable(), NPC_M = new LuaTable(), VEH_M = new LuaTable(), PHY_M = new LuaTable();
  GMA.metas = { Entity: ENT_M, Player: PLY_M, Weapon: WEP_M, NPC: NPC_M, Vehicle: VEH_M, PhysObj: PHY_M, Vector: VI, Angle: AI };
  for (const [n, t] of Object.entries(GMA.metas)) { t.set('MetaName', n); if (n !== 'Vector' && n !== 'Angle' && n !== 'Entity') { const m = new LuaTable(); m.set('__index', ENT_M); t.mt = m; } }
  EM.set('__index', (e, k) => {
    let v = (GMA.ctx === 'C' ? e.tablaC || e.tabla : e.tabla).get(k); if (v !== undefined) return v;
    if (k === 'dt') return gmaDT(e);
    if (k === 'loco' && e.nb && typeof gmnbLoco === 'function') return gmnbLoco(e);
    if (e.dt) { v = e.dt.get(k); if (v !== undefined) return v; }
    if (e.tipo === 'efecto') { v = gmrMetodo(e, k); if (v !== undefined) return v; }
    else if (e.tipo !== 'null') { const c = claseTabla(e.clase, GMA.ctx); if (c) { v = buscarEnClase(c, k); if (v !== undefined) {
      // (en GMod los métodos del motor van antes que la tabla de la clase: un ENT.Health = 0 no tapa self:Health())
      // (salvo, del lado del cliente, los métodos que en GMod sólo existen en el servidor: un ENT.Fire = 0 se lee como 0 en el
      // cliente, porque ahí Entity:Fire no existe; el minigun de los Drones multiplicaba por la función)
      if (typeof v !== 'function' && typeof k === 'string' && /^[A-Z]/.test(k) && !(GMA.ctx === 'C' && GMA_SOLO_SERVIDOR.has(k))) { const M = e.tipo === 'jug' ? PLY_M : e.tipo === 'arma' ? WEP_M : e.tipo === 'npc' ? NPC_M : ENT_M, f = M.get(k) ?? ENT_M.get(k); if (typeof f === 'function') return f; }
      return v; } } }
    if (k === 'Owner') return e.dueño || NULL_ENT;
    if (k === 'Weapon' || k === 'Entity') return e;   // (self.Weapon y self.Entity: la misma entidad, como en GMod)
    // (del lado del cliente, Fire e Input no existen en GMod: muchos addons usan self.Fire como variable que llega por net)
    if (GMA.ctx === 'C' && (k === 'Fire' || k === 'Input')) return undefined;
    const M = e.tipo === 'jug' ? PLY_M : e.tipo === 'arma' ? WEP_M : e.tipo === 'npc' ? NPC_M : ENT_M; v = M.get(k); if (v === undefined && M !== ENT_M) v = ENT_M.get(k);
    return v;
  });
  EM.set('__newindex', (e, k, v) => gmaTablaDe(e).set(k, v));
  EM.set('__eq', (a, b) => a === b || (a instanceof LEnt && b instanceof LEnt && a.id === b.id));
  EM.set('__tostring', (e) => (e.tipo === 'null' ? '[NULL Entity]' : e.tipo === 'jug' ? 'Player [1][' + (PREFS.nombre || 'Player') + ']' : 'Entity [' + e.id + '][' + e.clase + ']'));
  EM.set('__concat', (a, b) => R.tostr(a) + R.tostr(b));
  def(G, 'NULL', NULL_ENT); NULL_ENT.__mt = EM;
  // un método del motor que todavía no está: no rompe el addon (devuelve nada, o false si pregunta Is/Has/Can) y queda anotado
  GMA.faltan = GMA.faltan || new Map();
  R.metodoFalta = (o, m) => {
    if (typeof m !== 'string' || !/^[A-Z]/.test(m)) return null;
    const tipo = o instanceof LEnt ? (o.tipo === 'jug' ? 'Player' : o.tipo === 'arma' ? 'Weapon' : o.tipo === 'npc' ? 'NPC' : 'Entity') : (GMA.tipoNombre && GMA.tipoNombre(o)) || 'objeto';
    const k = tipo + ':' + m; GMA.faltan.set(k, (GMA.faltan.get(k) || 0) + 1);
    return /^(Is|Has|Can|Should|Was|Did)[A-Z]/.test(m) ? [false] : E0;
  };
  // constantes de GMod que no están en el prelude (ACT_*, KEY_*...): un número fijo por nombre en vez de nil
  const PRE_ENUM = /^(ACT|KEY|JOYSTICK|BUTTON_CODE|SCHED|TASK|COND|MAT|STENCIL|STENCILOPERATION|STENCILCOMPARISONFUNCTION|MATERIAL|TEXTUREFLAGS|CREATERENDERTARGETFLAGS|NAV|CAP|CLASS|NPC_STATE|SF|EFL|FVPHYSICS|PLAYERANIMEVENT|GESTURE_SLOT|SURF|DISPSURF|TRANSMIT|PATTACH|OBS_MODE|RENDERGROUP|SNDLVL|FCVAR|CONTENTS|MASK|SOLID|FSOLID|COLLISION_GROUP|MOVETYPE|DMG|HITGROUP|AMMO|IN|EF|FL|BLOOD_COLOR|CHAN|TYPE|NOTIFY|ANIM|AI|BONE|SCREENFADE|SIM|TRACER|EFFECT|FORCE|HULL|NUM|GMOD|LAST|FIRST|D|BLEND|BLENDFUNC|TEXFILTER|RT_SIZE|IMAGE_FORMAT|SND|USE|BOX|TEAM|PLAYER|WEAPON_PROFICIENCY|MOVECOLLIDE|kRenderFx)_[A-Z0-9_]+$|^kRenderFx[A-Z]/;
  const GM = new LuaTable(), cacheEnum = new Map(); GM.set('__index', (t, k) => {
    if (R.ov && t === G) { const v = R.ov.get(k); if (v !== undefined) return v; }   // (_G.X de una global de este lado)
    if (typeof k !== 'string' || !PRE_ENUM.test(k)) return undefined;
    let c = cacheEnum.get(k); if (c === undefined) { let h = 5381; for (let j = 0; j < k.length; j++) h = (h * 33 + k.charCodeAt(j)) % 1000000; c = k === 'GMOD_MAXDTVARS' ? 32 : 4000 + (h % 900000); cacheEnum.set(k, c); }
    return c;
  });
  G.mt = GM;
  gmaApiEntidades(R, G, ENT_M, PLY_M, WEP_M, NPC_M, PHY_M, def, tabla, num);
  gmaApiLibs(R, G, def, tabla, lib, num);
  if (typeof gmmApi === 'function') gmmApi(R, G, PLY_M, def, tabla, num);
  if (typeof gmhApi === 'function') gmhApi(R, G);
  // las bibliotecas del motor (C++ en GMod): una función que falta no rompe el addon; queda anotada como las de las entidades
  for (const n of ['util', 'render', 'surface', 'cam', 'game', 'engine', 'physenv', 'sound', 'ents', 'player', 'input', 'gui', 'system', 'navmesh', 'steamworks', 'video', 'mesh', 'killicon', 'resource', 'file', 'sql', 'debugoverlay', 'effects', 'construct', 'properties', 'ai', 'achievements', 'frame_blend', 'drive', 'numpad', 'presets', 'cleanup', 'undo', 'spawnmenu', 'search', 'widgets', 'matproxy', 'motionsensor', 'serverlist', 'permissions', 'chat', 'notification', 'language', 'derma', 'vgui']) {
    let t = G.get(n); if (t === undefined || t === null) G.set(n, (t = new LuaTable()));   // (en GMod todas existen: un addon que hace debugoverlay.Line no se cae)
    if (!(t instanceof LuaTable) || t.mt) continue;
    const m = new LuaTable(); m.set('__index', (x, k) => { if (typeof k !== 'string' || !/^[A-Z]/.test(k)) return undefined; const c = n + '.' + k; GMA.faltan.set(c, (GMA.faltan.get(c) || 0) + 1); return /^(Is|Has|Can|Should)[A-Z]/.test(k) ? () => false : () => undefined; }); t.mt = m;
  }
  gmaTipos(R, G, def);
  // el prelude en Lua (extensiones de string/table/math, weapon_base...)
  try { luaCompilar(GMA_PRELUDE, 'gmod/prelude.lua', R)(); } catch (e) { gmaErr('prelude: ' + R.msgErr(e)); }
  G.set('SERVER', true); G.set('CLIENT', false);
  R.ovS = new LuaTable(); R.ovC = new LuaTable(); R.ov = R.ovS;   // (desde acá, las globales nuevas de los addons van al lado que corre)
  return R;
}
const gmaConsola = (s) => { GMA.consola = (GMA.consola || []); GMA.consola.push(String(s)); if (GMA.consola.length > 200) GMA.consola.shift(); };
// un punto de Source en la pantalla
function gmaPantalla(v) {
  const p = vG(v), c = new Float32Array(4); const m = R.vpMundo || R.vp; if (!m) return { x: 0, y: 0, vis: false };
  const x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12], y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13], w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  const W = VW(), H = VH(); return { x: (x / w * 0.5 + 0.5) * W, y: (1 - (y / w * 0.5 + 0.5)) * H, vis: w > 0 };
}

// ---------------- métodos de entidades, jugadores, armas y física ----------------
function gmaApiEntidades(R, G, ENT_M, PLY_M, WEP_M, NPC_M, PHY_M, def, tabla, num) {
  const V = (g) => { const v = vS(g); v.__mt = GMA.mtVec; return v; }, Vd = (g) => { const v = dS(g); v.__mt = GMA.mtVec; return v; }, A = (a) => { a.__mt = GMA.mtAng; return a; };
  GMA.V = V; GMA.Vd = Vd; GMA.A = A;
  const E = (n, f) => ENT_M.set(n, f), P = (n, f) => PLY_M.set(n, f), W = (n, f) => WEP_M.set(n, f), F = (n, f) => PHY_M.set(n, f);
  const yo = () => GMA.jug;
  E('IsValid', (e) => entValida(e)); E('EntIndex', (e) => (e.tipo === 'jug' ? 1 : e.id)); E('GetClass', (e) => e.clase);
  E('GetPos', (e) => V(gmaEntPos(e)));
  E('SetPos', (e, v) => { if (!(v instanceof LVec)) return; const p = vG(v); if (e === yo()) { JUG.pos.copy(p).add(v3(0, JUG.medio, 0)); JUG.vel.set(0, 0, 0); } else if (e.o) { gmaOrigenPon(e.o, p); e.o.b.wake(); e.o.b.updateWorld(); } else e.pos.copy(p); if (e.padre || e.soldadoA) gmaPadreFijar(e, 'pos'); });
  E('GetAngles', (e) => A(e === yo() ? new LAng(0, quatAng(Quat.axis(0, 1, 0, JUG.yaw)).y, 0) : quatAng(entQ(e))));
  E('SetAngles', (e, a) => { if (!(a instanceof LAng)) return; const q = angQuat(a); if (e === yo()) { JUG.yaw = Math.atan2(q.rot(v3(0, 0, 1)).x, q.rot(v3(0, 0, 1)).z); } else if (e.o) { const org = gmaOrigen(e.o); e.o.b.q.copy(q); gmaOrigenPon(e.o, org); e.o.b.wake(); e.o.b.updateWorld(); } else e.q.copy(q); if (e.padre || e.soldadoA) gmaPadreFijar(e, 'ang'); });
  E('GetVelocity', (e) => V(e === yo() ? JUG.vel : e.o ? e.o.b.vel : v3()));
  E('SetVelocity', (e, v) => { const g = vG(v); if (e === yo()) JUG.vel.add(g); else if (e.o) { e.o.b.vel.copy(g); e.o.b.wake(); } });
  const dirE = (e, k) => { const a = e === yo() ? dirAng(dS(CAM.fwd)) : quatAng(entQ(e)), m = angMat(a); const v = k === 0 ? m[0] : k === 1 ? m[1].map((x) => -x) : m[2]; return GMA.nv(v[0], v[1], v[2]); };
  E('GetForward', (e) => dirE(e, 0)); E('GetRight', (e) => dirE(e, 1)); E('GetUp', (e) => dirE(e, 2));
  E('LocalToWorld', (e, v) => V(gmaEntPos(e).add(entQ(e).rot(vG(v))))); E('WorldToLocal', (e, v) => V(entQ(e).conj().rot(vsub(vG(v), gmaEntPos(e)))));
  E('LocalToWorldAngles', (e, a) => A(quatAng(new Quat().mulTo(entQ(e), angQuat(a))))); E('WorldToLocalAngles', (e, a) => A(quatAng(new Quat().mulTo(entQ(e).conj(), angQuat(a)))));
  const caja = (e) => { const k = e.o && DATA.pfPorNombre[e.o.nombre], d = k ? DATA.ms[DATA.pf[k][0].m] : null; if (!d || !d.mn) return [new LVec(-8, -8, 0), new LVec(8, 8, 16)]; const mn = vS(v3(d.mn[0], d.mn[1], d.mn[2])), mx = vS(v3(d.mn[0] + d.sc[0], d.mn[1] + d.sc[1], d.mn[2] + d.sc[2])); return [mn, mx]; };
  E('OBBMins', (e) => { const v = caja(e)[0]; v.__mt = GMA.mtVec; return v; }); E('OBBMaxs', (e) => { const v = caja(e)[1]; v.__mt = GMA.mtVec; return v; });
  E('OBBCenter', (e) => { const [a, b] = caja(e); return GMA.nv((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); });
  E('WorldSpaceCenter', (e) => { const [a, b] = caja(e); return V(gmaEntPos(e).add(entQ(e).rot(vG(new LVec((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2))))); });
  E('BoundingRadius', (e) => { const [a, b] = caja(e); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 2; });
  E('GetCollisionBounds', (e) => { const [a, b] = caja(e); a.__mt = b.__mt = GMA.mtVec; return [a, b]; });
  E('SetModel', (e, m) => { e.modelo = String(m || '').toLowerCase().replace(/\\/g, '/'); if (e.creado && e.vivo && (e.o || GMA.iniciando === e)) gmaRehacer(e); });
  E('GetModel', (e) => e.modelo); E('Spawn', (e) => gmaSpawn(e)); E('Activate', () => {}); E('Remove', (e) => gmaQuitar(e));
  E('SetColor', (e, c) => { if (c instanceof LuaTable) e.color = ['r', 'g', 'b', 'a'].map((k) => c.get(k) ?? 255); }); E('GetColor', (e) => GMA.color(...e.color));
  E('SetMaterial', (e, m) => { e.material = m; }); E('GetMaterial', (e) => e.material || ''); E('SetSkin', (e, s) => { e.skin = s; }); E('GetSkin', (e) => e.skin || 0); E('SkinCount', () => 1);
  E('SetBodygroup', () => {}); E('GetBodygroup', () => 0); E('SetBodyGroups', () => {}); E('GetNumBodyGroups', () => 1);
  // (la lista de grupos del modelo: uno solo, el cuerpo, con su única variante; SetIK, sin cinemática inversa que apagar)
  E('GetBodyGroups', () => { const t = new LuaTable(), g = new LuaTable(), sm = new LuaTable(); sm.set(0, ''); g.set('id', 0); g.set('name', 'studio'); g.set('num', 1); g.set('submodels', sm); t.set(1, g); return t; });
  E('GetBodygroupCount', () => 1); E('GetBodygroupName', () => 'studio'); E('FindBodygroupByName', () => -1); E('SetIK', () => {});
  E('SetNoDraw', (e, b) => { e.noDraw = !!b; if (e.o) e.o.gmOculto = !!b; }); E('GetNoDraw', (e) => !!e.noDraw);
  for (const n of ['DrawShadow', 'SetRenderMode', 'SetRenderFX', 'DrawModel', 'SetModelScale', 'SetUseType', 'SetTrigger', 'SetLagCompensated', 'SetPredictable', 'AddEffects', 'RemoveEffects', 'AddFlags', 'RemoveFlags', 'SetSolidFlags', 'SetSequence', 'ResetSequence', 'SetPlaybackRate', 'SetCycle', 'FrameAdvance', 'SetPoseParameter', 'ManipulateBoneAngles', 'ManipulateBonePosition', 'ManipulateBoneScale', 'SetupBones', 'InvalidateBoneCache', 'SetAnimation', 'SetLocalVelocity', 'SetFriction', 'SetElasticity', 'StartMotionController', 'StopMotionController', 'SetSubMaterial', 'CallOnRemove', 'DeleteOnRemove', 'SetShouldServerRagdoll', 'SetSpawnEffect', 'SetBloodColor', 'AddCallback', 'SetHitboxSet', 'EnableCustomCollisions', 'CollisionRulesChanged', 'RemoveAllDecals', 'SetSaveValue', 'MarkShadowAsDirty', 'CreateShadow', 'DestroyShadow', 'SetRenderBounds', 'SetRenderBoundsWS', 'SetRenderOrigin', 'SetRenderAngles', 'SetLOD', 'UseClientSideAnimation', 'SetAutomaticFrameAdvance', 'SetLocalAngularVelocity', 'SetMoveCollide', 'Input', 'TakePhysicsDamage', 'SetCreator', 'PhysWake', 'StopParticles']) E(n, () => {});
  E('DrawModel', (e) => gmrDrawModel(e));
  // dónde se dibuja (los portales, las armas del mundo en la mano): si nadie lo puso, donde está la entidad
  // (más del motor que piden los addons: límites de choque y de dibujo, NPCs, banderas, matriz de escala)
  for (const n of ['SetNPCMinBurst', 'SetNPCMaxBurst', 'SetNPCFireRate', 'SetPhysicsAttacker', 'SetupWeaponHoldTypeForAI', 'SetHullType', 'SetHullSizeNormal', 'SetAllowFullRotation', 'AddEFlags', 'RemoveEFlags', 'SetNPCState', 'SetMaxYawSpeed', 'CapabilitiesAdd', 'CapabilitiesRemove', 'CapabilitiesClear', 'DisableMatrix', 'SetMoveType', 'SetKeyValue', 'SetPhysicsAttacker', 'SetSurroundingBounds', 'SetSurroundingBoundsType', 'SetCollisionBoundsWS', 'Activate', 'Spawn']) if (!ENT_M.get(n)) E(n, () => {});
  E('IsEFlagSet', () => false); E('IsPlayerHolding', () => false);
  E('SetCollisionBounds', (e, a, b) => { if (a instanceof LVec && b instanceof LVec) e.limites = [new LVec(a.x, a.y, a.z), new LVec(b.x, b.y, b.z)]; });
  E('GetCollisionBounds', (e) => { const [a, b] = e.limites || caja(e); return [GMA.nv(a.x, a.y, a.z), GMA.nv(b.x, b.y, b.z)]; });
  E('GetRenderBounds', (e) => { const [a, b] = e.limites || caja(e); return [GMA.nv(a.x, a.y, a.z), GMA.nv(b.x, b.y, b.z)]; });
  E('GetModelBounds', (e) => { const [a, b] = caja(e); return [GMA.nv(a.x, a.y, a.z), GMA.nv(b.x, b.y, b.z)]; });
  E('EnableMatrix', (e, nombre, m) => { if (m && m.m) e.matriz = m; }); E('GetSurroundingBounds', (e) => { const p = gmaEntPos(e), [a, b] = e.limites || caja(e), o = vS(p); return [GMA.nv(o.x + a.x, o.y + a.y, o.z + a.z), GMA.nv(o.x + b.x, o.y + b.y, o.z + b.z)]; });
  P('CrosshairDisable', (e) => { e.sinMira = true; }); P('CrosshairEnable', (e) => { e.sinMira = false; });
  P('SetViewEntity', (e, v) => { e.vistaEnt = v instanceof LEnt && v.tipo !== 'null' ? v : null; }); P('GetViewEntity', (e) => e.vistaEnt && entValida(e.vistaEnt) ? e.vistaEnt : e);
  P('SetViewOffset', (e, v) => { if (v instanceof LVec) e.vistaOff = new LVec(v.x, v.y, v.z); }); P('GetViewOffset', (e) => (e.vistaOff ? GMA.nv(e.vistaOff.x, e.vistaOff.y, e.vistaOff.z) : GMA.nv(0, 0, 64)));
  P('SetViewOffsetDucked', () => {}); P('GetViewOffsetDucked', () => GMA.nv(0, 0, 28)); P('SetHull', () => {}); P('SetHullDuck', () => {}); P('GetHull', () => [GMA.nv(-16, -16, 0), GMA.nv(16, 16, 72)]); P('GetHullDuck', () => [GMA.nv(-16, -16, 0), GMA.nv(16, 16, 36)]);
  E('SetRenderOrigin', (e, p) => { e.rOrigen = p instanceof LVec ? new LVec(p.x, p.y, p.z) : null; }); E('GetRenderOrigin', (e) => (e.rOrigen ? GMA.nv(e.rOrigen.x, e.rOrigen.y, e.rOrigen.z) : V(gmaEntPos(e))));
  E('SetRenderAngles', (e, a) => { e.rAng = a instanceof LAng ? new LAng(a.p, a.y, a.r) : null; }); E('GetRenderAngles', (e) => A(e.rAng ? new LAng(e.rAng.p, e.rAng.y, e.rAng.r) : quatAng(entQ(e)))); E('SetModelScale', (e, s) => { e.escala = s; }); E('GetModelScale', (e) => e.escala || 1);
  E('PhysicsInit', (e, t) => { e.solido = e.solidoT = num(t, 6) | 0; if (e.creado && e.vivo && !e.o && e.modelo) gmaRehacer(e); gmaSolidez(e); return true; }); E('PhysicsInitSphere', (e) => { e.solido = e.solidoT = 6; gmaSolidez(e); return true; }); E('PhysicsInitBox', (e) => { e.solido = e.solidoT = 6; gmaSolidez(e); return true; }); E('PhysicsInitShadow', () => true); E('PhysicsDestroy', (e) => { e.solido = 0; });
  E('SetMoveType', (e, t) => { e.mov = t; if (e.o) { e.o.b.frozen = t === 0; if (t !== 0) e.o.b.wake(); } }); E('GetMoveType', (e) => e.mov ?? 6);
  E('GetSequence', () => 0); E('LookupSequence', () => -1); E('SequenceDuration', () => 1); E('GetPlaybackRate', (e) => e.velAnim ?? 1); E('SetPlaybackRate', (e, r) => { e.velAnim = Number.isFinite(+r) ? +r : 1; }); E('GetCycle', () => 0); E('GetPoseParameter', () => 0);
  E('GetPhysicsObject', (e) => { const f = e.fis || (e.fis = { e, __mt: GMA.mtPhy }); return f; }); E('GetPhysicsObjectCount', (e) => (e.o ? 1 : 0)); E('GetPhysicsObjectNum', (e) => ENT_M.get('GetPhysicsObject')(e));
  E('EmitSound', (e, s, nivel, tono, vol) => gmaSonar(s, gmaEntPos(e), vol, tono)); E('StopSound', () => {});
  E('Health', (e) => (e === yo() ? Math.max(0, Math.round(JUG.vida)) : e.P ? (e.P.vivo === false || (e.P.rag && e.P.npc && !(e.P.vida > 0)) ? 0 : typeof e.P.vida === 'number' ? Math.max(0, Math.round(e.P.vida)) : e.vida) : e.vida)); E('SetHealth', (e, h) => { if (e === yo()) JUG.vida = num(h, 100); else e.vida = num(h, 100); });
  E('GetMaxHealth', (e) => (e === yo() ? 100 : e.vidaMax)); E('SetMaxHealth', (e, h) => { e.vidaMax = num(h, 100); });
  E('TakeDamage', (e, d, at, inf) => gmaDanar(e, num(d, 0), at, inf)); E('TakeDamageInfo', (e, di) => gmaDanar(e, di && di.dan || 0, di && di.at, di && di.inf, di));
  E('NextThink', (e, t) => { e.prox = num(t, 0); }); E('SetNextThink', (e, t) => { e.prox = num(t, 0); });
  E('SetOwner', (e, o) => { e.dueño = o instanceof LEnt ? o : null; gmaSolidez(e); }); E('GetOwner', (e) => e.dueño || NULL_ENT);
  E('SetParent', (e, p) => gmaPadre(e, p instanceof LEnt && p !== e && p.tipo !== 'mundo' ? p : null)); E('GetParent', (e) => e.padre || NULL_ENT); E('GetMoveParent', (e) => e.padre || NULL_ENT);
  E('GetChildren', (e) => { const t = new LuaTable(); let i = 1; if (GMA.hijos) for (const h of GMA.hijos) if (h.padre === e && h.vivo) t.set(i++, h); return t; });
  E('SetSolid', (e, t) => { e.solidoT = num(t, 0) | 0; gmaSolidez(e); }); E('GetSolid', (e) => gmaSolidoTipo(e)); E('SetNotSolid', (e, b) => { e.noSolido = b !== false && b !== undefined && b !== null; gmaSolidez(e); });
  E('IsSolid', (e) => gmaSolidoTipo(e) !== 0); E('SetCollisionGroup', (e, g) => { e.grupoCol = num(g, 0) | 0; gmaSolidez(e); }); E('GetCollisionGroup', (e) => e.grupoCol | 0);
  E('GetCreator', (e) => e.creador || yo()); E('SetCreator', (e, p) => { e.creador = p; });
  E('IsPlayer', (e) => e.tipo === 'jug'); E('IsNPC', (e) => e.tipo === 'npc'); E('IsWeapon', (e) => e.tipo === 'arma'); E('IsVehicle', (e) => !!(e.o && e.o.veh)); E('IsWorld', (e) => e.tipo === 'mundo'); E('IsRagdoll', (e) => e.clase === 'prop_ragdoll'); E('IsNextBot', () => false);
  E('IsOnGround', (e) => (e === yo() ? !!JUG.suelo : !!(e.o && e.o.b.sleep))); E('GetGroundEntity', () => GMA.mundo); E('WaterLevel', () => 0); E('IsOnFire', (e) => !!e.fuego);
  E('Ignite', (e, t) => { e.fuego = TIEMPO.t + num(t, 5); }); E('Extinguish', (e) => { e.fuego = 0; }); E('IsInWorld', () => true); E('Visible', () => true); E('IsDormant', () => false);
  E('Fire', (e, inp, val, dem) => { GMA.tSimples.push({ t: TIEMPO.t + Math.max(0, +dem || 0), f: () => { if (e.vivo !== false) gmaEntrada(e, String(inp || ''), val); }, ctx: 'S', js: true }); });   // (como en GMod: va a la cola, en tiempo del juego; con demora 0, al cuadro siguiente) E('Input', (e, inp, a, c, val) => gmaEntrada(e, String(inp || ''), val)); E('SetKeyValue', (e, k, v) => { (e.kv || (e.kv = new Map())).set(k, v); }); E('GetKeyValues', (e) => tabla(Object.fromEntries(e.kv || [])));
  E('GetTable', (e) => { const T = gmaTablaDe(e); if (!T.mt) { const m = new LuaTable(); m.set('__index', (t, k) => { if (k === 'dt') return gmaDT(e); if (k === 'Entity' || k === 'Weapon') return e; if (k === 'Owner') return e.dueño || NULL_ENT; const c = e.tipo === 'efecto' ? e.efecto : claseTabla(e.clase, GMA.ctx); const v = c ? buscarEnClase(c, k) : undefined; if (v !== undefined) return v; const f = GMA.mtEnt.get('__index')(e, k); return typeof f === 'function' ? (s, ...x) => f(s === t ? e : s, ...x) : f; }); T.mt = m; } return T; }); E('SetTable', (e, t) => { if (t instanceof LuaTable) { if (GMA.ctx === 'C') e.tablaC = t; else e.tabla = t; } }); E('SetVar', (e, k, v) => gmaTablaDe(e).set(k, v)); E('GetVar', (e, k, d) => gmaTablaDe(e).get(k) ?? d);
  E('GetBoneCount', () => 0); E('LookupBone', () => undefined); E('GetBonePosition', (e) => [V(gmaEntPos(e)), A(quatAng(entQ(e)))]); E('GetBoneMatrix', () => undefined);
  E('LookupAttachment', (e, n) => { const M = gmaModeloInfo(e); const i = M ? M.adjuntos.findIndex((a) => a.n.toLowerCase() === String(n).toLowerCase()) : -1; return i < 0 ? 0 : i + 1; });
  E('GetAttachment', (e, i) => { if (e.tipo === 'vm') { const p = (typeof vistaPuntaMundo === 'function' && vistaPuntaMundo()) || vadd(CAM.pos, vadd(vscale(CAM.fwd, 0.6), vadd(vscale(CAM.der, 0.15), vscale(CAM.arr, -0.12)))); return tabla({ Pos: V(p), Ang: A(dirAng(dS(CAM.fwd))), Bone: 0 }); } const M = gmaModeloInfo(e), a = M && M.adjuntos[i - 1]; if (!M) return tabla({ Pos: V(gmaEntPos(e)), Ang: A(quatAng(entQ(e))), Bone: 0 }); if (!a) return undefined; const lp = new LVec(a.m[3], a.m[7], a.m[11]); const w = gmaEntPos(e).add(entQ(e).rot(vG(lp))); return tabla({ Pos: V(w), Ang: A(quatAng(entQ(e))) }); });
  E('GetAttachments', (e) => { const M = gmaModeloInfo(e); return R.tab((M ? M.adjuntos : []).map((a, i) => tabla({ id: i + 1, name: a.n }))); });
  E('Use', (e, act, caller) => gmaUsar(e, act || caller)); E('GetName', (e) => e.nombre || ''); E('SetName', (e, n) => { e.nombre = n; }); E('MapCreationID', () => -1); E('GetSpawnEffect', () => false);
  E('GetBrushPlane', () => undefined); E('GetFlags', () => 0); E('IsFlagSet', () => false); E('GetEffects', () => 0); E('IsEffectActive', () => false); E('GetRenderMode', () => 0); E('GetMoveCollide', () => 0);
  E('GetNetworkOrigin', (e) => V(gmaEntPos(e))); E('GetLocalPos', (e) => (e.padre && e.padreOff ? V(e.padreOff) : V(gmaEntPos(e)))); E('SetLocalPos', (e, v) => { if (e.padre && v instanceof LVec) { e.padreOff = vG(v); gmaHijoMover(e); } else ENT_M.get('SetPos')(e, v); });
  E('GetLocalAngles', (e) => (e.padre && e.padreQ ? A(quatAng(e.padreQ)) : ENT_M.get('GetAngles')(e))); E('SetLocalAngles', (e, a) => { if (e.padre && a instanceof LAng) { e.padreQ = angQuat(a); gmaHijoMover(e); } else ENT_M.get('SetAngles')(e, a); });
  E('EyePos', (e) => V(e === yo() ? CAM.pos : gmaEntPos(e))); E('EyeAngles', (e) => A(e === yo() ? dirAng(dS(CAM.fwd)) : quatAng(entQ(e))));
  E('GetGravity', () => 1); E('SetGravity', () => {}); E('GetElasticity', () => 1); E('GetFriction', () => 1);
  // NW y DT (lo de la red: acá se guarda en la entidad y se comparte entre los dos lados)
  for (const t of ['Int', 'Float', 'Bool', 'String', 'Entity', 'Vector', 'Angle', 'Var', '2Int', '2Float', '2Bool', '2String', '2Entity', '2Vector', '2Angle', '2Var']) {
    const d00 = /Int|Float/.test(t) ? 0 : /Bool/.test(t) ? false : /String/.test(t) ? '' : /Entity/.test(t) ? NULL_ENT : undefined;
    const D0 = () => (/Vector/.test(t) ? GMA.nv(0, 0, 0) : /Angle/.test(t) ? GMA.A(new LAng()) : d00);   // (Vector y Angle: uno nuevo en cero, como GMod)
    E('SetNW' + t, (e, k, v) => { e.nw.set(k, v); }); E('GetNW' + t, (e, k, d) => (e.nw.has(k) ? e.nw.get(k) : d !== undefined ? d : D0()));
    E('SetNetworked' + t.replace('2', ''), (e, k, v) => { e.nw.set(k, v); }); E('GetNetworked' + t.replace('2', ''), (e, k, d) => (e.nw.has(k) ? e.nw.get(k) : d !== undefined ? d : D0()));
    // (los DT de antes: por tipo y número; si el addon les puso nombre con DTVar, van a self.dt.<nombre>)
    E('SetDT' + t, (e, k, v) => { const n = e.dtSlot && e.dtSlot.get(t + k); if (n) gmaDT(e).set(n, v); else e.nw.set('dt' + t + k, v); }); E('GetDT' + t, (e, k) => { const n = e.dtSlot && e.dtSlot.get(t + k); const v = n ? gmaDT(e).get(n) : e.nw.get('dt' + t + k); return v ?? D0(); });
  }
  E('SetNWVarProxy', () => {}); E('GetNWVarTable', (e) => tabla(Object.fromEntries(e.nw)));
  // NetworkVar y DTVar: el valor vive en self.dt.<nombre> (como en GMod), con Get/Set<nombre> para NetworkVar
  const dtD0 = (t) => (/Int|Float/.test(t) ? 0 : /Bool/.test(t) ? false : /String/.test(t) ? '' : /Entity/.test(t) ? NULL_ENT : /Vector/.test(t) ? GMA.nv(0, 0, 0) : /Angle/.test(t) ? GMA.A(new LAng()) : undefined);
  E('NetworkVar', (e, t, slot, nombre) => {
    if (typeof slot === 'string') nombre = slot; t = String(t); const d0 = dtD0(t);
    if (typeof slot === 'number') (e.dtSlot || (e.dtSlot = new Map())).set(t + slot, nombre);
    if (gmaDT(e).get(nombre) === undefined && d0 !== undefined) gmaDT(e).set(nombre, d0);
    const dt = e.dt || (e.dt = new LuaTable()); dt.set('Set' + nombre, (s, v) => { gmaDT(s).set(nombre, v); }); dt.set('Get' + nombre, (s) => { const v = gmaDT(s).get(nombre); return v === undefined ? d0 : v; });
  });
  E('DTVar', (e, t, slot, nombre) => { t = String(t); (e.dtSlot || (e.dtSlot = new Map())).set(t + slot, nombre); const d0 = dtD0(t); if (gmaDT(e).get(nombre) === undefined && d0 !== undefined) gmaDT(e).set(nombre, d0); });
  E('NetworkVarElement', () => {}); E('NetworkVarNotify', () => {}); E('InstallDataTable', () => {});
  // disparar balas (jugadores y entidades)
  E('FireBullets', (e, b) => gmaBalas(e, b)); E('MuzzleFlash', (e) => { if (e === GMA.jug && typeof efectoFogonazo === 'function') efectoFogonazo(); });
  // ---- jugador ----
  P('Nick', () => PREFS.nombre || 'Player'); P('Name', () => PREFS.nombre || 'Player'); P('GetName', () => PREFS.nombre || 'Player');
  P('SteamID', () => 'STEAM_0:0:' + (parseInt(String((typeof RED !== 'undefined' && RED.ID) || 'yo').replace(/[^a-z0-9]/gi, '').slice(0, 7), 36) || 1)); P('SteamID64', () => '7656119' + String(1e10 + (parseInt(String((typeof RED !== 'undefined' && RED.ID) || '1').replace(/[^0-9]/g, '') || '1', 10) % 1e9)));
  P('UniqueID', () => 1); P('AccountID', () => 1); P('UserID', () => 1); P('IsBot', () => false); P('Ping', () => 0); P('Frags', () => 0); P('Deaths', () => 0); P('Team', () => 1); P('SetTeam', () => {}); P('GetUserGroup', () => 'superadmin');
  P('IsAdmin', () => true); P('IsSuperAdmin', () => true); P('IsUserGroup', (p, g) => g === 'superadmin' || g === 'admin' || g === 'user'); P('IsListenServerHost', () => true); P('IsFullyAuthenticated', () => true);
  P('Alive', () => !!JUG.vivo); P('Armor', () => GMA.armor || 0); P('SetArmor', (p, a) => { GMA.armor = num(a, 0); }); P('Kill', () => { if (typeof morirJugador === 'function') morirJugador(); }); P('KillSilent', () => { if (typeof morirJugador === 'function') morirJugador(); });
  P('GetActiveWeapon', () => GMA.swep || NULL_ENT); P('Give', (p, c) => gmaDarArma(String(c))); P('StripWeapon', (p, c) => gmaQuitarArma(String(c))); P('StripWeapons', () => {}); P('HasWeapon', (p, c) => !!(GMA.armasJug && GMA.armasJug.has(String(c))));
  P('GetWeapon', (p, c) => (GMA.armasJug && GMA.armasJug.get(String(c))) || NULL_ENT); P('GetWeapons', () => R.tab([...(GMA.armasJug || new Map()).values()])); P('SelectWeapon', (p, c) => { const w = GMA.armasJug && GMA.armasJug.get(String(c)); if (w) darArma('gm:' + c); }); P('SetActiveWeapon', () => {});
  P('GetAmmoCount', () => 999); P('GiveAmmo', () => {}); P('RemoveAmmo', () => {}); P('SetAmmo', () => {}); P('StripAmmo', () => {});
  P('GetEyeTrace', () => gmaTraza(CAM.pos, CAM.fwd, 32768 * GS, null)); P('GetEyeTraceNoCursor', () => gmaTraza(CAM.pos, CAM.fwd, 32768 * GS, null));
  P('CheckLimit', () => true); P('GetCount', () => 0); P('AddCount', () => {}); P('AddCleanup', () => {}); P('LimitHit', () => {});
  P('ShouldDrawLocalPlayer', () => !!(typeof JUG !== 'undefined' && JUG.tercera)); P('GetShootPos', () => V(CAM.pos)); P('GetAimVector', () => Vd(CAM.fwd)); P('SetEyeAngles', (p, a) => { const f = dG(new LVec(...angMat(a)[0])); JUG.yaw = Math.atan2(f.x, f.z); JUG.pitch = clamp(-Math.asin(clamp(f.y, -1, 1)), -1.55, 1.55); });
  P('KeyDown', (p, k) => gmaTecla(k)); P('KeyPressed', (p, k) => gmaTecla(k) && !(GMA.tecAnt & k)); P('KeyReleased', (p, k) => !gmaTecla(k) && !!(GMA.tecAnt & k)); P('KeyDownLast', (p, k) => !!(GMA.tecAnt & k));
  P('ChatPrint', (p, s) => { if (typeof chatMostrar === 'function') chatMostrar('', String(s), null, 'sis'); else aviso(String(s), 3); }); P('PrintMessage', (p, t, s) => { if (t === 4) aviso(String(s), 3); else P_chat(String(s)); });
  const P_chat = (s) => { if (typeof chatMostrar === 'function') chatMostrar('', s, null, 'sis'); };
  P('SetWalkSpeed', (p, v) => { GMA.walk = num(v, 200); JUG.vel_max = GMA.walk * GS * 1.0; }); P('GetWalkSpeed', () => GMA.walk || 200); P('SetRunSpeed', (p, v) => { GMA.run = num(v, 400); }); P('GetRunSpeed', () => GMA.run || 400);
  P('SetJumpPower', (p, v) => { GMA.jump = num(v, 200); JUG.salto = 1.1 * (GMA.jump / 200); }); P('GetJumpPower', () => GMA.jump || 200); P('SetMaxSpeed', () => {}); P('SetCrouchedWalkSpeed', () => {}); P('SetDuckSpeed', () => {});
  P('GetAllowWeaponsInVehicle', () => false); P('SetAllowWeaponsInVehicle', () => {});
  P('InVehicle', () => !!JUG.vehiculo); P('GetVehicle', () => (JUG.vehiculo ? (GMA.asiento && GMA.asiento.vivo ? GMA.asiento : entDeObj(JUG.vehiculo)) : NULL_ENT)); P('Crouching', () => !!JUG.agachado); P('IsSprinting', () => !!(ENT && ENT.correr));
  // (el golpe de la vista al disparar, como en Source: se suma y vuelve solo a cero; lo leen las armas para la puntería)
  const punch = (p) => p.punch || (p.punch = new LAng());
  P('ViewPunch', (p, a) => { if (!(a instanceof LAng)) return; const q = punch(p); q.p += a.p; q.y += a.y; q.r += a.r; CAM.temblor = Math.max(CAM.temblor || 0, Math.min(0.6, Math.abs(a.p || 0) / 10)); });
  P('ViewPunchReset', (p, t) => { const q = punch(p); if (!(+t > 0)) { q.p = q.y = q.r = 0; } }); P('SetViewPunchAngles', (p, a) => { if (a instanceof LAng) { const q = punch(p); q.p = a.p; q.y = a.y; q.r = a.r; } }); P('SetViewPunchVelocity', () => {});
  P('GetViewPunchAngles', (p) => { const q = punch(p); return A(new LAng(q.p, q.y, q.r)); }); P('GetPunchAngle', (p) => { const q = punch(p); return A(new LAng(q.p, q.y, q.r)); }); P('GetViewPunchVelocity', () => A(new LAng()));
  P('GetViewModel', () => GMA.vmEnt || (GMA.vmEnt = new LEnt('viewmodel', 'vm'))); P('GetHands', () => NULL_ENT); P('SetupHands', () => {}); P('ConCommand', (p, c) => gmaConsola2(String(c))); P('SendLua', () => {}); P('GetInfo', (p, k) => { const c = GMA.cvars.get(k); return c ? String(c.v) : ''; }); P('GetInfoNum', (p, k, d) => { const c = GMA.cvars.get(k); return c ? num(c.v, d) : d; });
  P('SetModel', () => {}); P('GetModel', () => 'models/player/kleiner.mdl'); P('SetPlayerColor', () => {}); P('GetPlayerColor', () => GMA.nv(0.24, 0.34, 0.41)); P('SetWeaponColor', () => {}); P('GetWeaponColor', () => GMA.nv(0.3, 1.8, 2.1));
  P('GetObserverMode', () => 0); P('Spectate', () => {}); P('UnSpectate', () => {}); P('Freeze', (p, b) => { JUG.congelado = !!b; }); P('IsFrozen', () => !!JUG.congelado); P('Lock', () => {}); P('UnLock', () => {}); P('DrawViewModel', (p, b) => { const w = GMA.swep; if (w) w.vmApagada = b === false; }); P('DrawWorldModel', () => {});
  P('AddFrags', () => {}); P('AddDeaths', () => {}); P('SetFrags', () => {}); P('SetDeaths', () => {}); P('GetFOV', () => CAM.fov || 75); P('SetFOV', () => {}); P('GetHull', () => [GMA.nv(-16, -16, 0), GMA.nv(16, 16, 72)]); P('IPAddress', () => 'loopback'); P('TimeConnected', () => TIEMPO.t);
  P('LastHitGroup', () => 0); P('GetRagdollEntity', () => NULL_ENT); P('GetEyeTraceNoCursor', () => gmaTraza(CAM.pos, CAM.fwd, 32768 * GS, null)); P('IsTyping', () => false); P('IsSpeaking', () => false); P('IsMuted', () => false); P('SetNoTarget', () => {}); P('GodEnable', () => {}); P('GodDisable', () => {}); P('HasGodMode', () => !!JUEGO.dios);
  // ---- armas (SWEP) ----
  W('Clip1', (w) => w.clip1 ?? -1); W('Clip2', (w) => w.clip2 ?? -1); W('SetClip1', (w, n) => { w.clip1 = num(n, 0); }); W('SetClip2', (w, n) => { w.clip2 = num(n, 0); });
  W('GetPrimaryAmmoType', () => 1); W('GetSecondaryAmmoType', () => -1); W('Ammo1', () => 999); W('Ammo2', () => 999); W('GetMaxClip1', (w) => gmaSwepPrim(w, 'ClipSize') ?? -1); W('GetMaxClip2', () => -1);
  W('SetNextPrimaryFire', (w, t) => { w.nextP = num(t, 0); }); W('GetNextPrimaryFire', (w) => w.nextP || 0); W('SetNextSecondaryFire', (w, t) => { w.nextS = num(t, 0); }); W('GetNextSecondaryFire', (w) => w.nextS || 0);
  W('SendWeaponAnim', (w, act) => gmaAnimVista(w, act)); W('SetHoldType', (w, h) => { w.hold = h; }); W('SetWeaponHoldType', (w, h) => { w.hold = h; }); W('GetHoldType', (w) => w.hold || 'pistol');
  W('DefaultReload', (w, act) => {   // (como en GMod: la animación de recarga de la vista —y la del cuerpo— y el cargador lleno cuando termina)
    const max = gmaSwepPrim(w, 'ClipSize'); if (max === undefined || max < 0 || w.clip1 >= max || w.recarga) return false;
    gmaAnimVista(w, typeof act === 'number' ? act : GMA.R.G.get('ACT_VM_RELOAD'));
    const v = GMA.swep === w && typeof gmvVista === 'function' && gmvVista(), d = v && v.clip ? v.clip.d / (v.vel || 1) : 0;
    w.recarga = TIEMPO.t + (d > 0.3 && d < 6 ? d : 1.4); w.nextP = Math.max(w.nextP || 0, w.recarga); w.nextS = Math.max(w.nextS || 0, w.recarga);
    if (w.dueño === GMA.jug || GMA.swep === w) { if (typeof humAccion === 'function' && JUG.cuerpo) humAccion(JUG.cuerpo, 'recarga'); if (typeof redRecarga === 'function') redRecarga(); }
    return true; });
  W('GetActivity', () => 0); W('CallOnClient', () => {}); W('IsCarriedByLocalPlayer', (w) => w.dueño === GMA.jug); W('GetPrintName', (w) => { const c = claseTabla(w.clase, 'S'); return (c && c.get('PrintName')) || w.clase; });
  W('SetDeploySpeed', () => {}); W('IsScripted', () => true); W('Clip1Max', () => 0); W('HasAmmo', (w) => (w.clip1 ?? 1) > 0); W('LastShootTime', (w) => w.ultTiro || 0); W('SetLastShootTime', (w) => { w.ultTiro = TIEMPO.t; }); W('IsWeaponVisible', () => true); W('GetWeaponViewModel', (w) => w.vm || ''); W('GetWeaponWorldModel', (w) => w.wm || '');
  // ---- física ----
  const MP = (GMA.mtPhy = new LuaTable()); MP.set('__index', PHY_M); MP.set('__tostring', (f) => 'PhysObject [' + (f.e ? f.e.id : 0) + ']');
  const bo = (f) => (f.e && f.e.o ? f.e.o.b : null);
  F('IsValid', (f) => !!bo(f)); F('Wake', (f) => { const b = bo(f); if (b) b.wake(); }); F('Sleep', () => {}); F('IsAsleep', (f) => !!(bo(f) && bo(f).sleep));
  F('EnableMotion', (f, s) => { const b = bo(f); if (!b) return; if (R.T(s) && f.e && (f.e.fijoNS || gmaPadreDe(f.e))) return; b.frozen = !R.T(s); if (R.T(s)) b.wake(); });   // (lo pegado o no sólido sigue quieto) F('IsMotionEnabled', (f) => !!(bo(f) && !bo(f).frozen)); F('IsMoveable', (f) => !!(bo(f) && !bo(f).frozen));
  F('EnableGravity', (f, s) => { const b = bo(f); if (b) b.sinGrav = !R.T(s); }); F('IsGravityEnabled', (f) => !(bo(f) && bo(f).sinGrav)); F('EnableCollisions', () => {}); F('EnableDrag', () => {});
  F('ApplyForceCenter', (f, F2) => { const b = bo(f); if (b && F2 instanceof LVec && b.mass) { b.wake(); b.vel.add(vG(F2).scale(1 / b.mass)); } });
  F('ApplyForceOffset', (f, F2, p) => { const b = bo(f); if (b && F2 instanceof LVec && b.mass) { b.wake(); const d = vG(F2).scale(1 / b.mass); b.vel.add(d); if (p instanceof LVec && b.applyVel) b.applyVel(vG(F2).scale(GS * 0), vsub(vG(p), b.pos), 1); } });
  F('ApplyTorqueCenter', (f, t) => { const b = bo(f); if (b && t instanceof LVec) { b.wake(); b.ang.add(dG(t).scale(0.0005)); } });
  F('SetVelocity', (f, v) => { const b = bo(f); if (b) { b.vel.copy(vG(v)); b.wake(); } }); F('SetVelocityInstantaneous', (f, v) => { const b = bo(f); if (b) { b.vel.copy(vG(v)); b.wake(); } }); F('AddVelocity', (f, v) => { const b = bo(f); if (b) { b.vel.add(vG(v)); b.wake(); } });
  F('GetVelocity', (f) => V(bo(f) ? bo(f).vel : v3())); F('GetAngleVelocity', (f) => Vd(bo(f) ? bo(f).ang.clone().scale(1 / RAD) : v3()));
  F('AddAngleVelocity', (f, a) => { const b = bo(f); if (b && a instanceof LVec) { b.wake(); b.ang.add(b.q.rot(dG(a)).scale(RAD)); } });
  F('SetMass', (f, m) => { const b = bo(f); if (b && b.setMasa) b.setMasa(num(m, 1)); else if (b) { const k = num(m, 1) / (b.mass || 1); b.mass = num(m, 1); b.invMass = 1 / b.mass; if (b.invI) b.invI.scale(1 / k); } }); F('GetMass', (f) => (bo(f) ? bo(f).mass || 1 : 0));
  F('GetPos', (f) => V(f.e && f.e.o ? gmaOrigen(f.e.o) : v3())); F('SetPos', (f, p) => { const o = f.e && f.e.o; if (o) { gmaOrigenPon(o, vG(p)); o.b.wake(); } }); F('GetAngles', (f) => A(quatAng(bo(f) ? bo(f).q : new Quat()))); F('SetAngles', (f, a) => { const b = bo(f); if (b) { b.q.copy(angQuat(a)); b.wake(); } });
  F('GetEntity', (f) => f.e); F('SetMaterial', () => {}); F('GetMaterial', () => 'metal'); F('SetDamping', () => {}); F('SetDragCoefficient', () => {}); F('SetBuoyancyRatio', () => {}); F('SetInertia', () => {}); F('GetInertia', () => GMA.nv(1, 1, 1));
  F('LocalToWorld', (f, v) => ENT_M.get('LocalToWorld')(f.e, v)); F('WorldToLocal', (f, v) => ENT_M.get('WorldToLocal')(f.e, v)); F('GetVolume', (f) => { const b = bo(f), A = b && b.aabb; return A ? Math.abs((A.x1 - A.x0) * (A.y1 - A.y0) * (A.z1 - A.z0)) * 0.6 / (GS * GS * GS) : 0; });   // (en pulgadas³, como GMod: Prop Hunt saca la vida de la utilería de acá)
  F('GetMassCenter', (f) => { const o = f.e && f.e.o; return o && o.c ? GMA.V(o.c) : GMA.nv(0, 0, 0); }); F('OutputDebugInfo', () => {}); F('RecheckCollisionFilter', () => {}); F('ComputeShadowControl', () => {}); F('UpdateShadow', () => {});
  // ---- lo que usan muchos addons y faltaba (api_falta.mjs sobre 86 addons reales): sólo lo que no estaba ya ----
  const solo = (M, n, f) => { if (M.get(n) === undefined) M.set(n, f); };
  const pisoDe = (p) => { const h = mundoRayo(v3(p.x, p.y + 0.5, p.z), v3(0, -1, 0), 60); return h ? p.y + 0.5 - h.t : null; };
  solo(ENT_M, 'OnGround', (e) => ENT_M.get('IsOnGround')(e));
  solo(ENT_M, 'DropToFloor', (e) => {   // (la cosa baja hasta apoyarse en el piso de abajo)
    if (e === yo()) { const y = pisoDe(JUG.pos); if (y !== null) { JUG.pos.y = y + JUG.medio + JUG.radio; JUG.vel.y = 0; } return; }
    const b = e.o && e.o.b; if (!b) return; b.updateWorld(); const a = b.aabb, y = pisoDe(v3((a.x0 + a.x1) / 2, a.y0, (a.z0 + a.z1) / 2)); if (y === null) return;
    b.pos.y += y - a.y0; b.vel.set(0, 0, 0); b.wake(); b.updateWorld();
  });
  solo(ENT_M, 'WorldSpaceAABB', (e) => {
    if (e === yo()) { const p = JUG.pos, r = JUG.radio; return [V(v3(p.x - r, p.y - JUG.medio - r, p.z - r)), V(v3(p.x + r, p.y + JUG.ojoAlto - JUG.medio, p.z + r))]; }
    const b = e.o && e.o.b; if (!b) { const p = gmaEntPos(e); return [V(p), V(p)]; } const a = b.aabb;
    const p0 = V(v3(a.x0, a.y0, a.z0)), p1 = V(v3(a.x1, a.y1, a.z1));   // (en Source z es arriba: se ordenan por componente)
    return [GMA.nv(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.min(p0.z, p1.z)), GMA.nv(Math.max(p0.x, p1.x), Math.max(p0.y, p1.y), Math.max(p0.z, p1.z))];
  });
  solo(ENT_M, 'GetFlexNum', () => 0); solo(ENT_M, 'GetFlexName', () => ''); solo(ENT_M, 'GetFlexWeight', () => 0); solo(ENT_M, 'SetFlexWeight', () => {}); solo(ENT_M, 'SetFlexScale', () => {}); solo(ENT_M, 'GetFlexScale', () => 1);
  for (const n of ['SetExpensiveShadow', 'SetTransmitWithParent', 'SetPreventTransmit', 'SetNetworkKeyValue', 'SetGroundEntity', 'SetShouldPlayPickupSound', 'AddToMotionController', 'RemoveFromMotionController', 'StartMotionController', 'StopMotionController', 'SetLagCompensated']) solo(ENT_M, n, () => {});
  solo(ENT_M, 'GetShouldPlayPickupSound', () => false);
  // jugador
  solo(PLY_M, 'LagCompensation', () => {});
  solo(PLY_M, 'Flashlight', (p, on) => { linternaAlternar(!!on, true); }); solo(PLY_M, 'FlashlightIsOn', () => !!LINT.on || !!(typeof NOC !== 'undefined' && NOC.on && NOC.linterna));
  solo(PLY_M, 'AllowFlashlight', (p, si) => { LINT.permitida = si !== false; if (!LINT.permitida) linternaAlternar(false, true); }); solo(PLY_M, 'CanUseFlashlight', () => LINT.permitida);
  solo(PLY_M, 'GetCrouchedWalkSpeed', () => GMA.agachado ?? 0.3); solo(PLY_M, 'SetCrouchedWalkSpeed', (p, v) => { GMA.agachado = num(v, 0.3); });
  solo(PLY_M, 'GetMaxSpeed', () => GMA.run || 400); solo(PLY_M, 'SetMaxSpeed', (p, v) => { GMA.maxV = num(v, 400); });
  solo(PLY_M, 'GetObserverTarget', () => NULL_ENT); solo(PLY_M, 'GetObserverMode', () => 0); solo(PLY_M, 'IsPlayingTaunt', () => false); solo(PLY_M, 'IsConnected', () => true); solo(PLY_M, 'VoiceVolume', () => 0);
  solo(PLY_M, 'AnimRestartGesture', () => {}); solo(PLY_M, 'AnimResetGestureSlot', () => {}); solo(PLY_M, 'AnimSetGestureWeight', () => {});
  solo(PLY_M, 'ExitVehicle', () => { if (JUG.vehiculo && typeof salirVehiculo === 'function') salirVehiculo(); });
  solo(PLY_M, 'EnterVehicle', (p, v) => gmaSubirAsiento(v));
  // (los asientos de los addons: el jugador sentado en uno es su pasajero; la vista en tercera persona es la del juego)
  solo(ENT_M, 'GetPassenger', (v) => (GMA.asiento === v && JUG.vehiculo ? GMA.jug : NULL_ENT)); solo(ENT_M, 'GetDriver', (v) => (GMA.asiento === v && JUG.vehiculo ? GMA.jug : NULL_ENT));
  solo(ENT_M, 'GetThirdPersonMode', () => !JUG.fpVeh); solo(ENT_M, 'SetThirdPersonMode', (v, b) => { JUG.fpVeh = !b; }); solo(ENT_M, 'GetVehicleClass', (v) => v.clase || '');
  solo(PLY_M, 'DropObject', () => { if (typeof soltarAgarre === 'function' && ARM.agarre) soltarAgarre(false); }); solo(PLY_M, 'PickupObject', () => {});
  // (los datos guardados del jugador: quedan en el aparato, como en GMod quedan en su sv.db)
  const pdata = () => { try { return JSON.parse(localStorage.getItem('rb_pdata') || '{}') || {}; } catch (e) { return {}; } }, pdataPon = (d) => { try { localStorage.setItem('rb_pdata', JSON.stringify(d)); } catch (e) {} };
  solo(PLY_M, 'GetPData', (p, k, def) => { const d = pdata(), v = d[String(k)]; return v === undefined ? def : v; });
  solo(PLY_M, 'SetPData', (p, k, v) => { const d = pdata(); d[String(k)] = typeof v === 'number' || typeof v === 'boolean' ? String(v) : R.tostr(v); pdataPon(d); return true; });
  solo(PLY_M, 'RemovePData', (p, k) => { const d = pdata(); delete d[String(k)]; pdataPon(d); return true; });
  // (el fundido de pantalla de GMod: SCREENFADE.IN = 1 aparece desde el color, OUT = 2 se va al color; MODULATE y STAYOUT)
  solo(PLY_M, 'ScreenFade', (p, fl, c, fade, hold) => {
    let el = document.getElementById('gmFundido'); if (!el) { el = document.createElement('div'); el.id = 'gmFundido'; el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:29;opacity:0'; document.body.appendChild(el); }
    const col = c instanceof LuaTable ? [c.get('r'), c.get('g'), c.get('b'), c.get('a')].map((x, i) => num(x, i === 3 ? 255 : 0)) : [0, 0, 0, 255], f = Math.max(0, num(fade, 0)), h = Math.max(0, num(hold, 0)), fl2 = num(fl, 0) | 0;
    el.style.background = `rgb(${col[0]},${col[1]},${col[2]})`; const a = col[3] / 255;
    const ir = (o, t) => { el.style.transition = 'opacity ' + t + 's linear'; el.style.opacity = String(o); };
    clearTimeout(el._t); el.style.transition = 'none';
    if (fl2 & 1) { el.style.opacity = String(a); void el.offsetWidth; el._t = setTimeout(() => ir(0, f), h * 1000); }
    else { el.style.opacity = '0'; void el.offsetWidth; ir(a, f); if (!(fl2 & 8)) el._t = setTimeout(() => ir(0, 0.3), (f + h) * 1000); }
  });
  // NPC
  if (NPC_M) { solo(NPC_M, 'SetSchedule', () => {}); solo(NPC_M, 'GetEnemy', (n) => n.enemigo || NULL_ENT); solo(NPC_M, 'SetEnemy', (n, t) => { n.enemigo = t instanceof LEnt ? t : null; }); solo(NPC_M, 'ClearEnemyMemory', (n) => { n.enemigo = null; }); }

}

// ---------------- ayudantes del motor ----------------
const HL2_ARMAS = { weapon_crowbar: 'Crowbar', weapon_physgun: 'PhysicsGun', gmod_tool: 'ToolBaton', weapon_rpg: 'RPG', weapon_pistol: 'Pistol', gmod_camera: 'Camera', weapon_fists: 'Hands', weapon_hands: 'Hands',
  weapon_357: 'Revolver', weapon_smg1: 'Smg', weapon_ar2: 'Akm', weapon_shotgun: 'Shotgun', weapon_crossbow: 'Crossbow', weapon_stunstick: 'Bat', weapon_physcannon: 'GravityGun' };
function gmaPrefabDeModelo(ruta) {
  if (!ruta) return null;
  ruta = ruta.toLowerCase().replace(/\\/g, '/'); if (!ruta.startsWith('models/')) ruta = 'models/' + ruta;
  if (gmArchivo(ruta)) return gmPrefab('gm:' + ruta) ? 'gm:' + ruta : null;
  // (un modelo de HL2/GMod que no viene en el addon: el prop del juego con ese nombre, si hay; si no, una caja)
  const base = ruta.replace(/^.*\//, '').replace(/\.mdl$/, '');
  for (const n of Object.keys(DATA.pfPorNombre)) if (n.toLowerCase() === base) return n;
  (GMA.modelosFaltan || (GMA.modelosFaltan = new Set())).add(ruta); if (GMA.modelosFaltan.size > 500) GMA.modelosFaltan.clear();
  return DATA.pfPorNombre.Crate ? 'Crate' : null;
}
function gmaModeloInfo(e) { if (!e.o || !/^gm:/.test(e.o.nombre)) return null; const x = GMOD.pf.get(e.o.nombre); return x ? x.M : null; }
function gmaRehacer(e) {
  e.nbDefDe = null;   // (el modelo animado de un nextbot se vuelve a armar: puede haber llegado su geometría)
  const pf = gmaPrefabDeModelo(e.modelo);
  const pos = e.o ? gmaOrigen(e.o) : e.pos.clone(), q = e.o ? e.o.b.q.clone() : e.q.clone(), vel = e.o ? e.o.b.vel.clone() : null;
  if (e.o) { GMA.entPorObj.delete(e.o); borrarObjeto(e.o); e.o = null; }
  if (!pf) return;
  const o = crearObjeto(pf, pos, q, { exacto: true });
  if (!o) return;
  o.gmEnt = e; o.gmClase = e.clase; e.o = o; e.oModelo = e.modelo; GMA.entPorObj.set(o, e);
  if (e.mov === 0) o.b.frozen = true; if (vel) o.b.vel.copy(vel);
  e.fijoNS = false; gmaSolidez(e);
  if (typeof redObjeto === 'function') redObjeto(o);
}
// cómo choca una entidad de un addon, como en GMod: una de Lua que no pidió física (PhysicsInit) ni SetSolid es
// SOLID_NONE: no choca con nada, las trazas la atraviesan y no se cae; SetNotSolid(true) igual, y también una pegada a
// otra con SetParent (la lleva su padre: «nothing can interact with them, including traces»). Algunos grupos de choque
// (escombros, armas, el del mundo...) no chocan con los jugadores, y nunca choca con su dueño. (La utilería de Prop Hunt,
// pegada al jugador, era una caja sólida en sus pies: lo levantaba y no lo dejaba caminar)
const GMA_GRUPO_SIN_JUG = new Set([1, 2, 3, 10, 11, 12, 14, 15, 16, 17, 20]), GMA_GRUPO_SIN_FIS = new Set([1, 2, 10, 12, 14, 20]);
function gmaSolidoTipo(e) { return e.noSolido ? 0 : e.solidoT !== undefined ? e.solidoT : claseTabla(e.clase, 'S') && !e.nb ? 0 : 6; }
function gmaSolidez(e) {
  const o = e.o; if (!o || !o.b || o.veh || e.tipo !== 'ent') return; const b = o.b;
  const nada = gmaSolidoTipo(e) === 0 || !!e.padre || !!e.soldadoA, g = e.grupoCol | 0, J = GMA.jug;
  b.noJug = nada || GMA_GRUPO_SIN_JUG.has(g) || (!!J && e.dueño === J);
  b.noPhys = nada || GMA_GRUPO_SIN_FIS.has(g);
  b.noRay = nada;
  if (nada) { if (!e.fijoNS) { e.fijoNS = true; b.frozen = true; b.vel.set(0, 0, 0); if (b.ang) b.ang.set(0, 0, 0); } }
  else if (e.fijoNS) { e.fijoNS = false; b.frozen = e.mov === 0; if (!b.frozen) b.wake(); }
}
// SetParent: la hija sigue a su padre (dónde y cómo está respecto de él se guarda al pegarla, en el espacio del padre).
// Las soldaduras y los ejes de constraint (Weld, Axis: las ruedas y el rotor de los aviones WAC, las piezas de muchos
// addons) van igual, pegadas a la primera entidad (soldadoA), pero sin ser su "padre" para el Lua.
const gmaPadreDe = (e) => e.padre || e.soldadoA || null;
function gmaPadre(e, p, soldar) {
  for (let x = p, n = 0; x && n < 32; x = gmaPadreDe(x), n++) if (x === e) return;   // (sin vueltas)
  if (soldar) e.soldadoA = p; else e.padre = p;
  if (gmaPadreDe(e)) { gmaPadreFijar(e); (GMA.hijos || (GMA.hijos = new Set())).add(e); } else if (GMA.hijos) GMA.hijos.delete(e);
  GMA.hijosOrden = null; gmaSolidez(e);
}
// (qué: 'pos' o 'ang' cuando el Lua mueve o gira una pegada —WAC gira las hélices así—, cada cosa por separado: si no,
// lo que la física la hubiera corrido entre cuadros quedaba fijado y las piezas se iban despegando de a poco)
function gmaPadreFijar(e, que) { const p = gmaPadreDe(e); if (!p) return; const qi = entQ(p).conj(); if (que !== 'ang' || !e.padreOff) e.padreOff = qi.rot(vsub(gmaEntPos(e), gmaEntPos(p))); if (que !== 'pos' || !e.padreQ) e.padreQ = qi.mul(entQ(e)); }
function gmaHijoMover(e) {
  const p = gmaPadreDe(e); if (!p || !e.padreOff) return;
  const qp = entQ(p), w = gmaEntPos(p).add(qp.rot(e.padreOff)), q = qp.mul(e.padreQ || new Quat());
  if (e.o && e.o.b) { const b = e.o.b; b.q.copy(q); gmaOrigenPon(e.o, w, q); b.vel.set(0, 0, 0); if (b.ang) b.ang.set(0, 0, 0); b.updateWorld(); } else { e.pos.copy(w); e.q.copy(q); }
}
// constraint.Weld / Axis: b queda pegada a a (con el mundo: congelada en su lugar)
function gmaSoldar(a, b) {
  if (!(a instanceof LEnt) || !(b instanceof LEnt) || a === b || a.tipo === 'jug' || b.tipo === 'jug') return [NULL_ENT];
  if (a.tipo === 'mundo' || b.tipo === 'mundo') { const e = a.tipo === 'mundo' ? b : a; if (e.o && e.tipo === 'ent') { e.mov = 0; e.o.b.frozen = true; e.o.b.vel.set(0, 0, 0); } return [NULL_ENT]; }
  // (la más liviana va pegada a la más pesada, como cuelga en la física: WAC hace Axis(rueda, avión) y el avión quedaba
  // colgado de la rueda; si la elegida ya va pegada a otra, al revés)
  // (la que se está armando —el avión en su Initialize— o una de Lua cuyo cuerpo todavía no llegó del disco es el padre;
  // si no, la más pesada; a igual peso, la primera)
  const peso = (x) => (x === GMA.iniciando ? 1e12 : 0) + (!x.o && claseTabla(x.clase, 'S') ? 1e9 : 0) + (x.o && x.o.b ? x.o.b.mass || 0 : 0);
  let padre = a, hija = b; if (peso(b) > peso(a)) { padre = b; hija = a; }
  if (gmaPadreDe(hija)) { if (gmaPadreDe(padre)) return [NULL_ENT]; const t = padre; padre = hija; hija = t; }
  gmaPadre(hija, padre, true); return [NULL_ENT];
}
function gmaDesoldar(e) {
  if (!(e instanceof LEnt)) return false; let hubo = false;
  if (e.soldadoA) { gmaPadre(e, null, true); hubo = true; }
  if (GMA.hijos) for (const h of [...GMA.hijos]) if (h.soldadoA === e) { gmaPadre(h, null, true); hubo = true; }
  return hubo;
}
// subirse a un asiento de un addon (prop_vehicle_prisoner_pod: el de los aviones y helicópteros WAC, sillas...). El asiento
// va pegado a lo que lo lleva: si es un avión o un helicóptero, ése pasa a ser un vehículo del juego —con su manejo, su
// cámara y los botones del celular para volar— y el jugador va en el asiento; si no, el asiento solo (sentado)
function gmaTipoAereo(e) {
  const nombres = []; for (let c = e.clase, n = 0; c && n < 12; n++) { nombres.push(c); const t = claseTabla(c, 'S'); const b = t && t.get('Base'); c = typeof b === 'string' && b !== c ? b : null; }
  // (de la clase propia hacia sus bases: manda la más específica —los aviones de WAC heredan de la base de helicópteros—)
  for (const n of nombres.map((x) => String(x).toLowerCase())) {
    if (/(^|_)pl(_|$)|plane|aero|jet|fighter|bomber/.test(n)) return 'avion';
    if (/(^|_)hc(_|$)|heli|copter|chopper|rotor/.test(n)) return 'heli';
  }
  return 'asiento';
}
function gmaSubirAsiento(v) {
  if (!(v instanceof LEnt) || JUG.vehiculo || typeof subirVehiculo !== 'function' || typeof VEHS === 'undefined') return;
  if (v.o && v.o.veh) { subirVehiculo(v.o); return; }
  let raiz = v; for (let n = 0; gmaPadreDe(raiz) && n < 16; n++) raiz = gmaPadreDe(raiz);
  if (raiz === v && !v.o) return;
  const o = raiz.o; if (!o || !o.b || o.borrado) return;
  if (!o.veh) {
    const tipo = raiz === v ? 'asiento' : gmaTipoAereo(raiz);
    o.veh = { o, tipo, ruedas: [], asientos: [], vida: 1e9, roto: false, motor: 0, giro: 0, gas: 0, rpm: 0, vel: 0, aleteo: 0, rotores: [], conductor: null, lua: true };
    VEHS.push(o.veh);
    if (tipo !== 'asiento') { o.b.angDamp = 0.6; o.b.fric = tipo === 'avion' ? 0.08 : 0.4; raiz.mov = 6; o.b.frozen = false; o.b.wake();
      // (la cámara de atrás, a la distancia que pide su tamaño: un A-10 mide 16 m)
      const A = o.b.aabb; if (A) o.veh.camDist = clamp(Math.hypot(A.x1 - A.x0, A.y1 - A.y0, A.z1 - A.z0) * 0.85, 7, 45); }
  }
  // (el asiento, en el marco del cuerpo: a la altura de la cadera, como los del juego)
  const b = o.b, loc = b.q.conj().rot(vsub(gmaEntPos(v), b.pos)); loc.y += 0.1;
  o.veh.asientos = [loc];
  subirVehiculo(o);
  if (JUG.vehiculo === o) { GMA.asiento = v; gmaHook('PlayerEnteredVehicle', 'S', GMA.jug, v, 0); }
}
// (E sin nada usable adelante: el asiento de un addon que se está mirando, a menos de 3,5 m —los asientos de WAC están
// fuera del casco de choque del avión, en la cabina, y el rayo de usar no los toca—)
function gmaAsientoMirado() {
  if (!GMA.hijos || JUG.vehiculo) return false;
  const ojo = JUG.ojoPos || CAM.pos, f = CAM.fwd; let mejor = null, md = 3.5;
  for (const h of GMA.hijos) {
    if (!h.vivo || !/^prop_vehicle_(prisoner_pod|jeep|airboat)/.test(h.clase)) continue;
    const d = vsub(gmaEntPos(h), ojo), l = d.len(); if (l > md || l < 1e-3) continue;
    if (vdot(d, f) / l < 0.6) continue;
    md = l; mejor = h;
  }
  if (!mejor) return false;
  gmaSubirAsiento(mejor); return !!JUG.vehiculo;
}
// (el jugador se bajó —F, o se rompió el vehículo—: el asiento queda libre y el Lua se entera)
function gmaAsientoPaso() {
  const v = GMA.asiento; if (!v || (JUG.vehiculo && v.vivo)) return;
  GMA.asiento = null; gmaHook('PlayerLeaveVehicle', 'S', GMA.jug, v);
}
// (cada cuadro, después del Lua: las hijas van con su padre; si el padre se borró, se borran con él, como en Source)
function gmaHijosPaso() {
  const H = GMA.hijos; if (!H || !H.size) return;
  // (primero los padres y después sus hijas: si no, una hija se dibujaba donde estaba su padre el cuadro anterior)
  if (!GMA.hijosOrden || GMA.hijosOrden.length !== H.size) { const prof = (e) => { let n = 0; for (let x = gmaPadreDe(e); x && n < 32; x = gmaPadreDe(x)) n++; return n; }; GMA.hijosOrden = [...H].map((e) => [prof(e), e]).sort((x, y) => x[0] - y[0]).map((x) => x[1]); }
  for (const e of GMA.hijosOrden) {
    if (!H.has(e)) continue;
    const p = gmaPadreDe(e);
    if (!e.vivo || !p) { H.delete(e); GMA.hijosOrden = null; continue; }
    if (p.vivo === false || (p.o && p.o.borrado)) { H.delete(e); GMA.hijosOrden = null; gmaQuitar(e); continue; }
    gmaHijoMover(e);
  }
}
// (GMod corre SetupDataTables al crear la entidad: ahí nacen los Get/Set de NetworkVar)
function gmaPreparar(e) { if (e.dtListo || !e.vivo) return; e.dtListo = true; if (claseTabla(e.clase, 'S')) metodo(e, 'SetupDataTables', 'S'); }
function gmaSpawn(e) {
  if (e.creado || !e.vivo) return; e.creado = true; gmaPreparar(e);
  if (typeof gmnbEs === 'function' && gmnbEs(e)) { e.nb = true; e.mov = 0; }   // (un nextbot: lo mueve su locomoción)
  // (el cuerpo se arma ya en Initialize, al poner el modelo o PhysicsInit, como en GMod: ahí mismo el addon le pone la
  // masa, la gravedad o lo suelda —las ruedas y el rotor de WAC— y antes no había cuerpo todavía)
  const ini0 = GMA.iniciando; GMA.iniciando = e;
  try { metodo(e, 'Initialize', 'S'); } finally { GMA.iniciando = ini0; }
  if (!e.vivo) return;
  if (!e.o || e.oModelo !== e.modelo) gmaRehacer(e);
  if (e.nb) { if (e.o) { e.o.b.frozen = true; e.o.b.noGrab = false; } metodo(e, 'BehaveStart', 'S'); }
  const c = GMA.clases.get(e.clase); if (c && c.C && c.C !== c.S) metodo(e, 'Initialize', 'C');
  gmaHook('OnEntityCreated', 'S', e);
}
function gmaQuitar(e) {
  if (!(e instanceof LEnt) || !e.vivo || e.tipo === 'jug') return; e.vivo = false;
  metodo(e, 'OnRemove', 'S'); const c = GMA.clases.get(e.clase); if (c && c.C && c.C.get('OnRemove')) metodo(e, 'OnRemove', 'C');
  gmaHook('EntityRemoved', 'S', e);
  if (e.o) { GMA.entPorObj.delete(e.o); if (!e.o.borrado) borrarObjeto(e.o); e.o = null; }
  GMA.ents.delete(e.id);
}
// sonidos: los del addon por su ruta (o los guiones de sound.Add), con el tono de GMod (100 = normal)
function gmaSonar(s, pos, vol, tono) {
  if (typeof s !== 'string' || !s) return;
  const sc = GMA.guiones && GMA.guiones.get(s.toLowerCase());
  if (sc) { const L = sc.w; s = L[(Math.random() * L.length) | 0]; vol = vol ?? sc.v; tono = tono ?? sc.p; }
  const n = gmSonido(s); if (!n) return;
  sonar(n, pos ? pos : null, Math.max(0.05, Math.min(2, vol === undefined ? 1 : +vol)), tono ? Math.max(0.3, Math.min(2.5, tono / 100)) : 1);
}
// daño: al jugador, a una entidad del addon (su OnTakeDamage) o a un objeto del juego
function gmaDmgInfo(dan, at, inf, pos) { return { dan, at: at || NULL_ENT, inf: inf || NULL_ENT, tipo: 0, pos: pos || null, fuerza: null, __mt: GMA.mtDmg }; }
function gmaDanar(e, dan, at, inf, di) {
  if (!(e instanceof LEnt)) return;
  di = di || gmaDmgInfo(dan, at, inf);
  const r = gmaHook('EntityTakeDamage', 'S', e, di); if (r[0] === true) return;
  if (e === GMA.jug) { danarJugador(di.dan); return; }
  if (claseTabla(e.clase, 'S')) { metodo(e, 'OnTakeDamage', 'S', di); return; }
  if (e.o) danarObjeto(e.o, di.dan, e.o.b.pos.clone(), v3(0, 1, 0));
}
// (desde el motor: algo le pegó a un objeto que es una entidad de un addon)
function gmaDanoObj(o, dan, p, d) {
  const e = GMA.entPorObj.get(o); if (!e || !claseTabla(e.clase, 'S') || GMA.danando) return false;
  GMA.danando = true; try { const di = gmaDmgInfo(dan, GMA.jug, GMA.jug, p ? vS(p) : null); di.fuerza = d ? dS(d) : null; gmaHook('EntityTakeDamage', 'S', e, di); metodo(e, 'OnTakeDamage', 'S', di); } finally { GMA.danando = false; }
  return true;
}
function gmaUsar(e, act) { if (!(e instanceof LEnt)) return; const p = act instanceof LEnt ? act : GMA.jug; const r = gmaHook('PlayerUse', 'S', p, e); if (r[0] === false) return; metodo(e, 'Use', 'S', p, p, 1, 1); }
function gmaUsarObj(o) {
  let e = GMA.entPorObj.get(o);
  // (un objeto que no es de un addon —los props del mapa— con un modo de juego: su PlayerUse se entera igual, como en GMod;
  // así en Prop Hunt los Props toman la forma del objeto que miran)
  if (!e) { if (GMA.modo && GMA.activo && GMA.jug && o && o.b) gmaHook('PlayerUse', 'S', GMA.jug, entDeObj(o)); return false; }
  // (una pieza pegada —rueda, rotor, cabina de un avión WAC—: el Use es el de lo que la lleva)
  for (let n = 0; gmaPadreDe(e) && n < 16 && !claseTabla(e.clase, 'S'); n++) e = gmaPadreDe(e);
  if (!claseTabla(e.clase, 'S')) return false;
  gmaUsar(e, GMA.jug);
  // (si su Use no te sentó —en WAC hay que mirar a menos de 1,3 m del asiento, difícil en el celular—, al asiento libre
  // más cercano de lo que tocaste)
  if (!JUG.vehiculo && GMA.hijos) {
    let mejor = null, md = 1e9; const yo = JUG.ojoPos || CAM.pos;
    for (const h of GMA.hijos) { if (!h.vivo || !/^prop_vehicle_(prisoner_pod|jeep|airboat)/.test(h.clase)) continue; let r = h, n = 0; while (gmaPadreDe(r) && n++ < 16) r = gmaPadreDe(r); if (r !== e) continue; const d = vsub(gmaEntPos(h), yo).len(); if (d < md) { md = d; mejor = h; } }
    if (mejor && md < 12) gmaSubirAsiento(mejor);
  }
  return true;
}
function gmaTraza(o, d, max, ignorar, hPre) {
  const h = hPre !== undefined ? hPre || null : raycast(o, d, max, ignorar || null), t = new LuaTable(), fin = h ? vadd(o, vscale(d, h.t)) : vadd(o, vscale(d, max));
  const ent = h && h.body ? (h.body.obj ? entDeObj(h.body.obj) : h.body.persona ? gmaEntPersona(h.body.persona) : GMA.mundo) : h ? GMA.mundo : NULL_ENT;
  t.set('Hit', !!h); t.set('HitPos', GMA.V(fin)); t.set('HitNormal', GMA.Vd(h ? h.n : vscale(d, -1))); t.set('Normal', GMA.Vd(d)); t.set('StartPos', GMA.V(o));
  t.set('Fraction', h ? h.t / max : 1); t.set('Entity', ent); t.set('HitWorld', !!(h && !h.body)); t.set('HitNonWorld', !!(h && h.body)); t.set('HitSky', false); t.set('HitNoDraw', false);
  t.set('MatType', 67); t.set('PhysicsBone', 0); t.set('HitBox', 0); t.set('HitGroup', 0); t.set('SurfaceProps', 0); t.set('StartSolid', false); t.set('AllSolid', false); t.set('FractionLeftSolid', 0); t.set('HitTexture', '**studio**');
  return t;
}
// la entidad de Lua de una persona que tocó una traza: el cuerpo del jugador (también su muñeco al morir) es el jugador;
// los demás, un NPC que está donde está la persona, con su vida, y que deja de existir cuando la persona se borra. Antes
// era siempre un npc_citizen nuevo en el origen del mapa, con 100 de vida para siempre: los nextbots que te mataban se
// quedaban quietos ahí, persiguiendo a ese fantasma (tu cuerpo ya borrado), aunque reaparecieras
function gmaPuntosAparicion() { if (GMA.aparicionesLua) GMA.aparicionesLua(); }
function gmaEntPersona(P) {
  if (P === JUG.cuerpo || P.esJugador) return GMA.jug;
  if (P.borrado) return NULL_ENT;
  let e = GMA.entPorObj.get(P); if (!e) { e = new LEnt(P.muneco ? 'prop_ragdoll' : (P.gmNpc && P.gmNpc.cls) || 'npc_citizen', P.muneco ? 'ent' : 'npc'); e.P = P; if (P.muneco) e.modelo = P.gmNpc ? P.gmNpc.key : ''; GMA.entPorObj.set(P, e); }
  return e;
}
function gmaPersonaFuera(P) { const e = GMA.entPorObj.get(P); if (!e) return; e.vivo = false; GMA.ents.delete(e.id); GMA.entPorObj.delete(P); }
function gmaIgnorar(f) {   // el filtro de una traza → cuerpos a ignorar
  const S = new Set(), add = (x) => { if (x instanceof LEnt && x.o) S.add(x.o.b); };
  if (f instanceof LuaTable) { for (const k of f.claves()) add(f.get(k)); } else add(f);
  return S.size ? S : null;
}
// Entity:FireBullets como el motor de Source: cada bala con su dispersión (la suma de dos azares por eje, como Source),
// su trazadora cada "Tracer" balas (TracerName: un efecto de Lua del addon o uno del motor), Callback (que puede apagar el
// efecto o el daño), el arma decide el efecto del impacto (SWEP:DoImpactEffect: true = sin el de siempre), daño de bala
// con atacante e infligidor (OnTakeDamage y EntityTakeDamage) y el empujón (Force)
const GMA_MUNICION = { pistol: 12, smg1: 12, ar2: 11, buckshot: 9, '357': 40, xbowbolt: 100, sniperround: 50, sniperpenetratedround: 50, airboatgun: 10, alyxgun: 8, gaussenergy: 15 };
function gmaBalas(e, b) {
  if (!(b instanceof LuaTable)) return;
  const n = Math.min(40, Math.max(1, b.get('Num') | 0 || 1)), src = b.get('Src') instanceof LVec ? vG(b.get('Src')) : CAM.pos.clone(), dir0 = b.get('Dir') instanceof LVec ? dG(b.get('Dir')).norm() : CAM.fwd.clone();
  const sp = b.get('Spread') instanceof LVec ? b.get('Spread') : new LVec(), cb = b.get('Callback'), dist = Math.min(400, (+b.get('Distance') || 56756) * GS), fuerza = +b.get('Force') || 1;
  let dan = +b.get('Damage'); if (!(dan > 0)) dan = GMA_MUNICION[String(b.get('AmmoType') || '').toLowerCase()] || 10;
  const tr0 = b.get('Tracer'), trac = tr0 === undefined ? 1 : +tr0 || 0, tnom = String(b.get('TracerName') || 'Tracer');
  const at = b.get('Attacker') instanceof LEnt ? b.get('Attacker') : e, wep = e.tipo === 'arma' ? e : e === GMA.jug && GMA.swep && GMA.swep.vivo ? GMA.swep : null, inf = b.get('Inflictor') instanceof LEnt ? b.get('Inflictor') : wep || e;
  const ign = gmaIgnorar(b.get('IgnoreEntity')) || new Set(); if (e === GMA.jug && typeof JUG !== 'undefined' && JUG.vehiculo) ign.add(JUG.vehiculo.b); if (e.o) ign.add(e.o.b);
  const der = vcross(dir0, Math.abs(dir0.y) > 0.99 ? v3(1, 0, 0) : v3(0, 1, 0)).norm(), arr = vcross(der, dir0).norm();
  for (let i = 0; i < n; i++) {
    const x = Math.random() - 0.5 + (Math.random() - 0.5), y = Math.random() - 0.5 + (Math.random() - 0.5);
    const d = vadd(dir0, vadd(vscale(der, x * sp.x), vscale(arr, y * sp.y))).norm();
    const h = raycast(src, d, dist, ign.size ? ign : null); if (h && !h.p) h.p = vadd(src, vscale(d, h.t)); const fin = h ? h.p : vadd(src, vscale(d, dist));
    GMA.nBala = (GMA.nBala || 0) + 1;
    if (trac > 0 && GMA.nBala % trac === 0) gmaTrazadora(tnom, src, fin, wep || e);
    const tr = gmaTraza(src, d, dist, null, h || false), di = gmaDmgInfo(dan, at, inf, GMA.V(fin)); di.tipo = 2; di.fuerza = GMA.Vd(vscale(d, dan * fuerza));
    let ef = true, da = true;
    if (typeof cb === 'function') { const r = gmLlamar(cb, GMA.ctx, at, tr, di), o = r[0]; if (o instanceof LuaTable) { if (o.get('effects') === false) ef = false; if (o.get('damage') === false) da = false; } }
    if (!h) continue;
    if (ef) { const r = wep ? metodo(wep, 'DoImpactEffect', GMA.ctx, tr, 2) : E0; if (r[0] !== true) efectoImpacto(h.p, h.n, h.body && h.body.persona ? 'cuerpo' : 'mundo'); }
    if (da) gmaDanoBala(h, d, di, fuerza);
  }
}
// las entradas de las entidades del motor (Fire/Input): las que usan los addons
function gmaEntrada(e, inp, val) {
  if (!(e instanceof LEnt) || !e.vivo) return;
  const i = inp.toLowerCase(), kv = (k) => (e.kv ? e.kv.get(k) ?? e.kv.get(k.toLowerCase()) : undefined), p = gmaEntPos(e);
  if (i === 'kill' || i === 'killhierarchy') { gmaQuitar(e); return; }
  if (e.clase === 'env_explosion' && i === 'explode') { const mag = +kv('iMagnitude'); const m = Number.isFinite(mag) ? mag : 100, r = (+kv('iRadiusOverride') || m * 2.5) * GS; if (m > 0) explosion(p, Math.max(0.5, r), m); else { efectoExplosion(p); sonar('GrenadeExplode', p, 1.2); } if (!(+kv('spawnflags') & 2)) gmaQuitar(e); return; }
  if (e.clase === 'env_physexplosion' && i === 'explode') { const m = +kv('magnitude') || 100, r = (+kv('radius') || 128) * GS; for (const o of OBJS) { const d = vsub(o.b.pos, p), l = d.len(); if (l < r && o.b.dynamic) { o.b.wake(); o.b.applyVel(vscale(d.norm(), m * 0.05 * (1 - l / r)), v3(), 1); } } return; }
  if (e.clase === 'env_spark' && /spark/.test(i)) { for (let k = 0; k < 10; k++) particula(p, v3(Math.random() * 4 - 2, Math.random() * 3, Math.random() * 4 - 2), 0.4, 0.03, [1, 0.8, 0.3, 1], 'chispa'); return; }
  if (e.clase === 'env_shake' && /startshake/.test(i)) { if (typeof sacudir === 'function') sacudir(Math.min(1, (+kv('amplitude') || 4) / 16)); return; }
  if ((e.clase === 'point_hurt' || e.clase === 'env_fire') && /hurt|startfire|enable/.test(i)) { const r = (+kv('DamageRadius') || +kv('firesize') || 64) * GS, dn = +kv('Damage') || 10; if (vsub(JUG.pos, p).len() < r && typeof danarJugador === 'function') danarJugador(dn); return; }
  const c = claseTabla(e.clase, 'S'); if (c) metodo(e, 'AcceptInput', 'S', inp, GMA.jug, GMA.jug, val);
}
function gmaTrazadora(n, a, b, ent) {
  const d = { d: new Map(), __mt: GMA.mtEfecto };
  d.d.set('Start', GMA.V(a)); d.d.set('Origin', GMA.V(b)); d.d.set('Entity', ent || NULL_ENT); d.d.set('Attachment', 1); d.d.set('Scale', 5000); d.d.set('Flags', 0); d.d.set('Normal', GMA.Vd(vsub(b, a).norm()));
  gmaEfecto(n, d);
}
function gmaDanoBala(h, d, di, fuerza) {
  const b = h.body; if (!b) return;
  if (b.wake) b.wake();
  if (b.dynamic) b.applyVel(vscale(d, Math.min(8, di.dan * 0.6 * Math.min(4, Math.max(0.25, fuerza)) / Math.max(1, b.mass * 0.05))), vsub(h.p, b.pos), 1);
  const e = b.obj ? GMA.entPorObj.get(b.obj) : null;
  if (e && claseTabla(e.clase, 'S') && !GMA.danando) { GMA.danando = true; try { gmaDanar(e, di.dan, di.at, di.inf, di); } finally { GMA.danando = false; } return; }
  if (b.obj) danarObjeto(b.obj, di.dan, h.p, d);
  if (b.persona) danarPersona(b.persona, di.dan, h.p, d, b);
  if (b.verity && typeof verEmpujon === 'function') verEmpujon(b.verity, vscale(d, Math.min(9, 2 + di.dan * 0.25)), true);
}
const IN = { ATTACK: 1, JUMP: 2, DUCK: 4, FORWARD: 8, BACK: 16, USE: 32, LEFT: 128, RIGHT: 256, MOVELEFT: 512, MOVERIGHT: 1024, ATTACK2: 2048, RELOAD: 8192, SPEED: 131072, WALK: 262144, ZOOM: 524288 };
function gmaTeclas() {
  let k = 0; if (typeof ENT === 'undefined') return 0; const t = ENT.teclas || new Set();
  if (ENT.disparo) k |= IN.ATTACK; if (ENT.disparo2) k |= IN.ATTACK2; if (ENT.saltar || t.has('Space')) k |= IN.JUMP; if (ENT.agachar || t.has('ControlLeft')) k |= IN.DUCK;
  if (t.has('KeyW') || ENT.y > 0.3) k |= IN.FORWARD; if (t.has('KeyS') || ENT.y < -0.3) k |= IN.BACK; if (t.has('KeyA') || ENT.x < -0.3) k |= IN.MOVELEFT; if (t.has('KeyD') || ENT.x > 0.3) k |= IN.MOVERIGHT;
  // (los botones de la pantalla también cuentan mientras el dedo está encima: hay armas que miran KeyDown(IN_RELOAD) en su
  // Think en vez de usar SWEP:Reload)
  const bt = (id) => typeof TOQ !== 'undefined' && [...TOQ.botones].some((b) => b.id === id);
  if (t.has('KeyE') || (typeof CTL !== 'undefined' && CTL.teclasMod.has('KeyE')) || bt('busar')) k |= IN.USE; if (t.has('KeyR') || bt('brecargar')) k |= IN.RELOAD; if (ENT.correr || t.has('ShiftLeft')) k |= IN.SPEED; if (t.has('AltLeft')) k |= IN.WALK;
  if (typeof CTL !== 'undefined') k |= CTL.inMod; return k;
}
const gmaTecla = (k) => !!(gmaTeclas() & k);
// las teclas de GMod (KEY_*, MOUSE_*) ↔ las del navegador; las que están apretadas en este cuadro (teclado, botones de los
// mods en la pantalla, los táctiles de usar/recargar/saltar/agachar/correr y los del mouse)
const GMA_KEYJS = (() => { const t = []; for (let i = 0; i <= 9; i++) t[1 + i] = 'Digit' + i; for (let i = 0; i < 26; i++) t[11 + i] = 'Key' + String.fromCharCode(65 + i); for (let i = 0; i <= 9; i++) t[37 + i] = 'Numpad' + i;
  ['NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'NumpadAdd', 'NumpadEnter', 'NumpadDecimal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Backquote', 'Comma', 'Period', 'Slash', 'Backslash', 'Minus', 'Equal', 'Enter', 'Space', 'Backspace', 'Tab', 'CapsLock', 'NumLock', 'Escape', 'ScrollLock', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Pause', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].forEach((c, i) => { t[47 + i] = c; });
  for (let i = 1; i <= 12; i++) t[91 + i] = 'F' + i; return t; })();
const GMA_JSKEY = new Map(GMA_KEYJS.map((c, n) => [c, n]).filter((x) => x[0]));
function gmaBotones() {
  const s = new Set(); if (typeof ENT === 'undefined' || (typeof UI !== 'undefined' && UI.abierto)) return s;
  const pon = (c) => { const n = GMA_JSKEY.get(c); if (n) s.add(n); };
  for (const c of ENT.teclas || []) pon(c);
  if (typeof CTL !== 'undefined') { for (const c of CTL.teclasMod) pon(c); if (CTL.raton) s.add(CTL.raton); }
  const bt = (id) => typeof TOQ !== 'undefined' && [...TOQ.botones].some((b) => b.id === id);
  if (bt('busar')) s.add(15); if (bt('brecargar')) s.add(28); if (ENT.saltar) s.add(65); if (ENT.agachar) s.add(83); if (ENT.correr) s.add(79);
  if (ENT.disparo) s.add(107); if (ENT.disparo2) s.add(108);
  return s;
}
const gmaTeclaAbajo = (k) => (GMA.botAnt || gmaBotones()).has(+k);
function gmaSwepPrim(w, k) { const c = claseTabla(w.clase, 'S'); const p = c && buscarEnClase(c, 'Primary'); return p instanceof LuaTable ? p.get(k) : undefined; }
function gmaSwepSec(w, k) { const c = claseTabla(w.clase, 'S'); const p = c && buscarEnClase(c, 'Secondary'); return p instanceof LuaTable ? p.get(k) : undefined; }
function gmaConsola2(c) {
  const p = c.trim().split(/\s+/), cmd = GMA.cmds && GMA.cmds.get(p[0]);
  if (cmd) gmLlamar(cmd.f, cmd.ctx, GMA.jug, p[0], GMA.R.tab(p.slice(1)), p.slice(1).join(' '));
  else if (GMA.cvars.has(p[0]) && p.length > 1) gmaCvarPoner(p[0], p.slice(1).join(' '));
}
function gmaCvarPoner(n, v) { const c = GMA.cvars.get(n); if (!c) return; const viejo = c.v; c.v = String(v); for (const cb of c.cbs || []) gmLlamar(cb.f, cb.ctx, n, viejo, c.v); }
// las armas de HL2 que un addon puede tirar al piso (ents.Create("weapon_...")): su modelo de mundo
const GMA_ARMA_SUELO = { weapon_pistol: 'models/weapons/w_pistol.mdl', weapon_357: 'models/weapons/w_357.mdl', weapon_smg1: 'models/weapons/w_smg1.mdl', weapon_ar2: 'models/weapons/w_irifle.mdl',
  weapon_shotgun: 'models/weapons/w_shotgun.mdl', weapon_crossbow: 'models/weapons/w_crossbow.mdl', weapon_rpg: 'models/weapons/w_rocket_launcher.mdl', weapon_crowbar: 'models/weapons/w_crowbar.mdl',
  weapon_frag: 'models/weapons/w_grenade.mdl', weapon_stunstick: 'models/weapons/w_stunbaton.mdl', weapon_physcannon: 'models/weapons/w_physics.mdl', weapon_slam: 'models/weapons/w_slam.mdl', weapon_bugbait: 'models/weapons/w_bugbait.mdl' };
// pasar por encima de un arma tirada la agarra (como en GMod), salvo que el jugador la acabe de tirar
function gmaArmasSuelo() {
  if (!GMA.ents || !JUG || !JUG.pos || JUEGO.estado !== 'juego') return;
  for (const e of GMA.ents.values()) {
    if (!e.armaSuelo || !e.vivo || !e.o || !e.o.b || (e.tiradaHasta && TIEMPO.t < e.tiradaHasta)) continue;
    const p = e.o.b.pos, dx = p.x - JUG.pos.x, dz = p.z - JUG.pos.z, dy = p.y - (JUG.pos.y - (JUG.medio || 0.9));
    if (dx * dx + dz * dz < 1.1 * 1.1 && Math.abs(dy) < 1.6) { const c = e.armaSuelo; gmaQuitar(e); gmaDarArma(c); }
  }
}
// armas de los addons: se dan como un arma más del juego (tipo 'gmswep')
function gmaDarArma(clase) {
  if (HL2_ARMAS[clase] && DEF_ARMAS[HL2_ARMAS[clase]]) { darArma(HL2_ARMAS[clase]); return NULL_ENT; }
  if (!GMA.armas.has(clase)) return NULL_ENT;
  GMA.armasJug = GMA.armasJug || new Map();
  let w = GMA.armasJug.get(clase);
  if (!w) {
    w = new LEnt(clase, 'arma'); w.dueño = GMA.jug; const cs = gmaSwepPrim(w, 'ClipSize'), dc = gmaSwepPrim(w, 'DefaultClip'); w.clip1 = cs === undefined || cs < 0 ? -1 : Math.min(cs, dc ?? cs); w.creado = true;
    const c = claseTabla(clase, 'S'); w.vm = c && buscarEnClase(c, 'ViewModel'); w.wm = c && buscarEnClase(c, 'WorldModel');
    GMA.armasJug.set(clase, w);
    const base = gmaVistaBase(w.vm, c && buscarEnClase(c, 'HoldType')), B = base ? DEF_ARMAS[base] : null;
    DEF_ARMAS['gm:' + clase] = Object.assign({}, B ? { nodo: B.nodo, ic: B.ic, fuego: B.fuego, sacar: B.sacar, recarga: B.recarga, quieto: B.quieto, base } : { nodo: '', ic: 'W_Pistol' }, { car: 0, cad: 0.05, tipo: 'gmswep', gm: clase, nom: String((c && c.get('PrintName')) || clase) });
    gmaPreparar(w); metodo(w, 'Initialize', 'S'); const cc = GMA.armas.get(clase); if (cc && cc.C && cc.C !== cc.S) metodo(w, 'Initialize', 'C');
  }
  darArma('gm:' + clase);
  return w;
}
const GMA_VM = [[/(v|c)_pistol\b/, 'Pistol'], [/(v|c)_357\b/, 'Revolver'], [/(v|c)_smg1\b/, 'Smg'], [/(v|c)_irifle\b|ar2/, 'Akm'], [/(v|c)_shotgun\b/, 'Shotgun'], [/(v|c)_rpg\b/, 'RPG'], [/(v|c)_crossbow\b/, 'Crossbow'],
  [/(v|c)_crowbar\b/, 'Crowbar'], [/(v|c)_stunstick\b/, 'Bat'], [/physcannon/, 'GravityGun'], [/toolgun/, 'ToolBaton'], [/(v|c)_physics\b|physgun/, 'PhysicsGun'], [/(v|c)_(grenade|slam|bugbait|medkit)|c_arms|hands|fists/, 'Hands']];
const GMA_HOLD = { pistol: 'Pistol', revolver: 'Revolver', duel: 'Pistol', smg: 'Smg', ar2: 'Akm', shotgun: 'Shotgun', rpg: 'RPG', crossbow: 'Crossbow', melee: 'Crowbar', melee2: 'Bat', knife: 'Crowbar', fist: 'Hands', normal: 'Hands', grenade: 'Hands', slam: 'Hands', magic: 'Hands', camera: 'Camera', physgun: 'PhysicsGun', passive: 'Hands' };
// las teclas como "binds" de GMod: PlayerBindPress de los addons (la F es "impulse 100", la de elegir poder de la
// Lightsaber; 1-9 son slot1-9; F2 abre los equipos de un modo de juego). Si un hook la toma (devuelve true), el juego no
// hace lo suyo con esa tecla. input.LookupBinding dice qué tecla es cada bind.
const GMA_BINDS = { KeyF: 'impulse 100', KeyR: '+reload', KeyE: '+use', Space: '+jump', KeyQ: '+menu', KeyC: '+menu_context', Tab: '+showscores', KeyT: 'messagemode', KeyZ: 'gmod_undo', KeyN: 'noclip', F1: 'gm_showhelp', F2: 'gm_showteam', F3: 'gm_showspare1', F4: 'gm_showspare2' };
const GMA_TECLA_DE = { 'impulse 100': 'F', '+reload': 'R', '+use': 'E', '+jump': 'SPACE', '+menu': 'Q', '+menu_context': 'C', '+showscores': 'TAB', messagemode: 'T', gmod_undo: 'Z', noclip: 'N', gm_showhelp: 'F1', gm_showteam: 'F2', gm_showspare1: 'F3', gm_showspare2: 'F4',
  '+attack': 'MOUSE1', '+attack2': 'MOUSE2', '+duck': 'CTRL', '+speed': 'SHIFT', '+walk': 'ALT', '+forward': 'W', '+back': 'S', '+moveleft': 'A', '+moveright': 'D', invnext: 'MWHEELDOWN', invprev: 'MWHEELUP', '+zoom': 'B' };
function gmaBindTecla(code) {
  if (!GMA.R || !GMA.activo || typeof JUEGO === 'undefined' || JUEGO.estado !== 'juego' || UI.abierto) return false;
  const b = GMA_BINDS[code] || (/^Digit[1-9]$/.test(code) ? 'slot' + code.slice(5) : null); if (!b) return false;
  return gmaBind(b);
}
// un bind de GMod (PlayerBindPress de los addons; si nadie lo toma, true sólo para los que abren algo del modo de juego)
function gmaBind(b) {
  if (!GMA.R || !GMA.activo) return false;
  const H = GMA.hooks.get('PlayerBindPress');
  if (H && [...H.values()].some((h) => h.C)) { const r = gmaHook0('PlayerBindPress', 'C', GMA.jug, b, true); if (r[0] === true) return true; }
  if (b === 'gm_showteam' && GMA.modo && typeof gmmEquiposAbrir === 'function') { gmmEquiposAbrir(); return true; }
  return false;
}
// la base del juego que corresponde al "hold type" de ahora de un arma de addon del jugador ('normal': sin arma)
function gmaHoldBase(n) {
  const w = GMA.armasJug && GMA.armasJug.get(String(n).replace(/^gm:/, '')); if (!w || !w.hold) return null;
  const h = String(w.hold).toLowerCase(); if (h === 'normal' || h === 'passive') return 'Hands';
  return GMA_HOLD[h] && DEF_ARMAS[GMA_HOLD[h]] ? GMA_HOLD[h] : null;
}
function gmaVistaBase(vm, hold) {
  const m = String(vm || '').toLowerCase().replace(/\\/g, '/');
  if (m && gmArchivo(m)) return null;   // (trae su propio ViewModel)
  for (const [re, n] of GMA_VM) if (re.test(m) && DEF_ARMAS[n]) return n;
  const h = GMA_HOLD[String(hold || '').toLowerCase()]; return h && DEF_ARMAS[h] ? h : DEF_ARMAS.Pistol ? 'Pistol' : null;
}
// SendWeaponAnim: la animación de la vista del juego que corresponde (disparo, recarga, sacar, quieto)
function gmaAnimVista(w, act) {
  { const v = typeof gmvVista === 'function' && gmvVista(); if (v && GMA.swep === w) { gmvActividad(v, act); return; } }
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n]; if (!D || D.gm !== w.clase || !ARM.v) return;
  const G = (k) => GMA.R.G.get(k), clip = act === G('ACT_VM_PRIMARYATTACK') || act === G('ACT_VM_SECONDARYATTACK') || act === G('ACT_VM_HITCENTER') || act === G('ACT_VM_MISSCENTER') ? D.fuego : act === G('ACT_VM_RELOAD') ? D.recarga : act === G('ACT_VM_DRAW') ? D.sacar : act === G('ACT_VM_IDLE') ? D.quieto : null;
  const c = Array.isArray(clip) ? clip[(Math.random() * clip.length) | 0] : clip; if (c) vistaTocar(ARM.v, c);
}
function gmaQuitarArma(clase) { const w = GMA.armasJug && GMA.armasJug.get(clase); if (!w) return; GMA.armasJug.delete(clase); const n = 'gm:' + clase, i = ARM.lista.indexOf(n); if (i >= 0) { ARM.lista.splice(i, 1); if (ARM.i >= ARM.lista.length) ARM.i = 0; elegirArma(ARM.i); } }
// (cada cuadro, con un arma de un addon en la mano: ataques, recarga, Think; y Deploy/Holster al cambiar)
function gmaSwepPaso() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n], w = D && D.tipo === 'gmswep' && GMA.armasJug ? GMA.armasJug.get(D.gm) : null;
  if (w !== GMA.swep) { if (GMA.swep && GMA.swep.vivo) metodo(GMA.swep, 'Holster', 'S'); GMA.swep = w; if (w) { metodo(w, 'Deploy', 'S'); w.vmMd = null; } }
  if (!w || UI.abierto || !JUG.vivo) { if (w) w.prevP = false; return; }
  const t = TIEMPO.t;
  if (w.recarga && t >= w.recarga) { w.recarga = 0; const cs = gmaSwepPrim(w, 'ClipSize'); if (cs > 0) w.clip1 = cs; }
  const auto = R_T(gmaSwepPrim(w, 'Automatic'));
  if (ENT.disparo && (auto || !w.prevP) && t >= (w.nextP || 0) && !w.recarga) metodo(w, 'PrimaryAttack', 'S');
  w.prevP = !!ENT.disparo;
  // (el secundario se mantiene apretado como en GMod: las miras de M9K, FA:S o TFA miran KeyDown(IN_ATTACK2) todo el rato;
  // SecondaryAttack va al apretar, o seguido si Secondary.Automatic)
  const auto2 = R_T(gmaSwepSec(w, 'Automatic'));
  if (ENT.disparo2 && (auto2 || !w.prevS) && t >= (w.nextS || 0) && !w.recarga) metodo(w, 'SecondaryAttack', 'S');
  w.prevS = !!ENT.disparo2;
  const pR = (ENT.teclas && ENT.teclas.has('KeyR')) || GMA.pedirRecarga; GMA.pedirRecarga = false;
  if (pR) { if (!w.prevR) metodo(w, 'Reload', 'S'); w.prevR = true; } else w.prevR = false;
  metodo(w, 'Think', 'S');
}
const R_T = (x) => x !== undefined && x !== false && x !== null;
// el arma del addon en primera persona: su ViewModel (o su WorldModel) con la cámara
function gmaVistaDibujar() {
  const w = GMA.swep; if (!w) return false;
  if (w.vmMd === null || w.vmMd === undefined) {
    w.vmMd = false; const m = w.vm || w.wm;
    const pf = m && gmArchivo(String(m).toLowerCase().replace(/\\/g, '/')) ? gmPrefab('gm:' + String(m).toLowerCase().replace(/\\/g, '/')) : null;
    if (pf) { const arb = DATA.pf[DATA.pfPorNombre[pf]]; w.vmMd = new Modelo(arb); w.vmMd.p[0] = [0, 0, 0]; w.vmMd.esWM = !w.vm; }
  }
  const md = w.vmMd; if (!md) return false;
  const q = CAM.q, sw = ARM.sway || { x: 0, y: 0, z: 0 }, off = md.esWM ? v3(-0.12, -0.16, 0.42) : v3(-(sw.x || 0) * 0.3, (sw.y || 0) * 0.3, 0), p = vadd(CAM.pos, q.rot(off));
  m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [1, 1, 1], md.raiz); md.sucio = true; md.encolar();
  return true;
}

// ---------------- bibliotecas ----------------
function gmaApiLibs(R, G, def, tabla, lib, num) {
  const V = GMA.V, A = GMA.A, vec = (v) => (v instanceof LVec ? v : new LVec());
  GMA.mundo = (() => { const e = new LEnt('worldspawn', 'mundo'); e.id = 0; return e; })();
  GMA.jug = (() => { const e = new LEnt('player', 'jug'); return e; })();
  const ctxReg = () => GMA.ctx;
  // ---- globales ----
  def(G, 'IsValid', (x) => { if (x === undefined || x === null || x === false) return false; if (x instanceof LEnt) return entValida(x); const f = R.T(x) && typeof x === 'object' ? (() => { try { return R.ix(x, 'IsValid'); } catch (e) { return undefined; } })() : undefined; return typeof f === 'function' ? R.T(R.c(f, 'IsValid', x)[0]) : !(x instanceof LuaTable); });   // (como en GMod: una tabla común sin IsValid no es válida)
  def(G, 'LocalPlayer', () => GMA.jug); def(G, 'Entity', (i) => (i === 1 ? GMA.jug : i === 0 ? GMA.mundo : GMA.ents.get(i) || NULL_ENT));
  def(G, 'CurTime', () => TIEMPO.t); def(G, 'UnPredictedCurTime', () => TIEMPO.t); def(G, 'RealTime', () => performance.now() / 1000); def(G, 'SysTime', () => performance.now() / 1000); def(G, 'FrameTime', () => TIEMPO.dt || 1 / 60); def(G, 'RealFrameTime', () => TIEMPO.dt || 1 / 60); def(G, 'FrameNumber', () => R.cuadro || 0); def(G, 'VGUIFrameTime', () => performance.now() / 1000);
  def(G, 'ScrW', () => VW()); def(G, 'ScrH', () => VH()); def(G, 'EyePos', () => V(CAM.pos)); def(G, 'EyeAngles', () => A(dirAng(dS(CAM.fwd)))); def(G, 'EyeVector', () => GMA.Vd(CAM.fwd));
  def(G, 'Sound', (s) => s); def(G, 'Model', (s) => s); def(G, 'AddCSLuaFile', () => {}); def(G, 'IsFirstTimePredicted', () => true); def(G, 'SoundDuration', () => 1); def(G, 'GetHostName', () => (typeof SALA !== 'undefined' && SALA ? SALA.n : 'JXMod'));
  def(G, 'include', (r) => gmaIncluir(String(r))); def(G, 'IncludeCS', (r) => gmaIncluir(String(r)));
  def(G, 'Msg', (...a) => gmaConsola(a.map(R.tostr).join(''))); def(G, 'MsgN', (...a) => gmaConsola(a.map(R.tostr).join(''))); def(G, 'MsgC', (...a) => gmaConsola(a.filter((x) => !(x instanceof LuaTable && x.mt === GMA.mtCol)).map(R.tostr).join('')));
  def(G, 'ErrorNoHalt', (...a) => gmaErr(a.map(R.tostr).join(''))); def(G, 'ErrorNoHaltWithStack', (...a) => gmaErr(a.map(R.tostr).join(''))); def(G, 'Error', (...a) => { throw new LuaError(a.map(R.tostr).join('')); });
  def(G, 'CompileString', (src, nombre, sinError) => { try { return R.cargar(String(src), String(nombre || 'CompileString')); } catch (e) { if (sinError === false) return R.msgErr(e); throw e; } });
  def(G, 'RunString', (src, nombre) => { try { R.c(R.cargar(String(src), String(nombre || 'RunString')), 'RunString'); } catch (e) { gmaErr(R.msgErr(e)); } }); def(G, 'RunStringEx', (src, nombre) => G.get('RunString')(src, nombre));
  { const dbg = G.get('debug'); if (dbg instanceof LuaTable) def(dbg, 'getregistry', () => { const t = new LuaTable(); for (const [n, m] of Object.entries(GMA.metas)) t.set(n, m); return t; }); }
  def(G, 'FindMetaTable', (n) => { n = String(n); if (n === 'ConVar') return gmaMtCvar(); if (!GMA.metas[n] && /^[A-Z][A-Za-z_]+$/.test(n)) { const t = new LuaTable(); t.set('MetaName', n); t.set('__index', t); GMA.metas[n] = t; } return GMA.metas[n]; }); def(G, 'RegisterMetaTable', (n, t) => { GMA.metas[n] = t; });
  def(G, 'SafeRemoveEntity', (e) => gmaQuitar(e)); def(G, 'SafeRemoveEntityDelayed', (e, t) => GMA.tSimples.push({ t: TIEMPO.t + num(t, 0), f: () => gmaQuitar(e), ctx: 'S' }));
  def(G, 'BroadcastLua', () => {}); def(G, 'SendUserMessage', () => {}); def(G, 'AddWorldTip', () => {}); def(G, 'DeriveGamemode', () => {}); def(G, 'CreateClientConVar', (n, d, s, u, h) => gmaCvar(n, d, h)); def(G, 'CreateConVar', (n, d, f, h) => gmaCvar(n, d, h));
  // (como GMod: una variable que nadie creó no existe: GetConVar da nil, GetConVarNumber 0 y GetConVarString ""; las del motor ya están)
  const cvHay = (n) => { n = String(n); if (GMA.cvars.has(n)) return true; const d = gmaCvarMotor(n); if (d === undefined) return false; gmaCvar(n, d); return true; };
  def(G, 'GetConVar', (n) => (cvHay(n) ? gmaCvar(n) : undefined)); def(G, 'GetConVar_Internal', (n) => (cvHay(n) ? gmaCvar(n) : undefined));
  def(G, 'GetConVarNumber', (n) => (cvHay(n) ? num(GMA.R.aNum(GMA.cvars.get(String(n)).v), 0) : 0)); def(G, 'GetConVarString', (n) => (cvHay(n) ? String(GMA.cvars.get(String(n)).v) : '')); def(G, 'ConVarExists', (n) => cvHay(n));
  def(G, 'RunConsoleCommand', (...a) => gmaConsola2(a.map(R.tostr).join(' ')));
  def(G, 'ParticleEmitter', (p) => ({ p, __mt: GMA.mtEmisor })); def(G, 'EffectData', () => ({ d: new Map(), __mt: GMA.mtEfecto })); def(G, 'DamageInfo', () => gmaDmgInfo(0));
  def(G, 'ClientsideModel', (m) => { const e = new LEnt('class C_BaseFlex', 'ent'); e.modelo = String(m || '').toLowerCase().replace(/\\/g, '/'); e.cs = true; e.creado = true; e.pos = v3(); return e; }); def(G, 'ClientsideRagdoll', () => NULL_ENT); def(G, 'ClientsideScene', () => NULL_ENT);
  def(G, 'CreateSound', (e, s) => ({ e, s, __mt: GMA.mtSnd, vol: 1, tono: 100 })); def(G, 'DynamicLight', () => new LuaTable()); def(G, 'ProjectedTexture', () => ({ __mt: GMA.mtVacio }));
  def(G, 'Material', (p, prm) => { const m = gmaMaterial(String(p || '')); if (prm !== undefined && m.pngp === undefined) m.pngp = String(prm); return m; }); def(G, 'CreateMaterial', (n, sh, prm) => {   // (con su $basetexture; los de refracción no se dibujan: no hay esa pasada)
    if (/refract/i.test(String(sh || ''))) { const m = gmaMaterial(String(n || '')); m.r3 = { nada: true }; return m; }
    const bt = prm instanceof LuaTable ? prm.get('$basetexture') : undefined; return gmaMaterial(typeof bt === 'string' && bt ? bt : String(n || '')); }); def(G, 'Matrix', () => ({ m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], __mt: GMA.mtVacio }));
  def(G, 'GetGlobalInt', (k, d) => GMA.glob?.get(k) ?? d ?? 0); def(G, 'GetGlobalFloat', (k, d) => GMA.glob?.get(k) ?? d ?? 0); def(G, 'GetGlobalBool', (k, d) => GMA.glob?.get(k) ?? d ?? false); def(G, 'GetGlobalString', (k, d) => GMA.glob?.get(k) ?? d ?? ''); def(G, 'GetGlobalEntity', (k) => GMA.glob?.get(k) ?? NULL_ENT); def(G, 'GetGlobalVector', (k) => GMA.glob?.get(k) ?? GMA.nv(0, 0, 0)); def(G, 'GetGlobalAngle', (k) => GMA.glob?.get(k) ?? GMA.na(0, 0, 0));
  for (const t of ['Int', 'Float', 'Bool', 'String', 'Entity', 'Vector', 'Angle', 'Var']) { def(G, 'SetGlobal' + t, (k, v) => { (GMA.glob || (GMA.glob = new Map())).set(k, v); }); def(G, 'SetGlobal2' + t, (k, v) => { (GMA.glob || (GMA.glob = new Map())).set(k, v); }); def(G, 'GetGlobal2' + t, (k, d) => GMA.glob?.get(k) ?? d); }
  def(G, 'GetRenderTarget', () => gmaMaterial('rt')); def(G, 'GetRenderTargetEx', () => gmaMaterial('rt')); def(G, 'DrawBloom', () => {}); for (const n of ['DrawBokehDOF', 'DOFModeHack', 'DOF_Start', 'DOF_Kill', 'RenderDoF', 'RenderSuperDoF', 'RenderStereoscopy', 'DrawTexturize']) if (G.get(n) === undefined) def(G, n, () => {}); def(G, 'DrawColorModify', (t) => { if (!(t instanceof LuaTable)) return; const g = (k, d) => num(t.get('$pp_colour_' + k), d);   // (se aplica al terminar el cuadro: gmaPPAplicar)
    GMA.pp = { add: [g('addr', 0), g('addg', 0), g('addb', 0)], bri: g('brightness', 0), con: g('contrast', 1), col: g('colour', 1), mul: [g('mulr', 0), g('mulg', 0), g('mulb', 0)] }; }); def(G, 'DrawMotionBlur', () => {}); def(G, 'DrawSharpen', () => {}); def(G, 'DrawSobel', () => {}); def(G, 'DrawToyTown', () => {}); def(G, 'DrawSunbeams', () => {}); if (G.get('DrawMaterialOverlay') === undefined) def(G, 'DrawMaterialOverlay', () => {}); def(G, 'DrawTexturize', () => {});
  def(G, 'Format', (...a) => R.c(R.G.get('string').get('format'), 'format', ...a));
  // (list.Set de NPC y de vehículos: lo que cada addon agrega al menú de GMod; gmod_spawn.js lo pone en el mundo)
  def(G, '__gmLista', (n, k, v) => { n = String(n); if ((n !== 'NPC' && n !== 'Vehicles') || !(v instanceof LuaTable)) return; const A = GMA.addonActual; if (!A) return; const L = (A.listas = A.listas || {}); (L[n] = L[n] || new Map()).set(String(k), v); });
  def(G, 'GetViewEntity', () => (GMA.jug && GMA.jug.vistaEnt && entValida(GMA.jug.vistaEnt) ? GMA.jug.vistaEnt : GMA.jug)); def(G, 'IsMounted', () => false); def(G, 'GetMap', () => (typeof MUNDO !== 'undefined' ? MUNDO.nombre : 'gm_flatgrass'));
  // ---- ents, player, game ----
  const ents = lib('ents'), player = lib('player'), game = lib('game'), engine = lib('engine');
  def(ents, 'Create', (c) => { c = String(c || ''); const e = new LEnt(c, 'ent'); e.creador = GMA.jug; const cl = GMA.clases.get(c); if (cl) { const m = claseTabla(c, 'S'), mod = m && buscarEnClase(m, 'Model'); if (mod) e.modelo = String(mod).toLowerCase(); gmaPreparar(e); }
    // (un arma en el piso, como en GMod: con su modelo de mundo; pasando por encima se agarra)
    else if (GMA.armas.has(c) || GMA_ARMA_SUELO[c]) { const m = GMA.armas.has(c) ? claseTabla(c, 'S') : null, wm = m ? buscarEnClase(m, 'WorldModel') : GMA_ARMA_SUELO[c]; e.armaSuelo = c; if (wm) e.modelo = String(wm).toLowerCase(); }
    return e; });
  def(ents, 'CreateClientProp', (m) => { const e = new LEnt('prop_physics', 'ent'); e.modelo = m ? String(m) : ''; return e; }); def(ents, 'CreateClientside', (c) => ents.get('Create')(c));
  // (los puntos de aparición del mapa, como info_player_start de Source: los nextbots que no persiguen cerca de donde se
  // reaparece —la protección de aparición de Walter, Sanic y compañía— los buscan con ents.FindByClass)
  const apariciones = () => { const M = typeof MUNDO !== 'undefined' ? MUNDO : null, L = (M && M.spawns) || [];
    if (GMA.apar && GMA.apar.de === L) return GMA.apar.e;
    for (const e of (GMA.apar && GMA.apar.e) || []) { e.vivo = false; GMA.ents.delete(e.id); }
    const E = L.map((sp) => { const e = new LEnt('info_player_start', 'ent'); e.pos = v3(sp.x, sp.y, sp.z); if (sp.yaw !== undefined) e.q = Quat.axis(0, 1, 0, sp.yaw); e.modelo = ''; return e; });
    GMA.apar = { de: L, e: E }; return E; };
  // (GAMEMODE.SpawnPoints, como lo llena el PlayerSelectSpawn de la base de GMod al aparecer: lo usan los nextbots)
  GMA.aparicionesLua = () => { try { const gm = G.get('GAMEMODE'); if (gm instanceof LuaTable) { const sp = gm.get('SpawnPoints'); const E = apariciones(); if (!(sp instanceof LuaTable) || !E.length || sp.get(1) !== E[0]) gm.set('SpawnPoints', R.tab(E)); } } catch (e) {} };
  const todos = () => { for (const o of OBJS) entDeObj(o); apariciones(); return [...GMA.ents.values()].filter((e) => e.vivo && e.tipo !== 'vm' && (e.tipo !== 'ent' || !e.o || !e.o.borrado)); };
  const patron = (c) => new RegExp('^' + String(c).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
  def(ents, 'GetAll', () => R.tab([GMA.jug, ...todos()])); def(ents, 'GetCount', () => todos().length + 1); def(ents, 'GetByIndex', (i) => G.get('Entity')(i)); def(ents, 'Iterator', () => { const L = [GMA.jug, ...todos()]; let i = 0; return [() => (i < L.length ? [++i, L[i - 1]] : undefined), undefined, 0]; });
  def(ents, 'FindByClass', (c) => { const re = patron(c); return R.tab([GMA.jug, ...todos()].filter((e) => re.test(e.clase))); }); def(ents, 'FindByModel', (m) => R.tab(todos().filter((e) => e.modelo === String(m).toLowerCase()))); def(ents, 'FindByName', () => new LuaTable()); def(ents, 'FindByClassAndParent', () => new LuaTable());
  const enEsfera = (c, r) => [GMA.jug, ...todos()].filter((e) => gmaEntPos(e).distTo(vG(c)) <= r * GS);
  def(ents, 'FindInSphere', (c, r) => R.tab(enEsfera(c, num(r, 0)))); def(ents, 'FindInCone', (c, d, r) => R.tab(enEsfera(c, num(r, 0)))); def(ents, 'FindAlongRay', () => new LuaTable());
  def(ents, 'FindInBox', (a, b) => { const lo = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)], hi = [Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)]; return R.tab([GMA.jug, ...todos()].filter((e) => { const p = vS(gmaEntPos(e)); return p.x >= lo[0] && p.x <= hi[0] && p.y >= lo[1] && p.y <= hi[1] && p.z >= lo[2] && p.z <= hi[2]; })); });
  def(player, 'GetAll', () => R.tab([GMA.jug])); def(player, 'GetHumans', () => R.tab([GMA.jug])); def(player, 'GetBots', () => new LuaTable()); def(player, 'GetCount', () => 1); def(player, 'GetByID', (i) => (i === 1 ? GMA.jug : NULL_ENT)); def(player, 'GetBySteamID', () => GMA.jug); def(player, 'GetBySteamID64', () => GMA.jug); def(player, 'Iterator', () => { let i = 0; return [() => (i++ === 0 ? [1, GMA.jug] : undefined), undefined, 0]; });
  def(game, 'SinglePlayer', () => !(typeof RED !== 'undefined' && RED.on)); def(game, 'MaxPlayers', () => 16); def(game, 'GetMap', () => (typeof MUNDO !== 'undefined' ? MUNDO.nombre : 'gm_flatgrass')); def(game, 'GetWorld', () => GMA.mundo); def(game, 'IsDedicated', () => false);
  def(game, 'ConsoleCommand', (c) => gmaConsola2(String(c))); for (const n of ['AddParticles', 'AddDecal', 'AddAmmoType', 'CleanUpMap', 'SetTimeScale', 'BuildAmmoTypes', 'MountGMA', 'LoadNextMap', 'KickID']) def(game, n, () => {}); def(game, 'GetTimeScale', () => 1); def(game, 'GetAmmoID', () => 1); def(game, 'GetAmmoName', () => 'Pistol'); def(game, 'GetSkillLevel', () => 2); def(game, 'GetIPAddress', () => 'loopback');
  def(engine, 'ActiveGamemode', () => 'sandbox'); def(engine, 'TickInterval', () => 1 / 60); def(engine, 'GetGames', () => new LuaTable()); def(engine, 'GetAddons', () => R.tab([...GMOD.addons.values()].map((a) => tabla({ title: a.nombre, wsid: a.id, mounted: true, downloaded: true })))); def(engine, 'IsPlayingDemo', () => false); def(engine, 'IsRecordingDemo', () => false); def(engine, 'LightStyle', () => {}); def(engine, 'GetGamemodes', () => new LuaTable()); def(engine, 'TickCount', () => R.cuadro || 0);
  // ---- util ----
  const util = lib('util');
  const traza = (t, hull) => { const s = t.get('start') instanceof LVec ? vG(t.get('start')) : CAM.pos.clone(), e = t.get('endpos') instanceof LVec ? vG(t.get('endpos')) : vadd(s, CAM.fwd), d = vsub(e, s), L = d.len() || 1e-6; return gmaTraza(s, d.scale(1 / L), L, gmaIgnorar(t.get('filter'))); };
  def(util, 'TraceLine', (t) => traza(t)); def(util, 'TraceHull', (t) => traza(t, true)); def(util, 'TraceEntity', (t) => traza(t, true));
  def(util, 'QuickTrace', (o, d, f) => { const s = vG(o), dd = vG(d), L = dd.len() || 1e-6; return gmaTraza(s, dd.scale(1 / L), L, gmaIgnorar(f)); });
  def(util, 'GetPlayerTrace', (p, d) => { const t = new LuaTable(); t.set('start', V(CAM.pos)); t.set('endpos', V(vadd(CAM.pos, vscale(d instanceof LVec ? dG(d).norm() : CAM.fwd, 32768 * GS)))); t.set('filter', GMA.jug); return t; });
  def(util, 'Effect', (n, d) => gmaEfecto(String(n), d)); def(util, 'BlastDamage', (inf, at, p, r, d) => { if (p instanceof LVec) { explosion.sinFx = true; try { explosion(vG(p), Math.max(1, num(r, 200) * GS), num(d, 100)); } finally { explosion.sinFx = false; } } });
  def(util, 'BlastDamageInfo', (di, p, r) => { if (p instanceof LVec) explosion(vG(p), Math.max(1, num(r, 200) * GS), di && di.dan || 100); }); def(util, 'ScreenShake', (p, amp) => { CAM.temblor = Math.max(CAM.temblor || 0, Math.min(1, num(amp, 5) / 20)); });
  for (const n of ['AddNetworkString', 'PrecacheModel', 'PrecacheSound', 'Decal', 'DecalEx', 'ParticleTracer', 'ParticleTracerEx', 'SpriteTrail', 'PrecacheScene']) def(util, n, () => 0);
  def(util, 'DecalMaterial', (n) => { const k = String(n || '').toLowerCase(); return /scorch/.test(k) ? 'decals/scorch1' : /blood/.test(k) ? 'decals/blood1' : /yellow/.test(k) ? 'decals/yblood1' : 'decals/concrete/shot1'; });
  def(util, 'IsValidModel', (m) => !!m && (!!gmArchivo(String(m).toLowerCase()) || true)); def(util, 'IsValidProp', () => true); def(util, 'IsValidRagdoll', () => false); def(util, 'IsInWorld', () => true); def(util, 'PointContents', () => 0); def(util, 'IsModelLoaded', () => true);
  def(util, 'TableToJSON', (t, pretty) => JSON.stringify(gmaAJS(t), null, R.T(pretty) ? 2 : 0)); def(util, 'JSONToTable', (s) => { try { return gmaALua(JSON.parse(String(s))); } catch (e) { return undefined; } });
  def(util, 'Base64Encode', (s) => btoa(unescape(encodeURIComponent(String(s))))); def(util, 'Base64Decode', (s) => { try { return decodeURIComponent(escape(atob(String(s)))); } catch (e) { return undefined; } });
  def(util, 'CRC', (s) => { let c = -1; for (const ch of String(s)) { c ^= ch.charCodeAt(0); for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return String((c ^ -1) >>> 0); });
  def(util, 'KeyValuesToTable', (s) => { const r = GMF.kv(String(s)); return r ? gmaALua(r.k) : new LuaTable(); }); def(util, 'TableToKeyValues', () => ''); def(util, 'Compress', (s) => s); def(util, 'Decompress', (s) => s);
  def(util, 'DistanceToLine', (a, b, p) => { const A0 = [a.x, a.y, a.z], B0 = [b.x, b.y, b.z], P0 = [p.x, p.y, p.z], d = B0.map((v, i) => v - A0[i]), L2 = d.reduce((s, v) => s + v * v, 0) || 1, t = Math.max(0, Math.min(1, P0.reduce((s, v, i) => s + (v - A0[i]) * d[i], 0) / L2)), c = A0.map((v, i) => v + d[i] * t); return [Math.hypot(...P0.map((v, i) => v - c[i])), GMA.nv(...c), t]; });
  def(util, 'SteamIDTo64', () => '76561197960265728'); def(util, 'SteamIDFrom64', () => 'STEAM_0:0:1'); def(util, 'NetworkStringToID', () => 1); def(util, 'NetworkIDToString', () => ''); def(util, 'GetSurfaceIndex', () => 0); def(util, 'GetSurfaceData', () => undefined); def(util, 'GetSurfacePropName', () => 'default');
  def(util, 'TimerCycle', () => 0); def(util, 'RelativePathToFull', (p) => p); def(util, 'GetModelInfo', () => new LuaTable()); def(util, 'GetModelMeshes', () => new LuaTable()); def(util, 'IsSkyboxVisibleFromPoint', () => true); def(util, 'IsBoxIntersectingSphere', () => false); def(util, 'AimVector', () => GMA.Vd(CAM.fwd)); def(util, 'SharedRandom', (n, a, b) => num(a, 0) + Math.random() * (num(b, 1) - num(a, 0)));
  def(util, 'LocalToWorld', (lp, la, op, oa) => { const q = angQuat(oa), p = vG(op).add(q.rot(vG(lp))); return [V(p), A(quatAng(new Quat().mulTo(q, angQuat(la))))]; });
  def(G, 'LocalToWorld', util.get('LocalToWorld')); def(G, 'WorldToLocal', (p, a, op, oa) => { const q = angQuat(oa).conj(); return [V(q.rot(vsub(vG(p), vG(op)))), A(quatAng(new Quat().mulTo(q, angQuat(a))))]; });
  // ---- timer y hook (cada función, con el lado en que se registró) ----
  const timer = lib('timer'), TK = (id) => ctxReg() + ':' + String(id);
  def(timer, 'Create', (id, d, r, f) => { GMA.timers.set(TK(id), { d: num(d, 0), r: num(r, 1), f, t: TIEMPO.t + num(d, 0), ctx: ctxReg(), pausa: false }); return true; });
  def(timer, 'Simple', (d, f) => { if (typeof f === 'function' || f instanceof LuaTable) GMA.tSimples.push({ t: TIEMPO.t + num(d, 0), f, ctx: ctxReg() }); });
  def(timer, 'Remove', (id) => { GMA.timers.delete(TK(id)); }); def(timer, 'Destroy', (id) => { GMA.timers.delete(TK(id)); }); def(timer, 'Exists', (id) => GMA.timers.has(TK(id))); def(timer, 'IsTimer', (id) => GMA.timers.has(TK(id)));
  def(timer, 'Adjust', (id, d, r, f) => { const T = GMA.timers.get(TK(id)); if (!T) return false; T.d = num(d, T.d); if (r !== undefined) T.r = num(r, T.r); if (f) T.f = f; T.t = TIEMPO.t + T.d; return true; });
  def(timer, 'Start', (id) => { const T = GMA.timers.get(TK(id)); if (T) { T.t = TIEMPO.t + T.d; T.pausa = false; } return !!T; }); def(timer, 'Stop', (id) => { const T = GMA.timers.get(TK(id)); if (T) T.pausa = true; return !!T; });
  def(timer, 'Pause', (id) => { const T = GMA.timers.get(TK(id)); if (T) { T.pausa = true; T.resta = T.t - TIEMPO.t; } return !!T; }); def(timer, 'UnPause', (id) => { const T = GMA.timers.get(TK(id)); if (T) { T.pausa = false; if (T.resta !== undefined) T.t = TIEMPO.t + T.resta; } return !!T; });
  def(timer, 'Toggle', (id) => { const T = GMA.timers.get(TK(id)); if (T) T.pausa = !T.pausa; return !!T && !T.pausa; }); def(timer, 'TimeLeft', (id) => { const T = GMA.timers.get(TK(id)); return T ? T.t - TIEMPO.t : undefined; }); def(timer, 'RepsLeft', (id) => { const T = GMA.timers.get(TK(id)); return T ? T.r : undefined; }); def(timer, 'Check', () => {});
  const hook = lib('hook');
  def(hook, 'Add', (ev, id, f) => { if (typeof ev !== 'string' || id === undefined || typeof f !== 'function') return; let H = GMA.hooks.get(ev); if (!H) GMA.hooks.set(ev, (H = new Map())); let h = H.get(id); if (!h) H.set(id, (h = {})); h[ctxReg()] = f; h.a = GMA.addonActual ? GMA.addonActual.id : GMA.hookAddon || h.a || null; h['n' + ctxReg()] = 0; });
  def(hook, 'Remove', (ev, id) => { const H = GMA.hooks.get(ev), h = H && H.get(id); if (!h) return; delete h[ctxReg()]; if (!h.S && !h.C) H.delete(id); });
  def(hook, 'Run', (ev, ...a) => gmaHook(String(ev), GMA.ctx, ...a)); def(hook, 'Call', (ev, gm, ...a) => { const r = gmaHook0(String(ev), GMA.ctx, ...a); if (r.length && r[0] !== undefined) return r; if (gm instanceof LuaTable) { const f = gm.get(ev); if (typeof f === 'function') return R.c(f, ev, gm, ...a); } return E0; });
  def(hook, 'GetTable', () => { const t = new LuaTable(), c = ctxReg(); for (const [ev, H] of GMA.hooks) { const s = new LuaTable(); for (const [id, h] of H) if (h[c]) s.set(id, h[c]); t.set(ev, s); } return t; });
  // ---- concommand y cvars ----
  GMA.cmds = new Map(); const cc = lib('concommand'), cvars = lib('cvars');
  def(cc, 'Add', (n, f) => { GMA.cmds.set(String(n), { f, ctx: ctxReg(), a: GMA.addonActual ? GMA.addonActual.id : null }); }); def(cc, 'Remove', (n) => { GMA.cmds.delete(String(n)); }); def(cc, 'Run', (p, n, a) => gmaConsola2(n + ' ' + (a instanceof LuaTable ? a.a.join(' ') : ''))); def(cc, 'GetTable', () => new LuaTable());
  def(cvars, 'AddChangeCallback', (n, f) => { const c = gmaCvar(n, '0').c; (c.cbs || (c.cbs = [])).push({ f, ctx: ctxReg() }); }); def(cvars, 'RemoveChangeCallback', () => {});
  def(cvars, 'Number', (n, d) => (GMA.cvars.has(n) ? num(GMA.cvars.get(n).v, d) : d)); def(cvars, 'String', (n, d) => (GMA.cvars.has(n) ? String(GMA.cvars.get(n).v) : d)); def(cvars, 'Bool', (n, d) => (GMA.cvars.has(n) ? !!num(GMA.cvars.get(n).v, 0) : d)); def(cvars, 'GetConVarCallbacks', () => new LuaTable());
  // ---- net y umsg ----
  const net = lib('net'); let saliente = null, lectura = null;
  def(net, 'Start', (n) => { saliente = { n: String(n).toLowerCase(), v: [], ctx: GMA.ctx }; return true; });
  for (const t of ['String', 'Int', 'UInt', 'Float', 'Double', 'Bool', 'Entity', 'Vector', 'Angle', 'Table', 'Color', 'Data', 'Bit', 'Normal', 'Type', 'Matrix', 'UInt64', 'Player']) {
    def(net, 'Write' + t, (v) => { if (saliente) saliente.v.push(v); }); def(net, 'Read' + t, () => { if (!lectura) return undefined; const v = lectura.v[lectura.i++];
      if (t === 'Bit') return R.T(v) && v !== 0 ? 1 : 0; if (t === 'Bool') return R.T(v) && v !== 0; if (/Int|Float|Double/.test(t)) return typeof v === 'number' ? v : R.aNum(v) ?? 0; if (t === 'String' || t === 'Data') return v === undefined ? '' : typeof v === 'string' ? v : R.tostr(v);
      return v !== undefined ? v : t === 'Entity' || t === 'Player' ? NULL_ENT : undefined; });
  }
  const enviar = (lado) => { if (!saliente) return; GMA.netCola = GMA.netCola || []; GMA.netCola.push({ n: saliente.n, v: saliente.v, lado }); saliente = null; };
  for (const n of ['Send', 'Broadcast', 'SendOmit', 'SendPVS', 'SendPAS']) def(net, n, () => enviar('C')); def(net, 'SendToServer', () => enviar('S'));
  def(net, 'Receive', (n, f) => { GMA.net[ctxReg()].set(String(n).toLowerCase(), f); }); def(net, 'Incoming', () => {}); def(net, 'BytesWritten', () => (saliente ? saliente.v.length * 4 : 0)); def(net, 'BytesLeft', () => (lectura ? (lectura.v.length - lectura.i) * 4 : 0)); def(net, 'Abort', () => { saliente = null; });
  GMA.netEntregar = (m) => { const f = GMA.net[m.lado].get(m.n); if (!f) return; const l0 = lectura; lectura = { v: m.v, i: 0 }; try { gmLlamar(f, m.lado, m.v.length * 32, GMA.jug); } finally { lectura = l0; } };
  const umsg = lib('umsg'), usm = lib('usermessage'); let um = null; GMA.umsgH = new Map();
  def(umsg, 'Start', (n) => { um = { n: String(n), v: [] }; }); for (const t of ['String', 'Long', 'Short', 'Float', 'Bool', 'Entity', 'Vector', 'Angle', 'Char', 'VectorNormal']) def(umsg, t, (v) => { if (um) um.v.push(v); });
  def(umsg, 'End', () => { if (!um) return; const h = GMA.umsgH.get(um.n); if (h) { const m = um; GMA.tSimples.push({ t: 0, f: () => { const L = { v: m.v, i: 0, __mt: GMA.mtUm }; gmLlamar(h.f, 'C', L); }, ctx: 'C', js: true }); } um = null; });
  def(umsg, 'PoolString', () => {}); def(umsg, 'Angle', (v) => { if (um) um.v.push(v); });
  def(usm, 'Hook', (n, f) => { GMA.umsgH.set(String(n), { f }); }); def(usm, 'GetTable', () => new LuaTable());
  const UMM = (GMA.mtUm = new LuaTable()), UMI = new LuaTable(); UMM.set('__index', UMI); for (const t of ['String', 'Long', 'Short', 'Float', 'Bool', 'Entity', 'Vector', 'Angle', 'Char', 'VectorNormal']) UMI.set('Read' + t, (L) => L.v[L.i++]); UMI.set('Reset', (L) => { L.i = 0; });
  // ---- sonido ----
  const sound = lib('sound'); GMA.guiones = new Map();
  def(sound, 'Add', (t) => { if (!(t instanceof LuaTable)) return; const n = String(t.get('name') || '').toLowerCase(), w = t.get('sound'); const L = w instanceof LuaTable ? w.a.map(String) : [String(w || '')]; const v = t.get('volume'), p = t.get('pitch'); GMA.guiones.set(n, { w: L, v: typeof v === 'number' ? v : v instanceof LuaTable ? v.get(1) : 1, p: typeof p === 'number' ? p : p instanceof LuaTable ? (p.get(1) + p.get(2)) / 2 : 100 }); });
  def(sound, 'Play', (s, p, n, t, v) => gmaSonar(String(s), p instanceof LVec ? vG(p) : null, v, t)); def(sound, 'PlayFile', () => {}); def(sound, 'PlayURL', () => {}); def(sound, 'GetTable', () => R.tab([...GMA.guiones.keys()])); def(sound, 'GetProperties', () => undefined); def(sound, 'Generate', () => {});
  const SNM = (GMA.mtSnd = new LuaTable()), SNI = new LuaTable(); SNM.set('__index', SNI);
  SNI.set('Play', (s) => { s.on = true; gmaSonar(s.s, s.e instanceof LEnt ? gmaEntPos(s.e) : null, s.vol, s.tono); }); SNI.set('PlayEx', (s, v, p) => { s.vol = v; s.tono = p; SNI.get('Play')(s); }); SNI.set('Stop', (s) => { s.on = false; }); SNI.set('FadeOut', (s) => { s.on = false; });
  SNI.set('IsPlaying', (s) => !!s.on); SNI.set('ChangeVolume', (s, v) => { s.vol = v; }); SNI.set('ChangePitch', (s, p) => { s.tono = p; }); SNI.set('SetSoundLevel', () => {}); SNI.set('GetVolume', (s) => s.vol); SNI.set('GetPitch', (s) => s.tono); SNI.set('SetDSP', () => {}); SNI.set('GetSoundLevel', () => 75);
  // ---- surface y draw (la HUD en un lienzo encima del juego) ----
  gmaApiDibujo(R, G, def, lib, num);
  // ---- efectos, partículas, daño ----
  const EFM = (GMA.mtEfecto = new LuaTable()), EFI = new LuaTable(); EFM.set('__index', EFI);
  for (const k of ['Origin', 'Start', 'Normal', 'Angles', 'Entity', 'Magnitude', 'Scale', 'Radius', 'Flags', 'Color', 'Attachment', 'SurfaceProp', 'DamageType', 'HitBox', 'MaterialIndex', 'EntIndex']) { EFI.set('Set' + k, (e, v) => { e.d.set(k, v); }); EFI.set('Get' + k, (e) => e.d.get(k) ?? (k === 'Entity' ? NULL_ENT : /Origin|Start|Normal/.test(k) ? GMA.nv(0, 0, 0) : k === 'Angles' ? GMA.na(0, 0, 0) : 0)); }
  const DMM = (GMA.mtDmg = new LuaTable()), DMI = new LuaTable(); DMM.set('__index', DMI);
  Object.entries({ GetDamage: (d) => d.dan, SetDamage: (d, v) => { d.dan = num(v, 0); }, AddDamage: (d, v) => { d.dan += num(v, 0); }, SubtractDamage: (d, v) => { d.dan -= num(v, 0); }, ScaleDamage: (d, k) => { d.dan *= num(k, 1); },
    GetAttacker: (d) => d.at, SetAttacker: (d, e) => { d.at = e; }, GetInflictor: (d) => d.inf, SetInflictor: (d, e) => { d.inf = e; }, GetDamageType: (d) => d.tipo, SetDamageType: (d, t) => { d.tipo = t; }, IsDamageType: (d, t) => !!(d.tipo & t),
    IsExplosionDamage: (d) => !!(d.tipo & 64), IsBulletDamage: (d) => !!(d.tipo & 2), IsFallDamage: (d) => !!(d.tipo & 32), GetDamagePosition: (d) => d.pos || GMA.nv(0, 0, 0), SetDamagePosition: (d, p) => { d.pos = p; }, GetReportedPosition: (d) => d.pos || GMA.nv(0, 0, 0), SetReportedPosition: () => {},
    GetDamageForce: (d) => d.fuerza || GMA.nv(0, 0, 0), SetDamageForce: (d, f) => { d.fuerza = f; }, GetMaxDamage: (d) => d.dan, SetMaxDamage: () => {}, GetAmmoType: () => 1, SetAmmoType: () => {}, GetBaseDamage: (d) => d.dan, SetDamageBonus: () => {}, GetDamageBonus: () => 0, SetDamageCustom: () => {}, GetDamageCustom: () => 0 }).forEach(([k, f]) => DMI.set(k, f));
  const PEM = (GMA.mtEmisor = new LuaTable()), PEI = new LuaTable(); PEM.set('__index', PEI);
  PEI.set('Add', (em, mat, p) => { const q = { mat: String(mat || ''), p: p instanceof LVec ? vG(p) : vG(em.p || new LVec()), v: v3(), vida: 1, t0: 10, t1: 0, a0: 255, a1: 0, c: [255, 255, 255], g: v3(), __mt: GMA.mtPart }; (GMA.partCola || (GMA.partCola = [])).push(q); return q; });
  for (const n of ['Finish', 'SetNearClip', 'SetNoDraw', 'SetPos', 'SetBBox', 'Draw']) PEI.set(n, () => {}); PEI.set('GetNumActiveParticles', () => 0); PEI.set('Is3D', () => false); PEI.set('IsValid', () => true);
  const PTM = (GMA.mtPart = new LuaTable()), PTI = new LuaTable(); PTM.set('__index', PTI);
  Object.entries({ SetVelocity: (q, v) => { q.v = vG(v); }, SetDieTime: (q, t) => { q.vida = num(t, 1); }, SetLifeTime: () => {}, SetStartSize: (q, s) => { q.t0 = num(s, 10); }, SetEndSize: (q, s) => { q.t1 = num(s, 0); }, SetStartAlpha: (q, a) => { q.a0 = num(a, 255); }, SetEndAlpha: (q, a) => { q.a1 = num(a, 0); },
    SetColor: (q, r, g, b) => { q.c = [num(r, 255), num(g, 255), num(b, 255)]; }, SetGravity: (q, v) => { q.g = vG(v); }, GetPos: (q) => GMA.V(q.p), SetPos: (q, p) => { q.p = vG(p); }, GetVelocity: (q) => GMA.V(q.v) }).forEach(([k, f]) => PTI.set(k, f));
  for (const n of ['SetRoll', 'SetRollDelta', 'SetAirResistance', 'SetCollide', 'SetBounce', 'SetLighting', 'SetAngles', 'SetAngleVelocity', 'SetStartLength', 'SetEndLength', 'SetCollideCallback', 'SetThinkFunction', 'SetNextThink', 'SetVelocityScale', 'SetMaterial']) PTI.set(n, () => {});
  const VAC = (GMA.mtVacio = new LuaTable()); VAC.set('__index', (o, k) => (typeof k === 'string' && /^(Get|Is|Has)/.test(k) ? () => 0 : () => o));
  // ---- lo que queda: tablas vacías que responden algo (vgui y derma los arma el prelude) ----
  for (const n of ['render', 'cam', 'mesh', 'killicon', 'resource', 'spawnmenu', 'presets', 'undo', 'cleanup', 'duplicator', 'constraint', 'properties', 'achievements', 'navmesh', 'steamworks', 'search', 'menubar', 'widgets', 'halo', 'frame_blend', 'drive', 'construct', 'numpad', 'matproxy', 'motionsensor', 'controlpanel', 'serverlist', 'video', 'jit', 'ai', 'ai_schedule', 'ai_task', 'system', 'http', 'gui', 'input', 'chat', 'notification', 'gamemode', 'team', 'player_manager', 'physenv', 'language', 'list', 'file', 'sql', 'effects', 'scripted_ents', 'weapons', 'baseclass', 'cookie', 'utf8']) lib(n);
  gmaApiResto(R, G, def, lib, num, tabla);
}

// las variables del motor de Source y de GMod que existen siempre (con su valor de fábrica)
const GMA_CVARS_MOTOR = { sv_gravity: '600', sv_cheats: '0', sv_allowcslua: '0', host_timescale: '1', phys_timescale: '1', skill: '1', developer: '0', deathmatch: '1', coop: '0', maxplayers: '8', hostname: 'JXMod',
  sv_defaultdeployspeed: '4', sv_friction: '8', sv_accelerate: '10', sv_airaccelerate: '10', sv_maxvelocity: '3500', sv_noclipspeed: '5', sv_stepsize: '18', sv_footsteps: '1', mp_falldamage: '0', mp_friendlyfire: '0', mp_flashlight: '1',
  ai_disabled: '0', ai_ignoreplayers: '0', ai_serverragdolls: '0', gmod_physiterations: '4', gmod_maxammo: '9999', gmod_suit: '0', gmod_language: 'en', gmod_toolmode: '', gmod_drawhelp: '1', gmod_drawtooleffects: '1', gmod_mcore_test: '0',
  sbox_godmode: '0', sbox_noclip: '1', sbox_playershurtplayers: '1', sbox_weapons: '1', sbox_bonemanip_npc: '1', sbox_bonemanip_player: '0', sbox_bonemanip_misc: '0', sbox_persist: '', sbox_maxprops: '150', sbox_maxragdolls: '10', sbox_maxvehicles: '4',
  sbox_maxeffects: '200', sbox_maxballoons: '100', sbox_maxcameras: '10', sbox_maxnpcs: '10', sbox_maxsents: '100', sbox_maxdynamite: '10', sbox_maxlamps: '3', sbox_maxlights: '5', sbox_maxwheels: '50', sbox_maxthrusters: '50', sbox_maxhoverballs: '50',
  sbox_maxbuttons: '50', sbox_maxemitters: '20', sbox_maxconstraints: '2000', sbox_maxropeconstraints: '1000', cl_drawhud: '1', cl_interp: '0.1', cl_showfps: '0', fov_desired: '75', viewmodel_fov: '54', sensitivity: '3', volume: '1', cl_playermodel: 'kleiner',
  cl_playercolor: '0.24 0.34 0.41', cl_weaponcolor: '0.30 1.80 2.10', cl_playerskin: '0', cl_playerbodygroups: '0', name: 'Jugador', mat_fullbright: '0', r_drawviewmodel: '1', gmod_mcore: '0', net_graph: '0', cl_new_impact_effects: '0',
  sv_skyname: 'painted', sv_lan: '0', sv_tags: '', sv_password: '', sv_alltalk: '1', sv_timeout: '65', sv_allowupload: '1', sv_allowdownload: '1', sv_downloadurl: '', sv_loadingurl: '', sv_noclipaccelerate: '5', sv_specspeed: '3', sv_rollangle: '0', sv_rollspeed: '200', sv_bounce: '0', sv_wateraccelerate: '10', sv_waterfriction: '1', sv_stopspeed: '10', sv_backspeed: '0.6', sv_maxspeed: '320', sv_kickerrornum: '0', sv_minrate: '3500', sv_maxrate: '0', sv_region: '-1', sv_playerpickupallowed: '1', sv_robust_explosions: '1', sv_hl2mp_weapon_respawn_time: '20', sv_hl2mp_item_respawn_time: '30', gamemode: 'sandbox', mp_timelimit: '0', mp_fraglimit: '0', mp_forcerespawn: '1', mp_teamplay: '0', mp_show_voice_icons: '1', mp_decals: '200', phys_pushscale: '1', phys_impactforcescale: '1', phys_speeded: '1', physgun_maxrange: '4096', physgun_limited: '0', gmod_physgun_maxspeed: '4000', gmod_vehicle_viewmode: '0', gmod_toolmode: '', gmod_admin_cleanup: '1', gmod_npcweapon: '', net_maxfilesize: '64', voice_enable: '1', voice_scale: '1',
  mat_dxlevel: '95', mat_hdr_level: '2', mat_picmip: '0', mat_specular: '1', mat_bumpmap: '1', mat_motion_blur_enabled: '0', mat_monitorgamma: '2.2', r_shadows: '1', r_3dsky: '1', r_decals: '2048', r_drawparticles: '1', r_drawentities: '1', r_drawworld: '1', r_dynamic: '1', r_lod: '-1', r_rootlod: '0', r_waterforceexpensive: '0', r_eyes: '1', r_teeth: '1', r_flex: '1', r_radiosity: '3', r_farz: '-1', cl_cmdrate: '30', cl_updaterate: '30', rate: '30000', cl_righthand: '1', cl_bob: '0.002', cl_bobcycle: '0.8', cl_bobup: '0.5', cl_detaildist: '1200', cl_drawownshadow: '0', cl_ragdoll_collide: '0', cl_forwardspeed: '10000', cl_sidespeed: '10000', cl_backspeed: '10000', cl_yawspeed: '210', cl_pitchspeed: '225', hud_fastswitch: '0', hud_draw: '1', crosshair: '1', hud_quickinfo: '1', m_pitch: '0.022', m_yaw: '0.022', joystick: '0', snd_mute_losefocus: '1', gmod_mcore_test: '0', cl_showhints: '1', closecaption: '0', cc_lang: '', gmod_sneak_attack: '1', sv_infinite_aux_power: '0', hostport: '27015', ip: '127.0.0.1', sv_hibernate_think: '0' };
const gmaCvarMotor = (n) => GMA_CVARS_MOTOR[n] ?? (/^sbox_max/.test(n) ? '100' : undefined);
function gmaCvar(n, d, h) {
  n = String(n); let c = GMA.cvars.get(n); if (!c) { c = { n, v: d === undefined ? '0' : String(d), d: d === undefined ? '0' : String(d), h: h || '', a: GMA.addonActual ? GMA.addonActual.id : (GMA.cvarAddon || null) }; const g = typeof gmbCvarGuardada === 'function' ? gmbCvarGuardada(n) : undefined; if (g !== undefined) c.v = g; GMA.cvars.set(n, c); }
  return { c, __mt: gmaMtCvar() };
}
// la metatabla de los ConVar, la misma que da FindMetaTable("ConVar"): los métodos van en ella (__index = ella), así
// un addon puede tomarlos sueltos —local GetBool = FindMetaTable("ConVar").GetBool, como First-Person Body— o agregar
function gmaMtCvar() {
  if (!GMA.mtCvar) { const M = (GMA.mtCvar = new LuaTable()), I = M; M.set('__index', M); M.set('MetaName', 'ConVar'); const N = (x) => GMA.R.aNum(x.c.v) ?? 0;
    Object.entries({ GetInt: (x) => Math.trunc(N(x)), GetFloat: (x) => N(x), GetBool: (x) => !!N(x) || x.c.v === 'true', GetString: (x) => String(x.c.v), GetDefault: (x) => x.c.d, GetName: (x) => x.c.n, GetHelpText: (x) => x.c.h,
      SetInt: (x, v) => gmaCvarPoner(x.c.n, Math.trunc(v)), SetFloat: (x, v) => gmaCvarPoner(x.c.n, v), SetBool: (x, v) => gmaCvarPoner(x.c.n, v ? 1 : 0), SetString: (x, v) => gmaCvarPoner(x.c.n, v), Revert: (x) => gmaCvarPoner(x.c.n, x.c.d), GetMin: () => undefined, GetMax: () => undefined, IsFlagSet: () => false }).forEach(([k, f]) => I.set(k, f)); }
  return GMA.mtCvar;
}
// correr un evento: cada hook con su lado; el primero que devuelve algo corta (como hook.Call)
// ctx: 'S' (evento del server), 'C' (del cliente) o 'SC' (los dos lados, como Think). Un hook que falla 300 veces seguidas se saca.
function gmaHook(ev, ctx, ...a) {
  const r = gmaHook0(ev, ctx, ...a); const M = GMA.modo; if (r !== E0 || !M || M.cargando) return r;
  for (const c of ctx === 'SC' ? 'SC' : ctx) { const t = M[c], f = t && t.get(ev); if (typeof f !== 'function') continue; const r2 = gmLlamar(f, c, t, ...a); if (r2.length && r2[0] !== undefined) return r2; }
  return E0;
}
// las funciones de un mod, agrupadas por lo que hacen sus hooks: en el panel GMod se prenden y apagan por separado
// (GMA.apagados guarda "id" para todo el mod y "id|grupo" para una función)
const GMA_GRUPOS = {
  pantalla: ['RenderScreenspaceEffects', 'DrawOverlay', 'PostDrawHUD', 'PreDrawHUD', 'HUDPaintBackground', 'GetMotionBlurValues', 'PostRender', 'RenderScene', 'PreDrawEffects', 'PostDrawEffects', 'SetupWorldFog', 'SetupSkyboxFog', 'PreDrawSkyBox', 'PostDraw2DSkyBox'],
  hud: ['HUDPaint', 'HUDShouldDraw', 'HUDDrawTargetID', 'HUDDrawPickupHistory', 'HUDAmmoPickedUp', 'HUDItemPickedUp', 'HUDWeaponPickedUp', 'DrawDeathNotice', 'AddDeathNotice', 'HUDDrawScoreBoard', 'ScoreboardShow', 'ScoreboardHide'],
  camara: ['CalcView', 'CalcViewModelView', 'ShouldDrawLocalPlayer', 'CreateMove', 'InputMouseApply', 'AdjustMouseSensitivity', 'PreDrawViewModel', 'PostDrawViewModel'],
  mov: ['Move', 'SetupMove', 'FinishMove', 'StartCommand', 'PlayerTick', 'PlayerFootstep', 'OnPlayerHitGround', 'PlayerNoClip', 'CalcMainActivity', 'UpdateAnimation', 'TranslateActivity', 'DoAnimationEvent'],
  teclas: ['PlayerBindPress', 'KeyPress', 'KeyRelease', 'PlayerButtonDown', 'PlayerButtonUp', 'OnSpawnMenuOpen', 'OnContextMenuOpen'],
  mundo: ['PostDrawOpaqueRenderables', 'PostDrawTranslucentRenderables', 'PreDrawOpaqueRenderables', 'PreDrawTranslucentRenderables', 'PrePlayerDraw', 'PostPlayerDraw', 'PreDrawHalos', 'DrawPhysgunBeam'],
  dano: ['EntityTakeDamage', 'ScalePlayerDamage', 'ScaleNPCDamage', 'PlayerDeath', 'DoPlayerDeath', 'PlayerHurt', 'OnNPCKilled', 'PlayerDeathThink', 'PlayerShouldTakeDamage', 'GetFallDamage', 'CreateEntityRagdoll', 'PlayerDeathSound'],
  chat: ['OnPlayerChat', 'PlayerSay', 'ChatText', 'StartChat', 'FinishChat', 'PlayerCanSeePlayersChat', 'PlayerCanHearPlayersVoice'],
  aparecer: ['PlayerSpawn', 'PlayerInitialSpawn', 'PlayerLoadout', 'PlayerSetModel', 'PlayerSpawnedProp', 'PlayerSpawnedNPC', 'PlayerSpawnedSENT', 'PlayerSpawnedVehicle', 'PlayerSpawnedRagdoll', 'PlayerSpawnedEffect', 'OnEntityCreated', 'EntityRemoved', 'InitPostEntity', 'Initialize', 'PostGamemodeLoaded'],
  cuadro: ['Think', 'Tick', 'PlayerPostThink'],
  permisos: ['PhysgunPickup', 'PhysgunDrop', 'CanTool', 'CanProperty', 'PlayerUse', 'GravGunPickupAllowed', 'PlayerCanPickupWeapon', 'PlayerCanPickupItem', 'OnPhysgunFreeze', 'OnPhysgunReload', 'PlayerSpawnProp', 'PlayerSpawnObject', 'PlayerSpawnNPC', 'PlayerSpawnSENT', 'PlayerSpawnSWEP', 'PlayerGiveSWEP', 'CanPlayerSuicide', 'CanPlayerEnterVehicle', 'PlayerEnteredVehicle', 'PlayerLeaveVehicle'],
};
const GMA_GRUPO_EV = new Map(); for (const [g, L] of Object.entries(GMA_GRUPOS)) for (const ev of L) GMA_GRUPO_EV.set(ev, g);
const gmaGrupo = (ev) => GMA_GRUPO_EV.get(ev) || 'otros';
// ¿este hook está apagado? (todo su mod, o la función a la que pertenece)
function gmaHookApagado(h, ev) { return !!(h.a && GMA.apagados.size && (GMA.apagados.has(h.a) || GMA.apagados.has(h.a + '|' + gmaGrupo(ev)))); }
function gmaHook0(ev, ctx, ...a) {
  const H = GMA.hooks.get(ev); if (!H || !H.size) return E0;
  for (const [id, h] of [...H]) {
    const obj = typeof id === 'object' && id !== null;
    if (obj && id instanceof LEnt && !entValida(id)) { H.delete(id); continue; }
    if (GMA.apagados.size && gmaHookApagado(h, ev)) continue;
    for (const c of ctx === 'SC' ? 'SC' : ctx) {
      const f = h[c]; if (!f) continue;
      const ha0 = GMA.hookAddon; GMA.hookAddon = h.a || null;
      GMA.ultErr = false; let r; try { r = obj ? gmLlamar(f, c, id, ...a) : gmLlamar(f, c, ...a); } finally { GMA.hookAddon = ha0; }
      if (GMA.ultErr) { if (++h['n' + c] > 300) { delete h[c]; gmaErr('hook ' + ev + ' ' + String(obj ? '(entidad)' : id) + ' sacado: falla siempre'); if (!h.S && !h.C) H.delete(id); } } else h['n' + c] = 0;
      if (r.length && r[0] !== undefined) return r;
    }
  }
  return E0;
}
// include: relativo al archivo que incluye, si no desde lua/
function gmaIncluir(r) {
  r = r.replace(/\\/g, '/').toLowerCase(); const dir = GMA.dir || '';
  const cands = [dir + r, 'lua/' + r, r, (GMA.gmDir || '') + r, 'gamemodes/' + r];
  for (const c of cands) { const b = gmArchivo(c); if (b) return gmaCorrer(c, b); }
  // (lo que algunos addons incluyen de otro addon opcional, como la base de entidades de Wiremod en los aviones WAC: en
  // GMod sin ese addon sólo queda un aviso en la consola y lo demás anda; acá igual, sin contarlo como falla)
  if (/^entities\/base_wire_entity(\/init|\/shared|\/cl_init)?\.lua$|^wire\//.test(r)) return undefined;
  gmaErr("include: no se encontró '" + r + "' (desde " + (dir || 'lua/') + ')');
  return undefined;
}
// correr un archivo .lua (con el preprocesador de GMod: DEFINE_BASECLASS)
function gmaCorrer(ruta, b) {
  const R = GMA.R, src = (typeof b === 'string' ? b : new TextDecoder('utf-8').decode(b)).replace(/^﻿/, '').replace(/DEFINE_BASECLASS\s*\(\s*(["'][^"']*["'])\s*\)/g, 'local BaseClass = baseclass.Get($1)');
  const d0 = GMA.dir; GMA.dir = ruta.replace(/[^/]*$/, '');
  try { const f = luaCompilar(src, ruta, R); const n0 = R.n; R.n = 0; try { return R.c(f, ruta)[0]; } finally { R.n = n0; } }
  catch (e) { gmaErr(R.msgErr(e)); return undefined; }
  finally { GMA.dir = d0; }
}
// materiales (para la HUD): imagen del addon (.png/.jpg/.vtf) en un lienzo
function gmaMaterial(p) {
  if (!GMA.mtMat) { const M = (GMA.mtMat = new LuaTable()), I = new LuaTable(); M.set('__index', I);
    Object.entries({ GetName: (m) => m.n, IsError: (m) => !!m.err, Width: (m) => m.w || 32, Height: (m) => m.h || 32, GetTexture: (m) => m, GetString: () => '', GetInt: () => 0, GetFloat: () => 0, GetVector: () => GMA.nv(1, 1, 1), GetShader: () => 'UnlitGeneric', GetKeyValues: () => new LuaTable(), GetColor: () => GMA.color(255, 255, 255, 255), GetMappingWidth: (m) => m.w || 32, GetMappingHeight: (m) => m.h || 32 }).forEach(([k, f]) => I.set(k, f));
    for (const n of ['SetFloat', 'SetInt', 'SetString', 'SetTexture', 'SetVector', 'SetMatrix', 'SetUndefined', 'Recompute', 'Download']) I.set(n, () => {}); }
  const k = p.toLowerCase().replace(/\\/g, '/'); GMA.mats = GMA.mats || new Map(); if (GMA.mats.has(k)) return GMA.mats.get(k);
  const m = { n: p, ok: false, img: null, w: 0, h: 0, err: false, __mt: GMA.mtMat }; GMA.mats.set(k, m);
  gmaMatCargar(m); return m;
}
// (cargar la imagen de un Material; se vuelve a llamar si sus archivos llegan después, de la biblioteca de GMod/HL2)
function gmaMatCargar(m) {
  const k = String(m.n).toLowerCase().replace(/\\/g, '/');
  const ext = /\.(png|jpg|jpeg)$/.test(k), b = ext ? gmArchivo('materials/' + k) || gmArchivo(k) : null;
  // (IsError como GMod: el material no existe en ningún lado; no "todavía no cargó")
  const kb = k.replace(/^materials\//, '').replace(/\.(vmt|vtf)$/, '');
  m.err = ext ? !b : !(gmArchivo('materials/' + kb + '.vmt') || gmExiste('materials/' + kb + '.vtf') || (typeof gmTexDelJuego === 'function' && gmTexDelJuego(kb) >= 0) || k === '__color');
  if (b) { createImageBitmap(new Blob([b])).then((im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); m.img = c; m.w = im.width; m.h = im.height; m.ok = true; }).catch(() => {}); }
  else {
    // (las texturas de un addon guardado en el navegador: si todavía no se leyeron, se piden y se vuelve a cargar al llegar)
    const vtYa = (r) => { const x = gmVtfYa(r, 256); if (!x && GMPZ.idx.has(r) && !m.pz) { m.pz = 1; gmPzVtf(r, 256).then(() => gmaMatCargar(m)); } return x; };
    let vt = vtYa('materials/' + k.replace(/\.vmt$/, '') + '.vtf');
    if (!vt) { const vm = gmArchivo('materials/' + k.replace(/\.vmt$/, '') + '.vmt'); if (vm) { try { const v = GMF.vmt(vm); if (v && v.base) vt = vtYa('materials/' + v.base + '.vtf'); } catch (e) {} } }
    if (vt) { try { const t = GMF.vtf(vt, 256), px = GMF.vtfRGBA(t), c = document.createElement('canvas'); c.width = t.w; c.height = t.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), t.w, t.h), 0, 0); m.img = c; m.w = t.w; m.h = t.h; m.ok = true; } catch (e) {} }
  }
  return m;
}
// efectos: los del addon (EFFECT de lua/effects) o los del juego con nombre de Source
function gmaEfecto(n, d) {
  const g = (k) => (d && d.d ? d.d.get(k) : undefined), o = g('Origin') instanceof LVec ? vG(g('Origin')) : CAM.pos.clone(), nl = g('Normal') instanceof LVec ? dG(g('Normal')) : v3(0, 1, 0);
  const cls = GMA.efectos.get(n.toLowerCase());
  if (cls) { gmrEfecto(cls, n.toLowerCase(), d); return; }
  const ln = n.toLowerCase();
  // los del motor de Source que piden los addons: trazadoras, fogonazos, vainas, explosiones, chispas, sangre, agua, polvo
  const ent = g('Entity'), mia = ent instanceof LEnt && (ent === GMA.jug || ent === GMA.swep || (ent.tipo === 'arma' && ent.dueño === GMA.jug) || ent.tipo === 'vm');
  if (/tracer/.test(ln)) { const a = mia && typeof vistaPuntaMundo === 'function' && vistaPuntaMundo() || (g('Start') instanceof LVec ? vG(g('Start')) : null); if (a) efectoTraza(a, o); return; }
  if (/muzzle/.test(ln)) { if (mia && typeof efectoFogonazo === 'function') efectoFogonazo(); else particula(o, v3(), 0.06, 0.12, [1, 0.8, 0.4, 1], 'fuego', 0); return; }
  if (/shell|eject/.test(ln)) return;
  if (/explo|megabomb|helicoptermegabomb/.test(ln)) { efectoExplosion(o); sonar('GrenadeExplode', o, 1.2); }
  else if (/spark|tesla|cball|stunstick|manhack|electric|glassimpact|metalspark/.test(ln)) { for (let i = 0; i < 12; i++) particula(o, vadd(vscale(nl, 2 + Math.random() * 3), v3(Math.random() * 4 - 2, Math.random() * 3, Math.random() * 4 - 2)), 0.35 + Math.random() * 0.3, 0.03, [1, 0.8, 0.3, 1], 'chispa'); }
  else if (/blood/.test(ln)) efectoImpacto(o, nl, 'cuerpo');
  else if (/impact/.test(ln)) efectoImpacto(o, nl, 'mundo');
  else if (/splash|water/.test(ln)) { for (let i = 0; i < 10; i++) particula(o, v3(Math.random() * 2 - 1, 2 + Math.random() * 3, Math.random() * 2 - 1), 0.8, 0.06, [0.7, 0.8, 1, 0.8], 'gota'); }
  else if (/smoke|dust|thumper/.test(ln)) { for (let i = 0; i < 6; i++) particula(o, v3(Math.random() - 0.5, 0.6, Math.random() - 0.5), 2, 0.5, [0.6, 0.6, 0.6, 0.5], 'humo'); }
}
// tablas de Lua ↔ JSON
function gmaAJS(t, n = 0) { if (n > 20) return null; if (t instanceof LuaTable) { if (t.h.size === 0) return t.a.map((x) => gmaAJS(x, n + 1)); const o = {}; t.a.forEach((v, i) => { o[i + 1] = gmaAJS(v, n + 1); }); for (const [k, v] of t.h) o[k] = gmaAJS(v, n + 1); return o; } if (t instanceof LVec) return '[' + t.x + ' ' + t.y + ' ' + t.z + ']'; if (t instanceof LAng) return '{' + t.p + ' ' + t.y + ' ' + t.r + '}'; return typeof t === 'function' || (t && typeof t === 'object') ? null : t; }
function gmaALua(o) { if (Array.isArray(o)) return GMA.R.tab(o.map(gmaALua)); if (o && typeof o === 'object') { const t = new LuaTable(); for (const k in o) t.set(/^\d+$/.test(k) ? +k : k, gmaALua(o[k])); return t; } return o === null ? undefined : o; }

// ---------------- surface y draw: la HUD en un lienzo 2D encima del juego ----------------
function gmaApiDibujo(R, G, def, lib, num) {
  const surface = lib('surface'), draw = lib('draw');
  const S = (GMA.dib = { col: [255, 255, 255, 255], tcol: [255, 255, 255, 255], mat: null, fuente: '13px Tahoma, sans-serif', tx: 0, ty: 0 });
  // (el lienzo de la HUD de los addons: encima de la HUD del juego, debajo de los menús y los paneles, como en GMod)
  // (con un render target puesto, lo 2D va a ese target —gmod_rt.js lo vuelca en orden—; si no, a la capa de la HUD)
  const ctx = () => { if (GMA.lienzo) return GMA.lienzo; if (typeof GRT !== 'undefined' && GRT.act && GRT.act.fb && typeof gmrt2D === 'function') return gmrt2D(GRT.act); if (GMA.dibujoHUD) GMA.hudN++; if (!GMA.hud) { const c = document.createElement('canvas'); c.id = 'gmHUD'; c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'; document.body.appendChild(c); GMA.hud = { c, g: c.getContext('2d') }; } return GMA.hud.g; };
  GMA.hudCtx = ctx;
  const rgba = (c) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(c[3] ?? 255) / 255})`;
  const col = (r, g, b, a) => (r instanceof LuaTable ? [r.get('r') ?? 255, r.get('g') ?? 255, r.get('b') ?? 255, r.get('a') ?? 255] : [num(r, 255), num(g, 255), num(b, 255), a === undefined ? 255 : num(a, 255)]);
  // (una fuente como en GMod: «size» es el alto de la celda, que es lo que devuelven GetTextSize y GetFontHeight; el em de
  // CSS sale de las medidas de la fuente —la del addon si la trae, si no las de la de Windows que pide— y la línea de base
  // va donde GMod la pone, así lo alineado arriba o al medio cae igual)
  const hacerFuente = (fam, sz, w, ital) => { const F = typeof gmfFuente === 'function' ? gmfFuente(fam) : { css: null, k: 1, a: 0.8 }, h = Math.max(6, Math.round(sz)), px = +(h * F.k).toFixed(2); const css = `${ital ? 'italic ' : ''}${w >= 600 ? 'bold' : 'normal'} ${px}px "${F.css || fam}", Tahoma, sans-serif`; if (typeof GMFU !== 'undefined') GMFU.met.set(css, { h, b: F.a * h }); return css; };
  const fAlto = (css) => { const m = typeof GMFU !== 'undefined' && GMFU.met.get(css); return m ? m.h : Math.round(parseFloat((String(css || '').match(/([\d.]+)px/) || [0, 13])[1]) || 13); };
  const fBase = (g, css, y) => { const m = typeof GMFU !== 'undefined' && GMFU.met.get(css); if (m) { g.textBaseline = 'alphabetic'; return y + m.b; } g.textBaseline = 'top'; return y; };
  const fuentes = GMA.fuentes; for (const [n, f] of [['DermaDefault', '13px Tahoma'], ['DermaDefaultBold', 'bold 13px Tahoma'], ['DermaLarge', '32px Roboto, Tahoma'], ['Default', '13px Tahoma'], ['Trebuchet18', '18px Trebuchet MS'], ['Trebuchet24', '24px Trebuchet MS'], ['HudHintTextLarge', '16px Verdana'], ['HudHintTextSmall', '11px Verdana'], ['ChatFont', 'bold 17px Verdana'], ['TargetID', 'bold 24px Trebuchet MS'], ['TargetIDSmall', 'bold 18px Trebuchet MS'], ['CloseCaption_Normal', '26px Tahoma'], ['HudNumbers', 'bold 32px Verdana'], ['HUDNumber5', 'bold 45px Trebuchet MS'], ['DebugFixed', '10px Courier New'], ['BudgetLabel', '14px Courier New'], ['CreditsText', '24px Trebuchet MS'], ['GModNotify', 'bold 20px Arial']]) { const m = /^(bold )?(\d+)px ([^,]+)/.exec(f); fuentes.set(n, hacerFuente(m[3], +m[2], m[1] ? 700 : 500, false)); }
  def(surface, 'CreateFont', (n, d) => { if (!(d instanceof LuaTable)) return; const sz = num(d.get('size'), 13), w = num(d.get('weight'), 500); fuentes.set(String(n), hacerFuente(String(d.get('font') || 'Tahoma'), sz, w, R.T(d.get('italic')))); });
  def(surface, 'SetFont', (n) => { S.fuente = fuentes.get(String(n)) || fuentes.get('DermaDefault'); }); def(surface, 'GetTextSize', (t) => { const g = GMA.medir || (GMA.medir = document.createElement('canvas').getContext('2d')); g.font = S.fuente; const m = g.measureText(String(t ?? '')); return [Math.ceil(m.width), fAlto(S.fuente)]; });   // (un tamaño con decimales, como ScreenScale en el celu, se leía mal: 8.18px daba 184375 de alto)
  def(surface, 'SetDrawColor', (...a) => { S.col = col(...a); }); def(surface, 'SetTextColor', (...a) => { S.tcol = col(...a); }); def(surface, 'SetTextPos', (x, y) => { S.tx = num(x, 0); S.ty = num(y, 0); });
  def(surface, 'SetAlphaMultiplier', (a) => { S.alfa = num(a, 1); }); def(surface, 'GetAlphaMultiplier', () => S.alfa ?? 1);
  def(surface, 'DrawText', (t) => { const g = ctx(); g.font = S.fuente; g.fillStyle = rgba(S.tcol); const s = String(t ?? ''), w = g.measureText(s).width, h = fAlto(S.fuente); g.fillText(s, S.tx, fBase(g, S.fuente, bajarIz(S.tx, S.ty, w, h))); S.tx += w; });
  def(surface, 'DrawRect', (x, y, w, h) => { const g = ctx(); g.fillStyle = rgba(S.col); g.fillRect(num(x, 0), num(y, 0), num(w, 0), num(h, 0)); });
  def(surface, 'DrawOutlinedRect', (x, y, w, h, t) => { const g = ctx(); g.strokeStyle = rgba(S.col); g.lineWidth = num(t, 1); g.strokeRect(num(x, 0) + 0.5, num(y, 0) + 0.5, num(w, 0) - 1, num(h, 0) - 1); });
  def(surface, 'DrawLine', (a, b, c, d) => { const g = ctx(); g.strokeStyle = rgba(S.col); g.lineWidth = 1; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  def(surface, 'DrawCircle', (x, y, r, ...c) => { const g = ctx(); g.strokeStyle = rgba(c.length ? col(...c) : S.col); g.beginPath(); g.arc(num(x, 0), num(y, 0), Math.max(0, num(r, 0)), 0, Math.PI * 2); g.stroke(); });
  def(surface, 'DrawPoly', (t) => { if (!(t instanceof LuaTable) || !t.a.length) return; const g = ctx(); g.fillStyle = rgba(S.col); g.beginPath(); t.a.forEach((p, i) => { const x = p.get('x'), y = p.get('y'); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.fill(); });
  def(surface, 'SetMaterial', (m) => { S.mat = m; }); def(surface, 'SetTexture', (m) => { S.mat = typeof m === 'object' ? m : null; }); def(surface, 'GetTextureID', (p) => gmaMaterial(String(p || ''))); def(surface, 'NoTexture', () => { S.mat = null; });
  const tex = (x, y, w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1) => { const g = ctx(); const m = S.mat; if (m && m.img) { g.globalAlpha = (S.col[3] ?? 255) / 255; g.drawImage(m.img, u0 * m.w, v0 * m.h, Math.max(1, (u1 - u0) * m.w), Math.max(1, (v1 - v0) * m.h), x, y, w, h); g.globalAlpha = 1; } else { g.fillStyle = rgba(S.col); g.fillRect(x, y, w, h); } };
  // (DrawMaterialOverlay: el material estirado a toda la pantalla, en la capa de la HUD —antes que HUDPaint—: las
  // "pantallas" de los efectos, como el ruido y las líneas de un VHS)
  def(G, 'DrawMaterialOverlay', (m) => { if (!GMA.dibujoHUD) return; const M = typeof m === 'string' ? (m ? gmaMaterial(m) : null) : m && m.n !== undefined ? m : null; if (!M || !M.img) return; const g = ctx(); g.globalAlpha = 1; g.drawImage(M.img, 0, 0, VW(), VH()); });
  def(surface, 'DrawTexturedRect', (x, y, w, h) => tex(num(x, 0), num(y, 0), num(w, 0), num(h, 0))); def(surface, 'DrawTexturedRectUV', (x, y, w, h, a, b, c, d) => tex(num(x, 0), num(y, 0), num(w, 0), num(h, 0), a, b, c, d));
  def(surface, 'DrawTexturedRectRotated', (x, y, w, h, r) => { const g = ctx(); g.save(); g.translate(num(x, 0), num(y, 0)); g.rotate(-num(r, 0) * RAD); tex(-w / 2, -h / 2, w, h); g.restore(); });
  def(surface, 'PlaySound', (s) => gmaSonar(String(s), null, 1, 100)); def(surface, 'ScreenWidth', () => VW()); def(surface, 'ScreenHeight', () => VH()); def(surface, 'GetHUDTexture', () => null); def(surface, 'DisableClipping', () => {}); def(surface, 'DrawTexturedRectRotatedPoint', () => {});
  const alinear = (x, y, w, h, xa, ya) => [xa === 1 ? x - w / 2 : xa === 2 ? x - w : x, ya === 1 ? y - h / 2 : ya === 4 ? y - h : y];
  // (lo que se escribe debajo de los botones de arriba a la izquierda del juego —el tiempo de Prop Hunt— baja hasta quedar
  // debajo de ellos: si no, se encimaban; sólo al dibujar el HUD)
  // (sólo el HUD común —HUDPaint— y en la pantalla: un efecto que dibuja su OSD para pasarlo por la cinta, como una cámara
  // VHS, tiene que quedar donde lo puso)
  const bajarIz = (px, py, w, h) => { const r = typeof HUD !== 'undefined' && HUD.resIz; if (!r || !GMA.dibujoHUD || !GMA.enHUDPaint || (typeof GRT !== 'undefined' && GRT.act) || px > r.x1 || px + w < r.x0 || py > r.y1 || py + h < r.y0) return py; return r.y1 + 4; };
  const texto = (t, f, x, y, c, xa, ya, borde, cb) => { const g = ctx(), css = fuentes.get(String(f)) || fuentes.get('DermaDefault'); g.font = css; const s = String(t ?? ''), w = g.measureText(s).width, h = fAlto(css); let [px, py] = alinear(num(x, 0), num(y, 0), w, h, xa, ya); py = fBase(g, css, bajarIz(px, py, w, h)); if (borde) { g.strokeStyle = rgba(col(cb)); g.lineWidth = borde * 2; g.strokeText(s, px, py); } g.fillStyle = rgba(c ? col(c) : [255, 255, 255, 255]); g.fillText(s, px, py); return [w, h]; };
  def(draw, 'SimpleText', (t, f, x, y, c, xa, ya) => texto(t, f || 'DermaDefault', x, y, c, xa, ya)); def(draw, 'SimpleTextOutlined', (t, f, x, y, c, xa, ya, b, cb) => texto(t, f || 'DermaDefault', x, y, c, xa, ya, num(b, 1), cb));
  def(draw, 'DrawText', (t, f, x, y, c, xa) => { String(t ?? '').split('\n').forEach((l, i) => texto(l, f || 'DermaDefault', x, num(y, 0) + i * fAlto(fuentes.get(String(f || 'DermaDefault')) || fuentes.get('DermaDefault')), c, xa === 1 ? 1 : xa === 2 ? 2 : 0, 0)); });
  def(draw, 'Text', (t) => { if (!(t instanceof LuaTable)) return; const p = t.get('pos'); texto(t.get('text'), t.get('font') || 'DermaDefault', p ? p.get(1) : 0, p ? p.get(2) : 0, t.get('color'), t.get('xalign'), t.get('yalign')); });
  def(draw, 'TextShadow', (t, d) => G.get('draw').get('Text')(t)); def(draw, 'WordBox', (b, x, y, t, f, cb, ct) => { const g = ctx(); g.font = fuentes.get(String(f)) || fuentes.get('DermaDefault'); const w = g.measureText(String(t)).width; g.fillStyle = rgba(col(cb)); g.fillRect(x, y, w + b * 2, 20 + b); texto(t, f, x + b, y + b / 2, ct, 0, 0); return [w + b * 2, 20 + b]; });
  const caja = (r, x, y, w, h, c, tl = true, tr = true, bl = true, br = true) => { const g = ctx(); g.fillStyle = rgba(col(c)); r = Math.min(num(r, 0), w / 2, h / 2); g.beginPath(); g.moveTo(x + (tl ? r : 0), y); g.lineTo(x + w - (tr ? r : 0), y); if (tr) g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - (br ? r : 0)); if (br) g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + (bl ? r : 0), y + h); if (bl) g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + (tl ? r : 0)); if (tl) g.quadraticCurveTo(x, y, x + r, y); g.fill(); };
  def(draw, 'RoundedBox', (r, x, y, w, h, c) => caja(r, num(x, 0), num(y, 0), num(w, 0), num(h, 0), c)); def(draw, 'RoundedBoxEx', (r, x, y, w, h, c, a, b, d, e) => caja(r, num(x, 0), num(y, 0), num(w, 0), num(h, 0), c, R.T(a), R.T(b), R.T(d), R.T(e)));
  def(draw, 'NoTexture', () => { S.mat = null; }); def(draw, 'GetFontHeight', (f) => fAlto(fuentes.get(String(f)) || fuentes.get('DermaDefault'))); def(draw, 'TexturedQuad', (t) => { if (t instanceof LuaTable) { S.mat = t.get('texture'); tex(t.get('x'), t.get('y'), t.get('w'), t.get('h')); } });
}

// (File: lo que devuelve file.Open; el contenido es una cadena de bytes —como las cadenas de Lua— y los números van en
// little-endian, como en GMod)
function gmaMtArchivo() {
  if (GMA.mtArch) return GMA.mtArch;
  const M = (GMA.mtArch = new LuaTable()); M.set('__index', M); M.set('MetaName', 'File');
  const lee = (f, n) => { const s = f.s.slice(f.p, f.p + Math.max(0, n)); f.p += s.length; return s; };
  const dv = (f, n) => { const s = lee(f, n); if (s.length < n) return null; const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = s.charCodeAt(i) & 255; return new DataView(u.buffer); };
  const pon = (f, s) => { if (!f.w || f.cerrado) return; f.s = f.s.slice(0, f.p) + s + f.s.slice(f.p + s.length); f.p += s.length; f.guardar(); };
  const W = (n, fn) => (f, v) => { const u = new Uint8Array(n); fn(new DataView(u.buffer), Number(v) || 0); pon(f, String.fromCharCode(...u)); };
  const Rd = (n, fn) => (f) => { const d = dv(f, n); return d ? fn(d) : undefined; };
  const F = {
    Read: (f, n) => { if (n === undefined || n === null) n = f.s.length - f.p; const s = lee(f, n | 0); return s.length || (n | 0) === 0 ? s : undefined; },
    ReadLine: (f) => { if (f.p >= f.s.length) return undefined; let i = f.s.indexOf('\n', f.p); if (i < 0) i = f.s.length - 1; const s = f.s.slice(f.p, i + 1); f.p = i + 1; return s; },
    ReadByte: Rd(1, (d) => d.getUint8(0)), ReadBool: Rd(1, (d) => d.getUint8(0) !== 0), ReadShort: Rd(2, (d) => d.getInt16(0, true)), ReadUShort: Rd(2, (d) => d.getUint16(0, true)),
    ReadLong: Rd(4, (d) => d.getInt32(0, true)), ReadULong: Rd(4, (d) => d.getUint32(0, true)), ReadFloat: Rd(4, (d) => d.getFloat32(0, true)), ReadDouble: Rd(8, (d) => d.getFloat64(0, true)),
    ReadUInt64: Rd(8, (d) => String(d.getBigUint64(0, true))), ReadInt64: Rd(8, (d) => String(d.getBigInt64(0, true))),
    Write: (f, s) => pon(f, String(s ?? '')),
    WriteByte: W(1, (d, v) => d.setUint8(0, v & 255)), WriteBool: W(1, (d, v) => d.setUint8(0, v ? 1 : 0)), WriteShort: W(2, (d, v) => d.setInt16(0, v, true)), WriteUShort: W(2, (d, v) => d.setUint16(0, v, true)),
    WriteLong: W(4, (d, v) => d.setInt32(0, v, true)), WriteULong: W(4, (d, v) => d.setUint32(0, v >>> 0, true)), WriteFloat: W(4, (d, v) => d.setFloat32(0, v, true)), WriteDouble: W(8, (d, v) => d.setFloat64(0, v, true)),
    WriteUInt64: (f, v) => { const u = new Uint8Array(8); try { new DataView(u.buffer).setBigUint64(0, BigInt(String(v).split('.')[0] || 0), true); } catch (e) {} pon(f, String.fromCharCode(...u)); },
    Seek: (f, p) => { f.p = Math.max(0, Math.min(f.s.length, Number(p) | 0)); }, Tell: (f) => f.p, Size: (f) => f.s.length, EndOfFile: (f) => f.p >= f.s.length,
    Skip: (f, n) => { f.p = Math.max(0, Math.min(f.s.length, f.p + (Number(n) | 0))); return f.p; },
    Flush: (f) => f.guardar(true), Close: (f) => { if (!f.cerrado) { f.guardar(true); f.cerrado = true; } },
  };
  F.WriteInt64 = F.WriteUInt64;
  for (const [k, fn] of Object.entries(F)) M.set(k, fn);
  M.set('__tostring', () => 'File');
  return M;
}
// ---------------- lo que queda: registros (entidades, armas, efectos), listas, archivos, varios ----------------
function gmaApiResto(R, G, def, lib, num, tabla) {
  const L = (n) => G.get(n);
  if (typeof gmrApi === 'function') gmrApi(R, G, def, lib, num); if (typeof gmvApi === 'function') gmvApi(); if (typeof gmnbApi === 'function') gmnbApi();
  def(L('scripted_ents'), 'Register', (t, n) => gmaRegistrar('ent', String(n), t)); def(L('scripted_ents'), 'Get', (n) => claseTabla(String(n), GMA.ctx)); def(L('scripted_ents'), 'GetStored', (n) => { const c = GMA.clases.get(String(n)); return c ? tabla({ t: c.S || c.C }) : undefined; });
  def(L('scripted_ents'), 'GetList', () => { const t = new LuaTable(); for (const [n, c] of GMA.clases) t.set(n, tabla({ t: c.S || c.C })); return t; }); def(L('scripted_ents'), 'GetType', (n) => { const c = claseTabla(String(n), 'S'); return c && c.get('Type'); }); def(L('scripted_ents'), 'Alias', () => {}); def(L('scripted_ents'), 'GetSpawnable', () => new LuaTable()); def(L('scripted_ents'), 'IsBasedOn', (a, b) => a === b);
  def(L('weapons'), 'Register', (t, n) => gmaRegistrar('arma', String(n), t)); def(L('weapons'), 'Get', (n) => claseTabla(String(n), GMA.ctx)); def(L('weapons'), 'GetStored', (n) => claseTabla(String(n), GMA.ctx)); def(L('weapons'), 'GetList', () => R.tab([...GMA.armas.values()].map((c) => c.S || c.C))); def(L('weapons'), 'IsBasedOn', (a, b) => a === b);
  def(L('effects'), 'Register', (t, n) => { if (t instanceof LuaTable) GMA.efectos.set(String(n).toLowerCase(), t); }); def(L('effects'), 'Create', () => {}); def(L('effects'), 'BeamRingPoint', () => {}); def(L('effects'), 'Bubbles', () => {}); def(L('effects'), 'BubbleTrail', () => {});
  def(L('baseclass'), 'Get', (n) => { n = String(n); for (const v of ['ENT', 'SWEP']) { const t = G.get(v); if (t instanceof LuaTable && GMA.cargandoClase === v) t.set('Base', n); } const c = claseTabla(n, GMA.ctx); if (c) return c; GMA.bases = GMA.bases || new Map(); if (!GMA.bases.has(n)) GMA.bases.set(n, new LuaTable()); return GMA.bases.get(n); }); def(L('baseclass'), 'Set', (n, t) => { (GMA.bases || (GMA.bases = new Map())).set(String(n), t); });
  // archivos: sólo lo de los addons montados (para leer) y una carpeta data/ en el navegador (para escribir)
  const file = L('file'), dataK = (p) => 'gmdata:' + String(p).toLowerCase();
  // (en GMod la ruta "LUA" son las carpetas lua/ y también gamemodes/: Fretta busca así las clases de jugador de Prop Hunt
  // —"prop_hunt/gamemode/player_class/*.lua"—; sin eso no había utilería ni armas de cazador)
  const ruta = (p, w) => { p = String(p).toLowerCase().replace(/\\/g, '/'); return w === 'LUA' || w === 'lsv' || w === 'LCL' ? 'lua/' + p : w === 'DATA' ? 'data/' + p : p; };
  const rutas = (p, w) => { const a = ruta(p, w); return a.startsWith('lua/') ? [a, 'gamemodes/' + a.slice(4)] : [a]; };
  const hayDir = (d) => [...GMOD.arch.keys(), ...GMPZ.idx.keys()].some((k) => k.startsWith(d + '/'));
  const arch1 = (p, w) => { for (const r of rutas(p, w)) { const b = gmArchivo(r); if (b) return b; } return null; };
  def(file, 'Exists', (p, w) => (w === 'DATA' ? localStorage.getItem(dataK(p)) !== null : rutas(p, w).some((r) => gmExiste(r) || hayDir(r))));
  def(file, 'Read', (p, w) => { if (w === 'DATA') return localStorage.getItem(dataK(p)) ?? undefined; const b = arch1(p, w); return b ? new TextDecoder('latin1').decode(b) : undefined; });
  def(file, 'Write', (p, s) => { try { localStorage.setItem(dataK(p), String(s)); } catch (e) {} }); def(file, 'Append', (p, s) => { try { localStorage.setItem(dataK(p), (localStorage.getItem(dataK(p)) || '') + String(s)); } catch (e) {} });
  def(file, 'Delete', (p) => { try { localStorage.removeItem(dataK(p)); } catch (e) {} }); def(file, 'CreateDir', () => {}); def(file, 'IsDir', (p, w) => rutas(p, w).some(hayDir)); def(file, 'Size', (p, w) => { const b = arch1(p, w); return b ? b.length : -1; }); def(file, 'Time', () => 0); def(file, 'Open', (p, modo, w) => {
    // (un archivo abierto como en GMod: se lee de los addons o de data/; se escribe sólo en data/, que guarda el navegador)
    modo = String(modo || 'r'); w = w === undefined ? 'GAME' : String(w); const esc = /[wa]/.test(modo);
    let txt;
    if (w === 'DATA' || esc) { if (esc && w !== 'DATA') return undefined; try { txt = localStorage.getItem(dataK(p)); } catch (e) { txt = null; } }
    else { const b = arch1(p, w); txt = b ? new TextDecoder('latin1').decode(b) : null; }
    if (txt === null && !esc) return undefined;
    const k = dataK(p), f = { s: /w/.test(modo) ? '' : txt || '', p: 0, w: esc, __mt: gmaMtArchivo() };
    if (/a/.test(modo)) f.p = f.s.length;
    let t = 0; f.guardar = (ya) => { if (!f.w) return; clearTimeout(t); const g = () => { try { localStorage.setItem(k, f.s); } catch (e) {} }; if (ya) g(); else t = setTimeout(g, 0); };
    if (/w/.test(modo)) f.guardar(true);
    return f;
  }); def(file, 'Rename', () => false);
  def(file, 'Find', (p, w) => {
    const fs = new Set(), ds = new Set(), K = [...GMOD.arch.keys(), ...GMPZ.idx.keys()];
    for (const pat of rutas(p, w)) {
      const dir = pat.replace(/[^/]*$/, ''), re = new RegExp('^' + pat.slice(dir.length).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      for (const k of K) { if (!k.startsWith(dir)) continue; const resto = k.slice(dir.length), i = resto.indexOf('/'); if (i < 0) { if (re.test(resto)) fs.add(resto); } else { const d = resto.slice(0, i); if (re.test(d)) ds.add(d); } }
    }
    return [R.tab([...fs].sort()), R.tab([...ds].sort())];
  });
  def(L('sql'), 'Query', () => false); def(L('sql'), 'QueryValue', () => undefined); def(L('sql'), 'QueryRow', () => undefined); def(L('sql'), 'TableExists', () => false); def(L('sql'), 'SQLStr', (s) => "'" + String(s).replace(/'/g, "''") + "'"); def(L('sql'), 'LastError', () => ''); def(L('sql'), 'Begin', () => {}); def(L('sql'), 'Commit', () => {});
  def(L('cookie'), 'GetString', (k, d) => localStorage.getItem('gmcookie:' + k) ?? d); def(L('cookie'), 'GetNumber', (k, d) => num(localStorage.getItem('gmcookie:' + k), d)); def(L('cookie'), 'Set', (k, v) => { try { localStorage.setItem('gmcookie:' + k, String(v)); } catch (e) {} }); def(L('cookie'), 'Delete', (k) => { try { localStorage.removeItem('gmcookie:' + k); } catch (e) {} });
  def(L('http'), 'Fetch', (u, ok, mal) => { if (typeof mal === 'function') GMA.tSimples.push({ t: 0, f: mal, ctx: GMA.ctx, args: ['sin http'] }); }); def(L('http'), 'Post', (u, p, ok, mal) => { if (typeof mal === 'function') GMA.tSimples.push({ t: 0, f: mal, ctx: GMA.ctx, args: ['sin http'] }); });
  def(L('system'), 'IsWindows', () => true); def(L('system'), 'IsLinux', () => false); def(L('system'), 'IsOSX', () => false); def(L('system'), 'HasFocus', () => document.hasFocus()); def(L('system'), 'AppTime', () => performance.now() / 1000); def(L('system'), 'GetCountry', () => 'AR'); def(L('system'), 'SteamTime', () => Math.floor(Date.now() / 1000)); def(L('system'), 'IsWindowed', () => true); def(L('system'), 'UpTime', () => performance.now() / 1000);
  def(L('chat'), 'AddText', (...a) => { if (GMA.ctx !== 'C') return; const s = a.filter((x) => typeof x === 'string' || typeof x === 'number' || x instanceof LEnt).map((x) => (x instanceof LEnt ? (x.tipo === 'jug' ? PREFS.nombre : x.clase) : R.tostr(x))).join(''); if (typeof chatMostrar === 'function') chatMostrar('', s, null, 'sis'); }); def(L('chat'), 'PlaySound', () => {}); def(L('chat'), 'Open', () => {}); def(L('chat'), 'Close', () => {}); def(L('chat'), 'GetChatBoxPos', () => [20, VH() - 300]); def(L('chat'), 'GetChatBoxSize', () => [500, 250]);
  def(L('notification'), 'AddLegacy', (t, ty, d) => aviso(String(t), num(d, 3))); def(L('notification'), 'AddProgress', (id, t) => aviso(String(t), 2)); def(L('notification'), 'Kill', () => {});
  def(L('input'), 'LookupBinding', (b) => GMA_TECLA_DE[String(b || '').toLowerCase()] || (/^slot([1-9])$/.exec(String(b || '')) || [])[1]); def(L('input'), 'LookupKeyBinding', () => '');
  def(L('input'), 'IsKeyDown', (k) => gmaTeclaAbajo(k)); def(L('input'), 'IsButtonDown', (k) => gmaTeclaAbajo(k)); def(L('input'), 'WasKeyPressed', (k) => !!(GMA.botNuevos && GMA.botNuevos.includes(+k))); def(L('input'), 'WasMousePressed', (k) => !!(GMA.botNuevos && GMA.botNuevos.includes(+k))); def(L('input'), 'GetKeyName', (k) => (GMA_KEYJS[k] || '').replace(/^Key|^Digit/, '').toLowerCase()); def(L('input'), 'GetKeyCode', (n) => { const c = String(n || '').toUpperCase(); const i = GMA_KEYJS.findIndex((x) => x && x.replace(/^Key|^Digit/, '').toUpperCase() === c); return i > 0 ? i : 0; }); def(L('input'), 'IsMouseDown', (b) => (b === 107 ? !!ENT.disparo : b === 108 ? !!ENT.disparo2 : typeof CTL !== 'undefined' && !!CTL.raton && b === CTL.raton)); def(L('input'), 'LookupBinding', (b) => ({ '+use': 'E', '+reload': 'R', '+attack': 'MOUSE1', '+attack2': 'MOUSE2', '+menu': 'Q', '+jump': 'SPACE' })[b] || undefined);
  def(L('input'), 'IsShiftDown', () => !!(ENT.teclas && ENT.teclas.has('ShiftLeft'))); def(L('input'), 'IsControlDown', () => !!(ENT.teclas && ENT.teclas.has('ControlLeft'))); def(L('input'), 'GetCursorPos', () => [VW() / 2, VH() / 2]); def(L('input'), 'SelectWeapon', () => {});
  def(L('gui'), 'MouseX', () => VW() / 2); def(L('gui'), 'MouseY', () => VH() / 2); def(L('gui'), 'EnableScreenClicker', () => {}); def(L('gui'), 'OpenURL', () => {}); def(L('gui'), 'IsGameUIVisible', () => !!UI.abierto); def(L('gui'), 'IsConsoleVisible', () => false); def(L('gui'), 'ActivateGameUI', () => {}); def(L('gui'), 'HideGameUI', () => {}); def(L('gui'), 'ScreenToVector', () => GMA.Vd(CAM.fwd)); def(L('gui'), 'SetMousePos', () => {});
  def(L('team'), 'GetName', () => 'Unassigned'); def(L('team'), 'GetColor', () => GMA.color(255, 255, 100, 255)); def(L('team'), 'SetUp', () => {}); def(L('team'), 'NumPlayers', () => 1); def(L('team'), 'GetPlayers', () => R.tab([GMA.jug])); def(L('team'), 'Valid', () => true); def(L('team'), 'GetAllTeams', () => new LuaTable()); def(L('team'), 'GetScore', () => 0); def(L('team'), 'SetScore', () => {}); def(L('team'), 'BestAutoJoinTeam', () => 1); def(L('team'), 'Joinable', () => true); def(L('team'), 'TotalFrags', () => 0); def(L('team'), 'SetSpawnPoint', () => {}); def(L('team'), 'SetClass', () => {});
  def(L('player_manager'), 'AddValidModel', (n, m) => { (GMA.pmodels || (GMA.pmodels = new Map())).set(String(n), String(m)); }); def(L('player_manager'), 'AddValidHands', () => {}); def(L('player_manager'), 'TranslatePlayerModel', (n) => (GMA.pmodels && GMA.pmodels.get(n)) || 'models/player/kleiner.mdl'); def(L('player_manager'), 'AllValidModels', () => new LuaTable()); def(L('player_manager'), 'RegisterClass', () => {}); def(L('player_manager'), 'SetPlayerClass', () => {}); def(L('player_manager'), 'RunClass', () => {}); def(L('player_manager'), 'GetPlayerClass', () => 'player_sandbox'); def(L('player_manager'), 'TranslateToPlayerModelName', (m) => m);
  def(L('physenv'), 'GetGravity', () => GMA.nv(0, 0, -600)); def(L('physenv'), 'SetGravity', () => {}); def(L('physenv'), 'GetPerformanceSettings', () => new LuaTable()); def(L('physenv'), 'SetPerformanceSettings', () => {}); def(L('physenv'), 'AddSurfaceData', () => {}); def(L('physenv'), 'GetAirDensity', () => 2); def(L('physenv'), 'SetAirDensity', () => {});
  def(L('gamemode'), 'Call', (ev, ...a) => { const r = gmaHook0(String(ev), GMA.ctx, ...a); if (r.length && r[0] !== undefined) return r; const gm = G.get('GAMEMODE'); const f = gm instanceof LuaTable ? gm.get(ev) : undefined; return typeof f === 'function' ? R.c(f, ev, gm, ...a) : E0; }); def(L('gamemode'), 'Get', () => G.get('GAMEMODE')); def(L('gamemode'), 'Register', () => {});
  def(L('ai'), 'GetScheduleID', () => 0); def(L('ai'), 'GetTaskID', () => 0); def(L('ai_schedule'), 'New', () => ({ __mt: GMA.mtVacio })); def(L('ai_task'), 'New', () => ({ __mt: GMA.mtVacio }));
  def(L('jit'), 'on', () => {}); def(L('jit'), 'off', () => {}); def(L('jit'), 'flush', () => {}); L('jit').set('version', 'LuaJIT 2.1'); L('jit').set('arch', 'x64'); L('jit').set('os', 'Windows');
  // render y cam: no hay dibujo 3D a mano (el juego dibuja los modelos solo); se responden sin hacer nada
  // (lo que pregunta Is/Has/Can/Should devuelve false: antes daba 0, que en Lua es verdadero, y un addon creía que sí)
  const VAC = (o) => { const t = new LuaTable(); const m = new LuaTable(); m.set('__index', (x, k) => (typeof k !== 'string' ? undefined : /^(Is|Has|Can|Should|Supports)[A-Z]/.test(k) ? () => false : /^Get/.test(k) ? () => 0 : () => {})); t.mt = m; return t; };
  for (const n of ['render', 'cam', 'mesh', 'killicon', 'resource', 'spawnmenu', 'presets', 'undo', 'cleanup', 'duplicator', 'constraint', 'properties', 'achievements', 'navmesh', 'steamworks', 'search', 'menubar', 'widgets', 'halo', 'frame_blend', 'drive', 'construct', 'numpad', 'matproxy', 'motionsensor', 'controlpanel', 'serverlist', 'video']) { const t = L(n); const v = VAC(); t.mt = v.mt; }
  def(L('render'), 'GetScreenEffectTexture', () => gmaMaterial('rt')); def(L('render'), 'GetRenderTarget', () => gmaMaterial('rt')); def(L('render'), 'GetLightColor', () => GMA.nv(1, 1, 1)); def(L('render'), 'GetAmbientLightColor', () => GMA.nv(0.5, 0.5, 0.5)); def(L('render'), 'GetDXLevel', () => 95); def(L('render'), 'SupportsHDR', () => true); def(L('render'), 'GetViewSetup', () => tabla({ origin: GMA.V(CAM.pos), angles: GMA.A(dirAng(dS(CAM.fwd))), fov: CAM.fov || 75 }));
  def(L('undo'), 'Create', () => {}); def(L('constraint'), 'Weld', (a, b) => gmaSoldar(a, b)); def(L('constraint'), 'NoCollide', () => [NULL_ENT]); def(L('constraint'), 'Axis', (a, b) => gmaSoldar(a, b)); def(L('constraint'), 'Rope', () => [NULL_ENT]); def(L('constraint'), 'Find', () => undefined); def(L('constraint'), 'FindConstraints', () => new LuaTable()); def(L('constraint'), 'RemoveAll', (e) => gmaDesoldar(e)); def(L('constraint'), 'GetAllConstrainedEntities', (e) => { const t = new LuaTable(); if (e instanceof LEnt) { t.set(e, e); if (e.soldadoA) t.set(e.soldadoA, e.soldadoA); if (GMA.hijos) for (const h of GMA.hijos) if (h.soldadoA === e) t.set(h, h); } return t; });
  def(L('duplicator'), 'CopyEntTable', () => new LuaTable()); def(L('duplicator'), 'GenericDuplicatorFunction', () => NULL_ENT);
  // ---- lo que faltaba y devolvía algo que el addon usa (api_falta.mjs) ----
  // (un panel que acepta cualquier cosa: lo que pregunta da false o 0, lo demás se devuelve a sí mismo para encadenar)
  const panelLibre = () => { const t = new LuaTable(), m = new LuaTable(); m.set('__index', (x, k) => (typeof k !== 'string' ? undefined : /^(Is|Has|Can|Should)[A-Z]/.test(k) ? () => false : /^Get/.test(k) ? () => 0 : () => t)); t.mt = m; return t; };
  def(L('controlpanel'), 'Get', () => panelLibre()); def(L('spawnmenu'), 'GetTools', () => new LuaTable()); def(L('spawnmenu'), 'GetToolMenu', () => panelLibre());
  def(L('constraint'), 'GetTable', () => new LuaTable()); def(L('constraint'), 'HasConstraints', () => false); def(L('constraint'), 'RemoveConstraints', () => false);
  def(L('util'), 'IsValidPhysicsObject', (e) => e instanceof LEnt && entValida(e) && (e === GMA.jug || !!e.o));
  def(L('gui'), 'MousePos', () => [VW() / 2, VH() / 2]);
  def(L('engine'), 'IsMounted', (n) => ['hl2', 'cstrike', 'garrysmod'].includes(String(n).toLowerCase()));
  def(L('player_manager'), 'TranslatePlayerHands', () => tabla({ model: 'models/weapons/c_arms_citizen.mdl', skin: 0, body: '0000000' }));
  def(L('team'), 'AddScore', () => {}); def(L('team'), 'GetClass', () => new LuaTable()); def(L('team'), 'Valid', (t) => num(t, 0) >= 0);
  if (G.get('gameevent') === undefined) G.set('gameevent', new LuaTable()); def(L('gameevent'), 'Listen', () => {});
  // (el filtro de a quién le llega un sonido o un mensaje: acá siempre es el jugador)
  def(G, 'RecipientFilter', () => { const t = new LuaTable(), M = new LuaTable(), I = new LuaTable(), lista = [GMA.jug];
    for (const n of ['AddAllPlayers', 'AddPlayer', 'AddPVS', 'AddPAS', 'RemovePlayer', 'RemoveAllPlayers', 'RemovePVS', 'RemovePAS', 'AddRecipientsByTeam', 'RemoveRecipientsByTeam', 'RemoveRecipientsNotOnTeam', 'AddPlayers', 'RemovePlayers', 'RemoveMismatchedPlayers']) I.set(n, () => {});
    I.set('GetPlayers', () => { const r = new LuaTable(); lista.forEach((p, i) => r.set(i + 1, p)); return r; }); I.set('GetCount', () => lista.length);
    M.set('__index', I); M.set('MetaName', 'CRecipientFilter'); t.mt = M; return t; });
  def(G, 'SetClipboardText', (x) => { try { navigator.clipboard && navigator.clipboard.writeText(R.tostr(x)).catch(() => {}); } catch (e) {} });
  def(G, 'RenderAngles', () => (G.get('EyeAngles') || (() => undefined))());
  def(G, 'SinglePlayer', () => !(typeof RED !== 'undefined' && RED.on)); def(G, 'GetWorldEntity', () => GMA.mundo);
  // (los render targets y las pasadas de pantalla, al final: reemplazan lo de mentira de arriba —GetScreenEffectTexture...—)
  if (typeof gmrtApi === 'function') gmrtApi(R, G, def, lib, num);
}
// registrar una clase (de ents/weapons.Register o de las carpetas lua/entities, lua/weapons)
function gmaRegistrar(tipo, nombre, t) {
  if (!(t instanceof LuaTable) || !nombre) return;
  const ph = GMA.bases && GMA.bases.get(nombre); if (ph && ph !== t) { for (const k of t.claves()) if (ph.get(k) === undefined) ph.set(k, t.get(k)); if (!ph.mt && t.mt) ph.mt = t.mt; }
  const M = tipo === 'arma' ? GMA.armas : GMA.clases; let c = M.get(nombre); if (!c) M.set(nombre, (c = { S: null, C: null, addon: GMA.addonActual || null }));
  t.set('ClassName', nombre); t.set('ThisClass', nombre); c[GMA.ctx] = t;
  gmaEnlazarBase(t, tipo);
}
function gmaEnlazarBase(t, tipo) {
  const b = t.get('Base') || (tipo === 'arma' ? 'weapon_base' : 'base_anim');
  // (sin ciclos: si la base, siguiendo sus BaseClass, vuelve a esta clase, no se enlaza; en GMod eso tampoco anda)
  const enCadena = (a, z) => { for (let n = 0; a && n < 40; n++) { if (a === z) return true; const x = a.get('BaseClass'); a = x instanceof LuaTable ? x : null; } return false; };
  if (b && b !== t.get('ClassName')) { const bt = claseTabla(String(b), GMA.ctx) || (GMA.bases && GMA.bases.get(String(b))); if (bt && bt !== t && !enCadena(bt, t)) t.set('BaseClass', bt); }
  // (como scripted_ents.Get de GMod, que copia a la clase lo que le falta de su base: tabla.Initialize anda aunque esté
  // definida en la base; acá con una metatabla que busca en BaseClass, así un cambio en la base se ve en las hijas)
  if (!t.mt) { const m = new LuaTable(); m.set('__index', (x, k) => { if (k === 'BaseClass' || GMA.profBase > 40) return undefined; const bc = x.get('BaseClass'); if (!(bc instanceof LuaTable) || bc === x) return undefined; GMA.profBase = (GMA.profBase || 0) + 1; try { return GMA.R.ix(bc, k); } finally { GMA.profBase--; } }); t.mt = m; }
  // (y las subtablas que tienen las dos, como SWEP.Primary: lo que no pone la hija sale de la base, como TableInherit)
  const bc = t.get('BaseClass'), llega = (a, z) => { for (let n = 0; a && n < 40; n++) { if (a === z) return true; const m = a.mt, i = m && m.get('__index'); a = i instanceof LuaTable ? i : null; } return false; };
  if (bc instanceof LuaTable) for (const k of t.claves()) {
    if (k === 'BaseClass' || typeof k !== 'string') continue; const sub = t.get(k), sb = GMA.R.ix(bc, k);
    if (sub instanceof LuaTable && sb instanceof LuaTable && sub !== sb && !sub.mt && !llega(sb, sub)) { const m = new LuaTable(); m.set('__index', sb); sub.mt = m; }
  }
}
