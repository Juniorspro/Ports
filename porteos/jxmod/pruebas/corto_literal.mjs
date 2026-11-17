// un corto vertical (9:16, 30 s a 30 cuadros) para TikTok, con el estilo de los videos de GMod de ahí: título arriba
// («POV: …»), subtítulos grandes palabra por palabra, los nombres arriba de los jugadores (con horas jugadas, de chiste),
// chat y kill feed simulados y stickers. El humor es literal: Pepe «se quedó de piedra» y se vuelve una roca, «llueve a
// cántaros» y caen baldes, Juan «se murió de risa» y explota. La voz (Loquendo, Jorge) y la música van aparte
// (herramientas/corto_montar.py); acá están los tiempos de cada línea para los subtítulos.
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
// las palabras que se marcan (solas, de su color y con su emoji)
const ESP = { literal: ['#ff4040', '💀'], piedra: ['#ffe600', '🗿'], 'cántaros': ['#59c8ff', '🪣'], risa: ['#ffe600', '😂'], literalmente: ['#ff4040', '💀'], conmigo: ['#b9a6ff', '🥲'], dos: ['#ffe600', '👉'] };
// cada palabra con su tiempo: el de la frase repartido por sílabas (más un poco por letra)
const PAL = [];
for (const [t0, frases] of VOZ) for (const [a, b, txt] of frases) {
  const ws = txt.split(' '), pe = ws.map((w) => ((w.toLowerCase().match(/[aeiouáéíóúü]+/g) || ['a']).length + 0.12 * w.length)), tot = pe.reduce((x, y) => x + y, 0);
  let t = t0 + a; ws.forEach((w, i) => { const d = (b - a) * pe[i] / tot; PAL.push({ w, t0: +t.toFixed(3), t1: +(t + d).toFixed(3), fin: i === ws.length - 1 }); t += d; });
}
// los renglones de subtítulo: hasta 3 palabras (o 15 letras); cortan en la puntuación; las marcadas van solas
const REN = []; let cur = null;
for (const p of PAL) {
  const k = p.w.toLowerCase().replace(/[.,!?¿¡]/g, ''), esp = ESP[k];
  if (!cur || esp || cur.esp || cur.ws.length >= 3 || cur.ws.map((x) => x.w).join(' ').length + p.w.length > 15) { cur = { ws: [], esp: !!esp }; REN.push(cur); }
  cur.ws.push({ ...p, k, esp }); if (p.fin || esp) cur = null;
}
REN.forEach((r, i) => { r.t0 = r.ws[0].t0; const sig = REN[i + 1], fin = r.ws[r.ws.length - 1].t1; r.t1 = sig && sig.t0 - fin < 0.45 ? sig.t0 : fin + 0.3; });
// el chat (segundo, quién —null: mensaje del servidor—, color, texto) y el kill feed
const CHATL = [
  [8.55, 'xX_Lucas_Xx', '#6be36b', 'pepe?? 💀'],
  [9.25, 'Pepe', '#ffb347', 'no me puedo mover'],
  [13.85, 'xX_Lucas_Xx', '#6be36b', '¿¿QUIÉN TIRA BALDES??'],
  [14.55, 'Juan_xd', '#6fb7ff', 'JAJAJAJA'],
  [19.85, null, '', 'Juan_xd se desconectó (motivo: se murió de risa)'],
  [20.65, 'xX_Lucas_Xx', '#6be36b', 'F'],
  [21.25, 'Pepe 🗿', '#ffb347', 'F'],
  [23.30, null, '', 'xX_Lucas_Xx se desconectó'],
  [24.10, null, '', 'Pepe 🗿 se desconectó'],
];
const KILL = [[18.72, 23.0, '😂 Risa', 'Juan_xd']];
export const CSS = `
  #trOver{font-family:Inter,'Noto Color Emoji',sans-serif}
  #trOver .coTop{position:absolute;left:5%;right:5%;top:7.8%;text-align:center;font:800 28px/1.2 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:5px #000;paint-order:stroke fill;letter-spacing:-.01em}
  #trOver .coTop i{font-style:normal;color:#ffe600}
  #trOver .coCap{position:absolute;left:3%;right:3%;top:56%;text-align:center;font:900 44px/1.08 Inter,'Noto Color Emoji',sans-serif;text-transform:uppercase;color:#fff;-webkit-text-stroke:9px #000;paint-order:stroke fill;letter-spacing:-.01em;filter:drop-shadow(0 4px 0 rgba(0,0,0,.45))}
  #trOver .coCap span{display:inline-block;margin:0 .1em}
  #trOver .coCap .ya{color:#ffe600}
  #trOver .coCap .esp{font-size:62px}
  #trOver .coChat{position:absolute;left:4%;width:76%;top:67%;font:700 17px/1.25 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #trOver .coChat div{display:table;background:rgba(0,0,0,.42);padding:4px 9px;border-radius:7px;margin-top:5px}
  #trOver .coChat div.sis{color:#ffd84d;font-style:italic}
  #trOver .coKill{position:absolute;right:4%;top:19%;font:800 16px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.6);border:1.5px solid rgba(255,70,70,.75);padding:7px 11px;border-radius:7px;text-shadow:0 1px 2px #000}
  #trOver .coKill b{color:#ff6b6b}
  #trOver .coJug{position:absolute;left:4%;top:19%;font:800 15px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:6px 11px;border-radius:7px}
  #trOver .coTag{position:absolute;left:0;top:0;text-align:center;font:800 18px/1.1 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
  #trOver .coTag small{display:block;font:700 13px Inter,sans-serif;margin-top:1px}
  body.trailer #hud .npcGlobo{font-size:17px!important;font-weight:700}
  #trOver .coStk{position:absolute;left:0;top:0;white-space:nowrap;text-align:center}
  #trOver .coNoti{position:absolute;left:4%;right:4%;top:19%;background:rgba(246,246,248,.96);color:#111;border-radius:18px;padding:11px 13px;font:500 14px/1.3 Inter,'Noto Color Emoji',sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.4);display:flex;gap:11px;align-items:center}
  #trOver .coNoti .ic{flex:none;width:38px;height:38px;border-radius:9px;background:#ff9f0a;display:flex;align-items:center;justify-content:center;font-size:22px}
  #trOver .coNoti b{display:block;font-weight:700;font-size:13px;color:#555}
  #trOver .coNoti em{font-style:normal;font-weight:800}
  #trOver .coSeguir{display:inline-block;background:#fe2c55;color:#fff;font:800 26px Inter,sans-serif;padding:12px 32px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #trOver .coP2{font:900 64px/1 Inter,'Noto Color Emoji',sans-serif;color:#ffe600;-webkit-text-stroke:10px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.45))}
  #trOver .coNota{font:italic 700 17px Inter,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 3px #000}
`;
// lo común de cada escena: limpiar, el lugar (el grupo a 9 m del spawn, mirando hacia la cámara) y las capas de arriba
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarFisica === 'function') soltarFisica(); ARM.agarre = null;
  DIA.ciclo = false; DIA.hora = 15.2; DIA.aplicada = -1; JUG.tercera = false; JUG.vel.set(0, 0, 0); DBG.sinVista = true; ENT.disparo = false; PREFS.fov = 72;
  $('cv').style.transform = ''; $('cv').style.transformOrigin = '50% 45%';
  const s0 = MUNDO.spawns[0], y0 = JUG.yaw, ad = v3(Math.sin(y0), 0, Math.cos(y0)), ld = v3(Math.cos(y0), 0, -Math.sin(y0));
  const cx = s0.x + ad.x * 9, cz = s0.z + ad.z * 9, gy = pisoBajo(v3(cx, s0.y + 5, cz), 120) ?? s0.y;
  window.TRH = {
    blanco(v) { let e = document.querySelector('#trOver .trBlanco'); if (!e) { e = document.createElement('div'); e.className = 'trBlanco'; $('trOver').appendChild(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };
  window.CO = {
    REN: ${JSON.stringify(REN)}, CHAT: ${JSON.stringify(CHATL)}, KILL: ${JSON.stringify(KILL)}, tags: [], stk: {},
    y0, gy,
    // (un punto: f adelante —lejos de la cámara—, l al costado, h de alto sobre el piso del grupo)
    pto(f, l, h) { const x = cx + ad.x * f + ld.x * l, z = cz + ad.z * f + ld.z * l; return v3(x, (h === undefined ? 0 : h) + gy, z); },
    piso(f, l) { const p = this.pto(f, l, 0); return pisoBajo(v3(p.x, gy + 4, p.z), 20) ?? gy; },
    pj(sk, f, l, emote, giro) { const p = this.pto(f, l, 0); p.y = this.piso(f, l); return npcCrear(sk, p, y0 + Math.PI + (giro || 0), { modo: 'bailar', emote: emote || '', vel: 1 }); },
    emote(P, e) { if (!P || !P.act) return; P.act.emote = e; P.emote = null; },
    posDe(x) { if (!x) return null; if (x.rag) { const h = x.rag.cuerpos && x.D && x.D.h && x.rag.cuerpos.get(x.D.h.Hips); return h ? h.b.pos : x.pos; } if (x.D && x.pos) return x.pos; const b = x.b || x.body; return b ? b.pos : x.pos || null; },
    puf(p, n) { for (let i = 0; i < (n || 18); i++) { const r = () => Math.random() - 0.5; particula(v3(p.x + r() * 0.6, p.y + r() * 1.2, p.z + r() * 0.6), v3(r() * 2.2, Math.random() * 1.4 + 0.3, r() * 2.2), 0.6 + Math.random() * 0.5, 0.35 + Math.random() * 0.3, [0.93, 0.93, 0.93, 0.85], 'humo', 1.3); } },
    el(cls, id) { const o = $('trOver'); let e = o.querySelector('#' + id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; o.appendChild(e); } return e; },
    quitar(id) { const e = document.getElementById(id); if (e) e.remove(); },
    // (el título de arriba, todo el video)
    top() { const e = this.el('coTop', 'coTop'); if (!e._h) { e._h = 1; e.innerHTML = 'POV: el juego te deja hacer<br><i>CUALQUIER</i> cosa 💀'; } },
    // (el subtítulo: el renglón que va; la palabra que se dice, amarilla; el renglón entra con un saltito)
    cap(t) {
      const R = this.REN.find((r) => t >= r.t0 && t < r.t1), e = this.el('coCap', 'coCap');
      if (!R) { if (e._k !== -1) { e._k = -1; e.innerHTML = ''; } return; }
      const i = R.ws.filter((w) => t >= w.t0).length - 1, k = R.t0 + ':' + i;
      if (e._k !== k) { e._k = k; e.innerHTML = R.ws.map((w, j) => { const es = w.esp; const lim = w.w.replace(/[.,]/g, ''), largo = lim.length > 8; const tx = lim + (es ? (largo ? '<br>' : ' ') + es[1] : ''); return '<span class="' + (es ? 'esp' : j <= i ? 'ya' : '') + '"' + (es ? ' style="color:' + es[0] + (largo ? ';font-size:52px' : '') + '"' : '') + '>' + tx + '</span>'; }).join(' '); }
      const a = Math.min(1, (t - R.t0) / 0.13), s = R.esp ? 1 + (1 - a) * 0.5 + Math.sin(Math.min(1, (t - R.t0) / 0.35) * Math.PI) * 0.06 : 1 + (1 - a) * 0.22;
      e.style.transform = 'scale(' + s.toFixed(3) + ')' + (R.esp ? ' rotate(' + ((1 - a) * -6).toFixed(2) + 'deg)' : '');
    },
    chat(t) {
      const L = this.CHAT.filter((c) => t >= c[0] && t - c[0] < 7.5).slice(-4), e = this.el('coChat', 'coChat'), k = L.map((c) => c[0]).join(',');
      if (e._k !== k) { e._k = k; e.innerHTML = L.map((c) => c[1] ? '<div><b style="color:' + c[2] + '">' + c[1] + '</b>: ' + c[3] + '</div>' : '<div class="sis">' + c[3] + '</div>').join(''); }
      const ult = e.lastChild; if (ult && L.length) { const a = Math.min(1, (t - L[L.length - 1][0]) / 0.15); ult.style.opacity = a; ult.style.transform = 'translateX(' + ((1 - a) * -14).toFixed(1) + 'px)'; }
    },
    kill(t) { const K = this.KILL.find((x) => t >= x[0] && t < x[1]); if (!K) { this.quitar('coKill'); return; } const e = this.el('coKill', 'coKill'); if (!e._h) { e._h = 1; e.innerHTML = K[2] + ' ➜ <b>💀 ' + K[3] + '</b>'; } const a = Math.min(1, (t - K[0]) / 0.15); e.style.transform = 'translateX(' + ((1 - a) * 40).toFixed(1) + 'px)'; e.style.opacity = Math.min(a, (K[1] - t) / 0.3); },
    // (los nombres arriba de las cabezas: [persona u objeto, nombre, abajo, color del de abajo, alto sobre el centro])
    tagsDibujar() {
      const o = $('trOver'); this.tags.forEach((T, i) => {
        const id = 'coTag' + i; let e = document.getElementById(id); const x = T[0], vivo = x && (x.D ? PERS.includes(x) : OBJS.includes(x)) && !T.oc;
        const p = vivo && this.posDe(x), cl = p && clipDe(vadd(p, v3(0, T[4] || 1.32, 0)));
        if (!cl || cl.y < VH() * 0.215 || cl.x < 34 || cl.x > VW() - 34) { if (e) e.style.display = 'none'; return; }
        if (!e) { e = document.createElement('div'); e.id = id; e.className = 'coTag'; o.appendChild(e); }
        const h = T[1] + (T[2] ? '<small style="color:' + (T[3] || '#ffe600') + '">' + T[2] + '</small>' : ''); if (e._h !== h) { e._h = h; e.innerHTML = h; }
        e.style.display = ''; e.style.transform = 'translate(' + cl.x.toFixed(1) + 'px,' + cl.y.toFixed(1) + 'px) translate(-50%,-100%)';
      });
    },
    // (un sticker: entra con un rebote y se va; x, y en % de la pantalla)
    sticker(id, html, t0, t1, x, y, rot, cls) {
      const t = __tr.t; if (t < t0 || t > t1) { this.quitar(id); return; }
      const e = this.el('coStk ' + (cls || ''), id); if (e._h !== html) { e._h = html; e.innerHTML = html; }
      const a = Math.min(1, (t - t0) / 0.28), reb = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.35 - (1 - a) * 0.9 : 1 + Math.sin((t - t0) * 5) * 0.025, z = Math.min(1, (t1 - t) / 0.15);
      e.style.left = x + '%'; e.style.top = y + '%'; e.style.opacity = z.toFixed(3);
      e.style.transform = 'translate(-50%,-50%) rotate(' + (rot || 0) + 'deg) scale(' + Math.max(0, reb * z).toFixed(3) + ')';
    },
    todo(t) { this.top(); this.cap(t); this.chat(t); this.kill(t); this.tagsDibujar(); },
    // (el lienzo del juego más grande, un golpe de zoom; el resto —letras— queda igual)
    zoom(s, sx, sy) { $('cv').style.transform = s && s !== 1 ? 'translate(' + (sx || 0).toFixed(1) + 'px,' + (sy || 0).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')' : ''; },
  };`;
// la cámara: d metros adelante/atrás del grupo, l al costado, h de alto; mira a (f, l, h)
const CAM = (p, m, r) => `(() => { const P = CO.pto(${p.join(',')}), M = CO.pto(${m.join(',')}); return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z], r: ${r || 0} }; })`;
export const ESCENAS = {
  // ---- 1. el grupo saluda; «lo tomé literal»: golpe de zoom ----
  lobby: {
    t0: 0, t1: 5.2, mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `
      const yo = CO.pj('Hero', -0.9, 0, 'Hi'), pe = CO.pj('Engineer', 0.3, -1.05, 'Clap', 0.15), ju = CO.pj('Pirata', 0.35, 1.05, 'rb:Sacudite', -0.15), lu = CO.pj('Ninja', 1.3, 0.05, 'Victory');
      CO.tags = [[yo, 'Yo', '20 min jugadas', '#ff6b6b'], [pe, 'Pepe', '1.459 h', '#ffe600'], [ju, 'Juan_xd', '2.023 h', '#ffe600'], [lu, 'xX_Lucas_Xx', '3.449 h', '#ffe600']];
      window.__A = { yo }; return 1;`,
    cam: `const t = __tr.t, k = TRH.suave(t / 4.4);
      if (t < 4.42) { const d = 4.6 - k * 0.9; return (${CAM(['-d - 0.9', '0.25', '1.55 - k * 0.15'], ['0.2', '0', '1.05'])})(); }
      const s = TRH.temblor(t, 4.42, 0.05), q = TRH.suave((t - 4.42) / 0.7); return (${CAM(['-2.2 + q * 0.25', '0.12 + s[0]', '1.62 + s[1]'], ['-0.9', '0', '1.5'])})();`,
    titulos: `const t = __tr.t; CO.todo(t); TRH.blanco(t > 4.42 ? Math.max(0, 1 - (t - 4.42) / 0.16) * 0.85 : 0);
      if (t > 4.42) { const a = Math.max(0, 1 - (t - 4.42) / 0.5); CO.zoom(1 + a * 0.08, Math.sin(t * 90) * a * 6, Math.cos(t * 77) * a * 5); } else CO.zoom(1);`,
  },
  // ---- 2. Pepe «se quedó de piedra»: ¡puf!, una roca; zoom dramático ----
  piedra: {
    t0: 5.2, t1: 10.0, mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `
      const pe = CO.pj('Engineer', 0, -0.6, 'Disagree', -0.35), yo = CO.pj('Hero', 0.1, 0.7, 'Clap', 0.35);
      CO.tags = [[pe, 'Pepe', '1.459 h', '#ffe600'], [yo, 'Yo', '20 min jugadas', '#ff6b6b']];
      window.__A = { pe, yo, roca: null }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i >= 0) {
      if (__tr.i === 3) npcDecir(A.pe, 'me quedé de piedra jaja');
      if (t >= 7.62 && !A.roca) { const p = A.pe.pos.clone(); CO.puf(v3(p.x, p.y, p.z), 14); npcQuitar(A.pe); A.roca = crearObjeto('Rock3', v3(p.x, CO.gy + 0.7, p.z), Quat.axis(0, 1, 0, 0.7), {}); CO.tags[0] = [A.roca, 'Pepe 🗿', '(ahora es una piedra)', '#c9c9c9', 1.1]; CO.emote(A.yo, 'Scream'); } }`,
    cam: `const t = __tr.t; if (t < 7.62) { const k = TRH.suave((t - 5.2) / 2.4); return (${CAM(['-3.3 + k * 0.4', '0.05', '1.45'], ['0', '0', '1.15'])})(); }
      const k = TRH.suave((t - 7.75) / 1.6), s = TRH.temblor(t, 7.62, 0.06); return (${CAM(['-3.5 + k * 1.0', '0.0 - k * 0.15 + s[0]', '1.4 - k * 0.4 + s[1]'], ['0', '-0.15', '0.6'], '(k * 0.07)')})();`,
    titulos: `const t = __tr.t; CO.todo(t); TRH.blanco(t > 7.62 ? Math.max(0, 1 - (t - 7.62) / 0.14) * 0.7 : 0);
      CO.sticker('moai', '<span style="font-size:118px">🗿</span>', 7.8, 10.0, 77, 37, 8);`,
  },
  // ---- 3. «llover a cántaros»: el aviso del celular y llueven baldes ----
  baldes: {
    t0: 10.0, t1: 15.7, mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `
      const lu = CO.pj('Ninja', 0.2, -1.3, 'Hi', 0.2), ju = CO.pj('Pirata', 0, 0.05, 'Clap'), yo = CO.pj('Hero', 0.25, 1.35, 'Victory', -0.2);
      const r = crearObjeto('Rock3', CO.pto(0.9, -0.2, 0.7), Quat.axis(0, 1, 0, 0.7), {});
      CO.tags = [[lu, 'xX_Lucas_Xx', '3.449 h', '#ffe600'], [ju, 'Juan_xd', '2.023 h', '#ffe600'], [yo, 'Yo', '20 min jugadas', '#ff6b6b'], [r, 'Pepe 🗿', '', '', 1.1]];
      window.__A = { lu, ju, yo, n: 0, grito: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i >= 0) {
      if (t >= 11.85 && t < 14.6 && A.n < 46 && __tr.i % 2 === 0) { for (let j = 0; j < 2; j++) { const k = A.n++, an = k * 2.39996, r = 0.4 + Math.sqrt((k * 37 % 46) / 46) * 3.4; const p = CO.pto(0.4 + Math.cos(an) * r, Math.sin(an) * r, 11 + (k * 7 % 5) * 1.2); crearObjeto('Cubeta', p, Quat.axis(Math.sin(k), 1, Math.cos(k * 1.7), k * 1.3), {}); } }
      if (t >= 13.05 && !A.grito) { A.grito = 1; CO.emote(A.lu, 'Scream'); CO.emote(A.ju, 'Scream'); CO.emote(A.yo, 'Disagree'); } }`,
    cam: `const t = __tr.t; if (t < 11.55) { const k = TRH.suave((t - 10) / 1.55); return (${CAM(['-5.6 + k * 0.5', '0.2', '1.05'], ['0.3', '0', '1.0'])})(); }
      if (t < 12.9) { const k = TRH.suave((t - 11.55) / 0.75); return (${CAM(['-5.1', '0.2', '1.05'], ['0.3', '0', '1.0 + k * 7'])})(); }
      const k = TRH.suave((t - 12.9) / 0.45), s = TRH.temblor(t, 13.35, 0.05); return (${CAM(['-5.1 - k * 0.6 + s[0]', '0.2 + s[2]', '1.05 + k * 0.4 + s[1]'], ['0.3', '0', '8 - k * 7.1'])})();`,
    titulos: `const t = __tr.t; CO.todo(t);
      CO.sticker('noti', '<div class="coNoti"><div class="ic">⛈️</div><div><b>CLIMA · ahora</b><em>Alerta:</em> mañana llueve a cántaros 🪣</div></div>', 10.35, 12.4, 50, 23, 0);
      CO.sticker('nota', '<div class="coNota">*no había cántaros, son baldes</div>', 14.45, 15.7, 50, 49, -3);`,
  },
  // ---- 4. Juan «se murió de risa»: se ríe… y explota (cámara lenta) ----
  risa: {
    t0: 15.7, t1: 22.2, mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `
      const ju = CO.pj('Pirata', 0, 0, 'rb:Gracioso'), lu = CO.pj('Ninja', 1.6, -1.7, 'Clap', 0.5);
      CO.tags = [[ju, 'Juan_xd', '2.023 h', '#ffe600'], [lu, 'xX_Lucas_Xx', '3.449 h', '#ffe600']];
      window.__A = { ju, lu, boom: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i >= 0) {
      if (__tr.i === 18) npcDecir(A.ju, 'JAJAJAJAJAJA');
      if (t >= 18.6 && !A.boom) { A.boom = 1; const p = A.ju.pos; if (A.ju.globo) { A.ju.globo.remove(); A.ju.globo = null; } explosion(v3(p.x + 0.2, CO.gy + 0.25, p.z + 0.15), 5, 260); CO.tags[0][2] = '💀'; } }`,
    ritmo: `const t = __tr.t; return t < 18.62 ? 1 : t < 19.5 ? 0.3 : Math.min(1, 0.3 + (t - 19.5) * 1.4);`,
    cam: `const t = __tr.t; if (t < 18.6) { const k = TRH.suave((t - 15.7) / 2.9); return (${CAM(['-2.5 + k * 0.6', '0.35', '1.45'], ['0', '0', '1.15'])})(); }
      const k = TRH.suave((t - 18.6) / 2.4), s = TRH.temblor(t, 18.6, 0.12), j = CO.posDe(window.__A.ju), P = CO.pto(-1.9 - k * 3.2 + s[0], 0.35 + k * 2.2 + s[2], 1.45 + k * 1.3 + s[1]), M0 = CO.pto(0.3, 0, 1.3), w = TRH.suave((t - 18.9) / 1.2), M = j ? v3(M0.x + (j.x - M0.x) * w, M0.y + (j.y + 0.3 - M0.y) * w, M0.z + (j.z - M0.z) * w) : M0; return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z] };`,
    titulos: `const t = __tr.t; CO.todo(t); TRH.blanco(t > 18.6 ? Math.max(0, 1 - (t - 18.6) / 0.12) * 0.9 : 0);
      if (t > 18.6) { const a = Math.max(0, 1 - (t - 18.6) / 0.6); CO.zoom(1 + a * 0.06, Math.sin(t * 95) * a * 8, Math.cos(t * 83) * a * 7); } else CO.zoom(1);`,
  },
  // ---- 5. «nadie quiere jugar conmigo»: se van uno por uno; la cámara se aleja y se ve el desastre ----
  solo: {
    t0: 22.2, t1: 27.7, mapa: 'FlatGrass', espera: 3000, antes: 60,
    preparar: COMUN + `
      const yo = CO.pj('Hero', 0, 0, 'Sitting'), lu = CO.pj('Ninja', 0.45, -1.0, 'Disagree', 0.5);
      const r = crearObjeto('Rock3', CO.pto(0.35, 1.05, 0.7), Quat.axis(0, 1, 0, 0.7), {});
      for (let k = 0; k < 34; k++) { const an = k * 2.39996, d = 1.6 + Math.sqrt(k / 34) * 6.5; crearObjeto('Cubeta', CO.pto(0.3 + Math.cos(an) * d, Math.sin(an) * d, 0.5 + (k % 3) * 0.4), Quat.axis(Math.sin(k), 1, Math.cos(k), k * 1.1), {}); }
      CO.tags = [[yo, 'Yo', '20 min jugadas', '#ff6b6b'], [lu, 'xX_Lucas_Xx', '3.449 h', '#ffe600'], [r, 'Pepe 🗿', '', '', 1.1]];
      window.__A = { yo, lu, r, f1: 0, f2: 0 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i >= 0) {
      if (t >= 23.3 && !A.f1) { A.f1 = 1; npcQuitar(A.lu); }
      if (t >= 24.1 && !A.f2) { A.f2 = 1; borrarObjeto(A.r, true); } }`,
    cam: `const t = __tr.t; if (t < 24.75) { const k = TRH.suave((t - 22.2) / 2.5); return (${CAM(['-2.6 + k * 0.3', '0.1', '1.05 - k * 0.1'], ['0', '0', '0.6'])})(); }
      const k = TRH.suave((t - 24.75) / 2.8); return (${CAM(['-2.3 - k * 6.5', '0.1 + k * 1.2', '0.95 + k * 4.2'], ['0', '0', '0.6 - k * 0.2'])})();`,
    titulos: `const t = __tr.t; CO.todo(t); const n = 1 + (t < 23.3) + (t < 24.1); const e = CO.el('coJug', 'coJug'); const h = '👥 ' + n + '/32 jugadores'; if (e._h !== h) { e._h = h; e.innerHTML = h; }`,
  },
  // ---- 6. «seguime para la parte dos» ----
  parte2: {
    t0: 27.7, t1: 30.0, mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `
      const yo = CO.pj('Hero', 0, 0, 'Hi');
      CO.tags = [[yo, 'Yo', '20 min jugadas', '#ff6b6b']];
      window.__A = { yo }; return 1;`,
    cam: `const t = __tr.t, k = TRH.suave((t - 27.7) / 2.3); return (${CAM(['-2.7 + k * 0.35', '0.05', '1.45'], ['0', '0', '1.62'])})();`,
    titulos: `const t = __tr.t; CO.todo(t); TRH.blanco(Math.max(0, 1 - (t - 27.7) / 0.12) * 0.6);
      CO.sticker('p2', '<div class="coP2">PARTE 2 👉</div>', 28.05, 30.0, 50, 27, -4);
      CO.sticker('seg', '<div class="coSeguir">+ Seguir</div>', 28.6, 30.0, 50, 77, 0);`,
  },
};
