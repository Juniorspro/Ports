// Una partida en un lugar (Level): personajes, secciones de 69 columnas, camara, fin del nivel.
// Lo que se sabe del juego: el heroe avanza 10 celdas/s en x y en z (baseMovesPerSecond), la camara
// pasa a la seccion siguiente cuando el heroe llega a seccion*69+20, cada seccion nueva hace aparecer
// el contenido de la de dos mas adelante en (i*69-24), y el nivel termina 30 pasos despues de que no
// quedan enemigos, cosas para levantar, puntos de paso ni recursos adelante.
'use strict';
const X_SECCION = 69;

const Prog = (() => { // progreso guardado
  const K = 'stonestory.prog';
  let p;
  try { p = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  p = p || { banderas: {}, recursos: {}, items: {}, completos: {} };
  p.guardar = () => { try { localStorage.setItem(K, JSON.stringify(p)); } catch (e) {} };
  return p;
})();

const Partida = (() => {
  const P = {};
  const CLASES = ['Hero', 'Enemy', 'Pickup', 'Decoration', 'LevelEndPoint', 'WayPoint', 'Neutral', 'Character', 'Bullet'];

  // clase base del juego (Enemy, Pickup, Decoration...) siguiendo la herencia de las clases propias
  function claseBase(cl) {
    const her = (Datos.tablas.herencia || {})[cl] || [];
    for (const k of [cl, ...her]) if (['Hero', 'Enemy', 'Pickup', 'Decoration', 'LevelEndPoint', 'WayPoint', 'Neutral', 'Bullet'].includes(k)) return k;
    return 'Character';
  }
  function compPersonaje(o) { return o.comps.find((c) => CLASES.includes(c._c) || ((Datos.tablas.herencia || {})[c._c] || []).includes('Character')); }

  // crea un personaje desde un prefab (id o ruta)
  P.personaje = (ref, x, z, nivel) => {
    const o = typeof ref === 'string' && ref.includes('/') ? Obj.desdeRuta(ref) : Obj.crear(ref);
    if (!o) return null;
    Obj.iniciarAnim(o);
    const c = compPersonaje(o) || {};
    const L = Math.max(0, nivel || 0);
    let hp = (c.hitpoints || 1) + (c.hitpointsPerLevel || 0) * L;
    if (hp < 1) hp = Math.max(1, (c.hitpointsPerLevel || 1) * Math.max(1, L));
    const q = {
      o, c, clase: claseBase(c._c), id: c.id, x, z, y: 0, hp, hpMax: hp, armadura: 0,
      vivo: true, muerte: 0, mira: 1, estado: 'quieto', tEstado: 0, nivel: L,
      ancho: c.collisionWidth || 1, prof: c.collisionDepth || 1, tagsS: new Set(c.tags || []),
      sprite: Obj.sprite(o), cola: 0,
    };
    // sprites de estado del enemigo (son componentes AsciiSprite de los hijos)
    const ref2 = (r) => { const x = Obj.ref(r); return x ? { o: x[0], s: x[1] } : null; };
    q.sp = {
      dormido: ref2(c.sleepingSprite), camina: ref2(c.walkSprite), carga: ref2(c.attackCastSprite),
      golpe: ref2(c.attackPerfSprite), muere: ref2(c.deathSprite),
    };
    // arma: componente Weapon en un hijo
    Obj.recorrer(o, (h) => { const w = Obj.comp(h, 'Weapon'); if (w && !q.arma) q.arma = w; });
    if (q.clase === 'Enemy') { q.dormido = !!c.sleepIfNoWeapon || !!q.sp.dormido; q.hostil = !!c.hostile; }
    const hr = o.comps.find((x) => x._c === 'HarvestableResource');
    if (hr) q.recurso = hr.resourceType || 1;
    return q;
  };

  P.nuevo = (quest) => {
    const L = {
      quest, personajes: [], seccion: 0, camX: 0, camXf: 0, t: 0, completo: false, finDemora: 0,
      textos: [], recursos: {}, muertos: 0,
      azar: Azar((Date.now() ^ 0x5eed) >>> 0),
    };
    L.fondo = quest.background ? Fondo.crear('Quests/' + quest.background) : null;
    L.frente = quest.foreground ? Fondo.crear('Quests/' + quest.foreground) : null;
    const heroe = P.personaje(Object.keys(Datos.prefabs).find((k) => Datos.prefabs[k].n === 'Hero' && k[0] === 's'), quest.initialHeroX || 0, 16, 0);
    heroe.hp = heroe.hpMax = 20;
    heroe.esHeroe = true;
    heroe.acX = 0; heroe.acZ = 0;
    heroe.spCamina = Obj.buscar(heroe.o, 'Walking Animation');
    heroe.spLevanta = Obj.buscar(heroe.o, 'Pickup Animation');
    L.heroe = heroe;
    L.personajes.push(heroe);
    L.limSup = quest.walkLimitTop || 10; L.limInf = quest.walkLimitBot || 21;
    heroe.z = quest.initialHeroZ || Math.round((L.limSup + L.limInf) / 2) + 1;
    if (quest.onPlay && quest.onPlay.setFlags) for (const f of quest.onPlay.setFlags) Prog.banderas[f] = 1;
    const secs = quest.sections || [];
    for (let i = 0; i < Math.min(2, secs.length); i++) P.poblar(L, secs[i], i * X_SECCION - 24);
    P.disparar(L);
    return L;
  };

  // triggers del lugar: musica y ambiente segun la seccion
  P.disparar = (L) => {
    for (const t of L.quest.triggers || []) {
      const c = t.condition || {};
      if (c.section !== undefined && c.section !== L.seccion) continue;
      if (c.blockedByFlag && Prog.banderas[c.blockedByFlag]) continue;
      if (t.type === 'PlayMusic') Sonido.musica((t.instructions || [])[0]);
      else if (t.type === 'PlayAmbient') Sonido.ambiente((t.instructions || [])[0]);
    }
  };

  function encuentro(L, id) { return (L.quest.encounters || []).find((e) => e.id === id); }
  function cumple(e) {
    if (e.blockedByFlag && Prog.banderas[e.blockedByFlag]) return false;
    if (e.requiresFlag && !Prog.banderas[e.requiresFlag]) return false;
    if (e.requiresItem && !Prog.items[e.requiresItem]) return false;
    return true;
  }

  P.poblar = (L, sec, base) => {
    if (!sec) return;
    const nivel = L.quest.level || 0;
    for (const f of sec.fixed || []) {
      if (!cumple(f)) continue;
      const e = f.prefab ? { prefab: f.prefab } : encuentro(L, f.id);
      if (!e || !cumple(e)) continue;
      const q = P.personaje(e.prefab, base + (f.x || 0), f.y || 16, nivel);
      if (!q) continue;
      for (const a of [].concat(f.args || [])) Object.assign(q.args = q.args || {}, a);
      L.personajes.push(q);
    }
    const ids = sec.rndIds || [];
    for (let k = 0; k < (sec.rndCount || 0) && ids.length; k++) {
      const e = encuentro(L, ids[L.azar.entre(0, ids.length)]);
      if (!e || !cumple(e)) continue;
      const x = base + L.azar.entre(sec.minX || 0, (sec.maxX || 40) + 1);
      const z = L.azar.entre(L.limSup + 1, L.limInf + 1);
      const q = P.personaje(e.prefab, x, z, nivel);
      if (q) L.personajes.push(q);
    }
  };

  const dist = (a, b) => Math.abs(a.x - b.x);
  const vivos = (L, f) => L.personajes.filter((q) => q.vivo && !q.esHeroe && f(q));

  // objetivo del heroe: lo mas cercano adelante (enemigos despiertos, cosas para romper, para levantar)
  function objetivo(L, h) {
    const lim = L.camX + Math.floor(Pantalla.cols / 2) + 2;
    let mejor = null, md = 1e9;
    for (const q of L.personajes) {
      if (!q.vivo || q.esHeroe || q.x > lim) continue;
      let pri;
      if (q.clase === 'Enemy' && q.hostil !== false) pri = 0;
      else if (q.clase === 'Decoration' && q.tagsS.has('harvest') && Items.herramienta(q.recurso || 1)) pri = 1;
      else if (q.clase === 'Pickup') pri = 1;
      else if (q.clase === 'WayPoint') pri = 2;
      else continue;
      const d = Math.abs(q.x - h.x) + Math.abs(q.z - h.z) * 0.5 + pri * 200 + (q.x < h.x - 30 ? 500 : 0);
      if (d < md) { md = d; mejor = q; }
    }
    return mejor;
  }

  function armaDe(q, ob) {
    if (q.esHeroe) {
      let it = null;
      if (ob && ob.recurso) it = Items.herramienta(ob.recurso);
      else if (Prog.mano && Prog.items[Prog.mano]) it = Prog.items[Prog.mano];
      const s = it && Items.stats(it);
      q.armaAct = s ? it.id : null;
      if (s) return s;
      return { dano: 1, rango: 1, carga: 8, golpe: 12 };
    }
    const w = q.arma;
    if (w) return { dano: w.baseDamage || 1, rango: w.baseRange || 1, carga: w.cast || 10, golpe: w.perf || 15, enfriar: w.cooldown || 0, bala: w.bulletPrefab };
    return { dano: 1, rango: 1, carga: 8, golpe: 12 };
  }

  P.danar = (L, q, n, de) => {
    if (!q.vivo) return;
    let d = n;
    if (q.armadura > 0) { const a = Math.min(q.armadura, d); q.armadura -= a; d -= a; }
    q.hp -= d;
    q.golpeado = 6;
    L.textos.push({ x: q.x, z: q.z - (q.o ? 4 : 3), t: 0, s: String(n), col: q.esHeroe ? [255, 80, 80] : [255, 255, 255] });
    Sonido.efecto(q.esHeroe ? 'player_hit' : (de && de.esHeroe ? (de.arma ? 'sword_hit' : 'morel_punch') : ''));
    if (q.clase === 'Enemy') { q.dormido = false; }
    if (q.hp <= 0) P.morir(L, q);
  };

  P.morir = (L, q) => {
    q.vivo = false; q.hp = 0;
    q.muerte = q.c.deathDurationTics || 8;
    if (q.c.deathSfx) Sonido.efecto(q.c.deathSfx);
    if (q.sp && q.sp.muere) { q.spMuerte = q.sp.muere; Obj.playAnim(q.sp.muere.o); }
    if (!q.esHeroe) L.muertos++;
    if (q.clase === 'Decoration' && q.recurso) {
      const tipo = q.recurso === 2 ? 'wood' : q.recurso === 3 ? 'tar' : q.recurso === 4 ? 'bronze' : 'stone';
      P.ganar(L, tipo, 1 + L.azar.entre(0, 3));
      Sonido.efecto('pickup_' + tipo);
    }
    if (q.args && q.args.drop) { const id = q.args.drop.split('/').pop(); Items.dar(id); L.botin = (L.botin || []).concat([id]); }
  };

  P.ganar = (L, tipo, n) => {
    L.recursos[tipo] = (L.recursos[tipo] || 0) + n;
    Prog.recursos[tipo] = (Prog.recursos[tipo] || 0) + n;
  };

  function mover(q, dx, dz, L) {
    q.x += dx; q.z = Math.max(L.limSup, Math.min(L.limInf, q.z + dz));
    if (dx) q.mira = dx > 0 ? 1 : -1;
  }

  function pasoHeroe(L) {
    const h = L.heroe;
    if (!h.vivo) return;
    if (h.levantando > 0) { h.levantando--; return; }
    const ob = objetivo(L, h);
    const a = armaDe(h, ob);
    let quiereX = 1, quiereZ = 0, quieto = false;
    if (ob) {
      const dx = ob.x - h.x, dz = ob.z - h.z;
      const alcance = ob.clase === 'Pickup' || ob.clase === 'WayPoint' ? 0 : Math.max(1, a.rango - 1) + Math.floor(ob.ancho / 2);
      if (ob.clase === 'Pickup' || ob.clase === 'WayPoint') {
        if (Math.abs(dx) <= 0 && Math.abs(dz) <= 0) {
          if (ob.clase === 'Pickup') {
            ob.vivo = false; ob.muerte = 0;
            if (ob.c._c === 'TreasurePickup') { L.tesoros = (L.tesoros || 0) + 1; } else P.ganar(L, ob.c.id || 'stone', ob.c.grantAmount || 1);
            Sonido.efecto(ob.c.sfxOnPickup || 'pickup_stone');
            h.levantando = h.c.pickupTicDuration || 23;
            if (h.spLevanta) Obj.playAnim(h.spLevanta);
          } else ob.vivo = false;
          return;
        }
        quiereX = Math.sign(dx); quiereZ = Math.sign(dz);
      } else if (Math.abs(dx) <= alcance && Math.abs(dz) <= 1) {
        quieto = true; h.mira = dx >= 0 ? 1 : -1;
        atacar(L, h, ob, a);
      } else {
        quiereX = Math.abs(dx) > alcance ? Math.sign(dx) : 0;
        quiereZ = Math.sign(dz);
      }
    }
    if (!quieto) { h.atk = null; }
    if (quieto) { if (!h.atk) h.estado = 'quieto'; return; }
    // limite derecho: no pasar a la seccion siguiente con enemigos atras (twoWay) no aplica aca
    h.acX += 10; h.acZ += 10;
    let dx = 0, dz = 0;
    if (h.acX >= 30) { h.acX -= 30; dx = quiereX; }
    if (h.acZ >= 30) { h.acZ -= 30; dz = quiereZ; }
    const secs = L.quest.sections || [];
    const lim = Math.min(L.camX + Math.floor(Pantalla.cols / 2) - 4, secs.length ? (secs.length - 1) * X_SECCION + 30 : 1e9);
    if (dx > 0 && h.x >= lim) dx = 0;
    if (dx || dz) { mover(h, dx, dz, L); h.estado = 'camina'; } else if (!quiereX && !quiereZ) h.estado = 'quieto';
  }

  // ataque con fases como el arma: carga (cast) y golpe (perf); el dano sale al empezar el golpe
  function atacar(L, q, ob, a) {
    if (!q.atk) q.atk = { t: 0 };
    const k = q.atk;
    k.t++;
    q.estado = k.t <= a.carga ? 'carga' : 'golpe';
    if (k.t === 1 && q.esHeroe && a.c) { const sf = a.c && Obj.comp(Obj.crearCache(a.c.pref), 'WeaponStateSfx'); if (sf && sf.castSfx) Sonido.efecto(sf.castSfx); }
    if (k.t === a.carga + 1) {
      if (q.esHeroe && !a.c) Sonido.efecto('player_punch');
      P.danar(L, ob, a.dano, q);
    }
    if (k.t >= a.carga + a.golpe + (a.enfriar || 0)) q.atk = null;
  }

  function pasoEnemigo(L, q) {
    const h = L.heroe;
    if (q.dormido) {
      if (dist(q, h) <= (q.c.wakeupDistance || 20)) { q.dormido = false; if (q.c.awakeSfx) Sonido.efecto(q.c.awakeSfx); }
      else return;
    }
    if (!h.vivo || q.hostil === false) return;
    const a = armaDe(q);
    const dx = h.x - q.x, dz = h.z - q.z;
    q.mira = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) <= a.rango + 1 && Math.abs(dz) <= 1) { atacar(L, q, h, a); return; }
    q.atk = null;
    q.cola++;
    const tpm = q.c.ticsPerMove || 6;
    if (q.cola >= tpm) {
      q.cola = 0;
      mover(q, Math.abs(dx) > a.rango ? Math.sign(dx) : 0, Math.sign(dz), L);
      q.estado = 'camina';
    }
  }

  P.paso = (L) => {
    if (L.pausa) return;
    L.t++;
    Fondo.paso(L.fondo); Fondo.paso(L.frente);
    for (const q of L.personajes) {
      if (q.vivo) {
        if (q.esHeroe) pasoHeroe(L);
        else if (q.clase === 'Enemy') pasoEnemigo(L, q);
        else if (q.clase === 'LevelEndPoint' && L.heroe.x >= q.x) { q.vivo = false; if (q.c.completeLevel) L.completo = true; }
      } else if (q.muerte > 0) q.muerte--;
      if (q.golpeado) q.golpeado--;
      Obj.paso(q.o, 1 / TICS);
    }
    L.personajes = L.personajes.filter((q) => q.vivo || q.muerte > 0 || q.esHeroe);
    for (const t of L.textos) t.t++;
    L.textos = L.textos.filter((t) => t.t < 24);
    // secciones
    const secs = L.quest.sections || [];
    const h = L.heroe;
    if (secs.length && L.seccion + 1 < secs.length && h.x >= L.seccion * X_SECCION + 20) {
      L.seccion++;
      P.poblar(L, secs[L.seccion + 1], (L.seccion + 1) * X_SECCION - 24);
      P.disparar(L);
    }
    // camara: va hacia seccion*69 con lerp 0.11
    const destino = L.seccion * X_SECCION;
    L.camXf += (destino - L.camXf) * 0.11;
    if (Math.abs(destino - L.camXf) < 0.5) L.camXf = destino;
    L.camX = Math.round(L.camXf);
    // fin
    if (!secs.length || L.seccion + 1 >= secs.length) {
      const queda = L.personajes.some((q) => q.vivo && !q.esHeroe && (q.clase === 'Enemy' || q.clase === 'Pickup' || q.clase === 'WayPoint' || (q.clase === 'Decoration' && q.tagsS.has('harvest') && q.x >= h.x - 4 && Items.herramienta(q.recurso || 1))));
      if (!queda && h.vivo) { if (++L.finDemora > 29) L.completo = true; }
    }
    if (!h.vivo && h.muerte <= 0) { L.perdido = true; L.completo = false; }
  };

  // ---- dibujo ----
  function spriteDe(q) {
    if (q.esHeroe) {
      if (q.levantando > 0 && q.spLevanta) return { o: q.spLevanta, s: Obj.sprite(q.spLevanta) };
      if (q.estado === 'camina' && q.spCamina) return { o: q.spCamina, s: Obj.sprite(q.spCamina) };
      return { o: q.o, s: q.sprite };
    }
    if (!q.vivo && q.spMuerte) return q.spMuerte;
    const e = q.dormido ? q.sp.dormido : q.estado === 'camina' ? q.sp.camina : q.estado === 'carga' ? q.sp.carga : q.estado === 'golpe' ? q.sp.golpe : null;
    if (e && e.s) return e;
    return { o: q.o, s: q.sprite };
  }

  // el arma en la mano derecha: R_idle / R_cast / R_perf del prefab del arma, cuadro segun la fase
  function dibujarArma(L, h, fx, col) {
    const it = Items.catalogo()[h.armaAct];
    if (!it) return;
    const w = Obj.crearCache(it.pref);
    const fase = h.estado === 'carga' ? 'R_cast' : h.estado === 'golpe' ? 'R_perf' : 'R_idle';
    const o = Obj.buscar(w, fase) || Obj.buscar(w, 'R_idle');
    if (!o) return;
    const s = Obj.sprite(o);
    const d = Obj.datos(s);
    const a = h.atk, st = Items.stats(Prog.items[h.armaAct] || { id: h.armaAct });
    if (a && st && d.cuadros.length) {
      const t = h.estado === 'carga' ? (a.t - 1) / st.carga : (a.t - st.carga - 1) / Math.max(1, st.golpe);
      s._cuadro = d.cuadros[Math.max(0, Math.min(d.cuadros.length - 1, Math.floor(t * d.cuadros.length)))];
    } else s._cuadro = 0;
    Obj.dibujarSprite(s, P.colX(L, h.x), h.z - h.y, { fx, color: col });
  }

  P.colX = (L, x) => x - L.camX + Math.floor(Pantalla.cols / 2);

  P.dibujar = (L) => {
    Fondo.dibujar(L.fondo, L.camX, (z) => z >= 0);
    const orden = L.personajes.slice().sort((a, b) => a.z - b.z || (a.c.sortTiebreaker || 0) - (b.c.sortTiebreaker || 0));
    for (const q of orden) {
      if (!q.vivo && q.c.blinkOnDeath && !q.spMuerte && (q.muerte >> 1) % 2) continue;
      const e = spriteDe(q);
      if (!e || !e.s) continue;
      if (e.o && e.o !== q.o && !e.s._iniciado) { e.s._iniciado = 1; }
      if (e.o && e.o !== q.o) Obj.paso(e.o, 0);
      const fx = q.esHeroe ? q.mira < 0 : q.mira > 0; // los enemigos estan dibujados mirando a la izquierda
      const col = q.golpeado ? [255, 60, 60] : null;
      Obj.dibujarSprite(e.s, P.colX(L, q.x), q.z - q.y, { fx, color: col });
      if (q.esHeroe && q.vivo && q.armaAct && !(q.levantando > 0)) dibujarArma(L, q, fx, col);
    }
    Fondo.dibujar(L.frente, L.camX, (z) => z < 0 || true);
    for (const t of L.textos) Pantalla.texto(P.colX(L, t.x) - (t.s.length >> 1), t.z - (t.t >> 3), t.s, t.col);
  };
  return P;
})();
