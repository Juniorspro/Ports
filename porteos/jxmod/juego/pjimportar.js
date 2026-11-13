// ---------------- Importar personaje: cualquier modelo humanoide como personaje, con rig automático (como Prisma 3D) ----------------
// Discord (lore1221): «una manera de que poner personajes sea más fácil, como la opción de Prisma que riggea solo». Un
// archivo de la compu o del celular (GLB, GLTF, VRM u OBJ con su .mtl y texturas; los .gma de GMod siguen por su camino de
// siempre) se convierte en un personaje del juego en tres pasos:
//  1. se lee, se para derecho (qué eje es arriba y para dónde mira, por la forma: piernas abajo, cabeza arriba, la punta
//     de los pies adelante) y se escala (si mide entre 0,4 y 3 m se deja su alto; si no, 1,83 m, el de un jugador de GMod);
//  2. si ya trae esqueleto humanoide (mixamo, VRM, Unreal, Blender, Valve o cualquier nombre: también por la forma del
//     árbol) se usa el suyo con sus pesos (retargeteo); si no, se proponen los puntos como en Prisma (barbilla, hombros,
//     codos, muñecas, ingle, rodillas y tobillos, sobre la silueta de frente: se pueden arrastrar) y con eso se arma el
//     esqueleto y los pesos: cada vértice va al hueso más cercano por DENTRO del cuerpo (distancia geodésica en una grilla
//     de vóxeles rellena, así un brazo pegado al costado no se lleva el torso ni una pierna la otra), las articulaciones
//     se mezclan suave en un ancho que sale del grosor del miembro, la mano y los dedos quedan rígidos (no se estiran) y
//     la ropa suelta de abajo (pollera, vestido, tapado) se reparte entre la cadera y los muslos;
//  3. el resultado es un modelo de jugador más de gmod_pm.js (el mismo camino que los del Workshop: cada hueso copia el
//     giro del Hero, con IK de manos y pies y sus proporciones), con vista previa animada, y se guarda en el aparato
//     (IndexedDB). En multijugador los demás lo bajan del que lo tiene puesto, de a pedazos por la sala (como los memes).
// Entrada única: pjiAbrir() (el botón «Importar personaje» de Personajes → Mods y de la pausa).
const PJI = { cfg: { suave: 'auto', ingle: 1 }, lista: [], cargada: false, db: null, defs: new Map(), packs: new Map(), pidiendo: new Map(), partes: new Map(), enviando: new Set(), ses: null, n: 0, t: {} };
const PJI_RUTA = /^jxpj\/([a-z0-9_]{6,40})\.mdl$/;
const pjiSkin = (id) => 'gmpm:jxpj/' + id + '.mdl';
const pjiIdDe = (s) => { const m = typeof s === 'string' && /^gmpm:(.*)$/.exec(s), r = m && PJI_RUTA.exec(m[1]); return r ? r[1] : null; };
const pjiEs = (s) => !!pjiIdDe(s);
const PJI_ALTO = 1.83;   // (el de un modelo de jugador de GMod: 72 unidades)

// ======================= 1. leer el archivo =======================
// cruda: { pos, nor|null, uv|null, grupos: [{ mat, tris }], mats: [{ c, img, alfa, dos }], imgs: [{ bytes, mime, n }],
//          huesos: null | [{ n, pa, W (mundo, columnas) }], hb/hw (4 por vértice), humano: null | { nombreVRM: hueso } }
const pjiTD = new TextDecoder();
function pjiNomArch(s) { try { s = decodeURIComponent(s); } catch (e) {} return String(s).replace(/\\/g, '/').split('/').pop().toLowerCase(); }
// matrices 4×4 por columnas (como glTF y el juego)
const pjiM = {
  id: () => { const m = new Float64Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul: (a, b) => { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  trs: (t, q, s) => { const [x, y, z, w] = q, o = new Float64Array(16);
    o[0] = (1 - 2 * (y * y + z * z)) * s[0]; o[1] = 2 * (x * y + z * w) * s[0]; o[2] = 2 * (x * z - y * w) * s[0];
    o[4] = 2 * (x * y - z * w) * s[1]; o[5] = (1 - 2 * (x * x + z * z)) * s[1]; o[6] = 2 * (y * z + x * w) * s[1];
    o[8] = 2 * (x * z + y * w) * s[2]; o[9] = 2 * (y * z - x * w) * s[2]; o[10] = (1 - 2 * (x * x + y * y)) * s[2];
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1; return o; },
  inv: (m) => { const a = m, o = new Float64Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return pjiM.id(); d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d; return o; },
  pt: (m, x, y, z, o, k) => { o[k] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; },
  dir: (m, x, y, z, o, k) => { o[k] = m[0] * x + m[4] * y + m[8] * z; o[k + 1] = m[1] * x + m[5] * y + m[9] * z; o[k + 2] = m[2] * x + m[6] * y + m[10] * z; },
};
function pjiLeerGltf(arch, nombre) {
  const b = arch.get(nombre); let J = null, bin = null;
  if (b.length > 20 && b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let o = 12;
    while (o + 8 <= b.length) { const len = dv.getUint32(o, true), tipo = dv.getUint32(o + 4, true), c = b.subarray(o + 8, o + 8 + len);
      if (tipo === 0x4e4f534a) J = JSON.parse(pjiTD.decode(c)); else if (tipo === 0x004e4942 && !bin) bin = c; o += 8 + len; }
  } else J = JSON.parse(pjiTD.decode(b));
  if (!J || !J.asset) throw new Error('pji.errFormato');
  const req = J.extensionsRequired || [];
  if (req.some((e) => /draco|meshopt|basisu|ktx/i.test(e))) { const e = new Error('pji.errComprimido'); e.det = req.join(', '); throw e; }
  const B64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  const bufs = (J.buffers || []).map((x, i) => {
    if (x.uri === undefined) return bin;
    if (/^data:/.test(x.uri)) return B64(x.uri.slice(x.uri.indexOf(',') + 1));
    const f = arch.get(pjiNomArch(x.uri)); if (!f) { const e = new Error('pji.faltaArchivo'); e.det = pjiNomArch(x.uri); throw e; } return f;
  });
  const vista = (i) => { const V = J.bufferViews[i], B = bufs[V.buffer]; return B.subarray(V.byteOffset || 0, (V.byteOffset || 0) + V.byteLength); };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }, TAM = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const leer1 = (dv, o, ct, nor) => {
    switch (ct) { case 5126: return dv.getFloat32(o, true); case 5121: return nor ? dv.getUint8(o) / 255 : dv.getUint8(o); case 5123: return nor ? dv.getUint16(o, true) / 65535 : dv.getUint16(o, true);
      case 5125: return dv.getUint32(o, true); case 5120: return nor ? Math.max(-1, dv.getInt8(o) / 127) : dv.getInt8(o); case 5122: return nor ? Math.max(-1, dv.getInt16(o, true) / 32767) : dv.getInt16(o, true); }
    return 0;
  };
  const acc = (i, ent) => {
    const A = J.accessors[i], nc = NC[A.type], n = A.count, ct = A.componentType, es = TAM[ct], out = ent ? new Uint32Array(n * nc) : new Float32Array(n * nc);
    if (A.bufferView !== undefined) {
      const V = J.bufferViews[A.bufferView], B = bufs[V.buffer], st = V.byteStride || nc * es, base = (V.byteOffset || 0) + (A.byteOffset || 0), dv = new DataView(B.buffer, B.byteOffset);
      if (ct === 5126 && st === nc * 4 && (B.byteOffset + base) % 4 === 0 && !ent) out.set(new Float32Array(B.buffer, B.byteOffset + base, n * nc));
      else for (let k = 0; k < n; k++) for (let c = 0; c < nc; c++) out[k * nc + c] = leer1(dv, base + k * st + c * es, ct, !!A.normalized);
    }
    if (A.sparse) {
      const S = A.sparse, iv = vista(S.indices.bufferView), vv = vista(S.values.bufferView), di = new DataView(iv.buffer, iv.byteOffset), dw = new DataView(vv.buffer, vv.byteOffset), ie = TAM[S.indices.componentType];
      for (let k = 0; k < S.count; k++) { const ix = leer1(di, (S.indices.byteOffset || 0) + k * ie, S.indices.componentType, false); for (let c = 0; c < nc; c++) out[ix * nc + c] = leer1(dw, (S.values.byteOffset || 0) + (k * nc + c) * es, ct, !!A.normalized); }
    }
    return out;
  };
  // los nodos y sus matrices del mundo (pose por defecto)
  const N = J.nodes || [], padre = new Int32Array(N.length).fill(-1);
  N.forEach((x, i) => (x.children || []).forEach((c) => { padre[c] = i; }));
  const loc = N.map((x) => (x.matrix ? Float64Array.from(x.matrix) : pjiM.trs(x.translation || [0, 0, 0], x.rotation || [0, 0, 0, 1], x.scale || [1, 1, 1])));
  const W = new Array(N.length).fill(null), mundo = (i) => W[i] || (W[i] = padre[i] >= 0 ? pjiM.mul(mundo(padre[i]), loc[i]) : loc[i]);
  const esc = J.scenes && J.scenes[J.scene || 0], raices = esc && esc.nodes ? esc.nodes : N.map((x, i) => i).filter((i) => padre[i] < 0);
  const enEscena = new Uint8Array(N.length); const marcar = (i) => { enEscena[i] = 1; (N[i].children || []).forEach(marcar); }; raices.forEach(marcar);
  // las imágenes y los materiales
  const imgs = [], porImg = new Map();
  const imagen = (ti) => {
    const T = J.textures && J.textures[ti]; if (!T) return -1;
    const src = T.source !== undefined ? T.source : T.extensions && (T.extensions.EXT_texture_webp || T.extensions.KHR_texture_basisu || {}).source; if (src === undefined) return -1;
    if (porImg.has(src)) return porImg.get(src);
    const I = J.images[src]; let bytes = null, mime = I.mimeType || '';
    try { if (I.bufferView !== undefined) bytes = vista(I.bufferView); else if (/^data:/.test(I.uri)) { mime = I.uri.slice(5, I.uri.indexOf(';')); bytes = B64(I.uri.slice(I.uri.indexOf(',') + 1)); } else bytes = arch.get(pjiNomArch(I.uri)) || null; } catch (e) { bytes = null; }
    const k = bytes ? imgs.push({ bytes, mime: mime || pjiMime(I.uri || ''), n: I.name || I.uri || 'img' + src }) - 1 : -1; porImg.set(src, k); return k;
  };
  const mats = [], porMat = new Map(), tt = new Map();
  const material = (mi) => {
    if (porMat.has(mi)) return porMat.get(mi);
    const M = mi !== undefined && J.materials ? J.materials[mi] : null, pb = (M && M.pbrMetallicRoughness) || {}, sg = M && M.extensions && M.extensions.KHR_materials_pbrSpecularGlossiness;
    const c = (sg && sg.diffuseFactor) || pb.baseColorFactor || [1, 1, 1, 1], tx = (sg && sg.diffuseTexture) || pb.baseColorTexture;
    const img = tx ? imagen(tx.index) : -1, k = mats.push({ c: c.slice(0, 4), img, alfa: M && M.alphaMode === 'BLEND' ? 'blend' : M && M.alphaMode === 'MASK' ? 'cut' : 'op', dos: !!(M && M.doubleSided), n: (M && M.name) || 'mat' + mats.length }) - 1;
    const T = tx && tx.extensions && tx.extensions.KHR_texture_transform; if (T) tt.set(k, T);
    porMat.set(mi, k); return k;
  };
  // los huesos: los de todas las pieles (por nodo)
  const skins = J.skins || [], porNodo = new Map(), huesos = [];
  for (const S of skins) for (const j of S.joints || []) if (!porNodo.has(j)) { porNodo.set(j, huesos.length); huesos.push({ nodo: j, n: N[j].name || 'hueso' + j }); }
  const ancestroHueso = (i) => { for (let k = padre[i]; k >= 0; k = padre[k]) if (porNodo.has(k)) return porNodo.get(k); return -1; };
  huesos.forEach((h) => { h.pa = ancestroHueso(h.nodo); h.W = mundo(h.nodo); });
  const ibm = skins.map((S) => { const m = S.inverseBindMatrices !== undefined ? acc(S.inverseBindMatrices) : null; return (S.joints || []).map((j, k) => (m ? Float64Array.from(m.subarray(k * 16, k * 16 + 16)) : pjiM.id())); });
  const skinMat = skins.map((S, si) => (S.joints || []).map((j, k) => pjiM.mul(mundo(j), ibm[si][k])));
  // las mallas: todo junto en el espacio del archivo, en la pose por defecto (las de piel, con su piel puesta)
  const P = [], Nn = [], U = [], HB = [], HW = [], grupos = new Map(); let n = 0, conNor = true, conUV = false;
  for (let ni = 0; ni < N.length; ni++) {
    const nd = N[ni]; if (nd.mesh === undefined || !enEscena[ni]) continue;
    const Wn = mundo(ni), rigido = porNodo.has(ni) ? porNodo.get(ni) : ancestroHueso(ni);
    for (const pr of (J.meshes[nd.mesh] || {}).primitives || []) {
      const modo = pr.mode === undefined ? 4 : pr.mode; if (modo < 4 || pr.attributes.POSITION === undefined) continue;
      const pos = acc(pr.attributes.POSITION), nv = pos.length / 3, nor = pr.attributes.NORMAL !== undefined ? acc(pr.attributes.NORMAL) : null, uv = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0) : null;
      const jt = pr.attributes.JOINTS_0 !== undefined ? acc(pr.attributes.JOINTS_0, true) : null, wt = pr.attributes.WEIGHTS_0 !== undefined ? acc(pr.attributes.WEIGHTS_0) : null;
      const sk = nd.skin !== undefined && jt && wt ? nd.skin : -1, SM = sk >= 0 ? skinMat[sk] : null, SJ = sk >= 0 ? skins[sk].joints : null;
      let ind = pr.indices !== undefined ? acc(pr.indices, true) : Uint32Array.from({ length: nv }, (x, i) => i);
      if (modo === 5) { const o = []; for (let i = 0; i + 2 < ind.length; i++) if (i % 2) o.push(ind[i + 1], ind[i], ind[i + 2]); else o.push(ind[i], ind[i + 1], ind[i + 2]); ind = Uint32Array.from(o); }
      else if (modo === 6) { const o = []; for (let i = 1; i + 1 < ind.length; i++) o.push(ind[0], ind[i], ind[i + 1]); ind = Uint32Array.from(o); }
      const mi = material(pr.material), T = tt.get(mi); if (!nor) conNor = false; if (uv) conUV = true;
      const tmp = [0, 0, 0], m = new Float64Array(16);
      for (let k = 0; k < nv; k++) {
        const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
        let M4 = Wn;
        if (SM) { m.fill(0); let tw = 0; for (let c = 0; c < 4; c++) { const w = wt[k * 4 + c]; if (w <= 0) continue; tw += w; const S = SM[jt[k * 4 + c]]; if (!S) continue; for (let e = 0; e < 16; e++) m[e] += w * S[e]; }
          if (tw > 0) { for (let e = 0; e < 16; e++) m[e] /= tw; M4 = m; } }
        pjiM.pt(M4, x, y, z, tmp, 0); P.push(tmp[0], tmp[1], tmp[2]);
        if (nor) { pjiM.dir(M4, nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2], tmp, 0); const l = Math.hypot(tmp[0], tmp[1], tmp[2]) || 1; Nn.push(tmp[0] / l, tmp[1] / l, tmp[2] / l); } else Nn.push(0, 0, 0);
        let u = uv ? uv[k * 2] : 0, v = uv ? uv[k * 2 + 1] : 0;
        if (T) { const o = T.offset || [0, 0], r = T.rotation || 0, s = T.scale || [1, 1], cu = Math.cos(r), su = Math.sin(r), uu = u * s[0], vv = v * s[1]; u = cu * uu + su * vv + o[0]; v = -su * uu + cu * vv + o[1]; }
        U.push(u, v);
        if (SM) { for (let c = 0; c < 4; c++) { HB.push(porNodo.get(SJ[jt[k * 4 + c]]) ?? 0); HW.push(wt[k * 4 + c]); } }
        else { HB.push(Math.max(0, rigido), 0, 0, 0); HW.push(rigido >= 0 ? 1 : 0, 0, 0, 0); }
      }
      const G = grupos.get(mi) || []; for (let t = 0; t + 2 < ind.length; t += 3) G.push(n + ind[t], n + ind[t + 1], n + ind[t + 2]); grupos.set(mi, G);
      n += nv;
    }
  }
  if (!n) throw new Error('pji.sinMalla');
  // humanoide de VRM (0.x: lista; 1.0: objeto)
  let humano = null; const E = J.extensions || {};
  const hv = E.VRMC_vrm && E.VRMC_vrm.humanoid && E.VRMC_vrm.humanoid.humanBones, h0 = E.VRM && E.VRM.humanoid && E.VRM.humanoid.humanBones;
  if (hv || h0) { humano = {}; const poner = (k, nodo) => { if (porNodo.has(nodo)) humano[k] = porNodo.get(nodo); };
    if (Array.isArray(h0)) for (const x of h0) poner(x.bone, x.node); else if (hv) for (const k in hv) poner(k, hv[k].node); }
  return { pos: Float32Array.from(P), nor: conNor ? Float32Array.from(Nn) : null, uv: conUV ? Float32Array.from(U) : null, uvArriba: true,
    grupos: [...grupos].map(([mat, t]) => ({ mat, tris: Uint32Array.from(t) })), mats, imgs,
    huesos: huesos.length ? huesos.map((h) => ({ n: h.n, pa: h.pa, W: h.W })) : null, hb: huesos.length ? Uint16Array.from(HB) : null, hw: huesos.length ? Float32Array.from(HW) : null, humano, vrm0: !!h0 };
}
const pjiMime = (s) => (/\.png$/i.test(s) ? 'image/png' : /\.jpe?g$/i.test(s) ? 'image/jpeg' : /\.webp$/i.test(s) ? 'image/webp' : /\.tga$/i.test(s) ? 'image/x-tga' : /\.bmp$/i.test(s) ? 'image/bmp' : /\.gif$/i.test(s) ? 'image/gif' : '');
// OBJ (+ .mtl y texturas elegidas juntas; v con color opcional)
function pjiLeerObj(arch, nombre) {
  const txt = pjiTD.decode(arch.get(nombre)), V = [], VT = [], VN = [], VC = [];
  const mats = [], porMat = new Map(), imgs = [], porImg = new Map(), mtl = new Map();
  const imagen = (f) => { const k = pjiNomArch(f); if (porImg.has(k)) return porImg.get(k); const b = arch.get(k) || arch.get(k.replace(/\.[a-z0-9]+$/, '.png')) || arch.get(k.replace(/\.[a-z0-9]+$/, '.jpg')); const i = b ? imgs.push({ bytes: b, mime: pjiMime(k), n: k }) - 1 : -1; porImg.set(k, i); return i; };
  const leerMtl = (f) => { const b = arch.get(pjiNomArch(f)); if (!b) return; let cur = null;
    for (const l0 of pjiTD.decode(b).split(/\r?\n/)) { const l = l0.trim(), p = l.split(/\s+/), k = (p[0] || '').toLowerCase();
      if (k === 'newmtl') { cur = { c: [0.8, 0.8, 0.8, 1], tex: null }; mtl.set(l.slice(7).trim(), cur); }
      else if (!cur) continue; else if (k === 'kd') cur.c = [+p[1], +p[2], +p[3], cur.c[3]]; else if (k === 'd') cur.c[3] = +p[1]; else if (k === 'tr') cur.c[3] = 1 - +p[1];
      else if (k === 'map_kd') cur.tex = p[p.length - 1]; } };
  for (const l of txt.split(/\r?\n/)) if (/^mtllib\s/.test(l)) leerMtl(l.slice(7).trim());
  const material = (nom) => { if (porMat.has(nom)) return porMat.get(nom); const m = mtl.get(nom) || { c: [0.8, 0.8, 0.8, 1], tex: null };
    const k = mats.push({ c: m.c, img: m.tex ? imagen(m.tex) : -1, alfa: m.c[3] < 0.99 ? 'blend' : 'op', dos: false, n: nom || 'mat' }) - 1; porMat.set(nom, k); return k; };
  const P = [], Nn = [], U = [], C = [], grupos = new Map(), porClave = new Map(); let mat = material(''), conNor = true, conUV = false, conCol = false;
  const idx = (s, L, n) => { const i = parseInt(s, 10); return i < 0 ? L.length / n + i : i - 1; };
  for (const l0 of txt.split(/\r?\n/)) {
    const l = l0.trim(); if (!l || l[0] === '#') continue; const p = l.split(/\s+/);
    if (p[0] === 'v') { V.push(+p[1], +p[2], +p[3]); if (p.length >= 7) { VC.push(+p[4], +p[5], +p[6]); conCol = true; } else VC.push(1, 1, 1); }
    else if (p[0] === 'vt') VT.push(+p[1], +(p[2] || 0)); else if (p[0] === 'vn') VN.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'usemtl') { mat = material(l.slice(7).trim()); porClave.clear(); }
    else if (p[0] === 'f') {
      const vs = [];
      for (let k = 1; k < p.length; k++) {
        const key = p[k] + '|' + mat; let i = porClave.get(key);
        if (i === undefined) { const q = p[k].split('/'), a = idx(q[0], V, 3), t = q[1] ? idx(q[1], VT, 2) : -1, nn = q[2] ? idx(q[2], VN, 3) : -1;
          i = P.length / 3; P.push(V[a * 3], V[a * 3 + 1], V[a * 3 + 2]); C.push(VC[a * 3], VC[a * 3 + 1], VC[a * 3 + 2]);
          if (nn >= 0) Nn.push(VN[nn * 3], VN[nn * 3 + 1], VN[nn * 3 + 2]); else { Nn.push(0, 0, 0); conNor = false; }
          if (t >= 0) { U.push(VT[t * 2], 1 - VT[t * 2 + 1]); conUV = true; } else U.push(0, 0);
          porClave.set(key, i); }
        vs.push(i);
      }
      const G = grupos.get(mat) || []; for (let k = 1; k + 1 < vs.length; k++) G.push(vs[0], vs[k], vs[k + 1]); grupos.set(mat, G);
    }
  }
  if (!P.length) throw new Error('pji.sinMalla');
  return { pos: Float32Array.from(P), nor: conNor ? Float32Array.from(Nn) : null, uv: conUV ? Float32Array.from(U) : null, col: conCol ? Float32Array.from(C) : null,
    grupos: [...grupos].map(([m, t]) => ({ mat: m, tris: Uint32Array.from(t) })).filter((g) => g.tris.length), mats, imgs, huesos: null, hb: null, hw: null, humano: null };
}
// los archivos elegidos → la cruda (el principal: .glb/.gltf/.vrm/.obj; los demás son sus texturas, .bin y .mtl)
async function pjiLeerArchivos(files) {
  const arch = new Map(); let prin = null;
  for (const f of files) { const k = pjiNomArch(f.name); arch.set(k, new Uint8Array(await f.arrayBuffer())); if (/\.(glb|gltf|vrm)$/i.test(k) || (!prin && /\.obj$/i.test(k))) prin = /\.obj$/i.test(k) && prin ? prin : k; }
  if (!prin) throw new Error('pji.errFormato');
  const C = /\.obj$/i.test(prin) ? pjiLeerObj(arch, prin) : pjiLeerGltf(arch, prin);
  C.nombre = prin.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').trim().slice(0, 24) || 'Personaje'; C.formato = prin.split('.').pop();
  return C;
}

