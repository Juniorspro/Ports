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
  // (sin dibujar, la gente de la escena igual se anima: el juego anima a cada uno al dibujarlo; P.ritmo, en el video: la que
  // mira repite su reposo un número entero de veces por vuelta)
  F.paso = (dt, conDibujo) => {
    F.T += dt * 1000; F.saltar = !conDibujo; if (JUG.cuerpo) JUG.cuerpo.visible = false;
    try { cuadro(F.T); } finally { F.saltar = false; }
    if (!conDibujo && dt > 0) for (const P of F.gente) if (!P.borrado) animarPersona(P, dt * (P.ritmo || 1));
    // (la textura de las nubes se pinta de a franjas entre un cuadro y otro, con requestAnimationFrame —cielos.js,
    // cieloCTPedir—: con el tiempo parado ese pedido nunca llegaba y las nubes quedaban como al cargar el mapa, a otra hora
    // y quietas —en la de noche, nubes blancas de día—. Acá se pinta la franja después de cada cuadro dibujado; en el video,
    // entera en cada cuadro —F.videoCuadro—: de a franjas, las del cuadro 300 no eran las del 0)
    if (conDibujo && typeof CIELO !== 'undefined' && CIELO.ctPend) { CIELO.ctPend = false; if (!F.vid) try { cieloCTPaso(false); } catch (e) {} }
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
  // (el estado va en F.rs: las pasadas de dibujo del video lo guardan y lo devuelven, así lo que se dibuja no cambia lo que
  // pasa después)
  F.semilla = (k) => { F.rs = (k | 0) >>> 0; Math.random = () => { F.rs = (F.rs + 0x6D2B79F5) >>> 0; let t = F.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  F.sinSemilla = () => { Math.random = F.rndOrig; };
  // la escena: S = { hora, semilla, cam: { p | [adelante, lado] desde la aparición, alto, grieta: [sx, sy] | yaw/pitch, fov },
  // props: [[nombre, adelante, lado, giro]], gente: [[skin, adelante, lado, giro, { vel, mira, arma }]],
  // caidas: [[nombre, adelante, lado, fracción del vuelo en la foto, explosión]] } — adelante/lado en metros desde la cámara
  // (lado: a la derecha de la pantalla); giro relativo a la cámara (0: mirando hacia donde mira la cámara)
  F.armar = (S) => {
    // (la hora primero, y la grieta se vuelve a ubicar con el sol de esa hora, como si se entrara al mapa a esa hora)
    DIA.ciclo = false; DIA.hora = S.hora !== undefined ? S.hora : 12; DIA.aplicada = -1; diaAplicar(); GFX.part = S.part || 3.5;
    // (y las nubes, pintadas enteras de nuevo con la luz de esa hora: si no, quedaban las del mapa recién cargado)
    if (typeof cieloCTPaso === 'function' && typeof CIELO !== 'undefined') { CIELO.ctPend = false; try { cieloCTPaso(true); } catch (e) {} }
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
  F.limpiar = () => { F.vid = null; for (const o of F.objs) if (!o.borrado) borrarObjeto(o, true); F.objs.length = 0; for (const P of F.gente) borrarPersona(P); F.gente.length = 0; if (typeof EVT !== 'undefined') { for (const c of EVT.cola) c.vis = null; EVT.cola.length = 0; for (const o of EVT.vivos) if (o && !o.borrado && OBJS.includes(o)) borrarObjeto(o, true); EVT.vivos.length = 0; EVT.prox = 1e12; } };

  // ======================= los fondos animados (video.mjs) =======================
  // La misma escena de la foto, en movimiento y periódica: lo que pasa en una vuelta de L segundos vuelve a pasar igual en la
  // siguiente, así el último cuadro empalma con el primero.
  //  · la cámara recorre una elipse chica (de costado y adelante-atrás) mirando siempre al mismo punto, a «foco» metros: lo
  //    de cerca se corre contra lo de lejos y la grieta, que está en el infinito, casi no se mueve;
  //  · lo que cae sale de la grieta a su hora dentro de la vuelta (cada lanzamiento hace latir la grieta); lo que explota se
  //    consume en la explosión y lo que no, queda en el piso hasta que vuelve a caer el mismo en la vuelta siguiente: en el
  //    golpe (con el polvo y el fuego) el de la vuelta anterior se saca y queda el nuevo;
  //  · el azar (las chispas, el humo, cómo gira lo que cae) arranca con la misma semilla en cada vuelta;
  //  · la gente que mira repite su reposo un número entero de veces por vuelta (P.ritmo); la que corre cruza la pantalla de un
  //    borde al otro y, fuera de cuadro, vuelve a empezar con la animación desde cero;
  //  · nadie se lastima ni se rompe nada (las explosiones sólo empujan lo que cayó).
  // Lo que no es periódico por sí solo (las nubes, el agua y el pulso que corre por las vetas de la grieta dependen del reloj del
  // juego) lo empalma un fundido corto entre el final de la vuelta y su principio (bucle.py).
  F.vid = null;
  const dO = danarObjeto, dP = danarPersona, dJ = danarJugador;
  danarObjeto = function () { if (F.vid) return; return dO.apply(this, arguments); };
  danarPersona = function () { if (F.vid) return; return dP.apply(this, arguments); };
  danarJugador = function () { if (F.vid) return; return dJ.apply(this, arguments); };
  // (en el golpe de lo que no explota: el de la vuelta anterior se va y queda el nuevo; se anota cuánto se había movido)
  const pega = evtPega;
  evtPega = function (c) {
    const V = F.vid;
    if (V && c.ranura !== undefined) {
      const o = V.yace[c.ranura];
      if (o) { V.cambios.push({ n: c.nombre, t: +V.t.toFixed(3), d: o.borrado ? -1 : +o.b.pos.distTo(c.suelo).toFixed(2) }); if (!o.borrado && OBJS.includes(o)) borrarObjeto(o, true); const i = EVT.vivos.indexOf(o); if (i >= 0) EVT.vivos.splice(i, 1); }
      V.yace[c.ranura] = null;
    }
    pega(c);
    // (rueda menos que en el juego —el envión y el giro, al 35 %—: queda a menos de un metro de donde pegó, y en la vuelta
    // siguiente el que se saca está adentro del polvo del golpe)
    if (V && c.ranura !== undefined && c.o) { V.yace[c.ranura] = c.o; const b = c.o.b; b.vel.x *= 0.35; b.vel.z *= 0.35; b.ang.scale(0.35); }
  };
  // (las nubes y el cielo van con el reloj del juego —se corren con el viento, se forman y se deshacen— y en 10 s cambian mucho:
  // el cielo del cuadro 300 contra el del 0 daba 18 niveles de diferencia y el fundido del empalme se veía como un cielo doble.
  // En el video su reloj va y vuelve —el del juego más L/2π·sen(2πt/L)—: en el medio van a la velocidad del juego, se frenan
  // y vuelven, y a los L segundos el cielo es exactamente el del principio)
  const tCielo = () => F.vid.Tc0 + F.vid.L / 6.283185307179586 * Math.sin(6.283185307179586 * F.vid.t / F.vid.L);
  const conCielo = (f) => function () { if (!F.vid) return f.apply(this, arguments); const t = TIEMPO.t; TIEMPO.t = tCielo(); try { return f.apply(this, arguments); } finally { TIEMPO.t = t; } };
  cieloCTUniformes = conCielo(cieloCTUniformes); cieloUniformes = conCielo(cieloUniformes);
  // (cada lanzamiento hace latir la grieta: en el juego, de golpe —pasa cada 2 a 4 minutos—; acá, cada 2 s, de golpe era un
  // fogonazo de todo el cielo —y de la luz— cada 2 s, el cuadro siguiente 12 niveles más claro. En el video el latido sube en
  // 0,35 s y baja como en el juego)
  const recibe = evtRecibir;
  evtRecibir = function () { const V = F.vid, p0 = EVT.pulso; const r = recibe.apply(this, arguments); if (V) { V.pulsoMeta = Math.max(V.pulsoMeta || 0, EVT.pulso); EVT.pulso = p0; } return r; };
  // S.video = { L, fps, cam: { lado, frente, alto, foco }, caidas: [[nombre, adelante, lado, salida (s), explosión]],
  //   corren: [[skin, [adelante, lado] desde, [adelante, lado] hasta, salida (s), velocidad]] }
  F.armarVideo = (S) => {
    const V0 = S.video, L = V0.L || 10, fps = V0.fps || 30;
    // la escena de la foto, sin lo que cae ni los que corren en el lugar (acá corren de verdad)
    const quietos = (S.gente || []).filter((g) => !(g[4] && g[4].vel));
    const arm = F.armar(Object.assign({}, S, { caidas: [], gente: quietos }));
    GFX.tope = 0; if (typeof EVT !== 'undefined') EVT.prox = 1e12;
    const cp = F.cp.clone(), yaw = F.yaw, pitch = arm.pitch, q = Quat.euler(yaw, pitch), fw = q.rot(v3(0, 0, 1));
    const fh = v3(Math.sin(yaw), 0, Math.cos(yaw)), dr = v3(-Math.cos(yaw), 0, Math.sin(yaw));
    const en = (a, b) => [cp.x + fh.x * a + dr.x * b, cp.z + fh.z * a + dr.z * b], alto = cp.y + 30;
    const C = Object.assign({ lado: 1.2, frente: 0.8, alto: 0.1, foco: 30 }, V0.cam || {});
    const V = { L, fps, t: 0, ciclo: -1, cp, yaw, pitch, fw, fh, dr, C, foco: vadd(cp, vscale(fw, C.foco)), semilla: (S.semilla || 1) * 7919 + 13, caidas: [], corren: [], yace: [], cambios: [], huellas: [], lanz: 0 };
    // lo que cae: de la grieta (como en la foto: desde un punto en su dirección a 1,7 veces la distancia a la que cae) al piso
    for (const [n, a, b, s, ex] of V0.caidas || []) {
      const [x, z] = en(a, b), y = F.piso(x, z, alto); if (y === null) { F.faltan.push('piso:' + n); continue; }
      const K = clamp(Math.hypot(a, b) * (S.desdeK || 1.7), 55, 200), u = (Math.random() - 0.5) * 2 * (S.abre || 0.04) * K, w = (Math.random() - 0.5) * 2 * (S.abre || 0.04) * K;
      const d = vadd(vadd(cp, vscale(EVT.dir, K)), vadd(vscale(EVT.e1, u), vscale(EVT.e2, w)));
      const T = clamp(Math.sqrt(2 * Math.max(5, d.y - y) / 16) * 0.92, 1.4, 3.6);
      V.caidas.push({ n, x, y, z, d, T, s: ((s % L) + L) % L, ex: ex || 0, k: V.caidas.length });
    }
    // los que corren: de un borde al otro, por el piso, a su velocidad (la animación del juego pisa sin patinar)
    for (const [sk, de, a2, s, vel] of V0.corren || []) {
      const [x0, z0] = en(de[0], de[1]), [x1, z1] = en(a2[0], a2[1]);
      const P = F.persona(sk, x0, z0, Math.atan2(x1 - x0, z1 - z0), { desde: alto }); if (!P) { F.faltan.push('corre:' + sk); continue; }
      const dist = Math.hypot(x1 - x0, z1 - z0), v = vel || 6.5;
      V.corren.push({ P, x0, z0, x1, z1, dur: dist / v, v, s: ((s % L) + L) % L, dentro: false });
    }
    // la que mira: su reposo entra un número entero de veces en la vuelta (P.ritmo: unos % más rápido o más lento)
    const G = typeof humGm === 'function' ? humGm() : null;
    V.ritmos = [];
    for (const P of F.gente) {
      if (V.corren.some((c) => c.P === P) || !P.hum) continue;
      const cl = G && G.idle ? G.idle : (humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01'));
      const D = cl && cl.d > 0.2 ? cl.d : 0; if (!D) continue;
      const k = Math.max(1, Math.round(L / D)); P.ritmo = k * D / L; V.ritmos.push([P.skin, +D.toFixed(3), k, +P.ritmo.toFixed(4)]);
    }
    V.Tc0 = TIEMPO.t; V.pulsoMeta = 0;
    F.vid = V; F.videoCam(0);
    // (las nubes enteras de nuevo, ya con el reloj del cielo del video)
    if (typeof cieloCTPaso === 'function' && typeof CIELO !== 'undefined') { CIELO.ctPend = false; try { cieloCTPaso(true); } catch (e) {} }
    return Object.assign(arm, { L, fps, caidas: V.caidas.map((c) => [c.n, +c.T.toFixed(2), c.s, c.ex, +Math.hypot(c.x - cp.x, c.z - cp.z).toFixed(1)]), corren: V.corren.map((c) => [c.P.skin, +c.dur.toFixed(2), c.s]), ritmos: V.ritmos, faltan: F.faltan });
  };
  // la cámara en el tiempo t: la elipse (de costado lado·sen, adelante-atrás frente·cos, un poco arriba y abajo al doble de
  // ritmo) mirando al foco
  F.videoCam = (t) => {
    const V = F.vid, C = V.C, th = 6.283185307179586 * t / V.L;
    const p = vadd(V.cp, vadd(vscale(V.dr, C.lado * Math.sin(th)), vadd(vscale(V.fh, -C.frente * Math.cos(th)), v3(0, C.alto * Math.sin(2 * th), 0))));
    const d = vsub(V.foco, p).norm();
    F.camara([p.x, p.y, p.z], Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1)));
    return p;
  };
  // los que corren, en el tiempo t: cruzando o, fuera de cuadro, esperando (al salir de nuevo, la animación desde cero)
  const corrPoner = (c, t) => {
    const V = F.vid, u = ((t - c.s) % V.L + V.L) % V.L, P = c.P;
    if (u < c.dur) {
      if (!c.dentro) { c.dentro = true; const H = P.hum; if (H) { H.t = 0; H.fase = 0; H.cadera = 0; H.atras = false; H.aire = 0; H.mov = 0; } P.t = 0; P.fase = 0; P.ik = null; P.pieCorr = 0; P.dtJunto = 0; }
      const f = u / c.dur, x = c.x0 + (c.x1 - c.x0) * f, z = c.z0 + (c.z1 - c.z0) * f, y = F.piso(x, z, P.pos.y + 4);
      P.pos.set(x, (y === null ? P.pos.y - 0.96 : y) + 0.96, z); P.vel.set((c.x1 - c.x0) / c.dur, 0, (c.z1 - c.z0) / c.dur); P.visible = true; P.suelo = true;
    } else { c.dentro = false; P.vel.set(0, 0, 0); P.visible = false; P.pos.set(c.x0, P.pos.y, c.z0); }
  };
  // avanzar el video dt segundos (los pasos de 1/240 s: video.mjs): primero lo que toca lanzar en este tramo (con la demora
  // justa dentro del paso), la vuelta nueva con su semilla, la cámara y los que corren; después el juego
  F.videoPaso = (dt) => {
    const V = F.vid, t0 = V.t, t1 = t0 + dt, ci = Math.floor(t0 / V.L + 1e-9);
    // (la vuelta nueva: su semilla, y la huella de cómo empieza —lo que yace en el piso y cuánto humo y fuego hay— para ver que
    // una vuelta empieza igual que la anterior)
    if (ci !== V.ciclo) {
      V.ciclo = ci;
      V.huellas.push({ c: ci, yace: V.yace.map((o) => (o && !o.borrado ? [o.b.pos.x, o.b.pos.y, o.b.pos.z].map((x) => +x.toFixed(3)) : null)), part: PART.l.length, cola: EVT.cola.length });
    }
    // (y cada paso, su propia semilla según dónde cae en la vuelta: con una sola por vuelta, una chispa de más que quedó de la
    // anterior corría todos los números al azar que venían después y la vuelta salía distinta —lo que yace, a 25 cm—)
    F.semilla(V.semilla + Math.round((t0 - ci * V.L) * 240) * 2654435761);
    for (const c of V.caidas) {
      const tl = ci * V.L + c.s;
      for (const tt of [tl, tl + V.L]) if (tt >= t0 - 1e-9 && tt < t1 - 1e-9) {
        evtRecibir([[c.n, c.x, c.y, c.z, c.d.x, c.d.y, c.d.z, Math.max(0, tt - t0), c.T, c.ex]], true);
        EVT.cola[EVT.cola.length - 1].ranura = c.k; V.lanz++;
      }
    }
    F.videoCam(t1);
    for (const c of V.corren) corrPoner(c, t1);
    if (typeof TIEMPO !== 'undefined') TIEMPO.lento = 0;
    // (el latido de la grieta sube de a poco: 1 en 0,35 s; después baja solo, como en el juego —eventoPaso—)
    if (V.pulsoMeta) { EVT.pulso = Math.min(V.pulsoMeta, EVT.pulso + dt / 0.35); if (EVT.pulso >= V.pulsoMeta - 1e-9) V.pulsoMeta = 0; }
    F.paso(dt, false); V.t = t1;
  };
  // un cuadro del video: nT instantes dentro de medio cuadro (obturador de 180°: lo que va rápido queda corrido como en una
  // cámara de verdad), nP/nT pasadas corridas una fracción de píxel en cada uno (puntos de Halton), todo promediado en
  // números con coma; después, el resto del cuadro sin dibujar. Devuelve los píxeles RGB (de arriba abajo) en base64.
  // (cada pasada dibuja con el reloj corrido un millonésimo de segundo: con 0, la gente y la IK de los pies avanzan 1/60 s por
  // pasada —el «|| 0.016» de personas.js—)
  // (y después se le devuelve ese millonésimo al reloj, así la vuelta siguiente cae en el mismo instante que ésta)
  F.pasada = () => { const s = F.rs; F.paso(1e-6, true); F.rs = s; F.T -= 1e-3; TIEMPO.t -= 1e-6; TIEMPO.ult -= 1e-6; TIEMPO.acc = Math.max(0, TIEMPO.acc - 1e-6); };
  F.videoCuadro = (nP, nT) => {
    const V = F.vid, W = R.cv.width, H = R.cv.height, gl = R.gl, paso = 1 / (V.fps * 8), n3 = W * H * 3;
    if (!V.acc || V.acc.length !== n3) { V.acc = new Float32Array(n3); V.px = new Uint8Array(W * H * 4); V.u8 = new Uint8Array(n3); }
    const A = V.acc, px = V.px; A.fill(0);
    if (typeof cieloCTPaso === 'function') { CIELO.ctPend = false; try { cieloCTPaso(true); } catch (e) {} }
    nT = Math.max(1, Math.min(4, nT | 0)); nP = Math.max(nT, nP | 0); const porT = Math.round(nP / nT); let i = 0;
    for (let k = 0; k < nT; k++) {
      if (k > 0) for (let s = 0; s < 4 / nT; s++) F.videoPaso(paso);
      for (let j = 0; j < porT; j++, i++) {
        F.jx = nP > 1 ? hal(i + 1, 2) - 0.5 : 0; F.jy = nP > 1 ? hal(i + 1, 3) - 0.5 : 0;
        F.pasada();
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let y = 0; y < H; y++) { let o = (H - 1 - y) * W * 3, s = y * W * 4; for (let x = 0; x < W; x++, s += 4) { A[o++] += px[s]; A[o++] += px[s + 1]; A[o++] += px[s + 2]; } }
      }
    }
    F.jx = F.jy = 0;
    const u8 = V.u8, kk = 1 / i; for (let j = 0; j < n3; j++) u8[j] = A[j] * kk + 0.5;
    // (el resto del cuadro: hasta 8 pasos de 1/240 s por cuadro)
    const hechos = Math.round((nT - 1) * 4 / nT); for (let s = hechos; s < 8; s++) F.videoPaso(paso);
    let b = ''; for (let j = 0; j < n3; j += 0x8000) b += String.fromCharCode.apply(null, u8.subarray(j, Math.min(n3, j + 0x8000)));
    return btoa(b);
  };
  return 'ok';
})();
