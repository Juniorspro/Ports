// ---------------------------------------------------------------------------------------------------------
// el mapa: modelos de la escena del juego, luz y cielo, y el mundo fijo para choques (triángulos de los
// MeshCollider y cajas de los BoxCollider) en una grilla sobre el piso (x, z).
// ---------------------------------------------------------------------------------------------------------
const MAPAS = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space'];
const MAPA_ICONO = { Desert: 'Desert', DesertV2: 'desert 1', FlatGrass: 'flatgrass', City: 'city', Base: 'base', BaseV2: 'basev2', Mars: 'Mars', Space: 'Space' };
const MUNDO = { nombre: '', modelos: [], T: null, TN: null, nt: 0, cajas: [], celda: 6, grilla: new Map(), triCuerpo: [], marca: 1,
  spawns: [], lo: v3(), hi: v3(), gravedad: 1 };
const _clave = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
function grillaAgregar(x0, z0, x1, z1, item) {
  const c = MUNDO.celda, G = MUNDO.grilla;
  const ax = Math.floor(x0 / c), az = Math.floor(z0 / c), bx = Math.floor(x1 / c), bz = Math.floor(z1 / c);
  for (let i = ax; i <= bx; i++) for (let j = az; j <= bz; j++) { const k = _clave(i, j); let l = G.get(k); if (!l) G.set(k, (l = [])); l.push(item); }
}
function cargarMapa(nombre) {
  MUNDO.nombre = nombre; MUNDO.modelos = []; MUNDO.cajas = []; MUNDO.grilla = new Map(); MUNDO.triCuerpo = []; MUNDO.spawns = [];
  const raices = DATA.esc[nombre], tris = [];
  const lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9);
  const q = new Quat(), pt = v3();
  for (const arb of raices) {
    const md = new Modelo(arb); md.actualizar(); MUNDO.modelos.push(md);
    for (let i = 0; i < arb.length; i++) {
      const x = arb[i]; if (!md.act[i]) continue;
      const W = md.W[i];
      if (/^SpawnPoint/.test(x.n) || (x.pa >= 0 && /SpawnPoints/.test(arb[x.pa].n))) MUNDO.spawns.push(v3(W[12], W[13], W[14]));
      if (x.lz && x.lz.t === 1) { m4quat(W, q); const f = q.rot(v3(0, 0, 1)); R.sol.set(-f.x, -f.y, -f.z).norm(); R.solCol = x.lz.c.map((c) => c * x.lz.i); }
      if (!x.col) continue;
      for (const c of x.col) {
        if (c.tr) continue;
        if (c.k === 'b') {
          const sx = Math.hypot(W[0], W[1], W[2]), sy = Math.hypot(W[4], W[5], W[6]), sz = Math.hypot(W[8], W[9], W[10]);
          const b = new Body(boxShape(Math.abs(c.s[0] * sx) / 2 + 1e-3, Math.abs(c.s[1] * sy) / 2 + 1e-3, Math.abs(c.s[2] * sz) / 2 + 1e-3), 0);
          m4pt(W, c.c[0], c.c[1], c.c[2], b.pos); m4quat(W, b.q); b.updateWorld(); b.estatico = true; b.snd = 'concrete';
          MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b);
          lo.set(Math.min(lo.x, a.x0), Math.min(lo.y, a.y0), Math.min(lo.z, a.z0)); hi.set(Math.max(hi.x, a.x1), Math.max(hi.y, a.y1), Math.max(hi.z, a.z1));
        } else if (c.k === 'm' && c.m >= 0) {
          const mc = mallaCPU(c.m), P = mc.P, I = mc.I;
          const base = tris.length / 9;
          const vw = new Float32Array(P.length);
          for (let k = 0; k < P.length; k += 3) { m4pt(W, P[k], P[k + 1], P[k + 2], pt); vw[k] = pt.x; vw[k + 1] = pt.y; vw[k + 2] = pt.z; }
          let n = 0; for (const s of mc.d.sub) n = Math.max(n, s[0] + s[1]);
          // escala negativa (espejo) da vuelta los triángulos
          const det = W[0] * (W[5] * W[10] - W[6] * W[9]) - W[4] * (W[1] * W[10] - W[2] * W[9]) + W[8] * (W[1] * W[6] - W[2] * W[5]);
          for (let k = 0; k + 2 < n; k += 3) {
            let a = I[k] * 3, b = I[k + 1] * 3, cc = I[k + 2] * 3; if (det < 0) { const t = b; b = cc; cc = t; }
            tris.push(vw[a], vw[a + 1], vw[a + 2], vw[b], vw[b + 1], vw[b + 2], vw[cc], vw[cc + 1], vw[cc + 2]);
          }
        } else if (c.k === 's' || c.k === 'c') {
          const r = c.r * m4esc(W), b = new Body(c.k === 's' ? sphereShape(r) : capsuleShape(r, Math.max(0, c.h * m4esc(W) / 2 - r)), 0);
          m4pt(W, c.c[0], c.c[1], c.c[2], b.pos); m4quat(W, b.q); if (c.k === 'c' && c.d !== 1) b.q.mul(c.d === 0 ? Quat.axis(0, 0, 1, Math.PI / 2) : Quat.axis(1, 0, 0, Math.PI / 2));
          b.updateWorld(); b.estatico = true; MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b);
        }
      }
    }
  }
  // triángulos a la grilla
  const T = (MUNDO.T = new Float32Array(tris)); MUNDO.nt = T.length / 9; MUNDO.ntMapa = MUNDO.nt; MUNDO.TN = new Float32Array(MUNDO.nt * 3);
  for (let t = 0; t < MUNDO.nt; t++) {
    const o = t * 9;
    const ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    MUNDO.TN[t * 3] = nx; MUNDO.TN[t * 3 + 1] = ny; MUNDO.TN[t * 3 + 2] = nz;
    const x0 = Math.min(T[o], T[o + 3], T[o + 6]), x1 = Math.max(T[o], T[o + 3], T[o + 6]), z0 = Math.min(T[o + 2], T[o + 5], T[o + 8]), z1 = Math.max(T[o + 2], T[o + 5], T[o + 8]);
    grillaAgregar(x0, z0, x1, z1, t);
    lo.set(Math.min(lo.x, x0), Math.min(lo.y, T[o + 1], T[o + 4], T[o + 7]), Math.min(lo.z, z0)); hi.set(Math.max(hi.x, x1), Math.max(hi.y, T[o + 1], T[o + 4], T[o + 7]), Math.max(hi.z, z1));
  }
  MUNDO.lo.copy(lo); MUNDO.hi.copy(hi);
  // cielo, luz ambiente y niebla del mapa
  const aj = DATA.aj[nombre] || {}, sky = aj.sky !== undefined ? DATA.mt[aj.sky] : null, cc = (sky && sky.cc) || {};
  const col = (k, d) => (cc[k] ? cc[k].slice(0, 3) : d);
  R.cielo = { top: col('_TopColor', [0.28, 0.64, 1]), mid: col('_MiddleColor', [0.92, 0.92, 0.92]), bot: col('_BottomColor', [0.53, 0.58, 0.68]),
    exp: [(sky && sky.f && sky.f._TopExponent) || 0.8, (sky && sky.f && sky.f._BottomExponent) || 1], sol: col('_SunTint', [0.95, 0.82, 0.67]) };
  if (nombre === 'Space') R.cielo.sol = [0.6, 0.6, 0.6];
  const C = R.cielo, ai = aj.ai || 1;
  // luz ambiente como la del cielo en Unity (modo Skybox): bastante clara
  R.ambS = [0, 1, 2].map((k) => (C.top[k] * 0.4 + C.mid[k] * 0.6) * ai * 0.72);
  R.ambG = [0, 1, 2].map((k) => (C.mid[k] * 0.45 + C.bot[k] * 0.3) * ai * 0.62);
  // la estación espacial: el casco taparía el sol adentro (en el juego no había sombras): luz pareja y sin sombras del sol
  if (nombre === 'Space') { R.ambS = [0.5, 0.5, 0.56]; R.ambG = [0.34, 0.34, 0.38]; }
  MUNDO.sinSombra = nombre === 'Space';
  const lejos = GFX.lejos;
  if (aj.fog && aj.fd > 0) R.niebla = { c: aj.fc.slice(0, 3), a: 0.15 / aj.fd, b: Math.min(lejos, 1.9 / aj.fd) };
  else if (aj.fog && aj.fm === 1 && aj.fe > aj.fs) R.niebla = { c: aj.fc.slice(0, 3), a: aj.fs, b: aj.fe };
  else R.niebla = { c: C.mid.slice(), a: lejos * 0.7, b: lejos };
  if (nombre === 'Space') R.niebla = { c: [0, 0, 0], a: lejos * 0.8, b: lejos * 1.5 };
  MUNDO.gravedad = nombre === 'Space' ? 0.16 : nombre === 'Mars' ? 0.38 : 1;
  R.expoK = 1; R.noche = 0; R.lucesMapa = false;
  if (typeof diaGuardarBase === 'function') diaGuardarBase();
  if (typeof marcasLimpiar === 'function') marcasLimpiar();
  PH.gscale = MUNDO.gravedad;
  if (!MUNDO.spawns.length) {
    const h = mundoRayo(v3(0, hi.y + 5, 0), v3(0, -1, 0), 1e4);
    MUNDO.spawns.push(v3(0, h ? hi.y + 5 - h.t + 1 : 2, 0));
  }
}
// ---------------- choques contra el mundo ----------------
// triángulo como poliedro chato (dos caras) para el solver; se arma la primera vez que algo lo toca
function triCuerpo(t) {
  let b = MUNDO.triCuerpo[t]; if (b) return b;
  const T = MUNDO.T, o = t * 9, c = v3((T[o] + T[o + 3] + T[o + 6]) / 3, (T[o + 1] + T[o + 4] + T[o + 7]) / 3, (T[o + 2] + T[o + 5] + T[o + 8]) / 3);
  const vs = [v3(T[o] - c.x, T[o + 1] - c.y, T[o + 2] - c.z), v3(T[o + 3] - c.x, T[o + 4] - c.y, T[o + 5] - c.z), v3(T[o + 6] - c.x, T[o + 7] - c.y, T[o + 8] - c.z)];
  const sh = hullFrom(vs, [[0, 1, 2], [2, 1, 0]]);
  b = new Body(sh, 0); b.pos.copy(c); b.updateWorld(); b.estatico = true; b.tri = t; b.snd = 'concrete'; b.propio = t >= MUNDO.ntMapa; // (rampas: geo.js)
  b.tn = v3(MUNDO.TN[t * 3], MUNDO.TN[t * 3 + 1], MUNDO.TN[t * 3 + 2]);
  return (MUNDO.triCuerpo[t] = b);
}
function mundoCerca(x0, y0, z0, x1, y1, z1, out) {
  out.length = 0; const c = MUNDO.celda, G = MUNDO.grilla, T = MUNDO.T, mk = ++MUNDO.marca;
  const ax = Math.floor(x0 / c), az = Math.floor(z0 / c), bx = Math.floor(x1 / c), bz = Math.floor(z1 / c);
  if ((bx - ax + 1) * (bz - az + 1) > 400) return out;
  for (let i = ax; i <= bx; i++) for (let j = az; j <= bz; j++) {
    const l = G.get(_clave(i, j)); if (!l) continue;
    for (const it of l) {
      if (typeof it === 'number') {
        const o = it * 9;
        if (Math.max(T[o], T[o + 3], T[o + 6]) < x0 || Math.min(T[o], T[o + 3], T[o + 6]) > x1) continue;
        if (Math.max(T[o + 1], T[o + 4], T[o + 7]) < y0 || Math.min(T[o + 1], T[o + 4], T[o + 7]) > y1) continue;
        if (Math.max(T[o + 2], T[o + 5], T[o + 8]) < z0 || Math.min(T[o + 2], T[o + 5], T[o + 8]) > z1) continue;
        const b = triCuerpo(it); if (b.mk === mk) continue; b.mk = mk; out.push(b);
      } else {
        if (it.mk === mk) continue; it.mk = mk; const a = it.aabb;
        if (a.x1 < x0 || a.x0 > x1 || a.y1 < y0 || a.y0 > y1 || a.z1 < z0 || a.z0 > z1) continue;
        out.push(it);
      }
    }
  }
  return out;
}
// rayo contra el mapa: recorre las celdas de la grilla que cruza
function rayTri(o, d, t, tmax) {
  const T = MUNDO.T, k = t * 9;
  const e1x = T[k + 3] - T[k], e1y = T[k + 4] - T[k + 1], e1z = T[k + 5] - T[k + 2], e2x = T[k + 6] - T[k], e2y = T[k + 7] - T[k + 1], e2z = T[k + 8] - T[k + 2];
  const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return -1;
  const inv = 1 / det, sx = o.x - T[k], sy = o.y - T[k + 1], sz = o.z - T[k + 2], u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (d.x * qx + d.y * qy + d.z * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return tt >= 0 && tt <= tmax ? tt : -1;
}
function mundoRayo(o, d, tmax) {
  const c = MUNDO.celda, G = MUNDO.grilla, mk = ++MUNDO.marca;
  let best = tmax, bt = -1, bb = null;
  let cx = Math.floor(o.x / c), cz = Math.floor(o.z / c);
  const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const tdx = Math.abs(d.x) > 1e-9 ? c / Math.abs(d.x) : 1e9, tdz = Math.abs(d.z) > 1e-9 ? c / Math.abs(d.z) : 1e9;
  let tmx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (cx + 1) * c - o.x : o.x - cx * c) / Math.abs(d.x)) : 1e9;
  let tmz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (cz + 1) * c - o.z : o.z - cz * c) / Math.abs(d.z)) : 1e9;
  let tcel = 0;
  for (let paso = 0; paso < 2000; paso++) {
    const l = G.get(_clave(cx, cz));
    if (l) for (const it of l) {
      if (typeof it === 'number') {
        if (MUNDO.triMarca === undefined) MUNDO.triMarca = new Uint32Array(MUNDO.nt + 1);
        if (MUNDO.triMarca.length < MUNDO.nt) MUNDO.triMarca = new Uint32Array(MUNDO.nt + 1);
        if (MUNDO.triMarca[it] === mk) continue; MUNDO.triMarca[it] = mk;
        const t = rayTri(o, d, it, best); if (t >= 0) { best = t; bt = it; bb = null; }
      } else {
        if (it.mk === mk) continue; it.mk = mk;
        let h = null;
        if (it.shape.type === 'hull') h = rayHull(it, o, d, best);
        else if (it.shape.type === 'sphere') h = raySphere(it.pos, it.shape.r, o, d, best);
        else for (const p of capSpheres(it)) { const k = raySphere(p, it.shape.r, o, d, best); if (k && (!h || k.t < h.t)) h = k; }
        if (h && h.t < best) { best = h.t; bb = { b: it, n: h.n }; bt = -1; }
      }
    }
    if (tcel > best) break;
    if (tmx < tmz) { tcel = tmx; tmx += tdx; cx += sx; } else { tcel = tmz; tmz += tdz; cz += sz; }
    if (tcel > tmax) break;
  }
  if (bt >= 0) {
    const n = v3(MUNDO.TN[bt * 3], MUNDO.TN[bt * 3 + 1], MUNDO.TN[bt * 3 + 2]); if (vdot(n, d) > 0) n.scale(-1);
    return { t: best, n, tri: bt };
  }
  if (bb) return { t: best, n: bb.n.clone(), caja: bb.b };
  return null;
}
// el punto más cercano de un triángulo a p (para el jugador)
function triCercano(t, px, py, pz, out) {
  const T = MUNDO.T, k = t * 9;
  const ax = T[k], ay = T[k + 1], az = T[k + 2], bx = T[k + 3], by = T[k + 4], bz = T[k + 5], cx = T[k + 6], cy = T[k + 7], cz = T[k + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return out.set(ax, ay, az);
  const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return out.set(bx, by, bz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return out.set(ax + abx * v, ay + aby * v, az + abz * v); }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return out.set(cx, cy, cz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return out.set(ax + acx * w, ay + acy * w, az + acz * w); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return out.set(bx + (cx - bx) * w, by + (cy - by) * w, bz + (cz - bz) * w); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return out.set(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
}
// triángulos cerca de una caja (índices)
function trisCerca(x0, z0, x1, z1, out) {
  out.length = 0; const c = MUNDO.celda, G = MUNDO.grilla, mk = ++MUNDO.marca;
  if (!MUNDO.triMarca || MUNDO.triMarca.length < MUNDO.nt) MUNDO.triMarca = new Uint32Array(MUNDO.nt + 1);
  for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
    const l = G.get(_clave(i, j)); if (!l) continue;
    for (const it of l) if (typeof it === 'number') { if (MUNDO.triMarca[it] === mk) continue; MUNDO.triMarca[it] = mk; out.push(it); }
  }
  return out;
}
function dibujarMundo() { for (const m of MUNDO.modelos) m.encolar(); }
