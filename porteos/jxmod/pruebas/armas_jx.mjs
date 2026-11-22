// Las armas de JXMod (armasjx.js): las de GMod enteras, pintadas en dos tonos (pedido del dueño: «mejoremos los modelos
// de GMod para hacerlo propio… muy feo los modelos propios nuestros, el cartel JXM sobre la Physics Gun»), en Pasto plano:
//  1. la Physics Gun, la Gravity Gun, la Tool Gun y la palanca: con tinte de dos tonos en sus materiales (las manos y la
//     pantalla de la Tool Gun sin tocar), sin piezas quitadas (ninguna malla cambiada) y sin nada pegado (a dibujar, lo
//     mismo que la de GMod tal cual);
//  2. en la pantalla: la Physics Gun con acentos ámbar y sin celeste, la Gravity Gun con celeste y sin naranja, la palanca
//     amarilla (medido en la mitad de abajo a la derecha, donde está el arma);
//  3. el rayo de la Physics Gun agarrando algo, ámbar, y los íconos de la barra pintados (con halo); con el mod «Armas clásicas» todo vuelve a como en GMod (sin tinte, el
//     rayo celeste y el celeste del arma de vuelta en la pantalla);
//  4. sin errores de JS.
// uso: node armas_jx.mjs ARCHIVO.html [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const HTML = process.argv[2], D = (process.argv[3] || '/tmp/claude-0/armas_jx') + '/'; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.mods = {}; inicioMostrar(true); RB.mapaPartida = OFICIALES_MAPAS[0]; RB.mapaCom = 'megarampa'; RB.horaPartida = 'normal'; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(3000);
await ev(`JUG.pos.set(40, 2, 40); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.08; MODS.armasClasicas = false; ajxAplicar(); 1`);
// (colores en la mitad de abajo a la derecha: ámbar, celeste, naranja, amarillo)
const medir = `(() => { dibujar(); const gl = R.gl, W = R.cv.width, H = R.cv.height, px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const n = { ambar: 0, celeste: 0, naranja: 0, amarillo: 0, total: 0 };
  for (let y = 0; y < H * 0.55; y += 2) for (let x = Math.floor(W * 0.4); x < W; x += 2) { const i = (y * W + x) * 4, r = px[i], g = px[i + 1], bb = px[i + 2], mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); n.total++;
    if (mx < 90 || mx - mn < 70) continue; const h = mx === r ? ((g - bb) / (mx - mn) * 60 + 360) % 360 : mx === g ? (bb - r) / (mx - mn) * 60 + 120 : (r - g) / (mx - mn) * 60 + 240;
    if (h >= 185 && h <= 215) n.celeste++; else if (h >= 15 && h < 34) n.naranja++; else if (h >= 34 && h <= 52) n.ambar++; if (h >= 38 && h <= 58 && mx > 150) n.amarillo++; }
  return n; })()`;
const res = {};
for (const a of ['PhysicsGun', 'GravityGun', 'ToolBaton', 'Crowbar']) {
  await ev(`(() => { elegirArmaCallado('${a}'); return 1; })()`); await p.waitForTimeout(1800);
  res[a] = await ev(`(() => { const md = ARM.v.md, x = md.A.find((n) => n.bo && n.m >= 0), t = md.tintes || [];
    const mats = x ? x.mt.map((m, k) => (t[k] ? (Array.isArray(t[k][0]) ? 2 : 1) : 0)) : [];
    const t0 = md.tintes; md.tintes = null; const n0 = R.nItems; md.encolar(); const tal = R.nItems - n0;   // (la de GMod tal cual)
    md.tintes = t0; const n1 = R.nItems; ajxGmVista(ARM.v, '${a}'); const enc = R.nItems - n1; R.nItems = n0;
    return { mats, cambio: !!md.mCambio, encolados: enc, gmod: tal }; })()`);
  res[a].color = await ev(medir);
  await p.screenshot({ path: D + a + '.png' });
}
const tono = (a) => res[a].mats;
ok('1. las cuatro con dos tonos en el arma (las manos y la pantalla sin tocar), sin piezas quitadas ni pegadas',
  tono('PhysicsGun').join() === '2,0' && tono('GravityGun').join() === '0,2' && tono('ToolBaton').join() === '2,0,2,2,0' && tono('Crowbar').join() === '2,0,2'
    && Object.values(res).every((r) => !r.cambio && r.encolados > 0 && r.encolados === r.gmod), Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { mats: v.mats, cambio: v.cambio, encolados: v.encolados, gmod: v.gmod }])));
