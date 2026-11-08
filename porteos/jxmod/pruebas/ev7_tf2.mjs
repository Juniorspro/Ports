// Team Fortress 2 Weapon Pack (Workshop 949733637, el pack de armas de TF2 con más suscriptores; trae sus modelos, texturas
// y sonidos). Discord: «las animaciones no cargan», «el agarre de las armas está mal (se nota en el sniper y la minigun)»,
// «sniper: cuando apuntás la mira no te deja ver NADA, sólo es un cuadro blanco», «minigun: no tiene sonido al disparar y
// ni siquiera hace la animación de cuando está disparando». Mide:
//  1. minigun quieta: la animación de su vista mueve los huesos con el tiempo;
//  2. minigun: al apretar el gatillo la vista toma la secuencia de arrancar (spool_up, ACT_DEPLOY) y después la de disparar
//     (fire), y los huesos se mueven de verdad (el arma baja a la posición de tiro); al soltar, la de frenar (spool_down);
//  3. minigun: suena al disparar (el arranque, el disparo en bucle mientras se aprieta) y el bucle se corta al soltar;
//  4. una recarga de a un cartucho (escopeta de TF2) pasa por reload_start / reload_loop / reload_end;
//  5. sniper: con la mira puesta (y el zoom de SetFOV) la pantalla no queda blanca (< 10 % de píxeles blancos), el centro
//     de la lente muestra el mundo (con color: el pasto; ni negro ni blanco) y afuera de la lente queda negro;
//  5b. al sacar la mira (o cambiar de arma con la mira puesta) vuelve el campo visual de siempre y la mira se va;
//  6. tercera persona: el mango del modelo de mundo (minigun y sniper) está en la mano derecha (< 8 cm) y el caño apunta
//     adonde se mira (< 35°);
//  7. sin errores de Lua ni de JS.
// uso: node ev7_tf2.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]   (CELU=1: en la pantalla de un celular)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, D = '/tmp/claude-0/ev7'] = process.argv; fs.mkdirSync(D, { recursive: true });
const ID = '949733637';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const CELU = !!process.env.CELU;   // (CELU=1: la pantalla de un celular acostado)
const { b, p, err, ev } = await abrir(HTML, CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 30000 ? ok() : setTimeout(f, 20)); f(); }); 1`);
const espera = (s) => ev(`esperaJuego(${s}).then(() => 1)`);
const ins = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: '${ID}' }, new Uint8Array(await (await fetch('${G}/${ID}.gma')).arrayBuffer())); await A.listo; return { n: A.sweps.length, mini: A.sweps.includes('tf_weapon_minigun'), sniper: A.sweps.includes('tf_weapon_sniperrifle') }; })()`);
if (!ins.mini || !ins.sniper) { console.log('FALLA no se instaló el pack', JSON.stringify(ins)); await b.close(); process.exit(1); }
await ev(`(() => { audioIniciar(); window.__e0 = GMA.errores.length;
  // (lo que suena: cada sonar() y cada bucle nuevo, con su nombre)
  window.__son = []; const s0 = sonar, b0 = bucle; sonar = (n, ...a) => { __son.push({ t: TIEMPO.t, n, k: 'una' }); return s0(n, ...a); };
  bucle = (k, n, ...a) => { if (!AUD.loops.has(k)) __son.push({ t: TIEMPO.t, n, k: 'bucle', id: k }); return b0(k, n, ...a); };
  window.__clip = () => { const v = ARM.v; return v && v.clip ? (Object.keys(DATA.anPorNombre).find((k) => DATA.anPorNombre[k] === v.clip) || '').replace(/^gmv\\d+:/, '') : null; };
  // (los huesos de la vista en el mundo, relativos a la cámara)
  window.__huesos = () => { const v = ARM.v; if (!v || !v.md) return null; v.md.actualizar(); const o = []; for (let i = 1; i < v.md.W.length; i++) { const W = v.md.W[i]; o.push(W[12] - CAM.pos.x, W[13] - CAM.pos.y, W[14] - CAM.pos.z); } return o; };
  window.__dif = (a, b) => { let m = 0; if (a && b) for (let i = 0; i < Math.min(a.length, b.length); i += 3) m = Math.max(m, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2])); return m; };
  return 1; })()`);

