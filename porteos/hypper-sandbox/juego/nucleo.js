// =========================================================================================================
// Hypper Sandbox (porteo a HTML): motor propio en WebGL2, liviano para teléfonos flojos.
// Los modelos, texturas, sonidos y la lista de cosas salen del APK; el código es nuestro.
// =========================================================================================================
const Q = new URLSearchParams(location.search);
const TEST = Q.has('test');
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const DBG = {};                    // (llaves para medir: apagar partes del dibujo desde las pruebas)
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const now = () => performance.now() / 1000;
const TAU = Math.PI * 2;
const COARSE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------------------------------------------------------------------------------------------------------
// vectores y cuaterniones (objetos chicos; las funciones "...To" escriben en out para no crear basura)
// ---------------------------------------------------------------------------------------------------------
// Math.hypot es lento y en V8 pide memoria en cada llamada (era lo que más basura hacía por cuadro): esta, de 2 a 4
const hypot = (a, b, c, d) => Math.sqrt(a * a + b * b + (c === undefined ? 0 : c * c) + (d === undefined ? 0 : d * d));
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addS(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  len() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  lenSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  norm() { const l = this.len(); if (l > 1e-12) { this.x /= l; this.y /= l; this.z /= l; } return this; }
  crossTo(v, out) { const x = this.y * v.z - this.z * v.y, y = this.z * v.x - this.x * v.z, z = this.x * v.y - this.y * v.x; return out.set(x, y, z); }
  cross(v) { return this.crossTo(v, new V3()); }
  distTo(v) { return hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerpTo(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
}
const v3 = (x, y, z) => new V3(x, y, z);
const vsub = (a, b) => new V3(a.x - b.x, a.y - b.y, a.z - b.z);
const vadd = (a, b) => new V3(a.x + b.x, a.y + b.y, a.z + b.z);
const vscale = (a, s) => new V3(a.x * s, a.y * s, a.z * s);
const vcross = (a, b) => new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone() { return new Quat(this.x, this.y, this.z, this.w); }
  norm() { const l = hypot(this.x, this.y, this.z, this.w) || 1; this.x /= l; this.y /= l; this.z /= l; this.w /= l; return this; }
  // this = a * b
  mulTo(a, b) {
    const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
    const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    return this.set(x, y, z, w);
  }
  mul(b) { return this.mulTo(this, b); }
  premul(a) { return this.mulTo(a, this); }
  conj() { return new Quat(-this.x, -this.y, -this.z, this.w); }
  // rota v (en out)
  rotTo(v, out) {
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w, vx = v.x, vy = v.y, vz = v.z;
    const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
    return out.set(vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx);
  }
  rot(v) { return this.rotTo(v, new V3()); }
  invRotTo(v, out) { this.x = -this.x; this.y = -this.y; this.z = -this.z; this.rotTo(v, out); this.x = -this.x; this.y = -this.y; this.z = -this.z; return out; }
  static axis(ax, ay, az, ang) { const s = Math.sin(ang / 2), l = hypot(ax, ay, az) || 1; return new Quat(ax / l * s, ay / l * s, az / l * s, Math.cos(ang / 2)); }
  // giro de cámara/personaje: yaw alrededor de Y, después pitch alrededor de X local, después roll
  static euler(yaw, pitch, roll) {
    const q = Quat.axis(0, 1, 0, yaw);
    if (pitch) q.mul(Quat.axis(1, 0, 0, pitch));
    if (roll) q.mul(Quat.axis(0, 0, 1, roll));
    return q;
  }
  slerpTo(b, t) {
    let bx = b.x, by = b.y, bz = b.z, bw = b.w, c = this.x * bx + this.y * by + this.z * bz + this.w * bw;
    if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let k0, k1;
    if (c > 0.9995) { k0 = 1 - t; k1 = t; }
    else { const o = Math.acos(c), s = Math.sin(o); k0 = Math.sin((1 - t) * o) / s; k1 = Math.sin(t * o) / s; }
    return this.set(this.x * k0 + bx * k1, this.y * k0 + by * k1, this.z * k0 + bz * k1, this.w * k0 + bw * k1).norm();
  }
  // integra una velocidad angular w (mundo) durante dt
  integrate(w, dt) {
    const h = dt * 0.5, x = w.x * h, y = w.y * h, z = w.z * h;
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    this.x += x * qw + y * qz - z * qy; this.y += y * qw + z * qx - x * qz; this.z += z * qw + x * qy - y * qx; this.w += -x * qx - y * qy - z * qz;
    return this.norm();
  }
}

// ---------------------------------------------------------------------------------------------------------
// matrices 4x4 (columnas, como WebGL)
// ---------------------------------------------------------------------------------------------------------
const M4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, out) {
    out = out || new Float32Array(16);
    const t = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; t[i * 4 + j] = s; }
    out.set(t); return out;
  },
  persp(fovy, asp, n, f) {
    const m = new Float32Array(16), t = 1 / Math.tan(fovy / 2);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = new Float32Array(16);
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m;
  },
  // vista desde una posición y una orientación (la cámara mira hacia -Z local)
  view(pos, q) {
    const ic = q.conj(), m = new Float32Array(16);
    const xa = ic.rot(v3(1, 0, 0)), ya = ic.rot(v3(0, 1, 0)), za = ic.rot(v3(0, 0, 1));
    m[0] = xa.x; m[1] = xa.y; m[2] = xa.z; m[4] = ya.x; m[5] = ya.y; m[6] = ya.z; m[8] = za.x; m[9] = za.y; m[10] = za.z; m[15] = 1;
    const t = ic.rot(pos); m[12] = -t.x; m[13] = -t.y; m[14] = -t.z;
    return m;
  },
  lookAt(eye, at, up) {
    const z = vsub(eye, at).norm(), x = vcross(up, z).norm(), y = vcross(z, x), m = new Float32Array(16);
    m[0] = x.x; m[4] = x.y; m[8] = x.z; m[1] = y.x; m[5] = y.y; m[9] = y.z; m[2] = z.x; m[6] = z.y; m[10] = z.z;
    m[12] = -vdot(x, eye); m[13] = -vdot(y, eye); m[14] = -vdot(z, eye); m[15] = 1; return m;
  },
  // posición + rotación + escala (para objetos)
  trs(p, q, sx, sy, sz, out) {
    const m = out || new Float32Array(16), x = q.x, y = q.y, z = q.z, w = q.w;
    sy = sy === undefined ? sx : sy; sz = sz === undefined ? sx : sz;
    m[0] = (1 - 2 * (y * y + z * z)) * sx; m[1] = 2 * (x * y + z * w) * sx; m[2] = 2 * (x * z - y * w) * sx; m[3] = 0;
    m[4] = 2 * (x * y - z * w) * sy; m[5] = (1 - 2 * (x * x + z * z)) * sy; m[6] = 2 * (y * z + x * w) * sy; m[7] = 0;
    m[8] = 2 * (x * z + y * w) * sz; m[9] = 2 * (y * z - x * w) * sz; m[10] = (1 - 2 * (x * x + y * y)) * sz; m[11] = 0;
    m[12] = p.x; m[13] = p.y; m[14] = p.z; m[15] = 1; return m;
  },
  inv(m) {
    const o = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return o; d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return o;
  },
};
// los 6 planos de un frustum (para no dibujar lo que no se ve)
function frustum(VP) {
  const p = [], m = VP;
  const add = (a, b, c, d) => { const l = hypot(a, b, c); p.push([a / l, b / l, c / l, d / l]); };
  add(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]); add(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
  add(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]); add(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
  add(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]); add(m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  return p;
}
const sphereIn = (F, x, y, z, r) => { for (let i = 0; i < F.length; i++) { const p = F[i]; if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false; } return true; };

// números al azar con semilla (el mapa sale igual siempre)
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash2(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
// ruido suave 2D (para el terreno y las texturas)
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < (oct || 5); i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
