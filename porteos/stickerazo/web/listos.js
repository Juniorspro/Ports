// Packs listos: frases nuestras, de acá, con nuestras letras y emojis. No son imágenes: se arman en el celular con el
// mismo editor, así que cualquiera se puede cambiar (otra palabra, otro color) antes de guardarlo.
import { Sticker, LADO } from './editor.js';

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
];

// un sticker listo, armado: el texto al medio, grande, y el emoji arriba a la derecha, un poco torcido
export function armarListo(d, n = 0) {
  const s = new Sticker(), t = s.agregarTexto({ texto: d.texto, fuente: d.fuente, color: d.color, contorno: d.contorno, globo: d.globo });
  const largo = Math.max(...d.texto.split('\n').map((l) => [...l].length));
  t.tam = largo <= 4 ? 150 : largo <= 7 ? 120 : 96; s.ajustarTexto(t, true); t.y = LADO / 2 + 36; t.rot = (n % 2 ? 1 : -1) * 0.05;
  if (d.anim) t.anim = d.anim;
  if (d.emoji) { const e = s.agregarEmoji(d.emoji); e.tam = 150; e.x = LADO - 140; e.y = 140; e.rot = n % 2 ? -0.18 : 0.14; if (d.anim && d.anim !== 'aparecer') e.anim = d.anim === 'temblor' ? 'temblor' : 'bamboleo'; }
  s.encajar(); s.sel = -1;
  return s;
}
// los emojis que van en WhatsApp para un sticker listo
export const emojisListo = (d) => [d.emoji || '😂'];
