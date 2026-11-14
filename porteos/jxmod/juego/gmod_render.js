// ---------------- el dibujo 3D del Lua de los addons: render.*, cam.*, mesh.* (como en GMod) ----------------
// GMod deja que el Lua dibuje en el mundo en cada cuadro: rayos (render.DrawBeam y las tiras StartBeam/AddBeam/EndBeam),
// carteles que miran a la cámara (DrawSprite), cuadros (DrawQuad, DrawQuadEasy), líneas y cajas, mallas (mesh.Begin e
// IMesh) y 2D apoyado en un plano (cam.Start3D2D: pantallas, carteles, barras de vida). Todo lo que pide el Lua se graba y
// se dibuja después de lo transparente del juego, con el material que puso (textura y $additive/$translucent/$alphatest
// de su .vmt, o la imagen .png) y la matriz de modelo de cam.PushModelMatrix.
// También corre acá lo que GMod llama al dibujar: EFFECT:Render de los efectos vivos, ENT:Draw de cada entidad (su modelo
// sólo se ve si el Lua llama DrawModel, como en GMod), los ganchos PreDraw/PostDraw*Renderables y PostDrawEffects, los de
// la vista del arma (PreDrawViewModel, ViewModelDrawn, PostDrawViewModel), los modelos del cliente (ClientsideModel) y
// las estelas (util.SpriteTrail). Nada de esto es de un addon en particular: es la API de GMod.
const GR = { lista: 'mundo', L: { mundo: [], vista: [] }, vb: new Float32Array(9 * 6 * 2048), nv: 0, mat: null, matOver: null, mod: [1, 1, 1], blend: 1, ignZ: false, pila: [], beam: null, mesh: null,
  tex: {}, cs: new Set(), estelas: [], n2d: 0, t2d: [], c2: null, dm: false, entAct: null, prog: null, vao: null, buf: null, ms: 0 };
const GR2_LADO = 2048, GR2_K = 2;   // (el lienzo del 2D en 3D: 1024 px de GMod por lado, dibujados al doble)

