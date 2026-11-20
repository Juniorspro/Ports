// ---------------------------------------------------------------------------------------------------------
// Eventos en vivo: sin actualizar la app ni recargar. El juego baja web/vivo/vivo.json del repo al arrancar, al entrar a
// un mapa y cada 4 minutos (GitHub lo guarda en caché 5 min: un cambio llega en ≤ 10). Si cambió, baja el guion del evento
// (JavaScript), comprueba la firma (ECDSA P-256 con WebCrypto; la llave pública es VIVO_PUB y la privada sale del
// secreto de la firma del APK, fuera del repo: herramientas/vivo.py) y lo corre adentro del juego, con acceso a todo
// (Pepe, las voces, los mapas...). Sin firma buena no corre nada; sin WebCrypto, no hay eventos en vivo.
//
// Un guion es el cuerpo de una función que devuelve sus ganchos (todos opcionales):
//   return { nombre: 'navidad', empezar() {}, alEntrar(mapa) {}, paso(dt) {}, fin() {} };
// empezar al llegar (o al abrir el juego, si ya estaba), alEntrar en cada mapa (y al llegar, si ya hay uno), paso en cada
// cuadro jugando, fin cuando lo reemplaza otro, se apaga o vence (`hasta`). Si un gancho falla, el evento se apaga solo
// (no rompe el juego) y se anota en la caja negra. El último que llegó queda guardado (re-comprobado al abrir): anda sin
// internet. En las pruebas automáticas no se busca nada, salvo con ?vivo=URL_DE_LA_CARPETA (y la firma igual se pide).
// ---------------------------------------------------------------------------------------------------------
const VIVO_PUB = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiUteKCCZn1+v7no/VloHzEYu1X0Cwqglqy7JmwI9NiiX6O1GGtOVfXqPST8OxETNBf7PUMqUBzTgEvh2uZkvAg==';
const VIVO = { url: 'https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/vivo/', man: null, ev: null, clave: null, buscando: false, ultima: 0, cada: 240, reloj: 0, fallas: 0 };
const vivoPuede = () => !!(window.crypto && crypto.subtle) && (!(TEST || navigator.webdriver) || Q.has('vivo'));
const vivoBase = () => ((TEST || navigator.webdriver) && Q.get('vivo')) || VIVO.url;
function vivoB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
// la firma: sobre «JXVIVO1\n<v>\n<hasta>\n<sha256 del guion>», y el guion tiene que dar ese sha256
async function vivoFirmaBien(m, txt) {
  try {
    if (!m || typeof m.firma !== 'string' || !(m.v > 0)) return false;
    if (!VIVO.clave) VIVO.clave = await crypto.subtle.importKey('spki', vivoB64(VIVO_PUB), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)))].map((x) => x.toString(16).padStart(2, '0')).join('');
    if (h !== m.h) return false;
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, VIVO.clave, vivoB64(m.firma), new TextEncoder().encode('JXVIVO1\n' + m.v + '\n' + (m.hasta || 0) + '\n' + m.h));
  } catch (e) { return false; }
}
const vivoVencido = (m) => !!(m && m.hasta && Date.now() > m.hasta);
// ---------------- correr y parar ----------------
function vivoGancho(n, ...a) {
  const ev = VIVO.ev; if (!ev || typeof ev[n] !== 'function') return;
  try { ev[n](...a); } catch (e) { vivoFalla(n, e); }
}
function vivoFalla(n, e) {
  const msg = (VIVO.ev && VIVO.ev.nombre || '?') + ' · ' + n + ': ' + String(e && e.message || e).slice(0, 200);
  console.warn('vivo', msg); if (typeof cnAnotar === 'function') cnAnotar('vivo', msg);
  VIVO.fallas++; const ev = VIVO.ev; VIVO.ev = null;
  if (ev && n !== 'fin' && typeof ev.fin === 'function') try { ev.fin(); } catch (x) {}
}
function vivoParar() { if (VIVO.ev) vivoGancho('fin'); VIVO.ev = null; }
function vivoCorrer(m, txt) {
  vivoParar(); VIVO.man = m;
  if (!txt.trim() || vivoVencido(m)) return;
  let ev = null;
  // (eval directo: el guion ve todo lo del juego, que está adentro de una función —armar.py—)
  try { const f = eval('(function () {\n"use strict";\n' + txt + '\n})'); ev = f() || {}; } catch (e) { VIVO.ev = { nombre: 'guion v' + m.v }; vivoFalla('cargar', e); return; }
  VIVO.ev = ev; vivoGancho('empezar');
  if (VIVO.ev === ev && JUEGO.estado === 'juego' && typeof MUNDO !== 'undefined' && MUNDO.nombre) vivoGancho('alEntrar', MUNDO.nombre);
}
// ---------------- buscar ----------------
async function vivoBuscar() {
  if (VIVO.buscando || !vivoPuede() || document.hidden) return; VIVO.buscando = true; VIVO.ultima = performance.now();
  try {
    const base = vivoBase(), r = await fetch(base + 'vivo.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const m = await r.json();
    if (!m || !(m.v > 0) || (VIVO.man && m.v <= VIVO.man.v)) return;   // (igual o más viejo —el caché de GitHub—: nada)
    let txt = '';
    if (m.js) { const r2 = await fetch(base + m.js + '?h=' + String(m.h).slice(0, 12), { cache: 'no-store' }); if (!r2.ok) return; txt = await r2.text(); }
    if (!(await vivoFirmaBien(m, txt))) { console.warn('vivo: firma mala, no se corre'); if (typeof cnAnotar === 'function') cnAnotar('vivo', 'firma mala v' + m.v); return; }
    vivoCorrer(m, txt);
    try { localStorage.setItem('jx_vivo', JSON.stringify({ m, txt })); } catch (e) {}
  } catch (e) { /* sin internet: queda el que estaba */ } finally { VIVO.buscando = false; }
}
// al abrir el juego (principal.js, iniciar): el último guardado (con la firma comprobada de nuevo) y a buscar
async function vivoArranque() {
  if (!vivoPuede() || VIVO.arrancado) return; VIVO.arrancado = true;
  try { const g = JSON.parse(localStorage.getItem('jx_vivo') || 'null'); if (g && g.m && !vivoVencido(g.m) && (await vivoFirmaBien(g.m, g.txt || ''))) vivoCorrer(g.m, g.txt || ''); } catch (e) {}
  vivoBuscar();
  setInterval(() => { if (performance.now() - VIVO.ultima > VIVO.cada * 1000 - 500) vivoBuscar(); }, 20000);
}
// al entrar a un mapa (principal.js, empezarPartida)
function vivoEnPartida(mapa) {
  vivoGancho('alEntrar', mapa);
  if (performance.now() - VIVO.ultima > 60000) vivoBuscar();
}
// cada cuadro jugando (principal.js)
function vivoPaso(dt) {
  if (!VIVO.ev) return;
  VIVO.reloj += dt; if (VIVO.reloj > 5) { VIVO.reloj = 0; if (vivoVencido(VIVO.man)) { vivoParar(); return; } }
  vivoGancho('paso', dt);
}
