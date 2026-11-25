// ---------------- Importar prop: un modelo .glb / .gltf / .obj (con su .mtl y texturas, o el .zip de Sketchfab) como prop ----
// Bugs y sugerencias f5piayqr: «que se puedan meter modelos en .glb, .obj y varios más, pero también como props o NPCs».
// Los personajes ya se importaban (pjimportar.js: personaje, NPC y muñeco de trapo) y los accesorios para la cabeza
// (accesorios.js); esto es para todo lo demás: muebles, autos de adorno, comida, carteles, lo que sea. En Props →
// «Tus props importados» → «Importar prop»: se lee con el lector de Importar personaje (sus materiales y texturas), se elige
// el nombre y el tamaño (el suyo si es razonable; si no, 1 m), y queda como un prop más: cae, choca con el casco convexo de
// su malla, pesa según su tamaño, se agarra con la Physics Gun, se congela, se borra. Se guarda en el aparato (IndexedDB) y
// en la sala los demás lo bajan del que lo puso, de a pedazos, como los accesorios (el id es la huella del paquete).
const PRI = { lista: [], cargada: false, db: null, packs: new Map(), armando: new Map(), pidiendo: new Map(), partes: new Map(), enviando: new Set(), ui: null };
const PRI_TRIS = 300000;          // (más que eso no se acepta: un mueble de Sketchfab bien hecho anda por 2 a 80 mil)
const PRI_RE = /^pri:([a-z0-9_]{6,40})$/;

// ---------------- guardados en el aparato ----------------
function priDB() {
  if (PRI.db) return PRI.db;
  return (PRI.db = new Promise((ok) => { try { const r = indexedDB.open('jxmod-props', 1); r.onupgradeneeded = () => { r.result.createObjectStore('pr', { keyPath: 'id' }); r.result.createObjectStore('pk'); }; r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } }));
}
async function priCargarLista() {
  if (PRI.cargada) return PRI.lista; const db = await priDB();
  const L = db ? await pjiTx(db, 'pr', 'readonly', (s) => s.getAll()) : null; PRI.lista = (L || PRI.lista).sort((a, b) => (a.fecha || 0) - (b.fecha || 0)); PRI.cargada = true;
  return PRI.lista;
}
async function priPaquete(id) {
  if (PRI.packs.has(id)) return PRI.packs.get(id);
  const db = await priDB(); const b = db ? await pjiTx(db, 'pk', 'readonly', (s) => s.get(id)) : null;
  if (b) PRI.packs.set(id, b instanceof Uint8Array ? b : new Uint8Array(b)); return PRI.packs.get(id) || null;
}
async function priGuardar(meta, pack) {
  PRI.packs.set(meta.id, pack); PRI.lista = PRI.lista.filter((x) => x.id !== meta.id).concat([meta]);
  const db = await priDB(); if (!db) return false;
  await pjiTx(db, 'pk', 'readwrite', (s) => s.put(pack, meta.id)); await pjiTx(db, 'pr', 'readwrite', (s) => s.put(meta)); return true;
}
async function priBorrar(id) {
  PRI.lista = PRI.lista.filter((x) => x.id !== id); PRI.packs.delete(id);
  const db = await priDB(); if (db) { await pjiTx(db, 'pk', 'readwrite', (s) => s.delete(id)); await pjiTx(db, 'pr', 'readwrite', (s) => s.delete(id)); }
}

