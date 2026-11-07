// P1 (2,06–9,16): primera persona en el desierto. Levanta las manos y se las mira (un brillo azul late adentro, con los
// golpes de la canción); un trueno sordo lo hace mirar arriba y el cielo se raja: la grieta se abre a golpes
(() => {
  const C = CINE, T0 = 2.06, T1 = 9.16;
  C.plano = { t0: T0, t1: T1, previo: 2.0 };
  const X = -150, Z = -120, yaw = -Math.PI / 2;
  const piso = pisoBajo(v3(X, 0, Z), 300);
  JUG.pos.set(X, piso + 1.0, Z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.pitch = 0; JUG.tercera = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = JUG.cuerpo;
  // (la sombra del propio cuerpo, con el sol bajo y tan cerca de la cámara, salía con muaré: sin sombra en este plano)
  if (JUG.cuerpo && JUG.cuerpo.md) JUG.cuerpo.md.sinSombra = true;
  const az = yaw, el = 0.62; const cG = C.grietaDir(az, el, 0.15);
  C.grieta.on = true; C.grieta.abre = 0; C.grieta.tam = 0.78;
  const golpesManos = [[3.24, 1], [4.82, 0.7], [5.21, 1], [6.0, 0.5]];
  const golpesGrieta = [[6.40, 1.4], [7.19, 1.0], [7.98, 1.0], [9.16, 1.0], [9.55, 0.7]];
  C.manos = { k: 0, giro: 0, tiembla: 0 };
  // la luz de la tarde: sol bajo de costado (de la izquierda y un poco de atrás), cálido; cielo más profundo
  C.tarde = { dir: v3(0.55, 0.42, -0.72).norm(), solCol: [1.0, 0.80, 0.58], ambS: [0.46, 0.52, 0.66], ambG: [0.42, 0.36, 0.30], top: [0.20, 0.42, 0.78], mid: [0.95, 0.83, 0.70], bot: [0.62, 0.55, 0.50], sol: [1.0, 0.72, 0.45], niebla: [0.93, 0.82, 0.68] };
  // la pose: muñecas delante de los ojos, palmas que giran hacia arriba
  C.pose = (P) => {
    const M = C.manos; if (M.k <= 0.002) return;
    const h = C.hueso(P, 'Head'); if (!h) return;
    const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), up = v3(0, 1, 0), r = vcross(f, up).norm();
    const ojo = vadd(h, vadd(vscale(f, 0.09), vscale(up, 0.05)));
    C.palmas = [];
    for (const s of [1, -1]) {
      const L = s > 0 ? 'Right' : 'Left', tt = C.tAct || 0;
      const tr = M.tiembla * 0.0035, jx = C.ruido(tt * 9, s * 3) * tr, jy = C.ruido(tt * 11, s * 5 + 1) * tr;
      const baja = 1 - M.k;
      const w = vadd(ojo, vadd(vscale(f, 0.36), vadd(vscale(up, -0.31 - baja * 0.5 + jy), vscale(r, s * 0.125 + jx))));
      // palma: de mirar al piso (se ve el dorso) a mirar a los ojos
      const aOjo = vsub(ojo, w).norm(), abajo = vadd(vscale(up, -1), vscale(r, s * 0.2)).norm();
      const nT = vadd(vscale(abajo, 1 - M.giro), vscale(aOjo, M.giro + 0.03)).norm();
      const polo = vadd(vscale(up, -0.85), vscale(r, s * 0.55)).norm();
      C.brazo(P, L, w, { flex: -0.1 }, nT, polo);
      C.palmas.push({ w, n: nT });
    }
  };
  // chispas azules que salen de las palmas
  const chispas = (P, k, dt) => {
    if (k < 0.02) return;
    const hx = huesosMixamo(P.D), md = P.md;
    for (const L of ['Right', 'Left']) for (const D of ['Index', 'Middle', 'Ring', 'Thumb']) {
      const i = hx[L + 'Hand' + D + '2']; if (i === undefined) continue;
      if (Math.random() > k * dt * 10) continue;
      const p = celmPos(md, i), q = particula(vadd(p, v3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02)), v3((Math.random() - 0.5) * 0.05, 0.06 + Math.random() * 0.05, (Math.random() - 0.5) * 0.05), 0.35 + Math.random() * 0.3, 0.003 + 0.004 * k, [0.3, 0.7, 1.0, 1], 'fog', 0.3);
      if (q) { q.fr = 2; }
    }
  };
  C.escena = (t, dt) => {
    C.tAct = t;
    const P = JUG.cuerpo;
    // manos: suben 2,15–3,3; giran las palmas 3,4–5,4; tiemblan más y más; bajan al mirar arriba (6,0–6,45)
    C.manos.k = C.suave2(C.tramo(t, 2.15, 3.35)) * (1 - C.suave2(C.tramo(t, 6.0, 6.5)));
    C.manos.giro = C.suave2(C.tramo(t, 3.35, 5.5));
    C.manos.tiembla = 0.4 + 1.6 * C.tramo(t, 3.0, 5.8) + 2.5 * C.pulsos(t, golpesManos, 0.25);
    // brillo en las manos
    const pm = C.pulsos(t, golpesManos, 0.32), bri = C.manos.k * (0.15 + 0.85 * C.tramo(t, 3.1, 5.8)) * (0.35 + 1.4 * pm);
    const h = P ? C.hueso(P, 'Head') : null;
    C.luces.length = 0;
    if (C.palmas && bri > 0.01) for (const pa of C.palmas) C.luces.push({ p: vadd(pa.w, vadd(vscale(pa.n, 0.07), v3(0, 0.02, 0))), r: 0.45, c: [0.35 * bri * 1.6, 0.9 * bri * 1.6, 2.8 * bri * 1.6] });
    if (P) chispas(P, bri, dt);
    // la grieta: aparece en 6,40 y se abre a golpes
    const ab = C.claves(t, [[6.38, 0], [6.55, 0.2], [7.17, 0.24], [7.4, 0.46], [7.96, 0.5], [8.25, 0.72], [9.14, 0.76], [9.4, 0.88]], C.salida);
    C.grieta.abre = ab; C.grieta.t = t; C.grieta.pulso = C.pulsos(t, golpesGrieta, 0.3);
    C.grieta.brillo = 1 + 1.5 * C.pulsos(t, [[6.40, 1]], 0.12);
    // el cielo se vuelve violeta
    const k = 0.9 * C.suave(C.tramo(t, 6.42, 8.8));
    const d = vadd(vscale(C.tarde.dir, 1 - k), vscale(cG, k)).norm();
    C.cielo(k, { dir: d, base: C.tarde });
    // cámara en los ojos: mira las manos y después arriba
    if (h) {
      const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), up = v3(0, 1, 0);
      const ojo = vadd(h, vadd(vscale(f, 0.09), vscale(up, 0.05)));
      const pit = C.claves(t, [[2.0, 0.62], [3.4, 0.46], [5.6, 0.40], [6.0, 0.40], [6.42, -0.40], [7.3, -0.47], [9.2, -0.44]], C.suave2);
      const yw = yaw + C.claves(t, [[2.0, 0.0], [6.0, 0.0], [6.42, 0.04], [9.2, 0.0]]) + C.ruido(t * 0.6, 1) * 0.012;
      const temb = 0.004 + 0.01 * C.pulsos(t, golpesGrieta, 0.25);
      const q = Quat.euler(yw + C.ruido(t * 7, 2) * temb, pit + C.ruido(t * 0.7, 3) * 0.01 + C.ruido(t * 8, 4) * temb, C.ruido(t * 0.5, 5) * 0.012);
      C.camaraQ(ojo, q, 52);
    }
  };
  return 'p1 listo';
})();