// ======================= 2. el esqueleto que trae (si es humanoide) =======================
// a los nombres de los huesos del Hero (mixamo): por VRM, por el nombre (de cualquier programa) y, si falta, por la forma
const PJI_VRM = { hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head' };
for (const [v, m] of [['left', 'Left'], ['right', 'Right']]) {
  Object.assign(PJI_VRM, { [v + 'Shoulder']: m + 'Shoulder', [v + 'UpperArm']: m + 'Arm', [v + 'LowerArm']: m + 'ForeArm', [v + 'Hand']: m + 'Hand', [v + 'UpperLeg']: m + 'UpLeg', [v + 'LowerLeg']: m + 'Leg', [v + 'Foot']: m + 'Foot', [v + 'Toes']: m + 'ToeBase' });
  for (const [d, D] of [['Thumb', 'Thumb'], ['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Little', 'Pinky']]) {
    const s = d === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
    s.forEach((x, k) => { PJI_VRM[v + d + x] = m + 'Hand' + D + (k + 1); });
    if (d === 'Thumb') { PJI_VRM[v + 'ThumbIntermediate'] = m + 'HandThumb2'; }   // (VRM 0.x: Proximal, Intermediate, Distal)
  }
}
const PJI_REQ = ['Hips', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
function pjiMapaHumano(C) {
  const H = C.huesos; if (!H || H.length < 10) return null;
  const mapa = {}, usado = new Set(), pon = (k, i) => { if (i !== undefined && i >= 0 && mapa[k] === undefined && !usado.has(i)) { mapa[k] = i; usado.add(i); } };
  const desc = (a, b) => { if (a === undefined || b === undefined) return false; for (let k = H[b].pa; k >= 0; k = H[k].pa) if (k === a) return true; return false; };
  const prof = (i) => { let d = 0; for (let k = i; k >= 0; k = H[k].pa) d++; return d; };
  if (C.humano) { for (const k in C.humano) { const m = PJI_VRM[k]; if (m) pon(m, C.humano[k]); } if (mapa.Spine1 !== undefined && mapa.Spine2 === undefined) { mapa.Spine2 = mapa.Spine1; delete mapa.Spine1; } }
  // por el nombre: el lado (Left/L/_l/.L/izq...) y la parte, en palabras sueltas (CamelCase, _, ., espacios); cada parte junta
  // candidatos y se elige el que cuelga del anterior (un pie suelto de IK no es el pie)
  const palabras = (s) => s.replace(/^.*[:|]/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const lado = (s) => { const w = palabras(s); if (w.some((x) => /^(left|izq\w*|l\d*)$/.test(x))) return 'Left'; if (w.some((x) => /^(right|derech[oa]|r\d*)$/.test(x))) return 'Right'; return ''; };
  const parte = (s) => palabras(s).filter((x) => !/^(left|right|izq\w*|derech[oa]|l\d*|r\d*|mixamorig\d*|bip\d*|valvebiped|def|org|mch|j|bip|cc|base|rig|armature|c)$/.test(x)).join('');
  const reglas = [['Hips', /^(hips?|pelvis|hiproot|roothips|cog)\d*$/], ['Neck', /^neck\d*$/], ['Head', /^head\d*$/], ['Shoulder', /clav|shoulder|collar/],
    ['ForeArm', /forearm|lowerarm|elbow|armlow|lowarm/], ['Hand', /^(hand|wrist)\d*$/], ['Arm', /^(upperarm|arm|uparm|armup|armupper)\d*$/],
    ['UpLeg', /thigh|upleg|upperleg|legup/], ['Leg', /calf|shin|knee|lowerleg|^leg\d*$|leglow|lowleg/], ['Foot', /foot|ankle/], ['ToeBase', /toe|ball/]];
  const cand = {}, add = (k, i) => (cand[k] = cand[k] || []).push(i), sp = [];
  H.forEach((h, i) => {
    const L = lado(h.n), w = palabras(h.n), sl = parte(h.n);
    if (w.some((x) => /^(end|nub|tip|top|twist|roll|helper|ik|pole|target|ctrl|socket|weapon|prop|attach|eye|jaw|tongue|teeth|hair|skirt|breast|bust)\d*$/.test(x))) return;
    const fd = /(thumb|index|middle|ring|pinky|little)/.exec(sl);
    if (fd) { if (L) add(L + 'Dedo' + ({ little: 'Pinky' }[fd[1]] || fd[1][0].toUpperCase() + fd[1].slice(1)), i); return; }
    if (/^(spine|chest|abdomen|torso|waist|upperchest|ribs)\d*$/.test(sl) && !L) { sp.push(i); return; }
    for (const [k, re] of reglas) if (re.test(sl)) { if (['Hips', 'Neck', 'Head'].includes(k)) { if (!L) add(k, i); } else if (L) add(L + k, i); return; }
  });
  const elegir = (k, pa) => { if (mapa[k] !== undefined) return; const L = (cand[k] || []).filter((i) => !usado.has(i) && (pa === undefined || desc(pa, i))); if (L.length) pon(k, L.sort((a, b) => prof(a) - prof(b))[0]); };
  elegir('Hips');
  // (piernas que cuelgan del padre de la cadera —el Robot: «Body» tiene la cadera y los muslos de hijos—: la cadera es ese
  // padre y la «Hips» del archivo pasa a ser la primera vértebra)
  if (mapa.Hips !== undefined && H[mapa.Hips].pa >= 0) { const hp = mapa.Hips, pa = H[hp].pa, ok2 = (L) => (cand[L + 'UpLeg'] || []).some((i) => desc(hp, i)), ok3 = (L) => (cand[L + 'UpLeg'] || []).some((i) => desc(pa, i));
    if (!ok2('Left') && !ok2('Right') && ok3('Left') && ok3('Right')) { usado.delete(hp); delete mapa.Hips; pon('Hips', pa); sp.unshift(hp); } }
  // la columna: de la cadera a la cabeza, en orden (la última va de Spine2, la primera de Spine)
  const col = sp.filter((i) => !usado.has(i) && (mapa.Hips === undefined || desc(mapa.Hips, i))).sort((a, b) => prof(a) - prof(b));
  if (mapa.Spine2 === undefined && mapa.Spine === undefined && col.length) { if (col.length === 1) pon('Spine2', col[0]); else if (col.length === 2) { pon('Spine', col[0]); pon('Spine2', col[1]); } else { pon('Spine', col[0]); pon('Spine1', col[Math.floor(col.length / 2)]); pon('Spine2', col[col.length - 1]); } }
  elegir('Neck', mapa.Hips); elegir('Head', mapa.Neck ?? mapa.Hips);
  for (const L of ['Left', 'Right']) {
    elegir(L + 'Shoulder', mapa.Hips); elegir(L + 'Arm', mapa[L + 'Shoulder'] ?? mapa.Hips); elegir(L + 'ForeArm', mapa[L + 'Arm']); elegir(L + 'Hand', mapa[L + 'ForeArm']);
    elegir(L + 'UpLeg', mapa.Hips); elegir(L + 'Leg', mapa[L + 'UpLeg']); elegir(L + 'Foot', mapa[L + 'Leg']); elegir(L + 'ToeBase', mapa[L + 'Foot']);
  }
  // (pies sueltos de un rig con IK —el Robot de Quaternius: el pie cuelga de la raíz, no de la pierna—: el más cercano a la
  // punta de la pierna pasa a ser su hijo, con su misma pose de reposo)
  const pp = (i) => [H[i].W[12], H[i].W[13], H[i].W[14]];
  for (const L of ['Left', 'Right']) { const lg = mapa[L + 'Leg']; if (mapa[L + 'Foot'] !== undefined || lg === undefined) continue;
    const c = (cand[L + 'Foot'] || []).filter((i) => !usado.has(i)).sort((a, b) => dist3(pp(a), pp(lg)) - dist3(pp(b), pp(lg)))[0];
    if (c !== undefined) { H[c].pa = lg; pon(L + 'Foot', c); elegir(L + 'ToeBase', c); } }
  // por la forma (lo que falta): cadena de la cadera a los pies y del pecho a las manos, el lado por la posición
  pjiMapaForma(C, mapa, usado);
  // (una mano hecha de varias palmas sin hueso de la mano —el Robot de Quaternius—: una mano nueva en el medio de las palmas,
  // que pjiRigPropio agrega y les pone de padre)
  const hijos = (i) => H.map((h, k) => k).filter((k) => H[k].pa === i);
  for (const L of ['Left', 'Right']) { const fa = mapa[L + 'ForeArm']; if (mapa[L + 'Hand'] !== undefined || fa === undefined) continue; const hs = hijos(fa).filter((k) => !usado.has(k));
    if (hs.length === 1) pon(L + 'Hand', hs[0]); else if (hs.length > 1) { mapa._palmas = mapa._palmas || {}; mapa._palmas[L] = hs; mapa[L + 'Hand'] = -1; } }
  for (const L of ['Left', 'Right']) for (const d of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    const h = mapa[L + 'Hand'], ok = (i) => (h >= 0 ? desc(h, i) : (mapa._palmas && mapa._palmas[L] || []).some((p) => p === i || desc(p, i)));
    (cand[L + 'Dedo' + d] || []).filter((i) => !usado.has(i) && ok(i)).sort((a, b) => prof(a) - prof(b)).slice(0, 3).forEach((i, j) => pon(L + 'Hand' + d + (j + 1), i));
  }
  if (!PJI_REQ.every((k) => mapa[k] !== undefined)) return null;
  const ch = (a, b) => (mapa[b] < 0 ? true : desc(mapa[a], mapa[b]));
  for (const L of ['Left', 'Right']) if (!ch(L + 'Arm', L + 'ForeArm') || !ch(L + 'ForeArm', L + 'Hand') || !ch(L + 'UpLeg', L + 'Leg') || !ch(L + 'Leg', L + 'Foot') || !desc(mapa.Hips, mapa[L + 'UpLeg'])) return null;
  if (!desc(mapa.Hips, mapa.Head)) return null;
  return mapa;
}
// los que faltan por la forma del árbol: la cadera es la que tiene dos cadenas para abajo y una para arriba
function pjiMapaForma(C, mapa, usado) {
  const H = C.huesos, nb = H.length, pos = H.map((h) => [h.W[12], h.W[13], h.W[14]]), hijos = H.map(() => []); H.forEach((h, i) => { if (h.pa >= 0) hijos[h.pa].push(i); });
  const pon = (k, i) => { if (i >= 0 && mapa[k] === undefined && !usado.has(i)) { mapa[k] = i; usado.add(i); } };
  // (arriba: lo más alto menos lo más bajo, en el eje de mayor extensión vertical de los huesos —el archivo puede venir acostado—)
  let up = 1; { const ex = [0, 1, 2].map((c) => { let a = Infinity, b = -Infinity; for (const p of pos) { a = Math.min(a, p[c]); b = Math.max(b, p[c]); } return b - a; }); up = ex.indexOf(Math.max(...ex)); if (ex[1] > 0.7 * ex[up]) up = 1; }
  const alt = (i) => pos[i][up], cadena = (i) => { const o = [i]; let k = i; while (hijos[k].length) { k = hijos[k].reduce((a, b) => (subarbol(b) > subarbol(a) ? b : a)); o.push(k); } return o; };
  const memo = new Map(), subarbol = (i) => { if (memo.has(i)) return memo.get(i); let n = 1; for (const c of hijos[i]) n += subarbol(c); memo.set(i, n); return n; };
  if (mapa.Hips === undefined) {
    let best = -1, bs = 0;
    for (let i = 0; i < nb; i++) { const ab = hijos[i].filter((c) => alt(cadena(c).pop()) < alt(i) - 1e-6), ar = hijos[i].filter((c) => alt(cadena(c).pop()) > alt(i)); if (ab.length >= 2 && ar.length >= 1) { const s = subarbol(i); if (s > bs) { bs = s; best = i; } } }
    pon('Hips', best);
  }
  if (mapa.Hips === undefined) return;
  const hi = mapa.Hips, lat = (() => { const c = [0, 1, 2].filter((x) => x !== up); let a = 0, b = 0; for (const p of pos) { a += Math.abs(p[c[0]] - pos[hi][c[0]]); b += Math.abs(p[c[1]] - pos[hi][c[1]]); } return a > b ? c[0] : c[1]; })();
  // las piernas: los hijos de la cadera que bajan (el de x mayor es la izquierda en glTF: +X izquierda)
  const piernas = hijos[hi].filter((c) => alt(cadena(c).pop()) < alt(hi)).sort((a, b) => pos[b][lat] - pos[a][lat]);
  if (piernas.length >= 2) for (const [L, c] of [['Left', piernas[0]], ['Right', piernas[piernas.length - 1]]]) {
    if (mapa[L + 'UpLeg'] !== undefined) continue; let ch = cadena(c); if (ch.length >= 5 && dist3(pos[ch[0]], pos[ch[1]]) < 0.15 * dist3(pos[ch[0]], pos[ch[ch.length - 1]])) ch = ch.slice(1);
    pon(L + 'UpLeg', ch[0]); pon(L + 'Leg', ch[1]); pon(L + 'Foot', ch[2]); if (ch[3] !== undefined) pon(L + 'ToeBase', ch[3]);
  }
  // la columna hasta la cabeza: la cadena de arriba; donde se abre en tres (cuello y dos brazos) es el pecho
  const arr = hijos[hi].filter((c) => alt(cadena(c).pop()) > alt(hi)).sort((a, b) => subarbol(b) - subarbol(a))[0];
  if (arr === undefined) return;
  let k = arr; const col = [];
  while (k !== undefined && hijos[k].length < 3) { col.push(k); k = hijos[k].length ? hijos[k].reduce((a, b) => (subarbol(b) > subarbol(a) ? b : a)) : undefined; }
  if (k === undefined) return; col.push(k);
  if (mapa.Spine === undefined && mapa.Spine2 === undefined) { pon('Spine', col[0]); if (col.length > 2) pon('Spine1', col[Math.floor((col.length - 1) / 2)]); pon('Spine2', col[col.length - 1]); }
  const pecho = k, hs = hijos[pecho].slice().sort((a, b) => Math.abs(pos[a][lat] - pos[pecho][lat]) - Math.abs(pos[b][lat] - pos[pecho][lat]));
  const cue = hs[0]; if (mapa.Head === undefined && cue !== undefined) { const c = cadena(cue); if (c.length >= 2) { pon('Neck', c[0]); pon('Head', c[1]); } else pon('Head', c[0]); }
  const brazos = hs.slice(1).sort((a, b) => pos[b][lat] - pos[a][lat]);
  if (brazos.length >= 2) for (const [L, c] of [['Left', brazos[0]], ['Right', brazos[brazos.length - 1]]]) {
    if (mapa[L + 'Arm'] !== undefined) continue; const ch = cadena(c); const o = ch.length >= 4 ? 1 : 0; if (o) pon(L + 'Shoulder', ch[0]);
    pon(L + 'Arm', ch[o]); pon(L + 'ForeArm', ch[o + 1]); pon(L + 'Hand', ch[o + 2]);
  }
}

// ======================= 3. pararlo derecho y escalarlo =======================
// La base (filas = ejes nuevos en el espacio del archivo): +X la izquierda del personaje, +Y arriba, +Z adelante (los del
// Hero en reposo y los de glTF). Con esqueleto, de los huesos; sin, de la forma: se prueba cada eje de arriba y se queda
// el que tiene dos piernas separadas abajo y una cabeza angosta arriba; adelante, la punta de los pies.
// ¿los nombres de los lados están al revés? (el artista los puso mirando de frente: el «.L» queda a la derecha del personaje).
// Adelante es para donde apuntan los pies (del tobillo a los dedos, o a lo que pesa en el pie); si los nombres dicen lo
// contrario, se cambian Left por Right.
function pjiCambiarLados(mapa) {
  const o = {}; for (const k in mapa) { if (k === '_palmas') continue; o[k.replace(/^Left/, 'R#').replace(/^Right/, 'Left').replace(/^R#/, 'Right')] = mapa[k]; }
  if (mapa._palmas) o._palmas = { Left: mapa._palmas.Right, Right: mapa._palmas.Left }; return o;
}
function pjiEspejado(C, mapa) {
  const [, up, fw] = pjiBaseEsqueleto(C, mapa), H = C.huesos, pp = (i) => [H[i].W[12], H[i].W[13], H[i].W[14]]; let s = [0, 0, 0], n = 0;
  for (const L of ['Left', 'Right']) { const f = mapa[L + 'Foot']; if (f === undefined) continue; let t = mapa[L + 'ToeBase'] !== undefined ? pp(mapa[L + 'ToeBase']) : null;
    if (!t && C.hb) { let c = [0, 0, 0], m = 0; for (let v = 0; v < C.hw.length / 4; v++) if (C.hb[v * 4] === f && C.hw[v * 4] > 0.5) { c = add3(c, [C.pos[v * 3], C.pos[v * 3 + 1], C.pos[v * 3 + 2]]); m++; } if (m > 3) t = sc3(c, 1 / m); }
    if (t) { const d = sub3(t, pp(f)); s = add3(s, sub3(d, sc3(up, dot3(d, up)))); n++; } }
  const l = Math.hypot(...s); return n > 0 && l > 1e-6 && dot3(s, fw) < -0.3 * l;
}
function pjiBaseEsqueleto(C, mapa) {
  const p = (k) => { const W = C.huesos[mapa[k]].W; return [W[12], W[13], W[14]]; };
  const cab = p('Head'), cad = p('Hips'), li = p('LeftUpLeg'), ld = p('RightUpLeg'), up = norm3(sub3(cab, cad));
  let iz = sub3(li, ld); iz = norm3(sub3(iz, sc3(up, dot3(iz, up)))); const fw = cross3(iz, up);
  return [iz, up, fw];
}
function pjiBaseForma(C) {
  const P = C.pos, n = P.length / 3, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const ex = [0, 1, 2].map((c) => mx[c] - mn[c]), hondo = ex.indexOf(Math.min(...ex));
  let mejor = null;
  for (const a of [1, 0, 2]) {
    if (a === hondo) continue; const l = [0, 1, 2].find((c) => c !== a && c !== hondo);
    for (const sg of [1, -1]) {
      const s = pjiPuntajePersona(P, n, a, sg, l, mn, mx) + (a === 1 && sg === 1 ? 0.3 : 0);   // (empate: +Y, la convención de glTF)
      if (!mejor || s > mejor.s) mejor = { s, a, sg, l };
    }
  }
  const e = (c, s) => { const v = [0, 0, 0]; v[c] = s; return v; };
  const up = e(mejor.a, mejor.sg); let fw = e(hondo, 1);
  // adelante: la punta de los pies (lo más bajo) sale más para adelante del centro de la pierna que el talón para atrás
  const z0 = mejor.sg > 0 ? mn[mejor.a] : -mx[mejor.a], h = ex[mejor.a];
  let pie = [Infinity, -Infinity], pier = 0, np = 0;
  for (let i = 0; i < n; i++) { const y = (P[i * 3 + mejor.a] * mejor.sg - z0) / h, z = P[i * 3 + hondo]; if (y < 0.035) { pie[0] = Math.min(pie[0], z); pie[1] = Math.max(pie[1], z); } else if (y > 0.1 && y < 0.2) { pier += z; np++; } }
  if (np && isFinite(pie[0])) { const c = pier / np, ad = pie[1] - c, at = c - pie[0]; if (at > ad * 1.25 + 0.01 * h) fw = e(hondo, -1); }
  else if (C.vrm0) fw = e(hondo, -1);
  const iz = cross3(up, fw);
  return [iz, up, fw];
}
// ¿cuánto parece una persona parada con este eje arriba? dos piernas abajo, la cabeza angosta arriba
function pjiPuntajePersona(P, n, a, sg, l, mn, mx) {
  const G = 48, M = new Uint8Array(G * G), h = mx[a] - mn[a], w = mx[l] - mn[l] || 1, k = (G - 1) / Math.max(h, w);
  for (let i = 0; i < n; i++) { const y = sg > 0 ? P[i * 3 + a] - mn[a] : mx[a] - P[i * 3 + a], x = P[i * 3 + l] - mn[l]; M[Math.min(G - 1, (y * k) | 0) * G + Math.min(G - 1, (x * k) | 0)] = 1; }
  const filas = (y0, y1) => { const runs = []; for (let y = Math.floor(y0 * h * k); y <= Math.floor(y1 * h * k); y++) { let r = 0; for (let x = 0; x < G; x++) { const v = M[y * G + x], u = x ? M[y * G + x - 1] : 0; if (v && !u) r++; } runs.push(r); } return runs; };
  let s = 0; const ab = filas(0.04, 0.2), arr = filas(0.92, 0.99);
  if (ab.filter((r) => r >= 2).length >= ab.length * 0.5) s += 2;
  if (arr.filter((r) => r === 1).length >= arr.length * 0.6) s += 1;
  // (arriba más angosto que el medio)
  const ancho = (y0, y1) => { let a2 = G, b2 = -1; for (let y = Math.floor(y0 * h * k); y <= Math.floor(y1 * h * k); y++) for (let x = 0; x < G; x++) if (M[y * G + x]) { a2 = Math.min(a2, x); b2 = Math.max(b2, x); } return b2 - a2; };
  if (ancho(0.9, 1) < 0.6 * ancho(0.5, 0.8)) s += 1;
  return s;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// la cruda en los ejes del juego y en metros: el piso en y = 0, centrado en el cuerpo; alto: el pedido (o el propio)
function pjiNormalizar(C, base, alto, girado) {
  const [iz0, up, fw0] = base, iz = girado ? sc3(iz0, -1) : iz0, fw = girado ? sc3(fw0, -1) : fw0;
  const P = C.pos, n = P.length / 3, Q = new Float32Array(n * 3);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; Q[i * 3] = iz[0] * x + iz[1] * y + iz[2] * z; const yy = Q[i * 3 + 1] = up[0] * x + up[1] * y + up[2] * z; Q[i * 3 + 2] = fw[0] * x + fw[1] * y + fw[2] * z; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  const h = y1 - y0 || 1, propio = h > 0.4 && h < 3 ? h : PJI_ALTO, s = (alto || propio) / h;
  // (el centro: el de la franja del torso, 45-70 % del alto)
  let cx = 0, cz = 0, m = 0; for (let i = 0; i < n; i++) { const t = (Q[i * 3 + 1] - y0) / h; if (t > 0.45 && t < 0.7) { cx += Q[i * 3]; cz += Q[i * 3 + 2]; m++; } }
  cx = m ? cx / m : 0; cz = m ? cz / m : 0;
  for (let i = 0; i < n; i++) { Q[i * 3] = (Q[i * 3] - cx) * s; Q[i * 3 + 1] = (Q[i * 3 + 1] - y0) * s; Q[i * 3 + 2] = (Q[i * 3 + 2] - cz) * s; }
  const T = (p) => { const x = p[0], y = p[1], z = p[2]; return [((iz[0] * x + iz[1] * y + iz[2] * z) - cx) * s, ((up[0] * x + up[1] * y + up[2] * z) - y0) * s, ((fw[0] * x + fw[1] * y + fw[2] * z) - cz) * s]; };
  const R = (d) => norm3([iz[0] * d[0] + iz[1] * d[1] + iz[2] * d[2], up[0] * d[0] + up[1] * d[1] + up[2] * d[2], fw[0] * d[0] + fw[1] * d[1] + fw[2] * d[2]]);
  // las normales (las que vienen, giradas; si no, se calculan) y los triángulos que quedaron del revés si la base espeja
  const det = dot3(cross3(iz, up), fw), Nn = new Float32Array(n * 3);
  if (C.nor) for (let i = 0; i < n; i++) { const d = R([C.nor[i * 3], C.nor[i * 3 + 1], C.nor[i * 3 + 2]]); Nn.set(d, i * 3); }
  const grupos = C.grupos.map((g) => { if (det > 0) return g; const t = g.tris.slice(); for (let k = 0; k < t.length; k += 3) { const a = t[k + 1]; t[k + 1] = t[k + 2]; t[k + 2] = a; } return { mat: g.mat, tris: t }; });
  if (!C.nor) pjiNormales(Q, grupos, Nn);
  const huesos = C.huesos ? C.huesos.map((hh) => { const W = hh.W, p = T([W[12], W[13], W[14]]), ax = [0, 1, 2].map((c) => R([W[c * 4], W[c * 4 + 1], W[c * 4 + 2]])); return { n: hh.n, pa: hh.pa, p, ax }; }) : null;
  return { pos: Q, nor: Nn, uv: C.uv, col: C.col, grupos, mats: C.mats, imgs: C.imgs, huesos, hb: C.hb, hw: C.hw, alto: h * s, propio, nombre: C.nombre, T };
}
function pjiNormales(P, grupos, N) {
  N.fill(0);
  for (const g of grupos) { const T = g.tris; for (let k = 0; k < T.length; k += 3) { const a = T[k] * 3, b = T[k + 1] * 3, c = T[k + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { N[q] += nx; N[q + 1] += ny; N[q + 2] += nz; } } }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
}

// ======================= 4. los puntos, como en Prisma: sobre la silueta de frente =======================
// (I = izquierda del personaje, +X, que de frente se ve a la derecha de la pantalla; D = derecha)
const PJI_PUNTOS = ['barbilla', 'hombroI', 'hombroD', 'codoI', 'codoD', 'munecaI', 'munecaD', 'ingle', 'rodillaI', 'rodillaD', 'tobilloI', 'tobilloD'];
// la silueta de frente en una grilla (filas desde el piso): para los puntos automáticos
function pjiMascara(Nm, filas) {
  const P = Nm.pos, n = P.length / 3; let x0 = Infinity, x1 = -Infinity, y1 = 0;
  for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const k = (filas - 1) / (y1 || 1), W = Math.ceil((x1 - x0) * k) + 3, H = filas + 2, M = new Uint8Array(W * H);
  const cx = (x) => (x - x0) * k + 1, cy = (y) => y * k + 1;
  for (const g of Nm.grupos) { const T = g.tris; for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ax = cx(P[a]), ay = cy(P[a + 1]), bx = cx(P[b]), by = cy(P[b + 1]), qx = cx(P[c]), qy = cy(P[c + 1]);
    const c0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), c1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx))), r0 = Math.max(0, Math.floor(Math.min(ay, by, qy))), r1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
    const d = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    M[Math.min(H - 1, Math.max(0, Math.floor(ay))) * W + Math.min(W - 1, Math.max(0, Math.floor(ax)))] = 1;
    if (Math.abs(d) < 1e-9) continue;
    for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) { const px = q + 0.5, py = r + 0.5;
      const w0 = ((bx - px) * (qy - py) - (by - py) * (qx - px)) / d, w1 = ((qx - px) * (ay - py) - (qy - py) * (ax - px)) / d;
      if (w0 >= -0.02 && w1 >= -0.02 && 1 - w0 - w1 >= -0.02) M[r * W + q] = 1; }
  } }
  return { M, W, H, k, x0, col: cx, fila: cy, X: (c) => (c - 1) / k + x0, Y: (r) => (r - 1) / k };
}
function pjiPuntosAuto(Nm) {
  const S = pjiMascara(Nm, 260), { M, W, H } = S, xc = S.col(0), runs = [];
  for (let r = 0; r < H; r++) { const L = []; let a = -1; for (let c = 0; c <= W; c++) { const v = c < W && M[r * W + c]; if (v && a < 0) a = c; else if (!v && a >= 0) { L.push([a, c - 1]); a = -1; } } runs.push(L); }
  let rt = H - 1; while (rt > 0 && !runs[rt].length) rt--;
  const enRun = (r, c) => (runs[r] || []).find((q) => q[0] <= c && c <= q[1]);
  const cerca = (r, c) => { let b = null, bd = Infinity; for (const q of runs[r] || []) { const d = c < q[0] ? q[0] - c : c > q[1] ? c - q[1] : 0; if (d < bd) { bd = d; b = q; } } return b; };
  const w = new Float32Array(H + 2); for (let r = 0; r <= rt; r++) { const q = cerca(r, xc); w[r] = q ? q[1] - q[0] + 1 : 0; }
  const m3 = (r) => { const a = w[Math.max(0, r - 1)], b = w[r], c = w[Math.min(rt, r + 1)]; return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c)); };
  // 1) la cabeza, el cuello y el principio de los hombros (bajando desde arriba)
  let maxA = 0, rMax = rt, minS = Infinity, rMin = -1, rS = -1;
  for (let r = rt - 1; r > rt * 0.35; r--) {
    const v = m3(r);
    if (v >= maxA && (rMin < 0 || minS > 0.9 * maxA)) { maxA = v; rMax = r; minS = Infinity; rMin = -1; continue; }
    if (v < minS) { minS = v; rMin = r; }
    if (rMin >= 0 && v >= Math.max(1.35 * maxA, 1.8 * minS) && rMax - r > 2) { rS = r; break; }
  }
  let rCh;
  if (rS >= 0) { rCh = -1; for (let r = rMin; r < rMax; r++) if (m3(r) >= 0.72 * maxA) { rCh = r; break; } if (rCh < 0) rCh = Math.round(rMin + 0.3 * (rMax - rMin)); }
  else { rCh = -1; for (let r = rMax; r > rt * 0.4; r--) if (m3(r) < 0.8 * maxA) { rCh = r; break; } if (rCh < 0) rCh = Math.round(rt * 0.86); rS = Math.round(rCh - 0.05 * rt); rMin = Math.round(rCh - 0.02 * rt); }
  // 2) la ingle: el hueco entre las piernas (filas con el centro vacío y silueta a los dos lados). De los tramos de hueco, el
  //    más alto que cierra debajo del cuello: si cierra en Λ (los muslos se juntan de a poco) es la ingle; si cierra recto y
  //    ahí la silueta se ensancha (o muy abajo), es el ruedo de una pollera o un tapado y la ingle va por proporción
  const hueco = (r) => !enRun(r, xc) && (runs[r] || []).some((q) => q[1] < xc) && (runs[r] || []).some((q) => q[0] > xc);
  const gw = (r) => { let a = -Infinity, b = Infinity; for (const q of runs[r] || []) { if (q[1] < xc) a = Math.max(a, q[1]); if (q[0] > xc) b = Math.min(b, q[0]); } return hueco(r) ? b - a - 1 : 0; };
  const span = (r) => { const L = (runs[r] || []).filter((q) => Math.abs((q[0] + q[1]) / 2 - xc) < 0.3 * rt); return L.length ? L[L.length - 1][1] - L[0][0] + 1 : 0; };
  const tramos = []; let ini = -1;
  for (let r = 1; r < 0.8 * rMin; r++) { if (hueco(r)) { if (ini < 0) ini = r; } else if (ini >= 0) { if (r - ini >= Math.max(2, 0.015 * rt)) tramos.push([ini, r]); ini = -1; } }
  let rC = -1, pollera = false;
  if (tramos.length) {
    const [a, b] = tramos[tramos.length - 1], g1 = gw(b - 1), g2 = gw(Math.max(a, Math.round(b - 1 - 0.06 * rt)));
    const recto = g2 > 0 && g1 > 0.6 * g2 && b - a > 0.05 * rt, ancho = span(b + 1) > 1.08 * span(Math.max(0, b - 2));
    rC = b; if (recto && (ancho || b < 0.2 * rMin)) pollera = true;
  }
  if (rC < 0 || pollera) { pollera = true; rC = Math.max(rC + Math.round(0.04 * rt), Math.round(0.55 * rMin)); }
  // 3) las piernas: el centro de cada una por fila (donde se ven); los tobillos abajo, las rodillas en el medio
  const centroPierna = (r, s) => { if (enRun(r, xc)) return null; const L = (runs[r] || []).filter((q) => (s > 0 ? q[0] > xc - 1 : q[1] < xc + 1) && Math.abs((q[0] + q[1]) / 2 - xc) < 0.35 * rt); if (!L.length) return null; const q = s > 0 ? L[0] : L[L.length - 1]; return (q[0] + q[1]) / 2; };
  const rAnk = Math.round(Math.max(0.025 * rt, Math.min(0.08 * rt, 0.09 * rC))), rMus = Math.round(rC + 0.1 * rC);
  const piernas = {};
  for (const s of [1, -1]) {
    const vis = []; for (let q = Math.max(1, rAnk - 2); q < rC; q++) { const c = centroPierna(q, s); if (c !== null) vis.push([q, c]); }
    const en = (rr) => { if (!vis.length) return xc + s * 0.06 * rt; let b = vis[0]; for (const v of vis) if (Math.abs(v[0] - rr) < Math.abs(b[0] - rr)) b = v; return b[1]; };
    const muslo = en(Math.round(rC - 0.06 * rt)), cAnk = en(rAnk), rKn = Math.round((rMus + rAnk) / 2);
    piernas[s] = { muslo, rod: [en(rKn), rKn], tob: [cAnk, rAnk] };
  }
  // 4) las axilas y los hombros: bajando desde los hombros, donde el ancho del centro se achica de golpe (en T se termina
  //    el brazo; en A se separa del torso)
  const ext = (rr, s) => { const q = cerca(rr, xc); return q ? (s > 0 ? q[1] + 1 - xc : xc - q[0]) : 0; };
  const hom = {}, cp = [], esPierna = (rr, c) => { if (rr >= rC) return false; for (const s of [1, -1]) { const m = cp[s + 1] && cp[s + 1][rr]; if (m === null || m === undefined) continue; const q = enRun(rr, Math.round(m)); if (q && q[0] <= c && c <= q[1]) return true; } return false; };
  for (const s of [1, -1]) { cp[s + 1] = []; for (let rr = 0; rr < rC; rr++) cp[s + 1][rr] = centroPierna(rr, s); }
  for (const s of [1, -1]) {
    let rA = -1, prev = ext(rS, s);
    for (let rr = rS - 1; rr > Math.max(rC, rt * 0.3); rr--) { const e = ext(rr, s); if (e < 0.72 * prev && prev - e > 0.035 * rt) { rA = rr; break; } prev = e; }
    let tS, armT;
    if (rA >= 0) {
      tS = ext(rA, s);
      const col = Math.round(xc + s * (tS + 0.06 * rt)); let v0 = rA; while (v0 < rt && !M[v0 * W + col]) v0++; let v1 = v0; while (v1 < rt && M[(v1 + 1) * W + col]) v1++;
      const tv = M[v0 * W + col] && v0 - rA < 0.05 * rt ? v1 - v0 + 1 : Infinity, sep = (runs[rA - 1] || []).filter((q) => (s > 0 ? q[0] > xc + tS : q[1] < xc - tS)), q2 = sep.length ? sep[s > 0 ? 0 : sep.length - 1] : null, th = q2 ? q2[1] - q2[0] + 1 : Infinity;
      armT = Math.max(0.03 * rt, Math.min(0.12 * rt, Math.min(tv, th, 0.09 * rt)));
    } else { rA = Math.round(rS - 0.04 * rt); tS = Math.max(0.06 * rt, ext(rA, s) * 0.8); armT = 0.07 * rt; }
    const J = [xc + s * Math.max(0.03 * rt, tS - 0.15 * armT), rA + 0.95 * armT];
    // la punta de la mano: lo más lejos del hombro que se llega por la silueta, del lado de afuera del torso
    const vis = new Uint8Array(W * H), cola = [], lat = (c) => s * (c - xc), ok = (rr, c) => rr > rt * 0.12 && rr <= rt && c >= 0 && c < W && M[rr * W + c] && lat(c) >= 0.95 * tS && !esPierna(rr, c);
    for (let rr = Math.round(J[1] - armT); rr <= Math.round(J[1] + armT); rr++) for (let c = Math.round(xc + s * tS); lat(c) <= tS + armT; c += s) if (ok(rr, c) && !vis[rr * W + c]) { vis[rr * W + c] = 1; cola.push(rr * W + c); }
    let tip = null, bd = -1;
    for (let i = 0; i < cola.length; i++) { const id = cola[i], rr = (id / W) | 0, c = id % W, d = Math.hypot(c + 0.5 - J[0], rr + 0.5 - J[1]); if (d > bd) { bd = d; tip = [c + 0.5, rr + 0.5]; }
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = rr + dr, c2 = c + dc; if ((dr || dc) && ok(r2, c2) && !vis[r2 * W + c2]) { vis[r2 * W + c2] = 1; cola.push(r2 * W + c2); } } }
    if (!tip || bd < 0.15 * rt) tip = [J[0] + s * 0.42 * rt, J[1]];
    // codo y muñeca en las proporciones de un brazo (42 % y 75,5 % del hombro a la punta), al medio de la silueta
    const medio = (t) => { const p = [J[0] + (tip[0] - J[0]) * t, J[1] + (tip[1] - J[1]) * t], d = norm3([tip[0] - J[0], tip[1] - J[1], 0]), nx = -d[1], ny = d[0], dentro = (k2) => { const c = Math.floor(p[0] + nx * k2), rr = Math.floor(p[1] + ny * k2); return rr >= 0 && rr < H && c >= 0 && c < W && M[rr * W + c]; };
      if (!dentro(0)) return p; let a = 0, b = 0; while (a > -0.15 * rt && dentro(a - 1)) a--; while (b < 0.15 * rt && dentro(b + 1)) b++; const m = (a + b) / 2; return [p[0] + nx * m, p[1] + ny * m]; };
    hom[s] = { J, tip, codo: medio(0.42), mun: medio(0.755), rA, tS, armT };
  }
  const XY = (c, rr) => [+S.X(c).toFixed(4), +S.Y(rr).toFixed(4)];
  const pts = { barbilla: XY(xc, rCh), ingle: XY(xc, rC) };
  for (const [s, L] of [[1, 'I'], [-1, 'D']]) {
    pts['hombro' + L] = XY(...hom[s].J); pts['codo' + L] = XY(...hom[s].codo); pts['muneca' + L] = XY(...hom[s].mun);
    pts['rodilla' + L] = XY(...piernas[s].rod); pts['tobillo' + L] = XY(...piernas[s].tob);
    pts['muslo' + L] = +S.X(piernas[s].muslo).toFixed(4); pts['punta' + L] = XY(...hom[s].tip);
  }
  pts.tope = +S.Y(rt + 1).toFixed(4); pts.pollera = pollera;
  return pts;
}
// el punto del otro lado (simétrico: espejo en x)
const pjiOtro = (k) => (/I$/.test(k) ? k.slice(0, -1) + 'D' : /D$/.test(k) ? k.slice(0, -1) + 'I' : null);