const C = (a) => res[a].color;
ok('2. en la pantalla: la Physics Gun ámbar sin celeste, la Gravity Gun celeste sin naranja, la palanca amarilla',
  C('PhysicsGun').ambar > 200 && C('PhysicsGun').celeste < 20 && C('GravityGun').celeste > 200 && C('GravityGun').naranja < 40 && C('Crowbar').amarillo > 80, Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.color])));
// 3)
await ev(`(() => { elegirArmaCallado('PhysicsGun'); const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  window.__o = crearObjeto('Box4', v3(JUG.pos.x + f.x * 3, piso, JUG.pos.z + f.z * 3), Quat.axis(0, 1, 0, 0.3)); for (let i = 0; i < 60; i++) physStep(1 / 60); return 1; })()`); await p.waitForTimeout(600);
await ev(`(() => { const b = window.__o.b, d = vsub(b.pos, CAM.pos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(d.y); return 1; })()`); await p.waitForTimeout(300);
const dbg = await ev(`(() => { const b = window.__o && window.__o.b, h = raycast(miraOjo(), miraDir(), 50, null); return { hay: !!b, p: b && [b.pos.x, b.pos.y, b.pos.z], cam: [CAM.pos.x, CAM.pos.y, CAM.pos.z], jug: [JUG.pos.x, JUG.pos.y, JUG.pos.z], golpe: !!h, es: !!(h && h.body === b), est: !!(h && h.body && h.body.estatico) }; })()`);
await ev(`(() => { ENT.disparo = true; return 1; })()`); await p.waitForTimeout(900);   // (con el gatillo apretado, como en la PC)
const r1 = await ev(`({ agarra: !!ARM.agarre, rayo: ajxRayoColor(), icono: ['PhysicsGun', 'GravityGun', 'ToolBaton', 'Crowbar'].every((n) => /^data:image\\/png/.test(DEF_ARMAS[n].ic) && DEF_ARMAS[n].ic !== DEF_ARMAS[n].icClasico) })`);
await p.screenshot({ path: D + 'agarra.png' });
await ev(`(() => { ENT.disparo = false; soltarAgarre(false); MODS.armasClasicas = true; ajxAplicar(); elegirArmaCallado('PhysicsGun'); return 1; })()`); await p.waitForTimeout(1800);
const cl = await ev(`(() => { const md = ARM.v.md; ajxGmVista(ARM.v, 'PhysicsGun'); return { tintes: md.tintes, rayo: ajxRayoColor(), icono: DEF_ARMAS.PhysicsGun.ic === DEF_ARMAS.PhysicsGun.icClasico }; })()`), ccl = await ev(medir);
await p.screenshot({ path: D + 'clasica.png' });
ok('3. el rayo agarrando, ámbar, y los íconos pintados; con «Armas clásicas», la de GMod tal cual (sin tinte, celeste, su ícono)',
  r1.agarra && r1.rayo[0] > 0.9 && r1.rayo[2] < 0.4 && r1.icono && cl.icono && cl.tintes === null && cl.rayo[2] > 0.9 && ccl.celeste > 50 && ccl.celeste > res.PhysicsGun.color.celeste + 50, { r1, cl, ccl, dbg });
const errJs = err.filter((e) => !/Failed to load resource|WebSocket connection|net::ERR|CORS policy|scheme 'file'/.test(e));
ok('4. sin errores de JS', errJs.length === 0, errJs.slice(0, 5));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
