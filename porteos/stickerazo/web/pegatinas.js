// Las pegatinas de Stickerazo: dibujos propios (nada de emojis ni de otras apps), hechos con formas en un cuadro de
// 200×200 y las letras de la app. Cada una es una lista de pasos: { d: camino SVG, c: relleno, s: trazo (1 = tinta),
// w: grosor } o un texto { t, x, y, z: tamaño, c, s, w, f: letra, rot }; { clip: camino } recorta lo que sigue hasta
// { fin: 1 }. Se dibujan en un lienzo (dibujarPega) y en el sticker quedan como una capa más (con su borde blanco).
const TINTA = '#1b1626', AMA = '#ffd23f', ROSA = '#ff3e8a', CEL = '#3ec7ff', VER = '#4cd964', NAR = '#ff8a1a', ROJO = '#ff4a3d',
  VIO = '#9b5cff', BL = '#ffffff', MAR = '#8b5a2b', BRILLO = 'rgba(255,255,255,0.5)';
const n1 = (x) => Math.round(x * 10) / 10;
const C = (cx, cy, r) => `M${n1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n1(2 * r)} 0a${r} ${r} 0 1 0 ${n1(-2 * r)} 0z`;
const E = (cx, cy, rx, ry) => `M${n1(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${n1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${n1(-2 * rx)} 0z`;
const RR = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const POL = (p) => 'M' + p.map(([x, y]) => `${n1(x)} ${n1(y)}`).join('L') + 'z';
const ESTRELLA = (n, R, r, cx = 100, cy = 100, giro = -90, mueca = 0) => POL(Array.from({ length: n * 2 }, (_, i) => { const a = ((giro + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r + mueca * Math.sin(i * 2.3) : R; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }));
// corazón de ancho w centrado en (cx, cy)
const CORAZON = (cx, cy, w) => { const k = w / 2, P = (x, y) => `${n1(cx + x * k)} ${n1(cy + y * k)}`;
  return `M${P(0, 0.9)}C${P(-0.62, 0.48)} ${P(-1, 0.1)} ${P(-1, -0.3)}C${P(-1, -0.7)} ${P(-0.7, -0.92)} ${P(-0.42, -0.92)}C${P(-0.22, -0.92)} ${P(-0.06, -0.8)} ${P(0, -0.66)}C${P(0.06, -0.8)} ${P(0.22, -0.92)} ${P(0.42, -0.92)}C${P(0.7, -0.92)} ${P(1, -0.7)} ${P(1, -0.3)}C${P(1, 0.1)} ${P(0.62, 0.48)} ${P(0, 0.9)}z`; };
// (elipse girada, como polígono)
const ELIP = (cx, cy, rx, ry, r) => POL(Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a); return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]; }));
const GOTA = (cx, cy, s) => { const P = (x, y) => `${n1(cx + x * s)} ${n1(cy + y * s)}`; return `M${P(0, -1)}C${P(0.25, -0.55)} ${P(0.7, -0.15)} ${P(0.7, 0.3)}C${P(0.7, 0.7)} ${P(0.38, 1)} ${P(0, 1)}C${P(-0.38, 1)} ${P(-0.7, 0.7)} ${P(-0.7, 0.3)}C${P(-0.7, -0.15)} ${P(-0.25, -0.55)} ${P(0, -1)}z`; };
const NUBE = (cx, cy, s) => [[-0.55, 0.12, 0.42], [-0.12, -0.22, 0.5], [0.4, -0.06, 0.44], [0.62, 0.22, 0.3], [0.05, 0.25, 0.55]].map(([x, y, r]) => C(cx + x * s, cy + y * s, r * s)).join('');
const T = (t, o = {}) => ({ t, x: 100, y: 104, z: 60, c: BL, s: TINTA, w: 12, f: 'LuckiestGuy', ...o });
// ---- caras: una base y ojos, boca y extras a elección ----
const OJOS = {
  punto: [{ d: E(72, 90, 9, 13) + E(128, 90, 9, 13), c: TINTA }, { d: C(75, 85, 3.5) + C(131, 85, 3.5), c: BL }],
  feliz: [{ d: 'M57 96Q72 76 87 96M113 96Q128 76 143 96', s: 1, w: 9 }],
  cerrados: [{ d: 'M57 90Q72 104 87 90M113 90Q128 104 143 90', s: 1, w: 9 }],
  corazon: [{ d: CORAZON(72, 90, 36) + CORAZON(128, 90, 36), c: ROJO, s: 1, w: 5 }, { d: C(64, 82, 4) + C(120, 82, 4), c: BRILLO }],
  x: [{ d: 'M60 80L84 102M84 80L60 102M116 80L140 102M140 80L116 102', s: 1, w: 9 }],
  espiral: [{ d: 'M72 92m0-3a3 3 0 1 1-3 3 6 6 0 0 1 6-6 9 9 0 0 1 9 9 12 12 0 0 1-12 12 15 15 0 0 1-15-15M128 92m0-3a3 3 0 1 1-3 3 6 6 0 0 1 6-6 9 9 0 0 1 9 9 12 12 0 0 1-12 12 15 15 0 0 1-15-15', s: 1, w: 6 }],
  enojo: [{ d: E(72, 96, 8, 10) + E(128, 96, 8, 10), c: TINTA }, { d: 'M52 72L88 84M148 72L112 84', s: 1, w: 9 }],
  brillo: [{ d: E(72, 92, 15, 19) + E(128, 92, 15, 19), c: TINTA }, { d: C(77, 84, 6) + C(133, 84, 6) + C(66, 100, 3) + C(122, 100, 3), c: BL }],
  guino: [{ d: 'M57 92Q72 80 87 92', s: 1, w: 9 }, { d: E(128, 90, 9, 13), c: TINTA }, { d: C(131, 85, 3.5), c: BL }],
  arriba: [{ d: E(72, 88, 12, 14) + E(128, 88, 12, 14), c: BL, s: 1, w: 5 }, { d: C(75, 81, 6) + C(131, 81, 6), c: TINTA }],
  lentes: [{ d: 'M40 78h120l-6 22a18 18 0 0 1-17 13h-14a18 18 0 0 1-17-13l-6-14-6 14a18 18 0 0 1-17 13H63a18 18 0 0 1-17-13z', c: TINTA, s: 1, w: 5 }, { d: 'M56 86l14-0M118 86l14 0', s: 'rgba(255,255,255,0.6)', w: 5 }],
  xd: [{ d: 'M58 78L84 92 58 106M142 78L116 92 142 106', s: 1, w: 9 }],
  abajo: [{ d: 'M60 96Q72 104 84 96M116 96Q128 104 140 96', s: 1, w: 8 }],
};
const BOCAS = {
  sonrisa: [{ d: 'M64 124Q100 158 136 124', s: 1, w: 9 }],
  chica: [{ d: 'M82 132Q100 146 118 132', s: 1, w: 8 }],
  abierta: [{ d: 'M58 118Q100 182 142 118z', c: '#6b1426', s: 1, w: 7 }, { d: E(100, 152, 20, 10), c: '#ff7aa8' }],
  triste: [{ d: 'M70 148Q100 120 130 148', s: 1, w: 9 }],
  o: [{ d: E(100, 140, 14, 18), c: '#6b1426', s: 1, w: 7 }],
  plana: [{ d: 'M76 138H124', s: 1, w: 9 }],
  ondulada: [{ d: 'M62 140q9.5-12 19 0t19 0 19 0 19 0', s: 1, w: 8 }],
  lengua: [{ d: 'M66 124Q100 154 134 124', s: 1, w: 9 }, { d: 'M100 136q-16 0-16 14a16 16 0 0 0 32 0q0-14-16-14z', c: '#ff7aa8', s: 1, w: 6 }],
  beso: [{ d: 'M98 122q-14 6 0 12q-14 6 0 12', s: 1, w: 8 }, { d: CORAZON(140, 132, 26), c: ROJO, s: 1, w: 4 }],
  mueca: [{ d: 'M76 138Q106 146 130 124', s: 1, w: 9 }],
  dientes: [{ d: 'M60 120h80q0 40-40 40t-40-40z', c: BL, s: 1, w: 7 }, { d: 'M60 132h80', s: 1, w: 5 }],
};
const cara = (id, nombre, color, ojos, boca, extras = [], antes = []) => ({ id, cat: 'caras', nombre, f: [
  ...antes, { d: C(100, 104, 80), c: color, s: 1, w: 8 }, { d: 'M48 74a58 58 0 0 1 40-38', s: BRILLO, w: 10 },
  ...OJOS[ojos], ...BOCAS[boca], ...extras] });