// ======================= 5. el esqueleto y los pesos =======================
const PJI_HUESOS = [['Hips', -1], ['Spine', 0], ['Spine1', 1], ['Spine2', 2], ['Neck', 3], ['Head', 4],
  ['LeftShoulder', 3], ['LeftArm', 6], ['LeftForeArm', 7], ['LeftHand', 8], ['RightShoulder', 3], ['RightArm', 10], ['RightForeArm', 11], ['RightHand', 12],
  ['LeftUpLeg', 0], ['LeftLeg', 14], ['LeftFoot', 15], ['LeftToeBase', 16], ['RightUpLeg', 0], ['RightLeg', 18], ['RightFoot', 19], ['RightToeBase', 20]];
const PJI_HI = Object.fromEntries(PJI_HUESOS.map(([n], i) => [n, i]));
// (cuánto se mezcla cada articulación, en grosores del miembro: hombros y cadera anchos, muñecas y tobillos cortos)
const PJI_MEZCLA = { Spine: 0.9, Spine1: 0.9, Spine2: 0.9, Neck: 0.6, Head: 0.5, LeftShoulder: 0.5, RightShoulder: 0.5, LeftArm: 0.8, RightArm: 0.8, LeftForeArm: 0.7, RightForeArm: 0.7,
  LeftHand: 0.45, RightHand: 0.45, LeftUpLeg: 0.8, RightUpLeg: 0.8, LeftLeg: 0.7, RightLeg: 0.7, LeftFoot: 0.5, RightFoot: 0.5, LeftToeBase: 0.4, RightToeBase: 0.4 };
