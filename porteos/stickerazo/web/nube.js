// Tus packs guardados en tu cuenta (servidor/nube.js): si borrás la app o cambiás de celular, al entrar con Google vuelven.
//  - Unos segundos después de cada cambio, sube los packs que cambiaron (su lista y sólo los archivos nuevos: van con su
//    huella SHA-256 y el servidor la revisa).
//  - Al entrar en un celular sin esos packs, los baja y los arma de nuevo.
//  - Si borrás un pack acá que ya estaba guardado, también se borra de la cuenta.
// Sólo con la cuenta conectada a Google (para poder recuperarla).
import * as P from './puente.js';
import { api, cuenta, API } from './comunidad.js';
const ARCHIVO = /^[A-Za-z0-9_.-]{1,80}\.(webp|png)$/, MAX = 700 * 1024;
const hexDe = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (datos) => hexDe(new Uint8Array(await crypto.subtle.digest('SHA-256', datos)));
const clave = (c) => 'sz_nube_' + c.id;
function leerEstado(c) { try { return JSON.parse(localStorage.getItem(clave(c)) || 'null') || { vistos: [] }; } catch (e) { return { vistos: [] }; } }
function guardarEstado(c, e) { try { localStorage.setItem(clave(c), JSON.stringify(e)); } catch (er) { /* sin lugar */ } }
export const estadoNube = () => { const c = cuenta(); return c && c.google ? leerEstado(c) : null; };

let timer = null, corriendo = null, otraVez = false, callado = false, alTerminar = null;
/** después de cada cambio de los packs: guardar en la cuenta en unos segundos */
export function iniciarNube(f) { alTerminar = f; P.alCambiar(() => { if (!callado) programar(); }); }
export function programar(ms = 4000) { clearTimeout(timer); timer = setTimeout(() => { sincronizar().catch(() => { /* sin conexión: la próxima */ }); }, ms); }

const archivosDe = (p) => {
  const s = new Set(p.bandeja ? [p.bandeja] : []);
  for (const st of p.stickers || []) { s.add(st.archivo); for (const f of (st.proyecto && st.proyecto.fuentes) || []) s.add(f); }
  return [...s].filter((n) => n && ARCHIVO.test(n));
};

/** sube lo que cambió, baja lo que falta acá (celular nuevo) y borra de la cuenta lo que borraste acá */
export async function sincronizar() {
  const c = cuenta(); if (!c || !c.google) return null;
  if (corriendo) { otraVez = true; return corriendo; }
  corriendo = (async () => {
    const est = leerEstado(c), vistos = new Set(est.vistos || []);
    const remoto = await api('/api/nube'), rem = new Map(remoto.packs.map((p) => [p.id, p]));
    let locales = await P.leerPacks();
    const r = { recuperados: 0, subidos: 0, borrados: 0, error: '' };
    // 1) en la cuenta y no acá: si ya lo habíamos visto, lo borraste acá; si no, es un celular nuevo y se recupera
    for (const [id, rp] of rem) {
      if (locales.some((p) => p.id === id)) continue;
      if (vistos.has(id)) { await api(`/api/nube/packs/${encodeURIComponent(id)}`, { method: 'DELETE' }); vistos.delete(id); r.borrados++; continue; }
      if (rp.incompleto) continue;
      const d = await api(`/api/nube/packs/${encodeURIComponent(id)}`);
      callado = true;
      try {
        for (const nombre of Object.keys(d.archivos)) {
          const res = await fetch(`${API}/api/nube/archivos/${encodeURIComponent(id)}/${encodeURIComponent(nombre)}`, { headers: { Authorization: 'Bearer ' + c.token } });
          if (res.ok) await P.guardarArchivo(id, nombre, await res.blob());
        }
        locales = await P.leerPacks();
        if (!locales.some((p) => p.id === id)) { locales.push({ ...d.datos, id, v: (d.datos.v || 0) + 1 }); await P.guardarPacks(locales, { callado: true }); }
      } finally { callado = false; }
      vistos.add(id); r.recuperados++;
    }
    // 2) los de acá que cambiaron (otra «firma»): la lista y sólo los archivos que faltan allá
    for (const p of locales) {
      const arch = {};
      for (const n of archivosDe(p)) { const b = await P.blobDe(p.id, n); if (b && b.size <= MAX) arch[n] = await sha(await b.arrayBuffer()); }
      const firma = await sha(new TextEncoder().encode(JSON.stringify(p) + JSON.stringify(Object.entries(arch).sort())));
      const rp = rem.get(p.id);
      if (rp && rp.firma === firma && !rp.incompleto) { vistos.add(p.id); continue; }
      try {
        const res = await api(`/api/nube/packs/${encodeURIComponent(p.id)}`, { method: 'PUT', json: { datos: p, firma, archivos: arch } });
        for (const n of res.faltan) {
          const b = await P.blobDe(p.id, n); if (!b) continue;
          const sube = await fetch(`${API}/api/nube/archivos/${encodeURIComponent(p.id)}/${encodeURIComponent(n)}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': n.endsWith('.png') ? 'image/png' : 'image/webp', 'X-Huella': arch[n] }, body: b });
          if (!sube.ok) { const j = await sube.json().catch(() => ({})); throw new Error(j.error || 'No se pudo guardar'); }
        }
        vistos.add(p.id); r.subidos++;
      } catch (e) { r.error = e.message; if (e.st === 409 || /llenó/.test(e.message)) break; }
    }
    const fin = await api('/api/nube').catch(() => remoto);
    guardarEstado(c, { vistos: [...vistos], cuando: Date.now(), packs: fin.packs.length, usado: fin.usado, cupo: fin.cupo, error: r.error });
    if (alTerminar) try { alTerminar(r); } catch (e) { /* nada */ }
    return r;
  })().finally(() => { corriendo = null; if (otraVez) { otraVez = false; programar(1500); } });
  return corriendo;
}
