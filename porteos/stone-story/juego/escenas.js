// Escenas: titulo (logo que se dibuja), intro ("No ves nada..."), menu de lugares, partida.
'use strict';
const Quests = (() => {
  let lista = null;
  return {
    todas() {
      if (lista) return lista;
      lista = [];
      for (const [n, t] of Object.values(Datos.textos)) {
        if (!/_quests$/.test(n)) continue;
        try { const d = slim(t); for (const q of d.quests || []) { q._archivo = n; lista.push(q); } } catch (e) { console.warn('quests', n, e); }
      }
      // las "sequel" son las vueltas siguientes (nivel 1, 2...) del mismo lugar
      const sec = lista.filter((q) => q.sequel);
      lista = lista.filter((q) => !q.sequel);
      for (const s of sec) { const b = lista.find((q) => q.id === s.sequel); if (b) (b._secuelas = b._secuelas || {})[s.level || 0] = s; }
      return lista;
    },
    buscar(id) { return Quests.todas().find((q) => q.id === id); },
    // datos de la vuelta que toca segun cuantas veces se completo (base + su sequel)
    vuelta(id) {
      const b = Quests.buscar(id);
      if (!b || !b._secuelas) return b;
      const lv = Math.min(Prog.completos[id] || 0, Math.max(...Object.keys(b._secuelas).map(Number)));
      let r = b;
      for (let k = 1; k <= lv; k++) if (b._secuelas[k]) r = Object.assign({}, r, b._secuelas[k], { id: b.id, name: b.name });
      return r;
    },
    // lugares habilitados: rocky_plateau al principio y los que van abriendo los onComplete.enableQuests
    habilitados() {
      const h = new Set(['rocky_plateau']);
      for (const id of Object.keys(Prog.completos)) {
        const q = Quests.buscar(id);
        for (const e of (q && q.onComplete && q.onComplete.enableQuests) || []) h.add(e);
      }
      return Quests.todas().filter((q) => h.has(q.id));
    },
  };
})();

// UI: cajas con los bordes del juego (simbolos 218 196 191 179 192 217) y botones
const UI = {
  caja(x, y, w, h, col = [255, 255, 255], relleno = true) {
    const P = Pantalla;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let g = 32;
      if (j === 0) g = i === 0 ? 218 : i === w - 1 ? 191 : 196;
      else if (j === h - 1) g = i === 0 ? 192 : i === w - 1 ? 217 : 196;
      else if (i === 0 || i === w - 1) g = 179;
      if (g === 32 && !relleno) continue;
      P.poner(x + i, y + j, g, col[0], col[1], col[2], [0, 0, 0]);
    }
  },
  centro(y, s, col) { Pantalla.texto(Math.floor((Pantalla.cols - s.length) / 2), y, s, col); },
  boton(b, x, y, toque) { return toque && toque[0] >= b.x && toque[0] < b.x + b.w && toque[1] >= b.y && toque[1] < b.y + b.h; },
};

