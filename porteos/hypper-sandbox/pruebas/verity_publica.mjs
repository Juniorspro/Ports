// Verity sin la tienda (todavía sin /api/verity, o caída): piensa con el modelo público (Pollinations, sin clave) y
// habla con la voz del navegador. uso: node verity_publica.mjs Hypper.html
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2], false);
await p.route(/\/api\/verity(\/voz)?(\?.*)?$/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no encontrado"}' }));
let fallas = 0; const ok = (c, t, x) => { if (!c) fallas++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.lang='es'; PREFS.nombre='Juni'; localStorage.removeItem('rb_verity'); PREFS.mods = {verity: true}; inicioMostrar(false); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; empezarPartida('FlatGrass')`);
await p.waitForTimeout(5000);
await ev(`audioIniciar(); 1`);
await p.waitForTimeout(3000); // (el saludo: sin la tienda es un gesto, no gasta el turno del modelo público)
const t0 = Date.now(); await ev(`verPreguntar('poneme dos pelotas porfa'); 1`);
await p.waitForTimeout(2000); await ev(`verPreguntar('y bailá un poco'); 1`); // (otra cosa mientras piensa: va después)
// (contesta lo primero; mientras habla, la boca se mueve con la voz del navegador o igual)
let nav = false; for (let i = 0; i < 300; i++) { await p.waitForTimeout(200); const x = JSON.parse(await ev(`JSON.stringify({ v: VER.hist.findIndex((h) => h[0] === 'v' && h !== VER.hist[0]) >= 0, n: VER.yo.nav || VER.yo.falsa > 0 })`)); nav = nav || x.n; if (x.v && nav) break; }
const r = JSON.parse(await ev(`JSON.stringify({ sinCF: VER.sinCF, h: VER.hist, pel: OBJS.filter((o) => o.verity).length })`));
await p.waitForTimeout(2000); const pel = Number(await ev(`OBJS.filter((o) => o.verity).length`));
const iq = r.h.findIndex((h) => /pelotas/.test(h[1])), resp = r.h[iq + 1];
ok(r.sinCF && resp && resp[0] === 'v', 'sin la tienda contesta con el modelo público', { ms: Date.now() - t0, dijo: resp });
ok(pel === 2, 'y hace lo que le piden', pel);
ok(nav, 'habla con la voz del navegador (o mueve la boca igual)');
for (let i = 0; i < 400 && !(await ev(`VER.hist.length >= 4 && !VER.pensando`)); i++) await p.waitForTimeout(200);
const r2 = JSON.parse(await ev(`JSON.stringify({ h: VER.hist.slice(-2), anim: VER.yo.anim })`));
ok(r2.h.length === 2 && r2.h[1][0] === 'v' && /bail/i.test(r2.h[0][1]), 'lo segundo que le dijiste también lo contesta (espera su turno)', { ms: Date.now() - t0, h: r2.h, anim: r2.anim });
console.log('errores:', [...new Set(err.filter((e) => !/WebSocket|mqtt|Failed to load resource|favicon|404/i.test(e)))].slice(0, 6).join(' | ') || 'ninguno');
await b.close(); process.exit(fallas ? 1 : 0);
