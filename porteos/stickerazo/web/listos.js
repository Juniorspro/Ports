// Packs listos: frases nuestras, de acá, con nuestras letras y emojis, y los memes (fotos libres, web/memes.js). Se arman
// en el celular con el mismo editor, así que cualquiera se puede cambiar (otra palabra, otro color) antes de guardarlo.
import { Sticker, LADO, lienzo } from './editor.js';
import { MEMES, TIRA } from './memes.js';

const T = (texto, fuente, color, contorno, extra = {}) => ({ texto, fuente, color, contorno, ...extra });
const AM = '#ffd23f', RO = '#ff3e8a', CE = '#3ec7ff', VE = '#4cd964', NA = '#ff7a1a', VI = '#9b5cff', BL = '#ffffff', NE = '#111111';

export const LISTOS = [
  {
    id: 'respuestas', nombre: 'Respuestas al toque', desc: 'Para contestar sin escribir', tags: 'si no dale posta ok bien respuestas chat',
    stickers: [
      T('DE UNA', 'LuckiestGuy', AM, NE, { emoji: '👍' }), T('NI AHÍ', 'LuckiestGuy', RO, NE, { emoji: '🙅' }), T('¿POSTA?', 'Bangers', CE, NE, { emoji: '🤔' }),
      T('RE QUE SÍ', 'Pacifico', RO, BL, { emoji: '✅' }), T('TODO\nBIEN', 'Anton', VE, NE, { emoji: '👌' }), T('NAAA', 'LuckiestGuy', NA, NE, { emoji: '😂' }),
      T('QUÉ CAPO', 'Bangers', AM, NE, { emoji: '🔥' }), T('ESTOY\nEN ESO', 'PermanentMarker', BL, NE, { emoji: '💪' }), T('BANCAME\nUN TOQUE', 'Anton', CE, NE, { emoji: '⏳' }),
      T('LA VERDAD\nQUE NO', 'LuckiestGuy', BL, NE, { emoji: '😐' }),
    ],
  },
  {
    id: 'mate', nombre: 'Mate y facturas', desc: 'La merienda en un pack', tags: 'mate facturas medialunas merienda pava cafe',
    stickers: [
      T('UN MATE\nY ARRANCO', 'LuckiestGuy', VE, NE, { emoji: '🧉' }), T('AGUANTE\nEL MATE', 'Bangers', AM, NE, { emoji: '🧉' }), T('¿QUIÉN\nCEBA?', 'LuckiestGuy', NA, NE, { emoji: '🧉' }),
      T('¿HAY\nFACTURAS?', 'Pacifico', RO, BL, { emoji: '🥐' }), T('¿PONGO\nLA PAVA?', 'Anton', CE, NE, { emoji: '☕' }), T('MEDIALUNAS\nPARA TODOS', 'PermanentMarker', AM, NE, { emoji: '🥐' }),
    ],
  },
  {
    id: 'animados', nombre: 'Animados que hablan', desc: 'Se mueven solos', animado: true, tags: 'animado jaja ok no cumple amor dormir que escribiendo',
    stickers: [
      T('JAJAJA', 'LuckiestGuy', AM, NE, { emoji: '😂', anim: 'temblor' }), T('OK', 'LuckiestGuy', VE, NE, { emoji: '👍', anim: 'latido' }),
      T('NOOO', 'Bangers', RO, NE, { emoji: '😱', anim: 'temblor' }), T('¡FELIZ\nCUMPLE!', 'LuckiestGuy', AM, NE, { emoji: '🥳', anim: 'rebote' }),
      T('TE QUIERO', 'Pacifico', RO, BL, { emoji: '❤️', anim: 'latido' }), T('ME VOY A\nDORMIR', 'Anton', CE, NE, { emoji: '😴', anim: 'flotar' }),
      T('¿QUÉ?', 'LuckiestGuy', NA, NE, { emoji: '🤔', anim: 'pum' }), T('ESCRIBIENDO…', 'PermanentMarker', BL, NE, { emoji: '✍️', anim: 'aparecer' }),
    ],
  },
  {
    id: 'laburo', nombre: 'Laburo y lunes', desc: 'Para el grupo del trabajo', tags: 'laburo trabajo lunes viernes reunion oficina',
    stickers: [
      T('MAÑANA\nARRANCO', 'LuckiestGuy', CE, NE, { emoji: '😅' }), T('LUNES\nOTRA VEZ', 'Anton', BL, NE, { emoji: '😩' }), T('¿YA ES\nVIERNES?', 'Bangers', AM, NE, { emoji: '🙏' }),
      T('EN REUNIÓN', 'PermanentMarker', RO, BL, { emoji: '📵' }), T('SE PUDRIÓ\nTODO', 'LuckiestGuy', NA, NE, { emoji: '🔥' }), T('YA TE\nRESPONDO', 'Anton', VE, NE, { emoji: '👀' }),
    ],
  },
  {
    id: 'futbol', nombre: 'Fútbol con amigos', desc: 'Para el fulbito y los partidos', tags: 'futbol gol partido fulbito arquero campeones',
    stickers: [
      T('¡GOOOL!', 'LuckiestGuy', AM, NE, { emoji: '⚽' }), T('¿FULBITO\nHOY?', 'Bangers', VE, NE, { emoji: '⚽' }), T('¡QUÉ\nATAJADA!', 'LuckiestGuy', CE, NE, { emoji: '🧤' }),
      T('OFFSIDE', 'Anton', RO, BL, { emoji: '🚩' }), T('DALE\nCAMPEÓN', 'Bangers', BL, NE, { emoji: '🏆' }), T('¿Y EL\nPENAL?', 'PermanentMarker', NA, NE, { emoji: '😤' }),
    ],
  },
  {
    id: 'asado', nombre: 'Asado del domingo', desc: 'Para el grupo del asado', tags: 'asado parrilla domingo vino chori amigos',
    stickers: [
      T('¿QUIÉN\nPRENDE\nEL FUEGO?', 'LuckiestGuy', NA, NE, { emoji: '🔥' }), T('UN APLAUSO\nPARA EL\nASADOR', 'Bangers', AM, NE, { emoji: '👏' }), T('YO LLEVO\nEL VINO', 'Pacifico', RO, BL, { emoji: '🍷' }),
      T('VACÍO\nY CHORI', 'Anton', BL, NE, { emoji: '🥩' }), T('¿Y LA\nENSALADA?', 'LuckiestGuy', VE, NE, { emoji: '🥗' }), T('JUGOSITO,\nPOR FAVOR', 'PermanentMarker', RO, BL, { emoji: '😋' }),
    ],
  },
  {
    id: 'familia', nombre: 'El grupo de la familia', desc: 'Para la tía, la abuela y los primos', tags: 'familia abuela mama tia primos grupo',
    stickers: [
      T('¿YA\nCOMISTE?', 'LuckiestGuy', AM, NE, { emoji: '🍝' }), T('ABRIGATE', 'Bangers', CE, NE, { emoji: '🧣' }), T('AVISÁ\nCUANDO\nLLEGÁS', 'Anton', BL, NE, { emoji: '📲' }),
      T('¿QUIÉN TRAE\nEL POSTRE?', 'Pacifico', RO, BL, { emoji: '🍰' }), T('MANDÁ\nFOTO', 'LuckiestGuy', VE, NE, { emoji: '📸' }), T('BENDICIONES', 'PermanentMarker', AM, NE, { emoji: '🙏' }),
    ],
  },
  {
    id: 'chamuyo', nombre: 'Amor y chamuyo', desc: 'Para el crush y la pareja', tags: 'amor chamuyo crush pareja novia novio',
    stickers: [
      T('¿VENÍS\nSEGUIDO?', 'Pacifico', RO, BL, { emoji: '😏' }), T('SOS UN\nSOLCITO', 'LuckiestGuy', AM, NE, { emoji: '☀️' }), T('TE BANCO', 'Bangers', RO, NE, { emoji: '💪' }),
      T('MI VIDA', 'Pacifico', RO, BL, { emoji: '❤️' }), T('¿UN MATE\nJUNTOS?', 'LuckiestGuy', VE, NE, { emoji: '🧉' }), T('EXTRAÑO', 'Anton', VI, NE, { emoji: '🥺' }),
    ],
  },
  {
    id: 'clima', nombre: 'Calor, frío y humedad', desc: 'Para quejarse del tiempo', tags: 'calor frio humedad lluvia tormenta clima',
    stickers: [
      T('¡QUÉ\nCALOR!', 'LuckiestGuy', NA, NE, { emoji: '🥵' }), T('LA HUMEDAD,\nLOCO', 'Bangers', CE, NE, { emoji: '💦' }), T('SE VIENE\nLA TORMENTA', 'Anton', BL, NE, { emoji: '⛈️' }),
      T('HACE UN\nFRÍO…', 'LuckiestGuy', CE, NE, { emoji: '🥶' }), T('¿LLEVO\nPARAGUAS?', 'PermanentMarker', AM, NE, { emoji: '☂️' }), T('40 GRADOS\nA LA SOMBRA', 'Bangers', RO, NE, { emoji: '☀️' }),
    ],
  },
  {
    id: 'bondi', nombre: 'Bondi y llegadas tarde', desc: 'Para avisar (que llegás tarde)', tags: 'bondi colectivo subte transito tarde llegando',
    stickers: [
      T('ESTOY\nLLEGANDO', 'LuckiestGuy', AM, NE, { emoji: '🏃' }), T('ME DEJÓ\nEL BONDI', 'Bangers', RO, NE, { emoji: '🚌' }), T('YA SALGO', 'Anton', VE, NE, { emoji: '🚪' }),
      T('¡QUÉ\nTRÁNSITO!', 'LuckiestGuy', NA, NE, { emoji: '🚗' }), T('CINCO\nMINUTOS', 'PermanentMarker', BL, NE, { emoji: '⏱️' }), T('¿DÓNDE\nESTÁS?', 'Pacifico', CE, BL, { emoji: '📍' }),
    ],
  },
  {
    id: 'seleccion', nombre: 'Vamos Argentina', desc: 'Para los partidos de la Selección', tags: 'argentina seleccion futbol mundial partido gol',
    stickers: [
      T('¡VAMOS\nARGENTINA!', 'LuckiestGuy', CE, NE, { emoji: '🇦🇷' }), T('¡QUÉ\nPARTIDAZO!', 'Bangers', AM, NE, { emoji: '⚽' }), T('SUFRÍ\nCOMO LOCO', 'Anton', BL, NE, { emoji: '😰' }),
      T('¡DALE QUE\nSE PUEDE!', 'LuckiestGuy', CE, NE, { emoji: '💪' }), T('CAMPEONES', 'Bangers', AM, NE, { emoji: '🏆' }), T('¡GOLAZO!', 'LuckiestGuy', CE, NE, { emoji: '🔥' }),
    ],
  },
  {
    id: 'filete', nombre: 'Fileteado porteño', desc: 'Frases de colectivo, con filete', tags: 'filete fileteado porteno frases colectivo argentina',
    stickers: [
      T('MI\nVIEJA', 'LuckiestGuy', AM, NE, { filete: true }), T('EL QUE\nAVISA NO\nTRAICIONA', 'LuckiestGuy', AM, NE, { filete: true }), T('DIOS ME\nLA BENDIGA', 'LuckiestGuy', AM, NE, { filete: true }),
      T('TODO\nTIENE SU\nHORA', 'LuckiestGuy', AM, NE, { filete: true }), T('LA VIDA\nES UNA\nSOLA', 'LuckiestGuy', AM, NE, { filete: true }), T('DE LA\nCUNA A LA\nTUMBA', 'LuckiestGuy', AM, NE, { filete: true }),
    ],
  },
];

