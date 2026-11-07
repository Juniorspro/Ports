// P2 (9,16–12,31): plano abierto y bajo, desde atrás: él chiquito, parado mirando arriba; la grieta enorme ocupa el
// cielo y late con la voz («Te encontramos»). La cámara se acerca despacio y sube apenas
(() => {
  const C = CINE, T0 = 9.16, T1 = 12.31;
  C.plano = { t0: T0, t1: T1, previo: 1.5 };
  const X = -150, Z = -120, yaw = -Math.PI / 2;
  const piso = pisoBajo(v3(X, 0, Z), 300);
  JUG.pos.set(X, piso + 1.0, Z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.pitch = 0; JUG.tercera = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.luces.length = 0;
  const cG = C.grietaDir(yaw, 0.62, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.78;
  C.tarde = C.tarde || { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  const voz = [[10.42, 0.9], [10.78, 0.7], [11.12, 1.0], [11.5, 0.8]];
  // la cabeza mira la grieta (cuello y cabeza hacia arriba) y los hombros caídos
  C.pose = (P) => {
    const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = vcross(f, v3(0, 1, 0)).norm();
    girarMundo(P, 'Neck', r, 0.22); girarMundo(P, 'Head', r, 0.3);
    P.md.sucio = true; P.md.actualizar();
  };
  C.escena = (t, dt) => {
    C.tAct = t;
    const ab = C.claves(t, [[9.0, 0.86], [9.16, 0.88], [9.55, 0.93], [12.4, 1.0]], C.salida);
    C.grieta.abre = ab; C.grieta.t = t; C.grieta.pulso = Math.max(C.pulsos(t, [[9.16, 0.9], [9.55, 0.7]], 0.3), C.pulsos(t, voz, 0.22) * 1.2);
    C.grieta.brillo = 1;
    const k = 0.9;
    C.cielo(k, { dir: vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm(), base: C.tarde });
    // cámara: baja, atrás y a la derecha de él; se acerca y sube un poco
    const P = JUG.cuerpo, base = v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z);
    const f = v3(Math.sin(yaw), 0, Math.cos(yaw)), r = vcross(f, v3(0, 1, 0)).norm();
    const u = C.suave(C.tramo(t, T0, T1));
    const atras = 15 - 4.5 * u, lado = 2.4 - 0.6 * u, alto = 0.45 + 0.35 * u;
    let cam = vadd(base, vadd(vscale(f, -atras), vscale(r, lado)));
    const pisoC = pisoBajo(v3(cam.x, base.y + 5, cam.z), 20); cam.y = (pisoC === null ? base.y : pisoC) + alto;
    const mira = vadd(base, vadd(vscale(f, 25), v3(0, 12.5 + 1.5 * u, 0)));
    const temb = 0.002 + 0.006 * C.grieta.pulso;
    C.camara(vadd(cam, v3(C.ruido(t * 0.8, 1) * 0.03, C.ruido(t * 0.9, 2) * 0.02, 0)), vadd(mira, v3(C.ruido(t * 6, 3) * temb * 25, C.ruido(t * 7, 4) * temb * 25, 0)), C.ruido(t * 0.4, 5) * 0.01, 46);
  };
  return 'p2 listo';
})();
