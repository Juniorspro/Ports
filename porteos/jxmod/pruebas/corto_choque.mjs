// corto vertical 6 (9:16, 47,5 s a 30 cuadros): «Chocar a 100 km/h es lo mismo que caerte de un edificio de 13 pisos»
// (v = 27,8 m/s; h = v² / 2g = 39,3 m ≈ 13 pisos de 3 m). Demostrado en gm_construct: un auto contra la pared del edificio
// a 100 y el mismo auto soltado desde 39,3 m (sin el roce del aire del motor, como en la cuenta), con un velocímetro que
// lee la velocidad de verdad. Efectos nuevos: texto pintado en el mundo (en la pared y en el piso, en perspectiva —una
// homografía con matrix3d—), una regla de 13 pisos en el aire, el zoom de vértigo (la cámara se aleja y el campo se
// cierra: DBG.fov), la cámara que cae con el auto, la repetición desde otro ángulo, cámara lenta, cuadro congelado. El
// rebobinado del principio y la pantalla dividida se arman en el montaje. El que explica es el jugador con la palanca.
// uso: ESC=pruebas/corto_choque.mjs VW=540 VH=960 DPR=2 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA [escenas] [cada]
export const FPS = 30;
const V100 = 27.778, H13 = 39.33, PARED = 26.0, CARRIL = -2.0;   // (m/s; m; la pared del edificio en z; el carril del choque en x)
export const VOZ = [
  [0.30, [[0, 4.53, 'Chocar a cien kilómetros por hora es lo mismo que caerte de un edificio de trece pisos.']]],
  [5.80, [[0, 0.76, '¿Exagerado?']]],
  [8.00, [[0, 1.17, 'Vamos a comprobarlo.']]],
  [9.80, [[0, 2.45, 'Primero, un auto contra una pared, a cien.']]],
  [17.60, [[0, 3.31, 'Ahora, el mismo auto, desde treinta y nueve metros de altura.']]],
  [20.40, [[0, 1.06, 'Mirá el velocímetro.']]],
  [24.40, [[0, 2.75, 'Toca el piso exactamente a cien kilómetros por hora.']]],
  [27.70, [[0, 1.03, 'Es el mismo golpe.'], [1.55, 3.36, 'Por eso el cinturón no es opcional.']]],
  [31.80, [[0, 0.90, 'Pepe no lo usaba.']]],
  [37.80, [[0, 2.23, 'Seguime para más datos que te pueden salvar.']]],
  [41.20, [[0, 0.68, 'Tranquilos.'], [1.24, 2.09, 'Pepe está bien.']]],
  [45.00, [[0, 0.33, 'Bueno.'], [0.85, 1.22, 'Casi.']]],
];
const ESP = { cien: '💯', trece: '🏢', '¿exagerado?': '🤨', pared: '🧱', metros: '📏', velocímetro: '⏱️', golpe: '💥', cinturón: '🚗', pepe: '💀', salvar: '🙏', bien: '👍', casi: '💀' };
export const PAL = [];
for (const [t0, frases] of VOZ) for (const [a, b, txt] of frases) {
  const ws = txt.split(' '), pe = ws.map((w) => ((w.toLowerCase().match(/[aeiouáéíóúü]+/g) || ['a']).length + 0.12 * w.length)), tot = pe.reduce((x, y) => x + y, 0);
  let t = t0 + a; ws.forEach((w, i) => { const d = (b - a) * pe[i] / tot; const k = w.toLowerCase().replace(/[.,!?¡]/g, ''); PAL.push({ w: w.replace(/[.,]/g, ''), t0: +t.toFixed(3), t1: +(t + d).toFixed(3), e: ESP[k] || ESP[w.toLowerCase().replace(/[.,]/g, '')] || '' }); t += d; });
}
PAL.forEach((p, i) => { const s = PAL[i + 1]; p.t1 = s && s.t0 - p.t1 < 0.35 ? s.t0 : +(p.t1 + 0.3).toFixed(3); });
export const CHATL = [[6.4, 'nico', 'ni ahí'], [9.0, 'xX_Lucas_Xx', 'dale probá'], [13.5, 'nico', 'uff'], [24.6, 'xX_Lucas_Xx', 'NO PUEDE SER'], [34.3, 'Pepe', 'me olvidé el cinturón'], [34.9, 'nico', 'F'], [44.3, 'nico', 'OTRA VEZ PEPE 💀'], [44.9, 'xX_Lucas_Xx', 'pobre pepe jajaja']];
const KILL = [[33.45, 36.5, '🧱 Pared', 'Pepe'], [43.85, 47.5, '💥 Sedan', 'Pepe (otra vez)']];
export const CSS = `
  #trOver{font-family:Inter,'Noto Color Emoji',sans-serif}
  #cv{will-change:transform}
  #trOver .coTop{position:absolute;left:4%;right:4%;top:7%;text-align:center;font:900 31px/1.12 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:7px #000;paint-order:stroke fill;text-transform:uppercase}
  #trOver .coCap{position:absolute;left:3%;right:3%;top:63%;text-align:center;font:900 56px/1 Inter,'Noto Color Emoji',sans-serif;text-transform:uppercase;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5))}
  #trOver .coCap span{display:inline-block}
  #trOver .coChat{position:absolute;left:4%;width:78%;top:71%;font:700 17px/1.25 Inter,'Noto Color Emoji',sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #trOver .coChat div{display:table;background:rgba(0,0,0,.45);padding:4px 9px;border-radius:7px;margin-top:5px}
  #trOver .coChat b{font-weight:800}
  #trOver .coKill{position:absolute;right:4%;top:19.5%;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  #trOver .coKill div{font:800 16px Inter,'Noto Color Emoji',sans-serif;color:#fff;background:rgba(0,0,0,.62);padding:6px 10px;border-radius:7px;text-shadow:0 1px 2px #000;white-space:nowrap}
  #trOver .coStk{position:absolute;left:0;top:0;white-space:nowrap;text-align:center}
  #trOver .coGrande{font:900 56px/1.02 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:11px #000;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(0,0,0,.5));text-align:center}
  #trOver .coSeguir{display:inline-block;background:#fe2c55;color:#fff;font:800 26px Inter,sans-serif;padding:12px 32px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #trOver .co3d{position:absolute;left:0;top:0;transform-origin:0 0;display:flex;align-items:center;justify-content:center;font:900 150px/1 Inter,'Noto Color Emoji',sans-serif;color:#fff;-webkit-text-stroke:14px #000;paint-order:stroke fill;white-space:nowrap;letter-spacing:-.02em}
  #trOver .co3d.pintado{color:#ffffff;-webkit-text-stroke:0;text-shadow:none;opacity:.92;mix-blend-mode:normal}
  #trOver .coRegla{position:absolute;inset:0;overflow:visible}
  #trOver .coRegla text{font:900 16px Inter,sans-serif;fill:#fff;stroke:#000;stroke-width:4px;paint-order:stroke fill}
  #trOver .coVel{position:absolute;right:4%;top:15.5%;width:178px;height:122px;background:rgba(10,12,16,.62);border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,.4);color:#fff}
  #trOver .coVel svg{position:absolute;left:0;top:0}
  #trOver .coVel b{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:900 34px/1 Inter,sans-serif}
  #trOver .coVel b small{font-size:14px;font-weight:800;opacity:.8;margin-left:3px}
  #trOver .coVel.rojo b{color:#ff4b4b}
  #trOver .coRec{position:absolute;left:4%;top:15.5%;font:900 22px Inter,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:6px 12px;border-radius:8px;display:flex;align-items:center;gap:8px}
  #trOver .coRec i{width:13px;height:13px;border-radius:50%;background:#ff2a2a;display:inline-block}
  body.trailer #hud .npcGlobo{font-size:17px!important;font-weight:700}
`;
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarAgarre === 'function') soltarAgarre(); ARM.agarre = null; ENT.disparo = false; ENT.tactil = true; ENT.x = ENT.y = 0; ENT.saltar = ENT.agachar = ENT.correr = false;
  PREFS.evento = false; DIA.ciclo = false; DIA.hora = 15.0; DIA.aplicada = -1; JUG.tercera = true; JUG.vel.set(0, 0, 0); JUG.vida = 1e7; DBG.cam = null; DBG.sinVista = true; DBG.fov = 0; PREFS.fov = 72;
  elegirArma(ARM.lista.indexOf('Crowbar'));
  $('cv').style.transform = ''; $('cv').style.filter = '';
  window.TRH = {
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    rapido(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 4); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };
  window.CO = {
    PAL: ${JSON.stringify(PAL)}, CHAT: ${JSON.stringify(CHATL)}, KILL: ${JSON.stringify(KILL)}, tags: [],
    g(x, z) { return pisoBajo(v3(x, 10, z), 40) ?? -3.76; },
    P(x, z, h) { return v3(x, this.g(x, z) + (h || 0), z); },
    Pw(x, z, h) { return v3(x, this.g(x, z - 2) + (h || 0), z); },   // (en la pared: el piso medido adelante, no el techo)
    caja(o) { const b = o.b, Q = puntosForma(o.F.shape), mn = v3(1e9, 1e9, 1e9), mx = v3(-1e9, -1e9, -1e9); for (const v of Q) { const w = vadd(b.q.rot(v), b.pos); mn.x = Math.min(mn.x, w.x); mn.y = Math.min(mn.y, w.y); mn.z = Math.min(mn.z, w.z); mx.x = Math.max(mx.x, w.x); mx.y = Math.max(mx.y, w.y); mx.z = Math.max(mx.z, w.z); } return { min: mn, max: mx }; },
    yo(x, z, yaw, pitch) { const p = this.P(x, z, 0.97); JUG.pos.x = p.x; JUG.pos.z = p.z; if (JUG.pos.y < p.y - 0.3 || JUG.pos.y > p.y + 3) JUG.pos.y = p.y; if (yaw !== undefined) JUG.yaw = yaw; if (pitch !== undefined) JUG.pitch = pitch; JUG.vel.x = 0; JUG.vel.z = 0; },
    mirarA(p) { const d = vsub(p, vadd(JUG.pos, v3(0, 0.66, 0))); return Math.atan2(d.x, d.z); },
    agachadas(t, a, b) { return t >= a && t < b && Math.floor((t - a) * 7.5) % 2 === 0; },
    pj(sk, x, z, yaw, act, nombre) { const P = npcCrear(sk, this.P(x, z, 0), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); return P; },
    // (un auto en un lugar, mirando hacia +z —o lo que diga yaw—; sin el roce del aire del motor si sinAire)
    auto(x, z, h, yaw, sinAire) { const o = crearObjeto('Sedan', this.P(x, z, h || 0), Quat.axis(0, 1, 0, yaw || 0), {}); let bb = this.caja(o); if (bb.max.x - bb.min.x > bb.max.z - bb.min.z) { borrarObjeto(o, true); return this.auto(x, z, h, (yaw || 0) + Math.PI / 2, sinAire); } if (sinAire) o.b.damp = -0.02; o.medio = (bb.max.z - bb.min.z) / 2; o.frente = bb.max.z - o.b.pos.z; return o; },   // (frente: del centro del cuerpo a la trompa)
    velo(o) { return o ? o.b.vel.len() * 3.6 : 0; },
    // (el muñeco de trapo lejos de donde apareció: la posición del NPC sigue a su cadera —si no, el juego lo da por fuera de
    // cuadro y no lo dibuja—)
    chocado(o, vida) { const bb = this.caja(o), fr = bb.max.z - o.b.pos.z; if (!o.des || !o.des.abollado) { o.b.pos.z = 26.0 - fr - 0.05; o.b.vel.set(0, 0, 0); o.b.updateWorld && o.b.updateWorld(); desAbollar(o, vadd(o.b.pos, o.b.q.rot(v3(0, -0.1, fr))), o.b.q.rot(v3(0, 0, -1)), 0.46, 1.4); } desDe(o); o.veh.vida = vida; },
    seguirRag(P) { const h = P && P.rag && P.rag.cuerpos.get(P.D.h.Hips); if (h) P.pos.copy(h.b.pos); },
    polvo(p, n, esc, c) { for (let i = 0; i < (n || 16); i++) { const r = () => Math.random() - 0.5, e = esc || 1; particula(v3(p.x + r() * 0.9 * e, p.y + 0.05, p.z + r() * 0.9 * e), v3(r() * 5 * e, Math.random() * 1.6 * e + 0.3, r() * 5 * e), 0.6 + Math.random() * 0.8, (0.35 + Math.random() * 0.4) * e, c || [0.78, 0.72, 0.62, 0.6], 'humo', 1.8); } },
    chispas(p, n) { for (let i = 0; i < (n || 24); i++) { const r = () => Math.random() - 0.5; const x = particula(p, v3(r() * 9, Math.random() * 6, r() * 9), 0.4 + Math.random() * 0.5, 0.03, [1, 0.8, 0.45, 1], 'chispa', 0); if (x) x.piso = p.y - 0.5; } },
    el(cls, id) { const o = $('trOver'); let e = o.querySelector('#' + id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; o.appendChild(e); } return e; },
    quitar(id) { const e = document.getElementById(id); if (e) e.remove(); },
    top() { const e = this.el('coTop', 'coTop'); if (!e._h) { e._h = 1; e.innerHTML = 'Esto te puede salvar la vida 🚗'; } },
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
    sticker(id, html, t0, t1, x, y, rot) {
      const t = __tr.t; if (t < t0 || t > t1) { this.quitar(id); return; }
      const e = this.el('coStk', id); if (e._h !== html) { e._h = html; e.innerHTML = html; }
      const a = Math.min(1, (t - t0) / 0.2), reb = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.35 - (1 - a) * 0.9 : 1 + Math.sin((t - t0) * 5) * 0.025, z = Math.min(1, (t1 - t) / 0.12);
      e.style.left = x + '%'; e.style.top = y + '%'; e.style.opacity = z.toFixed(3);
      e.style.transform = 'translate(-50%,-50%) rotate(' + (rot || 0) + 'deg) scale(' + Math.max(0, reb * z).toFixed(3) + ')';
    },
    // (texto en el mundo: un rectángulo de 4 puntos —arriba izq., arriba der., abajo izq., abajo der.— y la homografía
    // que lleva el elemento —W × H— a esos 4 puntos de la pantalla; entra creciendo desde su centro)
    homog(src, dst) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
      for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
      return b.map((v, i) => v / A[i][i]).concat([1]); },
    rect(c, ex, ey, w, h) { const hx = vscale(ex, w / 2), hy = vscale(ey, h / 2); return [vadd(vsub(c, hx), hy), vadd(vadd(c, hx), hy), vsub(vsub(c, hx), hy), vsub(vadd(c, hx), hy)]; },
    texto3D(id, html, Q, t0, t1, cls) {
      const t = __tr.t; if (t < t0 || t > t1) { this.quitar(id); return; }
      const e = this.el('co3d ' + (cls || ''), id), W = 1000, H = 280; if (e._h !== html) { e._h = html; e.innerHTML = html; e.style.width = W + 'px'; e.style.height = H + 'px'; }
      const a = TRH.rapido((t - t0) / 0.3), z = Math.min(1, (t1 - t) / 0.2), C = vscale(vadd(vadd(Q[0], Q[1]), vadd(Q[2], Q[3])), 0.25), sc = 0.4 + 0.6 * a;
      const pts = Q.map((q) => clipDe(vadd(C, vscale(vsub(q, C), sc)))); if (pts.some((p) => !p)) { e.style.display = 'none'; return; }
      const h = this.homog([[0, 0], [W, 0], [0, H], [W, H]], pts.map((p) => [p.x, p.y]));
      e.style.display = ''; e.style.opacity = Math.min(a * 1.4, z).toFixed(3); e.style.transform = 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].map((x) => x.toFixed(6)).join(',') + ')';
    },
    // (la regla de 13 pisos en el aire, al lado de la caída: la línea, una marca por piso con su número y arriba el total)
    regla(base, lado, t, t0, t1) {
      if (t < t0 || t > t1) { this.quitar('coRegla'); return; }
      const e = this.el('coRegla', 'coRegla'), up = v3(0, 1, 0), n = 13, hp = ${H13} / n, L = [], T = [];
      const pr = (p) => clipDe(p), b0 = pr(base), b1 = pr(vadd(base, vscale(up, ${H13})));
      if (b0 && b1) L.push('<line x1="' + b0.x.toFixed(1) + '" y1="' + b0.y.toFixed(1) + '" x2="' + b1.x.toFixed(1) + '" y2="' + b1.y.toFixed(1) + '" stroke="#000" stroke-width="7"/><line x1="' + b0.x.toFixed(1) + '" y1="' + b0.y.toFixed(1) + '" x2="' + b1.x.toFixed(1) + '" y2="' + b1.y.toFixed(1) + '" stroke="#fff" stroke-width="3.5"/>');
      for (let k = 1; k <= n; k++) { const c = vadd(base, vscale(up, k * hp)), a = pr(vsub(c, vscale(lado, 0.7))), b = pr(vadd(c, vscale(lado, 0.7))); if (!a || !b) continue;
        L.push('<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="#000" stroke-width="6"/><line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="' + (k === n ? '#ff4b4b' : '#fff') + '" stroke-width="' + (k === n ? 4 : 2.5) + '"/>');
        const d = Math.max(1, c.distTo(CAM.pos)), fs = Math.max(9, Math.min(34, 260 / d)) * (k === n ? 1.5 : 1);
        T.push('<text x="' + (b.x + 6).toFixed(1) + '" y="' + (b.y + fs * 0.35).toFixed(1) + '" style="font-size:' + fs.toFixed(1) + 'px' + (k === n ? ';fill:#ff4b4b' : '') + '">' + (k === n ? '13 PISOS · 39 M' : 'PISO ' + k) + '</text>'); }
      e.innerHTML = '<svg width="' + VW() + '" height="' + VH() + '" style="overflow:visible">' + L.join('') + T.join('') + '</svg>';
      e.style.opacity = Math.min(1, (t - t0) / 0.3, (t1 - t) / 0.2).toFixed(3);
    },
    // (el velocímetro: lee la velocidad del auto de verdad; la aguja de 0 a 120)
    velocimetro(t, o, t0, t1, fija) {
      if (t < t0 || t > t1 || !o) { this.quitar('coVel'); return; }
      const e = this.el('coVel', 'coVel'), v = fija !== undefined ? fija : this.velo(o), a = Math.PI * (1 - Math.min(120, v) / 120), cx = 89, cy = 74, r = 56;
      let ticks = ''; for (let k = 0; k <= 12; k++) { const b = Math.PI * (1 - k / 12), l = k % 2 ? 6 : 11; ticks += '<line x1="' + (cx + Math.cos(b) * r).toFixed(1) + '" y1="' + (cy - Math.sin(b) * r).toFixed(1) + '" x2="' + (cx + Math.cos(b) * (r - l)).toFixed(1) + '" y2="' + (cy - Math.sin(b) * (r - l)).toFixed(1) + '" stroke="' + (k >= 10 ? '#ff4b4b' : '#fff') + '" stroke-width="2.5"/>'; }
      e.innerHTML = '<svg width="178" height="122">' + ticks + '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * (r - 4)).toFixed(1) + '" y2="' + (cy - Math.sin(a) * (r - 4)).toFixed(1) + '" stroke="#ff4b4b" stroke-width="4" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#fff"/></svg><b>' + Math.round(v) + '<small>KM/H</small></b>';
      e.classList.toggle('rojo', v >= 97); e.style.opacity = Math.min(1, (t - t0) / 0.2, (t1 - t) / 0.2).toFixed(3);
    },
    lienzo(s, rot, dx, dy) { const c = $('cv'), tr = (s && s !== 1) || rot || dx || dy ? 'translate(' + (dx || 0).toFixed(1) + 'px,' + (dy || 0).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg) scale(' + (s || 1).toFixed(4) + ')' : ''; if (c.style.transform !== tr) c.style.transform = tr; },
    todo(t) { this.top(); this.cap(t); this.chat(t); this.kill(t); },
  };`;
const CINE = (p, m, r) => `{ DBG.sinVista = true; const P = ${p}, M = ${m}; return { p: [P.x, P.y, P.z], m: [M.x, M.y, M.z], r: ${r || 0} }; }`;
// (el auto que va a 100 hacia la pared: su trompa llega a la pared en tg —tiempo del juego desde que arranca—; hasta ahí se
// lo lleva derecho, después lo suelta y choca de verdad. Se mide hasta la trompa —no la mitad del largo—: si no, tocaba la
// pared mientras se lo seguía llevando y el choque contaba varias veces —con la destrucción nueva, explotaba—)
const FORZAR = (A, tg) => `if (${A}.o && !${A}.solto) { const o = ${A}.o, zf = 26.0 - 27.778 * Math.max(0, ${tg} - ${A}.gt); if (${A}.gt < ${tg}) { o.b.pos.z = zf - o.frente - 0.02; o.b.pos.x = (-2.0); o.b.vel.set(0, Math.min(0, o.b.vel.y), ${A}.gt >= 0 ? 27.778 : 0); o.b.ang.set(0, 0, 0); o.b.q.copy(${A}.q0); o.b.wake && o.b.wake(); } else { ${A}.solto = 1; ${A}.tc = __tr.t; } }`;
const DT = `(1 / 30)`;
export const ESCENAS = {
  // ---- 0. el gancho: el auto cae los últimos metros a 100 y se estrola (cámara lenta); el rebobinado va en el montaje ----
  gancho: {
    t0: 0, t1: 2.6, mapa: 'RB_Construct', espera: 3000, antes: 20,
    preparar: COMUN + `CO.yo(3, -14, Math.PI * 0.85, -0.5);
      const g = CO.g(8, -20), o = CO.auto(8, -20, 18, 0.9, true); o.b.vel.set(0, -Math.sqrt(27.778 * 27.778 - 2 * 9.81 * 18), 0); o.b.ang.set(0.4, 0.2, 0.3);
      for (let i = 0; i < 5; i++) crearObjeto('CajaMadera', CO.P(8 + (i - 2) * 1.8, -15.2 + (i % 2) * 1.2, 0), Quat.axis(0, 1, 0, i), {});
      window.__A = { o, g, tg: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; if (__tr.i < 0) { A.o.b.vel.set(0, -Math.sqrt(27.778 * 27.778 - 2 * 9.81 * 18), 0); const p = CO.P(8, -20, 18 + 1); A.o.b.pos.set(p.x, p.y, p.z); }
      if (A.tg > 90) A.vmax = Math.max(A.vmax || 0, CO.velo(A.o)); if (A.tg > 90 && CO.caja(A.o).min.y < A.g + 0.08) { A.tg = t; A.vg = A.vmax; window.__dbg = { gancho: t, kmh: +A.vg.toFixed(1) }; CO.polvo(v3(8, A.g, -20), 40, 1.6); CO.chispas(v3(8, A.g + 0.3, -20), 30); }`,
    ritmo: `const t = __tr.t, A = window.__A; return A.tg < 90 ? (t < A.tg + 0.05 ? 0.004 : t < A.tg + 0.6 ? 0.3 : 0.6) : (CO.caja(A.o).min.y < A.g + 4.5 ? 0.25 : 1);`,
    cam: `const t = __tr.t, A = window.__A, s = TRH.temblor(t, A.tg, 0.15); ${CINE('CO.P(8 + 7.5 + s[0], -20 - 5.5 + s[2], 0.5 + s[1])', 'CO.P(8, -20, 2.4)', '-0.06')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.velocimetro(t, A.o, 0, 2.6, A.tg < 90 ? A.vg : undefined); const d = t - A.tg, a = d >= 0 ? Math.max(0, 1 - d / 0.5) : 0; CO.lienzo(1 + a * 0.12, 0, Math.sin(t * 90) * a * 9, Math.cos(t * 77) * a * 8);`,
  },
  // ---- 1. la altura: el auto colgado a 39,3 m, la regla de 13 pisos y el zoom de vértigo ----
  altura: {
    t0: 2.9, t1: 5.6, mapa: 'RB_Construct', espera: 3000, antes: 20,
    preparar: COMUN + `CO.yo(4.5, -20.5, Math.PI / 2, -1.1);
      const g = CO.g(8, -20), o = CO.auto(8, -20, 39.33, 0.9, true); o.b.frozen = true; window.__A = { o, g }; return 1;`,
    cada: `const A = window.__A; A.o.b.frozen = true; CO.yo(4.5, -20.5, Math.PI / 2, -1.1);`,
    cam: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 2.9) / 2.7), d = 7 + k * 15; DBG.fov = 2 * Math.atan(9.2 / d) * 180 / Math.PI; ${CINE('CO.P(8 - d * 0.55, -20 - d * 0.83, 1.2)', 'CO.P(8, -20, 19.5)', '0')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.regla(v3(5.3, A.g, -20), v3(1, 0, 0), t, 2.95, 5.6); CO.lienzo(1);`,
  },
  // ---- 2. «¿exagerado?»: el que explica al lado del auto; «¿EXAGERADO?» pintado en el piso ----
  duda: {
    t0: 5.6, t1: 9.6, mapa: 'RB_Construct', espera: 3000, antes: 30,
    preparar: COMUN + `const o = CO.auto((-2.0), 14, 0, 0); CO.yo((-2.0) + 2.2, 12.6, -0.6, 0.1); window.__A = { o }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; let yaw = Math.PI + 0.3, pitch = 0.05;
      if (t < 6.6) { yaw = CO.mirarA(A.o.b.pos); pitch = 0.2; } else if (t < 7.3) yaw = Math.PI + 0.3 + (t - 6.6) * 9; else if (t < 8.3) { yaw = CO.mirarA(A.o.b.pos); pitch = 0.2; }
      CO.yo((-2.0) + 2.2, 12.6, yaw, pitch); ENT.agachar = CO.agachadas(t, 8.3, 9.5); ENT.disparo = (t > 6.0 && t < 6.12) || (t > 7.6 && t < 7.72) || (t > 7.95 && t < 8.07); ENT.saltar = t > 7.35 && t < 7.43;`,
    cam: `const t = __tr.t, k = TRH.suave((t - 5.6) / 4); ${CINE('CO.P((-2.0) + 1.4 + k * 0.8, 6.4 + k * 0.7, 1.7)', 'CO.P((-2.0) + 1.2, 13.4, 0.8)', '0')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1); CO.texto3D('ex', '¿EXAGERADO? 🤨', CO.rect(CO.P((-2.0) + 1.2, 11.4, 0.03), v3(-1, 0, 0), v3(0, 0, 1), 3.2, 0.9), 5.85, 7.9);`,
  },
  // ---- 3. la prueba 1: el auto a 100 contra la pared («100 KM/H» pintado en la pared); cámara que lo acompaña y el golpe ----
  pared: {
    t0: 9.6, t1: 13.8, mapa: 'RB_Construct', espera: 3000, antes: 20,
    preparar: COMUN + `CO.yo((-2.0) + 6, 18, -0.4, 0);
      const o = CO.auto((-2.0), -40, 0, 0); for (let i = 0; i < 4; i++) crearObjeto('CajaMadera', CO.P((-2.0) + (i % 2 - 0.5) * 1.1, 26.0 - 0.6, Math.floor(i / 2) * 1.0), Quat.axis(0, 1, 0, 0.2 * i), {});
      window.__A = { o, q0: o.b.q.clone(), gt: -0.4, tc: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo((-2.0) + 6, 18, -0.6, 0); A.gt = __tr.i < 0 ? -0.4 : A.gt + ${DT} * (t < 12.0 ? 1 : t < 13.2 ? 0.25 : 1); ${FORZAR('A', 2.1)}
      if (A.solto && !A.f) { A.f = 1; const p = CO.Pw((-2.0), 26.0 - 0.3, 0.7); CO.polvo(p, 40, 1.4); CO.chispas(p, 40); window.__dbg = { choque: t, kmh: +CO.velo(A.o).toFixed(1) }; }`,
    ritmo: `const t = __tr.t; return t < 12.0 ? 1 : t < 13.2 ? 0.25 : 1;`,
    cam: `const t = __tr.t, A = window.__A, z = A.o.b.pos.z, s = TRH.temblor(t, A.tc, 0.16);
      if (t < 11.55) ${CINE('CO.P((-2.0) + 6.5, Math.min(z - 3, 15), 1.3)', 'v3(A.o.b.pos.x, A.o.b.pos.y + 0.4, A.o.b.pos.z + 2)', '0.04')}
      ${CINE('CO.P((-2.0) + 6.2 + s[0], 26.0 - 7.5 + s[2], 1.1 + s[1])', 'CO.P((-2.0), 26.0 - 1.5, 1.2)', '-0.04')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.velocimetro(t, A.o, 9.7, 13.8); CO.texto3D('cien', '100 KM/H', CO.rect(CO.Pw((-2.0) + 0.4, 26.0 - 0.04, 3.4), v3(-1, 0, 0), v3(0, 1, 0), 4.4, 1.25), 9.7, 13.8, 'pintado');
      const d = t - A.tc, a = d >= 0 ? Math.max(0, 1 - d / 0.6) : 0; CO.lienzo(1 + a * 0.16, a * 2 * Math.sin(t * 60), Math.sin(t * 93) * a * 9, Math.cos(t * 81) * a * 8);`,
  },
  // ---- 4. la repetición: el mismo choque desde arriba de la pared, en cámara lenta ----
  repe: {
    t0: 13.8, t1: 17.4, mapa: 'RB_Construct', espera: 3000, antes: 20,
    preparar: COMUN + `CO.yo((-2.0) + 6, 18, -0.4, 0);
      const o = CO.auto((-2.0), 0, 0, 0); for (let i = 0; i < 4; i++) crearObjeto('CajaMadera', CO.P((-2.0) + (i % 2 - 0.5) * 1.1, 26.0 - 0.6, Math.floor(i / 2) * 1.0), Quat.axis(0, 1, 0, 0.2 * i), {});
      window.__A = { o, q0: o.b.q.clone(), gt: -1, tc: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo((-2.0) + 6, 18, -0.6, 0); A.gt = __tr.i < 0 ? -1 : (A.gt < 0 ? 0 : A.gt + ${DT} * 0.33); ${FORZAR('A', 0.6)}
      if (A.solto && !A.f) { A.f = 1; const p = CO.Pw((-2.0), 26.0 - 0.3, 0.7); CO.polvo(p, 40, 1.4); CO.chispas(p, 40); }`,
    ritmo: `return 0.33;`,
    cam: `const t = __tr.t, A = window.__A, k = TRH.suave((t - 13.8) / 3.6); ${CINE('CO.P((-2.0) - 3.2 + k * 1.2, 26.0 - 2.4, 6.5 - k * 1.5)', 'v3(A.o.b.pos.x, A.o.b.pos.y, A.o.b.pos.z + 1.5)', '0.05')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.lienzo(1); CO.velocimetro(t, A.o, 13.85, 17.4); const e = CO.el('coRec', 'coRec'); if (!e._h) { e._h = 1; e.innerHTML = '<i></i>REPETICIÓN'; } e.style.opacity = Math.floor(t * 2) % 2 ? 1 : 0.75;`,
  },
  // ---- 5. la prueba 2: la grúa sube por los 13 pisos, se suelta, la cámara cae con el auto, cámara lenta y congelado ----
  caida: {
    t0: 17.4, t1: 27.5, mapa: 'RB_Construct', espera: 3000, antes: 20,
    preparar: COMUN + `CO.yo(4.4, -21, Math.PI / 2, -1.2);
      const g = CO.g(8, -20), o = CO.auto(8, -20, 39.33, 0.9, true); o.b.frozen = true; window.__A = { o, g, suelto: 0, tg: 99, ts: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo(4.4, -21, Math.PI / 2, t < 23.6 ? -1.2 : 0.1); ENT.agachar = CO.agachadas(t, 25.0, 27.4);
      if (!A.suelto) { A.o.b.frozen = true; if (__tr.i >= 0 && t >= 20.0) { A.suelto = 1; A.ts = t; A.o.b.frozen = false; A.o.b.wake && A.o.b.wake(); A.o.b.vel.set(0, 0, 0); A.o.b.ang.set(0, 0, 0); } }
      if (A.suelto && A.tg > 90) A.vmax = Math.max(A.vmax || 0, CO.velo(A.o)); if (A.suelto && A.tg > 90 && CO.caja(A.o).min.y < A.g + 0.08) { A.tg = t; A.vg = A.vmax; window.__dbg = { caida: t, kmh: +A.vg.toFixed(2) }; CO.polvo(v3(8, A.g, -20), 46, 1.7); CO.chispas(v3(8, A.g + 0.3, -20), 34); }`,
    ritmo: `const t = __tr.t, A = window.__A; if (A.tg < 90) return t < A.tg + 0.6 ? 0.004 : 1; return A.suelto && CO.caja(A.o).min.y < A.g + 6 ? 0.25 : 1;`,
    cam: `const t = __tr.t, A = window.__A, s = TRH.temblor(t, A.tg + 0.6, 0.12), y = CO.caja(A.o).min.y;
      if (!A.suelto) { const k = TRH.suave((t - 17.4) / 2.4); DBG.fov = 0; ${CINE('CO.P(8 - 6.5, -20 - 8.5, 1.2 + k * (39.33 - 0.2))', 'CO.P(6, -20, 1.2 + k * (39.33 - 0.5) + 0.8)', '0')} }
      if (A.tg > 90) { const h = Math.max(A.g + 1.1, y + 1.3); ${CINE('v3(8 - 6.5, h, -20 - 8.5)', 'v3(8, y + 1.0, -20)', '0')} }
      const k = TRH.suave((t - A.tg - 0.6) / 3); ${CINE('CO.P(8 - 6.5 + Math.sin(k * 1.2) * 4 + s[0], -20 - 8.5 + k * 2.5 + s[2], 1.1 + k * 0.8 + s[1])', 'CO.P(8, -20, 0.8)', '0')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); CO.regla(v3(5.3, A.g, -20), v3(1, 0, 0), t, 17.45, A.suelto ? Math.min(27.5, A.ts + 1.2) : 27.5); CO.velocimetro(t, A.o, 19.6, 27.5, A.suelto ? Math.max(A.vmax || 0, CO.velo(A.o)) : undefined);
      CO.texto3D('cien2', '100 KM/H 💥', CO.rect(vadd(CO.P(8, -20, 0), v3(0, 2.2, 0)), v3(-0.863, 0, 0.505), v3(0, 1, 0), 2.8, 0.78), A.tg + 0.7, 27.5);   // (parado en el aire arriba del auto, de frente a la cámara)
      const d = t - A.tg - 0.6, a = d >= 0 ? Math.max(0, 1 - d / 0.5) : 0; CO.lienzo(1 + a * 0.1, 0, Math.sin(t * 90) * a * 8, Math.cos(t * 77) * a * 7);`,
  },
  // ---- 6. «Pepe no lo usaba»: Pepe arriba del auto; el auto choca a 100 y Pepe sigue de largo contra la pared ----
  pepe: {
    t0: 31.5, t1: 37.5, mapa: 'RB_Construct', espera: 3000, antes: 30,
    preparar: COMUN + `CO.yo((-2.0) + 3.6, 16.0, -0.8, 0);
      const o = CO.auto((-2.0), -30, 0, 0); const pe = CO.pj('Engineer', (-2.0), -33, 0, { modo: 'quieto' });
      window.__A = { o, pe, q0: o.b.q.clone(), gt: -1, tc: 99 }; return 1;`,
    cada: `const t = __tr.t, A = window.__A; CO.yo((-2.0) + 3.6, 16.0, t < 33.4 ? CO.mirarA(A.o.b.pos) : -0.6, 0.05);
      ENT.agachar = CO.agachadas(t, 35.3, 37.4);
      A.gt = __tr.i < 0 ? -1 : t - 31.6; ${FORZAR('A', 1.75)}
      // (Pepe parado en el techo, bailando: el techo medido en la malla del auto —vehCols—; va con el auto hasta el choque)
      if (!A.solto) { if (!A.rl) { const C = vehCols(A.o.veh), bb = CO.caja(A.o); let y = bb.max.y - A.o.b.pos.y; if (C) { const ys = C.cortes(0, -0.35); if (ys.length) y = Math.max(...ys); } A.rl = v3(0, y, -0.35); }
        const P = A.pe, w = vadd(vadd(A.o.b.pos, A.o.b.q.rot(A.rl)), v3(0, 0.95, 0)); P.pos.copy(w); P.vel.copy(A.o.b.vel); P.yaw = 0; P.suelo = true;
        if (P.npcB) { P.npcB.noPhys = P.npcB.noRay = P.npcB.noJug = true; P.npcB.pos.copy(w); P.npcB.vel.copy(A.o.b.vel); P.npcB.updateWorld && P.npcB.updateWorld(); } }   // (la cápsula sin chocar con el techo: si no, cada roce era un golpe al auto)
      // (el auto frena contra la pared y Pepe sigue a 100: sale volando contra la pared)
      if (A.solto && !A.volo) { A.volo = 1; const P = A.pe; npcTumbar(P, v3(0, 2.5 / 0.6, 27.778 / 0.6)); if (P.ia) P.ia.ragT = 1e9; }
      if (A.solto && !A.f) { A.f = 1; const p = CO.Pw((-2.0), 26.0 - 0.3, 0.7); CO.polvo(p, 36, 1.3); CO.chispas(p, 34); }
      CO.seguirRag(A.pe);`,
    ritmo: `const t = __tr.t, A = window.__A; return A.tc < 90 && t < A.tc + 0.9 ? 0.25 : 1;`,
    cam: `const t = __tr.t, A = window.__A, s = TRH.temblor(t, A.tc, 0.14), z = A.o.b.pos.z;
      if (t < 33.0) ${CINE('CO.P((-2.0) + 5.5, Math.min(z - 4, 18), 1.6)', 'v3(A.o.b.pos.x, A.o.b.pos.y + 0.8, A.o.b.pos.z + 1)', '0.03')}
      ${CINE('CO.P((-2.0) + 5.4 + s[0], 26.0 - 6.8 + s[2], 1.5 + s[1])', 'CO.P((-2.0), 26.0 - 1.4, 1.5)', '-0.03')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); const d = t - A.tc, a = d >= 0 ? Math.max(0, 1 - d / 0.6) : 0; CO.lienzo(1 + a * 0.14, 0, Math.sin(t * 90) * a * 9, Math.cos(t * 77) * a * 8);`,
  },
  // ---- 7. el final: «USÁ EL CINTURÓN» pintado en la pared; seguime ----
  fin: {
    t0: 37.5, t1: 41.0, mapa: 'RB_Construct', espera: 3000, antes: 30,
    preparar: COMUN + `window.__F = CO.auto((-2.0), 26.0 - 3.2, 0, 0); CO.yo((-2.0) + 3.2, 26.0 - 6.0, Math.PI, 0); return 1;`,
    listo: `CO.chocado(window.__F, 130);`,
    cada: `const t = __tr.t; CO.yo((-2.0) + 3.2, 26.0 - 6.0, Math.PI, -0.05); ENT.agachar = CO.agachadas(t, 37.6, 38.6) || CO.agachadas(t, 40.2, 40.95); ENT.saltar = t > 39.3 && t < 39.38; ENT.disparo = t > 39.8 && t < 39.92;`,
    cam: `const t = __tr.t, k = TRH.suave((t - 37.5) / 3.5); ${CINE('CO.P((-2.0) + 3.5 - k * 0.8, 26.0 - 10.5 + k * 0.6, 1.6)', 'CO.P((-2.0) + 2.4, 26.0 - 2, 2.0)', '0')}`,
    titulos: `const t = __tr.t; CO.todo(t); CO.lienzo(1); CO.texto3D('cint', 'USÁ EL CINTURÓN', CO.rect(CO.Pw((-2.0) + 2.4, 26.0 - 0.04, 3.3), v3(-1, 0, 0), v3(0, 1, 0), 5.6, 1.35), 37.7, 41.0, 'pintado'); CO.sticker('seg', '<div class="coSeguir">+ Seguir</div>', 39.0, 41.0, 50, 79, 0);`,
  },
  // ---- 8. a Pepe siempre le pasa algo: se levanta al lado del auto chocado (humeando, con fuego), «estoy bien 👍»… y el
  // auto explota y lo vuela otra vez (la destrucción nueva: abollado, ardiendo y explotando de verdad) ----
  pepe2: {
    t0: 41.0, t1: 47.5, mapa: 'RB_Construct', espera: 3200, antes: 30,
    preparar: COMUN + `CO.yo((-2.0) + 8, 12, -0.6, 0);
      const o = CO.auto((-2.0), 19.0, 0, 0); o.b.vel.set(0, 0, 27.778); o.b.wake && o.b.wake(); window.__A = { o, tx: 99 }; return 1;`,
    listo: `const A = window.__A, o = A.o; o.b.ang.set(0, 0, 0); CO.chocado(o, 70);
      const lado = o.b.q.rot(v3(1, 0, 0)), p = vadd(o.b.pos, vadd(vscale(lado, 2.1), o.b.q.rot(v3(0, 0, -0.9)))), cam = CO.P((-2.0) + 7.2, 26.0 - 9.5, 1.5);
      const pe = CO.pj('Engineer', p.x, p.z, Math.atan2(cam.x - p.x, cam.z - p.z), { modo: 'quieto' }); pe.vida = 1e6; A.pe = pe; A.cam = cam; A.p0 = p.clone(); A.u = vsub(cam, p); A.u.y = 0; A.u.norm();`,
    cada: `const t = __tr.t, A = window.__A; CO.yo((-2.0) + 8, 12, -0.6, 0);
      if (__tr.i >= 0 && t >= 42.45 && !A.dijo) { A.dijo = 1; npcDecir(A.pe, 'estoy bien 👍'); }
      if (__tr.i >= 0 && t >= 43.7 && !A.boom) { A.boom = 1; A.tx = t; const d = vsub(A.pe.pos, A.o.b.pos); d.y = 0; d.norm();
        if (A.pe.globo) { A.pe.globo.remove(); A.pe.globo = null; } npcTumbar(A.pe, v3(d.x * 6, 7.5, d.z * 6)); if (A.pe.ia) A.pe.ia.ragT = 1e9; danarObjeto(A.o, 999, A.o.b.pos, v3(0, 1, 0)); window.__dbg = Object.assign(window.__dbg || {}, { boom: t }); }
      CO.seguirRag(A.pe);`,
    ritmo: `const t = __tr.t, A = window.__A; return A.tx < 90 && t < A.tx + 1.1 ? 0.3 : 1;`,
    cam: `const t = __tr.t, A = window.__A, s = TRH.temblor(t, A.tx, 0.2), u = A.u, p0 = A.p0;
      if (A.tx > 90) { const k = TRH.suave((t - 41.0) / 2.7), d = 4.4 - k * 1.0, m = vadd(vscale(vadd(p0, v3(0, 1.0, 0)), 0.72), vscale(vadd(A.o.b.pos, v3(0, 0.6, 0)), 0.28)); A.cp = vadd(p0, vadd(vscale(u, d), v3(0, 1.45 - k * 0.15, 0)));
        ${CINE('A.cp', 'm', '0')} }
      const h = A.pe.rag && A.pe.rag.cuerpos.get(A.pe.D.h.Hips), q = h ? h.b.pos : A.pe.pos; A.sig = A.sig ? vadd(A.sig, vscale(vsub(q, A.sig), 0.14)) : q.clone();
      const meta = vadd(A.sig, vadd(vscale(u, 4.6), v3(0, 1.7, 0))); A.cp = vadd(A.cp, vscale(vsub(meta, A.cp), 0.07));
      ${CINE('vadd(A.cp, v3(s[0], s[1], s[2]))', 'vadd(A.sig, v3(0, 0.3, 0))', '-0.03')}`,
    titulos: `const t = __tr.t, A = window.__A; CO.todo(t); const d = t - A.tx, a = d >= 0 ? Math.max(0, 1 - d / 0.7) : 0; CO.lienzo(1 + a * 0.16, a * 2.5 * Math.sin(t * 55), Math.sin(t * 90) * a * 10, Math.cos(t * 77) * a * 9);
      CO.sticker('volvera', '<div class="coGrande">PEPE<br>VOLVERÁ 💀</div>', 46.2, 47.5, 50, 40, -4);`,
  },
};
