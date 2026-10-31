// ---------------------------------------------------------------------------------------------------------
// modelos: un árbol de nodos sacado del juego (prefab o escena) con sus mallas, materiales y huesos.
// Cada nodo tiene su posición/rotación/escala local; las matrices del mundo se recalculan cuando algo se mueve.
// ---------------------------------------------------------------------------------------------------------
class Modelo {
  constructor(arbol, opt) {
    opt = opt || {};
    this.A = arbol; const n = arbol.length;
    this.p = arbol.map((x) => x.p.slice()); this.r = arbol.map((x) => x.r.slice()); this.s = arbol.map((x) => x.s.slice());
    this.L = arbol.map(() => new Float32Array(16)); this.W = arbol.map(() => new Float32Array(16));
    this.act = new Uint8Array(n); this.ver = new Uint8Array(n);
    this.raiz = new Float32Array(16); M4.id().forEach((v, i) => (this.raiz[i] = v));
    this.color = null; this.oculto = false; this.sucio = true;
    for (let i = 0; i < n; i++) { const x = arbol[i]; this.act[i] = !x.off && (x.pa < 0 || this.act[x.pa]) ? 1 : 0; }
    // niveles de detalle: sólo uno visible por grupo (el que pide la calidad)
    const porRid = {};
    for (let i = 0; i < n; i++) if (arbol[i].rid) porRid[arbol[i].rid] = i;
    this.ocultoLod = new Uint8Array(n);
    for (const x of arbol) if (x.lod) {
      const nv = x.lod.length, elegido = Math.min(nv - 1, GFX.lod || 0);
      x.lod.forEach((l, k) => { if (k !== elegido) for (const rid of l[1]) if (porRid[rid] !== undefined) this.ocultoLod[porRid[rid]] = 1; });
    }
    for (let i = 0; i < n; i++) { const x = arbol[i]; this.ver[i] = this.act[i] && x.m !== undefined && x.m >= 0 && x.mt && !x.mroff && !this.ocultoLod[i] ? 1 : 0; }
    // huesos de las mallas con piel
    this.pieles = [];
    for (let i = 0; i < n; i++) if (arbol[i].bo && this.ver[i]) this.pieles.push({ i, h: new Float32Array(168 * 4) });
    this.ignorarRaizLocal = !!opt.ignorarRaizLocal;
    this.nombre = opt.nombre || arbol[0].n;
  }
  buscar(nombre) { return this.A.findIndex((x) => x.n === nombre); }
  hijos(i) { const o = []; for (let k = 0; k < this.A.length; k++) if (this.A[k].pa === i) o.push(k); return o; }
  // ubica la raíz con una matriz del mundo
  ponerRaiz(M) { this.raiz.set(M); this.sucio = true; }
  ponerRaizPQ(pos, q, esc) {
    const s = esc || this.s[0];
    m4trs([pos.x, pos.y, pos.z], [q.x, q.y, q.z, q.w], s, this.raiz); this.sucio = true;
  }
  actualizar() {
    if (!this.sucio) return; this.sucio = false;
    const A = this.A, n = A.length;
    for (let i = 0; i < n; i++) {
      if (!this.act[i]) continue;
      if (this.fijo && this.fijo[i]) { this.W[i].set(this.fijo[i]); continue; }
      if (i === 0) {
        if (this.ignorarRaizLocal) this.W[0].set(this.raiz);
        else { m4trs(this.p[0], this.r[0], this.s[0], this.L[0]); m4mul(this.raiz, this.L[0], this.W[0]); }
        continue;
      }
      m4trs(this.p[i], this.r[i], this.s[i], this.L[i]);
      if (this.E && this.E[i]) m4mul(this.L[i], this.E[i], this.L[i]);
      m4mul(this.W[A[i].pa], this.L[i], this.W[i]);
    }
    // matrices de piel: mundo del hueso * pose de enlace, en filas (3 x vec4 por hueso)
    for (const pz of this.pieles) {
      const x = A[pz.i], md = DATA.ms[x.m], bp = md.bp, H = pz.h;
      for (let b = 0; b < x.bo.length && b < 56; b++) {
        const bi = x.bo[b], W = bi >= 0 ? this.W[bi] : this.W[pz.i];
        const B = bp[b]; // fila mayor (Unity e00 e01 ... ) → columna mayor para multiplicar
        // M = W * B (B en filas: B[r*4+c])
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
          H[b * 12 + r * 4 + c] = W[r] * B[c] + W[4 + r] * B[4 + c] + W[8 + r] * B[8 + c] + W[12 + r] * B[12 + c];
        }
      }
    }
  }
  encolar() {
    if (this.oculto) return;
    this.actualizar();
    let extra = this.color ? { c: this.color } : this.extra || null;
    // resaltado de lo que se apunta: fijo, entra y sale suave y aguanta un momento (sin titilar si el rayo falla un cuadro)
    if (this.resaltar !== undefined) {
      if (this.resT !== TIEMPO.t) { // una vez por cuadro (el modelo se dibuja también para las sombras)
        this.resT = TIEMPO.t; const meta = TIEMPO.t - this.resaltar < 0.3 ? 1 : 0, k = (this.resK || 0) + (meta - (this.resK || 0)) * Math.min(1, (TIEMPO.dt || 0.016) * 12);
        this.resK = k < 0.01 && !meta ? 0 : k;
      }
      if (this.resK > 0) { const e = 0.26 * this.resK; extra = Object.assign({}, extra || {}, { em: [0.5 * e, 1.1 * e, 1.8 * e] }); }
    }
    // lejos: la versión simplificada de las mallas con piel (lods, de herramientas/lod_skins.py: mismos huesos) y, si
    // se pidió, sin sombra
    const A = this.A, lb = this.lodBajo; R.encNs = !!this.sinSombra;
    for (let i = 0; i < A.length; i++) {
      if (!this.ver[i]) continue;
      const x = A[i];
      if (x.bo) { const pz = this.pieles.find((q) => q.i === i), lo = lb && DATA.ms[x.m].lods; for (let k = 0; k < x.mt.length; k++) encolar(lo ? lo[0] : x.m, k, x.mt[k], IDM, pz.h, extra); continue; }
      if (x.sb) { for (let k = 0; k < x.mt.length; k++) encolar(x.m, x.sb[0] + k, x.mt[k], IDM, null, extra); continue; }
      for (let k = 0; k < x.mt.length; k++) encolar(x.m, k, x.mt[k], this.W[i], null, extra);
    }
    R.encNs = false;
  }
}
// cuaternión de un nodo en el mundo (sacado de su matriz)
function m4quat(m, out) {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const a = m[0] / sx, b = m[1] / sx, c = m[2] / sx, d = m[4] / sy, e = m[5] / sy, f = m[6] / sy, g = m[8] / sz, h = m[9] / sz, k = m[10] / sz;
  const t = a + e + k; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = 0.25 * s; x = (f - h) / s; y = (g - c) / s; z = (b - d) / s; }
  else if (a > e && a > k) { const s = Math.sqrt(1 + a - e - k) * 2; w = (f - h) / s; x = 0.25 * s; y = (d + b) / s; z = (g + c) / s; }
  else if (e > k) { const s = Math.sqrt(1 + e - a - k) * 2; w = (g - c) / s; x = (d + b) / s; y = 0.25 * s; z = (h + f) / s; }
  else { const s = Math.sqrt(1 + k - a - e) * 2; w = (b - d) / s; x = (g + c) / s; y = (h + f) / s; z = 0.25 * s; }
  return (out || new Quat()).set(x, y, z, w).norm();
}
