// FOTO: motor de las fotos de fondo (menú y pantalla de carga). Se evalúa dentro del juego (window.__ev) una sola vez.
// El tiempo lo maneja este motor (sin requestAnimationFrame): la escena se arma, se avanza de a 1/60 s sin dibujar
// hasta el instante pedido y se dibuja varias veces corrida una fracción de píxel (puntos de Halton) para suavizar los
// bordes; las pasadas se promedian en un lienzo. Sin arma en la mano, sin temblor de cámara; la interfaz es HTML y no sale.
(() => {
  const F = window.FOTO = window.FOTO || {};
  if (F.listo) return 'ya';
  F.listo = true;
  Object.assign(F, { saltar: false, sinVista: true, jx: 0, jy: 0, fov: 0, objs: [], gente: [] });
  F.rafOrig = window.__rafOrig || window.requestAnimationFrame;
  const dib = dibujar; dibujar = function () { if (F.saltar) return; dib(); };
  const vis = dibujarVista; dibujarVista = function () { return F.sinVista ? false : vis(); };
  const persp = M4.persp;
  M4.persp = function (f, a, n, l) { const P = persp.call(M4, f, a, n, l); if (F.jx || F.jy) { P[8] -= F.jx * 2 / R.cv.width; P[9] -= F.jy * 2 / R.cv.height; } return P; };
  // (las estelas van más juntas que en el juego —GFX.part alto— para que se vean llenas en una foto quieta, pero las
  // explosiones con la cantidad del juego en Ultra: con 3,5 veces más partículas el destello era una cúpula blanca)
  const efx = efectoExplosion;
  efectoExplosion = function (p, esc) { const q = GFX.part; GFX.part = Math.min(q, F.partExpl || 1); try { return efx(p, esc); } finally { GFX.part = q; } };
  const camA = camaraActualizar;
  camaraActualizar = function (dt) { CAM.temblor = 0; camA(dt); if (F.fov) CAM.fov = F.fov; };
  // el tiempo: parado (lo avanza el motor) o andando solo (para cargar un mapa)
  F.parar = () => { window.requestAnimationFrame = () => 0; F.T = (TIEMPO.ult || performance.now() / 1000) * 1000; };
  F.andar = () => { window.requestAnimationFrame = F.rafOrig; TIEMPO.ult = performance.now() / 1000; F.rafOrig.call(window, cuadro); };
  // (sin dibujar, la gente de la escena igual se anima: el juego anima a cada uno al dibujarlo)
  F.paso = (dt, conDibujo) => {
    F.T += dt * 1000; F.saltar = !conDibujo; if (JUG.cuerpo) JUG.cuerpo.visible = false;
    try { cuadro(F.T); } finally { F.saltar = false; }
    if (!conDibujo && dt > 0) for (const P of F.gente) if (!P.borrado) animarPersona(P, dt);
  };
  F.avanzar = (s) => { const n = Math.max(0, Math.round(s * 60)); for (let i = 0; i < n; i++) F.paso(1 / 60, false); return n; };
  const hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  // la foto: n pasadas sin avanzar el tiempo (sólo el corrimiento de subpíxel), promediadas
  F.foto = (n) => {
    const W = R.cv.width, H = R.cv.height;
    if (!F.acc || F.acc.width !== W || F.acc.height !== H) { F.acc = document.createElement('canvas'); F.acc.width = W; F.acc.height = H; }
    const ctx = F.acc.getContext('2d');
    for (let i = 0; i < n; i++) {
      F.jx = n > 1 ? hal(i + 1, 2) - 0.5 : 0; F.jy = n > 1 ? hal(i + 1, 3) - 0.5 : 0;
      F.paso(0, true); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(R.cv, 0, 0);
    }
    F.jx = F.jy = 0; ctx.globalAlpha = 1;
    return F.acc.toDataURL('image/png');
  };
  // la cámara: posición y hacia dónde mira (guiñada y cabeceo, en radianes; cabeceo negativo = arriba)
  F.camara = (p, yaw, pitch, fov) => { DBG.cam = F.ultCam = { p: v3(p[0], p[1], p[2]), q: Quat.euler(yaw, pitch) }; if (fov) F.fov = fov; };
  // dónde cae en la pantalla (0..1 desde arriba a la izquierda) una dirección vista desde la cámara de DBG.cam
  F.enPantalla = (d) => {
    const q = (DBG.cam || F.ultCam).q, f = q.rot(v3(0, 0, 1)), der = vscale(q.rot(v3(1, 0, 0)), -1), arr = q.rot(v3(0, 1, 0)), z = vdot(d, f);
    if (z <= 1e-6) return null;
    const th = Math.tan((F.fov || CAM.fov) * Math.PI / 360), a = R.cv.width / R.cv.height;
    return [0.5 + 0.5 * vdot(d, der) / z / (th * a), 0.5 - 0.5 * vdot(d, arr) / z / th];
  };
  // la guiñada y el cabeceo para que la dirección d quede en (sx, sy) de la pantalla (unas vueltas de Newton)
  F.apuntar = (p, d, sx, sy, fov) => {
    let yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(clamp(d.y, -1, 1));
    for (let k = 0; k < 30; k++) {
      F.camara(p, yaw, pitch, fov); const s = F.enPantalla(d); if (!s) break;
      const ex = s[0] - sx, ey = s[1] - sy; if (Math.abs(ex) < 1e-4 && Math.abs(ey) < 1e-4) break;
      const h = 1e-3; F.camara(p, yaw + h, pitch, fov); const sa = F.enPantalla(d); F.camara(p, yaw, pitch + h, fov); const sb = F.enPantalla(d);
      const j11 = (sa[0] - s[0]) / h, j21 = (sa[1] - s[1]) / h, j12 = (sb[0] - s[0]) / h, j22 = (sb[1] - s[1]) / h, det = j11 * j22 - j12 * j21;
      if (Math.abs(det) < 1e-9) break;
      yaw -= (j22 * ex - j12 * ey) / det; pitch -= (-j21 * ex + j11 * ey) / det;
    }
    F.camara(p, yaw, pitch, fov); return { yaw, pitch };
  };
  // el piso debajo de (x, z): la altura del primer choque desde arriba
  F.piso = (x, z, desde) => { const y0 = desde !== undefined ? desde : 300; const h = mundoRayo(v3(x, y0, z), v3(0, -1, 0), y0 + 400); return h ? y0 - h.t : null; };
  // objetos quietos (congelados) apoyados en el piso
  F.poner = (nombre, x, z, yaw, opt) => {
    const y = F.piso(x, z, opt && opt.desde); if (y === null) return null;
    const o = crearObjeto(nombre, v3(x, y, z), Quat.euler(yaw || 0, (opt && opt.pitch) || 0, (opt && opt.roll) || 0), { congelado: !(opt && opt.suelto) });
    if (o) F.objs.push(o); return o;
  };
  // gente: un personaje parado, caminando o corriendo en el lugar (la animación sale de la velocidad), mirando a mira
  F.persona = (skin, x, z, yaw, opt) => {
    opt = opt || {}; const y = F.piso(x, z, opt.desde); if (y === null) return null;
    const P = crearPersona(skin, 'HatEmpty', { nombre: '' });
    P.pos.set(x, y + 0.96, z); P.yaw = yaw || 0; P.suelo = true; P.mira = opt.mira || 0; P.arma = opt.arma || null;
    const v = opt.vel || 0; P.vel.set(Math.sin(P.yaw) * v, 0, Math.cos(P.yaw) * v); P.fijo = true;
    F.gente.push(P); return P;
  };
  // el azar de la escena, con semilla (la misma escena sale igual cada vez)
  F.rndOrig = F.rndOrig || Math.random;
  F.semilla = (k) => { let s = (k | 0) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  F.sinSemilla = () => { Math.random = F.rndOrig; };
  // la escena: S = { hora, semilla, cam: { p | [adelante, lado] desde la aparición, alto, grieta: [sx, sy] | yaw/pitch, fov },
  // props: [[nombre, adelante, lado, giro]], gente: [[skin, adelante, lado, giro, { vel, mira, arma }]],
  // caidas: [[nombre, adelante, lado, fracción del vuelo en la foto, explosión]] } — adelante/lado en metros desde la cámara
  // (lado: a la derecha de la pantalla); giro relativo a la cámara (0: mirando hacia donde mira la cámara)
  F.armar = (S) => {
    // (la hora primero, y la grieta se vuelve a ubicar con el sol de esa hora, como si se entrara al mapa a esa hora)
    DIA.ciclo = false; DIA.hora = S.hora !== undefined ? S.hora : 12; DIA.aplicada = -1; diaAplicar(); GFX.part = S.part || 3.5;
    if (typeof eventoIniciar === 'function') eventoIniciar();
    F.limpiar(); F.faltan = []; F.semilla(S.semilla || 1);
    const c = S.cam || {}, fov = c.fov || 60;
    // (desde la primera aparición del mapa, no desde donde apareció el jugador, que se elige al azar: la foto sale siempre igual)
    const s0 = MUNDO.spawns && MUNDO.spawns[0], base = s0 && s0.x !== undefined ? v3(s0.x, s0.y + 1.2, s0.z) : JUG.pos.clone();
    // (la posición de la cámara: la aparición corrida en el rumbo de la grieta, o una posición dada)
    let cp;
    if (c.p) cp = v3(c.p[0], c.p[1], c.p[2]);
    else {
      const az = Math.atan2(EVT.dir.x, EVT.dir.z), f0 = v3(Math.sin(az), 0, Math.cos(az)), r0 = v3(-Math.cos(az), 0, Math.sin(az)), o = c.o || [0, 0];
      const x = base.x + f0.x * o[0] + r0.x * o[1], z = base.z + f0.z * o[0] + r0.z * o[1], y = F.piso(x, z, base.y + 40);
      cp = v3(x, (y === null ? base.y - 1 : y) + (c.alto || 1.6), z);
    }
    // primera persona: el jugador parado ahí con el arma en la mano (los ojos donde va la cámara)
    const pri = S.primera;
    if (pri) { const dy0 = JUG.pos.y - (F.piso(JUG.pos.x, JUG.pos.z, JUG.pos.y + 5) ?? JUG.pos.y - 1), eo = (JUG.ojoPos ? JUG.ojoPos.y - JUG.pos.y : 0.64); cp.y = cp.y - (c.alto || 1.6) + dy0 + eo; F.pri = { dy0, eo }; }
    let yaw, pitch;
    if (c.grieta && EVT.grieta) ({ yaw, pitch } = F.apuntar([cp.x, cp.y, cp.z], EVT.dir, c.grieta[0], c.grieta[1], fov));
    else { const s0 = MUNDO.spawns && MUNDO.spawns[0]; yaw = c.yaw !== undefined ? c.yaw : ((s0 && s0.yaw !== undefined ? s0.yaw : JUG.yaw) + (c.yawRel || 0)); pitch = c.pitch || 0; F.camara([cp.x, cp.y, cp.z], yaw, pitch, fov); }
    if (pri) {
      DBG.cam = null; F.sinVista = false; JUG.vel.set(0, 0, 0); JUG.pos.set(cp.x, cp.y - F.pri.eo, cp.z); JUG.yaw = yaw; JUG.pitch = pitch;
      const k = ARM.lista.indexOf(pri.arma || 'PhysicsGun'); if (k >= 0 && ARM.i !== k) elegirArma(k);
    } else F.sinVista = true;
    F.yaw = yaw; F.cp = cp;
    const fw = v3(Math.sin(yaw), 0, Math.cos(yaw)), dr = v3(-Math.cos(yaw), 0, Math.sin(yaw));
    const en = (a, b) => [cp.x + fw.x * a + dr.x * b, cp.z + fw.z * a + dr.z * b];
    const alto = cp.y + 30;
    for (const [n, a, b, g, o] of S.props || []) { const [x, z] = en(a, b); if (!F.poner(n, x, z, yaw + (g || 0), Object.assign({ desde: alto }, o || {}))) F.faltan = (F.faltan || []).concat(n); }
    for (const [n, a, b, g, o] of S.gente || []) { const [x, z] = en(a, b); F.persona(n, x, z, yaw + (g || 0), Object.assign({ desde: alto }, o || {})); }
    // lo que cae: sale de la grieta (desde lejos, en su dirección) y llega al piso en (adelante, lado); en la foto va por la
    // fracción f de su vuelo (más de 1: ya cayó, ardiendo o recién explotado)
    // (de la grieta pero no de su fondo: desde un punto en su dirección a 1,7 veces la distancia a la que cae, así cruza el
    // cielo en diagonal con su estela a la vista; el tiempo, el de caer esa altura —casi tirada de costado desde la grieta—)
    const L = [], C = [];
    for (const [n, a, b, f, ex, o] of S.caidas || []) {
      const [x, z] = en(a, b), y = F.piso(x, z, alto); if (y === null) continue;
      const K = clamp(Math.hypot(a, b) * (S.desdeK || 1.7), 55, 200), u = (Math.random() - 0.5) * 2 * (S.abre || 0.04) * K, w = (Math.random() - 0.5) * 2 * (S.abre || 0.04) * K;
      const d = vadd(vadd(cp, vscale(EVT.dir, K)), vadd(vscale(EVT.e1, u), vscale(EVT.e2, w)));
      const T = (o && o.T) || clamp(Math.sqrt(2 * Math.max(5, d.y - y) / 16) * 0.92, 1.4, 3.6);
      C.push({ n, x, y, z, d, T, f, ex: ex || 0 });
    }
    const tau = Math.max(0.3, ...C.map((c) => c.T * c.f)) + 0.05;
    for (const c of C) L.push([c.n, c.x, c.y, c.z, c.d.x, c.d.y, c.d.z, Math.max(0, tau - c.f * c.T), c.T, c.ex]);
    if (L.length) evtRecibir(L, true);
    F.tau = tau; return { yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), cp: [cp.x, cp.y, cp.z].map((x) => +x.toFixed(2)), tau: +tau.toFixed(2), faltan: F.faltan || [] };
  };
  // qué hay en la foto: la grieta y cada cosa que cae (dónde en la pantalla y de qué tamaño, en píxeles de alto)
  F.medir = () => {
    const cp = (DBG.cam || F.ultCam).p, H = R.cv.height, th = Math.tan((F.fov || CAM.fov) * Math.PI / 360);
    const r3 = (a) => a && a.map((x) => +x.toFixed(3));
    const caidas = EVT.cola.map((c) => { const p = c.p || c.hasta, d = vsub(p, cp), L = d.len(), s = F.enPantalla(d); return { n: c.nombre, est: c.estado, s: r3(s), px: +((c.vis ? c.vis.r : 0.5) * 2 / (2 * th * L) * H).toFixed(1), d: +L.toFixed(1) }; });
    const vivos = (EVT.vivos || []).map((o) => { const x = o.o || o; if (!x || !x.b) return null; const d = vsub(x.b.pos, cp); return { n: x.nombre, s: r3(F.enPantalla(d)), d: +d.len().toFixed(1) }; }).filter(Boolean);
    const gente = F.gente.map((P) => { const d = vsub(vadd(P.pos, v3(0, 0.2, 0)), cp); return { n: P.skin, s: r3(F.enPantalla(d)), alto: +(1.9 * (P.tam || 1) / (2 * th * d.len()) * H).toFixed(0) }; });
    const props = F.objs.filter((o) => !o.borrado).map((o) => { const d = vsub(o.b.pos, cp); let r = 0.5; try { for (const v of puntosForma(o.F.shape)) r = Math.max(r, v.len()); } catch (e) {} return { n: o.nombre, s: r3(F.enPantalla(d)), r: +(r / (2 * th * d.len())).toFixed(3), d: +d.len().toFixed(1) }; });
    const sol = R.sol ? { az: +(Math.atan2(R.sol.x, R.sol.z) * 180 / Math.PI).toFixed(0), el: +(Math.asin(clamp(R.sol.y, -1, 1)) * 180 / Math.PI).toFixed(0), camAz: +(F.yaw * 180 / Math.PI).toFixed(0) } : null;
    return { grieta: EVT.grieta ? r3(F.enPantalla(EVT.dir)) : null, caidas, vivos, gente, props, sol, hora: DIA.hora };
  };
  F.limpiar = () => { for (const o of F.objs) if (!o.borrado) borrarObjeto(o, true); F.objs.length = 0; for (const P of F.gente) borrarPersona(P); F.gente.length = 0; if (typeof EVT !== 'undefined') { for (const c of EVT.cola) c.vis = null; EVT.cola.length = 0; for (const o of EVT.vivos) if (o && !o.borrado && OBJS.includes(o)) borrarObjeto(o, true); EVT.vivos.length = 0; EVT.prox = 1e12; } };
  return 'ok';
})();
