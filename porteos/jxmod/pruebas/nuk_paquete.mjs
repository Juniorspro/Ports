// las bombas nucleares en su paquete aparte (web/rb/p_nuk.*.rbp, para que el HTML no pese 3,5 MB más): el HTML no
// trae sus mallas ni sus sonidos; una bomba puesta antes de que el paquete llegue tiene el mismo cuerpo que con la malla
// (choca y cae igual; la Fat Man, redonda, rueda unos 10 s antes de quedar quieta), el paquete se pide solo al ponerla (llega en ≤ 5 s del servidor local), después se ve (malla
// cargada) y la sirena de una armada en ese momento suena apenas llega; abrir Props → Nucleares también lo pide; sin
// errores. (Con ?perezoso: las pruebas no bajan todos los paquetes al empezar.)
// uso: node nuk_paquete.mjs URL_HTML (del armado con paquetes aparte)
import { abrir } from './base.mjs';
const u = process.argv[2]; const { b, ctx, p, err, ev } = await abrir(u + (u.includes('?') ? '&' : '?') + 'perezoso');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 });
const ini = await ev(`(() => { const L = Object.values(DATA.pf).filter((a) => a[0].nk), ms = new Set(L.map((a) => a[0].m));
  const son = DATA.son.filter((n) => n.startsWith('NK_'));
  return { bombas: L.length, mallas: ms.size, aparte: [...ms].every((m) => DATA.ms[m].k === 'p_nuk' && DATA.ms[m].hp), sinBin: [...ms].every((m) => !binDe(DATA.ms[m])), sonidos: son.length, sinSon: son.every((n) => !PK.parte('a:' + n)), listo: rbListo('p_nuk'), paq: DATA.rbp.p_nuk }; })()`);
ok('el HTML no trae las mallas ni los sonidos de las bombas (van en p_nuk) y todavía no se bajó', ini.bombas >= 100 && ini.aparte && ini.sinBin && ini.sonidos >= 10 && ini.sinSon && !ini.listo, ini);
// una bomba puesta y armada antes de que llegue el paquete
const pre = await ev(`(async () => {
  const son = []; const s0 = sonar; window.sonar = sonar = (n, pp, v, t) => { const r = s0(n, pp, v, t); son.push({ n, ok: !!r, t: performance.now() }); return r; };
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), t0 = performance.now();
  const o = crearObjeto('NK_fatman', vadd(JUG.pos, vadd(vscale(f, 5), v3(0, 1.5, 0))), new Quat(), {}); window.__o = o;
  const F = formaDe('NK_fatman'), cuerpo = { tipo: o.b.shape.type, v: o.b.shape.v ? o.b.shape.v.length : 0, f: o.b.shape.f ? o.b.shape.f.length : 0 };
  const pedido = !!RBP.prom.p_nuk || rbListo('p_nuk');
  nukeArmar(o, 60, false);   // (larga: que no explote durante la prueba)
  let tl = null; while (performance.now() - t0 < 8000) { if (rbListo('p_nuk') && tl === null) tl = performance.now() - t0; if (tl !== null && son.some((x) => x.n === 'NK_sirena' && x.ok)) break; await new Promise((r) => setTimeout(r, 50)); }
  const sir = son.find((x) => x.n === 'NK_sirena' && x.ok);
  // (otra igual, ya con el paquete, al lado: tiene que caer y quedar igual)
  const o2 = crearObjeto('NK_fatman', vadd(JUG.pos, vadd(vadd(vscale(f, 5), v3(f.z * 4, 0, -f.x * 4)), v3(0, 1.5, 0))), new Quat(), {}); window.__o2 = o2;
  const t1 = performance.now(); while (performance.now() - t1 < 15000 && (o.b.vel.len() > 0.05 || o2.b.vel.len() > 0.05 || performance.now() - t1 < 1500)) await new Promise((r) => setTimeout(r, 100));
  const m = DATA.pf[DATA.pfPorNombre['NK_fatman']][0].m, gl = mallaGL(m);
  const h = raycast(vadd(o.b.pos, v3(0, 0.01, 0)), v3(0, -1, 0), 20, o.b), h2 = raycast(vadd(o2.b.pos, v3(0, 0.01, 0)), v3(0, -1, 0), 20, o2.b);
  window.sonar = sonar = s0;
  return { cuerpo, pedido, llega: tl === null ? null : Math.round(tl), sirena: sir ? Math.round(sir.t - t0) : null, sirenaDesdeLlega: sir && tl !== null ? Math.round(sir.t - t0 - tl) : null, ve: !!gl, quieta: +o.b.vel.len().toFixed(3), quieta2: +o2.b.vel.len().toFixed(3), sobrePiso: h ? +h.t.toFixed(3) : null, sobrePiso2: h2 ? +h2.t.toFixed(3) : null, tQuieta: Math.round(performance.now() - t1), mismaForma: F.shape === o.b.shape || (F.shape.v && F.shape.v.length === cuerpo.v) };
})()`);
ok('puesta antes de que llegue: el mismo cuerpo de choque (casco con sus caras) y el paquete se pide solo', pre.cuerpo.tipo === 'hull' && pre.cuerpo.v >= 8 && pre.cuerpo.f >= 6 && pre.mismaForma && pre.pedido, pre);
ok('el paquete llega en ≤ 5 s y la bomba se ve (malla cargada); cae y queda quieta igual que una puesta con el paquete ya bajado (±1 cm)', pre.llega !== null && pre.llega <= 5000 && pre.ve && pre.quieta < 0.05 && pre.quieta2 < 0.05 && Math.abs(pre.sobrePiso - pre.sobrePiso2) <= 0.01, pre);
ok('la sirena de la armada en ese momento suena apenas llega (≤ 1,5 s después)', pre.sirena !== null && pre.sirenaDesdeLlega !== null && pre.sirenaDesdeLlega <= 1500, pre);
await ev(`window.__o.nkArm = null; borrarObjeto(window.__o, true); borrarObjeto(window.__o2, true); 1`);
// abrir la sección también lo pide (otra página, sin nada bajado)
const p2 = await ctx.newPage(); p2.on('pageerror', (e) => err.push(e.message.slice(0, 200))); await p2.goto(u + (u.includes('?') ? '&' : '?') + 'perezoso'); await p2.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const sec = await p2.evaluate((x) => window.__ev(x), `(async () => { PREFS.bienvenida = true; inicioMostrar(false); empezarPartida('FlatGrass'); await new Promise((r) => setTimeout(r, 2500));
  const antes = rbListo('p_nuk'); abrirSpawn(); const tabs = DATA.menu.findIndex((c) => c.n === 'Props'); UI.tab = tabs; spawnDibujar();
  const cat = [...document.querySelectorAll('#spawnCats .cat, .cat')].find((d) => /Nucle/i.test(d.textContent)); if (cat) cat.click();
  const t0 = performance.now(); while (!rbListo('p_nuk') && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
  return { antes, boton: !!cat, listo: rbListo('p_nuk'), ms: Math.round(performance.now() - t0) }; })()`);
ok('abrir Props → Nucleares baja el paquete', !sec.antes && sec.boton && sec.listo, sec);
await p2.close();
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