// ---- 1-3. minigun en primera persona ----
await ev(`(async () => { gmaSpawnMenu('gmswep:tf_weapon_minigun'); JUG.pitch = 0; JUG.tercera = false; await esperaJuego(3); return 1; })()`);
const q0 = await ev(`({ h: __huesos(), clip: __clip() })`); await espera(0.4); const q1 = await ev(`({ h: __huesos(), clip: __clip() })`);
const dQuieta = await ev(`__dif(${JSON.stringify(q0.h)}, ${JSON.stringify(q1.h)})`);
ok('1. minigun quieta: su animación (idle) mueve los huesos de la vista con el tiempo', q0.clip === 'idle' && dQuieta > 0.0005, { clip: q0.clip, mueve_m: +dQuieta.toFixed(4) });
await p.screenshot({ path: D + '/minigun_quieta.png' });
// (apretando: la vista y lo que suena; la foto en pleno disparo; después se suelta)
await ev(`(async () => { __son.length = 0; window.__L = []; window.__h0 = __huesos(); ENT.disparo = true;
  for (let i = 0; i < 19; i++) { await esperaJuego(0.1); __L.push(__clip()); } window.__hT = __huesos(); return 1; })()`);
await p.screenshot({ path: D + '/minigun_disparando.png' });
const tiro = await ev(`(async () => { for (let i = 0; i < 5; i++) { await esperaJuego(0.1); __L.push(__clip()); }
  const hay = typeof GMSN !== 'undefined', bucles = hay ? [...GMSN.bucles.values()].map((B) => B.n) : [], audio = [...AUD.loops.keys()].filter((k) => /^gms/.test(k)).length;
  ENT.disparo = false; const S = [];
  for (let i = 0; i < 12; i++) { await esperaJuego(0.1); S.push(__clip()); }
  return { L: __L, S, mueve: __dif(__h0, __hT), son: __son.map((x) => x.k + ':' + x.n.replace(/^gm:/, '')), bucles, audio, quedan: hay ? [...GMSN.bucles.values()].map((B) => B.n) : [], audioDespues: [...AUD.loops.keys()].filter((k) => /^gms/.test(k)).length }; })()`);
const iUp = tiro.L.indexOf('spool_up'), iFire = tiro.L.indexOf('fire');
ok('2. minigun: al apretar arranca (spool_up), después dispara (fire) y el arma se mueve; al soltar frena (spool_down)', iUp >= 0 && iUp <= 2 && iFire > iUp && tiro.L.slice(-6).every((c) => c === 'fire') && tiro.S.includes('spool_down') && tiro.mueve > 0.02,
  { apretando: tiro.L.join(','), soltando: tiro.S.join(','), mueve_m: +tiro.mueve.toFixed(3) });
const suena = (n) => tiro.son.some((x) => x.endsWith(n));
ok('3. minigun: suena el arranque y el disparo en bucle mientras se aprieta, al soltar frena y el bucle se corta', suena('minigun_wind_up.wav') && tiro.son.includes('bucle:weapons/minigun_shoot.wav') && tiro.bucles.includes('gm:weapons/minigun_shoot.wav') && tiro.audio >= 1 && suena('minigun_wind_down.wav') && !tiro.quedan.length && !tiro.audioDespues,
  { sonidos: [...new Set(tiro.son)], bucles: tiro.bucles, quedan: tiro.quedan });

// ---- 4. una recarga de a un cartucho (la escopeta del pyro: reload_start → reload_loop → reload_end) ----
const rec = await ev(`(async () => { gmaSpawnMenu('gmswep:tf_weapon_shotgun_pyro'); JUG.pitch = 0; await esperaJuego(2);
  for (let i = 0; i < 4; i++) { ENT.disparo = true; await esperaJuego(0.1); ENT.disparo = false; await esperaJuego(0.7); }
  const L = []; GMA.pedirRecarga = true; for (let i = 0; i < 40; i++) { await esperaJuego(0.1); const c = __clip(); if (L[L.length - 1] !== c) L.push(c); }
  return L; })()`);
ok('4. escopeta de TF2: la recarga pasa por reload_start, reload_loop y reload_end', rec.includes('reload_start') && rec.includes('reload_loop') && rec.includes('reload_end') && rec.indexOf('reload_start') < rec.indexOf('reload_end'), rec);