// ---------------- materiales: textura + cómo se mezcla ----------------
// (las texturas del juego y de los addons están subidas dadas vuelta: v de GL = 1 − v de Source)
function gmrTexProc(tipo) {
  if (GR.tex[tipo]) return GR.tex[tipo];
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  if (tipo === 'brillo') { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  else if (tipo === 'rayo') { const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  else if (tipo === 'disco') { x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 31, 0, Math.PI * 2); x.fill(); }
  else { x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); }
  return (GR.tex[tipo] = gmrSubirLienzo(c, null));
}
function gmrSubirLienzo(c, tx) {
  const gl = R.gl; tx = tx || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const pot = !(c.width & (c.width - 1)) && !(c.height & (c.height - 1));
  if (pot || !R.gl1) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  const rep = pot || !R.gl1 ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rep);
  R.texAct = null; return tx;
}
// (el nombre dice qué es cuando el material no está en ningún lado: brillos, rayos o blanco)
function gmrPorNombre(k) {
  if (/smoke|dust|cloud|fog|blood/.test(k)) return { tex: () => gmrTexProc('brillo'), modo: 'blend' };
  if (/laser|beam|tracer|trail|physbeam|electric|lightning|bolt|cable|rope|line|tesla|plasma|energy/.test(k)) return { tex: () => gmrTexProc('rayo'), modo: 'add' };
  if (/^sprites?\/|glow|flare|light|spark|particle|fire|flame|muzzle|orb|ball|halo|shine|star|core|dot|ring|sun/.test(k)) return { tex: () => gmrTexProc('brillo'), modo: 'add' };
  return { tex: () => gmrTexProc('blanco'), modo: 'blend' };
}
function gmrMat(m) {
  if (!m || typeof m !== 'object') return GR.mBlanco || (GR.mBlanco = { tex: () => gmrTexProc('blanco'), modo: 'blend' });
  if (m.r3) return m.r3;
  const k = String(m.n || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^materials\//, '');
  if (k === '__color') return (m.r3 = { tex: () => gmrTexProc('blanco'), modo: 'blend' });
  if (/^pp\/|^effects\/(combine_binocoverlay|tp_eyefx|invuln_overlay)|screenspace|_rt_/.test(k)) return (m.r3 = { nada: true });   // (efectos de pantalla: no van en el mundo)
  // (los de refracción deforman lo de atrás; sin esa pasada se verían como una mancha blanca que tapa todo)
  if (/refract|dudv|strider_pinch|heatwave|heathaze|shockwave_warp/.test(k)) return (m.r3 = { nada: true });
  // una imagen (.png/.jpg): se sube cuando termina de leerse
  if (/\.(png|jpe?g)$/.test(k)) {
    const p = String(m.pngp || ''); const r = { modo: /alphatest/.test(p) ? 'cut' : 'blend', tex: () => { if (!r.gl && m.img) r.gl = gmrSubirLienzo(m.img, null); return r.gl || null; }, sinZ: /ignorez/.test(p) };
    return (m.r3 = r);
  }
  const base = k.replace(/\.(vmt|vtf)$/, ''), buscar = (p) => gmArchivo('materials/' + p.replace(/\.vmt$/, '') + '.vmt');
  let v = null; const vm = buscar(base);
  if (vm) { try { v = GMF.vmt(vm, buscar); } catch (e) { v = null; } }
  if (v && /refract/i.test(v.shader || '')) return (m.r3 = { nada: true });
  const rt = v && v.base ? v.base : base;
  let ti = gmExiste('materials/' + rt + '.vtf') ? gmTextura(rt) : gmTexDelJuego(rt);
  if (ti < 0 && v && v.base && gmExiste('materials/' + base + '.vtf')) ti = gmTextura(base);
  if (ti < 0) { if (v) { const pn = gmrPorNombre(rt); return (m.r3 = Object.assign(pn, gmrModoVmt(v, pn.modo))); } return (m.r3 = gmrPorNombre(k)); }
  const r = Object.assign({ tex: () => texGL(ti) }, v ? gmrModoVmt(v, 'op') : { modo: /^sprites?\//.test(k) ? 'add' : 'blend' });
  return (m.r3 = r);
}
function gmrModoVmt(v, def) {
  if (v.nodraw) return { nada: true };
  let modo = def;
  if (v.suma) modo = 'add'; else if (v.trans || v.alfa < 0.99) modo = 'blend'; else if (v.corte) modo = 'cut'; else if (/^sprite/.test(v.shader)) modo = 'add'; else modo = v.vcolor ? 'blend' : 'op';
  const c = v.color ? [v.color[0], v.color[1], v.color[2], v.alfa] : v.alfa < 0.99 ? [1, 1, 1, v.alfa] : null;
  return { modo, c, sinZ: false };
}

// ---------------- grabar triángulos ----------------
function gmrVtx(x, y, z, c, u, v) {
  if (GR.nv * 9 + 9 > GR.vb.length) { if (GR.vb.length >= 9 * 6 * 65536) return false; const n = new Float32Array(GR.vb.length * 2); n.set(GR.vb); GR.vb = n; }
  const o = GR.nv * 9, b = GR.vb; b[o] = x; b[o + 1] = y; b[o + 2] = z; b[o + 3] = c[0]; b[o + 4] = c[1]; b[o + 5] = c[2]; b[o + 6] = c[3]; b[o + 7] = u; b[o + 8] = v; GR.nv++;
  return true;
}
// empieza (o sigue) un tramo con el material de ahora
function gmrTramo() {
  const m = gmrMat(GR.mat); if (m.nada) return null;
  const L = GR.L[GR.lista], ult = L[L.length - 1], z = GR.ignZ || !!m.sinZ;
  if (ult && ult.m === m && ult.z === z && ult.o + ult.n === GR.nv) return ult;
  const t = { m, z, o: GR.nv, n: 0 }; L.push(t); return t;
}
const _gp = v3();
// un punto de Source (con la matriz de modelo) → juego
function gmrP(p, out) {
  let x = p.x, y = p.y, z = p.z; const M = GR.M;
  if (M) { const a = M; const X = a[0] * x + a[1] * y + a[2] * z + a[3], Y = a[4] * x + a[5] * y + a[6] * z + a[7], Z = a[8] * x + a[9] * y + a[10] * z + a[11]; x = X; y = Y; z = Z; }
  out = out || v3(); out.set(y * GS, z * GS + GMA.oy, x * GS); return out;   // (una posición: con el cero de Source del mapa, gmod_api.js)
}
function gmrCol(c, m) {
  let r = 1, g = 1, b = 1, a = 1;
  if (c instanceof LuaTable) { r = (+c.get('r') || 0) / 255; g = (+c.get('g') || 0) / 255; b = (+c.get('b') || 0) / 255; const al = c.get('a'); a = al === undefined ? 1 : (+al || 0) / 255; }
  if (m && m.c) { r *= m.c[0]; g *= m.c[1]; b *= m.c[2]; a *= m.c[3] ?? 1; }
  return [r, g, b, Math.max(0, Math.min(1, a))];
}
// un cuadrilátero (a b c d en orden) con sus coordenadas de textura (de Source: v hacia abajo)
function gmrQuad(a, b, c, d, col, uv) {
  const t = gmrTramo(); if (!t) return;
  const U = uv || [0, 0, 1, 0, 1, 1, 0, 1], P = [a, b, c, d];
  for (const i of [0, 1, 2, 0, 2, 3]) { const p = P[i]; if (!gmrVtx(p.x, p.y, p.z, col, U[i * 2], 1 - U[i * 2 + 1])) return; t.n++; }
}
function gmrTri(a, b, c, ca, cb, cc, ua, ub, uc) {
  const t = gmrTramo(); if (!t) return;
  if (!gmrVtx(a.x, a.y, a.z, ca, ua[0], 1 - ua[1]) || !gmrVtx(b.x, b.y, b.z, cb, ub[0], 1 - ub[1]) || !gmrVtx(c.x, c.y, c.z, cc, uc[0], 1 - uc[1])) return; t.n += 3;
}
// rayo de a a b (juego, metros) de ancho w: la U cruza el ancho, la V corre a lo largo (como los de Source)
function gmrRayo(a, b, w, t0, t1, ca) {
  const d = vsub(b, a); if (d.len() < 1e-6) return;
  const lado = (p) => { const n = vcross(d, vsub(p, CAM.pos)); const l = n.len(); return l < 1e-9 ? v3(0, w / 2, 0) : vscale(n, w / 2 / l); };
  const la = lado(a), lb = lado(b);
  gmrQuad(vadd(a, la), vsub(a, la), vsub(b, lb), vadd(b, lb), ca, [0, t0, 1, t0, 1, t1, 0, t1]);
}
// una tira (StartBeam/AddBeam y las estelas): puntos {p (juego), w (m), t (textura), c}
function gmrTira(P) {
  if (P.length < 2) return;
  const lados = P.map((q, i) => { const d = vsub(P[Math.min(P.length - 1, i + 1)].p, P[Math.max(0, i - 1)].p), n = vcross(d, vsub(q.p, CAM.pos)), l = n.len(); return l < 1e-9 ? v3() : vscale(n, q.w / 2 / l); });
  for (let i = 0; i + 1 < P.length; i++) {
    const A = P[i], B = P[i + 1], la = lados[i], lb = lados[i + 1];
    const t = gmrTramo(); if (!t) return;
    const V = [[vadd(A.p, la), A.c, 0, A.t], [vsub(A.p, la), A.c, 1, A.t], [vsub(B.p, lb), B.c, 1, B.t], [vadd(B.p, lb), B.c, 0, B.t]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const x = V[k]; if (!gmrVtx(x[0].x, x[0].y, x[0].z, x[1], x[2], 1 - x[3])) return; t.n++; }
  }
}
// ejes de un Angle de Source (adelante, derecha, arriba) en el juego
function gmrEjes(a) { const m = angMat(a); return [dG(new LVec(...m[0])), dG(new LVec(-m[1][0], -m[1][1], -m[1][2])), dG(new LVec(...m[2]))]; }

// ---------------- 2D sobre un plano (cam.Start3D2D) ----------------
// el 2D (surface/draw) va a un lienzo aparte mientras dura; se mide lo que se dibujó y ese pedazo se sube como textura
function gmr2D() {
  if (GR.c2) return;
  const c = document.createElement('canvas'); c.width = c.height = GR2_LADO; const g = c.getContext('2d'); GR.c2 = c; GR.g2 = g; GR.c2b = document.createElement('canvas');
  const bb = (GR.bb = [1e9, 1e9, -1e9, -1e9]);
  const pt = (x, y) => { const m = g.getTransform(), X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f; if (X < bb[0]) bb[0] = X; if (Y < bb[1]) bb[1] = Y; if (X > bb[2]) bb[2] = X; if (Y > bb[3]) bb[3] = Y; };
  const caja = (x, y, w, h) => { x = +x || 0; y = +y || 0; w = +w || 0; h = +h || 0; pt(x, y); pt(x + w, y); pt(x, y + h); pt(x + w, y + h); };
  const alto = () => Math.round(parseFloat((g.font.match(/([\d.]+)px/) || [0, 13])[1]) * 1.2) || 13;
  // (firma de lo que se dibuja en cada bloque: si en el cuadro siguiente sale igual, la textura ya subida sirve y no se
  // vuelve a copiar ni a subir a la placa; las pantallas de las armas, como el GPhone, cambian poco)
  const ids = new WeakMap(); let nid = 0;
  const mez = (x) => { GR.h2 = Math.imul(GR.h2 ^ x, 16777619) >>> 0; };
  const firmar = (k, a) => {
    mez(k.length); for (let i = 0; i < k.length; i++) mez(k.charCodeAt(i));
    for (const x of a) {
      if (typeof x === 'number') mez((x * 1024) | 0);
      else if (typeof x === 'string') { mez(x.length); for (let i = 0; i < x.length; i++) mez(x.charCodeAt(i)); }
      else if (x && typeof x === 'object') { if (typeof HTMLVideoElement !== 'undefined' && x instanceof HTMLVideoElement) GR.dyn2 = true; let id = ids.get(x); if (id === undefined) { id = ++nid; ids.set(x, id); } mez(id); }
      else mez(x ? 1 : 0);
    }
  };
  GR.firmar = firmar;
  GR.p2 = new Proxy(g, {
    get(t, k) {
      const v = t[k]; if (typeof v !== 'function') return v;
      if (typeof k !== 'string') return v.bind(t);
      const f = gmr2Dmetodo(t, k, v, caja, pt, alto);
      return (...a) => { firmar(k, a); return f(...a); };
    },
    set(t, k, v) { firmar(String(k), [v]); t[k] = v; return true; },
  });
}
function gmr2Dmetodo(t, k, v, caja, pt, alto) {
      switch (k) {
        case 'fillRect': case 'strokeRect': case 'rect': case 'roundRect': return (...a) => { caja(a[0], a[1], a[2], a[3]); return v.apply(t, a); };
        case 'drawImage': return (...a) => { if (a.length >= 9) caja(a[5], a[6], a[7], a[8]); else if (a.length >= 5) caja(a[1], a[2], a[3], a[4]); else caja(a[1], a[2], a[0].width, a[0].height); return v.apply(t, a); };
        case 'fillText': case 'strokeText': return (s, x, y, ...r) => { const w = gmAncho(t, t.font, String(s)), h = alto(), al = t.textAlign, bl = t.textBaseline; const x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x, y0 = bl === 'top' ? y : bl === 'middle' ? y - h / 2 : bl === 'bottom' ? y - h : y - h * 0.85; caja(x0 - 2, y0 - 2, w + 4, h * 1.3 + 4); return v.call(t, s, x, y, ...r); };
        case 'moveTo': case 'lineTo': return (x, y) => { pt(x, y); return v.call(t, x, y); };
        case 'arc': case 'ellipse': return (x, y, r, ...q) => { caja(x - r, y - r, 2 * r, 2 * r); return v.call(t, x, y, r, ...q); };
        default: return v.bind(t);
      }
}
function gmrEmpezar3D2D(pos, ang, esc) {
  if (!(pos instanceof LVec) || !(ang instanceof LAng) || GR.d2) return;
  gmr2D(); const g = GR.g2, bb = GR.bb;
  if (GR.sucio2) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(Math.max(0, GR.sucio2[0] - 2), Math.max(0, GR.sucio2[1] - 2), GR.sucio2[2] - GR.sucio2[0] + 4, GR.sucio2[3] - GR.sucio2[1] + 4); GR.sucio2 = null; }
  bb[0] = bb[1] = 1e9; bb[2] = bb[3] = -1e9;
  g.setTransform(GR2_K, 0, 0, GR2_K, GR2_LADO / 2, GR2_LADO / 2); g.globalAlpha = 1;
  GR.d2 = { pos: gmrP(pos), ej: gmrEjes(ang), s: (+esc || 1) * GS, M: GR.M }; GMA.lienzo = GR.p2; GR.h2 = 2166136261; GR.dyn2 = false;
  // (lo que quedó puesto del bloque anterior, color, letra, grosor, también cuenta: dibuja distinto aunque las llamadas sean iguales)
  GR.firmar('estado', [g.fillStyle, g.strokeStyle, g.font, g.lineWidth, g.textAlign, g.textBaseline, g.globalCompositeOperation]);
}
function gmrTerminar3D2D() {
  const D = GR.d2; if (!D) return; GR.d2 = null; GMA.lienzo = null;
  const g = GR.g2, bb = GR.bb; g.setTransform(1, 0, 0, 1, 0, 0);
  const x0 = Math.max(0, Math.floor(bb[0])), y0 = Math.max(0, Math.floor(bb[1])), x1 = Math.min(GR2_LADO, Math.ceil(bb[2])), y1 = Math.min(GR2_LADO, Math.ceil(bb[3]));
  if (x1 - x0 < 1 || y1 - y0 < 1 || GR.n2d >= 16) return;
  GR.sucio2 = [x0, y0, x1, y1];
  const k = GR.n2d++, firma = GR.h2 + ':' + x0 + ',' + y0 + ',' + x1 + ',' + y1; GR.f2d = GR.f2d || [];
  let tx = GR.t2d[k];
  if (GR.dyn2 || !tx || GR.f2d[k] !== firma) {
    const c = GR.c2b; c.width = x1 - x0; c.height = y1 - y0; c.getContext('2d').drawImage(GR.c2, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    tx = GR.t2d[k] = gmrSubirLienzo(c, GR.t2d[k]); GR.f2d[k] = firma;
  }
  // de píxeles del lienzo a GMod (x a lo ancho del plano, y hacia abajo) y al mundo
  const P = (X, Y) => { const x = (X - GR2_LADO / 2) / GR2_K, y = (Y - GR2_LADO / 2) / GR2_K; return vadd(D.pos, vadd(vscale(D.ej[0], x * D.s), vscale(D.ej[1], y * D.s))); };
  const m0 = GR.mat; GR.mat = { r3: { tex: () => tx, modo: 'blend' } };
  gmrQuad(P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), [1, 1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
  GR.mat = m0;
}

// ---------------- matrices (VMatrix) ----------------
function gmrMatriz(m) { return { m: m ? m.slice() : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], __mt: GMA.mtMatriz }; }
const gmrMul = (a, b) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]; o[i * 4 + j] = s; } return o; };
function gmrRot(a) { const m = angMat(a); return [m[0][0], m[1][0], m[2][0], 0, m[0][1], m[1][1], m[2][1], 0, m[0][2], m[1][2], m[2][2], 0, 0, 0, 0, 1]; }   // (columnas: adelante, izquierda, arriba)
function gmrApiMatriz(R, G, def, num) {
  const M = (GMA.mtMatriz = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'VMatrix');
  const nv = (x, y, z) => GMA.nv(x, y, z);
  Object.entries({
    Identity: (o) => { o.m = gmrMatriz().m; }, IsIdentity: (o) => o.m.every((v, i) => v === (i % 5 === 0 ? 1 : 0)), IsZero: (o) => o.m.every((v) => v === 0), Zero: (o) => { o.m.fill(0); },
    Translate: (o, v) => { if (v instanceof LVec) o.m = gmrMul(o.m, [1, 0, 0, v.x, 0, 1, 0, v.y, 0, 0, 1, v.z, 0, 0, 0, 1]); },
    Rotate: (o, a) => { if (a instanceof LAng) o.m = gmrMul(o.m, gmrRot(a)); },
    Scale: (o, v) => { if (v instanceof LVec) o.m = gmrMul(o.m, [v.x, 0, 0, 0, 0, v.y, 0, 0, 0, 0, v.z, 0, 0, 0, 0, 1]); },
    ScaleTranslation: (o, k) => { o.m[3] *= k; o.m[7] *= k; o.m[11] *= k; },
    SetTranslation: (o, v) => { if (v instanceof LVec) { o.m[3] = v.x; o.m[7] = v.y; o.m[11] = v.z; } }, GetTranslation: (o) => nv(o.m[3], o.m[7], o.m[11]),
    SetAngles: (o, a) => { if (!(a instanceof LAng)) return; const r = gmrRot(a), s = [Math.hypot(o.m[0], o.m[4], o.m[8]) || 1, Math.hypot(o.m[1], o.m[5], o.m[9]) || 1, Math.hypot(o.m[2], o.m[6], o.m[10]) || 1]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.m[i * 4 + j] = r[i * 4 + j] * s[j]; },
    GetAngles: (o) => { const s = [Math.hypot(o.m[0], o.m[4], o.m[8]) || 1, Math.hypot(o.m[1], o.m[5], o.m[9]) || 1, Math.hypot(o.m[2], o.m[6], o.m[10]) || 1]; const a = matAng([o.m[0] / s[0], o.m[4] / s[0], o.m[8] / s[0]], [o.m[1] / s[1], o.m[5] / s[1], o.m[9] / s[1]], [o.m[2] / s[2], o.m[6] / s[2], o.m[10] / s[2]]); a.__mt = GMA.mtAng; return a; },
    SetScale: (o, v) => { if (!(v instanceof LVec)) return; const k = [v.x, v.y, v.z]; for (let j = 0; j < 3; j++) { const l = Math.hypot(o.m[j], o.m[4 + j], o.m[8 + j]) || 1; for (let i = 0; i < 3; i++) o.m[i * 4 + j] *= k[j] / l; } },
    GetScale: (o) => nv(Math.hypot(o.m[0], o.m[4], o.m[8]), Math.hypot(o.m[1], o.m[5], o.m[9]), Math.hypot(o.m[2], o.m[6], o.m[10])),
    GetForward: (o) => nv(o.m[0], o.m[4], o.m[8]), GetRight: (o) => nv(-o.m[1], -o.m[5], -o.m[9]), GetUp: (o) => nv(o.m[2], o.m[6], o.m[10]),
    SetForward: (o, v) => { o.m[0] = v.x; o.m[4] = v.y; o.m[8] = v.z; }, SetRight: (o, v) => { o.m[1] = -v.x; o.m[5] = -v.y; o.m[9] = -v.z; }, SetUp: (o, v) => { o.m[2] = v.x; o.m[6] = v.y; o.m[10] = v.z; },
    GetField: (o, r, c) => o.m[(num(r, 1) - 1) * 4 + num(c, 1) - 1], SetField: (o, r, c, v) => { o.m[(num(r, 1) - 1) * 4 + num(c, 1) - 1] = num(v, 0); },
    ToTable: (o) => R.tab([0, 1, 2, 3].map((i) => R.tab(o.m.slice(i * 4, i * 4 + 4)))), Set: (o, b) => { if (b && b.m) o.m = b.m.slice(); },
    SetUnpacked: (o, ...v) => { for (let i = 0; i < 16; i++) o.m[i] = num(v[i], 0); }, Unpack: (o) => o.m.slice(),
    Invert: (o) => { const r = gmrInv(o.m); if (r) o.m = r; return !!r; }, GetInverse: (o) => { const r = gmrInv(o.m); return r ? gmrMatriz(r) : undefined; },
    InvertTR: (o) => { const r = gmrInv(o.m); if (r) o.m = r; }, GetInverseTR: (o) => gmrMatriz(gmrInv(o.m) || o.m), GetTransposed: (o) => { const t = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) t[i * 4 + j] = o.m[j * 4 + i]; return gmrMatriz(t); },
  }).forEach(([k, f]) => I.set(k, f));
  M.set('__mul', (a, b) => { if (b && b.m) return gmrMatriz(gmrMul(a.m, b.m)); if (b instanceof LVec) { const m = a.m; return nv(m[0] * b.x + m[1] * b.y + m[2] * b.z + m[3], m[4] * b.x + m[5] * b.y + m[6] * b.z + m[7], m[8] * b.x + m[9] * b.y + m[10] * b.z + m[11]); } return a; });
  M.set('__add', (a, b) => gmrMatriz(a.m.map((v, i) => v + b.m[i]))); M.set('__sub', (a, b) => gmrMatriz(a.m.map((v, i) => v - b.m[i]))); M.set('__eq', (a, b) => !!(a.m && b.m && a.m.every((v, i) => v === b.m[i])));
  M.set('__tostring', (a) => a.m.map((v) => v.toFixed(4)).join(' '));
  def(G, 'Matrix', (t) => { if (t instanceof LuaTable) { const m = []; for (let i = 1; i <= 4; i++) { const f = t.get(i); for (let j = 1; j <= 4; j++) m.push(f instanceof LuaTable ? num(f.get(j), 0) : 0); } return gmrMatriz(m); } return gmrMatriz(); });
}
function gmrInv(m) {
  const a = m.slice(), inv = gmrMatriz().m;
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(a[r * 4 + c]) > Math.abs(a[p * 4 + c])) p = r;
    if (Math.abs(a[p * 4 + c]) < 1e-12) return null;
    for (let k = 0; k < 4; k++) { [a[c * 4 + k], a[p * 4 + k]] = [a[p * 4 + k], a[c * 4 + k]]; [inv[c * 4 + k], inv[p * 4 + k]] = [inv[p * 4 + k], inv[c * 4 + k]]; }
    const d = a[c * 4 + c]; for (let k = 0; k < 4; k++) { a[c * 4 + k] /= d; inv[c * 4 + k] /= d; }
    for (let r = 0; r < 4; r++) if (r !== c) { const f = a[r * 4 + c]; for (let k = 0; k < 4; k++) { a[r * 4 + k] -= f * a[c * 4 + k]; inv[r * 4 + k] -= f * inv[c * 4 + k]; } }
  }
  return inv;
}

