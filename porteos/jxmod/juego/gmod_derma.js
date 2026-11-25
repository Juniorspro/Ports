// ---------------- las ventanas de los mods (Derma / vgui): el Lua las arma y acá se dibujan arriba del juego ----------------
// Muchos addons tienen su menú en una ventana de Derma: el de bloques del Minecraft SWEP (la R), las opciones de un arma, la
// tienda de un modo de juego. El preludio (gmod_prelude.js) guarda el estado de cada panel en campos «__» —lugar, tamaño,
// texto, valor, lo que tiene adentro— y al hacer MakePopup llama a __jxDerma: la ventana se dibuja acá como HTML, con el
// aspecto de Derma (gris oscuro, barra de título, botones claros), se achica si no entra en la pantalla (en el celu) y cada
// 200 ms se mira si algo cambió (una «firma» con todo lo que se ve) para volver a armarla. Los toques vuelven al Lua con
// __dermaEvento y llaman al DoClick, OnChange, OnSelect, OnRowSelected… del addon. Los menús de clic derecho (DermaMenu,
// DMenu:Open) salen donde se tocó. Mientras hay una abierta el juego suelta el mouse (UI.abierto = 'derma'); Escape la cierra.
// Lo que el addon dibuja a mano en Paint (draw.RoundedBox, surface…) no se ve: se usa el aspecto de base de cada control.
const GMDR = { raices: [], menu: null, el: null, firma: '', iv: 0, pest: new WeakMap(), R: null, mx: 0, my: 0, scroll: new Map(), imgs: [], foco: null };
const GMDR_DOCK = { FILL: 1, LEFT: 2, RIGHT: 3, TOP: 4, BOTTOM: 5 };

function gmdrApi(R, G, def) {
  GMDR.R = R; GMDR.raices = []; GMDR.menu = null;
  def(G, '__jxDerma', (p) => { if (p instanceof LuaTable && !GMDR.raices.includes(p)) GMDR.raices.push(p); gmdrPedir(); });
  def(G, '__jxDermaMenu', (m, x, y) => { if (m instanceof LuaTable) { GMDR.menu = { m, x: typeof x === 'number' ? x : GMDR.mx, y: typeof y === 'number' ? y : GMDR.my, abiertos: [] }; gmdrPedir(); } });
}

// ---- leer el estado de un panel ----
const gmdrN = (p, k, d = 0) => { const v = p.get(k); return typeof v === 'number' && isFinite(v) ? v : d; };
function gmdrTexto(v) {
  let s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : '';
  if (s[0] === '#') s = (typeof gmFraseSi === 'function' ? gmFraseSi(s) : s.slice(1)) || s.slice(1);
  return s;
}
function gmdrColor(c) {
  if (!(c instanceof LuaTable)) return null;
  const a = c.get('a');
  return `rgba(${gmdrN(c, 'r') | 0},${gmdrN(c, 'g') | 0},${gmdrN(c, 'b') | 0},${(typeof a === 'number' ? a : 255) / 255})`;
}
const gmdrVivo = (p) => p instanceof LuaTable && !p.get('__quitado') && !p.get('__oculto');
function gmdrLista(t) { const r = []; if (t instanceof LuaTable) for (let i = 1, n = t.len(); i <= n; i++) { const c = t.get(i); if (c !== undefined && c !== null) r.push(c); } return r; }
const gmdrHijos = (p) => gmdrLista(p.get('__hijos')).filter(gmdrVivo);
// (las filas de un DListView: es un mapa con huecos —RemoveLine—, en orden de número)
function gmdrLineas(p) {
  const L = p.get('__lineas'), r = []; if (!(L instanceof LuaTable)) return r;
  const n = gmdrN(p, '__nlineas', L.len()); for (let i = 1; i <= n; i++) { const l = L.get(i); if (l instanceof LuaTable) r.push([i, l]); }
  return r;
}
const gmdrTipo = (p) => { const t = p.get('__tipo'); return typeof t === 'string' ? t : 'Panel'; };

// ---- el evento al Lua ----
function gmdrEvento(p, ev, a, b) {
  const R = GMDR.R; if (!R || R !== GMA.R) return;
  const f = R.G.get('__dermaEvento'); if (typeof f !== 'function') return;
  try { gmLlamar(f, 'C', p, ev, a, b); } catch (e) { if (typeof gmaErr === 'function') gmaErr(String(e && e.message || e)); }
  if (ev === 'clic' && GMDR.menu && p.get('__tipo') === 'DMenuOption' && !(p.get('__sub') instanceof LuaTable)) GMDR.menu = null;
  gmdrTick(true);
}

