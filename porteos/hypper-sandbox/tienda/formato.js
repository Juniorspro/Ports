// Formatos de HypperX RezoBox para que la gente publique: SÓLO DATOS, nada de código.
// Lo usan el servidor de la tienda (worker.js) y el juego (armar.py lo mete en la página sin los "export").
//
// Mod (.rbmod):  { formato: 'rezobox-mod', version: 1, nombre, autor, descripcion, etiquetas: [..], icono: emoji o imagen,
//                  efectos: { gravedad, velocidad, salto, tiempo, explosion (multiplicadores), municionInfinita, invencible,
//                             skin (personaje), hora (0-24 o null), armas: [nombres], aparecer: [{ n: objeto, d: metros, lado }] } }
// Mapa (.rbmapa): { formato: 'rezobox-mapa', version: 1, nombre, autor, descripcion, etiquetas, base (mapa del juego), foto (jpeg),
//                  hora, gravedad, objetos: [{ n, p: [x, y, z], q: [x, y, z, w], f: congelado }], aparicion: [x, y, z] o null }
export const ETIQUETAS_RB = ['jugabilidad', 'fisica', 'armas', 'personajes', 'diversion', 'construccion', 'vehiculos', 'aventura', 'pvp', 'otros'];
export const MAPAS_BASE_RB = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space'];
const NOMBRE_OBJ_RB = /^[A-Za-z0-9_ ()\-.]{1,40}$/;
const rbTexto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const rbNum = (v, a, b, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : def; };
const rbImagen = (v, max) => (typeof v === 'string' && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max ? v : null);
const rbEmoji = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 8 && !/[A-Za-z0-9<>"'&]/.test(v) ? v : null);

// devuelve el objeto limpio (con todo dentro de los límites) o un texto con el error
export function validarRB(d) {
  if (!d || typeof d !== 'object') return 'no es un objeto';
  const base = { version: 1, nombre: rbTexto(d.nombre, 40), autor: rbTexto(d.autor, 16) || 'Anónimo', descripcion: rbTexto(d.descripcion, 400),
    etiquetas: [...new Set((Array.isArray(d.etiquetas) ? d.etiquetas : []).filter((e) => ETIQUETAS_RB.includes(e)))].slice(0, 4) };
  if (typeof d.id === 'string' && /^[a-z0-9-]{3,24}$/.test(d.id)) base.id = d.id;
  if (base.nombre.length < 3) return 'el nombre es muy corto';
  if (d.formato === 'rezobox-mod') {
    const e = d.efectos || {};
    const ef = {
      gravedad: rbNum(e.gravedad, 0.05, 3, 1), velocidad: rbNum(e.velocidad, 0.3, 4, 1), salto: rbNum(e.salto, 0.3, 8, 1), tiempo: rbNum(e.tiempo, 0.25, 1, 1),
      explosion: rbNum(e.explosion, 0.5, 5, 1), municionInfinita: !!e.municionInfinita, invencible: !!e.invencible,
      skin: typeof e.skin === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(e.skin) ? e.skin : null,
      hora: e.hora == null || e.hora === '' ? null : rbNum(e.hora, 0, 24, 12),
      armas: (Array.isArray(e.armas) ? e.armas : []).filter((a) => typeof a === 'string' && NOMBRE_OBJ_RB.test(a)).slice(0, 10),
      aparecer: (Array.isArray(e.aparecer) ? e.aparecer : []).slice(0, 30).map((o) => ({ n: String((o && o.n) || ''), d: rbNum(o && o.d, 1, 60, 6), lado: rbNum(o && o.lado, -30, 30, 0) })).filter((o) => NOMBRE_OBJ_RB.test(o.n)),
    };
    return { formato: 'rezobox-mod', ...base, icono: rbEmoji(d.icono) || rbImagen(d.icono, 16000) || '🧩', efectos: ef };
  }
  if (d.formato === 'rezobox-mapa') {
    if (!MAPAS_BASE_RB.includes(d.base)) return 'el mapa base no existe';
    const objs = Array.isArray(d.objetos) ? d.objetos : [];
    if (objs.length > 800) return 'demasiados objetos (máximo 800)';
    const objetos = [];
    for (const o of objs) {
      if (!o || !NOMBRE_OBJ_RB.test(String(o.n || ''))) return 'objeto inválido';
      const p = (Array.isArray(o.p) ? o.p : []).map((v) => rbNum(v, -5000, 5000, 0)), q = (Array.isArray(o.q) ? o.q : []).map((v) => rbNum(v, -1, 1, 0));
      if (p.length !== 3 || q.length !== 4) return 'objeto sin posición o giro';
      objetos.push({ n: String(o.n), p, q, f: o.f ? 1 : 0 });
    }
    const ap = Array.isArray(d.aparicion) && d.aparicion.length === 3 ? d.aparicion.map((v) => rbNum(v, -5000, 5000, 0)) : null;
    return { formato: 'rezobox-mapa', ...base, base: d.base, foto: rbImagen(d.foto, 40000), hora: d.hora == null || d.hora === '' ? null : rbNum(d.hora, 0, 24, 12), gravedad: rbNum(d.gravedad, 0.05, 3, 1), objetos, aparicion: ap };
  }
  return 'formato desconocido';
}
