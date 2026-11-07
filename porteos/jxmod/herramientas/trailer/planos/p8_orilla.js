// P8 (26,60–30,86): la playa. Desde el agua, mirando a la costa: él llega caminando, exhausto, y se para en la orilla;
// el sol del atardecer le da de frente; detrás, tierra adentro, la grieta lejana. «Acá no llegan…»
(() => {
  const C = CINE, T0 = 26.60, T1 = 30.86;
  C.aspK = 1.343;   // 4:3: la franja del medio del panorámico, más alta (misma nitidez por píxel; más cielo y más piso)
  C.plano = { t0: T0, t1: T1, previo: 1.6 };
  const O = C.orilla, yaw = Math.PI / 2, f = v3(1, 0, 0), up = v3(0, 1, 0), r = vcross(f, up).norm();
  // arranca 4,5 m tierra adentro y camina hasta la orilla
  const ini = v3(O.x - 4.9, 0, O.z), pi = pisoBajo(v3(ini.x, 0, ini.z), 300);
  JUG.pos.set(ini.x, pi + 1.0, ini.z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null;
  ENT.teclas.clear();
  // caminata cansada, encorvado: captura de movimiento real (CMU 105_26, «caminar con dolor de panza», mira para atrás en
  // el clip); en la toma B ya está parado en la orilla: «parado quieto» real (CMU 111_28, con su peso que va y viene)
  C.suaveJug = false;
  const camina = C.locomocion({ id: 'c:105_26', t0: T0 - 1.6, p0: v3(ini.x + 0.8, pi, ini.z), yaw, girar: Math.PI, esc: 1.0, desde: 0.7, hasta: 0.7 + (28.6 - T0 + 1.9) });
  const pp = v3(O.x - 0.6, 0, O.z); pp.y = pisoBajo(v3(pp.x, 0, pp.z), 300);
  const parado = C.locomocion({ id: 'c:111_28', t0: 28.55, p0: pp, yaw, girar: Math.PI / 2, esc: 1.0, desde: 1.2, hasta: 6.0 });
  C.grietaDir(-Math.PI / 2 - 0.25, 0.40, 0.15);
  C.grieta.on = true; C.grieta.tam = 0.42; C.grieta.abre = 1; C.grieta.brillo = 0.55;
  C.cielo(0, { dir: C.playa.dir, base: C.playa });
  C.mar.on = true;
  // la cara: con el sol del atardecer de frente, la piel (una textura rojiza) se iba a un rojo saturado (tono 4–6°);
  // un tinte sólo en el material de la cabeza la deja marrón cálida (tono 17–20°) y la armadura queda igual
  const iCara = DATA.mt.findIndex((d) => d && d.n === 'Mat_SpecialForces_01_M_Head');
  if (iCara >= 0) matGL(iCara).c = [0.72, 1.08, 1.08, 1];
  // respira agitado: el pecho y los hombros suben y bajan, la cabeza un poco gacha
  C.pose = (P) => {
    const t = C.tAct || 0, k = C.tramo(t, 28.45, 28.6), fr = 2 * Math.PI * 0.62, s = Math.sin(t * fr);
    const fw = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), rr = vcross(fw, v3(0, 1, 0)).norm();
    girarMundo(P, 'Spine2', rr, (-0.04 + s * 0.035) * k); girarMundo(P, 'Neck', rr, 0.12 * k); girarMundo(P, 'Head', rr, (0.1 + s * 0.02) * k);
        P.md.sucio = true; P.md.actualizar();
  };
  C.escena = (t, dt) => {
    C.tAct = t; C.mar.t = t;
    if (t < 28.55 && camina) camina(t); else if (parado) parado(t);
    // la ola: el agua sube y baja en la orilla (cada 6,5 s)
    C.mar.sube = 0.07 * Math.sin(t * 2 * Math.PI / 6.5) + 0.025 * Math.sin(t * 2 * Math.PI / 2.9 + 1.0);
    C.grieta.t = t; C.grieta.pulso = 0.15 + 0.1 * Math.sin(t * 1.3);
    C.cielo(0, { dir: C.playa.dir, base: C.playa }); R.niebla.a = 245; R.niebla.b = 350;
    C.luces.length = 0;
    const b = v3(JUG.pos.x, JUG.pos.y - 0.95, JUG.pos.z);
    if (t < 28.55) {
      // toma A: de costado y baja, teleobjetivo; él entra caminando hacia el agua (de izquierda a derecha); detrás, el mar
      const u = C.tramo(t, T0, 28.55);
      const cam = vadd(v3(O.x - 3.2, 0, O.z), vadd(vscale(r, 11.5), v3(0, 0, 0)));
      cam.y = pisoBajo(v3(cam.x, 0, cam.z), 300) + 0.85 + C.ruido(t * 0.6, 2) * 0.02;
      const mira = v3(b.x + 0.4 + 0.6 * u, b.y + 1.0, b.z);
      C.camara(vadd(cam, v3(0.6 * u, 0, 0)), mira, C.ruido(t * 0.4, 3) * 0.006, 24);
    } else {
      // toma B: de frente, desde el agua, cerca: la cara con el sol del atardecer; se acerca despacio
      const u = C.suave(C.tramo(t, 28.55, T1));
      const cam = vadd(v3(O.x, 9.5, O.z), vadd(vscale(f, 9.5 - 1.6 * u), vadd(vscale(r, 0.9 - 0.3 * u), v3(C.ruido(t * 0.5, 1) * 0.03, 0.32 + C.ruido(t * 0.6, 2) * 0.02, 0))));
      const mira = vadd(b, v3(0, 1.2, 0));
      C.camara(cam, mira, C.ruido(t * 0.4, 3) * 0.008, 28);
    }
  };
  return 'p8 listo';
})();
