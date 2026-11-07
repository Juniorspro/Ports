// ver clips de captura de movimiento con el personaje del tráiler: cada clip en una franja de 10 s del tiempo del
// "tráiler" (t = 100 + 10·i + tc), cámara de tres cuartos a 3,6 m. La lista la pone window.__VER = [[id, dur], ...]
(() => {
  const C = CINE, L = window.__VER || [];
  C.plano = { t0: 100, t1: 100 + 10 * L.length, previo: 1.0 };
  const X = -90, Z = -95, piso = pisoBajo(v3(X, 0, Z), 300);
  JUG.pos.set(X, piso + 1.0, Z); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0; JUG.tercera = true; JUEGO.dios = true;
  elegirArma(ARM.lista.indexOf('Hands'));
  C.sinVista = true; C.sinCabeza = null; C.pose = null; C.suaveJug = false; ENT.teclas.clear();
  C.grieta.on = false;
  C.escena = (t) => {
    const i = Math.max(0, Math.min(L.length - 1, Math.floor((t - 100) / 10))), tc = Math.max(0, t - 100 - 10 * i);
    const p = v3(X, piso, Z);
    C.mocap = { id: 'c:' + L[i][0], tc }; C.actPoner(p, L[i][2] || 0); C.act.suelo = piso;
    const cam = v3(X + 2.6, piso + 1.25, Z + 2.5);
    C.camara(cam, v3(X, piso + 0.95, Z), 0, 42);
  };
  return 'ver ' + L.length;
})();
