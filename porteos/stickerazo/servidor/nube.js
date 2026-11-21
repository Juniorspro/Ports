// ---------------- tus packs guardados en tu cuenta («la nube») ----------------
// Para no perder nada si borrás la app o cambiás de celular: cada pack (su lista, los stickers, la bandeja y las imágenes
// para volver a editarlo) se guarda atado a tu cuenta. Sólo con la cuenta conectada a Google (para recuperarla).
//  GET    /api/nube                          → tus packs: {id, firma, actualizado, archivos: {nombre: huella}} y lo usado
//  PUT    /api/nube/packs/:id                {datos, firma, archivos: {nombre: huella}} → guarda la lista; borra los
//                                            archivos que ya no están y dice cuáles faltan subir
//  PUT    /api/nube/archivos/:pack/:nombre   el archivo (WebP o PNG), con su huella SHA-256 en X-Huella
//  GET    /api/nube/archivos/:pack/:nombre   para bajarlo (sólo el dueño)
//  DELETE /api/nube/packs/:id                lo borra de la cuenta
// En su propia base (SZ_NUBE, «stickerazo-nube»), así los archivos no llenan la de la comunidad. Cupo por cuenta.
export const CUPO = 25 * 1024 * 1024, MAX_ARCHIVO = 700 * 1024, MAX_PACKS = 80, MAX_DATOS = 200 * 1024;
// (con Premium, diez veces más lugar y cinco veces más packs)
export const CUPO_PREMIUM = 250 * 1024 * 1024, MAX_PACKS_PREMIUM = 400;
const esPremium = (yo) => (yo.premium_hasta || 0) > Date.now();
export const ESQUEMA_NUBE = [
  'CREATE TABLE IF NOT EXISTS nube_packs (usuario TEXT NOT NULL, id TEXT NOT NULL, datos TEXT NOT NULL, firma TEXT NOT NULL, archivos TEXT NOT NULL, actualizado INTEGER NOT NULL, PRIMARY KEY (usuario, id))',
  'CREATE TABLE IF NOT EXISTS nube_archivos (usuario TEXT NOT NULL, pack TEXT NOT NULL, nombre TEXT NOT NULL, h TEXT NOT NULL, n INTEGER NOT NULL, datos BLOB, PRIMARY KEY (usuario, pack, nombre))',
];
const ID = /^[A-Za-z0-9_-]{1,64}$/, NOMBRE = /^[A-Za-z0-9_.-]{1,80}\.(webp|png)$/, HUELLA = /^[a-f0-9]{64}$/;
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
let lista = null;
const preparar = (db) => (lista ||= db.batch(ESQUEMA_NUBE.map((s) => db.prepare(s))).catch((e) => { lista = null; throw e; }));
const usado = async (db, u) => (await db.prepare('SELECT COALESCE(SUM(n), 0) AS t FROM nube_archivos WHERE usuario = ?').bind(u).first()).t;

export async function borrarNube(db, usuario) {
  await preparar(db);
  await db.batch([db.prepare('DELETE FROM nube_archivos WHERE usuario = ?').bind(usuario), db.prepare('DELETE FROM nube_packs WHERE usuario = ?').bind(usuario)]);
}

