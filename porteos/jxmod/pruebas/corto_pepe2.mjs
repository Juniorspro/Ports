// corto 8 (4:3, 150 s a 30 cuadros): «La venganza de Pepe 2» — CINTA 3. Sigue a la parte 1 (corto_pepe.mjs, de donde
// trae el Viewfinder y los ayudantes): Lucas, el que filmaba, desapareció; nico lo va a buscar de noche adentro del
// edificio de gm_construct (una galería techada de 40 m —x de -19 a 21, z ≈ 28,5— y un salón hasta z 35,7; el piso de
// adentro a -3,66: pisoBajo da el techo). Instructivo «Lección 6: si un amigo no vuelve», el corte, la grabación de nico
// (Pepe a contraluz al fondo del pasillo, Lucas mirando la pared que gira la cabeza como un búho, la huida: sale corriendo
// por la puerta al campo de pasto, Lucas lo persigue corriendo de espaldas, y en el medio del campo Pepe alto le corta el
// paso; la cámara que Pepe levanta del pasto, nico tirado donde cayó, los tres cada vez más cerca cuando la luz parpadea) y
// «Lección 7: todos vuelven», donde a Pepe lo atropellan (como siempre).
// Las deformaciones son de verdad, en el modelo: cuello y cabeza estirados, brazos largos, la cabeza girada sobre el
// cuello, temblor (CO.pose, en poseExtra); y los que persiguen corren o caminan con la animación (CO.mueve).
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
// el camino de la huida: del salón a la puerta, afuera y al campo abierto (al sur del edificio, todo pasto)
const RUTA = [[3.8, 31.8], [1.6, 27.4], [1.5, 25.0], [2.2, 19.5], [5.0, 9.0], [9.5, -7.0], [11.6, -14.5]];
// la huida (f7–f13): nico corre de verdad (~6 m/s, la cámara en la mano con el rebote de cada paso) y los que lo persiguen
// corren o caminan con la animación (la posición y la velocidad las pone el guion; la IA queda en 'guion', que no hace nada)
const HUIDA = `
  window.RUTA = ${JSON.stringify(RUTA)};
  // (la lámpara infrarroja al mínimo y menos ganancia: si no, el pasto que ilumina queda blanco y sin textura)
  window.LAMPARA = () => vfCmd('RunConsoleCommand("ffcam_lamp_brightness","0.2") RunConsoleCommand("ffcam_nv_brightness","0.85")');
  // (el piso de verdad: adentro del edificio, el de la galería —pisoBajo da el techo—; afuera, el pasto)
  CO.piso = (x, z) => (z > 25.8 ? -3.66 : CO.g(x, z));
  CO.camino = (pts) => { const L = [0]; for (let j = 1; j < pts.length; j++) L.push(L[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1])); return { pts, L, total: L[L.length - 1] }; };
  CO.en = (C, s) => { s = Math.max(0, Math.min(C.total, s)); let j = 1; while (j < C.L.length - 1 && C.L[j] < s) j++; const a = C.pts[j - 1], b = C.pts[j], k = (s - C.L[j - 1]) / Math.max(1e-6, C.L[j] - C.L[j - 1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  // (cuánto avanzó el que arranca en t0 hasta v, con tau segundos de aceleración)
  CO.dist = (t, t0, v, tau) => { const u = Math.max(0, t - t0); return v * (u - tau * (1 - Math.exp(-u / tau))); };
  // (dónde frena nico en el campo —s87 + 4,96 m— y dónde queda después de retroceder 1,8 m: lo comparten f8 a f13)
  CO.geo = () => { const C = CO.camino(RUTA), s87 = CO.dist(87.0, 79.9, 6.2, 0.45), q87 = CO.en(C, s87), par = CO.en(C, s87 + 6.2 * 1.6 / 2), yw = par[2];
    return { s87, q87, parada: [par[0], par[1]], yw, s1: [par[0] - Math.sin(yw) * 1.8, par[1] - Math.cos(yw) * 1.8] }; };
  // (un NPC por donde dice el guion: la posición, el yaw del cuerpo y la velocidad —la animación de caminar o correr sale de ella—)
  CO.mueve = (P, x, z, yaw, vx, vz) => { if (!P || P.rag) return; P.act.modo = 'guion'; P.pos.set(x, CO.piso(x, z) + 0.95, z); P.vel.set(vx, 0, vz); P.suelo = true; P.yaw = yaw; };
  // (la cámara de nico: en la mano, a la altura del pecho; corriendo, el rebote de cada paso —1,6 + 0,3·v pasos por segundo—,
  // el vaivén de costado cada dos pasos y el temblor de la mano; quieto, la respiración agitada)
  CO.camCorre = (x, z, yaw, pitch, v) => {
    const fp = 1.6 + 0.3 * v, a = Math.min(1, v / 6.2); CO.fase = (CO.fase || 0) + 2 * Math.PI * fp / 30; const f = CO.fase, tt = TIEMPO.t, r = 1 - a;
    const h = 1.45 + a * 0.045 * Math.cos(f) + r * 0.014 * Math.sin(tt * 2 * Math.PI * 0.85) + 0.004 * Math.sin(tt * 9.1), lado = a * 0.035 * Math.sin(f / 2);
    const p = v3(x + Math.cos(yaw) * lado, CO.piso(x, z) + h, z - Math.sin(yaw) * lado);
    const yw = yaw + a * 0.03 * Math.sin(f / 2 + 0.6) + 0.012 * Math.sin(tt * 7.3) + 0.008 * Math.sin(tt * 12.9);
    const pt = pitch + a * 0.035 * Math.sin(f + 1.0) + r * 0.012 * Math.sin(tt * 2 * Math.PI * 0.85 + 1) + 0.01 * Math.sin(tt * 8.7);
    HZ.cam(p, vadd(p, v3(Math.sin(yw) * Math.cos(pt), -Math.sin(pt), Math.cos(yw) * Math.cos(pt))), a * 0.05 * Math.sin(f / 2 + 0.3) + 0.015 * Math.sin(tt * 5.3), 0);
    JUG.pos.set(x, CO.piso(x, z) + 0.97, z); JUG.vel.set(0, 0, 0); JUG.yaw = yw; JUG.pitch = pt;
    // (la lámpara del mod apunta desde FFCam.CameraOrigin, que sale de su CalcView: con la cámara del guion no se
    // actualiza y la luz quedaba atrás, donde empezó la toma. Se le pasa la cámara de verdad en cada cuadro)
    const o = aG(p); vfCmd('FFCam.CameraOrigin = Vector(' + o[0].toFixed(1) + ',' + o[1].toFixed(1) + ',' + o[2].toFixed(1) + ') FFCam.CameraAngles = Angle(' + (pt * 57.2958).toFixed(2) + ',' + (yw * 57.2958).toFixed(2) + ',0)');
  };
`;
export const BASE2 = { VF2, COMUN2, HUIDA, RELOJ, DX, GZ };
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
  // ---- 12. sale corriendo: por la galería, la puerta y al campo abierto; mira atrás: Lucas corre de espaldas, con la cara
  // —el búho— hacia él; Pepe sale por la puerta. La cámara la lleva en la mano: el rebote de cada paso ----
  f7: {
    t0: 80.0, t1: 87.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.7); LEJOS(); LAMPARA(); const o = CO.auto(-2.0, 22, 0, 0); CO.chocado(o, 70); CO.yoI(3.8, 31.8, -2.68, 0.1);
      const lu = CO.pI('Hero', 4.0, 34.4, Math.PI), pe = CO.pI('Engineer', 7.0, 28.5, -Math.PI / 2); pe.escVis = 1.3;
      CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 }); CO.pose(pe, { k: 0.5, brazos: 1.45, tiembla: 0.4 });
      window.__A = { o, lu, pe, C: CO.camino(RUTA), CL: CO.camino([[4.0, 34.4]].concat(RUTA)), CP: CO.camino([[7.0, 28.5], [1.5, 27.2], [1.5, 25.0], [2.0, 20.0]]) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A; TX.sinOSD = false; HZ.nv(true); HZ.dano(0.7 + 0.1 * HZ.k(t, 80, 87)); ENT.y = 0;
      // nico: 6,2 m/s (arranca en 0,45 s); mira 2,5 m adelante en el camino; de 83,0 a 84,1 mira para atrás sin dejar de correr
      const s = CO.dist(t, 79.9, 6.2, 0.45), v = 6.2 * (1 - Math.exp(-Math.max(0, t - 79.9) / 0.45)), q = CO.en(A.C, s), q2 = CO.en(A.C, s + 2.5);
      const ir = Math.atan2(q2[0] - q[0], q2[1] - q[1]), atras = t >= 83.0 && t < 84.1; if (A.yw === undefined) A.yw = ir;
      A.yw = CO.gira(A.yw, atras ? ir + Math.PI - 0.22 : ir, atras ? 0.32 : 0.16);
      CO.camCorre(q[0], q[1], A.yw, atras ? 0.02 : 0.06, v);
      // (la lámpara infrarroja la prende al salir: adentro, con las paredes al lado, quedaba todo blanco)
      if (q[1] < 24.6) A.lamp = 1; HZ.lampara(A.lamp ? 1 : 0);
      // Lucas: corre de espaldas a 5,6 m/s por el mismo camino (el cuerpo mira para atrás; la cara, dada vuelta, a nico)
      const sl = CO.dist(t, 80.3, 5.6, 0.3), ql = CO.en(A.CL, sl), vl = 5.6 * (1 - Math.exp(-Math.max(0, t - 80.3) / 0.3));
      CO.mueve(A.lu, ql[0], ql[1], ql[2] + Math.PI, Math.sin(ql[2]) * vl, Math.cos(ql[2]) * vl);
      CO.sigue('lu', v3(ql[0] + Math.sin(ql[2]) * 0.9, CO.piso(ql[0], ql[1]) + 2.2, ql[1] + Math.cos(ql[2]) * 0.9), 2.4, [1.2, 1.2, 1.2]);
      // Pepe: camina (pasos largos, 2 m/s) por la galería hasta la puerta y sale
      const sp = 2.0 * Math.max(0, t - 79.5), qp = CO.en(A.CP, sp);
      CO.mueve(A.pe, qp[0], qp[1], qp[2], Math.sin(qp[2]) * 2.0, Math.cos(qp[2]) * 2.0);
      CO.sigue('pe', v3(qp[0] + Math.sin(qp[2]) * 1.0, CO.piso(qp[0], qp[1]) + 2.2, qp[1] + Math.cos(qp[2]) * 1.0), 3.0, [2.6, 2.6, 2.6]);
      if (t > 86.95) window.__dbg = { fin: [+q[0].toFixed(2), +q[1].toFixed(2), +s.toFixed(2)], lucas: [+ql[0].toFixed(2), +ql[1].toFixed(2)] }; TX.enviar();`,
  },
  // ---- 13. el campo: frena sin aire; atrás no hay nadie; adelante, Pepe parado en el medio del pasto. «No. No, no, no».
  // Retrocede; se da vuelta para huir: Lucas pegado atrás. Vuelve a mirar: Pepe más cerca ----
  f8: {
    t0: 87.0, t1: 94.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.8); LEJOS(); LAMPARA(); const G = CO.geo(); CO.yo(G.q87[0], G.q87[1], G.yw, 0.06);
      const pe = CO.pj('Engineer', 40, -40, 0), lu = CO.pj('Hero', 44, -40, 0); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.55, brazos: 1.5, tiembla: 0.4 }); CO.pose(lu, { k: 0.55, giro: Math.PI, tiembla: 0.6, lado: 0.4 });
      window.__A = { G, pe, lu, C: CO.camino(RUTA) }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, G = A.G, fx = Math.sin(G.yw), fz = Math.cos(G.yw); TX.sinOSD = false; HZ.lampara(1); HZ.nv(true); HZ.dano(0.8); ENT.y = 0;
      // (frena: de 6,2 m/s a 0 en 1,6 s; de 90,0 a 92,2 retrocede 1,8 m despacio)
      const u = Math.min(1.6, Math.max(0, t - 87.0)), s = G.s87 + 6.2 * u - 6.2 * u * u / 3.2, v = 6.2 * Math.max(0, 1 - u / 1.6), q = CO.en(A.C, s);
      const rb = 1.8 * HZ.k(t, 90.0, 92.2), x = q[0] - fx * rb, z = q[1] - fz * rb;
      // adónde mira: adelante; atrás (88,7–89,5: nadie); adelante (Pepe); atrás de golpe (92,2: Lucas); adelante (92,75: Pepe más cerca)
      let meta = G.yw, kk = 0.16, pm = 0.06;
      if (t >= 88.7 && t < 89.5) { meta = G.yw + Math.PI - 0.3; kk = 0.13; pm = 0.04; }
      else if (t >= 89.5 && t < 92.2) { kk = 0.3; pm = -0.16; }
      else if (t >= 92.2 && t < 92.75) { meta = G.yw + Math.PI + 0.2; kk = 0.38; pm = -0.1; }
      else if (t >= 92.75) { kk = 0.4; pm = -0.27; }
      if (A.yw === undefined) A.yw = G.yw; A.yw = CO.gira(A.yw, meta, kk); A.pt = A.pt === undefined ? pm : A.pt + (pm - A.pt) * 0.15;
      CO.camCorre(x, z, A.yw + (t >= 90 ? Math.sin(t * 17) * 0.006 : 0), A.pt, v + (rb > 0 && rb < 1.8 ? 0.8 : 0));
      // Pepe aparece (mientras mira atrás) a 5 m adelante; a las 92,7 —mientras mira a Lucas— ya está a 2,8 m
      const S1x = G.q87[0] + 0, d1 = t < 92.5 ? 5.0 + 0 : 2.8 - 1.8;
      const bx = t < 92.5 ? q[0] : G.s1[0], bz = t < 92.5 ? q[1] : G.s1[1], dpe = t < 92.5 ? 5.0 : 2.8;
      if (t >= 89.0) { const px = (t < 92.5 ? G.parada[0] : G.s1[0]) + fx * dpe, pz = (t < 92.5 ? G.parada[1] : G.s1[1]) + fz * dpe; CO.mueve(A.pe, px, pz, G.yw + Math.PI, 0, 0); CO.sigue('pe', v3(px - fx * 0.9, CO.piso(px, pz) + 2.2, pz - fz * 0.9), 3.0, [2.0, 2.0, 2.0]); }
      else { CO.mueve(A.pe, 40, -40, 0, 0, 0); CO.sigue('pe', v3(40, 0, -40), 1, [0, 0, 0]); }
      // Lucas: atrás, pegado, cuando se da vuelta para huir
      if (t >= 91.9) { const lx = G.s1[0] - fx * 3.2 + fz * 0.5, lz = G.s1[1] - fz * 3.2 - fx * 0.5; CO.mueve(A.lu, lx, lz, G.yw + Math.PI, 0, 0); CO.sigue('lu', v3(lx + fx * 0.7, CO.piso(lx, lz) + 1.9, lz + fz * 0.7), 1.1, [1.6, 1.6, 1.6]); }
      else { CO.mueve(A.lu, 44, -40, 0, 0, 0); CO.sigue('lu', v3(44, 0, -40), 1, [0, 0, 0]); }
      if (t > 93.95) window.__dbg = { fin: [+x.toFixed(2), +z.toFixed(2)], s1: G.s1 }; TX.enviar();`,
  },
  // ---- 14. Pepe camina hacia él, despacio, cada vez más deformado; el screamer; el golpe y la cámara al pasto ----
  f9: {
    t0: 94.0, t1: 101.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.82); LEJOS(); LAMPARA(); const G = CO.geo(); CO.yo(G.s1[0], G.s1[1], G.yw, -0.27);
      const fx = Math.sin(G.yw), fz = Math.cos(G.yw);
      const pe = CO.pj('Engineer', G.s1[0] + fx * 2.8, G.s1[1] + fz * 2.8, G.yw + Math.PI), lu = CO.pj('Hero', G.s1[0] - fx * 2.0, G.s1[1] - fz * 2.0, G.yw + Math.PI); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.55, brazos: 1.5, tiembla: 0.4 }); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      window.__A = { G, pe, lu, golpe: 1e9 }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, G = A.G, fx = Math.sin(G.yw), fz = Math.cos(G.yw); TX.sinOSD = false; HZ.lampara(t < 99.3 ? 1 : 0); HZ.nv(true); ENT.y = 0;
      CO.mueve(A.lu, G.s1[0] - fx * 2.0, G.s1[1] - fz * 2.0, G.yw + Math.PI, 0, 0);
      // (camina de 2,8 a 0,85 m entre 94,3 y 98,6: 0,45 m/s, con la animación de caminar; después se queda)
      const kp = Math.min(1, Math.max(0, (t - 94.3) / 4.3)), dp = 2.8 - 1.95 * kp, vp = kp > 0 && kp < 1 ? 1.95 / 4.3 : 0;
      const px = G.s1[0] + fx * dp, pz = G.s1[1] + fz * dp; CO.mueve(A.pe, px, pz, G.yw + Math.PI, -fx * vp, -fz * vp);
      CO.pose(A.pe, { k: 0.55 + 0.45 * HZ.k(t, 96.5, 98.8), brazos: 1.5, tiembla: 0.4 + 0.5 * HZ.k(t, 97, 99) });
      CO.sigue('pe', v3(px - fx * 0.8, CO.piso(px, pz) + 2.2, pz - fz * 0.8), 2.6, [1.2, 1.2, 1.2]);
      if (t >= 98.6 && !A.luz) { A.luz = 1; luzTemporal(v3(px - fx * 0.5, CO.piso(px, pz) + 2.1, pz - fz * 0.5), 2.4, [5.5, 5.5, 5.5], 1.0); }
      // (la cámara: quieta en la mano que tiembla; sube para mirarle la cara a medida que se acerca)
      const ca = CO.caraAlta(A.pe), y0 = CO.piso(G.s1[0], G.s1[1]) + 1.45, pm = -Math.atan2(ca.y - y0, Math.max(0.3, dp)) * 0.85;
      A.pt = A.pt === undefined ? pm : A.pt + (pm - A.pt) * 0.12;
      if (t < 99.3) CO.camCorre(G.s1[0], G.s1[1], G.yw + Math.sin(t * 9) * 0.012 * HZ.k(t, 96, 99), A.pt, 0);
      if (t >= 99.3 && A.golpe > 1e8) { A.golpe = t; A.yw = G.yw; A.e0 = v3(G.s1[0], y0, G.s1[1]); window.__dbg = { en: [+G.s1[0].toFixed(3), +(y0 - 0.66).toFixed(3), +G.s1[1].toFixed(3), +G.yw.toFixed(4)] }; }
      if (t >= A.golpe) {
        const u = Math.min(1, (t - A.golpe) / 0.55), b = u < 1 ? 0 : Math.max(0, Math.sin((t - A.golpe - 0.55) * 18) * Math.exp(-(t - A.golpe - 0.55) * 7)) * 0.07;
        const f = v3(Math.sin(A.yw), 0, Math.cos(A.yw)), suelo = CO.piso(A.e0.x - f.x * 0.5, A.e0.z - f.z * 0.5) + 0.13;
        const p = v3(A.e0.x - f.x * 0.5 * u, A.e0.y + (suelo - A.e0.y) * u * u + b, A.e0.z - f.z * 0.5 * u);
        const m = vadd(p, v3(Math.sin(A.yw + 0.35 - u * 0.5), -0.25 + u * 0.28, Math.cos(A.yw + 0.35 - u * 0.5)));
        HZ.cam(p, m, u * Math.PI / 2 * 1.05 - b * 3, 0);
      }
      if (t >= 99.3 && t < 99.37) TX.r(0, 0, 1, 1, [255, 255, 255]);
      HZ.dano(t >= 99.3 && t < 100.0 ? 1 : 0.82 + 0.1 * HZ.k(t, 96, 99)); TX.enviar();`,
    titulos: `const t = __tr.t; if (t >= 99.45) { const e = CO.kf || (CO.kf = (() => { const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = '<b>Pepe</b> <span style="color:#ff6a1a">&#9670;</span> <i>nico</i>'; $('trOver').appendChild(d); return d; })()); e.style.opacity = Math.min(1, (t - 99.45) / 0.15).toFixed(2); }`,
  },
  // ---- 15. en el pasto, de costado: los pies; alguien levanta la cámara: es Pepe, que se mira en ella ----
  f10: {
    t0: 101.0, t1: 108.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.85); LEJOS(); const G = CO.geo(), E = ${process.env.ED9 || 'null'} || { en: [G.s1[0], CO.piso(G.s1[0], G.s1[1]) + 0.79, G.s1[1], G.yw] };
      CO.yo(E.en[0], E.en[2], E.en[3], 0); const f = v3(Math.sin(E.en[3]), 0, Math.cos(E.en[3]));
      const pe = CO.pj('Engineer', E.en[0] + f.x * 0.85, E.en[2] + f.z * 0.85, 0), lu = CO.pj('Hero', E.en[0] - f.x * 1.6 + 0.5, E.en[2] - f.z * 1.6 + 0.4, 0); pe.escVis = 1.3;
      CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.5 }); CO.pose(lu, { k: 0.9, giro: Math.PI, tiembla: 0.6, lado: 0.6 });
      window.__A = { E, f, pe, lu, pp: [E.en[0] + f.x * 0.85, E.en[2] + f.z * 0.85] }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, E = A.E, f = A.f, yw = E.en[3]; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.mueve(A.lu, E.en[0] - f.x * 1.6 + 0.5, E.en[2] - f.z * 1.6 + 0.4, yw, 0, 0);
      const e0 = v3(E.en[0], E.en[1] + 0.66, E.en[2]), piso = v3(e0.x - f.x * 0.5, CO.piso(e0.x - f.x * 0.5, e0.z - f.z * 0.5) + 0.13, e0.z - f.z * 0.5);
      // (Pepe da dos pasos hasta la cámara caída —con la animación de caminar— y la levanta: sube del pasto a la altura de su
      // cara, se endereza y gira hacia él)
      const pk = Math.min(1, Math.max(0, (t - 103.4) / 1.6)), sk = pk * pk * (3 - 2 * pk), ka = Math.min(1, Math.max(0, (t - 102.0) / 1.2)), va = ka > 0 && ka < 1 ? 0.55 / 1.2 : 0;
      const ppx = A.pp[0] - f.x * 0.55 * ka, ppz = A.pp[1] - f.z * 0.55 * ka; CO.mueve(A.pe, ppx, ppz, CO.yaw(v3(ppx, 0, ppz), piso), -f.x * va, -f.z * va);
      // (termina enfrente de sus ojos, a medio metro, a la misma altura: del lado de donde estaba la cámara caída)
      const cara = CO.caraAlta(A.pe), hz = v3(piso.x - A.pe.pos.x, 0, piso.z - A.pe.pos.z).norm(), fin = vadd(cara, v3(hz.x * 0.55, -0.03, hz.z * 0.55));
      const p = v3(piso.x + (fin.x - piso.x) * sk, piso.y + (fin.y - piso.y) * sk + Math.sin(t * 13) * 0.004 * sk, piso.z + (fin.z - piso.z) * sk);
      const m0 = vadd(piso, v3(Math.sin(yw - 0.15), 0.03, Math.cos(yw - 0.15))), m = vadd(p, vadd(vscale(vsub(m0, piso).norm(), 1 - sk), vscale(vsub(cara, p).norm(), sk)));
      HZ.cam(p, m, Math.PI / 2 * 1.05 * (1 - sk) + Math.sin(t * 5) * 0.05 * sk, 0);
      if (t >= 105.0 && !A.luz) { A.luz = 1; luzTemporal(vadd(p, v3(0, 0.1, 0)), 1.6, [4.0, 4.0, 4.0], 3.5); }
      // (en el pasto, afuera, no se veían los pies que se acercan: una luz baja entre la cámara y Pepe)
      CO.sigue('pies', v3((piso.x + A.pe.pos.x) / 2, piso.y + 0.7, (piso.z + A.pe.pos.z) / 2), 2.4, t < 104.6 ? [1.5, 1.5, 1.5] : [0, 0, 0]);
      HZ.dano(0.85); TX.enviar();`,
  },
  // ---- 16. la cámara en la mano de Pepe: da la vuelta, despacio, alrededor de nico tirado en el pasto (donde cayó); Lucas
  // parado al lado. Al final la da vuelta y se mira a sí mismo ----
  f11: {
    t0: 108.0, t1: 115.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.85); LEJOS(); const G = CO.geo(), E = ${process.env.ED9 || 'null'} || { en: [G.s1[0], CO.piso(G.s1[0], G.s1[1]) + 0.79, G.s1[1], G.yw] };
      const f = v3(Math.sin(E.en[3]), 0, Math.cos(E.en[3])), sd = v3(f.z, 0, -f.x); CO.yo(E.en[0] - f.x * 8, E.en[2] - f.z * 8, E.en[3], 0);
      const ni = CO.pj('Astronauta', E.en[0], E.en[2], E.en[3]), lu = CO.pj('Hero', E.en[0] - f.x * 0.5 - sd.x * 1.1, E.en[2] - f.z * 0.5 - sd.z * 1.1, 0);
      CO.pose(lu, { k: 0.9, tiembla: 0.6, lado: 0.6 });
      const pe = CO.pj('Engineer', E.en[0] + f.x * 1.3, E.en[2] + f.z * 1.3, E.en[3] + Math.PI); pe.escVis = 1.3; CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.5 });
      window.__A = { E, f, sd, ni, lu, pe }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, E = A.E, f = A.f, sd = A.sd; TX.sinOSD = false; HZ.lampara(0); HZ.nv(true); HZ.dano(0.85);
      // (nico cae para atrás —como cayó con el golpe— en la previa: cuando empieza la toma ya está quieto en el pasto)
      if (!A.tumbo) { A.tumbo = 1; CO.tumbar(A.ni, v3(-f.x * 2, -1, -f.z * 2)); }
      const cx = E.en[0] - f.x * 0.7, cz = E.en[2] - f.z * 0.7, cy = CO.piso(cx, cz) + 0.25;   // (el cuerpo)
      const lx = E.en[0] - f.x * 0.5 - sd.x * 1.1, lz = E.en[2] - f.z * 0.5 - sd.z * 1.1; CO.mueve(A.lu, lx, lz, CO.yaw(v3(lx, 0, lz), v3(cx, 0, cz)), 0, 0);
      CO.sigue('cu', v3(cx + sd.x * 0.3, cy + 1.6, cz + sd.z * 0.3), 3.0, [2.2, 2.2, 2.2]);
      // (Pepe camina despacio —0,45 m/s— en un arco alrededor del cuerpo, a 1,4 m, con la cámara en la mano apuntándolo)
      const a0 = 0, a1 = 1.5, ka = Math.min(1, Math.max(0, (t - 108.4) / 4.4)), ang = a0 + (a1 - a0) * ka, va = ka > 0 && ka < 1 ? (a1 - a0) * 1.4 / 4.4 : 0;
      const rx = f.x * Math.cos(ang) + sd.x * Math.sin(ang), rz = f.z * Math.cos(ang) + sd.z * Math.sin(ang), tx = -f.x * Math.sin(ang) + sd.x * Math.cos(ang), tz = -f.z * Math.sin(ang) + sd.z * Math.cos(ang);
      const px = cx + rx * 1.4, pz = cz + rz * 1.4; CO.mueve(A.pe, px, pz, Math.atan2(-rx, -rz), tx * va, tz * va);
      const fp = 1.75, ph = (t - 108.4) * fp * Math.PI * 2, bob = va > 0 ? 0.022 * Math.cos(ph) : 0;
      const p = v3(px - rx * 0.45 + tx * 0.25, CO.piso(px, pz) + 1.5 + bob + Math.sin(t * 3.1) * 0.01, pz - rz * 0.45 + tz * 0.25);
      if (t < 113.4) HZ.cam(p, v3(cx, cy, cz), Math.sin(t * 3.1) * 0.06 + (va > 0 ? 0.03 * Math.sin(ph / 2) : 0), 0);
      if (t >= 113.4) { const cara = CO.caraAlta(A.pe), c = vadd(cara, v3(-rx * 0.52, -0.02, -rz * 0.52)); A.pe.yaw = CO.yaw(A.pe.pos, c); HZ.cam(c, cara, Math.sin(t * 4) * 0.08, 0); if (!A.luz) { A.luz = 1; luzTemporal(vadd(c, v3(0, 0.1, 0)), 1.6, [4.0, 4.0, 4.0], 2); } }
      TX.enviar();`,
  },
  // ---- 17. la cámara tirada en el pasto, donde cayó nico, mirando para arriba: los tres —nico también— enfrente; la luz
  // parpadea y cada vez están más cerca ----
  f12: {
    t0: 115.0, t1: 122.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.88); const G = CO.geo(), E = ${process.env.ED9 || 'null'} || { en: [G.s1[0], CO.piso(G.s1[0], G.s1[1]) + 0.79, G.s1[1], G.yw] };
      const g = v3(-Math.sin(E.en[3]), 0, -Math.cos(E.en[3])), sd = v3(g.z, 0, -g.x), K = v3(E.en[0], 0, E.en[2]);
      const pe = CO.pj('Engineer', K.x + g.x * 6, K.z + g.z * 6, 0), lu = CO.pj('Hero', K.x + g.x * 6.15 - sd.x * 0.75, K.z + g.z * 6.15 - sd.z * 0.75, 0), ni = CO.pj('Astronauta', K.x + g.x * 6.15 + sd.x * 0.75, K.z + g.z * 6.15 + sd.z * 0.75, 0); pe.escVis = 1.3;
      CO.pose(pe, { k: 0.8, brazos: 1.5, tiembla: 0.5 }); CO.pose(lu, { k: 0.6, tiembla: 0.6, lado: -0.7 }); CO.pose(ni, { k: 0.5, tiembla: 0.6, lado: 0.8 });
      window.__A = { pe, lu, ni, g, sd, K }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, g = A.g, sd = A.sd, K = A.K; TX.sinOSD = false; HZ.lampara(0);
      // (cuatro apagones; cuando vuelve la luz, los tres están más cerca: 6, 4,2, 3 y 2,4 m)
      const cortes = [116.3, 117.7, 119.1, 120.5], dist = [6.0, 4.2, 3.0, 2.4], fase = cortes.filter((c) => t >= c + 0.35).length, oscuro = cortes.some((c) => t >= c && t < c + 0.35);
      HZ.nv(!oscuro); const d = dist[Math.min(3, fase)], yy = Math.atan2(-g.x, -g.z);
      CO.mueve(A.pe, K.x + g.x * d, K.z + g.z * d, yy, 0, 0); CO.mueve(A.lu, K.x + g.x * (d + 0.15) - sd.x * 0.75, K.z + g.z * (d + 0.15) - sd.z * 0.75, yy, 0, 0); CO.mueve(A.ni, K.x + g.x * (d + 0.15) + sd.x * 0.75, K.z + g.z * (d + 0.15) + sd.z * 0.75, yy, 0, 0);
      CO.sigue('g', v3(K.x + g.x * (d - 0.9), CO.piso(K.x, K.z) + 1.8, K.z + g.z * (d - 0.9)), 3.0, oscuro ? [0, 0, 0] : [1.4, 1.4, 1.4]);
      // (la cámara, en el pasto: a 18 cm, torcida y mirando para arriba; el que la dejó ahí —el jugador— queda atrás)
      const p = v3(K.x, CO.piso(K.x, K.z) + 0.18, K.z), pt = 0.45, dd = v3(g.x * Math.cos(pt), Math.sin(pt), g.z * Math.cos(pt));
      HZ.cam(p, vadd(p, dd), 0.09, 0); CO.yo(K.x - g.x * 0.6, K.z - g.z * 0.6, Math.atan2(g.x, g.z), -0.3); ENT.y = 0;
      if (oscuro) TX.r(0, 0, 1, 1, [0, 0, 0]);
      HZ.dano(0.88); TX.enviar();`,
  },
  // ---- 18. la batería se muere (la misma cámara en el pasto; los tres a 2,4 m) ----
  f13: {
    t0: 122.0, t1: 128.0, mapa: 'RB_Construct', espera: 6000, antes: 40,
    preparar: COMUN2 + HUIDA + `DIA.hora = 1.5;` + VF2 + `HZ.dano(0.9); const G = CO.geo(), E = ${process.env.ED9 || 'null'} || { en: [G.s1[0], CO.piso(G.s1[0], G.s1[1]) + 0.79, G.s1[1], G.yw] };
      const g = v3(-Math.sin(E.en[3]), 0, -Math.cos(E.en[3])), sd = v3(g.z, 0, -g.x), K = v3(E.en[0], 0, E.en[2]), d = 2.4;
      const pe = CO.pj('Engineer', K.x + g.x * d, K.z + g.z * d, 0), lu = CO.pj('Hero', K.x + g.x * (d + 0.15) - sd.x * 0.75, K.z + g.z * (d + 0.15) - sd.z * 0.75, 0), ni = CO.pj('Astronauta', K.x + g.x * (d + 0.15) + sd.x * 0.75, K.z + g.z * (d + 0.15) + sd.z * 0.75, 0); pe.escVis = 1.3;
      CO.pose(pe, { k: 1.0, brazos: 1.5, tiembla: 0.7 }); CO.pose(lu, { k: 0.8, tiembla: 0.7, lado: -0.7 }); CO.pose(ni, { k: 0.7, tiembla: 0.7, lado: 0.8 });
      window.__A = { pe, lu, ni, g, sd, K, d }; return 1;`,
    listo: RELOJ,
    cada: `const t = __tr.t, A = window.__A, g = A.g, sd = A.sd, K = A.K, d = A.d, yy = Math.atan2(-g.x, -g.z); TX.sinOSD = false; HZ.lampara(0); HZ.nv(true);
      CO.mueve(A.pe, K.x + g.x * d, K.z + g.z * d, yy, 0, 0); CO.mueve(A.lu, K.x + g.x * (d + 0.15) - sd.x * 0.75, K.z + g.z * (d + 0.15) - sd.z * 0.75, yy, 0, 0); CO.mueve(A.ni, K.x + g.x * (d + 0.15) + sd.x * 0.75, K.z + g.z * (d + 0.15) + sd.z * 0.75, yy, 0, 0);
      CO.sigue('g', v3(K.x + g.x * (d - 0.9), CO.piso(K.x, K.z) + 1.8, K.z + g.z * (d - 0.9)), 2.6, [1.4, 1.4, 1.4]);
      const p = v3(K.x, CO.piso(K.x, K.z) + 0.18, K.z), pt = 0.45, dd = v3(g.x * Math.cos(pt), Math.sin(pt), g.z * Math.cos(pt));
      HZ.cam(p, vadd(p, dd), 0.09, 0); CO.yo(K.x - g.x * 0.6, K.z - g.z * 0.6, Math.atan2(g.x, g.z), -0.3); ENT.y = 0;
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
