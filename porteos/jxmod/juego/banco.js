// ---------------- comparación de FPS entre los motores (Ajustes → Gráficos) ----------------
// La misma escena con cada motor: gm_construct (RB_Construct) en la calidad elegida (Alto si está en automático), con la resolución fija
// (sin la dinámica: se mide el motor, no cuánto baja la resolución), 6 props, 6 personajes caminando, la misma hora del día
// y la cámara dando una vuelta entera. Motores: WebGL 1 y WebGL 2. Cambiar de motor
// reabre el juego, así que lo que falta queda anotado (localStorage) y sigue solo al volver a abrir; al final vuelve al
// motor y a los ajustes de antes y muestra la tabla (y cuál anduvo más rápido, para usarlo con un toque).
const BANCO_PREFS = ['motor', 'gfx', 'resDin', 'res', 'lejos', 'sombras', 'post', 'texQ'];
const BANCO = { clave: 'jx_banco', ult: 'jx_banco_ult', seg: 15, previo: 4, on: false };
function bancoMotores() { return ['webgl1', 'webgl2']; }
function bancoMotorAct() { return R.gl1 ? 'webgl1' : 'webgl2'; }
const bancoNom = (m) => m === 'webgl2' ? 'WebGL 2' : 'WebGL 1';
function bancoLeer(k) { try { return JSON.parse(localStorage.getItem(k || BANCO.clave) || 'null'); } catch (e) { return null; } }
function bancoGuardar(b, k) { try { if (b) localStorage.setItem(k || BANCO.clave, JSON.stringify(b)); else localStorage.removeItem(k || BANCO.clave); } catch (e) { } }
function bancoEmpezar(gfx, seg, previo) {
  const a = { motor: bancoMotorAct() }; for (const k of BANCO_PREFS) if (PREFS[k] !== undefined) a['p_' + k] = PREFS[k];
  const b = { motores: bancoMotores(), i: 0, gfx: PERFILES[gfx] ? gfx : 'alto', seg: seg || BANCO.seg, previo: previo || BANCO.previo, res: {}, antes: a, intentos: {}, t: Date.now() };
  cerrarPaneles(); bancoIr(b);
}
// al abrir el juego: si hay una comparación a medias, sigue (si quedó colgada más de 15 minutos, se descarta)
function bancoSeguir() {
  const b = bancoLeer(); if (!b) return;
  if (!(Date.now() - b.t < 15 * 60e3) || !b.motores) { bancoGuardar(null); if (b.antes) bancoRestaurar(b); return; }
  bancoIr(b);
}
// ir al motor que toca (si ya es éste, medir); al terminar la lista, volver al de antes. Si un motor no abre (el aparato no
// tiene WebGL 2), después de dos intentos se anota y se sigue con el próximo
function bancoIr(b) {
  for (;;) {
    const fin = b.i >= b.motores.length, m = fin ? b.antes.motor : b.motores[b.i], k = fin ? 'fin' : m;
    if (m === bancoMotorAct()) { bancoGuardar(b); if (fin) bancoFin(b); else bancoMedir(b); return; }
    if ((b.intentos[k] || 0) >= 2) { if (fin) { bancoFin(b); return; } b.res[m] = { falla: 1 }; b.i++; continue; }
    b.intentos[k] = (b.intentos[k] || 0) + 1; bancoGuardar(b);
    PREFS.motor = m; guardarPrefs(); motorCambiar(m); return;
  }
}
function bancoCapa(txt, arriba) {
  let c = $('banco'); if (!c) { c = document.createElement('div'); c.id = 'banco'; document.body.appendChild(c); }
  c.className = 'bancoCapa' + (arriba ? ' arriba' : ''); c.innerHTML = txt; c.classList.remove('oc'); return c;
}
async function bancoMedir(b) {
  const m = b.motores[b.i], espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  BANCO.on = true; cerrarPaneles();
  const c = bancoCapa(`<div class="bancoTj"><b>${esc(T('bn.midiendo'))}: ${esc(bancoNom(m))}</b> <small>(${b.i + 1}/${b.motores.length})</small><div class="bancoBarra"><i id="bancoP"></i></div><button class="ajBtn gris" id="bancoNo">${esc(T('bn.cancelar'))}</button></div>`, true);
  let cancelado = false; $('bancoNo').onclick = () => { cancelado = true; };
  const p = PERFILES[b.gfx]; Object.assign(PREFS, { gfx: b.gfx, resDin: false, res: p.res, lejos: p.lejos, sombras: 'auto', post: 'auto', texQ: 'auto' });
  if (typeof inicioMostrar === 'function') inicioMostrar(false);
  aplicarGfx(); await empezarPartida('RB_Construct');
  for (let k = 0; k < 1800 && !(JUEGO.estado === 'juego' && JUG.suelo); k++) await espera(100);   // (la primera vez el mapa se baja)
  aplicarGfx(); await espera(1500); cerrarPaneles();
  // (la escena: props y gente delante, la misma hora y sin ciclo del día)
  JUG.yaw = 0; JUG.pitch = 0.1; await espera(200);
  try { for (let k = 0; k < 6; k++) spawnDelante(['Crate', 'Barrel', 'Crate'][k % 3], {}); } catch (e) { }
  try { const f = CAM.fwd; for (let k = 0; k < 6; k++) { const d = 4 + k * 2.5, a = (k % 2 ? 1 : -1) * (0.2 + k * 0.05); npcCrear(['Hero', 'Soldier'][k % 2], v3(JUG.pos.x + (f.x * Math.cos(a) - f.z * Math.sin(a)) * d, JUG.pos.y - 0.9, JUG.pos.z + (f.x * Math.sin(a) + f.z * Math.cos(a)) * d), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); } } catch (e) { }
  if (typeof DIA !== 'undefined') { DIA.hora = 13; DIA.ciclo = false; if (typeof diaAplicar === 'function') diaAplicar(); }
  // la vuelta de cámara: primero sin medir (que se suba todo y se estabilice), después midiendo cada cuadro
  const tot = b.previo + b.seg, L = [], ms = [], y0 = JUG.yaw; let t0 = 0, tm = 0, ult = 0, gl0 = null;
  const jx = () => null;   // (el tiempo de la GPU sólo lo daba el motor propio, que ya no está)
  await new Promise((ok) => {
    const f = (ahora) => {
      if (!t0) t0 = ahora; const s = (ahora - t0) / 1000;
      JUG.yaw = y0 + Math.PI * 2 * Math.min(1, s / tot); JUG.pitch = 0.1;
      if (s >= b.previo) { if (!tm) { tm = ahora; gl0 = jx(); } else L.push(ahora - ult); if (TIEMPO.msProm && (!ms.length || ms[ms.length - 1] !== TIEMPO.msProm)) ms.push(TIEMPO.msProm); }
      ult = ahora; const e = $('bancoP'); if (e) e.style.width = Math.min(100, s / tot * 100).toFixed(1) + '%';
      if (s >= tot || cancelado) ok(); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  BANCO.on = false;
  if (cancelado) { c.classList.add('oc'); bancoGuardar(null); bancoRestaurar(b); aplicarGfx(); return; }
  const o = L.slice().sort((x, y) => x - y), suma = L.reduce((x, y) => x + y, 0), n = Math.max(1, L.length);
  const p99 = o[Math.min(o.length - 1, Math.floor(o.length * 0.99))] || 0, gl1 = jx();
  const r = { fps: +(1000 * n / Math.max(1, suma)).toFixed(1), bajo1: +(p99 ? 1000 / p99 : 0).toFixed(1), ms: +(ms.reduce((x, y) => x + y, 0) / Math.max(1, ms.length)).toFixed(2), w: R.cv.width, h: R.cv.height };
  if (gl0 && gl1) { const dc = gl1.cuadros - gl0.cuadros; r.fpsGl = +(dc * 1000 / Math.max(1, suma)).toFixed(1); r.msGl = +((gl1.msGl - gl0.msGl) / Math.max(1, dc)).toFixed(2); }
  try { if (performance.memory) r.heap = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) { }
  try { if (window.JXNativo && JXNativo.memoriaMB) r.mem = JXNativo.memoriaMB(); } catch (e) { }
  b.res[m] = r; b.i++; b.t = Date.now();
  bancoIr(b);
}
// (lo que no estaba puesto antes —p. ej. la resolución dinámica nunca tocada— se saca, así vuelve a su valor de siempre)
function bancoRestaurar(b) { const a = b.antes || {}; for (const k of BANCO_PREFS) { if (('p_' + k) in a) PREFS[k] = a['p_' + k]; else delete PREFS[k]; } guardarPrefs(); }
function bancoFin(b) {
  bancoGuardar(null); bancoRestaurar(b); aplicarGfx();
  try { const d = CELU && CELU.det; b.aparato = d ? (d.nom || d.modelo || '') + (d.soc ? ' · ' + d.soc : '') : ''; } catch (e) { }
  bancoGuardar(b, BANCO.ult); bancoMostrar(b);
}
// la tabla: el más rápido (por el promedio y el 1 % más lento) resaltado y con el botón para quedárselo
function bancoMostrar(b) {
  b = b || bancoLeer(BANCO.ult); if (!b) return;
  const ok = b.motores.filter((m) => b.res[m] && !b.res[m].falla), pun = (r) => r.fps + r.bajo1 * 0.5;
  const mejor = ok.slice().sort((x, y) => pun(b.res[y]) - pun(b.res[x]))[0];
  const fila = (m) => { const r = b.res[m] || { falla: 1 }; return `<tr class="${m === mejor ? 'mejor' : ''}"><td>${esc(bancoNom(m))}</td>` + (r.falla ? `<td colspan="4">${esc(T('bn.falla'))}</td>` : `<td><b>${r.fps}</b>${r.fpsGl !== undefined ? ` <small>(${r.fpsGl})</small>` : ''}</td><td>${r.bajo1}</td><td>${r.ms}${r.msGl !== undefined ? ` <small>+ ${r.msGl}</small>` : ''}</td><td>${r.mem ? r.mem + ' MB' : '—'}${r.heap ? ` <small>JS ${r.heap}</small>` : ''}</td>`) + '</tr>'; };
  const txt = `${bancoNom(mejor || '')}: ` + b.motores.map((m) => { const r = b.res[m] || {}; return bancoNom(m) + ' ' + (r.falla ? '×' : r.fps + '/' + r.bajo1 + ' fps ' + r.ms + ' ms' + (r.mem ? ' ' + r.mem + 'MB' : '')); }).join(' · ') + ` · ${b.gfx} ${(b.res[mejor] || {}).w}×${(b.res[mejor] || {}).h}` + (b.aparato ? ' · ' + b.aparato : '');
  const c = bancoCapa(`<div class="bancoTj"><b>${esc(T('bn.titulo'))}</b> <small>(${esc(b.gfx)}${b.aparato ? ' · ' + esc(b.aparato) : ''})</small>
    <table class="bancoT"><tr><th>${esc(T('bn.motor'))}</th><th>${esc(T('bn.prom'))}</th><th>${esc(T('bn.bajo'))}</th><th>${esc(T('bn.js'))}</th><th>${esc(T('bn.mem'))}</th></tr>${b.motores.map(fila).join('')}</table>
    <div class="bancoBtns">${mejor && mejor !== bancoMotorAct() ? `<button class="ajBtn" id="bancoUsar">${esc(T('bn.usar'))} ${esc(bancoNom(mejor))}</button>` : ''}<button class="ajBtn gris" id="bancoCopiar">${esc(T('bn.copiar'))}</button><button class="ajBtn gris" id="bancoCerrar">${esc(T('bn.cerrar'))}</button></div></div>`);
  c.dataset.texto = txt;
  $('bancoCerrar').onclick = () => c.classList.add('oc');
  $('bancoCopiar').onclick = () => { try { navigator.clipboard.writeText(txt); aviso(T('bn.copiado'), 2); } catch (e) { } };
  if ($('bancoUsar')) $('bancoUsar').onclick = () => { c.classList.add('oc'); PREFS.motor = mejor; guardarPrefs(); motorCambiar(mejor); };
}
(() => {
  const s = document.createElement('style');
  s.textContent = `.bancoCapa{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);pointer-events:auto}
.bancoCapa.oc{display:none}.bancoCapa.arriba{inset:auto;top:10px;left:50%;transform:translateX(-50%);background:none;pointer-events:none}.bancoCapa.arriba .bancoTj{pointer-events:auto;padding:10px 14px;min-width:240px}.bancoTj{background:#1c1f24;color:#eef1f4;border-radius:12px;padding:16px 18px;max-width:min(560px,94vw);font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)}
.bancoBarra{height:6px;background:#333a42;border-radius:3px;margin:12px 0;overflow:hidden}.bancoBarra i{display:block;height:100%;width:0;background:#3d8bfd}
.bancoT{border-collapse:collapse;margin:10px 0;width:100%}.bancoT th,.bancoT td{padding:5px 8px;text-align:left;border-bottom:1px solid #333a42;white-space:nowrap}
.bancoT th{font-weight:600;color:#9aa4ae;font-size:12px}.bancoT tr.mejor td{color:#7fd48a}.bancoT small{color:#9aa4ae}.bancoBtns{display:flex;gap:8px;flex-wrap:wrap}`;
  document.head.appendChild(s);
})();