// ---- 5. la mira del sniper ----
// (los píxeles de una captura: proporción de blancos, de negros y de «mundo» —con color: pasto, cielo— y el color medio,
// en cajas de la pantalla)
const pix = async (buf, cajas) => ev(`(async () => { const im = await createImageBitmap(await (await fetch('data:image/png;base64,${buf.toString('base64')}')).blob());
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  return ${JSON.stringify(cajas)}.map(([x0, y0, x1, y1]) => { const X0 = Math.round(x0 * im.width), Y0 = Math.round(y0 * im.height), w = Math.max(1, Math.round((x1 - x0) * im.width)), h = Math.max(1, Math.round((y1 - y0) * im.height)), d = g.getImageData(X0, Y0, w, h).data;
    let bl = 0, ne = 0, ve = 0, s = [0, 0, 0], n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; if (r > 235 && gg > 235 && bb > 235) bl++; if (r < 30 && gg < 30 && bb < 30) ne++; if (Math.max(r, gg, bb) - Math.min(r, gg, bb) > 30 && Math.max(r, gg, bb) > 40 && !(r > 235 && gg > 235 && bb > 235)) ve++; s[0] += r; s[1] += gg; s[2] += bb; }
    return { blancos: +(bl / n).toFixed(3), negros: +(ne / n).toFixed(3), mundo: +(ve / n).toFixed(3), medio: s.map((x) => Math.round(x / n)) }; }); })()`);
await ev(`(async () => { gmaSpawnMenu('gmswep:tf_weapon_sniperrifle'); JUG.pitch = 0.15; JUG.tercera = false; await esperaJuego(2.5); return 1; })()`);
await ev(`(async () => { ENT.disparo2 = true; await esperaJuego(0.15); ENT.disparo2 = false; await esperaJuego(1); return 1; })()`);
const fotoMira = await p.screenshot({ path: D + '/sniper_mira.png' });
const mira = await ev(`({ fov: +CAM.fov.toFixed(1), alfa: GMA.swep && GMA.swep.nw && GMA.swep.nw.get('ScopeAlpha') })`);
// (toda la pantalla; el centro de la lente; las bandas negras de los costados; la esquina de arriba a la izquierda de la mira)
const [todo, centro, costados, esquina] = await pix(fotoMira, [[0, 0, 1, 1], [0.44, 0.42, 0.56, 0.58], [0.0, 0.1, 0.12, 0.9], [0.14, 0.02, 0.2, 0.1]]);
ok('5. sniper con la mira puesta: hace zoom, no es un cuadro blanco, el centro muestra el mundo y afuera de la lente es negro', mira.alfa === 255 && mira.fov < 25 && todo.blancos < 0.1 && centro.blancos < 0.2 && centro.negros < 0.2 && centro.mundo > 0.6 && costados.negros > 0.9 && esquina.negros > 0.8,
  { mira, todo, centro, costados, esquina });
// (sacar la mira: vuelve el campo visual de siempre y la mira se va; con la mira puesta, cambiar de arma también la saca)
const sinMira = await ev(`(async () => { ENT.disparo2 = true; await esperaJuego(0.15); ENT.disparo2 = false; await esperaJuego(0.8); return +CAM.fov.toFixed(1); })()`);
const fotoSin = await p.screenshot({ path: D + '/sniper_sin_mira.png' });
const [centroSin] = await pix(fotoSin, [[0.44, 0.42, 0.56, 0.58]]);
const cambio = await ev(`(async () => { ENT.disparo2 = true; await esperaJuego(0.15); ENT.disparo2 = false; await esperaJuego(0.6); const f0 = +CAM.fov.toFixed(1);
  gmaSpawnMenu('gmswep:tf_weapon_smg'); await esperaJuego(1); const f1 = +CAM.fov.toFixed(1); gmaSpawnMenu('gmswep:tf_weapon_sniperrifle'); await esperaJuego(1); JUG.pitch = 0; return { conMira: f0, otraArma: f1, deVuelta: +CAM.fov.toFixed(1) }; })()`);
ok('5b. sniper: al sacar la mira vuelve el campo visual y se ve sin la mira; cambiar de arma con la mira puesta también vuelve', sinMira > 60 && centroSin.negros < 0.2 && centroSin.blancos < 0.2 && cambio.conMira < 25 && cambio.otraArma > 60 && cambio.deVuelta > 60, { sinMira, centroSin, cambio });