// las medidas del Hero en reposo que se copian (dónde van las vértebras y la clavícula entre la cadera, el cuello y el hombro)
function pjiHeroRef() {
  if (PJI.ref) return PJI.ref;
  const D = datosSkin('Hero'), p = (n) => { const i = D.sub.findIndex((x) => x.n === 'mixamorig:' + n); return i >= 0 ? D.rp[i] : null; };
  const hip = p('Hips'), nk = p('Neck'), la = p('LeftArm'), ls = p('LeftShoulder'), cx = (p('LeftUpLeg').x + p('RightUpLeg').x) / 2;
  const f = (n) => { const q = p(n); return q ? (q.y - hip.y) / (nk.y - hip.y) : 0.5; };
  return (PJI.ref = { sp: [f('Spine'), f('Spine1'), f('Spine2')], clX: (ls.x - cx) / (la.x - cx), clY: (ls.y - la.y) / (nk.y - la.y) });
}
// la profundidad (z) del cuerpo en un punto de la vista de frente: el medio del tramo que atraviesa un rayo de adelante hacia
// atrás (el tramo más cerca de zRef si hay varios, como una mano adelante del muslo)
function pjiIndice2D(Nm) {
  if (Nm._ix) return Nm._ix;
  const P = Nm.pos, c = Math.max(0.01, Nm.alto / 60), M = new Map(), T = [];
  for (const g of Nm.grupos) for (let t = 0; t < g.tris.length; t += 3) T.push(g.tris[t], g.tris[t + 1], g.tris[t + 2]);
  for (let t = 0; t < T.length; t += 3) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let k = 0; k < 3; k++) { const x = P[T[t + k] * 3], y = P[T[t + k] * 3 + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) { const k = i * 100003 + j; let L = M.get(k); if (!L) M.set(k, (L = [])); L.push(t); } }
  return (Nm._ix = { c, M, T });
}
function pjiZ(Nm, x, y, zRef) {
  const I = pjiIndice2D(Nm), P = Nm.pos, L = I.M.get(Math.floor(x / I.c) * 100003 + Math.floor(y / I.c)) || [], zs = [];
  for (const t of L) { const a = I.T[t] * 3, b = I.T[t + 1] * 3, c = I.T[t + 2] * 3, d = (P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[c] - P[a]); if (Math.abs(d) < 1e-12) continue;
    const u = ((P[b] - x) * (P[c + 1] - y) - (P[b + 1] - y) * (P[c] - x)) / d, v = ((P[c] - x) * (P[a + 1] - y) - (P[c + 1] - y) * (P[a] - x)) / d; if (u < 0 || v < 0 || u + v > 1) continue;
    zs.push(P[a + 2] * u + P[b + 2] * v + P[c + 2] * (1 - u - v)); }
  if (!zs.length) return zRef === undefined ? 0 : zRef;
  zs.sort((a, b) => a - b); if (zs.length === 1) return zs[0];
  // (tramos: de a pares; sin referencia, el más grueso)
  let best = null, bd = Infinity; for (let i = 0; i + 1 < zs.length; i += 2) { const m = (zs[i] + zs[i + 1]) / 2, d = zRef === undefined ? -(zs[i + 1] - zs[i]) : Math.abs(m - zRef); if (d < bd) { bd = d; best = m; } }
  return best === null ? (zs[0] + zs[zs.length - 1]) / 2 : best;
}
// las articulaciones en 3D a partir de los puntos
function pjiEsqueleto(Nm, pts) {
  const R = pjiHeroRef(), P = Nm.pos, n = P.length / 3, ch = pts.barbilla, ig = pts.ingle;
  const shY = (pts.hombroI[1] + pts.hombroD[1]) / 2, cx = (pts.hombroI[0] + pts.hombroD[0]) / 2;
  const yMus = ig[1] + 0.1 * ig[1], yHip = yMus + 0.05 * ig[1], yNeck = shY + 0.35 * (ch[1] - shY), yHead = ch[1];   // (la cabeza, desde la barbilla: la cara entera va con ella)
  const J = new Array(PJI_HUESOS.length), z = (x, y, r) => pjiZ(Nm, x, y, r);
  const zc = z(cx, (yHip + yNeck) / 2);
  J[0] = [cx, yHip, z(cx, yHip, zc)];
  const ysp = R.sp.map((f) => yHip + (yNeck - yHip) * f); J[1] = [cx, ysp[0], z(cx, ysp[0], zc)]; J[2] = [cx, ysp[1], z(cx, ysp[1], zc)]; J[3] = [cx, ysp[2], z(cx, ysp[2], zc)];
  J[4] = [cx, yNeck, z(cx, yNeck, zc)]; J[5] = [cx, yHead, z(cx, yHead, J[4][2])];
  for (const [L, o] of [['I', 6], ['D', 10]]) {
    const h = pts['hombro' + L], co = pts['codo' + L], mu = pts['muneca' + L];
    const zh = z(h[0], h[1], J[3][2]); J[o + 1] = [h[0], h[1], zh];
    J[o] = [cx + (h[0] - cx) * Math.max(0.15, Math.min(0.6, R.clX)), h[1] + (yNeck - h[1]) * Math.max(0, Math.min(0.8, R.clY)), 0]; J[o][2] = z(J[o][0], J[o][1], J[3][2]);
    J[o + 2] = [co[0], co[1], z(co[0], co[1], zh)]; J[o + 3] = [mu[0], mu[1], z(mu[0], mu[1], J[o + 2][2])];
  }
  const tobs = {};
  for (const [L, s, o] of [['I', 1, 14], ['D', -1, 18]]) {
    const mx = typeof pts['muslo' + L] === 'number' ? pts['muslo' + L] : cx + s * 0.06 * Nm.alto, ro = pts['rodilla' + L], to = pts['tobillo' + L];
    J[o] = [mx, yMus, z(mx, yMus, J[0][2])]; J[o + 1] = [ro[0], ro[1], z(ro[0], ro[1], J[o][2])]; J[o + 2] = [to[0], to[1], z(to[0], to[1], J[o + 1][2])];
    // el pie: la punta es lo más adelante de la malla de ese lado debajo del tobillo; el nacimiento de los dedos, al 70 %
    let tip = null; for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], zz = P[i * 3 + 2]; if (y > to[1] * 1.3 || s * (x - cx) < 0.2 * s * (to[0] - cx)) continue; if (!tip || zz > tip[2]) tip = [x, y, zz]; }
    if (!tip || tip[2] < J[o + 2][2] + 0.02 * Nm.alto) tip = [to[0], 0, J[o + 2][2] + 0.12 * Nm.alto];
    J[o + 3] = [J[o + 2][0] + (tip[0] - J[o + 2][0]) * 0.7, Math.max(0.005, to[1] * 0.3), J[o + 2][2] + (tip[2] - J[o + 2][2]) * 0.68]; tobs[L] = [tip[0], Math.max(0.003, Math.min(tip[1], to[1] * 0.3)), tip[2]];
  }
  // las puntas: la de la mano (lo más lejos pasando la muñeca, en la dirección del antebrazo), la de la cabeza (lo más alto)
  const puntas = {}; let top = 0; for (let i = 0; i < n; i++) top = Math.max(top, P[i * 3 + 1]);
  puntas[5] = [J[5][0], top, J[5][2]];
  for (const o of [6, 10]) {
    const mu = J[o + 3], d = norm3(sub3(mu, J[o + 2])), lb = dist3(J[o + 1], J[o + 2]) + dist3(J[o + 2], mu); let best = null, bd = 0;
    for (let i = 0; i < n; i++) { const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], v = sub3(p, mu), a = dot3(v, d); if (a <= bd || Math.hypot(...sub3(v, sc3(d, a))) > Math.max(a * 0.8, 0.03 * Nm.alto) || dist3(p, mu) > 0.6 * lb) continue; bd = a; best = p; }
    puntas[o + 3] = best && bd > 0.02 * Nm.alto ? best : add3(mu, sc3(d, 0.35 * lb));
  }
  puntas[17] = tobs.I; puntas[21] = tobs.D;
  return { J, puntas };
}
// la grilla de vóxeles del cuerpo: la superficie, y adentro lo que queda encerrado (relleno desde afuera o, si la malla
// tiene agujeros, lo que tiene superficie en las seis direcciones). Una pollera abierta abajo no se rellena.
function pjiVoxeles(Nm, res) {
  const P = Nm.pos, n = P.length / 3, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  // (la grilla: unos 110 vóxeles de alto; en un modelo muy ancho o macizo, menos, para que no pase de ~700 mil)
  const caja = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]), v0 = Nm.alto / (res || 110), vs = Math.max(v0, Math.cbrt(caja / 700000)), pad = 3, o = mn.map((v) => v - pad * vs), nx = Math.ceil((mx[0] - mn[0]) / vs) + 2 * pad + 1, ny = Math.ceil((mx[1] - mn[1]) / vs) + 2 * pad + 1, nz = Math.ceil((mx[2] - mn[2]) / vs) + 2 * pad + 1, N = nx * ny * nz;
  const sup = new Uint8Array(N), id = (i, j, k) => (k * ny + j) * nx + i;
  const marca = (x, y, z) => { sup[id(((x - o[0]) / vs) | 0, ((y - o[1]) / vs) | 0, ((z - o[2]) / vs) | 0)] = 1; };
  for (const g of Nm.grupos) { const T = g.tris; for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const l = Math.max(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), Math.hypot(P[a] - P[c], P[a + 1] - P[c + 1], P[a + 2] - P[c + 2]), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]));
    const m = Math.max(1, Math.min(200, Math.ceil(l / (vs * 0.5))));
    for (let u = 0; u <= m; u++) for (let v = 0; u + v <= m; v++) { const fu = u / m, fv = v / m, fw = 1 - fu - fv; marca(P[a] * fw + P[b] * fu + P[c] * fv, P[a + 1] * fw + P[b + 1] * fu + P[c + 1] * fv, P[a + 2] * fw + P[b + 2] * fu + P[c + 2] * fv); }
  } }
  // afuera: lo que se alcanza desde el borde sin cruzar la superficie
  const fuera = new Uint8Array(N), cola = new Int32Array(N); let qa = 0, qb = 0;
  const empuja = (q) => { if (!sup[q] && !fuera[q]) { fuera[q] = 1; cola[qb++] = q; } };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { empuja(id(i, j, 0)); empuja(id(i, j, nz - 1)); }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { empuja(id(i, 0, k)); empuja(id(i, ny - 1, k)); }
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) { empuja(id(0, j, k)); empuja(id(nx - 1, j, k)); }
  while (qa < qb) { const q = cola[qa++], i = q % nx, j = ((q / nx) | 0) % ny, k = (q / (nx * ny)) | 0;
    if (i > 0) empuja(q - 1); if (i < nx - 1) empuja(q + 1); if (j > 0) empuja(q - nx); if (j < ny - 1) empuja(q + nx); if (k > 0) empuja(q - nx * ny); if (k < nz - 1) empuja(q + nx * ny); }
  // (y con agujeros: encerrado en las seis direcciones)
  const cnt = new Uint8Array(N);
  const linea = (base, paso, len) => { let f = 0; for (let t = 0, q = base; t < len; t++, q += paso) { if (sup[q]) f = 1; else if (f) cnt[q]++; } f = 0; for (let t = len - 1, q = base + paso * (len - 1); t >= 0; t--, q -= paso) { if (sup[q]) f = 1; else if (f) cnt[q]++; } };
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) linea(id(0, j, k), 1, nx);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) linea(id(i, 0, k), nx, ny);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) linea(id(i, j, 0), nx * ny, nz);
  const sol = new Uint8Array(N); let ns = 0; for (let q = 0; q < N; q++) if (sup[q] || !fuera[q] || cnt[q] >= 6) { sol[q] = 1; ns++; }
  return { nx, ny, nz, N, vs, o, sup, sol, ns, id, de: (x, y, z) => { const i = Math.floor((x - o[0]) / vs), j = Math.floor((y - o[1]) / vs), k = Math.floor((z - o[2]) / vs); return i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : id(i, j, k); } };
}
// el grosor en un punto (el radio del miembro): la distancia al aire más cercana, en 26 direcciones
function pjiGrosor(V, p) {
  const q0 = V.de(p[0], p[1], p[2]); if (q0 < 0 || !V.sol[q0]) return 0;
  let m = Infinity;
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!(di || dj || dk)) continue; const l = Math.hypot(di, dj, dk);
    for (let t = 1; t < 60; t++) { const q = V.de(p[0] + di * t * V.vs, p[1] + dj * t * V.vs, p[2] + dk * t * V.vs); if (q < 0 || !V.sol[q]) { m = Math.min(m, (t - 0.5) * l); break; } } }
  return isFinite(m) ? m : 0;
}
// a cada vóxel, el hueso más cercano POR DENTRO (Dijkstra con baldes: 10/14/17 por paso; por el aire sale 7 veces más
// caro, para alcanzar las piezas sueltas —anteojos, pelo, un sombrero— sin que un brazo pegado al costado se lleve el torso;
// por el aire sólo hasta 3 vóxeles del cuerpo)
function pjiEtiquetas(V, segs) {
  const { nx, ny, nz, N, sol } = V, dist = new Uint32Array(N).fill(0xffffffff), lab = new Uint8Array(N).fill(255), AIRE = 7, nxy = nx * ny;
  // (la franja: el cuerpo engordado 3 vóxeles, por ejes; y el borde de la grilla no se expande)
  const cerca = sol.slice(), tmp = new Uint8Array(N);
  for (const [paso, len] of [[1, nx], [nx, ny], [nxy, nz]]) { tmp.set(cerca);
    for (let q = 0; q < N; q++) { if (tmp[q]) continue; const c = paso === 1 ? q % nx : paso === nx ? ((q / nx) | 0) % ny : (q / nxy) | 0;
      for (let d = 1; d <= 3; d++) { if ((c - d >= 0 && tmp[q - d * paso]) || (c + d < len && tmp[q + d * paso])) { cerca[q] = 1; break; } } } }
  const off = new Int32Array(26), cost = new Uint16Array(26); let k = 0;
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj || dk) { off[k] = di + dj * nx + dk * nxy; cost[k++] = [0, 10, 14, 17][Math.abs(di) + Math.abs(dj) + Math.abs(dk)]; }
  const B = Array.from({ length: 256 }, () => []), MB = 255; let cur = 0, pend = 0;
  const pon = (q, d, l) => { if (d < dist[q]) { dist[q] = d; lab[q] = l; B[d & MB].push(q); pend++; } };
  segs.forEach((S, l) => { for (const [a, b, t0, t1] of S) { const L = dist3(a, b), m = Math.max(2, Math.ceil(L / (V.vs * 0.4)));
    for (let s = 0; s <= m; s++) { const t = t0 + (t1 - t0) * s / m, q = V.de(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); if (q >= 0) { cerca[q] = 1; pon(q, 0, l); } } } });
  while (pend > 0) {
    const L = B[cur & MB]; if (!L.length) { cur++; continue; }
    const q = L.pop(); pend--; if (dist[q] !== cur) continue;
    const i = q % nx, j = ((q / nx) | 0) % ny, kk = (q / nxy) | 0; if (!i || !j || !kk || i === nx - 1 || j === ny - 1 || kk === nz - 1) continue;
    const l = lab[q];
    for (let e = 0; e < 26; e++) { const q2 = q + off[e]; if (!cerca[q2]) continue; const d = cur + (sol[q2] ? cost[e] : cost[e] * AIRE); if (d < dist[q2]) { dist[q2] = d; lab[q2] = l; B[d & MB].push(q2); pend++; } }
  }
  return { lab, dist };
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// el rig automático: esqueleto de 22 huesos (los del Hero, sin dedos) y pesos (3 por vértice)
function pjiRig(Nm, pts, opt) {
  const t0 = performance.now(), { J, puntas } = pjiEsqueleto(Nm, pts), nb = PJI_HUESOS.length, P = Nm.pos, NN = Nm.nor, n = P.length / 3;
  const V = pjiVoxeles(Nm, (opt && opt.res) || 110), t1 = performance.now();
  const hijos = PJI_HUESOS.map(() => []); PJI_HUESOS.forEach(([, pa], i) => { if (pa >= 0) hijos[pa].push(i); });
  const fin = (i) => (puntas[i] ? puntas[i] : hijos[i].length === 1 ? J[hijos[i][0]] : i === 0 ? J[1] : i === 3 ? J[4] : J[i]);
  // los segmentos de cada hueso (la cadera también hacia cada muslo y el pecho hacia cada clavícula)
  const sh = 0.6 * V.vs, segs = PJI_HUESOS.map((x, i) => { const a = J[i], b = fin(i), L = Math.max(1e-6, dist3(a, b)), e = Math.min(0.2, sh / L); return [[a, b, e, puntas[i] ? 1 : 1 - e]]; });
  for (const c of [14, 18]) segs[0].push([J[0], J[c], 0, 0.85]); for (const c of [6, 10]) segs[3].push([J[3], J[c], 0, 0.85]);
  const E = pjiEtiquetas(V, segs), t2 = performance.now();
  // la etiqueta de cada vértice: el vóxel medio vóxel hacia adentro (por la normal), y una pierna o un brazo nunca del otro lado
  const lado = PJI_HUESOS.map(([nm]) => (/^Left/.test(nm) ? 1 : /^Right/.test(nm) ? -1 : 0)), espejo = PJI_HUESOS.map(([nm]) => PJI_HI[/^Left/.test(nm) ? 'Right' + nm.slice(4) : /^Right/.test(nm) ? 'Left' + nm.slice(5) : nm]);
  const cx = J[0][0], et = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; let q = V.de(x - NN[v * 3] * 0.5 * V.vs, y - NN[v * 3 + 1] * 0.5 * V.vs, z - NN[v * 3 + 2] * 0.5 * V.vs);
    if (q < 0 || E.lab[q] === 255) q = V.de(x, y, z);
    let l = q >= 0 && E.lab[q] !== 255 ? E.lab[q] : 0;
    if (lado[l] && lado[l] * (x - cx) < -0.01 * Nm.alto && (l >= 14 || Math.abs(x - cx) > 0.08 * Nm.alto)) l = espejo[l];
    et[v] = l;
  }
  // soldar los vértices repetidos (costuras de UV): los mismos pesos para no abrir la malla al moverse
  const sold = new Int32Array(n), mapa = new Map(), cs = 1e-4; let ns = 0;
  for (let v = 0; v < n; v++) { const k = Math.round(P[v * 3] / cs) + ',' + Math.round(P[v * 3 + 1] / cs) + ',' + Math.round(P[v * 3 + 2] / cs); let s = mapa.get(k); if (s === undefined) { s = ns++; mapa.set(k, s); } sold[v] = s; }
  const rep = new Int32Array(ns).fill(-1); for (let v = 0; v < n; v++) if (rep[sold[v]] < 0) rep[sold[v]] = v;
  // las articulaciones: plano, ancho de mezcla (del grosor) y radio
  const art = PJI_HUESOS.map(([nm, pa], i) => {
    if (pa < 0) return null; const p = J[i], dC = norm3(sub3(fin(i), p)), dP = norm3(sub3(p, J[pa])), nrm = dot3(dC, dP) > 0.3 ? norm3(add3(dC, dP)) : dC;
    // (el grosor del miembro: en la articulación o, si queda cerca de la piel, en el medio del hueso de abajo)
    const r = Math.max(1.5, pjiGrosor(V, p), Math.min(pjiGrosor(V, lerp3(p, fin(i), 0.4)), 12)) * V.vs, b = Math.max(1.5 * V.vs, Math.min(0.12 * Nm.alto, (PJI_MEZCLA[nm] || 0.6) * r));
    return { p, n: nrm, r, b, pa };
  });
  const W = new Float32Array(ns * nb), ig = pts.ingle[1], kn = (pts.rodillaI[1] + pts.rodillaD[1]) / 2;
  // (cuánto va al hueso de abajo de una articulación: cerca del eje, por el plano, suave; lejos del eje, lo que dice la etiqueta)
  const g = (A, p, hijo) => { const d = sub3(p, A.p), sd = dot3(d, A.n), rad = Math.hypot(...sub3(d, sc3(A.n, sd))), f = 1 - smooth01(1.6 * A.r, 3 * A.r, rad), h = smooth01(-A.b, A.b, sd); return f * h + (1 - f) * (hijo ? 1 : 0); };
  const semi = Math.max(0.02 * Nm.alto, 0.5 * Math.abs(J[14][0] - J[18][0])), H = Nm.alto;
  for (let s = 0; s < ns; s++) {
    const v = rep[s], p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], X = et[v], w = W.subarray(s * nb, s * nb + nb); w[X] = 1;
    const A = art[X]; if (A) { const h = g(A, p, true); w[A.pa] += 1 - h; w[X] = h; }
    for (const c of hijos[X]) { const h = g(art[c], p, false), t = w[X] * h; w[X] -= t; w[c] += t; }
    // la ingle: en el medio, entre las piernas, mitad cadera y un cuarto de cada muslo (si no, al abrir las piernas se parte)
    if ((X === 0 || X === 1 || X === 14 || X === 18) && PJI.cfg.ingle) { const my = p[1] < ig ? smooth01(ig - 0.07 * H, ig, p[1]) : 1 - smooth01(ig, ig + 0.05 * H, p[1]), m = my * (1 - smooth01(0.15 * semi, 0.7 * semi, Math.abs(p[0] - cx)));
      if (m > 0) { for (let b = 0; b < nb; b++) w[b] *= 1 - m; w[0] += 0.5 * m; w[14] += 0.25 * m; w[18] += 0.25 * m; } }
    // la ropa suelta de abajo (pollera, vestido, tapado): de la cadera, repartida hacia los muslos y las piernas
    if (X <= 2 && p[1] < ig - 0.01 * Nm.alto) {
      const a = 0.85 * smooth01(0, 1, (ig - p[1]) / Math.max(0.05, 0.35 * ig)), d = semi, wl = smooth01(-d, d, p[0] - cx), kk = smooth01(kn + 0.05 * Nm.alto, kn - 0.05 * Nm.alto, p[1]);
      for (let b = 0; b < nb; b++) w[b] *= 1 - a;
      w[14] += a * wl * (1 - kk); w[15] += a * wl * kk; w[18] += a * (1 - wl) * (1 - kk); w[19] += a * (1 - wl) * kk;
    }
  }
  // suavizar por las aristas de la malla, sin tocar la mano (rígida: los dedos no se estiran). Las pasadas salen del largo de
  // las aristas: la mezcla llega a ~2,4 % del alto (4,4 cm en uno de 1,83 m) en una malla densa o en una de pocos polígonos
  const ini = new Int32Array(ns + 1), ady = [], tmp = Array.from({ length: ns }, () => []);
  for (const g2 of Nm.grupos) { const T = g2.tris; for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { const a = sold[T[t + k]], b = sold[T[t + (k + 1) % 3]]; if (a !== b) { tmp[a].push(b); tmp[b].push(a); } } }
  let le = 0, ne = 0;
  for (let s = 0; s < ns; s++) { ini[s] = ady.length; const L = [...new Set(tmp[s])]; for (const o of L) { ady.push(o); if (o > s && ne < 20000) { le += dist3([P[rep[s] * 3], P[rep[s] * 3 + 1], P[rep[s] * 3 + 2]], [P[rep[o] * 3], P[rep[o] * 3 + 1], P[rep[o] * 3 + 2]]); ne++; } } }
  ini[ns] = ady.length; const AD = Int32Array.from(ady), lm = ne ? le / ne : 0.02 * Nm.alto;
  const pasadas = PJI.cfg.suave === 'auto' ? Math.max(2, Math.min(24, Math.round((0.024 * Nm.alto / Math.max(1e-4, lm)) ** 2))) : PJI.cfg.suave;
  const W2 = new Float32Array(W.length);
  for (let it = 0; it < pasadas; it++) { W2.set(W);
    for (let s = 0; s < ns; s++) { const X = et[rep[s]], a = ini[s], z = ini[s + 1]; if (a === z || ((X === 9 || X === 13) && W[s * nb + X] > 0.999)) continue; const k = 0.5 / (z - a);
      for (let b = 0; b < nb; b++) { let m = 0; for (let e = a; e < z; e++) m += W[AD[e] * nb + b]; W2[s * nb + b] = 0.5 * W[s * nb + b] + k * m; } }
    W.set(W2); }
  // los tres más pesados de cada vértice
  const hb = new Uint8Array(n * 3), hw = new Float32Array(n * 3), ord = new Array(nb);
  for (let v = 0; v < n; v++) { const s = sold[v], w = W.subarray(s * nb, s * nb + nb); for (let b = 0; b < nb; b++) ord[b] = b; ord.sort((a, b) => w[b] - w[a]); const t = (w[ord[0]] + w[ord[1]] + w[ord[2]]) || 1;
    for (let k = 0; k < 3; k++) { hb[v * 3 + k] = ord[k]; hw[v * 3 + k] = w[ord[k]] / t; } }
  const huesos = PJI_HUESOS.map(([nm, pa], i) => ({ n: 'pji:' + nm, pa, p: J[i].slice(), q: [0, 0, 0, 1], mix: nm }));
  return { huesos, hb, hw, puntas: { 9: lerp3(J[9], puntas[9], 0.45), 13: lerp3(J[13], puntas[13], 0.45) }, et, vox: V, lab: E.lab, J, ms: { vox: t1 - t0, etiq: t2 - t1, total: performance.now() - t0 }, pasadas };
}

