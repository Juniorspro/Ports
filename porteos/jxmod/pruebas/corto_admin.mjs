// corto vertical 3 (9:16, 30 s a 30 cuadros), en gm_construct: «POV: le diste admin a tu amigo». Cinco minutos, cada
// uno peor: Lucas te agarra con la Physics Gun, te deja flotando («¿cómo bajo?» «saltá» «ok»), un nene de 8 años se
// compra admin con la tarjeta de la mamá, llueven autos (kill feed lleno) y al final te banean de tu propio servidor.
// Subtítulos de a una palabra, blancos; el capítulo («MINUTO 1»…) grande al entrar; chat, kill feed apilado, nombres y el
// cartel de baneo de GMod hecho en HTML. La voz (Loquendo, Jorge), la música, los efectos y las plantillas de pantalla
// verde van en el montaje.
// uso: ESC=pruebas/corto_admin.mjs VW=540 VH=960 DPR=2 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA [escenas] [cada]
export const FPS = 30;
export const VOZ = [
  [0.25, [[0, 2.22, 'Le di admin a mi amigo por cinco minutos.']]],
  [3.50, [[0, 0.69, 'Minuto uno.']]],
  [8.30, [[0, 0.74, 'Minuto dos.']]],
  [13.30, [[0, 0.89, 'Minuto tres.'], [1.40, 4.84, 'Un nene de ocho años se compró admin con la tarjeta de la mamá.']]],
  [19.90, [[0, 0.83, 'Minuto cuatro.']]],
  [24.05, [[0, 0.91, 'Minuto cinco.']]],
  [25.30, [[0, 1.87, 'Me banearon de mi propio servidor.']]],
  [28.30, [[0, 1.09, 'Nunca des admin.']]],
];
const ESP = { admin: '👑', uno: '1️⃣', dos: '2️⃣', tres: '3️⃣', cuatro: '4️⃣', cinco: '5️⃣', mamá: '💳', banearon: '💀', nunca: '❌' };
const PAL = [];
for (const [t0, frases] of VOZ) for (const [a, b, txt] of frases) {
  const ws = txt.split(' '), pe = ws.map((w) => ((w.toLowerCase().match(/[aeiouáéíóúü]+/g) || ['a']).length + 0.12 * w.length)), tot = pe.reduce((x, y) => x + y, 0);
  let t = t0 + a; ws.forEach((w, i) => { const d = (b - a) * pe[i] / tot; const k = w.toLowerCase().replace(/[.,!?¿¡]/g, ''); PAL.push({ w: w.replace(/[.,]/g, ''), t0: +t.toFixed(3), t1: +(t + d).toFixed(3), e: ESP[k] || '' }); t += d; });
}
// (cada palabra queda hasta la siguiente si viene enseguida; si no, 0,3 s más)
PAL.forEach((p, i) => { const s = PAL[i + 1]; p.t1 = s && s.t0 - p.t1 < 0.35 ? s.t0 : +(p.t1 + 0.3).toFixed(3); });
const CAP = [[3.45, 'MINUTO 1'], [8.25, 'MINUTO 2'], [13.25, 'MINUTO 3'], [19.85, 'MINUTO 4'], [24.0, 'MINUTO 5']];
const CHATL = [
  [1.15, null, 'xX_Lucas_Xx ahora es ADMIN 👑'],
  [2.65, 'xX_Lucas_Xx', 'confía'],
  [5.5, 'Yo', 'BAJAME'],
  [6.3, 'xX_Lucas_Xx', 'no'],
  [7.1, 'Pepe', 'JAJSJAJSJAJ'],
  [9.3, 'Yo', '¿cómo bajo?'],
  [10.2, 'xX_Lucas_Xx', 'saltá'],
  [11.0, 'Yo', 'ok'],
  [15.0, null, 'Mati_2011 compró ADMIN 👑 (tarjeta: mamá)'],
  [16.15, 'Mati_2011', 'q hace este boton'],
  [16.85, 'xX_Lucas_Xx', 'NO TOQUES NADA'],
  [20.7, 'nico', 'q pasa'],
  [21.3, 'Pepe', 'AAAAAAAAAA'],
  [24.45, 'Mati_2011', 'gg ez'],
];
const KILL = [[12.45, 15.5, '🪂 Gravedad', 'Yo'], [21.0, 24.0, 'Mati_2011', 'xX_Lucas_Xx'], [21.35, 24.0, 'Mati_2011', 'Pepe'], [21.7, 24.0, 'Mati_2011', 'nico'], [22.15, 24.0, 'Mati_2011', 'Yo'], [22.75, 24.0, 'Mati_2011', 'Mati_2011']];
export const CSS = `
  #trOver{font-family:Inter,'Noto Color Emoji',sans-serif}
  #cv{will-change:transform}
  #trOver .coTop{position:absolute;left:5%;right:5%;top:7.4%;text-align:center;font:800 29px/1.2 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:6px #000;paint-order:stroke fill}
  #trOver .coCap{position:absolute;left:3%;right:3%;top:58%;text-align:center;font:900 58px/1 Inter,'Noto Color Emoji',sans-serif;text-transform:uppercase;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5))}
  #trOver .coCap span{display:inline-block}
  #trOver .coCap span.esp{font-size:70px}
  #trOver .coMin{position:absolute;left:0;top:0;font:900 30px/1 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:7px #000;paint-order:stroke fill;white-space:nowrap}
  #trOver .coChat{position:absolute;left:4%;width:78%;top:67%;font:700 17px/1.25 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #trOver .coChat div{display:table;background:rgba(0,0,0,.45);padding:4px 9px;border-radius:7px;margin-top:5px}
  #trOver .coChat b{font-weight:800}
  #trOver .coChat div.sis{font-style:italic;color:#e8e8e8}
  #trOver .coKill{position:absolute;right:4%;top:19.5%;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  #trOver .coKill div{font:800 15px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.62);padding:6px 10px;border-radius:7px;text-shadow:0 1px 2px #000;white-space:nowrap}
  #trOver .coTag{position:absolute;left:0;top:0;text-align:center;font:800 18px/1.1 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
  #trOver .coTag small{display:block;font:700 13px Inter,'Noto Color Emoji',sans-serif;margin-top:1px;opacity:.88}
  #trOver .coStk{position:absolute;left:0;top:0;white-space:nowrap;text-align:center}
  #trOver .coMira{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%)}
  #trOver .coMira:before,#trOver .coMira:after{content:'';position:absolute;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.55)}
  #trOver .coMira:before{left:10px;top:3px;width:2px;height:16px}#trOver .coMira:after{top:10px;left:3px;height:2px;width:16px}
  #trOver .coBan{position:absolute;left:6%;right:6%;top:21.5%;background:#2f3136;border:1px solid #111;border-radius:6px;box-shadow:0 14px 50px rgba(0,0,0,.7);color:#e6e6e6;font:500 19px/1.4 Inter,'Noto Color Emoji',sans-serif;overflow:hidden}
  #trOver .coBan .h{background:linear-gradient(#4a4d55,#3a3d44);padding:10px 14px;font-weight:700;font-size:18px;display:flex;justify-content:space-between;border-bottom:1px solid #111}
  #trOver .coBan .h i{font-style:normal;opacity:.7}
  #trOver .coBan .c{padding:16px 16px 6px}
  #trOver .coBan .c b{display:block;font-size:25px;color:#fff;margin-bottom:10px}
  #trOver .coBan .c p{margin:4px 0}
  #trOver .coBan .c em{font-style:normal;color:#ff8a80;font-weight:800}
  #trOver .coBan .pie{display:flex;justify-content:flex-end;gap:8px;padding:12px 14px}
  #trOver .coBan .pie span{background:#4f545c;border:1px solid #222;border-radius:4px;padding:6px 18px;font-weight:700;font-size:15px}
  #trOver .coSeguir{display:inline-block;background:#fe2c55;color:#fff;font:800 26px Inter,sans-serif;padding:12px 32px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #trOver .coEmo{font-size:110px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  #trOver .coGrande{font:900 54px/1.05 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:10px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5));text-align:center}
  body.trailer #hud .npcGlobo{font-size:17px!important;font-weight:700}
`;
// lo común: limpiar, la luz, la Physics Gun en la mano y las capas de arriba. B: el medio del pasto de gm_construct
// (al sur del lugar de aparición); W(x, z, h) es un punto respecto de B (z: hacia el edificio largo, al norte)
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarAgarre === 'function') soltarAgarre(); ARM.agarre = null; ENT.disparo = false;
  PREFS.evento = false; DIA.ciclo = false; DIA.hora = 15.0; DIA.aplicada = -1; JUG.tercera = false; JUG.vel.set(0, 0, 0); JUG.vida = 1e7; DBG.cam = null; DBG.sinVista = false; PREFS.fov = 78; DBG.fovVista = 96;
  elegirArma(ARM.lista.indexOf('PhysicsGun'));
  $('cv').style.transform = ''; $('cv').style.filter = ''; $('cv').style.transformOrigin = '50% 50%';
  const s0 = MUNDO.spawns[0], BX = s0.x + 8, BZ = s0.z - 28;
  window.TRH = {
    blanco(v) { let e = document.querySelector('#trOver .trBlanco'); if (!e) { e = document.createElement('div'); e.className = 'trBlanco'; $('trOver').appendChild(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    rapido(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 4); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };
  window.CO = {
    PAL: ${JSON.stringify(PAL)}, CAP: ${JSON.stringify(CAP)}, CHAT: ${JSON.stringify(CHATL)}, KILL: ${JSON.stringify(KILL)}, tags: [], mira: true,
    g(x, z) { return pisoBajo(v3(BX + x, s0.y + 30, BZ + z), 80) ?? (s0.y - 0.96); },
    W(x, z, h) { return v3(BX + x, this.g(x, z) + (h || 0), BZ + z); },
    pj(sk, x, z, yaw, act, nombre, sub) { const P = npcCrear(sk, this.W(x, z, 0), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); if (P && nombre) this.tags.push([P, nombre, sub || '']); return P; },
    emote(P, e) { if (!P || !P.act) return; P.act.emote = e; P.emote = null; },
    posDe(x) { if (!x) return null; if (x.rag) { const h = x.rag.cuerpos && x.D && x.D.h && x.rag.cuerpos.get(x.D.h.Hips); return h ? h.b.pos : x.pos; } if (x.D && x.pos) return x.pos; const b = x.b || x.body; return b ? b.pos : x.pos || null; },
    cabeza(P) { return vadd(P.pos, v3(0, 0.72 * (P.escVis || 1) - (1 - (P.escVis || 1)) * 0.96, 0)); },
    fp(x, z) { const p = this.W(x, z, 0.97); JUG.pos.set(p.x, p.y, p.z); JUG.vel.set(0, 0, 0); },
    ojo() { return vadd(JUG.pos, v3(0, 0.66, 0)); },
    mirar(p, t, k) { const e = this.ojo(), d = vsub(p, e), m = (k === undefined ? 1 : k); JUG.yaw = Math.atan2(d.x, d.z) + Math.sin(t * 1.9) * 0.006 * m + Math.sin(t * 4.3 + 1) * 0.003 * m; JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)) + Math.sin(t * 2.3 + 2) * 0.005 * m; },
    agarrar(o, dist) { const P = o.D ? o : null; for (let r = 0; r < 8 && !ARM.agarre; r++) { ENT.disparo = false; cuadro(window.__T += 1000 / 30); for (let i = 0; i < 3; i++) { const q = P ? vadd(P.pos, v3(0, 0.2, 0)) : (o.b || o.body || o).pos, d = vsub(q, this.ojo()); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); ENT.disparo = true; cuadro(window.__T += 1000 / 30); } } if (ARM.agarre && dist) ARM.agarre.dist = dist; return !!ARM.agarre; },
    girar(a, b) { if (ARM.agarre) ARM.agarre.qrel = Quat.axis(0, 1, 0, a).mul(Quat.axis(1, 0, 0, b || 0)).mul(ARM.agarre.qrel); },
    boom(p, esc) { const n0 = PART.l.length, l0 = LUCES_T.length; efectoExplosion(p, esc); for (let i = n0; i < PART.l.length; i++) { const q = PART.l[i]; if (q.tipo === 'fog') q.tam *= 0.3; } for (let i = l0; i < LUCES_T.length; i++) LUCES_T[i].c = LUCES_T[i].c.map((x) => x * 0.22); },
    el(cls, id) { const o = $('trOver'); let e = o.querySelector('#' + id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; o.appendChild(e); } return e; },
    quitar(id) { const e = document.getElementById(id); if (e) e.remove(); },
    top() { const e = this.el('coTop', 'coTop'); if (!e._h) { e._h = 1; e.innerHTML = 'POV: le diste admin<br>a tu amigo 💀'; } },
    // (de a una palabra: entra grande y se asienta)
    cap(t) {
      const p = this.PAL.find((x) => t >= x.t0 && t < x.t1), e = this.el('coCap', 'coCap');
      if (!p) { if (e._k !== -1) { e._k = -1; e.innerHTML = ''; } return; }
      if (e._k !== p.t0) { e._k = p.t0; e.innerHTML = '<span class="' + (p.e ? 'esp' : '') + '">' + p.w + (p.e ? ' ' + p.e : '') + '</span>'; }
      const a = Math.min(1, (t - p.t0) / 0.09), s = e.firstChild; if (s) s.style.transform = 'scale(' + (1 + (1 - a) * (p.e ? 0.55 : 0.3)).toFixed(3) + ') rotate(' + ((1 - a) * (p.e ? -6 : -2)).toFixed(2) + 'deg)';
    },
    // (el capítulo: grande al medio al entrar y después chiquito arriba a la izquierda)
    capitulo(t) {
      let c = null; for (const x of this.CAP) if (t >= x[0]) c = x; if (!c) { this.quitar('coMin'); return; }
      const e = this.el('coMin', 'coMin'); const h = '⏱️ ' + c[1]; if (e._h !== h) { e._h = h; e.innerHTML = h; }
      const d = t - c[0], a = Math.min(1, d / 0.18), m = TRH.suave((d - 1.0) / 0.35), W = VW(), H = VH();
      const s = (1 + (1 - a) * 0.8) * (1.9 - m * 1.15), x = W / 2 + (W * 0.04 + 70 - W / 2) * m, y = H * 0.33 + (H * 0.2 - H * 0.33) * m;
      e.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + s.toFixed(3) + ')'; e.style.opacity = Math.min(1, a * 2).toFixed(3);
    },
    chat(t) {
      const L = this.CHAT.filter((c) => t >= c[0] && t - c[0] < 7.5).slice(-4), e = this.el('coChat', 'coChat'), k = L.map((c) => c[0]).join(',');
      if (e._k !== k) { e._k = k; e.innerHTML = L.map((c) => c[1] ? '<div><b>' + c[1] + ':</b> ' + c[2] + '</div>' : '<div class="sis">' + c[2] + '</div>').join(''); }
      const ult = e.lastChild; if (ult && L.length) { const a = Math.min(1, (t - L[L.length - 1][0]) / 0.15); ult.style.opacity = a; ult.style.transform = 'translateX(' + ((1 - a) * -14).toFixed(1) + 'px)'; }
    },
    // (el kill feed: todas las que van, apiladas; la nueva entra de costado)
    kill(t) {
      const K = this.KILL.filter((x) => t >= x[0] && t < x[1]); if (!K.length) { this.quitar('coKill'); return; }
      const e = this.el('coKill', 'coKill'), k = K.map((x) => x[0]).join(','); if (e._k !== k) { e._k = k; e.innerHTML = K.map((x) => '<div>' + x[2] + ' ➜ 💀 ' + x[3] + '</div>').join(''); }
      [...e.children].forEach((d, i) => { const a = Math.min(1, (t - K[i][0]) / 0.15), z = Math.min(1, (K[i][1] - t) / 0.3); d.style.transform = 'translateX(' + ((1 - a) * 40).toFixed(1) + 'px) scale(' + (1 + (1 - a) * 0.25).toFixed(3) + ')'; d.style.opacity = Math.min(a, z).toFixed(3); });
    },
    tagsDibujar() {
      const o = $('trOver'), z = this.zoomK || 1; this.tags.forEach((T, i) => {
        const id = 'coTag' + i; let e = document.getElementById(id); const x = T[0], vivo = x && (x.D ? PERS.includes(x) && x.visible !== false : OBJS.includes(x));
        const p = vivo && this.posDe(x), cl0 = p && clipDe(vadd(p, v3(0, T[3] || (x.escVis ? 1.3 * x.escVis - (1 - x.escVis) * 0.96 + 0.1 : 1.3), 0)));
        const cl = cl0 && { x: (cl0.x - VW() / 2) * z + VW() / 2, y: (cl0.y - VH() / 2) * z + VH() / 2 };
        if (!cl || cl.y < VH() * 0.2 || cl.x < 34 || cl.x > VW() - 34 || cl.y > VH() * 0.95) { if (e) e.style.display = 'none'; return; }
        if (!e) { e = document.createElement('div'); e.id = id; e.className = 'coTag'; o.appendChild(e); }
        const h = T[1] + (T[2] ? '<small>' + T[2] + '</small>' : ''); if (e._h !== h) { e._h = h; e.innerHTML = h; }
        e.style.display = ''; e.style.transform = 'translate(' + cl.x.toFixed(1) + 'px,' + cl.y.toFixed(1) + 'px) translate(-50%,-100%)';
      });
    },
    sticker(id, html, t0, t1, x, y, rot) {
      const t = __tr.t; if (t < t0 || t > t1) { this.quitar(id); return; }
      const e = this.el('coStk', id); if (e._h !== html) { e._h = html; e.innerHTML = html; }
      const a = Math.min(1, (t - t0) / 0.24), reb = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.35 - (1 - a) * 0.9 : 1 + Math.sin((t - t0) * 5) * 0.025, z = Math.min(1, (t1 - t) / 0.12);
      e.style.left = x + '%'; e.style.top = y + '%'; e.style.opacity = z.toFixed(3);
      e.style.transform = 'translate(-50%,-50%) rotate(' + (rot || 0) + 'deg) scale(' + Math.max(0, reb * z).toFixed(3) + ')';
    },
    // (el cartel de GMod cuando te echan: aparece de golpe, con un saltito)
    baneo(t, t0, t1) { if (t < t0 || t > t1) { this.quitar('coBan'); return; } const e = this.el('coBan', 'coBan');
      if (!e._h) { e._h = 1; e.innerHTML = '<div class="h"><span>Desconectado</span><i>✕</i></div><div class="c"><b>Fuiste baneado de este servidor.</b><p>Motivo: <em>llorón 😭</em></p><p>Baneado por: <em>Mati_2011</em> (8 años)</p><p>Duración: <em>para siempre</em></p><p>Servidor: Servidor de Yo 🏠</p></div><div class="pie"><span>Cerrar</span></div>'; }
      const a = Math.min(1, (t - t0) / 0.12); e.style.transform = 'scale(' + (1.12 - a * 0.12).toFixed(3) + ')'; e.style.opacity = Math.min(1, a * 1.6).toFixed(3); },
    lienzo(s, rot, dx, dy, ox, oy) { this.zoomK = s || 1; const c = $('cv'), tr = (s && s !== 1) || rot || dx || dy ? 'translate(' + (dx || 0).toFixed(1) + 'px,' + (dy || 0).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg) scale(' + (s || 1).toFixed(4) + ')' : ''; if (c.style.transform !== tr) c.style.transform = tr; const o = (ox === undefined ? 50 : ox) + '% ' + (oy === undefined ? 50 : oy) + '%'; if (c.style.transformOrigin !== o) c.style.transformOrigin = o; },
    filtro(f) { const c = $('cv'); if (c.style.filter !== f) c.style.filter = f; },
    golpe(t, tb) { const d = t - tb; this.filtro(d >= 0 && d < 0.034 ? 'invert(1) contrast(1.6) saturate(0)' : d >= 0.034 && d < 0.067 ? 'brightness(1.5) contrast(1.2)' : ''); },
    todo(t) { this.top(); this.cap(t); this.capitulo(t); this.chat(t); this.kill(t); this.tagsDibujar(); const m = this.el('coMira', 'coMira'); m.style.display = !DBG.cam && this.mira ? '' : 'none'; },
  };`;
const CINE = (p, m, r) => `{ DBG.sinVista = true; const P = ${p}, M = ${m}; return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z], r: ${r || 0} }; }`;
const N = 0, S = Math.PI;   // (mirando al norte —hacia el edificio largo— o al sur)
export const ESCENAS = {
  // ---- 0. el gancho: Lucas ahora es admin y saca músculos; «confía» y zoom ----
  admin: {
    t0: 0, t1: 3.4, mapa: 'RB_Construct', espera: 3000, antes: 50,
    preparar: COMUN + `CO.fp(0, -6.5);
      const lu = CO.pj('Ninja', 0.2, -2.6, ${S}, { modo: 'bailar', emote: 'rb:Musculos' }, 'xX_Lucas_Xx', '👑 ADMIN');
      CO.pj('Engineer', -2.6, -0.6, ${S} + 0.3, { modo: 'bailar', emote: 'Clap' }, 'Pepe', ''); CO.pj('Astronauta', 2.7, 0.4, ${S} - 0.3, { modo: 'bailar', emote: 'Hi' }, 'nico', '');
      window.__A = { lu }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.fp(0, -6.5 + Math.min(1, t / 3.4) * 0.8); CO.mirar(vadd(A.lu.pos, v3(0, 0.3 - Math.max(0, t - 2.6) * 0.15, 0)), t, 1.2);`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); if (t > 2.65) { const q = TRH.rapido((t - 2.65) / 0.25), cl = clipDe(CO.cabeza(A.lu)); CO.lienzo(1 + q * 0.32, 0, 0, 0, cl ? cl.x / VW() * 100 : 50, cl ? cl.y / VH() * 100 : 45); } else CO.lienzo(1);`,
  },
  // ---- 1. minuto uno: Lucas me agarra con la Physics Gun y me revolea (su primera persona) ----
  agarre: {
    t0: 3.4, t1: 8.2, mapa: 'RB_Construct', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -6.5);
      const yo = CO.pj('Hero', 0.15, -3.2, ${N}, { modo: 'quieto' }, 'Yo', '20 min jugadas');
      CO.pj('Engineer', -2.8, -1.2, ${S} + 0.4, { modo: 'bailar', emote: 'Clap' }, 'Pepe', ''); CO.pj('Astronauta', 3.0, -0.3, ${S} - 0.4, { modo: 'bailar', emote: 'rb:Sacudite' }, 'nico', '');
      window.__A = { yo, ag: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.fp(0, -6.5); if (__tr.i < 0) { CO.mirar(vadd(A.yo.pos, v3(0, 0.2, 0)), t); }
      if (__tr.i === 6 && !A.ag) { A.ag = 1; CO.agarrar(A.yo, 3.3); A.y1 = JUG.yaw; A.p1 = JUG.pitch; }
      if (A.ag) { ENT.disparo = true; const k = TRH.suave((t - 3.7) / 4.3); JUG.yaw = A.y1 + Math.sin((t - 3.6) * 3.2) * 0.42 * (0.3 + k); JUG.pitch = A.p1 - k * 0.62 + Math.sin(t * 5) * 0.03; CO.girar(0.09, 0.05); }
      else if (__tr.i >= 0) CO.mirar(vadd(A.yo.pos, v3(0, 0.2, 0)), t);`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1.02 + 0.02 * Math.sin(t * 2));`,
  },
  // ---- 2. minuto dos: me deja flotando en el aire, sentado; silencio; «saltá» «ok»: me caigo ----
  flota: {
    t0: 8.2, t1: 13.2, mapa: 'RB_Construct', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40);
      const yo = CO.pj('Hero', 0, 3, ${S}, { modo: 'quieto' }, 'Yo', '🧊 congelado');
      const lu = CO.pj('Ninja', -1.7, 1.4, ${S} + 0.4, { modo: 'bailar', emote: 'rb:Musculos' }, 'xX_Lucas_Xx', '👑 ADMIN');
      CO.pj('Engineer', -2.4, 1.0, ${S} + 0.5, { modo: 'bailar', emote: 'Clap' }, 'Pepe', ''); CO.pj('Astronauta', 3.4, 2.4, ${S} - 0.6, { modo: 'bailar', emote: 'Hi' }, 'nico', '');
      window.__A = { yo, lu, cae: 0, tc: 99 }; return 1;`,
    // (congelado en el aire con la Physics Gun, como en GMod: el muñeco cae un poquito, se congela en esa pose y en «ok» se suelta)
    cada: `const t = __tr.t, A = window.__A, R = A.yo.rag;
      if (!A.rag) { const p = CO.W(0, 3, 3.3); A.yo.pos.set(p.x, p.y + 0.96, p.z); A.yo.vel.set(0, 0, 0); A.yo.yaw = ${S}; if (__tr.i === -30) { A.rag = 1; npcTumbar(A.yo, v3(0.6, 1.5, -1.2)); A.yo.ia.ragT = 1e9; A.tr = 0; } }
      else if (R && !A.helado && ++A.tr > 9) { A.helado = 1; for (const c of R.cuerpos.values()) { c.b.frozen = true; c.b.vel.set(0, 0, 0); c.b.ang.set(0, 0, 0); } }
      if (__tr.i >= 0 && t >= 11.4 && !A.cae && R) { A.cae = 1; A.tc = t; for (const c of R.cuerpos.values()) { c.b.frozen = false; c.b.wake && c.b.wake(); c.b.vel.set(0.3, -1, -0.2); } }`,
    cam: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 8.2) / 5), s = TRH.temblor(t, 12.4, 0.08); ${CINE('CO.W(1.1 - k * 0.3 + s[0], -0.9 + k * 0.3, 0.7 + s[1])', 'CO.W(0.3, 3, 2.6 - TRH.suave((t - 11.45) / 0.7) * 1.9)', '0.04')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.sticker('grillos', '<div class="coEmo" style="font-size:70px">🦗</div>', 9.0, 11.2, 82, 40, 8); const a = t > 12.4 ? Math.max(0, 1 - (t - 12.4) / 0.4) : 0; CO.lienzo(1.02 + a * 0.08, 0, Math.sin(t * 80) * a * 6, Math.cos(t * 70) * a * 6);`,
  },
  // ---- 3. minuto tres: un nene de 8 años (chiquito) con admin; baila; «q hace este boton» ----
  nene: {
    t0: 13.2, t1: 19.8, mapa: 'RB_Construct', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40);
      const ma = CO.pj('Robot', 0, 0, ${S}, { modo: 'bailar', emote: 'rb:Gracioso' }, 'Mati_2011', '8 años'); ma.escVis = 0.58;
      const lu = CO.pj('Ninja', 1.25, 0.5, ${S} - 0.3, { modo: 'bailar', emote: 'Disagree' }, 'xX_Lucas_Xx', '👑 ADMIN');
      window.__A = { ma, lu, ok: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i >= 0 && t >= 15.0 && !A.ok) { A.ok = 1; CO.tags[0][2] = '8 años · 👑 ADMIN'; CO.emote(A.ma, 'Victory'); }
      if (__tr.i >= 0 && t >= 16.9 && A.ok === 1) { A.ok = 2; CO.emote(A.lu, 'Scream'); }`,
    cam: `const t = __tr.t, A = window.__A, h = CO.cabeza(A.ma), k = TRH.suave((t - 13.2) / 4); ${CINE('v3(h.x + 0.75, h.y + 0.35, h.z - 3.9 + k * 1.1)', 'v3(h.x + 0.6, h.y + 0.05, h.z)', '(0.05 - k * 0.04)')}`,
    titulos: `const t = __tr.t; CO.todo(t); const a = t > 15.0 ? Math.max(0, 1 - (t - 15.0) / 0.35) : 0; CO.lienzo(1.02 + a * 0.1, a * 2, 0, 0); CO.sticker('boton', '<div class="coEmo" style="font-size:80px">🔴</div>', 16.15, 17.2, 74, 44, 0);`,
  },
  // ---- 4. minuto cuatro: llueven autos sobre el pasto, explosiones, todos corren; el kill feed se llena ----
  autos: {
    t0: 19.8, t1: 24.0, mapa: 'RB_Construct', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40);
      const L = [CO.pj('Ninja', -1.5, 3, ${S}, { modo: 'pasear', vel: 1.3 }, 'xX_Lucas_Xx', ''), CO.pj('Engineer', 2, 5, ${S}, { modo: 'pasear', vel: 1.3 }, 'Pepe', ''), CO.pj('Astronauta', -3.5, 7, ${S}, { modo: 'pasear', vel: 1.3 }, 'nico', ''), CO.pj('Hero', 0.8, 1, ${S}, { modo: 'quieto' }, 'Yo', '')];
      window.__A = { L, n: 0, b: [21.0, 21.35, 21.7, 22.15, 22.75], nb: 0, corre: 0, tb: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A;
      if (__tr.i >= 0 && __tr.i % 2 === 0 && A.n < 24) for (let j = 0; j < 2; j++) { const k = A.n++; const o = crearObjeto('Sedan', CO.W(Math.sin(k * 2.39996) * (1.5 + (k * 37 % 50) / 50 * 6), 4 + Math.cos(k * 2.39996) * (1.5 + (k * 53 % 50) / 50 * 6), 14 + (k % 4) * 3), Quat.axis(Math.sin(k), 1, Math.cos(k), k * 1.3), {}); if (o) { o.b.vel.set(0, -12, 0); o.b.ang.set(Math.sin(k) * 2, 1, Math.cos(k) * 2); } }
      if (__tr.i >= 0 && t >= 20.4 && !A.corre) { A.corre = 1; for (const P of A.L) if (P && P.act) { P.act.modo = 'huir'; P.act.obj = 'yo'; P.act.dist = 80; P.act.vel = 6.5; P.emote = null; P.act.emote = ''; } }
      while (A.nb < A.b.length && t >= A.b[A.nb]) { const k = A.nb++, P = A.L[Math.min(k, A.L.length - 1)], p = P ? P.pos : CO.W(0, 4, 0); const q = v3(p.x + 0.3, p.y - 0.7, p.z); explosion.sinFx = true; explosion(q, 5, 300); explosion.sinFx = false; CO.boom(q, 0.75); if (P && !P.rag) { npcTumbar(P, v3(Math.sin(k) * 3, 9, 3)); } if (P && P.ia) P.ia.ragT = 1e9; A.tb = t; }`,
    ritmo: `const t = __tr.t; return t < 22.2 ? 1 : t < 22.8 ? 0.35 : 1;`,
    cam: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 19.8) / 4.2), s = TRH.temblor(t, A.tb, 0.12); ${CINE('CO.W(6.5 - k * 2 + s[0], -7 + k * 1.5, 0.5 + k * 0.6 + s[1])', 'CO.W(-0.5, 4.5, 3.2 - k * 1.2)', '(-0.08 + k * 0.08)')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.golpe(t, A.tb); const d = t - A.tb, a = d >= 0 ? Math.max(0, 1 - d / 0.4) : 0; CO.lienzo(1.03 + a * 0.08, a * 2 * Math.sin(t * 60), Math.sin(t * 91) * a * 8, Math.cos(t * 79) * a * 7);`,
  },
  // ---- 5. minuto cinco: Mati arriba de los autos festejando; el cartel de baneo ----
  baneo: {
    t0: 24.0, t1: 27.6, mapa: 'RB_Construct', espera: 3500, antes: 60,
    preparar: COMUN + `CO.fp(0, -40);
      for (let k = 0; k < 9; k++) crearObjeto('Sedan', CO.W(Math.sin(k * 2.4) * 3.2, 6.5 + Math.cos(k * 2.4) * 2.2, 1 + (k % 3) * 1.8), Quat.axis(Math.sin(k), 1, Math.cos(k), k * 1.7), {});
      const ma = CO.pj('Robot', 0.2, 1.6, ${S}, { modo: 'bailar', emote: 'rb:Gracioso' }, 'Mati_2011', '8 años · 👑 ADMIN'); ma.escVis = 0.58;
      window.__A = { ma }; return 1;`,
    cam: `const t = __tr.t, A = window.__A, h = CO.cabeza(A.ma), k = TRH.suave((t - 24) / 1.4); ${CINE('v3(h.x + 0.9 - k * 0.3, h.y + 0.15, h.z - 3.0 + k * 0.9)', 'v3(h.x, h.y - 0.1, h.z + 1.5)', '0.06')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.baneo(t, 25.0, 27.6); CO.filtro(t >= 25.0 ? 'blur(6px) brightness(0.55) saturate(0.6)' : ''); CO.lienzo(1 + (t >= 25 ? 0.04 : 0));`,
  },
  // ---- 6. «nunca des admin»: Yo sentado solo afuera; seguime ----
  final: {
    t0: 27.6, t1: 30.0, mapa: 'RB_Construct', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40); const yo = CO.pj('Hero', 0, -9, ${N} + 0.4, { modo: 'bailar', emote: 'Sitting' }, 'Yo', 'baneado 😭'); window.__A = { yo }; return 1;`,
    cam: `const t = __tr.t, A = window.__A, h = CO.cabeza(A.yo), k = TRH.suave((t - 27.6) / 2.4); ${CINE('v3(h.x + 0.9, h.y + 0.1, h.z + 2.6 - k * 0.6)', 'v3(h.x, h.y - 0.45, h.z)', '0')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1); CO.sticker('mor', '<div class="coGrande">MORALEJA 👇</div>', 27.75, 30, 50, 30, -3); CO.sticker('seg', '<div class="coSeguir">+ Seguir</div>', 28.9, 30.0, 50, 79, 0);`,
  },
};
