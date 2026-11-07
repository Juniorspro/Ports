// Borrar varios mods a la vez (Discord: «poder borrar varios mods a la vez; los chicos hasta unos 20, los medianos 10 y
// los grandes 3 a 5»). En Mods y mapas → GMod → Instalados, con 3 addons reales instalados de verdad y 40 de prueba de
// distintos tamaños (chicos ≤ 15 MB, medianos ≤ 100 MB, grandes > 100 MB y uno sin tamaño conocido):
//  1. «Borrar varios» aparece; en ese modo cada uno muestra su tamaño y una casilla, y arriba la regla del cupo;
//  2. el cupo: entran 20 chicos y el 21 no (aviso y queda sin marcar, los que no entran se ven apagados); 10 medianos y
//     el 11 no; 4 grandes y el 5 no; mezclados hasta 20 puntos (grande 5, mediano 2, chico 1); el de tamaño desconocido
//     cuenta como mediano;
//  3. «Borrar (N)» pregunta con la lista (nombres y MB); «Volver» no borra nada;
//  4. al confirmar se borran todos: fuera de los instalados, de la caché (IndexedDB) y desmontados (sus armas y entidades
//     ya no están), la lista queda sin ellos, se sale del modo elegir y avisa cuántos y cuántos MB; los no elegidos
//     siguen instalados y montados;
//  5. al instalar se anota lo que ocupa guardado (mbG = tamaño del .gma, ±0,01 MB); los de menos de 1 MB se escriben en KB;
//  6. en el celular (873×393) el pie entra en el panel y nada se sale; sin errores de JS.
// uso: node gm_borrar_varios.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, FOTOS = '/tmp/claude-0'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const REALES = ['104479831', '104480013', '104607228'];
const errores = [];
for (const celu of [false, true]) {
  const { b, p, ev, err } = await abrir(HTML + '?test', celu);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); inicioMostrar(true); 1`);
  // los reales, instalados de verdad (bajados del servidor de prueba, como desde la tienda)
  const inst = await ev(`(async () => { const r = {}; for (const id of ${JSON.stringify(REALES)}) { const u = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma')).arrayBuffer()); const A = await gmInstalar(id, { nombre: 'Real ' + id }, u); await A.listo; r[id] = { mbG: PREFS.gmod[id].mbG, tam: +(u.length / 1048576).toFixed(3), montado: GMOD.addons.has(id), cache: !!(await gmCacheLeer(id, 5000)) }; } return JSON.stringify(r); })()`).then(JSON.parse);
  // 40 de prueba: 22 chicos (2 MB), 11 medianos (50 MB), 6 grandes (180 MB) y uno sin tamaño; en la caché, unos bytes
  await ev(`(async () => { const T = [...Array(22)].map((_, i) => ['c' + i, 2]).concat([...Array(11)].map((_, i) => ['m' + i, 50]), [...Array(6)].map((_, i) => ['g' + i, 180]), [['x0', 0]]);
    for (const [k, mb] of T) { const id = 'local:prueba_' + k; PREFS.gmod[id] = { n: 'Prueba ' + k, t: Date.now(), img: '' }; if (mb) PREFS.gmod[id].mbG = mb; await gmCacheGuardar(id, new Uint8Array(64)); }
    guardarPrefs(); return 1; })()`);
  await ev(`(() => { RB.t.tab = 'gmod'; RB.t.vista = 'instalados'; RB.t.q = ''; RB.t.etq = ''; inicioPanel('tienda'); return 1; })()`); await p.waitForTimeout(600);
  const hayBoton = await ev(`!!RB.el.querySelector('[data-rb=selGm]')`);
  const clic = async (sel) => { const c = await ev(`(() => { const e = RB.el.querySelector(${JSON.stringify(sel)}) || document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`); if (!c) return false; await p.mouse.click(c[0], c[1]); await p.waitForTimeout(120); return true; };
  await clic('[data-rb=selGm]'); await p.waitForTimeout(300);
  const modo = await ev(`({ sel: !!RB.t.sel, regla: (RB.el.querySelector('.gmSelRegla') || {}).textContent || '', tiles: RB.el.querySelectorAll('.gmSelT').length, conMB: [...RB.el.querySelectorAll('.gmSelT .gmTileD')].filter((e) => /[KM]B$/.test(e.textContent)).length, casillas: RB.el.querySelectorAll('.gmSelT .gmSelMarca').length })`);
  await p.screenshot({ path: `${FOTOS}/borrar_${celu ? 'celu' : 'compu'}_elegir.png` });
  const marcar = async (ids) => { for (const id of ids) await clic(`.gmSelT[data-rb="ver:${id}"]`); return ev(`[...RB.t.sel.ids]`); };
  const limpiar = () => ev(`(() => { RB.t.sel.ids.clear(); gmTiendaDibujar(); return 1; })()`);
  // 2. el cupo
  const C = [...Array(22)].map((_, i) => 'local:prueba_c' + i), Me = [...Array(11)].map((_, i) => 'local:prueba_m' + i), Gr = [...Array(6)].map((_, i) => 'local:prueba_g' + i);
  const chicos = (await marcar(C.slice(0, 21))).length, bloqC = await ev(`RB.el.querySelector('.gmSelT[data-rb="ver:local:prueba_c21"]').classList.contains('bloq')`); await limpiar();
  const medianos = (await marcar(Me)).length; await limpiar();
  const grandes = (await marcar(Gr.slice(0, 5))).length; await limpiar();
  const mezcla = (await marcar([Gr[0], Gr[1], Me[0], Me[1], Me[2], C[0], C[1], C[2], C[3], C[4]])).length, cupoM = await ev(`gmSelUsado().p`); await limpiar();
  const desconocido = await ev(`gmSelPts('local:prueba_x0')`);
  await p.screenshot({ path: `${FOTOS}/borrar_${celu ? 'celu' : 'compu'}_cupo.png` });
  // 3 y 4. elegir dos reales y cinco de prueba, preguntar, «Volver», y después confirmar
  const elegidos = [REALES[0], REALES[2], C[0], C[1], Me[0], Gr[0], 'local:prueba_x0'];
  await marcar(elegidos);
  const armasAntes = await ev(`JSON.stringify(${JSON.stringify(REALES)}.map((id) => { const A = GMOD.addons.get(id); return A ? (A.sweps || []).length + (A.sents || []).length + A.props.length : -1; }))`).then(JSON.parse);
  const pie = await ev(`(() => { const P = RB.el.querySelector('.rbPanPie'), r = P.getBoundingClientRect(), hijos = [...P.children].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()); return { ancho: Math.round(r.width), sw: P.scrollWidth, cw: P.clientWidth, fuera: hijos.filter((q) => q.right > r.right + 1 || q.left < r.left - 1).length, info: (RB.el.querySelector('.gmSelInfo') || {}).textContent }; })()`);
  await p.screenshot({ path: `${FOTOS}/borrar_${celu ? 'celu' : 'compu'}_elegidos.png` });
  await clic('.gmSelBorrar'); await p.waitForTimeout(300);
  const dlg = await ev(`(() => { const D = document.getElementById('cfDlg'); return D && !D.classList.contains('oc') ? { tit: (D.querySelector('h3') || {}).textContent, filas: [...D.querySelectorAll('.soIt')].map((e) => e.textContent.trim()), rojo: D.querySelector('[data-cf=si]').classList.contains('rojo') } : null; })()`);
  await p.screenshot({ path: `${FOTOS}/borrar_${celu ? 'celu' : 'compu'}_pregunta.png` });
  await clic('#cfDlg [data-cf=no]'); await p.waitForTimeout(300);
  const tras_no = await ev(`({ n: Object.keys(PREFS.gmod).length, sel: RB.t.sel && RB.t.sel.ids.size })`);
  await clic('.gmSelBorrar'); await p.waitForTimeout(300); await clic('#cfDlg [data-cf=si]');
  await p.waitForFunction(() => window.__ev('!RB.t.sel'), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(400);
  const despues = await ev(`(async () => { const ids = ${JSON.stringify(elegidos)}, r = { inst: ids.filter((id) => PREFS.gmod[id]), cache: [], montados: ids.filter((id) => GMOD.addons.has(id)), lista: [...RB.el.querySelectorAll('.rbTiendaG [data-rb^="ver:"]')].map((e) => e.dataset.rb.slice(4)).filter((id) => ids.includes(id)), sel: !!RB.t.sel, aviso: (RB.el.querySelector('.rbAviso') || {}).textContent || '' };
    for (const id of ids) if (await gmCacheLeer(id, 5000)) r.cache.push(id);
    r.quedan = { real: PREFS.gmod['${REALES[1]}'] ? GMOD.addons.has('${REALES[1]}') : 'no instalado', prueba: Object.keys(PREFS.gmod).filter((k) => k.startsWith('local:prueba_')).length };
    return JSON.stringify(r); })()`).then(JSON.parse);
  await p.screenshot({ path: `${FOTOS}/borrar_${celu ? 'celu' : 'compu'}_despues.png` });
  const t = celu ? 'celu' : 'compu';
  ok(`1 (${t}). «Borrar varios» aparece; cada uno con su tamaño y su casilla, y la regla arriba`, hayBoton && modo.sel && modo.tiles === 43 && modo.conMB === 43 && modo.casillas === 43 && /20 chicos, 10 medianos o 4 grandes/.test(modo.regla), { hayBoton, modo });
  ok(`2 (${t}). el cupo: 20 chicos (el 21 no y se ve apagado), 10 medianos, 4 grandes, mezclados hasta 20 puntos; sin tamaño = mediano`, chicos === 20 && bloqC && medianos === 10 && grandes === 4 && mezcla === 9 && cupoM === 20 && desconocido === 2, { chicos, bloqC, medianos, grandes, mezcla, cupoM, desconocido });
  ok(`3 (${t}). «Borrar (7)» pregunta con la lista (nombres y MB); «Volver» no borra nada`, dlg && /7/.test(dlg.tit) && dlg.filas.length === 7 && dlg.filas.every((f) => /\d+(\.\d)? [KM]B$|\? MB$/.test(f)) && dlg.rojo && tras_no.n === 43 && tras_no.sel === 7, { dlg, tras_no });
  ok(`4 (${t}). confirmado: los 7 fuera de instalados, de la caché y desmontados; la lista sin ellos; avisa; los otros siguen`, !despues.inst.length && !despues.cache.length && !despues.montados.length && !despues.lista.length && !despues.sel && /^Borrados: 7 \(\d+ MB\)$/.test(despues.aviso) && despues.quedan.real === true && despues.quedan.prueba === 35 && armasAntes.every((n) => n >= 0), { despues, armasAntes });
  ok(`5 (${t}). al instalar se anota lo que ocupa guardado (±0,01 MB)`, Object.values(inst).every((x) => x.montado && x.cache && Math.abs(x.mbG - x.tam) <= 0.01), inst);
  ok(`6 (${t}). el pie entra en el panel (nada afuera)`, pie.sw <= pie.cw + 1 && !pie.fuera, pie);
  errores.push(...err); await b.close();
}
const e = errores.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('7. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
