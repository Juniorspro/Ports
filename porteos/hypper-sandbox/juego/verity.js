// ---------------- Verity (mod oficial): una compañera con IA y con vida propia ----------------
// Una esfera amarilla que brilla, con cara (ojitos de punto y sonrisa grande, como la original), que tiene su propia
// cabeza: anda sola por ahí (pasea rodando, se acerca a mirar cosas, juega empujando pelotas, se duerme si se cansa,
// saluda a los que llegan), piensa en voz alta cada tanto y vuelve con vos cuando te movés o la llamás. Te escucha por
// el micrófono todo el tiempo pero sólo reacciona cuando le decís "Hey Verity" o "Che Verity" (en muchos idiomas);
// también se le escribe (tecla Y, su botón o "Verity, ..." en el chat). Contesta con su propia voz (la boca se mueve con
// el sonido, que sale de ella en 3D) en el idioma en que le hablaste, y hace cosas: bailar, rodar, rebotar, poner props,
// construir, cambiar la hora, poner música o un video, que hagas un emote, seguirte o quedarse quieta. Se acuerda de vos
// entre partidas (en este aparato). De noche se pone misteriosa (se apaga en su panel).
// El cerebro es un modelo de lenguaje gratis para todos: el de la tienda (Workers AI, con voz MeloTTS y un tope por
// día) y, si la tienda no responde, uno público sin clave (Pollinations); la voz de respaldo es la del navegador.
// En una sala todos la ven y la escuchan, y cualquiera le puede hablar (con la voz, si tiene el micrófono prendido, o
// por el chat), estando cerca.
const VER_R = 0.27, VER_TEX0 = 4900, VER_MAX = 8, VER_G_SUELO = 14;
const VER_ANIMS = ['', 'rodar', 'rebotar', 'bailar', 'girar', 'saltar', 'amor', 'mareo', 'dormir'];
const VER = { on: false, yo: null, rem: new Map(), modo: 'libre', tModo: 0, ancla: null,
  hist: [], mem: null, pensando: false, espera: null, sinCF: false, sinVozCF: false, tEv: 0, evT: {}, vivoAnt: true, autoAnt: false, oscAnt: false,
  obra: null, tareas: [], mios: [], luz: true, bt: null, pan: null, escucha: null, mic: false, oscura: 0, preguntas: new Map(), slots: [], ultCharla: -99,
  // su cabeza: lo que está haciendo, cuánta energía tiene, si se aburre, su humor y qué ya miró
  plan: null, mente: { energia: 1, aburre: 0, humor: 0.4, curios: 0.7, vistos: new Map(), saludados: new Map(), tPensar: 200 } };
const verHay = () => typeof NAT !== 'undefined' && NAT.mods.has('verity') && JUEGO.estado === 'juego' && !CREA.on;
const verS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const verLengua = () => (PREFS.lang && IDIOMAS_RB[PREFS.lang] ? PREFS.lang : 'en');
const VER_LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', id: 'id-ID', ms: 'ms-MY', fil: 'fil-PH', ja: 'ja-JP', th: 'th-TH', tr: 'tr-TR', ar: 'ar-SA', ru: 'ru-RU', uk: 'uk-UA', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN', ko: 'ko-KR' };
const verLocale = (l) => { const n = (navigator.languages || []).find((x) => String(x).toLowerCase().startsWith(l + '-')); return n || VER_LOCALE[l] || 'en-US'; };
const verSinEmoji = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}*_#~`]/gu, '').replace(/\s+/g, ' ').trim();
// de noche (20:30 a 5:00) se pone misteriosa, si está prendido
const verNoche = () => PREFS.verNoche !== false && (DIA.hora >= 20.5 || DIA.hora < 5);
// en qué idioma está una frase (para elegir la voz): por la escritura y, en las latinas, por palabras comunes
const VER_PAL = { es: 'que de el la los las y es un una por para con no sí qué cómo está estás soy eres muy pero hola', en: 'the you and is are to of it i what how this that my your hello hey', pt: 'você não é um uma com para que de do da está estou muito olá oi', fr: 'le la les est et je tu vous un une pas que de du ça bonjour salut', de: 'der die das und ist ich du nicht ein eine was wie hallo', id: 'dan yang ini itu aku kamu tidak apa ada saya halo', ms: 'dan yang ini itu saya awak tidak apa ada', tr: 've bir bu ben sen değil ne nasıl merhaba', fil: 'ang ng mga ako ka hindi ano sa kumusta' };
function verIdiomaDe(t, l) {
  t = String(t || '');
  if (/[぀-ヿ]/.test(t)) return 'ja'; if (/[가-힯]/.test(t)) return 'ko'; if (/[一-鿿]/.test(t)) return 'zh';
  if (/[฀-๿]/.test(t)) return 'th'; if (/[؀-ۿ]/.test(t)) return 'ar'; if (/[Ѐ-ӿ]/.test(t)) return /[іїєґ]/i.test(t) ? 'uk' : 'ru';
  const w = t.toLowerCase().match(/[a-zà-ÿçğışöüñ]+/g) || []; let mejor = l, n = 1;
  for (const k in VER_PAL) { const S = VER_PAL[k].split(' '); let c = 0; for (const x of w) if (S.includes(x)) c++; if (c > n || (c === n && k === l)) { n = c; mejor = k; } }
  return mejor;
}

