// ---------------- Verity (mod oficial): una compañera con IA y con vida propia ----------------
// Una esfera amarilla que brilla, con cara (ojitos y sonrisa como la original), que anda sola por el mapa como un bot:
// pasea rodando, va a mirar cosas y jugadores, juega empujando pelotas, saluda a los que llegan, se duerme si se cansa
// y piensa en voz alta cada tanto. No sigue a nadie (salvo que se lo pidan): cuando le hablan va hasta el que le habla.
// En cada sala hay una sola Verity para todos: la maneja un jugador (el que ya la tenía o, si nadie, el de id más
// chico) y los demás la ven, la escuchan y le hablan; jugando solo aparece con el mod. Se le habla escribiendo (tecla Y,
// su botón o "Verity, ..." en el chat) o con la voz: escucha el micrófono pero sólo reacciona a "Hey/Che Verity" (en
// muchos idiomas). Contesta en el idioma en que le hablan, con su voz en 3D (la boca sigue el sonido), y hace cosas:
// bailar, rodar, rebotar, poner props, construir, música, video, venir, seguir o quedarse quieta. Se la agarra con la
// pistola de física o la de gravedad (y se la puede congelar o tirar: cae, rebota y vuelve a flotar); los tiros la
// empujan. Se acuerda de lo que le cuentan (en el aparato del que la maneja). De noche se pone misteriosa.
// El cerebro es un modelo de lenguaje gratis para todos: el de la tienda (Workers AI, con voz MeloTTS y un tope por
// día) y, si la tienda no responde, uno público sin clave (Pollinations); la voz de respaldo es la del aparato.
const VER_R = 0.27, VER_TEX0 = 4900, VER_MAX = 8, VER_G_SUELO = 14;
const VER_ANIMS = ['', 'rodar', 'rebotar', 'bailar', 'girar', 'saltar', 'amor', 'mareo', 'dormir'];
const VER = { on: false, yo: null, rem: new Map(), modo: 'libre', tModo: 0, ancla: null, objetivo: 'yo', hablaCon: 'yo', tRed: 0, redAnt: false, ultimo: null,
  hist: [], mem: null, pensando: false, espera: null, sinCF: false, sinVozCF: false, tEv: 0, evT: {}, vivoAnt: true, autoAnt: false, oscAnt: false,
  obra: null, tareas: [], mios: [], luz: true, bt: null, pan: null, escucha: null, mic: false, oscura: 0, preguntas: new Map(), slots: [], ultCharla: -99,
  // su cabeza: lo que está haciendo, cuánta energía tiene, si se aburre, su humor y qué ya miró
  plan: null, mente: { energia: 1, aburre: 0, humor: 0.4, curios: 0.7, vistos: new Map(), saludados: new Map(), tPensar: 200 } };
