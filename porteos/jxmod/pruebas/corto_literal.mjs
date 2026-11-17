// un corto vertical (9:16, 30 s a 30 cuadros) para TikTok, como los videos de GMod de ahí: gameplay en primera persona
// (la Physics Gun agarrando autos y piedras en la ciudad), cortes rápidos, cámara lenta, cuadro congelado, zooms de golpe,
// temblor, «impact frames», muñecos de trapo volando, la tabla de jugadores, chat y kill feed; letras blancas con borde
// negro (subtítulos que aparecen palabra por palabra). El humor es literal: Pepe «se quedó de piedra» y se vuelve una
// roca, «llueve a cántaros» y caen baldes, Juan «se murió de risa» y explota. La voz (Loquendo, Jorge), la música y los
// efectos van aparte (el montaje); acá están los tiempos de cada línea, para los subtítulos.
// uso: ESC=pruebas/corto_literal.mjs VW=540 VH=960 DPR=2 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA [escenas] [cada]
export const FPS = 30;
// la voz: [segundo en que empieza la línea, [[desde, hasta (dentro de la línea), texto], …]] (medido con silencedetect)
export const VOZ = [
  [0.30, [[0, 2.93, 'Me dijeron que en este juego podía hacer cualquier cosa.'], [3.43, 4.66, 'Así que lo tomé literal.']]],
  [5.40, [[0, 2.16, 'Mi amigo Pepe dijo que se quedó de piedra.']]],
  [10.10, [[0, 2.50, 'Después avisaron que iba a llover a cántaros.']]],
  [15.90, [[0, 1.33, 'Y Juan se murió de risa.'], [1.83, 2.61, 'Literalmente.']]],
  [22.40, [[0, 1.88, 'Ahora nadie quiere jugar conmigo.'], [2.39, 3.49, 'No entiendo por qué.']]],
  [27.90, [[0, 1.47, 'Seguime para la parte dos.']]],
];
// las palabras que van solas y grandes (con su emoji)
const ESP = { literal: '💀', piedra: '🗿', 'cántaros': '🪣', risa: '😂', literalmente: '💀', dos: '👉' };
const PAL = [];
for (const [t0, frases] of VOZ) for (const [a, b, txt] of frases) {
  const ws = txt.split(' '), pe = ws.map((w) => ((w.toLowerCase().match(/[aeiouáéíóúü]+/g) || ['a']).length + 0.12 * w.length)), tot = pe.reduce((x, y) => x + y, 0);
  let t = t0 + a; ws.forEach((w, i) => { const d = (b - a) * pe[i] / tot; PAL.push({ w, t0: +t.toFixed(3), t1: +(t + d).toFixed(3), fin: i === ws.length - 1 }); t += d; });
}
const REN = []; let cur = null;
for (const p of PAL) {
  const k = p.w.toLowerCase().replace(/[.,!?¿¡]/g, ''), esp = ESP[k];
  if (!cur || esp || cur.esp || cur.ws.length >= 3 || cur.ws.map((x) => x.w).join(' ').length + p.w.length > 15) { cur = { ws: [], esp: !!esp }; REN.push(cur); }
  cur.ws.push({ ...p, k, esp }); if (p.fin || esp) cur = null;
}
REN.forEach((r, i) => { r.t0 = r.ws[0].t0; const sig = REN[i + 1], fin = r.ws[r.ws.length - 1].t1; r.t1 = sig && sig.t0 - fin < 0.45 ? sig.t0 : fin + 0.3; });
const CHATL = [
  [8.55, 'xX_Lucas_Xx', 'pepe?? 💀'],
  [9.25, 'Pepe', 'no me puedo mover'],
  [13.85, 'xX_Lucas_Xx', '¿¿QUIÉN TIRA BALDES??'],
  [14.55, 'Mati_2011', 'JAJAJAJA'],
  [19.85, null, 'Juan_xd se desconectó (motivo: se murió de risa)'],
  [20.65, 'xX_Lucas_Xx', 'F'],
  [21.25, 'Pepe 🗿', 'F'],
  [23.30, null, 'xX_Lucas_Xx se desconectó'],
  [24.10, null, 'Pepe 🗿 se desconectó'],
];
const KILL = [[18.72, 23.0, '😂 Risa', 'Juan_xd']];
export const CSS = `
  #trOver{font-family:Inter,'Noto Color Emoji',sans-serif}
  #cv{will-change:transform}
  #trOver .coTop{position:absolute;left:5%;right:5%;top:7.6%;text-align:center;font:800 28px/1.2 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:6px #000;paint-order:stroke fill;letter-spacing:-.01em}
  #trOver .coCap{position:absolute;left:3%;right:3%;top:57%;text-align:center;font:900 46px/1.08 Inter,'Noto Color Emoji',sans-serif;text-transform:uppercase;color:#fff;-webkit-text-stroke:10px #000;paint-order:stroke fill;letter-spacing:-.01em;filter:drop-shadow(0 4px 0 rgba(0,0,0,.5))}
  #trOver .coCap span{display:inline-block;margin:0 .09em;transform-origin:50% 70%}
  #trOver .coCap .esp{font-size:66px}
  #trOver .coCap .esp.largo{font-size:52px}
  #trOver .coChat{position:absolute;left:4%;width:78%;top:67%;font:700 17px/1.25 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #trOver .coChat div{display:table;background:rgba(0,0,0,.45);padding:4px 9px;border-radius:7px;margin-top:5px}
  #trOver .coChat b{font-weight:800}
  #trOver .coChat div.sis{font-style:italic;color:#e8e8e8}
  #trOver .coKill{position:absolute;right:4%;top:19.5%;font:800 16px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.62);padding:7px 11px;border-radius:7px;text-shadow:0 1px 2px #000}
  #trOver .coTag{position:absolute;left:0;top:0;text-align:center;font:800 18px/1.1 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
  #trOver .coTag small{display:block;font:700 13px Inter,sans-serif;margin-top:1px;opacity:.85}
  #trOver .coStk{position:absolute;left:0;top:0;white-space:nowrap;text-align:center}
  #trOver .coMira{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%)}
  #trOver .coMira:before,#trOver .coMira:after{content:'';position:absolute;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.55)}
  #trOver .coMira:before{left:10px;top:3px;width:2px;height:16px}#trOver .coMira:after{top:10px;left:3px;height:2px;width:16px}
  #trOver .coVin{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 38%,rgba(0,0,0,.85) 100%);opacity:0}
  #trOver .coNoti{position:absolute;left:4%;right:4%;top:19%;background:rgba(246,246,248,.96);color:#111;border-radius:18px;padding:11px 13px;font:500 14px/1.3 Inter,'Noto Color Emoji',sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.4);display:flex;gap:11px;align-items:center}
  #trOver .coNoti .ic{flex:none;width:38px;height:38px;border-radius:9px;background:#ff9f0a;display:flex;align-items:center;justify-content:center;font-size:22px}
  #trOver .coNoti b{display:block;font-weight:700;font-size:13px;color:#555}
  #trOver .coNoti em{font-style:normal;font-weight:800}
  #trOver .coTab{position:absolute;left:6%;right:6%;top:21%;background:rgba(18,18,22,.84);border-radius:10px;color:#fff;font:600 15px/1 Inter,'Noto Color Emoji',sans-serif;padding:12px 14px 8px;box-shadow:0 8px 30px rgba(0,0,0,.45)}
  #trOver .coTab .h{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:9px;border-bottom:1px solid rgba(255,255,255,.18);margin-bottom:6px}
  #trOver .coTab .h b{font-size:20px;font-weight:900}#trOver .coTab .h span{font-size:13px;opacity:.8}
  #trOver .coTab .f{display:grid;grid-template-columns:1fr 70px 50px;padding:7px 4px;border-radius:5px}
  #trOver .coTab .f.cab{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;padding:3px 4px}
  #trOver .coTab .f.yo{background:rgba(255,255,255,.1)}
  #trOver .coTab .f span:nth-child(n+2){text-align:right}
  #trOver .coSeguir{display:inline-block;background:#fe2c55;color:#fff;font:800 26px Inter,sans-serif;padding:12px 32px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #trOver .coP2{font:900 66px/1 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5))}
  #trOver .coNota{font:italic 700 18px Inter,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 3px #000}
  #trOver .coEmo{font-size:120px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  body.trailer #hud .npcGlobo{font-size:17px!important;font-weight:700}
`;
// lo común de cada escena: limpiar, la luz de la tarde, la Physics Gun en la mano y las capas de arriba
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarFisica === 'function') soltarFisica(); ARM.agarre = null; ENT.disparo = false;
  PREFS.evento = false; DIA.ciclo = false; DIA.hora = 15.0; DIA.aplicada = -1; JUG.tercera = false; JUG.vel.set(0, 0, 0); JUG.vida = 1e7; DBG.cam = null; DBG.sinVista = false; PREFS.fov = 78; DBG.fovVista = 96;
  elegirArma(ARM.lista.indexOf('PhysicsGun'));
  $('cv').style.transform = ''; $('cv').style.filter = ''; $('cv').style.transformOrigin = '50% 50%';
  window.TRH = {
    blanco(v) { let e = document.querySelector('#trOver .trBlanco'); if (!e) { e = document.createElement('div'); e.className = 'trBlanco'; $('trOver').appendChild(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    rapido(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 4); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };
  window.CO = {
    REN: ${JSON.stringify(REN)}, CHAT: ${JSON.stringify(CHATL)}, KILL: ${JSON.stringify(KILL)}, tags: [], mira: true, cvT: '',
    g(x, z) { return pisoBajo(v3(x, 30, z), 60) ?? 0.43; },
    W(x, z, h) { return v3(x, this.g(x, z) + (h || 0), z); },
    // (un jugador de mentira: un personaje con su nombre arriba)
    pj(sk, x, z, yaw, act, nombre, sub) { const P = npcCrear(sk, v3(x, this.g(x, z), z), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); if (P && nombre) this.tags.push([P, nombre, sub || '']); return P; },
    emote(P, e) { if (!P || !P.act) return; P.act.emote = e; P.emote = null; },
    posDe(x) { if (!x) return null; if (x.rag) { const h = x.rag.cuerpos && x.D && x.D.h && x.rag.cuerpos.get(x.D.h.Hips); return h ? h.b.pos : x.pos; } if (x.D && x.pos) return x.pos; const b = x.b || x.body; return b ? b.pos : x.pos || null; },
    cabeza(P) { return vadd(P.pos, v3(0, 0.72 * (P.tam || 1), 0)); },
    // (la primera persona: el jugador parado en x, z mirando a un punto, con el pulso de la mano)
    fp(x, z) { JUG.pos.set(x, this.g(x, z) + 0.97, z); JUG.vel.set(0, 0, 0); },
    ojo() { return vadd(JUG.pos, v3(0, 0.66, 0)); },
    mirar(p, t, k) { const e = this.ojo(), d = vsub(p, e), m = (k === undefined ? 1 : k); JUG.yaw = Math.atan2(d.x, d.z) + Math.sin(t * 1.9) * 0.006 * m + Math.sin(t * 4.3 + 1) * 0.003 * m; JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)) + Math.sin(t * 2.3 + 2) * 0.005 * m; },
    // (agarra con la Physics Gun: apunta, aprieta y da unos pasos; si no agarró, suelta y prueba de nuevo)
    agarrar(o, dist) { const b = o.b || o.body || o; for (let r = 0; r < 8 && !ARM.agarre; r++) { ENT.disparo = false; cuadro(window.__T += 1000 / 30); for (let i = 0; i < 3; i++) { const d = vsub(b.pos, this.ojo()); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); ENT.disparo = true; cuadro(window.__T += 1000 / 30); } } if (ARM.agarre && dist) ARM.agarre.dist = dist; return !!ARM.agarre; },
    girar(a, b) { if (ARM.agarre) ARM.agarre.qrel = Quat.axis(0, 1, 0, a).mul(Quat.axis(1, 0, 0, b || 0)).mul(ARM.agarre.qrel); },
    puf(p, n, tam) { for (let i = 0; i < (n || 8); i++) { const r = () => Math.random() - 0.5; particula(v3(p.x + r() * 0.5, p.y + r() * 0.8, p.z + r() * 0.5), v3(r() * 2.6, Math.random() * 1.2 + 0.3, r() * 2.6), 0.35 + Math.random() * 0.3, (tam || 0.28) * (0.8 + Math.random() * 0.5), [0.95, 0.95, 0.95, 0.7], 'humo', 1.1); } },
    fuego(p, k) { const r = () => Math.random() - 0.5; for (let i = 0; i < (k || 2); i++) { const x = particula(v3(p.x + r() * 0.9, p.y + Math.random() * 0.3, p.z + r() * 0.9), v3(r() * 0.6, 1.4 + Math.random() * 1.2, r() * 0.6), 0.45 + Math.random() * 0.35, 0.32 + Math.random() * 0.25, [1, 1, 1, 1], 'fuego', 1.3); if (x) { x.rampa = 1; x.suave = 1; x.fr = 1.2; } }
      if (Math.random() < 0.7) particula(v3(p.x + r() * 0.6, p.y + 1.2, p.z + r() * 0.6), v3(r() * 0.5, 2 + Math.random(), r() * 0.5), 3.2, 0.9 + Math.random() * 0.5, [0.16, 0.15, 0.15, 0.62], 'humo', 2.2); },
    el(cls, id) { const o = $('trOver'); let e = o.querySelector('#' + id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; o.appendChild(e); } return e; },
    quitar(id) { const e = document.getElementById(id); if (e) e.remove(); },
    top() { const e = this.el('coTop', 'coTop'); if (!e._h) { e._h = 1; e.innerHTML = 'POV: el juego te deja hacer<br>CUALQUIER cosa 💀'; } },
    // (el subtítulo: las palabras aparecen cuando se dicen, cada una con un saltito; las marcadas, solas y grandes)
    cap(t) {
      const R = this.REN.find((r) => t >= r.t0 && t < r.t1), e = this.el('coCap', 'coCap');
      if (!R) { if (e._k !== -1) { e._k = -1; e.innerHTML = ''; } return; }
      if (e._k !== R.t0) { e._k = R.t0; e.innerHTML = R.ws.map((w) => { const l = w.w.replace(/[.,]/g, ''), largo = l.length > 8; return '<span class="' + (w.esp ? 'esp' + (largo ? ' largo' : '') : '') + '">' + l + (w.esp ? (largo ? '<br>' : ' ') + w.esp : '') + '</span>'; }).join(' '); }
      [...e.children].forEach((s, j) => { const w = R.ws[j], d = t - w.t0; if (d < 0) { s.style.opacity = 0; return; } const a = Math.min(1, d / (w.esp ? 0.16 : 0.1)); s.style.opacity = 1; s.style.transform = 'scale(' + (1 + (1 - a) * (w.esp ? 0.7 : 0.35)).toFixed(3) + ')' + (w.esp ? ' rotate(' + ((1 - a) * -7).toFixed(2) + 'deg)' : ''); });
    },
    chat(t) {
      const L = this.CHAT.filter((c) => t >= c[0] && t - c[0] < 7.5).slice(-4), e = this.el('coChat', 'coChat'), k = L.map((c) => c[0]).join(',');
      if (e._k !== k) { e._k = k; e.innerHTML = L.map((c) => c[1] ? '<div><b>' + c[1] + ':</b> ' + c[2] + '</div>' : '<div class="sis">' + c[2] + '</div>').join(''); }
      const ult = e.lastChild; if (ult && L.length) { const a = Math.min(1, (t - L[L.length - 1][0]) / 0.15); ult.style.opacity = a; ult.style.transform = 'translateX(' + ((1 - a) * -14).toFixed(1) + 'px)'; }
    },
    kill(t) { const K = this.KILL.find((x) => t >= x[0] && t < x[1]); if (!K) { this.quitar('coKill'); return; } const e = this.el('coKill', 'coKill'); if (!e._h) { e._h = 1; e.innerHTML = K[2] + ' ➜ 💀 ' + K[3]; } const a = Math.min(1, (t - K[0]) / 0.15); e.style.transform = 'translateX(' + ((1 - a) * 40).toFixed(1) + 'px) scale(' + (1 + (1 - a) * 0.3).toFixed(3) + ')'; e.style.opacity = Math.min(a, (K[1] - t) / 0.3); },
    tagsDibujar() {
      const o = $('trOver'), z = this.zoomK || 1; this.tags.forEach((T, i) => {
        const id = 'coTag' + i; let e = document.getElementById(id); const x = T[0], vivo = x && (x.D ? PERS.includes(x) : OBJS.includes(x));
        const p = vivo && this.posDe(x), cl0 = p && clipDe(vadd(p, v3(0, T[3] || 1.3, 0)));
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
    tabla(t, filas, n) { if (!filas) { this.quitar('coTab'); return; } const e = this.el('coTab', 'coTab'), h = '<div class="h"><b>JXMod</b><span>Sandbox · City · ' + n + '/32</span></div><div class="f cab"><span>Jugador</span><span>Muertes</span><span>Ping</span></div>' + filas.map((f) => '<div class="f' + (f[3] ? ' yo' : '') + '"><span>' + f[0] + '</span><span>' + f[1] + '</span><span>' + f[2] + '</span></div>').join(''); if (e._h !== h) { e._h = h; e.innerHTML = h; } },
    // (el lienzo: zoom, giro y corrimiento —la cámara «de edición»—; y el cuadro del golpe —«impact frame»—)
    lienzo(s, rot, dx, dy, ox, oy) { this.zoomK = s || 1; const c = $('cv'), tr = (s && s !== 1) || rot || dx || dy ? 'translate(' + (dx || 0).toFixed(1) + 'px,' + (dy || 0).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg) scale(' + (s || 1).toFixed(4) + ')' : ''; if (c.style.transform !== tr) c.style.transform = tr; const o = (ox === undefined ? 50 : ox) + '% ' + (oy === undefined ? 50 : oy) + '%'; if (c.style.transformOrigin !== o) c.style.transformOrigin = o; },
    golpe(t, tb) { const d = t - tb, c = $('cv'); const f = d >= 0 && d < 0.034 ? 'invert(1) contrast(1.6) saturate(0)' : d >= 0.034 && d < 0.067 ? 'brightness(1.5) contrast(1.2)' : ''; if (c.style.filter !== f) c.style.filter = f; },
    noti(t, t0, t1, html) { if (t < t0 || t > t1) { this.quitar('coNoti'); return; } const e = this.el('coNoti', 'coNoti'); if (e._h !== html) { e._h = html; e.innerHTML = html; } const a = TRH.rapido((t - t0) / 0.3), z = Math.min(1, (t1 - t) / 0.2); e.style.transform = 'translateY(' + ((1 - a) * -120 - (1 - z) * 60).toFixed(1) + 'px)'; e.style.opacity = Math.min(a * 1.5, z).toFixed(3); },
    // (una explosión que se ve sin tapar todo: el destello —la «niebla» del primer instante— más chico)
    boom(p, esc) { const n0 = PART.l.length, l0 = LUCES_T.length; efectoExplosion(p, esc); for (let i = n0; i < PART.l.length; i++) { const q = PART.l[i]; if (q.tipo === 'fog') q.tam *= 0.3; } for (let i = l0; i < LUCES_T.length; i++) LUCES_T[i].c = LUCES_T[i].c.map((x) => x * 0.22); },
    vin(v) { const e = this.el('coVin', 'coVin'); e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    todo(t) { this.top(); this.cap(t); this.chat(t); this.kill(t); this.tagsDibujar(); const m = this.el('coMira', 'coMira'); m.style.display = !DBG.cam && this.mira ? '' : 'none'; },
  };`;
// (la cámara de cine: de dónde a adónde, en coordenadas del mundo)
const CINE = (p, m, r) => `{ DBG.sinVista = true; const P = ${p}, M = ${m}; return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z], r: ${r || 0} }; }`;
export const ESCENAS = {
  // ---- 1. arranca con acción: la Physics Gun levanta un auto en plena avenida ----
  auto: {
    t0: 0, t1: 1.3, mapa: 'City', espera: 2500, antes: 20,
    preparar: COMUN + `CO.fp(0, -6);
      const o = crearObjeto('Sedan', CO.W(0.6, 1.5, 0.9), Quat.axis(0, 1, 0, 1.45), {});
      CO.pj('Ninja', 9.4, 7, Math.PI, { modo: 'pasear', vel: 1.4 }, 'xX_Lucas_Xx', '3.449 h'); CO.pj('Pirata', -9.6, 11, Math.PI * 0.75, { modo: 'bailar', emote: 'Hi' }, 'Juan_xd', '2.023 h');
      window.__A = { o }; return 1;`,
    listo: `CO.fp(0, -6); window.__agarro = CO.agarrar(window.__A.o, 6.2); window.__A.y1 = JUG.yaw; window.__A.p1 = JUG.pitch;`,
    cada: `ENT.disparo = true; CO.fp(0, -6); const t = __tr.t, A = window.__A; if (__tr.i >= 0) { const k = TRH.suave(t / 1.3); JUG.yaw = A.y1 - 0.32 + k * 0.6 + Math.sin(t * 2.1) * 0.006; JUG.pitch = A.p1 - 0.05 - k * 0.3 + Math.sin(t * 2.7) * 0.005; CO.girar(0.035, 0.012); }`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1 + 0.04 * Math.sin(t * 1.3));`,
  },
  // ---- 2. el auto vuela contra los barriles: explosión y los amigos por el aire, en cámara lenta ----
  boom: {
    t0: 1.3, t1: 2.4, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40);
      for (let f = 0; f < 2; f++) for (let i = 0; i < 3 - f; i++) crearObjeto(f ? 'CajaMadera' : 'Barril', CO.W(-1 + (i - (2 - f) / 2) * 0.8, 22, 0.5 + f * 0.9), new Quat(), {});
      crearObjeto('Contenedor', CO.W(-1.5, 26, 1.4), Quat.axis(0, 1, 0, 0.2), {});
      const ju = CO.pj('Pirata', -3.3, 21.4, -2.6, { modo: 'bailar', emote: 'Clap' }, 'Juan_xd', ''), lu = CO.pj('Ninja', 1.7, 22.6, -2.2, { modo: 'bailar', emote: 'Hi' }, 'xX_Lucas_Xx', '');
      window.__A = { ju, lu, tb: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i === 0) { A.o = crearObjeto('Sedan', CO.W(0.4, 12.2, 2.6), Quat.axis(0.3, 1, 0.2, 1.3), {}); A.o.b.vel.set(-0.35, 2.2, 15.5); A.o.b.ang.set(1.6, 2.2, 0.4); }
      if (__tr.i >= 0 && A.tb > 90 && A.o && (A.o.b.pos.z > 19.6 || t > 1.8)) { A.tb = t; window.__dbg = { tb: t }; explosion.sinFx = true; explosion(CO.W(-1, 22, 1), 9, 260); explosion.sinFx = false; CO.boom(CO.W(-1, 22, 1), 0.85); }`,
    ritmo: `const t = __tr.t, tb = window.__A.tb; return t < tb + 0.22 ? 1 : t < tb + 0.68 ? 0.3 : Math.min(1, 0.3 + (t - tb - 0.68) * 2.5);`,
    cam: `const t = __tr.t, k = TRH.suave((t - 1.3) / 1.1), s = TRH.temblor(t, window.__A.tb, 0.22); ${CINE('CO.W(7.4 - k * 1.0 + s[0], 12.6 + k * 1.2, 0.35 + k * 0.6 + s[1])', 'CO.W(-0.8, 21.5, 2.2 + k * 0.8)', '(-0.06 + k * 0.05)')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.golpe(t, A.tb); const d = t - A.tb, a = d > 0 ? Math.max(0, 1 - d / 0.5) : 0; CO.lienzo(1.04 + a * 0.1, a * 2.5 * Math.sin(t * 60), Math.sin(t * 97) * a * 9, Math.cos(t * 83) * a * 8);`,
  },
  // ---- 3. «cualquier cosa»: aparecen cosas una atrás de otra y se apilan ----
  cosas: {
    t0: 2.4, t1: 3.7, mapa: 'City', espera: 2000, antes: 20,
    preparar: COMUN + `CO.fp(-1, -5); window.__A = { n: 0, L: ['CajaMadera', 'Heladera', 'Barril', 'Lavarropas', 'Sedan', 'Neumatico', 'CajaMadera', 'Contenedor', 'Barril', 'Heladera'], tp: -9 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.fp(-1, -5); CO.mirar(CO.W(0, 4.5, 1.4 + Math.max(0, t - 2.4) * 0.9), t);
      if (__tr.i >= 0 && __tr.i % 4 === 0 && A.n < A.L.length) { const k = A.n++, x = Math.sin(k * 2.3) * 1.4, z = 4.5 + Math.cos(k * 1.7) * 1.1, p = CO.W(x, z, 2.2 + k * 0.45); crearObjeto(A.L[k], p, Quat.axis(Math.sin(k), 1, Math.cos(k), k * 1.9), {}); CO.puf(p, 6, 0.3); A.tp = t; }`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); const a = Math.max(0, 1 - (t - A.tp) / 0.12); CO.lienzo(1 + a * 0.035, 0, 0, a * 4);`,
  },
  // ---- 4. «así que lo tomé literal»: zoom de golpe a la cara ----
  cara: {
    t0: 3.7, t1: 5.2, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40); const yo = CO.pj('Hero', -9.6, 3, Math.PI / 2, { modo: 'quieto' }, '', ''); yo.arma = 'PhysicsGun';
      CO.pj('Ninja', -11.4, 5.6, Math.PI * 0.62, { modo: 'bailar', emote: 'Disagree' }, 'xX_Lucas_Xx', '');
      window.__A = { yo }; return 1;`,
    cam: `const t = __tr.t, A = window.__A, h = CO.cabeza(A.yo);
      if (t < 4.42) { const k = TRH.suave((t - 3.7) / 0.72); ${CINE('v3(h.x + 2.3 - k * 0.5, h.y - 0.3 + k * 0.1, h.z + 0.35)', 'v3(h.x, h.y - 0.05, h.z)', '(0.1 - k * 0.04)')} }
      const s = TRH.temblor(t, 4.42, 0.025); ${CINE('v3(h.x + 0.62 + s[0], h.y + 0.02 + s[1], h.z + 0.04 + s[2])', 'v3(h.x, h.y + 0.02, h.z)', '-0.04')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.golpe(t, 4.42); if (t > 4.42) { const a = Math.max(0, 1 - (t - 4.42) / 0.45); CO.lienzo(1.06 + a * 0.16, a * 3 * Math.sin(t * 70), Math.sin(t * 90) * a * 7, Math.cos(t * 77) * a * 6); } else CO.lienzo(1 + (t - 3.7) * 0.03);`,
  },
  // ---- 5. Pepe dice que se quedó de piedra… ¡puf!, roca; zoom dramático y la Physics Gun la levanta ----
  pepe: {
    t0: 5.2, t1: 10.0, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(-8.9, 6.2);
      const pe = CO.pj('Engineer', -9.9, 11.4, Math.PI * 0.94, { modo: 'bailar', emote: 'Hi' }, 'Pepe', '1.459 h');
      CO.pj('Ninja', -11.6, 13.4, Math.PI * 0.8, { modo: 'bailar', emote: 'Clap' }, 'xX_Lucas_Xx', '3.449 h');
      CO.pj('Robot', -5.5, 17, Math.PI * 1.1, { modo: 'pasear', vel: 1.3 }, 'Mati_2011', '12 h');
      window.__A = { pe, roca: null, tr: 99, ag: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 5.2) / 2.4);
      if (!A.roca) { CO.fp(-8.9 - k * 0.3, 6.2 + k * 2.4 + Math.sin(t * 9) * 0.02); CO.mirar(CO.cabeza(A.pe), t, 1.6); JUG.pitch += Math.sin(t * 9.4) * 0.01; }
      if (__tr.i === 4) npcDecir(A.pe, 'me quedé de piedra jaja');
      if (t >= 7.62 && !A.roca) { const p = A.pe.pos.clone(); if (A.pe.globo) { A.pe.globo.remove(); A.pe.globo = null; } CO.puf(p, 10, 0.32); npcQuitar(A.pe); A.roca = crearObjeto('Rock3', v3(p.x, CO.g(p.x, p.z) + 0.75, p.z), Quat.axis(0, 1, 0, 0.7), {}); CO.tags[0] = [A.roca, 'Pepe 🗿', 'ahora es una piedra', 1.15]; A.tr = t; }
      if (A.roca && t < 8.45) { CO.fp(-9.2, 8.6); CO.mirar(CO.posDe(A.roca), t, 0.5); }
      if (A.roca && t >= 8.45) { if (!A.ag) { A.ag = 1; CO.agarrar(A.roca, 3.4); A.y1 = JUG.yaw; A.p1 = JUG.pitch; } ENT.disparo = true; CO.fp(-9.2, 8.6); const q = TRH.suave((t - 8.5) / 1.1); JUG.yaw = A.y1 + q * 0.25 + Math.sin(t * 2) * 0.006; JUG.pitch = A.p1 - q * 0.55; CO.girar(0.05, 0.02); }`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.golpe(t, A.tr);
      if (t >= A.tr && t < 8.45) { const q = TRH.suave((t - A.tr) / 0.75); CO.lienzo(1 + q * 0.34, -q * 5, 0, 0, 50, 54); CO.vin(q * 0.9); }
      else { const a = t >= 8.45 ? Math.max(0, 1 - (t - 8.45) / 0.18) : 0; CO.lienzo(1 + a * 0.06); CO.vin(0); }
      CO.sticker('moai', '<div class="coEmo">🗿</div>', 7.75, 8.45, 74, 36, 8);`,
  },
  // ---- 6. «llover a cántaros»: el aviso del clima, la cámara mira al cielo: baldes; abajo, todos corren ----
  baldes: {
    t0: 10.0, t1: 15.7, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(2, -3);
      const L = [CO.pj('Ninja', 5, 8, Math.PI * 0.9, { modo: 'pasear', vel: 1.4 }, 'xX_Lucas_Xx', ''), CO.pj('Pirata', -3, 12, Math.PI * 1.1, { modo: 'pasear', vel: 1.3 }, 'Juan_xd', ''),
        CO.pj('Robot', 1, 16, Math.PI, { modo: 'bailar', emote: 'rb:Sacudite' }, 'Mati_2011', ''), CO.pj('Astronauta', -6.5, 6, Math.PI * 0.7, { modo: 'pasear', vel: 1.2 }, 'nico', '')];
      const r = crearObjeto('Rock3', CO.W(-8.8, 9, 0.75), Quat.axis(0, 1, 0, 0.7), {}); CO.tags.push([r, 'Pepe 🗿', '', 1.15]);
      window.__A = { L, n: 0, corre: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.fp(2, -3);
      if (__tr.i >= 0 && t >= 10.6 && t < 12.2 && __tr.i % 2 === 0) for (let j = 0; j < 3; j++) { const k = A.n++, x = Math.sin(k * 2.39996) * (2 + (k * 37 % 50) / 50 * 7), z = 3 + (k * 53 % 100) / 100 * 22; crearObjeto('Cubeta', CO.W(x, z, 22 + (k * 7 % 11)), Quat.axis(Math.sin(k), 1, Math.cos(k * 1.7), k * 1.3), {}); }
      if (t >= 12.9 && !A.corre) { A.corre = 1; for (const P of A.L) if (P) { P.act.modo = 'huir'; P.act.obj = 'yo'; P.act.dist = 60; P.act.vel = 6.5; P.emote = null; P.act.emote = ''; } }
      if (t < 12.7) { const sube = TRH.rapido((t - 11.78) / 0.28), m = CO.W(0.6, 14, 1.4 + sube * 26); CO.mirar(m, t, 1.4 + sube * 3); }`,
    ritmo: `const t = __tr.t; return t < 13.3 ? 1 : t < 13.95 ? 0.35 : Math.min(1, 0.35 + (t - 13.95) * 2.5);`,
    cam: `const t = __tr.t; if (t < 12.7) { DBG.cam = null; DBG.sinVista = false; return null; }
      const k = TRH.suave((t - 12.7) / 3), s = TRH.temblor(t, 13.35, 0.06), s2 = TRH.temblor(t, 14.1, 0.04); ${CINE('CO.W(5.4 - k * 1.6 + s[0] + s2[0], 4.4 + k * 1.5, 0.28 + k * 0.25 + s[1] + s2[1])', 'CO.W(-1.5, 14, 2.6 - k * 0.6)', '(0.07 - k * 0.05)')}`,
    titulos: `const t = __tr.t; CO.todo(t);
      if (t >= 11.78 && t < 12.7) { const a = Math.max(0, 1 - (t - 11.78) / 0.35); CO.lienzo(1 + a * 0.05, 0, Math.sin(t * 40) * 2, Math.cos(t * 50) * 2); }
      else if (t >= 13.1 && t < 15.2) { const a = 0.5 + 0.5 * Math.sin(t * 13); CO.lienzo(1.03, Math.sin(t * 7) * 0.6, Math.sin(t * 61) * 3 * a, Math.cos(t * 47) * 3 * a); } else CO.lienzo(1);
      CO.noti(t, 10.35, 11.85, '<div class="ic">⛈️</div><div><b>CLIMA · ahora</b><em>Alerta:</em> hoy llueve a cántaros 🪣</div>');
      CO.sticker('nota', '<div class="coNota">*no había cántaros, son baldes</div>', 14.45, 15.7, 50, 50, -3);`,
  },
  // ---- 7. Juan se ríe… y explota: cámara lenta, cuadro congelado y el kill feed ----
  risa: {
    t0: 15.7, t1: 22.2, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0.2, 0);
      const ju = CO.pj('Pirata', 0.4, 3.3, Math.PI, { modo: 'bailar', emote: 'rb:Gracioso' }, 'Juan_xd', '2.023 h');
      CO.pj('Ninja', 3.2, 7.2, Math.PI * 1.15, { modo: 'bailar', emote: 'Clap' }, 'xX_Lucas_Xx', ''); CO.pj('Robot', -3.6, 8.5, Math.PI * 0.85, { modo: 'bailar', emote: 'Victory' }, 'Mati_2011', '');
      window.__A = { ju, tb: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (t < 18.62) { CO.fp(0.2, 0); CO.mirar(vadd(A.ju.pos, v3(0, 0.25, 0)), t, 1.2); }
      if (__tr.i === 16) npcDecir(A.ju, 'JAJAJAJAJAJA');
      if (t >= 18.6 && A.tb > 90) { A.tb = t; if (A.ju.globo) { A.ju.globo.remove(); A.ju.globo = null; } const p = A.ju.pos, q = v3(p.x - 0.1, CO.g(p.x, p.z) + 0.2, p.z - 0.3); CO.boom(q, 0.5); npcTumbar(A.ju, v3(0.9, 11.5, 4.2)); A.ju.ia.ragT = 1e9; A.ju.vida = 0; CO.tags[0][2] = '💀'; }`,
    ritmo: `const t = __tr.t, tb = window.__A.tb; return t < tb + 0.12 ? 1 : t < 19.3 ? 0.3 : t < 19.9 ? 0.015 : Math.min(1, 0.3 + (t - 19.9) * 1.4);`,
    cam: `const t = __tr.t, A = window.__A; if (t < 18.62) { DBG.cam = null; DBG.sinVista = false; return null; }
      const j = CO.posDe(A.ju) || A.ju.pos, k = TRH.suave((t - 18.62) / 3.4), an = -1.25 + k * 0.9, s = TRH.temblor(t, 18.62, 0.18), r = 5.6 + k * 0.8, g = CO.g(j.x, j.z);
      ${CINE('v3(j.x + Math.sin(an) * r + s[0], g + 0.55 + k * 1.4 + s[1], j.z - Math.cos(an) * r + s[2])', 'v3(j.x, Math.max(g + 0.6, j.y), j.z)', '(0.1 - k * 0.12)')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.golpe(t, A.tb);
      if (t >= 17.73 && t < 18.62) { const q = TRH.rapido((t - 17.73) / 0.14), cl = clipDe(CO.cabeza(A.ju)); CO.lienzo(1 + q * 0.3, Math.sin(t * 50) * 0.8 * q, 0, 0, cl ? cl.x / VW() * 100 : 50, cl ? cl.y / VH() * 100 : 45); }
      else if (t >= 18.62) { const a = Math.max(0, 1 - (t - 18.62) / 0.5), f = t >= 19.3 && t < 19.9 ? TRH.suave((t - 19.3) / 0.6) * 0.1 : t >= 19.9 ? 0.1 * Math.max(0, 1 - (t - 19.9) / 0.25) : 0; CO.lienzo(1.03 + a * 0.12 + f, a * 3 * Math.sin(t * 66), Math.sin(t * 93) * a * 10, Math.cos(t * 81) * a * 9); CO.vin(f * 6); }
      else { CO.lienzo(1); CO.vin(0); }`,
  },
  // ---- 8. «nadie quiere jugar conmigo»: la tabla de jugadores se vacía; la cámara sube y se ve el desastre ----
  solo: {
    t0: 22.2, t1: 27.7, mapa: 'City', espera: 3000, antes: 40,
    preparar: COMUN + `CO.fp(0, -2);
      for (let k = 0; k < 46; k++) { const x = Math.sin(k * 2.39996) * (1.5 + (k * 37 % 50) / 50 * 7), z = 1 + (k * 53 % 100) / 100 * 24; crearObjeto('Cubeta', CO.W(x, z, 0.5 + (k % 3) * 0.3), Quat.axis(Math.sin(k), 1, Math.cos(k), k * 1.1), {}); }
      crearObjeto('Sedan', CO.W(-3.5, 11, 1.6), Quat.axis(0, 0, 1, Math.PI * 0.97).mul(Quat.axis(0, 1, 0, 0.6)), {}); crearObjeto('Sedan', CO.W(4.2, 17, 1.6), Quat.axis(1, 0, 0.3, 1.6), {});
      crearObjeto('Contenedor', CO.W(-5.5, 21, 1.6), Quat.axis(0, 0, 1, 0.5), {}); crearObjeto('CajaMadera', CO.W(2.2, 8, 0.6), Quat.axis(0, 1, 0, 0.4), {}); crearObjeto('Heladera', CO.W(-1.8, 15, 0.9), Quat.axis(1, 0, 0, 1.5), {});
      const lu = CO.pj('Ninja', -1.1, 1.9, Math.PI * 1.05, { modo: 'bailar', emote: 'Disagree' }, 'xX_Lucas_Xx', '3.449 h');
      const r = crearObjeto('Rock3', CO.W(1.5, 2.4, 0.75), Quat.axis(0, 1, 0, 0.7), {}); CO.tags.push([r, 'Pepe 🗿', '', 1.15]);
      const yo = CO.pj('Hero', 0, -2, 0, { modo: 'quieto' }, '', ''); yo.arma = 'PhysicsGun'; yo.visible = false;
      window.__A = { lu, r, yo, f1: 0, f2: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.fuego(CO.W(-3.5, 11, 0.6), 2); CO.fuego(CO.W(4.2, 17, 0.6), 2); CO.fuego(CO.W(-5.5, 21, 0.8), 1);
      if (t < 24.7) { CO.fp(0, -2.6); const q1 = t > 23.35 ? TRH.suave((t - 23.35) / 0.4) - TRH.suave((t - 23.85) / 0.35) : 0; CO.mirar(CO.W(0.2 - q1 * 1.4, 2.1, 1.3), t, 1.2); }
      if (__tr.i >= 0 && t >= 23.3 && !A.f1) { A.f1 = 1; npcQuitar(A.lu); }
      if (__tr.i >= 0 && t >= 24.1 && !A.f2) { A.f2 = 1; borrarObjeto(A.r, true); }
      A.yo.visible = t >= 24.7; if (t >= 24.7) CO.fp(0, 60);`,
    cam: `const t = __tr.t, A = window.__A; if (t < 24.7) { DBG.cam = null; DBG.sinVista = false; return null; }
      const h = CO.cabeza(A.yo);
      if (t < 26.05) { const k = TRH.suave((t - 24.7) / 1.35); ${CINE('CO.W(-k * 5.5, -3.6 - k * 9, 1.7 + k * 12)', 'CO.W(0, 4 + k * 8, 1.2 - k * 0.8)', '(-k * 0.05)')} }
      const fy = A.yo.yaw || 0; ${CINE('v3(h.x + Math.sin(fy) * 0.85 - Math.cos(fy) * 0.08, h.y + 0.02, h.z + Math.cos(fy) * 0.85 + Math.sin(fy) * 0.08)', 'v3(h.x, h.y + 0.02, h.z)', '0.03')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t);
      const n = 1 + (t < 23.3) + (t < 24.1); CO.tabla(t, t < 24.7 ? [['Yo', 0, 24, 1]].concat(t < 23.3 ? [['xX_Lucas_Xx', 2, 61]] : [], t < 24.1 ? [['Pepe 🗿', 7, 999]] : []) : null, n);
      if (t >= 26.05) { const a = Math.max(0, 1 - (t - 26.05) / 0.35); CO.lienzo(1.04 + a * 0.18, a * 3, 0, 0); } else CO.lienzo(1);
      CO.sticker('hm', '<div class="coEmo">🤨</div>', 26.15, 27.7, 76, 33, 10);`,
  },
  // ---- 9. «seguime para la parte dos» ----
  parte2: {
    t0: 27.7, t1: 30.0, mapa: 'City', espera: 2500, antes: 40,
    preparar: COMUN + `CO.fp(0, -40); const yo = CO.pj('Hero', -9.4, 3, Math.PI / 2, { modo: 'bailar', emote: 'Hi' }, 'Yo', '20 min jugadas'); yo.arma = 'PhysicsGun';
      window.__A = { yo }; return 1;`,
    cam: `const t = __tr.t, A = window.__A, h = CO.cabeza(A.yo), k = TRH.rapido((t - 27.7) / 0.5); ${CINE('v3(h.x + 1.2 + k * 1.3, CO.g(h.x, h.z) + 0.35, h.z - 0.5 - k * 0.3)', 'v3(h.x, h.y - 0.1 + k * 0.25, h.z)', '(0.08 - k * 0.04)')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.golpe(t, 27.7); const a = Math.max(0, 1 - (t - 27.7) / 0.4); CO.lienzo(1.02 + a * 0.14, a * -3, 0, 0);
      CO.sticker('p2', '<div class="coP2">PARTE 2 👉</div>', 28.05, 30.0, 50, 27, -4);
      CO.sticker('seg', '<div class="coSeguir">+ Seguir</div>', 28.6, 30.0, 50, 79, 0);`,
  },
};