// ---------------- cada Verity (la mía y las de los demás): posición, giro, cara, voz y globo ----------------
function verInst(dueno) {
  const usados = new Set([VER.yo, ...VER.rem.values()].filter(Boolean).map((I) => I.slot));
  let slot = 0; while (usados.has(slot) && slot < VER_MAX - 1) slot++;
  return { dueno, slot, pos: v3(), meta: v3(), vel: v3(), q: new Quat(), qM: new Quat(), yaw: 0, yawM: 0, emo: 'feliz', emoT: 0, boca: 0, parp: 0, tParp: 2 + Math.random() * 3, glitch: 0, tGlitch: 6,
    noche: 0, luz: true, voz: null, nav: false, pulso: 0, falsa: 0, burb: null, burbTx: '', burbT0: 0, burbDur: 0, burbHasta: 0, pensando: false, t: TIEMPO.t,
    apl: 0, aplV: 0, anim: '', animT: 0, animT0: 0, suelo: false, piso: null, rueda: false, mira: null, gx: 0, gy: 0, nombre: '' };
}
// el modelo: una esfera lisa de muchas caras (brillo de laca y luz propia) y, adelante, un casquete apenas más grande
// con la cara (textura de un canvas que se redibuja cuando cambia el gesto, la boca, la mirada o el parpadeo). La cara
// va sin luz y con transparencia; alrededor, un aura suave
let VER_G = null;
function verGeo() {
  if (VER_G && R.mallas[VER_G.cuerpo] && R.mallas[VER_G.cara]) return VER_G;
  const B = geoNuevo(), C = geoNuevo(), tri = (M, a, b, c) => {
    const P = M.P, ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * (P[a * 3] + P[b * 3] + P[c * 3]) + ny * (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) + nz * (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) >= 0) M.I.push(a, b, c); else M.I.push(a, c, b);
  };
  const NA = 44, NB = 28;
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NA; j++) {
    const th = (i / NB) * Math.PI, ph = (j / NA) * 2 * Math.PI, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    B.P.push(x, y, z); B.N.push(x, y, z); B.U.push(j / NA, i / NB);
  }
  for (let i = 0; i < NB; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; if (i > 0) tri(B, a, b, a + 1); if (i < NB - 1) tri(B, a + 1, b, b + 1); }
  // el casquete: hasta 78° del frente (+Z), con la imagen proyectada de frente (lo que se ve mirándola a la cara)
  const NT = 16, NP = 44, TM = 1.36, k = 1.012, sm = Math.sin(TM);
  C.P.push(0, 0, k); C.N.push(0, 0, 1); C.U.push(0.5, 0.5);
  for (let t = 1; t <= NT; t++) for (let p = 0; p < NP; p++) {
    const th = (t / NT) * TM, ph = (p / NP) * 2 * Math.PI, x = Math.sin(th) * Math.cos(ph), y = Math.sin(th) * Math.sin(ph), z = Math.cos(th);
    C.P.push(x * k, y * k, z * k); C.N.push(x, y, z); C.U.push(0.5 + 0.5 * x / sm, 0.5 + 0.5 * y / sm);
  }
  for (let p = 0; p < NP; p++) tri(C, 0, 1 + p, 1 + ((p + 1) % NP));
  for (let t = 1; t < NT; t++) for (let p = 0; p < NP; p++) { const a = 1 + (t - 1) * NP + p, b = 1 + (t - 1) * NP + ((p + 1) % NP), c = a + NP, d = b + NP; tri(C, a, c, b); tri(C, b, c, d); }
  const cuerpo = mallaPropia(B), cara = mallaPropia(C);
  return (VER_G = { cuerpo, cara, mC: matPropio('verCuerpo', [1, 0.8, 0.12], { pbr: [0.18, 0, 0.06], em: [0.6, 0.42, 0.04] }), mH: verMatHaz() });
}
function verMatHaz() { const id = matPropio('verHaz', [1, 0.85, 0.3], { pbr: [0.5, 0, 0.04] }), m = R.mats[id]; m.blend = true; m.add = true; m.unlit = true; m.sombra = false; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; return id; }
// la textura de la cara de cada Verity (su lugar en R.tex se rehace si se borran las texturas al cambiar la calidad)
function verCaraTex(I) {
  let S = VER.slots[I.slot];
  if (!S) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const mat = matPropio('verCara' + I.slot, [1, 1, 1], { pbr: [0.5, 0, 0.04] }), m = R.mats[mat];
    m.blend = true; m.unlit = true; m.sombra = false; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; m.tex = DATA.tx.length + VER_TEX0 + I.slot;
    S = VER.slots[I.slot] = { cv, cx: cv.getContext('2d', { willReadFrequently: true }), mat, k: m.tex, clave: '' };
  }
  const gl = R.gl;
  if (!R.tex[S.k]) { const tx = gl.createTexture(); R.tex[S.k] = { gl: tx }; S.clave = ''; }
  // (en 256 y, sólo muy de cerca, en 512; menos veces por segundo cuanto más lejos: subirla es lo que más cuesta)
  const d = I.pos.distTo(CAM.pos), grande = d < 1.2, hz = d < 6 ? 15 : d < 15 ? 10 : 5; // (a 1,7 m la cara ocupa ~170 px: 256 alcanza)
  if (!grande && !S.cv2) { S.cv2 = document.createElement('canvas'); S.cv2.width = S.cv2.height = 256; S.cx2 = S.cv2.getContext('2d', { willReadFrequently: true }); }
  const clave = (grande ? 'G' : 'C') + I.emo + '|' + Math.round(I.boca * 7) + '|' + (I.parp > 0.5 ? 1 : 0) + '|' + (I.glitch > 0 ? Math.floor(TIEMPO.t * 14) : 0) + '|' + (I.noche > 0.5 ? 1 : 0) + '|' + Math.round(I.gx * 4) + ',' + Math.round(I.gy * 4) + '|' + (I.emo === 'mareada' || I.emo === 'emocionada' || I.emo === 'enamorada' ? Math.floor(TIEMPO.t * 8) : 0);
  if (clave !== S.clave && (!S.tSub || TIEMPO.t - S.tSub > 1 / hz || S.clave === '')) {
    const cv = grande ? S.cv : S.cv2, cx = grande ? S.cx : S.cx2;
    S.clave = clave; S.tSub = TIEMPO.t; cx.setTransform(grande ? 2 : 1, 0, 0, grande ? 2 : 1, 0, 0); verCara(cx, I);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.tex[S.k].gl); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R.texAct = null; // (la próxima pieza vuelve a atar su textura)
  }
  return S.mat;
}
// la cara (se dibuja en 256×256 y se escala a 512; el borde del círculo es el borde del casquete): ojitos de punto que
// miran hacia donde mira ella, la boca según el gesto y lo que suena, y los gestos especiales (corazones, espirales,
// estrellas, dormida)
function verCara(x, I) {
  const W = 256, c = 128, osc = I.emo === 'siniestra' || (I.glitch > 0 && Math.random() < 0.6);
  const tinta = osc ? '#060203' : '#2b1c04', b = clamp(I.boca, 0, 1), cerr = I.parp > 0.5, gx = I.gx * 9, gy = I.gy * 6, t = TIEMPO.t;
  x.clearRect(0, 0, W, W); x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  if (I.glitch > 0) x.translate((Math.random() - 0.5) * 14, 0);
  x.fillStyle = tinta; x.strokeStyle = tinta;
  const e = osc ? 'siniestra' : I.emo, ex = (s) => c + s * 30 + gx, ey = c - 16 + gy;
  const ojo = (s, rx, ry, dy) => { x.beginPath(); x.ellipse(ex(s), ey + (dy || 0), rx, cerr ? 1.8 : ry, 0, 0, 7); x.fill(); };
  const brillito = (s, dy) => { if (cerr || osc) return; x.fillStyle = '#fff'; x.beginPath(); x.arc(ex(s) + 3, ey - 6 + (dy || 0), 3.4, 0, 7); x.fill(); x.fillStyle = tinta; };
  const arco = (s, abajo) => { x.lineWidth = 7; x.beginPath(); if (abajo) x.arc(ex(s), ey + 4, 10, Math.PI * 1.1, Math.PI * 1.9); else x.arc(ex(s), ey - 6, 10, Math.PI * 0.1, Math.PI * 0.9); x.stroke(); };
  const corazon = (cx2, cy2, s) => { x.beginPath(); x.moveTo(cx2, cy2 + 6 * s); x.bezierCurveTo(cx2 - 13 * s, cy2 - 3 * s, cx2 - 7 * s, cy2 - 14 * s, cx2, cy2 - 6 * s); x.bezierCurveTo(cx2 + 7 * s, cy2 - 14 * s, cx2 + 13 * s, cy2 - 3 * s, cx2, cy2 + 6 * s); x.fill(); };
  const estrella = (cx2, cy2, r, rot) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx2 + Math.sin(a) * rr, cy2 - Math.cos(a) * rr); } x.closePath(); x.fill(); };
  // ojos
  if (e === 'risa') { arco(-1, true); arco(1, true); }
  else if (e === 'dormida') { x.lineWidth = 6; for (const s of [-1, 1]) { x.beginPath(); x.arc(ex(s), ey - 4, 10, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); } }
  else if (e === 'picara') { ojo(-1, 9, 15); brillito(-1); x.lineWidth = 6.5; x.beginPath(); x.moveTo(ex(1) - 10, ey); x.lineTo(ex(1) + 10, ey - 2); x.stroke(); }
  else if (e === 'enamorada') { x.fillStyle = '#e8304f'; const s = 1.15 + 0.12 * Math.sin(t * 9); corazon(ex(-1), ey + 2, s); corazon(ex(1), ey + 2, s); x.fillStyle = tinta; }
  else if (e === 'emocionada') { const r = 13 + Math.sin(t * 10) * 1.5; estrella(ex(-1), ey, r, t * 2); estrella(ex(1), ey, r, -t * 2); }
  else if (e === 'mareada') { x.lineWidth = 3.6; for (const s of [-1, 1]) { x.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.42 + t * 7 * s, r = i * 0.36; x.lineTo(ex(s) + Math.cos(a) * r, ey + Math.sin(a) * r); } x.stroke(); } }
  else if (e === 'sorpresa' || e === 'miedo') { ojo(-1, 11, 17, -2); ojo(1, 11, 17, -2); brillito(-1, -2); brillito(1, -2); }
  else if (e === 'siniestra') {
    // ojos huecos negros con un puntito, cada tanto se estiran
    const k = 1 + (I.glitch > 0 ? Math.random() * 0.5 : 0);
    x.beginPath(); x.ellipse(c - 30, c - 16, 13 * k, 19, -0.15, 0, 7); x.ellipse(c + 30, c - 16, 13 * k, 19, 0.15, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,240,230,.95)'; x.beginPath(); x.arc(c - 28, c - 14, 2.4, 0, 7); x.arc(c + 28, c - 14, 2.4, 0, 7); x.fill(); x.fillStyle = tinta;
  } else { ojo(-1, 9, 15); ojo(1, 9, 15); brillito(-1); brillito(1); }
  // cejas
  x.lineWidth = 5;
  if (e === 'enojada') { x.beginPath(); x.moveTo(c - 44, c - 42); x.lineTo(c - 18, c - 33); x.moveTo(c + 44, c - 42); x.lineTo(c + 18, c - 33); x.stroke(); }
  if (e === 'triste' || e === 'miedo') { x.beginPath(); x.moveTo(c - 42, c - 34); x.lineTo(c - 20, c - 42); x.moveTo(c + 42, c - 34); x.lineTo(c + 20, c - 42); x.stroke(); }
  if (e === 'pensando') { x.beginPath(); x.moveTo(c + 18, c - 44); x.lineTo(c + 42, c - 40); x.stroke(); }
  // boca
  const ab = 3 + b * 22, mx = c + gx * 0.4;
  x.lineWidth = 6;
  if (e === 'siniestra') {
    // sonrisa enorme de lado a lado, con dientes finos arriba y abajo
    const cb = 74 + b * 22, ca = 30, lab = (u, k) => [c - 64 + 128 * u, c + 12 + 2 * u * (1 - u) * (k - 12)];
    x.beginPath(); x.moveTo(c - 64, c + 12); x.quadraticCurveTo(c, c + cb, c + 64, c + 12); x.quadraticCurveTo(c, c + ca, c - 64, c + 12); x.fill();
    x.fillStyle = 'rgba(255,244,232,.95)'; x.beginPath();
    for (let i = 0; i < 8; i++) { const t0 = 0.12 + i * 0.095, t1 = t0 + 0.095, [x0, y0] = lab(t0, ca), [x1, y1] = lab(t1, ca), [xm] = lab((t0 + t1) / 2, ca), hb = lab((t0 + t1) / 2, cb)[1], ym = (y0 + y1) / 2; x.moveTo(x0, y0 - 1.5); x.lineTo(x1, y1 - 1.5); x.lineTo(xm, ym + (hb - ym) * 0.62); }
    for (let i = 0; i < 6; i++) { const t0 = 0.22 + i * 0.095, t1 = t0 + 0.095, [x0, y0] = lab(t0, cb), [x1, y1] = lab(t1, cb), [xm] = lab((t0 + t1) / 2, cb), ym = (y0 + y1) / 2; x.moveTo(x0, y0 * 0.5 + (c + 12) * 0.5 + 1); x.lineTo(x1, y1 * 0.5 + (c + 12) * 0.5 + 1); x.lineTo(xm, ym * 0.5 + (c + 12) * 0.5 - 12); }
    x.fill(); x.fillStyle = tinta;
  } else if (e === 'sorpresa' || e === 'miedo') { x.beginPath(); x.ellipse(mx, c + 34, 9 + b * 5, 11 + b * 9, 0, 0, 7); x.fill(); }
  else if (e === 'dormida') { x.beginPath(); x.ellipse(mx, c + 32, 6, 4 + 2 * Math.sin(t * 2), 0, 0, 7); x.fill(); }
  else if (e === 'mareada') { x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 24; i++) x.lineTo(mx - 24 + i * 2, c + 32 + Math.sin(i * 0.8 + t * 6) * 4); x.stroke(); }
  else if (b > 0.12 || e === 'risa' || e === 'feliz' || e === 'enamorada' || e === 'emocionada') {
    // la sonrisa grande (abierta en D, más cuanto más fuerte habla)
    const grande = e === 'feliz' || e === 'enamorada' || e === 'emocionada' || e === 'risa', ancho = grande ? 30 + b * 4 : 22 + b * 4;
    const alto = e === 'risa' || e === 'emocionada' ? Math.max(ab, 15) : e === 'feliz' || e === 'enamorada' ? Math.max(ab, 9) : ab;
    x.beginPath();
    if (e === 'triste' || e === 'enojada') x.ellipse(mx, c + 32, ancho * 0.8, alto * 0.7, 0, 0, 7);
    else { x.moveTo(mx - ancho, c + 22); x.quadraticCurveTo(mx, c + 22 + alto * 2.1, mx + ancho, c + 22); x.quadraticCurveTo(mx, c + 22 + alto * 0.3, mx - ancho, c + 22); }
    x.fill();
    if (alto > 9 && e !== 'triste' && e !== 'enojada') { x.fillStyle = '#c4433a'; x.beginPath(); x.ellipse(mx, c + 22 + alto * 0.95, ancho * 0.42, alto * 0.3, 0, 0, 7); x.fill(); x.fillStyle = tinta; }
  } else if (e === 'triste') { x.beginPath(); x.arc(mx, c + 44, 18, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
  else if (e === 'enojada' || e === 'pensando') { x.beginPath(); x.moveTo(mx - 14, c + 30); x.lineTo(mx + (e === 'pensando' ? 10 : 14), c + (e === 'pensando' ? 26 : 30)); x.stroke(); }
  else if (e === 'picara') { x.beginPath(); x.moveTo(mx - 18, c + 26); x.quadraticCurveTo(mx + 4, c + 40, mx + 24, c + 22); x.stroke(); }
  else { x.beginPath(); x.arc(mx, c + 14, 18, Math.PI * 0.3, Math.PI * 0.7); x.stroke(); }
  // mejillas
  if (!osc && (e === 'feliz' || e === 'risa' || e === 'picara' || e === 'enamorada' || e === 'emocionada')) { x.fillStyle = e === 'enamorada' ? 'rgba(255,80,110,.45)' : 'rgba(255,120,90,.35)'; x.beginPath(); x.ellipse(c - 50, c + 10, 11, 7, 0, 0, 7); x.ellipse(c + 50, c + 10, 11, 7, 0, 0, 7); x.fill(); }
  x.restore();
  // la falla: franjas corridas
  if (I.glitch > 0) { const N = x.canvas.width, k = N / 256; x.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 4; i++) { const y = Math.random() * N, h = (4 + Math.random() * 16) * k, d = (Math.random() - 0.5) * 30 * k; const im = x.getImageData(0, y, N, h); x.clearRect(0, y, N, h); x.putImageData(im, d, y); } }
}

