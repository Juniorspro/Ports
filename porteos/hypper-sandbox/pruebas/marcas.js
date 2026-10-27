(() => { const paso = 1 / 60; const suelo = (x, z) => { const h = mundoRayo(v3(x, 50, z), v3(0, -1, 0), 200); return h ? 50 - h.t : 0; };
  const sim = (seg, ent) => { for (let i = 0; i < seg * 60; i++) { vehiculosPaso(paso, ent || { x: 0, y: 0, saltar: false, agachar: false }); physStep(paso); } };
  const y0 = suelo(0, 8), o = crearObjeto('Sedan', v3(0, y0 + 0.3, 8), new Quat()); sim(2); JUG.vehiculo = o; JUG.asiento = 0;
  sim(3, { x: 0, y: 1, saltar: false, agachar: false }); const n0 = MARCAS.n;
  sim(1.5, { x: 1, y: 1, saltar: true, agachar: false }); const n1 = MARCAS.n; JUG.vehiculo = null;
  return JSON.stringify({ rectaSinMarcas: n0, frenandoDoblando: n1 }); })()
