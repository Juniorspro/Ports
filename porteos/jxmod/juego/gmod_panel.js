// ---------------- el botón GMod: todo lo de los addons de GMod en un lugar, jugando ----------------
// Un botón propio en la pantalla (al lado de MOD; en el celu, en la fila de chat y celular, movible con el editor de
// botones) abre un panel con un apartado por addon instalado y uno para el modo de juego puesto:
//   - Armas, Entidades, NPCs, Vehículos, Personajes y Props: tocar las da o las pone (lo mismo que el menú de props).
//   - Herramientas: las de la Tool Gun que trae el addon (stools): tocar equipa la Tool Gun con esa herramienta; sus
//     clics llaman a LeftClick/RightClick del addon.
//   - Habilidades: lo que el addon espera por teclado (los binds de PlayerBindPress, como la F de la Lightsaber y los
//     números 1-9; las teclas KEY_ que mira; los IN_ de sus KeyPress). Cada una es un botón que se aprieta acá o se fija
//     en la pantalla (para jugar en el celu, que no tiene teclado).
//   - Comandos: los concommand del addon, como botones (con un argumento opcional).
//   - Ajustes: sus ConVars (las de la Tool Gun, las de su menú, las del modo) como interruptor, número o texto; lo que se
//     cambia queda guardado en el aparato.
//   - Info: archivos, Lua corrido, errores y funciones de GMod que le faltan al motor (para saber qué no anda).
const GMB = { boton: null, el: null, abierto: false, sel: null, q: '', fijos: [], arg: {} };
const GMB_LS = 'rb_gmb_fijos', GMB_CV = 'rb_gmcvars';
addEventListener('pointerdown', (e) => { if (GMB.abierto && !(e.target.closest && e.target.closest('#gmbPanel, .gmbBt'))) gmbCerrar(); }, true);

// ---- el botón ----
function gmbBoton() {
  let b = GMB.boton;
  if (!b) {
    b = GMB.boton = document.createElement('div'); b.className = 'redondo bt gmbBt';
    b.innerHTML = `<img alt="" src="${GM_ICO}"><small>GMod</small><i class="mmN"></i>`;
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); if (typeof audioIniciar === 'function') audioIniciar(); gmbAlternar(); };
    const a = $('arribaIz'); if (a) a.appendChild(b);
  }
  const hay = JUEGO.estado === 'juego' && !(typeof CREA !== 'undefined' && CREA.on);
  b.style.display = hay ? '' : 'none';
  const n = hay ? GMOD.addons.size : 0, ni = b.querySelector('.mmN'); ni.textContent = n || ''; ni.style.display = n ? '' : 'none';
  if (!hay && GMB.abierto) gmbCerrar(); else if (GMB.abierto) gmbDibujar();
  gmbFijosDibujar();
}
function gmbAlternar() { if (GMB.abierto) gmbCerrar(); else gmbAbrir(); }
function gmbAbrir(sel) {
  if (JUEGO.estado !== 'juego') return;
  if (!GMB.el) {
    const el = (GMB.el = document.createElement('div')); el.id = 'gmbPanel'; el.className = 'oc';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-gb]'); if (!b || b.dataset.hold !== undefined) return; if (typeof audioIniciar === 'function') audioIniciar(); gmbAccion(b.dataset.gb, b, e); });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'gmbQ') { GMB.q = e.target.value; gmbCuerpo(); return; }
      const cv = e.target.dataset && e.target.dataset.cv; if (cv && e.target.type !== 'checkbox') gmbCvarPoner(cv, e.target.value, e.target.type === 'range');
      const ar = e.target.dataset && e.target.dataset.arg; if (ar) GMB.arg[ar] = e.target.value;
    });
    el.addEventListener('change', (e) => { const cv = e.target.dataset && e.target.dataset.cv; if (cv && e.target.type === 'checkbox') gmbCvarPoner(cv, e.target.checked ? '1' : '0'); });
    // (las habilidades se mantienen apretadas mientras el dedo está)
    const hold = (on) => (e) => { const b = e.target.closest('[data-hold]'); if (!b) return; e.preventDefault(); gmbHab(b.dataset.hold, on, b); };
    el.addEventListener('pointerdown', hold(true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, hold(false), true);
    el.addEventListener('keydown', (e) => e.stopPropagation());
    document.body.appendChild(el);
  }
  if (typeof cerrarPaneles === 'function') cerrarPaneles();
  UI.abierto = 'gmb'; GMB.abierto = true; if (typeof soltarPuntero === 'function') soltarPuntero();
  if (sel) GMB.sel = sel;
  GMB.el.classList.remove('oc'); GMB.boton && GMB.boton.classList.add('on'); gmbDibujar();
}
function gmbCerrar() {
  GMB.abierto = false; if (GMB.el) GMB.el.classList.add('oc'); if (GMB.boton) GMB.boton.classList.remove('on');
  for (const k of [...GMB.apretadas || []]) gmbHab(k, false);
  if (UI.abierto === 'gmb') UI.abierto = null;
}