// ---------------- memoria, aparecer, irse y el botón ----------------
function verMemoria() {
  if (VER.mem) return VER.mem;
  let m = null; try { m = JSON.parse(localStorage.getItem('rb_verity') || 'null'); } catch (e) {}
  if (!m || typeof m !== 'object' || !Array.isArray(m.d)) m = { d: [], n: 0, t0: Date.now() };
  m.d = m.d.filter((s) => typeof s === 'string').slice(-24);
  if (Array.isArray(m.h)) VER.hist = m.h.filter((h) => Array.isArray(h) && (h[0] === 'u' || h[0] === 'v') && typeof h[1] === 'string').map((h) => h.slice(0, 3)).slice(-8);
  return (VER.mem = m);
}
function verGuardar() { try { const m = VER.mem; m.h = VER.hist.slice(-8); localStorage.setItem('rb_verity', JSON.stringify(m)); } catch (e) {} }
function verRecordar(f) {
  const m = verMemoria(), s = rbTexto(f, 100), k = s.toLowerCase(); if (s.length < 5) return;
  if (m.d.some((x) => x.toLowerCase() === k || x.toLowerCase().includes(k) || k.includes(x.toLowerCase()))) return;
  m.d.push(s); if (m.d.length > 24) m.d.shift(); verGuardar();
}
function verAparecer() {
  verMemoria(); VER.on = true; VER.yo = verInst('yo'); VER.modo = 'libre'; VER.plan = null; VER.luz = true;
  const I = VER.yo, m = verMeta(); I.pos.copy(vadd(m, v3(0, 2.5, 0))); I.vel.set(0, -2, 0); I.emo = 'feliz'; I.yaw = I.yawM = Math.atan2(CAM.pos.x - m.x, CAM.pos.z - m.z); I.q = Quat.axis(0, 1, 0, I.yaw);
  VER.tEv = 0; VER.vivoAnt = JUG.vivo; VER.autoAnt = !!JUG.vehiculo; VER.oscAnt = verNoche(); VER.ultCharla = TIEMPO.t;
  VER.mente.tPensar = 150 + Math.random() * 120; verPlan('acompañar', 12);
  verBoton().style.display = '';
  setTimeout(() => { if (VER.on) verPreguntar('', 'hola'); }, 1400);
  if (PREFS.verOido !== false && !VER.avisoOido) { VER.avisoOido = true; setTimeout(() => { if (VER.on) aviso(T('ver.oidoAviso'), 4); }, 5000); }
}
function verIrse() {
  const I = VER.yo; VER.on = false;
  if (I) { verCallar(I); if (I.burb) I.burb.remove(); }
  VER.yo = null; VER.obra = null; VER.tareas.length = 0; VER.oscura = 0; VER.plan = null;
  if (VER.bt) VER.bt.style.display = 'none'; verPanel(false); verEscuchar(false);
  if (RED.on) RED.ultE = 0;
}
function verFin() { if (VER.on) verIrse(); for (const I of VER.rem.values()) { verCallar(I); if (I.burb) I.burb.remove(); } VER.rem.clear(); oidoParar(); }
// el botón: tocar abre el panel; mantener apretado escucha (micrófono) hasta soltar
function verBoton() {
  let b = VER.bt;
  if (!b) {
    b = VER.bt = document.createElement('div'); b.id = 'verBt'; b.className = 'verBt';
    b.innerHTML = `${icoHTML('ico:verity')}<small>(Y)</small><i class="verOreja">${glifo('micro')}</i>`;
    let largo = null;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioIniciar(); largo = setTimeout(() => { largo = null; VER.mic = true; verEscuchar(true); }, 380); });
    const su = (e) => { e.preventDefault(); e.stopPropagation(); if (largo) { clearTimeout(largo); largo = null; verPanel(!(VER.pan && !VER.pan.classList.contains('oc'))); } else if (VER.mic) { VER.mic = false; verEscuchar(false); } };
    b.addEventListener('pointerup', su); b.addEventListener('pointercancel', su);
    $('hud').appendChild(b);
  }
  return b;
}
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyY' || e.repeat || !VER.on || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  if (UI.abierto && UI.abierto !== 'verity') return;
  e.preventDefault(); audioIniciar(); verPanel(UI.abierto !== 'verity');
});
// el panel: charla, escribir, micrófono, animaciones y opciones (voz, oído, noche, olvidar)
const VER_BOTONES = [['rodar', 'girar'], ['rebotar', 'salto'], ['bailar', 'musica'], ['girar', 'girar'], ['saltar', 'subir'], ['amor', 'corazon'], ['mareo', 'dado'], ['dormir', 'estrella']];
function verPanel(si) {
  let p = VER.pan;
  if (!si) { if (p && !p.classList.contains('oc')) { p.classList.add('oc'); if (UI.abierto === 'verity') UI.abierto = null; } return; }
  if (!VER.on) return;
  if (!p) {
    p = VER.pan = document.createElement('div'); p.id = 'verPan'; p.className = 'verPan oc';
    p.innerHTML = `<div class="verCab">${icoHTML('ico:verity')}<b>Verity</b><span class="verEst"></span><button class="verX" data-v="cerrar">${glifo('no')}</button></div>
      <div class="verLog" dir="auto"></div>
      <div class="verAnims">${VER_BOTONES.map(([a, g]) => `<button data-v="anim:${a}">${glifo(g)}<span></span></button>`).join('')}</div>
      <div class="verFila"><input id="verIn" maxlength="200" autocomplete="off"><button class="verMic" data-v="mic">${glifo('micro')}</button><button class="verEnv" data-v="enviar">${glifo('adelante')}</button></div>
      <div class="verOpc"><label><input type="checkbox" data-v="voz"><span></span></label><label><input type="checkbox" data-v="oido"><span></span></label><label><input type="checkbox" data-v="noche"><span></span></label><button data-v="olvidar">${glifo('basura')}<span></span></button></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]'); if (!b) return; const a = b.dataset.v;
      if (a === 'cerrar') verPanel(false);
      else if (a === 'enviar') verEnviarPanel();
      else if (a === 'mic') { audioIniciar(); VER.mic = !VER.escucha; verEscuchar(!VER.escucha); }
      else if (a.startsWith('anim:')) verAnim(VER.yo, a.slice(5));
      else if (a === 'olvidar') { VER.mem = { d: [], n: 0, t0: Date.now() }; VER.hist = []; verGuardar(); verLog(); aviso(T('ver.olvidado'), 2); }
    });
    p.addEventListener('change', (ev) => {
      const a = ev.target.dataset.v, v = ev.target.checked;
      if (a === 'voz') PREFS.verVoz = v; if (a === 'noche') PREFS.verNoche = v; if (a === 'oido') { PREFS.verOido = v; OIDO.negado = false; if (!v) oidoParar(); }
      guardarPrefs();
    });
    $('verIn').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); verEnviarPanel(); } if (ev.key === 'Escape') verPanel(false); ev.stopPropagation(); });
  }
  $('verIn').placeholder = T('ver.escribi');
  p.querySelector('[data-v=voz]').checked = PREFS.verVoz !== false; p.querySelector('[data-v=noche]').checked = PREFS.verNoche !== false; p.querySelector('[data-v=oido]').checked = PREFS.verOido !== false;
  const sp = p.querySelectorAll('.verOpc span'); sp[0].textContent = T('ver.voz'); sp[1].textContent = T('ver.oido'); sp[2].textContent = T('ver.noche'); sp[3].textContent = T('ver.olvidar');
  p.querySelectorAll('.verAnims button').forEach((b) => { b.querySelector('span').textContent = T('ver.a.' + b.dataset.v.slice(5)); });
  p.classList.remove('oc'); UI.abierto = 'verity'; soltarPuntero(); verLog();
  if (!document.body.classList.contains('tactil')) setTimeout(() => $('verIn').focus(), 30);
}
function verEnviarPanel() { const i = $('verIn'), t = i.value.trim(); i.value = ''; if (t) verPreguntar(t); }
function verLog() {
  if (!VER.pan) return; const L = VER.pan.querySelector('.verLog');
  L.innerHTML = VER.hist.slice(-8).map((h) => `<p class="${h[0] === 'u' ? 'vU' : 'vV'}" dir="auto">${esc(h[1])}</p>`).join('') + (VER.pensando ? '<p class="vV verPiensa"><i></i><i></i><i></i></p>' : '');
  L.scrollTop = L.scrollHeight;
  const e = VER.pan.querySelector('.verEst'); e.textContent = VER.escucha ? T('ver.escucha') : '';
  VER.pan.querySelector('.verMic').classList.toggle('on', !!VER.escucha);
}
// el chat: "Verity, ..." le habla a la tuya o (si no tenés) a la que esté cerca
function verChat(t) {
  const m = /^\s*@?verity\b[\s,:;!.¡¿?-]*(.*)$/i.exec(t || ''); if (!m) return false;
  verHablarle(m[1].trim() || '…');
  return true;
}
function verHablarle(q) {
  if (VER.on) { verPreguntar(q); return; }
  const id = verRemotaCerca(25);
  if (id && RED.on) publicar('a', { k: 'verq', to: id, t: q.slice(0, 200), n: PREFS.nombre }); else aviso(T('ver.lejos'), 2);
}
function verRemotaCerca(d) { let mejor = null, dm = d; for (const [id, I] of VER.rem) { const x = I.pos.distTo(JUG.pos); if (x < dm) { dm = x; mejor = id; } } return mejor; }

// ---------------- escuchar apretando (reconocimiento de voz del navegador) ----------------
function verEscuchar(si) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!si) { if (VER.escucha) try { VER.escucha.stop(); } catch (e) {} return; }
  if (!SR) { aviso(T('ver.sinMic'), 2.5); return; }
  if (VER.escucha || !VER.on) return;
  oidoParar(true); // (el navegador escucha de a uno: el oído espera)
  const r = new SR(); r.lang = verLocale(verLengua()); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let fin = '', parcial = '';
  r.onresult = (e) => { parcial = ''; for (const x of e.results) { if (x.isFinal) fin += x[0].transcript; else parcial += x[0].transcript; } const i = $('verIn'); if (i) i.value = (fin + parcial).trim(); verGlobo(VER.yo, (fin + parcial).trim() + '…', 0, true); };
  r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') aviso(T('ver.sinMic'), 2.5); };
  r.onend = () => {
    VER.escucha = null; OIDO.pausa = false; verLog(); if (VER.bt) VER.bt.classList.remove('oye');
    const t = (fin || parcial).trim(); if (t) { const i = $('verIn'); if (i) i.value = ''; verPreguntar(t); } else if (VER.yo) verGlobo(VER.yo, '', 0);
  };
  VER.escucha = r; if (VER.bt) VER.bt.classList.add('oye');
  try { r.start(); verGlobo(VER.yo, T('ver.escucha'), 0, true); } catch (e) { VER.escucha = null; OIDO.pausa = false; }
  verLog();
}

// ---------------- el oído: escucha siempre, pero sólo le hace caso a "Hey Verity" / "Che Verity" ----------------
// (también a la de otro jugador, si tenés el micrófono de la sala prendido y estás cerca). El reconocimiento de voz del
// navegador corre seguido y se reinicia solo; lo que no empieza con su nombre se descarta en el momento.
const OIDO = { r: null, pausa: false, negado: false, fallos: 0, despierta: 0, tReini: 0 };
const VER_HEY = 'hey hei hi hay ey ei eh oye oi oie che ok okay hola hello hallo he salut ciao yo psst ola hai halo hoi merhaba эй ей привет гей агов ねえ ヘイ へい 嘿 喂 헤이 야 เฮ้ เฮ ยา يا هاي'.split(' ');
const VER_NOMBRES = ['ベリティ', 'ヴェリティ', 'べりてぃ', '维瑞蒂', '薇瑞蒂', '베리티', 'เวริตี้', 'เวอริตี้', 'فيريتي', 'فريتي', 'верити', 'вериті', 'веріті'];
const verNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function verEsNombre(w, estricto) {
  w = verNorm(w).replace(/[^\p{L}]/gu, ''); if (!w) return false;
  if (VER_NOMBRES.some((n) => w.includes(verNorm(n)))) return true;
  if (!/^[vbw]/.test(w) || w.length < 5 || w.length > 9) return false;
  // distancia de edición con "verity" (lo que entiende el navegador: veriti, berity, verite, verety...)
  const a = w.replace(/^[bw]/, 'v'), b = 'verity', d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] || (b[j - 1] === 'y' && (a[i - 1] === 'i' || a[i - 1] === 'e')) ? 0 : 1));
  return d[a.length][b.length] <= (estricto || w[0] !== 'v' ? 1 : 2);
}
// ¿la frase la llama? → lo que le dice después del nombre ('' si sólo la llamó); null si no la llama
function verLlamada(t) {
  const s = String(t || '').trim(); if (!s) return null;
  // escrituras sin espacios (japonés, chino, tailandés): el nombre cerca del principio
  for (const n of VER_NOMBRES) { const i = s.toLowerCase().indexOf(n); if (i >= 0 && i < 8) return s.slice(i + n.length).replace(/^[\s,、，。!！?？]+/, ''); }
  const w = s.replace(/\b(very|berry|vary)[\s,]+(tea|tee|ti|tie|t)\b/gi, 'veriti').split(/\s+/); // ("very tea": lo que a veces entiende el navegador)
  // (con un saludo justo antes: "hey verity", "che, veriti"; sola al principio, tiene que sonar más parecido)
  for (let i = 0; i < Math.min(w.length, 4); i++) {
    const saludo = i > 0 && VER_HEY.includes(verNorm(w[i - 1]).replace(/[^\p{L}]/gu, ''));
    if (!(i === 0 || saludo) || !verEsNombre(w[i], !saludo)) continue;
    return w.slice(i + 1).join(' ').replace(/^[\s,.:;!?¡¿-]+/, '');
  }
  return null;
}
function oidoQuiere() {
  if (PREFS.verOido === false || OIDO.negado || OIDO.pausa || JUEGO.estado !== 'juego' || document.hidden) return false;
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) return false;
  return VER.on || (typeof VOZ !== 'undefined' && VOZ.on && !!verRemotaCerca(25));
}
function oidoPaso() {
  const q = oidoQuiere();
  if (q && !OIDO.r && performance.now() > OIDO.tReini) oidoEmpezar(); else if (!q && OIDO.r && !OIDO.pausa) oidoParar();
  if (VER.bt) VER.bt.classList.toggle('oido', !!OIDO.r);
}
function oidoEmpezar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, r = new SR();
  r.lang = verLocale(verLengua()); r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const x = e.results[i], t = x[0].transcript, ahora = performance.now();
      // mientras ella habla no se escucha a sí misma
      if (VER.yo && (VER.yo.voz || VER.yo.nav) && ahora > OIDO.despierta) continue;
      const q = verLlamada(t);
      if (q !== null && ahora > OIDO.despierta) { OIDO.despierta = ahora + 9000; verDespertar(); }
      if (!x.isFinal) continue;
      if (q !== null) { if (q) { OIDO.despierta = 0; verHablarle(q); } }
      else if (OIDO.despierta && ahora < OIDO.despierta && t.trim()) { OIDO.despierta = 0; verHablarle(t.trim()); } // (dijo el nombre y después lo que quería)
    }
  };
  r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { OIDO.negado = true; aviso(T('ver.sinMic'), 3); } else if (e.error !== 'no-speech' && e.error !== 'aborted') OIDO.fallos++; };
  r.onend = () => { if (OIDO.r === r) OIDO.r = null; OIDO.tReini = performance.now() + (OIDO.fallos > 4 ? 8000 : 400); };
  OIDO.r = r; try { r.start(); } catch (e) { OIDO.r = null; OIDO.tReini = performance.now() + 5000; }
}
function oidoParar(pausa) { if (pausa) OIDO.pausa = true; const r = OIDO.r; OIDO.r = null; if (r) try { r.abort(); } catch (e) {} }
// la llamaron: se da vuelta, viene y escucha
function verDespertar() {
  if (VER.on && VER.yo) { const I = VER.yo; I.emo = 'sorpresa'; I.emoT = 2; if (I.anim === 'dormir') verAnim(I, ''); verGlobo(I, '…', 0, true); I.burbHasta = TIEMPO.t + 9; VER.ultCharla = TIEMPO.t; if (VER.modo === 'libre') verPlan('acompañar', 20); }
  else { const id = verRemotaCerca(25), I = id && VER.rem.get(id); if (I) { verGlobo(I, '…', 0, true); I.burbHasta = TIEMPO.t + 9; } }
}

// ---------------- pensar: la tienda (Workers AI) o, si no responde, el modelo público ----------------
function verContexto() {
  const J = JUG, h = DIA.hora, hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60), base = J.vehiculo ? J.vehiculo.b.pos : J.pos;
  const cerca = []; for (const o of OBJS) { const d = o.b.pos.distTo(base); if (d < 20 && !o.verity) cerca.push([d, o.nombre]); }
  cerca.sort((a, b) => a[0] - b[0]);
  const hit = raycast(CAM.pos, CAM.fwd, 40, J.vehiculo ? J.vehiculo.b : null), ob = hit && hit.body && hit.body.obj;
  const mira = ob ? ob.nombre : hit && hit.body && hit.body.persona ? 'a player' : hit ? 'ground or wall ' + Math.round(hit.t) + 'm' : 'the sky';
  const ahora = TIEMPO.t, mios = OBJS.filter((o) => !o.remoto && !o.verity && ahora - o.creado < 120).length;
  const nomMapa = T('m.' + MUNDO.nombre), mapa = nomMapa && nomMapa !== 'm.' + MUNDO.nombre ? nomMapa : MUNDO.nombre, M = VER.mente;
  return { jugador: PREFS.nombre, mapa, hora: hh + ':' + String(mm).padStart(2, '0'), vida: Math.round(J.vida), vivo: J.vivo, vehiculo: J.vehiculo ? J.vehiculo.nombre : '', arma: ARM.lista[ARM.i] || '',
    corriendo: Math.hypot(J.vel.x, J.vel.z) > 3, volando: !!(NAT.volando), cerca: cerca.slice(0, 8).map((c) => c[1] + ' ' + Math.round(c[0]) + 'm'), mira,
    jugadores: [...RED.remotos.values()].filter((R2) => R2.pos.distTo(J.pos) < 40).map((R2) => R2.nombre).slice(0, 6), construyo: mios, mods: modsActivosAhora().map((m) => m.id).slice(0, 8),
    sala: typeof SALA !== 'undefined' && SALA ? SALA.n : '', tuModo: VER.modo, haciendo: verEstado(), energia: Math.round(M.energia * 100) + '%', humor: M.humor > 0.3 ? 'happy' : M.humor < -0.2 ? 'sad' : 'calm', memoria: verMemoria().d.slice(-12) };
}
function verTiempo(ms) { const a = new AbortController(); setTimeout(() => a.abort(), ms); return a.signal; }
// el modelo público deja una respuesta cada 30 s por conexión (si no, contesta 402 o 429 con cuánto esperar): se
// espera el turno y, si igual dice que no, se reintenta una vez
const VER_PUB = 31000;
async function verPublico(c) {
  const msgs = verityMensajes(c); if (!msgs) return null;
  for (let n = 0; n < 2; n++) {
    const falta = (VER.pubUlt || 0) + VER_PUB - Date.now(); if (falta > 0) await verEsperar(falta); VER.pubUlt = Date.now();
    try {
      const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai', messages: msgs, private: true }), signal: verTiempo(45000) });
      if (r.status === 402 || r.status === 429) {
        let seg = +r.headers.get('Retry-After') || 0; if (!seg) { try { const m = /retry after (\d+)/i.exec(await r.text()); seg = m ? +m[1] : 30; } catch (e) { seg = 30; } }
        VER.pubUlt = Date.now() + Math.min(35, seg) * 1000 + 500 - VER_PUB; continue;
      }
      const d = await r.json(); return verityRespuesta(d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content);
    } catch (e) { return null; }
  }
  return null;
}
// sin la tienda, lo que pasa en el juego no gasta el turno del modelo público: lo contesta con un gesto
function verGesto(ev) {
  const I = VER.yo; if (!I) return;
  const G = { hola: ['feliz', 'girar'], jugador: ['feliz', 'girar'], muerte: ['triste', ''], noche: ['pensando', ''], dia: ['feliz', 'saltar'], obra: ['emocionada', 'rebotar'], auto: ['emocionada', ''], explosion: ['sorpresa', 'saltar'] }[ev];
  if (!G) return; I.emo = G[0]; I.emoT = 3; if (G[1]) verAnim(I, G[1]);
}
// q: lo que le dijeron; ev: un evento del juego; de: el nombre de otro jugador que le habló
async function verPreguntar(q, ev, de) {
  if (!VER.on) return;
  q = rbTexto(q, 300); if (!q && !ev) return;
  if (VER.pensando) { if (q) VER.espera = [q, ev, de]; return; } // (lo último que le dijeron, apenas termine)
  const I = VER.yo, c = { l: verLengua(), q, ev: ev || '', de: de || '', n: I.noche > 0.5 ? 1 : 0, h: VER.hist.slice(-8), ctx: verContexto() };
  if (q) { VER.hist.push(['u', de ? de + ': ' + q : q]); VER.ultCharla = TIEMPO.t; if (VER.modo === 'libre') verPlan('acompañar', 25); }
  VER.pensando = true; I.pensando = true; verLog(); if (!q || !VER.escucha) verGlobo(I, '', 0, true);
  let v = null;
  if (!VER.sinCF && Date.now() > (VER.cfLleno || 0)) {
    try {
      const r = await fetch(TIENDA_URL + 'verity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c), signal: verTiempo(32000) });
      if (r.ok) v = verityRespuesta(JSON.stringify(await r.json()));
      else if (r.status === 404 || r.status === 405) VER.sinCF = true; // (la tienda todavía no tiene a Verity)
      else if (r.status === 503) VER.cfLleno = Date.now() + 10 * 60e3; // (sin cupo del día: un rato con el modelo público)
      else if (r.status === 429) { VER.pensando = false; I.pensando = false; if (q) verDecir(I, T('ver.cupo'), 'triste'); verLog(); return; }
    } catch (e) {}
  }
  if (!v && !q) { VER.pensando = false; I.pensando = false; verGlobo(I, '', 0); verGesto(ev); verLog(); if (VER.espera) { const w = VER.espera; VER.espera = null; setTimeout(() => verPreguntar(w[0], w[1], w[2]), 200); } return; }
  if (!v) v = await verPublico(c);
  VER.pensando = false; I.pensando = false;
  if (!VER.on || VER.yo !== I) return;
  if (!v) { if (q) verDecir(I, T('ver.sinRed'), 'triste'); else verGlobo(I, '', 0); verLog(); return; }
  VER.hist.push(['v', v.decir, v.acciones]); VER.hist = VER.hist.slice(-12);
  if (v.recordar && q && !de) verRecordar(v.recordar);
  const M = VER.mente; M.humor = clamp(M.humor + ({ feliz: 0.08, risa: 0.12, enamorada: 0.12, emocionada: 0.1, triste: -0.1, enojada: -0.12, miedo: -0.06 }[v.emocion] || 0), -1, 1);
  verMemoria().n++; verGuardar(); verLog();
  const l = verIdiomaDe(v.decir, verLengua());
  verDecir(I, v.decir, v.emocion, l);
  if (RED.on) publicar('a', { k: 'verd', t: v.decir, e: v.emocion, l });
  // (lo que hace sola o le pide otro jugador: sólo gestos y animaciones; poner cosas, moverse o cambiar la hora, sólo si se lo pedís vos)
  verAcciones(q && !de ? v.acciones : v.acciones.filter((a) => ['bailar', 'saltar', 'girar', 'luz', 'rodar', 'rebotar', 'amor', 'mareo'].includes(a.a)));
  if (VER.espera) { const w = VER.espera; VER.espera = null; setTimeout(() => verPreguntar(w[0], w[1], w[2]), 200); }
}
// un evento del juego: no más de uno cada 30 s (y cada clase con su propia espera)
function verEvento(ev, espera, q) {
  const t = TIEMPO.t; if (!VER.on || VER.pensando || t - VER.tEv < 30 || t - (VER.evT[ev] || -1e9) < espera) return;
  VER.tEv = t; VER.evT[ev] = t; verPreguntar(q || '', ev);
}

// ---------------- hablar: voz de la tienda (MeloTTS) en 3D, o la del navegador ----------------
const verEsperar = (ms) => new Promise((ok) => setTimeout(() => ok(null), ms));
async function verVozCF(t, l) {
  if (VER.sinVozCF || !VERITY_VOCES.includes(l) || !AUD.ctx) return null;
  try {
    const r = await fetch(TIENDA_URL + 'verity/voz?l=' + l + '&t=' + encodeURIComponent(t.slice(0, 240)), { signal: verTiempo(9000) });
    if (!r.ok) { if (r.status === 404 || r.status === 503) VER.sinVozCF = true; return null; }
    return await AUD.ctx.decodeAudioData(await r.arrayBuffer());
  } catch (e) { return null; }
}
function verCallar(I) {
  if (I.voz) { try { I.voz.s.stop(); } catch (e) {} I.voz = null; }
  if (I.nav && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} I.nav = false; }
}
// la cadena: un toque metálico (un eco cortito) y más brillo; de noche, más grave, lenta y con mucho eco
function verSonar(I, buf) {
  const c = AUD.ctx, s = c.createBufferSource(), noche = I.noche > 0.5; s.buffer = buf; s.playbackRate.value = noche ? 0.9 : 1.07;
  const seco = c.createGain(), dl = c.createDelay(0.05), moj = c.createGain(), hs = c.createBiquadFilter(), an = c.createAnalyser();
  dl.delayTime.value = noche ? 0.023 : 0.011; moj.gain.value = noche ? 0.45 : 0.3; seco.gain.value = 0.9; hs.type = 'highshelf'; hs.frequency.value = 3000; hs.gain.value = noche ? -4 : 4; an.fftSize = 512;
  s.connect(seco); s.connect(dl); dl.connect(moj); seco.connect(hs); moj.connect(hs); hs.connect(an);
  const F = fuente3D(I.pos, 1.2); an.connect(F.g); if (F.r) F.r.gain.value = noche ? 1.1 : 0.3;
  I.voz = { s, an, F, b: new Uint8Array(512) }; s.onended = () => { if (I.voz && I.voz.s === s) I.voz = null; };
  s.start(); return buf.duration / s.playbackRate.value;
}
let VER_VOCES = null;
function verVozNav(I, t, l) {
  if (!('speechSynthesis' in window)) return 0;
  const S = speechSynthesis, voces = S.getVoices(), loc = verLocale(l).toLowerCase(), ll = l.toLowerCase();
  if (!VER_VOCES || VER_VOCES.n !== voces.length + loc) {
    const de = voces.filter((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith(ll));
    const fem = /female|mujer|femen|paulina|m[oó]nica|helena|luc[ií]a|luciana|samantha|victoria|karen|moira|tessa|zira|joana|amelie|anna|kyoko|google/i;
    de.sort((a, b) => (String(b.lang).toLowerCase() === loc) - (String(a.lang).toLowerCase() === loc) || fem.test(b.name) - fem.test(a.name));
    VER_VOCES = { n: voces.length + loc, v: de[0] || null };
  }
  const u = new SpeechSynthesisUtterance(t); u.lang = verLocale(l); if (VER_VOCES.v) u.voice = VER_VOCES.v;
  const noche = I.noche > 0.5, d = I.pos.distTo(CAM.pos);
  u.pitch = noche ? 0.55 : 1.45; u.rate = noche ? 0.85 : 1.05; u.volume = clamp((PREFS.vol / 100) * (2.5 / Math.max(2.5, d)), 0.05, 1);
  u.onstart = () => { I.nav = true; }; u.onend = u.onerror = () => { I.nav = false; }; u.onboundary = () => { I.pulso = 1; };
  try { S.cancel(); S.speak(u); } catch (e) { return 0; }
  I.nav = true; return Math.max(1.2, t.length * 0.07 / u.rate);
}
// decir algo: cara, globo (las letras aparecen con la voz), chat y voz (si está cerca), en el idioma de la frase
async function verDecir(I, t, emo, l) {
  t = verSinEmoji(t); if (!t) return;
  I.emo = VERITY_EMO.includes(emo) ? emo : 'neutral'; I.emoT = 8; I.pensando = false;
  if (I.anim === 'dormir') verAnim(I, '');
  chatMostrar(I.dueno === 'yo' ? 'Verity' : 'Verity (' + (I.nombre || '?') + ')', t);
  l = l || verIdiomaDe(t, verLengua());
  const d = I.pos.distTo(CAM.pos);
  verCallar(I);
  let dur = 0;
  if (PREFS.verVoz !== false && PREFS.vol && d < 45) {
    audioIniciar();
    const buf = await Promise.race([verVozCF(t, l), verEsperar(4000)]);
    if (buf && AUD.ctx) dur = verSonar(I, buf);
    if (!dur && d < 25) { dur = verVozNav(I, t, l); I.falsa = dur; } // (si el navegador no tiene esa voz, la boca se mueve igual)
  }
  if (!dur) { dur = Math.max(1.2, t.length * 0.065); I.falsa = dur; }
  verGlobo(I, t, dur);
}
// el globo arriba de ella (las letras salen al ritmo de la voz y queda unos segundos)
function verGlobo(I, t, dur, fijo) {
  if (!I) return;
  if (!I.burb) { I.burb = document.createElement('div'); I.burb.className = 'verBurb'; $('hud').appendChild(I.burb); }
  I.burbTx = t || ''; I.burbT0 = TIEMPO.t; I.burbDur = dur || 0; I.burbHasta = fijo ? 1e9 : TIEMPO.t + (dur || 0) + 3.5; I.burbN = -1;
}

// ---------------- lo que hace (las acciones que pidió el modelo, revisadas otra vez) ----------------
function verNombreProp(q) {
  q = String(q || '').trim(); if (!q) return null;
  if (DATA.pfPorNombre[q]) return q;
  const L = Object.keys(DATA.pfPorNombre), b = q.toLowerCase();
  return L.find((n) => n.toLowerCase() === b) || VERITY_PROPS.find((n) => DATA.pfPorNombre[n] && (n.toLowerCase().includes(b) || b.includes(n.toLowerCase()))) || L.find((n) => n.toLowerCase().includes(b)) || null;
}
function verAcciones(L) {
  for (const a of L || []) {
    if (a.a === 'seguir') { VER.modo = 'seguir'; VER.tModo = 300; }
    else if (a.a === 'quieta') { VER.modo = 'quieta'; VER.ancla = VER.yo.pos.clone(); }
    else if (a.a === 'ven') { VER.modo = 'ven'; VER.tModo = 8; }
    else if (a.a === 'libre') { VER.modo = 'libre'; verPlan('pasear', 20); }
    else if (a.a === 'explorar') { VER.modo = 'libre'; const foco = verAlgoInteresante(); verPlan(foco ? 'investigar' : 'pasear', 25, foco ? { foco } : null); }
    else if (VER_DUR[a.a]) verAnim(VER.yo, a.a);
    else if (a.a === 'poner') verPoner(a.que, a.n);
    else if (a.a === 'construir') verConstruir(a.que);
    else if (a.a === 'hora') { DIA.hora = ((+a.h % 24) + 24) % 24; DIA.aplicada = -1; }
    else if (a.a === 'musica') verMedia('radio', a.q);
    else if (a.a === 'video') verMedia('pantalla', a.q);
    else if (a.a === 'emote') verEmote(a.que);
    else if (a.a === 'luz') VER.luz = a.si !== false;
    else if (a.a === 'limpiar') { for (const o of VER.mios) if (OBJS.includes(o)) borrarObjeto(o); VER.mios = []; VER.obra = null; RED.wSucio = true; }
  }
}
// frente al jugador, en el piso
function verDelante(d, lado) {
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), der = v3(-f.z, 0, f.x), p = vadd(vadd(JUG.pos, vscale(f, d)), vscale(der, lado || 0));
  const y = pisoBajo(v3(p.x, JUG.pos.y + 2, p.z), 6); p.y = y === null ? JUG.pos.y - 0.9 : y; return p;
}
function verCrear(nombre, p, q, opt) {
  if (!reglaSala(nombre)) return null;
  const o = crearObjeto(nombre, p, q, opt); if (!o) return null;
  o.verity = true; VER.mios.push(o); DESHACER.push(o); redObjeto(o);
  verHaz(p); return o;
}
function verPoner(que, n) {
  const nom = verNombreProp(que); if (!nom) return;
  n = clamp(n | 0 || 1, 1, 5);
  const F = formaDe(nom), P = puntosForma(F.shape); let w = 1; if (P.length) { let a = 1e9, b = -1e9; for (const v of P) { a = Math.min(a, v.x, v.z); b = Math.max(b, v.x, v.z); } w = b - a; }
  const paso = Math.max(1.1, w + 0.4), d = 3 + w * 0.6;
  for (let i = 0; i < n; i++) VER.tareas.push({ t: TIEMPO.t + 0.35 + i * 0.3, fn: () => { const p = verDelante(d, (i - (n - 1) / 2) * paso); verCrear(nom, p, Quat.axis(0, 1, 0, JUG.yaw + Math.PI)); } });
}
// construir con cajas: cada obra es una lista de [derecha, adelante, arriba] en cajas
function verObraPlan(que) {
  const L = [];
  if (que === 'torre') { for (let k = 0; k < 6; k++) for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) L.push([i - 0.5, j, k]); }
  else if (que === 'muro') { for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) L.push([i - 2.5, 0, k]); }
  else if (que === 'escalera') { for (let j = 0; j < 6; j++) for (let k = 0; k <= j; k++) for (const i of [0, 1]) L.push([i - 0.5, j, k]); }
  else if (que === 'piramide') { for (let k = 0; k < 4; k++) { const n = 4 - k; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) L.push([i - (n - 1) / 2, j + k / 2, k]); } }
  else if (que === 'fuerte') { for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { if (i > 0 && i < 5 && j > 0 && j < 5) continue; if (k === 2 && (i + j) % 2) continue; if (k < 2 && j === 0 && (i === 2 || i === 3)) continue; L.push([i - 2.5, j, k]); } }
  else if (que === 'puente') { const H = [0, 1, 2, 2, 2, 2, 1, 0]; for (let j = 0; j < 8; j++) for (const i of [0, 1]) { L.push([i - 0.5, j, H[j]]); } for (const j of [0, 7]) for (const i of [0, 1]) for (let k = 0; k < H[j]; k++) L.push([i - 0.5, j, k]); }
  else { for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if (i > 0 && i < 3 && j > 0 && j < 3) continue; if (k < 2 && j === 0 && i === 1) continue; if (k === 1 && j === 3 && (i === 1 || i === 2)) continue; L.push([i - 1.5, j, k]); } // casa: paredes con puerta y ventana
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) L.push([i - 1.5, j, 3]); }
  L.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  return L;
}
let VER_BLOQUE = null;
function verBloque() {
  if (VER_BLOQUE) return VER_BLOQUE;
  for (const n of ['Crate', 'Box2', 'Block', 'Box1']) {
    if (!DATA.pfPorNombre[n]) continue; const P = puntosForma(formaDe(n).shape); if (!P.length) continue;
    const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const v of P) { a[0] = Math.min(a[0], v.x); a[1] = Math.min(a[1], v.y); a[2] = Math.min(a[2], v.z); b[0] = Math.max(b[0], v.x); b[1] = Math.max(b[1], v.y); b[2] = Math.max(b[2], v.z); }
    const s = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; if (Math.min(...s) < 0.2) continue;
    return (VER_BLOQUE = { n, s });
  }
  return null;
}
function verConstruir(que) {
  const B = verBloque(); if (!B) return;
  const L = verObraPlan(que), yaw = JUG.yaw, f = v3(Math.sin(yaw), 0, Math.cos(yaw)), der = v3(-f.z, 0, f.x), q = Quat.axis(0, 1, 0, yaw);
  const sx = B.s[0] + 0.004, sy = B.s[1] + 0.002, sz = B.s[2] + 0.004, O = verDelante(3 + sz * 0.5, 0);
  VER.obra = { L, i: 0, t: TIEMPO.t + 0.4, O, f, der, q, sx, sy, sz, n: B.n };
}
function verObraPaso() {
  const W = VER.obra; if (!W || TIEMPO.t < W.t) return;
  if (W.i >= W.L.length) { VER.obra = null; return; }
  const [i, j, k] = W.L[W.i++], p = vadd(vadd(W.O, vscale(W.der, i * W.sx)), vscale(W.f, j * W.sz)); p.y = W.O.y + k * W.sy;
  if (!verCrear(W.n, p, W.q, { congelado: true })) { VER.obra = null; return; }
  W.t = TIEMPO.t + 0.085; W.ult = p;
}
async function verMedia(t, q) {
  entidadPonerMod(t, true);
  const e = ENTS.lista.find((x) => x.t === t && x.dueno === 'yo' && x.red && !x.mod); if (!e) return;
  try {
    const d = await (await fetch(TIENDA_URL + 'yt?q=' + encodeURIComponent(q || 'music'))).json(), L = (d.items || []).filter((x) => ytId(x.id) === x.id);
    if (!L.length) return;
    e.lista = L.map((x) => ({ id: x.id, t: x.t })); audioIniciar(); radioPoner(e, L[0].id, 0, L[0].t, true);
  } catch (x) {}
}
function verEmote(que) {
  const q = String(que || ''), L = [...DATA.emotes, ...Object.keys(DATA.emo || {}).map((k) => 'rb:' + k)];
  const e = L.find((x) => x === q) || L.find((x) => x.toLowerCase() === q.toLowerCase()) || L.find((x) => x.toLowerCase().replace('rb:', '') === q.toLowerCase().replace('rb:', ''));
  if (e && emoValido(e)) emote(e);
}
// el rayito de ella a lo que pone, con chispas
function verHaz(p) { VER.haz = { a: VER.yo.pos.clone(), b: p.clone(), t: 0.16 }; for (let i = 0; i < 6; i++) particula(vadd(p, v3(0, 0.3, 0)), v3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), 0.5, 0.12, [1, 0.85, 0.3, 1], 'chispa'); }

// ---------------- las animaciones: rodar, rebotar, bailar, girar, saltar (con vuelta), enamorarse, marearse, dormir ----------------
const VER_DUR = { rodar: 7, rebotar: 5, bailar: 9, girar: 1.3, saltar: 1.1, amor: 4.5, mareo: 5, dormir: 25 };
function verAnim(I, a) {
  if (!I) return;
  I.anim = VER_DUR[a] ? a : ''; I.animT = VER_DUR[a] || 0; I.animT0 = TIEMPO.t; I.ang = Math.atan2(I.pos.z - JUG.pos.z, I.pos.x - JUG.pos.x);
  if (a === 'amor') { I.emo = 'enamorada'; I.emoT = 4.5; }
  if (a === 'dormir') { I.emo = 'dormida'; I.emoT = 25; }
  if (a === 'mareo') { I.emo = 'sorpresa'; I.emoT = 2; }
  if (a === 'rebotar') I.vel.y = Math.max(I.vel.y, 5);
  if (I === VER.yo && RED.on) RED.ultE = 0;
}

// ---------------- su cabeza: qué hace cuando nadie le pide nada ----------------
function verPlan(n, dur, extra) { VER.plan = Object.assign({ n, t: dur, dest: null, tDest: 0, foco: null, llego: false, t0: TIEMPO.t }, extra || {}); }
// lo que está haciendo, para el modelo (y para el que pregunte "¿qué hacés?")
function verEstado() {
  const P = VER.plan, I = VER.yo; if (!I) return '';
  if (I.anim) return { rodar: 'rolling around', rebotar: 'bouncing', bailar: 'dancing', girar: 'spinning', saltar: 'doing a flip', amor: 'feeling love', mareo: 'dizzy from spinning', dormir: 'sleeping' }[I.anim];
  if (VER.modo === 'quieta') return 'staying still where the player asked';
  if (VER.modo === 'seguir' || VER.modo === 'ven') return 'following the player closely';
  if (!P) return 'floating next to the player';
  return { acompañar: 'floating next to the player', pasear: 'rolling around exploring the map', investigar: 'looking closely at a ' + (P.foco ? P.foco.n : 'thing'), jugar: P.bola ? 'playing with a ' + P.bola.nombre : 'playing, rolling and bouncing around', descansar: 'resting, sleepy', saludar: 'saying hi to ' + (P.R2 ? P.R2.nombre : 'a player') }[P.n] || '';
}
// algo para ir a mirar: props, autos, entidades (radio, piano, pantalla) y otros jugadores, que no haya mirado hace poco
function verAlgoInteresante() {
  const M = VER.mente, t = TIEMPO.t, L = [];
  for (const o of OBJS) { if (o.verity) continue; const d = o.b.pos.distTo(JUG.pos), k = 'o' + o.id; if (d < 26 && t - (M.vistos.get(k) || -1e9) > 180) L.push({ k, n: o.nombre, p: () => o.b.pos, alto: () => (o.b.aabb ? o.b.aabb.y1 - o.b.pos.y : 1), d }); }
  for (const e of ENTS.lista) { if (!e.b) continue; const d = e.b.pos.distTo(JUG.pos), k = 'e' + e.id; if (d < 26 && t - (M.vistos.get(k) || -1e9) > 180) L.push({ k, n: e.t, p: () => e.b.pos, alto: () => 1.2, d }); }
  for (const R2 of RED.remotos.values()) { const d = R2.pos.distTo(JUG.pos), k = 'j' + R2.id; if (d < 26 && t - (M.vistos.get(k) || -1e9) > 240) L.push({ k, n: R2.nombre, p: () => R2.P.pos, alto: () => 1.1, d, jugador: true }); }
  if (!L.length) return null; L.sort((a, b) => a.d - b.d);
  return L[Math.floor(Math.random() * Math.min(5, L.length))];
}
function verJugadorNuevo() { const M = VER.mente, t = TIEMPO.t; for (const R2 of RED.remotos.values()) if (R2.pos.distTo(JUG.pos) < 15 && t - (M.saludados.get(R2.id) || -1e9) > 600) return R2; return null; }
function verBola() { let m = null, dm = 20; for (const o of OBJS) { if (o.remoto || o.b.frozen || !/pelota|ball|bouncy/i.test(o.nombre)) continue; const d = o.b.pos.distTo(JUG.pos); if (d < dm) { dm = d; m = o; } } return m; }
function verElegirPlan() {
  const M = VER.mente, J = JUG, I = VER.yo, t = TIEMPO.t, vel = Math.hypot(J.vel.x, J.vel.z);
  const activo = vel > 2.2 || J.vehiculo || t - VER.ultCharla < 25 || !J.vivo || NAT.volando;
  if (I.pos.distTo(J.pos) > 30 || activo) return verPlan('acompañar', 6 + Math.random() * 6);
  if (M.energia < 0.18) return verPlan('descansar', 30 + Math.random() * 25);
  const R2 = verJugadorNuevo(); if (R2) return verPlan('saludar', 12, { R2 });
  const foco = verAlgoInteresante(), bola = verBola();
  const op = [['acompañar', 1.6], ['pasear', 2.4], ['jugar', (bola ? 2 : 0.8) + 2.5 * M.aburre], ['investigar', foco ? 2.5 * M.curios + 0.6 : 0]];
  let s = op.reduce((a, o) => a + o[1], 0) * Math.random();
  for (const [n, w] of op) { s -= w; if (s <= 0) { verPlan(n, n === 'acompañar' ? 8 + Math.random() * 8 : 14 + Math.random() * 14, n === 'investigar' ? { foco } : n === 'jugar' ? { bola } : null); return; } }
  verPlan('acompañar', 10);
}
// el plan de este cuadro → { dest, vmax: rueda por el piso } o { meta: flota hacia ahí }
function verMentePaso(dt) {
  const M = VER.mente, I = VER.yo, t = TIEMPO.t, J = JUG;
  // las órdenes mandan
  if (VER.modo !== 'libre' && VER.modo !== 'quieta' && (VER.tModo -= dt) <= 0) VER.modo = 'libre';
  if (VER.modo === 'quieta' && VER.ancla) return { meta: VER.ancla };
  if (VER.modo === 'seguir' || VER.modo === 'ven') return { meta: verMeta() };
  // las animaciones que van por el piso
  if (I.anim === 'rodar') { I.ang += dt * 1.7; return { dest: vadd(J.pos, v3(Math.cos(I.ang) * 3.2, 0, Math.sin(I.ang) * 3.2)), vmax: 5.5 }; }
  if (I.anim === 'rebotar' || I.anim === 'dormir') return { dest: I.pos.clone(), vmax: 0 };
  // lo que tiene ganas de hacer
  if (!VER.plan || (VER.plan.t -= dt) <= 0) verElegirPlan();
  const vel = Math.hypot(J.vel.x, J.vel.z);
  M.aburre = clamp(M.aburre + (vel < 0.5 && t - VER.ultCharla > 30 ? dt / 90 : -dt / 40), 0, 1);
  // si te vas lejos o empezás a moverte rápido, vuelve con vos
  if (VER.plan.n !== 'acompañar' && (I.pos.distTo(J.pos) > 32 || vel > 4.5 || J.vehiculo)) verPlan('acompañar', 8);
  const Q = VER.plan;
  if (Q.n === 'acompañar') { M.energia = clamp(M.energia - dt * 0.0015, 0, 1); return { meta: verMeta() }; }
  if (Q.n === 'descansar') {
    M.energia = clamp(M.energia + dt * 0.03, 0, 1); I.emo = 'dormida'; I.emoT = 1;
    if (Math.random() < dt * 1.5) particula(vadd(I.pos, v3(0.15, 0.3, 0)), v3(0.1, 0.5, 0), 1.6, 0.05, [1, 1, 1, 0.8], 'chispa', 1.2);
    if ((J.pos.distTo(I.pos) < 2.5 && vel > 1) || M.energia >= 1) { Q.t = 0; I.emo = 'sorpresa'; I.emoT = 1.5; }
    return { dest: I.pos.clone(), vmax: 0 };
  }
  if (Q.n === 'pasear') {
    M.energia = clamp(M.energia - dt * 0.003, 0, 1);
    if (!Q.dest || I.pos.distTo(Q.dest) < 0.8 || (Q.tDest -= dt) <= 0) { const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 11; Q.dest = vadd(J.pos, v3(Math.cos(a) * r, 0, Math.sin(a) * r)); Q.tDest = 6 + Math.random() * 4; }
    return { dest: Q.dest, vmax: 3.2 };
  }
  if (Q.n === 'jugar') {
    M.energia = clamp(M.energia - dt * 0.01, 0, 1); M.aburre = clamp(M.aburre - dt / 15, 0, 1);
    const b = Q.bola && OBJS.includes(Q.bola) ? Q.bola : null;
    if (b) {
      // la persigue y le pega (la empuja para un lado y un poco para arriba)
      const d = vsub(b.b.pos, I.pos); d.y = 0; const L = d.len();
      if (L < VER_R + 0.45 && t - (Q.tGolpe || 0) > 0.8) { Q.tGolpe = t; const dir = vscale(d, 1 / Math.max(0.01, L)), a = (Math.random() - 0.5) * 1.2, x = dir.x * Math.cos(a) - dir.z * Math.sin(a), z = dir.x * Math.sin(a) + dir.z * Math.cos(a); b.b.vel.addS(v3(x, 0.5, z), 6); b.b.wake(); I.emo = 'risa'; I.emoT = 1.5; }
      return { dest: b.b.pos.clone(), vmax: 6 };
    }
    // sin pelota: rueda en ochos alrededor tuyo y salta de vez en cuando
    Q.a = (Q.a || 0) + dt * 1.2;
    if (Math.random() < dt * 0.4 && I.piso !== null && I.pos.y < I.piso + VER_R + 0.05) I.vel.y = 4.5;
    return { dest: vadd(J.pos, v3(Math.sin(Q.a) * 4.5, 0, Math.sin(Q.a * 2) * 2.2)), vmax: 5.5 };
  }
  if (Q.n === 'investigar' && Q.foco) {
    const F = Q.foco, p = F.p(); M.energia = clamp(M.energia - dt * 0.002, 0, 1); M.vistos.set(F.k, t);
    if (Q.giro === undefined) Q.giro = Math.atan2(I.pos.z - p.z, I.pos.x - p.x);
    Q.giro += dt * 0.45;
    const m = vadd(p, v3(Math.cos(Q.giro) * 1.5, Math.max(0.6, F.alto() + 0.35), Math.sin(Q.giro) * 1.5));
    Q.ver = vadd(p, v3(0, F.alto() * 0.6, 0));
    if (!Q.llego && I.pos.distTo(m) < 1) { Q.llego = true; if (Math.random() < 0.3) verEvento('pensamiento', 150, 'you are looking closely at a ' + F.n + (F.jugador ? ' (another player)' : '') + ' nearby'); I.emo = Math.random() < 0.5 ? 'pensando' : 'sorpresa'; I.emoT = 3; }
    return { meta: m, ver: Q.ver };
  }
  if (Q.n === 'saludar' && Q.R2 && RED.remotos.has(Q.R2.id)) {
    const R2 = Q.R2, p = R2.P.pos, f = v3(Math.sin(R2.yaw || 0), 0, Math.cos(R2.yaw || 0)), m = vadd(vadd(p, vscale(f, 1.3)), v3(0, 1.2, 0));
    if (!Q.llego && I.pos.distTo(m) < 1.2) { Q.llego = true; VER.mente.saludados.set(R2.id, t); verAnim(I, 'girar'); verEvento('jugador', 0, R2.nombre + ' just arrived near you: say hi to them by name'); }
    return { meta: m, ver: vadd(p, v3(0, 1, 0)) };
  }
  verPlan('acompañar', 6); return { meta: verMeta() };
}

// ---------------- cada cuadro ----------------
// dónde quiere estar al acompañarte: adelante a la derecha en primera persona (para verla), al hombro en tercera
function verMeta() {
  const J = JUG, base = J.vehiculo ? J.vehiculo.b.pos : J.pos, d = v3(CAM.der.x, 0, CAM.der.z), f = v3(CAM.fwd.x, 0, CAM.fwd.z);
  if (d.len() < 1e-3) d.set(1, 0, 0); else d.norm(); if (f.len() < 1e-3) f.set(0, 0, 1); else f.norm();
  if (VER.modo === 'ven') return vadd(vadd(base, vscale(f, 1.2)), v3(0, 0.6, 0));
  const terc = J.tercera || J.vehiculo;
  return terc ? vadd(vadd(base, vscale(d, 0.95)), v3(0, J.vehiculo ? 1.6 : 0.95, 0)) : vadd(vadd(vadd(base, vscale(f, 1.45)), vscale(d, 0.85)), v3(0, 0.55, 0));
}
function verPaso(dt) {
  if (verHay() && !VER.on) verAparecer(); else if (!verHay() && VER.on) verIrse();
  verRemotosPaso(dt);
  oidoPaso();
  if (!VER.on) return;
  const I = VER.yo, t = TIEMPO.t;
  const habla = I.voz || I.nav || I.falsa > 0 || I.pensando;
  let o = verMentePaso(dt);
  if (VER.obra && VER.obra.ult) o = { meta: vadd(VER.obra.ult, v3(0, 1.6, 0)) };
  // al hablar se queda quieta y te mira (si estaba rodando, se para)
  if (habla && o.dest) o = { dest: I.pos.clone(), vmax: 0 };
  if (o.meta) verFlotar(I, o.meta, dt); else verRodar(I, o.dest, o.vmax, dt);
  // a quién mira: a vos (si habla, te acompaña o le diste una orden), a lo que investiga, o hacia donde va
  const vh = Math.hypot(I.vel.x, I.vel.z), P = VER.plan, aVos = habla || !P || P.n === 'acompañar' || VER.modo !== 'libre';
  const objetivo = aVos ? CAM.pos : o.ver || (vh > 1 ? vadd(I.pos, vscale(I.vel, 2)) : CAM.pos);
  const am = vsub(objetivo, I.pos); I.yawM = Math.atan2(am.x, am.z); I.mira = objetivo;
  VER.tareas = VER.tareas.filter((x) => { if (t >= x.t) { x.fn(); return false; } return true; });
  verObraPaso();
  verCuerpoPaso(I, dt);
  I.noche = verNoche() ? 1 : 0;
  VER.oscura = clamp(VER.oscura + (I.noche ? dt / 20 : -dt / 4), 0, 1);
  verEventosPaso(dt);
}
// flotar: resorte (casi sin rebote) hacia el lugar; si hay una pared entre vos y el lugar, se queda de este lado
function verFlotar(I, m, dt) {
  I.suelo = false; I.rueda = false;
  if (VER.modo !== 'quieta' && (!VER.plan || VER.plan.n === 'acompañar' || VER.modo !== 'libre')) {
    const o = vadd(JUG.pos, v3(0, 0.7, 0)), dv = vsub(m, o), L = dv.len();
    if (L > 0.3 && L < 6) { const h = raycast(o, vscale(dv, 1 / L), L + VER_R, JUG.vehiculo ? JUG.vehiculo.b : null); if (h && h.t < L + VER_R) m = vadd(o, vscale(dv, Math.max(0.3, h.t - VER_R - 0.08) / L)); }
  }
  if (I.pos.distTo(m) > 40) { I.pos.copy(m); I.vel.set(0, 0, 0); }
  const kf = JUG.vehiculo ? 40 : 18, kd = JUG.vehiculo ? 11 : 7.5;
  I.vel.addS(vsub(m, I.pos), kf * dt); I.vel.scale(Math.exp(-kd * dt)); if (I.vel.len() > 30) I.vel.scale(30 / I.vel.len());
  I.pos.addS(I.vel, dt);
  // nunca bajo el piso
  if ((I.nPiso = (I.nPiso || 0) + 1) % 4 === 0) I.piso = pisoBajo(I.pos, 0.2);
  if (I.piso != null && I.pos.y < I.piso + VER_R + 0.05) { I.pos.y = I.piso + VER_R + 0.05; if (I.vel.y < 0) I.vel.y = 0; }
}
// rodar por el piso: con gravedad, rebota al caer (y se aplasta), salta las paredes; gira como una pelota
function verRodar(I, dest, vmax, dt) {
  I.suelo = true;
  const d = vsub(dest, I.pos); d.y = 0; const L = d.len(), quiero = L > 0.15 ? vscale(d, Math.min(vmax, L * 2) / L) : v3();
  const k = Math.min(1, dt * 4); I.vel.x += (quiero.x - I.vel.x) * k; I.vel.z += (quiero.z - I.vel.z) * k;
  I.vel.y -= VER_G_SUELO * dt;
  // una pared adelante: salta
  const vh = Math.hypot(I.vel.x, I.vel.z);
  if (vh > 0.5 && (I.nPared = (I.nPared || 0) + 1) % 3 === 0) { const dir = v3(I.vel.x / vh, 0, I.vel.z / vh), h = raycast(I.pos, dir, VER_R + 0.35, null); if (h && I.piso != null && I.pos.y < I.piso + VER_R + 0.1) I.vel.y = 4.8; }
  const antes = I.pos.clone(); I.pos.addS(I.vel, dt);
  I.piso = pisoBajo(I.pos, 0.6);
  if (I.piso !== null && I.pos.y < I.piso + VER_R) {
    I.pos.y = I.piso + VER_R;
    if (I.vel.y < -2.2) { I.aplV = Math.min(9, -I.vel.y * 1.6); I.vel.y = I.anim === 'rebotar' ? 5.2 : -I.vel.y * 0.38; }
    else { I.vel.y = I.anim === 'rebotar' ? 5.2 : 0; if (I.anim === 'rebotar') I.aplV = 6; }
  }
  if (I.piso === null && I.pos.y < MUNDO.lo.y - 20) { I.pos.copy(verMeta()); I.vel.set(0, 0, 0); }
  // el giro de la pelota: lo que avanzó apoyada en el piso, alrededor del eje perpendicular
  const mv = vsub(I.pos, antes); mv.y = 0; const dl = mv.len();
  I.rueda = dl > 0.004 && I.piso !== null && I.pos.y < I.piso + VER_R + 0.12;
  if (I.rueda) { const ax = v3(mv.z / dl, 0, -mv.x / dl); I.q = Quat.axis(ax.x, ax.y, ax.z, dl / VER_R).mul(I.q).norm(); }
  if (I.pos.distTo(JUG.pos) > 45) { I.pos.copy(verMeta()); I.vel.set(0, 0, 0); }
}
// lo de cada Verity (la mía y las otras): orientación, aplaste, boca, mirada, parpadeo, fallas, animaciones y globo
function verCuerpoPaso(I, dt) {
  const t = TIEMPO.t;
  let dy = I.yawM - I.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); I.yaw += dy * Math.min(1, dt * 7);
  // derecha (mirando) salvo mientras rueda: al parar se endereza
  if (I.dueno === 'yo') { if (!I.rueda) I.q.slerpTo(Quat.axis(0, 1, 0, I.yaw), 1 - Math.exp(-dt * (I.suelo ? 6 : 9))); }
  else I.q.slerpTo(I.qM, 1 - Math.exp(-dt * 10));
  // el aplaste (resorte)
  I.aplV += (-I.apl * 260 - I.aplV * 13) * dt; I.apl += I.aplV * dt; I.apl = clamp(I.apl, -0.3, 0.4);
  // animaciones
  if (I.animT > 0 && (I.animT -= dt) <= 0) { if (I.anim === 'mareo' || I.anim === 'dormir') { I.emo = 'feliz'; I.emoT = 0; } I.anim = ''; }
  if (I.anim === 'bailar' && Math.random() < dt * 12) particula(vadd(I.pos, v3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6)), v3((Math.random() - 0.5), 1.5, (Math.random() - 0.5)), 0.9, 0.08, [1, 0.9, 0.4, 1], 'chispa');
  if (I.anim === 'amor' && Math.random() < dt * 6) particula(vadd(I.pos, v3((Math.random() - 0.5) * 0.4, 0.35, (Math.random() - 0.5) * 0.4)), v3((Math.random() - 0.5) * 0.4, 1.1, (Math.random() - 0.5) * 0.4), 1.4, 0.07, [1, 0.25, 0.45, 1], 'chispa', 0.5);
  if (I.anim === 'mareo' && t - I.animT0 > 2 && I.emo !== 'mareada') { I.emo = 'mareada'; I.emoT = 3; }
  if (I.emoT > 0 && (I.emoT -= dt) <= 0 && !I.voz && !I.nav && !I.anim) { const h = VER.mente.humor; I.emo = I.noche ? (Math.random() < 0.5 ? 'siniestra' : 'neutral') : h > 0.3 ? 'feliz' : h < -0.2 ? 'triste' : 'neutral'; }
  // la boca: con el volumen de su voz (o el de la voz del navegador, a golpes de palabra)
  let mb = 0;
  if (I.voz) { I.voz.an.getByteTimeDomainData(I.voz.b); let s = 0; for (let i = 0; i < I.voz.b.length; i++) { const v = (I.voz.b[i] - 128) / 128; s += v * v; } mb = clamp((Math.sqrt(s / I.voz.b.length) - 0.015) * 7, 0, 1); ponerPos(I.voz.F.p, I.pos); }
  else if (I.nav) { I.pulso = Math.max(0, I.pulso - dt * 3); mb = (0.25 + 0.55 * Math.abs(Math.sin(t * 15))) * (0.5 + 0.5 * I.pulso); }
  else if (I.falsa > 0) { I.falsa -= dt; mb = 0.2 + 0.5 * Math.abs(Math.sin(t * 14)); }
  I.boca += (mb - I.boca) * Math.min(1, dt * 18);
  // la mirada: los ojitos se corren hacia lo que mira (en el espacio de su cara); si no, miran por ahí
  let gx = 0, gy = 0;
  if (I.mira && !I.rueda) { const l = I.q.conj().rot(vsub(I.mira, I.pos)); if (l.z > 0.05) { gx = clamp(l.x / l.z, -1, 1); gy = clamp(-l.y / l.z, -1, 1); } }
  if (Math.random() < dt * 0.35) { I.gx0 = (Math.random() - 0.5) * 0.8; I.gy0 = (Math.random() - 0.5) * 0.5; }
  if (!I.rueda) { gx += I.gx0 || 0; gy += I.gy0 || 0; } // (rodando, la mirada no importa: no se rehace la cara)
  I.gx += (clamp(gx, -1, 1) - I.gx) * Math.min(1, dt * 10); I.gy += (clamp(gy, -1, 1) - I.gy) * Math.min(1, dt * 10);
  if ((I.tParp -= dt) <= 0) { I.parp = 1; if (I.tParp < -0.13) { I.parp = 0; I.tParp = 2 + Math.random() * 4; } }
  if (I.noche) { if ((I.tGlitch -= dt) <= 0) { I.glitch = 0.15 + Math.random() * 0.4; I.tGlitch = 6 + Math.random() * 12; } }
  if (I.glitch > 0) I.glitch -= dt;
  // el globo
  const B = I.burb;
  if (B) {
    const vis = t < I.burbHasta && (I.burbTx || I.pensando);
    const cl = vis && I.pos.distTo(CAM.pos) < 35 ? clipDe(vadd(I.pos, v3(0, VER_R + 0.18, 0))) : null;
    if (!cl) B.style.display = 'none';
    else {
      B.style.display = ''; B.classList.toggle('oscura', I.noche > 0.5);
      let n = I.burbTx.length; if (I.burbDur > 0) n = Math.ceil(n * clamp((t - I.burbT0) / (I.burbDur * 0.92), 0, 1));
      const k = I.pensando && !I.burbTx ? 'p' : n; if (I.burbN !== k) { I.burbN = k; B.innerHTML = k === 'p' ? '<span class="verPiensa"><i></i><i></i><i></i></span>' : `<span dir="auto">${esc(I.burbTx.slice(0, n))}</span>`; }
      B.style.transform = `translate(${cl.x.toFixed(1)}px,${cl.y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
}
// eventos: morir, subirse a un auto, construir mucho, la noche y pensar en voz alta cada tanto
function verEventosPaso(dt) {
  const t = TIEMPO.t, I = VER.yo, M = VER.mente;
  if (VER.vivoAnt && !JUG.vivo) { I.emo = 'sorpresa'; I.emoT = 4; M.humor = clamp(M.humor - 0.2, -1, 1); verEvento('muerte', 40); }
  VER.vivoAnt = JUG.vivo;
  const auto = !!JUG.vehiculo; if (auto && !VER.autoAnt && Math.random() < 0.6) verEvento('auto', 120); VER.autoAnt = auto;
  if ((VER.nObra = (VER.nObra || 0) + 1) % 30 === 0) { const n = OBJS.filter((o) => !o.remoto && !o.verity && t - o.creado < 60).length; if (n >= 6) verEvento('obra', 150); }
  const osc = I.noche > 0.5; if (osc !== VER.oscAnt) { VER.oscAnt = osc; verEvento(osc ? 'noche' : 'dia', 60); }
  // sus pensamientos (lo que está haciendo, lo que ve, cómo se siente)
  if (!UI.abierto && !VER.pensando && !I.voz && !I.nav) {
    M.tPensar -= dt;
    if (M.tPensar <= 0) { M.tPensar = (VER.sinCF ? 420 : 200) + Math.random() * 160; if (I.pos.distTo(CAM.pos) < 30) verEvento('pensamiento', 0, 'say out loud a short thought about what you are doing (' + verEstado() + ') or something you notice'); }
  }
}
// una explosión cerca (lo llama explosion)
function verExplosion(p, r) { if (!VER.on || !VER.yo) return; const d = p.distTo(VER.yo.pos); if (d < r * 3 + 8) { VER.yo.emo = 'sorpresa'; VER.yo.emoT = 3; if (d < r * 2 + 6) verEvento('explosion', 90); } }

// ---------------- dibujar (lo llama dibujar, después de los personajes) ----------------
const _verR = new Float32Array(16), _verS = new Float32Array(16);
function verDibujar() {
  if (!VER.on && !VER.rem.size) return;
  const G = verGeo();
  if (VER.on) verDibujarInst(VER.yo, G);
  for (const I of VER.rem.values()) verDibujarInst(I, G);
  if (VER.haz && (VER.haz.t -= TIEMPO.dt) > 0 && VER.yo) {
    const a = VER.yo.pos, b = VER.haz.b, d = vsub(b, a), L = d.len();
    if (L > 0.1) dibujarCaja(vadd(a, vscale(d, 0.5)), [0.03, 0.03, L], qMirar(vscale(d, 1 / L)), G.mH, { c: [1, 0.85, 0.3, 0.8 * VER.haz.t / 0.16] });
  }
}
function verDibujarInst(I, G) {
  const t = TIEMPO.t, p = I.pos.clone(), a = I.anim, u = t - I.animT0;
  if (!I.suelo) p.y += Math.sin(t * 2.2 + I.slot) * 0.05;
  if (a === 'bailar') p.y += Math.abs(Math.sin(t * 6)) * 0.22;
  let q = I.q.clone();
  if (a === 'girar') q = Quat.axis(0, 1, 0, verS(0, 1.3, u) * Math.PI * 2).mul(q);
  if (a === 'saltar') { p.y += Math.sin(clamp(u / 1.1, 0, 1) * Math.PI) * 1.1; q = q.mul(Quat.axis(1, 0, 0, -verS(0.1, 1, u) * Math.PI * 2)); }
  if (a === 'bailar') q = Quat.axis(0, 1, 0, u * 5).mul(q).mul(Quat.axis(0, 0, 1, Math.sin(t * 6) * 0.25));
  if (a === 'mareo') q = u < 2 ? Quat.axis(0, 1, 0, u * u * 6).mul(q) : q.mul(Quat.axis(0, 0, 1, Math.sin(t * 3.2) * 0.3)).mul(Quat.axis(1, 0, 0, Math.cos(t * 3.2) * 0.2));
  if (a === 'dormir') q = q.mul(Quat.axis(0, 0, 1, 0.25));
  // aplastada al caer: más ancha y más baja (apoyada en el piso); el aplaste va en el vertical del mundo
  const s = VER_R * (1 + I.boca * 0.035), sy = s * (1 - I.apl), sxz = s * (1 + I.apl * 0.5), M = GEO.pool[GEO.pi] || (GEO.pool[GEO.pi] = new Float32Array(16)); GEO.pi++;
  if (I.suelo) p.y -= s - sy;
  m4trs([0, 0, 0], [q.x, q.y, q.z, q.w], [1, 1, 1], _verR); m4trs([p.x, p.y, p.z], [0, 0, 0, 1], [sxz, sy, sxz], _verS); m4mul(_verS, _verR, M);
  // de noche: más apagada y rojiza, titila
  const n = I.dueno === 'yo' ? VER.oscura : I.noche, tit = n > 0.3 && Math.random() < 0.06 ? 0.35 : 1, k = (1 - 0.55 * n) * tit;
  const em = [0.6 * k, (0.42 - 0.24 * n) * k, (0.04 - 0.03 * n) * k], col = [1, 0.8 - 0.3 * n, 0.12 - 0.08 * n, 1];
  encolar(G.cuerpo, 0, G.mC, M, null, { c: col, em });
  encolar(G.cara, 0, verCaraTex(I), M, null, null);
  // el aura: un brillo suave alrededor (más de noche)
  if (GFX.part > 0.3 && I.pos.distTo(CAM.pos) > 0.9) particula(p, v3(), 1e-4, VER_R * 3.4, [1, 0.78 - 0.3 * n, 0.2, (0.05 + 0.05 * R.noche) * tit], 'fuego', 0);
  I.dib = p;
}
// la luz de cada una (lo llama lucesJuntar)
function verLuces() {
  const L = (I, k) => { const n = I.dueno === 'yo' ? VER.oscura : I.noche, tit = n > 0.3 && Math.random() < 0.08 ? 0.2 : 1, a = (0.35 + 1.4 * R.noche) * k * tit; if (a > 0.02) luzPuntual(I.dib || I.pos, 5 + 3 * R.noche, [1.6 * a, (1.15 - 0.5 * n) * a, (0.3 - 0.2 * n) * a]); };
  if (VER.on && VER.yo && VER.luz) L(VER.yo, 1);
  for (const I of VER.rem.values()) if (I.luz) L(I, 0.8);
}

// ---------------- en la sala: la mía viaja en mi estado (con su giro y su animación); lo que dice, aparte ----------------
const verR = (v) => Math.round(v * 20) / 20, verR3 = (v) => Math.round(v * 1000) / 1000;
function verRedEstado() {
  if (!VER.on || !VER.yo) return 0;
  const I = VER.yo; return [verR(I.pos.x), verR(I.pos.y), verR(I.pos.z), Math.round(I.yaw * 10) / 10, Math.max(0, VERITY_EMO.indexOf(I.emo)), (VER.oscura > 0.5 ? 1 : 0) | (VER.luz ? 2 : 0) | (I.suelo ? 4 : 0) | (Math.max(0, VER_ANIMS.indexOf(I.anim)) << 3),
    verR3(I.q.x), verR3(I.q.y), verR3(I.q.z), verR3(I.q.w)];
}
function verRemoto(R2, vr) {
  let I = VER.rem.get(R2.id);
  if (!Array.isArray(vr) || vr.length < 6) { if (I) { verCallar(I); if (I.burb) I.burb.remove(); VER.rem.delete(R2.id); } return; }
  if (!I) { if (VER.rem.size >= VER_MAX - 1) return; I = verInst(R2.id); VER.rem.set(R2.id, I); I.pos.set(num(vr[0], -1e4, 1e4, 0), num(vr[1], -1e4, 1e4, 0), num(vr[2], -1e4, 1e4, 0)); }
  I.meta.set(num(vr[0], -1e4, 1e4, 0), num(vr[1], -1e4, 1e4, 0), num(vr[2], -1e4, 1e4, 0)); I.yawM = num(vr[3], -100, 100, 0);
  if (!I.voz && !I.nav && I.emoT <= 0) I.emo = VERITY_EMO[vr[4] | 0] || 'feliz';
  const f = vr[5] | 0, an = VER_ANIMS[(f >> 3) & 15] || '';
  I.noche = f & 1; I.luz = !!(f & 2); I.suelo = !!(f & 4); I.t = TIEMPO.t; I.nombre = R2.nombre;
  if (an !== I.anim) { I.anim = an; I.animT0 = TIEMPO.t; I.animT = an ? VER_DUR[an] : 0; }
  if (vr.length >= 10) { I.qM.x = num(vr[6], -1, 1, 0); I.qM.y = num(vr[7], -1, 1, 0); I.qM.z = num(vr[8], -1, 1, 0); I.qM.w = num(vr[9], -1, 1, 1); I.qM.norm(); }
}
function verRemotosPaso(dt) {
  for (const [id, I] of VER.rem) {
    const R2 = RED.remotos.get(id);
    if (!R2 || TIEMPO.t - I.t > 6) { verCallar(I); if (I.burb) I.burb.remove(); VER.rem.delete(id); continue; }
    I.pos.lerpTo(I.meta, 1 - Math.exp(-dt * 9)); I.mira = CAM.pos; verCuerpoPaso(I, dt);
  }
}
function verRed(d) {
  if (d.k === 'verd') {
    const I = VER.rem.get(d.i); if (!I) return;
    const l = typeof d.l === 'string' && VER_LOCALE[d.l] ? d.l : 'en';
    verDecir(I, rbTexto(d.t, 280), VERITY_EMO.includes(d.e) ? d.e : 'neutral', l);
  } else if (d.k === 'verq' && d.to === RED.ID && VER.on) {
    const t = TIEMPO.t, u = VER.preguntas.get(d.i) || -1e9; if (t - u < 6) return; VER.preguntas.set(d.i, t);
    const R2 = RED.remotos.get(d.i), q = rbTexto(d.t, 200); if (!q) return;
    verPreguntar(q, '', limpio(d.n) || (R2 && R2.nombre) || '?');
  }
}