// ======================= 6. con su propio esqueleto (retargeteo) =======================
// Los huesos del archivo, con sus giros de reposo y sus pesos (los tres más pesados de cada vértice); a cada uno del Hero
// el suyo (pjiMapaHumano). Los que no son del Hero (pelo, pollera, huesos de giro) siguen a su padre como en el reposo.
function pjiRigPropio(Nm, mapa) {
  const t0 = performance.now(), H0 = Nm.huesos, n = Nm.pos.length / 3;
  // (las manos que faltan: un hueso nuevo en el medio de las palmas, hijo del antebrazo y padre de las palmas)
  const H = H0.map((h) => ({ n: h.n, pa: h.pa, p: h.p.slice(), q: pjiQdeEjes(h.ax), mix: null })), m2 = Object.assign({}, mapa); delete m2._palmas;
  for (const L in mapa._palmas || {}) { const ps = mapa._palmas[L], fa = mapa[L + 'ForeArm'], c = sc3(ps.reduce((s2, i) => add3(s2, H[i].p), [0, 0, 0]), 1 / ps.length), k = H.length;
    H.push({ n: 'pji:' + L + 'Hand', pa: fa, p: c, q: H[fa].q.slice(), mix: null }); for (const i of ps) H[i].pa = k; m2[L + 'Hand'] = k; }
  for (const k in m2) if (m2[k] >= 0) H[m2[k]].mix = k;
  if (H.length > 255) throw new Error('pji.muchosHuesos');
  // (en orden: cada padre antes que sus hijos, como recorre el juego el esqueleto)
  const orden = [], visto = new Uint8Array(H.length), poner = (i) => { if (visto[i]) return; visto[i] = 1; if (H[i].pa >= 0) poner(H[i].pa); orden.push(i); }; H.forEach((h, i) => poner(i));
  const nuevo = new Int32Array(H.length); orden.forEach((i, k) => { nuevo[i] = k; });
  const huesos = orden.map((i) => Object.assign({}, H[i], { pa: H[i].pa >= 0 ? nuevo[H[i].pa] : -1 }));
  const hb = new Uint8Array(n * 3), hw = new Float32Array(n * 3), o = [0, 1, 2, 3];
  for (let v = 0; v < n; v++) {
    o.sort((a, b) => Nm.hw[v * 4 + b] - Nm.hw[v * 4 + a]); const t = (Nm.hw[v * 4 + o[0]] + Nm.hw[v * 4 + o[1]] + Nm.hw[v * 4 + o[2]]) || 1;
    for (let k = 0; k < 3; k++) { hb[v * 3 + k] = nuevo[Nm.hb[v * 4 + o[k]]]; hw[v * 3 + k] = Nm.hw[v * 4 + o[k]] / t; }
  }
  // (la punta de cada mano sin dedos: el centro de lo que pesa en ella y en lo que cuelga de ella, para alinearla con la del Hero)
  const puntas = {};
  for (const L of ['Left', 'Right']) { const ih = nuevo[m2[L + 'Hand']]; if (m2[L + 'HandMiddle1'] !== undefined) continue;
    const des = new Set([ih]); let cambio = true; while (cambio) { cambio = false; huesos.forEach((h, i) => { if (!des.has(i) && des.has(h.pa)) { des.add(i); cambio = true; } }); }
    let s2 = [0, 0, 0], m = 0; for (let v = 0; v < n; v++) if (des.has(hb[v * 3]) && hw[v * 3] > 0.5) { s2 = add3(s2, [Nm.pos[v * 3], Nm.pos[v * 3 + 1], Nm.pos[v * 3 + 2]]); m++; }
    if (m > 3) { const c = sc3(s2, 1 / m); if (dist3(c, huesos[ih].p) > 0.01 * Nm.alto) puntas[ih] = c; } }
  return { huesos, hb, hw, puntas, propio: true, ms: { total: performance.now() - t0 } };
}
// cuaterniones como [x, y, z, w]
function pjiQdeEjes(ax) {
  // (ortonormal: x, y = la parte de y perpendicular a x, z = x × y)
  const x = norm3(ax[0]), y = norm3(sub3(ax[1], sc3(x, dot3(ax[1], x)))), z = cross3(x, y), t = x[0] + y[1] + z[2]; let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, 0.25 * s]; }
  else if (x[0] > y[1] && x[0] > z[2]) { const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2; q = [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s]; }
  else if (y[1] > z[2]) { const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2; q = [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s]; }
  else { const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2; q = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s]; }
  const l = Math.hypot(...q) || 1; return q.map((c) => c / l);
}
const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };

// ======================= 7. el modelo de jugador (para gmod_pm.js) =======================
// Con las texturas ya leídas (tex[i] = { px, w, h, alfa } o null): el árbol (huesos en metros y en los ejes del juego), las
// mallas con piel (gmvMallas, la misma de los modelos de GMod: grupos de 56 huesos y niveles de detalle) y los materiales.
const PJI_ID3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], pjiPv = (p) => [p[0], p[1], p[2]];
function pjiMateriales(clave, Nm, tex) {
  return Nm.mats.map((m, i) => {
    const nom = 'pji:' + clave + ':' + i, key = nom + '|'; if (GMOD.mats.has(key)) return nom;
    const T = m.img >= 0 && tex && tex[m.img]; let ti;
    if (T) { if (T.ti === undefined) T.ti = gmTexSubir(T.px, T.w, T.h, 'PJI_' + clave + '_' + m.img, T.alfa); ti = T.ti; } else ti = gmTexBlanca();
    const c = [m.c[0], m.c[1], m.c[2], m.c[3] === undefined ? 1 : m.c[3]], mi = DATA.mt.length, M = { n: 'PJI_' + clave + '_' + i, t: ti, ts: [1, 1], to: [0, 0], tt: { _MainTex: [ti, 1, 1, 0, 0] }, cc: { _Color: c }, c, f: {}, gm: 1 };
    if (m.alfa === 'blend' || c[3] < 0.99) M.sh = 'Legacy Shaders/Transparent/Diffuse';
    else if (m.alfa === 'cut' || (T && T.alfa && m.alfa !== 'op')) { M.sh = 'Standard'; M.f = { _Mode: 1, _Glossiness: 0.15, _Metallic: 0 }; }
    else if (T && T.alfa) { M.sh = 'Standard'; M.f = { _Mode: 1, _Glossiness: 0.15, _Metallic: 0 }; }
    else { M.sh = 'Standard'; M.f = { _Mode: 0, _Glossiness: 0.15, _Metallic: 0 }; }
    DATA.mt.push(M); GMOD.mats.set(key, { mi, vmt: null, dos: !!m.dos }); return nom;
  });
}
function pjiDef(clave, Nm, rig, tex) {
  const H = rig.huesos, nb = H.length, n = Nm.pos.length / 3, ruta = 'jxpj/' + clave + '.mdl';
  const arb = [{ n: 'PJI_' + ++PJI.n, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1 }];
  for (const h of H) {
    if (h.pa < 0) { arb.push({ n: h.n, p: h.p.slice(), r: h.q.slice(), s: [1, 1, 1], pa: 0 }); continue; }
    const Pa = H[h.pa], qi = qConj(Pa.q); arb.push({ n: h.n, p: qRot(qi, sub3(h.p, Pa.p)), r: qMul(qi, h.q), s: [1, 1, 1], pa: 1 + h.pa });
  }
  const M = { huesos: H.map((h) => { const [x, y, z, w] = h.q, R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
      const t = [0, 1, 2].map((c) => -(R[0][c] * h.p[0] + R[1][c] * h.p[1] + R[2][c] * h.p[2]));
      return { n: h.n, pa: h.pa, p2b: [R[0][0], R[1][0], R[2][0], t[0], R[0][1], R[1][1], R[2][1], t[1], R[0][2], R[1][2], R[2][2], t[2]] }; }),
    v: { n, pos: Nm.pos, nor: Nm.nor, uv: Nm.uv || new Float32Array(n * 2), hb: rig.hb, w: rig.hw },
    mallas: Nm.grupos.map((g) => ({ modelo: 0, mat: g.mat, tris: g.tris })), pieles: [Nm.mats.map((x, i) => i)], texturas: pjiMateriales(clave, Nm, tex), carpetas: [], secuencias: [], anims: [], adjuntos: [] };
  if (!gmvMallas(M, (h) => 1 + h, 'pji:' + clave + ':' + PJI.n, arb, pjiPv, PJI_ID3, true)) throw new Error('pji.sinMalla');
  const md = new Modelo(arb); md.actualizar();
  const restQ = [], restP = []; for (let i = 0; i < arb.length; i++) { restQ.push(m4quat(md.W[i])); restP.push(v3(md.W[i][12], md.W[i][13], md.W[i][14])); }
  const mix = arb.map((x, i) => (i === 0 || i > nb ? null : H[i - 1].mix || null)), porMix = {}; mix.forEach((m, i) => { if (m && porMix[m] === undefined) porMix[m] = i; });
  let piso = Infinity; for (const x of arb) if (x.m !== undefined) { const d = DATA.ms[x.m]; if (d && d.mn) piso = Math.min(piso, d.mn[1]); } if (!isFinite(piso)) piso = 0;
  const puntaP = {}; for (const k in rig.puntas || {}) puntaP[1 + +k] = v3(...rig.puntas[k]);
  return { ruta, arb, nb, restQ, restP, mix, porMix, piso, M, secs: null, pv: pjiPv, rot: (q) => q, recalcSecs: () => null, puntaP, pji: clave, torso: pjiPerfil(Nm, rig, porMix, restQ, restP) };
}
// el perfil del cuerpo (torso, cadera y muslos) por altura, en los ejes del hueso de la cadera: para que las manos no entren
// en un cuerpo más ancho que el del Hero (gmod_pm.js, gmpFueraDelCuerpo). Por franja: el centro y los dos radios de la elipse.
function pjiPerfil(Nm, rig, porMix, restQ, restP) {
  const hi = porMix.Hips; if (hi === undefined) return null;
  const P = Nm.pos, n = P.length / 3, H = rig.huesos, cuerpo = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'LeftUpLeg', 'RightUpLeg']);
  const q = restQ[hi], qi = q.clone().conj(), o = restP[hi], up = qi.rot(v3(0, 1, 0)), lat = qi.rot(v3(1, 0, 0)), fw = qi.rot(v3(0, 0, 1));
  const ys = []; for (let v = 0; v < n; v++) { const m = H[rig.hb[v * 3]] && H[rig.hb[v * 3]].mix; if (rig.hw[v * 3] < 0.5 || !cuerpo.has(m)) continue; ys.push(v); }
  if (ys.length < 50) return null;
  // (de la mitad del muslo al pecho: 16 franjas)
  let y0 = Infinity, y1 = -Infinity; const loc = ys.map((v) => { const d = qi.rot(v3(P[v * 3] - o.x, P[v * 3 + 1] - o.y, P[v * 3 + 2] - o.z)), r = [vdot(d, lat), vdot(d, up), vdot(d, fw)]; if (r[1] < y0) y0 = r[1]; if (r[1] > y1) y1 = r[1]; return r; });
  const NB = 16, fr = Array.from({ length: NB }, () => ({ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 })), h = (y1 - y0) / NB || 1;
  for (const r of loc) { const f = fr[Math.min(NB - 1, Math.max(0, Math.floor((r[1] - y0) / h)))]; f.x0 = Math.min(f.x0, r[0]); f.x1 = Math.max(f.x1, r[0]); f.z0 = Math.min(f.z0, r[2]); f.z1 = Math.max(f.z1, r[2]); f.n++; }
  return { i: hi, up, lat, fw, y0, h, m: 0.022 * Nm.alto, fr: fr.map((f) => (f.n < 6 ? null : { cx: (f.x0 + f.x1) / 2, cz: (f.z0 + f.z1) / 2, rx: (f.x1 - f.x0) / 2, rz: (f.z1 - f.z0) / 2 })) };
}
// gmod_pm.js pregunta por 'jxpj/<id>.mdl': el de la vista previa, uno ya armado o, si está guardado, se arma (con sus
// texturas, que se leen aparte); mientras tanto null y el personaje se ve con el Hero
function pjiDefDe(ruta) {
  const m = PJI_RUTA.exec(ruta); if (!m) return null; const id = m[1];
  if (PJI.ses && PJI.ses.def && PJI.ses.clave === id) return PJI.ses.def;
  if (PJI.defs.has(id)) return PJI.defs.get(id);
  if (!PJI.t[id] || performance.now() - PJI.t[id] > 15000) { PJI.t[id] = performance.now(); pjiArmarGuardado(id).catch((e) => { if (typeof gmErr === 'function') gmErr('personaje importado ' + id, e); }); }
  return null;
}
// (cuando se termina de armar: los que lo usan lo toman ya, sin esperar a reintentar)
function pjiListo(id) { const r = 'jxpj/' + id + '.mdl'; for (const P of PERS) if (P.gmpRuta === r && !P.gmp) P.gmp = undefined; if (typeof redRehacerSkin === 'function') redRehacerSkin(pjiSkin(id)); }

