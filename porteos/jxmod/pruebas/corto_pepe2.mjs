// corto 8 (4:3, 150 s a 30 cuadros): «La venganza de Pepe 2» — CINTA 3. Sigue a la parte 1 (corto_pepe.mjs, de donde
// trae el Viewfinder y los ayudantes): Lucas, el que filmaba, desapareció; nico lo va a buscar de noche adentro del
// edificio de gm_construct (una galería techada de 40 m —x de -19 a 21, z ≈ 28,5— y un salón hasta z 35,7; el piso de
// adentro a -3,66: pisoBajo da el techo). Instructivo «Lección 6: si un amigo no vuelve», el corte, la grabación de nico
// (Pepe a contraluz al fondo del pasillo, Lucas mirando la pared que gira la cabeza como un búho, la huida, Pepe alto que
// le corta el paso, la cámara que alguien levanta del piso, los tres cada vez más cerca cuando la luz parpadea) y
// «Lección 7: todos vuelven», donde a Pepe lo atropellan (como siempre).
// Las deformaciones son de verdad, en el modelo: cuello y cabeza estirados, brazos largos, la cabeza girada sobre el
// cuello, temblor (CO.pose, en poseExtra); y los que se acercan lo hacen a saltos, cuadro por cuadro (CO.saltos).
// uso: ESC=pruebas/corto_pepe2.mjs VW=720 VH=540 DPR=1 RES=100 node pruebas/trailer.mjs URL_HTML CARPETA escena[,escena]
// (el .gma del Viewfinder va en /ah/3780178294.gma del mismo servidor; ED9='{"en":[x, y, z, yaw]}' con lo que f9 imprime)
import { BASE } from './corto_pepe.mjs';
export const FPS = 30;
export const CSS = `
  #trOver .kf{position:absolute;right:3.2%;top:4.5%;display:flex;align-items:center;gap:9px;padding:5px 11px;border-radius:5px;background:rgba(0,0,0,.62);font:700 17px Tahoma,Verdana,'DejaVu Sans',sans-serif;text-shadow:0 1px 1px #000}
  #trOver .kf b{color:#ff5a4a;font-weight:700} #trOver .kf i{color:#fff2a0;font-style:normal}
`;
const { VF, COMUN, RELOJ } = BASE;
// (la fecha de esta cinta: 21/11/1998 02:58)
const VF2 = VF + `vfCmd('RunConsoleCommand("ffcam_vhs_date_day","21") RunConsoleCommand("ffcam_vhs_date_hour","2") RunConsoleCommand("ffcam_vhs_date_minute","58")');`;
const COMUN2 = COMUN + `
  CO.yoI = (x, z, yaw, pitch) => { JUG.pos.set(x, -3.66 + 0.97, z); if (yaw !== undefined) JUG.yaw = yaw; if (pitch !== undefined) JUG.pitch = pitch; JUG.vel.set(0, 0, 0); };
  CO.PI = (x, z, h) => v3(x, -3.66 + (h || 0), z);
  // (adentro el NPC se fija también en altura —la cadera a 0,95 del piso—: si no, alguno se cae por el piso)
  CO.fijoI = (P, x, z) => { if (!P || P.rag) return; P.pos.set(x, -3.66 + 0.95, z); P.vel.set(0, 0, 0); P.suelo = true; };
  CO.pI = (sk, x, z, yaw, act) => { const P = npcCrear(sk, CO.PI(x, z, 0), yaw, Object.assign({ modo: 'quieto', emote: '', vel: 1.6 }, act || {})); if (P && P.ia) P.ia.ragT = 1e9; return P; };
  // la pose deformada (después de la animación de cada cuadro): k estira el cuello y la cabeza y la tuerce de costado
  // (lado: cuánto y hacia dónde), giro gira la cabeza sobre el cuello (π: el búho), brazos los alarga, tiembla
  CO.pose = (P, o) => {
    if (!P) return; P.o2 = Object.assign(P.o2 || {}, o); if (P.poseExtra) return;
    P.poseExtra = (Q) => {
      const md = Q.md, H = Q.D.h, o = Q.o2 || {}, k = o.k || 0;
      if (!Q.s0) { Q.s0 = {}; for (const n of ['Neck', 'Head', 'LeftArm', 'RightArm']) if (H[n] !== undefined) Q.s0[n] = md.s[H[n]].slice(); }
      const pon = (n, sx, sy, sz) => { const i = H[n]; if (i === undefined) return; const b = Q.s0[n]; md.s[i][0] = b[0] * sx; md.s[i][1] = b[1] * sy; md.s[i][2] = b[2] * sz; };
      const gira = (n, ax, ay, az, ang) => { const i = H[n]; if (i === undefined || !ang) return; const r = md.r[i], q = new Quat(r[0], r[1], r[2], r[3]).mul(Quat.axis(ax, ay, az, ang)).norm(); r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w; };
      const nx = 1 - 0.3 * k, ny = 1 + 1.45 * k;
      pon('Neck', nx, ny, nx); pon('Head', (1 - 0.16 * k) / nx, (1 + 0.85 * k) / ny, (1 + 0.05 * k) / nx);
      const b = o.brazos || 1; pon('LeftArm', 1, b, 1); pon('RightArm', 1, b, 1);
      const tt = TIEMPO.t, j = (o.tiembla ?? k * k) * (Math.sin(tt * 37) * 0.05 + Math.sin(tt * 23 + 1) * 0.04);
      gira('Neck', 1, 0, 0, -0.25 * k); gira('Neck', 0, 0, 1, -0.1 * k);
      gira('Head', 0, 1, 0, (o.giro || 0) + j * 0.5);
      gira('Head', 1, 0, 0, 0.72 * k * (o.lado ?? 1) + j); gira('Head', 0, 0, 1, -0.14 * k + j * 0.6);
      if (o.brazosAbajo) { gira('LeftArm', 1, 0, 0, o.brazosAbajo); gira('RightArm', 1, 0, 0, o.brazosAbajo); }
      md.sucio = true;
    };
  };
  // (dónde está de verdad la cabeza —el hueso Head ya estirado y escalado—: la matriz del modelo del último cuadro)
  // (la cara de Pepe alto —escala 1,3 y cuello estirado del todo—: medida, 1,38 m sobre la cadera; los ojos quedan abajo
  // del cráneo estirado. Sirve aunque no se haya dibujado —detrás de la cámara no se actualiza su modelo—)
  CO.caraAlta = (P) => v3(P.pos.x - 0.06, P.pos.y + 1.38, P.pos.z + 0.03);
  CO.cabeza = (P, arriba) => { const i = P.D.h.Head, W = i !== undefined && P.md.W && P.md.W[i]; return W ? v3(W[12], W[13] + (arriba ?? 0.1), W[14]) : v3(P.pos.x, P.pos.y + 0.95, P.pos.z); };
  // (una luz que sigue a alguien: se renueva cada cuadro —luzTemporal se apaga sola—)
  CO.sigue = (id, p, r, c) => { const M = window.__LS || (window.__LS = {}); let L = M[id]; if (!L || !LUCES_T.includes(L)) { L = { p: p.clone(), r, c, t: 1, dur: 1 }; LUCES_T.push(L); M[id] = L; } L.p.copy(p); L.t = 1; L.r = r; L.c = c; };
  // (el que se acerca a saltos: la posición avanza de golpe cada 'paso' segundos —cuadro por cuadro, como stop motion—)
  CO.saltos = (t, t0, t1, a, b, paso) => { const k = Math.max(0, Math.min(1, (Math.floor((t - t0) / paso) * paso) / (t1 - t0))); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  // la pintura nueva en la pared de afuera (la de la parte 1, más «1.049» tachado y la flecha «ADENTRO»)
  window.PINTADO2 = () => {
    TX.pared('1.047', 'JXP', CO.Pw(1.6, 26.0, 4.55), v3(0, 0, -1), 0.2, [120, 8, 8], 245);
    TX.pared('PEPE SIEMPRE VUELVE', 'JXV56', CO.Pw(1.6, 26.0, 3.45), v3(0, 0, -1), 0.26, [120, 8, 8], 240);
    TX.pared('1.049', 'JXP', CO.Pw(5.6, 26.0, 2.6), v3(0, 0, -1), 0.14, [90, 6, 6], 240); TX.pared('-----', 'JXP', CO.Pw(5.6, 26.0, 2.62), v3(0, 0, -1), 0.14, [90, 6, 6], 240);
    TX.pared('ADENTRO >', 'JXV56', CO.Pw(-1.4, 26.0, 1.0), v3(0, 0, -1), 0.24, [130, 8, 8], 245);
  };
`;
const RES = { dia: 11, noche: 1.5 };
// la puerta del edificio (x 1,5, z 26); la galería: z 28,5
const DX = 1.5, GZ = 28.5;
export const ESCENAS = {
  // ---- 0. CINTA 3: PLAY y la evidencia ----
  intro: {
    t0: 0, t1: 7.0, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true; HZ.dano(t < 0.4 ? 1 : t < 2.2 ? 0.85 : 0.4);
      if (t < 0.4) TX.r(0, 0, 1, 1, [0, 0, 0]);
      else if (t < 2.2) { TX.r(0, 0, 1, 1, [16, 34, 168]); TX.t('PLAY', 'JXV40', 0.08, 0.08, [255, 255, 255], 255, 0, 3); TX.t('>', 'JXV40', 0.26, 0.08, [255, 255, 255], Math.floor(t * 2) % 2 ? 255 : 0, 0, 3); TX.t('CINTA 3', 'JXV30', 0.92, 0.84, [255, 255, 255], 255, 2, 3); }
      else {
        TX.r(0, 0, 1, 1, [0, 0, 0]);
        const L = [[2.4, 'EVIDENCIA Nº 3', [235, 235, 235]], [3.1, 'JUGADOR DESAPARECIDO: xX_Lucas_Xx', [235, 235, 235]], [3.9, 'ÚLTIMA POSICIÓN: ADENTRO DEL EDIFICIO', [235, 235, 235]], [4.7, 'gm_construct · 21/11/1998', [235, 235, 235]], [5.6, 'NO REPRODUCIR DE NOCHE', [220, 30, 30]]];
        L.forEach(([a, s, c], i) => { if (t < a) return; const n = Math.min(s.length, Math.floor((t - a) / 0.026)); TX.t(s.slice(0, n) + (n < s.length || (i === L.length - 1 && Math.floor(t * 2.5) % 2) ? '_' : ''), 'JXV24', 0.08, 0.26 + i * 0.1, c, 255, 0, 3); });
      }
      TX.enviar();`,
  },
  // ---- 1. «Lección 6: si un amigo no vuelve»: Pepe es el instructor ----
  tA: {
    t0: 7.0, t1: 13.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      window.__A = { pe: CO.pepe(${DX} + 1.6, 22.6, Math.PI, { modo: 'bailar', emote: 'Hi' }) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      if (t < 9.2) { HZ.tarjeta(); HZ.portada(t, 7.0, 6, 'LECCIÓN 6: SI UN AMIGO NO VUELVE'); }
      else { const k = HZ.k(t, 9.2, 13.0); HZ.tripode(CO.P(${DX} + 4.5 - k * 1.2, 11.5 + k * 2.5, 1.7), CO.P(${DX} + 1.4, 22.8, 1.2), 0, 58); HZ.zocalo(t, 9.5, 12.9, 'PEPE', 'TU NUEVO INSTRUCTOR'); HZ.marca(); }
      TX.enviar();`,
  },
  // ---- 2. «Seguí las flechas hasta el edificio» ----
  tB: {
    t0: 13.0, t1: 19.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      window.__A = { pe: CO.pepe(${DX} + 1.6, 22.6, Math.PI, { modo: 'bailar', emote: 'Hi' }) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      const k = HZ.k(t, 13.0, 19.0); HZ.tripode(CO.P(${DX} - 0.3, 14.0 + k * 5.5, 1.3 - k * 0.15), CO.P(${DX}, 21.5 + k * 3, 0.0 + k * 0.6), 0, 60);
      for (const z of [15.5, 17.5, 19.5, 21.5, 23.5]) TX.pared('v', 'JXP', CO.P(${DX}, z, 0.02), v3(0, 1, 0), 0.3, [190, 16, 16], 230);
      HZ.marca(); TX.enviar();`,
  },
  // ---- 3. la puerta: Lucas parado adentro, de espaldas; Pepe saluda al lado. «Entrá. Tu amigo te está esperando» ----
  tC: {
    t0: 19.0, t1: 26.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const pe = CO.pepe(${DX} + 1.9, 23.6, Math.PI, { modo: 'bailar', emote: 'Hi' }), lu = CO.pI('Hero', ${DX}, 27.4, 0);
      window.__A = { pe, lu }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.32);
      CO.fijoI(A.lu, ${DX}, 27.4); A.lu.yaw = 0;
      const k = HZ.k(t, 19.0, 26.0); HZ.tripode(CO.P(${DX} + 0.9 - k * 0.6, 18.6 + k * 1.6, 1.5), CO.Pw(${DX} + 0.3, 26.5, 1.05), 0, 54);
      HZ.contador('1'); HZ.zocalo(t, 19.4, 25.8, 'LUCAS', 'NUEVO MUÑECO DE PRUEBAS'); for (const z of [21.5, 23.5]) TX.pared('v', 'JXP', CO.P(${DX}, z, 0.02), v3(0, 1, 0), 0.3, [190, 16, 16], 230);
      HZ.marca(); TX.enviar();`,
  },
  // ---- 4. «Y recordá: nadie se va de gm_construct»: la cabeza de Pepe se deforma; atrás, Lucas gira la cabeza ----
  tD: {
    t0: 26.0, t1: 33.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0);
      const pe = CO.pepe(${DX} + 0.6, 22.6, Math.PI, { modo: 'bailar', emote: 'Hi' }), lu = CO.pI('Hero', ${DX}, 27.4, 0);
      window.__A = { pe, lu }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true;
      CO.fijoI(A.lu, ${DX}, 27.4); A.lu.yaw = 0; CO.pose(A.lu, { k: 0.35 * HZ.k(t, 29.5, 32.0), giro: Math.PI * HZ.k(t, 29.8, 31.6), lado: 0.5 });
      CO.pose(A.pe, { k: 0.95 * HZ.k(t, 27.6, 32.3), brazos: 1 + 0.3 * HZ.k(t, 29, 32) });
      const f = A.pe.pos, c = v3(f.x + 0.25, f.y + 0.7, f.z - 3.1), fov = 52 - 26 * HZ.k(t, 26.6, 32.2);
      HZ.tripode(c, v3(f.x + 0.05, f.y + 0.62 + 0.25 * HZ.k(t, 28, 32), f.z), 0, fov);
      HZ.dano(t < 29 ? 0.3 : 0.3 + 0.7 * HZ.k(t, 29, 32.6)); HZ.contador('1', t < 30 ? 1 : Math.floor(t * 9) % 2); HZ.marca(t < 30 ? 1 : 0.4);
      TX.enviar();`,
  },
  // ---- 5. el corte: ÉL NO SE FUE / ESTÁ ADENTRO; «JUGADOR CONECTADO: nico» ----
  glitch: {
    t0: 33.0, t1: 38.0, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true; HZ.dano(t < 36 ? 1 : 0.45);
      TX.r(0, 0, 1, 1, [0, 0, 0]);
      if (t >= 33.8 && t < 34.3) TX.t('ÉL NO SE FUE', 'JXV56', 0.5, 0.5, [220, 20, 20], 255, 1, 1);
      if (t >= 34.7 && t < 35.2) TX.t('ESTÁ ADENTRO', 'JXV56', 0.5, 0.5, [220, 20, 20], 255, 1, 1);
      if (t >= 36.0) { const s = '> JUGADOR CONECTADO: nico', n = Math.min(s.length, Math.floor((t - 36.0) / 0.035)); TX.t(s.slice(0, n) + (Math.floor(t * 3) % 2 ? '_' : ''), 'JXV24', 0.08, 0.46, [200, 200, 200], 255, 0, 3); }
      TX.enviar();`,
  },
  // ---- 6. la grabación de nico: 02:58, el patio, camina hacia el edificio ----
  f1: {
    t0: 38.0, t1: 45.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.35); const o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); CO.yo(4.4, 11.0, -0.25, 0.05); window.__A = { o }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.35);
      const d = vsub(v3(${DX} + 0.6, 0, 20.5), JUG.pos); ENT.y = __tr.i >= 0 && Math.hypot(d.x, d.z) > 0.6 ? 0.3 : 0;
      JUG.yaw = CO.gira(JUG.yaw, Math.atan2(d.x, d.z) + Math.sin(t * 0.8) * 0.3, 0.05); JUG.pitch = 0.04; PINTADO2(); TX.enviar();`,
  },
  // ---- 7. la pared: la pintura nueva, «ADENTRO >»; baja a la puerta oscura ----
  f2: {
    t0: 45.0, t1: 52.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.38); const o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); CO.yo(${DX} + 0.9, 20.6, 0, 0.04); window.__A = { o }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.38); ENT.y = 0;
      if (!A.m) { A.m = [CO.mira(CO.Pw(1.6, 26.0, 4.0)), CO.mira(CO.Pw(5.6, 26.0, 2.6)), CO.mira(CO.Pw(-1.0, 26.0, 1.0)), CO.mira(CO.Pw(${DX}, 26.0, 1.2))]; A.y0 = JUG.yaw; A.p0 = JUG.pitch; }
      const TR = [[45.3, 47.0, 0], [48.0, 49.0, 1], [49.6, 50.4, 2], [50.8, 51.8, 3]]; let y = A.y0, p = A.p0;
      for (const [a, b, i] of TR) { const k = HZ.k(t, a, b); y = CO.gira(y, A.m[i][0], k); p = p + (A.m[i][1] - p) * k; }
      JUG.yaw = y + Math.sin(t * 1.1) * 0.012; JUG.pitch = p + Math.sin(t * 1.4) * 0.01; PINTADO2(); TX.enviar();`,
  },
  // ---- 8. entra: la galería oscura; «Bienvenido, nico» por los parlantes; «¿Lucas?» ----
  f3: {
    t0: 52.0, t1: 59.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.42); LEJOS(); CO.yo(${DX}, 23.8, 0, 0.06); window.__A = {}; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.42);
      if (t < 55.6) { const d = vsub(v3(${DX}, 0, 28.4), JUG.pos); ENT.y = __tr.i >= 0 && Math.hypot(d.x, d.z) > 0.4 ? 0.3 : 0; JUG.yaw = CO.gira(JUG.yaw, Math.atan2(d.x, d.z), 0.08); JUG.pitch = 0.05; }
      else { ENT.y = 0; if (A.y0 === undefined) A.y0 = JUG.yaw; const k1 = HZ.k(t, 55.6, 56.8), k2 = HZ.k(t, 57.2, 58.6); JUG.yaw = CO.gira(CO.gira(A.y0, -Math.PI / 2, k1), Math.PI / 2, k2); JUG.pitch = 0.03; }
      TX.enviar();`,
  },
  // ---- 9. al fondo de la galería, a contraluz: Pepe, alto. El zoom; un glitch; ya no está ----
  f4: {
    t0: 59.0, t1: 66.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.5); LEJOS(); CO.yoI(${DX}, ${GZ}, Math.PI / 2, 0.02);
      const pe = CO.pI('Engineer', 17.5, ${GZ}, -Math.PI / 2); pe.escVis = 1.3; CO.pose(pe, { k: 0.35, brazos: 1.45, tiembla: 0.3 });
      luzTemporal(v3(19.6, -1.9, ${GZ}), 4.0, [5.5, 5.5, 5.5], 30); window.__A = { pe }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.5 + 0.2 * HZ.k(t, 63, 64));
      CO.yoI(${DX}, ${GZ}); JUG.yaw = Math.PI / 2 + Math.sin(t * 0.7) * 0.02; JUG.pitch = 0.0;
      if (A.pe) { if (t < 64.0) { CO.fijoI(A.pe, 17.5, ${GZ}); A.pe.yaw = -Math.PI / 2; } else { npcQuitar(A.pe); A.pe = null; } }
      ENT.disparo = t >= 60.6 && t < 63.2; ENT.disparo2 = t >= 64.6 && t < 66.0; TX.enviar();`,
  },
  // ---- 10. se da vuelta: en el rincón del salón, Lucas mirando la pared, temblando. «¿Lucas? ¿Sos vos?» ----
  f5: {
    t0: 66.0, t1: 73.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.5); LEJOS(); CO.yoI(${DX} - 0.8, ${GZ}, 0.4, 0.03);
      const lu = CO.pI('Hero', 4.0, 35.0, 0); CO.pose(lu, { k: 0.15, tiembla: 0.9 }); luzTemporal(v3(4.0, -1.4, 34.0), 2.2, [1.6, 1.6, 1.6], 30); window.__A = { lu }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.5);
      CO.fijoI(A.lu, 4.0, 35.0); A.lu.yaw = 0;
      const lu = CO.PI(4.0, 35.0, 0.6);
      if (t < 67.4) { ENT.y = 0; JUG.yaw = CO.gira(JUG.yaw, CO.mira(lu)[0], 0.05); JUG.pitch = 0.02; }
      else { const d = vsub(v3(3.8, 0, 32.6), JUG.pos); ENT.y = __tr.i >= 0 && Math.hypot(d.x, d.z) > 0.5 ? 0.22 : 0; JUG.yaw = CO.gira(JUG.yaw, CO.mira(lu)[0], 0.08); JUG.pitch = 0.06; }
      if (t > 72.95) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2), +JUG.yaw.toFixed(3)] }; TX.enviar();`,
  },
  // ---- 11. de cerca: Lucas gira la cabeza para atrás, a tirones, y lo mira; el cuello se le estira ----
  f6: {
    t0: 73.0, t1: 80.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.55); LEJOS(); CO.yoI(3.8, 32.6, 0, 0.06);
      const lu = CO.pI('Hero', 4.0, 35.0, 0); CO.pose(lu, { k: 0.15, tiembla: 0.9 }); window.__A = { lu }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.fijoI(A.lu, 4.0, 35.0); A.lu.yaw = 0;
      // (el giro a tirones: tres tramos con pausas; después el cuello se estira)
      const g = Math.PI * (0.3 * HZ.k(t, 75.0, 75.25) + 0.3 * HZ.k(t, 75.7, 75.95) + 0.4 * HZ.k(t, 76.35, 76.6));
      CO.pose(A.lu, { giro: g, k: 0.15 + 0.85 * HZ.k(t, 76.7, 78.3), tiembla: t < 76.6 ? 0.9 : 0.5, lado: 0.6 });
      if (t >= 76.6 && !A.luz) { A.luz = 1; luzTemporal(v3(3.95, -2.0, 33.8), 2.6, [4.8, 4.8, 4.8], 3); }
      ENT.y = t < 74.6 && __tr.i >= 0 ? 0.15 : t >= 78.8 ? -0.6 : 0;
      JUG.yaw = CO.gira(JUG.yaw, CO.mira(CO.PI(4.0, 35.0, 0.6))[0] + (t >= 78.8 ? 2.6 * HZ.k(t, 78.8, 79.6) : 0), 0.2); JUG.pitch = 0.0 - 0.4 * HZ.k(t, 76.6, 78.3);
      HZ.dano(t < 78.3 ? 0.55 : 0.85); TX.enviar();`,
  },
  // ---- 12. corre por la galería; mira atrás: Lucas lo sigue a saltos, con la cabeza al revés; Pepe atrás ----
  f7: {
    t0: 80.0, t1: 87.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.7); LEJOS(); CO.yoI(-2.5, ${GZ}, -Math.PI / 2, 0.06);
      const lu = CO.pI('Hero', -0.5, ${GZ}, -Math.PI / 2), pe = CO.pI('Engineer', 4.5, ${GZ}, -Math.PI / 2); pe.escVis = 1.3;
      CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 }); CO.pose(pe, { k: 0.5, brazos: 1.45, tiembla: 0.4 }); window.__A = { lu, pe }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.7 + 0.1 * HZ.k(t, 80, 87));
      const x = JUG.pos.x;
      const lp = CO.saltos(t, 80.0, 86.5, [-0.5, ${GZ}], [x + 2.6, ${GZ}], 0.28), pp = CO.saltos(t, 80.0, 86.5, [4.5, ${GZ}], [x + 6.0, ${GZ}], 0.33);
      const lx = t < 82.6 ? Math.min(lp[0], A.lu.pos.x) : Math.min(x + 3.0, A.lu.pos.x), px = t < 82.6 ? Math.min(pp[0], A.pe.pos.x) : Math.min(x + 5.2, A.pe.pos.x);
      CO.fijoI(A.lu, lx, ${GZ}); CO.fijoI(A.pe, px, ${GZ}); A.lu.yaw = Math.PI / 2; A.pe.yaw = Math.PI / 2;
      CO.sigue('lu', v3(lx - 0.7, -2.4, ${GZ} - 0.2), 2.6, [3.4, 3.4, 3.4]); CO.sigue('pe', v3(px - 0.8, -1.9, ${GZ}), 2.8, [2.6, 2.6, 2.6]);
      const ir = -Math.PI / 2;
      if (t < 83.0 || t >= 84.1) { ENT.y = __tr.i >= 0 ? 0.55 : 0; JUG.yaw = CO.gira(JUG.yaw, ir, 0.22); JUG.pitch = 0.08; }
      else { ENT.y = 0.3; JUG.yaw = CO.gira(JUG.yaw, ir + Math.PI, 0.3); JUG.pitch = 0.04; }
      if (t > 86.95) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2)] }; TX.enviar();`,
  },
  // ---- 13. el fondo: Pepe alto en la salida le corta el paso; atrás, Lucas. «No. No, no, no» ----
  f8: {
    t0: 87.0, t1: 94.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.8); LEJOS(); CO.yoI(-12.5, ${GZ}, -Math.PI / 2, 0.06);
      const pe = CO.pI('Engineer', -17.6, ${GZ}, Math.PI / 2), lu = CO.pI('Hero', -8.0, ${GZ}, -Math.PI / 2); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.55, brazos: 1.5, tiembla: 0.4 }); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      luzTemporal(v3(-17.0, -1.3, ${GZ}), 3.0, [4.2, 4.2, 4.2], 30); window.__A = { pe, lu }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.8);
      CO.fijoI(A.pe, -17.6, ${GZ}); A.pe.yaw = Math.PI / 2;
      const lp = CO.saltos(t, 89.4, 93.8, [-8.0, ${GZ}], [JUG.pos.x + 2.0, ${GZ}], 0.3); const lx = Math.max(lp[0], JUG.pos.x + 1.9); CO.fijoI(A.lu, lx, ${GZ}); A.lu.yaw = Math.PI / 2; CO.sigue('lu', v3(lx - 0.7, -2.4, ${GZ} - 0.2), 2.6, [3.4, 3.4, 3.4]);
      ENT.y = t < 88.0 && __tr.i >= 0 ? 0.3 : 0;
      if (t < 89.6) { JUG.yaw = CO.gira(JUG.yaw, -Math.PI / 2, 0.1); JUG.pitch = 0.0; } else if (t < 92.4) { JUG.yaw = CO.gira(JUG.yaw, Math.PI / 2, 0.16); JUG.pitch = 0.0; } else { JUG.yaw = CO.gira(JUG.yaw, -Math.PI / 2, 0.25); JUG.pitch = -0.05; }
      if (t > 93.95) window.__dbg = { fin: [+JUG.pos.x.toFixed(2), +JUG.pos.z.toFixed(2)] }; TX.enviar();`,
  },
  // ---- 14. Pepe se acerca a saltos, cada vez más deformado; el screamer; el golpe y la cámara al piso ----
  f9: {
    t0: 94.0, t1: 101.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.82); LEJOS(); CO.yoI(-13.4, ${GZ}, -Math.PI / 2, 0.0);
      const pe = CO.pI('Engineer', -17.6, ${GZ}, Math.PI / 2), lu = CO.pI('Hero', -11.5, ${GZ}, -Math.PI / 2); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.55, brazos: 1.5, tiembla: 0.4 }); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      luzTemporal(v3(-17.0, -1.3, ${GZ}), 3.0, [4.2, 4.2, 4.2], 30); window.__A = { pe, lu, golpe: 1e9 }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.fijoI(A.lu, -11.5, ${GZ}); A.lu.yaw = Math.PI / 2;
      const pp = CO.saltos(t, 94.4, 98.6, [-17.6, ${GZ}], [-14.25, ${GZ}], 0.35); CO.fijoI(A.pe, pp[0], ${GZ}); A.pe.yaw = Math.PI / 2;
      CO.pose(A.pe, { k: 0.55 + 0.45 * HZ.k(t, 96.5, 98.8), brazos: 1.5, tiembla: 0.4 + 0.5 * HZ.k(t, 97, 99) });
      if (t >= 98.6 && !A.luz) { A.luz = 1; luzTemporal(v3(-13.9, -1.6, ${GZ}), 2.4, [5.5, 5.5, 5.5], 1.0); }
      ENT.y = 0;
      if (t < 99.3) { CO.yoI(-13.4, ${GZ}); JUG.yaw = -Math.PI / 2 + Math.sin(t * 9) * 0.01 * HZ.k(t, 96, 99); JUG.pitch = -0.05 - 0.22 * HZ.k(t, 96.5, 98.8); }
      if (t >= 99.3 && A.golpe > 1e8) { A.golpe = t; A.yw = JUG.yaw; A.e0 = vadd(JUG.pos, v3(0, 0.66, 0)); window.__dbg = { en: [+JUG.pos.x.toFixed(3), +JUG.pos.y.toFixed(3), +JUG.pos.z.toFixed(3), +A.yw.toFixed(4)] }; }
      if (t >= A.golpe) {
        const u = Math.min(1, (t - A.golpe) / 0.55), b = u < 1 ? 0 : Math.max(0, Math.sin((t - A.golpe - 0.55) * 18) * Math.exp(-(t - A.golpe - 0.55) * 7)) * 0.07;
        const f = v3(Math.sin(A.yw), 0, Math.cos(A.yw)), p = v3(A.e0.x - f.x * 0.5 * u, A.e0.y + (-3.66 + 0.13 - A.e0.y) * u * u + b, A.e0.z - f.z * 0.5 * u);
        const m = vadd(p, v3(Math.sin(A.yw + 0.35 - u * 0.5), -0.25 + u * 0.28, Math.cos(A.yw + 0.35 - u * 0.5)));
        HZ.cam(p, m, u * Math.PI / 2 * 1.05 - b * 3, 0);
      }
      if (t >= 99.3 && t < 99.37) TX.r(0, 0, 1, 1, [255, 255, 255]);
      HZ.dano(t >= 99.3 && t < 100.0 ? 1 : 0.82 + 0.1 * HZ.k(t, 96, 99)); TX.enviar();`,
    titulos: `const t = __tr.t; if (t >= 99.45) { const e = CO.kf || (CO.kf = (() => { const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = '<b>Pepe</b> <span style="color:#ff6a1a">&#9670;</span> <i>nico</i>'; $('trOver').appendChild(d); return d; })()); e.style.opacity = Math.min(1, (t - 99.45) / 0.15).toFixed(2); }`,
  },
  // ---- 15. en el piso, de costado: los pies; alguien levanta la cámara: es Pepe, que se mira en ella ----
  f10: {
    t0: 101.0, t1: 108.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.85); LEJOS(); const E = ${process.env.ED9 || 'null'} || { en: [-13.4, -2.69, ${GZ}, -Math.PI / 2] };
      CO.yoI(E.en[0], E.en[2], E.en[3], 0); const f = v3(Math.sin(E.en[3]), 0, Math.cos(E.en[3]));
      const pe = CO.pI('Engineer', E.en[0] + f.x * 0.85, E.en[2] + f.z * 0.85, 0), lu = CO.pI('Hero', E.en[0] - f.x * 1.6 + 0.5, E.en[2] - f.z * 1.6 + 0.4, 0); pe.escVis = 1.3;
      CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.5 }); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      window.__A = { E, f, pe, lu, pp: [E.en[0] + f.x * 0.85, E.en[2] + f.z * 0.85] }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, E = A.E, f = A.f, yw = E.en[3]; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.fijoI(A.lu, E.en[0] - f.x * 1.6 + 0.5, E.en[2] - f.z * 1.6 + 0.4); A.lu.yaw = yw;
      const e0 = v3(E.en[0], E.en[1] + 0.66, E.en[2]), piso = v3(e0.x - f.x * 0.5, -3.66 + 0.13, e0.z - f.z * 0.5);
      // (Pepe se acerca a la cámara caída y la levanta: sube del piso a la altura de su cara, se endereza y gira hacia él)
      const pk = Math.min(1, Math.max(0, (t - 103.4) / 1.6)), sk = pk * pk * (3 - 2 * pk);
      CO.fijoI(A.pe, A.pp[0] - f.x * 0.55 * HZ.k(t, 102.0, 103.2), A.pp[1] - f.z * 0.55 * HZ.k(t, 102.0, 103.2)); A.pe.yaw = CO.yaw(A.pe.pos, piso);   // (mira la cámara caída; la cámara sube hasta sus ojos)
      // (termina enfrente de sus ojos, a medio metro, a la misma altura: del lado de donde estaba la cámara caída)
      const cara = CO.caraAlta(A.pe), hz = v3(piso.x - A.pe.pos.x, 0, piso.z - A.pe.pos.z).norm(), fin = vadd(cara, v3(hz.x * 0.55, -0.03, hz.z * 0.55));
      const p = v3(piso.x + (fin.x - piso.x) * sk, piso.y + (fin.y - piso.y) * sk + Math.sin(t * 13) * 0.004 * sk, piso.z + (fin.z - piso.z) * sk);
      const m0 = vadd(piso, v3(Math.sin(yw - 0.15), 0.03, Math.cos(yw - 0.15))), m = vadd(p, vadd(vscale(vsub(m0, piso).norm(), 1 - sk), vscale(vsub(cara, p).norm(), sk)));
      HZ.cam(p, m, Math.PI / 2 * 1.05 * (1 - sk) + Math.sin(t * 5) * 0.05 * sk, 0);
      if (t >= 105.0 && !A.luz) { A.luz = 1; luzTemporal(vadd(p, v3(0, 0.1, 0)), 1.6, [4.0, 4.0, 4.0], 3.5); }
      HZ.dano(0.85); TX.enviar();`,
  },
  // ---- 16. la cámara en la mano de Pepe: vuelve por la galería al salón; nico en el piso; Lucas parado al lado ----
  f11: {
    t0: 108.0, t1: 115.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.85); LEJOS(); CO.yoI(3.0, 31.5, 0, 0);
      const ni = CO.pI('Astronauta', 3.2, 33.6, 0), lu = CO.pI('Hero', 4.4, 33.0, -Math.PI / 2); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      const pe = CO.pI('Engineer', -6, ${GZ}, Math.PI / 2); pe.escVis = 1.3; CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.5 });
      luzTemporal(v3(3.6, -1.8, 32.6), 3.0, [2.6, 2.6, 2.6], 30); window.__A = { ni, lu, pe }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.85);
      if (__tr.i === 0 && !A.tumbo) { A.tumbo = 1; CO.tumbar(A.ni, v3(0.3, -1, 0.2)); }
      CO.fijoI(A.lu, 4.4, 33.0); A.lu.yaw = -Math.PI / 2;
      // (la cámara la lleva Pepe: camina por la galería hacia el salón, con el bamboleo de un brazo largo; mira a nico en el
      // piso; al final se da vuelta y se mira a sí mismo)
      const k = HZ.k(t, 108.0, 111.6), p = v3(-5.0 + k * 7.6, -2.0 + Math.sin(t * 6.3) * 0.03, ${GZ} + k * 2.2);
      const meta = t < 111.0 ? v3(p.x + 3, -2.2, p.z + 0.6) : v3(3.2, -3.4, 33.6), mira = t < 113.4 ? meta : null;
      if (mira) HZ.cam(p, vadd(p, vscale(vsub(mira, p).norm(), 1)), Math.sin(t * 3.1) * 0.06, 0);
      CO.fijoI(A.pe, p.x - 0.5, p.z - 0.2);
      if (t >= 113.4) { const cara = CO.caraAlta(A.pe), c = vadd(cara, v3(0.52, -0.02, 0.1)); A.pe.yaw = CO.yaw(A.pe.pos, c); HZ.cam(c, cara, Math.sin(t * 4) * 0.08, 0); if (!A.luz) { A.luz = 1; luzTemporal(vadd(c, v3(0, 0.1, 0)), 1.6, [4.0, 4.0, 4.0], 2); } }
      TX.enviar();`,
  },
  // ---- 17. la cámara apoyada: los tres frente a ella; la luz parpadea y cada vez están más cerca ----
  f12: {
    t0: 115.0, t1: 122.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.88); CO.yoI(${DX} + 1.0, 27.4, 0, 0);
      const pe = CO.pI('Engineer', ${DX} + 1.0, 33.4, Math.PI), lu = CO.pI('Hero', ${DX} - 0.2, 33.6, Math.PI), ni = CO.pI('Astronauta', ${DX} + 2.2, 33.6, Math.PI); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.8, brazos: 1.5, tiembla: 0.5 }); CO.pose(lu, { k: 0.6, tiembla: 0.6, lado: -0.7 }); CO.pose(ni, { k: 0.5, tiembla: 0.6, lado: 0.8 });
      window.__A = { pe, lu, ni }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0);
      // (cuatro apagones; cuando vuelve la luz, los tres están más cerca: 6, 4, 2,6 y 1,1 m)
      const cortes = [116.3, 117.7, 119.1, 120.5], dist = [6.0, 4.0, 2.6, 1.1], fase = cortes.filter((c) => t >= c + 0.35).length, oscuro = cortes.some((c) => t >= c && t < c + 0.35);
      HZ.nv(!oscuro); const z = 27.4 + dist[Math.min(3, Math.max(0, fase - 0)) ] ;
      CO.fijoI(A.pe, ${DX} + 1.0, z); CO.fijoI(A.lu, ${DX} + 0.25, z + 0.15); CO.fijoI(A.ni, ${DX} + 1.75, z + 0.15);
      for (const P of [A.pe, A.lu, A.ni]) P.yaw = Math.PI;
      CO.sigue('g', v3(${DX} + 1.0, -2.0, z - 0.9), 3.0, oscuro ? [0, 0, 0] : [1.3, 1.3, 1.3]);
      DBG.cam = null; CO.yoI(${DX} + 1.0, 27.4, 0, fase >= 3 ? -0.22 : -0.04); ENT.y = 0;
      if (oscuro) TX.r(0, 0, 1, 1, [0, 0, 0]);
      HZ.dano(0.88); TX.enviar();`,
  },
  // ---- 18. la batería se muere ----
  f13: {
    t0: 122.0, t1: 128.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.9); CO.yoI(${DX} + 1.0, 27.4, 0, -0.22);
      const pe = CO.pI('Engineer', ${DX} + 1.0, 28.5, Math.PI), lu = CO.pI('Hero', ${DX} + 0.25, 28.65, Math.PI), ni = CO.pI('Astronauta', ${DX} + 1.75, 28.65, Math.PI); pe.escVis = 1.3;
      CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.7 }); CO.pose(lu, { k: 0.8, tiembla: 0.7, lado: -0.7 }); CO.pose(ni, { k: 0.7, tiembla: 0.7, lado: 0.8 });
      window.__A = { pe, lu, ni }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.fijoI(A.pe, ${DX} + 1.0, 28.5); CO.fijoI(A.lu, ${DX} + 0.25, 28.65); CO.fijoI(A.ni, ${DX} + 1.75, 28.65); for (const P of [A.pe, A.lu, A.ni]) P.yaw = Math.PI;
      DBG.cam = null; CO.yoI(${DX} + 1.0, 27.4, 0, -0.22); CO.sigue('g', v3(${DX} + 1.0, -2.0, 27.9), 2.2, [1.3, 1.3, 1.3]);
      if (__tr.i === 0) vfCmd('FFCam.SetBattery(0.03)');
      HZ.dano(t < 124.0 ? 0.9 : 0.9 + 0.1 * HZ.k(t, 124.0, 125.2));
      if (t >= 125.3 && t < 126.8) { TX.r(0, 0, 1, 1, [16, 34, 168]); TX.t('SIN SEÑAL', 'JXV40', 0.5, 0.5, [255, 255, 255], 255, 1, 1); }
      else if (t >= 126.8) TX.r(0, 0, 1, 1, [0, 0, 0]);
      TX.enviar();`,
  },
  // ---- 19. «Lección 7: todos vuelven»: los tres saludan en fila ----
  tE: {
    t0: 128.0, t1: 134.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.3);
      const lu = CO.pj('Hero', -1.2, 4.0, Math.PI, { modo: 'bailar', emote: 'Hi' }), pe = CO.pepe(0, 4.1, Math.PI, { modo: 'bailar', emote: 'Hi' }), ni = CO.pj('Astronauta', 1.2, 4.0, Math.PI, { modo: 'bailar', emote: 'Hi' });
      CO.pose(lu, { k: 0.2, tiembla: 0.3, lado: -0.6 }); CO.pose(ni, { k: 0.2, tiembla: 0.3, lado: 0.6 }); window.__A = { lu, pe, ni }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.3);
      if (t < 130.4) { HZ.tarjeta(); HZ.portada(t, 128.0, 7, 'LECCIÓN 7: TODOS VUELVEN'); }
      else { const k = HZ.k(t, 130.4, 134.0); HZ.tripode(CO.P(0.2, -3.6 + k * 0.6, 1.5), CO.P(0, 4.0, 1.0), 0, 60); HZ.zocalo(t, 130.7, 133.9, 'PEPE, LUCAS Y NICO', 'MUÑECOS DE PRUEBAS'); HZ.contador('1.050'); HZ.marca(); }
      TX.enviar();`,
  },
  // ---- 20. el auto atropella sólo a Pepe; los otros dos siguen saludando. «Pepe siempre vuelve» ----
  tF: {
    t0: 134.0, t1: 141.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.32);
      const lu = CO.pj('Hero', -1.2, 4.4, Math.PI, { modo: 'bailar', emote: 'Hi' }), pe = CO.pepe(0, 3.0, Math.PI, { modo: 'bailar', emote: 'Hi' }), ni = CO.pj('Astronauta', 1.2, 4.4, Math.PI, { modo: 'bailar', emote: 'Hi' });
      CO.pose(lu, { k: 0.2, tiembla: 0.3, lado: -0.6 }); CO.pose(ni, { k: 0.2, tiembla: 0.3, lado: 0.6 });
      // (el auto de costado: el de CO.auto mira a +z; girado un cuarto de vuelta, mira a +x y entra por la derecha del cuadro)
      const o = CO.auto(-20, 3.0, 0, 0); o.b.q.copy(Quat.axis(0, 1, 0, Math.PI / 2).mul(o.b.q)); o.b.updateWorld && o.b.updateWorld();
      window.__A = { lu, pe, ni, o, q0: o.b.q.clone(), y0: CO.g(0, 3.0) + (o.b.pos.y - CO.g(-20, 3.0)) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true; HZ.dano(0.32);
      // (la altura también fija mientras viene: afuera del campo no hay piso y se caía)
      if (!A.solto) { if (t < 138.4) { A.o.b.pos.x = 0 - A.o.frente - 0.25 - 16 * (138.4 - t); A.o.b.pos.z = 3.0; A.o.b.pos.y = A.y0; A.o.b.vel.set(16, 0, 0); A.o.b.ang.set(0, 0, 0); A.o.b.q.copy(A.q0); A.o.b.wake && A.o.b.wake(); } else { A.solto = 1; CO.tumbar(A.pe, v3(10, 4.5, 0.8)); } }
      CO.fijo(A.lu, -1.2, 4.4); CO.fijo(A.ni, 1.2, 4.4);
      HZ.tripode(CO.P(0.1, -2.6, 1.45), CO.P(0, 3.6, 1.0), 0, 64); HZ.contador('1.050'); HZ.aprobado(t, 139.0, 140.9); HZ.marca();
      TX.enviar();`,
  },
  // ---- 21. Lucas y nico dejan de saludar y miran a cámara; Pepe se levanta otra vez ----
  tG: {
    t0: 141.0, t1: 147.0, mapa: 'RB_Construct', espera: 6000, antes: 75,
    preparar: COMUN2 + `DIA.hora = 11;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.dano(0.4);
      const lu = CO.pj('Hero', -1.2, 4.0, Math.PI), ni = CO.pj('Astronauta', 1.2, 4.0, Math.PI), caido = CO.pepe(2.2, 10.5, 0); CO.tumbar(caido, v3(0, -1, 0));
      window.__A = { lu, ni, caido, vuelve: null }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = true;
      CO.fijo(A.lu, -1.2, 4.0); CO.fijo(A.ni, 1.2, 4.0); A.lu.yaw = Math.PI; A.ni.yaw = Math.PI;
      const g = HZ.k(t, 142.4, 143.0); CO.pose(A.lu, { k: 0.2 + 0.6 * g, tiembla: 0.3 + 0.4 * g, lado: -0.6 }); CO.pose(A.ni, { k: 0.2 + 0.6 * g, tiembla: 0.3 + 0.4 * g, lado: 0.6 });
      if (t >= 144.6 && !A.vuelve) { A.vuelve = CO.pepe(0, 4.1, Math.PI); CO.pose(A.vuelve, { k: 0.5, tiembla: 0.5 }); }
      const k = HZ.k(t, 141.0, 147.0); HZ.tripode(CO.P(0.1, -2.4 + k * 2.6, 1.45 - k * 0.1), CO.P(0, 4.0, 1.25), 0, 62 - 18 * k);
      HZ.contador(t < 145.2 ? '1.050' : '1.051', t < 145.2 ? 1 : Math.floor(t * 8) % 2 ? 1 : 0.5); HZ.marca(0.6); HZ.dano(0.4 + 0.3 * HZ.k(t, 144, 147));
      TX.enviar();`,
  },
  // ---- 22. FIN DE LA CINTA 3 ----
  fin: {
    t0: 147.0, t1: 150.0, mapa: 'RB_Construct', espera: 5000, antes: 20,
    preparar: COMUN2 + `DIA.hora = 1.5;` + VF2 + `HZ.nv(false); HZ.lampara(0); HZ.tarjeta(); return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t; HZ.tarjeta(); TX.sinOSD = true; HZ.dano(0.6); TX.r(0, 0, 1, 1, [0, 0, 0]);
      if (t >= 147.4 && t < 149.2) TX.t('FIN DE LA CINTA 3', 'JXV24', 0.5, 0.5, [230, 230, 230], 255, 1, 1);
      if (t >= 149.5 && t < 149.6) TX.t('CINTA 4', 'JXV56', 0.5, 0.5, [220, 20, 20], 255, 1, 1);
      TX.enviar();`,
  },
};