// ---------------- leer y empacar ----------------
// leer: el modelo crudo y su caja (en las unidades del archivo: glTF va en metros; un OBJ, en lo que sea)
async function priLeer(files) {
  const C = await pjiLeerArchivos(await accArchivos(files));
  const P = C.pos, n = P.length / 3, ni = C.grupos.reduce((a, g) => a + g.tris.length, 0);
  if (!n || !ni) throw new Error('pji.errFormato');
  if (ni / 3 > PRI_TRIS) throw new Error('pri.muchos');
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const L0 = Math.max(1e-6, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  return { C, mn, mx, L0, tam: L0 >= 0.05 && L0 <= 20 ? L0 : 1, tris: Math.round(ni / 3), nombre: String(C.nombre || 'Prop').slice(0, 24) };
}
// la malla centrada en su caja y llevada a «tam» metros de lado más largo
function priNm(L, tam) {
  const C = L.C, P = C.pos, n = P.length / 3, k = tam / L.L0, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = (P[i * 3 + c] - (L.mn[c] + L.mx[c]) / 2) * k;
  let nor = C.nor; if (!nor || nor.length !== n * 3) { nor = new Float32Array(n * 3); pjiNormales(pos, C.grupos, nor); }
  return { pos, nor, uv: C.uv, grupos: C.grupos, mats: C.mats.length ? C.mats : [{ c: [0.8, 0.8, 0.8, 1], img: -1, alfa: 'op', dos: false }], alto: tam };
}
// el retrato del menú: tres cuartos de frente, un poco desde arriba (dibujado por software, como el de los personajes)
function priRetrato(Nm, tex) {
  const P = Nm.pos, N = Nm.nor, n = P.length / 3, a = 0.6, b = 0.38, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const Q = new Float32Array(n * 3), M = new Float32Array(n * 3), rot = (S, D, i) => { const x = S[i * 3], y = S[i * 3 + 1], z = S[i * 3 + 2], x1 = ca * x + sa * z, z1 = -sa * x + ca * z; D[i * 3] = x1; D[i * 3 + 1] = cb * y - sb * z1; D[i * 3 + 2] = sb * y + cb * z1; };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { rot(P, Q, i); rot(N, M, i); const x = Q[i * 3], y = Q[i * 3 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const F = pjiDibujarFrente({ pos: Q, nor: M, uv: Nm.uv, grupos: Nm.grupos, mats: Nm.mats }, tex, 144, 108, { x0: cx - w * 0.68, x1: cx + w * 0.68, y0: cy - w * 0.51, y1: cy + w * 0.51 });
  try { return F.cv.toDataURL('image/webp', 0.82); } catch (e) { return F.cv.toDataURL(); }
}
async function priEmpacar(L, nombre, tam) {
  const Nm = priNm(L, tam), n = Nm.pos.length / 3;
  const tex = await pjiDecodificar(L.C.imgs || [], typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024);
  // (con el formato de los personajes importados: un solo «hueso», quieto)
  const ses = { Nm, rig: { huesos: [{ n: 'Prop', pa: -1, p: [0, 0, 0], q: [0, 0, 0, 1] }], hb: new Uint8Array(n * 3), hw: (() => { const w = new Float32Array(n * 3); for (let i = 0; i < n; i++) w[i * 3] = 1; return w; })(), puntas: {}, propio: true }, tex, pts: null };
  let pack = await pjiEmpacar(ses, nombre, 1024); if (pack.length > 3e6) pack = await pjiEmpacar(ses, nombre, 512);
  if (pack.length > PJI_MAX.tot) throw new Error('pri.pesado');
  const id = pjiHuella(pack), meta = { id, n: String(nombre || 'Prop').slice(0, 24), tam: +tam.toFixed(3), tris: L.tris, fecha: Date.now(), img: priRetrato(Nm, tex) };
  await priGuardar(meta, pack);
  return meta;
}

// ---------------- el prefab: la malla, su casco de choque y su peso ----------------
// (síncrono: true si ya está; si no, se arma —leer el paquete y sus texturas lleva un momento— y fn se llama al terminar)
function priEsperar(nombre, fn) {
  const m = PRI_RE.exec(nombre); if (!m || DATA.pfPorNombre[nombre]) return false;
  priArmar(m[1]).then((ok) => { if (ok && fn) fn(); });
  return true;
}
function priArmar(id) {
  if (DATA.pfPorNombre['pri:' + id]) return Promise.resolve(true);
  let p = PRI.armando.get(id); if (p) return p;
  p = (async () => {
    try {
      const b = await priPaquete(id); if (!b) return false;
      const U = await pjiDesempacar(b), tex = await pjiDecodificar(U.imgs, typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024), Nm = U.Nm;
      const noms = pjiMateriales('pri_' + id, Nm, tex), n = Nm.pos.length / 3, P = Float32Array.from(Nm.pos), N = Float32Array.from(Nm.nor), Uv = new Float32Array(n * 2);
      // (las V al revés, como las de los modelos de GMod: gmPrefab)
      for (let i = 0; i < n; i++) { Uv[i * 2] = Nm.uv ? Nm.uv[i * 2] : 0; Uv[i * 2 + 1] = 1 - (Nm.uv ? Nm.uv[i * 2 + 1] : 0); }
      const porMat = new Map();
      for (const g of Nm.grupos) {
        const x = GMOD.mats.get(noms[g.mat] + '|'); if (!x) continue;
        let Lt = porMat.get(x.mi); if (!Lt) porMat.set(x.mi, (Lt = []));
        const T = g.tris; for (let t = 0; t + 2 < T.length; t += 3) { Lt.push(T[t], T[t + 1], T[t + 2]); if (x.dos) Lt.push(T[t], T[t + 2], T[t + 1]); }
      }
      if (!porMat.size) return false;
      const mats = [...porMat.keys()], mi = gmMallaNueva('PRI_' + id, P, N, Uv, mats.map((k) => porMat.get(k)), true);
      // el choque: el casco convexo, con los puntos de la malla (los de las puntas de la caja y una muestra; un modelo de
      // 100 mil vértices no hace falta entero para el casco)
      const paso = Math.max(1, Math.floor(n / 1500)), pts = [], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], ext = new Array(6).fill(-1);
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) { mn[c] = v; ext[c * 2] = i; } if (v > mx[c]) { mx[c] = v; ext[c * 2 + 1] = i; } }
      for (let i = 0; i < n; i += paso) pts.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      for (const i of ext) if (i >= 0) pts.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      const col = gmCascoNuevo('PRI_col_' + id, Float32Array.from(pts));
      // (el peso: como un mueble de madera lleno a medias —la caja por 180 kg/m³—, entre 1 y 800 kg; flota como la madera)
      const masa = clamp((mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]) * 180, 1, 800);
      const nom = 'pri:' + id, key = nom + '#pri';
      DATA.pf[key] = [{ n: nom, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, m: mi, mt: mats, col: [{ k: 'm', m: col, cv: 2, tr: 0 }], rb: { m: masa, d: 0, k: 0, g: 1 }, mb: ['Prop'] }];
      DATA.pfPorNombre[nom] = key;
      return true;
    } catch (e) { if (typeof gmErr === 'function') gmErr('prop importado ' + id, e); return false; }
    finally { PRI.armando.delete(id); }
  })();
  PRI.armando.set(id, p); return p;
}
// (de la red: uno que puso otro; si no lo tengo, se lo pido y se arma cuando llega)
function priAsegurar(nombre, de) {
  const m = PRI_RE.exec(nombre); if (!m || DATA.pfPorNombre[nombre] || PRI.armando.has(m[1])) return;
  if (PRI.packs.has(m[1]) || PRI.lista.some((x) => x.id === m[1])) { priArmar(m[1]); return; }
  priPedir(m[1], de);
}
const priNombre = (it) => { const m = PRI_RE.exec(it); const x = m && PRI.lista.find((y) => y.id === m[1]); return x ? x.n : m ? m[1] : it; };

