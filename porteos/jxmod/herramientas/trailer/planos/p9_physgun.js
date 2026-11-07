// P9 (30,86–34,00): cámara casi en la arena, a su espalda, mirando el mar y el sol. Silencio, las olas. De arriba cae la
// Gravity Gun y se clava en la arena entre la cámara y él (31,45). Se da vuelta despacio, la ve. Corte en 34,00
(() => {
  const C = CINE, T0 = 30.86, T1 = 34.0;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.6 };
  const O = C.orilla, f = v3(1, 0, 0), up = v3(0, 1, 0), r = vcross(f, up).norm();
  const pj = v3(O.x - 0.6, 0, O.z), py = pisoBajo(v3(pj.x, 0, pj.z), 300);
  JUG.pos.set(pj.x, py + 1.0, pj.z); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI / 2; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; ENT.teclas.clear();
  C.grietaDir(-Math.PI / 2 - 0.25, 0.40, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.42; C.grieta.abre = 1; C.grieta.brillo = 0.55;
  C.cielo(0, { dir: C.playa.dir, base: C.playa });
  C.mar.on = true;
  // la cámara: 3,8 m detrás de él, 0,28 m sobre la arena; la gravity cae a 1,7 m de la cámara, un poco a la derecha
  const camP = v3(pj.x - 3.8, 0, pj.z + 0.25); camP.y = pisoBajo(v3(camP.x, 0, camP.z), 300) + 0.28;
  const gP = v3(pj.x - 1.75, 0, pj.z - 0.55); gP.y = pisoBajo(v3(gP.x, 0, gP.z), 300) + 0.12;
  C.caidas.length = 0;
  // la Physics Gun: cae casi vertical, girando un poco, y queda de costado en la arena (rebote corto)
  const qFin = Quat.euler(Math.PI / 2 + 0.45, 0, 0.08), q0 = Quat.euler(Math.PI / 2 - 0.8, 0.9, 1.6);
  C.pg = C.suelto('PhysicsGun', gP, qFin, 1.05); C.pg.visible = false;
  const T_GOLPE = 31.45, CAE = 0.42;
  C.pgPaso = (t) => {
    const pg = C.pg; if (!pg) return;
    if (t < T_GOLPE - CAE) { pg.visible = false; return; }
    pg.visible = true;
    if (t < T_GOLPE) { const u = (t - (T_GOLPE - CAE)) / CAE; pg.pos.copy(vadd(gP, v3(-1.2 * (1 - u), 22 * (1 - u * u) + 0.0, 0.6 * (1 - u)))); pg.q.copy(q0.clone().slerpTo(qFin, C.suave(u))); return; }
    const e = t - T_GOLPE, reb = e < 0.32 ? Math.sin(e / 0.32 * Math.PI) * 0.09 * Math.exp(-e * 3) : 0;
    pg.pos.copy(vadd(gP, v3(0, reb, 0))); pg.q.copy(qFin.clone().mul(Quat.axis(0, 0, 1, (e < 0.32 ? Math.sin(e / 0.32 * Math.PI) * 0.12 : 0))));
  };
  // girar: de mirar al mar (yaw π/2) a mirar a la cámara (−π/2), con la cabeza que baja a mirar el arma
  C.pose = (P) => {
    const t = C.tAct || 0, k = C.suave2(C.tramo(t, 32.85, 33.6));
    const fw = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), rr = vcross(fw, v3(0, 1, 0)).norm();
    girarMundo(P, 'Neck', rr, 0.3 * k); girarMundo(P, 'Head', rr, 0.42 * k);
    girarMundo(P, 'LeftArm', fw, 0.18); girarMundo(P, 'RightArm', fw, -0.18); girarMundo(P, 'LeftForeArm', rr, -0.2); girarMundo(P, 'RightForeArm', rr, -0.2);
    P.md.sucio = true; P.md.actualizar();
  };
  C.golpe = 0;
  C.escena = (t, dt) => {
    C.tAct = t; C.mar.t = t;
    C.pgPaso(t);
    C.mar.sube = 0.07 * Math.sin(t * 2 * Math.PI / 6.5) + 0.025 * Math.sin(t * 2 * Math.PI / 2.9 + 1.0);
    C.grieta.t = t; C.grieta.pulso = 0.15 + 0.1 * Math.sin(t * 1.3);
    C.cielo(0, { dir: C.playa.dir, base: C.playa }); R.niebla.a = 245; R.niebla.b = 350;
    // el giro (el cuerpo sigue a JUG.yaw)
    const g = C.suave2(C.tramo(t, 31.95, 33.05));
    JUG.yaw = Math.PI / 2 + Math.PI * g * 0.97;
    // el golpe: arena que salta y la luz naranja del núcleo
    C.luces.length = 0;
    if (t >= 31.45) {
      if (!C.arena) {
        C.arena = true; C.golpe = 1;
        for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, el = Math.random() * 1.2; const x = C.part(vadd(gP, v3(0, 0.12, 0)), v3(Math.cos(a) * Math.cos(el) * (2 + Math.random() * 4), Math.sin(el) * (2 + Math.random() * 4), Math.sin(a) * Math.cos(el) * (2 + Math.random() * 4)), 0.25 + Math.random() * 0.4, 0.012, [0.45, 0.8, 1.0, 1], 'chispa', 0); x.fr = 1.5; x.piso = gP.y - 0.1; }
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, v = v3(Math.cos(a) * (1 + Math.random() * 3), 2 + Math.random() * 4.5, Math.sin(a) * (1 + Math.random() * 3)); const x = C.part(vadd(gP, v3(0, 0.05, 0)), v, 0.8 + Math.random() * 0.7, 0.012 + Math.random() * 0.02, [0.82, 0.68, 0.5, 1], 'gota', 0); x.piso = gP.y - 0.15; }
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283; const x = C.part(vadd(gP, v3(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15)), v3(Math.cos(a) * (0.5 + Math.random() * 1.2), 0.3 + Math.random() * 0.8, Math.sin(a) * (0.5 + Math.random() * 1.2)), 0.9 + Math.random() * 0.6, 0.12 + Math.random() * 0.14, [0.78, 0.65, 0.5, 0.3], 'humo', 2.0); x.fr = 2.2; }
      }
      const e = t - 31.45, pul = 0.75 + 0.25 * Math.sin(t * 7.0);
      if (t > 32.5) C.luces.push({ p: vadd(v3(pj.x, py, pj.z), v3(-1.2, 1.4, 0.1)), r: 3.5, c: [0.55, 0.85, 1.5].map((x) => x * C.suave(C.tramo(t, 32.5, 33.2))) });
      C.luces.push({ p: vadd(gP, v3(0, 0.3, 0)), r: 2.4, c: [0.5 * pul, 1.4 * pul, 3.4 * pul].map((x) => x * Math.min(1, e * 4 + 0.3)) });
      if (Math.random() < dt * 14) { const x = C.part(vadd(C.pg.pos, v3((Math.random() - 0.5) * 0.3, 0.08 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3)), v3(0, 0.15, 0), 0.25, 0.03, [0.35, 0.75, 1.0, 1], 'fog', 0.6); }
    }
    C.golpe = (C.golpe || 0) * Math.exp(-dt * 5);
    const sh = 0.02 * C.golpe;
    const cam = vadd(camP, v3(C.ruido(t * 29, 1) * sh, C.ruido(t * 0.5, 2) * 0.006 + C.ruido(t * 31, 3) * sh, C.ruido(t * 23, 4) * sh));
    const mira = vadd(v3(pj.x, py, pj.z), v3(6, 1.55, 0.2));
    C.camara(cam, mira, C.ruido(t * 0.4, 5) * 0.006, 40);
  };
  return 'p9 listo';
})();