// ---- cada 200 ms (y después de cada toque): ¿hay algo abierto? ¿cambió? ----
function gmdrPedir() { if (!GMDR.iv) GMDR.iv = setInterval(() => gmdrTick(false), 200); setTimeout(() => gmdrTick(false), 0); }
function gmdrTick(forzar) {
  GMDR.raices = GMDR.raices.filter((p) => !p.get('__quitado'));
  const vis = GMDR.raices.filter(gmdrVivo), menu = GMDR.menu && !GMDR.menu.m.get('__quitado') ? GMDR.menu : null;
  if (!menu) GMDR.menu = null;
  if (!vis.length && !menu) {
    if (GMDR.el) GMDR.el.classList.add('oc');
    if (typeof UI !== 'undefined' && UI.abierto === 'derma') UI.abierto = null;
    if (!GMDR.raices.length && GMDR.iv) { clearInterval(GMDR.iv); GMDR.iv = 0; }
    GMDR.firma = ''; return;
  }
  if (typeof UI !== 'undefined' && (!UI.abierto || UI.abierto === 'derma')) { if (UI.abierto !== 'derma' && typeof soltarPuntero === 'function') soltarPuntero(); UI.abierto = 'derma'; }
  // (los íconos que se estaban dibujando)
  if (GMDR.imgs.length) GMDR.imgs = GMDR.imgs.filter(([img, m]) => { const u = gmIcono(m); if (u !== GM_ICO_VACIO) { img.src = u; return false; } return img.isConnected; });
  const W = typeof VW === 'function' ? VW() : innerWidth, H = typeof VH === 'function' ? VH() : innerHeight;
  const modelo = vis.map((p) => gmdrModelo(p, gmdrN(p, '__w', 300), gmdrN(p, '__h', 200), 0));
  const firma = JSON.stringify([W, H, modelo, menu ? gmdrModeloMenu(menu.m, 0) : null, menu ? menu.abiertos : null]);
  if (!forzar && firma === GMDR.firma && GMDR.el && !GMDR.el.classList.contains('oc')) return;
  GMDR.firma = firma; gmdrArmar(vis, menu, W, H);
}

// ---- la descripción de lo que se ve (para la firma: sin las tablas de Lua) ----
function gmdrModelo(p, w, h, prof) {
  if (prof > 24) return null;
  const t = gmdrTipo(p), o = [t, gmdrN(p, '__x'), gmdrN(p, '__y'), w, h, gmdrTexto(p.get('__texto')), gmdrTexto(p.get('__titulo'))];
  const v = p.get('__valor'); o.push(typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? v : null);
  o.push(gmdrN(p, '__dock'), p.get('__deshab') ? 1 : 0, gmdrN(p, '__elegido'), gmdrN(p, '__selLinea'), String(p.get('__modelo') || ''), String(p.get('__imagen') || ''));
  if (t === 'DListView') o.push(gmdrLista(p.get('__cols')).map(gmdrTexto), gmdrLineas(p).map(([i, l]) => [i, gmdrLista(l.get('__vals')).map(gmdrTexto)]));
  if (t === 'DComboBox') o.push(gmdrLista(p.get('__opciones')).map((c) => gmdrTexto(c.get('t'))));
  if (t === 'DPropertySheet') o.push(gmdrLista(p.get('__hojas')).map((s) => gmdrTexto(s.get('l'))), GMDR.pest.get(p) || 0);
  o.push(gmdrHijos(p).map((c) => gmdrModelo(c, gmdrN(c, '__w', 64), gmdrN(c, '__h', 24), prof + 1)));
  return o;
}
function gmdrModeloMenu(m, prof) {
  if (prof > 6) return null;
  return gmdrLista(m.get('__ops')).map((o) => [o.get('__tipo'), gmdrTexto(o.get('__texto')), o.get('__sub') instanceof LuaTable ? gmdrModeloMenu(o.get('__sub'), prof + 1) : null]);
}

