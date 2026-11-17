// ---------------- Accesorios importados para la cabeza (Discord, thisgood_boom2: «Importar objetos para la cabeza:
// accesorios de Sketchfab, como cascos personalizados») ----------------
// En Personajes → Gorros, «Importar accesorio»: un GLB, GLTF u OBJ (con sus texturas, o el .zip tal cual lo baja Sketchfab)
// se lee con el lector de Importar personaje (pjimportar.js), se centra y se lleva al tamaño de una cabeza, y queda puesto
// en la cabeza del personaje, además del gorro. Barras para el tamaño, la altura, adelante/atrás, los costados y los tres
// giros (por si el modelo viene acostado). Se guarda en el aparato (IndexedDB) y en la sala los demás lo bajan del que lo
// tiene puesto, de a pedazos, como los personajes importados (el id es la huella del paquete: llega el mismo modelo).
// Se dibuja pegado al hueso de la cabeza: sigue la animación (mirar arriba, los emotes, el muñeco de trapo).
const ACCS = { lista: [], cargada: false, db: null, packs: new Map(), mallas: new Map(), armando: new Set(), pidiendo: new Map(), partes: new Map(), enviando: new Set() };
const ACC_LADO = 0.3;            // (el lado más largo del accesorio, de entrada: una cabeza)
const ACC_TRIS = 150000;         // (más que eso no se acepta: un casco de Sketchfab bien hecho anda por 5 a 60 mil)
// el ajuste (de PREFS o de la red), validado: tamaño ×0,2–4; corrido en cm; giros en grados
function accLimpio(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !/^[a-z0-9_]{6,40}$/.test(a.id)) return null;
  const n = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return { id: a.id, s: n(a.s, 0.2, 4, 1), x: n(a.x, -40, 40, 0), y: n(a.y, -40, 60, 10), z: n(a.z, -40, 40, 0), rx: n(a.rx, -180, 180, 0), ry: n(a.ry, -180, 180, 0), rz: n(a.rz, -180, 180, 0) };
}