// ---------------- la API: render, cam, mesh, Mesh(), ClientsideModel, SpriteTrail ----------------
function gmrApi(R, G, def, lib, num) {
  const render = lib('render'), cam = lib('cam'), mesh = lib('mesh'), util = lib('util');
  const V = (p) => (p instanceof LVec ? gmrP(p) : null);
  gmrApiMatriz(R, G, def, num); gmrApiParticulas(R, G, def, num);
  for (const [k, v] of Object.entries({ MATERIAL_POINTS: 0, MATERIAL_LINES: 1, MATERIAL_TRIANGLES: 2, MATERIAL_TRIANGLE_STRIP: 3, MATERIAL_LINE_STRIP: 4, MATERIAL_LINE_LOOP: 5, MATERIAL_POLYGON: 6, MATERIAL_QUADS: 7 })) G.set(k, v);
  GR.colorMat = gmaMaterial('__color');
  // material, color y mezcla
  def(render, 'SetMaterial', (m) => { GR.mat = m && typeof m === 'object' ? m : null; });
  def(render, 'GetMaterial', () => GR.mat || undefined);
  def(render, 'SetColorMaterial', () => { GR.mat = GR.colorMat; }); def(render, 'SetColorMaterialIgnoreZ', () => { GR.mat = GR.colorMat; GR.ignZ = true; });
  def(render, 'MaterialOverride', (m) => { GR.matOver = m && typeof m === 'object' ? m : null; }); def(render, 'ModelMaterialOverride', (m) => { GR.matOver = m && typeof m === 'object' ? m : null; }); def(render, 'BrushMaterialOverride', () => {}); def(render, 'WorldMaterialOverride', () => {});
  def(render, 'SetColorModulation', (r, g, b) => { GR.mod = [num(r, 1), num(g, 1), num(b, 1)]; }); def(render, 'GetColorModulation', () => GR.mod.slice());
  def(render, 'SetBlend', (a) => { GR.blend = num(a, 1); }); def(render, 'GetBlend', () => GR.blend);
  for (const n of ['SuppressEngineLighting', 'SetLightingOrigin', 'ResetModelLighting', 'SetModelLighting', 'SetLightingMode', 'SetAmbientLight', 'SetLocalModelLights', 'SetShadowsDisabled', 'SetShadowColor', 'SetShadowDirection', 'SetShadowDistance', 'EnableClipping', 'PushCustomClipPlane', 'PopCustomClipPlane',
    'OverrideDepthEnable', 'OverrideBlend', 'OverrideBlendFunc', 'OverrideAlphaWriteEnable', 'OverrideColorWriteEnable', 'CullMode', 'SetWriteDepthToDestAlpha', 'ClearDepth', 'Clear', 'ClearStencil', 'ClearBuffersObeyStencil', 'ClearStencilBufferRectangle', 'SetStencilEnable', 'SetStencilWriteMask', 'SetStencilTestMask', 'SetStencilReferenceValue',
    'SetStencilCompareFunction', 'SetStencilPassOperation', 'SetStencilFailOperation', 'SetStencilZFailOperation', 'SetRenderTarget', 'SetRenderTargetEx', 'PushRenderTarget', 'PopRenderTarget', 'CopyRenderTargetToTexture', 'CopyTexture', 'UpdateScreenEffectTexture', 'UpdateRefractTexture', 'UpdatePowerOfTwoTexture', 'UpdateFullScreenDepthTexture',
    'DrawScreenQuad', 'DrawScreenQuadEx', 'DrawTextureToScreen', 'DrawTextureToScreenRect', 'SetViewPort', 'RenderView', 'Spin', 'FogMode', 'FogStart', 'FogEnd', 'FogMaxDensity', 'FogColor', 'SetFogZ', 'DepthRange', 'SetGoalToneMappingScale', 'SetToneMappingScaleLinear', 'RedownloadAllLightmaps', 'BlurRenderTarget', 'PushFilterMag', 'PushFilterMin', 'PopFilterMag', 'PopFilterMin',
    'StartBeam2', 'TurnOnToneMapping', 'PerformFullScreenStencilOperation', 'SetScissorRect', 'PushFlashlightMode', 'PopFlashlightMode', 'RenderFlashlights', 'DrawBubbles', 'MaxTextureWidth', 'OverrideDepthEnable', 'SetMaterialOverride']) if (!['MaxTextureWidth'].includes(n)) def(render, n, () => {});
  def(render, 'GetLightColor', () => GMA.nv(1, 1, 1)); def(render, 'ComputeLighting', () => GMA.nv(1, 1, 1)); def(render, 'ComputeDynamicLighting', () => GMA.nv(0, 0, 0)); def(render, 'GetAmbientLightColor', () => GMA.nv(0.35, 0.35, 0.35)); def(render, 'GetToneMappingScaleLinear', () => GMA.nv(1, 1, 1));
  def(render, 'GetSurfaceColor', () => GMA.nv(0.6, 0.6, 0.6)); def(render, 'GetFogMode', () => 0); def(render, 'GetFogDistances', () => [0, 0, 0]); def(render, 'GetFogColor', () => [0, 0, 0]); def(render, 'GetDXLevel', () => (typeof gmrtSM3 === 'function' && !gmrtSM3() ? 90 : 95)); def(render, 'SupportsHDR', () => true); def(render, 'SupportsPixelShaders_1_4', () => true); def(render, 'SupportsPixelShaders_2_0', () => true); def(render, 'SupportsVertexShaders_2_0', () => true);
  def(render, 'GetRenderTarget', () => undefined); def(render, 'GetScreenEffectTexture', () => undefined); def(render, 'GetMorphTex0', () => undefined); def(render, 'GetResolvedFullFrameDepth', () => undefined); def(render, 'GetPowerOfTwoTexture', () => undefined); def(render, 'GetRefractTexture', () => undefined); def(render, 'GetSuperFPTex', () => undefined);
  def(render, 'MaxTextureWidth', () => 4096); def(render, 'MaxTextureHeight', () => 4096); def(render, 'IsTakingScreenshot', () => false); def(render, 'Capture', () => ''); def(render, 'CapturePixels', () => {}); def(render, 'ReadPixel', () => [0, 0, 0, 255]); def(render, 'GetViewSetup', () => gmrVista()); def(render, 'GetHDREnabled', () => true);
  // primitivas
  def(render, 'DrawBeam', (a, b, w, t0, t1, c) => { const A = V(a), B = V(b); if (!A || !B) return; const col = gmrCol(c, gmrMat(GR.mat)); gmrRayo(A, B, num(w, 1) * GS, num(t0, 0), num(t1, 1), col); });
  def(render, 'StartBeam', () => { GR.beam = []; });
  def(render, 'AddBeam', (p, w, t, c) => { const P = V(p); if (!P || !GR.beam) return; GR.beam.push({ p: P, w: num(w, 1) * GS, t: num(t, 0), c: gmrCol(c, gmrMat(GR.mat)) }); });
  def(render, 'EndBeam', () => { if (GR.beam) gmrTira(GR.beam); GR.beam = null; });
  def(render, 'DrawSprite', (p, w, h, c) => { const P = V(p); if (!P) return; const x = vscale(CAM.der, num(w, 8) * GS / 2), y = vscale(CAM.arr, num(h, 8) * GS / 2), col = gmrCol(c, gmrMat(GR.mat));
    gmrQuad(vadd(vsub(P, x), y), vadd(vadd(P, x), y), vsub(vadd(P, x), y), vsub(vsub(P, x), y), col); });
  def(render, 'DrawQuadEasy', (p, n, w, h, c, rot) => { const P = V(p); if (!P || !(n instanceof LVec)) return; const a = dirAng(n); a.r = 180 - num(rot, 0); const [, Rt, U] = gmrEjes(a);
    // (GMod: el ángulo de la normal con el giro; con giro 0 la imagen queda dada vuelta, y los addons ponen 180 para verla
    // derecha, como el Walter, que se dibuja así y en GMod se ve parado)
    const r = vscale(Rt, num(w, 8) * GS / 2), u = vscale(U, num(h, 8) * GS / 2), col = gmrCol(c, gmrMat(GR.mat));
    gmrQuad(vadd(vadd(P, r), u), vadd(vsub(P, r), u), vsub(vsub(P, r), u), vsub(vadd(P, r), u), col); });
  def(render, 'DrawQuad', (a, b, c, d, col) => { const A = V(a), B = V(b), C = V(c), D = V(d); if (A && B && C && D) gmrQuad(A, B, C, D, gmrCol(col, gmrMat(GR.mat))); });
  const linea = (a, b, c, z) => { const A = V(a), B = V(b); if (!A || !B) return; const m0 = GR.mat, i0 = GR.ignZ; GR.mat = GR.colorMat; GR.ignZ = GR.ignZ || z === false; gmrRayo(A, B, Math.max(0.006, vsub(A, CAM.pos).len() * 0.0025), 0, 1, gmrCol(c)); GR.mat = m0; GR.ignZ = i0; };
  def(render, 'DrawLine', (a, b, c, z) => linea(a, b, c, z));
  const cajaPts = (p, a, mn, mx) => { if (!(p instanceof LVec)) return null; const m = angMat(a instanceof LAng ? a : new LAng()), P = []; for (const x of [mn.x, mx.x]) for (const y of [mn.y, mx.y]) for (const z of [mn.z, mx.z]) P.push(new LVec(p.x + m[0][0] * x + m[1][0] * y + m[2][0] * z, p.y + m[0][1] * x + m[1][1] * y + m[2][1] * z, p.z + m[0][2] * x + m[1][2] * y + m[2][2] * z)); return P; };
  def(render, 'DrawWireframeBox', (p, a, mn, mx, c, z) => { const P = cajaPts(p, a, mn || new LVec(), mx || new LVec()); if (!P) return; for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) linea(P[i], P[j], c, z); });
  def(render, 'DrawBox', (p, a, mn, mx, c) => { const P = cajaPts(p, a, mn || new LVec(), mx || new LVec()); if (!P) return; const W = P.map((x) => V(x)), col = gmrCol(c, gmrMat(GR.mat)); for (const f of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) gmrQuad(W[f[0]], W[f[1]], W[f[2]], W[f[3]], col); });
  const esfera = (p, r, c, solida) => { const P = V(p); if (!P) return; const s = Math.abs(num(r, 8)) * GS, col = gmrCol(c, solida ? gmrMat(GR.mat) : null); const m0 = GR.mat; if (!solida) GR.mat = GR.colorMat;
    if (solida) { const x = vscale(CAM.der, s), y = vscale(CAM.arr, s); const mm = GR.mat; GR.mat = { r3: { tex: () => gmrTexProc('disco'), modo: col[3] < 0.99 || gmrMat(mm).modo !== 'op' ? 'blend' : 'cut' } }; gmrQuad(vadd(vsub(P, x), y), vadd(vadd(P, x), y), vsub(vadd(P, x), y), vsub(vsub(P, x), y), col); GR.mat = mm; }
    else for (let k = 0; k < 16; k++) { const a0 = k / 16 * Math.PI * 2, a1 = (k + 1) / 16 * Math.PI * 2; for (const [ex, ey] of [[CAM.der, CAM.arr], [CAM.der, CAM.fwd]]) gmrRayo(vadd(P, vadd(vscale(ex, Math.cos(a0) * s), vscale(ey, Math.sin(a0) * s))), vadd(P, vadd(vscale(ex, Math.cos(a1) * s), vscale(ey, Math.sin(a1) * s))), Math.max(0.006, vsub(P, CAM.pos).len() * 0.0025), 0, 1, col); }
    GR.mat = m0; };
  def(render, 'DrawSphere', (p, r, a, b, c) => esfera(p, r, c, true)); def(render, 'DrawWireframeSphere', (p, r, a, b, c) => esfera(p, r, c, false));
  // cam
  def(cam, 'Start3D2D', (p, a, s) => gmrEmpezar3D2D(p, a, s)); def(cam, 'End3D2D', () => gmrTerminar3D2D());
  def(cam, 'IgnoreZ', (b) => { GR.ignZ = !!b; });
  def(cam, 'PushModelMatrix', (m, mult) => { GR.pila.push(GR.M); if (!m || !m.m) return; GR.M = mult && GR.M ? gmrMul(GR.M, m.m) : m.m.slice(); });
  def(cam, 'PopModelMatrix', () => { GR.M = GR.pila.length ? GR.pila.pop() : null; }); def(cam, 'GetModelMatrix', () => gmrMatriz(GR.M || undefined));
  for (const n of ['Start3D', 'End3D', 'Start2D', 'End2D', 'Start', 'End', 'StartOrthoView', 'EndOrthoView', 'ApplyShake']) def(cam, n, () => {});
  // mesh: inmediato (mesh.Begin ... mesh.End) y las mallas armadas (Mesh():BuildFromTriangles)
  const vActual = () => GR.mesh && (GR.mesh.v || (GR.mesh.v = { p: null, c: [1, 1, 1, 1], u: [0, 0] }));
  def(mesh, 'Begin', (a, b, c) => { const prim = typeof a === 'number' ? a : num(b, 2); GR.mesh = { prim, L: [], v: null }; });
  def(mesh, 'Position', (p) => { const v = vActual(); if (v && p instanceof LVec) v.p = gmrP(p); });
  def(mesh, 'Color', (r, g, b, a) => { const v = vActual(); if (v) v.c = [num(r, 255) / 255, num(g, 255) / 255, num(b, 255) / 255, (a === undefined ? 255 : num(a, 255)) / 255]; });
  def(mesh, 'TexCoord', (s, u, v2) => { const v = vActual(); if (v && num(s, 0) === 0) v.u = [num(u, 0), num(v2, 0)]; });
  for (const n of ['Normal', 'TangentS', 'TangentT', 'UserData', 'Specular', 'BoneData']) def(mesh, n, () => {});
  def(mesh, 'AdvanceVertex', () => { const M = GR.mesh; if (!M || !M.v || !M.v.p) return; M.L.push(M.v); M.v = { p: null, c: M.v.c.slice(), u: [0, 0] }; });
  def(mesh, 'VertexCount', () => (GR.mesh ? GR.mesh.L.length : 0));
  def(mesh, 'Quad', (a, b, c, d) => { const A = V(a), B = V(b), C = V(c), D = V(d); if (A && B && C && D) gmrQuad(A, B, C, D, [1, 1, 1, 1]); });
  def(mesh, 'QuadEasy', (p, n, w, h) => render.get('DrawQuadEasy')(p, n, w, h));
  def(mesh, 'End', () => { const M = GR.mesh; GR.mesh = null; if (M) gmrPrimitiva(M.prim, M.L); });
  const MM = (GMA.mtMesh = new LuaTable()), MI = new LuaTable(); MM.set('__index', MI); MM.set('MetaName', 'IMesh');
  MI.set('BuildFromTriangles', (o, t) => { o.L = []; if (!(t instanceof LuaTable)) return; for (const x of t.a) { if (!(x instanceof LuaTable) || !(x.get('pos') instanceof LVec)) continue; const c = x.get('color'); o.L.push({ q: x.get('pos'), c: c instanceof LuaTable ? gmrCol(c) : [1, 1, 1, 1], u: [num(x.get('u'), 0), num(x.get('v'), 0)] }); } });
  MI.set('Draw', (o) => { if (!o.L || !o.L.length) return; const m0 = GR.mat; if (o.mat) GR.mat = o.mat; gmrPrimitiva(2, o.L.map((x) => ({ p: gmrP(x.q), c: x.c, u: x.u }))); GR.mat = m0; });
  MI.set('Destroy', (o) => { o.L = null; }); MI.set('IsValid', (o) => !!o.L); MI.set('GetVertexCount', (o) => (o.L ? o.L.length : 0));
  def(G, 'Mesh', (m) => ({ L: null, mat: m && typeof m === 'object' ? m : null, __mt: GMA.mtMesh }));
  // estelas
  def(util, 'SpriteTrail', (e, att, c, add, w0, w1, vida, res, mat) => {
    if (!(e instanceof LEnt)) return NULL_ENT;
    const t = new LEnt('env_spritetrail', 'ent'); t.estela = { e, c: gmrCol(c), w0: num(w0, 8) * GS, w1: num(w1, 0) * GS, vida: Math.max(0.05, num(vida, 1)), res: num(res, 0.05), mat: gmaMaterial(String(mat || 'trails/laser').replace(/^materials\//, '')), suma: !!add, P: [] };
    GR.estelas.push(t); return t;
  });
}
// mesh.Begin: los primitivos de Source
function gmrPrimitiva(prim, L) {
  const tri = (a, b, c) => gmrTri(a.p, b.p, c.p, a.c, b.c, c.c, a.u, b.u, c.u);
  if (prim === 2) for (let i = 0; i + 2 < L.length; i += 3) tri(L[i], L[i + 1], L[i + 2]);
  else if (prim === 7) for (let i = 0; i + 3 < L.length; i += 4) { tri(L[i], L[i + 1], L[i + 2]); tri(L[i], L[i + 2], L[i + 3]); }
  else if (prim === 3) for (let i = 0; i + 2 < L.length; i++) (i & 1 ? tri(L[i + 1], L[i], L[i + 2]) : tri(L[i], L[i + 1], L[i + 2]));
  else if (prim === 6) for (let i = 1; i + 1 < L.length; i++) tri(L[0], L[i], L[i + 1]);
  else if (prim === 1 || prim === 4 || prim === 5) { const m0 = GR.mat; GR.mat = GR.colorMat; const paso = prim === 1 ? 2 : 1; for (let i = 0; i + 1 < L.length; i += paso) gmrRayo(L[i].p, L[i + 1].p, Math.max(0.006, vsub(L[i].p, CAM.pos).len() * 0.0025), 0, 1, L[i].c); if (prim === 5 && L.length > 2) gmrRayo(L[L.length - 1].p, L[0].p, 0.01, 0, 1, L[0].c); GR.mat = m0; }
}
function gmrVista() {
  const t = new LuaTable(); t.set('origin', GMA.V(CAM.pos)); const a = dirAng(dS(CAM.fwd)); a.__mt = GMA.mtAng; t.set('angles', a);
  t.set('fov', CAM.fov * 4 / 3); t.set('fov_unscaled', CAM.fov * 4 / 3); t.set('x', 0); t.set('y', 0); t.set('width', VW()); t.set('height', VH()); t.set('znear', 3); t.set('zfar', 30000); t.set('aspect', VW() / VH()); t.set('fovviewmodel', 54); return t;
}

// ---------------- modelos dibujados desde el Lua (DrawModel sin cuerpo, ClientsideModel, efectos con modelo) ----------------
function gmaPrefabCS(ruta) {
  if (!ruta) return null;
  ruta = String(ruta).toLowerCase().replace(/\\/g, '/'); if (!ruta.startsWith('models/')) ruta = 'models/' + ruta;
  if (gmArchivo(ruta)) return gmPrefab('gm:' + ruta) ? 'gm:' + ruta : null;
  const base = ruta.replace(/^.*\//, '').replace(/\.mdl$/, '');
  for (const n of Object.keys(DATA.pfPorNombre)) if (n.toLowerCase() === base) return n;
  return null;
}
const _gmM = new Float32Array(16);
function gmrModelo(e) {
  const ruta = e.modelo; if (!ruta) return;
  let md = e.mdCS;
  if (!md || md.ruta !== ruta) { const pf = gmaPrefabCS(ruta); if (!pf) { e.mdCS = null; return; } const k = DATA.pfPorNombre[pf]; if (!k) return; md = e.mdCS = new Modelo(DATA.pf[k]); md.ruta = ruta; }
  const p = e.rOrigen ? vG(e.rOrigen) : gmaEntPos(e), q = e.rAng ? angQuat(e.rAng) : entQ(e), s = +e.escala || 1;   // (SetRenderOrigin/SetRenderAngles: el modelo de mundo de FA:S en la mano)
  if (e.matriz && e.matriz.m) { m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [s, s, s], _gmT); m4mul(_gmT, gmrMatrizJuego(e.matriz.m, _gmX), md.raiz); }
  else m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [s, s, s], md.raiz);
  md.sucio = true;
  md.color = gmrTinte(e); md.encolar();
}
// Entity:EnableMatrix("RenderMultiply", m): la matriz se aplica al modelo en su propio espacio, antes de ubicarlo. El SWEP
// Construction Kit —con el que están hechas la mayoría de las armas «custom»— achica, estira y corre así cada pieza de
// sus armas (VElements/WElements: matrix:Scale(v.size)); antes se guardaba y no se usaba, y las piezas salían en su
// tamaño original: en las de Darken217 (SciFi Weapons) un revólver entero y cajas gigantes tapaban toda la pantalla.
// (de Source —Z arriba, pulgadas, filas— al juego —Y arriba, metros, columnas—: el eje i del juego es el S[i] de Source)
const _gmT = new Float32Array(16), _gmX = new Float32Array(16), GMR_EJE = [1, 2, 0];
function gmrMatrizJuego(M, o) {
  for (let j = 0; j < 3; j++) { for (let i = 0; i < 3; i++) o[j * 4 + i] = M[GMR_EJE[i] * 4 + GMR_EJE[j]]; o[j * 4 + 3] = 0; }
  for (let i = 0; i < 3; i++) o[12 + i] = M[GMR_EJE[i] * 4 + 3] * GS;
  o[15] = 1; return o;
}
function gmrTinte(e) {
  const c = e.color || [255, 255, 255, 255], m = GR.mod, a = (c[3] ?? 255) / 255 * GR.blend;
  return c[0] === 255 && c[1] === 255 && c[2] === 255 && a >= 0.999 && m[0] === 1 && m[1] === 1 && m[2] === 1 ? null : [c[0] / 255 * m[0], c[1] / 255 * m[1], c[2] / 255 * m[2], a];
}
// Entity:DrawModel(): la entidad que se está dibujando muestra su modelo; las demás (sin cuerpo) se dibujan acá
function gmrDrawModel(e) {
  if (!(e instanceof LEnt) || !GR.enPasada) return;
  if (e.o && !e.o.borrado) { if (e === GR.entAct) { GR.dm = true; e.o.md.color = gmrTinte(e); } else if (GR.dmOtros) { GR.dmOtros.add(e); e.o.md.color = gmrTinte(e); } return; }
  if (e.tipo === 'vm' || e === GMA.jug || e === GR.armaMundo) { GR.dm = true; return; }
  if (e.cs && GR.lista === 'vista' && typeof gmvDibujarCS === 'function' && gmvDibujarCS(e)) return;   // (la vista que dibuja el Lua: FA:S, CW 2.0)
  gmrModelo(e);
}

// ---------------- cada cuadro ----------------
// antes de juntar lo que se dibuja: el Lua dibuja (graba primitivas, muestra u oculta modelos)
function gmrAntes() {
  GR.L.mundo.length = 0; GR.L.vista.length = 0; GR.nv = 0; GR.n2d = 0; GR.lista = 'mundo';
  if (!GMA.R || !GMA.activo || JUEGO.estado !== 'juego') return;
  const t0 = performance.now();
  GR.enPasada = true; GR.mat = null; GR.ignZ = false; GR.M = null; GR.pila.length = 0; GR.mod = [1, 1, 1]; GR.blend = 1;
  try {
    const flags = 1;
    gmaHook('PreDrawOpaqueRenderables', 'C', false, false);
    // las entidades de los addons: su Draw (si no llama DrawModel, el modelo no se ve)
    const b = GMA.clases.get('base_anim') || GMA.clases.get('base_entity'), bt = b && (b.C || b.S), d0 = bt && buscarEnClase(bt, 'Draw'), d1 = bt && buscarEnClase(bt, 'DrawTranslucent');
    for (const e of GMA.ents.values()) {
      if (e.tipo !== 'ent' || !e.vivo) continue;
      if (e.estela) continue;
      const c = claseTabla(e.clase, 'C');
      if (!c || !GMA.clases.has(e.clase)) { if (e.cs && !e.noDraw) { GR.entAct = e; gmrModelo(e); } continue; }
      if (e.noDraw) { if (e.o) e.o.md.oculto = true; continue; }
      // RenderOverride (de la clase o puesto en la entidad): en GMod reemplaza al dibujo de siempre. Los nextbots de la
      // plantilla clásica (Doge, Obunga, Sanic.png, Shaq…) dibujan su cara sólo ahí: sin esto eran invisibles
      const tE = e.tablaC || e.tabla, roE = tE instanceof LuaTable ? tE.get('RenderOverride') : undefined, ro = typeof roE === 'function' ? roE : buscarEnClase(c, 'RenderOverride');
      if (typeof ro === 'function') {
        GR.entAct = e; GR.dm = false; GR.mat = null; GR.ignZ = false; GR.mod = [1, 1, 1]; GR.blend = 1;
        gmLlamar(ro, 'C', e, flags);
        if (e.o) e.o.md.oculto = !GR.dm;
        if (e.nb && typeof gmnbDibujar === 'function') gmnbDibujar(e);
        GR.d2 && gmrTerminar3D2D(); continue;
      }
      const rg = buscarEnClase(c, 'RenderGroup'), trans = rg === 8 || rg === 9, op = rg !== 8;
      const fo = op ? buscarEnClase(c, 'Draw') : null, ft = trans ? buscarEnClase(c, 'DrawTranslucent') : null;
      const propio = (fo && fo !== d0) || (ft && ft !== d1 && ft !== d0);
      if (!propio) { if (e.o) { e.o.md.oculto = false; e.o.md.color = gmrTinte(e); if (e.nb && typeof gmnbDibujar === 'function') gmnbDibujar(e); } else gmrModelo(e); continue; }
      GR.entAct = e; GR.dm = false; GR.mat = null; GR.ignZ = false; GR.mod = [1, 1, 1]; GR.blend = 1;
      if (fo) gmLlamar(fo, 'C', e, flags);
      if (ft) gmLlamar(ft, 'C', e, flags);
      if (e.o) e.o.md.oculto = !GR.dm;
      if (e.nb && typeof gmnbDibujar === 'function') gmnbDibujar(e);
      GR.d2 && gmrTerminar3D2D();
    }
    GR.entAct = null;
    // el arma del addon en la mano, vista de afuera (tercera persona): su DrawWorldModel y DrawWorldModelTranslucent
    // (el modelo ya va en la mano; el Lua dibuja lo suyo: la hoja de un sable, un brillo)
    const w = GMA.swep;
    if (w && w.vivo && w.mundoW && TIEMPO.t - (w.mundoT || 0) < 0.5 && typeof JUG !== 'undefined' && JUG.tercera) {
      GR.armaMundo = w; GR.entAct = w; GR.mat = null; GR.ignZ = false; GR.mod = [1, 1, 1]; GR.blend = 1;
      const cw = claseTabla(w.clase, 'C');
      for (const n of ['DrawWorldModel', 'DrawWorldModelTranslucent']) { const f = cw && buscarEnClase(cw, n); if (typeof f === 'function') gmLlamar(f, 'C', w, 1); GR.d2 && gmrTerminar3D2D(); }
      GR.armaMundo = null; GR.entAct = null;
    }
    gmaHook('PostDrawOpaqueRenderables', 'C', false, false);
    gmaHook('PreDrawTranslucentRenderables', 'C', false, false);
    // los efectos vivos
    for (const e of GMA.efVivos || []) { if (!e.vivo) continue; GR.mat = null; GR.ignZ = false; GR.entAct = e; const f = gmrMetodo(e, 'Render'); if (typeof f === 'function') gmLlamar(f, 'C', e); GR.d2 && gmrTerminar3D2D(); }
    GR.entAct = null; GR.mat = null; GR.ignZ = false;
    gmaHook('PostDrawTranslucentRenderables', 'C', false, false);
    gmaHook('PostDrawEffects', 'C');
    // estelas y partículas
    gmrEstelas(); gmrParticulas();
  } finally { GR.enPasada = false; GR.entAct = null; GR.M = null; if (GR.d2) gmrTerminar3D2D(); GMA.lienzo = null; }
  GR.ms = GR.ms * 0.95 + (performance.now() - t0) * 0.05;
}
// la vista del arma: los ganchos de GMod alrededor del ViewModel (en la franja de la vista)
function gmrVistaArma() {
  if (!GMA.R || !GMA.activo) return;
  const w = GMA.swep; if (!w || !w.vivo || !claseTabla(w.clase, 'C')) return;
  const n = typeof ARM !== 'undefined' ? ARM.lista[ARM.i] : null, D = n && DEF_ARMAS[n]; if (!D || D.gm !== w.clase) return;
  GR.lista = 'vista'; GR.enPasada = true; GR.mat = null; GR.ignZ = false; GR.M = null;
  const vm = G_vm();
  try {
    metodo(w, 'PreDrawViewModel', 'C', vm, w, GMA.jug);
    gmaHook('PreDrawViewModel', 'C', vm, GMA.jug, w);
    metodo(w, 'ViewModelDrawn', 'C', vm);
    metodo(w, 'PostDrawViewModel', 'C', vm, w, GMA.jug);
    gmaHook('PostDrawViewModel', 'C', vm, GMA.jug, w);
  } finally { GR.enPasada = false; GR.lista = 'mundo'; if (GR.d2) gmrTerminar3D2D(); GMA.lienzo = null; GR.M = null; }
}
const G_vm = () => { const f = GMA.metas && GMA.metas.Player.get('GetViewModel'); return f ? f(GMA.jug) : NULL_ENT; };
function gmrMetodo(e, k) { let v = e.efecto ? buscarEnClase(e.efecto, k) : undefined; if (v === undefined) { const B = GMA.R && GMA.R.G.get('__EFFECT_BASE'); if (B instanceof LuaTable) v = B.get(k); } return v; }
function gmrEstelas() {
  const t = TIEMPO.t;
  GR.estelas = GR.estelas.filter((s) => {
    const E = s.estela, vivo = s.vivo && entValida(E.e);
    if (vivo) { const p = gmaEntPos(E.e); const u = E.P[E.P.length - 1]; if (!u || vsub(u.p, p).len() > 0.02) E.P.push({ p, t }); else u.t = t; }
    while (E.P.length && t - E.P[0].t > E.vida) E.P.shift();
    if (!E.P.length) { if (!vivo) { s.vivo = false; return false; } return true; }
    let largo = 0; const P = E.P.map((q, i) => { if (i) largo += vsub(q.p, E.P[i - 1].p).len(); const k = Math.min(1, (t - q.t) / E.vida); return { p: q.p, w: E.w0 + (E.w1 - E.w0) * k, t: largo / GS * E.res, c: [E.c[0], E.c[1], E.c[2], E.c[3] * (1 - k)] }; });
    P.reverse(); const m0 = GR.mat; GR.mat = E.mat; const r = gmrMat(E.mat); if (E.suma && r && !r.nada && r.modo !== 'add') r.modo = 'add'; gmrTira(P); GR.mat = m0;
    return true;
  });
}
// ---------------- partículas de Lua (ParticleEmitter y CLuaParticle) ----------------
// cada partícula con su material, tamaño, alfa y color que van del principio al fin, velocidad, gravedad, freno del aire,
// giro, choque con rebote (y su función), su Think, el largo (estiradas a lo largo de la velocidad) y los emisores 3D
// (cuadros con su ángulo en vez de carteles)
GR.parts = [];
function gmrApiParticulas(R, G, def, num) {
  const PEM = new LuaTable(), PEI = new LuaTable(); PEM.set('__index', PEI); PEM.set('MetaName', 'CLuaEmitter');
  // (a una partícula, como a una entidad, el Lua le puede guardar campos suyos: los fogonazos de la TFA Base le ponen
  // FollowEnt y Att para seguir la boca del arma; antes eso era un error en cada disparo)
  const PTM = new LuaTable(), PTI = new LuaTable(); PTM.set('__index', (q, k) => { const f = PTI.get(k); return f !== undefined ? f : q.ex ? q.ex.get(k) : undefined; }); PTM.set('__newindex', (q, k, v) => { (q.ex || (q.ex = new Map())).set(k, v); }); PTM.set('MetaName', 'CLuaParticle');
  GMA.mtEmisor = PEM; GMA.mtPart = PTM;
  def(G, 'ParticleEmitter', (p, d3) => ({ p: p instanceof LVec ? p : new LVec(), d3: !!d3, n: 0, vivo: true, nodraw: false, __mt: PEM }));
  PEI.set('Add', (em, mat, p) => {
    // (tope según la calidad: 750 en Patata, 1500 en Bajo, 2400 en Medio, 3000 en Alto; una nuclear de addon pide más de 2000)
    if (!em) return undefined;
    // (pasado el tope, o con el emisor ya terminado, va una partícula fantasma que no se dibuja: en GMod el tope es tan alto
    // que las nucleares no lo tocan y casi ningún addon mira si Add devolvió nil; la Redeemer rompía con particle:SetVelocity)
    const fant = GR.parts.length >= 3000 * Math.max(0.25, Math.min(1, GFX.part || 1)) || !em.vivo;
    const m = fant ? null : mat && typeof mat === 'object' ? mat : gmaMaterial(String(mat || '').replace(/^materials\//, ''));
    const q = { em, m, p: p instanceof LVec ? vG(p) : vG(em.p), v: v3(), g: v3(), vida: 1, t: 0, s0: 10, s1: 0, a0: 255, a1: 255, c: [255, 255, 255], roll: 0, droll: 0, aire: 0, choca: false, rebote: 0.3, l0: 0, l1: 0, ang: null, dang: null, think: null, prox: 0, cb: null, vivo: !fant, __mt: PTM };
    if (!fant) { GR.parts.push(q); em.n++; } return q;
  });
  Object.entries({ Finish: (em) => { em.vivo = false; }, SetPos: (em, p) => { if (p instanceof LVec) em.p = p; }, GetPos: (em) => GMA.nv(em.p.x, em.p.y, em.p.z), SetNoDraw: (em, b) => { em.nodraw = !!b; }, Is3D: (em) => em.d3,
    GetNumActiveParticles: (em) => GR.parts.filter((q) => q.em === em).length, IsValid: (em) => em.vivo, SetNearClip: () => {}, SetBBox: () => {}, Draw: () => {}, SetParticleCullRadius: () => {} }).forEach(([k, f]) => PEI.set(k, f));
  const n = (x, d) => num(x, d);
  Object.entries({
    SetDieTime: (q, t) => { q.vida = Math.max(0.01, n(t, 1)); }, GetDieTime: (q) => q.vida, SetLifeTime: (q, t) => { q.t = n(t, 0); }, GetLifeTime: (q) => q.t,
    SetStartSize: (q, v) => { q.s0 = n(v, 10); }, SetEndSize: (q, v) => { q.s1 = n(v, 0); }, GetStartSize: (q) => q.s0, GetEndSize: (q) => q.s1,
    SetStartAlpha: (q, v) => { q.a0 = n(v, 255); }, SetEndAlpha: (q, v) => { q.a1 = n(v, 0); }, GetStartAlpha: (q) => q.a0, GetEndAlpha: (q) => q.a1,
    SetStartLength: (q, v) => { q.l0 = n(v, 0); }, SetEndLength: (q, v) => { q.l1 = n(v, 0); }, GetStartLength: (q) => q.l0, GetEndLength: (q) => q.l1,
    SetColor: (q, r, g, b) => { q.c = [n(r, 255), n(g, 255), n(b, 255)]; }, GetColor: (q) => q.c.slice(),
    SetVelocity: (q, v) => { if (v instanceof LVec) q.v = vGr(v); }, GetVelocity: (q) => GMA.Vr(q.v), SetGravity: (q, v) => { if (v instanceof LVec) q.g = vGr(v); }, GetGravity: (q) => GMA.Vr(q.g),
    SetPos: (q, p) => { if (p instanceof LVec) q.p = vG(p); }, GetPos: (q) => GMA.V(q.p), SetAirResistance: (q, v) => { q.aire = n(v, 0); }, GetAirResistance: (q) => q.aire,
    SetRoll: (q, v) => { q.roll = n(v, 0); }, GetRoll: (q) => q.roll, SetRollDelta: (q, v) => { q.droll = n(v, 0); }, GetRollDelta: (q) => q.droll,
    SetAngles: (q, a) => { if (a instanceof LAng) q.ang = new LAng(a.p, a.y, a.r); }, GetAngles: (q) => GMA.A(q.ang ? new LAng(q.ang.p, q.ang.y, q.ang.r) : new LAng()), SetAngleVelocity: (q, a) => { if (a instanceof LAng) q.dang = new LAng(a.p, a.y, a.r); }, GetAngleVelocity: (q) => GMA.A(q.dang || new LAng()),
    SetCollide: (q, b) => { q.choca = !!b; }, SetBounce: (q, v) => { q.rebote = n(v, 0.3); }, GetBounce: (q) => q.rebote, SetCollideCallback: (q, f) => { q.cb = typeof f === 'function' ? f : null; },
    SetThinkFunction: (q, f) => { q.think = typeof f === 'function' ? f : null; }, SetNextThink: (q, t) => { q.prox = n(t, 0); }, GetMaterial: (q) => q.m,
    SetLighting: () => {}, SetVelocityScale: () => {}, SetCollideCallbackFunction: () => {}, SetMaterial: (q, m) => { q.m = m && typeof m === 'object' ? m : gmaMaterial(String(m || '')); }, SetStartCollideWithWorld: () => {}, SetWorldCollide: () => {},
  }).forEach(([k, f]) => PTI.set(k, f));
}
function gmrPartPaso(dt) {
  if (!GR.parts.length) return;
  const ct = typeof TIEMPO !== 'undefined' ? TIEMPO.t : 0;
  GR.parts = GR.parts.filter((q) => {
    q.t += dt; if (q.t >= q.vida || !q.vivo) return false;
    q.v.addS(q.g, dt); if (q.aire) q.v.scale(Math.max(0, 1 - q.aire * dt * 0.01));
    const p0 = q.p.clone(); q.p.addS(q.v, dt); q.roll += q.droll * dt;
    if (q.dang && q.ang) { q.ang.p += q.dang.p * dt; q.ang.y += q.dang.y * dt; q.ang.r += q.dang.r * dt; }
    if (q.choca) { const d = vsub(q.p, p0), l = d.len(); if (l > 1e-5) { const dn = vscale(d, 1 / l), h = raycast(p0, dn, l, null); if (h) { h.p = h.p || vadd(p0, vscale(dn, h.t)); q.p.copy(vadd(h.p, vscale(h.n, 0.01))); const vn = vdot(q.v, h.n); q.v = vscale(vsub(q.v, vscale(h.n, 2 * vn)), q.rebote); if (q.cb) gmLlamar(q.cb, 'C', q, GMA.V(h.p), GMA.Vd(h.n)); } } }
    if (q.think && GMA.R && ct >= q.prox) { q.prox = ct + 1e9; gmLlamar(q.think, 'C', q); }
    return true;
  });
}
function gmrParticulas() {
  if (!GR.parts.length) return;
  const m0 = GR.mat;
  for (const q of GR.parts) {
    if (q.em.nodraw) continue;
    const k = Math.min(1, q.t / q.vida), s = (q.s0 + (q.s1 - q.s0) * k) * GS, a = (q.a0 + (q.a1 - q.a0) * k) / 255; if (s <= 0 || a <= 0.002) continue;
    GR.mat = q.m; const col = gmrCol(null, gmrMat(q.m)); col[0] *= q.c[0] / 255; col[1] *= q.c[1] / 255; col[2] *= q.c[2] / 255; col[3] *= Math.min(1, a);
    const largo = (q.l0 + (q.l1 - q.l0) * k) * GS;
    if (largo > 0 && q.v.len() > 1e-4) { const d = vscale(q.v.clone().norm(), largo); gmrRayo(q.p, vsub(q.p, d), s * 2, 0, 1, col); continue; }
    let x, y;
    if (q.em.d3 && q.ang) { const [, Rt, U] = gmrEjes(q.ang); x = vscale(Rt, -s); y = vscale(U, s); }
    else { const c = Math.cos(q.roll), sn = Math.sin(q.roll); x = vadd(vscale(CAM.der, c * s), vscale(CAM.arr, sn * s)); y = vadd(vscale(CAM.arr, c * s), vscale(CAM.der, -sn * s)); }
    gmrQuad(vadd(vsub(q.p, x), y), vadd(vadd(q.p, x), y), vsub(vadd(q.p, x), y), vsub(vsub(q.p, x), y), col);
  }
  GR.mat = m0;
}
// ---------------- efectos (util.Effect de los EFFECT de lua/effects): entidades del cliente ----------------
// Init(data) al crearse; Think cada cuadro (si devuelve false o nada, se termina); Render cuando se dibuja
function gmrEfecto(cls, nombre, d) {
  GMA.efVivos = GMA.efVivos || []; if (GMA.efVivos.length >= 800) return;
  const e = new LEnt(nombre, 'efecto'); GMA.ents.delete(e.id); e.efecto = cls; e.creado = true; e.t0 = TIEMPO.t;
  const g = (k) => (d && d.d ? d.d.get(k) : undefined);
  if (g('Origin') instanceof LVec) e.pos = vG(g('Origin')); if (g('Angles') instanceof LAng) e.q = angQuat(g('Angles'));
  const f = gmrMetodo(e, 'Init'); if (typeof f === 'function') gmLlamar(f, 'C', e, d);
  if (e.vivo) GMA.efVivos.push(e);
}
function gmrEfectosPaso() {
  if (!GMA.efVivos || !GMA.efVivos.length) return;
  const t = TIEMPO.t;
  GMA.efVivos = GMA.efVivos.filter((e) => {
    if (!e.vivo) return false;
    if (t - e.t0 > 30) { e.vivo = false; return false; }
    const f = gmrMetodo(e, 'Think'); const r = typeof f === 'function' ? gmLlamar(f, 'C', e) : [false];
    if (r[0] === false || r[0] === undefined) { e.vivo = false; const fr = gmrMetodo(e, 'OnRemove'); if (typeof fr === 'function' && fr !== gmrMetodoBase('OnRemove')) gmLlamar(fr, 'C', e); return false; }
    return true;
  });
}
function gmrMetodoBase(k) { const B = GMA.R && GMA.R.G.get('__EFFECT_BASE'); return B instanceof LuaTable ? B.get(k) : undefined; }

// ---------------- dibujar lo grabado ----------------
const VS_GR = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; layout(location=2) in vec2 aU;
uniform mat4 uVP; out vec4 vC; out vec2 vU;
void main(){ vC = aC; vU = aU; gl_Position = uVP * vec4(aP, 1.0); }`;
const FS_GR = `#version 300 es
precision mediump float; in vec4 vC; in vec2 vU; uniform sampler2D uT; uniform float uLin, uCorte; out vec4 o;
void main(){ vec4 t = texture(uT, vU); o = vC * t; if (uCorte > 0.0 && o.a < uCorte) discard; if (uLin > 0.5) o.rgb = pow(max(o.rgb, vec3(0.0)), vec3(2.2)); }`;
function gmrDibujar(lista) {
  const L = GR.L[lista]; if (!L.length || !GR.nv) return;
  const gl = R.gl;
  if (!GR.prog) {
    GR.prog = shader(VS_GR, FS_GR); GR.vao = gl.createVertexArray(); gl.bindVertexArray(GR.vao); GR.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, GR.buf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 28);
    gl.bindVertexArray(null); GR.subido = -1;
  }
  const P = GR.prog; gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0);
  gl.bindVertexArray(GR.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GR.buf);
  if (GR.subido !== R.cuadro || GR.subidoN !== GR.nv) { gl.bufferData(gl.ARRAY_BUFFER, GR.vb.subarray(0, GR.nv * 9), gl.STREAM_DRAW); GR.subido = R.cuadro; GR.subidoN = GR.nv; }
  gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);
  const paso = (opacos) => {
    for (const t of L) {
      const m = t.m, op = m.modo === 'op' || m.modo === 'cut'; if (op !== opacos || !t.n) continue;
      const tx = m.tex && m.tex(); if (!tx) continue;
      gl.bindTexture(gl.TEXTURE_2D, tx);
      if (op) { gl.disable(gl.BLEND); gl.depthMask(true); gl.uniform1f(P.u.uCorte, m.modo === 'cut' ? 0.25 : 0); }   // ($alphatest: con 0,5 las tiras finas, como el centro de la hoja de un sable, se cortaban a tramos de lejos)
      else { gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, m.modo === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(P.u.uCorte, 0.003); }
      if (t.z) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
      gl.drawArrays(gl.TRIANGLES, t.o, t.n);
    }
  };
  paso(true); paso(false);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.bindVertexArray(null);
  R.vaoAct = null; R.progAct = null; R.texAct = null;
}
if (typeof module !== 'undefined') module.exports = { GR, gmrApi, gmrPartPaso, gmrEfecto, gmrEfectosPaso, gmrAntes, gmrDibujar, gmrVistaArma, gmrMat, gmaPrefabCS, gmrDrawModel };