// ---- armar el HTML ----
function gmdrRaiz() {
  if (GMDR.el) return GMDR.el;
  const el = document.createElement('div'); el.id = 'gmDerma'; el.className = 'oc';
  const st = document.createElement('style');
  st.textContent = `
#gmDerma{position:fixed;inset:0;z-index:60;pointer-events:none;font:13px/1.25 system-ui,Segoe UI,Roboto,sans-serif;color:#eee}
#gmDerma.oc{display:none}
#gmDerma .gdV{position:absolute;pointer-events:auto;transform-origin:0 0}
#gmDerma .gdP{position:absolute;box-sizing:border-box;overflow:hidden}
#gmDerma .gdFrame{background:rgba(42,46,54,.97);border:1px solid #111;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.55)}
#gmDerma .gdTit{position:absolute;left:0;top:0;right:0;height:24px;padding:0 30px 0 8px;line-height:24px;font-weight:600;color:#fff;background:linear-gradient(#3d6fb8,#2f5a99);border-radius:5px 5px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gmDerma .gdX{position:absolute;right:3px;top:2px;width:22px;height:20px;border:0;border-radius:4px;background:#c0392b;color:#fff;font-weight:700;cursor:pointer;line-height:20px;padding:0}
#gmDerma .gdPanel{background:rgba(255,255,255,.06);border-radius:4px}
#gmDerma .gdBtn{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid #888;border-radius:4px;background:linear-gradient(#f4f4f4,#d9d9d9);color:#222;cursor:pointer;font:inherit;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gmDerma .gdBtn:active{background:linear-gradient(#cfcfcf,#e8e8e8)}
#gmDerma .gdBtn[disabled]{opacity:.5;cursor:default}
#gmDerma .gdBtn img{max-height:100%;max-width:100%}
#gmDerma .gdLbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center}
#gmDerma .gdLbl.aj{white-space:normal;align-items:flex-start}
#gmDerma .gdIco{border:1px solid rgba(255,255,255,.18);border-radius:4px;background:rgba(0,0,0,.35);cursor:pointer;display:flex;align-items:center;justify-content:center}
#gmDerma .gdIco:hover{border-color:#6fa8ff}
#gmDerma .gdIco img{width:100%;height:100%;object-fit:contain;pointer-events:none}
#gmDerma .gdIco span{font-size:10px;padding:2px;text-align:center;word-break:break-all;color:#ccc}
#gmDerma .gdChk{display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
#gmDerma .gdChk input{margin:0;width:15px;height:15px;accent-color:#3d6fb8}
#gmDerma .gdSld{display:flex;align-items:center;gap:6px}
#gmDerma .gdSld span{flex:0 0 auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#gmDerma .gdSld input[type=range]{flex:1;min-width:40px;accent-color:#3d6fb8}
#gmDerma .gdSld b{flex:0 0 46px;text-align:right;font-weight:400}
#gmDerma .gdTxt,#gmDerma .gdCmb{box-sizing:border-box;border:1px solid #777;border-radius:3px;background:#fff;color:#111;font:inherit;padding:0 4px}
#gmDerma .gdLst{background:#f3f3f3;color:#111;overflow:auto;border:1px solid #777}
#gmDerma .gdLst table{width:100%;border-collapse:collapse}
#gmDerma .gdLst th{position:sticky;top:0;background:#ddd;font-weight:600;text-align:left;padding:2px 4px;border-bottom:1px solid #aaa}
#gmDerma .gdLst td{padding:2px 4px;border-bottom:1px solid #e2e2e2;white-space:nowrap}
#gmDerma .gdLst tr.sel td{background:#3d6fb8;color:#fff}
#gmDerma .gdFlu{overflow:auto;display:flex;flex-wrap:wrap;align-content:flex-start}
#gmDerma .gdFlu.col{flex-direction:column;flex-wrap:nowrap}
#gmDerma .gdFlu>.gdP{position:relative;flex:0 0 auto}
#gmDerma .gdTabs{position:absolute;left:0;top:0;right:0;height:26px;display:flex;gap:2px}
#gmDerma .gdTab{border:0;border-radius:4px 4px 0 0;background:rgba(255,255,255,.12);color:#ddd;font:inherit;padding:0 10px;cursor:pointer}
#gmDerma .gdTab.sel{background:#3d6fb8;color:#fff}
#gmDerma .gdCat{position:absolute;left:0;top:0;right:0;height:22px;line-height:22px;padding:0 6px;background:rgba(255,255,255,.14);font-weight:600;cursor:pointer}
#gmDerma .gdBar{background:rgba(0,0,0,.4);border:1px solid #555;border-radius:3px}
#gmDerma .gdBar i{display:block;height:100%;background:#3d6fb8}
#gmDerma .gdMenu{position:absolute;pointer-events:auto;min-width:140px;background:#f6f6f6;color:#111;border:1px solid #888;border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.45);padding:3px 0}
#gmDerma .gdMenu div{padding:5px 14px;cursor:pointer;white-space:nowrap;position:relative}
#gmDerma .gdMenu div:hover,#gmDerma .gdMenu div.ab{background:#3d6fb8;color:#fff}
#gmDerma .gdMenu div.sub::after{content:'\\25B8';position:absolute;right:5px}
#gmDerma .gdMenu hr{border:0;border-top:1px solid #ccc;margin:3px 0}
#gmDerma .gdFondo{position:absolute;inset:0;pointer-events:auto}`;
  document.head.appendChild(st);
  // (las teclas que se escriben en un campo de la ventana no van al juego)
  for (const t of ['keydown', 'keyup', 'keypress']) el.addEventListener(t, (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !GMDR.el || GMDR.el.classList.contains('oc')) return;
    e.stopPropagation(); e.preventDefault();
    if (GMDR.menu) { GMDR.menu = null; gmdrTick(true); return; }
    const vis = GMDR.raices.filter(gmdrVivo), top = vis[vis.length - 1];
    if (top) gmdrEvento(top, 'cerrar');
  }, true);
  addEventListener('pointerdown', (e) => { GMDR.mx = e.clientX; GMDR.my = e.clientY; }, true);
  document.body.appendChild(el); GMDR.el = el; return el;
}

