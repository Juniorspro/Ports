// P6 (19,02–23,36): la nuclear. Plano muy abierto: él corre hacia la cámara; lejos, detrás, detona (destello), sube la
// bola de fuego y el hongo crece debajo de la grieta; la cámara sube despacio siguiéndolo
(() => {
  const C = CINE, T0 = 19.02, T1 = 23.36;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.0 };
  const yawRun = Math.PI / 2, X0 = -90, Z0 = -95;
  const piso = pisoBajo(v3(X0, 0, Z0), 300);
  JUG.pos.set(X0, piso + 1.0, Z0); JUG.vel.set(0, 0, 0); JUG.yaw = yawRun; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null;
  ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft');
  const cG = C.grietaDir(-Math.PI / 2, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  GFX.lejos = 1100; R.niebla.a = 500; R.niebla.b = 1100;
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 30, p.z), 80); return v3(p.x, y === null ? p.y : y, p.z); };
  const camBase = enPiso(v3(X0 + 38, 0, Z0 + 4));
  const pN = v3(X0 - 640, piso, Z0 - 40);
  C.nuke = null; C.nukeK = 2.2;
  C.escena = (t, dt) => {
    C.tAct = t;
    if (!C.nuke && t >= 18.98) { C.nuke = nukeExplotar(pN, 'NK_zuni', false); NUK.flash = 0; }
    if (C.nuke) C.nuke.t += dt * (C.nukeK - 1);   // (el hongo crece más rápido que en el juego)
    C.luces.length = 0;
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[19.02, 1.5], [19.81, 0.6], [20.6, 0.6], [21.39, 0.6], [22.18, 0.8]], 0.3);
    const k = 0.92; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    R.niebla.a = 500; R.niebla.b = 1100;
    const u = C.suave(C.tramo(t, T0, T1));
    const cam = vadd(camBase, v3(C.ruido(t * 0.7, 1) * 0.05, 1.6 + 0.8 * u, C.ruido(t * 0.6, 2) * 0.05));
    const mira = vadd(camBase, v3(-200, 22 + 55 * u, -8));
    C.camara(cam, mira, C.ruido(t * 0.5, 3) * 0.008, 38);
  };
  return 'p6 listo';
})();
