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
function vistaArma(nombreNodo) {
  if (VISTA.cache[nombreNodo]) return VISTA.cache[nombreNodo];
  const arb = arbolJugador();
  const ws = arb.findIndex((n) => n.n === 'WalkSway');
  const i0 = arb.findIndex((n, i) => n.pa === ws && n.n === nombreNodo);
  if (i0 < 0) return (VISTA.cache[nombreNodo] = null);
  const sub = subArbol(arb, i0), md = new Modelo(sub);
  // caminos relativos → índice
  const camino = (i) => { const s = []; while (i > 0) { s.push(sub[i].n); i = sub[i].pa; } return s.reverse().join('/'); };
  const porHash = new Map(); for (let i = 1; i < sub.length; i++) porHash.set(crc32(camino(i)), i);
  porHash.set(crc32(''), 0);
  const v = { md, porHash, clip: null, t: 0, base: { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) }, mz: sub.findIndex((n) => /^Muzzle$|^MuzzlePoint$|StartLinePoint|weapon_end/.test(n.n)) };
  // la cadena cámara → WalkSway (escala 0,3 de SmoothCamera)
  return (VISTA.cache[nombreNodo] = v);
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
    const F = pz.f, a = F[Math.min(i0, F.length - 1)], b = F[Math.min(i0 + 1, F.length - 1)];
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
  m4trs([sway.x, sway.y, sway.z], [sway.qx || 0, sway.qy || 0, 0, 1], [0.3, 0.3, 0.3], _mo);
  m4mul(_mb, _mo, md.raiz); md.sucio = true;
}