const LAGRIMAS = [{ d: GOTA(46, 122, 16) + GOTA(154, 122, 16), c: CEL, s: 1, w: 4 }];
const CACHETES = [{ d: E(56, 124, 13, 8) + E(144, 124, 13, 8), c: 'rgba(255,90,130,0.55)' }];
const CHORROS = [{ d: 'M66 104q-6 40 4 80M134 104q6 40-4 80', s: CEL, w: 12 }];
// ---- globos con texto ----
const globo = (id, texto, forma, fondo, letra = BL, extra = {}) => {
  const z = Math.round(Math.min(64, 250 / Math.max(3, [...texto].length)) * (forma === 'redondo' ? 1 : 0.86));
  const base = forma === 'boom' ? [{ d: ESTRELLA(13, 96, 66, 100, 100, -90, 6), c: fondo, s: 1, w: 8 }]
    : forma === 'nube' ? [{ d: NUBE(100, 104, 118), c: fondo, s: 1, w: 8, u: 1 }, { d: C(30, 172, 9) + C(14, 190, 5), c: fondo, s: 1, w: 5 }]
    : [{ d: RR(10, 34, 180, 118, 44) + 'M44 146L30 184 86 150z', c: fondo, s: 1, w: 8 }, { d: 'M34 70a30 30 0 0 1 24-22', s: BRILLO, w: 9 }];
  return { id, cat: 'globos', nombre: texto, ...extra, f: [...base, T(texto, { y: forma === 'boom' ? 104 : forma === 'nube' ? 102 : 96, z, c: letra, s: letra === TINTA ? BL : TINTA, rot: forma === 'boom' ? -0.08 : 0 })] };
};
export const PEGA_CATS = [['caras', 'Caras'], ['globos', 'Globos'], ['simbolos', 'Símbolos'], ['argento', 'Argento'], ['deco', 'Deco']];
export const PEGATINAS = [
  // caras (16)
  cara('risa', 'Me muero', AMA, 'feliz', 'abierta', LAGRIMAS),
  cara('llanto', 'Llanto', AMA, 'cerrados', 'triste', CHORROS),
  cara('enojo', 'Enojo', '#ff6b4a', 'enojo', 'triste', [{ d: NUBE(30, 34, 24) + NUBE(170, 34, 24), c: '#e8e4f0', s: 1, w: 4, u: 1 }]),
  cara('amor', 'Enamorado', AMA, 'corazon', 'sonrisa', CACHETES),
  cara('sorpresa', 'Sorpresa', AMA, 'punto', 'o', [{ d: 'M58 64L86 58M142 64L114 58', s: 1, w: 7 }]),
  cara('guino', 'Guiño', AMA, 'guino', 'lengua'),
  cara('pienso', 'Pensando', AMA, 'arriba', 'plana', [T('?', { x: 168, y: 36, z: 54, c: VIO, w: 10, rot: 0.2 })]),
  cara('dormido', 'Dormido', '#ffe27a', 'cerrados', 'chica', [T('Z', { x: 158, y: 50, z: 40, c: CEL, w: 8, rot: 0.2 }), T('z', { x: 182, y: 22, z: 28, c: CEL, w: 7, rot: 0.2 })]),
  cara('cool', 'Facherito', AMA, 'lentes', 'mueca'),
  cara('loco', 'Mareado', '#b8ef6a', 'espiral', 'ondulada'),
  cara('verguenza', 'Vergüenza', AMA, 'abajo', 'chica', [...CACHETES, { d: GOTA(160, 70, 14), c: CEL, s: 1, w: 4 }]),
  cara('xd', 'XD', AMA, 'xd', 'abierta'),
  cara('asco', 'Asco', '#a6e05a', 'cerrados', 'ondulada'),
  cara('muerto', 'Me morí', '#e8e4f0', 'x', 'lengua'),
  cara('beso', 'Beso', AMA, 'guino', 'beso', CACHETES),
  cara('ojitos', 'Porfa', AMA, 'brillo', 'chica', CACHETES),
  cara('nervios', 'Nervios', AMA, 'punto', 'dientes', [{ d: GOTA(156, 60, 16), c: CEL, s: 1, w: 4 }]),
  // globos (15)
  globo('g_jaja', 'JAJA', 'redondo', ROSA), globo('g_xd', 'XD', 'redondo', AMA, TINTA), globo('g_wow', 'WOW', 'boom', AMA, ROJO),
  globo('g_omg', 'OMG', 'boom', ROSA, BL, { premium: true }), globo('g_no', 'NO', 'redondo', ROJO), globo('g_si', 'SÍ', 'redondo', VER),
  globo('g_ok', 'OK', 'redondo', CEL), globo('g_que', '¿QUÉ?', 'nube', BL, VIO), globo('g_ah', '!!', 'boom', NAR),
  globo('g_boom', 'BOOM', 'boom', NAR, AMA, { premium: true }), globo('g_plop', 'PLOP', 'nube', CEL), globo('g_zzz', 'ZZZ', 'nube', '#e8e4f0', VIO),
  globo('g_faa', 'FAAA', 'boom', VIO), globo('g_dale', 'DALE', 'redondo', NAR), globo('g_naa', 'NAAA', 'redondo', VIO),
  // símbolos (17)
  { id: 'corazon', cat: 'simbolos', nombre: 'Corazón', f: [{ d: CORAZON(100, 108, 176), c: ROSA, s: 1, w: 8 }, { d: 'M40 66a34 34 0 0 1 30-26', s: BRILLO, w: 11 }] },
  { id: 'roto', cat: 'simbolos', nombre: 'Corazón roto', f: [{ d: CORAZON(100, 108, 176), c: ROJO, s: 1, w: 8 }, { d: 'M100 34L84 70 112 94 90 124 104 168', s: 1, w: 8 }, { d: 'M100 34L84 70 112 94 90 124 104 168', s: BL, w: 3 }] },
  { id: 'estrella', cat: 'simbolos', nombre: 'Estrella', f: [{ d: ESTRELLA(5, 92, 42, 100, 108), c: AMA, s: 1, w: 8 }, { d: 'M84 66l10-26', s: BRILLO, w: 9 }] },
  { id: 'rayo', cat: 'simbolos', nombre: 'Rayo', f: [{ d: POL([[118, 10], [44, 112], [92, 112], [74, 190], [156, 80], [106, 80]]), c: AMA, s: 1, w: 8 }] },
  { id: 'fuego', cat: 'simbolos', nombre: 'Fuego', f: [{ d: 'M100 190c-38 0-64-26-64-60 0-30 20-48 34-76 10 12 16 26 16 40 14-14 22-38 18-70 34 22 54 60 54 102 0 38-26 64-58 64z', c: NAR, s: 1, w: 8 }, { d: 'M100 190c-17 0-30-12-30-28 0-15 11-25 21-39 8 10 18 18 18 18s6-8 8-20c10 12 17 26 17 40 0 17-14 29-34 29z', c: AMA }] },
  { id: 'sudor', cat: 'simbolos', nombre: 'Gotita', f: [{ d: GOTA(100, 104, 84), c: CEL, s: 1, w: 8 }, { d: 'M70 110a30 30 0 0 0 14 34', s: BRILLO, w: 10 }] },
  { id: 'pregunta', cat: 'simbolos', nombre: '¿?', f: [T('?', { z: 190, c: VIO, w: 16, y: 112 })] },
  { id: 'exclama', cat: 'simbolos', nombre: '¡!', f: [T('!', { z: 190, c: ROJO, w: 16, y: 112 })] },
  { id: 'cien', cat: 'simbolos', nombre: '100', f: [T('100', { z: 92, c: ROJO, w: 12, y: 86, rot: -0.12 }), { d: 'M30 140Q100 122 172 128M38 164Q100 148 164 152', s: ROJO, w: 11 }] },
  { id: 'check', cat: 'simbolos', nombre: 'Listo', f: [{ d: C(100, 100, 84), c: VER, s: 1, w: 8 }, { d: 'M58 102l28 28 56-62', s: BL, w: 18 }] },
  { id: 'cruz', cat: 'simbolos', nombre: 'Nop', f: [{ d: C(100, 100, 84), c: ROJO, s: 1, w: 8 }, { d: 'M64 64l72 72M136 64l-72 72', s: BL, w: 18 }] },
  { id: 'corona', cat: 'simbolos', nombre: 'Corona', premium: true, f: [{ d: 'M24 70l40 34 36-62 36 62 40-34-16 96H40z', c: AMA, s: 1, w: 8 }, { d: 'M40 150h120', s: 1, w: 6 }, { d: C(100, 128, 10), c: ROSA, s: 1, w: 4 }, { d: C(62, 132, 8) + C(138, 132, 8), c: CEL, s: 1, w: 4 }] },
  { id: 'aureola', cat: 'simbolos', nombre: 'Aureola', premium: true, f: [{ d: E(100, 100, 78, 26), s: TINTA, w: 30 }, { d: E(100, 100, 78, 26), s: AMA, w: 16 }, { d: 'M40 92a62 18 0 0 1 40-12', s: BRILLO, w: 5 }] },
  { id: 'cuernitos', cat: 'simbolos', nombre: 'Cuernitos', premium: true, f: [{ d: 'M30 150Q20 70 66 40Q58 100 90 140z', c: ROJO, s: 1, w: 8 }, { d: 'M170 150Q180 70 134 40Q142 100 110 140z', c: ROJO, s: 1, w: 8 }] },
  { id: 'chispas', cat: 'simbolos', nombre: 'Chispas', f: [{ d: ESTRELLA(4, 60, 14, 84, 84, -90), c: AMA, s: 1, w: 7 }, { d: ESTRELLA(4, 34, 8, 156, 140, -90), c: AMA, s: 1, w: 6 }, { d: ESTRELLA(4, 22, 6, 150, 40, -90), c: BL, s: 1, w: 5 }] },
  { id: 'notas', cat: 'simbolos', nombre: 'Musiquita', f: [{ d: 'M70 150V48l92-20v100', s: 1, w: 12 }, { d: 'M70 62l92-20', s: 1, w: 12 }, { d: E(52, 152, 22, 17) + E(144, 132, 22, 17), c: VIO, s: 1, w: 7 }] },
  { id: 'fantasma', cat: 'simbolos', nombre: 'Fantasmita', f: [{ d: 'M40 180V92a60 60 0 0 1 120 0v88l-20-16-20 16-20-16-20 16-20-16z', c: BL, s: 1, w: 8 }, { d: E(80, 94, 9, 13) + E(120, 94, 9, 13) + E(100, 130, 10, 12), c: TINTA }] },
  // argento (10)
  { id: 'mate', cat: 'argento', nombre: 'Mate', f: [{ d: 'M126 88L156 14', s: TINTA, w: 18 }, { d: 'M126 88L156 14', s: '#cfd6de', w: 9 }, { d: 'M50 90Q44 180 100 182Q156 180 150 90z', c: MAR, s: 1, w: 8 },
    { d: E(100, 90, 52, 14), c: '#c58b4e', s: 1, w: 7 }, { d: E(100, 90, 42, 9), c: '#7cbf3c' }, { d: 'M54 124Q100 140 146 124', s: '#f5d08a', w: 7 }, { d: 'M66 104q-6 36 8 62', s: BRILLO, w: 9 }] },
  { id: 'termo', cat: 'argento', nombre: 'Termo', f: [{ d: RR(64, 44, 72, 146, 22), c: '#2c8a63', s: 1, w: 8 }, { d: RR(76, 14, 48, 38, 10), c: '#cfd6de', s: 1, w: 7 }, { d: RR(64, 96, 72, 40, 0), c: '#1f6b4b' }, { d: 'M64 96h72M64 136h72', s: 1, w: 5 }, { d: 'M80 60v120', s: BRILLO, w: 8 }] },
  { id: 'empanada', cat: 'argento', nombre: 'Empanada', f: [{ d: Array.from({ length: 15 }, (_, i) => { const a = Math.PI + (i / 14) * Math.PI; return C(100 + 84 * Math.cos(a), 150 + 84 * Math.sin(a), 11); }).join(''), c: '#d98a2b', s: 1, w: 6, u: 1 },
    { d: 'M18 150A82 82 0 0 1 182 150Q100 172 18 150z', c: '#f2b04a', s: 1, w: 8 }, { d: 'M50 112q30-30 72-30', s: BRILLO, w: 9 }, { d: 'M70 136q4 6 0 10M100 128q4 6 0 10M130 136q4 6 0 10', s: '#d98a2b', w: 5 }] },
  { id: 'medialuna', cat: 'argento', nombre: 'Medialuna', f: [[38, 138, 20, 28, -1.0], [162, 138, 20, 28, 1.0], [66, 112, 28, 38, -0.6], [134, 112, 28, 38, 0.6], [100, 94, 32, 46, 0]].flatMap(([x, y, rx, ry, r]) => [
    { d: ELIP(x, y, rx, ry, r), c: '#f0a640', s: 1, w: 7 }, { d: ELIP(x - rx * 0.25, y - ry * 0.35, rx * 0.35, ry * 0.25, r), c: 'rgba(255,240,200,0.55)' }]) },
  { id: 'alfajor', cat: 'argento', nombre: 'Alfajor', f: [{ d: E(100, 128, 82, 30), c: '#5a3416', s: 1, w: 8 }, { d: RR(22, 96, 156, 22, 11), c: '#f5e6c8', s: 1, w: 6 }, { d: E(100, 92, 82, 30), c: '#6b3d1a', s: 1, w: 8 }, { d: 'M50 84q30-16 70-12', s: BRILLO, w: 7 }] },
  { id: 'chori', cat: 'argento', nombre: 'Choripán', f: [{ d: RR(14, 74, 172, 74, 37), c: '#e8b46a', s: 1, w: 8 }, { d: RR(26, 82, 148, 40, 20), c: '#a33a2a', s: 1, w: 6 }, { d: 'M50 96l6 4M80 90l6 6M112 98l6 4M140 90l6 6', s: '#4f9a2a', w: 6 }, { d: 'M40 136q60 10 120 0', s: '#c98a3d', w: 6 }] },
  { id: 'pelota', cat: 'argento', nombre: 'Pelota', f: [{ d: C(100, 100, 84), c: BL, s: 1, w: 8 }, { d: POL([[100, 70], [128, 90], [118, 124], [82, 124], [72, 90]]), c: TINTA },
    { d: 'M100 70V20M128 90l44-14M118 124l28 40M82 124l-28 40M72 90L28 76', s: 1, w: 6 }, { d: 'M40 60a74 74 0 0 1 30-28', s: 'rgba(0,0,0,0.08)', w: 10 }] },
  { id: 'sol', cat: 'argento', nombre: 'Solcito', f: [{ d: ESTRELLA(16, 96, 70, 100, 100), c: NAR, s: 1, w: 7 }, { d: C(100, 100, 62), c: AMA, s: 1, w: 7 }, { d: 'M76 92v6M124 92v6', s: 1, w: 9 }, { d: 'M76 120Q100 138 124 120', s: 1, w: 8 }, ...CACHETES.map((x) => ({ ...x, d: E(66, 114, 10, 6) + E(134, 114, 10, 6) }))] },
  { id: 'ddl', cat: 'argento', nombre: 'Dulce de leche', f: [{ d: RR(46, 60, 108, 124, 26), c: '#b36b2a', s: 1, w: 8 }, { d: RR(40, 30, 120, 34, 12), c: ROJO, s: 1, w: 7 }, { d: RR(56, 100, 88, 46, 10), c: BL, s: 1, w: 5 }, T('DDL', { y: 124, z: 34, c: '#b36b2a', w: 0 }), { d: 'M60 76v90', s: BRILLO, w: 8 }] },
  { id: 'camiseta', cat: 'argento', nombre: 'La camiseta', f: [{ clip: 'M60 22l-46 30 20 40 22-10v100h88V82l22 10 20-40-46-30q-20 16-40 0z' }, { d: 'M0 0h200v200H0z', c: BL }, { d: 'M58 0h20v200H58zM90 0h20v200H90zM122 0h20v200h-20z', c: '#74c0ff' }, { fin: 1 },
    { d: 'M60 22l-46 30 20 40 22-10v100h88V82l22 10 20-40-46-30q-20 16-40 0z', s: 1, w: 8 }, T('10', { y: 124, z: 46, c: TINTA, s: BL, w: 8 })] },
  // deco (14)
  { id: 'nube', cat: 'deco', nombre: 'Nube', f: [{ d: NUBE(100, 106, 130), c: BL, s: 1, w: 8, u: 1 }, { d: 'M44 92a30 30 0 0 1 26-24', s: 'rgba(62,199,255,0.25)', w: 9 }] },
  { id: 'arcoiris', cat: 'deco', nombre: 'Arcoíris', f: [...[[ROJO, 86], [NAR, 72], [AMA, 58], [VER, 44], [CEL, 30]].map(([c, r]) => ({ d: `M${100 - r} 140a${r} ${r} 0 0 1 ${2 * r} 0`, s: c, w: 15 })), { d: NUBE(28, 146, 44) + NUBE(172, 146, 44), c: BL, s: 1, w: 6, u: 1 }] },
  { id: 'flor', cat: 'deco', nombre: 'Flor', f: [...Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3; return { d: E(100 + 46 * Math.cos(a), 100 + 46 * Math.sin(a), 36, 36), c: ROSA, s: 1, w: 7 }; }), { d: C(100, 100, 32), c: AMA, s: 1, w: 7 }] },
  { id: 'brillo', cat: 'deco', nombre: 'Brillo', f: [{ d: 'M100 8c6 52 26 72 80 92-54 20-74 40-80 92-6-52-26-72-80-92 54-20 74-40 80-92z', c: AMA, s: 1, w: 8 }] },
  { id: 'confeti', cat: 'deco', nombre: 'Confeti', f: [[30, 40, ROSA, 0.4], [150, 30, CEL, -0.5], [90, 70, AMA, 0.9], [40, 120, VER, -0.3], [160, 110, VIO, 0.6], [100, 160, NAR, -0.8], [60, 176, CEL, 0.2], [150, 170, ROSA, 1.1]].map(([x, y, c, r]) => ({ d: POL([[x - 14 * Math.cos(r) + 6 * Math.sin(r), y - 14 * Math.sin(r) - 6 * Math.cos(r)], [x + 14 * Math.cos(r) + 6 * Math.sin(r), y + 14 * Math.sin(r) - 6 * Math.cos(r)], [x + 14 * Math.cos(r) - 6 * Math.sin(r), y + 14 * Math.sin(r) + 6 * Math.cos(r)], [x - 14 * Math.cos(r) - 6 * Math.sin(r), y - 14 * Math.sin(r) + 6 * Math.cos(r)]]), c, s: 1, w: 5 })) },
  { id: 'mono', cat: 'deco', nombre: 'Moño', f: [{ d: 'M100 100L24 50Q10 100 24 150z', c: ROSA, s: 1, w: 8 }, { d: 'M100 100L176 50Q190 100 176 150z', c: ROSA, s: 1, w: 8 }, { d: RR(84, 80, 32, 40, 12), c: '#ff7aa8', s: 1, w: 7 }] },
  { id: 'burbujas', cat: 'deco', nombre: 'Burbujas', f: [[76, 110, 56], [150, 60, 32], [150, 150, 24]].flatMap(([x, y, r]) => [{ d: C(x, y, r), c: 'rgba(62,199,255,0.35)', s: 1, w: 6 }, { d: `M${x - r * 0.6} ${y - r * 0.1}a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.5} ${-r * 0.5}`, s: BL, w: 6 }]) },
  { id: 'hoja', cat: 'deco', nombre: 'Hojita', f: [{ d: 'M30 170Q20 40 170 30Q180 160 30 170z', c: VER, s: 1, w: 8 }, { d: 'M30 170L150 50M80 120l-6-34M110 90l-4-30M80 120l34 4M110 90l32 2', s: '#2c8a3a', w: 6 }] },
  { id: 'luna', cat: 'deco', nombre: 'Lunita', premium: true, f: [{ d: 'M120 20a84 84 0 1 0 60 120A68 68 0 0 1 120 20z', c: AMA, s: 1, w: 8 }, { d: ESTRELLA(4, 18, 5, 150, 50), c: BL, s: 1, w: 4 }, { d: ESTRELLA(4, 12, 4, 176, 92), c: BL, s: 1, w: 4 }] },
  { id: 'planeta', cat: 'deco', nombre: 'Planeta', premium: true, f: [{ d: C(100, 100, 56), c: VIO, s: 1, w: 8 }, { d: 'M22 120Q100 60 178 80Q190 100 100 130Q20 150 22 120z', c: 'rgba(255,210,63,0.9)', s: 1, w: 6 }, { d: 'M70 70a40 40 0 0 1 24-14', s: BRILLO, w: 8 }] },
  { id: 'diamante', cat: 'deco', nombre: 'Diamante', premium: true, f: [{ d: POL([[50, 40], [150, 40], [186, 84], [100, 182], [14, 84]]), c: CEL, s: 1, w: 8 }, { d: 'M14 84h172M50 40l26 44 24-44 24 44 26-44M76 84l24 98 24-98', s: 1, w: 5 }, { d: 'M58 52l-12 22', s: BL, w: 6 }] },
  { id: 'globoF', cat: 'deco', nombre: 'Globo', f: [{ d: 'M100 140c-36 0-58-30-58-66a58 58 0 0 1 116 0c0 36-22 66-58 66z', c: ROJO, s: 1, w: 8 }, { d: 'M92 140h16l-8 12z', c: ROJO, s: 1, w: 5 }, { d: 'M100 152c-12 14 12 22 0 44', s: 1, w: 5 }, { d: 'M66 64a36 36 0 0 1 18-26', s: BRILLO, w: 10 }] },
  { id: 'regalo', cat: 'deco', nombre: 'Regalo', premium: true, f: [{ d: RR(30, 84, 140, 100, 12), c: VIO, s: 1, w: 8 }, { d: RR(20, 62, 160, 32, 10), c: '#b98bff', s: 1, w: 7 }, { d: 'M88 62h24v122H88z', c: AMA, s: 1, w: 5 }, { d: 'M100 60Q60 10 52 42Q50 60 100 60Q140 60 148 42Q140 10 100 60z', c: AMA, s: 1, w: 6 }] },
  { id: 'estrellitas', cat: 'deco', nombre: 'Estrellitas', f: [{ d: ESTRELLA(5, 46, 20, 66, 70), c: AMA, s: 1, w: 7 }, { d: ESTRELLA(5, 34, 15, 146, 120), c: ROSA, s: 1, w: 6 }, { d: ESTRELLA(5, 24, 10, 70, 160), c: CEL, s: 1, w: 5 }] },
];
export const PEGA = Object.fromEntries(PEGATINAS.map((p) => [p.id, p]));
// dibuja una pegatina en g, en un cuadro de lado×lado
export function dibujarPega(g, p, lado) {
  const k = lado / 200; g.save(); g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round'; let recorte = 0;
  for (const x of p.f) {
    if (x.clip) { g.save(); g.clip(new Path2D(x.clip)); recorte++; continue; }
    if (x.fin) { if (recorte) { g.restore(); recorte--; } continue; }
    if (x.t !== undefined) {
      g.save(); g.translate(x.x, x.y); if (x.rot) g.rotate(x.rot); g.font = `${x.z}px "${x.f}", "LuckiestGuy", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (x.w) { g.lineWidth = x.w; g.strokeStyle = x.s; g.strokeText(x.t, 0, 0); } g.fillStyle = x.c; g.fillText(x.t, 0, 0); g.restore(); continue;
    }
    const P = new Path2D(x.d);
    // (u: varias formas pegadas —una nube— con un solo contorno: el trazo doble atrás y el relleno encima)
    if (x.u) { g.strokeStyle = x.s === 1 ? TINTA : x.s; g.lineWidth = 2 * (x.w || 7); g.stroke(P); g.fillStyle = x.c; g.fill(P); continue; }
    if (x.c) { g.fillStyle = x.c; g.fill(P); }
    if (x.s) { g.strokeStyle = x.s === 1 ? TINTA : x.s; g.lineWidth = x.w || 7; g.stroke(P); }
  }
  while (recorte--) g.restore();
  g.restore();
}
