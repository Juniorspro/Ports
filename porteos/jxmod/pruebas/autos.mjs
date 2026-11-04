// autos del juego (los Derby, el Sedan, el de policía): el conductor sentado adentro (no en el capó), las ruedas de adelante
// dibujadas girando para el mismo lado que dobla el auto, que doble con fuerza (radio con el volante a fondo) sin volcar,
// y que vaya derecho sin volante. uso: node autos.mjs URL_HTML [AUTOS...]
import { abrir } from './base.mjs';
const [, , HTML, ...L] = process.argv, AUTOS = L.length ? L : ['Derby6', 'Derby5', 'Derby7', 'Sedan', 'police_car_v4'];
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
await ev(`window.__ang = (o, w) => { const b = o.b, up = b.q.rot(v3(0,1,0)), fwd = b.q.rot(v3(0,0,1)); o.md.sucio = true; o.md.actualizar(); const W = o.md.W[w.vis], e = w.ejeX;
  const ax = v3(W[0]*e.x + W[4]*e.y + W[8]*e.z, W[1]*e.x + W[5]*e.y + W[9]*e.z, W[2]*e.x + W[6]*e.y + W[10]*e.z).norm();
  let h = vcross(ax, up).norm(); if (vdot(h, fwd) < 0) h = vscale(h, -1);
  const fis = b.q.rot(Quat.axis(0, 1, 0, o.veh.giro * 0.6).rot(v3(0, 0, 1))), sa = (a) => Math.atan2(vdot(vcross(fwd, a), up), vdot(fwd, a));
  return [+sa(h).toFixed(3), +sa(fis).toFixed(3)]; }; 1`);
for (const A of AUTOS) {
  const r = await ev(`(async () => { for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); if (JUG.vehiculo) salirVehiculo(); JUG.pos.set(0, 1.5, 0); JUG.vel.set(0, 0, 0);
    const o = crearObjeto('${A}', v3(0, 1, 8), new Quat()); await new Promise((r) => setTimeout(r, 1200)); subirVehiculo(o); await new Promise((r) => setTimeout(r, 600));
    const V = o.veh, inv = o.b.q.clone().conj(), espera = (ms) => new Promise((r) => setTimeout(r, ms)), yaw = () => { const f = o.b.q.rot(v3(0,0,1)); return Math.atan2(f.x, f.z); };
    // la caja de la carrocería y dónde quedó la cadera del conductor (en el marco del auto)
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; o.md.actualizar();
    for (let i = 0; i < o.md.A.length; i++) { const x = o.md.A[i]; if (!(x.m >= 0) || !o.md.ver[i] || /collider/i.test(x.n)) continue; const d = DATA.ms[x.m], W = o.md.W[i];
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) { const l = inv.rot(vsub(m4pt(W, d.mn[0] + d.sc[0] * cx, d.mn[1] + d.sc[1] * cy, d.mn[2] + d.sc[2] * cz, v3()), o.b.pos)); mn = [Math.min(mn[0], l.x), Math.min(mn[1], l.y), Math.min(mn[2], l.z)]; mx = [Math.max(mx[0], l.x), Math.max(mx[1], l.y), Math.max(mx[2], l.z)]; } }
    const P = JUG.cuerpo, Wh = P.md.W[P.D.h.Hips], c = inv.rot(vsub(v3(Wh[12], Wh[13], Wh[14]), o.b.pos)), largo = mx[2] - mn[2];
    const adentro = c.x > mn[0] && c.x < mx[0] && c.z > mn[2] + largo * 0.2 && c.z < mx[2] - largo * 0.2 && c.y > mn[1] && c.y < mx[1];
    const res = { cadera: [c.x, c.y, c.z].map((v) => +v.toFixed(2)), caja: [mn, mx].map((q) => q.map((v) => +v.toFixed(2))), adentro, sentado: !!P.sentado };
    const w = V.ruedas.find((x) => x.del && x.vis >= 0);
    ENT.teclas.add('KeyD'); await espera(700); res.derecha = __ang(o, w); ENT.teclas.delete('KeyD'); ENT.teclas.add('KeyA'); await espera(900); res.izquierda = __ang(o, w); ENT.teclas.delete('KeyA'); await espera(600);
    // derecho sin volante: no se va de costado
    ENT.teclas.add('KeyW'); await espera(1500); const yd0 = yaw(); await espera(2000); res.deriva = +Math.abs(yaw() - yd0).toFixed(3);
    for (const vt of [10, 20]) {
      // (frena hasta parar y acelera hasta la velocidad pedida: así cada medida es a esa velocidad)
      ENT.teclas.delete('KeyW'); ENT.teclas.add('Space'); { const t1 = performance.now(); while (Math.abs(V.vel) > 0.5 && performance.now() - t1 < 6000) await espera(50); } ENT.teclas.delete('Space');
      ENT.teclas.add('KeyW'); const t0 = performance.now(); while (Math.abs(V.vel) < vt && performance.now() - t0 < 9000) await espera(30);
      ENT.teclas.delete('KeyW');
      // (el radio de la curva ya tomada: 0,5 s para girar el volante y después se mide 0,8 s)
      ENT.teclas.add('KeyD'); await espera(500); const y0 = yaw(), tt = performance.now(), v0 = V.vel; await espera(800);
      const dy = yaw() - y0, d = (performance.now() - tt) / 1000, rol = Math.asin(Math.min(1, Math.abs(o.b.q.rot(v3(1,0,0)).y))) * 180 / Math.PI;
      res['v' + vt] = { vel: +v0.toFixed(1), radio: +Math.abs(((v0 + V.vel) / 2) / (dy / d)).toFixed(1), rol: +rol.toFixed(1) };
      ENT.teclas.delete('KeyD');
    }
    // volante a fondo a toda velocidad 2 s: no vuelca
    ENT.teclas.add('KeyW'); { const t0 = performance.now(); while (Math.abs(V.vel) < 24 && performance.now() - t0 < 9000) await espera(50); }
    ENT.teclas.add('KeyD'); let minUp = 1; for (let i = 0; i < 20; i++) { await espera(100); minUp = Math.min(minUp, o.b.q.rot(v3(0,1,0)).y); }
    ENT.teclas.delete('KeyD'); ENT.teclas.delete('KeyW'); ENT.teclas.add('Space'); await espera(1500); ENT.teclas.delete('Space');
    res.noVuelca = +minUp.toFixed(2); return res; })()`);
  ok(`${A}: el conductor sentado adentro del auto`, r.adentro && r.sentado, { cadera: r.cadera, caja: r.caja });
  const mismo = (a) => Math.sign(a[0]) === Math.sign(a[1]) && Math.abs(a[0] - a[1]) < Math.abs(a[1]) * 0.15 + 0.02;
  ok(`${A}: las ruedas de adelante se ven girando para el lado que dobla`, mismo(r.derecha) && mismo(r.izquierda) && Math.sign(r.derecha[1]) !== Math.sign(r.izquierda[1]), { derecha: r.derecha, izquierda: r.izquierda });
  ok(`${A}: dobla con fuerza (radio ≤ 12 m a 10 m/s y ≤ 32 m a 20 m/s) sin inclinarse de más`, r.v10.radio <= 12 && r.v20.radio <= 32 && r.v10.rol < 15 && r.v20.rol < 15, { v10: r.v10, v20: r.v20 });
  ok(`${A}: derecho sin volante y no vuelca con el volante a fondo a 24 m/s`, r.deriva < 0.06 && r.noVuelca > 0.7, { deriva: r.deriva, arriba: r.noVuelca });
  await p.screenshot({ path: 'auto_' + A + '.png' });
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