// ---------------- leer, centrar y empacar ----------------
async function accArchivos(files) {
  // (el .zip de Sketchfab: adentro vienen el .gltf, el .bin y las texturas)
  const lista = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) && typeof maqZip === 'function') {
      const z = await maqZip(new Uint8Array(await f.arrayBuffer()));
      for (const [k, b] of Object.entries(z)) lista.push({ name: k, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
    } else lista.push(f);
  }
  return lista;
}
async function accImportar(files) {
  const C = await pjiLeerArchivos(await accArchivos(files));
  const P = C.pos, n = P.length / 3, ni = C.grupos.reduce((a, g) => a + g.tris.length, 0);
  if (!n || !ni) throw new Error('pji.errFormato');
  if (ni / 3 > ACC_TRIS) throw new Error('acc.muchos');
  // centrado en su caja y llevado a ACC_LADO metros de lado
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const k = ACC_LADO / Math.max(1e-6, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = (P[i * 3 + c] - (mn[c] + mx[c]) / 2) * k;
  let nor = C.nor; if (!nor || nor.length !== n * 3) { nor = new Float32Array(n * 3); pjiNormales(pos, C.grupos, nor); }
  const tex = await pjiDecodificar(C.imgs || [], typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024);
  // (con el formato de los personajes importados: un solo «hueso», la cabeza)
  const ses = { Nm: { pos, nor, uv: C.uv, grupos: C.grupos, mats: C.mats.length ? C.mats : [{ c: [0.8, 0.8, 0.8, 1], img: -1, alfa: 'op', dos: false }], alto: ACC_LADO },
    rig: { huesos: [{ n: 'Head', pa: -1, p: [0, 0, 0], q: [0, 0, 0, 1] }], hb: new Uint8Array(n * 3), hw: (() => { const w = new Float32Array(n * 3); for (let i = 0; i < n; i++) w[i * 3] = 1; return w; })(), puntas: {}, propio: true },
    tex, pts: null };
  const pack = await pjiEmpacar(ses, C.nombre || 'Accesorio', 1024);
  if (pack.length > PJI_MAX.tot) throw new Error('acc.pesado');
  const id = pjiHuella(pack), meta = { id, n: String(C.nombre || 'Accesorio').slice(0, 24), tris: Math.round(ni / 3), fecha: Date.now() };
  await accGuardar(meta, pack);
  return meta;
}

// ---------------- guardados en el aparato ----------------
function accDB() {
  if (ACCS.db) return ACCS.db;
  return (ACCS.db = new Promise((ok) => { try { const r = indexedDB.open('jxmod-accesorios', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ac', { keyPath: 'id' }); r.result.createObjectStore('pk'); }; r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } }));
}
async function accCargarLista() {
  if (ACCS.cargada) return ACCS.lista; const db = await accDB();
  const L = db ? await pjiTx(db, 'ac', 'readonly', (s) => s.getAll()) : null; ACCS.lista = (L || ACCS.lista).sort((a, b) => (a.fecha || 0) - (b.fecha || 0)); ACCS.cargada = true; return ACCS.lista;
}
async function accPaquete(id) {
  if (ACCS.packs.has(id)) return ACCS.packs.get(id);
  const db = await accDB(); const b = db ? await pjiTx(db, 'pk', 'readonly', (s) => s.get(id)) : null;
  if (b) ACCS.packs.set(id, b instanceof Uint8Array ? b : new Uint8Array(b)); return ACCS.packs.get(id) || null;
}
async function accGuardar(meta, pack) {
  ACCS.packs.set(meta.id, pack); ACCS.lista = ACCS.lista.filter((x) => x.id !== meta.id).concat([meta]);
  const db = await accDB(); if (!db) return false;
  await pjiTx(db, 'pk', 'readwrite', (s) => s.put(pack, meta.id)); await pjiTx(db, 'ac', 'readwrite', (s) => s.put(meta)); return true;
}
async function accBorrar(id) {
  ACCS.lista = ACCS.lista.filter((x) => x.id !== id); ACCS.packs.delete(id); accSoltar(id);
  if (PREFS.acc && PREFS.acc.id === id) { PREFS.acc = null; guardarPrefs(); }
  const db = await accDB(); if (db) { await pjiTx(db, 'pk', 'readwrite', (s) => s.delete(id)); await pjiTx(db, 'ac', 'readwrite', (s) => s.delete(id)); }
}
function accSoltar(id) { const G = ACCS.mallas.get(id); if (G && G.partes) for (const p of G.partes) mallaPropiaBorrar(p.m); ACCS.mallas.delete(id); }

// ---------------- el modelo listo para dibujar: una malla por material ----------------
function accMalla(id) {
  const G = ACCS.mallas.get(id); if (G) return G.partes ? G : null;
  if (ACCS.armando.has(id)) return null; ACCS.armando.add(id);
  (async () => {
    try {
      const b = await accPaquete(id); if (!b) { ACCS.armando.delete(id); return; }
      const U = await pjiDesempacar(b), tex = await pjiDecodificar(U.imgs, typeof GFX !== 'undefined' && GFX.memBaja ? 512 : 1024);
      const noms = pjiMateriales('acc_' + id, U.Nm, tex), Nm = U.Nm, partes = [];
      for (const g of Nm.grupos) {
        // (cada material con sus vértices, renumerados)
        const re = new Map(), B = { P: [], N: [], U: [], I: [] };
        for (let t = 0; t < g.tris.length; t++) {
          const v = g.tris[t]; let j = re.get(v);
          if (j === undefined) { j = re.size; re.set(v, j); B.P.push(Nm.pos[v * 3], Nm.pos[v * 3 + 1], Nm.pos[v * 3 + 2]); B.N.push(Nm.nor[v * 3], Nm.nor[v * 3 + 1], Nm.nor[v * 3 + 2]); B.U.push(Nm.uv ? Nm.uv[v * 2] : 0, Nm.uv ? Nm.uv[v * 2 + 1] : 0); }
          B.I.push(j);
        }
        const m = mallaPropia(B), x = GMOD.mats.get(noms[g.mat] + '|');
        if (m >= 0 && x) partes.push({ m, mt: x.mi });
      }
      ACCS.mallas.set(id, { partes, n: U.J.n });
    } catch (e) { if (typeof gmErr === 'function') gmErr('accesorio ' + id, e); ACCS.mallas.set(id, { partes: null }); }
    ACCS.armando.delete(id);
  })();
  return null;
}

// ---------------- en la cabeza (personas.js, después del gorro) ----------------
const _acA = new Float32Array(16), _acH = new Float32Array(16), _acM = new Float32Array(16), _acQ = new Quat();
function accDe(P) { return P.remoto ? P.accAj : P.npc ? null : P === JUG.cuerpo || P.lobby || (typeof DEP !== 'undefined' && P === DEP.pj) ? PREFS.acc : null; }
function accDibujar(P) {
  const a = accDe(P); if (!a) return;
  if (P === JUG.cuerpo && typeof camaraAfuera === 'function' && !camaraAfuera()) return;   // (en primera persona taparía la cámara)
  const G = accMalla(a.id); if (!G || !G.partes || !G.partes.length) { if (P.remoto && !ACCS.packs.has(a.id)) accPedir(a.id, P.id); return; }
  const hi = P.D && P.D.h && P.D.h.Head; if (hi === undefined) return;
  P.md.actualizar(); const W = P.md.W[hi];
  // (el marco de la cabeza sin la escala del modelo: los ejes normalizados por el tamaño del personaje)
  const ex = Math.hypot(W[0], W[1], W[2]) || 1, ey = Math.hypot(W[4], W[5], W[6]) || 1, ez = Math.hypot(W[8], W[9], W[10]) || 1, t = P.tam || 1;
  _acH.set([W[0] / ex * t, W[1] / ex * t, W[2] / ex * t, 0, W[4] / ey * t, W[5] / ey * t, W[6] / ey * t, 0, W[8] / ez * t, W[9] / ez * t, W[10] / ez * t, 0, W[12], W[13], W[14], 1]);
  const r = Math.PI / 180, q = Quat.euler(a.ry * r, a.rx * r, a.rz * r);
  m4trs([a.x / 100, a.y / 100, a.z / 100], [q.x, q.y, q.z, q.w], [a.s, a.s, a.s], _acA); m4mul(_acH, _acA, _acM);
  const M = Float32Array.from(_acM);
  for (const p of G.partes) encolar(p.m, 0, p.mt, M, null, null);
}

// ---------------- en multijugador: lo bajan del que lo tiene puesto (como pjiPedir / pjiMandar / pjiRed) ----------------
function accPedir(id, de) {
  const p = ACCS.pidiendo.get(id) || { t: -1e9, n: 0 }, t = performance.now(); if (t - p.t < 12000 || p.n >= 6) return;
  p.t = t; p.n++; ACCS.pidiendo.set(id, p); if (typeof publicar === 'function' && RED.on) publicar('a', { k: 'acq', g: id, to: typeof de === 'string' ? de.slice(0, 20) : '' });
}
async function accMandar(id) {
  if (ACCS.enviando.has(id)) return; ACCS.enviando.add(id);
  try {
    const b = await accPaquete(id); if (!b || b.length > PJI_MAX.tot) return;
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    const d = btoa(s), L = []; for (let i = 0; i < d.length; i += 24000) L.push(d.slice(i, i + 24000));
    for (let x = 0; x < L.length; x++) { if (!RED.on) break; publicar('a', { k: 'acd', g: id, x, n: L.length, d: L[x] }); await new Promise((ok) => setTimeout(ok, 125)); }
  } finally { setTimeout(() => ACCS.enviando.delete(id), 3000); }
}
function accRed(d) {
  if (typeof d.g !== 'string' || !/^[a-z0-9_]{6,40}$/.test(d.g)) return;
  if (d.k === 'acq') { if ((!d.to || d.to === RED.ID) && ACCS.lista.some((x) => x.id === d.g)) accMandar(d.g); return; }
  if (d.k !== 'acd' || typeof d.d !== 'string' || ACCS.packs.has(d.g)) return;
  const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 460 || i < 0 || i >= n || d.d.length > 24000) return;
  let e = ACCS.partes.get(d.g); if (!e || e.n !== n || performance.now() - e.t > 90000) { e = { n, p: new Array(n), llegaron: 0, t: performance.now() }; ACCS.partes.set(d.g, e); }
  if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; }
  if (e.llegaron < n) return;
  ACCS.partes.delete(d.g);
  try {
    const s = atob(e.p.join('')), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k);
    if (pjiHuella(b) !== d.g) return;   // (lo que llegó tiene que ser ese accesorio)
    ACCS.packs.set(d.g, b); ACCS.mallas.delete(d.g);
  } catch (x) {}
}

// ---------------- en Personajes → Gorros: importar, elegir, ajustar, sacar ----------------
const ACC_BARRAS = [['s', 'acc.tam', 20, 400, 5, '%'], ['y', 'acc.alto', -40, 60, 1, ' cm'], ['z', 'acc.adelante', -40, 40, 1, ' cm'], ['x', 'acc.costado', -40, 40, 1, ' cm'],
  ['ry', 'acc.girar', -180, 180, 5, '°'], ['rx', 'acc.inclinar', -180, 180, 5, '°'], ['rz', 'acc.ladear', -180, 180, 5, '°']];
function accHTML() {
  const a = accLimpio(PREFS.acc), L = ACCS.lista;
  const chips = L.map((m) => `<span class="accChip${a && a.id === m.id ? ' sel' : ''}"><button data-acc="poner:${m.id}">${esc(m.n)}</button><button class="accX" data-acc="borrar:${m.id}" title="${esc(T('acc.borrar'))}">${glifo('no')}</button></span>`).join('');
  const barras = a ? ACC_BARRAS.map(([k, t, lo, hi, p, u]) => { const v = k === 's' ? Math.round(a.s * 100) : Math.round(a[k]); return `<label class="gaF">${esc(T(t))}<input type="range" data-accv="${k}" min="${lo}" max="${hi}" step="${p}" value="${v}"><output>${v}${u}</output></label>`; }).join('') : '';
  return `<div class="gorroAj accCaja"><div class="gaTit">${glifo('subir')} ${esc(T('acc.tit'))}</div><div class="gaSub">${esc(T('acc.ayuda'))}</div>
    <label class="rbBtnGris rbChico accImp">${glifo('subir')} ${esc(T('acc.importar'))}<input type="file" multiple accept=".glb,.gltf,.obj,.mtl,.bin,.png,.jpg,.jpeg,.webp,.zip" hidden></label>
    <div class="accEstado"></div>${chips ? `<div class="accLista">${chips}</div>` : ''}
    ${a ? `${barras}<button class="rbBtnGris rbChico" data-acc="sacar:">${esc(T('acc.sacar'))}</button>` : ''}</div>`;
}
function accMontar(raiz, rehacer) {
  const c = raiz.querySelector('.accCaja'); if (!c) return;
  const est = (t) => { const e = c.querySelector('.accEstado'); if (e) e.textContent = t || ''; };
  c.addEventListener('keydown', (e) => e.stopPropagation());
  c.querySelector('.accImp input').addEventListener('change', async (e) => {
    const fs = [...e.target.files]; if (!fs.length) return; est(T('acc.leyendo'));
    try { const m = await accImportar(fs); PREFS.acc = accLimpio({ id: m.id }); guardarPrefs(); rehacer(); }
    catch (x) { est((x && /^acc\./.test(x.message) ? T(x.message) : typeof pjiErrorTxt === 'function' ? pjiErrorTxt(x) : T('acc.error'))); }
  });
  c.addEventListener('input', (e) => {
    const k = e.target.dataset.accv; if (!k) return; const a = accLimpio(PREFS.acc); if (!a) return;
    const v = +e.target.value; a[k] = k === 's' ? v / 100 : v; PREFS.acc = accLimpio(a);
    const b = ACC_BARRAS.find((x) => x[0] === k); e.target.nextElementSibling.textContent = v + b[5];
    clearTimeout(accMontar.t); accMontar.t = setTimeout(guardarPrefs, 300);
  });
  c.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]'); if (!b) return; e.stopPropagation();
    const [k, id] = b.dataset.acc.split(':');
    if (k === 'poner') { PREFS.acc = accLimpio(Object.assign({}, PREFS.acc && PREFS.acc.id === id ? PREFS.acc : {}, { id })); guardarPrefs(); rehacer(); }
    else if (k === 'sacar') { PREFS.acc = null; guardarPrefs(); rehacer(); }
    else if (k === 'borrar') { await accBorrar(id); rehacer(); }
  });
}
setTimeout(() => { accCargarLista(); if (PREFS.acc && !accLimpio(PREFS.acc)) PREFS.acc = null; }, 0);
Object.assign(IDI3, {
  'acc.tit': ['Accesorio importado', 'Imported accessory', 'Acessório importado', 'Aksesori impor', 'Aksesori import', 'Na-import na aksesorya', '読み込んだアクセサリー', 'อุปกรณ์เสริมที่นำเข้า', 'İçe aktarılan aksesuar', 'إكسسوار مستورد', 'Импортированный аксессуар', 'Імпортований аксесуар', 'Accessoire importé', 'Importiertes Accessoire'],
  'acc.ayuda': ['Un casco o lo que quieras para la cabeza: GLB, GLTF, OBJ o el .zip de Sketchfab', 'A helmet or anything for the head: GLB, GLTF, OBJ or the Sketchfab .zip', 'Um capacete ou o que quiser na cabeça: GLB, GLTF, OBJ ou o .zip do Sketchfab', 'Helm atau apa pun untuk kepala: GLB, GLTF, OBJ atau .zip Sketchfab', 'Topi keledar atau apa sahaja untuk kepala: GLB, GLTF, OBJ atau .zip Sketchfab', 'Helmet o kahit ano sa ulo: GLB, GLTF, OBJ o ang .zip ng Sketchfab', 'ヘルメットなど頭に付けるもの：GLB、GLTF、OBJ、SketchfabのZIP', 'หมวกกันน็อกหรืออะไรก็ได้บนหัว: GLB, GLTF, OBJ หรือ .zip ของ Sketchfab', 'Kask ya da başa takılacak her şey: GLB, GLTF, OBJ veya Sketchfab .zip', 'خوذة أو أي شيء للرأس: GLB أو GLTF أو OBJ أو ملف .zip من Sketchfab', 'Шлем или что угодно на голову: GLB, GLTF, OBJ или .zip со Sketchfab', 'Шолом чи будь-що на голову: GLB, GLTF, OBJ або .zip зі Sketchfab', 'Un casque ou ce que tu veux sur la tête : GLB, GLTF, OBJ ou le .zip de Sketchfab', 'Ein Helm oder was du willst für den Kopf: GLB, GLTF, OBJ oder die Sketchfab-.zip'],
  'acc.importar': ['Importar accesorio', 'Import accessory', 'Importar acessório', 'Impor aksesori', 'Import aksesori', 'Mag-import ng aksesorya', 'アクセサリーを読み込む', 'นำเข้าอุปกรณ์เสริม', 'Aksesuar içe aktar', 'استيراد إكسسوار', 'Импорт аксессуара', 'Імпорт аксесуара', 'Importer un accessoire', 'Accessoire importieren'],
  'acc.leyendo': ['Leyendo…', 'Reading…', 'Lendo…', 'Membaca…', 'Membaca…', 'Binabasa…', '読み込み中…', 'กำลังอ่าน…', 'Okunuyor…', 'جارٍ القراءة…', 'Чтение…', 'Читання…', 'Lecture…', 'Wird gelesen…'],
  'acc.error': ['No se pudo leer ese archivo', 'Could not read that file', 'Não deu para ler esse arquivo', 'Tidak bisa membaca file itu', 'Tidak dapat membaca fail itu', 'Hindi mabasa ang file na iyon', 'そのファイルを読めませんでした', 'อ่านไฟล์นั้นไม่ได้', 'Bu dosya okunamadı', 'تعذّرت قراءة هذا الملف', 'Не удалось прочитать файл', 'Не вдалося прочитати файл', 'Impossible de lire ce fichier', 'Diese Datei konnte nicht gelesen werden'],
  'acc.muchos': ['Tiene demasiados triángulos (más de 150 mil): bajá uno más liviano', 'Too many triangles (over 150k): get a lighter one', 'Tem triângulos demais (mais de 150 mil): baixe um mais leve', 'Terlalu banyak segitiga (lebih dari 150 ribu)', 'Terlalu banyak segi tiga (lebih 150 ribu)', 'Sobrang dami ng triangle (higit 150 libo)', '三角形が多すぎます（15万超）', 'สามเหลี่ยมมากเกินไป (เกิน 150,000)', 'Çok fazla üçgen (150 binden fazla)', 'عدد المثلثات كبير جدًا (أكثر من 150 ألفًا)', 'Слишком много треугольников (больше 150 тыс.)', 'Забагато трикутників (понад 150 тис.)', 'Trop de triangles (plus de 150 000)', 'Zu viele Dreiecke (über 150.000)'],
  'acc.pesado': ['Pesa demasiado (más de 8 MB con las texturas)', 'Too heavy (over 8 MB with textures)', 'Pesado demais (mais de 8 MB com as texturas)', 'Terlalu berat (lebih dari 8 MB)', 'Terlalu berat (lebih 8 MB)', 'Masyadong mabigat (higit 8 MB)', '重すぎます（テクスチャ込みで8MB超）', 'ใหญ่เกินไป (เกิน 8 MB)', 'Çok ağır (8 MB üstü)', 'الحجم كبير جدًا (أكثر من 8 ميغابايت)', 'Слишком тяжёлый (больше 8 МБ)', 'Заважкий (понад 8 МБ)', 'Trop lourd (plus de 8 Mo)', 'Zu groß (über 8 MB)'],
  'acc.tam': ['Tamaño', 'Size', 'Tamanho', 'Ukuran', 'Saiz', 'Laki', 'サイズ', 'ขนาด', 'Boyut', 'الحجم', 'Размер', 'Розмір', 'Taille', 'Größe'],
  'acc.alto': ['Arriba / abajo', 'Up / down', 'Cima / baixo', 'Atas / bawah', 'Atas / bawah', 'Taas / baba', '上下', 'ขึ้น / ลง', 'Yukarı / aşağı', 'أعلى / أسفل', 'Вверх / вниз', 'Вгору / вниз', 'Haut / bas', 'Hoch / runter'],
  'acc.adelante': ['Adelante / atrás', 'Forward / back', 'Frente / trás', 'Maju / mundur', 'Depan / belakang', 'Harap / likod', '前後', 'หน้า / หลัง', 'İleri / geri', 'أمام / خلف', 'Вперёд / назад', 'Вперед / назад', 'Avant / arrière', 'Vor / zurück'],
  'acc.costado': ['A los costados', 'Sideways', 'Para os lados', 'Ke samping', 'Ke sisi', 'Patagilid', '左右', 'ด้านข้าง', 'Yanlara', 'جانبيًا', 'В стороны', 'У боки', 'Sur les côtés', 'Seitlich'],
  'acc.girar': ['Girar', 'Turn', 'Girar', 'Putar', 'Pusing', 'Iikot', '回す', 'หมุน', 'Döndür', 'تدوير', 'Повернуть', 'Повернути', 'Tourner', 'Drehen'],
  'acc.inclinar': ['Inclinar', 'Tilt', 'Inclinar', 'Miringkan', 'Condong', 'Ikiling', '傾ける', 'เอียง', 'Eğ', 'إمالة', 'Наклонить', 'Нахилити', 'Incliner', 'Neigen'],
  'acc.ladear': ['Ladear', 'Roll', 'Rolar', 'Gulingkan', 'Golek', 'Pagulungin', '横に傾ける', 'พลิก', 'Yatır', 'دحرجة', 'Завалить вбок', 'Завалити вбік', 'Pencher', 'Kippen'],
  'acc.sacar': ['Sacármelo', 'Take it off', 'Tirar', 'Lepas', 'Tanggalkan', 'Tanggalin', '外す', 'ถอดออก', 'Çıkar', 'خلعه', 'Снять', 'Зняти', 'L’enlever', 'Abnehmen'],
  'acc.borrar': ['Borrar', 'Delete', 'Apagar', 'Hapus', 'Padam', 'Burahin', '削除', 'ลบ', 'Sil', 'حذف', 'Удалить', 'Видалити', 'Supprimer', 'Löschen'],
});
