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
      return lista;
    },
    buscar(id) { return Quests.todas().find((q) => q.id === id); },
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

  // lugares para jugar
  menu() {
    const lista = Quests.habilitados();
    let botones = [];
    Sonido.musica(null);
    return {
      paso() {},
      dibujar() {
        const P = Pantalla;
        UI.centro(1, T('tid_button_locations'), [255, 255, 255]);
        botones = [];
        const w = Math.min(40, P.cols - 4), x = (P.cols - w) >> 1;
        lista.forEach((q, i) => {
          const y = 3 + i * 3;
          if (y + 3 > P.filas) return;
          const b = { x, y, w, h: 3, q };
          UI.caja(x, y, w, 3, Prog.completos[q.id] ? [120, 255, 120] : [255, 255, 255]);
          P.texto(x + 2, y + 1, T(q.name || q.id));
          if (Prog.completos[q.id]) P.texto(x + w - 3, y + 1, '*', [255, 255, 0]);
          botones.push(b);
        });
        P.texto(1, P.filas - 1, 'o ' + (Prog.recursos.stone || 0), [200, 200, 200]);
      },
      toque(x, y) {
        const b = botones.find((b) => UI.boton(b, 0, 0, [x, y]));
        if (b) { Sonido.efecto('click'); Juego.cambiar(Escenas.partida(b.q.id)); }
      },
    };
  },

  partida(id) {
    const q = Quests.buscar(id);
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
          UI.caja(x, 5, w, ls.length + 6);
          ls.forEach((s, i) => P.texto(x + 2, 7 + i, s));
          P.texto(x + 2, 8 + ls.length, '> ' + T('tid_button_continue'), [255, 255, 0]);
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
