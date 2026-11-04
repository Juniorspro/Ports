// el botón GMod y su panel (PC y celular parado, el juego girado): el botón se ve jugando; sin addons el panel invita a
// instalar; con la Lightsaber y M9K instaladas hay un apartado por addon con sus armas, entidades, herramientas,
// habilidades, comandos y ajustes; tocar un arma la da; un ajuste se aplica y queda guardado; una habilidad (la F de la
// Lightsaber) llega a su PlayerBindPress; fijarla pone el botón en la pantalla; la herramienta del addon se equipa en la
// Tool Gun y su clic izquierdo pone su entidad; el panel entra en la pantalla; sin errores.
// uso: node gmod_panel.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const modo of ['pc', 'parado']) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(modo === 'parado' ? { viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') err.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(2500);
  const r0 = await ev(`(() => { const b = document.querySelector('.gmbBt'); const r = b && b.getBoundingClientRect(); gmbAbrir(); const v = document.querySelector('#gmbPanel .gbVacio'); return { boton: !!(b && b.style.display !== 'none' && r.width > 10), vacio: !!v, tienda: !!document.querySelector('#gmbPanel [data-gb=tienda]') }; })()`);
  ok(`${modo}: el botón GMod se ve jugando y sin addons el panel invita a instalar`, r0.boton && r0.vacio && r0.tienda, r0);
  await ev(`gmbCerrar(); 1`);
  await ev(`(async () => { for (const id of ['111412589', '128089118']) { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma')).arrayBuffer()); const A = await gmInstalar(id, { nombre: id, sinDeps: true }, b); await A.listo; } return 1; })()`);
  await p.waitForTimeout(800);
  const r1 = await ev(`(() => { gmbAbrir('111412589'); const P = document.getElementById('gmbPanel'), secs = [...P.querySelectorAll('.gbSec h4')].map((h) => h.textContent);
    const habs = [...P.querySelectorAll('[data-hold]')].map((x) => x.dataset.hold), cmds = [...P.querySelectorAll('[data-gb^="cmd:"]')].map((x) => x.dataset.gb.slice(4)), ajs = [...P.querySelectorAll('[data-cv]')].map((x) => x.dataset.cv);
    const her = [...P.querySelectorAll('[data-gb^="her:"]')].map((x) => x.textContent), armas = [...P.querySelectorAll('[data-gb^="it:gmswep:"]')].map((x) => x.dataset.gb);
    const chips = [...P.querySelectorAll('.gbChip')].map((c) => c.textContent), r = P.getBoundingClientRect();
    return { chips, secs, habs: habs.slice(0, 12), nHabs: habs.length, cmds: cmds.slice(0, 6), nAjs: new Set(ajs).size, ajs: [...new Set(ajs)].slice(0, 8), her, armas, caja: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw: innerWidth, vh: innerHeight }; })()`);
  await p.screenshot({ path: D + 'gmb_' + modo + '_sable.png' });
  ok(`${modo}: un apartado por addon (2) y el de la Lightsaber trae armas, herramienta, habilidades (F y 1-9), comandos y ajustes`, r1.chips.length === 2 && r1.armas.length >= 1 && r1.her.length >= 1 && r1.habs.includes('bind:impulse 100') && r1.habs.includes('bind:slot1') && r1.cmds.length >= 1 && r1.nAjs >= 5, r1);
  // el panel entra en la pantalla (en el celu parado se mide en el juego girado: el cuerpo rota)
  const r1b = await ev(`(() => { const P = document.getElementById('gmbPanel'); const w = P.offsetWidth, h = P.offsetHeight, l = P.offsetLeft, t = P.offsetTop; return { w, h, l, t, W: VW(), H: VH() }; })()`);
  ok(`${modo}: el panel entra entero en la pantalla del juego`, r1b.l >= 0 && r1b.t >= 0 && r1b.l + r1b.w <= r1b.W + 1 && r1b.t + r1b.h <= r1b.H + 1, r1b);
  // un ajuste: el rojo de la hoja
  const r2 = await ev(`(() => { const i = document.querySelector('#gmbPanel input[type=number][data-cv="rb655_lightsaber_red"]') || document.querySelector('#gmbPanel input[data-cv="rb655_lightsaber_red"]'); if (!i) return { sin: true }; i.value = '255'; i.dispatchEvent(new Event('input', { bubbles: true }));
    return { cv: GMA.cvars.get('rb655_lightsaber_red').v, guardado: JSON.parse(localStorage.getItem('rb_gmcvars') || '{}').rb655_lightsaber_red }; })()`);
  ok(`${modo}: cambiar un ajuste del addon lo aplica y lo guarda en el aparato`, r2.cv === '255' && r2.guardado === '255', r2);
  // una habilidad: la F llega al PlayerBindPress de la Lightsaber (con la Lightsaber en la mano lo toma)
  await ev(`gmaDarArma('weapon_lightsaber'); elegirArma(ARM.lista.indexOf('gm:weapon_lightsaber')); 1`); await p.waitForTimeout(600);
  const r3 = await ev(`(() => { const g0 = gmaBind; let tomo = null; gmaBind = (b) => { const r = g0(b); if (b === 'impulse 100') tomo = r; return r; }; gmbAbrir('111412589'); const bt = document.querySelector('#gmbPanel [data-hold="bind:impulse 100"]');
    bt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); bt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); gmaBind = g0; return { tomo }; })()`);
  ok(`${modo}: la habilidad F (impulse 100) la toma el PlayerBindPress de la Lightsaber`, r3.tomo === true, r3);
  // fijarla en la pantalla
  const r4 = await ev(`(() => { localStorage.removeItem('rb_gmb_fijos'); GMB.fijos = []; const pin = document.querySelector('#gmbPanel [data-gb="pin:bind:impulse 100"]'); pin.click(); gmbCerrar(); const d = document.getElementById('bgmb0'); return { fijos: GMB.fijos.map((f) => f.k), boton: !!(d && !d.classList.contains('oc')), texto: d && d.textContent, guardado: localStorage.getItem('rb_gmb_fijos') }; })()`);
  ok(`${modo}: fijar la habilidad deja su botón en la pantalla (y queda guardado)`, r4.fijos[0] === 'bind:impulse 100' && r4.texto === 'F' && /impulse 100/.test(r4.guardado || '') && (modo === 'pc' || r4.boton), r4);
  // la herramienta del addon en la Tool Gun: el clic izquierdo pone su entidad donde se apunta
  const r5 = await ev(`(async () => { JUG.pitch = 0.45; gmbAbrir('111412589'); const b = document.querySelector('#gmbPanel [data-gb^="her:"]'); b.click(); await new Promise((r) => setTimeout(r, 300));
    const h = DATA.herr[HER.sel], n0 = [...GMA.ents.values()].filter((e) => e.vivo && e.clase === 'ent_lightsaber').length, e0 = GMA.errores.length;
    herramientaUsar(false); await new Promise((r) => setTimeout(r, 800));
    const n1 = [...GMA.ents.values()].filter((e) => e.vivo && e.clase === 'ent_lightsaber').length;
    return { arma: ARM.lista[ARM.i], her: h && (h.nom || h.n), gm: !!(h && h.gmTool), antes: n0, despues: n1, err: GMA.errores.slice(e0, e0 + 3) }; })()`);
  await p.screenshot({ path: D + 'gmb_' + modo + '_herramienta.png' });
  ok(`${modo}: la herramienta del addon va a la Tool Gun y su clic izquierdo pone su entidad, sin errores`, r5.arma === 'ToolBaton' && r5.gm && r5.despues > r5.antes && !r5.err.length, r5);
  // tocar un arma del panel la da (M9K)
  const r6 = await ev(`(async () => { gmbAbrir('128089118'); const t = document.querySelector('#gmbPanel [data-gb^="it:gmswep:"]'); const it = t && t.dataset.gb.slice(3); t && t.click(); await new Promise((r) => setTimeout(r, 400)); return { it, arma: ARM.lista[ARM.i], cerrado: !GMB.abierto }; })()`);
  ok(`${modo}: tocar un arma del panel la pone en la mano y cierra el panel`, r6.it && r6.arma === 'gm:' + r6.it.slice(7) && r6.cerrado, r6);
  await ev(`gmbAbrir('128089118'); 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + 'gmb_' + modo + '_m9k.png' }); await ev(`gmbCerrar(); 1`);
  const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
  ok(`${modo}: sin errores de JS`, !e2.length, e2.slice(0, 5));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
