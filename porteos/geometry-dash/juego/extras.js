// Lo del juego que está fuera de los niveles: cofres diarios y misiones (los da el servidor, como en
// el teléfono), la Torre por fuera y por dentro (LevelAreaLayer / LevelAreaInnerLayer), cómo jugar,
// estadísticas y los enlaces de RobTop.
'use strict';
(() => {
const X = GD.Extras = {};
const { U, D, A, E, Sprite, Nodo } = GD;
const P = GD.perfil, M = GD.Menus;
const nn = n => String(n).padStart(2, '0');
X.reloj = s => { s = Math.max(0, Math.floor(s)); return `${nn(Math.floor(s / 3600))}:${nn(Math.floor(s / 60) % 60)}:${nn(s % 60)}`; };

// ---------------- pedidos cifrados (getGJRewards / getGJChallenges) ----------------
// el servidor contesta "5 letras + base64(xor(datos, clave))|hash" y espera un chk armado igual
const xor = (s, k) => { let r = ''; for (let i = 0; i < s.length; i++) r += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return r; };
const LETRAS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const azar5 = () => [...Array(5)].map(() => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
X.chk = k => azar5() + btoa(xor(String(10000 + Math.floor(Math.random() * 990000)), k)).replace(/\+/g, '-').replace(/\//g, '_');
X.descifrar = (t, k) => xor(atob(t.split('|')[0].slice(5).replace(/-/g, '+').replace(/_/g, '/')), k).split(':');
// el teléfono se identifica con un udid fijo; acá uno por navegador, guardado en el perfil
X.udid = () => { if (!P.udid) { P.udid = 'S' + (1e9 + Math.floor(Math.random() * 9e9)); P.guardar(); } return P.udid; };
X.params = function (extra) {
  const cu = GD.G.leer('cuenta', null), p = { udid: X.udid(), uuid: cu ? cu.jugador : 0, gdw: 0 };
  if (cu) Object.assign(p, { accountID: cu.cuenta, gjp2: cu.gjp2 });
  return Object.assign(p, extra);
};
const r35 = () => 100 + Math.floor(Math.random() * 99900);

// ---------------- recompensas: lo que traen los cofres ----------------
// ítems del servidor: 1-5 fragmentos de fuego, hielo, veneno, sombra y lava; 6 llave del demonio;
// 10-14 fragmentos de tierra, sangre, metal, luz y alma (los de la 2.2)
X.ITEMS = { 1: ['fuego', 'fireShard'], 2: ['hielo', 'iceShard'], 3: ['veneno', 'poisonShard'], 4: ['sombra', 'shadowShard'], 5: ['lava', 'lavaShard'],
  10: ['tierra', 'shard0201Shard'], 11: ['sangre', 'shard0202Shard'], 12: ['metal', 'shard0203Shard'], 13: ['luz', 'shard0204Shard'], 14: ['alma', 'shard0205Shard'] };
X.darPremio = function ([orbes, diamantes, ...items]) {
  P.orbes += orbes | 0; P.diamantes += diamantes | 0; P.sumar('orbesGanados', orbes | 0);
  for (const it of items) {
    if (it === 6) P.llaves++;
    else if (X.ITEMS[it]) { const k = X.ITEMS[it][0]; P.fragmentos[k] = (P.fragmentos[k] || 0) + 1; }
  }
  P.guardar();
};
X.spritePremio = function (tipo, it) {
  if (tipo === 'orbes') return 'currencyOrbIcon_001.png';
  if (tipo === 'diamantes') return 'GJ_bigDiamond_001.png';
  if (it === 6) return 'GJ_bigKey_001.png';
  return X.ITEMS[it] ? X.ITEMS[it][1] + 'Big_001.png' : null;
};

// ---------------- cofres diarios (DailyRewardsLayer) ----------------
X.pedirCofres = async function (tipo = 0) {
  const t = await GD.Online.pedir('getGJRewards', X.params({ rewardType: tipo, r1: r35(), r2: r35(), chk: X.chk('59182') }));
  const r = X.descifrar(t, '59182'), premio = s => (s || '').split(',').map(Number);
  return { at: performance.now() / 1000, chico: { t: +r[5], premio: premio(r[6]), n: +r[7] }, grande: { t: +r[8], premio: premio(r[9]), n: +r[10] } };
};
X.cofres = async function () {
  const pop = new U.Popup(420, 270, 'GJ_square01.png'), k = pop.caja;
  await Promise.all([GD.cargarHoja('GJ_ShopSheet'), GD.S.cargar('datos/son/chestClick.ogg')]);
  U.sprite(k, 'rewardsLabel_001.png', 0, 110, 0.9);
  for (const [x, y, fx, fy] of [[-1, 1, false, false], [1, 1, true, false], [-1, -1, false, true], [1, -1, true, true]]) {
    const s = U.sprite(k, 'rewardCorner_001.png', x * 186, y * 112, 1, 1); s.fx = fx; s.fy = fy;
  }
  const est = U.texto(k, 'Loading...', 0, 0, 'goldFont', 0.6);
  const slots = [['chico', -95, 'chest_01'], ['grande', 95, 'chest_02']].map(([cual, x, base]) => {
    const n = new Nodo(); n.pos(x, -5); k.agregar(n);
    const caja = U.cajaOscura(165, 175, 80); caja.pos(-82.5, -85); n.agregar(caja, -1);
    U.texto(n, cual === 'chico' ? '4 Hours' : '24 Hours', 0, 72, 'goldFont', 0.55);
    const cont = new Nodo(); n.agregar(cont);
    const lbl = U.texto(n, '', 0, -62, 'goldFont', 0.55);
    return { cual, n, cont, lbl, base, tipo: cual === 'chico' ? 1 : 2 };
  });
  let estado = null, pidiendo = false;
  const armar = () => {
    for (const s of slots) {
      s.cont.vaciar(); const d = estado[s.cual], resta = d.t - (performance.now() / 1000 - estado.at), listo = resta <= 0;
      const spr = new Sprite(`${s.base}_${listo ? '02' : '01'}_001.png`); spr.escala = 0.62;
      const b = U.boton(s.cont, spr, 0, 8, () => abrir(s, listo));
      if (listo) b.correr(A.siempre(A.sec(A.escala(0.5, 1.06).e(E.inOut(2)), A.escala(0.5, 1).e(E.inOut(2)))));
      s.listo = listo; s.lbl.texto(listo ? 'Open' : X.reloj(resta));
    }
  };
  const abrir = async (s, listo) => {
    if (!listo) { GD.S.efecto('chestClick.ogg', 0.5); return; }
    if (pidiendo) return; pidiendo = true;
    try {
      const r = await X.pedirCofres(s.tipo), d = r[s.cual], marca = `${s.cual}${d.n}`;
      estado = r; pop.cerrar();
      // el número del cofre evita cobrarlo dos veces si el servidor repite la respuesta
      const nuevo = !P.recompensas[marca];
      if (nuevo) { P.recompensas[marca] = 1; X.darPremio(d.premio); }
      X.abrirCofre(s.cual === 'chico' ? 1 : 2, d.premio, () => X.cofres());
    } catch (e) { U.alerta('Error', 'Something went wrong, please try again later.'); }
    pidiendo = false;
  };
  pop.alActualizar = () => {
    if (!estado) return;
    for (const s of slots) { const resta = estado[s.cual].t - (performance.now() / 1000 - estado.at); if (!s.listo && resta <= 0) { armar(); break; } if (!s.listo) s.lbl.texto(X.reloj(resta)); }
  };
  pop.cerrarBtn(); pop.mostrar();
  try { estado = await X.pedirCofres(0); est.vis = false; armar(); }
  catch (e) { X.sinCuenta(pop, est); }
};
// el servidor sólo atiende cofres y misiones de jugadores que ya conoce: sin cuenta, a iniciar sesión
X.sinCuenta = function (pop, est) {
  if (GD.G.leer('cuenta', null)) { est.texto('Something went wrong...'); return; }
  est.texto('Log in to your Geometry Dash account\nto get rewards and quests.'); est.escala = 0.5; est.y = 15;
  U.boton(pop.caja, U.botonTexto('Login', 90, 'goldFont', 'GJ_button_01.png', 30, 0.6), 0, -40, () => { pop.cerrar(); GD.Online.cuenta(); });
};
// RewardUnlockLayer: el cofre cae, tiembla, se abre y suelta lo que trae
X.abrirCofre = async function (tipo, premio, alCerrar) {
  await GD.cargarHoja('GJ_ShopSheet');
  const W = D.ancho, H = D.alto, capa = new U.Capa();
  const velo = new GD.Rect(W, H, 0, 0, 0, 0); capa.agregar(velo, -5); velo.correr(A.op(0.3, 210));
  const base = `chest_0${tipo}`, cofre = new Nodo(); cofre.pos(W / 2, H + 120); capa.agregar(cofre, 1);
  const cerrado = new Sprite(`${base}_02_001.png`); cerrado.escala = 0.8; cofre.agregar(cerrado, 2);
  const sombra = U.sprite(capa, 'chest_shadow_001.png', W / 2, H / 2 - 62, 0.8, 0); sombra.op = 0;
  let listo = false;
  const soltar = () => {
    cerrado.vis = false;
    // las tres partes del cofre abierto comparten el centro: el tamaño original de cada marco ya las ubica
    U.sprite(cofre, `${base}_04_back_001.png`, 0, 0, 0.8, 0); U.sprite(cofre, `${base}_04_001.png`, 0, 0, 0.8, 3);
    const brillo = U.sprite(cofre, `${base}_04_glow_001.png`, 0, 0, 0.8, 1); brillo.add = true;
    brillo.op = 0; brillo.correr(A.op(0.3, 255));
    GD.S.efecto('chestOpen01.ogg'); GD.S.efecto('magicExplosion.ogg', 0.6);
    const cosas = [['orbes', premio[0]], ['diamantes', premio[1]], ...premio.slice(2).filter(i => i).map(i => ['item', 1, i])].filter(([, v]) => v > 0);
    cosas.forEach(([t, v, it], i) => {
      const x = W / 2 + (i - (cosas.length - 1) / 2) * 85, n = new Nodo(); n.pos(W / 2, H / 2); capa.agregar(n, 4);
      const s = new Sprite(X.spritePremio(t, it)); s.escala = 0.1; n.agregar(s);
      const l = U.texto(n, '+' + v, 0, -34, 'bigFont', 0.6); l.op = 0;
      n.correr(A.sec(A.esperar(0.15 + i * 0.12), A.mover(0.5, x, H / 2 + 105).e(E.backOut)));
      s.correr(A.sec(A.esperar(0.15 + i * 0.12), A.escala(0.5, t === 'orbes' ? 1 : 0.8).e(E.backOut)));
      l.correr(A.sec(A.esperar(0.6 + i * 0.12), A.op(0.2, 255)));
    });
    const ok = U.boton(capa, U.botonTexto('OK', 80), W / 2, 40, () => { D.soltarPila(capa); capa.sacar(); alCerrar && alCerrar(); }, 6);
    ok.op = 0; ok.correr(A.sec(A.esperar(1), A.op(0.2, 255), A.fn(() => { listo = true; })));
  };
  // cae, rebota y tiembla antes de abrirse
  cofre.correr(A.sec(A.mover(0.5, W / 2, H / 2).e(E.bounceOut), A.fn(() => { GD.S.efecto('chestLand.ogg'); sombra.op = 120; }), A.esperar(0.25),
    A.repetir(A.sec(A.girar(0.05, -6), A.girar(0.1, 6), A.girar(0.05, 0)), 3), A.fn(() => GD.S.efecto('chestClick.ogg')),
    A.escala(0.15, 1.15).e(E.out(2)), A.escala(0.1, 1), A.fn(soltar)));
  capa.alTecla = (c, ab) => { if (ab && listo && (c === 'Escape' || c === 'Enter' || c === 'Space')) { D.soltarPila(capa); capa.sacar(); alCerrar && alCerrar(); } };
  D.escena.agregar(capa, 2000); D.empujar(capa);
};

// ---------------- misiones (ChallengesPage) ----------------
// cada misión pide juntar orbes, monedas o estrellas desde que aparece: se guarda cuánto había ese
// momento y el avance es la diferencia, como hace GameStatsManager
X.TIPOS_MISION = { 1: ['orbesGanados', 'orbs', 'currencyOrbIcon_001.png'], 2: ['monedasGanadas', 'coins', 'secretCoinUI_001.png'], 3: ['estrellas', 'stars', 'GJ_starsIcon_001.png'] };
X.cuenta = k => k === 'estrellas' ? P.estrellas : (P.stats[k] || 0);
X.pedirMisiones = async function () {
  const t = await GD.Online.pedir('getGJChallenges', X.params({ chk: X.chk('19847') }));
  const r = X.descifrar(t, '19847');
  const qs = r.slice(6, 9).map(s => { const [id, tipo, cant, premio, ...nom] = s.split(','); return { id: +id, tipo: +tipo, cant: +cant, premio: +premio, nombre: nom.join(',') }; });
  return { at: performance.now() / 1000, resta: +r[5], qs };
};
X.misiones = async function () {
  const pop = new U.Popup(440, 285, 'GJ_square01.png'), k = pop.caja; pop.titulo('Quests');
  const est = U.texto(k, 'Loading...', 0, 0, 'goldFont', 0.6);
  const filas = new Nodo(); k.agregar(filas);
  const pie = U.texto(k, '', 0, -122, 'goldFont', 0.5);
  let dato = null;
  const armar = () => {
    filas.vaciar();
    dato.qs.forEach((q, i) => {
      const y = 70 - i * 70, f = new Nodo(); f.pos(0, y); filas.agregar(f);
      const caja = U.cajaOscura(390, 62, 80); caja.pos(-195, -31); f.agregar(caja, -1);
      const [clave, palabra, icono] = X.TIPOS_MISION[q.tipo] || X.TIPOS_MISION[1];
      // el primer número de cada misión es su turno en ese lugar: lugar + turno la identifican
      const id = `${i}_${q.id}_${q.tipo}_${q.cant}`;
      if (!P.misiones[id]) { P.misiones[id] = { base: X.cuenta(clave), cobrada: false }; P.guardar(); }
      const m = P.misiones[id], hecho = Math.min(q.cant, X.cuenta(clave) - m.base);
      U.texto(f, q.nombre, -180, 16, 'goldFont', 0.55).anc(0, 0.5);
      U.texto(f, `Collect ${q.cant} ${palabra}`, -180, -4, 'bigFont', 0.38).anc(0, 0.5);
      M.barraProgreso(f, -75, -20, 100 * hecho / q.cant, [0, 255, 0], 200);
      const pct = f.hijos[f.hijos.length - 1]; pct.texto(`${hecho}/${q.cant}`);
      U.sprite(f, icono, 45, -20, 0.5);
      U.sprite(f, 'GJ_diamondsIcon_001.png', 150, 10, 0.7); U.texto(f, '' + q.premio, 128, 10, 'bigFont', 0.5).anc(1, 0.5);
      if (m.cobrada) U.texto(f, 'Claimed', 140, -16, 'goldFont', 0.45);
      else if (hecho >= q.cant) {
        U.boton(f, U.botonTexto('Claim', 70, 'goldFont', 'GJ_button_01.png', 26, 0.55), 140, -16, () => {
          m.cobrada = true; P.diamantes += q.premio; P.guardar(); GD.S.efecto('gold02.ogg'); U.aviso(`+${q.premio} Diamonds`, [0, 255, 255]); armar();
        });
      }
    });
  };
  pop.alActualizar = () => { if (dato) { const r = dato.resta - (performance.now() / 1000 - dato.at); pie.texto(r > 0 ? 'New quests in ' + X.reloj(r) : 'New quests ready!'); } };
  pop.cerrarBtn(); pop.mostrar();
  try { dato = await X.pedirMisiones(); est.vis = false; armar(); }
  catch (e) { X.sinCuenta(pop, est); }
};

// ---------------- la Torre por fuera (LevelAreaLayer) ----------------
X.NIV_TORRE = [[5001, 'The Tower'], [5002, 'The Sewers'], [5003, 'The Cellar'], [5004, 'The Secret Hollow']];
X.torre = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = async () => {
    c.fondoDegradado([70, 30, 130]);
    await GD.cargarHoja('TowerSheet');
    // rayos de luz que giran detrás de la torre
    const rayos = new Nodo(); rayos.pos(W / 2, H / 2 + 20); c.agregar(rayos, -4);
    for (let i = 0; i < 8; i++) { const g = new Sprite('godray01_001.png'); g.add = true; g.anc(0.5, 0); g.sx = 0.5; g.sy = 3.2; g.rot = i * 45; g.op = 40; rayos.agregar(g); }
    rayos.correr(A.siempre(A.girarPor(40, 360)));
    const luz = U.sprite(c, 'towerShine.png', W / 2, H / 2 + 20, 2.4, -3); luz.add = true; luz.op = 110;
    luz.correr(A.siempre(A.sec(A.op(2, 70), A.op(2, 110))));
    const torre = new Sprite('theTower_01_001.png'); torre.escala = 0.92;
    const b = U.boton(c, torre, W / 2, H / 2 - 6, () => { GD.S.efecto('door01.ogg'); D.cambiar(X.torreAdentro()); }); b.escalaToque = 1.04;
    b.correr(A.siempre(A.sec(A.moverPor(2.2, 0, 7).e(E.sineInOut), A.moverPor(2.2, 0, -7).e(E.sineInOut))));
    U.texto(c, 'The Tower', W / 2, H - 22, 'goldFont', 0.8, 3);
    c.botonAtras(() => D.cambiar(M.seleccion(22)));
    GD.S.musica('datos/mus/tower01.ogg', 0, true);
  };
  c.alEntrar = () => GD.S.musica('datos/mus/tower01.ogg', 0, true);
  c.atras = () => D.cambiar(M.seleccion(22));
  return c;
};
// ---------------- la Torre por dentro (LevelAreaInnerLayer): una puerta por nivel ----------------
// lugares de las puertas en el dibujo del interior (puntos desde su centro): abajo a la izquierda,
// en el medio a la derecha, arriba a la izquierda y sobre la cornisa de la calavera
X.PUERTAS = [[-100, -82], [99, -27], [-100, 28], [52, 82]];
X.torreAdentro = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = async () => {
    c.agregar(new GD.Rect(W, H, 12, 10, 22, 255), -10);
    await GD.cargarHoja('TowerSheet');
    const bg = new Sprite('towerBG_01_001.png'), k = H / bg.h; bg.escala = k; bg.pos(W / 2, H / 2); c.agregar(bg, -5);
    X.NIV_TORRE.forEach(([id, nom], i) => {
      const prev = i ? P.nivel(X.NIV_TORRE[i - 1][0]).hecho : true, hecho = P.nivel(id).hecho;
      const f = hecho ? 'towerDoor_open_001.png' : prev ? 'towerDoor_unlocked_001.png' : 'towerDoor_locked_001.png';
      const [px, py] = X.PUERTAS[i], x = W / 2 + px * k, y = H / 2 + py * k;
      const b = U.boton(c, f, x, y, () => {
        if (!prev) { GD.S.efecto('door001.ogg', 0.6); b.pararEtq(7); b.correr(A.sec(A.moverPor(0.05, 4, 0), A.moverPor(0.1, -8, 0), A.moverPor(0.05, 4, 0)).tag(7)); return; }
        GD.S.efecto('door01.ogg'); M.jugarOficial(id);
      }, 2, k * 0.92);
      b.escalaToque = 1.08;
      // antorchas a los lados
      for (const lado of [-1, 1]) {
        U.sprite(c, 'towerTorch_001.png', x + lado * 40 * k, y + 4 * k, k * 0.9, 1);
        const fu = U.sprite(c, 'towerTorchInner_001.png', x + lado * 40 * k, y + 20 * k, k * 0.45, 1); fu.add = true;
        fu.correr(A.siempre(A.sec(A.op(0.15 + Math.random() * 0.1, 170), A.op(0.15 + Math.random() * 0.1, 255))));
      }
      const visto = prev || hecho;
      U.texto(c, visto ? nom : '???', x, y + 36 * k, 'goldFont', 0.42 * k, 3);
      if (visto) U.texto(c, hecho ? '100%' : Math.floor(P.nivel(id).normal) + '%', x, y - 33 * k, 'bigFont', 0.32 * k, 3);
    });
    c.botonAtras(() => D.cambiar(X.torre()));
    GD.S.musica('datos/mus/tower01.ogg', 0, true);
  };
  c.alEntrar = () => GD.S.musica('datos/mus/tower01.ogg', 0, true);
  c.atras = () => D.cambiar(X.torre());
  return c;
};

// ---------------- cómo jugar: las láminas tutorial_01..05 ----------------
X.comoJugar = async function () {
  const pop = new U.Popup(Math.min(D.ancho - 30, 460), 300, 'GJ_square01.png'), k = pop.caja; let i = 1;
  const marco = new Nodo(); k.agregar(marco);
  const pag = U.texto(k, '', 0, -130, 'goldFont', 0.5);
  const ver = async () => {
    await GD.cargarHoja('tutorial_' + nn(i)); marco.vaciar();
    const s = new Sprite(`tutorial_${nn(i)}.png`); s.escala = Math.min((pop.pw - 80) / s.w, 230 / s.h); s.pos(0, 8); marco.agregar(s);
    pag.texto(`${i}/5`);
  };
  const izq = U.boton(k, 'GJ_arrow_01_001.png', -pop.pw / 2 + 22, 0, () => { i = i > 1 ? i - 1 : 5; ver(); }, 4, 0.6);
  const der = U.boton(k, 'GJ_arrow_01_001.png', pop.pw / 2 - 22, 0, () => { i = i < 5 ? i + 1 : 1; ver(); }, 4, 0.6); der.cont.fx = true; void izq;
  pop.cerrarBtn(); pop.mostrar(); ver();
};

// ---------------- estadísticas (StatsLayer) ----------------
X.estadisticas = function () {
  const pop = new U.Popup(Math.min(D.ancho - 40, 420), 285, 'GJ_square01.png'), k = pop.caja; pop.titulo('Stats');
  const s = P.stats, monedas = Object.values(P.progreso).reduce((a, p) => a + (p.monedas ? p.monedas.length : 0), 0);
  const filas = [['Total Jumps', s.saltos], ['Total Attempts', s.intentos], ['Completed Levels', s.oficialesHechos], ['Completed Online Levels', s.onlineHechos],
    ['Demons Beaten', s.demonios], ['Stars', P.estrellas], ['Moons', P.lunas], ['Diamonds', P.diamantes], ['Orbs', P.orbes], ['Total Orbs Collected', s.orbesGanados],
    ['Secret Coins', monedas], ['User Coins', s.monedasUsuario], ['Destroyed Players', s.muertes], ['Liked / Disliked Levels', s.likes], ['Rated Levels', s.calificados],
    ['Completed Daily Levels', s.diarios], ['Completed Map Packs', s.mapPacks], ['Completed Gauntlets', s.gauntlets], ['Demon Keys', P.llaves]];
  const lista = new U.Lista(pop.pw - 50, 215, 24); lista.pos(-pop.pw / 2 + 25, -120); k.agregar(lista); U.manejarLista(pop, lista);
  lista.poner(filas.map(([t, v]) => {
    const f = new Nodo(); f.w = lista.w; f.h = 24;
    U.texto(f, t + ':', f.w / 2 + 40, 12, 'goldFont', 0.48).anc(1, 0.5); U.texto(f, U.num(v || 0), f.w / 2 + 52, 12, 'bigFont', 0.45).anc(0, 0.5);
    return f;
  }));
  pop.cerrarBtn(); pop.mostrar();
};

// ---------------- enlaces (los íconos del menú y el logo de RobTop) ----------------
X.ENLACES = { robtop: 'https://www.robtopgames.com', fb: 'https://www.facebook.com/geometrydash', tw: 'https://twitter.com/robtopgames',
  yt: 'https://www.youtube.com/user/RobTopGames', twitch: 'https://www.twitch.tv/robtopgames', discord: 'https://discord.com/invite/geometrydash' };
X.abrir = k => { try { window.open(X.ENLACES[k], '_blank', 'noopener'); } catch (e) { } };
})();