// las posiciones de los hijos: los que tienen Dock se acomodan como en Derma (TOP, BOTTOM, LEFT, RIGHT y al final FILL, con
// sus márgenes y el relleno del padre); los demás van donde dicen SetPos/SetSize
function gmdrLugares(p, W, H, hijos) {
  const t = gmdrTipo(p), rel = p.get('__relleno');
  let pad = rel instanceof LuaTable ? [1, 2, 3, 4].map((i) => +rel.get(i) || 0) : null;
  if (!pad) pad = t === 'DFrame' ? [5, 29, 5, 5] : [0, 0, 0, 0];
  const a = { x: pad[0], y: pad[1], w: W - pad[0] - pad[2], h: H - pad[1] - pad[3] }, R = new Map(), llenar = [];
  for (const c of hijos) {
    const d = gmdrN(c, '__dock'); if (!d) continue;
    const m0 = c.get('__margen'), m = m0 instanceof LuaTable ? [1, 2, 3, 4].map((i) => +m0.get(i) || 0) : [0, 0, 0, 0];
    const w = gmdrN(c, '__w', 64), h = gmdrN(c, '__h', 24);
    if (d === GMDR_DOCK.TOP) { R.set(c, [a.x + m[0], a.y + m[1], a.w - m[0] - m[2], h]); a.y += h + m[1] + m[3]; a.h -= h + m[1] + m[3]; }
    else if (d === GMDR_DOCK.BOTTOM) { R.set(c, [a.x + m[0], a.y + a.h - h - m[3], a.w - m[0] - m[2], h]); a.h -= h + m[1] + m[3]; }
    else if (d === GMDR_DOCK.LEFT) { R.set(c, [a.x + m[0], a.y + m[1], w, a.h - m[1] - m[3]]); a.x += w + m[0] + m[2]; a.w -= w + m[0] + m[2]; }
    else if (d === GMDR_DOCK.RIGHT) { R.set(c, [a.x + a.w - w - m[2], a.y + m[1], w, a.h - m[1] - m[3]]); a.w -= w + m[0] + m[2]; }
    else if (d === GMDR_DOCK.FILL) llenar.push([c, m]);
  }
  for (const [c, m] of llenar) R.set(c, [a.x + m[0], a.y + m[1], Math.max(0, a.w - m[0] - m[2]), Math.max(0, a.h - m[1] - m[3])]);
  for (const c of hijos) if (!R.has(c)) R.set(c, [gmdrN(c, '__x'), gmdrN(c, '__y'), gmdrN(c, '__w', 64), gmdrN(c, '__h', 24)]);
  return R;
}