// ---------------- en multijugador: los demás lo bajan del que lo puso (como los accesorios) ----------------
function priPedir(id, de) {
  const p = PRI.pidiendo.get(id) || { t: -1e9, n: 0 }, t = performance.now(); if (t - p.t < 12000 || p.n >= 6) return;
  p.t = t; p.n++; PRI.pidiendo.set(id, p); if (typeof publicar === 'function' && RED.on) publicar('a', { k: 'prq', g: id, to: typeof de === 'string' ? de.slice(0, 20) : '' });
}
async function priMandar(id) {
  if (PRI.enviando.has(id)) return; PRI.enviando.add(id);
  try {
    const b = await priPaquete(id); if (!b || b.length > PJI_MAX.tot) return;
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    const d = btoa(s), L = []; for (let i = 0; i < d.length; i += 24000) L.push(d.slice(i, i + 24000));
    for (let x = 0; x < L.length; x++) { if (!RED.on) break; publicar('a', { k: 'prd', g: id, x, n: L.length, d: L[x] }); await new Promise((ok) => setTimeout(ok, 125)); }
  } finally { setTimeout(() => PRI.enviando.delete(id), 3000); }
}
function priRed(d) {
  if (typeof d.g !== 'string' || !/^[a-z0-9_]{6,40}$/.test(d.g)) return;
  if (d.k === 'prq') { if ((!d.to || d.to === RED.ID) && (PRI.lista.some((x) => x.id === d.g) || PRI.packs.has(d.g))) priMandar(d.g); return; }
  if (d.k !== 'prd' || typeof d.d !== 'string' || PRI.packs.has(d.g)) return;
  const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 460 || i < 0 || i >= n || d.d.length > 24000) return;
  let e = PRI.partes.get(d.g); if (!e || e.n !== n || performance.now() - e.t > 90000) { e = { n, p: new Array(n), llegaron: 0, t: performance.now() }; PRI.partes.set(d.g, e); }
  if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; }
  if (e.llegaron < n) return;
  PRI.partes.delete(d.g);
  try {
    const s = atob(e.p.join('')), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k);
    if (pjiHuella(b) !== d.g) return;   // (lo que llegó tiene que ser ese prop)
    PRI.packs.set(d.g, b); priArmar(d.g);   // (mientras dure la partida; el que lo puso lo tiene guardado)
  } catch (x) {}
}

