(() => {
  const R0 = {}; const paso = 1 / 60;
  const suelo = (x, z) => { const h = mundoRayo(v3(x, 50, z), v3(0, -1, 0), 200); return h ? 50 - h.t : 0; };
  const sim = (seg, ent) => { for (let i = 0; i < seg * 60; i++) { if (typeof vehiculosPaso === 'function') vehiculosPaso(paso, ent || { x: 0, y: 0, saltar: false, agachar: false }); physStep(paso); } };
  for (const n of ['Sedan', 'Derby5', 'police_car_v4', 'Moto', 'Luggage']) {
    for (const o of OBJS.slice()) borrarObjeto(o, true);
    const y0 = suelo(0, 8);
    const o = crearObjeto(n, v3(0, y0 + 0.3, 8), new Quat()); sim(2.5);
    const V = o.veh, b = o.b; const up = () => b.q.rot(v3(0, 1, 0));
    const r = { tocan: V.ruedas.filter((w) => w.toca).length + '/' + V.ruedas.length, alturaCentro: +(b.pos.y - y0).toFixed(3), fondo: +(b.aabb.y0 - y0).toFixed(3), quieto: +b.vel.len().toFixed(3) };
    // manejar: acelerar 4 s
    JUG.vehiculo = o; JUG.asiento = 0;
    sim(4, { x: 0, y: 1, saltar: false, agachar: false });
    r.vel4s = +V.vel.toFixed(1); r.derecho = +up().y.toFixed(3);
    // doblar 2 s
    sim(2, { x: 1, y: 1, saltar: false, agachar: false }); r.derechoDoblando = +up().y.toFixed(3);
    // frenar
    sim(3, { x: 0, y: 0, saltar: true, agachar: false }); r.velFrenado = +Math.abs(V.vel).toFixed(2);
    JUG.vehiculo = null;
    R0[n] = r;
  }
  // un objeto lanzado rápido contra una pared fija no la atraviesa
  for (const o of OBJS.slice()) borrarObjeto(o, true);
  const y0 = suelo(0, 8);
  const w = crearObjeto('wall_3', v3(0, y0, 10), new Quat(), { congelado: true }); w.b.frozen = true; w.b.updateWorld();
  const A = w.b.aabb, largoZ = (A.z1 - A.z0) > (A.x1 - A.x0), cx = (A.x0 + A.x1) / 2, cz = (A.z0 + A.z1) / 2;
  const res = [];
  for (const v of [20, 40, 60]) {
    const c = crearObjeto('Box1', largoZ ? v3(cx - 6, y0 + 1.2, cz + 0.6) : v3(cx + 0.6, y0 + 1.2, cz - 6), new Quat());
    c.b.vel.set(largoZ ? v : 0, 2, largoZ ? 0 : v); c.b.wake();
    sim(1.2);
    const lado = largoZ ? c.b.pos.x < cx : c.b.pos.z < cz; res.push(v + ':' + (lado ? 'rebota' : 'ATRAVIESA'));
    borrarObjeto(c, true);
  }
  R0.tunel = res.join(' ');
  return JSON.stringify(R0);
})()