// los memes van primero (como en el inicio de las apps de stickers)
LISTOS.unshift(...MEMES);

// las fotos de los memes, ya cargadas (como lienzo: el editor y el guardado trabajan con lienzos)
const FOTOS = new Map();
export function prepararListo(pk) {
  if (!pk || !pk.meme) return Promise.resolve();
  return Promise.all(pk.stickers.map((d) => {
    if (FOTOS.has(d.img)) return FOTOS.get(d.img);
    const p = new Promise((ok) => { const im = new Image(); im.onload = () => { const c = lienzo(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); FOTOS.set(d.img, c); ok(c); }; im.onerror = () => { FOTOS.delete(d.img); ok(null); }; im.src = d.img; });
    FOTOS.set(d.img, p); return p;
  }));
}
// (un texto largo de meme va en dos renglones, cortado en el espacio más cercano a la mitad)
function partir(t, max = 15) {
  if ([...t].length <= max || !t.includes(' ')) return t;
  const m = t.length / 2; let mejor = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (mejor < 0 || Math.abs(i - m) < Math.abs(mejor - m))) mejor = i;
  return t.slice(0, mejor) + '\n' + t.slice(mejor + 1);
}
// un meme: la foto (ya «arruinada» a propósito) y su texto, según el estilo:
//  impact: mayúscula blanca con borde negro, abajo («arriba|abajo» para los dos) · comic: minúscula blanca con borde negro,
//  abajo · tira: letra negra en la franja blanca de arriba (la franja viene en la foto)
function armarMeme(d) {
  const s = new Sticker(), foto = FOTOS.get(d.img);
  if (foto && !(foto instanceof Promise)) s.agregarImagen(foto);
  const lado = LADO - 2 * (16 + 4), arriba = (LADO - lado) / 2, abajo = arriba + lado, k = lado / 512;
  const poner = (txt, donde) => {
    const tira = d.estilo === 'tira' && donde === 'arriba', comic = d.estilo !== 'impact';
    const t = s.agregarTexto({ texto: partir(txt, tira ? 26 : comic ? 14 : 15), fuente: comic ? 'ComicNeue' : 'Anton', color: tira ? '#111111' : '#ffffff', contorno: tira ? '' : '#111111' });
    t.tam = tira ? 52 : comic ? 70 : 64; const m = s.medidas(t), anchoMax = lado - (tira ? 24 : 34), altoMax = tira ? (TIRA - 10) * k : lado * 0.4;
    t.esc = Math.min(1, anchoMax / m.w, altoMax / m.h); t.x = LADO / 2;
    const alto = (m.h * t.esc) / 2;
    t.y = tira ? arriba + (TIRA * k) / 2 + 2 : donde === 'arriba' ? arriba + 20 + alto : abajo - 10 - alto;
  };
  const [a, b] = String(d.texto || '').split('|');
  if ((d.estilo === 'impact' || d.estilo === 'tira') && b !== undefined) { if (a) poner(a, 'arriba'); if (b) poner(b, 'abajo'); }
  else if (d.texto) poner(d.texto.replace('|', ' '), d.estilo === 'tira' ? 'arriba' : 'abajo');
  s.sel = -1;
  return s;
}

