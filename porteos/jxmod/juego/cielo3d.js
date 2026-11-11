// ---------------- el cielo 3D de los mapas de GMod (sky_camera) ----------------
// En Source el fondo de un mapa es una sala aparte con el paisaje en miniatura (montañas, islas, nubes) que el motor dibuja
// detrás de todo, agrandado (scale, casi siempre 16) y mirado desde la cámara del cielo más lo que se movió el jugador
// dividido por la escala (así lo lejano casi no se corre). Acá igual: primero el cielo 2D (el cubo), encima la maqueta
// vista desde la cámara del cielo (con su niebla) y después se borra la profundidad, así el mapa queda siempre adelante.
// Las piezas de la maqueta se encolan sólo para esta pasada (no entran en las sombras, el reflejo del agua ni las puertas).
function cielo3dDibujar(fovy, asp) {
  const C = MUNDO.cielo3d; if (!C || !C.modelos.length || AGUA.bajo || Q.get('sinCielo3d')) return false;
  const gl = R.gl, k = 1 / C.s, cp = v3(C.o.x + R.camPos.x * k, C.o.y + R.camPos.y * k, C.o.z + R.camPos.z * k);
  // el cielo 2D de fondo, en toda la pantalla (la profundidad recién borrada: pasa en todos lados)
  dibujarCielo(M4.inv(R.vp));
  const Ps = M4.persp(fovy, asp, 0.02, C.lejos), Vs = M4.view(cp, CAM.qVista); m4mul(Ps, Vs, C.VP);
  const F = frustum(C.VP), n0 = R.nItems, fase = R.fase; R.fase = 'cielo';
  for (const m of C.modelos) m.encolar();
  R.fase = fase;
  const L = C.cola, LT = C.colaT; L.length = 0; LT.length = 0;
  for (let i = n0; i < R.nItems; i++) {
    const p = R.items[i]; if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    const dx = p.cx - cp.x, dy = p.cy - cp.y, dz = p.cz - cp.z; p.z = -(dx * dx + dy * dy + dz * dz);
    (p.mt.blend ? LT : L).push(p);
  }
  L.sort(ordenOpaco); LT.sort((a, b) => a.z - b.z);
  if (L.length || LT.length) {
    const vp0 = C.vp0 || (C.vp0 = new Float32Array(16)); vp0.set(R.vp); const cam0 = R.camPos.clone(), fr0 = R.fr, nie0 = R.niebla, nieC0 = R.lin ? R.lin.nieC : null;
    R.vp.set(C.VP); R.camPos.copy(cp); R.fr = F; R.marca++;
    R.niebla = C.fog ? { c: C.fog.c, a: C.fog.a, b: C.fog.b, m: C.fog.m } : { c: nie0.c, a: 1e6, b: 2e6 };
    if (R.lin && C.fog) R.lin.nieC = C.fog.cLin;
    const cola = R.cola, colaT = R.colaT; R.cola = L; R.colaT = LT; dibujarOpacos(); dibujarTransparentes(); R.cola = cola; R.colaT = colaT;
    R.vp.set(vp0); R.camPos.copy(cam0); R.fr = fr0; R.niebla = nie0; if (R.lin && nieC0) R.lin.nieC = nieC0; R.marca++;
  }
  // (las piezas de la maqueta salen de la lista: lo que viene después no las ve)
  for (let i = n0; i < R.nItems; i++) { const p = R.items[i]; p.M = null; p.h = null; p.x = null; }
  R.nItems = n0;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  return true;
}
