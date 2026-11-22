// ---------------------------------------------------------------------------------------------------------
// modelos: un árbol de nodos sacado del juego (prefab o escena) con sus mallas, materiales y huesos.
// Cada nodo tiene su posición/rotación/escala local; las matrices del mundo se recalculan cuando algo se mueve.
// ---------------------------------------------------------------------------------------------------------
// el color del contorno de lo que se apunta con las armas de construir (celeste; ámbar con las de JXMod: herramientas.js)
const RES_CELESTE = [0.25, 0.75, 2.4], RES_AMBAR = [2.4, 1.45, 0.22];
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
    // (nf: cuántos números de la paleta usa la malla —3 vec4 por hueso—; es lo que se manda a la placa)
    for (let i = 0; i < n; i++) if (arbol[i].bo && this.ver[i]) { const h = new Float32Array(168 * 4); h.nf = Math.max(4, Math.min(56, arbol[i].bo.length) * 12); this.pieles.push({ i, h }); }
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
    // (el tinte de la entidad, un color por objeto —en el shader, uTi: el brillo de la textura pintado de ese color—; el
    // barril violeta de la grieta en el menú, deposito.js)
    // (con dos tonos —[cuerpo, acentos, brillo]: las armas de JXMod en la mano del personaje, armasjx.js— igual que en la vista)
    if (this.tinte) { const T = Array.isArray(this.tinte[0]) ? { ti: this.tinte[0], ti2: this.tinte[1], ti3: this.tinte[2] } : { ti: this.tinte }; extra = extra ? Object.assign({}, extra, T) : T; }
    // resaltado de lo que se apunta: fijo, entra y sale suave y aguanta un momento (sin titilar si el rayo falla un cuadro)
    if (this.resaltar !== undefined) {
      if (this.resT !== TIEMPO.t) { // una vez por cuadro (el modelo se dibuja también para las sombras)
        this.resT = TIEMPO.t; const meta = TIEMPO.t - this.resaltar < 0.3 ? 1 : 0, k = (this.resK || 0) + (meta - (this.resK || 0)) * Math.min(1, (TIEMPO.dt || 0.016) * 12);
        this.resK = k < 0.01 && !meta ? 0 : k;
      }
      if (this.resK > 0) { const e = this.resK, c = this.resaltarC || RES_CELESTE; extra = Object.assign({}, extra || {}, { rim: [c[0] * e, c[1] * e, c[2] * e] }); }
    }
    // (halo.Add de un mod de GMod: un brillo de su color en el borde mientras lo pida —gmod_anim.js—)
    if (this.haloC && TIEMPO.t - (this.haloT || -9) < 0.2 && !(extra && extra.rim)) { const c = this.haloC; extra = Object.assign({}, extra || {}, { rim: [c[0] * 2.2 + 0.1, c[1] * 2.2 + 0.1, c[2] * 2.2 + 0.1] }); }
    // lejos: la versión simplificada de las mallas con piel (lods, de herramientas/lod_skins.py: mismos huesos) y, si
    // se pidió, sin sombra
    const A = this.A, lb = this.lodBajo; R.encNs = !!this.sinSombra;
    // (un tinte por material de la malla —el arma de un color y las manos de otro—: las armas de JXMod, armasjx.js)
    // (se arma una vez y se reusa mientras no cambien los tintes ni lo demás: sin objetos nuevos en cada cuadro)
    const tm = this.tintes; if (tm && (this._exT !== tm || this._exE !== extra)) { this._exT = tm; this._exE = extra; this._ex = tm.map((c) => (c ? Object.assign({}, extra || {}, Array.isArray(c[0]) ? { ti: c[0], ti2: c[1], ti3: c[2] } : { ti: c }) : extra)); }
    const ex = tm ? this._ex : null, E = (k) => (ex && k < ex.length ? ex[k] : extra);
    for (let i = 0; i < A.length; i++) {
      if (!this.ver[i]) continue;
      const x = A[i];
      const xm = this.mCambio && this.mCambio[i] !== undefined ? this.mCambio[i] : x.m;   // (otra malla para ese nodo: la misma sin algunas piezas, armasjx.js)
      if (x.bo) { const pz = this.pieles.find((q) => q.i === i), lo = lb && xm === x.m && DATA.ms[x.m].lods; for (let k = 0; k < x.mt.length; k++) encolar(lo ? lo[0] : xm, k, x.mt[k], IDM, pz.h, E(k)); continue; }
      if (x.sb) { for (let k = 0; k < x.mt.length; k++) encolar(xm, x.sb[0] + k, x.mt[k], IDM, null, E(k)); continue; }
      for (let k = 0; k < x.mt.length; k++) encolar(xm, k, x.mt[k], this.W[i], null, E(k));
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