// un sticker listo, armado: el texto al medio, grande, y el emoji arriba a la derecha, un poco torcido
export function armarListo(d, n = 0) {
  if (d.img) return armarMeme(d);
  const s = new Sticker(), t = s.agregarTexto({ texto: d.texto, fuente: d.fuente, color: d.color, contorno: d.contorno, globo: d.globo, filete: d.filete });
  const largo = Math.max(...d.texto.split('\n').map((l) => [...l].length));
  t.tam = d.filete ? 120 : largo <= 4 ? 150 : largo <= 7 ? 120 : 96; s.ajustarTexto(t, true); t.y = LADO / 2 + (d.emoji ? 36 : 0); t.rot = (n % 2 ? 1 : -1) * (d.filete ? 0.02 : 0.05);
  if (d.anim) t.anim = d.anim;
  if (d.emoji) { const e = s.agregarEmoji(d.emoji); e.tam = 150; e.x = LADO - 140; e.y = 140; e.rot = n % 2 ? -0.18 : 0.14; if (d.anim && d.anim !== 'aparecer') e.anim = d.anim === 'temblor' ? 'temblor' : 'bamboleo'; }
  s.encajar(); s.sel = -1;
  return s;
}
// los emojis que van en WhatsApp para un sticker listo
export const emojisListo = (d) => [d.emoji || '😂'];
