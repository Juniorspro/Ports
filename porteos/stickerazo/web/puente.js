// El puente con el celular. En la app de Android (window.SZN, Java: Puente) los packs y sus archivos quedan en la memoria
// de la app, donde WhatsApp los lee (el ContentProvider), y la app los sirve en <origen>/archivos/<pack>/<archivo>.
// En el navegador (para probar), en IndexedDB.
// Todo es asíncrono para que las dos formas se usen igual.
const N = typeof window !== 'undefined' && window.SZN ? window.SZN : null;
export const esApp = !!N;
const b64DeBlob = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(blob); });

// ---- navegador: IndexedDB ----
let dbP = null;
function db() {
  return (dbP ||= new Promise((ok, mal) => {
    const r = indexedDB.open('stickerazo', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('datos'); r.result.createObjectStore('archivos'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  }));
}
async function idb(store, modo, f) {
  const d = await db();
  return new Promise((ok, mal) => { const t = d.transaction(store, modo), s = t.objectStore(store), q = f(s); t.oncomplete = () => ok(q && q.result); t.onerror = () => mal(t.error); });
}
const urls = new Map();

export async function leerPacks() {
  if (N) { try { return JSON.parse(N.leerPacks() || '[]'); } catch (e) { return []; } }
  return (await idb('datos', 'readonly', (s) => s.get('packs'))) || [];
}
// (avisa cuando cambian los packs: para guardarlos en la cuenta —nube.js— un rato después)
const oyentes = [];
export const alCambiar = (f) => { oyentes.push(f); };
const avisar = () => { for (const f of oyentes) { try { f(); } catch (e) { /* nada */ } } };
export async function guardarPacks(packs, { callado = false } = {}) {
  if (N) { if (!N.guardarPacks(JSON.stringify(packs))) throw new Error('no se pudo guardar la lista'); if (!callado) avisar(); return; }
  await idb('datos', 'readwrite', (s) => s.put(packs, 'packs'));
  if (!callado) avisar();
}
export async function guardarArchivo(pack, nombre, blob) {
  if (N) { const ok = N.guardarArchivo(pack, nombre, await b64DeBlob(blob)); if (!ok) throw new Error('no se pudo guardar'); return; }
  const k = pack + '/' + nombre; if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
  return idb('archivos', 'readwrite', (s) => s.put(blob, k));
}
// un video hecho en el editor de video: en la app va a la galería (Películas › Stickerazo) de a pedazos de 1 MB; en el
// navegador, se baja
export async function guardarVideo(blob, nombre) {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm', archivo = `${nombre}_${Date.now().toString(36)}.${ext}`;
  if (N && N.videoParte) {
    const T = 1 << 20; let ok = true;
    for (let i = 0; i < blob.size && ok; i += T) ok = N.videoParte(archivo, await b64DeBlob(blob.slice(i, i + T)), i === 0, i + T >= blob.size);
    return ok;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = archivo; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); return true;
}
export async function borrarArchivo(pack, nombre) {
  if (N) return N.borrarArchivo(pack, nombre);
  const k = pack + '/' + nombre; if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
  return idb('archivos', 'readwrite', (s) => s.delete(k));
}
export async function borrarPack(pack) {
  setTimeout(avisar, 0);
  if (N) return N.borrarPack(pack);
  const d = await db();
  return new Promise((ok) => { const t = d.transaction('archivos', 'readwrite'), s = t.objectStore('archivos'), q = s.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (String(c.key).startsWith(pack + '/')) c.delete(); c.continue(); }; t.oncomplete = ok; });
}
// la dirección para mostrar un archivo (v: para que no quede la vieja guardada)
export async function urlDe(pack, nombre, v) {
  if (N) return location.origin + '/archivos/' + encodeURIComponent(pack) + '/' + encodeURIComponent(nombre) + '?v=' + (v || 0);
  const k = pack + '/' + nombre; if (urls.has(k)) return urls.get(k);
  const b = await idb('archivos', 'readonly', (s) => s.get(k)); if (!b) return '';
  const u = URL.createObjectURL(b); urls.set(k, u); return u;
}
export async function blobDe(pack, nombre) {
  if (N) { const r = await fetch(await urlDe(pack, nombre, Date.now())); return r.ok ? r.blob() : null; }
  return idb('archivos', 'readonly', (s) => s.get(pack + '/' + nombre));
}

// ---- WhatsApp ----
// agrega el pack: 'ok' | 'cancelado' | 'sin_whatsapp' | 'error: …' (en el navegador: 'sin_app')
export function agregarAWhatsApp(pack) {
  if (!N) return Promise.resolve('sin_app');
  return new Promise((ok) => { const id = 'w' + Date.now(); (window.__szRespuestas ||= {})[id] = ok; N.agregarAWhatsApp(pack.id, pack.nombre, id); });
}
export async function estaEnWhatsApp(packId) { return N ? !!N.estaEnWhatsApp(packId) : false; }
export async function hayWhatsApp() { return N ? !!N.hayWhatsApp() : false; }
// la app la contesta así (Java → JS)
if (typeof window !== 'undefined') window.__szResponder = (id, r) => { const f = window.__szRespuestas && window.__szRespuestas[id]; if (f) { delete window.__szRespuestas[id]; f(r); } };

export async function compartir(texto, url) {
  if (N) return N.compartir(texto + (url ? '\n' + url : ''));
  if (navigator.share) { try { await navigator.share({ text: texto, url }); return true; } catch (e) { return false; } }
  try { await navigator.clipboard.writeText(texto + (url ? ' ' + url : '')); return true; } catch (e) { return false; }
}
