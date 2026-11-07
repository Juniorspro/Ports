// P3 (12,31–13,05): teleobjetivo a la grieta: de la luz del centro salen las primeras cosas encendidas, hacia nosotros
(() => {
  const C = CINE, T0 = 12.31, T1 = 13.05;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.2, calentar: ['police_car_v5', 'Fridge1', 'Crate', 'TV'] };
  const X = -150, Z = -120, yaw = -Math.PI / 2;
  const piso = pisoBajo(v3(X, 0, Z), 300);
  JUG.pos.set(X, piso + 1.0, Z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.tercera = false;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null;
  const cG = C.grietaDir(yaw, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  GFX.lejos = 1100;
  const ojo = v3(X, piso + 1.6, Z);
  C.caidas.length = 0;
  const salen = [['police_car_v5', 11.95, [-6, 0], 3.0], ['Fridge1', 12.2, [9, 4], 1.6], ['Crate', 12.45, [-14, -6], 1.4], ['TV', 12.6, [4, -9], 1.2]];
  for (const [n, t0, [dx, dz], sz] of salen) {
    const desde = vadd(ojo, vadd(vscale(cG, 420), v3(dx * 0.4, 0, dz * 0.4)));
    const hasta = vadd(ojo, vadd(vscale(cG, 40), v3(dx * 3, -18, dz * 3)));
    C.caida({ nombre: n, t0, t1: t0 + 3.2, desde, hasta, g: -4, explota: 0, quedar: false, sz, sinPolvo: true });
  }
  C.escena = (t, dt) => {
    C.tAct = t;
    C.caidasPaso(t, dt);
    C.luces.length = 0;
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[12.31, 1.2], [12.71, 1.0]], 0.25);
    const k = 0.9; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    // teleobjetivo al centro de la grieta, con un temblor de cámara en mano y un zoom lento hacia adentro
    const u = C.tramo(t, T0, T1);
    const mira = vadd(ojo, vscale(cG, 100));
    C.camara(vadd(ojo, v3(C.ruido(t * 9, 1) * 0.01, C.ruido(t * 11, 2) * 0.01, 0)), vadd(mira, v3(C.ruido(t * 3, 3) * 0.4, C.ruido(t * 4, 4) * 0.4 - 1.5, 0)), C.ruido(t * 0.5, 5) * 0.01, 17 - 3 * u);
  };
  return 'p3 listo';
})();
