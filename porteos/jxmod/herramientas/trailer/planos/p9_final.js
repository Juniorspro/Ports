// P9 (30,86–36,92): el final, en la playa. Todo el cuerpo con captura de movimiento real (CMU).
// 9a (30,86–34,00): cámara casi en la arena, a su espalda; él mira el mar y el atardecer («parado quieto», 111_28). Desde
// el sol baja la Physics Gun como un meteoro azul, le pasa al lado de la cabeza (se agacha: «agacharse para esquivar
// algo que vuela», 77_09) y se estrella en la arena entre él y la cámara (31,45): destello, corona de arena, anillo de
// polvo, chispas, marca quemada, sacudón. Se levanta y se da vuelta («girar en el lugar», 69_16).
// 9b (34,00–36,92): cámara baja al lado del arma, que late azul en la arena; él se acerca y se agacha a agarrarla
// («levantar algo», 111_17) en cámara lenta; cuando la mano la toca, el arma se enciende. Corte a negro
(() => {
  const C = CINE, T0 = 30.86, T1 = 36.92, TG = 31.45, TB = 34.0;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta
  C.plano = { t0: T0, t1: T1, previo: 1.6 };
  const O = C.orilla, yaw = Math.PI / 2;
  const enPiso = (p) => { const y = pisoBajo(v3(p.x, p.y + 20, p.z), 60); return v3(p.x, y === null ? p.y : y, p.z); };
  const pj = enPiso(v3(O.x - 0.6, 0, O.z));
  JUG.pos.set(pj.x, pj.y + 1.0, pj.z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null; ENT.teclas.clear(); C.suaveJug = false;
  C.grietaDir(-Math.PI / 2 - 0.25, 0.40, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.42; C.grieta.abre = 1; C.grieta.brillo = 0.55;
  C.cielo(0, { dir: C.playa.dir, base: C.playa });
  C.mar.on = true;
  // dónde cae: 2,5 m detrás de él, un poco a la izquierda de la cámara (la cámara mira al mar: +x; su derecha es +z)
  const gP = enPiso(v3(pj.x - 2.5, 0, pj.z - 0.35));
  const camA = enPiso(v3(pj.x - 5.4, 0, pj.z + 0.3)); camA.y += 0.32;

  // ---- la Physics Gun ----
  // (el modelo: −X es la boca con las garras, +Z es arriba; se arma el giro con la base de destino)
  const quatBase = (ex, ey, ez) => {
    const m00 = ex.x, m10 = ex.y, m20 = ex.z, m01 = ey.x, m11 = ey.y, m21 = ey.z, m02 = ez.x, m12 = ez.y, m22 = ez.z, tr = m00 + m11 + m22;
    let x, y, z, w, k;
    if (tr > 0) { k = Math.sqrt(tr + 1) * 2; w = 0.25 * k; x = (m21 - m12) / k; y = (m02 - m20) / k; z = (m10 - m01) / k; }
    else if (m00 > m11 && m00 > m22) { k = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / k; x = 0.25 * k; y = (m01 + m10) / k; z = (m02 + m20) / k; }
    else if (m11 > m22) { k = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / k; x = (m01 + m10) / k; y = 0.25 * k; z = (m12 + m21) / k; }
    else { k = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / k; x = (m02 + m20) / k; y = (m12 + m21) / k; z = 0.25 * k; }
    return new Quat(x, y, z, w).norm();
  };
  const qBoca = (m, giro) => {   // la boca hacia m (unitario), arriba lo más cerca posible del cielo, girada 'giro' sobre su eje
    let tt = vsub(v3(0, 1, 0), vscale(m, m.y)); tt = tt.len() < 1e-4 ? v3(1, 0, 0) : tt.norm();
    if (giro) { const q = Quat.axis(m.x, m.y, m.z, giro); tt = q.rot(tt); }
    const ex = vscale(m, -1), ez = tt, ey = vcross(ez, ex).norm();
    return quatBase(ex, ey, ez);
  };
  C.caidas.length = 0; C.sueltos.length = 0;
  const S = vadd(gP, v3(30, 22, 14)), largo = vsub(S, gP).len(), vel = 55, dur = largo / vel, dVuelo = vsub(gP, S).norm();
  // clavada: la boca 50° para abajo en el rumbo del vuelo; el mango (la cola) para arriba, hacia donde él va a estar
  const hz = v3(dVuelo.x, 0, dVuelo.z).norm(), mClav = vadd(vscale(hz, Math.cos(0.87)), v3(0, -Math.sin(0.87), 0)).norm();
  const qFin = qBoca(mClav, 0.25), oPG = vadd(gP, v3(0, 0.07, 0));
  const agarre = vadd(oPG, vscale(mClav, -0.27));   // (donde la mano la toma: la cola, arriba de la arena)
  C.pg = C.suelto('PhysicsGun', oPG, qFin, 1.05); if (C.pg) C.pg.visible = false;
  const posPG = (t) => vadd(gP, vscale(vsub(S, gP), Math.max(0, (TG - t) / dur)));
  // ---- el cuerpo: tramos de captura de movimiento (cada uno con su 'girar' para que el rumbo siga igual al cambiar) ----
  const hc = (id, tc) => C.rumboCadera(id, tc), tcDe = (s, t) => s.tc0 + (t - s.t0) * s.esc;
  const s1 = { id: 'c:111_28', t0: T0 - 0.5, tc0: 0.7, esc: 1.0 };     // parado, mirando el mar (antes de t0, quieto en tc0)
  const s2 = { id: 'c:77_09', t0: 31.18, tc0: 1.75, esc: 1.6 };        // se agacha (lo más abajo ≈ 31,7) y se levanta
  const s3 = { id: 'c:69_16', t0: 32.6, tc0: 0.25, esc: 2.1 };         // se da vuelta
  s1.girar = -hc(s1.id, s1.tc0);
  s2.girar = s1.girar + hc(s1.id, tcDe(s1, s2.t0)) - hc(s2.id, s2.tc0);
  s3.girar = s2.girar + hc(s2.id, tcDe(s2, s3.t0)) - hc(s3.id, s3.tc0);
  for (const s of [s1, s2, s3]) s.fn = C.locomocion({ id: s.id, t0: s.t0, p0: pj, yaw, girar: s.girar, esc: s.esc, desde: s.tc0, hasta: s.tc0 + 4.5 * s.esc });
  // 9b: se agacha y estira la mano a la cola del arma («agacharse y levantar», 26_09, en cámara lenta). Mira al arma; se
  // lo ubica para que la mano llegue a la cola justo cuando baja a esa altura
  const s4 = { id: 'c:26_09', t0: TB, tc0: 0.25, esc: 0.48 };
  const dirG = Math.atan2(gP.x - pj.x, gP.z - pj.z);
  s4.girar = dirG - yaw - hc(s4.id, 1.2);
  let fn4 = C.locomocion({ id: s4.id, t0: s4.t0, p0: pj, yaw, girar: s4.girar, esc: s4.esc, desde: s4.tc0, hasta: 4.0 });
  const altoAgarre = agarre.y - gP.y;
  let mejor = null;
  for (const n of ['RightHand', 'LeftHand']) {
    for (let tc = 1.0; tc <= 2.7; tc += 1 / 30) {
      const t = s4.t0 + (tc - s4.tc0) / s4.esc, H = C.poseHuesos(fn4, t, [n]);
      if (H[n] && H[n].y - gP.y <= altoAgarre + 0.05) { if (!mejor || tc < mejor.tc) mejor = { n, y: H[n].y, p: H[n].clone(), t, tc }; break; }
    }
  }
  if (!mejor) { const t = s4.t0 + (2.2 - s4.tc0) / s4.esc, H = C.poseHuesos(fn4, t, ['RightHand']); mejor = { n: 'RightHand', y: H.RightHand.y, p: H.RightHand.clone(), t, tc: 2.2 }; }
  const p4 = enPiso(v3(pj.x + (agarre.x - mejor.p.x), 0, pj.z + (agarre.z - mejor.p.z)));
  fn4 = C.locomocion({ id: s4.id, t0: s4.t0, p0: p4, yaw, girar: s4.girar, esc: s4.esc, desde: s4.tc0, hasta: 4.0 });
  s4.tToca = mejor.t; s4.tcToca = mejor.tc; s4.mano = mejor.n;
  // (después de tocarla se queda ahí: el clip frena suave en vez de seguir bajando)
  s4.fn = (t) => {
    if (t <= s4.tToca) return fn4(t);
    const e = t - s4.tToca, tc = s4.tcToca + 0.05 * (1 - Math.exp(-e * 4));
    return fn4(s4.t0 + (tc - s4.tc0) / s4.esc);
  };
  C.p9 = { mano: mejor.n, tToca: +mejor.t.toFixed(3), tcToca: +mejor.tc.toFixed(3), altoMano: +(mejor.y - gP.y).toFixed(3), giros: [s1.girar, s2.girar, s3.girar, s4.girar].map((x) => +x.toFixed(3)) };
  const XF = 0.22;
  const actor = (t) => {
    if (t >= TB) { s4.fn(t); return; }
    const L = [s1, s2, s3]; let k = 0; for (let i = 0; i < L.length; i++) if (t >= L[i].t0) k = i;
    const s = L[k]; s.fn(Math.max(t, s.t0));
    if (k > 0 && t - s.t0 < XF) { const p = L[k - 1]; C.mocap.prev = { id: p.id, tc: tcDe(p, t), dyaw: p.girar - s.girar }; C.mocap.w = C.suave((t - s.t0) / XF); }
  };

  const azul = [0.45, 0.8, 1.0, 1];
  let pAnt = null;
  // el golpe: corona de arena, polvo, anillo, chispas, marca quemada
  const impacto = () => {
    const R = () => Math.random();
    for (let i = 0; i < 170; i++) {
      const a = R() * 6.283, el = 0.35 + R() * 0.95, v = 3 + R() * 9, d = v3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const x = C.part(vadd(gP, v3(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15)), vscale(d, v), 1.0 + R() * 1.1, 0.018 + R() * 0.04, [0.86, 0.72, 0.56, 1], 'gota', 0); x.piso = gP.y - 0.04;
    }
    for (let i = 0; i < 14; i++) {
      const a = R() * 6.283, x = C.part(vadd(gP, v3(Math.cos(a) * 0.3, 0.15 + R() * 0.4, Math.sin(a) * 0.3)), v3(Math.cos(a) * (1 + R() * 3.2), 0.8 + R() * 2.2, Math.sin(a) * (1 + R() * 3.2)), 1.0 + R() * 0.8, 0.25 + R() * 0.3, [0.8, 0.68, 0.56, 0.4], 'humo', 1.8); x.fr = 1.8;
    }
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * 6.283 + R() * 0.1, x = C.part(vadd(gP, v3(Math.cos(a) * 0.4, 0.08, Math.sin(a) * 0.4)), v3(Math.cos(a) * (9 + R() * 4), 0.4 + R() * 0.6, Math.sin(a) * (9 + R() * 4)), 0.7 + R() * 0.5, 0.18 + R() * 0.2, [0.84, 0.72, 0.6, 0.36], 'humo', 1.6); x.fr = 3.6;
    }
    for (let i = 0; i < 50; i++) {
      const a = R() * 6.283, el = R() * 1.3, v = 3 + R() * 6, x = C.part(vadd(gP, v3(0, 0.15, 0)), v3(Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v), 0.25 + R() * 0.5, 0.012, azul, 'chispa', 0); x.fr = 1.5; x.piso = gP.y - 0.05;
    }
    if (typeof marcaTramo === 'function') for (const [n, l0, l1, k] of [[30, 0.75, 1.0, 0.22], [26, 0.5, 0.7, 0.4], [20, 0.28, 0.42, 0.75]]) for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R() * 0.25, l = l0 + R() * (l1 - l0), d = v3(Math.cos(a), 0, Math.sin(a));
      marcaTramo(vadd(gP, vscale(d, 0.04)), vadd(gP, vscale(d, l)), v3(0, 1, 0), 0.12 + R() * 0.1, k);
    }
  };

  // al terminar de darse vuelta, la cabeza busca el arma (gira hacia ella y baja la mirada)
  C.pose = (P) => {
    const t = C.tAct || 0;
    if (t >= TB) {
      // 9b: la mano llega a la cola del arma (cinemática inversa sobre la captura, sólo el último medio segundo)
      const w = C.suave(C.tramo(t, s4.tToca - 0.6, s4.tToca - 0.02)); if (w <= 0.001) return;
      const L = s4.mano === 'LeftHand' ? 'Left' : 'Right';
      const cur = C.hueso(P, L + 'Hand'), hom = C.hueso(P, L + 'Arm'), codo = C.hueso(P, L + 'ForeArm'); if (!cur || !hom || !codo) return;
      const meta = vadd(agarre, v3(0, 0.075, 0)), wr = vadd(cur, vscale(vsub(meta, cur), w));
      C.brazo(P, L, wr, { flex: 0.35 }, v3(0, -1, 0), vsub(codo, hom));
      C.dedos(P, L, 0.6 * C.suave(C.tramo(t, s4.tToca - 0.12, s4.tToca + 0.3)));
      P.md.sucio = true; P.md.actualizar();
      return;
    }
    const k = C.suave(C.tramo(t, 33.05, 33.7)); if (k <= 0.001 || !C.mocap) return;
    const rumbo = C.act.yaw + C.rumboCadera(C.mocap.id, C.mocap.tc);
    let d = dirG - rumbo; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; d = clamp(d, -0.7, 0.7);
    const fw = v3(Math.sin(rumbo + d), 0, Math.cos(rumbo + d)), rr = vcross(fw, v3(0, 1, 0)).norm();
    girarMundo(P, 'Neck', v3(0, 1, 0), d * 0.45 * k); girarMundo(P, 'Head', v3(0, 1, 0), d * 0.4 * k);
    girarMundo(P, 'Neck', rr, 0.22 * k); girarMundo(P, 'Head', rr, 0.3 * k);
    P.md.sucio = true; P.md.actualizar();
  };
  C.golpe = 0; C.flashPG = 0;
  C.escena = (t, dt) => {
    C.tAct = t; C.mar.t = t;
    actor(t);
    C.mar.sube = 0.07 * Math.sin(t * 2 * Math.PI / 6.5) + 0.025 * Math.sin(t * 2 * Math.PI / 2.9 + 1.0);
    C.grieta.t = t; C.grieta.pulso = 0.15 + 0.1 * Math.sin(t * 1.3);
    C.cielo(0, { dir: C.playa.dir, base: C.playa }); R.niebla.a = 245; R.niebla.b = 350;
    C.luces.length = 0;
    const pg = C.pg;
    // el vuelo: dando vueltas, con estela azul (núcleo que brilla, humo, chispas) y su luz
    if (t >= TG - dur && t < TG) {
      const p = posPG(t);
      if (pg) { pg.visible = true; pg.pos.copy(p); pg.q.copy(qBoca(dVuelo, (TG - t) * 22)); }
      if (pAnt) {
        const d = vsub(p, pAnt), L = d.len(), n = Math.min(30, Math.ceil(L / 0.22));
        for (let i = 0; i < n; i++) {
          const q = vadd(pAnt, vscale(d, (i + Math.random()) / n));
          let x = C.part(q, v3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4), 0.25 + Math.random() * 0.35, 0.16 + Math.random() * 0.12, [0.4, 0.75, 1.0, 1], 'fog', 0.4); x.fr = 2;
          if (i % 2 === 0 && TG - t > 0.12) { x = C.part(q, v3((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6), 0.7 + Math.random() * 0.6, 0.1 + Math.random() * 0.08, [0.62, 0.66, 0.74, 0.3], 'humo', 2.0); x.fr = 1.5; }
          if (i % 3 === 0) { x = C.part(q, vadd(vscale(d, -2 / Math.max(dt, 1e-3) * 0.02), v3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)), 0.2 + Math.random() * 0.3, 0.01, azul, 'chispa', 0); x.fr = 1.5; }
        }
      }
      pAnt = p;
      C.luces.push({ p, r: 9, c: [1.3, 2.8, 6.0] });
    }
    if (t >= TG && !C.estrello) {
      C.estrello = true; C.golpe = 1; C.flashPG = 1;
      if (pg) { pg.visible = true; pg.pos.copy(oPG); pg.q.copy(qFin); }
      impacto();
    }
    if (t >= TG) {
      const e = t - TG;
      // el destello del golpe y el arma que late azul (más fuerte cuando él la toca)
      const toca = C.suave(C.tramo(t, s4.tToca - 0.12, s4.tToca + 0.35)), sube = C.entrada(C.tramo(t, s4.tToca, T1));
      const pul = 0.72 + 0.28 * Math.sin(t * 6.8) + 0.12 * Math.sin(t * 17.3), k = (pul * (1 + 2.5 * toca + 5 * sube));
      const kb = t < TB ? 1 : 0.45; C.luces.push({ p: vadd(gP, v3(0, 0.35, 0)), r: 3.2 + 2.0 * toca, c: [0.5 * k * kb, 1.35 * k * kb, 3.3 * k * kb] });
      if (e < 0.6) C.luces.push({ p: vadd(gP, v3(0, 0.6, 0)), r: 16, c: [3.0, 5.0, 9.0].map((x) => x * Math.exp(-e * 7)) });
      // humo y chispas del arma
      if (Math.random() < dt * (10 + 30 * toca)) { const x = C.part(vadd(gP, v3((Math.random() - 0.5) * 0.35, 0.08 + Math.random() * 0.1, (Math.random() - 0.5) * 0.35)), v3(0, 0.2 + 0.3 * toca, 0), 0.35, 0.025 + 0.015 * toca, [0.35, 0.75, 1.0, 1], 'fog', 0.5); }
      if (Math.random() < dt * (3 + 40 * toca)) { const a = Math.random() * 6.283, x = C.part(vadd(gP, v3(0, 0.12, 0)), v3(Math.cos(a) * (0.6 + Math.random() * 2), 0.8 + Math.random() * 2.2, Math.sin(a) * (0.6 + Math.random() * 2)), 0.25 + Math.random() * 0.3, 0.008, azul, 'chispa', 0); x.fr = 1.6; x.piso = gP.y - 0.05; }
      if (e < 2.5 && Math.random() < dt * 6) { const x = C.part(vadd(gP, v3((Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6)), v3((Math.random() - 0.5) * 0.4, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4), 1.4 + Math.random(), 0.25 + Math.random() * 0.25, [0.6, 0.6, 0.66, 0.3], 'humo', 2.2); x.fr = 1; }
    }
    C.golpe = (C.golpe || 0) * Math.exp(-dt * 4.2);
    const g = C.golpe, sh = 0.05 * g;
    if (t < TB) {
      // 9a: a su espalda, casi en la arena; se acerca despacio
      const u = C.suave(C.tramo(t, T0, TB));
      const cam = vadd(camA, v3(0.55 * u + C.ruido(t * 29, 1) * sh, C.ruido(t * 0.5, 2) * 0.006 + C.ruido(t * 31, 3) * sh, C.ruido(t * 23, 4) * sh));
      const mira = vadd(pj, v3(6, 1.45 - 0.15 * u, 0.15));
      C.camara(cam, vadd(mira, v3(0, C.ruido(t * 19, 5) * g * 0.35, C.ruido(t * 17, 6) * g * 0.35)), C.ruido(t * 0.4, 7) * 0.006 + C.ruido(t * 13, 8) * g * 0.04, 40);
    } else {
      // 9b: baja, al lado del arma, mirando hacia él (detrás, el mar y el atardecer); se acerca despacio al arma
      const u = C.suave(C.tramo(t, TB, T1));
      const ej = vsub(p4, gP); ej.y = 0; ej.norm(); const lado = v3(-ej.z, 0, ej.x);
      const cam = vadd(gP, vadd(vscale(ej, -1.55 + 0.35 * u), vadd(vscale(lado, 1.15 - 0.2 * u), v3(0, 0.36 - 0.06 * u, 0))));
      const b = v3(JUG.pos.x, JUG.pos.y - 1.0, JUG.pos.z);
      const mira = vadd(vadd(vscale(gP, 0.5), vscale(b, 0.5)), v3(0, 0.78 - 0.3 * u, 0));
      C.camara(vadd(cam, v3(C.ruido(t * 0.7, 9) * 0.008, C.ruido(t * 0.6, 10) * 0.006, 0)), mira, C.ruido(t * 0.4, 11) * 0.008, 34);
    }
  };
  return 'p9 listo ' + JSON.stringify(C.p9);
})();
