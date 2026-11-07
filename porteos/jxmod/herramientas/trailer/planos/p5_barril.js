// P5 (16,65–19,02): cámara casi tocando la arena, detrás de él que se aleja corriendo. Un barril explosivo en llamas
// cae delante de la cámara (17,84), rebota y se queda; en 18,63 revienta y la bola de fuego viene hacia la cámara
(() => {
  const C = CINE, T0 = 16.65, T1 = 19.02;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.2, calentar: ['BarrilExplosivo', 'Crate', 'police_car_v6', 'TV', 'Fridge1', 'Gaspump', 'Wheelchair', 'CajaMadera', 'Table'] };
  const yawRun = Math.PI / 2, X0 = -120, Z0 = -110;
  const piso = pisoBajo(v3(X0, 0, Z0), 300);
  JUG.pos.set(X0, piso + 1.0, Z0); JUG.vel.set(0, 0, 0); JUG.yaw = yawRun; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null;
  // la corrida: captura de movimiento real (CMU 127_07, a 1,15×), el cuerpo avanza lo que el pie apoyado se va para atrás
  C.suaveJug = false;
  // (arranca 6,5 m más adelante: con la corrida real, más lenta que la del juego, el barril le caía encima)
  const corre = C.locomocion({ id: 'c:127_07', t0: T0 - 1.2, p0: v3(X0 + 6.5, piso, Z0), yaw: yawRun, girar: Math.PI, esc: 1.15, desde: 0.6, hasta: 0.6 + (T1 - T0 + 1.2 + 0.3) * 1.15 });
  const cG = C.grietaDir(-Math.PI / 2, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78; C.grieta.abre = 1;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  const f = v3(1, 0, 0), up = v3(0, 1, 0), r = vcross(f, up).norm();
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 30, p.z), 80); return v3(p.x, y === null ? p.y : y, p.z); };
  // la cámara: quieta en la arena, 4 m detrás de donde arranca el plano
  const cam0 = enPiso(v3(X0 + 6.0, 0, Z0 + 0.9));
  C.caidas.length = 0;
  const bar = enPiso(vadd(cam0, v3(8.5, 0, -0.5)));
  C.caida({ nombre: 'BarrilExplosivo', t0: 15.9, t1: 17.84, hasta: v3(bar.x, bar.y + 0.45, bar.z), desde: vadd(v3(bar.x, bar.y + 0.45, bar.z), vadd(vscale(cG, 120), v3(0, 0, 4))), explota: 0, quedar: true, rebote: 0.03, salto: 0.18, sz: 0.85, arde: 1.0, explotaEn: 18.63, explotaEsc: 1.8 });
  // lo que sigue cayendo a lo lejos (adelante, hacia donde corre)
  const cosas = ['Crate', 'police_car_v6', 'TV', 'Fridge1', 'Gaspump', 'Wheelchair', 'CajaMadera', 'Table'];
  let sem = 9; const rn = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  for (let i = 0; i < 9; i++) {
    const t1 = 16.0 + i * 0.36 + rn() * 0.2, h = enPiso(vadd(cam0, v3(30 + rn() * 110, 0, (rn() - 0.5) * 90)));
    C.caida({ nombre: cosas[i % cosas.length], t0: t1 - 2.6, t1, hasta: h, desde: vadd(h, vadd(vscale(cG, 250), v3(0, 0, (rn() - 0.5) * 40))), explota: 2.0 + rn() * 1.2, sz: 1.6 + rn(), arde: 2 });
  }
  C.golpe = 0;
  C.escena = (t, dt) => {
    C.tAct = t;
    if (corre) corre(t);
    C.caidasPaso(t, dt);
    C.luces.length = 0; C.caidasLuces();
    C.grieta.abre = 1; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, [[17.84, 0.8], [18.63, 1.2]], 0.3);
    const k = 0.92; C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    C.golpe = (C.golpe || 0) * Math.exp(-dt * 3.0);
    if (t >= 17.84 && !C.g1) { C.g1 = true; C.golpe = Math.max(C.golpe, 0.45); }
    const g = C.golpe, sh = 0.025 * g;
    // la explosión la empuja: un sacudón y queda torcida
    const emp = C.suave(C.tramo(t, 18.66, 18.9)) * 0.035;
    const cam = vadd(cam0, v3(-emp * 2 + C.ruido(t * 27, 1) * sh, 0.13 + C.ruido(t * 31, 2) * sh, C.ruido(t * 23, 3) * sh));
    const mira = vadd(cam0, v3(20, 0.9 + 1.2 * emp * 10, -0.6));
    C.camara(cam, vadd(mira, v3(0, C.ruido(t * 19, 4) * g * 0.5, C.ruido(t * 17, 5) * g * 0.5)), C.ruido(t * 0.6, 6) * 0.01 + emp * 2.0 + C.ruido(t * 13, 7) * g * 0.03, 50);
  };
  return 'p5 listo';
})();