// ---- 6. tercera persona: el mango en la mano y el caño hacia adelante ----
const agarre = async (clase) => {
  await ev(`(async () => { gmaSpawnMenu('gmswep:${clase}'); JUG.pitch = 0; JUG.tercera = true; await esperaJuego(2.5); return 1; })()`);
  await p.screenshot({ path: D + '/tercera_' + clase + '.png' });
  return ev(`(() => { const w = GMA.armasJug.get('${clase}'), ruta = gmhRutaMundo(w), A = GMH.defs.get(ruta); if (!A || !w.mundoW) return { sin: ruta };
    const M = A.M, H = M.huesos, hb = Math.max(0, H.findIndex((h) => /r_hand$/i.test(h.n))), m = H[hb].p2b;
    // (el mango: el punto de la malla más cerca del hueso de la mano en la pose de enlace del .mdl, donde el autor la puso)
    const o = [0, 1, 2].map((c) => -(m[c] * m[3] + m[4 + c] * m[7] + m[8 + c] * m[11]));
    let k = 0, dk = 1e9; const V = M.v; for (let i = 0; i < V.n; i++) { const d = Math.hypot(V.pos[i * 3] - o[0], V.pos[i * 3 + 1] - o[1], V.pos[i * 3 + 2] - o[2]); if (d < dk) { dk = d; k = i; } }
    // (ese vértice tal como quedó en la malla que se dibuja —cuantizado en su binario— y en el mundo)
    const d = DATA.ms[A.md.A[0].m], bin = RBP.bins[d.k], dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), q = [0, 1, 2].map((c) => d.mn[c] + dv.getUint16(k * 14 + c * 2, true) / 65535 * d.sc[c]);
    A.md.actualizar(); const W = A.md.W[0], P = [0, 1, 2].map((r) => W[r] * q[0] + W[4 + r] * q[1] + W[8 + r] * q[2] + W[12 + r]);
    const mano = new Float32Array(16); gmhManoValve(JUG.cuerpo, 'Right', mano);
    const cm = Math.hypot(P[0] - mano[12], P[1] - mano[13], P[2] - mano[14]) * 100;
    // (el caño: del mango a la boca —adjunto 1, muzzle—, en el plano del piso, contra adonde mira la cámara)
    const B = gmhAdjuntoArma(w, 1); let ang = null; if (B) { const fx = B[12] - P[0], fz = B[14] - P[2], l = Math.hypot(fx, fz) || 1, cx = CAM.fwd.x, cz = CAM.fwd.z, lc = Math.hypot(cx, cz) || 1; ang = Math.acos(Math.max(-1, Math.min(1, (fx * cx + fz * cz) / (l * lc)))) * 180 / Math.PI; }
    return { ruta, cm: +cm.toFixed(1), caño: ang === null ? null : +ang.toFixed(1), vertice_cm: +(dk * 2.54).toFixed(1) }; })()`).then(async (r) => {
    // (y de costado, para mirarla)
    await ev(`DBG.cam = { p: v3(JUG.pos.x + Math.cos(JUG.yaw) * 2.2, JUG.pos.y + 0.6, JUG.pos.z - Math.sin(JUG.yaw) * 2.2), q: Quat.euler(JUG.yaw - Math.PI / 2, 0.1) }; 1`); await p.waitForTimeout(700);
    await p.screenshot({ path: D + '/tercera_' + clase + '_costado.png' }); await ev(`DBG.cam = null; 1`); return r; });
};
const a3m = await agarre('tf_weapon_minigun'), a3s = await agarre('tf_weapon_sniperrifle');
ok('6. tercera persona: el mango de la minigun y del sniper en la mano derecha (< 8 cm) y el caño hacia adonde se mira (< 35°)', [a3m, a3s].every((a) => a.cm < 8 && a.caño !== null && a.caño < 35), { minigun: a3m, sniper: a3s });
await ev(`(() => { JUG.tercera = false; return 1; })()`);

// ---- 7. errores ----
const errs = await ev(`GMA.errores.slice(window.__e0).slice(0, 5)`);
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket|CORS|net::|willReadFrequently/i.test(x));   // (willReadFrequently: un aviso de rendimiento de Chrome, no un error)
ok('7. sin errores de Lua ni de JS', !errs.length && !malos.length, { lua: errs, js: malos.slice(0, 3) });
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