// ---------------- la ventana de importar (desde Props → Tus props importados) ----------------
function priCss() {
  if (document.getElementById('priCss')) return;
  const s = document.createElement('style'); s.id = 'priCss';
  s.textContent = `#priVen{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}#priVen.oc{display:none}
#priVen .priCaja{width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 24px);overflow:auto;background:#0e0f11;border:1px solid var(--jxLin);color:var(--jxT);font:400 13px/1.35 Roboto,Arial,sans-serif;padding:14px 16px;box-sizing:border-box}
#priVen .priTit{font:600 17px/1.2 var(--jxF);letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:10px}#priVen .priTit .gli{width:20px;height:20px;stroke:var(--jxA);fill:none;stroke-width:2}
#priVen .priVista{display:flex;gap:12px;align-items:center;margin-bottom:10px}#priVen .priVista img{width:144px;height:108px;background:var(--jxPl);flex:none;object-fit:contain}
#priVen .priDato{color:var(--jxT2);font-size:12px}#priVen label{display:block;margin:8px 0 3px;color:var(--jxT2);font-size:12px}
#priVen input[type=text]{width:100%;box-sizing:border-box;background:var(--jxPl);border:1px solid var(--jxLin);color:var(--jxT);padding:8px;font:inherit}
#priVen .priTam{display:flex;align-items:center;gap:10px}#priVen .priTam input{flex:1;accent-color:var(--jxA)}#priVen .priTam output{min-width:64px;text-align:right;font-variant-numeric:tabular-nums}
#priVen .priBots{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}#priVen button{border:0;padding:9px 16px;font:600 13px/1 var(--jxF);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:var(--jxPl3);color:var(--jxT)}
#priVen button.priSi{background:var(--jxA);color:#141414}#priVen button:disabled{opacity:.5;cursor:default}#priVen .priEst{min-height:18px;margin-top:8px;color:var(--jxT2)}#priVen .priEst.mal{color:var(--jxRo)}
#spawn .it.itPri .gli{width:42px;height:42px;stroke:var(--jxA);fill:none;stroke-width:1.6;margin:6px 0 4px}#spawn .it.itPri{position:relative}
#spawn .it .itX{position:absolute;top:2px;right:2px;width:20px;height:20px;border:0;padding:0;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}#spawn .it .itX .gli{width:14px;height:14px;stroke:#fff;fill:none;stroke-width:2.2;margin:0}`;
  document.head.appendChild(s);
}
// el tamaño en la barra va en escala logarítmica (5 cm a 20 m)
const priTamDe = (v) => 0.05 * Math.pow(400, v / 1000), priBarraDe = (t) => Math.round(Math.log(t / 0.05) / Math.log(400) * 1000);
const priMetros = (t) => (t < 1 ? Math.round(t * 100) + ' cm' : (typeof pjiNum === 'function' ? pjiNum(t, t < 10 ? 2 : 1) : t.toFixed(2)) + ' m');
function priElegirArchivos() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.glb,.gltf,.vrm,.obj,.mtl,.bin,.png,.jpg,.jpeg,.webp,.tga,.zip';
  inp.onchange = () => { const fs = [...inp.files]; if (fs.length) priAbrir(fs); };
  inp.click();
}
async function priAbrir(files) {
  priCss();
  let V = document.getElementById('priVen'); if (!V) { V = document.createElement('div'); V.id = 'priVen'; document.body.appendChild(V); }
  V.classList.remove('oc'); V.addEventListener('keydown', (e) => e.stopPropagation());
  // (va arriba del menú de spawn, que queda abierto atrás: el juego sigue en pausa de controles)
  PRI.ui = {};
  V.innerHTML = `<div class="priCaja"><div class="priTit">${glifo('subir')}${esc(T('pri.titulo'))}</div><div class="priEst">${esc(T('pri.leyendo'))}</div></div>`;
  let L;
  try { L = await priLeer(files); }
  catch (x) { V.querySelector('.priEst').textContent = typeof pjiErrorTxt === 'function' && !/^pri\./.test(x && x.message) ? pjiErrorTxt(x) : T((x && x.message) || 'pri.error'); V.querySelector('.priEst').classList.add('mal');
    V.querySelector('.priCaja').insertAdjacentHTML('beforeend', `<div class="priBots"><button data-pri="no">${esc(T('pri.cancelar'))}</button></div>`); V.querySelector('[data-pri=no]').onclick = priCerrar; return; }
  PRI.ui.L = L;
  // (la vista previa, con sus texturas)
  const tex = await pjiDecodificar(L.C.imgs || [], 256); let img = '';
  try { img = priRetrato(priNm(L, 1), tex); } catch (e) { img = ''; }
  V.innerHTML = `<div class="priCaja"><div class="priTit">${glifo('subir')}${esc(T('pri.titulo'))}</div>
    <div class="priVista">${img ? `<img src="${img}" alt="">` : ''}<div class="priDato">${esc(pjiT('pri.dato', { t: typeof pjiNum === 'function' ? pjiNum(L.tris) : L.tris }))}</div></div>
    <label>${esc(T('pri.nombre'))}</label><input type="text" maxlength="24" spellcheck="false" value="${esc(L.nombre)}">
    <label>${esc(T('pri.tam'))}</label><div class="priTam"><input type="range" min="0" max="1000" step="1" value="${priBarraDe(L.tam)}"><output>${esc(priMetros(L.tam))}</output></div>
    <div class="priEst"></div><div class="priBots"><button data-pri="no">${esc(T('pri.cancelar'))}</button><button class="priSi" data-pri="si">${esc(T('pri.guardar'))}</button></div></div>`;
  const r = V.querySelector('input[type=range]'), o = V.querySelector('output'), nm = V.querySelector('input[type=text]');
  r.oninput = () => { L.tam = priTamDe(+r.value); o.textContent = priMetros(L.tam); };
  V.querySelector('[data-pri=no]').onclick = priCerrar;
  V.querySelector('[data-pri=si]').onclick = async (e) => {
    const bt = e.currentTarget, est = V.querySelector('.priEst'); bt.disabled = true; est.classList.remove('mal'); est.textContent = T('pri.guardando');
    try {
      const meta = await priEmpacar(L, nm.value.trim() || L.nombre, L.tam);
      priCerrar(); if (typeof aviso === 'function') aviso(pjiT('pri.listo', { n: meta.n }), 4);
      if (typeof UI !== 'undefined' && UI.abierto === 'spawn' && typeof spawnDibujar === 'function') spawnDibujar();
    } catch (x) { bt.disabled = false; est.classList.add('mal'); est.textContent = /^pri\./.test(x && x.message) ? T(x.message) : typeof pjiErrorTxt === 'function' ? pjiErrorTxt(x) : T('pri.error'); }
  };
  setTimeout(() => { try { nm.focus({ preventScroll: true }); nm.select(); } catch (e) {} }, 50);
}
function priCerrar() {
  const V = document.getElementById('priVen'); if (V) V.classList.add('oc');
  PRI.ui = null;
}
try { priCargarLista(); } catch (e) {}
if (typeof module !== 'undefined') module.exports = { PRI, priLeer, priEmpacar, priArmar, priEsperar, priRed };
