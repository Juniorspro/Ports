// recorrido completo: bienvenida, idiomas, tienda, crear y publicar un mod, publicar un mapa, instalarlo y jugarlo
import { createRequire as _cr } from 'module'; const { chromium } = _cr(import.meta.url)('playwright');
const [, , html, dir, modo] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const ctx = await b.newContext(modo === 'celu' ? { viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/mqtt|WebSocket/i.test(m.text())) err.push(m.text().slice(0, 160)); });
p.on('dialog', (d) => d.accept()); p.on('requestfailed', (r) => { if (!/mqtt|wss/.test(r.url())) err.push('FALLO ' + r.url().slice(0, 90)); });
await p.goto('file://' + html); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 });
await p.waitForFunction(() => document.getElementById('carga').classList.contains('oc'), null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(800);
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const toca = async (sel, ms = 350) => { const e = await p.$(sel); if (!e) throw new Error('no está ' + sel); await e.click(); await p.waitForTimeout(ms); };
const foto = (n) => p.screenshot({ path: `${dir}/${modo}_${n}.png` });
console.log('bienvenida visible:', await p.evaluate(() => !!document.querySelector('.rbPan_bienvenida')));
await foto('1_bienvenida');
await toca('[data-rb="lang:ja"]'); console.log('título en japonés:', await p.evaluate(() => document.querySelector('.rbBienv h2').textContent));
await foto('2_japones');
await toca('[data-rb="lang:es"]'); await p.fill('#rbNombreB', 'Probador'); await toca('[data-rb=bienvOK]');
console.log('menú:', await p.evaluate(() => [...document.querySelectorAll('.rbIt')].map((e) => e.textContent).join(' | ')));
await toca('[data-rb=tienda]', 2500); await foto('3_tienda');
// los oficiales no vienen puestos: se instalan desde la tienda (Súper salto queda prendido); en Instalados se apaga
console.log('para instalar:', await p.evaluate(() => document.querySelectorAll('[data-rb^="instalar:"]').length));
await toca('[data-rb="instalar:salto"]');
await toca('[data-rb="vista:instalados"]'); console.log('instalados:', await p.evaluate(() => document.querySelectorAll('.rbCard').length));
await toca('[data-rb="act:salto"]'); await foto('4_instalados');
// crear y publicar un mod
await toca('[data-rb=pubmod]'); await p.fill('#pmNom', 'Prueba gravedad cero'); await p.fill('#pmDesc', 'Mod de prueba del recorrido');
await toca('[data-rb="pmico:ico:cohete"]'); await toca('[data-rb="pmetq:fisica"]');
await p.$eval('[data-rv=gravedad]', (e) => { e.value = 0.2; e.dispatchEvent(new Event('input', { bubbles: true })); });
await toca('[data-rb="pmtog:municionInfinita"]'); await p.selectOption('#pmSkin', 'Soldier'); await toca('[data-rb="pmarma:Shotgun"]');
await foto('5_crear_mod');
await toca('[data-rb=pmpub]', 3000); await foto('6_publicado');
const pub = await ev('JSON.stringify(Object.keys(PUBLICADOS))'); console.log('publicados:', pub);
await toca('[data-rb="vista:explorar"]', 2500); console.log('en la tienda:', await p.evaluate(() => [...document.querySelectorAll('.rbCard b')].map((e) => e.textContent).join(', ')));
await foto('7_explorar');
// construir algo, guardarlo y publicarlo como mapa
await toca('[data-rb=volver]'); await toca('[data-rb=nueva]'); await toca('[data-rb="mapa:FlatGrass"]'); await toca('[data-rb=empezar]', 4000);
await ev(`(() => { const o = JUG.pos; for (const [n, d, l] of [['Barrel', 5, 0], ['Barrel', 5, 1.2], ['Cone', 6, -1], ['Sedan', 9, 2]]) { const x = crearObjeto(n, v3(o.x + Math.sin(JUG.yaw) * d + Math.cos(JUG.yaw) * l, o.y + 1, o.z + Math.cos(JUG.yaw) * d - Math.sin(JUG.yaw) * l), Quat.euler(JUG.yaw, 0)); if (x) x.dueno = 'yo'; } })()`);
await p.waitForTimeout(1500); await ev('guardarConstruccion()'); await p.waitForTimeout(1200);
console.log('foto guardada:', await ev("(localStorage.getItem('rb_foto_FlatGrass') || '').length"));
await ev('irMenuPrincipal()'); await p.waitForTimeout(800);
await toca('[data-rb=tienda]', 1200); await toca('[data-rb="tab:mapa"]', 1500); await toca('[data-rb=pubmapa]');
await p.fill('#paNom', 'Mi patio de prueba'); await p.fill('#paDesc', 'Barriles, un cono y un auto'); await toca('[data-rb="paetq:construccion"]');
await foto('8_pub_mapa');
await toca('[data-rb=papub]', 3000);
const idMapa = await ev("Object.keys(INST.mapas).find(k => !k.startsWith('local-'))"); console.log('mapa publicado:', idMapa);
// quitarlo e instalarlo desde la tienda como otro usuario, y jugarlo con los mods activos
await toca(`[data-rb="quitar:${idMapa}"]`); await toca('[data-rb="vista:explorar"]', 2500);
await foto('9_mapas_tienda');
await toca(`[data-rb="instalar:${idMapa}"]`, 2500); await toca(`[data-rb="jugarcom:${idMapa}"]`, 5000);
console.log('partida:', await ev(`JSON.stringify({ estado: JUEGO.estado, mapa: MUNDO.nombre, objetos: OBJS.length, grav: +MUNDO.gravedad.toFixed(3), salto: +JUG.salto.toFixed(2), escopeta: ARM.lista.includes('Shotgun'), municion: MODS.municionInfinita, skin: JUG.skinMod || PREFS.skin, cuerpo: JUG.cuerpo && JUG.cuerpo.skin })`));
await foto('10_jugando');
// limpiar lo publicado en el servidor
await ev('irMenuPrincipal()'); await p.waitForTimeout(500);
const borrar = await ev(`Promise.all(Object.entries(PUBLICADOS).map(([id, clave]) => fetch(TIENDA_URL + 'borrar/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }) }).then(r => r.json()).then(r => id + ':' + r.ok))).then(x => x.join(' '))`);
console.log('borrados:', borrar);
console.log('errores:', err.slice(0, 6).join(' | ') || 'ninguno');
await b.close();
