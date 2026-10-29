// Formatos de HypperX RezoBox para que la gente publique. Lo usan el servidor de la tienda (worker.js) y el juego (armar.py lo
// mete en la página sin los "export"). Los valores casi no tienen límite: sólo se descartan números inválidos y se cortan
// tamaños absurdos. El "codigo" (JavaScript) corre en el juego dentro de un cuadro aislado que habla con la API de mods.
//
// Mod (.rbmod):  { formato: 'rezobox-mod', version: 1, nombre, autor, descripcion, etiquetas, icono ('ico:nombre' o imagen),
//                  efectos: { gravedad, velocidad, salto, tiempo, explosion (multiplicadores), municionInfinita, invencible,
//                             skin, hora, armas: [nombres], aparecer: [{ n, d, lado }] }, codigo: 'JavaScript' }
//                  tipo: 'juego' (cambia tu personaje o cómo se juega: se prende en el menú MOD) o 'asset' (pone cosas: va
//                  en el menú de props, sección Mods, siempre a mano)
// Animación (.rbanim): { formato: 'rezobox-anim', version: 1, nombre, autor, descripcion, cat ('baile' | 'gesto' | 'accion'), foto,
//                  clip: { fps, nf (cuadros), b: [huesos], r: rotaciones int16 en base64 (cuadro × hueso × xyzw), h: cadera
//                  int16 en base64 (cuadro × xyz, en mm) o null, loop } } — las hace el editor de animaciones del juego
// Mapa (.rbmapa): { formato: 'rezobox-mapa', version: 1, nombre, autor, descripcion, etiquetas, base (mapa del juego), foto,
//                  hora, gravedad, objetos: [{ n, p, q, f }], aparicion: [x, y, z],
//                  roles: [{ id, nombre, color, skin, armas, vida, velocidad, salto }], spawns: [{ p, yaw, rol }],
//                  entidades: [{ t: tipo, p: [x, y, z], yaw, prm: { ... } }], codigo: 'JavaScript' }
export const ETIQUETAS_RB = ['jugabilidad', 'fisica', 'armas', 'personajes', 'diversion', 'construccion', 'vehiculos', 'aventura', 'pvp', 'otros'];
export const MAPAS_BASE_RB = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space', 'RB_Llanura', 'RB_Colinas', 'RB_Isla', 'RB_Ciudad', 'RB_Desierto', 'RB_Luna'];
export const HUESOS_ANIM_RB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
export const CATS_ANIM_RB = ['baile', 'gesto', 'accion'];
export const ENTIDADES_RB = ['boton_autos', 'teleport', 'zona_muerte', 'cartel', 'piano', 'radio', 'rampa', 'luz', 'impulso', 'meta', 'musica', 'pantalla'];
const NOMBRE_RB = /^[A-Za-z0-9_ ()\-.]{1,40}$/;
const rbTexto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const rbNum = (v, a, b, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : def; };
const rbImagen = (v, max) => (typeof v === 'string' && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max ? v : null);
// íconos: "ico:nombre" (imágenes del juego). Los emojis de mods viejos se cambian por la imagen que más se parece.
export const ICO_EMOJI_RB = { '🧩': 'mod', '🐉': 'energia', '🌙': 'luna', '🦘': 'salto', '⚡': 'veloz', '♾': 'balas', '🛡': 'dios', '🐢': 'lenta', '💥': 'boom',
  '🔥': 'fuego', '🚀': 'cohete', '👾': 'alien', '🤖': 'robot', '🦖': 'dino', '🏎': 'auto', '🚗': 'auto', '🔫': 'arma', '💣': 'bomba', '🧲': 'iman', '🌪': 'tornado',
  '❄': 'hielo', '👑': 'corona', '🎉': 'fiesta', '🕊': 'volar', '🪆': 'ragdoll', '🐾': 'scp', '🎹': 'piano', '📻': 'radio', '🎵': 'musica', '🎶': 'musica',
  '🌍': 'planeta', '🪐': 'planeta', '🥷': 'shuriken', '💡': 'luz', '🏁': 'meta', '🌀': 'teleport', '☠': 'zona_muerte', '💀': 'zona_muerte', '🛝': 'rampa', '⏫': 'impulso', '🪧': 'cartel' };
export function icoNombreRB(v) {
  if (typeof v !== 'string') return 'mod';
  if (/^ico:[a-z_]{2,20}$/.test(v)) return v.slice(4);
  return ICO_EMOJI_RB[v.replace(/\uFE0F/g, '')] || 'mod';
}
const rbVec = (v, n, lim) => (Array.isArray(v) && v.length === n ? v.map((x) => rbNum(x, -lim, lim, 0)) : null);
const rbColor = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#ffffff');
const rbCodigo = (v) => (typeof v === 'string' && v.trim() ? v.slice(0, 1000000) : null);
const rbNombres = (v, max) => (Array.isArray(v) ? v : []).filter((a) => typeof a === 'string' && NOMBRE_RB.test(a)).slice(0, max);

