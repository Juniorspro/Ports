// P4 (13,50–16,65): la lluvia. Él corre hacia la cámara (se aleja de la grieta); detrás y a los costados caen cosas
// en llamas que explotan; la cámara, baja y adelante, retrocede con él y tiembla con cada golpe
(() => {
  const C = CINE, T0 = 13.50, T1 = 16.65;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.6, calentar: ['police_car_v5', 'Fridge1', 'BarrilExplosivo', 'police_car_v4', 'Sofa', 'Oxygen_tank', 'Crate', 'TV', 'Wheelchair', 'Gaspump', 'police_car_v6', 'Inflatable_boat', 'CajaMadera', 'Heladera', 'Carrito', 'BidonNafta', 'Table', 'Cone'] };
  const yawRun = Math.PI / 2, X0 = -182, Z0 = -128;
  const piso = pisoBajo(v3(X0, 0, Z0), 300);
  JUG.pos.set(X0, piso + 1.0, Z0); JUG.vel.set(0, 0, 0); JUG.yaw = yawRun; JUG.pitch = 0; JUG.tercera = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null;
  ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft');
  const cG = C.grietaDir(-Math.PI / 2, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  const f = v3(1, 0, 0), up = v3(0, 1, 0), r = vcross(f, up).norm();
  // dónde va a estar él en el momento del golpe (corre derecho a velocidad pareja)
  const donde = (c) => { const dt = c.t1 - C.tAct; return vadd(v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z), v3(JUG.vel.x * dt, 0, JUG.vel.z * dt)); };
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 30, p.z), 80); return v3(p.x, y === null ? p.y : y, p.z); };
  const cerca = (dF, dR, extra) => Object.assign({ hastaF: (c) => enPiso(vadd(donde(c), vadd(vscale(f, dF), vscale(r, dR)))), desdeF: (c) => vadd(c.hasta, vadd(vscale(cG, 240), v3((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50))) }, extra);
  C.caidas.length = 0;
  C.caida(cerca(-9, -4, { nombre: 'police_car_v5', t0: 11.1, t1: 13.50, explota: 2.6, sz: 2.6, arde: 3.5 }));
  C.caida(cerca(3.5, 5.5, { nombre: 'Fridge1', t0: 11.9, t1: 14.29, explota: 0, quedar: true, sz: 1.3, arde: 2 }));
  C.caida(cerca(-15, 8, { nombre: 'BarrilExplosivo', t0: 12.3, t1: 14.68, explota: 2.0, sz: 1.0 }));
  C.caida(cerca(-9, 4.5, { nombre: 'police_car_v4', t0: 13.0, t1: 15.47, explota: 1.6, quedar: true, sz: 2.6, arde: 4 }));
  C.caida(cerca(-3, -10, { nombre: 'Sofa', t0: 13.4, t1: 15.87, explota: 0, quedar: true, sz: 1.6, fuego: false }));
  C.caida(cerca(-22, -12, { nombre: 'Oxygen_tank', t0: 13.8, t1: 16.26, explota: 1.8, sz: 0.9 }));
  // las de lejos: meteoros que caen detrás, todo el tiempo
  const lejos = ['Crate', 'TV', 'Wheelchair', 'Gaspump', 'police_car_v6', 'Inflatable_boat', 'CajaMadera', 'Heladera', 'Carrito', 'BidonNafta', 'Table', 'Cone'];
  let sem = 5; const rn = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  for (let i = 0; i < 16; i++) {
    const t1 = 12.6 + i * 0.27 + rn() * 0.2, dF = -(35 + rn() * 120), dR = (rn() - 0.5) * 140;
    C.caida({ nombre: lejos[i % lejos.length], t0: t1 - 2.4 - rn() * 0.6, t1, hastaF: (c) => enPiso(vadd(v3(X0 + 7.6 * (c.t1 - 13.0), 0, Z0), vadd(vscale(f, dF), vscale(r, dR)))),
      desdeF: (c) => vadd(c.hasta, vadd(vscale(cG, 260), v3((rn() - 0.5) * 60, 0, (rn() - 0.5) * 60))), explota: 2.2 + rn() * 1.2, sz: 1.6 + rn() * 1.2, arde: 2 });
  }
  C.golpe = 0;
  C.escena = (t, dt) => {
    C.tAct = t;
    C.caidasPaso(t, dt);
    C.luces.length = 0; C.caidasLuces();
    C.luces.push({ p: vadd(v3(JUG.pos.x, JUG.pos.y + 0.4, JUG.pos.z), v3(2.2, 0.6, -0.8)), r: 7, c: [0.9, 0.75, 1.3] });
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[13.50, 1.3], [14.29, 0.8], [14.68, 0.7], [15.47, 1.0], [15.87, 0.8], [16.26, 0.6], [16.65, 0.9]], 0.3); C.grieta.brillo = 1;
    const k = 0.92; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    C.golpe = (C.golpe || 0) * Math.exp(-dt * 3.5);
    // cámara: adelante de él, baja, a su izquierda; mira hacia atrás (a él y a la grieta)
    const b = v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z);
    const u = C.tramo(t, T0, T1);
    let cam = vadd(b, vadd(vscale(f, 6.8 - 1.0 * u), vadd(vscale(r, -1.6), v3(0, 0, 0))));
    const pc = pisoBajo(v3(cam.x, b.y + 5, cam.z), 20); cam.y = (pc === null ? b.y : pc) + 0.55;
    const g = C.golpe, sh = 0.05 * g;
    cam = vadd(cam, v3(C.ruido(t * 23, 1) * sh, C.ruido(t * 29, 2) * sh, C.ruido(t * 19, 3) * sh));
    const mira = vadd(b, vadd(vscale(f, -9), v3(0, 3.2, 0)));
    C.camara(cam, vadd(mira, v3(C.ruido(t * 17, 4) * g * 0.6, C.ruido(t * 21, 5) * g * 0.6, 0)), C.ruido(t * 0.7, 6) * 0.015 + C.ruido(t * 13, 7) * g * 0.02, 54);
  };
  return 'p4 listo';
})();