/** las rutas /api/nube…; devuelve la respuesta o null si no es de acá */
export async function nubeRutas(req, db, yo, r, metodo, { json, error, limite }) {
  if (r !== 'nube' && !r.startsWith('nube/')) return null;
  if (!yo) return error('Entrá con tu cuenta', 401);
  if (!yo.google) return json({ error: 'Conectá tu cuenta de Google para guardar tus stickers', google: true }, 403);
  await preparar(db);
  const u = yo.id, cupo = esPremium(yo) ? CUPO_PREMIUM : CUPO, maxPacks = esPremium(yo) ? MAX_PACKS_PREMIUM : MAX_PACKS;
  let m;
  if (r === 'nube' && metodo === 'GET') {
    const { results } = await db.prepare('SELECT id, firma, archivos, actualizado FROM nube_packs WHERE usuario = ? ORDER BY actualizado DESC').bind(u).all();
    // (incompleto: le falta algún archivo —se cortó la subida o se llenó el lugar—; la app lo vuelve a mandar)
    const hay = new Map((await db.prepare('SELECT pack, COUNT(*) AS n FROM nube_archivos WHERE usuario = ? GROUP BY pack').bind(u).all()).results.map((x) => [x.pack, x.n]));
    return json({ packs: results.map((p) => { const a = JSON.parse(p.archivos); return { id: p.id, firma: p.firma, actualizado: p.actualizado, archivos: a, incompleto: (hay.get(p.id) || 0) < Object.keys(a).length }; }), usado: await usado(db, u), cupo, premium: esPremium(yo) });
  }
  if ((m = /^nube\/packs\/([^/]+)$/.exec(r)) && ID.test(m[1])) {
    const id = m[1];
    if (metodo === 'GET') {
      const p = await db.prepare('SELECT datos, firma, archivos, actualizado FROM nube_packs WHERE usuario = ? AND id = ?').bind(u, id).first();
      return p ? json({ id, datos: JSON.parse(p.datos), firma: p.firma, actualizado: p.actualizado, archivos: JSON.parse(p.archivos) }) : error('No está', 404);
    }
    if (metodo === 'DELETE') {
      await db.batch([db.prepare('DELETE FROM nube_archivos WHERE usuario = ? AND pack = ?').bind(u, id), db.prepare('DELETE FROM nube_packs WHERE usuario = ? AND id = ?').bind(u, id)]);
      return json({ ok: true });
    }
    if (metodo === 'PUT') {
      if (!(await limite('nube:' + u, 3000, 86400))) return error('Muchos cambios hoy. Se sigue guardando mañana.', 429);
      let d; try { d = await req.json(); } catch (e) { return error('Mal armado'); }
      const datos = JSON.stringify(d.datos ?? null), arch = d.archivos && typeof d.archivos === 'object' ? d.archivos : null;
      if (!d.datos || datos.length > MAX_DATOS || !arch || !HUELLA.test(String(d.firma || ''))) return error('Mal armado');
      const nombres = Object.keys(arch);
      if (nombres.length > 400 || !nombres.every((n) => NOMBRE.test(n) && HUELLA.test(String(arch[n])))) return error('Archivos mal nombrados');
      const ya = await db.prepare('SELECT 1 FROM nube_packs WHERE usuario = ? AND id = ?').bind(u, id).first();
      if (!ya && (await db.prepare('SELECT COUNT(*) AS n FROM nube_packs WHERE usuario = ?').bind(u).first()).n >= maxPacks) return error(`Ya guardaste ${maxPacks} packs en tu cuenta: borrá alguno${esPremium(yo) ? '' : ' (con Premium entran 400)'}`, 409);
      await db.prepare('INSERT OR REPLACE INTO nube_packs (usuario, id, datos, firma, archivos, actualizado) VALUES (?, ?, ?, ?, ?, ?)').bind(u, id, datos, d.firma, JSON.stringify(arch), Date.now()).run();
      // (los que ya no están en el pack, afuera; los que están con otra huella, hay que subirlos de nuevo)
      const { results } = await db.prepare('SELECT nombre, h FROM nube_archivos WHERE usuario = ? AND pack = ?').bind(u, id).all();
      const ops = results.filter((x) => arch[x.nombre] !== x.h).map((x) => db.prepare('DELETE FROM nube_archivos WHERE usuario = ? AND pack = ? AND nombre = ?').bind(u, id, x.nombre));
      if (ops.length) await db.batch(ops);
      const tiene = new Set(results.filter((x) => arch[x.nombre] === x.h).map((x) => x.nombre));
      return json({ faltan: nombres.filter((n) => !tiene.has(n)) });
    }
  }
  if ((m = /^nube\/archivos\/([^/]+)\/([^/]+)$/.exec(r)) && ID.test(m[1]) && NOMBRE.test(m[2])) {
    const [, pack, nombre] = m;
    if (metodo === 'GET') {
      const a = await db.prepare('SELECT datos FROM nube_archivos WHERE usuario = ? AND pack = ? AND nombre = ?').bind(u, pack, nombre).first();
      if (!a) return error('No está', 404);
      return new Response(a.datos, { headers: { 'Content-Type': nombre.endsWith('.png') ? 'image/png' : 'image/webp', 'Cache-Control': 'private, no-store', 'Access-Control-Allow-Origin': '*' } });
    }
    if (metodo === 'PUT') {
      const p = await db.prepare('SELECT archivos FROM nube_packs WHERE usuario = ? AND id = ?').bind(u, pack).first();
      const esperada = p && JSON.parse(p.archivos)[nombre];
      if (!esperada) return error('Ese archivo no está en el pack', 409);
      const b = new Uint8Array(await req.arrayBuffer());
      if (b.length > MAX_ARCHIVO) return error('Ese archivo es muy pesado', 413);
      const esWebp = b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
      const esPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
      if (!(nombre.endsWith('.png') ? esPng : esWebp)) return error('Eso no es una imagen');
      const h = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', b)));
      if (h !== esperada || h !== req.headers.get('X-Huella')) return error('El archivo llegó cortado: se reintenta solo', 422);
      const previo = await db.prepare('SELECT n FROM nube_archivos WHERE usuario = ? AND pack = ? AND nombre = ?').bind(u, pack, nombre).first();
      if ((await usado(db, u)) - (previo ? previo.n : 0) + b.length > cupo) return error(esPremium(yo) ? 'Se llenó el lugar de tu cuenta' : 'Se llenó el lugar de tu cuenta (con Premium tenés 10 veces más)', 507);
      await db.prepare('INSERT OR REPLACE INTO nube_archivos (usuario, pack, nombre, h, n, datos) VALUES (?, ?, ?, ?, ?, ?)').bind(u, pack, nombre, h, b.length, b).run();
      return json({ ok: true }, 201);
    }
  }
  return error('No existe', 404);
}