const Escenas = {
  // logo que se dibuja solo (LogoLogic: logo_draw 5,6 s) y "toca para empezar"
  titulo() {
    const logo = Obj.crear(Object.keys(Datos.prefabs).find((k) => Datos.prefabs[k].n === 'logo_new'));
    const dibuja = Obj.buscar(logo, 'logo_draw'), quema = Obj.buscar(logo, 'logo_burn');
    Obj.iniciarAnim(logo);
    dibuja.activo = quema.activo = true;
    Obj.playAnim(dibuja);
    let fase = 'dibuja', t = 0;
    Sonido.efecto('logo_full');
    return {
      paso() {
        t++;
        Obj.paso(fase === 'quema' ? quema : dibuja, 1 / TICS);
        if (fase === 'quema' && t > 5 * TICS) Juego.cambiar(Object.keys(Prog.completos).length || Prog.recursos.stone ? Escenas.menu() : Escenas.intro());
      },
      dibujar() {
        const o = fase === 'quema' ? quema : dibuja;
        const cx = Pantalla.cols >> 1, cy = (Pantalla.filas >> 1) - 2;
        Obj.dibujarSprite(Obj.sprite(o), cx, cy);
        if (fase === 'dibuja' && t > 6 * TICS && (t >> 4) % 2) UI.centro(Pantalla.filas - 4, T('tid_intro_0'), [180, 180, 180]);
      },
      toque() { if (fase === 'dibuja' && t > 2 * TICS) { fase = 'quema'; t = 0; Obj.playAnim(quema); } },
      tecla() { this.toque(); },
    };
  },

  // la intro del juego: textos que aparecen y el boton de recoger piedras
  intro() {
    const lineas = ['tid_intro_1', 'tid_intro_2', 'tid_intro_3', 'tid_intro_4'];
    let t = 0, k = 0, piedras = 0, boton = null, fin = 0;
    return {
      paso() {
        t++;
        if (k < lineas.length && t > (k + 1) * 75) k++;
        if (fin && ++fin > 60) Juego.cambiar(Escenas.partida('rocky_plateau'));
      },
      dibujar() {
        const y0 = 5;
        for (let i = 0; i < k; i++) UI.centro(y0 + i * 2, T(lineas[i]), [200, 200, 200]);
        if (k >= lineas.length && t > (lineas.length + 1) * 75) {
          const s = T('tid_intro_5');
          const w = s.length + 6;
          boton = { x: (Pantalla.cols - w) >> 1, y: y0 + 10, w, h: 3 };
          UI.caja(boton.x, boton.y, boton.w, boton.h);
          Pantalla.texto(boton.x + 3, boton.y + 1, s);
          const c = piedras === 0 ? T('tid_intro_zero') : piedras === 1 ? T('tid_intro_6') : piedras === 5 ? T('tid_intro_five') : T('tid_intro_7', piedras);
          UI.centro(boton.y + 4, c.trim());
          if (piedras >= 5) UI.centro(boton.y + 7, T('tid_intro_8'), [255, 255, 160]);
        }
      },
      toque(x, y) {
        if (boton && UI.boton(boton, 0, 0, [x, y]) && piedras < 5) {
          piedras++; Sonido.efecto('pickup_stone');
          Prog.recursos.stone = (Prog.recursos.stone || 0) + 1; Prog.guardar();
          if (piedras >= 5) fin = 1;
        }
      },
    };
  },

  // menu principal con pestanas: Lugares / Taller / Objetos
  menu(pestana = 'lugares') {
    let botones = [];
    Sonido.musica(null); Sonido.ambiente(null);
    const RECURSO = (r) => String(r || '').toLowerCase();
    const puede = (q) => (q.costs || []).every((c) => (Prog.recursos[RECURSO(c.resource)] || 0) >= c.amount);
    return {
      paso() {},
      dibujar() {
        const P = Pantalla;
        botones = [];
        const hab = Quests.habilitados().filter((q) => !(q.oneShot && Prog.completos[q.id]));
        const taller = hab.filter((q) => q.workstation);
        const tabs = [['lugares', T('tid_button_locations')]];
        if (taller.length || Prog.completos.build_workstation) tabs.push(['taller', T('tid_button_workstation')]);
        if (Object.keys(Prog.items).length) tabs.push(['objetos', T('tid_button_items')]);
        let tx = 1;
        for (const [k, n] of tabs) {
          const w = n.length + 4;
          UI.caja(tx, P.filas - 3, w, 3, k === pestana ? [255, 255, 0] : [150, 150, 150]);
          P.texto(tx + 2, P.filas - 2, n, k === pestana ? [255, 255, 0] : [200, 200, 200]);
          botones.push({ x: tx, y: P.filas - 3, w, h: 3, tab: k });
          tx += w + 1;
        }
        // recursos
        let rx = P.cols - 1;
        for (const [tipo, sim] of [['stone', 'o'], ['wood', '/'], ['tar', '~'], ['bronze', '=']]) {
          const n = Prog.recursos[tipo]; if (!n) continue;
          const t = sim + ' ' + n; rx -= t.length + 2; P.texto(rx, 0, t, [220, 220, 220]);
        }
        const w = Math.min(54, P.cols - 4), x = (P.cols - w) >> 1;
        if (pestana === 'objetos') {
          UI.centro(1, T('tid_button_items'));
          Object.values(Prog.items).forEach((it, i) => {
            const y = 3 + i * 3; if (y + 3 > P.filas - 3) return;
            const st = Items.stats(it);
            const eq = Prog.mano === it.id ? 'R' : Prog.manoI === it.id ? 'L' : '';
            UI.caja(x, y, w, 3, eq ? [120, 255, 120] : [255, 255, 255]);
            let det = '';
            if (st && !st.herramienta) det = st.ataca ? '  \u2666' + st.dano : '  \u2666' + st.armMax;
            P.texto(x + 2, y + 1, Items.nombre(it.id) + ' +' + (it.nivel || 1) + det);
            if (eq) P.texto(x + w - 4, y + 1, eq, [120, 255, 120]);
            botones.push({ x, y, w, h: 3, item: it.id });
          });
          return;
        }
        const lista = pestana === 'taller' ? taller : hab.filter((q) => !q.workstation);
        UI.centro(1, pestana === 'taller' ? T('tid_button_workstation') : T('tid_button_locations'));
        lista.forEach((q, i) => {
          const y = 3 + i * 3; if (y + 3 > P.filas - 3) return;
          const ok = puede(q);
          UI.caja(x, y, w, 3, Prog.completos[q.id] ? [120, 255, 120] : ok ? [255, 255, 255] : [110, 110, 110]);
          P.texto(x + 2, y + 1, T(q.name || q.id), ok ? null : [130, 130, 130]);
          const costo = (q.costs || []).map((c) => c.amount + ' ' + T(c.resource)).join(' ');
          if (costo) P.texto(x + w - 2 - costo.length, y + 1, costo, ok ? [255, 255, 160] : [160, 80, 80]);
          else if (Prog.completos[q.id]) P.texto(x + w - 3, y + 1, '*', [255, 255, 0]);
          botones.push({ x, y, w, h: 3, q, ok });
        });
      },
      toque(x, y) {
        const b = botones.find((b) => UI.boton(b, 0, 0, [x, y]));
        if (!b) return;
        Sonido.efecto('click');
        if (b.tab) { pestana = b.tab; return; }
        if (b.item) {
          const s = Items.stats(Prog.items[b.item]);
          if (s && !s.herramienta) {
            if (Prog.mano === b.item) { Prog.mano = null; Prog.manoI = b.item; }
            else if (Prog.manoI === b.item) Prog.manoI = null;
            else Prog.mano = b.item;
            Prog.guardar();
          }
          return;
        }
        if (!b.ok) return;
        for (const c of b.q.costs || []) Prog.recursos[RECURSO(c.resource)] -= c.amount;
        Prog.guardar();
        Juego.cambiar(b.q.sections || b.q.encounters ? Escenas.partida(b.q.id) : Escenas.tarea(b.q, pestana));
      },
    };
  },

  // tarea con barra de progreso (seconds + progressBar): bajar el acantilado, fabricar, etc.
  tarea(q, volver) {
    let t = 0, fin = false;
    const dur = (q.seconds || 3) * TICS;
    return {
      paso() {
        if (fin) return;
        if (++t >= dur) {
          fin = true;
          Prog.completos[q.id] = (Prog.completos[q.id] || 0) + 1;
          for (const f of (q.onComplete && q.onComplete.setFlags) || []) Prog.banderas[f] = 1;
          for (const r of q.rewards || []) if (r.itemId && Items.catalogo()[r.itemId]) Items.dar(r.itemId);
          Prog.guardar();
          Sonido.efecto('pickup_success');
        }
      },
      dibujar() {
        const P = Pantalla, w = Math.min(60, P.cols - 6), x = (P.cols - w) >> 1;
        UI.centro(5, T(q.name || q.id), [255, 255, 255]);
        UI.centro(7, T(q.progressBar || '').trim(), [180, 180, 180]);
        const n = w - 4, k = Math.round(n * Math.min(1, t / dur));
        P.texto(x + 2, 9, '\u2588'.repeat(k) + '\u2591'.repeat(n - k), [220, 220, 220]);
        if (fin) {
          const ls = partir(T((q.outro && q.outro.line1) || ''), w - 4);
          ls.forEach((s, i) => P.texto(x + 2, 12 + i, s));
          for (const r of q.rewards || []) if (r.itemId && Items.catalogo()[r.itemId]) UI.centro(13 + ls.length, '+ ' + Items.nombre(r.itemId), [120, 255, 120]);
          P.texto(x + 2, 15 + ls.length, '> ' + T('tid_button_continue'), [255, 255, 0]);
        }
      },
      toque() { if (fin) Juego.cambiar(Escenas.menu(volver)); },
    };
  },

  partida(id) {
    const q = Quests.vuelta(id);
    const L = Partida.nuevo(q);
    window.prueba.partida = L;
    let fin = 0;
    return {
      paso() {
        Partida.paso(L);
        if (L.completo || L.perdido) {
          if (!fin) {
            fin = 1;
            if (L.completo) {
              L.botin = (L.botin || []).concat(...Array.from({ length: L.tesoros || 0 }, () => Items.abrirCofre(id, q.level || 0)));
              Prog.completos[id] = (Prog.completos[id] || 0) + 1;
              for (const f of (q.onComplete && q.onComplete.setFlags) || []) Prog.banderas[f] = 1;
            }
            Prog.guardar();
          } else fin++;
        }
      },
      dibujar() {
        Partida.dibujar(L);
        Hud.dibujar(L);
        if (fin > 20) {
          const P = Pantalla, w = Math.min(60, P.cols - 6), x = (P.cols - w) >> 1;
          const txt = L.completo ? T((q.outro && q.outro.line1) || 'Completado') : 'Te derrotaron';
          const ls = partir(txt, w - 4);
          UI.caja(x, 5, w, ls.length + 8 + Math.min(4, (L.botin || []).length));
          ls.forEach((s, i) => P.texto(x + 2, 7 + i, s));
          const extra = [];
          for (const [tipo, sim] of [['stone', 'o'], ['wood', '/'], ['tar', '~'], ['bronze', '=']]) if (L.recursos[tipo]) extra.push(sim + ' +' + L.recursos[tipo]);
          if (extra.length) P.texto(x + 2, 8 + ls.length, extra.join('   '), [220, 220, 220]);
          (L.botin || []).slice(0, 4).forEach((it, i) => P.texto(x + 2, 9 + ls.length + i, '+ ' + Items.nombre(it) + ' ' + (Prog.items[it] ? '+' + Prog.items[it].nivel : ''), [120, 255, 120]));
          P.texto(x + 2, 10 + ls.length + Math.min(4, (L.botin || []).length), '> ' + T('tid_button_continue'), [255, 255, 0]);
        }
      },
      toque() { if (fin > 30) Juego.cambiar(Escenas.menu()); },
    };
  },
};

function partir(s, w) {
  const out = [];
  for (const par of String(s).split('\n')) {
    let l = '';
    for (const p of par.split(' ')) {
      if ((l + ' ' + p).trim().length > w) { out.push(l); l = p; } else l = (l + ' ' + p).trim();
    }
    out.push(l);
  }
  return out;
}

const Hud = {
  dibujar(L) {
    const h = L.heroe, P = Pantalla;
    P.texto(1, 0, '♥' + Math.max(0, Math.ceil(h.hp)), [255, 60, 60]);
    if (h.armadura > 0) P.texto(6, 0, '◊' + Math.ceil(h.armadura), [120, 200, 255]);
    let x = P.cols - 2;
    for (const [tipo, sim] of [['stone', 'o'], ['wood', '/'], ['tar', '~'], ['bronze', '=']]) {
      const n = L.recursos[tipo];
      if (!n) continue;
      const s = sim + ' ' + n;
      x -= s.length + 2;
      P.texto(x, 0, s, [230, 230, 230]);
    }
  },
};