const GMDR_FLUJO = new Set(['DPanelList', 'DIconLayout', 'DTileLayout', 'DListLayout', 'DGrid', 'DCategoryList', 'DForm']);
function gmdrArmar(vis, menu, W, H) {
  const el = gmdrRaiz(), act = document.activeElement, foco = act && el.contains(act) && act.dataset.gd ? [act.dataset.gd, act.selectionStart, act.selectionEnd] : null;
  for (const s of el.querySelectorAll('[data-gd]')) if (s.scrollTop || s.scrollLeft) GMDR.scroll.set(s.dataset.gd, [s.scrollTop, s.scrollLeft]);
  el.textContent = ''; el.classList.remove('oc'); GMDR.imgs = [];
  vis.forEach((p, n) => {
    const w = gmdrN(p, '__w', 300), h = gmdrN(p, '__h', 200), esc = Math.min(1, (W - 8) / Math.max(1, w), (H - 8) / Math.max(1, h));
    const v = document.createElement('div'); v.className = 'gdV';
    let x = gmdrN(p, '__x'), y = gmdrN(p, '__y');
    if (esc < 1) { x = (W - w * esc) / 2; y = (H - h * esc) / 2; } else { x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y)); }
    v.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:scale(${esc})`;
    v.appendChild(gmdrPanel(p, 0, 0, w, h, 'r' + n, 0)); el.appendChild(v);
  });
  if (menu) gmdrMenu(el, menu, W, H);
  for (const s of el.querySelectorAll('[data-gd]')) { const k = GMDR.scroll.get(s.dataset.gd); if (k) { s.scrollTop = k[0]; s.scrollLeft = k[1]; } }
  if (foco) { const e = el.querySelector(`[data-gd="${foco[0]}"]`); if (e) { e.focus(); try { if (foco[1] != null) e.setSelectionRange(foco[1], foco[2]); } catch (x) { /* no es de texto */ } } }
}

function gmdrPanel(p, x, y, w, h, id, prof) {
  const t = gmdrTipo(p), d = document.createElement('div'); d.className = 'gdP'; d.dataset.gd = id;
  d.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`;
  const fondo = gmdrColor(p.get('__fondo')), color = gmdrColor(p.get('__color')), texto = gmdrTexto(p.get('__texto'));
  const ayuda = gmdrTexto(p.get('__ayuda')); if (ayuda) d.title = ayuda;
  const alfa = p.get('__alfa'); if (typeof alfa === 'number') d.style.opacity = Math.max(0, Math.min(1, alfa / 255));
  const des = !!p.get('__deshab');
  const clic = (el) => { el.addEventListener('click', (e) => { e.stopPropagation(); if (!des) gmdrEvento(p, 'clic'); }); el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); GMDR.mx = e.clientX; GMDR.my = e.clientY; gmdrEvento(p, 'clicDer'); }); gmdrToqueLargo(el, p); };
  if (t === 'DFrame') {
    d.classList.add('gdFrame');
    const tt = document.createElement('div'); tt.className = 'gdTit'; tt.textContent = gmdrTexto(p.get('__titulo')) || ' '; d.appendChild(tt);
    if (!p.get('__sinCerrar')) { const x0 = document.createElement('button'); x0.className = 'gdX'; x0.textContent = '×'; x0.onclick = (e) => { e.stopPropagation(); gmdrEvento(p, 'cerrar'); }; d.appendChild(x0); }
    if (fondo) d.style.background = fondo;
  } else if (t === 'DButton' || t === 'Button' || t === 'DImageButton' || t === 'DColorButton' || t === 'DExpandButton') {
    const b = document.createElement('button'); b.className = 'gdBtn'; b.style.cssText = 'width:100%;height:100%'; b.disabled = des;
    const im = gmdrImagen(p.get('__imagen') || p.get('__icono')); if (im) { const i = document.createElement('img'); i.src = im; b.appendChild(i); }
    if (texto || !im) b.appendChild(document.createTextNode(texto));
    if (t === 'DImageButton' && im && !texto) { b.style.background = 'transparent'; b.style.border = '0'; }
    if (color) b.style.color = color; if (fondo) b.style.background = fondo;
    clic(b); d.appendChild(b);
  } else if (t === 'DLabel' || t === 'Label' || t === 'DLabelURL') {
    d.classList.add('gdLbl'); if (p.get('__ajustar')) d.classList.add('aj'); else d.style.overflow = 'visible'; d.textContent = texto; if (color) d.style.color = color;
    if (fondo) d.style.background = fondo;
  } else if (t === 'SpawnIcon' || t === 'ContentIcon' || t === 'DModelPanel' || t === 'DAdjustableModelPanel') {
    d.classList.add('gdIco'); const m = String(p.get('__modelo') || ''), im = gmdrImagen(p.get('__imagen'));
    if (m || im) { const i = document.createElement('img'); const u = im || gmIcono('gm:' + m.toLowerCase().replace(/\\/g, '/')); i.src = u; if (!im && u === GM_ICO_VACIO) GMDR.imgs.push([i, 'gm:' + m.toLowerCase().replace(/\\/g, '/')]); d.appendChild(i); }
    else if (texto) { const s = document.createElement('span'); s.textContent = texto; d.appendChild(s); }
    if (!d.title && m) d.title = m.split('/').pop().replace(/\.mdl$/i, '');
    if (t !== 'DModelPanel' && t !== 'DAdjustableModelPanel') clic(d);
  } else if (t === 'DImage' || t === 'Material' || t === 'AvatarImage') {
    const im = gmdrImagen(p.get('__imagen')); if (im) { const i = document.createElement('img'); i.src = im; i.style.cssText = 'width:100%;height:100%;object-fit:contain'; d.appendChild(i); }
  } else if (t === 'DCheckBox' || t === 'DCheckBoxLabel' || t === 'ImageCheckBox') {
    const l = document.createElement('label'); l.className = 'gdChk'; l.style.height = '100%';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = p.get('__valor') === true; c.disabled = des;
    c.onchange = (e) => { e.stopPropagation(); gmdrEvento(p, 'check', c.checked); };
    l.appendChild(c); if (texto) l.appendChild(document.createTextNode(texto)); if (color) l.style.color = color; d.appendChild(l);
    d.style.overflow = 'visible';   // (el texto puede pasarse del ancho que calculó el addon: no se corta)
  } else if (t === 'DNumSlider' || t === 'Slider' || t === 'DSlider' || t === 'DNumberWang') {
    const l = document.createElement('div'); l.className = 'gdSld'; l.style.height = '100%';
    const mn = gmdrN(p, '__min', 0), mx = gmdrN(p, '__max', 1), dec = Math.max(0, Math.min(6, gmdrN(p, '__dec', 0) | 0));
    let v = +p.get('__valor'); if (!isFinite(v)) v = mn;
    if (texto) { const s = document.createElement('span'); s.textContent = texto; if (color) s.style.color = color; l.appendChild(s); }
    const r = document.createElement('input'); r.type = 'range'; r.min = mn; r.max = mx; r.step = dec ? Math.pow(10, -dec) : (mx - mn > 0 && mx - mn <= 1 ? 0.01 : 1); r.value = v; r.disabled = des;
    const nb = document.createElement('b'); nb.textContent = (+v).toFixed(dec);
    r.oninput = () => { nb.textContent = (+r.value).toFixed(dec); };
    r.onchange = (e) => { e.stopPropagation(); gmdrEvento(p, 'slider', +(+r.value).toFixed(dec)); };
    l.appendChild(r); l.appendChild(nb); d.appendChild(l);
  } else if (t === 'DTextEntry' || t === 'TextEntry') {
    const multi = !!p.get('__multi'), c = document.createElement(multi ? 'textarea' : 'input'); c.className = 'gdTxt'; c.dataset.gd = id + 't';
    c.style.cssText = 'width:100%;height:100%'; c.value = gmdrTexto(p.get('__texto')); c.disabled = des;
    const pista = gmdrTexto(p.get('__pista')); if (pista) c.placeholder = pista;
    c.onchange = () => gmdrEvento(p, 'texto', c.value);
    c.onkeydown = (e) => { if (e.key === 'Enter' && !multi) { e.preventDefault(); gmdrEvento(p, 'enter', c.value); } };
    d.appendChild(c);
  } else if (t === 'DComboBox') {
    const s = document.createElement('select'); s.className = 'gdCmb'; s.style.cssText = 'width:100%;height:100%'; s.disabled = des;
    const ops = gmdrLista(p.get('__opciones')), el = gmdrN(p, '__elegido');
    if (!el) { const o = document.createElement('option'); o.textContent = texto || ''; o.value = ''; o.disabled = true; o.selected = true; s.appendChild(o); }
    ops.forEach((c, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = gmdrTexto(c.get('t')); if (el === i + 1) o.selected = true; s.appendChild(o); });
    s.onchange = (e) => { e.stopPropagation(); if (s.value) gmdrEvento(p, 'combo', +s.value); };
    d.appendChild(s);
  } else if (t === 'DListView' || t === 'DListBox') {
    d.classList.add('gdLst'); const tb = document.createElement('table'), cols = gmdrLista(p.get('__cols')).map(gmdrTexto), sel = gmdrN(p, '__selLinea');
    if (cols.length) { const tr = document.createElement('tr'); for (const c of cols) { const th = document.createElement('th'); th.textContent = c; tr.appendChild(th); } tb.appendChild(tr); }
    for (const [i, ln] of gmdrLineas(p)) {
      const tr = document.createElement('tr'); if (i === sel) tr.className = 'sel';
      for (const v of gmdrLista(ln.get('__vals'))) { const td = document.createElement('td'); td.textContent = gmdrTexto(v); tr.appendChild(td); }
      tr.onclick = (e) => { e.stopPropagation(); gmdrEvento(p, 'fila', i); };
      tr.ondblclick = (e) => { e.stopPropagation(); gmdrEvento(p, 'fila', i, true); };
      tr.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); GMDR.mx = e.clientX; GMDR.my = e.clientY; gmdrEvento(p, 'filaDer', i); };
      tb.appendChild(tr);
    }
    d.appendChild(tb);
  } else if (t === 'DProgress') {
    d.classList.add('gdBar'); const i = document.createElement('i'); i.style.width = Math.max(0, Math.min(1, +p.get('__valor') || 0)) * 100 + '%'; d.appendChild(i);
  } else if (t === 'DPropertySheet') {
    const hojas = gmdrLista(p.get('__hojas')).filter((s) => s.get('p') instanceof LuaTable && !s.get('p').get('__quitado'));
    let k = GMDR.pest.get(p) || 0; if (k >= hojas.length) k = 0;
    const tabs = document.createElement('div'); tabs.className = 'gdTabs';
    hojas.forEach((s, i) => { const b = document.createElement('button'); b.className = 'gdTab' + (i === k ? ' sel' : ''); b.textContent = gmdrTexto(s.get('l')); b.onclick = (e) => { e.stopPropagation(); GMDR.pest.set(p, i); gmdrTick(true); }; tabs.appendChild(b); });
    d.appendChild(tabs);
    if (hojas[k]) d.appendChild(gmdrPanel(hojas[k].get('p'), 0, 28, w, h - 28, id + 'h' + k, prof + 1));
    return d;
  } else if (t === 'DCollapsibleCategory' || t === 'DCategoryHeader') {
    const c = document.createElement('div'); c.className = 'gdCat'; c.textContent = texto; c.onclick = (e) => { e.stopPropagation(); p.set('__cerrado', !p.get('__cerrado')); gmdrTick(true); }; d.appendChild(c);
    if (p.get('__cerrado')) return d;
    // (lo de adentro, debajo del título, uno abajo del otro)
    let yy = 24; gmdrHijos(p).forEach((ch, i) => { const hh = gmdrN(ch, '__h', 24); d.appendChild(gmdrPanel(ch, 0, yy, w, hh, id + '.' + i, prof + 1)); yy += hh + 2; });
    return d;
  } else if (t === 'DHTML' || t === 'HTML') {
    d.classList.add('gdPanel');
  } else if (t !== 'EditablePanel' && t !== 'DScrollPanel' && t !== 'DHorizontalScroller' && t !== 'DSizeToContents' && t !== 'Panel') {
    if (!p.get('__sinFondo')) d.classList.add('gdPanel');
    if (fondo) d.style.background = fondo;
  }
  if (t === 'Panel' && fondo) d.style.background = fondo;
  if (prof > 24) return d;
  // los hijos
  const hijos = gmdrHijos(p); if (!hijos.length) return d;
  if (GMDR_FLUJO.has(t) || (t === 'DScrollPanel' && hijos.every((c) => !gmdrN(c, '__dock') && !gmdrN(c, '__x') && !gmdrN(c, '__y')))) {
    // (listas: uno al lado del otro —EnableHorizontal, DIconLayout— o uno abajo del otro, con su espacio, y barra para bajar)
    const horiz = t === 'DIconLayout' || t === 'DTileLayout' || t === 'DGrid' || !!p.get('__horiz');
    const pad = gmdrN(p, '__pad', 0), esp = gmdrN(p, '__esp', 0), ex = gmdrN(p, '__espX', esp), ey = gmdrN(p, '__espY', esp);
    d.classList.add('gdFlu'); if (!horiz) d.classList.add('col'); d.style.padding = pad + 'px'; d.style.gap = `${ey}px ${ex}px`;
    hijos.forEach((c, i) => { const cw = horiz ? gmdrN(c, '__w', 64) : w - pad * 2, ch = gmdrN(c, '__h', 24); const e = gmdrPanel(c, 0, 0, cw, ch, id + '.' + i, prof + 1); d.appendChild(e); });
    return d;
  }
  if (t === 'DScrollPanel') d.style.overflow = 'auto';
  const L = gmdrLugares(p, w, h, hijos);
  hijos.forEach((c, i) => { const r = L.get(c); d.appendChild(gmdrPanel(c, r[0], r[1], r[2], r[3], id + '.' + i, prof + 1)); });
  return d;
}

