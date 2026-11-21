// Premium de punta a punta en un celular simulado: la app (web/) con una cuenta, Ajustes → Premium, «Hacete Premium»
// abre la página de PayPal (la del servidor de verdad) en otra pestaña, se paga con un PayPal de mentira (la misma API y
// unos botones que hacen lo que haría PayPal), y la app se entera sola: insignia, anillo dorado y sin anuncios.
// También la donación. uso: node premium_app.mjs [SALIDA=/tmp/claude-0/sz_premium]
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const { arrancar } = await import('./servidor_local.mjs');
const SAL = process.argv[2] || '/tmp/claude-0/sz_premium', WEB = new URL('../web/', import.meta.url).pathname; fs.mkdirSync(SAL, { recursive: true });
const PP = 8971, COM = 8972, APP = 8973, DIA = 86400e3;
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
// ---- PayPal de mentira: la API y el «SDK» de los botones ----
const subs = new Map(), ordenes = new Map(); let n = 0;
const SDK = `(function(){var ns=document.currentScript.getAttribute('data-namespace')||'paypal',api='http://127.0.0.1:${PP}';
window[ns]={Buttons:function(o){return{render:function(sel){var b=document.createElement('button');b.className='ppFalso';b.textContent='PayPal · '+o.style.label;
b.style.cssText='width:100%;height:48px;border-radius:99px;background:#ffc439;border:0;font:800 16px system-ui;color:#111;cursor:pointer';
b.onclick=function(){var p=o.createSubscription?o.createSubscription({},{subscription:{create:function(x){return fetch(api+'/falso/sub',{method:'POST',body:JSON.stringify(x)}).then(function(r){return r.json()}).then(function(j){return j.id})}}}).then(function(id){return o.onApprove({subscriptionID:id})})
:o.createOrder().then(function(id){return o.onApprove({orderID:id})});p.catch(function(e){o.onError&&o.onError(e)})};document.querySelector(sel).appendChild(b)}}}}})();`;
const ppSrv = http.createServer(async (q, r) => {
  const partes = []; for await (const c of q) partes.push(c); let b = {}; try { b = JSON.parse(Buffer.concat(partes).toString() || '{}'); } catch (e) { /* formulario */ }
  const dar = (st, j, tipo = 'application/json') => { r.writeHead(st, { 'Content-Type': tipo, 'Access-Control-Allow-Origin': '*' }); r.end(typeof j === 'string' ? j : JSON.stringify(j)); };
  const u = new URL(q.url, 'http://x'); let m;
  if (u.pathname === '/sdk/js') return dar(200, SDK, 'text/javascript');
  if (u.pathname === '/falso/sub') { const id = 'I-FALSA' + String(++n).padStart(5, '0'); subs.set(id, { plan: b.plan_id, cuenta: b.custom_id }); return dar(201, { id }); }
  if (u.pathname === '/v1/oauth2/token') return dar(200, { access_token: 't', expires_in: 32400 });
  if (u.pathname === '/v2/checkout/orders') { const id = 'ORD' + String(++n).padStart(8, '0'); ordenes.set(id, b.purchase_units[0]); return dar(201, { id, status: 'CREATED' }); }
  if ((m = /^\/v2\/checkout\/orders\/(\w+)\/capture$/.exec(u.pathname))) { const pu = ordenes.get(m[1]); return dar(201, { id: m[1], status: 'COMPLETED', purchase_units: [{ reference_id: pu.reference_id, payments: { captures: [{ id: 'C' + n, status: 'COMPLETED', custom_id: pu.custom_id, amount: pu.amount }] } }] }); }
  if ((m = /^\/v1\/billing\/subscriptions\/(I-\w+)$/.exec(u.pathname))) { const s = subs.get(m[1]); return s ? dar(200, { id: m[1], status: 'ACTIVE', plan_id: s.plan, custom_id: s.cuenta, billing_info: { next_billing_time: new Date(Date.now() + 365 * DIA).toISOString() } }) : dar(404, {}); }
  dar(404, {});
}).listen(PP);
const { srv } = await arrancar(COM, 'clave-admin', { SZ_PAYPAL_CLIENT_ID: 'cid', SZ_PAYPAL_SECRET: 'sec', SZ_PAYPAL_API: `http://127.0.0.1:${PP}`, SZ_PAYPAL_SDK: `http://127.0.0.1:${PP}/sdk/js`, SZ_PAYPAL_PLAN_MES: 'P-MES', SZ_PAYPAL_PLAN_ANIO: 'P-ANIO' });
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(APP);
// ---- la cuenta y el celular ----
const reg = await (await fetch(`http://127.0.0.1:${COM}/api/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'la.premium' }) })).json();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const err = []; ctx.on('page', (pg) => pg.on('pageerror', (e) => err.push(e.message)));
await ctx.addInitScript(([api, c]) => { window.SZ_API = api; try { localStorage.setItem('sz_cuenta', JSON.stringify(c)); localStorage.setItem('sz_bienvenida', '1'); } catch (e) { /* otra página */ } }, [`http://127.0.0.1:${COM}`, { token: reg.token, id: reg.usuario.id, nombre: reg.usuario.nombre, google: false }]);
const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(`http://127.0.0.1:${APP}/index.html`); await p.waitForFunction(() => window.__sz);
for (let k = 0; k < 6 && (await p.isVisible('#bienvenidaApp').catch(() => false)); k++) { await p.click('#bvSaltar', { timeout: 2000 }).catch(() => {}); await espera(500); }
await p.evaluate(() => window.__sz.pestaña('Perfil')); await p.waitForSelector('.opcPremium'); await espera(600);
await p.locator('.opcPremium').scrollIntoViewIfNeeded(); await espera(300); await p.screenshot({ path: SAL + '/1_ajustes.png' });
ok(/desde US\$ 1,99/.test(await p.textContent('.opcPremium')), 'Ajustes: la fila «Stickerazo Premium» con el precio');
await p.click('.opcPremium'); await p.waitForSelector('.hojaPremium [data-x="pagar"]'); await espera(500); await p.screenshot({ path: SAL + '/2_hoja.png' });
ok((await p.locator('.hojaPremium .prBen li').count()) === 5 && /29,99/.test(await p.textContent('.prPrecios')), 'la hoja: 5 beneficios y los 3 precios');
// «Hacete Premium» → la página de PayPal en otra pestaña
const [pag] = await Promise.all([ctx.waitForEvent('page'), p.click('.hojaPremium [data-x="pagar"]')]);
await pag.waitForSelector('#bSub .ppFalso'); await espera(400); await pag.screenshot({ path: SAL + '/3_pagina.png', fullPage: true });
ok(/@la\.premium/.test(await pag.textContent('.yo')) && (await pag.locator('#bDon .ppFalso').count()) === 1, 'la página de PayPal: para @la.premium, con los botones de suscripción y de donar');
await pag.click('#bSub .ppFalso'); await pag.waitForSelector('.ok'); await pag.screenshot({ path: SAL + '/4_listo.png' });
ok(/Ya sos Premium/.test(await pag.textContent('.ok')), 'pagó el plan anual: la página dice «¡Ya sos Premium!»');
await p.bringToFront(); await p.waitForFunction(() => document.querySelector('.anilloAv.dorado'), null, { timeout: 15000 }).catch(() => {});
await espera(800); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: SAL + '/5_perfil_premium.png' });
const st = await p.evaluate(() => ({ dorado: !!document.querySelector('.anilloAv.dorado'), chip: !!document.querySelector('.chipInsignia.premium'), prem: window.__sz.C.esPremium() }));
ok(st.dorado && st.chip && st.prem, 'la app se entera sola: anillo dorado, insignia ✨ Premium y sin anuncios');
// donar 5
await p.click('.opcPremium'); await p.waitForSelector('.hojaPremium [data-x="donar"]'); await espera(400); await p.screenshot({ path: SAL + '/6_hoja_premium.png' });
const [pag2] = await Promise.all([ctx.waitForEvent('page'), p.click('.hojaPremium [data-x="donar"]')]);
await pag2.waitForSelector('#bDon .ppFalso'); ok(await pag2.isHidden('#comprar'), 'ya Premium: la página esconde los planes y deja donar');
await pag2.click('#don [data-v="5"]'); await pag2.click('#bDon .ppFalso'); await pag2.waitForSelector('.ok');
ok(/Gracias/.test(await pag2.textContent('.ok')), 'donó US$ 5: «¡Gracias por bancar Stickerazo!»');
await p.bringToFront(); await p.waitForFunction(() => document.querySelector('.chipInsignia.donador'), null, { timeout: 15000 }).catch(() => {});
await espera(600); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: SAL + '/7_perfil_donador.png' });
ok(await p.isVisible('.chipInsignia.donador'), 'y aparece la insignia 💛 Donador');
ok(!err.length, 'sin errores en las páginas' + (err.length ? ': ' + err.join(' | ') : ''));
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`);
await b.close(); srv.close(); web.close(); ppSrv.close(); process.exit(fallas ? 1 : 0);