const verSala = () => typeof SALA !== 'undefined' && !!SALA;
const verHayAlguna = () => VER.on || VER.rem.size > 0;
// ¿la manejo yo? Solo: si el mod está prendido. En una sala hay una sola para todos: la maneja el que ya la tenía; si
// nadie, el de id más chico (los demás esperan su turno, por si ése tiene una versión vieja del juego)
function verManejo() {
  if (JUEGO.estado !== 'juego' || (typeof CREA !== 'undefined' && CREA.on)) return false;
  if (!verSala()) return typeof NAT !== 'undefined' && NAT.mods.has('verity');
  if (!RED.on) return VER.on;
  const t = TIEMPO.t;
  for (const [id, I] of VER.rem) if (t - I.t < 3 && (!VER.on || id < RED.ID)) return false;
  if (VER.on) return true;
  let antes = 0; for (const id of RED.remotos.keys()) if (id < RED.ID) antes++;
  return t - VER.tRed > 4 + 3 * antes;
}
// los jugadores (yo y los de la sala): dónde están y adónde miran
function verJugadores() {
  const L = [{ id: 'yo', pos: JUG.pos, yaw: JUG.yaw, nombre: PREFS.nombre }];
  if (typeof RED !== 'undefined') for (const R2 of RED.remotos.values()) L.push({ id: R2.id, pos: R2.pos, yaw: R2.yawM || 0, nombre: R2.nombre });
  return L;
}
const verJugador = (id) => verJugadores().find((J) => J.id === id) || null;
function verMasCerca(p) { let m = null, dm = 1e9; for (const J of verJugadores()) { const d = J.pos.distTo(p); if (d < dm) { dm = d; m = J; } } return m; }
// adonde se pone para hablarle a alguien: adelante, un poco al costado, a la altura de la cara
function verCerca(J) { const f = v3(Math.sin(J.yaw), 0, Math.cos(J.yaw)); return vadd(vadd(vadd(J.pos, vscale(f, 1.7)), v3(f.z * 0.45, 0, -f.x * 0.45)), v3(0, 0.5, 0)); }
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
    apl: 0, aplV: 0, anim: '', animT: 0, animT0: 0, suelo: false, piso: null, rueda: false, mira: null, gx: 0, gy: 0, nombre: '', b: null, fis: 'libre', tFis: 0, tG: 0 };
}
// el modelo: el cuerpo generado con IA a partir de una foto de la original (imagen → malla 3D; herramientas/verity_glb.py
// lo mete en el paquete como "Verity", con la cara borrada de su textura) o, si el paquete no lo tiene, una esfera lisa
// hecha acá; adelante, un casquete apenas más grande con la cara (textura de un canvas que se redibuja cuando cambia el
// gesto, la boca, la mirada o el parpadeo). La cara va sin luz y con transparencia; alrededor, un aura suave
let VER_G = null;
function verGeo() {
  if (VER_G && (VER_G.pk ? R.mallas[VER_G.lejos] : R.mallas[VER_G.cuerpo]) && R.mallas[VER_G.cara]) return VER_G;
  const mi = DATA.ms.findIndex((m) => m && m.n === 'Verity'), ma = DATA.mt.findIndex((m) => m && m.n === 'RB_Verity'), pk = mi >= 0 && ma >= 0;
  const B = geoNuevo(), C = geoNuevo(), tri = (M, a, b, c) => {
    const P = M.P, ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * (P[a * 3] + P[b * 3] + P[c * 3]) + ny * (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) + nz * (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) >= 0) M.I.push(a, b, c); else M.I.push(a, c, b);
  };
  const NA = pk ? 24 : 44, NB = pk ? 16 : 28; // (con el modelo generado, esta esfera es la de lejos: más liviana)
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NA; j++) {
    const th = (i / NB) * Math.PI, ph = (j / NA) * 2 * Math.PI, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    B.P.push(x, y, z); B.N.push(x, y, z); B.U.push(j / NA, i / NB);
  }
  for (let i = 0; i < NB; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; if (i > 0) tri(B, a, b, a + 1); if (i < NB - 1) tri(B, a + 1, b, b + 1); }
  // el casquete: hasta 78° del frente (+Z), con la imagen proyectada de frente (lo que se ve mirándola a la cara)
  const NT = 16, NP = 44, TM = 1.36, k = (pk ? DATA.ms[mi].rf || 1 : 1) + 0.012, sm = Math.sin(TM);
  C.P.push(0, 0, k); C.N.push(0, 0, 1); C.U.push(0.5, 0.5);
  for (let t = 1; t <= NT; t++) for (let p = 0; p < NP; p++) {
    const th = (t / NT) * TM, ph = (p / NP) * 2 * Math.PI, x = Math.sin(th) * Math.cos(ph), y = Math.sin(th) * Math.sin(ph), z = Math.cos(th);
    C.P.push(x * k, y * k, z * k); C.N.push(x, y, z); C.U.push(0.5 + 0.5 * x / sm, 0.5 + 0.5 * y / sm);
  }
  for (let p = 0; p < NP; p++) tri(C, 0, 1 + p, 1 + ((p + 1) % NP));
  for (let t = 1; t < NT; t++) for (let p = 0; p < NP; p++) { const a = 1 + (t - 1) * NP + p, b = 1 + (t - 1) * NP + ((p + 1) % NP), c = a + NP, d = b + NP; tri(C, a, c, b); tri(C, b, c, d); }
  const cara = mallaPropia(C), cuerpo = mallaPropia(B);
  // de lejos (más de 12 m) el modelo generado se cambia por la esfera liviana con su mismo amarillo
  if (pk) { const m = matGL(ma); m.pbr = [0.2, 0, 0.06]; return (VER_G = { pk: true, cuerpo: mi, lejos: cuerpo, mL: matPropio('verLejos', [0.863, 0.639, 0.192], { pbr: [0.2, 0, 0.06] }), cara, mC: ma, mH: verMatHaz() }); }
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
// la cara (se dibuja en 256×256 y se escala a 512; el borde del círculo es el borde del casquete), con las medidas de
// la original (sacadas de la foto de referencia): dos ojos ovalados negros arriba del centro y la sonrisa fina de lado a
// lado con remates en las puntas; al hablar la sonrisa se abre. Los ojos miran hacia donde mira ella. Más los gestos
// propios (corazones, estrellas, espirales, dormida, siniestra)
function verCara(x, I) {
  const W = 256, c = 128, osc = I.emo === 'siniestra' || (I.glitch > 0 && Math.random() < 0.6);
  const tinta = osc ? '#060203' : '#1a1205', b = clamp(I.boca, 0, 1), cerr = I.parp > 0.5, gx = I.gx * 9, gy = I.gy * 6, t = TIEMPO.t;
  x.clearRect(0, 0, W, W); x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  if (I.glitch > 0) x.translate((Math.random() - 0.5) * 14, 0);
  x.fillStyle = tinta; x.strokeStyle = tinta;
  const e = osc ? 'siniestra' : I.emo, ex = (s) => c + s * 27 + gx, ey = c - 30 + gy, mx = c + gx * 0.4;
  const ojo = (s, rx, ry, dy) => { x.beginPath(); x.ellipse(ex(s), ey + (dy || 0), rx, cerr ? 1.8 : ry, 0, 0, 7); x.fill(); };
  const arco = (s) => { x.lineWidth = 6.5; x.beginPath(); x.arc(ex(s), ey + 6, 10, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); };
  const corazon = (cx2, cy2, s) => { x.beginPath(); x.moveTo(cx2, cy2 + 6 * s); x.bezierCurveTo(cx2 - 13 * s, cy2 - 3 * s, cx2 - 7 * s, cy2 - 14 * s, cx2, cy2 - 6 * s); x.bezierCurveTo(cx2 + 7 * s, cy2 - 14 * s, cx2 + 13 * s, cy2 - 3 * s, cx2, cy2 + 6 * s); x.fill(); };
  const estrella = (cx2, cy2, r, rot) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx2 + Math.sin(a) * rr, cy2 - Math.cos(a) * rr); } x.closePath(); x.fill(); };
  // la sonrisa de la original: un arco fino de lado a lado (k = qué tan abierta: 0 cerrada, 1 riendo) con remates
  const sonrisa = (ancho, hondo, k) => {
    const y0 = c + 6, L = mx - ancho, Rr = mx + ancho, cy = y0 + hondo * 2;
    if (k > 0.04) {
      x.beginPath(); x.moveTo(L, y0); x.quadraticCurveTo(mx, cy, Rr, y0); x.quadraticCurveTo(mx, cy + k * 62, L, y0); x.fill();
      if (k > 0.25) { x.save(); x.clip(); x.fillStyle = '#b8352c'; x.beginPath(); x.ellipse(mx, y0 + hondo + k * 30, ancho * 0.42, 6 + k * 12, 0, 0, 7); x.fill(); x.restore(); }
    }
    x.lineWidth = 6; x.beginPath(); x.moveTo(L, y0); x.quadraticCurveTo(mx, cy, Rr, y0); x.stroke();
    x.lineWidth = 5; for (const s of [-1, 1]) { const px = mx + s * ancho; x.beginPath(); x.moveTo(px + s * 5, y0 - 7); x.quadraticCurveTo(px + s * 1, y0 + 1, px - s * 5, y0 + 5); x.stroke(); }
  };
  // ojos
  if (e === 'risa') { arco(-1); arco(1); }
  else if (e === 'dormida') { x.lineWidth = 6; for (const s of [-1, 1]) { x.beginPath(); x.arc(ex(s), ey - 2, 10, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); } }
  else if (e === 'picara') { ojo(-1, 9, 14); x.lineWidth = 6.5; x.beginPath(); x.moveTo(ex(1) - 10, ey); x.lineTo(ex(1) + 10, ey - 2); x.stroke(); }
  else if (e === 'enamorada') { x.fillStyle = '#d8203f'; const s = 1.15 + 0.12 * Math.sin(t * 9); corazon(ex(-1), ey + 2, s); corazon(ex(1), ey + 2, s); x.fillStyle = tinta; }
  else if (e === 'emocionada') { const r = 13 + Math.sin(t * 10) * 1.5; estrella(ex(-1), ey, r, t * 2); estrella(ex(1), ey, r, -t * 2); }
  else if (e === 'mareada') { x.lineWidth = 3.6; for (const s of [-1, 1]) { x.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.42 + t * 7 * s, r = i * 0.36; x.lineTo(ex(s) + Math.cos(a) * r, ey + Math.sin(a) * r); } x.stroke(); } }
  else if (e === 'sorpresa' || e === 'miedo') { ojo(-1, 10.5, 17, -2); ojo(1, 10.5, 17, -2); }
  else if (e === 'siniestra') {
    // ojos huecos negros con un puntito, cada tanto se estiran
    const k = 1 + (I.glitch > 0 ? Math.random() * 0.5 : 0);
    x.beginPath(); x.ellipse(c - 28, c - 26, 13 * k, 19, -0.15, 0, 7); x.ellipse(c + 28, c - 26, 13 * k, 19, 0.15, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,240,230,.95)'; x.beginPath(); x.arc(c - 26, c - 24, 2.4, 0, 7); x.arc(c + 26, c - 24, 2.4, 0, 7); x.fill(); x.fillStyle = tinta;
  } else { ojo(-1, 9, 14); ojo(1, 9, 14); }
  // cejas
  x.lineWidth = 5; const yc = ey - 24;
  if (e === 'enojada') { x.beginPath(); x.moveTo(ex(-1) - 14, yc - 6); x.lineTo(ex(-1) + 10, yc + 4); x.moveTo(ex(1) + 14, yc - 6); x.lineTo(ex(1) - 10, yc + 4); x.stroke(); }
  if (e === 'triste' || e === 'miedo') { x.beginPath(); x.moveTo(ex(-1) - 12, yc + 4); x.lineTo(ex(-1) + 10, yc - 4); x.moveTo(ex(1) + 12, yc + 4); x.lineTo(ex(1) - 10, yc - 4); x.stroke(); }
  if (e === 'pensando') { x.beginPath(); x.moveTo(ex(1) - 10, yc - 2); x.lineTo(ex(1) + 14, yc + 2); x.stroke(); }
  // boca
  x.lineWidth = 6;
  if (e === 'siniestra') {
    // sonrisa enorme de lado a lado, con dientes finos arriba y abajo
    const cb = 74 + b * 22, ca = 30, lab = (u, k) => [c - 64 + 128 * u, c + 12 + 2 * u * (1 - u) * (k - 12)];
    x.beginPath(); x.moveTo(c - 64, c + 12); x.quadraticCurveTo(c, c + cb, c + 64, c + 12); x.quadraticCurveTo(c, c + ca, c - 64, c + 12); x.fill();
    x.fillStyle = 'rgba(255,244,232,.95)'; x.beginPath();
    for (let i = 0; i < 8; i++) { const t0 = 0.12 + i * 0.095, t1 = t0 + 0.095, [x0, y0] = lab(t0, ca), [x1, y1] = lab(t1, ca), [xm] = lab((t0 + t1) / 2, ca), hb = lab((t0 + t1) / 2, cb)[1], ym = (y0 + y1) / 2; x.moveTo(x0, y0 - 1.5); x.lineTo(x1, y1 - 1.5); x.lineTo(xm, ym + (hb - ym) * 0.62); }
    for (let i = 0; i < 6; i++) { const t0 = 0.22 + i * 0.095, t1 = t0 + 0.095, [x0, y0] = lab(t0, cb), [x1, y1] = lab(t1, cb), [xm] = lab((t0 + t1) / 2, cb), ym = (y0 + y1) / 2; x.moveTo(x0, y0 * 0.5 + (c + 12) * 0.5 + 1); x.lineTo(x1, y1 * 0.5 + (c + 12) * 0.5 + 1); x.lineTo(xm, ym * 0.5 + (c + 12) * 0.5 - 12); }
    x.fill(); x.fillStyle = tinta;
  } else if (e === 'sorpresa' || e === 'miedo') { x.beginPath(); x.ellipse(mx, c + 30, 10 + b * 5, 13 + b * 9, 0, 0, 7); x.fill(); }
  else if (e === 'dormida') { x.beginPath(); x.ellipse(mx, c + 28, 7, 4 + 2 * Math.sin(t * 2), 0, 0, 7); x.fill(); }
  else if (e === 'mareada') { x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 28; i++) x.lineTo(mx - 28 + i * 2, c + 26 + Math.sin(i * 0.8 + t * 6) * 4); x.stroke(); }
  else if (e === 'triste' || e === 'enojada') {
    if (b > 0.12) { x.beginPath(); x.ellipse(mx, c + 32, 20 + b * 4, 4 + b * 14, 0, 0, 7); x.fill(); }
    else if (e === 'triste') { x.beginPath(); x.moveTo(mx - 34, c + 42); x.quadraticCurveTo(mx, c + 14, mx + 34, c + 42); x.stroke(); }
    else { x.beginPath(); x.moveTo(mx - 22, c + 32); x.lineTo(mx + 22, c + 32); x.stroke(); }
  }
  else if (e === 'pensando' && b < 0.12) { x.beginPath(); x.moveTo(mx - 18, c + 30); x.lineTo(mx + 14, c + 24); x.stroke(); }
  else if (e === 'picara' && b < 0.12) { x.beginPath(); x.moveTo(mx - 30, c + 18); x.quadraticCurveTo(mx + 6, c + 44, mx + 40, c + 12); x.stroke(); }
  else if (e === 'neutral' && b < 0.12) sonrisa(54, 9, 0);
  else sonrisa(e === 'neutral' || e === 'pensando' || e === 'picara' ? 60 : 84, e === 'neutral' ? 12 : 22, e === 'risa' || e === 'emocionada' ? Math.max(b, 0.55) : b);
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
  verIasCargar();
  verMemoria(); VER.on = true; VER.yo = verInst('yo'); VER.modo = 'libre'; VER.plan = null; VER.luz = true;
  const I = VER.yo, U = VER.ultimo && TIEMPO.t - VER.ultimo.t < 30 ? VER.ultimo : null;
  // (si la manejaba otro que se fue, sigue desde donde estaba; si no, aparece flotando delante tuyo)
  if (U) { I.pos.copy(U.pos); I.q.copy(U.q); I.yaw = I.yawM = U.yaw; I.emo = U.emo; VER.tomada = { pos: U.pos.clone(), t: TIEMPO.t }; }
  else { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); I.pos.copy(vadd(vadd(JUG.pos, vscale(f, 3)), v3(0, 3, 0))); I.vel.set(0, -2, 0); I.emo = 'feliz'; I.yaw = I.yawM = JUG.yaw + Math.PI; I.q = Quat.axis(0, 1, 0, I.yaw); }
  VER.tEv = 0; VER.vivoAnt = JUG.vivo; VER.autoAnt = !!JUG.vehiculo; VER.oscAnt = verNoche(); VER.ultCharla = TIEMPO.t;
  VER.mente.tPensar = 150 + Math.random() * 120; verPlan('visitar', 10, { quien: 'yo' });
  if (!U) setTimeout(() => { if (VER.on) verPreguntar('', 'hola'); }, 1400);
  if (PREFS.verOido !== false && !VER.avisoOido) { VER.avisoOido = true; setTimeout(() => { if (VER.on) aviso(T('ver.oidoAviso'), 4); }, 5000); }
}
function verIrse() {
  const I = VER.yo; VER.on = false;
  if (I) { verCallar(I); if (I.burb) I.burb.remove(); verSinCuerpo(I); }
  VER.yo = null; VER.obra = null; VER.tareas.length = 0; VER.oscura = 0; VER.plan = null;
  if (!verHayAlguna()) { verPanel(false); verEscuchar(false); }
  if (typeof RED !== 'undefined' && RED.on) RED.ultE = 0;
}
function verFin() { if (VER.on) verIrse(); for (const I of VER.rem.values()) { verCallar(I); if (I.burb) I.burb.remove(); verSinCuerpo(I); } VER.rem.clear(); oidoParar(); if (VER.bt) VER.bt.style.display = 'none'; }
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
  if (e.code !== 'KeyY' || e.repeat || !verHayAlguna() || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  if (UI.abierto && UI.abierto !== 'verity') return;
  e.preventDefault(); audioIniciar(); verPanel(UI.abierto !== 'verity');
});
// el panel: charla, escribir, micrófono, animaciones y opciones (voz, oído, noche, olvidar)
const VER_BOTONES = [['rodar', 'girar'], ['rebotar', 'salto'], ['bailar', 'musica'], ['girar', 'girar'], ['saltar', 'subir'], ['amor', 'corazon'], ['mareo', 'dado'], ['dormir', 'estrella']];
function verPanel(si) {
  let p = VER.pan;
  if (!si) { if (p && !p.classList.contains('oc')) { p.classList.add('oc'); if (UI.abierto === 'verity') UI.abierto = null; } return; }
  if (!verHayAlguna()) return;
  if (!p) {
    p = VER.pan = document.createElement('div'); p.id = 'verPan'; p.className = 'verPan oc';
    p.innerHTML = `<div class="verCab">${icoHTML('ico:verity')}<b>Verity</b><span class="verEst"></span><button class="verX" data-v="cerrar">${glifo('no')}</button></div>
      <div class="verLog" dir="auto"></div>
      <div class="verAnims">${VER_BOTONES.map(([a, g]) => `<button data-v="anim:${a}">${glifo(g)}<span></span></button>`).join('')}</div>
      <div class="verFila"><input id="verIn" maxlength="200" autocomplete="off"><button class="verMic" data-v="mic">${glifo('micro')}</button><button class="verEnv" data-v="enviar">${glifo('adelante')}</button></div>
      <div class="verOpc"><label><input type="checkbox" data-v="voz"><span></span></label><label><input type="checkbox" data-v="oido"><span></span></label><label><input type="checkbox" data-v="noche"><span></span></label><button data-v="olvidar">${glifo('basura')}<span></span></button></div>
      <div class="verCreaFila">${VERITY_CREA.map((k) => `<button data-v="crea:${k}" data-vcr="1">${glifo({ mod: 'codigo', mapa: 'props', anim: 'persona' }[k])}<span></span></button>`).join('')}</div>
      <div class="verIA"><span class="verCerebro"></span><button data-v="ia">${glifo('ajustes')}<span>IA</span></button></div>
      <div class="verIAp oc"><b class="verIAel" dir="auto"></b><div class="verIAs"></div><p class="verIAtx" dir="auto"></p>
        <div class="verFila"><select id="verProv"></select><input id="verGemIn" type="password" autocomplete="off" spellcheck="false"><button class="verEnv" data-v="gemGuardar">${glifo('si')}</button></div>
        <div class="verMias"></div>
        <div class="verIAb"><button data-v="tuto">${glifo('info')}<span></span></button><button data-v="gemQuitar">${glifo('basura')}<span></span></button></div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]'); if (!b) return; const a = b.dataset.v;
      if (a === 'cerrar') verPanel(false);
      else if (a === 'enviar') verEnviarPanel();
      else if (a === 'mic') { audioIniciar(); VER.mic = !VER.escucha; verEscuchar(!VER.escucha); }
      else if (a.startsWith('anim:')) verPedirAnim(a.slice(5));
      else if (a.startsWith('crea:')) verCreaPanel(a.slice(5));
      else if (a === 'olvidar') { VER.mem = { d: [], n: 0, t0: Date.now() }; VER.hist = []; verGuardar(); verLog(); aviso(T('ver.olvidado'), 2); }
      else if (a === 'ia') { p.querySelector('.verIAp').classList.toggle('oc'); VER.iasT = 0; verIasCargar(); }
      else if (a.startsWith('cer:')) { PREFS.verIA = a.slice(4); guardarPrefs(); verIAMostrar(); }
      else if (a.startsWith('sacar:')) { const k = a.slice(6); if (k === 'google') PREFS.verGem = ''; else delete verClaves()[k]; guardarPrefs(); verIAMostrar(); }
      else if (a === 'tuto') { const pr = $('verProv').value; if (pr === 'google') verTutorial(true); else window.open(VERITY_CLAVES[pr].web, '_blank', 'noopener'); }
      else if (a === 'gemQuitar') { PREFS.verGem = ''; PREFS.verTk = ''; PREFS.verClaves = {}; guardarPrefs(); verIAMostrar(); }
      else if (a === 'gemGuardar') {
        const i = $('verGemIn'), k = i.value.trim(), pr = $('verProv').value; if (!k) return;
        b.disabled = true; verClaveProbar(pr, k).then((bien) => { b.disabled = false; if (bien) { i.value = ''; guardarPrefs(); aviso(T('ver.ia.ok'), 2.5); if (VER.yo) { VER.yo.emo = 'emocionada'; VER.yo.emoT = 3; } } else aviso(T('ver.ia.mal'), 2.5); verIAMostrar(); });
      }
    });
    $('verGemIn').addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') p.querySelector('[data-v=gemGuardar]').click(); });
    $('verProv').innerHTML = `<option value="google">Google AI Studio</option>` + Object.entries(VERITY_CLAVES).map(([k, P]) => `<option value="${k}">${P.n}</option>`).join('');
    $('verProv').onchange = () => verIAMostrar();
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
  p.querySelectorAll('.verCreaFila button').forEach((b) => { b.querySelector('span').textContent = T('ver.cr.' + b.dataset.v.slice(5)); b.classList.toggle('ocupado', VCR.ocupado); });
  verIAMostrar(); verIasCargar();
  p.classList.remove('oc'); UI.abierto = 'verity'; soltarPuntero(); verLog();
  if (!document.body.classList.contains('tactil')) setTimeout(() => $('verIn').focus(), 30);
}
function verEnviarPanel() { const i = $('verIn'), t = i.value.trim(); i.value = ''; if (t) verHablarle(t); }
// la sección IA: qué cerebro usa y tu propia clave de Google AI Studio
// el nombre de cada IA (las tuyas, con "tu clave")
const VER_IA_N = { gemini: 'Gemini', deepseek: 'DeepSeek', cf: 'Workers AI', ovh: 'OVHcloud', llm7: 'LLM7', pollinations: 'Pollinations', groq: 'Groq', openrouter: 'OpenRouter', mistral: 'Mistral', cerebras: 'Cerebras', github_models: 'GitHub Models', tienda: 'RezoBox' };
const verNomIA = (id) => { const m = /^tu-(.+)$/.exec(id || ''); return m ? (m[1] === 'google' ? 'Gemini' : VER_IA_N[m[1]] || m[1]) + ' (' + T('ver.ia.tuya') + ')' : VER_IA_N[id] || id || ''; };
const verChipIA = (k) => ({ auto: 'Auto', gemini: 'Gemini', deepseek: 'DeepSeek', gratis: T('ver.ia.g'), mias: T('ver.ia.m') }[k]);
// la sección IA: qué IA usa (las del dueño son para todos), tus claves y cuál pensó la última vez
function verIAMostrar() {
  const p = VER.pan; if (!p) return; const ia = verIA(), m = verCerebro(), I = VER.ias || {};
  const cer = p.querySelector('.verCerebro'); cer.textContent = T('ver.ia.cer') + ': ' + verChipIA(ia) + (VER.ultIA ? ' · ' + verNomIA(VER.ultIA) : '');
  cer.classList.toggle('gem', m !== 'normal' && m !== 'gratis');
  p.querySelector('.verIAel').textContent = T('ver.ia.elegir');
  p.querySelector('.verIAs').innerHTML = VERITY_IAS.map((k) => { const no = (k === 'gemini' || k === 'deepseek') && VER.ias && I[k] === false, sin = k === 'mias' && !verHayPropias();
    return `<button data-v="cer:${k}" class="${k === ia ? 'sel' : ''}${no || sin ? ' no' : ''}" title="${no ? esc(T('ver.ia.nodisp')) : ''}">${esc(verChipIA(k))}</button>`; }).join('');
  p.querySelector('.verIAtx').textContent = T('ver.ia.tx2');
  const pr = $('verProv').value || 'google'; $('verGemIn').placeholder = pr === 'google' ? 'AIza… / AQ.…' : VERITY_CLAVES[pr].n + ' API key';
  const mias = [...(verGemPropia() ? [['google', 'Google AI Studio']] : []), ...Object.entries(VERITY_CLAVES).filter(([k]) => verClaves()[k]).map(([k, P]) => [k, P.n])];
  p.querySelector('.verMias').innerHTML = mias.map(([k, n]) => `<span>${glifo('si')} ${esc(n)}<button data-v="sacar:${k}">${glifo('no')}</button></span>`).join('');
  const bs = p.querySelectorAll('.verIAb span'); bs[0].textContent = pr === 'google' ? T('ver.ia.tuto') : T('ver.ia.sacar'); bs[1].textContent = T('ver.ia.quitar');
  p.querySelector('[data-v=gemQuitar]').style.display = mias.length || PREFS.verTk ? '' : 'none';
}
// probar una clave nueva (una pregunta cortita) y guardarla si contesta
async function verClaveProbar(pr, k) {
  if (pr === 'google') return verGemProbar(k);
  const P = VERITY_CLAVES[pr]; if (!P || !/^[A-Za-z0-9_.:\-]{16,200}$/.test(k)) return false;
  for (const m of P.m) {
    try {
      const r = await fetch(P.u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'Reply with the word ok' }], max_tokens: 400 }), signal: verTiempo(30000) });
      if (r.ok) { verClaves()[pr] = k; VER_DESCANSO.delete('tu-' + pr); return true; }
      if (r.status === 401 || r.status === 402 || r.status === 403) return false;
    } catch (e) {}
  }
  return false;
}
// el tutorial: cómo sacar tu clave gratis de Google AI Studio (en tu idioma)
function verTutorial(si) {
  let t = $('verTuto');
  if (!si) { if (t) t.classList.add('oc'); return; }
  if (!t) {
    t = document.createElement('div'); t.id = 'verTuto'; t.className = 'verTuto oc';
    t.innerHTML = `<div class="verTutoC"><button class="verTutoX" data-t="cerrar">${glifo('no')}</button><b></b><ol dir="auto"><li></li><li></li><li></li><li></li></ol><div class="verIAb"><a class="boton" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"></a></div></div>`;
    t.addEventListener('click', (ev) => { if (ev.target === t || ev.target.closest('[data-t=cerrar]')) verTutorial(false); });
    document.body.appendChild(t);
  }
  t.querySelector('b').textContent = T('ver.tuto.t'); t.querySelectorAll('li').forEach((li, i) => { li.textContent = T('ver.tuto.' + (i + 1)); }); t.querySelector('a').textContent = T('ver.tuto.abrir');
  t.classList.remove('oc');
}
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
// hablarle: a la mía (si la manejo yo) o a la de la sala (en una sala, desde cualquier lado; solo, estando cerca)
function verHablarle(q) {
  if (VER.on) { verPreguntar(q, '', verSala() ? PREFS.nombre : '', 'yo'); return; }
  const id = verRemotaCerca(verSala() ? 1e9 : 25);
  if (!id || !RED.on) { aviso(T('ver.lejos'), 2); return; }
  publicar('a', { k: 'verq', to: id, t: q.slice(0, 200), n: PREFS.nombre }); VER.tPedi = performance.now();
  VER.hist.push(['u', q]); VER.hist = VER.hist.slice(-12); const I = VER.rem.get(id); if (I) { I.pensando = true; verGlobo(I, '', 0, true); } verLog();
}
function verPedirAnim(a) { if (VER.on) verAnim(VER.yo, a); else { const id = verRemotaCerca(1e9); if (id && RED.on) publicar('a', { k: 'vera', to: id, a }); } }
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
  // (escucha cuando hay una Verity cerca; jugando solo, siempre)
  if (VER.on) return !verSala() || VER.yo.pos.distTo(JUG.pos) < 30;
  return !!verRemotaCerca(30);
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
  if (VER.on && VER.yo) { const I = VER.yo; I.emo = 'sorpresa'; I.emoT = 2; if (I.anim === 'dormir') verAnim(I, ''); verGlobo(I, '…', 0, true); I.burbHasta = TIEMPO.t + 9; VER.ultCharla = TIEMPO.t; verAtender('yo', 20); }
  else { const id = verRemotaCerca(30), I = id && VER.rem.get(id); if (I) { verGlobo(I, '…', 0, true); I.burbHasta = TIEMPO.t + 9; if (RED.on) publicar('a', { k: 'verw', to: id }); } }
}
// alguien le habla: va hasta él y lo mira un rato (si no está ocupada con una orden o en el aire)
function verAtender(quien, s) { VER.hablaCon = quien; if (VER.modo === 'libre' && VER.yo && VER.yo.fis === 'libre') verPlan('atender', s, { quien }); }
// ---------------- pensar: la tienda (Workers AI) o, si no responde, el modelo público ----------------
function verContexto() {
  const J = JUG, I = VER.yo, h = DIA.hora, hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60), base = I ? I.pos : J.pos;
  const cerca = []; for (const o of OBJS) { const d = o.b.pos.distTo(base); if (d < 20 && !o.verity) cerca.push([d, o.nombre]); }
  cerca.sort((a, b) => a[0] - b[0]);
  const hit = raycast(CAM.pos, CAM.fwd, 40, J.vehiculo ? J.vehiculo.b : null), ob = hit && hit.body && hit.body.obj;
  const mira = hit && hit.body && hit.body.verity ? 'you (Verity)' : ob ? ob.nombre : hit && hit.body && hit.body.persona ? 'a player' : hit ? 'ground or wall ' + Math.round(hit.t) + 'm' : 'the sky';
  const ahora = TIEMPO.t, mios = OBJS.filter((o) => !o.remoto && !o.verity && ahora - o.creado < 120).length;
  const nomMapa = T('m.' + MUNDO.nombre), mapa = nomMapa && nomMapa !== 'm.' + MUNDO.nombre ? nomMapa : MUNDO.nombre, M = VER.mente, sala = verSala();
  const ctx = { jugador: sala ? '' : PREFS.nombre, mapa, hora: hh + ':' + String(mm).padStart(2, '0'), cerca: cerca.slice(0, 8).map((c) => c[1] + ' ' + Math.round(c[0]) + 'm'),
    jugadores: verJugadores().map((P) => P.nombre + ' ' + Math.round(P.pos.distTo(base)) + 'm').slice(0, 8), mods: modsActivosAhora().map((m) => m.id).slice(0, 8),
    sala: sala ? SALA.n : '', salaId: sala ? SALA.id : '', tuModo: VER.modo, haciendo: verEstado(), energia: Math.round(M.energia * 100) + '%', humor: M.humor > 0.3 ? 'happy' : M.humor < -0.2 ? 'sad' : 'calm', memoria: verMemoria().d.slice(-12) };
  // (lo de "mi" jugador sólo si me habla él)
  if (!sala || VER.hablaCon === 'yo') Object.assign(ctx, { vida: Math.round(J.vida), vivo: J.vivo, vehiculo: J.vehiculo ? J.vehiculo.nombre : '', arma: ARM.lista[ARM.i] || '', corriendo: Math.hypot(J.vel.x, J.vel.z) > 3, mira, construyo: mios });
  return ctx;
}
function verTiempo(ms) { const a = new AbortController(); setTimeout(() => a.abort(), ms); return a.signal; }
// ---------------- Gemini: tu propia clave (directo a Google desde el navegador), el permiso del dueño o los servers premium ----------------
const verGemPropia = () => (typeof PREFS.verGem === 'string' && /^[A-Za-z0-9_.\-]{20,120}$/.test(PREFS.verGem) ? PREFS.verGem : '');
// ---------------- qué IA piensa: la que elegís en su menú ----------------
// "auto": tus claves (si pusiste), las IAs del dueño en la tienda (Gemini para todos; DeepSeek si tiene saldo) y, si no,
// los modelos gratis sin clave ya puestos (OVHcloud y LLM7 desde tu conexión, cada uno con su tope por minuto, y
// Pollinations); "gemini" / "deepseek": ésa primero; "gratis": sólo los sin clave; "mias": sólo tus claves (y los gratis).
const verIA = () => (VERITY_IAS.includes(PREFS.verIA) ? PREFS.verIA : 'auto');
const verClaves = () => { const c = PREFS.verClaves; return c && typeof c === 'object' ? c : (PREFS.verClaves = {}); };
const verHayPropias = () => !!verGemPropia() || Object.keys(VERITY_CLAVES).some((k) => verClaves()[k]);
// (lo que dice la tienda que hay: { gemini: true, deepseek: false, ... }; null si todavía no se sabe)
async function verIasCargar() {
  if (VER.iasT && Date.now() - VER.iasT < 5 * 60e3) return VER.ias; VER.iasT = Date.now();
  try { const r = await fetch(TIENDA_URL + 'verity/ias', { signal: verTiempo(8000) }); VER.ias = r.ok ? (await r.json()).ias || {} : {}; } catch (e) { VER.ias = VER.ias || {}; }
  verIAMostrar(); return VER.ias;
}
const verPremium = () => verHayPropias() || !!PREFS.verTk || !!(VER.ias && VER.ias.gemini) || (verSala() && VERITY_PREMIUM.includes(SALA.id));
function verCerebro() { const ia = verIA(); return ia !== 'auto' ? ia : verHayPropias() ? 'propia' : VER.ias && VER.ias.gemini ? 'gemini' : 'normal'; }
// los modelos estilo OpenAI (los gratis y los de tu clave): el primero que conteste algo que sirva. Cada modelo que dice
// que no descansa (lo que pida, o un minuto); una clave mala se avisa una vez y descansa una hora
const VER_DESCANSO = new Map();
async function verAbiertos(lista, msgs, crear, revisar, ms) {
  for (const P of lista) for (const m of (crear && P.mc) || P.m) {
    const k = P.id + '|' + m; if ((VER_DESCANSO.get(k) || 0) > Date.now() || (VER_DESCANSO.get(P.id) || 0) > Date.now()) continue;
    try {
      const r = await fetch(P.u, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, P.clave ? { Authorization: 'Bearer ' + P.clave } : {}),
        body: JSON.stringify(verityAbierto(m, msgs, crear ? 32000 : 4000, crear, false)), signal: verTiempo(ms) });
      if (r.status === 401 || r.status === 402 || r.status === 403) { VER_DESCANSO.set(P.id, Date.now() + 3600e3); if (P.clave) aviso(T('ver.ia.mal') + ' (' + P.n + ')', 3); break; }
      if (!r.ok) { VER_DESCANSO.set(k, Date.now() + Math.min(3600, +r.headers.get('Retry-After') || (r.status === 429 ? 65 : r.status >= 500 ? 30 : 600)) * 1000); continue; }
      const v = revisar(verityTextoAbierto(await r.json())); if (v) { VER.ultIA = P.id; return v; }
    } catch (e) { if (!(e && e.name === 'AbortError' && crear)) VER_DESCANSO.set(k, Date.now() + 20e3); }
  }
  return null;
}
const verLibres = () => VERITY_LIBRES.map((P) => Object.assign({ n: P.id }, P));
const verPropiasLista = () => Object.entries(VERITY_CLAVES).filter(([k]) => verClaves()[k]).map(([id, P]) => Object.assign({ id: 'tu-' + id, clave: verClaves()[id] }, P));
// (cada modelo tiene su tope por día: uno sin cupo o saturado se saltea un rato; enPartes: lo largo, viendo que sigue vivo)
async function verGemPedir(modelo, cuerpo, ms, clave, enPartes) {
  const k = 'g|' + modelo; if ((VER_DESCANSO.get(k) || 0) > Date.now()) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 20000);
  let r; try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:${enPartes ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave || verGemPropia() }, body: JSON.stringify(enPartes ? verityStream(cuerpo) : cuerpo), signal: ctl.signal }); } catch (e) { clearTimeout(t); return null; }
  if (r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key/i.test(await r.text()))) { clearTimeout(t); VER.gemMala = true; return null; }
  if (r.status === 429) { clearTimeout(t); VER_DESCANSO.set(k, Date.now() + (/PerDay/i.test(await r.text()) ? 3600e3 : 60e3)); return null; }
  if (r.status >= 500) { clearTimeout(t); VER_DESCANSO.set(k, Date.now() + 120e3); return null; }
  if (!r.ok) { clearTimeout(t); return null; }
  if (enPartes) { const x = await verityLeerSSE(r, 120000, () => ctl.abort()); clearTimeout(t); if (!x) VER_DESCANSO.set(k, Date.now() + 120e3); return x ? { texto: x } : null; }
  clearTimeout(t);
  const d = await r.json(), p = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [];
  return { texto: p.filter((x) => !x.thought).map((x) => x.text || '').join(''), audio: p.find((x) => x.inlineData) };
}
async function verGeminiDirecto(c) {
  const msgs = verityMensajes(c); if (!msgs) return null;
  for (const m of VERITY_GEMINI) { try { const o = await verGemPedir(m, verityAGemini(msgs, 8192, 'high'), 90000); const v = o && verityRespuesta(o.texto); if (v) { VER.ultIA = 'tu-google'; return v; } if (VER.gemMala) return null; } catch (e) {} }
  return null;
}
async function verVozGeminiDirecta(t, noche) {
  for (const m of VERITY_GEMINI_VOCES) { try { const o = await verGemPedir(m, verityVozGemini(t, noche), 20000); if (o && o.audio) return await AUD.ctx.decodeAudioData(verityWav(o.audio.inlineData.data, o.audio.inlineData.mimeType).buffer); if (VER.gemMala) return null; } catch (e) {} }
  return null;
}
// probar una clave nueva (una pregunta cortita)
// (se guarda recién cuando contestó: mientras tanto Verity sigue con el cerebro que tenía)
async function verGemProbar(k) {
  if (!/^[A-Za-z0-9_.\-]{20,120}$/.test(k)) return false;
  let ok = false; try { const o = await verGemPedir(VERITY_GEMINI[0], { contents: [{ parts: [{ text: 'Reply with the word ok' }] }], generationConfig: { maxOutputTokens: 5 } }, 15000, k); ok = !!(o && o.texto); } catch (e) {}
  if (ok) { PREFS.verGem = k; VER.gemMala = false; } return ok;
}
// el modelo público deja una respuesta cada 30 s por conexión (si no, contesta 402 o 429 con cuánto esperar): se
// espera el turno y, si igual dice que no, se reintenta una vez
const VER_PUB = 31000;
async function verPublicoTexto(msgs, ms) {
  if (!msgs) return null;
  for (let n = 0; n < 2; n++) {
    const falta = (VER.pubUlt || 0) + VER_PUB - Date.now(); if (falta > 0) await verEsperar(falta); VER.pubUlt = Date.now();
    try {
      const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai', messages: msgs, private: true }), signal: verTiempo(ms || 45000) });
      if (r.status === 402 || r.status === 429) {
        let seg = +r.headers.get('Retry-After') || 0; if (!seg) { try { const m = /retry after (\d+)/i.exec(await r.text()); seg = m ? +m[1] : 30; } catch (e) { seg = 30; } }
        VER.pubUlt = Date.now() + Math.min(35, seg) * 1000 + 500 - VER_PUB; continue;
      }
      const d = await r.json(), t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      return typeof t === 'string' ? t : null;
    } catch (e) { return null; }
  }
  return null;
}
const verPublico = async (c) => verityRespuesta(await verPublicoTexto(verityMensajes(c), 45000));
// sin la tienda, lo que pasa en el juego no gasta el turno del modelo público: lo contesta con un gesto
function verGesto(ev) {
  const I = VER.yo; if (!I) return;
  const G = { hola: ['feliz', 'girar'], jugador: ['feliz', 'girar'], muerte: ['triste', ''], noche: ['pensando', ''], dia: ['feliz', 'saltar'], obra: ['emocionada', 'rebotar'], auto: ['emocionada', ''], explosion: ['sorpresa', 'saltar'], agarrada: ['risa', ''], tirada: ['mareada', ''], congelada: ['enojada', ''], disparo: ['enojada', ''] }[ev];
  if (!G) return; I.emo = G[0]; I.emoT = 3; if (G[1]) verAnim(I, G[1]);
}
// q: lo que le dijeron; ev: un evento del juego; de: el nombre del que le habló (en una sala, siempre); quien: su id
async function verPreguntar(q, ev, de, quien) {
  if (!VER.on) return;
  q = rbTexto(q, 300); if (!q && !ev) return; quien = quien || 'yo';
  if (VER.pensando) { if (q) VER.espera = [q, ev, de, quien]; return; } // (lo último que le dijeron, apenas termine)
  if (q) VER.hablaCon = quien;
  const I = VER.yo, ia = verIA(), c = { l: verLengua(), q, ev: ev || '', de: de || '', n: I.noche > 0.5 ? 1 : 0, h: VER.hist.slice(-8), ctx: verContexto(), tk: PREFS.verTk || '', ia }, turno = VER.turno = (VER.turno || 0) + 1;
  if (q) { VER.hist.push(['u', de ? de + ': ' + q : q]); VER.ultCharla = TIEMPO.t; verAtender(quien, 25); }
  VER.pensando = true; I.pensando = true; verLog(); if (!q || !VER.escucha) verGlobo(I, '', 0, true);
  const msgs = verityMensajes(c), resp = (t) => verityRespuesta(t);
  let v = null;
  if (ia !== 'gratis') {
    // tus claves: directo desde tu aparato (Google y las demás)
    if (verGemPropia() && (ia === 'auto' || ia === 'mias')) v = await verGeminiDirecto(c);
    if (!v && (ia === 'auto' || ia === 'mias')) v = await verAbiertos(verPropiasLista(), msgs, false, resp, 90000);
  }
  if (!v && ia !== 'gratis' && ia !== 'mias' && !VER.sinCF && Date.now() > (VER.cfLleno || 0)) {
    try {
      const r = await fetch(TIENDA_URL + 'verity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c), signal: verTiempo(120000) });
      if (r.ok) { const d = await r.json(); v = verityRespuesta(JSON.stringify(d)); if (v) VER.ultIA = d.f || 'tienda'; }
      else if (r.status === 404 || r.status === 405) VER.sinCF = true; // (la tienda todavía no tiene a Verity)
      else if (r.status === 503) VER.cfLleno = Date.now() + 10 * 60e3; // (sin cupo del día: un rato con el modelo público)
      else if (r.status === 429) { VER.pensando = false; I.pensando = false; if (q) verDecir(I, T('ver.cupo'), 'triste'); verLog(); return; }
    } catch (e) {}
  }
  // los gratis sin clave (desde tu conexión)
  if (!v && msgs) v = await verAbiertos(verLibres(), msgs, false, resp, 90000);
  if (turno !== VER.turno) return; // (la cortaste con la X)
  if (!v && !q) { VER.pensando = false; I.pensando = false; verGlobo(I, '', 0); verGesto(ev); verLog(); if (VER.espera) { const w = VER.espera; VER.espera = null; setTimeout(() => verPreguntar(...w), 200); } return; }
  if (!v) { v = await verPublico(c); if (v) VER.ultIA = 'pollinations'; }
  if (turno !== VER.turno) return;
  VER.pensando = false; I.pensando = false;
  if (!VER.on || VER.yo !== I) return;
  if (!v) { if (q) verDecir(I, T('ver.sinRed'), 'triste'); else verGlobo(I, '', 0); verLog(); return; }
  VER.hist.push(['v', v.decir, v.acciones]); VER.hist = VER.hist.slice(-12);
  if (v.recordar && q) verRecordar(v.recordar);
  const M = VER.mente; M.humor = clamp(M.humor + ({ feliz: 0.08, risa: 0.12, enamorada: 0.12, emocionada: 0.1, triste: -0.1, enojada: -0.12, miedo: -0.06 }[v.emocion] || 0), -1, 1);
  verMemoria().n++; verGuardar(); verLog();
  const l = verIdiomaDe(v.decir, verLengua());
  verDecir(I, v.decir, v.emocion, l);
  if (RED.on) publicar('a', { k: 'verd', t: v.decir, e: v.emocion, l });
  // (lo que hace sola: sólo gestos; lo que le piden, todo, salvo la hora, que es de cada uno)
  verAcciones(q ? v.acciones.filter((a) => a.a !== 'hora' || quien === 'yo') : v.acciones.filter((a) => ['bailar', 'saltar', 'girar', 'luz', 'rodar', 'rebotar', 'amor', 'mareo'].includes(a.a)), quien);
  if (VER.espera) { const w = VER.espera; VER.espera = null; setTimeout(() => verPreguntar(...w), 200); }
}
// un evento del juego: no más de uno cada 30 s (y cada clase con su propia espera)
function verEvento(ev, espera, q) {
  const t = TIEMPO.t; if (!VER.on || VER.pensando || t - VER.tEv < 30 || t - (VER.evT[ev] || -1e9) < espera) return;
  VER.tEv = t; VER.evT[ev] = t; verPreguntar(q || '', ev);
}

// ---------------- hablar: voz de la tienda (MeloTTS) en 3D, o la del navegador ----------------
const verEsperar = (ms) => new Promise((ok) => setTimeout(() => ok(null), ms));
async function verVozCF(t, l, noche) {
  const prem = verPremium();
  if (!AUD.ctx || (!prem && (VER.sinVozCF || !VERITY_VOCES.includes(l)))) return null;
  if (verGemPropia()) { const b = await verVozGeminiDirecta(t, noche); if (b) return b; }
  try {
    const s = verSala() ? SALA.id : '', r = await fetch(TIENDA_URL + 'verity/voz?l=' + l + '&t=' + encodeURIComponent(t.slice(0, 240)) + (s ? '&s=' + encodeURIComponent(s) : '') + (PREFS.verTk ? '&tk=' + PREFS.verTk : '') + (noche ? '&n=1' : ''), { signal: verTiempo(prem ? 14000 : 9000) });
    if (!r.ok) { if (r.status === 404 || r.status === 503) VER.sinVozCF = true; return null; }
    return await AUD.ctx.decodeAudioData(await r.arrayBuffer());
  } catch (e) { return null; }
}
function verCallar(I) {
  if (I.voz) { try { I.voz.s.stop(); } catch (e) {} I.voz = null; }
  if (I.nav && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} I.nav = false; }
}
// la cadena: la voz limpia (apenas más aguda y con un poco de aire); de noche, más grave, lenta, con un eco metálico
function verSonar(I, buf) {
  const c = AUD.ctx, s = c.createBufferSource(), noche = I.noche > 0.5; s.buffer = buf; s.playbackRate.value = noche ? 0.9 : 1.03;
  const seco = c.createGain(), dl = c.createDelay(0.05), moj = c.createGain(), hs = c.createBiquadFilter(), an = c.createAnalyser();
  dl.delayTime.value = noche ? 0.023 : 0.011; moj.gain.value = noche ? 0.45 : 0; seco.gain.value = 1; hs.type = 'highshelf'; hs.frequency.value = 3500; hs.gain.value = noche ? -4 : 1.5; an.fftSize = 512;
  s.connect(seco); s.connect(dl); dl.connect(moj); seco.connect(hs); moj.connect(hs); hs.connect(an);
  const F = fuente3D(I.pos, 1.2); an.connect(F.g); if (F.r) F.r.gain.value = noche ? 1.1 : 0.3;
  I.voz = { s, an, F, b: new Uint8Array(512) }; s.onended = () => { if (I.voz && I.voz.s === s) I.voz = null; };
  s.start(); return buf.duration / s.playbackRate.value;
}
let VER_VOCES = null;
// las voces neuronales de algunos aparatos (Edge, iPhone "mejorada") suenan más reales que la de la tienda
const verNatural = (v) => (v && /natural|neural|premium|enhanced|mejorad|siri/i.test(v.name) ? 1 : 0);
function verVozMejor(l) { if (!('speechSynthesis' in window)) return null; const ll = l.toLowerCase(); return speechSynthesis.getVoices().find((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith(ll) && verNatural(v)) || null; }
function verVozNav(I, t, l) {
  if (!('speechSynthesis' in window)) return 0;
  const S = speechSynthesis, voces = S.getVoices(), loc = verLocale(l).toLowerCase(), ll = l.toLowerCase();
  if (!VER_VOCES || VER_VOCES.n !== voces.length + loc) {
    const de = voces.filter((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith(ll));
    const fem = /female|mujer|femen|paulina|m[oó]nica|helena|luc[ií]a|luciana|samantha|victoria|karen|moira|tessa|zira|joana|amelie|anna|kyoko|elvira|dalia|google/i;
    de.sort((a, b) => verNatural(b) - verNatural(a) || (String(b.lang).toLowerCase() === loc) - (String(a.lang).toLowerCase() === loc) || fem.test(b.name) - fem.test(a.name));
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
    if (d < 25 && !verPremium() && verVozMejor(l)) { dur = verVozNav(I, t, l); I.falsa = dur; }
    const buf = dur ? null : await Promise.race([verVozCF(t, l, I.noche > 0.5), verEsperar(verPremium() ? 7000 : 4000)]);
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
function verAcciones(L, quien) {
  quien = quien || 'yo'; const J = verJugador(quien) || verJugador('yo');
  for (const a of L || []) {
    if (a.a === 'seguir') { VER.modo = 'seguir'; VER.objetivo = quien; VER.tModo = 60; }
    else if (a.a === 'quieta') { VER.modo = 'quieta'; VER.ancla = VER.yo.pos.clone(); VER.tModo = 90; }
    else if (a.a === 'ven') { VER.modo = 'ven'; VER.objetivo = quien; VER.tModo = 12; }
    else if (a.a === 'libre') { VER.modo = 'libre'; verPlan('pasear', 20); }
    else if (a.a === 'explorar') { VER.modo = 'libre'; const foco = verAlgoInteresante(); verPlan(foco ? 'investigar' : 'pasear', 25, foco ? { foco } : null); }
    else if (VER_DUR[a.a]) verAnim(VER.yo, a.a);
    else if (a.a === 'poner') verPoner(a.que, a.n, J);
    else if (a.a === 'construir') verConstruir(a.que, J);
    else if (a.a === 'hora') { DIA.hora = ((+a.h % 24) + 24) % 24; DIA.aplicada = -1; }
    else if (a.a === 'musica' && quien === 'yo') verMedia('radio', a.q);
    else if (a.a === 'video' && quien === 'yo') verMedia('pantalla', a.q);
    else if (a.a === 'emote' && quien === 'yo') verEmote(a.que);
    else if (a.a === 'luz') VER.luz = a.si !== false;
    else if (a.a === 'crear') { if (quien === 'yo') verInventar(a.tipo, a.q, { cambiar: a.cambiar }); else if (RED.on) publicar('a', { k: 'verc', to: quien, tipo: a.tipo, q: a.q, c: a.cambiar ? 1 : 0 }); }
    else if (a.a === 'limpiar') { for (const o of VER.mios) if (OBJS.includes(o)) borrarObjeto(o); VER.mios = []; VER.obra = null; RED.wSucio = true; }
  }
}
// frente a un jugador (el que lo pidió), en el piso
function verDelante(d, lado, J) {
  J = J || { pos: JUG.pos, yaw: JUG.yaw };
  const f = v3(Math.sin(J.yaw), 0, Math.cos(J.yaw)), der = v3(-f.z, 0, f.x), p = vadd(vadd(J.pos, vscale(f, d)), vscale(der, lado || 0));
  const y = pisoBajo(v3(p.x, J.pos.y + 2, p.z), 6); p.y = y === null ? J.pos.y - 0.9 : y; return p;
}
function verCrear(nombre, p, q, opt) {
  if (!reglaSala(nombre)) return null;
  const o = crearObjeto(nombre, p, q, opt); if (!o) return null;
  o.verity = true; VER.mios.push(o); DESHACER.push(o); redObjeto(o);
  verHaz(p); return o;
}
function verPoner(que, n, J) {
  const nom = verNombreProp(que); if (!nom) return;
  n = clamp(n | 0 || 1, 1, 5); J = J || { pos: JUG.pos, yaw: JUG.yaw };
  const F = formaDe(nom), P = puntosForma(F.shape); let w = 1; if (P.length) { let a = 1e9, b = -1e9; for (const v of P) { a = Math.min(a, v.x, v.z); b = Math.max(b, v.x, v.z); } w = b - a; }
  const paso = Math.max(1.1, w + 0.4), d = 3 + w * 0.6, yaw = J.yaw, pos = J.pos.clone();
  for (let i = 0; i < n; i++) VER.tareas.push({ t: TIEMPO.t + 0.35 + i * 0.3, fn: () => { const p = verDelante(d, (i - (n - 1) / 2) * paso, { pos, yaw }); verCrear(nom, p, Quat.axis(0, 1, 0, yaw + Math.PI)); } });
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
function verConstruir(que, J) {
  const B = verBloque(); if (!B) return; J = J || { pos: JUG.pos, yaw: JUG.yaw };
  const L = verObraPlan(que), yaw = J.yaw, f = v3(Math.sin(yaw), 0, Math.cos(yaw)), der = v3(-f.z, 0, f.x), q = Quat.axis(0, 1, 0, yaw);
  const sx = B.s[0] + 0.004, sy = B.s[1] + 0.002, sz = B.s[2] + 0.004, O = verDelante(3 + sz * 0.5, 0, J);
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
  I.anim = VER_DUR[a] ? a : ''; I.animT = VER_DUR[a] || 0; I.animT0 = TIEMPO.t; const c = verMasCerca(I.pos); I.ang = c ? Math.atan2(I.pos.z - c.pos.z, I.pos.x - c.pos.x) : 0; I.centro = c ? c.pos.clone() : I.pos.clone();
  if (a === 'amor') { I.emo = 'enamorada'; I.emoT = 4.5; }
  if (a === 'dormir') { I.emo = 'dormida'; I.emoT = 25; }
  if (a === 'mareo') { I.emo = 'sorpresa'; I.emoT = 2; }
  if (a === 'rebotar') I.vel.y = Math.max(I.vel.y, 5);
  if (I === VER.yo && typeof RED !== 'undefined' && RED.on) RED.ultE = 0;
}
// ---------------- su cabeza: qué hace cuando nadie le pide nada ----------------
function verPlan(n, dur, extra) { VER.plan = Object.assign({ n, t: dur, dest: null, tDest: 0, foco: null, llego: false, t0: TIEMPO.t }, extra || {}); }
// lo que está haciendo, para el modelo (y para el que pregunte "¿qué hacés?")
function verEstado() {
  const P = VER.plan, I = VER.yo; if (!I) return '';
  if (I.fis === 'agarrada' || I.fis === 'remota') return 'being carried by a player with the physics gun';
  if (I.fis === 'suelta') return 'flying through the air after being thrown';
  if (I.fis === 'congelada') return 'frozen in place by a physics gun';
  if (I.anim) return { rodar: 'rolling around', rebotar: 'bouncing', bailar: 'dancing', girar: 'spinning', saltar: 'doing a flip', amor: 'feeling love', mareo: 'dizzy from spinning', dormir: 'sleeping' }[I.anim];
  const nom = (id) => { const J = verJugador(id); return J ? J.nombre : 'someone'; };
  if (VER.modo === 'quieta') return 'staying still where you were asked';
  if (VER.modo === 'seguir') return 'following ' + nom(VER.objetivo);
  if (VER.modo === 'ven') return 'going to ' + nom(VER.objetivo);
  if (!P) return 'floating around';
  return { visitar: 'visiting ' + nom(P.quien), atender: 'talking with ' + nom(P.quien), pasear: 'rolling around exploring the map', investigar: 'looking closely at a ' + (P.foco ? P.foco.n : 'thing'), jugar: P.bola ? 'playing with a ' + P.bola.nombre : 'playing, rolling and bouncing around', descansar: 'resting, sleepy', saludar: 'saying hi to ' + (P.R2 ? P.R2.nombre : 'a player') }[P.n] || '';
}
// algo para ir a mirar cerca de ella: props, autos, entidades (radio, piano, pantalla) y jugadores, que no haya mirado hace poco
function verAlgoInteresante() {
  const M = VER.mente, t = TIEMPO.t, L = [], c = VER.yo ? VER.yo.pos : JUG.pos;
  for (const o of OBJS) { if (o.verity) continue; const d = o.b.pos.distTo(c), k = 'o' + o.id; if (d < 30 && t - (M.vistos.get(k) || -1e9) > 180) L.push({ k, n: o.nombre, p: () => o.b.pos, alto: () => (o.b.aabb ? o.b.aabb.y1 - o.b.pos.y : 1), d }); }
  for (const e of ENTS.lista) { if (!e.b) continue; const d = e.b.pos.distTo(c), k = 'e' + e.id; if (d < 30 && t - (M.vistos.get(k) || -1e9) > 180) L.push({ k, n: e.t, p: () => e.b.pos, alto: () => 1.2, d }); }
  if (!L.length) return null; L.sort((a, b) => a.d - b.d);
  return L[Math.floor(Math.random() * Math.min(5, L.length))];
}
function verJugadorNuevo() { const M = VER.mente, t = TIEMPO.t; for (const R2 of RED.remotos.values()) if (R2.pos.distTo(VER.yo.pos) < 20 && t - (M.saludados.get(R2.id) || -1e9) > 600) return R2; return null; }
function verBola() { let m = null, dm = 20; for (const o of OBJS) { if (o.remoto || o.b.frozen || !/pelota|ball|bouncy/i.test(o.nombre)) continue; const d = o.b.pos.distTo(VER.yo.pos); if (d < dm) { dm = d; m = o; } } return m; }
function verElegirPlan() {
  const M = VER.mente, I = VER.yo, cerca = verMasCerca(I.pos);
  // lejos de todos: va hasta el más cercano
  if (!cerca || cerca.pos.distTo(I.pos) > 45) return verPlan('visitar', 14, { quien: cerca ? cerca.id : 'yo' });
  if (M.energia < 0.18) return verPlan('descansar', 30 + Math.random() * 25);
  const R2 = verJugadorNuevo(); if (R2) return verPlan('saludar', 12, { R2 });
  const foco = verAlgoInteresante(), bola = verBola(), J = verJugadores(), quien = J[Math.floor(Math.random() * J.length)].id;
  const op = [['visitar', 1.5], ['pasear', 2.6], ['jugar', (bola ? 2 : 0.8) + 2.5 * M.aburre], ['investigar', foco ? 2.5 * M.curios + 0.6 : 0]];
  let s = op.reduce((a, o) => a + o[1], 0) * Math.random();
  for (const [n, w] of op) { s -= w; if (s <= 0) { verPlan(n, n === 'visitar' ? 8 + Math.random() * 8 : 14 + Math.random() * 14, n === 'investigar' ? { foco } : n === 'jugar' ? { bola, c: I.pos.clone() } : n === 'visitar' ? { quien } : { c: I.pos.clone() }); return; } }
  verPlan('pasear', 15, { c: I.pos.clone() });
}
// el plan de este cuadro → { dest, vmax: rueda por el piso } o { meta: flota hacia ahí }, y adónde mira (ver)
function verMentePaso(dt) {
  const M = VER.mente, I = VER.yo, t = TIEMPO.t;
  // las órdenes mandan (un rato)
  if (VER.modo !== 'libre' && (VER.tModo -= dt) <= 0) VER.modo = 'libre';
  if (VER.modo === 'quieta' && VER.ancla) return { meta: VER.ancla };
  if (VER.modo === 'seguir' || VER.modo === 'ven') { const J = verJugador(VER.objetivo); if (J) return { meta: verCerca(J), ver: vadd(J.pos, v3(0, 0.7, 0)) }; VER.modo = 'libre'; }
  // las animaciones que van por el piso
  if (I.anim === 'rodar') { I.ang += dt * 1.7; const c = I.centro || I.pos; return { dest: vadd(c, v3(Math.cos(I.ang) * 3.2, 0, Math.sin(I.ang) * 3.2)), vmax: 5.5 }; }
  if (I.anim === 'rebotar' || I.anim === 'dormir') return { dest: I.pos.clone(), vmax: 0 };
  // lo que tiene ganas de hacer
  if (!VER.plan || (VER.plan.t -= dt) <= 0) verElegirPlan();
  const quieto = verJugadores().every((J) => J.id !== 'yo' || Math.hypot(JUG.vel.x, JUG.vel.z) < 0.5);
  M.aburre = clamp(M.aburre + (quieto && t - VER.ultCharla > 30 ? dt / 90 : -dt / 40), 0, 1);
  const Q = VER.plan;
  if (Q.n === 'visitar' || Q.n === 'atender') {
    const J = verJugador(Q.quien); if (!J) { verPlan('pasear', 10, { c: I.pos.clone() }); return { dest: I.pos.clone(), vmax: 0 }; }
    M.energia = clamp(M.energia - dt * 0.0015, 0, 1); return { meta: verCerca(J), ver: vadd(J.pos, v3(0, 0.7, 0)) };
  }
  if (Q.n === 'descansar') {
    M.energia = clamp(M.energia + dt * 0.03, 0, 1); I.emo = 'dormida'; I.emoT = 1;
    if (Math.random() < dt * 1.5) particula(vadd(I.pos, v3(0.15, 0.3, 0)), v3(0.1, 0.5, 0), 1.6, 0.05, [1, 1, 1, 0.8], 'chispa', 1.2);
    const c = verMasCerca(I.pos); if ((c && c.pos.distTo(I.pos) < 2.2) || M.energia >= 1) { Q.t = 0; I.emo = 'sorpresa'; I.emoT = 1.5; }
    return { dest: I.pos.clone(), vmax: 0 };
  }
  if (Q.n === 'pasear') {
    M.energia = clamp(M.energia - dt * 0.003, 0, 1);
    if (!Q.dest || I.pos.distTo(Q.dest) < 0.8 || (Q.tDest -= dt) <= 0) {
      // por ahí, sin irse lejos de la gente
      const c = Math.random() < 0.5 ? (verMasCerca(I.pos) || { pos: I.pos }).pos : Q.c || I.pos, a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12;
      Q.dest = vadd(c, v3(Math.cos(a) * r, 0, Math.sin(a) * r)); Q.tDest = 6 + Math.random() * 4;
    }
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
    // sin pelota: rueda en ochos y salta de vez en cuando
    Q.a = (Q.a || 0) + dt * 1.2; const c = Q.c || I.pos;
    if (Math.random() < dt * 0.4 && I.piso !== null && I.pos.y < I.piso + VER_R + 0.05) I.vel.y = 4.5;
    return { dest: vadd(c, v3(Math.sin(Q.a) * 4.5, 0, Math.sin(Q.a * 2) * 2.2)), vmax: 5.5 };
  }
  if (Q.n === 'investigar' && Q.foco) {
    const F = Q.foco, p = F.p(); M.energia = clamp(M.energia - dt * 0.002, 0, 1); M.vistos.set(F.k, t);
    if (Q.giro === undefined) Q.giro = Math.atan2(I.pos.z - p.z, I.pos.x - p.x);
    Q.giro += dt * 0.45;
    const m = vadd(p, v3(Math.cos(Q.giro) * 1.5, Math.max(0.6, F.alto() + 0.35), Math.sin(Q.giro) * 1.5));
    if (!Q.llego && I.pos.distTo(m) < 1) { Q.llego = true; if (Math.random() < 0.3) verEvento('pensamiento', 150, 'you are looking closely at a ' + F.n + ' nearby'); I.emo = Math.random() < 0.5 ? 'pensando' : 'sorpresa'; I.emoT = 3; }
    return { meta: m, ver: vadd(p, v3(0, F.alto() * 0.6, 0)) };
  }
  if (Q.n === 'saludar' && Q.R2 && RED.remotos.has(Q.R2.id)) {
    const R2 = Q.R2, J = { pos: R2.pos, yaw: R2.yawM || 0 };
    if (!Q.llego && I.pos.distTo(verCerca(J)) < 1.2) { Q.llego = true; VER.mente.saludados.set(R2.id, t); verAnim(I, 'girar'); verEvento('jugador', 0, R2.nombre + ' just arrived near you: say hi to them by name'); }
    return { meta: verCerca(J), ver: vadd(R2.pos, v3(0, 0.7, 0)) };
  }
  verPlan('pasear', 10, { c: I.pos.clone() }); return { dest: I.pos.clone(), vmax: 0 };
}
// ---------------- cada cuadro ----------------
// (para las pruebas y para aparecer: adonde se pondría para hablarte a vos)
function verMeta() { return verCerca({ pos: JUG.pos, yaw: JUG.yaw }); }
function verPaso(dt) {
  verCreaPaso(dt); verEstadoPaso();
  if (typeof RED !== 'undefined') { if (RED.on && !VER.redAnt) VER.tRed = TIEMPO.t; VER.redAnt = RED.on; }
  const maneja = verManejo();
  if (maneja && !VER.on) verAparecer(); else if (!maneja && VER.on) verIrse();
  verRemotosPaso(dt);
  oidoPaso();
  const hay = verHayAlguna(); if (hay) verBoton(); if (VER.bt) VER.bt.style.display = hay ? '' : 'none';
  if (!VER.on) return;
  const I = VER.yo, t = TIEMPO.t;
  const habla = I.voz || I.nav || I.falsa > 0 || I.pensando;
  // agarrada, tirada o congelada: manda la física
  if (!verFisPaso(I, dt)) {
    let o = verMentePaso(dt);
    if (VER.obra && VER.obra.ult) o = { meta: vadd(VER.obra.ult, v3(0, 1.6, 0)) };
    // en el editor de animaciones es tu ayudante: flota al costado del muñeco (a la derecha de la cámara), sin taparlo
    if (typeof EDA !== 'undefined' && EDA.on && EDA.P) { const d = v3(CAM.der.x, 0, CAM.der.z).norm(); o = { meta: vadd(EDA.centro, vadd(vscale(d, 1.25), v3(0, 0.9, 0))), ver: vadd(EDA.P.pos, v3(0, 0.6, 0)) }; }
    // al hablar se queda quieta y mira al que le habla (si estaba rodando, se para)
    if (habla && o.dest) o = { dest: I.pos.clone(), vmax: 0 };
    if (o.meta) verFlotar(I, o.meta, dt); else verRodar(I, o.dest, o.vmax, dt);
    const con = verJugador(VER.hablaCon) || verMasCerca(I.pos), vh = Math.hypot(I.vel.x, I.vel.z);
    const objetivo = habla && con ? vadd(con.pos, v3(0, 0.7, 0)) : o.ver || (vh > 1 ? vadd(I.pos, vscale(I.vel, 2)) : con ? vadd(con.pos, v3(0, 0.7, 0)) : vadd(I.pos, v3(0, 0, 1)));
    const am = vsub(objetivo, I.pos); I.yawM = Math.atan2(am.x, am.z); I.mira = objetivo;
    verCuerpoSync(I);
  }
  VER.tareas = VER.tareas.filter((x) => { if (t >= x.t) { x.fn(); return false; } return true; });
  verObraPaso();
  verCuerpoPaso(I, dt);
  I.noche = verNoche() ? 1 : 0;
  VER.oscura = clamp(VER.oscura + (I.noche ? dt / 20 : -dt / 4), 0, 1);
  verEventosPaso(dt);
}
// ---------------- su cuerpo físico: se la agarra con la pistola de física o la de gravedad ----------------
// Mientras anda sola el cuerpo está congelado y la acompaña (los rayos la tocan, la pistola la agarra). Agarrada, la mueve
// la pistola; al soltarla queda suelta (cae, rebota, rueda) hasta quedarse quieta y vuelve a flotar; si la congelan, se
// queda en el aire un rato. Si la agarra otro jugador, él la mueve en su juego y manda dónde está (verg).
function verCuerpo(I) {
  if (I.b && PH.bodies.includes(I.b)) return I.b;
  const b = new Body(sphereShape(VER_R), 4, { fric: 0.5, rest: 0.55 }); b.verity = I; b.noJug = true; b.frozen = true;
  b.pos.copy(I.pos); b.q.copy(I.q); b.updateWorld(); addBody(b); I.b = b; return b;
}
function verSinCuerpo(I) { if (I.b) { if (ARM.agarre && ARM.agarre.b === I.b) ARM.agarre = null; if (ARM.grav && ARM.grav.b === I.b) ARM.grav = null; removeBody(I.b); I.b = null; } }
function verCuerpoSync(I) { const b = verCuerpo(I); b.frozen = true; b.held = false; b.pos.copy(I.pos); b.q.copy(I.q); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.updateWorld(); }
// devuelve true si este cuadro la mueve la física (no ella)
function verFisPaso(I, dt) {
  const b = verCuerpo(I), mia = I === VER.yo;
  if (b.held) {
    if (I.fis !== 'agarrada') { I.fis = 'agarrada'; I.anim = ''; I.emo = 'sorpresa'; I.emoT = 2.5; if (mia) verEvento('agarrada', 25, (verSala() ? PREFS.nombre : 'the player') + ' grabbed you with the physics gun and is carrying you'); }
    I.pos.copy(b.pos); I.q.copy(b.q); I.vel.copy(b.vel);
    if (!mia && RED.on && (I.tG -= dt) <= 0) { I.tG = 1 / 15; publicar('a', { k: 'verg', to: I.dueno, n: PREFS.nombre, p: [r3(b.pos.x), r3(b.pos.y), r3(b.pos.z)], q: [r4(b.q.x), r4(b.q.y), r4(b.q.z), r4(b.q.w)] }); }
    return true;
  }
  if (I.fis === 'agarrada') {
    // la soltaron: congelada (clic derecho de la pistola) o tirada
    const v = b.vel.len();
    if (!mia) { if (RED.on) publicar('a', { k: 'verg', to: I.dueno, n: PREFS.nombre, fin: 1, cong: b.frozen ? 1 : 0, p: [r3(b.pos.x), r3(b.pos.y), r3(b.pos.z)], v: [r3(b.vel.x), r3(b.vel.y), r3(b.vel.z)] }); I.fis = 'libre'; I.meta.copy(b.pos); return false; }
    verSoltada(I, b.frozen, null, v > 7);
  }
  if (I.fis === 'remota') { if ((I.tFis -= dt) <= 0) verSoltada(I, false, v3(0, 0, 0)); else { verCuerpoSync(I); return true; } }
  if (I.fis === 'congelada') { if ((I.tFis -= dt) <= 0) { I.fis = 'libre'; I.emo = 'feliz'; I.emoT = 2; return false; } b.frozen = true; I.pos.copy(b.pos); return true; }
  if (I.fis === 'suelta') {
    I.pos.copy(b.pos); I.q.copy(b.q); I.vel.copy(b.vel); I.tFis -= dt;
    const piso = pisoBajo(b.pos, 0.3), apoyada = piso !== null && b.pos.y - piso < VER_R + 0.06;
    if (I.tFis <= 0 || (apoyada && b.vel.len() < 0.6 && I.tFis < 2.4) || b.pos.y < MUNDO.lo.y - 30) {
      I.fis = 'libre'; I.suelo = false; I.vel.set(0, 2.5, 0); if (b.pos.y < MUNDO.lo.y - 30) { const c = verMasCerca(I.pos); I.pos.copy(c ? verCerca(c) : verMeta()); }
      if (I.tirada) { I.emo = 'mareada'; I.emoT = 3; I.tirada = false; }
      return false;
    }
    return true;
  }
  return false;
}
// quedó suelta: tirada (con la velocidad que traía), congelada, o empujada (un tiro, la pistola de gravedad)
function verSoltada(I, cong, v, fuerte) {
  const b = verCuerpo(I); b.held = false;
  if (cong) { I.fis = 'congelada'; I.tFis = 20; b.frozen = true; b.vel.set(0, 0, 0); I.emo = 'enojada'; I.emoT = 3; if (I === VER.yo) verEvento('congelada', 30, 'someone froze you in the air with the physics gun'); return; }
  I.fis = 'suelta'; I.tFis = 3; b.frozen = false; if (v) b.vel.copy(v); b.wake(); I.tirada = !!fuerte;
  if (fuerte && I === VER.yo) verEvento('tirada', 25, 'someone threw you hard with the physics gun');
}
// un tiro o un golpe de la pistola de gravedad (lo llaman las armas)
function verEmpujon(I, v, tiro) {
  if (!I) return;
  if (I !== VER.yo) { if (RED.on) publicar('a', { k: 'verg', to: I.dueno, n: PREFS.nombre, fin: 1, tiro: tiro ? 1 : 0, p: [r3(I.pos.x), r3(I.pos.y), r3(I.pos.z)], v: [r3(v.x), r3(v.y), r3(v.z)] }); return; }
  verSoltada(I, false, vadd(I.vel, v), v.len() > 7); I.emo = tiro ? 'enojada' : 'sorpresa'; I.emoT = 3;
  if (tiro) verEvento('disparo', 40, 'someone just shot you (it only pushed you, you are fine)');
}
// flotar: resorte (casi sin rebote) hacia el lugar; si hay algo en el medio, pasa por arriba
function verFlotar(I, m, dt) {
  I.suelo = false; I.rueda = false;
  const dv = vsub(m, I.pos), L = dv.len();
  if (L > 0.4 && (I.nMuro = (I.nMuro || 0) + 1) % 3 === 0) { const h = raycast(I.pos, vscale(dv, 1 / L), Math.min(L, 6) + VER_R, I.b); I.muro = !!(h && h.t < L); }
  if (I.muro) m = vadd(m, v3(0, 2.5, 0));
  if (I.pos.distTo(m) > 60) { I.pos.copy(m); I.vel.set(0, 0, 0); }
  const kf = 18, kd = 7.5;
  I.vel.addS(vsub(m, I.pos), kf * dt); I.vel.scale(Math.exp(-kd * dt)); if (I.vel.len() > 14) I.vel.scale(14 / I.vel.len());
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
  if (vh > 0.5 && (I.nPared = (I.nPared || 0) + 1) % 3 === 0) { const dir = v3(I.vel.x / vh, 0, I.vel.z / vh), h = raycast(I.pos, dir, VER_R + 0.35, I.b); if (h && I.piso != null && I.pos.y < I.piso + VER_R + 0.1) I.vel.y = 4.8; }
  const antes = I.pos.clone(); I.pos.addS(I.vel, dt);
  I.piso = pisoBajo(I.pos, 0.6);
  if (I.piso !== null && I.pos.y < I.piso + VER_R) {
    I.pos.y = I.piso + VER_R;
    if (I.vel.y < -2.2) { I.aplV = Math.min(9, -I.vel.y * 1.6); I.vel.y = I.anim === 'rebotar' ? 5.2 : -I.vel.y * 0.38; }
    else { I.vel.y = I.anim === 'rebotar' ? 5.2 : 0; if (I.anim === 'rebotar') I.aplV = 6; }
  }
  if (I.piso === null && I.pos.y < MUNDO.lo.y - 20) { const c = verMasCerca(I.pos); I.pos.copy(c ? verCerca(c) : verMeta()); I.vel.set(0, 0, 0); }
  // el giro de la pelota: lo que avanzó apoyada en el piso, alrededor del eje perpendicular
  const mv = vsub(I.pos, antes); mv.y = 0; const dl = mv.len();
  I.rueda = dl > 0.004 && I.piso !== null && I.pos.y < I.piso + VER_R + 0.12;
  if (I.rueda) { const ax = v3(mv.z / dl, 0, -mv.x / dl); I.q = Quat.axis(ax.x, ax.y, ax.z, dl / VER_R).mul(I.q).norm(); }

}
// lo de cada Verity (la mía y las otras): orientación, aplaste, boca, mirada, parpadeo, fallas, animaciones y globo
function verCuerpoPaso(I, dt) {
  const t = TIEMPO.t;
  let dy = I.yawM - I.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); I.yaw += dy * Math.min(1, dt * 7);
  // derecha (mirando) salvo mientras rueda o la mueve la física: al parar se endereza
  if (I.dueno === 'yo') { if (!I.rueda && I.fis === 'libre') I.q.slerpTo(Quat.axis(0, 1, 0, I.yaw), 1 - Math.exp(-dt * (I.suelo ? 6 : 9))); }
  else if (I.fis !== 'agarrada') I.q.slerpTo(I.qM, 1 - Math.exp(-dt * 10));
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
  // (el cuerpo generado ya trae su amarillo en la textura: sólo se tiñe de noche y brilla un poco menos)
  const em = G.pk ? [0.32 * k, (0.22 - 0.13 * n) * k, (0.02 - 0.015 * n) * k] : [0.6 * k, (0.42 - 0.24 * n) * k, (0.04 - 0.03 * n) * k];
  const col = G.pk ? [1, 1 - 0.38 * n, 1 - 0.65 * n, 1] : [1, 0.8 - 0.3 * n, 0.12 - 0.08 * n, 1];
  const lejos = G.pk && I.pos.distTo(CAM.pos) > 12;
  encolar(lejos ? G.lejos : G.cuerpo, 0, lejos ? G.mL : G.mC, M, null, { c: col, em });
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
  if (!Array.isArray(vr) || vr.length < 6) { if (I) { verCallar(I); if (I.burb) I.burb.remove(); verSinCuerpo(I); VER.rem.delete(R2.id); } return; }
  if (!I) { if (VER.rem.size >= VER_MAX - 1) return; I = verInst(R2.id); VER.rem.set(R2.id, I); I.pos.set(num(vr[0], -1e4, 1e4, 0), num(vr[1], -1e4, 1e4, 0), num(vr[2], -1e4, 1e4, 0)); }
  I.meta.set(num(vr[0], -1e4, 1e4, 0), num(vr[1], -1e4, 1e4, 0), num(vr[2], -1e4, 1e4, 0)); I.yawM = num(vr[3], -100, 100, 0);
  if (!I.voz && !I.nav && I.emoT <= 0) I.emo = VERITY_EMO[vr[4] | 0] || 'feliz';
  const f = vr[5] | 0, an = VER_ANIMS[(f >> 3) & 15] || '';
  I.noche = f & 1; I.luz = !!(f & 2); I.suelo = !!(f & 4); I.t = TIEMPO.t; I.nombre = R2.nombre;
  if (an !== I.anim) { I.anim = an; I.animT0 = TIEMPO.t; I.animT = an ? VER_DUR[an] : 0; }
  if (vr.length >= 10) { I.qM.x = num(vr[6], -1, 1, 0); I.qM.y = num(vr[7], -1, 1, 0); I.qM.z = num(vr[8], -1, 1, 0); I.qM.w = num(vr[9], -1, 1, 1); I.qM.norm(); }
  // (por si el que la maneja se va: el próximo sigue desde acá)
  VER.ultimo = { pos: I.meta.clone(), q: I.qM.clone(), yaw: I.yawM, emo: I.emo, t: TIEMPO.t };
}
function verRemotosPaso(dt) {
  for (const [id, I] of VER.rem) {
    const R2 = RED.remotos.get(id);
    if (!R2 || TIEMPO.t - I.t > 6) { verCallar(I); if (I.burb) I.burb.remove(); verSinCuerpo(I); VER.rem.delete(id); continue; }
    // agarrada por mí: la mueve mi pistola (y le mando dónde está); si no, va adonde dice el que la maneja
    if (!verFisPaso(I, dt)) { I.pos.lerpTo(I.meta, 1 - Math.exp(-dt * 9)); verCuerpoSync(I); }
    I.mira = CAM.pos; verCuerpoPaso(I, dt);
  }
}
function verRed(d) {
  if (d.k === 'verd') {
    const I = VER.rem.get(d.i); if (!I) return;
    const l = typeof d.l === 'string' && VER_LOCALE[d.l] ? d.l : 'en', t = rbTexto(d.t, 280);
    verDecir(I, t, VERITY_EMO.includes(d.e) ? d.e : 'neutral', l);
    if (!VER.on) { VER.hist.push(['v', t]); VER.hist = VER.hist.slice(-12); verLog(); }
  }
  // (lo que le pedí crear a la Verity de la sala: lo armo yo, con mi cerebro; sólo si se lo pedí hace poco y lo manda ella)
  if (d.k === 'verc') { if (d.to === RED.ID && VER.rem.has(d.i) && performance.now() - (VER.tPedi || -1e9) < 120000 && VERITY_CREA.includes(d.tipo)) verInventar(d.tipo, rbTexto(d.q, 400), { cambiar: !!d.c }); return; }
  if (d.to !== RED.ID || !VER.on) return;
  const t = TIEMPO.t, R2 = RED.remotos.get(d.i), nom = limpio(d.n) || (R2 && R2.nombre) || '?';
  if (d.k === 'verq') {
    const ahora = performance.now(), u = VER.preguntas.get(d.i) || -1e9; if (ahora - u < 2500) return; VER.preguntas.set(d.i, ahora); // (en tiempo real)
    const q = rbTexto(d.t, 200); if (q) verPreguntar(q, '', nom, d.i);
  } else if (d.k === 'verw') { VER.ultCharla = t; verAtender(d.i, 20); VER.yo.emo = 'sorpresa'; VER.yo.emoT = 2;
  } else if (d.k === 'vera' && VER_DUR[d.a]) { verAnim(VER.yo, d.a);
  } else if (d.k === 'verg' && Array.isArray(d.p)) {
    // la agarró otro jugador: está donde dice él; al soltarla, sigue con la física acá
    const I = VER.yo, p = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0));
    if (d.fin) {
      const v = Array.isArray(d.v) ? v3(num(d.v[0], -80, 80, 0), num(d.v[1], -80, 80, 0), num(d.v[2], -80, 80, 0)) : v3();
      I.pos.copy(p); verCuerpo(I).pos.copy(p);
      if (d.tiro) { verEmpujon(I, v, true); return; }
      verSoltada(I, !!d.cong, v, v.len() > 7); if (!d.cong && v.len() > 7) verEvento('tirada', 25, nom + ' threw you hard with the physics gun');
      return;
    }
    if (I.fis !== 'remota') { I.fis = 'remota'; I.anim = ''; I.emo = 'sorpresa'; I.emoT = 2.5; verEvento('agarrada', 25, nom + ' grabbed you with the physics gun and is carrying you'); }
    I.tFis = 1; I.pos.copy(p); if (Array.isArray(d.q)) { I.q.set(num(d.q[0], -1, 1, 0), num(d.q[1], -1, 1, 0), num(d.q[2], -1, 1, 0), num(d.q[3], -1, 1, 1)); I.q.norm(); }
  }
}

// ---------------- el terminal secreto: con el código del dueño, Verity usa su Gemini en este aparato ----------------
// No está en el menú de props: aparece buscando "terminal" o "verity". Es sólo tuyo (no viaja por la red). El código se
// revisa en la tienda (sale de la clave del dueño, que nunca llega al juego) y lo que vuelve es un permiso firmado.
ENT_INFO.terminal = ['terminal', {}];
ENT_TIPO.terminal = {
  dibujar(e) {
    const m = matPropio('termCaja', [0.12, 0.13, 0.16], { pbr: [0.35, 0.6, 0.06] }), p = matPropio('termPant', [0.2, 0.16, 0.02], { pbr: [0.2, 0, 0.05] }), t = TIEMPO.t;
    dibujarCaja(entW(e, 0, 0.45, 0), [0.5, 0.9, 0.4], e.q, m);
    dibujarCaja(entW(e, 0, 1.18, 0.02), [0.7, 0.5, 0.08], e.q, m);
    dibujarCaja(entW(e, 0, 1.18, -0.025), [0.6, 0.4, 0.01], e.q, p, { em: [1.4 + 0.3 * Math.sin(t * 3), 1.05, 0.12] });
    for (const s of [-1, 1]) dibujarCaja(entW(e, s * 0.09, 1.24, -0.032), [0.04, 0.07, 0.005], e.q, matPropio('termOjo', [0.02, 0.02, 0.02]));
    dibujarCaja(entW(e, 0, 1.12, -0.032), [0.16, 0.02, 0.005], e.q, matPropio('termOjo', [0.02, 0.02, 0.02]));
  },
  usar() { verTerminalAbrir(); return true; },
};
function verTerminalPoner() {
  if (JUEGO.estado !== 'juego') return;
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), p = vadd(JUG.pos, vscale(f, 1.6)), y = pisoBajo(v3(p.x, JUG.pos.y + 1, p.z), 0); p.y = y === null ? JUG.pos.y - 0.98 : y;
  for (const e of ENTS.lista.filter((x) => x.t === 'terminal')) entidadQuitar(e);
  entidadCrear({ t: 'terminal', p: [p.x, p.y, p.z], yaw: JUG.yaw + Math.PI });
}
function verTerminalAbrir() {
  let t = $('verTerm');
  if (!t) {
    t = document.createElement('div'); t.id = 'verTerm'; t.className = 'verTuto oc';
    t.innerHTML = `<div class="verTutoC"><button class="verTutoX" data-t="cerrar">${glifo('no')}</button>${icoHTML('ico:verity')}<b></b><div class="verFila"><input id="verTermIn" type="password" autocomplete="off" spellcheck="false" maxlength="40"><button class="verEnv" data-t="ok">${glifo('si')}</button></div></div>`;
    const cerrar = () => { t.classList.add('oc'); if (UI.abierto === 'terminal') UI.abierto = null; };
    const probar = async () => {
      const i = $('verTermIn'), cod = i.value.trim(); if (!cod) return; i.value = '';
      try {
        const r = await fetch(TIENDA_URL + 'verity/llave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: cod }) }), d = await r.json();
        if (r.ok && typeof d.tk === 'string') { PREFS.verTk = d.tk; guardarPrefs(); aviso(T('ver.term.ok'), 3); cerrar(); if (VER.yo) verAnim(VER.yo, 'amor'); verIAMostrar(); return; }
      } catch (e) {}
      aviso(T('ver.term.mal'), 2.5);
    };
    t.addEventListener('click', (ev) => { if (ev.target === t || ev.target.closest('[data-t=cerrar]')) cerrar(); else if (ev.target.closest('[data-t=ok]')) probar(); });
    document.body.appendChild(t);
    $('verTermIn').addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') probar(); if (ev.key === 'Escape') cerrar(); });
  }
  t.querySelector('b').textContent = T('ver.term.n'); $('verTermIn').placeholder = T('ver.term.cod');
  t.classList.remove('oc'); UI.abierto = 'terminal'; soltarPuntero(); setTimeout(() => $('verTermIn').focus(), 30);
}