// (en el celu no hay clic derecho: mantener apretado medio segundo hace lo mismo)
function gmdrToqueLargo(el, p) {
  let tm = 0;
  el.addEventListener('touchstart', (e) => { const t = e.touches[0]; tm = setTimeout(() => { tm = -1; GMDR.mx = t.clientX; GMDR.my = t.clientY; gmdrEvento(p, 'clicDer'); }, 550); }, { passive: true });
  const fin = (e) => { if (tm === -1 && e.cancelable) e.preventDefault(); clearTimeout(tm); tm = 0; };
  el.addEventListener('touchend', fin); el.addEventListener('touchmove', () => { clearTimeout(tm); tm = 0; }, { passive: true });
}

// (una imagen de un addon: «materials/…png» o «…jpg»; los .vmt no)
const GMDR_IMG = new Map();
function gmdrImagen(r) {
  if (typeof r !== 'string' || !r) return null;
  let k = r.replace(/\\/g, '/').toLowerCase(); if (!/\.(png|jpe?g)$/.test(k)) { if (/\.\w+$/.test(k)) return null; k += '.png'; }
  if (GMDR_IMG.has(k)) return GMDR_IMG.get(k);
  let u = null;
  for (const c of [k, 'materials/' + k]) { const b = typeof gmArchivo === 'function' ? gmArchivo(c) : null; if (b) { u = URL.createObjectURL(new Blob([b], { type: /png$/.test(k) ? 'image/png' : 'image/jpeg' })); break; } }
  if (u || GMDR_IMG.size < 400) GMDR_IMG.set(k, u);
  return u;
}

