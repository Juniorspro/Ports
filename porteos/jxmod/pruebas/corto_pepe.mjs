// corto 7 (4:3, 150 s a 30 cuadros): «La venganza de Pepe», analog horror grabado con el Viewfinder (Found Footage &
// Camcorder SWEP, Workshop 3780178294) —su VHS de verdad: señal NTSC compuesta, cinta gastada, visión nocturna, el OSD—.
// Una cinta recuperada del servidor gm_construct: un video instructivo de los 90 («Lección 4: tu muñeco de pruebas»), la
// alerta de emergencia del servidor y la grabación de alguien que entró de noche. Todo lo que se dibuja en la imagen
// (títulos, el contador, la alerta) va dentro del OSD del mod —FFCam.DrawViewfinder—, así pasa por la cinta igual que
// el REC; lo pintado en las paredes, con cam.Start3D2D. El aviso de muerte del final va por encima, como el HUD de GMod.
// uso: ESC=pruebas/corto_pepe.mjs VW=720 VH=540 DPR=1 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA escena[,escena]
// (el .gma del Viewfinder va en /ah/3780178294.gma del mismo servidor; de noche ~2 s por cuadro: las tomas son cortas y
// se graban de a tres navegadores; ee arranca donde terminó ed2: ED2='{"en":[x, y, z, yaw]}' con lo que ed2 imprime)
export const FPS = 30;
export const CSS = `
  #trOver .kf{position:absolute;right:3.2%;top:4.5%;display:flex;align-items:center;gap:9px;padding:5px 11px;border-radius:5px;background:rgba(0,0,0,.62);font:700 17px Tahoma,Verdana,'DejaVu Sans',sans-serif;text-shadow:0 1px 1px #000}
  #trOver .kf b{color:#ff5a4a;font-weight:700} #trOver .kf i{color:#fff2a0;font-style:normal} #trOver .kf svg{display:block}
`;
const VF = `
  if (!window.__vf) { const b = new Uint8Array(await (await fetch('/ah/3780178294.gma')).arrayBuffer()); const A = await gmInstalar('3780178294', { nombre: 'Viewfinder', sinDeps: true }, b); await A.listo; window.__vf = 1; }
  window.vfCmd = (s) => { const cx = GMA.ctx; GMA.ctx = 'C'; gmaLado('C'); try { GMA.R.G.get('RunString')(s, 'corto'); } finally { GMA.ctx = cx; gmaLado(cx); } };
  window.aLua = (x) => Array.isArray(x) ? '{' + x.map(aLua).join(',') + '}' : typeof x === 'string' ? JSON.stringify(x) : typeof x === 'number' ? (isFinite(x) ? String(+x.toFixed(4)) : '0') : x ? 'true' : 'false';
  if (!ARM.lista[ARM.i] || !/ffcam/.test(ARM.lista[ARM.i])) spawnElegir('GMod', 'gmswep:weapon_ffcamcorder');
  vfCmd(\`
    JXC = JXC or { ops = {}, w = {} }
    if not JXC.fuentes then JXC.fuentes = true
      for _, s in ipairs({ 16, 20, 24, 30, 40, 56, 80, 120 }) do surface.CreateFont("JXV" .. s, { font = "VCR OSD Mono", size = s, weight = 400, extended = true }) surface.CreateFont("JXA" .. s, { font = "Anton", size = s, weight = 400, extended = true }) end
      surface.CreateFont("JXP", { font = "VCR OSD Mono", size = 200, weight = 400, extended = true })
      surface.CreateFont("JXG", { font = "VCR OSD Mono", size = 170, weight = 400, extended = true })
    end
    if not JXC.envuelto and FFCam and FFCam.DrawViewfinder then JXC.envuelto = true
      local orig = FFCam.DrawViewfinder
      FFCam.DrawViewfinder = function(font, fontsize, drawtext, bounds)
        if not JXC.sinOSD then orig(font, fontsize, drawtext, bounds) end
        local b = bounds or { x = 0, y = 0, w = ScrW(), h = ScrH() }
        for _, o in ipairs(JXC.ops) do
          if o[1] == "r" then surface.SetDrawColor(o[6], o[7], o[8], o[9]) surface.DrawRect(b.x + o[2] * b.w, b.y + o[3] * b.h, o[4] * b.w, o[5] * b.h)
          elseif o[1] == "t" then draw.SimpleText(o[2], o[3], b.x + o[4] * b.w, b.y + o[5] * b.h, Color(o[6], o[7], o[8], o[9]), o[10] or 0, o[11] or 0) end
        end
      end
      hook.Add("PostDrawOpaqueRenderables", "jxc3d", function()
        for _, o in ipairs(JXC.w) do
          local n = Vector(o[4][1], o[4][2], o[4][3]) local a = n:Angle() a:RotateAroundAxis(a:Up(), 90) a:RotateAroundAxis(a:Forward(), 90)
          cam.Start3D2D(Vector(o[3][1], o[3][2], o[3][3]) + n * 0.6, a, o[5]) draw.SimpleText(o[1], o[2], 0, 0, Color(o[6], o[7], o[8], o[9]), 1, 1) cam.End3D2D()
        end
      end)
    end\`);
  vfCmd('RunConsoleCommand("ffcam_vhs_aspect","2") RunConsoleCommand("ffcam_vhs_format","1") RunConsoleCommand("ffcam_vhs_signal_profile","2") RunConsoleCommand("ffcam_osd_font","2") RunConsoleCommand("ffcam_vhs_osd_realtime","0") RunConsoleCommand("ffcam_vhs_date_year","1998") RunConsoleCommand("ffcam_vhs_date_month","11") RunConsoleCommand("ffcam_vhs_date_day","18") RunConsoleCommand("ffcam_vhs_date_hour","3") RunConsoleCommand("ffcam_vhs_date_minute","12") RunConsoleCommand("ffcam_intro_left","0") RunConsoleCommand("ffcam_nv_brightness","0.6") RunConsoleCommand("ffcam_lamp_brightness","0.35") RunConsoleCommand("ffcam_regrip","0") RunConsoleCommand("ffcam_battery","0") JXC.ops = {} JXC.w = {}');
  // (del juego a las coordenadas de GMod: Source x = z del juego, y = x, z = altura)
  window.aG = (p) => [p.z / 0.0254, p.x / 0.0254, (p.y - GMA.oy) / 0.0254];
  window.aGd = (d) => [d.z, d.x, d.y];
  // lo que va en la imagen este cuadro: r (rectángulo), t (texto) —en fracciones del cuadro de la cinta—; w (pintado)
  window.TX = {
    ops: [], w: [], sinOSD: false,
    r(x, y, w, h, c, a) { this.ops.push(['r', x, y, w, h, c[0], c[1], c[2], a ?? 255]); },
    t(s, f, x, y, c, a, ax, ay) { this.ops.push(['t', s, f, x, y, c[0], c[1], c[2], a ?? 255, ax ?? 0, ay ?? 3]); },
    ts(s, f, x, y, c, a, ax, ay, d) { d = d || 0.004; this.t(s, f, x + d, y + d * 1.33, [0, 0, 0], Math.round((a ?? 255) * 0.85), ax, ay); this.t(s, f, x, y, c, a, ax, ay); },
    pared(s, f, p, n, esc, c, a) { this.w.push([s, f, aG(p), aGd(n), esc, c[0], c[1], c[2], a ?? 255]); },
    enviar() { vfCmd('JXC.ops = ' + aLua(this.ops) + ' JXC.w = ' + aLua(this.w) + ' JXC.sinOSD = ' + (this.sinOSD ? 'true' : 'false')); this.ops = []; this.w = []; },
  };
`;
const COMUN = `
  if (window.__pnO) performance.now = window.__pnO;
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  ENT.disparo = ENT.disparo2 = false; ENT.tactil = true; ENT.x = ENT.y = 0; ENT.saltar = ENT.agachar = ENT.correr = false;
  PREFS.evento = false; DIA.ciclo = false; DIA.aplicada = -1; JUG.tercera = false; JUG.vel.set(0, 0, 0); JUG.vida = 1e7; DBG.cam = null; DBG.sinVista = false; DBG.fov = 0; PREFS.fov = 70;
  $('cv').style.transform = ''; $('cv').style.filter = ''; $('trOver').innerHTML = '';
  window.CO = {
    g(x, z) { return pisoBajo(v3(x, 10, z), 40) ?? -3.76; },
    P(x, z, h) { return v3(x, this.g(x, z) + (h || 0), z); },
    Pw(x, z, h) { return v3(x, this.g(x, z - 2) + (h || 0), z); },
    caja(o) { const b = o.b, Q = puntosForma(o.F.shape), mn = v3(1e9, 1e9, 1e9), mx = v3(-1e9, -1e9, -1e9); for (const v of Q) { const w = vadd(b.q.rot(v), b.pos); mn.x = Math.min(mn.x, w.x); mn.y = Math.min(mn.y, w.y); mn.z = Math.min(mn.z, w.z); mx.x = Math.max(mx.x, w.x); mx.y = Math.max(mx.y, w.y); mx.z = Math.max(mx.z, w.z); } return { min: mn, max: mx }; },
    yo(x, z, yaw, pitch) { const p = this.P(x, z, 0.97); JUG.pos.x = p.x; JUG.pos.z = p.z; if (JUG.pos.y < p.y - 0.3 || JUG.pos.y > p.y + 3) JUG.pos.y = p.y; if (yaw !== undefined) JUG.yaw = yaw; if (pitch !== undefined) JUG.pitch = pitch; JUG.vel.x = 0; JUG.vel.z = 0; },
    yaw(de, a) { return Math.atan2(a.x - de.x, a.z - de.z); },
    pj(sk, x, z, yaw, act) { const P = npcCrear(sk, this.P(x, z, 0), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); if (P && P.ia) P.ia.ragT = 1e9; return P; },
    pepe(x, z, yaw, act) { return this.pj('Engineer', x, z, yaw, act); },
    tumbar(P, imp) { if (!P) return; if (!P.rag) npcTumbar(P, imp); if (P.ia) P.ia.ragT = 1e9; },
    auto(x, z, h, yaw) { const o = crearObjeto('Sedan', this.P(x, z, h || 0), Quat.axis(0, 1, 0, yaw || 0), {}); const bb = this.caja(o); if (bb.max.x - bb.min.x > bb.max.z - bb.min.z) { borrarObjeto(o, true); return this.auto(x, z, h, (yaw || 0) + Math.PI / 2); } o.medio = (bb.max.z - bb.min.z) / 2; o.frente = bb.max.z - o.b.pos.z; return o; },
    chocado(o, vida) { const bb = this.caja(o), fr = bb.max.z - o.b.pos.z; o.b.pos.z = 26.0 - fr - 0.05; o.b.vel.set(0, 0, 0); o.b.updateWorld && o.b.updateWorld(); desAbollar(o, vadd(o.b.pos, o.b.q.rot(v3(0, -0.1, fr))), o.b.q.rot(v3(0, 0, -1)), 0.46, 1.4); desDe(o); o.veh.vida = vida; },
    polvo(p, n, esc, c) { for (let i = 0; i < (n || 16); i++) { const r = () => Math.random() - 0.5, e = esc || 1; particula(v3(p.x + r() * 0.9 * e, p.y + 0.05, p.z + r() * 0.9 * e), v3(r() * 5 * e, Math.random() * 1.6 * e + 0.3, r() * 5 * e), 0.6 + Math.random() * 0.8, (0.35 + Math.random() * 0.4) * e, c || [0.78, 0.72, 0.62, 0.6], 'humo', 1.8); } },
    // (la posición de un NPC es su cadera; se fija en x, z cada cuadro: así la IA no lo mueve)
    fijo(P, x, z) { if (!P || P.rag) return; P.pos.x = x; P.pos.z = z; P.vel.set(0, 0, 0); },
    // (la mirada del que filma hacia un punto: yaw y pitch —negativo es hacia arriba—)
    mira(p) { const o = vadd(JUG.pos, v3(0, 0.66, 0)), d = vsub(p, o); return [Math.atan2(d.x, d.z), -Math.atan2(d.y, Math.hypot(d.x, d.z))]; },
    gira(y, meta, k) { let d = meta - y; d = Math.atan2(Math.sin(d), Math.cos(d)); return y + d * k; },
    barril() { return DATA.pfPorNombre['BarrilExplosivo'] ? 'BarrilExplosivo' : null; },
  };
  window.LEJOS = () => vfCmd('RunConsoleCommand("ffcam_lamp_range","2.6") RunConsoleCommand("ffcam_nv_brightness","1.05")');
  window.NOCHE = (x, z, yaw, pitch) => { const o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); CO.yo(x, z, yaw, pitch); return o; };
  window.PINTADO = () => { TX.pared('1.047', 'JXP', CO.Pw(1.6, 26.0, 4.55), v3(0, 0, -1), 0.2, [120, 8, 8], 245); TX.pared('PEPE SIEMPRE VUELVE', 'JXV56', CO.Pw(1.6, 26.0, 3.45), v3(0, 0, -1), 0.26, [120, 8, 8], 240); };
  window.HZ = {
    s(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    k(t, a, b) { return this.s((t - a) / (b - a)); },
    dam: -1, dano(v) { v = Math.round(Math.max(0, Math.min(1, v)) * 50) / 50; if (v !== this.dam) { this.dam = v; vfCmd('RunConsoleCommand("ffcam_tape_damage","' + v + '")'); } },
    nvE: null, nv(on) { const k = on + ':' + (window.__tr && __tr.i >= 0 ? 1 : 0); if (this.nvE !== k) { this.nvE = k; vfCmd('FFCam.SetNightVision(' + (on ? 'true' : 'false') + ', true)'); } },
    lmE: null, lampara(m) { const k = m + ':' + (window.__tr && __tr.i >= 0 ? 1 : 0); if (this.lmE !== k) { this.lmE = k; vfCmd('if FFCam.SetLampMode then FFCam.SetLampMode(' + m + ') end'); } },
    cam(p, m, r, fov) { const d = vsub(m, p).norm(); DBG.cam = { p, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(Math.max(-1, Math.min(1, d.y))), r || 0) }; DBG.fov = fov || 0; },
    // la cámara del video instructivo: el jugador queda atrás de ella, sin verse
    tripode(p, m, r, fov) { this.cam(p, m, r, fov); const d = vsub(m, p).norm(); CO.yo(p.x - d.x * 1.5, p.z - d.z * 1.5, Math.atan2(d.x, d.z), 0); },
    // (tarjeta: para las placas a pantalla llena —alerta, títulos— la cámara mira el piso de cerca: dibujar el mundo cuesta poco)
    tarjeta() { this.cam(CO.P(9, -5, 0.4), CO.P(9.01, -5, 0)); CO.yo(9, -6.5, 0, 0); },
    // ---- el video instructivo de 1997 ----
    marca(a) { TX.t('JXMOD VIDEO EDUCATIVO', 'JXV16', 0.06, 0.935, [255, 255, 255], Math.round(150 * (a ?? 1)), 0, 3); TX.t('(C) 1997', 'JXV16', 0.94, 0.935, [255, 255, 255], Math.round(150 * (a ?? 1)), 2, 3); },
    portada(t, t0, n, titulo) {
      for (let i = 0; i < 12; i++) TX.r(0, i / 12, 1, 1 / 12 + 0.002, [10 + i * 3, 22 + i * 6, 90 + i * 9]);
      const a = this.k(t, t0, t0 + 0.5); TX.r(0.12, 0.43, 0.76 * a, 0.012, [235, 40, 40]);
      TX.ts('JXMOD', 'JXA120', 0.5, 0.36, [255, 214, 40], 255, 1, 1, 0.008);
      TX.ts('VIDEO INSTRUCTIVO Nº ' + n, 'JXV24', 0.5, 0.52, [255, 255, 255], Math.round(255 * this.k(t, t0 + 0.4, t0 + 0.8)), 1, 1);
      if (titulo) TX.ts(titulo, 'JXA40', 0.5, 0.64, [255, 255, 255], Math.round(255 * this.k(t, t0 + 0.9, t0 + 1.3)), 1, 1, 0.005);
    },
    zocalo(t, t0, t1, titulo, sub) {
      if (t < t0 || t > t1) return; const a = this.k(t, t0, t0 + 0.35) * (1 - this.k(t, t1 - 0.3, t1)), x = 0.07 - (1 - a) * 0.6;
      TX.r(x, 0.70, 0.62, 0.012, [255, 214, 40]); TX.r(x, 0.712, 0.62, sub ? 0.165 : 0.11, [18, 38, 128], 225);
      TX.ts(titulo, 'JXA40', x + 0.025, 0.718, [255, 255, 255], 255, 0, 3); if (sub) TX.ts(sub, 'JXV20', x + 0.025, 0.818, [255, 214, 40], 255, 0, 3);
    },
    contador(n, a) { TX.ts('PRUEBA Nº ' + n, 'JXV24', 0.93, 0.07, [255, 255, 255], Math.round(255 * (a ?? 1)), 2, 3); },
    aprobado(t, t0, t1) { if (t < t0 || t > t1) return; const a = this.k(t, t0, t0 + 0.12); TX.r(0.6, 0.2, 0.3, 0.11, [20, 140, 50], Math.round(230 * a)); TX.ts('APROBADO', 'JXA40', 0.75, 0.255, [255, 255, 255], Math.round(255 * a), 1, 1); },
    // ---- la alerta de emergencia ----
    alerta(t, cuerpo, grande, sinFondo) {
      if (!sinFondo) TX.r(0, 0, 1, 1, [0, 0, 0]);
      const parpadeo = Math.floor(t * 1.6) % 2 === 0;
      TX.r(0, 0.05, 1, 0.12, [160, 8, 8]); TX.t('ALERTA DE EMERGENCIA', 'JXV40', 0.5, 0.11, [255, 255, 255], parpadeo ? 255 : 200, 1, 1);
      if (!sinFondo) {
        TX.t('SISTEMA DE AVISOS DEL SERVIDOR JXMOD', 'JXV20', 0.5, 0.215, [210, 210, 210], 255, 1, 1);
        TX.t('EMITIDO: 18/11/1998 03:00   MAPA: gm_construct', 'JXV16', 0.5, 0.265, [170, 170, 170], 255, 1, 1);
        (cuerpo || []).forEach((l, i, L) => TX.t(l, grande ? 'JXV56' : 'JXV40', 0.5, 0.55 + (i - (L.length - 1) / 2) * (grande ? 0.11 : 0.095), grande ? [255, 50, 40] : [255, 255, 255], 255, 1, 1));
      } else (cuerpo || []).forEach((l, i) => { TX.r(0, 0.74 + i * 0.09, 1, 0.09, [0, 0, 0], 200); TX.t(l, 'JXV40', 0.5, 0.785 + i * 0.09, [255, 255, 255], 255, 1, 1); });
      const tk = 'NO LO MIRE A LOS OJOS  ///  NO LO SPAWNEE  ///  NO LE DÉ LA PALANCA  ///  NO SE SUBA A NINGÚN AUTO  ///  PEPE ESTÁ CONTANDO  ///  ';
      TX.r(0, 0.905, 1, 0.065, [160, 8, 8]); TX.t(tk + tk, 'JXV20', 1.02 - ((t * 0.11) % 1.53), 0.938, [255, 255, 255], 255, 0, 1);
    },
  };
`;
const RELOJ = `window.__pnO = window.__pnO || performance.now.bind(performance); window.__T = Math.max(window.__T || 0, window.__pnO()); performance.now = () => window.__T;`;
// el campo de las pruebas (gm_construct): Pepe parado en PX, PZ; la pared del edificio en z = 26
const PX = 0.0, PZ = 4.0;
export const ESCENAS = {
  // ---- 0. la cinta: PLAY en la pantalla azul y los datos de la grabación ----
  intro: {
    t0: 0, t1: 6, mapa: 'RB_Construct', espera: 6000, antes: 20,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true;
      HZ.dano(t < 0.5 ? 1 : t < 2.6 ? 0.9 - (t - 0.5) * 0.25 : 0.35);
      if (t < 0.5) TX.r(0, 0, 1, 1, [0, 0, 0]);
      else if (t < 2.6) { TX.r(0, 0, 1, 1, [16, 34, 168]); TX.t('PLAY', 'JXV40', 0.08, 0.08, [255, 255, 255], 255, 0, 3); TX.t('>', 'JXV40', 0.26, 0.08, [255, 255, 255], Math.floor(t * 2) % 2 ? 255 : 0, 0, 3); TX.t('SP', 'JXV30', 0.92, 0.84, [255, 255, 255], 255, 2, 3); TX.t('-0:00:00', 'JXV30', 0.08, 0.84, [255, 255, 255], 255, 0, 3); }
      else {
        TX.r(0, 0, 1, 1, [0, 0, 0]);
        const L = [[2.8, 'CINTA RECUPERADA'], [3.5, 'SERVIDOR: gm_construct'], [4.2, 'ÚLTIMA CONEXIÓN: 18/11/1998 03:12'], [4.9, 'CONTENIDO: 2 GRABACIONES']];
        L.forEach(([a, s], i) => { if (t < a) return; const n = Math.min(s.length, Math.floor((t - a) / 0.028)); TX.t(s.slice(0, n) + (n < s.length || (i === L.length - 1 && Math.floor(t * 2.5) % 2) ? '_' : ''), 'JXV24', 0.1, 0.3 + i * 0.1, [235, 235, 235], 255, 0, 3); });
      }
      TX.enviar();`,
  },
  // ---- 1. el video instructivo: portada, el campo y Pepe que saluda ----
  tut1: {
    t0: 6, t1: 16.5, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      window.__A = { pe: CO.pepe(${PX}, ${PZ}, Math.PI + 0.15, { modo: 'bailar', emote: 'Hi' }) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      if (t < 8.2) { HZ.tarjeta(); HZ.portada(t, 6.0, 4, 'LECCIÓN 4: TU MUÑECO DE PRUEBAS'); }
      else if (t < 11.6) { const k = HZ.k(t, 8.2, 11.6); HZ.tripode(CO.P(${PX} + 7 - k * 1.5, ${PZ} - 11 + k * 2, 2.6 - k * 0.5), CO.P(${PX}, ${PZ} + 2, 1.0)); HZ.zocalo(t, 8.5, 11.4, 'LECCIÓN 4', 'TU MUÑECO DE PRUEBAS'); HZ.marca(); }
      else { const k = HZ.k(t, 11.6, 16.5); HZ.tripode(CO.P(${PX} + 0.9 - k * 0.3, ${PZ} - 3.4 + k * 0.6, 1.5), CO.P(${PX}, ${PZ}, 1.1)); HZ.zocalo(t, 12.0, 16.2, 'PEPE', 'MUÑECO DE PRUEBAS OFICIAL'); HZ.marca(); }
      TX.enviar();`,
  },
  // ---- 2. «Pepe no siente dolor» (el auto) y «Pepe no se queja» (la heladera) ----
  tut2: {
    t0: 16.5, t1: 26.5, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const pe = CO.pepe(${PX}, ${PZ}, Math.PI / 2 - 0.25), o = CO.auto(${PX}, ${PZ} - 40, 0, 0);
      window.__A = { pe, o, q0: o.b.q.clone(), golpe: 99, fase: 1 }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      if (A.fase === 1 && t < 21.5) {
        // (el auto va derecho por z a 16 m/s y llega a Pepe a los 18.9 s; después sigue con su física)
        const zf = ${PZ} - A.o.frente - 0.35 - 16 * (18.9 - t);
        if (!A.solto) { if (t < 18.9) { A.o.b.pos.z = zf; A.o.b.pos.x = ${PX}; A.o.b.vel.set(0, Math.min(0, A.o.b.vel.y), 16); A.o.b.ang.set(0, 0, 0); A.o.b.q.copy(A.q0); A.o.b.wake && A.o.b.wake(); } else { A.solto = 1; A.golpe = t; CO.tumbar(A.pe, v3(1.5, 4.5, 10)); } }
        HZ.tripode(CO.P(${PX} + 7.5, ${PZ} + 0.5, 1.4), CO.P(${PX}, ${PZ} - 0.5, 1.0), 0, 58);
        HZ.contador('1.045'); HZ.aprobado(t, 19.5, 21.4); HZ.marca();
      } else {
        if (A.fase === 1) { A.fase = 2; borrarObjeto(A.o, true); npcTodos(); A.pe = CO.pepe(${PX}, ${PZ}, Math.PI + 0.1); A.h = crearObjeto('Heladera', CO.P(${PX} + 0.05, ${PZ}, 9), Quat.axis(0, 1, 0, Math.PI + 0.2), {}); A.h.b.frozen = true; A.cae = 0; A.tg = 99; }
        if (__tr.i >= 0 && t >= 22.55 && !A.cae) { A.cae = 1; A.h.b.frozen = false; A.h.b.wake && A.h.b.wake(); A.h.b.vel.set(0, -1, 0); }
        if (A.cae && A.tg > 90 && CO.caja(A.h).min.y < A.pe.pos.y + 0.95) { A.tg = t; window.__dbg = { heladera: +t.toFixed(2) }; CO.tumbar(A.pe, v3(0.6, -2, -1.4)); CO.polvo(vadd(A.pe.pos, v3(0, -0.9, 0)), 26); }
        HZ.tripode(CO.P(${PX} - 2.2, ${PZ} - 4.4, 0.9), CO.P(${PX}, ${PZ}, 1.7), 0, 62);
        HZ.contador('1.046'); HZ.aprobado(t, 24.6, 26.4); HZ.marca();
      }
      TX.enviar();`,
  },
  // ---- 3. «Pepe no recuerda» (la explosión) y «Pepe siempre vuelve»: el zoom hasta su cara ----
  tut3: {
    t0: 26.5, t1: 38.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const pe = CO.pepe(${PX}, ${PZ}, Math.PI - 0.2), bn = CO.barril(), b = bn ? crearObjeto(bn, CO.P(${PX} + 1.0, ${PZ} - 0.3, 0.6), Quat.axis(0, 1, 0, 0), {}) : null;
      window.__dbg = { barril: bn }; window.__A = { pe, b, boom: 99, fase: 1 }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true;
      if (A.fase === 1 && t < 31.5) {
        HZ.dano(0.3);
        if (__tr.i >= 0 && t >= 28.8 && A.boom > 90) { A.boom = t; const p = A.b ? A.b.b.pos.clone() : CO.P(${PX} + 1.0, ${PZ} - 0.3, 0.5); if (A.b) borrarObjeto(A.b, true); explosion(p, 4, 80); CO.tumbar(A.pe, v3(-6, 7, 3)); }
        const s = t > A.boom && t < A.boom + 0.6 ? (1 - (t - A.boom) / 0.6) * 0.12 : 0;
        HZ.tripode(CO.P(${PX} + 3.0 + Math.sin(t * 61) * s, ${PZ} - 6.5, 1.6 + Math.cos(t * 53) * s), CO.P(${PX} + 0.3, ${PZ}, 1.0), 0, 60);
        HZ.contador('1.047'); HZ.aprobado(t, 29.8, 31.4); HZ.marca();
      } else {
        if (A.fase === 1) { A.fase = 2; npcTodos(); for (const o of OBJS.slice()) borrarObjeto(o, true); A.pe = CO.pepe(${PX}, ${PZ}, Math.PI + 0.55); }
        // (Pepe vuelve, parado, sin saludar; el zoom lento hasta su cara; a los 36 s mira a cámara de golpe)
        const c = CO.P(${PX} + 0.4, ${PZ} - 7.5, 1.55), fov = 60 - 53 * HZ.k(t, 33.6, 37.4);
        if (t >= 36.0) A.pe.yaw = CO.yaw(A.pe.pos, c);
        HZ.tripode(c, CO.P(${PX}, ${PZ}, 0.95 + 0.74 * HZ.k(t, 33.6, 37.0)), 0, fov);
        HZ.dano(t < 36.4 ? 0.3 : 0.3 + 0.7 * HZ.k(t, 36.4, 38.0));
        HZ.contador('1.047', t < 36.4 ? 1 : Math.floor(t * 9) % 2); HZ.marca(t < 36.4 ? 1 : 0.4);
      }
      TX.enviar();`,
  },
  // ---- 4. el corte: PEPE RECUERDA TODO, la lista y el comienzo de la alerta ----
  glitch: {
    t0: 38.0, t1: 46.0, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true;
      HZ.dano(t < 41.4 ? 1 : 0.5);
      if (t < 41.4) TX.r(0, 0, 1, 1, [0, 0, 0]);
      if (t >= 38.8 && t < 39.2) TX.t('PEPE RECUERDA TODO', 'JXV56', 0.5, 0.5, [220, 20, 20], 255, 1, 1);
      if (t >= 39.6 && t < 39.8) ['1.045  SEDAN', '1.046  HELADERA', '1.047  BARRIL', '0.612  PARED', '0.388  13 PISOS', '0.101  ADMIN'].forEach((s, i) => TX.t(s, 'JXV20', 0.5, 0.25 + i * 0.09, [235, 235, 235], 255, 1, 1));
      if (t >= 41.4) HZ.alerta(t, t < 44.0 ? [] : ['ATENCIÓN'], false);
      TX.enviar();`,
  },
  // ---- 5. la alerta: «este es el sistema de avisos…» y «se detectó una entidad» ----
  eas1: {
    t0: 46.0, t1: 54.4, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true; HZ.dano(0.5);
      HZ.alerta(t, t < 50.3 ? ['ATENCIÓN', 'ESTE ES EL SISTEMA DE AVISOS', 'DE EMERGENCIA DEL SERVIDOR'] : ['SE DETECTÓ UNA ENTIDAD', 'EN EL MAPA', 'gm_construct'], false);
      TX.enviar();`,
  },
  // ---- 6a. «no lo mire a los ojos»: su cara, de noche, con la luz blanca de la cámara; «no lo spawnee» ----
  eas2a: {
    t0: 54.4, t1: 59.5, mapa: 'RB_Construct', espera: 6000, antes: 90,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.dano(0.5);
      const pe = CO.pepe(2.4, 20.5, Math.PI), o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); window.__A = { pe, o }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.nv(false); HZ.dano(0.5); CO.fijo(A.pe, 2.4, 20.5);
      if (t < 57.5) {
        // (el acercamiento lento a la cara —la cadera del NPC + 0,66 m—, de frente)
        const k = HZ.k(t, 54.4, 57.5), f = A.pe.pos, c = v3(f.x + 0.12 - k * 0.1, f.y + 0.68, f.z - 3.2 + k * 2.6);
        A.pe.yaw = CO.yaw(f, c); HZ.lampara(2); HZ.tripode(c, v3(f.x, f.y + 0.66, f.z), 0, 50); if (!A.luz) { A.luz = 1; luzTemporal(v3(f.x + 0.1, f.y + 0.9, f.z - 0.9), 2.4, [4.4, 4.4, 4.4], 3.2); }
        HZ.alerta(t, ['NO LO MIRE A LOS OJOS'], false, true);
      } else { HZ.lampara(0); HZ.tarjeta(); HZ.alerta(t, ['NO LO SPAWNEE'], false); }
      TX.enviar();`,
  },
  // ---- 6b. «no le dé la palanca»; «no se suba a ningún auto»: el auto quemándose contra la pared ----
  eas2b: {
    t0: 59.5, t1: 63.8, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.dano(0.5); const o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); window.__A = { o }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; TX.sinOSD = true; HZ.nv(false); HZ.dano(0.5);
      if (t < 61.4) { HZ.lampara(0); HZ.tarjeta(); HZ.alerta(t, ['NO LE DÉ LA PALANCA'], false); }
      else { HZ.lampara(2); const k = HZ.k(t, 61.4, 63.8); HZ.tripode(CO.P(1.5 - k * 0.6, 16.5 + k * 0.6, 1.5), CO.P(-2.0, 23.2, 0.7), 0, 60); HZ.alerta(t, ['NO SE SUBA A NINGÚN AUTO'], false, true); }
      TX.enviar();`,
  },
  // ---- 7. «Pepe no está enojado. Pepe está contando. Mil cuarenta y siete.» ----
  eas3: {
    t0: 63.8, t1: 72.0, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true; HZ.dano(t < 70.9 ? 0.5 : 1);
      if (t < 66.4) HZ.alerta(t, ['PEPE NO ESTÁ ENOJADO'], false);
      else if (t < 68.9) HZ.alerta(t, ['PEPE ESTÁ CONTANDO'], false);
      else { TX.r(0, 0, 1, 1, [0, 0, 0]); TX.t('1.047', 'JXP', 0.5, 0.5, [200, 15, 15], 255, 1, 1); }
      TX.enviar();`,
  },
  // ---- 8. la grabación (cada toma corta empieza donde terminó la anterior; los cortes van tapados con glitches de cinta) ----
  // 8a. 03:12, el patio vacío con la visión nocturna; paneo lento por los edificios
  ea1: {
    t0: 72.0, t1: 78.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.35); window.__A = { o: NOCHE(4.2, 7.0, 0.35, 0.1) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.35); ENT.y = 0;
      JUG.yaw = 0.35 - 0.9 * HZ.k(t, 72.6, 76.2) + 0.55 * HZ.k(t, 76.4, 78.4); JUG.pitch = 0.1 - 0.06 * HZ.k(t, 72.0, 76.0); PINTADO(); TX.enviar();`,
  },
  // 8b. camina despacio hacia la pared del edificio
  ea2: {
    t0: 78.0, t1: 83.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.35); window.__A = { o: NOCHE(3.6, 9.5, -0.3, 0.04) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.35);
      const d = vsub(v3(1.0, 0, 16.6), JUG.pos); ENT.y = __tr.i >= 0 && Math.hypot(d.x, d.z) > 0.5 ? 0.3 : 0; JUG.yaw = CO.gira(JUG.yaw, Math.atan2(d.x, d.z) + Math.sin(t * 0.9) * 0.22, 0.05); JUG.pitch = 0.04;
      if (t > 83.35) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3)] }; PINTADO(); TX.enviar();`,
  },
  // 8c. el auto del video; levanta la cámara: «1.047» y «PEPE SIEMPRE VUELVE» pintados en la pared
  eb1: {
    t0: 83.4, t1: 90.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.4); window.__A = { o: NOCHE(1.0, 16.6, -0.42, 0.04) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.4);
      if (t < 87.0) { const d = vsub(v3(-0.6, 0, 19.9), JUG.pos); ENT.y = __tr.i >= 0 && Math.hypot(d.x, d.z) > 0.45 ? 0.3 : 0; JUG.yaw = CO.gira(JUG.yaw, Math.atan2(d.x, d.z), 0.06); JUG.pitch = 0.04; }
      else { ENT.y = 0; if (!A.m) A.m = { y0: JUG.yaw, p0: JUG.pitch, m: CO.mira(CO.Pw(1.6, 26.0, 3.9)) }; const k = HZ.k(t, 87.0, 88.8); JUG.yaw = CO.gira(A.m.y0, A.m.m[0], k) + Math.sin(t * 1.1) * 0.015; JUG.pitch = A.m.p0 + (A.m.m[1] - A.m.p0) * k + Math.sin(t * 1.3) * 0.012; }
      if (t > 90.35) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3), +JUG.pitch.toFixed(3)] }; PINTADO(); TX.enviar();`,
  },
  // 8d. se da vuelta: Pepe parado en el medio del campo, lejos; el zoom
  eb2: {
    t0: 90.4, t1: 97.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.42); LEJOS(); window.__A = { o: NOCHE(-0.6, 19.9, 0, 0), pe: CO.pepe(2.0, 8.5, 0) }; const m = CO.mira(CO.Pw(1.6, 26.0, 3.9)); JUG.yaw = m[0]; JUG.pitch = m[1]; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.42 + 0.08 * HZ.k(t, 94, 97.4)); ENT.y = 0;
      CO.fijo(A.pe, 2.0, 8.5); A.pe.yaw = CO.yaw(A.pe.pos, JUG.pos); if (!A.luz) { A.luz = 1; luzTemporal(v3(2.0, A.pe.pos.y + 2.4, 8.5), 4.2, [4.2, 4.2, 4.2], 30); }
      if (!A.m) { const m = CO.mira(CO.Pw(1.6, 26.0, 3.9)); A.m = { y0: m[0], p0: m[1], meta: CO.yaw(JUG.pos, A.pe.pos) + 0.05 }; }
      const k = HZ.k(t, 91.0, 93.6), pm = CO.mira(v3(2.0, A.pe.pos.y + 0.5, 8.5))[1]; JUG.yaw = CO.gira(A.m.y0, A.m.meta, k) + Math.sin(t * 0.8) * 0.01 * (1 - k * 0.6); JUG.pitch = A.m.p0 + (pm - A.m.p0) * k;
      ENT.disparo = t >= 94.0 && t < 96.9; PINTADO(); TX.enviar();`,
  },
  // 8e. el zoom sale: ya no está. Se da vuelta hacia el auto: Pepe pegado al lente; después, al lado del auto
  ec1: {
    t0: 97.4, t1: 104.4, mapa: 'RB_Construct', espera: 6000, antes: 90,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.5); LEJOS(); window.__A = { o: NOCHE(-0.6, 19.9, 0, 0.06), pe: null }; JUG.yaw = CO.yaw(JUG.pos, CO.P(2.0, 8.5, 0)) + 0.05; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.5 + 0.2 * HZ.k(t, 100.6, 104.4));
      // (en la previa el zoom entra, así arranca adentro como terminó la toma anterior)
      ENT.disparo = __tr.i < 0; ENT.disparo2 = __tr.i >= 0 && t >= 98.1 && t < 100.0;
      const auto = CO.P(0.5, 22.9, 0);
      if (t >= 100.6) { if (!A.y0) A.y0 = JUG.yaw; const meta = CO.yaw(JUG.pos, auto) - 0.12; JUG.yaw = t < 100.85 ? CO.gira(A.y0, meta, HZ.k(t, 100.6, 100.85)) : CO.gira(JUG.yaw, meta, 0.1); }
      if (t >= 100.6 && !A.pe) A.pe = CO.pepe(0.5, 22.9, 0);
      if (A.pe) { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); if (t >= 101.05 && t < 101.6) { CO.fijo(A.pe, JUG.pos.x + f.x * 0.62, JUG.pos.z + f.z * 0.62); if (!A.luz) { A.luz = 1; luzTemporal(vadd(JUG.pos, v3(f.x * 0.25, 0.75, f.z * 0.25)), 2.6, [7, 7, 7], 0.55); } } else CO.fijo(A.pe, 0.5, 22.9); A.pe.yaw = CO.yaw(A.pe.pos, JUG.pos); }
      JUG.pitch = t < 100.6 ? 0.06 : 0.02; ENT.y = t >= 101.6 && t < 103.4 ? -0.3 : 0;
      if (t > 104.35) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3)] }; PINTADO(); TX.enviar();`,
  },
  // 8f. «no, no, no»: otro Pepe a la izquierda, otro a la derecha; se da vuelta y corre
  ec2: {
    t0: 104.4, t1: 111.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.7); LEJOS(); window.__A = { o: NOCHE(-0.35, 17.6, 0, 0.02), ps: [CO.pepe(0.5, 22.9, 0)] }; JUG.yaw = CO.yaw(JUG.pos, CO.P(0.5, 22.9, 0)) - 0.12; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.7 + 0.1 * HZ.k(t, 104.4, 111.4));
      const L = [[0.5, 22.9], [4.4, 19.4], [-4.3, 18.4]];
      if (t >= 105.0 && A.ps.length === 1) A.ps.push(CO.pepe(4.4, 19.4, 0));
      if (t >= 107.2 && A.ps.length === 2) A.ps.push(CO.pepe(-4.3, 18.4, 0));
      A.ps.forEach((P, i) => { CO.fijo(P, L[i][0], L[i][1]); P.yaw = CO.yaw(P.pos, JUG.pos); });
      let meta = CO.yaw(JUG.pos, CO.P(0.5, 22.9, 0)) - 0.12, kk = 0.1;
      if (t >= 105.8) { meta = CO.yaw(JUG.pos, CO.P(4.4, 19.4, 0)); kk = t < 106.4 ? 0.3 : 0.12; }
      if (t >= 107.6) { meta = CO.yaw(JUG.pos, CO.P(-4.3, 18.4, 0)) + 0.08; kk = t < 108.2 ? 0.3 : 0.12; }
      if (t >= 109.2) { meta = Math.PI - 0.1; kk = 0.22; }
      JUG.yaw = CO.gira(JUG.yaw, meta, kk); JUG.pitch = 0.03; ENT.y = t >= 110.0 ? 0.55 : 0;
      if (t > 111.35) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3)] }; PINTADO(); TX.enviar();`,
  },
  // 8g. corre por el campo entre Pepes; mira atrás: uno lo sigue
  ed1: {
    t0: 111.4, t1: 118.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.8); LEJOS(); window.__A = { o: NOCHE(0.2, 13.0, Math.PI - 0.1, 0.08), ps: [CO.pepe(-3.0, 9.0, 0), CO.pepe(4.0, 6.5, 0), CO.pepe(-2.6, 3.0, 0)], atras: null }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.8 + 0.08 * HZ.k(t, 111.4, 118.4));
      const L = [[-3.0, 9.0], [4.0, 6.5], [-2.6, 3.0]]; A.ps.forEach((P, i) => { if (L[i]) CO.fijo(P, L[i][0], L[i][1]); P.yaw = CO.yaw(P.pos, JUG.pos); });
      const ir = Math.PI - 0.1;
      if (t < 114.6) { ENT.y = __tr.i >= 0 ? 0.55 : 0; JUG.yaw = CO.gira(JUG.yaw, ir, 0.08); JUG.pitch = 0.08; }
      else if (t < 115.6) { if (!A.atras) { A.atras = CO.pepe(JUG.pos.x + 0.3, JUG.pos.z + 2.6, 0); A.ps.push(A.atras); A.ap = [JUG.pos.x + 0.3, JUG.pos.z + 2.6]; } CO.fijo(A.atras, A.ap[0], A.ap[1]); ENT.y = 0.3; JUG.yaw = CO.gira(JUG.yaw, ir + Math.PI - 0.15, 0.3); JUG.pitch = 0.05; }
      else { if (A.atras) CO.fijo(A.atras, A.ap[0], A.ap[1]); ENT.y = 0.55; JUG.yaw = CO.gira(JUG.yaw, ir + 0.08, 0.3); JUG.pitch = 0.08; }
      if (t > 118.35) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3)] }; TX.enviar();`,
  },
  // 8h. Pepe adelante, a un metro; el golpe; la cámara al piso, de costado (el aviso de muerte de GMod)
  ed2: {
    t0: 118.4, t1: 124.4, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.88); LEJOS(); window.__A = { o: NOCHE(0.1, -4.0, Math.PI - 0.05, 0.08), frente: null, golpe: 1e9 }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      if (t < 119.5) { ENT.y = __tr.i >= 0 ? 0.55 : 0; JUG.yaw = CO.gira(JUG.yaw, Math.PI - 0.05, 0.1); JUG.pitch = 0.08; }
      else {
        ENT.y = 0;
        if (!A.frente) { A.yw = JUG.yaw; const f = v3(Math.sin(A.yw), 0, Math.cos(A.yw)); A.fp = [JUG.pos.x + f.x * 1.15, JUG.pos.z + f.z * 1.15]; A.frente = CO.pepe(A.fp[0], A.fp[1], 0); A.e0 = vadd(JUG.pos, v3(0, 0.66, 0)); window.__dbg = { en: [+JUG.pos.x.toFixed(3), +JUG.pos.y.toFixed(3), +JUG.pos.z.toFixed(3), +A.yw.toFixed(4)], pepe: A.fp }; }
        CO.fijo(A.frente, A.fp[0], A.fp[1]); A.frente.yaw = CO.yaw(A.frente.pos, A.e0); if (!A.luz) { A.luz = 1; const f = v3(Math.sin(A.yw), 0, Math.cos(A.yw)); luzTemporal(vadd(A.e0, v3(f.x * 0.3, 0.1, f.z * 0.3)), 2.4, [5.5, 5.5, 5.5], 1.05); }
        if (t < 120.5) JUG.pitch = 0.08 - 0.14 * HZ.k(t, 119.6, 120.3);
        if (t >= 120.5 && A.golpe > 1e8) A.golpe = t;
        if (t >= A.golpe) {
          // (la cámara se cae: del ojo al pasto, girando; rebota y queda de costado)
          const u = Math.min(1, (t - A.golpe) / 0.55), b = u < 1 ? 0 : Math.max(0, Math.sin((t - A.golpe - 0.55) * 18) * Math.exp(-(t - A.golpe - 0.55) * 7)) * 0.07;
          const f = v3(Math.sin(A.yw), 0, Math.cos(A.yw)), suelo = CO.g(A.e0.x - f.x * 0.5, A.e0.z - f.z * 0.5);
          const p = v3(A.e0.x - f.x * 0.5 * u, A.e0.y + (suelo + 0.13 - A.e0.y) * u * u + b, A.e0.z - f.z * 0.5 * u);
          const m = vadd(p, v3(Math.sin(A.yw + 0.35 - u * 0.5), -0.25 + u * 0.28, Math.cos(A.yw + 0.35 - u * 0.5)));
          HZ.cam(p, m, u * Math.PI / 2 * 1.05 - b * 3, 0);
        }
      }
      if (t >= 120.5 && t < 120.57) TX.r(0, 0, 1, 1, [255, 255, 255]);
      HZ.dano(t >= 120.5 && t < 121.2 ? 1 : 0.88);
      TX.enviar();`,
    titulos: `const t = __tr.t; if (t >= 120.65) { const e = CO.kf || (CO.kf = (() => { const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = '<b>Pepe</b><svg width="46" height="18" viewBox="0 0 46 18"><path d="M3 14 L36 5 L40 2 L44 4 L41 6 L38 8 L6 16 Z" fill="#ff6a1a"/></svg><i>Vos</i>'; $('trOver').appendChild(d); return d; })()); e.style.opacity = Math.min(1, (t - 120.65) / 0.15).toFixed(2); }`,
  },
  // 8i. en el pasto, de costado: Pepe mira la cámara y se va; la batería se muere
  ee: {
    t0: 124.4, t1: 132.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN + `DIA.hora = 1.5;` + VF + `HZ.dano(0.88); const E = ${process.env.ED2 || 'null'} || { en: [0.1, -2.7, -7.5, Math.PI - 0.05] }; LEJOS(); window.__A = { o: NOCHE(E.en[0], E.en[2], E.en[3], 0), E };
      const f = v3(Math.sin(E.en[3]), 0, Math.cos(E.en[3])); window.__A.fp = [E.en[0] + f.x * 1.15, E.en[2] + f.z * 1.15]; window.__A.pe = CO.pepe(window.__A.fp[0], window.__A.fp[1], 0); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, E = A.E; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      const yw = E.en[3], f = v3(Math.sin(yw), 0, Math.cos(yw)), e0 = v3(E.en[0], E.en[1] + 0.66, E.en[2]), suelo = CO.g(e0.x - f.x * 0.5, e0.z - f.z * 0.5);
      const p = v3(e0.x - f.x * 0.5, suelo + 0.13, e0.z - f.z * 0.5), m = vadd(p, v3(Math.sin(yw - 0.15), 0.03, Math.cos(yw - 0.15)));
      HZ.cam(p, m, Math.PI / 2 * 1.05, 0); CO.yo(E.en[0], E.en[2], yw, 0);
      const P = A.pe; if (!A.luz) { A.luz = 1; luzTemporal(v3((p.x + A.fp[0]) / 2, P.pos.y - 0.3, (p.z + A.fp[1]) / 2), 3.0, [4.6, 4.6, 4.6], 30); }
      if (t < 126.4) { CO.fijo(P, A.fp[0], A.fp[1]); P.yaw = CO.yaw(P.pos, p); }
      else { const ir = yw + 0.5, v = t < 126.9 ? 0 : 1.15; A.fp[0] += Math.sin(ir) * v / 30; A.fp[1] += Math.cos(ir) * v / 30; CO.fijo(P, A.fp[0], A.fp[1]); P.yaw = ir; }
      if (__tr.i === 0) vfCmd('FFCam.SetBattery(0.035)');
      HZ.dano(t < 129.5 ? 0.88 : 0.88 + 0.12 * HZ.k(t, 129.5, 130.6));
      if (t >= 130.7) TX.r(0, 0, 1, 1, [0, 0, 0]);
      TX.enviar();`,
    titulos: `const t = __tr.t; if (t < 126.4) { const e = CO.kf || (CO.kf = (() => { const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = '<b>Pepe</b><svg width="46" height="18" viewBox="0 0 46 18"><path d="M3 14 L36 5 L40 2 L44 4 L41 6 L38 8 L6 16 Z" fill="#ff6a1a"/></svg><i>Vos</i>'; $('trOver').appendChild(d); return d; })()); e.style.opacity = Math.max(0, Math.min(1, (126.4 - t) / 0.4)).toFixed(2); } else if (CO.kf) { CO.kf.remove(); CO.kf = null; }`,
  },
  // ---- 13. el instructivo otra vez: «Lección 5: tu nuevo muñeco de pruebas» ----
  fin1: {
    t0: 132.0, t1: 141.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const yo = CO.pj('Hero', ${PX} - 0.55, ${PZ}, Math.PI), pe = CO.pepe(${PX} + 0.65, ${PZ} + 0.1, Math.PI - 0.1, { modo: 'bailar', emote: 'Hi' });
      window.__A = { yo, pe }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      if (t < 134.6) { HZ.tarjeta(); HZ.portada(t, 132.0, 5, 'LECCIÓN 5: TU NUEVO MUÑECO DE PRUEBAS'); }
      else { const k = HZ.k(t, 134.6, 141); HZ.tripode(CO.P(${PX} + 0.3 - k * 0.2, ${PZ} - 5.2 + k * 0.6, 1.5), CO.P(${PX}, ${PZ}, 1.0), 0, 58); HZ.zocalo(t, 135.0, 140.8, 'TU NUEVO MUÑECO', 'PEPE AHORA AYUDA CON LAS PRUEBAS'); HZ.contador('1.048'); HZ.marca(); }
      TX.enviar();`,
  },
  // ---- 14. la heladera le cae a Pepe (otra vez); Pepe vuelve; FIN DE LA CINTA ----
  fin2: {
    t0: 141.0, t1: 150.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const yo = CO.pj('Hero', ${PX} - 0.55, ${PZ}, Math.PI), pe = CO.pepe(${PX} + 0.65, ${PZ} + 0.1, Math.PI - 0.1, { modo: 'bailar', emote: 'Hi' });
      const h = crearObjeto('Heladera', CO.P(${PX} + 0.7, ${PZ} + 0.1, 9), Quat.axis(0, 1, 0, Math.PI + 0.2), {}); h.b.frozen = true;
      window.__A = { yo, pe, h, cae: 0, tg: 1e9, vuelve: null }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true;
      if (__tr.i >= 0 && t >= 141.2 && !A.cae) { A.cae = 1; A.h.b.frozen = false; A.h.b.wake && A.h.b.wake(); A.h.b.vel.set(0, -1, 0); }
      if (A.cae && A.tg > 1e8 && CO.caja(A.h).min.y < CO.g(${PX} + 0.65, ${PZ} + 0.1) + 1.85) { A.tg = t; window.__dbg = { heladera: +t.toFixed(2) }; CO.tumbar(A.pe, v3(0.4, -2, -1.2)); }
      // (el polvo del golpe se disipa en menos de un segundo: que se vea a Pepe aplastado y al que vuelve)
      if (A.tg < 1e8 && t > A.tg + 0.35 && !A.sinPolvo) { A.sinPolvo = 1; for (const q of PART.l) if (q.tipo === 'humo') q.vida = Math.min(q.vida, q.t + 0.6); }
      if (t >= 146.3 && !A.vuelve) { A.vuelve = CO.pepe(${PX} + 1.5, ${PZ} + 2.6, 0); }
      if (A.vuelve) A.vuelve.yaw = CO.yaw(A.vuelve.pos, CO.P(${PX} + 0.1, ${PZ} - 4.6, 0));
      if (t < 147.5) {
        const s = t > A.tg && t < A.tg + 0.5 ? (1 - (t - A.tg) / 0.5) * 0.06 : 0;
        HZ.tripode(CO.P(${PX} + 0.1 + Math.sin(t * 70) * s, ${PZ} - 4.6, 1.42 + Math.cos(t * 60) * s), CO.P(${PX}, ${PZ}, 1.0), 0, 58);
        HZ.contador(t < 145.4 ? '1.048' : '1.049', t < 145.4 ? 1 : Math.floor(t * 8) % 2 ? 1 : 0.5); HZ.marca(); HZ.dano(t < 145.4 ? 0.3 : 0.45);
      } else {
        HZ.tarjeta(); HZ.dano(0.6); TX.r(0, 0, 1, 1, [0, 0, 0]);
        if (t >= 147.8 && t < 149.4) TX.t('FIN DE LA CINTA', 'JXV24', 0.5, 0.5, [230, 230, 230], 255, 1, 1);
        if (t >= 149.75 && t < 149.85) TX.t('TE TOCA', 'JXV56', 0.5, 0.5, [220, 20, 20], 255, 1, 1);
      }
      TX.enviar();`,
  },
};
// (las escenas de día, en partes de 5 a 6 s: cada render entra en 10 minutos; la segunda parte del auto y la de la
// explosión arrancan ya en su fase, con Pepe puesto desde el principio para que no aparezca materializándose)
ESCENAS.tut1a = { ...ESCENAS.tut1, t0: 6.0, t1: 11.6 };
ESCENAS.tut1b = { ...ESCENAS.tut1, t0: 11.6, t1: 16.5 };
ESCENAS.tut2a = { ...ESCENAS.tut2, t0: 16.5, t1: 21.5 };
ESCENAS.tut2b = { ...ESCENAS.tut2, t0: 21.5, t1: 26.5,
  preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
    const pe = CO.pepe(${PX}, ${PZ}, Math.PI + 0.1), h = crearObjeto('Heladera', CO.P(${PX} + 0.05, ${PZ}, 9), Quat.axis(0, 1, 0, Math.PI + 0.2), {}); h.b.frozen = true;
    window.__A = { pe, h, cae: 0, tg: 99, fase: 2 }; return 1;` };
ESCENAS.tut3a = { ...ESCENAS.tut3, t0: 26.5, t1: 31.5 };
ESCENAS.tut3b = { ...ESCENAS.tut3, t0: 31.5, t1: 38.0,
  preparar: COMUN + `DIA.hora = 11;` + VF + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
    window.__A = { pe: CO.pepe(${PX}, ${PZ}, Math.PI + 0.55), fase: 2, humo: 0 }; return 1;`,
  // (el humo y la marca de la explosión de la parte anterior: la misma explosión, sólo el efecto, al principio de la previa)
  cada: `if (__tr.i < 0 && !window.__A.humo) { window.__A.humo = 1; efectoExplosion(CO.P(${PX} + 1.0, ${PZ} - 0.3, 0.5), 1); }
    ` + ESCENAS.tut3.cada };
