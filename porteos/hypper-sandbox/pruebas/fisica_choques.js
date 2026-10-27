(() => {
  const R0 = {}; const paso = 1 / 60;
  const sim = (seg, ent) => { for (let i = 0; i < seg * 60; i++) { if (ent) jugadorPaso(paso, ent); physStep(paso); } };
  const limpiar = () => { for (const o of OBJS.slice()) borrarObjeto(o, true); };
  JUG.noclip = false; JUG.vehiculo = null;
  const suelo = (x, z) => { const h = mundoRayo(v3(x, 50, z), v3(0, -1, 0), 200); return h ? 50 - h.t : 0; };
  const y0 = suelo(0, 6);
  // 1) mesa: una caja chica debajo, entre las patas, se queda en el piso (antes la mesa era un bloque macizo)
  limpiar();
  const mesa = crearObjeto('Table', v3(0, y0, 6), new Quat()); sim(1.5);
  const chica = crearObjeto('Box1', v3(mesa.b.pos.x, y0 + 0.02, mesa.b.pos.z), new Quat()); sim(2);
  R0.mesa = { tapa: +(mesa.b.aabb.y1 - y0).toFixed(3), cajaAbajo: +(chica.b.aabb.y0 - y0).toFixed(3), cajaAltura: +(chica.b.aabb.y1 - chica.b.aabb.y0).toFixed(3), mesaMovida: +Math.hypot(mesa.b.pos.x, mesa.b.pos.z - 6).toFixed(3) };
  // 2) pared con puerta (fija): buscar el hueco a lo largo de la pared y cruzarla caminando de frente
  limpiar();
  const pared = crearObjeto('Wall_door_1', v3(0, y0, 6), new Quat(), { congelado: true }); pared.b.frozen = true; pared.b.updateWorld();
  const A = pared.b.aabb, largoZ = (A.z1 - A.z0) > (A.x1 - A.x0);
  const cx0 = (A.x0 + A.x1) / 2, cz0 = (A.z0 + A.z1) / 2;
  let mejor = null, ini = null;
  const L0 = largoZ ? A.z0 : A.x0, L1 = largoZ ? A.z1 : A.x1;
  for (let t = L0 - 0.5; t <= L1 + 0.5; t += 0.05) {
    const o = largoZ ? v3(cx0 - 3, y0 + 1, t) : v3(t, y0 + 1, cz0 - 3), d = largoZ ? v3(1, 0, 0) : v3(0, 0, 1);
    const h = raycast(o, d, 6, null), choca = h && h.body === pared.b, dentro = t > L0 + 0.05 && t < L1 - 0.05;
    if (!choca && dentro && ini === null) ini = t;
    if ((choca || !dentro) && ini !== null) { const L = t - ini; if (!mejor || L > mejor.L) mejor = { a: ini, L }; ini = null; }
  }
  const cruzar = (t) => {
    if (largoZ) { JUG.pos.set(cx0 - 1.5, y0 + 1.1, t); JUG.yaw = Math.PI / 2; } else { JUG.pos.set(t, y0 + 1.1, cz0 - 1.5); JUG.yaw = 0; }
    JUG.vel.set(0, 0, 0); JUG.vivo = true;
    sim(2.5, { x: 0, y: 1, saltar: false, agachar: false, correr: false });
    return largoZ ? JUG.pos.x > cx0 + 0.5 : JUG.pos.z > cz0 + 0.5;
  };
  if (mejor) {
    const c = mejor.a + mejor.L / 2;
    R0.puerta = { hueco: +mejor.L.toFixed(2), pasaPorHueco: cruzar(c), paredFrena: !cruzar(mejor.a + mejor.L + 0.8 < L1 ? mejor.a + mejor.L + 0.8 : mejor.a - 0.8) };
  } else R0.puerta = 'sin hueco';
  // 3) contenedor abierto: se puede entrar
  limpiar();
  const cont = crearObjeto('Container1op', v3(0, y0, 8), new Quat(), { congelado: true }); cont.b.frozen = true; cont.b.updateWorld();
  const a = cont.b.aabb; R0.contenedor = { tam: [a.x1 - a.x0, a.y1 - a.y0, a.z1 - a.z0].map((v) => +v.toFixed(2)) };
  // abierto hacia algún lado: probar entrar desde los 4 lados por el medio
  for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]]) {
    const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, ex = (a.x1 - a.x0) / 2 + 1.2, ez = (a.z1 - a.z0) / 2 + 1.2;
    JUG.pos.set(cx + dx * ex, y0 + 1.1, cz + dz * ez); JUG.vel.set(0, 0, 0); JUG.yaw = yaw;
    sim(3, { x: 0, y: 1, saltar: false, agachar: false, correr: false });
    const dentro = JUG.pos.x > a.x0 + 0.3 && JUG.pos.x < a.x1 - 0.3 && JUG.pos.z > a.z0 + 0.3 && JUG.pos.z < a.z1 - 0.3;
    R0.contenedor[dx + ',' + dz] = dentro;
  }
  // 4) pila de 4 cajas: quieta después de 4 s
  limpiar();
  const pila = []; for (let i = 0; i < 4; i++) { const c = crearObjeto('Crate', v3(3, y0 + i * 1.02, 3), new Quat()); pila.push(c); sim(0.6); }
  const p0 = pila.map((c) => c.b.pos.clone()); sim(4);
  R0.pila = { mueve: +Math.max(...pila.map((c, i) => c.b.pos.distTo(p0[i]))).toFixed(3), alturaTop: +(pila[3].b.pos.y - y0).toFixed(2) };
  // 5) costo: 20 paredes compuestas fijas + 25 cajas cayendo encima
  limpiar();
  for (let i = 0; i < 20; i++) { const w = crearObjeto('wall_3', v3((i % 5) * 3 - 6, y0, 12 + Math.floor(i / 5) * 3), Quat.axis(0, 1, 0, i * 0.3), { congelado: true }); w.b.frozen = true; w.b.updateWorld(); }
  for (let i = 0; i < 25; i++) crearObjeto('Crate', v3((i % 5) * 3 - 6, y0 + 4 + Math.floor(i / 5), 12 + (i % 3)), Quat.axis(1, 0.3, 0.2, i));
  const t0 = performance.now(); sim(2); R0.costo = { msPorPaso: +((performance.now() - t0) / 120).toFixed(2), cuerpos: PH.bodies.length };
  limpiar();
  return JSON.stringify(R0);
})()