// devuelve el objeto limpio o un texto con el error
export function validarRB(d) {
  if (!d || typeof d !== 'object') return 'no es un objeto';
  const base = { version: 1, nombre: rbTexto(d.nombre, 60), autor: rbTexto(d.autor, 24) || 'Anónimo', descripcion: rbTexto(d.descripcion, 2000),
    etiquetas: [...new Set((Array.isArray(d.etiquetas) ? d.etiquetas : []).filter((e) => ETIQUETAS_RB.includes(e)))].slice(0, 6) };
  if (typeof d.id === 'string' && /^[a-z0-9-]{3,24}$/.test(d.id)) base.id = d.id;
  if (base.nombre.length < 3) return 'el nombre es muy corto';
  const codigo = rbCodigo(d.codigo); if (codigo) base.codigo = codigo;
  if (d.formato === 'rezobox-mod') {
    const e = d.efectos || {};
    const ef = {
      gravedad: rbNum(e.gravedad, -50, 100, 1), velocidad: rbNum(e.velocidad, 0, 100, 1), salto: rbNum(e.salto, 0, 100, 1), tiempo: rbNum(e.tiempo, 0.05, 4, 1),
      explosion: rbNum(e.explosion, 0, 100, 1), municionInfinita: !!e.municionInfinita, invencible: !!e.invencible,
      skin: typeof e.skin === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(e.skin) ? e.skin : null,
      hora: e.hora == null || e.hora === '' ? null : rbNum(e.hora, 0, 24, 12),
      armas: rbNombres(e.armas, 50),
      aparecer: (Array.isArray(e.aparecer) ? e.aparecer : []).slice(0, 500).map((o) => ({ n: String((o && o.n) || ''), d: rbNum(o && o.d, 0, 500, 6), lado: rbNum(o && o.lado, -500, 500, 0) })).filter((o) => NOMBRE_RB.test(o.n)),
    };
    const m = { formato: 'rezobox-mod', ...base, icono: rbImagen(d.icono, 60000) || 'ico:' + icoNombreRB(d.icono), efectos: ef };
    if (d.tipo === 'asset' || d.tipo === 'juego') m.tipo = d.tipo;
    return m;
  }
  if (d.formato === 'rezobox-anim') {
    const c = d.clip || {}, fps = Math.round(rbNum(c.fps, 5, 60, 20)), nf = Math.round(rbNum(c.nf, 2, 3000, 2)), b64 = /^[A-Za-z0-9+/]*={0,2}$/;
    const b = Array.isArray(c.b) ? c.b.filter((x) => HUESOS_ANIM_RB.includes(x)) : [];
    if (!b.length || b.length !== c.b.length || new Set(b).size !== b.length) return 'la animación no tiene huesos válidos';
    const largo = (n) => Math.ceil(n / 3) * 4;
    if (typeof c.r !== 'string' || !b64.test(c.r) || c.r.length !== largo(nf * b.length * 8)) return 'la animación está dañada';
    const h = typeof c.h === 'string' && b64.test(c.h) && c.h.length === largo(nf * 6) ? c.h : null;
    return { formato: 'rezobox-anim', ...base, foto: rbImagen(d.foto, 60000), cat: CATS_ANIM_RB.includes(d.cat) ? d.cat : 'baile', clip: { fps, nf, b, r: c.r, h, loop: !!c.loop } };
  }
  if (d.formato === 'rezobox-mapa') {
    if (!MAPAS_BASE_RB.includes(d.base)) return 'el mapa base no existe';
    const objs = Array.isArray(d.objetos) ? d.objetos : [];
    if (objs.length > 20000) return 'demasiados objetos (máximo 20000)';
    const objetos = [];
    for (const o of objs) {
      if (!o || !NOMBRE_RB.test(String(o.n || ''))) return 'objeto inválido';
      const p = rbVec(o.p, 3, 1e5), q = rbVec(o.q, 4, 1);
      if (!p || !q) return 'objeto sin posición o giro';
      objetos.push({ n: String(o.n), p, q, f: o.f ? 1 : 0 });
    }
    const roles = (Array.isArray(d.roles) ? d.roles : []).slice(0, 32).map((r, i) => ({ id: /^[a-z0-9_-]{1,24}$/.test(String(r && r.id)) ? r.id : 'rol' + i, nombre: rbTexto(r && r.nombre, 30) || 'Rol ' + (i + 1),
      color: rbColor(r && r.color), skin: typeof (r && r.skin) === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(r.skin) ? r.skin : null, armas: rbNombres(r && r.armas, 50),
      vida: rbNum(r && r.vida, 1, 100000, 100), velocidad: rbNum(r && r.velocidad, 0, 100, 1), salto: rbNum(r && r.salto, 0, 100, 1) }));
    const spawns = (Array.isArray(d.spawns) ? d.spawns : []).slice(0, 256).map((s) => ({ p: rbVec(s && s.p, 3, 1e5), yaw: rbNum(s && s.yaw, -10, 10, 0), rol: s && typeof s.rol === 'string' ? s.rol.slice(0, 24) : null })).filter((s) => s.p);
    const entidades = (Array.isArray(d.entidades) ? d.entidades : []).slice(0, 2000).map((x) => {
      if (!x || !ENTIDADES_RB.includes(x.t)) return null; const p = rbVec(x.p, 3, 1e5); if (!p) return null;
      const prm = {}; for (const [k, v] of Object.entries(x.prm || {}).slice(0, 24)) {
        if (!/^[a-zA-Z0-9_]{1,24}$/.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) prm[k] = v; else if (typeof v === 'boolean') prm[k] = v;
        else if (typeof v === 'string') prm[k] = rbTexto(v, 300); else if (Array.isArray(v)) prm[k] = v.slice(0, 64).map((y) => (typeof y === 'number' && Number.isFinite(y) ? y : rbTexto(y, 60)));
      }
      return { t: x.t, p, yaw: rbNum(x.yaw, -10, 10, 0), prm };
    }).filter(Boolean);
    const ap = rbVec(d.aparicion, 3, 1e5);
    return { formato: 'rezobox-mapa', ...base, base: d.base, foto: rbImagen(d.foto, 120000), hora: d.hora == null || d.hora === '' ? null : rbNum(d.hora, 0, 24, 12),
      gravedad: rbNum(d.gravedad, -50, 100, 1), objetos, aparicion: ap, roles, spawns, entidades };
  }
  return 'formato desconocido';
}