// ---- lo que trae cada addon ----
function gmbAddons() { return [...GMOD.addons.values()].filter((A) => A && A.G); }
function gmbItems(A) {
  const pms = typeof gmpLista === 'function' ? gmpLista().filter((r) => A.G.archivos.has(r)) : [];
  const L = (k) => [...((A.listas && A.listas[k]) || new Map()).keys()];
  return {
    armas: (A.sweps || []).map((c) => 'gmswep:' + c), ents: (A.sents || []).map((c) => 'gment:' + c),
    npcs: [...L('NPC').map((k) => 'gmnpc:' + k), ...pms.map((r) => 'gmnpcm:' + r)], vehs: L('Vehicles').map((k) => 'gmveh:' + k),
    pms: pms.map((r) => 'gmpm:' + r), props: [...pms.map((r) => 'gmrag:' + r), ...(typeof gmPropsMenu === 'function' ? gmPropsMenu(A).map((r) => 'gm:' + r) : [])],
  };
}
// el Lua del addon como texto (para leer qué teclas, binds y comandos usa)
function gmbFuente(A) {
  if (A._gmbFuente !== undefined) return A._gmbFuente;
  const td = new TextDecoder('latin1'); let s = '';
  for (const r of A.lua || []) { const b = A.G.archivos.get(r); if (b && s.length < 6e6) s += '\n--@@' + r + '\n' + td.decode(b); }
  return (A._gmbFuente = s);
}
// las habilidades: binds de PlayerBindPress, teclas KEY_ que mira e IN_ de sus KeyPress
const GMB_BIND_NOM = { 'impulse 100': 'F', '+reload': 'R', '+use': 'E', '+attack2': '◎ 2', '+attack': '◎ 1', '+menu': 'Q', '+menu_context': 'C', '+zoom': 'Zoom', '+jump': '⤒', '+duck': '⤓', '+speed': 'Shift', '+walk': 'Alt', invnext: '▼', invprev: '▲', gm_showhelp: 'F1', gm_showteam: 'F2', gm_showspare1: 'F3', gm_showspare2: 'F4', '+showscores': 'Tab', noclip: 'N', 'impulse 201': 'Spray' };
const GMB_IN = { ATTACK2: 2048, RELOAD: 8192, USE: 32, ZOOM: 0x80000, WALK: 0x40000, SPEED: 0x20000, GRENADE1: 0x800000, GRENADE2: 0x1000000, ALT1: 0x4000, ALT2: 0x8000, DUCK: 4, JUMP: 2 };
function gmbHabilidades(A) {
  if (A._gmbHab) return A._gmbHab;
  const s = gmbFuente(A), out = [], ya = new Set(), add = (o) => { if (!ya.has(o.k) && out.length < 24) { ya.add(o.k); out.push(o); } };
  // (sólo los archivos que de verdad escuchan binds o teclas)
  const partes = s.split('\n--@@');
  for (const p0 of partes) {
    const p = luaSinComentarios(p0);   // (lo que está comentado en el Lua no es una tecla que se use)
    const arma = /^lua\/weapons\//.test(p), n0 = out.length;   // (las de un arma ya salen como botones al tenerla en la mano)
    if (/PlayerBindPress/.test(p)) {
      for (const m of p.matchAll(/bind\s*==\s*["']([^"'\n]{1,40})["']/g)) add({ k: 'bind:' + m[1], t: GMB_BIND_NOM[m[1]] || m[1], d: m[1] });
      for (const m of p.matchAll(/["'](impulse \d+|\+[a-z_0-9]+|invnext|invprev|gm_show\w+)["']/g)) if (new RegExp('bind[^\\n]{0,40}' + m[1].replace(/[+]/g, '\\+')).test(p)) add({ k: 'bind:' + m[1], t: GMB_BIND_NOM[m[1]] || m[1], d: m[1] });
      if (/bind\s*:\s*(StartWith|find|sub)\s*\(\s*["']slot|["']slot["']\s*\.\.|string\.find\(\s*bind\s*,\s*["']slot/.test(p)) for (let i = 1; i <= 9; i++) add({ k: 'bind:slot' + i, t: String(i), d: 'slot' + i });
    }
    if (/IsKeyDown|IsButtonDown|PlayerButtonDown|KeyPressed\(\s*KEY/.test(p)) for (const m of p.matchAll(/\bKEY_([A-Z]|[0-9]|SPACE|LALT|TAB|LSHIFT|LCONTROL|ENTER|PAD_[0-9])\b/g)) {
      const k = m[1], code = /^[A-Z]$/.test(k) ? 'Key' + k : /^[0-9]$/.test(k) ? 'Digit' + k : { SPACE: 'Space', LALT: 'AltLeft', TAB: 'Tab', LSHIFT: 'ShiftLeft', LCONTROL: 'ControlLeft', ENTER: 'Enter' }[k] || 'Numpad' + k.slice(4);
      add({ k: 'key:' + code, t: k.replace('PAD_', 'Num '), d: code });
    }
    if (/KeyPress|KeyDown|KeyPressed|KeyReleased/.test(p)) for (const m of p.matchAll(/\bIN_(ATTACK2|RELOAD|USE|ZOOM|WALK|SPEED|GRENADE1|GRENADE2|ALT1|ALT2)\b/g)) add({ k: 'in:' + m[1], t: { ATTACK2: '◎ 2', RELOAD: 'R', USE: 'E', ZOOM: 'Zoom', WALK: 'Alt', SPEED: 'Shift', GRENADE1: 'G1', GRENADE2: 'G2', ALT1: 'Alt1', ALT2: 'Alt2' }[m[1]], d: GMB_IN[m[1]] });
    if (arma) for (let i = n0; i < out.length; i++) out[i].arma = true;
  }
  return (A._gmbHab = out);
}
// en el celu, al montar un addon cuyas teclas no son de un arma (la F de la Fuerza, los poderes de un mod de
// habilidades, la tecla de un vehículo): sus botones se fijan solos en la pantalla, una vez por addon y mientras haya
// lugar (6); lo que ya tiene botón propio (saltar, agacharse, usar, recargar, disparar) no se repite. Se quitan con la
// chinche del panel GMod.
const GMB_YA_HAY = /^(bind:\+(jump|duck|use|reload|attack|attack2|speed|forward|back|moveleft|moveright)|in:(ATTACK2|RELOAD|USE|DUCK|JUMP|SPEED)|key:(Space|KeyW|KeyA|KeyS|KeyD|KeyE|KeyR|ShiftLeft|ControlLeft))$/;
function gmbAutoFijar(A) {
  if (!(typeof ENT !== 'undefined' && ENT.tactil) && !(typeof COARSE !== 'undefined' && COARSE)) return 0;
  let hechos; try { hechos = JSON.parse(localStorage.getItem('rb_gmb_auto') || '[]'); } catch (e) { hechos = []; }
  if (hechos.includes(A.id)) return 0;
  const L = gmbHabilidades(A).filter((h) => !h.arma && !GMB_YA_HAY.test(h.k) && !GMB.fijos.some((f) => f.k === h.k));
  let n = 0; for (const h of L) { if (GMB.fijos.length >= 6) break; GMB.fijos.push({ k: h.k, t: h.t }); n++; }
  hechos.push(A.id); try { localStorage.setItem('rb_gmb_auto', JSON.stringify(hechos.slice(-200))); localStorage.setItem(GMB_LS, JSON.stringify(GMB.fijos)); } catch (e) {}
  if (n) { gmbFijosDibujar(); if (typeof aviso === 'function') aviso(T('gmb.autoFijo').replace('%n', n).replace('%a', A.nombre || A.id), 3); }
  return n;
}
// los comandos del addon (los registrados mientras corría su Lua; si no, los que nombra con concommand.Add)
function gmbComandos(A) {
  const L = []; if (typeof GMA === 'undefined' || !GMA.cmds) return L;
  const s = gmbFuente(A);
  for (const [n, c] of GMA.cmds) if (c.a === A.id || (!c.a && s.includes('"' + n + '"'))) L.push(n);
  return L.sort().slice(0, 60);
}
function gmbAjustes(A) { if (typeof GMA === 'undefined' || !GMA.cvars) return []; return [...GMA.cvars.values()].filter((c) => c.a === A.id).sort((a, b) => (a.n < b.n ? -1 : 1)).slice(0, 80); }
function gmbHerramientas(A) { return (A.herramientas || []).filter((h) => h.t); }

// ---- el panel ----
function gmbDibujar() {
  if (!GMB.el || !GMB.abierto) return;
  const As = gmbAddons(), M = typeof GMA !== 'undefined' && GMA.modo;
  if (!GMB.sel || (GMB.sel !== 'modo' && !GMOD.addons.has(GMB.sel)) || (GMB.sel === 'modo' && !M)) GMB.sel = M ? 'modo' : As[0] ? As[0].id : null;
  const chip = (id, nom, img) => `<button class="gbChip${GMB.sel === id ? ' sel' : ''}" data-gb="sel:${esc(id)}">${img ? `<img alt="" src="${img}">` : ''}<span dir="auto">${esc(nom)}</span></button>`;
  GMB.el.innerHTML = `<div class="gbCab"><img alt="" src="${GM_ICO}"><b>GMod</b><small>${As.length} ${esc(T('gmb.addons'))}</small><span class="gbEsp"></span>`
    + `<button class="gbTienda" data-gb="tienda">${glifo('mas')}<span>${esc(T('gmb.tienda'))}</span></button><button class="mmX" data-gb="cerrar">${glifo('no')}</button></div>`
    + (As.length || M ? `<div class="gbChips">${M ? chip('modo', GMA.modo.titulo, null) : ''}${As.map((A) => chip(A.id, A.nombre, null)).join('')}</div>`
      + `<div class="gbBus">${glifo('buscar')}<input id="gbmQ" maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"></div><div class="gbCuerpo"></div>`
      : `<div class="gbVacio"><p>${esc(T('gmb.vacio'))}</p><button class="rbBtnG" data-gb="tienda">${esc(T('gmb.tienda'))}</button></div>`);
  const q = GMB.el.querySelector('#gbmQ'); if (q) { q.id = 'gmbQ'; q.value = GMB.q; }
  gmbCuerpo();
}
function gmbTile(it, nom, extra) {
  let src = GM_ICO, gm = null;
  if (/^gm:/.test(it)) { gm = it; src = gmIcono(it); }
  else if (/^gm(npcm|pm):/.test(it)) { gm = 'gm:' + it.replace(/^gm(npcm|pm):/, ''); src = gmIcono(gm); }
  else if (/^gm(npc|veh):/.test(it) && typeof gmLista === 'function') { const v = gmLista(/^gmnpc/.test(it) ? 'NPC' : 'Vehicles', it.replace(/^gm(npc|veh):/, '')), m = v && v.get('Model'); const r = typeof m === 'string' ? m.toLowerCase().replace(/\\/g, '/') : ''; if (r && gmArchivo(r)) { gm = 'gm:' + r; src = gmIcono(gm); } }
  else if (/^gm(ent|swep):/.test(it) && typeof gmaIconoClase === 'function') { const ic = gmaIconoClase(it); src = ic.src; gm = ic.gm || null; }
  return `<div class="it gbIt${extra || ''}" data-gb="it:${esc(it)}"><img src="${src}"${gm ? ` data-gm="${esc(gm)}"` : ''} loading="lazy"><span dir="auto">${esc(nom || propNom(it))}</span></div>`;
}
function gmbSeccion(tit, html, n) { return html ? `<div class="gbSec"><h4>${esc(tit)}${n ? ` <em>${n}</em>` : ''}</h4>${html}</div>` : ''; }
function gmbCuerpo() {
  const C = GMB.el && GMB.el.querySelector('.gbCuerpo'); if (!C) return;
  const q = GMB.q.trim().toLowerCase(), pasa = (s) => !q || String(s).toLowerCase().includes(q);
  if (GMB.sel === 'modo') { C.innerHTML = gmbModoHTML(); return; }
  const A = GMOD.addons.get(GMB.sel); if (!A) { C.innerHTML = ''; return; }
  const I = gmbItems(A), grilla = (L) => { const f = L.filter((it) => pasa(propNom(it) + ' ' + it)); return f.length ? `<div class="gbGrilla">${f.slice(0, 300).map((it) => gmbTile(it)).join('')}</div>` : ''; };
  let s = '';
  s += gmbSeccion(T('gmb.armas'), grilla(I.armas), I.armas.length);
  s += gmbSeccion(T('gmb.ents'), grilla(I.ents), I.ents.length);
  s += gmbSeccion(T('gmb.npcs'), grilla(I.npcs), I.npcs.length);
  s += gmbSeccion(T('gmb.vehs'), grilla(I.vehs), I.vehs.length);
  s += gmbSeccion(T('gmb.pms'), grilla(I.pms), I.pms.length);
  // herramientas de la Tool Gun
  const H = gmbHerramientas(A).filter((h) => pasa(gmbHerNom(h) + ' ' + h.nombre));
  if (H.length) s += gmbSeccion(T('gmb.herr'), `<div class="gbFilas">${H.map((h) => `<button class="gbFila" data-gb="her:${esc(A.id)}:${esc(h.nombre)}">${glifo('martillo')}<span dir="auto">${esc(gmbHerNom(h))}</span><small>${esc(T('gmb.usar'))}</small></button>`).join('')}</div>`, H.length);
  // habilidades (botones que se mantienen apretados; la chinche las fija en la pantalla)
  const Hb = gmbHabilidades(A).filter((h) => pasa(h.t + ' ' + h.k));
  if (Hb.length) s += gmbSeccion(T('gmb.hab'), `<p class="gbAyuda">${esc(T('gmb.habAyuda'))}</p><div class="gbHabs">${Hb.map((h) => { const fijo = GMB.fijos.some((f) => f.k === h.k); return `<span class="gbHab"><button class="gbHabBt" data-gb="hab" data-hold="${esc(h.k)}"><b>${esc(h.t)}</b><small>${esc(h.k.replace(/^(bind|key|in):/, ''))}</small></button><button class="gbPin${fijo ? ' on' : ''}" data-gb="pin:${esc(h.k)}" title="${esc(T('gmb.fijar'))}">${glifo('pin')}</button></span>`; }).join('')}</div>`, Hb.length);
  // comandos
  const Cm = gmbComandos(A).filter(pasa);
  if (Cm.length) s += gmbSeccion(T('gmb.cmds'), `<div class="gbFilas">${Cm.map((n) => `<div class="gbCmd"><button class="gbFila" data-gb="cmd:${esc(n)}">${glifo('jugar')}<span>${esc(n)}</span></button><input data-arg="${esc(n)}" value="${esc(GMB.arg[n] || '')}" placeholder="${esc(T('gmb.arg'))}" spellcheck="false"></div>`).join('')}</div>`, Cm.length);
  // ajustes
  const Aj = gmbAjustes(A).filter((c) => pasa(c.n + ' ' + c.h));
  if (Aj.length) s += gmbSeccion(T('gmb.ajustes'), `<div class="gbAjs">${Aj.map(gmbCvarHTML).join('')}</div>`, Aj.length);
  s += gmbSeccion(T('gmb.props'), grilla(I.props), I.props.length);
  s += gmbInfoHTML(A);
  C.innerHTML = s || `<div class="gbVacio"><p>${esc(T('sinRes'))}</p></div>`;
}
function gmbHerNom(h) {
  if (h.nom) return h.nom;
  let n = h.t && h.t.get('Name'); n = typeof n === 'string' ? n : '';
  if (!n || n.startsWith('#')) {   // (#tool.x.name: el nombre está en el language.Add de su parte de cliente)
    const A = [...GMOD.addons.values()].find((x) => (x.herramientas || []).includes(h)), s = A ? gmbFuente(A) : '';
    const m = new RegExp('language\\.Add\\(\\s*["\']tool\\.' + h.nombre.replace(/\W/g, '') + '\\.name["\']\\s*,\\s*["\']([^"\'\\n]{1,60})["\']').exec(s);
    n = m ? m[1] : h.nombre.replace(/_/g, ' ');
  }
  return (h.nom = n);
}
function gmbCvarHTML(c) {
  // (0/1 es interruptor salvo que el nombre o la ayuda digan que es un número: colores, tamaños, tiempos, cantidades)
  const v = String(c.v), d = String(c.d), num = /^-?\d+(\.\d+)?$/.test(d), pista = c.n + ' ' + (c.h || '');
  const color = /(^|_)(red|green|blue|r|g|b|alpha|a|color|colour|col)(_|$)|\b(red|green|blue)\b/i.test(c.n);
  const esNum = color || /len(gth)?|width|size|scale|speed|time|delay|dist|radius|amount|count|max|min|force|damage|dmg|health|vol(ume)?|range|rate|limit|mult|power|height|fov|\d+-\d+/i.test(pista);
  const bool = !esNum && (d === '0' || d === '1') && /^[01]$/.test(v);
  const nom = c.n.replace(/^[a-z0-9]+_/i, (x) => (x.length > 3 ? '' : x)).replace(/_/g, ' ');
  const ayuda = c.h ? `<small dir="auto">${esc(String(c.h).slice(0, 120))}</small>` : '';
  if (bool) return `<label class="gbAj gbSw"><input type="checkbox" data-cv="${esc(c.n)}"${v === '1' ? ' checked' : ''}><i class="smSw"></i><span><b>${esc(nom)}</b>${ayuda}</span></label>`;
  if (num || esNum) { const x = +v || 0, top = color ? 255 : Math.max(Math.abs(+d) * 4, Math.abs(x) * 2, d.includes('.') ? 1 : 10), paso = color ? 1 : d.includes('.') || (Math.abs(+d) < 2 && Math.abs(+d) > 0) ? 0.01 : 1; return `<label class="gbAj"><span><b>${esc(nom)}</b>${ayuda}</span><input type="number" step="${paso}" data-cv="${esc(c.n)}" value="${esc(v)}"><input type="range" min="${+d < 0 ? -top : 0}" max="${top}" step="${paso}" data-cv="${esc(c.n)}" value="${esc(v)}"></label>`; }
  return `<label class="gbAj"><span><b>${esc(nom)}</b>${ayuda}</span><input data-cv="${esc(c.n)}" value="${esc(v)}" spellcheck="false"></label>`;
}
function gmbInfoHTML(A) {
  const err = (A.luaErr || []).length, falt = (A.faltanModelos || []).length;
  const filas = [[T('gmb.archivos'), A.G.archivos.size + (A.G.perezosos ? A.G.perezosos.size : 0)], [T('gmb.lua'), `${A.luaCorridos || 0} / ${(A.lua || []).length}`], [T('gmb.errores'), err], [T('gmb.modelosFaltan'), falt]];
  const ex = err ? `<pre class="gbErr">${esc((A.luaErr || []).slice(0, 5).join('\n'))}</pre>` : '';
  return gmbSeccion(T('gmb.info'), `<div class="gbInfo">${filas.map(([k, v]) => `<span>${esc(k)}: <b>${esc(String(v))}</b></span>`).join('')}</div>${ex}`);
}
function gmbModoHTML() {
  const M = GMA.modo; if (!M) return '';
  const eq = GMA.equipos && GMA.equipos.get(GMA.equipo ?? 1001);
  const b = (k, t, g) => `<button class="gbFila" data-gb="${k}">${glifo(g)}<span>${esc(t)}</span></button>`;
  let s = gmbSeccion(M.titulo, `<div class="gbInfo"><span>${esc(T('gm.modo'))}: <b>${esc(M.n)}</b></span>${eq ? `<span>${esc(T('gmb.equipo'))}: <b>${esc(eq.n)}</b></span>` : ''}</div>`
    + `<div class="gbFilas">${R_T(M.S.get('TeamBased')) || (GMA.equipos && [...GMA.equipos.keys()].some((i) => i > 0 && i < 1000)) ? b('equipo', T('gm.equipo'), 'persona') : ''}${b('modo:ShowHelp', 'F1 · ' + T('gmb.ayuda'), 'info')}${b('modo:ShowTeam', 'F2', 'persona')}${b('modo:ShowSpare1', 'F3', 'mas')}${b('modo:ShowSpare2', 'F4', 'mas')}</div>`);
  const A = [...GMOD.addons.values()].find((x) => x.id === (GMM.lista.get(M.n) || {}).id);
  if (A) { const Aj = gmbAjustes(A); if (Aj.length) s += gmbSeccion(T('gmb.ajustes'), `<div class="gbAjs">${Aj.map(gmbCvarHTML).join('')}</div>`, Aj.length); }
  return s;
}

// ---- acciones ----
function gmbAccion(a, b, e) {
  if (a === 'cerrar') return gmbCerrar();
  if (a === 'tienda') { gmbCerrar(); if (typeof abrirTiendaGmod === 'function') return abrirTiendaGmod(); if (typeof inicioPanel === 'function' && typeof RB !== 'undefined') { RB.t.tab = 'gmod'; aviso(T('gmb.tiendaPausa'), 3); } return; }
  if (a.startsWith('sel:')) { GMB.sel = a.slice(4); GMB.q = ''; return gmbDibujar(); }
  if (a.startsWith('it:')) { const it = a.slice(3); if (typeof spawnElegir === 'function') { const n0 = UI.puestos || 0; spawnElegir('GMod', it); if (/^gmswep:/.test(it)) { gmbCerrar(); return; } aviso(`${T('sp.puesto')}: ${propNom(it)}`, 1.2); } return; }
  if (a.startsWith('her:')) { const [, id, nom] = a.split(':'); const A = GMOD.addons.get(id), h = A && (A.herramientas || []).find((x) => x.nombre === nom); if (h) { gmbCerrar(); gmbHerEquipar(A, h); } return; }
  if (a.startsWith('pin:')) { gmbFijar(a.slice(4)); return gmbCuerpo(); }
  if (a.startsWith('cmd:')) { const n = a.slice(4), arg = GMB.arg[n] || ''; if (typeof gmaConsola2 === 'function') gmaConsola2(n + (arg ? ' ' + arg : '')); aviso('> ' + n + (arg ? ' ' + arg : ''), 1.5); return; }
  if (a === 'equipo') { gmbCerrar(); if (typeof gmmEquiposAbrir === 'function') gmmEquiposAbrir(); return; }
  if (a.startsWith('modo:')) { if (typeof gmmLlamarGM === 'function') { gmmLlamarGM(a.slice(5), 'S', GMA.jug); gmmLlamarGM(a.slice(5), 'C'); } return; }
}
// habilidades: un bind se manda al apretar; una tecla o un IN_ quedan apretados mientras el dedo esté
function gmbHab(k, on, el) {
  GMB.apretadas = GMB.apretadas || new Set();
  if (on) GMB.apretadas.add(k); else { if (!GMB.apretadas.has(k)) return; GMB.apretadas.delete(k); }
  if (el) el.classList.toggle('ap', on);
  const [tipo, ...r] = k.split(':'), d = r.join(':');
  if (tipo === 'bind') { if (on) gmbBind(d); return; }
  if (tipo === 'key') { if (on) CTL.teclasMod.add(d); else CTL.teclasMod.delete(d); return; }
  if (tipo === 'in') { const bit = GMB_IN[d] || 0; CTL.inMod = on ? CTL.inMod | bit : CTL.inMod & ~bit; }
}
// un bind: primero el addon (PlayerBindPress); si nadie lo toma, lo que hace el juego con esa tecla
function gmbBind(b) {
  if (typeof gmaBind === 'function' && gmaBind(b)) return;
  const m = /^slot([1-9])$/.exec(b); if (m && typeof pulso === 'function') return pulso('arma' + m[1]);
  const P = { '+reload': 'recargar', '+use': 'usar', '+menu': 'menu', noclip: 'noclip', 'impulse 100': 'linterna' }[b];
  if (P && typeof pulso === 'function') pulso(P);
}

// ---- ajustes (ConVars): se aplican al momento y quedan guardados en el aparato ----
function gmbCvarGuardada(n) { try { const o = JSON.parse(localStorage.getItem(GMB_CV) || '{}'); return Object.prototype.hasOwnProperty.call(o, n) ? String(o[n]) : undefined; } catch (e) { return undefined; } }
function gmbCvarPoner(n, v, deslizando) {
  if (typeof gmaCvarPoner !== 'function') return;
  gmaCvarPoner(n, v);
  try { const o = JSON.parse(localStorage.getItem(GMB_CV) || '{}'); o[n] = String(v); localStorage.setItem(GMB_CV, JSON.stringify(o)); } catch (e) {}
  // (el número y la barra del mismo ajuste van juntos)
  if (GMB.el) for (const x of GMB.el.querySelectorAll(`[data-cv="${CSS.escape(n)}"]`)) if (x.type !== 'checkbox' && x.value !== String(v)) x.value = v;
}

// ---- herramientas de los addons en la Tool Gun ----
function gmbHerEquipar(A, h) {
  if (typeof DATA === 'undefined' || !DATA.herr) return;
  let i = DATA.herr.findIndex((x) => x.gmTool === h);
  if (i < 0) { DATA.herr.push({ n: 'gm:' + h.nombre, nom: gmbHerNom(h), gmTool: h, gmA: A.id, p: [] }); i = DATA.herr.length - 1; }
  if (typeof equiparHerramienta === 'function') equiparHerramienta(i);
}
// (desde herramientaUsar) clic izquierdo / derecho / recargar con una herramienta de addon: su LeftClick/RightClick/Reload
function gmbHerUsar(h, met) {
  const R = typeof GMA !== 'undefined' && GMA.R, H = h.gmTool; if (!R || !H || !H.t) return false;
  if (!H.obj || H.objR !== R) { const f = R.G.get('__RB_ToolNuevo'); H.obj = typeof f === 'function' || f ? gmLlamar(f, 'S', H.t, H.nombre)[0] : null; H.objR = R; }
  const o = H.obj; if (!(o instanceof LuaTable)) return false;
  const f = R.ix(o, met); if (typeof f !== 'function') return false;
  const tr = GMA.metas.Player.get('GetEyeTrace')(GMA.jug);
  const r = gmLlamar(f, 'S', o, tr);
  return R_T(r[0]);
}

// ---- habilidades fijadas en la pantalla (para el celu): hasta 6, se mueven con el editor de botones ----
function gmbFijosCargar() { try { GMB.fijos = JSON.parse(localStorage.getItem(GMB_LS) || '[]').filter((f) => f && typeof f.k === 'string').slice(0, 6); } catch (e) { GMB.fijos = []; } }
function gmbFijar(k) {
  const i = GMB.fijos.findIndex((f) => f.k === k);
  if (i >= 0) GMB.fijos.splice(i, 1);
  else {
    if (GMB.fijos.length >= 6) GMB.fijos.shift();
    let t = k; for (const A of GMOD.addons.values()) { const h = gmbHabilidades(A).find((x) => x.k === k); if (h) { t = h.t; break; } }
    GMB.fijos.push({ k, t });
  }
  try { localStorage.setItem(GMB_LS, JSON.stringify(GMB.fijos)); } catch (e) {}
  gmbFijosDibujar();
}
function gmbFijosDibujar() {
  const t = $('tactil'); if (!t) return;
  const hay = JUEGO.estado === 'juego';
  for (let i = 0; i < 6; i++) {
    let d = $('bgmb' + i);
    if (!d) {
      d = document.createElement('div'); d.className = 'bt-t gbFijo oc'; d.id = 'bgmb' + i; t.appendChild(d);
      const ap = (on) => (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === 'touchstart') ENT.tactil = true; const f = d._f; if (f) gmbHab(f.k, on, d); };
      d.addEventListener('touchstart', ap(true), { passive: false }); for (const ev of ['touchend', 'touchcancel']) d.addEventListener(ev, ap(false), { passive: false });
      d.addEventListener('mousedown', ap(true)); d.addEventListener('mouseup', ap(false)); d.addEventListener('mouseleave', ap(false));
      // (arriba a la izquierda, siguiendo las filas de chat y del menú de props: el lado derecho es del disparo)
      if (typeof HUD_TACTIL !== 'undefined') { const P = [[363.6, -140], [469.5, -140], [575.4, -140], [151.8, -234], [257.7, -234], [363.6, -234]][i]; HUD_TACTIL.push(['#bgmb' + i, 0, 1, P[0], P[1], 80, 32]); }
    }
    const f = hay ? GMB.fijos[i] : null; d._f = f || null; d.classList.toggle('oc', !f);
    if (f) { const s = String(f.t).slice(0, 6); d.innerHTML = `<b class="ctlLetra${s.length > 2 ? ' larga' : ''}">${esc(s)}</b>`; }
  }
}
gmbFijosCargar();

// ---- la tienda de GMod desde una partida: en un server, la de GMod del server; jugando solo, la del menú (con Volver al juego) ----
function abrirTiendaGmod() {
  if (typeof SALA !== 'undefined' && SALA && typeof smAbrir === 'function') { smAbrir(); if (typeof SMOD !== 'undefined') { SMOD.filtro = 'gmod'; if (typeof smDibujar === 'function') smDibujar(); } return; }
  if (typeof RB === 'undefined' || typeof inicioMostrar !== 'function') return;
  RB.desdeJuego = true; RB.t.tab = 'gmod'; RB.t.ficha = null; inicioMostrar(true); inicioPanel('tienda');
}
function gmbVolverAlJuego() {
  RB.desdeJuego = false; inicioMostrar(false); if (typeof menuMostrar === 'function') menuMostrar(false);
  const h = $('hud'); if (h) h.classList.remove('oc'); gmbBoton();
}
// (al montar el Lua de un addon) sus herramientas van a la lista de la Tool Gun, con su nombre
function gmbHerRegistrar(A) {
  if (typeof DATA === 'undefined' || !DATA.herr) return;
  for (const h of A.herramientas || []) if (h.t && !DATA.herr.some((x) => x.gmTool === h)) DATA.herr.push({ n: 'gm:' + h.nombre, nom: gmbHerNom(h), gmTool: h, gmA: A.id, p: [] });
}
function gmbHerQuitarTodas() {
  if (typeof DATA === 'undefined' || !DATA.herr) return;
  const sel = DATA.herr[typeof HER !== 'undefined' ? HER.sel : -1];
  for (let i = DATA.herr.length - 1; i >= 0; i--) if (DATA.herr[i].gmTool) DATA.herr.splice(i, 1);
  if (typeof HER !== 'undefined' && sel && sel.gmTool) HER.sel = 0;
}
