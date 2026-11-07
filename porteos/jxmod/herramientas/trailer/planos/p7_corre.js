// P7 (23,36–26,60): la corrida. Teleobjetivo de tres cuartos de frente, la cámara corre con él; atrás el hongo y la
// grieta; caen cosas encendidas, polvo
(() => {
  const C = CINE, T0 = 23.36, T1 = 26.60;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 4.6, calentar: ['Crate', 'TV', 'Wheelchair', 'CajaMadera', 'Cone', 'BidonNafta', 'Heladera'] };
  const yawRun = Math.PI / 2, X0 = -120, Z0 = -60;
  const piso = pisoBajo(v3(X0, 0, Z0), 300);
  JUG.pos.set(X0, piso + 1.0, Z0); JUG.vel.set(0, 0, 0); JUG.yaw = yawRun; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null;
  ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft');
  const cG = C.grietaDir(-Math.PI / 2, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  GFX.lejos = 1100;
  const f = v3(1, 0, 0), r = vcross(f, v3(0, 1, 0)).norm();
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 30, p.z), 80); return v3(p.x, y === null ? p.y : y, p.z); };
  const pN = v3(X0 - 120 - 640, piso, Z0 - 75);
  C.nuke = null; C.nukeK = 2.2;
  C.caidas.length = 0;
  let sem = 13; const rn = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const cosas = ['Crate', 'TV', 'Wheelchair', 'CajaMadera', 'Cone', 'BidonNafta', 'Heladera'];
  for (let i = 0; i < 8; i++) {
    const t1 = 23.2 + i * 0.4 + rn() * 0.2, dF = -(12 + rn() * 33), dR = -12 + rn() * 18;
    C.caida({ nombre: cosas[i % cosas.length], t0: t1 - 2.4, t1, hastaF: (c) => enPiso(vadd(v3(JUG.pos.x + JUG.vel.x * (c.t1 - C.tAct), 0, JUG.pos.z), vadd(vscale(f, dF), vscale(r, dR)))),
      desdeF: (c) => vadd(c.hasta, vadd(vscale(cG, 240), v3(0, 0, (rn() - 0.5) * 40))), explota: 1.6 + rn(), sz: 1.4 + rn(), arde: 2 });
  }
  C.escena = (t, dt) => {
    C.tAct = t;
    if (!C.nuke && t >= 18.98) { C.nuke = nukeExplotar(pN, 'NK_zuni', false); NUK.flash = 0; }
    if (C.nuke) C.nuke.t += dt * (C.nukeK - 1);
    C.caidasPaso(t, dt);
    C.luces.length = 0; C.caidasLuces();
    C.luces.push({ p: vadd(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), vadd(vscale(f, 2.2), vscale(r, 1.6))), r: 7, c: [1.6, 1.2, 1.9] });
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[23.76, 0.6], [24.55, 0.6], [25.33, 0.9], [25.95, 1.0]], 0.3);
    const k = 0.92; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    R.niebla.a = 500; R.niebla.b = 1100;
    const b = v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z);
    // de tres cuartos de frente: adelante y a su derecha, a 9 m; mira hacia atrás (al hongo)
    let cam = vadd(b, vadd(vscale(f, 7.5), vscale(r, 5.0)));
    const pc = pisoBajo(v3(cam.x, b.y + 5, cam.z), 20); cam.y = (pc === null ? b.y : pc) + 1.1;
    cam = vadd(cam, v3(C.ruido(t * 3.1, 1) * 0.04, C.ruido(t * 4.3, 2) * 0.05, C.ruido(t * 2.7, 3) * 0.04));
    const mira = vadd(b, vadd(vscale(f, -2.5), v3(0, 2.6, 0)));
    C.camara(cam, mira, C.ruido(t * 0.9, 4) * 0.012, 36);
  };
  return 'p7 listo';
})();
