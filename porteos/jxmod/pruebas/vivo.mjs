// Los eventos en vivo (juego/vivo.js + herramientas/vivo.py), con guiones firmados con la llave de verdad en una carpeta
// servida junto a la página (?vivo=URL):
//  1. al abrir, baja el guion firmado y lo corre: empezar, y adentro ve todo lo del juego (PV, MUNDO...);
//  2. al entrar a un mapa, alEntrar; jugando, paso en cada cuadro;
//  3. uno nuevo (sin recargar): el anterior termina (fin) y corre el nuevo;
//  4. un guion tocado después de firmar, o un vivo.json con otra firma: no se corre nada (sigue el que estaba);
//  5. si un gancho falla, el evento se apaga solo y el juego sigue;
//  6. «apagar»: el que estaba termina; uno vencido (`hasta` pasado) no arranca;
//  7. sin internet, al abrir corre el último bueno guardado (con la firma comprobada otra vez);
//  8. sin errores de JS.
// uso: node vivo.mjs URL_DE_LA_CARPETA_DE_LA_PAGINA CARPETA_EN_DISCO   (p. ej. http://localhost:8394/ /tmp/claude-0/t394/www)
import { abrir } from './base.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
const [, , BASE, DISCO] = process.argv;
const DV = DISCO + '/vivo_prueba', UV = BASE + 'vivo_prueba/', HERR = new URL('../herramientas/vivo.py', import.meta.url).pathname;
fs.rmSync(DV, { recursive: true, force: true }); fs.mkdirSync(DV, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const firmar = (js, ...extra) => { const f = DV + '/guion.tmp.js'; fs.writeFileSync(f, js); const o = execFileSync('python3', ['-I', HERR, 'publicar', f, '--dir', DV, ...extra]).toString(); fs.rmSync(f); return JSON.parse(fs.readFileSync(DV + '/vivo.json', 'utf8')); };
const apagar = () => { execFileSync('python3', ['-I', HERR, 'apagar', '--dir', DV]); return JSON.parse(fs.readFileSync(DV + '/vivo.json', 'utf8')); };
const esperar = (p, js, ms) => p.waitForFunction((s) => window.__ev(s), js, { timeout: ms || 30000, polling: 100 });
const G1 = `window.__v1 = { empezo: 0, entro: [], pasos: 0, fin: 0, ve: typeof PV + ',' + typeof crearPersona + ',' + typeof MUNDO };
return { nombre: 'prueba1', empezar() { __v1.empezo++; }, alEntrar(m) { __v1.entro.push(m); }, paso(dt) { __v1.pasos++; }, fin() { __v1.fin++; } };`;
const G2 = `window.__v2 = { empezo: 0, entro: [] }; return { nombre: 'prueba2', empezar() { __v2.empezo++; }, alEntrar(m) { __v2.entro.push(m); }, fin() { __v2.fin = 1; } };`;
const m1 = firmar(G1);
const { b, ctx, p, ev, err } = await abrir(BASE + 'index.html?vivo=' + encodeURIComponent(UV), true);
// 1
await esperar(p, `!!window.__v1 && __v1.empezo === 1`);
const a = await ev(`({ v1: __v1, man: VIVO.man && VIVO.man.v, ev: VIVO.ev && VIVO.ev.nombre })`);
chk(a.man === m1.v && a.ev === 'prueba1' && a.v1.ve === 'object,function,object', '1. al abrir baja el guion firmado, lo corre y ve lo del juego', a);
// 2
await ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await esperar(p, `JUEGO.estado === 'juego' && !!JUG.suelo`, 120000); await p.waitForTimeout(1500);
const b2 = await ev(`({ entro: __v1.entro, pasos: __v1.pasos })`);
chk(b2.entro.includes('FlatGrass') && b2.pasos > 10, '2. alEntrar al entrar al mapa y paso en cada cuadro', b2);
// 3
const m2 = firmar(G2); await ev(`vivoBuscar()`); await esperar(p, `!!window.__v2`, 15000);
const c = await ev(`({ fin1: __v1.fin, v2: __v2, man: VIVO.man.v, ev: VIVO.ev && VIVO.ev.nombre })`);
chk(c.fin1 === 1 && c.v2.empezo === 1 && c.v2.entro[0] === 'FlatGrass' && c.man === m2.v && c.ev === 'prueba2', '3. uno nuevo sin recargar: el anterior termina y arranca el nuevo (ya en el mapa)', c);
// 4
const m3 = firmar(`window.__v3 = 1; return {};`); fs.appendFileSync(DV + '/' + m3.js, '\nwindow.__malo = 1;');
await ev(`vivoBuscar()`); await p.waitForTimeout(1500);
const d = await ev(`({ v3: !!window.__v3, malo: !!window.__malo, man: VIVO.man.v, ev: VIVO.ev && VIVO.ev.nombre })`);
chk(!d.v3 && !d.malo && d.man === m2.v && d.ev === 'prueba2', '4. un guion tocado después de firmar: no corre (sigue el que estaba)', d);
const falso = { v: m3.v + 100, hasta: 0, h: m3.h, js: m3.js, firma: Buffer.alloc(64, 7).toString('base64') };
fs.writeFileSync(DV + '/' + m3.js, `window.__v3 = 1; return {};`); fs.writeFileSync(DV + '/vivo.json', JSON.stringify(falso));
await ev(`vivoBuscar()`); await p.waitForTimeout(1500);
const e = await ev(`({ v3: !!window.__v3, man: VIVO.man.v })`);
chk(!e.v3 && e.man === m2.v, '4. un vivo.json con otra firma: no corre', e);
// 5
const m5 = firmar(`window.__v5 = { pasos: 0 }; return { nombre: 'rompe', paso() { if (++__v5.pasos === 3) throw new Error('a propósito'); } };`);
await ev(`vivoBuscar()`); await esperar(p, `!!window.__v5 && __v5.pasos >= 3`, 15000); await p.waitForTimeout(500);
const f = await ev(`({ pasos: __v5.pasos, ev: VIVO.ev, estado: JUEGO.estado, fallas: VIVO.fallas, caja: CN.l.some((l) => /vivo rompe · paso: a propósito/.test(l)) })`);
chk(f.pasos === 3 && f.ev === null && f.estado === 'juego' && f.fallas >= 1 && f.caja, '5. si un gancho falla, el evento se apaga solo (anotado) y el juego sigue', f);
// 6
const m6 = firmar(`window.__v6 = { fin: 0 }; return { nombre: 'seis', fin() { __v6.fin++; } };`); await ev(`vivoBuscar()`); await esperar(p, `!!window.__v6`, 15000);
const m6b = apagar(); await ev(`vivoBuscar()`); await p.waitForTimeout(1200);
const g = await ev(`({ fin: __v6.fin, ev: VIVO.ev, man: VIVO.man.v })`);
chk(g.fin === 1 && g.ev === null && g.man === m6b.v && !m6b.js, '6. apagar: el que estaba termina', g);
const m7 = firmar(`window.__v7 = 1; return {};`, '--hasta', '2020-01-01T00:00'); await ev(`vivoBuscar()`); await p.waitForTimeout(1200);
const h = await ev(`({ v7: !!window.__v7, ev: VIVO.ev, man: VIVO.man.v })`);
chk(!h.v7 && h.ev === null && h.man === m7.v, '6. uno vencido no arranca', h);
// 7: el último bueno queda guardado; sin internet corre igual (y con la firma comprobada otra vez)
const m8 = firmar(`window.__v8 = (window.__v8 || 0) + 1; return { nombre: 'ocho' };`); await ev(`vivoBuscar()`); await esperar(p, `!!window.__v8`, 15000);
const p2 = await ctx.newPage(); await p2.goto(BASE + 'index.html?vivo=' + encodeURIComponent(BASE + 'no_existe/'));
await p2.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p2.waitForTimeout(2500);
const k = await p2.evaluate(() => window.__ev(`({ v8: window.__v8, man: VIVO.man && VIVO.man.v })`));
chk(k.v8 === 1 && k.man === m8.v, '7. sin internet, al abrir corre el último bueno guardado', k);
await p2.evaluate(() => { const g = JSON.parse(localStorage.getItem('jx_vivo')); g.txt += '\nwindow.__malo2 = 1;'; localStorage.setItem('jx_vivo', JSON.stringify(g)); });
const p3 = await ctx.newPage(); await p3.goto(BASE + 'index.html?vivo=' + encodeURIComponent(BASE + 'no_existe/'));
await p3.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p3.waitForTimeout(2500);
const k2 = await p3.evaluate(() => window.__ev(`({ v8: window.__v8 || 0, malo: !!window.__malo2, ev: VIVO.ev })`));
chk(!k2.malo && !k2.v8 && k2.ev === null, '7. lo guardado tocado tampoco corre', k2);
chk(!err.filter((x) => !/WebSocket connection|broker\.|no_existe|vivo: firma mala|vivo rompe · paso: a propósito/.test(x)).length, '8. sin errores de JS', err.filter((x) => !/WebSocket connection|broker\./.test(x)).slice(0, 4));
await b.close(); fs.rmSync(DV, { recursive: true, force: true });
console.log('RESUMEN vivo ' + ok + '/' + (ok + mal));