// ======================= 8. texturas =======================
// a potencia de 2 y como mucho 1024 (512 con poca memoria); los .tga se leen acá (el navegador no los abre)
async function pjiDecodificar(imgs, max) {
  return Promise.all(imgs.map(async (I) => {
    try {
      let src;
      if (/tga/.test(I.mime) || /\.tga$/i.test(I.n)) { const t = pjiTGA(I.bytes); if (!t) return null; const c0 = document.createElement('canvas'); c0.width = t.w; c0.height = t.h; c0.getContext('2d').putImageData(new ImageData(t.px, t.w, t.h), 0, 0); src = c0; }
      else src = await createImageBitmap(new Blob([I.bytes], { type: I.mime || 'image/png' }));
      const pot = (x) => Math.max(4, Math.min(max || 1024, 2 ** Math.round(Math.log2(Math.max(1, x))))), w = pot(src.width), h = pot(src.height);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, w, h);
      const px = new Uint8Array(cx.getImageData(0, 0, w, h).data.buffer); let alfa = false; for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alfa = true; break; }
      if (src.close) src.close();
      return { px, w, h, alfa, cv };
    } catch (e) { return null; }
  }));
}
function pjiTGA(b) {
  if (!b || b.length < 18) return null; const idl = b[0], cm = b[1], tipo = b[2], w = b[12] | (b[13] << 8), h = b[14] | (b[15] << 8), bpp = b[16], desc = b[17];
  if (cm || (tipo !== 2 && tipo !== 10) || (bpp !== 24 && bpp !== 32) || !w || !h || w * h > 4096 * 4096) return null;
  const px = new Uint8ClampedArray(w * h * 4), bp = bpp / 8; let o = 18 + idl, i = 0;
  const pon = (k) => { px[i * 4] = b[k + 2]; px[i * 4 + 1] = b[k + 1]; px[i * 4 + 2] = b[k]; px[i * 4 + 3] = bp === 4 ? b[k + 3] : 255; i++; };
  if (tipo === 2) while (i < w * h && o + bp <= b.length) { pon(o); o += bp; }
  else while (i < w * h && o < b.length) { const c = b[o++], n = (c & 127) + 1; if (c & 128) { for (let k = 0; k < n && i < w * h; k++) pon(o); o += bp; } else for (let k = 0; k < n && i < w * h; k++) { pon(o); o += bp; } }
  if (!(desc & 32)) { const f = w * 4, t = new Uint8ClampedArray(f); for (let y = 0; y < h >> 1; y++) { const a = y * f, c = (h - 1 - y) * f; t.set(px.subarray(a, a + f)); px.copyWithin(a, c, c + f); px.set(t, c); } }
  return { px, w, h };
}

// ======================= 9. la sesión de importar =======================
// leer → pararlo → puntos (o su esqueleto) → rig → modelo. Lo que cambia el jugador (girarlo, el alto, mover un punto) vuelve
// a hacer sólo lo que hace falta.
async function pjiProcesar(files) {
  const t0 = performance.now(), C = await pjiLeerArchivos(files), t1 = performance.now();
  let mapa = C.huesos ? pjiMapaHumano(C) : null; if (mapa && pjiEspejado(C, mapa)) mapa = pjiCambiarLados(mapa);
  const ses = { n: ++PJI.n, C, mapa, propio: !!mapa, usarPropio: !!mapa, girado: false, alto: null, nombre: C.nombre, ms: { leer: t1 - t0 } };
  ses.base = mapa ? pjiBaseEsqueleto(C, mapa) : pjiBaseForma(C);
  ses.tex = await pjiDecodificar(C.imgs, typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024);
  pjiSesNormalizar(ses);
  ses.ms.preparar = performance.now() - t1;
  return ses;
}
function pjiSesNormalizar(ses) {
  ses.Nm = pjiNormalizar(ses.C, ses.base, ses.alto, ses.girado); ses.alto = ses.Nm.alto;
  if (!ses.usarPropio) ses.pts = pjiPuntosAuto(ses.Nm);
  ses.def = null; ses.rig = null;
}
// el rig y el modelo (la clave cambia cada vez: las mallas viejas quedan sin usar y las texturas se reusan)
function pjiSesArmar(ses) {
  const t0 = performance.now();
  ses.rig = ses.usarPropio ? pjiRigPropio(ses.Nm, ses.mapa) : pjiRig(ses.Nm, ses.pts);
  ses.clave = 'vista' + ses.n + '_' + ++PJI.n; ses.ms.rig = performance.now() - t0;
  const t1 = performance.now(); ses.def = pjiDef(ses.clave, ses.Nm, ses.rig, ses.tex); ses.ms.modelo = performance.now() - t1;
  return ses;
}
// otro alto: se escala todo (malla, puntos y esqueleto) sin volver a calcular los pesos
function pjiSesAlto(ses, alto) {
  const k = alto / ses.alto; if (!(k > 0) || Math.abs(k - 1) < 1e-4) return;
  const P = ses.Nm.pos; for (let i = 0; i < P.length; i++) P[i] *= k; ses.Nm.alto = ses.alto = alto; ses.Nm._ix = null;
  if (ses.pts) for (const key in ses.pts) { const v = ses.pts[key]; if (Array.isArray(v)) ses.pts[key] = [v[0] * k, v[1] * k]; else if (typeof v === 'number') ses.pts[key] = v * k; }
  if (ses.Nm.huesos) for (const h of ses.Nm.huesos) h.p = sc3(h.p, k);
  if (ses.rig) { for (const h of ses.rig.huesos) h.p = sc3(h.p, k); for (const key in ses.rig.puntas) ses.rig.puntas[key] = sc3(ses.rig.puntas[key], k);
    ses.clave = 'vista' + ses.n + '_' + ++PJI.n; ses.def = pjiDef(ses.clave, ses.Nm, ses.rig, ses.tex); }
}

// ======================= 10. la vista de frente (para ubicar los puntos) y el retrato =======================
// Dibujada acá, por software, con su textura y una luz de frente: no depende de la placa y anda igual en cualquier aparato.
// vista: { x0, x1, y0, y1 } (el recuadro en metros que se ve). Devuelve el lienzo y cómo pasar de metros a píxeles.
function pjiDibujarFrente(Nm, tex, W, H, vista, cv) {
  const P = Nm.pos, U = Nm.uv, Nn = Nm.nor, n = P.length / 3;
  let x0 = Infinity, x1 = -Infinity, y1 = 0; for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const V = vista || { x0, x1, y0: 0, y1 }, m = 0.06, k = Math.min(W * (1 - 2 * m) / Math.max(1e-6, V.x1 - V.x0), H * (1 - 2 * m) / Math.max(1e-6, V.y1 - V.y0));
  const ox = W / 2 - (V.x0 + V.x1) / 2 * k, oy = H / 2 + (V.y0 + V.y1) / 2 * k, sx = (x) => ox + x * k, sy = (y) => oy - y * k;
  cv = cv || document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'), img = cx.createImageData(W, H), D = img.data, Z = new Float32Array(W * H).fill(-Infinity);
  const L = norm3([-0.35, 0.45, 1]);
  for (const g of Nm.grupos) {
    const mt = Nm.mats[g.mat] || { c: [0.8, 0.8, 0.8, 1], img: -1 }, T = mt.img >= 0 && tex ? tex[mt.img] : null, c = mt.c, Tr = g.tris;
    for (let t = 0; t < Tr.length; t += 3) {
      const a = Tr[t], b = Tr[t + 1], e = Tr[t + 2], ax = sx(P[a * 3]), ay = sy(P[a * 3 + 1]), bx = sx(P[b * 3]), by = sy(P[b * 3 + 1]), ex = sx(P[e * 3]), ey = sy(P[e * 3 + 1]);
      const d = (bx - ax) * (ey - ay) - (by - ay) * (ex - ax); if (Math.abs(d) < 1e-9) continue;
      const c0 = Math.max(0, Math.floor(Math.min(ax, bx, ex))), c1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, ex))), r0 = Math.max(0, Math.floor(Math.min(ay, by, ey))), r1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, ey)));
      if (c0 > c1 || r0 > r1) continue;
      // (la luz: la normal promedio del triángulo, de los dos lados)
      let nx2 = Nn[a * 3] + Nn[b * 3] + Nn[e * 3], ny2 = Nn[a * 3 + 1] + Nn[b * 3 + 1] + Nn[e * 3 + 1], nz2 = Nn[a * 3 + 2] + Nn[b * 3 + 2] + Nn[e * 3 + 2]; const nl = Math.hypot(nx2, ny2, nz2) || 1;
      const luz = 0.42 + 0.62 * Math.abs((nx2 * L[0] + ny2 * L[1] + nz2 * L[2]) / nl);
      for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) {
        const px = q + 0.5, py = r + 0.5, w0 = ((bx - px) * (ey - py) - (by - py) * (ex - px)) / d, w1 = ((ex - px) * (ay - py) - (ey - py) * (ax - px)) / d, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = P[a * 3 + 2] * w0 + P[b * 3 + 2] * w1 + P[e * 3 + 2] * w2, o = r * W + q; if (z <= Z[o]) continue;
        let cr = c[0], cg = c[1], cb = c[2];
        if (T && U) { let u = U[a * 2] * w0 + U[b * 2] * w1 + U[e * 2] * w2, v = U[a * 2 + 1] * w0 + U[b * 2 + 1] * w1 + U[e * 2 + 1] * w2; u -= Math.floor(u); v -= Math.floor(v);
          const ti = ((Math.min(T.h - 1, (v * T.h) | 0) * T.w) + Math.min(T.w - 1, (u * T.w) | 0)) * 4; if (T.px[ti + 3] < 40) continue; cr *= T.px[ti] / 255; cg *= T.px[ti + 1] / 255; cb *= T.px[ti + 2] / 255; }
        Z[o] = z; D[o * 4] = Math.min(255, cr * luz * 255); D[o * 4 + 1] = Math.min(255, cg * luz * 255); D[o * 4 + 2] = Math.min(255, cb * luz * 255); D[o * 4 + 3] = 255;
      }
    }
  }
  cx.putImageData(img, 0, 0);
  return { cv, k, sx, sy, mx: (X) => (X - ox) / k, my: (Y) => (oy - Y) / k };
}
// los puntos encima (con su nombre al lado del que se está moviendo) y las líneas del esqueleto
const PJI_COLOR = { barbilla: '#ffd23f', hombro: '#5ad1ff', codo: '#7cff6b', muneca: '#ff7bd5', ingle: '#ffa53f', rodilla: '#b18cff', tobillo: '#ff6b6b' };
function pjiDibujarPuntos(cx, F, pts, sel, nombres) {
  const P = (k) => [F.sx(pts[k][0]), F.sy(pts[k][1])], lin = (a, b) => { const p = P(a), q = P(b); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); };
  cx.save(); cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 3; cx.beginPath();
  for (const L of ['I', 'D']) { lin('hombro' + L, 'codo' + L); lin('codo' + L, 'muneca' + L); lin('ingle', 'rodilla' + L); lin('rodilla' + L, 'tobillo' + L); lin('barbilla', 'hombro' + L); }
  cx.stroke(); cx.restore();
  const r = Math.max(7, Math.min(12, F.cv.width / 34));
  for (const k of PJI_PUNTOS) {
    const [x, y] = P(k), base = k.replace(/[ID]$/, ''); cx.beginPath(); cx.arc(x, y, k === sel ? r * 1.35 : r, 0, Math.PI * 2);
    cx.fillStyle = PJI_COLOR[base] || '#fff'; cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = k === sel ? '#fff' : 'rgba(0,0,0,.75)'; cx.stroke();
    if (k === sel && nombres) { const t = nombres(k); cx.font = '600 14px Roboto,Arial,sans-serif'; const w = cx.measureText(t).width + 12, tx = Math.min(F.cv.width - w - 2, Math.max(2, x - w / 2)), ty = Math.max(2, y - r * 1.35 - 28);
      cx.fillStyle = 'rgba(12,13,15,.88)'; cx.fillRect(tx, ty, w, 22); cx.fillStyle = '#fff'; cx.fillText(t, tx + 6, ty + 16); }
  }
}
// el retrato (para la lista): de la cintura para arriba, cuadrado
function pjiRetrato(Nm, tex, pts) {
  const tope = pts && pts.tope || Nm.alto, y0 = pts ? Math.max(0, pts.ingle[1] + (tope - pts.ingle[1]) * 0.25) : Nm.alto * 0.5, h = tope - y0;
  const F = pjiDibujarFrente(Nm, tex, 160, 160, { x0: -h / 2, x1: h / 2, y0, y1: tope + h * 0.04 });
  try { return F.cv.toDataURL('image/webp', 0.8).startsWith('data:image/webp') ? F.cv.toDataURL('image/webp', 0.8) : F.cv.toDataURL('image/jpeg', 0.82); } catch (e) { return ''; }
}

// ======================= 11. el paquete (lo que se guarda y lo que viaja por la red) =======================
// 'JXPJ' + versión + largo del JSON + JSON (huesos, materiales, grupos, caja) + binario: posiciones en 16 bits sobre la caja,
// normales en 8, UV en medio float, 3 huesos y 2 pesos por vértice (el tercero es lo que falta), índices y las texturas
// (WebP, o PNG si el navegador no lo hace). Todo en gzip si se puede ('JXPZ'). ~18 bytes por vértice más las texturas.
const PJI_MAX = { nv: 300000, ni: 1800000, hu: 255, img: 16, imgB: 4e6, tot: 8e6 };
async function pjiComprimir(u) {
  if (typeof CompressionStream !== 'function') return u;
  try { const z = new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); const o = new Uint8Array(z.length + 4); o.set([74, 88, 80, 90]); o.set(z, 4); return o; } catch (e) { return u; }
}
async function pjiDescomprimir(b) {
  if (b[0] !== 74 || b[1] !== 88 || b[2] !== 80 || b[3] !== 90) return b;
  const z = b.subarray(4);
  if (typeof DecompressionStream === 'function') { try { return new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); } catch (e) {} }
  if (typeof gunzipJS === 'function') return gunzipJS(z);
  throw new Error('pji.errFormato');
}
async function pjiImgBytes(T, max) {
  let cv = T.cv; if (!cv) return null;
  if (max && (cv.width > max || cv.height > max)) { const c2 = document.createElement('canvas'); c2.width = Math.min(max, cv.width); c2.height = Math.min(max, cv.height); c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); cv = c2; }
  const blob = await new Promise((ok) => { try { cv.toBlob(ok, 'image/webp', 0.88); } catch (e) { ok(null); } });
  const b = blob && blob.type === 'image/webp' ? blob : await new Promise((ok) => cv.toBlob(ok, T.alfa ? 'image/png' : 'image/jpeg', 0.9));
  return b ? { mime: b.type, bytes: new Uint8Array(await b.arrayBuffer()) } : null;
}
async function pjiEmpacar(ses, nombre, maxTex) {
  const Nm = ses.Nm, rig = ses.rig, n = Nm.pos.length / 3, P = Nm.pos, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const sc = mx.map((v, c) => Math.max(1e-6, v - mn[c])), ni = Nm.grupos.reduce((a, g) => a + g.tris.length, 0), i32 = n > 65535;
  const imgs = []; for (const T of ses.tex) imgs.push(T ? await pjiImgBytes(T, maxTex) : null);
  const J = { v: 1, n: String(nombre || 'Personaje').slice(0, 24), alto: +Nm.alto.toFixed(4), nv: n, mn, sc, i32, grupos: Nm.grupos.map((g) => ({ mat: g.mat, n: g.tris.length })),
    mats: Nm.mats.map((m) => ({ c: m.c.slice(0, 4).map((x) => +(+x).toFixed(4)), img: m.img >= 0 && imgs[m.img] ? m.img : -1, alfa: m.alfa, dos: !!m.dos })), imgs: imgs.map((x) => (x ? { mime: x.mime, len: x.bytes.length } : null)),
    huesos: rig.huesos.map((h) => ({ n: String(h.n).slice(0, 64), pa: h.pa, p: h.p.map((x) => +x.toFixed(5)), q: h.q.map((x) => +x.toFixed(6)), mix: h.mix || null })),
    puntas: Object.fromEntries(Object.entries(rig.puntas || {}).map(([k, v]) => [k, v.map((x) => +x.toFixed(5))])), propio: !!rig.propio, pts: ses.pts || null, fecha: Date.now() };
  const js = new TextEncoder().encode(JSON.stringify(J)), al = (x) => (x + 3) & ~3;
  let L = al(9 + js.length); const o = { pos: L }; L = al(L + n * 6); o.nor = L; L = al(L + n * 3); o.uv = L; L = al(L + n * 4); o.hb = L; L = al(L + n * 3); o.hw = L; L = al(L + n * 2); o.ix = L; L = al(L + ni * (i32 ? 4 : 2));
  o.img = L; for (const x of imgs) if (x) L += x.bytes.length;
  const B = new Uint8Array(L), dv = new DataView(B.buffer);
  B.set([74, 88, 80, 74, 1]); dv.setUint32(5, js.length, true); B.set(js, 9);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) dv.setUint16(o.pos + (i * 3 + c) * 2, Math.round((P[i * 3 + c] - mn[c]) / sc[c] * 65535), true);
  for (let i = 0; i < n * 3; i++) dv.setInt8(o.nor + i, Math.max(-127, Math.min(127, Math.round(Nm.nor[i] * 127))));
  const U = Nm.uv; for (let i = 0; i < n * 2; i++) dv.setUint16(o.uv + i * 2, gmF2H(U ? U[i] : 0), true);
  B.set(rig.hb.subarray(0, n * 3), o.hb);
  for (let i = 0; i < n; i++) { const a = Math.round(rig.hw[i * 3] * 255), b = Math.min(255 - a, Math.round(rig.hw[i * 3 + 1] * 255)); B[o.hw + i * 2] = a; B[o.hw + i * 2 + 1] = b; }
  let q = o.ix; for (const g of Nm.grupos) for (let t = 0; t < g.tris.length; t++) { if (i32) { dv.setUint32(q, g.tris[t], true); q += 4; } else { dv.setUint16(q, g.tris[t], true); q += 2; } }
  q = o.img; for (const x of imgs) if (x) { B.set(x.bytes, q); q += x.bytes.length; }
  return pjiComprimir(B);
}
// (_h2f: medio float → número, de gmod_formatos.js)
async function pjiDesempacar(b0) {
  const B = await pjiDescomprimir(b0); if (B.length > PJI_MAX.tot * 2 || B[0] !== 74 || B[1] !== 88 || B[2] !== 80 || B[3] !== 74 || B[4] !== 1) throw new Error('pji.errFormato');
  const dv = new DataView(B.buffer, B.byteOffset, B.byteLength), jl = dv.getUint32(5, true); if (9 + jl > B.length) throw new Error('pji.errFormato');
  const J = JSON.parse(pjiTD.decode(B.subarray(9, 9 + jl))), n = J.nv | 0, ni = (J.grupos || []).reduce((a, g) => a + (g.n | 0), 0), nh = (J.huesos || []).length;
  if (!(n > 0 && n <= PJI_MAX.nv && ni > 0 && ni <= PJI_MAX.ni && ni % 3 === 0 && nh > 0 && nh <= PJI_MAX.hu && (J.imgs || []).length <= PJI_MAX.img && (J.mats || []).length <= 64)) throw new Error('pji.errFormato');
  const al = (x) => (x + 3) & ~3; let L = al(9 + jl); const o = { pos: L }; L = al(L + n * 6); o.nor = L; L = al(L + n * 3); o.uv = L; L = al(L + n * 4); o.hb = L; L = al(L + n * 3); o.hw = L; L = al(L + n * 2); o.ix = L; L = al(L + ni * (J.i32 ? 4 : 2)); o.img = L;
  const tamImg = (J.imgs || []).reduce((a, x) => a + (x ? x.len | 0 : 0), 0); if (L + tamImg > B.length) throw new Error('pji.errFormato');
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), hb = new Uint8Array(n * 3), hw = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) P[i * 3 + c] = J.mn[c] + dv.getUint16(o.pos + (i * 3 + c) * 2, true) / 65535 * J.sc[c];
  for (let i = 0; i < n * 3; i++) N[i] = dv.getInt8(o.nor + i) / 127;
  for (let i = 0; i < n * 2; i++) U[i] = _h2f(dv.getUint16(o.uv + i * 2, true));
  hb.set(B.subarray(o.hb, o.hb + n * 3)); for (let i = 0; i < n * 3; i++) if (hb[i] >= nh) hb[i] = 0;
  for (let i = 0; i < n; i++) { const a = B[o.hw + i * 2] / 255, b = B[o.hw + i * 2 + 1] / 255; hw[i * 3] = a; hw[i * 3 + 1] = b; hw[i * 3 + 2] = Math.max(0, 1 - a - b); }
  let q = o.ix; const grupos = J.grupos.map((g) => { const t = new Uint32Array(g.n | 0); for (let k = 0; k < t.length; k++) { t[k] = J.i32 ? dv.getUint32(q, true) : dv.getUint16(q, true); q += J.i32 ? 4 : 2; if (t[k] >= n) t[k] = 0; } return { mat: Math.max(0, Math.min(J.mats.length - 1, g.mat | 0)), tris: t }; });
  q = o.img; const imgs = (J.imgs || []).map((x) => { if (!x) return null; const b = B.slice(q, q + (x.len | 0)); q += x.len | 0; return { bytes: b, mime: /^image\/(webp|png|jpeg)$/.test(x.mime) ? x.mime : 'image/png', n: 'img' }; });
  const huesos = J.huesos.map((h, i) => ({ n: String(h.n || 'h' + i).slice(0, 64), pa: Number.isInteger(h.pa) && h.pa < i ? h.pa : -1, p: (h.p || [0, 0, 0]).slice(0, 3).map(Number), q: (h.q || [0, 0, 0, 1]).slice(0, 4).map(Number), mix: typeof h.mix === 'string' ? h.mix.slice(0, 32) : null }));
  const puntas = {}; for (const k in J.puntas || {}) if (+k >= 0 && +k < nh) puntas[k] = J.puntas[k].slice(0, 3).map(Number);
  const mats = J.mats.map((m) => ({ c: (m.c || [1, 1, 1, 1]).map(Number), img: m.img >= 0 && m.img < imgs.length ? m.img : -1, alfa: ['op', 'cut', 'blend'].includes(m.alfa) ? m.alfa : 'op', dos: !!m.dos }));
  return { J, Nm: { pos: P, nor: N, uv: U, grupos, mats, alto: +J.alto || 1.8 }, rig: { huesos, hb, hw, puntas, propio: !!J.propio }, imgs };
}
// la huella (el id): el mismo paquete, el mismo personaje en todos los aparatos
function pjiHuella(b) { let h1 = 2166136261, h2 = 0x9e3779b9; for (let i = 0; i < b.length; i++) { h1 = Math.imul(h1 ^ b[i], 16777619); h2 = Math.imul(h2 ^ b[i], 2246822519); } return 'u' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + b.length.toString(36); }

