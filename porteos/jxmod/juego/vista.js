// ---------------------------------------------------------------------------------------------------------
// el arma en la mano (primera persona): el sub-árbol de cada arma dentro del jugador del juego, con sus
// brazos y animaciones (fuego, recarga, sacar). Las pistas se buscan por el CRC32 del camino del hueso.
// ---------------------------------------------------------------------------------------------------------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(s) { const b = new TextEncoder().encode(s); let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const VISTA = { arbol: null, cache: {}, cadena: new Float32Array(16) };
function arbolJugador() {
  if (!VISTA.arbol) VISTA.arbol = DATA.pf[DATA.pfPorNombre.PhotonPlayer];
  return VISTA.arbol;
}
// copia un sub-árbol (desde el nodo i) con índices nuevos
function subArbol(arb, i0) {
  const map = new Map(), out = [];
  const rec = (i, pa) => { const n = Object.assign({}, arb[i]); n.pa = pa; map.set(i, out.length); out.push(n); for (let k = i + 1; k < arb.length; k++) if (arb[k].pa === i) rec(k, map.get(i)); };
  rec(i0, -1);
  for (const n of out) if (n.bo) n.bo = n.bo.map((b) => (map.has(b) ? map.get(b) : -1));
  delete out[0].off;
  return out;
}
// modelo del arma en la mano, con el mapa de pistas de animación
function vistaArma(nombreNodo, clave) {
  const ck = clave || nombreNodo;   // (con clave: una copia aparte, que se puede posar sin tocar la del arma)
  if (VISTA.cache[ck]) return VISTA.cache[ck];
  const arb = arbolJugador();
  const ws = arb.findIndex((n) => n.n === 'WalkSway');
  const i0 = arb.findIndex((n, i) => n.pa === ws && n.n === nombreNodo);
  if (i0 < 0) return (VISTA.cache[ck] = null);
  const sub = subArbol(arb, i0), md = new Modelo(sub);
  // caminos relativos → índice
  const camino = (i) => { const s = []; while (i > 0) { s.push(sub[i].n); i = sub[i].pa; } return s.reverse().join('/'); };
  const porHash = new Map(); for (let i = 1; i < sub.length; i++) porHash.set(crc32(camino(i)), i);
  porHash.set(crc32(''), 0);
  const v = { md, porHash, clip: null, t: 0, base: { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) }, mz: sub.findIndex((n) => /^Muzzle$|^MuzzlePoint$|StartLinePoint|weapon_end/.test(n.n)) };
  // la cadena cámara → WalkSway (escala 0,3 de SmoothCamera)
  return (VISTA.cache[ck] = v);
}
function vistaTocar(v, nombreClip, opt) {
  const c = DATA.anPorNombre[nombreClip]; if (!c) return 0;
  v.clip = c; v.t = 0; v.vel = (opt && opt.vel) || 1; v.loop = !!(opt && opt.loop);
  return c.d / v.vel;
}
function vistaAplicar(v, dt) {
  const c = v.clip; if (!c) return;
  v.t += dt * v.vel;
  let t = v.t; if (v.loop) t %= c.d; else t = Math.min(t, c.d);
  const fps = DATA.an.fps, f = t * fps, i0 = Math.floor(f), w = f - i0, md = v.md;
  for (const pz of c.p) {
    const i = v.porHash.get(pz.h); if (i === undefined) continue;
    const F = pz.f, e = pz.e;
    // (las pistas compactas: animCompactar, datos.js)
    if (e) {
      const n = pz.n, ia = Math.min(i0, n - 1) * e, ib = Math.min(i0 + 1, n - 1) * e;
      if (pz.k === 'a') { md.act[i] = (w < 0.5 ? F[ia] : F[ib]) > 0.5 ? 1 : 0; continue; }
      const dst = pz.k === 'p' ? md.p[i] : pz.k === 's' ? md.s[i] : md.r[i];
      if (pz.k === 'r') {
        const ax = F[ia], ay = F[ia + 1], az = F[ia + 2], aw = F[ia + 3]; let bx = F[ib], by = F[ib + 1], bz = F[ib + 2], bw = F[ib + 3];
        if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
        dst[0] = ax + (bx - ax) * w; dst[1] = ay + (by - ay) * w; dst[2] = az + (bz - az) * w; dst[3] = aw + (bw - aw) * w;
        const l = Math.hypot(dst[0], dst[1], dst[2], dst[3]) || 1; dst[0] /= l; dst[1] /= l; dst[2] /= l; dst[3] /= l;
      } else for (let k = 0; k < 3; k++) dst[k] = F[ia + k] + (F[ib + k] - F[ia + k]) * w;
      continue;
    }
    const a = F[Math.min(i0, F.length - 1)], b = F[Math.min(i0 + 1, F.length - 1)];
    if (pz.k === 'a') { const on = (w < 0.5 ? a : b) > 0.5; md.act[i] = on ? 1 : 0; continue; }
    const dst = pz.k === 'p' ? md.p[i] : pz.k === 's' ? md.s[i] : md.r[i];
    if (pz.k === 'r') {
      let bx = b[0], by = b[1], bz = b[2], bw = b[3]; if (a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      dst[0] = a[0] + (bx - a[0]) * w; dst[1] = a[1] + (by - a[1]) * w; dst[2] = a[2] + (bz - a[2]) * w; dst[3] = a[3] + (bw - a[3]) * w;
      const l = Math.hypot(dst[0], dst[1], dst[2], dst[3]) || 1; dst[0] /= l; dst[1] /= l; dst[2] /= l; dst[3] /= l;
    } else for (let k = 0; k < 3; k++) dst[k] = a[k] + (b[k] - a[k]) * w;
  }
  // los hijos visibles dependen de los activos
  for (let i = 0; i < md.A.length; i++) { const x = md.A[i]; md.ver[i] = md.act[i] && (x.pa < 0 || md.act[x.pa]) && x.m !== undefined && x.m >= 0 && x.mt && !x.mroff && !md.ocultoLod[i] ? 1 : 0; }
  md.sucio = true;
}
// ubica el arma delante de la cámara (con un vaivén al caminar)
function vistaUbicar(v, camPos, camQ, sway) {
  const md = v.md;
  m4trs([camPos.x, camPos.y, camPos.z], [camQ.x, camQ.y, camQ.z, camQ.w], [1, 1, 1], _mb);
  // (apuntando: el arma va al centro con el caño hacia donde mira la cámara, y se balancea mucho menos)
  const k = typeof ARM !== 'undefined' && v === ARM.v ? ARM.apK || 0 : 0, a = k > 0.002 ? vistaAds(v) : null, sw = 1 - 0.85 * k;
  if (a) { _vqA.set(0, 0, 0, 1).slerpTo(a.q, k); m4trs([a.t.x * k, a.t.y * k, a.t.z * k], [_vqA.x, _vqA.y, _vqA.z, _vqA.w], [1, 1, 1], _mvA); m4mul(_mb, _mvA, _mvB); _mb.set(_mvB); }
  if (typeof armaAjAplicar === 'function' && typeof ARM !== 'undefined' && v === ARM.v) armaAjAplicar(_mb, k);   // (cómo la agarra cada uno: armaaj.js)
  m4trs([sway.x * sw, sway.y * sw, sway.z * sw], [(sway.qx || 0) * sw, (sway.qy || 0) * sw, 0, 1], [0.3, 0.3, 0.3], _mo);
  m4mul(_mb, _mo, md.raiz); md.sucio = true;
}
// apuntar (las armas de fuego del juego; idea de Discord): lo que lleva el arma de su lugar de siempre, abajo a la derecha,
// al centro de la vista, en el espacio de la cámara (adelante +z, arriba +y). Sale de la boca del arma en la pose que se ve
// —la del arma quieta, con su animación—: el eje de la boca que más mira hacia adelante es el caño; se gira el caño hasta
// la línea de la mira y se corre la boca hasta esa línea, un poco por debajo (las miras de hierro van arriba del caño). Se
// calcula al empezar a apuntar (ARM.apTok), con la pose de ese momento.
const _vqA = new Quat(), _mvA = new Float32Array(16), _mvB = new Float32Array(16), VADS_BAJO = 0.075;
function vistaAds(v) {
  const tok = typeof ARM !== 'undefined' ? ARM.apTok || 0 : 0;
  if (v.adsTok === tok && v.ads !== undefined) return v.ads;
  const md = v.md; let ads = null;
  if (v.mz >= 0) {
    const R0 = Float32Array.from(md.raiz);
    m4trs([0, 0, 0], [0, 0, 0, 1], [0.3, 0.3, 0.3], md.raiz); md.sucio = true; md.actualizar();
    const W = md.W[v.mz], m = v3(W[12], W[13], W[14]);
    let d = null, mejor = -1;
    for (const c of [0, 4, 8]) { const e = v3(W[c], W[c + 1], W[c + 2]); if (e.len() < 1e-6) continue; e.norm(); for (const sg of [1, -1]) if (e.z * sg > mejor) { mejor = e.z * sg; d = vscale(e, sg); } }
    if (!d || mejor < 0.6) d = m.clone().norm();   // (una boca sin giro útil: la dirección de la cámara a la boca)
    if (m.z > 0.05) { const q = rotEntre(d, v3(0, 0, 1)), m2 = q.rot(m); ads = { q, t: v3(-m2.x, -m2.y - VADS_BAJO * m2.z, 0), boca: m2.z }; }
    md.raiz.set(R0); md.sucio = true;
  }
  v.adsTok = tok; return (v.ads = ads);
}
