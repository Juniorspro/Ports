// ---------------- emotes nuevos (bailes, gestos y acrobacias) y los que hace la gente ----------------
// Cada uno es una lista de rotaciones locales de los huesos del juego (y el movimiento de la cadera) cuadro a cuadro,
// sacada de animaciones de un esqueleto tipo mixamo (herramientas/emote_meshy.py) o hecha en el editor de animaciones.
// Se ponen encima de la animación de parado (los dedos y lo que el clip no mueve siguen igual), con entrada y salida
// suaves; los bailes se repiten y los de un tiro terminan solos. Se llaman "rb:Id" (los del paquete) o "u:Id" (hechos
// por la gente, guardados o bajados de la tienda).
const EMO = { minis: {}, clips: {}, remotos: {}, cat: 'todos', pedidos: {}, ti: { items: [], cargando: false, error: false, q: '', n: 0 }, cargas: {}, q: '', lim: 120 };
// ---------------- los de captura de movimiento (CMU, 2548): fuera del HTML, se bajan cuando se eligen ----------------
// El catálogo (id, nombre, categoría, duración, si se repite) va adentro; cada uno es un archivo chico (herramientas/
// emote_bvh.py) que se busca al lado del HTML (en githack es la misma rama) o en githack, y queda guardado en el navegador
const CMU_CAT = /*CMUCAT*/null;
const CMU_I = CMU_CAT ? Object.fromEntries(CMU_CAT.items.map((x) => [x[0], x])) : {};
const EMO_BASES = ['emotes/cmu/', 'https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/hypper/emotes/cmu/', 'https://raw.githack.com/Juniorspro/Ports/main/hypper/emotes/cmu/'];
async function emoBajar(k) {
  let cache = null; try { if (window.caches && location.protocol === 'https:') cache = await caches.open('rb-emotes-1'); } catch (e) {}
  for (const b of EMO_BASES) {
    if (location.protocol === 'file:' && !/^https?:/.test(b)) continue;   // (abierto como archivo, el navegador no deja leer al lado)
    const url = new URL(b + k + '.bin', location.href).href;
    try {
      let r = cache && (await cache.match(url));
      if (!r) { r = await fetch(url); if (!r.ok) continue; if (cache) cache.put(url, r.clone()).catch(() => {}); }
      return await desgz(new Uint8Array(await r.arrayBuffer()));
    } catch (e) {}
  }
  return null;
}
// 'RBE2', cuadros (u16), fps, se repite, huesos (índices en CMU_CAT.huesos); las rotaciones (×8191) y la cadera (mm) como
// diferencias int16 con los bytes en planos (todos los bajos, después los altos)
function emoBin(k, u) {
  if (!u || u.length < 10 || u[0] !== 82 || u[1] !== 66 || u[2] !== 69 || u[3] !== 50) return null;
  const nf = u[4] | u[5] << 8, fps = u[6], nb = u[8], H = CMU_CAT.huesos, b = [];
  for (let i = 0; i < nb; i++) b.push(H[u[9 + i]]);
  const n = nf * nb * 4, m = nf * 3, o = 9 + nb, F = nb * 4;
  if (u.length < o + (n + m) * 2) return null;
  const r = new Int16Array(n), h = new Int16Array(m), acc = new Int16Array(F);
  for (let i = 0; i < n; i++) { const d = (u[o + i] | u[o + n + i] << 8) << 16 >> 16, j = i % F; acc[j] += d; r[i] = acc[j] * 4; }   // (se envuelve igual que al guardar)
  const o2 = o + 2 * n; let a0 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < m; i++) { const d = (u[o2 + i] | u[o2 + m + i] << 8) << 16 >> 16, c = i % 3; h[i] = c === 0 ? (a0 = (a0 + d) << 16 >> 16) : c === 1 ? (a1 = (a1 + d) << 16 >> 16) : (a2 = (a2 + d) << 16 >> 16); }
  return emoLimpiar({ id: 'c:' + k, n: CMU_I[k][1], fps, nf, b, r, h, loop: !!u[7], d: (nf - 1) / fps });
}
// el cuadro 0 de todas las capturas (las 2175, medido) es el de referencia en pose T: al empezar y al repetirse se veía de
// golpe. Se saca siempre; y un último cuadro que salta más que el triple de lo normal (y más de 45°), también
function emoLimpiar(C) {
  const nb = C.b.length, salto = (f0, f1) => { let m = 0; for (let k = 0; k < nb; k++) { const a = (f0 * nb + k) * 4, b = (f1 * nb + k) * 4, d = Math.abs(C.r[a] * C.r[b] + C.r[a + 1] * C.r[b + 1] + C.r[a + 2] * C.r[b + 2] + C.r[a + 3] * C.r[b + 3]) / (32767 * 32767); m = Math.max(m, 2 * Math.acos(Math.min(1, d))); } return m * 180 / Math.PI; };
  if (C.nf < 6) return C;
  // (lo que gira un hueso de un cuadro al otro en esta captura, la mediana: el límite es el triple, y al menos 45°)
  const J = []; for (let f = 1; f < C.nf; f++) J.push(salto(f - 1, f)); const med = J.slice(1).sort((x, y) => x - y)[(J.length - 1) >> 1], lim = Math.max(45, 3 * med);
  let ini = 1, fin = C.nf - 1;   // (el 0, la pose T)
  while (C.nf - 1 - fin < 3 && fin - ini > 4 && J[fin - 1] > lim) fin--;   // (J[i] es el salto de i a i+1)
  if (ini || fin < C.nf - 1) { C.r = C.r.slice(ini * nb * 4, (fin + 1) * nb * 4); if (C.h) C.h = C.h.slice(ini * 3, (fin + 1) * 3); C.nf = fin - ini + 1; }
  // vueltas de la captura: un hueso (casi siempre un pie) que de un cuadro al otro gira más de 100° y queda así varios
  // cuadros (un error de la conversión). Se lleva una corrección K (q' = q·K): en cada salto así, K pasa a ser la que
  // deja ese cuadro igual al anterior corregido, y sigue para los que vienen (cuando vuelve a saltar, se deshace sola).
  // La cadera no: ésa sí puede girar rápido
  const R = C.r, I = 1 / 32767, mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const lee = (o) => [R[o] * I, R[o + 1] * I, R[o + 2] * I, R[o + 3] * I], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  for (let k = 0; k < nb; k++) {
    if (C.b[k] === 'Hips') continue;
    let K = [0, 0, 0, 1], prevRaw = lee(k * 4), prev = prevRaw, cambio = false;
    for (let f = 1; f < C.nf; f++) {
      const o = (f * nb + k) * 4, raw = lee(o);
      if (2 * Math.acos(Math.min(1, Math.abs(dot(prevRaw, raw)))) > 100 * Math.PI / 180) { const inv = [-raw[0], -raw[1], -raw[2], raw[3]]; K = mul(mul(inv, prev), [0, 0, 0, 1]); cambio = true; }
      let qn = cambio ? mul(raw, K) : raw; const L = Math.hypot(...qn) || 1; qn = qn.map((x) => x / L);
      if (cambio) { R[o] = Math.round(qn[0] * 32767); R[o + 1] = Math.round(qn[1] * 32767); R[o + 2] = Math.round(qn[2] * 32767); R[o + 3] = Math.round(qn[3] * 32767); }
      prevRaw = raw; prev = qn;
    }
  }
  C.d = (C.nf - 1) / C.fps; return C;
}
function emoCargar(id) {
  if (EMO.clips[id]) return Promise.resolve(EMO.clips[id]);
  if (EMO.cargas[id]) return EMO.cargas[id];
  const k = id.slice(2); if (!CMU_I[k]) return Promise.resolve(null);
  return (EMO.cargas[id] = emoBajar(k).then((u) => { const c = emoBin(k, u); delete EMO.cargas[id]; if (c) EMO.clips[id] = c; return c; }));
}
// un clip del paquete ("rb:"), uno instalado o hecho por vos ("u:": INST.anims) o el de otro jugador que llegó por la red
function emoClip(id) {
  if (EMO.clips[id]) return EMO.clips[id];
  if (id.startsWith('c:')) { emoCargar(id); return null; }
  let c = null;
  if (id.startsWith('rb:') && DATA.emo && DATA.emo[id.slice(3)]) c = DATA.emo[id.slice(3)];
  else if (id.startsWith('u:')) { const k = id.slice(2), v = (typeof INST !== 'undefined' && INST.anims && INST.anims[k]) || EMO.remotos[k]; if (v && v.clip) c = Object.assign({ n: v.nombre }, v.clip); }
  if (!c) return null;
  const a16 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); };
  const r = typeof c.r === 'string' ? a16(c.r) : Int16Array.from(c.r), h = c.h ? (typeof c.h === 'string' ? a16(c.h) : Int16Array.from(c.h)) : null;
  return (EMO.clips[id] = { id, n: c.n, fps: c.fps || 20, nf: c.nf, b: c.b, r, h, loop: !!c.loop, d: (c.nf - 1) / (c.fps || 20) });
}
const emoOlvidar = (id) => { delete EMO.clips[id]; };
const emoValido = (e) => typeof e === 'string' && (e === 'Patada' || DATA.emotes.includes(e) || (e.startsWith('c:') && !!CMU_I[e.slice(2)]) || !!emoClip(e));
// índices de los huesos del clip en un personaje (por nombre, sin el prefijo de mixamo)
function emoIndices(P, C) {
  const D = P.D, k = C.b.join(',');
  if (!D.emoI) D.emoI = {};
  if (D.emoI[k]) return D.emoI[k];
  const porNombre = {}; D.sub.forEach((n, i) => { const m = /^mixamorig\d*:(.*)$/.exec(n.n); if (m && porNombre[m[1]] === undefined) porNombre[m[1]] = i; });
  return (D.emoI[k] = C.b.map((b) => (porNombre[b] === undefined ? -1 : porNombre[b])));
}
const _qe = new Quat(), _qf = new Quat(), _qg = new Quat();
// la pose del emote en el cuadro de ahora (lo llama animarPersona después de la animación de parado)
// Los que se repiten: la primera vez se ven enteros desde el principio y después se repite el tramo [a, b] que mejor
// empalma (emoBucle), con un fundido de 0,25 s antes de volver a "a": las capturas no terminan como empiezan (al dar la
// vuelta saltaban, la mitad más de 95° en algún hueso).
function emoPose(P, dt) {
  const e = P.emote; if (!e || !(e.startsWith('rb:') || e.startsWith('u:') || e.startsWith('c:'))) return;
  const C = emoClip(e); if (!C) return;
  const t = P.emoteT || 0;
  const loop = C.loop && !P.escena;   // (de a dos: una vez, con la cadera entera)
  if (!loop && t >= C.d) { if (P === JUG.cuerpo || !P.remoto) P.emote = null; return; }
  let w = ss01(clamp(t / 0.25, 0, 1)); if (!loop) w *= 1 - ss01(clamp((t - (C.d - 0.3)) / 0.3, 0, 1));
  if (!loop) { emoAplicar(P, C, Math.min(t * C.fps, C.nf - 1.001), w); return; }
  // empalme por inercialización: al dar la vuelta (de b a a), cada hueso arranca con la diferencia exacta del salto
  // (Δ = q(b)·q(a)⁻¹) y la va soltando en 0,3 s: nunca gira más que esa diferencia y no mezcla poses lejanas (los giros
  // de un baile, un pie dado vuelta en la captura); la cadera igual con su lugar
  const [a, b, dif] = emoBucle(C, true), L = b - a, F = Math.max(2, Math.min(Math.round(clamp(0.3 + (dif || 0) / 250, 0.3, 0.8) * C.fps), Math.floor(L / 2)));   // (más largo cuanto más grande es el salto)
  const f0 = t * C.fps; let f = f0; if (f >= b) f = a + ((f - a) % L);
  emoAplicar(P, C, f, w);
  if (f0 >= b && f - a < F) emoInercia(P, C, a, b, w * (1 - ss01((f - a) / F)));
}
const _qi = new Quat(), _qj = new Quat(), _qk = new Quat(), _qI = new Quat();
function emoInercia(P, C, a, b, s) {
  if (s <= 0.001) return;
  const md = P.md, idx = emoIndices(P, C), nb = C.b.length, R = C.r;
  for (let k = 0; k < nb; k++) {
    const i = idx[k]; if (i < 0) continue;
    const oa = (a * nb + k) * 4, ob = (b * nb + k) * 4;
    _qi.set(R[ob] / 32767, R[ob + 1] / 32767, R[ob + 2] / 32767, R[ob + 3] / 32767).norm();
    _qj.set(-R[oa] / 32767, -R[oa + 1] / 32767, -R[oa + 2] / 32767, R[oa + 3] / 32767).norm();   // (q(a)⁻¹)
    _qk.mulTo(_qi, _qj); _qI.set(0, 0, 0, 1).slerpTo(_qk, s);   // (Δ, hasta s)
    const r = md.r[i]; _qi.set(r[0], r[1], r[2], r[3]); _qk.mulTo(_qI, _qi); r[0] = _qk.x; r[1] = _qk.y; r[2] = _qk.z; r[3] = _qk.w;
  }
  const hi = idx[C.b.indexOf('Hips')];
  if (C.h && hi >= 0) {
    const E = P.escena && P.escena.id === C.id, H = E ? C.h : emoEnLugar(C), p = md.p[hi], b0 = P.D.sub[hi].p; for (let c = 0; c < 3; c++) p[c] += (H[b * 3 + c] - H[a * 3 + c]) / 1000 * s;
    if (!E) { const dx = p[0] - b0[0], dz = p[2] - b0[2], m = Math.hypot(dx, dz) / 0.45; if (m > 1) { p[0] = b0[0] + dx / m; p[2] = b0[2] + dz / m; } }   // (en el lugar: a no más de 0,45 m)
  }
  md.sucio = true;
}
// el cuadro f (con fracción) de un clip sobre la pose que ya tiene la persona, con peso w
function emoAplicar(P, C, f, w) {
  const md = P.md, idx = emoIndices(P, C), nb = C.b.length;
  const f0 = Math.floor(f), f1 = Math.min(C.nf - 1, f0 + 1), a = f - f0, R = C.r;
  for (let k = 0; k < nb; k++) {
    const i = idx[k]; if (i < 0) continue;
    const o0 = (f0 * nb + k) * 4, o1 = (f1 * nb + k) * 4;
    _qe.set(R[o0] / 32767, R[o0 + 1] / 32767, R[o0 + 2] / 32767, R[o0 + 3] / 32767).norm();
    _qf.set(R[o1] / 32767, R[o1 + 1] / 32767, R[o1 + 2] / 32767, R[o1 + 3] / 32767).norm();
    _qe.slerpTo(_qf, a);
    const r = md.r[i]; _qg.set(r[0], r[1], r[2], r[3]).slerpTo(_qe, w); r[0] = _qg.x; r[1] = _qg.y; r[2] = _qg.z; r[3] = _qg.w;
  }
  // la cadera: su lugar de reposo más lo que se mueve en el clip, en el lugar (sin el viaje de la captura)
  const hi = idx[C.b.indexOf('Hips')];
  if (C.h && hi >= 0) {
    const E = P.escena && P.escena.id === C.id, H = E ? C.h : emoEnLugar(C), b0 = P.D.sub[hi].p, o0 = f0 * 3, o1 = f1 * 3, p = md.p[hi], wp = E ? 1 : w;   // (de a dos: la cadera de la captura, entera y sin fundido: los dos quedan donde se grabaron)
    for (let c = 0; c < 3; c++) { const v = (H[o0 + c] + (H[o1 + c] - H[o0 + c]) * a) / 1000; p[c] = p[c] + (b0[c] + v - p[c]) * wp; }
  }
  md.sucio = true;
}
// las capturas traen el viaje de la persona (caminar, correr, girar): el 43 % llevaba la cadera a más de 1 m del jugador
// (hasta 8 m) y volvía de golpe. Se le resta a la cadera (sólo lo horizontal) su promedio de ±0,6 s: queda el vaivén
// y el emote se hace en el lugar
function emoEnLugar(C) {
  if (C.hIn) return C.hIn;
  // (una recta ajustada a ±0,6 s alrededor de cada cuadro: en los bordes del clip el promedio quedaba atrás del viaje;
  // y como red, lo que quede no pasa de 0,45 m)
  const h = C.h, nf = C.nf, W = Math.max(2, Math.round(0.6 * C.fps)), out = new Float32Array(h.length);
  for (let f = 0; f < nf; f++) {
    const lo = Math.max(0, Math.min(f - W, nf - 1 - 2 * W)), hi = Math.min(nf - 1, Math.max(f + W, 2 * W));
    let n = 0, sf = 0, sff = 0, sx = 0, sz = 0, sfx = 0, sfz = 0;
    for (let g = lo; g <= hi; g++) { const x = h[g * 3], z = h[g * 3 + 2], u = g - f; n++; sf += u; sff += u * u; sx += x; sz += z; sfx += u * x; sfz += u * z; }
    const den = n * sff - sf * sf, ax = den ? (sx * sff - sf * sfx) / den : sx / n, az = den ? (sz * sff - sf * sfz) / den : sz / n;
    let dx = h[f * 3] - ax, dz = h[f * 3 + 2] - az; const m = Math.hypot(dx, dz) / 450; if (m > 1) { dx /= m; dz /= m; }
    out[f * 3] = dx; out[f * 3 + 1] = h[f * 3 + 1]; out[f * 3 + 2] = dz;
  }
  return (C.hIn = out);
}
// ---------------- nadar ----------------
// dos capturas de CMU: la brazada de pecho acostado (126_04, sobre un banquito) y la brazada parado (79_02: flotando en
// el lugar), mezcladas por la velocidad; cada una en el tramo que mejor se repite (el cuadro de la vuelta, parecido al
// del principio)
const NADO = { nada: 'c:126_04', flota: 'c:79_02' };
// (largo: para los emotes, el tramo empieza en el primer cuarto y termina en el último: se ve casi todo el clip; para nadar
// sirve cualquier tramo de 1,5 s o más)
function emoBucle(C, largo) {
  const ck = largo ? 'bucleL' : 'bucle'; if (C[ck]) return C[ck];
  // (el tramo empieza después de 0,25 s, así hay lugar para el fundido; se compara el peor hueso, no sólo la suma)
  const nb = C.b.length, R = C.r, min = Math.min(Math.round(1.5 * C.fps), C.nf - 2), K = 1 / (32767 * 32767), paso = Math.max(2, Math.ceil(C.nf / 160)), a0 = Math.min(Math.round(0.25 * C.fps), Math.max(0, C.nf - min - 2)); let mejor = 1e9, par = [a0, C.nf - 1];
  const aMax = largo ? Math.max(a0 + 1, Math.floor(C.nf * 0.25)) : C.nf, bMin = largo ? Math.floor(C.nf * 0.75) : 0;
  for (let a = a0; a < aMax; a += paso) for (let b = Math.max(a + min, bMin); b < C.nf; b += paso) {
    let s = 0, mx = 0; for (let k = 0; k < nb; k++) { const o0 = (a * nb + k) * 4, o1 = (b * nb + k) * 4, d = 1 - Math.abs(R[o0] * R[o1] + R[o0 + 1] * R[o1 + 1] + R[o0 + 2] * R[o1 + 2] + R[o0 + 3] * R[o1 + 3]) * K; s += d; if (d > mx) mx = d; }
    s += 4 * mx; if (s < mejor) { mejor = s; par = [a, b, 2 * Math.acos(Math.min(1, 1 - mx)) * 180 / Math.PI]; }   // (y cuánto difieren, en grados: el peor hueso)
  }
  return (C[ck] = par);
}
function nadoPose(P, dt) {
  const k = P.nadoK || 0; if (k < 0.001 || P.emote) return;
  const A = emoClip(NADO.nada), B = emoClip(NADO.flota); if (!A || !B) return;   // (se bajan la primera vez)
  const sp = Math.hypot(P.vel.x, P.vel.z), ws = clamp((sp - 0.3) / 1.2, 0, 1);
  P.nadoW = (P.nadoW || 0) + (ws - (P.nadoW || 0)) * Math.min(1, dt * 4);
  P.nadoT = (P.nadoT || 0) + dt * (0.8 + Math.min(sp, 4) * 0.12);
  for (const [C, w] of [[B, 1], [A, P.nadoW]]) {
    if (w <= 0.001) continue;
    const [a, b] = emoBucle(C); emoAplicar(P, C, a + (P.nadoT * C.fps) % (b - a), w * k);
  }
}
// ---------------- el panel de emotes: categorías, miniaturas, los tuyos y los de la tienda ----------------
const EMO_CATS = ['todos', 'fav', 'rec', 'juntos', 'clasico', 'baile', 'gesto', 'accion', 'pelea', 'deporte', 'acrobacia', 'animal', 'caminar', 'otro', 'mio', 'tienda'];
const emoNom = (id, n) => { const k = id.startsWith('rb:') ? 'em.' + id.slice(3) : 'emc.' + id, t = T(k); return t === k ? n || id : t; };
// favoritos (la estrella) y los últimos que usaste, guardados en el navegador
const emoGuardados = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
EMO.fav = new Set(emoGuardados('rb_emo_fav')); EMO.rec = emoGuardados('rb_emo_rec');
function emoUsado(id) { EMO.rec = [id, ...EMO.rec.filter((x) => x !== id)].slice(0, 30); guardarLS('rb_emo_rec', EMO.rec); }
// los que se pueden elegir: los del juego (clásicos), los nuevos del paquete, los de captura de movimiento y los tuyos
function emoLista() {
  const l = DATA.emotes.map((e) => ({ id: e, n: emoNom(e, e), cat: 'clasico', ico: 'emo_' + e }));
  for (const [k, c] of Object.entries(DATA.emo || {})) l.push({ id: 'rb:' + k, n: emoNom('rb:' + k, c.n), cat: c.cat || (c.loop ? 'baile' : 'gesto'), ico: 'emo_' + k });
  for (const x of CMU_CAT ? CMU_CAT.items : []) l.push({ id: 'c:' + x[0], n: x[1].charAt(0).toUpperCase() + x[1].slice(1), cat: x[2], dur: x[3], cmu: true, mini: x[5] });
  for (const [k, v] of Object.entries((typeof INST !== 'undefined' && INST.anims) || {})) l.push({ id: 'u:' + k, n: v.nombre, cat: v.cat || 'baile', mio: true, foto: v.foto, local: /^local-/.test(k), autor: v.autor });
  return l;
}
// ---------------- miniaturas: la silueta del personaje en su pose más característica ----------------
// Para cada animación: se prueba en un Hero aparte en 24 momentos, se elige el que más se aparta de estar parado (manos
// y pies lejos de donde estarían) y otro bien distinto (que se ve más clarito, para que se note el movimiento), se miran
// en 3/4 y cada uno queda en 16 articulaciones de 6 bits por eje: 32 letras. Las de captura vienen hechas en el catálogo
// (herramientas: pruebas/emotes_minis.mjs); las tuyas se hacen al verlas.
const EMO_MJ = ['Hips', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const EMO_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function emoMiniP() {
  if (EMO.miniP) return EMO.miniP;
  const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.visible = false; const i = PERS.indexOf(P); if (i >= 0) PERS.splice(i, 1);
  P.md.ponerRaiz(M4.id()); P.mi = EMO_MJ.map((n) => P.D.h[n] ?? P.D.h['mixamorig:' + n] ?? -1);
  return (EMO.miniP = P);
}
function emoMiniPuntos(P, C, f) {
  const md = P.md, nb = md.r.length, hi = P.D.h.Hips;
  for (let i = 0; i < nb; i++) { const b0 = P.base[i]; md.r[i][0] = b0[0]; md.r[i][1] = b0[1]; md.r[i][2] = b0[2]; md.r[i][3] = b0[3]; }
  if (hi !== undefined) { const s0 = P.D.sub[hi].p; md.p[hi][0] = s0[0]; md.p[hi][1] = s0[1]; md.p[hi][2] = s0[2]; }
  if (C) emoAplicar(P, C, f, 1);
  md.sucio = true; md.actualizar();
  return P.mi.map((i) => (i < 0 ? null : [md.W[i][12], md.W[i][13], md.W[i][14]]));
}
function emoMini(C) {
  if (!C || C.nf < 2) return '';
  const P = emoMiniP(), quieto = emoMiniPuntos(P, null, 0), ext = [6, 9, 12, 15];
  const rel = (J) => J.map((p) => p && [p[0] - J[0][0], p[1], p[2] - J[0][2]]), Q = rel(quieto);
  const M = []; for (let s = 0; s < 24; s++) { const f = Math.min(C.nf - 1.001, (s + 0.5) / 24 * (C.nf - 1)), J = rel(emoMiniPuntos(P, C, f)); let sc = 0; for (const e of ext) if (J[e] && Q[e]) sc += Math.hypot(J[e][0] - Q[e][0], J[e][1] - Q[e][1], J[e][2] - Q[e][2]); M.push({ J, sc }); }
  let a = M[0]; for (const m of M) if (m.sc > a.sc) a = m;
  let b = M[0], db = -1; for (const m of M) { let d = 0; for (const e of ext) if (m.J[e] && a.J[e]) d += Math.hypot(m.J[e][0] - a.J[e][0], m.J[e][1] - a.J[e][1], m.J[e][2] - a.J[e][2]); if (d > db) { db = d; b = m; } }
  // 3/4: girada 30°, 2,1 m = 60 px, los pies abajo (el más bajo de las dos), centrada en la cadera de la principal
  const ca = Math.cos(0.52), sa = Math.sin(0.52), pr = (p) => [p[0] * ca + p[2] * sa, p[1]];
  // (encuadre: la caja de las dos poses, con lugar para la cabeza; parado, 2,1 m = 60 px con los pies abajo)
  let u0 = 1e9, u1 = -1e9, piso = 1e9, techo = -1e9; for (const m of [a, b]) for (const p of m.J) if (p) { const [u, v] = pr(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); piso = Math.min(piso, v); techo = Math.max(techo, v + 0.2); }
  const k = Math.min(60 / 2.1, 56 / Math.max(0.3, techo - piso), 56 / Math.max(0.3, u1 - u0)), uc = Math.abs(u1 - u0) * k > 40 ? (u0 + u1) / 2 : 0;
  const enc = (J) => J.map((p) => { const [u, v] = p ? pr(p) : [0, 0]; const x = Math.max(0, Math.min(63, Math.round(32 + (u - uc) * k))), y = Math.max(0, Math.min(63, Math.round(61 - (v - piso) * k))); return EMO_B64[x] + EMO_B64[y]; }).join('');
  emoMiniPuntos(P, null, 0);
  return enc(a.J) + enc(b.J);
}
// el SVG de la miniatura (una pose principal y otra clarita atrás)
const EMO_HUESOS_MINI = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [1, 7], [7, 8], [8, 9], [0, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15]];
const EMO_COL = { baile: ['#8e44ad', '#d35400'], caminar: ['#2471a3', '#17a589'], gesto: ['#2e86c1', '#5dade2'], accion: ['#c0392b', '#e67e22'], pelea: ['#922b21', '#cb4335'], deporte: ['#1e8449', '#52be80'], acrobacia: ['#b9770e', '#f4d03f'], animal: ['#6e2c00', '#ca6f1e'], otro: ['#4d5656', '#839192'] };
function emoMiniSVG(s, cat) {
  if (!s || s.length < 64) return '';
  const pts = (o) => { const L = []; for (let i = 0; i < 16; i++) L.push([EMO_B64.indexOf(s[o + i * 2]), EMO_B64.indexOf(s[o + i * 2 + 1])]); return L; };
  const lin = (L, op, w) => EMO_HUESOS_MINI.map(([i, j]) => `<line x1="${L[i][0]}" y1="${L[i][1]}" x2="${L[j][0]}" y2="${L[j][1]}"/>`).join('') + `<circle cx="${L[3][0]}" cy="${L[3][1] - 2}" r="${4.6}" fill="#fff" fill-opacity="${op}" stroke="none"/>`;
  const [c1, c2] = EMO_COL[cat] || EMO_COL.otro, id = 'g' + (cat || 'o');
  return `<svg class="emoMini" viewBox="0 0 64 64"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="64" height="64" rx="9" fill="url(#${id})"/>`
    + `<g stroke="#fff" stroke-opacity=".32" stroke-width="3.2" stroke-linecap="round">${lin(pts(32), 0.32)}</g><g stroke="#fff" stroke-width="4" stroke-linecap="round">${lin(pts(0), 1)}</g></svg>`;
}
const EMO_ICO = { gesto: 'emote', clasico: 'emote', accion: 'salto', pelea: 'boom', deporte: 'meta', acrobacia: 'impulso', animal: 'dino', caminar: 'veloz', otro: 'animacion' };
const emoIcoCat = (c) => icoHTML('ico:' + (EMO_ICO[c] || 'musica'));
function emoTarjeta(e) {
  if (e.mio && !e.foto && !e.mini) { const C = emoClip(e.id); if (C) { try { e.mini = EMO.minis[e.id] || (EMO.minis[e.id] = emoMini(C)); } catch (er) {} } }
  const img = e.foto ? `<img src="${esc(e.foto)}" alt="">` : DATA.ico[e.ico] ? `<img src="${icono(e.ico)}" alt="" loading="lazy">` : e.mini ? emoMiniSVG(e.mini, e.cat) : `<div class="emoCatIco">${emoIcoCat(e.cat)}</div>`;
  const k = e.mio ? e.id.slice(2) : '', fav = EMO.fav.has(e.id);
  return `<div class="emoIt${e.mio ? ' mio' : ''}${e.cmu ? ' cmu' : ''}" data-emo="${esc(e.id)}">${img}<b dir="auto" title="${esc(e.n)}">${esc(e.n)}</b>${e.cmu ? `<small>${esc(T('emo.' + e.cat))} · ${Math.max(1, Math.round(e.dur))} s</small>` : ''}${e.mio ? `<small>${esc(e.local ? T('emo.hecho') : T('por') + ' ' + (e.autor || ''))}</small>
    <span class="emoMis"><button data-emed="${esc(k)}" title="${esc(T('emo.editar'))}">${glifo('lapiz')}</button><button data-emdel="${esc(k)}" title="${esc(T('quitar'))}">${glifo('basura')}</button></span>` : ''}<button class="emoEst${fav ? ' si' : ''}" data-emfav="${esc(e.id)}" title="${esc(T('emo.fav'))}">${glifo('estrella')}</button></div>`;
}
function emoDibujar() {
  const el = $('emoLista'); if (!el) return;
  const pan = $('emotes'), tabs = pan.querySelector('.emoTabs');
  if (tabs && !tabs.childElementCount) {
    tabs.innerHTML = EMO_CATS.map((c) => `<button data-emc="${c}">${esc(T('emo.' + c))}</button>`).join('');
    tabs.onclick = (ev) => { const b = ev.target.closest('[data-emc]'); if (!b) return; EMO.cat = b.dataset.emc; EMO.lim = 120; el.scrollTop = 0; emoDibujar(); };
    // el buscador (en todas las secciones menos la tienda, que busca en internet)
    const bus = document.createElement('div'); bus.className = 'emoBusca'; bus.innerHTML = `${glifo('buscar')}<input maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"><span class="emoCuenta"></span>`;
    tabs.parentNode.after(bus); const q = bus.querySelector('input');
    q.oninput = () => { EMO.q = q.value.trim().toLowerCase(); EMO.lim = 120; el.scrollTop = 0; emoDibujar(); }; q.onkeydown = (ev) => ev.stopPropagation();
    el.onclick = (ev) => {
      const fv = ev.target.closest('[data-emfav]'); if (fv) { ev.stopPropagation(); const id = fv.dataset.emfav; if (EMO.fav.has(id)) EMO.fav.delete(id); else EMO.fav.add(id); guardarLS('rb_emo_fav', [...EMO.fav]); fv.classList.toggle('si', EMO.fav.has(id)); if (EMO.cat === 'fav') emoDibujar(); return; }
      if (ev.target.closest('.emoMas')) { EMO.lim += 240; emoDibujar(); return; }
      const b = ev.target.closest('[data-emi]'); if (b) { ev.stopPropagation(); emoInstalar(b.dataset.emi); return; }
      const ed = ev.target.closest('[data-emed]'); if (ed) { ev.stopPropagation(); cerrarPaneles(); edaAbrir(ed.dataset.emed); return; }
      const del = ev.target.closest('[data-emdel]'); if (del) { ev.stopPropagation(); if (!confirm(T('quitar') + '?')) return; delete INST.anims[del.dataset.emdel]; emoOlvidar('u:' + del.dataset.emdel); guardarLS('rb_instalados', INST); emoDibujar(); return; }
      const x = ev.target.closest('[data-emo]'); if (!x) return; cerrarPaneles(); if (x.dataset.emo.startsWith('jnt:')) { juntosPedir(x.dataset.emo.slice(4)); return; } if (typeof emote === 'function') emote(x.dataset.emo);
    };
    const cr = $('bEmoCrear'); if (cr) cr.onclick = () => { cerrarPaneles(); if (typeof edaAbrir === 'function') edaAbrir(); };
  }
  if (tabs) tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.emc === EMO.cat));
  const cr = $('bEmoCrear'); if (cr) cr.innerHTML = `${glifo('lapiz')} ${esc(T('emo.crear'))}`;
  const cer = $('bEmoCerrar'); if (cer) cer.textContent = T('cerrar');
  const bus = pan.querySelector('.emoBusca'); if (bus) bus.style.display = EMO.cat === 'tienda' ? 'none' : '';
  if (EMO.cat === 'tienda') { emoTienda(el); return; }
  if (EMO.cat === 'juntos') {   // (de a dos: se le pide al que está adelante)
    el.innerHTML = `<div class="emoVacio" style="grid-column:1/-1">${esc(T('jnt.ayuda'))}</div>` + JUNTOS.map((J) => `<div class="emoIt" data-emo="jnt:${J.id}">${emoMiniSVG(CMU_I[J.a] && CMU_I[J.a][5], 'gesto') || `<div class="emoCatIco">${emoIcoCat('gesto')}</div>`}<b>${esc(T('jnt.' + J.id))}</b></div>`).join('');
    const c = pan.querySelector('.emoCuenta'); if (c) c.textContent = JUNTOS.length + ' ' + T('emo.n'); return;
  }
  const todos = emoLista(), por = new Map(todos.map((e) => [e.id, e])), q = EMO.q;
  let L = EMO.cat === 'fav' ? [...EMO.fav].map((id) => por.get(id)).filter(Boolean) : EMO.cat === 'rec' ? EMO.rec.map((id) => por.get(id)).filter(Boolean)
    : todos.filter((e) => EMO.cat === 'todos' || (EMO.cat === 'mio' ? e.mio : e.cat === EMO.cat && !(e.mio && EMO.cat === 'clasico')));
  if (q) L = L.filter((e) => e.n.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  const c = pan.querySelector('.emoCuenta'); if (c) c.textContent = L.length.toLocaleString(document.documentElement.lang || undefined) + ' ' + T('emo.n');
  // de a tandas (miles de tarjetas juntas traban el celular)
  el.innerHTML = L.slice(0, EMO.lim).map(emoTarjeta).join('') + (L.length > EMO.lim ? `<button class="boton emoMas">${esc(T('emo.mas'))} (${L.length - EMO.lim})</button>` : '')
    || `<div class="emoVacio">${esc(T(EMO.cat === 'mio' ? 'emo.sinMios' : EMO.cat === 'fav' ? 'emo.sinFav' : 'sinRes'))}</div>`;
}
// la tienda adentro del juego: las animaciones que publicó la gente (se instalan y quedan en "Míos")
function emoTienda(el) {
  const S = EMO.ti;
  if (!el.querySelector('.emoBus')) {
    el.innerHTML = `<div class="emoBus">${glifo('buscar')}<input maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"></div><div class="emoTi"></div>`;
    const q = el.querySelector('input'); q.value = S.q; q.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { S.q = q.value.trim(); emoTiendaCargar(); } };
    if (!S.items.length && !S.cargando) emoTiendaCargar();
  }
  const G = el.querySelector('.emoTi'), inst = (typeof INST !== 'undefined' && INST.anims) || {};
  G.innerHTML = S.cargando ? `<div class="emoVacio">${esc(T('cargando'))}</div>` : S.error ? `<div class="emoVacio">${esc(T('errRed'))}</div>` : !S.items.length ? `<div class="emoVacio">${esc(T('sinRes'))}</div>`
    : S.items.map((it) => `<div class="emoIt" ${inst[it.id] ? `data-emo="u:${esc(it.id)}"` : ''}>${it.icono ? `<img src="${esc(it.icono)}" alt="">` : emoIcoCat(it.base)}<b dir="auto">${esc(it.nombre)}</b><small dir="auto">${esc(T('por') + ' ' + it.autor)} · ${glifo('bajar')}${it.descargas}</small>
      ${inst[it.id] ? `<i class="emoYa">${glifo('si')}</i>` : `<button class="emoInst" data-emi="${esc(it.id)}">${glifo('bajar')} ${esc(T('instalar'))}</button>`}</div>`).join('');
}
function emoTiendaCargar() {
  const S = EMO.ti, n = ++S.n; S.cargando = true; S.error = false; emoDibujar();
  fetch(`${TIENDA_URL}lista?tipo=anim&q=${encodeURIComponent(S.q)}&orden=pop&p=0`).then((r) => r.json()).then((d) => { if (n !== S.n) return; S.items = (d.items || []).filter((x) => /^[a-z0-9]{8}$/.test(x.id)); S.cargando = false; if (EMO.cat === 'tienda') emoDibujar(); })
    .catch(() => { if (n !== S.n) return; S.cargando = false; S.error = true; if (EMO.cat === 'tienda') emoDibujar(); });
}
// bajar una animación de la tienda (validada) y dejarla instalada
async function emoInstalar(id) {
  try {
    const v = validarRB(await (await fetch(TIENDA_URL + 'item/' + id)).json());
    if (typeof v === 'string' || v.formato !== 'rezobox-anim') { aviso(T('errFormato'), 2); return null; }
    v.id = id; v.remoto = true; INST.anims[id] = v; guardarLS('rb_instalados', INST); emoOlvidar('u:' + id);
    aviso(T('instalado') + ': ' + v.nombre, 2); if (UI.abierto === 'emotes') emoDibujar(); return v;
  } catch (e) { aviso(T('errRed'), 2); return null; }
}
// ---------------- en la sala: los emotes hechos por la gente viajan como datos ----------------
// Los de la tienda se bajan de ahí; los que hiciste vos y no publicaste se los pasás al que los pide (una vez).
const EMO_ID = /^u:[a-z0-9-]{3,30}$/;
function emoPedir(id, de) {
  const k = id.slice(2); if (emoClip(id) || EMO.pedidos[k] > TIEMPO.t) return;
  EMO.pedidos[k] = TIEMPO.t + 20;
  if (/^[a-z0-9]{8}$/.test(k)) fetch(TIENDA_URL + 'item/' + k).then((r) => r.json()).then((d) => { const v = validarRB(d); if (typeof v === 'object' && v.formato === 'rezobox-anim') { EMO.remotos[k] = v; emoOlvidar(id); } }).catch(() => {});
  else if (typeof publicar === 'function') publicar('a', { k: 'animq', a: k, to: de });
}
function emoRed(d) {
  if (d.k === 'animq' && d.to === RED.ID && typeof d.a === 'string') {
    const v = INST.anims[d.a]; if (!v || !v.clip) return;
    const js = JSON.stringify(v.clip); if (js.length > 200000) return; // (las muy largas sólo por la tienda)
    publicar('a', { k: 'anim', a: d.a, d: { nombre: v.nombre, cat: v.cat, clip: v.clip } });
  } else if (d.k === 'anim' && typeof d.a === 'string' && /^[a-z0-9-]{3,30}$/.test(d.a) && d.d && !EMO.remotos[d.a]) {
    const v = validarRB(Object.assign({}, d.d, { formato: 'rezobox-anim', nombre: d.d.nombre || 'anim' }));
    if (typeof v === 'object') { EMO.remotos[d.a] = v; emoOlvidar('u:' + d.a); }
  }
}
