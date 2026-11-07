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
  // la corrida: captura de movimiento real (CMU 127_07, a 1,15×), el cuerpo avanza lo que el pie apoyado se va para atrás
  C.suaveJug = false;
  const corre = C.locomocion({ id: 'c:127_07', t0: T0 - 1.0, p0: v3(X0, piso, Z0), yaw: yawRun, girar: Math.PI, esc: 1.15, desde: 0.6, hasta: 0.6 + (T1 - T0 + 1.0 + 0.3) * 1.15 });
  const cG = C.grietaDir(-Math.PI / 2, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  GFX.lejos = 1100; R.niebla.a = 500; R.niebla.b = 1100;
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 30, p.z), 80); return v3(p.x, y === null ? p.y : y, p.z); };
  const camBase = enPiso(v3(X0 + 38, 0, Z0 + 4));
  const pN = v3(X0 - 640, piso, Z0 - 40);
  // la nuclear propia (volumen con marcha de rayos: cine_motor.js); la del juego no se usa
  C.nuke = null; C.nuc.on = false; C.nuc.p.copy(pN); C.nuc.tau = 0;
  C.nuc.luzK = 6; C.onda = false; C.golpe = 0;
  C.escena = (t, dt) => {
    C.tAct = t;
    if (corre) corre(t);
    C.nuc.on = t >= 19.02; C.nuc.tau = Math.max(0, t - 19.02);
    // la onda expansiva llega a él y a la cámara (≈680 m a 340 m/s): ráfaga de arena y sacudón
    if (t >= 20.92 && !C.onda) {
      C.onda = true; C.golpe = 0.85;
      for (let i = 0; i < 90; i++) {
        const q = v3(camBase.x - 45 - Math.random() * 40, camBase.y + Math.random() * 4, camBase.z + (Math.random() - 0.5) * 50);
        const x = C.part(q, v3(26 + Math.random() * 14, 0.6 + Math.random() * 2.5, (Math.random() - 0.5) * 3), 1.6 + Math.random() * 1.2, 1.2 + Math.random() * 2.4, [0.78, 0.62, 0.52, 0.32], 'humo', 2.2); x.fr = 0.4;
      }
    }
    C.golpe = (C.golpe || 0) * Math.exp(-dt * 2.6);
    C.luces.length = 0; C.nucLuz();
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[19.02, 1.5], [19.81, 0.6], [20.6, 0.6], [21.39, 0.6], [22.18, 0.8]], 0.3);
    const k = 0.92; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    R.niebla.a = 500; R.niebla.b = 1100;
    const u = C.suave(C.tramo(t, T0, T1));
    const g = C.golpe || 0;
    const cam = vadd(camBase, v3(C.ruido(t * 0.7, 1) * 0.05 + C.ruido(t * 23, 7) * 0.06 * g, 1.6 + 0.8 * u + C.ruido(t * 29, 8) * 0.07 * g, C.ruido(t * 0.6, 2) * 0.05 + C.ruido(t * 19, 9) * 0.05 * g));
    const mira = vadd(camBase, v3(-200, 22 + 55 * u, -8));
    C.camara(cam, mira, C.ruido(t * 0.5, 3) * 0.008 + C.ruido(t * 17, 10) * 0.025 * g, 38);
  };
  return 'p6 listo';
})();
