// tu propio logo (idea de Discord: «poner nuestro propio logo»). En Ajustes → «Tu logo»:
//  1. elegir una imagen la pone de logo en el menú, la bienvenida y la pantalla de carga (mismo dibujo, ≤ 1024×320) y
//     queda guardada; el ícono es de 192×192 con la imagen entera
//  2. al volver a abrir el juego, la pantalla de carga ya lo tiene (antes del menú) y el menú también
//  3. en la app: «Crear acceso directo» le pasa a Android el nombre y el ícono (PNG 192×192); fuera de la app, avisa
//  4. «Volver al de JXMod» devuelve el logo original en todos lados
//  5. una imagen rota no cambia nada; sin errores
// uso: node logo_propio.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/logo'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(true); 1`);
await p.waitForTimeout(800);
const orig = await ev(`milogoOrig().slice(0, 60)`);
// (una imagen de prueba de 600×300 —un círculo rojo y un cuadrado azul—: la dibuja la misma página)
const b64 = await ev(`(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#f33'; g.beginPath(); g.arc(150, 150, 120, 0, 7); g.fill(); g.fillStyle = '#36f'; g.fillRect(330, 40, 240, 220); return c.toDataURL('image/png').split(',')[1]; })()`);
fs.writeFileSync(`${D}/prueba.png`, Buffer.from(b64, 'base64'));
await ev(`(() => { abrirAjustes('menu'); document.querySelector('[data-aj="l"]').click(); return 1; })()`); await p.waitForTimeout(300);
const tab = await ev(`({ hay: !!document.querySelector('[data-aj="l"]'), sec: !document.querySelector('[data-ajs="l"]').classList.contains('oc'), boton: !!$('lgElegir'), app: !!$('lgAccBtn') })`);
await p.setInputFiles('#lgArch', `${D}/prueba.png`);
await p.waitForFunction(() => window.__ev(`!!milogoDe()`), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/ajustes.png` });
const r1 = await ev(`(async () => { const u = milogoDe(), ic = milogoDe(MILOGO.ki); const dims = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = s; });
  const imgs = [...document.querySelectorAll('#carga .dLogo img, .rbLogo')].map((i) => i.src === u);
  return JSON.stringify({ u: !!u, tam: u && await dims(u), ic: ic && await dims(ic), todos: imgs, n: imgs.length, est: $('lgEst').textContent, vista: $('lgImg').src === u, kb: u && Math.round(u.length / 1024) }); })()`).then(JSON.parse);
ok('1. la imagen pasa a ser el logo del menú y de la carga (≤ 1024×320) y el ícono es de 192×192', tab.hay && tab.sec && r1.u && r1.n >= 2 && r1.todos.every(Boolean) && r1.vista && r1.tam && r1.tam[0] <= 1024 && r1.tam[1] <= 320 && Math.abs(r1.tam[0] / r1.tam[1] - 2) < 0.02 && r1.ic && r1.ic[0] === 192 && r1.ic[1] === 192, { tab, ...r1 });
// 3. el acceso directo: fuera de la app avisa; con el puente, le llega a Android
const sinApp = await ev(`({ boton: !!$('lgAccBtn'), aviso: (document.querySelector('[data-ajs="l"]').textContent.match(/Android/) || [''])[0] })`);
const conApp = await ev(`(() => { let rec = null; window.JXNativo = Object.assign(window.JXNativo || {}, { accesoDirecto: (n, b) => { rec = { n, largo: b.length, png: b.slice(0, 8) }; return 'ok'; } });
  cerrarPaneles(); abrirAjustes('menu'); document.querySelector('[data-aj="l"]').click(); $('lgNom').value = 'Mi Server'; $('lgAccBtn').click(); return { rec, est: $('lgEst').textContent, boton: !!$('lgAccBtn') }; })()`);
ok('3. fuera de la app avisa que es de la app; en la app le pasa a Android el nombre y el ícono PNG', !sinApp.boton && sinApp.aviso === 'Android' && conApp.boton && conApp.rec && conApp.rec.n === 'Mi Server' && conApp.rec.png === 'iVBORw0K' && conApp.rec.largo > 500, { sinApp, conApp });
// 2. al volver a abrir
await ev(`(() => { cerrarPaneles(); return 1; })()`);
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const r2 = await ev(`(() => { const u = milogoDe(); inicioMostrar(true); return { carga: document.querySelector('#carga .dLogo img').src === u, menu: [...document.querySelectorAll('.rbLogo')].every((i) => i.src === u) && document.querySelectorAll('.rbLogo').length > 0, orig: (window.__logoOrig || '').slice(0, 30) }; })()`);
await p.waitForTimeout(500); await p.screenshot({ path: `${D}/menu.png` });
ok('2. al volver a abrir, la pantalla de carga y el menú ya lo tienen', r2.carga && r2.menu && /^data:image\/webp/.test(r2.orig), r2);
// 4. volver al de JXMod
const r4 = await ev(`(() => { abrirAjustes('menu'); document.querySelector('[data-aj="l"]').click(); $('lgQuitar').click(); const o = milogoOrig();
  return { guardado: !!milogoDe(), todos: [...document.querySelectorAll('#carga .dLogo img, .rbLogo')].every((i) => i.src === o), orig: o.slice(0, 60) === ${JSON.stringify(orig)}, est: $('lgEst').textContent }; })()`);
ok('4. «Volver al de JXMod» devuelve el original en todos lados y lo borra del aparato', !r4.guardado && r4.todos && r4.orig, r4);
// 5. una imagen rota
fs.writeFileSync(`${D}/rota.png`, Buffer.from('esto no es una imagen'));
await p.setInputFiles('#lgArch', `${D}/rota.png`); await p.waitForTimeout(1200);
const r5 = await ev(`({ guardado: !!milogoDe(), est: $('lgEst').textContent })`);
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('5. una imagen rota no cambia nada y avisa; sin errores de JS', !r5.guardado && /work|pudo|could/i.test(r5.est) && !malos.length, { ...r5, errores: malos.slice(0, 3) });
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
