// Personajes → Gorros con personalización (tamaño, X/Y/Z en cm, color) que se ve al momento en el personaje del menú y
// llega a los demás por la red (validada); confirmación antes de instalar un modelo de mod; botón de importar personaje.
// uso: node personajes_gorro.mjs URL_HTML [celu]
import { abrir } from './base.mjs';
const [, , HTML, CELU] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, !!CELU);
await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el'), null, { timeout: 60000 });
await ev(`PREFS.bienvenida = true; PREFS.gorroAj = null; RBM.pjTab = 'hat'; inicioPanel('personajes'); 1`); await p.waitForTimeout(800);
const g = await ev(`(() => { const h = DATA.hats.find((x) => x !== 'HatEmpty'); pjElegir(h); return h; })()`); await p.waitForTimeout(1500);
const med = `(() => { const P = MENU.lobby, G = P && P.gorroMd; if (!G) return null; const r = G.raiz, hi = P.D.h.Head, W = P.md.W[hi];
  return { esc: +Math.hypot(r[0], r[1], r[2]).toFixed(3), pos: [r[12] - W[12], r[13] - W[13], r[14] - W[14]].map((v) => +v.toFixed(3)), color: G.color ? G.color.map((v) => +v.toFixed(2)) : null }; })()`;
const a0 = await ev(med); await p.screenshot({ path: 'gorro_antes.png' });
const panel = await ev(`!!RB.el.querySelector('.gorroAj input[data-ga=s]')`);
ok('en Gorros está la personalización (tamaño, X/Y/Z, color)', panel && !!a0, { gorro: g, a0 });
await ev(`(() => { const c = RB.el.querySelector('.gorroAj'), set = (k, v) => { const i = c.querySelector('[data-ga=' + k + ']'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
  set('s', 150); set('y', 10); c.querySelector('[data-gac="#e0524f"]').click(); return 1; })()`); await p.waitForTimeout(800);
const a1 = await ev(med); await p.screenshot({ path: 'gorro_despues.png' });
const dy = a1.pos[1] - a0.pos[1];
ok('se ve al momento: 1,5× más grande, 10 cm más arriba y rojo', Math.abs(a1.esc / a0.esc - 1.5) < 0.03 && Math.abs(dy - 0.10) < 0.03 && a1.color && a1.color[0] > 0.8 && a1.color[1] < 0.4, { a0, a1, dy: +dy.toFixed(3) });
const guard = await ev(`JSON.stringify(PREFS.gorroAj)`);
ok('queda guardado', /"s":1.5/.test(guard) && /"y":10/.test(guard) && /e0524f/.test(guard), guard);
// (la red: valores fuera de rango o raros se recortan)
const red = await ev(`JSON.stringify(gorroAjLimpio({ s: 99, x: -500, y: 'x', z: 3, c: 'javascript:alert(1)' }))`);
ok('lo que llega de la red se valida (tamaño, corrimiento y color)', red === '{"s":1.6,"x":-15,"y":0,"z":3,"c":""}', red);
// (confirmar antes de instalar un modelo)
const cf = await ev(`(async () => { window.__inst = 0; const o = pjmInstalar; pjmInstalar = (id) => { window.__inst++; }; PJM.ws = [{ id: '12345', t: 'Modelo de prueba', img: '', mb: 12.5 }]; RBM.pjTab = 'mod'; inicioPanel('personajes'); await new Promise((r) => setTimeout(r, 500));
  const t = RB.el.querySelector('[data-pjm="inst:12345"]'); if (!t) return { sinTile: true }; t.click(); await new Promise((r) => setTimeout(r, 200));
  const D = document.getElementById('cfDlg'), ve = D && !D.classList.contains('oc'), txt = D ? D.textContent : '', antes = window.__inst;
  D.querySelector('[data-cf=no]').click(); const tras = window.__inst; t.click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('#cfDlg [data-cf=si]').click(); const si = window.__inst; pjmInstalar = o;
  return { ve, txt: txt.slice(0, 80), antes, tras, si, imp: (() => { const b = RB.el.querySelector('.pjmImp'); if (!b) return false; b.click(); const v = document.querySelector('#pjiVen:not(.oc) input[type=file]'); if (typeof pjiCerrar === 'function') pjiCerrar(); return !!v; })() }; })()`);
ok('antes de instalar un modelo pregunta «¿Seguro…?» y sólo instala si se acepta', cf.ve && /Modelo de prueba/.test(cf.txt) && cf.antes === 0 && cf.tras === 0 && cf.si === 1, cf);
ok('en Personajes → Mods está «Importar personaje» (abre la ventana para elegir el archivo)', cf.imp);
await p.screenshot({ path: 'gorro_mods.png' });
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