// ======================= 12. guardados en el aparato =======================
// dos almacenes: 'pj' (lo de la lista: nombre, retrato, alto) y 'pk' (el paquete); sin IndexedDB, hasta recargar
function pjiDB() {
  if (PJI.db) return PJI.db;
  return (PJI.db = new Promise((ok) => { try { const r = indexedDB.open('jxmod-personajes', 1); r.onupgradeneeded = () => { r.result.createObjectStore('pj', { keyPath: 'id' }); r.result.createObjectStore('pk'); }; r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } }));
}
const pjiTx = (db, st, modo, f) => new Promise((ok) => { try { const t = db.transaction(st, modo), r = f(t.objectStore(st)); t.oncomplete = () => ok(r && r.result); t.onerror = t.onabort = () => ok(null); } catch (e) { ok(null); } });
async function pjiCargarLista() {
  if (PJI.cargada) return PJI.lista; const db = await pjiDB();
  const L = db ? await pjiTx(db, 'pj', 'readonly', (s) => s.getAll()) : null; PJI.lista = (L || PJI.lista).sort((a, b) => (a.fecha || 0) - (b.fecha || 0)); PJI.cargada = true;
  if (typeof pjmDibujar === 'function') pjmDibujar(); return PJI.lista;
}
async function pjiPaquete(id) {
  if (PJI.packs.has(id)) return PJI.packs.get(id);
  const db = await pjiDB(); const b = db ? await pjiTx(db, 'pk', 'readonly', (s) => s.get(id)) : null;
  if (b) PJI.packs.set(id, b instanceof Uint8Array ? b : new Uint8Array(b)); return PJI.packs.get(id) || null;
}
async function pjiGuardar(meta, pack) {
  PJI.packs.set(meta.id, pack); PJI.lista = PJI.lista.filter((x) => x.id !== meta.id).concat([meta]);
  const db = await pjiDB(); if (!db) return false;
  await pjiTx(db, 'pk', 'readwrite', (s) => s.put(pack, meta.id)); await pjiTx(db, 'pj', 'readwrite', (s) => s.put(meta)); return true;
}
async function pjiBorrar(id) {
  PJI.lista = PJI.lista.filter((x) => x.id !== id); PJI.packs.delete(id); PJI.defs.delete(id);
  if (PREFS.skin === pjiSkin(id)) { PREFS.skin = 'Hero'; guardarPrefs(); if (typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && JUG.vivo) jugadorCuerpoNuevo(); }
  const db = await pjiDB(); if (db) { await pjiTx(db, 'pk', 'readwrite', (s) => s.delete(id)); await pjiTx(db, 'pj', 'readwrite', (s) => s.delete(id)); }
  if (typeof pjmDibujar === 'function') pjmDibujar();
}
// uno guardado (o que llegó por la red) → el modelo: se desempaca, se leen las texturas y se arma
async function pjiArmarGuardado(id) {
  if (PJI.defs.has(id)) return PJI.defs.get(id);
  const b = await pjiPaquete(id); if (!b) return null;
  const U = await pjiDesempacar(b), tex = await pjiDecodificar(U.imgs, typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024);
  const def = pjiDef(id, U.Nm, U.rig, tex); def.nombre = U.J.n; PJI.defs.set(id, def); pjiListo(id); return def;
}
// el nombre que se muestra (los míos, por la lista; los de otros, por su paquete)
function pjiNombre(s) { const id = pjiIdDe(s); if (!id) return null; const m = PJI.lista.find((x) => x.id === id); return (m && m.n) || (PJI.defs.get(id) && PJI.defs.get(id).nombre) || 'Personaje'; }

// ======================= 13. en multijugador: los demás lo bajan del que lo tiene puesto =======================
// El que no lo tiene lo pide (a la sala, diciendo a quién); el dueño lo manda de a pedazos (24 mil letras, 8 por segundo, como
// los memes y las maquinitas) y lo reciben todos los que no lo tenían. Se guarda mientras dure la partida.
function pjiRedSkin(d) {
  const id = pjiIdDe(d.k); if (!id) return null; const real = pjiSkin(id);
  if (PJI.defs.has(id) || PJI.packs.has(id) || PJI.lista.some((x) => x.id === id)) return { real, skin: real };
  pjiPedir(id, d.i); return { real, skin: 'Hero' };
}
function pjiPedir(id, de) {
  const p = PJI.pidiendo.get(id) || { t: -1e9, n: 0 }, t = performance.now(); if (t - p.t < 12000 || p.n >= 6) return;
  p.t = t; p.n++; PJI.pidiendo.set(id, p); if (typeof publicar === 'function') publicar('a', { k: 'pjq', g: id, to: typeof de === 'string' ? de.slice(0, 20) : '' });
}
async function pjiMandar(id) {
  if (PJI.enviando.has(id)) return; PJI.enviando.add(id);
  try {
    const b = await pjiPaquete(id); if (!b || b.length > PJI_MAX.tot) return;
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    const d = btoa(s), P = []; for (let i = 0; i < d.length; i += 24000) P.push(d.slice(i, i + 24000));
    for (let x = 0; x < P.length; x++) { if (!RED.on) break; publicar('a', { k: 'pjd', g: id, x, n: P.length, d: P[x] }); await new Promise((ok) => setTimeout(ok, 125)); }
  } finally { setTimeout(() => PJI.enviando.delete(id), 3000); }
}
function pjiRed(d) {
  if (typeof d.g !== 'string' || !/^[a-z0-9_]{6,40}$/.test(d.g)) return;
  if (d.k === 'pjq') { if ((!d.to || d.to === RED.ID) && PJI.lista.some((x) => x.id === d.g)) pjiMandar(d.g); return; }
  if (d.k !== 'pjd' || typeof d.d !== 'string' || PJI.packs.has(d.g) || PJI.lista.some((x) => x.id === d.g)) return;
  const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 460 || i < 0 || i >= n || d.d.length > 24000) return;
  let e = PJI.partes.get(d.g); if (!e || e.n !== n || performance.now() - e.t > 90000) { e = { n, p: new Array(n), llegaron: 0, t: performance.now() }; PJI.partes.set(d.g, e); }
  if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; }
  if (e.llegaron < n) return;
  PJI.partes.delete(d.g);
  try {
    const s = atob(e.p.join('')), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k);
    if (pjiHuella(b) !== d.g) return;   // (lo que llegó tiene que ser ese personaje: el id es la huella del paquete)
    PJI.packs.set(d.g, b); PJI.t[d.g] = 0; pjiArmarGuardado(d.g).catch((x) => { PJI.packs.delete(d.g); if (typeof gmErr === 'function') gmErr('personaje de la red ' + d.g, x); });
  } catch (x) {}
}