// el menú de clic derecho (DermaMenu): donde se tocó, con sus submenús al costado
function gmdrMenu(el, menu, W, H) {
  const fondo = document.createElement('div'); fondo.className = 'gdFondo';
  fondo.onpointerdown = (e) => { e.stopPropagation(); GMDR.menu = null; gmdrTick(true); };
  el.appendChild(fondo);
  const lista = (m, x, y, nivel) => {
    const c = document.createElement('div'); c.className = 'gdMenu'; el.appendChild(c);
    gmdrLista(m.get('__ops')).forEach((o, i) => {
      if (o.get('__tipo') === 'DMenuSpacer') { c.appendChild(document.createElement('hr')); return; }
      const it = document.createElement('div'); it.textContent = gmdrTexto(o.get('__texto'));
      const sub = o.get('__sub');
      if (sub instanceof LuaTable) {
        it.classList.add('sub'); if (menu.abiertos[nivel] === i) it.classList.add('ab');
        it.onclick = (e) => { e.stopPropagation(); menu.abiertos.length = nivel; menu.abiertos[nivel] = i; gmdrEvento(o, 'clic'); };
      } else it.onclick = (e) => { e.stopPropagation(); gmdrEvento(o, 'clic'); };
      c.appendChild(it);
    });
    const r = c.getBoundingClientRect();
    c.style.left = Math.max(0, Math.min(W - r.width - 2, x)) + 'px'; c.style.top = Math.max(0, Math.min(H - r.height - 2, y)) + 'px';
    const k = menu.abiertos[nivel], ops = gmdrLista(m.get('__ops'));
    if (k !== undefined && ops[k] && ops[k].get('__sub') instanceof LuaTable) { const it = c.children[k], ri = it ? it.getBoundingClientRect() : r; lista(ops[k].get('__sub'), r.right - 2, ri.top, nivel + 1); }
  };
  lista(menu.m, menu.x, menu.y, 0);
}

if (typeof module !== 'undefined') module.exports = { GMDR, gmdrApi, gmdrTick, gmdrLugares };
