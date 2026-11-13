// ---------------- caja negra: qué estaba haciendo el juego antes de trabarse o cerrarse ----------------
// Un registro chico que se guarda solo (cada segundo, y en el acto antes de cada paso riesgoso: montar un mod, compilar el
// shader de un mod, las primeras veces que corre cada hook de un mod). Si el juego se congela, lo último que quedó escrito
// dice dónde. La app de Android (Web.java) escucha un latido del juego: si deja de llegar, rearma el juego, guarda lo que
// vio el sistema y la consola, y al volver se muestra «El juego se trabó» con el registro para copiar. Si se trabó adentro
// de un mod, ese mod se apaga (se vuelve a prender en su página del panel GMod).
const CN = { l: [], paso: '', addon: '', tG: 0, pend: 0, tL: 0, hooks: new Map(), lentos: new Set() };
const CN_K = 'jx_caja', CN_KA = 'jx_caja_ant';
function cnHora() { const d = new Date(); return d.toTimeString().slice(0, 8); }
function cnAnotar(tipo, txt, ya) {
  CN.l.push(cnHora() + ' ' + tipo + ' ' + String(txt == null ? '' : txt).replace(/\s+/g, ' ').slice(0, 300));
  if (CN.l.length > 150) CN.l.splice(0, CN.l.length - 150);
  cnGuardar(ya);
}
// un paso riesgoso empieza (se guarda ya) o termina ('')
function cnPaso(p, addon) {
  if (p) { CN.paso = p; CN.addon = addon || ''; cnAnotar('paso', p + (addon ? ' [' + addon + ']' : ''), true); }
  else if (CN.paso) { CN.paso = ''; CN.addon = ''; cnGuardar(); }
}
function cnEstado() {
  const e = {};
  try { e.juego = typeof JUEGO !== 'undefined' ? JUEGO.estado : '-'; } catch (x) {}
  try { e.mapa = typeof MUNDO !== 'undefined' ? MUNDO.nombre : '-'; } catch (x) {}
  try { e.calidad = typeof GFX !== 'undefined' ? GFX.nombre : '-'; e.fps = typeof TIEMPO !== 'undefined' ? Math.round(TIEMPO.fps || 0) : 0; } catch (x) {}
  try { e.motor = typeof R !== 'undefined' && R.gl ? (R.gl1 ? 'webgl1' : 'webgl2') + (R.perdido ? ' (perdido)' : '') : '-'; } catch (x) {}
  try { e.dx = typeof gmrtSM3 === 'function' ? (gmrtSM3() ? 95 : 90) : '-'; } catch (x) {}
  try { const m = performance.memory; if (m) e.memJS = Math.round(m.usedJSHeapSize / 1048576) + '/' + Math.round(m.jsHeapSizeLimit / 1048576) + ' MB'; } catch (x) {}
  try { e.ram = navigator.deviceMemory || '-'; } catch (x) {}
  try { if (typeof GMOD !== 'undefined') e.mods = [...GMOD.addons.values()].map((A) => A.nombre + ' (' + A.id + ')').slice(0, 60); } catch (x) {}
  try { if (typeof PREFS !== 'undefined' && PREFS.gmod) e.instalados = Object.keys(PREFS.gmod).length; } catch (x) {}
  try { if (typeof GMC !== 'undefined') e.cola = GMC.l.map((x) => x.n + ' ' + x.estado + ' ' + Math.round((x.p || 0) * 100) + '%').slice(0, 20); } catch (x) {}
  try { if (typeof GMOD !== 'undefined' && GMOD.errores.length) e.errMods = GMOD.errores.slice(-8); } catch (x) {}
  try { if (typeof GMA !== 'undefined' && GMA.errores && GMA.errores.length) e.errLua = GMA.errores.slice(-8).map((x) => String(x.msg || x).slice(0, 200)); } catch (x) {}
  return e;
}
function cnGuardar(ya) {
  const t = Date.now();
  if (!ya && t - CN.tG < 1000) { if (!CN.pend) CN.pend = setTimeout(() => { CN.pend = 0; cnGuardar(true); }, 1000); return; }
  CN.tG = t;
  try { localStorage.setItem(CN_K, JSON.stringify({ v: JX_VERSION + ' · __ARMADO__', t, paso: CN.paso, addon: CN.addon, l: CN.l.slice(-100), e: cnEstado() })); } catch (e) {}
}
// (cada cuadro: el latido para la app y, cada 2 s, el estado)
function cnCuadro() {
  const t = Date.now(); if (t - CN.tL < 1000) return; CN.tL = t;
  try { if (window.JXNativo && JXNativo.latido) JXNativo.latido(); } catch (e) {}
  if (t - CN.tG > 2000) cnGuardar(true);
}
// (un hook de un mod: las 3 primeras veces —y siempre, si alguna vez tardó más de 150 ms— queda anotado antes de correr)
// (uno que ya se anotó y sigue siendo lento —como el VHS del Viewfinder, cada cuadro— no se escribe en el registro ni
// se guarda en el acto cada vez: escribir el almacenamiento en cada cuadro le costaba al juego más que el hook mismo.
// Queda el paso en memoria y se guarda a lo sumo una vez por segundo)
function cnHookAntes(ev, h) {
  if (!h || !h.a) return false;
  const k = h.a + '|' + ev, n = CN.hooks.get(k) || 0; if (n >= 3 && !CN.lentos.has(k)) return false;
  if (n >= 3) { const A = typeof GMOD !== 'undefined' && GMOD.addons.get(h.a); CN.paso = 'hook ' + ev + ' del mod ' + (A ? A.nombre : h.a); CN.addon = h.a; if (Date.now() - CN.tG > 1000) cnGuardar(true); return performance.now(); }
  CN.hooks.set(k, n + 1);
  const A = typeof GMOD !== 'undefined' && GMOD.addons.get(h.a); cnPaso('hook ' + ev + ' del mod ' + (A ? A.nombre : h.a), h.a); return performance.now();
}
function cnHookDespues(ev, h, t0) { if (!t0) return; const ms = performance.now() - t0, k = h.a + '|' + ev; if (ms > 150) { const ya = CN.lentos.has(k); CN.lentos.add(k); if (!ya || ms > 1000) cnAnotar('lento', ev + ' ' + Math.round(ms) + ' ms [' + h.a + ']'); } if (CN.hooks.get(k) >= 3) { CN.paso = ''; CN.addon = ''; } else cnPaso(''); }
addEventListener('error', (e) => cnAnotar('ERROR', (e.message || '') + ' @ ' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
addEventListener('unhandledrejection', (e) => { const r = e.reason; cnAnotar('PROMESA', (r && (r.message || r)) || ''); });

// ---- al arrancar: la caja de la vez anterior ----
const CN_ANT = (() => { try { const a = localStorage.getItem(CN_K); if (a) localStorage.setItem(CN_KA, a); return a ? JSON.parse(a) : null; } catch (e) { return null; } })();
// ¿la vez anterior terminó mal? (la app avisa con ?colgado= o ?caida=; el juego sabe si quedó «andando» sin salir bien)
function cnTerminoMal() { return !!(Q.get('colgado') || Q.get('caida') || (typeof CIERRE !== 'undefined' && CIERRE.nuevo)); }
function cnTexto(c, nativo) {
  const L = [];
  L.push('JXMod · registro · ' + new Date().toISOString());
  if (c) {
    L.push('versión: ' + c.v + ' · guardado: ' + new Date(c.t).toISOString());
    if (c.paso) L.push('ÚLTIMO PASO (se quedó acá): ' + c.paso + (c.addon ? ' [mod ' + c.addon + ']' : ''));
    L.push('estado: ' + JSON.stringify(c.e || {}));
    L.push('--- lo último ---'); for (const x of c.l || []) L.push(x);
  } else L.push('(sin registro anterior)');
  if (nativo) { L.push('--- la app (Android) ---'); L.push(String(nativo).slice(-30000)); }
  L.push('--- este aparato ---'); L.push(navigator.userAgent);
  return L.join('\n');
}
function cnCopiar(txt) {
  const ok = () => { if (typeof aviso === 'function') aviso(Lc('Copied', 'Copiado'), 1.5); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(ok, () => cnCopiarViejo(txt, ok)); return; } } catch (e) {}
  cnCopiarViejo(txt, ok);
}
function cnCopiarViejo(txt, ok) { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); }
// la ventana: «El juego se trabó» (después de un cuelgue) o el registro a pedido (Ajustes)
function cnMostrar(trabado, extra) {
  let nativo = ''; try { if (window.JXNativo && JXNativo.registroNativo) nativo = JXNativo.registroNativo() || ''; } catch (e) {}
  const c = trabado ? CN_ANT : (() => { cnGuardar(true); try { return JSON.parse(localStorage.getItem(CN_K)); } catch (e) { return null; } })();
  const txt = cnTexto(c, nativo) + (trabado || !CN_ANT ? '' : '\n\n=== la vez anterior ===\n' + cnTexto(CN_ANT, ''));
  let v = document.getElementById('cnVen'); if (v) v.remove();
  v = document.createElement('div'); v.id = 'cnVen';
  v.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000a;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif';
  const tit = trabado ? Lc('The game froze last time', 'El juego se trabó la última vez') : Lc('Error log', 'Registro de fallas');
  const paso = c && c.paso ? '<p style="margin:6px 0;color:#ffd27a">' + esc(Lc('It stopped while: ', 'Se quedó en: ') + c.paso) + '</p>' : '';
  v.innerHTML = '<div style="background:#1d2129;color:#eee;border-radius:12px;padding:16px;width:min(92vw,620px);max-height:86vh;display:flex;flex-direction:column;gap:8px">'
    + '<b style="font-size:17px">' + esc(tit) + '</b>' + paso + (extra ? '<p style="margin:0">' + esc(extra) + '</p>' : '')
    + '<p style="margin:0;opacity:.75">' + esc(Lc('Copy it and send it to fix it.', 'Copialo y mandalo para arreglarlo.')) + '</p>'
    + '<textarea readonly style="flex:1;min-height:30vh;background:#0e1014;color:#bfe;border:1px solid #333;border-radius:8px;font:11px monospace;padding:8px"></textarea>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end"><button data-cn="copiar" style="padding:9px 16px;border-radius:8px;border:0;background:#3a8dde;color:#fff;font-weight:600">' + esc(Lc('Copy log', 'Copiar registro')) + '</button>'
    + '<button data-cn="cerrar" style="padding:9px 16px;border-radius:8px;border:0;background:#444;color:#fff">' + esc(Lc('Close', 'Cerrar')) + '</button></div></div>';
  v.querySelector('textarea').value = txt;
  v.onclick = (e) => { const b = e.target.closest('[data-cn]'); if (!b) { if (e.target === v) v.remove(); return; } if (b.dataset.cn === 'copiar') cnCopiar(txt); else v.remove(); };
  document.body.appendChild(v);
  return txt;
}
// (con el juego listo: si la vez anterior se trabó, se avisa; si fue adentro de un mod, ese mod se apaga)
// (lo que se apaga va antes de montar los mods —gmArrancar lo llama primero—: si no, el mod volvería a trabar el juego
// antes de que se muestre el aviso)
// Cuándo se culpa a un mod: si la app vio el juego congelado 45 s (?colgado) con ese mod cargándose, ya; si el juego sólo
// se cerró mal (el sistema lo mató por memoria —?caida—, se cerró la app, se cayó la pestaña), hace falta que pase dos veces
// seguidas con el mismo mod. Antes bastaba una: cerrar el juego mientras montaba los mods al arrancar dejaba «sin cargar»
// al que tocaba en ese momento, y de una vez a la otra varios mods quedaban sin sus armas, como «Script» (Discord).
const CN_SOSP = 'rb_gm_sospechas';
function cnSospechas() { try { const o = JSON.parse(localStorage.getItem(CN_SOSP) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function cnSospechasGuardar(o) { try { localStorage.setItem(CN_SOSP, JSON.stringify(o)); } catch (e) {} }
// (su Lua corrió entero: deja de ser sospechoso; así las dos veces tienen que ser seguidas)
function cnSospechaOk(id) { const o = cnSospechas(); if (o[id]) { delete o[id]; cnSospechasGuardar(o); } }
function cnCuarentena() {
  if (cnCuarentena.hecho !== undefined) return cnCuarentena.hecho;
  cnCuarentena.hecho = '';
  if (!cnTerminoMal() || !CN_ANT) return '';
  let extra = '';
  // (el nombre: el guardado del mod; si no está, el que quedó anotado en el paso —«montando el mod Viewfinder»—; si no, el id)
  const id = CN_ANT.paso && CN_ANT.addon, dePaso = (/(?:del mod|el mod) (.+)$/.exec(CN_ANT.paso || '') || [])[1];
  const n = id && ((typeof PREFS !== 'undefined' && PREFS.gmod && PREFS.gmod[id] && PREFS.gmod[id].n) || (dePaso && dePaso !== id ? dePaso : '') || id);
  if (!id) return '';
  const S = cnSospechas(), vez = (S[id] && Date.now() - (+S[id].t || 0) < 864e5 ? +S[id].n || 0 : 0) + 1;
  S[id] = { n: vez, t: Date.now() }; cnSospechasGuardar(S);
  if (!Q.get('colgado') && vez < 2) { cnAnotar('seguro', 'se cerró mal con el mod ' + id + ' cargándose (1.ª vez: se vuelve a probar)', true); return ''; }
  // (si se trabó corriendo su Lua al cargarse, apagar sus hooks no alcanza: la próxima vez se volvería a trabar al abrir.
  // Queda montado pero sin correr su Lua, hasta que se lo vuelve a cargar desde su página)
  if (/^(corriendo el Lua|montando) /.test(CN_ANT.paso) && typeof GMA !== 'undefined' && GMA.trabados && !GMA.trabados.has(id)) {
    GMA.trabados.add(id); if (typeof gmaTrabadosGuardar === 'function') gmaTrabadosGuardar();
    extra = T('cn.sinCargar').replace('%m', n);
    cnAnotar('seguro', 'mod sin cargar por el cuelgue: ' + id, true);
  } else if (typeof GMA !== 'undefined' && GMA.apagados && !GMA.apagados.has(id)) {
    GMA.apagados.add(id); try { localStorage.setItem('rb_gmb_apagados', JSON.stringify([...GMA.apagados])); } catch (e) {}
    extra = T('cn.apagado').replace('%m', n);
    cnAnotar('seguro', 'mod apagado por el cuelgue: ' + id, true);
  }
  return (cnCuarentena.hecho = extra);
}
function cnRevisar() {
  if (!cnTerminoMal() || !CN_ANT) return;
  let extra = cnCuarentena();
  if (Q.get('seguro')) extra += (extra ? ' ' : '') + Lc('Safe mode: mods were not loaded.', 'Modo seguro: los mods no se cargaron esta vez.');
  cnMostrar(true, extra);
  try { if (window.JXNativo && JXNativo.registroVisto) JXNativo.registroVisto(); } catch (e) {}
  // (sin el aviso en la dirección: si la página se recarga sola, no se vuelve a mostrar lo mismo)
  try { const u = new URL(location.href); u.searchParams.delete('colgado'); u.searchParams.delete('caida'); history.replaceState(null, '', u.href); } catch (e) {}
}
setInterval(() => cnGuardar(true), 2000);