// ======================= 14. la ventana: Importar personaje =======================
// 1) elegir el archivo · 2) los puntos (sólo si no trae esqueleto) · 3) probarlo con las animaciones del juego (a la derecha,
// el personaje en 3D, como en Personajes) y guardarlo. Un solo punto de entrada: pjiAbrir().
const PJI_ANIMS = [['quieto', 'pji.aQuieto'], ['caminar', 'pji.aCaminar'], ['correr', 'pji.aCorrer'], ['saltar', 'pji.aSaltar'], ['agacharse', 'pji.aAgachar'], ['saludar', 'pji.aSaludar'], ['bailar', 'pji.aBailar']];
const PJI_ACEPTA = '.glb,.gltf,.vrm,.obj,.mtl,.bin,.png,.jpg,.jpeg,.webp,.tga,.gma';
function pjiCss() {
  if (document.getElementById('pjiCss')) return; const st = document.createElement('style'); st.id = 'pjiCss';
  st.textContent = `#pjiVen{position:fixed;inset:0;z-index:70;display:flex;font-family:Roboto,Arial,sans-serif;color:var(--jxT,#efede7)}
#pjiVen.oc{display:none}#pjiVen .pjiPan{width:min(560px,54vw);height:100%;box-sizing:border-box;background:var(--jxFo,rgba(12,13,15,.96));display:flex;flex-direction:column;border-right:1px solid var(--jxLin,rgba(239,237,231,.12));box-shadow:4px 0 24px rgba(0,0,0,.35)}
#pjiVen .pjiDer{flex:1;cursor:grab;touch-action:none;position:relative}#pjiVen .pjiDer.vacio{background:rgba(0,0,0,.45);cursor:default}
#pjiVen .pjiGiro{position:absolute;left:50%;bottom:max(14px,calc(var(--vh,1vh)*4));transform:translateX(-50%);background:rgba(12,13,15,.72);padding:6px 12px;border-radius:999px;font:500 clamp(12px,calc(var(--vh,1vh)*2.4),15px)/1.2 Roboto,Arial,sans-serif;white-space:nowrap;pointer-events:none}
#pjiVen .pjiCab{display:flex;align-items:center;gap:10px;padding:max(8px,calc(var(--vh,1vh)*2)) 14px;border-bottom:1px solid var(--jxLin,rgba(239,237,231,.12))}
#pjiVen .pjiTit{font:600 clamp(15px,calc(var(--vh,1vh)*3.6),22px)/1 var(--jxF,Roboto,Arial,sans-serif);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pjiVen .pjiPasos{display:flex;gap:6px;margin-left:auto}#pjiVen .pjiPasos i{font:700 12px/22px Roboto,Arial,sans-serif;font-style:normal;width:22px;height:22px;text-align:center;border-radius:50%;background:var(--jxPl3,#313237);color:var(--jxT2,#aeaca6)}
#pjiVen .pjiPasos i.sel{background:var(--jxA,#f2b31b);color:#121212}#pjiVen .pjiPasos i.hecho{background:#3d6b4a;color:#fff}
#pjiVen .pjiX{width:36px;height:36px;border:0;border-radius:4px;background:var(--jxPl2,#26272b);color:inherit;font-size:18px;cursor:pointer;flex:none}
#pjiVen .pjiCuerpo{flex:1;min-height:0;overflow:auto;padding:max(8px,calc(var(--vh,1vh)*2)) 14px;display:flex;flex-direction:column;gap:max(8px,calc(var(--vh,1vh)*1.6))}
#pjiVen .pjiPie{display:flex;gap:8px;padding:max(8px,calc(var(--vh,1vh)*1.8)) 14px;border-top:1px solid var(--jxLin,rgba(239,237,231,.12));align-items:center;flex-wrap:wrap}
#pjiVen .pjiPie .esp{flex:1}
#pjiVen .pjiBtn{min-height:max(38px,calc(var(--vh,1vh)*8));padding:0 14px;border:0;border-radius:4px;background:var(--jxPl2,#26272b);color:var(--jxT,#efede7);font:500 clamp(12px,calc(var(--vh,1vh)*2.9),17px)/1 var(--jxF,Roboto,Arial,sans-serif);text-transform:uppercase;letter-spacing:.04em;display:inline-flex;align-items:center;gap:.5em;cursor:pointer;white-space:nowrap}
#pjiVen .pjiBtn:hover{background:var(--jxPl3,#313237)}#pjiVen .pjiBtn.si{background:var(--jxA,#f2b31b);color:#121212;font-weight:600}#pjiVen .pjiBtn.si:hover{background:var(--jxA2,#ffc531)}
#pjiVen .pjiBtn[disabled]{opacity:.45;cursor:default}#pjiVen .pjiBtn .gli{width:1.1em;height:1.1em}
#pjiVen .pjiZona{border:2px dashed rgba(239,237,231,.32);border-radius:8px;padding:max(14px,calc(var(--vh,1vh)*4)) 16px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;cursor:pointer;background:rgba(239,237,231,.03)}
#pjiVen .pjiZona:hover,#pjiVen .pjiZona.arr{border-color:var(--jxA,#f2b31b);background:rgba(242,179,27,.07)}
#pjiVen .pjiZona .gli{width:clamp(26px,calc(var(--vh,1vh)*8),44px);height:clamp(26px,calc(var(--vh,1vh)*8),44px);color:var(--jxA,#f2b31b)}
#pjiVen .pjiZona b{font:600 clamp(14px,calc(var(--vh,1vh)*3.2),19px)/1.2 var(--jxF,Roboto,Arial,sans-serif);text-transform:uppercase;letter-spacing:.03em}
#pjiVen small,#pjiVen .pjiAyuda{color:var(--jxT2,#aeaca6);font-size:clamp(12px,calc(var(--vh,1vh)*2.3),14px);line-height:1.35}
#pjiVen ul.pjiTips{margin:0;padding-left:18px;color:var(--jxT2,#aeaca6);font-size:clamp(12px,calc(var(--vh,1vh)*2.3),14px);line-height:1.5}
#pjiVen .pjiPaso{font:600 clamp(14px,calc(var(--vh,1vh)*3.2),20px)/1.1 var(--jxF,Roboto,Arial,sans-serif);text-transform:uppercase;letter-spacing:.04em;color:var(--jxA,#f2b31b)}
#pjiVen .pjiSub{font:600 clamp(12px,calc(var(--vh,1vh)*2.4),14px)/1 var(--jxF,Roboto,Arial,sans-serif);text-transform:uppercase;letter-spacing:.05em;color:var(--jxT3,#8f8d88)}
#pjiVen .pjiMios{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
#pjiVen .pjiMio{position:relative;background:var(--jxPl,#1b1c1f);border-radius:6px;overflow:hidden;cursor:pointer;border:1px solid transparent}#pjiVen .pjiMio.sel{border-color:var(--jxA,#f2b31b)}
#pjiVen .pjiMio i{display:block;aspect-ratio:1;background:#0e0f11 center/cover no-repeat}#pjiVen .pjiMio b{display:block;font:500 12px/1.2 Roboto,Arial,sans-serif;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pjiVen .pjiMio button{position:absolute;top:4px;right:4px;width:26px;height:26px;border:0;border-radius:4px;background:rgba(12,13,15,.8);color:#ff8a7e;cursor:pointer;display:flex;align-items:center;justify-content:center}#pjiVen .pjiMio button .gli{width:15px;height:15px}
#pjiVen .pjiLienzo{flex:1;min-height:150px;position:relative;background:#0e0f11;border-radius:6px;touch-action:none;overflow:hidden}#pjiVen .pjiLienzo canvas{position:absolute;inset:0;width:100%;height:100%;cursor:pointer}
#pjiVen .pjiFila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#pjiVen .pjiChk{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:clamp(12px,calc(var(--vh,1vh)*2.6),15px)}#pjiVen .pjiChk input{width:18px;height:18px;accent-color:var(--jxA,#f2b31b)}
#pjiVen .pjiChips{display:flex;flex-wrap:wrap;gap:6px}#pjiVen .pjiChip{min-height:max(34px,calc(var(--vh,1vh)*7));padding:0 12px;border:1px solid rgba(239,237,231,.2);border-radius:999px;background:transparent;color:inherit;font:500 clamp(12px,calc(var(--vh,1vh)*2.6),15px)/1 Roboto,Arial,sans-serif;cursor:pointer}
#pjiVen .pjiChip.sel{background:var(--jxA,#f2b31b);border-color:var(--jxA,#f2b31b);color:#121212}
#pjiVen label.pjiCampo{display:flex;align-items:center;gap:10px;font-size:clamp(12px,calc(var(--vh,1vh)*2.6),15px)}#pjiVen label.pjiCampo>span{min-width:52px;color:var(--jxT2,#aeaca6)}
#pjiVen label.pjiCampo input[type=text]{flex:1;min-width:0;height:max(34px,calc(var(--vh,1vh)*7));box-sizing:border-box;padding:0 10px;border:1px solid rgba(239,237,231,.2);border-radius:4px;background:#0e0f11;color:inherit;font:inherit}
#pjiVen label.pjiCampo input[type=range]{flex:1;accent-color:var(--jxA,#f2b31b)}#pjiVen label.pjiCampo output{min-width:58px;text-align:right;font-variant-numeric:tabular-nums}
#pjiVen .pjiNota{background:rgba(95,211,133,.1);border:1px solid rgba(95,211,133,.35);border-radius:6px;padding:10px 12px;font-size:clamp(12px,calc(var(--vh,1vh)*2.5),15px);line-height:1.35}
#pjiVen .pjiError{background:rgba(255,107,94,.1);border:1px solid rgba(255,107,94,.45);border-radius:6px;padding:10px 12px;font-size:clamp(12px,calc(var(--vh,1vh)*2.5),15px)}
#pjiVen .pjiEspera{display:flex;align-items:center;gap:12px;padding:20px 4px;font-size:clamp(13px,calc(var(--vh,1vh)*2.8),16px)}
#pjiVen .pjiEspera i{width:22px;height:22px;border:3px solid rgba(239,237,231,.2);border-top-color:var(--jxA,#f2b31b);border-radius:50%;animation:pjiGira .8s linear infinite}@keyframes pjiGira{to{transform:rotate(360deg)}}
body.pjiAbierto #pausa,body.pjiAbierto #pjJuego{visibility:hidden}
@media (max-height:500px){#pjiVen ul.pjiTips{display:none}#pjiVen .pjiPan{width:min(520px,56vw)}#pjiVen .pjiAyuda,#pjiVen .pjiPaso{display:none}
  #pjiVen .pjiCuerpo{padding-top:6px;padding-bottom:6px;gap:6px}#pjiVen .pjiCab{padding-top:5px;padding-bottom:5px}#pjiVen .pjiPie{padding-top:5px;padding-bottom:5px}}`;
  document.head.appendChild(st);
}
// abrir: en el menú (Personajes → Mods) o en la pausa (Personaje → Mods)
function pjiAbrir() {
  pjiCss(); pjiCargarLista();
  let V = document.getElementById('pjiVen');
  if (!V) { V = document.createElement('div'); V.id = 'pjiVen'; V.className = 'oc'; document.body.appendChild(V); pjiMontar(V); }
  PJI.ui = { paso: 1, error: '', prevAbierto: typeof UI !== 'undefined' ? UI.abierto : null, prevLobby: typeof MENU !== 'undefined' ? !!MENU.lobby : false, anim: 'caminar' };
  if (typeof UI !== 'undefined') UI.abierto = 'pji';
  // (mientras está abierta, lo de atrás —los menús, la pausa— no se ve: a la derecha sólo el personaje en 3D)
  V.classList.remove('oc'); document.body.classList.add('pjiAbierto'); if (typeof RB !== 'undefined' && RB.el) RB.el.style.visibility = 'hidden'; pjiDibujarUI();
}
function pjiCerrar() {
  const V = document.getElementById('pjiVen'); if (V) V.classList.add('oc');
  document.body.classList.remove('pjiAbierto'); if (typeof RB !== 'undefined' && RB.el) RB.el.style.visibility = '';
  pjiVista(false); PJI.ses = null;
  if (PJI.ui && typeof UI !== 'undefined' && UI.abierto === 'pji') UI.abierto = PJI.ui.prevAbierto || null;
  PJI.ui = null;
}
const pjiT = (k, r) => { let s = T(k); for (const x in r || {}) s = s.replace('{' + x + '}', r[x]); return s; };
const pjiNum = (x, d) => (typeof Intl !== 'undefined' ? new Intl.NumberFormat(PREFS.lang || 'es', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }).format(x) : x.toFixed(d || 0));
function pjiDibujarUI() {
  const V = document.getElementById('pjiVen'), U = PJI.ui; if (!V || !U) return; const ses = PJI.ses, conPuntos = !ses || !ses.usarPropio;
  const pasos = [1, 2, 3].map((n) => `<i class="${n === U.paso ? 'sel' : n < U.paso ? 'hecho' : ''}">${n}</i>`).join('');
  const tit = U.paso === 1 ? T('pji.paso1') : U.paso === 2 ? (conPuntos ? T('pji.paso2') : T('pji.paso2b')) : T('pji.paso3');
  let cuerpo = '', pie = '';
  if (U.ocupado) cuerpo = `<div class="pjiEspera"><i></i>${esc(U.ocupado)}</div>`;
  else if (U.paso === 1) {
    const L = PJI.lista;
    cuerpo = `${U.error ? `<div class="pjiError">${esc(U.error)}</div>` : ''}<label class="pjiZona">${glifo('subir')}<b>${esc(T('pji.elegir'))}</b><small>${esc(T('pji.formatos'))}</small><input type="file" multiple accept="${PJI_ACEPTA}" hidden></label>
      <ul class="pjiTips"><li>${esc(T('pji.tip1'))}</li><li>${esc(T('pji.tip2'))}</li><li>${esc(T('pji.tip3'))}</li></ul>
      ${L.length ? `<div class="pjiSub">${esc(T('pji.tuyos'))} · ${L.length}</div><div class="pjiMios">${L.map((m) => `<div class="pjiMio${PREFS.skin === pjiSkin(m.id) ? ' sel' : ''}" data-pji="usar:${esc(m.id)}"><i style="${m.img ? `background-image:url('${esc(m.img)}')` : ''}"></i><b dir="auto">${esc(m.n)}</b><button data-pji="borrar:${esc(m.id)}" title="${esc(T('pji.borrar'))}">${glifo('basura')}</button></div>`).join('')}</div>` : ''}`;
    pie = `<span class="esp"></span><button class="pjiBtn" data-pji="cerrar">${esc(T('pji.cerrar'))}</button>`;
  } else if (U.paso === 2) {
    if (conPuntos) cuerpo = `<p class="pjiAyuda" style="margin:0">${esc(T('pji.ayudaPuntos'))}</p><div class="pjiLienzo"><canvas></canvas></div>
      <div class="pjiFila"><label class="pjiChk"><input type="checkbox" data-pji="sim" ${U.sim !== false ? 'checked' : ''}>${esc(T('pji.simetrico'))}</label><span class="esp" style="flex:1"></span>
      <button class="pjiBtn" data-pji="vuelta">${glifo('girar')} ${esc(T('pji.darVuelta'))}</button><button class="pjiBtn" data-pji="auto">${glifo('dado')} ${esc(T('pji.proponer'))}</button></div>`;
    else cuerpo = `<div class="pjiNota">${esc(pjiT('pji.propio', { n: ses.C.huesos.length }))}</div><div class="pjiLienzo"><canvas></canvas></div>
      <div class="pjiFila"><span class="esp" style="flex:1"></span><button class="pjiBtn" data-pji="vuelta">${glifo('girar')} ${esc(T('pji.darVuelta'))}</button><button class="pjiBtn" data-pji="decero">${esc(T('pji.deCero'))}</button></div>`;
    pie = `<button class="pjiBtn" data-pji="atras">${glifo('atras')} ${esc(T('pji.atras'))}</button><span class="esp"></span><button class="pjiBtn si" data-pji="sig">${esc(T('pji.siguiente'))} ${glifo('adelante')}</button>`;
  } else {
    const r = ses.rig, nt = ses.Nm.grupos.reduce((a, g) => a + g.tris.length / 3, 0);
    cuerpo = `${U.error ? `<div class="pjiError">${esc(U.error)}</div>` : ''}<div class="pjiChips">${PJI_ANIMS.map(([k, t]) => `<button class="pjiChip${U.anim === k ? ' sel' : ''}" data-pji="anim:${k}">${esc(T(t))}</button>`).join('')}</div>
      <label class="pjiCampo"><span>${esc(T('pji.nombre'))}</span><input type="text" maxlength="24" dir="auto" data-pji="nombre" value="${esc(ses.nombre)}"></label>
      <label class="pjiCampo"><span>${esc(T('pji.alto'))}</span><input type="range" min="40" max="260" step="1" data-pji="alto" value="${Math.round(ses.alto * 100)}"><output>${pjiNum(ses.alto, 2)} m</output></label>
      <small>${esc(pjiT('pji.datos', { v: pjiNum(ses.Nm.pos.length / 3), t: pjiNum(nt), h: r.huesos.length, s: pjiNum((ses.ms.rig || 0) / 1000, 1) }))}</small>`;
    pie = `<button class="pjiBtn" data-pji="atras">${glifo('atras')} ${esc(T('pji.atras'))}</button><span class="esp"></span><button class="pjiBtn si" data-pji="guardar">${glifo('guardar')} ${esc(T('pji.guardar'))}</button>`;
  }
  V.innerHTML = `<div class="pjiPan"><div class="pjiCab"><span class="pjiTit">${esc(T('pji.titulo'))}</span><span class="pjiPasos">${pasos}</span><button class="pjiX" data-pji="cerrar" aria-label="${esc(T('pji.cerrar'))}">✕</button></div>
    <div class="pjiCuerpo"><div class="pjiPaso">${U.paso}. ${esc(tit)}</div>${cuerpo}</div><div class="pjiPie">${pie}</div></div><div class="pjiDer${U.paso === 3 && !U.ocupado ? '' : ' vacio'}">${U.paso === 3 && !U.ocupado ? `<span class="pjiGiro">${esc(T('pj.girar'))}</span>` : ''}</div>`;
  if (U.paso === 2 && !U.ocupado) pjiLienzoMontar(V.querySelector('.pjiLienzo'));
}
function pjiMontar(V) {
  V.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pji]'); if (!b || !PJI.ui) return; const [k, ...r] = b.dataset.pji.split(':'), v = r.join(':');
    if (k === 'cerrar') pjiCerrar();
    else if (k === 'usar') { pjElegirSkin(pjiSkin(v)); pjiDibujarUI(); }
    else if (k === 'borrar') { e.stopPropagation(); const m = PJI.lista.find((x) => x.id === v); confirmar(pjiT('pji.seguroBorrar', { n: m ? m.n : v }), T('pji.borrar'), () => pjiBorrar(v).then(pjiDibujarUI)); }
    else if (k === 'vuelta') { const s = PJI.ses; if (s.usarPropio) { s.mapa = pjiCambiarLados(s.mapa); s.base = pjiBaseEsqueleto(s.C, s.mapa); } else s.girado = !s.girado; pjiSesNormalizar(s); PJI.ui.fondo = null; pjiDibujarUI(); }
    else if (k === 'auto') { PJI.ses.pts = pjiPuntosAuto(PJI.ses.Nm); pjiDibujarUI(); }
    else if (k === 'decero') { PJI.ses.usarPropio = false; pjiSesNormalizar(PJI.ses); PJI.ui.fondo = null; pjiDibujarUI(); }
    else if (k === 'atras') { if (PJI.ui.paso === 3) { pjiVista(false); PJI.ui.paso = 2; } else { PJI.ui.paso = 1; PJI.ses = null; } PJI.ui.error = ''; pjiDibujarUI(); }
    else if (k === 'sig') pjiAlPaso3();
    else if (k === 'anim') { PJI.ui.anim = v; PJI.ui.animT = 0; if (MENU.lobby) { MENU.lobby.emote = null; MENU.lobby.agachado = false; } pjiDibujarUI(); }
    else if (k === 'guardar') pjiGuardarSes();
  });
  V.addEventListener('change', (e) => {
    const t = e.target; if (t.matches('input[type=file]')) { const fs = [...(t.files || [])]; t.value = ''; if (fs.length) pjiElegidos(fs); }
    else if (t.dataset.pji === 'sim') PJI.ui.sim = t.checked;
  });
  V.addEventListener('input', (e) => {
    const t = e.target, s = PJI.ses; if (!s) return;
    if (t.dataset.pji === 'nombre') s.nombre = t.value.slice(0, 24);
    else if (t.dataset.pji === 'alto') { const a = +t.value / 100; t.nextElementSibling.textContent = pjiNum(a, 2) + ' m'; clearTimeout(PJI.ui.altoT); PJI.ui.altoT = setTimeout(() => { pjiSesAlto(s, a); pjiVista(true); }, 220); }
  });
  V.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') pjiCerrar(); });
  // soltar archivos encima (compu)
  V.addEventListener('dragover', (e) => { if (PJI.ui && PJI.ui.paso === 1) { e.preventDefault(); const z = V.querySelector('.pjiZona'); if (z) z.classList.add('arr'); } });
  V.addEventListener('dragleave', () => { const z = V.querySelector('.pjiZona'); if (z) z.classList.remove('arr'); });
  V.addEventListener('drop', (e) => { if (!PJI.ui || PJI.ui.paso !== 1) return; e.preventDefault(); const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (fs.length) pjiElegidos(fs); });
  // girar el personaje de la vista previa arrastrando a la derecha
  let x0 = null; V.addEventListener('pointerdown', (e) => { if (e.target.closest('.pjiDer') && PJI.ui && PJI.ui.paso === 3) { x0 = e.clientX; e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } });
  V.addEventListener('pointermove', (e) => { if (x0 === null || !MENU) return; MENU.yaw -= (e.clientX - x0) * 0.012; x0 = e.clientX; });
  V.addEventListener('pointerup', () => { x0 = null; }); V.addEventListener('pointercancel', () => { x0 = null; });
}
const pjiEspera = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
async function pjiElegidos(fs) {
  const U = PJI.ui; if (!U) return; U.error = '';
  // (un .gma de GMod: por su camino de siempre, Personajes → Mods)
  const gma = fs.find((f) => /\.(gma|bin)$/i.test(f.name)) && !fs.some((f) => /\.(glb|gltf|vrm|obj)$/i.test(f.name));
  if (gma) { pjiCerrar(); if (typeof pjmImportar === 'function') pjmImportar(fs[0]); return; }
  U.ocupado = T('pji.leyendo'); pjiDibujarUI(); await pjiEspera();
  try {
    const ses = await pjiProcesar(fs); if (PJI.ui !== U) return;
    PJI.ses = ses; U.paso = 2; U.fondo = null; U.ocupado = null; pjiDibujarUI();
  } catch (e) { U.ocupado = null; U.error = pjiErrorTxt(e); pjiDibujarUI(); }
}
function pjiErrorTxt(e) { const k = e && e.message; return /^pji\./.test(k || '') ? pjiT(k, { d: e.det || '' }) : T('pji.errFormato') + (k ? ' (' + String(k).slice(0, 80) + ')' : ''); }
async function pjiAlPaso3() {
  const U = PJI.ui, ses = PJI.ses; if (!U || !ses) return;
  U.ocupado = T('pji.armando'); pjiDibujarUI(); await pjiEspera();
  try { pjiSesArmar(ses); U.paso = 3; U.ocupado = null; U.error = ''; pjiDibujarUI(); pjiVista(true); }
  catch (e) { U.ocupado = null; U.paso = 2; pjiDibujarUI(); aviso(pjiErrorTxt(e), 4); }
}
// la vista previa: el personaje del menú (MENU.lobby) pasa a ser el importado; al salir vuelve el de antes
function pjiVista(si) {
  if (typeof MENU === 'undefined' || typeof crearPersona !== 'function') return;
  if (si && PJI.ses && PJI.ses.def) {
    if (!PJI.vista3d) { MENU.yawPji = MENU.yaw; MENU.yaw = Math.PI + 0.45; }
    if (MENU.lobby) borrarPersona(MENU.lobby);
    MENU.lobby = crearPersona(pjiSkin(PJI.ses.clave), 'HatEmpty', { nombre: '' }); MENU.lobby.lobby = true; MENU.lobby.pji = true; PJI.vista3d = true;
  } else if (PJI.vista3d) {
    PJI.vista3d = false; if (MENU.lobby) { borrarPersona(MENU.lobby); MENU.lobby = null; }
    if (MENU.yawPji !== undefined) MENU.yaw = MENU.yawPji;
    // (vuelve el personaje de siempre si estaba: en el menú o con Personajes abierto)
    if (PJI.ui && PJI.ui.prevLobby || (typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal')) menuLobby(true, true);
  }
}
// lo que hace el de la vista previa (desde dibujarLobby, menu.js): camina y corre en el lugar, salta, se agacha, saluda, baila
function pjiLobbyAnim(P) {
  if (!PJI.vista3d || !P.pji || !PJI.ui) return; const a = PJI.ui.anim, t = (PJI.ui.animT = (PJI.ui.animT || 0) + (TIEMPO.dt || 0.016)), f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  P.agachado = a === 'agacharse';
  if (a === 'caminar') P.vel.set(f.x * 1.7, 0, f.z * 1.7);
  else if (a === 'correr') P.vel.set(f.x * 6, 0, f.z * 6);
  else if (a === 'saltar') { const c = t % 1.4; P.suelo = c > 0.75; P.vel.set(0, P.suelo ? 0 : 3.2 - (c) * 6, 0); }
  else if ((a === 'saludar' || a === 'bailar') && (!P.emote || P.emoteT > 2.8)) { P.emote = a === 'saludar' ? 'Hi' : (DATA.emotes.includes('ChickenDance') ? 'ChickenDance' : DATA.emotes[0]); P.emoteT = 0; P.emoteMax = 2.9; }
  if (a !== 'saludar' && a !== 'bailar') P.emote = null;
}
// guardar: el paquete en el aparato y ponérselo
async function pjiGuardarSes() {
  const U = PJI.ui, ses = PJI.ses; if (!U || !ses || U.ocupado) return;
  U.ocupado = T('pji.guardando'); pjiDibujarUI(); await pjiEspera();
  try {
    const nombre = (ses.nombre || '').trim() || ses.C.nombre || 'Personaje';
    let pack = await pjiEmpacar(ses, nombre, 1024); if (pack.length > 3e6) pack = await pjiEmpacar(ses, nombre, 512);
    if (pack.length > PJI_MAX.tot) throw new Error('pji.muyGrande');
    const id = pjiHuella(pack), meta = { id, n: nombre.slice(0, 24), img: pjiRetrato(ses.Nm, ses.tex, ses.pts || pjiPuntosAuto(ses.Nm)), alto: +ses.alto.toFixed(2), fecha: Date.now(), nv: ses.Nm.pos.length / 3, nb: ses.rig.huesos.length, propio: !!ses.rig.propio, kb: Math.round(pack.length / 1024) };
    await pjiGuardar(meta, pack);
    const def = pjiDef(id, ses.Nm, ses.rig, ses.tex); def.nombre = meta.n; PJI.defs.set(id, def);
    pjiCerrar(); pjElegirSkin(pjiSkin(id)); aviso(pjiT('pji.listo', { n: meta.n }), 5);
    if (typeof pjmDibujar === 'function') pjmDibujar();
  } catch (e) { U.ocupado = null; U.error = pjiErrorTxt(e); pjiDibujarUI(); }
}
// los puntos: el lienzo (vista de frente) y arrastrarlos con el dedo o el mouse
function pjiLienzoMontar(caja) {
  const U = PJI.ui, ses = PJI.ses, cv = caja.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(120, Math.round(caja.clientWidth * dpr)), H = Math.max(120, Math.round(caja.clientHeight * dpr));
  if (!U.fondo || U.fondo.cv.width !== W || U.fondo.cv.height !== H || U.fondo.ses !== ses || U.fondo.g !== ses.girado) { U.fondo = pjiDibujarFrente(ses.Nm, ses.tex, W, H); U.fondo.ses = ses; U.fondo.g = ses.girado; }
  const F = U.fondo; cv.width = W; cv.height = H; const cx = cv.getContext('2d');
  const nom = (k) => T('pji.p_' + k.replace(/[ID]$/, '')) + (/I$/.test(k) ? ' (' + T('pji.izq') + ')' : /D$/.test(k) ? ' (' + T('pji.der') + ')' : '');
  const dib = () => { cx.clearRect(0, 0, W, H); cx.drawImage(F.cv, 0, 0); if (ses.pts) pjiDibujarPuntos(cx, Object.assign({}, F, { cv }), ses.pts, U.selP, nom); };
  dib(); if (!ses.pts) return;
  const xy = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  let k = null;
  cv.addEventListener('pointerdown', (e) => { const [x, y] = xy(e); let b = null, bd = 34 * dpr; for (const q of PJI_PUNTOS) { const d = Math.hypot(F.sx(ses.pts[q][0]) - x, F.sy(ses.pts[q][1]) - y); if (d < bd) { bd = d; b = q; } }
    k = b; U.selP = b; if (b) { cv.setPointerCapture(e.pointerId); e.preventDefault(); } dib(); });
  cv.addEventListener('pointermove', (e) => { if (!k) return; const [x, y] = xy(e), mx = F.mx(x), my = Math.max(0, F.my(y)), o = pjiOtro(k);
    ses.pts[k] = /^(barbilla|ingle)$/.test(k) && U.sim !== false ? [0, my] : [mx, my]; if (o && U.sim !== false) ses.pts[o] = [-mx, my];
    for (const q of [k, o]) if (q && /^rodilla/.test(q)) ses.pts['muslo' + q.slice(-1)] = ses.pts[q][0];
    dib(); });
  const fin = () => { k = null; }; cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
}
try { pjiCargarLista(); } catch (e) {}
