// corto vertical 5 (9:16, 26 s a 30 cuadros): un solo dato, demostrado con cosas del juego. «Si soltás una heladera y una
// pelota desde la misma altura, ¿cuál llega primero?»: el que explica es un jugador en tercera persona con la palanca, que
// se mueve como los de GMod (se agacha y se para seguido para asentir, gira, salta, le pega a las cosas). El de la tarjeta
// (pantalla verde, en el montaje) apuesta por la heladera golpeando una mesa del juego: la mesa le tapa la cintura y las
// cosas saltan con el golpe. Después se sueltan las dos desde 11 m: llegan juntas (cámara lenta y cuadro congelado). Al
// final «lo comprobé con Pepe». Letras blancas, de a una palabra; chat y kill feed.
// uso: ESC=pruebas/corto_heladera.mjs VW=540 VH=960 DPR=2 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA [escenas] [cada]
export const FPS = 30;
export const GOLPE = 6.20;   // (el golpe de la tarjeta: la plantilla en su 3,75 s)
export const VOZ = [
  [0.30, [[0, 2.99, 'Si soltás una heladera y una pelota desde la misma altura,'], [3.13, 4.10, '¿cuál llega primero?']]],
  [5.05, [[0, 1.81, 'La mayoría apuesta por la heladera.']]],
  [11.35, [[0, 1.90, 'Pero llegan prácticamente juntas.']]],
  [13.70, [[0, 1.61, 'La gravedad acelera todo igual,'], [1.75, 2.68, 'pese lo que pese.'], [3.18, 5.48, 'Lo único que las separa un poquito es el aire.']]],
  [19.50, [[0, 1.17, 'Lo comprobé con Pepe.']]],
  [24.40, [[0, 1.33, 'Seguime para más datos.']]],
];
const ESP = { heladera: '🧊', pelota: '⚽', primero: '🤔', juntas: '🤝', gravedad: '🌍', aire: '💨', pepe: '💀' };
const PAL = [];
for (const [t0, frases] of VOZ) for (const [a, b, txt] of frases) {
  const ws = txt.split(' '), pe = ws.map((w) => ((w.toLowerCase().match(/[aeiouáéíóúü]+/g) || ['a']).length + 0.12 * w.length)), tot = pe.reduce((x, y) => x + y, 0);
  let t = t0 + a; ws.forEach((w, i) => { const d = (b - a) * pe[i] / tot; const k = w.toLowerCase().replace(/[.,!?¿¡]/g, ''); PAL.push({ w: w.replace(/[.,]/g, ''), t0: +t.toFixed(3), t1: +(t + d).toFixed(3), e: ESP[k] || '' }); t += d; });
}
PAL.forEach((p, i) => { const s = PAL[i + 1]; p.t1 = s && s.t0 - p.t1 < 0.35 ? s.t0 : +(p.t1 + 0.3).toFixed(3); });
const CHATL = [[3.55, 'nico', 'la heladera obvio'], [4.25, 'xX_Lucas_Xx', 'heladera 100%'], [6.6, 'Mati_2011', 'apuesto mi cuenta'], [11.75, 'nico', 'QUÉ'], [12.35, 'xX_Lucas_Xx', 'mentira 😭'], [22.85, 'Pepe', 'AUCH'], [23.5, 'nico', 'F']];
const KILL = [[22.4, 25.0, '🧊 Heladera', 'Pepe']];
export const CSS = `
  #trOver{font-family:Inter,'Noto Color Emoji',sans-serif}
  #cv{will-change:transform}
  #trOver .coTop{position:absolute;left:4%;right:4%;top:7.2%;text-align:center;font:900 33px/1.12 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:7px #000;paint-order:stroke fill;text-transform:uppercase}
  #trOver .coCap{position:absolute;left:3%;right:3%;top:63%;text-align:center;font:900 56px/1 Inter,'Noto Color Emoji',sans-serif;text-transform:uppercase;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5))}
  #trOver .coCap span{display:inline-block}
  #trOver .coChat{position:absolute;left:4%;width:78%;top:71%;font:700 17px/1.25 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #trOver .coChat div{display:table;background:rgba(0,0,0,.45);padding:4px 9px;border-radius:7px;margin-top:5px}
  #trOver .coChat b{font-weight:800}
  #trOver .coKill{position:absolute;right:4%;top:19.5%;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  #trOver .coKill div{font:800 16px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.62);padding:6px 10px;border-radius:7px;text-shadow:0 1px 2px #000;white-space:nowrap}
  #trOver .coTag{position:absolute;left:0;top:0;text-align:center;font:800 18px/1.1 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
  #trOver .coStk{position:absolute;left:0;top:0;white-space:nowrap;text-align:center}
  #trOver .coGrande{font:900 60px/1.02 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5));text-align:center}
  #trOver .coCuenta{font:900 150px/1 Inter,sans-serif;color:#fff;-webkit-text-stroke:14px #000;paint-order:stroke fill;filter:drop-shadow(0 6px 0 rgba(0,0,0,.5))}
  #trOver .coLinea{position:absolute;top:24%;bottom:30%;left:50%;width:0;border-left:5px dashed #fff;filter:drop-shadow(0 0 3px #000)}
  #trOver .coSeguir{display:inline-block;background:#fe2c55;color:#fff;font:800 26px Inter,sans-serif;padding:12px 32px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  body.trailer #hud .npcGlobo{font-size:17px!important;font-weight:700}
`;
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarAgarre === 'function') soltarAgarre(); ARM.agarre = null; ENT.disparo = false; ENT.tactil = true; ENT.x = ENT.y = 0; ENT.saltar = ENT.agachar = ENT.correr = false;
  PREFS.evento = false; DIA.ciclo = false; DIA.hora = 15.0; DIA.aplicada = -1; JUG.tercera = true; JUG.vel.set(0, 0, 0); JUG.vida = 1e7; DBG.cam = null; DBG.sinVista = true; PREFS.fov = 72;
  elegirArma(ARM.lista.indexOf('Crowbar'));
  $('cv').style.transform = ''; $('cv').style.filter = '';
  const s0 = MUNDO.spawns[0], BX = s0.x + 8, BZ = s0.z - 28;
  window.TRH = {
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    rapido(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 4); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };
  window.CO = {
    PAL: ${JSON.stringify(PAL)}, CHAT: ${JSON.stringify(CHATL)}, KILL: ${JSON.stringify(KILL)}, tags: [],
    g(x, z) { return pisoBajo(v3(BX + x, s0.y + 30, BZ + z), 80) ?? (s0.y - 0.96); },
    W(x, z, h) { return v3(BX + x, this.g(x, z) + (h || 0), BZ + z); },
    MX: s0.x, MZ: s0.z + 2.5, mg() { return pisoBajo(v3(this.MX, s0.y + 20, this.MZ), 60) ?? (s0.y - 0.96); },
    caja(o) { const b = o.b, P = puntosForma(o.F.shape), mn = v3(1e9, 1e9, 1e9), mx = v3(-1e9, -1e9, -1e9); for (const v of P) { const w = vadd(b.q.rot(v), b.pos); mn.x = Math.min(mn.x, w.x); mn.y = Math.min(mn.y, w.y); mn.z = Math.min(mn.z, w.z); mx.x = Math.max(mx.x, w.x); mx.y = Math.max(mx.y, w.y); mx.z = Math.max(mx.z, w.z); } return { min: mn, max: mx }; },
    // (el jugador: dónde está parado y hacia dónde mira —en grados de vuelta, 0: al norte—)
    yo(x, z, yaw, pitch) { const p = this.W(x, z, 0.97); JUG.pos.x = p.x; JUG.pos.z = p.z; if (JUG.pos.y < p.y - 0.3 || JUG.pos.y > p.y + 3) JUG.pos.y = p.y; if (yaw !== undefined) JUG.yaw = yaw; if (pitch !== undefined) JUG.pitch = pitch; JUG.vel.x = 0; JUG.vel.z = 0; },
    mirarA(p, t) { const d = vsub(p, vadd(JUG.pos, v3(0, 0.66, 0))); return Math.atan2(d.x, d.z); },
    // (los movimientos de GMod: agacharse y pararse seguido, saltar, pegar con la palanca)
    agachadas(t, a, b) { return t >= a && t < b && Math.floor((t - a) * 7.5) % 2 === 0; },
    pj(sk, x, z, yaw, act, nombre) { const P = npcCrear(sk, this.W(x, z, 0), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); if (P && nombre) this.tags.push([P, nombre]); return P; },
    posDe(x) { if (!x) return null; if (x.rag) { const h = x.rag.cuerpos && x.D && x.D.h && x.rag.cuerpos.get(x.D.h.Hips); return h ? h.b.pos : x.pos; } if (x.D && x.pos) return x.pos; const b = x.b || x.body; return b ? b.pos : x.pos || null; },
    boom(p, esc) { const n0 = PART.l.length, l0 = LUCES_T.length; efectoExplosion(p, esc); for (let i = n0; i < PART.l.length; i++) { const q = PART.l[i]; if (q.tipo === 'fog') q.tam *= 0.3; } for (let i = l0; i < LUCES_T.length; i++) LUCES_T[i].c = LUCES_T[i].c.map((x) => x * 0.22); },
    polvo(p, n, c) { for (let i = 0; i < (n || 16); i++) { const r = () => Math.random() - 0.5; particula(v3(p.x + r() * 0.6, p.y + 0.03, p.z + r() * 0.4), v3(r() * 3, Math.random() * 1.0 + 0.2, r() * 2), 0.5 + Math.random() * 0.6, 0.2 + Math.random() * 0.25, c || [0.82, 0.74, 0.62, 0.55], 'humo', 1.6); } },
    el(cls, id) { const o = $('trOver'); let e = o.querySelector('#' + id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; o.appendChild(e); } return e; },
    quitar(id) { const e = document.getElementById(id); if (e) e.remove(); },
    top(t) { const e = this.el('coTop', 'coTop'); if (!e._h) { e._h = 1; e.innerHTML = '¿Cuál llega primero? 🤔'; } },
    cap(t) {
      const p = this.PAL.find((x) => t >= x.t0 && t < x.t1), e = this.el('coCap', 'coCap');
      if (!p) { if (e._k !== -1) { e._k = -1; e.innerHTML = ''; } return; }
      if (e._k !== p.t0) { e._k = p.t0; e.innerHTML = '<span>' + p.w + (p.e ? ' ' + p.e : '') + '</span>'; }
      const a = Math.min(1, (t - p.t0) / 0.09), s = e.firstChild; if (s) s.style.transform = 'scale(' + (1 + (1 - a) * 0.28).toFixed(3) + ')';
    },
    chat(t) {
      const L = this.CHAT.filter((c) => t >= c[0] && t - c[0] < 7.5).slice(-4), e = this.el('coChat', 'coChat'), k = L.map((c) => c[0]).join(',');
      if (e._k !== k) { e._k = k; e.innerHTML = L.map((c) => '<div><b>' + c[1] + ':</b> ' + c[2] + '</div>').join(''); }
      const ult = e.lastChild; if (ult && L.length) { const a = Math.min(1, (t - L[L.length - 1][0]) / 0.15); ult.style.opacity = a; ult.style.transform = 'translateX(' + ((1 - a) * -14).toFixed(1) + 'px)'; }
    },
    kill(t) {
      const K = this.KILL.filter((x) => t >= x[0] && t < x[1]); if (!K.length) { this.quitar('coKill'); return; }
      const e = this.el('coKill', 'coKill'), k = K.map((x) => x[0]).join(','); if (e._k !== k) { e._k = k; e.innerHTML = K.map((x) => '<div>' + x[2] + ' ➜ 💀 ' + x[3] + '</div>').join(''); }
      [...e.children].forEach((d, i) => { const a = Math.min(1, (t - K[i][0]) / 0.15), z = Math.min(1, (K[i][1] - t) / 0.3); d.style.transform = 'translateX(' + ((1 - a) * 40).toFixed(1) + 'px) scale(' + (1 + (1 - a) * 0.25).toFixed(3) + ')'; d.style.opacity = Math.min(a, z).toFixed(3); });
    },
    tagsDibujar() {
      const o = $('trOver'); this.tags.forEach((T, i) => {
        const id = 'coTag' + i; let e = document.getElementById(id); const x = T[0], vivo = x && PERS.includes(x);
        const p = vivo && this.posDe(x), cl = p && clipDe(vadd(p, v3(0, x.rag ? 0.6 : 1.3, 0)));
        if (!cl || cl.y < VH() * 0.2 || cl.x < 34 || cl.x > VW() - 34 || cl.y > VH() * 0.95) { if (e) e.style.display = 'none'; return; }
        if (!e) { e = document.createElement('div'); e.id = id; e.className = 'coTag'; o.appendChild(e); }
        if (e._h !== T[1]) { e._h = T[1]; e.innerHTML = T[1]; } e.style.display = ''; e.style.transform = 'translate(' + cl.x.toFixed(1) + 'px,' + cl.y.toFixed(1) + 'px) translate(-50%,-100%)';
      });
    },
    sticker(id, html, t0, t1, x, y, rot) {
      const t = __tr.t; if (t < t0 || t > t1) { this.quitar(id); return; }
      const e = this.el('coStk', id); if (e._h !== html) { e._h = html; e.innerHTML = html; }
      const a = Math.min(1, (t - t0) / 0.2), reb = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.35 - (1 - a) * 0.9 : 1 + Math.sin((t - t0) * 5) * 0.025, z = Math.min(1, (t1 - t) / 0.12);
      e.style.left = x + '%'; e.style.top = y + '%'; e.style.opacity = z.toFixed(3);
      e.style.transform = 'translate(-50%,-50%) rotate(' + (rot || 0) + 'deg) scale(' + Math.max(0, reb * z).toFixed(3) + ')';
    },
    lienzo(s, rot, dx, dy) { const c = $('cv'), tr = (s && s !== 1) || rot || dx || dy ? 'translate(' + (dx || 0).toFixed(1) + 'px,' + (dy || 0).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg) scale(' + (s || 1).toFixed(4) + ')' : ''; if (c.style.transform !== tr) c.style.transform = tr; },
    todo(t) { this.top(t); this.cap(t); this.chat(t); this.kill(t); this.tagsDibujar(); },
  };`;
const CINE = (p, m, r) => `{ DBG.sinVista = true; const P = ${p}, M = ${m}; return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z], r: ${r || 0} }; }`;
const MESA = `const mg = CO.mg(), MX = CO.MX, MZ = CO.MZ;
  let mesa = crearObjeto('Table', v3(MX, mg, MZ), new Quat(), {}), bb = CO.caja(mesa);
  if (bb.max.x - bb.min.x < bb.max.z - bb.min.z) { borrarObjeto(mesa, true); mesa = crearObjeto('Table', v3(MX, mg, MZ), Quat.axis(0, 1, 0, Math.PI / 2), {}); bb = CO.caja(mesa); }
  mesa.b.pos.x += MX - (bb.min.x + bb.max.x) / 2; mesa.b.pos.z += MZ - (bb.min.z + bb.max.z) / 2; mesa.b.updateWorld(); mesa.b.frozen = true; bb = CO.caja(mesa);
  const top = bb.max.y, hx = (bb.max.x - bb.min.x) / 2, hz = (bb.max.z - bb.min.z) / 2;
  const cosas = [['bottle3', 0.86, 0.05], ['bottle4', 0.7, -0.4], ['Book1', -0.62, 0.0], ['Book2', -0.64, 0.05], ['Notebook', 0.48, -0.15], ['bottle3', -0.86, -0.3], ['Book1', -0.3, -0.45]].map(([n, fx, fz], i) => crearObjeto(n, v3(MX - fx * hx, top + 0.02 + (n === 'Book2' ? 0.08 : 0), MZ + fz * hz), Quat.axis(0, 1, 0, 0.3 + i * 0.9), {})).filter(Boolean);
  window.__A = { mesa, cosas, mg, MX, MZ, top, hx, hz };`;
export const ESCENAS = {
  // ---- 1. la pregunta: el que explica, la heladera y la pelota; le pega a cada una, gira, se agacha ----
  pregunta: {
    t0: 0, t1: 4.8, mapa: 'RB_Construct', espera: 3000, antes: 40,
    preparar: COMUN + `const h = crearObjeto('Heladera', CO.W(1.2, 1.1, 0), Quat.axis(0, 1, 0, Math.PI + 0.15), {}), p = crearObjeto('Pelota', CO.W(-1.1, 1.1, 0.05), new Quat(), {});
      CO.yo(0, 0, Math.PI, 0); window.__A = { h, p }; return 1;`,
    cada: `const t = __tr.t, A = window.__A, hp = A.h.b.pos, pp = A.p.b.pos;
      let yaw = Math.PI, pitch = 0.05;
      if (t > 0.55 && t < 1.55) { yaw = CO.mirarA(hp, t); pitch = 0.25; } else if (t >= 1.55 && t < 2.5) { yaw = CO.mirarA(pp, t); pitch = 0.45; } else if (t >= 2.6 && t < 3.1) yaw = Math.PI + (t - 2.6) * 12.57;
      CO.yo(0, 0, yaw, pitch); ENT.agachar = CO.agachadas(t, 0, 0.5) || CO.agachadas(t, 3.3, 4.7); ENT.saltar = t > 4.1 && t < 4.18; ENT.disparo = (t > 1.0 && t < 1.12) || (t > 2.0 && t < 2.12);`,
    cam: `const t = __tr.t, k = TRH.suave(t / 4.8); ${CINE('CO.W(0.4 - k * 0.3, -4.3 + k * 0.6, 1.5)', 'CO.W(0, 0.5, 1.0)', '(0.03 - k * 0.03)')}`,
    titulos: `CO.todo(__tr.t); CO.lienzo(1);`,
  },
  // ---- 2. la apuesta: la mesa (el de la tarjeta va en el montaje); al golpe las cosas saltan ----
  apuesta: {
    t0: 4.8, t1: 7.2, mapa: 'RB_Construct', espera: 3500, antes: 60,
    preparar: COMUN + `CO.yo(-6, -26, 0, 0); ${MESA} return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo(-6, -26, 0, 0);
      if (__tr.i === 1) { const P = (x, y, z) => { const c = clipDe(v3(x, y, z)); return c ? [+c.x.toFixed(1), +c.y.toFixed(1)] : null; };
        window.__dbg = { top: +(A.top - A.mg).toFixed(3), hx: +A.hx.toFixed(2), hz: +A.hz.toFixed(2), frente: P(A.MX, A.top, A.MZ - A.hz), fondo: P(A.MX, A.top, A.MZ + A.hz), atras: P(A.MX, A.top, A.MZ + A.hz + 0.25), arriba: P(A.MX, A.top + 1, A.MZ + A.hz + 0.25), vw: VW(), vh: VH() }; }
      if (__tr.i >= 0 && t >= ${GOLPE} && !A.g) { A.g = 1; for (const o of A.cosas) { o.b.wake && o.b.wake(); o.b.vel.set((Math.random() - 0.5) * 1.4, 2.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.9); o.b.ang.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10); } CO.polvo(v3(A.MX - 0.1, A.top, A.MZ + A.hz - 0.1), 30); }`,
    cam: `const A = window.__A; ${CINE('v3(A.MX, A.top + 0.5, A.MZ - 2.0)', 'v3(A.MX, A.top + 0.36, A.MZ + 0.3)', '0')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.sticker('apu', '<div class="coGrande" style="font-size:42px">APUESTA:<br>🧊 HELADERA</div>', ${GOLPE} + 0.08, 7.2, 50, 18, -3);`,
  },
  // ---- 3. la prueba: las dos colgadas a 11 m, 3-2-1, se sueltan, cámara lenta y cuadro congelado al tocar el piso ----
  caida: {
    t0: 7.2, t1: 13.4, mapa: 'RB_Construct', espera: 3000, antes: 30,
    preparar: COMUN + `const g = CO.g(0, 3), H = 11;
      const h = crearObjeto('Heladera', CO.W(1.1, 3, H), Quat.axis(0, 1, 0, Math.PI + 0.2), {}), p = crearObjeto('Pelota', CO.W(-1.1, 3, H), new Quat(), {});
      const bh = CO.caja(h), bp = CO.caja(p); p.b.pos.y += bh.min.y - bp.min.y; p.b.updateWorld();
      for (const o of [h, p]) { o.b.frozen = true; o.b.vel.set(0, 0, 0); o.b.ang.set(0, 0, 0); }
      CO.yo(0.2, -0.6, Math.PI, -0.7); window.__A = { h, p, g, suelta: 0, tp: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo(0.2, -0.6, Math.PI, t < 10.6 ? -0.75 : 0.1); ENT.agachar = CO.agachadas(t, 11.4, 12.6);
      if (__tr.i >= 0 && t >= 9.1 && !A.suelta) { A.suelta = 1; for (const o of [A.h, A.p]) { o.b.frozen = false; o.b.wake && o.b.wake(); o.b.vel.set(0, 0, 0); o.b.ang.set(0, 0, 0); } }
      if (A.suelta && A.tp > 90 && Math.min(CO.caja(A.h).min.y, CO.caja(A.p).min.y) < A.g + 0.05) { A.tp = t; window.__dbg = { toque: t, hel: +(CO.caja(A.h).min.y - A.g).toFixed(3), pel: +(CO.caja(A.p).min.y - A.g).toFixed(3) }; }`,
    ritmo: `const t = __tr.t, tp = window.__A.tp; return t < 10.35 ? 1 : t < tp ? 0.3 : t < tp + 0.7 ? 0.004 : 1;`,
    cam: `const t = __tr.t, A = window.__A, f = A.suelta ? Math.max(A.g, Math.min(CO.caja(A.h).min.y, CO.caja(A.p).min.y)) : A.g + 11; ${CINE('CO.W(0, -6.2, 0.55)', 'v3(CO.W(0, 3).x, A.g + Math.max(1.0, 0.74 * (f - A.g) + 0.4), CO.W(0, 3).z)', '0')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.lienzo(1);
      CO.sticker('c3', '<div class="coCuenta">3</div>', 7.6, 8.05, 50, 57, 0); CO.sticker('c2', '<div class="coCuenta">2</div>', 8.1, 8.55, 50, 57, 0); CO.sticker('c1', '<div class="coCuenta">1</div>', 8.6, 9.05, 50, 57, 0);
      if (t >= A.tp && t < A.tp + 1.3) { const e = CO.el('coLinea', 'coLinea'); e.style.opacity = Math.min(1, (t - A.tp) / 0.1); } else CO.quitar('coLinea');
      CO.sticker('emp', '<div class="coGrande">EMPATE 🤝</div>', A.tp + 0.05, A.tp + 1.6, 50, 30, -3);`,
  },
  // ---- 4. la explicación: camina entre las dos, le pega a la heladera, se agacha, gira, revolea la pelota, salta ----
  explica: {
    t0: 13.4, t1: 19.3, mapa: 'RB_Construct', espera: 3000, antes: 40,
    preparar: COMUN + `const h = crearObjeto('Heladera', CO.W(1.4, 2.4, 0), Quat.axis(0, 1, 0, Math.PI + 0.2), {}), p = crearObjeto('Pelota', CO.W(-1.3, 2.2, 0.05), new Quat(), {});
      CO.yo(0, 0.4, Math.PI, 0); window.__A = { h, p }; return 1;`,
    cada: `const t = __tr.t, A = window.__A, hp = A.h.b.pos, pp = A.p.b.pos; let x = 0, z = 0.4, yaw = Math.PI, pitch = 0.05;
      if (t < 14.7) { const k = TRH.suave((t - 13.4) / 0.8); x = k * 0.75; z = 0.4 + k * 0.9; yaw = CO.mirarA(hp, t); pitch = 0.2; }
      else if (t < 15.8) { x = 0.75; z = 1.3; yaw = Math.PI - 0.35; }
      else if (t < 16.4) { x = 0.75; z = 1.3; yaw = Math.PI + (t - 15.8) * 10.5; }
      else if (t < 17.6) { const k = TRH.suave((t - 16.4) / 0.6); x = 0.75 - k * 1.6; z = 1.3; yaw = CO.mirarA(pp, t); pitch = 0.45; }
      else { x = -0.85; z = 1.3; yaw = Math.PI; }
      CO.yo(x, z, yaw, pitch); ENT.agachar = CO.agachadas(t, 14.9, 15.7) || CO.agachadas(t, 18.4, 19.3); ENT.saltar = t > 18 && t < 18.08; ENT.disparo = (t > 14.25 && t < 14.37) || (t > 14.55 && t < 14.67) || (t > 17.15 && t < 17.27);`,
    cam: `const t = __tr.t, k = TRH.suave((t - 13.4) / 5.9), an = -0.35 + k * 0.6; ${CINE('CO.W(Math.sin(an) * 4.8, 1.6 - Math.cos(an) * 4.8, 1.55)', 'CO.W(0, 1.7, 0.9)', '0')}`,
    titulos: `CO.todo(__tr.t); CO.lienzo(1);`,
  },
  // ---- 5. «lo comprobé con Pepe»: una heladera cae desde arriba sobre Pepe ----
  pepe: {
    t0: 19.3, t1: 24.2, mapa: 'RB_Construct', espera: 3000, antes: 40,
    preparar: COMUN + `const pe = CO.pj('Engineer', 0, 2.2, Math.PI, { modo: 'quieto' }, 'Pepe');
      const h = crearObjeto('Heladera', CO.W(0.05, 2.2, 9), Quat.axis(0, 1, 0, Math.PI + 0.2), {}); h.b.frozen = true;
      CO.yo(1.5, 1.0, -2.2, 0); window.__A = { pe, h, cae: 0, tg: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo(1.5, 1.0, t < 22 ? CO.mirarA(A.pe.pos, t) : -2.2 - 0.3, t < 22 ? 0.1 : 0.15); ENT.agachar = CO.agachadas(t, 22.4, 24);
      if (__tr.i >= 0 && t >= 20.7 && !A.cae) { A.cae = 1; A.h.b.frozen = false; A.h.b.wake && A.h.b.wake(); A.h.b.vel.set(0, -1, 0); }
      if (A.cae && A.tg > 90 && CO.caja(A.h).min.y < A.pe.pos.y + 0.95) { A.tg = t; window.__dbg = { golpe: t }; npcTumbar(A.pe, v3(0.6, -2, 1.4)); if (A.pe.ia) A.pe.ia.ragT = 1e9; CO.polvo(vadd(A.pe.pos, v3(0, -0.9, 0)), 26); }`,
    cam: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 19.3) / 4.9), s = TRH.temblor(t, A.tg, 0.1); ${CINE('CO.W(-1.8 + k * 0.4 + s[0], -3.0 + s[2], 1.3 + s[1])', 'CO.W(0.3, 2.0, 1.4 + (t < 21.4 ? 1.2 : 0) * (1 - TRH.suave((t - 20.7) / 0.8)))', '0')}`,
    titulos: `const t = __tr.t, d = t - window.__A.tg, a = d >= 0 ? Math.max(0, 1 - d / 0.4) : 0; CO.todo(t); CO.lienzo(1 + a * 0.05, 0, Math.sin(t * 80) * a * 6, Math.cos(t * 70) * a * 6);`,
  },
  // ---- 6. seguime: el que explica mira a cámara, se agacha y salta ----
  fin: {
    t0: 24.2, t1: 26.4, mapa: 'RB_Construct', espera: 3000, antes: 40,
    preparar: COMUN + `CO.yo(0, 0, Math.PI, 0); return 1;`,
    cada: `const t = __tr.t; CO.yo(0, 0, Math.PI, -0.1); ENT.agachar = CO.agachadas(t, 24.3, 25.4); ENT.saltar = t > 25.6 && t < 25.68; ENT.disparo = t > 26 && t < 26.12;`,
    cam: `const t = __tr.t, k = TRH.suave((t - 24.2) / 2.2); ${CINE('CO.W(0.3, -2.6 + k * 0.5, 1.25)', 'CO.W(0, 0, 1.1)', '0')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1); CO.sticker('seg', '<div class="coSeguir">+ Seguir</div>', 25, 26.4, 50, 79, 0);`,
  },
};
